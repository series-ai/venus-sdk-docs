# Time API

## Venus Time API

Sync with Venus server time, format timestamps with localized options, and compute future times without relying on client clocks.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const serverTime = await VenusAPI.time.requestTimeAsync()
console.log(serverTime.serverTime, serverTime.timezoneOffset)
```

### Formatting Helpers

```typescript
const formatted = VenusAPI.time.formatTime(Date.now(), {
  dateStyle: 'full',
  timeStyle: 'medium',
  hour12: true,
})

const formattedNumber = VenusAPI.time.formatNumber(1234567.89, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
```

### Future Calculations

```typescript
const futureTime = await VenusAPI.time.getFutureTimeAsync({
  days: 1,
  hours: 2,
  minutes: 30,
})
```

### Best Practices

* Use server time for cooldowns or limited-time offers to avoid client clock tampering.
* Cache the server response and update periodically rather than spamming the endpoint.
* When formatting numbers, remember the host automatically applies the player’s locale.
