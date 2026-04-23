#  Storage APIs

Persist player data at the right scope using the storage helpers. The SDK exposes multiple layers — device cache, per-game app storage, and cross-app shared storage.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Choosing a Scope

| API                          | Persists where?                        | Typical usage                                      |
| ---------------------------- | -------------------------------------- | -------------------------------------------------- |
| `RundotGameAPI.deviceCache`       | Shared across all apps on the device   | Anonymous hints, recently used app IDs             |
| `RundotGameAPI.appStorage`        | Scoped to your title                   | Core save data, settings, progress                 |
| `RundotGameAPI.sharedStorage`     | Per-player, cross-app by target/namespace | Mailboxes, gifts, hand-offs between apps       |

All single-bucket surfaces share the same API: `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key(index)`. `sharedStorage` is a factory — see [Shared Storage](#shared-storage) below.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Device cache (per-device, cross-game)
await RundotGameAPI.deviceCache.setItem('lastUserId', '12345')
const cached = await RundotGameAPI.deviceCache.getItem('lastUserId')

// App storage (per-game, cloud-synced)
await RundotGameAPI.appStorage.setItem('playerData', JSON.stringify({ level: 5 }))
const snapshot = await RundotGameAPI.appStorage.getItem('playerData')
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

## Shared Storage

`sharedStorage` is per-player cross-app storage addressed by a target app ID plus a namespace the target declares. Source apps deposit data into their own bucket under the target's namespace; readers (the target, or source apps that the target granted `read_all`) fan out across source buckets for the current player.

### Access Policy

Access is controlled by the **target** app's creator on the target's published (public) build. Each target declares zero or more named namespaces, and for each namespace a list of source apps with their grants:

- `write_own` — caller writes (and reads) its own source bucket.
- `read_all` — caller reads across all source buckets in the namespace.

Grants are asymmetric by design. Sender-bucketing is an invariant: a caller can never write into another source's bucket.

### Writer Handle: `open`

```typescript
const mailbox = RundotGameAPI.sharedStorage.open({
  appId: 'target_fan_hub',
  namespace: 'mailbox',
})

await mailbox.setItem('unread', JSON.stringify([{ id: 42, from: 'alpha' }]))
const pending = await mailbox.getItem('unread')
await mailbox.clear()
```

`open` returns a standard `StorageApi` bound to the caller's own source bucket under `(targetAppId, namespace)`. The handle is synchronous — the first method call performs the access-control check and returns a rejected promise if the caller lacks `write_own` for this namespace.

### Reader Handle: `read`

```typescript
const mailboxReader = RundotGameAPI.sharedStorage.read('target_fan_hub', 'mailbox')

// Enumerate sources that have written for the current player
const sources = await mailboxReader.listSources()

// Read one source's bucket in full
const alphaBucket = await mailboxReader.getAllFromSource('game_alpha')

// Read one key across all source buckets
const entries = await mailboxReader.getAllForKey('unread')
// → [{ sourceAppId: 'game_alpha', value: '[{...}]', updatedAt: '2026-04-22T…' }, …]
```

Order is unspecified for `getAllForKey`. Source buckets that don't hold the key are omitted. `listSources` reflects sources that have actually written data for this player — not the declared source list.

### Error Codes

| Condition | Code |
| --- | --- |
| Target app has no published build, no policy, or the namespace isn't exported | `NAMESPACE_NOT_FOUND` |
| Source app isn't in the namespace's grant list, or lacks the required verb | `ACCESS_DENIED` |

### Mobile App Version Requirement

`sharedStorage` requires the RUN.game app at the mobile platform level. Older clients without the bridge handler reject `sharedStorage` calls with an unknown-handler error. Games that use `sharedStorage` should document a minimum mobile app version in their release notes.

### Limits

Per-bucket limits match other storage surfaces: 128 items, 8 KiB values, 128 KiB total bytes. A namespace can declare up to 32 source apps; `getAllForKey` fan-out inherits that ceiling.

## Best Practices

- Serialize complex objects explicitly (e.g., `JSON.stringify`) and version your schema for future migrations.
- Use device cache for anonymous or non-critical data; rely on `appStorage` (and `sharedStorage` where appropriate) for authoritative state.
- Persist during lifecycle events (`onPause`, `onSleep`) so you don’t lose progress on forced quits.
- Handle `null` responses gracefully—keys may be missing on first launch or after host-side cleanup.
- When working with big numbers, store them as strings (e.g., using the Numbers API) to avoid precision loss.

