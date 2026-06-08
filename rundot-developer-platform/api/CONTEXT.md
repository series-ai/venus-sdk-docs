# Context API

Access data about the context in which your game is currently running. Determine how your game should act depending on what data it is given.

{% hint style="info" %}
Context fields are synchronous property reads on `RundotGameAPI.context`. There are no async methods here, so nothing to `await` and nothing that can reject. The whole context object is available synchronously after the SDK initializes.
{% endhint %}

Here are some examples for what you might use it for:

* Load a custom runtime configuration to choose how you want your game to load
* Interpret share link data to define gameplay elements

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const launchParams = RundotGameAPI.context.launchParams
const shareParams = RundotGameAPI.context.shareParams
const notificationParams = RundotGameAPI.context.notificationParams

console.log('Launch parameters:', launchParams)
console.log('Share parameters:', shareParams)
console.log('Notification parameters:', notificationParams)
```

## Context Fields

`RundotGameAPI.context` is a synchronous object available after SDK init. Read any field directly.

| Field | Type | Description |
|-------|------|-------------|
| `launchParams` | `Record<string, string> \| undefined` | Runtime configuration passed in at launch. |
| `shareParams` | `Record<string, string> \| undefined` | Payload from a share link the player opened. |
| `notificationParams` | `Record<string, string> \| undefined` | Payload from a push notification launch (e.g. `roomId`, or a custom payload from a `send_notification` effect). |
| `shareLinkId` | `string \| undefined` | The share document ID when the game was launched from a share link; `undefined` otherwise. Use it to look up the share's metadata or to branch on launch source. See the [Sharing API](SHARING.md). |
| `initializeAsleep` | `boolean` | Whether the game was started in a sleeping/background state (e.g. preloaded) rather than foregrounded. Defer heavy work or audio until the player is actually viewing the game. |
| `g2gLaunch` | `Record<string, any> \| undefined` | Data from the source game that launched this game via [game-to-game navigation](NAVIGATION.md). |
| `g2gReturn` | `Record<string, any> \| undefined` | Data restored after returning from a game this game navigated to. |
| `safeArea` | `SafeArea \| undefined` | DEPRECATED (will be removed in v4.0.0). Legacy safe-area insets (`{ left, top, right, bottom }`) captured at init. Use [`RundotGameAPI.system.getSafeArea()`](SAFE_AREA.md) instead. |

{% hint style="warning" %}
`context.safeArea` is deprecated and will be removed in v4.0.0. Read safe-area insets from [`RundotGameAPI.system.getSafeArea()`](SAFE_AREA.md), which stays current as host UI changes.
{% endhint %}

{% hint style="info" %}
When the host supplies no context payload, the SDK seeds `launchParams`, `shareParams`, and `notificationParams` to empty objects `{}` (not `undefined`), and `initializeAsleep` to `false`. A truthiness check like `if (context.launchParams)` always passes, so check the keys you expect instead (for example `context.launchParams.level`) or use `Object.keys(context.launchParams).length`. The remaining fields (`shareLinkId`, `g2gLaunch`, `g2gReturn`) stay genuinely `undefined` when absent.
{% endhint %}

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
* Inspect `RundotGameAPI.context.notificationParams` to handle launches from push notifications, e.g. `roomId` to auto-join a room, or custom payload from a `send_notification` effect.
* Check `RundotGameAPI.context.g2gLaunch` and `g2gReturn` to handle game-to-game navigation launches and returns.
* Read `RundotGameAPI.context.shareLinkId` to detect launches from a share link and look up the share's details.
* Check `RundotGameAPI.context.initializeAsleep` on boot; if `true`, the game was preloaded in the background, so defer heavy work and audio until the player is actually viewing it.
