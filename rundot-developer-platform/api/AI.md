# AI API

Call hosted AI models for text generation, chat, hints, narrative beats, and more, without managing your own inference stack.

For media generation, see the dedicated docs:
- [Image Generation API](IMAGE_GEN.md)
- [Audio Generation API](AUDIO_GEN.md)
- [Video Generation API](VIDEO_GEN.md)

> **Migration notice:** `RundotGameAPI.ai` is deprecated. Use `RundotGameAPI.textGen` instead; the interface is identical. Calls to `RundotGameAPI.ai` still work but log a one-time console warning.

{% hint style="info" %}
**Type imports.** Every type on this page is exported under both its original `Ai*` name and a matching `TextGen*` alias (e.g. `AiChatCompletionRequest` is also `TextGenChatCompletionRequest`, `AiResponseFormat` is also `TextGenResponseFormat`). The aliases match the `textGen` namespace; either name resolves to the same type. The full alias set: `TextGenChatCompletionRequest`, `TextGenChatCompletionData`, `TextGenMessage`, `TextGenContentBlock`, `TextGenTextContent`, `TextGenImageUrlContent`, `TextGenImageContent`, `TextGenResponseFormat`, `TextGenToolUseContent`, `TextGenToolResultContent`, `TextGenTool`, `TextGenToolChoice`, `TextGenToolUse`.
{% endhint %}

---

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
  model: 'gpt-5.4-mini',
  messages: [
    { role: 'user', content: 'Give me a tip for this puzzle.' },
  ],
})

console.log(response.choices[0].message.content)
```

The completion resolves to an OpenAI-shaped `AiChatCompletionData`. The assistant text lives at `response.choices[0].message.content` (there is no top-level `message` field). See [Completion Response Shape](#completion-response-shape) for the full object.

## Model Management

```typescript
// List available models dynamically
const models = await RundotGameAPI.textGen.getAvailableCompletionModels()
console.log('Available models:', models)
```

Commonly available production models:
- `gpt-5`
- `gpt-5.4-mini`
- `claude-haiku-4-5`
- `claude-sonnet-4-6`
- `claude-opus-4-7`
- `deepseek/deepseek-chat`

> **Tip:** Call `getAvailableCompletionModels()` at runtime to discover the current model list.

## Chat Completion Parameters

```typescript
const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
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

**Request fields:**

| Field | Type | Description |
| --- | --- | --- |
| `model` | `string` | Model identifier. List options with `getAvailableCompletionModels()`. |
| `messages` | `AiMessage[]` | Conversation messages in OpenAI chat format. Each `content` is a string or an array of content blocks. |
| `system` | `string \| AiTextContent[]` | Structured system prompt. See [System Prompt & Prompt Caching](#system-prompt--prompt-caching). |
| `maxTokens` | `number` | Maximum tokens to generate. |
| `maxCompletionTokens` | `number` | Upper bound on tokens generated, including visible output and reasoning tokens. Distinct from `maxTokens`. |
| `temperature` | `number` | Sampling temperature (0.0 to 2.0). |
| `topP` | `number` | Nucleus sampling (0.0 to 1.0). |
| `topK` | `number` | Top-k sampling. |
| `n` | `number` | Number of completions to generate (1 to 10). Surfaces as multiple entries in `choices`. |
| `stop` | `string \| string[]` | Up to 4 stop sequences. |
| `presencePenalty` | `number` | Presence penalty (-2.0 to 2.0). |
| `frequencyPenalty` | `number` | Frequency penalty (-2.0 to 2.0). |
| `responseFormat` | `AiResponseFormat` | Constrains output to text, JSON, or a JSON schema. See [Structured Outputs](#structured-outputs). |
| `tools` | `Tool[]` | Tool/function definitions. See [Tool Calling](#tool-calling). |
| `toolChoice` | `'auto' \| 'any' \| 'none' \| { type: 'tool'; name: string }` | How the model selects among `tools`. |
| `logitBias` | `Record<string, number>` | Token logit biases. |
| `seed` | `number` | Random seed for reproducible outputs (beta). |
| `user` | `string` | Identifier representing your end user. |
| `timeout` | `number` | Timeout in seconds for the request. |
| `logprobs` | `boolean` | Return log probabilities of output tokens. |
| `topLogprobs` | `number` | Number of most likely tokens (0 to 5) to return at each position. |
| `safetyIdentifier` | `string` | Identifier for tracking safety-related requests. |
| `headers` | `Record<string, any>` | Headers sent with the request. |
| `extraHeaders` | `Record<string, any>` | Extra headers sent in the LLM API request. |
| `tags` | `string[]` | Custom tags for organizing completions. |
| `apiKey` | `string` | **Deprecated.** No longer used; stripped before the call. Will be removed in a future major version. |

## Multimodal Messages (Image Input)

Pass an array of content blocks instead of a plain string when you need to send images alongside text. Use a vision-capable model; check `getAvailableCompletionModels()` and your provider's docs for current support.

**By URL or data URI:**

```typescript
const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
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
const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
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
| `text` | `cacheControl?: { type: 'ephemeral' }` | Optional Anthropic cache breakpoint. Valid on any `text` block, including ones inside `messages[].content`, so you can cache mid-conversation history alongside the system prefix. See [System Prompt & Prompt Caching](#system-prompt--prompt-caching). |
| `image_url` | `image_url.url: string` | `http(s)://` URL or `data:image/<type>;base64,…` URI. |
| `image_url` | `image_url.detail?: 'low' \| 'high' \| 'auto'` | Optional vision-detail hint; respected by models that support it. |
| `image` | `image.format: 'jpeg' \| 'png' \| 'gif' \| 'webp'` | Required when sending raw bytes. |
| `image` | `image.data: string` | Base64 bytes only; do **not** include the `data:` prefix. |
| `tool_use` | `id: string`, `name: string`, `input: object` | Assistant tool invocation. Replay a prior assistant tool turn back to the model. See [Tool Calling](#tool-calling). |
| `tool_result` | `toolUseId: string`, `content: string \| AiContentBlock[]`, `isError?: boolean` | Feed tool execution output back to the model on the next turn. |

`image_url` is sent directly to OpenAI/DeepSeek-compatible providers; for Anthropic models the proxy fetches the URL and base64-encodes the bytes before forwarding. Use `image` (raw base64) when the source isn't a public URL.

## Completion Response Shape

`requestChatCompletionAsync` resolves to an `AiChatCompletionData` object shaped like an OpenAI chat completion:

```typescript
{
  id: string
  ullm_id?: string
  object: unknown
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
      reasoning_content?: string // reasoning models only (e.g. deepseek-r1); the model's thinking, separate from content
      toolCalls?: ToolUse[] // present only when the model invoked tools
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    reasoning_tokens?: number
    cache_read_tokens?: number
    cache_write_tokens?: number
  }
  cost?: {
    prompt_cost: number
    completion_cost: number
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `choices[].message.content` | `string` | The assistant's text. Read text from here, not a top-level `message`. |
| `choices[].message.reasoning_content` | `string` | Optional. Present only for reasoning models (e.g. `deepseek-r1`): the model's thinking, kept separate from the visible `content`. Absent on models that don't surface reasoning. |
| `choices[].message.toolCalls` | `ToolUse[]` | Tool invocations, present only when the model called a tool this turn. |
| `choices[].finish_reason` | `string` | Why generation stopped (e.g. `stop`, `length`, `tool_calls`). |
| `usage` | object | Token totals; `reasoning_tokens`, `cache_read_tokens`, and `cache_write_tokens` appear when applicable. |
| `cost` | object | Optional `prompt_cost` / `completion_cost` for the call. |
| `id`, `model`, `created`, `object`, `ullm_id` | `string` / `number` | Call metadata. |

## System Prompt & Prompt Caching

`system` is a structured system prompt that mirrors Anthropic's `system` shape:

- `string`: passed verbatim as the system instruction.
- `Array<AiTextContent>`: each block becomes a system text block.

It coexists with any `role: 'system'` entries in `messages`; both are concatenated.

```typescript
const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
  model: 'claude-sonnet-4-6',
  system: 'You are the dungeon master for a roguelike. Stay terse.',
  messages: [{ role: 'user', content: 'Describe the next room.' }],
})
```

{% hint style="info" %}
**Anthropic prompt caching (default).** For Anthropic models, the proxy auto-caches the system prefix: if no `cacheControl` marker is present on `system` or any message block, it attaches `cache_control: { type: 'ephemeral' }` to the last text block of the system. Sub-threshold systems (under ~1024 tokens for Sonnet/Opus, ~2048 for Haiku) are a no-op. For non-Anthropic providers, the array is flattened to a string and `cacheControl` is dropped.
{% endhint %}

To control caching yourself, set `cacheControl: { type: 'ephemeral' }` on the text content block(s) you want as cache breakpoints. The marker is valid on any `text` block: a `system` array entry, or a `text` block inside a user/assistant message in `messages[].content` (to cache a slice of mid-conversation history alongside the system prefix). Any explicit marker anywhere (on `system` or on a message block) disables the proxy's auto-cache, so your strategy is left intact. The field is ignored by non-Anthropic providers.

```typescript
system: [
  { type: 'text', text: largeStaticLore, cacheControl: { type: 'ephemeral' } },
  { type: 'text', text: sessionSpecificNote },
]
```

```typescript
// A mid-conversation breakpoint inside a message:
messages: [
  {
    role: 'user',
    content: [
      { type: 'text', text: longSharedTranscript, cacheControl: { type: 'ephemeral' } },
      { type: 'text', text: 'Now summarize the last exchange.' },
    ],
  },
]
```

## Structured Outputs

`responseFormat` constrains the model's output. The proxy enforces JSON schemas on every provider, so the same request works across OpenAI, DeepSeek, Anthropic, and Gemini.

| `type` | Behavior |
| --- | --- |
| `text` | Free-form text (default). |
| `json_object` | Model is asked to emit valid JSON. No schema enforcement. |
| `json_schema` | Model is asked to emit JSON matching `schema`. Enforced server-side: native Structured Outputs on OpenAI/DeepSeek, native `responseSchema` on Gemini, and schema-appended-to-system plus server-side validation on Anthropic. |

For `json_schema`, `strict` (default `false`) maps to OpenAI's `strict` flag and is otherwise informational.

```typescript
const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
  model: 'gpt-5.4-mini',
  messages: [{ role: 'user', content: 'Generate a loot drop.' }],
  responseFormat: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        rarity: { type: 'string', enum: ['common', 'rare', 'legendary'] },
      },
      required: ['name', 'rarity'],
    },
    strict: true,
  },
})

const loot = JSON.parse(response.choices[0].message.content)
```

{% hint style="warning" %}
On Anthropic, if the response fails schema validation the proxy retries once with the validator errors fed back to the model. If the retry also fails, the request fails with HTTP 422. When `tools` is also set, the schema applies only to the model's text content; if the model invokes a tool instead, the schema is not enforced. Omit `tools` to force schema-conforming text.
{% endhint %}

### OpenAI-native nested shape (back-compat)

Besides the flat `{ type: 'json_schema', schema, strict }` form above, `responseFormat` also accepts the nested OpenAI-native shape so you can paste an OpenAI `response_format.json_schema` block straight in. On the OpenAI path it is passed through unchanged.

```typescript
responseFormat: {
  type: 'json_schema',
  json_schema: {
    name: 'loot_drop',          // optional schema name
    description: 'A single loot item', // optional
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        rarity: { type: 'string', enum: ['common', 'rare', 'legendary'] },
      },
      required: ['name', 'rarity'],
    },
    strict: true,               // boolean | null
  },
}
```

| Nested field | Type | Notes |
| --- | --- | --- |
| `json_schema.name` | `string` (optional) | Schema name, OpenAI metadata. |
| `json_schema.description` | `string` (optional) | Schema description, OpenAI metadata. |
| `json_schema.schema` | `object` (optional) | The JSON Schema the model must match. |
| `json_schema.strict` | `boolean \| null` (optional) | Maps to OpenAI's `strict` flag. |

Use the flat form (`schema` / `strict` at the top level) for new code; the nested form exists for copy-paste compatibility with existing OpenAI request bodies.

## Tool Calling

Pass `tools` to let the model call functions you define. Each tool has a `name`, a `description`, and an `inputSchema` (JSON Schema describing its arguments). Use `toolChoice` to control selection: `'auto'`, `'any'`, `'none'`, or `{ type: 'tool', name }` to force a specific tool.

```typescript
const response = await RundotGameAPI.textGen.requestChatCompletionAsync({
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'What is the weather in the swamp zone?' }],
  tools: [
    {
      name: 'get_weather',
      description: 'Get the current weather for a game zone.',
      inputSchema: {
        type: 'object',
        properties: { zone: { type: 'string' } },
        required: ['zone'],
      },
    },
  ],
  toolChoice: 'auto',
})

const toolCalls = response.choices[0].message.toolCalls
```

Tool invocations come back on the assistant message as `choices[].message.toolCalls: ToolUse[]` (each `{ id, name, input }`). To continue the conversation, echo the assistant's tool call back as a `tool_use` content block, then supply the result as a `tool_result` block:

```typescript
const followUp = await RundotGameAPI.textGen.requestChatCompletionAsync({
  model: 'claude-sonnet-4-6',
  messages: [
    { role: 'user', content: 'What is the weather in the swamp zone?' },
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { zone: 'swamp' } },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'tool_result', toolUseId: 'call_1', content: 'Foggy, 14C' },
      ],
    },
  ],
})
```

## Streaming

`requestChatCompletionStreamAsync` is the streaming sibling of `requestChatCompletionAsync`. It returns an `AsyncIterable<AiChatCompletionStreamChunk>` consumed with `for await`. Cancel by breaking out of the loop, calling `return()` on the iterator, or aborting `options.signal`.

Each chunk is one of four variants:

| `type` | Fields | Meaning |
| --- | --- | --- |
| `delta` | `text: string` | Incremental assistant text. Concatenate `text` across all `delta` chunks to rebuild the message. |
| `reasoning` | `text: string` | Optional, reasoning models only (e.g. `deepseek-r1`). Incremental reasoning / chain-of-thought text on a distinct channel. Concatenate `text` across `reasoning` chunks (like `delta`) to rebuild the trace; content-only consumers can ignore it. |
| `tool_call_chunk` | `index: number`, `id?`, `name?`, `argumentsDelta?` | Partial tool-call metadata. Buffer by `index`; the `id` and `name` arrive once, with `argumentsDelta` fragments following. |
| `done` | `finishReason: string`, `usage` | Terminal chunk. Carries the stop reason and aggregate token totals (same shape as the non-streaming `usage`). Always last. |

Errors are out of band: the iterable throws.

```typescript
const stream = RundotGameAPI.textGen.requestChatCompletionStreamAsync({
  model: 'gpt-5.4-mini',
  messages: [{ role: 'user', content: 'Narrate the battle.' }],
})

let text = ''
for await (const chunk of stream) {
  if (chunk.type === 'delta') text += chunk.text
  if (chunk.type === 'done') console.log('usage', chunk.usage)
}
```

To abort mid-stream, pass an `AbortSignal` via the second argument:

```typescript
const controller = new AbortController()
const stream = RundotGameAPI.textGen.requestChatCompletionStreamAsync(
  { model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Long story...' }] },
  { signal: controller.signal },
)
// controller.abort() stops yielding and closes the upstream socket
```

{% hint style="warning" %}
Gemini streaming supports text but not tool use. The iterable throws `AppError(400)` when `tools` is non-empty on a Gemini model.
{% endhint %}

## Templated Prompts

Some games run in **templated** textGen mode: instead of the game authoring `model`, `system`, and `messages` in code, the game's creator declares prompts server-side (in `rundot/textGen.config.json`) and the game invokes them by id. The server owns the model choice and the full prompt text; your game contributes only the player's turn.

Use `requestPromptCompletionAsync` (or its streaming sibling) with a `PromptCompletionRequest`:

| Field | Type | Description |
| --- | --- | --- |
| `promptId` | `string` | Id of a server-authored prompt declared in the game's `rundot/textGen.config.json`. |
| `input` | `string` (optional) | The player's turn. It is isolation-wrapped server-side before reaching the model. Text-only in v1. |

```typescript
const response = await RundotGameAPI.textGen.requestPromptCompletionAsync({
  promptId: 'npc-banter',
  input: 'What do you think of the swamp zone?',
})
console.log(response.choices[0].message.content)
```

Streaming works exactly like [Streaming](#streaming) — same chunk types, same cancellation:

```typescript
const stream = RundotGameAPI.textGen.requestPromptCompletionStreamAsync({
  promptId: 'npc-banter',
  input: 'Tell me a story.',
})

let text = ''
for await (const chunk of stream) {
  if (chunk.type === 'delta') text += chunk.text
  if (chunk.type === 'done') console.log('usage', chunk.usage)
}
```

Notes:

- **No client-supplied variables.** `{{var}}` slots in a server-authored prompt resolve entirely server-side from a trusted value bag — the call carries no variables. Client-named variables (e.g. a player-chosen quiz topic) are deferred to a future version; in v1, user content reaches the model only through `input`.
- **`input` is text-only in v1.** Sending a non-string `input` fails with HTTP 400; multimodal templated input is deferred.
- **Open-mode calls are rejected on templated games.** Against a templated game, `requestChatCompletionAsync` (and its streaming sibling) fails with HTTP 403 and error code `AI_POLICY_DENIED`. The error surfaces to your game as a thrown `Error` whose message is the code string.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `textGen.requestChatCompletionAsync(request)` | `Promise<AiChatCompletionData>` | Generate a text completion. Read the text at `choices[0].message.content`; see [Completion Response Shape](#completion-response-shape). |
| `textGen.requestChatCompletionStreamAsync(request, options?)` | `AsyncIterable<AiChatCompletionStreamChunk>` | Stream a completion chunk by chunk via `for await`. See [Streaming](#streaming). |
| `textGen.requestPromptCompletionAsync(request)` | `Promise<AiChatCompletionData>` | Invoke a server-authored prompt by id (templated mode). See [Templated Prompts](#templated-prompts). |
| `textGen.requestPromptCompletionStreamAsync(request, options?)` | `AsyncIterable<AiChatCompletionStreamChunk>` | Streaming sibling of `requestPromptCompletionAsync`. See [Templated Prompts](#templated-prompts). |
| `textGen.getAvailableCompletionModels()` | `Promise<string[]>` | List available models. |

## Best Practices

- Provide concise prompts; include relevant game context to reduce token usage.
- Gracefully degrade when the API is unreachable; AI should add to, not block, core gameplay.
- Respect content policies: filter user input and sanitize AI responses before showing them in-game.
- Cache model selection in your state so you can update prompts on the fly.

## Limits

- `textGen.requestChatCompletionAsync`, `textGen.requestChatCompletionStreamAsync`, `textGen.requestPromptCompletionAsync`, and `textGen.requestPromptCompletionStreamAsync` are subject to per-creator rate-limit tiers; see [Rate Limits](RATE_LIMITS.md).
