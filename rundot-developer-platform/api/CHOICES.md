# Choices API

The Choices API (`RundotGameAPI.choices`) provides an authorized partner-integration namespace for checking and spending the current user's Choices diamond currency balance from an authenticated RUN game.

***

## Access Requirements

Calling `/v1/choices/*` requires two server-enforced conditions:
1. The `run_tv_choices_diamonds_enabled` Statsig feature gate must be enabled.
2. The calling game's game-session-token `gid` claim must be explicitly allowlisted (e.g. `run-tv`). Unauthorized games will receive a `403 FORBIDDEN` error.

Linking a user account (`uid → altId`) is handled exclusively out-of-band by the platform ingress deeplink handler (`POST /v1/choices/link`). Games only check whether a player is linked or unlinked; they do not perform account linking directly.

***

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// 1. Fetch current diamond balance
try {
  const { diamonds } = await RundotGameAPI.choices.getBalance()
  console.log(`Current Choices diamonds: ${diamonds}`)
} catch (err: any) {
  if (err.code === 'NOT_LINKED') {
    // Player has not linked a Choices account; hide spend UI
    hideChoicesOption()
  } else if (err.code === 'SERVICE_UNAVAILABLE') {
    // Integration gate is disabled
    console.warn('Choices integration unavailable')
  }
}

// 2. Spend diamonds with idempotency
async function unlockEpisode(episodeId: string) {
  const clientRequestId = crypto.randomUUID() // Stable ID across retries

  try {
    const result = await RundotGameAPI.choices.spend({
      amount: 15,
      reason: `episode_unlock:${episodeId}`,
      clientRequestId,
    })

    console.log(`Deducted ${result.amountDebited} diamonds. New balance: ${result.newDiamonds}`)
    if (result.alreadyProcessed) {
      console.log('Replayed prior transaction:', result.transactionRef)
    }
  } catch (err: any) {
    if (err.code === 'INSUFFICIENT_FUNDS') {
      showInsufficientDiamondsModal()
    } else if (err.code === 'IN_PROGRESS') {
      // Transaction currently pending; retry with the same clientRequestId
      await retrySpend(clientRequestId)
    }
  }
}
```

***

## Methods

### `getBalance()`

```typescript
getBalance(): Promise<ChoicesBalance>
```

Fetches the authenticated user's current Choices diamond balance.

#### Errors
- `NOT_LINKED` (403): User has not linked their Choices account.
- `SERVICE_UNAVAILABLE` (503): Integration feature gate is disabled.
- `FORBIDDEN` (403): Calling game is not allowlisted.
- `UPSTREAM_ERROR` (502): Choices upstream mapping or reachability failure.
- `RATE_LIMITED` (429): Request throttled (check `Retry-After`).

***

### `spend(request)`

```typescript
spend(request: ChoicesSpendRequest): Promise<ChoicesSpendResult>
```

Debits diamonds from the current user's Choices wallet. Server idempotency guarantees that reusing the same `clientRequestId` across network retries replays the original outcome without double-charging.

#### Errors
- `INSUFFICIENT_FUNDS` (402): Balance is lower than requested spend amount.
- `INVALID_AMOUNT` (400): Amount is non-positive or exceeds the server per-call ceiling.
- `MALFORMED_REQUEST` (400): Empty or missing `reason` or `clientRequestId`.
- `IN_PROGRESS` (409): Prior transaction with the same `clientRequestId` is processing; retry with backoff.
- `NOT_LINKED` / `SERVICE_UNAVAILABLE` / `FORBIDDEN` / `UPSTREAM_ERROR` / `RATE_LIMITED`: Same semantics as `getBalance()`.

***

## Data Types

### `ChoicesBalance`

```typescript
interface ChoicesBalance {
  /** Current Choices diamond balance for the authenticated user. */
  diamonds: number
}
```

### `ChoicesSpendRequest`

```typescript
interface ChoicesSpendRequest {
  /** Positive integer bounded server-side to a per-call ceiling. */
  amount: number
  /** Free-form audit tag (e.g. 'episode_unlock:ep3') stored in the ledger. */
  reason: string
  /**
   * Stable identifier for this spend action. Must be reused across retries
   * of the same logical intent to prevent double-deduction.
   */
  clientRequestId: string
}
```

### `ChoicesSpendResult`

```typescript
interface ChoicesSpendResult {
  /** Balance after debit or replayed original balance. */
  newDiamonds: number
  /** The amount debited from the Choices wallet. */
  amountDebited: number
  /** Upstream ledger idempotency key for support auditing. */
  transactionRef: string
  /** True when the server replayed an existing committed transaction. */
  alreadyProcessed: boolean
}
```

***

## Best Practices

- **Generate a fresh UUID per distinct purchase action:** Never generate a new UUID on network retry of the same purchase attempt.
- **Handle `INSUFFICIENT_FUNDS` gracefully:** This is an expected business outcome, not a fatal exception. Direct users to purchase more diamonds or select another payment option.
