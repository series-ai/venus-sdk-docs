# Sharing API

## Venus Social API

Kick off share flows, generate challenge links, and create QR codes for in-person experiences. The Social API packages launch parameters so recipients jump straight into your content.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const { shareUrl } = await VenusAPI.social.shareLinkAsync({
  launchParams: {
    challengeType: 'highscore',
    scoreToBeat: '1500',
    challengerId: VenusAPI.profile.getCurrentProfile().id,
  },
  metadata: {
    title: 'Beat my score!',
    description: 'Can you top 1500 points?',
  },
})

console.log('Shared link:', shareUrl)
```

### QR Codes

```typescript
const { qrCode } = await VenusAPI.social.createQRCodeAsync({
  launchParams: {
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

### Handling Launch Params

```typescript
const launchParams = VenusAPI.getLaunchParams()
if (launchParams.challengeType === 'highscore') {
  startHighScoreChallenge(parseInt(launchParams.scoreToBeat, 10))
}
```

### Best Practices

* Keep launch payloads compact (under \~100 KB); pass IDs for large content.
* Sanitize user-generated metadata before sharing.
* Handle fallback paths when Social APIs are unavailable (desktop browsers without share support).
