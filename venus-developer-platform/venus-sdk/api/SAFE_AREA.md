# Venus Safe Area & HUD Insets

Venus exposes safe-area padding (device notches + host chrome) so your layout never collides with host UI. The SDK initializes automatically on import—read the safe area when you need it and apply it to your layout.

## Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

const safeArea = VenusAPI.system.getSafeArea()
applyInsets(safeArea)
```

## Layout Tips

- Combine safe-area padding with your own gameplay gutters—Venus just guarantees you won't overlap system chrome.
- Treat `VenusAPI.system.getSafeArea()` as the source of truth (it includes both device safe areas and host chrome).

## Best Practices

- Keep your core canvas anchored inside the computed safe rectangle; place non-interactive backgrounds outside.
- Mirror padding to physics or hitbox calculations so gameplay surfaces match UI boundaries.
- Persist the merged insets in your state store to avoid recalculating for every layout component.

