# Syncplay: Firearm Module (PROVISIONAL)

> **PROVISIONAL:** The deterministic firearm core has one production example
> consumer. Its API may change until a second genre proves the same contract.

Import the code-only module from:

<!-- syncplay-example: firearm-imports -->
```ts
import {
  createSyncplayFirearmSlice,
  firearmComponent,
  stepSyncplayFirearm,
  stepSyncplayFirearmWithInventory,
} from '@series-inc/rundot-syncplay/modules/firearm'
```

The module owns canonical magazine, cadence, reload, recoil, spread-sequence,
and trigger-edge state for authored semi-automatic or automatic weapons.
`stepSyncplayFirearmWithInventory` completes a reload atomically through the
public inventory/equipment API and consumes only the definition's exact ammo
item.

Aim, hit resolution, damage, teams, scoring, animation, audio, weapon switching,
attachments, chamber rules, and per-shell reloads remain caller-owned.

## Stable errors

| Code | Cause |
|---|---|
| `SYNCPLAY_FIREARM_CONFIG_INVALID` | The authored weapon definition is malformed. This covers the ID, magazine capacity, cadence, reload frames, trigger mode, recoil values, and the spread sequence. |
| `SYNCPLAY_FIREARM_INPUT_INVALID` | The input is not exactly `{ triggerHeld, reloadPressed }` with two boolean values. |
| `SYNCPLAY_FIREARM_CONTEXT_INVALID` | The frame context, the deterministic math, the reserve ammo count, or the inventory binding is malformed. |
| `SYNCPLAY_FIREARM_SLICE_INVALID` | The slice is noncanonical or cross-field invalid. Example: more reload frames remain than the definition allows, or a reload runs while the magazine is full. |
