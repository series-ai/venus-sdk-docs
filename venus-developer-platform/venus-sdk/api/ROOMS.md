# Venus Rooms API (BETA)

Build synchronous multiplayer sessions backed by the Venus Rooms service. Create or join rooms, stream updates in real time, and coordinate turn-based or free-form play.

> ⚠️ Rooms only work inside the Venus host environment. Local mock mode throws helpful errors instead of simulating networking.

## Creating & Joining Rooms

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

// Create a room explicitly
const createdRoom = await VenusAPI.rooms.createRoomAsync({
  maxPlayers: 4,
  gameType: 'chess',
  isPrivate: false,
  name: 'Epic Chess Match',
  customMetadata: { skillLevel: 'intermediate' },
  data: { turnDuration: 30 },
})

// Join or create via matchmaking defaults
const result = await VenusAPI.rooms.joinOrCreateRoomAsync({
  matchCriteria: { gameType: 'chess', hasSpace: true },
  createOptions: { maxPlayers: 2, name: 'Quick Match' },
})
// { action: 'joined' | 'created', room, playersJoined }

// Join by invite code
const room = await VenusAPI.rooms.joinRoomByCodeAsync('ABC123')

// List rooms you currently belong to
const rooms = await VenusAPI.rooms.getUserRoomsAsync({ includeArchived: false })
```

## Room Data & Messaging

```typescript
const roomData = await VenusAPI.rooms.getRoomDataAsync(room)

await VenusAPI.rooms.updateRoomDataAsync(
  room,
  { turn: 2, currentPlayer: 'player_456' },
  { merge: true },
)

await VenusAPI.rooms.sendRoomMessageAsync(room, {
  message: { type: 'chat', text: 'Good game!' },
  metadata: { timestamp: Date.now() },
})
```

Use room data for authoritative state (turn order, scores, board positions) and room messages for chat or lightweight event broadcasts.

## Real-Time Subscriptions

```typescript
const unsubscribe = await VenusAPI.rooms.subscribeAsync(room, {
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
await VenusAPI.rooms.leaveRoomAsync(room)
unsubscribe()
```

`onData` fires for authoritative room-state changes, `onMessages` for chat/game payloads, and `onGameEvents` for turn-based proposals.

## Turn-Based Game Flow

```typescript
await VenusAPI.rooms.startRoomGameAsync(room, {
  gameConfig: { turnDuration: 30, roundLimit: 10 },
  turnOrder: ['player_1', 'player_2'],
})

const move = await VenusAPI.rooms.proposeMoveAsync(room, {
  gameSpecificState: { from: 'e2', to: 'e4' },
  moveType: 'piece_move',
  clientContext: { timestamp: Date.now() },
  clientProposalId: 'move_123',
})

await VenusAPI.rooms.validateMoveAsync(room, move.proposedMoveId, {
  isValid: true,
  reason: null,
  validatorId: VenusAPI.getProfile().id,
})
```

## Configuration

Rooms config is delivered by the host during `INIT_SDK`. You don’t read `VenusAPI.config.rooms` directly—the SDK blocks that—and instead the Rooms APIs inject these defaults when you omit parameters.

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
- Configuration is host-provided; use `VenusAPI.rooms.*` methods and pass overrides only when needed.
- Per-call overrides take precedence over config defaults for that single call.

## Room Properties & Best Practices

`VenusRoom` includes `id`, `players`, `maxPlayers`, `gameType`, `isPrivate`, `status`, `customMetadata`, `data`, timestamps, and admin IDs.

- Mirror game state from `room.data`; avoid divergent local models.
- Use `customMetadata` for lobby settings and `data` for live gameplay state.
- Always `unsubscribe()` and `leaveRoomAsync()` when a player exits to free slots.
- Pair `proposeMoveAsync` and `validateMoveAsync` for peer-validated turn systems; fall back to authoritative arbitration on the server when needed.

