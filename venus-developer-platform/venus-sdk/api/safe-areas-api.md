# Safe Areas API

## Venus Safe Area & HUD Insets

Venus merges static safe-area padding with live HUD chrome so your layout never collides with host UI. Initialize the SDK, read the insets once, then refresh whenever the host resumes your app.

### Quick Start

```typescript
import VenusAPI from '@series-inc/venus-sdk/api'

const initContext = await VenusAPI.initializeAsync()

const baseInsets = VenusAPI.config.ui.safeArea
const hudInsets = initContext?.hudInsets ?? { top: 0, right: 0, bottom: 0, left: 0 }

applyInsets({
  top: Math.max(baseInsets.top, hudInsets.top),
  right: Math.max(baseInsets.right, hudInsets.right),
  bottom: Math.max(baseInsets.bottom, hudInsets.bottom),
  left: Math.max(baseInsets.left, hudInsets.left),
})

VenusAPI.lifecycles.onResume(updateInsets)
VenusAPI.lifecycles.onAwake(updateInsets)

function updateInsets() {
  const updated = VenusAPI.config.ui.safeArea
  applyInsets({
    top: Math.max(updated.top, hudInsets.top),
    right: Math.max(updated.right, hudInsets.right),
    bottom: Math.max(updated.bottom, hudInsets.bottom),
    left: Math.max(updated.left, hudInsets.left),
  })
}
```

### Layout Tips

* Combine safe-area padding with your own gameplay gutters—Venus just guarantees you won't overlap system chrome.
* Use the largest inset between the static config and runtime values; the host may expand HUD chrome dynamically.
* Reapply insets after lifecycle transitions; hosts often adjust overlay chrome when apps resume or awake.

### Best Practices

* Keep your core canvas anchored inside the computed safe rectangle; place non-interactive backgrounds outside.
* Mirror padding to physics or hitbox calculations so gameplay surfaces match UI boundaries.
* Persist the merged insets in your state store to avoid recalculating for every layout component.
