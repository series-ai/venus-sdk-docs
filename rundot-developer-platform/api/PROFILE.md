#  Profile API

Sync access to the active player's identity so you can personalize UI on first paint, gate features, or tag analytics without extra calls.

## Quick Start

```ts
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const profile = RundotGameAPI.getProfile()
console.log(profile.id, profile.username)
```

`getProfile()` returns the cached snapshot from the host handshake (the SDK initializes automatically on import).

## Fields

| Field        | Type             | Notes                                             |
|--------------|------------------|---------------------------------------------------|
| `id`         | `string`         | Stable player identifier; safe as a primary key.  |
| `username`   | `string`         | Display handle for leaderboards or invites.       |
| `avatarUrl`  | `string \| null` | HTTPS avatar URL. `null` if the player has none.  |
| `isAnonymous`| `boolean`        | `true` when the player is in guest/unsigned mode. |

## Usage Ideas

- Bootstrap HUD/nameplates with `profile.username` before gameplay starts.
- Attach `profile.id` to analytics, matchmaking, or social payloads for attribution.
- Require login by checking `profile.isAnonymous` before premium flows or social invites.

