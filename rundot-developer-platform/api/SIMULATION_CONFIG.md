# Simulation: Config Reference (BETA)

Define your game's server-authoritative state, actions, and randomized rewards entirely through JSON configuration. This reference covers the full config schema — entities, recipes, loot tables, and lifecycle hooks.

> This page is the config-authoring companion to the [Simulation API](SERVER_AUTHORITATIVE.md), which documents the client SDK methods. If you're looking for a specific pattern (energy systems, gacha, timers), see the recipe docs first — they include complete configs inline.

***

## Project Setup

Simulation config is uploaded to the server when you `rundot deploy`. There are two ways to organize it:

### Option A: Single `config.json` File (Simple Games)

For games with a small amount of simulation config, add a `simulation` key to your project's `config.json` file:

```
my-game/
├── config.json                      ← simulation config goes here
├── src/
├── dist/
├── game.config.{env}.json                 ← game ID + build settings (separate file)
└── package.json
```

```json
{
  "simulation": {
    "entities": { ... },
    "recipes": { ... },
    "lootTables": { ... }
  }
}
```

This is the same `config.json` used for `leaderboard` and `rooms` config. You can combine them in one file.

### Option B: `config/` Directory (Complex Games)

For games with many entities and recipes, split config across multiple files in a `config/` directory:

```
my-game/
├── config/                          ← simulation config split across files
│   ├── energy-system.config.json
│   ├── boosters.config.json
│   ├── store.config.json
│   └── player-initialization.config.json
├── src/
├── dist/
├── game.config.{env}.json                 ← game ID + build settings (separate file)
└── package.json
```

Each file must have a top-level `"simulation"` key:

```json
{
  "simulation": {
    "entities": { ... },
    "recipes": { ... }
  }
}
```

The CLI deep-merges all `*.config.json` files into a single simulation config at deploy time. One file per domain is a good pattern.

### Important

- **`config.json`** and **`config/`** are for server config (simulation, leaderboard, rooms, etc.)
- **`game.config.{env}.json`** is a separate file for local CLI metadata only (`gameId`, `relativePathToDistFolder`, `usesPreloader`) — simulation config does not go there

***

## Config Structure

Each config file's `simulation` object can contain any combination of these top-level keys:

```json
{
  "simulation": {
    "lifecycle": { ... },
    "entities": { ... },
    "recipes": { ... },
    "lootTables": { ... }
  }
}
```

Files are merged by key — if two files both define `entities`, their entities are combined. If two files define the same entity ID, the last file wins.

***

## Entities

Entities are the atomic units of game state. Each entity tracks a numeric quantity per player (e.g., `gold: 150`, `energy_current: 12`, `building_barracks: 3`).

```json
{
  "simulation": {
    "entities": {
      "currency_coins": {
        "tags": ["currency"],
        "stackable": true,
        "clientViewable": true,
        "metadata": {
          "displayName": "Coins",
          "iconComponent": "coin",
          "color": "#FFD700"
        }
      },
      "energy_current": {
        "tags": ["resource", "energy"],
        "stackable": true,
        "clientViewable": true,
        "metadata": {
          "displayName": "Energy",
          "description": "Used to start battles. Regenerates over time.",
          "maxAmount": 20,
          "regenIntervalMs": 600000
        }
      }
    }
  }
}
```

### Entity Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `tags` | `string[]` | No | Categorize entities for filtering, subscriptions, and loot table lookups. Use any string. |
| `stackable` | `boolean` | No | Whether quantity can exceed 1. Default `true`. |
| `clientViewable` | `boolean` | No | Whether the client can read this entity's quantity via `getStateAsync` and subscriptions. Default `false`. |
| `neverConsumable` | `boolean` | No | If `true`, recipe inputs can check this entity but never deduct from it. Useful for cumulative counters and permanent unlocks. |
| `requiresManualCollection` | `boolean` | No | If `true`, timed recipe outputs for this entity require explicit collection via `collectRecipeAsync`. |
| `metadata` | `object` | No | Arbitrary key-value data readable by both config formulas and client code. Store display names, icons, costs, thresholds — anything your game needs. |

### Tagging Patterns

Tags enable powerful filtering throughout the system:

```json
"unit_orc_warrior": {
  "tags": ["unit", "collectible", "rarity:common", "faction:orcs"],
  "stackable": true,
  "clientViewable": true
}
```

- **Client subscriptions** filter by tags: `subscribeAsync({ tags: ['currency'] })`
- **Loot tables** select entities by tag: `"includeTags": ["unit", "rarity:epic"]`
- **Recipes** can be tagged for client discovery

***

## Recipes

Recipes are server-authoritative actions. They consume inputs, produce outputs, and optionally run effects. Every game action — spending currency, opening packs, upgrading items, regenerating energy — is a recipe.

### Instant Recipe

Executes immediately. Duration is `0`.

```json
{
  "battle_start": {
    "duration": 0,
    "scope": "player",
    "clientViewable": true,
    "inputs": {
      "energy_current": 5
    },
    "outputs": {
      "battle_pending": 1
    },
    "metadata": {
      "displayName": "Start Battle"
    }
  }
}
```

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

await RundotGameAPI.simulation.executeRecipeAsync('battle_start')
```

### Timed Recipe

Has a non-zero `duration` (milliseconds). Creates an active run that must complete before outputs are granted.

```json
{
  "upgrade_barracks": {
    "duration": 300000,
    "scope": "player",
    "clientViewable": true,
    "concurrency": "global:building_upgrade",
    "onConflict": "fail",
    "inputs": {
      "currency_bricks": 200
    },
    "outputs": {
      "building_barracks": 1
    }
  }
}
```

```typescript
const result = await RundotGameAPI.simulation.executeRecipeAsync('upgrade_barracks')
// result.runId — track progress via activeRuns subscription

const runs = await RundotGameAPI.simulation.getActiveRunsAsync()
// When run completes, collect outputs:
await RundotGameAPI.simulation.collectRecipeAsync(runs[0].id)
```

### Auto-Restart Recipe

A timed recipe that automatically re-executes after completing. Ideal for regeneration timers and passive production.

```json
{
  "energy_regeneration": {
    "duration": 600000,
    "autoRestart": true,
    "concurrency": "single",
    "onConflict": "fail",
    "maxOfflineExecutionPeriod": 604800000,
    "inputs": {},
    "outputs": {
      "energy_current": 1
    },
    "maxRestartCondition": {
      "entity": "energy_current",
      "maxValue": 20
    },
    "clientViewable": true,
    "scope": "player"
  }
}
```

### Entity-Scoped Recipe

A single recipe definition that operates on different entities at runtime. Uses `{{entity}}` as a placeholder resolved when the recipe is executed.

```json
{
  "upgrade_card": {
    "duration": 0,
    "scope": "player",
    "clientViewable": true,
    "inputs": {
      "currency_coins": {
        "formula": "round(2000 * 1.12 ^ max(0, level - 1) / 10) * 10",
        "variables": {
          "level": { "inventory": "{{entity}}_level" }
        }
      }
    },
    "outputs": {
      "{{entity}}_level": 1
    }
  }
}
```

```typescript
await RundotGameAPI.simulation.executeScopedRecipeAsync(
  'upgrade_card',
  'unit_orc_warrior'
)
```

At execution time, `{{entity}}` resolves to `unit_orc_warrior`, so the recipe reads `unit_orc_warrior_level` and increments it.

### Recipe Fields

| Field | Type | Description |
|---|---|---|
| `duration` | `number \| formula` | Milliseconds. `0` for instant. Supports formulas for dynamic durations. |
| `scope` | `"player"` | Execution scope. Currently `"player"` for all single-player recipes. |
| `clientViewable` | `boolean` | Whether the client can see this recipe in config and requirements checks. |
| `inputs` | `object` | Entities consumed when the recipe executes. See [Inputs](#inputs). |
| `outputs` | `object` | Entities produced. For loot, use `rolls`. See [Outputs](#outputs). |
| `guards` | `object` | Preconditions that must pass before execution. See [Guards](#guards). |
| `beginEffects` | `array` | Side effects that run when the recipe starts. See [Effects](#effects). |
| `endEffects` | `array` | Side effects that run when a timed recipe completes. |
| `autoRestart` | `boolean` | Re-execute automatically after completion. |
| `concurrency` | `string` | Controls parallel execution. See [Concurrency](#concurrency). |
| `onConflict` | `"fail"` | What to do when concurrency is violated. |
| `maxRestartCondition` | `object` | Stop auto-restart when entity reaches a threshold. |
| `maxOfflineExecutionPeriod` | `number` | Max milliseconds of offline catch-up for auto-restart recipes. |
| `tags` | `string[]` | Categorize recipes for client-side filtering. |
| `metadata` | `object` | Arbitrary data. Use `hidden: true` to suppress from UI. |
| `trigger` | `object` | Auto-execute when watched entities change. See [Triggers](#triggers). |

***

## Inputs

Recipe inputs define what is consumed when the recipe runs.

### Fixed Amount

```json
"inputs": {
  "energy_current": 5
}
```

### Formula-Based

```json
"inputs": {
  "currency_coins": {
    "formula": "floor(baseCost * costMultiplier ^ level)",
    "variables": {
      "baseCost": { "entity": "{{entity}}", "field": "metadata.baseCost" },
      "costMultiplier": { "entity": "{{entity}}", "field": "metadata.costMultiplier" },
      "level": { "inventory": "{{entity}}" }
    }
  }
}
```

### Wallet (Premium Currency)

```json
"inputs": {
  "wallet": {
    "amount": 10,
    "walletCurrency": "premiumCurrency"
  }
}
```

For dynamic wallet amounts passed at runtime:

```json
"inputs": {
  "wallet": {
    "param": "walletAmount",
    "walletCurrency": "premiumCurrency"
  }
}
```

### Max Guard on Input

Limits how many times an entity can be incremented (useful for one-time or limited purchases):

```json
"inputs": {
  "starter_pack_purchased": { "max": 1 },
  "wallet": { "amount": 10, "walletCurrency": "premiumCurrency" }
}
```

***

## Outputs

### Fixed Amount

```json
"outputs": {
  "currency_coins": 500,
  "pack_common": 1
}
```

### Formula-Based

```json
"outputs": {
  "currency_bricks": {
    "formula": "min(entities.pending_bricks, entities.brick_storage_max - entities.currency_bricks)"
  }
}
```

### Loot Rolls

For randomized rewards, outputs can contain `rolls` that reference loot tables:

```json
"outputs": {
  "rolls": [
    {
      "table": "common_pack_cards",
      "count": { "min": 3, "max": 5 },
      "guarantees": [
        { "tag": "rarity:rare", "minCount": 1 }
      ],
      "pity": {
        "counterEntity": "pity_counter_mid",
        "threshold": 10,
        "guaranteedTag": "rarity:epic",
        "resetOnHit": true
      }
    },
    {
      "table": "common_pack_coins",
      "count": 1
    }
  ]
}
```

| Roll Field | Type | Description |
|---|---|---|
| `table` | `string` | Loot table ID to roll from. |
| `count` | `number \| { min, max }` | How many times to roll. Fixed or random range. |
| `guarantees` | `array` | Minimum counts by tag (e.g., guarantee at least 1 rare). |
| `pity` | `object` | Pity system: increment a counter each roll, guarantee a tag when threshold is hit. |

***

## Guards

Guards are preconditions checked before a recipe can execute. If any guard fails, the recipe is rejected.

```json
"guards": {
  "hasPending": {
    "formula": "entities.battle_pending >= 1"
  },
  "notCleared": {
    "formula": "entities.campaign_humans_cleared == 0"
  }
}
```

Guard formulas have access to `entities.*` for current inventory values.

***

## Effects

Effects are side actions that run alongside a recipe. `beginEffects` fire when the recipe starts; `endEffects` fire when a timed recipe completes.

### `set` — Set Entity to Value

```json
{ "type": "set", "entity": "energy_current", "value": 20 }
```

### `add` — Add to Entity

```json
{ "type": "add", "entity": "currency_coins", "value": 500 }
```

Value can be a formula:

```json
{
  "type": "add",
  "entity": "currency_coins",
  "value": {
    "entity": "{{entity}}",
    "field": "metadata.repeatCoinReward",
    "fallback": 0
  }
}
```

### `trigger_recipe` — Execute Another Recipe

```json
{ "type": "trigger_recipe", "selector": "energy_regeneration" }
```

### `trigger_recipes_parallel` — Execute Multiple Recipes

```json
{
  "type": "trigger_recipes_parallel",
  "continueOnError": true,
  "selectors": [
    "energy_regeneration",
    "brick_generation",
    "coin_generation"
  ]
}
```

### `disable_recipe` — Prevent Future Execution

```json
{ "type": "disable_recipe", "selector": "initial_player_state" }
```

### `assign_to_slot` — Assign Item to Slot Container

```json
{
  "type": "assign_to_slot",
  "container": "deck_1",
  "slot": "unit_1",
  "item": "unit_human_swordman"
}
```

### `send_notification` — Push Notification

See [Server-Authoritative API — Push Notifications](SERVER_AUTHORITATIVE.md#push-notifications) for full details.

```json
{
  "type": "send_notification",
  "recipientProfileId": "{{inputs.targetId}}",
  "title": "Battle Challenge!",
  "body": "A player has challenged you!"
}
```

***

## Concurrency

Controls how many instances of a recipe can run simultaneously.

| Value | Behavior |
|---|---|
| `"single"` | Only one instance at a time. New executions fail if one is active. |
| `"global:<key>"` | Only one recipe with this key can run at a time across all recipes sharing the key. |
| `"cooldown:<key>"` | After completing, the recipe cannot be re-executed until the cooldown expires. |

Always pair with `"onConflict": "fail"` so the client gets a clear rejection.

```json
{
  "upgrade_building": {
    "concurrency": "global:building_upgrade",
    "onConflict": "fail",
    "duration": 300000
  }
}
```

This means only one building can be upgrading at a time — starting a second upgrade fails.

***

## Auto-Restart & Offline Catch-Up

For recipes that repeat on a timer (energy regen, resource production):

```json
{
  "energy_regeneration": {
    "duration": 600000,
    "autoRestart": true,
    "concurrency": "single",
    "onConflict": "fail",
    "maxOfflineExecutionPeriod": 604800000,
    "inputs": {},
    "outputs": { "energy_current": 1 },
    "maxRestartCondition": {
      "entity": "energy_current",
      "maxValue": 20
    }
  }
}
```

| Field | Description |
|---|---|
| `autoRestart` | Re-execute immediately after each completion. |
| `maxRestartCondition.entity` | Entity to check before restarting. |
| `maxRestartCondition.maxValue` | Stop restarting when entity reaches this value. Also accepts `maxValueFormula`. |
| `maxOfflineExecutionPeriod` | Maximum milliseconds of offline time to catch up. `604800000` = 7 days. |

When a player returns after being offline, the server calculates how many cycles would have completed and grants the accumulated outputs (capped by `maxRestartCondition`).

***

## Triggers

Triggers automatically execute a recipe when watched entities change:

```json
{
  "upgrade_brick_storage_capacity": {
    "duration": 0,
    "trigger": {
      "formula": "true",
      "watchEntities": ["building_brick_storage", "building_town_hall"]
    },
    "inputs": {},
    "outputs": {
      "brick_storage_max": {
        "formula": "(500 + (entities.building_brick_storage * 500) + (entities.building_town_hall * 500)) - entities.brick_storage_max"
      }
    },
    "clientViewable": false,
    "scope": "player"
  }
}
```

The recipe auto-fires whenever `building_brick_storage` or `building_town_hall` changes. Use this for derived stats that should recalculate when their dependencies change.

***

## Formulas

Many recipe fields accept formula expressions instead of fixed values.

### Syntax

Formulas are JavaScript-like expressions evaluated server-side:

```
"formula": "floor(baseCost * costMultiplier ^ level)"
```

### Available Functions

`floor`, `ceil`, `round`, `min`, `max`, `abs`

### Variables

Formulas can reference variables defined in a `variables` block:

```json
{
  "formula": "baseCost * costMultiplier ^ level",
  "variables": {
    "baseCost": { "entity": "{{entity}}", "field": "metadata.baseCost" },
    "costMultiplier": { "entity": "{{entity}}", "field": "metadata.costMultiplier" },
    "level": { "inventory": "{{entity}}" }
  }
}
```

| Variable Source | Syntax | Resolves To |
|---|---|---|
| Entity metadata field | `{ "entity": "building_barracks", "field": "metadata.baseCost" }` | Value from entity's metadata |
| Current inventory | `{ "inventory": "energy_current" }` | Player's current quantity |
| Inline entities | `entities.energy_current` | Same as inventory, used directly in formula strings |

### Template Variables

Available in entity-scoped recipes:

| Variable | Description |
|---|---|
| `{{entity}}` | The entity ID passed at execution time |
| `{{profileId}}` / `{{executorId}}` | Player who triggered the recipe |
| `{{roomId}}` | Current room ID (room-scoped recipes) |
| `{{inputs.<key>}}` | Recipe input values |
| `{{results.<key>}}` | Results from earlier effects |
| `{{entities.<id>}}` | Current inventory quantity |
| `{{now}}` | Current timestamp (ms) |
| `{{metadata.<field>}}` | Entity metadata (of the scoped entity) |

***

## Loot Tables

Loot tables define randomized reward pools.

### Weighted Table

Each entry has an explicit weight. Higher weight = more likely.

```json
{
  "faction_orcs_pack": {
    "type": "weighted",
    "entries": [
      { "weight": 25, "outcomes": [{ "entityId": "unit_orc_goblin", "quantity": 1 }] },
      { "weight": 20, "outcomes": [{ "entityId": "unit_orc_warrior", "quantity": 1 }] },
      { "weight": 10, "outcomes": [{ "entityId": "unit_orc_berserker", "quantity": 1 }] }
    ],
    "newItemBias": {
      "enabled": true,
      "biasMultiplier": 3.0
    }
  }
}
```

### Uniform (Tag-Filtered) Table

Dynamically selects from all entities matching tag filters. No explicit entries needed.

```json
{
  "common_units": {
    "type": "uniform",
    "filter": {
      "includeTags": ["unit", "collectible", "rarity:common"],
      "entityGuards": [
        { "entity": "{{metadata.unlockRequirement}}", "min": 1 }
      ]
    },
    "newItemBias": {
      "enabled": true,
      "biasMultiplier": 2.0
    }
  }
}
```

### Guaranteed Table

Fixed drops — always grants the specified items.

```json
{
  "common_pack_coins": {
    "type": "guaranteed",
    "entries": [
      { "entityId": "currency_coins", "quantity": { "min": 100, "max": 300 } }
    ]
  }
}
```

### Table Chaining

Weighted entries can reference other tables via `tableRef` instead of defining outcomes inline:

```json
{
  "common_pack_cards": {
    "type": "weighted",
    "entries": [
      { "tableRef": "common_units", "weight": 75 },
      { "tableRef": "rare_units", "weight": 20 },
      { "tableRef": "epic_units", "weight": 4.5 },
      { "tableRef": "legendary_units", "weight": 0.5 }
    ]
  }
}
```

### Loot Table Options

| Field | Type | Description |
|---|---|---|
| `type` | `"weighted" \| "uniform" \| "guaranteed"` | How entries are selected. |
| `entries` | `array` | Items, weights, and outcomes (weighted/guaranteed) or omitted (uniform). |
| `filter` | `object` | Tag-based entity selection (uniform tables). |
| `filter.includeTags` | `string[]` | Entity must have ALL of these tags. |
| `filter.entityGuards` | `array` | Additional per-entity checks. |
| `newItemBias` | `object` | Increase probability of items the player hasn't collected yet. |
| `newItemBias.biasMultiplier` | `number` | Multiplier applied to unowned items (e.g., `2.0` = 2x more likely). |
| `wildcardConversion` | `object` | Chance to convert drops into wildcard entities by rarity tag. |

### Wildcard Conversion

A percentage chance to replace a rolled item with a wildcard entity:

```json
"wildcardConversion": {
  "enabled": true,
  "rates": {
    "rarity:common": 0.02,
    "rarity:rare": 0.03,
    "rarity:epic": 0.04,
    "rarity:legendary": 0.05
  },
  "wildcardEntities": {
    "rarity:common": "wildcard_common",
    "rarity:rare": "wildcard_rare",
    "rarity:epic": "wildcard_epic",
    "rarity:legendary": "wildcard_legendary"
  }
}
```

***

## Lifecycle

The `lifecycle` block defines hooks that run at specific points in a player's lifecycle.

### `onStart`

Runs once when a new player first opens the game. Use it to set up initial state.

```json
{
  "simulation": {
    "lifecycle": {
      "onStart": "initial_player_state"
    },
    "recipes": {
      "initial_player_state": {
        "duration": 0,
        "inputs": {},
        "outputs": {},
        "beginEffects": [
          { "type": "disable_recipe", "selector": "initial_player_state" },
          { "type": "set", "entity": "energy_current", "value": 20 },
          { "type": "set", "entity": "currency_coins", "value": 500 },
          {
            "type": "assign_to_slot",
            "container": "deck_1",
            "slot": "unit_1",
            "item": "unit_human_swordman"
          },
          { "type": "trigger_recipe", "selector": "start_recurring_timers" }
        ],
        "scope": "player"
      }
    }
  }
}
```

Key pattern: the `onStart` recipe disables itself (`disable_recipe`) to prevent re-execution, sets initial entity values, assigns starting items to slots, and triggers recurring timers.

***

## Best Practices

- Split config across multiple files by domain (e.g., `energy-system.config.json`, `boosters.config.json`). The platform merges them.
- Use `tags` liberally — they power subscriptions, loot table filters, and client-side discovery.
- Set `clientViewable: true` only on entities and recipes the client needs. Keep internal state hidden.
- Use `metadata` for display data and formula variables. It's free-form and available everywhere.
- Use `formula` expressions for scaling costs and dynamic outputs rather than creating separate recipes per level.
- Use entity-scoped recipes (`{{entity}}`) to avoid duplicating recipes for every item/building/card.
- Always `disable_recipe` on initialization recipes to prevent accidental re-execution.
- Set `maxOfflineExecutionPeriod` on auto-restart recipes to prevent unbounded offline accumulation.
- Use `maxRestartCondition` to cap regeneration (e.g., stop energy regen at max energy).
