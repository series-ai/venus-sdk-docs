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
**Preview.** Syncplay is under active development. The authoring surface
(`defineSyncplayGame`, the offline runtime, the determinism tooling, replays)
and the client API shown here are stable; the hosted production matchmaking and
deploy path are still being finished. Build and iterate against the offline
runtime and the CLI today; treat the networked path as an early preview.
{% endhint %}

***

## Is Syncplay the right tool?

RUN has **two** multiplayer models. Pick by what your game needs.

| | [Multiplayer API](MULTIPLAYER.md) (`GameRoom`) | **Syncplay** |
|---|---|---|
| Server logic | You write a `GameRoom` class — the server is authoritative | **None** — you write only a client-side simulation |
| What crosses the wire | Your typed messages + server state | **Only inputs** |
| Best for | Turn-based, board/card games, lobbies, persistent worlds, economies, anything with **hidden information** | **Fast real-time action** with continuous physics/movement, full-information games |
| Tick rate | Event-driven / slow server tick | Fixed **30 Hz** simulation on every client |
| Cheat model | Server validates everything | Determinism means a cheater can only desync **themselves** |

**Choose Syncplay** when the game is real-time and physical (movement, collisions,
projectiles) and all players can see everything. **Choose the GameRoom
Multiplayer API** when you need server-secret state (a hand of cards, fog of war),
turn arbitration, a shared economy, or a persistent world.

{% hint style="info" %}
**Full-information only.** Because every client simulates the entire game, there
are no server-side secrets in Syncplay v1. If your game has hidden information,
use the [GameRoom Multiplayer API](MULTIPLAYER.md).
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

***

## Install & imports

Syncplay ships inside the game SDK. Import the authoring/browser surface from the
SDK subpaths:

```typescript
// Define a game + run it offline (works in any bundle)
import { defineSyncplayGame, createSyncplayGameRuntime } from '@series-inc/rundot-game-sdk/syncplay'

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
import { defineSyncplayGame, type DeterministicStep } from '@series-inc/rundot-game-sdk/syncplay'

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

Fixed-point 2D and 3D rigid-body worlds — integration, contact events, and spatial
queries (raycast, overlap, shape-cast). Plus standalone collision primitives
(`fixedCircle`, `circleIntersects`, …) for lightweight games. Positions and
velocities are integers/Q16.16 — never floats.
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
import { createSyncplayGameRuntime } from '@series-inc/rundot-game-sdk/syncplay'

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
      mode: 'error',                              // fail the build on violations
      simulationEntries: ['src/sim/step.ts'],     // your deterministic sources
    }),
  ],
})
```

| Option | Type | Description |
|---|---|---|
| `mode` | `'warn' \| 'error'` | `error` fails the build; `warn` only logs. |
| `simulationEntries` | `string[]` | Files that make up your simulation — checked for determinism. |
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
| `exportReplay()` | A verifiable replay of the match as this client saw it. |

The transport also exposes `roomCode` (share it to invite peers), `playerId`, and
`close()`.

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

const transport = await quickMatchSyncplayRoom(api)            // any open room
const ranked = await quickMatchSyncplayRoom(api, { mode: 'ranked' }) // criteria-matched
```

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
scaffolder wires these into `package.json` scripts; the key commands:

```bash
# Prove the offline simulation is deterministic (fixed math, RNG, replay, systems)
npx rundot-syncplay project:check syncplay.project.json --require core --frames 32

# Emit the deploy-check proof artifacts that Venus validates on upload
npx rundot-syncplay project:deploy-check syncplay.project.json
```

Point your room config at the emitted proof artifacts, then deploy the game the
normal way with `rundot deploy` (see [Deploying Your Game](../deploying-your-game.md)):

```json
{
  "rooms": [
    {
      "type": "arena",
      "deterministic": {
        "deployCheckPath": "artifacts/deterministic/project-deploy-check.json",
        "deployCheckVerificationPath": "artifacts/deterministic/project-deploy-check-verify.json"
      }
    }
  ]
}
```

Venus validates those proofs at upload time and refuses a room whose deterministic
proof is missing or failed.

***

## 10. Replays

Every runtime records a replay — a seed plus the full input timeline — that
re-simulates the entire match. Verify one anywhere (browser or Node):

```typescript
import { verifyDeterministicReplay } from '@series-inc/rundot-game-sdk/syncplay/browser'

const result = verifyDeterministicReplay(descriptor, replay)
if (!result.ok) {
  console.error('replay diverged at frame', result.firstMismatchFrame)
}
```

Replays carry the descriptor's **replay identity** (version + schema ids), so a
replay recorded against an older `deterministicVersion` is correctly rejected
rather than silently mis-verified. Use replays for bug repros, spectating, and
saved highlights.

***

## Scope & limits (v1)

- **Full-information games only** — no server-side secrets (see the top).
- **1–128 players** per room; the sweet spot for real-time action is small rooms.
- **30 Hz** fixed simulation. Design your game around whole ticks.
- **Inputs must be small** — pack them into bits/integers; large per-tick payloads
  defeat the model.
- Determinism is **your** responsibility inside the step function; the tooling
  catches the common mistakes but not novel ones. When a client's `rollbacks`
  climbs or players report desyncs, check for a determinism rule you broke.

***

## See also

- [Multiplayer API](MULTIPLAYER.md) — the server-authoritative `GameRoom` model
  (turn-based, hidden info, persistent worlds).
- [Advanced Multiplayer API](ADVANCED-MULTIPLAYER.md) — persistent shared worlds,
  seasons, economy, matchmaking.
- [Deploying Your Game](../deploying-your-game.md) · [rundot CLI Reference](../cli-reference.md)
