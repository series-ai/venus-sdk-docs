# Syncplay extraction module

> **STABLE:** This module API provides pure deterministic raid and extraction simulation rules.

`@series-inc/rundot-syncplay/modules/extraction` provides turnkey extraction and squad raid rules:

- `createInitialRaidState` instantiates canonical raid state with squads, deadlines, extraction zones, and inventory holders;
- `admitSquadManifest` idempotently registers squad members and their initial carried-in item manifests;
- `stepRaidTick` advances deterministic squad combat, friendly-fire, casualty drops, corpse looting, dwell-based exfiltration zones, and deadline burns;
- `extractRaidOutcome` extracts verified outcome artifacts containing item custody lineage for downstream bilateral settlement.

<!-- syncplay-example: extraction-rules -->
```ts
import {
  createInitialRaidState,
  admitSquadManifest,
  stepRaidTick,
  extractRaidOutcome,
} from '@series-inc/rundot-syncplay/modules/extraction'

const raidState = createInitialRaidState({
  v: 1,
  squadSlots: [[0, 1], [2, 3]],
  friendlyFire: false,
  pickupRadiusFixed: 50,
  extractionZones: [{
    zoneId: 'exfil_alpha',
    geometryId: 'box_1',
    dwellTicks: 300,
    x: 0,
    z: 0,
    radius: 10,
  }],
  deadlinePolicy: 'burn-unextracted',
  raidDeadlineTick: 36000,
});
```

The module maintains zero platform or I/O dependencies, enabling identical evaluation in 60Hz room simulations and sandboxed replay verifiers.
