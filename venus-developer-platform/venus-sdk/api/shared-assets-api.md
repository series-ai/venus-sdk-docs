# Shared Assets API

## Venus Shared Assets API

Download host-provisioned asset bundles that are shared across titles or reused within your game. Shared assets reduce bundle size and keep large media up to date without shipping updates.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const charactersBundle = await VenusAPI.sharedAssets.loadCharactersBundle()
console.log(charactersBundle.meta.version)
```

The specific helper names depend on the bundles your host exposes (e.g., `loadBurgerTimeAssetsBundle()`).

### Lifecycle

```typescript
// Optional unload (if provided by host implementation)
await VenusAPI.sharedAssets.unloadBundle?.('characters')
```

### Best Practices

* Inspect the bundle manifest (`meta`) to understand available payloads and version them in your cache.
* Combine shared assets with the Asset Loader or CDN API for custom caching strategies.
* Treat bundle helpers as asynchronous—they may stream or decompress large archives behind the scenes.
