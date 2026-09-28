# Design-time image generation

Use the CLI when you are making assets for a game during development. Use the [runtime image generation API](api/IMAGE_GEN.md) when a running game needs to generate or transform images for a player.

Need the CLI first? Install it and sign in from [Install & update](cli-reference.md#install--update) and [Auth & setup](cli-reference.md#auth--setup).

CLI output is local. `rundot generate image` downloads a PNG and writes a `<output>.json` sidecar with the generation ID, prompt, resolved model, seed, and hosted image URL. It does not add the file to your build or upload it to player file storage. Put the output under your asset folder and commit or deploy it like any other local asset.

## Pick the environment and billing scope

`rundot generate image` uses the active CLI environment from `rundot set-env`. The command does not take `--env`.

```bash
rundot set-env prod
rundot generate image --prompt "cozy shop interior, hand-painted game background" --out assets/shop.png
```

Game scope is optional:

- Pass `--game-id <id>` to charge and gate the request as that game's owner.
- Omit `--game-id` inside a configured game directory to let the CLI read `game.config.<active-env>.json`.
- Omit it outside a game directory to use gameless generation, which charges the authenticated creator instead of a game's owner.

That last mode is useful for concept art. Use a game scope when you need creator-storage file keys or want the same tier gates the game will face.

## Generate an image

Prompt is required. Use `--out` when you want a stable filename. Without it, the CLI derives a slug from the prompt.

```bash
rundot generate image \
  --prompt "wide pixel-art forest village background, morning fog" \
  --aspect-ratio 16:9 \
  --out assets/bg-forest-village.png
```

Common dials:

- `--model` chooses a model. The default is `gemini-3.1-flash-image-preview`.
- `--negative-prompt` adds things to avoid.
- `--seed` helps reproduce a result.
- `--remove-background` runs background removal after generation. Tune it with `--remove-background-model birefnet`, `--remove-background-variant`, and `--remove-background-resolution`.
- `--image-size 1K|2K|4K` only works with `--model gemini-3-pro-image-preview`. Other models reject it. The Pro model uses Power image access when a game scope is present.

Discover models with:

```bash
rundot generate image-models
```

This lists models for your authenticated creator and the current environment's credentials. It does not pass a game ID, so it is not a guarantee that a specific game can call the same set. For unbilled game-scoped availability, use runtime [`listModels()`](api/IMAGE_GEN.md#discovering-available-models) from the game context. `rundot generate estimate image --game-id <id>` is pricing-only: it can quote a Power model that the game still cannot use.

## Reference images

Use `--reference-image` to steer composition or style. Repeat it up to 10 times.

```bash
rundot generate image \
  --prompt "same hero, victory pose, trading-card frame" \
  --reference-image ./assets/hero.png \
  --reference-image https://example.com/style-board.png \
  --model gemini-3-pro-image-preview \
  --out assets/hero-card.png
```

Accepted inputs:

- Local image files, max 10 MB each. The CLI inlines them into the request.
- `https://` URLs.
- `data:` URIs.
- Creator-storage file keys, but only with a game scope.

`http://` reference URLs are rejected. Use HTTPS.

## Edit existing images

`rundot image edit` applies a text instruction to one or more input images. It is CLI-only. There is no SDK method for image editing.

```bash
export RUNDOT_BETA_FEATURES=1
rundot image edit \
  --env prod \
  --input ./assets/hero.png \
  --prompt "same character, winter outfit, keep the pose" \
  --image-size 2K \
  --out ./assets/hero-winter.png
```

Current restrictions:

- Hidden unless `RUNDOT_BETA_FEATURES=1` is set.
- Prod only. Use `--env prod` or switch with `rundot set-env prod`.
- Requires interactive `rundot login`. `rk_` API-key sessions are rejected, even when you pass `--game-id`.
- Accepts up to 10 inputs. Local files are limited to 10 MB each and about 24 MB total after base64 encoding.
- `--image-size` accepts `1K` or `2K`. There is no 4K edit mode.
- `image edit` uses a Power image-edit model. With `--game-id`, the game owner's access still has to allow that class.
- Local files and HTTPS inputs work without a game. Creator-storage file keys need `--game-id` or a local game config.
- Existing outputs are not overwritten unless you pass `--force` or confirm interactively.

If you omit `--out`, local input `hero.png` writes `hero_edit.png`. URL inputs write `output_edit.png`.

## Related transforms

These commands also download local files. They are prod-only and require interactive login, but `depth`, `remove-bg`, and `upscale` are visible in normal help.

```bash
rundot image depth --env prod --input ./scene.png --steps 20 --out ./scene_depth.png
rundot image remove-bg --env prod --input ./item.png --model birefnet --variant heavy --out ./item_nobg.png
rundot image upscale --env prod --input ./portrait.png --scale 4 --model high-fidelity-v2 --out ./portrait_4x.png
```

`rundot image turnaround` is beta-hidden like `image edit`:

```bash
export RUNDOT_BETA_FEATURES=1
rundot image turnaround --env prod --input ./hero.png --horizontal-angle 90 --out ./hero_right.png
```

## Estimate before you generate

Use estimates instead of copying price tables into scripts or docs.

```bash
rundot generate estimate image --model gemini-3-pro-image-preview --image-size 4K
rundot generate estimate image --model gemini-3.1-flash-image-preview --remove-background --remove-background-model birefnet
rundot generate estimate image --game-id <game-id> --model gpt-image-2.5-flare --json
```

The estimate comes from the same `/v1/credits/estimate` endpoint the platform uses for current pricing. It is exact when RUN controls the final charge. Use `--json` when a script needs the number.

Estimates do not check model availability or generation policy. With `--game-id`, the quote uses that game's owner/platform billing and markup rules, but a later generation with the same flags can still be rejected by the game owner's model gates or provider availability.

Billing follows the scope:

- Game-scoped generation bills the game's owner.
- Gameless generation bills the signed-in creator.
- Platform-owned or platform-funded calls may omit a visible `credits` block because no creator wallet was charged.

For in-game calls, read [credits on the runtime API](api/IMAGE_GEN.md#returned-fields) and [Credits](api/CREDITS.md).
