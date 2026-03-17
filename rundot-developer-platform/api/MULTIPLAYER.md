# Multiplayer API (BETA)

Server-authoritative real-time multiplayer rooms. Game logic runs on the server in a `GameRoom` class; clients connect via `ServerRoom` to exchange messages.

***

## Overview

The multiplayer system has two parts:

- **Server** — You write a `GameRoom` subclass that holds all game state and validates every action. The server is the single source of truth.
- **Client** — Players connect through `ServerRoom` and send typed messages.

```typescript
// Client — join by matchmaking or room code
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
const room = await RundotGameAPI.realtime.joinOrCreateRoom<MyProtocol>('tictactoe')
const room = await RundotGameAPI.realtime.joinRoomByCode<MyProtocol>('HX9KWR')

// Server
import { GameRoom } from '@series-inc/rundot-game-sdk/mp-server'
export default class TicTacToe extends GameRoom<MyProtocol> { ... }
```

***

## Setup

### Vite plugin

Add `rundotMultiplayerPlugin` to your `vite.config.ts`. This builds your server room code, copies `rooms.config.json` to `dist/`, and starts a local dev server for testing:

```typescript
import { defineConfig } from 'vite'
import { rundotMultiplayerPlugin } from '@series-inc/rundot-game-sdk/vite'

export default defineConfig({
  plugins: [
    rundotMultiplayerPlugin(),
  ],
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `configPath` | `string` | `'rooms.config.json'` | Path to your rooms config file |
| `devPort` | `number` | `3001` | Port for the local dev server |
| `threaded` | `boolean` | `false` | Run dev rooms in Worker Threads |
| `maxBundleSize` | `number` | `5242880` | Max server bundle size in bytes (5 MB) |

### rooms.config.json

Room types are defined in a standalone `rooms.config.json` file at your project root (not the shared `config.json`):

```
my-game/
├── rooms.config.json                ← room type definitions
├── config.json                      ← other server config (leaderboard, etc.)
├── src/
│   └── rooms/
│       └── TicTacToe.ts             ← GameRoom subclass
├── dist/
└── package.json
```

```json
{
  "rooms": [
    {
      "type": "tictactoe",
      "file": "src/rooms/TicTacToe.ts",
      "config": {
        "maxPlayers": 2,
        "allowReconnect": true,
        "reconnectTimeout": 30
      }
    }
  ]
}
```

The file is uploaded with your game when you `rundot deploy`. The server reads it to register your room types.

### Room type fields

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | *required* | Room type identifier used for matchmaking (e.g. `"tictactoe"`, `"lobby"`) |
| `file` | `string` | *required* | Path to the file exporting the `GameRoom` subclass, relative to project root |
| `export` | `string` | `"default"` | Named export of the `GameRoom` class |
| `singleton` | `boolean` | `false` | When true, only one room of this type exists. All players join the same room (no matchmaking). |
| `config` | `RoomConfig` | — | Room configuration overrides (see table below) |

### RoomConfig fields

| Field | Type | Default | Description |
|---|---|---|---|
| `maxPlayers` | `number` | `10` | Maximum number of players allowed in the room |
| `idleTimeout` | `number` | `300` | Time in seconds before an empty room is disposed (5 min) |
| `autoPersist` | `boolean` | `true` | Whether to auto-persist state on a debounced interval |
| `persistInterval` | `number` | `5000` | Debounce interval for auto-persist in milliseconds |
| `allowReconnect` | `boolean` | `true` | Whether to allow reconnections after disconnect |
| `reconnectTimeout` | `number` | `30` | Time in seconds to hold a player slot for reconnection |
| `startLocked` | `boolean` | `false` | Whether the room starts locked (no new joins) |
| `metadata` | `object` | — | Custom metadata passed to the room on creation |

**Multi-room-type apps:** Add one entry per game mode:

```json
{
  "rooms": [
    { "type": "classic", "file": "src/rooms/Classic.ts" },
    { "type": "party", "file": "src/rooms/Party.ts", "config": { "maxPlayers": 8 } }
  ]
}
```

***

## Quick Start

### Server: TicTacToe room

```typescript
import { GameRoom, type GameMessage, type GameRoomProps } from '@series-inc/rundot-game-sdk/mp-server'
import type { Player, LeaveReason } from '@series-inc/rundot-game-sdk/mp-server'

// -- Messages --
interface MoveMessage { type: 'move'; position: number }
interface ChatMessage { type: 'chat'; text: string }
interface BoardUpdate { type: 'boardUpdate'; board: string[]; currentTurn: 'X' | 'O' }
type MyProtocol = MoveMessage | ChatMessage | BoardUpdate

export default class TicTacToe extends GameRoom<MyProtocol> {
  private board: string[] = Array(9).fill('')
  private currentTurn: 'X' | 'O' = 'X'

  onCreate() {
    this.log.info('Room created')
  }

  onPlayerJoin(player: Player) {
    this.log.info('Player joined', { id: player.id })
    if (this.playerCount >= 2) this.lock()
  }

  onGameMessage(message: GameMessage<MyProtocol>) {
    const { sender, payload } = message
    switch (payload.type) {
      case 'move':
        this.board[payload.position] = this.currentTurn
        this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X'
        this.broadcast({ type: 'boardUpdate', board: this.board, currentTurn: this.currentTurn })
        break
      case 'chat':
        this.broadcast({ type: 'chat', text: `${sender.username}: ${payload.text}` })
        break
    }
  }

  onPlayerLeave(player: Player, reason: LeaveReason) {
    this.log.info('Player left', { id: player.id, reason })
  }
}
```

### Client: connect and play

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Join or create a room
const room = await RundotGameAPI.realtime.joinOrCreateRoom<MyProtocol>('tictactoe')

// Listen for updates
room.on({
  onMessage(msg) {
    if (msg.type === 'boardUpdate') renderBoard(msg.board)
    if (msg.type === 'chat') showChat(msg.text)
  },
  onPlayerJoined(player) {
    console.log(`${player.username} joined`)
  },
  onPlayerLeft(playerId) {
    console.log(`Player ${playerId} left`)
  },
})

// Send a move
room.send({ type: 'move', position: 4 })

// Leave when done
room.leave()
```

***

## Server: GameRoom

### Defining messages

`GameRoom` takes one type parameter:

- **`P`** — A discriminated union of message types (the protocol). Every member must have a `{ type: string }` field. This union covers both client-to-server and server-to-client messages.

```typescript
// Messages — discriminated union
interface PlaceMessage { type: 'place'; x: number; y: number }
interface ForfeitMessage { type: 'forfeit' }
interface BoardUpdate { type: 'boardUpdate'; board: number[][]; scores: Record<string, number> }
type Messages = PlaceMessage | ForfeitMessage | BoardUpdate

export default class MyGame extends GameRoom<Messages> {
  private board: number[][] = []
  private scores: Record<string, number> = {}
  private phase: 'waiting' | 'playing' | 'ended' = 'waiting'
}
```

### Lifecycle hooks

All hooks are optional. They can be `async` or synchronous.

| Hook | When it's called |
|---|---|
| `onCreate()` | Room is first created. Initialize game data here. |
| `onPlayerJoin(player)` | A player requests to join. Call `this.reject()` to deny. |
| `onGameMessage(message)` | A player sends a typed message. `message.sender` is the player, `message.payload` is the typed message. Switch on `message.payload.type` to narrow. |
| `onPlayerLeave(player, reason)` | A player leaves. `reason` is `'leave'`, `'disconnect'`, or `'kick'`. |
| `onDispose()` | Room is about to be destroyed. Final cleanup. |
| `onRestore(snapshot)` | Room is restored from a persisted snapshot (crash recovery). State keys are auto-applied before this hook; use it to restore server-only data. |
| `onMigrate(snapshot, oldVersion)` | Room is restored but the bundle version changed. Migrate state between versions here. |

```typescript
onCreate() {
  this.board = Array(9).fill('')
  this.clock.setInterval('tick', () => this.onTick(), 1000)
}

onPlayerJoin(player: Player) {
  if (this.phase !== 'waiting') {
    this.reject({ reason: 'Game already started' })
  }
}

onGameMessage(message: GameMessage<Messages>) {
  switch (message.payload.type) {
    case 'place':
      this.handlePlace(message.sender, message.payload)
      break
    case 'forfeit':
      this.handleForfeit(message.sender)
      break
  }
}

onPlayerLeave(player: Player, reason: LeaveReason) {
  delete this.scores[player.id]
  this.broadcast({ type: 'boardUpdate', board: this.board, scores: this.scores })
}

onDispose() {
  this.log.info('Room disposed')
}
```

### Messaging

Send typed messages to clients (these arrive via `onMessage` / `onPrivateMessage` on the client):

```typescript
// Broadcast to all players
this.broadcast({ type: 'chat', text: 'Game starting!' })

// Send to a specific player
this.sendTo(playerId, { type: 'hint', text: 'Your turn' })
```

### Room control

```typescript
// Lock — prevent new players from joining
this.lock()

// Unlock — allow new joins again
this.unlock()

// Kick a player (triggers onPlayerLeave with reason 'kick')
this.kick(playerId, 'inactivity')

// Reject a join (call inside onPlayerJoin — throws, so nothing after it runs)
this.reject({ reason: 'Room is full' })
```

### Persistence

Override `getPersistState()` to control what gets persisted for crash recovery:

```typescript
private board: string[] = []
private currentTurn: 'X' | 'O' = 'X'
private moveHistory: Array<{ player: string; pos: number }> = []

protected getPersistState() {
  return {
    board: this.board,
    currentTurn: this.currentTurn,
    moveHistory: this.moveHistory,
  }
}
```

Call `this.save()` to immediately persist. With `autoPersist: true` (the default), state is also auto-saved on a debounced interval (`persistInterval`, default 5000ms).

On crash recovery, `onRestore(snapshot)` is called with the persisted data. Use it to restore your fields:

```typescript
onRestore(snapshot: Record<string, unknown>) {
  this.board = (snapshot.board as string[]) ?? []
  this.currentTurn = (snapshot.currentTurn as 'X' | 'O') ?? 'X'
  this.moveHistory = (snapshot.moveHistory as typeof this.moveHistory) ?? []
}
```

### Clock

Named timers with auto-cleanup and crash-recovery support:

```typescript
// Repeating interval
this.clock.setInterval('turnTimer', () => {
  this.timeLeft--
  if (this.timeLeft <= 0) this.endTurn()
  this.broadcast({ type: 'timerUpdate', timeLeft: this.timeLeft })
}, 1000)

// One-shot timeout
this.clock.setTimeout('gameStart', () => {
  this.phase = 'playing'
  this.broadcast({ type: 'phaseChange', phase: 'playing' })
}, 3000)

// Clear a timer
this.clock.clear('turnTimer')

// Check if a timer is active
this.clock.has('turnTimer') // boolean
```

Timers are automatically serialized and restored on crash recovery. In `onRestore`, re-register your timers with the same names — the harness adjusts their remaining time automatically so they resume where they left off rather than restarting from zero:

```typescript
onRestore(snapshot: Record<string, unknown>) {
  this.board = (snapshot.board as string[]) ?? []
  this.timeLeft = (snapshot.timeLeft as number) ?? 30
  // Re-register timers with the same names — harness adjusts remaining time
  this.clock.setInterval('turnTimer', () => this.onTick(), 1000)
  this.clock.setTimeout('gameStart', () => this.startGame(), 3000)
}
```

All timers are cleared automatically when the room is disposed.

### Logger

Structured logging available on `this.log`:

```typescript
this.log.info('Game started', { playerCount: this.playerCount })
this.log.warn('Invalid move attempted', { playerId: sender.id })
this.log.error('Unexpected state', { phase: this.phase })
this.log.debug('Processing message', { type: payload.type })
```

### Player object

The `Player` object is passed to lifecycle hooks and available via `this.players` (a `ReadonlyMap<string, Player>`):

| Property | Type | Description |
|---|---|---|
| `id` | `string` (readonly) | Unique player identifier (profileId from RUN.game) |
| `username` | `string` (readonly) | Display name |
| `avatarUrl` | `string \| null` (readonly) | Avatar URL, if available |
| `joinedAt` | `number` (readonly) | Timestamp when the player joined (ms since epoch) |
| `connected` | `boolean` | Whether the player is currently connected (updates on disconnect/reconnect) |

```typescript
// Iterate all players
for (const [id, player] of this.players) {
  if (!player.connected) continue
  this.sendTo(id, { type: 'ping' })
}

// Get player count
this.playerCount // shorthand for this.players.size
```

***

## Client: Connecting and Playing

### Creating and joining rooms

All methods return a `ServerRoom<P>` typed with your message union:

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Create a new room
const room = await RundotGameAPI.realtime.createRoom<MyProtocol>('tictactoe')

// Join by room code (the 6-char code, e.g. "HX9KWR")
const room = await RundotGameAPI.realtime.joinRoomByCode<MyProtocol>('HX9KWR')

// Matchmaking: join an existing room or create one
const room = await RundotGameAPI.realtime.joinOrCreateRoom<MyProtocol>('tictactoe')
```

### Room properties

| Property | Type | Description |
|---|---|---|
| `roomCode` | `string` | Shareable 6-character room code (e.g. `"HX9KWR"`) |
| `playerId` | `string` | The current player's ID |
| `locked` | `boolean` | Whether the room is locked (no new joins) |
| `latency` | `number` | Current latency in ms (round-trip / 2) |
| `connectionState` | `ConnectionState` | `'connecting'`, `'connected'`, `'reconnecting'`, or `'disconnected'` |

### Events

Register event handlers with `room.on()`:

```typescript
room.on({
  onMessage(message) {
    // Broadcast message from the server
    if (message.type === 'chat') showChat(message.text)
  },
  onPrivateMessage(message) {
    // Message sent only to this player (via sendTo on the server)
  },
  onPlayerJoined(player) {
    // player: { id, username, avatarUrl }
    showJoinNotification(player.username)
  },
  onPlayerLeft(playerId) {
    removePlayerFromUI(playerId)
  },
  onLock() {
    disableInviteButton()
  },
  onUnlock() {
    enableInviteButton()
  },
  onError(error) {
    showError(error)
  },
  onDisconnect() {
    showDisconnectedOverlay()
  },
  onReconnecting() {
    showReconnectingSpinner()
  },
  onReconnected() {
    hideReconnectingSpinner()
  },
})
```

All callbacks are optional — only register the ones you need.

### Sending messages

Send typed messages to the server room (arrives in `onGameMessage` on the server):

```typescript
room.send({ type: 'move', position: 4 })
room.send({ type: 'chat', text: 'Good game!' })
```

### Leaving

```typescript
room.leave()
```

This closes the connection and triggers `onPlayerLeave` on the server with reason `'leave'`.

### Server time

Get the estimated server time (local time adjusted by server offset):

```typescript
const serverNow = room.getServerTime() // ms since epoch
```

Useful for synchronized countdowns or time-based game logic.

***

## Reconnection

Players automatically reconnect with exponential backoff when the connection drops.

### Server-side

- `allowReconnect` (default `true`) — enables reconnection. When a player disconnects, their slot is held for `reconnectTimeout` seconds (default 30).
- While disconnected, `player.connected` is `false`. The player is still in `this.players` — they are only removed when the reconnect timeout expires (triggering `onPlayerLeave` with reason `'disconnect'`).

```typescript
onGameMessage(message: GameMessage<Messages>) {
  if (!message.sender.connected) return // ignore messages from disconnected players (shouldn't happen, but defensive)
  // ...
}
```

### Client-side

The client fires connection events as the state changes:

| Event | When |
|---|---|
| `onReconnecting` | Connection dropped, attempting to reconnect |
| `onReconnected` | Successfully reconnected — connection resumes |
| `onDisconnect` | Reconnection failed or timed out — connection is closed |

```typescript
room.on({
  onReconnecting() { showSpinner('Reconnecting...') },
  onReconnected() { hideSpinner() },
  onDisconnect() { showGameOver('Connection lost') },
})
```

Monitor the connection state at any time via `room.connectionState`:

```typescript
if (room.connectionState === 'reconnecting') {
  disableInput()
}
```

***

## Best Practices

- **Use messages for all client updates** — broadcast game state changes via typed messages. Use `onPlayerJoin` return values (`joinData`) to send initial state to new players.
- **Use typed messages** — define a discriminated union for `P` and switch on `payload.type` in `onGameMessage`. This gives you full type safety and autocompletion.
- **Handle disconnects gracefully** — check `player.connected` before time-sensitive logic. Skip disconnected players' turns rather than stalling the game.
- **Lock when full** — call `this.lock()` in `onPlayerJoin` when you have enough players to prevent extra joins during gameplay.
- **Persist strategically** — use `this.save()` after critical state changes (game start, round end). Rely on `autoPersist` for routine saves.
- **Use the clock for timing** — prefer `this.clock.setInterval()` / `this.clock.setTimeout()` over raw `setInterval` / `setTimeout` for automatic cleanup and crash-recovery support.
