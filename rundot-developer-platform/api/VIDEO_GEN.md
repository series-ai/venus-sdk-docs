# Video Generation API (BETA)

Generate short videos from text prompts or images. Supports text-to-video, image-to-video, and reference-to-video modes across multiple providers.

---

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const result = await RundotGameAPI.videoGen.generate({
  provider: 'seedance-2.0',
  mode: 'text-to-video',
  prompt: 'A dragon flying over a medieval castle at sunset, cinematic',
  durationSeconds: 8,
  aspectRatio: '16:9',
})

console.log(result.videoUrl)
console.log(result.durationSeconds)
```

## Providers

| Provider | Best For |
|----------|----------|
| `seedance-2.0` | High-quality generation with reference support, audio generation, 4–15s |
| `seedance-2.0-fast` | Faster generation at slightly lower quality, same capabilities as 2.0 |
| `kling-3.0-standard` | Multi-prompt storytelling, negative prompts, configurable shot types, 3–15s |

## Text-to-Video

Generate video entirely from a text prompt.

```typescript
// Seedance
const result = await RundotGameAPI.videoGen.generate({
  provider: 'seedance-2.0',
  mode: 'text-to-video',
  prompt: 'A cat jumping between rooftops in a cyberpunk city, neon lights',
  durationSeconds: 6,
  aspectRatio: '16:9',
  resolution: '1080p',
  generateAudio: true,
})

// Kling
const result = await RundotGameAPI.videoGen.generate({
  provider: 'kling-3.0-standard',
  mode: 'text-to-video',
  prompt: 'Ocean waves crashing on a rocky shore at golden hour',
  negativePrompt: 'blurry, low quality',
  durationSeconds: 10,
  aspectRatio: '16:9',
  generateAudio: true,
})
```

## Image-to-Video

Animate a static image into a video. Provide a start image, and optionally an end image for guided transitions.

```typescript
// Seedance — animate a character sprite
const result = await RundotGameAPI.videoGen.generate({
  provider: 'seedance-2.0',
  mode: 'image-to-video',
  startImageUrl: 'https://cdn.example.com/character-idle.png',
  endImageUrl: 'https://cdn.example.com/character-running.png',
  prompt: 'Character transitions from idle to running, smooth motion',
  durationSeconds: 4,
})

// Kling — animate a landscape
const result = await RundotGameAPI.videoGen.generate({
  provider: 'kling-3.0-standard',
  mode: 'image-to-video',
  startImageUrl: 'https://cdn.example.com/landscape.png',
  prompt: 'Clouds drift slowly, sunlight shifts across the valley',
  durationSeconds: 8,
})
```

## Reference-to-Video (Seedance only)

Use image, video, or audio references to guide generation while creating new content.

```typescript
const result = await RundotGameAPI.videoGen.generate({
  provider: 'seedance-2.0',
  mode: 'reference-to-video',
  prompt: 'A warrior performing a sword combo in the same art style',
  imageReferences: ['https://cdn.example.com/art-style-ref.png'],
  videoReferences: ['https://cdn.example.com/motion-ref.mp4'],
  durationSeconds: 6,
  aspectRatio: '1:1',
})
```

## Multi-Prompt (Kling only)

Script multiple scenes within a single generation by providing timed prompt segments.

```typescript
const result = await RundotGameAPI.videoGen.generate({
  provider: 'kling-3.0-standard',
  mode: 'text-to-video',
  prompt: 'A day in the life of a forest',
  durationSeconds: 15,
  multiPrompt: [
    { prompt: 'Sunrise through the trees, mist rising', durationSeconds: 5 },
    { prompt: 'Animals waking up, birds flying', durationSeconds: 5 },
    { prompt: 'Sunset, golden light filtering through leaves', durationSeconds: 5 },
  ],
})
```

## Async Job Recovery

Video generation runs as an async job. Use `getCompletedJobs()` to drain results after disconnects. Pass `clientRef` for correlation.

```typescript
const completedJobs = await RundotGameAPI.videoGen.getCompletedJobs()

for (const job of completedJobs) {
  if (job.status === 'completed' && job.result) {
    console.log(`Video ready:`, job.result.videoUrl)
  } else if (job.status === 'failed') {
    console.error(`Generation failed:`, job.error)
  }
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `videoGen.generate(params)` | `Promise<VideoGenResult>` | Generate video |
| `videoGen.getCompletedJobs()` | `Promise<VideoGenJobEvent[]>` | Drain completed async job results |

### Common Parameters (all modes)

| Parameter | Type | Description |
|-----------|------|-------------|
| `provider` | `VideoGenProvider` | Required — `'seedance-2.0'`, `'seedance-2.0-fast'`, or `'kling-3.0-standard'` |
| `mode` | `VideoGenMode` | Required — `'text-to-video'`, `'image-to-video'`, or `'reference-to-video'` |
| `prompt` | `string` | Text description of the video content |
| `seed` | `number` | Seed for reproducible results |
| `clientRef` | `string` | Opaque correlation ID echoed back in job events |

### Seedance Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `aspectRatio` | `VideoGenAspectRatio` | `'21:9'`, `'16:9'`, `'4:3'`, `'1:1'`, `'3:4'`, or `'9:16'` |
| `resolution` | `VideoGenResolution` | `'480p'`, `'720p'`, or `'1080p'` |
| `durationSeconds` | `4–15` | Video length in seconds |
| `generateAudio` | `boolean` | Generate synchronized audio track |
| `cameraFixed` | `boolean` | Lock camera position during generation |
| `startImageUrl` | `string` | Start frame image (image-to-video mode) |
| `endImageUrl` | `string` | End frame image (image-to-video mode) |
| `imageReferences` | `string[]` | Style/content reference images (reference-to-video mode) |
| `videoReferences` | `string[]` | Motion reference videos (reference-to-video mode) |
| `audioReferences` | `string[]` | Audio references (reference-to-video mode) |

### Kling Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `aspectRatio` | `'16:9' \| '9:16' \| '1:1'` | Output aspect ratio |
| `durationSeconds` | `3–15` | Video length in seconds |
| `generateAudio` | `boolean` | Generate synchronized audio track |
| `negativePrompt` | `string` | What to avoid in the video |
| `cfgScale` | `number` | Classifier-free guidance scale |
| `shotType` | `'customize' \| 'intelligent'` | Camera shot control |
| `multiPrompt` | `KlingMultiPromptElement[]` | Timed prompt segments |
| `startImageUrl` | `string` | Start frame image (image-to-video mode) |
| `endImageUrl` | `string` | End frame image (image-to-video mode) |

### VideoGenResult

| Field | Type | Description |
|-------|------|-------------|
| `generationId` | `string` | Unique ID for the generated video |
| `videoUrl` | `string` | URL to the video file |
| `posterUrl` | `string \| undefined` | URL to a poster/thumbnail frame |
| `durationSeconds` | `number` | Actual duration of the video |
| `width` | `number` | Video width in pixels |
| `height` | `number` | Video height in pixels |
| `provider` | `VideoGenProvider` | Provider that generated the video |
| `mode` | `VideoGenMode` | Mode used for generation |
| `prompt` | `string` | The prompt used |
| `seed` | `number` | Seed used for generation |

### VideoGenJobEvent

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | `string` | Job identifier |
| `status` | `'completed' \| 'failed'` | Job outcome |
| `params` | `VideoGenParams` | Original request parameters |
| `result` | `VideoGenResult \| undefined` | Result if completed |
| `error` | `string \| undefined` | Error message if failed |

## Best Practices

- Use `seedance-2.0-fast` during development for faster iteration, then switch to `seedance-2.0` for production quality.
- For image-to-video, provide high-quality source images — the output quality is bounded by the input.
- Use `cameraFixed: true` when animating UI elements or sprites that should stay centered.
- Kling's `multiPrompt` is ideal for cutscenes with distinct beats — give each segment a clear visual description.
- Use `clientRef` for all generation calls to enable recovery after disconnects.
- Call `getCompletedJobs()` on reconnect to retrieve results from any in-flight generations.

## Limits

- Seedance duration range: **4–15 seconds**. Kling duration range: **3–15 seconds**.
- `reference-to-video` mode is only available with Seedance providers.
- `multiPrompt` and `negativePrompt` are only available with Kling.
- Subject to per-creator rate-limit tiers — see [Rate Limits](RATE_LIMITS.md).
