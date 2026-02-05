# Big Numbers API

Handle exponential economies without losing precision. The Big Numbers API wraps `break_eternity` and exposes helpers for normalization, formatting, and progression math tuned for idle or incremental games.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const numbers = RundotGameAPI.numbers

const currency = numbers.normalize('BE:1.23e9')
const display = numbers.format.incremental(currency) // "1.23B"
```

## Type Checking

```typescript
// Check if a value is a big number
const isBig = numbers.isBigNumber(someValue)
```

## Progression Math

### Geometric Series Costs

Compute total upgrade costs accurately:

```typescript
const totalCost = numbers.calculateGeometricSeriesCost(
  baseCost, // e.g., 10
  1.15,     // multiplier
  currentLevel,
  25,       // quantity to purchase
)
```

### Max Affordable

Determine how many upgrades a player can buy with current currency:

```typescript
const maxBuy = numbers.calculateMaxAffordableDecimal(
  playerCash,
  baseCost,
  multiplier,
  currentLevel,
)
```

### Direct Decimal Usage

Access the underlying class for custom math:

```typescript
const { Decimal } = numbers

const a = new Decimal('1e308')
const b = new Decimal('1e308')
const result = a.times(b) // Handles numbers beyond JavaScript limits
```

## API Reference

| Method | Description |
|--------|-------------|
| `numbers.isBigNumber(value)` | Check if value is a big number |
| `numbers.normalize(value)` | Convert string/number to Decimal instance |
| `numbers.format.incremental(value)` | Format for display (e.g., "1.23B") |
| `numbers.calculateGeometricSeriesCost(base, mult, level, qty)` | Calculate total cost for upgrades |
| `numbers.calculateMaxAffordableDecimal(cash, base, mult, level)` | Calculate max purchasable quantity |
| `numbers.Decimal` | Direct access to Decimal class |

## Best Practices

- Store values as strings (e.g., `BE:` prefix) when persisting to avoid JSON precision issues.
- Normalize before performing comparisons so you're always working with Decimal instances.
- Keep formatting on the client; send raw numbers to your backend for canonical calculations.
- When storing big numbers, use `RundotGameAPI.storage` with string serialization.
