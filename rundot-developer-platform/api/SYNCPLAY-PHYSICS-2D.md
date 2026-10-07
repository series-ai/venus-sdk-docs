# Syncplay: 2D physics API v1

Import the release-candidate 2D API from
`@series-inc/rundot-syncplay/physics/2d`. Its TypeScript interface uses the
Syncplay C++ core compiled to WASM.

## Public values

| Value | Purpose |
| --- | --- |
| `initPhysics2D()` | Load and initialize the C++ and WASM service. Await it before world creation. |
| `createPhysicsWorld2D(definition)` | Create one owned 2D world after initialization. |
| `collidePhysics2D(a, b)` | Calculate the exact native manifold for two bodies. |
| `computeTimeOfImpact2D(a, b, options)` | Calculate the native time of impact for two moving bodies. |
| `calculatePhysics2DSubmergedGeometry(...)` | Calculate exact submerged area and centroid. |
| `calculatePhysics2DSubmergedGeometryBatch(...)` | Calculate submerged geometry for many bodies. |
| `decodeContactFeatureId2D(...)`, `mirrorContactFeatureId2D(...)` | Read or reverse a stable contact feature pair. |
| `particleFluidAbi` | Read the particle-fluid ABI and capacity constants. |
| `normalizeParticleFluidConfig(...)`, `normalizeParticleFluidState(...)` | Validate and copy particle-fluid values. |
| `initFluidParticleGrid2D(...)`, `emitFluidParticle2D(...)` | Create or add to deterministic particle-fluid state. |
| `stepFluidParticles2D(...)` | Advance deterministic particle-fluid state. |
| `sampleFluidMedium2D(...)`, `queryFluidMedium2D(...)` | Sample density and flow at a point. |
| `compound2D` | Build compound authoring data, bounds, and mass properties. It does not create an owned compound body. |

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
| `PhysicsShape2D` | Stable circle, box, capsule, polygon, segment, chain, contour, or arc shape. |
| `PhysicsArcQuadrant2D` | Quadrant identifier for quarter-circle circular arc edges (`'ne'`, `'nw'`, `'sw'`, or `'se'`). |
| `PhysicsContourEdge2D` | Line or quadrant-arc contour edge definition. |
| `PhysicsContourLoop2D` | Open or closed contour loop composed of line and arc edges. |
| `PhysicsEditOps2D` | Operations available inside `edit()`. |
| `PhysicsEditResult2D` | Created handles and removal results from `edit()`. |
| `PhysicsLatestOutputs2D` | Latest contact, joint, reaction, and break outputs. |
| `PhysicsContactEvent2D` | Sorted enter, stay, or exit pair event. |
| `PhysicsCollisionManifold2D` | Exact pair normal, depth, points, separation, and feature IDs. |
| `PhysicsContactFeature2D`, `PhysicsContactFeaturePair2D`, `PhysicsContactPoint2D` | Stable manifold feature and point records. |
| `PhysicsFeatureApi2D` | Type of the `compound2D` feature namespace. |
| `PhysicsTimeOfImpactResult2D` | Hit state, time, normal, point, separation, and iteration count. |
| `PhysicsTimeOfImpactOptions2D` | Direct moving-pair CCD options. |
| `PhysicsFluid2D`, `PhysicsFluidInput2D`, `PhysicsFluidId2D`, `PhysicsFluidHandle2D` | Bounded owned fluid region values and identities. |
| `PhysicsFluidParticle2D`, `PhysicsParticleFluidConfig2D`, `PhysicsParticleFluidState2D` | Deterministic particle-fluid values. |
| `PhysicsSubmergedBody2D`, `PhysicsSubmergedFluid2D`, `PhysicsSubmergedGeometry2D` | Exact submerged-geometry inputs and result. |
| `PhysicsCheckpoint2D` | Opaque retained checkpoint handle. |
| `PhysicsRaycastQuery2D` | Raycast input. |
| `PhysicsOverlapQuery2D` | Overlap input. |
| `PhysicsOverlapContact2D`, `PhysicsOverlapContactPoint2D` | Overlap contact records and manifold points. |
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
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({
  tickRate: 30,
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(-9.8) },
  capacity: { bodies: 16, joints: 4 },
})
const body = world.edit((edit) => edit.createBody({
  shape: { type: 'circle', radius: syncplayUnits.meters(0.5) },
  y: syncplayUnits.meters(4),
})).created
world.step()
world.readBody(body)
world.dispose()
```

The world owns its fixed time step. Do not pass a time value to `step()`. Use
metres, kilograms, seconds, and radians.

## Stable shapes

API v1 supports circle, box, capsule, strict convex counter-clockwise polygon,
segment, chain, contour, and arc shapes. A segment can include adjacent ghost points. A chain
can be open or closed. The native solver keeps one-sided edge behavior.

<!-- syncplay-example: physics2d-stable-shapes -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 8, joints: 0, contourEdges: 16 } })
const bodies = world.edit((edit) => ({
  circle: edit.createBody({ shape: { type: 'circle', radius: syncplayUnits.meters(0.25) } }),
  box: edit.createBody({ shape: { type: 'box', halfX: syncplayUnits.meters(0.25), halfY: syncplayUnits.meters(0.5) }, x: syncplayUnits.meters(1) }),
  capsule: edit.createBody({
    shape: { type: 'capsule', halfLength: syncplayUnits.meters(0.5), radius: syncplayUnits.meters(0.2) }, x: syncplayUnits.meters(2),
  }),
  polygon: edit.createBody({
    shape: { type: 'polygon', vertices: [
      { x: syncplayUnits.meters(-0.5), y: syncplayUnits.meters(-0.5) },
      { x: syncplayUnits.meters(0.5), y: syncplayUnits.meters(-0.5) },
      { x: syncplayUnits.meters(0), y: syncplayUnits.meters(0.5) },
    ] },
    x: syncplayUnits.meters(3),
  }),
  segment: edit.createBody({
    kind: 'static',
    shape: { type: 'segment', point1: { x: syncplayUnits.meters(-1), y: syncplayUnits.meters(0) }, point2: { x: syncplayUnits.meters(1), y: syncplayUnits.meters(0) } },
    x: syncplayUnits.meters(4),
  }),
  chain: edit.createBody({
    kind: 'static',
    shape: { type: 'chain', vertices: [
      { x: syncplayUnits.meters(-1), y: syncplayUnits.meters(0) }, { x: syncplayUnits.meters(0), y: syncplayUnits.meters(1) }, { x: syncplayUnits.meters(1), y: syncplayUnits.meters(0) },
    ] },
    x: syncplayUnits.meters(5),
  }),
  contour: edit.createBody({
    kind: 'static',
    shape: {
      type: 'contour',
      loops: [{
        start: { x: syncplayUnits.meters(0), y: syncplayUnits.meters(0) },
        edges: [
          { kind: 'line', to: { x: syncplayUnits.meters(5), y: syncplayUnits.meters(0) } },
          { kind: 'arc', center: { x: syncplayUnits.meters(5), y: syncplayUnits.meters(5) }, radius: syncplayUnits.meters(5), quadrant: 'se', convex: true },
        ],
      }],
      fill: 'boundary',
    },
    x: syncplayUnits.meters(6),
  }),
  arc: edit.createBody({
    kind: 'static',
    shape: {
      type: 'arc',
      center: { x: syncplayUnits.meters(0), y: syncplayUnits.meters(0) },
      radius: syncplayUnits.meters(2),
      quadrant: 'ne',
      convex: true,
    },
    x: syncplayUnits.meters(12),
  }),
})).created
world.readBody(bodies.contour)
world.dispose()
```


### Contour terrain and quadrant arcs

Studio terrain authored in Forge or generated by runtime platformer tools uses
structured piecewise contours and circular arcs rather than disjoint segments:

- `contour`: An authored shape composed of one or more open or closed loops of
  connected edges. Each edge is either a straight line (`{ kind: line, to: { x, y } }`)
  or a circular arc (`{ kind: arc, center: { x, y }, radius, quadrant, convex }`).
  Quadrants are specified as `ne`, `nw`, `sw`, or `se`.
- `arc`: A standalone quarter-circle arc shape convenience shorthand defined by
  `{ type: arc, center, radius, quadrant, convex }`, normalized into a single-arc contour.
- Fill mode:
  - `boundary`: Thin chain-like terrain boundary.
  - `solid`: Solid ground with an interior; dynamic bodies penetrating the interior are recovered outward toward the surface.

### The free-side rule

Contour boundaries follow the strict free-side convention:
- For boundary loops, collision contact normals and surface raycast hits engage only
  when approaching or penetrating from the free (outward) side of the edge.
- Approaching from behind the boundary produces zero collision impulse and is ignored
  by queries, preventing snagging on internal geometry and enabling seamless multi-loop
  slopes, caves, and overhangs.

### Deterministic query tie-order contract

All 2D queries (`raycast`, `shapeCast`, `closestPoints`, `overlap`, and `overlapContacts`)
strictly obey the deterministic tie-order contract:
- Hits at distinct distances are ordered strictly by distance value ascending (`first.distance < second.distance`).
  Distances differing by even a single ULP (unit in the last place) are ordered numerically without epsilon collapse.
- When distances tie bit-for-bit, or for unranked queries (`overlap`, `overlapContacts`),
  results are ordered deterministically by `bodyId` ascending, followed by `featureId` ascending.
- Result ordering is completely independent of body creation order, pointer layout, and allocator state.

## Queries

### Filters in the unpublished restoration candidate

The restoration candidate adds body `layer`, `mask`, `trigger`, and `sensor`
fields. Published `6.0.0-rc.2` does not implement these fields. Use the verified
restoration build for this example. Do not update a game to the published
candidate when it needs these features.

`layer` and `mask` are unsigned 32-bit integers. Both default to 1.
Solid response requires each body's mask to include the other body's layer.
`trigger` and `sensor` are Boolean values. Both default to false.
Either flag prevents solid impulse and position correction for the pair.
Readback and checkpoints retain these fields. `latest().contacts` reports
sorted enter, stay, and exit events with the pair material and trigger or
sensor state.

The unpublished candidate also retains a Boolean `ccd` setting. It defaults
to false. Creation, replacement, readback, and checkpoints retain it.
Invalid values fail before an edit changes state. The native world uses the
shared continuous-collision clock for enabled dynamic bodies. Use
`computeTimeOfImpact2D` when game code needs the direct pair result.

Query filters add `layerMask`, `hitSolids`, `includeSensors`, and
`includeTriggers`. `layerMask` is an unsigned 32-bit integer. It defaults to
`0xffffffff`. The native query requires a nonzero intersection with the body's
layer. It does not use the body's response mask. `hitSolids` defaults to true.
`includeSensors` and `includeTriggers` default to false. All three require
Boolean values. A body with both flags requires both inclusion flags.
Filtering occurs before the result limit. These fields combine with
`bodyKinds` and `excludeBodyIds`. Query ABI is 2. The filter record is 16 bytes.
Query hit IDs and `excludeBodyIds` use persistent numeric body IDs.

<!-- syncplay-example: physics2d-restoration-filters -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 2, joints: 0 },
})
const filtered = world.edit((edit) => {
  edit.createBody({ kind: 'static', shape: { type: 'circle', radius: syncplayUnits.meters(1) } })
  return edit.createBody({
    shape: { type: 'circle', radius: syncplayUnits.meters(1) }, x: syncplayUnits.meters(1), mask: 0, sensor: true,
  })
}).created
world.step()
const state = world.readBody(filtered)
if (state.x !== 1 || state.mask !== 0 || !state.sensor) {
  throw new Error('2D filter state or non-response failed')
}
const query = { x: syncplayUnits.meters(1), y: syncplayUnits.meters(0), shape: { type: 'circle' as const, radius: syncplayUnits.meters(0.5) } }
if (world.overlap(query).includes(filtered.id)) {
  throw new Error('A default query included a sensor')
}
const sensorHits = world.overlap({ ...query,
  filter: { hitSolids: false, includeSensors: true }, maxResults: 1 })
if (sensorHits.length !== 1 || sensorHits[0] !== filtered.id) {
  throw new Error('Sensor filtering did not occur before the result limit')
}
world.dispose()
```

<!-- syncplay-example: physics2d-queries -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 2, joints: 0 } })
world.edit((edit) => edit.createBody({
  kind: 'static',
  shape: { type: 'box', halfX: syncplayUnits.meters(1), halfY: syncplayUnits.meters(1) },
}))
world.raycast({ x: syncplayUnits.meters(-3), y: syncplayUnits.meters(0), dx: 1, dy: 0, maxDistance: syncplayUnits.meters(10) })
world.overlap({ x: syncplayUnits.meters(0), y: syncplayUnits.meters(0), shape: { type: 'circle', radius: syncplayUnits.meters(0.2) } })
world.shapeCast({
  x: syncplayUnits.meters(-3), y: syncplayUnits.meters(0),
  shape: { type: 'circle', radius: syncplayUnits.meters(0.2) },
  dx: 1, dy: 0,
  maxDistance: syncplayUnits.meters(10),
})
world.closestPoints({ x: syncplayUnits.meters(3), y: syncplayUnits.meters(0) })
world.dispose()
```

## Stable joints

API v1 supports distance, revolute, prismatic, weld, wheel, motor, mouse,
rope, pulley, and gear joints.

<!-- syncplay-example: physics2d-stable-joints -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 2, joints: 4 } })
const joints = world.edit((edit) => {
  const first = edit.createBody({ shape: { type: 'circle', radius: syncplayUnits.meters(0.25) } })
  const second = edit.createBody({
    shape: { type: 'box', halfX: syncplayUnits.meters(0.25), halfY: syncplayUnits.meters(0.25) }, x: syncplayUnits.meters(2),
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

### Advanced joint inputs

The restoration candidate supports wheel, motor, mouse, rope, pulley, and gear
joints through `edit()`. Published `6.0.0-rc.2` does not expose them.
These joints use the existing C++ solver. Both checkpoint routes retain their
definitions, warm impulses, coordinates, and latest reactions.

| Joint | Required input |
| --- | --- |
| `wheel` | Body or world endpoints. Optional suspension spring and angular velocity drive. Use `maxTorque` for the drive. |
| `motor` | Endpoints, `target`, `correctionFactor`, `maxForce`, and `maxTorque`. The correction factor must be in [0, 1]. |
| `mouse` | World endpoint `a`, body endpoint `b`, and `maxForce`. The spring is optional. |
| `rope` | Endpoints and `maxLength`. The row releases when the rope becomes slack. |
| `pulley` | Two body endpoints, ground points, positive `ratio` and `totalLength`, and `mode`. Use `fixedLength` or `maxLength`. |
| `gear` | Two distinct revolute or prismatic joint references, nonzero `ratio`, `ratioUnit`, and `phase`. |

For gear sources of the same type, use `dimensionless`. For a revolute source
`a` and prismatic source `b`, use `worldUnitsPerRadian`. For the reverse order,
use `radiansPerWorldUnit`. A gear break limit requires `breakSource` to select
the source and endpoint. Pulley joints accept `breakForce`, not `breakTorque`.
Unknown fields and invalid values fail the complete edit without changing state.
Telemetry and break events use numeric persistent joint IDs. Resolve an ID to
a current joint handle before you read the joint. A checkpoint restore makes
old handles invalid. A broken joint emits one break event, not one per tick.

<!-- syncplay-example: physics2d-restored-joints -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({
  initialGravity: { x: syncplayUnits.metersPerSecondSquared(0), y: syncplayUnits.metersPerSecondSquared(0) },
  capacity: { bodies: 2, joints: 3 },
})
const gear = world.edit((edit) => {
  const wheel = edit.createBody({ shape: { type: 'circle', radius: syncplayUnits.meters(0.2) }, mask: 0 })
  const rack = edit.createBody({ shape: { type: 'box', halfX: syncplayUnits.meters(0.2), halfY: syncplayUnits.meters(0.2) }, x: syncplayUnits.meters(2), mask: 0 })
  const sourceA = edit.createJoint({
    type: 'revolute', a: { kind: 'world', x: syncplayUnits.meters(0), y: syncplayUnits.meters(0) }, b: wheel,
    drive: { mode: 'velocity', speed: syncplayUnits.radiansPerSecond(2), maxTorque: syncplayUnits.newtonMeters(3) },
  })
  const sourceB = edit.createJoint({
    type: 'prismatic', a: { kind: 'world', x: syncplayUnits.meters(2), y: syncplayUnits.meters(0) }, b: rack,
  })
  return edit.createJoint({
    type: 'gear', sourceA, sourceB, ratio: syncplayUnits.metersPerRadian(2),
    ratioUnit: 'worldUnitsPerRadian', phase: syncplayUnits.meters(0),
  })
}).created
world.step()
if (world.readJoint(gear).type !== 'gear' || world.latest().gearReactions.length !== 1) {
  throw new Error('The native gear or its endpoint reactions are missing')
}
world.dispose()
```

## Checkpoints

<!-- syncplay-example: physics2d-checkpoint -->
```typescript
import * as syncplayUnits from '@series-inc/rundot-syncplay/physics/2d';
import {
  createPhysicsWorld2D,
  initPhysics2D,
} from '@series-inc/rundot-syncplay/physics/2d'

await initPhysics2D()
const world = createPhysicsWorld2D({ capacity: { bodies: 1, joints: 0 } })
world.edit((edit) => edit.createBody({
  shape: { type: 'circle', radius: syncplayUnits.meters(0.5) },
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

RC.19 uses native storage ABI 7. RC.18 checkpoints use ABI 6. RC.19 rejects
those checkpoint bytes without changing the destination world. Keep existing
sessions and their history on the original build until those sessions end.

## World method reference

| Method | Purpose |
| --- | --- |
| `edit()` | Apply one atomic body and joint edit. |
| `step()` | Advance one fixed world tick. |
| `readBody()` | Read body state with a current handle. |
| `readJoint()` | Read joint state with a current handle. |
| `readFluid()` | Read a bounded fluid region with a current handle. |
| `resolveBody()` | Resolve a stable body ID to a current handle. |
| `resolveJoint()` | Resolve a stable joint ID to a current handle. |
| `resolveFluid()` | Resolve a stable fluid ID to a current handle. |
| `latest()` | Read the outputs from the latest step. |
| `raycast()` | Return ordered ray hits. |
| `overlap()` | Return ordered IDs for overlapping bodies. |
| `overlapContacts()` | Return ordered manifold contacts for overlapping bodies. |
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

## Restoration status

The candidate restores the published beta 2D body shapes, joints, filters,
triggers, sensors, pair events, pair manifolds, time-of-impact queries, body
CCD, bounded fluids, particle fluids, submerged geometry, and compound
authoring tools. Owned compound bodies are not part of this API. Keep a game
on its verified beta until its migration checks pass. See
[Syncplay: migrate physics to API v1](SYNCPLAY-RC1-MIGRATION.md).


## Measurement units and constructors

The 2D physics API provides SI measurement types and constructors:
- `CubicMeters`
- `Dimensionless`
- `FrameGravity`
- `FrameVelocity`
- `Hertz`
- `KilogramMetersSquared`
- `Kilograms`
- `KilogramsPerCubicMeter`
- `KilogramsPerSquareMeter`
- `Meters`
- `MetersPerRadian`
- `MetersPerSecond`
- `MetersPerSecondSquared`
- `NewtonMeterSeconds`
- `NewtonMeterSecondsPerRadian`
- `NewtonMeters`
- `NewtonSeconds`
- `NewtonSecondsPerMeter`
- `Newtons`
- `NewtonsPerMeter`
- `PerSecond`
- `PerSecondSquared`
- `PhysicsVertex2D`
- `Quantity`
- `Radians`
- `RadiansPerMeter`
- `RadiansPerSecond`
- `Seconds`
- `SquareMeters`
- `SquareMetersPerSecondSquared`
- `Turns`
- `TurnsPerSecond`
- `UnitVector2`
- `cubicMeters`
- `frameGravity`
- `frameVelocity`
- `gravityToFrame`
- `gravityToSeconds`
- `hertz`
- `kilogramMetersSquared`
- `kilograms`
- `kilogramsPerCubicMeter`
- `kilogramsPerSquareMeter`
- `meters`
- `metersPerRadian`
- `metersPerSecond`
- `metersPerSecondSquared`
- `newtonMeterSeconds`
- `newtonMeterSecondsPerRadian`
- `newtonMeters`
- `newtonSeconds`
- `newtonSecondsPerMeter`
- `newtons`
- `newtonsPerMeter`
- `perSecond`
- `perSecondSquared`
- `radiansPerMeter`
- `radiansPerSecond`
- `seconds`
- `squareMeters`
- `squareMetersPerSecondSquared`
- `turns`
- `turnsPerSecond`
- `velocityToFrame`
- `velocityToSeconds`
