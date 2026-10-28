# CDN API

The CDN API (`RundotGameAPI.cdn`) provides direct access to the RUN CDN for fetching content-hashed assets, resolving signed URLs for protected/entitled game files, and accessing shared runtime libraries.

For full architectural guides on configuring `public/cdn-assets/`, setting up `cdn.config.json` entitlement rules, and using high-level asset loaders, see the [Assets API](ASSETS.md) documentation.

***

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Fetch an asset blob (manifest-resolved and cache-busted)
const blob = await RundotGameAPI.cdn.fetchAsset('textures/terrain.png')
const objectUrl = URL.createObjectURL(blob)

// Resolve a signed URL for an entitlement-gated audio track
const audioUrl = await RundotGameAPI.cdn.resolveAssetUrl('music/dlc_theme.mp3')

// Batch resolve multiple asset URLs
const results = await RundotGameAPI.cdn.resolveAssetUrls([
  'sprites/hero.png',
  'sprites/villain.png',
])
for (const item of results) {
  if (item.status === 'ok') {
    console.log(item.path, '->', item.url)
  }
}
```

***

## Methods

| Method | Returns | Description |
|---|---|---|
| `fetchAsset(path, options?)` | `Promise<Blob>` | Fetches a game asset from the CDN (manifest-resolved and cache-busted). Works for both public and protected assets. |
| `fetchFromCdn(subPath, options?)` | `Promise<Blob>` | Fetches a raw Blob directly from the CDN root bucket without manifest translation or entitlement checks. |
| `resolveAssetUrl(path)` | `Promise<string>` | Resolves a single asset path to its public or signed CDN URL. |
| `resolveAssetUrls(paths)` | `Promise<AssetUrlResult[]>` | Batch resolves multiple asset paths with per-path error isolation. |
| `getAssetCdnBaseUrl()` | `string` | Returns the base CDN URL for your game's deployed asset assets. |
| `resolveSharedLibUrl(subPath)` | `string` | Synchronously resolves a shared library asset path (`libs/` prefix) to the shared CDN URL. |
| `resolveAvatarAssetUrl(subPath)` | `string` | *(Deprecated)* Synchronously resolves a shared 3D-avatar asset path (`avatar3d/` prefix). |
| `refreshEntitlements()` | `Promise<void>` | Refreshes the client app's entitlement cache after in-app purchases or unlocks. |

***

## Data Types

### `FetchFromCdnOptions`

```typescript
interface FetchFromCdnOptions {
  /** Timeout in milliseconds before rejecting the fetch operation. */
  timeout?: number
}
```

### `AssetUrlResult`

```typescript
interface AssetUrlResult {
  /** Relative path requested. */
  path: string
  /** Resolution status. */
  status: 'ok' | 'error'
  /** Resolved signed/public URL if status is 'ok'. */
  url?: string
  /** Unix timestamp in seconds when signed URL expires. */
  expiresAt?: number
  /** Error message if status is 'error'. */
  error?: string
}
```

***

## See Also

- [Assets API Guide](ASSETS.md)
- [cdn.config.json Schema & Entitlements](ASSETS.md#cdnconfigjson)
- [Asset Loader Reference](ASSETS.md#asset-loader-top-level-convenience)
