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

### ImageGenParams

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | Text description of desired image (required) |
| `negativePrompt` | `string` | What to avoid in the image |
| `aspectRatio` | `string` | Image dimensions (default: `'1:1'`) |
| `referenceImages` | `string[]` | URLs or data URIs of reference images (max 5 per call) |
| `seed` | `number` | Seed for reproducible results |
| `removeBackground` | `boolean` | Remove background and return a transparent PNG |
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
