# Syncplay: deterministic multiplayer (RC1 candidate)

The deterministic core ships inside `@series-inc/rundot-syncplay`; core APIs
live under the `/core` subpaths. Syncplay supplies input authority, prediction,
rollback, replay, late join, secrets, and transport for a signed simulation
product. The core owns the simulation itself: state, RNG streams, mechanics,
fixed ticks, checkpoints, serialization, and checksums.

Mechanics come in two supported shapes. **Installed packs are package code
configured by canonical data** — a module declaration cannot smuggle executable
callbacks; the data selects and parameterizes shipped reducers. **Custom executable
mechanics are source-bound code** — built against `createInstalledRuntimeAdapter`
with the implementation folded into runtime identity at build time. Either way,
games create a Kinetix runtime from the product and the room's canonical session
config, then pass it to the single Syncplay session factory (or let the
[session runner](#session-runner) do it).

Use the [runtime composition cookbook](SYNCPLAY-RUNTIME-COMPOSITIONS.md) to
choose between a preset, a game-owned adapter, and a hand-written runtime, then
copy the identity, checkpoint, projection, command, and deterministic-asset
patterns that apply to your game.

## Input ownership

Sessions, network clients, and runners default to `inputOwnership: 'adopt'`.
Set `inputOwnership: 'copy'` to opt out. Adoption always runs descriptor checks
before input reads. `inputOwnershipAudit: false` cannot disable the audit.
Use the same mode on the room and client. Runtime pins emit adopt by default.

After a hand-off, do not change the input or any child object. Adoption accepts
canonicalizable primitive leaves, dense arrays, and plain `Object.prototype`
objects. NaN, negative zero, infinities, and undefined are valid leaves. It rejects
accessors, symbols, bigint, null-prototype objects, cycles, sparse arrays, extra
array properties, functions, built-ins, class instances, and any own `$rdm` key.
Proxies are excluded by the caller promise.

Invalid inputs throw `SYNCPLAY_INPUT_NOT_OWNABLE`. A change after hand-off throws
`SYNCPLAY_OWNERSHIP_VIOLATION` with the slot, frame, and path. A peer mode mismatch
or an adopt/custom-copy conflict throws `SYNCPLAY_CONFIG_MISMATCH`.

Adopt rooms require the updated SDK admission declaration. Unsupported new
clients get `SYNCPLAY_INPUT_OWNERSHIP_UNSUPPORTED` from the join promise before
transport creation. Readiness does not resolve. Older clients also get the
existing socket refusal. No legacy-client harness is required for this change.

This removes the session `setInput` copy only. Snapshot, restore, runner, and
runtime request copies remain. The authority checks and security model stay
unchanged. See the package input ownership guide for the complete contract.

## What authoritative means here

Authority is positional. It is not a property of an API.

The core runs one loop for each frame. It calls your `step` with that frame's
inputs and commands. It then calls `captureState`. It then hashes the captured
state. That hash is the frame checksum. Each client reports its checksum for
sampled frames, and the authority compares the reports for one frame. Two
reports that differ for the same frame are a desync.

**A value is authoritative if, and only if, your `step` wrote it into the state
that `captureState` returns.** Nothing else makes a value authoritative. No API
is authoritative or cosmetic by itself.

Two rules follow:

- Every deterministic API in this SDK is legal inside `step`. Physics steps,
  raycasts, overlaps, and shape casts are legal there. Their results become
  authoritative because `step` writes them into captured state. Do not build a
  second hit finder for your simulation tick.
- The same API is cosmetic when you call it outside `step`, or when you keep
  its result out of captured state. A cosmetic call cannot desync a room. A
  cosmetic call also cannot decide a hit.

Never read a nondeterministic source inside `step`. Wall-clock time,
`Math.random`, network responses, and ephemeral relay payloads are
nondeterministic. Rendering, interpolation, audio, and effects run outside
`step`. They must never write to authoritative state.

The [runtime composition
cookbook](SYNCPLAY-RUNTIME-COMPOSITIONS.md#2-adapt-immutable-game-state-the-authoritative-path)
shows this capture contract in code. [Syncplay: Physics &
Collision](SYNCPLAY-PHYSICS.md) lists the physics APIs you can call inside
`step`.

## Install and verify

Never install this package unpinned. A bare `npm install` — or an agent
`add_dependency` with no version — resolves the `latest` dist-tag, which trails
the builds these docs describe: an install below 5.26.0 publishes no `/core`,
`/core/runtime` or `/modules/*` subpath at all, so every import here fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

`latest` does not satisfy that floor today. Read the tags first:

```bash
npm view @series-inc/rundot-syncplay dist-tags
```

The rc.72 release workflow sets `rc: 6.0.0-rc.76` after its checks pass.
That version adds the periodic APIs in these docs. Read the current tag before
installation. Install it explicitly and pin the version it resolves to:

```bash
npm install --save-exact @series-inc/rundot-syncplay@rc
```

`--save-exact` writes the resolved version into `package.json` with no range
prefix. Never accept a caret or tilde range here. A range lets a later install
move the build, and the installed version is folded into runtime identity (step
1 below). Read the pinned version back from `package.json` after the install,
and confirm it is **>= 5.26.0**. Expect npm to raise
`@series-inc/rundot-game-sdk` to satisfy the peer range; that bump is correct.
Then verify the subpaths resolve before writing code:

```bash
node --input-type=module -e "
const fs = await import('node:fs');
console.log('syncplay', JSON.parse(fs.readFileSync('node_modules/@series-inc/rundot-syncplay/package.json','utf8')).version);
await import('@series-inc/rundot-syncplay/core/runtime');
await import('@series-inc/rundot-syncplay/creator');
console.log('subpaths resolve OK');
"
```

A subpath that will not resolve is a version problem, never an account,
entitlement, or beta-enablement problem — no Syncplay feature is gated per
creator.

## 1. Bind your runtime source into identity

```typescript
import {
  deriveCustomRuntimeIdentity,
  kinetixRuntimeModuleManifest,
} from '@series-inc/rundot-syncplay/core'
import pkg from '../package.json' with { type: 'json' }

// The pinned dependency string. `--save-exact` makes it the installed version.
const syncplayVersion = pkg.dependencies['@series-inc/rundot-syncplay']

export const runtimeIdentity = deriveCustomRuntimeIdentity({
  tickRate: 30,
  inputSchema: { id: 'my-game-input/v1' },
  stateSchema: { id: 'my-game-state/v1' },
  deterministicVersion: `my-game@1+syncplay${syncplayVersion}`,
  runtimeModules: kinetixRuntimeModuleManifest('src', [
    'sim/runtime.ts',
    'sim/step.ts',
  ]),
  sessionConfigSchema: {
    id: 'my-game-session/v1',
    version: 1,
    maxBytes: 65536,
    fields: { playerCount: { type: 'integer', min: 1, max: 8 } },
  },
})
```

Run this in a checked generator with a fixed module list. Generated identity
files must not appear in their own manifest. Bind the exact installed
`@series-inc/rundot-syncplay` version into `deterministicVersion`, so a
dependency change requires regeneration. Read that version from `package.json`,
as shown above. A hard-coded version literal goes stale without an error. The
version string is folded into `engineIdentityHash`, so the old
generated product cannot retain the same engine hash after a dependency bump.
`tickRate` accepts 10, 20, 30, and 60 only; any other value throws
`KINETIX_CUSTOM_RUNTIME_IDENTITY_INVALID`.
Server-side timing windows are wall-clock, not tick counts. Snapshot cadence holds
60 s and the donor transfer timeout holds 10 s at every accepted tick rate, so a
20 Hz room waits as long as a 60 Hz room rather than three times as long. Setting
`snapshotCadenceTicks` or `transferTimeoutTicks` in the room config still overrides
the derived value. History retention is a separate, tick-counted window and is
unchanged.
Preset games can instead use a Kinetix data pack and its provided runtime
factory.

## 2. Construct the runtime and session

```typescript
import {
  createInstalledRuntimeAdapter,
} from '@series-inc/rundot-syncplay/core/runtime'
import { createSyncplaySession } from '@series-inc/rundot-syncplay/creator'

const runtime = createInstalledRuntimeAdapter({
  identity: runtimeIdentity,
  sessionConfigBytes,
  captureState: () => engine.state,
  restoreState: (state) => { engine.state = structuredClone(state) },
  frameOf: (state) => state.frame,
  step: (inputs) => engine.step(inputs),
  projectState: (state) => state,
})

const session = createSyncplaySession(runtime, {
  playerCount: 4,
  defaultInput: { throttle: 0, steer: 0, brake: false },
  snapshotBufferSize: 256,
  checksumIntervalFrames: 30,
})
```

`createSyncplaySession(runtime, policy)` accepts a constructed Kinetix runtime
only. The policy accepts twelve fields and nothing else: `playerCount`,
`defaultInput`, `snapshotBufferSize`, `checksumIntervalFrames`,
`maxCatchUpFrames`, `requires`, `copyInput`, `canonicalizeInput`,
`canonicalizeCommand`, `onInputFrameRecorded`, `onCommandFrameRecorded`, and
`onChecksumRecorded`. Any other key throws `Unknown Syncplay session field
<name>`. The policy accepts no presentation callback: presentation is a
projection the renderer reads, not a hook the session calls. The policy also
cannot supply initial state, a reducer, a random seed, or a simulation
callback.

Live stepping and rollback use opaque checkpoint handles. Serialization and
hydration happen only for explicit v2 promotion/late-join transfer. A v2 snapshot
contains opaque runtime bytes plus runtime identity, session-config digest,
frame, and checksum; every field is checked before the destination mutates.

## 3. Go multiplayer

```typescript
import {
  createNetworkedSyncplayClient,
  createSyncplayRoom,
  defineSyncplayInputCodec,
  quickMatchSyncplayRoom,
  joinSyncplayRoomByCode,
} from '@series-inc/rundot-syncplay/browser'

const inputCodec = defineSyncplayInputCodec({
  throttle: { kind: 'int', min: 0, max: 100 },
  steer: { kind: 'int', min: -100, max: 100 },
  brake: { kind: 'boolean' },
})

const room = await createSyncplayRoom(multiplayerApi, {
  maxPlayers: 4,
  runtimeIdentity: runtime.identity,
  sessionConfigBytes: runtime.sessionConfigBytes(),
  sessionConfigDigest: runtime.sessionConfigDigest,
})

const client = createNetworkedSyncplayClient({
  transport: room,
  runtimeFactory: (identity, configBytes) => loadSignedRuntime(identity, configBytes),
  localInputForTick: readControls,
  defaultInput: inputCodec.neutralInput,
  encodeInput: inputCodec.encodeInput,
  decodeInput: inputCodec.decodeInput,
})
```

`defaultInput`, `encodeInput`, and `decodeInput` are required, together with
`transport`, `runtimeFactory`, and `localInputForTick`. `decodeInput` must map
the canonical `null` substitute to `defaultInput`, because the authority sends
`null` for a slot with no confirmed input. `defineSyncplayInputCodec` derives
all three from one schema and does that mapping for you. Hand-written codecs
must do it themselves.

Create and quick match carry runtime identity and config. Matchmaking always
isolates engine identity and config digest. Joining by private code accepts no
replacement config: the joiner receives the room-owned bytes, verifies its
catalog-loaded signed product matches, and constructs frame 0 only after that
check. Reconnect and crash recovery repeat the exact bytes.

`createSyncplayRoom()` and `quickMatchSyncplayRoom()` create the room type
`deterministic`. The matching entry in `rundot/rooms.config.json` must use
that type. These helpers add `createOptions.metadata.syncplayRuntime`. A generic
`joinOrCreateRoom()` call does not add this metadata.

## Presentation

Rendering reads a runtime **projection**, not a captured second runtime. A live
`NetworkedSyncplayClient` exposes `getPresentationFrame()`, `renderAlpha`,
`currentFrame`, and `caughtUp`, plus an opt-in bounded confirmed-frame queue
(`confirmedPresentationBufferSize` + `drainConfirmedPresentationFrames()`) and
`beginPresentationCatchUp()` for reconnects. The [session runner](#session-runner)
wraps all of this behind a `presentation` contract. Rendering, interpolation,
audio, and effects never mutate authoritative state, and presentation output is
never fed back into simulation.

## Session config and external deterministic assets

Canonical session config is capped at **65,536 bytes**
(`MAX_KINETIX_SESSION_CONFIG_BYTES`). Content larger than that — a UGC level —
rides its own storage: stored UGC `data` is capped at **100 KiB** by default (a
per-app configurable cap), and a session carries
`levelEntryId + levelDigest + levelByteLength`. Joiners fetch by **entry id** (no
digest lookup endpoint), re-encode the stored content canonically, and verify
digest and length with `verifyKinetixAuxiliaryAsset` before frame 0.

Referenced entries are **never updated in place** — a `ugc.update` under a live
session pin makes the room permanently unjoinable. Publish every edit as a new
entry and resolve and verify the immutable pin before frame 0.

## Session runner

`createSyncplayRunner` owns the `offline | connecting | syncing | live | stopped |
error` status, offline bot filling, network pacing, cancellable UGC asset
preflight (`prepareNetworkRuntime` / `prepareNetworkedSyncplayTransport`), and
presentation/event delivery behind one runtime factory.

### Config surface

`SyncplayRunnerConfig` — everything the runner accepts, nothing else:

| Field | Required | Meaning |
|---|---|---|
| `runtimeFactory` | yes | `(identity, sessionConfigBytes) => KinetixRuntime`. The one place a runtime is constructed, offline and networked alike. |
| `defaultInput` | yes | The neutral input. Fills bot slots and is the reset value for local input. |
| `encodeInput` / `decodeInput` | yes | Wire codec. Derive it with `defineSyncplayInputCodec` rather than hand-writing it. |
| `presentation` | yes | `{ project(projection, { localSlot, status }), interpolate?(previous, current, alpha), events?(projection) }`. Presentation-only; never feeds simulation. |
| `prepareNetworkRuntime` | no | `(descriptor, signal) => Promise<void>` — async asset preflight run **before** the client is constructed. The transport buffers ordered `session-start`/history traffic while it awaits. Aborted on `stop()` and on a superseded connection. |
| `maxPredictionTicks` | no | Rollback/latency budget passed through to the networked client. Not a player-count limit. |
| `maxOfflineStepsPerUpdate` | no | Default **8**. Caps catch-up stepping in one `update(deltaMs)` so a backgrounded tab cannot spiral. |
| `predictionMode` | no | `'always'` (default) or `'confirmed-only'`. In confirmed-only the runner applies confirmed frames only — no prediction, no rollback — while local input still flows to the authority. Use it for editing surfaces, where a rollback yank on a placed tile is worse than a frame of latency. |
| `remoteInputPrediction` | no | `repeat-last` (default) repeats each remote slot's last confirmed input and is appropriate for held movement controls. Use `neutral` for pulse/edge command codecs so a confirmed one-shot is not repeated into speculative frames. |
| `localInputForTick` | no | `(slot, frame) => Input` — per-tick local input provider for incremental adoption (a game whose input is a per-tick pulse supplies its own reader instead of the persistent `applyInput` value). Called once for each local tick: offline when the tick is stepped, networked when the client sends that tick's input (also while it catches up and predicts no frame, see [Input during catch-up](#input-during-catch-up)); when omitted the runner uses the last `applyInput(...)` value verbatim. |
| `pacing` | no | Wall-clock pacing + clock-drift correction for the networked client, forwarded verbatim. Omit for the client defaults. |
| `inputDelay` | no | Local input delay for the networked client; `maxTicks > minTicks` auto-tunes from measured RTT. Forwarded verbatim; omit for the client default (0). |
| `requires` | no | `{ commands?, projection? }` — the runtime capabilities this game needs, forwarded to the offline session and to the networked client. `projection: true` on a runtime with no `project` throws `SYNCPLAY_PROJECTION_UNSUPPORTED`; `commands: true` on a runtime built without `decodeCommand` throws `SYNCPLAY_RUNTIME_COMMANDS_UNSUPPORTED`. Both checks run at session construction, not at the first command. |
| `diagnostics` | no | Sink for host notices, currently the deprecation notice each compatibility method emits. One notice per key per runner. Omit it to print the notice with `console.warn`. Pass `null` to disable notices. A sink failure cannot fail the session. |
| `maxConfirmedFramesPerTurn` | no | Networked only, opt-in. The most authority-confirmed frames the client applies in one turn. A turn starts at each `update()` (each `pump`/`pumpPaced` call on a bare client) and lasts until the next one, so the messages between two updates share the budget. Frames past the budget stay queued in order and the next turn applies them first. A turn also runs at most one rollback, so it steps at most the budget plus one rollback resimulation (`maxPredictionTicks`) plus `pacing.maxStepsPerPump`. Absent (the default), every confirmed frame is applied in the message handler that delivers it. The confirmed state of every tick, every checksum, and every checksum report stay the same; only the turn changes. While frames are queued, `appliedThrough` counts applied frames only, so `caughtUp` stays false (and the status stays `syncing`) while more than `hardToleranceTicks` frames wait; checksum reports and hydration waiters run when their tick is applied; a hydration barrier for a queued tick waits for it instead of failing with `client.hydration-history-gap`; own input keeps flowing at the authority frontier. Queued frames hold no extra saves: with `snapshotRetention: 'required'` the client keeps the whole window only while it is behind at its confirmed frontier (applied plus queued frames), for example while the history of a reconnect still arrives. `netStats.queuedConfirmedFrames` shows the queue. The game must keep calling `update()`, and the budget times the update rate must be larger than the tick rate, or the client never catches up. It is not `maxCatchUpFrames`, which limits offline `update(deltaMs)` and throws. |
| `snapshotRetention` | no | Default: `'required'`, offline and networked (the networked client has the same default). `'required'` keeps only the saves the runner can still read: offline, the current frame; networked, the frames from the last confirmed frame forward plus one frame per checksum-report tick, and the whole window while the client catches up or waits for hydration. With `maxConfirmedFramesPerTurn`, frames that wait in its queue are not a catch-up. Simulation results do not change. In Wreck Yard it cuts the retained saves from 256 to 1 offline and to 11 per client networked. A networked read of a released older frame (`getConfirmedStateChecksum(frame)` for a frame that is not a report frame) fails with `client.checksum-unavailable`, as for a frame outside the window. Frame `appliedThrough` is such a frame. Read `appliedThrough + 1` (the state after the last confirmed tick) or the frame after a checksum-cadence tick (`tick % checksumCadenceTicks === 0`, frame `tick + 1`); every client keeps those. `'window'` keeps a runtime save for every frame of the `snapshotBufferSize` window (256 by default); set it only if the game reads old confirmed frames. |

Offline start options (`SyncplayRunnerOfflineOptions`): `identity`,
`sessionConfigBytes`, `playerCount`, `localSlot?`, `localSlots?`,
`botInputForTick?(slot, frame)`.

`localSlots` is shared-screen co-op: every listed slot is driven locally, and
`applyInput(input, slot)` targets one of them (`localSlot` is sugar for a single
entry). This is **offline only** — one connection is one seat is a room-server
seating invariant, so networked play stays single-seat.

### Snapshot

`subscribe(listener)` publishes a frozen `SyncplayRunnerSnapshot` on every status
or presentation change:

| Field | Meaning |
|---|---|
| `status` | `offline \| connecting \| syncing \| live \| stopped \| error` |
| `lifecycle` | A second vocabulary, and not a rename of `status`: `{ state: 'idle' \| 'starting' \| 'running' \| 'stopped' \| 'failed' \| 'disposed' }`. `starting` and `running` also carry `mode`; `running` carries `localSlots`, and a networked `running` also carries `connection`; `failed` carries `error`. `start()` succeeds only from `idle`, `stopped`, or `failed`, and from any other state throws a `SyncplayError` with code `runner.start-state-invalid`. `dispose()` moves to `disposed`, which is terminal. |
| `renderState?` | Present once a frame has been projected |
| `renderAlpha` | Interpolation alpha within the current frame |
| `localSlot` | `-1` until the client is ready |
| `rollbackCount` | Cumulative client rollbacks; `0` in offline mode and in `confirmed-only` |
| `ready` | False until a session/client exists. Offline: true once a session exists and the frame counters track the local session |
| `appliedThrough` | Last authority-confirmed frame; `-1` before any session/client |
| `predictedThrough` | Last locally predicted frame; `0` before any session/client |
| `error?` | Present only when `status === 'error'` |
| `connection` | `'connected'` or `'reconnecting'` — the transport's phase |
| `roomCode?` | Present when the transport carries one |
| `occupancy?` | `{ occupied, maxPlayers, full, locked }` when the transport reports it |
| `presence?` | The client's confirmed per-slot presence |
| `netStats?` | Client net stats, including `droppedConfirmedPresentationFrames` and `rejectedCommands` |

`update(deltaMs)` throws `SYNCPLAY_RUNNER_DELTA_INVALID` on a negative or
non-finite delta; `getRenderState()` before the first projection throws
`SYNCPLAY_RUNNER_NO_RENDER_STATE`; a malformed `maxOfflineStepsPerUpdate` throws
`SYNCPLAY_RUNNER_CONFIG_INVALID` at construction, and malformed offline options
throw `SYNCPLAY_RUNNER_OFFLINE_OPTIONS_INVALID`.

### Reconnect contract

**The transport owns reconnection — the runner adds no re-dial machinery.**
Re-invoking an opaque connect factory risks a fresh join instead of reclaiming
the seat, so the runner deliberately does not do it.

| Transport event | Runner behaviour |
|---|---|
| `'reconnecting'` | **Non-terminal.** Status drops to `syncing`, `beginPresentationCatchUp()` is called so replayed history is silent, and the runner returns to `live` once the client is caught up *and* has advanced past the pre-recovery frame. |
| `'disconnected'` | **Terminal.** Teardown, `status: 'error'` carrying `SYNCPLAY_TRANSPORT_DISCONNECTED`. |
| `'error'` | **Terminal.** Teardown, `status: 'error'` carrying the transport's message. |

Because a hard disconnect is terminal, **your game should offer an explicit
re-join action** on terminal `error` — call
`await runner.start({ mode: 'networked', connect })` again with a fresh connect
factory. Starting any mode always tears down the previous one, and a stale
async connection or preparation closes without replacing the current session.
`startNetworked` and `startOffline` are deprecated compatibility methods; they
remain until major version 6 and cannot cancel startup.

See also the
[Syncplay runner README](https://www.npmjs.com/package/@series-inc/rundot-syncplay).

## Collaborative editing

Ordered edit commands, confirmed-only prediction, live session reconfiguration,
and an ephemeral presence channel compose into a shared editor on the same
deterministic session — no second realtime path. See
[Syncplay: Collaborative Editing](SYNCPLAY-EDITOR.md).

## Browser room intent and sharing

`resolveSyncplayBrowserIntent`, `openSyncplayBrowserRoom`, and `shareSyncplayRoom`
compose RUN launch-intent, the anonymous sign-in gate, and share links over the
existing room APIs. They expose state and actions only — no badge, modal, or
sign-in UI.

## Correctness tests

`@series-inc/rundot-syncplay/testing` exposes exactly nine supported
entry points — `assertDeterministic`, `assertReplayVerifies`,
`assertTwoClientConvergence`, `assertLateJoinHydration`,
`createSimulatedSyncplayMatch`, `runSyncplaySynctest`,
`createSyncplayRunnerHarness`, `assertRunnerLifecycle`, and
`assertPresentationParity`. The network assertions run the real authority room
and networked client; browser/runtime APIs do not leak through the subpath.

The last three cover the seam games actually ship on — the runner, rather than
the client underneath it:

| Entry point | What it proves |
|---|---|
| `createSyncplayRunnerHarness` | Drives a real runner against the simulated match on a fully controlled clock, and records every status transition. Nothing advances outside `advance()`. |
| `assertRunnerLifecycle` | offline → networked → offline → stop, asserting the status sequence at each step. |
| `assertPresentationParity` | The same inputs produce the same confirmed presentation offline and networked. This catches projections that are deterministically **wrong but checksum-consistent** — a class of bug convergence tests cannot see, because the state agrees and only the projection differs. |

`createSimulatedSyncplayMatch` also wires `playerId`, `sendSecret` and
`onSecretMessage`, so secret systems are testable, and `openTransport(playerId)`
returns a raw transport when you want a real runner to own the seat.

## Capacity and late-join budgets

Snapshot transfer defaults are **256 KiB** chunks and a **4 MiB** total ceiling;
the immutable level payload is fetched and verified separately, never inside a
snapshot. 128 slots is the tested protocol/load ceiling, not a 60 Hz performance
guarantee for an arbitrary game; `maxPredictionTicks` is a rollback/latency
budget, not a player-count limit.

## Late input

The authority confirms one input frame for each tick, in order. It confirms
tick T when every occupied seat sent its input for T, or when
`hardToleranceTicks` authority ticks passed after T (room config; default 6).
An input that arrives before T is confirmed counts, also when it is late. An
input for a tick that is already confirmed is dropped.

When the deadline passes without an input, the authority puts a substitute in
the confirmed frame:

| Seat | Substitute |
|---|---|
| Human seat with a confirmed input | That seat's last confirmed input (`repeat-last`) |
| Human seat with no confirmed input yet | Canonical `null` (`decodeInput` maps it to `defaultInput`) |
| Seat whose player disconnected or left | Canonical `null` from the disconnect on |
| Bot-filled or empty seat | Canonical `null` |

This policy belongs to the authority, and a room config cannot change it.
`remoteInputPrediction` is only the client's guess for a remote seat before
the confirmation arrives. It does not change what the authority confirms. The
confirmed frame lists each substituted seat in `substitutedSlots`, the step
context marks it (`context.seats[slot].substituted`), and
`netStats.ownInputSubstitutions` counts this client's substituted ticks.

**What `hardToleranceTicks` costs.** Every missing input holds the
confirmations of every client until the input arrives or the deadline passes.
A disconnected seat does the same: during an outage, every other client's
confirmed frame stops for up to `hardToleranceTicks`. A small value (the
default 6) substitutes soon and keeps confirmations current. A large value
accepts later input, for example from a CPU-starved browser, but a real outage
freezes the confirmations for longer. The beat-em-up example uses 180 (3 s at
60 Hz) so that a starved CI browser still confirms real input.

**The client sends every unconfirmed tick.** A client that is starved, or
that comes back from a freeze or a reconnect, samples and sends its input for
every tick after its confirmed frontier, late if necessary. It skips only the
ticks that it holds as confirmed. Through 6.0.0-rc.63, a client that caught
up after a join or a reconnect, or (from 6.0.0-rc.57) that was more than
`hardToleranceTicks` behind, moved its input cursor to the authority tick and
never sent the ticks between. The authority
then substituted them only at the deadline. With a large tolerance, both
clients' confirmations stayed a full tolerance behind the authority, and the
player's last input repeated. After a stall, one turn can send up to
`hardToleranceTicks + inputDelay` inputs. Keep `hardToleranceTicks` below the
room's per-connection message budget (mp-room-server:
`max(WS_RATE_LIMIT, 4 × tickRateHz + 30)` messages per second, 270 at 60 Hz).

**Make a substituted movement input neutral.** A repeated held direction
moves a fighter that nobody controls. A game that wants a substituted seat to
stand still reads the seat context in its deterministic step. Every client
gets the same flag from the confirmed frame, so the result stays
deterministic:

```ts
step(inputs, commands, context) {
  for (let slot = 0; slot < inputs.length; slot += 1) {
    const substituted = context?.seats[slot]?.substituted === true;
    // Hold no direction and press no button for a seat whose input is a substitute.
    const input = substituted ? NEUTRAL_INPUT : inputs[slot];
    applyPlayerInput(slot, input);
  }
}
```

Use `remoteInputPrediction: 'neutral'` for a pulse or edge command codec, so
that a confirmed one-shot is not repeated into predicted frames.

## Mobile settings

Use these values for a networked game with large saves on a phone, for example
a four-player game like Wreck Yard. Set them on `SyncplayRunnerConfig` (or on
the networked client options). Every client of one game must use the same
`checksumCadenceTicks`.

```ts
const mobileSettings = {
  // snapshotRetention: 'required' is the default.
  snapshotBufferSize: 128,
  checksumCadenceTicks: 60,
  maxPredictionTicks: 8,
  maxInputRetentionFrames: 128, // only if the game does not call exportReplay()
  maxConfirmedFramesPerTurn: 8,
  pacing: { maxStepsPerPump: 2 },
  inputDelay: { minTicks: 1, maxTicks: 3 },
};
```

Measured with the real Wreck Yard sim: 4 networked clients in one Node
process, 30 Hz, about 1,860 ticks, one client stalled for 300 ticks twice.

| Option | Mobile | SDK default | Measured effect |
|---|---|---|---|
| `snapshotRetention` | `'required'` | `'required'` (6.0.0-rc.62; `'window'` before) | Saves held per live client: 256 → 11. Spilled physics bytes per client: 127.2 MiB → 0. JS heap peak for 4 clients: 528.1 MiB (`'window'`) → 169.2 MiB. |
| `snapshotBufferSize` | 128 | 256 | A client that catches up after a reconnect keeps the whole window. Saves held at that peak: 257 → 129. Array-buffer peak after the catch-up: +128 MiB → +68 MiB. With `maxConfirmedFramesPerTurn: 8` the client does not keep the window while it drains the queue (peak 12 saves). |
| `checksumCadenceTicks` | 60 | 120 | Keeps the 128-frame window large enough for snapshot donation: the donated tick can lag the donor by one cadence plus the slowest round trip. With 60, about 58 ticks (1.9 s) of round trip stay inside the window. Live saves stay at 11. |
| `maxInputRetentionFrames` | 128 | unset (keeps every frame) | Heap growth per client: 2.5 → 1.0 KiB per tick. That removes about 1.4 KiB per tick, or 76 MiB per client in a 30-minute match. `exportReplay()` then throws, so use it only if the game exports no replay. |
| `maxConfirmedFramesPerTurn` | 8 | unset (no limit) | Worst turn after a 300-tick stall: frozen app 2.03 s → 0.30 s, dropped socket 1.83 s → 0.12 s. At most 16 frames stepped per turn, against 299–319. Catch-up takes 42–44 turns (1.4 s at 30 updates per second). With 16: worst turn 0.24 s and 0.18 s, 20–21 turns. Queued frames hold no extra saves: the peak during the catch-up is 10 saves (frozen app) and 12 (dropped socket), against 129 in 6.0.0-rc.62, and nothing spills. |
| `maxPredictionTicks` | 8 | 8 | Bounds rollback. During recovery, one confirmed message steps at most 7 frames. |
| `pacing.maxStepsPerPump` | 2 | 4 | Predicted frames per `pumpPaced` call: 4 → 2. The worst pump fell from 27 ms to 12 ms. |
| `inputDelay` | 1 to 3 ticks | adapts from 0 | Wreck Yard's current value. It has no memory or recovery effect. |

Recovery after a 300-tick stall (10 s), one update per tick:

| Stall | `maxConfirmedFramesPerTurn` | Frames to catch up | Turns | Frames in the worst turn | Worst turn (desktop) |
|---|---|---:|---:|---:|---:|
| Frozen app: every message arrives late, in one burst | unset | 319 | 1 | 319 | 2.03 s |
| Frozen app | 8 | 344 | 42 | 15 | 0.30 s |
| Frozen app | 16 | 323 | 20 | 23 | 0.24 s |
| Dropped socket: the room sends the missed history on reconnect | unset | 300 | 3 | 299 | 1.83 s |
| Dropped socket | 8 | 340 | 44 | 16 | 0.12 s |
| Dropped socket | 16 | 316 | 21 | 32 | 0.18 s |

Mean step time was 4.7–6.6 ms on a shared desktop. A phone is slower, so use
the frame counts as the budget and the times as a scale. Without the budget the
client steps the whole backlog when the message arrives: expect a pause of
about the stall length times the step time. With 8 the worst turn is at most 8
confirmed frames, one rollback, and 2 predicted frames; the backlog clears in
about 300 / 7 turns at 30 updates per second, faster at 60. The runner reports
`syncing` until the client is caught up, so show a short "catching up" state.

`tests/mobile-settings-recovery.test.ts` and
`tests/confirmed-frame-budget.test.ts` pin these bounds by count: saves held,
confirmed and stepped frames per turn, turns to catch up, and the same
checksum for every confirmed tick with and without the budget.

For costly stack collapses, a smaller confirmed-frame budget can reduce each
pause. Wreck Yard uses `maxConfirmedFramesPerTurn: 2` with
`pacing.maxStepsPerPump: 2`. This is a frame-count limit. A single physics
step can still take substantial time. Keep calling `update()` while frames
wait in the queue. The processing rate must exceed the incoming tick rate
for the queue to clear. See [Input during catch-up](#input-during-catch-up).

### Input during catch-up

A client that is connected and ready but behind is still a player. The runner
then reports `status: 'syncing'`, `ready: true`, and `connection: 'connected'`
(also on the networked `lifecycle`). `netStats.recoveryPhase` is
`'catching-up'`. This state alone shows no disconnect and no loss of SDK
input. Keep the play controls active and keep sampling input in this state.

The SDK states:

| Snapshot | Meaning | Show |
|---|---|---|
| `status: 'connecting'`, or `ready: false` | No session yet | Connecting |
| `status: 'syncing'`, `ready: true`, `connection: 'connected'` | Connected; confirmed frames wait or arrive late | A small catching-up indicator. Keep the controls. |
| `status: 'syncing'`, `connection: 'reconnecting'` | The transport retries the connection | Reconnecting |
| `status: 'error'` | A terminal failure of any cause. `error.message` holds the code, for example `SYNCPLAY_TRANSPORT_DISCONNECTED` for a hard disconnect | Error and a re-join action |
| `status: 'live'` | Caught up | Play |

Do not map every `syncing` to an app "connecting" state. `syncing` alone
shows neither a disconnect nor a loss of SDK input. `connection:
'reconnecting'` shows that the transport retries. `status: 'error'` is a
terminal failure; read the error code to find the cause.

```typescript
import type { SyncplayRunnerSnapshot } from '@series-inc/rundot-syncplay'

type MatchUiState = 'offline' | 'connecting' | 'catching-up' | 'reconnecting' | 'live' | 'stopped' | 'error'

function matchUiState(snapshot: SyncplayRunnerSnapshot<unknown>): MatchUiState {
  switch (snapshot.status) {
    case 'offline':
    case 'connecting':
    case 'live':
    case 'stopped':
    case 'error':
      return snapshot.status
    case 'syncing':
      if (snapshot.connection === 'reconnecting') return 'reconnecting'
      // Only a connected, ready client is in an operational catch-up.
      return snapshot.ready && snapshot.connection === 'connected' ? 'catching-up' : 'connecting'
  }
}

/** Play controls stay mounted and keep held input only when this is true. */
function controlsActive(snapshot: SyncplayRunnerSnapshot<unknown>): boolean {
  if (!snapshot.ready) return false
  const state = matchUiState(snapshot)
  return state === 'live' || state === 'catching-up' || state === 'offline'
}
```

**Held input.** Keep a held control until the player releases it
(`pointerup`, `pointercancel`, `lostpointercapture`, or window `blur`), or
until `controlsActive` is false. Do not unmount a control that holds a
pointer. An unmount loses the pointer capture and clears the held input.

**What the client sends while it catches up.** Each `update()` runs one
`pumpPaced` turn on the client:

1. It applies queued confirmed frames, at most `maxConfirmedFramesPerTurn`.
2. It samples and sends this client's input for each unsent tick through
   `max(predictedThrough, appliedThrough + 1, authorityFrontierTick + 1) +
   inputDelay`. The runner calls `localInputForTick(slot, tick)`, or uses the
   last `applyInput` value, once for each of these ticks.
3. When `appliedThrough` is more than `hardToleranceTicks` behind the
   authority tick, it predicts no frame. Step 2 still runs.

Thus a held control reaches the authority at its frontier while the local
confirmed state is far behind. The client skips only ticks that it holds as
confirmed. The SDK samples each tick once and does not change a sent tick.
The SDK cannot keep a held input after the app clears it: it sends the value
that the app gives. During a reconnect catch-up, the client resends its
unconfirmed inputs first. Step 2 waits until a newer confirmation ends that
catch-up.
`netStats.ownInputSubstitutions` counts this client's ticks that the
authority replaced. It does not tell the cause.

**Rate.** `maxConfirmedFramesPerTurn` limits the number of confirmed frames
in one turn. It does not limit the CPU time of a turn, and it gives no
extra CPU. With budget N and U updates per second, the confirmed rate R is at
most N × U. R equals N × U only when every turn uses the whole budget. U
is also at most the display rate. At 60 Hz with N = 2, R is at most 120
frames per second.

- The backlog shrinks only when R is larger than the tick rate (30 for a
  30 Hz game).
- With a constant R, a full budget in each turn, and no new stall, a backlog
  of B ticks clears in B / (R − tick rate) seconds. This is the ideal. Other
  costs make it longer.
- The mean turn time sets U: N physics steps, rendering, and host overhead.
  A p95 step time alone cannot show that a client catches up.
- Example: with a mean step of 25 ms on one thread, the client steps at most
  40 ticks per second before any other cost. That is at most 10 ticks per
  second more than a 30 Hz tick rate. A 72-tick backlog then needs at least
  7.2 s. This is a lower limit, not a guarantee. A 25 ms p95 step does not
  promise recovery in 5 s.
- Pose interpolation between frames does not step the simulation faster.
- Measure the update rate and the recovery time on the target device.

`tests/connected-catchup-input.test.ts` pins this contract with a real
runner, client, and authority room at `maxConfirmedFramesPerTurn: 2`, once
with a small installed runtime and once with a real WASM physics world: in
each catch-up turn the input callback runs, the held value and its release go
to the authority frontier as real input, no turn applies more than two
confirmed frames, and the runner returns to `live` when updates come at the
tick rate. It also checks `controlsActive` on the runner's own snapshots:
false before the session is ready and after `dispose()`, true in the
catch-up.

**Wreck Yard.** The SDK sends input correctly in this state. The game must
change its UI integration; it needs no new SDK API. The game maps every SDK
`syncing` to its `connecting` state (`src/game/match.ts`), and it mounts
touch controls only in `live` (`src/ui/TouchControls.tsx`). A catch-up
therefore unmounts the controls and clears a held Cut. Use `matchUiState`
and `controlsActive` above instead.

## Solo to co-op

A solo player can start alone and invite a friend. The promotion path moves a world
between sessions:

```typescript
import {
  createSessionFromPromotionSnapshot,
  exportPromotionSnapshot,
} from '@series-inc/rundot-syncplay'

// Export the live world from the solo session.
const blob = exportPromotionSnapshot(soloSession, {
  encodeInput: codec.encodeInput,
})

// Rebuild it as a local session.
const session = createSessionFromPromotionSnapshot({
  runtimeFactory,
  sessionConfigBytes,
  policy,
  decodeInput: codec.decodeInput,
}, blob)
```

`encodeInput` is required and must be the **wire** codec. A snapshot's
`confirmedInputs` are decoded by the receiving client as wire values
(`networked-client.ts`, `decodeInputSafe`), so a game-shaped payload silently
corrupts every carried input whenever a codec's two shapes differ. This is the
counterpart of the `decodeInput` you already pass when reconstructing.

**This builds a local session, not a room membership.** A networked client builds its
own session from the authority's session-start message, so joining a room does not go
through `createSessionFromPromotionSnapshot`.

**Capacity.** Size the session for the co-op player count from the start. A session
cannot widen its `playerCount` later, and the count must match the room's.

**What is not verified.** A session built from a promotion snapshot began outside the
room, so the platform cannot verify it. Such a session cannot export a replay, which
keeps it off replay-gated leaderboards and out of verified settlement. This follows
from the platform's live model: the authority orders and confirms inputs and runs
**no simulation**, so there is no server-side world to compare against.

## Replays and late join

```typescript
import { verifyReplay } from '@series-inc/rundot-syncplay/creator'

const result = verifyReplay({
  replay,
  runtimeFactory: (identity, configBytes) => loadSignedRuntime(identity, configBytes),
  policy,
})
```

Replay v2 records runtime identity, canonical session-config bytes/digest,
inputs, authority commands, and checksums. Reducer replay v1 and snapshot v1 are
rejected; there is no migration decoder.

## Determinism and trust

- Only identity-bound game runtimes or Kinetix preset mechanics execute authoritative gameplay.
- Runtime identity is compiler-derived and signed with the product.
- The authority orders inputs but does not invent runtime identity or config.
- A bogus room cannot recruit an honest client whose loaded signed pack differs.
- Optional hidden choices, random draws, decks, bags, and roles use
  [Syncplay Secret Systems](SYNCPLAY-SECRETS.md).

The Kinetix world runtime is a correctness/reference backend with deep-copy
checkpoints. The shared batched ABI is the insertion point for optimized JS,
WASM, or native backends without changing Syncplay.

## Where to go next <a id="4-built-in-systems-all-deterministic"></a>

| Your question | Page |
|---|---|
| Can I run physics or raycasts on my simulation tick? | Yes, when you call them inside `step`. Read [What authoritative means here](#what-authoritative-means-here) first, then [Syncplay: Physics & Collision](SYNCPLAY-PHYSICS.md). |
| How do I build my own runtime, projection, checkpoint codec, or command decoder? | [Runtime Composition Cookbook](SYNCPLAY-RUNTIME-COMPOSITIONS.md) |
| My game is 2D. Which physics do I use? | [Syncplay: 2D Physics](SYNCPLAY-PHYSICS-2D.md) |
| How do I migrate a game that uses beta fluid physics? | [Syncplay: RC1 migration](SYNCPLAY-RC1-MIGRATION.md#fluid-and-force-migration) |
| How do I move a character deterministically? | [Syncplay: Character Movement](SYNCPLAY-MOVEMENT.md) |
| How do I drive animation from simulation state? | [Syncplay: Animation](SYNCPLAY-ANIMATION.md) |
| How do I find a path across the map? | [Syncplay: Pathfinding](SYNCPLAY-PATHFINDING.md) |
| How do I resolve melee attacks and damage? | [Syncplay: Combat Modules](SYNCPLAY-COMBAT.md) |
| How do I fire a weapon? | [Syncplay: Firearm Module](SYNCPLAY-FIREARM.md) |
| How do I apply a buff, a debuff, or damage over time? | [Syncplay: Gameplay Effects](SYNCPLAY-GAMEPLAY-EFFECTS.md) |
| How do I model health, resources, cooldowns, and abilities? | [Syncplay: Stats and Abilities](SYNCPLAY-STATS-ABILITIES.md) |
| How do I carry and equip items? | [Syncplay: Inventory and Equipment](SYNCPLAY-INVENTORY-EQUIPMENT.md) |
| How do I pick up, open, or use a world object? | [Syncplay: Spatial Interaction](SYNCPLAY-SPATIAL-INTERACTION.md) |
| I am building a 2D platformer. | [Syncplay: 2D Platformer Module](SYNCPLAY-PLATFORMER-2D.md) |
| I am building an RTS. | [Syncplay: RTS Module](SYNCPLAY-RTS.md) |
| How do I select units and issue orders? | [Syncplay: Unit Control Module](SYNCPLAY-UNIT-CONTROL.md) |
| How do I give entities stable ids across peers? | [Syncplay: Entity Registry](SYNCPLAY-ENTITY-REGISTRY.md) |
| What are the shipped component modules? | [Syncplay: Component Modules](SYNCPLAY-COMPONENTS.md) |
| Is a module certified for production? | [Syncplay: Module Certification](SYNCPLAY-MODULE-CERTIFICATION.md) |
| How do I run NPC behavior in the simulation? | [Syncplay: Actors and AI](SYNCPLAY-ACTORS-AI.md) |
| How do I use a 3D character rig? | [Syncplay: 3D Character Modules](SYNCPLAY-CHARACTER-3D.md) |
| How do I fill empty slots with bots? | [Syncplay: Bots & AI](SYNCPLAY-BOTS.md) |
| How do I hide a card, a role, or a random draw from a peer? | [Syncplay: Secret Systems](SYNCPLAY-SECRETS.md) |
| How do several people edit one world together? | [Syncplay: Collaborative Editing](SYNCPLAY-EDITOR.md) |
| A fast-moving target is hard to hit. What do I do? | [Syncplay: Lag Compensation](SYNCPLAY-LAG-COMPENSATION.md) |
| I upgraded the package and something broke. | [Syncplay: RC1 migration](SYNCPLAY-RC1-MIGRATION.md) |

## Canonical serialization and parsing

Syncplay provides `canonicalStringify` and `canonicalParse` for deterministic JSON serialization:

- `canonicalStringify(value)`: Serializes an arbitrary JavaScript object or value into a canonical,
  reproducible JSON string with deterministically sorted keys. Special JavaScript values that standard
  JSON cannot express (such as `-0`, `NaN`, `Infinity`, `-Infinity`, `BigInt`, `Map`, `Set`, and typed arrays)
  are encoded using sentinel objects (e.g. `{"$rdm":"negative-zero"}`, `{"$rdm":"bigint","value":"123"}`).
- `canonicalParse<T>(text)`: Decodes a canonical JSON string back into JavaScript values, restoring all
  sentinel tags into their true primitive or object forms (including `-0` and `BigInt`).
- **Important**: Decoding a canonical string with standard `JSON.parse` leaves sentinel objects unexpanded
  (e.g., yielding `{ $rdm: "negative-zero" }` instead of `-0`). Always use `canonicalParse` or
  pass standard parsed JSON through `decodeCanonicalValue(parsed)` to recover true values.


## Dynamic seat control and slot allocation

Configure dynamic slot control with `deterministic.seatPolicy`. When omitted, rooms use fixed seats.

### Policy configuration

The `seatPolicy` object contains these properties:

- `recycleVacatedSeats`: Boolean. Set to true to permit new players to claim vacated slots. Default is false.
- `allowHumanClaimBot`: Boolean. Set to true to permit new human players to claim slots occupied by bots (S3 transition). Retained claim owners can always reclaim their own seats without this flag. Default is false.
- `onHumanLeave`: String. Must be `'empty'` or `'bot'`. Controls the slot state when a human player leaves. Default is `'empty'`.
- `initialBotSlots`: Array of slot numbers. Specifies slots controlled by bots at match start. Default is `[]`.

### Seat transitions

The authority executes six transitions:

1. `S1_empty_to_bot`: An empty slot transitions to bot control.
2. `S2_empty_to_human`: An empty slot transitions to human control.
3. `S3_bot_to_human`: A bot slot transitions to human control.
4. `S4_bot_to_empty`: A bot slot transitions to empty state.
5. `S5_human_to_bot`: A human slot transitions to bot control.
6. `S6_human_to_empty`: A human slot transitions to empty state.

### Controller leases and secret lifetime

- Each controller holds a unique control lease.
- Human clients receive `claimId` and `controlEpoch` in the greeting message.
- Bot controllers receive a `BotLease` with `leaseId` and `controlEpoch`.
- When a human leaves a recyclable seat, the authority revokes the secret tokens of that player.
- A new player who claims a vacated seat does not receive the secrets or the roles of the previous player.
