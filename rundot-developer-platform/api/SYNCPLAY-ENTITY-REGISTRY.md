# Syncplay: Entity Registry (PROVISIONAL)

Import the deterministic entity registry from:

<!-- syncplay-example: entity-registry-imports -->
```ts
import {
  createSyncplayEntityRegistry,
  entityRegistryModuleApiStability,
  type SyncplayModuleIdentity,
} from '@series-inc/rundot-syncplay/modules/entity-registry'
```

This API is **PROVISIONAL**. It lets a game register its own entity
behaviours. Each behaviour declares an identity, initializes a portable slice,
and steps that slice for one entity.

The registry folds entity type and module identity into a manifest digest. Call
`bind` with the peer manifest before calling `step`. A missing or different
manifest fails closed. The registry seeds entities in code-unit order and
steps them in the same order, independent of registration order.

Keep entity slices as plain portable objects. Keep game-specific entity types
and authoring data in the consuming game.

## The registry has four members

`createSyncplayEntityRegistry` returns exactly `{ manifest, seed, bind, step }`.
`step` takes a root, and **only `seed()` produces a root**. Call the three
methods in order: `seed` -> `bind` -> `step`.

| Member | Purpose |
|---|---|
| `manifest` | The digest of every registered entity type and its module identity. |
| `seed(entities)` | Builds the initial root from `{ entityId, entityType, config? }` seeds. Returns `{ entities, manifest }`. |
| `bind(peerManifest)` | Confirms the peer runs the same registry. Throws `SYNCPLAY_ENTITY_REGISTRY_MANIFEST_MISMATCH` on any difference. |
| `step(root, context)` | Steps every entity in code-unit order. Returns `{ entities, manifest, events }`. Throws `SYNCPLAY_ENTITY_REGISTRY_UNBOUND` if you did not call `bind` first. |

## Declaring a behaviour identity

A `SyncplayEntityBehaviour` requires an `identity` field. Import its
`SyncplayModuleIdentity` type from the entity registry subpath.

<!-- syncplay-example: entity-registry-identity -->
```ts
import type { SyncplayModuleIdentity }
  from '@series-inc/rundot-syncplay/modules/entity-registry'

const torchIdentity = {
  id: 'mygame.torch',
  semanticVersion: '1.0.0',
  mathProfile: 'integer-fixed',
  schema: {
    slice: 'mygame.torch.slice.v1',
    input: 'mygame.torch.input.v1',
    event: 'mygame.torch.event.v1',
    projection: 'mygame.torch.projection.v1',
  },
} as const satisfies SyncplayModuleIdentity
```

## Worked example: seed, bind, step

```ts
import { createSyncplayEntityRegistry }
  from '@series-inc/rundot-syncplay/modules/entity-registry'
import { createDeterministicMath } from '@series-inc/rundot-syncplay/browser'

const torchBehaviour = {
  entityType: 'torch',
  identity: torchIdentity,
  init: (config: Readonly<Record<string, unknown>>) => ({
    litTicks: 0,
    fuel: typeof config.fuel === 'number' ? config.fuel : 600,
  }),
  step: (slice: Readonly<{ litTicks: number; fuel: number }>) => ({
    slice: { litTicks: slice.litTicks + 1, fuel: slice.fuel - 1 },
    events: [],
  }),
}

const registry = createSyncplayEntityRegistry({ behaviours: [torchBehaviour] })

// 1. seed produces the root. Nothing else can.
let root = registry.seed([
  { entityId: 'torch-a', entityType: 'torch', config: { fuel: 600 } },
  { entityId: 'torch-b', entityType: 'torch' },
])

// 2. bind against the peer manifest. Fails closed on any difference.
registry.bind(root.manifest)

// 3. step each frame. Keep the returned root in your simulation state.
const math = createDeterministicMath()
const result = registry.step(root, { frame: 0, tickRateHz: 60, math })
root = { entities: result.entities, manifest: result.manifest }
// result.events carries the deterministic event records from every entity.
```
