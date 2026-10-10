# Syncplay: 3D physics API v1 <a id="3d-physics"></a>

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
| `vec3(unit, [x, y, z], scale?)` | Build a frozen unit vector from coordinates, a tuple, or an object. The optional scale multiplies each component. |
| `meters3([x, y, z], scale?)` | Build a frozen vector of meters. |
| `portalTransformMatrix3D(pair, entered)` | Render only. The world transform from the space in front of one portal end to the space behind the linked end. |
| `portalVirtualCameraMatrix3D(pair, entered, cameraWorldMatrix)` | Render only. The world matrix of the camera that draws the view through a portal end. |
| `portalExitClipPlane3D(pair, entered)` | Render only. The exit plane as a world-space vec4. Clip geometry behind it. |
| `portalPlaneInCameraSpace3D(plane, cameraWorldMatrix)` | Render only. Converts a world-space plane to camera space. |
| `portalObliqueProjection3D(projection, cameraSpacePlane)` | Render only. Moves the near plane of a projection onto the exit plane. |
| `planPortalViews3D(options)` | Render only. Lists the stencil-recursive portal views for one frame, with a recursion limit, a view budget (`maxViews`, default 64), a culling hook, and an optional screen-rect clip (`screenClip`). Returns a `PortalViewPlan3D`. |
| `portalPoseJumpBodyIds3D(latest)` | Render only. The bodies that crossed a portal in the latest step. It sees only the last step. When a frame runs more than one step, or replays steps after a rollback, compare the teleport counters instead. See [Rendering portals](#rendering-portals). |
| `interpolatePortalBodyPose3D(previous, current, alpha, poseJump)` | Render only. Interpolates a pose and snaps it on a pose jump. |
| `multiplyPortalMatrices(left, right)` | Render only. Multiplies two column-major 4x4 matrices. |
| `fitPortalEnd(world, request)` | Fits a portal end onto a static box host face for a hit point. Returns the pose, or null when it cannot fit. |
| `renderPortalViews3D(options)` | Render only. Draws the portal views of one frame with nested stencil regions, depth first, through renderer hooks. Applies the view budget and the screen clip, puts a `scissor` on each draw when the clip is on, and returns the drawn views as a `PortalViewPlan3D`. |
| `createThreePortalStencilHooks3D(options)` | Render only. The `renderPortalViews3D` hooks for a three.js or react-three-fiber `WebGLRenderer` with a stencil buffer. |

## Public types

| Type | Purpose |
| --- | --- |
| `PhysicsQueryStats3D` | Cost statistics of the last query: `testedBodies`, `visitedNodes`, `preparedBodies`, `treeBuilds`. |
| `PortalRenderPair3D`, `PortalRenderEnd3D`, `PortalRenderEndName` | The portal pair data that the render helpers read. `world.portalPairs` entries match it. |
| `PortalMatrix4`, `PortalPlane4` | A column-major 4x4 matrix and a plane vec4. |
| `PortalView3D`, `PortalViewPlanOptions3D` | One planned portal view, and the planner options. |
| `PortalViewPlan3D` | The planned views in draw order, with a non-enumerable `truncated` flag. |
| `PortalScreenRect3D` | A screen rect in normalized device coordinates: `{ minX, minY, maxX, maxY }`. |
| `PortalInterpolatedPose3D` | A pose that the interpolation helper reads and returns. |
| `PortalPlacementRequest3D`, `PortalPlacement3D` | The `fitPortalEnd` request (host, hit point, normal, up, opening) and its result (position, rotation, `nudged`). |
| `PortalStraddler3D` | One `latest().portalStraddlers` entry: `{ bodyId, pairId, end }`. The body straddles the open end `end` of pair `pairId` after the last step. See [Rendering portals](#rendering-portals). |
| `PortalStencilHooks3D`, `PortalStencilDraw3D`, `PortalStencilState3D`, `PortalStencilRenderOptions3D` | The renderer hooks of `renderPortalViews3D`, one draw request, its stencil state, and the options. |
| `ThreePortalRendererLike`, `ThreePortalCameraLike`, `ThreePortalStencilHooksOptions3D` | The parts of a three.js renderer and camera that the three.js hooks use, and their options. |
| `PhysicsSupportPortal3D` | The `portal` field of a vehicle support row found through a portal: `{ pair, end }`. `applySupport` moves the row to the support side. |
| `PhysicsJointPortal3D` | The `portal` option of a joint: `{ pair, end }`. bodyA is in front of `end`, and bodyB is in front of the linked end. |
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

Set `capacity.checkpoints` to declare retained checkpoint capacity. The default
is 64. Values from 1 through 4096 are valid. Release checkpoints after use to
make their slots available again.

RC.19 uses world ABI 9. `info().worldAbiVersion` returns 9. Its public
TypeScript type changed from the literal 8 to the literal 9. The JavaScript
code requires a matching WASM build at initialization.

Await initialization once. Set the fixed tick rate and capacity when you create
the world. Call `step()` with no argument.

<!-- syncplay-example: physics3d-world-lifecycle -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()

const world = createPhysicsWorld3D({
  tickRate: 30,
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(-9.8), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 64, joints: 16 },
})

const ball = world.edit((edit) => edit.createBody({
  kind: 'dynamic',
  shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) },
  position: { x: syncplayUnits.meters(0), y: syncplayUnits.meters(4), z: syncplayUnits.meters(0) },
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  substeps: 1, velocityIterations: 1, contactHertz: syncplayUnits.hertz(0), contactSpeed: syncplayUnits.metersPerSecond(0),
  capacity: { bodies: 2, joints: 0 },
})
try {
  const ball = world.edit((edit) => {
    edit.createBody({ kind: 'static', shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) }, friction: 0 })
    return edit.createBody({
      shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) },
      position: { x: syncplayUnits.meters(0.9), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0) },
      linearVelocity: { x: syncplayUnits.metersPerSecond(-1), y: syncplayUnits.metersPerSecond(0), z: syncplayUnits.metersPerSecond(0) },
      angularVelocity: { x: syncplayUnits.radiansPerSecond(0), y: syncplayUnits.radiansPerSecond(0), z: syncplayUnits.radiansPerSecond(1) },
      inertia: { xx: syncplayUnits.kilogramMetersSquared(1), yy: syncplayUnits.kilogramMetersSquared(1), zz: syncplayUnits.kilogramMetersSquared(1) },
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  initPhysics3D, createPhysicsWorld3D, createVoxelChunk, setVoxelCell, cookVoxelBody,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const chunk = createVoxelChunk(5, 1, 1)
setVoxelCell(chunk, 0, 0, 0, true)
setVoxelCell(chunk, 4, 0, 0, true)
const cooked = cookVoxelBody(chunk, syncplayUnits.kilograms(12), { originOffset: { x: syncplayUnits.meters(-2), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0) } })
if (cooked.status !== 0) throw new Error('Expected an occupied voxel body')
const world = createPhysicsWorld3D({ capacity: { bodies: 1, joints: 0 } })
try {
  world.edit((edit) => edit.createBody({ kind: 'dynamic', ...cooked.body }))
  const gap = world.raycast({ x: syncplayUnits.meters(0), y: syncplayUnits.meters(2), z: syncplayUnits.meters(0), dx: 0, dy: -1, dz: 0, maxDistance: syncplayUnits.meters(4) })
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  cookVoxelBody, createPhysicsWorld3D, createVoxelChunk, initPhysics3D, setVoxelCell,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const chunk = createVoxelChunk(3, 1, 1)
setVoxelCell(chunk, 0, 0, 0, true)
setVoxelCell(chunk, 2, 0, 0, true)
const cooked = cookVoxelBody(chunk, syncplayUnits.kilograms(0.25), { originOffset: { x: syncplayUnits.meters(-1), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0) } })
if (cooked.status !== 0) throw new Error('Expected an occupied voxel body')
const world = createPhysicsWorld3D({
  tickRate: 60,
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(-10), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 1, joints: 0, fluids: 1, fluidInteractions: 1 },
})
try {
  const created = world.edit((edit) => ({
    body: edit.createBody({ kind: 'dynamic', ...cooked.body, sleepEnabled: false }),
    fluid: edit.createFluid({
      bounds: { minX: syncplayUnits.meters(-2), minY: syncplayUnits.meters(-2), minZ: syncplayUnits.meters(-1), maxX: syncplayUnits.meters(2), maxY: syncplayUnits.meters(1), maxZ: syncplayUnits.meters(1) },
      density: syncplayUnits.kilogramsPerCubicMeter(1),
      linearDragPerSecond: syncplayUnits.perSecond(2),
      angularDragPerSecond: syncplayUnits.perSecond(1),
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  tickRate: 60,
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 1, joints: 0 },
})
try {
  const body = world.edit((edit) => edit.createBody({
    shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) },
    mass: syncplayUnits.kilograms(1),
    linearDamping: 1,
    sleepEnabled: false,
  })).created
  world.applyForce(body, { x: syncplayUnits.newtons(60), y: syncplayUnits.newtons(0), z: syncplayUnits.newtons(0) })
  world.step()
  if (world.readBody(body).linearVelocity.x !== 1) throw new Error('Missing one-tick force')
  world.step()
  if (world.readBody(body).linearVelocity.x !== 1) throw new Error('Force did not clear')
  world.setBodyForce(body, { x: syncplayUnits.newtons(60), y: syncplayUnits.newtons(0), z: syncplayUnits.newtons(0) })
  world.step()
  world.clearBodyForce(body)
} finally {
  world.dispose()
}
```

<!-- syncplay-example: physics3d-buoyancy-force -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  initPhysics3D, createPhysicsWorld3D, calculatePhysicsBuoyancy,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const gravity = { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(-10), z: syncplayUnits.metersPerSecondSquared(0) }
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: gravity,
  capacity: { bodies: 1, joints: 0 } })
try {
  const body = world.edit((edit) => edit.createBody({ kind: 'dynamic',
    shape: { type: 'sphere', radius: syncplayUnits.meters(1) }, mass: syncplayUnits.kilograms(1) })).created
  const result = calculatePhysicsBuoyancy(world.readBody(body), { waterY: syncplayUnits.meters(0), density: syncplayUnits.kilogramsPerCubicMeter(1), gravity })
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { createPhysicsWorld3D, initPhysics3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ capacity: { bodies: 3, joints: 0 } })
try {
  for (const shape of [
    { type: 'cylinder', radius: syncplayUnits.meters(0.75), halfHeight: syncplayUnits.meters(1), topRadius: syncplayUnits.meters(0.5) },
    { type: 'cone', radius: syncplayUnits.meters(0.75), halfHeight: syncplayUnits.meters(1) },
    { type: 'tapered_capsule', bottomRadius: syncplayUnits.meters(0.75), halfHeight: syncplayUnits.meters(1), topRadius: syncplayUnits.meters(0.5) },
  ] as const) {
    const body = world.edit((edit) => edit.createBody({ kind: 'static', shape })).created
    const hit = world.raycast({ onlyBody: body,
      x: syncplayUnits.meters(-3), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0), dx: 1, dy: 0, dz: 0, maxDistance: syncplayUnits.meters(6),
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
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
      scale: { x: syncplayUnits.meters(1), y: syncplayUnits.meters(1), z: syncplayUnits.meters(1) }, heights: [syncplayUnits.meters(0), syncplayUnits.meters(0), syncplayUnits.meters(0), syncplayUnits.meters(0)],
    },
  })).created
  const motion: PhysicsBodyMotion3D = world.readMotion(terrain)
  if (motion.shape.type !== 'heightfield') throw new Error('Missing terrain')
  const hit = world.raycast({
    onlyBody: terrain,
    x: syncplayUnits.meters(0.25), y: syncplayUnits.meters(2), z: syncplayUnits.meters(0.25),
    dx: 0, dy: -1, dz: 0, maxDistance: syncplayUnits.meters(4),
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  createPhysicsWorld3D,
  initPhysics3D,
  type PhysicsBodyId3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()

const physics = createPhysicsWorld3D({
  tickRate: 30,
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 32, joints: 0 },
})

physics.edit((edit) => edit.createBody({
  kind: 'static',
  shape: { type: 'box', halfX: syncplayUnits.meters(0.5), halfY: syncplayUnits.meters(1), halfZ: syncplayUnits.meters(0.5) },
  position: { x: syncplayUnits.meters(5), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0) },
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
    x: syncplayUnits.meters(0),
    y: syncplayUnits.meters(0),
    z: syncplayUnits.meters(0),
    dx: 1,
    dy: 0,
    dz: 0,
    maxDistance: syncplayUnits.meters(20),
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
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
  shape: { type: 'capsule', radius: syncplayUnits.meters(0.4), halfHeight: syncplayUnits.meters(0.8) },
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
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
  shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) },
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
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
  shape: { type: 'box', halfX: syncplayUnits.meters(1), halfY: syncplayUnits.meters(1), halfZ: syncplayUnits.meters(1) },
}))

world.overlap({ x: syncplayUnits.meters(0), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0), shape: { type: 'sphere', radius: syncplayUnits.meters(0.2) } })
world.shapeCast({
  x: syncplayUnits.meters(-3), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0),
  shape: { type: 'sphere', radius: syncplayUnits.meters(0.2) },
  dx: 1, dy: 0, dz: 0,
  maxDistance: syncplayUnits.meters(10),
})
world.closestPoints({ x: syncplayUnits.meters(3), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0), maxDistance: syncplayUnits.meters(10) })
world.dispose()
```

### Batched rays

`world.raycastBatch(queries)` runs 1 to 64 raycasts and returns each ray's hits
in order. The results equal separate `raycast` calls. With no open portal pair,
all rays run in one native call. Batched rays cannot set `onlyBody`.

### Query cost

Queries use a spatial index. A query tests only the bodies whose bounds overlap
the query bounds, so its cost does not grow with the number of bodies far from
it. Results are bit-identical to a linear scan: the same hits, order, points,
and normals. A world definition with `queryIndex: false` selects the linear
scan, for verification.

`world.queryStats()` reports the cost of the last native raycast, overlap, or
shape cast:

| Field | Meaning |
| --- | --- |
| `testedBodies` | Bodies whose narrow-phase test ran. |
| `visitedNodes` | Index tree nodes whose bounds the query tested, the top node included. A query on a one-body world visits 1 node. |
| `preparedBodies` | Bodies that the index prepared (validated and bound to their shape and geometry) since the previous native query. |
| `treeBuilds` | Full tree builds since the previous native query. |

`raycastBatch` reports the sum over its rays. The index maintenance runs
once, at the first ray. The linear scan reports 0 for `visitedNodes`,
`preparedBodies`, and `treeBuilds`. A query on an empty world reports 0 for
all four.

These fields are cost diagnostics, not simulation state. They are not part of
checkpoints or digests. Two peers with the same state can report different
values for the same query when their histories differ. Do not use them in
game logic.

The index is derived state. The first query after a change brings it up to
date with the world:

- A body is prepared again only when its definition changes: a row field
  other than its pose, velocities, and sleep state, or its geometry. A step, a
  `setBodyTransform`, or a velocity change prepares nothing. A `replaceBody`
  that changes only velocity or sleep state prepares nothing. A carve
  (`carveVoxelBody3D`), a shape change, or a collision filter change prepares
  that body only.
- A topology edit changes only the affected leaves: an added body is inserted,
  a removed body is taken out, and an edited body is updated in place. The tree
  is not built again.
- A tree leaf holds the body bounds plus a 0.1 m margin. A body that moves
  less than the margin does not change the tree.
- Static bodies and moving (dynamic or kinematic) bodies have separate
  subtrees. The next query builds the tree again from the current bounds,
  without preparing any body again, when either subtree degrades:
  - the sum of the surface areas of its internal nodes passes 2 times its
    value at the last build (bodies spread apart; a large static floor does
    not hide this);
  - that sum, with each node capped at the area of the box around the middle
    90% of the bodies, and divided by that area, passes 2 times its value at
    the last build (bodies regroup into a smaller region, also with a few far
    bodies); or
  - a window of 8 queries visits more than 4 times the nodes that a balanced
    tree needs for the bodies they test (any other degraded tree, for example
    bodies that regroup next to a large far group). If the first window after
    such a rebuild still visits that many, the query mix costs that much on
    any tree, and this check pauses for 8 windows, then twice as long each
    time that repeats, up to 1,024 windows. A rebuild that helps resets the
    pause length.

  The first two depend only on the index state. The third also depends on
  the queries a peer runs. None of them changes a query result.
- A restore (`restoreCheckpoint` or `restore(bytes)`), an import, or a state
  replacement makes the next query build the tree from the restored state, as
  a new world that only opened the same checkpoint would. That query then
  reports `treeBuilds: 1` and the same `testedBodies` and `visitedNodes` as
  such a world. It prepares only the bodies that changed since the capture; a
  new world prepares every body. Unchanged bodies keep their prepared shapes,
  also across `restore(bytes)`, which resolves geometry with the same content
  to the same record.

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
pass the rebuilt-artifact checks. Use `stepDeterministicVehicleState3D` (behavior revision 2) for deterministic
raycast vehicle simulation with parking and light dynamic support stability.
The legacy controller `stepDeterministicVehicle3D` (revision 1) is deprecated;
revision 1 flings dynamic supports when support mass is light relative to the chassis
and lacks parking state management.

Revision 2 features:
- **Stable light dynamic supports**: Light ground bodies (e.g. 0.12 kg scrap pipes)
  under wheels do not experience extreme repulsion velocity spikes.
- **Native parking & sleep**: Vehicles settle into sleep at rest, and input or
  support changes wake them.
- **Parked cost optimization**: While parked, the controller checks support body
  sleep and mobility first, then performs single-body targeted raycasts rather
  than full-scene broadphase queries.
- **Options**:
  - `apply`: boolean (defaults to `true`). Automatically applies generated
    support forces/springs to the world.
  - `checksumMode`: 'required' | 'disabled' (defaults to 'required'). Set to
    `'disabled'` to omit checksum serialization overhead, yielding an ~80%
    step cost reduction when parked.

The revision 2 vehicle step (`stepDeterministicVehicleState3D`) casts all
wheels in one native call and reads its support bodies in one batch. Results
are bit-identical to separate reads. Set `wheelCastLayerMask` on the vehicle
definition to let the wheel rays skip layers, for example a cage around the
vehicle. The default tests every layer, and a mask of `0xffffffff` gives the
same results as no mask.

The controller uses these public types: `DeterministicVehicle3D`,
`DeterministicVehicleWheel3D`, `DeterministicVehicleInput3D`,
`DeterministicVehicleImpulse3D`, `DeterministicVehicleWheelTelemetry3D`,
`DeterministicVehicleStepResult3D`, `DeterministicVehicleStepOptions3D`,
`DeterministicVehicleDefinition3D`, and `DeterministicVehicleState3D`.

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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 2, joints: 1 } })
const handles = world.edit((edit) => {
  const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) }, mask: 0 })
  const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) },
    mass: syncplayUnits.kilograms(2), mask: 0, linearDamping: 1 })
  const joint = edit.createJoint({ type: 'six_dof', bodyA: anchor, bodyB: body,
    linearAxes: [{ spring: { target: syncplayUnits.meters(1), frequencyHz: syncplayUnits.hertz(4), dampingRatio: 1, maxForce: syncplayUnits.newtons(6) } },
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 2, joints: 1 } })
const joint = world.edit((edit) => {
  const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) }, mask: 0 })
  const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) },
    mass: syncplayUnits.kilograms(1), mask: 0, linearDamping: 1 })
  return edit.createJoint({ type: 'motor', bodyA: anchor, bodyB: body,
    linearVelocity: { x: syncplayUnits.metersPerSecond(100), y: syncplayUnits.metersPerSecond(0), z: syncplayUnits.metersPerSecond(0) }, maxMotorForce: syncplayUnits.newtons(6), breakForce: syncplayUnits.newtons(1) })
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 2, joints: 2 } })
try {
  const handles = world.edit((edit) => {
    const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) } })
    const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.5) } })
    const filter = edit.createJoint({ type: 'filter', bodyA: anchor, bodyB: body })
    const motor = edit.createJoint({ type: 'motor', bodyA: anchor, bodyB: body,
      linearVelocity: { x: syncplayUnits.metersPerSecond(1), y: syncplayUnits.metersPerSecond(0), z: syncplayUnits.metersPerSecond(0) }, maxMotorForce: syncplayUnits.newtons(6),
      angularVelocity: { x: syncplayUnits.radiansPerSecond(0), y: syncplayUnits.radiansPerSecond(0), z: syncplayUnits.radiansPerSecond(1) }, maxMotorTorque: syncplayUnits.newtonMeters(5) })
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  createPhysicsWorld3D,
  initPhysics3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  capacity: { bodies: 2, joints: 1 },
})
const joint = world.edit((edit) => {
  const first = edit.createBody({ shape: { type: 'sphere', radius: syncplayUnits.meters(0.25) } })
  const second = edit.createBody({
    shape: { type: 'sphere', radius: syncplayUnits.meters(0.25) },
    position: { x: syncplayUnits.meters(2), y: syncplayUnits.meters(0), z: syncplayUnits.meters(0) },
  })
  return edit.createJoint({
    type: 'distance',
    bodyA: first,
    bodyB: second,
    restLength: syncplayUnits.meters(2),
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


## Portal physics and wall apertures

Syncplay 3D physics provides first-class support for deterministic portal pairs and wall aperture cutouts across dynamic rigid bodies, character controllers (KCC), and raycasts.

### Host walls

Wall portals name a `hostBodyId` in `PortalEndDefinition`: the wall or collider
that contains the portal opening.

- **Layers**: a host wall keeps its own collision layer and mask. Games keep all
  32 layers.
- **Contacts**: before each step, the world excludes contacts between a host
  wall and the bodies inside one of its openings. Bodies outside the opening
  still touch the wall.
- **Count**: the number of host walls is limited only by body capacity.
- **Queries**: a query layer mask applies to host walls like any other body.
- **Aperture margin**: containment uses a 0.05 m margin, so resting and sliding
  bodies at floor-level doorways pass without catching on the wall.

### Queries through portals

Raycasts, shape casts, and overlaps pass through open portals. A shape cast
follows its center: when the center enters an opening and the shape fits it,
the cast continues from the linked end with the direction and orientation
turned. An overlap that straddles an opening also tests the space in front of
the linked end. Hits found through a portal carry `portalHops` and
`portalPath` (the pair ids in the order the query crosses them), and report
world points on the far side. Set `maxPortalDepth: 0`
on a query to ignore portals. Raycasts and shape casts cross up to
`maxPortalDepth` portals (default 2). An overlap crosses at most one portal.

**Queries that start inside an opening.** Each open portal end has an opening
region. It is the opening rectangle pushed back behind the end's plane, to a
depth D = max(width, height) * 1.5 + 2 metres. For a 3 x 2.4 m opening, D is
6.5 m. The region includes the thickness of the host wall and the space past
the wall inside the rectangle. A point exactly on the plane, or in front of
it, is not inside. The query origin is its `x`, `y`, `z`: the ray origin, the
start center of a shape cast, or the center of an overlap. Only the origin is
tested, not the extent of the shape.

A query starts in real space from its own origin by default, as in rc.34,
also inside an opening region. Set `insideOpening: 'linked'` on a `raycast`,
a `raycastBatch` ray, a `shapeCast`, or an `overlap` to use the linked start:
when its origin is inside an opening region, the query runs from the linked
end. The
origin, the direction, and the shape orientation turn through the pair. The
host of the entry end is ignored. Geometry behind the entry plane in real
space is not reported. Hits report the real body, world point, and normal on
the far side. Distances are measured from the original origin. The inside
start counts as one hop: a hit carries `portalHops: 1` and `portalPath` with
the pair id, as a hit through the opening does. The query then continues with
the remaining depth and the normal crossing rules. A shape cast that fits the
linked opening does not report the linked end's host. An overlap drops the
linked end's host and the hits behind the linked plane. If the overlap shape
also reaches in front of the entry plane, the overlap also keeps the hits in
front of that plane. A query with `maxPortalDepth: 0` ignores portals: it
runs in real space from its own origin, also with `insideOpening: 'linked'`.
If the origin is inside more than one region, the lowest pair id wins, and
end A wins over end B. Ends of closed or removed pairs are not openings.
Vehicle wheel rays keep the rule in "Wheels through portals". The character
controller does not set `insideOpening`, so it collides as in rc.34.

The trade-off of the linked start: such a query cannot see the geometry that
is behind a wall portal, inside the rectangle, within depth D. Use it for
probes of a body that is passing through the opening (a wheel, a foot, a
held object), not for sensors in the room behind the wall. A linked query
does not see the part of another body that is behind the same entry plane:
that part is at the linked end only as a hidden clone, and queries do not
report hidden copies. To find such a body, query in real space. A shape
cast that starts in an exit opening against the exit host (after a crossing,
or with a linked start) and moves into the opening's edge reports the exit
host at the edge. That contact uses the shape's bounding box, so a round
shape meets the edge early, by less than about 0.3 times its radius, never
late.

### Bodies across an opening

A body that straddles an open portal end touches what is in front of the
linked end, as one body:

- **Static geometry (bubbles)**: static boxes in front of the linked end are
  copied behind this end. Only the bodies that straddle the opening touch the
  copies. A box half through a wall portal rests on the floor in front of the
  linked end.
- **Moving bodies (shadow clones)**: a straddling dynamic body has a clone at
  the linked end. A push on the clone moves the original by the turned
  impulse in the same step. Stacks across a floor-to-ceiling pair are stable,
  also with a heavy body on the clone. The solver treats the clone and the
  original as one rigid body, so a load on the clone, and a joint through a
  pair, act on the original like a load or joint on the original itself.
  A straddling kinematic body has a kinematic clone that pushes bodies at the
  linked end. Only a body whose shape fits the opening straddles it and has a
  clone; a larger body touches nothing through the opening.
- **Crossing**: a body with a clone crosses onto the clone pose exactly, so
  there is no pop.
- **Hidden**: bubbles and clones are not in queries, contacts, motion and
  transform reads, edit results, `info()` counts, or capacity, and they have
  no public handle. They exist only while a body straddles an open end, so an
  idle portal costs nothing extra. They are part of checkpoints, so rollback
  and late join stay bit-identical.
- **Limits**: fluids act on the original only. While any body uses CCD,
  clones touch nothing, as before rc.35, and vehicle support rows stay on the
  chassis. Bubbles and joints through portals still work. A joint through a
  portal cannot use a CCD bodyB. After a world has run CCD, clones push and
  stop moving bodies but do not separate overlap at once. A clone keeps the original's motion locks
  on the axes that the pair rotation maps onto axes, and all of them when every
  linear or every angular axis is locked. Through a pair turned by an angle
  that is not a quarter turn, a partly locked body's clone loses the other
  locks, so a hit along a locked axis moves the clone and the original does not
  take the full response. A step that fails (for example because an output
  capacity is too small) changes no body, but the hidden copies it made for
  that step stay, so later body ids differ from a world that never failed;
  every peer makes the same ones. Restore a checkpoint after a failed step if a
  later edit must match a world that did not fail. Copies are one level deep. When a body is longer than the gap between two
  chained portals, its copy at the first exit can enter the second opening. The
  copy passes the second end's host there, as a real body does, but nothing
  copies it again, so it touches nothing beyond the second exit. When the body
  then crosses the first portal, geometry close beyond the second exit can push
  it back through the first portal (rc.34 behaves the same, with larger jumps).
  Keep such chained ends farther apart than the longest body that crosses them. A clone touches the moving bodies that, at the start of a step, are
  partly in front of its end and within the end's tracking radius plus the
  distance they move in the step at their current speed. A body that comes
  from behind the end's plane, or that a force or a hit speeds up from beyond
  that reach inside one step, meets the clone one step late, as a fast body
  without CCD can pass a thin body. A clone has the whole body shape, also the part
  still behind its exit plane (the part not yet through the entry). A moving
  body beside the exit opening that touches that hidden part pushes the
  original. Host walls hide that part for a hosted end. A body on an ordinary joint (not a joint
  through the portal) teleports when its center crosses, and the joint then
  pulls it back across the gap between the ends (rc.34 behaves the same).
  Create such a joint through the portal (`portal: { pair, end }`), or keep
  jointed bodies away from openings. `portalable` controls only where a
  portal end can be placed, not which bodies cross.

### Moving portal hosts

A portal end on a kinematic host moves with the host. A body that crosses it
keeps its velocity relative to the moving portal: a body at rest that a portal
sweeps over leaves the linked end at the portal speed. `movePortalEnd` sets a
new pose relative to the host. An end follows its host at the start of each
step, so after a `setBodyTransform` on the host, queries and `portalPairs`
show the old end pose until the next step. A pose change by `setBodyTransform`, `setTransform`, `edit.atomicTeleport`
or `edit.replaceBody` is motion when the body moves no more than its shape
radius plus 0.5 m: it can cross a portal, as velocity-driven motion does. A
longer jump is a teleport and never counts as a crossing (a respawn behind a
portal wall stays there); the body's side of each end is taken at the start
of the next step, so its motion in that step can cross. An end on a kinematic host that a host jump moves
by up to 1 m sweeps the bodies in its way; a longer end jump does not. Static geometry seen through a moving end moves
with that end, so a box that rests on it is carried. A turning host gives that
geometry the host velocity at the portal center.

### Wheels through portals

A deterministic vehicle wheel whose anchor is behind an open portal end, while
the chassis center is in front of it, casts its ray from the linked end. The
car keeps all wheels on the ground as it drives through a doorway portal.
Contact points and normals are reported on the chassis side. Support rows
found through a portal carry `portal: { pair, end }`; `world.applySupport`
applies them at the real contact point on a moving support, so manual and
automatic application give the same result.

### Joints through portals

Set `portal: { pair, end }` on a joint to connect it through a portal pair.
bodyA is in front of `end`, and bodyB is in front of the linked end. bodyB must
exist before the edit that creates the joint. The joint acts on bodyB as seen
through the pair. When either body crosses the pair, the joint switches between
acting through the pair and acting directly. `readJoint` reports the real
bodyB. Removing the pair, the joint, or either body removes the joint in that edit,
also while it acts directly.

### Placing movable portals

`fitPortalEnd(world, { hostBodyId, point, normal, up, opening })` fits a portal
end onto a static box host, for example where a portal gun ray hits a wall. It
picks the host face that matches `normal`, turns the opening so its height
follows `up`, and moves it fully onto the face when it hangs over an edge
(`nudged: true`). It returns null when the face is too small, the host is not a
static box, the host is not portalable, or the opening would overlap another
portal end on the face. Set `portalable: false` on a body, or call
`edit.setPortalable(body, false)`, to keep portals off it.

### Portal view budget and screen clip

With N open pairs, the full view tree grows about (2N - 1)^depth.
`planPortalViews3D` keeps at most `maxViews` views. The default is 64, and the
value must be an integer of at least 1. The planner selects views breadth
first and asks the cull hook only about the children of views that it keeps.
It never walks the full tree. It asks the hook one depth at a time, in
priority order, and stops once the budget is full and one more end has
passed. Keep the hook free of side effects.

When more views pass culling than the budget allows, the planner keeps them in
this order:

1. Whole depths first. Every kept view at depth d comes before any view at
   depth d + 1.
2. Within a depth, the larger screen rect first (only with `screenClip` on).
3. Then the children of the higher-ranked parent.
4. Then the lower pair id, then end A before end B.

A kept view always has its parent. The plan still lists the views depth first,
in draw order. `plan.truncated` is true when the budget left out at least one
view that passed culling and the depth limit. Ends that the hook, the default
rule, the depth limit, or the screen clip removed do not count. `truncated` is
a non-enumerable property, so a plan still deep-equals a plain array.

Set `screenClip: true` and pass the eye `projection` to give each view a
scissor rect, `screenRect`. A projection alone does not turn the clip on.
Rects are in normalized device coordinates (NDC): x and y in [-1, 1], +x
right, +y up. A view's rect is the screen bounds of the opening that it
enters, seen from the parent camera. The planner clips the opening to the
visible side of the near plane of that level and cuts the result to the
parent's rect. At depth 1 the near plane comes from the eye projection. Deeper,
it comes from the parent's oblique projection, so geometry behind the parent's
exit plane does not count. Rects nest: each rect lies in its parent's rect,
and depth-1 rects lie in the viewport. A child end with an empty rect is
culled, with all its children.

With the clip on, the planner culls an empty rect before it calls the hook.
The hook also gets `parentScreenRect` (the viewport at depth 1) and the end's
own `screenRect`. A hook still replaces the default rule, which keeps an end
when the camera is in front of it. With no hook, that rule still applies. When
a hook keeps an end that the camera is behind, the view through it has no
valid oblique near plane, and the clip shows no view through it.

`renderPortalViews3D` plans with its own options, so `maxViews` and
`screenClip` apply there too. It returns the views that it drew, with the
plan's `truncated` flag. With the clip on, each draw carries a `scissor`. The
scene draw of a view gets the view's rect. The three portal-surface draws of a
child get the child's rect. The eye's scene draw has no scissor. The stencil
stays authoritative; the scissor only saves fill.

`createThreePortalStencilHooks3D` applies the scissor when the renderer has
`getSize`, `setScissor`, and `setScissorTest`. A three.js `WebGLRenderer` has
all three. The hooks turn the scissor test off after each draw. A custom
renderer converts NDC to pixels from the bottom-left corner and rounds
outward: `x0 = floor((minX + 1) / 2 * width)` and
`x1 = ceil((maxX + 1) / 2 * width)`, and the same for y with the height.

Each child portal gets three surface draws: one marks its stencil region; one
resets the depth in that region to the far plane (its `projection` pins clip
z to clip w) before the inner view draws; and one unmarks the region after
the inner view and writes the surface depth. The reset draw has
`fill: 'background'` and `colorWrite: true`: it writes the background color
of the view about to draw, not the surface color, so a pixel where the inner
view draws nothing shows that view's background and not an earlier view
under it (for example a farther portal that overlaps a nearer one on screen). The reset and unmark draws have
`stencil.depthTest: 'always'`, because the inner view's depth comes from an
oblique projection and does not compare with the outer level's depth, and a
nearer portal must not be culled by the depth of a farther one. A custom
renderer must pass every fragment in those draws (depth function ALWAYS) and
change the stencil on a depth fail too. The reset writes depth exactly 1 (the
far plane), so it assumes a standard depth buffer: with a logarithmic or
reversed depth buffer, reset the depth in the marked region yourself. With a
three.js `Color` scene background, the hooks clear the frame once to that
color and draw each scene with no background (three.js would otherwise clear
the stencil on every render); a texture or environment background draws
through the stencil as usual. The three.js hooks set
`THREE.AlwaysDepth` on the portal surface object's materials (and its
children's) for that draw only, so give the surface object a material, for
example a `Mesh` with a `MeshBasicMaterial`. In the reset draw, the hooks
draw each `MeshBasicMaterial` of the surface object as a flat color: the
`Color` scene background, or the clear color when the scene has no
background (with no map, full opacity, and no tone mapping, as a clear). A
surface with no `MeshBasicMaterial` writes no color in that draw.

<!-- syncplay-example: physics3d-portal-view-budget -->
```typescript
import { planPortalViews3D, type PortalRenderPair3D } from '@series-inc/rundot-syncplay/physics/3d'

// Two ends that face each other make an infinite corridor.
const corridor: PortalRenderPair3D = {
  id: 1,
  open: true,
  portalA: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, opening: { width: 1, height: 2 } },
  portalB: { position: { x: 0, y: 0, z: 10 }, rotation: { x: 0, y: 1, z: 0, w: 0 }, opening: { width: 1, height: 2 } },
}
// The eye is between the ends and looks at A. B is behind the eye.
const eye = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1]
// A 90-degree field of view, square aspect, near plane 0.1, far plane 100.
const projection = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -100.1 / 99.9, -1, 0, 0, -20 / 99.9, 0]

const plan = planPortalViews3D({ cameraWorldMatrix: eye, pairs: [corridor], maxViews: 2, screenClip: true, projection })
// The clip culls B. The budget keeps A and the A behind it.
if (plan.length !== 2 || !plan.truncated) throw new Error('Expected two views and a truncated plan')

// Convert each rect to a pixel scissor on a 1280 x 720 canvas.
for (const view of plan) {
  const rect = view.screenRect
  if (rect === undefined) throw new Error('Expected a screen rect')
  const x0 = Math.floor(((rect.minX + 1) / 2) * 1280)
  const x1 = Math.ceil(((rect.maxX + 1) / 2) * 1280)
  const y0 = Math.floor(((rect.minY + 1) / 2) * 720)
  const y1 = Math.ceil(((rect.maxY + 1) / 2) * 720)
  if (!(x1 > x0 && y1 > y0)) throw new Error('Expected a non-empty pixel scissor')
}
```

### Rendering portals

The world gives a renderer two pieces of portal render state. Both are part of
checkpoints, so they stay correct after a rollback, a restore, and a late join.

**Teleport counters.** Each body has an unsigned 32-bit teleport counter. A
new body starts at 0. The counter increases by 1 for each pose jump:

- a portal crossing in `world.step()`;
- an ejection when `setPortalOpen(pair, false)`, `movePortalEnd`, or
  `removePortalPair` pushes a straddling body out;
- `edit.atomicTeleport(body, pose)` on a body from an earlier edit;
- `world.setBodyTransform` and `world.setTransform` when the call changes the
  pose. A call with the same pose, or with the same rotation and the opposite
  quaternion sign, does not count.

Integration, contacts, CCD, a moving portal host, `replaceBody`, and restores do
not change a counter. A removed body loses its counter.

To read the counters, give `world.writeBodyMotionInto` a fifth output, a
`Uint32Array` at least as long as the body count. Row `i` gets the counter of
body `ids[i]`. `world.writeCheckpointBodyMotionInto` and the
`PhysicsCheckpointView3D.writeBodyMotionInto` of a runtime view take the same
output and report the counters that the checkpoint recorded. Each
`latest().motionBatch.bodies` entry also carries `teleports`.

Keep the counters of the previous frame. When the counter of a body changed,
draw the body at its current pose and do not blend from the previous pose. The
counter wraps, so compare with `!==`, not `<`. This also finds a crossing in an
early step of a frame with more than one step, which
`portalPoseJumpBodyIds3D(world.latest())` does not see.

A world in which a body jumped carries its counters in the checkpoint bytes and
in `world.digest()`. Only a world with no portal pair and no pose jump keeps
the bytes and digest it had before rc.35, and only when every orientation it
was given normalizes the same way: rc.35 normalizes orientations with an exact
square root, not `Math.hypot`, so an orientation that is not exactly unit
length can be stored 1 ULP different. A pose jump also happens without
portals: a pose-changing `setBodyTransform` or `setTransform` call (a
respawn, for example) and `edit.atomicTeleport` count one.

**Straddlers.** `world.latest().portalStraddlers` lists the bodies that straddle
each open end after the last step, as `PortalStraddler3D` entries sorted by
`bodyId`, `pairId`, and `end`. The test uses the post-step poses and the rule
that gives a body a shadow clone: the shape box fits the opening and crosses
the end plane. Static bodies and portal hosts are never listed. For each entry,
draw a second copy of the body at the linked end. The copy world matrix is
`portalTransformMatrix3D(pair, end)` times the body world matrix. Clip the copy
with `portalExitClipPlane3D(pair, end)`. `world.checkpointLatest(checkpoint)` and
runtime views report the list that the checkpoint recorded.

The list comes from the last step. Between steps it stays the same, except that
closing or removing a pair drops the entries of that pair, `movePortalEnd` drops
the entries of that end, and removing a body drops its entries. An edit or a
transform call does not add, move, or drop entries.

<!-- syncplay-example: physics3d-portal-render-state -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import {
  createPhysicsWorld3D, initPhysics3D, portalExitClipPlane3D, portalTransformMatrix3D,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const zero = syncplayUnits.metersPerSecondSquared(0)
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: zero, y: zero, z: zero },
  capacity: { bodies: 4, joints: 0 } })
try {
  const identity = { x: 0, y: 0, z: 0, w: 1 }
  const opening = { width: 2, height: 2 }
  const half = syncplayUnits.meters(0.4)
  world.edit((edit) => {
    edit.createPortalPair({
      portalA: { position: { x: 0, y: 1, z: 0 }, rotation: identity, opening },
      portalB: { position: { x: 20, y: 1, z: 0 }, rotation: identity, opening },
    })
    // Half through end A, moving into it at 1 m/s.
    edit.createBody({ kind: 'dynamic', position: syncplayUnits.meters3([0, 1, 0.1]),
      shape: { type: 'box', halfX: half, halfY: half, halfZ: half },
      linearVelocity: syncplayUnits.vec3(syncplayUnits.metersPerSecond, [0, 0, -1]) })
  })

  const rows = 4
  const poses = new Float64Array(rows * 7)
  const velocities = new Float64Array(rows * 6)
  const ids = new BigUint64Array(rows)
  const status = new Uint8Array(rows)
  const teleports = new Uint32Array(rows)
  let previous = new Map<bigint, number>()
  let snaps = 0
  let copies = 0
  for (let frame = 0; frame < 3; frame += 1) {
    // Four fixed steps in one frame. The box crosses in the seventh step.
    for (let tick = 0; tick < 4; tick += 1) world.step()
    const { count } = world.writeBodyMotionInto(poses, velocities, ids, status, teleports)
    const current = new Map<bigint, number>()
    for (let row = 0; row < count; row += 1) {
      const id = ids[row]!
      current.set(id, teleports[row]!)
      // Snap: draw the pose of this row and do not blend from the last frame.
      if (previous.has(id) && previous.get(id) !== teleports[row]) snaps += 1
    }
    previous = current
    for (const straddler of world.latest().portalStraddlers ?? []) {
      const pair = world.portalPairs?.find((candidate) => candidate.id === straddler.pairId)
      if (pair === undefined) throw new Error('A listed pair exists')
      // Draw the copy with this matrix times the body world matrix, clipped by the plane.
      const copyMatrix = portalTransformMatrix3D(pair, straddler.end)
      const clipPlane = portalExitClipPlane3D(pair, straddler.end)
      if (copyMatrix.length === 16 && clipPlane.length === 4) copies += 1
    }
  }
  if (snaps !== 1) throw new Error(`Expected one snap, got ${snaps}`)
  if (copies === 0) throw new Error('Expected a second copy of the straddling box')
} finally {
  world.dispose()
}
```

### Migration and compatibility notes

- **No reserved layers (rc.34)**: before rc.34, host walls took layers 24 to 30
  and every mask included them. From rc.34, layers 24 to 30 follow the normal
  rules. See `MIGRATING-RC33-TO-RC34.md` in the package.
- **Aperture containment tolerance (0.05 m per boundary)**: containment uses
  a 5 cm margin per projected boundary ($|x| + e_x \le W/2 + 0.05$,
  $|y| + e_y \le H/2 + 0.05$). A centered body can be up to 0.10 m wider than
  the opening.
- **KCC pending host references**: character controller portal lists accept
  unresolved `hostBodyId` references from `edit.createBody()` inside
  `world.edit()`.

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


### Runtime adapters, grab servos, and typed units

The `/physics/3d` entry point provides native runtime adapters and grab servos:
- `createPhysicsRuntimeAdapter3D`: Creates an in-memory checkpoint adapter for live physics worlds without JSON or wire serialization overhead. Configured with `PhysicsRuntimeAdapter3DConfig` and captures `PhysicsRuntimeCheckpoint3D`.
- `createGrabServo3D`: Native grab and drag constraint servo configured with `GrabServoOptions3D` returning a `GrabServo3D`.
- Physics unit types include `Meters`, `Radians`, `MetersPerSecond`, `MetersPerSecondSquared`, `RadiansPerSecond`, `Newtons`, `NewtonMeters`, and `NewtonSeconds`.
- `FrameVelocity` and `FrameGravity` identify quantities per frame. `UnitVector3<Quantity>` gives each vector component the same unit type.

Unit constructors reject non-finite values. Use `meters`, `radians`,
`metersPerSecond`, `metersPerSecondSquared`, `radiansPerSecond`, `newtons`,
`newtonMeters`, `newtonSeconds`, `frameVelocity`, or `frameGravity` at input
boundaries.

Use `velocityToFrame` and `velocityToSeconds` to convert velocity. Use
`gravityToFrame` and `gravityToSeconds` to convert gravity. Each conversion
requires a positive integer tick rate. Velocity uses one tick interval.
Gravity uses two tick intervals. The conversion helpers reject overflow.

## RC1 feature scope

The canonical entry point includes convex hull, mesh, terrain, voxel compound,
vehicle, character, articulation, destruction, advanced joint, fluid, and
continuous collision support. Keep a game's working runtime and saved history
until that game's migration checks pass.


## Extended API and measurement units

The 3D physics API provides deterministic simulation, vehicle state, voxel body editing, and SI unit types:
- `CubicMeters`
- `DeterministicVehicleDefinition3D`
- `DeterministicVehicleSleep3D`
- `DeterministicVehicleState3D`
- `DeterministicVehicleStateStepOptions3D`
- `DeterministicVehicleStateStepResult3D`
- `DeterministicVehicleStateStepWithChecksum3D`
- `DeterministicVehicleStateStepWithoutChecksum3D`
- `DeterministicVehicleStateWheel3D`
- `DeterministicVehicleSupport3D`
- `DeterministicVehicleSupportClass3D`
- `DeterministicVehicleWakeReason3D`
- `DeterministicVehicleWheelDefinition3D`
- `DeterministicVehicleWheelState3D`
- `Dimensionless`
- `GameByteSection`
- `GameBytesCodec`
- `GameCodec`
- `GameSectionsCodec`
- `GrabServoAccelerationTuning3D`
- `GrabServoForcePolicy3D`
- `GrabServoForceTuning3D`
- `GrabServoState3D`
- `GrabServoStatus3D`
- `GrabServoStepOutput3D`
- `GrabServoStepResult3D`
- `GrabServoTarget3D`
- `GrabServoTuning3D`
- `Hertz`
- `InverseKilogramMetersSquared`
- `InverseKilograms`
- `KilogramMetersSquared`
- `Kilograms`
- `KilogramsPerCubicMeter`
- `KilogramsPerSquareMeter`
- `LiveVoxelBodyState3D`
- `MetersPerRadian`
- `NewtonMeterSeconds`
- `NewtonMeterSecondsPerRadian`
- `NewtonSecondsPerMeter`
- `NewtonsPerMeter`
- `PerSecond`
- `PerSecondSquared`
- `PhysicsArtifact3D`
- `PhysicsBodyMobility3D`
- `PhysicsBodyTransform3D`
- `PhysicsCheckpointInfo3D`
- `PhysicsCheckpointMotionBatch3D`
- `PhysicsCheckpointView3D`
- `PhysicsHelperBehaviorRevision`
- `PhysicsInitOptions3D`
- `PhysicsInstalledGameContext3D`
- `PhysicsInstalledPreviousState3D`
- `PhysicsInstalledRuntimeAdapter3DOptions`
- `PhysicsMotionBatch3D`
- `PhysicsMotionBatchBodyEntry3D`
- `PhysicsMotionBatchSummary3D`
- `PhysicsPendingSupportImpulse3D`
- `PhysicsQuaternion3D`
- `PhysicsSupportForce3D`
- `PhysicsSupportRecords3D`
- `PhysicsSupportSpring3D`
- `PortalCrossingEvent`
- `PortalEndDefinition`
- `PortalEndState`
- `PortalOpeningDefinition`
- `PortalPairDefinition`
- `PortalPairHandle`
- `PortalRelativeTransform`
- `RadiansPerMeter`
- `RegisteredPortalPair3D`
- `RemovedVoxelBodyState3D`
- `Seconds`
- `SquareMeters`
- `SquareMetersPerSecondSquared`
- `Turns`
- `TurnsPerMinute`
- `TurnsPerSecond`
- `VoxelBodyEditResult3D`
- `VoxelBodyOptions3D`
- `VoxelBodyRegion3D`
- `VoxelBodyState3D`
- `VoxelPaintOptions`
- `VoxelPaintResult`
- `carveVoxelBody3D`
- `createDeterministicVehicleState3D`
- `createGameByteSection`
- `createGameByteSectionFrom`
- `createGrabServoState3D`
- `createPhysicsInstalledRuntimeAdapter3D`
- `createVoxelBody3D`
- `cubicMeters`
- `hertz`
- `hydrateVoxelBodyState3D`
- `inverseKilogramMetersSquared`
- `inverseKilograms`
- `kilogramMetersSquared`
- `kilograms`
- `kilogramsPerCubicMeter`
- `kilogramsPerSquareMeter`
- `metersPerRadian`
- `newtonMeterSeconds`
- `newtonMeterSecondsPerRadian`
- `newtonSecondsPerMeter`
- `newtonsPerMeter`
- `paintVoxelBody3D`
- `paintVoxelChunk`
- `perSecond`
- `perSecondSquared`
- `radiansPerMeter`
- `readGameByteSectionInto`
- `removeVoxelBody3D`
- `seconds`
- `squareMeters`
- `squareMetersPerSecondSquared`
- `stepDeterministicVehicleState3D`
- `stepGrabServo3D`
- `turns`
- `turnsPerMinute`
- `turnsPerSecond`
- `validateGrabServoState`
- `voxelBodyDigest3D`
