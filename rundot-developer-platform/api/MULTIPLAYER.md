# Multiplayer API (BETA)

Build real-time multiplayer sessions backed by the RUN.game Rooms service. Create or join rooms, stream updates, and coordinate turn-based or free-form play.

## Setup: config.json

Multiplayer behavior is driven by the `rooms` key in your project's `config.json`. This file is uploaded with your game when you deploy — the server reads it to configure matchmaking, room creation defaults, turn-based rules, and more.

Add a `rooms` key to your `config.json`:

```json
{
  "rooms": {
    "gameType": "your-game-type",
    "minPlayers": 2,
    "maxPlayers": 4
  }
}
```

If you omit `rooms` entirely, the server applies sensible defaults (free-form, 1–4 players, no turn order). Every field below is optional — only set what you need to override.

### Full config reference

```json
{
  "rooms": {
    "gameType": "chess",
    "rulesPreset": "blitz_v1",
    "minPlayers": 2,
    "maxPlayers": 2,
    "playerRoles": ["white", "black"],
    "playerInitialization": "random",
    "matchmaking": {
      "defaultCriteria": {
        "hasSpace": true,
        "isPrivate": false
      }
    },
    "createOptions": {
      "maxPlayers": 2,
      "isPrivate": false,
      "customMetadata": {
        "timeControl": "blitz"
      }
    },
    "privateMatchDefaults": {
      "allowCustomCode": true,
      "createOptions": {
        "isPrivate": true,
        "maxPlayers": 4
      }
    },
    "defaultRules": {
      "turnBased": true,
      "allowedMessageTypes": {
        "playing": {
          "piece_move": { "requiredFields": ["from", "to"] },
          "resign": { "requiredFields": ["resignedBy"] }
        }
      }
    },
    "notifications": {
      "onTurnStart": {
        "title": "Your turn!",
        "body": "It's your move in {{roomName}}"
      },
      "onGameEnd": {
        "title": "Game over",
        "body": "{{winnerName}} won in {{roomName}}"
      }
    }
  }
}
```

### Config fields

| Field | Type | Default | Description |
|---|---|---|---|
| `gameType` | `string` | your app ID | Identifier used for matchmaking and room filtering |
| `rulesPreset` | `string` | `"default"` | Named preset for server-side rule sets |
| `minPlayers` | `number` | `1` | Minimum players required. When reached in a `waiting` room, the game **auto-starts** |
| `maxPlayers` | `number` | `4` | Maximum players allowed in a room |
| `playerRoles` | `string[]` | — | Roles assigned to players on game start (e.g., `["white", "black"]`) |
| `playerInitialization` | `string` | — | How roles are assigned: `"random"`, `"assigned"`, or `"first-come-first-served"` |
| `matchmaking` | `object` | — | Default criteria for `joinOrCreateRoomAsync` |
| `createOptions` | `object` | — | Default options merged into every `createRoomAsync` call |
| `privateMatchDefaults` | `object` | — | Defaults for private match creation. `allowCustomCode` enables custom room codes |
| `defaultRules` | `object` | — | Server-side validation rules (see below) |
| `notifications` | `object` | — | Push notification templates for turn start and game end |

### `defaultRules` fields

| Field | Type | Default | Description |
|---|---|---|---|
| `turnBased` | `boolean` | `false` | Whether the game enforces turn order |
| `minPlayers` | `number` | `1` | Minimum players for the rule engine |
| `maxPlayers` | `number` | `4` | Maximum players for the rule engine |
| `allowedMessageTypes` | `object` | — | Per-phase validation of move types. Keys are phases (`waiting`, `playing`, `ended`), values map move types to `{ requiredFields: string[] }` |

### Notification template variables

Templates in `notifications.onTurnStart` and `notifications.onGameEnd` support these variables:

`{{currentPlayerName}}`, `{{previousPlayerName}}`, `{{roomName}}`, `{{turnNumber}}`, `{{gameType}}`, `{{roomId}}`, `{{winnerName}}`, `{{endReason}}`, `{{finisherName}}`

---

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const result = await RundotGameAPI.rooms.joinOrCreateRoomAsync({
  matchCriteria: { hasSpace: true },
  createOptions: { maxPlayers: 4, name: 'Game Room' },
})

const unsubscribe = await RundotGameAPI.rooms.subscribeAsync(result.room, {
  onData(event) {
    console.log('Room updated:', event.roomData)
  },
})
```

---

## Game Lifecycle

Every room progresses through three phases, tracked in `room.customMetadata.rules.gameState.phase`:

**`waiting`** — Room is created, players join. The lobby phase.

**`playing`** — Game is in progress. Moves are proposed and validated.

**`ended`** — Game is complete. Winner and end reason are recorded.

### Auto-start

When the number of players in a `waiting` room reaches `minPlayers` from your config, the server **automatically starts the game**. This:
- Sets `phase` to `playing`
- Shuffles turn order (for turn-based games)
- Sets `currentPlayer` to the first player in the shuffled order
- Assigns `gameRole` from `playerRoles` if `playerInitialization` is configured

To disable auto-start, set `minPlayers` to a value higher than `maxPlayers` (or omit it to keep the default of `1`), then start manually with `startRoomGameAsync`.

### Manual start

Only the room creator (host) can manually start the game:

```typescript
const myProfileId = RundotGameAPI.getProfile().id
const hostProfileId = latestSnapshot?.customMetadata?.rules?.hostProfileId

if (myProfileId === hostProfileId) {
  await RundotGameAPI.rooms.startRoomGameAsync(room, {
    gameConfig: { countdownMs: 3000 },
    turnOrder: ['profileId_1', 'profileId_2'],
  })
}
```

If you provide `turnOrder`, it must be a permutation of the current players. If omitted, the server generates one automatically.

### Ending a game

The server detects game end when a proposed move includes `isGameOver: true` in `gameSpecificState`:

```typescript
await RundotGameAPI.rooms.proposeMoveAsync(room, {
  moveType: 'game_end',
  gameSpecificState: {
    isGameOver: true,
    winner: 'profileId_of_winner',
    endReason: 'checkmate',
  },
})
```

This sets `phase` to `ended`, records the `winner` and `endReason`, and dispatches the `onGameEnd` push notification if configured.

---

## Creating & Joining Rooms

```typescript
// Create a room explicitly
const room = await RundotGameAPI.rooms.createRoomAsync({
  maxPlayers: 4,
  gameType: 'chess',
  isPrivate: false,
  name: 'Epic Chess Match',
  customMetadata: { skillLevel: 'intermediate' },
  data: { turnDuration: 30 },
})

// Matchmaking: join an existing room or create a new one
const result = await RundotGameAPI.rooms.joinOrCreateRoomAsync({
  matchCriteria: { gameType: 'chess', hasSpace: true },
  createOptions: { maxPlayers: 2, name: 'Quick Match' },
})
// result: { action: 'joined' | 'created', room, playersJoined }

// Join by invite code (auto-generated 6-character alphanumeric code)
const room = await RundotGameAPI.rooms.joinRoomByCodeAsync('ABC123')

// List rooms you currently belong to
const rooms = await RundotGameAPI.rooms.getUserRoomsAsync({ includeArchived: false })
```

Parameters you pass to `createRoomAsync` and `joinOrCreateRoomAsync` are merged with the defaults from your `config.json`'s `rooms.createOptions`, so you only need to specify overrides.

---

## Real-Time Subscriptions

```typescript
const unsubscribe = await RundotGameAPI.rooms.subscribeAsync(room, {
  onData(event) {
    // Fires on any room document change (players, phase, game state, etc.)
    // event.roomData: full room snapshot
    updateGameUI(event.roomData)
  },
  onMessages(event) {
    // Fires for chat and broadcast messages
    // event.type: 'H5_ROOM_MESSAGE_RECEIVED' | 'H5_ROOM_MESSAGE_UPDATED' | 'H5_ROOM_MESSAGE_DELETED'
    // event.message: { id, senderId, type, content, metadata, timestamp }
    handleChatMessage(event.message)
  },
  onGameEvents(event) {
    // Fires when proposed moves are created or their validation status changes
    // event.proposedMoveData: { moveType, gameSpecificState, serverGenericValidationStatus, ... }
    // event.changeType: 'added' | 'modified' | 'removed'
    handleMove(event.proposedMoveData)
  },
})
```

Always unsubscribe when done:

```typescript
unsubscribe()
```

---

## Room Data & Messaging

```typescript
const roomData = await RundotGameAPI.rooms.getRoomDataAsync(room)

await RundotGameAPI.rooms.sendRoomMessageAsync(room, {
  message: { type: 'chat', text: 'Good game!' },
  metadata: { timestamp: Date.now() },
})
```

Room messages are for chat or lightweight event broadcasts. For game state changes, use `proposeMoveAsync` instead.

### Authoritative state

Game state is managed server-side under `room.customMetadata.rules`:

- `rules.gameState.phase` — canonical phase: `'waiting'`, `'playing'`, or `'ended'`
- `rules.hostProfileId` — the room creator's profile ID (only they can start the game or kick players)
- `rules.gameState.currentPlayer` — whose turn it is (turn-based games)
- `rules.gameState.turnOrder` — ordered list of profile IDs
- `rules.gameState.turnCount` — number of turns completed
- `rules.gameState.playerStates` — per-player state including `status`, `role`, `gameRole`, `joinedAt`

---

## Game Moves

### Proposing a move

```typescript
const result = await RundotGameAPI.rooms.proposeMoveAsync(room, {
  moveType: 'piece_move',
  gameSpecificState: { from: 'e2', to: 'e4' },
  clientContext: { timestamp: Date.now() },
  clientProposalId: 'move_123',
})
// result: { proposedMoveId: string }
```

The `gameSpecificState` is merged into the official game state when the server validates the move.

### Server-side validation

When a move is proposed, the server validates it automatically:

1. **Phase check** — game must be in `playing` phase
2. **Turn check** (turn-based games) — `currentPlayer` must match the proposer (resignations are exempt)
3. **Move type check** — if `allowedMessageTypes` is configured, the move type must be allowed for the current phase
4. **Resignation security** — for resignation moves, `resignedBy` must match the proposer's profile ID

Each proposed move carries validation statuses:
- `serverGenericValidationStatus`: `'pending'` | `'valid'` | `'invalid'`
- `serverCustomValidationStatus`: `'pending'` | `'valid'` | `'invalid'` | `'not_applicable'`
- `clientConsensusStatus`: `'pending'` | `'valid'` | `'disputed'` | `'superceded'`

For turn-based games, valid moves automatically advance `currentPlayer` to the next player in `turnOrder`.

### Optimistic state

When a move is proposed, the room document is immediately updated with `optimisticGameState` and `lastProposedMoveId` — before server validation completes. Use this for responsive UIs that show the proposed state while waiting for confirmation.

### Peer validation (optional)

For games that use client-side move validation in addition to server validation:

```typescript
await RundotGameAPI.rooms.validateMoveAsync(room, move.proposedMoveId, {
  isValid: true,
  reason: null,
  validatorId: RundotGameAPI.getProfile().id,
})
```

---

## Turn-Based Games

For turn-based games, set `defaultRules.turnBased` to `true` in your `config.json`:

```json
{
  "rooms": {
    "maxPlayers": 2,
    "playerRoles": ["white", "black"],
    "playerInitialization": "random",
    "defaultRules": {
      "turnBased": true
    }
  }
}
```

The server enforces turn order — only `currentPlayer` can propose moves. After each valid move, `currentPlayer` advances to the next player in `turnOrder` (wrapping around at the end).

```typescript
// Check if it's my turn
const gameState = latestSnapshot?.customMetadata?.rules?.gameState
const myProfileId = RundotGameAPI.getProfile().id

if (gameState?.currentPlayer === myProfileId) {
  await RundotGameAPI.rooms.proposeMoveAsync(room, {
    moveType: 'piece_move',
    gameSpecificState: { from: 'e2', to: 'e4' },
  })
}
```

---

## Room Management

### Kicking a player

Only the room creator can kick players:

```typescript
await RundotGameAPI.rooms.kickPlayerAsync(room, targetProfileId, {
  reason: 'inactivity',
})
```

Kicking a player removes them from the room and updates `turnOrder` / `currentPlayer` if needed.

### Leaving a room

```typescript
await RundotGameAPI.rooms.leaveRoomAsync(room)
unsubscribe()
```

Always call both `leaveRoomAsync` and your subscription's unsubscribe function when a player exits to free their slot.

---

## Push Notifications

Turn-based rooms can send push notifications when a turn advances or a game ends. Notifications are configured in `game.config.json` under `rooms.notifications` — no client code required.

### Configuration

```json
{
  "rooms": {
    "gameType": "chess",
    "notifications": {
      "onTurnStart": {
        "title": "Chess",
        "body": "It's your turn! {{previousPlayerName}} just moved."
      },
      "onGameEnd": {
        "title": "Chess — Game Over",
        "body": "{{finisherName}} won by {{endReason}}!"
      }
    }
  }
}
```

Both templates are optional. If omitted, no notifications are sent for that event.

### Template Variables

**`onTurnStart`** — sent to the next player after a turn advances:

| Variable | Description |
|---|---|
| `{{currentPlayerName}}` | Username of the player whose turn it is now |
| `{{previousPlayerName}}` | Username of the player who just moved |
| `{{roomName}}` | Room name |
| `{{turnNumber}}` | Current turn number (1-based) |
| `{{gameType}}` | Game type from room config |
| `{{roomId}}` | Room ID |

**`onGameEnd`** — sent to all players except the one who made the final move:

| Variable | Description |
|---|---|
| `{{winnerName}}` | Username of the winner (empty if draw) |
| `{{finisherName}}` | Username of the player who made the final move |
| `{{endReason}}` | End reason (e.g. `"checkmate"`, `"resignation"`, `"completed"`) |
| `{{roomName}}` | Room name |
| `{{gameType}}` | Game type from room config |
| `{{roomId}}` | Room ID |

### Behavior

- **Mutually exclusive:** A move that ends the game sends `onGameEnd` only, not `onTurnStart`.
- **Self-notification guard:** The player who made the move/ended the game is never notified.
- **Tap action:** Tapping the notification opens the game via `appId`. The `roomId` is delivered in `context.notificationParams.roomId` so your game can auto-join/resume the relevant room on launch.
- **No config = no notifications:** Omitting `notifications` entirely results in silent no-op.

## Room Properties

`RundotGameRoom` includes:

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique room identifier |
| `name` | `string` | Room display name |
| `players` | `string[]` | Profile IDs of current players |
| `maxPlayers` | `number` | Maximum players allowed |
| `gameType` | `string` | Game type identifier |
| `isPrivate` | `boolean` | Whether the room is hidden from public matchmaking |
| `status` | `string` | `'active'`, `'paused'`, or `'archived'` |
| `customMetadata` | `object` | Contains `rules` with game state, host ID, and more |
| `data` | `object` | Arbitrary key-value data attached to the room |
| `roomCode` | `string` | Auto-generated 6-character alphanumeric invite code |
| `admins` | `string[]` | Profile IDs of room admins |
| `createdBy` | `string` | Profile ID of the room creator |
| `createdAt` | `number` | Creation timestamp |
| `updatedAt` | `number` | Last update timestamp |
| `version` | `number` | Incremented on each room update |

---

## Environment Separation

Rooms are segregated by `versionTag` (e.g., `'production'` vs `'development'`). Rooms created during development never appear in production matchmaking, and vice versa.

---

## Best Practices

- Treat `customMetadata.rules.gameState` as the single source of truth for game lifecycle state
- Treat `customMetadata.rules.hostProfileId` as the canonical room host identity
- Always call both `unsubscribe()` and `leaveRoomAsync()` when a player exits
- Use `proposeMoveAsync` for all game state changes — not `sendRoomMessageAsync`
- Set `isGameOver: true` in your final move's `gameSpecificState` to properly end the game
- Configure `allowedMessageTypes` in `defaultRules` to restrict which move types are valid per phase
- Use `minPlayers` carefully — reaching it in a `waiting` room triggers auto-start
