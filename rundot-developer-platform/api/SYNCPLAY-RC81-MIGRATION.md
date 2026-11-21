# Syncplay: migrate 3D physics from rc.80 to rc.81

> This guide describes the change from Syncplay `6.0.0-rc.80` to `6.0.0-rc.81`.
> For the current 3D physics API, read
> [Syncplay: 3D physics API v1](SYNCPLAY-PHYSICS.md).

> Use `6.0.0-rc.82`. It has the same physics as `6.0.0-rc.81` and adds the native
> source files that `rc.81` left out of the package, so the `./core` and
> `./core/build-native` entry points load. Do not use `6.0.0-rc.81`.

Syncplay `6.0.0-rc.81` runs 3D physics on the soft-step engine. The public API
does not change. No export is removed, and no import path changes. The results
of a 3D world change: motion, sleep, contact events, digests, and checkpoint
bytes. 2D physics does not change.

Do not mix rc.80 and rc.81 in one match, one replay, or one checkpoint history.

## Required changes

Apply each change that affects your game.

| rc.80 behavior | rc.81 action |
| --- | --- |
| The game saved an rc.80 checkpoint, snapshot, replay, or late-join record | Do not load it in rc.81. The physics ABI is 26 (was 25), and the digest algorithm is revision 4 (was 3). An rc.81 world rejects a checkpoint from ABI 25. Change the deterministic version and start new history. |
| Peers of one match could use different RC versions | Pin the exact version `6.0.0-rc.82` for every peer, server, bot, and replay tool. |
| Golden digests and proof values came from rc.80 | Record them again on rc.81. |
| Peers could use different hit event thresholds | Use the same `hitEventThreshold` on every peer. The hit events are part of the state, so a different value gives a different digest. Call `setHitEventThreshold()` only inside the deterministic step, at the same tick on each peer. |
| A removed body gave no end event, so game code closed its contacts | Remove that code. Every begin gets one end. |
| Game code keyed contacts by body pair | Key them by shape pair (`shapeA`, `shapeB`). |
| Game code read `contactData()` each tick | Use the contact events, or `bodyContactData()` for one body. `contactData()` now computes every touching pair when you call it. |
| Break, damage, or sound thresholds read contact values | Tune them again on rc.81. The point, impulse, penetration, and approach speed values change. |
| A kinematic body touching a static body gave contact events | Use a sensor shape or a query. A kinematic and static pair makes no contact. |
| Rolling cylinders, cones, or tapered capsules had tuned distances | Tune them again. Cylinders and cones are 16-sided hulls. Use a sphere or a capsule for a body that must roll smoothly. |
| A game used a failed step to detect a bad angular velocity | Check the input in game code. The engine clamps an angular velocity that it cannot integrate, and the step completes. |
| Game code read zero from `latest().jointReactions` for a sleeping joint | A sleeping joint now keeps the reaction of its last awake step. Check the sleep state of the bodies if the game needs zero. |
| Tests asserted a sleep tick | Update them. At 60 Hz an island sleeps after 31 steps. A wake of one body wakes its whole island. |
| The game had a download budget for the physics WASM file | Update it. The production file is 5,991,204 bytes (rc.80: 4,131,201). |

## Contact events and contact data

The step keeps only events. The world computes the full contact data when you
read it.

| Output | When the world makes it | In the state, the digest, and a checkpoint |
| --- | --- | --- |
| `latest().contactEvents.begin`, `.end`, `.hit` | each step | yes |
| `latest().sensorEvents`, `sensorOverlaps()` | each step | yes |
| `contactData()`, `bodyContactData()`, `manifolds` | when you read it | no |
| `info().contactCount`, `readStepProfile().contactPointCount` | when you read it | no |

- A read does not change the world. A peer that reads contact data keeps the
  same digest as a peer that does not read it.
- After `restoreCheckpoint()`, `restore()`, or `importCheckpoint()`, and before
  the next step, `contactData()` gives the contacts of the restored state, with
  their manifolds.
- A hit event comes from the solver. It needs a manifold point that took a
  normal impulse and whose approach speed is above `hitEventThreshold`. A
  touching pair without such a point gives no hit event.
- On the soft-step route, `point` is the first point of the first manifold. The
  public solver keeps the collide point.

## End and begin events after an edit

An edit that destroys a touching contact ends that pair in the next step:
`removeBody()`, `replaceBody()`, `disableBody()`, `setBodyType()`,
`destroyShape()`, `setCollisionFilter()`, `setShapeFilter()` (a new filter value,
also when it still accepts the pair), a geometry change of a shape, and a change
of the sensor kind of a shape. A pose, a velocity, a material, a flag, or a mass
change keeps the contact. The world compares each body before and after the
whole edit: a filter equal to the current filter, or a change and its undo in
one edit, ends nothing.

When the shapes still touch after that step, the same step also has a begin of
the same pair, after the end. Read the end events before the begin events. A
replaced sensor or visitor that still overlaps gives a sensor end and a sensor
begin.

## Failed steps, restores, and calls that throw

- A step that throws changes nothing. The world, its checkpoint bytes, and the
  next step are equal to those of a world that did not try the step. Correct the
  input and step again.
- A restore (`restoreCheckpoint()` or `restore()`) discards the inputs
  that are staged for the next step: contact rules and the portal plan. Stage
  them again after the restore if the next step needs them.
- `replaceBody()` applies `key` and `portalable` as `createBody()` does. If you
  do not give them, the body keeps its values. A key that another body holds
  throws.
- A deformable step or node call whose result is not a finite number throws
  with status 10 (`NonFinite`). The deformable world does not change.
- A deformable builder (`createClothGrid()`, `createRope()`, `createMesh()` and the
  others) that fails changes nothing. A builder whose result has a value that
  the world cannot store, for example a link of length 0, throws with status 10.
- `raycastSdf()` tests at most 1,048,576 points of the ray inside the grid. A
  ray that needs more throws with status 3 (`CapacityExceeded`).
- A deformable geometry call with ordinary values gives the result of its
  binary64 formula, as every other physics call does. With values of very
  different sizes in one shape or ray (for example 1e200 and 1e-200), the call
  gives the exact result or throws with status 10.

These calls throw in rc.81. In rc.80 some of them lost a change without an
error.

| Call | Why it throws |
| --- | --- |
| A shape operation after `replaceBody()` of the same body in the same edit | The replacement sets all shapes. Put the shapes in the replacement definition. |
| `fragmentizeBody()` or `detachCompoundChild()` after another change of the same body in the same edit | These calls start from the committed body. Do the other change in the next edit. |
| `cutLink()` on a link that is already cut | A link breaks one time. |
| `dispose()` of a deformable world that a physics world holds | Remove it from the physics world first. |

## Known limits in rc.81

- Most failed steps change nothing: the step throws, the world stays as it
  was, and you can step again. A step can also fail after it changed the solver
  world (for example, the physics WASM cannot get memory in a step where
  contacts begin or inside the solver step, or the solver makes a value that is
  not finite). The world then goes into the "needs restore" state. Each
  `step()`, each `captureCheckpoint()`, and each vehicle or ragdoll call throws
  the error code `physics.world-needs-restore`. Body reads, `latest()`,
  `digest()`, and queries still work and give the state of the last completed
  step; `contactData()` and `bodyContactData()` can give no contacts. To
  continue, restore a checkpoint that you captured before the failed step
  (`restoreCheckpoint()`, or `restore(bytes)` with bytes from your session or a
  peer). After the restore, the next steps are equal to the steps of a peer that
  did not try the failed step. The world never continues with different motion.
- In rc.81, a few out-of-memory failures (for example in a body removal) can
  change the world without the "needs restore" state, and a failed call can keep
  some engine memory and world slots. If a physics call fails because the WASM
  cannot get memory, stop the match on that peer, load the physics module again,
  and join from a checkpoint. A later release removes this limit.
- A world with a mesh shape above 512 triangles, or a heightfield above 2,048
  triangles (more than 32 x 32 cells), runs on the public solver. Call
  `world.rigidRouteState?.()` to see the route and the reason. A later release
  removes this limit.
- Some joint, shape, and portal setups also keep the public solver.
  `rigidRouteState()` names the reason.
- In a world with joints, a periodic domain, or portal members, an edit
  rebuilds the native world. Each contact then starts again without warm start.

## Performance in rc.81

Time of the public step, Node.js, production WASM, 60 Hz, 4 substeps, median of 5
runs that time rc.80 and rc.81 in the same rounds, on an Apple M5 Max desktop
(machine load 12.9 to 18.7), on the release candidate build:

| Scene | rc.80 | rc.81 |
| --- | --- | --- |
| 400 boxes in a pile, sleep off | 7.19 ms | 2.07 ms (3.5 times faster) |
| 400 boxes in a grid, sleep off | 3.60 ms | 1.08 ms (3.2 times faster) |
| 320 boxes, all asleep | 0.299 ms | 0.067 ms (4.5 times faster) |

These are desktop numbers. Measure your game on physical phones. A later release
makes the step faster again.

The package file `MIGRATING-RC80-TO-RC81.md` has the full list of changes.
