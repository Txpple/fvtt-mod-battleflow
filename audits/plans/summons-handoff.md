# Handoff — Summons (issue #1), for a fresh session

Written 2026-10-10 at the end of the mastery-record session (issue #3). Open the Claude Code session in
`fvtt-mod-battleflow` (not the suite folder). Read, in order: this file, the issue
(`gh issue view 1 --repo Txpple/fvtt-mod-battleflow --json body -q .body`), `prototypes/summons.html`, then
DESIGN.md (binding), ARCHITECTURE.md §3 *Who does what*, §4 *The flow elect*, §5 *The spine*, §11 *Adding
something new*, and RULINGS.md *Weapon Mastery — the record* (the newest machine, the house pattern end to end).

## The rulings already given (2026-10-10, off the prototype)

| Question | Ruling |
| --- | --- |
| Pool for CR-mode summons (Find Familiar, Wild Companion) | **every book, de-duplicated by name** (45 beast names ship twice or more); the preferred copy by book order **MM, then PHB, then DMG** (ruled on the Wild Shape issue, shared) |
| The creature's seat in the tracker | **its own slot right after the caster**, sharing the caster's initiative |
| Linked companions (Primal Companion, Find Steed) | **import once and keep**; a re-cast re-places and refreshes the one world actor |
| Tier 2 placed objects (lights, illusions, Mage Hand, Unseen Servant, sensors) | **through the relay, placement only** — no form; the player never needs Create Token |
| The form picker | **one gallery shared with Wild Shape / polymorph**, parameterised by pool and caps (ruled on #2 Q5) |
| Where the questions are asked | **one popup before the card** (A): the house offer asks every question, then placement, then one complete card posts (ruled 2026-10-10 off the prototype) |
| How a form is picked | **rows carrying everything** (C, added to the prototype 2026-10-10 at the user's ask): one row per form with the token art, name, size and speeds, the attack line, the trait, AC and HP; nothing folded. Not art cards (A), not compact rows (B). Applies to the shared gallery, so Wild Shape inherits it |
| The shared gallery's right column | **a parameter beside pool and caps**: a profile pick (the Summon spells) shows AC · HP; a CR-mode pool (Find Familiar, Wild Companion, Wild Shape) shows CR · size · book (ruled on #2, 2026-10-10; Wild Shape's picker prototype is `prototypes/wild-shape-picker.html`) |

Nothing is open from the prototype's toggles; all four are ruled (above). **The build is on hold** (the user,
2026-10-10 evening): another agent is in the sandbox. Before the build, re-measure on dnd5e 6.0.6 (below) and
check `disconnect-bridge` etiquette with whoever holds the sandbox.

## Where the build stands (2026-10-10, late)

**Built on `feat/summons`** (the worktree `.claude/worktrees/summons`, off bbc8883): `scripts/summons.js`,
`scripts/decide/summons.js`, the shared gallery `scripts/gallery.js` + `scripts/decide/gallery.js`, `SUMMON_CHOICES`,
the `summon` resolve row, `tools/smoke-summons.mjs` (§1–§6), the RULINGS section *Summons*. `npm run verify`'s static gates
and the 1347 unit tests are green; **the live suite has never run** — the sandbox was another session's. The Wild Shape session
(its own worktree) imports the gallery by name; merge summons first, Wild Shape rebases.

**The sandbox pass, in order:** deploy the branch's files to the local box, run `node tools/smoke-summons.mjs`, then the walk
table in RULINGS *Summons* by hand (the placement preview is a canvas interaction the suite bypasses through `placedAnswer`).
Watch for: whether `activity.getTokenData` accepts a plain placement object on the elect (it deletes `placement.prototypeToken`
and merges the rest); the seat's sort in the tracker; `Roll.safeEval` on a profile's `cr` formula; the `summon` row's position in the moments gate's
table. Then the effect-view bar's Dismiss and the clock, and a two-client section.

## The order of work

Summons comes **before** Wild Shape (the user's order: masteries → summons → wild shape). Wild Shape reuses this
issue's GM-client relay and the shared gallery, so build both as named, reusable pieces:

1. **The relay** — `registerResumable("summon", …)`: the record on the cast card (profile, count, placements, the
   spell's choices, origin, cast level); the active GM's client drives it exactly once (`claimed` inside
   `queueFlagWrite`, as `landSwap` in `scripts/mastery-record.js` does), creates the tokens with its own
   permissions, grants the caster's player OWNER on the world copy, stamps `applied`. No GM online: the card holds
   and says so (DESIGN §4, no degraded mode). The precedent for "a player's answer travels to the elect" is
   `registerRelay` (`masterySwapAnswer`, `restSongAnswer`).
2. **The gallery** — a `decide/` pure filter (pool rows → the allowed forms by CR cap, type, fly, size) with unit
   tests, and one popup through `openMomentPopup` (`scripts/ui.js:186`; it needs a chat message to anchor to).
   Design it so Wild Shape calls the same function with a different pool and cap.
3. **The intercept** — `dnd5e.preUseActivity` on a summon activity sets `usageConfig.create.summons = false`
   (precedent `scripts/token-lights.js`), the caster's client runs the form and `TokenPlacement.place` with
   `create: false`, writes the record.
4. **The dragon row** — `SUMMON_CHOICES` keyed by spell: Summon Dragon's damage type lands an enchantment on the
   spirit's Breath Weapon and a "Shared Resistance (type)" effect on the caster, dependent on concentration.
5. **The tracker seat and Dismiss** — the summoned token after the caster; Dismiss on the effect view bar, the
   elect executes; verify the tokens register as dependents of the concentration effect on the elect's path.

## What the mastery build taught about the gates (read before the first `npm run verify`)

- **Adding a file**: declare the layer in the header AND in `LAYER_OF` (`tools/check-layers.mjs`); `listen(hook,
  "<file-key>", fn)` with its row in `ORDER` (`scripts/dispatch.js`); the import in `scripts/battleflow.js`; move
  `EXPECTED_SOURCE_FILES` in `tools/check-registry.mjs` (135 after #3). A `decide/` file imports nothing.
- **Flag-key constants**: the moments scanner (`tools/moment-writers.mjs`) resolves `const X_FLAG = "…"` by bare
  identifier across the whole tree. `SWAP_FLAG` in a new file silently rebound initiative-swap.js's key and the
  gate reported a stale row in a file nobody touched. Prefix per machine: `SUMMON_FLAG`, `SUMMON_ANSWER_FLAG`.
- **Every written flag key** is classified in `scripts/decide/moments.js` (a `MOMENT_RECORDS` resolve row, or a
  `STATE_KEYS` reason ≥ 20 chars); a file that writes the world is pinned in `WORLD_WRITERS` to a **resolve** row
  (not a state key) — `"mastery-record.js": ["masterySwap"]` is the shape; add a fixture for the new resolve in
  `tests/decide-moments.test.js` (the `restSong` / `masterySwap` fixtures).
- **Comments**: no dates inside code comments, no "the user's ruling" phrasing (point at the RULINGS section by
  name), every `/** */` block directly on a declaration (fold `@typedef`s into the function's block).
- **HTML**: every `${name}` / `${…Name}` / `${img}` in a template literal goes through `esc()`; a helper
  parameter called `name` trips the gate too — call it `field` or `kind`.
- **Writers**: a world write reachable from an every-client hook (`ready`, `renderChatMessage`, document hooks)
  must sit behind `isActiveGM()` / `canAnswerFor()` / `drivesMomentFor()`; `isOwner` is not a gate.
- **Live suites**: `export const COVERS = […]`, `SECTIONS`, a row in `tools/coverage-map.mjs` `ORDER`;
  `connectSuite({ tag })` — the tag is parsed by `tests/claim-proof.test.js`, so a suite in ORDER without a file
  fails the unit run. Fixture PCs built from the pack carry **no weapon proficiencies** (`prof.multiplier` 0) —
  grant `sim`/`mar` in the suite when a read depends on proficiency. The suite's player-membership gates need the
  player test user (`FOUNDRY_PLAYER_USER`) to own the fixture; `isPartyMember` = primary party member or
  player-owned character.
- **The sandbox**: deploy with `FOUNDRY_HOST=local node scripts/deploy-house-module.mjs fvtt-mod-battleflow
  --local` from `../fvtt-mcp-dnd5e`; `node tools/fixture-suite.mjs` after any `pull-prod-to-local`; the suite
  preflight refuses while a second GM-capable user is on (the MCP bridge "Assistant DM" of ANY open Claude session
  — `disconnect-bridge` in that session). The walk party from the mastery session lives in the sandbox under
  Actors → "Mastery Walk" (Kael, Brannoc, Sera, Orin, Tam), all in the Party group, player-owned.

## Where the issue is measured and where it is thin

The issue body carries the measurements (dnd5e 6.0.5 `summon.mjs`: `canSummon`, `fetchExisting`, the thin
`SummonUsageDialog`, the dragon's five-type Breath Weapon, Summon Undead / Conjure Animals with `summon.prompt:
false`, the 1-HP "object" stand-ins). Re-measure on the installed **6.0.6** bundle
(`Data/systems/dnd5e/dnd5e.mjs`; `grep -n "class SummonActivity"`) before building — the Foundry 14 `User#query`
note is informational; the house channel stays a flag on a message (ARCHITECTURE §3).

Not yet measured: whether `SummonActivity#getChanges` is reachable from the elect with the caster's usage config
reconstructed from the record; whether `TokenPlacement.place` is public on 14.369; the `dnd5e.registry.summons`
untrack call for Dismiss.
