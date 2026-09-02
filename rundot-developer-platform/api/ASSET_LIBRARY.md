# Asset Library API

The single surface for platform-provided assets, covering two delivery modes:

- **Referenced asset packs** — packs imported **by reference** from the RUN.game asset library. A referenced pack's files stay on the shared asset CDN instead of being copied into your project; the SDK gives you the URL prefix for a pinned pack version, and you append each file's pack-relative path.
- **Shared asset bundles** — host-provisioned bundles loaded as raw bytes. Hosts serve an embedded copy from disk when one ships in the app, falling back to the CDN otherwise.

{% hint style="info" %}
`RundotGameAPI.sharedAssets` is a deprecated alias for this API: it routes to the same implementation and keeps working, but new code should call `RundotGameAPI.assetLibrary`.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Referenced asset packs: resolve the pinned pack's URL prefix
const base = await RundotGameAPI.assetLibrary.getPackBaseUrl(
  '3D/dungeon/kenney-pirate-pack', // packId
  'abc123def456',                  // version
)
const ship = await gltfLoader.loadAsync(`${base}/models/ship.glb`)

// Shared asset bundles: load raw bytes (embedded copy preferred)
const bundleBuffer = await RundotGameAPI.assetLibrary.loadAssetsBundle(
  'burger-time',
  'characters',
)
console.log('Bundle bytes:', bundleBuffer.byteLength)
```

## API Reference

### `getPackBaseUrl(packId: string, version: string): Promise<string>`

- `packId` and `version` identify a pinned, immutable snapshot of an asset pack. For packs imported into a studio project by reference, both are recorded in `public/assets/<pack-slug>/referenced-files.json` alongside each file's pack-relative `path`.
- Resolves with a URL prefix (no trailing slash). Append a file's pack-relative path to get its full URL.
- The content behind a `(packId, version)` pair never changes — URLs are safe to cache and work identically in the studio preview and the published game.
- Resolution is host-aware: inside the RUN.game app the host supplies the current CDN location, so games keep working even if the platform relocates asset storage. Outside a host (studio preview, playground) or on an older host, the SDK falls back to the default asset-library CDN.

### `loadAssetsBundle(game: string, bundleKey: string, fileType?: string): Promise<ArrayBuffer>`

Resolves with raw bundle bytes (`ArrayBuffer`). Hand them to your own decompressor, asset loader, etc.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `game` | `string` | Yes | - | The CDN namespace for the bundle (typically the game that owns the assets). Only used to build the CDN fallback URL; see the hint below. |
| `bundleKey` | `string` | Yes | - | Identifies the bundle. On the RPC path this is the only field the host uses to resolve the asset; it is also the filename stem in the CDN fallback URL. |
| `fileType` | `string` | No | `'stow'` | File extension used when building the CDN fallback URL (`{game}/{bundleKey}.{fileType}`). |

Host implementations attempt to load via RPC first (serving an embedded copy from disk when one ships in the app) and fall back to the CDN when the RPC lookup fails. Keep CDN and embedded assets in sync.

{% hint style="info" %}
Both `game` and `fileType` only affect the CDN fallback path. When the bundle resolves over RPC, the host sends just `{ assetKey: bundleKey }` and ignores both: the bytes you get back are resolved by `bundleKey` alone. So for same-game assets you can usually pass any truthy `game` and omit `fileType`, relying on the `'stow'` default. The `game` namespace matters only when the RPC lookup misses and the CDN fallback runs.
{% endhint %}

{% hint style="warning" %}
If both the RPC and CDN paths fail, the promise rejects with a generic `Error: Failed to load <bundleKey>`. The underlying RPC and CDN errors are not chained onto it, so you cannot inspect the original cause. Wrap the call in `try`/`catch` and treat any rejection as a load failure (fall back to a placeholder asset).
{% endhint %}

Cross-game bundle loading, the currently available bundles, and the base64 decoding helpers are documented on the [Shared Assets page](SHARED_ASSETS.md); everything there applies to `assetLibrary.loadAssetsBundle` unchanged.

## Why not hard-code pack URLs?

A referenced pack manifest's `url` values work as-is today, but they pin your game to the CDN's current physical location forever. `getPackBaseUrl` resolves the location at runtime through the host, which keeps published games working if asset storage ever moves. Prefer it whenever your project's SDK version provides `RundotGameAPI.assetLibrary`.

## Fetching a whole referenced pack

```typescript
const manifest = JSON.parse(
  await (await fetch('assets/kenney-pirate-pack/referenced-files.json')).text(),
)
const base = await RundotGameAPI.assetLibrary.getPackBaseUrl(
  manifest.packId,
  manifest.version,
)
for (const file of manifest.files) {
  preload(`${base}/${file.path}`)
}
```
