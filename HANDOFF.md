# HANDOFF.md — the PHB classes: B4 DONE, next B5 (2026-09-30)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **The table is renamed** (da98706, the user: *"rename it now i hate deferred maintenance"*): `FIGHTING_STYLES` is
  **`DAMAGE_RULES`** — `scripts/damage-rules.js`, `scripts/decide/damage-rules.js`, `tests/decide-damage-rules.test.js`,
  `tools/smoke-damage-rules.mjs`, `prototypes/damage-rules.html`. The face flag `fightingStyle` stays (persisted data).
- **B4 BUILT and PROVEN** (this commit): thirty rows on tables that exist — **no new kind (40), no new file (131)**. Suites:
  `smoke-classes` §50–§63 (§50 6/6, §51 4/4, §52 4/4, §53 4/4, §54 4/4, §55 5/5, §56 3/3, §57 2/2, §58 1/1, §59 4/4, §60 3/3, §61 5/5, §62 2/2, §63 8/8 — 55 checks, each section run alone on the sandbox 2026-09-30; one module defect found by them (the effect ward's name carries its count) and fixed); unit 1232. The calls (RULINGS *The PHB classes — B4*, each the user's
  to overrule): the spell-damage bonuses ride ONE roll of the spell (`spellRuleFits`); Eldritch Smite's Pact slot is a
  `poolOf` branch with NO picker (every Pact slot is one level — the plan's picker had nothing to pick); the pact weapon is
  Pact of the Blade's bond, none bonded → any weapon with the caveat; Bend Luck's sign follows the side; Cosmic Omen's d6 is
  a stored chip whose parity is the sign; Dark One's Own Luck and Homing Strikes are `tactical` folds with their own tests
  (`TACTICAL_FOLDS`); Tandem Footwork rolls once and notes late rollers on the combat; Heroic Warrior writes, Guarded Mind /
  Self-Restoration / Physician's Touch's heal OFFER a condition's end (`conditionEnd`); Telekinetic Thrust a `follow`,
  Physician's Poisoned an `also`; Lifedrinker's heal offered on the card; Blessed Healer its own card; Improved Warding
  Flare's temp HP with the Flare; Bastion of Law's pool on the effect; Projected Ward a guard on any damage; Gift of the
  Protectors reads the warlock's page; Multiattack Defense a chip on the ranger with a negative `plus`; Escape the Horde the
  gate's `opportunity` judge; Misty Escape a self rebuke with `follow`; Sculpt Spells rides Careful's ask as a free row.
- **Four platform bends registered** (RULINGS *Where the table bends the rule*): Cosmic Omen after the roll; Multiattack
  Defense counts the hits the module saw; Misty Escape only when the damage names its dealer; the pact weapon unbonded.
- **B3 BUILT and PROVEN** (060001f): Brutal Strike's forgo and group, Studied Attacks' miss chip, Relentless' d8; Tactical
  Master NATIVE. **B2** (2f9ace5), **B1** (a35c8c2), **the A series CLOSED** (bf0163f) — see RULINGS for each.

## Suite lessons (keep them)

- ⚠ **Heredoc edits mangle backslashes** (the memory rule, hit again 2026-09-30): a Python or perl edit with a `\'` or a
  regex goes in a FILE in the scratchpad, never a bash heredoc. The suite file is LF; a title with an apostrophe must be
  escaped `\'` inside the `SECTIONS` map.
- **`then` is not a property name**: biome's `noThenProperty` refuses it (a thenable); a follow-up facet is `follow`.
- **`_source.abilities` is not a safe read** on a fixture: keep the prepared score (`actor.system.abilities.wis.value`).
- **The Pact slots are DERIVED** (`system.spells.pact.max` / `.level` from the class): a suite lends a Warlock class
  (`hgLend(actor, 'Warlock', 'class', { 'system.levels': 5 })`) and sets `pact.value` only.
- **A pool spend lands AFTER the answer resolves**: `await sleep(900)` before reading the uses (Bend Luck's Sorcery Point).
- **A friend's miss needs the FRIEND's modifier**: the Victim's AC for the PC Attacker's miss is `modOf(pcAttacker, pcWeapon) + N`,
  never `atkMod` (the hostile Attacker's).
- **A tactical fold's label**: `KIND_LABEL` says "Tactical Mind" for every `tactical` entry; a feature's own row
  (`TACTICAL_FOLDS`) and a maneuver's scope label with the feature's name — assert `o.name`, not the label.
- **The condition labels**: `CONFIG.DND5E.conditionTypes[k].label` may read as a key or lower-case on the box; title-case
  the key when it does.
- (from B3) the attack dialog in a suite: `activity.rollAttack({}, {}, {})` (a promise), `waitFor(rollDialog)`, click the box,
  then `button[data-action="normal"]`; a moment popup CLOSES on any button (DialogV2); out of a combat no Reaction chip is
  written and a `rounds` clock lands as SECONDS; a suite that switches scenes mid-run must re-resolve its placeables or not
  switch (§25's cascade); `--section` takes ONE section.

## Next — in this order, each on the user's go

1. **B5** (band B emanation rows — the plan's §3, ≈ ½ session) → **the full battery after B5** (the letter-series cadence) →
   **C1** (full) → **D1** (full). The plan is audits/plans/session-0-classes.md.
2. Then **the DMG**, then **the splat books**; **the prod deploy** (v2.7.0 + everything since) and **the walks** whenever the
   user says.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (131) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (40) and the count in `tests/decide-registry.test.js`.
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy `--local`
  first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
