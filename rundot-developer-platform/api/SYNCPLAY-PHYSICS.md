# Syncplay: 3D physics API v1

This page describes the Syncplay 3D physics release-candidate API. Import it
from `@series-inc/rundot-syncplay/physics/3d`.

The TypeScript API uses the Syncplay C++ core compiled to WASM. The WASM world
owns all mutable physics state. No TypeScript solver or fallback is present.

## Public values

| Value | Purpose |
| --- | --- |
| `initPhysics3D()` | Load and initialize the C++ and WASM service. Await it before world creation. |
| `createPhysicsWorld3D(definition)` | Create one owned 3D world after initialization. |
| `cookConvexDecomposition(source, options)` | Cook a concave triangle list into deterministic compound hull data at build time. |
| `assertCookedColliderIsRuntimeValid(cooked)` | Check cooked hull limits before world publication. |

## Public types

| Type | Purpose |
| --- | --- |
| `PhysicsBodyId3D` | Stable logical body ID. Use it to resolve a new handle after restore. |
| `PhysicsJointId3D` | Stable logical joint ID. Use it to resolve a new handle after restore. |
| `PhysicsFluidId3D` | Stable logical fluid ID. Use it to resolve a new handle after restore. |
| `PhysicsBodyHandle3D` | Opaque body handle for one world epoch. |
| `PhysicsJointHandle3D` | Opaque joint handle for one world epoch. |
| `PhysicsFluidHandle3D` | Opaque fluid handle for one world epoch. |
| `PhysicsVector3D` | Three-component vector in API units. |
| `PhysicsAabb3D` | Axis-aligned 3D bounds. |
| `PhysicsInertia3D` | Symmetric body inertia tensor. |
| `PhysicsWorldDefinition3D` | Fixed-step settings and capacity for a world. |
| `PhysicsWorldCapacity3D` | Body, joint, fluid, and fluid-interaction capacity limits. |
| `PhysicsBody3D` | Body state returned by `readBody()`. |
| `PhysicsBodyMotion3D` | Body settings and motion without complex geometry arrays. |
| `PhysicsBodyInput3D` | Body input for create and replace operations. |
| `PhysicsJoint3D` | Joint state returned by `readJoint()`. |
| `PhysicsJointInput3D` | Stable joint input for create and replace operations. |
| `PhysicsShape3D` | Sphere, box, capsule, cylinder, cone, tapered capsule, hull, mesh, heightfield, or compound. |
| `PhysicsEditOps3D` | Operations available inside `edit()`. |
| `PhysicsEditResult3D` | Created handles and removal results from `edit()`. |
| `PhysicsLatestOutputs3D` | Frame and latest contact, joint, break, and fluid interaction outputs. |
| `PhysicsFluidInput3D`, `PhysicsFluid3D`, `PhysicsFluidInteraction3D` | Owned fluid input, readback, and latest interaction output. |
| `PhysicsCheckpoint3D` | Opaque retained checkpoint handle. |
| `PhysicsRaycastQuery3D` | Raycast input. |
| `PhysicsOverlapQuery3D` | Overlap input. |
| `PhysicsShapeCastQuery3D` | Shape-cast input. |
| `PhysicsClosestPointsQuery3D` | Closest-point input. |
| `PhysicsCastHit3D` | Raycast, overlap, or shape-cast hit. |
| `PhysicsClosestPointResult3D` | Closest-point result. |
| `PhysicsContactEvent3D` | Enter, stay, or exit contact event. |
| `PhysicsJointReaction3D` | Stable joint ID, endpoints, force, and torque from the latest step. |
| `PhysicsJointBreakEvent3D` | One-step joint break event with its reason and reaction. |
| `PhysicsWorldInfo3D` | Backend, frame, settings, count, and capacity data. |
| `PhysicsWorld3D` | Complete owned-world interface. |
| `PhysicsError3D` | Stable Syncplay physics error type. |
| `PhysicsFeatureApi3D` | Type of the advanced feature namespace group. |
| `PhysicsBuoyancyOptions3D`, `PhysicsBuoyancyResult3D` | Flat-plane helper input and buoyancy result for RC.3 migration. |
| `PhysicsFluidVolume3D`, `PhysicsFluidForcesOptions3D`, `PhysicsFluidForcesResult3D` | Bounded-fluid definition, calculation options, and force result. |
| `ColliderSourceMesh`, `ColliderCookOptions`, `CookedCollider`, `CookedColliderHull` | Offline convex-decomposition input, options, output, and hull record. |

## Create and dispose a world

Await initialization once. Set the fixed tick rate and capacity when you create
the world. Call `step()` with no argument.

<!-- syncplay-example: physics3d-world-lifecycle -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()

const world = createPhysicsWorld3D({
  tickRate: 30,
  initialGravity: { x: 0, y: -9.8, z: 0 },
  capacity: { bodies: 64, joints: 16 },
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

Use metres, kilograms, seconds, and radians. Supported tick rates are 10, 20,
30, and 60. All ten shapes in `PhysicsShape3D` are part of the API v1 contract.

## Body settings and contact materials

Set these fields in `PhysicsBodyInput3D`. Create and replace operations validate
numeric fields before they publish the edit. `readBody()` returns the settings.

| Fields | Defaults and rules |
| --- | --- |
| `kind`, `shape` | `kind` defaults to `dynamic`. A shape is required. |
| `position`, `linearVelocity`, `angularVelocity`, `centerOfMass` | Each vector defaults to zero. Components must be finite. `centerOfMass` is local to the body. |
| `orientation` | Defaults to the identity quaternion. Components must be finite. |
| `mass`, `inertia` | Mass defaults to 1 and must be positive. Basic shapes have calculated inertia. Dynamic restored shapes currently need explicit inertia. |
| `friction`, `restitution`, `rollingResistance` | Defaults are 0.6, 0 and 0. Values must be finite and nonnegative. Restitution must not exceed 1. |
| `gravityScale`, `linearDamping`, `angularDamping` | Defaults are 1, 0.995 and 0.98. Values must be finite. Damping must be nonnegative. |
| `layer`, `mask`, `trigger`, `sensor` | Defaults are 1, 1, false and false. Layer and mask are unsigned 32-bit values. Triggers and sensors report contacts without solid response. |
| `sleeping`, `sleepEnabled`, `sleepThreshold` | Defaults are false, true and 0.05. The threshold must be finite and nonnegative. |
| `motionLocks`, `ccd` | Defaults are 0 and false. Motion locks use an unsigned 32-bit mask. CCD prevents verified sphere and capsule thin-wall crossings. |

Friction resists tangential motion at a contact. Restitution controls bounce.
Rolling resistance resists relative angular motion in the contact tangent
plane. It acts on spheres, capsules, cylinders and tapered capsules. It is
separate from `angularDamping`, which applies without a contact.

<!-- syncplay-example: physics3d-rolling-resistance -->
```typescript
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  initialGravity: { x: 0, y: 0, z: 0 },
  substeps: 1, velocityIterations: 1, contactHertz: 0, contactSpeed: 0,
  capacity: { bodies: 2, joints: 0 },
})
try {
  const ball = world.edit((edit) => {
    edit.createBody({ kind: 'static', shape: { type: 'sphere', radius: 0.5 }, friction: 0 })
    return edit.createBody({
      shape: { type: 'sphere', radius: 0.5 },
      position: { x: 0.9, y: 0, z: 0 },
      linearVelocity: { x: -1, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 1 },
      inertia: { xx: 1, yy: 1, zz: 1 },
      friction: 0, rollingResistance: 1, linearDamping: 1, angularDamping: 1,
    })
  }).created
  world.step()
  if (world.readBody(ball).angularVelocity.z !== 0.5) throw new Error('Missing rolling response')
} finally {
  world.dispose()
}
```

## Complex shapes, terrain, and voxels

The RC1 API accepts mesh triangle vertices, hull vertices, heightfield grids
and nested compound children. Each compound child has a shape and a local
offset. Native immutable records own copied geometry. Dynamic complex bodies
require explicit mass properties and inertia. The voxel body cook described
below supplies these values. The fracture service is available through
`fracture3D`.

Use `cookConvexDecomposition` during an asset build when a source mesh is
concave. Its result is a canonical compound shape with hull children. The cook
uses an integer voxel lattice and stable ordering. The same source and options
produce the same hash. Call `assertCookedColliderIsRuntimeValid` before you
store the asset. Do not run this offline cook inside a simulation step.

### Voxels

Import voxel operations from `/physics/3d`. Call and await `initPhysics3D()`
before a native voxel operation. These operations use the same C++ WASM module
as the canonical 3D world. No second solver is required.

Use `createVoxelChunk` to create a grid. Occupancy is a `Uint8Array` with exactly
`dimX * dimY * dimZ` entries. Its index is `x + dimX * (y + dimY * z)`.
Cell `(0, 0, 0)` has local center `(0, 0, 0)`. A cell has side length `cellSize`.
Cooked child offsets, DDA rays, and seam centroids use this local origin.

| Operation | Result |
| --- | --- |
| `getVoxelCell`, `setVoxelCell` | Read or write one valid cell. Invalid cell coordinates throw. |
| `createVoxelCompoundShape` | Convert cooked box children to the canonical compound shape. |
| `cookVoxelChunk` | Box children for occupied cells. Empty space stays empty. |
| `carveVoxelChunk` | Box, sphere, or capsule carve/fill and a dirty cell range. |
| `incrementalCookVoxel` | Updated children with preserved IDs outside the changed region. |
| `splitVoxelComponents` | Connected occupied components and optional face anchors. |
| `incrementalSliceCompound` | Child lists for each component. |
| `raycastVoxelDDA` | First occupied cell on a local ray. |
| `queryVoxelSeam` | Shared faces, exposed faces, area, centroid, and all six bounds. |
| `computeVoxelMassProperties` | Occupied-cell COM and full inertia for a supplied total mass. |
| `cookVoxelBody` | Compound shape, mass, COM, and inertia from one occupancy copy. |
| `carveAndIncrementalCook`, `carveAndIncrementalSlice` | Stage a combined occupancy edit and derived cook or slice. |

| Type or constant | Purpose |
| --- | --- |
| `VoxelChunk`, `VoxelVector`, `VoxelCellBounds` | Grid, local vectors, and inclusive cell bounds. |
| `VoxelBoxChild`, `VoxelCompoundShape` | Stable cooked children and canonical body geometry. |
| `VoxelCookOptions`, `VoxelCookResult`, `VoxelCookStats`, `VoxelIncrementalCookResult` | Full and bounded-region cooking inputs and results. |
| `VoxelCarveRegion`, `VoxelCarveOptions`, `VoxelCarveResult` | Typed box, sphere, or capsule occupancy edits. |
| `VoxelSplitOptions`, `VoxelSplitResult`, `VoxelSubChunk` | Connected component splitting and copied component grids. |
| `VoxelSliceOptions`, `VoxelSliceResult` | Child lists for split components. |
| `VoxelRayQuery`, `VoxelRayHit` | Local occupancy ray inputs and first-hit result. |
| `VoxelSeamOptions`, `VoxelSeamResult` | Shared cell-face query inputs and complete seam result. |
| `VoxelPhysicalProperties`, `VoxelMassResult`, `VoxelBodyCookResult` | Physical values and explicit empty or occupied results. |
| `VoxelStatus` | Success, empty, unchanged, and native error codes. |
| `VoxelCarveOp`, `VoxelCarveShapeType` | Numeric edit operations and shape codes. |
| `VoxelChildFlags`, `VoxelAnchorFaceMask` | Cooked-child status bits and component anchor-face bits. |

Carve/fill regions use cell coordinates. Bounds are inclusive. Ray origins and
distances use local length units. Seam offsets use integer cell coordinates.
Supply `originOffset` to `cookVoxelBody` when the game uses a different origin.
The body cook applies that offset to both geometry and COM. It does not change
the inertia about COM.

An empty body cook returns status `NoOccupiedVoxels` and has no `body` field.
Do not create a replacement bounding box for an empty result.
Native errors and invalid inputs throw. Capacity exhaustion does not return
partial geometry. Combined carve/cook and carve/slice operations stage
occupancy changes until all operations succeed. Use `mutateInPlace: false`
to keep the input occupancy unchanged.

Use `fracture3D` when the game needs fracture construction. Keep occupancy in
game state. Publish a replacement compound body in one atomic world edit.

<!-- syncplay-example: physics3d-voxel-body-cook -->
```typescript
import {
  initPhysics3D, createPhysicsWorld3D, createVoxelChunk, setVoxelCell, cookVoxelBody,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const chunk = createVoxelChunk(5, 1, 1)
setVoxelCell(chunk, 0, 0, 0, true)
setVoxelCell(chunk, 4, 0, 0, true)
const cooked = cookVoxelBody(chunk, 12, { originOffset: { x: -2, y: 0, z: 0 } })
if (cooked.status !== 0) throw new Error('Expected an occupied voxel body')
const world = createPhysicsWorld3D({ capacity: { bodies: 1, joints: 0 } })
try {
  world.edit((edit) => edit.createBody({ kind: 'dynamic', ...cooked.body }))
  const gap = world.raycast({ x: 0, y: 2, z: 0, dx: 0, dy: -1, dz: 0, maxDistance: 4 })
  if (gap.length !== 0) throw new Error('Voxel empty space must remain empty')
} finally {
  world.dispose()
}
```

### Owned fluid regions and force lifetimes

Create a fluid inside `world.edit()`. Set `capacity.fluids` and
`capacity.fluidInteractions` when you create the world. Both default to zero.
The native solver applies buoyancy, linear drag, angular drag, and flow during
each fixed substep. It supports boxes, spheres, and the `VoxelCompoundShape`
from `cookVoxelBody`. A voxel body displaces fluid only for its occupied boxes.

Fluid bounds must not overlap by a positive volume. Touching bounds are valid.
The default surface plane is horizontal at `bounds.maxY`. Density must be
positive. `linearDragPerSecond` and `angularDragPerSecond` are nonnegative
implicit decay rates. Large values stay finite and do not reverse relative
velocity. The filter defaults are layer 1 and mask `0xffffffff`.

Call `latest().fluidInteractions` after a step. The bounded output is sorted by
body ID and then fluid ID. Each item includes submerged volume, center of
buoyancy, force, torque, relative velocity, and wake state. A step fails
atomically if the output capacity is too small.

`applyForce` and `applyForceAtPoint` add force for the next successful fixed
tick. The world clears that pending force after success. A failed step keeps
it. The pending force is part of the digest and both checkpoint routes.
`setBodyForce` is different. It replaces persistent force and torque. The
values remain active until `clearBodyForce` replaces them with zero.

The RC.3 helpers `calculatePhysicsBuoyancy` and
`calculatePhysicsFluidForces` remain available during migration. They support
boxes, spheres, and validated voxel compounds. They do not create world-owned
fluid state. Their `linearDrag` and `angularDrag` values are force and torque
coefficients. Do not copy these values into the owned-fluid decay-rate fields.
Tune the new rates for the game workload.

<!-- syncplay-example: physics3d-owned-voxel-fluid -->
```typescript
import {
  cookVoxelBody, createPhysicsWorld3D, createVoxelChunk, initPhysics3D, setVoxelCell,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const chunk = createVoxelChunk(3, 1, 1)
setVoxelCell(chunk, 0, 0, 0, true)
setVoxelCell(chunk, 2, 0, 0, true)
const cooked = cookVoxelBody(chunk, 0.25, { originOffset: { x: -1, y: 0, z: 0 } })
if (cooked.status !== 0) throw new Error('Expected an occupied voxel body')
const world = createPhysicsWorld3D({
  tickRate: 60,
  initialGravity: { x: 0, y: -10, z: 0 },
  capacity: { bodies: 1, joints: 0, fluids: 1, fluidInteractions: 1 },
})
try {
  const created = world.edit((edit) => ({
    body: edit.createBody({ kind: 'dynamic', ...cooked.body, sleepEnabled: false }),
    fluid: edit.createFluid({
      bounds: { minX: -2, minY: -2, minZ: -1, maxX: 2, maxY: 1, maxZ: 1 },
      density: 1,
      linearDragPerSecond: 2,
      angularDragPerSecond: 1,
    }),
  })).created
  world.step()
  if (world.readBody(created.body).linearVelocity.y <= 0) throw new Error('Expected flotation')
  if (world.latest().fluidInteractions[0]?.fluidId !== created.fluid.id) {
    throw new Error('Expected one fluid interaction')
  }
} finally {
  world.dispose()
}
```

<!-- syncplay-example: physics3d-one-tick-force -->
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
    shape: { type: 'sphere', radius: 0.5 },
    mass: 1,
    linearDamping: 1,
    sleepEnabled: false,
  })).created
  world.applyForce(body, { x: 60, y: 0, z: 0 })
  world.step()
  if (world.readBody(body).linearVelocity.x !== 1) throw new Error('Missing one-tick force')
  world.step()
  if (world.readBody(body).linearVelocity.x !== 1) throw new Error('Force did not clear')
  world.setBodyForce(body, { x: 60, y: 0, z: 0 })
  world.step()
  world.clearBodyForce(body)
} finally {
  world.dispose()
}
```

<!-- syncplay-example: physics3d-buoyancy-force -->
```typescript
import {
  initPhysics3D, createPhysicsWorld3D, calculatePhysicsBuoyancy,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const gravity = { x: 0, y: -10, z: 0 }
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: gravity,
  capacity: { bodies: 1, joints: 0 } })
try {
  const body = world.edit((edit) => edit.createBody({ kind: 'dynamic',
    shape: { type: 'sphere', radius: 1 }, mass: 1 })).created
  const result = calculatePhysicsBuoyancy(world.readBody(body), { waterY: 0, density: 1, gravity })
  world.setBodyForce(body, result.force, result.torque)
  world.step()
  if (world.readBody(body).linearVelocity.y <= 0) throw new Error('Expected upward acceleration')
  world.clearBodyForce(body)
} finally {
  world.dispose()
}
```

The RC1 API also accepts these native convex body definitions:

| Shape type | Required dimensions | Optional dimensions |
| --- | --- | --- |
| `cylinder` | `radius`, `halfHeight` | `topRadius`; the default equals `radius`. |
| `cone` | `radius`, `halfHeight` | None. |
| `tapered_capsule` | `bottomRadius`, `halfHeight`, `topRadius` | None. |

All dimensions must be finite and positive. Dynamic bodies with these shapes
currently require explicit inertia. Readback retains both cylinder radii.
These are native surfaces, not bounding-box colliders. Native body contacts,
readback, ray queries, and checkpoints use their exact geometry. CCD is
verified for sphere and capsule bodies. Query probe shapes accept sphere, box,
and capsule.

<!-- syncplay-example: physics3d-restored-convex-bodies -->
```typescript
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ capacity: { bodies: 3, joints: 0 } })
try {
  for (const shape of [
    { type: 'cylinder', radius: 0.75, halfHeight: 1, topRadius: 0.5 },
    { type: 'cone', radius: 0.75, halfHeight: 1 },
    { type: 'tapered_capsule', bottomRadius: 0.75, halfHeight: 1, topRadius: 0.5 },
  ] as const) {
    const body = world.edit((edit) => edit.createBody({ kind: 'static', shape })).created
    const hit = world.raycast({ onlyBody: body,
      x: -3, y: 0, z: 0, dx: 1, dy: 0, dz: 0, maxDistance: 6,
    })[0]
    if (hit?.bodyId !== body.id) throw new Error('Missing native shape hit')
  }
} finally {
  world.dispose()
}
```

Use `readMotion()` for body settings, position and velocity in a simulation
loop. Complex shapes return only their type in this result. Use `readBody()`
when you need copied geometry arrays. Regular heightfield readback uses scaled
heights and `scale.y` equal to 1. Irregular grids retain their actual vertices.

Set `onlyBody` to a current body handle for a body-specific native ray.
Normal query filters still apply. A foreign, removed or pre-restore handle
fails. Resolve a new handle from the logical body ID after restore.

<!-- syncplay-example: physics3d-restored-terrain -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
  type PhysicsBodyMotion3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  tickRate: 30,
  capacity: { bodies: 1, joints: 0 },
})
try {
  const terrain = world.edit((edit) => edit.createBody({
    kind: 'static',
    shape: {
      type: 'heightfield', columns: 2, rows: 2,
      scale: { x: 1, y: 1, z: 1 }, heights: [0, 0, 0, 0],
    },
  })).created
  const motion: PhysicsBodyMotion3D = world.readMotion(terrain)
  if (motion.shape.type !== 'heightfield') throw new Error('Missing terrain')
  const hit = world.raycast({
    onlyBody: terrain,
    x: 0.25, y: 2, z: 0.25,
    dx: 0, dy: -1, dz: 0, maxDistance: 4,
  })[0]
  if (hit?.bodyId !== terrain.id) throw new Error('Missing terrain hit')
} finally {
  world.dispose()
}
```

This example checks body creation and one ray. Capsule contacts use a retained
native triangle index. Retained checkpoints share that index. Portable imports
rebuild it. Rays use the exact stored surface. A game must still verify its
complete character controller, slopes, steps, filters, casts, and streamed
terrain lifecycle after migration.

## Use one authoritative fire path

Run the physics step and hit query in the same game simulation step. Write the
shot result into captured game state. Do not run a second hit finder.

<!-- syncplay-example: ashfall-raycast-in-step -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
  type PhysicsBodyId3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()

const physics = createPhysicsWorld3D({
  tickRate: 30,
  initialGravity: { x: 0, y: 0, z: 0 },
  capacity: { bodies: 32, joints: 0 },
})

physics.edit((edit) => edit.createBody({
  kind: 'static',
  shape: { type: 'box', halfX: 0.5, halfY: 1, halfZ: 0.5 },
  position: { x: 5, y: 0, z: 0 },
}))

interface GameState {
  frame: number
  lastHit?: PhysicsBodyId3D
}

const state: GameState = { frame: 0 }

function stepGame(fire: boolean): void {
  physics.step()
  state.frame += 1
  if (!fire) return
  state.lastHit = physics.raycast({
    x: 0,
    y: 0,
    z: 0,
    dx: 1,
    dy: 0,
    dz: 0,
    maxDistance: 20,
  })[0]?.bodyId
}

stepGame(true)
physics.dispose()
```

Use occupancy as a game rule. Physics reports bodies and contacts. Your game
must decide if a spawn cell, lane, or horde slot is occupied.

## Mix the physics digest into game state

`digest()` returns a deterministic digest of the current native world. Mix it
into the checksum for your complete authoritative game state. Do not use it as
the only game-state checksum.

<!-- syncplay-example: physics3d-state-digest -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  tickRate: 30,
  capacity: { bodies: 8, joints: 0 },
})

world.edit((edit) => edit.createBody({
  shape: { type: 'capsule', radius: 0.4, halfHeight: 0.8 },
}))
world.step()
const physicsDigest = world.digest()
if (typeof physicsDigest !== 'bigint') throw new Error('Missing physics digest')
world.dispose()
```

## Capture and restore

A retained checkpoint stays in WASM. JavaScript holds an opaque handle. Release
each retained checkpoint when you no longer need it.

Serialize only when you need portable bytes for replay, storage, or late join.

<!-- syncplay-example: physics3d-checkpoint -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const definition = {
  tickRate: 30,
  capacity: { bodies: 8, joints: 0 },
} as const
const world = createPhysicsWorld3D(definition)
world.edit((edit) => edit.createBody({
  shape: { type: 'sphere', radius: 0.5 },
}))

const checkpoint = world.captureCheckpoint()
const expected = world.digest()
world.step()
world.restoreCheckpoint(checkpoint)
if (world.digest() !== expected) throw new Error('Checkpoint mismatch')

const bytes = world.serializeCheckpoint(checkpoint)
const restored = createPhysicsWorld3D(definition)
restored.restore(bytes)

world.releaseCheckpoint(checkpoint)
restored.dispose()
world.dispose()
```

Pre-RC checkpoints and replays are not compatible with API v1. See
[Syncplay: migrate physics to API v1](SYNCPLAY-RC1-MIGRATION.md).

## Use queries

Raycast, overlap, shape cast, and closest-point queries are synchronous and
read-only. Query filters are explicit. Results use stable logical body IDs.

<!-- syncplay-example: physics3d-queries -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  capacity: { bodies: 8, joints: 0 },
})
world.edit((edit) => edit.createBody({
  kind: 'static',
  shape: { type: 'box', halfX: 1, halfY: 1, halfZ: 1 },
}))

world.overlap({ x: 0, y: 0, z: 0, shape: { type: 'sphere', radius: 0.2 } })
world.shapeCast({
  x: -3, y: 0, z: 0,
  shape: { type: 'sphere', radius: 0.2 },
  dx: 1, dy: 0, dz: 0,
  maxDistance: 10,
})
world.closestPoints({ x: 3, y: 0, z: 0, maxDistance: 10 })
world.dispose()
```

## Use stable joints

API v1 supports distance, point, revolute, prismatic, weld, motor, filter,
wheel, and six-axis joints.
Motor `linearVelocity` and `angularVelocity` are relative world-space targets.
Use `maxMotorForce` and `maxMotorTorque` as per-axis drive caps.
Zero supplies no motor impulse. With an angular-only drive, the native motor
also holds the two endpoint anchors together, as the beta motor did.
Alternatively, supply `motorSpeed`, `axis`, and `maxMotorTorque` for a scalar
angular drive. That axis is local to body A. Do not mix vector and scalar drives.
A filter joint disables collision only between its two endpoints. It does not
change either body's layer or mask. Removing it restores normal pair filtering.

The RC1 API also exposes the native weld spring
controls. Set `linearDampingRatio` and `angularDampingRatio` separately.
`dampingRatio` supplies the default for each omitted value.
Set `maxSpringForce` and `maxSpringTorque` to limit each native spring axis.
Zero retains the native unbounded setting. These are per-axis limits, not one
shared vector limit. `targetRotation` is the desired rotation of body B relative
to body A. The API normalizes a nonzero quaternion. An omitted target is identity.
Use a kinematic endpoint and its local anchor for a moving position target.
Use `replaceJoint` to change spring settings without a new logical joint ID.
Use a six-axis joint for multi-axis control.

The RC1 `point` joint also restores the beta spherical controls.
Use local `axis`, `coneAngle`, `minTwistAngle`, and `maxTwistAngle` for limits.
Angles use radians. Cone limits are in `[0, pi]`. Twist ranges must be ordered
within `[-pi, pi]`. An omitted twist bound uses the corresponding range end.
Use `angularFrequencyHz`, `angularDampingRatio`, `maxSpringTorque`, and
`targetRotation` for an angular spring. Use `angularVelocity` and
`maxMotorTorque` for a relative world-space angular velocity drive.
The point joint still holds its endpoint anchors together.
The cone, twist, spring, and motor artifact checks pass.
These controls do not supply a bounded position spring.

Revolute `targetAngle` and prismatic `targetTranslation` now retain their native
spring controls in RC1. Supply `frequencyHz`, `dampingRatio`, and
the corresponding `maxSpringTorque` or `maxSpringForce`. Zero frequency uses
the native hard-target setting. Zero spring cap means unbounded.

The RC1 `wheel` joint uses body A's local `axis`. Supply `suspension` with
`restLength`, `frequencyHz`, optional `dampingRatio`, and optional `maxForce`.
Supply `minTranslation` or `maxTranslation` for travel limits.
Supply `drive: { speed, maxTorque }` for spin. Supply `steering` with
`targetAngle`, `frequencyHz`, optional `dampingRatio`, optional `maxTorque`,
and optional `minAngle`/`maxAngle` for steering. Contradictory limits throw.
The native wheel uses its one authored axis for travel and spin, as the beta
joint did. Steering uses the first perpendicular body-local joint axis.
Suspension and steering spring caps use zero as unbounded. The spin drive uses
zero as no impulse. The steering constraint and full eight-row combination
pass the rebuilt-artifact checks. Use `stepDeterministicVehicle3D` for the
restored raycast vehicle controller. It reads the canonical native world. It
emits suspension, drive, brake, steering, tire, and dynamic-ground reaction
impulses. Apply those impulses before `world.step()`, or pass
`applyImpulses: true`. The controller uses the world's fixed time step. Use
`vehicles3D`, `tracks3D`, and `powertrain3D` for lower-level vehicle services.
A game must tune and verify its vehicle model after migration.

The controller uses these public types: `DeterministicVehicle3D`,
`DeterministicVehicleWheel3D`, `DeterministicVehicleInput3D`,
`DeterministicVehicleImpulse3D`, `DeterministicVehicleWheelTelemetry3D`,
`DeterministicVehicleStepResult3D`, and `DeterministicVehicleStepOptions3D`.

The RC1 `six_dof` joint restores six independent axis controls through
the owned native world. Set `linearAxes` and `angularAxes` to three-entry tuples.
Each entry accepts `limit`, `motor`, and `spring`. An empty entry is free.
The exported `PhysicsJointAxisInput3D` type defines these entries.
Use `limit: { type: 'locked' }` to hold zero displacement or angle.
Use `limit: { type: 'limited', min, max }` for an ordered interval.
Equal bounds hold a nonzero target. Use `motor: { velocity, maxForce }` for
velocity control. Use `spring: { target, frequencyHz, dampingRatio, maxForce }`
for position or angle control. Spring frequency must be positive.
Zero or omitted `maxForce` means unbounded for all six-axis controls, including
motors. This differs from a basic motor joint's zero drive cap.
Linear caps use force units. Angular caps use torque units. Axis caps apply to
each axis. `maxLinearForce` and `maxAngularTorque` limit the length of the
combined force and torque vectors.

`frameOrientationA` and `frameOrientationB` set body-local joint rotations.
`anchorA` and `anchorB` set body-local joint positions. Axis values use the
joint frame on body A. Angular values use radians. The native angular errors
use the shortest relative quaternion representation and one coordinate per axis.
They are not an Euler-angle decomposition. Omitted frames are identity rotations.
Supplied frame quaternions are normalized before native publication.
Use `collideConnected: false` to exclude endpoint collision.
`breakForce` and `breakTorque` use the full-tick accumulated reaction impulse
divided by the tick duration. Zero means no break threshold.
Six-axis records retain their full configuration and telemetry in checkpoints.
After `readJoint` returns `type: 'six_dof'`, its typed `linearAxes` and
`angularAxes` contain the configuration, position, velocity, active limit/motor
flags, and limit/motor/spring/total impulses. `PhysicsJointAxisState3D` defines
these reads. The frame rotations, collision flag, and break thresholds also
remain available. `reactionLinearImpulse` and `reactionAngularImpulse` are
the accumulated reaction impulse magnitudes, not force or torque values.
The returned values are copies. They do not expose writable native memory.

Each 3D contact event includes `closingSpeed`. This is the nonnegative closing
speed along the reported normal before contact impulses solve. It uses linear
velocity and angular velocity at the reported contact point. It includes the
gravity and update order of that substep. A separating or stationary point
reports zero. Exit events report zero. Checkpoints and the digest retain this
value.
`latest().jointReactions` contains one record for each joint that solved in the
latest tick. The records use stable joint and body IDs. `force` and `torque`
are the reactions on body B. They use force and torque units for the full tick.
The records are sorted by joint ID. A joint that breaks remains in this output
for that tick, even though the world removes the joint.

`latest().breakEvents` contains each joint that broke in the latest tick.
Each event includes the same IDs and reaction. Its `reason` is `impulse`,
`force`, `torque`, or `force-and-torque`. The next successful step clears the
event. Both checkpoint routes retain the latest reaction and break outputs.
The rebuilt collision, break, operation, checkpoint, and shared-cap checks pass.
For a bounded grab, move a kinematic anchor to the target. Connect the body
with a six-axis spring. Set `maxLinearForce` and `maxAngularTorque` on the joint.
Remove the joint when the game-owned break-distance rule is true.

<!-- syncplay-example: physics3d-six-axis-spring -->
```typescript
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: 0, y: 0, z: 0 },
  capacity: { bodies: 2, joints: 1 } })
const handles = world.edit((edit) => {
  const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: 0.1 }, mask: 0 })
  const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: 0.1 },
    mass: 2, mask: 0, linearDamping: 1 })
  const joint = edit.createJoint({ type: 'six_dof', bodyA: anchor, bodyB: body,
    linearAxes: [{ spring: { target: 1, frequencyHz: 4, dampingRatio: 1, maxForce: 6 } },
      { limit: { type: 'locked' } }, { limit: { type: 'locked' } }],
    angularAxes: [{ limit: { type: 'locked' } }, { limit: { type: 'locked' } },
      { limit: { type: 'locked' } }], collideConnected: false })
  return { body, joint }
}).created
world.step()
const speed = world.readBody(handles.body).linearVelocity.x
if (!(speed > 0 && speed <= 6 / 2 / 60 + 1e-6)) throw new Error('Six-axis spring cap failed')
if (world.readJoint(handles.joint).values.length !== 150) throw new Error('Incomplete six-axis record')
world.dispose()
```

<!-- syncplay-example: physics3d-joint-break-output -->
```typescript
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: 0, y: 0, z: 0 },
  capacity: { bodies: 2, joints: 1 } })
const joint = world.edit((edit) => {
  const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: 0.1 }, mask: 0 })
  const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: 0.1 },
    mass: 1, mask: 0, linearDamping: 1 })
  return edit.createJoint({ type: 'motor', bodyA: anchor, bodyB: body,
    linearVelocity: { x: 100, y: 0, z: 0 }, maxMotorForce: 6, breakForce: 1 })
}).created
world.step()
const output = world.latest()
if (output.breakEvents[0]?.jointId !== joint.id) throw new Error('Expected joint break')
if (output.breakEvents[0].reason !== 'force') throw new Error('Expected force break')
if (output.jointReactions[0].force.x <= 0) throw new Error('Expected reaction force')
world.dispose()
```

<!-- syncplay-example: physics3d-native-motor-filter -->
```typescript
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: 0, y: 0, z: 0 },
  capacity: { bodies: 2, joints: 2 } })
try {
  const handles = world.edit((edit) => {
    const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: 0.5 } })
    const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: 0.5 } })
    const filter = edit.createJoint({ type: 'filter', bodyA: anchor, bodyB: body })
    const motor = edit.createJoint({ type: 'motor', bodyA: anchor, bodyB: body,
      linearVelocity: { x: 1, y: 0, z: 0 }, maxMotorForce: 6,
      angularVelocity: { x: 0, y: 0, z: 1 }, maxMotorTorque: 5 })
    return { body, filter, motor }
  }).created
  world.step()
  if (world.latest().contacts.length !== 0) throw new Error('Filtered endpoints must not collide')
  if (world.readBody(handles.body).linearVelocity.x <= 0) throw new Error('Expected motor motion')
  world.edit((edit) => { edit.removeJoint(handles.motor); edit.removeJoint(handles.filter) })
} finally {
  world.dispose()
}
```

<!-- syncplay-example: physics3d-distance-joint -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  capacity: { bodies: 2, joints: 1 },
})
const joint = world.edit((edit) => {
  const first = edit.createBody({ shape: { type: 'sphere', radius: 0.25 } })
  const second = edit.createBody({
    shape: { type: 'sphere', radius: 0.25 },
    position: { x: 2, y: 0, z: 0 },
  })
  return edit.createJoint({
    type: 'distance',
    bodyA: first,
    bodyB: second,
    restLength: 2,
  })
}).created

world.readJoint(joint)
world.dispose()
```

## Performance limits

The measured M5 Max 30 Hz horde ceiling is about 5,000 kinematic capsules when
the step checksum is enabled. It is about 9,000 when that checksum is disabled.
These are desktop measurements. The phone horde ceiling is not measured. Do
not estimate it from these values.

A separate active-contact stack also meets the current desktop limit. Five
balanced Node processes measured 1,000 awake boxes at 10.1129 ms on an Apple M5
Max. The final Chromium and WebKit gate also passed. These desktop results meet
the 33.33 ms frame limit.

The 1,000-body owned-fluid workload used 120 measured steps after 10 warm-up
steps on the same M5 Max. Four fluids added 6.4942% to Node p95. The fluid p50,
p95, and p99 values were 2.0054, 2.4024, and 2.5690 ms. Sixty-four fluids added
4.0711% to Node p95. The values were 2.0548, 2.3476, and 2.5987 ms. Five clean
browser runs kept the measured Chromium and WebKit p95 increase below 5% for
both fluid counts. No mobile fluid result is measured. Do not estimate one.

A Samsung Galaxy S9+ with Android 8.0 produced 2D p99 values of 4.9083,
20.7167, and 41.3333 ms at 100, 500, and 1,000 bodies. The 3D values were
9.2333, 39.1750, and 88.0250 ms. These values characterize one old device.
They do not define an RC support limit. iOS performance is not measured. Do not
estimate other device results from the Android or desktop results.

Measure your final game workload. Include step, digest, checkpoint capture,
rollback restore, projection reads, and portable serialization when it occurs.

## Errors and capacities

Declare body, joint, fluid, and fluid-interaction capacities when you create a
world. Capacity overflow is atomic. Invalid queries, checkpoints, and handles
fail loudly. Restore makes old handles stale. Resolve a new handle from the
stable logical ID after restore.

In RC1, a step fails if motion cannot be
represented. The frame, bodies and outputs stay unchanged. An overflowing
rotation does not produce an identity fallback.

Call `latest()` after `step()` to read contact, joint, break, and fluid
outputs. Call `info()` to read the backend identity, fixed time step, counts,
and capacities. The backend value is `cpp-wasm`.

## World method reference

| Method | Purpose |
| --- | --- |
| `edit()` | Apply one atomic body, joint, and fluid edit. |
| `step()` | Advance one fixed world tick. |
| `applyImpulse()` | Apply a linear impulse at the center or at a world point. |
| `applyForce()` | Add force and optional torque for the next successful tick. |
| `applyForceAtPoint()` | Add one-tick force and derive torque at a world point. |
| `setBodyForce()` | Replace persistent force and torque. |
| `clearBodyForce()` | Clear persistent force and torque. |
| `setBodySurfaceVelocity()` | Replace a body's conveyor surface velocity. |
| `readBody()` | Read body state with a current handle. |
| `readMotion()` | Read settings and motion without copying complex geometry. |
| `readJoint()` | Read joint state with a current handle. |
| `readFluid()` | Read fluid state with a current handle. |
| `resolveBody()` | Resolve a stable body ID to a current handle. |
| `resolveJoint()` | Resolve a stable joint ID to a current handle. |
| `resolveFluid()` | Resolve a stable fluid ID to a current handle. |
| `latest()` | Read contact, joint, break, and fluid output from the latest step. |
| `raycast()` | Return ordered ray hits. |
| `overlap()` | Return ordered overlap hits. |
| `shapeCast()` | Return ordered swept-shape hits. |
| `closestPoints()` | Return ordered closest-point results. |
| `captureCheckpoint()` | Capture complete state in the native checkpoint ring. |
| `restoreCheckpoint()` | Restore one retained checkpoint. |
| `serializeCheckpoint()` | Copy one retained checkpoint to portable bytes. |
| `restore()` | Restore portable bytes atomically. |
| `releaseCheckpoint()` | Release one retained checkpoint. |
| `digest()` | Return the deterministic native-world digest. |
| `info()` | Read backend, frame, settings, counts, and capacities. |
| `dispose()` | Release the world and its native resources. |

## Advanced service namespaces

The `/physics/3d` entry point also exports these service namespaces from the
same canonical artifact: `articulation3D`, `cloth3D`, `deformableQueries3D`,
`distanceConstraints3D`, `fracture3D`, `gears3D`, `lagCompensation3D`,
`massProperties3D`, `particles3D`, `pathJoints3D`, `poweredRagdoll3D`,
`powertrain3D`, `pulleys3D`, `ragdoll3D`, `ropes3D`, `roundedConvex3D`,
`sdfGeometry3D`, `softBodies3D`, `softCollisions3D`, `surfaceVelocity3D`,
`tracks3D`, `vehicles3D`, and the full `stepDeterministicVehicle3D` controller.

These namespaces replace direct beta module imports. They do not expose a
second physics world or a second WASM artifact. The owned world remains the
only mutable rigid-body world.

## RC1 feature scope

The canonical entry point includes convex hull, mesh, terrain, voxel compound,
vehicle, character, articulation, destruction, advanced joint, fluid, and
continuous collision support. Keep a game's working runtime and saved history
until that game's migration checks pass.
