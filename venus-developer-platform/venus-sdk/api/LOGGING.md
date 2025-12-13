# Venus Logging API

Stream structured logs to the Venus host for debugging, telemetry, and support. The logging API mirrors console semantics while tagging messages with your game instance.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

VenusAPI.log('Gameplay started', { level: currentLevel })
VenusAPI.log('Unexpected state', { level: 'warn', state })
VenusAPI.error('Fatal error', error)
```

## Best Practices

- Use structured objects for context; avoid string concatenation so support tools can parse fields.
- Throttle debug-level logging in production to reduce noise and bandwidth.
- Pair fatal logs with `VenusAPI.analytics` events for better crash triage.

