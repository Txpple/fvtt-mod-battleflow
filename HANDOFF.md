# HANDOFF.md — the PHB classes: B2 DONE, B3 in progress (2026-09-30)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **The A series is CLOSED** (`bf0163f`): its full battery went 41 of 46, every red a flake or a suite race, no module defect.
- **B2 BUILT and PROVEN** (this commit): the save bends by name — seven rows, no new kind (40), no new file (131). Suites:
  `smoke-saves` §32 10/10, `smoke-classes` §43 4/4 (Eldritch Strike), §44 6/6 (Beguiling Twist), §45 3/3 (Beguiling
  Defenses); unit 1195. The calls (RULINGS *The PHB classes — B2*, each the user's to overrule): a CASTER-side row is a
  facet (`side: "caster"`, the demand's caster SNAPSHOT); Mantle of Majesty is a Fails button; Eldritch Strike a clock
  rider + `spend: "save"`; Eldritch Hex six rows; Beguiling Twist's Reaction a bystander row (`bend: "twist"`, the ranger's
  TARGET, the failure by the ranger's word); **Beguiling Defenses is 2024's hit reaction** (halved + the attacker's save +
  psychic damage off the receipt), not the plan's 2014 charm reflection. Danger Sense native.
- **B3 measured** (`tools/probe-pack-shapes.mjs`): **Tactical Master is NATIVE** — dnd5e 6's attack dialog offers the mastery
  swap off `weaponProf.mastery.bonus` (`item.system.masteryOptions`, `rollConfig.mastery` → `msg.system.mastery`, which the
  mastery machine already resolves); Brutal Strike ships a damage activity (`@scale.barbarian.brutal-strike`, effect Hamstrung)
  and Improved two utility activities (Staggered, Sundered); Studied Attacks and Relentless are text only.
- **B1 BUILT and PROVEN** (a35c8c2): the `reroll` d20 fold (R4 tripwire 39 → 40; `REROLLS`: Indomitable, Fanatical
  Focus) and Countercharm as a bystander row (`INTERRUPT_ROLLS` `bend: "reroll"`). No new file (131). Suites:
  `smoke-d20-folds` 96/96, `smoke-saves` 137/137 (`dist/battery/2026-09-30T13-00-06`), `smoke-classes` §42 4/4 and the
  full suite after the §25 fix below (`dist/battery/2026-09-30T14-52-54`).
- **The calls made in B1** (each the user's to overrule; all in RULINGS *The PHB classes — B1*): `reroll` IS a kind;
  Indomitable's use written off by the fold (the pack's activity consumes nothing); Fanatical Focus's once a mark on the
  RAGE effect (`rerollUsed`); **Countercharm is the bystander's row, not a fold row** (the closer precedent — A3's
  machine already had the ally-within-30-ft, the Reaction, the withhold and the popup); the `tests` facet on the
  `tactical` spend waits for its first customer (Dark One's Own Luck, B4).

## Suite lessons (keep them)

- ⚠ **A moment popup CLOSES on any button** (DialogV2): an answer the machine refuses (Beguiling Twist with no target) must ask
  again (`setTimeout(showPopup)`), or the roll stays held with nobody to answer. The suite re-finds the popup after a refusal.
- **Out of a combat**: no Reaction chip is written (B1's lesson, again), and a `rounds` clock lands as SECONDS (the vex window
  reads `seconds: 6`, `expiry: "turnEnd"`); a pressed status's `lasts` reads `seconds: 60`. A card names the TOKEN, not the actor.

- ⚠ **smoke-classes §25 → §28 cascade (2026-09-30, 44 reds twice, NO module defect):** the sandbox's ACTIVE scene was
  "Bramblemaw's Lair", not the range; §25 activated the range for its ring, re-activated the Lair and re-viewed the range
  — the redraw destroyed every Token placeable the suite held, so every later control()/setTarget() was a no-op and the
  attacks were refused with no target. Fixed in the suite: the prior active scene is restored ONCE, in the teardown
  (`priorActiveScene`). A suite that switches scenes mid-run must re-resolve its placeables or not switch.

- A save rolled from the SHEET has no DC, so after any spend it is "still failing" and every other fold is RE-OFFERED:
  wait for the spend's `pendingVerdict` to clear, never for the flag to resolve, then Pass the re-offer.
- `--section` takes ONE section (the last wins): run §12 and §13 as two invocations, or the whole suite.
- A bystander test that asserts the Reaction needs a COMBAT (out of one no Reaction chip is written); §42 makes its own.
- The pack's Fanatical Focus carries nothing: its bonus is pinned for a suite by ADDING an activity whose roll is the
  number (`system.activities.<id>`), the row's `bonus` formula being unreadable on a non-Barbarian (and the fold
  stays off — assert that first).
- The classes-register's Countercharm verdict lives in `audits/drawings/classes.md` *Register verdicts*; regenerate
  with `node tools/audit-classes-register.mjs --out audits/classes-register.md --plan audits/plans/session-0-classes.md`.
- (from the A series) `popups()` skips `ui`'s singletons; dnd5e 6: a message's targets are `system.targets[].actor`;
  pin a d20 face by `CONFIG.Dice.randomUniform` (`faces([[n, 20]])`) or the term's `randomFace`; created embedded
  documents do NOT come back in the order asked; a section pins the settings it needs; a moments-scan `[CONST]` key
  resolves across every file.

## Next — in this order, each on the user's go

1. **B3** (Brutal Strike's forgo box + hit-menu group, Studied Attacks' miss chip, Relentless' d8; Tactical Master native)
   → **B4** → **B5** (the full battery after B5), **C1** (full), **D1** (full) — the plan is audits/plans/session-0-classes.md.
2. **Owed small:** Physician's Touch's Poisoned is B4's. (Done 2026-09-30: the Legendary Resistance flip now lands the
   `success` effects — Stunning Strike's Slowed — `saves/verdict.js` + `applySaveEffects({ successOnly })`, §28 asserts it;
   the a2-live worktree was already gone.)
3. Then **the DMG**, then **the splat books**; **the prod deploy** (v2.7.0 + everything since) and **the walks**
   whenever the user says.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (131) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (40) and the count in `tests/decide-registry.test.js`.
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy `--local`
  first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
