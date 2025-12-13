# Venus Preloader API

Opt into the native Venus loading screen to smooth your startup and handoff into gameplay. The preloader covers your app while heavy assets load and can be dismissed once you’re ready to present UI.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'
await VenusAPI.preloader.showLoadScreen()

await loadCriticalAssets()

await VenusAPI.preloader.hideLoadScreen()
```

Venus hides the host loading UI automatically once the SDK is ready. Use the preloader API to show/hide the native loader during heavy work (startup, scene changes, large downloads).

## Usage Tips

- Use `showLoadScreen()` when navigating between scenes that require large downloads.
- Pair hide calls with your own readiness checks to avoid flashing unpopulated UI.
- Consider chaining with `VenusAPI.loadAsset` or `sharedAssets` to ensure large bundles are ready before dismissal.

## Best Practices

- Always wrap show/hide in `try/catch`—the host might already be transitioning.
- Avoid leaving the preloader up for long-standing idle states; fade to your own UI for parking experiences.
- Dismiss the loader from `onResume` if you paused during loading to prevent stale spinners.

