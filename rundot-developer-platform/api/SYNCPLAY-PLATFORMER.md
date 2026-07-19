# Syncplay: UGC platformer preset (BETA)

A copyable starting point for a deterministic, UGC-driven multiplayer platformer.
It composes the installed Kinetix platformer pack (data-authored mechanics), the
Syncplay session runner (one lifecycle for offline / co-op / networked play), and
the SDK's fileless deterministic room — no game-owned netcode, `GameRoom`
subclass, Docker, or auth emulator.

The full source lives in the repo at
`tests/platformer-preset-e2e/fixture`. It is exercised end-to-end by
`tests/platformer-preset-e2e/preset.test.ts`.

***

## Copy and install the preset

Copy the fixture, then rewrite the three in-repo `file:` dependencies to the
published packages so the local paths never escape:

```sh
cp -R tests/platformer-preset-e2e/fixture my-platformer
cd my-platformer
npm pkg set \
  'dependencies.@series-inc/rundot-game-sdk=latest' \
  'dependencies.@series-inc/rundot-kinetix=latest' \
  'dependencies.@series-inc/rundot-syncplay=latest'
npm install
npm run kinetix:check
npm run test:determinism
npm run test:mp
npm run build
```

Run those commands only after the coordinated release containing these APIs is
published. Until then the preset builds against the in-repo packages.

## Author pack and level data

Mechanics are **package-installed code configured by canonical data**. Author the
pack and level in `src/kinetix/project.ts`, then bake the derived product with
`npm run kinetix:generate`; `npm run kinetix:check` fails the build if the
checked-in `src/kinetix/product.generated.json` drifts from the source.

```ts
const pack = defineKinetixPlatformer2dPack(packData)
const levelBytes = encodeKinetixPlatformer2dLevel(level, { maxBytes: 102_400 })
const setup = createKinetixPlatformer2dSession({
  pack,
  levelEntryId: entry.id,
  levelBytes,
  playerCount: 2,
  seed: 7,
})
```

`setup.runtimeIdentity` binds the validated pack, the
`rundot.kinetix-platformer2d-js.v2` reducer ABI, and the pack's generated source
manifest. Changing pack data changes the runtime identity; changing level bytes
changes the session digest and level declaration but not the runtime identity.

***

## Schema reference

Every table below mirrors a schema constant in the shipped source. The constant
is named so a drift can be grepped: change the constant, grep this doc.

### Pack (`rundot.kinetix-platformer2d-pack.v2`)

Top-level keys are `KINETIX_PLATFORMER2D_PACK_FORMAT` plus the `packKeys` set
(`kinetix-platformer2d-runtime.mjs`): `format`, `tickRate`, `player`, `movement`,
`damage`, `match`, `abilities`. Validation is exact-key: an unknown or missing
key throws `KINETIX_PLATFORMER_PACK_INVALID`.

| Field | Constant | Type / range |
|---|---|---|
| `format` | `KINETIX_PLATFORMER2D_PACK_FORMAT` | `'rundot.kinetix-platformer2d-pack.v2'` |
| `tickRate` | — | one of `10 \| 20 \| 30 \| 60` |
| `player.halfWidth` / `.halfHeight` | `playerKeys` | positive finite |
| `player.maxHealth` | `playerKeys` | integer ≥ 1 |

`movement` is the union of `movementKeysV1` and `movementKeysV2` — all eleven v2
keys are **required** on a v2 pack:

| Field | Constant | Type / range |
|---|---|---|
| `gravity`, `maxFallSpeed`, `runAcceleration`, `runDeceleration`, `maxRunSpeed`, `jumpSpeed` | `movementKeysV1` | positive finite |
| `jumpCutGravityMultiplier` | `movementKeysV1` | finite ≥ 1 |
| `coyoteFrames`, `jumpBufferFrames` | `movementKeysV1` | integer ≥ 0 |
| `dropThroughFrames` | `movementKeysV1` | integer ≥ 1 |
| `crouchHalfHeight` | `movementKeysV2` | positive finite, **≤ `player.halfHeight`** |
| `climbSpeed` | `movementKeysV2` | positive finite |
| `swimGravity` | `movementKeysV2` | finite ≥ 0 (the one v2 movement number allowed to be 0) |
| `swimStrokeSpeed`, `maxSwimFallSpeed` | `movementKeysV2` | positive finite |
| `wallSlideSpeed`, `wallJumpSpeedX`, `wallJumpSpeedY` | `movementKeysV2` | positive finite |
| `groundPoundSpeed` | `movementKeysV2` | positive finite |
| `throwSpeedX`, `throwSpeedY` | `movementKeysV2` | positive finite |

| Field | Constant | Type / range |
|---|---|---|
| `damage.invulnerabilityFrames`, `.respawnFrames`, `.respawnGraceFrames` | `damageKeys` | integer ≥ 0 |
| `damage.stompBounceSpeed` | `damageKeys` | positive finite |
| `match.countdownFrames`, `.resultsFrames` | `matchKeys` | integer ≥ 0 |
| `match.goalMode` | `matchKeys` | `'any-player' \| 'all-players'` |
| `abilities.crouch`, `.groundPound`, `.wallJump`, `.climb`, `.swim`, `.carry` | `abilityKeys` | boolean |

**A v1 pack still validates.** `migrateKinetixPlatformer2dPack` runs first: it
swaps `format`, derives every v2 movement number from the v1 ones, sets
`damage.respawnGraceFrames: 30`, and turns **every ability off**. A v1 level under
a migrated v1 pack therefore simulates identically apart from the documented
edge-case fixes below. The derived numbers only become reachable once you opt an
ability in.

### Level (`rundot.kinetix-platformer2d-level.v2`)

Required keys are `requiredLevelKeys` (`kinetix-platformer2d-level.mjs`);
`optionalLevelKeys` are genuinely optional — **absent means the documented
default, and the key is not written into the canonical bytes**. That is precisely
what keeps a migrated v1 level byte-identical under v2, and what keeps the
102,400-byte budget available for level content. Read them through the accessor
functions rather than reaching for the property.

| Key | Constant | Required? | Shape / default | Accessor |
|---|---|---|---|---|
| `format` | `KINETIX_PLATFORMER2D_LEVEL_FORMAT` | yes | `'rundot.kinetix-platformer2d-level.v2'` | — |
| `playerCapacity` | `requiredLevelKeys` | yes | integer in `[1, 128]` | — |
| `tileGrid` | `requiredLevelKeys` | yes | see below | — |
| `entities` | `requiredLevelKeys` | yes | array, registry-validated | — |
| `openBounds` | `optionalLevelKeys` | no | boolean, **default `false`** | `kinetixPlatformer2dLevelOpenBounds(level)` |
| `slopeTiles` | `optionalLevelKeys` | no | `[{ tileId, dir }]`, **default `[]`** | `kinetixPlatformer2dLevelSlopeTiles(level)` |
| `breakableTileIds` | `optionalLevelKeys` | no | sorted unique ids, **default `[]`** | `kinetixPlatformer2dLevelBreakableTileIds(level)` |
| `bonusBlocks` | `optionalLevelKeys` | no | `[{ x, y, contents, count }]`, **default `[]`** | `kinetixPlatformer2dLevelBonusBlocks(level)` |

`tileGrid` keys are the `gridKeys` set, exact:

| Field | Type / rule |
|---|---|
| `width`, `height`, `tileSize` | positive integers; `width*height`, `width*tileSize`, `height*tileSize` must stay safe integers |
| `tilesBase64` | canonically-padded base64; decodes to exactly `width * height` bytes (one tile id per cell) |
| `solidTileIds` | array of integers in `[1, 255]`, unique, **sorted ascending** |

Optional collection rules:

| Collection | Rule |
|---|---|
| `slopeTiles[].tileId` | integer `[1, 255]`, unique, sorted ascending, **disjoint from `solidTileIds`** (slope cells are resolved by the slope query, not the generic solid resolver) |
| `slopeTiles[].dir` | `'up-right' \| 'up-left'` |
| `breakableTileIds` | sorted unique integers `[1, 255]`, each **must also appear in `solidTileIds`** (solid until broken) |
| `bonusBlocks[].x/.y` | grid coordinates in range; one block per cell; the cell must already hold a solid tile |
| `bonusBlocks[].contents` | `'coin' \| 'heal' \| 'maxHealthUp' \| 'doubleJump' \| 'random'` |
| `bonusBlocks[].count` | integer in `[1, 99]` |
| `bonusBlocks` order | sorted by `(y, x)` |

Tile id **255** is reserved: `KINETIX_PLATFORMER2D_SPENT_TILE_ID`. A bonus block
that has given up its last contents flips its cell to 255, which is always solid.

### Entity vocabulary

Nineteen built-in types, defined once as `BUILT_IN` descriptors in
`kinetix-platformer2d-registry.mjs` and exported as
`kinetixPlatformer2dBuiltInEntityTypes`. Validation is **exact-key**: an entity
carrying an unlisted key, or missing a listed one, fails with a JSON-pointer path.

Every entity has `id` (matching `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`, unique
level-wide) and `type`. Geometry is either `point` (`x`, `y`) or `waypoints`
(`waypoints: [{x, y}, …]`, at least 2); both carry `halfWidth`/`halfHeight`
except `spawn`, which has no extent. Positions are validated to keep the entity's
bounds inside `[0, width*tileSize] × [0, height*tileSize]`.

| Type | Geometry | Extra fields |
|---|---|---|
| `spawn` | point (no extent) | `slot` integer `[0, 127]` |
| `oneWayPlatform` | point | — |
| `movingPlatform` | waypoints | `framesPerLeg` integer ≥ 1 |
| `fallingPlatform` | point | `triggerDelayFrames` ≥ 0, `resetFrames` ≥ 1 |
| `hazard` | point | `damage` integer `[1, 1024]` |
| `stompable` | point | `respawnFrames` integer `[0, 1e6]` |
| `goalTrigger` | point | — |
| `patrolEnemy` | point | `speed` `[0, 1e5]`, `turnAtLedge` boolean, `damage`, `respawnFrames` |
| `waypointEnemy` | waypoints | `framesPerLeg`, `damage`, `respawnFrames` |
| `movingHazard` | waypoints | `framesPerLeg`, `damage` |
| `spring` | point | `launchSpeed` number `[1, 1e5]` |
| `conveyor` | point | `beltSpeed` number `[-1e5, 1e5]` (sign = direction) |
| `checkpoint` | point | — |
| `coin` | point | — |
| `powerUp` | point | `kind: 'heal' \| 'maxHealthUp' \| 'doubleJump'` |
| `carryItem` | point | `damage` |
| `warpPipe` | point | `targetId` — must name **another** `warpPipe` that points back (pairs are bidirectional and validated) |
| `climbRegion` | point | — (covers ladders and ropes) |
| `waterRegion` | point | — (swimming) |

Level-wide invariants: `spawn` slots must be exactly `0 … playerCapacity-1`, each
once; every `warpPipe` must resolve to a distinct, reciprocal partner.

### Mechanics behaviour notes

Behaviour that is not obvious from the field list:

| Mechanic | Behaviour |
|---|---|
| Patrol enemy | Gravity-integrated body; walks `speed` in its facing direction, reverses on solid-wall contact; with `turnAtLedge`, also reverses when the cell under the leading edge is neither solid nor a slope. Stompable from above; otherwise deals `damage`. |
| Waypoint enemy / moving hazard | Ping-pong waypoint interpolation at `framesPerLeg` per leg (no endpoint duplication, same rule as `movingPlatform`). The enemy is stompable, the hazard is not. |
| Spring | Contact from above sets `vy = -launchSpeed`, clears the jump buffer and any ground-pound, and emits `spring.launch` once — it does not retrigger while the overlap persists (tracked per-spring in `engagedSlots`). |
| Conveyor | Behaves as a top-only platform; a grounded rider is displaced by `beltSpeed / tickRate` per frame (carried, not accelerated). |
| Checkpoint | First overlap per player sets `checkpointId` and emits `checkpoint.activate`; respawn uses the checkpoint position when set, else the slot's `spawn`. |
| Coin | `coins += 1`, `score += 100`, `coin.collect`; collected for the rest of the match. |
| Power-up | `heal` → full health; `maxHealthUp` → `maxHealth` and `health` both +1; `doubleJump` → `doubleJumpCharges = 1` (spent on a mid-air jump, restored on landing). |
| Carry item | Requires `abilities.carry`. `actionPressed` while grounded and overlapping picks up; `actionPressed` again throws at `(facing * throwSpeedX, -throwSpeedY)`. A thrown item that hits a live enemy defeats it (`enemy.defeat`) and comes to rest. |
| Warp pipe | `crouchHeld` while grounded on a pipe's top face for **20 consecutive frames** teleports to the paired pipe, with **30 frames** of emergence invulnerability and cooldown. |
| Climb region | Requires `abilities.climb`. `moveY ≠ 0` while overlapping enters climbing: gravity off, velocity is `move * climbSpeed` on both axes; a jump exits with a normal jump; leaving the region exits. |
| Water region | Requires `abilities.swim`. Gravity becomes `swimGravity`, fall is capped at `maxSwimFallSpeed`, `jumpPressed` is an unlimited stroke to `-swimStrokeSpeed`. Entering water cancels a ground-pound. |
| Bonus block | Head contact with a bonus cell decrements `count` and emits `block.hit` with the resolved contents. `coin` credits immediately; a power-up spawns one tile above; `random` draws uniformly from `['coin','heal','maxHealthUp','doubleJump']` via the seeded RNG. At `count === 0` the cell becomes tile 255 (spent, still solid). |
| Breakable tile | Head contact, or a ground-pound landing, sets the cell to 0 and emits `block.break`. One cell per contact; no chaining. |
| Slope tile | 45° surface. Slope ids are excluded from `solidTileIds` and resolved by a dedicated surface query, so a grounded player tracks `surfaceY(x)` instead of re-falling each frame. |
| Crouch | Requires `abilities.crouch`. Grounded + `crouchHeld` shrinks the hitbox to `crouchHalfHeight` **toward the feet** (`y` is compensated) and halves run speed. Standing up is blocked while a solid tile overlaps the standing AABB. |
| Ground-pound | Requires `abilities.groundPound`. `crouchHeld` while airborne zeroes `vx` and sets `vy = groundPoundSpeed`; on landing it breaks breakable tiles under the player and emits `player.groundPound`. |
| Wall jump | Requires `abilities.wallJump`. Pressing into a wall while falling caps descent at `wallSlideSpeed`; a jump within the wall-coyote window launches `(-wallDirection * wallJumpSpeedX, -wallJumpSpeedY)` and flips facing. `wallJumpLock` prevents re-jumping the same wall until you leave it or land. |
| World bounds | With `openBounds: false` (the default) the level has implicit solid walls at `x = 0` and `x = width*tileSize`; they are wall-jumpable. The ceiling stays open; the bottom death plane is unchanged. |
| RNG | `state.rng` is an xorshift32 word seeded from `session.seed >>> 0` (0 falls back to `0x6d2b79f5`), stepped exactly like Syncplay's `DeterministicRandom`. It lives **inside checkpointed state**, so it is rollback- and hydration-safe by construction. |

### Gameplay edge-case fixes in v2

1. `dropPressed` engages drop-through only on top-only ground
   (`oneWayPlatform`/`movingPlatform`/`fallingPlatform`/`conveyor`) and no longer
   vetoes a buffered jump when the player is standing on solid tile.
2. A respawned stompable or enemy gets `damage.respawnGraceFrames` (v1-migration
   default 30) during which it cannot damage a player standing inside it.
3. `finished` is sticky: dying after reaching the goal does not un-finish you, and
   `all-players` counts every seated player including one currently respawning.
4. `respawnFrames: 0` keeps its v1 meaning — **never respawn**.

### Input (`inputSchema`)

Exactly seven keys, exact-key validated; anything else throws
`KINETIX_PLATFORMER_INPUT_INVALID`.

| Field | Constant | Type |
|---|---|---|
| `moveX` | `inputSchema` | integer `-1 \| 0 \| 1` |
| `moveY` | `inputSchema` | integer `-1 \| 0 \| 1` |
| `jumpPressed` | `inputSchema` | boolean |
| `jumpHeld` | `inputSchema` | boolean |
| `dropPressed` | `inputSchema` | boolean |
| `actionPressed` | `inputSchema` | boolean |
| `crouchHeld` | `inputSchema` | boolean |

Ground-pound has no dedicated bit: it is `crouchHeld` while airborne with
`abilities.groundPound` on.

Derive the wire codec from the same shape instead of hand-writing one — see
[Safe input codecs](#safe-input-codecs).

### Session config (`kinetixPlatformer2dSessionConfigSchema`)

Schema id `rundot.kinetix-platformer2d-session.v1`, version 1, **512 canonical
bytes max**.

| Field | Type / range |
|---|---|
| `levelByteLength` | integer `[1, 102_400]` |
| `levelDigest` | string ≤ 64 bytes (sha256 hex) |
| `levelEntryId` | string ≤ 128 bytes |
| `playerCount` | integer `[1, 128]` |
| `seed` | integer `[0, 4_294_967_295]` |

***

## Event vocabulary

The reducer emits records shaped
`{ eventId, frame, sequence, payload, predictionState: 'synced', dedupeKey, notHashedKeys: [], deliveryScope: 'all' }`.
`dedupeKey` is `` `${eventId}:${frame}:${key}` `` where `key` is the payload's
`slot`, else `entityId`, else `playerSlot`, else `platformId`, else `''`.

| `eventId` | Payload | Emitted when |
|---|---|---|
| `match.started` | `{}` | countdown elapses |
| `match.ended` | `{ goalMode }` | the goal condition is satisfied |
| `player.jump` | `{ slot, data: { source } }` | `source` is `grounded \| coyote \| buffered \| climb \| swim \| wall \| double` |
| `player.damage` | `{ slot, entityId, data: { amount, health } }` | damage lands (invulnerability respected) |
| `player.death` | `{ slot }` | health reaches 0 or the player falls past the death plane |
| `player.respawn` | `{ slot }` | respawn timer completes |
| `player.finish` | `{ slot, entityId }` | first goal-trigger overlap (sticky) |
| `player.groundPound` | `{ slot }` | a ground-pound lands |
| `platform.falling` | `{ platformId }` | a falling platform's trigger delay elapses |
| `platform.dropThrough` | `{ playerSlot, platformId }` | drop-through engages |
| `enemy.stomp` | `{ slot, entityId }` | a stompable or enemy is stomped |
| `enemy.defeat` | `{ entityId, sourceId }` | a thrown carry item defeats an enemy |
| `spring.launch` | `{ slot, entityId }` | spring launches a player |
| `checkpoint.activate` | `{ slot, entityId }` | first checkpoint overlap per player |
| `coin.collect` | `{ slot, entityId }` | coin collected (`entityId` is `null` for a bonus-block coin) |
| `powerUp.collect` | `{ slot, entityId, data: { kind } }` | power-up collected |
| `item.pickup` | `{ slot, entityId }` | carry item picked up |
| `item.throw` | `{ slot, entityId }` | carry item thrown |
| `block.hit` | `{ slot, data: { x, y, contents } }` | bonus block hit from below |
| `block.break` | `{ slot, data: { x, y } }` | breakable tile destroyed |
| `warp` | `{ slot, entityId, data: { targetId } }` | warp completes |

***

## Error codes

| Code | Thrown by | Meaning |
|---|---|---|
| `KINETIX_PLATFORMER_LEVEL_INVALID` | `KinetixPlatformerLevelError` | level validation failed; carries `path`/`expected`/`actual` |
| `KINETIX_PLATFORMER_LEVEL_NONCANONICAL` | `decodeKinetixPlatformer2dLevel` | bytes are valid JSON but not the canonical encoding |
| `KINETIX_PLATFORMER_LEVEL_SIZE_LIMIT` | encode/decode | over `maxBytes`, or over `MAX_KINETIX_PLATFORMER2D_LEVEL_BYTES` |
| `KINETIX_PLATFORMER_REGISTRY_INVALID` | `KinetixPlatformerRegistryError` | malformed/duplicate/reserved registry extension, or a manifest supplied for a registry with no extensions |
| `KINETIX_PLATFORMER_REGISTRY_UNBOUND` | `KinetixPlatformerRegistryError` | registry extends the vocabulary but no `registryManifest` was supplied |
| `KINETIX_PLATFORMER_SOURCE_MANIFEST_INVALID` | identity derivation | the generated source manifest is malformed or unsorted |
| `KINETIX_PLATFORMER_PACK_INVALID` | `defineKinetixPlatformer2dPack` | pack failed exact-key or range validation |
| `KINETIX_PLATFORMER_SESSION_INVALID` | session/runtime construction | bad `levelEntryId`, `playerCount` over capacity, or `validateStateEveryFrames < 1` |
| `KINETIX_PLATFORMER_RUNTIME_IDENTITY_MISMATCH` | `createInstalledPlatformer2dRuntime` | the authority's identity is not the one this pack+registry derives |
| `KINETIX_PLATFORMER_INPUT_INVALID` | reducer | input was not exactly the seven-field struct, or the input array length ≠ player count |
| `KINETIX_PLATFORMER_STATE_INVALID` | reducer | a tile override or entity reference escaped the level |
| `KINETIX_PLATFORMER_STATE_NONFINITE` | reducer | a NaN/Infinity reached state (checked every `validateStateEveryFrames`, default 60) |
| `KINETIX_RUNTIME_COMMAND_INVALID` | adapter `decodeCommand` | an editor command was not a well-formed in-grid `placeTile`/`removeTile` |
| `KINETIX_AUX_ASSET_MISMATCH` | `verifyKinetixAuxiliaryAsset` | level bytes do not match the pinned digest/length |
| `SYNCPLAY_INPUT_SCHEMA_INVALID` | `defineSyncplayInputCodec` | malformed field descriptor, or a field that excludes 0 and declares no `neutral` |
| `SYNCPLAY_INPUT_ENCODE_INVALID` | `codec.encodeInput` | the value handed in is not a conforming input |
| `SYNCPLAY_INPUT_DECODE_INVALID` | `codec.decodeInput` | the wire payload is not a conforming input |
| `SYNCPLAY_INPUT_CODEC_UNSAFE` | `validateSyncplayInputCodec` | a hand-written codec accepted garbage, failed round-trip, or threw on `null` |
| `SYNCPLAY_LEVEL_PUBLISH_INVALID` | `publishPlatformerLevel` | bad `playerCapacity`, `name`, `authorSlot`, or `version` |
| `SYNCPLAY_LEVEL_DECLARATION_INVALID` | `preparePlatformerLevel` | malformed `levelEntryId`/`levelDigest`/`levelByteLength`/`encodeLevel` |
| `SYNCPLAY_LEVEL_NOT_FOUND` | `preparePlatformerLevel` | no UGC entry with that id |
| `SYNCPLAY_LEVEL_CONTENT_CHANGED` | `preparePlatformerLevel` | the entry exists but no longer matches the pin — it was edited under a live reference |
| `SYNCPLAY_ROOM_CODE_INVALID` | `normalizeRoomCode` | an explicit room-code override was not six alphanumerics |

Errors thrown by the level validator are `KinetixPlatformerLevelError` instances
carrying `{ code, path, expected, actual }`; `path` is a JSON pointer such as
`/entities/3/waypoints/1/x`, and the message embeds all four so string-only
consumers still get a usable line.

***

## Safe input codecs

Do not hand-write `encodeInput`/`decodeInput`. Derive them from the input shape,
and you get exact-key validation, throw-on-garbage, and correct `null → neutral`
semantics by construction:

```ts
import { defineSyncplayInputCodec } from '@series-inc/rundot-syncplay'

export const platformerInputCodec = defineSyncplayInputCodec<PlatformerInput>({
  moveX: { kind: 'enum', values: [-1, 0, 1] },
  moveY: { kind: 'enum', values: [-1, 0, 1] },
  jumpPressed: { kind: 'boolean' },
  jumpHeld: { kind: 'boolean' },
  dropPressed: { kind: 'boolean' },
  actionPressed: { kind: 'boolean' },
  crouchHeld: { kind: 'boolean' },
})

platformerInputCodec.decodeInput(null)        // → neutralInput
platformerInputCodec.decodeInput([5, 0, 0])   // → throws SYNCPLAY_INPUT_DECODE_INVALID
```

Field kinds are `boolean`, `int` (`min`/`max`), and `enum` (`values`). The neutral
value is `false` for booleans and `0` for `int`/`enum` when the range admits it;
otherwise declare `neutral` explicitly or construction throws
`SYNCPLAY_INPUT_SCHEMA_INVALID`.

Already have a hand-written codec? Probe it instead of rewriting it:

```ts
validateSyncplayInputCodec({ encodeInput, decodeInput, samples: [defaultInput] })
```

It asserts round-trip stability, that `decodeInput(null)` yields a neutral input
with the same fields, and that hostile payloads (wrong shape, wrong scalar kind,
extra key) all throw — a blind-cast codec fails with
`SYNCPLAY_INPUT_CODEC_UNSAFE`.

***

## Publish levels as new entries, never updates

UGC entries mutate in place, and there is no server-side version history. If you
`ugc.update` an entry that a live session pinned, every subsequent joiner fails
its digest check and the room becomes permanently unjoinable. **The convention is
version-on-edit: every publish creates a new entry.**

```ts
import { publishPlatformerLevel } from '@series-inc/rundot-syncplay'

const entry = await publishPlatformerLevel(RundotGameAPI.ugc, level, {
  name: 'Sky Bridge',
  authorSlot: 0,
  version: 2,          // bump per publish; the previous entry stays valid
  isPublic: true,
})
```

`publishPlatformerLevel` only ever calls `ugc.create`. It writes the indexed
discovery fields alongside the canonical level object, which lands under the
`level` key (`SYNCPLAY_PLATFORMER_LEVEL_DATA_KEY`) of the `data` record:

```jsonc
{
  "name": "Sky Bridge",
  "authorSlot": 0,
  "playerCapacity": 2,
  "version": 2,
  "thumbnailAssetId": "…",   // only when supplied
  "level": { /* canonical level object */ }
}
```

Session config still carries only `levelEntryId + levelDigest + levelByteLength`.
Joiners locate the record by **entry id** (there is no digest lookup endpoint),
re-encode the stored level canonically, and verify digest and length before frame
0:

```ts
import { preparePlatformerLevel } from '@series-inc/rundot-syncplay'
import { encodeKinetixPlatformer2dLevel } from '@series-inc/rundot-kinetix/runtime'

const levelBytes = await preparePlatformerLevel(RundotGameAPI.ugc, {
  levelEntryId: descriptor.levelEntryId,
  levelDigest: descriptor.levelDigest,
  levelByteLength: descriptor.levelByteLength,
  // Injected, not imported: Syncplay must compile against both the published
  // Kinetix pin and an overlaid local build, and the platformer pack's encoder
  // is not present in every published Kinetix.
  encodeLevel: (level) => encodeKinetixPlatformer2dLevel(level, { maxBytes: 102_400 }),
})
```

A mismatch throws `SYNCPLAY_LEVEL_CONTENT_CHANGED` naming the entry id and the
edit-vs-pin cause — deliberately distinct from the opaque
`KINETIX_AUX_ASSET_MISMATCH` you would otherwise hit deep inside runtime
construction, and distinct from `SYNCPLAY_LEVEL_NOT_FOUND` (missing entry) and
transport/permission failures (propagated unchanged).

The transport buffers the ordered `session-start`/history traffic while that
await runs, so the synchronous Kinetix runtime is only constructed after the
trusted level bytes exist.

## Level discovery conventions

| Convention | Value |
|---|---|
| `contentType` | `'platformer-level'` (`SYNCPLAY_PLATFORMER_LEVEL_CONTENT_TYPE`) |
| Level object key | `data.level` (`SYNCPLAY_PLATFORMER_LEVEL_DATA_KEY`) |
| Indexed fields | `name`, `authorSlot`, `playerCapacity`, `version`, `thumbnailAssetId?` |

**Prerequisite:** indexed-field queries only work when your game's
`UgcConfig.indexedFields` declares those field names — cloud-run promotes only
declared fields into the query index. Declaring them is a one-time game-config
change; without it `browse` still returns entries but cannot sort or filter on
them.

```ts
const community = await RundotGameAPI.ugc.browse({
  contentType: 'platformer-level',
  sortBy: 'createdAt',
  limit: 20,
})

const mine = await RundotGameAPI.ugc.listMine({ contentType: 'platformer-level' })
const latest = mine.items
  .filter((item) => item.data.name === 'Sky Bridge')
  .sort((left, right) => (right.data.version as number) - (left.data.version as number))[0]
```

Voting, leaderboards, and thumbnail generation are out of scope — these are
storage and query conventions only.

## Level-size budgeting

`MAX_KINETIX_PLATFORMER2D_LEVEL_BYTES` is **102,400**. That number equals the UGC
**default** `data` cap, but the two are independent: the UGC cap is per-app
configurable and can be raised, while the Kinetix constant is a hard ceiling on
canonical level bytes and is not configurable.

The grid dominates. `tilesBase64` encodes one byte per cell in base64, so:

```
tile bytes ≈ ceil(width * height / 3) * 4
```

| Grid | Tile payload | Headroom for entities |
|---|---|---|
| 64 × 32 (2,048 cells) | ~2.7 KB | ~99 KB |
| 256 × 64 (16,384 cells) | ~22 KB | ~80 KB |
| 512 × 128 (65,536 cells) | ~87 KB | ~15 KB |
| 640 × 160 (102,400 cells) | ~137 KB | **over budget** |

An entity costs roughly 80–140 canonical bytes depending on its field count and
id length, so budget ~100 entities per 10 KB. If a level does not fit, shrink the
grid before trimming entities — the tile payload is the term that grows fastest.

***

## Run offline, co-op, and networked

One `createSyncplayRunner` owns every mode. The runtime factory resolves the
verified level bytes from the session config's digest, so the same factory serves
offline bots, local co-op, and networked play:

```ts
runner.startOffline({
  identity: platformerSession.runtimeIdentity,
  sessionConfigBytes: platformerSession.sessionConfigBytes,
  playerCount: 2,
  localSlot: 0,
  botInputForTick: () => platformerInputCodec.neutralInput,
})
// ... later, transition the same runner to a live room:
await runner.startNetworked(async () => opened.transport)
```

The mutable "which levels are prepared" registry lives **outside** the certified
simulation entry (`src/runtimeFactory.ts`), because it is content fetched and
verified before frame 0, not deterministic per-frame state.

## Resolve invites and the signed-in gate

The browser helpers compose the existing room APIs — they render no UI:

```ts
const opened = await openSyncplayBrowserRoom(RundotGameAPI, roomOptions)
if (opened.kind === 'sign-in-required') throw new Error('SIGN_IN_REQUIRED')
if (opened.kind !== 'connected') throw new Error('ROOM_INTENT_OFFLINE')
await runner.startNetworked(async () => opened.transport)
await shareSyncplayRoom(RundotGameAPI, opened.transport.roomCode)
```

Intent precedence is: explicit UI override, then a non-`timed_out`
`app.resolveLaunchIntent().params`, then a local URL query fallback
(`room=CODE` joins, `host=1` creates, `quickMatch=1` quick-matches, otherwise
offline). An anonymous access gate returns `sign-in-required` without opening a
room.

**Room-code strictness is inverted between trusted and untrusted sources**, and
the direction matters:

| Source | Behaviour on a malformed code |
|---|---|
| `options.override` (your own UI) | **Strict** — throws `SYNCPLAY_ROOM_CODE_INVALID` |
| RUN launch intent (`share` / `deeplink` params) | **Lenient** — the bad code is ignored and resolution falls through to `host` / `quickMatch` / offline |
| URL query string (`?room=…`) | **Lenient** — same fall-through |

Both external channels carry attacker-craftable parameters, so a malformed code
there must degrade to offline rather than crash the game at boot. Your own UI
override is trusted code, so a bad code there is a programming error worth
surfacing loudly. Codes are trimmed, uppercased, and must be six alphanumeric
characters in every path.

## Test determinism, rollback, replay, and late join

The preset's proofs go through the supported correctness kit and the same
authority/client the platform runs:

```ts
import {
  assertDeterministic,
  assertLateJoinHydration,
  assertReplayVerifies,
  assertTwoClientConvergence,
} from '@series-inc/rundot-syncplay/testing'
```

`npm run test:determinism` runs straight-run parity, restore/resimulation,
snapshot hydration, and replay verification; `npm run test:mp` runs two-client
rollback convergence and late-join hydration over the real simulated network.
Failures name the phase, frame, and disagreeing checksums.

## Vite plugin responsibilities

The two Syncplay Vite plugins have distinct jobs and both belong in serve and
build:

- `rundotSyncplayPlugin({ mode: 'strict', simulationEntries: ['src/sim/runtime.ts'] })`
  statically certifies the listed simulation source (no `Math.random`,
  `Date.now`, timers, module-level mutable state, non-deterministic collection
  order, …). It does not run or emit room config.
- `rundotMultiplayerPlugin({ devPort: 9001 })` owns the local deterministic
  authority (serve) and the room-config build output. With a fileless
  deterministic room it copies config to `dist/rooms.config.json` and emits no
  `dist/server-bundle.js`.

`rundotGamePlaygroundPlugin()` reads `RUNDOT_PLAYGROUND_KEY` (a `pk_` key)
server-side only and receives neither `gameId` nor `apiKey` in this preset. All
esbuild/build targets are `es2022` and the SDK is excluded from `optimizeDeps`.

## Extending the vocabulary

Need an entity type the built-ins do not cover? Pass a registry extension rather
than forking the pack — but understand that custom behaviour is executable code
and must therefore move runtime identity. See
[the fork-vs-extend guide](https://www.npmjs.com/package/@series-inc/rundot-kinetix)
in the Kinetix README for the registry contract, the required `registryManifest`,
and the transitive-import trap.

## Current limits

- The installed runtime is browser JavaScript; the public ABI leaves a future
  native backend possible but none is promised here.
- Slopes are 45° tile-based. Arbitrary polygon geometry and free-swinging rope
  physics are out of scope; ladders and ropes are `climbRegion`s.
- Carrying or throwing another player is not supported.
- Network side effects are delivered only from authority-confirmed frames after
  the first live boundary (predicted render motion still runs).
- 128 slots is the tested protocol/load ceiling, not a 60 Hz performance
  guarantee for an arbitrary level; `maxPredictionTicks` is a rollback/latency
  budget, not a player-count limit.
