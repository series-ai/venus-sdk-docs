# Syncplay: Spatial Interaction

> **STABLE:** This module API passed independent FPS ammo-crate and ARPG loot
> consumers at the two-genre promotion gate.

Import the code-only module from:

<!-- syncplay-example: spatial-interaction-imports -->
```ts
import {
  createSyncplaySpatialInteractionSlice,
  spatialInteractionComponent,
  stepSyncplaySpatialInteraction,
} from '@series-inc/rundot-syncplay/modules/spatial-interaction'
```

The module deterministically filters authored candidates by enabled state,
fixed-unit distance, and facing cone; selects by squared distance then stable
ID; and owns focus, hold progress, cancellation, and one-shot completion.
Coincident candidates are always in-cone, and angle wrap uses the supplied
deterministic math context.

The caller owns the consequence of completion, such as an inventory transfer, a
door action, or a dialogue start. The caller also owns all rendering.

## Stable errors

| Code | Cause |
|---|---|
| `SYNCPLAY_SPATIAL_INTERACTION_INPUT_INVALID` | The input is not exactly `{ held }` with one boolean value. |
| `SYNCPLAY_SPATIAL_INTERACTION_SLICE_INVALID` | The slice or the initial slice is malformed. |
| `SYNCPLAY_SPATIAL_INTERACTION_CONTEXT_INVALID` | The frame context, the deterministic math, the interactor, or a candidate is malformed. A duplicate candidate ID also fails here. |
