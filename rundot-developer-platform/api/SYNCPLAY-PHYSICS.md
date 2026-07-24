# Syncplay: Physics & Collision (BETA)

Authoritative physics in a Syncplay session is an installed Kinetix mechanic.
The selected product owns bodies, contacts, fixed evaluation order, checkpoint
bytes, and checksums. Syncplay schedules inputs and rollback; it does not run a
second physics world or accept a game-authored physics step callback.

```typescript
import { defineKinetixProject } from '@series-inc/rundot-kinetix/authoring'

export const project = defineKinetixProject({
  id: 'physics-arena',
  installedProfile: 'fixed-1000-3d',
  tickRate: 30,
  inputSchema: { id: 'physics-arena-input/v1' },
  sessionConfigSchema: {
    id: 'physics-arena-session/v1',
    version: 1,
    maxBytes: 8192,
    fields: { playerCount: { type: 'integer', min: 1, max: 8 } },
  },
  mechanics: [{ kind: 'fixed-physics', gravity: -9800 }],
  components: [
    { kind: 'body', bodyType: 'dynamic' },
    { kind: 'collider', shape: 'box' },
  ],
  systems: [{ kind: 'physics-step', order: 30 }],
  presentationBindings: [{ component: 'body', property: 'transform' }],
})
```

The declaration is data only. Exact available mechanics and component fields
come from the installed profile; unsupported kinds fail compilation rather than
falling back to creator code.

## Physics engine transition

The Kinetix WASM physics entrypoint is being introduced behind the existing
Syncplay TypeScript solver. Its current bootstrap slice covers immutable worlds,
box/sphere records, deterministic integration, basic axis-aligned contacts and
queries, and native/WASM no-contact parity. Syncplay remains the authoritative
oracle until exact contact manifolds, warm-start caches, joints, CCD, and the
full Box3D parity corpus are promoted. Games must continue to use the installed
profile surface above and must not import the bootstrap entrypoint as an
authoritative replacement.

For rendering, read the Kinetix presentation projection and interpolate outside
authoritative state. Cosmetic particles or props may use a separate render-side
physics library, but that world cannot feed gameplay, inputs, scores, contacts,
or checksummed state.

Rollback restores an opaque Kinetix checkpoint. Late join serializes one opaque
runtime payload and validates runtime identity, session-config digest, frame,
and checksum before hydration. No per-body state is interpreted by Syncplay.

## Standalone deterministic physics (creator surface)

Outside installed Kinetix mechanics, `@series-inc/rundot-syncplay/creator` still
exports a standalone deterministic 3D physics toolkit — the same solver the
fixed-physics profiles build on:

- `createDeterministicPhysicsWorld3D(bodies)` / `stepDeterministicPhysicsWorld3D(world, input)` —
  construct and advance a deterministic world snapshot-to-snapshot.
- `applyDeterministicWorldEdit3D(world, edit)` — runtime destruction/topology
  edits (fracture, voxel carve) that stay checksum-stable across clients.
- `cookDeterministicVoxelChunkCollider3D(chunk)` — cook dense voxel chunks into
  compound colliders.

Use it for render-side or cosmetic simulation only. It must not feed gameplay,
inputs, scores, contacts, or checksummed state — authoritative physics is
always an installed Kinetix mechanic (above).

This section is non-exhaustive: the full curated creator surface (impulses,
queries, callbacks, body helpers, vehicle stepping, stress telemetry) is pinned
by the export golden at `packages/syncplay/tests/golden/export-surface.json`.

Session snapshot transfer is bounded by `maxSnapshotBytes` (session/room
option, plumbed through `networked-client` and the authority room); oversized
snapshots are rejected fail-closed rather than truncated.
