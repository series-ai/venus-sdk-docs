---
icon: image
---

# Setting Your Game Thumbnail

Your game's thumbnail is the image players see on the RUN.game Explore page, in search results, and on shared links. A good thumbnail makes your game stand out.

## How It Works

Place a file called `thumbnail.jpg` in your project's `public/` folder:

```
my-game/
├── public/
│   └── thumbnail.jpg
├── src/
├── game.config.json
└── ...
```

When you run `rundot deploy`, the CLI automatically picks up `thumbnail.jpg` from `public/` and uploads it with your build.

{% hint style="warning" %}
If you deploy without a `thumbnail.jpg`, the CLI will prompt you about it. You can continue without one, but your game won't look great in search results.
{% endhint %}

## Auto-Generated Thumbnails

If you don't provide a custom thumbnail (or if the file is the default placeholder from a template), the RUN.game platform will automatically generate a thumbnail for your game. This is fine for early development, but you should replace it with a custom one before publishing.

## Tips

- **Use a 1:1 aspect ratio** (square) for best results across all surfaces.
- **Keep it simple** — the thumbnail appears small in search results, so bold colors and minimal text work best.
- **Show gameplay** — screenshots or stylized game art help players understand what your game is about.
- **File format:** JPEG (`.jpg`). Keep the file size reasonable for fast uploads.
