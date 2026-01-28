#  Shared Assets API

Download host-provisioned asset bundles that are shared across titles or reused within your game. Shared assets reduce bundle size and keep large media up to date without shipping updates.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const bundleBuffer = await RundotGameAPI.sharedAssets.loadAssetsBundle(
  'burger-time',
  'CharacterAssets',
)
console.log('Bundle bytes:', bundleBuffer.byteLength)
```

## API Reference

### `loadAssetsBundle(game: string, bundleKey: string): Promise<ArrayBuffer>`

- `game` is the host/CDN namespace for the bundle.
- `bundleKey` identifies the bundle inside the shared-assets manifest.
- Resolves with raw bundle bytes (`ArrayBuffer`). Hand them to your own decompressor, asset loader, etc.
- Host implementations will attempt to load via RPC first and transparently fall back to the CDN when needed. Keep CDN and embedded assets in sync.


## Best Practices

- Use the embedded bundles to reduce on-demand loading, speeding up app start
- Currently the available bundles are
  - burger-time, CharacterAssets
  - burger-time, BurgerTimeCoreAssets

