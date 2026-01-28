#  Avatar 3D API

Access the  Avatar 3D editor, load player avatars, and manage asset manifests without shipping your own pipeline. The API wraps editor launch, save, delete, and download flows.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const currentAvatar = await RundotGameAPI.avatar3d.loadAvatar()

const result = await RundotGameAPI.avatar3d.showEditor({
  currentAvatar,
  contextData: { source: 'settings' },
})

if (result.wasChanged && result.savedAvatarId) {
  console.log('Avatar updated:', result.savedAvatarId)
}
```

## Asset Management

```typescript
const manifest = await RundotGameAPI.avatar3d.downloadManifest()
const assetPaths = await RundotGameAPI.avatar3d.downloadAssetPaths()

const savedId = await RundotGameAPI.avatar3d.saveAvatar(currentAvatar)
await RundotGameAPI.avatar3d.deleteAvatar()
```

## Best Practices

- Pass `contextData` to understand editor exits (e.g., settings vs onboarding).
- Cache manifests locally so re-opening the editor is snappy.
- Handle the case where avatar editing is disabled (`EXPO_PUBLIC_DISABLE_3D_AVATARS=true` query param).

