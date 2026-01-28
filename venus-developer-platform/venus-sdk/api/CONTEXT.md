# Context API

Access data about the context in which your game is currently running. Determine how your game shoul act depending on what data is is being given.

Here are some examples for what you might use it for:

* Load a custom runtime configuration to choose how you want your game to load
* Interpret share link data to define gameplay elements

## Quick Start

```typescript
import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

const launchParams = await RundotGameAPI.context.launchParams
const shareParams = await RundotGameAPI.context.shareParams

console.log('Launch parameters:', launchParams)
console.log('Share parameters:', shareParams)
```

## Payload Guidelines

* Keep `shareParams` under \~100 KB (share payloads are stored in Firestore with 1 MB document caps).
* Keep your runtime configuration under \~100 KB for the same reason.
* Use compact identifiers (IDs, short strings) and fetch bulky data from your backend.

## Best Practices

* Inspect `RundotGameAPI.context.launchParams` on boot to determine how you want your game to load early on.
* Inspect `RundotGameAPI.context.shareParams` on boot and branch gameplay early. Players expect to land in the invited context immediately.
