# Simulation: Building Timers (BETA)

Add timed actions to your game — building upgrades, crafting, research, or any action that takes real time to complete. Includes build queues (one upgrade at a time), passive resource generation, and collecting completed results.

> This is a self-contained recipe. Everything you need — config, client code, and patterns — is on this page.

***

## Where Config Goes

All JSON config on this page goes in your project's server config — either a single `config.json` file or split across files in a `config/` directory. Each file must have a top-level `"simulation"` key. The CLI uploads config automatically when you `rundot deploy`.

```
my-game/
├── config.json                      ← option A: all-in-one (add "simulation" key)
├── config/                          ← option B: split files for complex games
│   └── buildings.config.json
├── game.config.{env}.json                 ← game ID + build settings only (separate)
└── package.json
```

> `game.config.{env}.json` is for CLI metadata only. Simulation config goes in `config.json` or the `config/` directory.

***

## What You'll Build

- Buildings that take real time to upgrade (e.g., 5 minutes, scaling with level)
- A build queue that limits players to one upgrade at a time
- Passive resource generators (produce bricks/coins over time)
- Collecting accumulated resources from generators
- Countdown timers in the client UI

***

## Server Configuration

### Building Entities

Each building is an entity. Its quantity represents its level.

```json
{
  "simulation": {
    "entities": {
      "building_barracks": {
        "tags": ["building", "hq"],
        "clientViewable": true,
        "stackable": true,
        "requiresManualCollection": true,
        "metadata": {
          "displayName": "Barracks",
          "description": "Unlocks new unit types.",
          "baseCost": 100,
          "costMultiplier": 1.6,
          "maxLevel": 10,
          "baseDuration": 180000
        }
      },
      "building_quarry": {
        "tags": ["building", "hq", "generator"],
        "clientViewable": true,
        "stackable": true,
        "requiresManualCollection": true,
        "metadata": {
          "displayName": "Stone Quarry",
          "description": "Produces stone bricks over time.",
          "baseCost": 150,
          "costMultiplier": 1.6,
          "baseDuration": 120000
        }
      },
      "building_vault": {
        "tags": ["building", "hq", "storage"],
        "clientViewable": true,
        "stackable": true,
        "requiresManualCollection": true,
        "metadata": {
          "displayName": "Vault",
          "description": "Increases maximum coin storage.",
          "baseCost": 100,
          "costMultiplier": 1.6,
          "baseDuration": 120000
        }
      }
    }
  }
}
```

Key fields:
- **`stackable: true`** — quantity represents the building's level
- **`requiresManualCollection: true`** — timed recipe outputs are held until the player explicitly collects
- **`metadata.baseCost` / `costMultiplier`** — used in formula-based input costs
- **`metadata.baseDuration`** — used in formula-based recipe duration

### Building Upgrade Recipe (Entity-Scoped)

A single recipe handles all building upgrades. `{{entity}}` resolves to the specific building at execution time.

```json
{
  "simulation": {
    "recipes": {
      "upgrade_building": {
        "tags": ["building_upgrade"],
        "scope": "player",
        "clientViewable": true,
        "concurrency": "global:building_upgrade",
        "onConflict": "fail",
        "guards": {
          "alreadyConstructed": {
            "formula": "entities.{{entity}} >= 1"
          }
        },
        "duration": {
          "formula": "baseDuration + level * baseDuration",
          "variables": {
            "baseDuration": {
              "entity": "{{entity}}",
              "field": "metadata.baseDuration"
            },
            "level": {
              "inventory": "{{entity}}"
            }
          }
        },
        "inputs": {
          "currency_bricks": {
            "formula": "floor(baseCost * costMultiplier ^ level)",
            "variables": {
              "baseCost": {
                "entity": "{{entity}}",
                "field": "metadata.baseCost"
              },
              "costMultiplier": {
                "entity": "{{entity}}",
                "field": "metadata.costMultiplier"
              },
              "level": {
                "inventory": "{{entity}}"
              }
            }
          }
        },
        "outputs": {
          "{{entity}}": 1
        },
        "metadata": {
          "displayName": "Upgrade Building"
        }
      }
    }
  }
}
```

How this works:
- **`concurrency: "global:building_upgrade"`** — only one building upgrade can run at a time across all buildings. Starting a second upgrade fails.
- **`guards.alreadyConstructed`** — the building must exist (level ≥ 1) before it can be upgraded
- **`duration`** — scales with level: `baseDuration + level * baseDuration`. A building with `baseDuration: 180000` (3 min) at level 3 takes 3 + 3×3 = 12 minutes.
- **`inputs.currency_bricks`** — cost scales exponentially: `floor(100 * 1.6 ^ level)`
- **`outputs.{{entity}}: 1`** — increments the building's level by 1

### Resource Generation (Auto-Restart Timer)

A generator building produces resources on a repeating timer:

```json
{
  "simulation": {
    "entities": {
      "brick_generation_rate": {
        "tags": ["resource", "bricks", "rate"],
        "stackable": true,
        "clientViewable": true,
        "metadata": {
          "displayName": "Brick Generation Rate",
          "baseRate": 1,
          "ratePerLevel": 1
        }
      },
      "brick_storage_max": {
        "tags": ["resource", "bricks", "cap"],
        "stackable": true,
        "clientViewable": true,
        "metadata": {
          "displayName": "Brick Storage Capacity"
        }
      },
      "pending_bricks": {
        "tags": ["resource", "bricks", "pending"],
        "stackable": true,
        "clientViewable": true,
        "metadata": {
          "displayName": "Pending Bricks",
          "description": "Bricks waiting to be collected from the quarry."
        }
      }
    },
    "recipes": {
      "brick_generation": {
        "duration": 300000,
        "autoRestart": true,
        "concurrency": "single",
        "onConflict": "fail",
        "maxOfflineExecutionPeriod": 604800000,
        "inputs": {},
        "outputs": {
          "pending_bricks": {
            "formula": "entities.brick_generation_rate"
          }
        },
        "maxRestartCondition": {
          "entity": "pending_bricks",
          "maxValueFormula": "entities.brick_storage_max - entities.currency_bricks"
        },
        "metadata": {
          "displayName": "Brick Generation",
          "hidden": true
        },
        "clientViewable": true,
        "scope": "player"
      },
      "collect_bricks": {
        "duration": 0,
        "inputs": {},
        "outputs": {
          "currency_bricks": {
            "formula": "min(entities.pending_bricks, entities.brick_storage_max - entities.currency_bricks)"
          },
          "pending_bricks": {
            "formula": "-entities.pending_bricks"
          }
        },
        "metadata": {
          "displayName": "Collect Bricks"
        },
        "clientViewable": true,
        "scope": "player"
      }
    }
  }
}
```

Key pattern:
1. **`brick_generation`** auto-restarts every 5 minutes, producing bricks into `pending_bricks` based on the quarry's generation rate
2. **`maxRestartCondition`** with `maxValueFormula` stops generation when storage is full
3. **`collect_bricks`** is an instant recipe that transfers pending bricks to the player's currency (capped by storage)

### Auto-Recalculating Derived Stats (Triggers)

When a building is upgraded, recalculate dependent stats automatically:

```json
{
  "simulation": {
    "recipes": {
      "upgrade_brick_generation_rate": {
        "duration": 0,
        "trigger": {
          "formula": "true",
          "watchEntities": ["building_quarry"]
        },
        "inputs": {},
        "outputs": {
          "brick_generation_rate": {
            "formula": "(1 + entities.building_quarry) - entities.brick_generation_rate"
          }
        },
        "clientViewable": false,
        "scope": "player",
        "metadata": { "hidden": true }
      },
      "upgrade_brick_storage_capacity": {
        "duration": 0,
        "trigger": {
          "formula": "true",
          "watchEntities": ["building_vault", "building_town_hall"]
        },
        "inputs": {},
        "outputs": {
          "brick_storage_max": {
            "formula": "(500 + (entities.building_vault * 500) + (entities.building_town_hall * 500)) - entities.brick_storage_max"
          }
        },
        "clientViewable": false,
        "scope": "player",
        "metadata": { "hidden": true }
      }
    }
  }
}
```

These recipes fire automatically whenever the watched entity changes. The output formula computes the delta needed to reach the new correct value.

***

## Client-Side Implementation

### Step 1: Read Building State

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const state = await RundotGameAPI.simulation.getStateAsync()
const barracksLevel = state.entities['building_barracks'] ?? 0
const quarryLevel = state.entities['building_quarry'] ?? 0
```

### Step 2: Check Upgrade Cost and Availability

```typescript
const requirements = await RundotGameAPI.simulation.getRecipeRequirementsAsync(
  'upgrade_building',
  'building_barracks',  // entity scope
  1
)

// requirements.canAfford — does the player have enough bricks?
// requirements.inputs — the actual cost for this building at its current level
// requirements.disabled — is the recipe disabled?
```

### Step 3: Start an Upgrade

```typescript
async function startUpgrade(buildingId: string) {
  const result = await RundotGameAPI.simulation.executeScopedRecipeAsync(
    'upgrade_building',
    buildingId
  )

  if (!result.success) {
    if (result.message?.includes('concurrency')) {
      showError('Another building is already upgrading!')
    } else {
      showError(result.message ?? 'Upgrade failed')
    }
    return null
  }

  // result.runId — track this in-progress upgrade
  return result.runId
}
```

### Step 4: Track Active Upgrades and Show Countdown

```typescript
const unsubscribe = await RundotGameAPI.simulation.subscribeAsync({
  activeRuns: true,
  tags: ['building'],
  onUpdate(update) {
    if (update.type === 'activeRuns') {
      const upgradeRun = update.activeRuns.find(
        run => run.recipeId === 'upgrade_building'
      )
      if (upgradeRun) {
        const msRemaining = new Date(upgradeRun.expiresAt).getTime() - Date.now()
        showUpgradeProgress(upgradeRun.entity, msRemaining)
      } else {
        hideUpgradeProgress()
      }
    }
  },
})
```

### Step 5: Collect Completed Upgrades

When the timer finishes, the upgrade must be collected before the level increases:

```typescript
async function collectUpgrade(runId: string) {
  const result = await RundotGameAPI.simulation.collectRecipeAsync(runId)
  if (result.success) {
    showUpgradeComplete()
    // Building level has increased — refresh state
  }
}
```

You can also check for completed-but-uncollected runs on app launch:

```typescript
const runs = await RundotGameAPI.simulation.getActiveRunsAsync()
for (const run of runs) {
  const isComplete = new Date(run.expiresAt).getTime() <= Date.now()
  if (isComplete && run.recipeId === 'upgrade_building') {
    await RundotGameAPI.simulation.collectRecipeAsync(run.id)
  }
}
```

### Step 6: Collect Generated Resources

```typescript
async function collectBricks() {
  const state = await RundotGameAPI.simulation.getStateAsync()
  const pending = state.entities['pending_bricks'] ?? 0

  if (pending <= 0) {
    showMessage('Nothing to collect yet!')
    return
  }

  const result = await RundotGameAPI.simulation.executeRecipeAsync('collect_bricks')
  if (result.success) {
    showCollected(pending)
  }
}
```

***

## Cooldown Timers

For actions that can be performed once per time period (not building upgrades — more like "claim daily reward" or "free booster every 4 hours"):

```json
{
  "claim_daily_reward": {
    "duration": 86400000,
    "concurrency": "cooldown:daily_reward",
    "onConflict": "fail",
    "inputs": {},
    "beginEffects": [
      { "type": "add", "entity": "currency_coins", "value": 500 }
    ],
    "outputs": {},
    "clientViewable": true,
    "scope": "player"
  }
}
```

The reward is granted immediately via `beginEffects`. The recipe's 24-hour duration acts as a cooldown — attempting to execute again before it expires returns an error.

```typescript
const result = await RundotGameAPI.simulation.executeRecipeAsync('claim_daily_reward')

if (!result.success) {
  // Still on cooldown — show remaining time
  const runs = await RundotGameAPI.simulation.getActiveRunsAsync()
  const cooldown = runs.find(r => r.recipeId === 'claim_daily_reward')
  if (cooldown) {
    const msRemaining = new Date(cooldown.expiresAt).getTime() - Date.now()
    showCooldownTimer(msRemaining)
  }
}
```

***

## Common Variations

### Multiple Build Queues

Allow N simultaneous upgrades (e.g., 2 builder slots):

```json
{
  "upgrade_building": {
    "concurrency": "global:building_upgrade",
    "maxConcurrency": 2,
    "onConflict": "fail"
  }
}
```

### Instant Finish with Premium Currency

Let players skip the timer:

```json
{
  "speedup_building": {
    "duration": 0,
    "scope": "player",
    "clientViewable": true,
    "inputs": {
      "wallet": { "amount": 5, "walletCurrency": "premiumCurrency" }
    },
    "outputs": {},
    "metadata": {
      "displayName": "Speed Up Building"
    }
  }
}
```

### Level-Gated Buildings

Use guards to require a minimum town hall level before upgrading:

```json
{
  "upgrade_advanced_building": {
    "guards": {
      "townHallLevel": {
        "formula": "entities.building_town_hall >= 3"
      }
    }
  }
}
```

***

## Best Practices

- Use `concurrency: "global:<key>"` to enforce build queue limits across all building types.
- Use entity-scoped recipes (`{{entity}}`) with formulas for scaling costs and durations — one recipe handles all buildings.
- Store cost/duration parameters in entity `metadata` so formulas can read them dynamically.
- Use `trigger` recipes for derived stats so they auto-recalculate when dependencies change.
- Use `requiresManualCollection: true` on building entities so players see an upgrade-complete animation before the level updates.
- Separate pending and collected resources (e.g., `pending_bricks` vs `currency_bricks`) so players must interact with the generator to claim.
- Subscribe to `activeRuns` for countdown timers — don't calculate durations client-side.
- Check for uncollected completed runs on app launch to handle upgrades that finished while offline.
