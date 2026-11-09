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
  action: 'loot_container',
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
