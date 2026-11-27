# Notifications API

Schedule reminders, re-engagement prompts, and cross-channel messages through one unified call — `submitMessageAsync`. The host routes each request across on-device local notifications, the durable messaging inbox, and RCS/SMS (when the player is reachable).

{% hint style="warning" %}
All SDK methods can reject; unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Local reminder in one hour (host-only — no server call)
const local = await RundotGameAPI.notifications.submitMessageAsync({
  channels: ['local'],
  title: 'Daily Reward Ready',
  body: 'Come back to claim your chest!',
  delaySeconds: 60 * 60,
})

// Durable in-app inbox message (server-side, free for all games)
const inboxOnly = await RundotGameAPI.notifications.submitMessageAsync({
  channels: ['inbox'],
  title: 'Season Milestone',
  body: 'You unlocked the Silver Chest!',
  collapseKey: 'season-milestone',
})

// Cross-channel: local on native when available, RCS as fallback (when enabled), inbox always written server-side
const cross = await RundotGameAPI.notifications.submitMessageAsync({
  channels: ['local', 'rcs'],
  title: 'Energy Full!',
  body: 'Your energy has fully recharged.',
  delaySeconds: 30 * 60,
  collapseKey: 'energy',
})

// Cancel the on-device handle from the local result
const localResult = cross.results.find((r) => r.channel === 'local')
if (localResult?.id) {
  await RundotGameAPI.notifications.cancelNotification(localResult.id)
}
```

## `submitMessageAsync(input): Promise<SubmitMessageResult>`

Unified scheduling entry point. Pass one or more delivery channels; the host and server fan out from there.

### Input (`SubmitMessageInput`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channels` | `('local' \| 'inbox' \| 'rcs')[]` | Yes | Non-empty. Pass `'inbox'` to write a durable bell-inbox row without RCS, or `'rcs'` to attempt RCS delivery alongside the inbox row. |
| `title` | `string` | Yes* | Notification title. Required unless `templateId` is provided. |
| `body` | `string` | Yes* | Notification body. Required unless `templateId` is provided. |
| `templateId` | `string` | Yes* | Server-rendered template id — alternative to free-text `title` + `body` for inbox/RCS content. |
| `params` | `Record<string, string>` | No | Interpolation params for `templateId`. |
| `collapseKey` | `string` | No | Cross-channel supersede key (replaces a prior live inbox row for the same game + key). |
| `ctaUrl` | `string` | No | Opaque continuation id for RCS; resolved to OneLink at send time. |
| `continuationParams` | `Record<string, string>` | No | Hydrated into H5 `notificationParams` on CTA tap. |
| `image` | `string` | No | Image URL for RCS. |
| `triggerAt` | `string` | No | ISO8601 UTC. Mutually exclusive with `delaySeconds`. |
| `delaySeconds` | `number` | No | Seconds from now. Mutually exclusive with `triggerAt`; max 7 days. |
| `payload` | `Record<string, unknown>` | No | Extra data attached to the local notification. |
| `notificationId` | `string` | No | Stable local dedupe/cancel handle per reminder type (distinct from `collapseKey`). Reuse one ID per reminder type; do not mint a new ID per call. See Replacement and deadline semantics. |
| `priority` | `number` | No | Local scheduling priority (default 50). |
| `groupId` | `string` | No | Legacy local grouping key. |

\* Provide either free-text `title` + `body`, or a `templateId` (with optional `params`) — the server renders the template for inbox and RCS. The `local` channel does not render templates, so include `title` + `body` whenever `channels` contains `'local'`. If `templateId` is not a known template, the server uses `title` + `body` for the inbox row and skips RCS with `reason: 'unknown_template'`. An earlier RCS skip reason (`feature_disabled`, `local_owns_interruptive` or `already_scheduled`) is reported instead when it applies. If `templateId` is unknown and `title` or `body` is missing, the call fails with HTTP 400.

Exactly one of `triggerAt` or `delaySeconds` when timing is needed. A past `triggerAt` schedules immediately (`seconds = 0`).

#### Host-reserved `payload` keys

The host owns a handful of key names on the notification envelope and strips
them from the extras your game receives, so a payload entry with one of these
names is dropped rather than delivered. Name your extras something else:

`appId`, `title`, `body`, `key`, `roomId`, `roomType`, `persistentKey`, `roomCode`,
`url`, `uri`, `payload`, `sourceType`, `contentId`, `commentId`, `contentTitle`,
`parentCommentId`, `__runLocalNotificationReceipt`

`title`/`body` are the notification's own display copy; `__runLocalNotificationReceipt`
is a host-reserved private tracking receipt stripped from creator payloads, scheduled
notification listings (`getAllScheduledLocalNotifications()`), and incoming tap
launch parameters; `roomId`, `roomType`, `persistentKey`, and `roomCode` are
attached by the platform for room notifications and invites; the rest address
the notification's transport or tell the host which screen to open — a
`sourceType` of `comment`, for instance, routes the tap to the comment thread
instead of launching your game. (`roomId` is also stripped on web; see below.)

### Result (`SubmitMessageResult`)

| Field | Type | Description |
|-------|------|-------------|
| `messageId` | `string` | Logical message transaction id shared across channels (host-issued on native). Does **not** indicate local delivery status. |
| `results` | `SubmitMessageChannelResult[]` | Per-channel outcomes. |

The top-level `messageId` is an envelope transaction identifier. Permission requirements and channel outcomes cannot be inferred from `messageId`; always inspect `results.find((r) => r.channel === 'local')` for local delivery state.

Each `SubmitMessageChannelResult`:

| Field | Type | Description |
|-------|------|-------------|
| `channel` | `'local' \| 'rcs' \| 'inbox'` | Delivery surface. |
| `status` | `'scheduled' \| 'skipped'` | Whether that channel was armed. |
| `id` | `string` (optional) | Channel-specific handle (`local` notification id, RCS `scheduleId`, inbox row id). Absent on skipped/permission-required outcomes. |
| `reason` | `string` (optional) | `storage_full` identifies a local memory deferral with `status: 'scheduled'`. Other values explain a skipped channel: `permission_required`, `unsupported_platform`, `local_owns_interruptive`, `needs_consent`, `no_phone`, `already_scheduled`, `feature_disabled`, `template_disabled`, `unknown_template`, `error`. |

### Handling local results

Inspect `localResult.status` and `localResult.reason` to handle immediate scheduling versus permission deferral:

```typescript
const res = await RundotGameAPI.notifications.submitMessageAsync({
  channels: ['local'],
  title: 'Harvest Ready!',
  body: 'Your wheat is ready to harvest.',
  delaySeconds: 300,
  notificationId: 'crop-harvest-1',
})

const localResult = res.results.find((r) => r.channel === 'local')
if (localResult?.status === 'scheduled') {
  // Accepted by OS scheduler; localResult.id is the active native ID
  console.log('Scheduled native reminder:', localResult.id)
} else if (localResult?.status === 'skipped') {
  if (localResult.reason === 'permission_required') {
    // OS permission denied or undetermined; saved as a durable intent for recovery
    console.log('Local reminder queued pending notification permission')
  } else {
    // Muted, disabled, throttled, or unsupported platform
    console.log('Local reminder skipped:', localResult.reason)
  }
}
```

### Native local delivery semantics

#### Scheduler acceptance & banner guarantees
A local channel result normally reports `status: 'scheduled'` after the native engine accepts the schedule. A local-only request can also return `status: 'scheduled'`, `reason: 'storage_full'`, and a cancellation `id` when device storage is full. The host keeps this request in memory. The legacy `scheduleAsync(...)` wrapper returns the same `id`. Do not submit the request again.

The host retries after a five-minute pause while the app is in the foreground. Timed requests keep their original delivery deadline and expire when that deadline passes. Immediate requests expire ten minutes after their first disk-full deferral. Further failures do not extend this limit. Recovery before expiry still uses an immediate native trigger. The request is also lost if the host process stops before recovery. Use `cancelNotification(id)` to cancel it before or after recovery. A full memory queue rejects new requests with `skipped(error)` and keeps accepted requests. Requests with server channels do not use this memory queue.

Native scheduler acceptance registers the request with the OS; it does **not** guarantee an interruptive delivery banner, sound, or foreground alert. Visible delivery presentation depends on OS focus modes, notification permissions, and system foreground display policies.

#### Permission and authorization policy
- **iOS**: Delivery is permitted when authorized by `AUTHORIZED`, `PROVISIONAL`, or `EPHEMERAL`. `PROVISIONAL` authorization schedules quietly (delivering directly into Notification Center without an interruptive alert or sound).
- **Android**: Standard system notification permission status applies.
- **No APNs allowlist**: Local notifications do not require an APNs game allowlist (unlike push/server channels).
- **Per-game toggles**: In-game player settings (`isLocalNotificationsEnabled()`, `setLocalNotificationsEnabled()`) and platform mute preferences remain unchanged and gate local delivery directly.

#### Missing permission & durable queue (local-only)
When OS notification permission is undetermined or denied:
- A local-only submission (`channels: ['local']`) returns `{ channel: 'local', status: 'skipped', reason: 'permission_required' }` without a local `id`.
- The legacy `scheduleAsync(...)` wrapper returns `null` (legacy bridge returns `{ id: null, scheduled: false }`).
- A durable, user-owned future intent is stored for the active Firebase account.
- **Recovery on startup, resume, or priming**: The host attempts recovery on native cold start, on transition to `active` (e.g. the player returns from iOS Settings), or upon in-game permission primer approval. If OS permission is now allowed and verified current preferences permit, the intent is submitted to the native scheduler.
- **Preserved original deadline**: Recovery calculates the remaining interval against the original requested deadline (`fireAtMs`), using `max(1, ceil((fireAtMs - now) / 1000))`. It does **not** reset the original delay.
- **Discarding invalid intents**: Expired, muted, disabled, foreign/unowned, or malformed intents are permanently discarded.

#### Account scope & sign-out
Queue intents are strictly scoped to the authenticated account UID:
- Account sign-out or switching accounts immediately invalidates outgoing work and purges stored intents owned by the outgoing account.
- Native requests previously created by the queue for that owner are canceled.
- A new account cannot replay or cancel another account's reminders.

### Local vs server (`inbox` / `rcs`) routing (native)

When `channels` includes `local` alongside `'inbox'` or `'rcs'`:

1. The host **attempts local first** and records whether the native scheduler actually accepted the schedule (`status === 'scheduled'`).
2. If local was accepted, the server **suppresses RCS** (`local_owns_interruptive`) so the player gets at most one interruptive delivery.
3. If local was skipped due to missing permission:
   - Local returns `status: 'skipped'`, `reason: 'permission_required'` without a local ID.
   - **No recoverable local queue intent is stored** for mixed-channel calls.
   - `localWillDeliver` is set to `false`, allowing normal RCS server fallback to proceed (when RCS is enabled for the game).
4. If local declined for other reasons (muted, disabled, throttled, error), RCS proceeds as the **fallback** interruptive channel.
5. The durable `inbox` row is **always written** whenever a server channel (`'inbox'` or `'rcs'`) runs — even if paid RCS is disabled for the game.

`channels: ['local']` alone never hits the server — same behavior as legacy local-only scheduling.

### Replacement and deadline semantics (`notificationId`)

- Passing a custom `notificationId` replaces any existing queued intent or scheduled native reminder for that game and ID.
- Without a `notificationId`, a queued reminder with the same title and body refreshes in place: it keeps its queued ID and takes the newest deadline and payload. Distinct title or body text stays a distinct reminder. A queued intent that carries a custom ID never matches by text.
- While local delivery waits (for example, notification permission is not granted yet), the host holds at most **10 queued reminders per game**. A further distinct reminder is dropped (local result `skipped`, reason `capacity` where reported). Minting a new `notificationId` per call, such as a timestamp, fills this queue; use one stable ID per reminder type.
- **Important**: Each submission sets a **new deadline** based on the provided `delaySeconds` or `triggerAt`. Scheduling with `delaySeconds: 300` repeatedly extends the countdown 5 minutes further into the future from the time of each call.
- **Recommendation**:
  - For scheduled countdowns (e.g. farm harvest or stamina recharge), calculate the exact remaining seconds from a fixed deadline:
    ```typescript
    const delaySeconds = Math.max(1, Math.ceil((harvestDeadlineMs - Date.now()) / 1000))
    await RundotGameAPI.notifications.submitMessageAsync({
      channels: ['local'],
      title: 'Harvest Ready',
      body: 'Your crops are ready!',
      delaySeconds,
      notificationId: 'crop-harvest',
    })
    ```
  - Alternatively, arm the reminder once when the activity begins, and call `RundotGameAPI.notifications.cancelNotification('crop-harvest')` if the player collects early. Do not continually restart the full delay on repeated user actions.

### Listing pending notifications

`RundotGameAPI.notifications.getAllScheduledLocalNotifications()` lists OS-level scheduled requests accepted by the native notification center. It does **not** list pending durable queue intents awaiting OS permissions.

### What the host adds (native)

Every local notification carries your game's identity, so a player can tell which game it came from rather than seeing only RUN's icon:

- **Your game's name.** Android shows it in the notification header beside RUN; iOS shows it as a line under your `title`. Don't repeat the game's name in `title`.
- **Your game's catalog thumbnail**, as the notification's image. It's the same artwork your game's tile uses, saved once per device.

Both are automatic — there is nothing to pass and nothing to configure. A player whose device has no saved copy of the thumbnail (for example after the OS reclaims cache space) simply gets the notification without artwork.

### Web behavior

On run.world (web) there are no OS-level notifications; local schedules deliver to the platform's bell inbox instead:

- When a schedule fires it appears as an inbox item under the bell. If the fire time passed while the page was closed, it's delivered on the user's next visit.
- Pending schedules persist **per device** (in that browser's local storage). They survive reloads on the same device but do not roam across devices.
- Tapping the inbox item relaunches your game with the schedule's `payload` available via launch intent / `notificationParams` — or via a live `NOTIFICATION_PARAMS_UPDATE` if your game is already running.
- The host applies the same schedule-time gates as native (muted game, notifications toggle, throttling); an undeliverable schedule resolves with `id: null` — the same contract as native. Never treat a resolved call as delivered without null-checking the id.
- `roomId` is a reserved `payload` key and is stripped on web.

`channels: ['local']` alone (including the deprecated `scheduleAsync` shim) schedules for real on web. A call with `['local', 'inbox']` or `['local', 'rcs']` skips `local` on web (`skipped(unsupported_platform)`) and still executes the server channels when authenticated — the server-written inbox row is the single bell entry for the message.

## Enablement

The durable `'inbox'` channel is **free and available to every game without per-game enablement** — both when passed explicitly (`channels: ['inbox']`) and as the durable inbox row written by `channels: ['local', 'rcs']`.

Only **paid RCS/SMS** (`rcs`) requires per-game enablement by the RUN team (along with a monthly spend cap for the game). Before RCS is enabled for a game, every call still succeeds cleanly:

| Call | Result when RCS is not enabled |
|------|--------------------------------|
| `submitMessageAsync({ channels: ['inbox'] })` | `inbox` returns `status: 'scheduled'` with its row `id`. |
| `submitMessageAsync({ channels: ['local', 'rcs'] })` | `local` schedules normally, `inbox` returns `status: 'scheduled'`, and `rcs` returns `skipped` with `reason: 'feature_disabled'`. |
| `submitMessageAsync({ channels: ['local'] })` | Unchanged. Never touches the server. |
| `getRCSAvailableAsync()` | `{ available: false, reason: 'feature_disabled' }` |
| `requestRCSOptInAsync()` | Resolves `{ status: 'declined', newlySubscribed: false }` without showing the modal. Gate the opt-in button on `getRCSAvailableAsync()` so players do not see a dead button. |
| `scheduleRCSAsync()` (deprecated shim) | Resolves `{ scheduleId: <messageId>, status: 'skipped', reason: 'feature_disabled' }`. |

Build the integration against these results so the same code works before and
after RCS enablement.

## Quotas and 1P vs 3P limits

Different notification surfaces enforce separate anti-spam and spend limits:

- **Room & server-broker push notifications (`this.services.notifications.send`):**
  - **3P games:** Capped at **3 push notifications per recipient per UTC day** per room/source throttle scope (plus `everMemberIds` authorization, up to 1,000 members per room).
  - **1P internal games:** Bypass the 3/day recipient throttle cap. Player game-mute preferences (`mutedGameIds`) and `notificationKey` deduplication still apply to both 1P and 3P games.
- **Cold friend room invites (`RundotGameAPI.realtime.invitePlayers`):** Max **8 recipients** per call, **15-minute** per-(sender, recipient, game, room) cooldown, and **10 invites per hour** per sender per game (subject to recipient block lists and game mutes).
- **Local notifications (`channels: ['local']`):** No APNs allowlist or server quota; host scheduling debounces rapid bursts.
- **Paid RCS (`rcs`):** Enforces per-user daily quotas, per-game daily quotas, monthly spend caps, and TCPA opt-in rules when enabled.

## Cross-channel opt-in (RCS / SMS): BETA

Reach players outside the app over RCS (with SMS fallback). Availability depends on the user having a phone on file and an active opt-in.

{% hint style="warning" %}
RCS/SMS opt-in is regulated (TCPA). Always call `requestRCSOptInAsync` in response to a user gesture, never as a passive prompt on load.
{% endhint %}

```typescript
const optIn = await RundotGameAPI.notifications.requestRCSOptInAsync({
  rewardCopy: 'Get 100 gems, never miss an update.',
})

const { available } = await RundotGameAPI.notifications.getRCSAvailableAsync()

if (available) {
  await RundotGameAPI.notifications.submitMessageAsync({
    channels: ['local', 'rcs'],
    title: 'Your raid is ready',
    body: 'Tap to jump back in and claim your loot.',
    continuationParams: { screen: 'raid', raidId: 'abc123' },
    delaySeconds: 60 * 60 * 4,
  })
}
```

### `requestRCSOptInAsync(input?): Promise<RequestRCSOptInResult>`

Triggers the platform-owned RCS/SMS opt-in modal. Call on a user gesture (TCPA), not as a passive prompt.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `input.rewardCopy` | `string` | No | Copy interpolated into the modal heading. |

Returns `RequestRCSOptInResult` with `status` (`already_subscribed`, `subscribed`, `declined`, `pending_confirmation`) and `newlySubscribed` for one-shot reward gating.

### `getRCSAvailableAsync(): Promise<RCSAvailabilityStatus>`

| Field | Type | Description |
|-------|------|-------------|
| `available` | `boolean` | Whether a cross-channel message can be delivered. |
| `reason` | `'needs_consent' \| 'no_phone' \| 'feature_disabled' \| 'unknown'` (optional) | Why the user is not reachable when `available` is false. |

### Opt-in integration pitfalls

**Reconcile on launch AND resume.** `requestRCSOptInAsync` results are not guaranteed to reach your game. Run `getRCSAvailableAsync()` on launch/resume and grant rewards idempotically when `available` becomes true.

**Drive opt-in entry points from shared, refreshable state** — subscription changes outside your call stack (SMS reply, another entry point).

**Don't cache `getRCSAvailableAsync` across opt-in attempts** — invalidate after every opt-in result or reward grant.

**After `pending_confirmation`, tell users to reply "Y"** — resend buttons do not send another confirmation SMS.

## Receiving a tap

One rule: **boot → [`app.resolveLaunchIntent()`](APP.md#launch-intent), running →
[`lifecycles.onNotification()`](LIFECYCLES.md#onnotification--warm-notification-taps).**
A tap that launches your game surfaces as a launch intent (`kind:
'notification'`, payload in `params`); a tap while your game is already
running fires `lifecycles.onNotification` with the same flat params — the
game is not remounted.

## Deeplinking

When a user taps a notification, they're taken directly to your game by default. Use [`RundotGameAPI.app.resolveLaunchIntent()`](APP.md#launch-intent) to detect a notification launch and read its payload — `kind === 'notification'` with the payload in `params`:

```typescript
const intent = await RundotGameAPI.app.resolveLaunchIntent({ maxWaitMs: 800 })
if (intent.kind === 'notification') {
  handleNotificationLaunch(intent.params)
}
```

> The deprecated `RundotGameAPI.context.notificationParams` snapshot still works until v6.0.0, but `resolveLaunchIntent` is the supported path.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `submitMessageAsync(input)` | `Promise<SubmitMessageResult>` | Unified scheduling across local, inbox, and RCS. |
| `cancelNotification(id)` | `Promise<boolean>` | Cancel a scheduled **local** notification by its local id or queued intent handle. |
| `getAllScheduledLocalNotifications()` | `Promise<ScheduleLocalNotification[]>` | List pending OS-scheduled local notifications (excludes pending queue intents). |
| `isLocalNotificationsEnabled()` | `Promise<boolean>` | Check if local notifications are enabled for this game. |
| `setLocalNotificationsEnabled(enabled)` | `Promise<boolean>` | Enable or disable local notifications for this game. |
| `requestRCSOptInAsync(input?)` | `Promise<RequestRCSOptInResult>` | Prompt for RCS/SMS opt-in on a user gesture (BETA). |
| `getRCSAvailableAsync()` | `Promise<RCSAvailabilityStatus>` | Check RCS/SMS reachability (BETA). |

## Best Practices

- Use `collapseKey` to supersede stale reminders (energy, daily reward) instead of stacking inbox rows.
- Cancel local handles from `results.find(r => r.channel === 'local')?.id` when the underlying event completes.
- Inspect `localResult.status` rather than relying on top-level `messageId` to determine local scheduling success.
- For fixed event deadlines (e.g. crop harvest, building completion), calculate remaining time from the target timestamp or arm once and cancel on completion, rather than repeatedly restarting full delays.
- Keep payloads small; store heavy data with the SDK storage APIs and reference it by id.
- Throttle player-facing prompts; the host also debounces rapid local schedules.
- Call `requestRCSOptInAsync` only on explicit user action (TCPA).
