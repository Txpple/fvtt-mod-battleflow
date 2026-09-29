# HANDOFF.md — the PHB classes, A3 in its battery, A1 built (2026-09-29, late morning)

> **What this is:** the pick-up point for a session that starts cold (the user, low on context: *"get ready for a
> handoff"*). It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — two things in flight

⚠⚠ **NO `--local` DEPLOY AND NO LIVE SUITE until the A3 battery has FINISHED** (its run directory holds a file
for `smoke-nogm`, the last row). At the handoff (10:45 local) it stood at 34 of 47, every suite green so far.

1. **The A3 battery** — launched 2026-09-29 09:28 local from an earlier session: `dist/battery/2026-09-29T13-28-46/`.
   It tests A3 (`98ebef8` + `25bceeb`); A1 was committed AFTER it began and is NOT deployed, so the run is still A3's.
   - finished all green (46 suites + smoke-classes = 47): `git push` (A3 and A1 together are fine — A1 is verify-green,
     but its live proof is owed; push A3's gate only if the user prefers A1 held), then `node tools/verify-settings.mjs`;
   - killed or incomplete: `verify-settings --fix`, `reset-fixture-state`, `fixture-suite`, re-run (`--from <suite>`, detached);
   - a red: read the suite's file, fix, verify, `--local` deploy, re-run that suite, then the battery.
2. **A1 — BUILT, committed LOCALLY (`26f9154`), unit-tested, NO live suite yet.** All fourteen rows, the rulings, the
   bends, the register: RULINGS *The PHB classes — A1* (the table of what landed where, and the walk table). The user
   ruled two things mid-build: **Hunter's Prey's option is asked once and kept** (a `option` flag on the feature, the
   card's *Change* clears it); **Combat Inspiration's damage die is offered UNTICKED**. Read off the pack (the plan was
   wrong): the Rage's 2024 extension (attack roll / forced save, not damage taken); Dark One's Blessing also on an
   ally's kill within 10 ft; the Dragon's floor NATIVE; Starry Form's constellation is never recorded (asked at use).
   **Owed next, in order** (after the battery, once the box is free):
   a. `--local` deploy (`node ../fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local`, never piped to head);
   b. **write smoke-classes §13+ (§A1)** — the live proof. Priority by risk (new machine code): Glorious Defense's hit→miss→
      Strike popup and Combat Inspiration's Defense (hold/lookup.js `bystandersOf` hitSelf/reach/inspired, hold/answer.js);
      Deflect Attacks rolled + the Redirect card at 0 (hold/views.js `atZero`); Dark One's Blessing (heal-on-hit.js
      pre/applyDamage `falling`); the Rage reminder (turn-grants.js `remindExtend` — needs a combat and a turn change; the
      turn's start is recorded in memory on `updateCombat`); Starry Form's pick (Dragon Form only with Dragon; the Chalice
      chip; the Chalice card buttons, heal-rerolls.js); Rage of the Wilds' pick at the Rage + the Wolf ring's gate
      (EFFECT_BENDS `member`); Hunter's Prey's option ask on the damage offer + Colossus / Horde Breaker; Frenzy; Repelling
      Blast; Combat Inspiration's unticked offer row; War Priest; Sacred Weapon's light and its end; Tides of Chaos;
      Commanding Presence. Fixtures: the suite's own (Attacker, Halfling, Bard, Sorcerer, Cleric, PC Attacker, Victim);
      lend the PHB features by name (`lend`); there is no Barbarian/Warlock/Monk/Paladin/Druid fixture — lend to the PC
      Attacker or Cleric. Add the machine files to its `COVERS` (clock-riders, hew, heal-on-hit, turn-grants, cast,
      polish, heal-rerolls, emanations, reminders, token-lights, advantage-buys, d20-folds — all MACHINE tier);
   c. run it, then the existing suites of the touched machines: smoke-hold, smoke-twoclient, smoke-guards, smoke-rescue,
      smoke-clock, smoke-cast, smoke-emanations, smoke-reminders, smoke-d20-folds, smoke-heal, smoke-lucky,
      smoke-superiority, smoke-spells, smoke-aasimar, smoke-monsters (`battery.mjs --changed` says FULL because registry.js
      reaches the spine — by the standing rule a feature runs its own suites; hold/ changed, so include the hold family);
   d. push; HANDOFF → A2.
   Unverified guesses in the A1 code worth watching in the suite: a heal activity's `rollDamage` after `use()` (Chalice);
   `withTargets` around `use()` for the Redirect save; the `Rage` effect's `start` stamp on the turn it was entered.

## State

- **v2.7.0 RELEASED on GitHub; prod still v2.6.0** by the user's word (deploy later on their say-so — the chain in
  memory *Battleflow prod state*; WebDAV never prunes: check deleted files since v2.6.0).
- **The frame** (RULINGS *The full release — the order*): PHB, DMG, MM, then the splat books; the table's own need
  jumps the queue.
- **The PHB classes pass** — the plan [audits/plans/session-0-classes.md](audits/plans/session-0-classes.md), the
  register [audits/classes-register.md](audits/classes-register.md) (generated: `node tools/audit-classes-register.mjs
  --plan audits/plans/session-0-classes.md`; change the drawing [audits/drawings/classes.md](audits/drawings/classes.md),
  never the register). Now **99 NATIVE · 71 MODULE · 110 ROW · 7 TABLE · 5 KIND · 126 OUT · 1 WAITS**.
- **Done today:**
  1. **M0 measured** (32ed78d) — plan §3 *M0 — the answers*: five rows native, nine staged (three joined A1), the pools
     need no new `poolOf` shape; Arcane Ward's HP are the item's uses; Portent has no activity (a module flag at A7).
  2. **Q2's noise gate prototyped** as three measured options (d68c746; the prototype's group N, published at
     https://claude.ai/artifact/JAVoC3knLQjXeDvP9JoTb7) and **RULED: option A, Portent narrowed to saves and crits**
     (RULINGS *The full release — the order*).
  3. **A3 BUILT** (local, above) — RULINGS *The bystander's bend — built* (what, where, the walk table): Cutting Words,
     Guided Strike, Restore Balance on hits and misses (hold/), demanded saves and checks (new `scripts/bystanders.js`,
     files 123); the margin gate; the quiet road (a card row, on a hold that already stands, only on the bystander's
     client — the user asked mid-build that EVERY bystander get the card row + "Not this combat", not only Portent,
     without chat spam: built so); "Not this combat" (effect flag `bystanderMute`, only while a combat runs, swept at its
     end); `poolOf` finds a pool by the pack index's name on a sheet whose copy has no source (imported Bardic
     Inspiration). Suites: `smoke-classes` §1–12 (new, 30/30), `smoke-twoclient` §bystander (6/6). Five register rows +
     Restore Balance in *Bent by choice*.
- **UNWALKED by the user's mode** (rapid deployment): the spells slice, Slice B, the Monster Manual, and now A3.

## Next — in this order, each on the user's go

1. **The battery → push A3** (above).
2. **A1's live proof** (above, 2a–2d), then push.
3. **A2, A4 → A7, B1 → B5, C1, D1** (the plan §3). A5 and A7 are spine stages (the full battery). A7 carries Portent,
   narrowed to saves and critical hits (ruled). B4 carries Bend Luck and Cosmic Omen on A3's facets.
4. Then **the DMG** on its register, then **the splat books**.
5. **The prod deploy of v2.7.0** (and later releases) and **the walks** — whenever the user says.

## The box (the local sandbox, Foundry 14 / dnd5e 6.0.5)

- **BF Test Monster** (`tools/fixture-suite.mjs`) is lent traits by name; `smoke-classes` lends the PHB's class
  features the same way (Cutting Words → BF Test Bard, Restore Balance → BF Test Sorcerer, Guided Strike + Channel
  Divinity → BF Test Cleric, which carries no Channel Divinity of its own).
- ⚠ The range's tokens sit BELOW its 2000 px edge (y 2100): Foundry refuses to MOVE them — delete and re-place.
  ⚠ An unlinked token's actor is its own: roll an NPC's check from the TOKEN's actor, not the world actor.
- ⚠ The suites' pinned d20 (a 5) makes a d8 a 2 — assert totals, never faces. ⚠ A stray token sits inside the range's
  rings. ⚠ Find the module's effect copies by FLAG, never `_id`. ⚠ `hp.effectiveMax` under a `tempmax` effect.
  ⚠ `featureNamed` reads feats only — `itemNamed` for a weapon "trait".
- ⚠ The attack gate's reminder record exists only on the DIALOG path (`rollAttack` with a button event).
- ⚠ **Another open session's local5e MCP bridge blocks every suite's preflight** — `list_sessions`, `send_message` it to
  `disconnect-bridge`, retry; this session's own bridge is logged out after any read of the box.
- ⚠ A worktree has no `node_modules`: junction it to the repo's (`mklink /J node_modules ..\..\..\node_modules`) or
  `npm run verify`'s knip fails on unlisted binaries.
- ⚠ Never chain `git commit` after a `grep` pipeline; gate on `npm run verify`'s exit code. Heredocs mangle
  backslashes — edit scripts go in a file (the Edit tool is safe).
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).

## Ground rules (unchanged)

- Every row names its precedent (the register does); a platform-forced bend goes in RULINGS *Where the table bends
  the rule* in the same commit; a bend by choice in *Bent by choice*; a new flag key is classified in
  `decide/moments.js` and a new writing file pinned in `tools/moment-writers.mjs`; a new file bumps
  `tools/check-registry.mjs`'s source-file pin (123 now, A1 added none) and joins `tools/check-layers.mjs`, `scripts/dispatch.js`
  and `scripts/battleflow.js`; a new kind moves `EXPECTED_KINDS` (39 now).
- A change runs its own suites (`node tools/battery.mjs --changed --list`, then the feature's own — a FULL verdict for
  a feature still means its own suites); a spine change is the full battery; deploy `--local` first; launch detached;
  after a kill: `verify-settings --fix`, `reset-fixture-state`, `fixture-suite`.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- A feature suite may not claim a SPINE file in `COVERS` (verify fails): the full battery covers the spine.
