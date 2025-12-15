---
icon: wrench
---

# Initialize your game

When you want to initialize your project to work with Venus, or if you want to make an existing Venus project publish to a new game (like if you wanted to fork a project), simply run:

```
venus init
```

This command will interactively walk you through the initalizaton process.

{% hint style="success" %}
You can run this command on any HTML5 game project.&#x20;

You can initialize any project at any time. If you have a existing game you've already been working on, you can initialize it at any time.
{% endhint %}

## Manually initialize with CLI options

You can bypass interactive mode and manually specify everything that initialization requires. To see options, run:

```
venus init --help
```

## Under the hood

After you initialize your project's root folder, we create a file called `game.config.json` file that stores your game's configuration.

This makes future deployments easier by storing your game ID and build path.

In it, you'll see something like this:

```json
{
  "gameId": "your-game-id",
  "relativePathToBuildFolder": "./dist",
  "usesPreloader": false
}
```
