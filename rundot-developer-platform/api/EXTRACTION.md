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
