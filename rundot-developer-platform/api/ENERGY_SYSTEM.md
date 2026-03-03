# Simulation: Energy System (BETA)

Add a regenerating energy/stamina system to your game. Players spend energy to take actions (start battles, enter dungeons) and it refills automatically over time — even while offline.

> This is a self-contained recipe. Everything you need — config, client code, and patterns — is on this page.

***

## What You'll Build

- Energy that regenerates 1 point every N minutes, up to a maximum
- Actions that cost energy (e.g., starting a battle costs 5 energy)
- Automatic offline catch-up (player returns after 2 hours → energy has regenerated)
- A cap so energy stops regenerating at max

***

## Server Configuration

### Entities

Define the energy state:

```json
{
  "simulation": {
    "entities": {
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
      },
      "energy_max": {
        "tags": ["resource", "energy", "cap"],
        "stackable": true,
        "clientViewable": true,
        "metadata": {
          "displayName": "Max Energy"
        }
      }
    }
  }
}
```

| Entity | Purpose |
|---|---|
| `energy_current` | The player's current energy. Consumed by actions, refilled by regen. |
| `energy_max` | Maximum energy capacity. Use this if max energy can increase (e.g., through upgrades). |

### Regeneration Recipe

This is the core of the energy system — a timed recipe that auto-restarts to produce 1 energy every cycle:

```json
{
  "simulation": {
    "recipes": {
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
        "metadata": {
          "displayName": "Energy Regeneration",
          "hidden": true
        },
        "clientViewable": true,
        "scope": "player"
      }
    }
  }
}
```

| Field | Value | Why |
|---|---|---|
| `duration` | `600000` | 10 minutes per energy point (in milliseconds). |
| `autoRestart` | `true` | Restarts immediately after granting energy. |
| `concurrency` | `"single"` | Only one regen timer runs at a time. |
| `maxOfflineExecutionPeriod` | `604800000` | Catch up to 7 days of offline regen. |
| `maxRestartCondition` | `energy_current` ≤ 20 | Stops regenerating when energy is full. |
| `inputs` | `{}` | Regen is free — no cost to the player. |
| `outputs` | `energy_current: 1` | Grants 1 energy per cycle. |

### Energy-Spending Recipes

Define actions that consume energy:

```json
{
  "simulation": {
    "recipes": {
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
      },
      "battle_start_free": {
        "duration": 0,
        "scope": "player",
        "clientViewable": true,
        "inputs": {},
        "outputs": {
          "battle_pending": 1
        },
        "metadata": {
          "displayName": "Start Tutorial Battle"
        }
      },
      "battle_resolve_forfeit": {
        "duration": 0,
        "scope": "player",
        "clientViewable": true,
        "inputs": {
          "battle_pending": 1
        },
        "outputs": {
          "energy_current": 5
        },
        "metadata": {
          "displayName": "Battle Forfeit"
        }
      }
    }
  }
}
```

Key patterns:
- **`battle_start`** costs 5 energy and sets a `battle_pending` flag
- **`battle_start_free`** is an alternative for tutorials with no energy cost
- **`battle_resolve_forfeit`** refunds energy if the player cancels before the battle starts

### Initialization

Start the regen timer when a new player opens the game for the first time:

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
          { "type": "set", "entity": "energy_max", "value": 20 },
          { "type": "trigger_recipe", "selector": "energy_regeneration" }
        ],
        "scope": "player"
      }
    }
  }
}
```

The `onStart` lifecycle hook fires the `initial_player_state` recipe once. It sets energy to full and kicks off the regen timer.

***

## Client-Side Implementation

### Step 1: Read Energy State

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const state = await RundotGameAPI.simulation.getStateAsync()
const currentEnergy = state.entities['energy_current'] ?? 0
const maxEnergy = state.entities['energy_max'] ?? 20
```

### Step 2: Subscribe to Real-Time Updates

```typescript
const unsubscribe = await RundotGameAPI.simulation.subscribeAsync({
  entities: ['energy_current', 'energy_max'],
  activeRuns: true,
  onUpdate(update) {
    switch (update.type) {
      case 'entity':
        for (const { entityId, quantity } of update.entities) {
          if (entityId === 'energy_current') {
            updateEnergyDisplay(quantity)
          }
        }
        break
      case 'activeRuns':
        updateRegenTimer(update.activeRuns)
        break
    }
  },
})
```

Subscribe to `activeRuns: true` to get the regen timer's progress. Each active run includes an `expiresAt` timestamp you can use to show a countdown.

### Step 3: Display Regen Countdown

```typescript
function updateRegenTimer(activeRuns: ActiveRun[]) {
  const regenRun = activeRuns.find(run => run.recipeId === 'energy_regeneration')
  if (regenRun) {
    const msRemaining = new Date(regenRun.expiresAt).getTime() - Date.now()
    const secondsRemaining = Math.max(0, Math.ceil(msRemaining / 1000))
    showCountdown(secondsRemaining)
  } else {
    hideCountdown() // Energy is full, regen stopped
  }
}
```

### Step 4: Spend Energy with Optimistic UI

```typescript
async function startBattle(currentEnergy: number) {
  const energyCost = 5

  if (currentEnergy < energyCost) {
    showError('Not enough energy!')
    return false
  }

  // Optimistic update — deduct immediately for responsive UI
  updateEnergyDisplay(currentEnergy - energyCost)

  const result = await RundotGameAPI.simulation.executeRecipeAsync('battle_start')

  if (!result.success) {
    // Rollback on failure
    updateEnergyDisplay(currentEnergy)
    showError(result.message ?? 'Failed to start battle')
    return false
  }

  return true
}
```

### Step 5: Check Requirements Before Showing UI

```typescript
const requirements = await RundotGameAPI.simulation.getRecipeRequirementsAsync(
  'battle_start',
  'player',
  1
)

if (!requirements.canAfford) {
  disableBattleButton()
  showCost(requirements.inputs) // Show what's needed
}
```

***

## How Offline Catch-Up Works

1. Player closes the game with 5/20 energy
2. Player returns 3 hours later (180 minutes)
3. Regen is 1 energy per 10 minutes → 18 cycles would have completed
4. But `maxRestartCondition` caps at 20, so only 15 energy is granted (5 + 15 = 20)
5. Player sees 20/20 energy on return

The `maxOfflineExecutionPeriod` of 7 days means if a player is away for a month, only 7 days of catch-up are calculated.

***

## Common Variations

### Dynamic Regen Rate

If regen speed increases with level, use a formula for duration:

```json
{
  "energy_regeneration": {
    "duration": {
      "formula": "max(60000, 600000 - (playerLevel * 30000))",
      "variables": {
        "playerLevel": { "inventory": "player_level" }
      }
    },
    "autoRestart": true,
    "outputs": { "energy_current": 1 }
  }
}
```

### Premium Energy Refill

Let players buy energy with premium currency:

```json
{
  "purchase_energy_refill": {
    "duration": 0,
    "scope": "player",
    "clientViewable": true,
    "inputs": {
      "wallet": { "amount": 2, "walletCurrency": "premiumCurrency" }
    },
    "outputs": {
      "energy_current": 25
    }
  }
}
```

### Ad-Rewarded Energy

Grant energy for watching an ad — call the recipe after a successful ad view:

```typescript
const adResult = await RundotGameAPI.ads.showRewardedAdAsync()
if (adResult.completed) {
  await RundotGameAPI.simulation.executeRecipeAsync('ad_reward_energy')
}
```

***

## Best Practices

- Always validate energy client-side before calling `executeRecipeAsync` for responsive UX, but trust the server result as authoritative.
- Use optimistic updates with rollback — deduct energy immediately, restore on server failure.
- Subscribe to `activeRuns` to power countdown timers instead of calculating client-side.
- Set `maxOfflineExecutionPeriod` to prevent unlimited offline accumulation.
- Consider a `battle_resolve_forfeit` recipe to refund energy when players cancel actions.
- Keep `energy_regeneration` metadata `hidden: true` so it doesn't appear in player-facing recipe lists.
