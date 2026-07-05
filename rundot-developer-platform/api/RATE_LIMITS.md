# Rate Limits

RUN.game API calls are rate-limited per authenticated user (or per IP for unauthenticated traffic) to protect platform stability. When you exceed a limit, the server returns HTTP `429 Too Many Requests`. Exact limits aren't published and may change; build for graceful degradation rather than a fixed throughput.

A few categories are stricter:

- Text generation (`textGen.requestChatCompletionAsync`) and image generation (`imageGen.generate`) are gated separately and may refuse at lower rates. Design these calls assuming they can fail, and keep your game playable when they do.
- Sensitive write operations (e.g. creating comments or accounts) have much tighter caps to prevent abuse.

Build for graceful degradation rather than aiming for exact throughput.

## How errors arrive

Structured SDK failures are `RundotApiError` instances. Each one carries:

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Machine-readable error code (e.g. `RATE_LIMITED`, `UNKNOWN`). Switch on this instead of parsing the message. |
| `status` | `number` | HTTP status when the error came over HTTP. `0` for transport/RPC errors that have no HTTP status. |
| `detail` | `string \| undefined` | Optional human-readable cause from the server (e.g. an upstream provider's validation message). |

Rate limits surface as `RateLimitedError`, a subclass of `RundotApiError`:

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Always `'RATE_LIMITED'`. |
| `status` | `number` | `429` on the HTTP-backed paths; `0` over the host RPC bridge (see below). |
| `retryAfterMs` | `number` | Server-suggested backoff in milliseconds. Read this to size your retry delay. |
| `message` | `string` | Defaults to `Rate limited. Retry after Ns.` when the server omits a custom message. |

{% hint style="warning" %}
**The HTTP status is not reliable for detection.** Some calls travel over the host RPC bridge rather than plain HTTP; those errors are constructed with `status: 0` regardless of the underlying HTTP status, so matching `429` in the status field (or in the message string) will miss real rate limits. Detect by `code` instead. `retryAfterMs` is populated on HTTP-backed paths but may be absent over the RPC bridge — fall back to exponential backoff when it's missing. Across every transport, `code === 'RATE_LIMITED'` is the reliable signal.
{% endhint %}

{% hint style="info" %}
`RundotApiError` and `RateLimitedError` are not exported from the main package barrel or from the `@series-inc/rundot-game-sdk/api` entrypoint. Rather than relying on `instanceof`, detect rate limits by duck-typing: check `err.code === 'RATE_LIMITED'` (or `err.name === 'RateLimitedError'`). Both signals are reliable across every transport.
{% endhint %}

## Handling 429

Detect a rate limit by checking the error `code`, then back off using `retryAfterMs` when it's present:

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

try {
  const result = await RundotGameAPI.textGen.requestChatCompletionAsync({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'user', content: prompt }],
  })
} catch (err) {
  const apiErr = err as { code?: string; name?: string; retryAfterMs?: number }
  if (apiErr.code === 'RATE_LIMITED' || apiErr.name === 'RateLimitedError') {
    const waitMs = apiErr.retryAfterMs ?? 1000
    // back off for waitMs, then retry, or fall back to a non-AI path
  }
}
```

## Best practices

- On a `RATE_LIMITED` error, back off before retrying.
- Read `RateLimitedError.retryAfterMs` (milliseconds) off the caught error to size your backoff. The SDK consumes the HTTP `Retry-After` header internally; game code never sees raw HTTP headers, so size the wait from `retryAfterMs` instead. When it's absent (e.g. an RPC-path error), fall back to exponential backoff.
- Do not retry tighter than once per second.
- For text generation and image generation, build a non-AI fallback path. Don't gate gameplay on these calls succeeding.
