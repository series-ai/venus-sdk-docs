# Venus Navigation API

Use the stack navigation helpers when your game embeds other Venus experiences or needs to return control cleanly. The API mirrors traditional push/pop semantics with context passing.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.navigation.pushApp('bird-flap', {
  contextData: { level: 5, difficulty: 'hard' },
})

await VenusAPI.navigation.popApp()
```

## Stack Information

```typescript
const stackInfo = VenusAPI.navigation.getStackInfo()
// { isInStack, stackPosition, isTopOfStack, stackDepth, parentInstanceId }
```

Use this data to adjust UI when embedded inside another app.

## Best Practices

- Pass lightweight context objects; host clamps size to keep navigation snappy.
- Always call `popApp` after launching a child experience so control returns to your shell.
- Sanitize context data before pushing—avoid leaking PII or oversized blobs.

