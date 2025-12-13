# Venus Local Notifications API

Schedule reminders, re-engagement prompts, and timed events across devices using Venus local notifications. The host persists schedules and surfaces alerts even when your game is suspended.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

// Minimal schedule
const id = await VenusAPI.notifications.scheduleAsync(
  'Daily Reward Ready',
  'Come back to claim your chest!',
  60 * 60, // fire in one hour
)

// Manage lifecycle
await VenusAPI.notifications.cancelNotification(id)
const pending = await VenusAPI.notifications.getAllScheduledLocalNotifications()
```

## Advanced Scheduling

- Specify a custom identifier: `scheduleAsync(title, body, delaySeconds, 'my-id')` to dedupe reminders.
- Include metadata: pass an options object with `priority`, `groupId`, or `payload` for richer handling.
- Batch maintenance: use `cancelNotification` or iterate through `getAllScheduledLocalNotifications()` to tidy queues during logout.

## Best Practices

- Keep payloads small—store heavy data in your own backend and reference it by ID.
- Throttle notifications; over-scheduling increases opt-outs and host-level throttling.
- Cancel reminders when players complete the associated task to avoid confusing messaging.

