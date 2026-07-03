---
icon: gamepad
---

# Testing Locally With Playground

Playground lets you run your game on a local Vite dev server while SDK calls use the RUN.game playground backend. Use it to test storage, profiles, leaderboards, purchases, multiplayer, simulation, and other SDK APIs before you deploy a build.

The local page gets a RUN.game toolbar for sign-in, player switching, and environment status. Playground is separate from production data and may be reset periodically.

## Install dependencies

From your game project directory:

```bash
npm install @series-inc/rundot-game-sdk@latest
npm install --save-dev vite typescript firebase@^12.12.1
```

If you test IAP or subscription APIs in Playground, also install RevenueCat's web package:

```bash
npm install --save-dev @revenuecat/purchases-js@^1.39.1
```

Install `firebase` and `@revenuecat/purchases-js` as `devDependencies`. They are used only by the local Playground. The playground plugin injects its host only during `vite dev`, so these packages are not part of the deployed RUN.game build.

## Add the Vite plugins

Most RUN.game templates already include `rundotGameLibrariesPlugin()`, `base: './'`, `server.allowedHosts: true`, and an ES2022 build target. Add `rundotGamePlaygroundPlugin()` next to the existing libraries plugin.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import {
  rundotGameLibrariesPlugin,
  rundotGamePlaygroundPlugin,
} from '@series-inc/rundot-game-sdk/vite'

export default defineConfig({
  plugins: [
    rundotGameLibrariesPlugin(),
    rundotGamePlaygroundPlugin(),
  ],
  base: './',
  server: {
    allowedHosts: true,
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022',
  },
})
```

> The former name `rundotGameSandboxPlugin` still works as a deprecated alias (it logs a one-time rename hint).

`rundotGamePlaygroundPlugin()` defaults to `target: 'playground'`. You can write it explicitly if you prefer:

```typescript
rundotGamePlaygroundPlugin({
  target: 'playground',
})
```

For React templates, keep `react()` first so JSX transforms still run before the RUN.game plugins:

```typescript
plugins: [
  react(),
  rundotGameLibrariesPlugin(),
  rundotGamePlaygroundPlugin(),
]
```

## Add scripts

Your `package.json` should have a Vite dev script and a deploy script:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "deploy": "npm run build && rundot deploy"
  }
}
```

## Install and log in to the CLI

If you already installed the RUN.game CLI, skip to `rundot login`.

**macOS / Linux**

```bash
curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash
```

Restart your terminal, then verify the CLI:

```bash
rundot --help
```

**Windows**

```powershell
irm https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.ps1 | iex
```

Open a new PowerShell window, then verify the CLI:

```powershell
rundot --help
```

Log in:

```bash
rundot login
```

## Initialize a game for deploys

From your game project directory:

```bash
rundot init
```

This creates `game.config.prod.json`, which stores the production game ID and build settings used by `rundot deploy`.

Playground uses `game.config.playground.json` when that file exists. If it does not exist, the first interactive Playground login can auto-create a playground game and write `game.config.playground.json` for you.

## Start Playground

Run the dev server:

```bash
npm run dev
```

Open the localhost URL printed by Vite. The page shows the RUN.game toolbar. For the first interactive tab, sign in with Google from the toolbar. If `RUNDOT_PLAYGROUND_KEY` is set, Playground signs in headlessly instead and skips the Google button.

After sign-in:

- SDK APIs use the playground backend.
- The toolbar shows the active environment and player profile.
- If this project did not have a playground game ID yet, Playground creates one and writes `game.config.playground.json`.
- Vite reloads after game creation so the new game ID is active.

## Use an existing playground game ID

If you already have a playground game ID, put it in `game.config.playground.json`:

```json
{
  "gameId": "your-game-id"
}
```

Or pass it directly in `vite.config.ts`:

```typescript
rundotGamePlaygroundPlugin({
  target: 'playground',
  gameId: 'your-game-id',
})
```

Use one approach per project. `game.config.playground.json` is easier for teams because everyone uses the same local playground target without editing Vite config.

## Test multiple players

To test player-specific flows, open the local Vite URL in multiple browser tabs after the primary tab signs in.

The first interactive tab is the primary Google-signed-in player. Secondary tabs wait for that Google session, then use tab-local synthetic player profiles such as `player1`, `player2`, and `player3`. The toolbar also includes an `Anonymous` test profile. Use the toolbar's player selector to switch profiles; switching re-authenticates and reloads the page.

This is useful for testing leaderboards, profile-specific storage, invites, multiplayer rooms, and social flows.

## Headless Playground login

Use a headless key when you want Playground to start without clicking Google Sign-In — for example in a bot, CI job, or repeatable local smoke test. The interactive Google Sign-In needs no key at all and is the safer default; reach for a headless key only when you specifically need unattended login.

### Recommended: `rundot playground grant-access`

From your game directory, run:

```bash
rundot login
rundot playground grant-access
```

This mints a **playground key** (a `pk_…` key — a distinct credential type from your `rk_` deploy key) for the current game and writes it to a git-ignored `.env.local` (chmod 0600) as `RUNDOT_PLAYGROUND_KEY`. Then just:

```bash
npm run dev
```

No `vite.config.ts` editing is needed — the playground plugin reads `RUNDOT_PLAYGROUND_KEY` from `.env` / `.env.local` automatically.

To clean up, revoke the key server-side and strip it from `.env.local`:

```bash
rundot playground revoke-access
```

### Two key types: `pk_` (playground) vs `rk_` (deploy)

A **playground key** (`pk_…`) is a distinct credential type from your **deploy key** (`rk_…`). A `pk_` key can **only** open a Playground login session — it is rejected (403) by every deploy, marketing, content-generation, and game-mutation endpoint, and the playground sign-in endpoint accepts **only** `pk_` keys (a deploy key is refused). So even if a `pk_` key leaks, it cannot deploy your game or spend money — the worst case is a throwaway playground login. That is why it is safe to keep on disk for headless dev. The two never share an env var: `RUNDOT_PLAYGROUND_KEY` holds the `pk_` key; `RUNDOT_API_KEY` holds the `rk_` deploy key (and the plugin reads only the former).

### How the key is handled

- The key is read **dev-server-side only**. It is **never** serialized to the browser. The SDK obtains a short-lived custom token from a localhost-only dev-server endpoint; the raw key never leaves your machine.
- The dev server must stay bound to localhost. The plugin refuses to start if a key is configured while binding a non-loopback host (override with `RUNDOT_ALLOW_INSECURE_KEY_BIND=1` only if you understand the risk).
- Keep `.env.local` git-ignored and never commit a key. The RUN.game templates ship a `.gitleaks.toml` you can wire into a pre-commit hook or CI to catch committed `rk_`/`pk_` keys.

### CI / secret manager

`grant-access` is the only way to mint a playground key, and it writes `.env.local`. For CI, mint it once locally and copy the `pk_…` value into your CI secret store:

```bash
rundot login
rundot playground grant-access      # writes RUNDOT_PLAYGROUND_KEY=pk_… to .env.local
# copy the pk_… value from .env.local into your CI secret as RUNDOT_PLAYGROUND_KEY
```

Then in CI, expose it to the dev server:

```bash
export RUNDOT_PLAYGROUND_KEY=pk_your_game_id_abcdef...
npm run dev
```

Do not expose a dev server that has `RUNDOT_PLAYGROUND_KEY` configured. Keep it private to your machine or trusted CI runner.

## Build and deploy after local testing

When the game works in Playground, build and deploy the production version:

```bash
npm run build
rundot deploy
```

`npm run dev` runs local Playground. `npm run build && rundot deploy` creates and uploads a production build.

## Troubleshooting

### Playground says Firebase is missing

Install Firebase as a dev dependency:

```bash
npm install --save-dev firebase@^12.12.1
```

### IAP or subscription methods say RevenueCat is missing

Install RevenueCat as a dev dependency:

```bash
npm install --save-dev @revenuecat/purchases-js@^1.39.1
```

This package is optional unless you call subscription or IAP APIs in Playground.

### The wrong game opens

Check `game.config.playground.json`. Playground reads that file for local testing. Production deploys use `game.config.prod.json`.

### The page is blank after adding the plugins

Make sure your Vite config targets ES2022:

```typescript
export default defineConfig({
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022',
  },
})
```

### CLI commands cannot find your game

Run CLI commands from the directory that contains `game.config.prod.json`, or pass `--game-id` to commands that support it.
