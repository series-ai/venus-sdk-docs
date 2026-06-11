# Multiplayer API (BETA)

Server-authoritative real-time multiplayer rooms. Game logic runs on the server in a `GameRoom` class; clients connect via `ServerRoom` to exchange messages.

***

## Overview

The multiplayer system has two parts:

- **Server**: You write a `GameRoom` subclass that holds all game state and validates every action. The server is the single source of truth.
- **Client**: Players connect through `ServerRoom` and send typed messages.

```typescript
// Client: join by matchmaking or room code
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

Add `rundotMultiplayerPlugin` to your `vite.config.ts`. This builds your server room code, copies your multiplayer room-type config to `dist/`, and starts a local dev server for testing:

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
| `configPath` | `string` | auto-detected | Path to your room-type config. When omitted, the plugin checks `.rundot/realtime.config.json` first, then falls back to root `rooms.config.json` |
| `devPort` | `number` | `9001` | Port for the local dev server |
| `threaded` | `boolean` | `false` | Run dev rooms in Worker Threads |
| `maxBundleSize` | `number` | `5242880` | Max server bundle size in bytes (5 MB) |

### Room-type config

This config is a build-time map of room types to their `GameRoom` source files. It is bundled with your game build and uploaded to the version document when you `rundot deploy`; the server reads it to register your room types.

> **Not the same as the V1 `rooms` server-config key.** `.rundot/realtime.config.json` (V2) maps room types to room-class **source files**. The V1 `rooms` key inside your server-config blob (`.rundot/rooms.config.json` / `config.json`) controls matchmaking and room rules: a different, unrelated file. Don't conflate the two.

#### Recommended: `.rundot/realtime.config.json`

Place your room-type config at `.rundot/realtime.config.json`:

```
my-game/
├── .rundot/
│   └── realtime.config.json         ← room type → source file map (V2)
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

Each room's `file` path is resolved relative to the **project root**, not to the config file's directory; so paths like `src/rooms/TicTacToe.ts` stay the same when you move the file into `.rundot/`.

> Commit `.rundot/` to your repo: it's project config like `package.json`, not a build artifact. All three SDK tooling call sites (the Vite build plugin, the local dev server, and esbuild validation) check `.rundot/realtime.config.json` first, falling back to root `rooms.config.json`.

#### Also supported: legacy `rooms.config.json`

A standalone `rooms.config.json` at your project root keeps working indefinitely. Run `rundot migrate-config` (with `--dry-run` to preview) to move it into `.rundot/realtime.config.json` automatically.

<details>

<summary>Legacy root <code>rooms.config.json</code></summary>

```
my-game/
├── rooms.config.json                ← room type definitions (legacy location)
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

</details>

### Room type fields

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | *required* | Room type identifier used for matchmaking (e.g. `"tictactoe"`, `"lobby"`) |
| `file` | `string` | *required* | Path to the file exporting the `GameRoom` subclass, relative to project root |
| `export` | `string` | `"default"` | Named export of the `GameRoom` class |
| `singleton` | `boolean` | `false` | When true, only one room of this type exists. All players join the same room (no matchmaking). |
| `config` | `RoomConfig` | - | Room configuration overrides (see table below) |

For typed config authoring, the file shape is exported from `/mp-server` as `RoomsConfigFile` (`{ rooms: RoomTypeDefinition[] }`), where each entry is a `RoomTypeDefinition` with the fields above and `RoomConfig` is the per-room config below.

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
| `metadata` | `object` | - | Custom metadata passed to the room on creation |

A few of these are easy to confuse or overlook:

- **`idleTimeout` vs `reconnectTimeout`.** `idleTimeout` is how long an *empty* room lingers before it's disposed (default 300s). `reconnectTimeout` is how long a *single player's* slot is held after they disconnect (default 30s). Different scopes.
- **`startLocked`.** When `true`, the room begins locked: no joins until you call `this.unlock()`. Useful for staged lobbies where you open joins only after setup.
- **`metadata` typing.** Its type is `Record<string, unknown>`, so reads like `this.config.metadata?.mode` come back as `unknown` and need a cast or narrowing; they aren't auto-typed.

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

- **`P`**: A discriminated union of message types (the protocol). Every member must have a `{ type: string }` field. This union covers both client-to-server and server-to-client messages. The exported `Protocol` type (`type Protocol = { type: string }`, importable from `/mp-server`) is the constraint this union must satisfy.

```typescript
// Messages: discriminated union
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

The inbound message handed to `onGameMessage` is a `GameMessage<P>`:

```typescript
type GameMessage<P extends Protocol> = {
  sender: Player   // the player who sent it
  payload: P       // the typed message; switch on payload.type to narrow
}
```

Read `message.sender` and `message.payload`, and switch on `message.payload.type` (not `message.type`).

{% hint style="warning" %}
**Don't reuse the field name `type` inside your payload.** On the wire, `broadcast()` / `sendTo()` strip the `type` field and send the rest as `data`; inbound, the payload is reassembled as `{ ...data, type: msgType }`. A field literally named `type` inside your message data is overwritten by the message type, so it can't carry a second meaning. Name it something else (e.g. `kind`, `category`).
{% endhint %}

### Room context

Read-only context available on the room instance inside any hook:

| Property | Type | Description |
|---|---|---|
| `this.roomId` | `string` (readonly) | The room's unique identifier. Useful for logging or keying per-room data. |
| `this.roomType` | `string` (readonly) | The room type name from your room-type config (e.g. `"tictactoe"`). Branch on this in a shared room class that serves multiple game modes. |
| `this.config` | `Readonly<RoomConfig>` (readonly) | The room's resolved configuration: the [RoomConfig fields](#roomconfig-fields) merged with their defaults. This is the only way to read back values at runtime, including any `metadata` you set in the room-type config. |
| `this.players` | `ReadonlyMap<string, Player>` | All players currently in the room keyed by player id (see [Player object](#player-object)). Includes disconnected players still within the reconnect grace period; check `player.connected`. |
| `this.playerCount` | `number` | Number of players currently holding a slot (shorthand for `this.players.size`). Includes players who are disconnected but still within the reconnect grace period; filter on `player.connected` to count only connected players. |
| `this.locked` | `boolean` (readonly) | Whether the room is currently locked (no new joins). |

```typescript
onCreate() {
  this.log.info('Room created', { roomId: this.roomId, roomType: this.roomType })

  // Read back resolved config (including custom metadata)
  const mode = this.config.metadata?.mode ?? 'classic'
  if (this.roomType === 'party') this.startPartyMode()
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
| `onRestore(snapshot)` | Room is restored from a persisted snapshot (crash recovery). The snapshot contains everything returned by `getPersistState()`. Use it to manually restore your fields. |
| `onMigrate(snapshot, oldVersion)` | Room is restored but the bundle version changed. Migrate state between versions here. |

{% hint style="info" %}
`onRestore` and `onMigrate` are mutually exclusive. On restore, the harness calls `onMigrate(snapshot, oldVersion)` only when the persisted bundle version differs from the current bundle and you've defined `onMigrate`; otherwise it calls `onRestore(snapshot)`. Both receive the same `state` sub-object (everything `getPersistState()` returned), and clock timings are auto-restored after either hook runs.
{% endhint %}

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
// Lock: prevent new players from joining
this.lock()

// Unlock: allow new joins again
this.unlock()

// Kick a player (triggers onPlayerLeave with reason 'kick')
this.kick(playerId, 'inactivity')

// Reject a join (call inside onPlayerJoin; throws, so nothing after it runs)
this.reject({ reason: 'Room is full' })
```

`reject(options?: RejectOptions)` takes a single optional `{ reason?: string }` (`RejectOptions`, exported from `/mp-server`). `reason` is optional and defaults to `'Join rejected'`. Its return type is `never`: it throws a join-rejected error the harness catches, so any code after `this.reject(...)` is unreachable.

{% hint style="info" %}
`broadcast()`, `sendTo()`, `kick()`, `lock()`, `unlock()`, `reject()`, `save()`, and `getPersistState()` are all `protected`: callable only from inside your `GameRoom` subclass (always via `this.`), never from outside.
{% endhint %}

### Persistence

The default `getPersistState()` returns `{}` (nothing persisted). Override it to control what gets persisted for crash recovery:

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

// Snapshot all active timers (the harness uses this for crash recovery;
// you can call it to inspect or persist timer state yourself)
const snap = this.clock.snapshot() // ClockSnapshot
```

`snapshot()` returns a `ClockSnapshot` capturing every active timer:

```typescript
interface ClockSnapshot {
  timers: Array<{
    name: string         // the timer's name
    intervalMs: number   // interval (setInterval) or delay (setTimeout)
    repeat: boolean      // true for setInterval, false for setTimeout
    startedAt: number    // ms since epoch when the timer was registered
    remainingMs: number  // computed ms left until the next fire
  }>
}
```

`ClockSnapshot` is exported from `/mp-server`. Timers are automatically serialized and restored on crash recovery. In `onRestore`, re-register your timers with the same names; the harness adjusts their remaining time automatically so they resume where they left off rather than restarting from zero:

```typescript
onRestore(snapshot: Record<string, unknown>) {
  this.board = (snapshot.board as string[]) ?? []
  this.timeLeft = (snapshot.timeLeft as number) ?? 30
  // Re-register timers with the same names; harness adjusts remaining time
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
this.log.critical('Fatal room error', { error: 'something broke' })

// Create a child logger with additional context fields
const playerLog = this.log.child({ playerId: sender.id })
playerLog.info('Player action') // includes playerId in every entry
```

`child(extra: Record<string, unknown>): Logger` returns a **new** `Logger` that merges the parent's context with `extra` into every entry; it doesn't mutate the parent.

The five methods map to Cloud Logging severities: `debug` → `DEBUG`, `info` → `INFO`, `warn` → `WARNING`, `error` → `ERROR`, `critical` → `CRITICAL` (the `LogSeverity` type is exported from `/mp-server`). `error` and `critical` write to stderr; the other three write to stdout. Each emitted line is JSON with `severity`, `message`, an ISO `timestamp`, the logger's context (`roomId` / `roomType`), and your `data` object merged in.

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

All five properties are read-only on the `ServerRoom` interface: they reflect connection state and can't be set by the game.

| Property | Type | Description |
|---|---|---|
| `roomCode` | `string` (readonly) | Shareable 6-character room code (e.g. `"HX9KWR"`) |
| `playerId` | `string` (readonly) | The current player's ID |
| `locked` | `boolean` (readonly) | Whether the room is locked (no new joins) |
| `latency` | `number` (readonly) | Current latency in ms (round-trip / 2) |
| `connectionState` | `ConnectionState` (readonly) | `'connecting'`, `'connected'`, `'reconnecting'`, or `'disconnected'` |

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
    // player: ServerPlayer; avatarUrl may be undefined or null, guard before rendering
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
    // error is a plain string, not an Error object
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

All callbacks are optional: only register the ones you need. `onError` receives a plain error `string` (not an `Error` object).

The `player` passed to `onPlayerJoined` is a `ServerPlayer`:

| Property | Type | Description |
|---|---|---|
| `id` | `string` | The player's ID |
| `username` | `string` | Display name |
| `avatarUrl` | `string \| null` (optional) | Avatar URL; may be `undefined` or `null`, so guard before rendering an avatar |

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

- `allowReconnect` (default `true`) enables reconnection. When a player disconnects, their slot is held for `reconnectTimeout` seconds (default 30).
- While disconnected, `player.connected` is `false`. The player is still in `this.players`; they are only removed when the reconnect timeout expires (triggering `onPlayerLeave` with reason `'disconnect'`).

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
| `onReconnected` | Successfully reconnected; connection resumes |
| `onDisconnect` | Reconnection failed or timed out; connection is closed |

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

- **Use messages for all client updates**: broadcast game state changes via typed messages. Use `this.sendTo(player.id, ...)` inside `onPlayerJoin` to send initial state to new players.
- **Use typed messages**: define a discriminated union for `P` and switch on `payload.type` in `onGameMessage`. This gives you full type safety and autocompletion.
- **Handle disconnects gracefully**: check `player.connected` before time-sensitive logic. Skip disconnected players' turns rather than stalling the game.
- **Persist strategically**: use `this.save()` after critical state changes (game start, round end). Rely on `autoPersist` for routine saves.
- **Use the clock for timing**: prefer `this.clock.setInterval()` / `this.clock.setTimeout()` over raw `setInterval` / `setTimeout` for automatic cleanup and crash-recovery support.

## Migrating from the deprecated Rooms API

`RundotGameAPI.rooms` (Rooms V1) is **deprecated and unsupported**. Realtime
(`RundotGameAPI.realtime`) is the only supported multiplayer API. For roughly
half of the old surface, the "equivalent" is server-authoritative logic you
write inside your `GameRoom` class — not a drop-in function.

| Rooms V1 (deprecated) | Realtime path |
|---|---|
| `rooms.createRoomAsync` | `realtime.createRoom(roomType)` |
| `rooms.joinOrCreateRoomAsync` | `realtime.joinOrCreateRoom(roomType)` |
| `rooms.joinRoomByCodeAsync` | `realtime.joinRoomByCode(code)` |
| `rooms.leaveRoomAsync` | `room.leave()` |
| `rooms.subscribeAsync` | `room.on({ onMessage })` + your own message types |
| `rooms.sendRoomMessageAsync` | `room.send(message)` |
| `rooms.updateRoomDataAsync` / `getRoomDataAsync` | Hold state in your `GameRoom`; push via `broadcast()` |
| `rooms.proposeMoveAsync` / `validateMoveAsync` / `startRoomGameAsync` / `kickPlayerAsync` | Implement in your `GameRoom` (`onGameMessage`, lifecycle, `kick()`) |
| `rooms.getUserRoomsAsync` | Not yet available in realtime (planned) |

> Note: realtime `createRoom` / `joinOrCreateRoom` currently take only a `roomType` — V1
> `CreateRoomOptions` (e.g. `maxPlayers`) and `matchCriteria` are not accepted today; they map
> to your room config / `GameRoom`, or need Track B/WS-B6.
