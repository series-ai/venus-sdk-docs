# Experiments API

Run A/B tests, toggle features, and gate functionality using experiments and feature flags. The API resolves host-managed settings so your game can adapt dynamically based on user segmentation.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

// Simple feature flag (boolean on/off)
const isNewUIEnabled = await RundotGameAPI.getFeatureFlag({ flagName: 'new_ui_enabled' })
if (isNewUIEnabled) {
  showNewInterface()
}
```

## A/B Testing with Experiments

Experiments let you test multiple variants and measure which performs best.

```typescript
// Get experiment with variant information
const experiment = await RundotGameAPI.getExperiment({ experimentName: 'checkout_flow' })

// experiment is `Experiment | null`. When no experiment matches, it resolves to null.
// {
//   name: string,                     // Experiment name
//   ruleID: string,                   // Rule identifier
//   value: Record<string, unknown>,   // Parameter object for this variant
//   groupName: string | null          // Group name for analytics (null if unassigned)
// }

if (experiment?.value.variant === 'variant_b') {
  renderVariantB()
} else {
  renderVariantA()
}

// Record exposure for analytics (guard against a null experiment first)
if (experiment) {
  await RundotGameAPI.analytics.recordCustomEvent('experiment_exposure', {
    experimentName: experiment.name,
    variant: experiment.value.variant,
    groupName: experiment.groupName ?? 'unassigned',
  })
}
```

{% hint style="info" %}
`getExperiment` resolves `null` when no experiment matches the current user. Always guard with optional chaining (`experiment?.value`) or an explicit `if (experiment)` check before reading fields.
{% endhint %}

{% hint style="info" %}
`value` is a parameter object (`Record<string, unknown>`), not a scalar string. Read the variant off a named field (for example `experiment.value.variant`) rather than comparing `value` directly. You can also branch on `experiment.groupName` or `experiment.ruleID`.
{% endhint %}

## Feature Flags

Simple boolean toggles for enabling/disabling features.

```typescript
const showDailyRewards = await RundotGameAPI.getFeatureFlag({ flagName: 'daily_rewards_enabled' })
const enableSounds = await RundotGameAPI.getFeatureFlag({ flagName: 'sound_effects' })

if (showDailyRewards) {
  displayDailyRewardsButton()
}
```

## Feature Gates

User-targeted feature access based on user segments or criteria.

```typescript
// Check if user has access to beta features
const canAccessBeta = await RundotGameAPI.getFeatureGate({ gateName: 'beta_features' })

if (canAccessBeta) {
  showBetaContent()
}

// Gate premium features
const isPremiumUser = await RundotGameAPI.getFeatureGate({ gateName: 'premium_tier' })
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getExperiment({ experimentName })` | `Experiment \| null` | Get A/B test variant with metadata, or `null` when no experiment matches |
| `getFeatureFlag({ flagName })` | `boolean` | Simple on/off toggle |
| `getFeatureGate({ gateName })` | `boolean` | User-targeted feature access |

### `Experiment` shape

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Experiment name |
| `ruleID` | `string` | Rule identifier |
| `value` | `Record<string, unknown>` | Parameter object for the assigned variant |
| `groupName` | `string \| null` | Group name for analytics, or `null` when unassigned |

## How to Set Up an A/B Test

1. **Define your hypothesis**: What behavior change do you expect from each variant?
2. **Configure the experiment** in the host dashboard with your variants
3. **Implement variant logic** using `getExperiment()`
4. **Track exposure events** via `RundotGameAPI.analytics` to measure impact
5. **Analyze results** and roll out the winning variant

## Best Practices

- Cache feature results locally and invalidate on lifecycle transitions if necessary.
- Build fallbacks for disabled features: the host may roll flags off without notice.
- Guard `getExperiment` results for `null` before reading fields.
- Record exposure events via `RundotGameAPI.analytics` to measure feature impact.
- Use meaningful experiment names that describe what's being tested.
- Keep experiment logic isolated so variants can be easily removed after the test concludes.
