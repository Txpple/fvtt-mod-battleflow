# Plan — several GM clients: the measurement (Pass 2, first brief)

**Status.** Section 1 written offline (2026-10-15) from the installed Foundry 14.369 and dnd5e 6.0.6 sources and this
repo's `scripts/`. Sections 2 and 3 wait for the sandbox run of `tools/probe-multi-gm.mjs`. **Nothing in the module is
built or changed by this brief**: the harness mode (`GM_CLIENTS`, three GM identities, `tools/seed-gm-identities.mjs`)
and the probe are tooling. The goal it serves, in the owner's words: *"ultimately, we need to support multiple gm
clients, of varying or same privilege level (full vs assistant)"*. The analysis it measures is suite issue #8 (items 2,
3 and 5); the review's §8 *Pass 2* is the plan around it.

Paths under `common/`, `client/` and `dist/` are Foundry's (`resources/app/` of the install); `dnd5e.mjs` is the system
bundle (`systems/dnd5e/dnd5e.mjs`, 6.0.6); everything else is this repo.

## 1. What an Assistant GM may write, and where the elect lands

### 1.1 The roles and the elect

- **Two GM roles, one `isGM`.** `CONST.USER_ROLES` is NONE 0, PLAYER 1, TRUSTED 2, ASSISTANT 3, GAMEMASTER 4
  (`common/constants.mjs:1237`); `User#isGM` is `hasRole(ASSISTANT)`, role 3 or more (`common/documents/user.mjs:124`).
  Every `isGM` gate — Foundry's, dnd5e's, this module's — treats an Assistant GM and a Gamemaster alike. dnd5e makes no
  finer cut: its 6.0.6 bundle has no `GAMEMASTER` and no `hasRole(` at all, and 78 reads of `isGM`.
- **The elect is one user, by role then id.** `game.users.activeGM` is `getDesignatedUser(u => u.active && u.isGM)`
  (`client/documents/collections/users.mjs:70`): the qualifying user with the highest role, a tie broken by the lower id
  (`:87`, `designated.id.compare(candidate.id)`), and `String#compare` is plain code-unit order, digits before capitals
  before lower case (`common/primitives/string.mjs:18`). Clients that agree on who is active agree on the elect.
- **By the Books adds the window.** `isActiveGM()` is `activeGM?.isSelf && leadsWindow()` (`scripts/core.js:92`, the
  leading window `:86`): one window of the elected user. The flow elect (`:102`–`:113`) is the same answer while any GM
  is on.
- **Can the elect be an Assistant GM? Only while no Gamemaster is connected.** A Gamemaster outranks every Assistant
  whatever the ids. So: with the DM's Gamemaster window open, the bridge (role 3) or a co-DM at role 3 is never the
  elect; two Gamemasters elect the lower id, which may be the co-DM's, not the DM's; with Assistants alone (the bridge on
  its own, the suites, a co-DM running the table at role 3) the lowest id among them leads. On the sandbox the suite
  identity and the bridge both hold role 3 (NOTES §5 *How the elect is picked*, confirmed against the world's users for
  this note), so every suite run is an Assistant GM elect, and the bridge outranks the suite on id.
- **The elect moves when the leading user connects or leaves.** A client already on hears an arrival through the
  server's `userActivity` broadcast (`users.mjs:114`), and its `activeGM` changes on that event. Which arrivals move it
  follows from the rule: a Gamemaster joining Assistants, or a lower-id user joining one of its own role.

### 1.2 Foundry's permission table, as a world gets it

Each capability in `CONST.USER_PERMISSIONS` (`common/constants.mjs:1284`) has `requiredRoles` (roles that always hold it)
and a `defaultRole`. The server fills `core.permissions` for every key a world has not set with the roles at or above the
default (`dist/database/documents/setting.mjs`, `getPermissions`), and `User#hasPermission` reads required roles first,
then the user's own explicit grant, then that table (`user.mjs:162`). So by default an Assistant GM holds every
capability below; the third column is whether a world can take it away.

| Capability | Required roles | Default from | Revocable from an Assistant |
| --- | --- | --- | --- |
| ACTOR_CREATE, ITEM_CREATE, TOKEN_CREATE, TOKEN_DELETE, REGION_CREATE, FILES_BROWSE, CARDS_CREATE, JOURNAL_CREATE, PLAYLIST_CREATE, NOTE_CREATE, DRAWING_CREATE | Assistant, Gamemaster | (various) | **no** |
| SETTINGS_MODIFY (`:1381`) | Gamemaster | Assistant | **yes** |
| FILES_UPLOAD (`:1327`) | Gamemaster | Assistant | **yes** |
| MACRO_SCRIPT (`:1339`) | Gamemaster | Player | **yes** |

And the document rules that are not a capability:

| Write | The rule | An Assistant GM |
| --- | --- | --- |
| Any document's data, its `ownership` included | the default update permission is OWNER (`common/abstract/document.mjs:135`), and `testUserPermission` makes every `isGM` user OWNER (`:407`, `:410`); Actor adds only a FILES_BROWSE check for random token images (`common/documents/actor.mjs:134`) | may |
| An embedded ActiveEffect | the parent's OWNER (`common/documents/active-effect.mjs:110`) | may |
| A chat message, anyone's | create: `isGM` (`common/documents/chat-message.mjs:75`); update: OWNER | may |
| A Combat, a Combatant | `isGM` (`common/documents/combat.mjs:77`, `combatant.mjs:77`) | may |
| A Region and its behaviours | REGION_CREATE and `isGM`; an `executeScript` behaviour needs MACRO_SCRIPT (`common/documents/region.mjs:101`, `:113`; `region-behavior.mjs:61`) | may (not a script behaviour without MACRO_SCRIPT) |
| A world Setting | SETTINGS_MODIFY; without it an Assistant still writes eleven listed core keys (`common/documents/setting.mjs:67`, `:93`) and its own user-scoped settings; **`core.permissions`, the table itself, is Gamemaster only** (`:57`, `:86`) | may, unless the table takes SETTINGS_MODIFY away |
| Another User | Assistants may update other users except `permissions`, `passwordSalt` and a Gamemaster's `password`, and never raise a role above their own (`user.mjs:220`); create only users of their own role or below, and none with per-user permissions (`:207`); delete only users below Gamemaster (`:244`) | may, within those limits |

**What an Assistant GM is refused that a Gamemaster is not, in a default world:** the permission table itself, a
Gamemaster user (creating one, promoting one, deleting one, changing one's password), and per-user permission grants.
**What a world can additionally take from it:** world settings (SETTINGS_MODIFY), uploads (FILES_UPLOAD), script macros
and script region behaviours (MACRO_SCRIPT), and any capability set per user. Everything else a Gamemaster may write, an
Assistant may.

### 1.3 What By the Books' elect writes, against that table

| The elect's write | Where | Foundry's test | An Assistant elect |
| --- | --- | --- | --- |
| The claim and the record on a card (`applying`, `applied`, `landed`, the receipts) | `queueFlagWrite`, `scripts/core.js:269`; the summon's claim `scripts/summons.js:783`–`790`, its record `:970` | ChatMessage update, OWNER | yes |
| A summon's world actor imported from its pack | `summons.js:810` (dnd5e's `fetchExisting`, which checks ACTOR_CREATE itself, `dnd5e.mjs:42962`) | ACTOR_CREATE, required | yes |
| Its tokens; a companion called back; a fallen familiar's gear | `summons.js:897`, `:1308`, `:1226` | TOKEN_CREATE, required | yes |
| The caster's players made owners of what they summoned | `summons.js:903`–`904` | Actor update (`ownership`), OWNER | yes |
| The seat in combat, its Initiative rolled | `summons.js:910`–`912`, `:1319` | Combat / Combatant, `isGM` | yes |
| The caster's resistance, companion and standing effects | `summons.js:920`, `:933`, `:947` | the parent's OWNER | yes |
| A Loot Shelf chest for the gear | `summons.js:1221`–`1226`, through Loot Shelf's api | ACTOR_CREATE and TOKEN_CREATE, required | yes (Loot Shelf's own gates are Pass 4's) |
| A transform: dnd5e's `transformInto` | `scripts/transforms.js:308`, `:359` | dnd5e's own (`canTransform` reads ACTOR_CREATE, `dnd5e.mjs:41833`), then actor and token writes | yes |
| The rest grants (temp HP, a pool's use, the fed flag) | `scripts/rest-grants.js:495`–`540` | Actor / Item, OWNER | yes |
| The mastery record (the actor's mastery list) | `scripts/mastery-record.js:369`–`382` | Actor, OWNER | yes |
| Initiative grants, kit tend | `scripts/initiative-grants.js:231`–`273`, `scripts/kit-tend.js:129`–`148` | Actor / Item, OWNER | yes |
| An emanation's region and its behaviour | `scripts/emanations.js:853`, `:1012`, `:1265` | REGION_CREATE and `isGM`; the behaviour is the module's own type, not `executeScript` | yes |
| dnd5e's visibility keys put where the module's two settings say, at `ready` and on the elect's own connect | `scripts/settings.js:17`–`37` | world Setting, SETTINGS_MODIFY | **yes by default; refused where the table takes SETTINGS_MODIFY from Assistants** (each write catches and warns, `:29`) |
| The GM-load migration: legacy settings moved (a create and a delete each), every user's legacy flags moved | `scripts/migrate.js:59`–`66`, `:94`, `:132`–`139` | SETTINGS_MODIFY; User update of `flags` (not a restricted field) | settings as above; users yes |
| The leading-window flag on its own User | `scripts/ui.js:863`–`878` | its own User | yes |
| Summon Art and Wild Shape Art saved (a GM's own click, not the elect) | `scripts/summon-art.js:374`; the menus are `restricted` (`:435`–`449`) | SETTINGS_MODIFY | the menu is not offered without it |

**Reading.** In a default world the elect performs no write an Assistant GM is refused. The one revocable capability it
leans on is SETTINGS_MODIFY, in two places: the visibility sync and the migration's settings move. Both run only on the
elect, and the elect is an Assistant only with no Gamemaster on; taken away, the visibility keys stop following the two
settings and an old world's legacy settings stay where they are, each logged, nothing else stopped. The world's own
`SETTINGS_MODIFY` roles are read on the sandbox by `tools/seed-gm-identities.mjs` (section 2). So **the `isGM` audit
needs no role split in the hub's consequence writes**: an Assistant elect can do everything the elect does. Its work is
the other cut issue #8 names, presentation versus consequence (every `isGM` site runs on every GM client). Loot Shelf's
21 sites are Pass 4's.

### 1.4 What the claim does not guard: the arrival, read from the client's boot

- **The claim is client-local.** `queueFlagWrite` serializes per message and key on ONE client (`scripts/core.js:255`–
  `284`: "Client-local suffices: every write comes from the elect"). The summon's claim (`summons.js:785`–`790`) reads the
  record as this client last saw it; two clients that each pass `isActiveGM` with `applying` unset both claim and both
  land.
- **How a GM client arrives** (Foundry 14.369). The socket connects; the server marks the user active and broadcasts
  `userActivity` to every client at once (`dist/components/activity.mjs`, `_onActivate` → `activateUser`), so the client
  already on changes its `activeGM` within a network hop. Only then does the arriving client ask for the world
  (`client/game.mjs:458`, `:586`): its snapshot lists the users already active (`users.mjs:43`). Events after the snapshot
  are buffered (`game.mjs:506`) and applied when `ready` is set, just before the `ready` hook (`:776`–`778`, `:2008`).
  Between the two, `setupGame` builds the documents and renders the UI from the snapshot (`:729`, `:763`): the chat log's
  `dnd5e.renderChatMessage` reaches the resume floor as `"render"` (`scripts/ui.js:880`–`882`, `:838`), and at `ready` the
  window takes the lead and resumes the last 60 cards (`:863`–`878`).
- **What that predicts**, and what the probe tests:
  1. *No overlap.* Both clients holding `isActiveGM` at once needs the client already on to hear the arrival after the
     arriving client has a world; the broadcast precedes the world request.
  2. *A gap instead*, when the elect moves: from the arrival until the arriving client's setup nobody drives. A record
     placed in it waits for the newcomer's render resume, its buffered update or its lead resume at `ready`.
  3. *A doubled landing only from a stale snapshot*: the client already on claims just before it hears the arrival, and
     the newcomer's snapshot is older than that claim, so its render resume drives from the snapshot. That window is one
     claim's round trip (milliseconds), and it exists only where the elect moves.
  4. *The hand-off hole is not this*: a claimant that leaves mid-landing leaves `applying` set forever (issue #8 item 2).
     The probe does not drop a client mid-landing; it is read from the code, not measured.

## 2. The measurement

*(Written from the sandbox run of `tools/probe-multi-gm.mjs`: the identities, the orderings, the table and its reading.)*

## 3. What the next brief should build

*(Written from section 2.)*
