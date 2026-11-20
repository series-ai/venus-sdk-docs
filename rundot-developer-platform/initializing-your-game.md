---
icon: wrench
---

# Initializing Your Game

To start a new game from a template, run `rundot init --template <id> [directory]` (for example `rundot init --template 2d-pixi my-game`). It downloads the template, registers the game, and writes `game.config.prod.json`. See [Getting Started](getting-started.md) for the template list.

When you want to set up your project to work with RUN.world, or if you want to make an existing project publish to a new game (like forking a project), run:

```bash
rundot init
```

in the project's root folder. This command interactively walks you through the initialization process. In an empty folder, `rundot init` lists the templates instead.

{% hint style="success" %}
You can run this command on any HTML5 game project.

You can initialize any project at any time. If you have an existing game you've already been working on, you can initialize it at any time.
{% endhint %}

## Manually initialize with CLI options

You can bypass interactive mode and manually specify everything. To see options:

```bash
rundot init --help
```

## Under the hood

After initialization, a `game.config.prod.json` file is created in your project root that stores your game's configuration:

```json
{
  "gameId": "your-game-id",
  "relativePathToBuildFolder": "./dist",
  "usesPreloader": false,
  "maxDpr": 1.5
}
```

> `usesPreloader` is deprecated and defaults to `false`, which lets the host reveal your game as soon as it is ready. See the [Preloader API](api/PRELOADER.md).
>
> `maxDpr` defaults to `1.5` and clamps `window.devicePixelRatio` to `1.5` on mobile devices (iOS & Android). This reduces GPU fill-rate by ~75%, stabilizing 60 FPS gameplay and eliminating iOS WebKit Jetsam OOM crashes. You can set this to `2.0` for sharper visuals or `3.0` for native unscaled resolution. See [Deploying Your Game](deploying-your-game.md#device-pixel-ratio-dpr-clamping--mobile-performance).

This makes future deployments easier by storing your game ID and build path.
