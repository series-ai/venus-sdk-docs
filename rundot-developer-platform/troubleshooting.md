---
icon: circle-question
---

# Troubleshooting

## First Steps

Before diving into specific issues, make sure you're running the latest versions. Many bugs are fixed in newer releases.

```bash
# Update the SDK
npm install @series-inc/rundot-game-sdk@latest

# Update the CLI
rundot update
```

If the issue persists after updating, check the sections below.

## CLI Issues

#### "Session expired" or authentication errors

* Run `rundot login` to authenticate
* If already logged in but it still fails, run `rundot login --help` to see session-related options
* Your session is automatically refreshed, but if you encounter issues, re-login

#### "Failed to upload file" error

* Check your internet connection
* Ensure you're logged in with `rundot login`
* Verify the game build folder exists and is not empty

#### "Game dist folder does not exist" error

* Verify the path to your game's build folder is correct
* Ensure you're using the full path or correct relative path
* If you previously initialized the game, check that your local game config points at the correct build folder

#### "Unable to load game config" error

* Make sure you're running the command from your project root (where you initialized the game)
* If the CLI can't find your game/build info automatically, run `rundot deploy --help` (or `rundot game upload-build --help`) to see what you can pass explicitly
* If you have a local game config file, verify it is valid JSON and matches your current project

#### "Game not found" or "Game has no version" error

* Ensure you've created the game using `rundot init` (or `rundot game create`) first
* Verify the game ID you're using is correct (see `--help` for the command you're running)
* Make sure you've created at least one version using `rundot deploy` (or `rundot game upload-build`) before setting it public

#### Version conflicts

* When updating a game, the version must be higher than the current version
* Use appropriate bump type (major, minor, patch)

#### A player reported a broken or lost save — how do I inspect it?

* Grab the player's current app storage to a file:
  `rundot storage export <profile-id> --save player-save.json`
* To see an *earlier* version (e.g. before the save broke), pass a timestamp:
  `rundot storage export <profile-id> --as-of 2026-06-17T10:30:00Z --save player-save.json`
  Point-in-time reads cover the last 7 days on production (the last hour
  elsewhere); a timestamp outside that window returns a "recovery window" error.
* The snapshot is JSON containing player data (PII) — store it somewhere
  gitignored and delete it when you're done.
* To reproduce the issue, restore a snapshot into a test profile you control:
  `rundot storage import <test-profile-id> --file player-save.json`
  (replaces that profile's app storage; requires the app owner role).

#### PATH not updated after installation (macOS/Linux)

* The installer automatically adds `~/.local/bin` to your PATH
* You may need to reload your shell: `source ~/.bashrc` (or `~/.zshrc` for zsh)
* Or simply open a new terminal window
* To verify: run `echo $PATH` and check if `~/.local/bin` is listed
* If you used a custom install directory, make sure it's in your PATH

## SDK Issues

#### My assets aren't loading when I deploy. Why?

If your console shows file-not-found errors after deploying, your app is using absolute paths instead of relative paths.

{% hint style="info" %}
**TL;DR: Add `base: './'` to your `vite.config.js`**
{% endhint %}

Relative paths usually work on your local machine, but when deployed, the web server serves your game from a subdirectory, so absolute paths won't resolve correctly.

If you're using Vite, open `vite.config.js` and add:

```javascript
{
  base: './', // <-- add this line

  build: {
    ...
  }
}
```

#### Ads do not work in my game

Ads are currently not supported on Desktop, but will be in a future SDK update.

If you're using a VPN, the ads won't be able to load.

#### `Blocked Browser Storage Detected` or `SecurityError` when calling `localStorage`, `IndexedDB`, or `sessionStorage`

Browser storage APIs aren't available inside the game iframe (due to sandbox isolation). The SDK's Vite plugin catches direct calls during `npm run dev` and `npm run build` with a `Blocked Browser Storage Detected` error.

**Recommended Fix:**
Use the SDK storage APIs instead:
- `RundotGameAPI.deviceCache` for local device-level caching (same device):
  ```typescript
  await RundotGameAPI.deviceCache.setItem('highScore', '100');
  const score = await RundotGameAPI.deviceCache.getItem('highScore');
  ```
- `RundotGameAPI.appStorage` for per-player cloud-synced save state (cross-device):
  ```typescript
  await RundotGameAPI.appStorage.setItem('playerData', JSON.stringify(data));
  ```
See [Storage APIs](api/STORAGE.md) and [Runtime Environment](runtime-environment.md).

**To bypass or configure the check:**
- **In `vite.config.ts`**: Pass `storageCheck: false` or `{ storageCheck: { severity: 'warn' } }` to `rundotGameLibrariesPlugin()`
- **Via environment variable**: Set `RUNDOT_DISABLE_STORAGE_CHECK=true`
- **Inline ignore**: Add `// @rundot-ignore-storage` on or above the offending line

#### A `<script>`, `<img>`, or `fetch()` to an external host is blocked

Your game can load content from your app's RUN.world CDN and Google Fonts. URLs returned by SDK calls (AI generation, embedded libraries, shared assets) also work without extra configuration. Other hosts are blocked. See [Runtime Environment → Where Your Game Can Load Content From](runtime-environment.md#where-your-game-can-load-content-from) for the full list.

#### My login / Google OAuth / own Firebase doesn't work

Third-party auth isn't supported inside the game. RUN.world signs players in for you, so a self-hosted Firebase Auth project, Google/Apple/other OAuth, or a custom identity provider won't work: the auth scripts, token endpoints, and OAuth popups they rely on are blocked by the platform sandbox. Use the platform's identity instead: gate features with the [Access Gate API](api/ACCESS_GATE.md) and read the signed-in player with the [Profiles API](api/PROFILE.md). See [Runtime Environment → Authentication & Player Identity](runtime-environment.md#authentication--player-identity).

#### My game's fullscreen button / `requestFullscreen()` doesn't work

RUN.world blocks direct iframe fullscreen and pointer lock. Fullscreen is enabled
by default. Set `"fullscreenEnabled": false` in your game config to opt out.
Deploy a new version after you change the setting. Then call
`RundotGameAPI.system.requestFullscreen()` from a direct player action. The call
must be the first awaited operation in the action handler.

The RUN.world host toolbar shows the fullscreen control only on desktop web and
Steam desktop. Native mobile and mobile web do not show that control.

Check `RundotGameAPI.system.getEnvironment().capabilities.fullscreen` before you
show the control. Only `'toggleable'` should draw one: `'always-on'` (Steam Deck,
TV) is already fullscreen with nothing to toggle, and `'unavailable'` cannot
enter it at all. Use `onFullscreenStateChange()` because Escape or a host control
can change the state. A request with `{ pointerLock: true }` stops without
fullscreen when Pointer Lock is not available. Native iOS, native Android, and
Telegram report `'unavailable'`.

#### My pause menu drops the player out of fullscreen

You are calling `exitFullscreen()`. To show a cursor for a menu while STAYING
fullscreen, call `setPointerLock(false)`, and `setPointerLock(true)` from a click
to resume. `exitFullscreen()` is only for leaving fullscreen entirely. See [System API → Fullscreen and pointer input](api/SYSTEM.md#fullscreen-and-pointer-input-asynchronous).

#### My calls to my own backend / an external API are blocked

Your game can only reach the allowlisted hosts; your own backend or an arbitrary external API server is not one of them, so calls to it are blocked by the platform sandbox. For custom server-side logic and state, use the [Simulation API](api/SERVER_AUTHORITATIVE.md). See [Runtime Environment → Calling Servers & External Services](runtime-environment.md#calling-servers--external-services) and the [content allowlist](runtime-environment.md#where-your-game-can-load-content-from).

## Getting Help

* If you're ever stuck or can't find what you need here, ask the lovely humans in our Discord. We're a pretty friendly bunch of people who love making cool new things, too.
* Check the command help: `rundot --help`
* Check specific command help: `rundot <command> --help`
  * e.g., `rundot login --help`, `rundot init --help`, `rundot deploy --help`, `rundot game --help`
* Check the [GitHub releases](https://github.com/series-ai/rundot-cli-releases/releases) for changelogs and known issues
