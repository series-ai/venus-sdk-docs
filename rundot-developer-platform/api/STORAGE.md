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
- **Hot/Cold Tiering**: Inactive or large document partitions are automatically sealed and promoted to `Files` (`RundotGameAPI.files`), leaving lightweight `ColdRef` pointers in storage. This allows documents to scale far beyond individual storage bucket limits without hitting the 10 MiB quota.
- **Zero SDK Version Pinning**: Connect your storage surface structurally without importing the SDK directly:
  ```typescript
  import { setDocumentStoreProvider } from '@series-inc/rundot-document'
  import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

  setDocumentStoreProvider(() => ({
    storage: () => RundotGameAPI.appStorage,
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
