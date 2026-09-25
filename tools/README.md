# tools/

Everything here is **development tooling**. None of it ships in the module zip.

Suites drive a **live Foundry world** through the sibling MCP repo's headless
browser (`fvtt-mcp-dnd5e/client` — a `file:../fvtt-mcp-dnd5e` dependency: `npm install` once, and it needs that repo's `.env` and a built `dist/`). Read
[NOTES.md §5](../NOTES.md) before running anything — the protocol there is not optional.

```bash
node tools/battery.mjs                     # every suite, in order, each captured to a file
node tools/battery.mjs --changed --list    # what this change needs re-run, and why — then drop --list
node tools/smoke-saves.mjs                 # one suite, the local sandbox (default)
node tools/smoke-saves.mjs --list          # its sections, without connecting
node tools/smoke-saves.mjs --section 8     # just §8 (plus anything §8 depends on)
BF_TARGET=prod node tools/smoke-saves.mjs  # the live world, deliberately
```

**Every suite is section-filterable.** `--list` prints the table; `--section 3,5` runs a subset
and stamps its summary **`⚠ PARTIAL RUN`**, so a filtered green can never be mistaken for a
battery green. Setup, fixtures and teardown always run — only assertion blocks are skippable —
and a section that needs another declares it (`DEPENDS` at the head of the file), so asking for
it quietly runs the prerequisite and says so.

## Static — no Foundry, no world, seconds

| Tool | What it asserts |
| --- | --- |
| `check-hook-order.mjs` | the load-bearing same-hook registration orders (ARCHITECTURE §7), **and the full evaluation order against `hook-order.snapshot`** (2026-09-05, the machine-tier pass's Stage 0): every registration on every hook, tracked, and the default run fails on any drift. A move meant to change the order refreshes it with `--snapshot` in the same commit and says why; a move meant to be order-neutral is proven so by the run printing PASS. Run it whenever a file, an import or a hook registration is added — or removed. |
| `check-hook-dispatch.mjs` | ⚠ every `dnd5e.*` hook this module registers is one dnd5e **actually dispatches** (ARCHITECTURE §10 D10). The set is **generated** from the installed system's own bundle — literal `Hooks.call*` names ∪ its `@memberof hookEvents` JSDoc — committed as `dnd5e-hooks.json` and **pinned to the version `module.json` verifies**. `--regen` re-extracts and prints the diff. ⚠ **Run it after any dnd5e upgrade, and read the diff:** a name that disappeared is a listener that has gone silent. Core (non-dnd5e) hooks are **not** covered and cannot be — measured, see the file header. |
| `check-surfaces.mjs` | ⚠ every HTML anchor this module reads off the PLATFORM's markup lives in ONE map (`scripts/surfaces.js`) — no selector string for a platform element anywhere else — and every dnd5e-authored anchor still appears in the shipped templates and bundle of the version `module.json` verifies, recorded in `dnd5e-surfaces.json` (**generated** by `--regen`, pinned to the version like the hook artifact). The 6.0 pass's posture (NOTES §2 *the 6.0 pass* §3b, 2026-09-15): the card's DATA is the contract and its HTML is not; what HTML is still read is counted and checked at the pin bump. Core's own anchors are listed, not checked. |
| `check-layers.mjs` | ARCHITECTURE §7's dependency rule, mechanical: every edge is downward or pinned in `ALLOW` with a reason, and a pin whose edge has gone FAILS. Since 2026-09-05 it also holds `GROUPS` — a machine that is a directory (`saves/`): edges inside the group are legal, an outside import of any part but `index.js` fails with "import the index". |
| `check-coverage-map.mjs` | the live suites' `COVERS` claims (the coverage map, below), **both ways**: every machine-tier file is claimed by some battery suite; every claim names a machine that exists (a rename fails here — the layer pins' self-expiry); every ORDER suite declares COVERS and every file declaring COVERS is in ORDER (an unrun suite rots); no claim names a spine file ("spine files are covered by the full battery, drop the claim"); every `needs` resolves above its suite. Prints the suite → covers table. **No allowlist**: a machine nothing drives is claimed by the nearest suite with a comment saying so. `npm run coverage`. |
| `check-registry.mjs` | every `S` key is registered and every registration is named in `S`; every registry entry declares a known kind and no amount; every shipped list-setting default survives its own strict parser; the **R4 kind total** and the **source-file count** match their pins. |
| `check-imports.mjs` | every relative import resolves, and every named binding is really exported — including through the lazy `await import()` idiom. |
| `check-comments.mjs` | every `/**` block sits on a declaration, so an extraction cannot strand a doc. |
| `check-card-reads.mjs` | a card's ITEM or ACTIVITY is read through `lookup.js` `cardItem` / `cardActivity` — never a bare `fromUuid` / `fromUuidSync` / `resolveUuid` of an `activityUuid`, `itemUuid` or `itemUuidOf(…)` (2026-09-22, Gren's potion: dnd5e deletes a used-up item BEFORE its card exists, and only the card's snapshot still has it). A deliberately live read says `// live only: <reason>` on the line above. |
| `check-moments.mjs` | **the moment gate's coverage** (ARCHITECTURE §7 *The moment events*, version 2): every flag key the module writes — every write shape, constants resolved — is classified in `decide/moments.js` as a RESOLVE (published by the gate) or STATE (with a reason), no row is stale, every world-writing file is pinned to the record its writes resolve into, and the registry's own shape holds. Prints the classification as a table. A new key fails the build until somebody says what it is. |
| `check-doc-links.mjs` | every cross-reference in the docs and in code comments resolves: a markdown link or a bare `scripts/` · `tools/` · `tests/` · `prototypes/` path to a file that exists; `DOC §n` to a numbered section; `DOC *heading*` to a heading or a bold lead-in in that doc (DESIGN, RULINGS, ARCHITECTURE, NOTES, BACKLOG, SWEEP). Written for the documentation pass of 2026-09-24, when nothing had ever said a reference rotted. A bare `§n` with no doc named is not checked — name the doc. |
| `bump-version.mjs --check` | `module.json`'s `version` and its `download` URL name the same tag. |
| `tsc --noEmit` | ⚠ **real, and only over `scripts/decide/`** — the six pure modules opt in with `// @ts-check`. `checkJs` stays false globally; files opt IN, one at a time. |

All of them run inside `npm run verify`, along with biome, knip and the unit tests, all offline,
all in seconds. ⚠ **Do not hand-carry the counts out of here.** The tools print their own; every
number this repo has typed into prose twice has gone stale at least once.

## Live contract checks — read-only, safe beside a session

| Tool | What it asserts |
| --- | --- |
| `check-mastery-rules.mjs` | the verbatim rule text still matches the system's own rules journal (ARCHITECTURE §5 law 8). Run after any dnd5e upgrade. |
| `check-popup-routing.mjs` | popups route to whoever owns the decision, across **two** clients — asserted on BOTH sides ("the GM got it" only means something beside "and the player did not"), with the diagnostic ledger still printed in full. |

## Smoke suites — drive real chains, MUTATE the world

One per feature area. Every suite restores the settings it touches and deletes its own chat
messages. Disconnect the MCP bridge first, and verify settings after — **`battery.mjs` does the
ordering, the capture and the settings check for you**, which is why it is the front door.

`reset-fixture-state` runs before any suite (it sweeps a killed run's linked strays before anything
measures a distance — NOTES §5 *A KILLED battery poisons the next one*), `smoke-battleflow` is the
first suite (it places the shared victim token), `smoke-hold` immediately after
it, and `smoke-nogm` last (it must find no active GM, and the seed above it re-places the token it
needs). `ORDER` in `coverage-map.mjs` holds the whole order and `battery.mjs --list` prints it;
quote that, never a copy of it here.

⚠ **`smoke-saves` §23 (2026-09-05)** puts the auras' effects on the victim BY NAME (Aura of Purity, Circle's Power) and gives the fixture's failed-save effect a status for the run, so the save gate's `saves` facet has a demand to judge; it lists `effect` in Reminder Sources and the two names in Effect Sources for the section and restores both.

⚠ **The three suites of 2026-09-05** — `smoke-shields` (the damage shields: the Cleric warded with Fire Shield / Armor of Agathys, the Ranger with the Cleric's Death Armor, the goblin striking them; §8 is the cast-time CHOICE — Fire Shield cast through the cast slice, the warm-or-chill popup clicked on this page, one shield landing), `smoke-heatmetal` (the damage casts: Heat Metal on the Cleric at the goblin), `smoke-superiority` (the rest of the Battle Master's maneuvers on the CLONED fighter, the Ranger as the willing ally; §9 is Commander's Strike as a NOTICE plus a chip on the Ranger whose own attack carries the die — no driven attack since 2026-09-05; §11 is Tactical Assessment and Ambush ARMED from the sheet, the die folding into the next scoped check with no ask) — each gives its spells or maneuvers to the fixture for the run and removes them after; none needs a fixture step of its own beyond `fixture-suite`.

⚠ **`smoke-hitmenu` drives the CLONED fighter fixture** — `BF Test Fighter` (Morgash, Fighter 5 Battle Master: Combat Superiority and its Longsword), with the eight on-hit maneuvers added from the 2024 PHB pack for the run and removed after; the second goblin (`BF Test Attacker`) stands one square from the victim as the sweep's second creature.

⚠ **`smoke-sneak` and `smoke-clock` drive the BUILT fixtures** — `BF Test Rogue` (Rogue 14 /
Thief, the whole Cunning Strike option set, Assassinate) and `BF Test Ranger` (Ranger 5 / Gloom
Stalker) — created from the 2024 PHB pack by `fixture-suite.mjs`, with class items at a level so
the scale values resolve (measured: `tools/probe-rogue-fixture.mjs`). They give the victim a
400-HP pool for the run (why: NOTES §2 *The save machine REFUSES a dead target*). `smoke-saves` §19 is the save gate; its driver finds the system's dialog through the app
registry and Battle Flow's own fieldset, never by a class or by text — the dialog's target block
names the user's targets, which is not the creature that is asking.

⚠ **`smoke-twoclient` is the one that needs a SECOND client**, and it is where the properties no
solo suite can reach are asserted: the relay's **relayed** half (a player's answer travels as
their own message and the *continuing client* folds it) and D2's **cross-client popup close**
(the GM's buzzer resolves a hold and the player's popup vanishes without anyone touching its
DOM). It connects the player itself; just do not be logged in as the player test account.

⚠ **`smoke-nogm` is the one that connects NO GM AT ALL** (v1.27.0), and it is the only suite that
can see the flow elect. Before v1.27.0 `isActiveGM()` was the sole gate on the payout chain, so a
GM disconnect stopped Battle Flow dead with no chip, no card, no popup and **no error** — a failure
the whole suite tree was structurally blind to, because the tree always had a GM. It drives a real
Sap hit from the PLAYER's client and asserts the split: the reminder still posts, the monster is
never written to, the driver is whispered what did not land, and a GM rejoining mid-flight re-pays
nothing. Run it with the bridge disconnected and no GM window; it refuses if it finds an active GM,
since a stray one silently turns it into a weaker copy of `smoke-effects`. It listens to the
player page for the WHOLE run and prints every error it raised WITH ITS STACK (`player page:` lines
in the log, stamped with when they happened) — the 2026-09-04 null-id sighting was never placed
because only the message was kept.

⚠ **A console lead a suite cannot place is a suite defect, not a mystery** (the shields flake,
2026-09-05). `smoke-shields` shows the shape: it keeps every console error's STACK, the page's
uncaught errors and unhandled rejections, records each ActiveEffect delete the page issues with its
caller, and walks an `ActiveEffect "…" does not exist!` id back to the delete that lost the race —
and its shield assertions print which DAMAGE MESSAGE each card claims, which is what exposed an old
card being re-judged. Give a flaking suite those before bisecting sections.

⚠ **One at a time is enforced, not remembered.** Suites take a pid lockfile in `harness.mjs`: a
second one refuses and names the first; a stale lock (the holder died) is taken over and reported.
Why the sole-GM preflight cannot do this: NOTES §5.

### The battery

| Flag | Effect |
| --- | --- |
| *(none)* | every ORDER entry, in the canonical order, each captured to `dist/battery/<stamp>/` |
| `--changed` | **change-scoped**: the suites the working tree's change selects (`git diff HEAD`, the index, and the untracked files), needs pulled, in canonical order |
| `--changed main` | the same for a branch: everything since it left `main` (`main...HEAD`) plus the working tree |
| `--files scripts/emanations.js …` | the same selector on a list by hand — for checking what a change would run without making it |
| `--from smoke-saves` | resume after a failure, still in order — and pulls what the resumed rows need from above the cut |
| `smoke-hold smoke-battleflow` | a subset — still run in the canonical order; a suite's `needs` are pulled and named (`smoke-hold` alone runs `smoke-battleflow` first) |
| `--section 4 smoke-hold` | one suite's sections; only that suite receives `--section`, a pulled need runs whole |
| `--snapshot` | take a world snapshot first, roll it back after (the cure for the crash-launder hazard) |
| `--list` | the order, the needs and the notes, without running anything. With `--changed` / `--files` / names: **the plan**, each row with why it runs (the file that claimed it, the suite that needed it, or the reason for the full battery), and each changed file that runs nothing with why |

**`needs`** is a field on an ORDER row: the rows that suite cannot run without, each resolved to
the **nearest row of that name above it** — which is how the three `fixture-suite` seeds each serve
the suites below them. `smoke-hold` needs `smoke-battleflow` (adjacent in ORDER, so nothing can
run between them), `smoke-d20-folds` its `fixture-d20-folds`, `smoke-effects` the
`reset-fixture-state` sweep, `smoke-metamagic` / `smoke-emanations` / `probe-effect-view` /
`smoke-nogm` a `fixture-suite`. It replaced the old "ask for both" refusal: the battery runs the
dependency and says so.

**The coverage map** (`coverage-map.mjs`, 2026-09-23). Every battery suite declares
`export const COVERS = [...]` beside its `SECTIONS` — the **machine-tier** files (scripts-relative:
`"emanations.js"`, `"saves/ask.js"`) whose behaviour its sections drive. A claim means *"a
change there should re-run me"*; it is judgment from the suite's own sections, and generous.
`--changed` reads the claims: a changed machine selects its claimants; a changed `decide/` or
registry file is walked UP the import graph (the layer check's own edge reader) to the machines
that import it; a changed suite selects itself and a changed seed the suites that need it; docs,
`tests/` and `package.json` run nothing. ⚠ **A spine change is the full battery, honestly** —
core, spine, services and entry files (`check-layers.mjs`'s tiers, never a hand list), a
`decide/` file the walk finds the spine importing, `harness.mjs` / `target.mjs` / `battery.mjs` /
`coverage-map.mjs`, and `module.json` (the manifest the platform loads). Those are imported by
nearly every machine; there is no smaller set that tests them, and the plan says which file made
it full. `check-coverage-map.mjs` checks the map **both ways** in `npm run verify`, so a
claim cannot outlive its file and a machine cannot go unclaimed.

Failures print in full to the console **as well as** landing in the file — the `| tail` that
twice lost `smoke-battleflow`'s "2 FAILURE(S)" evidence cannot happen through this door.

⚠ **The battery also ends with HOOK COVERAGE** (`hook-coverage.mjs`, above), and it clears
`dist/hook-ledger/` first so a previous run's ledger can never be counted as this one's. **Read
the never-fired list.** It is the only line in the whole apparatus that says anything about
whether the module's code RAN, as opposed to whether it is well formed.

## Censuses — how registries get built

`scan-reactions.mjs` · `scan-riders.mjs` · `scan-volley-spells.mjs` · `scan-corpus.mjs` (the whole
ability corpus — race traits, class and subclass features, feats, spells — to a JSON file, ~10 min,
read-only) · `classify-corpus.mjs` (offline: that JSON sorted into mechanism families, `--list
<family>` / `--kind <kind>`; the survey behind SWEEP.md) · `audit-presses.mjs` (offline over the
same JSON: every 2024 save activity whose text presses a condition, against the statuses its
effects actually carry — the `SAVE_PRESSES` candidates). `probe-steady-aim-live.mjs` reads a
live table's Steady Aim chip and attack records without touching anything;
`probe-conditions.mjs` presses each 2024 status on a fixture and reads what the platform applies
(NOTES §2 *What the platform applies for a 2024 condition*), restoring the fixture in `finally`.
`probe-premium-module.mjs <module-id> <out.json>` (2026-09-24, Arcana Unleashed) reads what a
premium module ships pack by pack — counts, types, names — and lists the names the registry
already keys a row on and the names the 2024 packs already carry, so the next book the house
buys is measured before it is described; pack indexes only, no sole-GM preflight because it
asserts on nothing.

Read-only sweeps of the official compendia. Curated lists are built from what 5e 2024 actually
ships, never from what the party owns (DESIGN N1). Re-run after adding content.

## Operations

| Tool | Job |
| --- | --- |
| `target.mjs` | **which instance a suite talks to** — one decision, one place. Every harness resolves through it and prints the target it chose. |
| `verify-settings.mjs` | diffs the live world against the reference table it carries — **the single source for the user's configuration**. `--fix` restores drift. Run after every battery. |
| `fixture-suite.mjs` | **builds the shared fixtures — run it first after every prod refresh** (a refresh wipes them: NOTES §5). The scene, the two goblins, the shielder and the player-owned PC attacker, all filed under a `Test Suite` folder. Idempotent; adopts strays into the folder. Every token it places carries the `fixtureHome` stamp `reset-fixture-state` spares, and the base goblins go back to their statblock every run (HP, AC override, save bonuses, legendary resistances — what a fresh unlinked token inherits; 2026-09-24). The d20-fold PCs are CLONES of Morgash (Fighter 5 Battle Master) and Salyth (Bard 8 — the level that makes the inspiration die the 1d8 the suite pins), with the fighter calibrated to the +5 attack bonus `smoke-d20-folds` states in its own band comment. Pair with `fixture-d20-folds.mjs`, which runs second. |
| `reset-fixture-state.mjs` | shared fixtures back to a known state (conditions off, pools full), and **every LINKED `BF Test` token on the range without the `fixtureHome` stamp swept** — a killed suite's leftovers (2026-09-24). The battery's first row; run it by hand after any killed run outside the battery. |
| `scrub-fixture-residue.mjs` | clears what a suite's 5.x restore no longer clears at dnd5e 6.0 — the AC `override` and the per-ability `save.roll.bonus` — on every BF Test actor (`--check` reports only). Run it whenever a suite reports an AC or a save that cannot be (the dnd5e 6.0 pass, 2026-09-16). |
| `reload-clients.mjs` | refresh every other connected client after a hot-deploy. |
| `maintain-party.mjs` | strip temporary actor-level effects, on demand. |
| `build-release.ps1` | the release zip — step 4 of *Release and deploy* below. **Never use `Compress-Archive`** (why: NOTES §5 *Release*). |
| `world-snapshot.mjs` | `take` / `restore` / `status` / `drop` — roll the sandbox's databases back after a battery. The copy is 24 MB and takes 0.05s; the ~75s cost is the world bounce either side. **Local only.** |
| `harness.mjs` | the twenty lines every suite used to copy — env, watchdog, connect, preflight, the section plan, one reporter, the **suite lock**, and the **hook ledger** it arms at connect and writes at teardown. Not a suite; nothing runs it directly. |
| `hook-coverage.mjs` | ⚠ **the only measurement in the tree that is about BEHAVIOUR** (ARCHITECTURE §10 D11): which of the module's hook registrations actually FIRED during the run (it prints the count; 83 when it was built, 172 by 2026-09-05), unioned from the per-suite ledgers in `dist/hook-ledger/`. **It reports; it never fails.** A never-fired line is a coverage gap, a dead handler or a rare hook — only a person can tell which, and v1.23.0 would have printed four dead ones beside a green battery. |
| `claim-proof.mjs` | **the runtime half of the coverage map** (2026-09-23), printed as `hook-coverage`'s second section. The harness also counts every `battleflow.moment` by record `kind` into the same ledger file (`moments`); this reads it against each suite's `COVERS`: a claimed file is PROVEN (a kind only it writes was published there), PROVEN (shared kind), **UNPROVEN** (it writes kinds, none published — a stale claim), UNPROVABLE-BY-MOMENTS (it writes no kind — derived from the gate's tables, not listed) or NOT MEASURED (no moment half in the ledger). It also names a file that acted in a suite that does NOT claim it. The tag → suite join is read off each script's `connectSuite({ tag })`. Same contract: **reports, never fails.** ⚠ It hears the tester's page only — a second client's resolves are not counted. |
| `moment-writers.mjs` | the gate's flag-write scan and its `WORLD_WRITERS` pins, moved out of `check-moments.mjs` so the claim proof reads the SAME answer to "which file writes which record" (2026-09-23). |
| `battery.mjs` | the whole battery in one command, in the order that works, captured to files — or, with `--changed`, only what the change selects. |
| `coverage-map.mjs` | **the order and the claims** (2026-09-23): `ORDER` (the battery's rows, their notes and `needs`), `loadCoverageMap()` (every suite's `COVERS`, parsed from its text — suites run on import), `isSpine` / `tierOf` (the tier map's answer), `suitesFor` / `planFor` (the change selector). Not a suite. |
| `bump-version.mjs` | move **both** `module.json` version fields together; `--check` asserts they are in step and is part of the gate. |

### The disposable-world cycle

```bash
node tools/world-snapshot.mjs take     # before the battery
# ... run suites ...
node tools/world-snapshot.mjs restore  # after
```

`node tools/battery.mjs --snapshot` does both ends for you, which is where it belongs: the
crash-launder hazard bites a BATTERY, and the round trip costs ~75s of world bounce — more than
every `sleep()` in the tree put together, so it is not a per-suite move.

⚠ **The suites keep their own teardowns and probably should.** Rolling back would make that
ceremony unnecessary, but it is also what lets one suite — or one `--section` — run alone
without a bounce either side, which is the workflow the section filter exists to make normal.
Decide before simplifying (ARCHITECTURE *Decided against, and why*).

## Release and deploy — the chain

The steps, once. Why each is there: NOTES §5 *Deploy* and *Release*. A prod deploy happens only on
the user's word.

1. **The floor.** `npm run verify` green, and the full battery unattended
   (`node tools/battery.mjs --snapshot`), then `node tools/verify-settings.mjs` (`--fix` on drift).
2. **The bump.** `node tools/bump-version.mjs <patch|minor>` moves both `module.json` fields;
   `--check` is part of `verify`.
3. **The commits.** The change commit(s) — code, its suites and its docs together — then a
   `release vX.Y.Z: …` commit carrying only the bump, and the tag on that one. (The older
   three-commit shape with the tag in the middle is retired, 2026-09-24: the v2.0.x releases all
   ran this way.) Commit bodies are **ASCII** — the log mangles non-ASCII punctuation.
4. **The zip.** `tools/build-release.ps1` — it runs the gate and `bump-version --check` first,
   recurses `scripts/`, and re-reads the finished archive: no backslash entry, nothing missing,
   every relative import resolving inside it. If the execution policy refuses the script (the
   policy is the user's, never overridden), build with Windows' bsdtar —
   `C:/Windows/System32/tar.exe -a -c -f dist/fvtt-mod-battleflow.zip module.json LICENSE README.md <every scripts/**/*.js>`
   (forward-slash entries) — run the same three checks in Node over `tar.exe -tf`, then unpack and
   diff against the tree. Never `Compress-Archive`.
5. **The release.** Push, push the tag, `gh release create` with two assets: the zip **and** a bare
   `module.json`.
6. **The deploy** (run in the sibling MCP repo, `fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs`):
   `FOUNDRY_HOST=molten node <that script> fvtt-mod-battleflow --check` first. ⚠ An
   all-identical hash is a half-awake box: wake it through the bridge (`get-world-info`), re-check,
   and never deploy on that reading. Then the same command without `--check`. WebDAV never prunes —
   a file removed from the tree is deleted on the box by hand, or the zip shipped instead. `--local`
   deploys to the sandbox.
7. **After.** Scripts are live on the next world reload; `module.json` (the version) on the next
   Foundry **process restart**, which is the user's. Refresh the other connected clients
   (`reload-clients.mjs`, or ask the table), wait a few minutes before any suite (the front cache),
   and re-run `verify-settings` against the world. Say plainly what is live, what needs an F5 and
   what needs the restart.

## content/

World **content** repair, not module tooling — grafts and audits that fix compendium data so
the module does not have to learn an ability's name (NOTES §4). These are not part of the
module's test surface and are not run as part of any battery.
