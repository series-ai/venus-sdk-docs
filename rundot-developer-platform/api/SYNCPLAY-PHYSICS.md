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
  | { type: 'mesh';    vertices: { x: number; y: number; z: number }[] }

interface DeterministicPhysicsBody3D {
  id: string
  kind: 'static' | 'dynamic' | 'kinematic'
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  rx?; ry?; rz?          // fixed-point rotation
  avx?; avy?; avz?       // angular velocity
  // …shape, layer, material
}
```

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
