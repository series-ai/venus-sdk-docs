# Assets API

Exceed the 32 MB bundle size limit by serving assets from the RUN.game CDN. The CLI handles uploading, versioning, and cache-busting — you just fetch.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const imageBlob = await RundotGameAPI.cdn.fetchAsset('images/logo.png')
const imageUrl = URL.createObjectURL(imageBlob)
document.querySelector('#logo').src = imageUrl
```

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
├── src/
│   └── ...
└── game.config.json
```

{% hint style="warning" %}
Only files inside `public/cdn-assets/` are uploaded to the CDN. Files placed elsewhere in `public/` will be bundled into your game but won't be available via the CDN API.
{% endhint %}

## Fetching Assets

Use `cdn.fetchAsset` to load assets from your game's CDN. Paths are relative to the `cdn-assets` folder.

Under the hood, `fetchAsset` resolves each logical path through a **manifest** (generated at deploy time) so that files are content-hashed and cache-busted automatically.

### Fetch an Image

```typescript
const imageBlob = await RundotGameAPI.cdn.fetchAsset('images/logo.png')
const imageUrl = URL.createObjectURL(imageBlob)
document.querySelector('#logo').src = imageUrl
```

### Fetch JSON Data

```typescript
const dataBlob = await RundotGameAPI.cdn.fetchAsset('data/levels.json')
const levels = JSON.parse(await dataBlob.text())
```

### Fetch Audio with a Custom Timeout

The default timeout is 30 000 ms. Pass `timeout` in milliseconds to override:

```typescript
const audioBlob = await RundotGameAPI.cdn.fetchAsset('audio/background.mp3', {
  timeout: 60000,
})
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `cdn.fetchAsset(path, options?)` | `Promise<Blob>` | Fetch a game asset from the CDN (manifest-resolved, cache-busted) |
| `cdn.getAssetCdnBaseUrl()` | `string` | Get the base CDN URL for your game's assets |

## Versioning & Deployment

Asset versioning is handled automatically by the RUN.game CLI:

* On each deploy, the CLI generates a manifest of your `cdn-assets` folder.
* Only files that have changed since the last deploy are uploaded.
* Cache-busting is managed for you — no need to manually version filenames.

## Best Practices

- Store all CDN assets in `public/cdn-assets/` to ensure they are uploaded on deploy.
- Pair with the [Preloader API](PRELOADER.md) to keep the host splash visible while fetching heavy assets.
- Remember to revoke blob URLs with `URL.revokeObjectURL()` when you no longer need them, to free memory.

