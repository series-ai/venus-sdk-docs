# Analytics API

Record gameplay telemetry, funnel steps, and user properties. Events flow to the host analytics pipeline with consistent schema and automatic attribution.

> **Note**: This API fires events to the analytics pipeline—it records data but does not provide analytics dashboards or reporting. Use the platform dashboard to view and analyze your recorded events.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

await RundotGameAPI.analytics.logEvent('level_complete', {
  level: 5,
  score: 1200,
  timeElapsed: 98,
})

await RundotGameAPI.analytics.setUserProperty('vip_status', 'gold')
```

## Custom Events

Record custom events with payloads to capture gameplay context:

```typescript
await RundotGameAPI.analytics.recordCustomEvent('boss_defeated', {
  bossId: 'dragon',
  attempts: 3,
  remainingHp: 12,
  weaponUsed: 'fire_sword',
})

await RundotGameAPI.analytics.recordCustomEvent('purchase_complete', {
  itemId: 'gold_pack_100',
  price: 99,
  currency: 'runbucks',
})
```

## Funnel Tracking

Track funnels with step numbers for precise drop-off reporting:

```typescript
// Onboarding funnel
await RundotGameAPI.analytics.trackFunnelStep(1, 'tutorial_start', 'onboarding')
await RundotGameAPI.analytics.trackFunnelStep(2, 'tutorial_movement', 'onboarding')
await RundotGameAPI.analytics.trackFunnelStep(3, 'tutorial_combat', 'onboarding')
await RundotGameAPI.analytics.trackFunnelStep(4, 'tutorial_complete', 'onboarding')

// Purchase funnel
await RundotGameAPI.analytics.trackFunnelStep(1, 'shop_opened', 'purchase')
await RundotGameAPI.analytics.trackFunnelStep(2, 'item_selected', 'purchase')
await RundotGameAPI.analytics.trackFunnelStep(3, 'checkout_started', 'purchase')
await RundotGameAPI.analytics.trackFunnelStep(4, 'purchase_complete', 'purchase')
```

## User Properties

Set persistent user properties for segmentation:

```typescript
await RundotGameAPI.analytics.setUserProperty('player_level', '25')
await RundotGameAPI.analytics.setUserProperty('subscription_tier', 'premium')
await RundotGameAPI.analytics.setUserProperty('preferred_mode', 'pvp')
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `logEvent(name, params?)` | `Promise<void>` | Log a named event with parameters |
| `recordCustomEvent(name, params?)` | `Promise<void>` | Record a custom event with payload |
| `trackFunnelStep(step, name, funnel)` | `Promise<void>` | Track a step in a conversion funnel |
| `setUserProperty(name, value)` | `Promise<void>` | Set a user property for segmentation |

## Best Practices

- Keep event names stable and snake_case for easier querying.
- Limit payload size; send identifiers for large objects instead of entire blobs.
- Combine analytics with `RundotGameAPI.profile` data (id, username) for joined analysis without extra network calls.
- Batch non-critical analytics behind `onPause` or `onSleep` to avoid mid-gameplay network churn.
- Define your funnel steps upfront and keep step numbers consistent.
- Use meaningful event names that describe what happened (e.g., `boss_defeated`, not `event_1`).
