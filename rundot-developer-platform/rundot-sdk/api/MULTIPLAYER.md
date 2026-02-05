# Multiplayer API (BETA)

Build synchronous multiplayer sessions backed by the RUN.game Rooms service. Create or join rooms, stream updates in real time, and coordinate turn-based or free-form play.

> ⚠️ Multiplayer only works inside the RUN.game host environment. Local mock mode throws helpful errors instead of simulating networking.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Create a multiplayer room
const room = await RundotGameAPI.rooms.createRoomAsync({
  maxPlayers: 4,
  gameType: 'chess',
  isPrivate: false,
  name: 'Epic Chess Match',
})

// Subscribe to room updates
const unsubscribe = await RundotGameAPI.rooms.subscribeAsync(room, {
  onData(event) {
    console.log('Room updated:', event.roomData)
  },
})
```

## Creating & Joining Rooms

```typescript
// Create a room explicitly
const createdRoom = await RundotGameAPI.rooms.createRoomAsync({
  maxPlayers: 4,
  gameType: 'chess',
  isPrivate: false,
  name: 'Epic Chess Match',
  customMetadata: { skillLevel: 'intermediate' },
  data: { turnDuration: 30 },
})

// Join or create via matchmaking
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

**Authoritative game flow** (phase/turn order/current player) is managed server-side under `room.customMetadata.rules`:

- `room.customMetadata.rules.gameState.phase` is the canonical phase (`'waiting'` = lobby, `'playing'` = in-game, `'ended'` = complete).
- `room.customMetadata.rules.hostProfileId` is the canonical "host/arbiter" identity (room creator).
- For turn-based games, `room.customMetadata.rules.gameState` also contains `turnOrder`, `currentPlayer`, and `turnCount`.

## How to Create a Multiplayer Game

### Step 1: Configure your game

Add rooms configuration to your `game.config.json`:

```json
{
  "rooms": {
    "gameType": "your-game-type",
    "matchmaking": {
      "enableAutoMatch": true,
      "maxSearchResults": 10
    },
    "createOptions": {
      "maxPlayers": 4
    }
  }
}
```

### Step 2: Create or join a room

```typescript
// Matchmaking: join existing or create new
const result = await RundotGameAPI.rooms.joinOrCreateRoomAsync({
  matchCriteria: { hasSpace: true },
  createOptions: { maxPlayers: 4, name: 'Game Room' },
})
```

### Step 3: Subscribe to updates

```typescript
let latestSnapshot = null

const unsubscribe = await RundotGameAPI.rooms.subscribeAsync(room, {
  onData(event) {
    latestSnapshot = event.roomData
    updateGameUI(latestSnapshot)
  },
  onMessages(event) {
    handleChatMessage(event.message)
  },
  onGameEvents(event) {
    handleMove(event.proposedMoveData)
  },
})
```

### Step 4: Implement ready-up and game start

```typescript
import type { RundotGamesRoomPayload } from '@series-inc/rundot-game-sdk/api'

// Player ready-up
await RundotGameAPI.rooms.proposeMoveAsync(room, {
  moveType: 'player_ready',
  gameSpecificState: { ready: true, readyAt: Date.now() },
})

// Host starts the game (only the room creator can start)
const myProfileId = RundotGameAPI.getProfile().id
const hostProfileId = latestSnapshot?.customMetadata?.rules?.hostProfileId

if (myProfileId === hostProfileId) {
  await RundotGameAPI.rooms.startRoomGameAsync(room, {
    gameConfig: { countdownMs: 3000 },
  })
}
```

### Step 5: Handle game moves

```typescript
// Propose a move
await RundotGameAPI.rooms.proposeMoveAsync(room, {
  gameSpecificState: { from: 'e2', to: 'e4' },
  moveType: 'piece_move',
  clientContext: { timestamp: Date.now() },
  clientProposalId: 'move_123',
})

// Validate a move (for peer-validated systems)
await RundotGameAPI.rooms.validateMoveAsync(room, move.proposedMoveId, {
  isValid: true,
  reason: null,
  validatorId: RundotGameAPI.getProfile().id,
})
```

### Step 6: Clean up on exit

```typescript
await RundotGameAPI.rooms.leaveRoomAsync(room)
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

Rooms config is delivered by the host during `INIT_SDK`. The SDK applies these defaults when you omit parameters.

### Minimal config (single game type)

```json
{
  "rooms": {
    "gameType": "chess"
  }
}
```

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

## Room Properties

`RundotGamesRoom` includes:
- `id`, `players`, `maxPlayers`, `gameType`
- `isPrivate`, `status`, `customMetadata`, `data`
- timestamps, and admin IDs

## Best Practices

- Treat `customMetadata.rules.gameState` as the canonical game lifecycle state
- Treat `customMetadata.rules.hostProfileId` as the canonical room host identity
- Always `unsubscribe()` and `leaveRoomAsync()` when a player exits to free slots
- Pair `proposeMoveAsync` and `validateMoveAsync` for peer-validated turn systems
- Fall back to authoritative arbitration on the server when needed
