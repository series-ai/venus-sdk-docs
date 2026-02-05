# Experiments API

Run A/B tests, toggle features, and gate functionality using experiments and feature flags. The API resolves host-managed settings so your game can adapt dynamically based on user segmentation.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Simple feature flag (boolean on/off)
const isNewUIEnabled = await RundotGameAPI.features.getFeatureFlag('new_ui_enabled')
if (isNewUIEnabled) {
  showNewInterface()
}
```

## A/B Testing with Experiments

Experiments let you test multiple variants and measure which performs best.

```typescript
// Get experiment with variant information
const experiment = await RundotGameAPI.features.getExperiment('checkout_flow')

// experiment returns:
// {
//   name: string,        // Experiment name
//   ruleID: string,      // Rule identifier
//   value: any,          // Experiment value (e.g., 'variant_a', 'variant_b')
//   groupName: string    // Group name for analytics
// }

if (experiment?.value === 'variant_b') {
  renderVariantB()
} else {
  renderVariantA()
}

// Record exposure for analytics
await RundotGameAPI.analytics.recordCustomEvent('experiment_exposure', {
  experimentName: experiment.name,
  variant: experiment.value,
  groupName: experiment.groupName,
})
```

## Feature Flags

Simple boolean toggles for enabling/disabling features.

```typescript
const showDailyRewards = await RundotGameAPI.features.getFeatureFlag('daily_rewards_enabled')
const enableSounds = await RundotGameAPI.features.getFeatureFlag('sound_effects')

if (showDailyRewards) {
  displayDailyRewardsButton()
}
```

## Feature Gates

User-targeted feature access based on user segments or criteria.

```typescript
// Check if user has access to beta features
const canAccessBeta = await RundotGameAPI.features.getFeatureGate('beta_features')

if (canAccessBeta) {
  showBetaContent()
}

// Gate premium features
const isPremiumUser = await RundotGameAPI.features.getFeatureGate('premium_tier')
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getExperiment(experimentName)` | `{ name, ruleID, value, groupName }` | Get A/B test variant with metadata |
| `getFeatureFlag(flagName)` | `boolean` | Simple on/off toggle |
| `getFeatureGate(gateName)` | `boolean` | User-targeted feature access |

## How to Set Up an A/B Test

1. **Define your hypothesis**: What behavior change do you expect from each variant?
2. **Configure the experiment** in the host dashboard with your variants
3. **Implement variant logic** using `getExperiment()`
4. **Track exposure events** via `RundotGameAPI.analytics` to measure impact
5. **Analyze results** and roll out the winning variant

## Best Practices

- Cache feature results locally and invalidate on lifecycle transitions if necessary.
- Build fallbacks for disabled features—the host may roll flags off without notice.
- Record exposure events via `RundotGameAPI.analytics` to measure feature impact.
- Use meaningful experiment names that describe what's being tested.
- Keep experiment logic isolated so variants can be easily removed after the test concludes.
