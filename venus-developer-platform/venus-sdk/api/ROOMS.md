# RUN.game Rooms API (BETA)

Build synchronous multiplayer sessions backed by the RUN.game Rooms service. Create or join rooms, stream updates in real time, and coordinate turn-based or free-form play.

> ⚠️ Rooms only work inside the RUN.game host environment. Local mock mode throws helpful errors instead of simulating networking.

## Creating & Joining Rooms

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Create a room explicitly
const createdRoom = await RundotGameAPI.rooms.createRoomAsync({
  maxPlayers: 4,
  gameType: 'chess',
  isPrivate: false,
  name: 'Epic Chess Match',
  customMetadata: { skillLevel: 'intermediate' },
  data: { turnDuration: 30 },
})

// Join or create via matchmaking defaults
const result = await RundotGameAPI.rooms.joinOrCreateRoomAsync({
  matchCriteria: { gameType: 'chess', hasSpace: true },
  createOptions: { maxPlayers: 2, name: 'Quick Match' },
})
// { action: 'joined' | 'created', room, playersJoined }

// Join by invite code
const room = await RundotGameAPI.rooms.joinRoomByCodeAsync('ABC123')

// List rooms you currently belong to
const rooms = await RundotGameAPI.rooms.getUserRoomsAsync({ includeArchived: false })
```

## Room Data & Messaging

```typescript
const roomData = await RundotGameAPI.rooms.getRoomDataAsync(room)

await RundotGameAPI.rooms.sendRoomMessageAsync(room, {
  message: { type: 'chat', text: 'Good game!' },
  metadata: { timestamp: Date.now() },
})
```

Room messages are for chat or lightweight event broadcasts.

**Authoritative game flow (phase/turn order/current player)** is managed server-side under `room.customMetadata.rules`:

- `room.customMetadata.rules.gameState.phase` is the canonical phase (`'waiting'` ~= lobby, `'playing'` in-game, `'ended'` complete).
- `room.customMetadata.rules.hostProfileId` is the canonical “host/arbiter” identity (room creator).
- For turn-based games, `room.customMetadata.rules.gameState` also contains `turnOrder`, `currentPlayer`, and `turnCount`.

## Quickstart: Ready-up + Start Game (server-authoritative)

The recommended multiplayer pattern is:

- **Players** write intent via `proposeMoveAsync` (low-latency direct Firestore write via the host).
- **Server** validates and updates authoritative state.
- **Host/arbiter** (the room creator) coordinates a countdown and calls `startRoomGameAsync`.

```typescript
import type { RundotGamesRoomPayload } from '@series-inc/rundot-game-sdk/api'

// 1) Create a room (phase begins as 'waiting' on the server)
const room = await RundotGameAPI.rooms.createRoomAsync({
  maxPlayers: 8,
  gameType: 'bouncing_balls',
  isPrivate: false,
  name: 'Bouncing Balls',
})

// 2) Subscribe for authoritative updates
let latestRoomSnapshot: RundotGamesRoomPayload | null = null
const unsubscribe = await RundotGameAPI.rooms.subscribeAsync(room, {
  onData(event) {
    latestRoomSnapshot = event.roomData
  },
})

// 3) Each player "ready ups" by proposing a move.
// Your server config must allow this moveType in the 'waiting' phase.
await RundotGameAPI.rooms.proposeMoveAsync(room, {
  moveType: 'player_ready',
  gameSpecificState: {
    ready: true,
    readyAt: Date.now(),
  },
})

// 4) Host/arbiter decides when to start.
// The canonical host identity is server-set:
const myProfileId = RundotGameAPI.getProfile().id
const hostProfileId = latestRoomSnapshot?.customMetadata?.rules?.hostProfileId

if (myProfileId === hostProfileId) {
  // Example: when all players are ready, run a short countdown, then start.
  // (Your readiness model lives in server-authoritative state; e.g. playerStates.*.ready)
  const countdownMs = 3000
  await new Promise((r) => setTimeout(r, countdownMs))

  await RundotGameAPI.rooms.startRoomGameAsync(room, {
    gameConfig: { countdownMs },
  })
}

// Later...
unsubscribe()
```

## Real-Time Subscriptions

```typescript
const unsubscribe = await RundotGameAPI.rooms.subscribeAsync(room, {
  onData(event) {
    console.log('Room data updated:', event.roomData)
  },
  onMessages(event) {
    console.log('Message received:', event.message)
  },
  onGameEvents(event) {
    console.log('Move proposed:', event.proposedMoveData)
  },
})

// Leaving the room
await RundotGameAPI.rooms.leaveRoomAsync(room)
unsubscribe()
```

`onData` fires for authoritative room-state changes, `onMessages` for chat/game payloads, and `onGameEvents` for turn-based proposals.

## Turn-Based Game Flow

```typescript
await RundotGameAPI.rooms.startRoomGameAsync(room, {
  gameConfig: { turnDuration: 30, roundLimit: 10 },
  turnOrder: ['player_1', 'player_2'],
})

const move = await RundotGameAPI.rooms.proposeMoveAsync(room, {
  gameSpecificState: { from: 'e2', to: 'e4' },
  moveType: 'piece_move',
  clientContext: { timestamp: Date.now() },
  clientProposalId: 'move_123',
})

await RundotGameAPI.rooms.validateMoveAsync(room, move.proposedMoveId, {
  isValid: true,
  reason: null,
  validatorId: RundotGameAPI.getProfile().id,
})
```

## Configuration

Rooms config is delivered by the host during `INIT_SDK`. You don’t read `RundotGameAPI.config.rooms` directly—the SDK blocks that—and instead the Rooms APIs inject these defaults when you omit parameters.

### Minimal config (single game type)

```json
{
  "rooms": {
    "gameType": "chess"
  }
}
```

- `gameType` is sent on create/join calls unless you override it.
- Host matchmaking and creation defaults are applied when you omit options.

### Full config (advanced)

```json
{
  "rooms": {
    "gameType": "chess",
    "rulesPreset": "blitz_v1",
    "matchmaking": {
      "defaultCriteria": {
        "hasSpace": true,
        "isPrivate": false,
        "timeControl": "blitz"
      },
      "enableAutoMatch": true,
      "maxSearchResults": 10
    },
    "createOptions": {
      "maxPlayers": 2,
      "customMetadata": {
        "timeControl": "blitz",
        "initialTime": 300
      }
    },
    "privateMatchDefaults": {
      "allowCustomCode": true,
      "createOptions": {
        "isPrivate": true,
        "maxPlayers": 4
      }
    }
  }
}
```

### How the SDK applies this configuration

- Matchmaking: `joinOrCreateRoomAsync` uses `matchmaking.defaultCriteria` and honors `enableAutoMatch` / `maxSearchResults` when you omit criteria.
- Creation defaults: `createOptions` supply `gameType`, `maxPlayers`, and metadata when not provided in the call.
- Private rooms: `privateMatchDefaults.createOptions` are layered on top of `createOptions`; `allowCustomCode` controls whether user-supplied `roomCode` values are accepted.
- Rules/game type: `gameType` and optional `rulesPreset` are forwarded so the host can enforce rule sets without extra parameters.

### Notes

- Configuration is host-provided; use `RundotGameAPI.rooms.*` methods and pass overrides only when needed.
- Per-call overrides take precedence over config defaults for that single call.

## Room Properties & Best Practices

`RundotGamesRoom` includes `id`, `players`, `maxPlayers`, `gameType`, `isPrivate`, `status`, `customMetadata`, `data`, timestamps, and admin IDs.

- Treat `customMetadata.rules.gameState` as the canonical game lifecycle state:
  - Lobby vs in-game: `phase === 'waiting'` (lobby) vs `phase === 'playing'` (in-game).
  - Turn-based fields: `turnOrder`, `currentPlayer`, `turnCount` (when applicable).
- Treat `customMetadata.rules.hostProfileId` as the canonical room host/arbiter identity.
- Always `unsubscribe()` and `leaveRoomAsync()` when a player exits to free slots.
- Pair `proposeMoveAsync` and `validateMoveAsync` for peer-validated turn systems; fall back to authoritative arbitration on the server when needed.
