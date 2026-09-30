# HANDOFF.md — the PHB classes: C1 BUILT, its suites HALF-PROVEN (2026-09-30, late)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.** The user's standing word for this
> stage (2026-09-30): *"go with c working autonomously and do the full battery when done"* — the battery is still owed.

## FIRST — the state

- **C1 is BUILT**: all thirty band-C rows (RULINGS *The PHB classes — C1*: the calls, the row table, the walk table;
  seven bends in *Where the table bends the rule*), the drawing's verdicts marked BUILT and the register regenerated,
  `npm run verify` GREEN (1236 unit tests). Two new tables that are not kinds (`CONCENTRATION_EXEMPTS`, `D20_FLOORS`),
  no new kind (40), no new file (131). Rage of the Gods was rebuilt off the pack's data (Revivification, a keeper row) —
  the register's "Protective Wings" was a misread.
- **The C1 suites — `smoke-classes` §64–§91 (28 sections) — are HALF-PROVEN on the sandbox**, run one group at a time
  (a run of all 28 hit the 25-minute watchdog and left the box dirty — the cleanup chain below was run):
  - GREEN alone: §64, §65, §66, §67, §68, §69, §70, §71, §74 (Relentless Rage, Undying Sentinel, Rage of the Gods,
    Searing Vengeance, Power of the Wilds, Lunar Form, Bestial Fury + Create Thrall, Superior Hunter's Prey, Versatile Trickster).
  - PATCHED, NOT RERUN: §72d (Mass Fear — the assertion now matches the pack's 10-ft Emanation of the ranger, everyone
    inside asked) and §73 (Superior Hunter's Defense — the hold opens the RESCUE window; `answerHold` ticks its row).
    §73c/d (the damage hold on a save's damage) had no hold at all in the last run — it may be a real defect in
    `damage-holds.js`'s multiplier branch (`anyReductionOf`), or a knock-on of §73a's unanswered hold: rerun §73 alone first.
  - NEVER RUN: §75–§91 (Trance of Order, Controlled Chaos, Smite of Protection, Soul of Vengeance, Peerless Skill,
    Disciplined Survivor, Perfect Focus, Greater Portent, Spell Resistance, Relentless Hunter, Hurl Through Hell,
    Improved Blessed Strikes, Battle Magic, Leading Evasion, Unbreakable Majesty, Oceanic Gift, the no-keeper death save).
  - **Run them in groups of 3–4 with `timeout 560 node tools/smoke-classes.mjs --section 75,76,77`** (the Bash cap is
    10 minutes); deploy `--local` first after any code change. Expect first-run reds of the suite-shape kind seen so far
    (a popup found by the wrong selector, a pinned face consumed by another die, a lent copy's uses spent) before a defect.
- **Then the full battery** (the letter-series cadence): launched DETACHED (`Start-Process node -ArgumentList
  "tools/battery.mjs" -RedirectStandardOutput <log>` from PowerShell), watched with `node tools/battery-status.mjs`;
  the B-series red (`smoke-saves` §32 (g), the timing class) becomes a BACKLOG row if it repeats. Then **D1**.
- **After any kill**: delete every combat on the box, `verify-settings --fix` → `reset-fixture-state` → `fixture-suite`
  (done once this session after the watchdog kill).

## Suite lessons (keep them)

- **Lucky on the Halfling hides from `lucky()`** when its uses maximum is a formula: the C1 block spends it by NAME
  (`spendLuckC`) or every drop is held for the rescue and never lands.
- **The goblin's weapon rolls ONE damage die**: a pinned face queue after the attack is `[d20], [d6], <the next roll>`.
- **A lent copy's rider uses are spent by the first ride** (Dreadful Strike on a lent Dread Ambusher): reset
  `system.uses.spent` (and the activity's) before a second hit in the same section.
- **A summon's origin must stay resolvable**: the Attacker's `flags.dnd5e.summon.origin` points at the lent Primal
  Companion's activity — unlending the companion mid-section un-summons it.
- **Match the innermost row**, never the card: a `div` whose text contains the label is the whole card.
- (from B4/B5) heredoc edits mangle backslashes — a Python edit goes in a scratchpad FILE; `then` is not a property
  name (`follow`); the pick button by DOM `[data-bf-emanation-pick="<tokenId>"]`.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (131) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (40) and the count in `tests/decide-registry.test.js`.
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy
  `--local` first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
