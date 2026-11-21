---
icon: terminal
---

# rundot CLI Reference

`rundot` is the command-line tool for shipping and operating a RUN.world title:
deploy builds, generate game assets and 3D models, inspect and repair live player
data, moderate leaderboards, and run growth (paid ads, organic launch packets,
competitive intel). This page is a workflow-oriented tour of the whole CLI. For
the exhaustive flag list on any command, append `--help`:

```bash
rundot <command> --help
rundot game update-release --help
```

Three areas have their own deep-dive pages, cross-linked below:
[Deploying Your Game](deploying-your-game.md),
[Design-time image generation](design-time-image-generation.md), and
[Marketing Your Game](marketing-your-game.md).

## Install & update

```bash
# macOS / Linux
curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash

# Windows (PowerShell)
irm https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.ps1 | iex

rundot update          # update to the latest stable release
rundot update --beta   # switch to the beta channel
rundot update --stable # switch back to stable
```

## Beta-gated commands

Most commands are generally available. A few groups are **hidden** from `--help`
until you opt into beta features for the shell session:

```bash
export RUNDOT_BETA_FEATURES=1
```

Beta-gated groups: `stats` and `collectibles`. The `marketing` group is generally available for Meta Android campaigns; non-Meta networks (`google`, `reddit`, `run`, `unity`) and non-Android platforms (`ios`, `web`) remain beta-gated.
Within `rundot image`, only `image edit` and `image turnaround` are beta-hidden.
`image depth`, `image remove-bg`, and `image upscale` are visible in normal help.
All `rundot image` commands run **prod-only** and require interactive
`rundot login`; they reject `rk_` API-key sessions.

`generate`, `storage`, `files`, `leaderboard`, `intel`, `jam`, `credits`, and the
3D pipeline under `game` are **not** gated.

## Quick reference

| Command | What it does |
|---|---|
| `rundot login` | Authenticate (browser, `--api-key`, or `--refresh-token`) |
| `rundot whoami` | Print who the current session is signed in as |
| `rundot init` | Start a game from a template, or register an existing project; writes `game.config.prod.json` |
| `rundot create` | Create a new game; the same command as `init` |
| `rundot import` | Register an existing project and wire the SDK into a recognized Vite or npm web app |
| `rundot playground …` | Mint or revoke the playground key for local headless dev |
| `rundot quests` | Show your active creator quests and their next steps |
| `rundot deploy` | Ship a new version |
| `rundot predeploy` | Run the deploy checks on your source and build without deploying |
| `rundot pack …` | Retired: native pack builds are no longer available, and each command returns an error (see [Native pack commands (retired)](#native-pack-commands-retired)) |
| `rundot list-games` | List your games |
| `rundot game …` | Metadata, versions, releases, editors, API keys, 3D |
| `rundot generate …` | Images, audio, video, TTS, text completions |
| `rundot image …` | Post-process images (remove-bg, upscale, depth; edit and turnaround are beta) |
| `rundot assets …` | List and remove your generated assets, or make a lighter local copy of an image or sound |
| `rundot textGen init` | Create the game's textGen spend config with the default caps |
| `rundot skills …` | Install and update RUN's AI skills in your coding agent |
| `rundot ai …` | Set up all RUN skills at once, or ask for structured decisions |
| `rundot module …` | Find, install, and manage vetted game modules |
| `rundot coach check-in` | Record that a coaching session happened |
| `rundot storage …` | Read/write player key-value storage (debug/admin) |
| `rundot files …` | Read/write player file storage (debug/admin) |
| `rundot leaderboard …` | Inspect scores, moderate, shadow-ban |
| `rundot rooms …` | List, inspect and close your game's live multiplayer rooms, read their logs, see their health by day, and download or delete their stored state and database |
| `rundot stats …` | Player stats (beta) |
| `rundot collectibles …` | Collectible grants (beta) |
| `rundot ugc …` | User-generated content |
| `rundot marketing …` | Paid ad campaigns (Meta Android GA; others beta) — see [Marketing Your Game](marketing-your-game.md) |
| `rundot socials …` | Organic launch packets — see [Marketing Your Game](marketing-your-game.md#share-an-update-launch-packet) |
| `rundot intel …` | Competitive market intelligence (credit-priced) |
| `rundot jam …` | Scaffold jam kits, get promo links |
| `rundot credits` | Credit balance and usage breakdown |
| `rundot profile search` | Find creator profiles by username |
| `rundot migrate-config` | Migrate legacy config into the visible `rundot/` folder |

---

## Auth & setup

```bash
rundot login                        # browser-based (default)
rundot login --api-key rk_…         # per-game key, for CI/CD
rundot whoami                       # email and user ID; for an rk_ or pk_ key, also the key type and game ID
```

`init` registers a game and writes `game.config.prod.json` (game ID + build
path), which every later command reads when you omit `--game-id`.

Start a new game from a template:

```bash
rundot init --template 2d-pixi my-game   # download into ./my-game, register, write config
rundot init --template 2d-pixi           # same, into the current (empty) directory
rundot init                              # in an empty directory: pick a template from the list
```

Templates: `2d-pixi` (2D Starter Kit: Pixi.js v8 + React + Tailwind), `3d-react`
(3D Starter Kit: Three.js), `csn-runner` (Endless Runner), `csn-launcher`
(Launcher), `tower-defense` (Tower Defense). The target directory must be empty,
or not exist yet when you name it. Non-interactive runs (CI, coding agents)
need `--name`, and with no `--template` they print the template IDs and exit 1
instead of prompting.

In a directory that already has a project, `init` registers that project:

```bash
rundot init \
  --name "Bricktide" \
  --description "Auto-sweep tower defense" \
  --build-path ./dist \
  --keywords "tower-defense,idle,auto,strategy"
```

`rundot create` and `rundot game create` run the same command as `init`.

`import` registers the existing project in the directory you name. When the
project is a recognized Vite or npm web app, it also wires in the SDK:

```bash
rundot import ./my-game --yes
rundot import ./my-game --name "Glacier Run" --yes
```

More setup commands:

```bash
rundot quests                     # your active creator quests and their next steps (--json)
rundot textGen init               # create the textGen config in rundot/ (or .rundot/) with the default spend caps
rundot playground grant-access    # write a playground key to .env.local for local headless dev
rundot playground revoke-access   # revoke that key and remove its line
rundot coach check-in             # record that a coaching session happened; sends no chat or profile content
```

See [Testing Locally With Playground](playground.md) for the playground key.

Per-game `rk_` deploy keys for headless CI are managed under
[`game api-keys`](deploying-your-game.md#cicd-authentication). Key management
requires an interactive owner login — it's blocked when you're authenticated with
an `rk_` key.

```bash
rundot game api-keys create --label "GitHub Actions" --expires-in-days 90   # prints the secret once
rundot game api-keys list
rundot game api-keys regenerate --key-id <key-id>                           # revoke and issue a replacement
rundot game api-keys revoke --key-id <key-id>
```

### Coding-agent skills and modules

`skills` installs RUN's AI skills into your coding agent, such as Claude, Cursor,
or Codex. `ai setup` detects your agent and installs every skill in one step.
Skills install offline and need no login.

```bash
rundot ai setup                     # detect your coding agent and install all RUN skills
rundot skills list                  # available skills and their install state
rundot skills install               # install all skills, or name one; --agent and --scope project|user
rundot skills update                # re-install over installed skills; edited files are kept unless you approve or pass --force
rundot skills uninstall             # remove installed skills; keeps your edits unless --force
rundot ai decide --state-file state.json --questions-file questions.json   # structured decisions against state or screenshot data
```

`module` installs vetted game modules into `src/modules/`, with the modules
they depend on, and records them in `modules.lock.json`.

```bash
rundot module list                                    # modules in the catalog (--category)
rundot module search inventory --render-mode 2d       # by keyword, --category, --tag, or --render-mode
rundot module show two-d/sprite-animation             # details and files for one module
rundot module recommend "turn-based deck builder"     # modules that fit a plain-language game description
rundot module add two-d/sprite-animation audio/audio-manager   # --dry-run to preview
rundot module verify                                  # check installed modules are wired into game code
rundot module remove audio/audio-manager              # refused while another installed module needs it (--force)
rundot module eject two-d/sprite-animation            # mark a module forked so you can change it
rundot module complete                                # finish a pending two-phase install
rundot module rollback                                # undo a pending two-phase install
```

Game Studio installs modules in two phases. `complete` and `rollback` finish or
undo that kind of install; a plain `module add` doesn't leave one pending. To
write module files without running the package manager, pass
`module add --skip-package-install`; then run the install command it prints.

---

## Shipping a game

See [Deploying Your Game](deploying-your-game.md) for the full deploy, publish,
versioning, and release-notes workflow. The essentials:

```bash
rundot deploy                 # private link to share; bumps minor by default
rundot deploy --bump patch    # hotfix
rundot deploy --public        # publish: public, visible on Explore
rundot deploy --close-rooms   # multiplayer: also close rooms still on the previous server bundle
```

Version bump is `minor` by default (`major` / `minor` / `patch`).

### Deploy checks: `predeploy` {#deploy-checks}

`predeploy` runs the deterministic checks on your game source and build output
without deploying. `deploy` runs build checks too; `--no-preflight` skips them.

```bash
rundot predeploy                      # every check; --phase source|dist|all
rundot predeploy --fix                # apply safe fixes, such as moving assets or patching code
rundot predeploy fix [rule-id]        # apply the safe fixes for one rule, or all of them
rundot predeploy ignore <rule-id>     # record a rule exception in predeploy.config.json
rundot predeploy --json
```

`preflight`, `game predeploy`, and `game preflight` are aliases of `predeploy`,
with the same `fix` and `ignore` subcommands.

### Multiplayer rooms — `rooms` {#multiplayer-rooms}

Rooms already running keep the server bundle they started on. After a deploy that changes your server code, `rundot deploy` says how many rooms are still on the older bundle; close them so the next join lands on the new one.

```bash
rundot rooms list                       # live rooms: type, code or persistent key, players, bundle, age, idle time
rundot rooms list --watch               # refresh every 5s (--interval <seconds>, at least 2) until Ctrl+C

rundot rooms close --outdated           # rooms on an older bundle than their tag now points at
rundot rooms close --all                # every live room
rundot rooms close --type <roomType>    # every room of one type
rundot rooms close --room <code>        # one room, by its join code
rundot rooms close --type <roomType> --key <persistentKey>   # one persistent room

rundot rooms close --outdated --grace 60   # give the game a 60s countdown first (0–900)
rundot rooms close-status <close-id>
rundot rooms close-cancel <close-id>       # until the countdown ends

rundot rooms list --ended                  # rooms that ended in the last 3 days: why, and the last crash (--limit <rooms>, at most 200). A room that never started isn't listed; find it with `rooms logs --level error`
rundot rooms logs                          # the last hour of room logs, oldest first
rundot rooms logs --since 15m --level warn # only warnings and errors
rundot rooms logs --room ABCDEF --since 2h # one room, by its join code or room id
rundot rooms logs --type lobby --json      # one room type, as JSON
rundot rooms logs --env playground         # room logs from Playground instead of live

rundot rooms inspect ABCDEF                # one live room now: CPU, players and their seats, idle timer, last save, heap
rundot rooms inspect --type world --key guild-7   # one persistent room
rundot rooms stats                         # per day: starts, crashes, CPU throttles and closes, cap refusals (--days <1-30>, default 7)

rundot rooms save --type world --key guild-7     # save one persistent room's state now, and say whether it landed
rundot rooms kill --type world --key guild-7     # end one room now, even if its save fails (confirms first; --yes in scripts)
rundot rooms kick ABCDEF --player alice          # remove one player (id, or a username only one player has); confirms first
rundot rooms kick ABCDEF --player p_123 --block --reason "Cheating"   # and refuse their joins until the room ends
rundot rooms lock ABCDEF                         # refuse new joins; players already in stay
rundot rooms unlock ABCDEF                       # lift that lock

rundot rooms state list                          # stored persistent and singleton state: key or version, last save, live, stale
rundot rooms state get --type world --key guild-7 -o world.json   # download one world as JSON (--version <bundleVersion> for a singleton)
rundot rooms state delete --type world --key guild-7              # delete one world's state; the next join starts empty
rundot rooms state delete --type lobby --stale                    # delete singleton versions no tag serves

rundot rooms db usage                            # database size and key count against the quota
rundot rooms db list --prefix guild:             # keys with version, size and last update
rundot rooms db get guild:7                      # one entry as JSON
rundot rooms db get --all -o db.ndjson           # export every key, one entry per line (--prefix <p> for some)
rundot rooms db delete --prefix season-3:        # delete keys (or name up to 100 keys, or --all)
```

- `kill` is for a persistent room that won't close: a close keeps a room running when its save fails or its code doesn't hand over its state. Kill tries the save, then ends the room either way, and it reopens from its last save that landed. Players hear `'lost'`. For any other room, `close --room <code>` is gentler.
- `kick` removes one player, connected or away. Your room code hears `onPlayerLeave(playerId, 'kick')`, as for its own `kick()`; the player's client gets the `--reason` text (at most 200 characters) in `onError`, then `onReconnecting`, then `onEnded({ reason: 'lost' })`. They can join again unless you pass `--block`, which refuses their joins with `KICKED` until the room ends; a persistent or singleton room hosted again lets them back in. An id that isn't in the room is sent anyway (they may be joining); a username two players share is refused. See [Creator kicks and locks](api/ADVANCED-MULTIPLAYER.md#creator-kicks-and-locks).
- `lock` refuses new joins with `ROOM_LOCKED`, the code your room code's own `lock()` gives, until `unlock` or the room ends. Your room code isn't told and can't lift it, and `unlock` never lifts your room code's lock: if both are set, joins stay refused and `unlock` says so. `inspect` shows both locks and the blocked players. Neither command prompts.

- `close` previews the rooms and players it hits, then asks to confirm; pass `--yes` in scripts and CI. It waits for the result unless `--no-wait`.
- Players are told their room ended (see [Room closes](api/ADVANCED-MULTIPLAYER.md#room-closes)). Persistent rooms save first and come back with their world on the next join; standard and match rooms come back empty.
- A room's bundle shows as `outdated` when its tag points at a newer bundle, and `unknown` when the room recorded no tag; `--outdated` never closes unknown rooms.
- `rundot deploy` never asks about rooms. `--close-rooms` closes the outdated ones without prompting, and a failed close only warns, so the deploy still succeeds.
- `logs` shows your rooms' `console.*` and `this.log` lines, errors your room code throws or logs with their stack, and a line when a room starts, crashes, recovers, is throttled for CPU, and ends, with why. It reads one page (100 lines, `--limit` up to 200); when there's more, it prints the command for the next page. `--since` and `--until` take a duration back from now (`15m`, `2h`, `3d`) or an ISO time. Each room can log 50 lines per 10 seconds; a line counts any it dropped. Lines are kept 30 days.
- A stack frame shows your source file, line and column (`at Lobby.onMessage (src/rooms/Lobby.ts:42:7)`) when the deployed build has a source map, which the multiplayer plugin of the latest SDK writes to `dist/server-bundle.js.map`. Builds without one show the bundle's line and column. The map is uploaded with your server bundle and is never published.
- `inspect` reads the room's details from the server hosting it. If that server doesn't answer within 3 seconds, the rest still prints, with the reason. The heap is sampled every 5 minutes, so a new room shows "not sampled yet".
- `stats` counts are best-effort, and start from when the platform began counting. They also show your game's CPU now on each server.
- CPU limits: each room has a budget of 50% of one CPU core. A room over it for 30 seconds is throttled, and one still over it after 2 minutes is closed. All your game's rooms on one server share a cap of 100%; at the cap, that server refuses new rooms of your game, and rooms already running carry on.
- `state get` decodes the stored state, whatever its encoding. If the room is live, the copy is only as fresh as its last save: run `rooms save` first. See [Backing up and resetting a world](api/ADVANCED-MULTIPLAYER.md#backing-up-and-resetting-a-world).
- `state delete` refuses a live room and names the `rooms kill` to run first. Kill then delete only resets a world nobody rejoins in between: if your game rejoins its persistent key after `'lost'`, the room comes back and the delete is refused again, so take players out first. Deleting state that's already gone says "nothing stored" and succeeds.
- `state delete --stale` keeps any version a tag (or Playground) still serves, and any whose room is live, and lists what it deleted and skipped.
- `db get --prefix|--all` needs `-o`; Ctrl+C keeps the lines written so far. An export is a series of reads, not a snapshot. `db delete` shows how many keys match before asking; deletes are unconditional, so a room writing a key at the same time can recreate it. A big delete stops after 30 minutes and says how many keys are left; run it again.
- Every delete confirms first; pass `--yes` in scripts (`--json` needs `--yes`).
- Needs an owner or editor login for the game, or the game's `rk_` key.

### Releases: managing live vs. dev builds

Releases point a named label (e.g. `prod`, `staging`) at a specific version, so you
can promote builds without redeploying:

```bash
rundot game list-versions
rundot game list-releases
rundot game update-release prod --version 1.4.0
rundot game copy-release staging prod        # promote staging → prod in one shot
rundot game delete-release staging
```

You can also pin a server or runtime config to a release:

```bash
rundot game update-release prod --version 1.4.0 \
  --server-config-id <id> --runtime-config-id <id>
rundot game list-server-configs
rundot game upload-server-config
```

Metadata, visibility, editors, and keywords all live under `game` —
`rundot game --help`. **Always set keywords** (see
[Deploying Your Game](deploying-your-game.md#game-set-keywords)).

| Command | What it does |
|---|---|
| `game info` | Print detailed information about your game |
| `game configure` | Write the local game config (game ID, build path); prompts for missing values |
| `game set-name "<name>"` | Rename the game |
| `game set-description "<text>"` | Change the game's description |
| `game set-keywords "cozy,puzzle"` | Set the game's keywords |
| `game delete-keyword <keyword>` | Remove one keyword |
| `game set-orientation landscape` | Set `portrait`, `landscape`, or `both` in the local config; applies on the next deploy |
| `game set-platform-fit mobile` | Declare `mobile`, `desktop`, or `both`; a mismatched device isn't offered the game while browsing, but direct links still work |
| `game set-public` / `game set-private` | Show the game on Explore, or hide it there (its private link still plays) |
| `game upload-build` | Upload a build and create a new version |
| `game list-runtime-configs` | List the game's runtime configs |
| `game list-editors` | List the game's editors |
| `game add-editors "<emails>"` / `game remove-editors "<emails>"` | Add or remove editors; pass the emails as one quoted list, separated by spaces |

### LiveOps config — `liveops`

Change live values in a deployed game without a full redeploy: push just the
LiveOps config from `rundot/liveops.config.json`, inspect version history, and
roll back. LiveOps push does a **scoped** read-modify-write — it fetches the
target release's current server config, replaces only the `liveops` key, uploads a
new immutable snapshot, and repoints the release; sibling config (leaderboard, shop,
simulation, …) is left byte-for-byte unchanged. See the
[LiveOps Config API](api/LIVEOPS.md) for the file format, resolution semantics,
and how games read the values at runtime.

```bash
rundot liveops push                           # validate the local file, then push to the private release
rundot liveops push --release review --message "summer event"
rundot liveops history                         # list snapshots newest-first with release markers
rundot liveops show                            # print the deployed liveops config + active override ids
rundot liveops diff                            # compare local file to the deployed release (scriptable exit code)
rundot liveops rollback --to-server-id <id>    # restore an older snapshot's liveops onto the current config
```

- **`push [--game-id <id>] [--release private|review] [--message <text>]`** — validates
  `rundot/liveops.config.json` locally first (exits non-zero with a path-precise
  error on failure, making zero network calls), then performs the scoped
  read-modify-write. Default release: `private`. `--release public` is **rejected** —
  LiveOps reaches `public` via the normal review→public promotion of the
  snapshot, not a direct push.
- **`history [--game-id <id>] [--limit <n>]`** — lists snapshots newest-first with
  id, createdAt, uploader, message, and which of `private`/`review`/`public` each
  snapshot is currently pointed to by. Default limit 20.
- **`show [--game-id <id>] [--release <r> | --server-id <id>]`** — prints the resolved
  snapshot's stored `liveops` config as pretty JSON, plus a line listing the
  override ids currently active by local (UTC) schedule evaluation. Default
  `--release private`. A snapshot with no LiveOps config prints `(no liveops config)`
  and exits 0.
- **`diff [--game-id <id>] [--release <r>]`** — compares the local
  `rundot/liveops.config.json` against the deployed release's `liveops` and prints
  added/removed/changed JSON paths. **Exits 0 when identical, 1 when different**,
  so it's safe to script in CI (`rundot liveops diff && echo "up to date"`).
- **`rollback --to-server-id <id> [--game-id <id>] [--release private|review] [--message <text>]`** —
  takes the `liveops` key from an older snapshot and re-applies it via the same
  scoped read-modify-write (a new snapshot + release repoint; it never repoints the
  release to the old snapshot wholesale). Same release restriction as push. Rolling back
  to a pre-LiveOps snapshot faithfully produces a new snapshot with the `liveops`
  key removed.

---

## Generating assets

For image-specific workflows, see [Design-time image generation](design-time-image-generation.md).

All `generate` commands accept `--game-id` and `--out`. Omit `--game-id` when
you are in a game directory — the CLI reads `gameId` from
`game.config.<active-env>.json` (the same file `init` writes; on prod that is
`game.config.prod.json`). If you omit `--out` a filename is derived from the
prompt. Every command writes a `<output>.json` sidecar with the generation ID,
prompt, and model, and supports `--json` for scripting.

### Reference inputs

Every flag that takes a reference image, clip, sound, or model accepts the
same four forms:

- A local file path. A bare file name in the working directory works, and
  `~/` expands to your home directory.
- An `https://` URL. `http://` is rejected; use `https://`.
- A `data:<type>;base64,<payload>` URI.
- A creator-storage file key, such as `character_sprites/hero_idle.png`. File
  keys need `--game-id`.

A value that starts with `./`, `../`, `/`, `~`, a drive letter, or contains `\`
must name an existing file. Otherwise the command stops and names the flag,
the index, and the path. The CLI reads the file's leading bytes to find its
type, so a `.png` that holds JPEG bytes is sent as `image/jpeg`.

Local files are sent inline while the whole request stays under 29 MB. A
larger file is uploaded to creator storage and sent as a file key, which needs
`--game-id`. Without a game, the command stops and tells you to pass
`--game-id` or an `https://` URL. A local `--model-url` file is always uploaded,
so it always needs `--game-id`.

| Command | Flags | Max size per value |
|---|---|---|
| `generate video` | `--start-image-url`, `--end-image-url`, `--image-reference` | 10 MB |
| `generate video` | `--video-reference` | 25 MB |
| `generate video` | `--audio-reference` | 10 MB |
| `generate image` | `--reference-image` | 10 MB |
| `image edit` | `--input` | 10 MB |
| `game generate-3d` | `--image-url`, `--back-image-url`, `--left-image-url`, `--right-image-url`, `--top-image-url`, `--bottom-image-url` | 10 MB |
| `generate sprite-character-animate` | `--source-url` | 5 MB |
| `generate animate-sprite` | `--source-url` | 5 MB |
| `game remesh-3d`, `game rig-3d` | `--model-url` (`.glb`) | 200 MB |

### Images (backgrounds, UI, concept art)

Preflight the credit charge without running a model:

```bash
rundot generate estimate image --model gemini-3-pro-image-preview --image-size 4K
rundot generate estimate text --model claude-sonnet-4-6 --messages-file ./messages.json --max-tokens 2000
```

The quote comes from the canonical `/v1/credits/estimate` server endpoint. It is
labeled exact when RUN controls the final charge; variable text generation shows
a low–high range, percentage variance, and the reason the final charge can
differ. Add `--json` for structured output.

```bash
rundot generate image \
  --prompt "medieval village, top-down, painterly, warm golden hour, cozy" \
  --aspect-ratio 16:9 \
  --out assets/bg-village.png

# Background removal on the result
rundot generate image --prompt "ornate wooden chest, game icon" \
  --remove-background --out assets/icon-chest.png

# Native alpha transparency (GPT Image models only)
rundot generate image --prompt "hand-painted stone tileset" \
  --model gpt-image-2.5-sunburst --background transparent \
  --out assets/tileset.png

# High-res (Pro model only) + reference images (up to 10)
rundot generate image --prompt "hero portrait, dramatic lighting" \
  --model gemini-3-pro-image-preview --image-size 2K \
  --reference-image ./assets/character.png \
  --out assets/hero.png
```

Default model is `gemini-3.1-flash-image-preview`. Available models include
`gemini-3.1-flash-lite-image`, and the Power image models
`gemini-3-pro-image-preview` (the only model supporting `--image-size`
`1K`/`2K`/`4K`), `gpt-image-2`, `gpt-image-2.5-flare`, and
`gpt-image-2.5-sunburst` (the GPT Image models supporting `--background`
`auto`/`transparent`/`opaque` and `--custom-param key=value`, alias `--provider-option`; wrap numeric/boolean values in JSON double quotes like `'key="001"'` to force a string).
Run `rundot generate image-models` to query models for
your authenticated creator.
It does not pass a game ID, so a game-scoped generation can still differ. Use
`rundot generate estimate image` for current pricing instead of copying fixed
prices.

Background removal models: `bria` (fast, default) or `birefnet` (high quality;
tune with `--remove-background-variant` and `--remove-background-resolution`).

`--reference-image` accepts local file paths, `https://` URLs, and `data:` URIs
with or without a `--game-id` (local files are encoded in memory and transiently
uploaded with the generation request). `http://` is rejected. Creator-storage
file keys require `--game-id`. Up to 10 reference images (max 10 MB per file)
may be supplied. Local files that push the request past 29 MB upload to
creator storage and need `--game-id` (see [Reference inputs](#reference-inputs)). See [Design-time image generation](design-time-image-generation.md#reference-images)
for the full workflow.

### Audio & speech

```bash
rundot generate sfx --description "heavy stone door slamming, dungeon reverb" --duration 2.5 --out sfx/door.mp3
rundot generate music --prompt "tense dungeon-crawler loop, minor key, seamless" --duration 60 --out music/dungeon.mp3

rundot generate list-voices                       # discover voice IDs
rundot generate tts --text "Welcome, commander." --voice-id <id> --stability 0.4 --out vo/welcome.mp3

# Design a reusable custom voice
rundot generate design-voice --description "A gruff dwarf blacksmith, low and gravelly"
rundot generate save-voice --generated-voice-id <temp-id> --voice-name "Blacksmith Gruff"
```

`sfx` duration is 0.5–30s (use `--description`, not the deprecated `--prompt`);
`music` is 3–300s. TTS `--stability` 0–1 (lower = more expressive), `--speed`
0.5–2.0, `--model` `eleven_v3` (default) or `eleven_multilingual_v2`.

### Video

```bash
rundot generate video-models                        # list available models and constraints
rundot generate video-models --json                 # machine-readable catalog

rundot generate video --prompt "tower-defense montage, cinematic wide shot" \
  --provider seedance-2.0 --duration 10 --aspect-ratio 16:9 --out promo.mp4

rundot generate video --prompt "camera slowly zooms toward the tower" \
  --mode image-to-video --start-image-url https://… --duration 5 --out intro.mp4

# Local reference clip; over the inline limit it uploads, so pass --game-id
rundot generate video --prompt "same moves, neon city" --mode reference-to-video \
  --video-reference ./clip.mp4 --game-id <game-id> --out remix.mp4
```

`--start-image-url`, `--end-image-url`, `--image-reference`, `--video-reference`,
and `--audio-reference` accept a local file, an `https://` URL, a `data:` URI,
or a file key (see [Reference inputs](#reference-inputs)).

Providers come from the platform's runtime registry, not a fixed list — new
models appear without an SDK or CLI release. Run `rundot generate video-models`
to query the live set (served by `GET /v1/videogen/models`).
Modes: `text-to-video` (default), `image-to-video` (requires `--start-image-url`),
`reference-to-video`. Resolution/aspect support varies by provider — see `--help`.
Video generation executes asynchronously via background jobs with up to a 35-minute completion
window, supporting long generations without HTTP gateway timeouts, and cleans up upstream if interrupted.

### Text / LLM completions

```bash
rundot generate text-models                        # list available models
rundot generate text \
  --model claude-sonnet-5.5 \
  --messages-file ./prompts/npc-dialog.json \
  --system "You are a gruff dwarf blacksmith NPC." \
  --temperature 0.8

# Structured JSON output
rundot generate text --model claude-sonnet-5.5 \
  --messages-file ./prompts/item.json \
  --response-format json_schema --schema-file ./schemas/item.json --strict-schema
```

The messages file is a JSON `AiMessage[]` array. `--system` takes a literal
string or `@path/to/file.txt`. Output goes to **stdout** (no `--out`); use
`--stream` for incremental SSE output. Completions are billed to the resolved
game.

### Sprites (deprecated)

The sprite commands still run, but each prints a deprecation notice and will
be removed in a future release.

```bash
rundot generate sprite --prompt "hero walk cycle" --reference-file hero.png
rundot generate character-workflows        # character animation workflow presets
rundot generate sprite-models              # sprite models and per-call credit pricing
rundot generate sprite-costs               # credit cost per sprite operation
rundot generate sprite-jobs --drain --download ./sprites   # fetch completed and failed sprite jobs
```

`generate animate-sprite` and `generate sprite-character-animate` are
deprecated the same way.

### Image utilities (prod-only) {#image-utilities-beta-prod-only}

Post-process an existing image. `--input` accepts a local path, an `https://`
URL, a `data:` URI, or a creator-storage key. File keys need a game scope.
`image edit --input` follows [Reference inputs](#reference-inputs), so
`http://` is rejected there. These commands require prod
and an interactive login, not an `rk_` API-key session. `image edit` and
`image turnaround` are beta-hidden; set `RUNDOT_BETA_FEATURES=1` to show and run
them.

```bash
rundot image remove-bg --env prod --input ./asset.png --model birefnet --variant heavy --out ./asset-nobg.png --force
rundot image upscale  --env prod --input ./character.png --scale 4 --model high-fidelity-v2 --face-enhancement --out ./4x.png
rundot image depth    --env prod --input ./scene.png --steps 20 --out ./scene_depth.png

export RUNDOT_BETA_FEATURES=1
rundot image edit --env prod --input ./hero.png --prompt "same character, winter outfit" --image-size 2K --out ./hero_winter.png
rundot image turnaround --env prod --input ./hero.png --horizontal-angle 90 --out ./hero_right.png
```

`upscale` models: `standard-v2` (default), `low-resolution-v2`, `cgi`,
`high-fidelity-v2`, `recovery-v2`; scale 1–4. `image edit` accepts up to 10
inputs and `--image-size` `1K` or `2K`. `turnaround` bills per-megapixel ×
`--num-images`. See [Design-time image generation](design-time-image-generation.md#related-transforms).

### 3D pipeline

Generate → remesh → rig → animate, all under `game`. Each step downloads a GLB
and refuses to overwrite without `--force`.

```bash
# Image-to-3D (default) or text-to-3D
rundot game generate-3d --image-url https://… --quality standard --out model.glb
rundot game generate-3d --mode text-to-3d --prompt "weathered medieval tower, low poly" --out tower.glb

# Multi-view for accuracy (Hunyuan)
rundot game generate-3d --image-url https://…/front.png \
  --back-image-url https://…/back.png --left-image-url https://…/left.png \
  --provider hunyuan3d-v3.1-pro --out character.glb --force

# Image views can be local files too
rundot game generate-3d --image-url ./front.png --back-image-url ./back.png --out character.glb

# Reduce poly count, then rig + animate.
# generate-3d and remesh-3d print `Model URL:` — prefer that URL.
# `cdn.run.game` and `*.h5-apps.getreel.com` also work.
rundot game remesh-3d --model-url https://…/model.glb --target-preset character --out remeshed.glb
rundot game rig-3d --model-url https://…/remeshed.glb --height 1.8 --out rigged.glb   # prints a Rig ID
# A local .glb uploads to creator storage first, so it needs --game-id
rundot game rig-3d --model-url ./remeshed.glb --game-id <game-id> --out rigged.glb
rundot game animate-3d --rig-id <rig-id> --animations "walk,run,idle,attack" --out-dir ./animations/ --force
```

Providers: `hunyuan3d-v3.1-pro` (default), `pixal3d`, `trellis-2`, `meshy` (Meshy 7.1, multi-view up to 4 images total), `tripo-v2.5`, `rodin-v2.5`.
Quality: `draft` / `standard` / `high`. Remesh presets: `character` (~5000 faces),
`prop` (~1000 faces), or an exact `--target-faces`.

The `generate-3d` image flags accept a local file, an `https://` URL, a `data:`
URI, or a file key (10 MB each). `remesh-3d` and `rig-3d` `--model-url` accept
an `https://` URL, a local `.glb`, or a file key. See
[Reference inputs](#reference-inputs).

### Generated assets: `assets`

`assets list` and `assets rm` work on one game's generated assets with
`--game-id`. Without it, they work on your gameless (creator-billed) assets.
`assets prepare` is offline and never changes the original file.

```bash
rundot assets list                                  # images, sprites, audio, 3D (--service, --status removed, --limit)
rundot assets rm <generation-id> --service imagegen # remove one and reclaim its storage quota
rundot assets prepare ./art/hero.png                # smaller PNG/JPEG with identical pixels, saved as hero.light.png
rundot assets prepare ./art/hero.png --mode resize --width 512 --pixel-art
rundot assets prepare ./sfx/hit.wav --mode audio    # WAV/AIFF to OGG; --non-looping for MP3
```

`--service` is one of `imagegen`, `spritegen`, `audiogen`, or `threedgen`.
The file you `prepare` must be inside the current project folder.

---

## Player data (debug & admin)

These commands read and mutate **live player data** — handle with care. Most
clear/reset operations are irreversible.

### Key-value storage

Every command takes `--scope` (`app` default, or `owner` — the bucket shared
across all games the creator owns).

```bash
rundot storage data <profile-id> --format json --save ./debug/player.json   # full bucket
rundot storage keys <profile-id>
rundot storage get  <profile-id> gold
rundot storage set  <profile-id> gold 5000        # value stored as a string
rundot storage remove <profile-id> gold           # not confirmation-gated
rundot storage clear <profile-id> --yes           # DESTRUCTIVE — wipes the bucket
rundot storage usage <profile-id>
```

For safe snapshot/restore (including reading a past state via Firestore
Point-In-Time Recovery), use `export` / `import`:

```bash
rundot storage export <profile-id> --as-of 2026-06-01T12:00:00Z --save ./snap.json
rundot storage export --username alice --save ./snap.json      # look up the player by username instead
rundot storage import <profile-id> --file ./snap.json --yes    # DESTRUCTIVE — replaces app bucket
```

`import` requires the app **owner** role, only accepts `app`-scope snapshots, and
refuses to cross games or environments. Snapshots contain player PII — keep them
gitignored. PITR reaches back ~1 hour (or up to 7 days where PITR is enabled).
**Do not use `import` to undo a player's data erasure.**

### File storage

```bash
rundot files list <profile-id>
rundot files get  <profile-id> <file-key>          # metadata + signed URL
rundot files usage [<profile-id>]                  # per-player, or app-wide if omitted
rundot files quota                                 # your creator storage quota
rundot files upload ./asset.png --key sprites/tower.png --visibility public
rundot files visibility sprites/tower.png public   # public | private
rundot files delete <profile-id> <file-key>        # DESTRUCTIVE (confirms)
rundot files clear  <profile-id> --yes             # DESTRUCTIVE (confirms)
```

Server-side media processing via `files transform <op>` (ops: `concat`, `trim`,
`thumbnail`, `audioTrim`, `fade`, `split`, `audioMix`, `copy`, `frameExtract`,
`upscale`):

```bash
rundot files transform trim -i video-key --start-ms 0 --end-ms 5000 -o trimmed-key
rundot files transform thumbnail -i video-key --at-ms 2000 --width 640 --height 360 -o thumb-key
```

### Leaderboards

Discover IDs, inspect scores, and moderate. Not beta-gated.

```bash
rundot leaderboard config                          # discover leaderboard IDs
rundot leaderboard scores <leaderboard-id> --limit 100
rundot leaderboard player <leaderboard-id> <profile-id>
rundot leaderboard stats  <leaderboard-id>

rundot leaderboard remove <leaderboard-id> <profile-id>   # remove one score (runs immediately)
rundot leaderboard reset  <leaderboard-id> --yes         # DESTRUCTIVE — wipe all scores (--confirm alias)

# Shadow bans (player still sees their own score; invisible to others)
rundot leaderboard ban <profile-id> --reason "score manipulation"
rundot leaderboard unban <profile-id>
rundot leaderboard shadowbanned
```

`reset` is interactive — it requires typing `RESET` to confirm, or `--confirm` in
non-interactive shells. `ban` applies across **all** leaderboard instances and
requires `--reason`.

### Stats and Collectibles (beta), UGC

```bash
rundot stats list <profile-id>
rundot stats get  <profile-id> <stat-id>
rundot stats set  <profile-id> <stat-id> 42        # admin override (parsed as a float)
rundot stats delete <profile-id> <stat-id>         # delete one stat record
rundot stats reset <profile-id> --confirm          # DESTRUCTIVE — type "yes" to confirm

rundot collectibles cards                          # deployed card catalog
rundot collectibles grants <profile-id>
rundot collectibles evaluate <profile-id>          # re-run rules against current stats
rundot collectibles revoke <profile-id> <rule-id>  # revoke grant + entitlement

rundot ugc list --mine
rundot ugc publish --content-type level --title "The Frozen Keep" --data-file ./level.json --tags "puzzle,ice" --public
rundot ugc update <entry-id> --set title="The Frozen Keep v2" --data-file ./level.json
rundot ugc members add <entry-id> --profile <profile-id>
```

More `ugc` commands:

```bash
rundot ugc get <entry-id>
rundot ugc delete <entry-id>                       # an entry you own; confirms first (--yes in scripts)
rundot ugc shared                                  # entries where you are a collaborator
rundot ugc cross-app-create --target-app-id <app-id> --content-type level --title "The Frozen Keep" --data-file ./level.json
rundot ugc members list <entry-id>                 # the owner and editors
rundot ugc members remove <entry-id> --profile <profile-id>   # as the owner, or to leave an entry shared with you

# Owner or editor of the game
rundot ugc admin browse
rundot ugc admin remove <entry-id>                 # confirms first (--yes in scripts)
rundot ugc admin reports
rundot ugc admin resolve <report-id> --action reviewed   # or dismissed
rundot ugc admin publish --author-id <user-id> --author-name "Level Bot" --content-type level --title "Starter Keep" --data-file ./level.json
rundot ugc admin update <entry-id> --set author=<profile-id> --set title="Starter Keep v2"
```

`ugc update --data` is a **shallow** (top-level) merge: keys you send replace
existing values, omitted top-level keys are preserved, and nested objects/arrays
are replaced wholesale (not deep-merged) — to patch a nested object, read the
entry first and send the full intended top-level value. (`stats config` reports
the deployed collectibles/stats config; the two share a config endpoint.)

---

## Growth

### Paid ads — `marketing`

Full lifecycle (prepare → generate → submit → track) in
[Marketing Your Game](marketing-your-game.md). Key points:

- **Meta Android is GA.** Meta Android campaigns require no beta flags or opt-ins. Non-Meta networks (`google`, `reddit`, `run`, `unity`) and non-Android platforms (`ios`, `web`) are beta features and require `RUNDOT_BETA_FEATURES=1`.
- **Budgets in credits.** All budgets are accepted and displayed in credits (1,000 credits = $1 USD; min budget 50,000 credits, max 25,000,000 credits).
- **Ad copy is campaign-level**, authored once in `campaign.json` (`headlines` /
  `primaryTexts`). Meta accepts 1–5 of each (headline ≤ 40 chars, primary text ≤
  125); Google requires exactly 5 of each, with headline ≤ 30 chars and
  description/`primaryText` ≤ 90 chars. The per-creative sidecars carry
  prompt/seed/refs only — there is **no `marketing copy` command**.
- **`submit` is irreversible** and campaign names are single-use. To revise, run
  `marketing cancel` and resubmit under a new `--name`.

| Command | What it does |
|---|---|
| `marketing prepare` | Scaffold a campaign folder with prompt templates |
| `marketing refs` | Assemble a labeled reference-image palette for a campaign |
| `marketing generate` | Generate the campaign's assets from its prompts |
| `marketing composite` | Overlay a logo or image onto a generated asset |
| `marketing tips` | Print the creative best-practices guide |
| `marketing preview` | Open a local browser preview of the campaign's creatives and copy |
| `marketing submit` | Validate the campaign and submit it for review |
| `marketing list` | List your campaigns with their acquisition metrics |
| `marketing status` | Show flight status, budgets, and Meta campaign IDs |
| `marketing stats` | Show spend, installs or RUN first sessions, CTR, CPA, ROAS, and D1 |
| `marketing budget` | Change a flighted campaign's lifetime budget |
| `marketing extend` | Add days to a flighted campaign; the same total budget is paced longer |
| `marketing pause` / `marketing resume` | Pause a flighted campaign, or resume a paused one |
| `marketing cancel` | Cancel a campaign permanently |

### Organic launch packets — `socials`

Platform-ready posts (X, Reddit, TikTok, Instagram, Discord) with tracked links
when you ship an update — see
[Share an update](marketing-your-game.md#share-an-update-launch-packet).

```bash
rundot socials profile set --discord-webhook <url>   # one-time, per-creator (enables Discord auto-post)
rundot socials prepare           # drafts + tracked links (auto-posts Discord if configured)
rundot socials next              # walk the checklist one platform at a time
rundot socials open x            # caption + prefilled composer URL
rundot socials promo --platform x --model gpt-image-2   # grounded promo with a model override
rundot socials mark-posted x --url https://x.com/you/status/123
rundot socials verify            # which steps are posted AND clicked by someone other than you
rundot socials status            # the posting checklist for the latest packet
rundot socials profile show      # your current social profile
```

### Competitive intel — `intel`

Market intelligence for paid creators, priced in RUN.world credits. Free actions
are rate-limited; paid actions never charge without an explicit flag.

```bash
rundot intel search "Slay the Spire"          # free
rundot intel snapshot 553834731               # free headline metrics
rundot intel dossier "Slay the Spire"         # free within your weekly allowance
rundot intel dossier "Slay the Spire" --confirm-spend   # authorize the overage
rundot intel dossier "Slay the Spire" --generate        # build one that doesn't exist yet
rundot intel dossier list --limit 20           # existing dossiers you can download
rundot intel whats-hot                         # global market digest
rundot intel balance                           # credits + free dossiers left this week
rundot intel subscribe                         # weekly What's Hot email (free); --off to unsubscribe
```

Without `--confirm-spend` an overage prints the cost and exits non-zero; without
`--generate` a missing dossier prints the generation cost and exits non-zero.
Every subcommand supports `--json`.

### Jam kits — `jam`

```bash
rundot jam init <kit-name> ./my-project        # scaffold from a jam kit (kit list fetched at runtime)
rundot jam init <kit-name> . --force           # into the current dir, overwriting files already there
rundot jam promo                               # shareable vote/play links + social share URLs
```

`jam init` needs `rundot login`. With no directory it scaffolds into
`./<kit-name>`. It prints the next steps (`cd`, `npm install`, `rundot init`,
`npm run dev`).

### Credits

```bash
rundot credits                                 # this month, grouped by service
rundot credits --period all_time --group-by model
rundot credits --game-id <id> --consumer cli
```

`--period`: `today` | `this_week` | `this_month` (default) | `last_month` |
`all_time`. `--group-by`: `service` (default) | `model` | `app` | `consumer`.

### Other

- `rundot profile search <username>` — find creator profiles.
- `rundot analytics queries [--json]` lists the pre-approved reports and shows which reports accept a date range. JSON includes definitions and supported report versions.
- `rundot analytics export <query> [--game-id <id>] [--format csv|json] [--since <date>] [--until <date>] [--output <file>]` exports an approved report. CSV is version 1 and is the default. JSON uses version 2 and gives platform groups where measured.
- `rundot analytics overview [--game-id <id>] --output <file.html>` writes a local activity chart and table. The report uses closed UTC days and excludes the game owner and confirmed crawlers.
- If you omit `--game-id`, the CLI uses the game config for the analytics server environment.
- `rundot offerwall …` — offerwall admin; internal, requires `VENUS_INTERNAL_API_KEY`.

### Analytics request limits

The analytics commands are generally available.

Each account can make 30 `rundot analytics export` requests per 60-second window across its games.
`rundot analytics queries` has a separate limit of 10 requests per 60-second window.
Run exports in sequence. If HTTP 429 includes `Retry after N seconds.`, wait that long and
run the failed command again. If the CLI shows no delay, stop the batch and try again later.

---

## Common workflows

**New game from a template**

```bash
rundot login
rundot init --template 2d-pixi my-game --name "My Game"
cd my-game && npm install && npm run dev
npm run build && rundot deploy
rundot game set-public
```

**Promote staging → prod**

```bash
rundot game copy-release staging prod
```

**Inspect a player's save data**

```bash
rundot storage data <profile-id> --format json | jq .
```

**Check what you've spent this month**

```bash
rundot credits --period this_month --group-by service
```

## Native pack commands (retired)

Native pack builds have been retired. The `pack preflight`, `pack submit`, and
`pack status` commands remain available to return a retirement error. They do
not compile, upload, or queue a build. Each command returns exit code 1.

With `--json`, stdout contains one error object and stderr is empty:

```json
{"code":"KINETIX_PACK_RETIRED","error":"Native pack builds have been retired."}
```

Without `--json`, the command writes the message to stderr. Existing command
options remain accepted. These commands do not require login, Git, Node.js,
or a game project.

The server pack routes keep their existing authorization and rate limits.
Authorized requests return HTTP 410 with the same error object and
`Cache-Control: no-store`. Unauthorized requests keep their authorization
errors.

Syncplay runtime APIs and published compiler exports remain unchanged. The
hosted pack build service is retired.
