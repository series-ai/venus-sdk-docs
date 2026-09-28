# Safe Area & Layout Guide

Games on RUN.game run inside responsive web and native host containers (iOS, Android, Web, and Desktop). Because devices have notches, dynamic islands, home indicator bars, and host navigation chrome, RUN provides automatic CSS variables, a synchronous imperative reader, and reactive lifecycle subscriptions to ensure games can position their HUD elements cleanly without overlapping system chrome.

## Core Concepts

1. **Automatic CSS Custom Properties**: The SDK automatically updates CSS variables on `:root` as the container changes or rotates.
2. **Synchronous Imperative Access**: `RundotGameAPI.system.getSafeArea()` returns an immediate, cached snapshot of `{ top, right, bottom, left }` updated in real time.
3. **Reactive Lifecycles**: `RundotGameAPI.lifecycles.onSafeAreaChanged` and `RundotGameAPI.lifecycles.onDeviceChanged` notify game engines whenever the container geometry or orientation changes.

---

## Integration Methods

### 1. Automatic CSS Custom Properties (Recommended for DOM/UI)

The SDK automatically injects and maintains the following CSS custom properties on `document.documentElement`:

```css
.hud-header {
  padding-top: var(--rundot-safe-area-top, 0px);
  padding-right: var(--rundot-safe-area-right, 0px);
  padding-left: var(--rundot-safe-area-left, 0px);
}

.hud-footer {
  padding-bottom: var(--rundot-safe-area-bottom, 0px);
}
```

- `--rundot-safe-area-top`: Top inset with `px` suffix (e.g. `44px`).
- `--rundot-safe-area-right`: Right inset with `px` suffix (e.g. `0px`).
- `--rundot-safe-area-bottom`: Bottom inset with `px` suffix (e.g. `34px`).
- `--rundot-safe-area-left`: Left inset with `px` suffix (e.g. `0px`).

### 2. Reactive Subscriptions (Engine / Canvas Layouts)

If your game logic positions HUD items or canvas viewports procedurally (e.g. Three.js, Phaser, Pixi):

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Listen for safe area updates on orientation change or window resize
const safeAreaSub = RundotGameAPI.lifecycles.onSafeAreaChanged((safeArea) => {
  console.log('Safe area changed:', safeArea.top, safeArea.bottom)
  resizeHud(safeArea)
})

// Listen for orientation or screen dimension changes
const deviceSub = RundotGameAPI.lifecycles.onDeviceChanged((device) => {
  console.log(`Orientation: ${device.orientation}, Viewport: ${device.viewportSize.width}x${device.viewportSize.height}`)
  engine.renderer.setSize(device.viewportSize.width, device.viewportSize.height)
})

// Unsubscribe when done
// safeAreaSub.unsubscribe()
// deviceSub.unsubscribe()
```

### 3. Synchronous Imperative Read

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Synchronous read (no await needed after initializeAsync)
const safeArea = RundotGameAPI.system.getSafeArea()
applyInsets(safeArea)
```

---

## API Reference

| Method | Namespace | Returns | Description |
| --- | --- | --- | --- |
| `getSafeArea()` | `RundotGameAPI.system` | `SafeArea` | Returns the current safe area insets in pixels `{ top, right, bottom, left }`. Primary source of truth. |
| `getDevice()` | `RundotGameAPI.system` | `DeviceInfo` | Returns device information including screen and viewport dimensions, DPR, and orientation. |
| `onSafeAreaChanged(callback)` | `RundotGameAPI.lifecycles` | `Subscription` | Subscribes to host safe area updates. Returns an object with `.unsubscribe()`. |
| `onDeviceChanged(callback)` | `RundotGameAPI.lifecycles` | `Subscription` | Subscribes to host device & viewport dimension updates. Returns an object with `.unsubscribe()`. |

### `RundotGameAPI.system.getSafeArea(): SafeArea`

Returns the safe-area insets the host computed for this game. The value includes device safe areas (notches, home indicator) plus host navigation chrome, so you can treat it as the single source of truth for usable layout bounds.

All four fields are numbers in pixels:

```typescript
interface SafeArea {
  top: number
  right: number
  bottom: number
  left: number
}
```

Example:
```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const { top, right, bottom, left } = RundotGameAPI.system.getSafeArea()
// e.g. { top: 88, right: 0, bottom: 34, left: 0 } in pixels
```

### `RundotGameAPI.lifecycles.onSafeAreaChanged(callback: (safeArea: SafeArea) => void): Subscription`

Registers a listener called whenever safe area insets change (e.g. screen orientation change, foldable unfolding, system chrome toggle).

```typescript
const sub = RundotGameAPI.lifecycles.onSafeAreaChanged((safeArea) => {
  canvasOverlay.style.top = `${safeArea.top}px`
})
```

### `RundotGameAPI.lifecycles.onDeviceChanged(callback: (device: DeviceInfo) => void): Subscription`

Registers a listener called whenever device orientation or viewport dimensions change.

```typescript
const sub = RundotGameAPI.lifecycles.onDeviceChanged((device) => {
  console.log(`Orientation: ${device.orientation}, Viewport: ${device.viewportSize.width}x${device.viewportSize.height}`)
  engine.renderer.setSize(device.viewportSize.width, device.viewportSize.height)
})
```

---

## Layout Tips

- Combine safe-area padding with your own gameplay gutters. `getSafeArea()` guarantees you won't overlap system chrome.
- Treat `RundotGameAPI.system.getSafeArea()` and `var(--rundot-safe-area-*)` as the source of truth (they include both device safe areas and host chrome).
- For games declared with `--orientation both` or games supporting rotation, use CSS variables or `lifecycles.onSafeAreaChanged` rather than caching insets once on load.

## Deprecated paths

| Deprecated | Replacement |
| --- | --- |
| `RundotGameAPI.context.safeArea` | `RundotGameAPI.system.getSafeArea()` or `lifecycles.onSafeAreaChanged` |
| `RundotGameAPI.context.device` | `RundotGameAPI.system.getDevice()` or `lifecycles.onDeviceChanged` |
| `HudInsets` type | `SafeArea` type |
