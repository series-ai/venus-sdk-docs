# RUN.world SDK

The RUN.world SDK gives your HTML5 game access to monetization, multiplayer, storage, AI, and more, all through a single import.

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
const time = await RundotGameAPI.requestTimeAsync()
```

## API Reference

### Monetization

| API | What it does |
| --- | --- |
| [Ad Monetization](rundot-developer-platform/api/ADS.md) | Serve rewarded video and interstitial ads to earn revenue. |
| [Purchases](rundot-developer-platform/api/PURCHASES.md) | Let players spend RUN Bits on digital goods. |
| [Shop](rundot-developer-platform/api/SHOP.md) | List shop items and run the purchase flow for digital goods. |
| [Entitlements](rundot-developer-platform/api/ENTITLEMENTS.md) | Track and consume what players own (items, passes, power-ups). |
| [Collectibles (BETA)](rundot-developer-platform/api/COLLECTIBLES.md) | Manage digital collectibles and inventory items. |
| [Credits (BETA)](rundot-developer-platform/api/CREDITS.md) | Grant and track player creator credits and balances. |
| [Choices](rundot-developer-platform/api/CHOICES.md) | Read and spend player Choices diamond balances. |

### Messaging & Social

| API | What it does |
| --- | --- |
| [Notifications](rundot-developer-platform/api/NOTIFICATIONS.md) | Schedule local notifications for re-engagement. |
| [In-App Messaging](rundot-developer-platform/api/IN_APP_MESSAGING.md) | Display toast notifications and in-app messages. |
| [Popups](rundot-developer-platform/api/POPUPS.md) | Host toasts, platform like prompts, and comments sheet. |
| [Clips (BETA)](rundot-developer-platform/api/CLIPS.md) | Record, save, and share video gameplay clips. |
| [Sharing](rundot-developer-platform/api/SHARING.md) | Share links, generate QR codes, and handle share parameters. |
| [Activity (BETA)](rundot-developer-platform/api/ACTIVITY.md) | Post activity feeds and social status updates. |

### Assets & Media

| API | What it does |
| --- | --- |
| [Assets](rundot-developer-platform/api/ASSETS.md) | Load game assets from the CDN with caching, preloading, and WebView support. |
| [CDN](rundot-developer-platform/api/CDN.md) | Direct CDN asset fetching and signed URL resolution. |
| [Shared Assets](rundot-developer-platform/api/SHARED_ASSETS.md) | Download host-provisioned asset bundles shared across titles. |
| [Asset Library](rundot-developer-platform/api/ASSET_LIBRARY.md) | Query and browse shared platform asset catalogs. |
| [Files (BETA)](rundot-developer-platform/api/FILES.md) | Upload and manage game-specific file attachments. |
| [Video (BETA)](rundot-developer-platform/api/VIDEO.md) | Hand off video playback to native Picture-in-Picture (iOS only). |
| [UGC (BETA)](rundot-developer-platform/api/UGC.md) | User-generated content creation and moderation. |

### Game Systems & Multiplayer

| API | What it does |
| --- | --- |
| [Multiplayer (BETA)](rundot-developer-platform/api/MULTIPLAYER.md) | Build synchronous multiplayer sessions with real-time updates. |
| [Advanced Multiplayer (BETA)](rundot-developer-platform/api/ADVANCED-MULTIPLAYER.md) | Shared persistent worlds, turn loops, and matchmaking. |
| [Syncplay](rundot-developer-platform/api/SYNCPLAY.md) | Deterministic rollback netcode, physics, and gameplay modules. |
| [PvP System (BETA)](rundot-developer-platform/api/PVP_SYSTEM.md) | Competitive matchmaking, ratings, and PvP room orchestration. |
| [Simulation API (BETA)](rundot-developer-platform/api/SERVER_AUTHORITATIVE.md) | Drive authoritative game state through the simulation system. |
| [Simulation: Config Reference (BETA)](rundot-developer-platform/api/SIMULATION_CONFIG.md) | Define entities, recipes, loot tables, and lifecycle hooks in JSON config. |
| [Simulation: Energy System (BETA)](rundot-developer-platform/api/ENERGY_SYSTEM.md) | Implement regenerating energy/stamina with offline catch-up. |
| [Simulation: Gacha System (BETA)](rundot-developer-platform/api/GACHA_SYSTEM.md) | Add loot boxes with weighted pools, pity counters, and guarantees. |
| [Simulation: Building Timers (BETA)](rundot-developer-platform/api/BUILDING_TIMERS.md) | Timed upgrades, build queues, and passive resource generation. |
| [Stats (BETA)](rundot-developer-platform/api/STATS.md) | Record and aggregate gameplay metrics and statistics. |
| [Leaderboards](rundot-developer-platform/api/LEADERBOARD.md) | Competitive leaderboards with multiple security levels. |
| [Big Numbers](rundot-developer-platform/api/BIGNUMBERS.md) | Handle exponential economies without losing precision. |
| [Experiments (LiveOps)](rundot-developer-platform/api/LIVEOPS.md#experiments-ab-testing) | Run A/B tests with deterministic per-player variants. |

### Device, Platform & Input

| API | What it does |
| --- | --- |
| [Runtime Environment](rundot-developer-platform/runtime-environment.md) | Storage scopes, the network allowlist, and device features the platform provides. |
| [Environment](rundot-developer-platform/api/ENVIRONMENT.md) | Detect device type, platform, screen size, and dev mode. |
| [Safe Area](rundot-developer-platform/api/SAFE_AREA.md) | Read safe-area insets to avoid overlapping host UI and notches. |
| [System](rundot-developer-platform/api/SYSTEM.md) | Device specs, Steam detection, pointer lock, and fullscreen. |
| [Gamepad](rundot-developer-platform/api/GAMEPAD.md) | Standardized controller input, mapping, and vibration. |
| [Navigation (BETA)](rundot-developer-platform/api/NAVIGATION.md) | In-app deep navigation and game switching. |
| [Access Gate](rundot-developer-platform/api/ACCESS_GATE.md) | Validate user access gates and pass entitlements. |
| [App (BETA)](rundot-developer-platform/api/APP.md) | Native app lifecycle and host window controls. |

### AI & Generation

| API | What it does |
| --- | --- |
| [AI](rundot-developer-platform/api/AI.md) | Generate text and images using hosted AI models. |
| [Runtime image generation](rundot-developer-platform/api/IMAGE_GEN.md) | Generate and transform images from a running game. |
| [Audio Generation (BETA)](rundot-developer-platform/api/AUDIO_GEN.md) | Generate runtime sound effects and musical loops. |
| [Video Generation (BETA)](rundot-developer-platform/api/VIDEO_GEN.md) | Generate AI video clips and animations. |
| [3D Generation (BETA)](rundot-developer-platform/api/THREE_D_GEN.md) | Generate 3D procedural meshes and assets. |
| [Design-time image generation](rundot-developer-platform/design-time-image-generation.md) | Use `rundot` to make local images, references, edits, and transforms while developing. |
| [Agent Runtime (BETA)](rundot-developer-platform/agent-runtime.md) | Build durable chat agents and game characters with tools, approvals, recovery, and multiple-tab protection. |

### Utility & Platform

| API | What it does |
| --- | --- |
| [Analytics](rundot-developer-platform/api/ANALYTICS.md) | Record gameplay telemetry, funnel steps, and user properties. |
| [Attribution](rundot-developer-platform/api/ATTRIBUTION.md) | Read the web campaign and UTM parameters the player arrived with. |
| [Context](rundot-developer-platform/api/CONTEXT.md) | Access launch parameters and share parameters. |
| [Embedded Libraries](rundot-developer-platform/api/EMBEDDED_LIBRARIES.md) | Load and manage embedded libraries shipped by the host. |
| [Haptics](rundot-developer-platform/api/HAPTICS.md) | Trigger haptic feedback on supported devices. |
| [Lifecycles](rundot-developer-platform/api/LIFECYCLES.md) | React to host lifecycle changes (pause/resume/teardown). |
| [Logging](rundot-developer-platform/api/LOGGING.md) | Stream structured logs for debugging and support. |
| [Playable (BETA)](rundot-developer-platform/api/PLAYABLE.md) | Lightweight UA playable ad hooks and conversion CTAs. |
| [Preloader](rundot-developer-platform/api/PRELOADER.md) | Control the native loading screen during heavy loads. |
| [Profile](rundot-developer-platform/api/PROFILE.md) | Access the current user profile. |
| [Rate Limits](rundot-developer-platform/api/RATE_LIMITS.md) | Platform rate limits and throughput guidelines. |
| [Release Notes](rundot-developer-platform/api/RELEASE_NOTES.md) | Query version changelogs and platform release notes. |
| [Storage](rundot-developer-platform/api/STORAGE.md) | Persist player data at device, app, or global scope. |
| [Time](rundot-developer-platform/api/TIME.md) | Server time synchronization and formatting. |

---

New to RUN.world? See [Getting Started](rundot-developer-platform/getting-started.md) | [Testing Locally With Playground](rundot-developer-platform/playground.md) | [Deploying Your Game](rundot-developer-platform/deploying-your-game.md) | [rundot CLI Reference](rundot-developer-platform/cli-reference.md) | [Design-time image generation](rundot-developer-platform/design-time-image-generation.md) | [Marketing Your Game (BETA)](rundot-developer-platform/marketing-your-game.md) | [Runtime Environment](rundot-developer-platform/runtime-environment.md) | [Setting Your Game Thumbnail](rundot-developer-platform/setting-your-game-thumbnail.md) | [Troubleshooting](rundot-developer-platform/troubleshooting.md)
