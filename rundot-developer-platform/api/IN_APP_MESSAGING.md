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

## Engagement prompts

These let your game ask the platform to show its own trusted engagement UI for
the running game. The platform renders the UI and the **player** acts; your game
never likes on the player's behalf and never receives comment content or
commenter identities. You don't pass a game id; the platform targets the running
game automatically.

### `popups.showLikeDialog(): Promise<LikeDialogResult>`

Asks the platform to show its Like prompt. Resolves when the player acts or
dismisses, or immediately with `{ shown: false, reason: 'unavailable' }` if the
platform suppresses it (not enabled for your app, post-load window, cooldown, or
per-session cap).

```typescript
type LikeDialogResult =
  | { shown: true; dismissed: boolean; liked: boolean }
  | { shown: false; reason: 'unavailable' }

const result = await RundotGameAPI.popups.showLikeDialog()
if (result.shown && result.liked) {
  // e.g. "Thanks for the like!"
}
```

A good moment to call this is after a win or a satisfying beat, never on load
and never in a loop. A persistent, always-visible Like button is not supported:
the prompt is suppressed for 15 seconds after load, for 60 seconds after the
previous prompt, and after 3 prompts in a session, so a button wired to it will
sometimes do nothing. For persistent UI, read `getLikeState()` instead and save
`showLikeDialog()` for the beat.

### `popups.canShowLikeDialog(): Promise<{ available: boolean }>`

Feature-detect before rendering a Like call-to-action. Reflects **capability
only** (platform support + whether the prompt is enabled for your app), not the
transient cooldown. Hide your CTA when `available` is `false`.

### `popups.showCommentsPanel(): Promise<CommentsPanelResult>`

Opens the platform's Comments panel for your game. Resolves `{ shown: true,
dismissed: true }` when the panel closes, or `{ shown: false, reason:
'unavailable' }` if suppressed (including when comments are disabled for your
game). No comment text or commenter identities are returned.

From the RUN app 5.2.0 release, this call is safe to wire to a persistent,
player-tapped Comments button: it has no time throttle (matching the platform's
own toolbar button), only a per-session cap far above real usage. Web picks up
5.2.0 at its deploy; iOS and Android only after store review. On earlier
clients the old anti-nag rules still apply: the first call within 15 seconds of
game load is suppressed, calls within 60 seconds of the previous open are
suppressed, and opens count against a shared 3-per-session cap.

Always handle `{ shown: false }`. It can be transient (an older client's
post-load window, or the panel is already open), but it can also be permanent
for the session (per-session cap, comments disabled for your game, or your app
denylisted), so avoid fallback copy that promises a retry will work.

```typescript
type CommentsPanelResult =
  | { shown: true; dismissed: boolean }
  | { shown: false; reason: 'unavailable' }

await RundotGameAPI.popups.showCommentsPanel()
```

### `popups.canShowCommentsPanel(): Promise<{ available: boolean }>`

Capability check for the Comments panel: same semantics as
`canShowLikeDialog`, and additionally `false` when comments are disabled for
your game. Capability only; a `true` does not guarantee an individual
`showCommentsPanel()` call succeeds (in the first moments of boot the panel's
host may still be mounting), so still handle `{ shown: false }`.

### `popups.getLikeState(): Promise<LikeStateResult>`

Read the running player's like state for your game. Read-only and not throttled;
use it to decide whether to render a Like call-to-action or call
`showLikeDialog()` at all (for example, skip players who already liked).

```typescript
interface LikeStateResult {
  isLiked: boolean // has the current player already liked this game
  likesCount: number // total likes for this game
}

const { isLiked } = await RundotGameAPI.popups.getLikeState()
if (!isLiked) {
  // only nudge players who haven't liked yet
  await RundotGameAPI.popups.showLikeDialog()
}
```

> **Anti-abuse.** The Like prompt is rate-limited, suppressed right after
> load, and capped per session; calling it in a loop will not inflate
> engagement, and only a real player tap mutates a like. The Comments panel is
> capped per session, and apps that abuse either surface can be disabled by
> the platform.

> **Local dev.** In a plain browser the SDK self-mocks and these calls always
> resolve as shown/available, so test your `{ shown: false }` handling inside
> the RUN host.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `popups.showToast(message, options?)` | `Promise<boolean>` | Show toast; returns `true` if action was triggered |
| `popups.showLikeDialog()` | `Promise<LikeDialogResult>` | Show the platform Like prompt; player performs the like |
| `popups.canShowLikeDialog()` | `Promise<{ available: boolean }>` | Whether the Like prompt is enabled for your app (capability only) |
| `popups.showCommentsPanel()` | `Promise<CommentsPanelResult>` | Open the platform Comments panel for your game |
| `popups.canShowCommentsPanel()` | `Promise<{ available: boolean }>` | Whether the Comments panel is available for your game |
| `popups.getLikeState()` | `Promise<LikeStateResult>` | The player's like state (`isLiked`, `likesCount`), read-only |

## Best Practices

- Keep copy short; long text can be truncated on mobile.
- Avoid stacking; await each toast before showing another when actions are present.
- Use appropriate variants to communicate message importance.
- Don't overuse toasts; reserve them for meaningful status updates.
