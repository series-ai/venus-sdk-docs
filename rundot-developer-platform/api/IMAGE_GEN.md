# Image Generation API (BETA)

Generate images from text prompts for dynamic game content, user-created art, and more.

---

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A magical forest with glowing mushrooms, fantasy game art style',
})

// Use the generated image
document.querySelector('#generated-image').src = result.imageUrl
```

## Image Generation Parameters

```typescript
const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A brave knight in golden armor',
  negativePrompt: 'blurry, low quality, dark',
  aspectRatio: '16:9',     // Image dimensions
  referenceImages: [       // Optional reference images
    'https://example.com/reference.png'
  ],
  seed: 12345,             // For reproducible results
  model: 'gemini-3.1-flash-image-preview', // Optional, this is the default
})

console.log('Generated image:', result.imageUrl)
console.log('Prompt used:', result.prompt)
```

## Model Selection

Two models are available:

| Model | Codename | Best For |
|-------|----------|----------|
| `gemini-3.1-flash-image-preview` (default) | Nano Banana 2 | Fast, cost-efficient generation. Pro-level quality at Flash speed. |
| `gemini-3-pro-image-preview` | Nano Banana Pro | Studio-quality 4K visuals, complex layouts, precise text rendering. |

```typescript
// Use the Pro model for higher quality
const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A detailed fantasy landscape with text overlay "Game Over"',
  model: 'gemini-3-pro-image-preview',
})
```

## Background Removal

Generate images with transparent backgrounds by setting `removeBackground: true`. The output is always a PNG with an alpha channel.

```typescript
const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A cartoon cat character',
  removeBackground: true,
})

// result.imageUrl points to a transparent PNG
```

### Model Selection for Background Removal

By default, `removeBackground: true` uses **Bria RMBG** (fast, ~3s). For higher-quality results, pass an object to select **BiRefNet**:

```typescript
const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A portrait character for a visual novel',
  removeBackground: {
    model: 'birefnet',
    variant: 'portrait',    // 'light' | 'heavy' | 'portrait'
    resolution: '2048x2048' // '1024x1024' | '2048x2048'
  },
})
```

| Model | Speed | Edge Quality | Best For |
|-------|-------|-------------|----------|
| `bria` (default) | ~3s | Good | Fast iteration, game sprites |
| `birefnet` (light) | ~5-10s | Better | General use, higher fidelity |
| `birefnet` (heavy) | ~10-15s | Best | Complex edges, fine detail |
| `birefnet` (portrait) | ~5-10s | Best for people | Characters, portraits |

### Standalone Background Removal

Remove the background from an **existing** image (not during generation):

```typescript
const result = await RundotGameAPI.imageGen.removeBackground({
  imageUrl: 'https://example.com/photo.png',
  model: 'birefnet',
  variant: 'portrait',
})

console.log(result.imageUrl) // Transparent PNG URL
console.log(result.width, result.height)
```

#### RemoveBackgroundParams

| Parameter | Type | Description |
|-----------|------|-------------|
| `imageUrl` | `string` | Source image: file key, HTTPS URL, or data URI (required) |
| `model` | `'bria' \| 'birefnet'` | Model to use (default: `'bria'`) |
| `variant` | `'light' \| 'heavy' \| 'portrait'` | BiRefNet variant (ignored for bria) |
| `resolution` | `'1024x1024' \| '2048x2048'` | BiRefNet operating resolution (default: `'1024x1024'`) |

---

## Depth Estimation

Generate a greyscale depth map from any image using Marigold depth estimation. Useful for parallax effects, 3D reconstruction, lighting, and fog.

```typescript
const result = await RundotGameAPI.imageGen.estimateDepth({
  imageUrl: 'https://example.com/scene.png',
})

// result.depthMapUrl → greyscale PNG (white = near, black = far)
console.log(result.depthMapUrl)
console.log(result.width, result.height)
```

### Advanced Parameters

```typescript
const result = await RundotGameAPI.imageGen.estimateDepth({
  imageUrl: 'sprites/room.png',   // file key from your app storage
  numInferenceSteps: 20,          // 1–50, higher = more accurate (default: 10)
  ensembleSize: 15,               // 1–20, predictions to average (default: 10)
  processingRes: 2048,            // 0–4096, max resolution; 0 = input size (default: 0)
})
```

#### DepthEstimationParams

| Parameter | Type | Description |
|-----------|------|-------------|
| `imageUrl` | `string` | Source image: file key, HTTPS URL, or data URI (required) |
| `numInferenceSteps` | `number` | Inference steps, 1–50 (default: 10) |
| `ensembleSize` | `number` | Ensemble predictions, 1–20 (default: 10) |
| `processingRes` | `number` | Max processing resolution, 0–4096; 0 = input (default: 0) |

## Aspect Ratios

| Ratio | Best For |
|-------|----------|
| `1:1` | Square icons, avatars, profile pictures |
| `2:3` | Portrait characters, mobile wallpapers |
| `3:2` | Landscape scenes, desktop wallpapers |
| `3:4` | Portrait photos, card art |
| `4:3` | Standard landscape, game UI |
| `4:5` | Social media posts |
| `5:4` | Landscape photos |
| `9:16` | Phone wallpapers, vertical video |
| `16:9` | Widescreen, game backgrounds |
| `21:9` | Ultra-wide panoramas |

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `imageGen.generate(params)` | `Promise<{ imageUrl, prompt }>` | Generate image from prompt |
| `imageGen.estimateDepth(params)` | `Promise<{ depthMapUrl, width, height }>` | Depth map from image |
| `imageGen.removeBackground(params)` | `Promise<{ imageUrl, width, height }>` | Remove background from image |

### ImageGenParams

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | Text description of desired image (required) |
| `negativePrompt` | `string` | What to avoid in the image |
| `aspectRatio` | `string` | Image dimensions (default: `'1:1'`) |
| `referenceImages` | `string[]` | URLs or data URIs of reference images (max 5 per call) |
| `seed` | `number` | Seed for reproducible results |
| `removeBackground` | `boolean \| RemoveBackgroundOptions` | Remove background (true = Bria, or pass object for model choice) |
| `model` | `ImageGenModel` | Model to use (default: `'gemini-3.1-flash-image-preview'`) |

## Best Practices

- Use descriptive prompts with style keywords (e.g., "fantasy game art", "pixel art", "watercolor").
- Use `negativePrompt` to exclude unwanted elements.
- Use consistent `seed` values when you need reproducible results.
- Choose aspect ratios appropriate for your use case.
- Handle generation failures gracefully—show a placeholder or retry.

## Limits

- `referenceImages` accepts up to **5** entries per call. Exceeding this rejects the request with an error before generation starts.
- Subject to per-creator rate-limit tiers — see [Rate Limits](RATE_LIMITS.md).
- **Utility output URLs (`estimateDepth`, `removeBackground`) are valid for up to 7 days.** These are ephemeral results — download and persist them if you need long-term access. Do not store the URL itself as a permanent reference.
