# Environment API

Detect device characteristics, platform information, and development mode. Use these APIs for responsive design, platform-specific behavior, and conditional debug logging.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Quick platform checks
const isMobile = RundotGameAPI.system.isMobile()
const isWeb = RundotGameAPI.system.isWeb()

if (isMobile) {
  enableTouchControls()
} else {
  enableKeyboardControls()
}
```

## Device Information

Get detailed device characteristics for responsive layouts and feature detection.

```typescript
const device = RundotGameAPI.system.getDevice()

// device contains:
// {
//   screenSize: { width: 1920, height: 1080 },
//   viewportSize: { width: 1280, height: 720 },
//   orientation: 'landscape',
//   pixelRatio: 2,
//   fontScale: 1,
//   deviceType: 'phone',
//   hapticsEnabled: true,
//   haptics: { supported: true, enabled: true }
// }

// Responsive layout based on screen size
if (device.screenSize.width < 768) {
  renderMobileLayout()
} else {
  renderDesktopLayout()
}

// Handle high-DPI displays
if (device.pixelRatio > 1) {
  loadHighResAssets()
}

// Adapt to font scaling (accessibility)
if (device.fontScale > 1.2) {
  useCompactUI()
}
```

## Environment Information

Get runtime environment details for conditional logic and debugging.

```typescript
const env = RundotGameAPI.system.getEnvironment()

// env contains:
// {
//   isDevelopment: true,
//   platform: 'ios',
//   platformVersion: '17.0',
//   browserInfo: {
//     browser: 'Safari',
//     userAgent: '...',
//     isMobile: true,
//     isTablet: false,
//     language: 'en-US'
//   }
// }

// Debug logging only in development
if (env.isDevelopment) {
  console.log('Debug mode enabled')
  enableDebugOverlay()
}

// Platform-specific behavior
if (env.platform === 'ios') {
  // iOS-specific haptics or UI
} else if (env.platform === 'android') {
  // Android-specific behavior
}

// Localization
const userLanguage = env.browserInfo?.language || 'en-US'
loadLocale(userLanguage)
```

## Platform Quick Checks

```typescript
// Quick check if running on mobile device
if (RundotGameAPI.system.isMobile()) {
  enableSwipeGestures()
}

// Quick check if running on web platform
if (RundotGameAPI.system.isWeb()) {
  showDesktopOnlyFeatures()
}
```

{% hint style="info" %}
Use the `system` namespace versions (`system.isMobile()` / `system.isWeb()`). The top-level `RundotGameAPI.isMobile()` / `RundotGameAPI.isWeb()` are deprecated aliases.
{% endhint %}

{% hint style="warning" %}
`isMobile()` and `isWeb()` are not strict complements. `isMobile()` returns `true` for `platform` `'ios'`/`'android'`, returns `browserInfo.isMobile` on web, and defaults to `true` when neither the platform nor `browserInfo` resolves (a conservative "assume mobile" fallback). `isWeb()` returns `true` when `platform === 'web'` or when `browserInfo` is present and not mobile (desktop web). So an unknown platform with no `browserInfo` is `isMobile()` true / `isWeb()` false, and a desktop browser is `isWeb()` true / `isMobile()` false. Don't treat one as the negation of the other.
{% endhint %}

## Safe Area

Get the padding your game needs to avoid drawing under device notches and host UI (toolbar / feed header). Use these insets to keep buttons, HUD, and important content out from under the host chrome.

```typescript
const safeArea = RundotGameAPI.system.getSafeArea()

// safeArea contains pixel insets:
// {
//   left: 0,
//   top: 64,
//   right: 0,
//   bottom: 16
// }

// Keep the HUD below the host header
hud.style.paddingTop = `${safeArea.top}px`
hud.style.paddingBottom = `${safeArea.bottom}px`
```

{% hint style="info" %}
The safe area is static: it's set once during initialization and doesn't change for the rest of the session. On a real device, `getSafeArea()` throws if called before initialization completes. In local mock/dev it returns a fallback of `{ top: 0, right: 0, bottom: 34, left: 0 }` instead of throwing, so read it after init in every environment or the error won't surface until you run on a real device.
{% endhint %}

### `getSafeArea(): SafeArea`

Returns the padding (in pixels) needed to avoid device notches and host UI. The value combines the toolbar / feed-header height with the device's own safe areas.

| Returns | Type | Description |
|---------|------|-------------|
| `left` | `number` | Left inset in pixels |
| `top` | `number` | Top inset in pixels |
| `right` | `number` | Right inset in pixels |
| `bottom` | `number` | Bottom inset in pixels |

```typescript
const { top, bottom, left, right } = RundotGameAPI.system.getSafeArea()
applySafeAreaPadding({ top, bottom, left, right })
```

## Add to Home Screen

Prompt players to pin your game to their home screen for faster re-entry. Check `canAddToHomeScreen()` before showing a "pin this game" CTA, then call `addToHomeScreen()` from the tap handler.

```typescript
// Only show the CTA when the prompt would actually work
if (await RundotGameAPI.system.canAddToHomeScreen()) {
  showPinCta()
}

// Call from a direct user-tap handler
pinButton.onclick = async () => {
  const { added } = await RundotGameAPI.system.addToHomeScreen()
  if (added) {
    hidePinCta()
  }
}
```

### `canAddToHomeScreen(): Promise<boolean>`

Resolves to whether the platform can present an "Add to Home Screen" prompt for the running game right now. Call this before showing your own "pin this game" CTA so the CTA isn't displayed when it would no-op.

Resolves `false` when:

- the host has not surfaced a deferred install prompt (the browser hasn't decided the site is installable, or the user already installed it),
- the platform is iOS Safari (no programmatic install API),
- the running game has no thumbnail,
- a per-session cooldown is active because the user already dismissed the prompt for this game during this app session.

```typescript
const canPin = await RundotGameAPI.system.canAddToHomeScreen()
if (canPin) {
  showPinCta()
}
```

### `addToHomeScreen(): Promise<AddToHomeScreenResult>`

Shows the host's "Add to Home Screen" confirmation modal and, on confirm, triggers the platform install prompt. Resolves with `{ added: boolean }`.

{% hint style="warning" %}
Call this in direct response to a user tap. Most browsers only honor an install prompt inside a user-initiated event handler; calling it from a timer, async callback, or cutscene resolves `{ added: false }`. On iOS it resolves `{ added: false }` without showing UI, since Safari exposes no programmatic install API.
{% endhint %}

| Returns | Type | Description |
|---------|------|-------------|
| `added` | `boolean` | `true` if the user accepted the install prompt; `false` if they cancelled or no prompt could be shown |

```typescript
pinButton.onclick = async () => {
  const result = await RundotGameAPI.system.addToHomeScreen()
  if (result.added) {
    hidePinCta()
  }
}
```

## Use Cases

### Responsive Design

```typescript
const device = RundotGameAPI.system.getDevice()

function getLayoutConfig() {
  const { screenSize, orientation, deviceType } = device
  
  if (deviceType === 'phone' && orientation === 'portrait') {
    return { columns: 2, spacing: 8 }
  } else if (deviceType === 'tablet') {
    return { columns: 4, spacing: 16 }
  } else {
    return { columns: 6, spacing: 24 }
  }
}
```

### Conditional Feature Enabling

```typescript
const device = RundotGameAPI.system.getDevice()
const env = RundotGameAPI.system.getEnvironment()

// Enable haptics only if supported and enabled
if (device.haptics.supported && device.haptics.enabled) {
  enableHapticFeedback()
}

// Show debug tools only in development
if (env.isDevelopment) {
  showDebugPanel()
}
```

### Platform-Specific Assets

```typescript
const env = RundotGameAPI.system.getEnvironment()
const device = RundotGameAPI.system.getDevice()

function getAssetPath(baseName: string) {
  const suffix = device.pixelRatio > 1 ? '@2x' : ''
  const platform = env.platform === 'web' ? 'web' : 'mobile'
  return `assets/${platform}/${baseName}${suffix}.png`
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `system.getDevice()` | `DeviceInfo` | Screen size, viewport, orientation, pixel ratio, haptics |
| `system.getEnvironment()` | `EnvironmentInfo` | Platform, version, dev mode, browser info |
| `system.getSafeArea()` | `SafeArea` | Pixel insets to avoid notches and host UI |
| `system.isMobile()` | `boolean` | Quick check if on mobile device |
| `system.isWeb()` | `boolean` | Quick check if on web platform |
| `system.canAddToHomeScreen()` | `Promise<boolean>` | Whether an Add-to-Home-Screen prompt can be shown now |
| `system.addToHomeScreen()` | `Promise<AddToHomeScreenResult>` | Show the install prompt; resolves `{ added }` |

### DeviceInfo Properties

| Property | Type | Description |
|----------|------|-------------|
| `screenSize` | `{ width, height }` | Physical screen dimensions |
| `viewportSize` | `{ width, height }` | Available viewport dimensions |
| `orientation` | `string` | `'portrait'` or `'landscape'` |
| `pixelRatio` | `number` | Device pixel ratio (1, 2, 3, etc.) |
| `fontScale` | `number` | System font scale factor |
| `deviceType` | `string` | Device type (phone, tablet, desktop) |
| `hapticsEnabled` | `boolean` | Whether haptics are enabled |
| `haptics` | `{ supported, enabled }` | Detailed haptics status |

### EnvironmentInfo Properties

| Property | Type | Description |
|----------|------|-------------|
| `isDevelopment` | `boolean` | Whether running in development mode |
| `platform` | `string` | Platform identifier (ios, android, web) |
| `platformVersion` | `string` | Platform version string |
| `browserInfo` | `object` | Browser details (optional, web only) |
| `browserInfo.browser` | `string` | Browser name |
| `browserInfo.userAgent` | `string` | Full user agent string |
| `browserInfo.isMobile` | `boolean` | Is mobile browser |
| `browserInfo.isTablet` | `boolean` | Is tablet browser |
| `browserInfo.language` | `string` | Browser language setting |

### SafeArea Properties

| Property | Type | Description |
|----------|------|-------------|
| `left` | `number` | Left inset in pixels |
| `top` | `number` | Top inset in pixels |
| `right` | `number` | Right inset in pixels |
| `bottom` | `number` | Bottom inset in pixels |

### AddToHomeScreenResult Properties

| Property | Type | Description |
|----------|------|-------------|
| `added` | `boolean` | `true` if the user accepted the install prompt (or the prompt flow launched on platforms that don't surface acceptance); `false` if cancelled or no prompt could be shown |

## Best Practices

{% hint style="warning" %}
`getDevice()`, `getEnvironment()`, and `getSafeArea()` throw if read before the SDK finishes initializing (they need `INIT_SDK` to have completed). The SDK initializes automatically on import, so read them after your first `await` rather than at module top level. `initializeAsync()` is deprecated and no longer needs to be called. The thrown error text still says to "call `RundotGameAPI.initializeAsync()`"; that wording lags behind the deprecation, so ignore it and just read after init completes.
{% endhint %}

- Cache device/environment/safe-area info at startup once the SDK has initialized; the values don't change during a session.
- Use `isMobile()` and `isWeb()` for quick checks; use `getDevice()` and `getEnvironment()` for detailed information.
- Test your responsive logic across different device types and orientations.
- Don't rely solely on device type; consider screen size for layout decisions.
- Use `isDevelopment` to gate debug features, not for feature flags (use the Experiments API instead).
