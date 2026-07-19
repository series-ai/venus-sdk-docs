# Syncplay: collaborative editing (BETA)

How to build a shared level editor — several people editing one level while
standing in it — on the deterministic substrate, without a second realtime
channel and without a bespoke conflict-resolution layer.

> **Status.** Beta. Every primitive on this page is implemented:
> `submitCommand` / `sendEphemeral` / `onEphemeral` / `requestReconfigure` and
> `drainConfirmedPresentationFrames` on the runner and the networked client,
> `reconfigureSession` and `reconfigurePolicy` on the authority,
> `predictionMode` on both. Two limits are worth knowing before you design
> around them: `reconfigureSession` takes the runtime identity as a parameter
> (the authority is game-agnostic and cannot derive one from config bytes), and
> the bundled room harness enforces `reconfigurePolicy: 'creator'` as **slot 0**,
> because the room context is not told the platform's `createdBy`.

***

## The shape of the problem

A level editor is not a second game mode bolted onto a running match. It is the
same deterministic session with three extra needs:

1. **Edits must be ordered.** Two people placing a tile in the same cell on the
   same frame must land on one answer, identically, on every client.
2. **Edits must not be predicted.** An editor UI that rolls back a tile you just
   placed is worse than one that takes 80 ms to show it.
3. **Presence must not be simulated.** A cursor position changes 60 times a
   second, matters for a few hundred milliseconds, and must never enter a
   checksum.

Syncplay answers these with four primitives: **commands** (ordered edit ops),
**confirmed-only prediction** (no rollback yank), **session reconfiguration**
(swap the level under a live room on publish), and the **ephemeral channel**
(presence that is deliberately outside the simulation).

## 1. Edits are commands, not inputs

Inputs are per-slot, per-tick, and predicted. Edits are none of those. They ride
the command path instead — the same path the authority already uses to distribute
secret-system results, which means canonicalization, confirmed-frame
distribution, replay, and snapshots need no new machinery.

```ts
runner.submitCommand('editor.placeTile', { x: 12, y: 7, tileId: 3 })
runner.submitCommand('editor.removeTile', { x: 12, y: 7 })
```

The client sends a `command-request`; the authority validates it and queues it
for the next unconfirmed tick; it arrives on every client inside a confirmed
frame and reaches the runtime through the adapter's `decodeCommand` hook.

**Namespacing.** The authority prefixes every client-authored command kind with
`game.`, so `editor.placeTile` arrives as `game.editor.placeTile`. The
`syncplay.*` prefix stays reserved for authority-issued commands and cannot be
forged by a client.

**What the platformer pack accepts.** Exactly two kinds, validated strictly:

| Kind | Payload | Rules |
|---|---|---|
| `game.editor.placeTile` | `{ x, y, tileId }` | integers; `x`/`y` in grid; `tileId` in `[0, 255]` |
| `game.editor.removeTile` | `{ x, y }` | integers; `x`/`y` in grid |

Anything else throws, surfacing as `KINETIX_RUNTIME_COMMAND_INVALID`. Commands
write `state.tileOverrides`; within a frame they apply in confirmed order and the
last write to a cell wins. That is your entire conflict resolution — the authority
already totally-ordered the edits, so "last write wins" is deterministic rather
than racy.

**Rejections are silent by design.** Oversized payloads (>4,096 bytes), rate-limit
overruns (default 60 commands/second/slot), replayed sequence numbers, forged
slots, and stale-generation requests are dropped and counted. `submitCommand`
never throws at the sender — a dropped edit shows up as a `rejectedCommands`
counter on the runner snapshot, not an exception in your click handler. Surface
that counter in your editor UI if you want a "your edit didn't land" affordance.

**Stale-generation drops are a correctness feature.** An edit authored against
level L1 that arrives after the room reconfigured to L2 is dropped, not applied.
Without that check, an in-flight click from the previous level would write a tile
into the new one.

**Offline parity.** In offline mode the runner queues the command directly on the
local session with the same `game.` prefix, applied on the next stepped frame — so
your editor is one code path across offline and networked play.

## 2. Turn prediction off in the editor

```ts
const runner = createSyncplayRunner({ /* … */, predictionMode: 'confirmed-only' })
```

In `confirmed-only`, pump paths apply confirmed frames only: no
`stepPredictedFrame`, no rollback, `rollbackCount` stays 0, and `getRenderState()`
serves the latest confirmed projection. Local input still flows to the authority,
so a player can walk around while editing. The trade is one round-trip of latency
on your own edits, bought in exchange for never showing a tile that then vanishes.

Use `drainConfirmedPresentationFrames()` if you want to render from the confirmed
queue directly rather than from the projection.

Default mode is `'always'` — play sessions are unaffected.

## 3. Publishing swaps the level under the live room

When a creator hits Publish, you do not want everyone to disconnect and rejoin.
`reconfigureSession` swaps the session config in place:

```ts
// 1. fold the accumulated edits back into a publishable level
const edited = applyKinetixPlatformer2dTileOverrides(level, runner.getRenderState())

// 2. publish it as a NEW entry (never ugc.update — see the preset guide)
const entry = await publishPlatformerLevel(RundotGameAPI.ugc, edited, {
  name, authorSlot: runner.localSlot, version: version + 1,
})

// 3. derive the new session config and ask the authority to swap
const setup = createKinetixPlatformer2dSession({
  pack, levelEntryId: entry.id, levelBytes, playerCount, seed,
})
await runner.requestReconfigure(setup.sessionConfigBytes, setup.sessionConfigDigest)
```

What happens: the authority validates that **runtime identity is unchanged**
(a mismatch throws `SYNCPLAY_RECONFIGURE_IDENTITY_MISMATCH` — you may swap the
level, never the reducer), increments a session generation, resets its session
state, and broadcasts a fresh `session-start` carrying the new generation. Each
client sees a generation change, treats it as a full session swap — dispose,
re-run `prepareNetworkRuntime` against the new descriptor, rebuild, resume — and
**never disconnects**. Runner status dips to `syncing` and returns to `live`.

Three things to know:

- **Only the creator can trigger it, if you say so.** `reconfigurePolicy` is
  `'creator' | 'any' | 'none'`, defaulting to `'none'`. The bundled room harness
  supplies the creator's seat, so `'creator'` is enforceable. Unauthorized or
  oversized (>65,536-byte) requests are dropped and counted.
- **Matchmaking still advertises the creation-time digest.** A quick-match joiner
  is matched against the room's original config digest, then greeted with the
  current one. Room-code joins are unaffected. This is expected, not a bug.
- **Reconfigure requires every client to be on a build that understands
  generations.** The `generation` field is omitted when 0 and read as 0 when
  absent, so rooms that never reconfigure stay byte-compatible with older
  clients — but a room that *does* reconfigure needs all peers on a
  generation-aware Syncplay.

Crash-restored rooms re-greet with the **current** config and generation, not the
original one.

## 4. Presence rides the ephemeral channel

Cursors, selection rectangles, and "who is looking at what" are the textbook case
for data that must never touch the simulation.

```ts
runner.sendEphemeral({ cursor: [worldX, worldY] })
runner.onEphemeral((slot, payload) => renderRemoteCursor(slot, payload))
```

The authority relays the payload verbatim to every *other* connected client. The
delivery contract, stated plainly:

- **Best-effort.** Dropped payloads are never retried and never reported.
- **Unordered relative to simulation.** There is no frame association. Do not
  derive gameplay state from it.
- **Absent from replays, checksums, and snapshots** by construction — not by
  convention. A replay of an editing session contains the edits and none of the
  cursors.
- **Bounded.** Payloads over 1,024 bytes are dropped. The relay limit is 20
  msg/s per slot; the client coalesces outbound sends to at most 20 Hz,
  latest-wins per pump, so a 60 Hz mousemove handler is safe to call every frame.
- **Not delivered to the sender.** You already know where your own cursor is.

### Why 20 Hz, and the rate budget

The room server enforces a per-connection WebSocket flood limit (~30 messages per
second) and kicks past it. Ephemeral traffic is the only client-authored stream
that can plausibly saturate it, so the 20 Hz coalescing ceiling is not a stylistic
choice — it is what keeps ~10 msg/s of headroom for input and command traffic on
the same socket. Do not raise it client-side. If a deterministic room genuinely
needs more, the room's `WS_RATE_LIMIT` is the knob, and raising it is a
server-side decision.

This is also why the ephemeral channel is a session message kind on the existing
`'rdm'` channel rather than a new raw WebSocket: one socket, one budget, no second
realtime path to secure and operate.

## 5. Undo/redo from the confirmed input log

You do not need an undo stack. The confirmed command log *is* the edit history,
and it is already ordered, already replicated, and already the thing a replay
records.

Undo is therefore a command like any other — record the inverse of each edit as
you dispatch it, and submit that inverse when the user undoes:

```ts
// placeTile(x, y, newId) inverts to placeTile(x, y, previousIdAtCell)
const inverse = { x, y, tileId: tileIdAt(x, y) }
runner.submitCommand('editor.placeTile', inverse)
```

Because the inverse travels the same ordered path, one person's undo cannot race
another person's edit into an inconsistent state: whichever the authority
confirms second wins, on every client identically. Keep the per-user inverse stack
in presentation state, never in simulation state — it is a UI affordance, not
deterministic data.

***

## Putting it together

| Need | Primitive | Lives in the simulation? |
|---|---|---|
| Place/remove a tile | `submitCommand` → `decodeCommand` | Yes — ordered, replayed, checksummed |
| Show your own edit without a rollback yank | `predictionMode: 'confirmed-only'` | No — presentation policy |
| Publish an edited level to a live room | `publishPlatformerLevel` + `requestReconfigure` | Config swap, not state |
| Show where everyone is pointing | `sendEphemeral` / `onEphemeral` | **No** — excluded by construction |
| Undo | inverse `submitCommand` | Yes — the inverse is an ordinary edit |

See the [UGC Platformer Preset](SYNCPLAY-PLATFORMER.md) for the pack's editor
command schema, the publish-new-entry convention, and the error-code table, and
[Syncplay](SYNCPLAY.md) for the runner surface these methods hang off.
