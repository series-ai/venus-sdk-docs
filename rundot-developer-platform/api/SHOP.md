# Shop API

Browse your game's shop catalog from within your H5 game. The catalog is defined in the `shop` key of your game's `config.json` and uploaded via the existing server config pipeline.

## Overview

The shop system uses your game's **server config** as the source of truth:

1. Add a `shop` key to your game's `config.json` (alongside `simulation`, etc.)
2. Upload via the standard CLI config upload (`venus game upload-server`)
3. The SDK reads the catalog at runtime via `RundotGameAPI.shop`

Each config upload creates a new immutable version. The storefront response includes a `configId` that pins the catalog to a specific version.

## Config Structure

Add a `shop` key to your game's `config.json`:

```json
{
  "simulation": { ... },
  "shop": {
    "items": [
      {
        "itemId": "speed_boost",
        "name": "Speed Boost",
        "description": "Double movement speed for 60 seconds",
        "category": "consumable",
        "price": { "type": "vbucks", "value": "100" },
        "entitlements": [
          { "itemId": "speed_boost_effect", "quantity": 1, "consumable": true }
        ],
        "assets": { "icon": "speed_icon.png" },
        "unique": false,
        "active": true,
        "regions": [],
        "refundEligible": true,
        "refundWindowHours": 24,
        "tags": ["boost"],
        "sortOrder": 1,
        "releasedAt": null,
        "expiresAt": null
      }
    ],
    "sales": [
      {
        "saleId": "launch_sale",
        "targetId": "speed_boost",
        "discountType": "percentage",
        "discountValue": 25,
        "regions": [],
        "startsAt": 0,
        "endsAt": 4102444800000,
        "active": true
      }
    ]
  }
}
```

## Item Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `itemId` | string | Yes | — | Unique identifier within the game |
| `name` | string | Yes | — | Display name |
| `description` | string | Yes | — | Display description |
| `category` | enum | Yes | — | `consumable`, `non_consumable`, or `time_bound` |
| `price` | object | Yes | — | `{ type, value }` — see Price Structure |
| `entitlements` | array | Yes | — | What the player receives — see Entitlements |
| `assets` | object | No | `{}` | `{ thumbnail?, banner?, icon? }` — image identifiers |
| `unique` | boolean | No | `false` | If true, player can only own one |
| `active` | boolean | No | `false` | Whether the item is visible/purchasable |
| `regions` | string[] | No | `[]` | Region codes; empty = all regions |
| `refundEligible` | boolean | No | `true` | Whether refunds are allowed |
| `refundWindowHours` | number | No | `24` | Hours after purchase to allow refund |
| `tags` | string[] | No | `[]` | Arbitrary tags for filtering |
| `sortOrder` | number | No | `0` | Display sort order |
| `releasedAt` | number | No | `null` | Release timestamp (ms since epoch) |
| `expiresAt` | number | No | `null` | Expiry timestamp (ms since epoch) |

## Sale Fields

Sales are separate objects that reference items by `itemId`. Items don't need modification to go on sale, and multiple sales can be scheduled in advance.

| Field | Type | Required | Description |
|---|---|---|---|
| `saleId` | string | Yes | Unique identifier for the sale |
| `targetId` | string | Yes | `itemId` of the item on sale |
| `discountType` | enum | Yes | `percentage` or `fixed_price` |
| `discountValue` | number | Yes | Percentage (0–100) when `discountType` is `percentage` |
| `discountPrice` | object | No | Override price `{ type, value }` when `discountType` is `fixed_price` |
| `regions` | string[] | No | Region codes; empty = all regions |
| `startsAt` | number | Yes | Start timestamp (ms since epoch) |
| `endsAt` | number | Yes | End timestamp (ms since epoch) |
| `active` | boolean | Yes | Whether the sale is active |

## Price Structure

```json
{ "type": "vbucks", "value": "100" }
```

| Price Type | Description |
|---|---|
| `vbucks` | RunBucks (platform hard currency) |
| `direct_purchase` | Direct FIAT purchase (not yet supported in v1) |

The `value` field is a string to support decimal precision for direct purchases.

## Entitlements

Each item must specify what the player receives on purchase:

```json
{
  "itemId": "speed_boost_effect",
  "quantity": 1,
  "consumable": true,
  "durationDays": 7
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `itemId` | string | Yes | ID of the entitlement to grant |
| `quantity` | number | Yes | How many to grant (must be > 0) |
| `consumable` | boolean | Yes | Whether this is consumed on use |
| `durationDays` | number | No | For time-bound items, how long it lasts |

## Categories

| Category | Description |
|---|---|
| `consumable` | Used up on use (e.g., potions, boosts) |
| `non_consumable` | Permanent ownership (e.g., skins, characters) |
| `time_bound` | Expires after a duration (e.g., subscriptions, passes) |

## SDK Usage

### Get Catalog

Fetch the full storefront. Returns all items with sale-resolved prices and a `configId` for version pinning.

```typescript
const storefront = await RundotGameAPI.shop.getCatalog()

console.log('Config version:', storefront.configId)
for (const item of storefront.items) {
  const { originalPrice, finalPrice, appliedSales } = item.resolvedPrice
  console.log(`${item.name}: ${originalPrice.value} → ${finalPrice.value}`)
  if (appliedSales.length > 0) {
    console.log('  On sale:', appliedSales.map(s => s.saleId).join(', '))
  }
}
```

### Get Item Detail

Fetch a single item by ID with its resolved price.

```typescript
const item = await RundotGameAPI.shop.getItemDetail('speed_boost')

console.log(item.name, item.description)
console.log('Price:', item.resolvedPrice.finalPrice.value)
console.log('Entitlements:', item.entitlements)
```

### StorefrontResponse

```typescript
interface StorefrontResponse {
  configId: string        // Server config version ID
  items: StorefrontItem[]
}
```

### Purchase

Buy an item. The SDK generates an `idempotencyKey` to prevent duplicate charges on retry.

```typescript
const idempotencyKey = crypto.randomUUID()
const result = await RundotGameAPI.shop.purchase('speed_boost', idempotencyKey)

console.log('Order:', result.order.orderId)
console.log('Status:', result.order.status) // 'fulfilled'
console.log('Paid:', result.order.finalPrice.value)
```

If the player has insufficient funds, the platform automatically opens the currency purchase flow. If the catalog has been updated since the player last fetched it, the SDK throws a stale catalog error — re-fetch the catalog and retry.

### Get Order

Retrieve a specific order by ID.

```typescript
const result = await RundotGameAPI.shop.getOrder(orderId)
const order = result.order

console.log('Status:', order.status)
for (const entry of order.statusHistory) {
  console.log(`  ${entry.status} @ ${entry.timestamp}`)
}
```

### Get Order History

Retrieve recent orders for the current game.

```typescript
const result = await RundotGameAPI.shop.getOrderHistory({ limit: 10 })
for (const order of result.orders) {
  console.log(`${order.orderId}: ${order.itemId} — ${order.status}`)
}
```

### Request Refund

Refund a recent purchase. The player gets their currency back and the entitlements are removed.

```typescript
const result = await RundotGameAPI.shop.requestRefund(orderId, 'changed_mind')

console.log('Status:', result.order.status) // 'refunded'
console.log('Refund amount:', result.order.refund.amount.value)
```

**Refund reason codes:** `changed_mind`, `accidental_purchase`, `not_as_expected`, `technical_issue`, `other`

**Refund constraints:**
- The item must have `refundEligible: true` in the config
- The request must be within `refundWindowHours` of the purchase
- Consumable entitlements must not have been used (quantity must equal what was originally granted)
- Non-refundable items (e.g., `refundEligible: false`) are always rejected

## Client-Side Analytics Events

The platform automatically tracks server-side analytics for purchases (`shop_purchase`), failed purchases (`shop_purchase_failed`), and refunds (`shop_refund`).

For client-side shop analytics, send the following events via `RundotGameAPI.analytics.logEvent()`:

| Event | When to Fire | Properties |
|---|---|---|
| `shop_item_viewed` | Player views an item detail page | `item_id`, `item_name`, `item_category`, `price` |
| `shop_item_click_purchase` | Player taps the purchase button | `item_id`, `item_name`, `price` |
| `shop_item_cancel_purchase` | Player cancels/dismisses the purchase confirmation | `item_id`, `item_name`, `price` |
| `shop_item_view_duration` | Player leaves an item detail page | `item_id`, `duration_ms` |

```typescript
// Example: track item viewed
RundotGameAPI.analytics.logEvent('shop_item_viewed', {
  item_id: item.itemId,
  item_name: item.name,
  item_category: item.category,
  price: item.resolvedPrice.finalPrice.value,
})
```

## Type Reference

### StorefrontItem

```typescript
interface StorefrontItem {
  itemId: string
  name: string
  description: string
  assets: { thumbnail?: string; banner?: string; icon?: string }
  price: { type: string; value: string }
  category: string
  unique: boolean
  active: boolean
  regions: string[]
  tags: string[]
  sortOrder: number
  releasedAt: number | null
  expiresAt: number | null
  entitlements: { itemId: string; quantity: number; consumable: boolean; durationDays?: number }[]
  refundEligible: boolean
  refundWindowHours: number
  resolvedPrice: {
    originalPrice: { type: string; value: string }
    finalPrice: { type: string; value: string }
    appliedSales: {
      saleId: string
      discountType: string
      discountValue: number
      discountPrice?: { type: string; value: string }
    }[]
  }
}
```

### ShopOrder

```typescript
interface ShopOrder {
  orderId: string
  userId: string
  gameId: string
  configId: string
  itemId: string
  itemSnapshot: {
    name: string
    price: { type: string; value: string }
    entitlements: { itemId: string; quantity: number; consumable: boolean; durationDays?: number }[]
  }
  originalPrice: { type: string; value: string }
  finalPrice: { type: string; value: string }
  appliedSales: {
    saleId: string
    discountType: string
    discountValue: number
    discountPrice?: { type: string; value: string }
  }[]
  status: string
  statusHistory: { status: string; timestamp: string; reason?: string }[]
  refund: null | {
    amount: { type: string; value: string }
    reasonCode: string
    requestedAt: string
    processedAt: string
  }
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}
```
