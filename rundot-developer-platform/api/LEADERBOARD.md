# Leaderboards API (BETA)

Competitive leaderboards with three security levels. Choose based on your game's requirements.

***

## Setup

To use leaderboards, add one of the following to your project:

* A `config.json` file in your project’s root directory, **or**
* A `configs/` folder containing a `leaderboards.json` file.

This file enables leaderboards and lets you configure how they work in your game.\
\
Minimal required configuration:

```json
{
  "leaderboard": {
    "requiresToken": false
  }
}
```

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

console.log(`Your rank: ${result.rank}`)
```

**Minimal Configuration:**

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
// Step 1: Create score token
const scoreToken = await RundotGameAPI.leaderboard.createScoreToken()
// Returns: { token, startTime, expiresAt, mode }

// Step 2: Play game...

// Step 3: Submit with token
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

**Note:** Hash computation is handled internally by the SDK using Web Crypto API (HMAC-SHA256). Games never need to implement cryptographic hashing manually. The hash always includes: `score`, `duration`, and `token`.

**Maximum security:**

* ✅ All token mode security
* ✅ Tamper-proof scores (HMAC-SHA256 verification)
* ✅ Client-side cheat detection
* ✅ Automatic hash computation (no crypto code needed in games)

**Best for:** Reduced hacking

***

## Query Methods (Same for All Modes)

All query methods work identically regardless of security mode:

```typescript
// Get paginated scores
const pagedScores = await RundotGameAPI.leaderboard.getPagedScores({
  limit: 50,
  cursor: nextCursor
})

// Get podium + player context
const podiumScores = await RundotGameAPI.leaderboard.getPodiumScores({
  topCount: 3,
  contextAhead: 4,
  contextBehind: 2
})

// Get my rank
const rank = await RundotGameAPI.leaderboard.getMyRank()
```

**Note:** Mode and period are automatically resolved from your config. For games with single mode/period, no need to specify them!

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

Same pattern for periods:

```typescript
// Query specific time period
const dailyScores = await RundotGameAPI.leaderboard.getPagedScores({
  period: 'daily',
  limit: 50
})
```

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

* Single mode: `"default"`
* Single period: `"alltime"` (permanent)
* Basic rate limiting (30s between submissions)

***

**Full Config (Advanced Games):**

```json
{
  "leaderboard": {
    // Security (progressive levels)
    "requiresToken": false,           // Simple mode (default)
    "enableScoreSealing": false,      // Requires requiresToken=true
    "scoreSealingSecret": "secret",   // Required if enableScoreSealing=true
    
    // Score bounds
    "minScore": 0,
    "maxScore": 999999999,
    "minDurationSec": 10,
    "maxDurationSec": 600,
    
    // Game modes (optional - omit for single default mode)
    "modes": {
      "default": { "displayName": "Normal" },
      "hard": { "displayName": "Hard Mode" }
    },
    
    // Time periods (optional - omit for single alltime period)
    "periods": {
      "alltime": { "displayName": "All Time", "type": "alltime" },
      "daily": { "displayName": "Daily", "type": "daily" }
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

**Smart Defaults:**

* If you configure only ONE mode/period, it's auto-selected (no need to specify in SDK calls)
* If you configure MULTIPLE modes: defaults to `"default"` mode if present, otherwise first configured
* If you configure MULTIPLE periods: defaults to `"alltime"` > `"daily"` > others (prefers permanent leaderboards)

***

## Best Practices

* Configure score bounds, durations, and anti-cheat settings in your game's `config.json`.
* Use token or score-sealing modes for competitive or high-value rewards.
* Log submissions and responses for customer support audits.
* Treat this API as BETA; monitor release notes for schema or validation changes.
* Seed leaderboards with NPC entries via `seedEntries` to avoid empty boards on launch.
* UTC-based daily/weekly/monthly periods ensure global fairness; show countdowns using the Time API.

***

## Features

* **Three Security Levels**: Simple, Token, Sealed - choose based on game stakes
* **Multiple Modes**: Support different game modes (classic, hard, etc.)
* **Time Periods**: Daily, weekly, monthly, and all-time leaderboards
* **Anti-Cheat**: Rate limiting, trust scores, shadow banning, optional session validation & sealing
* **Seed Entries**: Pre-populate leaderboards with NPC scores
* **Pagination**: Cursor-based pagination for large leaderboards
* **UTC-Based Periods**: All players globally compete in same daily/weekly/monthly periods
