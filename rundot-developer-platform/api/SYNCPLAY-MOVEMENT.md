# Syncplay: Character movement for RC1

Deterministic **kinematic character controllers (KCC)** and movers — the "push a
character through the world with collision, slopes, step-up, and jump feel" logic
that every action game needs and that is notoriously easy to de-determinize. Every
mover is a pure function of integers, so a character lands on the exact same world
unit on every client.

Import from `@series-inc/rundot-syncplay/browser`. Builds on the
[Syncplay guide](SYNCPLAY.md); pairs naturally with [Physics](SYNCPLAY-PHYSICS.md).

For a side-view game, compose these lower-level movement primitives with the
generic code-only platformer module.

***

## The pattern

Every mover is a pure step: **body + input + world → next body**.

```
stepDeterministicKcc2D(body, input, world, frame) → { body, events }
```

You keep the returned `body` in your simulation state and feed it back next tick.
The `world` is your static collision description (walls, slopes, platforms); build
it once.

***

## Units and timestep (read this first)

Every mover on this page advances **exactly one frame** per call. No mover takes a
timestep. You pass the current frame index, and the controller applies one frame of
motion.

The 2D movers work in **integer world units per frame**. They are not fixed-point.

- `stepDeterministicKcc2D` calls `assertInteger(input.moveX)`, then does
  `x = body.x + input.moveX`. `moveX: 1` moves the body 1 unit.
- `stepDeterministicTopDownMover` calls `assertInteger` on `input.dx` and
  `input.dy`, then applies acceleration and a fixed `7/10` friction decay.
- Gravity is a fixed `vy -= 1` on every frame. A jump sets `vy = 9` — that is 10,
  less the same frame's gravity. Coyote time and jump buffer are both 4 frames.
- Author the `world` in integers as well. The controller only checks the input.

{% hint style="danger" %}
**Never pass a `ctx.math` fixed-point value into `moveX`, `dx` or `dy`.** These
APIs take small integers. A `fixedScale`-scaled axis is still a valid integer, so
the mover accepts it and moves the body by that many world units in one frame.
`moveX: 32768` moves the body 32768 units on the next frame, with no error, no
warning, and no event. `fixedScale` defaults to `1000`, so even a default-scaled
axis teleports the character across the level.

Convert an analog stick to `-1`, `0` or `1`, or to a small integer speed, before
you call a mover. A fractional value is the only bad value that throws.
{% endhint %}

`stepDeterministicKcc3D` also advances one frame, but it does **not** check its
input for integers. See
[the 3D unit contract](#3d-kcc-unit-contract-frame-units-not-si).

### Physics uses a fixed timestep

No physics timestep appears on this page. The RC physics APIs use one fixed
timestep for each world:

| API | Step call | Meaning |
|---|---|---|
| 3D physics | `PhysicsWorld3D.step()` | Advances one fixed tick. Set `tickRate` when you create the world. |
| 2D physics | `PhysicsWorld2D.step()` | Advances one fixed tick. Set `tickRate` when you create the world. |

Movers take a **frame index**, never one of these. Full rules:
[3D physics units](SYNCPLAY-PHYSICS.md#create-and-dispose-a-world).

***

## 2D platformer controller — `stepDeterministicKcc2D`

Full platformer feel: gravity, grounded state, **coyote time**, **jump buffering**,
wall-slide, slopes, moving platforms, and one-way platforms.

```typescript
import { stepDeterministicKcc2D } from '@series-inc/rundot-syncplay/browser'

// All values are integer world units. `dir` is -1, 0 or 1 — never a scaled axis.
const result = stepDeterministicKcc2D(
  body,
  { moveX: input.dir, jumpPressed: input.jump },
  world,
  ctx.frame,
)
// result.body   → the next body; persist it in simulation state
// result.events → e.g. ['buffered-jump'] on the frame a jump starts
```

The body carries the feel-state you persist per character:

<!-- syncplay-example: movement-kcc-2d-types -->
```typescript
interface DeterministicKccBody {
  x: number; y: number       // integer world units
  vx: number; vy: number     // integer world units per frame
  grounded: boolean
  coyoteFrames: number       // frames of grace to still jump after leaving ground
  jumpBufferFrames: number   // frames a queued jump stays buffered
  wallSlideSide: -1 | 0 | 1
  platformId?: string        // moving platform the body is riding
}

interface DeterministicKccInput {
  moveX: number              // integer units to move THIS frame. Use -1 | 0 | 1
  jumpPressed?: boolean
  dropPressed?: boolean      // drop through a one-way platform
}
```

The world describes static + moving collision:

```typescript
interface DeterministicMovementWorld {
  minX; maxX; minY; maxY: number           // bounds
  walls: number[]                          // X coordinates of full-height vertical walls
  slopes: DeterministicSlope[]             // { id, minX, maxX, baseY, risePerUnit }
  steps: DeterministicMovementStep[]       // { id, x, height } — height above 3 is ignored
  movingPlatforms: DeterministicMovingPlatform[]
  oneWayPlatforms: DeterministicOneWayPlatform[]
}
```

Each entry in `walls` is **one X coordinate**, not a segment. The wall is vertical
and full height. The controller reacts whenever `Math.abs(x - wall) <= 1`, at every
Y from `world.minY` to `world.maxY`. It then pushes `x` to `wall - 1` or `wall + 1`
and sets `vx = 0`. A wall of finite height is not possible here — use a `step` or a
`slope` instead.

Keep the body at least 2 units clear of a wall each frame. A body that arrives
exactly on `wall` is pushed to `wall + 1`, which is the far side.

### Events

`DeterministicKccStepResult` = `{ body, events }`. `events` is a list of strings you
turn into SFX and animation triggers — feed them to
[Animation](SYNCPLAY-ANIMATION.md) parameters. The 2D controller emits exactly these
thirteen names, and no others:

| Event | The controller emits it when |
|---|---|
| `platform-ride` | The body rides a moving platform it was already grounded on. |
| `elevator-ride` | The same, for a platform with a non-zero `dyPerFrame`. |
| `platform-contact` | The body lands on a moving platform. |
| `elevator-contact` | The same, for a platform with a non-zero `dyPerFrame`. |
| `coyote-jump` | A jump starts during coyote time. Always paired with `buffered-jump`. |
| `buffered-jump` | A jump starts. This is the only jump-start event. |
| `slope` | The body settles on a slope. |
| `step` | The body settles on a step-up ledge. |
| `one-way` | The body lands on a one-way platform. |
| `one-way-drop` | The body drops through a one-way platform. |
| `wall-slide` | The body touches a wall while airborne and falling. |
| `wall-contact` | The body touches a wall while grounded or rising. |
| `ledge` | The body hits `world.minX` or `world.maxX`. |

{% hint style="warning" %}
There is **no `land` event and no `jump` event**. Detect a landing from the
grounded transition, not from the event list:

```typescript
const result = stepDeterministicKcc2D(body, input, world, frame)
const landed = !body.grounded && result.body.grounded
```

Detect a jump start from `buffered-jump`.
{% endhint %}

***

## Top-down & twin-stick — `stepDeterministicTopDownMover`

For top-down movers with no gravity: acceleration and friction on a
`DeterministicTopDownBody` (`x, y, vx, vy`).

```
stepDeterministicTopDownMover(body, input, bounds) → { body, slid, navSteered }
```

It takes **three** parameters. The third is an axis-aligned bounds rect, not a
`DeterministicMovementWorld`, and there is no `frame` parameter. The input fields
are `dx` and `dy`, not `moveX` and `moveY`.

<!-- syncplay-example: movement-top-down-mover -->
```typescript
import { stepDeterministicTopDownMover } from '@series-inc/rundot-syncplay/browser'

const bounds = { minX: 0, maxX: 256, minY: 0, maxY: 256 }

const result = stepDeterministicTopDownMover(
  { x: 10, y: 10, vx: 0, vy: 0 },
  { dx: 2, dy: -1 },       // integer acceleration this frame. `assertInteger` runs on both
  bounds,
)
// result.body       → { x: 12, y: 9, vx: 2, vy: -1 }
// result.slid       → true when the bounds clamped the body this frame
// result.navSteered → true when navDx or navDy was non-zero
```

| Field | Meaning |
|---|---|
| `input.dx` / `input.dy` | Player acceleration for this frame. Must be an integer. |
| `input.navDx` / `input.navDy` | Optional steering from a pathfinding agent. Summed with `dx`/`dy`. |
| `result.slid` | The bounds clamped `x` or `y` and zeroed that velocity. |
| `result.navSteered` | `navDx` or `navDy` was non-zero. |

Friction is fixed: `vx = trunc(body.vx * 7 / 10) + dx` each frame. It is not
tunable.

***

## FPS aim — `stepDeterministicFpsAim`

Deterministic aim/look integration for first-person games. It advances a view
direction from look input in whole degrees, so what one player is aiming at is
identical on every client (the basis for
[lag-compensated hitscan](SYNCPLAY-LAG-COMPENSATION.md)).

```
stepDeterministicFpsAim(previous, input, seed, frame) → DeterministicFpsAimState
```

<!-- syncplay-example: movement-fps-aim -->
```typescript
import { stepDeterministicFpsAim } from '@series-inc/rundot-syncplay/browser'

interface DeterministicFpsAimState {
  yaw: number       // integer degrees, wrapped into [0, 360)
  pitch: number     // integer degrees, clamped to [-89, 89]
  originX: number   // carried through unchanged; you own it
  originY: number
  recoil: number    // weapon recoil the step folded in this frame
}

interface DeterministicFpsInput {
  yawDelta: number    // integer degrees. A fraction throws
  pitchDelta: number  // integer degrees. A fraction throws
  fire?: boolean
}

let aim = { yaw: 0, pitch: 0, originX: 0, originY: 0, recoil: 0 }
aim = stepDeterministicFpsAim(aim, { yawDelta: 2, pitchDelta: -1, fire: true }, 1234, 0)
// → { yaw: 7, pitch: -3, originX: 0, originY: 0, recoil: 5 }
```

{% hint style="warning" %}
**Recoil is not optional and you cannot switch it off.** The step folds a weapon
recoil term into the aim on every call:

- On a firing frame it sets `recoil = ((seed * 31 + frame * 17) % 5) + 1`, which is
  always 1 to 5. It never returns 0 on a firing frame.
- On a non-firing frame it decays the previous recoil by 1, to a floor of 0.
- It then applies `yawDelta + recoil` and `pitchDelta - trunc(recoil / 2)`.

In the example above, `yawDelta: 2` produced `yaw: 7`, because recoil added 5. Pass
the same `seed` and `frame` on every peer, or the aim diverges. If your game needs
a different recoil curve, integrate the aim yourself with `ctx.math`.
{% endhint %}

***

## 3D character controller — `stepDeterministicKcc3D`

A full 3D KCC that can resolve against a [3D physics world](SYNCPLAY-PHYSICS.md#3d-physics),
with collision filters, external impulses (wind, knockback, dashes), and custom
processors.

```typescript
import { stepDeterministicKcc3D } from '@series-inc/rundot-syncplay/browser'

const result = stepDeterministicKcc3D(
  body,                            // DeterministicKccBody3D
  { moveX, moveZ, jumpPressed },   // DeterministicKccInput3D — the field is jumpPressed
  world,                           // DeterministicKccWorld3D
  {
    frame: ctx.frame,
    physics,                              // optional PhysicsWorld3D to collide against
    ignoredPhysicsBodyIds: ['trigger-1'], // bodies this character passes through
    externalImpulses: [                   // order-independent — summed deterministically
      { id: 'wind-z', vx: 0, vy: 0, vz: 2 },
      { id: 'dash-x', vx: 2, vy: 0, vz: 0 },
    ],
    // collisionFilters, processors also supported
  },
)
```

The options object is where 3D movement gets its power:

| Option | Purpose |
|---|---|
| `frame` | Current tick (required). |
| `physics` | A `PhysicsWorld3D` to resolve collisions against. |
| `ignoredPhysicsBodyIds` | Bodies this character should pass through (triggers, own hitbox). |
| `collisionFilters` | Per-body collision rules. |
| `externalImpulses` | One-shot impulses (dash, wind, knockback). **Summed order-independently** so two clients that received impulses in different orders still converge. |
| `processors` | Custom movement processors run in a fixed order. |
| `maxPushImpulse` | Cap on the push the KCC imparts to dynamic bodies. `0` (the default) disables pushing and leaves `result.physicsImpulses` empty. |
| `standOnDynamicBodies` | Let the capsule stand on, and inherit the velocity of, dynamic bodies. |
| `groundOnStaticBodies` | Ground the capsule on static bodies, including heightfields. See below. |
| `jump` | Jump tuning. See [Retuning gravity and jump](#retuning-gravity-and-jump). |

### The caller must apply the push impulses

`stepDeterministicKcc3D` does not write to the physics world. When the capsule
walks into a dynamic body, the step returns the push in
`result.physicsImpulses` and **your game must apply it**. Nothing happens if you
ignore the field: the crate does not move.

Each entry is `{ bodyId, impulse: {x, y, z}, point: {x, y, z} }`. Resolve its
body handle. Then pass the handle to `PhysicsWorld3D.applyImpulse`. Set
`maxPushImpulse` above `0`, or the array is always empty.

The frame order is fixed: **physics → KCC → apply the impulses on the next
frame.** Apply them at any other point in the frame and peers that run the same
inputs produce different worlds.

```typescript
import {
  stepDeterministicKcc3D,
} from '@series-inc/rundot-syncplay/browser'

// 1. Step physics first.
physics.step()

// 2. Step the KCC against the stepped world.
const result = stepDeterministicKcc3D(body, input, world, { frame, physics, maxPushImpulse: 4 })
body = result.body

// 3. Apply the pushes. They land on the NEXT physics step.
for (const push of result.physicsImpulses) {
  physics.applyImpulse(physics.resolveBody(push.bodyId), push.impulse, push.point)
}
```

`result` also carries `events`, `correctionCount`, `physicsQueryCount`,
`collisionFilterCalls`, `collisionFilterRejectedHits` and a `checksum`.

### 3D KCC unit contract (frame units, not SI)

`stepDeterministicKcc3D` advances **one simulation tick** with hard-coded frame
kinematics. It is not metre/second integration and is not fixed-point SI:

| Quantity | Behavior (current package) |
|----------|----------------------------|
| Horizontal move | `vx = input.moveX`, `vz = input.moveZ` — world units **per frame** |
| Gravity | `vy -= 1` every airborne frame |
| Jump | on buffered jump while grounded/coyote: `vy = 10`, `y += 1` |
| Coyote / jump buffer | 4 frames each |
| `stepHeight` / `maxSlopeRisePerUnit` | world units / rise-per-horizontal-unit |

Games that author in metres at 60 Hz must retune `moveX`/`moveZ`, jump feel, and
`externalImpulses` in these frame units. There is no SI-parameterized 3D KCC API.

### Retuning gravity and jump

Gravity retunes through a **processor**, because processors run before the
`vy -= 1` in the step — write `desiredVy + 1` and the subtraction lands on target.

The jump impulse is applied **after** processors, so it cannot be scaled that
way. Use `options.jump` instead.

{% hint style="danger" %}
**Retune gravity and the jump together, or the character cannot jump.** The
built-in gravity stays at `vy -= 1` per frame whatever you write in
`options.jump`. A small `impulse` on its own is smaller than one frame of
gravity, so the character drops on the very frame it presses jump.

Measured over the first 10 frames after a jump press, with `world.minY` far below:

| Tuning | `body.y` per frame |
|---|---|
| Default `impulse: 10` | `0 9 17 24 30 35 39 42 44 45` |
| `impulse: 0.35` alone | `-0.965 -1.615 -3.265 -5.915 -9.565 …` — it falls |
| `impulse: 0.35` + matching gravity processor | `0 0.315 0.595 0.84 1.05 1.225 1.365 1.47 1.54 1.575` |
{% endhint %}

```ts
// Scale BOTH. Gravity here is 0.035 units per frame instead of 1.
// The processor writes `desiredVy + 1` so the built-in `vy -= 1` lands on target.
const scaledGravity = {
  id: 'gravity',
  order: 0,
  process: (body) => ({ ...body, vy: body.vy - 0.035 + 1 }),
}

stepDeterministicKcc3D(body, input, world, {
  frame,
  processors: [scaledGravity],
  jump: {
    impulse: 0.35,      // vy set on the jump frame. Default 10
    liftOff: 0.035,     // immediate unstick lift. Default impulse / 10
    coyoteFrames: 6,    // default 4. Minimum 0
    bufferFrames: 6,    // default 4. Minimum 1
  },
})
```

Every default reproduces the hardcoded behaviour bit-for-bit, so omitting `jump`
leaves existing checksums unchanged. Bad values throw rather than silently desync
peers:

| Field | Rule | A bad value gives |
|---|---|---|
| `impulse`, `liftOff` | Finite number. | `KCC jump.impulse must be a finite number` |
| `coyoteFrames` | Integer, minimum **0**. | `KCC jump.coyoteFrames must be an integer >= 0, got -1` |
| `bufferFrames` | Integer, minimum **1**. | `KCC jump.bufferFrames must be an integer >= 1, got 0` |

`bufferFrames: 0` is rejected on purpose. A press arms the jump by writing this
count into `jumpBufferFrames`, and the gate needs it above 0. `0` would not mean
"no buffering" — it would mean "never jump". `1` is the real floor: the press lives
for the frame it happened on.

### Static physics does not vertically ground the KCC

`options.physics` uses `PhysicsWorld3D` from
`@series-inc/rundot-syncplay/physics/3d`. The TypeScript API uses the C++ core
compiled to WASM.
Slide resolution against static bodies (including heightfields) is **horizontal**.
`grounded` becomes true from `world.slopes`, `world.steps`, moving platforms,
standing on **dynamic** bodies, or the `minY` floor — not from static heightfield
contact alone.

Pass `groundOnStaticBodies: true` to ground the capsule on static bodies,
including heightfields. It samples the same triangles the solver collides
against, so a character stands exactly where a projectile lands — no rebuilt
slope geometry and no game-owned `heightAt` snap.

It is off by default so existing games keep bit-identical checksums. Without it,
static heightfields still only block horizontally and vertical support comes
from `world.slopes` / `steps` / platforms / `minY`.

***

## Crowds

```
runDeterministicMovementCrowdSimulation(players, frames, seed, restoreFrame?)
  → { checksum, players, frames, humanInputSlots, botInputSlots,
      predictionCorrections, rollbackEquivalent }
```

This is a **self-contained determinism fixture**, not a way to drive your own
characters. It takes four numbers and builds its own bodies, inputs and world. Use
it to prove that N controllers step identically whatever the iteration order, and
that a rollback to `restoreFrame` reproduces the same `checksum`
(`rollbackEquivalent`).

To move your own crowd, call `stepDeterministicKcc2D` or `stepDeterministicKcc3D`
per character in a stable id order. For gameplay crowds that also path, combine
with [Pathfinding](SYNCPLAY-PATHFINDING.md) agents.

***

## Putting it together

```typescript
function stepMovement(state: State, frame: number): State {
  const players = state.players.map((p, slot) => {
    const input = state.inputs[slot]
    const { body, events } = stepDeterministicKcc2D(p.body, {
      // `dir` is already -1, 0 or 1. Never write a scaled axis here.
      moveX: input.dir,
      jumpPressed: input.jump,
    }, state.world, frame)
    // There is no 'land' event. Read the grounded transition instead.
    const landed = !p.body.grounded && body.grounded
    return { ...p, body, anim: applyAnimEvents(p.anim, events, landed) }
  })
  return { ...state, players }
}
```

***

## Custom movement, aim, and distance math — use `ctx.math`, never `Math.*`

For steering, aim, and distance work outside the built-in controllers, do the
math on `ctx.math`. The determinism gate **blocks** `Math.sin/cos/tan/atan2/
sqrt/hypot/pow` (and `Math.random`/`Date.now`) in simulation code — they diverge
in low bits across engines and desync the match. `ctx.math` is the pure-integer,
byte-identical replacement:

- **Aim / facing:** `ctx.math.atan2(dy, dx)` → turns in `[0, fixedScale)`, or
  `ctx.math.atan2Signed(dy, dx)` → `[-fixedScale / 2, fixedScale / 2)` with the
  negative x-axis represented as `-fixedScale / 2`;
  `ctx.math.vec2FromAngleTurns(turns, speed)` to turn a heading back into a
  velocity; `ctx.math.angleDeltaTurns(from, to)` for the shortest turn to steer
  toward. Angles are **turns** everywhere (one revolution == `fixedScale`).
- **Distance / range checks:** `ctx.math.vec2Distance(a, b)` /
  `vec2DistanceSq` (cheaper, no `sqrt`), `ctx.math.hypot(dx, dy)`,
  `ctx.math.vec2Length`. Normalize a direction with `ctx.math.vec2Normalize`
  (zero vector → `{0,0}`).
- **Plain integer square root:** `ctx.math.integerSqrt(distanceSquared)` returns
  `floor(sqrt(distanceSquared))` for any non-negative safe integer through
  `Number.MAX_SAFE_INTEGER`. It throws for negatives, fractions, non-finite
  numbers, and unsafe integers. Unlike `ctx.math.sqrt`, this is not fixed-point.
- **Rotation:** `ctx.math.vec2Rotate(v, turns)`, `vec2Perp`, `vec2Dot`,
  `vec2Cross` for projections and side tests.

Never approximate these (octagonal magnitude, cross-product angle sorts, a
hand-rolled minimax) — the shared library already ships the accurate, certified
versions.

```typescript
const distance = ctx.math.integerSqrt(distanceSquared)
const signedFacing = ctx.math.atan2Signed(dy, dx)
```

## Determinism notes

- Persist the returned `body` (with its `coyoteFrames`/`jumpBufferFrames`/
  `platformId`) **in simulation state** — the feel-state must roll back too.
- **2D movers** (`stepDeterministicKcc2D`, top-down) use **integer world units per
  frame**, not fixed-point. `moveX`, `dx` and `dy` must be integers, and the mover
  adds them straight to the position. Convert an analog stick to `-1|0|1` or to a
  small integer speed. A `fixedScale`-scaled axis is accepted without error and
  teleports the body — see
  [Units and timestep](#units-and-timestep-read-this-first).
- **3D KCC** (`stepDeterministicKcc3D`) uses ordinary numbers in **frame units**
  (see the unit contract above). It does not check its input for integers.
  Quantize by game discipline so peers stay bit-identical; it is not the
  fixed-point SI path.
- No mover takes a timestep. They advance one frame per call. `dtTicks`,
  `dtSeconds` and `dt` all belong to the physics APIs, not to these.
- `stepDeterministicKcc3D` returns `physicsImpulses`, and the game must apply them
  in the order **physics → KCC → apply next frame**. A peer that applies them at a
  different point in the frame diverges.
- `externalImpulses` are summed order-independently by `id`; give each a **stable
  id** so a reordered list (from packet reordering) still resolves identically.
- The `world` should be identical on every client — derive it from the same cooked
  level data, not from anything client-local.

***

## See also

- [Physics & collision](SYNCPLAY-PHYSICS.md) — the world 3D KCC resolves against.
- [Animation](SYNCPLAY-ANIMATION.md) — drive animation from movement events.
- [Syncplay guide](SYNCPLAY.md) · [built-in systems overview](SYNCPLAY.md#4-built-in-systems-all-deterministic)
