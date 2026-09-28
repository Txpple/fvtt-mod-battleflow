# HANDOFF.md — after Slice B (2026-09-28, late night)

> **What this is:** the pick-up point for a session that starts cold, written at the user's word
> (*"make a handoff to pick up in new"*). It is retired when what it hands over is done. The next
> BUILD in the order is **Session 0 — the classes** (BACKLOG *The long-term order*, row 5), but it is
> gated on the user: the party's actual kit one level band ahead of play, never the corpus blind.
> **Do nothing until the user says go, and do not re-ask about the walks or the release.**

## State

- **Prod is v2.6.0** (the refactor). Main is **33cd6b2**, pushed, clean tree, world settings CLEAN.
- **UNRELEASED on main since v2.6.0**, in order: the review fix pass (c941553), the spells slice end to end
  (Tiers 1–4, `audits/spells-register.md`), the DMG register (`audits/dmg-register.md`, the DMG RULED OUT),
  and **Slice B — the GM's side**, delivered 2026-09-28 night in three commits: Stage 1 7a06c7f, Stage 2
  b0fe20e, Stage 3 33cd6b2 (RULINGS *The GM's side — the five shapes*, *— the aura rows and the attack
  bends*, *— the reaction rows*).
- **UNWALKED, by the user's mode** (rapid deployment, 2026-09-28: build, prove with the suites, push; every
  walk deferred to be walked together later): Tiers 1–4 of the spells slice (`tools/content/place-spells-walk.mjs`,
  the four RULINGS tables) and Slice B's three walk tables (each RULINGS section carries one).
- **The release** goes out only on the user's word: the full battery (`node tools/battery.mjs`, ~30 suites,
  the sandbox deployed first) is the floor, then a pushed annotated tag — CI builds and publishes the zip
  (`.github/workflows/release.yml`, `tools/build-release.mjs`). Nothing is owed until the word.

## What Slice B settled (do not re-open)

| Finding | Where |
| --- | --- |
| Legendary Resistance is NATIVE — dnd5e's `resistSave` button on the failed save, the saves machine's `forced` flip; no row, never a second entry path | registry.js `SAVE_SUCCEEDS` doc; RULINGS *the five shapes* |
| `EVASION` is the table `EVASIONS` (Evasion on Dexterity, Avoidance on every save; the entry stamps `evasionBy`) | `saves/consequences.js`, `decide/verdict.js` |
| The lists were retired 2026-09-27: a new row is simply on; verify-settings carries no list defaults | RULINGS *The settings* |
| New vocabulary: `DROP_TO_ONE` `save` and `on: "died"`; `EMANATIONS` `trigger.on: "turnStart"` and `trigger.types`; `EFFECT_BENDS` `judge: "notIncapacitated"`; `INTERRUPT_REDUCTIONS` `ranged`; `REBUKES` `on: "miss"`, `types`, `self`; `TURN_GRANTS` `match: "feature"`, `while`, `unless.damagedBy`; the table `REACTION_RESETS` | ARCHITECTURE §the GM's side table |
| Fiendish Blood, Redirect Attack, the cast-triggered seven, Eye Rays, Divine Beam: the register's, not owed; Arcana Unleashed's bestiary out | RULINGS *the reaction rows* |

## The box (the local sandbox, Foundry 14 / dnd5e 6.0.5)

- **BF Test Monster** is a fixture (`tools/fixture-suite.mjs`): a bare GM NPC, 50 HP, Con 14, `legres` 3, its
  token at (1300, 1000) on the range; suites lend Monster Manual traits by name from
  `dnd-monster-manual.features` per section and take them back. The fixture resets it every run.
- Suites touched this session: `smoke-drop` §6–§9, `smoke-saves` §31, `smoke-spells` §9, `smoke-emanations`
  §24–§25, `smoke-goliath` §6–§8. Unit tests: `tests/decide-slice-b.test.js`.
- ⚠ Lessons that cost time: a token update mixing position and `disposition` is dropped — two updates;
  `tokenForUuid` finds the FIRST token of an actor — move the other creature, never place a second Monster
  token; a stale ACTIVE combat on the box fails "out of combat" sections — list `game.combats` and delete
  strays; the Victim's fixture token wanders under walks — place your own beside the corpse; a stray
  "Gren" token sits at (1300, 1000) on the range (a walk's), harmless.
- After any run: `node tools/verify-settings.mjs` (the scenes' `noCover` flags drift under the cover suite;
  `--fix` restores).

## Next — the user's call, in this order of likelihood

1. **The release** (the user's word): deploy `--local`, the full battery, `npm run verify`, bump
   (`tools/bump-version.mjs`), an annotated tag pushed — CI publishes. Prod is never touched by hand.
2. **The walks**, when the mode changes back: the spells slice's four tiers, then Slice B's three tables.
3. **Session 0 — the classes** ([audits/drawings/classes.md](audits/drawings/classes.md)): the party's kit one
   band ahead; the shapes with three or more customers are tables (the reroll kind first, with its first
   customer); the UI-shaped items ruled off a prototype before a line ([prototypes/](prototypes/)).

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in
  the same commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`.
- A change runs its own suites (`node tools/battery.mjs --changed --list`, then the feature's own — a FULL
  verdict for a feature still means its own suites); deploy `--local` first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; ⚠ heredocs mangle
  backslashes and quotes — write edit scripts to a file.
