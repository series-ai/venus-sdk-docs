# Haptics API

## Venus Haptics API

Trigger tactile feedback across supported devices without worrying about platform differences. Venus normalizes style names and falls back gracefully when hardware lacks vibration support.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'
import { HapticFeedbackStyle } from '@series-inc/venus-sdk';

await VenusAPI.initializeAsync()

await VenusAPI.triggerHapticAsync(HapticFeedbackStyle.Success)
await VenusAPI.triggerHapticAsync(HapticFeedbackStyle.Warning)
await VenusAPI.triggerHapticAsync(HapticFeedbackStyle.Heavy)
```

`triggerHapticAsync` gracefully no-ops on hosts that lack vibration hardware, so you can call it defensively after initialization without extra guards.

### Supported Styles

`triggerHapticAsync` only accepts the `HapticFeedbackStyle` enum exported from `@series-inc/venus-sdk/api`. Stick to the enum (or the equivalent string literal) to avoid typos.

| Style (`HapticFeedbackStyle`) | String literal | Typical use                                                       |
| ----------------------------- | -------------- | ----------------------------------------------------------------- |
| `Light`                       | `'light'`      | Subtle taps for UI chrome (button clicks, light impacts).         |
| `Medium`                      | `'medium'`     | Noticeable impulses when you need emphasis without being jarring. |
| `Heavy`                       | `'heavy'`      | Strong pulses for collisions, explosions, or high-stakes input.   |
| `Success`                     | `'success'`    | Reward cues after quests, crafting, or confirmations.             |
| `Warning`                     | `'warning'`    | Prompt the player about risky states or invalid actions.          |
| `Error`                       | `'error'`      | Hard-stop feedback when something definitively fails.             |

### Capability Detection

Capability data lives on the device payload that Venus provides after initialization. Cache it once so you can tailor UI (for example, hide haptics toggles if unsupported).

```typescript
const { haptics } = VenusAPI.system.getDevice()

// Useful if you want to adjust UI, prompt the player, or log analytics.
const supportsHaptics = haptics.supported && haptics.enabled
```

### Patterns

* **Reward cues:** fire `Success` when players complete goals or receive loot.
* **Error signaling:** use `Warning` or `Error` to reinforce invalid actions.
* **Moment-to-moment feel:** pair `Light`, `Medium`, or `Heavy` pulses with button presses or impacts.

### Best Practices

* Cache `VenusAPI.system.getDevice().haptics` after initialization to avoid repeated lookups and to understand if the host supports feedback.
* Avoid spamming vibrations—respect rhythm and allow cooldowns so the experience stays premium.
* Wrap calls in `try/catch`; some desktop browsers reject vibration promises.
