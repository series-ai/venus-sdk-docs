#  Lifecycles API

The host controls when your game is active, paused, or torn down. `RundotGameAPI.lifecycles` exposes five hooks so your app can react to those state changes:

```
Import RundotGameAPI
     │
     ▼
Ready (implicit once module import resolves)
     │
     ├──▶ onPause  ──▶ onResume
     │
     ├──▶ onSleep  ──▶ onAwake
     │
     └──▶ onQuit   (terminal)
```

> Module import resolving is the “ready” moment—there is no separate `onReady` callback in the current SDK.

## Quick Start

1. Import the SDK (it initializes automatically on import):
   ```typescript
   import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
   ```
2. Register lifecycle callbacks on `RundotGameAPI.lifecycles`.
3. Hold onto the returned disposers if your app hot-reloads or swaps scenes.

## Event Reference

| Hook                   | When it fires                                                      | Typical usage                                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `onPause(callback)`    | Host overlays your game or user momentarily leaves the experience  | Pause loops, mute audio, suspend timers              |
| `onResume(callback)`   | Host brings your game back to the foreground after a pause         | Resume loops, unmute audio, re-enable input          |
| `onSleep(callback)`    | Long suspend/background (system tab switch, network loss, etc.)    | Persist progress, stop network churn, close sockets  |
| `onAwake(callback)`    | App returns from sleep and is about to resume interaction          | Refresh auth/session, refetch stale data             |
| `onQuit(callback)`     | Host is shutting down the app instance                             | Flush telemetry, save state, return pending promises |

Each hook returns a `{ unsubscribe(): void }` handle. Call it if you need to detach listeners manually.

## Implementation Example

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const disposers = [
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

  RundotGameAPI.lifecycles.onQuit(async () => {
    await flushTelemetry()
    await saveProgressSnapshot()
  }),
]

export function disposeLifecycleHandlers() {
  disposers.forEach((dispose) => dispose?.())
}
```

## Best Practices

- **Keep handlers fast**: dispatch longer tasks to your own queues so the host isn’t blocked.
- **Guard async work**: wrap awaits in try/catch—transitions can happen at any time.
- **Persist aggressively on `onSleep`**: do not rely on `onQuit` always firing.
- **Avoid deprecated names**: older docs referenced `RundotGameAPI.lifecycle` (singular) and `onShow`/`onPlay`; those APIs aren’t available in current SDK builds.

