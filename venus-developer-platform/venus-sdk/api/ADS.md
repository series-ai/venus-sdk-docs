# Ads API

Use Venus ads to monetize with rewarded videos, interstitials, and availability checks that respect platform rate limits. The host manages presentation; your game just requests placements and reacts to the result.

{% hint style="danger" %}
Ads are not currently supported on Desktop. \
Calling the Ads API on Desktop will show a universal link to the mobile app.&#x20;
{% endhint %}

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

const isReady = await VenusAPI.ads.isRewardedAdReadyAsync()
if (isReady) {
  const rewarded = await VenusAPI.ads.showRewardedAdAsync()
  if (rewarded) {
    grantReward()
  }
}
```

## Common Flows

* **Interstitial breaks:** gate level transitions with `VenusAPI.ads.showInterstitialAd()` and resume gameplay when it resolves `true`.
* **Reward previews:** disable earn buttons when `isRewardedAdReadyAsync()` returns `false` to avoid extra clicks.
* **Cooldown UI:** show countdowns using host-provided availability and re-check before enabling the next view.

## Best Practices

* Always check readiness before calling display methods—hosts may throttle requests during campaigns.
* Guard reward logic so you only grant the prize when the call resolves `true`.
* Wrap ad calls in try/catch and fail silently; players might deny permissions or lose connectivity mid-flight.
