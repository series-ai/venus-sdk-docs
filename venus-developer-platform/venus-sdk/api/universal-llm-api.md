# Universal LLM API

## Universal LLM API

Call the Venus Universal LLM API to run hosted LLM models for chat, hints, or narrative beats without managing your own inference stack. The API supports multiple models and exposes simple request/response helpers.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const response = await VenusAPI.ai.requestChatCompletionAsync({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Give me a tip for this puzzle.' },
  ],
})

console.log(response.message)
```

### Model Management

*   List available models dynamically:

    ```typescript
    const models = await VenusAPI.ai.getAvailableCompletionModels()
    ```
* Commonly available production models:
  * `gpt-4o`
  * `gpt-4o-mini`
  * `claude-3-5-sonnet-latest`
  * `deepseek/deepseek-chat`
* Cache the selection in your state so you can update prompts on the fly.

### Best Practices

* Provide concise prompts; include relevant game context to reduce token usage.
* Gracefully degrade when the API is unreachable—AI should enhance, not block, core gameplay.
* Respect content policies: filter user input and sanitise AI responses before showing them in-game.
