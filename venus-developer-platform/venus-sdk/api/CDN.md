# Venus CDN API

Fetch and manage assets through the Venus CDN. The SDK handles host configuration, versioning, and caching automatically so your assets load consistently across environments.

## Why Use the CDN?

1. **Larger Game Size**: It allows your game to exceed the 32 MB bundle size limit.
2. **Efficient Updates**: It prevents you from having to re-upload large assets if they haven't changed.
3. **Performance**: It improves initial load times by allowing you to defer loading assets until they are needed.

## Setting Up Your Assets

Place any assets you want served via CDN in your project's `public/cdn-assets` folder. The Venus CLI automatically uploads these files when you deploy.

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

## Fetching Assets

Use `fetchAsset` to load assets from your game's CDN. Paths are relative to the `cdn-assets` folder.

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

// Fetch an image
const imageBlob = await VenusAPI.cdn.fetchAsset('images/logo.png')
const imageUrl = URL.createObjectURL(imageBlob)

// Fetch JSON data
const dataBlob = await VenusAPI.cdn.fetchAsset('data/levels.json')
const levels = JSON.parse(await dataBlob.text())

// Fetch with timeout (in milliseconds)
const audioBlob = await VenusAPI.cdn.fetchAsset('audio/background.mp3', { timeout: 30000 })
```

## URL Resolution

If you need the raw URL instead of fetching directly, use `resolveAssetUrl`:

```typescript
const assetUrl = VenusAPI.cdn.resolveAssetUrl('images/logo.png')
const baseUrl = VenusAPI.cdn.getAssetCdnBaseUrl()
```

## Versioning & Deployment

Asset versioning is handled automatically by the Venus CLI:

- On each deploy, the CLI generates a manifest of your `cdn-assets` folder
- Only files that have changed since the last deploy are uploaded
- Cache-busting is managed for you—no need to manually version filenames

## Best Practices

- Store all CDN assets in `public/cdn-assets` to ensure they are uploaded on deploy.
- Use `fetchAsset` for loading your game's assets—it handles auth and host configuration.
