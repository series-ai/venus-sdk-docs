| in-room simulation: recipes, **actors** (`create_actor`, `destroy_actor`, `ensure_actor`, `transform_actor`, `move_actor`, `get_room_actors`, `update_defense_actors`, `replace_room_actors`), `matchmaking`, `move_player`, graph | `this.services.simulation.executeRecipe(...)`, `getState`, `getAvailableRecipes` | Actor effects, `matchmaking`, and `move_player` (cross-room transfer) now run against the realtime simulation scope; `getState` returns the room's actors and `getAvailableRecipes` includes actor-gated recipes. Only `create_room` / `ensure_room` / `generate_graph` stay rejected — rooms are created via `realtime.*`, not a sim effect. |
| room notifications | `this.services.notifications.send({ recipientProfileIds, template, fallbackTitle, fallbackBody })` | Offline push to room members **and** now persisted to the recipient's in-app inbox as a first-class `room` notification (read / archive / per-game mute honored). |

***

## Room as Merge Authority (Collaborative Documents)

For real-time co-authoring of collaborative documents (via `@series-inc/rundot-document`), the multiplayer room acts as the authoritative writer and sequence coordinator.

### Architecture
- **Monotonic Lamport Clock**: The room issues monotonically increasing `seq` values for all document operations across connected clients.
- **Authoritative Ops Merging**: Field updates, entity additions/deletions, and thread comments/suggestions are validated against actor capability gates (`edit`, `propose`, `comment`) and merged authoritatively before broadcast.
- **1 MiB State Enforcement**: Rooms enforce `STATE_HARD_LIMIT = 1024 * 1024` (1 MiB). When state exceeds `STATE_WARNING_SIZE` (800 KB), the room triggers cold promotion.
- **Cryptographic Digest Verification**: When clients upload cold segments to `Files` on behalf of the room, the room accepts the resulting `ColdRef` only if the client-reported `sha256` digest matches the expected segment hash, preventing corrupted or fraudulent writes.
