---
icon: shield-halved
---

# Runtime Environment

This page describes what the RUN.game platform gives your game at runtime — where you save player data, where you can load content from, and which device features your game can use.

Each game runs in its own isolated space on RUN.game. Player data is private to your game, and the platform provides SDK APIs for everything you'd normally reach for in a browser (storage, networking helpers, device features) — purpose-built so they work consistently across web and mobile.

## Saving Player Data

Use the SDK storage APIs to persist save state, settings, and progress. Each scope is optimized for a different sharing model:

| API | Use it for |
| --- | --- |
| [`RundotGameAPI.appStorage`](api/STORAGE.md#choosing-a-scope) | Per-player save state, settings, and progress for your game. Cloud-synced. |
| [`RundotGameAPI.deviceCache`](api/STORAGE.md#choosing-a-scope) | Anonymous, per-device hints (e.g. last-used app ID). Cross-game. |
| [`RundotGameAPI.ownerStorage`](api/STORAGE.md#owner-storage) | Per-player state shared across every title you publish. |
| [`RundotGameAPI.sharedStorage`](api/STORAGE.md#shared-storage) | Per-player state shared with another creator's game, governed by an explicit access policy. |

A typical write looks like:

```javascript
await RundotGameAPI.appStorage.setItem('level', '5')
const level = await RundotGameAPI.appStorage.getItem('level')
```

See [Storage APIs](api/STORAGE.md) for the full reference, value rules, and limits.

{% hint style="info" %}
Browser storage APIs (`localStorage`, `sessionStorage`, `IndexedDB`, `caches`, `document.cookie`, `BroadcastChannel`, and `ServiceWorker`) are not available inside the game iframe — use the SDK helpers above instead.
{% endhint %}

## Where Your Game Can Load Content From

Your game can fetch assets, scripts, fonts, and data — over `fetch`, `XMLHttpRequest`, `<img>`, `<video>`, `<audio>`, `<script src>`, `<link>`, and `WebSocket` — from the following hosts:

| Host | Use it for |
| --- | --- |
| Your own game origin | Your built game files and the `cdn-assets/` directory uploaded with your build. |
| `https://fonts.googleapis.com` | Google Fonts stylesheets. |
| `https://fonts.gstatic.com` | Google Fonts woff/woff2 files. |

SDK calls that return URLs (e.g. AI generation, embedded libraries, shared assets) point at platform-managed CDNs — those URLs work in your game without any extra configuration.

`data:` URLs work for images, media, and fonts. `blob:` URLs work for scripts, images, media, and workers, so `URL.createObjectURL(...)` is available for canvas snapshots, downloaded buffers, and dynamically-generated content.

## What Your Game Can Do

### Available to every game

- Camera (`getUserMedia({ video: true })`)
- Microphone (`getUserMedia({ audio: true })`)
- Clipboard read and write
- Autoplay (audio/video without a user gesture)

Browser and OS permission prompts still apply where they normally would — for example, the first call to `getUserMedia` still asks the player for camera access.

### Use the SDK instead

A few browser features have SDK equivalents that work consistently across web and mobile — use those:

- For opening links and sharing, use the [Sharing API](api/SHARING.md) instead of `window.open(...)`.
- For embedding third-party content, use the [Embedded Libraries API](api/EMBEDDED_LIBRARIES.md) instead of nested `<iframe>`, `<object>`, or `<embed>` elements.

## Best Practices

A few things to keep in mind as you build:

- Use the right SDK [storage scope](#saving-player-data) for player data — `appStorage` for per-game save state, `deviceCache` for anonymous per-device hints, `ownerStorage` and `sharedStorage` for cross-title state.
- Bundle your dependencies into your build, or use the [Embedded Libraries API](api/EMBEDDED_LIBRARIES.md) for shared libraries the platform provides.
- Point your `fetch` and `XMLHttpRequest` call sites at your own game origin or the [other allowlisted hosts above](#where-your-game-can-load-content-from).
- Use the [Sharing API](api/SHARING.md) for outbound links and the [Embedded Libraries API](api/EMBEDDED_LIBRARIES.md) in place of nested iframes.

If something doesn't behave the way you expect after deploying, see [Troubleshooting](troubleshooting.md) or ask in Discord.
