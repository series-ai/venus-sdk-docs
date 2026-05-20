# Rate Limits

RUN.game API calls are rate-limited per authenticated user (or per IP for unauthenticated traffic) to protect platform stability. **Most endpoints comfortably support around 60 requests per minute per user.** When you exceed a limit, the server returns HTTP `429 Too Many Requests`.

A few categories are stricter:

- AI completion (`ai.complete`), image generation (`imageGen.generate`), and sprite generation (`spriteGen.generate`, `spriteGen.animate`) — gated separately and may refuse at lower rates. Design these calls assuming they can fail, and keep your game playable when they do.
- Sensitive write operations (e.g. creating comments or accounts) — much tighter caps to prevent abuse.

Build for graceful degradation rather than aiming for exact throughput.

## Handling 429

The SDK surfaces backend failures as a plain `Error`; the HTTP status appears in the message string (e.g. `AI completion failed (429)`). Match on the status to detect rate-limit responses:

```typescript
try {
  const result = await RundotGameAPI.ai.complete({ prompt })
} catch (err) {
  if (err instanceof Error && /\(429\)/.test(err.message)) {
    // back off and retry, or fall back to a non-AI path
  }
}
```

## Best practices

- On `429`, back off exponentially before retrying.
- If the response includes a `Retry-After` header, respect it.
- Do not retry tighter than once per second.
- For AI completion and image generation, build a non-AI fallback path — don't gate gameplay on these calls succeeding.
