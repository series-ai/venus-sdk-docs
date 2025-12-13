---
description: Common errors
---

# Assets do not load once my game is uploaded it to Venus!

If you are seeing errors like these in your console, your app is not finding the correct files.

![](<../../.gitbook/assets/unknown (1).png>)

{% hint style="info" %}
**TL;DR: Add base: './', to your vite.config.js**&#x20;
{% endhint %}

### Explanation

One reason for this is that we are using relative paths that work locally but work differently when the app is uploaded.

For example, when you are doing local development, npm run dev will host your assets so that /image will be hosted at [https://localhost:5173/image](https://localhost:5173/image)&#x20;

However, when we deploy to Venus, the game will be hosted in a corresponding bucket e.g. static-assets.cdn.live/game and then the image will be at static-assets.cdn.live/game/image.

Venus itself is hosted at [getreel.com](http://getreel.com) so when we see /image we will search for that image at [getreel.com/image](http://getreel.com/image), which will fail (see above for where the asset is actually located). So instead, we need to treat the base URL of where this game is hosted, as the root. The way to do this if you are using vite is to add base: './', to your vite.config.js i.e.<br>

```
{
  base: './', // <-- add this line

  build: {
    ...
  }
}
```

