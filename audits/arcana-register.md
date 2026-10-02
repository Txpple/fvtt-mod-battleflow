# Arcana Unleashed — the register

> Generated 2026-10-02 by `tools/audit-splat-register.mjs arcana` from the OFFLINE corpus (`tools/scan-corpus-offline.mjs`, every pack of
> `dnd-arcana-unleashed`, 257 rows) joined with `scripts/decide/registry.js`, RULINGS' walk tables and bend registers, and the
> drawing's hand verdicts ([drawings/splat-arcana.md](drawings/splat-arcana.md) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.
>
> **In scope**: NATIVE — the pack and the platform resolve it (the sheet's effects, the saves machine, the applier, the gate and the
> receipts already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS section to read); ROW — a row
> on a machine that exists, to build, the precedent named; TABLE — a new table that is not a kind; KIND — a new kind (the R4 tripwire
> moves); **WAITS** — drawn on a machine that exists, held for its first customer or a measurement; TEXT — a paragraph only, or no combat
> mechanism; OUT — held out by a ruling, the reason in *Why not*. **Kind**: species · subclass (its feature, the subclass named) · option
> (nothing grants it) · feat · spell · item · gift · monster (the bestiary's traits, actions and reactions, one row per name).

**257 rows (46 subclasss · 15 options · 29 feats · 33 spells · 69 items · 65 monsters): 73 NATIVE · 38 MODULE · 0 ROW · 0 TABLE · 0 KIND · 97 TEXT · 26 OUT · 23 WAITS.**

| Kind | Row | Where | Families | In scope | Why not / how | Rule of cool / bend | Walked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| subclass | **Arcana Domain Spells** | Arcana Domain | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Dispelling Recovery** | Arcana Domain | — | OUT | cast-triggered | — | — |
| subclass | **Magical Mastery** | Arcana Domain | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Modify Magic** | Arcana Domain | temp-hp | OUT | cast-triggered (BACKLOG *Scoped out for good*) | — | — |
| subclass | **Arcane Archer Lore** | Arcane Archer | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Arcane Shot** | Arcane Archer | clock | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Curving Shot** | Arcane Archer | — | OUT | a miss redirected to a new target — the redirect kind (BACKLOG *Scoped out for good*) | — | — |
| subclass | **Ever-Ready Shot** | Arcane Archer | — | MODULE | `INITIATIVE_GRANTS` | — | — |
| subclass | **Indomitable Teleport** | Arcane Archer | — | TEXT | movement | — | — |
| subclass | **Magical Ammunition** | Arcane Archer | — | NATIVE | the imbued ammunition is the pack's own property | — | — |
| subclass | **Masterful Shots** | Arcane Archer | interrupt, reaction, movement | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | — | — |
| subclass | **Benign Transposition** | Conjurer | — | TEXT | a teleport | — | — |
| subclass | **Conjuration Savant** | Conjurer | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Distant Transposition** | Conjurer | — | TEXT | a teleport | — | — |
| subclass | **Durable Summons** | Conjurer | temp-hp, resist | OUT | summons-shaped — GitHub issue #1 | — | — |
| subclass | **Focused Conjuration** | Conjurer | concentration | MODULE | `CONCENTRATION_EXEMPTS` | — | — |
| subclass | **Splintered Summons** | Conjurer | concentration | OUT | summons-shaped — GitHub issue #1 | — | — |
| subclass | **Alter Memories** | Enchanter | press-condition, half-on-save | NATIVE | the pack's save; the hours forgotten are the table's | — | — |
| subclass | **Enchanting Conversation** | Enchanter | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Enchantment Savant** | Enchanter | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Hypnotic Presence** | Enchanter | press-condition | NATIVE | the pack's save and effect; its early ends (distance, damage) are the table's | — | — |
| subclass | **Instinctive Charm** | Enchanter | interrupt, reaction, press-condition, half-on-save, aura | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | — | — |
| subclass | **Split Enchantment** | Enchanter | — | OUT | cast-triggered | — | — |
| subclass | **Death's Master** | Necromancer | clock, interrupt, reaction, press-condition, half-on-save, temp-hp, aura | WAITS | Extinguish Undead: a death's-side row keyed to a bystander's feature with a creature type — Searing Vengeance's `ally` shape; Bolster Undead is the pack's heal | — | — |
| subclass | **Grave Power** | Necromancer | resist | TEXT | the spellbook's passive benefits | — | — |
| subclass | **Harvest Undead** | Necromancer | interrupt, reaction, temp-hp | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | — | — |
| subclass | **Necromancy Savant** | Necromancer | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Necromancy Spellbook** | Necromancer | temp-hp, resist | NATIVE | the resistance and the familiar are the pack's | — | — |
| subclass | **Undead Thralls** | Necromancer | — | TEXT | a free cast | — | — |
| subclass | **Empowered Transmutation** | Transmuter | — | OUT | cast-triggered | — | — |
| subclass | **Master Transmuter** | Transmuter | temp-hp | NATIVE | the pack's heal and casts | — | — |
| subclass | **Potent Stone** | Transmuter | bend-save | NATIVE | the pack's effects | — | — |
| subclass | **Shape-Shifter** | Transmuter | — | TEXT | Polymorph from the sheet | — | — |
| subclass | **Transmutation Savant** | Transmuter | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Transmuter's Stone** | Transmuter | resist, movement | NATIVE | the pack's twenty effects | — | — |
| subclass | **Wondrous Alteration** | Transmuter | bend-save, concentration | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| subclass | **Semblance of Life** | Vestige Patron | temp-hp, aura | OUT | summons-shaped — GitHub issue #1 | — | — |
| subclass | **Vestige Companion** | Vestige Patron | — | OUT | summons-shaped — GitHub issue #1 | — | — |
| subclass | **Vestige Power** | Vestige Patron | resist | TEXT | the companion's Divine Power is the bestiary's row | — | — |
| subclass | **Vestige Recovery** | Vestige Patron | reaction | OUT | summons-shaped (the companion's drop) — GitHub issue #1 | — | — |
| subclass | **Vestige Spells** | Vestige Patron | — | TEXT | a spell list | — | — |
| subclass | **Focused Strike** | Warrior of the Mystic Arts | bend-save, clock | WAITS | the pack's activity names an effect it does not ship (a data defect for Errata 5e); Eldritch Strike's `lands` once it does | — | — |
| subclass | **Improved Fighting Style** | Warrior of the Mystic Arts | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Mystic Fighting Style** | Warrior of the Mystic Arts | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Mystic Focus** | Warrior of the Mystic Arts | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| subclass | **Spellcasting** | Warrior of the Mystic Arts | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| option | **Banishing Shot** | level 3 | press-condition | NATIVE | the pack resolves it: 1 effect [incapacitated], a save, damage | — | — |
| option | **Beguiling Shot** | level 3 | clock, press-condition | NATIVE | the pack resolves it: 1 effect [charmed], a save, damage | — | — |
| option | **Bursting Shot** | level 3 | — | NATIVE | the pack resolves it: damage | — | — |
| option | **Enchanting Conversation (Deception)** | level 3 | — | TEXT | no combat mechanism | — | — |
| option | **Enchanting Conversation (Intimidation)** | level 3 | — | TEXT | no combat mechanism | — | — |
| option | **Enchanting Conversation (Persuasion)** | level 3 | — | TEXT | no combat mechanism | — | — |
| option | **Enfeebling Shot** | level 3 | clock | NATIVE | the pack resolves it: 4 effects [poisoned], a save, damage | — | — |
| option | **Grasping Shot** | level 3 | press-condition | NATIVE | the pack resolves it: 1 effect [restrained], a save, damage | — | — |
| option | **Piercing Shot** | level 3 | press-condition, half-on-save | TEXT | replaces the attack roll with a Line's save — the shot is used from the sheet | — | — |
| option | **Seeking Shot** | level 3 | press-condition, half-on-save | TEXT | replaces the attack roll with the target's save — the shot is used from the sheet | — | — |
| option | **Shadow Shot** | level 3 | clock, press-condition | NATIVE | the pack resolves it: 1 effect [blinded], a save, damage | — | — |
| option | **Vestige Spells (Life)** | level 3 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| option | **Vestige Spells (Light)** | level 3 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| option | **Vestige Spells (Trickery)** | level 3 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| option | **Vestige Spells (War)** | level 3 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Arcane Artist** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Arcane Eloquence** |  | — | TEXT | no combat mechanism | — | — |
| feat | **Arcane Infiltrator** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Arcane Omens** |  | reaction | MODULE | `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| feat | **Arcane Overload** |  | — | WAITS | Power Surge: a spell-damage bonus spent once per Long Rest — `DAMAGE_RULES` with a use, its first customer | — | — |
| feat | **Arcane Safeguard** |  | temp-hp | TEXT | the Help action's Temporary Hit Points are the table's | — | — |
| feat | **Arcane Undertaker** |  | — | NATIVE | the pack's effect and uses | — | — |
| feat | **Arcane Warrior** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Familiar Friend** |  | aura | TEXT | Helpful Friend is the Help action | — | — |
| feat | **Portal Jumper** |  | clock, resist | TEXT | a teleport paid in movement | — | — |
| feat | **Transmuted Anatomy** |  | bend-save, reaction, movement | MODULE | `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| feat | **Boon of Erupting Spellpower** | level 19 | — | OUT | an epic boon — BACKLOG *The epic boons — every book's*; cast-triggered besides | — | — |
| feat | **Boon of Magic School Mastery** | level 19 | — | OUT | an epic boon — BACKLOG *The epic boons — every book's* | — | — |
| feat | **Boon of the Iron Mind** | level 19 | concentration | OUT | an epic boon — BACKLOG *The epic boons — every book's* | — | — |
| feat | **Abjuration Adept** | level 4 | temp-hp | OUT | Protective Ward is cast-triggered | — | — |
| feat | **Conjuration Adept** | level 4 | concentration | NATIVE | the pack's effects | — | — |
| feat | **Divination Adept** | level 4 | reaction | WAITS | Prescient Intervention gives Advantage or Disadvantage AFTER the roll — a `roll` bend that adds a second d20, its first customer | — | — |
| feat | **Elemental Familiar** | level 4 | reaction, press-condition, aura, resist | NATIVE | the summons and the pack's Energy Pulse save | — | — |
| feat | **Enchantment Adept** | level 4 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Evocation Adept** | level 4 | clock | WAITS | Fueled Evocation: Hit Point Dice added to a spell's damage roll — a damage offer paid in Hit Dice, its first customer | — | — |
| feat | **Illusion Adept** | level 4 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Magic Connoisseur** | level 4 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Necromancy Adept** | level 4 | temp-hp | OUT | Life Manipulation is cast-triggered | — | — |
| feat | **Otherworldly Familiar** | level 4 | resist, movement | NATIVE | the pack's effect | — | — |
| feat | **Soothing Familiar** | level 4 | aura | WAITS | Healing Beacon: a heal die's 1 or 2 read as 3 inside the familiar's 5-foot Emanation — `HEAL_REROLLS` with a minimum and a ring, its first customer | — | — |
| feat | **Spell Resistant** | level 4 | resist | MODULE | `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| feat | **Spell Subterfuge** | level 4 | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| feat | **Transmutation Adept** | level 4 | movement | NATIVE | the pack's effect | — | — |
| feat | **Warlike Familiar** | level 4 | interrupt, reaction | OUT | Intercept Attack is the redirect kind | — | — |
| spell | **Battle Familiar** | level 2 | — | OUT | summons-shaped — GitHub issue #1 | — | — |
| spell | **Disruptive Tune** | level 2 | bend-save, press-condition, half-on-save, concentration | NATIVE | the save and the effect; the Concentration lost is the table's | — | — |
| spell | **Dueling Ground** | level 2 | — | TEXT | the marks ship; a duelist's drop teleporting it out is the table's | — | — |
| spell | **Uncertain Footing** | level 2 | press-condition | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Wither and Bloom** | level 2 | rider-damage, press-condition, half-on-save, temp-hp | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| spell | **Catnap** | level 3 | press-condition | NATIVE | the pack's Unconscious effect; a Short Rest's benefits are the table's | — | — |
| spell | **Inflict Doubt** | level 3 | press-condition | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Distorted Distance** | level 4 | clock, press-condition, movement | WAITS | an area that pulses with a PICK per creature (Elongation or Shortened Space) — the area kind with a choice, its first customer | — | — |
| spell | **Festering Blast** | level 4 | rider-damage, press-condition | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `TURN_GRANTS` (turn-grants.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Zone of Amicability** | level 4 | — | OUT | social | — | — |
| spell | **Enervation** | level 5 | rider-damage, press-condition, half-on-save, concentration, temp-hp | MODULE | `HEAL_ON_HIT` (heal-on-hit.js; RULINGS *The spells slice — the held spells*) | — | — |
| spell | **Grave Ground** | level 5 | rider-damage, clock, press-condition, movement | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| spell | **Mordenkainen's Lucubration** | level 5 | — | TEXT | slots recovered from the sheet | — | — |
| spell | **Negative Energy Flood** | level 5 | rider-damage, press-condition, half-on-save | NATIVE | the save, the heal; the zombie is the table's | — | — |
| spell | **Spirit Lantern** | level 5 | bend-attack, clock, press-condition, half-on-save, temp-hp | OUT | the fragments are a kill counter on a conjured object — summons-shaped, GitHub issue #1; its saves are the pack's | — | — |
| spell | **Summon Plant** | level 5 | — | OUT | summons-shaped — GitHub issue #1 | — | — |
| spell | **Waves of Exhaustion** | level 5 | press-condition | NATIVE | the save and the Exhaustion; the cap at 4 is the table's | — | — |
| spell | **Summon Dinosaur** | level 6 | — | OUT | summons-shaped — GitHub issue #1 | — | — |
| spell | **Aura of Evasion** | level 7 | bend-save, press-condition, half-on-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*); `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*); `EVASIONS` (saves/consequences.js; RULINGS *The GM's side — the five shapes*) | — | — |
| spell | **Fractured Awareness** | level 7 | press-condition, half-on-save | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Power Word Pain** | level 7 | — | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Reweave Fate** | level 7 | reaction, d20-fold | WAITS | Countercharm's reroll paid by a level 7 slot — a spell on the bystander table, its first customer | — | — |
| spell | **Transfix** | level 7 | rider-damage, press-condition, aura, movement | WAITS | the turn-end damage within 5 feet of the caster — `TURN_GRANTS` judged by distance, its first customer; the save and the Charmed are the pack's | — | — |
| spell | **Entrancing Mirrors** | level 8 | press-condition, half-on-save | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Illusory Dragon** | level 8 | bend-save, press-condition, half-on-save, resist | NATIVE | the illusion is the pack's summon; Frightening Appearance is the bestiary's row | — | — |
| spell | **Iron Body** | level 8 | resist | NATIVE | the pack's effect | — | — |
| spell | **Lightning Ring** | level 8 | press-condition, half-on-save | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| spell | **Moment of Prescience** | level 8 | reaction | WAITS | Stroke of Luck's `twenty` and Portent's `set` on a Reaction SPELL — the fold's carrier a spell, its first customer | — | — |
| spell | **Detonate** | level 9 | press-condition, half-on-save | NATIVE | two saves; the Explosion placed from the card | — | — |
| spell | **Hindsight** | level 9 | — | TEXT | narrative | — | — |
| spell | **Invulnerability** | level 9 | resist | NATIVE | the pack's effect | — | — |
| spell | **Vision of Elapsing Eons** | level 9 | press-condition | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| spell | **Wail of the Banshee** | level 9 | press-condition, half-on-save | NATIVE | the save and the Deafened; "50 Hit Points or fewer dies" is the table's | — | — |
| item | **Arcane Chatelaine** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Arcanist's Bestiary** |  | bend-save | WAITS | the book's Charm Monster at Disadvantage for a non-Humanoid — a `side: "caster"` save bend on a worn item, its first customer | — | — |
| item | **Bellows of Strangulation** |  | — | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| item | **Blood Amulet** |  | rider-damage, press-condition | MODULE | `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) | — | — |
| item | **Blossom Rod** |  | — | NATIVE | the evolving rod's casts and Sleep-Inducing Pollen are the pack's | — | — |
| item | **Boon Companions' Bands** |  | bend-save, half-on-save | WAITS | Careful Spell's protect ask on a WORN item, the matching band's wearer the one spared — `METAMAGIC` `asks: "careful"` on an item, its first customer | — | — |
| item | **Conjurer's Canopy** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Diamond Staff** |  | half-on-save, d20-fold | MODULE | `TOKEN_LIGHTS` (token-lights.js; RULINGS *The species walk, continued*); `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) | — | — |
| item | **Dictation Quill** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Dispelling Ammunition (Arrow)** |  | — | OUT | a dispel — the table's | — | — |
| item | **Dispelling Ammunition (Bolt)** |  | — | OUT | a dispel — the table's | — | — |
| item | **Dispelling Ammunition (Bullet, Firearm)** |  | — | OUT | a dispel — the table's | — | — |
| item | **Dispelling Ammunition (Bullet, Sling)** |  | — | OUT | a dispel — the table's | — | — |
| item | **Dispelling Ammunition (Needle)** |  | — | OUT | a dispel — the table's | — | — |
| item | **Dissuader** |  | clock, reaction, press-condition, d20-fold | WAITS | Dissuading Aura: a pulsing Emanation from an ITEM's utility (the `spell` kind on an item's template); Repel: a move-in alert ring around the holder (Polearm Master's shape on a named item) | — | — |
| item | **Dream Weaver** |  | — | TEXT | no combat mechanism | — | — |
| item | **Elocutionist's Lexicon** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Ensorcelled Missive** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Evergreen Fertilizer** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Goading Ammunition (Arrow)** |  | clock, press-condition | WAITS | the save on a hit by the AMMUNITION — a `CLOCK_RIDERS` carrier read off the attack's consumed ammunition (measure the seam first) | — | — |
| item | **Goading Ammunition (Bolt)** |  | clock, press-condition | WAITS | as the Arrow's | — | — |
| item | **Goading Ammunition (Bullet, Firearm)** |  | clock, press-condition | WAITS | as the Arrow's | — | — |
| item | **Goading Ammunition (Bullet, Sling)** |  | clock, press-condition | WAITS | as the Arrow's | — | — |
| item | **Goading Ammunition (Needle)** |  | clock, press-condition | WAITS | as the Arrow's | — | — |
| item | **Goodberry Charm** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Grave Reaper** |  | rider-damage, d20-fold | NATIVE | the 2d8 Necrotic is the weapon's own damage part | — | — |
| item | **Homeward Compass** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Idol of Good Fortunes** |  | — | TEXT | no combat mechanism | — | — |
| item | **Keyholes Dagger** |  | clock, d20-fold | MODULE | `REROLLS` (d20-folds.js; RULINGS *The PHB classes — B1*) | — | — |
| item | **Lucky Foot** |  | d20-fold | WAITS | a reroll offered on a 1 alone — `REROLLS` with a face, its first customer | — | — |
| item | **Mage Breaker** |  | bend-save, d20-fold, concentration | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*) | — | — |
| item | **Mage's Manacle** |  | — | NATIVE | the pack's save and Restrained | — | — |
| item | **Magewright's Gloves** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Martialist's Quarterstaff** |  | bend-attack, clock, press-condition | MODULE | `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) | — | — |
| item | **Namer's Needle** |  | bend-save, press-condition, d20-fold, crit, resist | MODULE | `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) — Identify Target's save rides the hit (`CLOCK_RIDERS`); Named Target's chosen Critical Hit WAITS (a crit by choice, its first customer) | — | — |
| item | **Necklace of the Beastly Familiar (Azurite)** |  | temp-hp, aura | NATIVE | the transformation is the pack's | — | — |
| item | **Necklace of the Beastly Familiar (Chrysoprase)** |  | temp-hp, aura | NATIVE | the transformation is the pack's | — | — |
| item | **Necklace of the Beastly Familiar (Fire Opal)** |  | temp-hp, aura | NATIVE | the transformation is the pack's | — | — |
| item | **Necklace of the Beastly Familiar (Topaz)** |  | temp-hp, aura | NATIVE | the transformation is the pack's | — | — |
| item | **Necklace of the Beastly Familiar (Zircon)** |  | temp-hp, aura | NATIVE | the transformation is the pack's | — | — |
| item | **Orb of Divination Detection** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Orb of Sorcery** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Potion of Dragon's Breath (Black)** |  | half-on-save, concentration | NATIVE | the Exhale save is the pack's | — | — |
| item | **Potion of Dragon's Breath (Blue)** |  | half-on-save, concentration | NATIVE | the Exhale save is the pack's | — | — |
| item | **Potion of Dragon's Breath (Green)** |  | half-on-save, concentration | NATIVE | the Exhale save is the pack's | — | — |
| item | **Potion of Dragon's Breath (Red)** |  | half-on-save, concentration | NATIVE | the Exhale save is the pack's | — | — |
| item | **Potion of Dragon's Breath (White)** |  | half-on-save, concentration | NATIVE | the Exhale save is the pack's | — | — |
| item | **Potion of Tirelessness** |  | — | TEXT | no combat mechanism | — | — |
| item | **Prismatic Rune** |  | — | TEXT | no combat mechanism | — | — |
| item | **Queen Ehlissa's Marvelous Nightingale** |  | reaction | TEXT | an artifact's casts from the sheet | — | — |
| item | **Ring of Dedicated Focus** |  | concentration | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Scholar's Anchoring Bangle** |  | reaction, concentration | WAITS | Single-Minded Focus: a failed CONCENTRATION save made a success — `SAVE_SUCCEEDS` scoped to Concentration, its first customer | — | — |
| item | **Secret Keeper's Circlet** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Spell Component Ring** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Spell Duelist's Trophy** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Spell-Slinger's Puppet** |  | aura, movement | TEXT | narrative | — | — |
| item | **Staff of Skulls** |  | reaction, half-on-save | NATIVE | the evolving staff's Pulverizing save is the pack's; Chattering is a check | — | — |
| item | **Staff of the Lost** |  | d20-fold | NATIVE | the casts and the curse's effect are the pack's | — | — |
| item | **Sweeping Broom** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Thespian's Playbill** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Thief's Thimble** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Tramontane Armor** |  | press-condition, movement | NATIVE | the pack's save and Grappled | — | — |
| item | **Traveler's Pearl** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Universal Pantograph** |  | — | TEXT | no combat mechanism | — | — |
| item | **Wand of Freshness** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Wand of Slumber** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Wand of Teeth** |  | clock, press-condition, half-on-save | NATIVE | the pack's save; the Poisoned's clock is the pack's | — | — |
| item | **Wave-Swept Weapon** |  | d20-fold | NATIVE | the evolving weapon's effects are the pack's | — | — |
| item | **Workshop Wrecker** |  | press-condition | NATIVE | the pack's saves; "at the beginning of each of your turns" is used from the sheet | — | — |
| monster | **Amorphous** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Arcane Burst** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Arcane Immortality** | actors | — | TEXT | narrative | — | — |
| monster | **Banishing Blast** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [incapacitated], a save, damage, uses | — | — |
| monster | **Beguiling Spells** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Benign Transposition** | actors | — | TEXT | a teleport | — | — |
| monster | **Bite** | actors | — | NATIVE | the pack resolves it: 1 effect [grappled, restrained], an attack | — | — |
| monster | **Booming Censure** | actors | clock, half-on-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, damage | — | — |
| monster | **Brain Drain** | actors | — | NATIVE | the attack and the save; the slot expended is the table's | — | — |
| monster | **Claw** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Counterspell** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | rule of cool | — |
| monster | **Crimson Blast** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Crimson Claw** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Crimson Strike** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Dagger** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Deadly Drain** | actors | clock | NATIVE | a legendary action from the sheet | — | — |
| monster | **Defensive Divination** | actors | reaction | WAITS | a bystander's fresh d20 replacing an ally's attacked-against roll or save — Portent's `set` from a roll, its first customer | — | — |
| monster | **Divine Power** | actors | bend-attack, temp-hp | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Cursed Invocation's "Cursed" — `EFFECT_BENDS` "Cursed (Divine Power)"; Healing Touch and Fiendish Swap are the pack's | — | — |
| monster | **Dominate Person** | actors | — | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| monster | **Duplicitous Magic** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Evocation Barrage** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Evocation Sculptor** | actors | bend-save, half-on-save | WAITS | Sculpt Spells' protect ask on a monster trait — `METAMAGIC` `asks: "careful"` with no class, its first customer | — | — |
| monster | **Exhale Blast of Energy** | actors | press-condition, half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Fiendish Restoration** | actors | — | TEXT | narrative | — | — |
| monster | **Flyby** | actors | movement | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Force Flail** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Fortify** | actors | temp-hp | NATIVE | the pack's Temporary Hit Points | — | — |
| monster | **Frightening Appearance** | actors | press-condition | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| monster | **Frightening Glance** | actors | clock | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Go to Ground** | actors | interrupt, reaction | MODULE | `INTERRUPT_MULTIPLIERS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| monster | **Gore** | actors | rider-damage | NATIVE | the Moving Attack is the pack's own activity | — | — |
| monster | **Heavy Crossbow** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Javelin** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Legendary Resistance** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Magic Disruption** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Magic Resistance** | actors | bend-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — the Monster Manual's row fires by name | — | — |
| monster | **Magic-Binding Chains** | actors | clock, half-on-save | NATIVE | the pack resolves it: 1 effect [restrained], a save | — | — |
| monster | **Magical Strike** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Marshal Undead** | actors | bend-attack | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Arcana's own effect "Marshaled" — the `EFFECT_BENDS` row of that name | — | — |
| monster | **Mounted Adept** | actors | bend-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Multiattack** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Overwhelming Radiance** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Pact Bond** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Paralyzing Touch** | actors | — | NATIVE | the pack resolves it: 1 effect [paralyzed], an attack | — | — |
| monster | **Protective Magic** | actors | reaction | NATIVE | Counterspell and Shield are the archmage's own spells — the hold offers Shield by name | — | — |
| monster | **Prowl** | actors | movement | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Recuperative Teleport** | actors | clock | NATIVE | the pack's heal | — | — |
| monster | **Rend** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Shadow Stalker** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Siege Monster** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Slam** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Sling** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Slow** | actors | — | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*); `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `SPENT_AREAS` (saves/areas.js; RULINGS *Rulings the code carried · Save demands and their areas*) | — | — |
| monster | **Spell Imprint** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spell Mimicry** | actors | half-on-save | NATIVE | the save; the follow-up damage at the end of the target's next turn is the table's | — | — |
| monster | **Spellcasting** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spore Spray** | actors | clock, press-condition | WAITS | the extra damage on an already-Poisoned target — a `CLOCK_RIDERS` judge on the target's status, its first customer | — | — |
| monster | **Sunlight Sensitivity** | actors | — | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Superior Magic Resistance** | actors | bend-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Talented** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Telekinesis** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Teleport** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Tough** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Twist Away** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Vestige's Strike** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
