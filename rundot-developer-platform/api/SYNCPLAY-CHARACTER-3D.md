# Syncplay: 3D Character Modules

> **STABLE:** This module API passed the FPS and ARPG promotion gate.

Import the code-only 3D character module from:

<!-- syncplay-example: character-3d-imports -->
```ts
import {
  type Character3DContext,
  CHARACTER_3D_DEFAULT_CONFIG,
  createCharacter3DSlice,
  projectCharacter3D,
  projectCharacter3DAnimationGraph,
  projectCharacter3DCamera,
  stepCharacter3DController,
} from '@series-inc/rundot-syncplay/modules/character-3d'
import { createDeterministicMath } from '@series-inc/rundot-syncplay'
```

The module composes existing deterministic movement primitives. It does not own
a renderer, mesh, animation file, collision world, clock, or random stream.

## Which character module to use

`character3DComponent` is the recommended entrypoint for a game. It is the
production surface: it adds stances, movement abilities, camera rigs, and a
top-down controller.

`thirdPersonCharacterComponent`, from
[`@series-inc/rundot-syncplay/modules/component-model`](SYNCPLAY-COMPONENTS.md),
is a second 3D character module. It is the minimal reference module. Use it to
learn the component contract, not to build a game.

Both modules delegate movement to `stepDeterministicKcc3D`, derive facing and a
canonical clip, and project a camera binding. Both are marked stable. Do not run
both on one entity.

## Controllers

`Character3DControllerKind` is either:

- `kinematic`, backed by the existing deterministic KCC3D step; or
- `top-down`, backed by the existing deterministic top-down mover.

Create state once with `createCharacter3DSlice(initial)`. Then pass the prior
slice, normalized input, and an explicit `Character3DContext` into
`stepCharacter3DController`. The returned slice and rollback-safe semantic
events are detached from caller objects.

`Character3DContext` has seven required fields. `topDownBounds` is required for
both controller kinds, including `kinematic`. The step throws
`SYNCPLAY_CHARACTER_3D_STEP_INVALID` when it is absent.

```ts
const context: Character3DContext = {
  frame: 1,
  tickRateHz: 60,
  math: createDeterministicMath(),
  world: {
    minX: -50, maxX: 50,
    minY: 0, maxY: 50,
    minZ: -50, maxZ: 50,
    maxSlopeRisePerUnit: 1,
    stepHeight: 0.5,
  },
  topDownBounds: { minX: -50, maxX: 50, minY: -50, maxY: 50 },
  environment: { headroomClear: true },
  config: CHARACTER_3D_DEFAULT_CONFIG,
}

const stepped = stepCharacter3DController(
  createCharacter3DSlice({ key: 'hero', controller: 'kinematic' }),
  { moveX: 1, moveZ: 0 },
  context,
)
```

`world` takes the deterministic KCC 3D world. `topDownBounds` takes the
top-down mover bounds. `environment.mantleTarget` and `environment.wallNormal`
are optional; add them when the game supports mantle or wall-run.

The environment owns facts that the controller cannot infer without game
geometry: headroom, mantle target, and wall-run contact/normal. These are
authoritative context values, not render-side guesses.

## Movement abilities

The default configuration defines fixed frame counts and speeds for:

- crouch, which keeps the feet fixed and stands only with clear headroom;
- slide, which starts grounded, locks its initial direction, and exits after its
  configured duration;
- mantle, which requires an explicit target and advances in fixed steps;
- dash, which locks direction for its duration and then enforces cooldown; and
- wall-run, which requires airborne wall contact and exits on lost contact,
  expiry, or landing.

Unsupported ability/controller combinations fail closed instead of being
ignored. Inputs contain no callbacks or random source, so module composition
order cannot change an outcome.

## Animation and camera projections

`projectCharacter3DAnimationGraph(slice)` returns canonical locomotion
parameters using the shared KayKit-backed clip vocabulary. Rollback-safe
one-shot events are returned by `stepCharacter3DController`.

`projectCharacter3DCamera(slice, { math })` projects the rig already stored in
the slice. `projectCharacter3D(slice)` combines the stable body transform,
stance,
movement phase, animation graph, and camera into one render binding. Rendering
and interpolation remain presentation concerns.

```ts
const math: Character3DContext['math'] = createDeterministicMath()
const slice = createCharacter3DSlice({
  key: 'hero',
  cameraRig: 'third-person-orbit',
})
const camera = projectCharacter3DCamera(slice, { math })
const render = projectCharacter3D(slice)

console.assert(camera.rig === 'third-person-orbit')
console.assert(render.camera.rig === camera.rig)
```

## Stable failures

- `SYNCPLAY_CHARACTER_3D_CONFIG_INVALID` — invalid authored movement config.
- `SYNCPLAY_CHARACTER_3D_SLICE_INVALID` — noncanonical or cross-field-invalid
  state.
- `SYNCPLAY_CHARACTER_3D_STEP_INVALID` — malformed input/context/environment or
  an unsupported controller-mode combination.

Failures occur before caller state is mutated.

## Public surface

The entrypoint exports the controller, camera, stance, movement, environment,
slice, input, event, animation, render-binding, and configuration types, plus:

- `CHARACTER_3D_DEFAULT_CONFIG`
- `createCharacter3DSlice`
- `stepCharacter3DController`
- `projectCharacter3DAnimationGraph`
- `projectCharacter3DCamera`
- `projectCharacter3D`
- `character3DComponent`
- `character3DModuleApiStability`
