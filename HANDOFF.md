# HANDOFF.md — the PHB classes: C1 PROVEN, the full battery RUNNING (2026-09-30, night)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.** The user's standing word for this
> stage (2026-09-30): *"go with c working autonomously and do the full battery when done"*.

## FIRST — the state

- **C1 is BUILT and its suites are PROVEN**: all 28 `smoke-classes` sections §64–§91 green on the sandbox, one group at a
  time (c81a02b, f5f3a34, beab835 on top of 5e84312). `npm run verify` GREEN (1237 unit tests).
- **Six defects found by the suites and fixed** (all in those three commits): Superior Hunter's Defense halved twice (the
  answer applied all thirteen typed Resistances; the one typed effect now lands AFTER the share, both paths); Smite of
  Protection never landed (a 15-character effect id); Peerless Skill's offer showed `@scale.bard.inspiration`; the
  Unbreakable Majesty `DUPLICATES` row was never written (the machine, the rulings and the register said BUILT); its
  once-per-turn stamp was keyed by a dotted uuid (expanded into nested flag keys — `recoilKey` folds the dots); a bearer
  ring's behaviour wrote a null source (a placeable Token has no uuid, its document does).
- **The full battery was launched DETACHED at the end of that session** (`dist/battery-c1.log` / `.err`; the run
  directory under `dist/battery/`). Read it with `node tools/battery-status.mjs`. If it is not finished or not green:
  a red of the timing class (`smoke-saves` §32 (g), the B-series red) becomes a BACKLOG row if it repeats; any other
  red is a defect or a suite-shape red (see the lessons) — fix, run that suite alone, and rerun the battery only if a
  machine changed. **After any kill**: delete every combat on the box, `verify-settings --fix` → `reset-fixture-state`
  → `scrub-fixture-residue` → `fixture-suite`.
- **Then D1** (audits/plans/session-0-classes.md), in a new session, on the user's go. Nothing released: prod is v2.8.0.

## Suite lessons (keep them)

- ⚠ **The range is 2000 × 2000 and the suite's main row (y 2100) is OFF the scene**: Foundry refuses any move onto
  y ≥ 2000 (the update returns undefined, nothing moves, no error). Nobody can be moved beside the Attacker, the
  Halfling, the Bard or the Sorcerer; moves go on the north rows (y ≤ 1900), or a section uses creatures already
  adjacent (the Sorcerer is 5 ft from the Bard).
- **A PROMPT-mode save never settles its promise once its dialog is closed**: bound the wait (`Promise.race`), never
  `await p` bare — a 25-minute hang. The demand opens each target's own roll dialog; a bare `rollSavingThrow` is a
  second, unlinked roll (no `respondsTo`, the entry never folds) — find the target's dialog and click its button.
- **The hand-out popup's rows are checkboxes under a cap**: untick the default by a click, tick the pick by a click
  (`checked = true` + a change event leaves the default standing).
- **A region lands before its behaviour and its `initial` record**: wait for the adopted ring, not the bare one.
- **A flag key with dots expands into nested objects** (`setFlag(..., { [uuid]: x })`): key by a folded uuid.
- **A copied effect's `_id` must be 16 characters** (`bfSmiteOfProt000`, `bfTypedRes` + 6): the platform refuses 15.
- **Answering a hold applies EVERY effect on the reaction's activity** (`applyReactionEffect`): a row whose pack
  activity carries one effect per damage type must apply nothing there and land its one effect with the share.
- **The goblin's weapon rolls ONE damage die** (8 with a pinned 6, 1d6+2); a save demand's damage die rolls BEFORE the
  save (pin `[d8], [d20]`); the damage hold's popup says "may reduce N damage", the card "about to take".
- (from C1's first half) Lucky on the Halfling hides from `lucky()` when its uses maximum is a formula — spend it by
  NAME (`spendLuckC`); a lent copy's rider uses are spent by the first ride; a summon's origin must stay resolvable;
  match the innermost row, never the card; heredoc edits mangle backslashes — a Python edit goes in a scratchpad FILE.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (131) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (40) and the count in `tests/decide-registry.test.js`.
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy
  `--local` first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
