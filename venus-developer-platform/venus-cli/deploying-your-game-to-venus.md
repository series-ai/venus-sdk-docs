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

## Quick Start

Steps to publish a NEW game to Venus (and updating it):

```shellscript
# Step 1: Login
venus login

# Step 2: Initialize your game
venus init --name "Space Invaders HD" --build-path "./build/web" --uses-preloader

# Step 3: Deploy your game
venus deploy

# Step 4: Make it public (optional)
venus game set-public

# Step 5: Deploy again whenever you have updates (and make them public)
venus deploy --public --bump Patch
```

## Configuration

### Authentication

Before using the CLI, you need to authenticate with your Venus account:

```shellscript
venus login
```

This will open a browser window for you to sign in with your Venus credentials. Your session will be saved locally in `~/.venus/` (or `%APPDATA%\.venus\` on Windows) and automatically refreshed when needed.

**Login Options:**

* `--force`: Force a new login even if you're already authenticated

{% hint style="info" %}
**Note:**&#x20;

* Your credentials are stored securely on your local machine. The CLI never stores your password directly.
* If you hit session/auth errors, rerun `venus login` (or run `venus login --help` to see options)
{% endhint %}

### Game Configuration

The CLI uses a `game.config.json` file to store your game's configuration:

```json
{
  "gameId": "your-game-id",
  "relativePathToBuildFolder": "./dist",
  "usesPreloader": false
}
```

This file is created automatically when you run `venus init` and makes future deployments easier by storing your game ID and build path.

#### Data Storage Locations

The Venus CLI stores configuration data in the following locations:

* **Session data**: `~/.venus_cli/` (macOS/Linux) or `%USERPROFILE%\.venus_cli\` (Windows)
* **Game configuration**: `game.config.json` in your project directory

## Commands

Here's the list of available commands for the Venus CLI explained, with options descriptions and useful notes.

{% hint style="info" %}
**Note**: all commands have a `--help` option that surfaces the main info on a given command, as well as the list of options a given command has.&#x20;
{% endhint %}

### login

Authenticate with your Venus account.

```shellscript
venus login
```

**Options:**

* `--force`: Force a new login even if you're already authenticated

**What it does:**

1. Opens a browser window for authentication
2. Saves your session locally in `~/.venus_cli/`
3. Automatically refreshes your session when it expires

{% hint style="info" %}
**Note:** You need to login before using commands like `init`, `deploy`, and `list-games`.
{% endhint %}

### init

Initializes a new game on Venus. This is the first command you should run when setting up a new game.

```shellscript
venus init
```

**Options:**

* `--name`: The name of your game
* `--description`: Description of your game
* `--build-path`: Path to your game's distribution/build folder
* `--uses-preloader`: Whether the game uses the Venus SDK
* `--override`: Should override old game config file if it exists

**Options 1-4 example usage:**

```shellscript
venus init --My Game --A game about puppies --./dist --no
```

**What it does:**

1. Prompts for game details (name, description, build path) if not provided
2. Creates a new game on Venus
3. Creates a `game.config.json` file in your current directory with the game ID and settings

**Interactive Mode:** If you don't provide options, the CLI will prompt you for:

* Game Name
* Game Description
* Path to game build folder (default: `./dist`)
* Whether your game uses the Venus SDK

## deploy

Deploys your game or a new version of your game. This is the main command for publishing updates.

```shellscript
venus deploy
```

**Options**:

* `--game-id`: The game ID to deploy (reads from `game.config.json` if not provided)
* `--build-path`: Path to your game's distribution/build folder
* `--bump`: Version bump type - `major`, `minor`, or `patch` (default: `minor`)
* `--uses-preloader`: Whether the game uses the Venus SDK
* `--public`: Make this version visible on the explore page

**What it does:**

1. Zips your game distribution folder
2. Uploads the new version to Venus storage
3. Creates a new version entry for your game
4. Updates the `dev` tag to point to the new version
5. Optionally sets the version as public (visible in explore page)
6. Returns OneLink URLs for both public and unlisted access

```shellscript
# Deploy with default settings (uses game.config.json)
venus deploy

# Deploy with a patch bump
venus deploy --bump patch

# Deploy and make public immediately
venus deploy --public
```

## Make your game visible (optional)

As explained above, the `venus deploy` command would not make your game publicly available on the platform by default. You'll need to specify it, and there's two ways to do so.&#x20;

Either by using the `venus deploy` command with the `--public` option like this:&#x20;

```shellscript
venus deploy --public
```

Or set visibility with advanced `game` commands:

```shellscript
venus game set-public --version latest
```

**game set-public options**:

* `--game-id`: The game ID (reads from `game.config.json` if not provided)
* `--version`: Which version to set public (latest by default)

To hide the game from Explore (it should still be accessible via OneLink), run:

```shellscript
venus game set-private
```

**set-private options**:

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

example usage:

```shellscript
venus game set-private --1e35f47e-4774-4264-8ed4-f7e7c620a64c
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

### game set-name

Updates the name of your game.

```shellscript
venus game set-name --name "New Game Name"
```

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)
* `--name`: The new name for your game

### game set-description

Updates the description of your game.

```shellscript
venus game set-description --description "New description"
```

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)
* `--description`: The new description for your game

### game list-versions

Lists all versions of your game.

```shellscript
venus game list-versions
```

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

### game add-editors

Add people who can edit your game.

```
venus game add-editors <emails>
```

**Arguments:**

* `emails`: Email addresses of the editors to add (space-separated)

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

### game remove-editors

Remove people who can edit your game.

```
venus game remove-editors <emails>
```

**Arguments:**

* `emails`: Email addresses of the editors to remove (space-separated)

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

example usage:

```
# Add editors to your game
venus game add-editors "teammate@example.com"

# Add multiple editors
venus game add-editors "dev1@example.com dev2@example.com"

# Remove an editor
venus game remove-editors "former-teammate@example.com"
```
