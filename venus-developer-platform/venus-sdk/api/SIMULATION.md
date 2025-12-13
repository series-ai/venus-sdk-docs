# Venus Simulation API

Drive authoritative game state through the Venus simulation system. Execute recipes, manage inventories and slots, and resolve dynamic fields directly from the platform.

> ⚠️ The Simulation API only runs inside the Venus host environment. Mock/test harnesses throw helpful errors when these methods are called locally.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

const state = await VenusAPI.simulation.getStateAsync()
const config = await VenusAPI.simulation.getConfigAsync()
```

## State Management

```typescript
const personalState = await VenusAPI.simulation.getStateAsync()
const roomState = await VenusAPI.simulation.getStateAsync('room_123')

const config = await VenusAPI.simulation.getConfigAsync()
// { version, entities, recipes }
```

`getStateAsync` returns inventory quantities, active recipe runs, and disabled recipes. Pass a `roomId` to inspect shared rooms; omit it for personal state.

## Recipe Execution

```typescript
// Server-authoritative action
const craft = await VenusAPI.simulation.executeRecipeAsync('craft_sword', {
  materials: ['iron', 'wood'],
})

// Entity-scoped recipe
const upgrade = await VenusAPI.simulation.executeScopedRecipeAsync(
  'upgrade_weapon',
  'sword_123',
  { level: 5 },
)

// Track and collect runs
const runs = await VenusAPI.simulation.getActiveRunsAsync()
const collected = await VenusAPI.simulation.collectRecipeAsync(runs[0].id)

// Trigger chained behaviour
await VenusAPI.simulation.triggerRecipeChainAsync('battle_complete')
```

## Recipe Requirements & Availability

```typescript
const requirements = await VenusAPI.simulation.getRecipeRequirementsAsync(
  'craft_sword',
  'player',
  1,
)
// { recipeId, entity, inputs, canAfford, disabled }

const batch = await VenusAPI.simulation.getBatchRecipeRequirementsAsync([
  { recipeId: 'craft_sword', batchAmount: 1 },
  { recipeId: 'craft_shield', batchAmount: 2 },
])

const available = await VenusAPI.simulation.getAvailableRecipesAsync({
  roomId: 'room_123',
  includeActorRecipes: true,
})
```

Use these helpers to pre-flight UI, disable unaffordable buttons, or build crafting browsers without guessing requirements.

## Slot Management

```typescript
const containers = await VenusAPI.simulation.getSlotContainersAsync()
const assignments = await VenusAPI.simulation.getSlotAssignmentsAsync('party_formation')

await VenusAPI.simulation.assignItemToSlotAsync('party_formation', 'leader', 'hero_knight')
await VenusAPI.simulation.removeItemFromSlotAsync('party_formation', 'leader')

const available = await VenusAPI.simulation.getAvailableItemsAsync('party_formation', 'leader')
const preview = await VenusAPI.simulation.calculatePowerPreviewAsync(
  'party_formation',
  'leader',
  available[0].id,
)

await VenusAPI.simulation.executeBatchOperationsAsync(
  [
    { type: 'assign', containerId: 'party_formation', slotId: 'leader', itemId: 'hero_knight' },
    { type: 'remove', containerId: 'party_formation', slotId: 'support' },
  ],
  false, // validateOnly?
)
```

## Field Resolution & Metadata

```typescript
const power = await VenusAPI.simulation.resolveFieldValueAsync(
  'player_123',
  'stats.power',
  'player',
)

const metadata = await VenusAPI.simulation.getEntityMetadataAsync('sword_123')
```

Use field resolution for derived stats (power, crit chance, etc.) and metadata lookups for UI tooltips or detail panes.

## Real-Time Subscriptions (BETA)

```typescript
const unsubscribe = await VenusAPI.simulation.subscribeAsync({
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

## Best Practices

- Batch operations with `executeBatchOperationsAsync` when you need atomic updates.
- Use simulation results as the source of truth—mirror UI state from responses rather than guessing.
- Guard recipe calls with optimistic UI but reconcile against the final data returned by the host.

