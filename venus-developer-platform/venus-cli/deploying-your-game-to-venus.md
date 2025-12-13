---
description: >-
  this document goes over the typical development workflow, detailing how to
  login, create a game, update and publish it to Venus platform
---

# Deploying your game to Venus



The regular workflow to create, deploy, update and publish your games on Venus includes the following steps:

* [Login](deploying-your-game-to-venus.md#login)
* [Create game](deploying-your-game-to-venus.md#create-your-game)
* [Upload your game](deploying-your-game-to-venus.md#uploading-your-game)
* [Publish your game](deploying-your-game-to-venus.md#publishing-your-game)
* [Update your game](deploying-your-game-to-venus.md#update-your-game)
* [Configure your game](deploying-your-game-to-venus.md#changing-your-game-configuration)

All of these steps are related to specific Venus commands, that you'll need to run using the terminal.&#x20;

Details for each of these steps are found below.

{% hint style="info" %}
Note: You should always run the terminal in the root folder of your game/project.
{% endhint %}

{% hint style="info" %}
How to open terminal:

* MacOS: open your terminal by using Spotlight search (press Command + Space, type "Terminal," and press Enter
* Windows: open the powershell terminal by pressing the Windows key + Q, typing `powershell` into the Search dialog box and click it.
{% endhint %}

## Login

You'll only be able to use the Venus CLI **only** if you're logged in.

To login, please run this command (on your terminal):

```shellscript
venus login
```

You'll be prompted a new browser window to authenticate.&#x20;

* [Make sure to select your Venus (Series) account.](#user-content-fn-1)[^1]

You'll be able to use the Venus CLI once you're logged in!

{% hint style="info" %}
Note:

* your session will then be saved locally in `~/.venus_cli/`
* You can run the `venus login` command again to refresh your session, if it expires.
{% endhint %}

## Create your game

Second step, is to create the new HTML5 game application on Venus.

For that, you should run a command that goes:

```shellscript
venus create-game --name "My Awesome Game" --path "/path/to/game/dist"
```

This command introduces two options that are both required:

* `--name` : where your game name should go ie: "Burger Shop Rush").
* `--path` : the actual path location of your game's distribution/build folder.&#x20;
* `--uses-preloader` : whether or not your game uses the pre-loader included in the Venus SDK.

You can also create an HTML5 application on Venus in interactive mode by just using this command:

```shellscript
venus create-game
```

This mode prompts you for the name, description, pre-loader usage, and path of your HTML5 game.

### What it does

1. Zips your game distribution folder
2. Uploads the zip file to Venus storage
3. Creates a new game with an initial version (0.0.1)
4. Returns the created game ID
5. Creates a `game.config.json` file in your current directory with the game ID and path

**About game.config.json**

This file stores your game's configuration and makes future updates easier. It should be located in the root of your project directory (where you run venus commands):

```
{
  "gameId": "your-game-id",
  "relativePathToDistFolder": "./dist"
  "usesPreloader": true/false
}
```

With this file, you can run `venus update-game` and `venus publish-game` without specifying the game ID or path!

## Publishing your game

Once ready to make your game visible on Venus, you should use the `publish` command:

```powershell
venus publish-game --env prod --yes
```

{% hint style="info" %}
Note:&#x20;

alternatively you can use the `--id` option to publish (optional, reads from `game.config.json` if not provided).
{% endhint %}

### What it does

1. Fetches your game information from `game.config.json` (or uses the `--id` option).
2. Gets the latest version of your game.
3. Returns a OneLink URL for accessing the game.

## Update your game

If you have new updates or want to fix bugs in your game, then you should use the `update` command to create a new version of your game, with the updated content.

```powershell
venus update-game --bump patch
```

### Options

* `--id` (optional): The game ID to update. If not provided, reads from `game.config.json`
* `--path` (optional): Path to your updated game's distribution/build folder. If not provided, reads from `game.config.json`
* `--bump` (optional, default: `patch`): Version bump type - `major`, `minor`, or `patch`

### Version Bumping

* `major`: 1.0.0 → 2.0.0 (breaking changes)
* `minor`: 1.0.0 → 1.1.0 (new features)
* `patch`: 1.0.0 → 1.0.1 (bug fixes)

### What it does

1. Zips your game distribution folder
2. Uploads the new version to Venus storage
3. Creates a new version entry for your game
4. Does NOT automatically publish the version - use `publish-game` for that

{% hint style="info" %}
Note:&#x20;

you can also use a specific command to update and publish your game at once:

```powershell
venus update-and-publish-game --bump patch --env prod
```
{% endhint %}

## Usage Examples

### Creating and publishing a new game

```powershell
# Step 1: Login to Venus
venus login
# Opens browser for authentication

# Step 2: Create your game
venus create-game --name "Space Invaders HD" --path "./build/web"
# Output: Game created with id 'abc123xyz'
# Creates game.config.json automatically

# Step 3: Publish to production
venus publish-game --env prod
```

### Updating an existing game

```powershell
# If you have game.config.json (created by venus create-game):

# Create a new version with patch bump (1.0.0 → 1.0.1)
venus update-game --bump patch

# Publish the new version to production
venus publish-game --env prod

# Create a new version with a minor bump (1.0.1 → 1.1.0)
venus update-game --bump minor
venus publish-game --env prod

# Create a new version with a major bump (1.1.0 → 2.0.0)
venus update-game --bump major
venus publish-game --env prod

# If you don't have game.config.json, specify manually:
venus update-game --id "abc123xyz" --path "./build/web" --bump patch
venus publish-game --id "abc123xyz" --env prod
```

### Using the combined update and publish command

```powershell
# Quick iteration: update and publish in one command
venus update-and-publish-game --bump patch --env prod --yes

# Use defaults from game.config.json and active environment
venus use-env dev
venus update-and-publish-game
```

{% include "../../.gitbook/includes/cli-troubleshooting.md" %}

## Changing your game configuration

Use this command to change your game id, path, or preloader settings for your `game.config.json`

This helps make changing versions, game ids, and other settings much easier.

```
venus configure-game
```

### Options

* `--id`: the game id to set. This defaults to the value currently stored in `game.config.json`.
* `--path`: the game path to set. This defaults to the path currently stored in `game.config.json`.
* `--uses-preloader`: Whether or not you want to use the preloader included in the Venus-SDK. Defaults to the value currently stored in `game.config.json`.



[^1]: we should update this afterwards for 3P
