---
icon: cloud-arrow-up
---

# Deploy your game to RUN.game

Deploying your game is simple.

{% stepper %}
{% step %}

### Build your game

Don't forget to create a new build of your game. It's easy to forget this step! Even if your game is running locally, that doesn't mean it's built to be deployed.

If you're using our templates, simply run this command from your project's root folder:

```
npm run build
```

This will compile your game into the `./dist` folder in the root of your project.

{% hint style="info" %}
Experienced developers: build your game any way you wish. You can optionally specify the path to your build, as described below.
{% endhint %}
{% endstep %}

{% step %}

### Deploy

You'll want to share your game early and often to get plenty of feedback. _**Deploy**_ means your game is playable by people who you share a link with, but it won't be shown on the platform to anyone, and won't be shown in search results on the platform. Think of a deployed game as "unlisted" by default.

To deploy a build, run:

```
rundot deploy
```

When it's done deploying, the CLI will show you a link to your game. Share it with anyone! It will be playable in any desktop browser, or in the RUN.game app.
{% endstep %}

{% step %}

### Publish your game to make it show in seach results

When you feel like your game's met a quality bar that you're proud of, you can make it show up in search results on the RUN.game platform, for everyone.

To publish your game, run:

```
rundot deploy --public
```

{% endstep %}
{% endstepper %}

## **Advanced options**

**There are optional CLI paramters that give you fine control:**

* `--game-id`: The game ID to deploy (reads from `game.config.json` if not provided)
* `--build-path`: Path to your game's distribution/build folder
* `--bump`: Version bump type - `major`, `minor`, or `patch` (default: `minor`)
* `--uses-preloader`: Whether the game uses the RUN.game SDK
* `--public`: Make this version visible on the explore page

## **Under the hood**

1. First, we zip the build up in your game distribution folder
2. Uploads the new version to RUN.game storage
3. Creates a new version entry for your game
4. Updates the `dev` tag to point to the new version
5. Optionally sets the version as public (visible in explore page)
6. Returns OneLink URLs for both public and unlisted access

```shellscript
# Deploy with default settings (uses game.config.json)
rundot deploy

# Deploy with a patch bump
rundot deploy --bump patch

# Deploy and make public immediately
rundot deploy --public
```

## Make your game visible (optional)

As explained above, the `rundot deploy` command would not make your game publicly available on the platform by default. You'll need to specify it, and there's two ways to do so.&#x20;

Either by using the `rundot deploy` command with the `--public` option like this:&#x20;

```shellscript
rundot deploy --public
```

Or set visibility with advanced `game` commands:

```shellscript
rundot game set-public --version latest
```

**game set-public options**:

* `--game-id`: The game ID (reads from `game.config.json` if not provided)
* `--version`: Which version to set public (latest by default)

To hide the game from Explore (it should still be accessible via OneLink), run:

```shellscript
rundot game set-private
```

**set-private options**:

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

example usage:

```shellscript
rundot game set-private --1e35f47e-4774-4264-8ed4-f7e7c620a64c
```

## Controlling version numbers

`rundot deploy` increments your game's version automatically.&#x20;

Use `--bump` to manually control versioning:

* `Major`: 1.0.0 → 2.0.0 (breaking changes)
* `Minor`: 1.0.0 → 1.1.0 (new features) **(default)**
* `Patch`: 1.0.0 → 1.0.1 (bug fixes)

Example:

```shellscript
rundot deploy --bump Patch
```

## Advanced game configuration (optional)

For more granular control, use `rundot game ...` subcommands.

Start here:

```shellscript
rundot game --help
```

Then run `rundot game <subcommand> --help` for details on a specific action.

### game set-name

Updates the name of your game.

```shellscript
rundot game set-name --name "New Game Name"
```

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)
* `--name`: The new name for your game

### game set-description

Updates the description of your game.

```shellscript
rundot game set-description --description "New description"
```

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)
* `--description`: The new description for your game

### game list-versions

Lists all versions of your game.

```shellscript
rundot game list-versions
```

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

### game add-editors

Add people who can edit your game.

```
rundot game add-editors <emails>
```

**Arguments:**

* `emails`: Email addresses of the editors to add (space-separated)

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

### game remove-editors

Remove people who can edit your game.

```
rundot game remove-editors <emails>
```

**Arguments:**

* `emails`: Email addresses of the editors to remove (space-separated)

**Options:**

* `--game-id`: The game ID (reads from `game.config.json` if not provided)

example usage:

```
# Add editors to your game
rundot game add-editors "teammate@example.com"

# Add multiple editors
rundot game add-editors "dev1@example.com dev2@example.com"

# Remove an editor
rundot game remove-editors "former-teammate@example.com"
```
