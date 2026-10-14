# Syncplay: Gameplay Effects

> **STABLE:** This module API passed independent FPS damage and ARPG
> ability/status/damage consumers at the two-genre promotion gate.

Import the code-only module from:

<!-- syncplay-example: gameplay-effects-imports -->
```ts
import {
  applySyncplayGameplayEffectCommands,
  createSyncplayGameplayEffectsSlice,
  gameplayEffectsComponent,
  stepSyncplayGameplayEffects,
} from '@series-inc/rundot-syncplay/modules/gameplay-effects'
```

Definitions contain ordered typed damage, healing, resource, status, or ability
interrupt operations with exact integer amount formulas. Immediate effects emit
on application. Periodic effects use canonical duration, tick interval, tick
ordinal, and `add`, `refresh`, or `replace` duplicate semantics.

The composition helper prevalidates the complete command roster and target map,
then applies combat and stats/abilities changes atomically in target and command
ID order. A missing target or rejected nested operation leaves every caller
slice unchanged. Every target explicitly declares `statsFrame: 'advance'` when
the compositor owns that frame's stats timer step, or
`statsFrame: 'already-advanced'` when the game already stepped abilities and
statuses. This prevents accidental double advancement while keeping the target
contract fail-closed.

Target selection, aim, crits, random failure, encounter balance, presentation,
and item-consumption policy remain caller-owned.

## Stable errors

| Code | Cause |
|---|---|
| `SYNCPLAY_GAMEPLAY_EFFECTS_CONFIG_INVALID` | An authored effect definition is malformed. This covers the ID, schedule, duplicate policy, and the operation list. |
| `SYNCPLAY_GAMEPLAY_EFFECTS_INPUT_INVALID` | The input, or one application in it, is malformed. |
| `SYNCPLAY_GAMEPLAY_EFFECTS_CONTEXT_INVALID` | The frame context, the deterministic math, or the definition list is malformed. |
| `SYNCPLAY_GAMEPLAY_EFFECTS_SLICE_INVALID` | Hydrated state is corrupt, or an active application disagrees with its definition. |
| `SYNCPLAY_GAMEPLAY_EFFECTS_TARGET_INVALID` | The composition helper found a missing target, or a nested combat or stats operation rejected the change. Every caller slice stays unchanged. |
