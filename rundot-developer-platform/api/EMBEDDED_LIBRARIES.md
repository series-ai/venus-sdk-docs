# Embedded Libraries

Reduce your game's bundle size by using  embedded libraries. Supported libraries are automatically loaded from the  host instead of being bundled into your game.

## Benefits

- **Smaller bundle size**: ~1.1MB savings for Phaser games
- **Faster load times**: Libraries are cached and pre-loaded
- **No code changes**: Works with your existing imports

## Quick Start

### 1. Add the Vite Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite';

export default defineConfig({
  plugins: [rundotGameLibrariesPlugin()],
  build: { target: 'es2022' } // Required for top-level await
});
```

### 2. Use Libraries Normally

```typescript
// Import as usual - the plugin handles the rest
import Phaser from 'phaser';
import { create } from 'zustand';
import * as THREE from 'three';
import React from 'react';
import { Story, Compiler } from 'inkjs/full';
```

### 3. Build

```bash
# For  deployment (embedded libraries)
npm run build

# For standalone deployment (bundled libraries)
RUNDOT_GAME_DISABLE_EMBEDDED_LIBS=true npm run build
```

## Supported Libraries

| Library | Version(s) | Supported Imports |
|---------|------------|-------------------|
| Phaser | 3.90.0 | `phaser` |
| React | 18.3.1, 19.2.4 | `react`, `react/jsx-runtime` |
| ReactDOM | 18.3.1, 19.2.4 | `react-dom`, `react-dom/client` |
| Three.js | 0.170.0, 0.183.2 | `three` |
| Matter.js | 0.19.0 | `matter-js` |
| Ink.js | 2.2.0, 2.3.2 | `inkjs`, `inkjs/full` |
| Zustand | 5.0.3 | `zustand`, `zustand/middleware` |

> **Version matching**: The plugin only externalizes a library when your installed version **exactly matches** one of the supported versions above. If your version differs, the library is bundled normally — no code changes needed.

### Ink.js Usage

Ink.js supports both runtime-only and full (with compiler) imports:

```typescript
// Runtime only - for running pre-compiled ink JSON
import { Story } from 'inkjs';

// Full - includes Compiler for runtime ink compilation
import { Story, Compiler } from 'inkjs/full';
```

## Troubleshooting

### Build without embedded libraries

If you want to bundle all libraries into your game, you can set the `RUNDOT_DISABLE_EMBEDDED_LIBS` environment variable to `true`.

```bash
RUNDOT_GAME_DISABLE_EMBEDDED_LIBS=true npm run build
```

This bundles all libraries (larger size, but guaranteed to work).

### Need a different library version?

Pin the exact supported version in your `package.json`. If you need a version that isn't listed above, the library will be bundled into your game automatically.

To request a new library or version for the embedded system, contact the team.
