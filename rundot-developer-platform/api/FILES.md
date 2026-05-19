# Files API (BETA)

Store and load large binary data — generated portraits, recorded audio, video clips, exported save files, custom assets. Unlike [Storage API](STORAGE.md) (string key-value, 32 KiB max), the Files API stores binary blobs up to 50 MB each via direct-to-cloud uploads.

**All file storage is creator-funded.** The game creator's tier determines the storage cap — players never pay for or manage storage. This matches every PaaS model: the developer pays per GB, not the end user.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// 1. Check if there's enough storage
const canStore = await RundotGameAPI.files.hasStorageAvailable(imageBlob.size)
if (!canStore) {
  console.log('Creator storage quota exceeded or file too large')
  return
}

// 2. Request a signed upload URL
const upload = await RundotGameAPI.files.upload({
  key: 'portrait.png',
  contentType: 'image/png',
  sizeBytes: imageBlob.size,
  visibility: 'public', // optional, default 'private'
})

// 3. PUT the binary data — use uploadHeaders from the response
await fetch(upload.uploadUrl, {
  method: 'PUT',
  headers: upload.uploadHeaders,
  body: imageBlob,
})

// 4. Confirm the upload (runs content moderation + media metadata extraction)
const entry = await RundotGameAPI.files.confirmUpload('portrait.png')
// entry.mediaMetadata = { width: 512, height: 512 }

// 5. Read it back later
const url = await RundotGameAPI.files.getUrl({ key: 'portrait.png' })
const response = await fetch(url)
const data = await response.blob()
```

## Two-Phase Upload

Uploads are a two-step process:

1. **`upload(params)`** — requests a short-lived signed PUT URL. The server validates the creator's quota, content type, and file size before returning the URL and required headers.
2. **`confirmUpload(key)`** — called after your `fetch()` PUT succeeds. The server verifies the object, runs content moderation (images/video), probes media metadata, transitions to `active`, and updates the creator's storage counter. This runs asynchronously via the job system — the SDK awaits completion automatically.

Binary data flows directly from your game to cloud storage — no bridge serialization overhead. The `uploadHeaders` returned by `upload()` **must** be included in your PUT request (they contain the `Content-Type` and size-range validation headers).

## API Reference

### `upload(params: UploadParams): Promise<UploadResult>`

```typescript
interface UploadParams {
  key: string           // unique per (app, player) — your chosen filename
  contentType: string   // MIME type (must be in the allowlist)
  sizeBytes: number     // declared size — enforced at the cloud level
  visibility?: 'private' | 'public'  // default: 'private'
}

interface UploadResult {
  uploadUrl: string                    // signed PUT URL (15-minute TTL)
  uploadHeaders: Record<string, string> // MUST be included in the PUT request
  key: string
  expiresAt: number                    // epoch ms
}
```

### `confirmUpload(key: string, options?: ConfirmUploadOptions): Promise<FileEntry>`

Finalize an upload. Runs content moderation for images and video, extracts media metadata. Returns the finalized file entry.

```typescript
interface ConfirmUploadOptions {
  clientRef?: string  // opaque tag echoed back in job events
}
```

Internally, `confirmUpload` submits a server-side job. The SDK awaits job completion and returns the final `FileEntry`. If you need to track confirm jobs across sessions (e.g., the player closes the app mid-upload), use `getCompletedJobs()`.

### `getUrl(params: GetUrlParams): Promise<string>`

Get a signed read URL (4-hour TTL).

```typescript
interface GetUrlParams {
  key: string
  targetAppId?: string       // cross-app read (same creator only)
  targetProfileId?: string   // cross-player read (public files only)
}
```

### `getUrls(params: GetUrlsParams): Promise<GetUrlsResult>`

Batch read URLs for up to 50 keys in one call. Keys that don't exist or are inaccessible are silently omitted.

```typescript
interface GetUrlsParams {
  keys: string[]             // up to 50 keys
  targetAppId?: string
  targetProfileId?: string
}

interface GetUrlsResult {
  urls: Record<string, string>  // key → signed URL
  ttlMs: number                 // TTL for all URLs in this batch
}
```

### `getMetadata(params: GetMetadataParams): Promise<FileEntry>`

Get metadata for a stored file. Accepts the same cross-read params as `getUrl`.

```typescript
interface GetMetadataParams {
  key: string
  targetAppId?: string
  targetProfileId?: string
}
```

### `delete(key: string): Promise<void>`

Delete a file. Removes the cloud object and decrements the creator's storage counter.

### `list(params?: ListParams): Promise<ListResult>`

List active files for the current player. Supports pagination, prefix filtering, and cross-app listing.

```typescript
interface ListParams {
  prefix?: string      // filter keys by prefix
  cursor?: string      // pagination cursor from previous response
  limit?: number       // 1–500 (default: 100)
  targetAppId?: string // list from a sibling app (same creator)
}

interface ListResult {
  files: FileEntry[]
  nextCursor?: string  // pass to next call for more results
}
```

### `setVisibility(key: string, visibility: 'private' | 'public'): Promise<FileEntry>`

Toggle file visibility. Only the file owner can change visibility.

### `getQuota(): Promise<StorageQuota>`

Get the creator's current storage quota and usage.

```typescript
interface StorageQuota {
  usedBytes: number       // creator's total usage across all apps
  capBytes: number        // cap for creator's tier
  availableBytes: number  // capBytes - usedBytes
  maxFileBytes: number    // per-file size limit (default 50 MB)
  tier: number            // creator tier 1-5
}
```

### `hasStorageAvailable(sizeBytes: number): Promise<boolean>`

Pre-flight convenience check. Returns `true` if the file fits within both the creator's remaining quota and the per-file size limit. Equivalent to:

```typescript
const q = await RundotGameAPI.files.getQuota()
return sizeBytes <= q.availableBytes && sizeBytes <= q.maxFileBytes
```

### `transform(params: TransformParams): Promise<TransformResult>`

Server-side media processing. Most operations complete synchronously; `upscale` runs asynchronously via the job system — the SDK awaits completion automatically.

```typescript
type TransformParams =
  | { op: 'concat'; inputs: string[]; outputKey: string; deleteInputs?: boolean; clientRef?: string }
  | { op: 'trim'; input: string; outputKey: string; startMs: number; endMs: number; clientRef?: string }
  | { op: 'thumbnail'; input: string; outputKey: string; atMs?: number; width?: number; height?: number; clientRef?: string }
  | { op: 'frameExtract'; input: string; outputKey: string; atMs?: number | 'last'; width?: number; height?: number; clientRef?: string }
  | { op: 'upscale'; input: string; outputKey: string; targetResolution?: '720p' | '1080p'; clientRef?: string }
  | { op: 'copy'; input: string; outputKey: string; clientRef?: string }

interface TransformResult {
  jobId: string
  entry: FileEntry   // output file with mediaMetadata populated
}
```

| Operation | Description | Async? |
|-----------|-------------|--------|
| `concat` | Concatenate multiple audio/video files into one | No |
| `trim` | Extract a time range from audio/video | No |
| `thumbnail` | Extract a still frame from video as an image | No |
| `frameExtract` | Extract a frame at a specific time (or `'last'`), with optional resize | No |
| `upscale` | AI upscale image/video to 720p or 1080p | Yes (job) |
| `copy` | Server-side duplicate of a file to a new key | No |

The optional `clientRef` is echoed back in `FilesJobEvent` when polling `getCompletedJobs()`, useful for correlating async results across sessions.

### `getCompletedJobs(): Promise<FilesJobEvent[]>`

Poll for completed async jobs (`confirmUpload`, `upscale`) that finished since last poll. Useful for recovering results after the player leaves and returns.

```typescript
interface FilesJobEvent {
  jobId: string
  type: 'fileConfirm' | 'upscale'
  status: 'completed' | 'failed'
  clientRef?: string                      // echoed from request
  params: Record<string, unknown>
  result?: FileEntry | TransformResult    // present when completed
  error?: string                          // present when failed
}
```

## Types

```typescript
interface FileEntry {
  key: string
  sizeBytes: number
  contentType: string
  visibility: 'private' | 'public'
  url: string          // signed read URL (4-hour TTL)
  createdAt: string    // ISO 8601
  updatedAt: string
  mediaMetadata?: MediaMetadata
}

interface MediaMetadata {
  width?: number        // images and video
  height?: number
  durationMs?: number   // video and audio
  codec?: string        // e.g. 'h264', 'vp9', 'aac'
}
```

## File Visibility

Files are **private by default** — only the owning player can access them. Setting a file to `public` allows any authenticated player in the same app to read it via `getUrl({ key, targetProfileId: ownerProfileId })`.

This enables the **UGC + Files pattern**: upload a video, set it to `public`, store `{ key, profileId }` in UGC data, and other players resolve the content via `getUrl({ key, targetProfileId })`.

## Cross-App Reads

Apps by the same creator can read each other's files: `getUrl({ key: 'avatar.png', targetAppId: 'sibling-app' })`. The server validates that both apps share the same `ownerUserId`. Writes are always scoped to the current app.

## Content Moderation

At `confirmUpload` time:
- **Images** are scanned via Vision SafeSearch
- **Videos** are scanned via Video Intelligence

Rejected content is deleted before becoming active. The error code `FILES_CONTENT_REJECTED` includes the rejection category.

## Key Rules

- **1–256 bytes** UTF-8
- No path separators (`/`, `\`)
- No `..`, no leading `.`
- No control characters
- Keys are unique per (app, player) — uploading with an existing key overwrites

## Allowed Content Types

`image/png`, `image/jpeg`, `image/webp`, `audio/mpeg`, `audio/wav`, `audio/ogg`, `video/mp4`, `video/webm`, `video/quicktime`, `application/octet-stream`, `application/json`, `text/plain`

## Storage Quotas

Storage caps are tied to the **game creator's tier**, not the player:

| Creator Tier | Storage Cap |
|-------------|------------|
| 1 (Internal) | 50 TB |
| 2 (Premium) | 500 GB |
| 3 (Established) | 100 GB |
| 4 (New) | 10 GB |
| 5 (Default) | 1 GB |

The cap is **global** across all of a creator's apps. Use `getQuota()` or `hasStorageAvailable()` to check before uploading.

## Limits

| Limit | Value |
|-------|-------|
| Per-file size | 50 MB (configurable) |
| Per-creator global | Tier-dependent (see above) |
| Upload URL TTL | 15 minutes |
| Read URL TTL | 4 hours |
| Pending upload timeout | 30 minutes |
| Batch `getUrls` max keys | 50 |

## Error Codes

| Code | Raised when |
|------|------------|
| `FILES_INVALID_KEY` | Key fails validation. |
| `FILES_INVALID_CONTENT_TYPE` | Content type not in the allowlist. |
| `FILES_FILE_TOO_LARGE` | `sizeBytes` exceeds the per-file cap. |
| `FILES_CREATOR_QUOTA_EXCEEDED` | Upload would push the creator past their storage cap. |
| `FILES_CREATOR_NOT_RESOLVED` | Game has no `ownerUserId`. |
| `FILES_NOT_FOUND` | No active file with this key (or private file accessed by non-owner). |
| `FILES_UPLOAD_NOT_CONFIRMED` | `confirmUpload` called but cloud object missing or size mismatch. |
| `FILES_RATE_LIMITED` | Request rate exceeded. Sandbox `HttpFilesApi` throws `RateLimitedError` with `retryAfterMs`. |
| `FILES_CROSS_APP_DENIED` | Cross-app read denied (different creator). |
| `FILES_CONTENT_REJECTED` | Content moderation rejected the upload. |

## Differences from Storage API

| | Storage API | Files API |
|---|---|---|
| **Data type** | Strings only | Binary blobs |
| **Max value** | 32 KiB | 50 MB |
| **Transfer** | Through Cloud Run | Direct to cloud storage |
| **Quota** | Per-bucket limits | Creator-funded, tier-based |
| **Moderation** | None | Image + video scanned at confirm |
| **Use case** | Settings, progress, small state | Images, audio, video, large saves |

Use Storage API for small string data. Use Files API for binary assets.
