# Syncplay: migrate beta builds to RC1

Syncplay API v1 is the release-candidate physics contract. It has one 2D API
and one 3D API. Both APIs use the Syncplay C++ core compiled to WASM. No
TypeScript physics solver or silent fallback is present.

Use this guide when your game uses Syncplay `5.23.0-beta.7` through
`5.28.0-beta.5`. It covers runtime and physics changes.

## Required changes

Apply each change that affects your game.

| Beta behavior | RC1 action |
| --- | --- |
| Physics came from the root, `/browser`, `/creator`, `/node`, `/debug`, or `/core/*` | Move physics to `/physics/2d` or `/physics/3d`. |
| The installed runtime adapter used `createState` | Supply `captureState`, `restoreState`, `frameOf`, and `step`. |
| A saved checkpoint used the old unversioned runtime codec | Migrate it offline with `migrateLegacyRuntimeCheckpoint`. |
| Code used `confirmedStateChecksum(frame)` | Use `getConfirmedStateChecksum(frame)`. |
| Code used `startOffline()` or `startNetworked()` | Use `await runner.start(...)`. |
| The game saved a beta physics checkpoint or replay | Do not load it in RC1. Change the deterministic version and start new history. |

## Migrate installed runtime state

Replace the removed `createState` option with explicit state ownership.

<!-- syncplay-example: installed-runtime-state-migration -->
```typescript
import {
  createInstalledRuntimeAdapter,
  type KinetixRuntimeIdentity,
} from '@series-inc/rundot-syncplay/core/runtime'

interface State { readonly frame: number; readonly total: number }
interface Input { readonly value: number }

const identity: KinetixRuntimeIdentity = {
  abiVersion: 1,
  tickRate: 60,
  inputSchemaId: 'counter-input-v1',
  stateSchemaId: 'counter-state-v1',
  deterministicVersion: 'counter-rc1',
  engineIdentityHash: 'a'.repeat(64),
}
const sessionConfigBytes = Uint8Array.of(1)
let state: State = Object.freeze({ frame: 0, total: 0 })

const runtime = createInstalledRuntimeAdapter<State, Input>({
  identity,
  sessionConfigBytes,
  captureState: () => state,
  restoreState: (next) => { state = next },
  frameOf: (selected) => selected.frame,
  step: (inputs) => {
    state = Object.freeze({
      frame: state.frame + 1,
      total: state.total + inputs.reduce((sum, input) => sum + input.value, 0),
    })
  },
  capturedStateIsDetached: true,
  projectState: (selected) => selected,
})

if (runtime.identity.deterministicVersion !== 'counter-rc1') {
  throw new Error('Runtime identity did not match')
}
```

The runtime reports `KINETIX_RUNTIME_CREATE_STATE_REMOVED` when a caller still
uses `createState`.

## Migrate runtime checkpoint bytes

The default runtime checkpoint codec writes `KRTCP002`. Normal hydration
rejects the old unversioned format. Migrate stored checkpoints offline before
a session starts.

<!-- syncplay-example: checkpoint-migration -->
```typescript
import {
  kinetixRuntimeCheckpointCodecFormat,
  migrateLegacyRuntimeCheckpoint,
} from '@series-inc/rundot-syncplay/core/runtime'

const legacy = new TextEncoder().encode('{"score":2,"tick":0}')
const migrated = migrateLegacyRuntimeCheckpoint(legacy)
const header = new TextDecoder().decode(migrated.subarray(0, 8))
if (header !== kinetixRuntimeCheckpointCodecFormat) {
  throw new Error('Checkpoint migration did not produce the current format')
}
```

The helper accepts canonical legacy JSON data. It rejects tagged values and
byte-shaped objects when it cannot recover the original type.

## Checksum inspection

Use `client.getConfirmedStateChecksum(frame)` to read a retained confirmed
checkpoint. This call does not change live state or retained history.

The deprecated `confirmedStateChecksum(frame)` name performs the same read. Do
not add new calls to that name.

## Runner lifecycle and runtime ownership

Use `await runner.start(...)` for offline and networked sessions. The runner
reports its current state through `runner.lifecycle`.

```typescript
await runner.start({
  mode: 'offline',
  identity,
  sessionConfigBytes,
  playerCount: 1,
})
```

```typescript
await runner.start({
  mode: 'networked',
  connect: (signal) => openRoom(signal),
})
```

The old `startOffline()` and `startNetworked()` methods are deprecated. Do not
add new calls to them.

## Deprecated API register

This table is generated from the package deprecation register.

<!-- api-deprecations:start -->

| Old name | Replacement | First deprecated | Earliest removal major | Simulation profile effect |
| --- | --- | --- | --- | --- |
| `confirmedStateChecksum` | `getConfirmedStateChecksum` | 5.28.0-beta.4 | 6 | none |
| `startOffline` | `await runner.start({ mode: 'offline', ... })` | 5.28.0-beta.4 | 6 | none |
| `startNetworked` | `await runner.start({ mode: 'networked', connect })` | 5.28.0-beta.4 | 6 | none |

<!-- api-deprecations:end -->

<!-- api-v1-migration-inventory:start -->
## Exact published symbol coverage

This generated summary covers 1343 surface-symbol records across 37 published versions.
The bound JSON inventory lists each symbol and compact version index ranges.
A symbol that is not in a preserved list uses the default action for its row.
Regenerate this section from `packages/syncplay` with `node scripts/check-api-v1-contract.mjs --write-migration-guide`.

| Old surface | Symbols | Preserved | Default action | Target |
| --- | ---: | ---: | --- | --- |
| `.` | 149 | 19 | Replace the call or remove it. | `./physics/2d` or `./physics/3d` |
| `./browser` | 139 | 19 | Replace the call or remove it. | `./physics/2d` or `./physics/3d` |
| `./core` | 54 | 0 | Remove. This surface is internal. | `./physics/3d` |
| `./creator` | 88 | 0 | Replace the call or remove it. | `./physics/2d` or `./physics/3d` |
| `./node` | 6 | 0 | Replace the call or remove it. | `./physics/3d` |
| `./debug` | 3 | 0 | Replace the call or remove it. | `./physics/3d` |
| `./core/physics` | 719 | 0 | Remove. This surface is internal. | `./physics/3d` |
| `./core/physics2d` | 120 | 0 | Remove. This surface is internal. | `./physics/2d` |
| `./core/physics2d-owned` | 47 | 0 | Replace the call or remove it. | `./physics/2d` |
| `./core/world` | 18 | 0 | Replace the call or remove it. | `./physics/3d` |

### Preserved symbols

Keep these imports at `.`:
- `DeterministicKccBody3D`
- `DeterministicKccCarrierPose3D`
- `DeterministicKccCarryResult3D`
- `DeterministicKccCarryState3D`
- `DeterministicKccCollisionCandidate3D`
- `DeterministicKccCollisionFilter3D`
- `DeterministicKccExternalImpulse3D`
- `DeterministicKccGeometry3D`
- `DeterministicKccInput3D`
- `DeterministicKccJumpTuning3D`
- `DeterministicKccPhysicsImpulse3D`
- `DeterministicKccProcessor3D`
- `DeterministicKccStepResult3D`
- `DeterministicKccWorld3D`
- `DeterministicMovingPlatform3D`
- `DeterministicSlope3D`
- `DeterministicStep3D`
- `stepDeterministicCarry3D`
- `stepDeterministicKcc3D`

Keep these imports at `./browser`:
- `DeterministicKccBody3D`
- `DeterministicKccCarrierPose3D`
- `DeterministicKccCarryResult3D`
- `DeterministicKccCarryState3D`
- `DeterministicKccCollisionCandidate3D`
- `DeterministicKccCollisionFilter3D`
- `DeterministicKccExternalImpulse3D`
- `DeterministicKccGeometry3D`
- `DeterministicKccInput3D`
- `DeterministicKccJumpTuning3D`
- `DeterministicKccPhysicsImpulse3D`
- `DeterministicKccProcessor3D`
- `DeterministicKccStepResult3D`
- `DeterministicKccWorld3D`
- `DeterministicMovingPlatform3D`
- `DeterministicSlope3D`
- `DeterministicStep3D`
- `stepDeterministicCarry3D`
- `stepDeterministicKcc3D`

See the [bound published symbol inventory](https://github.com/series-ai/venus/blob/develop/packages/syncplay/api-v1-published-physics-inventory.json) for every removed or internal symbol.
<!-- api-v1-migration-inventory:end -->

## Replace the import

Use one of these imports:

```typescript
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'
```

```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'
```

Replace each old physics surface as follows:

| Old surface | API v1 replacement |
| --- | --- |
| Physics exports at the package root | `/physics/2d` or `/physics/3d` |
| Physics exports at `/browser` | `/physics/2d` or `/physics/3d` |
| Raw 3D physics exports at `/core` | `/physics/3d` |
| `/creator` | `/physics/2d` or `/physics/3d` |
| `/node` physics helpers | `/physics/3d`, or remove the helper |
| `/debug` physics helpers | Read bodies from `/physics/3d` |
| `/core/physics` | `/physics/3d` |
| `/core/world` | `/physics/3d` |
| `/core/physics2d` | `/physics/2d` |
| `/core/physics2d-owned` | `/physics/2d` |

The `/core` barrel no longer exports raw 3D physics. The raw `/core/*` physics
surfaces are internal in API v1. Do not import ABI records, WASM memory offsets,
or generated WASM modules.

## Keep the 3D character controller imports

The 3D character controller is a movement layer. It is not a second physics
solver. Its public functions and types stay at the package root and at
`/browser`.

Keep these imports at `/browser`:

```typescript
import {
  stepDeterministicCarry3D,
  stepDeterministicKcc3D,
  type DeterministicKccWorld3D,
} from '@series-inc/rundot-syncplay/browser'
import type { PhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'
```

The preserved set also contains the related `DeterministicKcc*` types and the
3D slope, step, and moving-platform types. Pass the canonical `PhysicsWorld3D`
as `options.physics` when the controller must collide with physics bodies. Do
not import a second physics world from the package root or from `/browser`.

## Initialize before world creation

Initialization is asynchronous. World operations are synchronous after
initialization.

<!-- syncplay-example: rc1-migration-2d-world -->
```typescript
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()

const world = createPhysicsWorld2D({
  tickRate: 30,
  initialGravity: { x: 0, y: -9.8 },
  capacity: { bodies: 16, joints: 4 },
})

const ball = world.edit((edit) => edit.createBody({
  kind: 'dynamic',
  shape: { type: 'circle', radius: 0.5 },
  x: 0,
  y: 4,
})).created

world.step()
world.readBody(ball)
world.dispose()
```

<!-- syncplay-example: rc1-migration-3d-world -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()

const world = createPhysicsWorld3D({
  tickRate: 30,
  initialGravity: { x: 0, y: -9.8, z: 0 },
  capacity: { bodies: 16, joints: 4 },
})

const ball = world.edit((edit) => edit.createBody({
  kind: 'dynamic',
  shape: { type: 'sphere', radius: 0.5 },
  position: { x: 0, y: 4, z: 0 },
})).created

world.step()
world.readBody(ball)
world.dispose()
```

## Use the owned-world lifecycle

Create a world with a fixed tick rate and explicit capacity. Use `edit()` for
topology changes. Keep the returned handles. Call `step()` with no time value.
Call `dispose()` when the world is no longer needed.

Both dimensions use these operation names where the operation applies:

- `edit`
- `step`
- `readBody` and `readJoint`
- `resolveBody` and `resolveJoint`
- `latest`
- `raycast`, `overlap`, `shapeCast`, and `closestPoints`
- `captureCheckpoint`, `restoreCheckpoint`, and `releaseCheckpoint`
- `serializeCheckpoint` and `restore`
- `digest`
- `info`
- `dispose`

Do not keep a second value-world copy. The WASM world owns authoritative mutable
state.

## Use SI units

Use metres, kilograms, seconds, and radians at the TypeScript boundary. Set
`tickRate` to 10, 20, 30, or 60 when you create the world. Do not pass a display
delta to `step()`.

Recalculate any old values that used units per tick. For example, use `-9.8`
metres per second squared for Earth gravity. Do not use `-9.8 / (30 * 30)`.

## Replace checkpoints and replays

`captureCheckpoint()` returns an opaque native handle. It does not copy full
checkpoint bytes through JavaScript. Restore it with `restoreCheckpoint()`.
Release it with `releaseCheckpoint()`.

Call `serializeCheckpoint()` only when you need portable bytes for storage,
late join, or replay. Restore portable bytes with `restore()`.

Pre-RC checkpoints and replays are not compatible with API v1. API v1 starts a
new deterministic numeric epoch. Complete these steps when you migrate:

1. Delete saved pre-RC checkpoints.
2. Do not verify a pre-RC replay with an API v1 runtime.
3. Change the game deterministic version.
4. Regenerate runtime identity.
5. Start new replay and late-join records.
6. Re-baseline deterministic proof values.

## Replace queries

Run authoritative queries on the owned world inside the same fixed simulation
step that writes the result into captured game state. Use the returned logical
body IDs. Do not run a second hit finder.

Each query uses an explicit shape or direction and an explicit filter. Query
errors fail the operation. The API does not return a fallback result.

## Check removed beta features

API v1 has a smaller stable physics surface than the beta builds.

The stable 2D shapes are circle, box, capsule, and polygon. The stable 2D joints
are distance, revolute, prismatic, and weld.

The stable 3D shapes are sphere, box, and capsule. The stable 3D joints are
distance, point, revolute, prismatic, and weld.

API v1 does not expose these beta feature groups:

- 2D fluids, deformables, compound colliders, continuous collision, pulley,
  gear, wheel, and motor construction
- 3D convex hull, mesh, terrain, compound, vehicle, character, articulation,
  destruction, advanced joints, and advanced continuous collision construction
- Physics debug-mesh generation
- Raw ABI and WASM helpers

Remove these calls or keep the game on its pinned beta until a later stable API
adds the required feature. Do not copy a removed TypeScript solver into game
code.

## Handle errors

API v1 errors have stable codes. A failed mutation does not change the world.
Capacity overflow, a stale handle, a handle from another world, an invalid
checkpoint, and an invalid query all fail loudly.

After checkpoint restore, resolve a new body or joint handle from its stable
logical ID. Do not reuse the old handle.

## Migration completion check

Complete all items before you update a multiplayer release:

- The game imports physics only from `/physics/2d` and `/physics/3d`.
- The game can keep 3D character-controller imports at the root or `/browser`.
- The game awaits initialization before it creates a world.
- Each world has a fixed tick rate and explicit capacity.
- Each call to `step()` has no argument.
- All boundary values use SI units.
- The game uses owned-world edits, reads, queries, and checkpoints.
- The game releases checkpoints and disposes worlds.
- The game uses no removed beta feature.
- The deterministic version and runtime identity changed.
- New replay, rollback, and late-join proofs pass.
