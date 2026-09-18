# Syncplay: Animation (BETA)

A deterministic animation state machine — clips, transitions, blend trees, and
layers that advance **in lockstep with the simulation**. This matters when
animation drives gameplay: attack hitboxes, i-frames, and footstep events must fire
on the same tick on every client, and must survive rollback without double-firing.

Import from `@series-inc/rundot-syncplay/browser`. Builds on the
[Syncplay guide](SYNCPLAY.md).

{% hint style="info" %}
**Gameplay animation vs. cosmetic animation.** Use this system when animation
affects outcomes (hit frames, root motion that moves the character). Purely
cosmetic animation that never touches `state` can run in your renderer with normal
floats — it doesn't need to be deterministic.
{% endhint %}

***

## The pattern

```
const descriptor = { id, initialState, clips, states, transitions }  → the graph you author
createDeterministicAnimationRuntimeState(descriptor)  → per-character runtime state
stepDeterministicAnimation(descriptor, state, params) → { state, events, sampledPose, … } each tick
cookDeterministicAnimation(descriptor)                → { id, bytes, hash } content-addressed asset
```

The **descriptor** is the graph. You author it as a plain object and you keep it
in a variable. Every runtime function takes that descriptor. The **runtime state**
is per-character and lives in your simulation `state`. Each tick you pass in
parameter updates (booleans/numbers/strings that drive transitions and blends) and
get back the next runtime state plus the events and pose sampled this tick.

`cookDeterministicAnimation` is a separate step. It validates the descriptor,
sorts every collection into canonical order, and returns
`{ id, bytes, hash }`. Use `bytes` and `hash` for config-bundle parity: put the
hash in your session config so every client proves it loaded the same graph.
**A cooked asset is not a descriptor.** Do not pass it to
`createDeterministicAnimationRuntimeState` or `stepDeterministicAnimation` — it
has no `clips` or `states`, and both functions throw.

***

## Authoring the graph

<!-- syncplay-example: animation-cook-graph -->
```typescript
import { cookDeterministicAnimation, type DeterministicAnimationDescriptor }
  from '@series-inc/rundot-syncplay/browser'

const heroAnimation: DeterministicAnimationDescriptor = {
  id: 'hero',
  initialState: 'idle',
  clips: [
    { id: 'idle', durationFrames: 60, loop: true },
    { id: 'run',  durationFrames: 30, loop: true },
    { id: 'attack', durationFrames: 24, loop: false,
      events: [{ frame: 8, id: 'hit-active' }, { frame: 14, id: 'hit-end' }] },
  ],
  states: [
    { id: 'idle', clipId: 'idle' },
    { id: 'run',  clipId: 'run' },
    { id: 'attack', clipId: 'attack' },
  ],
  transitions: [
    { from: 'idle', to: 'run',    when: { parameter: 'speed', equals: 1 } },
    { from: 'run',  to: 'idle',   when: { parameter: 'speed', equals: 0 } },
    { from: 'idle', to: 'attack', when: { parameter: 'attack', equals: true }, consumeTrigger: 'attack' },
    // `when` is required. `exitFrame` only ADDS a gate: hold `attack` until the
    // last frame of the 24-frame clip. `exitFrame` must be < durationFrames.
    { from: 'attack', to: 'idle', when: { parameter: 'attack', equals: false }, exitFrame: 23 },
  ],
}

// Separate hashing step. Publish `cooked.hash` in your session config.
const cooked = cookDeterministicAnimation(heroAnimation)
```

{% hint style="warning" %}
Two authoring mistakes throw at validation time. `when` is **required** on every
transition — there is no exit-frame-only transition. And `exitFrame` must be
**less than** the source clip's `durationFrames`; `exitFrame: 24` on a 24-frame
clip is rejected.
{% endhint %}

The authoring types:

| Type | Key fields |
|---|---|
| `DeterministicAnimationClip` | `id`, `durationFrames`, `loop`, optional `events[]` (`{ frame, id }` — the gameplay hooks), `tracks[]` (keyframed values), `rootMotionTrackId`. |
| `DeterministicAnimationState` | `id`, `clipId`, optional `blendTree` (`parameter` + `clips` with `threshold`s — 1D blend). |
| `DeterministicAnimationTransition` | `from`, `to`, **required** `when: { parameter, equals }`, optional `priority`, `consumeTrigger`, `exitFrame` (extra gate: hold until `clipFrame >= exitFrame`; must be `< durationFrames` of the source clip), `durationFrames` (cross-fade length). |
| `DeterministicAnimationDescriptor` | `id`, `initialState`, `clips[]`, `states[]`, `transitions[]`, optional `layers[]`, `eventReconstruction`. |

`eventReconstruction` defaults to `'synchronized'`. Cooking copies the value into
the canonical bytes, and `'non-synchronized'` forces `rootMotionDelta` to `0`. It
does **not** de-duplicate events. Leave it unset unless you want root motion off.

**Events** on a clip (`{ frame, id }`) are the whole point for gameplay: an
`attack` clip fires `hit-active` on frame 8, and your step turns that into a hitbox
— identically on every client.

***

## Stepping per tick

```typescript
import { createDeterministicAnimationRuntimeState, stepDeterministicAnimation }
  from '@series-inc/rundot-syncplay/browser'

// Pass the DESCRIPTOR, never the cooked asset.
let animState = createDeterministicAnimationRuntimeState(heroAnimation)

// each tick, drive it with parameters derived from gameplay:
const out = stepDeterministicAnimation(heroAnimation, animState, {
  speed: isMoving ? 1 : 0,
  attack: attackPressed,   // a trigger parameter
})
animState = out.state

for (const event of out.events) {
  if (event.id === 'hit-active') enableHitbox(slot)
  if (event.id === 'hit-end')    disableHitbox(slot)
}
```

`stepDeterministicAnimation(descriptor, state, parameterUpdates)` returns
`DeterministicAnimationStepResult`:

| Field | Meaning |
|---|---|
| `state` | Next runtime state — reassign and persist it. |
| `events` | Clip events that fired this tick (`{ id, clipId, frame }`) — your gameplay hooks. |
| `sampledPose` | The sampled track values this tick (`Record<trackId, number>`), for rendering. |
| `layerPoses` | Per-layer sampled poses (additive/override layers). |
| `rootMotionDelta` | Root-motion movement this tick (feed into your mover). |
| `blendWeight` / `transitionBlendActive` | Cross-fade state. |
| `transitionCount` / `exitFrameTransitionCount` | Diagnostics. |
| `checksum` | Deterministic hash of the runtime state. |

The runtime state (`DeterministicAnimationRuntimeState`) tracks `stateId`,
`clipFrame`, `parameters`, `consumedTriggers`, and any in-flight `transitionBlend` —
all of which you persist in your simulation `state`.

***

## Rollback & events

`stepDeterministicAnimation` is pure. Roll the runtime state back with the rest of
your simulation `state` and the animation re-derives the same frames. Rollback
therefore never corrupts the graph.

Rollback does re-emit the same clip events, because the same tick is simulated
again. Deduplicate on the **presentation** side, not inside the animation system.
Use `createSyncplayModuleEventRecord` to build a dedupe key from module id, source
id, event id, frame, and ordinal, and feed the records to
`createSyncplayModuleEventPresentationAdapter`. Prediction state is not part of
the key, so re-simulating an identical frame cannot replay its VFX, SFX, or
animation trigger. See
[Components: rollback-safe one-shot events](SYNCPLAY-COMPONENTS.md).

{% hint style="warning" %}
`reconstructDeterministicAnimationEvents` is **not** an exactly-once mechanism.
It is a determinism self-test: it returns `{ events, eventHash, checksum }` where
`events` is a **count**, and it re-steps the graph with hard-coded fixture
parameters. It cannot reconstruct a real game's events. Do not build gameplay on
it.
{% endhint %}

***

## Determinism notes

- Persist the **runtime state** (`stateId`, `clipFrame`, `parameters`,
  `consumedTriggers`, `transitionBlend`) in simulation `state` so animation rolls
  back with gameplay. A module-level animation player would desync.
- Parameters are `boolean | number | string`; keep numeric blend parameters
  **integer / fixed-point**. `sampledPose` values are fixed-point too — convert to
  float only in the renderer.
- Everything advances in whole ticks at your descriptor's rate; there is no
  wall-clock `deltaTime`. Interpolate between frames for display only.
- Trigger parameters (`consumeTrigger`) are consumed deterministically — the
  `consumedTriggers` list is part of the checksummed state.

***

## See also

- [Movement (KCC)](SYNCPLAY-MOVEMENT.md) — turn movement events into animation parameters, and consume `rootMotionDelta`.
- [Components](SYNCPLAY-COMPONENTS.md) — the exactly-once one-shot event path for VFX, SFX, and animation triggers.
- [Syncplay guide](SYNCPLAY.md) · [built-in systems overview](SYNCPLAY.md#4-built-in-systems-all-deterministic)
