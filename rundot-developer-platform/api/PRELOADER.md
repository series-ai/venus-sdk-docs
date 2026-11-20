# Preloader API

RUN.world shows a loading screen while your game boots. Use this API to report progress while it is up, and to bring it back for heavy work after startup — scene changes, large downloads.

{% hint style="warning" %}
All SDK methods can reject; unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

await RundotGameAPI.preloader.showLoadScreen()

await loadCriticalAssets()

await RundotGameAPI.preloader.hideLoadScreen()
```

By default the host hides its loading screen as soon as your game is ready, and you do not need to call `hideLoadScreen()` at startup. Titles deployed with `uses-preloader true` instead keep the loading screen up until they call `hideLoadScreen()` themselves — see below.

## CLI Configuration (deprecated)

```bash
rundot --configure uses-preloader true
```

`true` makes the host keep its loading screen up until your game calls `hideLoadScreen()`. `false` (the default) lets the host reveal your game as soon as it is ready.

This flag is deprecated. If your game needs cover past startup, prefer drawing your own in-game loading screen: it renders identically across every RUN surface and cannot leave players stuck if your load path fails. On current RUN clients, a title that sets `true` and never calls `hideLoadScreen()` is failed to an error screen within about 5 minutes rather than loading forever.

## Progress Updates

Show loading progress to keep players informed:

```typescript
await RundotGameAPI.preloader.showLoadScreen()

// Update progress (0.0 to 1.0)
await RundotGameAPI.preloader.setLoaderProgress(0.25)
await RundotGameAPI.preloader.setLoaderText('Loading assets...')

await RundotGameAPI.preloader.setLoaderProgress(0.50)
await RundotGameAPI.preloader.setLoaderText('Initializing game...')

await RundotGameAPI.preloader.setLoaderProgress(0.75)
await RundotGameAPI.preloader.setLoaderText('Almost ready...')

await RundotGameAPI.preloader.setLoaderProgress(1.0)
await RundotGameAPI.preloader.hideLoadScreen()
```

## Scene Transitions

Use the preloader for heavy scene transitions:

```typescript
async function loadLevel(levelId: string) {
  await RundotGameAPI.preloader.showLoadScreen()
  await RundotGameAPI.preloader.setLoaderText(`Loading Level ${levelId}...`)
  
  try {
    await loadLevelData(levelId)
    
    initializeLevel(levelId)
  } finally {
    await RundotGameAPI.preloader.hideLoadScreen()
  }
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `preloader.showLoadScreen()` | `Promise<void>` | Show the native loading screen |
| `preloader.hideLoadScreen()` | `Promise<void>` | Hide the loading screen |
| `preloader.setLoaderText(text)` | `Promise<void>` | Update the loading message |
| `preloader.setLoaderProgress(progress)` | `Promise<void>` | Update progress (0.0 to 1.0) |

## Best Practices

- Always wrap show/hide in `try/catch`: the host might already be transitioning.
- Use `showLoadScreen()` when navigating between scenes that require large downloads.
- Pair hide calls with your own readiness checks to avoid flashing unpopulated UI.
- Consider chaining with `assetLibrary.loadAssetsBundle` to ensure large bundles are ready before dismissal.
- Avoid leaving the preloader up for long-standing idle states; fade to your own UI for parking experiences.
- Dismiss the loader from `onResume` if you paused during loading to prevent stale spinners.
