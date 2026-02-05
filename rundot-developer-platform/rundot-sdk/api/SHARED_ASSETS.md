# Shared Assets API

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

- `game` is the host/CDN namespace for the bundle (typically the game that owns the assets).
- `bundleKey` identifies the bundle inside the shared-assets manifest.
- Resolves with raw bundle bytes (`ArrayBuffer`). Hand them to your own decompressor, asset loader, etc.
- Host implementations will attempt to load via RPC first and transparently fall back to the CDN when needed. Keep CDN and embedded assets in sync.

## Third-Party Developer Use Case

Shared assets enable cross-game asset sharing. For example, a first-party game can upload assets that third-party developers can use in their own games:

```typescript
// Example: Rush uploads Rush character assets
// A 3P developer can then use those assets in their game

const rushCharacters = await RundotGameAPI.sharedAssets.loadAssetsBundle(
  'rush-game',        // Game that owns the assets
  'CharacterSprites', // Bundle key
)

// Process the bundle (e.g., decompress, parse)
const sprites = await processCharacterBundle(rushCharacters)

// Use in your game
displayCharacter(sprites.hero)
```

This pattern allows:
- First-party games to publish reusable assets
- Third-party developers to incorporate those assets
- Consistent character/asset appearance across games
- Reduced bundle sizes for all games using shared assets

## Available Bundles

Currently available shared asset bundles:

| Game | Bundle Key | Description |
|------|------------|-------------|
| `burger-time` | `CharacterAssets` | Character sprites and animations |
| `burger-time` | `BurgerTimeCoreAssets` | Core game assets |

## Best Practices

- Use the embedded bundles to reduce on-demand loading, speeding up app start.
- Cache loaded bundles locally if you'll need them multiple times.
- Handle loading failures gracefully—fall back to placeholder assets if needed.
- Keep CDN and embedded assets in sync for consistent behavior.
