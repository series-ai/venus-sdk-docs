---
icon: rocket
---

# Getting Started

This guide walks you through everything you need to build and publish your first game on RUN.world: from installation to your first deploy.

Before you build, skim [Runtime Environment](runtime-environment.md) to see what the platform provides and what isn't allowed inside a game.

{% stepper %}
{% step %}
#### Install Node.js

You'll need version 20 or higher.

<a href="https://nodejs.org/en/download" class="button primary">Install Node.js</a>
{% endstep %}

{% step %}
#### Install the RUN.world CLI

The RUN.world CLI is what you'll use to initialize, manage, and deploy your games.

**MacOS / Linux**

Open a Terminal and run:

```bash
curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash
```

**Restart your Terminal after installation** so it can find the CLI.

**Windows**

Open PowerShell and run:

```powershell
irm https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.ps1 | iex
```
{% endstep %}

{% step %}
#### Verify installation

```bash
rundot --help
```

You should see a list of available commands. If not, see [Troubleshooting](troubleshooting.md).
{% endstep %}

{% step %}
#### Log in

```bash
rundot login
```

Your browser opens the RUN.world sign-in page. Google, Apple, or email all work, and the same page creates an account if you don't have one.
{% endstep %}

{% step %}
#### Create your game from a template

```bash
rundot init --template 2d-pixi my-game
```

This downloads the template into `my-game`, registers a new game on RUN.world, and writes `game.config.prod.json` with your game ID and build settings. Leave out the folder name to use the current folder, which must be empty.

Pick the template that fits your game:

| Template ID | What it is |
|---|---|
| `2d-pixi` | 2D Starter Kit: Pixi.js v8 + React + Tailwind |
| `3d-react` | 3D Starter Kit: Three.js |
| `csn-runner` | Endless Runner |
| `csn-launcher` | Launcher |
| `tower-defense` | Tower Defense |

Run `rundot init` with no `--template` in an empty folder to choose from the list. Outside an interactive terminal (for example, when a coding agent runs it), it prints the template IDs and exits, so pass `--template <id>`, and `--name "My Game"` to name the game.

Already have a project? See [Bring your own project](#bring-your-own-project).
{% endstep %}

{% step %}
#### Run it locally

```bash
cd my-game
npm install
npm run dev
```

Your game runs on a local dev server. To test SDK features like sign-in, storage, and multiplayer against the RUN.world playground backend, see [Testing Locally With Playground](playground.md).
{% endstep %}

{% step %}
#### Deploy to RUN.world

Build and deploy your game:

```bash
npm run build
rundot deploy
```

{% hint style="warning" %}
Replace `public/thumbnail.jpg` with your own 512×512 JPG first. Deploy fails on the template's placeholder. See [Setting Your Game Thumbnail](setting-your-game-thumbnail.md).
{% endhint %}

You'll get a private link to share, playable by anyone who has it on web or in the RUN.world app. No one will find the game on the platform until you publish it.

See [Deploying Your Game](deploying-your-game.md) for publishing (making it public), versioning, and advanced options.
{% endstep %}
{% endstepper %}

## Bring your own project

To publish a game you've already started instead of a template:

1. **Use relative file paths.** When deployed, your game is served from a subdirectory. If you use Vite, add this to `vite.config.js`:

```javascript
{
  base: './',
}
```

2. **Build to `./dist`.** The CLI looks for your build there by default. You can [customize the build path](deploying-your-game.md#advanced-options) if needed.

3. **Install the SDK:**

```bash
npm install @series-inc/rundot-game-sdk@latest
```

4. **Register the game.** From your project's root folder, run `rundot init`. In a folder that already has a project, it registers that project and writes `game.config.prod.json`. See [Initializing Your Game](initializing-your-game.md).

## Give your coding agent the SDK docs

Templates ship a `CLAUDE.md` for coding agents. To also copy the full SDK docs into `rundot/docs/` (optional):

```bash
npx rundot-sdk-setup
```

## Updating the CLI

The CLI will alert you when a new version is available. To update manually:

```bash
rundot update
```
