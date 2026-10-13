# Syncplay: physical assemblies

**PROVISIONAL.** This module is provisional. One example consumer uses it, but no
production game has shipped a balance pass against it, and several of its parameters come
from spike measurements rather than from lived gameplay. Treat the API as usable and the
tuning as a starting point.

`physical-assembly` glues parts into one driven structure, detaches them, and rewinds one
body through its past motion. It is the authoring layer a TotK-style physical sandbox
needs on top of the physics world.

Import it from:

<!-- syncplay-example: physical-assembly-round-trip -->
```ts
import {
  createSyncplayPhysicalAssemblySlice,
  PHYSICAL_ASSEMBLY_DEFAULT_PART_CAP,
  projectSyncplayPhysicalAssembly,
  quantizeAssemblyAnchor,
  stepSyncplayPhysicalAssembly,
} from '@series-inc/rundot-syncplay/modules/physical-assembly'
import { createDeterministicMath } from '@series-inc/rundot-syncplay'

const math = createDeterministicMath()

const candidates = [
  { partId: 'crate', bodyKey: 'body-crate', x: 0, y: 0, z: 0 },
  { partId: 'plank', bodyKey: 'body-plank', x: 500, y: 0, z: 0 },
]
const claims = [{ slot: 0, partId: 'crate' }]
const base = { slot: 0, partId: '', bodyKey: '', anchorX: 0, anchorY: 0, anchorZ: 0 }
const context = (frame: number) => ({ frame, tickRateHz: 60, math, candidates, claims })

let slice = createSyncplayPhysicalAssemblySlice()
slice = stepSyncplayPhysicalAssembly(
  slice,
  { ...base, action: 'grab' as const, partId: 'crate', bodyKey: 'body-crate' },
  context(0),
).slice

const glued = stepSyncplayPhysicalAssembly(
  slice,
  { ...base, action: 'glue' as const, partId: 'plank', bodyKey: 'body-plank', anchorX: 503 },
  context(1),
)
slice = glued.slice

const projection = projectSyncplayPhysicalAssembly(slice)
if (projection.partCount !== 2) throw new Error('the assembly did not grow')
if (projection.bondCount !== 1) throw new Error('the glue did not create a bond')
if (glued.events[0]?.payload.kind !== 'bond-created') throw new Error('missing bond-created')
if (quantizeAssemblyAnchor(503) !== 500) throw new Error('the anchor did not quantize')
if (PHYSICAL_ASSEMBLY_DEFAULT_PART_CAP !== 21) throw new Error('the default cap drifted')

const detached = stepSyncplayPhysicalAssembly(
  slice,
  { ...base, action: 'detach' as const, partId: 'plank', bodyKey: 'body-plank' },
  context(2),
)
if (detached.slice.assemblies.length !== 2) throw new Error('detach did not split the assembly')

console.log(
  `physical assembly: parts ${projection.partCount}, bonds ${projection.bondCount},`,
  `split into ${detached.slice.assemblies.length}`,
)
```

The module is pure and integer-fixed. It owns no physics world, no renderer and no random
stream, so adding or reordering work cannot change a shared RNG. Every world write comes
back to you as an event record to apply:

| Event | Meaning |
|---|---|
| `grab-granted` | Your slot owns the part or its assembly. Apply the hold drive. |
| `grab-rejected` | Another slot won the same part this frame. Apply no drive. |
| `bond-created` | Create the joint. The event names the assembly, both parts and the bond id; read the quantized anchors from the slice. |
| `parts-rejected` | The cap refused the glue. The slice is byte-identical to before. |
| `bond-broken` | Remove the joint. The module already split the graph. |
| `recall-begun`, `recall-step`, `recall-ended` | Drive the recalled body from the recorded track. |

***

## What the measurements decided

These parameters are not taste. Each came from a measured spike, and each one replaces a
plausible guess that turned out to be wrong.

| Parameter | Value | Why |
|---|---|---|
| Anchor quantum | 10 fixed units (1 cm at 1/1000) | A sub-quantum input difference collapses to one anchor and one world digest; a supra-quantum difference does not. The structure stayed stable at every quantum from 1 mm to 50 mm, so 1 cm is a choice, not a cliff. |
| Part cap | 21, configurable | A 21-part assembly builds in one atomic world edit with 20 bonds, and the cost scales sub-linearly in bond count. |
| Glue encoding | soft `weld`, `linearFrequencyHz` 20, `angularFrequencyHz` 20, `dampingRatio` 1 | All four candidate encodings were exactly rigid at rest. Only the soft weld also yields under load: it flexes **2,215 times more** than a rigid weld under 200 N. |
| Ownership | lowest claiming slot wins | It converges within the rollback depth. A deny-all rule never converges, because a contested grab then never succeeds. |

## Two rules that were learned the hard way

**Always set a break threshold.** A joint with no `breakForce` and no `breakTorque` is
indestructible. The spike that chose the glue encoding first survived 40 kN with every
encoding, because no threshold had been set. Emit both.

**Never set `ccd` on a hull.** The native step rejects the arguments outright with
`KINETIX_NATIVE_WORLD_WORLD_INVALID_OPTIONS`. Set `ccd: true` on box, sphere and capsule
parts; it removes every tunnelling case measured. A fast hull without CCD can cross a thin
wall, so shell it in a capsule if it moves fast.

## Ownership and contention

Two players can grab one part in the same frame. Ownership resolves **before** any drive is
emitted, so two slots never write the same body in one frame.

An optimistic grab still overlaps for the prediction window: the client that has not yet
heard the authority keeps driving until the correction lands. That window equals your
rollback depth and both runtimes converge, because they compute the same owner from the
same claim set. Gating every grab on an authority round trip removes the overlap and adds a
full round trip to every grab; the module chooses the overlap.

## Recall

The module tracks only *which* body is being rewound and the cursor frame. The pose history
and the drive belong elsewhere:

1. Record poses into a ring buffer. Truncate to the rollback frame and refill during
   resimulation. History is a **derived side buffer**, never canonical state: a refill
   reproduced a byte-identical track at rollback depths 1, 60 and 600.
2. Drive the body with `createKinematicPathDrive3D`. It writes the **interval-start** pose
   plus the derived velocity, so the body lands exactly on the next sample and transfers
   real momentum.

A pose-only write is not enough. It moves the body and transfers **exactly zero** momentum:
a neighbour was displaced by 6.818 m while receiving 0.000 m/s, against 6.807 m and
5.970 m/s for the velocity-driven drive. A rewind validated on position alone would pass
while being physically wrong.

**After a late join** the track is empty, so a rewind cannot reach backwards. Decide the
policy in your game: refuse the recall, shorten the window, or ship a compressed track in
the join snapshot. The module does not choose for you.

## Related pages

- [Physics](SYNCPLAY-PHYSICS.md) for the world, joints and shape casts.
- [Spatial interaction](SYNCPLAY-SPATIAL-INTERACTION.md) for the focus-and-hold targeting
  that usually drives a grab.
- [Lag compensation](SYNCPLAY-LAG-COMPENSATION.md) for the per-target history the recall
  track is modelled on.
