#  Asset Loader API

Load, preload, and clean up assets with WebView-aware optimizations. ’ asset loader handles blob creation, streaming checks, and caching so you can focus on gameplay.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const iconUrl = await RundotGameAPI.loadAsset('images/icon.png')
```

## Preloading Bundles

```typescript
await RundotGameAPI.preloadAssets(
  [
    'audio/music.mp3',
    { url: 'video/intro.mp4', isOptional: true },
  ],
  {
    onProgress(progress, { url }) {
      console.log(`Loaded ${(progress * 100).toFixed(0)}% (${url})`)
    },
  },
)
```

## Cache Management

```typescript
const cached = RundotGameAPI.assetLoader?.getCached('images/icon.png')

// Release blob URLs when leaving a scene
RundotGameAPI.cleanupAssets()
```

## Best Practices

- Treat optional assets differently—mark them with `isOptional` to suppress hard failures.
- Pair with the Preloader API to keep the host splash visible during heavy loads.
- For text/JSON, the loader returns the file contents instead of an object URL—branch your handling accordingly.

