---
icon: shield-exclamation
---

# Error Handling

Every `RundotGameAPI` method is an RPC call across a React Native JS bridge. Any call — including ones typed as `void` — can return a promise that rejects due to bridge timeouts, disconnects, or host-side failures. **If your game leaves a rejection unhandled, the host app treats it as a fatal `RUNTIME_ERROR` and crashes the player back to the RUN catalog.**

## Fire-and-Forget Calls

Methods like `log()`, `analytics.recordCustomEvent()`, `triggerHapticAsync()`, and `popups.showToast()` don't return data you need, but they still return promises that can reject. Always attach a `.catch()`:

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Bad — unhandled rejection crashes the app
RundotGameAPI.log('player scored')

// Good — swallow transport errors on fire-and-forget calls
RundotGameAPI.log('player scored').catch(() => {})
```

### Reusable Helper

Copy this utility into your project to protect every fire-and-forget call in one line:

```typescript
/** Attach .catch() to any thenable returned by a fire-and-forget SDK call. */
function catchVoid(result: unknown, label: string): void {
  try {
    if (
      result != null &&
      typeof result === 'object' &&
      'catch' in result &&
      typeof (result as Promise<unknown>).catch === 'function'
    ) {
      (result as Promise<unknown>).catch((err) => {
        console.warn(`[SDK] ${label}:`, err);
      });
    }
  } catch {
    // defensive
  }
}

// Usage
catchVoid(RundotGameAPI.log('player scored'), 'log')
catchVoid(RundotGameAPI.triggerHapticAsync(HapticFeedbackStyle.Light), 'haptic')
catchVoid(RundotGameAPI.analytics.recordCustomEvent('level_start', { level: 1 }), 'analytics')
```

## Awaited Calls

Methods where you need the result — storage, ads, purchases, subscriptions, entitlements — should always be wrapped in `try/catch`:

```typescript
try {
  await RundotGameAPI.appStorage.setItem('key', value)
} catch (err) {
  console.warn('[SDK] storage write failed:', err)
}

try {
  const balance = await RundotGameAPI.iap.getHardCurrencyBalance()
} catch (err) {
  console.warn('[SDK] balance check failed:', err)
  // Show fallback UI or retry
}
```

## Quick Reference

| Call type | Examples | Pattern |
|-----------|---------|---------|
| Fire-and-forget | `log()`, `analytics.recordCustomEvent()`, `triggerHapticAsync()`, `popups.showToast()` | `.catch(() => {})` or `catchVoid()` helper |
| Awaited | `appStorage.setItem()`, `iap.spendCurrency()`, `ads.showRewardedAdAsync()` | `try/catch` block |

## Global Safety Net

As a last resort, add a global unhandled-rejection handler so a single missed `.catch()` doesn't crash your game:

```typescript
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[SDK] unhandled rejection:', event.reason)
  event.preventDefault() // prevent the host from treating it as fatal
})
```

{% hint style="warning" %}
The global handler is a safety net, not a substitute for proper error handling. Wrap every SDK call individually so you can handle failures where they happen.
{% endhint %}
