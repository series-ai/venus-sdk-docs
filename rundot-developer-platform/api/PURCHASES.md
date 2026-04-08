# Purchases API

Let players spend RunBucks to buy digital goods and entitlements in your game. The SDK handles platform billing flows—your game just requests balances and initiates transactions.

## What Are RunBucks?

RunBucks are the platform's hard currency. Players acquire RunBucks through the platform store, then spend them inside games for digital goods, power-ups, cosmetics, or other entitlements.

{% hint style="warning" %}
All SDK methods can reject — unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

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
  // 1. Attempt purchase
  try {
    // spendCurrency includes an automatic hard currency purchase flow if the user does not have enough
    const result = await RundotGameAPI.iap.spendCurrency(itemId, cost)

    // 2. Track the purchase
    if (result.success) {
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

You can use `hasUserMadePurchase` to check if the user has ever made a purchase on RUN. You could use this information to adjust prices in your store, or show certain bundles only to non-spenders

## Subscription Paywall with Checkout Flow

```typescript
import { useEffect, useState } from 'react';
import { RunSubscriptionsResponse } from '@series-inc/rundot-game-sdk/api';

function Paywall() {
  const [subscriptions, setSubscriptions] = useState<RunSubscriptionsResponse>({});

  // Fetch all subscriptions across all tiers, or pass a tier to filter
  useEffect(() => {
    RundotGameAPI.iap
      .getSubscriptions() // optionally pass a tier: getSubscriptions('CORE') if you want just CORE subscriptions
      .then(setSubscriptions);
  }, []);

  // Trigger the checkout flow for a given tier + interval
  const handlePurchase = async (tier: SubscriptionTier, interval: SubscriptionInterval) => {
    const result = await RundotGameAPI.iap.purchaseSubscription(tier, interval);
    if (result.success) {
      alert('Thanks for subscribing!');
    } else {
      // handle error
    }
  };

  return (
    <div>
      {Object.entries(subscriptions).map(([tier, packages]) => (
        <div key={tier}>
          <h2>{tier}</h2>
          {packages.map((sub) => (
            <button
              key={sub.interval}
              onClick={() => handlePurchase(tier as SubscriptionTier, sub.interval)}
            >
              <strong>{sub.description}</strong>
              <span>
                {sub.currencyCode} {sub.price} / {sub.interval}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Paywall;
```

## Checking Subscription Status
Use isUserSubscribed to gate content or features behind a subscription tier. This method respects tier hierarchy—if a user has a higher tier than the one being checked, it returns true. The tier hierarchy is (lowest to highest) Core, Plus, Prime, Ultimate
```typescript
// Returns true if the user has CORE, PLUS, PRIME, or ULTIMATE
const hasCoreAccess = await RundotGameAPI.iap.isUserSubscribed('CORE');

// Returns true only if the user has ULTIMATE
const hasUltimateAccess = await RundotGameAPI.iap.isUserSubscribed('ULTIMATE');

// Example: gate a feature behind PLUS or higher
if (await RundotGameAPI.iap.isUserSubscribed('PLUS')) {
  unlockPlusFeatures();
} else {
  showUpgradePrompt();
}
```

## API Reference

<table><thead><tr><th width="276.2265625">Method</th><th>Returns</th><th>Description</th></tr></thead><tbody><tr><td><code>getHardCurrencyBalance()</code></td><td><code>Promise&#x3C;number></code></td><td>Get player's current RunBucks balance</td></tr><tr><td><code>spendCurrency(itemId, amount)</code></td><td><code>Promise&#x3C;{ success, newBalance }></code></td><td>Spend RunBucks on an item</td></tr><tr><td><code>openStore()</code></td><td><code>Promise&#x3C;void></code></td><td>Open the native RunBucks store</td></tr><tr><td><code>getCurrencyIcon()</code></td><td><code>Promise&#x3C;string></code></td><td>Get the RunBucks icon URL for UI</td></tr><tr><td><p><code>isUserSubscribed(</code></p><p><code>tier)</code></p></td><td><code>Promise&#x3C;boolean></code></td><td>Check if the user has a certain subscription tier. Will also return true if the user has a higher subscription tier.</td></tr><tr><td><p><code>getSubscriptions(</code></p><p><code>tier)</code></p></td><td><code>Promise&#x3C;RunSubscriptionsResponse></code></td><td>Get a list of subscriptions available by tier. Use these to show a paywall to the user. You can optionally pass a tier to this method to get subscriptions for that tier only.</td></tr><tr><td><code>purchaseSubscription(tier, interval)</code></td><td><code>Promise&#x3C;PurchaseSubscriptionResponse></code></td><td>Trigger a checkout flow for a given subscription (identified by its tier and interval</td></tr><tr><td><code>hasUserMadePurchase()</code></td><td><code>Promise&#x3C;boolean></code></td><td>Check if the user has ever made a purchase on RUN</td></tr></tbody></table>

---

## Subscription Offerings

### Tier: CORE

<table><thead><tr><th>Interval</th><th>Price</th></tr></thead><tbody><tr><td>WEEKLY</td><td>$1.99</td></tr><tr><td>MONTHLY</td><td>$7.99</td></tr><tr><td>ANNUAL</td><td>$79.99</td></tr></tbody></table>

```ts
// Returns true if the user has CORE or higher
const hasCoreAccess = await RundotGameAPI.iap.isUserSubscribed('CORE');
```

```ts
RundotGameAPI.iap.getSubscriptions() // optionally pass a tier: getSubscriptions('CORE') if you want just CORE subscriptions

const result = await RundotGameAPI.iap.purchaseSubscription('CORE', 'weekly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('CORE', 'monthly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('CORE', 'annual');
```

---

### Tier: PLUS

<table><thead><tr><th>Interval</th><th>Price</th></tr></thead><tbody><tr><td>WEEKLY</td><td>$2.99</td></tr><tr><td>MONTHLY</td><td>$11.99</td></tr><tr><td>ANNUAL</td><td>$119.99</td></tr></tbody></table>

```ts
// Returns true if the user has PLUS or higher
const hasPlusAccess = await RundotGameAPI.iap.isUserSubscribed('PLUS');
```

```ts
RundotGameAPI.iap.getSubscriptions() // optionally pass a tier: getSubscriptions('PLUS') if you want just PLUS subscriptions

const result = await RundotGameAPI.iap.purchaseSubscription('PLUS', 'weekly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('PLUS', 'monthly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('PLUS', 'annual');
```

---

### Tier: PRIME

<table><thead><tr><th>Interval</th><th>Price</th></tr></thead><tbody><tr><td>WEEKLY</td><td>$9.99</td></tr><tr><td>MONTHLY</td><td>$34.99</td></tr><tr><td>ANNUAL</td><td>$299.99</td></tr></tbody></table>

```ts
// Returns true if the user has PRIME or higher
const hasPrimeAccess = await RundotGameAPI.iap.isUserSubscribed('PRIME');
```

```ts
RundotGameAPI.iap.getSubscriptions() // optionally pass a tier: getSubscriptions('PRIME') if you want just PRIME subscriptions

const result = await RundotGameAPI.iap.purchaseSubscription('PRIME', 'weekly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('PRIME', 'monthly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('PRIME', 'annual');
```

---

### Tier: ULTIMATE

<table><thead><tr><th>Interval</th><th>Price</th></tr></thead><tbody><tr><td>WEEKLY</td><td>$14.99</td></tr><tr><td>MONTHLY</td><td>$39.99</td></tr><tr><td>ANNUAL</td><td>$349.99</td></tr></tbody></table>

```ts
// Returns true if the user has ULTIMATE or higher
const hasUltimateAccess = await RundotGameAPI.iap.isUserSubscribed('ULTIMATE');
```

```ts
RundotGameAPI.iap.getSubscriptions() // optionally pass a tier: getSubscriptions('ULTIMATE') if you want just ULTIMATE subscriptions

const result = await RundotGameAPI.iap.purchaseSubscription('ULTIMATE', 'weekly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('ULTIMATE', 'monthly');
// or
const result = await RundotGameAPI.iap.purchaseSubscription('ULTIMATE', 'annual');
```

## Best Practices

* Check balances before attempting to spend to avoid bouncing players with generic errors.
* Handle rejections gracefully—users may cancel or payments can fail mid-flow.
* Persist receipts or transaction IDs from the result payload if you need audit trails on your backend.
* Combine with `RundotGameAPI.analytics` to attribute purchases by SKU.
* Always show the player's current balance in your shop UI.
