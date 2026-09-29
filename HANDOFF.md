# HANDOFF.md — the PHB classes: A1 proven, A2 built (2026-09-29, midday)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **Pushed:** see `git log origin/main` — the push of A3 + A1 happens when the A1 regression battery below is green
  (`git push origin 60865f5:main`: A1's commit and everything under it; **A2 stays local** until its own suite is green).
  If this file still says "battery running", check it first.
- **The A1 regression battery** (the touched machines' own suites + smoke-classes): `dist/battery/2026-09-29T15-35-53/`,
  launched ~11:35 local, testing the deployed A1 code (`60865f5`; A2 is NOT deployed). Green → push as above, then
  `node tools/verify-settings.mjs`. A red → read the suite's file, fix, `--local` deploy, re-run that suite.
- **Local, unpushed:** `3a1d7a7` A2 (1 of 2) — built, unit-tested (tests/decide-classes-a2.test.js, 12), verify green,
  **no live suite yet**.

## Done today (this session)

1. **The A3 battery** finished 46/47: smoke-emanations 20a was a race (the Wall of Fire's band flag and its widened
   shape written in two updates) — fixed in `faf2011` (one update), re-run 115/115; probe-effect-view's 3 reds did not
   reproduce alone (17/17). The `noCover` scene drift was a teardown cut off mid-loop — the harness now sets and clears
   the lever in one batched write (`96c7b25`).
2. **A1's live proof** — `smoke-classes` §13–27 (fifteen sections, drafted by four agents, integrated and debugged):
   **100/100** on the full suite. It found one real defect: Rage of the Wilds' Wolf activity asked the pick again on
   its own card (`polish.js` `castChoice` — an `on` row now asks at the `on` item's use only). Suite lessons:
   `popups()` must skip `ui`'s singletons (a text-matching close once shut the CHAT LOG) but keep `ui.activeWindow`;
   dnd5e 6 keeps a message's targets on `system.targets[].actor`; Eldritch Blast's volley applies after the last
   beam (no receipt to wait for); a ring member is named "Rage of the Wolf — <bearer>"; lend Monk's Focus with its
   compendium source stamped (the Redirect's consumption finds it by uuid); PC Attacker has no Barbarian scale (Frenzy's
   `@scale` pinned on the lent copy).
3. **A2 built** — RULINGS *The PHB classes — A2*: five calls the plan left open, **each the user's to overrule**
   (Monk's Focus one group of TWO picks; Open Hand Technique and Elemental Attunement FREE groups; the Flurry a turn
   chit; Stunning Strike's Slowed moved to the success at the SAVE via `SAVE_PRESSES` `success` — the sheet path was
   wrong too; Protective Field keyed by its item "Psionic Power"). Two bends registered. Register regenerated
   (99 NATIVE · 88 MODULE · 93 ROW · 7 TABLE · 5 KIND · 126 OUT · 1 WAITS).

## Next — in this order, each on the user's go

1. **Push A3 + A1** once the battery is green (above).
2. **A2's live proof** — deploy `--local`, write `smoke-classes` §28+ (the A1 pattern: each section lends its
   features and takes them back; `hgLend` stamps the compendium source — use it for anything whose consumption is by
   uuid: Monk's Focus, Hand of Harm, Stunning Strike). Priority: Stunning Strike (the save paid by its own use — ONE
   Focus Point spent, not two; Stunned on a failure, Slowed on a success — the `success` facet), Stunning Strike +
   Hand of Harm on one hit (two picks, two points), the once-per-turn grey in a combat, Open Hand Technique after
   Flurry of Blows (the `FLURRY` chit written at `dnd5e.postUseActivity`) and absent without it, Psionic Strike,
   Protective Field (self on any damage; an ally's attack damage within 30 ft; none left → never asked), Elemental
   Attunement on its own Elemental Strike only. The `@scale.monk.*` / `@scale.psi-warrior.*` formulas need a
   Monk / Psi Warrior scale the fixtures lack — pin the lent copy's formula as §17 does for Frenzy, or lend the class.
   Then the touched suites: smoke-hitmenu, smoke-maneuvers, smoke-goliath (Hill's Tumble), smoke-saves,
   smoke-superiority (Interception's guard), smoke-rescue, smoke-classes. Then push, HANDOFF → A4.
3. **Owed small:** a Legendary Resistance flip of a failed Stunning Strike lands no Slowed (`saves/verdict.js`).
4. **A4 → A7, B1 → B5, C1, D1** (the plan §3). A5 and A7 are spine stages (the full battery).
5. Then **the DMG**, then **the splat books**; **the prod deploy of v2.7.0** and **the walks** whenever the user says.

## The box (the local sandbox, Foundry 14 / dnd5e 6.0.5)

- Everything in the previous handoff still holds (the range's tokens below 2000 px can't be MOVED — delete and
  re-place; pinned d20 faces — assert totals; find effects by FLAG; another session's local5e bridge blocks suites).
- ⚠ A suite's own cleanup must never close by text over EVERY rendered app — the chat log is one.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (123) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (39).
- A change runs its own suites; a spine change is the full battery; deploy `--local` first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
