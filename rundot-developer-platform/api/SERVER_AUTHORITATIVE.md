# Server-Authoritative API (BETA)

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

## Best Practices

- Batch operations with `executeBatchOperationsAsync` when you need atomic updates.
- Use simulation results as the source of truth—mirror UI state from responses rather than guessing.
- Guard recipe calls with optimistic UI but reconcile against the final data returned by the host.
