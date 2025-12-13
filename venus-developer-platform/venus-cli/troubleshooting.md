# Troubleshooting

## Common Issues

### "Session expired" or authentication errors

* Run `venus login` to authenticate
* If already logged in but it still fails, run `venus login --help` to see session-related options
* Your session is automatically refreshed, but if you encounter issues, re-login

### "Failed to upload file" error

* Check your internet connection
* Ensure you're logged in with `venus login`
* Verify the game build folder exists and is not empty

### "Game dist folder does not exist" error

* Verify the path to your game's build folder is correct
* Ensure you're using the full path or correct relative path
* If you previously initialized the game, check that your local game config points at the correct build folder

### "Unable to load game config" error

* Make sure you're running the command from your project root (where you initialized the game)
* If the CLI can’t find your game/build info automatically, run `venus deploy --help` (or `venus game upload-build --help`) to see what you can pass explicitly
* If you have a local game config file, verify it is valid JSON and matches your current project

### "Game not found" or "Game has no version" error

* Ensure you've created the game using `venus init` (or `venus game create`) first
* Verify the game ID you're using is correct (see `--help` for the command you’re running)
* Make sure you've created at least one version using `venus deploy` (or `venus game upload-build`) before setting it public

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
  * e.g., `venus login --help`, `venus init --help`, `venus deploy --help`, `venus game --help`
* Make sure you're on the latest version by running `venus update`
* Check the [GitHub releases](https://github.com/Zee-Series-AI/venus_cli_releases/releases) for changelogs and known issues
