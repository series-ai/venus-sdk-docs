# Popups API

The Popups API (`RundotGameAPI.popups`) provides host-rendered dialogs, toasts, social reaction prompts, and comments sheet integrations. Because UI elements are rendered by the host application rather than the game canvas, they automatically conform to native platform design patterns and accessibility requirements.

***

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// 1. Show an ephemeral toast notification
await RundotGameAPI.popups.showToast('Item added to inventory!', {
  variant: 'success',
  duration: 3000,
})

// 2. Check like capability and show platform Like dialog
const { available } = await RundotGameAPI.popups.canShowLikeDialog()
if (available) {
  const { isLiked, likesCount } = await RundotGameAPI.popups.getLikeState()
  if (!isLiked) {
    const result = await RundotGameAPI.popups.showLikeDialog()
    if (result.shown && result.liked) {
      console.log('Player liked the game!')
    }
  }
}

// 3. Open platform Comments panel
const { available: commentsAvailable } = await RundotGameAPI.popups.canShowCommentsPanel()
if (commentsAvailable) {
  await RundotGameAPI.popups.showCommentsPanel()
}
```

***

## Methods

| Method | Returns | Description |
|---|---|---|
| `showToast(message, options?)` | `Promise<boolean>` | Displays an ephemeral toast message rendered by the platform host. |
| `showLikeDialog()` | `Promise<LikeDialogResult>` | Triggers the platform-owned Like confirmation prompt. |
| `canShowLikeDialog()` | `Promise<{ available: boolean }>` | Checks whether the Like prompt is supported and enabled for this app. |
| `showCommentsPanel()` | `Promise<CommentsPanelResult>` | Opens the platform-owned Comments panel drawer. |
| `canShowCommentsPanel()` | `Promise<{ available: boolean }>` | Checks whether the Comments panel drawer can be displayed. |
| `getLikeState()` | `Promise<LikeStateResult>` | Retrieves current player like state (`isLiked`) and total like count (`likesCount`). |

***

## Data Types

### `ShowToastOptions`

```typescript
interface ShowToastOptions {
  /** Toast duration in milliseconds. */
  duration?: number
  /** Visual theme variant of the toast container. */
  variant?: 'success' | 'error' | 'warning' | 'info'
  /** Optional interactive action button. */
  action?: {
    label: string
  }
}
```

### `LikeDialogResult`

```typescript
type LikeDialogResult =
  | { shown: true; dismissed: boolean; liked: boolean }
  | { shown: false; reason: 'unavailable' }
```

### `CommentsPanelResult`

```typescript
type CommentsPanelResult =
  | { shown: true; dismissed: boolean }
  | { shown: false; reason: 'unavailable' }
```

### `LikeStateResult`

```typescript
interface LikeStateResult {
  /** Whether the current player has liked this game. */
  isLiked: boolean
  /** Total like count for this game. */
  likesCount: number
}
```

***

## Best Practices

- **Check capabilities before drawing CTAs:** Always call `canShowLikeDialog()` and `canShowCommentsPanel()` before rendering in-game buttons that trigger them.
- **Never spam Like prompts:** Like dialogs are subject to platform cooldowns and rate limits. If a player dismisses the prompt, do not prompt them again during that session.
- **Platform ownership of comments:** Comments are completely isolated in host UI; no user identities or comment text cross into the game iframe sandbox.
