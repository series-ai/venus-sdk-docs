# LiveOps Config API

Change live values in a deployed game — flip an event flag, tune a multiplier, schedule a weekend boost — without shipping a new build. LiveOps config is a small bundle of key/value pairs your game reads at runtime, with optional time-windowed overrides that turn on and off on a schedule.

***

## What LiveOps Config is

Games often need PlayFab-Title-Data-style remote values: a banner you can switch on for an event, a reward multiplier you can bump for a weekend, a feature you can dark-launch. LiveOps gives you exactly that: a file of client-visible values you push separately from your build, plus scheduled overrides evaluated at read time.

- Values are **non-secret display config** — a cheating client could already fake them. Do **not** put anything security-sensitive (economy multipliers the server must trust, drop tables) in the `client` section. The `server` section is reserved for that and is never sent to game code in v1.
- Reads are **cheap and cached**. Call `getConfigAsync()` at natural boundaries (screen load, round start); you do not need a timer — `nextChangeAt` tells you when a re-call would observe the next scheduled flip.

***

## `rundot/liveops.config.json`

Place your LiveOps config at `rundot/liveops.config.json`. The file contains the configuration **directly** (no wrapping key):

```json
{
  "client": {
    "values": { "eventBannerVisible": false, "dailyRewardMultiplier": 1 },
    "overrides": [
      {
        "id": "summer-event",
        "activeAt": "2026-07-10T00:00:00Z",
        "expiresAt": "2026-07-20T00:00:00Z",
        "values": { "eventBannerVisible": true, "dailyRewardMultiplier": 2 }
      }
    ]
  },
  "server": {
    "values": {},
    "overrides": []
  }
}
```

- Only `client` and `server` top-level keys are allowed; both are optional. Unknown keys are a validation error.
- Each section has an optional `values` (object) and optional `overrides` (array).
- An override needs a non-empty `id` (unique within its section) and a `values` object. `activeAt`/`expiresAt` are optional and must be **full ISO 8601 date-time strings with a timezone** — e.g. `2026-07-10T00:00:00Z` or `2026-07-10T00:00:00.5+02:00`. Date-only strings like `"2026-07-10"` are **rejected** (JS and C# disagree on their timezone, which would desync the CLI preview from server resolution). When both are present, `activeAt` must be strictly before `expiresAt`.
- No directly-nested arrays anywhere inside `values` (a Firestore limitation).
- The `server` section is stored and validated but **never** returned to game code — reserved for server-side consumption in a future release. Don't rely on reading it from the client.

> Commit `rundot/` to your repo; it's project config, not a build artifact, and it's env-agnostic.

***

## Resolution semantics

The config your game receives is **resolved**: the base `values`, with every currently-active override shallow-merged on top.

1. Start from `client.values`.
2. For each override whose window contains "now", in array order, shallow-merge its `values` over the result (top-level keys only; **later overrides win**).
3. An override is active when `activeAt <= now < expiresAt`. A missing `activeAt` means "always started"; a missing `expiresAt` means "never ends". `expiresAt` is **exclusive** — the moment `now` reaches it, the override turns off.

Resolution happens **client-side** against a **server-anchored clock** — the SDK anchors absolute time to the server's clock at fetch and advances it with the local clock, so a skewed device clock never shifts a scheduled flip. Because of this, **scheduled on/off is immediate**: the instant a window opens or closes, the next `getConfigAsync()` reflects it, even if the underlying rules are still cached.

***

## Reading config: `RundotGameAPI.liveops`

Two always-asynchronous methods. Both share one cache and one resolver.

### `getConfigAsync(options?)` — the default

Returns the **resolved** config. This is the foot-gun-free path most games should use.

```typescript
const config = await RundotGameAPI.liveops.getConfigAsync()

if (config.values.eventBannerVisible) {
  showEventBanner()
}
const multiplier = (config.values.dailyRewardMultiplier as number) ?? 1
```

The result type:

```typescript
import type { LiveOpsConfigResult } from '@series-inc/rundot-game-sdk'

// {
//   values: Record<string, unknown>   // base + currently-active overrides
//   activeOverrideIds: string[]       // ids of overrides active right now
//   configVersion: string             // snapshot id the rules came from; quote in bug reports
//   nextChangeAt: number | null       // epoch-ms of the next scheduled flip, or null
// }
```

Use `nextChangeAt` to avoid polling — schedule a single re-read at that timestamp instead of checking every frame.

### `getRawConfigAsync(options?)` — advanced escape hatch

Returns the **unresolved** rules plus the server clock, so you can inspect the schedule or resolve on your own terms.

```typescript
import type { LiveOpsRawConfig, LiveOpsOverride } from '@series-inc/rundot-game-sdk'

const raw: LiveOpsRawConfig = await RundotGameAPI.liveops.getRawConfigAsync()
// {
//   values: Record<string, unknown>
//   overrides: LiveOpsOverride[]
//   configVersion: string
//   serverTimeMs: number   // authoritative server clock at fetch
// }
const upcoming: LiveOpsOverride[] = raw.overrides
```

### `maxAgeMs` and propagation latency

Both methods accept `{ maxAgeMs?: number }` (default `60_000`; `0` forces a network fetch). `maxAgeMs` governs how fresh the underlying **rules** are — i.e. **how fast a *push* propagates** — not schedule correctness.

- **Scheduled on/off is always immediate** — `getConfigAsync()` re-resolves on every call against the server-anchored clock, so a long `maxAgeMs` can never mask a scheduled flip.
- **A push takes up to ~2 minutes** to reach all players (a 60s server cache + a 60s client rule cache). This is documented, not a bug — plan pushes accordingly.

***

## Playground iteration

You can iterate on LiveOps values live in the playground with no CLI deploy:

1. Run the playground (`npm run dev` in your game project) and sign in.
2. Call `RundotGameAPI.liveops.getConfigAsync()` from your game.
3. Edit `rundot/liveops.config.json`.
4. The playground's HMR re-uploads the config, repoints the `private` tag, and clears the SDK's rule cache.
5. Reload; the next `getConfigAsync()` returns your new values.

For pushing to a deployed game and managing history/rollback, see the `rundot liveops` commands in the [CLI reference](../cli-reference.md).
