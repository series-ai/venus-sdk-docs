# Navigation API (BETA)

Navigate between games and manage the app navigation stack.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

---

## Game-to-Game Navigation

Launch another game from within your game, optionally passing data forward and preserving context for when the player returns.

**Key Features:**
- Navigate the player to a different game by ID
- Pass arbitrary data to the target game on launch
- Receive data back when the player returns from the target game
- Single-depth: only one level of return context is preserved

### Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Navigate to another game
await RundotGameAPI.navigation.navigateToGame('target-game-id', {
  launchContext: { level: 5, score: 1000 },
  returnContext: { checkpoint: 'boss-fight' },
})
```

### How It Works

```
Game A calls navigateToGame('game-b', { launchContext, returnContext })
     |
     v
Game A is unmounted
     |
     v
Game B initializes -- context.g2gLaunch contains launchContext
     |
     v
User taps "back" in host UI
     |
     v
Game B is unmounted
     |
     v
Game A initializes -- context.g2gReturn contains returnContext
```

1. **Navigate**: Game A calls `navigateToGame` with the target game ID and optional context data. The current game is unmounted immediately.
2. **Target receives launch data**: When Game B initializes, `context.g2gLaunch` contains whatever `launchContext` Game A provided.
3. **Return**: When the player navigates back (via the host's back button), Game A re-initializes and `context.g2gReturn` contains the `returnContext` that Game A originally provided.

### Complete Example

**Game A — the source game:**

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Check if we're returning from a G2G navigation
const context = RundotGameAPI.context
if (context.g2gReturn) {
  console.log('Returned from another game:', context.g2gReturn)
  restoreCheckpoint(context.g2gReturn.checkpoint)
}

// Navigate to Game B
async function visitGameB() {
  await RundotGameAPI.navigation.navigateToGame('game-b-id', {
    launchContext: { referrer: 'game-a', giftItem: 'sword-of-fire' },
    returnContext: { checkpoint: 'level-3-hub' },
  })
  // This code never runs — the game is unmounted after navigateToGame
}
```

**Game B — the target game:**

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const context = RundotGameAPI.context
if (context.g2gLaunch) {
  console.log('Launched from:', context.g2gLaunch.referrer)
  grantItem(context.g2gLaunch.giftItem)
}
```

### `navigateToGame(targetGameId, options?)`

Navigate the player to another game. The current game is unmounted.

```typescript
await RundotGameAPI.navigation.navigateToGame(targetGameId, options)
```

#### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `targetGameId` | `string` | Yes | The ID of the game to navigate to |
| `options.launchContext` | `Record<string, any>` | No | Data passed to the target game, available as `context.g2gLaunch` |
| `options.returnContext` | `Record<string, any>` | No | Data restored when returning to this game, available as `context.g2gReturn` |

### Reading G2G Context

After initialization, check `RundotGameAPI.context` for G2G data:

| Field | Type | Present when |
|-------|------|--------------|
| `context.g2gLaunch` | `Record<string, any>` | This game was launched via `navigateToGame` from another game |
| `context.g2gReturn` | `Record<string, any>` | The player returned from a game that this game navigated to |

Both fields are `undefined` when the game is launched normally (not via G2G navigation).

### Design Constraints

- **Single-depth only.** If Game A navigates to Game B, and Game B navigates to Game C, only the B-to-C return context is preserved. Game A's return context is overwritten.
- **Session-scoped.** G2G state is held in memory only and is not persisted across app restarts.
- **Current game is unmounted.** After calling `navigateToGame`, your game is destroyed. Any unsaved state will be lost — save before navigating.

---

## Stack Navigation

Push and pop games onto a navigation stack managed by the host.

### `pushApp(appId, options?)`

Push a new game onto the navigation stack.

```typescript
await RundotGameAPI.navigation.pushApp('other-game-id', {
  contextData: { from: 'main-menu' },
  appParams: { mode: 'challenge' },
})
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | `string` | Yes | The game to push onto the stack |
| `options.contextData` | `any` | No | Context data for the target game |
| `options.appParams` | `any` | No | App-specific parameters |

### `popApp()`

Pop the current game off the navigation stack, returning to the game below.

```typescript
await RundotGameAPI.navigation.popApp()
```

### `getStackInfo()`

Get information about the current navigation stack.

```typescript
const info = RundotGameAPI.navigation.getStackInfo()
console.log(info.isInStack, info.stackPosition, info.stackDepth)
```

**Returns:** `NavigationStackInfo`

| Field | Type | Description |
|-------|------|-------------|
| `isInStack` | `boolean` | Whether the game is part of a navigation stack |
| `stackPosition` | `number` | Current position in the stack (0-indexed) |
| `isTopOfStack` | `boolean` | Whether this game is at the top of the stack |
| `stackDepth` | `number` | Total depth of the navigation stack |
| `parentInstanceId` | `string` | Instance ID of the parent game in the stack |

### `requestPopOrQuit(options?)`

Request to pop from the stack or quit the game, potentially showing a confirmation dialog.

```typescript
const didQuit = await RundotGameAPI.navigation.requestPopOrQuit({
  reason: 'user-pressed-back',
})
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `options.reason` | `string` | No | Reason for quitting |
| `options.forceClose` | `boolean` | No | Skip confirmation and force close |

**Returns:** `boolean` — `true` if the quit/pop was successful.

---

## Best Practices

* **Save state before navigating.** Both `navigateToGame` and `pushApp` unmount your game. Persist anything important to storage first.
* **Check G2G context on every boot.** Your game can be launched normally or via G2G — always check `context.g2gLaunch` and `context.g2gReturn` and handle both paths.
* **Keep context payloads small.** G2G context is held in session memory. Use IDs and short strings; fetch large data from your backend.
* **Don't chain G2G navigations deeply.** Only one level of return context is preserved. If you need multi-step flows, use stack navigation instead.
