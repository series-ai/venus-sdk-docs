# UGC API (BETA)

User-Generated Content API for publishing, browsing, and engaging with community content.

---

## Overview

The UGC API enables games to let users create, share, and discover community content such as custom characters, levels, decks, or any structured data your game supports.

**Key Features:**
- 📤 **Publish** content with JSON metadata (up to 100KB)
- 🔍 **Browse** community content with sorting, pagination, and author filtering
- 📋 **List** your own published content
- 📦 **Batch Fetch** multiple entries by ID
- 🔗 **Cross-App** browse, read, and create entries across sibling apps
- 👥 **Follow Creators** and track follower/following counts
- ❤️ **Like/Unlike** content (with optimistic updates)
- 📊 **Track Usage** when content is imported/used
- 🚩 **Report** inappropriate content
- 🗳️ **Weekly Voting** with subscription-tiered budgets, live leaderboards, and historical winners

---

## Quick Start

### Publishing Content

```typescript
// Create new content
const entry = await RundotAPI.ugc.create({
  contentType: 'character',  // App-defined type
  data: {
    name: 'My Character',
    stats: { strength: 10, agility: 8 },
    abilities: ['fireball', 'shield']
  },
  isPublic: true,  // Visible in community browse
  title: 'Fire Mage',  // Optional, for display
  tags: ['mage', 'fire']  // Optional, for filtering
})

console.log(`Published with ID: ${entry.id}`)
```

### Browsing Community Content

```typescript
// Browse public content
const catalog = await RundotAPI.ugc.browse({
  contentType: 'character',
  sortBy: 'mostUsed',  // 'recent' | 'mostLiked' | 'mostUsed'
  limit: 20
})

for (const entry of catalog.entries) {
  console.log(`${entry.title} by ${entry.authorName}`)
  console.log(`  Likes: ${entry.likeCount}, Uses: ${entry.useCount}`)
  console.log(`  Liked by me: ${entry.isLikedByMe}`)
}

// Browse a specific creator's content
const creatorContent = await RundotAPI.ugc.browse({
  contentType: 'character',
  authorId: 'creator-profile-id',
  sortBy: 'recent'
})

// Pagination
if (catalog.nextCursor) {
  const nextPage = await RundotAPI.ugc.browse({
    contentType: 'character',
    cursor: catalog.nextCursor
  })
}
```

### Managing Your Content

```typescript
// List your published content
const myContent = await RundotAPI.ugc.listMine({
  contentType: 'character'
})

// Update content
await RundotAPI.ugc.update({
  id: entry.id,
  data: { ...updatedData },
  title: 'Updated Title'
})

// Delete content
await RundotAPI.ugc.delete(entry.id)
```

### Batch Fetching Entries

Retrieve multiple entries by ID in a single request (max 100):

```typescript
const result = await RundotAPI.ugc.getMany({
  entryIds: ['entry-id-1', 'entry-id-2', 'entry-id-3']
})

for (const entry of result.entries) {
  console.log(`${entry.title} - Liked by me: ${entry.isLikedByMe}`)
}
```

---

## Collaborators (multi-editor)

By default a UGC entry has one owner — its `authorId`. The owner can invite **collaborators** (editors) who may then read and `update()` that entry as if it were their own. This is the foundation for co-editing a single piece of content.

Scope and rules:

- **Per-entry.** Collaborators are managed on one specific entry. Adding someone to entry A grants edit rights on entry A only — never on other entries by the same owner.
- **Owner-managed.** Only the owner (`authorId`) can add or remove collaborators, or delete the entry. A collaborator can remove **themselves** (leave).
- **Editors can edit, not administer.** A collaborator can `update()` and read the entry (including while it is private), but cannot delete it or manage its collaborator list.
- **`editorIds` is member-scoped.** It carries real values only when the caller is the owner or an editor (`get`, `listMine`, `listShared`, `listCollaborators`). Discovery surfaces (`browse`, `getMany`) always return `editorIds: []`, so collaborator IDs of public content are never exposed.

```typescript
// Owner: invite a collaborator by their profile ID
await RundotAPI.ugc.addCollaborator({ entryId: entry.id, profileId: friendProfileId })

// Owner: remove a collaborator (or a collaborator removing themselves)
await RundotAPI.ugc.removeCollaborator({ entryId: entry.id, profileId: friendProfileId })

// Any member: read the owner + editor list
const { authorId, editorIds } = await RundotAPI.ugc.listCollaborators(entry.id)

// A collaborator: list entries shared with me (where I'm an editor, not the author)
const shared = await RundotAPI.ugc.listShared({ contentType: 'character' })
for (const entry of shared.entries) {
  // editorIds is populated here because I'm a member
  await RundotAPI.ugc.update({ id: entry.id, data: { ...edits } })
}
```

`addCollaborator` is idempotent (re-adding an existing editor is a safe no-op), and the owner is never added to their own `editorIds`.

---

## Engagement Features

### Likes

```typescript
// Like content
const likeResult = await RundotAPI.ugc.like(entryId)
console.log(`New like count: ${result.likeCount}`)

// Unlike content
const unlikeResult = await RundotAPI.ugc.unlike(entryId)
console.log(`New like count: ${result.likeCount}`)
```

**Optimistic UI Pattern:**
```typescript
// Show immediate feedback, then sync with server
setIsLiked(true)
setLikeCount(prev => prev + 1)

try {
  const result = await RundotAPI.ugc.like(entryId)
  setLikeCount(result.likeCount)  // Sync with server
} catch (error) {
  // Rollback on failure
  setIsLiked(false)
  setLikeCount(prev => prev - 1)
}
```

### Usage Tracking

Track when users import or use community content:

```typescript
// Record usage (rate limited to once per user per entry per day)
const result = await RundotAPI.ugc.recordUse(entryId)
console.log(`Total uses: ${result.useCount}`)
```

### Reporting

Let players flag content for moderation. Reports are community-driven and can lead to **automatic quarantine** once enough distinct users report the same entry.

```typescript
// Report inappropriate content
await RundotAPI.ugc.report({
  id: entryId,
  reason: 'inappropriate',  // 'inappropriate' | 'spam' | 'harassment' | 'other'
  details: 'Contains offensive language'  // Optional
})
```

**Behavior:**

- **One report per user per entry.** Reports are idempotent on `(reporter, entry)` — a user reporting the same entry twice is a silent no-op (it does not increment the count or re-notify).
- **Auto-quarantine on threshold.** Each new report increments the entry's `reportCount`. When the count reaches the threshold (default **3**, configurable via `autoQuarantineReportThreshold`), the server flips the entry to `status: 'quarantined'` and stamps a `quarantine` object with `source: 'user_reports'`. This happens automatically — no admin action required.
- **Effect of quarantine.** A quarantined entry is hidden from community `browse`, `getMany`, and public `get` for everyone **except** the author and collaborators (members), who can still see it (with the `quarantine` details attached) so they understand why it disappeared.
- **Recovery.** Only an admin can lift a quarantine (`rundot ugc approve <entry-id>`) or soft-remove the entry (`rundot ugc admin remove`, which sets the terminal `status: 'removed'`). See [CLI Management](#cli-management-rundot-ugc).

> Quarantine also happens **at create/update time** from automated content moderation (text/image/video scanning), independently of reports — those entries carry `quarantine.source: 'auto_moderation'`. See [Configuration](#configuration).

---

## Creator Following

Follow and unfollow content creators, check follow status, and retrieve follower/following counts.

### Follow / Unfollow

```typescript
// Follow a creator
await RundotAPI.ugc.follow(creatorProfileId)

// Unfollow a creator
await RundotAPI.ugc.unfollow(creatorProfileId)
```

### Check Follow Status

```typescript
const { isFollowing } = await RundotAPI.ugc.isFollowing(creatorProfileId)
console.log(`Following: ${isFollowing}`)
```

### Get Follow Counts

```typescript
const counts = await RundotAPI.ugc.getFollowCounts(creatorProfileId)
console.log(`Followers: ${counts.followerCount}`)
console.log(`Following: ${counts.followingCount}`)
```

### Building a Creator Profile

Combine following with browse to build a creator profile page:

```typescript
// Get creator's follow stats and content in parallel
const [counts, { isFollowing }, content] = await Promise.all([
  RundotAPI.ugc.getFollowCounts(creatorProfileId),
  RundotAPI.ugc.isFollowing(creatorProfileId),
  RundotAPI.ugc.browse({ authorId: creatorProfileId, sortBy: 'recent' })
])
```

---

## Weekly Voting

Let players vote on community UGC entries each ISO week. The server enforces per-user weekly budgets (3 votes by default, 15 for Ultimate subscribers), exposes a live leaderboard, and archives the top 3 winners each week.

All voting methods live under `RundotAPI.ugc.voting`. Calls are authenticated and per-app; the current week is determined server-side from UTC.

### Casting and Removing Votes

```typescript
// Cast a vote on an entry
const result = await RundotAPI.ugc.voting.vote({
  entryId: 'entry-id',
  count: 1, // optional, defaults to 1
})

console.log(`You have ${result.totals.remaining} votes left this week`)
console.log(`Total votes on this entry: ${result.entryTotalCount}`)

// Remove a previously cast vote
await RundotAPI.ugc.voting.unvote({ entryId: 'entry-id', count: 1 })
```

`count` defaults to `1` and must be a positive integer no greater than `15` (the Ultimate weekly budget — no single call can exceed it). Requests with `count <= 0` or `count > 15` are rejected before reaching Firestore.

**Idempotency.** Both `vote` and `unvote` accept a stable `clientRequestId` for safe retry after a network failure — the server returns the cached result instead of double-counting (or, on unvote, instead of 409-ing because the votes are already gone):

```typescript
const requestId = crypto.randomUUID()
await RundotAPI.ugc.voting.vote({ entryId, count: 1, clientRequestId: requestId })
// Later, retrying the same logical request:
await RundotAPI.ugc.voting.unvote({ entryId, count: 1, clientRequestId: crypto.randomUUID() })
```

If a request would exceed the user's remaining budget the server returns `INSUFFICIENT_VOTES`; trying to unvote an entry the user has not voted on returns `NO_VOTES_TO_REMOVE`. Surface these to the player as "out of votes" / "nothing to undo" rather than as generic errors.

### Reading Your State

```typescript
const state = await RundotAPI.ugc.voting.getMyVotes()
console.log(`Week: ${state.weekKey}`) // e.g. "2026-W19"
console.log(`Budget: ${state.totals.budget}, used: ${state.totals.used}`)

for (const { entryId, count } of state.byEntry) {
  console.log(`  ${entryId}: ${count} votes`)
}
```

Use this to render per-entry vote counts in your UI and to gate the vote button when `remaining === 0`.

### Leaderboard (Current Week)

```typescript
const page = await RundotAPI.ugc.voting.getLeaderboard({ limit: 5 })

for (const item of page.items) {
  console.log(`${item.entryId}: ${item.count} votes`)
}

if (page.nextCursor) {
  const next = await RundotAPI.ugc.voting.getLeaderboard({ cursor: page.nextCursor })
}
```

The leaderboard is sorted by vote count descending, then by `firstVotedAt` ascending (earliest entry to receive a vote wins ties). Page size defaults to 5 and is capped at 25.

### Historical Winners

Each Monday at 00:00 UTC the server snapshots the previous week's top 25 entries per app, including a denormalized author/title snapshot so winners survive UGC deletion. The endpoint trims each week's `winners` array to `topN` at read time, so apps can pick the shape that fits their UI without re-snapshotting.

```typescript
// Default: top 3 per week, 4 weeks per page
const winners = await RundotAPI.ugc.voting.getWinners()

// "Winner of the week" only
const headlines = await RundotAPI.ugc.voting.getWinners({ topN: 1 })

// Leaderboard-style historical view: top 10 per week, one week at a time
const deepDive = await RundotAPI.ugc.voting.getWinners({ topN: 10, limit: 1 })

for (const week of winners.items) {
  console.log(`Week ${week.weekKey}:`)
  for (const w of week.winners) {
    console.log(`  #${w.rank} ${w.snapshot.title ?? w.entryId} by ${w.snapshot.authorName} — ${w.count} votes`)
  }
}
```

`limit` (weeks per page) defaults to 4 and is capped at 25. `topN` (ranked entries per week) defaults to 3 and is capped at 25. Weeks are returned newest-first; `rank` is 1-based within the week.

### Subscription-Tiered Budgets

| Tier | Weekly vote budget |
|------|-------------------:|
| Free / default | 3 |
| Ultimate subscribers | 15 |

The tier is resolved at vote-time, not snapshotted. A player who upgrades mid-week immediately gets the higher budget without losing their already-cast votes; a player who downgrades keeps the votes they cast but cannot add new ones until `used < 3`.

---

## Cross-App UGC

Access UGC entries across apps owned by the same creator. This enables patterns like a level-editor app that creates content and a runner app that reads it — both published by the same creator.

**Same-creator requirement:** Both the calling app and the target app must share the same `ownerUserId`. The server verifies this on every cross-app call.

### Browsing Another App's Content

```typescript
const levels = await RundotAPI.ugc.crossAppBrowse({
  targetAppId: 'level-editor-app-id',
  contentType: 'level',
  sortBy: 'newest',
  limit: 20,
})

for (const entry of levels.entries) {
  console.log(`${entry.title} from app ${entry.sourceAppId}`)
}
```

### Reading Entries

```typescript
// Single entry
const entry = await RundotAPI.ugc.crossAppGet({
  targetAppId: 'level-editor-app-id',
  entryId: 'entry-uuid',
})

// Multiple entries (max 100)
const result = await RundotAPI.ugc.crossAppGetMany({
  targetAppId: 'level-editor-app-id',
  entryIds: ['entry-1', 'entry-2'],
})

// Count by content type
const { count } = await RundotAPI.ugc.crossAppCount({
  targetAppId: 'level-editor-app-id',
  contentType: 'level',
})
```

### Creating in Another App

A game can create UGC entries in a sibling app's collection. The entry is attributed to the current user and stored under the target app's UGC namespace.

```typescript
const entry = await RundotAPI.ugc.crossAppCreate({
  targetAppId: 'level-editor-app-id',
  contentType: 'level',
  data: { tiles: [[1, 0], [0, 1]], spawn: { x: 0, y: 0 } },
  isPublic: true,
  title: 'Tricky Maze',
  tags: ['maze', 'hard'],
})
```

### Editor / Runner Pattern

A common architecture splits creation and consumption into two apps:

```typescript
// In the editor app — create a level
const level = await RundotAPI.ugc.create({
  contentType: 'level',
  data: levelData,
  isPublic: true,
  title: 'My Level',
})

// In the runner app — browse levels from the editor
const levels = await RundotAPI.ugc.crossAppBrowse({
  targetAppId: 'editor-app-id',
  contentType: 'level',
  sortBy: 'popular',
})
```

Both apps must be published by the same creator. The runner app reads content from the editor app without duplicating it.

### Cross-App Error Codes

| Code | Raised when |
|------|-------------|
| `UGC_CROSS_APP_DENIED` | The calling app and target app don't share an `ownerUserId`. |
| `UGC_CROSS_APP_TARGET_INVALID` | The target app doesn't exist or has no `ownerUserId` set. |

---

## Data Model

### UGC Entry

```typescript
interface UgcEntry {
  id: string              // Auto-generated UUID
  appId: string           // Your game's app ID
  authorId: string        // Creator's profile ID (the owner)
  authorName: string      // Creator's username
  authorAvatarUrl: string | null
  editorIds: string[]     // Collaborators who can edit this entry (member-scoped — see Collaborators)
  contentType: string     // App-defined type
  data: Record<string, unknown>  // Your content (max 100KB)
  createdAt: number       // Milliseconds timestamp
  updatedAt: number
  isPublic: boolean       // Visible in community browse
  title?: string          // Display title
  tags?: string[]         // Tags for filtering
  useCount?: number       // Times imported/used
  likeCount?: number      // Number of likes
  sourceAppId?: string    // Present on cross-app entries; the app that created the entry

  // Moderation lifecycle (see Reporting)
  status?: 'active' | 'removed' | 'quarantined'  // Absent on legacy entries (treat as 'active')
  reportCount?: number    // Number of distinct user reports
  quarantine?: {          // Present iff status === 'quarantined'
    source: 'auto_moderation' | 'user_reports'  // Scanned at create/update, vs. community reports
    reason: string        // Human-readable reason
    category?: string     // e.g. 'text' | 'video' (auto_moderation only)
    at: number            // Milliseconds timestamp
  }
}
```

**Reading quarantine in your game.** Discovery surfaces already filter out quarantined content, so you rarely see it in `browse`/`getMany`. But an author or collaborator fetching their own entry **will** receive `status: 'quarantined'` plus the `quarantine` object — use these to show a "this content is under review" state instead of rendering it as normal.

### Browse Parameters

```typescript
interface UgcBrowseParams {
  contentType?: string | string[] // Filter by content type. Pass an array
                                  // to match any of several types in one
                                  // query (e.g. ['series', 'comic']).
                                  // Up to 30 elements.
  authorId?: string              // Filter by creator's profile ID
  cursor?: string                // Pagination cursor
  limit?: number                 // Page size
  sortBy?: 'recent' | 'mostLiked' | 'mostUsed' | `idx_${string}`
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, unknown>  // Indexed field filters
}
```

### Browse Response

```typescript
interface UgcBrowseResponse {
  entries: Array<UgcEntry & {
    isLikedByMe?: boolean  // Whether current user liked this
  }>
  nextCursor?: string  // For pagination
}
```

### Filtering by Indexed Fields

Use the `filters` parameter to query on fields with the `idx_` prefix. These fields are promoted to top-level Firestore document fields at create/update time from your `data` payload, based on your game's `indexedFields` configuration.

#### Equality

```typescript
const heroes = await RundotAPI.ugc.browse({
  contentType: 'hero',
  filters: { idx_tier: 3 },
})
```

#### Range

```typescript
const heroes = await RundotAPI.ugc.browse({
  contentType: 'hero',
  filters: { idx_tier: { gte: 2, lte: 4 } },
  sortBy: 'idx_tier',
  sortOrder: 'asc',
})
```

| Operator | Firestore equivalent | Example |
|----------|---------------------|---------|
| `gte` | `>=` | `{ idx_power: { gte: 100 } }` |
| `lte` | `<=` | `{ idx_power: { lte: 500 } }` |

**Important:** When using range filters, set `sortBy` to the same `idx_` field you are filtering on (e.g. `sortBy: 'idx_tier'`). The default sort (`createdAt`) combined with a range filter on a different field requires a Firestore composite index that may not exist. If the query fails, Firestore returns an error with a link to create the required index.

Range filters on multiple different `idx_` fields in the same query are not supported (Firestore limitation).

### Follow Counts

```typescript
interface UgcFollowCounts {
  followerCount: number
  followingCount: number
}
```

### Voting Types

```typescript
interface UgcVoteTotals {
  budget: number     // 3 by default, 15 for Ultimate
  used: number
  remaining: number  // max(0, budget - used)
}

interface UgcVoteMutationResult {
  entryId: string
  userEntryCount: number   // votes this user has cast on this entry
  entryTotalCount: number  // total votes the entry has received this week
  totals: UgcVoteTotals
}

interface UgcMyVotesResponse {
  weekKey: string  // ISO week, e.g. "2026-W19"
  totals: UgcVoteTotals
  byEntry: Array<{ entryId: string; count: number }>
}

interface UgcVoteListParams {
  limit?: number     // page size, max 25
  cursor?: string
}

interface UgcVoteWinnersListParams extends UgcVoteListParams {
  topN?: number      // ranked entries per week (1..25, default 3)
}

interface UgcVoteLeaderboardResponse {
  weekKey: string
  items: Array<{
    entryId: string
    count: number
    firstVotedAt: number  // millis
  }>
  nextCursor: string | null
}

interface UgcVoteWinnersResponse {
  items: Array<{
    weekKey: string
    weekStartUtc: number  // millis
    weekEndUtc: number    // millis
    winners: Array<{
      rank: number       // 1-based, capped at 25
      entryId: string
      count: number
      firstVotedAt: number  // millis
      snapshot: {
        title?: string
        authorId: string
        authorName: string
        authorAvatarUrl: string | null
        contentType: string
      }
    }>
  }>
  nextCursor: string | null
}
```

### Cross-App Parameters

```typescript
interface UgcCrossAppBrowseParams {
  targetAppId: string
  contentType?: string | string[]  // Single type or array (up to 30 types)
  tags?: string[]
  cursor?: string
  limit?: number
  sortBy?: 'newest' | 'popular' | 'mostUsed'
}

interface UgcCrossAppCreateParams {
  targetAppId: string
  contentType: string
  data: Record<string, unknown>
  isPublic?: boolean
  title?: string
  tags?: string[]
}
```

---

## Configuration

### Recommended: `.rundot/ugc.config.json`

Place your UGC config at `.rundot/ugc.config.json`. The file contains the UGC settings **directly** (no `ugc` wrapping key):

```json
{
  "maxEntriesPerUser": 100,
  "maxDataSizeBytes": 102400,
  "moderationFields": ["title", "data.name", "data.description"],
  "requireModeration": false
}
```

> Commit `.rundot/` to your repo — it's project config like `package.json`, not a build artifact. It's env-agnostic and takes priority over legacy `config.{local,staging}.json` for any system it defines. `game.config.prod.json` is a separate file for local CLI metadata; UGC config does not go there.

### Also supported: legacy `config.json`

Add a `ugc` key to your project's `config.json`. Legacy layouts keep working indefinitely; run `rundot migrate-config` (with `--dry-run` to preview) to move them into `.rundot/` automatically.

<details>

<summary>Legacy <code>config.json</code></summary>

```json
{
  "ugc": {
    "maxEntriesPerUser": 100,
    "maxDataSizeBytes": 102400,
    "moderationFields": ["title", "data.name", "data.description"],
    "requireModeration": false
  }
}
```

</details>

**Configuration Options:**

| Field | Default | Description |
|-------|---------|-------------|
| `maxEntriesPerUser` | 100 | Max entries per user per app |
| `maxDataSizeBytes` | 102400 | Max size of `data` field (100KB) |
| `moderationFields` | `["title"]` | Fields to check for content moderation |
| `requireModeration` | false | If true, new content is hidden until approved |
| `autoQuarantineReportThreshold` | 3 | Distinct user reports that auto-quarantine an entry (see [Reporting](#reporting)) |

---

## Content Types

Content types are app-defined strings that categorize your UGC:

```typescript
// Examples
'character'  // Custom characters
'level'      // User-created levels
'deck'       // Card decks
'outfit'     // Fashion items
'story'      // User stories
```

**Best Practices:**
- Use lowercase, alphanumeric with underscores/hyphens
- Keep types consistent across your app
- Query by content type to show relevant UGC sections

---

## Best Practices

### Content Structure

```typescript
// Good: Structured, validated data
const goodEntry = await RundotAPI.ugc.create({
  contentType: 'character',
  data: {
    version: 1,  // Version your data format
    name: 'Hero',
    class: 'warrior',
    stats: { hp: 100, attack: 15 },
    abilities: ['slash', 'block']
  }
})

// Bad: Unstructured blob
const badEntry = await RundotAPI.ugc.create({
  contentType: 'data',
  data: { blob: '...' }  // Hard to validate/display
})
```

### Error Handling

```typescript
try {
  await RundotAPI.ugc.create({ ... })
} catch (error) {
  if (error.message.includes('rate limit')) {
    showToast('Too many entries. Please wait before creating more.')
  } else if (error.message.includes('moderation')) {
    showToast('Content was flagged. Please revise and try again.')
  } else {
    showToast('Failed to publish. Please try again.')
  }
}
```

### Caching

```typescript
// Cache browse results locally
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

let cachedCatalog = null
let cacheTime = 0

async function getCatalog() {
  if (cachedCatalog && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedCatalog
  }
  
  cachedCatalog = await RundotAPI.ugc.browse({ sortBy: 'mostUsed' })
  cacheTime = Date.now()
  return cachedCatalog
}
```

---

## Limits & Rate Limiting

| Limit | Value |
|-------|-------|
| Max entries per user per app | 100 (configurable) |
| Max `data` size | 100KB |
| Content type format | Alphanumeric, `_`, `-` |
| Max content type length | 64 characters |
| Usage tracking | Once per user per entry per day |
| `getMany` batch size | Max 100 entry IDs per request |
| Self-follow | Not allowed (server rejects) |
| Weekly vote budget (default) | 3 per user per app |
| Weekly vote budget (Ultimate) | 15 per user per app |
| Per-request vote/unvote `count` | 1 min, 15 max (defaults to 1) |
| Leaderboard page size | 5 default, 25 max |
| Winners page size (weeks per page) | 4 default, 25 max |
| Winners `topN` (ranked entries per week) | 3 default, 25 max |
| Winners retained per weekly snapshot | Top 25 |

---

## Security

- **Authentication Required**: All UGC operations require a logged-in user
- **Ownership Enforcement**: Only authors can update/delete their content
- **Cross-App Isolation**: Cross-app access is restricted to apps sharing the same `ownerUserId`
- **Content Moderation**: Optional field-level moderation via configuration
- **Rate Limiting**: Prevents spam creation
- **Report System**: Community-driven content flagging

---

## Features Summary

- **CRUD Operations**: Create, read, update, delete user content
- **Collaborators**: Owner-managed per-entry editors for co-editing a single entry
- **Community Browse**: Discover public content with sorting and author filtering
- **Batch Fetch**: Retrieve multiple entries by ID in a single request
- **Cross-App UGC**: Browse, read, count, and create entries across apps by the same creator
- **Creator Following**: Follow/unfollow creators with follower and following counts
- **Engagement**: Likes, usage tracking, reporting
- **Weekly Voting**: Subscription-tiered weekly vote budgets, live leaderboards, and archived top-3 winners
- **Pagination**: Cursor-based pagination for large datasets
- **Flexible Data**: Store any JSON structure (up to 100KB)
- **Content Moderation**: Optional moderation for titles and data fields
- **Author Attribution**: Automatic author info on all entries

---

## CLI Management (`rundot ugc`)

The `rundot` CLI provides commands for managing UGC entries and handling moderation without requiring the game client.

### Player Commands

```bash
# List public entries (auto-detects game from game.config.local.json)
rundot ugc list

# List only your entries
rundot ugc list --mine

# Get full details of an entry
rundot ugc get <entry-id>

# Delete an entry you own
rundot ugc delete <entry-id>

# List entries shared with you (where you are a collaborator)
rundot ugc shared
rundot ugc shared --content-type character

# Manage collaborators on an entry you own
rundot ugc members list <entry-id>
rundot ugc members add <entry-id> --profile <profile-id>
rundot ugc members remove <entry-id> --profile <profile-id>
```

### Admin Commands (Owner/Editor)

These commands require owner or editor role on the game.

```bash
# Browse all entries, including private and removed
rundot ugc admin browse
rundot ugc admin browse --public false --content-type character

# Filter by multiple content types in one query (--content-type is repeatable)
rundot ugc admin browse --content-type character --content-type level

# Soft-remove an entry
rundot ugc admin remove <entry-id>

# List user reports
rundot ugc admin reports --status pending

# Resolve a report
rundot ugc admin resolve <report-id> --action reviewed
rundot ugc admin resolve <report-id> --action dismissed

# List entries that were auto-quarantined (by reports or content moderation)
rundot ugc quarantined

# Approve (lift the quarantine on) an entry
rundot ugc approve <entry-id>
```

### Typical Moderation Workflow

```bash
# 1. Check for pending reports
rundot ugc admin reports --status pending

# 2. Review the flagged entry
rundot ugc get <entry-id>

# 3a. Remove if inappropriate, then mark report reviewed
rundot ugc admin remove <entry-id>
rundot ugc admin resolve <report-id> --action reviewed

# 3b. Or dismiss the report if content is acceptable
rundot ugc admin resolve <report-id> --action dismissed
```

Auto-quarantine runs without admin action (see [Reporting](#reporting)), so periodically review the queue and either approve false positives or remove genuinely bad content:

```bash
# Review auto-quarantined entries, then either restore or remove
rundot ugc quarantined
rundot ugc approve <entry-id>     # false positive — make it visible again
rundot ugc admin remove <entry-id> # confirmed bad — soft-remove permanently
```

All commands accept `--game-id <id>` to specify the game explicitly. If omitted, the CLI reads `game.config.local.json` from the current directory (set via `rundot init`).
