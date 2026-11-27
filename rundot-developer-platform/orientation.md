---
icon: mobile-screen
---

# Screen Orientation

Every game version declares one orientation: `portrait`, `landscape`, or `both`. RUN.world reads it from the version record, never from your game's code. A version deployed without a declared orientation is recorded as `portrait`.

## What the host does with it

| Declared | RUN app (iOS and Android) | Phone browser | Desktop browser |
| --- | --- | --- | --- |
| `portrait` | Locks the screen upright. | Nothing. | Nothing. |
| `landscape` | Locks the screen sideways, even with the phone's auto-rotate turned off. | Shows a "Rotate your device" prompt over the game while the phone is upright, with a "Play anyway" escape. | Nothing. |
| `both` | Releases the lock, so the screen follows the phone. Auto-rotate must be on to turn sideways. | Nothing. | Nothing. |

The RUN app's lock wins over anything your game does. A landscape game declared as `portrait` is held upright in the app, and the player cannot rotate it, whatever their auto-rotate setting is.

## Declaring orientation

Set it once in your game config; every later `rundot deploy` sends it:

```bash
rundot game set-orientation landscape   # or portrait, or both
```

This writes `"orientation"` into `game.config.<env>.json`:

```json
{
  "gameId": "your-game-id",
  "relativePathToDistFolder": "./dist",
  "orientation": "landscape"
}
```

A deploy flag overrides the config and saves the new value back to it:

```bash
rundot deploy --orientation landscape
```

The value applies from the next deploy. A version already published keeps the orientation it was deployed with, so redeploy after changing it.

Games built in RUN.world Studio work the same way: the Studio agent records the orientation with `rundot game set-orientation`, and Studio's publish sends it with each version.

## Do not draw your own rotate prompt

Don't ship a "rotate your device" overlay that blocks play while the screen is upright. On the RUN app it would show only when the game is declared `portrait`, and that is exactly the case where the host holds the screen upright, so the player is stuck behind it. Declare `landscape` instead, and the host rotates the screen in the app and shows its own prompt in phone browsers.

Calling `screen.orientation.lock()` or `Element.requestFullscreen()` from the game is not a workaround either. The game runs in an iframe, and the host owns orientation and [fullscreen](api/SYSTEM.md#fullscreen-and-pointer-input-asynchronous).

## Laying out for orientation

- Size your game to the viewport the host gives you and the [Safe Area](api/SAFE_AREA.md). In landscape the RUN toolbar moves to the sides of the screen.
- For `both`, re-layout on `RundotGameAPI.lifecycles.onDeviceChanged` and `onSafeAreaChanged` (see [Lifecycles](api/LIFECYCLES.md)) instead of reading the size once on load.
- `RundotGameAPI.system.getDevice().orientation` reports the current shape of the screen, not the declared orientation.
