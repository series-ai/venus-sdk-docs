# Document Runtime (BETA)

Use `@series-inc/rundot-document` to build collaborative documents, knowledge bases, world bibles, inventory ledgers, or wiki-style state inside RUN applications.

The document runtime provides:
- **State-based Sequence CRDT**: `TextRegister` provides commutative RGA merges without whole-field clobbering.
- **Dual-mode Operation**: Seamlessly works offline with single-user Merkle sessions and 3-way CAS auto-rebase, or online in multi-user authoritative rooms.
- **Cross-tab Sync**: Native multi-tab synchronization via `TabSyncBus` and `SynchronizedLocalStorage`.
- **Collaborative Discussions**: Span-anchored inline suggestions, Google Docs-style comments, review approvals, and entity-level change tracking.
- **Zero Runtime Dependencies**: Pure TypeScript ESM designed with a zero-dependency sealed boundary. Platform storage is injected, not imported.

{% hint style="info" %}
**When to use Document Runtime vs Storage API:**

* **Use the [Storage API](api/STORAGE.md) directly** for simple, low-velocity key-value state (player preferences, session tokens, feature flags, or small single-blob saves < 50 KB).
* **Use the Document Runtime** when:
  1. **Concurrent readers/writers**: Multiple players, browser tabs, or background agents read and edit structured state simultaneously without last-write-wins data loss or clobbering.
  2. **Large or growing state**: State exceeds simple config blobs (wikis, node graphs, inventory trees, world bibles, long-form content). Raw `appStorage` rewrites the entire monolithic JSON payload on every single mutation ($O(N)$ CPU serialization overhead and disk I/O). The Document Runtime operates on granular delta operations, localized record patches, and log-compacted commits so performance remains constant regardless of document scale.
{% endhint %}

## Install

```bash
npm install @series-inc/rundot-document
# or
pnpm add @series-inc/rundot-document
```

The document runtime is a separate package. It uses `appStorage` and standard room transports via structural duck-typing, but it does not import the RUN game SDK at runtime. You can use the version of the game SDK that your game already has.

---

## 1. Storage Integration (Venus Platform)

Inject your game's `appStorage` into the document runtime. Because `@series-inc/rundot-document` uses the structural adapter pattern, you never need to align SDK versions:

```ts
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import { installVenusDocumentStore } from '@series-inc/rundot-document/venus'

// Wire platform appStorage at app startup
installVenusDocumentStore({
  storage: RundotGameAPI.appStorage,
})
```

`installVenusDocumentStore` validates the presence of required storage primitives (`getItem`, `setItem`, `removeItem`, `getAllKeys` / `getAllItems`, and `compareAndSwap`) immediately at startup.

While raw `appStorage` normally forces full-object rewrites, `@series-inc/rundot-document` isolates state into granular delta commits and compacted snapshot buckets, preventing monolithic serialization lockups.

---

## 2. Define a Document Schema

Schemas declare the top-level registers, entity collections, and rigidity policies:

```ts
import {
  defineDocumentSchema,
  TextRegister,
} from '@series-inc/rundot-document'

export interface CharacterEntity {
  id: string
  name: string
  biography: string
  level: number
}

export const WorldLoreSchema = defineDocumentSchema({
  version: 1,
  fields: {
    title: { type: 'text' },
    summary: { type: 'text' },
    systemConfig: { type: 'json' },
  },
  entitySets: {
    characters: {
      key: 'id',
      rigidity: 'open', // Open schemas accept dynamic metadata fields
    },
  },
})
```

---

## 3. Single-User Session (Offline First with Multi-Tab Sync)

For solo editing or offline-first experiences, create a `SingleUserSession`. It writes through a local Merkle commit tree, coordinates across browser tabs using `BroadcastChannel`, and performs optimistic atomic CAS commits against `appStorage`:

```ts
import { SingleUserSession } from '@series-inc/rundot-document'
import { WorldLoreSchema } from './schema'

const session = new SingleUserSession({
  documentId: 'world-lore-doc-1',
  schema: WorldLoreSchema,
  actor: {
    id: 'player-42',
    name: 'Alex',
    role: 'editor',
  },
})

// Initialize session state from storage
await session.initialize()

// Subscribe to document updates (including changes from other browser tabs)
const unsubscribe = session.subscribe((snapshot) => {
  console.log('Current document title:', snapshot.fields.title)
})

// Update a text field using CRDT operations (RGA commutative merge)
session.updateField('title', (currentText) => {
  return 'The Chronicles of Aethelgard'
})

// Commit changes locally and persist to storage
await session.commit({
  message: 'Updated document title',
})
```

### Multi-Tab Synchronization
`SingleUserSession` automatically connects to `TabSyncBus`. When the user edits the document in another tab or window, the background tab automatically detects the commit via Web Locks and `BroadcastChannel`, rebasing remote commits without overwriting local uncommitted drafts.

---

## 4. Realtime Collaborative Room (Authoritative Multiplayer)

For real-time multi-user editing, use `DocumentAuthorityRoom` on the room server and `DocumentRoomClient` in the browser or mobile client:

### Server-Side Room Authority
```ts
import { DocumentAuthorityRoom } from '@series-inc/rundot-document'
import { WorldLoreSchema } from './schema'

const room = new DocumentAuthorityRoom({
  documentId: 'world-lore-doc-1',
  schema: WorldLoreSchema,
})

// Handle peer joins
room.onPlayerJoin((player) => {
  console.log(`Player joined: ${player.id} (${player.name})`)
})

// Process incoming mutations with monotonic Lamport sequencing
room.onMessage((playerId, message) => {
  const result = room.applyClientOperation(playerId, message)
  if (result.accepted) {
    room.broadcast(result.broadcastMessage)
  }
})
```

### Client-Side Awareness & Presence
`DocumentRoomClient` handles ephemeral presence, cursor tracking, and chunked WebSocket frame synchronization:

```ts
import { DocumentRoomClient } from '@series-inc/rundot-document'

const client = new DocumentRoomClient({
  documentId: 'world-lore-doc-1',
  playerId: 'player-42',
  send: (payload) => myWebSocket.send(JSON.stringify(payload)),
})

// Update real-time cursor position
client.updateAwareness({
  cursor: { line: 12, column: 4 },
  selection: { start: 100, end: 124 },
  status: 'editing',
})

// Listen to peer presence updates
client.onAwarenessChange((peers) => {
  peers.forEach((peer) => {
    console.log(`Peer ${peer.name} cursor at:`, peer.cursor)
  })
})
```

---

## 5. Discussions, Comments & Span Suggestions

The Document Runtime includes first-class support for Google Docs-style inline suggestions, review threads, and entity change proposals:

```ts
import {
  createDiscussionThread,
  createSpanSuggestion,
} from '@series-inc/rundot-document'

// 1. Create an inline comment thread anchored to a character biography
const thread = session.createCommentThread({
  target: {
    entitySet: 'characters',
    entityId: 'char-hero-1',
    field: 'biography',
    span: { start: 14, end: 32 }, // Exact text span
  },
  content: 'Should we mention the ancient dragon battle here?',
})

// 2. Propose a span suggestion (diff replacement)
const suggestion = session.createSuggestion({
  target: {
    entitySet: 'characters',
    entityId: 'char-hero-1',
    field: 'biography',
    span: { start: 14, end: 32 },
  },
  proposedText: 'vanquished the ancient frost dragon at Mount Mor'
})

// 3. Accept suggestion (automatically merges into document and resolves thread)
await session.resolveSuggestion(suggestion.id, 'accepted')
```

---

## 6. Architecture & Design Rules

`@series-inc/rundot-document` enforces strict architectural invariants:

1. **Zero Runtime Dependencies**: `dependencies` in `package.json` is empty. Everything is bundled or injected through ports.
2. **Storage Injection**: Storage is never imported from global packages. Pass `appStorage` via `installVenusDocumentStore` or custom `StructuralStorageApi` adapters.
3. **No Node Builtins**: Runs purely in web standards (`crypto.subtle`, `BroadcastChannel`, `localStorage`).
4. **Deterministic Merges**: All text operations converge deterministically regardless of message arrival order.
