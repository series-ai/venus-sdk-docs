# Syncplay: Unit Control Module (PROVISIONAL)

Import the deterministic unit-control module from:

<!-- syncplay-example: unit-control-imports -->
```ts
import { createDeterministicMath } from '@series-inc/rundot-syncplay'
import {
  createSyncplayUnitControlSlice,
  projectSyncplayUnitControl,
  stepSyncplayUnitControl,
  unitControlComponent,
} from '@series-inc/rundot-syncplay/modules/unit-control'
```

`createSyncplayUnitControlSlice()` is the only way to obtain the slice that
`stepSyncplayUnitControl` requires. It takes no arguments and returns the frozen
empty slice.

This API is **PROVISIONAL**. It owns temporary control phases and two-unit grab
bonds. The phases are `free`, `grabbing`, `grabbed`, `knockdown`, `grounded`,
and `standing-up`.

The input supplies the current sorted roster. The module enrolls new units as
free and removes units that leave the roster. Grab attempts, releases, throws,
struggles, and external knockdowns are explicit commands. The module emits
deterministic transition events. The projection reports `canAct` and the unit
at the other end of a bond.

Supply a `DeterministicMath` from `createDeterministicMath()` in the step
context, and use integer frame durations. The module declares
`mathProfile: 'integer-fixed'` in its own module identity. That declaration is
not a caller-side option; you cannot select a profile at the call site.

Keep combat, movement, health, and rendering policy in the consuming game.
