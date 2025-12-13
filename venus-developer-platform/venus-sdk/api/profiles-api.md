# Profiles API

## Profiles API

Sync access to the active player's identity so you can personalize UI on first paint, gate features, or tag analytics without extra calls.

### Quick Start

```ts
import VenusAPI from '@series-inc/venus-sdk/api'

await VenusAPI.initializeAsync()

const profile = VenusAPI.getProfile()
console.log(profile.id, profile.username)
```

`getProfile()` throws if it's called before `await VenusAPI.initializeAsync()`. After initialization it always returns the cached snapshot from the host handshake.

### Fields

| Field         | Type             | Notes                                             |
| ------------- | ---------------- | ------------------------------------------------- |
| `id`          | `string`         | Stable player identifier; safe as a primary key.  |
| `username`    | `string`         | Display handle for leaderboards or invites.       |
| `avatarUrl`   | `string \| null` | HTTPS avatar URL. `null` if the player has none.  |
| `isAnonymous` | `boolean`        | `true` when the player is in guest/unsigned mode. |

### Usage Ideas

* Bootstrap HUD/nameplates with `profile.username` before gameplay starts.
* Attach `profile.id` to analytics, matchmaking, or social payloads for attribution.
* Require login by checking `profile.isAnonymous` before premium flows or social invites.
