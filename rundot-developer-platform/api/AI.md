# AI API

Call hosted AI models for text generation, chat, hints, narrative beats, and more — without managing your own inference stack.

For media generation, see the dedicated docs:
- [Image Generation API](IMAGE_GEN.md)
- [Audio Generation API](AUDIO_GEN.md)
- [Video Generation API](VIDEO_GEN.md)

---

## Quick Start

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

## Model Management

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

## Chat Completion Parameters

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

## Multimodal Messages (Image Input)

Pass an array of content blocks instead of a plain string when you need to send images alongside text. Use a vision-capable model — check `getAvailableCompletionModels()` and your provider's docs for current support.

**By URL or data URI:**

```typescript
const response = await RundotGameAPI.ai.requestChatCompletionAsync({
  model: 'gpt-5.4-mini',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image_url',
          image_url: {
            url: 'https://example.com/screenshot.png',
            detail: 'auto', // 'low' | 'high' | 'auto', optional
          },
        },
      ],
    },
  ],
})
```

**By raw base64 bytes:**

```typescript
const response = await RundotGameAPI.ai.requestChatCompletionAsync({
  model: 'claude-sonnet-4-6',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this asset.' },
        {
          type: 'image',
          image: {
            format: 'png',         // 'jpeg' | 'png' | 'gif' | 'webp'
            data: '<base64 bytes>', // no `data:` prefix
          },
        },
      ],
    },
  ],
})
```

**Content block reference:**

| Block type | Field | Notes |
| --- | --- | --- |
| `text` | `text: string` | Plain text segment. |
| `image_url` | `image_url.url: string` | `http(s)://` URL or `data:image/<type>;base64,…` URI. |
| `image_url` | `image_url.detail?: 'low' \| 'high' \| 'auto'` | Optional vision-detail hint; respected by models that support it. |
| `image` | `image.format: 'jpeg' \| 'png' \| 'gif' \| 'webp'` | Required when sending raw bytes. |
| `image` | `image.data: string` | Base64 bytes only — do **not** include the `data:` prefix. |

`image_url` is sent directly to OpenAI/DeepSeek-compatible providers; for Anthropic models the proxy fetches the URL and base64-encodes the bytes before forwarding. Use `image` (raw base64) when the source isn't a public URL.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `ai.requestChatCompletionAsync(request)` | `Promise<{ message }>` | Generate text completion |
| `ai.getAvailableCompletionModels()` | `Promise<string[]>` | List available models |

## Best Practices

- Provide concise prompts; include relevant game context to reduce token usage.
- Gracefully degrade when the API is unreachable—AI should enhance, not block, core gameplay.
- Respect content policies: filter user input and sanitize AI responses before showing them in-game.
- Cache model selection in your state so you can update prompts on the fly.

## Limits

- Subject to per-creator rate-limit tiers — see [Rate Limits](RATE_LIMITS.md).
