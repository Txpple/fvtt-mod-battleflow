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

## The shapes the DMG shares with the other books

| Shape | DMG customers | Where it is built |
| --- | --- | --- |
| **Save bends against magic** (the `vsSpells` judge) | Mantle of Spell Resistance, Spellguard Shield, Ring of Spell Turning, Scarab of Protection, Robe of the Archmagi, Blessing of Magic Resistance | with Magic Resistance (MM) and Spell Resistance (Abjurer): `EFFECT_BENDS` `saves` — nine customers |
| **The reroll kind** | Luck Blade (reroll one d20 per dawn), Deck of Many Things' Fates (out), Robe of Stars (out) | with Indomitable's kind (the classes drawing) — Luck Blade is a row after it |
| **A failed save succeeds** (`SAVE_SUCCEEDS`) | Ring of Evasion (a failed Dex save, 3 charges), Scarab of Protection (a failed save against necromancy, 12 charges), Ioun Stone of Absorption (a spell absorbed — the cast hold's) | Mage Slayer's machine; the Ring and the Scarab are rows with a `charges` pool |
| **On-hit reactions** (`REBUKES`, `INTERRUPTS`) | Sword of Answering (a row), Shield of the Cavalier (an attack when an ally within 5 ft is hit), Gloves of Missile Snaring (Deflect Attacks' shape: ranged, reduce by 1d10 + Dex), Arrow-Catching Shield (the +2 is an effect; the redirect of a ranged attack on an ally to the bearer is Redirect Attack's kind), Quarterstaff of the Acrobat (+2 AC as a reaction while spinning) | rows on lists that exist; the redirect waits for its kind |
| **The cast-triggered reaction** (Counterspell's kind, SWEEP §7) | Rod of Absorption, Staff of the Magi's absorption, Ioun Stones of Absorption | with Counterspell, when a player has it |
| **Critical-hit riders** | Vorpal Sword (a 20 severs a head), Sword of Life Stealing (temp HP on a crit, 10 necrotic to the target), Nine Lives Stealer (a crit demands a save or the target dies, charges), Hammer of Thunderbolts (a 20 stuns on a failed save), Mace of Smiting (a 20 destroys a Construct; +1d6 vs Constructs), Silvered Weapon (+1d8 on a crit vs shape-changers), Adamantine Weapon (a hit on an object is a crit) | none — a `CRIT_RIDERS` table on the damage seam, the crit the module already judges (RULINGS *The hit's sequence*); **six customers, one table**, but every one a found item: built when the first is found |
| **Poisons as weapon coatings** | Assassin's Blood, Carrion Crawler Mucus, Essence of Ether, Lolth's Sting, Malice, Midnight Tears, Oil of Taggit, Pale Tincture, Purple Worm Poison, Serpent Venom, Torpor, Truth Serum, Wyvern Poison | `COATINGS` (Poisoner's Poison Coating): the injury poisons are rows — the save and the damage are the item's own activity; the ingested and inhaled ones are casts, not coatings |
| **A turn-start rider on the victim** | Sword of Wounding (1d4 necrotic per wound at the victim's turn start; no healing until a save) | the turn-start `grant` facet's harmful twin — `CLOCK_RIDERS` `turnStart` on the bearer of the wound effect; one customer, waits |
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
