---
icon: circle-question
---

# Troubleshooting

#### My assets aren't loading when I deploy to . Why?

If you are seeing errors like these in your console, your app is not finding the correct files.

![](<../../.gitbook/assets/unknown (1).png>)

{% hint style="info" %}
**TL;DR: Add base: './', to your vite.config.js**&#x20;
{% endhint %}

Relative paths usually work on your local machine, but work differently when your game app is deployed. When deployed, the  web server will server your game from a subdirectory, so it will not be able to find you game's assets from the web server's root folder.

If you are using vite, the way to fix this is to open vite.config.js and add the lines as shown below:

```
{
  base: './', // <-- add this line

  build: {
    ...
  }
}
```

#### How do I update the SDK?

In your Terminal:

From your project's root folder

```
cd <you project's root folder>
npm i @series-inc/rundot-game-sdk@latest.
```

#### Ads do not work in my game

Ads are currently not supported on Desktop, but will be in a future SDK update.

If you're using a VPN, the ads won't be able to load.

#### I can't find what I need here. Where else should I look?

If you're ever stuck or can't find what you need here, ask the lovely humans in our Discord. We're a pretty friendly bunch of people who love making cool new things, too.

