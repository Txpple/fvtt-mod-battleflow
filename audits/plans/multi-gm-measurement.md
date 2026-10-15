# Plan — several GM clients: the measurement (Pass 2, first brief)

**Status.** Section 1 written offline (2026-10-15) from the installed Foundry 14.369 and dnd5e 6.0.6 sources and this
repo's `scripts/`; sections 2 and 3 from the sandbox run of `tools/probe-multi-gm.mjs` the same day (56 cycles, two of
the four orderings: the Gamemaster identity waits for the owner). **The finding:** no overlap ever, a 1.1 s gap when the
elect moves, every record landed once, and one narrow path to a doubled landing (the newcomer's stale snapshot) that
the next brief closes first. **Nothing in the module is
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

Run on the sandbox on 2026-10-15: Foundry 14.369, dnd5e 6.0.6, By the Books `main`'s bytes (the worktree deployed
`--local`, byte-identical), one machine for the server and every client, so the network costs well under a millisecond.
The cycles are in `dist/probe-multi-gm/run-4e.json` and `run-4e-aim.json`; the logs beside them.

### 2.1 What ran, and what did not

- **The identities.** `suite` holds the Assistant GM role (3), not Gamemaster. `assistant` was created by
  `tools/seed-gm-identities.mjs` with role 3; its id sorts below the suite's, so it leads a tie. **`gm2` (a Gamemaster)
  could not be created**: an Assistant may create users of its own role or below only (§1.2), and no Gamemaster's
  credentials are in the family `.env`. Its user waits for the owner (Configure Players, Create User, `Gamemaster Tester`,
  Gamemaster, the password on the `.env`'s `FOUNDRY_GM2_PASSWORD` line), and with it the two mixed-role orderings:
  `node tools/probe-multi-gm.mjs --orderings full-assistant,assistant-full`. Mechanically they are the same two cases as the
  same-role rows (the elect stays, the elect moves; §1.1), so the expectation is the same numbers.
- **The world's table:** `SETTINGS_MODIFY` and `FILES_UPLOAD` both `[3, 4]`, the defaults (§1.3's reading holds here).
- **The runs.** The default schedule (16 offsets, −150 ms to +5 s) on `same-stays` and `same-moves`: 32 cycles. Then an
  aimed series on `same-moves` (`--aim=-8 --cycles 24`), every cycle fired a few ms before W hears X arrive, to sample
  the narrow window §1.4 predicts: 24 cycles. **56 cycles**, none failed; four shakedown cycles before them are not
  counted.
- **A harness defect found on the way** and fixed (commit `be5315c`): the harness's teardown called itself instead of the
  bridge's close, so every suite's browser, and its user's seat, lived until the process exited. A script that connects
  twice found its first client still on 20 s later; the first full run stopped on it.

### 2.2 The table

| Ordering | W → X (role) | Cycles | Fired pre / boot / setup / ready | Landed once | Doubled | Not landed | Claims by W / X | Overlap > 0 (max ms) | Gap median / max ms | Fire → claim median ms (pre / boot / setup / ready) | X arrival → setup / ready median ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| full-assistant | — | skipped: no Gamemaster identity (gm2 waits for the owner) | | | | | | | | | |
| assistant-full | — | skipped: the same | | | | | | | | | |
| same-stays | assistant (3) → suite (3) | 16 | 2 / 11 / 1 / 2 | 16 | 0 | 0 | 16 / 0 | 0 (0) | 0 / 0 | 8 / 12 / 13 / 7 | 1101 / 2006 |
| same-moves | suite (3) → assistant (3) | 16 | 5 / 8 / 1 / 2 | 16 | 0 | 0 | 5 / 11 | 0 (0) | 1109 / 1236 | 7 / 2421 / 1307 / 897 | 1111 / 2116 |
| same-moves, aimed −8 ms | suite (3) → assistant (3) | 24 | 12 / 12 / 0 / 0 | 24 | 0 | 0 | 11 / 13 | 0 (0) | 1083 / 1151 | 11 / 2423 / — / — | 1084 / 2093 |

The phases: *pre* the answer written before W heard X arrive; *boot* after it, before X's `setup` hook; *setup* before
X's `ready`; *ready* after. The aimed fires spread from −53 ms to +39 ms around the arrival (one calibration fire at
+667 ms); the schedule's from −173 ms to +5 s. X's own clock: its connect took 2.28–2.54 s to reach the arrival (the
browser launch and `/join`), its `setup` came 1.06–1.24 s after the arrival and its `ready` 1.94–2.22 s after.

### 2.3 What landed per record

**All 56 records landed once:** one claim, one writer of the record after the answer, one familiar token, one companion
effect, one `bythebooks.moment`, no extra chat card, the record `applied` with outcome `landed`. Nothing was lost: no
record was left unlanded, the latest landed 4.5 s after the arrival.

### 2.4 The elect, sampled every 5 ms on both pages

- **The overlap is zero in all 56 cycles.** No instant had both clients passing `isActiveGM`.
- **When the elect stays** (16): X never held it, not one sample.
- **When the elect moves** (40): W stood down 0–25 ms (median 3) after it heard X arrive; X first held the elect at its
  `setup` hook, 1056–1240 ms (median 1103) after. **The gap — nobody holding the elect — is 1056–1236 ms, median
  1100.** Prediction 1 holds and prediction 2 holds: Foundry tells the client already on before the newcomer has a
  world, so the hand-off opens a gap, never an overlap.

### 2.5 The hand-off, by when the record was answered (the elect moving, 40 cycles)

- **Before the arrival** (16 of the 17 *pre* fires): W, still the elect when its own write came back, claimed 6–19 ms
  after its answer and landed in about 50 ms; X's snapshot showed the record claimed or landed every time, and X did
  nothing. The 17th (aimed, fired −1 ms): W heard the arrival before its write came back, stood down, and X drove it.
- **In the gap** (the *boot* and *setup* fires): nobody drove until X. X drove either **from its snapshot, during its
  setup** (2 cycles, the answer inside the snapshot — aimed cycles 19 and 21, the second the −1 ms fire above: claimed
  1494 and 1452 ms after the arrival, landed by 1.75 s) or
  **from the buffered update at its `ready`** (the answer after the snapshot: claimed 2.38–2.51 s after the arrival,
  landed 4.3–4.5 s after it — X's page is busy for about 2 s after `ready`, so its landing takes 1.9 s where W's took
  50 ms).
- **After X's ready**: at +2.5 s the claim waited until 4.29 s (the same busy page); at +5 s it came 10 ms after the
  answer.

### 2.6 The snapshot's cut, and the one window for a doubled landing

Three facts the aimed series measured, each the piece of prediction 3 it names:

1. **The newcomer's snapshot is cut 3–8 ms after W hears the arrival.** An answer W saw land at +3 ms was in X's snapshot
   (aimed cycle 19), and so was a W claim at +2 ms (cycle 15); answers at +8 and +9 ms were not (cycles 4, 7, 12, 17).
2. **W still claims a record answered just before the arrival, after it.** Cycle 15: answered at −10 ms, W's claim
   landed at +2 ms — W decided while it was still the elect.
3. **The newcomer drives from its snapshot before its buffered events are applied.** Cycles 19 and 21: X claimed during
   `setup` (1.45–1.49 s), half a second before its `ready`, from the chat log's render (`scripts/ui.js:880`–`882`).

Together they make the doubled landing §1.4 predicts possible: the answer lands before the cut, W's claim after it,
and W decides before it hears the arrival. X's snapshot then holds an answered, unclaimed record, its render resume
drives it from that snapshot (its `queueFlagWrite` reads the same stale document, `scripts/core.js:269`), and both land.
With W's claim 3–12 ms behind its answer (measured), the window is **at most about 10 ms wide, around the arrival**,
on this machine. **It was not hit**: 39 of the 56 fires fell within ±60 ms of the arrival, 18 of them within ±20 ms.
On a hosted world every step in it is a network trip (W hears the arrival half a round trip after the server, its claim
leaves a round trip after its answer), so the window grows to about one round trip: tens of milliseconds on Molten.
Still narrow, but a co-DM who joins while a summon is being placed can fall into it, and it is a window of the code, not
of the machine. Prod was not measured (off limits).

## 3. What the next brief should build

**The verdict.** The race issue #8 item 3 suspected, both clients holding the elect at once, **does not happen**: 0 ms of
overlap in 56 cycles, and Foundry's own order (the activity broadcast before the newcomer's world request) rules it
out. The hand-off itself works: every record landed once, at worst 4.5 s after the arrival. **A doubled landing is
possible through one narrow path, the stale snapshot** (§2.6), measured in its three parts and not reproduced in 56
cycles. The claim needs no user id to stop it; the snapshot needs a guard. So the next brief, in this order:

1. **The snapshot guard (small; first).** In `scripts/ui.js` `resume` (`:838`), a `"render"` resume before
   `game.ready` does not drive: its key is set aside and resumed once `ready` fires, when Foundry has applied the
   buffered events (`client/game.mjs:776`–`778`, `:2008`) and a claim that missed the snapshot is in the document. One
   place, every resumable at once (summons, transforms, the rest grants, the mastery record, the initiative grant and
   swap, kit tend, the turn grants, drop-to-one's offer). The cost is measured: the two snapshot-path landings
   (1.45–1.49 s) move to the buffered path's 2.4 s. Proof: a unit test of the deferral (a fake `game.ready`), and this
   probe re-run, `same-moves --aim=-8`, with the claims still one per record.
2. **The `isGM` audit** (issue #8 item 1). Two GM clients run every `game.user.isGM` site twice today, without any race:
   two screens show the same ask. §1.3 found that no consequence write needs a role split, so the audit is one cut per
   site, presentation (fine on every GM screen) or consequence (the elect only), plus whether the loser's popup closes
   when the answer lands (`shownMoments` is per client). The hub first, Loot Shelf's 21 sites with Pass 4.
3. **The claim with its claimant, and the re-drive** (issue #8 item 2: a claimant that leaves mid-landing leaves
   `applying` set forever; not measured here, since the probe never drops a client mid-landing). The shape:
   - *Where the user id goes.* The claim becomes a stamp, `applying: { by: game.user.id, window: WINDOW_ID, at:
     Date.now() }` instead of `true`, written by one helper in `scripts/core.js` beside `queueFlagWrite` and used at
     every claim site (`summons.js:787`, `transforms.js:415` and `:786`, `rest-grants.js:495`, `mastery-record.js:369`,
     `initiative-grants.js:231`, `initiative-swap.js:159`, `kit-tend.js:129`, `turn-grants.js:302`, `drop-to-one.js:500`
     and `:734`). An object is truthy, so every `!flag.applying` read keeps its meaning.
   - *How liveness is checked.* A claim is dead when its user is no longer active (`game.users.get(by)?.active`), or
     when it is older than a ceiling with nothing landed. The ceiling covers a window closed mid-landing while the same
     user's other window stays on; the measured worst landing is 4.5 s from an arrival, so a minute is generous.
   - *What re-drives.* Each resumable's `pending` treats a dead claim as no claim. The trigger is the elect's
     `userConnected(user, false)` (the claimant left), resuming the recent cards the way the lead resume does
     (`ui.js:863`–`878`), and the lead resume itself; the re-driver's claim overwrites the dead stamp.
   - *What a re-drive must find.* The dead landing may have made part of its work: summon tokens carry no record id
     today (`summons.js:897`), so each landed token is stamped with its card's id and the re-drive removes or adopts
     what the dead landing left; the companion effect is already keyed by the card (`endCompanionEffects(caster,
     message.id)`).
   - *Its proof:* a probe ordering that hangs X up just after its claim, the record still landing once, by W.
4. **Pass 2's done-when** follows from the harness mode: `smoke-companions` and `smoke-summons` each declare
   `GM_CLIENTS`, connect a second GM through `gmConfig`, and assert one landing per record while it arrives; then again
   with a Gamemaster beside an Assistant once the `gm2` user exists.

## 4. Built

Built on the branch `handoff/4j` (2026-10-15), in §3's order. Nothing here is a game-rules ruling; RULINGS is
untouched.

1. **The snapshot guard** (ui.js `resume`): a `"render"` resume before `game.ready` sets its message aside, and the
   `ready` handler resumes it on the document `ready` finds (the buffered events applied). Unit:
   `tests/snapshot-guard.test.js` (3 of its 6 fail without the guard).
2. **The `isGM` audit** (`tools/check-gm-sites.mjs`, `npm run gmsites`, in verify): 24 `isGM` reads at 21 sites,
   each pinned with its count, tag and reason — 12 presentation, 5 own (the leading window's own User flag, the
   casting client's own held card, the re-drive's lead hand-over), 7 role reads (recipients, the roller, the viewers).
   **No consequence sits behind `isGM`** and none needed moving: every `game.user.isGM` gate draws or offers (a
   button, a popup, a control, a view, a notification), and its click's write is guarded where it lands. §1.3's
   reading stands: no consequence write needs a role split. The loser's popup: canAnswerFor's GM branch pops an
   unowned subject's moment on every GM screen, and five machines did not close theirs when another client answered;
   each now does on the update (Sweeping Attack's pick, Bait and Switch, a cast's effect choice, the mastery swap, the
   GM's change of a form). Loot Shelf's 21 sites are Pass 4's (listed in the 4j report).
3. **The claim with its claimant, and the re-drive** (core.js `claimStamp`, `claimHolds`, `claimLanding`,
   `CLAIM_CEILING_MS` = 60 s; ui.js's `userConnected` / `updateUser` / lead resumes): 13 claim sites on the helper (the
   eleven of §3, damage-holds' `landHeld`, initiative-grants' fallback); a dead claim reads as none in every
   `pending`; a summon's tokens and shared resistance carry `summonCard`, and a landing over a dead claim sweeps what
   the card names first. Unit: `tests/landing-claim.test.js` (13). The check fails the pre-change tree 41 times.
4. **The two-GM sections**: `smoke-companions` §9, `smoke-summons` §10 (`tools/gm-clients.mjs`, the arrival landing);
   the probe's `hangup-claim` and `hangup-landing` orderings.

**Live** (the sandbox, 2026-10-15: Foundry 14.369, dnd5e 6.0.6, the branch's bytes deployed `--local`, byte-identical;
`suite` and `assistant` both Assistant GMs, the assistant the lower id; `gm2` absent). The runs are in
`dist/probe-multi-gm/run-4j-aim.json` and `run-4j-hangup.json`.

- **The aimed series again** (`same-moves --aim=-8 --cycles 12`, §2.5's command): 12 cycles, every record landed once
  (one claim, one familiar token, one companion effect, one moment, no extra card), 0 ms of overlap, the gap
  1178–1252 ms (median 1196). 7 answers fell before the arrival (W claimed 7–11 ms after its answer) and 5 in the
  newcomer's boot (+4 to +671 ms). **The newcomer claimed before its own `ready` in 0 cycles** (the 4e series: 2 of
  24, cycles 19 and 21, at 1.45–1.49 s). Every boot claim came 0.44–0.46 s after the newcomer's `ready`, 2.81–2.90 s
  after the arrival (landed 4.95–5.17 s): the buffered path. In this run no snapshot held an answered, unclaimed record
  (the boot answers all fell after the cut, the pre-arrival ones carried W's claim), so the case the guard closes
  did not recur; the unit test holds the deferral, and the count says nothing drove from a snapshot.
- **The hang-up orderings** (`hangup-claim,hangup-landing --cycles 4`): 8 of 8 landed once, by W. In every cycle X
  claimed, its browser was closed under its page 29–208 ms after (no `beforeunload`, no teardown), and W claimed
  over the dead stamp 11–34 ms after it heard X go (median 13), the record landed 68–151 ms after X went. In
  `hangup-landing` the token X had made carried the card and W removed it before landing (4 made, 4 removed); one
  token and one companion effect stood after every cycle, one moment, no card.
- **The two-GM sections alone**: `smoke-companions --section 9` 8/8; `smoke-summons --section 10` 7/8 on its first
  run, red on "no extra card" — the three cards were the BTB Test Paladin's emanation cards, raised by the arriving
  client as the new elect on the live range, not the landing's; the judge now counts the landing's own cards and
  logs the rest; the re-run alone 8/8. In both, the assistant client (the new elect) claimed and landed, the answer
  written 3–4 ms after the arrival.
- **The battery** (`battery.mjs --changed main`, the full battery: ui.js and core.js are spine):
  `Battery: 2026-10-15T20-40-45 — 67/67 suites, 2264/2264 checks, GREEN`, 42 min 54 s, the settings CLEAN against the
  world's own, the fixtures torn down (18 actors, 1 scene, 0 combats); §9 and §10 green inside it. Hook coverage 72/73
  names (466/467 registrations), the one never fired `dnd5e.advancementManagerComplete` as before.

**Found on the way, not built** (the emanations machine, for its own pass): on an elect hand-off the new elect posts
the live scene's feature-aura cards again — the BTB Test Paladin's three (Aura of Protection, Courage, Warding),
about 2.4 s after its arrival, in both solo `smoke-summons` §10 runs (the re-run: after the suite's own three, posted
7.5 s earlier) and in §9 and §10 inside the battery, not in §9's solo run. Only `reconcileScene`'s creation path posts
that card, so the newcomer raised the auras anew; three regions stood after the re-run. Not a doubled landing and not
two writers at once, but if the newcomer first took the old regions down, the aura's members lost and regained their
effects, and the cards repeat. The likely reading: the newcomer's first liveness read (`liveNow`, the users' viewed
scenes) does not yet see the other GM viewing the range.

The Gamemaster-beside-Assistant runs wait for the `gm2` user (HANDOFF §7 item 1).
