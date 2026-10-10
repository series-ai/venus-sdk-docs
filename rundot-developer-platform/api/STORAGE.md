# Storage APIs

Persist player data at the right scope using the storage helpers. The SDK exposes multiple layers: device cache, per-game app storage, per-creator owner storage, and cross-app shared storage.

{% hint style="info" %}
**Need to store large binary files?** See [Files API](FILES.md) for binary blob storage (images, audio, video, up to 50 MB per file) with direct-to-cloud uploads, media metadata, and server-side transforms.
{% endhint %}

{% hint style="warning" %}
All SDK methods can reject; unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

{% hint style="info" %}
**Use the SDK storage APIs below for player data.** `deviceCache`, `appStorage`, `ownerStorage`, and `sharedStorage` are the supported ways to persist state; they work consistently across web and mobile and are scoped to the right sharing model. Browser storage APIs (`localStorage`, `sessionStorage`, `IndexedDB`, cookies, etc.) are not available inside the game iframe; see [Runtime Environment](../runtime-environment.md) for what the platform provides.
{% endhint %}

## Choosing a Scope

| API | Persists where? | Typical usage |
| --- | --- | --- |
| `RundotGameAPI.deviceCache` | Shared across all apps on the device | Anonymous hints, recently used app IDs |
| `RundotGameAPI.appStorage` | Scoped to your title per player | Core save data, settings, progress |
| `RundotGameAPI.ownerStorage` | Shared across all titles by the same creator, per player | Creator-wide profile, cross-title progression |
| `RundotGameAPI.sharedStorage` | Per-player, cross-app by target/namespace | Mailboxes, gifts, hand-offs between apps |

Every single-bucket surface exposes the base API: `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key(index)`. The cloud-backed buckets (`appStorage`, `ownerStorage`, and each `sharedStorage.open()` handle) additionally expose the batch and whole-bucket helpers: `getAllItems`, `getAllData`, `setMultipleItems`, and `removeMultipleItems`. `appStorage` uniquely supports atomic `compareAndSwap` and multi-key fetch via `getMultipleItems`. `deviceCache` is the minimal subset; it exposes only the six base methods, so calling a batch or `getAll*` method on it is unsupported and rejects at runtime. `sharedStorage` is a factory: see [Shared Storage](#shared-storage) below.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Device cache (per-device, cross-game)
await RundotGameAPI.deviceCache.setItem('lastUserId', '12345')
const cached = await RundotGameAPI.deviceCache.getItem('lastUserId')

// App storage (per-game, cloud-synced, scoped per player)
await RundotGameAPI.appStorage.setItem('playerData', JSON.stringify({ level: 5 }))
const snapshot = await RundotGameAPI.appStorage.getItem('playerData')
```

## Batch Helpers & Atomic CAS

```typescript
await RundotGameAPI.appStorage.setMultipleItems([
  { key: 'settings', value: JSON.stringify({ audio: true }) },
  { key: 'inventory', value: JSON.stringify(inventoryState) },
])

await RundotGameAPI.appStorage.removeMultipleItems(['inventory', 'settings'])

// getAllItems() returns an array of the bucket's KEYS; use getAllData() for values.
const allKeys = await RundotGameAPI.appStorage.getAllItems()

// getAllData() returns a { key: value } record for the whole bucket.
const allData = await RundotGameAPI.appStorage.getAllData()

// getMultipleItems() retrieves a subset of keys in a single round-trip (max 100 keys)
const selected = await RundotGameAPI.appStorage.getMultipleItems(['settings', 'inventory'])

// compareAndSwap() performs atomic compare-and-swap on a single key
const casResult = await RundotGameAPI.appStorage.compareAndSwap(
  'head',
  currentValue, // or null if expecting non-existence
  nextValue,    // or null to delete on match
)
if (!casResult.swapped) {
  console.log('CAS conflict, current value in storage is:', casResult.currentValue)
}
```

{% hint style="info" %}
**Mind the return shapes.** `getAllItems()` returns a `string[]` of the bucket's **keys**. `getAllData()` returns a `Record<string, string>` mapping each key to its value. Use `getAllData()` when you need values; use `getAllItems()` when you only need the list of keys.
{% endhint %}

Hosted, mock, and playground storage use this same flat whole-bucket shape. There is no `{ data, updatedAt }` wrapper around the value returned to game code.

These batch and whole-bucket helpers are available on `appStorage`, `ownerStorage`, and each `sharedStorage.open()` handle. `compareAndSwap` and `getMultipleItems` are supported on `appStorage`. They are **not** available on `deviceCache`, which exposes only the base six methods.

## Value Rules

Storage values are **strings**. Serialize objects with `JSON.stringify` before writing and parse on read.

`null`, `undefined`, objects, numbers, and booleans are invalid values; use `removeItem` or `removeMultipleItems` to delete keys. The SDK does not stringify non-string values or treat `null` as a delete.

Keys must be non-empty strings of at most 256 bytes (UTF-8), must not contain `.`, and must not start with `__` (reserved for internal metadata). The key `lastUpdated` is also reserved for internal timestamps.

Batch writes pass an array of `{ key: string, value: string }` items, as shown in [Batch Helpers & Atomic CAS](#batch-helpers--atomic-cas) above.

Mutation validation is atomic. If any key or value in a batch is invalid, the call rejects before any valid-looking member is written.

## Limits

These limits apply to `appStorage`, `ownerStorage`, and to each `sharedStorage` source bucket. `sharedStorage` adds a namespace-level source-app cap described below.

| Limit | Value | Scope |
| --- | --- | --- |
| Items per bucket | 128 | Per player bucket |
| Value size (UTF-8 bytes) | 1,000,000 bytes (~977 KiB) | Per key-value item |
| Total bytes per bucket | 10 MiB | Per player bucket |
| Affected storage data per mutation | 8 MiB | Per request |
| Items per batch call | 400 | Per batch call |
| Multi-get keys | 100 | Per request |
| Key size (UTF-8 bytes) | 256 | Per key |

### Per-Bucket Scoping (Not Shared Game-Wide)

Every cloud storage bucket in `appStorage` is strictly partitioned per authenticated player:
```
playerStorage/{profileId}/app/{appId}
```
Each player receives their own isolated 10 MiB bucket with up to 128 items. **There is no shared 10 MiB quota across the whole game.** A game with 100,000 active players has 100,000 independent buckets totaling up to 1,000,000 MiB; one player cannot consume or exhaust another player's quota.

For games with complex save structures or heavy creator tooling, platform staff can configure `storageQuotaOverrides` per app ID to raise a game's per-bucket limits up to 1,024 items and 100 MiB per player bucket.

### Value Size and Warnings

Values above **256 KiB** are accepted but logged as a soft-limit warning server-side; treat 256 KiB as the comfortable working size and 1,000,000 bytes (~977 KiB) as the hard ceiling (each value is stored individually in its own Firestore document under the bucket's `items` subcollection). Values exceeding 1,000,000 bytes are rejected with `PAYLOAD_TOO_LARGE` (413). For larger or binary payloads use the [Files API](FILES.md).

A mutation's affected-data estimate includes existing key/value data being deleted or replaced plus new key/value data being written. If a clear, clear-first replacement, or incremental batch would exceed the 8 MiB mutation budget or Firestore's single-transaction write limit, the call rejects with `PAYLOAD_TOO_LARGE` before any writes are committed. Existing bucket data remains intact. Split incremental work into smaller calls; a quota override does not raise this per-mutation limit.

`sharedStorage` also caps the number of source apps declared per namespace at **32**; `getAllForKey` fan-out inherits that ceiling.

Exceeding a bucket-level limit (item count or total bytes) rejects with `QUOTA_EXCEEDED`. Exceeding a batch, key size, or invalid character limit rejects with `INVALID_ARGUMENT`.

### Structuring your data

Each key is a separate record, so model your data by how you access it: **group what you read and write together; split what you access independently.**

- For typical save state that you load at launch and persist at checkpoints, prefer **a few medium values grouped by lifecycle** (e.g. `settings`, `progress`, `inventory`) over either one giant blob or hundreds of tiny keys. Whole-bucket reads (`getAllData`) cost one read per key, so fewer keys means cheaper loads, and each grouped value stays well under the per-value ceiling.
- For a field updated on its own (a counter, a "last seen" timestamp), use a **separate key** so a write touches only that record.
- Avoid storing hundreds of tiny independent keys; if you need many independently-queryable records, that data belongs in a purpose-built collection, not a key-value bucket.

## Error Codes

Native `deviceCache` mutations can reject with these local-storage codes:

| Code | Raised when |
| --- | --- |
| `DEVICE_STORAGE_FULL` | The device has no room for a cache write, removal, or app-scoped clear. Drop nonessential cache data and ask the player to free device storage if cleanup still fails. |
| `DEVICE_STORAGE_ERROR` | A native cache mutation failed for another reason. Keep the failure non-blocking when the cached data is optional. |

All cloud-backed storage surfaces (`appStorage`, `ownerStorage`, `sharedStorage`) reject with an `Error` carrying a machine-readable `code` on failure. Game code does not need to parse an internal HTTP response envelope.

| Code | Raised when |
| --- | --- |
| `INVALID_ARGUMENT` | Key fails validation (empty, not a string, oversized > 256 bytes, forbidden character `.` or reserved `__` prefix or `lastUpdated`), value is not a string, `index` is not a non-negative integer, batch exceeds 400 items, multi-get exceeds 100 keys, or `gameId` is missing. |
| `PAYLOAD_TOO_LARGE` | Value exceeds 1,000,000 bytes (~977 KiB), or one mutation exceeds the 8 MiB affected-data budget / single-transaction write limit; no bucket changes are committed. |
| `PROFILE_REQUIRED` | The caller is authenticated but has no player profile. |
| `QUOTA_EXCEEDED` | The write would push the bucket past 128 items or 10 MiB of total data. |
| `RATE_LIMITED` | The dedicated per-player storage request budget has been exhausted. The error includes `retryAfterMs`; do not parse an HTTP status from its message. |
| `TIMEOUT` | A buffered storage write did not complete within the 30-second caller wait ceiling. The write can remain queued for a later retry even though that caller has received the timeout. |
| `OWNER_IDENTITY_UNAVAILABLE` | `ownerStorage` only. The game record is missing an owner identity, so the creator-scoped bucket cannot be resolved. Surfaces when a game has been published without the creator-identity backfill applied. |
| `NAMESPACE_NOT_FOUND` | `sharedStorage` only. Target app has no published build, no policy, or doesn't export the namespace. |
| `ACCESS_DENIED` | `sharedStorage` only. Caller isn't in the namespace's grant list for the requested verb. |

Handle each code by attaching a `.catch()` (or `try`/`catch` around `await`); see [Error Handling](../error-handling.md).

## Owner Storage

`ownerStorage` is per-player storage shared across every title owned by the same creator. The same player who saves data in Creator X's first game reads that data back when they launch Creator X's second game. Players of a different creator's games see an independent bucket.

Use it for:

- A unified creator profile (display name, avatar choice, opt-ins) across a creator's catalog.
- Cross-title progression (shared currency, battle-pass state) where the creator's games are designed to hand off state.
- Creator-wide settings a player sets once and expects to persist in every title from that creator.

Use [`appStorage`](#quick-start) instead when state is specific to one title; use [`sharedStorage`](#shared-storage) when unrelated creators need to exchange data for the same player.

### API

`ownerStorage` exposes the base and batch surfaces of `appStorage`:

```typescript
// Write / read
await RundotGameAPI.ownerStorage.setItem('creatorProfile', JSON.stringify({ displayName: 'ArcticFox' }))
const raw = await RundotGameAPI.ownerStorage.getItem('creatorProfile')

// Enumerate
const count = await RundotGameAPI.ownerStorage.length()
const firstKey = await RundotGameAPI.ownerStorage.key(0)
const keys = await RundotGameAPI.ownerStorage.getAllItems() // array of key strings
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

Method signatures for base and batch methods match `appStorage`; only the scoping differs. Value rules, batch shape, and [limits](#limits) also match `appStorage`. (Note: `compareAndSwap` and `getMultipleItems` are unique to `appStorage` and not exposed on `ownerStorage`).

### Error Codes

All codes in the top-level [Error Codes](#error-codes) table apply. One code is specific to `ownerStorage`:

- `OWNER_IDENTITY_UNAVAILABLE`: the game record has no stored owner identity yet, so the creator-scoped bucket cannot be resolved. This is an operational issue rather than an input error; rebuilding or republishing the game after the creator-identity backfill has run clears it. Surface it in your error logs but don't treat it as user-facing.

### Requirements

`ownerStorage` requires the current SDK build on the client and a RUN.world app build that ships the owner-storage handler on mobile. Older RUN.world builds reject `ownerStorage` calls with an unknown-handler error, surfaced as a rejected promise. Games that depend on `ownerStorage` should feature-detect or document a minimum supported app version in their release notes.

## Shared Storage

`sharedStorage` is per-player cross-app storage addressed by a target app ID plus a namespace the target declares. Source apps deposit data into their own bucket under the target's namespace; readers (the target, or source apps that the target granted `read_all`) fan out across source buckets for the current player.

### Access Policy

Access is controlled by the **target** app's creator on the target's published (public) build. Each target declares zero or more named namespaces, and for each namespace a list of source apps with their grants:

- `write_own`: caller writes (and reads) its own source bucket.
- `read_all`: caller reads across all source buckets in the namespace.

Grants are asymmetric by design. Sender-bucketing is an invariant: a caller can never write into another source's bucket.

**Self-target is implicitly allowed.** When the caller's own app is the target (i.e. `appId` is omitted, or matches the caller's authenticated app ID), the host skips the namespace policy lookup and grants both `write_own` and `read_all` for that namespace. Self-target therefore needs no namespace declaration: useful for app-private cross-source data (e.g. progress shared between your own H5 and native builds).

### Writer Handle: `open`

```typescript
// Self-target: the most common case. Omit appId; the host substitutes
// the caller's own appId. No namespace policy declaration is required for
// own-app self-target.
const ownProgress = RundotGameAPI.sharedStorage.open({ namespace: 'progress' })
await ownProgress.setItem('level', '5')

// Cross-app target: pass an explicit appId.
const mailbox = RundotGameAPI.sharedStorage.open({
  appId: 'target_fan_hub',
  namespace: 'mailbox',
})

await mailbox.setItem('unread', JSON.stringify([{ id: 42, from: 'alpha' }]))
const pending = await mailbox.getItem('unread')
await mailbox.clear()
```

`open` returns a standard `StorageApi` bound to the caller's own source bucket under `(targetAppId, namespace)`. It is the same full surface as `appStorage`: beyond `setItem`, `getItem`, `removeItem`, and `clear`, the handle also supports `length`, `key(index)`, and the batch / whole-bucket helpers `getAllItems`, `getAllData`, `setMultipleItems`, and `removeMultipleItems`, all scoped to your own source bucket:

```typescript
// The open() handle is a full StorageApi over your own source bucket.
await mailbox.setMultipleItems([
  { key: 'unread', value: JSON.stringify([{ id: 42, from: 'alpha' }]) },
  { key: 'lastSync', value: new Date().toISOString() },
])
const everything = await mailbox.getAllData()  // { unread: '…', lastSync: '…' }
```

The handle is synchronous: the first method call performs the access-control check and returns a rejected promise if the caller lacks `write_own` for this namespace.

Passing `appId: ''` (an empty string) throws synchronously. Use omission (or `undefined`) for self-target, or a non-empty string for a cross-app target.

### Reader Handle: `read`

```typescript
// Self-target reader: fan out across source buckets that have written
// into your own app's namespace. Omit appId.
const ownProgressReader = RundotGameAPI.sharedStorage.read({ namespace: 'progress' })

const mailboxReader = RundotGameAPI.sharedStorage.read({
  appId: 'target_fan_hub',
  namespace: 'mailbox',
})

// Enumerate sources that have written for the current player
const sources = await mailboxReader.listSources()

// Read one source's bucket in full ({} when that source has never written for this player)
const alphaBucket = await mailboxReader.getAllFromSource('game_alpha')

// Read a single key from a specific source's bucket (null if absent)
const alphaUnread = await mailboxReader.get('game_alpha', 'unread')

// Read one key across all source buckets
const entries = await mailboxReader.getAllForKey('unread')
// → [{ sourceAppId: 'game_alpha', value: '[{...}]', updatedAt: '2026-04-22T…' }, …]
```

`read` accepts the same `{ appId?, namespace }` shape as `open`. Empty-string `appId` throws synchronously.

Order is unspecified for `getAllForKey`. Source buckets that don't hold the key are omitted. `listSources` reflects sources that have actually written data for this player, not the declared source list. `getAllFromSource` resolves to an empty object `{}` (not `null`, and it does not reject) when that source has never written into this target/namespace for the current player; branch on `Object.keys(bucket).length` rather than a null check.

Each `getAllForKey` entry is `{ sourceAppId: string, value: string, updatedAt?: string }`. `updatedAt` is an ISO-8601 string when the source bucket has a recorded timestamp; it is **optional** and may be `undefined` when a source bucket has no recorded timestamp. The example above always shows it populated, but treat it as possibly absent.

### Shared Storage Errors and Limits

- `NAMESPACE_NOT_FOUND` is raised when the target app has no published build, has no policy, or doesn't export the namespace.
- `ACCESS_DENIED` is raised when the caller isn't in the namespace's grant list for the requested verb (`write_own` / `read_all`).
- Cross-cutting error codes (`INVALID_ARGUMENT`, `PROFILE_REQUIRED`, `QUOTA_EXCEEDED`, `RATE_LIMITED`) apply here too; see [Error Codes](#error-codes).
- Per-bucket limits match `appStorage`; see [Limits](#limits). A namespace can additionally declare up to 32 source apps; `getAllForKey` fan-out inherits that ceiling.
- `sharedStorage` requires the current SDK build on the client and a RUN.world app build that ships the shared-storage handler on mobile. Older clients reject `sharedStorage` calls with an unknown-handler error, surfaced as a rejected promise.

## Collaborative Document Substrate

For structured, multi-user, or agent-collaborative documents (such as design docs, world bibles, and lore books), `@series-inc/rundot-document` provides a CRDT-based substrate that persists through `appStorage` and tiers large assets to `Files`.

### Key Characteristics
- **Content-Addressed Merkle Tree**: State changes are written as immutable nodes and committed via atomic `compareAndSwap` on a single head key.
- **Hot/Cold Tiering**: Inactive or large document partitions can be sealed and promoted to `Files` (`RundotGameAPI.files`) via explicit promotion functions, leaving lightweight `ColdRef` pointers in storage. This allows documents to scale far beyond individual storage bucket limits without hitting the 10 MiB per-bucket quota.
- **Zero SDK Version Pinning (Adapter Wrapper)**: Connect your storage surface structurally using an adapter that maps the SDK's `getAllItems()` to the document store's `getAllKeys()` requirement:
  ```typescript
  import { setDocumentStoreProvider } from '@series-inc/rundot-document'
  import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

  setDocumentStoreProvider(() => ({
    storage: () => ({
      ...RundotGameAPI.appStorage,
      getAllKeys: () => RundotGameAPI.appStorage.getAllItems(),
    }),
  }))
  ```
- **Unified Comments and Suggestions**: Discussion threads and change proposals share an atomic accept/reject model on field registers, eliminating race conditions between concurrent reviews.

## Best Practices

- Serialize complex objects explicitly (e.g., `JSON.stringify`) and version your schema for future migrations.
- Use device cache for anonymous or non-critical data; rely on `appStorage`, `ownerStorage`, or `sharedStorage` (whichever matches the state's scope) for authoritative state.
- Persist during lifecycle events (`onPause`, `onSleep`) so you don’t lose progress on forced quits.
- Hosted writes are buffered and may remain pending through transient authentication or rate-limit failures. Normal game teardown lets that buffer drain while the RUN client is still alive; terminating the RUN client process cannot guarantee a final retry.
- Handle `null` responses gracefully; keys may be missing on first launch or after host-side cleanup.
- When working with big numbers, store them as strings (e.g., using the Numbers API) to avoid precision loss.
