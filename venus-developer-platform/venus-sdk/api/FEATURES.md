#  Features API

Toggle experiences, run experiments, and gate functionality using  feature flags and experiments. The API resolves host-managed settings so your game can adapt dynamically.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const isNewUIEnabled = await RundotGameAPI.features.getFeatureFlag('new_ui_enabled')
if (isNewUIEnabled) {
  showNewInterface()
}
```

## Gates & Experiments

```typescript
const canAccessBeta = await RundotGameAPI.features.getFeatureGate('beta_features')

const experiment = await RundotGameAPI.features.getExperiment('checkout_flow')
if (experiment?.value === 'variant_b') {
  renderVariantB()
}
```

## Best Practices

- Cache feature results locally and invalidate on lifecycle transitions if necessary.
- Build fallbacks for disabled features—the host may roll flags off without notice.
- Record exposure events via `RundotGameAPI.analytics` to measure feature impact.

