# Access Gate API

Control access to premium APIs based on user authentication status.

---

## Overview

The Access Gate sits in front of sensitive SDK methods (TextGen, ImageGen, AudioGen, ThreeDGen, and UGC account mutations) and blocks anonymous users from calling them. When a gated method is invoked:

1. The gate checks whether the current user is authenticated.
2. If **auto-prompt login** is enabled, the SDK automatically shows a login prompt.
3. If the user logs in successfully the original call proceeds. Otherwise the returned Promise rejects with an `AccessDeniedError`.

This lets you build features that gracefully degrade for anonymous users while keeping premium functionality behind authentication.

{% hint style="info" %}
Gated methods are always async and never throw synchronously, even when auto-prompt is disabled. The gate returns a rejected Promise, so always `await` the call (or attach `.catch()`); a non-awaited gated call produces an unhandled rejection rather than a synchronous throw.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import { AccessDeniedError } from '@series-inc/rundot-game-sdk'

// Auto-prompt is ON by default: anonymous users see the login prompt
// automatically when calling a gated method.
try {
  const result = await RundotGameAPI.imageGen.generate({
    prompt: 'A cute pixel art cat',
  })
} catch (error) {
  if (error instanceof AccessDeniedError) {
    // User cancelled or dismissed the login prompt
    console.log('Login required to generate images')
  }
}
```

---

## Gated Namespaces & Methods

The following SDK methods are protected by the Access Gate and require an authenticated user:

### TextGen

| Method | Description |
|--------|-------------|
| `textGen.generate(params)` | Generate text from a prompt |
| `textGen.decide(params)` | Discrete structured-output choices |
| `textGen.requestChatCompletionAsync(params)` | Low-level chat completion |
| `textGen.requestChatCompletionStreamAsync(params)` | Streaming chat completion |
| `textGen.requestPromptCompletionAsync(params)` | Low-level prompt completion |
| `textGen.requestPromptCompletionStreamAsync(params)` | Streaming prompt completion |

### ImageGen

| Method | Description |
|--------|-------------|
| `imageGen.generate(params)` | Generate an image from a prompt |
| `imageGen.edit(params)` | Edit an existing image |
| `imageGen.expand(params)` | Outpaint / expand an image canvas |
| `imageGen.restyle(params)` | Restyle an image |
| `imageGen.removeBackground(params)` | Remove background from an image |
| `imageGen.upscale(params)` | Upscale an image |
| `imageGen.batch(params)` | Run a batch of image operations |
| `imageGen.session(params)` | Multi-turn image editing session |

### AudioGen

| Method | Description |
|--------|-------------|
| `audioGen.generate(params)` | Generate audio from a prompt |
| `audioGen.designVoices(params)` | Design candidate voices |
| `audioGen.saveDesignedVoice(params)` | Save a designed voice for reuse |

### ThreeDGen

| Method | Description |
|--------|-------------|
| `threeDGen.generate(params)` | Generate a 3D model |
| `threeDGen.remesh(params)` | Remesh an existing model |
| `threeDGen.rig(params)` | Rig a model for animation |
| `threeDGen.animate(params)` | Animate a rigged model |

### UGC account mutations

Browse, get, and `recordUse` remain **ungated**. `recordUse` accepts anonymous users so plays can be counted without prompting them to log in. Account mutations require authentication.

| Method | Description |
|--------|-------------|
| `ugc.create(params)` | Publish new content |
| `ugc.update(params)` | Update existing content |
| `ugc.delete(id)` | Delete content |
| `ugc.like(id)` | Like content |
| `ugc.unlike(id)` | Unlike content |
| `ugc.report(params)` | Report content (`UgcReportParams`) |

### Multiplayer

Every realtime multiplayer entry point requires `authenticated_18plus`. `send`
and `leave` live on the `ServerRoom` returned by a gated entry point, so they
inherit the gate transitively.

| Method | Description |
|--------|-------------|
| `multiplayer.createRoom(roomType)` | Create a realtime room |
| `multiplayer.joinOrCreateRoom(roomType)` | Join an open room, or create one |
| `multiplayer.joinRoomByCode(code)` | Join a room by its share code |
| `multiplayer.matchmakeRoom(roomType)` | Pair into a room via matchmaking |
| `multiplayer.getUserRooms(options?)` | List the caller's rooms |

---

## Error Handling

Gated methods throw `AccessDeniedError` when the user does not meet the required access tier. Catch it to show custom UI or fall back gracefully:

```typescript
import { AccessDeniedError } from '@series-inc/rundot-game-sdk'

try {
  await RundotGameAPI.imageGen.generate({ prompt: 'A sunset' })\n} catch (error) {\n  if (error instanceof AccessDeniedError) {\n    console.log(error.requiredTier) // 'authenticated_18plus'\n    console.log(error.action)       // always 'prompt_login' for SDK-gated calls\n  }\n}\n```\n\n### AccessDeniedError\n\n| Property | Type | Description |\n|----------|------|-------------|\n| `requiredTier` | `AccessTier` | The tier the user must reach (`'anonymous'` | `'authenticated_18plus'`) |\n| `action` | `'prompt_login' | 'prompt_age_gate'` | The remediation action required to satisfy the gate. SDK-gated method calls always set this to `'prompt_login'`; `'prompt_age_gate'` exists on the type for host-side age-gated flows and is never emitted by a gated SDK call. |\n\n---\n\n## API Reference\n\n### `RundotGameAPI.accessGate`\n\n| Method / Property | Returns | Description |\n|-------------------|---------|-------------|\n| `getAccessTier()` | `AccessTier` | Current user's access tier (`'anonymous'` or `'authenticated_18plus'`) |\n| `isAnonymous()` | `boolean` | `true` if the user is not logged in |\n| `promptLogin()` | `Promise<PromptLoginResult>` | Show the login dialog and return the result |\n| `autoPromptLogin` | `boolean` | Get or set whether gated calls auto-prompt login for anonymous users |\n\n{% hint style=\"info\" %}\n`getAccessTier()` and `isAnonymous()` are resolved entirely client-side from the cached profile; they do no network round-trip and reflect the last known auth state. The tier is `'anonymous'` when there is no cached profile or the profile is anonymous, otherwise `'authenticated_18plus'`. `isAnonymous()` is exactly `getAccessTier() === 'anonymous'`.\n{% endhint %}\n\n### Types\n\n```typescript\ntype AccessTier = 'anonymous' | 'authenticated_18plus'\n\ninterface PromptLoginResult {\n  success: boolean\n  profile?: Profile\n}\n\ninterface Profile {\n  id: string\n  username: string\n  name?: string\n  avatarUrl?: string | null\n  isAnonymous?: boolean\n}\n```\n\n---\n\n## Best Practices\n\n- **Leave auto-prompt enabled** unless you need full control over when the login dialog appears. It provides the smoothest experience for anonymous users who trigger a gated feature.\n- **Catch `AccessDeniedError`** at the call site so you can show contextual feedback (e.g. \"Log in to generate images\") rather than a generic error.\n- **Check `isAnonymous()` up front** if you want to hide or disable UI for features that require login, rather than waiting for the call to fail.\n- **Don't gate-check manually** before calling gated methods, the SDK handles it for you. Calling `isAnonymous()` is useful for UI hints, but the gate itself is automatic.\n