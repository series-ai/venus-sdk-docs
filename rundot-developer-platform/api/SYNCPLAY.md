# Syncplay: Kinetix-backed deterministic multiplayer (BETA)

Syncplay supplies input authority, prediction, rollback, replay, late join,
secrets, and transport for a signed Kinetix simulation product. Kinetix owns the
simulation itself: state, RNG streams, mechanics, fixed ticks, checkpoints,
serialization, and checksums.

There is no creator-authored reducer or compatibility mode. Games declare
mechanics as data, compile a Kinetix product, create a Kinetix runtime from that
product and the room's canonical session config, then pass the runtime to the
single Syncplay session factory.

## 1. Declare a Kinetix project

```typescript
import { defineKinetixProject } from '@series-inc/rundot-kinetix/authoring'

export const racingProject = defineKinetixProject({
  id: 'racing',
  installedProfile: 'fixed-1000-3d',
  tickRate: 30,
  inputSchema: { id: 'racing-input/v1' },
  sessionConfigSchema: {
    id: 'racing-session/v1',
    version: 1,
    maxBytes: 65536,
    fields: {
      playerCount: { type: 'integer', min: 1, max: 8 },
      track: { type: 'string', maxBytes: 60000 },
    },
  },
  mechanics: [],
  components: [],
  systems: [],
  presentationBindings: [],
})
```

The declaration is canonical data. Functions and classes are rejected. Public
match initialization—player count, mode, seed, encoded track—belongs in bounded
session config, not in the mechanics product. Two rooms can therefore share one
signed runtime identity while having different config digests.

## 2. Construct the runtime and session

```typescript
import {
  createFixed1000Runtime,
  encodeKinetixSessionConfig,
} from '@series-inc/rundot-kinetix/runtime'
import { createSyncplaySession } from '@series-inc/rundot-game-sdk/syncplay/creator'

const sessionConfigBytes = encodeKinetixSessionConfig(
  racingProject.sessionConfigSchema,
  { playerCount: 4, track: encodedTrack },
)

const runtime = createFixed1000Runtime({
  product: racingProduct,
  sessionConfigBytes,
})

const session = createSyncplaySession(runtime, {
  playerCount: 4,
  defaultInput: { throttle: 0, steer: 0, brake: false },
  snapshotBufferSize: 256,
  checksumIntervalFrames: 30,
})
```

`createSyncplaySession(runtime, policy)` accepts a constructed Kinetix runtime
only. The policy controls input defaults, checksum cadence, checkpoint retention,
and presentation callbacks. It cannot supply initial state, a reducer, a random
seed, or a simulation callback.

Live stepping and rollback use opaque checkpoint handles. Serialization and
hydration happen only for explicit v2 promotion/late-join transfer. A v2 snapshot
contains opaque runtime bytes plus runtime identity, session-config digest,
frame, and checksum; every field is checked before the destination mutates.

## 3. Go multiplayer

```typescript
import {
  createNetworkedSyncplayClient,
  createSyncplayRoom,
  quickMatchSyncplayRoom,
  joinSyncplayRoomByCode,
} from '@series-inc/rundot-game-sdk/syncplay/browser'

const room = await createSyncplayRoom(multiplayerApi, {
  maxPlayers: 4,
  runtimeIdentity: runtime.identity,
  sessionConfigBytes: runtime.sessionConfigBytes(),
  sessionConfigDigest: runtime.sessionConfigDigest,
})

const client = createNetworkedSyncplayClient({
  transport: room,
  runtimeFactory: (identity, configBytes) => loadSignedRuntime(identity, configBytes),
  localInputForTick: readControls,
})
```

Create and quick match carry runtime identity and config. Matchmaking always
isolates engine identity and config digest. Joining by private code accepts no
replacement config: the joiner receives the room-owned bytes, verifies its
catalog-loaded signed product matches, and constructs frame 0 only after that
check. Reconnect and crash recovery repeat the exact bytes.

## Presentation

Rendering reads `session.getState()` or a game-owned read-only projection.
Rendering, interpolation, audio, and effects never mutate authoritative state.
Presentation callbacks run only after a runtime batch and Syncplay's internal
history have committed.

## Replays and late join

```typescript
import { verifyReplay } from '@series-inc/rundot-game-sdk/syncplay/creator'

const result = verifyReplay({
  replay,
  runtimeFactory: (identity, configBytes) => loadSignedRuntime(identity, configBytes),
  policy,
})
```

Replay v2 records runtime identity, canonical session-config bytes/digest,
inputs, authority commands, and checksums. Reducer replay v1 and snapshot v1 are
rejected; there is no migration decoder.

## Determinism and trust

- Only installed Kinetix mechanics execute authoritative gameplay.
- Runtime identity is compiler-derived and signed with the product.
- The authority orders inputs but does not invent runtime identity or config.
- A bogus room cannot recruit an honest client whose loaded signed pack differs.
- Optional hidden choices, random draws, decks, bags, and roles use
  [Syncplay Secret Systems](SYNCPLAY-SECRETS.md).

The Kinetix world runtime is a correctness/reference backend with deep-copy
checkpoints. The shared batched ABI is the insertion point for optimized JS,
WASM, or native backends without changing Syncplay.
