# Playable API

The Playable API (`RundotGameAPI.playable`) provides lifecycle hooks, progression telemetry, and conversion call-to-action (CTA) mechanics for games executing inside user acquisition (UA) playables, ad-network wrappers, and lightweight promotional harnesses.

***

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Check if running in a playable harness
if (RundotGameAPI.playable.isPlayable()) {
  // Track milestone
  RundotGameAPI.playable.milestone('level_1_started')

  // Listen for pre-save snapshots
  const unsubscribe = RundotGameAPI.playable.onPreSave(async () => {
    await saveGameState()
  })

  // Trigger conversion CTA on tap or level victory
  ctaButton.addEventListener('click', async () => {
    const result = await RundotGameAPI.playable.cta({
      action: 'install',
      params: { campaign: 'spring_promo' }
    })
    if (result.completed) {
      console.log('Player engaged with CTA')
    }
  })

  // Signal experience completion
  async function onGameOver(won: boolean, score: number) {
    await RundotGameAPI.playable.complete({
      result: won ? 'win' : 'lose',
      score,
      level: 1
    })
  }
}
```

***

## Methods

| Method | Returns | Description |
|---|---|---|
| `isPlayable()` | `boolean` | Returns `true` if the game is executing inside an ad-network or playable conversion wrapper. |
| `cta(options?)` | `Promise<PlayableCtaResult>` | Triggers the host's conversion CTA flow (e.g. Add to Home Screen, app store redirect, email capture, or browser escape). |
| `complete(outcome?)` | `Promise<void>` | Signals that the playable experience is complete, prompting the host to present an end card or timeout screen. |
| `milestone(name, params?)` | `void` | Logs an in-game progression milestone for UA marketing analytics (e.g. `'tutorial_done'`, `'boss_reached'`). |
| `onPreSave(hook)` | `() => void` | Registers an async callback executed immediately before the host captures a save-state snapshot. Returns an unregister function. |

***

## Data Types

### `PlayableCtaOptions`

```typescript
interface PlayableCtaOptions {
  /** Optional destination or action target override. */
  readonly targetUrl?: string
  /** Action name if multiple CTAs exist (e.g. 'install', 'continue', 'share'). */
  readonly action?: string
  /** Arbitrary key-value payload to attach to the CTA intent. */
  readonly params?: Record<string, string>
}
```

### `PlayableCtaResult`

```typescript
interface PlayableCtaResult {
  /** Whether the user completed or confirmed the CTA action. */
  readonly completed: boolean
}
```

### `PlayableOutcome`

```typescript
type PlayableResult = 'win' | 'lose' | 'timeout' | 'complete'

interface PlayableOutcome {
  /** Final state outcome of the playable session. */
  readonly result?: PlayableResult
  /** Final score achieved by the player. */
  readonly score?: number
  /** Level index or identifier reached. */
  readonly level?: number | string
  /** Arbitrary telemetry metadata. */
  readonly metadata?: Record<string, unknown>
}
```

### `PreSaveHook`

```typescript
type PreSaveHook = () => Promise<void> | void
```

***

## Best Practices

- **Flush state on `onPreSave`:** Game engines (Phaser, Three.js, Godot, Pixi) should serialize in-memory caches to `appStorage` or local state when `onPreSave` fires so save snapshots capture accurate state.
- **Milestones for funnel analysis:** Emit milestones at major funnel checkpoints (tutorial start, first attack, stage complete) so ad networks can optimize bidding.
- **Clean up listeners:** Always invoke the function returned by `onPreSave` during scene teardown to prevent memory leaks across scene transitions.
