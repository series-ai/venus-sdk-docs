# Troubleshooting

## Common Issues

### "Session expired" or authentication errors

* Run `venus login` to authenticate
* If already logged in, try `venus login --force` to force a new login session
* Your session is automatically refreshed, but if you encounter issues, re-login

### "Failed to upload file" error

* Check your internet connection
* Ensure you're logged in with `venus login`
* Verify the game distribution folder exists and is not empty

### "Game dist folder does not exist" error

* Verify the path to your game's build folder is correct
* Ensure you're using the full path or correct relative path
* Check that the path in `game.config.json` is correct if using auto-detection

### "Unable to load game config" error

* Make sure you're running the command from the directory containing `game.config.json`
* Or provide `--id` and -`-path` options manually (for update-game)
* Verify the `game.config.json` file is valid JSON
* For publish-game, ensure `game.config.json` exists in the current directory

### "Game not found" or "Game has no version" error

* Ensure you've created the game using `venus create-game` first
* Verify the game ID in `game.config.json` is correct
* Make sure you've created at least one version using `venus update-game` before publishing

### Version conflicts

* When updating a game, the version must be higher than the current version
* Use appropriate bump type (major, minor, patch)

### PATH not updated after installation (macOS/Linux)

* The installer automatically adds `~/.local/bin` to your PATH
* You may need to reload your shell: source `~/.bashrc` (or `~/.zshrc` for zsh)
* Or simply open a new terminal window
* To verify: run `echo $PATH` and check if `~/.local/bin` is listed
* If you used a custom install directory, make sure it's in your PATH

## Getting Help

* Check the command help `venus --help`
* check specific command help: `venus <command> --help`
  * e.g., `venus login --help`, `venus create-game --help`, etc.
* Make sure you're on the latest version by running `venus update`
* Check the [GitHub releases](https://github.com/Zee-Series-AI/venus_cli_releases/releases) for changelogs and known issues
