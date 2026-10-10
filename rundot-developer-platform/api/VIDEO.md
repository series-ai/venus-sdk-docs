# Video API (BETA)

Hand off video playback to the native host using Picture-in-Picture (PiP). The player keeps watching while your game stays interactive underneath.

{% hint style="danger" %}
**iOS only**: Picture-in-Picture is currently supported on **iOS devices** only. Android and mobile web are not supported. Calls to `requestPiPAsync` on unsupported platforms will reject.
{% endhint %}

{% hint style="warning" %}
All SDK methods can reject; unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

{% hint style="info" %}
**Known issue:** PiP playback launches and runs correctly, but restoration does not work as expected. Tapping the Dynamic Island does nothing, and tapping the restore button simply closes the PiP window instead of restoring the app to the expected state.
{% endhint %}

Here are some examples of what you might use it for:

* Play a cutscene or tutorial video in native PiP while the player continues exploring
* Stream a reward preview video while the player keeps tapping
* Show a live event broadcast in a floating window during gameplay

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Request PiP playback
const { sessionId } = await RundotGameAPI.video.requestPiPAsync({
  contentId: 'intro-cutscene',
  videoUrl: 'https://cdn.example.com/videos/intro.mp4',
  positionSeconds: 0,
})

// Listen for when the player returns from native playback
RundotGameAPI.video.onResumeFromNativePlayback((data) => {
  console.log(`Resumed at ${data.positionSeconds}s`)
  resumeGameplayFromVideo(data.positionSeconds)
})
```

## How It Works

```
Game calls requestPiPAsync()
     │
     ▼
Native host opens PiP player ──▶ User watches video
     │
     ▼
User dismisses PiP / video ends
     │
     ▼
Host fires onResumeFromNativePlayback
     │
     ▼
Game calls readyForPlaybackResumeAsync()
     │
     ▼
Game calls resumeAckAsync()
```

1. **Request**: your game calls `requestPiPAsync` with the video URL, content ID, and start position. The host returns a `sessionId` that identifies the PiP session.
2. **Native playback**: the host opens the video in a native PiP window. Your game remains interactive underneath.
3. **Resume notification**: when the user dismisses PiP or the video finishes, the host fires the `onResumeFromNativePlayback` callback with the current playback position.
4. **Handshake**: your game signals it is ready to take over by calling `readyForPlaybackResumeAsync`, then confirms the transition with `resumeAckAsync`.

## Complete Example

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Subscribe to resume events before requesting PiP
const subscription = RundotGameAPI.video.onResumeFromNativePlayback(
  async (data) => {
    console.log(
      `Returning from native playback: content=${data.contentId}, ` +
      `position=${data.positionSeconds}s`
    )

    // Signal that the game is ready to resume
    await RundotGameAPI.video.readyForPlaybackResumeAsync({
      sessionId: data.sessionId,
    })

    // Pick up where the native player left off
    seekInGamePlayer(data.contentId, data.positionSeconds)

    // Acknowledge the transition is complete
    await RundotGameAPI.video.resumeAckAsync({
      sessionId: data.sessionId,
    })
  },
)

// Start PiP
async function playInPiP(contentId: string, videoUrl: string) {
  const { sessionId } = await RundotGameAPI.video.requestPiPAsync({
    contentId,
    videoUrl,
    positionSeconds: 0,
    playbackRate: 1.0,
    contentLabel: 'Episode 1',
    artworkUrl: await RundotGameAPI.cdn.resolveAssetUrl('covers/episode-1.jpg'),
  })
  console.log('PiP started, session:', sessionId)
}

// Clean up when no longer needed
function dispose() {
  subscription.unsubscribe()
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `requestPiPAsync(input)` | `Promise<{ sessionId: string }>` | Start native PiP playback and receive a session identifier |
| `readyForPlaybackResumeAsync(input)` | `Promise<void>` | Signal that your game is ready to resume after PiP ends |
| `resumeAckAsync(input)` | `Promise<void>` | Acknowledge the resume transition is complete |
| `abortResumeAsync(input)` | `Promise<void>` | Cancel a resume your game cannot take over; native playback continues |
| `onResumeFromNativePlayback(callback)` | `Subscription` | Subscribe to events fired when the user returns from native playback |
| `onNativePlaybackError(callback)` | `Subscription` | Subscribe to native playback failures after `requestPiPAsync` resolved, so your game can fall back to its own player. A failure while the request is still pending rejects the request instead; you never get both. |

### `requestPiPAsync` input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contentId` | `string` | Yes | Unique identifier for the content being played |
| `videoUrl` | `string` | Yes | URL to the video resource |
| `positionSeconds` | `number` | Yes | Playback start position in seconds |
| `playbackRate` | `number` | No | Playback speed multiplier. Optional; if omitted, the native host plays at normal speed (1.0). The SDK does not substitute a default. |
| `contentLabel` | `string` | No | Human-readable label shown in the PiP window and the OS media controls (lock screen, notification shade). Defaults to the game's name. |
| `artworkUrl` | `string` | No | Image the OS media controls show (lock screen, notification shade), for example the video's cover. Defaults to the game's thumbnail. Either an `https` URL of a Series Cloudinary image (`https://res.cloudinary.com/seriesai/image/upload/...`) or of a public file deployed with your game (for example from `RundotGameAPI.cdn.resolveAssetUrl`; entitlement-protected assets resolve to expiring signed URLs and are not accepted), or an inline `data:image/png`, `data:image/jpeg`, or `data:image/webp` base64 image of at most 512 KB (for example a canvas snapshot). Any other URL rejects with `INVALID_ARTWORK_URL`; an inline image that is another type, too large, or not the declared format rejects with `INVALID_ARTWORK_DATA`. |

### `readyForPlaybackResumeAsync` / `resumeAckAsync` / `abortResumeAsync` input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | Yes | Session identifier returned by `requestPiPAsync` |
| `restoreAttemptId` | `string` | `abortResumeAsync`: Yes. `resumeAckAsync`: No (pass it when you have it) | The `restoreAttemptId` from the resume callback; it ties the call to one resume attempt |

### `onResumeFromNativePlayback` callback data

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The PiP session that ended |
| `positionSeconds` | `number` | Playback position when the user left native playback |
| `contentId` | `string` | Content identifier passed to `requestPiPAsync` |
| `restoreAttemptId` | `string` | Identifies this resume attempt; pass it to `resumeAckAsync` or `abortResumeAsync` |

### `onNativePlaybackError` callback data

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session that failed |
| `positionSeconds` | `number` | Last known playback position |
| `errorCode` | `string` | Machine-readable failure code |
| `message` | `string` | Human-readable detail |

### `requestPiPAsync` errors

| Error | Meaning |
|-------|---------|
| `INVALID_PAYLOAD` | A required field is missing or the video URL cannot be resolved |
| `INVALID_ARTWORK_URL` / `INVALID_ARTWORK_DATA` | `artworkUrl` is not an allowed image (see above) |
| `BACKGROUND_REQUEST_NOT_PERMITTED` | The app was in the background |
| `PIP_NOT_SUPPORTED` | Native playback is not available on this device or for this game |
| `SESSION_ACTIVE` | Another native video session is active; wait for it to end |
| `NATIVE_PLAYER_START_FAILED` | The native player could not start the video |
| `NATIVE_PLAYER_START_CANCELLED` | The user closed the native player before the video started |

The returned `Subscription` has an `unsubscribe()` method to detach the listener.

## Best Practices

* **Register the resume listener before requesting PiP** so you never miss the callback.
* **Always complete the handshake** (`readyForPlaybackResumeAsync` then `resumeAckAsync`): the host uses this to coordinate native/web player transitions.
* **Use `contentId` to reconcile state**: when the resume callback fires, look up the content by ID rather than relying on closure state, since multiple PiP sessions may overlap.
* **Clean up subscriptions** when your scene or component unmounts to prevent leaked listeners.
* **Handle errors on every await**: PiP may fail if the platform doesn't support it or the video URL is unreachable.
