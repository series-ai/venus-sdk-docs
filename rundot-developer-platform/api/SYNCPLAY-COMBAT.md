# Syncplay combat modules

> **STABLE:** This module API passed the FPS and ARPG promotion gate.

`@series-inc/rundot-syncplay/modules/combat` provides three pure deterministic
components:

- `combatantComponent` resolves sorted hits into health, resistance,
  invulnerability frames, hitstop, knockback payloads, and defeat;
- `meleeCombatComponent` resolves inclusive active-frame arcs against explicit
  hurtboxes and prevents one attack from hitting one owner twice;
- `projectileCombatComponent` advances travelling projectiles through the
  existing deterministic 3D shape cast and validates hitscan through the
  existing authoritative lag-compensation path.

<!-- syncplay-example: combat-step-combatant -->
```ts
import { createDeterministicMath } from '@series-inc/rundot-syncplay'
import {
  createCombatantSlice,
  projectCombatant,
  stepCombatant,
} from '@series-inc/rundot-syncplay/modules/combat'

const math = createDeterministicMath()
const frame = 1

const result = stepCombatant(
  createCombatantSlice({
    id: 'player-1',
    health: 100,
    maxHealth: 100,
    resistances: { physical: 250 },
  }),
  {
    hits: [{
      id: 'swing-7:player-1',
      sourceId: 'player-2',
      targetId: 'player-1',
      damageKind: 'physical',
      baseDamage: 20,
      knockback: { x: 2, y: 1, z: 0 },
      sourceHitstopFrames: 2,
      targetHitstopFrames: 3,
      invulnerabilityFrames: 8,
    }],
  },
  { frame, tickRateHz: 60, math },
)

if (projectCombatant(result.slice).canAct) {
  // Step the owning movement/weapon module.
}
```

Resistance uses a fixed permille scale of `COMBAT_RESISTANCE_SCALE === 1000`.
New hitstop and invulnerability timers do not decrement on their landing frame.

The caller performs two follow-up steps. Read both values from the
`damage-applied` events that `stepCombatant` returns.

```ts
const impulses: { x: number; y: number; z: number }[] = []
let sourceHitstopFrames = 0
for (const record of result.events) {
  if (record.payload.kind !== 'damage-applied') continue
  impulses.push(record.payload.hit.knockback)
  sourceHitstopFrames = Math.max(
    sourceHitstopFrames,
    record.payload.hit.sourceHitstopFrames,
  )
}

const sourceSlice = createCombatantSlice({
  id: 'player-2',
  health: 100,
  maxHealth: 100,
})
const nextSource = stepCombatant(
  sourceSlice,
  { hits: [], applyHitstopFrames: sourceHitstopFrames },
  { frame: frame + 1, tickRateHz: 60, math },
)
```

`CombatantInput.applyHitstopFrames` is the named field for the second step. The
combat module has no API for the first step. No Syncplay function applies
`knockback`. Add the vector to your own character controller's velocity or
position outside this module.

## Melee and projectiles

Melee inputs contain stable attack IDs, source IDs, active-frame bounds, origin,
facing in deterministic turns, vertical limits, and the hit payload. Hurtboxes
are explicit context and are normalized before resolution.

Travelling projectiles use explicit position, velocity, radius, lifetime, hit
payload, and a deterministic physics world. `bodyOwners` maps a shape-cast body
ID to the combat target ID.

Hitscan inputs contain the existing lag-compensated shot and immutable
authoritative context. Targets, occluders, accepted frame, server frame, history
window, and latency ceiling stay visible to the existing validator. Rejection
events preserve its reason rather than inventing a fallback hit.

## Public surface

The entrypoint exports these functions and constants:

- `createCombatantSlice`, `stepCombatant`, `projectCombatant`,
  `combatantCanAct`;
- `createMeleeCombatSlice`, `stepMeleeCombat`, `projectMeleeCombat`;
- `createProjectileCombatSlice`, `stepProjectileCombat`,
  `projectProjectileCombat`;
- `combatantComponent`, `meleeCombatComponent`, `projectileCombatComponent`;
- `COMBAT_RESISTANCE_SCALE`, `combatModuleApiStability`.

`combatantComponent` steps through `stepCombatant`. `meleeCombatComponent`
steps through `stepMeleeCombat`. `projectileCombatComponent` steps through
`stepProjectileCombat`.

## Stable errors

- `SYNCPLAY_COMBAT_INPUT_INVALID`
- `SYNCPLAY_COMBAT_CONTEXT_INVALID`
- `SYNCPLAY_COMBAT_SLICE_INVALID`
- `SYNCPLAY_COMBAT_DUPLICATE_ID`

Malformed input, context, or hydrated state fails before an output slice or
event list is returned. Random spread, critical hits, and loot must arrive as
explicit synchronized authority input; the combat module owns no random stream.
