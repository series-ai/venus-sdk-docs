# Logging into Venus with the CLI

To use the Venus CLI, you'll need to log into your Venus account.

## Login

Run:

```shellscript
venus login
```

This will open a browser window so you can authenticate.

For additional options (like forcing a new session or choosing an environment), run:

```shellscript
venus login --help
```

## Verify you're logged in

If you're unsure whether you're logged in, try any command (for example `venus list-games`). If you see authentication errors, rerun `venus login`.
