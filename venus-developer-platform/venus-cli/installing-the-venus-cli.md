---
icon: circle-arrow-down
---

# Installation

Installing the RUN.game CLI is simple. It works on any modern Mac, Windows, or Linux desktop machine.

## MacOS / Linux

{% stepper %}
{% step %}

### Open a Terminal

You can find the terminal app in the Applications/Utilities folder.  Or, press `Cmd + Space Bar` and type `terminal` to search for it.

Linux users, you know where to find it. 😉
{% endstep %}

{% step %}

### Run the install script

Copy the following line:

```
curl -fsSL https://github.com/series-ai/venus_cli_releases/releases/latest/download/install.sh | bash
```

Paste the line into the Terminal and press enter., then give it a few seconds to install.
{% endstep %}

{% step %}

### Restart the Terminal app

Don't skip this step! Quit the Terminal app and restart it. Restarting it allows Terminal to find the RUN.game CLI app.
{% endstep %}

{% step %}

### Verify installation

To ensure the RUN.game CLI was successfully installed on your computer, type this in your terminal and hit enter. You should see a list of commands.

```shellscript
rundot --help
```

{% endstep %}
{% endstepper %}

## Windows

{% stepper %}
{% step %}

### Open PowerShell

If you've never opened PowerShell, it's easy. Tap the Start key to open the Start menu, type "PowerShell", and you'll see the app show up in search results. If you don't see it:

* Press `Windows key + Q`
* Type `powershell` into the Search dialog box and click to open.
{% endstep %}

{% step %}

### Run the install script

Copy the following line:

```powershell
irm https://github.com/series-ai/venus_cli_releases/releases/latest/download/install.ps1 | iex
```

Paste the line into the Terminal and press enter, then give it a few seconds to install.
{% endstep %}

{% step %}

### Verify installation

In PowerShell, type this command and hit enter:

```powershell
rundot --help
```

{% hint style="success" %}
If RUN.game CLI was installed successfully, you should see the list of available commands and options.
{% endhint %}
{% endstep %}
{% endstepper %}

## Manually installing the RUN.game CLI

You can always manually download and install the RUN.game CLI [here](https://github.com/series-ai/venus_cli_releases).

## Updating the RUN.game CLI

We'll be shipping improved versions of the RUN.game CLI frequently, so you'll want to keep it up to date. When you use the CLI, it will alert you when there is a new version available for installation.

To update the RUN.game CLI to the latest version, go to your Terminal and type:

```powershell
rundot update
```

## Build a new game for RUN.game

Now that you have the RUN.game CLI installed, you're all set to [build a new game for RUN.game](../creating-a-new-game-for-venus/).&#x20;

{% include "../../.gitbook/includes/cli-troubleshooting.md" %}
