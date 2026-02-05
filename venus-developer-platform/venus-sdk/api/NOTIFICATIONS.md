# Notifications API

Schedule reminders, re-engagement prompts, and timed events using local notifications. The host persists schedules and surfaces alerts even when your game is suspended.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Schedule a notification for one hour from now
const id = await RundotGameAPI.notifications.scheduleAsync(
  'Daily Reward Ready',
  'Come back to claim your chest!',
  60 * 60, // fire in one hour (seconds)
)

// Cancel a scheduled notification
await RundotGameAPI.notifications.cancelNotification(id)

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
    priority: 'high',
    groupId: 'rewards',
    payload: { rewardType: 'chest', rewardId: 'gold_chest' },
  },
)
```

## Managing Notifications

```typescript
// Cancel a specific notification
await RundotGameAPI.notifications.cancelNotification('energy_refill')

// Get all scheduled notifications
const pending = await RundotGameAPI.notifications.getAllScheduledLocalNotifications()
console.log(`${pending.length} notifications scheduled`)

// Check if notifications are enabled
const enabled = await RundotGameAPI.notifications.isLocalNotificationsEnabled()

// Enable/disable notifications
await RundotGameAPI.notifications.setLocalNotificationsEnabled(true)
```

## Deeplinking

When a user taps a notification, they're taken directly to your game by default. Use `RundotGameAPI.context.launchParams` to detect if the app was launched from a notification and handle accordingly.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `scheduleAsync(title, body, delaySeconds, id?, options?)` | `Promise<string>` | Schedule a notification |
| `cancelNotification(id)` | `Promise<void>` | Cancel a scheduled notification |
| `getAllScheduledLocalNotifications()` | `Promise<Notification[]>` | Get all pending notifications |
| `isLocalNotificationsEnabled()` | `Promise<boolean>` | Check if notifications are enabled |
| `setLocalNotificationsEnabled(enabled)` | `Promise<void>` | Enable or disable notifications |

## Best Practices

- Keep payloads small—store heavy data in your own backend and reference it by ID.
- Throttle notifications; over-scheduling increases opt-outs and host-level throttling.
- Cancel reminders when players complete the associated task to avoid confusing messaging.
- Use meaningful custom IDs to dedupe notifications (e.g., `energy_refill`, `daily_reward`).
- Batch maintenance: iterate through `getAllScheduledLocalNotifications()` to tidy queues during logout.
