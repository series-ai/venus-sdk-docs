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

For long-lived shared worlds, seasons, a shared economy, authoritative state deltas, a turn loop, server-driven player transfers, cross-instance PvP matchmaking, and platform room chat, see the [Advanced Multiplayer API](ADVANCED-MULTIPLAYER.md).

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
| `configPath` | `string` | auto-detected | Path to your room-type config. When omitted, the plugin uses `rundot/realtime.config.json` |
| `devPort` | `number` | `9001` | Port for the local dev server |
| `threaded` | `boolean` | `false` | Run dev rooms in Worker Threads |
| `maxBundleSize` | `number` | `5242880` | Max server bundle size in bytes (5 MB) |

### Room-type config

This config is a build-time map of room types to their `GameRoom` source files. It is bundled with your game build and uploaded to the version document when you `rundot deploy`; the server reads it to register your room types.

#### Recommended: `rundot/realtime.config.json`

Place your room-type config at `rundot/realtime.config.json`:

```
my-game/
├── rundot/
│   └── realtime.config.json         ← room type → source file map
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

Each room's `file` path is resolved relative to the **project root**, not to the config file's directory; so paths like `src/rooms/TicTacToe.ts` stay the same when you move the file into `rundot/`.

> Commit `rundot/` to your repo: it's project config like `package.json`, not a build artifact. All three SDK tooling call sites (the Vite build plugin, the local dev server, and esbuild validation) check `rundot/realtime.config.json`.

> **One config for deterministic rooms.** A fileless entry in
> `rundot/realtime.config.json` is used by the local Vite authority, copied to
> `dist/rooms.config.json` during build, and derived into hosted-playground
> server config. Do not add `rundot/rooms.config.json`, a `GameRoom` subclass,
> or a server bundle for a deterministic room.

```json
{
  "rooms": [
    {
      "type": "deterministic",
      "deterministic": true,
      "config": { "maxPlayers": 2, "tickRateHz": 60 }
    }
  ]
}
```

> Keep `rundotMultiplayerPlugin()` in **both** serve and build config. On serve it
> starts the local deterministic authority with fake local profiles; on build it
> copies the fileless room config to `dist/rooms.config.json` and emits **no**
> `dist/server-bundle.js` when every room is deterministic. `rundotSyncplayPlugin`
> is a separate plugin with a different job — it statically certifies your
> simulation sources and does not run or emit room config.

### Room type fields

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | *required* | Room type identifier used for matchmaking (e.g. `"tictactoe"`, `"lobby"`) |
| `deterministic` | `boolean` | `false` | When true, the room runs on the built-in deterministic input authority (Syncplay). No `file`/`GameRoom` and no server bundle are required or emitted; only inputs cross the wire. |
| `file` | `string` | *required for server-authoritative rooms* | Path to the file exporting the `GameRoom` subclass, relative to project root. Omit it for `deterministic: true` rooms. |
| `export` | `string` | `"default"` | Named export of the `GameRoom` class |
| `singleton` | `boolean` | `false` | When true, only one room of this type exists. All players join the same room (no matchmaking). |
| `config` | `RoomConfig` | - | Room configuration overrides (see table below) |

For typed config authoring, the file shape is exported from `/mp-server` as `RoomsConfigFile` (`{ rooms: RoomTypeDefinition[] }`), where each entry is a `RoomTypeDefinition` with the fields above and `RoomConfig` is the per-room config below.

### RoomConfig fields

| Field | Type | Default | Description |
|---|---|---|---|
| `maxPlayers` | `number` | `10` | Maximum number of players allowed in the room |
| `idleTimeout` | `number` | `300` | Time in seconds before an empty room is disposed (5 min) |
| `autoPersist` | `boolean` | - | **Deprecated, ignored.** There is no automatic save; see [Persistence](#persistence). |
| `persistInterval` | `number` | - | **Deprecated, ignored.** The platform sets the write delay. |
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

You build the server side by authoring a class that `extends GameRoom`, in your own server file, and registering it in your [room-type config](#room-type-config). You never instantiate it yourself: the platform creates **one instance per active room** and runs it **on the server**, calling your lifecycle hooks (`onCreate`, `onPlayerJoin`, `onGameMessage`, `onPlayerLeave`, `onDispose`) as players join and play.

Inside those hooks, `this` is that room instance, and that is where **all** the room APIs live — `this.broadcast`, `this.sendTo`, `this.players`, `this.clock`, `this.log`, and `this.services`. They are server-side members of your subclass; you never call them from client code or from a bare top-level `import`.

```typescript
// On the server: author and export your room class
import { GameRoom, type GameMessage } from '@series-inc/rundot-game-sdk/mp-server'

export default class MyGame extends GameRoom<Messages> {
  onCreate() {
    // `this` is your room instance — the platform created it and runs it server-side
    this.broadcast({ type: 'ready' })
  }
}
```

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
| `onDispose(reason)` | Room is about to be destroyed. Final cleanup. `reason` says why, e.g. `'idle'` or `'close'`; see [Room closes](ADVANCED-MULTIPLAYER.md#room-closes). |
| `onCloseScheduled(remainingMs)` / `onCloseCancelled()` | Staff scheduled, or called off, a close of this room. See [Room closes](ADVANCED-MULTIPLAYER.md#room-closes). |
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
`broadcast()`, `sendTo()`, `kick()`, `lock()`, `unlock()`, `reject()`, `save()`, `saveCritical()`, and `getPersistState()` are all `protected`: callable only from inside your `GameRoom` subclass (always via `this.`), never from outside.
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

Call `this.save()` to queue a snapshot of `getPersistState()`. State is written only when you call `save()` and when the room closes; nothing saves on a timer.

What a save does and doesn't guarantee:

- **Delayed.** Saves are batched per room and the write lands about 5 seconds later. A later `save()` in that window replaces the earlier snapshot.
- **No confirmation.** `save()` returns nothing, and room code is never told whether the write succeeded. A write that keeps failing is dropped after 3 retries.
- **Recent changes can be lost.** If the server crashes or is killed, everything since the last completed write is lost, including state players already saw in a broadcast. A graceful shutdown or idle close writes a final snapshot first.
- **State only.** The snapshot is your `getPersistState()` object. Messages and commands aren't logged or replayed.

Don't treat a value as committed just because you called `save()`. Anything that must not be lost or granted twice, such as currency or items, belongs in a platform service like [simulation](#simulation), not only in room state. When you need to know a write landed, use [`saveCritical()`](#confirmed-saves-savecritical).

On crash recovery, `onRestore(snapshot)` is called with the persisted data. Use it to restore your fields:

```typescript
onRestore(snapshot: Record<string, unknown>) {
  this.board = (snapshot.board as string[]) ?? []
  this.currentTurn = (snapshot.currentTurn as 'X' | 'O') ?? 'X'
  this.moveHistory = (snapshot.moveHistory as typeof this.moveHistory) ?? []
}
```

The player list is not part of the snapshot. After a restore, every player still connected to the room joins it again, so `onPlayerJoin` runs for each of them on the restored room.

#### Confirmed saves: `saveCritical()`

`await this.saveCritical()` writes `getPersistState()` right away and resolves with the saved revision number once the write has committed. If nothing was saved, it rejects with a `SaveCriticalError` (exported from `/mp-server`). Its `reason` tells you why:

| `reason` | Meaning |
|---|---|
| `failed` | The write did not land, for example a storage error or state over the size limit. Nothing changed; you can call `saveCritical()` again. |
| `fenced` | Another server instance now runs this room, and this one's writes are refused from now on. |
| `stale` | A newer revision is already stored. |
| `timeout` | Storage did not confirm within 4 seconds. The write may still commit later, so treat the state as possibly saved. A later `saveCritical()` always uses a higher revision. |

```typescript
import { GameRoom, SaveCriticalError, type GameMessage } from '@series-inc/rundot-game-sdk/mp-server'

async onGameMessage(message: GameMessage<Messages>) {
  if (message.payload.type === 'endRound') {
    this.roundResults.push(this.scoreRound())
    try {
      await this.saveCritical()
      this.broadcast({ type: 'roundSaved' })
    } catch (err) {
      const reason = err instanceof SaveCriticalError ? err.reason : 'failed'
      this.log.error('round not saved', { reason })
    }
  }
}
```

Each call uses a higher revision than the room has stored before, including after a restore. The local dev server keeps nothing, so there `saveCritical()` always resolves.

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
| `id` | `string` (readonly) | Unique player identifier (profileId from RUN.world) |
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

### Platform services in your GameRoom

`this.services` is a server-side member of **your `GameRoom` subclass instance** — the same `this` as `this.broadcast`, `this.sendTo`, `this.players`, `this.save`, and `this.log` (see [how a GameRoom runs](#server-gameroom)). It exists only inside your room's hooks (`onCreate`, `onGameMessage`, `onPlayerJoin`, etc.), running on the server. It is **not** something you call from a client-side `import` of the SDK; there is no `this` outside the room class.

From inside any hook, `this.services` brokers calls to platform capabilities that can't run in the sandboxed room worker — notifications, UGC reads, game config, and simulation. Every call is async and brokered over the worker bridge, so `await` it. Leaderboard calls and `ugc.recordUse` aren't available from hosted rooms yet (see below).

```typescript
// inside your GameRoom subclass — `this` is the room instance, server-side
import { GameRoom, type Player } from '@series-inc/rundot-game-sdk/mp-server'

export default class MyGame extends GameRoom<Messages> {
  async onPlayerJoin(player: Player) {
    const config = await this.services.getGameConfig()
    this.maxRounds = (config.maxRounds as number) ?? 10
  }
}
```

#### Notifications

`this.services.notifications.send(request)` sends an offline push to specific room members via the inbox broker. Use it to reach members who aren't currently watching the room (e.g. it's their turn, or they were tagged):

```typescript
onGameMessage(message: GameMessage<Messages>) {
  if (message.payload.type === 'endTurn') {
    this.advanceTurn()
    const next = this.players.get(this.currentPlayerId)
    if (next && !next.connected) {
      this.services.notifications.send({
        recipientProfileIds: [next.id],
        template: 'your-turn',
        params: { room: this.roomId },
        fallbackTitle: "It's your turn",
        fallbackBody: `${message.sender.username} just played`,
      }).catch((err) => this.log.warn('notify failed', { code: (err as ServiceError).code }))
    }
  }
}
```

The `NotificationSendRequest` fields:

| Field | Type | Description |
|---|---|---|
| `recipientProfileIds` | `string[]` | Profile ids to notify. Each MUST be a current room member or the call rejects with `FORBIDDEN_NON_MEMBER`. |
| `template` | `string` | The notification template id to render. |
| `params` | `Record<string, string \| number>` (optional) | Substitution values for the template. |
| `data` | `Record<string, unknown>` (optional) | Arbitrary payload delivered with the notification. |
| `fallbackTitle` | `string` (optional) | Title used when the template can't render. |
| `fallbackBody` | `string` (optional) | Body used when the template can't render. |

#### Leaderboard

{% hint style="warning" %}
**Not available in hosted rooms yet.** On RUN servers, `submitScore` and `getTop` always reject with a `ServiceError` whose code is `NOT_AVAILABLE`. The local dev server mocks them, so they appear to work there. Submit scores from the client with the [Leaderboard API](LEADERBOARD.md) for now.
{% endhint %}

```typescript
// Submit a score (metadata optional)
await this.services.leaderboard.submitScore('weekly', score, { mode: 'ranked' })

// Read the top N entries
const top = await this.services.leaderboard.getTop('weekly', 10)
// top: Array<{ profileId: string; score: number; rank: number }>
```

`submitScore(leaderboardId: string, score: number, metadata?: Record<string, unknown>): Promise<void>` and `getTop(leaderboardId: string, limit: number)`.

#### UGC

```typescript
// Fetch a UGC record (null if it doesn't exist)
const item = await this.services.ugc.get(ugcId)

// Record that the room used a piece of UGC
await this.services.ugc.recordUse(ugcId)
```

`get(ugcId: string): Promise<Record<string, unknown> | null>` and `recordUse(ugcId: string): Promise<void>`.

`recordUse` isn't available in hosted rooms yet: on RUN servers it always rejects with `NOT_AVAILABLE`, though the local dev server mocks it. `get` works.

#### Game config

`this.services.getGameConfig(): Promise<Record<string, unknown>>` returns the game's server config for the room's `gameId`. Read it once in `onCreate` and cache the values you need.

#### Simulation

The simulation service runs every call on behalf of an acting player; the room maps the `playerId` you pass to that member's profile. Pass the acting member's id first (e.g. `message.sender.id`):

```typescript
// inside your GameRoom subclass — services live on `this`, server-side
async onGameMessage(message: GameMessage<Messages>) {
  if (message.payload.type === 'craft') {
    const result = await this.services.simulation.executeRecipe(message.sender.id, 'craft', {
      recipeInput: message.payload.input,
    })
    this.broadcast({ type: 'crafted', result })
  }
}
```

| Method | Signature |
|---|---|
| `getState` | `getState(playerId: string): Promise<Record<string, unknown>>` |
| `executeRecipe` | `executeRecipe(playerId: string, recipeId: string, input?: Record<string, unknown>, opts?: { idempotencyKey?: string }): Promise<Record<string, unknown>>` |
| `getActiveRuns` | `getActiveRuns(playerId: string): Promise<Array<Record<string, unknown>>>` |
| `getAvailableRecipes` | `getAvailableRecipes(playerId: string): Promise<Array<Record<string, unknown>>>` |
| `grantMeta` | `grantMeta(playerId: string, entityId: string, amount: number, opts?: { idempotencyKey?: string }): Promise<void>` — see [cross-season meta grants](ADVANCED-MULTIPLAYER.md#cross-season-meta-grants) |

Room code can run recipes marked [`serverOnly`](SIMULATION_CONFIG.md#recipe-fields); a player's client cannot. Mark the recipes that pay out rewards `serverOnly` and run them from the room, so a modified client can't call them directly.

##### Retry-safe rewards: `idempotencyKey`

A call that times out (`TIMEOUT`) may still have been applied, so retrying it blindly can pay out twice. Pass your own `idempotencyKey` to `executeRecipe` or `grantMeta` and retry with the same key: the platform applies the first call and answers every repeat with that first call's result, without running it again.

```typescript
const key = `quest:${questId}`
const reward = await this.services.simulation.executeRecipe(playerId, 'quest_reward', { questId }, { idempotencyKey: key })
```

- The key is scoped to **your game + that player**, not to the room. `quest:dragon` can be claimed once per player no matter which room grants it. To make a key per room, put the room id in it (`` `${this.roomId}:quest:dragon` ``).
- Keys are 1-128 characters of `A-Z a-z 0-9 _ - : .`. Anything else is refused with `HTTP_400`.
- A repeat that arrives while the first call is still running is refused with `HTTP_409` (`idempotency-key-in-progress`); retry it a moment later to get the result. If the server stopped mid-recipe, that hold lapses after 15 minutes and a retry runs the recipe again; anything the interrupted call already wrote stays, so keep reward recipes to a single grant where you can.
- A repeat doesn't run the recipe again. A `move_player` in the stored result is carried out only if the platform hasn't recorded that move as done, so a player is never moved twice by the same key.
- If the player has left the room since the first call, a repeat from that same room still resolves with the stored result. A player who isn't in the room can't start anything new: without a stored result the call fails with `FORBIDDEN_NON_MEMBER`.
- Reusing a key for a different recipe or entity is refused with `HTTP_409` (`idempotency-key-conflict`) instead of being silently skipped.
- If the recipe fails (a guard, missing inputs), the key is released, so a later call with the same key can still succeed.
- Without a key, every call applies, as before.

{% hint style="warning" %}
**Services fail fast.** Every `this.services.*` call rejects with a `ServiceError` on failure — there is no silent success and no fallback. The platform will not paper over a failed call: you decide the game behavior (log, retry, or surface to players). Wrap calls in `try/catch` and branch on `err.code`:

```typescript
try {
  await this.services.simulation.executeRecipe(message.sender.id, 'craft', input)
} catch (err) {
  const code = (err as ServiceError).code
  if (code === 'FORBIDDEN_NON_MEMBER') return // sender isn't a current member
  this.log.error('simulation failed', { code, message: (err as ServiceError).message })
  this.sendTo(message.sender.id, { type: 'error', text: 'Crafting failed, try again' })
}
```

`ServiceError` carries `.code` and `.message`. The codes a caller may see:

| Code | Meaning |
|---|---|
| `TIMEOUT` | The bridge request exceeded its timeout. |
| `NOT_AVAILABLE` | The services bridge is unavailable (e.g. running without it), or the method isn't available on the room server yet (`leaderboard.submitScore`, `leaderboard.getTop`, `ugc.recordUse`). |
| `INTERNAL_ERROR` | The brokered HTTP call failed server-side. |
| `HTTP_<status>` | The brokered HTTP call returned that status (e.g. `HTTP_404`, `HTTP_500`, or `HTTP_409` for an `idempotencyKey` still in progress or reused for a different call). |
| `INVALID_ARGUMENTS` | A call's arguments are malformed (e.g. a non-string `idempotencyKey`). No HTTP call is issued. |
| `UNKNOWN_SERVICE` | The requested service/method isn't routable. |
| `FORBIDDEN_NON_MEMBER` | A `recipientProfileId` (notifications) or `playerId` (player-scoped calls like simulation) is not a current member of the room. No HTTP call is issued. |
{% endhint %}

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

`createRoom` / `joinOrCreateRoom` accept an optional second argument:

```typescript
realtime.joinOrCreateRoom<MyProtocol>('ranked', {
  criteria: { mode: 'ranked', region: 'us' },      // only match rooms whose criteria agree
  createOptions: { maxPlayers: 4, isPrivate: false }, // applied if a new room is created
})
```

`criteria` filters matchmaking: a candidate room matches only when every key you pass equals the room's stored value. Omit `criteria` (or pass `{}`) to match any open room. `createOptions.maxPlayers` can only lower a room below its configured cap, never raise it; `criteria`/`createOptions` are ignored for singleton rooms.

### Listing your rooms

`getUserRooms(options?)` lists the rooms the authenticated player belongs to, returning `RealtimeRoomSummary[]`:

```typescript
const rooms = await RundotGameAPI.realtime.getUserRooms()
// Rejoin the most recent one by its code
if (rooms.length > 0) {
  const room = await RundotGameAPI.realtime.joinRoomByCode<MyProtocol>(rooms[0].roomCode)
}
```

Options (both optional):

| Option | Type | Description |
|---|---|---|
| `appId` | `string` | Filter to a specific app (defaults to the current app) |
| `includeDisposed` | `boolean` | Also include rooms with `status: 'disposed'` (default `false`) |

Each `RealtimeRoomSummary` includes `roomId`, `roomCode`, `roomType`, `appId`, `players`, `maxPlayers`, `isPrivate`, `status` (`'active' | 'disposed'`), `createdAt`, and `updatedAt`. Only standard rooms are listed — singleton rooms are not indexed.

### Room properties

Read-only properties on the `ServerRoom` interface that reflect room metadata and connection state:

| Property | Type | Description |
|---|---|---|
| `roomCode` | `string` (readonly) | Shareable 6-character room code (e.g. `"HX9KWR"`) |
| `playerId` | `string` (readonly) | The current player's ID |
| `players` | `readonly ServerPlayer[]` (readonly) | Authoritative current room roster with `id`, `username`, and optional `avatarUrl` |
| `maxPlayers` | `number` (readonly) | Effective server-enforced player capacity for this room |
| `isCreator` | `boolean` (readonly) | Whether this local player created the room |
| `locked` | `boolean` (readonly) | Whether the room is locked (no new joins) |
| `latency` | `number` (readonly) | Current latency in ms (round-trip / 2) |
| `connectionState` | `ConnectionState` (readonly) | `'connecting'`, `'connected'`, `'reconnecting'`, or `'disconnected'` |
| `pendingClose` | `{ closeAt: number } \| null` (readonly) | The close scheduled for this room, if any. See [Room closes](ADVANCED-MULTIPLAYER.md#room-closes) |

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
  onCloseScheduled({ closeAt }) {
    showCloseCountdown(closeAt)
  },
  onCloseCancelled() {
    hideCloseCountdown()
  },
  onEnded({ reason }) {
    showRoomEnded(reason)
  },
})
```

All callbacks are optional: only register the ones you need. The close events are covered in [Room closes](ADVANCED-MULTIPLAYER.md#room-closes), and `onEnded` in [When a room ends](ADVANCED-MULTIPLAYER.md#when-a-room-ends). `onError` receives a plain error `string` (not an `Error` object).

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

When a player's connection drops, the client puts them back in their seat on a new connection.

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

After a drop the client resumes the player's seat: it reconnects to the same server with a key the server handed it at join, and never mints a new ticket or joins another room. While it can't reach the server it retries with jittered exponential backoff, up to 10 times, each allowing the server 10 s to answer, so about two minutes in all. The server's first answer is final: the seat is back (`onReconnected`), or the session ended (`onEnded`, then `onDisconnect`). Long sessions are cut about once an hour, because the room server request timeout is 3600 s, and resume the same way.

A join refused because the room is hosted by another server instance, or is closing, or whose connection drops before the server confirms it, is retried up to 8 times with a fresh ticket and backoff, about 20 seconds in all.

The client fires connection events as the state changes:

| Event | When |
|---|---|
| `onReconnecting` | Connection dropped and the client is resuming the seat, or the room's server is recovering from a crash |
| `onReconnected` | The seat is back, or the room recovered; the room carries on |
| `onDisconnect` | The session ended; fires right after `onEnded` |
| `onEnded` | This player's session in the room ended (`reason`: `'closed'` or `'lost'`); the client doesn't resume it, and `onDisconnect` follows. Join again to keep playing; see [When a room ends](ADVANCED-MULTIPLAYER.md#when-a-room-ends) |

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
- **Persist strategically**: call `this.save()` after every state change you want to survive a crash (game start, round end, a player's progress), and `await this.saveCritical()` after changes you can't afford to lose. Nothing saves automatically between your calls.
- **Use the clock for timing**: prefer `this.clock.setInterval()` / `this.clock.setTimeout()` over raw `setInterval` / `setTimeout` for automatic cleanup and crash-recovery support.

## Common GameRoom patterns

Common multiplayer features are implemented directly in your `GameRoom` — the room is the source of truth, so there's no separate service to call.

### Chat / message history <a id="chat--message-history"></a>

Hold the history in room state, append on each inbound chat, and broadcast it. Replay it to late joiners in `onPlayerJoin`, persist it via `getPersistState()` so it survives crash recovery, and reach offline members via `this.services.notifications.send`:

```typescript
interface ChatEntry { senderId: string; username: string; text: string; at: number }
interface ChatMessage { type: 'chat'; text: string }
interface ChatHistory { type: 'chatHistory'; messages: ChatEntry[] }
type Messages = ChatMessage | ChatHistory

export default class ChatRoom extends GameRoom<Messages> {
  private messages: ChatEntry[] = []

  onPlayerJoin(player: Player) {
    // Replay history to the late joiner only
    this.sendTo(player.id, { type: 'chatHistory', messages: this.messages })
  }

  onGameMessage(message: GameMessage<Messages>) {
    if (message.payload.type === 'chat') {
      const entry: ChatEntry = {
        senderId: message.sender.id,
        username: message.sender.username,
        text: message.payload.text,
        at: Date.now(),
      }
      this.messages.push(entry)
      this.broadcast({ type: 'chatHistory', messages: [entry] })

      // Deliver to members who aren't currently connected
      const offline = [...this.players.values()].filter((p) => !p.connected).map((p) => p.id)
      if (offline.length > 0) {
        this.services.notifications.send({
          recipientProfileIds: offline,
          template: 'new-message',
          fallbackTitle: message.sender.username,
          fallbackBody: message.payload.text,
        }).catch((err) => this.log.warn('notify failed', { code: (err as ServiceError).code }))
      }
    }
  }

  protected getPersistState() {
    return { messages: this.messages }
  }

  onRestore(snapshot: Record<string, unknown>) {
    this.messages = (snapshot.messages as ChatEntry[]) ?? []
  }
}
```

### Proposed moves / turn validation

The room is the authority: validate the move in `onGameMessage`, reject invalid moves by simply not applying them (optionally `sendTo` the sender an error), advance the turn in room state, then `broadcast` the result. It all happens in a single handler — no external round-trip.

```typescript
interface MoveMessage { type: 'move'; cell: number }
interface MoveRejected { type: 'moveRejected'; reason: string }
interface BoardUpdate { type: 'boardUpdate'; board: string[]; currentTurn: string }
type Messages = MoveMessage | MoveRejected | BoardUpdate

export default class TurnGame extends GameRoom<Messages> {
  private board: string[] = Array(9).fill('')
  private currentTurn = '' // player id whose turn it is

  onGameMessage(message: GameMessage<Messages>) {
    if (message.payload.type !== 'move') return
    const { sender, payload } = message

    // Validate: right player, legal cell. Reject by not applying.
    if (sender.id !== this.currentTurn || this.board[payload.cell] !== '') {
      this.sendTo(sender.id, { type: 'moveRejected', reason: 'Invalid move' })
      return
    }

    this.board[payload.cell] = sender.username
    this.currentTurn = this.nextPlayerId(sender.id) // advance turn in room state
    this.broadcast({ type: 'boardUpdate', board: this.board, currentTurn: this.currentTurn })
  }
}
```

### Room data (key/value)

Hold shared key/value data as server-authoritative room state and push it to clients via `broadcast()`. The room state IS the shared data; clients are read-only observers.

```typescript
interface SetMode { type: 'setMode'; mode: string }
interface RoomState { type: 'roomState'; mode: string; round: number }
type Messages = SetMode | RoomState

export default class DataRoom extends GameRoom<Messages> {
  private mode = 'classic'
  private round = 0

  onGameMessage(message: GameMessage<Messages>) {
    if (message.payload.type === 'setMode') {
      // The room decides; clients can't write shared data directly
      this.mode = message.payload.mode
      this.broadcast({ type: 'roomState', mode: this.mode, round: this.round })
    }
  }
}
```

***

## Migrating from the deprecated Rooms API

The legacy turn-based **Rooms API** (`RundotGameAPI.rooms.*`, formerly
`VenusAPI.rooms.*` / `venus.rooms.*`) is deprecated. Everything it did is now
covered by realtime multiplayer — client room lifecycle moves to
`RundotGameAPI.realtime.*`, and the server-side data/turn/admin operations
become ordinary `GameRoom` patterns (the room is the source of truth, so there
is no separate room-data service to call). In-room simulation and notifications
move to the `this.services.*` bridge.

The table below maps each deprecated V1 capability to its replacement.

### Client room lifecycle → `RundotGameAPI.realtime.*`

| Deprecated V1 (`rooms.*`) | Replacement | Notes |
|---|---|---|
| `rooms.create(options)` | `realtime.createRoom(type, { createOptions })` | Pass `maxPlayers` / `isPrivate` via `createOptions`. |
| `rooms.join(roomId)` / join by code | `realtime.joinRoomByCode(code)` | Join a specific room by its 6-char code. |
| matchmaking / quick-join | `realtime.joinOrCreateRoom(type, { criteria, createOptions })` | Joins a matching open room or creates one (single-attempt, instance-local pairing). |
| PvP matchmaking / pairing | `realtime.matchmakeRoom(type, { criteria, createOptions })` | Cross-instance transactional pairing — two players are paired into one minted room even when they land on different server instances. Prefer this over `joinOrCreateRoom` for competitive PvP. |
| `rooms.getUserRooms()` | `realtime.getUserRooms(options?)` | Returns `RealtimeRoomSummary[]`. |
| `rooms.send(...)` / `sendMove` | `room.send(payload)` | Typed message; arrives server-side in `onGameMessage`. |
| `rooms.on(event, cb)` / `room.subscribe` | `room.on({ onMessage, onPlayerJoined, onPlayerLeft, ... })` | Register only the callbacks you need. |
| `rooms.leave()` | `room.leave()` | Triggers `onPlayerLeave` (reason `'leave'`) on the server. |

### Server-side room operations → `GameRoom` patterns

| Deprecated V1 | Replacement | Notes |
|---|---|---|
| `rooms.updateRoomData(key, value)` / `updateGameState` | hold the value in room state, then [`broadcast()`](#room-data-keyvalue) | The room owns shared data; clients are read-only observers. |
| `rooms.getRoomData()` | read from `broadcast()` payloads via `room.on({ onMessage })` | Clients observe state pushed by the room. |
| `room.proposeMove(room, payload)` | send a typed message; [validate + apply in `onGameMessage`](#proposed-moves--turn-validation) | Single handler, no external round-trip. |
| `room.validateMove()` | validation happens server-side in `onGameMessage` | Reject by not applying (optionally `sendTo` the sender an error). |
| `startGame()` | a custom message handled in `onGameMessage` that transitions room state, then `broadcast()` | Gate it to an admin/host in your handler. |
| `kick(playerId)` | `this.kick(playerId, reason?)` | Triggers `onPlayerLeave` with reason `'kick'`. |

### In-room simulation & notifications → `this.services.*`

| Deprecated V1 | Replacement | Notes |
|---|---|---|
| in-room simulation: recipes, **actors** (`create_actor`, `destroy_actor`, `ensure_actor`, `transform_actor`, `move_actor`, `get_room_actors`, `update_defense_actors`, `replace_room_actors`), `matchmaking`, `move_player`, graph | `this.services.simulation.executeRecipe(...)`, `getState`, `getAvailableRecipes` | Actor effects, `matchmaking`, and `move_player` (cross-room transfer) now run against the realtime simulation scope; `getState` returns the room's actors and `getAvailableRecipes` includes actor-gated recipes. Only `create_room` / `ensure_room` / `generate_graph` stay rejected — rooms are created via `realtime.*`, not a sim effect. |
| room notifications | `this.services.notifications.send({ recipientProfileIds, template, fallbackTitle, fallbackBody })` | Offline push to room members **and** now persisted to the recipient's in-app inbox as a first-class `room` notification (read / archive / per-game mute honored). |


***

## Room as Merge Authority (Collaborative Documents)

When building collaborative canvases, real-time shared editors, or multi-user state synchronization with `@series-inc/rundot-document`, your `GameRoom` acts as the authoritative merge arbiter.

### Architecture

1. **Client State**: Clients mutate local documents optimistically and stream document patch envelopes to the server via `room.send({ type: 'doc:patch', patch })` or `room.sendRaw()`.
2. **Server Arbiter**: The `GameRoom` receives patches, checks permissions, validates invariant integrity, and merges patches deterministically using `@series-inc/rundot-document`'s merge engine.
3. **Broadcast & Convergence**: Merged deltas are broadcast to all connected room members.

### Payload & State Size Limits

Room state is governed by strict payload boundaries:
- **Warning Threshold**: State payloads exceeding **800 KiB** trigger console and monitoring warnings.
- **Hard Limit**: State payloads have a hard ceiling of **1 MiB** (`STATE_HARD_LIMIT = 1024 * 1024` bytes). Exceeding 1 MiB causes message rejection or state push failures.
- **Payload Partitioning**: For large documents or shared worlds, do not send the entire document state in every tick or broadcast. Transmit sparse operational transforms or delta patches, and store coarse-grained world slices in persistent storage or cold snapshots.

### Cold State Promotion

Long-running rooms or rooms suspended between active sessions can promote their state to cold storage. Cold state promotion is **explicitly triggered** (via `promote.ts` / server administration workflows) rather than automatically running in an arbitrary background loop. When resuming or hydrating an archived room, retrieve the promoted base snapshot before applying real-time document deltas.
