# Syncplay: 2D physics API v1

Import the release-candidate 2D API from
`@series-inc/rundot-syncplay/physics/2d`. Its TypeScript interface uses the
Syncplay C++ core compiled to WASM.

## Public values

| Value | Purpose |
| --- | --- |
| `initPhysics2D()` | Load and initialize the C++ and WASM service. Await it before world creation. |
| `createPhysicsWorld2D(definition)` | Create one owned 2D world after initialization. |

## Public types

| Type | Purpose |
| --- | --- |
| `PhysicsBodyId2D` | Stable logical body ID. Use it to resolve a new handle after restore. |
| `PhysicsJointId2D` | Stable logical joint ID. Use it to resolve a new handle after restore. |
| `PhysicsBodyHandle2D` | Opaque body handle for one world epoch. |
| `PhysicsJointHandle2D` | Opaque joint handle for one world epoch. |
| `PhysicsWorldDefinition2D` | Fixed-step settings and capacity for a world. |
| `PhysicsWorldCapacity2D` | Body and joint capacity limits. |
| `PhysicsBody2D` | Body state returned by `readBody()`. |
| `PhysicsBodyInput2D` | Body input for create and replace operations. |
| `PhysicsJoint2D` | Joint state returned by `readJoint()`. |
| `PhysicsJointInput2D` | Stable joint input for create and replace operations. |
| `PhysicsShape2D` | Stable circle, box, capsule, or polygon shape. |
| `PhysicsEditOps2D` | Operations available inside `edit()`. |
| `PhysicsEditResult2D` | Created handles and removal results from `edit()`. |
| `PhysicsLatestOutputs2D` | Latest contact, joint, and break outputs. |
| `PhysicsCheckpoint2D` | Opaque retained checkpoint handle. |
| `PhysicsRaycastQuery2D` | Raycast input. |
| `PhysicsOverlapQuery2D` | Overlap input. |
| `PhysicsShapeCastQuery2D` | Shape-cast input. |
| `PhysicsClosestPointsQuery2D` | Closest-point input. |
| `PhysicsCastHit2D` | Raycast or shape-cast hit. |
| `PhysicsClosestPointResult2D` | Closest-point result. |
| `PhysicsWorldInfo2D` | Backend, frame, settings, count, and capacity data. |
| `PhysicsWorld2D` | Complete owned-world interface. |
| `PhysicsError2D` | Stable Syncplay physics error type. |

## World lifecycle

<!-- syncplay-example: physics2d-world-lifecycle -->
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
const body = world.edit((edit) => edit.createBody({
  shape: { type: 'circle', radius: 0.5 },
  y: 4,
})).created
world.step()
world.readBody(body)
world.dispose()
```

The world owns its fixed time step. Do not pass a time value to `step()`. Use
metres, kilograms, seconds, and radians.

## Stable shapes

API v1 supports circle, box, capsule, and strict convex counter-clockwise
polygon shapes.

<!-- syncplay-example: physics2d-stable-shapes -->
```typescript
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 4, joints: 0 } })
const bodies = world.edit((edit) => ({
  circle: edit.createBody({ shape: { type: 'circle', radius: 0.25 } }),
  box: edit.createBody({ shape: { type: 'box', halfX: 0.25, halfY: 0.5 }, x: 1 }),
  capsule: edit.createBody({
    shape: { type: 'capsule', halfLength: 0.5, radius: 0.2 }, x: 2,
  }),
  polygon: edit.createBody({
    shape: { type: 'polygon', vertices: [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0, y: 0.5 },
    ] },
    x: 3,
  }),
})).created
world.readBody(bodies.polygon)
world.dispose()
```

## Queries

<!-- syncplay-example: physics2d-queries -->
```typescript
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 2, joints: 0 } })
world.edit((edit) => edit.createBody({
  kind: 'static',
  shape: { type: 'box', halfX: 1, halfY: 1 },
}))
world.raycast({ x: -3, y: 0, dx: 1, dy: 0, maxDistance: 10 })
world.overlap({ x: 0, y: 0, shape: { type: 'circle', radius: 0.2 } })
world.shapeCast({
  x: -3, y: 0,
  shape: { type: 'circle', radius: 0.2 },
  dx: 1, dy: 0,
  maxDistance: 10,
})
world.closestPoints({ x: 3, y: 0 })
world.dispose()
```

## Stable joints

API v1 supports distance, revolute, prismatic, and weld joints.

<!-- syncplay-example: physics2d-stable-joints -->
```typescript
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 2, joints: 4 } })
const joints = world.edit((edit) => {
  const first = edit.createBody({ shape: { type: 'circle', radius: 0.25 } })
  const second = edit.createBody({
    shape: { type: 'box', halfX: 0.25, halfY: 0.25 }, x: 2,
  })
  return {
    distance: edit.createJoint({ type: 'distance', a: first, b: second }),
    revolute: edit.createJoint({ type: 'revolute', a: first, b: second }),
    prismatic: edit.createJoint({ type: 'prismatic', a: first, b: second }),
    weld: edit.createJoint({ type: 'weld', a: first, b: second }),
  }
}).created
world.readJoint(joints.distance)
world.dispose()
```

## Checkpoints

<!-- syncplay-example: physics2d-checkpoint -->
```typescript
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 1, joints: 0 } })
world.edit((edit) => edit.createBody({
  shape: { type: 'circle', radius: 0.5 },
}))
const checkpoint = world.captureCheckpoint()
const digest = world.digest()
world.step()
world.restoreCheckpoint(checkpoint)
if (world.digest() !== digest) throw new Error('Checkpoint mismatch')
world.releaseCheckpoint(checkpoint)
world.dispose()
```

Retained checkpoints stay in WASM. Use `serializeCheckpoint()` only for
portable replay, storage, or late join. Pre-RC checkpoints and replays are not
compatible with API v1.

## World method reference

| Method | Purpose |
| --- | --- |
| `edit()` | Apply one atomic body and joint edit. |
| `step()` | Advance one fixed world tick. |
| `readBody()` | Read body state with a current handle. |
| `readJoint()` | Read joint state with a current handle. |
| `resolveBody()` | Resolve a stable body ID to a current handle. |
| `resolveJoint()` | Resolve a stable joint ID to a current handle. |
| `latest()` | Read the outputs from the latest step. |
| `raycast()` | Return ordered ray hits. |
| `overlap()` | Return ordered IDs for overlapping bodies. |
| `shapeCast()` | Return ordered swept-shape hits. |
| `closestPoints()` | Return ordered closest-point results. |
| `captureCheckpoint()` | Capture complete state in the native checkpoint ring. |
| `restoreCheckpoint()` | Restore a retained checkpoint and return its frame. |
| `serializeCheckpoint()` | Copy one retained checkpoint to portable bytes. |
| `restore()` | Restore portable bytes atomically and return the restored frame. |
| `releaseCheckpoint()` | Release one retained checkpoint. |
| `digest()` | Return the deterministic native-world digest. |
| `info()` | Read backend, frame, settings, counts, and capacities. |
| `dispose()` | Release the world and its native resources. |

## Removed beta scope

API v1 does not expose fluids, deformables, compound colliders, continuous
collision, pulley, gear, wheel, or motor construction. See
[Syncplay: migrate physics to API v1](SYNCPLAY-RC1-MIGRATION.md).
