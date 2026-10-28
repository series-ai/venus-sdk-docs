# Syncplay: RTS Module (PROVISIONAL)

Import the generic, code-only RTS contract from:

<!-- syncplay-example: rts-imports -->
```ts
import {
  createSyncplayRtsSlice,
  projectSyncplayRts,
  rtsComponent,
  stepSyncplayRts,
} from '@series-inc/rundot-syncplay/modules/rts'
```

This API is **PROVISIONAL**. It defines deterministic RTS configuration, unit,
building, team, command, event, projection, and component types while reusing
the public deterministic navmesh for movement. Rendering, content, health
resolution, room lifecycle, and terminal game rules stay outside the module.

The implementation provides exact-shape validation plus deterministic
selection, bounded order queues, formations, navmesh movement, attack intents,
fog, income, placement, and production. The no-argument constructor returns the
frozen pristine module slice; the authored constructor creates a validated game
slice. Malformed configuration, state, input, or context fails closed before it
enters simulation.

Attack-move acquisition is represented by the unit's explicit
`acquiredTargetId`, separate from its authored `orders`. That transient target
must be a live enemy unit or building. It does not consume queue capacity;
queued orders preserve it, a replacement clears it, and target retirement
clears it so the original attack-move resumes. Hydration rejects unresolved,
nonliving, self, or friendly acquired targets. An authored `attack-target`,
whether hydrated or issued, must also resolve to a live opposing unit or
building; self, friendly, queued, retired, and missing targets fail closed.

## Stable errors

| Code | Cause |
|---|---|
| `SYNCPLAY_RTS_CONFIG_INVALID` | Authored configuration is malformed, or a referenced definition is missing. |
| `SYNCPLAY_RTS_CONTEXT_INVALID` | The frame context, math, navmesh, team list, or slot-to-team map is malformed. |
| `SYNCPLAY_RTS_INPUT_INVALID` | The input shape, a sender slot, or a retired entity ID is invalid. |
| `SYNCPLAY_RTS_STATE_INVALID` | Hydrated or derived state is corrupt, unsorted, or unresolvable. |
| `SYNCPLAY_RTS_SELECTION_INVALID` | A select command's box leaves the configured grid. |
| `SYNCPLAY_RTS_COMMAND_INVALID` | A command record is malformed, or a target cell or formation cell does not resolve. |
| `SYNCPLAY_RTS_COMMAND_DUPLICATE` | One sender slot issued two commands with the same ID in one frame. |
| `SYNCPLAY_RTS_COMMAND_UNAUTHORIZED` | A production command names a building that another team owns. |
| `SYNCPLAY_RTS_PLACEMENT_INVALID` | A placement command names an unknown building definition, team, or footprint. |
| `SYNCPLAY_RTS_PRODUCTION_INVALID` | A production command names an unknown building, unit, or team, or the building cannot produce that unit. |
