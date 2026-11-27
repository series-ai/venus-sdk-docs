# Syncplay 6.0 Migration Guide

This guide covers everything needed to upgrade a game from Syncplay 5.x (or 6.0 release candidates) to **Syncplay 6.0**.

> **Checkpoint and replay compatibility:** Syncplay 6.0 uses a new deterministic numeric epoch and binary checkpoint format. Checkpoints and replays recorded on 5.x cannot be loaded on 6.0; start fresh replay/snapshot history on upgrade.

## Quick Checklist

| Area | Old (5.x / RC) | Syncplay 6.0 |
|---|---|---|
| Runner startup | `runner.startOffline(...)` / `runner.startNetworked(connect)` | `await runner.start({ mode: 'offline', ... })` / `await runner.start({ mode: 'networked', connect })`; use `await runner.restart(...)` to replace an active run |
| Testing harness | `harness.startOffline()` (sync) | `await harness.startOffline()` (returns `Promise<void>`) |
| Checksum inspection | `client.confirmedStateChecksum(frame)` | `client.getConfirmedStateChecksum(frame)` |
| 2D / 3D physics imports | Root `.`, `./browser`, `./core/physics`, `./core/world`, `./debug` | `@series-inc/rundot-syncplay/physics/2d` and `@series-inc/rundot-syncplay/physics/3d` |
| 3D unit helpers | `vec3`, `meters3` from `@series-inc/rundot-syncplay` | `vec3`, `meters3` from `@series-inc/rundot-syncplay/physics/3d` |
| 3D vehicle controller | `stepDeterministicVehicle3D` + rev-1 types (`DeterministicVehicle3D`, `DeterministicVehicleWheel3D`, `DeterministicVehicleImpulse3D`, `DeterministicVehicleStepOptions3D`, `DeterministicVehicleStepResult3D`, `DeterministicVehicleWheelTelemetry3D`) | Top-level `createDeterministicVehicleState3D` + `stepDeterministicVehicleState3D` from `@series-inc/rundot-syncplay/physics/3d` |
| 3D cellular move modes | `liquidSpreadMode: 'legacy' \| 'womd'`, `moveMatrix: 'legacy' \| 'womd'` | `liquidSpreadMode: 'basic' \| 'extended'`, `moveMatrix: 'basic' \| 'extended'` |
| Hub extension | `@series-inc/rundot-syncplay/hub`; `SyncplayHubPlugin` / `SyncplayHubPluginOptions` on `./extensions/hub` | `@series-inc/rundot-syncplay/extensions/hub` (`SyncplayHubPlugin*` removed) |
| v5 reducer adapter | `@series-inc/rundot-syncplay/compat/v5` | Removed; implement a `KinetixRuntime` via `createInstalledRuntimeAdapter` from `@series-inc/rundot-syncplay/core/runtime` |
| Plugins subpath | `@series-inc/rundot-syncplay/plugins` | Removed (use `runner.subscribeEvents` / lifecycle hooks) |
| R3F adapter alias | `createDeterministicR3fAdapter` on `./browser` | `createDeterministicR3fRenderAdapter` |
| Input ownership audit | `inputOwnershipAudit: boolean` | Removed (adoption is always audited) |
| Room snapshot config | `config.snapshotIntervalTicks`, `config.snapshotRetentionTicks`, `config.maxSnapshotBytes` | `deterministic.snapshots` block (validated by `parseSyncplaySnapshotConfig`) |
| Checksum worker | `checkpointChecksumWorker` client option | Removed (confirmed checksums run on the main thread) |

## Canonical Entrypoints

- **`@series-inc/rundot-syncplay`** (or `/browser` for web bundles, `/node` for Node authority servers): runner, networked client, session, rollback, replay, KCC 3D (`stepDeterministicKcc3D`, `stepDeterministicCarry3D`), navigation, and deterministic utilities.
- **`@series-inc/rundot-syncplay/physics/3d`** and **`/physics/2d`**: async-initialized, native-owned deterministic physics worlds (`initPhysics3D` / `createPhysicsWorld3D`, `initPhysics2D` / `createPhysicsWorld2D`), SI unit constructors (`meters`, `vec3`, `meters3`), cellular 3D fields (`createCellularField3D`), top-level rev-2 vehicle helpers (`createDeterministicVehicleState3D`, `stepDeterministicVehicleState3D`), and feature namespaces (`vehicles3D`, `ragdoll3D`, `cloth3D`, etc.).
- **`@series-inc/rundot-syncplay/core/runtime`**: low-level `createInstalledRuntimeAdapter` and runtime identity/config digest helpers.
- **`@series-inc/rundot-syncplay/extensions/hub`**: cross-room handoff, airlock, and settlement contracts.
- **`@series-inc/rundot-syncplay/modules/*`**: composable gameplay modules (`component-model`, `character-3d`, `combat`, `extraction`, etc.).

Keep 3D character controller imports (`stepDeterministicKcc3D`, `stepDeterministicCarry3D`) on `@series-inc/rundot-syncplay/browser` (or root `.`), and import `PhysicsWorld3D` and physics helpers from `@series-inc/rundot-syncplay/physics/3d`.

## Runner Lifecycle (`runner.start` and `runner.restart`)

Replace `startOffline` and `startNetworked` with `await runner.start(...)` from an idle, stopped, or failed runner. Calling `runner.start(...)` while a run is already active or starting throws `SyncplayError` (`code: 'runner.start-state-invalid'`); call `await runner.restart(...)` to replace an active run (matching the old `startNetworked` replacement behavior):

```ts
// Initial offline start
await runner.start({
  mode: 'offline',
  identity,
  sessionConfigBytes,
  playerCount: 2,
  localSlot: 0,
});

// Switch an active offline runner to networked play
await runner.restart({
  mode: 'networked',
  connect: async () => transport,
});
```

In `@series-inc/rundot-syncplay/testing`, `SyncplayRunnerHarness.startOffline()` is now async (`Promise<void>`) — always `await harness.startOffline()`.

For confirmed checksums on a `NetworkedSyncplayClient`, call `client.getConfirmedStateChecksum(frame)`. Unlike the old 5.x helper, it reads a retained confirmed checkpoint without rewinding live simulation state.

## Owned 3D Physics, Vehicles & Cellular Fields

Initialize the 3D physics runtime once with `await initPhysics3D()`, create an owned world with SI units, edit inside `world.edit(...)`, and step with `world.step()`. For 3D vehicles, migrate from the removed revision-1 `stepDeterministicVehicle3D` (and its rev-1 types) to top-level `createDeterministicVehicleState3D` and `stepDeterministicVehicleState3D` exported directly from `@series-inc/rundot-syncplay/physics/3d`.

For 3D cellular fields (`CellularField3D`), update any `setMoveRules(...)` call that passed `'legacy'` or `'womd'` for `liquidSpreadMode` or `moveMatrix` to `'basic'` or `'extended'`.

## Runnable Verification Example

<!-- syncplay-example: syncplay-v6-migration -->
```typescript
import {
  createSyncplayRunner,
  defineSyncplayInputCodec,
  stepDeterministicKcc3D,
} from '@series-inc/rundot-syncplay/browser';
import {
  createInstalledRuntimeAdapter,
  kinetixSessionConfigDigest,
} from '@series-inc/rundot-syncplay/core/runtime';
import {
  createDeterministicVehicleState3D,
  createPhysicsWorld3D,
  initPhysics3D,
  meters,
  meters3,
  metersPerSecondSquared,
  stepDeterministicVehicleState3D,
  vec3,
  type PhysicsWorld3D,
} from '@series-inc/rundot-syncplay/physics/3d';

await initPhysics3D();

const world: PhysicsWorld3D = createPhysicsWorld3D({
  tickRate: 60,
  capacity: { bodies: 8, joints: 0 },
  initialGravity: {
    x: metersPerSecondSquared(0),
    y: metersPerSecondSquared(-9.81),
    z: metersPerSecondSquared(0),
  },
});
const edit = world.edit((e) => {
  const floor = e.createBody({
    kind: 'static',
    position: meters3(0, -0.5, 0),
    shape: { type: 'box', halfX: meters(10), halfY: meters(0.5), halfZ: meters(10) },
  });
  return { floor };
});
if (
  !edit.created.floor
  || vec3(1, 2, 3).y !== 2
  || typeof stepDeterministicKcc3D !== 'function'
  || typeof createDeterministicVehicleState3D !== 'function'
  || typeof stepDeterministicVehicleState3D !== 'function'
) {
  throw new Error('MIGRATION_EXAMPLE_PHYSICS_FAILED');
}
world.step();
world.dispose();

const sessionConfigBytes = new Uint8Array([1, 2, 3]);
const identity = {
  abiVersion: 1 as const,
  tickRate: 60 as const,
  inputSchemaId: 'migration.input.v1',
  stateSchemaId: 'migration.state.v1',
  deterministicVersion: '1.0.0',
  engineIdentityHash: kinetixSessionConfigDigest(sessionConfigBytes),
};

const inputCodec = defineSyncplayInputCodec<{ readonly move: number }>({
  move: { kind: 'int', min: -1, max: 1, neutral: 0 },
});

const runner = createSyncplayRunner({
  runtimeFactory: (rtIdentity, bytes) => {
    let tick = 0;
    return createInstalledRuntimeAdapter({
      identity: rtIdentity,
      sessionConfigBytes: bytes,
      captureState: () => ({ tick }),
      restoreState: (s) => { tick = s.tick; },
      frameOf: (s) => s.tick,
      capturedStateIsDetached: true,
      projectState: (s) => s,
      step: () => { tick += 1; },
    });
  },
  defaultInput: inputCodec.neutralInput,
  encodeInput: inputCodec.encodeInput,
  decodeInput: inputCodec.decodeInput,
  presentation: { project: (state) => state },
});

await runner.start({
  mode: 'offline',
  identity,
  sessionConfigBytes,
  playerCount: 1,
  localSlot: 0,
});
runner.update(1000 / 60);
if (runner.getRenderState().tick !== 1) {
  throw new Error('MIGRATION_EXAMPLE_RUNNER_FAILED');
}
await runner.dispose();
```

## Checkpoints, Snapshots, and Cellular Storage

- **Hydrated vs. wire snapshot limits (`stateStorage.maxSnapshotBytes`):** When configured on an owned runtime, `stateStorage.maxSnapshotBytes` bounds the **hydrated** snapshot size (game packet plus raw native physics/cellular image). Room and client transfer limits (`deterministic.snapshots.maxBytes` and client `maxSnapshotBytes`) bound the **compressed wire** payload instead.
- **3D physics checkpoint ABI and digests:** Syncplay 6.0 uses 3D physics ABI 26 and digest revision 4 (matching `6.0.0-rc.82+`; `rc.81` and earlier ABIs are rejected). Bump your game's `deterministicVersion`, re-record golden digests, and start fresh replay/snapshot history when upgrading from 5.x or older pre-6.0 builds.
- **Cellular 3D codecs and scheduler:** `CellularField3D` uses `CF3D` v3/v4 codecs, bounded scheduling with `merkle/2` and `scheduler/1` commitments, `unpinBaselineCheckpoint(expectedToken?)`, and `'basic' | 'extended'` mode values (`liquidSpreadMode`, `moveMatrix`, replacing `'legacy' | 'womd'`).

## Active Deprecations

<!-- api-deprecations:start -->

No active deprecations in Syncplay 6.0.

<!-- api-deprecations:end -->
