# Syncplay: migrate beta builds to RC1

Syncplay API v1 is the release-candidate physics contract. It has one 2D API
and one 3D API. Both APIs use the Syncplay C++ core compiled to WASM. No
TypeScript physics solver or silent fallback is present.

Use this guide when your game uses Syncplay `5.23.0-beta.7` through
`5.28.0-beta.5`. It covers runtime and physics changes.

Do not remove required game behavior to make an RC migration compile.
Keep the current working build until its required behavior has verified support.

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

## Physics checkpoint compatibility

### Voxel API migration

Move voxel cook, carve/fill, split, slice, DDA, and seam imports to
`/physics/3d`. Do not initialize a separate voxel or extended WASM instance.
Await the existing `initPhysics3D()` call.

Use `cookVoxelBody` for a dynamic occupied grid. Its nonempty result supplies
the compound shape, mass, local COM, and full inertia to `edit.createBody` or
`edit.replaceBody`. Keep the authored game origin. For a center-based chunk,
set each `originOffset` axis to `-(dimension - 1) * cellSize / 2`.
This adjusts both child offsets and COM. It does not fill empty cells.

RC1 aligns DDA and seam outputs with the cook's cell-center origin.
The old DDA and seam code used a cell-corner origin. Subtract `cellSize / 2`
from old local ray origins when the game previously used that convention.
Do not apply this shift twice when the game already uses cell-center positions.
Carve/fill coordinates remain cell coordinates. Bounds remain inclusive.

Supply exact-length `Uint8Array` occupancy. Invalid dimensions, regions,
capacities, and native errors now throw. Handle empty body results explicitly.
Combined edits do not mutate input occupancy if a later cook or slice fails.
This API port passes its canonical artifact checks. Each dependent game still
needs migration checks.

### Convex decomposition migration

Move `cookConvexDecomposition`, `assertCookedColliderIsRuntimeValid`, and their
types from `/node` to `/physics/3d`. Run the cook only during an asset build.
Publish the returned compound shape through the canonical 3D world. The cook
keeps its deterministic voxel lattice, stable hull order, limits, and hash.

### Fluid and force migration

Move `calculatePhysicsBuoyancy` to `/physics/3d`. Supply canonical body readback.
The old flat position fields now live in `body.position`. The helper retains
the beta box, sphere, and validated voxel volume, center, force, and torque
outputs.

Replace the RC.3 manual per-body fluid loop with owned fluid regions. Set
`capacity.fluids` and `capacity.fluidInteractions`. Create, replace, and remove
fluids inside `world.edit()`. The native solver applies buoyancy, drag, and flow
during each substep. It stores fluid state and interaction output in the digest
and both checkpoint routes.

The old helper fields `linearDrag` and `angularDrag` are force and torque
coefficients. The owned fields `linearDragPerSecond` and
`angularDragPerSecond` are implicit decay rates. Do not copy the old numbers.
Tune the new rates for the game workload. A helper volume with a missing filter
field is unfiltered. An owned fluid defaults to layer 1 and mask `0xffffffff`.
Set explicit filters when the game needs different behavior.

Use `applyForce` or `applyForceAtPoint` for a per-tick environmental force.
They add force for the next successful fixed tick and then clear. Use
`setBodyForce` only when the force must remain active. It replaces persistent
force and torque. Call `clearBodyForce` when that persistent effect stops.

<!-- syncplay-example: physics3d-manual-fluid-migration -->
```typescript
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  tickRate: 60,
  initialGravity: { x: 0, y: -10, z: 0 },
  capacity: { bodies: 1, joints: 0, fluids: 1, fluidInteractions: 1 },
})
try {
  const created = world.edit((edit) => ({
    body: edit.createBody({
      shape: { type: 'box', halfX: 0.5, halfY: 0.5, halfZ: 0.5 },
      mass: 0.5,
      sleepEnabled: false,
    }),
    fluid: edit.createFluid({
      bounds: { minX: -2, minY: -2, minZ: -2, maxX: 2, maxY: 1, maxZ: 2 },
      density: 1,
      linearDragPerSecond: 2,
      angularDragPerSecond: 1,
    }),
  })).created
  world.step()
  if (world.latest().fluidInteractions[0]?.fluidId !== created.fluid.id) {
    throw new Error('Expected owned fluid output')
  }
} finally {
  world.dispose()
}
```

<!-- syncplay-example: physics3d-transient-force-migration -->
```typescript
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  tickRate: 60,
  initialGravity: { x: 0, y: 0, z: 0 },
  capacity: { bodies: 1, joints: 0 },
})
try {
  const body = world.edit((edit) => edit.createBody({
    shape: { type: 'sphere', radius: 0.5 }, mass: 1,
    linearDamping: 1, sleepEnabled: false,
  })).created
  world.applyForce(body, { x: 60, y: 0, z: 0 })
  world.step()
  world.step()
  if (world.readBody(body).linearVelocity.x !== 1) throw new Error('Transient force remained active')
} finally {
  world.dispose()
}
```

The canonical 3D body interface normalizes a nonzero orientation quaternion.
Encoded native state must already contain unit quaternions. RC1 rejects
non-unit, zero and overflowing encoded rotations before
it changes world state. It does not use an identity rotation as a fallback.
Keep old saved state with its original SDK. Do not change saved rotation
bytes to force checkpoint acceptance.

RC1 also rejects a step if motion cannot be represented.
It keeps the frame, bodies and outputs unchanged. It does not reset an
overflowing rotation to identity. Correct the input before you retry the step.

RC1 uses native 3D physics ABI 20 and native World ABI 8. It writes snapshot
version 14 for scalar geometry and version 15 for owned geometry records.
Every older 3D world snapshot version is rejected before state changes. RC1
does not synthesize missing fluid, transient-force, or interaction state.
Keep older history with its original runtime. Do not change a snapshot version
header to force an import. Use the matching TypeScript interface and WASM
artifact.

The RC1 2D API uses body ABI 4, owned C ABI 3,
World storage ABI 5, and snapshot version 5. Its body records store layers,
masks, triggers, sensors, and CCD state separately from geometry indices.
The owner rejects older snapshot versions before it changes state.
Keep old game content and replay history with the original runtime until a
verified game-state migration is available. Do not change version headers.
The Boolean `ccd` setting defaults to false. Readback and both checkpoint
routes retain it. Invalid values fail before an edit changes state. Native
continuous collision response handles moving and rotating obstacle cases.
`latest().contacts` reports sorted enter, stay, and exit pair events.

The RC1 query interface moves the old 2D options into `filter`.
Use `filter.layerMask`, `filter.includeSensors`, and `filter.includeTriggers`.
Move `hitSensors` to `filter.includeSensors` and `hitTriggers` to
`filter.includeTriggers`. Move `hitSolids` to `filter.hitSolids`.
Use `filter.bodyKinds` for the old static/dynamic/kinematic switches.
Sensors and triggers remain excluded by default. A body with both flags needs
both inclusion flags. Native filtering occurs before the result limit.
Query ABI is 2. The filter record increases from 8 to 16 bytes.
Query results and `excludeBodyIds` use persistent numeric body IDs.
The pre-correction string declarations did not match the runtime.

Move direct beta 2D collision calls to `collidePhysics2D`. It accepts every
canonical 2D body shape and returns native manifold points and feature IDs.
Keep `decodeContactFeatureId2D` and `mirrorContactFeatureId2D` on the same
entry point. Move direct moving-pair CCD calls to `computeTimeOfImpact2D`.
For owned simulation, set `ccd: true` on each body that needs continuous
response. Do not create a separate CCD solver.

Create bounded fluid regions in `world.edit()` with `createFluid`. Use
`readFluid` and `resolveFluid` after publication or restore. Move submerged
geometry calls and deterministic particle-fluid state helpers to `/physics/2d`.
Move compound mass, bounds, transform, material, and filter authoring calls to
`compound2D`. The compound namespace does not create an owned compound body.

Native C++ retained checkpoints are opaque values. Use World capture and
restore methods. Use `captureState()` when you need a separate state value
to inspect or change. Do not change retained checkpoint internals.

Do not change the ABI header to force checkpoint acceptance. Keep stored game
content and old history. Use an explicit, verified game-state migration before
you create new physics history. Do not use the runtime JSON checkpoint helper
to convert native physics checkpoints. Use the same SDK build and deterministic
version for all peers in a session.

## Contact output in RC1

RC1 reports applied impulse changes for each tick.
It does not report only the largest substep value. Additional solver iterations
do not add the same accumulated impulse again. Outputs keep the first contact
point, normal, and penetration of the tick. Tangent impulse sums use the first
contact basis. All three impulse values are components of the applied world
impulse in that basis. A later normal change can produce tangent components
without friction. The normal component can be negative if the direction of
response changes. Do not treat these components as non-negative magnitude sums.
Each applied warm impulse retains its actual world direction in these sums.
Later contact correction does not change the direction of an earlier impulse.
Terminal warm-contact cache values remain separate.

Verify impact thresholds against RC1 before you release a game.
Do not multiply its reported tick impulse by the number of substeps.

A flat capsule side contact now keeps both extreme closest-point witnesses.
A unique capsule cap contact keeps one witness. The exact closest-point
calculation can change settled capsule positions and contact cache values.
Use a new deterministic game identity when you adopt RC1.

## Body origin and center of mass in RC1

Body position locates the body origin. `centerOfMass` is a local offset from
that origin. Linear velocity moves the world center of mass. Rotation changes
the origin position when the local center of mass is nonzero. Translation
locks constrain COM motion. They do not remove this rotation compensation.
Native output rounds the final origin position to one micrometre.

Keep the authored body origin for rendering and geometry placement.
Do not move collider children to the center of mass without the corresponding
body transform. Retained and portable checkpoints preserve the local COM.
An old replay must keep its original solver identity and integration rule.

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

The generated inventory below records the earlier RC removal policy.
It does not prove equivalent behavior in the current SDK. Do not use a
“Remove” action to delete required game behavior. Each affected capability
needs a verified canonical replacement before that game can migrate.

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
| `/node` physics helpers | Use a verified replacement at `/physics/3d`. |
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

1. Keep saved pre-RC checkpoints with their original SDK and runtime identity.
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

## Check beta capability support

RC1 restores the required beta physics capability groups on the canonical
entry points. Every beta behavior used by a game still needs a verified
replacement or equivalent capability.

The stable 2D shapes are circle, box, capsule, polygon, segment, and chain.
Move beta segment collider inputs to `shape: { type: 'segment', point1, point2,
ghost1?, ghost2?, radius? }`. Move beta chain collider inputs to
`shape: { type: 'chain', vertices, loop?, radius? }`. The runtime also accepts
the old segment `vertices` form during migration. The API v1 2D joints are
distance, revolute, prismatic, weld, wheel, motor, mouse, rope, pulley, and
gear.

The RC1 API also exposes wheel, motor, mouse, rope,
pulley, and gear joints through the same 2D world. Use body handles or pending
body references for endpoints. Gear sources use joint handles or pending joint
references. World endpoints have no body ID in gear reactions. Both checkpoint
routes retain complete joint state and reactions. See the
[restored joint inputs and example](SYNCPLAY-PHYSICS-2D.md#joints-in-the-unpublished-restoration-candidate).

The API v1 3D shapes are sphere, box, capsule, cylinder, cone,
tapered capsule, hull, mesh, heightfield, and compound. The API v1 3D joints
are distance, point, revolute, prismatic, weld, motor, filter, wheel, and
six-axis.

RC1 restores weld `maxSpringForce`, `maxSpringTorque`,
and `targetRotation`. Move old `linearHertz` to `linearFrequencyHz`.
Move old `angularHertz` to `angularFrequencyHz`. Keep separate
`linearDampingRatio` and `angularDampingRatio` when the game supplies them.
Both caps apply per native spring axis. Zero means unbounded, not disabled.
The rotation target is relative to body A. A moving kinematic endpoint supplies
the position target. Use a six-axis joint for multi-axis and bounded grab
control.

The same candidate restores native `motor` and `filter` joints.
Keep old motor `linearVelocity`, `angularVelocity`, `maxMotorForce`, and
`maxMotorTorque`. For a scalar motor, move `axisA` to `axis` and keep `motorSpeed`.
Do not mix scalar and vector drive inputs. Move old motor `maxVelocityForce`
to `maxMotorForce`. Move `maxVelocityTorque` to `maxMotorTorque`.
Motor caps apply per native axis. Zero supplies no drive impulse.
A filter joint retains its pair-specific collision exclusion. It does not
replace either body's layer or mask. Use current handles for both endpoints.

Move beta `spherical` and `ball` joints to canonical `point` inputs.
RC1 restores `coneAngle`, angular springs, and angular velocity drives.
Move `axisA` to `axis`. Move `lowerTwistAngle` to `minTwistAngle`.
Move `upperTwistAngle` to `maxTwistAngle`. Move the spherical spring's
`frequencyHz` or `hertz` to `angularFrequencyHz` and `dampingRatio` to
`angularDampingRatio`. Keep `targetRotation` and `maxSpringTorque`.
Keep `angularVelocity` and move `maxVelocityTorque` to `maxMotorTorque`.
Retain a point joint's fixed anchor constraint. It is not a bounded position spring.

RC1 also restores revolute `targetAngle`, prismatic `targetTranslation`,
and their `frequencyHz`, `dampingRatio`, and spring force or torque caps.
Keep these fields when the old game supplies them.
For native wheel joints, move `axisA` to `axis`. Move `restLength`,
`suspensionHertz`, `suspensionDampingRatio`, and `maxSpringForce` into
`suspension: { restLength, frequencyHz, dampingRatio, maxForce }`.
Move suspension bounds to `minTranslation` and `maxTranslation`.
Move `spinSpeed` or `motorSpeed` and `maxSpinTorque` into
`drive: { speed, maxTorque }`. Move steering target, frequency, damping, cap,
and bounds into `steering: { targetAngle, frequencyHz, dampingRatio, maxTorque, minAngle, maxAngle }`.
The wheel joint still uses one local axis for travel and spin.
Move the beta raycast vehicle controller to `stepDeterministicVehicle3D`.
Pass the canonical chassis handle instead of the old string ID.
Rename `suspensionDir` to `suspensionDirection`.
Rename `suspensionMaxTravel` to `suspensionMaximumTravel`.
Rename `maxSteerAngleTurns` to `maximumSteerAngleTurns`.
Rename `isSteered` to `steered` and `isDriven` to `driven`.
The controller reads the fixed time step from the world.
Remove the old `dtTicks` option.
Apply the returned impulses before `world.step()`, or set
`applyImpulses: true` on the controller call.
Use `vehicles3D`, `tracks3D`, and `powertrain3D` for lower-level contact,
tracked vehicle, motorcycle, and powertrain services.

Move beta six-DOF joints to canonical `type: 'six_dof'`.
Keep their body-local anchors and frame rotations in `anchorA`, `anchorB`,
`frameOrientationA`, and `frameOrientationB`.
Split the six axis configurations into `linearAxes` and `angularAxes` tuples.
Map free/locked/limited modes to `limit.type`. Map lower/upper bounds to
`limit.min` and `limit.max`. Map motor target velocity to `motor.velocity`.
Map spring target position to `spring.target`. Keep frequency, damping, and
the corresponding cap under `spring.frequencyHz`, `spring.dampingRatio`,
and `spring.maxForce`. Limit and motor caps use their own `maxForce` fields.
Angular `maxForce` values are torque caps. Linear values are force caps.
Zero caps remain unbounded on six-axis joints. Do not apply the basic motor
joint's zero-cap rule. Use an absent motor or spring to disable that control.
RC1 retains endpoint collision selection and full-tick force/torque
break thresholds. Replace beta `brokenJointIds` reads with
`world.latest().breakEvents.map((event) => event.jointId)`. Read the break
reason, endpoint IDs, force, and torque from the same event. Read all current
joint reactions from `world.latest().jointReactions`. These outputs use stable
IDs and survive both checkpoint routes. They clear on the next successful step.
Move a beta shared linear cap to `maxLinearForce`. Move a shared angular cap to
`maxAngularTorque`. These values limit the total vector, after per-axis caps.
Use a moving kinematic anchor as the target for a bounded grab. Remove the
six-axis joint when the game-owned break-distance rule is true.

RC1 accepts mesh, heightfield, compound,
and hull body inputs through the same 3D world. Mesh vertices form consecutive
triangles. Each triangle has three vertices. Heightfields retain the beta
`columns`, `rows`, `scale`, and `heights` input fields. Compounds retain child
shapes and local offsets. The native world owns a copy of each payload.
Body replacement and checkpoint restore include that payload.

RC1 also restores native `cylinder`, `cone` and `tapered_capsule`
body definitions. Use `radius` and `halfHeight` for cylinders and cones.
A cylinder can set `topRadius`; its default equals `radius`. Use
`bottomRadius`, `halfHeight` and `topRadius` for a tapered capsule.
Replace the old `taperedCapsule` alias with `tapered_capsule`.
Convert an old full `height` to `halfHeight` with `height / 2`.
Map old cylinder `bottomRadius` or `baseRadius` to `radius` explicitly.
All dimensions must be finite and positive. Dynamic instances currently
require explicit inertia. Use `massProperties3D` to calculate shape properties
when the game did not store them. Native ray, solid-contact, and checkpoint
checks pass for the restored shapes. CCD is verified for sphere and capsule
bodies. A game must still verify its own shape mix and capacity.

Use `readMotion(handle)` for transforms, velocities, and body settings.
It copies no geometry payload. Its `shape` retains primitive dimensions or
the complex shape type. Use `readBody(handle)` when you need geometry values.
Use `raycast({ ...query, onlyBody: handle })` to query one live body through
the same native ray kernel. The query still applies filters and exclusions.
A handle from another world, a removed body, or an old restore epoch fails.
The terrain controller uses these operations for ground samples. Selected
queries do not establish the Farlite performance gate or full game acceptance.

Native record admission also builds a terrain triangle index for capsule
contacts. Retained checkpoints share that immutable index. Portable snapshot
import builds it from stored geometry. Ray queries use the exact stored
surface.

Regular heightfield readback returns scaled heights with `scale.y` equal to 1.
It retains the horizontal sample spacing and the same surface. A heightfield
can also use `vertices` instead of `scale` and `heights`. Supply one vertex
per sample in row order. Readback uses this form when a restored surface has
nonuniform horizontal coordinates. It does not move those samples.
Dynamic complex bodies currently require explicit inertia. Query probe shapes
are sphere, box, and capsule. Body targets can use any stable stored shape.
Do not treat API support as complete game migration acceptance.

Move direct beta feature imports to their namespace on `/physics/3d`.
The available namespaces cover articulation, cloth, deformable queries,
distance constraints, fracture, gears, lag compensation, mass properties,
particles, path joints, powered and passive ragdolls, powertrain, pulleys,
ropes, rounded convex geometry, SDF geometry, soft bodies and contacts,
surface velocity, tracks, and vehicles. Do not create a separate extended
WASM instance. These services use the canonical artifact.

RC1 moves these beta feature groups to the canonical entry points:

- 2D fluids, deformables, compound colliders, continuous collision, pulley,
  gear, wheel, and motor construction
- 3D convex hull, mesh, terrain, compound, vehicle, character, articulation,
  destruction, advanced joints, and advanced continuous collision construction
- Physics debug-mesh generation remains internal. Build game debug geometry
  from public body readback.
- Raw ABI and WASM helpers

Do not remove required game behavior. Keep the game on its verified beta until
the canonical API restores that capability or an equivalent capability.
Do not replace exact voxel or terrain geometry with a bounding box.
Do not copy a removed TypeScript solver into game code.

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
- Each beta capability used by the game has a verified canonical replacement.
- Stored content and old history remain available with their original runtime.
- The deterministic version and runtime identity changed.
- New replay, rollback, and late-join proofs pass.
