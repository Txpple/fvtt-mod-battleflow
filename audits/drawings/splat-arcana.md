# Arcana Unleashed — the drawing

> **What this is:** the hand verdicts behind [the register](../arcana-register.md) (`tools/audit-splat-register.mjs arcana`
> reads the table below). The evidence is [splat/arcana-unleashed.md](../splat/arcana-unleashed.md), the plan
> [plans/splat-books.md](../plans/splat-books.md), the rulings RULINGS *Arcana Unleashed*. Rapid mode: rows and suites,
> no walkthrough; the walk table sits in RULINGS for the batched walk.

## What the book adds, by shape

| Shape | Precedent | Arcana's rows |
| --- | --- | --- |
| a hit-menu group with a shared pool and its own turn chit | `HIT_GROUPS` Combat Superiority · Monk's Focus | **Arcane Shot** (6 options; Piercing and Seeking Shot are text) |
| a save bystander adding a die to a failed save | `INTERRUPT_ROLLS` Guided Strike's `on: "miss"` | Arcane Omens; the roller's own: Transmuted Anatomy (Constitution), Spell Resistant (a spell) |
| a Reaction on becoming Bloodied | `REBUKES` with `judge: "becameBloodied"` (new facet) | Harvest Undead |
| the hit's save at the attacker | `REBUKES` Warding Charm | Instinctive Charm |
| a Reaction on a miss, any attack roll | `REBUKES` Sticky Shield + `missOf: "any"` | Masterful Shots |
| a worn item's rider on any damage, a charge the pick | `CLOCK_RIDERS` + `worn` (new facet) | Blood Amulet |
| a weapon's "you can" save on a hit, a charge the pick | `CLOCK_RIDERS` `wields` + `unticked` | Diamond Staff, Martialist's Quarterstaff, Namer's Needle (Identify Target) |
| a reroll from an item's own activity | `REROLLS` Luck Blade | Keyholes Dagger |
| a wielded concentration breaker | `DAMAGE_RULES` Mage Slayer + `wields` | Mage Breaker |
| a school-wide concentration exemption | `CONCENTRATION_EXEMPTS` + `school` | Focused Conjuration |
| Evasion keyed to an aura's member effect | `EVASIONS` + `effect` · `EMANATIONS` spell · `EFFECT_BENDS` member | Aura of Evasion |
| the areas that pulse | `EMANATIONS` Spirit Guardians · Moonbeam | Lightning Ring, Grave Ground |
| the repeating save | `REPEAT_SAVES` | Festering Blast, Entrancing Mirrors, Fractured Awareness, Inflict Doubt, Uncertain Footing, Vision of Elapsing Eons, Power Word Pain, Bellows of Strangulation, Frightening Appearance |
| the turn-start damage while a condition stands | `TURN_GRANTS` Spores | Festering Blast |
| half the damage healed | `HEAL_ON_HIT` Vampiric Touch | Enervation |
| a use back at Initiative | `INITIATIVE_GRANTS` + `count` | Ever-Ready Shot |
| the attack bends and save bends | `EFFECT_BENDS` | Superior Magic Resistance, Marshaled, Mounted Adept, the vestige's Cursed, Wondrous Alteration |
| half the damage on the hold | `INTERRUPT_MULTIPLIERS` Uncanny Dodge | Go to Ground |

## Register verdicts

The hand column `tools/audit-splat-register.mjs arcana` reads — a verdict the data cannot derive, by name. A row not listed
here takes the generator's default: MODULE when a registry table names it, TEXT when the pack ships a paragraph only or the
text trips no combat family, NATIVE otherwise. `| **Row** | NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS | why |`.

| Row | Verdict | Why |
| --- | --- | --- |
| **Piercing Shot** | TEXT | replaces the attack roll with a Line's save — the shot is used from the sheet |
| **Seeking Shot** | TEXT | replaces the attack roll with the target's save — the shot is used from the sheet |
| **Curving Shot** | OUT | a miss redirected to a new target — the redirect kind (BACKLOG *Scoped out for good*) |
| **Magical Ammunition** | NATIVE | the imbued ammunition is the pack's own property |
| **Indomitable Teleport** | TEXT | movement |
| **Modify Magic** | OUT | cast-triggered (BACKLOG *Scoped out for good*) |
| **Dispelling Recovery** | OUT | cast-triggered |
| **Split Enchantment** | OUT | cast-triggered |
| **Empowered Transmutation** | OUT | cast-triggered |
| **Abjuration Adept** | OUT | Protective Ward is cast-triggered |
| **Necromancy Adept** | OUT | Life Manipulation is cast-triggered |
| **Focused Strike** | WAITS | the pack's activity names an effect it does not ship (a data defect for Errata 5e); Eldritch Strike's `lands` once it does |
| **Alter Memories** | NATIVE | the pack's save; the hours forgotten are the table's |
| **Hypnotic Presence** | NATIVE | the pack's save and effect; its early ends (distance, damage) are the table's |
| **Death's Master** | WAITS | Extinguish Undead: a death's-side row keyed to a bystander's feature with a creature type — Searing Vengeance's `ally` shape; Bolster Undead is the pack's heal |
| **Vestige Companion** | OUT | summons-shaped — GitHub issue #1 |
| **Vestige Spells** | TEXT | a spell list |
| **Vestige Power** | TEXT | the companion's Divine Power is the bestiary's row |
| **Vestige Recovery** | OUT | summons-shaped (the companion's drop) — GitHub issue #1 |
| **Semblance of Life** | OUT | summons-shaped — GitHub issue #1 |
| **Durable Summons** | OUT | summons-shaped — GitHub issue #1 |
| **Splintered Summons** | OUT | summons-shaped — GitHub issue #1 |
| **Benign Transposition** | TEXT | a teleport |
| **Distant Transposition** | TEXT | a teleport |
| **Transmuter's Stone** | NATIVE | the pack's twenty effects |
| **Potent Stone** | NATIVE | the pack's effects |
| **Shape-Shifter** | TEXT | Polymorph from the sheet |
| **Master Transmuter** | NATIVE | the pack's heal and casts |
| **Necromancy Spellbook** | NATIVE | the resistance and the familiar are the pack's |
| **Grave Power** | TEXT | the spellbook's passive benefits |
| **Undead Thralls** | TEXT | a free cast |
| **Arcane Overload** | WAITS | Power Surge: a spell-damage bonus spent once per Long Rest — `DAMAGE_RULES` with a use, its first customer |
| **Arcane Safeguard** | TEXT | the Help action's Temporary Hit Points are the table's |
| **Arcane Undertaker** | NATIVE | the pack's effect and uses |
| **Portal Jumper** | TEXT | a teleport paid in movement |
| **Familiar Friend** | TEXT | Helpful Friend is the Help action |
| **Divination Adept** | WAITS | Prescient Intervention gives Advantage or Disadvantage AFTER the roll — a `roll` bend that adds a second d20, its first customer |
| **Elemental Familiar** | NATIVE | the summons and the pack's Energy Pulse save |
| **Otherworldly Familiar** | NATIVE | the pack's effect |
| **Soothing Familiar** | WAITS | Healing Beacon: a heal die's 1 or 2 read as 3 inside the familiar's 5-foot Emanation — `HEAL_REROLLS` with a minimum and a ring, its first customer |
| **Warlike Familiar** | OUT | Intercept Attack is the redirect kind |
| **Evocation Adept** | WAITS | Fueled Evocation: Hit Point Dice added to a spell's damage roll — a damage offer paid in Hit Dice, its first customer |
| **Conjuration Adept** | NATIVE | the pack's effects |
| **Transmutation Adept** | NATIVE | the pack's effect |
| **Boon of Erupting Spellpower** | OUT | an epic boon — BACKLOG *The epic boons — every book's*; cast-triggered besides |
| **Boon of Magic School Mastery** | OUT | an epic boon — BACKLOG *The epic boons — every book's* |
| **Boon of the Iron Mind** | OUT | an epic boon — BACKLOG *The epic boons — every book's* |
| **Battle Familiar** | OUT | summons-shaped — GitHub issue #1 |
| **Summon Plant** | OUT | summons-shaped — GitHub issue #1 |
| **Summon Dinosaur** | OUT | summons-shaped — GitHub issue #1 |
| **Spirit Lantern** | OUT | the fragments are a kill counter on a conjured object — summons-shaped, GitHub issue #1; its saves are the pack's |
| **Illusory Dragon** | NATIVE | the illusion is the pack's summon; Frightening Appearance is the bestiary's row |
| **Catnap** | NATIVE | the pack's Unconscious effect; a Short Rest's benefits are the table's |
| **Zone of Amicability** | OUT | social |
| **Dueling Ground** | TEXT | the marks ship; a duelist's drop teleporting it out is the table's |
| **Detonate** | NATIVE | two saves; the Explosion placed from the card |
| **Disruptive Tune** | NATIVE | the save and the effect; the Concentration lost is the table's |
| **Distorted Distance** | WAITS | an area that pulses with a PICK per creature (Elongation or Shortened Space) — the area kind with a choice, its first customer |
| **Transfix** | WAITS | the turn-end damage within 5 feet of the caster — `TURN_GRANTS` judged by distance, its first customer; the save and the Charmed are the pack's |
| **Moment of Prescience** | WAITS | Stroke of Luck's `twenty` and Portent's `set` on a Reaction SPELL — the fold's carrier a spell, its first customer |
| **Reweave Fate** | WAITS | Countercharm's reroll paid by a level 7 slot — a spell on the bystander table, its first customer |
| **Negative Energy Flood** | NATIVE | the save, the heal; the zombie is the table's |
| **Waves of Exhaustion** | NATIVE | the save and the Exhaustion; the cap at 4 is the table's |
| **Wail of the Banshee** | NATIVE | the save and the Deafened; "50 Hit Points or fewer dies" is the table's |
| **Iron Body** | NATIVE | the pack's effect |
| **Invulnerability** | NATIVE | the pack's effect |
| **Mordenkainen's Lucubration** | TEXT | slots recovered from the sheet |
| **Hindsight** | TEXT | narrative |
| **Dispelling Ammunition (Arrow)** | OUT | a dispel — the table's |
| **Dispelling Ammunition (Bolt)** | OUT | a dispel — the table's |
| **Dispelling Ammunition (Bullet, Firearm)** | OUT | a dispel — the table's |
| **Dispelling Ammunition (Bullet, Sling)** | OUT | a dispel — the table's |
| **Dispelling Ammunition (Needle)** | OUT | a dispel — the table's |
| **Goading Ammunition (Arrow)** | WAITS | the save on a hit by the AMMUNITION — a `CLOCK_RIDERS` carrier read off the attack's consumed ammunition (measure the seam first) |
| **Goading Ammunition (Bolt)** | WAITS | as the Arrow's |
| **Goading Ammunition (Bullet, Firearm)** | WAITS | as the Arrow's |
| **Goading Ammunition (Bullet, Sling)** | WAITS | as the Arrow's |
| **Goading Ammunition (Needle)** | WAITS | as the Arrow's |
| **Boon Companions' Bands** | WAITS | Careful Spell's protect ask on a WORN item, the matching band's wearer the one spared — `METAMAGIC` `asks: "careful"` on an item, its first customer |
| **Arcanist's Bestiary** | WAITS | the book's Charm Monster at Disadvantage for a non-Humanoid — a `side: "caster"` save bend on a worn item, its first customer |
| **Lucky Foot** | WAITS | a reroll offered on a 1 alone — `REROLLS` with a face, its first customer |
| **Namer's Needle** | MODULE | Identify Target's save rides the hit (`CLOCK_RIDERS`); Named Target's chosen Critical Hit WAITS (a crit by choice, its first customer) |
| **Blossom Rod** | NATIVE | the evolving rod's casts and Sleep-Inducing Pollen are the pack's |
| **Staff of Skulls** | NATIVE | the evolving staff's Pulverizing save is the pack's; Chattering is a check |
| **Wave-Swept Weapon** | NATIVE | the evolving weapon's effects are the pack's |
| **Staff of the Lost** | NATIVE | the casts and the curse's effect are the pack's |
| **Dissuader** | WAITS | Dissuading Aura: a pulsing Emanation from an ITEM's utility (the `spell` kind on an item's template); Repel: a move-in alert ring around the holder (Polearm Master's shape on a named item) |
| **Grave Reaper** | NATIVE | the 2d8 Necrotic is the weapon's own damage part |
| **Mage's Manacle** | NATIVE | the pack's save and Restrained |
| **Tramontane Armor** | NATIVE | the pack's save and Grappled |
| **Wand of Teeth** | NATIVE | the pack's save; the Poisoned's clock is the pack's |
| **Workshop Wrecker** | NATIVE | the pack's saves; "at the beginning of each of your turns" is used from the sheet |
| **Queen Ehlissa's Marvelous Nightingale** | TEXT | an artifact's casts from the sheet |
| **Scholar's Anchoring Bangle** | WAITS | Single-Minded Focus: a failed CONCENTRATION save made a success — `SAVE_SUCCEEDS` scoped to Concentration, its first customer |
| **Spell-Slinger's Puppet** | TEXT | narrative |
| **Necklace of the Beastly Familiar (Azurite)** | NATIVE | the transformation is the pack's |
| **Necklace of the Beastly Familiar (Chrysoprase)** | NATIVE | the transformation is the pack's |
| **Necklace of the Beastly Familiar (Fire Opal)** | NATIVE | the transformation is the pack's |
| **Necklace of the Beastly Familiar (Topaz)** | NATIVE | the transformation is the pack's |
| **Necklace of the Beastly Familiar (Zircon)** | NATIVE | the transformation is the pack's |
| **Potion of Dragon's Breath (Black)** | NATIVE | the Exhale save is the pack's |
| **Potion of Dragon's Breath (Blue)** | NATIVE | the Exhale save is the pack's |
| **Potion of Dragon's Breath (Green)** | NATIVE | the Exhale save is the pack's |
| **Potion of Dragon's Breath (Red)** | NATIVE | the Exhale save is the pack's |
| **Potion of Dragon's Breath (White)** | NATIVE | the Exhale save is the pack's |
| **Defensive Divination** | WAITS | a bystander's fresh d20 replacing an ally's attacked-against roll or save — Portent's `set` from a roll, its first customer |
| **Protective Magic** | NATIVE | Counterspell and Shield are the archmage's own spells — the hold offers Shield by name |
| **Evocation Sculptor** | WAITS | Sculpt Spells' protect ask on a monster trait — `METAMAGIC` `asks: "careful"` with no class, its first customer |
| **Spell Mimicry** | NATIVE | the save; the follow-up damage at the end of the target's next turn is the table's |
| **Brain Drain** | NATIVE | the attack and the save; the slot expended is the table's |
| **Spore Spray** | WAITS | the extra damage on an already-Poisoned target — a `CLOCK_RIDERS` judge on the target's status, its first customer |
| **Gore** | NATIVE | the Moving Attack is the pack's own activity |
| **Arcane Immortality** | TEXT | narrative |
| **Fiendish Restoration** | TEXT | narrative |
| **Deadly Drain** | NATIVE | a legendary action from the sheet |
| **Recuperative Teleport** | NATIVE | the pack's heal |
| **Fortify** | NATIVE | the pack's Temporary Hit Points |
| **Magic Resistance** | MODULE | the Monster Manual's row fires by name |
| **Marshal Undead** | MODULE | Arcana's own effect "Marshaled" — the `EFFECT_BENDS` row of that name |
| **Divine Power** | MODULE | Cursed Invocation's "Cursed" — `EFFECT_BENDS` "Cursed (Divine Power)"; Healing Touch and Fiendish Swap are the pack's |
