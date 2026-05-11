# App API (BETA)

Server-verified role detection and admin moderation tools for game owners and editors.

---

## Overview

The App API lets your game detect whether the current player is a member of the development team and, if so, perform admin operations like content moderation.

Roles are **server-verified** — the backend checks the user's Firebase Auth email against the game's owner and editor list. There is no client-side role assignment to tamper with.

**Key Features:**
- Detect whether the current user is an owner, editor, or regular player
- Browse and remove UGC entries as an admin
- Browse and remove AI-generated images as an admin
- Review and resolve player reports for both UGC and ImageGen content

---

## Role Detection

### Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const role = await RundotGameAPI.app.getMyRole()

if (role === 'owner' || role === 'editor') {
  showAdminPanel()
} else {
  showPlayerUI()
}
```

### `getMyRole()`

Returns the current user's role for this game.

```typescript
const role: AppRole = await RundotGameAPI.app.getMyRole()
```

**Returns:** `'owner' | 'editor' | 'none'`

| Role | Meaning |
|------|---------|
| `owner` | The user's email matches the game's owner email |
| `editor` | The user's email is in the game's editor list |
| `none` | No match, anonymous user, or game not found |

> **Security:** Roles are resolved server-side from the verified Firebase ID token. Anonymous users and unrecognized emails always receive `'none'`.

---

## Admin UGC

Available at `RundotGameAPI.app.adminUgc`. All methods require the caller to be an owner or editor — the server returns `403 Forbidden` otherwise.

### Browse All Entries

Browse all UGC entries for your game, including non-public entries that the player-facing `ugc.browse()` hides.

```typescript
const { entries, nextCursor } = await RundotGameAPI.app.adminUgc.browse({
  contentType: 'character',   // Optional: filter by content type
  authorId: 'some-profile',   // Optional: filter by author
  isPublic: false,            // Optional: filter by visibility (omit to see all)
  sortBy: 'recent',           // 'recent' | 'mostLiked' | 'mostUsed'
  sortOrder: 'desc',          // 'asc' | 'desc'
  limit: 20,                  // Max entries per page
  cursor: nextCursor,         // Pagination cursor from previous response
})

for (const entry of entries) {
  console.log(`${entry.title} by ${entry.authorName} (public: ${entry.isPublic})`)
}
```

#### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `contentType` | `string` | — | Filter by app-defined content type |
| `authorId` | `string` | — | Filter by author profile ID |
| `isPublic` | `boolean` | — | Filter by visibility; omit to see all |
| `sortBy` | `string` | `'recent'` | Sort field: `'recent'`, `'mostLiked'`, `'mostUsed'` |
| `sortOrder` | `'asc' \| 'desc'` | `'desc'` | Sort direction |
| `limit` | `number` | `20` | Max entries per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |
| `filters` | `Record<string, unknown>` | — | Custom indexed field filters (fields must have `idx_` prefix) |

### Remove an Entry

Soft-delete any entry regardless of author. The entry's Firestore record is marked as `status: 'removed'` and excluded from all player-facing queries. The content is **not permanently deleted** — it can be reviewed later.

```typescript
await RundotGameAPI.app.adminUgc.removeEntry('entry-id-to-remove')
```

### List Reports

Browse player-submitted reports for UGC content, with optional status filtering.

```typescript
const { reports, nextCursor } = await RundotGameAPI.app.adminUgc.listReports({
  status: 'pending',  // Optional: 'pending' | 'reviewed' | 'dismissed'
  limit: 20,
})

for (const report of reports) {
  console.log(`Report on entry ${report.entryId}: ${report.reason}`)
  console.log(`  Status: ${report.status}, Filed: ${new Date(report.createdAt)}`)
}
```

### Resolve a Report

Update a report's status after reviewing it.

```typescript
// Mark as reviewed (acknowledged, action taken)
await RundotGameAPI.app.adminUgc.resolveReport('report-id', 'reviewed')

// Dismiss (no action needed)
await RundotGameAPI.app.adminUgc.resolveReport('report-id', 'dismissed')
```

---

## Admin ImageGen

Available at `RundotGameAPI.app.adminImageGen`. All methods require the caller to be an owner or editor.

### Browse Generated Images

Browse all AI-generated images for your game with optional filtering by creator or status.

```typescript
const { entries, nextCursor } = await RundotGameAPI.app.adminImageGen.browse({
  profileId: 'some-user',   // Optional: filter by creator
  status: 'active',         // Optional: 'active' | 'removed' (omit to see all)
  sortOrder: 'desc',        // 'asc' | 'desc'
  limit: 20,
})

for (const entry of entries) {
  console.log(`"${entry.prompt}" by ${entry.profileId}`)
  console.log(`  Status: ${entry.status}, Model: ${entry.model}`)
}
```

#### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `profileId` | `string` | — | Filter by creator profile ID |
| `status` | `'active' \| 'removed'` | — | Filter by status; omit to see all |
| `sortOrder` | `'asc' \| 'desc'` | `'desc'` | Sort direction (by creation time) |
| `limit` | `number` | `20` | Max entries per page (max 100) |
| `cursor` | `string` | — | Pagination cursor |

### Remove a Generated Image

Soft-delete a generated image. The original image is moved to a quarantine area and replaced with a placeholder so existing references don't break with a 404. The Firestore record is marked `status: 'removed'`.

```typescript
await RundotGameAPI.app.adminImageGen.removeEntry('generation-id')
```

### List Reports

Browse player-submitted reports for generated images.

```typescript
const { reports, nextCursor } = await RundotGameAPI.app.adminImageGen.listReports({
  status: 'pending',
  limit: 20,
})

for (const report of reports) {
  console.log(`Report on generation ${report.generationId}: ${report.reason}`)
}
```

### Resolve a Report

```typescript
await RundotGameAPI.app.adminImageGen.resolveReport('report-id', 'reviewed')
```

---

## Building an Admin Panel

Here's a complete example of a simple admin moderation flow:

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

async function initAdminPanel() {
  const role = await RundotGameAPI.app.getMyRole()

  if (role === 'none') {
    return // Not an admin, nothing to show
  }

  // Load pending reports across both UGC and ImageGen
  const [ugcReports, imageGenReports] = await Promise.all([
    RundotGameAPI.app.adminUgc.listReports({ status: 'pending' }),
    RundotGameAPI.app.adminImageGen.listReports({ status: 'pending' }),
  ])

  console.log(`Pending: ${ugcReports.reports.length} UGC, ${imageGenReports.reports.length} ImageGen`)

  // Example: remove a flagged UGC entry and resolve the report
  for (const report of ugcReports.reports) {
    if (report.reason === 'inappropriate') {
      await RundotGameAPI.app.adminUgc.removeEntry(report.entryId)
      await RundotGameAPI.app.adminUgc.resolveReport(report.id, 'reviewed')
    }
  }
}
```

---

## Type Reference

### AppRole

```typescript
type AppRole = 'owner' | 'editor' | 'none'
```

### AdminUgcEntry

```typescript
interface AdminUgcEntry {
  id: string
  appId: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  contentType: string
  data: Record<string, unknown>
  createdAt: number
  updatedAt: number
  isPublic: boolean
  title?: string
  tags?: string[]
  useCount?: number
  likeCount?: number
}
```

### UgcReport

```typescript
interface UgcReport {
  id: string
  entryId: string
  appId: string
  reporterId: string
  reason: 'inappropriate' | 'spam' | 'harassment' | 'other'
  details?: string
  createdAt: number   // milliseconds since epoch
  status: 'pending' | 'reviewed' | 'dismissed'
}
```

### ImageGenEntry

```typescript
interface ImageGenEntry {
  id: string
  appId: string
  profileId: string
  prompt: string
  negativePrompt?: string
  aspectRatio: string
  imageUrl: string
  removeBackground: boolean
  model: string
  createdAt: number   // milliseconds since epoch
  status: 'active' | 'removed'
}
```

### ImageGenReport

```typescript
interface ImageGenReport {
  id: string
  generationId: string
  appId: string
  reporterId: string
  reason: 'inappropriate' | 'spam' | 'harassment' | 'other'
  details?: string
  createdAt: number   // milliseconds since epoch
  status: 'pending' | 'reviewed' | 'dismissed'
}
```
