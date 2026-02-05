# RUN.game SDK

The RUN.game SDK gives your HTML5 game access to monetization, multiplayer, storage, AI, and more — all through a single import.

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'
```

Every API is accessed through `RundotGameAPI`. For example:

```typescript
// Save player progress
await RundotGameAPI.appStorage.setItem('level', '5')

// Show a rewarded ad
const result = await RundotGameAPI.ads.showRewardedAdAsync()

// Get server time
const time = await RundotGameAPI.time.requestTimeAsync()
```

## API Reference

### Monetization

| API | What it does |
| --- | --- |
| [Ads](rundot-developer-platform/api/ADS.md) | Serve rewarded video and interstitial ads. |
| [Purchases](rundot-developer-platform/api/PURCHASES.md) | Let players spend RunBucks on digital goods. |

### Messaging

| API | What it does |
| --- | --- |
| [Notifications](rundot-developer-platform/api/NOTIFICATIONS.md) | Schedule local notifications for re-engagement. |
| [In-App Messaging](rundot-developer-platform/api/IN_APP_MESSAGING.md) | Display toast notifications and in-app messages. |

### Assets

| API | What it does |
| --- | --- |
| [Assets](rundot-developer-platform/api/ASSETS.md) | Load and manage game assets via CDN with smart caching. |
| [Shared Assets](rundot-developer-platform/api/SHARED_ASSETS.md) | Download host-provisioned asset bundles shared across titles. |

### Game Systems

| API | What it does |
| --- | --- |
| [Experiments](rundot-developer-platform/api/EXPERIMENTS.md) | Run A/B tests, feature flags, and feature gates. |
| [Big Numbers](rundot-developer-platform/api/BIGNUMBERS.md) | Handle exponential economies without losing precision. |
| [Multiplayer (BETA)](rundot-developer-platform/api/MULTIPLAYER.md) | Build synchronous multiplayer sessions with real-time updates. |
| [Server-Authoritative (BETA)](rundot-developer-platform/api/SERVER_AUTHORITATIVE.md) | Drive authoritative game state through the simulation system. |
| [Sharing](rundot-developer-platform/api/SHARING.md) | Share links, generate QR codes, and handle share parameters. |
| [Leaderboards (BETA)](rundot-developer-platform/api/LEADERBOARD.md) | Competitive leaderboards with multiple security levels. |

### Device & Environment

| API | What it does |
| --- | --- |
| [Safe Area](rundot-developer-platform/api/SAFE_AREA.md) | Read safe-area insets to avoid overlapping host UI and notches. |
| [Environment](rundot-developer-platform/api/ENVIRONMENT.md) | Detect device type, platform, screen size, and dev mode. |

### AI

| API | What it does |
| --- | --- |
| [AI](rundot-developer-platform/api/AI.md) | Generate text and images using hosted AI models. |

### Utility

| API | What it does |
| --- | --- |
| [Analytics](rundot-developer-platform/api/ANALYTICS.md) | Record gameplay telemetry, funnel steps, and user properties. |
| [Context](rundot-developer-platform/api/CONTEXT.md) | Access launch parameters and share parameters. |
| [Embedded Libraries](rundot-developer-platform/api/EMBEDDED_LIBRARIES.md) | Load and manage embedded libraries shipped by the host. |
| [Haptics](rundot-developer-platform/api/HAPTICS.md) | Trigger haptic feedback on supported devices. |
| [Lifecycles](rundot-developer-platform/api/LIFECYCLES.md) | React to host lifecycle changes (pause/resume/teardown). |
| [Logging](rundot-developer-platform/api/LOGGING.md) | Stream structured logs for debugging and support. |
| [Preloader](rundot-developer-platform/api/PRELOADER.md) | Control the native loading screen during heavy loads. |
| [Profile](rundot-developer-platform/api/PROFILE.md) | Access the current user profile. |
| [Storage](rundot-developer-platform/api/STORAGE.md) | Persist player data at device, app, or global scope. |
| [Time](rundot-developer-platform/api/TIME.md) | Server time synchronization and formatting. |

---

New to RUN.game? See [Getting Started](rundot-developer-platform/getting-started.md) | [Deploying Your Game](rundot-developer-platform/deploying-your-game.md) | [Setting Your Game Thumbnail](rundot-developer-platform/setting-your-game-thumbnail.md) | [Troubleshooting](rundot-developer-platform/troubleshooting.md)
