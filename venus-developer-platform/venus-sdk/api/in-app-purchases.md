# In-App Purchases

## Venus IAP API

Integrate Venus-managed purchases for hard currency, consumables, and storefront actions. The SDK handles platform billing flows—your game just requests balances and initiates transactions.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const balance = await VenusAPI.iap.getHardCurrencyBalance()

const purchase = await VenusAPI.iap.spendCurrency('bundle_sword', 1)
if (purchase.success) {
  unlockItem('bundle_sword')
}
```

### Storefront Helpers

* Launch the native storefront: `await VenusAPI.iap.openStore()`.
* Fetch currency art for UI: `const icon = await VenusAPI.iap.getCurrencyIcon()`.
* Combine with `VenusAPI.analytics` to attribute purchases by SKU.

### Best Practices

* Check balances before attempting to spend to avoid bouncing players with generic errors.
* Handle rejections gracefully—users may cancel or payments can fail mid-flow.
* Persist receipts or transaction ids from the result payload if you need audit trails on your backend.
