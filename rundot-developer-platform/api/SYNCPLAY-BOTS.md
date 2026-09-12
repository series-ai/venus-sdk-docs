# Syncplay: Bots & AI (BETA)

Bots occupy ordinary player slots in Syncplay. The authority produces their
inputs using installed Kinetix mechanics, so every peer receives the same
confirmed input history and rollback, late join, replay, and reconnect treat bot
and human eras identically.

Bot gameplay must be declared in the Kinetix project as data. A game repository
does not ship a bot callback, reducer, or clock-driven AI loop.

This example compiles a bot declaration. Compilation validates and orders the
asset data. It does not install the bot into a live room.

<!-- syncplay-example: bot-document -->
```typescript
import {
  compileDeterministicBotDocument,
  type DeterministicBotDocument,
} from '@series-inc/rundot-syncplay';

const document: DeterministicBotDocument = {
  id: 'arena-guard',
  version: 1,
  blackboard: [{ key: 'enemyNear', value: false }],
  hfsm: {
    initialState: 'idle',
    states: [
      { id: 'idle', action: 'scan' },
      { id: 'attack', action: 'fire' },
    ],
    transitions: [{ from: 'idle', to: 'attack', whenKey: 'enemyNear', equals: true }],
  },
};
const compiled = compileDeterministicBotDocument(document);
const repeated = compileDeterministicBotDocument(document);
if (compiled.hash !== repeated.hash || compiled.bytes !== repeated.bytes) {
  throw new Error('Bot compilation changed for the same declaration');
}
if (compiled.debugMetadata.stateCount !== 2) {
  throw new Error('The compiled bot is missing a declared state');
}
```

Installation is not yet a public API. `compileDeterministicBotDocument` only
validates and orders the declaration. No exported function accepts a
`CompiledDeterministicBotDocument` and adds it to a room or to a profile. The
host application owns that step today. A "selected mechanic profile" is
therefore the host's installed Kinetix profile, not an SDK call you can make.

Keep the bot's blackboard, random stream state, and behavior memory in captured
simulation state. The installed runtime adapter binds existing simulation
ownership with `captureState`, `restoreState`, `frameOf`, and `step`. It does
not construct state through a `createState` option. See the executable
[physics runtime example](SYNCPLAY-PHYSICS.md) for the adapter lifecycle.

A bot declaration may reference only mechanics that the installed profile
contains. Evaluation order, tie-breaking, frame cadence, and RNG stream names
are part of that installed mechanic's deterministic contract.

The room records occupied human slots independently from substituted or bot
input. When a human drops into a bot-controlled slot, the transition happens on
a confirmed tick. A late joiner replays the bot era followed by the human era
from the same input log.

Use read-only Kinetix inspection data for debugging and presentation. Never put
render objects, wall-clock timers, browser randomness, or network reads into the
authoritative bot declaration.

For a random decision, use the installed mechanic's named RNG streams instead of
browser randomness. Each stream is seeded from simulation state, and its state
is captured and restored with the rest of the simulation. Rollback, replay, and
late join then reproduce the same draws.
