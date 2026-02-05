# Purchases API

Let players spend RunBucks to buy digital goods and entitlements in your game. The SDK handles platform billing flows—your game just requests balances and initiates transactions.

## What Are RunBucks?

RunBucks are the platform's hard currency. Players acquire RunBucks through the platform store, then spend them inside games for digital goods, power-ups, cosmetics, or other entitlements.

> **Note**: "In-App Purchases" refers to FIAT transactions on the platform or in-game. This API specifically handles **RunBucks purchases**—transactions where users spend RunBucks inside your game.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Check player's RunBucks balance
const balance = await RundotGameAPI.iap.getHardCurrencyBalance()
console.log(`Player has ${balance} RunBucks`)

// Spend RunBucks on an item
const purchase = await RundotGameAPI.iap.spendCurrency('bundle_sword', 1)
if (purchase.success) {
  unlockItem('bundle_sword')
}
```

## Storefront Helpers

```typescript
// Launch the native RunBucks store
await RundotGameAPI.iap.openStore()

// Fetch currency icon for your UI
const icon = await RundotGameAPI.iap.getCurrencyIcon()
document.querySelector('#currency-icon').src = icon
```

## Complete Purchase Flow

```typescript
async function purchaseItem(itemId: string, cost: number) {
  // 1. Check balance first
  const balance = await RundotGameAPI.iap.getHardCurrencyBalance()
  
  if (balance < cost) {
    // Not enough RunBucks - prompt to buy more
    await RundotGameAPI.iap.openStore()
    return { success: false, reason: 'insufficient_funds' }
  }
  
  // 2. Attempt purchase
  try {
    const result = await RundotGameAPI.iap.spendCurrency(itemId, cost)
    
    if (result.success) {
      // 3. Track the purchase
      await RundotGameAPI.analytics.recordCustomEvent('purchase_complete', {
        itemId,
        cost,
        newBalance: result.newBalance,
      })
      
      return { success: true, newBalance: result.newBalance }
    }
    
    return { success: false, reason: 'purchase_failed' }
  } catch (error) {
    return { success: false, reason: 'error', error }
  }
}
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getHardCurrencyBalance()` | `Promise<number>` | Get player's current RunBucks balance |
| `spendCurrency(itemId, amount)` | `Promise<{ success, newBalance }>` | Spend RunBucks on an item |
| `openStore()` | `Promise<void>` | Open the native RunBucks store |
| `getCurrencyIcon()` | `Promise<string>` | Get the RunBucks icon URL for UI |

## Best Practices

- Check balances before attempting to spend to avoid bouncing players with generic errors.
- Handle rejections gracefully—users may cancel or payments can fail mid-flow.
- Persist receipts or transaction IDs from the result payload if you need audit trails on your backend.
- Combine with `RundotGameAPI.analytics` to attribute purchases by SKU.
- Always show the player's current balance in your shop UI.
