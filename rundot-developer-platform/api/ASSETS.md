# Assets API

Exceed the 32 MB bundle size limit by serving assets from the RUN.game CDN. The CLI handles uploading, versioning, and cache-busting — you just fetch. Assets can optionally be **protected** behind entitlements so only players who own the right entitlement can access them.

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

Under the hood, `fetchAsset` resolves each logical path through a **manifest** (generated at deploy time) so that files are content-hashed and cache-busted automatically. For protected assets, the Client App validates the player's entitlements and returns a signed URL.

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

## Resolving Asset URLs

If you need the URL of an asset without fetching its contents (e.g., to set an `<img>` src or pass to a third-party library), use `resolveAssetUrl` or `resolveAssetUrls`.

### Resolve a Single URL

```typescript
const url = await RundotGameAPI.cdn.resolveAssetUrl('images/hero.png')
document.querySelector('#hero').src = url
```

### Batch Resolve Multiple URLs

`resolveAssetUrls` resolves multiple paths in a single call. Each result includes a per-path status, so a missing entitlement on one asset does not fail the entire batch.

```typescript
const results = await RundotGameAPI.cdn.resolveAssetUrls([
  'images/hero.png',
  'images/premium-skin.png',
  'audio/theme.mp3',
])

for (const result of results) {
  if (result.status === 'ok') {
    console.log(`${result.path} → ${result.url}`)
  } else {
    console.warn(`${result.path} failed: ${result.error}`)
  }
}
```

Each result in the array has this shape:

```typescript
interface AssetUrlResult {
  path: string                // The path you requested
  status: 'ok' | 'error'
  url?: string                // Resolved URL (when status is 'ok')
  expiresAt?: number          // URL expiry timestamp in ms (for signed URLs)
  error?: string              // Error code (when status is 'error')
}
```

**Error codes:**

| Code | Meaning |
|------|---------|
| `ENTITLEMENT_REQUIRED` | The asset is protected and the player does not own the required entitlement |
| `ASSET_NOT_FOUND` | The asset path does not exist in the manifest |

## Protected Assets (Entitlement-Gated)

Assets can be marked as **protected** so only players who hold the required entitlements can access them. This is useful for premium content like skins, levels, or audio packs that are unlocked through purchases or rewards.

### How It Works

1. Create a `cdn.config.json` file in your **project root** (next to `game.config.json`) declaring which folders are protected and by which entitlements.
2. On deploy, the CLI reads `cdn.config.json` and generates a v2 manifest that flags protected files.
3. When your game requests a protected asset, the Client App checks the player's entitlements.
4. If the player owns the required entitlements, a **signed URL** is returned.
5. If the player does not own the entitlements, the request fails with an `ENTITLEMENT_REQUIRED` error.

### cdn.config.json

Create a `cdn.config.json` file in your project root to declare which asset folders require entitlements. If this file does not exist, all assets in `cdn-assets/` are served publicly (backwards-compatible).

```
my-game/
├── cdn.config.json        <-- put it here
├── game.config.json
├── public/
│   └── cdn-assets/
│       ├── images/        <-- public (not listed in config)
│       ├── videos/        <-- protected
│       └── audio/         <-- protected
└── src/
```

#### Schema

```json
{
  "version": 1,
  "defaultTtl": 3600,
  "ttlByMimeType": {
    "video/*": 300,
    "audio/*": 600
  },
  "protected": [
    {
      "path": "videos",
      "entitlements": ["gold", "premium"],
      "ttl": 1800,
      "ttlByMimeType": {
        "video/mp4": 120
      }
    },
    {
      "path": "videos",
      "entitlements": ["platinum"]
    },
    {
      "path": "audio",
      "entitlements": ["season-pass"]
    }
  ]
}
```

Only folders that require entitlements need to be listed. Any folder inside `cdn-assets/` that is **not** present in `protected` is treated as public.

#### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `version` | yes | Schema version. Currently `1`. |
| `defaultTtl` | no | Fallback signed URL TTL in seconds for all protected assets. Defaults to `3600`. |
| `ttlByMimeType` | no | Global TTL overrides keyed by MIME type. Supports `*` wildcards (e.g. `"video/*"`). |
| `protected` | yes | Array of protection rules. Each entry maps a folder to a set of required entitlements. |
| `protected[].path` | yes | Top-level folder name inside `cdn-assets/` that requires entitlements (e.g. `"videos"`). |
| `protected[].entitlements` | yes | Array of entitlement IDs required to access this folder. All entitlements in the array are AND'd — the player must hold **all** of them. |
| `protected[].ttl` | no | Per-folder TTL override in seconds. |
| `protected[].ttlByMimeType` | no | Per-folder, per-MIME-type TTL overrides. Same wildcard syntax as the global field. |

#### Entitlement Logic (AND / OR)

Within a single entry, all listed entitlements are **AND'd** — the player needs **all** of them. Multiple entries for the **same path** are **OR'd** — the player needs to satisfy **any one** group.

In the example above, `videos/` is accessible if the player has (`gold` AND `premium`) **OR** `platinum`. `audio/` requires `season-pass`.

#### TTL Resolution

For protected assets, the signed URL TTL is resolved in priority order (most specific wins):

1. Folder-level `ttlByMimeType` match
2. Folder-level `ttl`
3. Global `ttlByMimeType` match
4. Global `defaultTtl`
5. System default (`3600`)

TTL does not apply to public assets.

### Fetching Protected Assets

Protected assets are fetched using the same `fetchAsset` and `resolveAssetUrl` methods as public assets — no special API call is needed. The entitlement check happens automatically.

```typescript
try {
  const skinBlob = await RundotGameAPI.cdn.fetchAsset('skins/dragon.png')
  applySkin(skinBlob)
} catch (error) {
  if (error.message.includes('ENTITLEMENT_REQUIRED')) {
    showPurchasePrompt()
  }
}
```

### Refreshing Entitlements

After a player completes a purchase or receives a reward that grants new entitlements, call `refreshEntitlements()` so the Client App picks up the change immediately. Without this call, newly granted entitlements may not take effect until the next app session.

```typescript
// Player just bought a skin pack
await RundotGameAPI.entitlements.consumeEntitlement('skin_pack_token', 1)

// Refresh so protected assets are now accessible
await RundotGameAPI.cdn.refreshEntitlements()

// Now fetch the newly unlocked asset
const skinBlob = await RundotGameAPI.cdn.fetchAsset('skins/dragon.png')
```

{% hint style="info" %}
`refreshEntitlements()` is a no-op on older Client App versions that don't support entitlement-gated assets.
{% endhint %}

See the [Entitlements API](../../readme/entitlements-api.md) for full details on managing player entitlements.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `cdn.fetchAsset(path, options?)` | `Promise<Blob>` | Fetch a game asset from the CDN (manifest-resolved, cache-busted). Works for both public and protected assets. |
| `cdn.resolveAssetUrl(path)` | `Promise<string>` | Resolve a single asset path to its CDN URL (signed if protected) |
| `cdn.resolveAssetUrls(paths)` | `Promise<AssetUrlResult[]>` | Batch resolve multiple asset paths with per-path error handling |
| `cdn.refreshEntitlements()` | `Promise<void>` | Refresh the Client App's entitlement cache (call after purchases or rewards) |
| `cdn.getAssetCdnBaseUrl()` | `string` | Get the base CDN URL for your game's assets |

## Versioning & Deployment

Asset versioning is handled automatically by the RUN.game CLI:

* On each deploy, the CLI generates a manifest of your `cdn-assets` folder.
* Only files that have changed since the last deploy are uploaded.
* Cache-busting is managed for you — no need to manually version filenames.
* Protected assets are flagged in the manifest and served via signed URLs at runtime.

## Best Practices

- Store all CDN assets in `public/cdn-assets/` to ensure they are uploaded on deploy.
- Pair with the [Preloader API](PRELOADER.md) to keep the host splash visible while fetching heavy assets.
- Remember to revoke blob URLs with `URL.revokeObjectURL()` when you no longer need them, to free memory.
- Use `resolveAssetUrls` for batch operations instead of calling `resolveAssetUrl` in a loop.
- Always call `refreshEntitlements()` after a purchase or reward grant — otherwise protected assets may remain inaccessible until the next app session.
- Use `resolveAssetUrls` to pre-check which protected assets a player can access, and show lock/unlock UI accordingly.

