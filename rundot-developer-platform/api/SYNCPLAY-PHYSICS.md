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
| `prepareColliderMesh(source, options)` | Prepares collider mesh geometry deterministically by removing degenerates, interior faces, and welding coplanar regions at build time. |
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
| `solvePlanes3D(targetDelta, planes)` | Finds the mover translation that satisfies the collision planes. It writes the push of each plane. See [Character mover](#character-mover). |
| `clipVector3D(vector, planes)` | Removes the part of a velocity that moves into a plane with a push. |

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
| `PhysicsCollisionFilter3D`, `PhysicsBodyFilter3D` | The collision filter input `{ categoryBits?, maskBits?, groupIndex? }`, and the complete filter that a read returns. See [Collision filters](#collision-filters). |
| `PhysicsQueryFilterBits3D` | The query filter `{ categoryBits?, maskBits? }` of a query. |
| `PhysicsCustomFilterFn3D`, `PhysicsCustomFilterShape3D` | The world custom pair filter and the shape facts it receives (shape id, body key, filter). |
| `PhysicsPreSolveRule3D` | A deterministic pre-solve rule: `{ type: 'oneWay', up, minCosine? }`. See [One-way platforms](#one-way-platforms). |
| `PhysicsCastResultFn3D`, `PhysicsOverlapResultFn3D` | The `castRay`/`castShape` and `overlapShape` callbacks. |
| `PhysicsAabbQuery3D` | The `overlapAabb` input: `bounds` and the query filter fields. |
| `PhysicsInertia3D` | Symmetric body inertia tensor. |
| `PhysicsBodyMassData3D` | The `setBodyMassData` input: `mass`, `centerOfMass`, and `inertia` about the center of mass. |
| `PhysicsExplosion3D` | The `explode` input: `position`, `radius`, `falloff`, `impulsePerArea`, and `maskBits` (a 64-bit `bigint`, default all bits). |
| `PhysicsWind3D` | The `applyBodyWind` input: `wind`, `drag`, `lift`, `maxSpeed`, and `wake`. |
| `PhysicsWorldTuning3D` | The `readTuning` result: gravity and the contact, restitution, and speed settings that apply to the next step. |
| `PhysicsContactTuning3D` | The `setContactTuning` input: `hertz`, `dampingRatio`, and `contactSpeed`. |
| `PhysicsWorldCounters3D` | The `readCounters` result: body, awake body, sleeping body, joint, contact, and fluid counts. |
| `PhysicsStepProfile3D` | The `readStepProfile` result: the work counts of the last step. |
| `PhysicsMoverCapsule3D`, `PhysicsMoverQuery3D`, `PhysicsMoverCastQuery3D` | The mover capsule and the `collideMover` and `castMover` inputs. |
| `PhysicsPlane3D`, `PhysicsPlaneResult3D` | A plane (normal and offset), and one `collideMover` result (a plane result with the body id). |
| `PhysicsCollisionPlane3D`, `PhysicsPlaneSolverResult3D` | The `solvePlanes3D` input plane and its result. |
| `PhysicsWorldDefinition3D` | Fixed-step settings and capacity for a world. |
| `PhysicsWorldCapacity3D` | Body, joint, fluid, and fluid-interaction capacity limits. |
| `PhysicsPeriodicDomain3D` | The optional periodic x/z query domain `{ minX, maxX, minZ, maxZ }` of a world. See [Periodic worlds](#periodic-worlds). |
| `PhysicsPeriodicImage3D` | The `image` of a hit in a periodic world: `{ x, z }`, the signed image counts on x and z. |
| `PhysicsBody3D` | Body state returned by `readBody()`. |
| `PhysicsBodyMotion3D` | Body settings and motion without complex geometry arrays. |
| `PhysicsBodyInput3D` | Body input for create and replace operations. |
| `PhysicsJoint3D` | Joint state returned by `readJoint()`. |
| `PhysicsJointInput3D` | Stable joint input for create and replace operations. |
| `PhysicsJointUpdate3D` | The fields that `updateJoint()` changes on a live joint of one type. |
| `PhysicsJointState3D` | The `state` of `readJoint()`: position, speed, angle, angular speed, separations, motor force, and constraint force and torque. |
| `PhysicsJointEvent3D` | One joint whose reaction reached its force or torque threshold in the latest step, from `readJointEvents()`. |
| `PhysicsShape3D` | Sphere, box, capsule, cylinder, cone, tapered capsule, hull, mesh, heightfield, or compound. |
| `PhysicsCompoundChild3D`, `PhysicsShapeSettings3D`, `PhysicsShapeMaterial3D` | One shape of a multi-shape body: its geometry, pose, and shape fields (material, density, filter, sensor flag, shape flags). |
| `PhysicsShapeFlags3D` | The `setShapeFlags` input: the shape flags of one shape (events, pre-solve, custom filtering, speculative contact). |
| `PhysicsShapeId3D`, `PhysicsShapeDef3D`, `PhysicsShapeEditOptions3D`, `PhysicsBodyShape3D` | A shape id (body and shape number), the input of `createShape()`, the options of a shape operation, and one entry of `readBodyShapes()`. |
| `PhysicsSurfaceMaterial3D` | One entry of the `materials` table of a mesh or heightfield: friction, restitution, and an optional surface tangent velocity. `materialIndices` gives each triangle or cell its entry. |
| `PhysicsEditOps3D` | Operations available inside `edit()`. |
| `PhysicsEditResult3D` | Created handles and removal results from `edit()`. |
| `PhysicsLatestOutputs3D` | Frame, contact events, sensor events, body move events, and joint, break, and fluid interaction outputs of the latest step. |
| `PhysicsFluidInput3D`, `PhysicsFluid3D`, `PhysicsFluidInteraction3D` | Owned fluid input, readback, and latest interaction output. |
| `PhysicsCheckpoint3D` | Opaque retained checkpoint handle. |
| `PhysicsRaycastQuery3D` | Raycast input. |
| `PhysicsOverlapQuery3D` | Overlap input. |
| `PhysicsShapeCastQuery3D` | Shape-cast input. |
| `PhysicsClosestPointsQuery3D` | Closest-point input. |
| `PhysicsCastHit3D` | Raycast, overlap, or shape-cast hit. |
| `PhysicsClosestPointResult3D` | Closest-point result. |
| `PhysicsContactData3D` | One touching body pair: summary point, normal, impulses, approach speed, material, and manifolds. |
| `PhysicsContactManifold3D`, `PhysicsManifoldPoint3D` | One manifold with its compound child indices and one to four points. |
| `PhysicsContactEvents3D` | Contact begin, end, and hit events. |
| `PhysicsContactBeginTouchEvent3D`, `PhysicsContactEndTouchEvent3D` | One pair that began or stopped touching in the latest step. |
| `PhysicsContactHitEvent3D` | One touching pair whose approach speed was above `hitEventThreshold` in the latest step. |
| `PhysicsSensorEvents3D`, `PhysicsSensorEvent3D` | Sensor begin and end events. |
| `PhysicsBodyMoveEvent3D` | One body that the latest step simulated. |
| `PhysicsJointReaction3D` | Stable joint ID, endpoints, force, and torque from the latest step. |
| `PhysicsJointBreakEvent3D` | One-step joint break event with its reason and reaction. |
| `PhysicsWorldInfo3D` | Backend, frame, settings, count, and capacity data. |
| `PhysicsWorld3D` | Complete owned-world interface. |
| `PhysicsError3D` | Stable Syncplay physics error type. |
| `PhysicsFeatureApi3D` | Type of the advanced feature namespace group. |
| `PhysicsBuoyancyOptions3D`, `PhysicsBuoyancyResult3D` | Flat-plane helper input and buoyancy result for RC.3 migration. |
| `PhysicsFluidVolume3D`, `PhysicsFluidForcesOptions3D`, `PhysicsFluidForcesResult3D` | Bounded-fluid definition, calculation options, and force result. |
| `ColliderSourceMesh`, `ColliderCookOptions`, `CookedCollider`, `CookedColliderHull` | Offline convex-decomposition input, options, output, and hull record. |

## Ship the physics WASM file

The physics code is a binary file, `physics.wasm` (`physics2d.wasm` for 2D),
not a string in the JavaScript bundle. `initPhysics3D()` fetches the file next to
the module that loads it, checks its SHA-256 against the package metadata, and
then compiles it. A file that is missing, changed, or replaced by an HTML page
stops initialization with a `KINETIX_WASM_*` error that names the URL.

- `vite build` copies the file into `dist/assets/` for you. Deploy all of `dist/`.
- In `vite` dev, add `optimizeDeps: { exclude: ['@series-inc/rundot-syncplay'] }`,
  or use `rundotSyncplayPlugin()` from `@series-inc/rundot-syncplay/tools`, which
  adds it. Dependency pre-bundling moves the code away from the file.
- A bundler that does not copy `new URL('./physics.wasm', import.meta.url)`
  assets (for example esbuild) must copy the file from
  `@series-inc/rundot-syncplay/core/src/physics/` beside the output chunks.
- Node reads the file from the package directly.
- In a browser, a synchronous physics call before the first `await initPhysics3D()`
  fails with `KINETIX_WASM_SYNC_UNAVAILABLE`. Await initialization first.

## Create and dispose a world

Set `capacity.checkpoints` to declare retained checkpoint capacity. The default
is 64. Values from 1 through 4096 are valid. Release checkpoints after use to
make their slots available again.

The physics ABI of rc.81 is 26 (`PHYSICS_ABI_VERSION`). `initPhysics3D()` checks
the WASM file against it and fails when the build has another ABI. A checkpoint
from physics ABI 25 or earlier does not load in rc.81. See
[Checkpoints from rc.80](#checkpoints-from-rc80).

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

### World solver settings

Every world uses the soft-step solver. The table gives the defaults.

| Field | Default and rules |
| --- | --- |
| `substeps` | 4, the substep count. A positive integer. |
| `contactHertz` | 30. The contact stiffness in hertz. Values must be finite and nonnegative. The solver caps it at one eighth of the substep rate (15 Hz at 30 ticks per second and 4 substeps, 30 Hz at 60 ticks per second). 0 selects this cap, the stiffest contact. |
| `contactDampingRatio` | 10. The contact damping ratio. Values must be finite and nonnegative. |
| `contactSpeed` | 3 m/s. The largest speed at which a contact pushes overlapping bodies apart. 0 also selects 3 m/s. It does not limit a restitution bounce. |
| `maximumLinearSpeed` | 400 m/s. The solver limits the linear speed of a dynamic body to this value in each substep. 0 removes the limit. |
| `restitutionThreshold` | 1 m/s. A contact bounces only when its closing speed is above this value. |
| `hitEventThreshold` | 1 m/s. A hit event needs an approach speed above this value. The value must be finite and nonnegative. It changes only the events, so it is not part of the world profile. `setHitEventThreshold()` changes it. |
| `enableSleep` | true. False keeps every body awake. |
| `enableContinuous` | true. False turns off the continuous stage for every body, bullets (`ccd`) too. |
| `enableWarmStarting` | true. False starts the contact and joint impulses of each step at 0. |
| `isotropicInertiaTolerance` | 0.2. A body whose principal moments of inertia differ by less than this relative amount gets no gyroscopic torque. The world clamps the value to 0 to 1. There is no runtime setter, because a new tolerance applies to a body only at the next mass update of that body. |

A value of the four switch fields that is not the default is part of the world
profile id, so every peer must use the same value. A world with the defaults
keeps the profile id of a world that does not set them.

#### Change world settings at runtime

These methods change the world settings in place. The
change applies from the next `step()`. The values are simulation state:
`captureCheckpoint()`, `serializeCheckpoint()`, `restore()`, and `digest()`
carry them. A world that has the values of its definition keeps the digest and
the checkpoint bytes of a world with no change. `initialGravity` and the other
definition fields stay in the world profile id as the start values.

| Method | Effect |
| --- | --- |
| `setGravity(gravity)` | Sets the world gravity. |
| `setContactTuning({ hertz, dampingRatio, contactSpeed })` | Sets the contact hertz, the contact damping ratio, and the contact speed. An absent field keeps its value. |
| `setRestitutionThreshold(speed)` | Sets the restitution threshold. |
| `setMaximumLinearSpeed(speed)` | Sets the maximum linear speed. |
| `readTuning()` | Reads gravity, restitution threshold, contact speed, maximum linear speed, contact hertz, and damping ratio. `info().gravity` also gives the current gravity. |
| `enableSleeping(flag)` | Sets the `enableSleep` switch. False wakes every sleeping body at the next step. |
| `enableContinuous(flag)` | Sets the `enableContinuous` switch. |
| `enableWarmStarting(flag)` | Sets the `enableWarmStarting` switch. |
| `readTuning()` also gives `enableSleep`, `enableContinuous`, `enableWarmStarting`, and `isotropicInertiaTolerance` | Reads the three switches and the isotropic inertia tolerance. |
| `readCounters()` | Reads the body, awake body, sleeping body, joint, contact, and fluid counts. All counts come from simulation state. |
| `readStepProfile()` | Reads the work counts of the last step: see below. |

#### Step profile

A step profile with wall-clock times is not deterministic. Time is different on each peer,
and the runtime guards block a clock read in a simulation frame. Thus
`readStepProfile()` gives work counts of the last step, not times:

| Field | Count |
| --- | --- |
| `pairCount` | Body pairs that the broadphase gave to the narrowphase. |
| `manifoldCount`, `contactPointCount` | Contact manifolds in the solve, and their points. |
| `jointCount`, `jointRowCount` | Joints with solver rows, and the prepared joint rows of the last substep. |
| `islandCount`, `awakeIslandCount`, `awakeBodyCount` | Islands after the step, the awake islands, and the awake bodies. |
| `continuousSweepCount` | Continuous sweeps of fast bodies. |
| `substepCount` | Substeps of the step. |
| `colorCounts` | Constraints in each of the 24 constraint graph colors. Index 23 is the overflow color. |

The counts are diagnostics. They are not in a checkpoint or in the digest, and
a restore does not change them. Two peers with different histories can read
different values. Portal proxies are counted. To measure time, host code
measures the `step()` call outside the simulation frame.

## Body settings and contact materials

Set these fields in `PhysicsBodyInput3D`. Create and replace operations validate
numeric fields before they publish the edit. `readBody()` returns the settings.

| Fields | Defaults and rules |
| --- | --- |
| `kind`, `shape` | `kind` defaults to `dynamic`. A shape is required. |
| `position`, `linearVelocity`, `angularVelocity`, `centerOfMass` | Each vector defaults to zero, but `centerOfMass` of a dynamic body defaults to the shape centroid. Components must be finite. `centerOfMass` is local to the body. |
| `orientation` | Defaults to the identity quaternion. Components must be finite. |
| `density`, `mass`, `inertia` | A dynamic body takes its mass, center of mass, and inertia from its shape and `density`. The default density is 1000 kg/m^3 (water). A `mass` overrides the density, and the shape inertia scales to that mass. Do not set `density` and `mass` together. An `inertia` is used as given, about the center of mass. A dynamic body that sets `inertia` must also set `mass`, because the two values are one set. With them, `centerOfMass` defaults to the body origin. All shapes have a mass: a mesh or a heightfield takes the mass of its convex hull, and a compound sums its children. A static or kinematic body keeps a stored mass of 1 kg unless you set `mass`. |
| `friction`, `restitution`, `rollingResistance` | Defaults are 0.6, 0 and 0. Values must be finite and nonnegative. Restitution must not exceed 1. |
| `gravityScale`, `linearDamping`, `angularDamping` | Defaults are 1, 0 and 0. Damping is a rate in 1/s: each substep of length h multiplies the velocity by 1 / (1 + h * damping) before the solve. 0 is no damping (the default). Values must be finite and nonnegative. To convert an old per-tick keep fraction k at tick rate R, use (1 / k - 1) * R. Kinematic bodies are damped too. |
| `filter` | The collision filter: `{ categoryBits, maskBits, groupIndex }`. The bits are 64-bit `bigint` values, so they are exact. The default sets all 64 bits in both, and the group index is 0, so every body collides with every body. See [Collision filters](#collision-filters). |
| `trigger`, `sensor` | Defaults are false and false. A trigger or a sensor has no solid response. Its pairs are sensor overlaps, not contacts. |
| `enableContactEvents`, `enableHitEvents`, `enableSensorEvents` | Defaults are false, false and false. Each value must be a boolean. A pair has contact or hit events when one of its bodies enables them. A sensor pair has sensor events only when the sensor and the visitor both enable sensor events. These values change only the events, never the simulation. See [Contact and sensor events](#contact-and-sensor-events). |
| `enableSpeculativeContact` | Defaults to true. The value must be a boolean. False removes the speculative points between a hull (a box, hull, cylinder, cone, or rounded convex) and a mesh or a heightfield when this body is on either side of the pair. This can remove ghost contacts on triangle edges, but a fast rotating body can then enter the triangles. Sphere and capsule pairs keep their speculative points. |
| `customFiltering` | Default false. True lets the world `customFilter` decide each pair with this body. |
| `preSolve` | A deterministic pre-solve rule, for example a one-way platform. See [One-way platforms](#one-way-platforms). |
| `sleeping`, `sleepEnabled`, `sleepThreshold` | Defaults are false, true and 0.05. The threshold must be finite and nonnegative. See [Sleep](#sleep) for the sleep rules. |
| `motionLocks`, `ccd` | Defaults are 0 and false. Motion locks use an unsigned 32-bit mask. CCD prevents verified sphere, capsule, box and hull thin-wall crossings. |
| `allowFastRotation` | Defaults to false. The value must be a boolean. The solver limits the angular speed of a body to pi / 4 radians per tick (one eighth of a turn). True removes this limit for the body. Use it only for round bodies, such as wheels. |
| `enabled` | Defaults to true. False creates a disabled body with no velocity. See [Disable a body](#disable-a-body). |
| `safetyFactor` | Defaults to 0.5. The continuous stage sweeps the body when it moves more than `safetyFactor` times its smallest extent in a step. The value must be finite and nonnegative. |

### Change a body at runtime

These methods change one body in place. They do not need an edit. The body keeps its id, its joints, and its key.

- `setBodyType()` keeps the mass data, the pose, and the joints. The body loses
  its contacts and wakes. A static body has no velocity.
- `setBodyAwake(false)` puts a dynamic body to sleep with no velocity. A
  touching awake body can wake it in the next step. A body with sleep disabled
  cannot be put to sleep.
- `setBodySleepEnabled(false)` also wakes the body.
- `setBodyMassData()` sets the mass, the local center of mass, and the inertia
  about that center. The linear velocity changes so that the body origin keeps
  its motion when the center moves.
- `applyMassFromShapes(body, density)` computes the mass data from the shapes.
  A shape of a multi-shape body uses its own density. A shape that stores no
  density uses the argument. The default is 1000 kg/m^3.
- `setBodyTargetTransform(body, target, { timeStep, wake })` sets the linear
  and angular velocities that move a kinematic or dynamic body to the target
  pose in `timeStep` (the default is one tick). A static body does not change.
- `explode({ position, radius, falloff, impulsePerArea, maskBits })` applies
  an impulse to each shape of a dynamic body within `radius + falloff`. The
  impulse is `impulsePerArea` times the shape area that faces the position,
  at the closest shape point. It falls linearly to zero from `radius` to
  `radius + falloff`. Spheres, capsules, boxes, hulls, and cylinders and cones
  (as 16-side hulls) take an impulse; a compound applies per child. The method
  returns the number of bodies that took an impulse. `maskBits` selects
  shapes by the category of each shape (a
  shape takes an impulse when its category has a bit of the mask), so one shape
  of a body can take an impulse and another not.
- `applyBodyWind(body, { wind, drag, lift, maxSpeed, wake })` adds a wind
  force and torque of each shape for the next tick. The relative wind of a
  shape point is `wind` minus `drag` times the point velocity. Each hull face
  that faces the relative wind, and each sphere or capsule, takes
  0.5 * air density * area * speed^2 along that wind. The area is the area of
  the face, the sphere, or the capsule as seen along the wind (the projected
  area). A hull face or a capsule also takes `lift` times that force across
  the wind. The speed is at most `maxSpeed`. Meshes, heightfields, and tapered
  capsules take no wind. The air density is 1.225 kg/m^3.

- `setBodySafetyFactor(body, value)` and `readBodySafetyFactor(body)` set and
  read the safety factor.

#### Disable a body <a id="disable-a-body"></a>

`disableBody(body)` disables a body, and `enableBody(body)` enables it again.
`isBodyEnabled(body)` reads the flag.

- A disabled body is out of the broadphase, the solver, its island, and every
  query. Its joints do not solve, and they link no island.
- When you disable a body, its contacts end and the bodies that touched it
  wake. The pose, the mass, the definition, and the joints stay. The velocity
  becomes 0, because the solver drops the state of a body that leaves the awake set.
- The velocity setters, `applyImpulse()`, and the force setters do nothing to a
  disabled body. `setBodyTransform()` moves it.
- When you enable a body, it is awake with no velocity. Its joints solve again.
  A joint of a disabled body starts again with no warm-start impulse.
- `readCounters()` counts a disabled body as neither awake nor asleep.
- The flag is simulation state: checkpoints, `restore()`, and `digest()` carry
  it.

Friction resists tangential motion at a contact. Restitution controls bounce.
The friction solve includes coupling between both tangent axes. It selects
the minimum contact work within the friction disk for the current normal
impulse. This changes trajectories and checkpoint digests from earlier
diagonal tangent solves. Use the same SDK version for all peers and replays.
Rolling resistance resists the relative angular velocity at a contact. The contact keeps one accumulated 3D angular impulse, which the next step
uses as its warm start. The impulse is limited to `rollingResistance` times the
rolling radius times the normal impulse. The rolling radius is the radius of a
sphere or a capsule, and a quarter of the smallest half extent of a box or
another convex shape. On a mesh or a heightfield, the convex shape uses its full
smallest half extent. A compound has no rolling radius. Rolling resistance is
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
      mass: syncplayUnits.kilograms(1),
      inertia: { xx: syncplayUnits.kilogramMetersSquared(1), yy: syncplayUnits.kilogramMetersSquared(1), zz: syncplayUnits.kilogramMetersSquared(1) },
      friction: 0, rollingResistance: 1,
    })
  }).created
  world.step()
  // The rolling impulse limit is 0.5. The clamp divides by the impulse length plus FLT_EPSILON.
  const limited = 0.5 / (1 + 1.1920928955078125e-7)
  if (world.readBody(ball).angularVelocity.z !== 1 - limited) throw new Error('Missing rolling response')
} finally {
  world.dispose()
}
```


### Collision filters <a id="collision-filters"></a>

The collision filter uses these rules:

- Two bodies with the same non-zero `groupIndex` always collide (positive group)
  or never collide (negative group). This test comes before the bits.
- Otherwise the bodies collide only when each mask has a bit of the other
  category: `(a.maskBits & b.categoryBits) != 0` and
  `(b.maskBits & a.categoryBits) != 0`.
- `categoryBits` and `maskBits` are `bigint` values from 0 to 2^64 - 1. A
  missing field takes the default: all bits set, group 0.
- `edit.setCollisionFilter(body, filter)` replaces the whole filter. A missing
  field takes the default.
- `readBody()` and `readMotion()` return the complete filter.
- The old `layer` and `mask` input fields are removed. A body input that has
  them fails with `physics.definition-invalid`. Body reads keep `layer` and
  `mask` as deprecated values: the low 32 bits of `categoryBits` and
  `maskBits`. They stay because the frozen KCC revision 1 reads them.
- Fluid volume filters stay 32-bit. They test the low 32 bits of the body
  category and mask.

A custom pair filter is the world
definition field `customFilter: (shapeA, shapeB) => boolean`. It runs for each
pair of shapes of two bodies in which at least one shape enables custom
filtering (the shape field `enableCustomFiltering`, or the body field
`customFiltering: true`), and only when the collision filters of the two shapes
already let them collide. Return false to disable contacts and sensor overlaps
between the two shapes. Each argument has the shape `id` (`{ body, shape }`),
the `bodyKey` of its body, and the shape `filter`. A body that is not a shape
list has one shape, shape 0.

- The world calls the filter after each edit and after each restore, once per
  shape pair, in ascending body id order with the lower id first, then in shape
  order. A step does not call it. This keeps the step fully native and deterministic: a call from inside
  the native step would cross from WASM to JavaScript for each new pair, and it
  could not be made safe for rollback.
- The function must be pure, and every peer must pass the same function. It is
  not part of the world profile id.
- A rejected pair of two bodies with one shape each goes to each step as a
  native contact exclusion. A rejected pair with a shape of a shape list goes
  to the native shape exclusions, which stay until the next edit or restore.
  The continuous stage tests them too.
- Measured cost (filter callback benchmark, Node 24): with 1,000
  bodies, the first step after an edit spends about 4.5 ms to read every body
  filter, plus about 70 ns for each pair check and call (100 flagged bodies:
  94,950 calls, 6.7 ms). A step with no edit calls nothing. Each step sends the
  rejected pairs to the native world, about 0.2 us for each pair.
- Use `groupIndex` or the category bits when they can express the rule: they
  cost nothing outside the native pair test.

### One-way platforms <a id="one-way-platforms"></a>

`preSolve: { type: 'oneWay', up, minCosine }` is a deterministic pre-solve rule
for a one-way platform. A contact
with the body stays enabled only when the contact normal, from this body to the
other body, has a dot product of at least `minCosine` with `up`. `up` is a
body-local direction that turns with the body; the world normalizes it. The
default `minCosine` is 0.95.

- The rule is native body state: a checkpoint, a digest, and `readBody()`
  include it.
- It applies to the contact update (with the normal of the first manifold) and
  to the continuous stage (with the time of impact normal). A disabled contact has no impulse and no touching contact
  output.
- It applies on the soft contact route, which every world uses.
- A per-contact JavaScript callback is not supported: it would run inside the
  native step for each contact of each substep.
- Measured cost (filter callback benchmark): 400 boxes resting on a
  one-way floor step in 5.05 ms, the same as without the rule (5.06 ms).

### Sleep

These rules control sleep:

- A body is sleepy when the speed of its farthest point, |v| + |w x maxExtent|,
  and half the speed of its position correction over the step are not above
  `sleepThreshold`. `maxExtent` is the distance from the center of mass to the
  farthest point of the shape on each local axis.
- Bodies that touch, joints and support links make islands. A contact
  touches when its manifold has points, so a gap of up to 2 cm (the speculative
  distance) counts. An island sleeps when every body in it has been sleepy for
  0.5 s. A sleeping body has zero velocity.
- A wake of one body wakes its whole island. `setBodyAwake(body, false)` puts
  the whole island to sleep. At 60 Hz, an island sleeps after 31 steps.
- A body that you create asleep touches nothing until it wakes. At its first
  wake, its touching pairs begin.
- A kinematic body is in an island too. A slow kinematic body (at or below its
  `sleepThreshold`) sleeps with its island and stops. Disable sleep on that
  body, or raise its threshold, to keep a slow platform moving. A nonzero
  `setBodyLinearVelocity` or `setBodyAngularVelocity` wakes a dynamic or a
  kinematic body.
- An awake dynamic or kinematic body wakes a sleeping body when their manifold
  has points, before the solve. A static body does not wake a body, and a
  surface velocity does not keep a body awake: a body on a conveyor stays awake
  while it moves faster than its threshold. A new nonzero
  `setBodySurfaceVelocity` wakes the bodies that touch that body, so a body
  asleep on a stopped conveyor wakes when the conveyor starts.
- An actively driven joint (a motor with a target) keeps its bodies awake.

Surface velocity acts on the tangent (friction) rows only. A normal
component of a surface velocity has no effect.

### First-class contact materials and contact rules

Syncplay 3D physics provides first-class contact materials and pair rules.
Install named materials and contact rules during world creation.
The world material table is immutable after world creation.
Each world supports up to 4096 materials and 4096 contact rules.

#### Materials and combine modes

Define named materials with `PhysicsMaterialInput3D` records.
The world stores validated materials as `PhysicsMaterialDefinition3D` records.
Each material requires a unique `PhysicsMaterialKey3D` string identifier.
A material specifies `friction`, `restitution`, and `rollingResistance`.
Default values are 0.6 for friction, 0 for restitution, and 0 for rolling resistance.
Each coefficient supports a combine mode from `PhysicsMaterialCombineMode3D`.
Combine modes include `average`, `minimum`, `geometricMean`, `product`, and `maximum`.
The legacy combine mode `multiply` is an alias for `geometricMean`.
Combine modes follow strict semantic priority order:
`average` < `minimum` < `geometricMean` < `product` < `maximum`.
A greater priority mode wins over a lower priority mode.

#### Contact material pair rules

Define pair rules with `PhysicsContactMaterialRule3D` records.
The world stores validated rules as `PhysicsContactMaterialRuleDefinition3D` records.
Each rule requires a unique `PhysicsContactRuleKey3D` string identifier.
A rule specifies two materials in `materialPair`.
Order in `materialPair` does not change rule matching.
Rules can override `friction`, `restitution`, and `rollingResistance`.
Use `PhysicsScalarOverride3D` to specify inherit, direct coefficient, or combine mode.
A rule can also provide surface velocity with `PhysicsMaterialSurfaceVelocityInput3D`.
Set `priority` to control rule precedence when multiple rules match.
Higher priority rules win over lower priority rules.
When priorities match, the world uses declaration order.
Set `enabled: false` to disable physical response between materials.

#### Body material assignment

Assign materials to bodies at creation or at runtime.
Body creation accepts either `PhysicsNamedBodyInput3D` or `PhysicsInlineBodyInput3D`.
The authoring union is `PhysicsBodyMaterialInput3D`.
Modifications use `PhysicsBodyInputPatch3D`.
For dynamic changes, call `edit.setBodyMaterial()` with `PhysicsBodyMaterialSource3D`.
Read back the assigned source with `PhysicsMaterialSource3D`.
Changing a body material assignment invalidates warm contact cache impulses.
The engine wakes touching dynamic bodies upon material reassignment.
Inline bodies without a named material retain their inline coefficients.

#### Material queries and contact outputs

Query operations return `PhysicsMaterialSnapshot3D` records.
Raycasts and shape casts report hit materials as `PhysicsCastHitMaterial3D`.
Portal query traversals include `PhysicsMaterialPortalRoute3D` with `PhysicsMaterialPortalHop3D` hops.
Contact policy evaluation uses `PhysicsMaterialContactFrame3D` and returns `PhysicsContactMaterialResolution3D`.

The contact data of each touching pair publishes material data in `PhysicsContactMaterialOutput3D`.
When the solver calculates contact response, it publishes `PhysicsContactMaterialResolvedOutput3D`.
When response is disabled or suppressed, it publishes `PhysicsContactMaterialSuppressedOutput3D`.
The suppression reason is recorded in `PhysicsContactMaterialSuppressionReason3D`.
Valid suppression reasons are `None`, `RuleDisabled`, `TriggerOrSensor`, and `InternalSolverSuppressed`.
Imported historical contacts from older snapshots publish `PhysicsContactMaterialLegacyUnknownOutput3D`.

<!-- syncplay-example: physics3d-contact-materials -->
```typescript
import * as syncplayUnits from "@series-inc/rundot-syncplay/physics/3d";
import { createPhysicsWorld3D, initPhysics3D } from "@series-inc/rundot-syncplay/physics/3d";

await initPhysics3D();
const world = createPhysicsWorld3D({
  initialGravity: {
    x: syncplayUnits.metersPerSecondSquared(0),
    y: syncplayUnits.metersPerSecondSquared(-10),
    z: syncplayUnits.metersPerSecondSquared(0),
  },
  capacity: { bodies: 2, joints: 0 },
  materials: [
    {
      key: "rubber",
      friction: 0.9,
      restitution: 0.8,
      frictionCombine: "maximum",
    },
    {
      key: "wet-ground",
      friction: 0.1,
      restitution: 0.2,
      frictionCombine: "minimum",
    },
  ],
  contactMaterialRules: [
    {
      key: "rubber-on-wet",
      materialPair: ["rubber", "wet-ground"],
      priority: 10,
      friction: 0.05,
    },
  ],
});
try {
  const floor = world.edit((edit) =>
    edit.createBody({
      kind: "static",
      shape: {
        type: "box",
        halfX: syncplayUnits.meters(10),
        halfY: syncplayUnits.meters(0.5),
        halfZ: syncplayUnits.meters(10),
      },
      position: {
        x: syncplayUnits.meters(0),
        y: syncplayUnits.meters(-0.5),
        z: syncplayUnits.meters(0),
      },
      material: "wet-ground",
    })
  ).created;

  const ball = world.edit((edit) =>
    edit.createBody({
      shape: { type: "sphere", radius: syncplayUnits.meters(0.5) },
      position: {
        x: syncplayUnits.meters(0),
        y: syncplayUnits.meters(0.5),
        z: syncplayUnits.meters(0),
      },
      material: "rubber",
    })
  ).created;

  for (let i = 0; i < 10 && world.contactData().length === 0; i++) {
    world.step();
  }
  const contacts = world.contactData();
  if (contacts.length > 0) {
    const contact = contacts[0]!;
    if (contact.material?.kind === "resolved") {
      if (contact.material.friction !== 0.05) {
        throw new Error("Unexpected contact material response");
      }
    }
  }

  world.edit((edit) => {
    edit.setBodyMaterial(floor, { kind: "inline", friction: 0.8 });
  });
  world.step();
} finally {
  world.dispose();
}
```

## Complex shapes, terrain, and voxels

The RC1 API accepts mesh triangle vertices, hull vertices, heightfield grids
and nested compound children. Each compound child has a shape and a local
offset. A compound body is a body with many shapes (see
[Multi-shape bodies](#multi-shape-bodies)). Native immutable records own copied geometry. Dynamic complex bodies
take their mass properties from the shape and its density. The voxel body cook
described below also supplies these values. The fracture service is available through
`fracture3D`.

### Multi-shape bodies <a id="multi-shape-bodies"></a>

A body holds a list of shapes. Each child of a compound with shape
fields is one shape. A body that is not such a compound has one shape,
shape 0, and its settings are the body settings. Each shape can set these shape fields:

| Field | Effect |
| --- | --- |
| `material` | Friction (default 0.6), restitution (default 0), rolling resistance (default 0), and a tangent velocity in the shape frame. In a contact of this shape the material replaces the body material. The world combine rules stay. |
| `density` | The density in kg/m^3. A dynamic body takes its mass from the sum of its shapes. A sensor shape adds to the mass. A shape with density 0 adds no mass. The default is the body `density`. |
| `filter` | The collision filter of this shape. Two shapes collide when each passes the filter of the other. Queries test it too. |
| `isSensor` | The shape makes no contact and has no continuous collision. Queries hit it. It detects the shapes of other bodies (sensor events), also when its body is not a sensor. A sensor shape on a fast body does not sweep, so it finds only the overlaps at the end of the step. A fast solid shape that sweeps across a sensor shape in one step gives a sensor begin event in that step and an end event in the next step, also when the sensor shape is on a body that is not a sensor. The default is false. |
| `enableContactEvents` | Contact begin and end events for the contacts of this shape. A shape pair has events when one of its shapes enables them. |
| `enableHitEvents` | Hit events for the contacts of this shape. |
| `enableSensorEvents` | A sensor shape and a visitor shape both need it for a sensor event. |
| `enablePreSolveEvents` | The pre-solve rules of the two bodies (`preSolve`) see the contacts of this shape. A shape pair runs them when one of its shapes enables them. The default is true. |
| `enableCustomFiltering` | The world `customFilter` decides the shape pairs of this shape. The default is the body `customFiltering`. |
| `enableSpeculativeContact` | False turns off the speculative points between this shape (a hull) and triangles. |

A shape without `material` or `filter` uses the body value. Thus
`setBodyMaterial()` and `setCollisionFilter()` still change every shape that
does not set its own value. A shape flag that a shape does not set takes the
body value (`enableContactEvents`, `enableHitEvents`, `enableSensorEvents`,
`customFiltering`, `enableSpeculativeContact`; pre-solve is on). A shape that
sets one flag keeps all six, so a later change of the body flags does not
change that shape. Each value must be a boolean.

A compound with a shape field on a child (or with `nextShapeId`) is a shape
list: each child is a shape. A compound without shape fields is one
compound shape, shape 0: its body pair has one contact
with a manifold for each child pair, and as a sensor visitor it is not convex.
A shape operation on it keeps the compound whole as shape 0 and adds the new
shape next to it.

```ts
const player = world.edit((edit) => edit.createBody({
  kind: 'dynamic',
  position: { x: 0, y: 1, z: 0 },
  shape: { type: 'compound', children: [
    { shape: { type: 'capsule', radius: 0.3, halfHeight: 0.5 }, offset: { x: 0, y: 0, z: 0 } },
    // A foot sensor: no contact, no mass.
    { shape: { type: 'sphere', radius: 0.2 }, offset: { x: 0, y: -0.9, z: 0 }, isSensor: true, density: 0 },
  ] },
})).created;
```

Each shape pair of two bodies has its own contact, with the materials of its
two shapes. A body pair has no limit on its contacts (there is one contact
for each shape pair). Before, a body pair had at most 8 contacts, and more
were merged.

Each shape has a stable id. `readBody().shape` gives each child its
`shapeId` and the compound its `nextShapeId`. Give them back to
`replaceBody()` to keep the ids. A removed id is not given out again.

Change the shapes of a live body in an edit:

| Method | Effect |
| --- | --- |
| `edit.createShape(body, def, options)` | Adds a shape and returns its `PhysicsShapeId3D`. A body that is not a shape list becomes one: its shape (also a compound without shape fields) is shape 0 and keeps the body material and filter. |
| `edit.destroyShape(shape, options)` | Removes a shape. The last shape of a body cannot be removed; remove the body. |
| `edit.setShapeMaterial(shape, material)` | Replaces the material of a shape. |
| `edit.setShapeFilter(shape, filter)` | Replaces the filter of a shape. A missing field takes the default. |
| `edit.setShapeDensity(shape, density, options)` | Replaces the density of a shape. |
| `edit.setShapeFlags(shape, flags)` | Sets the flags of a shape. A missing field keeps its value. |
| `world.readBodyShapes(body)` | Reads each shape with its id, pose, material, density, filter, sensor flag, and shape flags, with the body values filled in. |

With `updateBodyMass` true (the default), a
shape operation computes the mass, the center of mass, and the inertia of a
dynamic body again from its shapes. The body must exist before the edit.

Contact and sensor events, contact data, and query hits name shapes
(`PhysicsShapeId3D`): see [Contact and sensor events](#contact-and-sensor-events).

### Hull cooking

The engine cooks each hull once, when it encodes the shape. The cook runs
quickhull, then a weld of near points and a merge of
near-coplanar faces. The body keeps only the cooked vertices, and `readBody`
returns them. These rules apply:

- `maxVertices` sets the vertex budget. It is an integer from 4 to 128. The
  default is 128.
- A cooked hull can have at most 128 faces and 128 edges. A larger hull fails
  with `physics.capacity-exceeded`. A round hull of many points needs a
  `maxVertices` of about 40.
- Points on a plane or on a line fail with `physics.definition-invalid`.
- Hull-hull and hull-box contacts use the cooked faces. A hull that rests on a face of more than four vertices
  gets four contact points.
- `massProperties3D.computeShapeMassProperties` gives the mass properties of
  the cooked hull.

Use `cookConvexDecomposition` during an asset build when a source mesh is
concave. Its result is a canonical compound shape with hull children. The cook
uses an integer voxel lattice and stable ordering. The same source and options
produce the same hash. Call `assertCookedColliderIsRuntimeValid` before you
store the asset. Do not run this offline cook inside a simulation step.

### Mesh and heightfield triangles

Mesh and heightfield triangles are one sided. The front side of
a mesh triangle is the side of the normal `(b - a) x (c - a)` of its vertices
`a, b, c` (counter-clockwise seen from the front). A heightfield faces up
(+y). A body whose center is behind a triangle gets no contact from it, so a
body that moves up through a floor passes it. A wall that must stop bodies
from both sides needs two triangles with opposite windings.

A mesh can have a material per triangle, and a heightfield a material or a
hole per cell:

```ts
const ice = { friction: 0.02, restitution: 0 };
const belt = { friction: 0.8, restitution: 0, tangentVelocity: { x: 2, y: 0, z: 0 } };
const floor = {
  type: 'heightfield', columns: 3, rows: 3, scale: { x: 1, y: 1, z: 1 },
  heights: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  materials: [ice, belt],
  // One index per cell, row by row. 255 is a hole (the cell has no triangles).
  materialIndices: [0, 1, 255, 0],
};
```

A mesh needs `materials` (1 to 255) and one index per triangle. A contact
uses, for every manifold of the body pair, the mean over its points of the
friction and restitution combined with the other body, and the mean tangent
velocity. The contact reads no rolling resistance from these materials.

In rc.81, a world with a mesh shape above 512 triangles, or a heightfield above
2,048 triangles (more than 32 x 32 cells), runs on the public solver. Call
`world.rigidRouteState?.()` to see the route. A later release removes this
limit.

### Deterministic collider preparation

Use `prepareColliderMesh` during asset baking to sanitize raw triangle lists
before decomposition or collision mesh publication. The function runs three
ordered deterministic stages on an integer lattice:
1. Degenerate removal: drops triangles whose quantized area or shortest edge is
   below `minArea` or `minEdge`.
2. Interior removal: identifies interior faces that do not touch exterior space
   and drops them.
3. Coplanar merge: welds coplanar triangle pairs that share edges into planar
   boundaries while preserving hole boundaries and enclosed surface area.

Options are configured via `ColliderPreparationOptions`:
- `minArea`: minimum quantized triangle area.
- `minEdge`: minimum quantized edge length.
- `resolution`: lattice resolution along the longest axis.
- `quantum`: vertex coordinate quantization quantum.

The returned `ColliderPreparationResult` includes:
- `triangles`: canonical sorted list of surviving triangles.
- `parts`: array of `ColliderPreparedPart` with planar `normal`, `boundaries`, and `area`.
- `digest`: deterministic 64-bit checksum.
- `removed`: `ColliderPreparationRemovedStats` with `degenerate`, `interior`, `coplanar`, and `contained` counts.

<!-- syncplay-example: physics3d-collider-preparation -->
```typescript
import {
  prepareColliderMesh,
  type ColliderSourceMesh,
  type ColliderPreparationOptions,
  type ColliderPreparedPart,
  type ColliderPreparationRemovedStats,
  type ColliderPreparationResult,
} from '@series-inc/rundot-syncplay/physics/3d';

const source: ColliderSourceMesh = {
  vertices: [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 },
  ],
};

const options: ColliderPreparationOptions = {
  minArea: 0.001,
  minEdge: 0.001,
  resolution: 16,
};

const result: ColliderPreparationResult = prepareColliderMesh(source, options);
if (result.triangles.length === 0) {
  throw new Error('Expected surviving triangles');
}
const stats: ColliderPreparationRemovedStats = result.removed;
const firstPart: ColliderPreparedPart | undefined = result.parts[0];
if (!firstPart || firstPart.boundaries.length === 0) {
  throw new Error('Expected at least one boundary loop');
}
```

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
each fixed substep. Every dynamic shape kind displaces fluid. A step does not
fail because a body of some shape entered a fluid.

| Shape | Displaced volume |
|---|---|
| Box, sphere | Exact. |
| Hull | Exact, for the convex hull of its points. The cost increases with the square of the point count: on an M-series Mac, a 64-point hull in water adds 0.11 ms to a step, and a 128-point hull adds 0.47 ms. |
| Mesh | Exact, for a closed mesh. Either winding is accepted. A mesh that encloses no volume displaces nothing. |
| `VoxelCompoundShape` from `cookVoxelBody` | Exact, for its occupied boxes only. |
| Compound | The sum of its children. Overlapping children each displace their full volume, as the mass helpers sum them. |
| Capsule, cylinder, cone, tapered capsule | A solid of revolution with 16 sides, and latitude rings every 11.25 degrees on sphere ends. A fully submerged body displaces its exact volume. A partly submerged body is within 0.2% of its full volume of the exact value. |
| Heightfield | Nothing. A heightfield encloses no volume. |

The 16 sides of a round shape turn with the fluid surface, not with the body.
A tire that rolls in water thus feels no torque from the model about its axis.

Buoyancy acts at the center of the displaced volume. For a uniform body, set
`centerOfMass` to the centroid of the shape. Otherwise a submerged body gets a
torque. For example, the centroid of a cone is `halfHeight / 2` below its
center.

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
take their exact mass and inertia from the shape and its density. Readback retains both cylinder radii.
These are native surfaces, not bounding-box colliders. Native body contacts,
readback, ray queries, and checkpoints use their exact geometry. CCD is
verified for sphere, capsule, box and hull bodies. Query probe shapes accept sphere, box,
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

### Checkpoints from rc.80

An rc.81 world rejects a checkpoint or a snapshot from rc.80, and a replay from
rc.80 does not replay on rc.81. The physics ABI changed from 25 to 26, and the
digest algorithm changed from revision 3 to 4. Start from a new world, or save
again with rc.81. Every peer in a match must use rc.81. Record golden digests
again. See [Syncplay: migrate 3D physics from rc.80 to rc.81](SYNCPLAY-RC81-MIGRATION.md).

## Use queries

Raycast, overlap, shape cast, and closest-point queries are synchronous and
read-only. Query filters are explicit. Results use stable logical body IDs.

- **Query filter**: `filter: { categoryBits, maskBits }` is the query filter.
  A query hits a body when the body category has a bit of the
  query mask and the body mask has a bit of the query category. Both default to all bits set. A body can opt out of
  a query type: clear the query category bit in the body mask. The old
  `layerMask` field is deprecated: it equals `filter: { maskBits }` with the
  same 32 bits, and it cannot be used with `filter`. It stays because the frozen
  KCC revision 1 and the pinned legacy query corpus send it.
- **Shape filters**: each shape of a multi-shape body tests the query filter
  with its own filter, in every query: rays, overlaps, shape casts, and the
  queries of a periodic world. A closest-point query keeps a compound when one
  of its shapes passes (a compound is then not a supported closest-point
  shape: the query fails). A bounds-only overlap (`overlapAabb`) also tests
  each shape: a shape list is a hit when one of
  its shapes passes the filter and the tight bounds of that shape overlap the
  box.
- **Shape ids**: each hit has `shapeId`: the
  body and the shape that the query hit. A body that is not a shape list has
  shape 0. `childIndex` is deprecated: use `shapeId`. It stays because the
  frozen KCC revision 1 reads it.
- **Query shapes**: `overlap` and `shapeCast` take every convex primitive
  (sphere, box, capsule, cylinder, cone, and tapered capsule) and a convex
  hull, `{ type: 'hull', vertices, maxVertices? }`. The
  query cooks the hull as a hull body (the same cook and the same `maxVertices`
  rule) and tests its exact convex shape, not its bounds, against every
  target. A hull query shape needs at least 4 vertices that span a volume.
  Periodic worlds reject it.
- **One body**: `onlyBody` on a ray, an overlap, or a shape cast tests only that
  body.
  Periodic worlds reject it.
- **Callbacks**: `castRay(query, callback)` and `castShape(query, callback)`
  visit the hits with a callback. The callback gets
  each hit and its fraction (distance / `maxDistance`) in a fixed order:
  ascending distance, then ascending body id. It returns a negative value to
  ignore the hit, 0 to stop, a fraction to clip the cast, or 1 to continue.
  `overlapShape(query, callback)` visits the overlapped bodies in ascending
  body id order and stops when the callback returns false. The hits come from
  one native query before the first call.
- **Closest hit**: `castRayClosest(query)` returns the closest hit or
  `undefined`. A tie goes to the lower body id.
- **First hit**: `stopAtFirstHit: true` returns at most one hit: the hit body
  with the lowest body id, as a cast callback that returns 0 at its first call.
  It is not the closest hit. With no open portal pair, the native query stops at
  that hit, in both query index modes.
- **Bounds**: `readBodyAabb(handle)` returns the tight world bounds of a body
  `overlapAabb({ bounds, filter })` returns the
  ids of the bodies whose tight bounds overlap `bounds`, in ascending body id
  order. An optional callback that returns false
  stops the visit. Periodic worlds reject it, and portals do not apply.

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

### Character mover <a id="character-mover"></a>

The mover tools move a capsule character with collision planes.

- `collideMover({ origin, mover, ...filter })` finds the collision planes of a
  capsule mover. `mover` is a capsule: `center1`, `center2`, and
  `radius`, relative to `origin` (default zero). The result is one
  `PhysicsPlaneResult3D` for each collision plane: `bodyId`, `plane` (`normal`
  from the shape toward the mover, and `offset`, the push depth at the query
  pose), `point` (the closest point on the shape, relative to `origin`),
  `triangleIndex` (the mesh or heightfield triangle in input order; 0 for
  other shapes), and `childIndex` (the top-level compound child). The
  order is body id, then child, then triangle. A shape gives at most 64 planes.
- `castMover({ origin, mover, translation, ...filter })` sweeps the mover
  along `translation`. It returns the fraction of `translation` that the mover
  can move (1 is no hit). A shape that the mover overlaps at the start is
  ignored. The hit leaves the surfaces 5 mm (the linear slop) into each
  other, so the next `collideMover` call sees the contact.
- `solvePlanes3D(targetDelta, planes)` finds the mover translation that
  satisfies the planes. `clipVector3D(velocity, planes)` removes the part of a
  velocity that moves into a plane with a push. A `PhysicsCollisionPlane3D` has
  `plane`, `pushLimit` (`Number.MAX_VALUE` is rigid), `push` (the solver
  writes it), and `clipVelocity`.
- The filter fields are those of `overlap()` (`filter`, `hitStatics`,
  `hitTriggers`, `excludeBody`, and the others). Custom filter callbacks are not
  available, because a JavaScript call inside the native query cannot be made
  safe for rollback.
- A deep overlap of the mover core with a box, a hull, a mesh, or
  a heightfield gives no plane, and the back side of a mesh or heightfield
  triangle gives no plane and no cast hit. Cylinders, cones, and tapered
  capsules are convex shapes, as hulls. Spheres and capsules use closed-form
  tests.
- Mover queries do not see portals, and a periodic world rejects them.

```ts
import { clipVector3D, solvePlanes3D } from '@series-inc/rundot-syncplay/physics/3d';

const mover = { center1: { x: 0, y: 0.3, z: 0 }, center2: { x: 0, y: 1.3, z: 0 }, radius: 0.3 };
let position = start;
for (let iteration = 0; iteration < 5; iteration += 1) {
  const planes = world.collideMover({ origin: position, mover })
    .map((result) => ({ plane: result.plane, pushLimit: Number.MAX_VALUE, push: 0, clipVelocity: true }));
  const solved = solvePlanes3D({ x: target.x - position.x, y: target.y - position.y, z: target.z - position.z }, planes);
  const fraction = world.castMover({ origin: position, mover, translation: solved.delta });
  position = { x: position.x + fraction * solved.delta.x, y: position.y + fraction * solved.delta.y,
    z: position.z + fraction * solved.delta.z };
  if (fraction * fraction * (solved.delta.x ** 2 + solved.delta.y ** 2 + solved.delta.z ** 2) < 1e-4) break;
}
```

### Batched rays

`world.raycastBatch(queries)` runs 1 to 64 raycasts (1 to 256 in a periodic
world) and returns each ray's hits in order. The results equal separate `raycast` calls. With no open portal pair,
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

### Periodic worlds

A world definition with `periodicDomain` makes a flat x/z torus for queries.
Queries see every image of each stored solid, moved by whole spans on x and
z. Each hit then has `image: { x, z }`, after `childIndex`. The hit point is
already in the query frame; do not add the image again. Raycasts, ray batches,
and sphere or box overlaps and shape casts are supported. `closestPoints`,
`onlyBody`, other query shapes, and portal pairs are rejected. The domain
changes queries only: the solver does not wrap bodies or make contacts across
a seam. The profile id carries the domain, so every peer needs the same
domain, and the same physics ABI. The package guide `docs/periodic-space.md`
gives the limits and cost.

The 3D character controller uses rejected capsule queries. Vehicle helpers can
issue rejected `onlyBody` queries. Ray helpers, including lag-compensation
queries, need an explicit finite `maxDistance` within the periodic limits.
These modules do not make unsupported queries valid.

<!-- syncplay-example: physics3d-periodic-queries -->
```typescript
import {
  createPhysicsWorld3D,
  initPhysics3D,
  meters,
} from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({
  capacity: { bodies: 8, joints: 0 },
  periodicDomain: { minX: meters(0), maxX: meters(16), minZ: meters(0), maxZ: meters(24) },
})
world.edit((edit) => edit.createBody({
  kind: 'static',
  position: { x: meters(2), y: meters(0), z: meters(3) },
  shape: { type: 'sphere', radius: meters(1) },
}))
const hits = world.raycast({
  x: meters(-24.5), y: meters(0), z: meters(3),
  dx: 1, dy: 0, dz: 0, maxDistance: meters(50),
})
if (hits.map((hit) => hit.image?.x).join() !== '-1,0,1') throw new Error('unexpected periodic images')
world.dispose()
```

## Use stable joints

API v1 supports distance, point, revolute, prismatic, weld, motor, filter,
wheel, parallel, mover, pogo, and six-axis joints.

The motor joint drives the relative motion of two bodies.
`linearVelocity` and `angularVelocity` are relative world-space targets.
`maxVelocityForce` and `maxVelocityTorque` limit the length of each drive
impulse vector. Zero supplies no drive impulse.
`linearHertz`, `linearDampingRatio`, and `maxSpringForce` set a spring that
pulls anchor B onto anchor A. `angularHertz`, `angularDampingRatio`, and
`maxSpringTorque` set a spring that turns body B to `targetRotation` relative
to body A. A spring with zero hertz or a zero maximum has no effect.
The motor joint does not hold the anchors together. The motor has no axis
drive. For a drive about a local axis, use a revolute joint motor.

The parallel joint keeps `axis` of body B parallel to
`axis` of body A with a spring: `frequencyHz` (default 1), `dampingRatio`
(default 1), and `maxTorque` (zero or omitted means no limit). Rotation about
the axis stays free.

The mover joint drives body B at the world-space
`linearVelocity` with at most `maxForce`. It acts only in the plane normal to
`axis`, which is local to body B and defaults to +Y. It does not turn the
bodies. Use it to move a dynamic character.

The pogo joint is a spring for hover and suspension.
`axis` is local to body B and defaults to +Y. The spring length is the distance
from anchor A to anchor B along that axis. The spring pushes along the world
`normal` (default +Y) toward `restLength`, with `frequencyHz`, `dampingRatio`,
`maxTensionForce`, and `maxCompressionForce`. The spring has no effect when
`frequencyHz` is zero, which is the default.

A filter joint disables collision only between its two endpoints. It does not
change either body's collision filter. Removing it restores normal pair filtering.

The RC1 API also exposes the native weld spring
controls. Set `linearDampingRatio` and `angularDampingRatio` separately.
`dampingRatio` supplies the default for each omitted value.
Set `maxSpringForce` and `maxSpringTorque` to limit each native spring axis.
Zero retains the native unbounded setting. These are per-axis limits, not one
shared vector limit. `targetRotation` is the desired rotation of body B relative
to body A. The API normalizes a nonzero quaternion. An omitted target is identity.
Use a kinematic endpoint and its local anchor for a moving position target.
Use `updateJoint` to change spring settings on a live joint.
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

### Change a live joint

`world.updateJoint(handle, update)` changes a live joint in place, for example
a new motor speed, new constraint tuning, or a new `collideConnected` value.
It is not a topology edit.
The joint keeps its handle and the solver warm state of the rows that stay.
A disabled limit or motor loses its warm impulse.
Set `type` to the type of the joint. Name only the fields to change. Use `null`
to remove an optional field: for example, `minAngle: null` removes the lower
angle limit. The update cannot change the bodies or the portal. The change is
part of the world state, so checkpoints, restores, and the digest carry it.
Call the update inside the deterministic simulation, as other world setters.
`world.wakeJointBodies(handle)` wakes the two bodies.

### Joint tuning, events, and reads

Each joint accepts these base joint fields. `constraintHertz` (default 60)
and `constraintDampingRatio` (default 2) set the stiffness of the position
correction on the soft-step route. The solver uses at most a quarter of the substep
rate. Zero hertz removes the position correction.
`forceThreshold` and `torqueThreshold` set joint event thresholds.
`world.readJointEvents()` lists each joint whose reaction force or torque in the
last step had a length at or above its threshold.
An omitted threshold gives no event. Thresholds do not break the joint. Use
`breakForce` and `breakTorque` to break it.
The distance joint spring accepts `lowerSpringForce` (the most tension, zero or
negative) and `upperSpringForce` (the most compression).

A revolute, prismatic, weld, or wheel joint keeps the rotation of body B
relative to body A when the joint is made. `readJoint` gives it as
`referenceRotation`. The soft-step route corrects the angular lock rows to it.
`updateJoint` keeps it. A prismatic joint locks all three rotation axes,
including the rotation about its slide axis.

`world.readJoint(handle)` gives the definition fields of the joint type and a
`state` block. `state.position` is the distance or pogo length, the prismatic
translation, the wheel suspension translation, the revolute angle, or the point
twist angle. `state.speed` is its rate. `state.angle` is the point cone angle or
the wheel steering angle. `state.angularSpeed` is the wheel spin speed.
`state.linearSeparation` and `state.angularSeparation` are the position and
rotation errors that the joint does not allow. `state.motorForce` is the revolute, prismatic,
or wheel motor force or torque of the last substep. `state.constraintForce` and
`state.constraintTorque` are the reaction on body B in the last step. A value
that a joint type does not have is zero.

<!-- syncplay-example: physics3d-joint-update -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';
import { initPhysics3D, createPhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d'

await initPhysics3D()
const world = createPhysicsWorld3D({ tickRate: 60, initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0), z: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 2, joints: 1 } })
const handles = world.edit((edit) => {
  const anchor = edit.createBody({ kind: 'static', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) }, filter: { maskBits: 0n } })
  const door = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) }, filter: { maskBits: 0n } })
  const hinge = edit.createJoint({ type: 'revolute', bodyA: anchor, bodyB: door, axis: { x: 0, y: 1, z: 0 },
    motorSpeed: syncplayUnits.radiansPerSecond(1), maxMotorTorque: syncplayUnits.newtonMeters(100) })
  return { door, hinge }
}).created
world.step()
world.updateJoint(handles.hinge, { type: 'revolute', motorSpeed: syncplayUnits.radiansPerSecond(-2) })
world.step()
if (Math.abs(world.readBody(handles.door).angularVelocity.y + 2) > 1e-6) throw new Error('Expected the new motor speed')
const read = world.readJoint(handles.hinge)
if (read.type !== 'revolute' || read.motorSpeed !== -2) throw new Error('Expected the updated definition')
if (Math.abs(read.state.speed + 2) > 1e-6) throw new Error('Expected the joint speed')
world.dispose()
```

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
are bit-identical to separate reads. Set `wheelCastFilter` (a query
filter: `{ categoryBits, maskBits }`) on the vehicle definition to let the
wheel rays skip bodies, for example a cage around the vehicle. The default hits
every body. The old `wheelCastLayerMask` field is removed.

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

The contact data of each pair includes `approachSpeed`. This is the nonnegative
approach speed along the reported normal before contact impulses solve. It uses
linear velocity and angular velocity at the reported contact point. It includes
the gravity and update order of that substep. A separating or stationary point
reports zero. Checkpoints and the digest retain this value.
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
  const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) }, filter: { maskBits: 0n } })
  const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) },
    mass: syncplayUnits.kilograms(2), filter: { maskBits: 0n } })
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
const sixAxis = world.readJoint(handles.joint)
if (sixAxis.type !== 'six_dof' || sixAxis.angularAxes.length !== 3) throw new Error('Incomplete six-axis record')
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
  const anchor = edit.createBody({ kind: 'kinematic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) }, filter: { maskBits: 0n } })
  const body = edit.createBody({ kind: 'dynamic', shape: { type: 'sphere', radius: syncplayUnits.meters(0.1) },
    mass: syncplayUnits.kilograms(1), filter: { maskBits: 0n } })
  return edit.createJoint({ type: 'motor', bodyA: anchor, bodyB: body,
    linearVelocity: { x: syncplayUnits.metersPerSecond(100), y: syncplayUnits.metersPerSecond(0), z: syncplayUnits.metersPerSecond(0) }, maxVelocityForce: syncplayUnits.newtons(6), breakForce: syncplayUnits.newtons(1) })
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
      linearVelocity: { x: syncplayUnits.metersPerSecond(1), y: syncplayUnits.metersPerSecond(0), z: syncplayUnits.metersPerSecond(0) }, maxVelocityForce: syncplayUnits.newtons(6),
      angularVelocity: { x: syncplayUnits.radiansPerSecond(0), y: syncplayUnits.radiansPerSecond(0), z: syncplayUnits.radiansPerSecond(1) }, maxVelocityTorque: syncplayUnits.newtonMeters(5) })
    return { body, filter, motor }
  }).created
  world.step()
  if (world.contactData().length !== 0) throw new Error('Filtered endpoints must not collide')
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

> These figures have no version label. They are not measured for rc.81. For the
> rc.81 step times, read
> [Syncplay: migrate 3D physics from rc.80 to rc.81](SYNCPLAY-RC81-MIGRATION.md), section "Performance in rc.81".
> Measure your game on rc.81.

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

The engine clamps an angular velocity that it cannot integrate, and the step
completes. In a test, a body with an angular velocity of 1e200 rad/s ends the
step with zero angular velocity and no rotation. Check input values in game
code. Do not use a step failure to find them.

Call `latest()` after `step()` to read the contact, sensor, body move, joint,
break, and fluid outputs. Call `contactData()` or `bodyContactData()` to read
the touching pairs. Call `info()` to read the backend identity, fixed time step,
counts, and capacities. The backend value is `cpp-wasm`.

The outputs of `latest()` are frozen, and you can keep them. Each step returns
a new output object.

### Contact and sensor events

The events are opt-in: a world publishes an event only for a
shape pair whose shapes enable it. All event flags are false by default. A body
pair has one contact for each pair of its shapes that touch, so each event, each contact data row and each sensor
event names its shapes (`PhysicsShapeId3D`). So a world
with many resting bodies publishes no event rows, and `latest()` costs time
only for the events that you ask for.

| Output | Contents |
| --- | --- |
| `latest().contactEvents.begin` | The shape pairs that began to touch in the step. A pair touches when a manifold has points, also speculative points: two shapes closer than the speculative distance (2 cm) touch before they overlap. Each event has the contact data of the shape pair, with `shapeA` and `shapeB`. One shape must enable `enableContactEvents`. There is no event for a pair that stays in touch. |
| `latest().contactEvents.end` | The shape pairs that stopped touching in the step: `bodyA`, `bodyB`, `shapeA`, `shapeB`. One shape must enable `enableContactEvents`. |
| `latest().contactEvents.hit` | The touching shape pairs with a manifold point whose approach speed is above `hitEventThreshold` and that took a normal impulse. Each event has the contact data of the shape pair. One shape must enable `enableHitEvents`. |
| `latest().sensorEvents.begin`, `.end` | `{ sensorBody, visitorBody, sensorShape, visitorShape }` for each visitor shape that began or stopped to overlap a sensor shape. A sensor shape is a shape of a trigger or sensor body, or a shape with `isSensor`, also on a body that is not a sensor. Both shapes must enable `enableSensorEvents`. A visitor shape must be convex: a mesh, a heightfield, or a compound shape (a compound without shape fields, or a compound child of a shape list) is never a visitor; each convex shape of a shape list is a visitor. A sensor shape also detects another sensor shape, so two sensors that overlap give two events. A sensor needs an overlap, not a speculative point. The step tests the sensors after the solve, with the poses at the end of the step, and against bodies of every kind, static bodies too. The flags are tested in that step: an overlap whose sensor or visitor turns off its sensor events ends with an end event. |
| `latest().bodyMoveEvents` | The dynamic and kinematic bodies that were awake in the step, with the pose after the step. `fellAsleep` is true in the step where the body went to sleep. A sleeping body and a static body have no move event. |
| `contactData()` | Every touching shape pair without a sensor. Use it for tools and tests: it costs time for each pair. |
| `bodyContactData(body)` | The touching shape pairs of one body without a sensor. |
| `sensorOverlaps(sensor)` | The visitor shapes (`PhysicsShapeId3D[]`) that touch a sensor shape now. Pass a sensor shape id, or a body for all of its sensor shapes. The sensor shape and each visitor shape must enable sensor events. |

Each list is in body pair order, then in shape pair order, so all peers get the
same order. Body A of a pair has the smaller body ID. The contact data of a
shape pair has `shapeA` and `shapeB`, a summary (the point, normal, and
penetration of the deepest manifold of the shape pair, the sum of the impulses
of its manifolds, and `approachSpeed`) and its `manifolds`. A shape of a mesh or
a heightfield has one manifold per triangle cluster. Each manifold has `childA`
and `childB`, the compound children that touch (0 for a body that is not a
compound), its normal, its friction impulses, and one to four points with the
anchors, separation, normal impulse, total normal impulse, and normal velocity
before the solve.

A shape pair of a compound takes the custom filter of its two shapes and the
pre-solve rules with the normal of its first manifold, so one shape of a body
can make a contact that another shape of the same body does not.

A hit event uses the manifold point with the highest approach speed of the
points that took a normal impulse. Its `approachSpeed`
is the approach speed of that point, its `normal` is the normal of the manifold
of that point, and its `point` is the midpoint of the two body centers after
the step plus the midpoint of the two anchors of that point. A pair without
manifolds in the step (a portal step or a material motion epoch) uses the
summary point, `approachSpeed`, and `normalImpulse`.

The step keeps the contact events and the sensor rows in the state, the digest,
and each checkpoint. It does not keep the touching pairs. `contactData()`,
`bodyContactData()`, the `manifolds` of each contact, `info().contactCount`, and
`readStepProfile().contactPointCount` are computed when you read them. A read
changes no state, so `contactData()` costs time only when you call it.

The body move events belong to the step that made them. A checkpoint does not
keep them. After `restoreCheckpoint()`, `restore()`, or an import, and before
the next step, `latest().bodyMoveEvents` is empty, and `contactData()` gives the
contacts of the restored state with their manifolds. `checkpointLatest()` gives
the same contact and sensor events as `latest()` gave for that step. A checkpoint
that was captured while the world ran on the public solver has no soft-step
contact data: after its restore, `contactData()` lists only the pairs with an
event until the next step.

Every begin gets one end. An edit that destroys a touching contact ends the pair
in the next step: a removal, a replacement (also with the same definition), a
disable, a type change, a destroyed shape, a filter change (also a filter that
still accepts the pair), or a geometry change. When the shapes still touch after
that step, the step also has a begin of the same pair, after the end. A pose, a
velocity, a material, a flag, or a mass change keeps the contact. The end names
the body ID and the shape ID that the pair had, and the key of a removed body.
Until that step, `latest()` keeps the events of the last step, and
`contactData()` does not list the destroyed contact.

A kinematic body and a static body make no contact. A sleeping pair keeps its
contact and the manifolds of the last step that solved it. A sleeping pair gives
no hit event.

The hit events are part of the state. Every peer must use the same
`hitEventThreshold` from the same tick.

The native broadphase holds at most 100,000 pairs.

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
| `applyAngularImpulse()` | Apply an angular impulse. |
| `explode()` | Apply a radial explosion to dynamic bodies. |
| `applyBodyWind()` | Add a wind force and torque for the next tick. |
| `setBodyTargetTransform()` | Set the velocities that move a body to a target pose in one tick. |
| `setBodyType()`, `setBodyGravityScale()`, `setBodyAngularDamping()`, `setBodySleepEnabled()`, `setBodySleepThreshold()`, `setBodyAwake()`, `setBodyCcd()`, `setBodyMotionLocks()`, `setBodyAllowFastRotation()` | Change one body setting in place. |
| `setBodyMassData()`, `applyMassFromShapes()` | Set the mass, center of mass, and inertia, or compute them from the shape and a density. |
| `readBodyLocalPoint()`, `readBodyWorldPoint()`, `readBodyLocalVector()`, `readBodyWorldVector()` | Change a point or a vector between body and world coordinates. |
| `readBodyLocalPointVelocity()`, `readBodyWorldPointVelocity()` | Read the world velocity of a body point. |
| `readBodyJoints()` | List the joints of a body. |
| `readBodyShapes()` | List the shapes of a body. See [Multi-shape bodies](#multi-shape-bodies). |
| `setGravity()`, `setContactTuning()`, `setRestitutionThreshold()`, `setMaximumLinearSpeed()`, `readTuning()`, `readCounters()` | Change and read world settings at runtime. |
| `enableSleeping()`, `enableContinuous()`, `enableWarmStarting()` | Set the world switches `enableSleep`, `enableContinuous`, and `enableWarmStarting`. |
| `readStepProfile()` | Read the work counts of the last step. |
| `disableBody()`, `enableBody()`, `isBodyEnabled()` | Disable, enable, or read a body. |
| `setBodySafetyFactor()`, `readBodySafetyFactor()` | Set or read the continuous safety factor of a body. |
| `collideMover()`, `castMover()` | The character mover queries. See [Character mover](#character-mover). |
| `readBody()` | Read body state with a current handle. |
| `readMotion()` | Read settings and motion without copying complex geometry. |
| `readJoint()` | Read joint state with a current handle. |
| `readFluid()` | Read fluid state with a current handle. |
| `resolveBody()` | Resolve a stable body ID to a current handle. |
| `resolveJoint()` | Resolve a stable joint ID to a current handle. |
| `resolveFluid()` | Resolve a stable fluid ID to a current handle. |
| `latest()` | Read the contact, sensor, body move, joint, break, and fluid output of the latest step. |
| `contactData()` | Read every touching pair without a sensor. |
| `bodyContactData()` | Read the touching pairs of one body. |
| `sensorOverlaps()` | Read the visitors that touch a sensor. |
| `setHitEventThreshold()`, `hitEventThreshold()` | Set or read the hit event threshold. |
| `raycast()` | Return ordered ray hits. |
| `overlap()` | Return ordered overlap hits. |
| `shapeCast()` | Return ordered swept-shape hits. |
| `closestPoints()` | Return ordered closest-point results. |
| `castRay()` | Visit ray hits with a cast callback. |
| `castRayClosest()` | Return the closest ray hit. |
| `castShape()` | Visit swept-shape hits with a cast callback. |
| `overlapShape()` | Visit overlapped bodies with a callback. |
| `overlapAabb()` | Return the bodies whose bounds overlap a box. |
| `readBodyAabb()` | Read the tight world bounds of a body. |
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

- **Filters**: a host wall keeps its own collision filter. Games keep all 64
  category bits.
- **Contacts**: before each step, the world excludes contacts between a host
  wall and the bodies inside one of its openings. Bodies outside the opening
  still touch the wall.
- **Count**: the number of host walls is limited only by body capacity.
- **Queries**: a query filter applies to host walls like any other body.
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
  rules. This is history: the rc.34 migration notes are not in the package.
- **Aperture containment tolerance (0.05 m per boundary)**: containment uses
  a 5 cm margin per projected boundary ($|x| + e_x \le W/2 + 0.05$,
  $|y| + e_y \le H/2 + 0.05$). A centered body can be up to 0.10 m wider than
  the opening.
- **KCC pending host references**: character controller portal lists accept
  unresolved `hostBodyId` references from `edit.createBody()` inside
  `world.edit()`.

## Physics debug overlay

The 3D physics engine provides a read-only debug overlay helper for authoring and tooling.

`createPhysicsDebugOverlay3D` extracts wireframes for physics bodies, contacts, joints, and sensors without mutating world state. It accepts `PhysicsDebugOverlayOptions3D` and returns `PhysicsDebugOverlay3D`. It reports shapes with `PhysicsDebugShapeKind3D` and `PhysicsDebugWireframeShape3D`, contacts with `PhysicsDebugContactRecord3D`, and joints with `PhysicsDebugJointRecord3D`.

<!-- syncplay-example: physics3d-debug-overlay -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/3d';

await syncplayUnits.initPhysics3D();
const world = syncplayUnits.createPhysicsWorld3D({
  capacity: { bodies: 4, joints: 2 },
});

const { box } = world.edit((edit) => ({
  box: edit.createBody({
    kind: 'dynamic',
    shape: { type: 'box', halfX: syncplayUnits.meters(1), halfY: syncplayUnits.meters(1), halfZ: syncplayUnits.meters(1) },
    position: { x: syncplayUnits.meters(0), y: syncplayUnits.meters(2), z: syncplayUnits.meters(0) },
  }),
})).created;

const overlay: syncplayUnits.PhysicsDebugOverlay3D = syncplayUnits.createPhysicsDebugOverlay3D(world, {
  bodyHandles: [box],
  maxShapes: 10,
  includeSensors: true,
});

for (const shape of overlay.shapes) {
  const kind: syncplayUnits.PhysicsDebugShapeKind3D = shape.kind;
  const wireframe: syncplayUnits.PhysicsDebugWireframeShape3D = shape;
  void kind;
  void wireframe;
}

world.dispose();
```

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
- `PhysicsBodyActivityCounts3D`
- `PhysicsBodyMobility3D`
- `PhysicsBodyTransform3D`
- `PhysicsCheckpointInfo3D`
- `PhysicsCheckpointMotionBatch3D`
- `PhysicsCheckpointView3D`
- `PhysicsDetachCompoundChildOptions3D`
- `PhysicsDetachCompoundChildResult3D`
- `PhysicsFragmentCommonInput3D`
- `PhysicsFragmentInput3D`
- `PhysicsFragmentizeOptions3D`
- `PhysicsInlineFragmentInput3D`
- `PhysicsNamedFragmentInput3D`
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
- `createPhysicsDebugOverlay3D`
- `PhysicsDebugContactRecord3D`
- `PhysicsDebugJointRecord3D`
- `PhysicsDebugOverlay3D`
- `PhysicsDebugOverlayOptions3D`
- `PhysicsDebugShapeKind3D`
- `PhysicsDebugWireframeShape3D`
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

***

## Assembly knobs: orientation hold and kinematic path drive

Two helpers sit beside the grab servo. They are the building blocks a physical-assembly
sandbox needs and the grab servo does not provide, because its target is position and
velocity only.

The hold applies **torque**, never a pose. Terrain can therefore still resist it: a blocked
hold reached only 13.7% of the commanded rotation, while the same command with nothing in
the way reached 0.000 degrees of error.

- `createOrientationHold3D` wraps the controller and applies the torque for you.
- `orientationHoldTorque3D` is the pure proportional-derivative controller, for a game that
  drives its own force path.
- `validateOrientationHold3DState` fails closed on malformed state.
- `ORIENTATION_HOLD_DEFAULT_GAINS` carries the measured defaults: stiffness 200, damping 8,
  and a 200 Nm cap. They settle a free body inside one degree in 55 ticks with zero
  steady-state error, and they hold at four times the inertia.

The types are `OrientationHold3DGains`, `OrientationHold3DState`,
`OrientationHold3DOptions`, `OrientationHold3DStepOutput` and `OrientationHold3D`.

The path drive moves one body along a recorded path. It writes the **interval-start** pose
plus the derived linear and angular velocity, so the solver advances the body by exactly
`velocity / tickRate` and it lands on the next sample.

**The velocity write is mandatory.** A pose-only write moves the body but transfers exactly
zero momentum: a neighbour was displaced 6.818 m while receiving 0.000 m/s, against 6.807 m
and 5.970 m/s for the velocity-driven drive. A rewind validated on position alone would pass
while being physically wrong.

- `createKinematicPathDrive3D` exposes `begin`, `step`, `end`, `capture` and `restore`.
  Switching a body's kind preserves its joints in both directions.
- `validateKinematicPathDrive3DState` fails closed on malformed state.

The types are `KinematicPathDrive3D`, `KinematicPathDrive3DOptions`,
`KinematicPathDrive3DSample` and `KinematicPathDrive3DState`.

`end` restores the dynamic kind and the exact velocity the body had when the drive started.

See [Physical assemblies](SYNCPLAY-PHYSICAL-ASSEMBLY.md) for the authoring layer built on
these two knobs.

## Cellular voxel fields and sparse destruction arenas

Syncplay has two separate native voxel stores. Both use the selected
physics WASM instance. Import their public APIs from
`@series-inc/rundot-syncplay/physics/3d`.

### CellularField3D

Call `initCellularField3D()` before `createCellularField3D(options)`.
The dimensions are chunk counts. Each chunk has 16 × 16 × 16 cells.
Each cell has a material byte and a metadata byte. Material 0 is empty.
Set the same material definitions and reaction rules on every peer.

`setMaterial()` supports static solids, powder, liquid, gas, and fire.
`addRule()` defines a contact reaction between two material IDs.
The field supports at most 256 material IDs and 128 reaction rules.
Call `step(tickSeed)` with the same seed and tick order on every peer.
The native step uses 64-bit active-brick masks and scalar integer operations.
The production build does not use WASM SIMD instructions.

Use `setCell()`, `setCellsBatch()`, `editBox()`, `editSphere()`, and
`editCapsule()` for changes. Treat `chunkMaterialsView()`, `chunkMetaView()`,
and `materialVisualsView()` as read-only views. Direct writes bypass change
tracking. Obtain new views after WASM memory growth or a state change that
replaces pages.

`raycastBatch()` uses voxel DDA. `raycastBatchInto()` writes into caller-owned
arrays. `resolveAabbBatch()` performs axis-separated sweeps with optional
`stepUp`. Its result contains `collided`, `toi`, `resolvedDisplacement`,
`normal`, and `hitMatId`. It does not return grounded, ceiling, or fluid flags.
Use the exported stride constants with the `Into` query methods.

`captureCheckpoint()` retains native chunk pages. The chunk table and its
reference counts are copied. This is application-level copy-on-write.
It is not operating-system page protection. Capture and restore work scales
with the chunk count. Release every checkpoint with `releaseCheckpoint()`.
The JavaScript convenience methods can allocate result objects or typed views.

<!-- syncplay-example: cellular-field-checkpoint -->
```ts
import {
  initCellularField3D,
  createCellularField3D,
  CellularMaterialKind,
  CellularMaterialFlags,
} from '@series-inc/rundot-syncplay/physics/3d';

await initCellularField3D();
const field = createCellularField3D({
  chunksX: 1,
  chunksY: 1,
  chunksZ: 1,
  cellSize: 0.25,
});
try {
  field.setMaterial(1, {
    kind: CellularMaterialKind.StaticSolid,
    flags: CellularMaterialFlags.BlocksMovement,
  });
  field.setCell(2, 3, 4, 1);
  const saved = field.captureCheckpoint();
  try {
    field.setCell(2, 3, 4, 0);
    field.restoreCheckpoint(saved);
    if (field.getCellMaterial(2, 3, 4) !== 1) {
      throw new Error('Cellular checkpoint did not restore the cell');
    }
  } finally {
    field.releaseCheckpoint(saved);
  }
} finally {
  field.dispose();
}
```

`markBaseline()` retains the generated baseline. `exportBaselineDelta()`
encodes changed chunks against that baseline. The receiver must generate and
mark the same baseline before `importBaselineDelta()`. Use `serialize()` and
`hydrate()` for full field transfer. These field formats differ from the
session snapshot envelope.

`syncDirtyCollidersToPhysicsWorld(world, options)` publishes static
`voxel_compound` bodies for dirty chunks. Use `maxChunks` to bound work.
Use `resyncAllCollidersToPhysicsWorld()` after an independent world restore.
Use a unique `colliderKeyPrefix` for each field in a world.
This helper does not create heightfield colliders.

The SHA-256 Merkle tree hashes dirty chunk data and updates affected ancestors.
The first `merkleRootBytes()` or digest read after writes performs pending
native hash work. A cached root read takes constant work. A dirty root read
still scales with dirty bytes and affected ancestors. `merkleRootView()` and
`foldedLanesView()` expose borrowed views. Copy a view before retaining it.
`merkleRootBytes()` returns an owned copy. Optional cellular contributors can
be included in installed 3D commitments. `createDeterministicStateDigest()` also
provides `mixCellularField()`.

### Greedy meshes and packed projection

`createCellularMesher3D()` meshes 16³ chunks with a one-cell halo.
The native mesher preserves material and ambient-occlusion boundaries when it
merges coplanar faces. Results contain separate opaque and translucent meshes.
Each vertex occupies 16 bytes: position and AO, normal and emissive value,
RGBA, and material/quad data. Index buffers are separate.

`CellularSlabPool3D` reuses output buffers. Return unused results with
`releaseChunkMesh()`. Do not retain a slab after release.
`createCellularMeshWorkerPool3D()` sends halo jobs to workers. Workers have
separate WASM instances. A worker job copies or transfers its input and output;
it does not share the live field's WASM memory.

The render adapter provides `createCellularChunkMeshProjector3D()`,
`createCellularInterleavedAttributeDescriptors3D()`, and
`unpackCellularSlabToFloatAttributes()`. The projector updates dirty chunks
as one batch and retains their slabs. Call `dispose()` when it is no longer
needed. Packed attributes require matching renderer or shader support.
Float unpacking allocates unless the caller supplies sufficient output arrays.
The SDK does not change a game's remesh limit or renderer automatically.

### Sparse Teardown arena

`createCellularTeardownArena3D({ dimX, dimY, dimZ, cellSize })` creates a
separate sparse destruction store. Its dimensions are cell counts, from 1 to
512 per axis. `cellSize` uses `meters(...)`. Initialize physics first.
This arena does not run the `CellularField3D` material automaton and does not
share that field's pages, Merkle tree, or collider-sync state.

The hierarchy contains 8³ bricks and coarse groups of 4³ bricks.
`brickOccupancyMipRg32View()` provides the occupancy mip data.
`drainDirtyBrickBoxes({ format: 'rg8ui' })` returns coalesced cell regions with
material and metadata texels. The `r8ui` format returns material texels only.
Upload each box with `texSubImage3D` and matching integer texture formats.
The SDK supplies the data stream. It does not supply a raymarching renderer.

Read chunk pages with `getChunkPage()`. For direct edits, request a writable
page and call `syncChunkPage()` after the edit. Writable views can force page
copies when a snapshot is pinned. Do not keep borrowed views across WASM memory
growth. Prefer `fillCellsBox()`, `carveCellsBox()`, and world-space sphere edits
when direct page access is unnecessary.

Box, sphere, and batch edits prepare writable pages before changing cells.
If a native page allocation fails, cells, page ownership, and dirty state stay
unchanged. Snapshot restore also prepares replacement pages before changing
live pages. Restore needs memory for both the old and replacement pages during
this step. Duplicate chunk entries are invalid snapshot data. Sphere inputs
must produce cell bounds that fit signed 32-bit coordinates.

`extractDetachedIslands(bounds, options)` runs native connected-component
search in a bounded region. It is one synchronous operation, not a resumable
per-tick search. Choose bounds that include the support connections needed
for the decision. `spawnDetachedCellularIslands3D()` creates dynamic voxel
bodies from extracted islands. `settleSleepingCellularIslands3D()` writes
sleeping bodies back to the arena. `createCellularIslandBridge3D()` groups these
operations. The game must call them at deterministic points.

For rollback, register each arena in `createPhysicsInstalledRuntimeAdapter3D` with
`teardownArenas`. Register each island bridge with `cellularIslandBridges`.
The bridge must refer to a registered arena. The adapter saves the arena cells,
placement, material flags, tracked voxel roots, and low-motion counters. It restores
physics first, then arenas, then bridges. These states also enter the checksum
and donor snapshot. Leaving either object outside registration leaves its state
outside rollback. Do not carve a tracked body through another helper. Its saved
voxel root would no longer match the body.

This registration uses self-contained serialized checkpoints and hashes their
bytes. It has copy, compression, and hashing costs. It is not a constant-time
checkpoint or digest path. Register the cellular automaton with `cellularFields`;
that store remains separate from the sparse arena.

`LiveVoxelBodyState3D` uses typed slabs for occupancy and material data.
Public property reads return defensive slab copies. Retain a returned copy for
repeated reads within one operation. These reads are not zero-copy access to
the internal state.
`carveAndSplitVoxelBody3D()` carves a body and creates detached body components.
The existing `carveVoxelBody3D()` keeps its single-body behavior.
Set `maxDynamicIslandCells` to bound eligible fragments. Components outside
the selected size range stay with the primary body.

`pinSnapshotGeneration()` retains an immutable generation. It walks the chunk
table and retains pages. It copies pages that have exposed writable views.
`createCellularPinnedSnapshotWorker3D()` compresses a pinned generation in a
worker. `encodePinnedSnapshot()` first exports the raw packet on the caller
thread, then transfers it to the worker. It releases the pin by default.
Set `releasePin: false` only when the caller will release it.
Pass the same retained `baselinePin` to encoding and delta restoration.
Release the baseline pin when it is no longer needed. Dispose the worker and
arena when the session ends. This path does not provide an O(1) shared-memory
handoff to the worker.

### Voxel constants and supporting types

| Constant | Meaning |
| --- | --- |
| `CELLULAR_AABB_QUERY_STRIDE` | 11 Float64 values per sweep input. |
| `CELLULAR_AABB_RESULT_STRIDE` | 9 Float64 values per sweep result. |
| `CELLULAR_ABI_VERSION` | Cellular arena ABI version 1. |
| `CELLULAR_BRICKS_PER_CHUNK` | 64 active 4³ bricks per chunk. |
| `CELLULAR_CHUNK_CELLS` | 4096 cells per chunk. |
| `CELLULAR_CHUNK_DIM` | 16 cells per chunk axis. |
| `CELLULAR_HALO_CELLS` | 5832 cells per padded chunk. |
| `CELLULAR_HALO_DIM` | 18 cells per padded chunk axis. |
| `CELLULAR_MATERIAL_COUNT` | 256 mesher material slots. |
| `CELLULAR_MATERIAL_TABLE_BYTES` | 2048 bytes per visual table. |
| `CELLULAR_MATERIAL_VISUAL_STRIDE_BYTES` | 8 bytes per visual material entry. |
| `CELLULAR_MAX_HANDLES` | 64 live cellular field handles. |
| `CELLULAR_MAX_MATERIALS` | 256 field material slots. |
| `CELLULAR_MAX_RULES` | 128 contact reaction rules. |
| `CELLULAR_MESHER_ABI_VERSION` | Mesher ABI version 1. |
| `CELLULAR_NEIGHBORHOOD_CENTER_INDEX` | Index of the center chunk in the 27-chunk neighborhood. |
| `CELLULAR_NEIGHBORHOOD_CHUNK_COUNT` | 27 chunks in the mesher neighborhood. |
| `CELLULAR_RAY_HIT_STRIDE` | 12 Float64 values per ray result. |
| `CELLULAR_RAY_INPUT_STRIDE` | 8 Float64 values per ray input. |
| `CELLULAR_STATS_STRIDE` | 9 Int32 values per field statistics record. |
| `CELLULAR_TEARDOWN_CHUNK_CELLS` | 4096 cells per sparse arena chunk. |
| `CELLULAR_TEARDOWN_CHUNK_DIM` | 16 cells per sparse arena chunk axis. |
| `CELLULAR_TEARDOWN_CHUNK_PAGE_BYTES` | 8192 material and metadata bytes per chunk. |
| `CELLULAR_TEARDOWN_MATERIAL_DESTRUCTIBLE_FLAG` | Material flag 128 permits destruction. |
| `CELLULAR_VERTEX_STRIDE_BYTES` | 16 bytes per packed mesh vertex. |

| Helper | Purpose |
| --- | --- |
| `cellularChunkCellIndex3D()` | Convert local cell coordinates to the field/mesher cell index. |
| `cellularNeighborhoodIndex3D()` | Convert relative chunk coordinates to a 27-chunk neighborhood index. |
| `cellularPaddedHaloIndex3D()` | Convert padded coordinates to an 18³ halo index. |
| `createEmptyCellularSubmeshSlab3D()` | Create an empty opaque or translucent output slab. |
| `ensureCellularMesherReady3D()` | Load the mesher WASM service before meshing. |
| `extractCellularPaddedHalo3D()` | Gather a one-cell halo from a chunk neighborhood. |
| `meshCellularChunkNeighborhood3D()` | Mesh the center chunk using its 27-chunk neighborhood. |
| `meshCellularPaddedHalo3D()` | Mesh an already packed 18³ halo. |
| `packCellularMaterialVisualTable3D()` | Pack color, flags, density, emissive, and tint values for 256 slots. |
| `wrapCellularSubmeshBuffers3D()` | Wrap vertex and index buffers as a typed submesh slab. |

| Supporting types | Contents |
| --- | --- |
| `CellularAabbQuery`, `CellularAabbResolution`, `CellularRayQuery`, `CellularRayHit` | World-space query inputs and hit results. |
| `CellularVec3`, `CellularColorRgba`, `CellularCellWrite`, `CellularBoxEdit`, `CellularCapsuleEdit`, `CellularSphereEdit` | Cell coordinates, world-space edit shapes, material IDs, and metadata. |
| `CellularField3DOptions`, `CellularFieldStats`, `CellularChunkMasks`, `CellularCheckpointToken3D`, `CellularStatusCode` | Field configuration, activity counters, brick masks, retained checkpoint token, and native status codes. |
| `CellularMaterialDefinition`, `CellularMaterialKind`, `CellularMaterialKindValue`, `CellularMaterialFlags`, `CellularReactionRule` | Simulation material properties, six material kinds, collision flags, and pairwise reaction data. |
| `CellularColliderSyncOptions3D`, `CellularColliderSyncResult` | Per-call collider budget, body material, key prefix, and created/replaced/removed counters. |
| `CellularMerkleContributor3D`, `CellularStateCommitmentContributor3D`, `CellularStateCommitmentInput3D` | Native root or folded-lane providers used by deterministic state commitments. |
| `CellularMaterialVisualEntry3D`, `CellularMaterialVisualTableInput3D`, `CellularVisualFlags` | Mesher visual properties and material table input forms. |
| `CellularMesher3D`, `CellularMesherOptions3D`, `CellularMeshStatus`, `CellularMeshStats3D`, `CellularChunkMeshResult3D` | Mesher ownership, configuration, native status, output counters, and opaque/translucent results. |
| `CellularMeshNeighborhoodParams3D`, `CellularMeshPaddedHaloParams3D`, `CellularNeighborhoodEntry3D`, `CellularNeighborhoodInput3D` | Direct WASM page, typed-array neighborhood, and padded halo inputs. |
| `CellularSubmeshSlab3D`, `CellularSlabPoolOptions3D`, `CellularSlabPoolStats3D` | Packed vertex/index storage, size classes, and buffer reuse counters. |
| `CellularMeshWorkerPool3D`, `CellularWorkerPoolOptions3D`, `CellularWorkerHaloJob3D`, `CellularWorkerBatchOptions3D` | Worker pool lifecycle, worker count, halo job data, and batch configuration. |
| `CellularTeardownArena3D`, `CellularTeardownArenaOptions3D`, `CellularArenaStats3D` | Sparse arena operations, cell dimensions, units, allocation counters, and generation counters. |
| `CellularCellBounds3D`, `CellularChunkPageView3D`, `CellularDirtyBrickRegion3D`, `CellularDirtySuperBrick3D` | Inclusive cell bounds, chunk byte views, texture update boxes, and coarse occupancy changes. |
| `CellularDrainDirtyBricksOptions3D`, `CellularDrainDirtyBricksResult3D` | Box size/format limits and the resulting texture regions with upload byte counts. |
| `CellularExtractIslandsOptions3D`, `CellularExtractedIsland3D`, `CellularSpawnIslandsOptions3D`, `CellularTrackedDynamicIsland3D` | Search margin, fragment bounds, anchor rule, extracted cell slabs, and spawned body records. |
| `CellularSettleIslandsOptions3D`, `CellularSettleIslandsResult3D`, `CellularSettledIslandRecord3D`, `CellularIslandBridge3D` | Sleeping-body settlement controls, write counts, removed body records, and the arena/world bridge. |
| `CellularSphereEditOptions3D`, `CellularSphereEditResult3D` | Sparse sphere metadata/destruction options and changed cell bounds. |
| `CellularPinnedGenerationHandle3D`, `CellularPinnedSnapshotWorker3D`, `EncodePinnedSnapshotOptions3D` | Pinned generation lifecycle, worker encoder, baseline pin, and release policy. |
| `ReadonlyVoxelUint8Slab`, `ReadonlyVoxelUint32Slab` | Read-only public typed slabs for occupancy and material IDs. Internal mutable storage is separate. |
| `VoxelBodyCarveOptions3D`, `VoxelBodySplitOptions3D`, `VoxelBodySplitResult3D`, `VoxelDetachedIslandBody3D` | Carve/split configuration, anchor faces, fragment limits, preserved geometry counts, and detached body states. |
