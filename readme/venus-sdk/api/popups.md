# Venus Toast API

Use Venus to display lightweight toast notifications without building custom UI per platform.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

const actionTriggered = await VenusAPI.popups.showToast('Progress saved!', {
  duration: 3000,
  variant: 'success',
  action: { label: 'Undo' },
})
```

## Options

- `message` (string): required text to display.
- `duration` (ms): default `3000`.
- `variant`: `'success' | 'error' | 'warning' | 'info'` (default `info`).
- `action`: `{ label: string }` optional; returns `true` if the action is triggered.

## Best Practices

- Keep copy short; long text can be truncated on mobile.
- Avoid stacking; await each toast before showing another when actions are present.

