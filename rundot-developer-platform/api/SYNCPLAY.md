# Syncplay: Deterministic Multiplayer API (BETA)

Real-time multiplayer for fast, twitchy games — fighters, sports, `.io` games,
top-down shooters, racers — where **every player sees the same world updating 30
times a second** and no one waits on the server.

Syncplay uses **deterministic lockstep with rollback** (a proven, widely-used
networking model). You write your game as a **pure, deterministic simulation** that
steps forward one fixed tick at a time. The engine runs that same simulation on
every player's device, sends **only inputs** across the network, predicts ahead
so play feels instant, and quietly rolls back and re-simulates when a remote
input arrives that differs from what it guessed. **You never write server code** —
the multiplayer server is a generic input relay shared by every Syncplay game.

{% hint style="warning" %}
**BETA.** Build and iterate against the offline, local-network, or
hosted-playground paths. Syncplay has not gone live; package publication,
production rollout/proof, and 1.0 graduation remain separate release decisions.
{% endhint %}

***

## Is Syncplay the right tool?

RUN has **two** multiplayer models. Pick by what your game needs.

| | [Multiplayer API](MULTIPLAYER.md) (`GameRoom`) | **Syncplay** |
|---|---|---|
| Server logic | You write a `GameRoom` class — the server is authoritative | **None** — you write only a client-side simulation |
| What crosses the wire | Your typed messages + server state | Inputs, confirmed public commands, and optional owner-private secret deliveries |
| Best for | Custom authoritative rules, persistent worlds, economies | **Fast real-time action** plus common hidden choices, random, deck, bag, and role mechanics |
| Tick rate | Event-driven / slow server tick | Fixed **30 Hz** simulation on every client |
| Cheat model | Server validates everything | Determinism means a cheater can only desync **themselves** |

**Choose Syncplay** for deterministic real-time play and its built-in secret
mechanics. **Choose the GameRoom Multiplayer API** when you need arbitrary
creator-authored authoritative rules, a shared economy, or a persistent world.

{% hint style="info" %}
**Public simulation, private projection.** Every client still simulates the same
public state. For common hidden-information mechanics, the trusted RUN authority
delivers private values only to their owners and injects signed public outcomes
on confirmed ticks. See [Syncplay Secret Systems](SYNCPLAY-SECRETS.md).
{% endhint %}

***

## How it works (the one mental model you need)

```
Your game = a pure step function:  (state, inputs, frame) → next state

Every client runs it locally:
  • predicts the next few ticks using its own input + a guess for opponents
  • sends its input to the server
  • the server orders everyone's inputs by tick and broadcasts the confirmed set
  • if a confirmed opponent input differs from the guess → roll back & re-simulate
  • all clients converge on identical state, every tick
```

Two rules follow from this, and they are the whole discipline of writing a
Syncplay game:

1. **Your simulation must be deterministic.** Same inputs in the same order must
   produce byte-identical state on every device and browser — forever. The engine
   gives you deterministic math and RNG to make this easy, and tooling that fails
   your build if you break it.
2. **Everything gameplay-relevant lives in the simulation state.** If it isn't in
   `state`, it isn't synchronized. Rendering reads from state; it never drives it.
3. **Never mutate prior state.** `step` must not modify the state object it
   receives or anything reachable from it. Copy any structure you change;
   sharing untouched structure is encouraged.

***

## Install & imports

Syncplay ships inside the game SDK. Import the authoring/browser surface from the
SDK subpaths:

```typescript
// Define a game + run it offline — import authoring APIs from /creator
// (creator-boundary requires this subpath in your certified sim file)
import { defineSyncplayGame, createSyncplayGameRuntime } from '@series-inc/rundot-game-sdk/syncplay/creator'

// Networked client + room transport + optional R3F adapter
import {
  createNetworkedSyncplayClient,
  createSyncplayRoom,
  joinSyncplayRoomByCode,
  createDeterministicR3fAdapter,
  verifyDeterministicReplay,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

// Build-time determinism checker (vite.config.ts)
import { rundotSyncplayPlugin } from '@series-inc/rundot-game-sdk/syncplay/tools'
```

The fastest way to a working project is the scaffolder:

```bash
npx rundot-syncplay project:scaffold ./my-game --name "My Game" --template systems
```

Templates: `offline` (bare deterministic runtime), `systems` (with the built-in
physics/movement/collision systems), `h5` (a full H5 game shell).

***

## 1. Define your game

A Syncplay game is one **descriptor** (the schema of inputs, state, and systems)
plus one **step function** (the rules). `defineSyncplayGame` validates the
descriptor and stamps it with a replay identity.

```typescript
import { defineSyncplayGame, type DeterministicStep } from '@series-inc/rundot-game-sdk/syncplay/creator'

// Your input — what one player sends per tick. Keep it small.
interface Input { thrustX: number; thrustY: number; dash: boolean }

// Your state — everything that must stay in sync. Arrays are indexed by slot.
interface State {
  frame: number
  x: number[]; y: number[]; vx: number[]; vy: number[]
  score: number[]
}

const descriptor = defineSyncplayGame({
  deterministicVersion: 'arena@1',   // bump when rules change — invalidates old replays
  tickRate: 30,                       // fixed simulation Hz
  maxPlayers: 8,                      // 1..128
  input: {
    id: 'arena-input/v1',
    fields: [
      { name: 'thrustX', kind: 'integer', policy: 'repeat',  defaultValue: 0, min: -1, max: 1 },
      { name: 'thrustY', kind: 'integer', policy: 'repeat',  defaultValue: 0, min: -1, max: 1 },
      { name: 'dash',    kind: 'boolean', policy: 'command', defaultValue: false },
    ],
  },
  state: {
    id: 'arena-state/v1',
    fields: [
      { name: 'frame', kind: 'integer', checksummed: true },
      { name: 'x', kind: 'integer', collectionOrdering: 'indexed', checksummed: true, min: -8192, max: 8192 },
      { name: 'y', kind: 'integer', collectionOrdering: 'indexed', checksummed: true, min: -8192, max: 8192 },
      // ...vx, vy, score
    ],
  },
  systems: [{ id: 'input' }, { id: 'movement' }, { id: 'collision' }],
})
```

### Input field policies

An input field's `policy` tells the engine how to treat a missing packet — this is
what keeps play smooth when a peer's input is late:

| `policy` | Meaning | Use for |
|---|---|---|
| `repeat` | If the packet is late, **repeat the last value**. | Held state — movement sticks, thrust axes. |
| `command` | A one-shot edge; **not** repeated. | Momentary actions — jump, dash, fire. |

Client-authored one-shot actions use a `policy: 'command'` input field too. For
example, a room creator's “start now” button is sampled for exactly one input
tick:

```typescript
// In the descriptor:
{ name: 'startNow', kind: 'boolean', policy: 'command', defaultValue: false }

// Outside the simulation, consume the UI edge once:
let startNowPressed = false
startButton.onclick = () => { startNowPressed = true }

localInputForTick: () => {
  const input = { ...readHeldInput(), startNow: startNowPressed }
  startNowPressed = false
  return input
}

// Inside step():
const shouldStart = inputs.some((input) => input.startNow)
return shouldStart ? { ...state, phase: 'battle' } : state
```

`NetworkedSyncplayClient` does not submit arbitrary `ctx.commands`.
`ctx.commands` contains authority-confirmed consequences, including Syncplay
secret-system outcomes. Use command-policy input fields for creator/player UI
actions that must enter rollback-safe simulation.

### State field kinds

`kind` picks the deterministic encoding. **Checksummed fields must be integers or
fixed-point — never a raw float.**

| `kind` | Stored as | Notes |
|---|---|---|
| `integer` | 32-bit int | Positions, scores, counters. Set `min`/`max`. |
| `fixed-q16` | Q16.16 fixed-point | Sub-unit precision without floats. |
| `boolean` / `button` / `bitfield` | packed bits | Flags, buttons. |
| `player-slot` | slot index | References a player. |
| `asset-ref` | cooked asset id | References a cooked asset. |

Set `checksummed: true` on every state field that affects gameplay outcome — those
fields are what clients compare to detect divergence. Use `collectionOrdering:
'indexed'` for per-slot arrays.

***

## 2. Write the step function

The step function is the heart of your game. It is **pure**: it takes the current
state, one input per player slot, the frame number, and a context, and **returns
the next state**. It must not read the clock, call `Math.random`, or touch
anything outside its arguments.

```typescript
const step: DeterministicStep<State, Input> = (state, inputs, frame, ctx) => {
  const x = [...state.x], y = [...state.y], vx = [...state.vx], vy = [...state.vy]

  for (let slot = 0; slot < inputs.length; slot++) {
    const input = inputs[slot]
    // Integer/fixed-point math via ctx.math — never `+`/`*` on floats you checksum
    vx[slot] = ctx.math.clamp(vx[slot] + input.thrustX * ACCEL, -MAX_V, MAX_V)
    vy[slot] = ctx.math.clamp(vy[slot] + input.thrustY * ACCEL, -MAX_V, MAX_V)
    x[slot] = ctx.math.clamp(x[slot] + vx[slot], -BOUND, BOUND)
    y[slot] = ctx.math.clamp(y[slot] + vy[slot], -BOUND, BOUND)
  }

  return { ...state, frame: frame + 1, x, y, vx, vy }
}
```

Syncplay retains the object returned by `step` in its rollback ring by
reference. That makes snapshots and rollback O(1), but it also means an in-place
mutation corrupts history and can desync only the peers that roll back. Run
synctest in CI; its aliasing, hydration, and codec checks exercise this contract.

For a large persistent state, keep an incremental running hash in state and
provide `checksum: state => state.hash` on your `createSyncplayGameRuntime` /
`createSyncplaySession` config. This is the intended O(1) seam for regular
desync checks. The same configs accept `serializeState` / `deserializeState`
(always provide both) and `canonicalizeState` for state that is not fully
expressible as declared descriptor fields — a large typed-array world, a
custom binary codec. If a custom serializer covers fields the descriptor does
not declare, provide `canonicalizeState` too: the schema default drops
undeclared fields from replay initial state and snapshot egress. Late-join
and promotion snapshots still serialize and checksum the complete state on
demand; the wire checksum is deliberately not the configured projection.

With a custom checksum and a checksum interval greater than one, invalid
canonical shapes may be detected at state-snapshot egress, such as late join or
promotion, rather than the exact frame where they entered state. Replay export
does not serialize current state. Synctest serializes every frame and should be
a required CI check.

For physics, movement, pathfinding, AI, and animation, don't hand-roll it — call
the [built-in deterministic systems](#4-built-in-systems-all-deterministic) from
inside your step.

The `ctx` (step context) is the **only** source of nondeterministic-looking
capabilities, made deterministic:

| `ctx` member | What it is |
|---|---|
| `ctx.frame` | The current tick number. |
| `ctx.random` | A seeded `DeterministicRandom` — `ctx.random.nextInt(min, max)`. The **seed is server-owned**; you cannot bias it. |
| `ctx.math` | Fixed-point math helpers — `add/sub/mul/div`, `clamp`, `sinTurns/cosTurns`, `vec2*`. |
| `ctx.commands` | The command-channel payloads confirmed for this tick. |
| `ctx.dtTicks` | Always `1`. The sim only advances in whole ticks. |

***

## 3. Determinism rules (read this — it's the whole game)

If your simulation diverges by even one bit on one device, that player desyncs.
These are the rules; the [build-time checker](#5-add-the-build-time-checker)
enforces most of them for you.

{% hint style="danger" %}
**Inside the step function and anything it calls, NEVER:**

- use `Math.random()` — use `ctx.random`
- read `Date.now()`, `performance.now()`, or any clock — use `ctx.frame`
- use `setTimeout`/`setInterval` for game timing — count `ctx.frame`
- do float math on values you checksum — use `ctx.math` (fixed-point / integer)
- iterate a `Map`/`Set`/object in insertion or hash order, or `sort()` without a
  total-order comparator — iteration order must be identical everywhere
- mutate the incoming `state` — return a new state
- read from the DOM, network, storage, or any I/O
{% endhint %}

**DO:** keep all gameplay state in `state`; use `ctx.math` and `ctx.random`; make
the step a pure function of its arguments; keep inputs tiny (bits, not blobs).

***

## 4. Built-in systems (all deterministic)

Physics, pathfinding, and AI are exactly where hand-written game code tends to
break determinism (a float here, an unordered loop there). So Syncplay ships
**deterministic, rollback-safe implementations of the hard systems** — you don't
have to write them and risk desyncs.

They are **plain functions**, not a framework. Every one follows the same shape:

```
cook/create  →  a value (world, graph, agent, runtime state) you keep in `state`
step/query   →  a pure function you call each tick that returns the NEXT value
```

Because they take a value and return a value (never mutate, never touch the clock
or `Math.random`), they compose cleanly inside your [step function](#2-write-the-step-function)
and roll back for free. Import them all from `@series-inc/rundot-game-sdk/syncplay/browser`.

{% hint style="info" %}
**Cook at build/setup, step at runtime.** The `cook*` / `create*` functions turn
authoring data (a tilemap, a navmesh, a bot document, an animation graph) into a
compact deterministic structure. Do that once — at build time or on match start —
then call the matching `step*` / `find*` / `tick*` function every tick.
{% endhint %}

Each system has its own guide with the authoring types, signatures, and worked
examples. This is the map:

### [Physics & collision](SYNCPLAY-PHYSICS.md)

Deterministic rigid-body worlds — fixed-point 2D plus the runtime-certified,
internally quantized 3D TGS-Soft lane — with integration, contact events, and
spatial queries (raycast, overlap, shape-cast). Plus standalone collision
primitives (`fixedCircle`, `circleIntersects`, …) for lightweight games. The
3D API accepts finite world-unit numbers; the general fixed-point rule still
applies to float math in your own checksummed game logic.
**→ [Physics & collision](SYNCPLAY-PHYSICS.md)**

### [Character movement (KCC)](SYNCPLAY-MOVEMENT.md)

Kinematic character controllers with collision, slopes, step-up, coyote time, and
jump buffering (2D and 3D), plus top-down/twin-stick movers and FPS aim.
**→ [Movement (KCC)](SYNCPLAY-MOVEMENT.md)**

### [Pathfinding](SYNCPLAY-PATHFINDING.md)

Stable A\*, flow fields, and crowd avoidance over **navigation graphs**
(grid/tilemap) or **navmeshes** (polygons, with off-mesh links). Dynamic blockers
and toggleable regions re-path identically on every client.
**→ [Pathfinding](SYNCPLAY-PATHFINDING.md)**

### [Bots & AI](SYNCPLAY-BOTS.md)

Deterministic decision-making — Behavior Trees, HFSMs, and Utility AI driven by a
typed **blackboard**, authored inline or compiled from a document. Bots occupy real
player slots, so a match can mix humans and bots (or backfill a disconnect).
**→ [Bots & AI](SYNCPLAY-BOTS.md)**

### [Animation](SYNCPLAY-ANIMATION.md)

A deterministic animation state machine — clips, transitions, blend trees, layers,
and clip **events** (hit frames, footsteps) that fire on the same tick everywhere
and survive rollback without double-firing.
**→ [Animation](SYNCPLAY-ANIMATION.md)**

### [Lag compensation (3D)](SYNCPLAY-LAG-COMPENSATION.md)

Fair hitscan for fast shooters: rewind hitboxes to the frame the shooter saw,
validate the shot there, and reject forged timing.
**→ [Lag compensation](SYNCPLAY-LAG-COMPENSATION.md)**

***

## 5. Run it offline (dev & singleplayer)

Before you touch the network, run the exact same descriptor and step locally. This
is your dev loop **and** your singleplayer mode — identical simulation, identical
replays.

```typescript
import { createSyncplayGameRuntime } from '@series-inc/rundot-game-sdk/syncplay/creator'

const runtime = createSyncplayGameRuntime<State, Input>({
  descriptor,
  playerCount: 2,
  initialState,
  defaultInput: { thrustX: 0, thrustY: 0, dash: false },
  step,
})

// Feed inputs and advance the simulation
runtime.setInput(0, { thrustX: 1, thrustY: 0, dash: false })
runtime.update(deltaMs)               // advance by wall-clock delta (fixed-step internally)

// Render from the current frame
const unsubscribe = runtime.subscribe((frame) => {
  drawWorld(frame.state)              // frame.state, frame.frame, frame.checksum
})

// Export a replay you can verify later
const replay = runtime.exportReplay()
```

`createSyncplayGameRuntime` returns:

| Member | Description |
|---|---|
| `getFrame()` | Current `{ frame, state, checksum, predictedFrame, verifiedFrame }`. |
| `setInput(slot, input)` | Set a slot's input for the next tick. |
| `update(deltaMs)` | Advance by real elapsed time (fixed-step internally). Returns frames stepped. |
| `stepFrames(count)` | Advance exactly `count` ticks (deterministic tests). |
| `subscribe(fn)` | Called each frame with the latest `state`. Returns an unsubscribe. |
| `exportReplay()` | A verifiable replay of everything simulated so far. |

***

## 6. Add the build-time checker

Add the Vite plugin so your build **fails** if any simulation file breaks a
determinism rule (random, clock, timers, unordered iteration, float math on
checksummed state, render-object mutation).

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { rundotSyncplayPlugin } from '@series-inc/rundot-game-sdk/syncplay/tools'

export default defineConfig({
  plugins: [
    rundotSyncplayPlugin({
      mode: 'strict',                             // fail the build on violations
      simulationEntries: ['src/sim/step.ts'],     // your deterministic sources
    }),
  ],
})
```

| Option | Type | Description |
|---|---|---|
| `mode` | `'warn' \| 'strict'` | `strict` fails the build on any violation **and** requires at least one existing `simulationEntries` path (empty/missing entries fail); `warn` downgrades advisory rules to logs. Error-class rules (random, clock, timers, fetch, dynamic import) fail the build in **both** modes. |
| `simulationEntries` | `string[]` | Files/directories that make up your simulation — checked for determinism. **Required in `strict` mode.** |
| `projectCertification` / `projectCheck` | object | Optionally run the certification/check CLI at build time. |

There are `createSyncplayViteConfig` and `withSyncplayViteConfig` helpers if you
prefer to compose config objects.

***

## 7. Go multiplayer

Multiplayer is the same simulation, driven by the networked client instead of the
offline runtime. Two steps: **declare a deterministic room type**, then **connect a
client**.

### Declare a deterministic room type

In your room-type config (e.g. `rundot/realtime.config.json`), mark the room type
`deterministic`. There is **no `file` pointing at server code** — the built-in
generic input authority serves it.

```json
{
  "rooms": [
    { "type": "arena", "deterministic": true }
  ]
}
```

> **One file, all three modes.** This `rundot/realtime.config.json` declaration
> powers local dev (the in-process sidecar), the playground, and production —
> the deterministic room is uploaded to the hosted room-server automatically on
> `npm run dev`. You do **not** need a separate `rooms.config.json`. (If you do
> add an explicit `rundot/rooms.config.json`, it must be the **bare array** of
> room defs — no top-level `"rooms"` wrapper — and it overrides the rooms in
> `realtime.config.json`.)

That's the entire server side. Every Syncplay game shares one built-in authority
that orders inputs and confirms ticks; it never runs your simulation.

### Connect a client

Get a room transport, then hand it to `createNetworkedSyncplayClient` along with a
factory that builds your simulation session from the **server-supplied seed and
player count**. `RundotGameAPI.realtime` already **is** the multiplayer API — pass
it straight in; auth and the room-server URL are handled by the host.

```typescript
import {
  joinSyncplayRoomByCode,
  createSyncplayRoom,
  createNetworkedSyncplayClient,
} from '@series-inc/rundot-game-sdk/syncplay/browser'
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// 1. Join (or create) the deterministic room → a socket-like transport.
const transport = await joinSyncplayRoomByCode(RundotGameAPI.realtime, roomCode)
// const transport = await createSyncplayRoom(RundotGameAPI.realtime)  // server mints transport.roomCode

// 2. Build the predicting client. It runs YOUR sim locally with rollback.
const client = createNetworkedSyncplayClient<State, Input>({
  transport,
  createSession: ({ seed, playerCount }) =>
    createOfflineSessionForArena({ seed, playerCount }),   // your factory → an OfflineSession
  localInputForTick: (slot, tick) => readLocalInput(),     // this device's input for a tick
  encodeInput: (input) => packInput(input),
  decodeInput: (encoded) => unpackInput(encoded),          // map the neutral input → your default
  maxPredictionTicks: 8,                                    // how far ahead to predict (default 8)
})

await client.whenReady()      // resolves when the server sends session-start (slot + seed)

// Drive it from your render loop:
function frameLoop() {
  client.pump()               // predict forward & send this device's input
  drawWorld(/* read from client's session state */)
  requestAnimationFrame(frameLoop)
}
```

What the client gives you:

| Member | Description |
|---|---|
| `whenReady()` | Resolves once the server assigns your slot and seed. |
| `slot` | This device's player slot. |
| `pump()` | Predict forward, send local input, apply any confirmed frames (with rollback). |
| `predictedThrough` / `appliedThrough` | Highest locally-stepped tick / highest confirmed tick. |
| `rollbacks` | How many corrections have happened (useful as a network-health readout). |
| `confirmedPlayerPresence` | Latest confirmed per-slot view: `'human'`, `'substituted'`, `'empty'`, or `'unknown'` for legacy frames. |
| `exportReplay()` | A verifiable replay of the match as this client saw it. |

The transport also exposes `roomCode` (share it to invite peers), `playerId`,
`occupancy`, `isCreator`, and `close()`. Presence and occupancy are transport
metadata: they are not inserted into simulation state or its checksum.

```typescript
const transport = await createSyncplayRoom(RundotGameAPI.realtime, { maxPlayers: 8 })

const unsubscribe = transport.onOccupancyChange(({ players, occupied, maxPlayers, full, locked }) => {
  renderLobbyCount(`${occupied}/${maxPlayers}`)
  renderRoster(players)
  setJoinButtonDisabled(full || locked)
})

if (transport.isCreator) {
  transport.setSeatingOpen(false) // locks new seating; current players stay connected
  transport.setSeatingOpen(true)  // reopen later
}

client.confirmedPlayerPresence // ['human', 'substituted', 'empty', ...]
```

In the presence view, `human` means an occupied seat whose input arrived for
the confirmed tick, `substituted` means an occupied human seat whose late input
was replaced/repeated by the authority, `empty` means no human occupied that
slot, and `unknown` means the frame came from a legacy authority without
presence metadata.

Only the room creator can change seating. A non-creator request fails with
`ROOM_CREATOR_REQUIRED`. Closing seating blocks joins and quick-match placement;
it does not disconnect current players or stop the simulation. Call
`unsubscribe()` when the lobby UI is removed.

{% hint style="info" %}
**Outside the host?** For standalone contexts (tests, tooling) where
`RundotGameAPI.realtime` isn't available, construct a `WsMultiplayerApi` yourself
with a room-server URL and a join-ticket provider, and pass that instead —
`import { WsMultiplayerApi } from '@series-inc/rundot-game-sdk/syncplay/browser'`.
{% endhint %}

{% hint style="info" %}
**The seed is server-owned.** Your `createSession` receives the `seed` and
`playerCount` from the server's `session-start` — never generate your own. That's
what makes RNG identical across clients and unforgeable.
{% endhint %}

### Test multiplayer locally (before you deploy)

You don't need the playground — or any server you run by hand — to test two
players. With the deterministic room you declared above (in
`rundot/realtime.config.json`), `npm run dev` (Vite) starts an **in-process room
sidecar** that runs the *same* input authority as playground and production.
Open the game in two browser tabs and they play together.

Connect exactly as you do in production — `RundotGameAPI.realtime` is already
wired to the local sidecar during `vite dev`, and each tab gets its own dev
identity automatically:

```typescript
import { createSyncplayRoom, joinSyncplayRoomByCode } from '@series-inc/rundot-game-sdk/syncplay/browser'
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Tab 1: create → share transport.roomCode; Tab 2: join with that code.
const transport = await createSyncplayRoom(RundotGameAPI.realtime)
// const transport = await joinSyncplayRoomByCode(RundotGameAPI.realtime, roomCode)
```

Use two **separate** tabs or windows — each gets its own dev identity. Don't
*duplicate* a tab: a duplicated tab copies the session identity and the room
rejects the second join with `DUPLICATE_SESSION` (one identity holds one seat).

Because the sidecar is the same authority you ship against, behavior you see
here — ordering, confirmed ticks, late-join, rollback — matches playground and
production. **Do not hand-roll a local WebSocket server for this; the sidecar
already is one.**

> **The three ways a Syncplay game runs.** (1) **Solo / local** —
> `createSyncplayOfflineRuntime`, no server. (2) **Multiplayer, playground** —
> hosted `mp-room-server-playground`; `RundotGameAPI.realtime` resolves to it on
> the `playground` target. (3) **Multiplayer, live** — hosted production
> `mp-room-server`, reached through the RUN client host. The room-server URL is
> chosen for you per environment (local sidecar in `vite dev`, the playground
> URL on the playground target, the client's configured prod URL in the shipped
> app) — games never hardcode it.

### Start solo, then open to others (drop-in)

`createSyncplaySession` is one object that begins as your singleplayer runtime
and promotes to a room on demand — no teardown/rebuild in your own code.

```typescript
import { createSyncplaySession, quickMatchSyncplayRoom } from '@series-inc/rundot-game-sdk/syncplay/browser'
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const session = createSyncplaySession<State, Input>({
  descriptor, initialState, defaultInput: NEUTRAL, step,
  encodeInput: packInput, decodeInput: unpackInput,
})

// Solo loop — no network:
session.setLocalInput(readInput())
session.advance(deltaMs)
draw(session.getState())

// Player taps "play with others":
const transport = await quickMatchSyncplayRoom(RundotGameAPI.realtime)
await session.openRoom(transport)   // now networked; same loop keeps working
```

**Reset semantics.** `openRoom` starts a fresh shared match from the room's
seed — your in-progress solo world is *not* carried into the room. (Carrying a
running solo game into a live room requires authority-side snapshot seeding,
which is future work.)

### Drop-in, late join & rejoin

Syncplay rooms are **drop-in by default**. The match clock starts as soon as the
first player is present — nobody waits for a full lobby — and empty slots simply
receive their default input (a `repeat` field holds its last value; a `command`
field stays unset) until someone takes them.

- **Late join.** A player who joins mid-match catches up automatically and
  **fast-forwards to the live edge** — then plays in lockstep like everyone
  else. Young matches replay the confirmed input history from tick 0; once the
  match has run long enough, the server instead holds a **validated state
  snapshot** (donated by a connected client and cross-checked against every
  other client's state checksums — a snapshot that disagrees with the room is
  never used) and serves joiners snapshot + recent input tail, so catch-up
  takes seconds **regardless of match age**. You don't do anything special
  beyond `serializeState`/`deserializeState` in your session config (the
  canonical default works for plain-JSON state). While catching up, the
  client's `appliedThrough` climbs rapidly toward the live tick — render a
  "syncing…" affordance until it reaches it.

  **Snapshot size budgets.** Your serialized state rides the wire as base64
  inside a JSON envelope (the frozen v1 wire is JSON — there is no binary
  path), so wire size ≈ raw bytes × 4⁄3 (plus a small fixed envelope
  overhead). Two budgets apply:

  | Path | Budget | Applies to |
  |---|---|---|
  | Monolithic `snapshot`/`correction` envelope | 2,097,152 bytes | the whole encoded envelope |
  | Chunked `snapshot-offer/chunk/complete` transfer | 4,194,304 bytes (default) | the JSON+base64 snapshot string, moved in 262,144-byte chunks |

  A snapshot above the monolithic budget **must** use the chunked transfer —
  late-join and crash-restore already do. Practical raw-state ceiling on the
  chunk path: about 3.1 MB (4,194,304 × 3⁄4, minus envelope overhead). Worked
  example: at 8 raw bytes per cell a voxel world tops out near 393,000 cells.
  The local dev-harness ws-frame transport additionally caps a single frame at
  65,535 bytes, which is why that transport always uses small chunks.
- **Rejoin.** If a player drops and comes back, they reclaim their **original
  slot** — their ship/score/state is exactly where the match carried it, not a
  fresh seat.
- **Reconnect.** A brief socket blip is repaired transparently: the server
  re-sends any confirmed ticks missed while the socket was down, and the client
  de-dupes what it already applied. A longer outage in an old match is repaired
  the same way a late join is — via the stored snapshot. Even a server-side
  crash recovers: once a validated snapshot exists, the room restores from it
  and re-seats everyone with only a few seconds of gameplay rewound.


Clients report state checksums automatically on a cadence
(`checksumCadenceTicks` client option, default `120`); these feed both desync
telemetry and snapshot validation. A join is rejected (`history-unavailable`)
only in the narrow early window where no validated snapshot exists yet AND the
tick-0 history has already been pruned — rejected loudly, never seated desynced.

#### Quick match & bots

Skip the room-code exchange entirely with **quick match**: the platform pools
compatible players into an open room (or spins up a fresh one).

```typescript
import { quickMatchSyncplayRoom } from '@series-inc/rundot-game-sdk/syncplay/browser'

const transport = await quickMatchSyncplayRoom(api) // any open room
const ranked = await quickMatchSyncplayRoom(api, { mode: 'ranked' }, { maxPlayers: 8 })
```

Quick match is **region-aware by default**: a coarse `region` criterion
(`'na' | 'sa' | 'eu' | 'africa' | 'asia' | 'oceania'`, derived from the device
timezone) is auto-injected so cross-ocean pairings — whose round-trip time
forces constant deep rollback — don't happen by accident. Your own
`criteria.region` value always wins, an underivable region is never injected
(those players pool globally), and for low-traffic games where strict region
pools run thin you can opt out entirely with
`quickMatchSyncplayRoom(api, criteria, { autoRegion: false })`.
There is no timeout-based migration from a regional room into the global pool;
cross-pool room migration is future work.

`maxPlayers` must be a positive integer. The server may lower it to the room
type's configured maximum. Quick-match requests with different requested
capacities use separate pools; omitting `maxPlayers` preserves the existing
unconstrained pool behavior.

With drop-in defaults the match starts the moment the first player lands.
Unfilled slots receive the canonical `null` input **forever** (there is no
prior input to repeat), which gives you free deterministic **bot backfill**:
map `null` to a bot marker in `decodeInput` and drive the ship from your `step`
— every client computes the same bot, no server code, and the moment a human
quick-matches into that slot their real inputs take over mid-match.

```typescript
decodeInput: (e) => (e === null ? { ...NEUTRAL, bot: true } : fromWire(e)),
// in step(): if (input.bot) input = botBrain(state, slot, ctx)  // deterministic!
```

#### Room-config knobs (optional)

All are set on the deterministic room type in your room-type config and all are
optional — the defaults above need no configuration.

```json
{
  "rooms": [
    {
      "type": "arena",
      "deterministic": true,
      "config": {
        "waitForFullRoom": false,
        "historyRetentionTicks": 216000,
        "snapshotCadenceTicks": 3600
      }
    }
  ]
}
```

| Key | Default | Meaning |
|---|---|---|
| `waitForFullRoom` | `false` | Set `true` to require **every** slot filled before the clock starts (a hard lobby gate) instead of drop-in. |
| `historyRetentionTicks` | `216000` (1 h @ 60 Hz) | How much confirmed-input history the server keeps **before the first validated snapshot exists**. Once a snapshot is stored, it (plus a short tail) replaces old history entirely and this window stops mattering. |
| `snapshotCadenceTicks` | `3600` (1 min @ 60 Hz) | How often the server refreshes its validated state snapshot. Smaller = shorter catch-up tails for joiners; larger = fewer snapshot transfers. Rooms whose clients predate snapshot support simply keep the history-replay behavior. |
| `spectators` | `false` | Set `true` (with `maxPlayers` above `playerCount`) to let extra joiners watch as read-only **spectators**: they hydrate like late joiners and follow the live match but hold no input slot. Your client reads `client.role` (`'player'` \| `'spectator'`). |
| `playerCount` | = `maxPlayers` | The number of simulation input slots. Only needed when it differs from `maxPlayers` (i.e. with spectators). |
| `matchLog` | `false` | Set `true` to keep the full server-ordered input log so finished multiplayer matches can be **re-simulated offline for score verification** (`verifyScoredMatchLog`) — a server-side, match-end anti-cheat path. This is distinct from the per-submission [replay-verified leaderboards](#replay-verified-leaderboards) flow (`requiresReplay` + `exportReplay()`), which verifies each client's own recorded run at submit time. |

#### Netcode on real networks (pacing, input delay, telemetry)

On real networks, drive the client with `client.pumpPaced(performance.now())`
once per animation frame instead of raw `pump()`. The client measures RTT via
built-in time-sync pings, estimates the server clock, and gently speeds up or
slows down (±10% max — invisible) so it neither stalls at the prediction cap
nor starves into constant input substitution on asymmetric connections.

```ts
const client = createNetworkedSyncplayClient({
  transport, createSession, localInputForTick, encodeInput, decodeInput,
  // Optional: trade a sliver of local input latency for far fewer rollbacks.
  // With maxTicks > minTicks the delay auto-tunes from measured ping.
  inputDelay: { minTicks: 0, maxTicks: 4 },
})
function frame(now: number) {
  client.pumpPaced(now)
  requestAnimationFrame(frame)
}
client.netStats // { rttMs, timescalePermille, inputDelayTicks, rollbacks, maxRollbackDepth }
```

If the server ever detects your client desynced (its state checksum disagrees
with the room), it automatically re-seats it from the validated snapshot — a
brief reload instead of a silently broken match.

#### Catch desyncs before you ship: synctest

Run your game's step function through the built-in **synctest** (rollback
every frame + checksum compare over fuzzed inputs) in your own CI — it catches
the nondeterminism the build-time checker can't see (logic bugs, iteration
order, stray randomness). Scaffolded projects get a `npm run test:sync` script;
the library form is `runSyncplaySynctest` from
`@series-inc/rundot-game-sdk/syncplay/creator`.

***

## 8. Rendering

Rendering is a **read-only projection** of simulation state. Read
`frame.state` (offline) or the client's session state (networked) and draw — never
write gameplay state from the renderer.

For React Three Fiber games, `createDeterministicR3fAdapter` gives you frozen,
render-safe frame props (predicted and verified), normalized input bindings, and
interpolation helpers — and it **blocks** render code from mutating checksummed
state, so a rendering bug can't cause a desync.

```typescript
import { createDeterministicR3fAdapter } from '@series-inc/rundot-game-sdk/syncplay/browser'
```

Interpolate between fixed ticks for smooth visuals with
`interpolateDeterministicRenderNumber` / `interpolateDeterministicRenderVec2` —
those produce floats for display only.

***

## 9. Certify & deploy

Syncplay verifies your game deterministically from the CLI before it ships. The
CLI ships as its own package — add it as a dev dependency so `npx rundot-syncplay`
(and your `package.json` build scripts) resolve the local bin:

```bash
npm i -D @series-inc/rundot-syncplay
```

Deployability is proven by **build-time certification**, not by artifacts stamped
into your room config. The single deployable preflight is `project:check` with the
`static-determinism` section required — it proves your simulation is a real,
file-backed, replayable module before upload:

```bash
# Deployable preflight: fails if a simulation file isn't file-backed or breaks a
# determinism rule. static-determinism is required for a deployable check.
npx rundot-syncplay project:check syncplay.project.json \
  --require descriptor,assets,config,replay-runtime,creator-boundary,static-determinism \
  --frames 32 --dist dist
```

The CLI gate (`rundot-syncplay static:determinism --entry src/sim/step.ts`)
follows your simulation's import graph transitively — the report's
`checkedPaths` lists every file actually checked, `unresolvedImports` lists
relative imports it could not resolve (those are unchecked holes: fix them),
and bare package imports (node_modules) are never checked. If your simulation
uses tsconfig path aliases, add `--project tsconfig.json` so aliased imports
resolve and get checked. Pass `--no-follow-imports` to check only the listed
files.

Also keep runtime guards enabled and run the [synctest](#catch-desyncs-before-you-ship-synctest)
(`runSyncplaySynctest`, or verify a replay) before a deployable multiplayer
build — those are the behavioral determinism proofs. The reports these commands
emit are **local receipts**, not a trust or admission gate: Venus upload
validation and the room-server never read them.

To deploy to the **playground** environment first, use `rundot deploy --env playground`
(see the [deploy-branch-to-playground runbook](https://github.com/series-inc/venus/blob/develop/docs/runbooks/deploy-branch-to-playground.md)).

Then deploy the game the normal way with `rundot deploy` (see
[Deploying Your Game](../deploying-your-game.md)). Your room config stays the
bare declaration — no proof artifacts:

```json
{
  "rooms": [
    { "type": "arena", "deterministic": true }
  ]
}
```

Venus upload validation and room-server startup validate only the **room shape**
(a bare `deterministic: true`, or an object carrying `protocol` /
`simulationHooks`). A room that still carries legacy deploy-check proof fields is
rejected.

### Replay-verified leaderboards

A Syncplay game whose score is a deterministic function of input can require the
server to **re-run its certified score runtime over the player's recorded inputs**
before ranking a submission — closing the "submit an arbitrary number" hole with
no game code running server-side. Set `requiresReplay: true` on the board and
attach `session.exportReplay()` to `submitScore`; see the
[Replay Verification Mode](LEADERBOARD.md) section of the Leaderboards API for the
full flow, the pending → ranked/rejected lifecycle, and the integrity boundary
(it proves score↔input consistency, **not** that a human produced the inputs).

Deploying a `requiresReplay` board requires the certify replay bundle in your
deploy build output. `project:certify` emits it as
`project-runtime-replay.bundle.json`; point `replayBundleOut` in your
`syncplay.project.json` at your deploy folder so the bundle ships in the deployed
build:

```jsonc
// syncplay.project.json
{
  // …
  "replayBundleOut": "dist/project-runtime-replay.bundle.json"
}
```

```bash
npx rundot-syncplay project:certify syncplay.project.json
```

At deploy the CLI fails loudly if a `requiresReplay` board is missing that bundle
(or ships a structurally-invalid one), and the backend stores the trusted
verification rules keyed by `deterministicVersion` (bump it when your rules change
— old replays no longer verify). A late-join (snapshot-hydrated) session cannot
export a replay, so those submissions are rejected fail-closed.

### Simulation-backed permanent state

Syncplay snapshots are **transport and crash-recovery only** — never treat them as
the authoritative permanent world. Durable state (persistent actors, inventory,
economy, season/world state, verified outcome settlement) belongs in game-server
simulation. A **persistent** deterministic room opts into it with `simulationHooks`:

```json
{
  "rooms": [
    {
      "type": "arena",
      "persistent": true,
      "deterministic": {
        "simulationHooks": {
          "bootstrap": true,
          "settleRecipeId": "award_season_prize",
          "settlementTarget": "players"
        }
      }
    }
  ]
}
```

With `bootstrap: true` the room loads durable simulation state on create/restore
before accepting joins. With a `settleRecipeId` it settles verified outcomes into
durable state at a settlement boundary (idempotently). This never changes the
frozen `session-start` wire protocol.

***

## 10. Replays

Every runtime records a replay — a seed plus the full input timeline — that
re-simulates the entire match. Verify one anywhere (browser or Node):

```typescript
import { verifyDeterministicReplay } from '@series-inc/rundot-game-sdk/syncplay/browser'

const result = verifyDeterministicReplay({ descriptor, replay, step, defaultInput })
if (result.mismatches > 0) {
  console.error('replay diverged at frame', result.firstMismatch?.frame)
}
```

Replays carry the descriptor's **replay identity** (version + schema ids), so a
replay recorded against an older `deterministicVersion` is correctly rejected
rather than silently mis-verified. Use replays for bug repros, spectating, and
saved highlights.

***

## Scope & limits (v1)

- Built-in hidden information covers choices, random draws, decks, bags, and roles. Arbitrary private game logic still requires a `GameRoom`.
- **1–128 players** per room; secret-enabled rooms currently support 1–16 slots. The sweet spot for real-time action is small rooms.
- **30 Hz** fixed simulation. Design your game around whole ticks.
- **Inputs must be small** — pack them into bits/integers; large per-tick payloads
  defeat the model.
- Determinism is **your** responsibility inside the step function; the tooling
  catches the common mistakes but not novel ones. When a client's `rollbacks`
  climbs or players report desyncs, check for a determinism rule you broke.

### Supported runtimes

Bit-identical simulation is only claimed where it is proved. Every engine PR runs
the replay, number, and 128-player engine-core numeric proofs in a **real VM** of
each certified runtime and requires it to reproduce Node's checksums exactly.

| Runtime | Status | Where it runs |
|---|---|---|
| Node / V8 | certified (blocking) | Authority server, room server, all CLI labs. |
| Chromium / V8 | certified (blocking) | Android WebView, desktop browsers. |
| WebKit / JavaScriptCore | certified (blocking) | iOS WKWebView. |
| Hermes | **unsupported (guarded)** | React Native's own VM. |

Your game runs in the platform WebView, never in Hermes, so the guard should never
fire in a shipping app. If a session is somehow constructed under Hermes it throws
immediately rather than emitting checksums the authority server would reject —
because a silent desync mid-match is far worse than a loud failure at startup.

***

## See also

- [Multiplayer API](MULTIPLAYER.md) — the server-authoritative `GameRoom` model
  (turn-based, hidden info, persistent worlds).
- [Advanced Multiplayer API](ADVANCED-MULTIPLAYER.md) — persistent shared worlds,
  seasons, economy, matchmaking.
- [Deploying Your Game](../deploying-your-game.md) · [rundot CLI Reference](../cli-reference.md)
