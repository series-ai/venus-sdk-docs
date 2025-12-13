# CDN API

## Venus CDN API

Resolve asset URLs, fetch remote resources, and stream blobs through the Venus CDN helpers. The API transparently applies host configuration (CDN base URL, auth headers) so assets load consistently across environments.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const assetUrl = VenusAPI.cdn.resolveAssetUrl('images/logo.png')
const avatarUrl = VenusAPI.cdn.resolveAvatarAssetUrl('avatars/model.glb')
const libUrl = VenusAPI.cdn.resolveSharedLibUrl('libs/helper.js')
```

### Fetch Helpers

```typescript
const response = await VenusAPI.cdn.fetchFromCdn('https://cdn.example.com/file.json')
const data = await response.json()

const blob = await VenusAPI.cdn.fetchBlob('path/to/asset.png')
const objectUrl = URL.createObjectURL(blob)
```

### Best Practices

* Prefer the `resolve*` helpers instead of hardcoding CDN prefixes—host environments may switch origins.
* Cache blob URLs when loading large media; remember to revoke them when no longer needed.
* Combine with the Asset Loader API for automatic caching, streaming, and verification.
