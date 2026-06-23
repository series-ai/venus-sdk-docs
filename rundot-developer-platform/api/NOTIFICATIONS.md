# Notifications API

Schedule reminders, re-engagement prompts, and timed events using local notifications. The host persists schedules and surfaces alerts even when your game is suspended.

{% hint style="warning" %}
All SDK methods can reject; unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Schedule a notification for one hour from now.
// Returns the scheduled id, or null if the host declined to schedule it.
const id = await RundotGameAPI.notifications.scheduleAsync(
  'Daily Reward Ready',
  'Come back to claim your chest!',
  60 * 60, // fire in one hour (seconds)
)

// Cancel a scheduled notification (null-check the id first)
if (id) {
  await RundotGameAPI.notifications.cancelNotification(id)
}

// Get all pending notifications
const pending = await RundotGameAPI.notifications.getAllScheduledLocalNotifications()
```

## Use Cases

### Energy Refills

```typescript
async function scheduleEnergyNotification(minutesToFull: number) {
  await RundotGameAPI.notifications.scheduleAsync(
    'Energy Full!',
    'Your energy has fully recharged. Time to play!',
    minutesToFull * 60,
    'energy_refill', // custom ID to dedupe
  )
}
```

### Events Starting

```typescript
async function scheduleEventReminder(eventName: string, startsInSeconds: number) {
  // Remind 5 minutes before event
  const reminderTime = Math.max(0, startsInSeconds - 300)
  
  await RundotGameAPI.notifications.scheduleAsync(
    `${eventName} Starting Soon!`,
    'The event begins in 5 minutes. Don\'t miss out!',
    reminderTime,
    `event_${eventName}`,
  )
}
```

### Building Complete

```typescript
async function scheduleBuildingNotification(buildingName: string, buildTimeSeconds: number) {
  await RundotGameAPI.notifications.scheduleAsync(
    `${buildingName} Complete!`,
    'Your building is ready. Tap to collect!',
    buildTimeSeconds,
    `building_${buildingName}`,
  )
}
```

### Daily Rewards

```typescript
async function scheduleDailyRewardReminder() {
  // Remind at same time tomorrow
  const tomorrow = 24 * 60 * 60
  
  await RundotGameAPI.notifications.scheduleAsync(
    'Daily Reward Available!',
    'Your daily reward is waiting. Log in to claim it!',
    tomorrow,
    'daily_reward',
  )
}
```

## Advanced Scheduling

```typescript
// Specify a custom identifier to dedupe reminders
await RundotGameAPI.notifications.scheduleAsync(
  title,
  body,
  delaySeconds,
  'my-custom-id',
)

// Include metadata for richer handling
await RundotGameAPI.notifications.scheduleAsync(
  title,
  body,
  delaySeconds,
  customId,
  {
    priority: 75, // number, default 50
    groupId: 'rewards',
    payload: { rewardType: 'chest', rewardId: 'gold_chest' },
  },
)
```

### Schedule options

The optional fifth argument to `scheduleAsync` is a `ScheduleNotificationOptions` object.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `priority` | `number` | No | `50` | Relative priority for the host's scheduling/throttling. Higher fires first when the host has to choose. |
| `groupId` | `string` | No | n/a | Groups related notifications. Sent to the host as `key`. |
| `payload` | `Record<string, any>` | No | n/a | Arbitrary data carried with the notification. Sent to the host as `data` and surfaced again on `getAllScheduledLocalNotifications()`. |

{% hint style="warning" %}
`priority` is a `number` (default 50). Use a numeric value like `75`; a string such as `'high'` is type-incorrect.
{% endhint %}

## Managing Notifications

```typescript
// Cancel a specific notification
await RundotGameAPI.notifications.cancelNotification('energy_refill')

// Get all scheduled notifications
const pending = await RundotGameAPI.notifications.getAllScheduledLocalNotifications()
console.log(`${pending.length} notifications scheduled`)

// Check if notifications are enabled
const enabled = await RundotGameAPI.notifications.isLocalNotificationsEnabled()

// Enable/disable notifications (resolves to the resulting enabled state)
const nowEnabled = await RundotGameAPI.notifications.setLocalNotificationsEnabled(true)
```

### Scheduled notification shape

`getAllScheduledLocalNotifications()` resolves to an array of `ScheduleLocalNotification`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The notification identifier (the custom id you passed, or a host-assigned one). |
| `title` | `string \| null` (optional) | The notification title. |
| `body` | `string \| null` (optional) | The notification body. |
| `payload` | `Record<string, any>` (optional) | The `payload` you supplied in the schedule options. |
| `trigger` | `NotificationTriggerInput` (optional) | When the notification fires, or `null`. |

`trigger`, when present, is `{ type: 'timeInterval'; seconds: number; repeats?: boolean; channelId?: string }`.

## Cross-channel messaging (RCS / SMS): BETA

Reach players outside the app over RCS (with SMS fallback). These methods are provider-agnostic from the game's side; the platform routes the message through the venus host. Availability depends on the user having a phone on file and an active opt-in.

{% hint style="warning" %}
RCS/SMS opt-in is regulated (TCPA). Always call `requestRCSOptInAsync` in response to a user gesture, never as a passive prompt on load.
{% endhint %}

```typescript
// 1. Prompt for opt-in on a button tap
const optIn = await RundotGameAPI.notifications.requestRCSOptInAsync({
  rewardCopy: 'Get 100 gems, never miss an update.',
})

if (optIn.newlySubscribed) {
  grantReward() // one-shot reward only on a fresh confirmed opt-in
}

// 2. Check reachability before scheduling
const { available, reason } = await RundotGameAPI.notifications.getRCSAvailableAsync()

// 3. Schedule a cross-channel message
if (available) {
  const result = await RundotGameAPI.notifications.scheduleRCSAsync({
    title: 'Your raid is ready',
    body: 'Tap to jump back in and claim your loot.',
    continuationParams: { screen: 'raid', raidId: 'abc123' },
    delaySeconds: 60 * 60 * 4, // 4 hours from now
  })
  console.log(result.scheduleId, result.status)
}
```

### `requestRCSOptInAsync(input?): Promise<RequestRCSOptInResult>`

Triggers the platform-owned RCS/SMS opt-in modal. The host shows the right modal state depending on whether the user has a phone on file and is already subscribed, then resolves once the user closes or completes the modal. Call this on a user gesture (TCPA), not as a passive prompt.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `input.rewardCopy` | `string` | No | Copy interpolated into the modal heading (e.g. a reward teaser). Falls back to generic copy when omitted. |

Returns `RequestRCSOptInResult`:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'already_subscribed' \| 'subscribed' \| 'declined' \| 'pending_confirmation'` | Outcome of the modal. `subscribed` means reachable now; `pending_confirmation` means the user submitted but still owes a Braze double-opt-in SMS reply ("Y"), so do not assume reachability yet; `declined` means the user dismissed it. |
| `newlySubscribed` | `boolean` | `true` only on a fresh confirmed opt-in (the modal stayed open through the pending state until double opt-in succeeded). Use it to gate one-shot rewards. `false` for `already_subscribed`, `pending_confirmation`, and `declined`. |

{% hint style="info" %}
If the user dismisses while pending and replies "Y" later, a subsequent call returns `already_subscribed` with `newlySubscribed: false`. Don't grant the reward in that case unless you track confirmation yourself (e.g. poll `getRCSAvailableAsync`).
{% endhint %}

### `getRCSAvailableAsync(): Promise<RCSAvailabilityStatus>`

Checks whether the user is reachable via RCS/SMS before you schedule a message.

Returns `RCSAvailabilityStatus`:

| Field | Type | Description |
|-------|------|-------------|
| `available` | `boolean` | Whether a cross-channel message can be delivered. |
| `reason` | `'needs_consent' \| 'no_phone' \| 'feature_disabled' \| 'unknown'` (optional) | Why the user is not reachable, when `available` is `false`. |

### `scheduleRCSAsync(input): Promise<ScheduleRCSResult>`

Schedules a cross-channel RCS/SMS message.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `input.title` | `string` | Yes | Message title. |
| `input.body` | `string` | Yes | Message body. |
| `input.ctaUrl` | `string` | No | Opaque continuation id; the platform resolves it to a OneLink at send time. |
| `input.continuationParams` | `Record<string, string>` | No | Hydrated into the H5 `notificationParams` when the user taps the CTA. |
| `input.image` | `string` | No | Image to attach to the message. |
| `input.triggerAt` | `string` | No | ISO 8601 UTC send time. Mutually exclusive with `delaySeconds`. |
| `input.delaySeconds` | `number` | No | Seconds from now to send. Mutually exclusive with `triggerAt`; max 7 days. |

Returns `ScheduleRCSResult`:

| Field | Type | Description |
|-------|------|-------------|
| `scheduleId` | `string` | Identifier for the scheduled message. |
| `status` | `'pending' \| 'sent' \| 'dry_run' \| 'failed'` | Current status of the scheduled message. |
| `estimatedSendAt` | `string` (optional) | Reserved for a future schedule-status API. NOT returned by `scheduleRCSAsync` in v1 (rate-cap deferral is handled internally at dispatch time), so don't depend on it being present. It appears in IDE autocomplete because it's declared on the public type. |

### Opt-in integration pitfalls

These all bit the first game that integrated RCS opt-in. Read this section before wiring a reward to the opt-in.

**1. Reconcile on launch AND resume; pay "subscribed and unrewarded", not "pending and confirmed".**

The result of `requestRCSOptInAsync` is not guaranteed to reach your game. The user can dismiss the host modal mid-flight, kill the app while the confirmation is pending, or confirm by replying "Y" hours after your session ended. If you only grant the reward when you previously recorded a `pending_confirmation`, those users end up subscribed but never rewarded, with no UI left to fix it (your opt-in entry points are hidden for subscribed users).

Run a reconcile on every launch and resume instead:

```typescript
async function reconcileOptInReward() {
  if (rewardAlreadyClaimed()) return
  const { available } = await RundotGameAPI.notifications.getRCSAvailableAsync()
  if (available) grantRewardOnce() // idempotent: persist a claimed flag
}
```

Keep the grant idempotent with a persisted flag. `newlySubscribed` from the modal result is still the fast path for the user who confirms while your session is open; the reconcile is the safety net for everyone else.

**2. Drive opt-in entry points from shared, refreshable state.**

Subscription state changes outside your call stack: an SMS reply, another entry point, a reconcile on resume. If each button computes "should I show?" once on mount, it keeps offering an opt-in the user already completed until the screen remounts. Keep one shared "offerable" flag (a store), re-derive it after every `requestRCSOptInAsync` result, after every reward grant, and on resume, and render every entry point (settings row, store row, pitch) from that flag.

**3. Don't cache `getRCSAvailableAsync` across opt-in attempts.**

Caching availability for a session is fine; just invalidate it whenever an opt-in attempt resolves or a reward is granted, or your UI will trust a pre-opt-in answer.

**4. After `pending_confirmation`, say "reply Y"; don't offer a resend.**

The confirmation prompt is capped upstream at one per user per day. Calling `requestRCSOptInAsync` again does not send another text, so a "Resend" button silently does nothing. Tell the user to find the text and reply "Y", and rely on the reconcile from pitfall 1 to pay them whenever they do.

## Deeplinking

When a user taps a notification, they're taken directly to your game by default. Use [`RundotGameAPI.app.resolveLaunchIntent()`](APP.md#launch-intent) to detect a notification launch and read its payload — `kind === 'notification'` with the payload in `params`:

```typescript
const intent = await RundotGameAPI.app.resolveLaunchIntent({ maxWaitMs: 800 })
if (intent.kind === 'notification') {
  handleNotificationLaunch(intent.params) // e.g. params.roomId to auto-join
}
```

> The deprecated `RundotGameAPI.context.notificationParams` snapshot still works until v6.0.0, but `resolveLaunchIntent` is the supported path.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `scheduleAsync(title, body, delaySeconds, id?, options?)` | `Promise<string \| null>` | Schedule a notification. Resolves to the scheduled id, or `null` if the host declined to schedule it. |
| `cancelNotification(id)` | `Promise<boolean>` | Cancel a scheduled notification. Resolves `true` when a matching notification was canceled. |
| `getAllScheduledLocalNotifications()` | `Promise<ScheduleLocalNotification[]>` | Get all pending notifications. |
| `isLocalNotificationsEnabled()` | `Promise<boolean>` | Check if notifications are enabled. |
| `setLocalNotificationsEnabled(enabled)` | `Promise<boolean>` | Enable or disable notifications. Resolves to the resulting enabled state. |
| `requestRCSOptInAsync(input?)` | `Promise<RequestRCSOptInResult>` | Prompt for RCS/SMS opt-in on a user gesture (BETA). |
| `getRCSAvailableAsync()` | `Promise<RCSAvailabilityStatus>` | Check whether the user is reachable via RCS/SMS (BETA). |
| `scheduleRCSAsync(input)` | `Promise<ScheduleRCSResult>` | Schedule a cross-channel RCS/SMS message (BETA). |

## Best Practices

- Keep payloads small; store heavy data in your own backend and reference it by ID.
- Throttle notifications; over-scheduling increases opt-outs and host-level throttling.
- Cancel reminders when players complete the associated task to avoid confusing messaging.
- Use meaningful custom IDs to dedupe notifications (e.g., `energy_refill`, `daily_reward`).
- Batch maintenance: iterate through `getAllScheduledLocalNotifications()` to tidy queues during logout.
