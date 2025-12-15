# Log into Venus

You'll need to log into your Venus account to publish your game. From your Terminal, simply run:

```shellscript
venus login
```

This will open a browser window where you can log in using your Google account.

For additional options (like forcing a new session or choosing an environment), run:

```shellscript
venus login --help
```

Any command that requires authentication will alert you if you aren't logged in.

## **Options**

**To force a new login, simply run:**

```
venus login --force
```

## **Under the hood**

On MacOS/Linux,  your login/session info is stored locally in `~/.venus/`

On Windows, it's stored in `%USERPROFILE%.venus_\ (Windows)`
