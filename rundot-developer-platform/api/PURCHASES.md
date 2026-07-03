# Purchases API

Let players spend RunBucks to buy digital goods and entitlements in your game. The SDK handles platform billing flows: your game just requests balances and initiates transactions.

## What Are RunBucks?

RunBucks are the platform's hard currency. Players acquire RunBucks through the platform store, then spend them inside games for digital goods, power-ups, cosmetics, or other entitlements.

{% hint style="warning" %}
All SDK methods can reject; unhandled rejections crash the app. Always wrap SDK calls in `try/catch` or attach a `.catch()` handler. See [Error Handling](../error-handling.md) for details.
{% endhint %}

> **Note**: "In-App Purchases" refers to FIAT transactions on the platform or in-game. This API specifically handles **RunBucks purchases**: transactions where users spend RunBucks inside your game.

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
// Launch the native RunBucks store. The result tells you whether a purchase
// happened and gives you the refreshed balance without a second call.
const store = await RundotGameAPI.iap.openStore()
if (store.purchased) {
  updateBalanceUI(store.newBalance)
}

// Fetch currency icon for your UI. getCurrencyIcon resolves to { base64Data },
// so build a data URI before assigning it to an <img> src.
const icon = await RundotGameAPI.iap.getCurrencyIcon()
document.querySelector('#currency-icon').src =
  'data:image/png;base64,' + icon.base64Data
```

## Complete Purchase Flow

```typescript
async function purchaseItem(itemId: string, cost: number) {
  // 1. Attempt purchase
  try {
    // spendCurrency includes an automatic hard currency purchase flow if the user does not have enough.
    // Pass a `description` so the host shows the player what they are buying in the confirmation dialog.
    const result = await RundotGameAPI.iap.spendCurrency(itemId, cost, {
      description: 'Unlock the legendary sword',
    })

    // 2. Track the purchase. spendCurrency does not return a balance, so fetch
    //    the refreshed balance afterward if you need it.
    if (result.success) {
      const newBalance = await RundotGameAPI.iap.getHardCurrencyBalance()
      await RundotGameAPI.analytics.recordCustomEvent('purchase_complete', {
        itemId,
        cost,
        newBalance,
      })

      return { success: true, newBalance }
    }

    // The player declined the confirmation dialog. No currency was deducted.
    if (result.error === 'USER_CANCELLED') {
      return { success: false, reason: 'cancelled' }
    }

    return { success: false, reason: 'purchase_failed', error: result.error }
  } catch (error) {
    return { success: false, reason: 'error', error }
  }
}
```

You can use `hasUserMadePurchase` to check if the user has ever made a purchase on RUN. You could use this information to adjust prices in your store, or show certain bundles only to non-spenders

## Subscription Paywall with Checkout Flow

```typescript
import { useEffect, useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import {
  RunSubscriptionsResponse,
  SubscriptionTier,
  SubscriptionInterval,
} from '@series-inc/rundot-game-sdk';

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
Use isUserSubscribed to gate content or features behind a subscription tier. This method respects tier hierarchy: if a user has a higher tier than the one being checked, it returns true. The tier hierarchy is (lowest to highest) Lite, Core, Plus, Prime, Ultimate
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

<table><thead><tr><th width="276.2265625">Method</th><th>Returns</th><th>Description</th></tr></thead><tbody><tr><td><code>getHardCurrencyBalance()</code></td><td><code>Promise&#x3C;number></code></td><td>Get player's current RunBucks balance</td></tr><tr><td><code>spendCurrency(productId, amount, options?)</code></td><td><code>Promise&#x3C;{ success: boolean; error?: string }></code></td><td>Spend RunBucks on an item. Accepts an optional <code>options</code> object (see below). On <code>success: false</code>, <code>error</code> carries the reason (<code>'USER_CANCELLED'</code> when the player declines).</td></tr><tr><td><code>openStore()</code></td><td><code>Promise&#x3C;{ purchased: boolean; newBalance: number }></code></td><td>Open the native RunBucks store. Read <code>purchased</code> and the refreshed <code>newBalance</code> after it closes instead of refetching the balance.</td></tr><tr><td><code>getCurrencyIcon()</code></td><td><code>Promise&#x3C;{ base64Data: string }></code></td><td>Get the RunBucks icon as raw base64. Wrap it in a data URI (<code>'data:image/png;base64,' + icon.base64Data</code>) to use as an <code>&#x3C;img></code> src.</td></tr><tr><td><p><code>isUserSubscribed(</code></p><p><code>tier)</code></p></td><td><code>Promise&#x3C;boolean></code></td><td>Check if the user has a certain subscription tier. Will also return true if the user has a higher subscription tier.</td></tr><tr><td><p><code>getSubscriptions(</code></p><p><code>tier?)</code></p></td><td><code>Promise&#x3C;RunSubscriptionsResponse></code></td><td>Get a list of subscriptions available by tier. Use these to show a paywall to the user. You can optionally pass a tier to this method to get subscriptions for that tier only.</td></tr><tr><td><code>purchaseSubscription(tier, interval)</code></td><td><code>Promise&#x3C;PurchaseSubscriptionResponse></code></td><td>Trigger a checkout flow for a given subscription (identified by its tier and interval). Rejects with a <code>RundotApiError</code> (<code>UNSUPPORTED_SUBSCRIPTION_INTERVAL</code>) if the tier does not offer that interval — LITE is weekly-only.</td></tr><tr><td><code>hasUserMadePurchase()</code></td><td><code>Promise&#x3C;boolean></code></td><td>Check if the user has ever made a purchase on RUN</td></tr></tbody></table>

### `spendCurrency(productId, amount, options?)`

`spendCurrency` takes an optional third argument, `SpendCurrencyOptions`. Every field is optional. Both `SpendCurrencyOptions` and the `SpendCurrencyResult` it resolves to are named, importable types from the package root, `@series-inc/rundot-game-sdk` (not the `/api` subpath), so you can annotate your own helpers with them.

<table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody><tr><td><code>screenName</code></td><td><code>string</code></td><td>No</td><td>Screen/route name where the purchase occurred. Used for analytics only.</td></tr><tr><td><code>description</code></td><td><code>string</code></td><td>No</td><td>Short human-readable label of what is being bought (e.g. "Unlock level 5"). The host renders this in the spend-confirmation dialog so the player sees what they are paying for. Sanitized and truncated by the host before display.</td></tr><tr><td><code>beneficiaryId</code></td><td><code>string</code></td><td>No</td><td>Profile id of a UGC creator the spend should be attributed to for revenue share. Forwarded to the server for revshare bookkeeping.</td></tr><tr><td><code>contentEntryId</code></td><td><code>string</code></td><td>No</td><td>Story-level UGC entry id the spend buys (e.g. a RUN.tv episode unlock). When set, the server keys the recommendation purchase signal to that specific content item instead of the host game.</td></tr></tbody></table>

It resolves to a `SpendCurrencyResult`:

<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>success</code></td><td><code>boolean</code></td><td>Whether the spend completed.</td></tr><tr><td><code>error</code></td><td><code>string</code> (optional)</td><td>Present only on <code>success: false</code>. The one stable value is <code>'USER_CANCELLED'</code> (the player declined the host dialog; no currency was deducted). Any other value is a server-side message and is not stable, so don't branch on it.</td></tr></tbody></table>

`spendCurrency` does not return a balance. If you need the post-spend balance, call `getHardCurrencyBalance()` afterward.

```typescript
const result = await RundotGameAPI.iap.spendCurrency('continue_run', 5, {
  description: 'Continue your run',
  screenName: 'game_over',
})

if (result.success) {
  resumeGame()
} else if (result.error === 'USER_CANCELLED') {
  // Player backed out of the confirmation dialog; nothing was charged.
} else {
  showError(result.error)
}
```

### `openStore(): Promise<OpenStoreResult>`

Opens the native RunBucks store and resolves once it closes. The result lets you react to a purchase without a separate balance fetch. `OpenStoreResult` is a named, importable type from the package root, `@series-inc/rundot-game-sdk` (not the `/api` subpath).

<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>purchased</code></td><td><code>boolean</code></td><td>Whether a purchase was completed during the store session.</td></tr><tr><td><code>newBalance</code></td><td><code>number</code></td><td>The updated RunBucks balance after the store closed (saves a refetch).</td></tr></tbody></table>

### `getCurrencyIcon(): Promise<{ base64Data: string }>`

Returns the RunBucks icon as raw base64, not a URL. Build a data URI before assigning it to an `<img>` src.

```typescript
const icon = await RundotGameAPI.iap.getCurrencyIcon()
document.querySelector('#currency-icon').src =
  'data:image/png;base64,' + icon.base64Data
```

## Subscription Types

These types are exported from the package root, `@series-inc/rundot-game-sdk` (not the `/api` subpath).

### `SubscriptionTier`

The canonical tier union accepted by `isUserSubscribed`, `getSubscriptions`, and `purchaseSubscription`. Lowest to highest: `'LITE'`, `'CORE'`, `'PLUS'`, `'PRIME'`, `'ULTIMATE'`.

```typescript
type SubscriptionTier = 'LITE' | 'CORE' | 'PLUS' | 'PRIME' | 'ULTIMATE';
```

### `SubscriptionInterval`

The billing interval passed to `purchaseSubscription` and returned on each `RunSubscription`. The accepted values are lowercase string literals.

```typescript
type SubscriptionInterval = 'weekly' | 'monthly' | 'annual';
```

{% hint style="warning" %}
The uppercase labels in the Offerings tables below (WEEKLY/MONTHLY/ANNUAL) are display-only. Pass the lowercase literals (`'weekly'`, `'monthly'`, `'annual'`) to the API.
{% endhint %}

{% hint style="info" %}
Not every tier offers every interval. **LITE is weekly-only** — it has no monthly or annual plan. `purchaseSubscription` rejects with a `RundotApiError` (code `UNSUPPORTED_SUBSCRIPTION_INTERVAL`) before any checkout if you request an interval a tier doesn't offer, so drive your paywall off the packages returned by `getSubscriptions` rather than assuming all three intervals exist. The other tiers (CORE, PLUS, PRIME, ULTIMATE) offer all three.
{% endhint %}

### `RunSubscription`

One purchasable subscription package (a single tier + interval combination), as returned by `getSubscriptions`.

<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>currencyCode</code></td><td><code>string</code></td><td>Currency code for the subscription price.</td></tr><tr><td><code>interval</code></td><td><code>SubscriptionInterval</code></td><td>The billing interval. <code>'weekly'</code> charges the buyer weekly.</td></tr><tr><td><code>price</code></td><td><code>number</code></td><td>The price, in the units of <code>currencyCode</code>.</td></tr><tr><td><code>description</code></td><td><code>string</code></td><td>The product description.</td></tr></tbody></table>

### `RunSubscriptionsResponse`

The shape `getSubscriptions` resolves to: a map keyed by tier name, where each value is an array of `RunSubscription` packages (one per interval).

```typescript
interface RunSubscriptionsResponse {
  [tier: string]: RunSubscription[];
}
```

### `PurchaseSubscriptionResponse`

The shape `purchaseSubscription` resolves to. `success` is `true` on a completed checkout and `false` on cancel or error.

```typescript
interface PurchaseSubscriptionResponse {
  success: boolean;
}
```

---

## Subscription Offerings

### Tier: LITE

LITE is the entry tier and is **weekly-only** — there is no monthly or annual plan. `purchaseSubscription('LITE', 'monthly')` / `('LITE', 'annual')` reject with `UNSUPPORTED_SUBSCRIPTION_INTERVAL`.

<table><thead><tr><th>Interval</th><th>Price</th></tr></thead><tbody><tr><td>WEEKLY</td><td>$0.99</td></tr></tbody></table>

```ts
// Returns true if the user has LITE or higher
const hasLiteAccess = await RundotGameAPI.iap.isUserSubscribed('LITE');
```

```ts
RundotGameAPI.iap.getSubscriptions() // optionally pass a tier: getSubscriptions('LITE') if you want just LITE subscriptions

// LITE only offers the weekly interval
const result = await RundotGameAPI.iap.purchaseSubscription('LITE', 'weekly');
```

---

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
* Handle rejections gracefully: users may cancel or payments can fail mid-flow.
* The spend and purchase results expose no receipt or transaction ID. If you need an audit trail, capture the `productId` and cost yourself (for example via `RundotGameAPI.analytics`); the result only returns `success`/`error`.
* Combine with `RundotGameAPI.analytics` to attribute purchases by SKU.
* Always show the player's current balance in your shop UI.
