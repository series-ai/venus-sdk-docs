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
  console.log('Creator storage quota exceeded')
  return
}

// 2. Request a signed upload URL
const upload = await RundotGameAPI.files.upload({
  key: 'portrait.png',
  contentType: 'image/png',
  sizeBytes: imageBlob.size,
  visibility: 'public', // optional, default 'private'
})

// 3. PUT the binary data directly to cloud storage
await fetch(upload.uploadUrl, {
  method: 'PUT',
  body: imageBlob,
  headers: { 'Content-Type': 'image/png' },
})

// 4. Confirm the upload to finalize (includes content moderation + media metadata)
const entry = await RundotGameAPI.files.confirmUpload('portrait.png')
// entry.mediaMetadata = { width: 512, height: 512 }

// 5. Read it back later
const url = await RundotGameAPI.files.getUrl('portrait.png')
const response = await fetch(url)
const data = await response.blob()
```

## Two-Phase Upload

Uploads are a two-step process:

1. **`upload(params)`** — requests a short-lived signed PUT URL. The server validates the creator's quota, content type, and file size before returning the URL.
2. **`confirmUpload(key)`** — called after your `fetch()` PUT succeeds. The server verifies the object, runs content moderation (images/video), probes media metadata, transitions to `active`, and updates the creator's storage counter.

Binary data flows directly from your game to cloud storage — no bridge serialization overhead.

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
  uploadUrl: string  // signed PUT URL
  key: string
  expiresAt: number  // epoch ms — URL expires after ~15 minutes
}
```

### `confirmUpload(key: string): Promise<FileEntry>`

Finalize an upload. Runs content moderation for images and video. Returns the finalized file entry with media metadata.

### `getUrl(key: string, opts?: FileReadOptions): Promise<string>`

Get a short-lived signed read URL (15-minute TTL).

```typescript
interface FileReadOptions {
  appId?: string       // cross-app read (same creator only)
  profileId?: string   // cross-player read (public files only)
}
```

### `getMetadata(key: string, opts?: FileReadOptions): Promise<FileEntry>`

Get metadata for a stored file.

### `delete(key: string): Promise<void>`

Delete a file. Removes the cloud object and decrements the creator's storage counter.

### `list(opts?: { appId?: string }): Promise<FileEntry[]>`

List all active files for the current player. Optionally list files from a sibling app (same creator).

### `setVisibility(key: string, visibility: 'private' | 'public'): Promise<FileEntry>`

Toggle file visibility. Only the file owner can change visibility.

### `getQuota(): Promise<CreatorStorageQuota>`

Get the creator's current storage quota and usage.

```typescript
interface CreatorStorageQuota {
  usedBytes: number       // creator's total usage across all apps
  capBytes: number        // cap for creator's tier
  availableBytes: number  // capBytes - usedBytes
  maxFileBytes: number    // per-file size limit (default 50 MB)
  tier: number            // creator tier 1-5
}
```

### `hasStorageAvailable(sizeBytes: number): Promise<boolean>`

Pre-flight check. Returns `true` if the file fits within the creator's remaining quota.

### `transform(params: TransformParams): Promise<TransformResult>`

Server-side media processing. Async via the job system.

```typescript
type TransformParams =
  | { op: 'concat'; inputs: string[]; outputKey: string; deleteInputs?: boolean }
  | { op: 'trim'; input: string; outputKey: string; startMs: number; endMs: number }
  | { op: 'thumbnail'; input: string; outputKey: string; atMs?: number; width?: number; height?: number }

interface TransformResult {
  jobId: string
  entry: FileEntry   // output file with mediaMetadata populated
}
```

## Types

```typescript
interface FileEntry {
  key: string
  sizeBytes: number
  contentType: string
  visibility: 'private' | 'public'
  url: string          // signed read URL (short-lived)
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

Files are **private by default** — only the owning player can access them. Setting a file to `public` allows any authenticated player in the same app to read it via `getUrl(key, { profileId: ownerProfileId })`.

This enables the **UGC + Files pattern**: upload a video, set it to `public`, store `{ key, profileId }` in UGC data, and other players resolve the content via `getUrl`.

## Cross-App Reads

Apps by the same creator can read each other's files: `getUrl('avatar.png', { appId: 'sibling-app' })`. The server validates that both apps share the same `ownerUserId`. Writes are always scoped to the current app.

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

The cap is **global** across all of a creator's apps. Use `getQuota()` to check current usage.

## Limits

| Limit | Value |
|-------|-------|
| Per-file size | 50 MB (configurable) |
| Per-creator global | Tier-dependent (see above) |
| Signed URL TTL | 15 minutes |
| Pending upload timeout | 30 minutes |

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
| `FILES_RATE_LIMITED` | Request rate exceeded. |
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
