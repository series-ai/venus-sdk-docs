# Syncplay: Pathfinding (BETA)

Deterministic pathfinding — stable A\*, flow fields, and crowd avoidance whose
output is byte-identical on every client. Two flavors:

- **Navigation graphs** — grid / tilemap worlds. Nodes and edges; great for
  tile-based levels. `cookTilemapNavigationGraph` builds a **4-connected** grid.
- **Navmeshes** — polygon meshes. Free-form 2.5D/3D worlds; corridor paths with
  off-mesh links (jumps, teleports, ladders).

Both follow the Syncplay **cook-once, query-per-need** shape and are exported from
`@series-inc/rundot-syncplay/browser`. Builds on the
[Syncplay guide](SYNCPLAY.md).

{% hint style="info" %}
This is **not** the [Navigation API](NAVIGATION.md) — that page is about navigating
between games in the app. This is in-simulation pathfinding for a Syncplay game.
{% endhint %}

***

## The pattern

```
cook a graph/navmesh   (once, at build or match start — from level data)
find a path            (when a goal changes)     → an ordered list of node/polygon ids
step agents            (per tick)                → agents advanced along their corridors
```

Cooked graphs and navmeshes carry a `bytes` string and a `hash`. Paths return a
`pathHash` for replay verification.

***

## Units and timestep

| Value | Type | Rule |
|---|---|---|
| Node, polygon and region ids | `string` | Stable and unique. Cooking throws on a duplicate. |
| Node `x` / `y` | `number` | Ordinary numbers. `cookTilemapNavigationGraph` writes the cell indices. |
| Node and edge `cost` | `number` | Default 1. Added per traversal. |
| Path `cost` | `number` | Sum of `edge.cost + node.cost` along the path. |
| Agent `x` / `y` / `z` | `number` | Ordinary numbers, quantized by the navmesh. Not fixed-point. |
| Agent `speedPerFrame` | `number` | **Non-negative integer**, world units per frame. Default 1000. |
| `updateIntervalFrames` | `number` | Frames between agent position updates. Navmesh agents only. Default 1. |
| `frame` | `number` | A tick index, passed in an options object. |

{% hint style="danger" %}
**Agent positions and `speedPerFrame` are not fixed-point.** `speedPerFrame` must
be a **non-negative integer in world units per frame**. `0.5` throws
(`Navmesh agent b has invalid speedPerFrame`), but a `fixedScale`-scaled value is
still a valid integer, so it is accepted and teleports the agent.

Measured: an agent at `x: 0` with `speedPerFrame: 32768` crossed a whole polygon in
one call and landed on the next polygon's centroid, with no error and no warning.
`fixedScale` defaults to `1000`, so a default-scaled speed teleports too.

Use a small integer, such as `1`. This is the same trap as
[Movement](SYNCPLAY-MOVEMENT.md#units-and-timestep-read-this-first).
{% endhint %}

**No function on this page takes a timestep.** Agent steppers advance exactly one
frame per call and take a **frame index** inside an options object. The RC physics
APIs use one fixed timestep for each world:

| API | Step call | Meaning |
|---|---|---|
| 3D physics | `PhysicsWorld3D.step()` | Advances one fixed tick. Set `tickRate` when you create the world. |
| 2D physics | `PhysicsWorld2D.step()` | Advances one fixed tick. Set `tickRate` when you create the world. |

Full rules:
[3D physics units](SYNCPLAY-PHYSICS.md#create-and-dispose-a-world).

***

## Navigation graphs (grid / tilemap)

### Cook

From a tilemap:

<!-- syncplay-example: pathfinding-cook-tilemap -->
```typescript
import { cookTilemapNavigationGraph, findDeterministicPath } from '@series-inc/rundot-syncplay/browser'

const graph = cookTilemapNavigationGraph({
  id: 'level-1',
  width: 32, height: 32,
  blocked: ['12,4', '12,5'],          // impassable cells
  costs: { '10,10': 3 },              // per-cell movement cost (default 1)
  portals: { '0,0': '31,31' },        // teleport links
})
```

{% hint style="warning" %}
**`cookTilemapNavigationGraph` builds a 4-connected grid.** It links each cell to
its `-x` and `-y` neighbours only, both directions. There are **no diagonal
edges**. A cooked 8x8 grid gives node `1,1` exactly four neighbours: `0,1`, `1,0`,
`1,2` and `2,1`.

Two consequences surprise readers:

- Every path is a staircase of orthogonal moves. A path from `0,0` to `5,3` costs 16
  and runs `0,0 0,1 0,2 0,3 1,3 2,3 3,3 4,3 5,3`.
- `smoothDeterministicPath` cannot straighten that into a diagonal. It only removes
  **collinear** interior nodes, and it can only pick nodes that are already on the
  path. The example above smooths to `0,0 0,3 5,3` — the corner stays. This is
  correct behaviour, not a bug.

For diagonal movement, cook an explicit graph with
`cookDeterministicNavigationGraph` and add the diagonal edges yourself, or use a
[navmesh](#navmeshes-polygon).
{% endhint %}

Or cook from an explicit node/edge graph with
`cookDeterministicNavigationGraph(source)` (a `DeterministicNavigationGraphSource`
of `nodes`, `edges`, optional `regions`). Cooking **sorts** nodes, edges and
regions and rejects duplicate ids, so the graph is canonical.

```typescript
interface CookedDeterministicNavigationGraph {
  id: string
  nodes: DeterministicNavNode[]
  edges: DeterministicNavEdge[]
  regions: DeterministicNavRegion[]  // toggleable groups of nodes
  bytes: string; hash: string        // canonical JSON + identity
}
```

### `bytes` is a hash input, not a save format

`bytes` is a canonical JSON string produced by `canonicalStringify`. The package
exports **no deserializer**: there is no `parseDeterministicNavigationGraph`, and
no navmesh equivalent. You cannot bake a cooked graph at build time and load it
back.

Re-cooking a cooked graph does not round-trip either. Cooking expands every
`bidirectional` edge into a reverse copy and keeps the flag on the forward edge, so
feeding `graph.edges` back into `cookDeterministicNavigationGraph` expands them a
second time. Measured on an empty 8x8 grid: 224 edges in, 336 edges out, and a
different `hash`.

Do this instead:

```typescript
// Ship the SOURCE, not the cooked graph. Cooking the same source is deterministic.
const source = { id: 'level-1', width: 32, height: 32, blocked: [...] }
const graph = cookTilemapNavigationGraph(source)

// Verify every peer cooked the same thing.
if (graph.hash !== expectedHashFromLevelData) {
  throw new Error('navigation graph drift')
}
```

### Find a path

```typescript
const path = findDeterministicPath(graph, {
  start: '0,0',
  goal: '31,31',
  disabledRegionIds: ['locked-wing'],  // regions currently closed
  blockedNodeIds: ['3,3'],             // dynamic obstacles (a player, a hazard)
})

interface DeterministicPathResult {
  found: boolean
  nodes: string[]           // the ordered path
  cost: number
  visitedNodeCount: number  // search work (diagnostics)
  offMeshTraversals: number
  pathHash: string          // deterministic identity of this path
}
```

Because `disabledRegionIds` / `blockedNodeIds` are per-query, doors and hazards that
open and close mid-match re-path identically on every client.

{% hint style="warning" %}
**`found: false` also means "I do not know that id".** `findDeterministicPath` does
not throw on an unknown `start` or `goal`. It returns the same empty result as a
genuinely unreachable goal, with the same `pathHash`. A typo in an id therefore
looks exactly like a blocked corridor, and your AI silently stops moving.

```typescript
// unknown start   → { found: false, nodes: [], cost: 0, visitedNodeCount: 0,  … }
// truly unreachable → { found: false, nodes: [], cost: 0, visitedNodeCount: 6, … }
```

`visitedNodeCount` is not a safe discriminator, because a blocked start also
reports `0`. Check membership first:

```typescript
const nodeIds = new Set(graph.nodes.map((node) => node.id))
if (!nodeIds.has(start) || !nodeIds.has(goal)) {
  throw new Error(`unknown navigation node: ${start} → ${goal}`)
}
const path = findDeterministicPath(graph, { start, goal })
```

`findDeterministicNavmeshPath` behaves the same way for an unknown polygon id.
Build the id set once when you cook, and keep it beside the graph.
{% endhint %}

### Flow fields — build offline only

A **flow field** gives the next hop from every node toward one goal:

```typescript
import { createDeterministicFlowField } from '@series-inc/rundot-syncplay/browser'

const field = createDeterministicFlowField(graph, /* goal */ '31,31')
// field.nextByNodeId['10,10'] → the next node toward the goal
```

{% hint style="danger" %}
**Never call `createDeterministicFlowField` during a match.** It is not an
optimization for many agents. It runs a **full A\* search from every node in the
graph** — one complete search per node — and then keeps only the second node of
each result. Cost grows faster than the square of the node count.

Measured on Node 24, on an empty grid, goal in the far corner:

| Grid | Nodes | `createDeterministicFlowField` | 64 agents, one `findDeterministicPath` each |
|---|---|---|---|
| 16x16 | 256 | ~55 ms | ~16 ms |
| 32x32 | 1024 | **~1120 ms** | ~72 ms |
| 64x64 | 4096 | **~32000 ms** | ~500 ms |

At 32x32 — the size cooked in the example above — one flow field costs over a
second. That is roughly 68 frames at 60 Hz, on the simulation thread, on every
peer. Four times the nodes costs about 29 times the time.

**Per-agent `findDeterministicPath` on a re-plan cadence is cheaper for any
realistic agent count.** At 32x32 a single path costs about 1.1 ms, so a flow field
only breaks even at roughly a thousand simultaneous re-plans in one frame.

**A moving goal rules the flow field out entirely.** The field is built for one
goal id. If the goal moves to a new node, the whole field is stale and you must pay
the full cost again.

Use it only where the goal never moves and you can pay the cost off the simulation
thread: a build step, a level-load screen, or a match-start warm-up. Then treat the
result as read-only static data.
{% endhint %}

### Crowds

| Function | Purpose |
|---|---|
| `smoothDeterministicPath` | Remove **collinear** interior nodes from a grid path. It cannot add diagonals. |
| `applyDeterministicReciprocalAvoidance` | RVO-style avoidance between agents (deterministic ordering). |
| `stepDeterministicNavigationAgents` | Advance a set of `DeterministicNavigationAgent`s along the graph each tick. |

`stepDeterministicNavigationAgents(graph, agents, options)` takes an options object
third, and returns a result object:

```typescript
const result = stepDeterministicNavigationAgents(graph, agents, {
  frame,                                // required
  disabledRegionIds: ['locked-wing'],
  blockedNodeIds: ['3,3'],
})
agents = result.agents
// result also carries replans, avoidanceCorrections, offMeshTraversals,
// visitedNodeCount, reciprocalAvoidanceCorrections and agentChecksum.
```

Its re-plan cadence is fixed at every 31st frame, plus any frame on which the
agent's cached path no longer ends at its target. It is not configurable.

***

## Navmeshes (polygon)

### Cook

A navmesh is polygons + links. Links can be **off-mesh** (jumps, ladders,
teleports) and one- or two-directional:

<!-- syncplay-example: pathfinding-cook-navmesh -->
```typescript
import { cookDeterministicNavmesh, findDeterministicNavmeshPath } from '@series-inc/rundot-syncplay/browser'

// Every id in `links` must name a polygon in `polygons`. Cooking throws
// `Navmesh link <from>-><to> references a missing polygon` otherwise.
const navmesh = cookDeterministicNavmesh({
  id: 'arena',
  polygons: [
    { id: 'p0', vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], region: 'ground' },
    { id: 'p1', vertices: [{ x: 4, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 4 }, { x: 4, y: 4 }], region: 'ground' },
    { id: 'p2', vertices: [{ x: 8, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 4 }, { x: 8, y: 4 }], region: 'ground' },
    { id: 'p3', vertices: [{ x: 0, y: 8 }, { x: 4, y: 8 }, { x: 4, y: 12 }, { x: 0, y: 12 }], region: 'ground' },
  ],
  links: [
    { from: 'p0', to: 'p3', offMesh: true, bidirectional: false, cost: 2 }, // a jump
  ],
  regions: [{ id: 'ground', enabled: true }],
})
```

(`cookImportedDeterministicNavmesh` accepts an imported/authored mesh format.)

### Find a route

```typescript
const route = findDeterministicNavmeshPath(navmesh, {
  start: 'p0',                     // start polygon id
  goal: 'p3',                      // goal polygon id
  disabledRegions: ['lava'],
  blockedPolygons: ['p2'],
})

interface DeterministicNavmeshPath {
  found: boolean
  polygons: string[]                    // corridor of polygon ids
  points: DeterministicNavmeshPoint[]   // waypoints ({x, y, z?})
  offMeshTraversals: number             // jumps/teleports taken
  visitedPolygons: number
  pathHash: string
  startPolygonId?; goalPolygonId?: string
}
```

| Function | Purpose |
|---|---|
| `findDeterministicNavmeshPath` | Polygon-to-polygon corridor + waypoints. |
| `findDeterministicNavmeshPointPath` | Path between raw world points (locates polygons for you). |
| `locateDeterministicNavmeshPolygon` | Which polygon contains a point. |
| `smoothDeterministicNavmeshPath` | String-pull a corridor into a smooth path. |
| `stepDeterministicNavmeshOffMeshTraversal` | Advance an agent through an off-mesh link (jump/teleport) over several ticks. |

### Agents & crowds

`stepDeterministicNavmeshAgents` advances a whole crowd along their corridors each
tick with deterministic avoidance ordering.

```
stepDeterministicNavmeshAgents(navmesh, agents, options) → DeterministicNavmeshAgentStepResult
```

The third parameter is an **options object**, and the return value is a **result
object**, not the agents array:

```typescript
import { stepDeterministicNavmeshAgents } from '@series-inc/rundot-syncplay/browser'

let agents = [
  { id: 'a1', polygonId: 'p0', targetPolygonId: 'p2', x: 2, y: 2, speedPerFrame: 1, updateIntervalFrames: 4 },
]

for (let frame = 0; frame < 6; frame += 1) {
  const result = stepDeterministicNavmeshAgents(navmesh, agents, {
    frame,                                    // NOTE: inside the options object
    disabledRegions: ['lava'],
    movingObstaclePolygons: ['p4'],
  })
  agents = result.agents                      // result.replans, result.checksum also available
}
```

{% hint style="danger" %}
**Passing a bare number as the third argument is silently ignored.** The old form
`stepDeterministicNavmeshAgents(navmesh, agents, frame)` does not throw. A number
has no `frame` property, so the step reads `options.frame ?? 0` and uses frame `0`
on every tick.

That switches off the `updateIntervalFrames` throttle, because the gate is
`frame % updateInterval !== 0` and `0 % n` is always `0`. The agent then advances
on **every** tick instead of the cadence you asked for. Measured on the example
above, with `updateIntervalFrames: 4`:

| Frame | `{ frame }` — correct | bare `frame` — silently wrong |
|---|---|---|
| 0 | `x = 3` | `x = 3` |
| 1 | `x = 3` | `x = 4` |
| 2 | `x = 3` | `x = 5` |
| 3 | `x = 3` | `x = 6` |
| 4 | `x = 4` | `x = 7` |
| 5 | `x = 4` | `x = 8` |

Nothing warns you. The crowd just runs at four times the intended speed and the
`checksum` diverges from a peer that passed the options object.
{% endhint %}

An agent carries its target and movement params:

```typescript
interface DeterministicNavmeshAgent {
  id: string
  polygonId: string              // current polygon
  targetPolygonId: string        // goal polygon
  x?; y?; z?: number             // ordinary numbers, quantized by the mesh. NOT fixed-point
  speedPerFrame?: number         // non-negative INTEGER, world units per frame. Default 1000
  updateIntervalFrames?: number  // frames between position updates. Default 1
  stoppingDistance?: number
  corridor?: string[]            // cached corridor
  corridorIndex?: number
  avoidancePriority?: number     // higher wins a contested polygon
  radius?: number
}
```

`updateIntervalFrames` gates the agent's **position update**, not re-planning. The
step re-plans when the next polygon in the corridor is missing or blocked, and
reports the count in `result.replans`.

The result object carries `agents`, `replans`, `avoidanceCorrections`,
`dynamicRegionToggles`, `obstacleCount`, `waypointAdvances`, the four
avoidance counters, and a `checksum`.

***

## Putting it together

```typescript
function stepEnemies(state: State): State {
  const enemies = state.enemies.map((e) => {
    // Re-path only when the goal changed. Paths are the expensive part.
    // Never build a flow field here — see the warning above.
    const path = e.goal === e.lastGoal
      ? e.path
      : findDeterministicNavmeshPath(state.navmesh, { start: e.polygonId, goal: e.goal })
    // `found: false` means unreachable OR unknown id. Check the id set first.
    return advanceAlong(e, path)   // your integer movement along path.points
  })
  return { ...state, enemies }
}
```

***

## Randomness, sampling & procedural noise — `ctx.random` and `noise`, never `Math.*`

AI and procedural generation lean on randomness and noise, and both are gated:
`Math.random` and the `Math.sin`-based value-hash trick are **cross-engine desync
bugs**, not shortcuts. Use the deterministic, seeded surfaces instead.

- **Sampling** on `ctx.random` (seed it deterministically, e.g. via
  `ctx.random.fork(entityId)`): `pickOne(items)` (throws on empty),
  `weighted(items, weights)` for weighted choice, `nextBool()`, `nextInt(min,
  max)`, `nextRangeFixed(min, max)` for a fixed value in a range,
  `nextAngleTurns(fixedScale)` for a random heading, `gaussian(ctx.math)` for
  spread/jitter. Same seed → identical sequence on every client.
- **Procedural noise** — imported pure functions (seed parameter, not on `ctx`):
  `hashUint32(x)` / `hash2(x, y)` for stable per-cell hashes (**use these for
  spread/scatter, never `Math.sin(id*…)`**), `valueNoise1D`/`valueNoise2D(ctx.math,
  x, y, seed)` for smooth fields, and `fbm2D` for multi-octave terrain-style noise.

<!-- syncplay-example: pathfinding-noise-imports -->
```ts
import { fbm2D, hash2, hashUint32, valueNoise1D, valueNoise2D } from '@series-inc/rundot-syncplay/browser'
```

## Geometry for steering & line-of-sight — imported segment ops

Ray/segment queries (LOS, "does this path cross that wall", nearest point on an
edge) come from the package's segment geometry, all pure-integer:
`orientation`, `pointOnSegment`, `segmentsIntersect`, `closestPointOnSegment`,
`segmentPointDistance`, `segmentSegmentDistance` (the distance/closest ops take
`ctx.math` for their `sqrt`). Don't hand-roll these — the certified versions
match across engines.

<!-- syncplay-example: pathfinding-segment-imports -->
```ts
import { closestPointOnSegment, orientation, pointOnSegment, segmentPointDistance, segmentSegmentDistance, segmentsIntersect } from '@series-inc/rundot-syncplay/browser'
```

## Determinism notes

- Cook from **shared level data**, not client-local input. Cooking the same source
  twice gives the same `hash`, so compare hashes to prove every client agrees.
- Ship the **source**, never the cooked graph. There is no deserializer, and
  re-cooking a cooked graph duplicates its bidirectional edges.
- Node / polygon / region ids must be **stable and unique** (cooking throws on
  duplicates). Paths are ordered lists of these ids.
- Pass dynamic obstacles as `blockedNodeIds` / `blockedPolygons` and closed areas as
  `disabledRegionIds` / `disabledRegions` **per query** — never mutate the cooked
  graph mid-match.
- Agent positions are ordinary numbers and `speedPerFrame` is a **non-negative
  integer** in world units per frame. Neither is fixed-point. A scaled value is
  accepted and teleports the agent.
- Pass `frame` inside the **options object**. A bare number is ignored, disables the
  `updateIntervalFrames` throttle, and diverges the `checksum`.
- Keep `updateIntervalFrames` above 1 to bound per-tick cost. The result is still
  deterministic.
- **Never build a flow field during a match.** It runs one full A\* per node.

***

## See also

- [Movement (KCC)](SYNCPLAY-MOVEMENT.md) — move agents along the paths you find.
- [Bots & AI](SYNCPLAY-BOTS.md) — decide *where* to path.
- [Syncplay guide](SYNCPLAY.md) · [built-in systems overview](SYNCPLAY.md#4-built-in-systems-all-deterministic)
