# Clips API (BETA)

Record gameplay clips — canvas video with game audio and optional microphone — and persist them as private [UGC](UGC.md) entries backed by the [Files API](FILES.md).

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const { clips } = RundotGameAPI

// 1. Route game audio through Web Audio (once at init)
clips.useGameAudio(myMasterGainNode)

// 2. Start recording (canvas + mic + game audio)
await clips.startRecordingAsync()

// 3. Stop and persist as private UGC
const clip = await clips.stopRecordingAsync({ title: 'Boss kill', tags: ['win'] })

// clip.blob       → Blob for immediate playback
// clip.ugc        → private UGC entry (contentType: 'clip')
// clip.fileKey    → durable GCS key for later retrieval
// clip.fileUrl    → signed URL (~4h TTL, immediate playback only)

// 4. Optionally make it public
await clips.publishClipAsync(clip.ugc.id)
```

## How It Works

Clips captures the game's `<canvas>` via `captureStream()` and mixes in game audio (from a Web Audio node) and/or microphone audio via `MediaRecorder`. The resulting video is uploaded to the [Files API](FILES.md) and registered as a private [UGC](UGC.md) entry with `contentType: 'clip'`.

```
startRecordingAsync()
  → canvas.captureStream(fps)
  → optional getUserMedia({ audio: true })  [mic]
  → optional useGameAudio(node)             [game audio]
  → MediaRecorder records mixed stream

stopRecordingAsync()
  → files.upload + PUT blob + files.confirmUpload (moderation)
  → ugc.create(contentType: 'clip', isPublic: false)
  → returns ClipResult
```

## Game Audio

Call `useGameAudio(node)` **once at init** with your game's master `AudioNode` (typically a `GainNode`). Without it, only microphone audio is captured (or silence if mic is also off).

```typescript
// Phaser
clips.useGameAudio(game.sound.context.destination)

// three.js / react-three-fiber
clips.useGameAudio(audioListener.getInput())

// Generic Web Audio
const masterGain = audioCtx.createGain()
// ... connect your audio graph to masterGain ...
clips.useGameAudio(masterGain)
```

{% hint style="info" %}
`<audio>` and `<video>` element playback **cannot** be captured — only Web Audio API nodes work. If your game uses HTML media elements for sound, route them through a `MediaElementAudioSourceNode` first.
{% endhint %}

## Consent & Permissions

Microphone recording requires **three layers** of permission, enforced automatically:

### 1. Sign-in

Anonymous users cannot record with a microphone. If the user isn't signed in, `requestCaptureConsentAsync()` routes through the host sign-in flow first.

### 2. App Capture Consent (per app, per user)

| Creator Tier | Behavior |
|---|---|
| **T1** (trusted) | Auto-granted server-side; no user prompt |
| **T2 and below** | Native consent modal shown once per user per app |

Consent status is persisted server-side. Use `getCaptureConsentAsync()` to check without prompting, and `requestCaptureConsentAsync()` to trigger the prompt.

### 3. OS Microphone Permission

The browser/OS mic permission prompt fires on the first `getUserMedia` call. This is separate from app consent — `granted` app consent does not guarantee OS permission.

### Skipping Consent Entirely

If your game doesn't need the microphone, pass `audio: { microphone: false }` to skip all consent checks:

```typescript
await clips.startRecordingAsync({
  audio: { microphone: false, gameAudio: true },
})
```

## Capture Modes

### Auto Mode (default)

Every frame the canvas renders is automatically captured. Use this for most games.

```typescript
await clips.startRecordingAsync({ captureMode: 'auto' })
```

### Manual Mode

Call `captureFrame()` to snapshot the canvas at specific points — useful when HUD elements are composited into the same canvas and you want to capture only the clean game render.

```typescript
await clips.startRecordingAsync({ canvas: mainCanvas, captureMode: 'manual' })

function renderLoop() {
  renderWorld()
  clips.captureFrame()   // snapshot clean gameplay
  renderHud()            // HUD is excluded from recording
  requestAnimationFrame(renderLoop)
}
```

`captureFrame()` is a no-op when not recording, so it's safe to leave in your render loop.

## Auto-Stop

When `maxDurationMs` elapses, the recorder stops capture and releases the mic immediately, but retains recorded data. The `onAutoStop` callback fires — the game **must still call `stopRecordingAsync()`** to get the blob and persist.

```typescript
await clips.startRecordingAsync({
  maxDurationMs: 30_000,
  onAutoStop: () => {
    clips.stopRecordingAsync({ title: 'Auto clip' })
  },
})
```

## Cancel

Abort a recording, discard all data, and release the mic:

```typescript
await clips.cancelRecordingAsync()
```

## Publishing

Clips are **private by default**. To share with other players:

```typescript
const published = await clips.publishClipAsync(clip.ugc.id)
// Sets both file visibility and UGC isPublic to true
```

Other players can browse published clips via UGC:

```typescript
const shared = await RundotGameAPI.ugc.browse({ contentType: 'clip' })
```

## Durable Playback URLs

The `fileUrl` in `ClipResult` expires after ~4 hours. For long-term playback, store `fileKey` and resolve fresh URLs:

```typescript
const url = await RundotGameAPI.files.getUrl({ key: clip.fileKey })
```

## API Reference

### `isSupportedAsync(): Promise<ClipsSupport>`

Feature detection. Returns whether the environment supports recording.

```typescript
interface ClipsSupport {
  canRecord: boolean
  canUseMicrophone: boolean
  reason?: string
}
```

### `getCaptureConsentAsync(): Promise<CaptureConsent>`

Check the current app's mic consent status without prompting.

```typescript
type CaptureConsentStatus = 'granted' | 'denied' | 'undetermined'

interface CaptureConsent {
  status: CaptureConsentStatus
  canAskAgain: boolean   // false when status is 'denied'
}
```

### `requestCaptureConsentAsync(): Promise<CaptureConsent>`

Trigger the host consent UI. For T1 apps, this short-circuits to `granted`. For T2+, shows a native modal.

### `useGameAudio(node: AudioNode): void`

Register the master Web Audio output for game-audio capture. Call once at init, before recording.

### `startRecordingAsync(options?: StartClipRecordingOptions): Promise<void>`

Begin recording.

```typescript
interface StartClipRecordingOptions {
  canvas?: HTMLCanvasElement | string  // default: first <canvas> on page
  fps?: number                         // default: 30
  maxDurationMs?: number               // default: 60_000 (60s)
  audio?: ClipAudioOptions
  captureMode?: 'auto' | 'manual'     // default: 'auto'
  mimeType?: string                    // throws if unsupported
  videoBitsPerSecond?: number          // default: 2_500_000
  onAutoStop?: () => void              // fired when maxDurationMs reached
}

interface ClipAudioOptions {
  microphone?: boolean   // default: true
  gameAudio?: boolean    // default: true (effective only after useGameAudio)
}
```

### `captureFrame(): void`

Manual mode only. Snapshot the canvas into the recording. No-op when not recording or in auto mode.

### `stopRecordingAsync(persist?: ClipPersistOptions): Promise<ClipResult>`

Stop recording and optionally upload + create UGC.

```typescript
interface ClipPersistOptions {
  persist?: 'none' | 'ugc'            // default: 'ugc'
  title?: string
  tags?: string[]
  data?: Record<string, unknown>       // merged into UGC data blob
}

interface ClipResult {
  blob: Blob
  mimeType: string
  durationMs: number
  width: number
  height: number
  sizeBytes: number
  ugc?: UgcEntry       // present when persist !== 'none'
  fileKey?: string      // durable GCS key
  fileUrl?: string      // ~4h signed URL for immediate playback
}
```

### `cancelRecordingAsync(): Promise<void>`

Abort recording, discard data, release mic and tracks.

### `publishClipAsync(ugcId: string): Promise<UgcEntry>`

Make a private clip public. Sets both the file visibility and UGC `isPublic` to `true`.

## Defaults

| Setting | Default |
|---|---|
| `fps` | 30 |
| `maxDurationMs` | 60,000 (60s) |
| `videoBitsPerSecond` | 2,500,000 |
| `audio.microphone` | `true` |
| `audio.gameAudio` | `true` |
| `captureMode` | `'auto'` |
| `persist` | `'ugc'` |

## Error Handling

```typescript
try {
  await clips.startRecordingAsync()
} catch (err) {
  if (err instanceof Error && err.message === 'CAPTURE_CONSENT_DENIED') {
    // Fallback: record without mic
    await clips.startRecordingAsync({ audio: { microphone: false } })
    return
  }
  throw err
}
```

| Error | When |
|---|---|
| `CAPTURE_CONSENT_DENIED` | Mic enabled but app consent denied or user declined sign-in |
| `[clips] a recording is already in progress` | Second `startRecordingAsync` while recording |
| `[clips] recording is not supported in this environment` | No `MediaRecorder` or `captureStream` |
| `[clips] no <canvas> found...` | Canvas selector/element missing |
| `[clips] mimeType "..." is not supported here` | Explicit unsupported mime type |
| `NotAllowedError` (from `getUserMedia`) | OS mic permission denied |
| `[clips] clip is N bytes which exceeds the M-byte upload cap...` | Over `files.getQuota().maxFileBytes` |
| `CONTENT_REJECTED` | Video moderation flagged content |

## Supported Formats

The SDK auto-selects the first supported format:

| Platform | Format |
|---|---|
| Safari / iOS | `video/mp4` |
| Chrome / Android | `video/webm` |

Both are accepted by the Files API and content moderation pipeline.

## Limitations

- **Canvas only** — DOM elements outside the canvas are not recorded
- **No camera** — v1 captures canvas + mic only, no webcam
- **Web Audio required for game sound** — `<audio>`/`<video>` elements can't be captured directly
- **Mock host** — recording unavailable; use real WebView or web sandbox for testing
- **Upload size cap** — limited by `files.getQuota().maxFileBytes` (typically 50 MB); tune `maxDurationMs`, `fps`, and `videoBitsPerSecond` accordingly
