# HANDOFF.md — 2026-10-01: v2.11.0 RELEASED (the DMG worn items), prod still v2.10.0; next the rest of the DMG

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Wait for the user's go.** Rulings the user gave on 2026-10-01: the DMG release stays 2.x (**3.0.0 is the user's to cut by
> hand**); a blocking bridge from another session may be killed.

## FIRST — the state

- **On prod: v2.10.0** (every band of every PHB class). **v2.11.0 is RELEASED on GitHub, NOT on prod** (the user's word:
  "release v2.11.0 -- no prod"). The prod deploy waits for the user.
- **v2.11.0** (a8d2f05, CI 36828433116 green): the DMG's eleven worn items. Floor: its own suites, clean single-client run
  (smoke-battleflow, smoke-hold, smoke-saves 147/147, smoke-d20-folds 96/96, smoke-reminders 78/78, smoke-guards 15/15; settings
  CLEAN) plus `smoke-classes` §106–§112 17/17 from the night run.
- The sandbox was made single-client by killing the other sessions' scribe and dnd5e bridge processes; it is clean (fixtures
  rebuilt, settings CLEAN).
- `battery-status.mjs` counts against the FULL order (47) even for a named run: the bar reads 0/47 while an 8-suite plan runs.
  Cosmetic; the battery itself runs the plan.

## Next, in order

1. **Talk with the user about the rest of the DMG** (the table below, rows 2–6, and the rulings owed) before building.
2. Prod deploy of v2.11.0 only on the user's word (`--check` first, from the tag checkout if main has moved).

## Before v3.0.0 (PHB + DMG + MM built, pre-walk — the user's frame)

| # | Work | Size | State |
| --- | --- | --- | --- |
| 1 | v2.11.0: the DMG worn items released + prod | an hour | RELEASED 2026-10-01; prod deploy on the user's word |
| 2 | **The enchantment-aware weapon reader** + `CRIT_RIDERS`: Vorpal Sword, Sword of Sharpness, Sword of Life Stealing, Nine Lives Stealer, Hammer of Thunderbolts, Mace of Smiting, Silvered Weapon, Adamantine Weapon; plus the 2024 enchantments Sword of Wounding (an on-hit DC 15 save, repeated each turn end) and Luck Blade (one reroll of a failed D20 Test per dawn) | a day | planned (dmg-build §3) |
| 3 | **A made AC effect on the `ac` hold**: Quarterstaff of the Acrobat (+5 AC as a Reaction), Shield of the Cavalier (Protective Field, Half Cover as a Reaction) | half a day | planned |
| 4 | **Injury poisons**: generalise Poisoner's `COATINGS` (Lolth's Sting, Purple Worm, Serpent Venom, Wyvern) | half a day | planned |
| 5 | Moonblade (the crit threshold — measure the pack's flag first); Periapt of Wound Closure (on Survivor's death-save seam, now built) | an hour each | planned |
| 6 | The DMG register regenerated and re-read after 2–5; the DMG called read | an hour | — |
| 7 | One full battery on the 3.0 head, all green (the release floor) | 1.5 h | — |
| 8 | Docs: SWEEP / BACKLOG / DESIGN frame lines say "PHB + DMG + MM built" | an hour | — |

**Held out of 3.0 unless the user rules otherwise** (see the rulings below): the redirect kind (Shield of Missile Attraction,
Arrow-Catching Shield's Intercept Attack, the MM's Redirect Attack), the cast-triggered reaction (Rod of Absorption, Staff of the
Magi, Ioun Stone of Absorption, held with Counterspell), Overchannel (WAITS for a player), and the MM's 12 WAITS rows (kinds held
by ruling).

## Rulings needed from the user

1. **3.0's bounds:** are the held kinds above (redirect, cast-triggered reaction, Overchannel, the MM's 12 WAITS) in or out of 3.0?
2. **Fight or Flight and Success at a Cost** (the DMG's optional rules): build them as DM configs, off by default, or leave them out?
3. **Stroke of Luck on an attack:** the d20 "turns into a 20". Built as NOT a Critical Hit (the roll counts as 20; a 20 wasn't
   rolled). Keep that, or make it a crit?
4. **"Against spells" items** (Mantle of Spell Resistance, Ring of Spell Turning): they read the demand's `spell` mark, which also
   counts magic items' effects. Narrow them to spells alone?
5. **Sandbox hygiene:** close other Claude sessions (or their scribe and bridge MCPs) before a battery. A second client spoils
   every prompt-mode suite.

## Suite lessons (keep them)

- A ring's MEMBER copy is named `<effect> — <source>`: match it by `startsWith`.
- The pack's Elemental Attunement carries its enchantment TEMPLATES (`transfer: false`); the applied copy is the transferred one.
- A PENDING save demand routes a sheet save of the same creature into the demand's withhold: roll sheet saves first.
- The off-scene main row (y 2100): a token there cannot be moved back onto it; §77 strands the Halfling up north.
- A prompt-mode dialog can open before the cast's handle carries `saves`: read the live card.
- Heredoc edits mangle backslashes AND `\'`: write edit scripts to a scratchpad FILE (python).
- No dates in code comments (a check fails them). Commit bodies ASCII. `biome --write` on named files only.
