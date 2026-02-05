# Logging API

Stream structured logs to the RUN.game host for debugging, telemetry, and support. The logging API mirrors console semantics while tagging messages with your game instance.

> **Mobile Debugging**: This API allows creators to get logs from mobile devices where console access isn't available. Logs are collected and can be viewed through support tools for debugging production issues.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

RundotGameAPI.log('Gameplay started', { level: currentLevel })
RundotGameAPI.log('Unexpected state', { level: 'warn', state })
RundotGameAPI.error('Fatal error', error)
```

## Log Levels

```typescript
// Debug information
RundotGameAPI.logging.logDebug('Player moved', { 
  position: { x: 100, y: 200 },
  velocity: { x: 5, y: 0 },
})

// Error logging
RundotGameAPI.logging.logError('Failed to load asset', {
  assetPath: 'images/boss.png',
  error: error.message,
})

// General logging with context
RundotGameAPI.log('Level complete', {
  level: 5,
  score: 1200,
  timeElapsed: 45,
})
```

## Structured Logging

Use objects for context so support tools can parse fields:

```typescript
// Good: structured data
RundotGameAPI.log('Purchase failed', {
  itemId: 'gold_pack',
  errorCode: 'INSUFFICIENT_FUNDS',
  userBalance: 50,
  itemCost: 100,
})

// Avoid: string concatenation
RundotGameAPI.log('Purchase failed: gold_pack, error: INSUFFICIENT_FUNDS')
```

## Error Handling

```typescript
try {
  await riskyOperation()
} catch (error) {
  RundotGameAPI.error('Operation failed', {
    operation: 'riskyOperation',
    error: error.message,
    stack: error.stack,
  })
  
  // Also track in analytics for crash triage
  await RundotGameAPI.analytics.recordCustomEvent('error_occurred', {
    type: 'operation_failed',
    message: error.message,
  })
}
```

## API Reference

| Method | Description |
|--------|-------------|
| `log(message, context?)` | General purpose logging |
| `logging.logDebug(message, context?)` | Debug-level logging |
| `logging.logError(message, context?)` | Error-level logging |
| `error(message, error?)` | Log an error with stack trace |

## Best Practices

- Use structured objects for context; avoid string concatenation so support tools can parse fields.
- Throttle debug-level logging in production to reduce noise and bandwidth.
- Pair fatal logs with `RundotGameAPI.analytics` events for better crash triage.
- Include relevant context (user ID, level, game state) to help debug issues.
- Use consistent field names across your logs for easier filtering.
