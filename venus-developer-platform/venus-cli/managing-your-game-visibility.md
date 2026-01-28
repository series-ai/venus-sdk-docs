---
icon: glasses
---

# Managing your game's discoverability

Your game can be:

* **Public**: visible on the RUN.game **Explore** page
* **Private**: hidden from Explore, but still accessible via OneLink. This lets you share your games with early testers or a limited audience without worrying about prying eyes.

## Make the latest version public

```shellscript
rundot game set-public --version latest
```

To see all options (game id, environment, version selection), run:

```shellscript
rundot game set-public --help
```

## Make the game private

```shellscript
rundot game set-private
```

To see all options, run:

```shellscript
rundot game set-private --help
```

## Deploy and set public in one command

If you’re deploying a new version and want it visible immediately:

```shellscript
rundot deploy --public
```
