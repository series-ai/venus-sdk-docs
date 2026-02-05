# Ads API

Monetize your game with rewarded videos and interstitials. The host manages presentation; your game just requests placements and reacts to the result.

{% hint style="danger" %}
Ads are not currently supported on Desktop. \
Calling the Ads API on Desktop will show a universal link to the mobile app.&#x20;
{% endhint %}

## Ad Types

### Rewarded Video Ads

Opt-in ads where players receive rewards for watching. Players choose to watch these ads in exchange for in-game benefits.

```typescript
const isReady = await RundotGameAPI.ads.isRewardedAdReadyAsync()
if (isReady) {
  const rewarded = await RundotGameAPI.ads.showRewardedAdAsync()
  if (rewarded) {
    grantReward() // Player watched the full ad
  }
}
```

**Use cases:**
- Extra lives or continues
- Bonus currency
- Speed up timers
- Unlock temporary power-ups

### Interstitial Ads

Forced ads that interrupt gameplay at natural break points. These ads are automatically hidden for platform subscribers.

```typescript
// Show interstitial at level transition
await RundotGameAPI.ads.showInterstitialAd()
// Gameplay resumes after ad completes or is skipped
```

**Use cases:**
- Between levels
- After game over
- After completing a session
- On menu transitions

> **Note**: Interstitial ads are hidden for users with platform subscriptions. Your code can safely call `showInterstitialAd()` for all users—subscribers simply won't see the ad.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const isReady = await RundotGameAPI.ads.isRewardedAdReadyAsync()
if (isReady) {
  const rewarded = await RundotGameAPI.ads.showRewardedAdAsync()
  if (rewarded) {
    grantReward()
  }
}
```

## Complete Example

```typescript
// Rewarded ad button handler
async function onWatchAdForReward() {
  const isReady = await RundotGameAPI.ads.isRewardedAdReadyAsync()
  
  if (!isReady) {
    showMessage('No ad available right now')
    return
  }
  
  try {
    const watched = await RundotGameAPI.ads.showRewardedAdAsync()
    if (watched) {
      grantBonus(100) // Give the reward
      await RundotGameAPI.analytics.recordCustomEvent('rewarded_ad_complete', {
        reward: 'bonus_100',
      })
    }
  } catch (error) {
    console.error('Ad failed:', error)
  }
}

// Interstitial between levels
async function onLevelComplete(level: number) {
  saveProgress(level)
  
  // Show interstitial every 3 levels
  if (level % 3 === 0) {
    await RundotGameAPI.ads.showInterstitialAd()
  }
  
  loadNextLevel(level + 1)
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `isRewardedAdReadyAsync()` | `Promise<boolean>` | Check if a rewarded ad is available |
| `showRewardedAdAsync(options?)` | `Promise<boolean>` | Show rewarded ad; returns `true` if watched |
| `showInterstitialAd(options?)` | `Promise<boolean>` | Show interstitial ad |

## Best Practices

- Always check `isRewardedAdReadyAsync()` before calling display methods—hosts may throttle requests during campaigns.
- Disable reward buttons when `isRewardedAdReadyAsync()` returns `false` to avoid extra clicks.
- Guard reward logic so you only grant the prize when the call resolves `true`.
- Wrap ad calls in try/catch and fail silently; players might deny permissions or lose connectivity.
- Show interstitials at natural break points (level transitions, game over) not mid-gameplay.
- Don't show interstitials too frequently—player experience matters.
