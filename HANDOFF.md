# HANDOFF.md — the PHB classes: A2 pushed, A4 built (2026-09-29, evening)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **A4 BUILT, 2 commits LOCAL** (`20739b1`, `844daa1`; RULINGS *The PHB classes — A4*): Disciple of Life, Potent
  Cantrip (the save half AND the attack half — a missed cantrip still deals half), Psychic Spells; `smoke-classes`
  §32–35 green. The attack half touched the spine (auto-damage, auto-apply, lookup): **the FULL battery is the push
  gate** — if this file still says it is running, its output is the newest `dist/battery/` directory. Green →
  `git push`, then `node tools/verify-settings.mjs`. A red → read the suite's file, fix, `--local` deploy, re-run
  that suite, then `node tools/battery.mjs --from <it>`.
- **Pushed:** A3 + A1 on `origin/main` (`60865f5`, after a green regression battery: 18/18, settings clean).
- **PUSHED 2026-09-29:** A2 (`3a1d7a7` built, `a2bf9f4` the guard's words, `171b6b0` + `ee92df2` its live
  proof — `smoke-classes` §28–31 green) and the docs. **A2's regression battery** (smoke-hitmenu, smoke-maneuvers,
  smoke-goliath, smoke-saves, smoke-guards, smoke-superiority, smoke-rescue, smoke-classes) is the push gate — if this
  file still says it is running, its output is the newest `dist/battery/` directory. Green → `git push`, then
  `node tools/verify-settings.mjs`. A red → read the suite's file, fix, `--local` deploy, re-run that suite.
- **The worktree** `.claude/worktrees/a2-live` (branch `claude/a2-live`) was used for the A2 suite's drafting; `main`
  was fast-forwarded past it (the deploy script reads the main checkout only). It can be removed:
  `git worktree remove .claude/worktrees/a2-live` and `git branch -D claude/a2-live` (its commits are all on main).

## Done today

1. **The A3 battery** 46/47 → the emanations race fixed (`faf2011`), the harness's `noCover` lever batched
   (`96c7b25` — the drift is gone: the A1 battery ended "settings clean").
2. **A1's live proof** — `smoke-classes` §13–27, 100/100; Rage of the Wilds' second pick fixed (`polish.js`).
3. **A2** — RULINGS *The PHB classes — A2*: five calls the plan left open, **each the user's to overrule** (Monk's
   Focus ONE group of TWO picks; Open Hand Technique and Elemental Attunement FREE groups; the Flurry a turn chit;
   Stunning Strike's Slowed moved to the success at the SAVE — `SAVE_PRESSES` `success`, the sheet path too;
   Protective Field keyed by its item with the row's `label` / `verb`). Two bends registered. The suite found: an
   applied enchantment doubles its rider activities — the hit menu takes the usable copy (`usableNamed`).

## Suite lessons (smoke-classes, keep them)

- `popups()` skips `ui`'s singletons (a text-match close once shut the CHAT LOG) but keeps `ui.activeWindow`.
- dnd5e 6: a message's targets are `system.targets[].actor`; an enchant use with `configure: false` applies
  nothing — `activity.applyEnchantment(profileId, item, { chatMessage, strict: false })` (§23, §31).
- The fixtures lack class scales (`@scale.monk.*`, `@scale.psi-warrior.*`, `@scale.barbarian.*`): pin the lent
  copy's part (`pinPart`); lend anything consumed BY UUID with its compendium source stamped (`hgLend`).
- Out of combat no Reaction chip is written; the save's outcome is forced by pinning every die to 1 or 20.
- An ATTACK with no target is refused outright (polish.js) — a casting-window test must target someone.
- dnd5e 6: a spell's class is `system.sourceItem` ("class:warlock"), `classIdentifier` only with the class on the
  sheet. An attack's rescue on a character is Heroic Inspiration (`system.attributes.inspiration`); Lucky's d20
  is an initiative fold only.

## Next — in this order, each on the user's go

1. ~~Push A2~~ — DONE: its battery green (smoke-classes 119/119 after §25 put the canvas back on the range).
2. **Push A4** once its full battery is green (above). A4's three calls are the user's to overrule (RULINGS A4).
3. **A5 → A7, B1 → B5, C1, D1**. A5 and A7 are spine stages (the full battery).
4. **Owed small:** a Legendary Resistance flip of a failed Stunning Strike lands no Slowed (`saves/verdict.js`);
   Physician's Touch's Poisoned is B4's.
5. Then **the DMG**, then **the splat books**; **the prod deploy** (v2.7.0 + everything since) and **the walks**
   whenever the user says.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (123) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (39).
- A change runs its own suites; a spine change is the full battery; deploy `--local` first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
