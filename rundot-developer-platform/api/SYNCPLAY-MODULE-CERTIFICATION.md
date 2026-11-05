# Syncplay module certification

> **PROVISIONAL:** The module certification API may change without deprecation
> until the [two-genre promotion gate](#the-two-genre-promotion-gate).

`certifyModule` checks a Syncplay component definition before it enters a game
composition:

```ts
import {
  certifyModule,
  type SyncplayModuleCertificationFixture,
} from '@series-inc/rundot-syncplay/tools'
import { thirdPersonCharacterComponent }
  from '@series-inc/rundot-syncplay/modules/component-model'

const result = await certifyModule(thirdPersonCharacterComponent, fixture)
if (!result.ok) {
  throw new Error(result.failures.map(({ code }) => code).join(','))
}
```

There is no `characterComponent` export. The two shipped character components are
`thirdPersonCharacterComponent` (`./modules/component-model`) and
`character3DComponent` (`./modules/character-3d`).

The fixture supplies four things:

- module source paths;
- the existing `runSyncplaySynctest` runtime factory and policy;
- pairs of equivalent inputs constructed in different iteration orders;
- warmup, sample count, and strict step-time/retained-heap limits.

Certification delegates straight, rollback, replay, hydration, and input fuzzing
to `runSyncplaySynctest`. It does not implement a second replay engine.

## Module source policy

Module source cannot use ambient `Math.*` or `Date`, import React, React Native,
Three.js, R3F, or another render module, own a random stream, or iterate
unordered object keys. Use deterministic math from the module context, explicit
authority inputs for random outcomes, and stable collection helpers.

### Which files the strict rules actually cover

Certification applies the strict rules to two sets of files, and nothing else:

1. **Every path you list in `fixture.sourcePaths`**, always.
2. **Transitively imported files**, but only when a listed path contains the
   literal substring `/src/modules`. Certification derives a module root by
   truncating that path at `/src/modules`, then treats every file under that
   root as module source.

{% hint style="danger" %}
**A game laid out outside `src/modules/` gets a green certification over
uninspected code.** If `fixture.sourcePaths` lists only
`game/src/character.ts`, a helper it imports from `game/src/helpers.ts` is never
collected. `Math.random()`, `new Date()`, and `Object.keys()` in that helper
produce no diagnostic, and `certifyModule` returns `ok: true`.

Do one of two things:

- put module source under a `src/modules/` directory, so import following
  covers the whole tree; or
- list **every** file of the module in `fixture.sourcePaths`. An explicitly
  listed file is always checked, wherever it lives.
{% endhint %}

Engine helpers outside the covered set are not reclassified as module source.
They are also not checked by this run at all — verify them with
`checkDeterminism` under the generic Syncplay determinism policy.

## Resource protocol

Run certification under Node with `--expose-gc`:

```sh
node --expose-gc --import tsx certify-game-modules.ts
```

Step time uses five warmed p99 batches. Certification runs the full declared
warm-up before each batch. It calculates p99 from the declared sample count.
It compares the median batch p99 with the declared limit. One or two slow
batches cannot change the median. A slowdown in three batches fails the
unchanged limit. Retained heap bytes per step are measured after forced GC while
every sampled result is kept reachable. Missing GC support fails closed. The
result never reports a zero-byte pass when GC support is missing.

## The two-genre promotion gate

Many Syncplay pages call an API provisional "until the two-genre promotion gate".
The gate is defined here.

A public module subpath is recorded in
`packages/syncplay/tests/golden/module-api-stability.json` with a `status` of
`provisional` or `stable`, the genre example games that consume it
(`consumerSources`), and a written `justification`.
`packages/syncplay/tests/module-promotion.test.ts` enforces that file.

A module stays **provisional** while one genre example game exercises its
contract. It is promoted to **stable** when a **second, different genre** example
game consumes the **full** contract in production code. The test enforces the
mechanical half: a `stable` row must name at least two verified consumer
sources, and each one must contain the module's public import specifier.

Two consumers are necessary but not sufficient. `./modules/stats-abilities`
has two consumers and stays provisional, because FPS imports only the canonical
empty stats target and does not exercise the full semantics.
`./modules/actors-ai` has two genre consumers and stays provisional until a
dedicated promotion review. The `justification` field records that decision.

Before the gate, an API may change without a deprecation period. After it, the
normal deprecation rules apply.

{% hint style="info" %}
The `./tools` subpath — which is where `certifyModule` lives — has **no entry**
in `module-api-stability.json`. The roster covers only `./modules/*` subpaths, and
`module-promotion.test.ts` asserts an exact match against them. The certification
API's own provisional status is therefore tracked by this page alone, not by the
promotion manifest.
{% endhint %}

## Stable failure codes

- `SYNCPLAY_MODULE_CERT_STATIC_MATH`
- `SYNCPLAY_MODULE_CERT_STATIC_DATE`
- `SYNCPLAY_MODULE_CERT_STATIC_RENDER_IMPORT`
- `SYNCPLAY_MODULE_CERT_STATIC_RANDOM`
- `SYNCPLAY_MODULE_CERT_STATIC_ITERATION`
- `SYNCPLAY_MODULE_CERT_STATIC_DETERMINISM`
- `SYNCPLAY_MODULE_CERT_ITERATION_ORDER`
- `SYNCPLAY_MODULE_CERT_SYNCTEST_DIVERGENCE`
- `SYNCPLAY_MODULE_CERT_TIME_BUDGET`
- `SYNCPLAY_MODULE_CERT_ALLOCATION_BUDGET`
- `SYNCPLAY_MODULE_CERT_EXECUTION_ERROR`

Malformed fixture declarations throw
`SYNCPLAY_MODULE_CERT_FIXTURE_INVALID` before module code executes. Component,
runtime, and fixture callback exceptions become
`SYNCPLAY_MODULE_CERT_EXECUTION_ERROR`; their arbitrary error text is not copied
into the result.
