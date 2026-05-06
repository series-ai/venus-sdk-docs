# Context API

Access data about the context in which your game is currently running. Determine how your game shoul act depending on what data is is being given.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

Here are some examples for what you might use it for:

* Load a custom runtime configuration to choose how you want your game to load
* Interpret share link data to define gameplay elements

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const launchParams = await RundotGameAPI.context.launchParams
const shareParams = await RundotGameAPI.context.shareParams
const notificationParams = await RundotGameAPI.context.notificationParams

console.log('Launch parameters:', launchParams)
console.log('Share parameters:', shareParams)
console.log('Notification parameters:', notificationParams)
```

## Payload Guidelines

* Keep `shareParams` under \~100 KB (share payloads are stored in Firestore with 1 MB document caps).
* Keep your runtime configuration under \~100 KB for the same reason.
* Use compact identifiers (IDs, short strings) and fetch bulky data from your backend.

## Game-to-Game Navigation Context

When your game is launched via [game-to-game navigation](NAVIGATION.md), two additional context fields may be present:

```typescript
const context = RundotGameAPI.context

if (context.g2gLaunch) {
  // This game was launched from another game
  console.log('Launch data from source game:', context.g2gLaunch)
}

if (context.g2gReturn) {
  // The player returned from a game we navigated to
  console.log('Return data:', context.g2gReturn)
}
```

| Field | Type | Description |
|-------|------|-------------|
| `g2gLaunch` | `Record<string, any> \| undefined` | Data from the source game that launched this game |
| `g2gReturn` | `Record<string, any> \| undefined` | Data restored after returning from a game this game navigated to |

Both are `undefined` when the game is launched normally. See the [Navigation API](NAVIGATION.md) for full details on game-to-game navigation.

## Best Practices

* Inspect `RundotGameAPI.context.launchParams` on boot to determine how you want your game to load early on.
* Inspect `RundotGameAPI.context.shareParams` on boot and branch gameplay early. Players expect to land in the invited context immediately.
* Inspect `RundotGameAPI.context.notificationParams` to handle launches from push notifications — e.g. `roomId` to auto-join a room, or custom payload from a `send_notification` effect.
* Check `RundotGameAPI.context.g2gLaunch` and `g2gReturn` to handle game-to-game navigation launches and returns.
