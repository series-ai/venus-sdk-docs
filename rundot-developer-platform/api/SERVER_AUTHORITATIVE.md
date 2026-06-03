# Simulation API (BETA)

Drive authoritative game state through the RUN.game simulation system. Execute recipes, manage inventories and slots, and resolve dynamic fields directly from the platform.

> ⚠️ The Server-Authoritative API only runs inside the RUN.game host environment. Mock/test harnesses throw helpful errors when these methods are called locally.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const state = await RundotGameAPI.simulation.getStateAsync()
const config = await RundotGameAPI.simulation.getConfigAsync()
```

## State Management

```typescript
const personalState = await RundotGameAPI.simulation.getStateAsync()
const roomState = await RundotGameAPI.simulation.getStateAsync('room_123')

const config = await RundotGameAPI.simulation.getConfigAsync()
// { version, entities, recipes }
```

`getStateAsync` returns inventory quantities, active recipe runs, and disabled recipes. Pass a `roomId` to inspect shared rooms; omit it for personal state.

## Resetting State

```typescript
// Reset all simulation state (inventory, active runs, slot assignments)
const result = await RundotGameAPI.simulation.resetStateAsync()
// { success: true, clearedRuns: 3, clearedSlots: 2, recipeExecuted: null }

// Reset and re-initialize with a starter recipe
const result = await RundotGameAPI.simulation.resetStateAsync({
  initializeRecipe: 'starter_pack',
})
// { success: true, clearedRuns: 3, clearedSlots: 2, recipeExecuted: 'starter_pack' }
```

`resetStateAsync` clears all simulation state for the current player: inventory quantities are zeroed, active recipe runs are cancelled, and slot assignments are removed. Pass `initializeRecipe` to automatically execute a recipe after the reset — useful for granting a starter loadout or restoring default configuration.

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the reset completed successfully |
| `clearedRuns` | `number` | Number of active runs that were cancelled |
| `clearedSlots` | `number` | Number of slot assignments that were deleted |
| `recipeExecuted` | `string \| null` | Recipe executed after reset, if any |

## Recipe Execution

```typescript
// Server-authoritative action
const craft = await RundotGameAPI.simulation.executeRecipeAsync('craft_sword', {
  materials: ['iron', 'wood'],
})

// Entity-scoped recipe
const upgrade = await RundotGameAPI.simulation.executeScopedRecipeAsync(
  'upgrade_weapon',
  'sword_123',
  { level: 5 },
)

// Track and collect runs
const runs = await RundotGameAPI.simulation.getActiveRunsAsync()
const collected = await RundotGameAPI.simulation.collectRecipeAsync(runs[0].id)

// Trigger chained behaviour
await RundotGameAPI.simulation.triggerRecipeChainAsync('battle_complete')
```

## Recipe Requirements & Availability

```typescript
const requirements = await RundotGameAPI.simulation.getRecipeRequirementsAsync(
  'craft_sword',
  'player',
  1,
)
// { recipeId, entity, inputs, canAfford, disabled }

const batch = await RundotGameAPI.simulation.getBatchRecipeRequirementsAsync([
  { recipeId: 'craft_sword', batchAmount: 1 },
  { recipeId: 'craft_shield', batchAmount: 2 },
])

const available = await RundotGameAPI.simulation.getAvailableRecipesAsync({
  roomId: 'room_123',
  includeActorRecipes: true,
})
```

Use these helpers to pre-flight UI, disable unaffordable buttons, or build crafting browsers without guessing requirements.

## Slot Management

```typescript
const containers = await RundotGameAPI.simulation.getSlotContainersAsync()
const assignments = await RundotGameAPI.simulation.getSlotAssignmentsAsync('party_formation')

await RundotGameAPI.simulation.assignItemToSlotAsync('party_formation', 'leader', 'hero_knight')
await RundotGameAPI.simulation.removeItemFromSlotAsync('party_formation', 'leader')

const available = await RundotGameAPI.simulation.getAvailableItemsAsync('party_formation', 'leader')
const preview = await RundotGameAPI.simulation.calculatePowerPreviewAsync(
  'party_formation',
  'leader',
  available[0].id,
)

await RundotGameAPI.simulation.executeBatchOperationsAsync(
  [
    { type: 'assign', containerId: 'party_formation', slotId: 'leader', itemId: 'hero_knight' },
    { type: 'remove', containerId: 'party_formation', slotId: 'support' },
  ],
  false, // validateOnly?
)
```

## Field Resolution & Metadata

```typescript
const power = await RundotGameAPI.simulation.resolveFieldValueAsync(
  'player_123',
  'stats.power',
  'player',
)

const metadata = await RundotGameAPI.simulation.getEntityMetadataAsync('sword_123')
```

Use field resolution for derived stats (power, crit chance, etc.) and metadata lookups for UI tooltips or detail panes.

## Real-Time Subscriptions (BETA)

```typescript
const unsubscribe = await RundotGameAPI.simulation.subscribeAsync({
  entities: ['gold', 'energy'],
  tags: ['currency', 'contractor'],
  activeRuns: true,
  onUpdate(update) {
    switch (update.type) {
      case 'entity':
        update.entities.forEach(({ entityId, quantity }) => updateUI(entityId, quantity))
        break
      case 'activeRuns':
        updateTimers(update.activeRuns)
        break
      case 'snapshot':
        hydrateSnapshot(update.state)
        break
    }
  },
})

// Later
unsubscribe()
```

**Update types:** `entity`, `activeRuns`, `snapshot`.  
**Filters:** subscribe by `entities`, `tags`, `activeRuns`, and/or `roomId`.  
Only entities marked `clientViewable: true` in your simulation config are streamed to clients.

## Push Notifications

Recipes can send push notifications to any player using the `send_notification` effect.

### Example Recipe

```json
{
  "challenge_opponent": {
    "duration": 0,
    "inputs": { "targetId": { "type": "string" } },
    "beginEffects": [
      {
        "type": "send_notification",
        "recipientProfileId": "{{inputs.targetId}}",
        "title": "Battle Challenge!",
        "body": "A player has challenged you to battle!"
      }
    ]
  }
}
```

### Effect Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `"send_notification"` | Yes | Effect type |
| `recipientProfileId` | `string` | Yes | Profile ID of the recipient. Supports template substitution (e.g. `{{inputs.targetId}}`, `{{profileId}}`). |
| `title` | `string` | Yes | Notification title. Supports template substitution. |
| `body` | `string` | Yes | Notification body. Supports template substitution. |
| `payload` | `Record<string, string>` | No | Key-value pairs delivered to your game via `context.notificationParams` on launch. Values support template substitution. |
| `as` | `string` | No | Store the result in `{{results.<as>}}` for downstream effects. Returns `{ sent: true, recipientId }` or `{ sent: false, error }`. |

### Behavior

- `appId` is automatically set from the game's execution context — tapping the notification opens your game.
- `payload` entries are JSON-serialized and delivered as `context.notificationParams` when the recipient opens the game from the notification. Access them via `RundotAPI.context.notificationParams`.
- If `recipientProfileId` fails to resolve (e.g. missing input), the effect is skipped with a warning — it does not abort the recipe.
- Braze API failures are caught and logged; they do not abort recipe execution.
- The effect is awaited (not fire-and-forget), so `as` captures the result before downstream effects run. Note: Braze has a 10-second timeout that blocks the recipe chain if the API is slow.

### Template Variables

All standard recipe template variables are supported:

| Variable | Description |
|---|---|
| `{{profileId}}` / `{{executorId}}` | Profile ID of the player who triggered the recipe |
| `{{roomId}}` | Current room ID (if room-scoped) |
| `{{inputs.<key>}}` | Recipe input values |
| `{{results.<key>}}` | Results from earlier effects (via `as`) |
| `{{entities.<id>}}` | Current inventory quantity for an entity |
| `{{now}}` | Current timestamp (ms) |

## Response Fields

| Field | Type | When present | Description |
|---|---|---|---|
| `success` | `boolean` | Always | Whether the recipe executed successfully |
| `status` | `string` | Always | `'completed'`, `'running'`, `'queued'`, or `'awaiting_collection'` |
| `runId` | `string` | Always | Unique identifier for this recipe run |
| `outputs` | `Record<string, number>` | `completed`, `awaiting_collection` | Entity quantities produced |
| `randomSeed` | `string` | `completed`, `awaiting_collection` | Hex seed used for all seeded RNG in this run. Use to reproduce deterministic outcomes client-side. |
| `data.state` | `Record<string, unknown>` | `completed`, `awaiting_collection` | Effect results (values stored via `as` keys) |
| `expiresAt` | `string` | `running` | ISO timestamp when the run completes |
| `queuePosition` | `number` | `queued` | Position in the concurrency queue |

## UGC Effects

Recipes can read and mutate UGC entries owned by any player. These effects bridge to the Cloud Run UGC service from the simulation layer.

### `read_ugc`

Fetch a UGC entry's `data` object and store it in `effectResults` for use by downstream effects.

#### Example Recipe

```json
{
  "check_hero_stats": {
    "duration": 0,
    "inputs": {},
    "beginEffects": [
      {
        "type": "read_ugc",
        "entryId": "{{inputs.heroEntryId}}",
        "as": "hero"
      }
    ]
  }
}
```

After execution, `{{results.hero.power}}`, `{{results.hero.name}}`, etc. are available to subsequent effects and in `result.data.state.hero` on the client.

#### Effect Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `"read_ugc"` | Yes | Effect type |
| `entryId` | `string` | Yes | UGC entry ID. Supports template substitution. |
| `as` | `string` | Yes | Key in `effectResults` where `entry.data` is stored. |

### `mutate_ugc`

Update fields on a UGC entry's `data` object. Operates on any entry regardless of author — enables cross-player state like tip accrual or win counters.

#### Example Recipe (Cross-Player State)

```json
{
  "claim_hero": {
    "duration": 0,
    "inputs": {},
    "beginEffects": [
      {
        "type": "read_ugc",
        "entryId": "{{inputs.heroEntryId}}",
        "as": "hero"
      },
      {
        "type": "mutate_ugc",
        "entryId": "{{inputs.heroEntryId}}",
        "dataUpdates": {
          "lastUsedBy": "{{profileId}}",
          "lastUsedAt": "{{now}}"
        }
      }
    ]
  }
}
```

> Note: `dataUpdates` values are strings after template substitution. For atomic numeric increments, use the UGC HTTP API's `$increment` operator directly instead of the recipe effect.

#### Effect Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `"mutate_ugc"` | Yes | Effect type |
| `entryId` | `string` | Yes | UGC entry ID. Supports template substitution. |
| `dataUpdates` | `Record<string, string>` | Yes | Key-value pairs to update on `entry.data`. Values support template substitution. |

#### Behavior

- `read_ugc` stores only `entry.data` (the JSON payload), not the full entry envelope (id, authorId, etc.).
- `mutate_ugc` resolves templates in values before applying. Use `{{results.<as>.<field>}}` to reference data fetched by a prior `read_ugc`.
- Both effects are awaited — results are available before downstream effects run.

## Game Effects

### `matchmaking`

Server-side opponent search over `h5_rooms`. Fully documented in [Simulation: PVP System](PVP_SYSTEM.md) — see that page for params, filtering, and complete PVP integration examples.

Quick reference:

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `"matchmaking"` | Yes | Effect type |
| `params.roomType` | `string` | Yes | Room type to search |
| `params.count` | `number` | No | Max results (default: 5) |
| `params.filters` | `Record<string, any>` | No | Filter config (e.g. `minRating`, `maxRating`) |
| `as` | `string` | No | Key in `effectResults` for the match array |

### `resolve_battle`

Single-roll power comparison between attacker and defender. Evaluates power formulas, applies optional bonus modifiers and seeded random variance, then determines victory.

#### Example Recipe

```json
{
  "attack_player": {
    "duration": 0,
    "battleConfig": {
      "randomVariance": 0.1,
      "victoryCondition": "attacker > defender"
    },
    "endEffects": [
      {
        "type": "resolve_battle",
        "attackerPower": { "formula": "entities.attack_power" },
        "defenderPower": { "formula": "entities.defense_power" },
        "defenderProfileId": "{{inputs.target_id}}",
        "as": "battle"
      }
    ]
  }
}
```

#### Effect Properties

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `"resolve_battle"` | Yes | Effect type |
| `attackerPower` | `string \| number \| FormulaReference` | Yes | Attacker's power value or formula |
| `defenderPower` | `string \| number \| FormulaReference` | Yes | Defender's power value or formula |
| `defenderProfileId` | `string` | No | When provided, `defenderPower` is evaluated against this player's entities instead of the executor's. Supports template substitution. |
| `applyBonuses.attacker` | `string[]` | No | Bonus modifier keys for attacker |
| `applyBonuses.defender` | `string[]` | No | Bonus modifier keys for defender |
| `as` | `string` | No | Key in `effectResults` for battle outcome |

#### Behavior

- Power formulas are resolved against the executing player's inventory by default. When `defenderProfileId` is set, `defenderPower` evaluates against the defender's inventory (server-side lookup).
- `battleConfig.randomVariance` on the recipe applies seeded random variance to both powers. The variance is deterministic given the recipe's `randomSeed`.
- Victory is determined by `battleConfig.victoryCondition` (default: `"attacker > defender"`).
- Results (victory, rewards, final powers) are stored in `effectResults[as]` and returned in `result.data.state`.

## Best Practices

- Batch operations with `executeBatchOperationsAsync` when you need atomic updates.
- Use simulation results as the source of truth—mirror UI state from responses rather than guessing.
- Guard recipe calls with optimistic UI but reconcile against the final data returned by the host.
