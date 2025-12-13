---
description: >-
  this document goes over the typical development workflow, detailing how to
  login, create a game, update and publish it to Venus platform
---

# Deploying your game to Venus



The regular workflow to create and deploy your game to Venus includes the following steps:

* [Login](deploying-your-game-to-venus.md#login)
* [Initialize your game](deploying-your-game-to-venus.md#initialize-your-game)
* [Deploy a new version](deploying-your-game-to-venus.md#deploy-a-new-version)
* [Make your game visible (optional)](deploying-your-game-to-venus.md#make-your-game-visible-optional)
* [Update your game](deploying-your-game-to-venus.md#update-your-game)
* [Advanced game configuration (optional)](deploying-your-game-to-venus.md#advanced-game-configuration-optional)

{% hint style="info" %}
Note: You should always run the terminal in the root folder of your game/project.
{% endhint %}

{% hint style="info" %}
How to open terminal:

* MacOS: open your terminal by using Spotlight search (press Command + Space, type "Terminal," and press Enter
* Windows: open the PowerShell terminal by pressing the Windows key + Q, typing `powershell` into the Search dialog box and click it.
{% endhint %}

## Login

You'll only be able to use the Venus CLI if you're logged in.

To log in:

```shellscript
venus login
```

You'll be prompted with a browser window to authenticate.

* [Make sure to select your Venus (Series) account.](#user-content-fn-1)[^1]

{% hint style="info" %}
Notes:

* Your session is saved locally in `~/.venus_cli/`
* If you hit session/auth errors, rerun `venus login` (or run `venus login --help` to see options)
{% endhint %}

## Initialize your game

Initialize a new game (and create local config) with `venus init`:

```shellscript
venus init --name "My Awesome Game" --build-path "/path/to/game/dist"
```

For all available flags (including `--description`, `--uses-preloader`, etc.), run:

```shellscript
venus init --help
```

## Deploy a new version

Deploy a new version of your game with `venus deploy`:

```shellscript
venus deploy
```

To see all deploy options (version bumping, `--public`, `--game-id`, `--build-path`, etc.), run:

```shellscript
venus deploy --help
```

## Make your game visible (optional)

To deploy and make the version visible on Explore in one step:

```shellscript
venus deploy --public
```

Or set visibility with advanced `game` commands:

```shellscript
venus game set-public --version latest
```

To hide the game from Explore (it should still be accessible via OneLink), run:

```shellscript
venus game set-private
```

## Update your game

When you have updates, run `venus deploy` again. Use `--bump` to control versioning:

* `Major`: 1.0.0 → 2.0.0 (breaking changes)
* `Minor`: 1.0.0 → 1.1.0 (new features) **(default)**
* `Patch`: 1.0.0 → 1.0.1 (bug fixes)

Example:

```shellscript
venus deploy --bump Patch
```

## Advanced game configuration (optional)

For more granular control, use `venus game ...` subcommands.

Start here:

```shellscript
venus game --help
```

Then run `venus game <subcommand> --help` for details on a specific action.

## Usage examples

### Creating and deploying a new game

```shellscript
# Step 1: Login
venus login

# Step 2: Initialize your game
venus init --name "Space Invaders HD" --build-path "./build/web" --uses-preloader

# Step 3: Deploy a new version (and make it public on Explore)
venus deploy --public
```

### Updating an existing game

```shellscript
# Deploy again whenever you have updates
venus deploy

# For version bumping choices and other options, run:
venus deploy --help
```

[^1]: we should update this afterwards for 3P
