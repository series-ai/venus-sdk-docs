#  Storage APIs

Persist player data at the right scope using the storage helpers. The SDK exposes multiple layers — device cache, per-game app storage, per-creator owner storage, and cross-app shared storage.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Choosing a Scope

| API                          | Persists where?                        | Typical usage                                      |
| ---------------------------- | -------------------------------------- | -------------------------------------------------- |
| `RundotGameAPI.deviceCache`       | Shared across all apps on the device   | Anonymous hints, recently used app IDs             |
| `RundotGameAPI.appStorage`        | Scoped to your title                   | Core save data, settings, progress                 |
| `RundotGameAPI.ownerStorage`      | Shared across all titles by the same creator, per player | Creator-wide profile, cross-title progression   |
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

These limits apply to `appStorage`, `ownerStorage`, and to each `sharedStorage` source bucket. `sharedStorage` adds a namespace-level source-app cap described below.

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

All cloud-backed storage surfaces (`appStorage`, `ownerStorage`, `sharedStorage`) reject with a structured error envelope on failure:

```json
{ "success": false, "error": { "code": "INVALID_ARGUMENT", "message": "…" } }
```

| Code | Raised when |
| --- | --- |
| `INVALID_ARGUMENT` | Key or value fails validation (empty, wrong type, oversized, forbidden character, reserved `__` prefix), `index` is not a non-negative integer, batch exceeds 128 items, or `gameId` is missing. |
| `PROFILE_REQUIRED` | The caller is authenticated but has no player profile. |
| `QUOTA_EXCEEDED` | The write would push the bucket past 128 items or 128 KiB of total data. |
| `RATE_LIMITED` | Per-player request budget for this storage surface has been exhausted. **Note:** the 429 response currently uses a different shape — `{ error: "Too Many Requests", message, retryAfter }` — instead of the envelope above. Handle both when reading the HTTP 429 path. |
| `OWNER_IDENTITY_UNAVAILABLE` | `ownerStorage` only. The game record is missing an owner identity, so the creator-scoped bucket cannot be resolved. Surfaces when a game has been published without the creator-identity backfill applied. |
| `NAMESPACE_NOT_FOUND` | `sharedStorage` only. Target app has no published build, no policy, or doesn't export the namespace. |
| `ACCESS_DENIED` | `sharedStorage` only. Caller isn't in the namespace's grant list for the requested verb. |

Handle each code by attaching a `.catch()` (or `try`/`catch` around `await`) — see [Error Handling](../error-handling.md).

## Owner Storage

`ownerStorage` is per-player storage shared across every title owned by the same creator. The same player who saves data in Creator X's first game reads that data back when they launch Creator X's second game. Players of a different creator's games see an independent bucket.

Use it for:

- A unified creator profile (display name, avatar choice, opt-ins) across a creator's catalog.
- Cross-title progression (shared currency, battle-pass state) where the creator's games are designed to hand off state.
- Creator-wide settings a player sets once and expects to persist in every title from that creator.

Use [`appStorage`](#quick-start) instead when state is specific to one title; use [`sharedStorage`](#shared-storage) when unrelated creators need to exchange data for the same player.

### API

`ownerStorage` exposes the same surface as `appStorage`:

```typescript
// Write / read
await RundotGameAPI.ownerStorage.setItem('creatorProfile', JSON.stringify({ displayName: 'ArcticFox' }))
const raw = await RundotGameAPI.ownerStorage.getItem('creatorProfile')

// Enumerate
const count = await RundotGameAPI.ownerStorage.length()
const firstKey = await RundotGameAPI.ownerStorage.key(0)
const keys = await RundotGameAPI.ownerStorage.getAllItems()
const all = await RundotGameAPI.ownerStorage.getAllData()

// Batch
await RundotGameAPI.ownerStorage.setMultipleItems([
  { key: 'creatorProfile', value: JSON.stringify({ displayName: 'ArcticFox' }) },
  { key: 'creatorOptIns', value: JSON.stringify({ newsletter: true }) },
])
await RundotGameAPI.ownerStorage.removeMultipleItems(['creatorOptIns'])

// Wipe
await RundotGameAPI.ownerStorage.clear()
```

Method signatures are identical to `appStorage` — only the scoping differs. Value rules, batch shape, and [limits](#limits) also match `appStorage`.

### Error Codes

All codes in the top-level [Error Codes](#error-codes) table apply. One code is specific to `ownerStorage`:

- `OWNER_IDENTITY_UNAVAILABLE` — the game record has no stored owner identity yet, so the creator-scoped bucket cannot be resolved. This is an operational issue rather than an input error; rebuilding or republishing the game after the creator-identity backfill has run clears it. Surface it in your error logs but don't treat it as user-facing.

### Requirements

`ownerStorage` requires the current SDK build on the client and a RUN.game app build that ships the owner-storage handler on mobile. Older RUN.game builds reject `ownerStorage` calls with an unknown-handler error, surfaced as a rejected promise. Games that depend on `ownerStorage` should feature-detect or document a minimum supported app version in their release notes.

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
- Use device cache for anonymous or non-critical data; rely on `appStorage`, `ownerStorage`, or `sharedStorage` (whichever matches the state's scope) for authoritative state.
- Persist during lifecycle events (`onPause`, `onSleep`) so you don’t lose progress on forced quits.
- Handle `null` responses gracefully—keys may be missing on first launch or after host-side cleanup.
- When working with big numbers, store them as strings (e.g., using the Numbers API) to avoid precision loss.

