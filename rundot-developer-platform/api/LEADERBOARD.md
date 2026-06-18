# Leaderboards API

Competitive leaderboards with three security levels. Choose based on your game's requirements.

***

## Setup

Leaderboard behavior is driven by your project's server config, uploaded when you `rundot deploy`. The server reads it to determine security mode, score bounds, time periods, and anti-cheat rules. If you omit leaderboard config entirely, leaderboards still work with sensible defaults (simple mode, no tokens, alltime + daily periods).

### `.rundot/leaderboard.config.json`

Place your leaderboard config at `.rundot/leaderboard.config.json`. The file contains the leaderboard configuration **directly** (no wrapping key):

```
my-game/
├── .rundot/
│   └── leaderboard.config.json      ← leaderboard config
├── src/
├── dist/
├── game.config.prod.json            ← game ID + build settings only (separate file)
└── package.json
```

```json
{
  "requiresToken": false
}
```

> Commit `.rundot/` to your repo; it's project config, not a build artifact, and it's env-agnostic. `game.config.prod.json` is a separate file for local CLI metadata (`gameId`, `relativePathToDistFolder`); leaderboard config does not go there.

***

## 🟢 Simple Mode (Default - Casual Games)

Submit scores directly without tokens:

```typescript
// One call - no token needed!
const result = await RundotGameAPI.leaderboard.submitScore({
  score: 1500,
  duration: 120,
  metadata: {
    levelCompleted: 10,
    powerUpsUsed: 3
  }
})

// Always branch on `accepted` before reading rank.
if (result.accepted) {
  console.log(`Your rank: ${result.rank}`)
} else {
  console.log(`Score not recorded: ${result.reason}`)
}
```

`submitScore` resolves to a `SubmitScoreResult`. The only always-present field is `accepted`; `rank` is meaningful only when `accepted` is `true`. A rejected submission (for example a keep-best leaderboard where the new score is lower than your existing best) returns `accepted: false` with a `reason` you can surface to the player.

| Field | Type | Description |
| --- | --- | --- |
| `accepted` | `boolean` | Always present. `true` when the score was recorded; `false` when rejected. Branch on this before using `rank`. |
| `rank` | `number \| null` | Player's rank after this submission. `null` or absent when not accepted. |
| `reason` | `string \| null` | Human-readable explanation when `accepted` is `false` (for example a keep-best rejection). |
| `zScore` | `number \| null` | Anti-cheat z-score for the submission. Populated when z-score detection is enabled. |
| `isAnomaly` | `boolean` | `true` when the submission was flagged as a statistical anomaly by z-score detection. |

**Submission parameters (`SubmitScoreParams`):**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `score` | `number` | Yes | The score to record. |
| `duration` | `number` | Yes | Run length in seconds (validated against duration bounds). |
| `token` | `string` | No | Score token from `createScoreToken()`. Required in token/sealing mode. |
| `mode` | `string` | No | Target game mode (override the resolved default). |
| `period` | `string` | No | Target time period (override the resolved default). |
| `metadata` | `Record<string, any>` | No | Game-supplied data stored with the entry and returned on `LeaderboardEntry.metadata` (for example level completed, power-ups used). |
| `telemetry` | `Record<string, any>` | No | Separate diagnostic/anti-cheat payload forwarded to the backend with the submission. Unlike `metadata`, it is not surfaced on leaderboard entries. |

{% hint style="info" %}
`hash` is also part of `SubmitScoreParams`, but you never set it: the SDK auto-computes it for sealed leaderboards. See Score Sealing Mode below.
{% endhint %}

**Configuration:**

```json
{
  "leaderboard": {
    "requiresToken": false
  }
}
```

Or just rely on defaults - server auto-resolves mode/period from config!

**Security provided:**

* ✅ Score/duration bounds validation
* ✅ Rate limiting (60 second cooldown per player)
* ✅ Trust scores & shadow banning for repeat offenders
* ❌ No session replay protection
* ❌ No tamper protection

**Best for:** Simple integration

***

## 🟡 Token Mode (Competitive Games)

Add session validation for replay protection:

```typescript
// Step 1: Create score token (optional `mode` arg for multi-mode games)
const scoreToken = await RundotGameAPI.leaderboard.createScoreToken()
// Returns: { token, startTime, expiresAt, sealingNonce?, sealingSecret?, mode }

// Step 2: Play game...

// Step 3: Submit with token
const result = await RundotGameAPI.leaderboard.submitScore({
  token: scoreToken.token,
  score: 1500,
  duration: 120
})
```

{% hint style="warning" %}
A token is cached client-side when you create it and deleted as soon as you submit, so each token can be submitted exactly once. Passing a `token` that was not created via `createScoreToken()` in the same session throws `Invalid token: not found in cache. Did you call createScoreToken() first?`. Always call `createScoreToken()` immediately before each scored run.
{% endhint %}

**`createScoreToken(mode?): Promise<ScoreToken>`** returns:

| Field | Type | Description |
| --- | --- | --- |
| `token` | `string` | Opaque token to pass to `submitScore`. |
| `startTime` | `number` | Token creation timestamp (ms). |
| `expiresAt` | `number` | Expiry timestamp (ms); tokens expire one hour after creation. |
| `mode` | `string` | The game mode the token is locked to. |
| `sealingNonce` | `string \| null` | Present only with score sealing enabled; used by the SDK to compute the hash. |
| `sealingSecret` | `string \| null` | Present only with score sealing enabled; used by the SDK to compute the hash. |

**Configuration:**

```json
{
  "leaderboard": {
    "requiresToken": true
  }
}
```

**Additional security:**

* ✅ All simple mode security
* ✅ Session validation (tokens expire in 1 hour)
* ✅ Replay attack prevention (one-time use)
* ✅ Mode locking (token locks game mode)
* ❌ No tamper protection

**Best for:** Preventing replay attacks

***

## 🔴 Score Sealing Mode (High-Stakes Games)

Add cryptographic tamper protection:

```typescript
// Step 1: Create score token (sealing data included automatically if enabled)
const scoreToken = await RundotGameAPI.leaderboard.createScoreToken()
// Returns: { token, sealingNonce, sealingSecret, ... }

// Step 2: Play game...

// Step 3: Submit score - SDK auto-computes hash internally!
const result = await RundotGameAPI.leaderboard.submitScore({
  token: scoreToken.token,
  score: 1500,
  duration: 120
})
```

**Configuration:**

```json
{
  "leaderboard": {
    "requiresToken": true,
    "enableScoreSealing": true,
    "scoreSealingSecret": "your-secret-key-change-in-production"
  }
}
```

**Note:** Hash computation is handled internally by the SDK using Web Crypto API (HMAC-SHA256). Games never need to implement cryptographic hashing manually. The hash always includes: `score`, `duration`, `token`, and a per-submission sealing nonce.

**Maximum security:**

* ✅ All token mode security
* ✅ Tamper-proof scores (HMAC-SHA256 verification)
* ✅ Client-side cheat detection
* ✅ Automatic hash computation (no crypto code needed in games)

**Best for:** Reduced hacking

***

## Score Ordering

By default, leaderboards rank higher scores first (best for points-based games). For time trials, golf, or any game where lower is better, set `scoreOrder` to `"lowest"`:

```json
{
  "leaderboard": {
    "scoreOrder": "lowest"
  }
}
```

| Value | Ranking | Example use cases |
| --- | --- | --- |
| `"highest"` (default) | Higher scores rank better | Points, combos, distance |
| `"lowest"` | Lower scores rank better | Speed runs, time trials, golf |

This is purely a server-side config option; the SDK calls (`submitScore`, `getPagedScores`, etc.) work identically regardless of ordering.

***

## Query Methods (Same for All Modes)

All query methods work identically regardless of security mode:

```typescript
// Get paginated scores (pass a previous page's cursor to load the next page)
const pagedScores = await RundotGameAPI.leaderboard.getPagedScores({
  limit: 50,
  cursor: previousCursor // string | null | undefined for the first page
})
for (const entry of pagedScores.entries) {
  console.log(`#${entry.rank} ${entry.username}: ${entry.score}`)
}
const nextCursor = pagedScores.nextCursor // feed back in as `cursor` for the next page

// Get podium + player context
const podiumScores = await RundotGameAPI.leaderboard.getPodiumScores({
  topCount: 3,
  contextAhead: 4,
  contextBehind: 2
})

// Get my rank (resolves to a PlayerRankResult, not a bare number)
const rankResult = await RundotGameAPI.leaderboard.getMyRank()
if (rankResult.rank !== null) {
  console.log(`Rank ${rankResult.rank} of ${rankResult.totalPlayers}`)
}
```

**Note:** Mode and period are automatically resolved from your config. For games with single mode/period, no need to specify them!

### `getPagedScores(options?): Promise<PagedScoresResponse>`

Returns a page of leaderboard entries plus pagination state. Pass `cursor` (from the previous page's `nextCursor`) to walk through large leaderboards.

**Options (`GetPagedScoresOptions`):**

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mode` | `string` | No | resolved single/default mode | Game mode to query. |
| `period` | `string` | No | resolved single/default period | Time period to query (for example `daily`, `alltime`). |
| `periodDate` | `number \| string` | No | current period | Target a specific period instance (timestamp or date) instead of the active one. |
| `cursor` | `string \| null` | No | - | Opaque cursor from a previous page's `nextCursor`. |
| `limit` | `number` | No | server default | Max entries per page. |
| `variant` | `'standard' \| 'highlight'` | No | `'standard'` | Result shape. `'highlight'` is used by `getPodiumScores`. |
| `topCount` | `number` | No | - | (Highlight) number of top entries to include. |
| `contextAhead` | `number` | No | - | (Highlight) entries to include above the player. |
| `contextBehind` | `number` | No | - | (Highlight) entries to include below the player. |

**Returns (`PagedScoresResponse`):**

| Field | Type | Description |
| --- | --- | --- |
| `variant` | `'standard' \| 'highlight'` | Which response shape was produced. |
| `entries` | `LeaderboardEntry[]` | The page of entries (see `LeaderboardEntry` below). |
| `totalEntries` | `number` | Total entries in the leaderboard for this mode/period. |
| `nextCursor` | `string \| null` | Cursor for the next page, or `null`/absent when there are no more pages. |
| `playerRank` | `number \| null` | The calling player's rank, or `null` when they have no entry. |
| `periodInstance` | `string` | Identifier of the resolved period instance. |

### `getMyRank(options?): Promise<PlayerRankResult>`

Resolves to a `PlayerRankResult` object (not a bare number). `rank` is `null` when the player has no entry in the period.

**Options (`PlayerRankOptions`):** `mode?`, `period?`, `periodDate?` (same meaning as in `getPagedScores`).

**Returns (`PlayerRankResult`):**

| Field | Type | Description |
| --- | --- | --- |
| `rank` | `number \| null` | Player's rank, or `null` when they have no entry in the period. |
| `score` | `number` | Player's best score for this mode/period (absent when no entry). |
| `totalPlayers` | `number` | Total ranked players in the leaderboard. |
| `percentile` | `number` | Player's percentile placement (absent when no entry). |
| `trustScore` | `number` | Anti-cheat trust score for the player. |
| `periodInstance` | `string` | Identifier of the resolved period instance. |

### `getPodiumScores(options?): Promise<PodiumScoresResponse>`

A highlight-variant query that returns everything `getPagedScores` returns plus a `context` object that splits the entries into the podium, the run-up to the player, the player, and the entries just behind. The `topCount`, `contextAhead`, and `contextBehind` options drive how many of each are included.

**Returns:** a `PagedScoresResponse` (above) with `variant: 'highlight'` plus a `context` field (`PodiumScoresContext`):

| Field | Type | Description |
| --- | --- | --- |
| `topEntries` | `LeaderboardEntry[]` | The top entries (driven by `topCount`). |
| `beforePlayer` | `LeaderboardEntry[]` | Entries immediately above the player (driven by `contextAhead`). |
| `playerEntry` | `LeaderboardEntry \| null` | The calling player's own entry, or `null` when they have none. |
| `afterPlayer` | `LeaderboardEntry[]` | Entries immediately below the player (driven by `contextBehind`). |
| `totalBefore` | `number` | Total entries ahead of the player. |
| `totalAfter` | `number` | Total entries behind the player. |
| `omittedBefore` | `number` | Entries above the player not included in `beforePlayer`. |
| `omittedAfter` | `number` | Entries below the player not included in `afterPlayer`. |

### `LeaderboardEntry`

Each row returned by the query methods.

| Field | Type | Description |
| --- | --- | --- |
| `profileId` | `string` | Player profile identifier. |
| `username` | `string` | Display name to render. |
| `avatarUrl` | `string \| null` | Avatar image URL, or `null`. |
| `score` | `number` | Submitted score. |
| `duration` | `number` | Submitted duration in seconds. |
| `submittedAt` | `number` | Submission timestamp (ms). |
| `rank` | `number \| null` | Entry's rank in the period. |
| `metadata` | `Record<string, any> \| null` | Game-supplied metadata from the submission. |
| `isSeed` | `boolean` | `true` for seed (NPC) entries from `seedEntries`. |
| `trustScore` | `number \| null` | Anti-cheat trust score. |
| `isShadowBanned` | `boolean` | `true` when the entry belongs to a shadow-banned player. |
| `expiresAt` | `number \| null` | Expiry timestamp for time-period entries. |
| `zScore` | `number \| null` | Anti-cheat z-score, when detection is enabled. |
| `isAnomaly` | `boolean` | `true` when flagged as a statistical anomaly. |
| `token` | `string` | Submission token, when present. |

***

## Advanced: Multiple Modes or Periods

**For games with multiple leaderboards:**

Config with multiple modes:

```json
{
  "leaderboard": {
    "modes": {
      "casual": { "displayName": "Casual" },
      "competitive": { "displayName": "Competitive" }
    }
  }
}
```

Explicitly specify mode in submissions/queries:

```typescript
// Submit to specific mode
await RundotGameAPI.leaderboard.submitScore({
  score: 1500,
  duration: 120,
  mode: 'competitive'  // Override default
})

// Query specific mode
const scores = await RundotGameAPI.leaderboard.getPodiumScores({
  mode: 'competitive',
  topCount: 10
})
```

In token or score-sealing mode, a token locks the game mode. Create the token for the target mode by passing it to `createScoreToken`:

```typescript
// Lock the token to the competitive board
const scoreToken = await RundotGameAPI.leaderboard.createScoreToken('competitive')

await RundotGameAPI.leaderboard.submitScore({
  token: scoreToken.token,
  score: 1500,
  duration: 120
})
```

`createScoreToken(mode?: string)` defaults to the resolved single/default mode when `mode` is omitted.

Same pattern for periods:

```typescript
// Query specific time period
const dailyScores = await RundotGameAPI.leaderboard.getPagedScores({
  period: 'daily',
  limit: 50
})
```

### Period types

Each entry in `periods` carries a `type` that controls how the leaderboard resets. The `type` must be one of these four values (the exported `LeaderboardPeriodType`):

| `type` | Resets | Notes |
| --- | --- | --- |
| `"alltime"` | Never | Permanent board; entries persist indefinitely. |
| `"daily"` | Every UTC day | Rolls over at UTC midnight. |
| `"weekly"` | Every UTC week | Rolls over at the start of the UTC week. |
| `"monthly"` | Every UTC month | Rolls over at the start of the UTC month. |

All four are first-class; `weekly` and `monthly` work exactly like `daily` and `alltime`. The `key` you give each period (for example `daily`, `weekly`) is the string you pass as `period` in `submitScore` / query options; the `type` is what drives the reset cadence. Reset boundaries are UTC-based so all players globally share the same period instance.

***

## Configuration Reference

**Minimal Config (Casual Games):**

```json
{
  "leaderboard": {
    "requiresToken": false
  }
}
```

Uses defaults:

* Mode: `"default"`
* Periods: `"alltime"` and `"daily"`
* Score ordering: highest first
* Rate limiting: 60s between submissions

***

**Full Config (Advanced Games):**

```json
{
  "leaderboard": {
    // Security (progressive levels)
    "requiresToken": false,           // Simple mode (default)
    "enableScoreSealing": false,      // Requires requiresToken=true
    "scoreSealingSecret": "secret",   // Required if enableScoreSealing=true
    
    // Score ordering
    "scoreOrder": "highest",          // "highest" (default) or "lowest" (for time trials, golf, etc.)
    
    // Score bounds
    "minScore": 0,
    "maxScore": 999999999,
    "minDurationSec": 10,
    "maxDurationSec": 3600,
    
    // Game modes (optional - omit for single default mode)
    "modes": {
      "default": { "displayName": "Normal" },
      "hard": { "displayName": "Hard Mode" }
    },
    
    // Time periods (optional - omit for alltime + daily default)
    // `type` must be one of: "daily" | "weekly" | "monthly" | "alltime"
    "periods": {
      "alltime": { "displayName": "All Time", "type": "alltime" },
      "daily": { "displayName": "Daily", "type": "daily" },
      "weekly": { "displayName": "Weekly", "type": "weekly" },
      "monthly": { "displayName": "Monthly", "type": "monthly" }
    },
    
    // Anti-cheat
    "antiCheat": {
      "enableRateLimit": true,
      "minTimeBetweenSubmissionsSec": 60,
      "trustScoreDecayPerFlag": 10,
      "shadowBanThreshold": 20,
      "enableZScoreDetection": false,
      "zScoreThreshold": 3
    },
    
    // Display
    "displaySettings": {
      "maxEntriesPerPage": 50
    },
    
    // Seed data (optional)
    "seedEntries": {
      "default": {
        "alltime": [
          {
            "score": 18500,
            "username": "ProPlayer",
            "duration": 180
          }
        ]
      }
    }
  }
}
```

> **Heads up for idle, incremental, and big-number games.** The default `maxScore` is `999999999` (about 10⁹). A score above `maxScore` is rejected with a validation error (the `submitScore` call throws); it is not clamped down. Exponential economies pass 10⁹ within a few prestige loops, so set `maxScore` to at least `9007199254740991` (`Number.MAX_SAFE_INTEGER`), or submit a compressed value such as `Math.floor(Math.log10(score) * 1e6)`. See the [BigNumbers API](BIGNUMBERS.md).

***

**Smart Defaults:**

* If you configure only ONE mode/period, it's auto-selected (no need to specify in SDK calls)
* If you configure MULTIPLE modes: defaults to `"default"` mode if present, otherwise first configured
* If you configure MULTIPLE periods: defaults to `"alltime"` > `"daily"` > others (prefers permanent leaderboards)

***

## Best Practices

* Configure score bounds, durations, and anti-cheat settings in `.rundot/leaderboard.config.json`.
* **Debounce your submits.** There is a 60-second rate limit per player (`minTimeBetweenSubmissionsSec`). Submitting on every frame, tick, or score change gets most submits rejected. Submit at most once per minute, and only when the value meaningfully changes. The board is keep-best, so a lower resubmit returns `accepted: false` and is a harmless no-op. Don't retry a rejected submit right away; it is still inside the cooldown.
* **Size `maxScore` to your economy.** The default ceiling is about 10⁹. Idle and incremental games exceed it quickly: raise `maxScore` (up to `Number.MAX_SAFE_INTEGER`) or submit a log-compressed score. See [BigNumbers](BIGNUMBERS.md).
* Use token or score-sealing modes for competitive or high-value rewards.
* Log submissions and responses for customer support audits.
* Seed leaderboards with NPC entries via `seedEntries` to avoid empty boards on launch.
* UTC-based daily/weekly/monthly periods ensure global fairness; show countdowns using the Time API.

***

## Leaderboard Moderation (CLI)

Beyond the runtime SDK above, the `rundot` CLI ships owner/creator moderation commands for inspecting and policing live leaderboard data — view scores, look up players, remove or reset entries, and shadow-ban cheaters.

{% hint style="warning" %}
These are owner-only moderation commands that act on live leaderboard data. Authenticate first with `rundot login`. Every command accepts `--game-id <id>`; when omitted it falls back to the `game.config.*.json` in the current directory.
{% endhint %}

### rundot leaderboard config

Show the leaderboard config and all instance IDs for a game. Run this first to discover the leaderboard IDs the other commands need.

```bash
rundot leaderboard config [--date <iso-date>] [--save <path>] [--game-id <id>]
```

* `--date <iso-date>` (optional) — ISO date for historical period instances, e.g. `2026-05-10`. Defaults to today.
* `--save <path>` (optional) — save the output to a JSON file at the given path.

### rundot leaderboard scores

List the top scores for a leaderboard.

```bash
rundot leaderboard scores <leaderboard-id> [--include-shadow-banned] [--limit <n>] [--save <path>]
```

* `leaderboard-id` (required) — the leaderboard instance ID; use `config` to discover IDs.
* `--include-shadow-banned` (flag) — also show shadow-banned entries.
* `--limit <n>` (optional) — max entries to display. Default `50`.
* `--save <path>` (optional) — save the output to a JSON file.

### rundot leaderboard player

View a single player's score and trust state for a leaderboard (outputs JSON).

```bash
rundot leaderboard player <leaderboard-id> <profile-id> [--save <path>]
```

* `leaderboard-id` (required) — the leaderboard instance ID.
* `profile-id` (required) — the player's profile ID.
* `--save <path>` (optional) — save the output to a JSON file.

### rundot leaderboard stats

Summary stats for a leaderboard: public players, shadow-banned count, seeds, score range, and last submission.

```bash
rundot leaderboard stats <leaderboard-id> [--save <path>]
```

* `leaderboard-id` (required) — the leaderboard instance ID.
* `--save <path>` (optional) — save the output to a JSON file.

### rundot leaderboard remove

Remove a single player's score from a leaderboard.

```bash
rundot leaderboard remove <leaderboard-id> <profile-id>
```

* `leaderboard-id` (required) — the leaderboard instance ID.
* `profile-id` (required) — the player's profile ID.

### rundot leaderboard reset

Delete **all** scores for a leaderboard.

{% hint style="danger" %}
This is destructive and cannot be undone. It wipes every score on the leaderboard instance.
{% endhint %}

```bash
rundot leaderboard reset <leaderboard-id> --confirm
```

* `leaderboard-id` (required) — the leaderboard instance ID.
* `--confirm` (flag) — skip the interactive `Type 'RESET' to confirm:` prompt. **Required** when running non-interactively (e.g. CI); without it the command aborts.

### rundot leaderboard ban

Shadow-ban a player across **all** leaderboard instances for the game.

```bash
rundot leaderboard ban <profile-id> --reason "<text>"
```

* `profile-id` (required) — the player's profile ID.
* `--reason <text>` (**required**) — recorded with the shadow ban.

{% hint style="info" %}
This shadow ban spans every leaderboard instance for the game, not a single board. Reverse it with `unban`.
{% endhint %}

### rundot leaderboard unban

Restore a shadow-banned player across all leaderboards.

```bash
rundot leaderboard unban <profile-id>
```

* `profile-id` (required) — the player's profile ID.

### rundot leaderboard shadowbanned

List all shadow-banned players for a game, showing profile ID, trust score, flagged submissions, banned-at timestamp, and reason.

```bash
rundot leaderboard shadowbanned [--limit <n>] [--save <path>] [--game-id <id>]
```

* `--limit <n>` (optional) — max players to display. Default `100`.
* `--save <path>` (optional) — save the output to a JSON file.

***

## Features

* **Three Security Levels**: Simple, Token, Sealed - choose based on game stakes
* **Score Ordering**: Highest-first (default) or lowest-first for time trials and golf
* **Multiple Modes**: Support different game modes (classic, hard, etc.)
* **Time Periods**: Daily, weekly, monthly, and all-time leaderboards
* **Anti-Cheat**: Rate limiting, trust scores, shadow banning, optional session validation & sealing
* **Seed Entries**: Pre-populate leaderboards with NPC scores
* **Pagination**: Cursor-based pagination for large leaderboards
* **UTC-Based Periods**: All players globally compete in same daily/weekly/monthly periods
