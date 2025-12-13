# Troubleshooting

## SDK not initialized

If you're asked to properly initialize the SDK, then ensure that this code is placed in your main file, somewhere at the beginning.

```shellscript
import VenusAPI from "@series-inc/venus-sdk/api"
await VenusAPI.initializeAsync()
```

## SDK timeout

Ensure that the SDK is correctly installed.

* check the contents of the `package.json` file in your project folder.&#x20;
* under `"dependencies"`, the SDK entry should read something like this:

```json
  "dependencies": {
    "@series-inc/venus-sdk": "^2.6.2", //min required SDK version is 2.6.2
```

If it's not the min required version, then try updating the SDK by running `npm i @series-inc/venus-sdk@latest`.

## Ads do not work in my game

When playing on desktop, we currently do not show ads. We'll offer them later for developers who want a simple way to monetize their games.

If you're using a VPN, the ads won't be able to load.

