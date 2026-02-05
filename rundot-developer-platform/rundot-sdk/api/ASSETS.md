# Assets API

Load and manage game assets through the RUN.game platform. This API provides two approaches: **URL Resolution** for getting CDN URLs, and **Smart Loading** for optimized asset loading with caching and WebView handling.

## Why Use the Assets API?

1. **Larger Game Size**: Exceed the 32 MB bundle size limit by serving assets from CDN.
2. **Efficient Updates**: Avoid re-uploading large assets if they haven't changed.
3. **Performance**: Improve initial load times by deferring asset loading until needed.
4. **Cross-Platform**: Handles WebView blob creation, caching, and streaming automatically.

## Setting Up Your Assets

Place any assets you want served via CDN in your project's `public/cdn-assets` folder. The RUN.game CLI automatically uploads these files when you deploy.

```
my-game/
├── public/
│   └── cdn-assets/
│       ├── images/
│       │   └── logo.png
│       ├── audio/
│       │   └── background.mp3
│       └── data/
│           └── levels.json
```

---

## Section 1: URL Resolution (CDN API)

Use these methods when you just need the URL to an asset—for example, to pass to an `<img>` tag or third-party library.

### Get Full Asset URL

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Get full CDN URL for a game asset
const logoUrl = RundotGameAPI.cdn.resolveAssetUrl('images/logo.png')
// e.g., "https://cdn.run.game/games/your-game/v1/images/logo.png"

document.querySelector('#logo').src = logoUrl
```

### Get Base URL

```typescript
// Get the CDN base URL for your game
const baseUrl = RundotGameAPI.cdn.getAssetCdnBaseUrl()
// e.g., "https://cdn.run.game/games/your-game/v1/"
```

### Fetch Raw Asset Data

```typescript
// Fetch raw blob from CDN
const imageBlob = await RundotGameAPI.cdn.fetchAsset('images/logo.png')
const imageUrl = URL.createObjectURL(imageBlob)

// Fetch JSON data
const dataBlob = await RundotGameAPI.cdn.fetchAsset('data/levels.json')
const levels = JSON.parse(await dataBlob.text())

// Fetch with timeout (in milliseconds)
const audioBlob = await RundotGameAPI.cdn.fetchAsset('audio/background.mp3', { 
  timeout: 30000 
})
```

### CDN API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `cdn.resolveAssetUrl(subPath)` | `string` | Get full CDN URL for game asset |
| `cdn.getAssetCdnBaseUrl()` | `string` | Get the base CDN URL |
| `cdn.fetchAsset(path, options?)` | `Promise<Blob>` | Fetch raw blob from CDN |

---

## Section 2: Smart Loading (Asset Loader)

Use these methods when you want optimized loading with automatic caching, type detection, and WebView blob handling.

### Load a Single Asset

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Smart loading with automatic type detection and caching
const iconUrl = await RundotGameAPI.loadAsset('images/icon.png')

// For images/audio/video, returns a blob URL ready for use
document.querySelector('#icon').src = iconUrl

// For JSON/text, returns the parsed content
const config = await RundotGameAPI.loadAsset('data/config.json')
```

### Preload Multiple Assets

```typescript
// Preload a bundle of assets with progress tracking
await RundotGameAPI.preloadAssets(
  [
    'audio/music.mp3',
    { url: 'video/intro.mp4', isOptional: true },
    'images/sprites.png',
  ],
  {
    onProgress(progress, { url }) {
      console.log(`Loaded ${(progress * 100).toFixed(0)}% (${url})`)
    },
  },
)
```

### Check Cache & Cleanup

```typescript
// Check if an asset is already cached
const cached = RundotGameAPI.assetLoader?.getCached('images/icon.png')
if (cached) {
  // Use cached version immediately
  document.querySelector('#icon').src = cached
}

// Release blob URLs when leaving a scene to free memory
RundotGameAPI.cleanupAssets()
```

### Asset Loader API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `loadAsset(url, options?)` | `Promise<string \| any>` | Smart loading with type detection and caching |
| `preloadAssets(urls, options?)` | `Promise<void>` | Parallel preloading with progress callbacks |
| `cleanupAssets()` | `void` | Release blob URLs to free memory |
| `assetLoader.getCached(url)` | `string \| undefined` | Check if asset is cached |

---

## When to Use Each Approach

| Use Case | Recommended API |
|----------|----------------|
| Need just the URL for an `<img>` or `<video>` tag | `cdn.resolveAssetUrl()` |
| Fetching raw data to process yourself | `cdn.fetchAsset()` |
| Loading images/audio with caching in WebView | `loadAsset()` |
| Preloading multiple assets with progress | `preloadAssets()` |
| Loading JSON configuration files | Either works |

## Versioning & Deployment

Asset versioning is handled automatically by the RUN.game CLI:

* On each deploy, the CLI generates a manifest of your `cdn-assets` folder
* Only files that have changed since the last deploy are uploaded
* Cache-busting is managed for you—no need to manually version filenames

## Best Practices

- Store all CDN assets in `public/cdn-assets` to ensure they are uploaded on deploy.
- Treat optional assets differently—mark them with `isOptional: true` to suppress hard failures.
- Pair with the Preloader API to keep the host splash visible during heavy loads.
- Release blob URLs with `cleanupAssets()` when transitioning between scenes.
- For text/JSON, the loader returns the file contents instead of an object URL.
