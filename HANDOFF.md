# HANDOFF.md — 2026-10-01 (late): the DMG called read, v2.11.0 ON PROD; next the 3.0 floor battery

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Wait for the user's go.** A ruling in chat is not a go. 3.0.0 is the user's to cut by hand.

## FIRST — the state

- **On prod: v2.11.0** (deployed 2026-10-01 from the tag checkout: 8 files differ after waking a half-awake box, then
  byte-identical; `BF_TARGET=prod` verify-settings CLEAN; bridge disconnected). The module.json version string waits on a
  Foundry PROCESS restart, which is the user's.
- **main = ca3510b, pushed, UNRELEASED:** the DMG called read.
  - Stroke of Luck's 20 is a Critical Hit on an attack (rule of cool; the damage crit reads through the folds).
  - Mantle of Spell Resistance and Ring of Spell Turning are `spells: "cast"` (a spell cast only; the demand's `cast` mark).
  - The four injury poisons are `COATINGS` `item` rows (the vial is the carrier; the last vial stays on the sheet empty).
  - Periapt of Wound Closure is a `D20_FLOORS` `worn` row (a death save of 9 or lower counts as 10).
  - The rest of the DMG's items are in BACKLOG ("build when a player holds one"). The DMG register is regenerated.
- Proof on ca3510b: verify green (1239 tests); smoke-battleflow, smoke-d20-folds 96/96, smoke-classes §94 §98 §106 §113
  §114, smoke-sneak §12 green; smoke-saves 146/147 with the known §32 dialog flake (10/10 alone). Sandbox settings CLEAN.

## Next, in order (each on the user's go)

1. **One full battery on the 3.0 head** (the release floor), all green. Clean the sandbox first (verify-settings --fix,
   reset-fixture-state, fixture-suite) and make sure no other session holds the bridge.
2. **Docs frame lines**: SWEEP / BACKLOG / DESIGN say "PHB + DMG + MM built".
3. The user cuts v3.0.0 by hand; prod only on the user's word.

## Rulings taken 2026-10-01 (recorded in RULINGS)

- 3.0's bounds: the held kinds (redirect, cast-triggered reaction, Overchannel, the MM's 12 WAITS) stay OUT; Fight or Flight
  and Success at a Cost stay out.
- Stroke of Luck on an attack: a crit (rule of cool).
- "Against spells": the Mantle and the Ring narrowed to spells cast (the user: a spell uses a slot).
- The DMG's second cut: poisons + Periapt built; crit riders, enchanted weapons, the reaction-AC items, Moonblade to BACKLOG.

## Suite lessons (keep them)

- ⚠ No `foundry-local5e` MCP call while a battery runs: it joins the bridge and every later suite fails its preflight.
- A vial's Use Poison is both the coating's use and its save: the hit's own use is marked (`hitUses`) so the veto skips it.
- Never delete an item whose activity a just-posted save card still reads.
- A ring's MEMBER copy is named `<effect> — <source>`: match it by `startsWith`.
- A PENDING save demand routes a sheet save of the same creature into the demand's withhold: roll sheet saves first.
- The off-scene main row (y 2100): a token there cannot be moved back onto it.
- Heredoc edits mangle backslashes AND `\'`: write edit scripts to a scratchpad FILE (python).
- No dates in code comments, no user quotes in code comments (a check fails them). Commit bodies ASCII. `biome --write` on
  named files only.
