# In-App Messaging API

Display lightweight toast notifications and in-app messages without building custom UI per platform.

## Toasts

Toasts are lightweight, auto-dismissing messages that appear at the screen edge. Use them for confirmations, status updates, or quick actions.

### Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Simple toast
await RundotGameAPI.popups.showToast('Progress saved!')

// Toast with options
const actionTriggered = await RundotGameAPI.popups.showToast('Progress saved!', {
  duration: 3000,
  variant: 'success',
  action: { label: 'Undo' },
})

if (actionTriggered) {
  undoLastAction()
}
```

### Toast Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `3000` | Display time in milliseconds |
| `variant` | `string` | `'info'` | Visual style: `'success'`, `'error'`, `'warning'`, `'info'` |
| `action` | `{ label: string }` | - | Optional action button; returns `true` if tapped |

### Toast Variants

```typescript
// Success - green checkmark style
await RundotGameAPI.popups.showToast('Level complete!', { variant: 'success' })

// Error - red alert style
await RundotGameAPI.popups.showToast('Connection lost', { variant: 'error' })

// Warning - yellow caution style
await RundotGameAPI.popups.showToast('Low battery', { variant: 'warning' })

// Info - neutral style (default)
await RundotGameAPI.popups.showToast('New content available', { variant: 'info' })
```

### Actionable Toasts

```typescript
const tapped = await RundotGameAPI.popups.showToast('Item purchased!', {
  variant: 'success',
  action: { label: 'View' },
})

if (tapped) {
  openInventory()
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `popups.showToast(message, options?)` | `Promise<boolean>` | Show toast; returns `true` if action was triggered |

## Best Practices

- Keep copy short; long text can be truncated on mobile.
- Avoid stacking; await each toast before showing another when actions are present.
- Use appropriate variants to communicate message importance.
- Don't overuse toasts—reserve them for meaningful status updates.
