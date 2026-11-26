# Batch presentation

The optional `@series-inc/rundot-syncplay/presentation` entry supports Three.js
and PixiJS without importing either renderer. This entry is staged for 6.0.0-rc.91.
Use it after that version is published. It is absent from rc.89. Existing games can already use `writeBodyMotionInto`
from their public 3D world.

## Read a public 3D world

<!-- syncplay-example: public-motion-frame -->
```ts
import { initPhysics3D, createPhysicsWorld3D, meters } from '@series-inc/rundot-syncplay/physics/3d';
import { createPhysicsPresentation3D } from '@series-inc/rundot-syncplay/presentation';

await initPhysics3D();
const world = createPhysicsWorld3D({ capacity: { bodies: 8, joints: 0 } });
try {
  const body = world.edit(edit => edit.createBody({
    kind: 'dynamic',
    shape: { type: 'sphere', radius: meters(0.5) },
    position: { x: meters(2), y: meters(3), z: meters(4) },
  })).created;
  const presentation = createPhysicsPresentation3D(8);
  const digest = world.digest();
  const frame = presentation.read(world);
  if (frame.count !== 1 || frame.ids[0] !== body.id || frame.poses[0] !== 2) {
    throw new Error('Unexpected presentation pose');
  }
  if (world.digest() !== digest) throw new Error('Presentation changed state');
} finally {
  world.dispose();
}
```

`world` must be the public `PhysicsWorld3D`. Do not pass a core world. The public
writer removes portal proxies, preserves jump flags, normalizes velocity zero,
and exports teleport counters. The reader also accepts an installed runtime's
public checkpoint view. For a world-owned checkpoint, use
`presentation.readCheckpoint(world, checkpoint)`.

Capacity must be an integer from 0 to 100000. An insufficient capacity rejects
the read. Create a larger reader when the game needs more capacity. The arrays
are allocated once by the reader. They require 117 bytes per capacity row,
plus fixed metadata: seven f64 poses, six f64 velocities, one u64 ID, one u8
status, and one u32 teleport counter. The cached u32 ID view shares ID storage.
Native scratch and internal public-writer allocations are additional. Portal
and checkpoint reads are not allocation-free.

The same frame object and arrays are reused. Read only the first `frame.count`
rows. The frame and its arrays are borrowed until the next read. Copy any data
that must survive that read. Do not mutate the arrays, use them as retained
history, or feed presentation state back into authoritative simulation.

`poses` has seven values per body: x, y, z, qx, qy, qz, qw. `velocities` has six:
vx, vy, vz, wx, wy, wz. `ids` holds stable logical IDs. `idWords` exposes each
ID as low and high u32 words on the supported little-endian targets. It permits
ID comparison without creating a BigInt for each lookup. Status and teleport
counter layouts are the same as the public motion writer.

## Three.js

```ts
import { writeThreeInstanceMatrices } from '@series-inc/rundot-syncplay/presentation';

// The game selects compatible bodies for this mesh and owns the slot list.
const slots = [0, 3, 7];
writeThreeInstanceMatrices(instancedMesh, frame, slots);
```

Each slot selects one pose row. The helper writes its matrix into the next
mesh instance and sets `mesh.count`. It checks pose and matrix capacity before
writing. It uses unit scale. Use compatible geometry for each selected body,
or construct custom matrices when instance scale differs.

The game owns the ID-to-slot mapping. Rebuild that mapping after removal or a
restore. Update colors, pick IDs, and other per-instance attributes with the
same mapping. A dense row number is not a stable entity ID. The helper writes
all selected poses, including sleeping bodies.

The older `updateInstancedMeshFromTransforms` helper keeps its existing mask
behavior. Its awake mask does not prove that a renderer has the right pose
after restore or slot changes. Request a full upload for those cases. The new
helper does not use that mask.

### Dirty-only 3D interpolation and GPU range uploads

For large scenes with many sleeping bodies (for example hundreds of debris
pieces where only a handful are awake), use `createPhysicsPoseInterpolator3D`
and `writeDirtyThreeInstanceMatrices` from
`@series-inc/rundot-syncplay/presentation`:

<!-- syncplay-example: dirty-pose-interpolator -->
```ts
import { initPhysics3D, createPhysicsWorld3D, meters } from '@series-inc/rundot-syncplay/physics/3d';
import {
  createPhysicsPresentation3D,
  createPhysicsPoseInterpolator3D,
  PRESENTATION_STATUS_SLEEPING_BIT,
  writeDirtyThreeInstanceMatrices,
} from '@series-inc/rundot-syncplay/presentation';

await initPhysics3D();
const world = createPhysicsWorld3D({ capacity: { bodies: 8, joints: 0 } });
try {
  world.edit(edit => edit.createBody({
    kind: 'dynamic',
    shape: { type: 'sphere', radius: meters(0.5) },
    position: { x: meters(0), y: meters(2), z: meters(0) },
  }));
  const reader = createPhysicsPresentation3D(8);
  const interpolator = createPhysicsPoseInterpolator3D(8);
  const target = {
    count: 0,
    instanceMatrix: {
      array: new Float32Array(8 * 16),
      needsUpdate: false,
      addUpdateRange(_start: number, _count: number) {},
    },
  };

  const frame0 = reader.read(world);
  const isSleeping = (frame0.status[0] & PRESENTATION_STATUS_SLEEPING_BIT) !== 0;
  if (isSleeping) throw new Error('Newly spawned dynamic body should be awake');
  interpolator.push(frame0);
  const written0 = writeDirtyThreeInstanceMatrices(target, interpolator.sample(1));
  if (written0 !== 1 || target.count !== 1) throw new Error('Expected initial upload');

  world.step();
  interpolator.push(reader.read(world));
  const written1 = writeDirtyThreeInstanceMatrices(target, interpolator.sample(0.5));
  if (written1 !== 1) throw new Error('Expected dirty update after step');
} finally {
  world.dispose();
}
```

- `createPhysicsPoseInterpolator3D(capacity)` ingests each fixed-tick
  `PresentationFrame3D` via `push(frame)` and produces an interpolated frame on
  every render frame via `sample(alpha)` (`alpha` in `[0, 1]`).
- Once a row has settled, `push(frame)` skips it in O(1) whenever its pose and
  teleport counter are unchanged (regardless of `status`), without touching
  `poses` or queuing it into `dirtyIndices`. Teleport-flagged rows snap
  immediately on the next sample and then settle cleanly. Callers inspecting
  `frame.status[i]` directly can test the `PRESENTATION_STATUS_SLEEPING_BIT`
  (`0x10`) bitmask.
- `writeDirtyThreeInstanceMatrices(target, frame, slots?, options?)` writes only
  the `frame.dirtyCount` dense indices listed in `frame.dirtyIndices` and calls
  `target.instanceMatrix.addUpdateRange?.(minInstance * 16, span * 16)` when at
  least one matrix changed. Pass `options.slotToInstance` (`Int32Array` or
  `ReadonlyMap<number, number>`) for O(1) subset-mesh mapping when passing
  `slots`.
- It automatically falls back to a full upload (and records a full
  `addUpdateRange?.(0, instanceCount * 16)` range) whenever
  `options.forceFullUpload === true`, `frame.topologyChanged === true`, or
  `target.count !== instanceCount`.

## Rollback-safe audio and VFX cues

When audio or particle effects are projected from deterministic simulation
state, rollbacks, repeated 120 Hz renders of the same tick, rapid impact bursts,
and late-join snapshot hydrations can otherwise replay stale cues. Use
`createRollbackSafeCueDeduplicator` (and `DEFAULT_CUE_LATE_JOIN_JUMP_FRAMES`,
default `120`) from `@series-inc/rundot-syncplay`:

<!-- syncplay-example: rollback-safe-cue-deduplicator -->
```ts
import {
  createRollbackSafeCueDeduplicator,
  DEFAULT_CUE_LATE_JOIN_JUMP_FRAMES,
} from '@series-inc/rundot-syncplay';

const deduper = createRollbackSafeCueDeduplicator({
  lateJoinJumpFrames: DEFAULT_CUE_LATE_JOIN_JUMP_FRAMES,
  defaultCooldownFrames: 4,
  suppressInitialFrame: true,
});

// First observed frame (for example right after snapshot hydration) is primed silently.
const initial = deduper.filter(500, [{ key: 'boom:500', frame: 500, cue: 'boom' }]);
if (initial.length !== 0) throw new Error('Expected initial frame suppression');

// Forward tick fires once; repeated render or rollback to frame 501 is suppressed.
const fired = deduper.filter(501, [{ key: 'hit:501:1', frame: 501, cue: 'hit' }]);
const replay = deduper.filter(501, [{ key: 'hit:501:1', frame: 501, cue: 'hit' }]);
if (fired.length !== 1 || replay.length !== 0) throw new Error('Unexpected cue replay');
```

- `accept(currentFrame, descriptor, options?)` and
  `filter(currentFrame, cues, options?)` track `highFrame` and suppress cues
  already seen or older than `highFrame - maxRetroactiveFrames` (default `0`).
- `cooldownFrames` / `defaultCooldownFrames` throttle by simulation ticks, and
  `cooldownMs` / `defaultCooldownMs` throttle by wall-clock milliseconds (using
  `options.nowMs` when supplied, or `Date.now()` automatically with expired
  entries pruned on every call).
- When `lateJoinJumpFrames > 0` and
  `currentFrame > highFrame + lateJoinJumpFrames`, the deduplicator clears seen
  keys/cooldowns, advances `highFrame`, and suppresses that jumped frame. Pass
  `lateJoinJumpFrames: 0` to disable forward jump detection.
- Pass `options.sessionGeneration` (or call `prime(frame, sessionGeneration?)`)
  on reconnect/hydration to reset seen keys and cooldowns across sessions.

## PixiJS and 2D

```ts
import { applyPixiTransforms2D } from '@series-inc/rundot-syncplay/presentation';

const frame2d = {
  count: 2,
  ids: ['player', 'crate'],
  poses: new Float64Array([2, 3, 0, 6, 3, 0.5]),
};
applyPixiTransforms2D(frame2d, id => sprites.get(id));
```

For a public 2D physics world, use the reader below. Pass its frame to
`applyPixiTransforms2D` with your game's sprite resolver.

<!-- syncplay-example: public-pose-frame -->
```ts
import { initPhysics2D, createPhysicsWorld2D, meters, radians } from '@series-inc/rundot-syncplay/physics/2d';
import { createPhysicsPresentation2D } from '@series-inc/rundot-syncplay/presentation';

await initPhysics2D();
const world = createPhysicsWorld2D({ capacity: { bodies: 8, joints: 0 } });
try {
  const handle = world.edit(edit => edit.createBody({
    kind: 'static', shape: { type: 'circle', radius: meters(0.5) },
    x: meters(2), y: meters(3), angle: radians(0.5),
  })).created;
  const presentation = createPhysicsPresentation2D(8);
  const digest = world.digest();
  const frame = presentation.read(world);
  const body = world.readBody(handle);
  if (frame.count !== 1 || frame.ids[0] !== body.id
    || frame.poses[0] !== body.x || frame.poses[2] !== body.angle) {
    throw new Error('Unexpected presentation pose');
  }
  if (world.digest() !== digest) throw new Error('Presentation changed state');
} finally {
  world.dispose();
}
```

The 2D reader owns f64 x, y, angle rows and u32 IDs. It uses 28 bytes per
capacity row, plus fixed metadata and internal native scratch. Capacity must
be an integer from 0 to 4096. The same frame and arrays are borrowed until the
next read. Only the first `count` rows are active.

The new public `PhysicsWorld2D.writeBodyPosesInto(poses, ids)` method returns
the count. It copies live bodies in ascending ID order with one native call.
It includes static bodies. It leaves unused output tails unchanged. It rejects
short, detached, overlapping, wrong-type, proxy, subclass, overridden-property,
and native-memory outputs before publishing any row. Plain disjoint views of
one JavaScript buffer are accepted. Scratch capacity is bounded by world
capacity. This method and the reader require the release that includes the
new 2D artifact. They are staged for rc.91 and are absent from rc.89.

A restore can reuse an ID from a discarded future. Rebuild ID-to-object maps
after `restoreCheckpoint`, `restore`, or world replacement. An ID alone does
not identify an object across those operations. The current 2D reader reads a
live world. Direct checkpoint-view reads are not part of this API.

You can also populate the generic 2D frame contract from another projection.
Its IDs can be an array or a typed array. Use a stable ID resolver and return
`undefined` for an object that should not receive an update.

The helper sets position and rotation. The game owns sprite creation, removal,
textures, hierarchy, camera conversion, and scale. Remove render objects whose
IDs leave the projection. Reuse a resolver and buffers in the render loop.
Neither renderer helper creates temporary vectors or matrices. BigInt array
reads and application callbacks can still allocate.

A 2D simulation can drive a Three.js view, and a game can project 3D poses into
a PixiJS scene. The game defines that coordinate conversion. The helpers do
not force one renderer or simulation dimension.

## Performance and determinism

The legacy `writeBodyTransformsInto` uses a constant number of native calls for
plain, separate output buffers. Proxies, subclasses, overridden view
properties, shared output storage, and views into native memory keep the old
interleaved path. Transform tails remain unchanged. Non-empty reads clear the
entire status mask. Empty reads do not allocate or clear it.

A failed native batch rejects the whole fast-path read. That path does not emit
the old per-body failure bit. Successful output and state match the frozen
reference tests. Authority arithmetic, checkpoint formats, and supported platforms are
unchanged. The 3D artifacts are unchanged. The 2D artifact adds only read-only
pose and record-size exports; it does not change simulation arithmetic.

Synthetic browser and emulator results select candidates. They do not predict
phone frame rate. Measure the complete game inside the RUN host before claiming
a device gain. A game must adopt the bulk path before its players benefit.
