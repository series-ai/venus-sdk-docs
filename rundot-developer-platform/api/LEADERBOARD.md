# Leaderboards API

Competitive leaderboards with three security levels. Choose based on your game's requirements.

> **Team and Co-op Games**: If your game features squad, multiplayer co-op, or raid extractions where scores belong to groups rather than individual players, use the [Team Leaderboards API](TEAM_LEADERBOARD.md) (`RundotGameAPI.teamLeaderboard`). Team leaderboards compute authoritative rankings server-side across multi-player crews with order-independent team keys.

***

## Setup

Leaderboard behavior is driven by your project's server config, uploaded when you `rundot deploy`. The server reads it to determine security mode, score bounds, time periods, and anti-cheat rules. If you omit leaderboard config entirely, leaderboards still work with sensible defaults (simple mode, no tokens, alltime + daily periods).

### `rundot/leaderboard.config.json`

Place your leaderboard config at `rundot/leaderboard.config.json`. The file contains the leaderboard configuration **directly** (no wrapping key):

```
my-game/
├── rundot/
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

> Commit `rundot/` to your repo; it's project config, not a build artifact, and it's env-agnostic. `game.config.prod.json` is a separate file for local CLI metadata (`gameId`, `relativePathToDistFolder`); leaderboard config does not go there.

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
| `failureReason` | `string` | Machine-readable reason when `accepted` is `false` and the server refused the score: `invalid_submission` (for example a score or duration outside the board's limits; resubmitting the same score fails the same way), `token_rejected` (the score token was already used, expired, or minted for a different player; mint a new one with `createScoreToken()` and resubmit; older app versions report a used or expired token as `invalid_submission`), `replay_rejected`, or `identity_changed` (deprecated; older app versions send it for a token minted for a different player, so handle it like `token_rejected`). |
| `zScore` | `number \| null` | Anti-cheat z-score for the submission. Populated when z-score detection is enabled. |
| `isAnomaly` | `boolean` | `true` when the submission was flagged as a statistical anomaly by z-score detection. |
| `cohort` | `{ cohortId: string \| null; rank: number \| null; zone: 'promote' \| 'safe' \| 'relegate' \| null; tierKey: string \| null } \| null` | Present when the period configures `cohort`. Reports the assigned cohort bucket id, rank within the bucket, zone, and league tier key. |

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
// Returns: { token, startTime, expiresAt, sealingNonce?, mode }

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
| `sealingNonce` | `string \| null` | Present only with score sealing enabled. Opaque — pass it straight to `submitScore`; the SDK handles sealing internally. |

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
// Returns: { token, ... } — sealing data is handled by the SDK internally

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

**Note:** Hash computation is handled internally by the SDK. Games never need to implement cryptographic hashing manually — call `submitScore` with the token and your score, and the SDK seals the submission for you.

**Maximum security:**

* ✅ All token mode security
* ✅ Tamper-proof scores (HMAC-SHA256 verification)
* ✅ Client-side cheat detection
* ✅ Automatic hash computation (no crypto code needed in games)

**Best for:** Reduced hacking

***

## 🔵 Replay Verification Mode (Syncplay Games) — Not Available

> **Not currently available.** Do not set `requiresReplay` on a board. The
> server rejects every replay-verified submission (`replay_rejected`), so no
> score on that board will ever rank, and the certify tool that produced the
> required replay bundle (`project:certify`) is no longer shipped.

Replay verification was designed to re-run a deterministic Syncplay game's score
runtime over the player's recorded inputs before ranking a score. Until it
returns, use Token Mode or Score Sealing Mode for leaderboard security.

The platform also does not currently store per-match input logs or expose them
to creators. A Syncplay session started from tick 0 with
`replayRecordingMode: 'memory'` can still export its own replay on the client
(`session.exportReplay()`), but that replay comes from the player's device and
is not verified by RUN.game.

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

## Server-Authoritative Room Submissions (`GameRoom`)

Hosted multiplayer [`GameRoom`](MULTIPLAYER.md#leaderboard) instances can record authoritative match results and read rankings directly on the server via `this.services.leaderboard`, without routing scores through an untrusted client or bouncing through a Simulation recipe:

```typescript
// Inside a GameRoom subclass (server-side)
const result = await this.services.leaderboard.submitScore(
  winnerId,
  'pvp_wins',
  winnerScore,
  { matchId: this.roomId },
  { period: 'alltime', duration: matchDurationSec },
)
if (result.accepted) {
  this.log.info('Updated leaderboard rank', { winnerId, rank: result.rank })
}

const top10 = await this.services.leaderboard.getTop('pvp_wins', 10, { period: 'alltime' })
```

| Method | Parameters & Returns | Behavior |
|---|---|---|
| `submitScore` | `(playerId: string, leaderboardId: string, score: number, metadata?: Record<string, unknown>, opts?: { period?: string; duration?: number }): Promise<{ accepted: boolean; rank: number \| null }>` | Requires `playerId` to have joined the room (`everMemberIds`, else `FORBIDDEN_NON_MEMBER`). Bypasses client score tokens and `serverOnly: true` restrictions while preserving keep-best semantics, `minScore`/`maxScore`/`minDurationSec`/`maxDurationSec` bounds (`opts.duration` is optional), shadow-ban checks, and rank calculation. |
| `getTop` | `(leaderboardId: string, limit: number, opts?: { period?: string }): Promise<Array<{ profileId: string; score: number; rank: number; username?: string; avatarUrl?: string \| null }>>` | Returns up to `limit` (clamped `1..100`) ranked entries for `leaderboardId` (mode) and optional `period`. |
| `getCohortTop` | `(playerId: string, mode: string, opts?: { period?: string; limit?: number }): Promise<Array<{ profileId: string; score: number; rank: number; username?: string; avatarUrl?: string \| null; zone?: 'promote' \| 'safe' \| 'relegate' \| null }>>` | Requires `playerId` to have joined the room (`everMemberIds`). Returns up to `limit` (clamped `1..100`) ranked entries from `playerId`'s assigned cohort bucket with each entry's `zone` (`[]` if not yet assigned). Throws `INVALID_ARGUMENTS` if the resolved period has no `cohort` config. |

> Passing the legacy client shape `(leaderboardId, score, ...)` into `this.services.leaderboard.submitScore` is rejected with `INVALID_ARGUMENTS` — `playerId` is always the first argument on the server so rooms can settle scores for any match participant (including offline/departed members).

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

### `getCohortScores(options?): Promise<CohortScoresResponse>`

Returns the player's entire assigned cohort bucket (at most `cohort.size` entries, no pagination), along with each entry's zone (`'promote' | 'safe' | 'relegate' | null`), `windowEndsAt` (server epoch ms), and league tier when `league` is configured.

After settlement, entries use their final scores, ranks, and zones. The response omits seeds and removed scores, so final ranks can have gaps.

- Throws `RundotApiError` with code `'INVALID_ARGUMENT'` when the resolved period does not configure `cohort`.
- Throws `RundotApiError` with code `'NOT_SUPPORTED'` on older native/web hosts that do not support cohort messages (it never falls back to the global board).

**Options (`CohortRefOptions`):** `mode?`, `period?`, `periodDate?` (same meaning as in `getPagedScores`).

**Returns (`CohortScoresResponse`):**

| Field | Type | Description |
| --- | --- | --- |
| `assigned` | `boolean` | `false` until the player's first accepted score in this window. |
| `cohortId` | `string \| null` | Assigned bucket ID, or `null` when unassigned or quarantined. Treat this ID as an opaque string. |
| `periodInstance` | `string` | Identifier of the resolved period instance. |
| `windowEndsAt` | `number` | Server epoch ms when the current window closes. Pair with [`TimeApi`](TIME.md) for countdowns. |
| `size` | `number` | Configured bucket size (`10`–`200`). |
| `realParticipants` | `number` | Number of non-seed, non-shadow-banned players in the bucket. |
| `tier` | `LeagueTierRef \| null` | Player's tier (`{ index, key, displayName, tierCount }`) when `league` is enabled; otherwise `null`. |
| `entries` | `CohortEntry[]` | Entries in the bucket sorted by score (including backfill seeds if configured). Real players are ranked `1..realParticipants` with their live `zone`, matching settlement `finalRank` and reward rules; seed entries carry `rank: null` and `zone: null`. |
| `playerRank` | `number \| null` | Calling player's rank inside the bucket, or `null`. |
| `playerZone` | `CohortZone \| null` | Calling player's zone (`'promote' \| 'safe' \| 'relegate' \| null`). |

### `getLeagueStatus(options?): Promise<LeagueStatus>`

Returns the player's current league tier, active window status, and most recently settled window outcome (triggers lazy settlement if the prior window has closed and not yet settled).

- Throws `RundotApiError` with code `'INVALID_ARGUMENT'` when the resolved period does not configure `league`.
- Throws `RundotApiError` with code `'NOT_SUPPORTED'` on older hosts.

**Returns (`LeagueStatus`):**

| Field | Type | Description |
| --- | --- | --- |
| `tier` | `LeagueTierRef` | Current tier (`{ index, key, displayName, tierCount }`). |
| `current` | `{ periodInstance, windowEndsAt, cohortId, playerRank, playerZone }` | Live state in the active window (`cohortId` is `null` until first accepted score). |
| `lastResult` | `{ periodInstance, finalRank, outcome, fromTier, toTier } \| null` | Most recent settled window (`outcome` is `'promoted' \| 'relegated' \| 'stayed' \| 'excluded'`), or `null` if none yet. |

### `getPendingRewards(): Promise<LeaderboardReward[]>`

Lists up to **50** unclaimed, non-expired league rewards for the current player in this game (sorted newest first). As each reward is claimed via `claimReward`, subsequent calls surface any older unclaimed rewards beyond the first 50. Throws `RundotApiError` with code `'NOT_SUPPORTED'` on older hosts.

Each `LeaderboardReward` contains:

| Field | Type | Description |
| --- | --- | --- |
| `rewardId` | `string` | Deterministic reward identifier. |
| `source` | `{ mode, period, periodInstance, cohortId, tierKey, finalRank, outcome }` | Settled window details that produced the reward. |
| `payload` | `Record<string, unknown>` | Merged game-defined JSON payload from matching `rewards` rules. |
| `entitlements` | `Array<{ entitlementId: string; quantity: number; consumable?: boolean }>` | Platform entitlements granted server-side when claimed. |
| `createdAt` | `number` | Creation timestamp (ms). |
| `claimableUntil` | `number` | Claim deadline timestamp (ms). |

### `claimReward(rewardId): Promise<ClaimRewardResult>`

Marks a pending reward as claimed and executes any configured platform `entitlements` grants (`source: 'reward'`, idempotency key `league_${rewardId}_${entitlementId}`). Idempotent: calling again for an already-claimed reward returns `claimed: true`, `alreadyClaimed: true`, and the same `payload` / `entitlements` without double-granting entitlements. If expired past `claimableUntil`, returns `{ claimed: false, alreadyClaimed: false, failureReason: 'expired', ... }`; if the reward does not exist, belongs to another player/game, or was voided (for example after a ban), returns `{ claimed: false, alreadyClaimed: false, failureReason: 'not_found', ... }`. Throws `RundotApiError` with code `'NOT_SUPPORTED'` on older hosts.

***

## Cohort Leaderboards

Instead of placing every player on one global board, a time-limited period (`daily`, `weekly`, `monthly`, or `interval`) can partition players into fixed-size **cohort buckets** (10–200 players, default 100):

```json
{
  "periods": {
    "tournament": {
      "displayName": "Weekly Tournament",
      "type": "weekly",
      "cohort": {
        "size": 100,
        "allocatorShards": 1,
        "backfill": { "strategy": "seedEntries" }
      }
    }
  }
}
```

- **Assignment on first accepted score (`public` releases only):** A player has no bucket (`assigned: false`) until their first accepted score in the window lands. Once assigned, they remain in that bucket for the entire UTC window. Submissions and reads on pre-release `review` / `private` builds write to the global board only and do not touch cohort buckets, league tiers, or reward docs.
- **Global board stays intact:** Every accepted submission in a cohort period also writes to the global period board, so `getPagedScores`, `getMyRank`, `getPodiumScores`, and older SDK clients continue working.
- **Allocator sharding (`allocatorShards`):** Defaults to `1` (full buckets; handles ~20 joins/sec per tier). Games expecting massive burst traffic right after UTC rollover can raise it up to `32` at the cost of up to `allocatorShards` partially-filled buckets per tier.
- **Seed backfill (`backfill.strategy`):**
  - `'none'` (default): Empty slots stay empty.
  - `'seedEntries'`: Pre-populates a new bucket with `size - 1` entries from `seedEntriesByTier[tierKey]` or `seedEntries[mode][periodKey]`; each real player who joins removes one seed.
  - `'generated'`: Generates synthetic backfill scores calibrated to the tier's prior settled score distribution (falling back to `seedEntries` if no prior distribution exists). Requires `league` to be configured on that period.
- **Old-host fallback (`NOT_SUPPORTED`):** Older native or web hosts reject `getCohortScores`, `getLeagueStatus`, `getPendingRewards`, and `claimReward` with a `RundotApiError` where `err.code === 'NOT_SUPPORTED'`. Catch that code and fall back to the global board (`getPodiumScores`) or hide the tournament UI:

```typescript
try {
  const cohort = await RundotGameAPI.leaderboard.getCohortScores({ period: 'tournament' })
  renderCohortBoard(cohort)
} catch (err) {
  if ((err as { code?: string }).code === 'NOT_SUPPORTED') {
    const global = await RundotGameAPI.leaderboard.getPodiumScores({ period: 'tournament' })
    renderGlobalFallback(global)
  } else {
    throw err
  }
}
```

***

## Leagues & Rewards

Any period with `cohort` can also declare `league` tiers, automated end-of-window promotion/relegation, and claimable rewards:

### Tier State Machine & Settlement

```
            first accepted score
 (none) ───────────────────────────▶ ASSIGNED(window W, tier T)
                                         │ window W ends (server UTC boundary)
                                         ▼
                                     FROZEN (bucket stays open snapshot; new submits go to W+1)
                                         │ settleBucket (lazy on first touch or scheduled sweeper)
                                         ▼
                                     SETTLED(W): tier := T+1 (promoted) | T-1 (relegated) | T (stayed)
                                                 reward record created if any rule matched
```

- **Scaled zones:** At settlement (and during live zone previews), `promoteTop` and `relegateBottom` scale proportionally to `realParticipants / size` (floored at `1` whenever the configured count is `>= 1`). Top tier never promotes (`+1` capped), bottom tier never relegates (`-1` floored), and if `realParticipants < minRealPlayersToSettle`, everyone finishes `'stayed'`.
- **Stamped rules:** Each bucket stamps the `size`, tier rules, and reward rules active when it was created. Editing config mid-window takes effect on the next window without altering in-flight buckets.
- **UTC countdowns:** Always compute countdowns from `windowEndsAt` paired with [`TimeApi`](TIME.md), not the device clock.
- **Security:** Reward rules that grant platform `entitlements` require `"serverOnly": true` on all leaderboard modes (enforced on upload and read). For payload-only rewards without `serverOnly: true`, enable `"requiresToken": true` and `"enableScoreSealing": true` — uploading payload-only rewards with `requiresToken: false` and client-writable modes emits a warning because client tokens/sealing reduce casual tampering but do not prove scores came from gameplay.

### Reward Rules & `appStorage` Claim Pattern

Configured `rewards` rules match by `tiers` (`'*'` or array of tier keys) and either `ranks: [minRank, maxRank]` (1-based inclusive real-player rank) or `outcome` (`'promoted' | 'relegated' | 'stayed'`). All matching rules merge into a single reward per player per window (numeric `payload` fields sum; nested objects deep merge; per-rule `payload` max 4 KB). Each entitlement entry accepts `{ entitlementId, quantity, consumable? }` (`consumable` defaults to `false` and must match across rules in the same league).

Use `appStorage` to save each reward ID before claiming it. Use compare-and-swap to add the payload and record the applied ID in one operation.

```typescript
interface SaveState {
  coins: number
  claimingRewardIds: string[]
  appliedRewardIds: string[]
}

const SAVE_KEY = 'playerSave'
function parseSave(raw: string | null): SaveState {
  return raw ? JSON.parse(raw) : { coins: 0, claimingRewardIds: [], appliedRewardIds: [] }
}

async function updateSave(update: (save: SaveState) => SaveState): Promise<SaveState> {
  while (true) {
    const raw = await RundotGameAPI.appStorage.getItem(SAVE_KEY)
    const save = parseSave(raw)
    const next = update(save)
    if (next === save) return save
    const result = await RundotGameAPI.appStorage.compareAndSwap(SAVE_KEY, raw, JSON.stringify(next))
    if (result.swapped) return next
  }
}

async function applyLeagueReward(rewardId: string) {
  const saved = await updateSave((save) =>
    save.appliedRewardIds.includes(rewardId) || save.claimingRewardIds.includes(rewardId)
      ? save
      : { ...save, claimingRewardIds: [...save.claimingRewardIds, rewardId] },
  )
  if (!saved.claimingRewardIds.includes(rewardId)) return

  const result = await RundotGameAPI.leaderboard.claimReward(rewardId)
  if (!result.claimed && result.failureReason !== 'expired' && result.failureReason !== 'not_found') {
    return // Keep the ID for a later retry.
  }

  const coins = result.claimed && typeof result.payload?.coins === 'number' ? result.payload.coins : 0
  await updateSave((save) => {
    if (!save.claimingRewardIds.includes(rewardId)) return save
    return {
      coins: save.coins + coins,
      claimingRewardIds: save.claimingRewardIds.filter((id) => id !== rewardId),
      appliedRewardIds: result.claimed ? [...save.appliedRewardIds, rewardId] : save.appliedRewardIds,
    }
  })
}

async function claimPendingLeagueRewards() {
  const raw = await RundotGameAPI.appStorage.getItem(SAVE_KEY)
  for (const rewardId of parseSave(raw).claimingRewardIds) {
    await applyLeagueReward(rewardId)
  }

  const pending = await RundotGameAPI.leaderboard.getPendingRewards()
  for (const { rewardId } of pending) {
    await applyLeagueReward(rewardId)
  }
}
```

Call `claimPendingLeagueRewards()` at startup. If the server accepts a claim before the game saves the coins, the saved reward ID lets the game retry the claim and receive the same payload. The game adds coins only after the server accepts the claim. It records the reward as applied in the same compare-and-swap operation.

### Local Testing (`MockLeaderboardApi`)

When running locally with `MockLeaderboardApi` (outside a live host), pass `cohort` options in the constructor to simulate buckets, tiers, and reward settlement without waiting for a UTC boundary:

- `addMockCohortEntry(entry, options?)` — seed opponent scores into the active cohort bucket (throws `INVALID_ARGUMENT` after settlement).
- `settleNow(options?)` — settles the current window immediately (idempotent per window; freezes the bucket against further submissions, updates tier progression, and generates any matching pending rewards).
- `advanceMockWindow(options?)` — advances the mock clock past the current window's `windowEndsAt` so subsequent `submitScore` and `settleNow` calls enter a fresh window (e.g., to test multi-window `bronze -> silver -> gold` progression locally).
- `addMockReward(reward)` — inject a pending (or expired) reward directly to test claim UI flows.

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

Each entry in `periods` carries a `type` that controls how the leaderboard resets. The `type` must be one of these five values (the exported `LeaderboardPeriodType`):

| `type` | Resets | Notes |
| --- | --- | --- |
| `"alltime"` | Never | Permanent board; entries persist indefinitely. Cannot configure `cohort` or `league`. |
| `"daily"` | Every UTC day | Rolls over at UTC midnight. |
| `"weekly"` | Every UTC week | Rolls over at the start of the UTC week. |
| `"monthly"` | Every UTC month | Rolls over at the start of the UTC month. |
| `"interval"` | Fixed UTC cadence | Rolls over every `durationSec` seconds (`60`–`31536000`) anchored at `anchorUtc` (ISO-8601 UTC timestamp with timezone or epoch ms). Ideal for 3-day sprints, weekend events, or custom season lengths. |

All five are first-class; `weekly`, `monthly`, and `interval` work just like `daily` and `alltime`. The `key` you give each period (for example `daily`, `weekly`, `sprint`) is the string you pass as `period` in `submitScore` / query options; the `type` is what drives the reset cadence. Reset boundaries are UTC-based so all players globally share the same period instance.

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
    "requiresReplay": false,          // Not available — leave false (see Replay Verification Mode)
    
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
    // `type` must be one of: "daily" | "weekly" | "monthly" | "alltime" | "interval"
    // `cohort` and `league` are valid on daily, weekly, monthly, and interval periods (never alltime)
    "periods": {
      "alltime": { "displayName": "All Time", "type": "alltime" },
      "daily": { "displayName": "Daily", "type": "daily" },
      "weekly": { "displayName": "Weekly", "type": "weekly" },
      "monthly": { "displayName": "Monthly", "type": "monthly" },
      "sprint": {
        "displayName": "3-Day Sprint",
        "type": "interval",
        "anchorUtc": "2026-11-18T00:00:00Z", // Required for type="interval"
        "durationSec": 259200                 // Required integer 60..31536000 for type="interval"
      },
      "tournament": {
        "displayName": "Weekly Tournament",
        "type": "weekly",
        "cohort": {
          "size": 100,                      // 10..200 (default 100)
          "allocatorShards": 1,             // 1..32 (default 1)
          "backfill": { "strategy": "seedEntries" } // "none" | "seedEntries" | "generated"
        },
        "league": {
          "key": "main_league",
          "tiers": [
            { "key": "bronze", "displayName": "Bronze" },
            { "key": "silver", "displayName": "Silver" }
          ],
          "startTier": 0,
          "promoteTop": 10,
          "relegateBottom": 10,
          "minRealPlayersToSettle": 5,
          "rewardClaimDays": 14,
          "rewards": [
            {
              "tiers": "*",
              "ranks": [1, 1],
              "payload": { "gems": 100 },
              "entitlements": [{ "entitlementId": "trophy_badge", "quantity": 1 }]
            },
            { "outcome": "promoted", "payload": { "gems": 10 } }
          ]
        }
      }
    },
    
    // Anti-cheat. The on/off toggles below cover the common case. The
    // block also accepts optional numeric tuning knobs
    // (minTimeBetweenSubmissionsSec, zScoreThreshold, trustScoreDecayPerFlag,
    // shadowBanThreshold) — see "Anti-cheat tuning" below. Omit them to
    // inherit the platform's tuned defaults.
    "antiCheat": {
      "enableRateLimit": true,
      "enableZScoreDetection": false
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
    },
    // Optional per-tier seed overrides for cohort/league buckets
    "seedEntriesByTier": {
      "silver": [
        { "score": 25000, "username": "SilverRook", "duration": 180 }
      ]
    }
  }
}
```

> **Heads up for idle, incremental, and big-number games.** The default `maxScore` is `999999999` (about 10⁹). A score above `maxScore` is rejected: `submitScore` returns `accepted: false` with `failureReason: 'invalid_submission'`. It is not clamped down. Exponential economies pass 10⁹ within a few prestige loops, so set `maxScore` to at least `9007199254740991` (`Number.MAX_SAFE_INTEGER`), or submit a compressed value such as `Math.floor(Math.log10(score) * 1e6)`. See the [BigNumbers API](BIGNUMBERS.md).

***

**Smart Defaults:**

* If you configure only ONE mode/period, it's auto-selected (no need to specify in SDK calls)
* If you configure MULTIPLE modes: defaults to `"default"` mode if present, otherwise first configured
* If you configure MULTIPLE periods: defaults to `"alltime"` > `"daily"` > others (prefers permanent leaderboards)

***

### Anti-cheat tuning

The `antiCheat` block accepts these optional overrides in addition to the toggles above. Each has a platform-tuned default applied server-side; set a value only when you want to override it for your game. The default values themselves aren't published — choose values that fit your game's pacing and scoring curve rather than calibrating to a specific number.

| Field | Type | What it does |
|-------|------|--------------|
| `enableRateLimit` | `boolean` | Master switch for per-player submission rate limiting. |
| `minTimeBetweenSubmissionsSec` | `number` | Minimum interval between accepted submissions from one player. Raise it for slow/idle games; lower it for fast-scoring ones. |
| `enableZScoreDetection` | `boolean` | Turns on statistical outlier detection on submitted scores. |
| `zScoreThreshold` | `number` | How many standard deviations above the mean a score must be before it's flagged. Lower is stricter. |
| `trustScoreDecayPerFlag` | `number` | How much a player's trust score drops each time a submission is flagged. |
| `shadowBanThreshold` | `number` | Accumulated flag level at which a player is shadow-banned (their scores stop appearing to others). |

***

## Best Practices

* Configure score bounds, durations, and anti-cheat settings in `rundot/leaderboard.config.json`.
* **Debounce your submits.** There is a minimum interval between accepted submissions per player (`minTimeBetweenSubmissionsSec`; see [Anti-cheat tuning](#anti-cheat-tuning)). Submitting on every frame, tick, or score change gets most submits rejected. Submit only when the value meaningfully changes. The board is keep-best, so a lower resubmit returns `accepted: false` and is a harmless no-op. Don't retry a rejected submit right away; it is still inside the cooldown.
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

List the top scores for a leaderboard (works for both global period IDs and cohort bucket IDs).

```bash
rundot leaderboard scores <leaderboard-id> [--include-shadow-banned] [--limit <n>] [--save <path>]
```

* `leaderboard-id` (required) — the leaderboard instance or cohort bucket ID; use `config` (for base IDs) or `player` (to see a player's assigned `bucketId`).
* `--include-shadow-banned` (flag) — also show shadow-banned entries.
* `--limit <n>` (optional) — max entries to display. Default `50`.
* `--save <path>` (optional) — save the output to a JSON file.

### rundot leaderboard player

View a single player's score, trust state, and (for cohort periods) cohort bucket membership (`bucketId`, `tierKey`, `lane`, `quarantined`, `periodInstance`) as JSON.

```bash
rundot leaderboard player <leaderboard-id> <profile-id> [--save <path>]
```

* `leaderboard-id` (required) — the leaderboard instance or cohort bucket ID.
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

Shadow-ban a player across **all** leaderboard instances (including cohort buckets) for the game, and void any pending unclaimed league rewards for that player.

```bash
rundot leaderboard ban <profile-id> --reason "<text>"
```

* `profile-id` (required) — the player's profile ID.
* `--reason <text>` (**required**) — recorded with the shadow ban and voided rewards.

{% hint style="info" %}
This shadow ban spans every leaderboard instance for the game, not a single board. Reverse the shadow ban with `unban` (unbanning does not restore previously voided rewards; admins can also void unclaimed rewards standalone via `POST /v1/leaderboard/:appId/void-rewards/:profileId`).
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
* **Sharded Cohorts & Leagues**: 10–200 player groups, tiered promotion/relegation, and claimable rewards
* **Anti-Cheat**: Rate limiting, trust scores, shadow banning, optional session validation & sealing
* **Seed Entries**: Pre-populate leaderboards with NPC scores (or per-tier/generated cohort backfill)
* **Pagination**: Cursor-based pagination for large leaderboards
* **UTC-Based Periods**: All players globally compete in same daily/weekly/monthly periods
