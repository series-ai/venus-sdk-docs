#  Time API

Sync with  server time, format timestamps with localized options, and compute future times without relying on client clocks.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const serverTime = await RundotGameAPI.time.requestTimeAsync()
console.log(serverTime.serverTime, serverTime.timezoneOffset)
```

## Formatting Helpers

```typescript
const formatted = RundotGameAPI.time.formatTime(Date.now(), {
  dateStyle: 'full',
  timeStyle: 'medium',
  hour12: true,
})

const formattedNumber = RundotGameAPI.time.formatNumber(1234567.89, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
```

## Future Calculations

```typescript
const futureTime = await RundotGameAPI.time.getFutureTimeAsync({
  days: 1,
  hours: 2,
  minutes: 30,
})
```

## Best Practices

- Use server time for cooldowns or limited-time offers to avoid client clock tampering.
- Cache the server response and update periodically rather than spamming the endpoint.
- When formatting numbers, remember the host automatically applies the player’s locale.

