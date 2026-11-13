# Extraction API

The Extraction API (`RundotGameAPI.extraction` / `Host.extraction`) provides turn-key abstractions for extraction-shooter loop dynamics, hub session management, airlock preparation, combat spoke ingress, and settlement debriefing natively backed by Venus cloud infrastructure.

***

## Overview

Extraction games require strict lifecycle and inventory guarantees:
1. **Hub Sessions (`openHubAsync`)**: Secure persistent inventory, staging loadout items, craft benches, and squad match formation.
2. **Airlock Preparation (`prepareRaidAsync`)**: Escrows loadout items server-side, validates tickets, and obtains cryptographically signed extraction grants.
3. **Active Spoke Session (`airlock.enterAsync`)**: Connects to the authoritative multiplayer room server gateway (`RaidGateway`) using single-use tickets, with anti-cheat fences for combat inputs and extraction calls.
4. **Debriefing (`getDebriefAsync`)**: Retrieves settled extraction receipts, inventory transfers, participant results, and verified outcome digests.

***

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// 1. Open hub hideout session
const hub = await RundotGameAPI.extraction.openHubAsync({ hub: 'bunker_alpha' });
console.log('Stash contents:', await hub.getStashAsync());

// 2. Prepare raid airlock with chosen loadout
const airlock = await RundotGameAPI.extraction.prepareRaidAsync({
  sector: 'customs_district',
  loadout: [
    { itemId: 'rifle_m4a1', quantity: '1' },
    { itemId: 'ammo_556_m855', quantity: '120' },
  ],
});

// 3. Connect to raid spoke session
const spoke = await airlock.enterAsync();
console.log(`Deployed to raid ${spoke.raidId} on slot ${spoke.slot}`);

// 4. Submit gameplay intent frames
spoke.submitIntent({
  pickupItemId: 'crate_mil_04',
});

// 5. Request extraction at designated exfil zone
const exfilResult = await spoke.requestExtractionAsync({
  zoneId: 'exfil_zone_b',
});
if (exfilResult.extracted) {
  console.log('Extracted! Waiting for final debrief...');
}

// 6. Inspect post-raid debrief
const debrief = await RundotGameAPI.extraction.getDebriefAsync(spoke.raidId);
if (debrief?.settled) {
  console.log('Raid settled successfully!');
  console.log('Transfers:', debrief.transfers);
  console.log('Participant results:', debrief.participantResults);
}
```

***

## Entry retry and cancellation

A failed `airlock.enterAsync()` does not cancel the handoff or refund its loadout.
The server can commit while the connection times out. The airlock stays
`COMMITTED` until entry succeeds or the server accepts an explicit cancellation.

Call `enterAsync()` again on the same airlock to retry. The SDK requests a fresh
single-use grant for that handoff. It does not prepare or debit another loadout.
Concurrent entry calls share one attempt. Entry on an active socket returns that
session. After that socket closes, another entry call requests a fresh grant.

Settlement can complete during entry. In that case, `enterAsync()` returns the
session with `airlock.state === 'SETTLED'`. Read its receipt with
`spoke.waitForDebriefAsync()`. The SDK closes the socket without another grant
request or cancellation. This also applies when a settlement message is lost.

Call `cancelAsync()` to request a refund before server commit. A committed
handoff returns `AirlockCancellationRejectedError`. The caller can still retry
entry after that rejection.

## Server release configuration

Extraction requires an explicit sector configuration in the public server release.
Set `Games/{gameId}.tags.public.serverId` to the release ID. Put this configuration
in `Games/{gameId}/servers/{serverId}.value`:

```json
{
  "synchubExtraction": {
    "v": 1,
    "modes": {
      "customs_district": {
        "tickRateHz": 10,
        "initialHealth": 100,
        "spawnPositions": { "0": [0, 0, 0], "1": [30, 0, 0] },
        "rules": {
          "v": 1,
          "squadSlots": [[0], [1]],
          "friendlyFire": false,
          "pickupRadiusFixed": 4,
          "extractionZones": [
            { "zoneId": "exfil", "geometryId": "exfil-circle", "dwellTicks": 60, "x": 15, "z": 15, "radius": 4 }
          ],
          "deadlinePolicy": "burn-unextracted",
          "raidDeadlineTick": 1200,
          "maxMoveSpeedPerTick": 1,
          "maxAttackRangeFixed": 5,
          "maxAttackDamageFixed": 10
        }
      }
    }
  }
}
```

These are example rules. The game owner must set the actual rules and spawn positions.
This runtime implements the platform extraction rules. It does not execute arbitrary
game combat code. It uses the same extraction module for live state and replay.

The current release accepts at most 1,200 ticks, 10 ticks per second, 64 seats,
and 256 reserved item entries per raid. Each mode must fit in 16 KiB of JSON.
Each seat must have exactly one spawn position. Zone IDs and geometry IDs have
a 64-character limit. Pickup IDs in player input have a 256-byte UTF-8 limit.
These bounds keep the replay and recovery workload within the tested range.

Loadout quantities must fit in 256 bytes after canonical serialization. Catalog
item IDs must fit in 256 bytes of JSON. Custody IDs are separate, fixed-size
identifiers. Use the custody ID from raid state when picking up an item.

`submitIntent` accepts movement, attack target, and pickup fields from the
extraction module. `normalizedMovement` maps to `moveX` and `moveZ`.
The SDK rejects unsupported game-specific fields. Combat actions such as
`action`, `weapon`, or `aimAngle` require a game adapter.

When writing a release directly to Firestore, encode each nested `squadSlots`
array as `{ "slots": [...] }`. The backend decodes that storage form before
validation. Standard JSON release data uses the array form shown above.

Preparation fails before inventory reservation if the sector is not configured.
The first preparation pins the sector rules, release ID, and extraction module
fingerprint. Later release edits do not change that raid. Each player receives
an available seat from the pinned rules.

The new control endpoints require server API version 7. Read `X-Run-Api-Version`
before using them. A lower version means the feature is not supported by that backend.

`POST /v1/extraction/rejoin` accepts `{ "raidId": "..." }` with player authentication.
It returns a fresh single-use grant for an existing participant. It does not reserve
or debit the loadout again. If the old authority lease expired, it advances the
authority epoch before signing the grant. The next owner claims that unclaimed epoch.
Grant issue and redemption check the current participant and handoff state.
Settlement, death, or cancellation can revoke a grant before its expiry.

When the raid owner stops, an unsettled airlock returns to `COMMITTED`. Call `enterAsync()`
on the same airlock to request a fresh grant. Entry makes one additional attempt
if the gateway reports that the owner is unavailable. Other failures remain
visible to the caller. The loadout stays reserved during entry recovery.
Prefix or final settlement sets the airlock to `SETTLED`. A settled airlock
cannot enter again or cancel.
`submitIntent()` throws for empty pickup IDs, inherited object keys, and pickup
IDs that exceed 256 UTF-8 bytes. It does not send those invalid inputs.

The Vite multiplayer server does not run SyncHub. Its extraction endpoints return
`501 SYNCHUB_REQUIRES_SERVER`. Use Cloud Run, mp-room-server, Redis, and the Firebase
emulators for local raid checks. Use `MockExtractionApi` for offline demos.

Internal room servers use `POST /v1/synchub/claim-authority`,
`GET /v1/synchub/runtime/:raidId`, and `GET /v1/synchub/manifest/:handoffId`.
These endpoints require the shared internal key. A live lease cannot be taken
by another owner. Heartbeats can renew only the current owner and epoch.

## Methods

### `openHubAsync(options?: { hub?: string }): Promise<ActiveHubSession>`
Opens a hub hideout session to view stash inventory, organize items, and manage squad state.

### `prepareRaidAsync(options: PrepareRaidOptions): Promise<ActiveAirlockSession>`
Initializes the airlock stage. Validates the player's inventory escrow, creates an immutable squad handoff, and returns an `ActiveAirlockSession`.

### `getDebriefAsync(raidId: string): Promise<SettlementDebrief | null>`
Queries the authoritative settlement debrief for a concluded raid session. Requires caller to be an authorized participant of the raid.

***

## Authoritative Team Scoring & Leaderboards

For multiplayer extraction games, SyncHub supports authoritative squad scoring tied directly into raid settlement.

### Policy Configuration (`synchubTeamScoring`)

Server releases configure scoring policy in the game server release config. Mode keys correspond to the raid's `sectorKey` (e.g. `'customs_district'`):

```json
{
  "synchubTeamScoring": {
    "v": 1,
    "modes": {
      "customs_district": {
        "policy": "synchub.extraction.worldSpawnQuantity",
        "version": 1
      }
    }
  }
}
```

The scoring policy is bound at raid chunk 0. Any runtime configuration edits made during a live raid do not affect that raid's scoring rules.

### Finality at the Deadline

SyncHub distinguishes between early prefix exfils and raid finality:
- **Prefix Settlements**: When players extract early, items are credited immediately via prefix settlement. However, no team leaderboard row is published at this point.
- **Final Settlement**: Occurs when verified simulation ticks reach or exceed `raidDeadlineTick`. The server settlement transaction computes the authoritative squad score across all crew members (including surviving casualties, early extractors, and disconnects) and writes the immutable `synchubFinalResults/{raidId}` document.

### Team Rows

Upon final settlement, SyncHub publishes the crew's score to [Team Leaderboards](TEAM_LEADERBOARD.md) (`RundotGameAPI.teamLeaderboard`). If the publish fails transiently, a background scheduler job safely retries publication using the captured board config and stored score.
