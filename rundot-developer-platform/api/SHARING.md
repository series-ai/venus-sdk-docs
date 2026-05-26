# Sharing API

Store shared content and create share parameters. Recipients can jump straight into your content.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

Here are some examples for what you might use it for:

* Store a user-created level and share a link to it, allowing anyone to play it
* Generate a challenge, like "Can you beat my score?"
* Generate a QR code for in-person content sharing.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const { shareUrl } = await RundotGameAPI.social.shareLinkAsync({
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
```

`shareLinkAsync` automatically launches the platform share UI (native sheet on mobile, `navigator.share` or clipboard fallback on web). Use the returned URL for telemetry or custom UI, but no additional modal call is required.

## QR Codes

```typescript
const { qrCode } = await RundotGameAPI.social.createQRCodeAsync({
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

`createQRCodeAsync` only returns data—display or share the image yourself. Pair it with an on-screen `<img>` element, print asset, or custom UI element.

## Interpreting shareParams on Game Start

The data stored when creating a share link get passed to your game as share parameters in the [context](CONTEXT.md). You can load the data back into your game from a share link by accessing the share parameters like so:

```typescript
const shareParams = RundotGameAPI.context.shareParams
if (shareParams.challengeType === 'highscore') {
  startHighScoreChallenge(parseInt(shareParams.scoreToBeat, shareParams.challengerId, 10))
}
```

Launch parameters are fully custom. Define the schema your game needs (`challengeType`, `dailyPuzzleId`, `referredBy`, etc.) and decode when the experience boots. For example, say you have a game where users can share user-generated content with one another in the form of custom levels. Here is how you might handle share links

```typescript
const onShare = async (levelData, levelName) => {
  const { shareUrl } = await RundotGameAPI.social.shareLinkAsync({
    shareParams: {
      levelData: levelData,
      levelName: levelName
    },
  })
  return shareUrl
}

const onLaunch = () => {
  const shareParams = RundotGameAPI.context.shareParams
  if (Object.keys(shareParams).includes('levelData')) {
    loadLevel(shareParams.levelData, shareParams.levelName)
  } else {
    loadBlankLevel()
  }
}
```

## File Sharing (BETA)

Share locally-created files — recorded gameplay clips, screenshots, generated images — directly to native share targets (TikTok, Instagram, Messages, etc.) via the Web Share API.

{% hint style="info" %}
File sharing works on **both mobile web and native iOS/Android**. On web, it uses the Web Share API (iOS Safari 15+, Chrome 89+, Edge 89+). On native, it opens the system share sheet via `expo-sharing`. Use `canShareFileAsync` to feature-detect before recording or generating shareable content.

**Native limitation:** `cancelled` is always `false` on iOS/Android — the native share sheet does not report whether the user dismissed it.
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
* **Data formats:** Pass a `Blob`, `ArrayBuffer`, or pre-encoded base64 string. Blob/ArrayBuffer inputs are encoded to base64 automatically.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `shareLinkAsync(options)` | `Promise<{ shareUrl }>` | Create and share a link with custom parameters |
| `createQRCodeAsync(options)` | `Promise<{ qrCode }>` | Generate a QR code data URL |
| `shareFileAsync(options)` | `Promise<{ cancelled }>` | Share a local file to native share targets (BETA) |
| `canShareFileAsync()` | `Promise<{ supported }>` | Check if file sharing is available (BETA) |

## Payload Guidelines

* Keep `shareParams` under ~100 KB (share payloads are stored in Firestore with 1 MB document caps).
* Use compact identifiers (IDs, short strings) and fetch bulky data from your backend.
* Sanitize user-provided metadata before sharing publicly.
* Fallback when social APIs are unavailable (desktop browsers without share support).

## Best Practices

* Use `shareLinkAsync` for instant share sheets; reserve `createQRCodeAsync` for in-person or kiosk flows.
* Inspect `RundotGameAPI.context.shareParams` on boot and branch gameplay early—players expect to land in the invited context immediately.
* Reward referrers only after validating signatures or payloads on your backend to prevent spoofing.
* Provide manual copy buttons for desktop browsers without native sharing.
