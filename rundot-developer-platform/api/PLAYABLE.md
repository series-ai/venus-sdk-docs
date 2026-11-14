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

## The conversion gate (one call)

Put the gate wherever your game needs it: the end of Level 1, Campaign 3, Puzzle 6. At that point, call `cta()` once with a `prompt` and, if the next session should open somewhere specific, `resumeParams`. The host then shows the exit for the campaign at once (for example, an email field that says "Enter your email to get a link to Puzzle 7"). Do not show your own gate screen first.

```typescript
const { capabilities } = RundotGameAPI.system.getEnvironment()

async function onPuzzleSixSolved() {
  if (!capabilities.ctaGate) {
    showOwnGateScreen() // older host: your screen, then cta() from its button
    return
  }
  const result = await RundotGameAPI.playable.cta({
    action: 'continue',
    prompt: { nextLabel: 'Puzzle 7', continueLabel: 'Play Puzzle 7', currentLabel: 'Puzzle 6' },
    resumeParams: { puzzle: '7' },
  })
  if (result.gate !== 'shown') showOwnGateScreen()
  // If the player closes the host sheet, show a locked end frame with a button that calls cta() again.
}
```

- `cta()` resolves as soon as the host shows its sheet. It does not wait for the player.
- The host never assumes episodes or levels: all of its copy comes from your labels, or is neutral.
- `resumeParams` reach every resume link (email, text, browser, app install). Reserved launch keys (`cv`, `t`, `a2hs`, `iab`, and keys that start with `deep_link_`, `af_`, `utm_`, or `_`) are dropped. Notification keys (`key`, `roomId`, `payload`, `url`, `uri`, `body`, `title`, `sourceType`, `contentId`, `commentId`, `contentTitle`, `parentCommentId`) are also dropped, because the RUN app cannot send them to a game that is already open. Together with the launch parameters, the target can have at most 16 keys, 64 characters per key, 512 characters per value, and 2 KB in total. A target over these limits is not used: the next session opens with the launch parameters.
- If your game resumes from its own saved state (`onPreSave`), you can omit `resumeParams`.

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
  /** Present: the host shows its own gate at once. Use only when capabilities.ctaGate is true. */
  readonly prompt?: PlayablePrompt
  /** Launch params the next session opens with, e.g. { puzzle: '7' }. */
  readonly resumeParams?: Record<string, string>
}

interface PlayablePrompt {
  /** What the gate unlocks: "Episode 2", "Level 2", "Puzzle 7". */
  readonly nextLabel?: string
  /** Button text for continuing elsewhere: "Watch Episode 2", "Play Puzzle 7". */
  readonly continueLabel?: string
  /** What the player just finished, for error copy: "Episode 1". */
  readonly currentLabel?: string
  readonly title?: string
  readonly body?: string
}
```

### `PlayableCtaResult`

```typescript
interface PlayableCtaResult {
  /** Whether the host handled the CTA. */
  readonly completed: boolean
  /** 'shown' when the host rendered its own gate for a prompt; absent on older hosts. */
  readonly gate?: 'shown'
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
