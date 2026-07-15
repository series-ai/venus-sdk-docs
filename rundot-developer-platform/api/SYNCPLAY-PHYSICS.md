# Syncplay: Physics & Collision (BETA)

Deterministic 2D and 3D physics for Syncplay games — rigid-body integration,
contact events, and spatial queries (raycast, overlap, shape-cast). The 2D lane
uses integer / Q16.16 values. The 3D TGS-Soft rigid-body lane accepts finite JavaScript
numbers and quantizes canonical state at engine boundaries. Both lanes are built,
checksummed, and runtime-certified as part of Syncplay; substituting a third-party
physics engine inside checksummed state breaks that contract.

Import from `@series-inc/rundot-game-sdk/syncplay/browser`. This page builds on the
[Syncplay guide](SYNCPLAY.md) — read the [determinism rules](SYNCPLAY.md#3-determinism-rules-read-this--its-the-whole-game)
first.

***

## The pattern

Physics is a **value in, value out** system, like everything in Syncplay:

```
createDeterministicPhysicsWorld2D(bodies)          → a world (store it in state)
stepDeterministicPhysicsWorld2D(world, options)    → { world, events, checksum } each tick
raycast/overlap/shapeCast(world, query)            → hits, any time you need them
```

The authoritative physics world is immutable — `step` returns the **next** world
plus the contact events that happened this tick. Keep that returned world in your
simulation state so it rolls back with everything else. The render-only cosmetic
layer described below is the exception: it is deliberately not simulation state.

{% hint style="warning" %}
**Store authoritative physics worlds in `state`, step them in your step function.**
An authoritative physics world is part of your game state. Don't keep it in a
module variable — it must roll back with the rest of the simulation, and its
positions must be checksummed. Keep the render-only cosmetic layer out of `state`.
{% endhint %}

***

## 2D physics

### Bodies

A body is a shape with a position, velocity, and collision layer:

```typescript
type DeterministicBodyKind = 'static' | 'dynamic' | 'kinematic'

type DeterministicPhysicsShape2D =
  | { type: 'aabb' }
  | { type: 'circle';  radius: number }
  | { type: 'capsule'; radius: number; halfHeight: number }
  | { type: 'convex';  vertices: { x: number; y: number }[] }

interface DeterministicPhysicsBody2D {
  id: string                       // stable, unique — used for pair keys & ordering
  kind: DeterministicBodyKind      // static | dynamic | kinematic
  x: number; y: number; z?: number // fixed-point position (z optional for layering)
  vx: number; vy: number           // fixed-point velocity
  halfWidth: number; halfHeight: number
  shape?: DeterministicPhysicsShape2D  // defaults to the aabb from halfWidth/halfHeight
  layer: number                    // collision layer bit (masked by queries/contacts)
  // …material, sensor/trigger flags
}
```

| `kind` | Moves? | Pushed by others? | Use for |
|---|---|---|---|
| `static` | no | no | Walls, ground, level geometry. |
| `dynamic` | yes | yes | Projectiles, physics props. |
| `kinematic` | yes (you drive it) | no | Player-driven bodies, moving platforms. |

A `kinematic` body integrates the velocity you give it (`vx/vy/vz`, and
`angularVel` when it has an `orientation`) and is never touched by gravity,
damping, sleep, or any contact impulse. It drives the dynamic bodies it touches —
they pick up its surface velocity through friction and are carried by its motion —
and it absorbs their equal-and-opposite reaction, because its inverse mass is
zero. It also wakes any sleeping body it pushes. Contacts against a kinematic body
are resolved discretely: `ccd` is a **dynamic**-body opt-in, so a kinematic body
driven faster than its own extent per tick can pass through a thin body.

### Stepping

```typescript
import {
  createDeterministicPhysicsWorld2D,
  stepDeterministicPhysicsWorld2D,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

let world = createDeterministicPhysicsWorld2D(bodies)

const result = stepDeterministicPhysicsWorld2D(world, {
  gravityX: 0,
  gravityY: -GRAVITY,   // fixed-point
  iterations: 4,        // solver iterations (default engine value)
  // constraints: [...] // optional joints/limits
})
world = result.world
for (const event of result.events) {
  // event.type: 'enter' | 'stay' | 'exit'; event.a / event.b are body ids
  if (event.type === 'enter') onContact(event.a, event.b, event.sensor)
}
```

`DeterministicPhysicsStepResult2D`:

| Field | Meaning |
|---|---|
| `world` | The next world — reassign it. |
| `events` | Contact events this tick (`enter`/`stay`/`exit`, with `a`/`b` body ids and `sensor`/`trigger` flags). |
| `broadphasePairs` / `narrowphaseContacts` / `solverIterations` | Diagnostics. |
| `checksum` | Deterministic hash of the world — compare across clients for desync detection. |

### Queries

All queries take the world plus a query object and share
`DeterministicPhysicsQueryOptions2D` (`layerMask?`, `includeSensors?`,
`includeTriggers?`), so you can restrict a query to specific layers.

```typescript
import { raycastDeterministicPhysics2D, nearestDeterministicPhysicsHit2D }
  from '@series-inc/rundot-game-sdk/syncplay/browser'

// Ray from (x,y) along (dx,dy) — used for hitscan, line-of-sight, ground checks.
const hits = raycastDeterministicPhysics2D(world, {
  x, y, dx, dy, maxDistance, layerMask: ENEMY_LAYER,
})
// hits: { bodyId, distance }[]  (sorted near→far)
```

| Function | Returns |
|---|---|
| `raycastDeterministicPhysics2D` | All bodies the ray hits (`DeterministicPhysicsHit2D[]`). |
| `raycastAllDeterministicPhysics2D` | Same, unfiltered variant. |
| `nearestDeterministicPhysicsHit2D` | The closest hit, or none. |
| `queryDeterministicPhysicsAabb2D` | Bodies overlapping an AABB region. |
| `queryDeterministicPhysicsShapeOverlap2D` | Bodies overlapping a shape (`aabb` or `circle`) at a point. |
| `circleCastDeterministicPhysics2D` | Swept-circle cast (thick ray). |

***

## 3D physics

3D mirrors 2D with a z axis, rotation/angular velocity, and 3D shapes.

> **Which import path?** The 3D physics API is on the **creator** surface, so an
> H5 game that must pass creator certification imports it from
> `@series-inc/rundot-game-sdk/syncplay/creator` — that subpath carries world
> create/step/edit, impulses, queries, vehicles, and voxel-chunk cooking. The
> `/syncplay/browser` path used in the examples below exports the same symbols
> and stays valid everywhere else. 2D physics and the KCC character controllers
> are **not** on the creator surface.

```typescript
type DeterministicPhysicsShape3D =
  | { type: 'box';     halfX: number; halfY: number; halfZ: number }
  | { type: 'sphere';  radius: number }
  | { type: 'capsule'; radius: number; halfHeight: number }
  | { type: 'hull';    vertices: { x: number; y: number; z: number }[] }  // 4–16 verts, convex
  | { type: 'mesh';    vertices: { x: number; y: number; z: number }[] }  // static or kinematic only
  | { type: 'heightfield'; columns: number; rows: number; scale: { x: number; y: number; z: number }; heights: number[] }
  | { type: 'compound'; children: {                                       // box/sphere/capsule/hull children
      shape: DeterministicPhysicsPrimitiveShape3D | { type: 'hull'; vertices: … }
      offset: { x: number; y: number; z: number }
      quarterTurns?: { x: number; y: number; z: number }
    }[] }

interface DeterministicPhysicsBody3D {
  id: string
  kind: 'static' | 'dynamic' | 'kinematic'
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  orientation?: { x: number; y: number; z: number; w: number }
  angularVel?: { x: number; y: number; z: number }
  rx?: number; ry?: number; rz?: number // legacy rotation in full turns: 0.25 = 90°
  avx?: number; avy?: number; avz?: number
  mass?: number
  linearDamping?: number
  angularDamping?: number
  gravityScale?: number  // multiplies world gravity for this body; default 1 (0 = floaty)
  ccd?: boolean          // opt-in continuous collision (see below); default false
  shape: DeterministicPhysicsShape3D
  layer: number
  mask: number
  material?: DeterministicPhysicsMaterial
}

interface DeterministicPhysicsMaterial {
  friction: number
  restitution: number
  rollingResistance?: number
}
```

### Render-only cosmetic physics

Use the cosmetic layer when a render-side prop should react to gameplay geometry
without becoming gameplay state. Pass cosmetic bodies as `dynamic` and pass
authoritative `static` or `kinematic` bodies as read-only proxies:

```typescript
import {
  createDeterministicCosmeticPhysicsWorld3D,
  setDeterministicCosmeticPhysicsAuthoritativeBodyProxies3D,
  stepDeterministicCosmeticPhysicsWorld3D,
  type DeterministicAuthoritativeBodyProxy3D,
  type DeterministicCosmeticPhysicsBody3D,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

const proxy: DeterministicAuthoritativeBodyProxy3D = {
  ...authoritativePlatform,
  kind: 'kinematic',
}
const cosmetic: DeterministicCosmeticPhysicsBody3D = {
  ...renderCrate,
  kind: 'dynamic',
}

let cosmeticWorld = createDeterministicCosmeticPhysicsWorld3D([cosmetic], [proxy])
const result = stepDeterministicCosmeticPhysicsWorld3D(cosmeticWorld, { gravityY: -9.8 })
cosmeticWorld = result.world

// On the next render update, feed the newest authoritative proxy poses.
cosmeticWorld = setDeterministicCosmeticPhysicsAuthoritativeBodyProxies3D(
  cosmeticWorld,
  [proxy],
)
```

The solver applies contact response to cosmetic dynamic bodies only. It never
mutates a proxy or returns impulses, velocities, or poses for gameplay bodies.
The cosmetic world and its bodies have no checksum and are not part of
Syncplay state, snapshots, replays, or network messages. Keep this world in a
render-side store and feed it authoritative proxy values from the gameplay
projection; do not put it in the object passed to `defineSyncplayGame`.

**Continuous collision (`ccd`, opt-in).** A fast body can move far enough in one
tick to pass through a thin wall or another body before the discrete solver ever
sees the contact. Set `ccd: true` to enable **time-of-impact continuous collision**
(the box3d model): on any tick where the body's motion exceeds half its smallest
extent, its exact first **time-of-impact** against the bodies in its path is found by
GJK conservative advancement. The body is advanced to that contact and the impact is
resolved as a perfectly-inelastic collision, so **momentum is transferred to the
struck body** (a fast projectile imparts force and can knock a target loose — it does
not stop dead), and its position is clamped so it never tunnels. Stable even at
extreme speed (tens of body-widths per tick).

CCD sweeps dynamic box, sphere, capsule, hull, and heightfield targets. Triangle
`mesh` and `compound` targets remain discrete-only.

The sweep is **linear**: a straight-line cast (no rotational/spin TOI) that treats
other bodies as stationary within the tick, so two bodies both moving fast toward
each other are only approximate. A **glancing** body that its exact swept shape never
actually touches is *not* stopped — it slides past. It is strictly **opt-in**: a body
**without** `ccd: true` uses only discrete collision and **can still tunnel** at high
speed. CCD is deterministic and rollback-safe like the rest of the solver.

**Convex hulls.** A `hull` shape is 4–16 convex vertices (validated at world
creation: non-finite, degenerate/coplanar, or interior — non-hull — vertices
throw). A hull may be used on its own or as a `compound` child, which is how a
concave collider is expressed. Hulls collide against boxes, spheres, capsules,
other hulls, and meshes, and participate in every query (raycast/overlap/
shape-cast). Hulls use their solid tetrahedral mass properties. Compound bodies
distribute mass by child volume, combine child tensors with the parallel-axis
theorem, and rotate around their true center of mass rather than the authored
origin.

`compound.children[].quarterTurns` is an integer count of 90° turns (`1` is
90°). Collision, bounds, queries, and inertia use the same convention; a
fractional value throws at world creation. This differs from the legacy body
`rx`/`ry`/`rz` fields, which are authored in full turns (`0.25` is 90°). Prefer a
normalized `orientation` quaternion for full 6-DOF dynamic bodies.

The body's authored `x`/`y`/`z` remains the shape origin. Hull and compound mass
properties compute a separate local center of mass: integration and rotation
happen around that center, then the authored origin is reconstructed for output.
Compound mass is distributed by child volume; there is no per-child density or
mass override. Applying an impulse at the world-space COM therefore produces no
spurious angular velocity.

**Mesh colliders.** A `mesh` is a one-sided triangle soup: contacts are generated
only against the front face of each triangle, and a body that has fully passed
through the surface is not recaptured. A mesh body must be `static` or
`kinematic` — a **dynamic** mesh throws at world creation. Boxes, hulls, spheres,
and capsules all rest on and are pushed by a mesh. **Mesh-vs-mesh contact does not
exist** and never will: two meshes never generate a manifold. For a concave body
that must be dynamic, cook it into a compound of convex hulls (below).

**Height fields.** A `heightfield` is static, axis-aligned terrain with
`columns × rows` row-major heights (`heights[row * columns + column]`). `scale.x`
and `scale.z` set cell spacing and `scale.y` scales height. Each cell becomes two
one-sided, up-facing triangles. Translation is supported; dynamic ownership or a
non-identity rotation throws. Raycast, overlap, shape cast, discrete collision,
and fast-body `ccd` all use the same surface. Unlike `heightfield`, triangle-soup
`mesh` targets are not swept by CCD.

The grid vertex at column `c`, row `r` is
`(c * scale.x, heights[r * columns + c] * scale.y, r * scale.z)`, translated by
the body's `x`/`y`/`z`. `columns` and `rows` must each be at least 2;
`heights.length` must equal `columns * rows`; every height must be finite; and all
three scale components must be positive finite numbers.

```typescript
import {
  createDeterministicPhysicsWorld3D,
  raycastDeterministicPhysics3D,
  shapeCastDeterministicPhysics3D,
  type DeterministicPhysicsBody3D,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

const terrain: DeterministicPhysicsBody3D = {
  id: 'terrain',
  kind: 'static',
  x: 0, y: 0, z: 0,
  vx: 0, vy: 0, vz: 0,
  shape: {
    type: 'heightfield',
    columns: 4,
    rows: 3,
    scale: { x: 2, y: 1, z: 2 },
    heights: [
      0, 0, 1, 1, // row 0 (z = 0)
      0, 1, 2, 2, // row 1 (z = 2)
      0, 1, 2, 3, // row 2 (z = 4)
    ],
  },
  material: { friction: 8, restitution: 0 },
  layer: 1,
  mask: 0xffff,
}

const world = createDeterministicPhysicsWorld3D([terrain])
const groundHits = raycastDeterministicPhysics3D(world, {
  x: 3, y: 10, z: 2,
  dx: 0, dy: -1, dz: 0,
  maxDistance: 20,
  layerMask: 1,
})
const landingHits = shapeCastDeterministicPhysics3D(world, {
  x: 3, y: 10, z: 2,
  dx: 0, dy: -1, dz: 0,
  maxDistance: 20,
  shape: { type: 'sphere', radius: 0.5 },
  layerMask: 1,
})
```

3D material values use the engine's 0–10 authoring scale. Contact friction mixes
by geometric mean, so friction `2` against `8` produces a solver coefficient of
`sqrt(0.2 * 0.8) = 0.4`. Restitution and rolling resistance combine by maximum.
`rollingResistance` is an optional integer from 0–10; it opposes tangent-plane
relative angular velocity so wheels and spheres spin down without damping
normal-axis twist. Set `angularDamping: 1` when rolling resistance should be the
only source of angular decay.

```typescript
const rollingBall: DeterministicPhysicsBody3D = {
  id: 'ball',
  kind: 'dynamic',
  x: 0, y: 1, z: 0,
  vx: 1, vy: 0, vz: 0,
  mass: 1,
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  angularVel: { x: 0, y: 0, z: -2 },
  angularDamping: 1,
  shape: { type: 'sphere', radius: 0.5 },
  material: { friction: 0, restitution: 0, rollingResistance: 3 },
  layer: 1,
  mask: 1,
}
```

**Convex decomposition (offline).** A concave triangle soup becomes a compound of
convex hulls through the build-time cooker, never at runtime:

```bash
npm run collider:validate -- prop.mesh.json                        # prove it cooks
npm run collider:cook -- prop.mesh.json --out prop.collider.json \
  --resolution 24 --max-hulls 8
```

`prop.collider.json` carries a `shape` you can hand straight to
`createDeterministicPhysicsWorld3D`. The cook voxelizes the mesh, splits it on the
axis-aligned plane that best reduces concavity until every part is convex enough
(or the hull budget is spent), and emits ≤16-vertex hulls that the runtime's own
validator accepts. It is byte-reproducible and invariant to the order of the
source triangles, so it can run in CI. The result is **conservative**: each hull
contains the geometry it stands for, inflated by up to one voxel of the chosen
`--resolution`. Raise the resolution for a tighter fit, raise `--max-hulls` for a
closer approximation of a deeply concave shape. No decomposition code runs inside
a simulation step.

```typescript
import {
  createDeterministicPhysicsWorld3D,
  stepDeterministicPhysicsWorld3D,
  raycastDeterministicPhysics3D,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

let world = createDeterministicPhysicsWorld3D(bodies)
const result = stepDeterministicPhysicsWorld3D(world, { gravityY: -GRAVITY })
world = result.world

const hits = raycastDeterministicPhysics3D(world, { x, y, z, dx, dy, dz, maxDistance })
```

The rigid solver is a **sub-stepped soft-constraint (TGS-Soft) solver**. Two step
options tune it: `substeps` (default 4 — the plan/engine tunes this higher for
demanding stacks) splits each tick into N soft sub-steps for stability, and
`velocityIterations` (default is small) is the per-substep constraint-iteration
count. Defaults are well-tuned; box-tower, pyramid, mass-ratio, and kick-recovery
stability are gated in CI, so most games never touch these. Raise `substeps` only
for unusually tall stacks or high mass ratios.

3D queries and their detailed variants (which also return contact `point`,
`normal`, and `penetration`):

| Function | Returns |
|---|---|
| `raycastDeterministicPhysics3D` / `…Detailed` | Ray hits (detailed adds point/normal/penetration). |
| `overlapDeterministicPhysics3D` | Bodies overlapping a shape at a position. |
| `shapeCastDeterministicPhysics3D` / `…Detailed` | Swept-shape cast. |
| `contactDetailsDeterministicPhysics3D` | Full contact manifold between two bodies. |

The 3D step result additionally carries **scheduled query results** — you can
attach raycasts/overlaps to run at a fixed `pre-physics` or `post-physics` phase
each tick (`DeterministicPhysicsScheduledQuery3D`), which keeps query timing
deterministic relative to integration.

Callback masks let a body opt into specific contact callbacks via
`deterministicPhysicsCallback3D` (`collisionEnter`, `triggerEnter`, …) combined as
a bitmask.

### 3D joints

Joints are passed per step via `options.joints` (an array on the step options),
each identified by a stable `id`. Accumulated joint impulses warm-start through
the checksummed joint cache, so joints are rollback-safe. A joint with an
optional `breakImpulse` breaks when its per-step reaction impulse exceeds the
threshold: it stops constraining, the break is sticky (recorded in the joint
cache so rollback replays it), and the newly broken ids surface in
`result.brokenJointIds`. A two-body joint with `disableCollision: true`
suppresses contact response for its own body pair while intact (collision
resumes the step after a break).

| Joint | Constrains | Extras |
|---|---|---|
| `ball` | anchors coincide | cone-twist limits, angular motor (`motorVelocity` + `maxMotorTorque`), orientation spring (`springTarget` + `springHertz` + `springDamping`), `breakImpulse`, `disableCollision` |
| `hinge` | anchors + rotation to `axisA` | `minAngle`/`maxAngle`, motor (`motorSpeed`+`maxMotorTorque`), `breakImpulse`, `disableCollision` |
| `weld` | anchors + all rotation | `breakImpulse`, `disableCollision` |
| `distance` | anchor distance in `[minLength, maxLength]` | `breakImpulse`, `disableCollision` |
| `prismatic` | slide along `axisA` only | `minTranslation`/`maxTranslation`, motor (`motorSpeed`+`maxMotorForce`), `breakImpulse`, `disableCollision` |
| `spring` | anchor distance toward `restLength` (soft) | `frequencyHz`, `dampingRatio`, `breakImpulse`, `disableCollision` |
| `grab` | anchor toward world target | `maxForce`, `damping` |

The `ball` joint becomes a **cone-twist** (ragdoll) joint when limits are given:
`axisA`/`axisB` are the twist axes in each body's local frame, `coneLimitTurns`
(0 < t ≤ 0.5) caps the swing half-angle, and `twistMinTurns`/`twistMaxTurns`
(each in [−0.5, 0.5]) bound the twist about the axis.

A `ball` joint can also drive all three angular axes. `motorVelocity` targets
`B.angularVel - A.angularVel` in world axes, in radians per tick, and is
torque-limited by `maxMotorTorque`. A missing, zero, or negative torque applies no
motor impulse. `springTarget` is the normalized target relative orientation
`qB * inverse(qA)`. Provide it together with positive `springHertz` and
non-negative `springDamping`; all three spring fields are required together.
`springDamping` is a damping ratio (`0` undamped, `1` critically damped, values
above `1` overdamped). Motor and spring may be enabled on the same joint.

```typescript
import {
  stepDeterministicPhysicsWorld3D,
  type DeterministicPhysicsJoint3D,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

const shoulder: DeterministicPhysicsJoint3D = {
  id: 'shoulder',
  type: 'ball',
  a: 'torso',
  b: 'upper-arm',
  anchorA: { x: 0.6, y: 0.8, z: 0 }, // local to torso
  anchorB: { x: 0, y: -0.5, z: 0 },  // local to upper-arm
  motorVelocity: { x: 0, y: 0.25, z: 0 },
  maxMotorTorque: 5,
  springTarget: { x: 0, y: 0.70710678, z: 0, w: 0.70710678 },
  springHertz: 4,
  springDamping: 1,
}

world = stepDeterministicPhysicsWorld3D(world, {
  gravityY: -0.02,
  joints: [shoulder],
}).world
```

`breakImpulse` compares against the joint's per-step **reaction impulse** (summed
across sub-steps; motor and limit impulses excluded; for a hanging mass this is ≈
`mass·|gravityY|·dt`). Only the `grab` joint (a force-limited world-target motor)
supports neither `breakImpulse` nor `disableCollision`.

### 3D vehicles

`stepDeterministicVehicle3D` is a stateless **raycast-wheel** controller: a
vehicle is one dynamic chassis body plus N suspension raycasts (wheels are rays,
not bodies). Each tick you read the chassis pose from the world, call the
controller with the driver input, apply the returned impulses, then step physics.

```typescript
import {
  stepDeterministicVehicle3D,
  type DeterministicVehicle3D,
  type DeterministicVehicleInput3D,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

const drive = stepDeterministicVehicle3D(vehicle, input, world, { dtTicks: 1 })
world = applyDeterministicImpulses3D(world, drive.impulses.map((i) => ({
  bodyId: i.bodyId, impulse: i.impulse, worldPoint: i.point,
})))
world = stepDeterministicPhysicsWorld3D(world, { gravityY: -GRAVITY }).world
// drive.wheels[] carries per-wheel telemetry (grounded, compression, contact id…)
```

Each wheel is a spring-damper suspension ray plus a friction-circle tire.
Suspension travel and tire slip are measured **relative to the contacted ground
body's surface velocity** (`v + ω×r`), so moving platforms drag the car; every
chassis impulse against a **dynamic** ground body emits an equal-and-opposite
reaction on it (a car on a floating raft pushes the raft back). Static and
kinematic ground absorb the reaction.

**Rigid-wheel recipe.** For actual rolling wheels, skip the raycast controller:
attach four `sphere` wheel bodies to the chassis with `hinge` joints
(`disableCollision: true`), drive them with the hinge motor
(`motorSpeed` + `maxMotorTorque`), and steer by rotating the front hinges' `axisA`
per tick. Gotcha: set the wheels' `angularDamping: 1` — the default (0.98) bleeds
wheel spin and the car crawls. `runDeterministicRigidWheelVehicle3DFixture` is the
reference implementation.

***

## Editing world topology (fracture, spawning, despawning)

`applyDeterministicWorldEdit3D` adds, removes, and replaces bodies **in place**.
Recreating the world instead would reset `frame` and throw away every warm-start
cache, so a destructible game must use this.

```typescript
import {
  applyDeterministicWorldEdit3D,
  cookDeterministicVoxelChunkCollider3D,
} from '@series-inc/rundot-game-sdk/syncplay/creator'

// A wall takes a hit: destroy it and spawn the two halves it broke into.
world = applyDeterministicWorldEdit3D(world, {
  remove: ['wall-07'],
  add: [
    { ...debris('wall-07a'), shape: cookDeterministicVoxelChunkCollider3D(lowerHalf) },
    { ...debris('wall-07b'), shape: cookDeterministicVoxelChunkCollider3D(upperHalf) },
  ],
})
```

| Field | Effect |
|---|---|
| `add` | New bodies. Ids must not already exist. |
| `remove` | Delete by id. Drops the body's active pairs and warm-start contacts. |
| `replace` | Swap a body (e.g. a new collider after damage). **Keeps** its active pairs so contact events stay continuous; drops only its warm-start contacts. |
| `removeJointIds` | Joints are step options the caller owns, so the world can't infer which `jointCache` entries an edit invalidated — name them. |

What the operation guarantees:

- **`frame` is preserved** — an edit is not a step.
- Bodies outside the contact island of an edited body keep their **object
  identity and sleep state**, and every warm-start contact-cache entry that
  doesn't touch an edited body survives by reference.
- The **contact island** of every removed/replaced body wakes (same semantics as
  applying an impulse), and added/replaced **dynamic** bodies always enter awake
  even if authored `sleeping: true` — a fragment spread from a sleeping parent
  must not sleep through its own fracture.
- The result is **independent of the ordering** of entries within each list, so
  two clients that discover the same fracture in a different order agree.
- Malformed edits throw: an unknown id, a duplicate id, the same id in two roles,
  or a body id containing `|` (the reserved pair-key delimiter).

## Voxel chunk colliders

The compound narrowphase is quadratic in a body's child count, so authoring one
box child per voxel gets expensive fast. Always cook instead:
`cookDeterministicVoxelChunkCollider3D` greedy-merges an occupancy grid into the
fewest axis-aligned boxes that cover it.

```typescript
import {
  cookDeterministicVoxelChunkCollider3D,
  type DeterministicVoxelChunk3D,
} from '@series-inc/rundot-game-sdk/syncplay/creator'

const chunk: DeterministicVoxelChunk3D = {
  dimX: 4, dimY: 4, dimZ: 4,
  cellSize: 0.25,
  occupancy,          // row-major: occupancy[x + dimX * (y + dimY * z)], 0 or 1
}
const shape = cookDeterministicVoxelChunkCollider3D(chunk)   // a 'compound' of merged boxes
```

Voxel `(x, y, z)` centers at `(x·cellSize, y·cellSize, z·cellSize)` in body-local
space. A solid n³ chunk cooks to exactly **one** box child; children never carry
`quarterTurns`. Cooking is a pure function of the grid, so both clients cook the
same collider. An empty or malformed grid throws.

**Budget it.** Narrowphase cost scales with the *square* of the children per
chunk, so the carve pattern matters as much as the voxel count: a solid chunk
merges to 1 child and is nearly free, while a fragmenting carve (scattered
single-voxel holes) can leave ~18 children in a 4³ chunk and stay expensive.
Measured on a desktop at 30 Hz, piles of interacting chunks on a floor:

| Simultaneously interacting chunks | Children per chunk | p50 frame | p95 frame |
|---|---|---|---|
| 64 | 18 (fragmenting carve) | 8.4 ms | 12.0 ms |
| 64 | 9 | 4.3 ms | 6.5 ms |
| 64 | 3 (blocky carve) | 3.2 ms | 4.6 ms |
| 32 | 18 | 3.1 ms | 4.8 ms |

An 8 ms desktop budget holds for roughly 32 dense chunks in contact at once, or
for 64 if your debris merges to a handful of boxes — but *not* for 64 chunks that
each shatter into ~18 pieces. Keep chunks blocky, keep the number **in contact at
the same time** down (settled debris sleeps and stops costing), and benchmark
your real content with `npm run lab:physics3d-destruction` before committing to a
chunk size.

## Measuring physics cost

`runDeterministicPhysics3DStress` reports two different things, and confusing
them is easy:

| Fields | What they are |
|---|---|
| `p95StepCost` / `p99StepCost` | A **synthetic deterministic score** (broadphase pairs, contacts, solver corrections). Identical on every machine, so it is safe inside a checksummed sim and in cross-runtime proofs. Not milliseconds. |
| `p95StepMs` / `p99StepMs` | **Real wall clock.** Present *only* when you inject a clock (`{ now: () => performance.now() }`), and `measuredStepFrames` says how many frames were timed. Unavailable inside runtime-guarded certified game code, which forbids reading a clock. |

For a dense destruction benchmark (fracture + re-cook inside the timed frame,
snapshot/restore and reversed-authoring-order equality checks), run
`npm run lab:physics3d-destruction -- --json report.json`. Add
`--enforce-thresholds --p95-budget-ms 8` to turn the wall-clock budget into a
gate. The gate is opt-in and manual — wall-clock budgets are hardware-dependent,
so no CI lane runs it.

***

## Collision primitives

For lightweight games that don't need a full world, the fixed-point collision
helpers are enough — the [Fixed Arena example](SYNCPLAY.md#1-define-your-game)
uses only these:

```typescript
import { fixedVec2, fixedCircle, circleIntersects, aabbIntersects }
  from '@series-inc/rundot-game-sdk/syncplay/browser'

const a = fixedCircle(fixedVec2(x1, y1), r1)
const b = fixedCircle(fixedVec2(x2, y2), r2)
if (circleIntersects(a, b)) resolveHit()
```

| Function | Purpose |
|---|---|
| `fixedVec2`, `fixedAabb`, `fixedCircle` | Construct fixed-point shapes. |
| `aabbIntersects`, `circleIntersects`, `circleIntersectsAabb` | Overlap tests. |
| `aabbContainsPoint` | Point-in-box test. |
| `translateAabb` | Move an AABB by a delta. |
| `sortAabbsByStableId` | Deterministically order AABBs before pairwise checks. |

***

## Putting it together

```typescript
function stepPhysics(state: State): State {
  // 1. rebuild kinematic bodies from player intent (fixed-point)
  const world = applyPlayerVelocities(state.physics, state.inputs)

  // 2. step
  const result = stepDeterministicPhysicsWorld2D(world, { gravityY: -GRAVITY })

  // 3. react to contacts (your rules)
  let scores = state.scores
  for (const e of result.events) {
    if (e.type === 'enter') scores = applyHit(scores, e.a, e.b)
  }

  return { ...state, physics: result.world, scores }
}
```

***

## Determinism notes

- **Never** substitute a float physics engine (Rapier, Box2D) for the checksummed
  world — floats differ across browsers and desync. If you must use Rapier for
  *visuals*, keep it out of `state` and out of any checksum. (Syncplay's
  certification explicitly gates `rapier2d-compat` out of checksummed gameplay.)
- Body `id`s must be **stable and unique** — pair keys and contact ordering derive
  from them. Reusing an id across frames for a different body corrupts contacts.
- The 2D lane's fixed-point fields use integers / Q16.16; convert those with
  `ctx.math.toFixed` / `ctx.math.fromFixed`. The 3D rigid-body lane uses finite
  JavaScript numbers in world units and radians-per-tick angular velocity, then
  quantizes canonical state internally. Do not pass 3D body values through the
  Q16.16 conversion helpers.
- Store the world in simulation `state`; compare `result.checksum` across clients
  (via the [desync report](SYNCPLAY.md#7-go-multiplayer)) to catch divergence early.

***

## See also

- [Syncplay guide](SYNCPLAY.md) · [built-in systems overview](SYNCPLAY.md#4-built-in-systems-all-deterministic)
- [Movement (KCC)](SYNCPLAY-MOVEMENT.md) — character controllers built on this physics.
- [Lag compensation](SYNCPLAY-LAG-COMPENSATION.md) — rewind hitboxes for fair hitscan.
