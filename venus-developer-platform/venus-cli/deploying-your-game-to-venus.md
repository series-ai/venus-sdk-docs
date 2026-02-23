---
icon: cloud-arrow-up
---

# Deploy your game to RUN.game

Deploying your game is simple.

{% hint style="info" %}
**Getting familiar with the CLI:** Run `rundot --help` for general help, `rundot <command> --help` for a specific command (e.g. `rundot deploy --help`), or `rundot game <command> --help` for game subcommands (e.g. `rundot game info --help`). Review error messages carefully—they often contain helpful information. All commands are designed to be non-interactive; if a command prompts you to log in or enters interactive mode, something has gone wrong (contact support if login is required).
{% endhint %}

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

**First time only:** create your game configuration by running:

```
rundot init --name <game name> --description <game description>
```

This creates `game.config.json` and uses non-interactive mode (you need the name and description of your game before running it).

**Then deploy:** run:

```
rundot deploy
```

To deploy with a version increment:

```
rundot deploy --bump patch
```

This deploys your game to a tag labelled **development** on the RUN.game platform. The development tag is unlisted—your game is not visible to the public but can be reached via the OneLink the CLI returns. Share that link with anyone; the game will be playable in any desktop browser or in the RUN.game app.
{% endstep %}

{% step %}

### Publish your game for review

When your game is ready for the platform, submit it for review:

```
rundot deploy --public
```

This deploys your game to a tag labelled **staging** on the RUN.game platform. Staging is used by RUN.game staff to review your game. Once a game is approved, it will be published to the public by an admin. If it is not approved, the staging tag will contain the reason.

**To get a game approved, it must:**

1. Be fully functional and work as expected.
2. Not contain any controversial or offensive content.
3. Have a thumbnail named `thumbnail.jpeg` in the **public** folder (not in the project root).
4. Have a thumbnail no larger than 256×256 pixels.
5. Have a name and description (set via `rundot init --name` and `--description`, or the game set-name/set-description commands).

{% endstep %}
{% endstepper %}

## **Advanced options**

**There are optional CLI paramters that give you fine control:**

* `--game-id`: The game ID to deploy (reads from `game.config.json` if not provided)
* `--build-path`: Path to your game's distribution/build folder
* `--bump`: Version bump type - `major`, `minor`, or `patch` (default: `minor`)
* `--uses-preloader`: Whether the game uses the RUN.game SDK
* `--public`: Deploy to staging for staff review (once approved, an admin publishes to the explore page)

## **Under the hood**

1. First, we zip the build up in your game distribution folder
2. Uploads the new version to RUN.game storage
3. Creates a new version entry for your game
4. Updates the **development** tag to point to the new version (or **staging** when using `--public`)
5. With `--public`, the version is submitted for staff review; once approved, an admin publishes it to the explore page
6. Returns OneLink URLs for access

```shellscript
# Deploy with default settings (uses game.config.json)
rundot deploy

# Deploy with a patch bump
rundot deploy --bump patch

# Deploy and make public immediately
rundot deploy --public
```

## Make your game visible (optional)

Use `rundot deploy --public` to submit your game for review. That deploys to the **staging** tag so RUN.game staff can review it. Once approved, an admin will publish it to the explore page. Ensure your game meets the approval requirements (thumbnail in `public/`, name and description, etc.) before submitting.

For games that are already published, you can change visibility with the `game` commands:

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
rundot game set-private --game-id 1e35f47e-4774-4264-8ed4-f7e7c620a64c
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

Name and description can be set when you first run `rundot init --name <game name> --description <game description>`. For more granular control later, use `rundot game ...` subcommands.

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
