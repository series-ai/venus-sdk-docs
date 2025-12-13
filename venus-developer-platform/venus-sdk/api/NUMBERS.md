# Venus Numbers API

Handle exponential economies without losing precision. The numbers API wraps `break_eternity` and exposes helpers for normalization, formatting, and progression math tuned for idle or incremental games.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

const numbers = VenusAPI.numbers

const currency = numbers.normalize('BE:1.23e9')
const display = numbers.format.incremental(currency) // "1.23B"
```

## Progression Math

- **Geometric series costs:** compute total upgrade costs accurately.

  ```typescript
  const totalCost = numbers.calculateGeometricSeriesCost(
    baseCost, // e.g., 10
    1.15,     // multiplier
    currentLevel,
    25,       // quantity to purchase
  )
  ```

- **Max affordable:** determine how many upgrades a player can buy with current currency.

  ```typescript
  const maxBuy = numbers.calculateMaxAffordableDecimal(
    playerCash,
    baseCost,
    multiplier,
    currentLevel,
  )
  ```

- **Direct Decimal usage:** access the underlying class for custom math: `numbers.Decimal`.

## Best Practices

- Store values as strings (e.g., `BE:` prefix) when persisting to avoid JSON precision issues.
- Normalize before performing comparisons so you’re always working with Decimal instances.
- Keep formatting on the client; send raw numbers to your backend for canonical calculations.

