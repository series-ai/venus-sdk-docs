# Agent Runtime (BETA)

Use `@series-inc/rundot-agent` to build a durable chat agent or game character.
The package runs the model and tool loop. It also stores the conversation,
recovers after a reload, retries safe operations, and pauses for player input.

Use the [AI API](api/AI.md) directly when you need one completion. Use the
agent runtime when the model must use tools or continue a stored conversation.

{% hint style="warning" %}
The agent runtime is in beta. Install it with the `beta` tag. Do not install it
without a tag. The default npm tag does not yet contain the beta runtime.
{% endhint %}

## Install

```bash
npm install @series-inc/rundot-agent@beta
```

The agent runtime is a separate package. It uses `textGen` and `appStorage`, but
it does not import the RUN game SDK at runtime. You can use the version of the
game SDK that your game already has.

## Create an agent

This example creates a game character with three tools:

- `look_around` reads game state.
- `accept_quest` changes game state after player approval.
- `ask_user` asks the player for more information.

```ts
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
import {
  createAgent,
  createAskUserTool,
  defineAgentTool,
  type AgentValidationResult,
} from '@series-inc/rundot-agent'
import {
  createTextGenTransport,
  createVenusSessionStore,
} from '@series-inc/rundot-agent/venus'

interface QuestInput {
  questId: 'signal-in-the-fog'
}

const validateQuest = (
  input: unknown,
): AgentValidationResult<QuestInput> => {
  if (
    typeof input === 'object' &&
    input !== null &&
    'questId' in input &&
    input.questId === 'signal-in-the-fog'
  ) {
    return {
      success: true,
      value: { questId: 'signal-in-the-fog' },
    }
  }

  return {
    success: false,
    issues: [{ path: 'questId', message: 'Expected signal-in-the-fog' }],
  }
}

const validateNoInput = (
  input: unknown,
): AgentValidationResult<Record<string, never>> => {
  if (
    typeof input === 'object' &&
    input !== null &&
    Object.keys(input).length === 0
  ) {
    return { success: true, value: {} }
  }

  return {
    success: false,
    issues: [{ path: 'root', message: 'Expected no input' }],
  }
}

const agent = createAgent({
  model: createTextGenTransport(RundotGameAPI.textGen, {
    mode: 'open',
    modelClass: 'standard',
  }),
  models: ['gpt-5.6-luna'],
  instructions: [
    'You are Mira, a signal keeper in a game.',
    'Keep each answer short.',
    'Use look_around when the player asks about the scene.',
    'Use accept_quest only when the player asks to accept the quest.',
    'Do not claim that an action happened unless its tool result confirms it.',
  ].join(' '),
  tools: {
    look_around: defineAgentTool({
      description: 'Read the current scene.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      validate: validateNoInput,
      execute: () => ({
        location: 'Emberwatch camp',
        weather: 'Warm rain',
      }),
    }),
    accept_quest: defineAgentTool<
      QuestInput,
      { accepted: true; title: string }
    >({
      description: 'Accept the signal quest for the player.',
      inputSchema: {
        type: 'object',
        properties: {
          questId: { type: 'string', const: 'signal-in-the-fog' },
        },
        required: ['questId'],
        additionalProperties: false,
      },
      validate: validateQuest,
      approval: 'always',
      idempotency: 'none',
      execute: () => ({
        accepted: true,
        title: 'Signal in the Fog',
      }),
    }),
    ask_user: createAskUserTool({
      description: 'Ask the player one short question.',
    }),
  },
  store: createVenusSessionStore(RundotGameAPI.appStorage, {
    namespace: 'my-game/mira',
    concurrency: 'compare_and_swap',
  }),
  concurrency: 'reject',
  maxTurns: 12,
})
```

`inputSchema` tells the model which arguments it can send. `validate` checks the
arguments before the tool runs. You must provide both.

Use `idempotency: 'none'` for an action that is not safe to repeat. Use
`idempotency: 'by_call_id'` only when the same call ID can safely run again
after a crash.

## Open or create a session

`createSession` creates a new session. It fails with `CONFLICT` if the ID exists.
`openSession` opens an existing session and runs recovery.

Use both operations as shown here. The `CONFLICT` case handles two clients that
try to create the same session at the same time.

```ts
import type { Agent, AgentSession } from '@series-inc/rundot-agent'

const SESSION_ID = 'mira-v1'

const errorCode = (error: unknown): string | null =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : null

async function openOrCreate(agent: Agent): Promise<AgentSession> {
  const exists = (await agent.listSessions()).some(
    session => session.id === SESSION_ID,
  )

  if (exists) return agent.openSession(SESSION_ID)

  try {
    return await agent.createSession({
      id: SESSION_ID,
      name: 'Mira',
    })
  } catch (error) {
    if (errorCode(error) !== 'CONFLICT') throw error
    return agent.openSession(SESSION_ID)
  }
}
```

Use a stable session ID for one conversation. Use a different ID when the game
needs separate conversations for separate characters, quests, or save slots.

## Send a message

```ts
const session = await openOrCreate(agent)

const result = await session.send(
  { text: 'What is happening near the tower?' },
  { signal: abortController.signal },
)

console.log(result.text)
```

Pass an `AbortSignal`. Abort active work when the game pauses or closes. The
[Lifecycles API](api/LIFECYCLES.md) describes the host lifecycle events.

## Show streamed text and tool activity

Subscribe before you call `send` or `resume`.

```ts
const unsubscribe = session.subscribe(event => {
  switch (event.type) {
    case 'text_delta':
      appendAssistantText(event.delta)
      break
    case 'model_stream_reset':
      clearAssistantText()
      break
    case 'tool_started':
      showActivity(event.callId, event.toolName)
      break
    case 'tool_finished':
      finishActivity(event.callId, event.isError)
      break
    case 'retry_scheduled':
      showStatus(`Retrying, attempt ${event.attempt}`)
      break
    case 'model_fallback':
      showStatus('Changing model')
      break
  }
})

try {
  await session.send({ text: 'Look around.' })
} finally {
  unsubscribe()
}
```

The session sends events in order. `run_finished` is the last event in one run.
Its result is the same result that `send` returns.

## Handle approval and player questions

A tool with `approval: 'always'` does not run at once. The run ends with
`finishReason: 'interrupted'`. Store the interruption in the UI and ask the
player to approve, edit, or reject it.

```ts
const first = await session.send({ text: 'Accept the quest.' })

if (first.finishReason === 'interrupted') {
  const decisions = first.interruptions.map(interruption => ({
    interruptionId: interruption.id,
    decisionId: crypto.randomUUID(),
    type: 'approve' as const,
  }))

  const continued = await session.resume(decisions)
  console.log(continued.text)
}
```

Use these decision types:

| Type | Result |
| --- | --- |
| `approve` | Run the tool with its validated input. |
| `edit` | Validate and run the replacement input. |
| `reject` | Do not run the tool. Return a safe error to the model. |
| `respond` | Return the player's answer to an `ask_user` call. |

Send one decision for each pending interruption. Use a new `decisionId` for a
new decision. Reusing the same ID makes a repeated submission safe.

Do not enable the message composer while a decision is pending. A new `send`
cannot bypass a pending decision.

## Support multiple tabs and devices

Use this store option for `appStorage`:

```ts
createVenusSessionStore(RundotGameAPI.appStorage, {
  namespace: 'my-game/mira',
  concurrency: 'compare_and_swap',
})
```

Compare-and-swap lets only one writer commit the next session change. A stale
writer receives `CONFLICT`. Do not retry that write in the same session object.
Show a message such as “This conversation changed in another tab.” Then let the
player reopen the session.

Do not use `singleWriter: true` when two tabs, devices, or workers can access the
same storage bucket.

## Recover after a reload

Call `openSession` after a reload. It applies a new writer fence and checks
unfinished work.

The runtime repeats a pending tool only when you marked that exact call safe to
repeat. It closes other pending tools with an “outcome unknown” result. This
rule prevents a reload from silently repeating a game action.

Read the stored conversation after you open the session:

```ts
const session = await agent.openSession(SESSION_ID)
const messages = await session.getMessages()
```

## Reset a conversation

Close the current session before you delete it. Then create a new session with
the same ID.

```ts
await session.close()
await agent.deleteSession(SESSION_ID)
const newSession = await agent.createSession({ id: SESSION_ID })
```

Block `send`, `resume`, and repeated reset actions while this transition runs.
Use an operation ID in the UI so an older load cannot replace the state from a
newer reset.

## UI states to support

A complete chat UI should show these states:

- connection and session restore;
- streamed assistant text;
- an animated thinking indicator;
- active and failed tools;
- retry and model fallback status;
- approval, edit, reject, and ask-user controls;
- a multi-tab conflict with a reopen action;
- an error with the correct retry action;
- an empty state and a start-over action.

Keep the message composer disabled during a run, a decision, a load, or a reset.
Make suggestion controls scroll or wrap on a narrow screen. Keep menus above the
message list and outside clipped containers.

## Security and cost limits

- Keep game authority in tools. The model can request an action. The tool must
  validate and perform it.
- Require approval for purchases, rewards, destructive changes, and important
  game-state changes.
- Do not put provider keys or other secrets in the browser. TextGen supplies
  the hosted model connection.
- The default run limit is 16 provider turns. Set a lower `maxTurns` value when
  the game needs a lower cost limit.
- Tools run in sequence in the current beta.
- Tool errors shown to the model do not contain stacks, arguments, or partial
  output.

## Test the integration

Use a fake transport and fake storage for automated tests. Do not spend live AI
credits in the test suite.

Test these cases before release:

1. Send a message and receive streamed text.
2. Run a read-only tool.
3. Approve and reject an important tool.
4. Answer an `ask_user` question.
5. Reload and restore the conversation.
6. Open the conversation in two tabs and handle `CONFLICT`.
7. Reset while an older load is still pending.
8. Stop an active run with an `AbortSignal`.
9. Render the chat at a narrow mobile width.

Use [Testing Locally With Playground](playground.md) for one live TextGen test
after the deterministic tests pass.

## Package reference

The npm package contains the complete API reference and release information:
<https://www.npmjs.com/package/@series-inc/rundot-agent>.

Related RUN documentation:

- [AI API](api/AI.md)
- [Storage API](api/STORAGE.md)
- [Lifecycles API](api/LIFECYCLES.md)
- [Error Handling](error-handling.md)
