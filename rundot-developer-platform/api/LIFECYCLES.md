#  Lifecycles API

The host controls when your game is active, paused, or torn down. `RundotGameAPI.lifecycles` exposes hooks so your app can react to state and environment changes:

```
Import RundotGameAPI
     │
     ▼
Ready (implicit once module import resolves)
     │
     ├──▶ onPause  ───▶ onResume
     │
     ├──▶ onSleep  ───▶ onAwake
     │
     ├──▶ onSafeAreaChanged (orientation / foldable / system chrome updates)
     │
     ├──▶ onDeviceChanged   (screen dimension / orientation updates)
     │
     ├──▶ onBackButton      (Android only; handle or call requestPopOrQuit)
     │
     └──▶ onQuit            (terminal)
```

> Module import resolving is the "ready" moment; there is no separate `onReady` callback in the current SDK.

## Quick Start

1. Import the SDK (it initializes automatically on import):
   ```typescript
   import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
   ```
2. Register lifecycle callbacks on `RundotGameAPI.lifecycles`.
3. Hold onto the returned subscriptions and call `.unsubscribe()` if your app hot-reloads or swaps scenes.

## Event Reference

| Hook                   | When it fires                                                      | Typical usage                                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `onPause(callback)`    | Host overlays your game or user momentarily leaves the experience  | Pause loops, mute audio, suspend timers              |
| `onResume(callback)`   | Host brings your game back to the foreground after a pause         | Resume loops, unmute audio, re-enable input          |
| `onSleep(callback)`    | Long suspend/background (system tab switch, network loss, etc.)    | Persist progress, stop network churn, close sockets  |
| `onAwake(callback)`    | App returns from sleep and is about to resume interaction          | Refresh auth/session, refetch stale data             |
| `onQuit(callback)`     | Host is shutting down the app instance                             | Flush telemetry, save state, return pending promises |
| `onBackButton(callback)` | User pressed the device back button (Android only)               | Navigate back in menus, show exit dialog, save state |
| `onNotification(callback)` | A notification tap targeted your game while it was already running | Jump to the tapped destination (board, story, room)  |
| `onSafeAreaChanged(callback)` | Safe area insets changed (device rotation, foldables, host chrome) | Reposition HUD elements, adjust canvas gutters |
| `onDeviceChanged(callback)` | Device geometry changed (screen dimensions, orientation) | Resize engine render targets, adjust camera FOV |

Each hook returns a `{ unsubscribe(): void }` handle. Call it if you need to detach listeners manually.

{% hint style="info" %}
**Callback contract.** The state hooks (`onPause` through `onBackButton`) are typed `() => void`: the host passes no argument and any return value is ignored (the channel is fire-and-forget). Two hooks carry a payload: `onIdentityChanged` receives an `IdentityChangedEvent`, and `onNotification` receives a `NotificationEvent = { params: Record<string, string> }` — the tapped notification's extras. `onSafeAreaChanged` receives `SafeArea` insets and `onDeviceChanged` receives `DeviceInfo`. To quit from a back-button handler, call `requestPopOrQuit()` explicitly. The lifecycles subpath also exports named aliases for every callback type (`AwakeCallback`, `SleepCallback`, `ResumeCallback`, `PauseCallback`, `QuitCallback`, `BackButtonCallback`, `IdentityChangedCallback`, `NotificationCallback`, `SafeAreaCallback`, `DeviceCallback`).
{% endhint %}

### `onNotification` — warm notification taps

A tap on a notification for a game that is **already running** does not remount
the game; its payload arrives here instead:

```typescript
RundotGameAPI.lifecycles.onNotification(({ params }) => {
  if (params.boardId) showBoard(params.boardId)
})
```

One rule: **boot → `app.resolveLaunchIntent()`, running → `lifecycles.onNotification()`.**
A cold tap (game not running) launches the game and surfaces through
`resolveLaunchIntent()` with `kind: 'notification'`; that result is settled
once per session and never re-fires for a later tap. Register
`onNotification` early — the latest tap that arrived before your subscription
was up is replayed to your first registered callback the moment it registers.

### `onSafeAreaChanged` & `onDeviceChanged` — dynamic viewport updates

When a user rotates a phone or unfolds a foldable device:

```typescript
RundotGameAPI.lifecycles.onSafeAreaChanged((safeArea) => {
  hud.style.paddingTop = `${safeArea.top}px`
})

RundotGameAPI.lifecycles.onDeviceChanged((device) => {
  camera.aspect = device.screenSize.width / device.screenSize.height
  camera.updateProjectionMatrix()
})
```

## Implementation Example

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const subscriptions = [
  RundotGameAPI.lifecycles.onPause(() => {
    pauseGameLoop()
    RundotGameAPI.log('[Lifecycle] paused')
  }),

  RundotGameAPI.lifecycles.onResume(() => {
    resumeGameLoop()
    RundotGameAPI.log('[Lifecycle] resumed')
  }),

  RundotGameAPI.lifecycles.onSleep(() => {
    saveProgressSnapshot()
  }),

  RundotGameAPI.lifecycles.onAwake(() => {
    refreshLiveServices()
  }),

  RundotGameAPI.lifecycles.onSafeAreaChanged((safeArea) => {
    applyHudSafeArea(safeArea)
  }),

  RundotGameAPI.lifecycles.onQuit(async () => {
    await flushTelemetry()
    await saveProgressSnapshot()
  }),
]

export function disposeLifecycleHandlers() {
  subscriptions.forEach((subscription) => subscription.unsubscribe())
}
```

## Best Practices

- **Keep handlers fast**: dispatch longer tasks to your own queues so the host isn't blocked.
- **Guard async work**: wrap awaits in try/catch; transitions can happen at any time.
- **Persist aggressively on `onSleep`**: do not rely on `onQuit` always firing.
- **Avoid deprecated names**: older docs referenced `RundotGameAPI.lifecycle` (singular) and `onShow`/`onPlay`; those APIs aren't available in current SDK builds.

## Back Button (Android)

On Android devices, the hardware or gesture-based back button fires `onBackButton`. Use the callback to handle in-game back navigation (e.g. closing a settings screen, navigating up a menu hierarchy, or showing an exit confirmation).

If you want the host to perform its default quit behavior from inside the callback, call `RundotGameAPI.requestPopOrQuit()` (see below).

If you don't register an `onBackButton` handler at all, the host performs its default quit behavior automatically; you only need this API if your game has its own back navigation.

This event only fires on Android. On iOS and web, the event never fires; registering a handler is safe but acts as a no-op.

### `requestPopOrQuit(options?: QuitOptions): Promise<boolean>`

Requests that the host pop the current screen or quit the game.

```typescript
RundotGameAPI.lifecycles.onBackButton(() => {
  if (hasOpenDialog()) {
    closeDialog()
  } else {
    RundotGameAPI.requestPopOrQuit()
  }
})
```
