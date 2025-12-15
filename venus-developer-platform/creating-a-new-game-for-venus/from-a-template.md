---
icon: folder-open
---

# Building from a template

Templates make it easy to get started building games on Venus. Currently, we have a few basic templates, but we'll offer more over time that give you a bigger head start in popular game genres.

{% stepper %}
{% step %}
### Download a template

2D games tend to be easier to build than 3D games. Our 2D template uses [Phaser](https://phaser.io/), which is a very powerful and easy to use 2D game engine.

<a href="https://drive.google.com/file/d/1k_L15UVjSwTk7FKjPgpVZKZgNv6Xodnn/view?usp=drive_link" class="button primary">2D game template</a>

Our 3D game template uses [Three.js](https://threejs.org/), the most popular and powerful 3D rendering framework on the web.

<a href="https://drive.google.com/file/d/1XSfJZ5ds9YTVgiW_Xgp0V-zX4VC-ZsMl/view?usp=drive_link" class="button primary">3D game template</a>

Use our [React](https://react.dev/) template if you want to build a game with a lot of interactive UI. React generally helps make complex UI easy to build for both desktop and mobile.

<a href="https://drive.google.com/file/d/1kOngXoOiZiH9l-5LI6wBazYCI8odMKR1/view?usp=drive_link" class="button primary">UI-heavy React game template</a>

Use our bare bones template if you want to explore 2D or 3D, without choosing one up front. You can build anything you want with this, using any web technologies that you choose. Using this template still saves you the work of setting up a new HTML project with TypeScript.

<a href="https://drive.google.com/file/d/1MUViuM1U1wdbfWs8xMWVxJd7hOiJR3pJ/view?usp=drive_link" class="button primary">Bare bones template</a>
{% endstep %}

{% step %}
### Unzip the template

Unzip the template into any location you choose.
{% endstep %}

{% step %}
### Open the project in your favorite code editor

Developers, we know that you are most productive when you're using your favorite tools. So, feel free to use any IDE that you prefer for development.

We do recommend Cursor, and we use it ourselves to keep things moving fast. In the [Venus CLI docs](../venus-cli/), we will show how you can install Cursor rules into your project to make the CLI and SDK even easier to use. We think that Cursor's also the best choice for new developers who need help getting started and who are interested in using AI to write code.

<a href="https://www.cursor.com" class="button primary">Get Cursor</a>

To begin development, simply open the folder you unzipped above in your code editor.
{% endstep %}

{% step %}
### Initialize your game

If you didn't already install the Venus CLI, [install it first.](../venus-cli/installing-the-venus-cli.md)

Open a Terminal directly inside the editor and type:

```
venus init
```

If you prefer using your Terminal/Powershell outside of your IDE:

```
cd <your project's root folder>
venus init
```

This will take you through a few basic steps that give your game a name, description, etc, for when it appears on the Venus platform.
{% endstep %}

{% step %}
### Install libraries

To install all of the required libraries that each template uses, type:

```
npm install
```

This will fetch all of the libraries and install them to your project.&#x20;
{% endstep %}

{% step %}
### Start coding

If you're new to development, we suggest browsing [Cursor's documents,](https://cursor.com/docs) or finding some YouTube videos on vibe coding.
{% endstep %}
{% endstepper %}
