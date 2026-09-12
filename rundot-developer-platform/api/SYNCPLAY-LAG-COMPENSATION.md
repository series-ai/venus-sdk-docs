# Syncplay: Lag compensation for RC1

Fair hitscan for fast 3D shooters. When a player fires, they're aiming at where
targets appeared **on their screen** — which, thanks to prediction and network
delay, is a few ticks behind the confirmed simulation. Lag compensation **rewinds
the world to the frame the shooter actually saw**, validates the shot there, and
applies the result — without letting a client forge favorable timing.

Import lag-compensation helpers from `@series-inc/rundot-syncplay` or
`@series-inc/rundot-syncplay/browser`. Import the physics world from
`@series-inc/rundot-syncplay/physics/3d`. This page builds on the
[Syncplay guide](SYNCPLAY.md) and [Physics](SYNCPLAY-PHYSICS.md).

{% hint style="info" %}
**When you need this.** Use lag compensation only for hitscan weapons in
latency-sensitive 3D games. A projectile weapon does not use this page. It uses
physics queries instead — see [Projectile weapons](#projectile-weapons) below.
{% endhint %}

***

## Projectile weapons

A weapon that simulates a travelling bullet does not rewind anything. It also
does not need a separate hit-finder. Build it out of the physics queries:

1. Keep the projectile in your simulation state, next to the players.
2. Advance it inside the runtime `step`, one fixed tick at a time.
3. Each tick, sweep it from its previous position to its new position. Use
   `physics.shapeCast()` for a bullet with a radius. Use `physics.raycast()`
   for a zero-radius bullet. A sweep finds targets between the two positions.

Both query methods are part of the canonical 3D physics world.

```typescript
// inside the runtime step, once per tick, for each live projectile.
// physics is a PhysicsWorld3D. Speed is the distance for this fixed tick.
const hit = physics.shapeCast({
  shape: { type: 'sphere', radius: 0.1 },
  x: bullet.x, y: bullet.y, z: bullet.z,
  dx: bullet.dx, dy: bullet.dy, dz: bullet.dz,
  maxDistance: bullet.speed,     // the distance this tick covers
  layerMask: 3,
})[0]

if (hit !== undefined) {
  applyDamage(hit.bodyId, hit.distance)
} else {
  bullet = advance(bullet)       // ordinary state, rolled back with the rest
}
```

The projectile is then predicted, rolled back and checksummed like all other
simulation state, and it stops where the simulation says it stops. A rewind does
not give you that. See [Physics & collision](SYNCPLAY-PHYSICS.md) for the world,
the body layers and the query options.

A game with both weapon classes uses both mechanisms. They do not conflict. Lag
compensation reads the target history buffer. The projectile sweep reads the
physics world.

***

## The pattern

```
createDeterministicLagCompensation3DHistory({ maxStoredFrames, occluders })
history.recordTargets(targets)          // each tick: snapshot hitbox positions
history.validateShot(shot)              // on fire: rewind + test + return a verdict
```

The history is a **ring buffer of past hitbox states**. You record every tick;
when a shot arrives you validate it against the rewound world. The result tells you
whether it hit, missed, was occluded, or was rejected for bad timing.

***

## Recording target history

```typescript
import { createDeterministicLagCompensation3DHistory } from '@series-inc/rundot-syncplay/browser'

const history = createDeterministicLagCompensation3DHistory({
  physicsWorld: physics,
  maxStoredFrames: 128,       // how far back you can rewind (default 128)
  occluders: worldBodies,     // see the id and layer requirements below
})

// every tick, record each target's hitbox:
history.recordTargets(state.players.map((p) => ({
  frame: ctx.frame,
  targetId: p.id,
  x: p.x, y: p.y, z: p.z,     // world units, plain numbers
  radius: p.hitRadius,
  pose: p.crouching ? 'crouching' : 'standing',
})))
```

`DeterministicLagCompensatedTarget3D`: `{ frame, targetId, x, y, z, radius, pose }`
(`pose: 'standing' | 'crouching'`).

The history object:

| Member | Purpose |
|---|---|
| `recordTargets(targets)` | Store this tick's hitbox states. |
| `rewind(frame, shooterSlot?)` | Reconstruct the hitboxes the buffer can supply at `frame`. It can omit a target — read the rule below. |
| `validateShot(shot)` | Rewind + test a shot; returns a verdict. |
| `snapshot()` / `restore(snapshot)` | Serialize for rollback. The history is part of simulation state — see [Put the history in your rollback state](#put-the-history-in-your-rollback-state). |
| `checksum()` | Deterministic hash of the buffer. |

**`rewind` does not reconstruct every known target.** It applies two rules:

* If the buffer holds a record at exactly `frame`, `rewind` returns those exact
  records only. A target without a record at that frame is dropped, even when
  the buffer holds records on both sides of it.
* If no record sits at `frame`, `rewind` interpolates. It returns a target only
  when the buffer holds a record **before** `frame` and a record **after** it.

A target with no bracketing pair is left out silently. The shot then cannot hit
it, and the result is a guaranteed `miss` on every peer. The newest edge of the
buffer is where this happens most: with `latencyFrames: 0` the rewind frame is
the current frame, and no record exists after the current frame yet.

**So record the current tick's targets before you validate any shot on that
tick.** Call `recordTargets` first, `validateShot` second, in the same step.

***

## Validating a shot

```typescript
const result = history.validateShot({
  id: 'shot-42',
  shooterSlot: 0,
  shotFrame: ctx.frame,       // the frame the shooter fired on
  latencyFrames,              // derive it — see "Derive latencyFrames" below
  x, y, z, dx, dy, dz,        // origin + direction, plain numbers
  maxDistance,
  weapon: 'rifle',            // 'rifle' | 'shotgun' | 'burst' — a label only
  // REQUIRED and never empty. One ray per pellet, including a single-ray rifle:
  // an empty array returns reason: 'invalid-shot' for every call.
  pellets: [{ dx, dy, dz }],
  maxHistoryFrames: 128,
})

if (result.reason === 'hit') applyDamage(result.hitTargetId, result.distance)
```

**`weapon` is telemetry, not behaviour.** The field is required and its enum is
closed, but the validator never reads it. `pellets` alone decides what happens:
a `'rifle'` with five pellets casts five rays, and a `'shotgun'` with one pellet
casts one. Use `weapon` for logs, UI labels and analytics. Do not model your
weapon taxonomy on these three names.

Every pellet must point close to the shot direction. The validator normalizes
both, and the dot product must be at least `0.95`. One pellet outside that cone
returns `invalid-shot` for the whole shot.

`DeterministicLagCompensatedShot3DResult`:

| Field | Meaning |
|---|---|
| `reason` | `'hit'` \| `'miss'` \| `'occluded'` \| `'stale-frame'` \| `'future-frame'` \| `'invalid-shot'` |
| `rewindFrame` | Always `shotFrame - latencyFrames`. It is **not** clamped. An out-of-range value is rejected, and this field still reports the raw number, which can be negative. |
| `hitTargetId` / `hitboxId` | What was hit. |
| `distance` | Hit distance. |
| `pelletHits` | Pellets that connected (shotguns). |
| `checksum` | Deterministic hash of the resolution. |

The rejection codes let **your own sim logic** drop malformed or backdated
shots:

| Code | When the validator returns it |
|---|---|
| `stale-frame` | `rewindFrame` is negative, or `latencyFrames` is larger than `shot.maxHistoryFrames`. The validator does not clamp the rewind into range. It rejects the shot. |
| `future-frame` | `rewindFrame > shotFrame`, which happens only when `latencyFrames` is negative. It does **not** mean the `shotFrame` lies in the future. The validator has no clock and no idea what "now" is, so it cannot detect a forged future `shotFrame`. Only the authoritative variant compares `shotFrame` against a received frame. |
| `invalid-shot` | A malformed shot: a non-integer `shotFrame` or `latencyFrames`, a non-finite coordinate, `maxDistance <= 0`, an empty `pellets` array, a zero-length direction, or a pellet outside the shot cone. |

Every client runs the same deterministic validation, so a shot that one peer
rejects is rejected by all. This is in-sim validation, not a server-enforced
guarantee: the deterministic authority relays and orders inputs. It does not run
your sim and it does not adjudicate shots.

***

## Server-authoritative validation

`validateDeterministicAuthoritativeLagCompensatedShot3D(history, occluders, shot,
context)` adds a `DeterministicAuthoritativeLagCompensation3DShotContext`. A
validator that DOES know when a shot was received (a game running its own
authoritative server, or a future platform-side validator) supplies that context.
The function then rejects every shot that disagrees with it.

The context carries **four** integers. All four are required:

| Field | Meaning |
|---|---|
| `acceptedShotFrame` | The frame the authority accepts as the moment of the shot. Must be `>= 0`. |
| `serverReceiveFrame` | The frame the authority received the shot on. Must be `>= acceptedShotFrame`. |
| `maxHistoryFrames` | The history depth the authority allows. Must be `> 0`. |
| `maxLatencyFrames` | **The rewind bound.** The largest `serverReceiveFrame - acceptedShotFrame` the authority accepts. Must be `>= 0`. |

`maxLatencyFrames` is the field that closes the "claim huge latency to rewind
arbitrarily far" hole. `serverReceiveFrame` bounds nothing on its own.

The function derives the latency as `serverReceiveFrame - acceptedShotFrame`. It
does **not** correct a client's claim. It rejects a shot that disagrees with the
context, so the shot must satisfy all three equalities:

* `shot.shotFrame === context.serverReceiveFrame`
* `shot.latencyFrames === context.serverReceiveFrame - context.acceptedShotFrame`
* `shot.maxHistoryFrames === context.maxHistoryFrames`

A broken equality, a derived latency above `maxLatencyFrames`, or a malformed
context returns `reason: 'invalid-shot'`. The function returns a result. It never
throws. A rejection reports `rewindFrame: context.acceptedShotFrame` when the
context is well formed, and `shot.shotFrame - shot.latencyFrames` when the
context itself is malformed. Only a shot that passes every check reaches the
standard validation.

On the standard deterministic room there is no such server-side adjudicator
today; the bound is only as trustworthy as the context your sim feeds it.

The lower-level functions are available if you want to build a custom flow:

| Function | Purpose |
|---|---|
| `rewindDeterministicLagCompensatedTargets3D(history, frame)` | Get interpolated hitbox states at a past frame. |
| `buildDeterministicLagCompensatedHitboxProxies3D(history, frame, shooterSlot?)` | Build [physics bodies](SYNCPLAY-PHYSICS.md) for the rewound hitboxes (raycast against them yourself). |
| `validateDeterministicLagCompensatedShot3D(history, occluders, shot)` | Stateless validation (no history object). |

***

## Occluder and target id requirements

These three conventions are load-bearing and produce results that are wrong on
every peer identically, so no convergence test can catch them.

**Occluder ids must start with `occluder.`** That prefix is the only thing
separating "the shot hit a wall" from "the shot hit a player". Occluders and
hitbox proxies are raycast together as one body list, and the result is
classified by the prefix alone. A wall named `wall-3` comes back as
`reason: 'hit'` with `hitTargetId: 'wall-3'`, and you apply damage to it.

```
wall id "wall-3"          -> hit       hitTargetId: "wall-3"
wall id "occluder.wall-3" -> occluded  hitTargetId: ""
```

Occluders must also carry a `layer` that intersects mask `3`; generated hitbox
proxies use `layer: 1`.

**`targetId` must be exactly `slot-<slot>` and contain no `.`** Self-exclusion is
a string match against `slot-${shooterSlot}`, so any other naming makes
`shooterSlot` a silent no-op and a player can hit their own hitbox at point-blank
range. `hitTargetId` is recovered by slicing the hitbox id at its first `.`, so a
dot inside `targetId` returns a truncated id.

**The hitbox shape is fixed and metre-scaled.** Each target becomes two bodies: a
chest capsule at `y + 0.45` with `halfHeight 0.55` and your `radius`, and a head
sphere of radius `0.28` at `y + 1.35` standing or `y + 0.85` crouching. Only
`radius` is yours. The origin is at the target's feet and the constants assume a
humanoid about 1.8 units tall. Different character scale means hitboxes that do
not match your models — agreed on by every peer. Use
`buildDeterministicLagCompensatedHitboxProxies3D` with your own raycast if you
need different geometry.

## Determinism notes

- Record targets **every tick** at a consistent point in your step, so the buffer
  is identical on every client.
- Positions, radii and distances are plain IEEE-754 doubles, **not** fixed-point.
  `rewind` interpolates them with an ordinary lerp. Only the shot and pellet
  directions are quantized: the validator normalizes each one onto a grid of
  1/10000 before it casts. Determinism here rests on every peer reproducing the
  same double arithmetic. Frame numbers and `latencyFrames` are integers.
- Lag compensation decides *hit/miss*. On its own it does not stop a lag-switch
  cheat. Use the authoritative variant and bound the rewind with
  `maxLatencyFrames`.

### Put the history in your rollback state

The history buffer is **part of simulation state**. The object that
`createDeterministicLagCompensation3DHistory` returns is a closure over mutable
arrays, so you cannot capture it by reference. A captured reference is not a
copy: it reads the buffer as it is now, and the checksum diverges after the first
rollback. `snapshot()` and `restore()` are the seam. Wire them into the same
`captureState` / `restoreState` pair the runtime already uses:

```typescript
const history = createDeterministicLagCompensation3DHistory({
  maxStoredFrames: 128,
  occluders: worldBodies,
})

const runtime = createInstalledRuntimeAdapter<GameState, Input>({
  identity,
  sessionConfigBytes,
  captureState: () => ({ ...state, shotHistory: history.snapshot() }),
  restoreState: (saved) => {
    state = saved
    history.restore(saved.shotHistory)   // NOT: history = saved.shotHistory
  },
  frameOf: (saved) => saved.tick,
  step: (inputs) => {
    // recordTargets(...) first, validateShot(...) second
  },
})
```

`restore()` throws `Deterministic lag compensation history snapshot checksum
mismatch` when the snapshot's `maxStoredFrames` differs from the live object's,
or when the snapshot content does not match its own checksum. So construct the
history with the same `maxStoredFrames` on every peer and in every replay.

### Derive latencyFrames, do not hard-code it

`latencyFrames` states how far behind the confirmed simulation the shooter's
view was. A magic constant such as `3` is wrong on most connections. The runner
publishes both counters you need, and the package root exports
`millisecondsToFrames`:

```typescript
import { millisecondsToFrames } from '@series-inc/rundot-syncplay'

// on the firing client, at the moment the player fires:
const viewLag = Math.max(0, runner.predictedThrough - runner.appliedThrough)
const latencyFrames = Math.min(viewLag, MAX_HISTORY_FRAMES)

// RTT-derived alternative. netStats.rttMs is -1 until the first time-sync pong,
// and millisecondsToFrames throws on a negative input, so guard it:
const rttMs = runner.netStats?.rttMs ?? -1
const fromRtt = rttMs < 0 ? 0 : millisecondsToFrames(rttMs / 2, tickRate)
```

`millisecondsToFrames` is exported from the package root, not from `/browser`.

Send the resulting `latencyFrames` with the shot as ordinary input. Every peer
must validate the same number. A peer that reads its own local counters at
validation time produces a different verdict and desyncs the room.

Keep `MAX_HISTORY_FRAMES` (the shot's `maxHistoryFrames`) **less than or equal
to** the history's `maxStoredFrames`. Only `maxHistoryFrames` produces
`stale-frame`. A rewind that is inside `maxHistoryFrames` but older than the
buffer holds finds no records at all, so the shot returns `miss` from a pruned
buffer. A rejected shot then looks exactly like a legitimate miss.

***

## See also

- [Physics & collision](SYNCPLAY-PHYSICS.md) — shots resolve against 3D bodies and occluders.
- [Movement (KCC)](SYNCPLAY-MOVEMENT.md) — `stepDeterministicFpsAim` produces the aim direction shots use.
- [Syncplay guide](SYNCPLAY.md) · [session runner](SYNCPLAY.md#session-runner) — the `appliedThrough` and `predictedThrough` counters used above.
