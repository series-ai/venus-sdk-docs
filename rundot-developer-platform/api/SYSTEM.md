# System API

The System API is the unified namespace for device, environment, and platform-capability data — anything that's about *the host the game is running in*, not about the game itself.

It also exposes platform actions that need a round trip to the host, like prompting the user to add the game to their home screen.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Read-only platform info — synchronous, available after initialize.
const device = RundotGameAPI.system.getDevice()
const env = RundotGameAPI.system.getEnvironment()
const isMobile = RundotGameAPI.system.isMobile()

// Add to Home Screen — async, requires a user gesture.
if (await RundotGameAPI.system.canAddToHomeScreen()) {
  showInGamePinPromptButton()
}
```

## Methods

### Device & environment (synchronous)

| Method | Returns | Use |
| --- | --- | --- |
| `getDevice()` | `DeviceInfo` | Screen size, orientation, haptics support, safe-area insets, etc. |
| `getEnvironment()` | `EnvironmentInfo` | Platform (`ios` / `android` / `web`), browser info, dev-mode flag. |
| `getSafeArea()` | `SafeArea` | Padding to avoid device notches and host UI. Top includes the toolbar/feed-header height. |
| `isMobile()` | `boolean` | `true` on iOS, Android, or any mobile browser. |
| `isWeb()` | `boolean` | `true` on the web platform or desktop browser. |

These read cached host data and throw if called before `RundotGameAPI.initializeAsync()` resolves.

### Add to Home Screen (asynchronous)

| Method | Returns | Use |
| --- | --- | --- |
| `canAddToHomeScreen()` | `Promise<boolean>` | Whether the host can present an install prompt for this game right now. |
| `addToHomeScreen()` | `Promise<{ added: boolean }>` | Show the host confirmation modal and, on confirm, trigger the platform install prompt. |

#### `canAddToHomeScreen()`

Resolves to `false` when:

- The host has not surfaced a deferred install prompt — either the browser hasn't decided the site is installable yet, or the user has already installed it.
- The platform is iOS Safari (no programmatic install API exists; users must use the Safari Share menu manually).
- The running game has no thumbnail.
- A per-session cooldown is active because the user already dismissed the prompt for this game during this app session.

Use this before showing your own "pin this game" CTA so the CTA isn't displayed when it would no-op.

```typescript
const canPin = await RundotGameAPI.system.canAddToHomeScreen()
setPinButtonVisible(canPin)
```

#### `addToHomeScreen()`

Shows the host's "Add to Home Screen" confirmation modal. On confirm, the host triggers the platform install prompt (PWA install on supported browsers). On cancel — either the modal or the system prompt — resolves `{ added: false }`.

```typescript
async function onPlayerTappedPinButton() {
  const result = await RundotGameAPI.system.addToHomeScreen()
  if (result.added) {
    analytics.track('pinned_to_homescreen')
  }
}
```

##### Browser user-gesture requirement

Most browsers only honor an install prompt inside a user-initiated event handler. Call `addToHomeScreen()` in direct response to a user tap (button click), **not** from a timer, async callback, network response, or cutscene step. If called outside a user gesture the call resolves `{ added: false }` without showing UI.

```typescript
//  GOOD — direct response to a tap
button.addEventListener('click', async () => {
  await RundotGameAPI.system.addToHomeScreen()
})

//  BAD — fires after a delay, browser will reject the prompt
setTimeout(() => RundotGameAPI.system.addToHomeScreen(), 5000)
```

##### iOS

iOS Safari does not expose a programmatic install API. On iOS, `canAddToHomeScreen()` returns `false` and `addToHomeScreen()` resolves `{ added: false }` without showing UI. If you want iOS users to pin the game, surface your own instructional UI pointing to the Safari Share menu.

##### Per-session cooldown

If the user dismisses the modal once for a game, that game is silenced for the remainder of the app session — `canAddToHomeScreen()` returns `false`, and `addToHomeScreen()` resolves `{ added: false }`. This applies equally to SDK-triggered and host-toolbar-triggered prompts.

## Patterns

- **Pin at the magic moment.** Call `canAddToHomeScreen()` before showing a "Keep this game on your phone?" CTA after a high-engagement beat (boss defeat, quest completion). Trigger `addToHomeScreen()` from the CTA tap.
- **Don't autofire.** A prompt the user didn't ask for trains them to dismiss it. Always require a user tap.
- **Respect the cooldown.** Don't poll `canAddToHomeScreen()` repeatedly to retry — once it returns `false` for a session, accept it.

## Best Practices

- Treat `canAddToHomeScreen()` as the source of truth for whether to render your CTA. Don't try to recreate the host's logic by checking platform manually.
- Don't gate `addToHomeScreen()` on `isMobile()` alone — `canAddToHomeScreen()` already encodes everything you need.
- Show the player something tangible *before* prompting (level cleared, loot earned). Pinning is friction; pay for it with an emotional payoff.
