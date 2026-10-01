# The DMG — the build plan (2026-10-01)

> **What this is:** where the Dungeon Master's Guide stands for the full release, after the register
> ([dmg-register.md](../dmg-register.md)), its re-review (RULINGS *The DMG register*, RE-REVIEWED 2026-10-01) and the
> scan of the rules chapters owed by that re-review. The verdicts live in the drawing ([drawings/dm.md](../drawings/dm.md));
> this file is the order of work.

## 1. The rules chapters — scanned (2026-10-01)

`node tools/scan-dmg-rules.mjs dist/dmg-rules-scan.json` read every JournalEntry page of the DMG module's journal packs:
**341 pages, 76 with a mechanism word** (a save, Advantage, a condition, damage, AC, an attack roll, cover, Initiative,
Concentration, Hit Points, a death save, a critical hit). Each of the 76 read by hand; the verdicts:

| Page | What it carries | Verdict |
| --- | --- | --- |
| Running Combat / **Fight or Flight** | morale: a monster starting its turn Bloodied and Frightened, or Bloodied with half its allies down, flees or parleys (a DC 10 Wisdom save at the DM's option) | **CANDIDATE** — a GM-side notice at that monster's turn start (`TURN_GRANTS` `remind`'s shape, the bloodied judge exists); an optional rule, so a DM config, off by default. The user's call |
| Resolving Outcomes / **Consequences** | Success at a Cost: a D20 Test failed by 1 or 2 may succeed with a complication | **CANDIDATE** — the margin is the module's (the rescue window and the save withhold know it): a "succeed at a cost?" line on the failed roll's card for the GM, a DM config, off by default. The complication is the table's. The user's call |
| DM's Toolbox / **Fear and Mental Stress** | Frightened as the baseline, a repeat save at each turn end; optional extras (Dash away, Advantage against them, one of move/action/bonus) | NATIVE (Frightened, the repeat saves machine); the extras are optional table rules — TEXT |
| DM's Toolbox / **Environmental Effects** | hourly saves for cold, heat, deep and frigid water, altitude; heavy precipitation's Disadvantage on Perception; dead magic | OUT — exploration time, the GM's (an effect on the scene's creatures where wanted) |
| DM's Toolbox / **Chases** | Dash count, Con saves for Exhaustion, complications | OUT — the chase is the GM's procedure |
| DM's Toolbox / **Mobs** | average results instead of rolls | OUT — a speed tool the GM uses instead of the dice |
| DM's Toolbox / **Curses and Magical Contagions**, **Poison**, **Hazards**, **Traps**, **Supernatural Gifts**, **Firearms and Explosives** | the content's own pages; the items are in the register (poisons, hazards, traps, gifts, firearms) | the register's rows — no new row here |
| Running Combat / **Rolling Initiative** | Advantage on Initiative for the side that starts the fight | TEXT — the GM's ruling |
| Resolving Outcomes / Ability Checks, Attack Rolls, Advantage and Disadvantage, Improvising Damage, Saving Throws, Difficulty Class | DM guidance on the core rules | TEXT |
| Magic Items / Activating, Resilience, Sentient Items; Doors; Death; Monster Behavior; the planes (Hades' Long Rest save, the Negative and Positive Planes) | guidance, objects, lore, a rest-time save | OUT / TEXT |

**The finding:** the DMG's rules chapters add **no row the module owes**; two optional rules could become DM configs
(Fight or Flight, Success at a Cost) — the user's call, not built.

## 2. Tonight's build — the fourteen rows on machines that exist (the user, 2026-10-01: "do the cheap ones now")

| Rows | Machine / precedent | Notes |
| --- | --- | --- |
| Mantle of Spell Resistance, Spellguard Shield, Ring of Spell Turning, Robe of the Archmagi, Blessing of Magic Resistance | `EFFECT_BENDS` `saves: { bend: "advantage", spells: true }` — Magic Resistance / Spell Resistance | the item on the sheet (equipped and attuned where the item needs it) is the carrier |
| Ring of Evasion, Scarab of Protection | `SAVE_SUCCEEDS` — Mage Slayer's Guarded Mind | the item's charges pay; the Ring: Dexterity saves; the Scarab: saves against necromancy (and its Advantage against spells is the vsSpells row) |
| Arrow-Catching Shield, Gloves of Missile Snaring, Quarterstaff of the Acrobat, Shield of the Cavalier | `INTERRUPTS` / `REBUKES` — Deflect Attacks, the reaction rows | measured on the pack first; the redirect half (Arrow-Catching) stays with the redirect kind |
| Sword of Wounding | `TURN_GRANTS` `deals` at the wound's bearer's turn start | the no-healing clause and the save to end it as the pack carries them |
| Cloak of Displacement | `EFFECT_BENDS` — Displacement (`target: "disadvantage"`) | the "until damaged, back at your next turn start" clock |
| Luck Blade | `REROLLS` — the reroll kind | one d20 rerolled per dawn; its +1 and luck bonus are the pack's |

Release: v2.11.0 (after D1's v2.10.0). 3.0.0 is the user's to cut by hand.

## 3. Tomorrow — the rest of the DMG (the user: "keep working on the dmg tomorrow")

| Work | Size | Customers |
| --- | --- | --- |
| **Critical-hit riders** — a new table and an enchantment-aware weapon reader (the crit six ship as ENCHANTMENTS on a base weapon) | a day | Vorpal Sword, Sword of Sharpness, Sword of Life Stealing, Nine Lives Stealer, Hammer of Thunderbolts, Mace of Smiting, Silvered Weapon, Adamantine Weapon |
| **Injury poisons** — Poisoner's `COATINGS` machine generalised (the item's own Use Poison activity) | half a day | Lolth's Sting, Purple Worm Poison, Serpent Venom, Wyvern Poison |
| **The crit threshold** — Moonblade, measured first (the pack may carry the flag) | an hour | Moonblade |
| **The death-save seam** — Periapt of Wound Closure on Survivor's seam (D1 opens it) | an hour | Periapt of Wound Closure |
| **The two optional rules** — Fight or Flight, Success at a Cost as DM configs | the user's call | — |
| Held with other kinds | — | the cast-triggered reaction (Rod of Absorption, Staff of the Magi, Ioun Stone of Absorption) with Counterspell; the redirect kind (Shield of Missile Attraction, Arrow-Catching Shield's redirect) with the MM's Redirect Attack |
