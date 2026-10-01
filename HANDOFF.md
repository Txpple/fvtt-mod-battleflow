# HANDOFF.md — C1 proven, the battery run, the release of v2.9.0 OWED (2026-10-01, late night)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.** The user's standing word (2026-10-01):
> *"when you are done go"* — once the proofs below are green, the release chain runs WITHOUT checking back.

## FIRST — the state

- **C1 is BUILT and PROVEN** (28/28 `smoke-classes` sections in groups; six defects fixed — see the git log from
  c81a02b to beab835). `npm run verify` GREEN (1237). **Nothing released: prod is v2.8.0.**
- **The full battery ran** (`dist/battery/2026-10-01T01-12-35`, 80 min): 43 of 47 green, 1911/1919 checks, settings
  clean. The four reds and where each stands:
  - `smoke-metamagic` 108/109 — box RESIDUE (four lent Spell Resistance on the Sorcerer from a killed §83 run). Scrubbed;
    **109/109 solo** ✅.
  - `smoke-drop` 17/19 — SUITE SHAPE (the popup now says "drop to 1 Hit Point instead" since C1). Matcher fixed;
    **19/19 solo** ✅.
  - `smoke-classes` 315/319 — four ORDER reds. §61/§67 fixed and green (§61's teardown dropped one ward pool of
    many; §67's goblin has 11 HP, the burst clamps at 0). **Two REPEAT in a full solo run (316/319)** and pass in
    small groups: **§81a/b** (Perfect Focus's fallback null on Uncanny Metabolism's card; green in 72–81 as a group,
    so the state comes from §64–§71) and **§90c** (the Oceanic Gift pick raises no demand; green in 88–90; untested
    82–90). **Bisect next**: `--section 64,65,66,67,68,69,70,71,81` and `--section 82,83,84,85,86,87,88,89,90`.
  - `smoke-saves` 146/147 — the TIMING-CLASS red, §32: the save demand's dialog sometimes never shows within 12 s
    (f, then g, then h in three runs — it moves). The 6 s waits became 12 s and `castAt` waits for the previous
    dialog to be gone — **NOT ENOUGH (145/147 solo)**. §32's `dialogFor` now LOGS on a miss (the demand's status,
    the open apps): run `node tools/smoke-saves.mjs --section 32` until it misses and read the `§32 no dialog` line.
    If it is a real race in the module's prompt-mode demand (the dialog for a target already asked this section), it
    is a defect; if the dialog is there under another shape, a suite fix.
- **Then the release — v2.9.0** (the version frame: a minor per letter series), per tools/README.md *The release*:
  commit, `bump-version.mjs minor`, a `release v2.9.0: the PHB classes, band C` commit, `build-release.mjs --tag v2.9.0`
  dry run, an ANNOTATED tag with hand-written notes (the C1 rows, the six fixes, the suite lessons), push main then
  the tag (CI publishes), `deploy-house-module.mjs fvtt-mod-battleflow --check` on prod (an all-identical hash is a
  half-awake box), then the deploy, `verify-settings`; the process restart is the user's. ⚠ In auto mode the
  classifier has refused prod deploys: offer the command.
- **Then the DMG's rules chapters**: `node tools/scan-dmg-rules.mjs` (new, unrun — lists every DMG journal page with
  a mechanism word) → the rows worth a register section → regenerate `audits/dmg-register.md` (needs a DMG corpus
  scan: `scan-corpus.mjs` ~12 min, its dispose HANGS after writing — kill it) so the four corrected hand verdicts
  (RULINGS *The DMG register*, RE-REVIEWED) land. **Then D1** on the user's go.
- **After any kill**: delete every combat on the box, `verify-settings --fix` → `reset-fixture-state` →
  `scrub-fixture-residue` → `fixture-suite`. The scrub now removes orphaned effects (31 Mage Armors stood on the
  Sorcerer), ward pools, same-name duplicate PHB items and the STRAY_LENDS list — ⚠ never a CLASS item: it stripped
  the Paladin fixture's class once (rebuilt from spec by deleting the actor and running fixture-suite).

## Suite lessons (keep them)

- ⚠ **The range is 2000 × 2000 and the suite's main row (y 2100) is OFF the scene**: Foundry refuses any move onto
  y ≥ 2000 (the update returns undefined, nothing moves). Moves go on the north rows, or a section uses creatures
  already adjacent (the Sorcerer is 5 ft from the Bard).
- **A PROMPT-mode save never settles its promise once its dialog is closed**: bound the wait. The demand opens each
  target's own roll dialog; a bare `rollSavingThrow` is a second, unlinked roll — click the target's dialog.
- **A PowerShell `>` redirect writes UTF-16**: `iconv -f UTF-16LE` before grep; a Monitor on it stays silent.
- **A lent spell's effect outlives the lend** (Mage Armor on the caster): the teardown drops the effect too.
- **The hand-out popup's rows are checkboxes under a cap**: untick by a click, tick by a click.
- **A region lands before its behaviour and its `initial` record**: wait for the adopted ring.
- **A flag key with dots expands into nested objects**; **a copied effect's `_id` must be 16 characters**;
  **answering a hold applies EVERY effect on the reaction's activity**; **the goblin's weapon rolls ONE die**; a save
  demand's damage die rolls BEFORE the save.
- (from C1's first half) Lucky by NAME (`spendLuckC`); a lent copy's rider uses are spent by the first ride; a summon's
  origin must stay resolvable; match the innermost row; heredoc edits mangle backslashes — a Python edit goes in a FILE.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (40) and the count in `tests/decide-registry.test.js`.
- A change runs its own suites; deploy `--local` first; launch batteries detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
