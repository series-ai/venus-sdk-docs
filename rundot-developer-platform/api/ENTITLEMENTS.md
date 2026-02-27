# Entitlements API

Track what players own in your game. Entitlements represent items, power-ups, passes, and other in-game assets that are granted through purchases, rewards, or admin actions.

## Overview

Entitlements are server-authoritative records of player ownership. The server is the source of truth — games read entitlements via the SDK and consume them when used.

- **Granted** by the shop purchase flow, admin tools, or backend services (not directly by the SDK)
- **Consumed** by the game client via the SDK when a player uses a consumable item
- **Queried** by the game client to check what the player owns

Each entitlement is scoped to a `(userId, gameId, itemId)` tuple. If a player is granted the same item multiple times, the quantity is incremented on the existing entitlement rather than creating duplicates.

## Entitlement Types

| Type | `consumable` | Behavior |
|---|---|---|
| **Consumable** | `true` | Quantity decreases on use. Auto-revoked when quantity reaches 0. |
| **Non-consumable** | `false` | Permanent ownership. Cannot be consumed via the SDK. |
| **Time-bound** | either | Has an `expiresAt` timestamp. Automatically expired by the server. |

## SDK Usage

### List Entitlements

Get all active entitlements for the current player in the current game.

```typescript
const entitlements = await RundotGameAPI.entitlements.listEntitlements()

for (const ent of entitlements) {
  console.log(`${ent.itemId}: qty=${ent.quantity}, consumable=${ent.consumable}`)
  if (ent.expiresAt) {
    console.log(`  Expires: ${new Date(ent.expiresAt).toISOString()}`)
  }
}
```

### Get Quantity

Check how many of a specific item the player owns. Returns `0` if the entitlement doesn't exist or is not active.

```typescript
const coins = await RundotGameAPI.entitlements.getQuantity('gold_coins')
console.log(`Player has ${coins} gold coins`)

if (coins >= 10) {
  // Player can afford the upgrade
}
```

### Consume Entitlement

Use up a quantity of a consumable entitlement. The server deducts the quantity atomically and returns the updated entitlement. If quantity reaches 0, the entitlement is automatically revoked.

```typescript
const updated = await RundotGameAPI.entitlements.consumeEntitlement(
  'health_potion',  // itemId
  1,                // quantity to consume
)

console.log(`Remaining potions: ${updated.quantity}`)
```

**With callback** — the callback runs exactly once on success with the resulting entitlement and the referenceId that was used:

```typescript
await RundotGameAPI.entitlements.consumeEntitlement(
  'health_potion',
  1,
  (entitlement, referenceId) => {
    // Apply the game effect here
    player.heal(50)
    console.log(`Consumed with ref: ${referenceId}`)
  },
)
```

If the callback throws, the error is logged as a warning but the consume still succeeds — the entitlement quantity is already deducted server-side.

**With reason** — an optional human-readable reason stored in the ledger:

```typescript
await RundotGameAPI.entitlements.consumeEntitlement(
  'gold_coins',
  100,
  undefined,       // no callback
  'Bought armor',  // reason
)
```

### Idempotent Retries

Every consume call uses a unique `referenceId` for idempotency. If a network error occurs and you need to retry, pass the same referenceId so the server doesn't double-consume:

```typescript
let savedRefId: string | undefined

try {
  await RundotGameAPI.entitlements.consumeEntitlement(
    'coins',
    10,
    (_ent, refId) => {
      savedRefId = refId
      riskyOperation() // may throw
    },
  )
} catch {
  // Retry with the same referenceId — the server won't double-consume
  await RundotGameAPI.entitlements.consumeEntitlement(
    'coins',
    10,
    undefined,
    undefined,
    savedRefId,
  )
}
```

A referenceId is generated automatically if you don't provide one. Only pass one explicitly when retrying a failed call.

### Get Ledger

Retrieve the audit trail of all entitlement changes (grants, consumes, revokes, expirations) for the current player.

```typescript
// Get all recent ledger entries
const entries = await RundotGameAPI.entitlements.getLedger()

for (const entry of entries) {
  console.log(`${entry.action} ${entry.itemId}: ${entry.change} (balance: ${entry.balanceAfter})`)
}
```

**Filter by item:**

```typescript
const coinHistory = await RundotGameAPI.entitlements.getLedger('gold_coins')
```

**With pagination:**

```typescript
// First page
const page1 = await RundotGameAPI.entitlements.getLedger(undefined, 20)

// Next page — pass the createdAt of the last entry
const lastEntry = page1[page1.length - 1]
const page2 = await RundotGameAPI.entitlements.getLedger(undefined, 20, lastEntry.createdAt)
```

## Type Reference

### Entitlement

```typescript
interface Entitlement {
  entitlementId: string
  userId: string
  gameId: string
  itemId: string
  quantity: number
  consumable: boolean
  status: 'active' | 'revoked' | 'expired'
  expiresAt: number | null     // ms since epoch, null = permanent
  createdAt: number            // ms since epoch
  updatedAt: number            // ms since epoch
  revokedAt: number | null     // ms since epoch
}
```

### LedgerEntry

```typescript
interface LedgerEntry {
  ledgerId: string
  userId: string
  gameId: string
  itemId: string
  change: number               // positive for grants, negative for consumes/revokes
  action: 'grant' | 'consume' | 'revoke' | 'expire'
  source: string               // 'purchase', 'battlepass', 'progression', 'reward', 'admin'
  referenceId: string          // idempotency key
  reason: string | null        // human-readable reason
  createdAt: number            // ms since epoch
  balanceAfter: number         // quantity after this change
}
```

## Method Reference

| Method | Description |
|---|---|
| `listEntitlements()` | Get all active entitlements for the current game |
| `getQuantity(itemId)` | Get current quantity for a specific item (0 if not owned) |
| `consumeEntitlement(itemId, quantity, callback?, reason?, referenceId?)` | Consume a quantity of a consumable entitlement |
| `getLedger(itemId?, limit?, startAfter?)` | Get audit trail of entitlement changes |

## Error Handling

All methods throw on failure. Common errors:

| Error | Cause |
|---|---|
| `Entitlement not found` | Item doesn't exist or is not active for this player |
| `Entitlement is not consumable` | Tried to consume a non-consumable entitlement |
| `Insufficient quantity` | Tried to consume more than the player owns |
| `Duplicate referenceId` | A different item was already processed with this referenceId |

```typescript
try {
  await RundotGameAPI.entitlements.consumeEntitlement('boost', 1)
} catch (error) {
  if (error.message.includes('Insufficient quantity')) {
    showMessage('Not enough boosts!')
  } else if (error.message.includes('not consumable')) {
    showMessage('This item cannot be used')
  } else {
    showMessage('Something went wrong')
  }
}
```

## Relationship with Shop

When a player purchases a shop item, the server automatically grants the entitlements defined in the item's config. You don't need to grant entitlements manually — just define them in your shop config and they're granted on purchase.

See the [Shop API](./SHOP.md) for how to configure items with entitlements and the [Purchases API](./PURCHASES.md) for the purchase flow.

## Best Practices

- **Check quantities before consuming** — call `getQuantity()` to show UI state, then `consumeEntitlement()` when the player acts. The server enforces the check atomically, but pre-checking avoids unnecessary error round-trips.
- **Use callbacks for game effects** — apply in-game effects in the consume callback to ensure they only fire on successful consumes.
- **Save referenceIds for retries** — if your game effect is critical (e.g., awarding a reward), capture the referenceId in the callback and retry with it on failure.
- **Don't cache quantities long-term** — entitlements can change server-side (grants, expirations). Re-fetch when the player returns to a screen that shows quantities.
- **Non-consumables are permanent** — use `getQuantity() > 0` to check ownership of permanent items like skins or characters.
