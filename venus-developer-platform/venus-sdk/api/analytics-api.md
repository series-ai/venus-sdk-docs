# Analytics API

## Venus Analytics API

Record gameplay telemetry, funnel steps, and user properties directly through Venus. Events flow to the host analytics pipeline with consistent schema and automatic attribution.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

await VenusAPI.analytics.logEvent('level_complete', {
  level: 5,
  score: 1200,
  timeElapsed: 98,
})

await VenusAPI.analytics.setUserProperty('vip_status', 'gold')
```

### Funnels & Custom Events

*   Track funnels with step numbers for precise drop-off reporting:

    ```typescript
    await VenusAPI.analytics.trackFunnelStep(1, 'tutorial_start', 'onboarding')
    await VenusAPI.analytics.trackFunnelStep(2, 'tutorial_complete', 'onboarding')
    ```
*   Record custom events with payloads to capture deeper context:

    ```typescript
    await VenusAPI.analytics.recordCustomEvent('boss_defeated', {
      bossId: 'dragon',
      attempts: 3,
      remainingHp: 12,
    })
    ```

### Best Practices

* Keep event names stable and snake\_case for easier querying.
* Limit payload size; send identifiers for large objects instead of entire blobs.
* Combine analytics with `VenusAPI.profile` data (id, username) for joined analysis without extra network calls.
* Batch non-critical analytics behind `onPause` or `onSleep` to avoid mid-combat network churn.
