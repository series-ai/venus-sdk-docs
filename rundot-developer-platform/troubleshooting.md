---
icon: circle-question
---

# Troubleshooting

## CLI Issues

#### "Session expired" or authentication errors

* Run `rundot login` to authenticate
* If already logged in but it still fails, run `rundot login --help` to see session-related options
* Your session is automatically refreshed, but if you encounter issues, re-login

#### "Failed to upload file" error

* Check your internet connection
* Ensure you're logged in with `rundot login`
* Verify the game build folder exists and is not empty

#### "Game dist folder does not exist" error

* Verify the path to your game's build folder is correct
* Ensure you're using the full path or correct relative path
* If you previously initialized the game, check that your local game config points at the correct build folder

#### "Unable to load game config" error

* Make sure you're running the command from your project root (where you initialized the game)
* If the CLI can't find your game/build info automatically, run `rundot deploy --help` (or `rundot game upload-build --help`) to see what you can pass explicitly
* If you have a local game config file, verify it is valid JSON and matches your current project

#### "Game not found" or "Game has no version" error

* Ensure you've created the game using `rundot init` (or `rundot game create`) first
* Verify the game ID you're using is correct (see `--help` for the command you're running)
* Make sure you've created at least one version using `rundot deploy` (or `rundot game upload-build`) before setting it public

#### Version conflicts

* When updating a game, the version must be higher than the current version
* Use appropriate bump type (major, minor, patch)

#### PATH not updated after installation (macOS/Linux)

* The installer automatically adds `~/.local/bin` to your PATH
* You may need to reload your shell: `source ~/.bashrc` (or `~/.zshrc` for zsh)
* Or simply open a new terminal window
* To verify: run `echo $PATH` and check if `~/.local/bin` is listed
* If you used a custom install directory, make sure it's in your PATH

## SDK Issues

#### My assets aren't loading when I deploy. Why?

If your console shows file-not-found errors after deploying, your app is using absolute paths instead of relative paths.

{% hint style="info" %}
**TL;DR: Add `base: './'` to your `vite.config.js`**
{% endhint %}

Relative paths usually work on your local machine, but when deployed, the web server serves your game from a subdirectory, so absolute paths won't resolve correctly.

If you're using Vite, open `vite.config.js` and add:

```javascript
{
  base: './', // <-- add this line

  build: {
    ...
  }
}
```

#### How do I update the SDK?

From your project's root folder:

```bash
npm install @series-inc/rundot-game-sdk@latest
```

#### Ads do not work in my game

Ads are currently not supported on Desktop, but will be in a future SDK update.

If you're using a VPN, the ads won't be able to load.

## Getting Help

* If you're ever stuck or can't find what you need here, ask the lovely humans in our Discord. We're a pretty friendly bunch of people who love making cool new things, too.
* Check the command help: `rundot --help`
* Check specific command help: `rundot <command> --help`
  * e.g., `rundot login --help`, `rundot init --help`, `rundot deploy --help`, `rundot game --help`
* Make sure you're on the latest version by running `rundot update`
* Check the [GitHub releases](https://github.com/series-inc/rundot_cli_releases/releases) for changelogs and known issues
