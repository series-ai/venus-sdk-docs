# AI API

Call hosted AI models for text generation, chat, hints, narrative beats, and image generation without managing your own inference stack.

---

## Section 1: Text Generation

Use chat completions for hints, NPC dialogue, dynamic content, and more.

### Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const response = await RundotGameAPI.ai.requestChatCompletionAsync({
  model: 'gpt-5.4-mini',
  messages: [
    { role: 'user', content: 'Give me a tip for this puzzle.' },
  ],
})

console.log(response.message)
```

### Model Management

```typescript
// List available models dynamically
const models = await RundotGameAPI.ai.getAvailableCompletionModels()
console.log('Available models:', models)
```

Commonly available production models:
- `gpt-5`
- `gpt-5.4-mini`
- `claude-haiku-4-5`
- `claude-sonnet-4-6`
- `claude-opus-4-1`
- `deepseek/deepseek-chat`

> **Tip:** Call `getAvailableCompletionModels()` at runtime to discover the current model list.

### Chat Completion Parameters

```typescript
const response = await RundotGameAPI.ai.requestChatCompletionAsync({
  model: 'gpt-5.4-mini',
  messages: [
    { role: 'system', content: 'You are a helpful game assistant.' },
    { role: 'user', content: 'How do I defeat the boss?' },
  ],
  maxTokens: 150,        // Maximum tokens to generate
  temperature: 0.7,      // Randomness (0.0 to 2.0)
  topP: 0.9,             // Nucleus sampling (0.0 to 1.0)
  topK: 40,              // Top-k sampling
  stop: ['\n\n'],        // Stop sequences
  presencePenalty: 0,    // Presence penalty (-2.0 to 2.0)
  frequencyPenalty: 0,   // Frequency penalty (-2.0 to 2.0)
})
```

### Text Generation API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `ai.requestChatCompletionAsync(request)` | `Promise<{ message }>` | Generate text completion |
| `ai.getAvailableCompletionModels()` | `Promise<string[]>` | List available models |

---

## Section 2: Image Generation

Generate images from text prompts for dynamic game content, user-created art, and more.

### Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A magical forest with glowing mushrooms, fantasy game art style',
})

// Use the generated image
document.querySelector('#generated-image').src = result.imageUrl
```

### Image Generation Parameters

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

### Model Selection

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

### Background Removal

Generate images with transparent backgrounds by setting `removeBackground: true`. The output is always a PNG with an alpha channel.

```typescript
const result = await RundotGameAPI.imageGen.generate({
  prompt: 'A cartoon cat character',
  removeBackground: true,
})

// result.imageUrl points to a transparent PNG
```

### Aspect Ratios

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

### Image Generation API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `imageGen.generate(params)` | `Promise<{ imageUrl, prompt }>` | Generate image from prompt |

### ImageGenParams

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string` | Text description of desired image (required) |
| `negativePrompt` | `string` | What to avoid in the image |
| `aspectRatio` | `string` | Image dimensions (default: `'1:1'`) |
| `referenceImages` | `string[]` | URLs or data URIs of reference images |
| `seed` | `number` | Seed for reproducible results |
| `removeBackground` | `boolean` | Remove background and return a transparent PNG |
| `model` | `ImageGenModel` | Model to use (default: `'gemini-3.1-flash-image-preview'`) |

---

## Best Practices

### Text Generation

- Provide concise prompts; include relevant game context to reduce token usage.
- Gracefully degrade when the API is unreachable—AI should enhance, not block, core gameplay.
- Respect content policies: filter user input and sanitize AI responses before showing them in-game.
- Cache model selection in your state so you can update prompts on the fly.

### Image Generation

- Use descriptive prompts with style keywords (e.g., "fantasy game art", "pixel art", "watercolor").
- Use `negativePrompt` to exclude unwanted elements.
- Use consistent `seed` values when you need reproducible results.
- Choose aspect ratios appropriate for your use case.
- Handle generation failures gracefully—show a placeholder or retry.
