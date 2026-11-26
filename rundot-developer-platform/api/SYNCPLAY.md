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

For optional Three.js and PixiJS buffer helpers, see [batch presentation](SYNCPLAY-PRESENTATION.md).
The new entry is an unpublished local candidate.

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

The release workflow sets `rc: 6.0.0-rc.84` after its checks pass.
That version runs 3D physics on the soft-step engine. Read [the rc.81 migration](SYNCPLAY-RC81-MIGRATION.md) first. Read the current tag before
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
`KINETIX_CUSTOM_RUNTIME_IDENTITY_INVALID`. Pass `strongStateReport: true` when
your runtime reports strong state commitments (setting `stateDigestDomain` to
`kinetixStateReportDomain`, exported from `@series-inc/rundot-syncplay/core`).
Server-side timing windows are wall-clock, not tick counts. The background
snapshot interval is 60 s and the donor transfer timeout is 10 s at every
accepted tick rate, so a 20 Hz room waits as long as a 60 Hz room. To change these
windows, see [Snapshot configuration](#snapshot-configuration).
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
  inputSchema: runtime.inputSchema,
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
`joinOrCreateRoom()` call does not add this metadata. `createSyncplayRoom()`,
`joinSyncplayRoomByCode()`, `quickMatchSyncplayRoom()`, and
`openSyncplayBrowserRoom()` also accept `signal?: AbortSignal` to cancel pending
join ticket requests, matchmaking, or socket dials and reject transport
failures as typed `SyncplayError` (`SYNCPLAY_TRANSPORT_ERROR_CODES`; a ticket
request that fails on the network is `transport.socket-failed`) while
passing through `AbortError`, `JoinTicketError`, `MultiplayerUnavailableError`,
and programmer errors unwrapped. With a game SDK that takes `signal` in its
room calls, the ticket request and the socket join stop at the abort, and the
helper rejects with the signal's `reason` exactly as you gave it, `null`
included. An older SDK does not stop these steps. The helper then rejects
only after the room call ends, possibly with the SDK's own error, and a room
that the call joined can keep the player's seat until the server's reconnect
timeout ends.

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
| `retainConfirmedPresentation` | no | Defaults to `true`. Set to `false` when the game reads the current render state and does not drain confirmed frames. The public drain returns an empty list. The runner still builds frames needed for confirmed events or local prediction. |
| `prepareNetworkRuntime` | no | `(descriptor, signal) => Promise<void>` — async asset preflight run **before** the client is constructed. The transport buffers ordered `session-start`/history traffic while it awaits. Aborted on `stop()` and on a superseded connection. |
| `maxPredictionTicks` | no | Rollback/latency budget passed through to the networked client. Not a player-count limit. |
| `maxOfflineStepsPerUpdate` | no | Default **8**. Caps catch-up stepping in one `update(deltaMs)` so a backgrounded tab cannot spiral. |
| `predictionMode` | no | `'always'` (default) predicts the full world and rolls it back when confirmed input differs. Use it for small rooms with low step costs. `'confirmed-only'` steps the world once per confirmed tick without prediction or rollback. It still sends local input to the authority. Use it at any room size when the game can wait for confirmation, for example in a shared editor or when a world step is expensive. `'local-only'` steps the world once per confirmed tick without rollback, shows the local player from a game-supplied overlay that replays unconfirmed local inputs, and interpolates remote entities from confirmed frames when configured. Use it for large rooms or expensive world steps when the local player needs an immediate response. |
| `localPrediction` | in `'local-only'` | Required in `'local-only'`. Omit it in the other modes. See [Local-only prediction](#local-only-prediction). |
| `remoteInputPrediction` | no | `repeat-last` (default) repeats each remote slot's last confirmed input and is appropriate for held movement controls. Use `neutral` for pulse/edge command codecs so a confirmed one-shot is not repeated into speculative frames. |
| `localInputForTick` | no | `(slot: number, frame: number, context?: SyncplayLocalInputContext) => Input`. Supply a callback for per-tick inputs such as button presses. The runner reads it when it steps the local tick offline or schedules the input online, including during [catch-up](#input-during-catch-up). If you omit it, the runner uses the last `applyInput(...)` value. In networked `'local-only'` mode, `context` can contain the `remoteViewFrame` from the previous render. |
| `pacing` | no | Wall-clock pacing + clock-drift correction for the networked client, forwarded verbatim. Omit for the client defaults. |
| `inputDelay` | no | Local input delay for the networked client; `maxTicks > minTicks` auto-tunes from measured RTT. Forwarded verbatim; omit for the client default (0). |
| `requires` | no | `{ commands?, projection? }` — the runtime capabilities this game needs, forwarded to the offline session and to the networked client. `projection: true` on a runtime with no `project` throws `SYNCPLAY_PROJECTION_UNSUPPORTED`; `commands: true` on a runtime built without `decodeCommand` throws `SYNCPLAY_RUNTIME_COMMANDS_UNSUPPORTED`. Both checks run at session construction, not at the first command. |
| `diagnostics` | no | Sink for host notices, currently the deprecation notice each compatibility method emits. One notice per key per runner. Omit it to print the notice with `console.warn`. Pass `null` to disable notices. A sink failure cannot fail the session. This does not control terminal session failure reporting; see Session failure reporting. |
| `performanceDiagnostics` | no | `{ onUpdate?, onSnapshotTransfer? } \| null`. Opt-in observer for per-update tick counts and phase timings (`captureMs`, `checksumMs`, `restoreMs`, `projectionMs` accumulated since the previous `onUpdate` sample including between-update transport deliveries; `totalMs` for the synchronous `update()`/`pump()` call itself) and donor/joiner snapshot transfer timings (`hydrationResult` including `'decode-failed'`, `'state-mismatch'`, `'applied'`, `'donated'`). Also supported directly on `createNetworkedSyncplayClient`. `replayedTicks` counts every tick simulated again after a rollback, confirmed and predicted. A donor `mainThreadStagingMs` is the sum of the synchronous donor phases and does not include waits between slices. When omitted or `null`, the runner reads no clock for these timings and creates no samples. |
| `checkpointArchiveWorker` | no | `() => Worker`. Replays confirmed frames and exports donor checkpoints. See [Checkpoint archive Worker](#checkpoint-archive-worker). |
| `maxConfirmedFramesPerTurn` | no | Networked only, opt-in. The most authority-confirmed frames the client applies in one turn. A turn starts at each `update()` (each `pump`/`pumpPaced` call on a bare client) and lasts until the next one, so the messages between two updates share the budget. Frames past the budget stay queued in order and the next turn applies them first. A turn also runs at most one rollback, so it steps at most the budget plus one rollback resimulation (`maxPredictionTicks`) plus `pacing.maxStepsPerPump`. Absent (the default), every confirmed frame is applied in the message handler that delivers it. The confirmed state of every tick, every checksum, and every checksum report stay the same; only the turn changes. While frames are queued, `appliedThrough` counts applied frames only, so `caughtUp` stays false (and the status stays `syncing`) while more than `hardToleranceTicks` frames wait; checksum reports and hydration waiters run when their tick is applied; a hydration barrier for a queued tick waits for it instead of failing with `client.hydration-history-gap`; own input keeps flowing at the authority frontier. Queued frames hold no extra saves: with `snapshotRetention: 'required'` the client keeps the whole window only while it is behind at its confirmed frontier (applied plus queued frames), for example while the history of a reconnect still arrives. `netStats.queuedConfirmedFrames` shows the queue. The game must keep calling `update()`, and the budget times the update rate must be larger than the tick rate, or the client never catches up. It is not `maxCatchUpFrames`, which limits offline `update(deltaMs)` and throws. |
| `snapshotRetention` | no | Default: `'required'`, offline and networked (the networked client has the same default). `'required'` keeps only the saves the runner needs: offline, the current frame (skipping per-tick captures when the runtime supports sparse live stepping); networked, the live rollback frontier (adaptive rollback cadence may skip intermediate captures and keep the nearest rollback anchor at or below `appliedThrough`), plus cadence ticks, reported ticks, command ticks, and hydration/barrier ticks. While catching up or waiting for hydration, `'required'` captures sparsely (periodic anchors + cadence/barrier/batch-end ticks) and reconstructs past catch-up or barrier ticks on demand from the nearest retained anchor until caught-up pruning runs. With `maxConfirmedFramesPerTurn`, frames that wait in its queue are not a catch-up. Simulation results do not change. In Wreck Yard it cuts the retained saves from 256 to 1 offline and to ~11 per client networked. A networked read of a pruned older frame (`getConfirmedStateChecksum(frame)` for a frame that is not a report frame or an unpruned catch-up frame) fails with `client.checksum-unavailable`, as for a frame outside the window. Read `appliedThrough + 1` (the state after the last confirmed tick) or the frame after a checksum-cadence tick (`tick % checksumCadenceTicks === 0`, frame `tick + 1`); every client keeps or reconstructs those. `'window'` keeps a runtime save for every frame of the `snapshotBufferSize` window (256 by default); set it only if the game reads arbitrary pruned confirmed frames. |
| `checksumMode` | no | Replay checksum cadence for `exportReplay().checksums` (`'per-tick' \| 'interval' \| 'sparse' \| 'events-only'`). Defaults to `'events-only'` when `snapshotRetention` is `'required'` (the default), so adaptive rollback cadence can skip per-tick captures, and `'per-tick'` when `snapshotRetention` is `'window'`. Pass `checksumMode: 'per-tick'` explicitly when replay consumers require a checksum for every tick. |

Offline start options (`SyncplayRunnerOfflineOptions`): `identity`,
`sessionConfigBytes`, `playerCount`, `localSlot?`, `localSlots?`,
`botInputForTick?(slot, frame)`.

`localSlots` is shared-screen co-op: every listed slot is driven locally, and
`applyInput(input, slot)` targets one of them (`localSlot` is sugar for a single
entry). This is **offline only** — one connection is one seat is a room-server
seating invariant, so networked play stays single-seat.

### Local-only prediction

The runner still sends local input to the authority. The overlay changes only
what the game shows. Use `snapshot.localView` to draw the local player and
`snapshot.renderState` to draw remote entities.

Set all four fields. The runner supplies no defaults for them.

| Field | Type and meaning |
|---|---|
| `extractLocalBase` | `(confirmed: Readonly<Projection>, localSlot: number) => LocalBase`. Return the local player data and the data its movement needs from the latest applied confirmed projection. The runner makes a detached copy and freezes it recursively. |
| `predictLocal` | `(args: { readonly base: SyncplayDeepReadonly<LocalBase>; readonly confirmedThrough: number; readonly localSlot: number; readonly pending: readonly SyncplayPendingLocalInput<Input>[] }) => LocalView`. Start from `base` and replay `pending` in tick order. `confirmedThrough` is the last applied authority tick, one less than the base frame index. |
| `maxReplayTicks` | `number`. Use a non-negative safe integer. The runner supplies at most this many of the newest pending inputs, in tick order. Set it to `0` to supply an empty list. This limit applies only to the overlay. |
| `remoteInterpolationTicks` | `number`. Use a non-negative safe integer. Set it to `0` to show the latest confirmed projection. A positive value requires `presentation.interpolate`. The runner uses two adjacent confirmed frames at the requested delay when both are available. Its buffer holds up to 256 frames. If either frame is missing, the runner shows the latest confirmed projection. |

Build the base from plain objects, arrays, and primitive values other than
symbols. Use data properties with string keys. Class instances, functions,
accessors, maps, and typed arrays are invalid. Treat the base and pending input
as read-only. Keep `predictLocal` free of side effects. Do not read, step, or
change the live simulation world in this function. Return data for presentation
only. Keep this data out of simulation state, checksums, snapshots, and match
logs.

This example adds local prediction to a runner for one-dimensional movement.
Pass your runtime factory and input codec in `config`. Use the same movement
rule in the runtime and the overlay.

```typescript
import { createSyncplayRunner } from '@series-inc/rundot-syncplay';
import type { SyncplayRunnerConfig } from '@series-inc/rundot-syncplay';

type Pose = { x: number };
type Projection = readonly Pose[];
type Input = { dx: -1 | 0 | 1 };
type Config<Checkpoint> = SyncplayRunnerConfig<
  Projection, Input, Checkpoint, Projection, Projection, never, Pose, Pose
>;

export function createMovementRunner<Checkpoint>(
  config: Omit<Config<Checkpoint>, 'predictionMode' | 'localPrediction' | 'presentation'>,
) {
  return createSyncplayRunner<Projection, Input, Checkpoint, Projection, Projection, never, Pose, Pose>({
    ...config,
    predictionMode: 'local-only',
    localPrediction: {
      extractLocalBase: (confirmed, slot) => confirmed[slot],
      predictLocal: ({ base, pending }) => {
        let x = base.x;
        for (const { input } of pending) x += input.dx;
        return { x };
      },
      maxReplayTicks: 8,
      remoteInterpolationTicks: 2,
    },
    presentation: {
      project: (confirmed) => confirmed,
      interpolate: (before, after, alpha) => before.map(({ x }, slot) => ({
        x: x + (after[slot].x - x) * alpha,
      })),
    },
  });
}
```

The main package, `/browser`, and `/node` export these types:

| Type | Meaning |
|---|---|
| `SyncplayLocalPrediction<Projection, Input, LocalBase, LocalView>` | The four fields in `localPrediction`. |
| `SyncplayDeepReadonly<Value>` | The recursive read-only type of the detached base. |
| `SyncplayPendingLocalInput<Input>` | A pending input with `readonly tick: number` and `readonly input: Readonly<Input>`. |
| `SyncplayLocalInputContext` | The optional input callback context with `readonly remoteViewFrame: number`. |

`SyncplayPredictionMode` includes all three modes. The runner accepts
`LocalBase` and `LocalView` as its final type parameters. Both default to
`unknown`. `SyncplayRunner` and `SyncplayRunnerSnapshot` carry the
`LocalView` type.

The runner supplies the input context after its first networked local-only
render. The value can be absent during startup or after the local seat or
session generation changes. Offline and other prediction modes omit it.
Copy `remoteViewFrame` into the shot input. When the confirmed input applies,
pass that value as `rewindFrame` to the
[lag compensation validator](SYNCPLAY-LAG-COMPENSATION.md#rewind-to-the-displayed-frame).
Keep the target history in deterministic game state.
There are no large-room performance
measurements on a physical phone.

#### Start errors

| Error | Cause |
|---|---|
| `SYNCPLAY_LOCAL_PREDICTION_REQUIRED` | `predictionMode` is `'local-only'` and `localPrediction` is missing. |
| `SYNCPLAY_LOCAL_PREDICTION_MODE_INVALID` | The config supplies `localPrediction` with a mode other than `'local-only'`, including the default. The networked client also throws this error if code calls `getPendingLocalInputs()` outside `'local-only'`. |
| `SYNCPLAY_LOCAL_PREDICTION_LIMIT_INVALID` | `maxReplayTicks` or `remoteInterpolationTicks` is missing or is outside the range from `0` through `Number.MAX_SAFE_INTEGER`, inclusive. Both values must be integers. |
| `SYNCPLAY_LOCAL_PREDICTION_INTERPOLATOR_REQUIRED` | `remoteInterpolationTicks` is positive and `presentation.interpolate` is missing or is not a function. |
| `SYNCPLAY_LOCAL_PREDICTION_BASE_INVALID` | `extractLocalBase` returns unsupported data. The message includes the path to the invalid value or property. This can also occur when the runner extracts a later base. |
| `SYNCPLAY_CONFIRMED_PROJECTION_MISSING` | The runner has no confirmed projection to show, or the client lacks the checkpoint for a confirmed projection it needs to read. This can also occur after startup. |

### Snapshot

`subscribe(listener)` publishes a frozen `SyncplayRunnerSnapshot` on every status
or presentation change:

| Field | Meaning |
|---|---|
| `status` | `offline \| connecting \| syncing \| live \| stopped \| error` |
| `lifecycle` | A second vocabulary, and not a rename of `status`: `{ state: 'idle' \| 'starting' \| 'running' \| 'stopped' \| 'failed' \| 'disposed' }`. `starting` and `running` also carry `mode`; `running` carries `localSlots`, and a networked `running` also carries `connection`; `failed` carries `error`. `start()` succeeds only from `idle`, `stopped`, or `failed`, and from any other state throws a `SyncplayError` with code `runner.start-state-invalid`. `dispose()` moves to `disposed`, which is terminal. |
| `initialSyncComplete` | `false` at rest and while connecting or catching up to the first playable live frame; latches `true` once the first playable live state is reached (offline start, or first `live` networked frame). Remains `true` across mid-match `reconnecting` / `syncing` recovery and post-sync `failed` transitions, and resets to `false` on `stop()`, `dispose()`, or when a new `start()` / `restart()` begins. |
| `renderState?` | Present once a frame has been projected |
| `renderAlpha` | Interpolation alpha within the current frame |
| `localView?` | The game-supplied `LocalView` for the local player in networked `'local-only'` mode. Present when the runner has a local base and `predictLocal` returns a defined value. |
| `remoteViewFrame?` | A `number` in networked `'local-only'` mode after the runner renders. The nearest confirmed frame index to the remote pose shown. If the runner uses the latest confirmed projection, this is that projection's frame index. |
| `localSlot` | `-1` until the client is ready |
| `rollbackCount` | Cumulative client rollbacks. `0` offline and in both `'confirmed-only'` and `'local-only'`. |
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
| `'disconnected'` | **Terminal.** Teardown, `status: 'error'` carrying a `SyncplayError` (`SYNCPLAY_TRANSPORT_DISCONNECTED`) with `roomCode`, `cause`, and typed `code` from `SYNCPLAY_TRANSPORT_ERROR_CODES` (`transport.room-closed`, `transport.room-refused`, `transport.reconnect-exhausted`, or `transport.socket-failed`). |
| `'error'` | **Terminal** for `KICKED` (`transport.room-refused`) and `CRASH_UNRECOVERABLE` (`transport.room-closed`): teardown, `status: 'error'` carrying a `SyncplayError` with `roomCode`, `cause`, and the typed `code`. Any other server `room:error` is a warning: one with no code (for example, dropped messages), or one that rejects a single message (`RATE_LIMITED`, `MESSAGE_TOO_LARGE`, `INVALID_MESSAGE`, `INTERNAL_ERROR`, in `serverCode`). The room continues, the event has `warning: true`, and the runner keeps running. If the server then closes the socket, `'disconnected'` ends the run. With an SDK that predates error details, every `room:error` stays terminal with `transport.socket-failed`. |

Because a hard disconnect is terminal, **your game should offer an explicit
re-join action** on terminal `error` — call
`await runner.start({ mode: 'networked', connect })` again with a fresh connect
factory, or `await runner.restart(options)` to replace an active or pending run
without publishing an intermediate `stopped` or `idle` snapshot (while the new
run starts, `status` is `connecting` for a networked restart and `offline` for an
offline restart, and `lifecycle.state` is `starting`). `restart()` is
not atomic: it closes the existing session and transport first, then opens the
next connection. Starting any mode always tears down the previous one, and a
stale async connection or preparation closes without replacing the current
session. `startNetworked` and `startOffline` are deprecated compatibility
methods; they remain until major version 6 and cannot cancel startup.

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
} from '@series-inc/rundot-syncplay/creator'

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
- `seatHoldTicks`: Optional positive integer. When `recycleVacatedSeats` is `true`, holds a vacated seat exclusively for the departing player for `seatHoldTicks` authority ticks before releasing it to `rejoinRecords` for human backfill.

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
- When a human leaves a recyclable seat, the authority revokes that player's secret tokens immediately unless `seatHoldTicks` is configured, in which case secrets stay retained for the departing player during the hold window and are retired when the hold expires.
- A new player who claims a vacated seat does not receive the secrets or the roles of the previous player.

## Binary snapshots and baseline deltas

Snapshots use the `SYNSNP04` binary session envelope. Runtime bytes stay
binary. `SYNLZ401` applies LZ4-style block compression with RLE and LEB128
length extensions. This is a Syncplay format. It is not a standard LZ4 frame.

Capable transports send snapshot frames as binary `SYNWIR02` messages.
The room uses `binarySessionMsgType`, which defaults to `${sessionMsgType}-bin`.
A text-only transport uses the `synsnp04:` Base64 wrapper. Legacy JSON snapshot
decoding remains available. Binary transfer requires binary support through
both the game transport and the room host. A donor answers a snapshot request
on the channel that the request used: a text request gets a text transfer.

Text-encoded snapshot payloads and the `synsnp04:` wrapper require strict
canonical standard Base64 (no whitespace, non-standard alphabets, invalid
padding, or nonzero unused padding bits). `base64ToBytes` rejects non-canonical
or non-string input with a `SyncplayError` carrying code
`snapshot.invalid-base64`; the binary snapshot encoders
(`encodeBinaryDeterministicStateSnapshot` and `encodeSessionSnapshotOffThread`
when deriving the payload from string `runtimeBytes`) throw the same
`SyncplayError` code on non-canonical Base64 strings.

`baselineDelta` defaults to `true` on the network client. The client can use
runtime baseline hooks or compare serialized state with its tick-0 baseline.
The automatic codec uses 4 KiB pages and can encode changed cache lines.
It selects a delta only when that delta is smaller. The receiver checks the
baseline digest before reconstruction. Every peer must generate the same
baseline from the same seed, session configuration, runtime, and assets.
A changed serialized layout can reduce delta compression even when few game
cells changed.

Installed 3D runtimes can use native voxel deltas when the contributor has
capacity for a retained tick-0 checkpoint. The Teardown arena omits unchanged
chunks. It uses a bit mask for solid-to-air edits in eligible bricks.
CellularField3D sends changed chunks and the active-brick state needed to
continue simulation. Contributors without a baseline send full state.
The runtime checks the restored voxel roots before it installs the checkpoint.
For a Teardown arena, the SDK can save a bounded delta packet during capture.
It compresses that packet when it prepares a donation.
It uses the full frozen checkpoint if the compact
delta exceeds the preparation limit or belongs to a different baseline.

Set the wire limit in `deterministic.snapshots.maxBytes`. The room tells
a joiner its limit in `snapshot-offer` before it sends the first
chunk. It tells donors in `snapshot-request`. When the field is absent, the client uses 4 MiB.
You can omit the client `maxSnapshotBytes` option. A smaller client
value refuses snapshots that exceed it. A larger client value still
uses the room limit. A client that refuses a snapshot can fail to join.
The client option accepts whole numbers from 1 to 6,000,000 bytes.
An invalid limit in `snapshot-offer` fails the join. The client emits the
`snapshot.offer-limit-invalid` diagnostic.

Hosted rooms limit hydrated snapshots to 32 MiB, including physics page
diffs. For a larger hydrated image in a self-hosted room, set
`maxHydratedSnapshotBytes` on `createDeterministicAuthorityRoom` and its
clients. The wire limit applies to the compressed snapshot before the
text wrapper adds Base64.

Since 6.0.0-rc.122, a browser joiner uses the existing snapshot Worker
for binary LZMA snapshots with a decoded payload of at least 1 MiB
when that Worker is ready. The Worker decompresses the payload and
verifies its SHA-256 digest for version 3 snapshots. The client installs
the verified checkpoint and then applies the queued confirmed frames.
If the Worker is unavailable or stalls, the client decodes locally.
A joiner transfer sample sets `usedWorker` when the Worker decoded its
payload. `mainThreadStagingMs` omits time spent waiting for the Worker.

## Snapshot configuration

A room uses snapshots for these tasks.

| Job | Trigger |
|---|---|
| Late join, cold rejoin, spectator | With `join: "fresh"`, the room can ask a client for a snapshot at the newest fully reported tick. It waits up to `joinWaitSeconds`. With `join: "stored"`, the room serves its stored snapshot immediately. |
| Recovery record (worker crash restore, settlement retry, desync forensics, raid staging) | When the background timer expires, the room requests a snapshot for its recovery record. |
| History limit | The replay tail fills half of the history ring. This matters when the background timer is off or long. |

Set the options in the `deterministic.snapshots` object of the room in
`rooms.config.json`. This object is the only place for snapshot options. Every
key is optional. The room uses its tick rate to convert seconds to ticks.

Plain matches use `join: "fresh"` and `backgroundSeconds: 300` by default.
These defaults apply to new uploads, existing hosted bundles and local
previews. An explicit legacy cadence on a stored bundle still takes effect.

```json
{
  "rooms": [
    {
      "type": "arena",
      "deterministic": {
        "snapshots": {
          "backgroundSeconds": 60,
          "maxBytes": 4194304,
          "transferTimeoutSeconds": 10,
          "historyRetentionSeconds": 3600,
          "join": "stored"
        }
      }
    }
  ]
}
```

| Key | Range | Default | Change it when |
|---|---|---|---|
| `backgroundSeconds` | 0, or 10 to 3600 | 300 for plain matches. 60 for persistent rooms, raid rooms, rooms with simulation hooks, and rooms that select `join: "stored"`. | Set a positive interval to keep a recovery record. Persistent rooms and rooms with simulation hooks require a positive interval. |
| `maxBytes` | 65536 to 6000000 | 4194304 | Set the room wire limit for snapshot transfers. |
| `transferTimeoutSeconds` | 1 to 60 | 10 | Raise it when a background snapshot is large and donors are on slow links. |
| `historyRetentionSeconds` | 60 to 14400 | 216,000 ticks (one hour at 60 Hz) | Lower it to use less room memory. Raise it to keep match logs (`matchLog`) longer. |
| `join` | `"stored"` or `"fresh"` | `"fresh"` for plain matches. `"stored"` for persistent rooms, raid rooms, and rooms with simulation hooks. | Select `"stored"` to serve the available snapshot immediately. A raid room always uses `"stored"`. |
| `joinWaitSeconds` | 0.5 to 3 | 2 | The longest wait for a fresh snapshot before a join. This option requires the fresh join policy. |

A larger transfer takes more time at the same chunk rate. Allow time for
the donor to encode, send each chunk, and receive a reply. Hosted rooms
can skip cadence saves for large snapshots. A room can still send that
snapshot to a late joiner while the worker stays up. Crash recovery uses
the most recent record that storage accepted.

An unknown key inside `snapshots` is an error. A value outside its range is an
error. Upload rejects the config, and the room server and the dev server
reject the room at load; nothing falls back to a default.

**Fresh join.** A donor can take up to `joinWaitSeconds` before the room
admits the player. When the wait expires, the player joins with the
available snapshot or input history. The `syncplay_join_wait` and
`syncplay_catchup` logs record the wait and the replay plan.

With `join: "fresh"`, a first join, a cold rejoin and a spectator join each
ask the room before the room admits the player:

1. If the base the joiner would get is fresh, the join runs at once. This is
   the stored snapshot, or the replay from tick 0 in the first seconds of a
   room. A base is fresh when it is at most 4 s old or at most 240 ticks old,
   whichever is longer. Clients report a checksum every 120 ticks at any tick
   rate, so 240 ticks is two report intervals: 4 s at 60 Hz, 8 s at 30 Hz,
   12 s at 20 Hz and 24 s at 10 Hz.
2. If no tick inside that limit has a checksum report from every human
   client, if the room is in its retry wait (see below), or if no donor is
   left, the join runs at once with the stored snapshot. A connected client
   that does not report checksums therefore turns the fresh join off for that
   room. A game that sets `checksumCadenceTicks` above 240 gets the same
   limit, so a join late in its report cycle finds no fresh report and gets
   the stored snapshot with no wait.
3. Otherwise the room asks one donor with the same request as the
   background snapshot, and waits. The wait ends when the room stores a
   snapshot, when the transfer fails and no other donor is left to ask,
   when `joinWaitSeconds` passes, or when the room closes. A donor that
   refuses passes the request to the next donor at once. Players who join
   during a wait share it.

Then the ordinary join runs with whatever snapshot the room has stored. A
player that waits is not yet in the room: it holds no seat, the other players
do not see it, and no record of the room names it. If the room closes during
the wait, the join fails and the game can join again. A warm resume after a
socket drop never waits. The fresh join only moves the next snapshot request
earlier: the donor order, the transfer timeout and the retry wait are the
same as for the background snapshot. Each join logs `syncplay_join_wait`
with its mode, the outcome of its wait and the wait in milliseconds, and the
`syncplay_catchup` log of each join carries `joinOutcome` and `joinWaitMs`
(see `docs/syncplay-netcode-observability.md` in the venus repository).

The dev server runs the same wait, with the same outcomes and the same log
fields. A page that closes its socket during the wait is not admitted: the
join is cancelled, the room keeps no seat for it, and the same player can
join again at once. When the room starts to end during the wait (a close, a
drain, an idle end or a server shutdown), the join fails with `ROOM_CLOSING`
before the room saves, and the game can join again. When the wait ends, the
room checks the join again: a room that the creator held or locked, or that
blocked the player, during the wait refuses the join with the same error as
any join.

**Failed transfers.** When snapshot transfers keep failing (a state above
`maxBytes`, for one), the room asks each donor once per round, and after two
failed rounds it waits before it asks again, from 1 s up to 60 s. The room
counts this wait in simulation ticks, so a slow server makes it longer in
wall-clock time, and the cap is no deadline for a usable recovery record. A
client that joins, reconnects or reloads during the wait gets one request. When
the wait ends, the room asks again at once if a snapshot is still due; it does
not wait for a new checksum report.
A donor refusal or a transfer timeout counts as a failed attempt.
The donor sends at most two 256 KiB chunks per tick. At a 5 Mbit/s upload
rate, a 6,000,000-byte snapshot takes about 9.6 s in binary or 12.8 s as
Base64 text. These times exclude encoding and protocol overhead. The text
transfer alone exceeds the default 10 s transfer timeout. Both transfers
exceed the 3 s maximum wait for a `fresh` join. If the transfer is still
pending when the wait expires, the join ends as `wait-elapsed` and uses
the stored snapshot if one exists. Raise `transferTimeoutSeconds` when
you set a large `maxBytes`.

Automatic crash recovery saves skip records above 900,000 bytes, including
the snapshot and its input tail. A room with a record above that limit
can keep its snapshot in memory for joins. After a crash, it restores
its last saved record or starts a new room if it has none. A shutdown or
admin save can still store a larger record if it fits the worker and
storage limits.

**Reloaded clients.** A client that reloads and takes its seat over gets the
stored snapshot and the tail after it. When the history ring no longer keeps
that whole tail, the room cannot catch the client up. It refuses it: the room
sends an `error` message with code `history-unavailable` and closes the
connection with code 4003. The room refuses a client that comes back on a new
socket the same way when the ring no longer keeps the frames it missed. After a server crash recovery, a player
that joined after the room's last saved record is unknown to the restored room: a resume or a reload gets an
`error` with code `unknown-player` and the same close code 4003. A player that the room evacuated gets an `error` with
code `E_PARTICIPANT_EVACUATED` and close code 4003 when it comes back. The SDK room then ends with no resume attempt,
`whenReady()` rejects with a `SyncplayError`, `pump()` throws it, and the room
transport of `createSyncplayRoom`, `joinSyncplayRoomByCode` and
`quickMatchSyncplayRoom` emits a connection event `{ kind: 'error' }`. The game
can join the room again.

**Recovery with `backgroundSeconds: 0`.** `0` turns off periodic snapshot
requests. The room can request a snapshot for a fresh join or when the replay
tail fills half of the history ring (`historyRetentionSeconds`). A late join
or desync resync replays from the latest available snapshot or from tick 0.
Crash recovery needs a saved record. The first record needs a stored snapshot.
The room server writes that snapshot and the input tail at its own save
interval. The snapshot advances when the room stores another snapshot.
Persistent rooms and rooms with `simulationHooks` require a background timer.

**Removed keys (breaking in 6.0.0-rc.99).** The snapshot keys under the room
`config` object are removed. A room that sets one fails at upload, at the SDK
build and in the dev server, with an error that names the replacement. Move each
value into `deterministic.snapshots` and convert ticks to seconds (divide by the
room `tickRateHz`).

A game that was published before 6.0.0-rc.99 with these keys keeps running: the
room server reads them from the stored bundle with their earlier values. The
next upload or build of that game must use `deterministic.snapshots`. A later
release removes this acceptance.

Each removed key and its replacement:

| Removed key | Replacement | Edit |
|---|---|---|
| `config.snapshotCadenceTicks` | `deterministic.snapshots.backgroundSeconds` | `"snapshotCadenceTicks": 3600` at 60 Hz becomes `"backgroundSeconds": 60` |
| `config.transferTimeoutTicks` | `deterministic.snapshots.transferTimeoutSeconds` | `"transferTimeoutTicks": 600` at 60 Hz becomes `"transferTimeoutSeconds": 10` |
| `config.historyRetentionTicks` | `deterministic.snapshots.historyRetentionSeconds` | `"historyRetentionTicks": 216000` at 60 Hz becomes `"historyRetentionSeconds": 3600` |
| `config.maxSnapshotBytes` | `deterministic.snapshots.maxBytes` | Move the number unchanged: `"maxSnapshotBytes": 1000000` becomes `"maxBytes": 1000000` (65536 to 6000000) |
| `config.maxHydratedSnapshotBytes` | none | Delete the key. The room keeps its 32 MiB hydrated ceiling. |

A room with `deterministic: true` that sets a removed key changes to the
object form, for example
`"deterministic": { "snapshots": { "backgroundSeconds": 30 } }`. The new
ranges apply: a cadence below 10 seconds or above an hour, and a retention
below one minute or above four hours, are errors.

Telemetry: the room server `syncplay_catchup` log reports `source`
(`stored-snapshot` or `history`), `snapshotAgeTicks`, and `tailFrames` (the
tail length in ticks). A refused reload logs `syncplay_join_rejected`.

## Donor snapshot changes in 6.0.0-rc.101

- The async donor path is on by default. Set `asyncDonorSnapshot: false`
  to use the synchronous path.
- An installed 3D physics donor can send a native transfer image without
  inner LZMA. Pure physics runtimes can use `physics-page-diff`. This mode
  uses the tick-0 native transfer image as its baseline. The SDK prepares
  that baseline at session start, including for clients with
  `baselineDelta: false`. The latter can send full snapshots and receive
  physics page diffs. The Worker can
  use outer LZMA (compression code 2). Update the room and clients together.
  A room on the previous release cannot restore a record that contains
  compression code 2 or a physics page diff. The off-thread encoder can
  report compression code 2 in its result.
- The encoder can transfer a buffer on the first Worker job when you set
  `transferInputAfterWorkerStart`. Pass a buffer only if the Worker can
  take ownership of it.
- A snapshot request can include `transferBudgetMs`. A request without
  this field uses a 10-second budget. The room sends the timeout for the
  pending transfer. The room applies this timeout to the transfer.
- Since 6.0.0-rc.112, a snapshot request also carries `maxSnapshotBytes`,
  the largest binary snapshot the room stores, when that limit is not the
  default 4 MiB. A request without the field means the default, so the
  messages of a room at the default limit do not change. A donor without a Worker
  uses the smaller of that limit and its own `maxSnapshotBytes` to choose
  its payload. A room that refuses a transfer as too large sends the
  donor a `snapshot-refusal` message (wire code 5) with the reason and the
  limit. The donor stops that upload and emits `snapshot.refused`. An
  older client ignores both additions.
- Since 6.0.0-rc.120, sliced preparation for installed 3D physics donors
  without cellular fields and for archive donations uses a fixed work
  budget per local frame. Set `donorSnapshotBudgetMs` to change it. The
  default is 2 ms. If preparation reaches the transfer deadline, the
  client cancels the work, refuses the donation, and reports
  `snapshot.worker-failed`. The deadline still applies if the encoding
  Worker is unavailable and the client uses local slices. Timer throttling
  can leave too few local frames to finish.
- Other sliced donors can increase their work budget per frame based on
  progress and the time left. The client estimates compressed size to
  reserve time for chunk pacing, two frame intervals, and the measured
  round-trip time. Before the first RTT sample, the network budget is
  150 ms. These donors can finish encoding after the room deadline, and
  a large final slice can delay a frame. The room can refuse a late upload.
- The diagnostic sink can receive `snapshot.donor` events. These events
  include changes between the Worker and sliced paths, encode failures,
  slow phases, and pin release failures. The default
  `donorSnapshotWarnMs` threshold is 8 ms. A slow fallback phase includes
  the reason "no Worker available". Set `diagnostics: null` to disable
  these events. An expired or cancelled Worker job stops the shared
  Worker. The next job can start a new Worker.

The client retains the exact confirmed checkpoint in the donor request.
A game can supply `pinSnapshot` to hold immutable state and release it after
encoding. A game can also supply `serializeStateAsync`. Keep synchronous
work in these hooks short. The client cannot pause a synchronous serializer.
The Worker prepares the snapshot and its upload chunks.
`encodeSessionSnapshotOffThreadDetailed()` reports whether it used a Worker.

## Checkpoint archive Worker

Pass `checkpointArchiveWorker` to `createSyncplayRunner` or
`createNetworkedSyncplayClient` to offload on-demand donor checkpoints.
It is off by default. The default donor path can already encode
snapshots in a built-in Worker. The archive keeps a second simulation
and replays confirmed frames even when the room has no snapshot request.

```ts
const checkpointOptions = {
  checkpointArchiveWorker: () =>
    new Worker(new URL('./syncplay-checkpoint.worker.ts', import.meta.url), { type: 'module' }),
};
```

In `syncplay-checkpoint.worker.ts`, call `installCheckpointArchiveWorker`
before loading the game's simulation asynchronously. Use the same runtime
factory as the main thread. The installer is exported from
`@series-inc/rundot-syncplay`, `/browser`, and `/node`.

```ts
import { installCheckpointArchiveWorker } from '@series-inc/rundot-syncplay/browser';

installCheckpointArchiveWorker(self, async (identity, sessionConfigBytes) => {
  const { createRuntime } = await import('./simulation-runtime');
  return createRuntime(identity, sessionConfigBytes);
});
```

**Archive Worker.** The Worker keeps confirmed inputs, commands, and seats
with portable checkpoints. It replays to the requested frame, checks the
result against the client's reported checksum, and exports the checkpoint.
The client uses it when the runtime supports async checkpoint
donation, `asyncDonorSnapshot` is enabled, and the game supplies neither
`pinSnapshot` nor `serializeStateAsync`. If the archive cannot provide the
requested checkpoint and the client still retains it, the client tries the
normal local donation path. This is also the default path without the option.

In 6.0.0-rc.124, remove `checkpointChecksumWorker` from your client
configuration. Syncplay reports confirmed checksums on the main thread.

## Owned 3D checkpoint donations in 6.0.0-rc.104

For a game that manages its own 3D checkpoint handles, add
`stateStorage.serializeStateAsync`. Pass its `work` argument to
`world.serializeCheckpointAsync`. Keep the synchronous serializer for
local exports. The installed 3D physics adapter manages its own transfer
path.

A game that keeps a `sim` object with `encode` and `decode` methods
has this hook.

```ts
serializeState: (save) => sim.encode(save),
```

Add the async hook.

```ts
serializeState: (save) => sim.encode(save),
serializeStateAsync: (save, work) => sim.encodeForDonation(save, work),
```

Add `encodeForDonation` to the game's simulation class. It uses the same
game packet as `encode`. This program runs both serializers and restores
the async export on the same runtime.

<!-- syncplay-example: owned-checkpoint-donation -->
```typescript
import {
  createInstalledRuntimeAdapter,
  type KinetixRuntimeIdentity,
  type SnapshotSerializationWork,
} from '@series-inc/rundot-syncplay/core/runtime'
import {
  createPhysicsWorld3D,
  initPhysics3D,
  type PhysicsCheckpoint3D,
  type PhysicsWorld3D,
} from '@series-inc/rundot-syncplay/physics/3d'

interface GameSave { readonly frame: number; readonly physics: PhysicsCheckpoint3D }

class GameSim {
  frame = 0
  revision = 0n

  constructor(readonly world: PhysicsWorld3D) {}

  encode(save: GameSave): Uint8Array {
    return this.pack(save.frame, this.world.serializeCheckpoint(save.physics))
  }

  // The donor's async export. Pass `work` to the world unchanged.
  async encodeForDonation(save: GameSave, work?: SnapshotSerializationWork): Promise<Uint8Array> {
    const image = await this.world.serializeCheckpointAsync(save.physics, work)
    const pack = () => this.pack(save.frame, image)
    return work?.measureGamePacket ? work.measureGamePacket(pack) : pack()
  }

  decode(frame: number, bytes: Uint8Array): GameSave {
    if (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) !== frame) {
      throw new Error('Game packet frame does not match')
    }
    // importCheckpoint accepts the synchronous and the async physics encoding.
    return { frame, physics: this.world.importCheckpoint(bytes.subarray(4)) }
  }

  private pack(frame: number, image: Uint8Array): Uint8Array {
    const bytes = new Uint8Array(4 + image.byteLength)
    new DataView(bytes.buffer).setUint32(0, frame, true)
    bytes.set(image, 4)
    return bytes
  }
}

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, capacity: { bodies: 4, joints: 0, checkpoints: 16 } })
const sim = new GameSim(world)
const identity: KinetixRuntimeIdentity = {
  abiVersion: 1,
  tickRate: 60,
  inputSchemaId: 'owned-donation-input-v1',
  stateSchemaId: 'owned-donation-state-v1',
  deterministicVersion: 'owned-donation-rc112',
  engineIdentityHash: 'b'.repeat(64),
}
const lease = createInstalledRuntimeAdapter<number, boolean, never, number, GameSave>({
  identity,
  sessionConfigBytes: Uint8Array.of(1),
  step() { world.step(); sim.frame += 1; sim.revision += 1n },
  stateStorage: {
    kind: 'owned',
    checkpointBudget: { maxLiveCheckpoints: 8, maxAdvanceBatch: 2, importScratch: 1 },
    captureState: () => ({ frame: sim.frame, physics: world.captureCheckpoint() }),
    restoreState(save) { world.restoreCheckpoint(save.physics); sim.frame = save.frame; sim.revision += 1n },
    releaseState(save) { world.releaseCheckpoint(save.physics) },
    inspectState: (save) => save.frame,
    frameOf: (save) => save.frame,
    readLiveRevision: () => sim.revision,
    serializeState: (save) => sim.encode(save),
    serializeStateAsync: (save, work) => sim.encodeForDonation(save, work),
    hydrateState: (frame, bytes) => sim.decode(frame, bytes),
    // Hash the physics part with digestCheckpoint, not with serializeCheckpoint output.
    checksumStateBytes(save) {
      const bytes = new Uint8Array(12)
      new DataView(bytes.buffer).setUint32(0, save.frame, true)
      new DataView(bytes.buffer).setBigUint64(4, world.digestCheckpoint(save.physics), true)
      return bytes
    },
  },
})

const runtime = lease.runtime
const checkpoint = runtime.capture()
const pin = runtime.pinCheckpointSnapshot!(checkpoint)
const donated = await pin.serialize()
pin.release()
const restored = runtime.hydrateCheckpoint(0, donated)
if (runtime.wireChecksum(restored) !== runtime.wireChecksum(checkpoint)) {
  throw new Error('The async export did not restore the same state')
}
runtime.release(restored)
runtime.release(checkpoint)
await lease.dispose()
world.dispose()
```

Import `SnapshotSerializationWork` from `@series-inc/rundot-syncplay/core/runtime`.
Keep `hydrateState` on the same packet format. The game's `decode`
reads the game state and keeps the physics bytes.
On restore, `world.importCheckpoint` accepts either physics encoding.
Use `world.digestCheckpoint` for the physics part of
`checksumStateBytes` and `stateCommitment`. Hashing the output of
`serializeCheckpoint` can give different checksums for a native handle
and a handle imported from a transfer.

Staging copies a frozen image out of WASM before the first yield. This
cost grows with image size. Allow about 0.7 ms per MB based on the staging
measurements. WASM holds a serialization buffer and a transfer buffer
at the same time. Budget about two image sizes for those buffers, plus
temporary decode memory, allocator overhead, and retained checkpoints.
JavaScript holds its own image after the copy.

The Worker compresses the full game packet with LZMA. This transfer
requires no tick-zero export. The payload checksum covers the bytes
before compression.

Without a Worker, the client encodes in main-thread slices with LZ4.
LZ4 makes a staged image 2 to 3 times larger than the synchronous
export, which WASM already compressed. When no Worker can start, the
donor first encodes the staged image in slices. It sends that snapshot
when it fits the room's limit from the snapshot request and the
client's own `maxSnapshotBytes`, if set. Only when the sliced
snapshot is over the smaller limit does the donor run its synchronous
`serializeState` export, which is one main-thread task.
`snapshot.worker-unavailable` gives the stored size and the payload
size, and says when the donor used the synchronous export. Each later
use emits `snapshot.synchronous-export`. If a Worker stops during a
job, the client retries the same staged payload with LZ4 in slices. A
Worker that does not report ready within 5 seconds counts as a Worker
that cannot start. A cancel before that time cancels only the job.

Set `stateStorage.maxSnapshotBytes`, if used, to a hydrated size.
It covers the full game packet and the raw native image. The room
and client wire limits apply to the compressed transfer.
See the [migration guide](SYNCPLAY-RC1-MIGRATION.md#owned-3d-checkpoints-in-600-rc104).

A generic owned runtime (`stateStorage.kind: 'owned'`, without the
installed 3D physics adapter or a runtime delta hook) sends full
snapshots only, on every donation path. It keeps no frame-0 baseline and
no frame-0 pin, so its checkpoint budget is
`snapshotBufferSize + maxAdvanceBatch + importScratch`. Peers of one
room can use different serializers and options, and every peer can
apply every stored snapshot. Run every peer of a room on 6.0.0-rc.112 or
later: a page diff from an older peer fails with
`client.snapshot-owned-delta-unsupported`. The installed 3D physics
adapter, voxel runtimes, and JavaScript runtimes keep their page diffs.

The full snapshot costs bytes where a page diff was smaller. Stored
text bytes in the 743-body test worlds at tick 600: mostly static
104,085 (page diff 90,045), dynamic pile 312,089 (page diff 312,741),
one body 2,757 (page diff 2,977). A staged donation was already full.
A large state costs more: a 64x64x64 voxel cave (524 KB raw) stores a
362,536-byte full snapshot against a 12 to 30 KB page diff, and a full
snapshot of an 8.4 MB cave is 5,647,866 bytes, over the 4 MiB default
room limit. For a large owned state, give `stateStorage` the explicit
runtime delta hooks (`captureBaselineDigest`, `serializeBaselineDelta`,
`hydrateBaselineDelta`). Such a runtime is not a generic owned runtime
and keeps its runtime-hook deltas.

The client sends `snapshot.donation` to the existing `diagnostics` sink
after it prepares a donation. Read the `snapshotDonation` field.

| Field | Value |
|---|---|
| `tick` | Confirmed tick in the donor request. |
| `wireMode` | `full`, `page-diff`, `physics-page-diff`, or `runtime-hook`. |
| `encoding` | `worker`, `sliced`, or `synchronous`. |
| `nativeSerializationMs` | Time in the 3D native checkpoint export. The synchronous export includes native compression. |
| `gameSerializerMs` | Time in the synchronous part of the serializer, excluding the native export. Use `work.measureGamePacket` for packet work after an await. |
| `compressionMs` | Time compressing the page diff or outer snapshot. |
| `digestMs` | Synchronous time hashing the native section, baseline, and snapshot payload where applicable, on the main thread or the Worker. For a Web Crypto digest, it counts only the call and the hex encoding. |
| `digestWaitMs` | Elapsed time while the main thread or the Worker waits for a Web Crypto digest. The browser hashes off that thread, and the wait includes event-loop delay. It is not work on that thread and is not part of `longestMainThreadTaskMs`. |
| `longestMainThreadTaskMs` | Longest measured donor phase or slice on the main thread. |
| `rawBytes` | Bytes returned by the serializer, before the outer encoder runs. |
| `outputBytes` | Encoded binary snapshot bytes, before upload framing or Base64. |

A serializer that takes more than one room frame before its first
yield emits `snapshot.slow-serializer` once for that donation. This
includes the synchronous work in an async hook. The message gives the
time. It names `serializeStateAsync` only for an owned runtime on the
async donor path, because only that path calls the hook. A donor phase
longer than `donorSnapshotWarnMs` emits `snapshot.slow-phase` once for
that donation. The two warnings are independent, so one donation can
emit both. The default sink prints the warnings.
Set `diagnostics: null` to disable events.

A synchronous donor build or send error reaches the caller. Other async
errors can stop the client generation. The `ready` value becomes false.
Calls to `pump()` then report that failure. Worker failure and deadline
refusals let the generation continue.

Snapshot size and join time depend on content, serialization layout,
network conditions, device, and hydration cost.

## Session failure reporting

A local deterministic generation can fail while the room socket stays open:
for example, rollback asks for a frame that is no longer retained, or a
runtime checkpoint cannot be captured. The networked client reports at most
one such terminal failure per generation through the transport's optional
`reportSessionFailure` callback. This is separate from `reportSessionError`,
which remains the room-refusal and room-close path.

Pass `reportSessionFailure` in `SyncplayRoomOptions` or
`JoinSyncplayRoomOptions`, or implement it on a custom
`NetworkedClientTransport`. The payload is a `SyncplaySessionFailure`: the
original `error`, bounded name/code/message/stack and causes, the operation,
generation, room code, local slot, applied/predicted/authority ticks,
requested frame when known, and the retained-frame range when available.
Use `serializeSyncplaySessionFailure(failure)` to pass only bounded plain
data to a logger.

`openSyncplayBrowserRoom` installs a default reporter that calls
`RundotGameAPI.error` when that method is available. Pass
`reportSessionFailure` in its options to replace the default, or pass
`reportSessionFailure: null` to disable it. `diagnostics: null` does not
disable session failure reporting. A reporter that throws cannot change the
session or replace the original error.

A published game receives this reporting only after it rebuilds on SDK and
Syncplay packages that contain it.

## Deterministic room settlement

Configure simulation-backed durable settlement with `deterministic.simulationHooks`:

- `bootstrap`: Boolean. Bootstraps durable simulation state on create and restore before joins (`persistent: true` rooms only).
- `settleRecipeId`: String. Simulation recipe run at settlement boundaries.
- `settlementTarget`: Required `'players'`. Settlement runs only with `settlementTarget: 'players'`, on both persistent and non-persistent deterministic rooms. A config that omits `settlementTarget` or sets `'room'` fails validation and does not settle.
- `settleOnPlayerLeave`: Optional boolean. When `true`, settles a departing player on final room leave with no report inputs (when leaving before quorum or after no-quorum) and skips that player at later quorum with no top-up.
- `maxSettlementEpochs`: Removed. Delete this key. Upload and room load reject it. A room allows one paid run per room generation. A seat reconfigure starts a new generation and opens a new run.

Configure settlement quorum on the `deterministic` room object:

- `quorumPolicy`: Optional `'unanimous' | 'two-thirds'`. Omit to use the seat-capacity default: rooms with 4 or fewer seats use `'unanimous'`, and rooms with 5 or more seats use `'two-thirds'`.
- `quorumTimeoutMs`: Optional integer milliseconds (`1` to `300000`, default `10000`). Voting round timeout for `'two-thirds'` quorum.
- `quorumMinimum`: Optional integer (`1` to room seat capacity, default `4`). Minimum matching reports required for `'two-thirds'` quorum, capped at the run participant count.

A settlement recipe must follow these rules:

- Set `serverOnly: true`, `scope: 'player'`, and literal `duration: 0`.
- Use only six effects: `add`, `multiply`, `min`, `max`, `grant_rewards`, and `compute`.
- Use no randomness, no `{{` templates, no `inputs.wallet`, and no `outputs.rolls`.
- Every guard must be an object with a non-empty string `formula`, and every `blockedWhen` entry must carry a non-empty string `entity`.
- Every entity-change triggered recipe reachable from the settlement recipe must follow the same rules (except `serverOnly`).

Clients in a networked room submit per-run settlement outcomes over `SyncplayRoomTransport.reportSettlement(report)`:

- `report.runId`: Optional `[A-Za-z0-9._:-]{1,64}` identifier used to group peer reports for the active run.
- `report.roomInputs`: Optional plain JSON object passed as shared recipe inputs.
- `report.playerInputs`: Optional map of `profileId` to plain JSON objects for per-player recipe inputs.
- All reported inputs must contain plain JSON values with finite numbers, maximum nesting depth 16, and no `__proto__`, `constructor`, or `prototype` keys.
- Under `'unanimous'` quorum, settlement runs once every live seated human peer (and any active seat-hold claimant) submits an identical canonical report for the open run.
- Under `'two-thirds'` quorum, a voting round opens once at least `ceil(seatedHumans / 3)` seated humans report. The round freezes the electorate and decides when matching voter-key reports reach `max(ceil(2 * v / 3), min(quorumMinimum, runParticipants))`. Supporters and silent voters receive the majority inputs; dissenters and non-voters receive no report inputs. If the round cannot reach quorum or times out, reporting closes for that run and players settle at leave and dispose with no report inputs.
- Subscribe to `transport.onSettlementRejected(handler)` before reporting outcomes. It returns an unsubscribe function. The handler receives `{ runId, reason, counts? }`. A report sent after the current generation's run closes delivers `reason: 'epoch-not-active'`. A report rejected by a failed voting round delivers `reason: 'no-quorum'` with optional `counts: { electorateSize, threshold, reported }`. For backward compatibility with pre-`6.0.0-rc.133` clients, the server sends wire `reason: 'run-limit'` with `detail: 'epoch-not-active' | 'no-quorum'`, which `6.0.0-rc.133+` transports promote to `event.reason` (and older clients receive as `'run-limit'`).
- On room dispose, any unsettled participant in the open run still settles under that run without minting a new run. A persistent room restores pending retries across restarts. Local `dev-authority-room` does not run server-side two-thirds quorum timers; test quorum policies against `mp-room-server`.
