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
  // 1. Attempt purchase
  try {
    // On mobile, spendCurrency includes an automatic hard currency purchase flow if the user does not have enough
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

    // 3. Prompt to buy more hard currency on web if needed
    if (result.didPromptPurchase) {
      const balance = await RundotGameAPI.iap.getHardCurrencyBalance()

      if (balance < cost) {
        // Not enough RunBucks - prompt to buy more
        await RundotGameAPI.iap.openStore()
        return { success: false, reason: 'insufficient_funds' }
      }
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
import { IapSubscription } from './types';

function Paywall() {
  const [subscriptions, setSubscriptions] = useState<IapSubscription[]>([]);

  // fetch all subscriptions for your offering
  useEffect(() => {
    RundotGameAPI.iap
      .getSubscriptionsForOffering('premium') // replace 'premium' with your offering
      .then(setSubscriptions);
  }, []);

  // if the user wants to make a purchase, call the purchaseSubscriptionFromOffering method to trigger
  // the checkout flow
  const handlePurchase = async (subscriptionOfferingId: string) => {
    const result = await RundotGameAPI.iap.purchaseSubscriptionFromOffering(
      'premium', // replace 'premium' with your offering
      subscriptionOfferingId
    );
    if (result.success) {
      alert('Thanks for subscribing!');
    }
  };

  return (
    <div>
      <h2>Go Premium</h2>
      {subscriptions.map((sub) => (
        <button key={sub.offeringId} onClick={() => handlePurchase(sub.offeringId)}>
          <strong>{sub.description}</strong>
          <span>
            /* price is a float, so this could be 14.99 or 4.99 */
            {sub.currencyCode} {sub.price} / {sub.packageType}
          </span>
        </button>
      ))}
    </div>
  );
}

export default Paywall;
```

## API Reference

<table><thead><tr><th width="276.2265625">Method</th><th>Returns</th><th>Description</th></tr></thead><tbody><tr><td><code>getHardCurrencyBalance()</code></td><td><code>Promise&#x3C;number></code></td><td>Get player's current RunBucks balance</td></tr><tr><td><code>spendCurrency(itemId, amount)</code></td><td><code>Promise&#x3C;{ success, newBalance }></code></td><td>Spend RunBucks on an item</td></tr><tr><td><code>openStore()</code></td><td><code>Promise&#x3C;void></code></td><td>Open the native RunBucks store</td></tr><tr><td><code>getCurrencyIcon()</code></td><td><code>Promise&#x3C;string></code></td><td>Get the RunBucks icon URL for UI</td></tr><tr><td><p><code>getUserSubscriptionStatus(</code></p><p><code>subscriptionName)</code></p></td><td><code>Promise&#x3C;SubscriptionStatusResponse | null></code></td><td>Get the status of a supscription for the current user. null if the user doesn't have the subscription</td></tr><tr><td><p><code>getSubscriptionsForOffering(</code></p><p><code>offeringId)</code></p></td><td><code>Promise&#x3C;IapSubscription[]></code></td><td>Get a list of subscriptions available in your offering. Use these to show a paywall to the user. <br><br><strong>Note:</strong> This method accepts an <code>offeringId</code> of the parent offering ex. <code>run_game_core_subscriptions</code>. It returns a list of offerings for that parent offering, with the actual individual subscription options, which also have an <code>offeringId</code>. The child <code>offeringId</code> should be used to make the actual purchase based on the time frame of the subscription along with the parent <code>OfferingId</code></td></tr><tr><td><code>purchaseSubscriptionFromOffering(offeringId, productId)</code></td><td><code>Promise&#x3C;PurchaseResponse></code></td><td>Trigger a checkout flow for a given subscription (identified by its productId from <code>IapSubscription</code><br><br><strong>Note:</strong> This method accepts the parent <code>offeringId</code>, and the child <code>offeringId</code> as the secondary parameter.</td></tr><tr><td><code>hasUserMadePurchase()</code></td><td><code>Promise&#x3C;boolean></code></td><td>Check if the user has ever made a purchase on RUN</td></tr></tbody></table>

## Current Subscription Offerings

### Core (offeringId: `run_game_core_subscriptions`)

<table><thead><tr><th width="263.6875">offeringId</th><th>Price</th><th width="242.5625">Renewal Duration</th></tr></thead><tbody><tr><td><code>$rc_weekly</code></td><td>$1.99</td><td>Once a Week</td></tr><tr><td><code>$rc_monthly</code></td><td>$7.99</td><td>Once a Month</td></tr><tr><td><code>$rc_annual</code></td><td>$79.99</td><td>Yearly</td></tr></tbody></table>

### Plus (offeringId: `run_game_plus_subscriptions`)

<table><thead><tr><th width="263.6875">offeringId</th><th>Price</th><th width="242.5625">Renewal Duration</th></tr></thead><tbody><tr><td><code>$rc_weekly</code></td><td>$2.99</td><td>Once a Week</td></tr><tr><td><code>$rc_monthly</code></td><td>$11.99</td><td>Once a Month</td></tr><tr><td><code>$rc_annual</code></td><td>$119.99</td><td>Yearly</td></tr></tbody></table>

### Prime (offeringId: `run_game_prime_subscriptions`)

<table><thead><tr><th width="263.6875">offeringId</th><th>Price</th><th width="242.5625">Renewal Duration</th></tr></thead><tbody><tr><td><code>$rc_weekly</code></td><td>$9.99</td><td>Once a Week</td></tr><tr><td><code>$rc_monthly</code></td><td>$34.99</td><td>Once a Month</td></tr><tr><td><code>$rc_annual</code></td><td>$299.99</td><td>Yearly</td></tr></tbody></table>

### Ultimate (offeringId: `run_game_ultimate_subscriptions`)

<table><thead><tr><th width="263.6875">offeringId</th><th>Price</th><th width="242.5625">Renewal Duration</th></tr></thead><tbody><tr><td><code>$rc_weekly</code></td><td>$14.99</td><td>Once a Week</td></tr><tr><td><code>$rc_monthly</code></td><td>$39.99</td><td>Once a Month</td></tr><tr><td><code>$rc_annual</code></td><td>$349.99</td><td>Yearly</td></tr></tbody></table>

## Best Practices

* Check balances before attempting to spend to avoid bouncing players with generic errors.
* Handle rejections gracefully—users may cancel or payments can fail mid-flow.
* Persist receipts or transaction IDs from the result payload if you need audit trails on your backend.
* Combine with `RundotGameAPI.analytics` to attribute purchases by SKU.
* Always show the player's current balance in your shop UI.
