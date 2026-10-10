# Analytics API

Record gameplay telemetry and funnel steps. Events flow to the host analytics pipeline with consistent schema and automatic attribution.

{% hint style="info" %}
Analytics calls are fire-and-forget. The SDK catches RPC failures internally and logs a non-fatal warning to the console; your code does not need a `.catch()` handler, and rejections will not crash the host. This is unlike `storage`, `ads`, and `purchases`, which can reject and require handling: see [Error Handling](../error-handling.md).
{% endhint %}

> **Note**: This API fires events to the analytics pipeline; it records data but does not provide analytics dashboards or reporting. Use the platform dashboard to view and analyze your recorded events.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

RundotGameAPI.analytics.recordCustomEvent('level_complete', {
  level: 5,
  score: 1200,
  timeElapsed: 98,
})
```

## Best Practices

* Keep event names stable and snake\_case for easier querying.
* Limit payload size; send identifiers for large objects instead of entire blobs.
* Combine analytics with `RundotGameAPI.profile` data (id, username) for joined analysis without extra network calls.
* Batch non-critical analytics behind `onPause` or `onSleep` to avoid mid-gameplay network churn.
* Define your funnel steps upfront and keep step numbers consistent.
* Use meaningful event names that describe what happened (e.g., `boss_defeated`, not `event_1`).

## Custom Events

Record custom events with payloads to capture gameplay context. Events flow to the analytics pipeline automatically — no registration step is required for them to appear in your dashboards:

```typescript
RundotGameAPI.analytics.recordCustomEvent('boss_defeated', {
  bossId: 'dragon',
  attempts: 3,
  remainingHp: 12,
  weaponUsed: 'fire_sword',
})

RundotGameAPI.analytics.recordCustomEvent('purchase_complete', {
  itemId: 'gold_pack_100',
  price: 99,
  currency: 'runbits',
})
```

The payload is an optional `Record<string, any>` (an arbitrary key/value object), so you can attach whatever context you want. Calling `recordCustomEvent('name')` with no payload is valid when the event name alone is enough.

Every custom event is automatically stamped with `_game_version`, the running H5 build version supplied by the host. This parameter is reserved: if game code includes its own `_game_version`, the host overwrites it with the authoritative running version.

{% hint style="info" %}
The interface names the second argument `payload`, while this doc's API Reference table and the deprecated root `logCustomEvent({ eventName, params })` call it `params`. They refer to the same thing.
{% endhint %}

## Funnel Tracking

Track funnels with step numbers for precise drop-off reporting. This is a separate, opt-in step from the above Custom Events:

```typescript
// Onboarding funnel
RundotGameAPI.analytics.trackFunnelStep(1, 'tutorial_start', 'onboarding')
RundotGameAPI.analytics.trackFunnelStep(2, 'tutorial_movement', 'onboarding')
RundotGameAPI.analytics.trackFunnelStep(3, 'tutorial_combat', 'onboarding')
RundotGameAPI.analytics.trackFunnelStep(4, 'tutorial_complete', 'onboarding')

// Purchase funnel
RundotGameAPI.analytics.trackFunnelStep(1, 'shop_opened', 'purchase')
RundotGameAPI.analytics.trackFunnelStep(2, 'item_selected', 'purchase')
RundotGameAPI.analytics.trackFunnelStep(3, 'checkout_started', 'purchase')
RundotGameAPI.analytics.trackFunnelStep(4, 'purchase_complete', 'purchase')
```

You can optionally provide a `funnelOrder` value to indicate where a funnel occurs in your overall user journey. 

This is useful when you want to compare multiple funnels (for example, onboarding and purchase) side by side in a single dashboard while preserving their chronological order.

```typescript
// Onboarding funnel
RundotGameAPI.analytics.trackFunnelStep(1, 'tutorial_start', 'onboarding', 1) // the 1 indicates this is the first funnel in the game
RundotGameAPI.analytics.trackFunnelStep(2, 'tutorial_movement', 'onboarding', 1)

// Purchase funnel
RundotGameAPI.analytics.trackFunnelStep(1, 'shop_opened', 'purchase', 2) // the 2 indicates this is the second funnel in the game
RundotGameAPI.analytics.trackFunnelStep(2, 'item_selected', 'purchase', 2)
```

If this argument is not passed, the funnel will have an order value of 0.

## Automatic foreground play telemetry

The updated RUN host records `active_play_60s_v1` once per game open after
60 seconds of ready foreground time. Games do not need to call an SDK method
for this event. The full player counts only focused, active, visible play.
The mini player counts ready time while its page is visible. Background time
does not count. A gap of more than five seconds between host timer samples
also does not count. This can exclude foreground time during a long host stall.
The full player pauses measurement while a game shows its loading screen.
Ready play resumes the same measurement. Reloading starts a new open.
The full player's Retry action also starts a new measurement.

The event includes `rule_version`, `threshold_seconds`, `foreground_seconds`,
`measurement_open_id`, `observed_at_ms`, and `measurement_source`.
Its source is `client-reported`. It is a time proxy. It does not prove player
attention, server-verified qualification, a new user, or retention. Do not
emit this host event from game code.

Creators can read it through the existing exports after the client release
and warehouse ingestion:

```bash
rundot analytics export top_custom_events_30d --game-id <game-id>
rundot analytics export custom_event_metrics_30d --game-id <game-id>
```

The first export shows event occurrences, host sessions, and reported players.
It does not count unique game opens or qualified players. The second shows
numeric parameters by platform and game version. The full player supplies the
running build version. The mini player leaves it empty when its resolver does
not supply that version. Mini visitor identity remains separate from account
identity. Self-play and repeat opens can appear in these exports.
Mini events use `mini_session_id`, `mini_visitor_id`, and `platform_os`.
These exports read `session_id`, `profile_id` or `user_id`, and `platform`.
Mini event counts are supported. Their player, session, and platform values
need separate verification. Without matching fields, player and session counts
can be zero and the platform can be `unknown`. Those values do not prove that
no mini play occurred.
Both limit output to the
top 25 event names. Cached or delayed data and the output limit can omit an
event. A missing row does not prove zero activity.

This event does not change campaign bidding or send a new advertising
conversion. Existing game and platform D1 reports keep their existing
cohort definitions. A separate qualified-play or retained-user event is not
part of this release.

## Marketing & Acquisition Milestones

When you run user acquisition campaigns with `rundot marketing`, the platform optimizes ad delivery toward conversion events.

### Standardized Milestones vs Custom Conversions
All games share RUN's ad network infrastructure. Because ad platforms enforce strict caps (for example, Meta limits ad accounts to 100 Custom Conversions), the platform standardizes on volume-viable milestones:
* **Engaged Play (`engaged-play`)**: Automatically triggered when a player accumulates 30 seconds of active gameplay in the mobile web playable harness (`/mini`). No game code needed.
* **Tutorial Complete (`tutorial-complete`)**: Triggered when your game reports that the player finished its tutorial. Report it once, at the end of onboarding, with either call:
  ```typescript
  RundotGameAPI.analytics.trackFunnelStep(1, 'tutorial_complete', 'onboarding')
  // or
  RundotGameAPI.analytics.recordCustomEvent('tutorial_complete')
  ```
  The name `tutorial_complete` is the same for every game, so no per-game setup is needed. Today it is sent to ad networks from mobile web (`/mini`) sessions.
* **Sign-Up (`signup`)**: Triggered when a player submits verified email capture or completes account registration.
* **In-Game Purchases (`purchase` / `value`)**: Automatically tracked when players complete IAP purchases via the SDK's Purchases API.

You do not need to register arbitrary event slots like `CUSTOM_1`; standard milestones feed pre-trained ML models on Meta and Google for stable optimization.

## API Reference

| Method                                              | Returns         | Description                         |
| --------------------------------------------------- | --------------- | ----------------------------------- |
| `recordCustomEvent(name, params?)`                  | `Promise<void>` | Record a custom event with payload  |
| `trackFunnelStep(step, name, funnel?, funnelOrder?)` | `Promise<void>` | Track a step in a conversion funnel |

##
