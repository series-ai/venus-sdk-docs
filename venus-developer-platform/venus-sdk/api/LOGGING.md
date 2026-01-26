#  Logging API

Stream structured logs to the  host for debugging, telemetry, and support. The logging API mirrors console semantics while tagging messages with your game instance.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

RundotGameAPI.log('Gameplay started', { level: currentLevel })
RundotGameAPI.log('Unexpected state', { level: 'warn', state })
RundotGameAPI.error('Fatal error', error)
```

## Best Practices

- Use structured objects for context; avoid string concatenation so support tools can parse fields.
- Throttle debug-level logging in production to reduce noise and bandwidth.
- Pair fatal logs with `RundotGameAPI.analytics` events for better crash triage.

