# Avatar 3D API

## Venus Avatar 3D API

{% include "../../../../.gitbook/includes/avatar-3d-api-description.md" %}

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const currentAvatar = await VenusAPI.avatar3d.loadAvatar()

const result = await VenusAPI.avatar3d.showEditor({
  currentAvatar,
  contextData: { source: 'settings' },
})

if (result.wasChanged && result.savedAvatarId) {
  console.log('Avatar updated:', result.savedAvatarId)
}
```

### Asset Management

```typescript
const manifest = await VenusAPI.avatar3d.downloadManifest()
const assetPaths = await VenusAPI.avatar3d.downloadAssetPaths()

const savedId = await VenusAPI.avatar3d.saveAvatar(currentAvatar)
await VenusAPI.avatar3d.deleteAvatar()
```

### Best Practices

* Pass `contextData` to understand editor exits (e.g., settings vs onboarding).
* Cache manifests locally so re-opening the editor is snappy.
* Handle the case where avatar editing is disabled (`EXPO_PUBLIC_DISABLE_3D_AVATARS=true` query param).
