# Syncplay: Bots & AI (BETA)

Bots occupy ordinary player slots in Syncplay. The authority produces their
inputs using installed Kinetix mechanics, so every peer receives the same
confirmed input history and rollback, late join, replay, and reconnect treat bot
and human eras identically.

Bot gameplay must be declared in the Kinetix project as data. A game repository
does not ship a bot callback, reducer, or clock-driven AI loop.

```typescript
import { defineKinetixProject } from '@series-inc/rundot-kinetix/authoring'

export const project = defineKinetixProject({
  id: 'arena-with-bots',
  installedProfile: 'deterministic-f64',
  tickRate: 30,
  inputSchema: { id: 'arena-input/v1' },
  sessionConfigSchema: {
    id: 'arena-session/v1',
    version: 1,
    maxBytes: 4096,
    fields: { playerCount: { type: 'integer', min: 1, max: 8 } },
  },
  mechanics: [{ kind: 'bot-backfill', model: 'behavior-tree' }],
  components: [{ kind: 'bot-blackboard' }],
  systems: [{ kind: 'bot-input', order: 20 }],
  presentationBindings: [],
})
```

Only mechanics present in the selected installed profile may be referenced.
Evaluation order, tie-breaking, frame cadence, and RNG stream names are part of
that installed mechanic's deterministic contract.

The room records occupied human slots independently from substituted or bot
input. When a human drops into a bot-controlled slot, the transition happens on
a confirmed tick. A late joiner replays the bot era followed by the human era
from the same input log.

Use read-only Kinetix inspection data for debugging and presentation. Never put
render objects, wall-clock timers, browser randomness, or network reads into the
authoritative bot declaration.
