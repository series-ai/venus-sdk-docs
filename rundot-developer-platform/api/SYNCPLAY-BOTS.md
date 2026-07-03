# Syncplay: Bots & AI (BETA)

Deterministic decision-making for bots and NPCs. Because a Syncplay game runs on
every client, bot behavior must be **identical everywhere** — you cannot call
`Math.random()` or read the clock to make a decision. These primitives give you
four battle-tested AI models whose output is a pure function of a **blackboard**
(the bot's memory), so every client computes the same action on the same tick.

Bots occupy **real player slots**. A match can mix humans and bots, and a
disconnected player can be backfilled by one — the [input authority](SYNCPLAY.md#7-go-multiplayer)
treats a bot slot exactly like a human slot, so convergence is unaffected.

Import everything from `@series-inc/rundot-game-sdk/syncplay/browser`. This page
builds on the [Syncplay guide](SYNCPLAY.md); read that first for the step-function
and determinism model.

***

## The shape of a bot

A bot is: **a blackboard + one or more decision models that read it.** Each tick,
inside your [step function](SYNCPLAY.md#2-write-the-step-function), you:

```
1. write the world into the blackboard   (enemyVisible, healthPct, distanceToGoal …)
2. tick a decision model                 → it returns action name(s) + next agent state
3. apply those actions to your game state (move, shoot, reload …)
```

The models never touch your game state directly — they only read the blackboard
and emit **action strings**. You decide what each action means. That indirection
is what keeps them pure and rollback-safe.

***

## The blackboard

The blackboard is an immutable, sorted set of typed key/value facts. Values are
`boolean | number | string` (keep numbers integer/fixed-point — the
[determinism rules](SYNCPLAY.md#3-determinism-rules-read-this--its-the-whole-game)
apply here too).

```typescript
import { createDeterministicBotBlackboard, getBlackboardValue } from '@series-inc/rundot-game-sdk/syncplay/browser'

const blackboard = createDeterministicBotBlackboard([
  { key: 'enemyVisible', value: true },
  { key: 'healthPct',    value: 40 },
  { key: 'ammo',         value: 3 },
])

getBlackboardValue(blackboard, 'healthPct') // 40 | undefined
```

| | |
|---|---|
| `createDeterministicBotBlackboard(entries)` | Build a blackboard. Entries are **sorted by key** and hashed; a duplicate key **throws**. |
| `getBlackboardValue(blackboard, key)` | Read a value, or `undefined`. |

```typescript
interface DeterministicBotBlackboard {
  readonly entries: readonly { key: string; value: boolean | number | string }[]
  readonly hash: string
}
```

Rebuild the blackboard from the current world each tick before you tick a model —
it's cheap (a sort + hash) and keeps the bot reacting to live state.

***

## Model 1 — Behavior Tree

The default for most game AI. A tree of composite/leaf nodes evaluated
depth-first each tick; the tick returns the **actions** the active leaves fired.

```typescript
import { tickDeterministicBehaviorTree } from '@series-inc/rundot-game-sdk/syncplay/browser'
import type { DeterministicBehaviorTreeNode } from '@series-inc/rundot-game-sdk/syncplay/browser'

const tree: DeterministicBehaviorTreeNode = {
  id: 'root',
  type: 'selector',        // try children in order until one succeeds
  children: [
    {
      id: 'fight',
      type: 'sequence',    // all children must succeed, in order
      children: [
        { id: 'see-enemy', type: 'condition', key: 'enemyVisible', equals: true },
        { id: 'has-ammo',  type: 'condition', key: 'ammo', equals: 3 },
        { id: 'shoot',     type: 'action', action: 'shoot' },
      ],
    },
    { id: 'wander', type: 'action', action: 'wander' },   // fallback
  ],
}

const tick = tickDeterministicBehaviorTree(tree, blackboard)
// tick.status: 'success' | 'failure' | 'running'
// tick.actions: ['shoot']  ← apply these to your game state
for (const action of tick.actions) applyBotAction(slot, action)
```

### Node types

`DeterministicBehaviorTreeNode` is a discriminated union on `type`:

| `type` | Fields | Behavior |
|---|---|---|
| `sequence` | `children[]` | Runs children in order; **fails at the first failure**, succeeds if all succeed. Logical AND. |
| `selector` | `children[]` | Runs children in order; **succeeds at the first success**. Logical OR / fallback. |
| `decorator` | `mode`, `child` | Wraps one child. `mode`: `invert` \| `force-success` \| `force-failure`. |
| `condition` | `key`, `equals` | Succeeds iff `blackboard[key] === equals`. A pure guard — fires no action. |
| `action` | `action`, `status?` | A leaf that emits the `action` string. Optional fixed `status` (default `success`). |

Every node has a unique `id`. Any node may carry `services` — periodic side-updates
(`{ id, action, intervalFrames }`) that fire on a cadence while the subtree is active.

### Return shape

```typescript
interface DeterministicBehaviorTreeTick {
  readonly status: 'success' | 'failure' | 'running'
  readonly actions: readonly string[]      // fire these
  readonly visitedNodeIds: readonly string[] // for debugging / traces
}
```

### Stateful variant

`tickDeterministicBehaviorTreeWithMemory(tree, blackboard, memory)` remembers which
nodes were `running` last tick and **resumes** them, so a long-running action
(e.g. "path to cover") isn't restarted from the root every frame. It returns a
`DeterministicBehaviorTreeStatefulTick` that adds `memory` (feed it back next
tick), `resumedNodeIds`, and `serviceActions`. Store the returned `memory` in your
per-bot game state.

***

## Model 2 — Hierarchical State Machine (HFSM)

Best when the bot has clear modes (`patrol` → `chase` → `attack`) with explicit
transitions. Transitions fire on a blackboard key matching a value.

```typescript
import { tickDeterministicHfsm } from '@series-inc/rundot-game-sdk/syncplay/browser'

const machine = {
  initialState: 'patrol',
  states: [
    { id: 'patrol', action: 'wander' },
    { id: 'chase',  action: 'moveToEnemy' },
    { id: 'attack', action: 'shoot' },
  ],
  transitions: [
    { from: 'patrol', to: 'chase',  whenKey: 'enemyVisible', equals: true },
    { from: 'chase',  to: 'attack', whenKey: 'inRange',      equals: true },
    { from: 'attack', to: 'chase',  whenKey: 'inRange',      equals: false },
  ],
}

// agent is per-bot state you persist in your game state
let agent = { state: 'patrol', transitionsTaken: 0, actionLog: [] }
agent = tickDeterministicHfsm(machine, agent, blackboard)
// agent.state → the current state; look up its `action` to apply
```

| Type | Fields |
|---|---|
| `DeterministicHfsmState` | `id`, optional `parent` (hierarchy), optional `action` |
| `DeterministicHfsmTransition` | `from`, `to`, `whenKey`, `equals` |
| `DeterministicHfsmDefinition` | `initialState`, `states[]`, `transitions[]` |
| `DeterministicHfsmAgent` (per-bot state) | `state`, `transitionsTaken`, `actionLog[]` |

`tickDeterministicHfsm` returns the **next** agent (pure). The first matching
transition out of the current state wins; store the returned agent per bot.

***

## Model 3 — Utility AI

Best when many options compete and you want the bot to pick the *best-scoring*
one (e.g. "flee vs. heal vs. attack" weighed by health/ammo/distance). Each
consideration scores a blackboard input through a curve; the highest weighted
score wins.

```typescript
import { selectDeterministicUtility } from '@series-inc/rundot-game-sdk/syncplay/browser'

const choice = selectDeterministicUtility(
  [
    { id: 'attack', inputKey: 'enemyDistance', action: 'shoot', min: 0, max: 100, weight: 1, curve: 'inverse' },
    { id: 'heal',   inputKey: 'healthPct',     action: 'heal',  min: 0, max: 100, weight: 2, curve: 'inverse' },
    { id: 'roam',   inputKey: 'boredom',       action: 'wander', min: 0, max: 100, weight: 1, curve: 'linear' },
  ],
  blackboard,
)
// choice.action: 'heal'  ← the winner
applyBotAction(slot, choice.action)
```

`DeterministicUtilityConsideration` fields:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Unique id. |
| `inputKey` | `string` | Blackboard number to score. |
| `action` | `string` | Action emitted if this wins. |
| `min` / `max` | `number` | Normalization range for the input. |
| `weight` | `number` | Multiplier on the normalized score. |
| `curve` | `'linear' \| 'inverse' \| 'quadratic' \| 'step'` | Response curve (default `linear`). |
| `rank` | `number?` | Tie-break / priority band. |
| `momentumKey` / `momentum` | | Bias toward last frame's choice (reduce thrashing). |
| `cooldownKey` / `cooldownPenalty` | | Penalize a recently-used action. |
| `nested` | `DeterministicUtilityNestedConsideration[]?` | Sub-considerations combined into this score. |

Return shape:

```typescript
interface DeterministicUtilitySelection {
  readonly action: string          // winning action
  readonly considerationId: string // which consideration won
  readonly score: number           // its final score
  readonly scores: readonly { id: string; score: number }[] // all, for debugging
}
```

***

## Authoring a bot as a document (recommended)

For anything beyond a trivial tree, author the whole bot as a **document** and
compile it. A document bundles a blackboard + any of the three models + asset
references, validates them together, and produces a compact, hashed, cooked form
you can ship and replay.

```typescript
import { compileDeterministicBotDocument } from '@series-inc/rundot-game-sdk/syncplay/browser'
import type { DeterministicBotDocument } from '@series-inc/rundot-game-sdk/syncplay/browser'

const doc: DeterministicBotDocument = {
  id: 'grunt',
  version: 1,
  blackboard: [
    { key: 'enemyVisible', value: false },
    { key: 'healthPct', value: 100 },
  ],
  behaviorTree: tree,        // and/or hfsm, and/or utility
  assetRefs: ['anim:grunt'], // cooked asset ids this bot references
}

const compiled = compileDeterministicBotDocument(doc, ['anim:grunt'])
// compiled: { id, hash, bytes, blackboard }
//  - hash:  identity for replay verification
//  - bytes: the serialized bot, safe to store/ship
//  - blackboard: the initial blackboard, ready to tick
```

| Function | Purpose |
|---|---|
| `compileDeterministicBotDocument(doc, validAssetRefs?)` | Validate + compile a document. Throws on an unknown asset ref, duplicate keys, or a malformed model. |
| `traceDeterministicBotDocument(...)` | Run a compiled bot over scripted blackboard inputs and record the decisions — for tests and tuning. |
| `summarizeDeterministicBotDocumentTraceCoverage(...)` | Report which nodes/states a trace exercised (find dead branches). |

`cookDeterministicBotAsset(source)` is the lower-level equivalent when you have a
`DeterministicBotAssetSource` (`{ id, hfsm?, behaviorTree?, utility? }`) rather than
a full document.

***

## Putting it together

A minimal bot inside a Syncplay step:

```typescript
function stepBots(state: State): State {
  const bots = [...state.bots]
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i]

    // 1. observe → blackboard
    const bb = createDeterministicBotBlackboard([
      { key: 'enemyVisible', value: canSeeEnemy(state, bot) },
      { key: 'ammo', value: bot.ammo },
    ])

    // 2. decide
    const tick = tickDeterministicBehaviorTree(bot.tree, bb)

    // 3. apply (your rules — deterministic, fixed-point)
    bots[i] = applyActions(bot, tick.actions)
  }
  return { ...state, bots }
}
```

Everything here is a pure function of `state`, so it predicts and rolls back with
the rest of your simulation, and shows up identically on every client.

***

## Determinism notes

- Numbers in the blackboard and considerations must be **integer or fixed-point**;
  a float can score differently across engines and desync one client.
- Do not seed decisions with `Math.random()` — if a bot needs randomness, draw it
  from `ctx.random` (the [server-owned seed](SYNCPLAY.md#7-go-multiplayer)) and
  write the result into the blackboard.
- Store per-bot agent state (HFSM `agent`, behavior-tree `memory`) **in your
  simulation state**, not in a module variable — otherwise it won't roll back.

***

## See also

- [Syncplay guide](SYNCPLAY.md) — the core model, step function, determinism rules.
- [Syncplay: built-in systems](SYNCPLAY.md#4-built-in-systems-all-deterministic) —
  physics, movement, pathfinding, animation, lag compensation.
