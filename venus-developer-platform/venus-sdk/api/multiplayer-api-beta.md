# Multiplayer API (BETA)

## Venus Rooms API (BETA)

Build synchronous multiplayer sessions backed by the Venus Rooms service. Create or join rooms, listen for updates, and push authoritative state through a single interface.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const { action, room } = await VenusAPI.rooms.joinOrCreate({
  roomId: 'word-rush',
  metadata: { difficulty: 'hard' },
})

console.log(`Room ${action}:`, room.id)
```

### Subscriptions & Messaging

```typescript
const unsubscribe = VenusAPI.rooms.subscribeToRoom(room, {
  onData(event) {
    console.log('Room data changed:', event)
  },
  onMessages(event) {
    console.log('Chat:', event.message)
  },
  onGameEvents(event) {
    if (event.type === VenusAPI.RoomEvents.OPTIMISTIC_GAME_STATE_UPDATED) {
      reconcileOptimisticState(event.state)
    }
  },
})

await VenusAPI.rooms.sendRoomMessage(room, {
  type: 'game_action',
  payload: { action: 'move', x: 10, y: 20 },
})

await VenusAPI.rooms.updateRoomData(room, { score: 42 })
```

### Cleanup

```typescript
unsubscribe()
await VenusAPI.rooms.leaveRoom(room)
```

### Best Practices

* Treat room data as the single source of truth—sync UI from `onData` updates instead of local guesses.
* Use metadata to tag game modes or matchmaking preferences; keep payloads lean.
* Handle validator callbacks for turn-based games via `proposeMove` and `validateMove`.
* Remember this API is BETA; wrap calls defensively and expect schema refinements.
