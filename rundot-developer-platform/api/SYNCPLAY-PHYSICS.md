# Syncplay: Physics & Collision

Authoritative physics in a Syncplay session is executed directly inside the game
runtime adapter's `step` callback (`createInstalledRuntimeAdapter({ createState, step })`).
The deterministic 3D physics solver exported from `@series-inc/rundot-syncplay`
(and `@series-inc/rundot-syncplay/creator` / `/browser`) is the primary, first-class,
supported path for authoritative game physics, dynamic destruction, voxel carving,
and character controllers.

```typescript
import {
  createDeterministicPhysicsWorld3D,
  stepDeterministicPhysicsWorld3D,
  type DeterministicPhysicsWorld3D,
} from '@series-inc/rundot-syncplay/creator';
import { createInstalledRuntimeAdapter } from '@series-inc/rundot-syncplay/core/runtime';

interface GameState {
  physics: DeterministicPhysicsWorld3D;
  tick: number;
}

// NOTE ON TIME UNITS:
// The solver integrates per tick (dtTicks = 1 tick).
// Velocities (vx, vy, vz) and gravityY are expressed in units/tick and units/tick^2,
// NOT per second. At 30 Hz, -9.8 m/s^2 gravity is -9.8 / (30 * 30) ≈ -0.0108889.
const GRAVITY_Y_30HZ = -9.8 / (30 * 30);

export const runtime = createInstalledRuntimeAdapter<GameState>({
  createState: () => ({
    physics: createDeterministicPhysicsWorld3D([
      {
        id: 'ground',
        kind: 'static',
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        shape: { type: 'box', halfX: 20, halfY: 0.5, halfZ: 20 },
        layer: 1,
        mask: 0xffffffff,
      },
    ]),
    tick: 0,
  }),
  step: (state, inputs) => {
    const { world, contactEvents } = stepDeterministicPhysicsWorld3D(state.physics, {
      gravityY: GRAVITY_Y_30HZ,
      dtTicks: 1,
    });

    for (const contact of contactEvents) {
      // contact.point: deepest contact point in world coordinates
      // contact.normal: contact normal pointing from body A to body B
      // contact.closingSpeed: relative closing velocity along normal before impact
    }

    return {
      ...state,
      physics: world,
      tick: state.tick + 1,
    };
  },
});
```

Because all bodies, shapes, materials, voxel chunks, and contact impulse caches are
plain JavaScript objects (and typed arrays like `Uint8Array`), snapshotting, state hashing,
resimulation, rollback, and late-join work transparently and bit-identically across peers.

## Time units and integration

`stepDeterministicPhysicsWorld3D` integrates per tick (`options.dtTicks`, default 1 tick):
- **Displacement**: `body.x += body.vx * dtTicks`
- **Acceleration**: `body.vy += gravityY * dtTicks`
- **Units**: Rigid body linear velocities (`vx`, `vy`, `vz`) are in **units per tick** (NOT per second).
  Angular velocities (`avx`, `avy`, `avz`, `angularVel`) are in **radians per tick** (NOT per second).
- **Gravity**: `gravityY` is in **units per tick squared**.
  To convert standard acceleration (e.g. `-9.8 m/s^2`) to `gravityY`:
  $$\text{gravityY} = \frac{g}{\text{tickRate}^2}$$
  - At 30 Hz: `gravityY = -9.8 / (30 * 30) ≈ -0.0108889`
  - At 60 Hz: `gravityY = -9.8 / (60 * 60) ≈ -0.0027222`

Supplying per-second values directly (like `-9.8`) will apply excessive acceleration
every single tick.

## Deterministic physics surface (`/`, `/creator`, `/browser`)

`@series-inc/rundot-syncplay`, `@series-inc/rundot-syncplay/creator`, and
`@series-inc/rundot-syncplay/browser` export the full deterministic 3D physics toolkit:

- `createDeterministicPhysicsWorld3D(bodies)` / `stepDeterministicPhysicsWorld3D(world, options)` —
  construct and advance a deterministic world snapshot-to-snapshot. Solid contact
  events report `point` (deepest world contact point), `normal` (contact normal from A to B),
  and `closingSpeed` (pre-impact relative closing velocity along the normal).
- `applyDeterministicForces3D(world, forces, options)` — apply continuous forces,
  pure torques, and offset forces over time (`options.dtTicks`, default 1 tick),
  accumulating delta-v and waking touched contact islands.
- `applyDeterministicWorldEdit3D(world, edit)` — runtime destruction/topology
  edits (fracture, voxel carve) that stay checksum-stable across clients.
- `cookDeterministicVoxelChunkCollider3D(chunk)` / `carveDeterministicVoxelChunk3D(chunk, region)` —
  cook dense voxel chunks (supporting `(0 | 1)[]` or `Uint8Array` occupancy) into
  compound colliders and carve them using box, sphere, or swept-capsule regions.
- `cookDeterministicVoxelSubregion3D(chunk, existingShape, dirtyRegion)` / `recookDeterministicVoxelSubregion3D` —
  re-cooks dirty subregions of compound voxel chunk colliders after carving, preserving
  untouched merged collider boxes without costly full-chunk re-cooking.
- `splitDeterministicVoxelChunk3D(chunk, options)` — 6-connected flood-fill fracture
  primitive that splits carved voxel chunks into cropped sub-chunks, checks against
  anchor faces (`'+x' | '-x' | '+y' | '-y' | '+z' | '-z'`), and turns floating pieces
  into new rigid bodies.
- `cylinderHullVertices(radius, halfHeight, sides)` — vertices for a cylinder as
  a regular prism (trunks, stumps, logs, pillars). There is no cylinder
  primitive; a cylinder is a convex hull, and hulls are at parity. `sides` tops
  out at 8 because the hull limit is 16 vertices. Vertices come from the
  deterministic `sinTurns`/`cosTurns` (pure integer, bit-identical on every
  engine), so two peers building the same trunk agree exactly. Prefer it over a capsule where
  the flat top matters — a capsule's rounded caps let a character slide off a
  stump and change how a body rolls off an edge.

### Voxel and custom binary synchronization (`bytes` DSL kind)

Schema DSL binary serialization (`createDeterministicBinarySerializer`, available on
root, `/creator`, and `/browser`) supports the `bytes` field kind for raw byte payloads
up to 64 KiB (`Uint8Array`), encoded with a 2-byte length prefix. This allows voxel chunk
occupancies and custom binary blobs to sync over the network without base64 or JSON bloat.

When these APIs run **inside** an installed runtime `step`, they are
authoritative. When used only for VFX outside checksummed state, treat them as
cosmetic. Do not mix Rapier (or any non-deterministic engine) into the
checksummed path.

This section is non-exhaustive: the full curated surface (impulses, queries,
callbacks, body helpers, vehicle stepping, stress telemetry) is pinned by the
export golden at `packages/syncplay/tests/golden/export-surface.json`.

Session snapshot transfer is bounded by `maxSnapshotBytes` (session/room
option, plumbed through `networked-client` and the authority room); oversized
snapshots are rejected fail-closed rather than truncated. Default late-join
snapshot ceiling is **4 MiB** (`DEFAULT_MAX_SNAPSHOT_BYTES`).

## Which `Math` methods are safe in simulation code

Syncplay replaces 21 global `Math` methods with deterministic implementations,
so a WebView peer gets the same answer on every JS engine. A **native** peer —
Android or console — runs C++ instead, and C++ implements only seven of them.
Calling one of the other fourteen is deterministic within the WebView lane and
has no counterpart at all on the native side, so the two peers desync with no
other symptom.

**Backed by C++ — safe in simulation code:**

`Math.sin`, `Math.cos`, `Math.atan`, `Math.atan2`, `Math.exp`, `Math.log`,
`Math.hypot` (two arguments).

**Not backed — do not call from simulation code:**

`Math.acos`, `Math.acosh`, `Math.asin`, `Math.asinh`, `Math.atanh`,
`Math.cbrt`, `Math.cosh`, `Math.expm1`, `Math.log10`, `Math.log1p`,
`Math.log2`, `Math.sinh`, `Math.tan`, `Math.tanh`.

This is enforced, not advisory: `core/tests/math-surface-guard.test.mjs` fails
the build when simulation source calls anything from the second list. Prefer the
fixed-point `DeterministicMath` operations (`sinTurns`, `log2Fixed`, `hypot`,
and the rest) over raw `Math` wherever you can — they are pure integer
arithmetic, and every one of the 65 is gated against its C++ twin. (The gate
compares the engine copy in `src/math.ts`; the copy you import via
`/core/deterministic-stdlib` is held source-identical to it by a separate
check, so the coverage reaches your code transitively.)
One caveat: `mul` and `div` are integer-*exact* only while the `a * b`
intermediate stays under 2^53 (at the default scale of 1000, operands up to
~95,000 real units). Past that the low bits are dropped — identically on every
peer, so it is not a desync, but it is a precision cliff.

To make an unbacked method usable, add its `det_*` counterpart to
`core/native/deterministic_math.cpp` and remove it from the guard's list — not
the other way round.

## Geometry limits and per-step budget (`core/physics` WASM entrypoint)

**Scope: this section describes `@series-inc/rundot-syncplay/core/physics`, the
Kinetix WASM entrypoint from "Physics engine transition" above — not the
TypeScript solver exported from `/creator`.** The two are separate
implementations that share function names; none of the limits or figures below
were measured against the `/creator` solver and they should not be assumed to
apply to it.

### The hard ceiling

A single shape may declare at most **1,000,000** flat geometry values. Geometry
is 3 values per element, so that is roughly a 577×577 heightfield or ~333k mesh
triangles. The limit is exported as a constant for programmatic checks — from
`@series-inc/rundot-syncplay/core/physics`, not from `/creator`:

```ts
import { PHYSICS_MAX_SHAPE_GEOMETRY_ELEMENTS } from '@series-inc/rundot-syncplay/core/physics';
```

Exceeding it fails at world-construction time with:

```
KINETIX_PHYSICS_SHAPE_GEOMETRY_TOO_LARGE <bodyId> <elementCount>
```

from both `createPhysicsWorld` and `applyPhysicsWorldEdit` (and their
`…Deterministic…3D` aliases on the same entrypoint).

**This is a tripwire against obviously-wrong input — a mis-scaled voxel cook, a
units error — not a performance target.** Nothing breaks at 999,999 values; a
body that large is simply far too slow to step in real time. Size your content
against the budget below, which is roughly an order of magnitude lower.

### What static geometry costs every tick

Static collider geometry is re-marshaled to the solver on every step, so its
cost is paid per tick whether or not anything touches it. Measure your own
content with `node core/bench/static-geometry-benchmark.mjs`; these figures are
from that script (Node 23, Apple Silicon, `substeps: 4`, contacts suppressed):

| static content | checksum on | checksum off |
|---|---:|---:|
| 32 bodies × 8 compound children (256) | 0.66 ms | 0.08 ms |
| 32 bodies × 16 compound children (512) | 1.17 ms | 0.09 ms |
| 32 bodies × 32 compound children (1024) | 2.23 ms | 0.14 ms |
| one 128×128 heightfield | 0.97 ms | 0.24 ms |
| one 256×256 heightfield | 3.88 ms | 0.99 ms |
| one 512×512 heightfield | 16.10 ms | 4.84 ms |

For a streaming world, budget by **total compound children in view**, not by
chunk count: cost is linear in children and effectively free of contact count.
Roughly 1,000 children fits comfortably inside a 30 Hz tick.

### `computeChecksum` dominates the above

`computeChecksum` defaults to **`true`**, and the checksum is taken over the
whole world — including every static shape, on every step. As the table shows it
is most of the per-tick cost on static-heavy worlds, and it scales with geometry
that never changes.

Pass `computeChecksum: false` on any step whose checksum you do not compare:

```ts
import { stepPhysicsWorld } from '@series-inc/rundot-syncplay/core/physics';

stepPhysicsWorld(world, { gravityY: -9.81, computeChecksum: false })
```

Keep it **on** for frames you checksum-compare across clients, replay, or feed
to `replayPhysicsSession`. Turning it off where you do not need it is the single
largest win available on a static-heavy world — up to ~15× on the rows above.

### Contact authority and budgets

Contact authority is split by responsibility, and the machine-readable form of
everything below is exported as `PHYSICS_CONTACT_CONTRACT`:

| pair class | authority |
|---|---|
| solid (non-trigger, non-sensor) | the C++/WASM solver's contact telemetry |
| trigger / sensor overlaps | the JS overlap pass |

The solver never resolves triggers or sensors, so its telemetry cannot report
them — that is why the split exists rather than one source owning everything.

`contactCache` holds exactly the contacts the solver resolved, including
zero-impulse resting contacts, and is **sorted by pair id**. That ordering is
canonical world state: it feeds checksums and is returned to the solver as
warm-start input on the next step, so do not reorder or filter it. `activePairs`
and contact events are a superset — they additionally carry trigger/sensor
overlaps and pairs the solver did not resolve, such as static-static contacts.

Two budgets bound a step, and they behave differently on overflow:

| budget | limit | on overflow |
|---|---:|---|
| contact telemetry | 100,000 | **silently truncates in C++**; the bridge detects the saturated count and throws `KINETIX_PHYSICS_CONTACT_TELEMETRY_SATURATED` rather than returning a partial cache |
| broadphase pairs | 1,048,576 | falls back to all-pairs; lossless, no signal |

Each step result reports `contactTelemetryCount`, read from the solver's own
count rather than derived from the cache, so you can watch headroom against the
telemetry budget before it becomes an error.
