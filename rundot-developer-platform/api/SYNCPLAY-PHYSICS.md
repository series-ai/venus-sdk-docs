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

For rendering, read the Kinetix presentation projection and interpolate outside
authoritative state. Cosmetic particles or props may use a separate render-side
physics library, but that world cannot feed gameplay, inputs, scores, contacts,
or checksummed state.

Rollback restores an opaque Kinetix checkpoint. Late join serializes one opaque
runtime payload and validates runtime identity, session-config digest, frame,
and checksum before hydration. No per-body state is interpreted by Syncplay.
