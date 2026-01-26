---
icon: rectangle-code
---

# Building a new game from scratch

If you're comfortable making new web apps from scratch, understand the basic conventions, know how to use npm, etc, then this is the place for you.

{% stepper %}
{% step %}

### Ensure all file pathnames are relative

When your game is deployed to RUN.game, it expects all files to have relative pathnames.

You'll encounter [this problem](https://series-1.gitbook.io/venus-docs/venus-developer-platform/troubleshooting/assets-do-not-load-once-my-game-is-uploaded-it-to-venus) if you use absolute pathnames.&#x20;

We prefer using vite as a web server and build tool. You can tell Vite to use relative pathnames by putting this line in your `vite.config.js`:

```bash
base: './',
```

{% endstep %}

{% step %}

### Initialize the project with the RUN.game CLI

```bash
cd <project root folder>
rundot init
```

{% endstep %}

{% step %}

### Build to a `./dist` folder

We also prefer npm for package management and development scripts.&#x20;

RUN.game CLI looks for your build in `./dist` when uploading to RUN.game.&#x20;

You can [optionally build](../venus-cli/deploying-your-game-to-venus.md#advanced-options) to an alternative location, but our tools will look in `./dist` by default.
{% endstep %}

{% step %}

### Verify that deployment works

Simply run:

```bash
rundot deploy
```

If everything is set up correctly, this will return a shareable link, playable by anyone on web or in the RUN.game app. This link will be unlisted, so don't worry about other people seeing this game on the RUN.game platform. To make it show in search results on RUN.game, see [publishing instructions](../venus-cli/deploying-your-game-to-venus.md).

Our templates include an npm script, `npm run deploy`, that builds and runs your game. We find it pretty handy, if you want to create a script that simplifies deployment.
{% endstep %}
{% endstepper %}
