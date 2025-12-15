---
description: Typical development workflow
---

# Deploying your game to Venus

## Quick Start

Steps to publish a NEW game to Venus (and updating it):

```shellscript
# Step 1: Login
venus login

# Step 2: Initialize your game
venus init

# Step 3: Deploy your game
venus deploy

# Step 4: Make it public (optional)
venus game set-public

# Step 5: Deploy again whenever you have updates (and make them public)
venus deploy --public --bump Patch
```

## Commands



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
