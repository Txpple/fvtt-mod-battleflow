# HANDOFF.md — after the overnight run of 2026-10-01: v2.10.0 on prod, the DMG worn items proven, v2.11.0 OWED

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Wait for the user's go.** Rulings the user gave on 2026-10-01: the DMG release stays 2.x (**3.0.0 is the user's to cut by
> hand**); a blocking bridge from another session may be killed.

## FIRST — the state

- **On prod: v2.10.0** (CI green, byte-identical, settings CLEAN). It holds the PHB classes bands C (v2.9.0) and D (v2.10.0), so
  **every band of every PHB class is built**. The process restart for the version string is the user's.
- **On main, unreleased:** the DMG's worn items (c274611, c175509, plus the §109 suite fix). That is eleven items on existing
  machines, and `smoke-classes` §106–§112 are **17/17 green** on the sandbox. RULINGS *The DMG — the worn items*.
- **The touched-suites run for the DMG release is NOT valid.** A second client ("Scribe Assistant", the session-scribe bridge of
  another Claude session) joined the sandbox mid-run and took the save prompts: smoke-saves read 130/147, with detail lines
  "waiting on Scribe Assistant". The run was killed and settings were restored CLEAN. **The fixture cleanup chain was NOT run**
  (the second client was still connected).

## Next, in order

1. Make the sandbox single-client: `local-foundry.mjs status` must show 1 user once the suite connects. Find and kill the other
   sessions' scribe and dnd5e bridge processes (`fvtt-app-sessionscribe/dist/index.js`, `fvtt-mcp-dnd5e/dist/index.js` under a
   claude.exe that is not yours), or close those sessions.
2. Run the cleanup chain after the kill: delete every combat → `verify-settings --fix` → `reset-fixture-state` →
   `scrub-fixture-residue` → `fixture-suite`.
3. Re-run the DMG release's own suites:
   `node tools/battery.mjs fixture-d20-folds smoke-d20-folds smoke-saves smoke-hold smoke-reminders smoke-guards`
   (launch it detached). ⚠ Named suites still pulled the long list last time: watch `battery-status` and kill nothing mid-suite.
4. Green → **release v2.11.0** ("the DMG, the worn items") and deploy to prod (`--check` first; deploy from a tag checkout if main
   has moved on since).
5. The rest of the DMG (audits/plans/dmg-build.md §3), then the 3.0 list below.

## Before v3.0.0 (PHB + DMG + MM built, pre-walk — the user's frame)

| # | Work | Size | State |
| --- | --- | --- | --- |
| 1 | v2.11.0: the DMG worn items released + prod | an hour | built and proven; needs a clean suite run |
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
