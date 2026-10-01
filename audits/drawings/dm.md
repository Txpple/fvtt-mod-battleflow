# The Dungeon Master's Guide — the drawing (measured 2026-09-28)

> **What this is:** the verdict on the DMG's own rows, read against [../dm.md](../dm.md): 548 rows in
> `dnd-dungeon-masters-guide.equipment` (magic items, poisons, traps, hazards, siege weapons, the
> supernatural gifts) and 23 in `.features` (the DMG's monster-shaped traits for its NPCs). 201 + 6
> with a family, 36 + 0 text-only, 8 named in the registry. The precedent row is named per
> [[land-by-mechanism-not-family]].
>
> **The finding: the DMG is not a slice.** Nothing here is granted by a class or a species; a magic
> item is at a table only when the GM hands it out, and the house world holds none of the rows below
> in play. So the DMG's drawing is a *register*, not a commission: the shapes it shares with the other
> books are worth building once (they arrive with their PHB or MM customer), and its own rows wait for
> the item to be found. Traps, hazards and siege weapons are save-and-damage activities the demand
> already runs, and are NATIVE or the GM's.
>
> **RULED OUT 2026-09-28 (the user): nothing in the DMG is built — high impact, limited value.** The
> register ([../dmg-register.md](../dmg-register.md)) records where each row lands the day an item is
> found; a build then is a new commission on the user's word (RULINGS *The DMG register*).

## The shapes the DMG shares with the other books

| Shape | DMG customers | Where it is built |
| --- | --- | --- |
| **Save bends against magic** (the `vsSpells` judge) | Mantle of Spell Resistance, Spellguard Shield, Ring of Spell Turning, Scarab of Protection, Robe of the Archmagi, Blessing of Magic Resistance | with Magic Resistance (MM) and Spell Resistance (Abjurer): `EFFECT_BENDS` `saves` — nine customers |
| **The reroll kind** | Luck Blade (reroll one failed D20 Test per dawn), Deck of Many Things (the Fates card — out), Fates (the card — out), Robe of Stars (out) | ⚠ measured 2026-10-01: the 2024 Luck Blade is an ENCHANTMENT applied to a base weapon ("Luck Blade (Longsword)") — its row waits for the enchantment-aware weapon reader the crit riders need (audits/plans/dmg-build.md §3) |
| **A failed save succeeds** (`SAVE_SUCCEEDS`) | Ring of Evasion (a failed Dex save, 3 charges), Scarab of Protection (a failed save against necromancy, 12 charges), Ioun Stone of Absorption (a spell absorbed — the cast hold's) | Mage Slayer's machine; the Ring and the Scarab are rows with a `charges` pool |
| **On-hit reactions** (`REBUKES`, `INTERRUPTS`) | Sword of Answering (a row), Shield of the Cavalier (an attack when an ally within 5 ft is hit), Gloves of Missile Snaring (Deflect Attacks' shape: ranged, reduce by 1d10 + Dex), Arrow-Catching Shield (the +2 is an effect; the redirect of a ranged attack on an ally to the bearer is Redirect Attack's kind), Quarterstaff of the Acrobat (+2 AC as a reaction while spinning) | BUILT 2026-10-01: Gloves of Missile Snaring (a `worn` reduction on Deflect Missile's shape) and Arrow-Catching Shield's +2 against ranged attacks (the gate's −2, `plus`); the redirect waits for its kind. ⚠ Measured: the 2024 Shield of the Cavalier's Protective Field is a Half Cover Emanation as a Reaction (not an attack), and the Quarterstaff of the Acrobat's Attack Deflection a +5 AC Reaction with no effect to read — each needs a made effect on the `ac` hold (audits/plans/dmg-build.md §3) |
| **The cast-triggered reaction** (Counterspell's kind, SWEEP §7) | Rod of Absorption, Staff of the Magi's absorption, Ioun Stones of Absorption | with Counterspell, when a player has it |
| **Critical-hit riders** | Sword of Sharpness (a 20 deals 14 extra slashing and may sever a limb — missed by the first scan, 2026-10-01), Vorpal Sword (a 20 severs a head), Sword of Life Stealing (temp HP on a crit, 10 necrotic to the target), Nine Lives Stealer (a crit demands a save or the target dies, charges), Hammer of Thunderbolts (a 20 stuns on a failed save), Mace of Smiting (a 20 destroys a Construct; +1d6 vs Constructs), Silvered Weapon (+1d8 on a crit vs shape-changers), Adamantine Weapon (a hit on an object is a crit) | none — a `CRIT_RIDERS` table on the damage seam, the crit the module already judges (RULINGS *The hit's sequence*); **six customers, one table**, but every one a found item: built when the first is found |
| **Poisons as weapon coatings** | Lolth's Sting, Purple Worm Poison, Serpent Venom, Wyvern Poison | `COATINGS` (Poisoner's Poison Coating): the four INJURY poisons are rows — the save and the damage are the item's own activity; the ingested, inhaled and contact ones (Assassin's Blood, Carrion Crawler Mucus, Essence of Ether, Malice, Midnight Tears, Oil of Taggit, Pale Tincture, Torpor, Truth Serum) are the item's own save used at the creature, NATIVE, never a coating |
| **A turn-start rider on the victim** | Sword of Wounding (⚠ measured 2026-10-01: the 2024 sword is an ENCHANTMENT — +2d6 necrotic native — whose hit demands a DC 15 Constitution save or "Wounded and Cannot Heal" for an hour; the save repeats at each turn end) | the on-hit save and its REPEAT_SAVES row wait for the enchantment-aware weapon reader (audits/plans/dmg-build.md §3) |
| **The crit threshold** (a hit's critical range) | Moonblade (a 19 crits for an elf wielder) | the sheet's `flags.dnd5e.weaponCriticalThreshold` the pack could carry (Champion's Improved Critical is native that way); measured when found — a row only if the pack ships no flag |
| **The redirect kind** (an attack aimed at you instead) | Shield of Missile Attraction (ranged attacks within 10 ft target the wearer) | with the Monster Manual's Redirect Attack — a kind held for a player customer |
| **The death-save seam** | Periapt of Wound Closure (the wearer stabilizes at 0 Hit Points) | with Survivor's Defy Death (the classes drawing, D1): the death save's config hook |
| **Bends until damaged** | Cloak of Displacement (Disadvantage against the wearer until they take damage, back at the next turn start) | `EFFECT_BENDS` with an `until: damaged` clock — Rage's early-end judge reads the same receipt; one customer, waits |

## The DMG's own features (23)

Monster-shaped traits for the DMG's NPC stat blocks: **Aversion to Fire**, **Fey Ancestry** and
**Warrior's Wrath** are rows already; **Poison Tolerant** is Dwarven Resilience's row with the
feature's name; **Steadfast** (Frightened immunity while an ally is in sight — a status the sheet
carries, the ally judge the GM's) and **Telepathic Shroud** are NATIVE / OUT; the other 17 (Battle
Ready, Beast Whisperer, Death Jinx, Dimensional Disruption, Disciple of the Nine Hells,
Disintegration, Emissary of Juiblex, Forbiddance, Gloom Shroud, Light, Mimicry, Resonant Connection,
Siege Monster, Slaad Host, Telepathic Bond, Ventriloquism, Wild Talent) are lore, senses, spells or
the sheet's.

**NATIVE (the pack's effects and activities):** the +1/+2/+3 weapons, armor, shields, ammunition and
wraps; the damage-rider weapons (Flame Tongue, Frost Brand, Vicious, Dragon Slayer, Giant Slayer,
Holy Avenger, Sun Blade, Dwarven Thrower, Javelin of Lightning, Staff of Striking); the save items
(the wands, staves, horns, rods, robes, pipes, rings of elemental command, Mace of Terror, Iron Bands);
the resistance items; Weapon of Warning (Initiative Advantage, an effect); Boots of Speed, Demon Armor,
Berserker Axe, Oathbow, Sword of Vengeance, Rival Coin (rows already); the potions that cast a spell;
Comet and the other supernatural gifts (effects and uses).
**OUT:** traps, hazards and siege weapons (the GM runs them; their saves are the demand's), the
artifacts' lore powers (Vecna's, Orcus's, Kas's, Blackrazor's, Whelm's, Wave's beyond their weapon
rows), summoning and figurines, the utility items (347 rows with no family).

## Register verdicts

The hand column `tools/audit-dmg-register.mjs` reads — a verdict the data cannot derive, one row per DMG row,
by name. A row not listed here takes the generator's default: MODULE when a registry table names it, WAITS
when the shared-shapes table above names it as a customer, OUT for a trap, hazard or siege weapon, TEXT when
the pack ships a paragraph only or the text trips no family, NATIVE otherwise.
`| **Row** | OUT / TEXT / NATIVE / MODULE / WAITS | why |`.

| Row | Verdict | Why |
| --- | --- | --- |
| **Eye of Vecna** | OUT | an artifact's lore powers — the GM's; its spells are the sheet's |
| **Hand of Vecna** | OUT | an artifact's lore powers — the GM's; its spells are the sheet's |
| **Eye and Hand of Vecna** | OUT | an artifact's lore powers — the GM's |
| **Wand of Orcus** | OUT | an artifact's lore powers — the GM's; the weapon's +3 and its necrotic are the pack's |
| **Sword of Kas** | OUT | an artifact's lore powers — the GM's; the weapon's +3 and its extra die are the pack's |
| **Blackrazor** | OUT | an artifact's lore powers — the GM's; the weapon's +3 is the pack's |
| **Whelm** | OUT | an artifact's lore powers — the GM's; the weapon's +3 and its dwarf and giant riders are the pack's |
| **Wave** | OUT | an artifact's lore powers — the GM's; the weapon's +3 is the pack's |
| **Deck of Illusions** | OUT | a summons — the illusion is the GM's |
| **Figurine of Wondrous Power** | OUT | a summons — the creature is the GM's |
| **Gray Bag of Tricks** | OUT | a summons — the creature is the GM's |
| **Rust Bag of Tricks** | OUT | a summons — the creature is the GM's |
| **Tan Bag of Tricks** | OUT | a summons — the creature is the GM's |
| **Cube of Summoning** | OUT | a summons — the creature is the GM's |
| **Ring of Djinni Summoning** | OUT | a summons — the creature is the GM's |
| **Scroll of Titan Summoning** | OUT | a summons — the creature is the GM's |
| **Flames** | TEXT | the Deck of Many Things' card, not Flaming Sphere's `Flames` row — a hostile outsider is the GM's |
| **Light** | TEXT | the NPC trait (the creature sheds light), not the spell's `TOKEN_LIGHTS` row — the token's light is the sheet's |
| **Steadfast** | NATIVE | Frightened immunity while an ally is in sight — a status the sheet carries; the ally judge is the GM's |
| **Telepathic Shroud** | OUT | lore — a mind-reading immunity, nothing in combat |
| **Poison Tolerant** | WAITS | Dwarven Resilience's `EFFECT_BENDS` row with the feature's name (Advantage on saves against the Poisoned condition) — a row when an NPC carries it |
| **Sword of Sharpness** | WAITS | a crit rider (the first scan read it as a utility item): +14 slashing on a 20 and the sever — the `CRIT_RIDERS` table's eighth customer (2026-10-01) |
| **Moonblade** | WAITS | a 19 crits for an elf: the crit-threshold shape — the pack's flag if it ships one, a row if not; measured when found (2026-10-01) |
| **Shield of Missile Attraction** | WAITS | ranged attacks within 10 ft target the wearer: the redirect kind, held with the MM's Redirect Attack for a player customer (2026-10-01) |
| **Periapt of Wound Closure** | WAITS | stabilizes at 0 Hit Points: the death-save seam Survivor opens (D1); a row after it (2026-10-01) |
