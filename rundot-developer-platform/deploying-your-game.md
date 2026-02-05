---
icon: cloud-arrow-up
---

# Deploying Your Game

This page covers everything about getting your game live on RUN.game — logging in, deploying builds, publishing, versioning, and managing visibility.

## Log into RUN.game

You'll need to log in before you can deploy. From your Terminal:

```bash
rundot login
```

This opens a browser window where you can log in with your Google account. Any command that requires authentication will alert you if you aren't logged in.

**To force a new login session:**

```bash
rundot login --force
```

Your session info is stored locally in `~/.rundot/` (macOS/Linux) or `%USERPROFILE%\.rundot\` (Windows).

## Build your game

Don't forget to create a new build before deploying. If you're using our templates:

```bash
npm run build
```

This compiles your game into the `./dist` folder.

{% hint style="info" %}
Experienced developers: build your game any way you wish. You can specify a custom build path with `--build-path`.
{% endhint %}

## Deploy

_**Deploy**_ means your game is playable by anyone you share a link with, but it won't appear on the platform or in search results. Think of it as "unlisted" by default.

```bash
rundot deploy
```

When done, you'll get a shareable link playable in any desktop browser or in the RUN.game app.

## Publish your game

When you're ready for your game to appear in search results on the RUN.game platform:

```bash
rundot deploy --public
```

Or set visibility separately after deploying:

```bash
rundot game set-public --version latest
```

## Managing visibility

Your game can be:

* **Public**: Visible on the RUN.game **Explore** page
* **Private**: Hidden from Explore, but still accessible via OneLink. Great for sharing with testers.

**Make the game private (hide from Explore):**

```bash
rundot game set-private
```

To see all visibility options:

```bash
rundot game set-public --help
rundot game set-private --help
```

## Controlling version numbers

`rundot deploy` increments your game's version automatically.

Use `--bump` to control versioning:

* `major`: 1.0.0 → 2.0.0 (breaking changes)
* `minor`: 1.0.0 → 1.1.0 (new features) **(default)**
* `patch`: 1.0.0 → 1.0.1 (bug fixes)

```bash
rundot deploy --bump patch
```

## Advanced options

**Deploy command options:**

* `--game-id`: The game ID to deploy (reads from `game.config.json` if not provided)
* `--build-path`: Path to your game's distribution/build folder
* `--bump`: Version bump type — `major`, `minor`, or `patch` (default: `minor`)
* `--uses-preloader`: Whether the game uses the RUN.game SDK preloader
* `--public`: Make this version visible on the Explore page

**What happens under the hood:**

1. Zips the build from your game distribution folder
2. Uploads the new version to RUN.game storage
3. Creates a new version entry for your game
4. Updates the `dev` tag to point to the new version
5. Optionally sets the version as public (visible on Explore)
6. Returns OneLink URLs for both public and unlisted access

## Advanced game configuration

For more granular control, use `rundot game ...` subcommands:

```bash
rundot game --help
```

### game set-name

```bash
rundot game set-name --name "New Game Name"
```

### game set-description

```bash
rundot game set-description --description "New description"
```

### game list-versions

```bash
rundot game list-versions
```

### game add-editors

```bash
rundot game add-editors "teammate@example.com"

# Add multiple editors
rundot game add-editors "dev1@example.com dev2@example.com"
```

### game remove-editors

```bash
rundot game remove-editors "former-teammate@example.com"
```

All `game` subcommands accept `--game-id` to target a specific game (reads from `game.config.json` if not provided).
