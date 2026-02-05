# UGC API (BETA)

User-Generated Content API for publishing, browsing, and engaging with community content.

---

## Overview

The UGC API enables games to let users create, share, and discover community content such as custom characters, levels, decks, or any structured data your game supports.

**Key Features:**
- 📤 **Publish** content with JSON metadata (up to 100KB)
- 🔍 **Browse** community content with sorting and pagination
- 📋 **List** your own published content
- ❤️ **Like/Unlike** content (with optimistic updates)
- 📊 **Track Usage** when content is imported/used
- 🚩 **Report** inappropriate content

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

---

## Engagement Features

### Likes

```typescript
// Like content
const result = await RundotAPI.ugc.like(entryId)
console.log(`New like count: ${result.likeCount}`)

// Unlike content
const result = await RundotAPI.ugc.unlike(entryId)
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

```typescript
// Report inappropriate content
await RundotAPI.ugc.report({
  id: entryId,
  reason: 'inappropriate',  // 'inappropriate' | 'spam' | 'harassment' | 'other'
  details: 'Contains offensive language'  // Optional
})
```

---

## Data Model

### UGC Entry

```typescript
interface UgcEntry {
  id: string              // Auto-generated UUID
  appId: string           // Your game's app ID
  authorId: string        // Creator's profile ID
  authorName: string      // Creator's username
  authorAvatarUrl: string | null
  contentType: string     // App-defined type
  data: Record<string, unknown>  // Your content (max 100KB)
  createdAt: number       // Milliseconds timestamp
  updatedAt: number
  isPublic: boolean       // Visible in community browse
  title?: string          // Display title
  tags?: string[]         // Tags for filtering
  useCount?: number       // Times imported/used
  likeCount?: number      // Number of likes
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

---

## Configuration

Add UGC settings to your game's `config.json`:

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

**Configuration Options:**

| Field | Default | Description |
|-------|---------|-------------|
| `maxEntriesPerUser` | 100 | Max entries per user per app |
| `maxDataSizeBytes` | 102400 | Max size of `data` field (100KB) |
| `moderationFields` | `["title"]` | Fields to check for content moderation |
| `requireModeration` | false | If true, new content is hidden until approved |

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
const entry = await RundotAPI.ugc.create({
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
const entry = await RundotAPI.ugc.create({
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

---

## Security

- **Authentication Required**: All UGC operations require a logged-in user
- **Ownership Enforcement**: Only authors can update/delete their content
- **Content Moderation**: Optional field-level moderation via configuration
- **Rate Limiting**: Prevents spam creation
- **Report System**: Community-driven content flagging

---

## Features Summary

- **CRUD Operations**: Create, read, update, delete user content
- **Community Browse**: Discover public content with sorting
- **Engagement**: Likes, usage tracking, reporting
- **Pagination**: Cursor-based pagination for large datasets
- **Flexible Data**: Store any JSON structure (up to 100KB)
- **Content Moderation**: Optional moderation for titles and data fields
- **Author Attribution**: Automatic author info on all entries
