# Preloader API

Opt into the native RUN.game loading screen to smooth your startup and handoff into gameplay. The preloader covers your app while heavy assets load and can be dismissed once you're ready to present UI.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

await RundotGameAPI.preloader.showLoadScreen()

await loadCriticalAssets()

await RundotGameAPI.preloader.hideLoadScreen()
```

RUN.game hides the host loading UI automatically once the SDK is ready. Use the preloader API to show/hide the native loader during heavy work (startup, scene changes, large downloads).

## CLI Configuration

Configure preloader behavior using the RUN.game CLI:

```bash
# Disable the automatic preloader
rundot --configure uses-preloader false

# Re-enable the preloader
rundot --configure uses-preloader true
```

Set this to `false` if you want full control over your loading experience from the start.

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
    // Load level assets
    await RundotGameAPI.preloadAssets([
      `levels/${levelId}/background.png`,
      `levels/${levelId}/music.mp3`,
      `levels/${levelId}/config.json`,
    ], {
      onProgress(progress) {
        RundotGameAPI.preloader.setLoaderProgress(progress)
      }
    })
    
    // Initialize level
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

- Always wrap show/hide in `try/catch`—the host might already be transitioning.
- Use `showLoadScreen()` when navigating between scenes that require large downloads.
- Pair hide calls with your own readiness checks to avoid flashing unpopulated UI.
- Consider chaining with `RundotGameAPI.loadAsset` or `sharedAssets` to ensure large bundles are ready before dismissal.
- Avoid leaving the preloader up for long-standing idle states; fade to your own UI for parking experiences.
- Dismiss the loader from `onResume` if you paused during loading to prevent stale spinners.
