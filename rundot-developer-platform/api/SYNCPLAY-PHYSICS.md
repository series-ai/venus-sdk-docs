# Syncplay: Physics & Collision (BETA)

Fixed-point 2D and 3D physics for Syncplay games — rigid-body integration, contact
events, and spatial queries (raycast, overlap, shape-cast). Everything is computed
in integer / Q16.16 fixed-point so the result is **bit-identical on every client**;
a float-based physics engine (Rapier, Cannon, Box2D) cannot be checksummed and will
desync, which is why these are built in.

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

The world is immutable — `step` returns the **next** world plus the contact events
that happened this tick. Keep the returned world in your simulation state so it
rolls back with everything else.

{% hint style="warning" %}
**Store the world in `state`, step it in your step function.** The physics world is
part of your game state. Don't keep it in a module variable — it must roll back with
the rest of the simulation, and its positions must be checksummed.
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

```typescript
type DeterministicPhysicsShape3D =
  | { type: 'box';     halfX: number; halfY: number; halfZ: number }
  | { type: 'sphere';  radius: number }
  | { type: 'capsule'; radius: number; halfHeight: number }
  | { type: 'hull';    vertices: { x: number; y: number; z: number }[] }  // 4–16 verts, convex
  | { type: 'mesh';    vertices: { x: number; y: number; z: number }[] }  // static or kinematic only
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
  rx?; ry?; rz?          // fixed-point rotation
  avx?; avy?; avz?       // angular velocity
  gravityScale?: number  // multiplies world gravity for this body; default 1 (0 = floaty)
  ccd?: boolean          // opt-in continuous collision (see below); default false
  // …shape, layer, material
}
```

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
shape-cast). Rotational inertia uses the vertex AABB approximation (same treatment
as compound bodies).

**Mesh colliders.** A `mesh` is a one-sided triangle soup: contacts are generated
only against the front face of each triangle, and a body that has fully passed
through the surface is not recaptured. A mesh body must be `static` or
`kinematic` — a **dynamic** mesh throws at world creation. Boxes, hulls, spheres,
and capsules all rest on and are pushed by a mesh. **Mesh-vs-mesh contact does not
exist** and never will: two meshes never generate a manifold. For a concave body
that must be dynamic, cook it into a compound of convex hulls (below).

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
| `ball` | anchors coincide | cone-twist (`axisA`/`axisB` + `coneLimitTurns` + `twistMinTurns`/`twistMaxTurns`), `breakImpulse`, `disableCollision` |
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
- All positions, velocities, gravity, and shape dimensions are **fixed-point**
  (integers / Q16.16). Convert to float only for rendering, via `ctx.math.fromFixed`.
- Store the world in simulation `state`; compare `result.checksum` across clients
  (via the [desync report](SYNCPLAY.md#7-go-multiplayer)) to catch divergence early.

***

## See also

- [Syncplay guide](SYNCPLAY.md) · [built-in systems overview](SYNCPLAY.md#4-built-in-systems-all-deterministic)
- [Movement (KCC)](SYNCPLAY-MOVEMENT.md) — character controllers built on this physics.
- [Lag compensation](SYNCPLAY-LAG-COMPENSATION.md) — rewind hitboxes for fair hitscan.
