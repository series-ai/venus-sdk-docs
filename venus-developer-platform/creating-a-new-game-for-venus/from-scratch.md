---
icon: rectangle-code
---

# Building a new game from scratch

If you're comfortable making new web apps from scratch, understand the basic conventions, know how to use npm, etc, then this is the place for you.

{% stepper %}
{% step %}
### Ensure all file pathnames are relative

When your game is deployed to Venus, it expects all files to have relative pathnames.

You'll encounter [this problem](https://series-1.gitbook.io/venus-docs/venus-developer-platform/troubleshooting/assets-do-not-load-once-my-game-is-uploaded-it-to-venus) if you use absolute pathnames.&#x20;

We prefer using vite as a web server and build tool. You can tell Vite to use relative pathnames by putting this line in your `vite.config.js`:

```
base: './',
```
{% endstep %}

{% step %}
### Build to a `./dist` folder

We also prefer npm for package management and development scripts.&#x20;

Venus CLI looks for your build in `./dist` when uploading to Venus.&#x20;

You can [optionally build](../venus-cli/deploying-your-game-to-venus.md#advanced-options) to an alternative location, but our tools will look in `./dist` by default.
{% endstep %}

{% step %}
### Initialize the project with the Venus CLI

```
cd <project root folder>
venus init
```
{% endstep %}

{% step %}
### Add Cursor rules, if you're using Cursor

We offer Cursor rules that help you and Cursor use the Venus CLI and SDK. They're a huge help if you've embraced AI in your workflow.

```
venus cursor init
```
{% endstep %}
{% endstepper %}
