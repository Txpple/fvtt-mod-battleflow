# HANDOFF.md — the PHB classes: the B series CLOSED, next C1 (2026-09-30)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **The B series is CLOSED**: B1 (a35c8c2), B2 (2f9ace5), B3 (060001f), B4 (d05607e), **B5 (c86a592)** — the four band-B
  emanation rows (Branches of the Tree = Unnerving Gaze's alert `while: "Rage"`; Inspiring Movement = Reactive Strike's
  alert with the new cause `turnEnd`; Wrath of the Sea = Inner Radiance's ring with a `pick` instead of a pulse — the
  turn-start card asks which creature inside, the pick demands the pack's "Bonus Action Save" once per turn, keys
  `emanationPick` + `emanationPickChoice`; Aura of Devotion = Aura of Courage's row). RULINGS *The PHB classes — B5*.
- **The B-series full battery ran 2026-09-30 evening on c86a592: 46/47 suites, 1900/1901 checks.** The one red,
  `smoke-saves` §32 (g), is the timing class NOTES §5 records (*"some sections fail inside the battery and pass
  alone"*): a save popup or the demand's `saves` flag arriving after the suite's wait, the failing check moving
  (32f / 32g / 32j) between runs alone straight after a deploy, then **green 3/3 alone** on the same bytes. Bisects by
  row contradicted each other (no rows: pass; Wrath+Devotion only: pass; Branches only: fail; all four: fail, then
  pass ×3) — not a B5 defect; a BACKLOG candidate if it repeats in the C1 battery.
- **v2.8.0** — the release commit after this file's cut: the whole Session 0 A and B series, the Monster Manual rows,
  the spells slice and the GM's side since v2.7.0 (which was released on GitHub but never deployed). The prod deploy
  is on the user's word of 2026-09-30 (*"push/release to prod"*) — see the last message of that session, or
  `FOUNDRY_HOST=molten node ../fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs fvtt-mod-battleflow --check` to read
  where prod stands (an all-identical hash = a half-awake box; wake it with get-world-info first).
- **A battery status update is the progress bar**: `node tools/battery-status.mjs` (the user's rule, 2026-09-30;
  NOTES §5, tools/README *The progress bar*). Never a paragraph.
- ⚠ **Launch a battery DETACHED** — `Start-Process node -ArgumentList "tools/battery.mjs" -RedirectStandardOutput <log>`
  from PowerShell; the Bash tool's 10-minute cap KILLS a battery mid-suite, and a killed suite leaves a COMBAT behind that
  `reset-fixture-state` does not sweep (2026-09-30: `smoke-battleflow` 3b/3c red on "a combat was running"). After any
  kill: delete every combat on the box (a one-off harness script: `for (const c of [...game.combats]) await c.delete()`),
  then `verify-settings --fix` → `reset-fixture-state` → `fixture-suite`.

## Suite lessons (keep them)

- **Wait for the ring's BEHAVIOUR, not the region**: `featureRegion(tok, key)` returns the region a beat before
  `adoptRegion` attaches the behaviour — assert `r.behaviors.find(b => b.type === TYPE)` in the `waitFor` (§24's shape).
- **The DC on a pack save activity is the activity's own** (`activity.save.dc.value`, calculation "spellcasting" —
  14 on the Cleric lent the Druid class), never `system.attributes.spell.dc`.
- **A lent class + subclass computes the scale**: `hgLend(cleric, 'Druid', 'class', { 'system.levels': 3 })` then
  `'Circle of the Sea', 'subclass'` gives `@scale.sea.wrath-range = 5` on the roll data.
- **A pick button by DOM**: `[data-message-id="<card>"] [data-bf-emanation-pick="<tokenId>"]`, the GM answering for
  the bearer; the fold by hand (`setFlag` with `picked`) is the fallback.
- (from B4) heredoc edits mangle backslashes — a Python edit goes in a scratchpad FILE; `then` is not a property name
  (`follow`); `_source.abilities` is not a safe read; the Pact slots are derived; a pool spend lands after the answer;
  a friend's miss needs the FRIEND's modifier; `KIND_LABEL` says "Tactical Mind" for every tactical entry — assert
  `o.name`; condition labels may read as keys; the attack dialog in a suite: `rollAttack({}, {}, {})` then the box.

## Next — in this order, each on the user's go

1. **C1** (band C rows — the plan's §3, 28 rows, ≈ 1½ sessions; the register's `C1`) → **the full battery after
   C1** (the letter-series cadence; launched DETACHED, watched with the bar) → **D1** (full) → its battery. The plan is
   audits/plans/session-0-classes.md; each row names its precedent there.
2. Then **the DMG**, then **the splat books**; **the walks** whenever the user says.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (131) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (40) and the count in `tests/decide-registry.test.js`.
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy
  `--local` first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
