# Access Gate API

Control access to premium APIs based on user authentication status.

---

## Overview

The Access Gate sits in front of sensitive SDK methods — AI, ImageGen, Rooms, and UGC write operations — and blocks anonymous users from calling them. When a gated method is invoked:

1. The gate checks whether the current user is authenticated.
2. If **auto-prompt login** is enabled, the SDK automatically shows a login prompt.
3. If the user logs in successfully the original call proceeds. Otherwise an `AccessDeniedError` is thrown.

This lets you build features that gracefully degrade for anonymous users while keeping premium functionality behind authentication.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import { AccessDeniedError } from '@series-inc/rundot-game-sdk'

// Check auth status before making a gated call
if (RundotGameAPI.accessGate.isAnonymous()) {
  console.log('User is not logged in')
}

// Gated calls throw AccessDeniedError when blocked
try {
  const models = await RundotGameAPI.ai.getAvailableCompletionModels()
  console.log('Models:', models)
} catch (error) {
  if (error instanceof AccessDeniedError) {
    console.log('Login required:', error.requiredTier)
  }
}
```

---

## Auto-Prompt Login

When enabled, the SDK automatically shows a login dialog whenever an anonymous user calls a gated method. If the user completes login the call proceeds transparently; if they cancel, an `AccessDeniedError` is thrown.

```typescript
// Enable (on by default)
RundotGameAPI.accessGate.autoPromptLogin = true

// Disable — gated calls throw immediately for anonymous users
RundotGameAPI.accessGate.autoPromptLogin = false
```

---

## Manual Login

Use `promptLogin()` to trigger the login flow yourself — for example from a button or a pre-flight check:

```typescript
const result = await RundotGameAPI.accessGate.promptLogin()

if (result.success) {
  console.log('Logged in as', result.profile?.username)
} else {
  console.log('Login cancelled')
}
```

---

## Gated APIs and Methods

### AI

| Method | Description |
|--------|-------------|
| `ai.requestChatCompletionAsync(request)` | Generate text completion |
| `ai.getAvailableCompletionModels()` | List available models |

### ImageGen

| Method | Description |
|--------|-------------|
| `imageGen.generate(params)` | Generate an image from a text prompt |

### UGC (write operations only)

Browse and get methods remain **ungated** — only mutations require authentication.

| Method | Description |
|--------|-------------|
| `ugc.create(params)` | Publish new content |
| `ugc.update(params)` | Update existing content |
| `ugc.delete(id)` | Delete content |
| `ugc.like(id)` | Like content |
| `ugc.unlike(id)` | Unlike content |
| `ugc.recordUse(id)` | Record content usage |
| `ugc.report(id)` | Report content |

### Rooms (all methods)

| Method | Description |
|--------|-------------|
| `rooms.createRoomAsync(...)` | Create a new room |
| `rooms.joinOrCreateRoomAsync(...)` | Join an existing room or create one |
| `rooms.joinRoomByCodeAsync(...)` | Join a room by invite code |
| `rooms.getUserRoomsAsync()` | List the user's rooms |
| `rooms.subscribeAsync(...)` | Subscribe to room events |
| `rooms.updateRoomDataAsync(...)` | Update room data |
| `rooms.getRoomDataAsync(...)` | Get room data |
| `rooms.sendRoomMessageAsync(...)` | Send a message to the room |
| `rooms.leaveRoomAsync(...)` | Leave a room |
| `rooms.kickPlayerAsync(...)` | Kick a player from a room |
| `rooms.startRoomGameAsync(...)` | Start the room game |
| `rooms.proposeMoveAsync(...)` | Propose a game move |
| `rooms.validateMoveAsync(...)` | Validate a game move |

---

## Error Handling

Gated methods throw `AccessDeniedError` when the user does not meet the required access tier. Catch it to show custom UI or fall back gracefully:

```typescript
import { AccessDeniedError } from '@series-inc/rundot-game-sdk'

try {
  await RundotGameAPI.imageGen.generate({ prompt: 'A sunset' })
} catch (error) {
  if (error instanceof AccessDeniedError) {
    console.log(error.requiredTier) // 'authenticated_18plus'
    console.log(error.action)       // 'prompt_login' | 'prompt_age_gate'
  }
}
```

### AccessDeniedError

| Property | Type | Description |
|----------|------|-------------|
| `requiredTier` | `AccessTier` | The tier the user must reach (`'anonymous'` \| `'authenticated_18plus'`) |
| `action` | `string` | The action that was attempted (`'prompt_login'` \| `'prompt_age_gate'`) |

---

## API Reference

### `RundotGameAPI.accessGate`

| Method / Property | Returns | Description |
|-------------------|---------|-------------|
| `getAccessTier()` | `AccessTier` | Current user's access tier (`'anonymous'` or `'authenticated_18plus'`) |
| `isAnonymous()` | `boolean` | `true` if the user is not logged in |
| `promptLogin()` | `Promise<PromptLoginResult>` | Show the login dialog and return the result |
| `autoPromptLogin` | `boolean` | Get or set whether gated calls auto-prompt login for anonymous users |

### Types

```typescript
type AccessTier = 'anonymous' | 'authenticated_18plus'

interface PromptLoginResult {
  success: boolean
  profile?: Profile
}
```

---

## Best Practices

- **Leave auto-prompt enabled** unless you need full control over when the login dialog appears. It provides the smoothest experience for anonymous users who trigger a gated feature.
- **Catch `AccessDeniedError`** at the call site so you can show contextual feedback (e.g. "Log in to generate images") rather than a generic error.
- **Check `isAnonymous()` up front** if you want to hide or disable UI for features that require login, rather than waiting for the call to fail.
- **Don't gate-check manually** before calling gated methods — the SDK handles it for you. Calling `isAnonymous()` is useful for UI hints, but the gate itself is automatic.
