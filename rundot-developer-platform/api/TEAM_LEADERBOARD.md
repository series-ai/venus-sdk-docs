# Team Leaderboards API

Authoritative co-op and squad team leaderboards for multiplayer games. Read verified rankings, crew scores, and member profiles computed directly by server-side game simulation.

***

## Overview

Unlike solo leaderboards where clients or individual players submit their own personal scores, **Team Leaderboards are authoritative and read-only at the SDK layer**. 

- **Score Ownership**: The client cannot submit or write team scores. Scores are exclusively computed and committed by SyncHub inside the server-side settlement transaction based on authoritative room authority logs and verified deterministic simulation replays.
- **Crew Identity**: A crew is identified by an order-independent `teamKey` scoped to the game and the sorted set of member profile IDs. Membership changes create a new crew identity.
- **Tick Spans, Not Time**: Time spans are recorded as replayed simulation ticks (`ticks: { start, end }`), not seconds and not minutes. No verified tick rate is assumed.
- **Periods**: Leaderboards support `weekly`, `daily`, and `alltime` periods rolled over deterministically via UTC calendar arithmetic without midnight cron sweeps.
- **Compatibility**: If a client calls the Team Leaderboard API against a host or backend that does not support it, calls fail gracefully with `not-supported`.

***

## Quick Start

```typescript
// Untested code example
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// 1. Fetch top ranked crews for a game mode
const page = await RundotGameAPI.teamLeaderboard.getPagedScores({
  mode: 'squad_4',
  period: 'weekly',
  limit: 25,
})

console.log(`Board revision: ${page.boardRevision}, Total entries: ${page.totalEntries}`)
for (const entry of page.entries) {
  const memberNames = entry.members.map((m) => m.username).join(', ')
  console.log(`#${entry.rank} - Score: ${entry.score} - Crew: [${memberNames}]`)
}

// 2. Fetch the current player's crew rankings
const myCrews = await RundotGameAPI.teamLeaderboard.getMyTeamRanks({
  mode: 'squad_4',
  period: 'weekly',
})

for (const team of myCrews.teams) {
  console.log(`Your crew #${team.rank} (${team.teamKey}) has score ${team.score}`)
}
```

***

## Server Configuration

Team leaderboards are configured in your game server release config under `teamLeaderboard` and `synchubTeamScoring`.

> **Mode Keys**: In SyncHub multiplayer games, the leaderboard mode key maps directly to the raid's `sectorKey` (e.g. `'customs_district'`). If no sector key is supplied on the raid, it defaults to `'default'`. Key both `teamLeaderboard.modes` and `synchubTeamScoring.modes` with the sector key so that settlement can resolve and score the raid.

```json
{
  "teamLeaderboard": {
    "v": 1,
    "revision": 1,
    "scoreOrder": "highest",
    "modes": {
      "customs_district": {
        "displayName": "Customs District Extraction",
        "scoreRule": "synchub.extraction.worldSpawnQuantity@1"
      }
    },
    "periods": {
      "weekly": { "displayName": "This Week", "type": "weekly" },
      "alltime": { "displayName": "All Time", "type": "alltime" }
    },
    "roster": {
      "minMembers": 1,
      "maxMembers": 4
    },
    "displaySettings": {
      "maxEntriesPerPage": 50
    }
  },
  "synchubTeamScoring": {
    "v": 1,
    "modes": {
      "customs_district": {
        "policy": "synchub.extraction.worldSpawnQuantity",
        "version": 1
      }
    }
  }
}
```

### Metric Catalog & Policy Selection

Policy selection is managed under `synchubTeamScoring`. Currently supported policies:
- `synchub.extraction.worldSpawnQuantity@1`: Scores the total quantity of world-spawn extraction loot extracted across all surviving squad members. Carried-in and looted inventory items evaluate to zero.
- *Flight and build metrics*: Not available in the current release.

***

## Raid Finality & Settlement

Team rows are not posted during early extractions or prefix settlements:
1. **Prefix Extractions**: When a player or subset of a squad extracts early (before `raidDeadlineTick`), their items are credited immediately via prefix settlement, but **no team leaderboard row is created**.
2. **Finality at Deadline**: A raid reaches finality when verified simulation ticks reach or exceed `raidDeadlineTick`. At this point, the final settlement evaluates the entire roster (including early extractors, survivors, and casualties) and publishes the authoritative crew score.
3. **Keep-Best Invariant**: If a crew completes multiple raids in a period, the board preserves the crew's highest score. Ties are broken by earlier completion timestamp, then lowest `teamKey`.

***

## API Reference

### `getPagedScores(options?)`

Retrieves a paginated list of top crew entries.

```typescript
// Untested code example
const response = await RundotGameAPI.teamLeaderboard.getPagedScores({
  mode: 'squad_4',        // Optional: game mode key
  period: 'weekly',       // Optional: 'weekly' | 'daily' | 'alltime'
  periodDate: '2026-11-08', // Optional: target date within period
  cursor: nextCursor,     // Optional: pagination cursor from previous call
  limit: 50,             // Optional: max entries (1-100)
})
```

### `getTeamRank(options)`

Retrieves ranking and entry details for a specific crew by `teamKey`.

```typescript
// Untested code example
const result = await RundotGameAPI.teamLeaderboard.getTeamRank({
  teamKey: 'tk1_lFUIDH9pWcVhyDgUa_yFHPEc5TxDp0zStKoXjzVzwAc',
  mode: 'squad_4',
  period: 'weekly',
})

if (result.entry) {
  console.log(`Crew rank: #${result.entry.rank} with score ${result.entry.score}`)
} else {
  console.log('Crew is not ranked in this period')
}
```

### `getMyTeamRanks(options?)`

Retrieves rankings for all crews that include the authenticated player.

```typescript
// Untested code example
const myRanks = await RundotGameAPI.teamLeaderboard.getMyTeamRanks({
  mode: 'squad_4',
  period: 'weekly',
  limit: 10,
})

console.log(`You belong to ${myRanks.teams.length} ranked crews`)
```

***

## Types

```typescript
// Untested code example
export interface TeamLeaderboardEntry {
  rank: number
  teamKey: string
  score: number
  completedAtMs: number
  // Duration is not measured in seconds or minutes; ticks records replayed simulation ticks
  ticks: { start: number; end: number } | null
  members: TeamMemberSnapshot[]
  provenance?: TeamScoreProvenance
}

export interface TeamMemberSnapshot {
  profileId: string
  slot: number
  username: string
  avatarUrl: string | null
}

export interface TeamScoreProvenance {
  sourceKind: string
  scoreRule: string
  boardRevision: number
  boardRulesHash: string
  attributes?: Record<string, string | number>
}
```

***

## Error Handling

All SDK calls throw `TeamLeaderboardError`. Inspect `err.code` (`TeamLeaderboardErrorCode`) to handle specific outcomes:

| SDK Error Code (`err.code`) | Server Error Code | HTTP Status | Meaning |
| :--- | :--- | :--- | :--- |
| `'not-supported'` | `HANDLER_NOT_IMPLEMENTED` | 404 | The host bridge or backend does not implement the Team Leaderboard API. |
| `'not-configured'` | `TEAM_LEADERBOARD_NOT_CONFIGURED` | 400 | The game does not have a team leaderboard configured. |
| `'unknown-mode'` | `UNKNOWN_MODE` | 400 | The requested leaderboard mode is not recognized or not enabled. |
| `'invalid-cursor'` | `INVALID_CURSOR` | 400 | The pagination cursor is invalid, expired, or belongs to a different board revision/rule hash. |
| `'invalid-argument'` | `INVALID_ARGUMENTS` | 400 | Invalid request parameters (e.g. invalid limit or malformed teamKey). |
| `'unauthorized'` | `UNAUTHORIZED`, `AUTH_HEADER_MISSING`, `AUTH_TOKEN_MISSING`, `TOKEN_EXPIRED`, `INVALID_TOKEN` | 401 | Authentication or session missing/invalid. |
| `'unknown'` | - | 500 / other | Unhandled or unexpected error. |

### Example

```ts
import { TeamLeaderboardError } from '@series-inc/rundot-game-sdk'

try {
  const paged = await sdk.teamLeaderboard.getPagedScores({ mode: 'squad_4' })
} catch (err) {
  if (err instanceof TeamLeaderboardError) {
    if (err.code === 'not-configured') {
      console.warn('Team leaderboards not configured for this game')
    } else if (err.code === 'not-supported') {
      console.warn('Team leaderboards not supported on this host')
    } else {
      console.error(`Leaderboard error (${err.code}):`, err.message)
    }
  }
}
```

> **Measurement Notice**: Duration is not represented in seconds or minutes. The `ticks` field captures engine simulation spans and is not converted to seconds or minutes.
