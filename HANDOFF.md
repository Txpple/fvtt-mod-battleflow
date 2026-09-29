# HANDOFF.md — the PHB classes, A3 built, the battery owed (2026-09-29, midday)

> **What this is:** the pick-up point for a session that starts cold (the user, low on context: *"get ready for a
> handoff"*). It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the one thing in flight

⚠⚠ **NO `--local` DEPLOY AND NO LIVE SUITE until the battery below has FINISHED** (its run directory holds a file
for `smoke-nogm`, the last row, or the old session's log ends with the battery's summary). Deploying mid-run changes the
code under test and poisons the push gate. Until then: offline work only — A1's code, unit tests, `npm run verify`,
docs, commits (the user, 2026-09-29: start A1 in the new session while the battery runs).

**A3 is committed LOCALLY, NOT PUSHED** — `98ebef8` + `25bceeb` on `main`, ahead of `origin/main` by two. A3 touches the
spine (the hold, `auto-apply.js`, `auto-damage.js`, `shared.js`, the save seam), so **the FULL battery is the push gate**.
A battery was launched 2026-09-29 13:28 UTC (09:28 local) from the old session: `dist/battery/2026-09-29T13-28-46/`
(one file per suite; the log in the old session's scratchpad). **Read that run directory first:**
- if it finished all green (46 suites + smoke-classes = 47): `git push`, then `node tools/verify-settings.mjs`;
- if it was killed or is incomplete: `node tools/verify-settings.mjs --fix`, `node tools/reset-fixture-state.mjs`,
  `node tools/fixture-suite.mjs`, then re-run (`node tools/battery.mjs`, detached, `--from <suite>` to resume);
- a red: read the suite's file (failures print in the body), fix, `npm run verify`, `--local` deploy
  (`node ../fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local`), re-run that suite, then the battery.

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
2. **A1** (plan §3, 14 rows — Rage's early-end reminder, Frenzy, Rage of the Wilds, Combat Inspiration, War Priest,
   Starry Form, Hunter's Prey, Tides of Chaos, Dark One's Blessing, Repelling Blast, Commanding Presence + M0's three:
   Sacred Weapon's light, Deflect Attacks' redirect, Glorious Defense's strike). Its own suites, then push.
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
  `tools/check-registry.mjs`'s source-file pin (123 now) and joins `tools/check-layers.mjs`, `scripts/dispatch.js`
  and `scripts/battleflow.js`; a new kind moves `EXPECTED_KINDS` (39 now).
- A change runs its own suites (`node tools/battery.mjs --changed --list`, then the feature's own — a FULL verdict for
  a feature still means its own suites); a spine change is the full battery; deploy `--local` first; launch detached;
  after a kill: `verify-settings --fix`, `reset-fixture-state`, `fixture-suite`.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- A feature suite may not claim a SPINE file in `COVERS` (verify fails): the full battery covers the spine.
