# HANDOFF.md — the overnight run of 2026-10-01: v2.9.0 on prod, D1 built, the DMG's cheap rows built

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **The user's brief (2026-09-30 night, autonomous):** fix the C1 battery's reds → release + prod; the DMG scan into a plan;
> D1 → battery → release + prod; the DMG's cheap rows → release + prod. **Rulings asked at the start:** the DMG scope is the
> cheap rows only; the DMG release stays 2.x (**3.0.0 is the user's to cut by hand**); another session's bridge blocking the
> suites may be killed.

## FIRST — the state

- **v2.9.0 RELEASED + ON PROD** (CI green, byte-identical, prod settings CLEAN): the PHB classes band C. The battery's four reds
  were all suite shape (291d4d9): §81 read §37's older card; §90c's goblin sits off the ring after §77 (the off-scene row);
  smoke-saves §32 read a stale card handle (5/5 green after); metamagic and drop were green solo before.
- **The DMG's rules chapters SCANNED** (70cf2c8): no row owed; two optional rules could be DM configs (Fight or Flight, Success
  at a Cost) — the user's call. The order of the rest: [audits/plans/dmg-build.md](audits/plans/dmg-build.md).
- **D1 BUILT and PROVEN** (6566cbd … 256ec99): the fifteen band-D rows, `smoke-classes` §92–§105 green; RULINGS *The PHB classes —
  D1*. **The PHB classes are complete.** The D1 full battery was launched detached (`dist/battery/2026-10-01T04-34-52`).
- **The DMG's cheap rows BUILT** (c175509 and the commit before): eleven items, `smoke-classes` §106–§112 written — **run them after
  the battery** (deploy `--local` first: the battery is testing the D1 copy). Four of the fourteen moved to the plan's §3 (measured:
  two enchantments, two AC reactions with no effect).

## Next, in order

1. The D1 battery's verdict (`node tools/battery-status.mjs`); fix any red (suite shape first — the lessons below).
2. **Release v2.10.0** (the D1 commits; NOT the DMG ones if they are not yet proven — tag the D1 head) and the prod deploy.
3. Deploy `--local`, restart the sandbox, run `smoke-classes --section 106,107,108,109,110,111,112`; fix; **release v2.11.0** + prod.
4. Tomorrow (the user): the rest of the DMG — the enchantment-aware weapon reader (the crit riders, Sword of Wounding, Luck Blade),
   the made AC effect (Quarterstaff of the Acrobat, Shield of the Cavalier), the injury poisons, Moonblade, Periapt.

## Suite lessons (keep them)

- A ring's MEMBER copy is named `<effect> — <source>`: match by `startsWith`, never `===`.
- The pack's Elemental Attunement item always carries its enchantment TEMPLATES (`transfer: false`); the applied copy is the
  transferred one (`isAppliedEnchantment`).
- The range is 2000 × 2000 and the suite's main row (y 2100) is OFF the scene: a token placed there cannot be moved back onto it;
  §77 strands the Halfling on the north rows for the rest of a full run.
- A prompt-mode save's dialog can open before the cast's handle carries the `saves` flag: read the live card.
- Heredoc edits mangle backslashes AND `\'` — edit scripts go in a scratchpad FILE (python), never a heredoc.
- (earlier) a PowerShell `>` redirect writes UTF-16; a killed suite leaves a combat; the cleanup chain after any kill:
  delete every combat, `verify-settings --fix` → `reset-fixture-state` → `scrub-fixture-residue` → `fixture-suite`.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule*; a bend by choice in
  *Bent by choice*; a new flag key is classified in `decide/moments.js`; no dates in code comments (the check fails them).
- A change runs its own suites; deploy `--local` first; launch batteries detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores). The process restart on prod is the user's.
