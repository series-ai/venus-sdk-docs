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

## Value Rules

Storage values are **strings**. Serialize objects with `JSON.stringify` before writing and parse on read.

Keys must be non-empty strings of at most 256 bytes (UTF-8), must not contain `.`, and must not start with `__` (reserved for internal metadata).

Batch writes pass an array of `{ key: string, value: string }` items, as shown in [Batch Helpers](#batch-helpers) above.

## Limits

These limits apply to `appStorage` and to each `sharedStorage` source bucket. `sharedStorage` adds a namespace-level source-app cap described below.

| Limit | Value |
| --- | --- |
| Items per bucket | 128 |
| Value size (UTF-8 bytes) | 8 KiB |
| Total bytes per bucket | 128 KiB |
| Items per batch call | 128 |
| Request body size | 64 KiB |
| Key size (UTF-8 bytes) | 256 |

`sharedStorage` also caps the number of source apps declared per namespace at **32**; `getAllForKey` fan-out inherits that ceiling.

Exceeding a bucket-level limit (item count or total bytes) rejects with `QUOTA_EXCEEDED`. Exceeding a batch or key/value limit rejects with `INVALID_ARGUMENT`.

## Error Codes

All cloud-backed storage surfaces (`appStorage`, `sharedStorage`) reject with a structured error envelope on failure:

```json
{ "success": false, "error": { "code": "INVALID_ARGUMENT", "message": "…" } }
```

| Code | Raised when |
| --- | --- |
| `INVALID_ARGUMENT` | Key or value fails validation (empty, wrong type, oversized, forbidden character, reserved `__` prefix), `index` is not a non-negative integer, batch exceeds 128 items, or `gameId` is missing. |
| `PROFILE_REQUIRED` | The caller is authenticated but has no player profile. |
| `QUOTA_EXCEEDED` | The write would push the bucket past 128 items or 128 KiB of total data. |
| `RATE_LIMITED` | Per-player request budget for this storage surface has been exhausted. **Note:** the 429 response currently uses a different shape — `{ error: "Too Many Requests", message, retryAfter }` — instead of the envelope above. Handle both when reading the HTTP 429 path. |
| `NAMESPACE_NOT_FOUND` | `sharedStorage` only. Target app has no published build, no policy, or doesn't export the namespace. |
| `ACCESS_DENIED` | `sharedStorage` only. Caller isn't in the namespace's grant list for the requested verb. |

Handle each code by attaching a `.catch()` (or `try`/`catch` around `await`) — see [Error Handling](../error-handling.md).

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

### Shared Storage Errors and Limits

- `NAMESPACE_NOT_FOUND` is raised when the target app has no published build, has no policy, or doesn't export the namespace.
- `ACCESS_DENIED` is raised when the caller isn't in the namespace's grant list for the requested verb (`write_own` / `read_all`).
- Cross-cutting error codes (`INVALID_ARGUMENT`, `PROFILE_REQUIRED`, `QUOTA_EXCEEDED`, `RATE_LIMITED`) apply here too — see [Error Codes](#error-codes).
- Per-bucket limits match `appStorage` — see [Limits](#limits). A namespace can additionally declare up to 32 source apps; `getAllForKey` fan-out inherits that ceiling.
- `sharedStorage` requires the current SDK build on the client and a RUN.game app build that ships the shared-storage handler on mobile. Older clients reject `sharedStorage` calls with an unknown-handler error, surfaced as a rejected promise.

## Best Practices

- Serialize complex objects explicitly (e.g., `JSON.stringify`) and version your schema for future migrations.
- Use device cache for anonymous or non-critical data; rely on `appStorage` (and `sharedStorage` where appropriate) for authoritative state.
- Persist during lifecycle events (`onPause`, `onSleep`) so you don’t lose progress on forced quits.
- Handle `null` responses gracefully—keys may be missing on first launch or after host-side cleanup.
- When working with big numbers, store them as strings (e.g., using the Numbers API) to avoid precision loss.

