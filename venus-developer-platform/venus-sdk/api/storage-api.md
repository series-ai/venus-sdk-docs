# Storage API

## Venus Storage APIs

Persist player data at the right scope using the Venus storage helpers. The SDK exposes multiple layers—device cache, app storage, global storage—and a convenience `VenusAPI.storage` namespace when you want a single save bucket.

### Choosing a Scope

| API                        | Persists where?                       | Typical usage                                    |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| `VenusAPI.deviceCache`     | Shared across all apps on the device  | Anonymous hints, recently used app IDs           |
| `VenusAPI.appStorage`      | Scoped to your title                  | Core save data, settings, progress               |
| `VenusAPI.globalStorage`   | Follows the signed-in user everywhere | Cross-game preferences, entitlements, currencies |
| `VenusAPI.storage` (alias) | Same backing store as `appStorage`    | Simple games that only need one save namespace   |

All surfaces share the same API: `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key(index)`.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

// Device cache (per-device, cross-game)
await VenusAPI.deviceCache.setItem('lastUserId', '12345')
const cached = await VenusAPI.deviceCache.getItem('lastUserId')

// App storage (per-game)
await VenusAPI.appStorage.setItem('playerData', JSON.stringify({ level: 5 }))

// Global storage (per-user, cross-game)
await VenusAPI.globalStorage.setItem('preferences', JSON.stringify({ theme: 'dark' }))

// Saves alias (same as appStorage)
await VenusAPI.storage.setItem('playerData', JSON.stringify({ level: 10 }))
const snapshot = await VenusAPI.storage.getItem('playerData')
```

### Batch Helpers

```typescript
await VenusAPI.appStorage.setMultipleItems([
  { key: 'settings', value: JSON.stringify({ audio: true }) },
  { key: 'inventory', value: JSON.stringify(inventoryState) },
])

await VenusAPI.appStorage.removeMultipleItems(['inventory', 'settings'])

const allItems = await VenusAPI.appStorage.getAllItems()
```

The same helpers exist on `VenusAPI.storage` if you prefer the alias.

### Best Practices

* Serialize complex objects explicitly (e.g., `JSON.stringify`) and version your schema for future migrations.
* Use device cache for anonymous or non-critical data; rely on app/global storage for authoritative state.
* Persist during lifecycle events (`onPause`, `onSleep`) so you don’t lose progress on forced quits.
* Handle `null` responses gracefully—keys may be missing on first launch or after host-side cleanup.
* When working with big numbers, store them as strings (e.g., using the Numbers API) to avoid precision loss.
