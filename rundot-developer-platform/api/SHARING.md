# Sharing API

Store shared content and create share parameters. Recipients can jump straight into your content.

{% hint style="warning" %}
All SDK methods can reject. Unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

Here are some examples for what you might use it for:

* Store a user-created level and share a link to it, allowing anyone to play it
* Generate a challenge, like "Can you beat my score?"
* Generate a QR code for in-person content sharing.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const { shareUrl, shareLinkId } = await RundotGameAPI.social.shareLinkAsync({
  shareParams: {
    challengeType: 'highscore',
    scoreToBeat: '1500',
    challengerId: RundotGameAPI.getProfile().id,
  },
  metadata: {
    title: 'Beat my score!',
    description: 'Can you top 1500 points?',
    imageUrl: 'https://cdn.example.com/share-highscore.png',
  },
})

console.log('Shared link:', shareUrl)
console.log('Share handle:', shareLinkId)
```

`shareLinkAsync` resolves to `{ shareUrl, shareLinkId }`. On mobile (iOS/Android) it opens the native share sheet; on web it copies the share URL to the clipboard (with a fallback toast). Use `shareUrl` for telemetry or custom UI; no additional modal call is required. Keep `shareLinkId` around if you want to attach or read click data later (see [Click Tracking](#click-tracking-beta)).

### Share metadata

The optional `metadata` object holds OpenGraph values that social networks use to render rich link previews (Twitter, iMessage, etc.). The same shape is accepted by both `shareLinkAsync` and `createQRCodeAsync`. Every field is optional.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Preview title shown in link cards. |
| `description` | `string` | No | Preview description shown under the title. |
| `imageUrl` | `string` | No | Preview image URL. Must be an HTTPS URL for most social platforms to render the card. |

{% hint style="info" %}
`metadata.imageUrl` must be served over HTTPS. Most social platforms drop the preview image for non-HTTPS URLs.
{% endhint %}

## QR Codes

```typescript
const { shareUrl, qrCode, shareLinkId } = await RundotGameAPI.social.createQRCodeAsync({
  shareParams: {
    challengeType: 'daily',
    dailyPuzzleId: '2024-11-04',
  },
  metadata: {
    title: 'Daily Challenge',
    description: 'Scan to play today!',
  },
  qrOptions: {
    size: 512,
    margin: 4,
    format: 'png',
  },
})

document.querySelector('#qr').src = qrCode
```

`createQRCodeAsync` resolves to `{ shareUrl, qrCode, shareLinkId }`, so you get the underlying link alongside the QR image and don't need a second call to reuse it. It only returns data; display or share the image yourself. Pair it with an on-screen `<img>` element, print asset, or custom UI element.

### QR options

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `size` | `number` | No | `256` | QR image size in pixels. |
| `margin` | `number` | No | `2` | Quiet-zone margin around the QR code, in pixels. |
| `format` | `'png' \| 'svg'` | No | `'png'` | Output format. `png` returns a `data:image/png` URL; `svg` returns a `data:image/svg+xml` URL. |

## Interpreting shareParams on Game Start

The data stored when creating a share link get passed to your game as share parameters in the [context](CONTEXT.md). You can load the data back into your game from a share link by accessing the share parameters like so:

```typescript
const shareParams = RundotGameAPI.context.shareParams
if (shareParams.challengeType === 'highscore') {
  startHighScoreChallenge(parseInt(shareParams.scoreToBeat, 10), shareParams.challengerId)
}
```

Launch parameters are fully custom. Define the schema your game needs (`challengeType`, `dailyPuzzleId`, `referredBy`, etc.) and decode when the experience boots.

{% hint style="warning" %}
`shareParams` is typed `Record<string, string>`: every value must be a string. To carry structured data (objects, arrays, numbers), `JSON.stringify` it before sharing and `JSON.parse` it back from `context.shareParams` on launch.
{% endhint %}

For example, say you have a game where users can share user-generated content with one another in the form of custom levels. Here is how you might handle share links

```typescript
const onShare = async (levelData, levelName) => {
  const { shareUrl } = await RundotGameAPI.social.shareLinkAsync({
    shareParams: {
      levelData: JSON.stringify(levelData),
      levelName: levelName
    },
  })
  return shareUrl
}

const onLaunch = () => {
  const shareParams = RundotGameAPI.context.shareParams
  if (Object.keys(shareParams).includes('levelData')) {
    loadLevel(JSON.parse(shareParams.levelData), shareParams.levelName)
  } else {
    loadBlankLevel()
  }
}
```

## Click Tracking (BETA)

Every share (`shareLinkAsync` or `createQRCodeAsync`) returns a `shareLinkId`. Use it to record metadata when a recipient clicks through, then read those clicks back for referral and attribution flows.

{% hint style="warning" %}
Click metadata is readable by any authenticated user who has the `shareLinkId`. Never write PII or sensitive user data. Values are returned verbatim, so escape them before rendering in HTML.
{% endhint %}

### `addShareClickDataAsync(options): Promise<void>`

Write click metadata to a share as the current user (the clicker). Metadata is a full replacement: each call overwrites the entire metadata object for that user, so send the complete set of keys every time you want to preserve prior values.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shareLinkId` | `string` | Yes | The share to attach metadata to (from `shareLinkAsync` / `createQRCodeAsync`). |
| `metadata` | `Record<string, string>` | Yes | String key-value pairs. Limits: max 20 keys, 64-char keys, 1024-char values, 4 KB total. |

```typescript
// shareLinkId comes from the share you created, or from a share param your
// game stored in shareParams when generating the link.
await RundotGameAPI.social.addShareClickDataAsync({
  shareLinkId,
  metadata: { source: 'qr', referredScore: '1500' },
})
```

### `getShareClicksAsync(options): Promise<{ clicks: ShareClickData[]; truncated: boolean }>`

Query all click data for a share. Returns up to 200 click records ordered by `createdAt` ascending; `truncated` is `true` when that cap was hit.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shareLinkId` | `string` | Yes | The share to query. |

```typescript
const { clicks, truncated } = await RundotGameAPI.social.getShareClicksAsync({
  shareLinkId,
})
console.log(`${clicks.length} clicks${truncated ? ' (capped at 200)' : ''}`)
```

### `getMyShareClickDataAsync(options): Promise<ShareClickData | null>`

Get the current user's click data for a specific share, or `null` if they haven't clicked it. Useful for one-time referral rewards and "you already redeemed this" checks.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shareLinkId` | `string` | Yes | The share to query. |

```typescript
const myClick = await RundotGameAPI.social.getMyShareClickDataAsync({
  shareLinkId,
})
if (myClick) {
  console.log('Already clicked at', myClick.createdAt)
}
```

### `ShareClickData`

The return shape for the click-tracking methods.

| Field | Type | Description |
|-------|------|-------------|
| `clickerProfileId` | `string` | Profile ID of the user who recorded the click. |
| `metadata` | `Record<string, string>` | The string key-value pairs written via `addShareClickDataAsync`. |
| `createdAt` | `number` | When the click was first recorded, in epoch milliseconds. |
| `updatedAt` | `number` | When the click metadata was last updated, in epoch milliseconds. |

## File Sharing (BETA)

Share locally-created files (recorded gameplay clips, screenshots, generated images) directly to native share targets (TikTok, Instagram, Messages, etc.) via the Web Share API.

{% hint style="info" %}
File sharing works on **both mobile web and native iOS/Android**. On web, it uses the Web Share API (iOS Safari 15+, Chrome 89+, Edge 89+). On native, it opens the system share sheet via `expo-sharing`. Use `canShareFileAsync` to feature-detect before recording or generating shareable content.

**Native limitation:** `cancelled` is always `false` on iOS/Android; the native share sheet does not report whether the user dismissed it.
{% endhint %}

### Feature Detection

```typescript
const { supported } = await RundotGameAPI.social.canShareFileAsync()
if (supported) {
  showRecordButton()
}
```

### Sharing a File

```typescript
// Share a screenshot as PNG
const pngBlob = canvas.toBlob('image/png')
const result = await RundotGameAPI.social.shareFileAsync({
  data: pngBlob,
  filename: 'screenshot.png',
  mimeType: 'image/png',
  title: 'Check out my score!',
  text: 'I just scored 1500 points!',
})

if (result.cancelled) {
  console.log('User dismissed the share sheet')
}
```

{% hint style="warning" %}
`shareFileAsync` rejects (throws) when the platform does not support file sharing, or when the file fails MIME/size validation. It does not return a soft failure for those cases; `cancelled` only reports user dismissal. Gate calls behind `canShareFileAsync()` and wrap them in `try/catch`.
{% endhint %}

### Share file options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `Blob \| ArrayBuffer \| string` | Yes | File bytes. `Blob` / `ArrayBuffer` are base64-encoded automatically. A `string` must be raw base64 of the file bytes (see Data formats below). |
| `filename` | `string` | Yes | Filename presented to the share target. |
| `mimeType` | `ShareFileMimeType` | Yes | One of the [accepted file types](#accepted-file-types). Any other value is a compile-time error and a runtime rejection. |
| `title` | `string` | No | Title passed alongside the file to the native share sheet. |
| `text` | `string` | No | Text passed alongside the file to the native share sheet. |

### Accepted File Types

| MIME Type | Extension | Notes |
|-----------|-----------|-------|
| `video/mp4` | `.mp4` | Recorded gameplay clips |
| `image/png` | `.png` | Screenshots, generated images |
| `image/jpeg` | `.jpeg` | Photos, compressed screenshots |
| `image/webp` | `.webp` | Modern image format |
| `image/gif` | `.gif` | Animated images |

### Limits

* **Max file size:** 10 MB. Files exceeding this are rejected before encoding.
* **Rate limit:** One share per 3 seconds per game instance.
* **Data formats:** Pass a `Blob`, `ArrayBuffer`, or pre-encoded base64 string. Blob/ArrayBuffer inputs are encoded to base64 automatically. A pre-encoded `string` must be raw base64 of the file bytes, NOT a data URI: strip any `data:image/png;base64,` prefix first.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `shareLinkAsync(options)` | `Promise<{ shareUrl, shareLinkId }>` | Create and share a link with custom parameters; `shareLinkId` is the handle for click tracking |
| `createQRCodeAsync(options)` | `Promise<{ shareUrl, qrCode, shareLinkId }>` | Generate a QR code data URL plus the underlying share URL and `shareLinkId` |
| `addShareClickDataAsync(options)` | `Promise<void>` | Record click metadata on a share as the current user (BETA) |
| `getShareClicksAsync(options)` | `Promise<{ clicks, truncated }>` | Read all click records for a share, up to 200 (BETA) |
| `getMyShareClickDataAsync(options)` | `Promise<ShareClickData \| null>` | Read the current user's click data for a share, or `null` (BETA) |
| `shareFileAsync(options)` | `Promise<{ cancelled }>` | Share a local file to native share targets (BETA) |
| `canShareFileAsync()` | `Promise<{ supported }>` | Check if file sharing is available (BETA) |

## Payload Guidelines

* Keep `shareParams` under ~100 KB (share payloads are stored in Firestore with 1 MB document caps).
* Use compact identifiers (IDs, short strings) and fetch bulky data from your backend.
* Sanitize user-provided metadata before sharing publicly.
* Fallback when social APIs are unavailable (desktop browsers without share support).

## Best Practices

* Use `shareLinkAsync` for instant share sheets; reserve `createQRCodeAsync` for in-person or kiosk flows.
* Inspect `RundotGameAPI.context.shareParams` on boot and branch gameplay early; players expect to land in the invited context immediately.
* Reward referrers only after validating signatures or payloads on your backend to prevent spoofing.
* Provide manual copy buttons for desktop browsers without native sharing.
