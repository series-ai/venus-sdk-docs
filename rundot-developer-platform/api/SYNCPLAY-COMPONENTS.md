# Syncplay component modules

> **STABLE:** The component-model contract passed the two-genre promotion gate.
> The stability manifest records the consumer evidence for this contract as
> `transitive`, not `direct`. The FPS and ARPG examples reach the contract
> through the module definitions and the event lifecycle that they use. Neither
> example imports this entrypoint. Every other stable module page records
> `direct` evidence.
> Individual higher-level module entrypoints declare their own stability.

Syncplay component modules are small deterministic functions that can be
composed inside an installed runtime:

<!-- syncplay-example: components-imports -->
```ts
import { createDeterministicMath } from '@series-inc/rundot-syncplay'
import { createInstalledRuntimeAdapter } from '@series-inc/rundot-syncplay/core/runtime'
import {
  thirdPersonCharacterComponent,
  type SyncplayModuleDefinition,
} from '@series-inc/rundot-syncplay/modules/component-model'
```

A module is not a runtime. To compose one, you must also import
`createInstalledRuntimeAdapter` from
`@series-inc/rundot-syncplay/core/runtime`.

A module owns one explicit state slice. Its step is:

```ts
step(slice, input, context) => ({ slice, events })
```

The step must not mutate its arguments, keep hidden state, use `this`, read the
clock, or depend on unordered iteration. Its slice must round-trip
byte-identically through Syncplay's canonical encoding. Call
`assertCanonicalSyncplayModuleSlice(slice)` at integration boundaries.

## Composition

Call the module from the adapter's `step(inputs, commands)` closure. The
closure owns the frame counter and the immutable world. It builds the module
context and replaces the game state with the returned slice.

```ts
const math = createDeterministicMath()
const world = {
  minX: -50, maxX: 50,
  minY: 0, maxY: 50,
  minZ: -50, maxZ: 50,
  maxSlopeRisePerUnit: 1,
  stepHeight: 0.5,
}

interface GameState {
  readonly frame: number
  readonly character: ReturnType<
    typeof thirdPersonCharacterComponent.createInitialSlice
  >
}

let state: GameState = {
  frame: 0,
  character: thirdPersonCharacterComponent.createInitialSlice(),
}

const runtime = createInstalledRuntimeAdapter({
  identity: {
    abiVersion: 1,
    tickRate: 60,
    inputSchemaId: 'character-example-input/v1',
    stateSchemaId: 'character-example-state/v1',
    deterministicVersion: 'character-example/v1',
    engineIdentityHash: 'character-example-local-only',
  },
  sessionConfigBytes: new Uint8Array(),
  captureState: () => state,
  restoreState: (saved: GameState) => { state = saved },
  frameOf: (saved: GameState) => saved.frame,
  step: (
    inputs: readonly { moveX: number; moveZ: number }[],
    commands: readonly never[],
  ) => {
    if (commands.length > 0) throw new Error('COMMANDS_UNSUPPORTED')
    const frame = state.frame + 1
    const input = inputs[0] ?? { moveX: 0, moveZ: 0 }
    const stepped = thirdPersonCharacterComponent.step(
      state.character,
      input,
      { frame, tickRateHz: 60, math, world },
    )
    state = { frame, character: stepped.slice }
  },
})
```

The identity above is for a local example. Use the identity of your installed
game artifact in a live session.

## Randomness

V1 module context deliberately has no random generator. A shared mutable stream
changes its draws when composition order changes, including when a game merely
adds another module. Random outcomes therefore enter a module as explicit input
or an authority command.

The `SyncplayRandom*` APIs remain the separate server-verifiable secret channel.
They are not a module-local gameplay PRNG.

## Function-only v1

Modules compose as functions inside `createInstalledRuntimeAdapter`. They do not
publish Kinetix `components` or `systems` authoring descriptors in v1. The
descriptor surface will be reconsidered only after the module promotion gate
and a real data-authored consumer exists.

## Rollback-safe one-shot events

Use `createSyncplayModuleEventRecord` to derive identity from:

- module id;
- source/entity id;
- event id;
- simulation frame;
- ordinal within that source and frame.

Prediction state is not part of the dedupe key. Re-simulating an identical frame
therefore cannot replay its VFX, SFX, or animation trigger.

`createSyncplayModuleEventPresentationAdapter` exposes two separate paths:

- `observe(...).oneShotRecords` goes to
  `createSyncplayRunner({ presentation: { events } })`;
- `subscribeLifecycle` or `drainLifecycleTransitions` observes predicted,
  confirmed, and canceled transitions so render code can stop or reconcile
  speculative work without replaying it.

The standard network runner intentionally delivers side effects only from
authority-confirmed projection frames. A deterministic module context never
receives connection or prediction state, and the reference character emits
terminal `synced` records. Therefore a runner-only consumer does not receive
cancellation callbacks.

The lifecycle path is for a lower-level speculative presentation that already
owns a `createDeterministicEventTimeline`. Feed that timeline's predicted,
canceled, and confirmed records to the adapter:

```ts
const moduleEvents =
  createSyncplayModuleEventPresentationAdapter<CharacterEvent>()
const timeline = createDeterministicEventTimeline<CharacterEvent>()
const identity = createSyncplayModuleEventRecord(
  {
    moduleId: 'character.third-person-3d',
    sourceId: 'hero',
    eventId: 'animation.jump',
    frame,
    ordinal: 0,
  },
  { kind: 'animation', clip: 'jump' },
  { predictionState: 'predicted' },
)
const predicted = timeline.emitPredicted(
  identity.eventId,
  identity.frame,
  identity.payload,
  { dedupeKey: identity.dedupeKey },
)

moduleEvents.subscribeLifecycle((transition) => {
  if (transition.state === 'canceled') stopPredictedEffect(transition.dedupeKey)
})
moduleEvents.observe([predicted])
moduleEvents.observe(timeline.cancelFromFrame(frame))
```

For the confirmed-only runner path, wire
`moduleEvents.observe(projection.events).oneShotRecords` to
`presentation.events`:

```ts
const runner = createSyncplayRunner({
  // runtimeFactory, input codec, and other runner fields
  presentation: {
    project: (projection) => projection.render,
    events: (projection) =>
      moduleEvents.observe(projection.events).oneShotRecords,
  },
})
```

Both paths use the same stable identity and dedupe memory, but only the
speculative timeline produces lifecycle changes.

Call `reset()` on session teardown. Identity reuse with changed payload, scope,
player, or non-hashed metadata fails instead of silently suppressing the wrong
effect.

## Canonical character clips

Simulation emits these normalized clip names:

```text
block, cast, cheer, crawl, crouch, death, dodge, hit, idle, interact, jump,
lie, melee-dual-wield, melee-one-hand, melee-two-hand, melee-unarmed, run,
shoot-bow, shoot-one-hand, shoot-two-hand, sit, sneak, spawn, walk, wave
```

The vocabulary is backed by the CC0
[KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations)
categories. Locomotion, combat, gun, death, and emote semantics also overlap the
CC0
[Quaternius Universal Animation Library](https://quaternius.itch.io/universal-animation-library).
The render layer maps canonical names to a selected rig's actual filenames.
Simulation never embeds rig-specific names.

## Render binding

`ThirdPersonCharacterRenderBinding` contains only deterministic presentation
data:

- stable entity key;
- position and facing turns in `SYNCPLAY_TURN_SCALE` units per full turn;
- speed, grounded state, and canonical locomotion clip;
- one-shot animation event records;
- third-person camera target and offset.

The installed runtime can expose that binding through `projectState`.
`createSyncplayRunner` consumes the runtime projection. The R3F adapter reads raw
session state, so give it its own explicit projector:

```ts
const adapter = createDeterministicR3fRenderAdapter({
  session,
  projectState: (state) =>
    projectThirdPersonCharacter(state.character),
  errorCorrection: {
    poses: (binding) => [{
      key: binding.key,
      x: binding.transform.position.x,
      y: binding.transform.position.y,
      z: binding.transform.position.z,
    }],
  },
})
```

Simulation modules do not import React, Three.js, R3F, audio, or other render
code.

## Choosing a 3D character module

This package contains two 3D character modules. Choose one of them.

- `character3DComponent`, from
  `@series-inc/rundot-syncplay/modules/character-3d`, is the recommended
  entrypoint for a game. It is the production surface. It adds stances,
  movement abilities, camera rigs, and a top-down controller. See
  [Syncplay: 3D Character Modules](SYNCPLAY-CHARACTER-3D.md).
- `thirdPersonCharacterComponent`, in this entrypoint, is the minimal reference
  module. Use it to learn the component contract and to test composition. It
  has no stances, no movement abilities, and no camera rigs.

Both modules delegate movement to `stepDeterministicKcc3D`, derive facing and a
canonical clip, and project a camera binding. Both are marked stable. Do not run
both on one entity.

The package also ships a third character controller at
`core/src/physics/character.mjs`. No `exports` subpath reaches that file. It is
internal. Do not import it.

## Third-person reference component

`thirdPersonCharacterComponent` emits rollback-safe jump records and projects
the render/camera binding. `SYNCPLAY_TURN_SCALE` is `1000`; it keeps
render-facing units stable even when a game supplies deterministic math with a
different internal fixed-point scale.

Use `createThirdPersonCharacterSlice()` once when creating runtime state. Each
runtime tick calls `stepThirdPersonCharacterController(slice, input, context)`.
The context supplies the frame, tick rate, deterministic math, and immutable
KCC world.

## Errors

| Code | Meaning |
|---|---|
| `SYNCPLAY_MODULE_SLICE_INVALID` | A slice is not canonically encodable and byte-stable |
| `SYNCPLAY_MODULE_EVENT_IDENTITY_INVALID` | Event identity, options, or payload is outside the deterministic domain |
| `SYNCPLAY_MODULE_EVENT_IDENTITY_COLLISION` | One dedupe identity was reused for different deterministic content |
| `SYNCPLAY_MODULE_EVENT_TRANSITION_INVALID` | An event attempted an illegal lifecycle transition |
| `SYNCPLAY_MODULE_EVENT_RETENTION_INVALID` | Retention is not a positive safe integer |
| `SYNCPLAY_COMPONENT_SLICE_INVALID` | Reference component initial state is invalid |
| `SYNCPLAY_COMPONENT_STEP_INVALID` | Reference input or context is invalid |
