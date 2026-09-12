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

## Public types

| Type | Purpose |
| --- | --- |
| `PhysicsBodyId3D` | Stable logical body ID. Use it to resolve a new handle after restore. |
| `PhysicsJointId3D` | Stable logical joint ID. Use it to resolve a new handle after restore. |
| `PhysicsBodyHandle3D` | Opaque body handle for one world epoch. |
| `PhysicsJointHandle3D` | Opaque joint handle for one world epoch. |
| `PhysicsVector3D` | Three-component vector in API units. |
| `PhysicsWorldDefinition3D` | Fixed-step settings and capacity for a world. |
| `PhysicsWorldCapacity3D` | Body and joint capacity limits. |
| `PhysicsBody3D` | Body state returned by `readBody()`. |
| `PhysicsBodyInput3D` | Body input for create and replace operations. |
| `PhysicsJoint3D` | Joint state returned by `readJoint()`. |
| `PhysicsJointInput3D` | Stable joint input for create and replace operations. |
| `PhysicsShape3D` | Stable sphere, box, or capsule shape. |
| `PhysicsEditOps3D` | Operations available inside `edit()`. |
| `PhysicsEditResult3D` | Created handles and removal results from `edit()`. |
| `PhysicsLatestOutputs3D` | Frame and latest contact events. |
| `PhysicsCheckpoint3D` | Opaque retained checkpoint handle. |
| `PhysicsRaycastQuery3D` | Raycast input. |
| `PhysicsOverlapQuery3D` | Overlap input. |
| `PhysicsShapeCastQuery3D` | Shape-cast input. |
| `PhysicsClosestPointsQuery3D` | Closest-point input. |
| `PhysicsCastHit3D` | Raycast, overlap, or shape-cast hit. |
| `PhysicsClosestPointResult3D` | Closest-point result. |
| `PhysicsContactEvent3D` | Enter, stay, or exit contact event. |
| `PhysicsWorldInfo3D` | Backend, frame, settings, count, and capacity data. |
| `PhysicsWorld3D` | Complete owned-world interface. |
| `PhysicsError3D` | Stable Syncplay physics error type. |

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
30, and 60. The stable shapes are sphere, box, and capsule.

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

API v1 supports distance, point, revolute, prismatic, and weld joints.

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

A Samsung Galaxy S9+ with Android 8.0 produced 2D p99 values of 4.9083,
20.7167, and 41.3333 ms at 100, 500, and 1,000 bodies. The 3D values were
9.2333, 39.1750, and 88.0250 ms. These values characterize one old device.
They do not define an RC support limit. iOS performance is not measured. Do not
estimate other device results from the Android or desktop results.

Measure your final game workload. Include step, digest, checkpoint capture,
rollback restore, projection reads, and portable serialization when it occurs.

## Errors and capacities

Declare body and joint capacities when you create a world. Capacity overflow is
atomic. Invalid queries, checkpoints, and handles fail loudly. Restore makes
old handles stale. Resolve a new handle from the stable logical ID after
restore.

Call `latest()` after `step()` to read contact events. Call `info()` to read the
backend identity, fixed time step, counts, and capacities. The backend value is
`cpp-wasm`.

## World method reference

| Method | Purpose |
| --- | --- |
| `edit()` | Apply one atomic body and joint edit. |
| `step()` | Advance one fixed world tick. |
| `applyImpulse()` | Apply a linear impulse at the center or at a world point. |
| `readBody()` | Read body state with a current handle. |
| `readJoint()` | Read joint state with a current handle. |
| `resolveBody()` | Resolve a stable body ID to a current handle. |
| `resolveJoint()` | Resolve a stable joint ID to a current handle. |
| `latest()` | Read contact events from the latest step. |
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

## API v1 scope

API v1 does not expose convex hull, mesh, terrain, compound, vehicle,
character, articulation, destruction, advanced joint, or advanced continuous
collision construction APIs. Keep a game on its pinned beta if it needs a
removed beta feature.
