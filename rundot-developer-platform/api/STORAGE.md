#  Storage APIs

Persist player data at the right scope using the  storage helpers. The SDK exposes multiple layers—device cache, app storage, global storage—and a convenience `RundotGameAPI.storage` namespace when you want a single save bucket.

## Choosing a Scope

| API                          | Persists where?                        | Typical usage                                      |
| ---------------------------- | -------------------------------------- | -------------------------------------------------- |
| `RundotGameAPI.deviceCache`       | Shared across all apps on the device   | Anonymous hints, recently used app IDs             |
| `RundotGameAPI.appStorage`        | Scoped to your title                   | Core save data, settings, progress                 |
| `RundotGameAPI.globalStorage`     | Follows the signed-in user everywhere  | Cross-game preferences, entitlements, currencies   |
| `RundotGameAPI.storage` (alias)   | Same backing store as `appStorage`     | Simple games that only need one save namespace     |

All surfaces share the same API: `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key(index)`.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Device cache (per-device, cross-game)
await RundotGameAPI.deviceCache.setItem('lastUserId', '12345')
const cached = await RundotGameAPI.deviceCache.getItem('lastUserId')

// App storage (per-game)
await RundotGameAPI.appStorage.setItem('playerData', JSON.stringify({ level: 5 }))

// Global storage (per-user, cross-game)
await RundotGameAPI.globalStorage.setItem('preferences', JSON.stringify({ theme: 'dark' }))

// Saves alias (same as appStorage)
await RundotGameAPI.storage.setItem('playerData', JSON.stringify({ level: 10 }))
const snapshot = await RundotGameAPI.storage.getItem('playerData')
```

## Batch Helpers

```typescript
await RundotGameAPI.appStorage.setMultipleItems([
  { key: 'settings', value: JSON.stringify({ audio: true }) },
  { key: 'inventory', value: JSON.stringify(inventoryState) },
])

await RundotGameAPI.appStorage.removeMultipleItems(['inventory', 'settings'])

const allItems = await RundotGameAPI.appStorage.getAllItems()
```

The same helpers exist on `RundotGameAPI.storage` if you prefer the alias.

## Best Practices

- Serialize complex objects explicitly (e.g., `JSON.stringify`) and version your schema for future migrations.
- Use device cache for anonymous or non-critical data; rely on app/global storage for authoritative state.
- Persist during lifecycle events (`onPause`, `onSleep`) so you don’t lose progress on forced quits.
- Handle `null` responses gracefully—keys may be missing on first launch or after host-side cleanup.
- When working with big numbers, store them as strings (e.g., using the Numbers API) to avoid precision loss.

