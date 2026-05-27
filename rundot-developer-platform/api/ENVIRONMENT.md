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
| `system.isMobile()` | `boolean` | Quick check if on mobile device |
| `system.isWeb()` | `boolean` | Quick check if on web platform |

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

## Best Practices

- Cache device/environment info at startup—it won't change during a session.
- Use `isMobile()` and `isWeb()` for quick checks; use `getDevice()` and `getEnvironment()` for detailed information.
- Test your responsive logic across different device types and orientations.
- Don't rely solely on device type—consider screen size for layout decisions.
- Use `isDevelopment` to gate debug features, not for feature flags (use the Experiments API instead).
