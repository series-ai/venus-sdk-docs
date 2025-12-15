---
icon: glasses
---

# Managing your game visibility

Your game can be:

* **Public**: visible on the Venus **Explore** page
* **Private**: hidden from Explore, but still accessible via OneLink

## Make the latest version public

```shellscript
venus game set-public --version latest
```

To see all options (game id, environment, version selection), run:

```shellscript
venus game set-public --help
```

## Make the game private

```shellscript
venus game set-private
```

To see all options, run:

```shellscript
venus game set-private --help
```

## Deploy and set public in one command

If you’re deploying a new version and want it visible immediately:

```shellscript
venus deploy --public
```
