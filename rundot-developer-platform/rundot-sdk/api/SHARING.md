# Sharing API

Store shared content and create share parameters. Recipients can jump straight into your content.

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

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `shareLinkAsync(options)` | `Promise<{ shareUrl }>` | Create and share a link with custom parameters |
| `createQRCodeAsync(options)` | `Promise<{ qrCode }>` | Generate a QR code data URL |

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
