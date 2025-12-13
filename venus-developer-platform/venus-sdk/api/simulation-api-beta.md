# Simulation API (BETA)

## Venus Simulation API

Drive authoritative game state through the Venus simulation system. Execute recipes, manage inventories and slots, and resolve dynamic fields directly from the platform.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const state = await VenusAPI.simulation.getStateAsync()
const config = await VenusAPI.simulation.getConfigAsync()
```

### Recipe Execution

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

// Time-based runs
const runs = await VenusAPI.simulation.getActiveRunsAsync()
```

### Slot Management

```typescript
const assignments = await VenusAPI.simulation.getSlotAssignmentsAsync('party_formation')

await VenusAPI.simulation.assignItemToSlotAsync('party_formation', 'leader', 'hero_knight')
await VenusAPI.simulation.removeItemFromSlotAsync('party_formation', 'leader')
```

### Field Resolution & Metadata

```typescript
const power = await VenusAPI.simulation.resolveFieldValueAsync('player_123', 'stats.power')
const metadata = await VenusAPI.simulation.getEntityMetadataAsync('sword_123')
```

### Best Practices

* Batch operations with `executeBatchOperationsAsync` when you need atomic updates.
* Use simulation results as the source of truth—mirror UI state from responses rather than guessing.
* Guard recipe calls with optimistic UI but reconcile against the final data returned by the host.
