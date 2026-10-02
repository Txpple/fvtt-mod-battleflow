# Ravenloft: The Horrors Within — the register

> Generated 2026-10-02 by `tools/audit-splat-register.mjs ravenloft` from the OFFLINE corpus (`tools/scan-corpus-offline.mjs`, every pack of
> `dnd-ravenloft-horrors-within`, 502 rows) joined with `scripts/decide/registry.js`, RULINGS' walk tables and bend registers, and the
> drawing's hand verdicts ([drawings/splat-ravenloft.md](drawings/splat-ravenloft.md) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.
>
> **In scope**: NATIVE — the pack and the platform resolve it (the sheet's effects, the saves machine, the applier, the gate and the
> receipts already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS section to read); ROW — a row
> on a machine that exists, to build, the precedent named; TABLE — a new table that is not a kind; KIND — a new kind (the R4 tripwire
> moves); **WAITS** — drawn on a machine that exists, held for its first customer or a measurement; TEXT — a paragraph only, or no combat
> mechanism; OUT — held out by a ruling, the reason in *Why not*. **Kind**: species · subclass (its feature, the subclass named) · option
> (nothing grants it) · feat · spell · item · gift · monster (the bestiary's traits, actions and reactions, one row per name).

**502 rows (6 species · 37 subclasss · 11 feats · 1 spell · 67 items · 380 monsters): 226 NATIVE · 59 MODULE · 0 ROW · 0 TABLE · 0 KIND · 183 TEXT · 20 OUT · 14 WAITS.**

| Kind | Row | Where | Families | In scope | Why not / how | Rule of cool / bend | Walked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| species | **Spider Climb Improvement** | Dhampir | movement | TEXT | movement | — | — |
| species | **Eerie Token** | Hexblood | — | NATIVE | the pack's enchant and its two uses; the messaging is the table's | — | — |
| species | **Howl** | Lupin | bend-attack, clock, press-condition, aura | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — the pack's save; the landed "Attack and Save Disadvantage" is `EFFECT_BENDS` (a row that already stood) | — | — |
| species | **Escaped Death** | Reborn | bend-save | NATIVE | the pack's Advantage effect on Death Saving Throws | — | — |
| species | **Everlasting** | Reborn | — | TEXT | rests and sleep | — | — |
| species | **Knowledge from a Past Life** | Reborn | — | MODULE | `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) — +1d6 on your own failed ability check — `INTERRUPT_ROLLS` the roller's own, a use spent | — | — |
| subclass | **Channeler** | College of Spirits | — | TEXT | a cantrip and a focus | — | — |
| subclass | **Empowered Channeling** | College of Spirits | clock | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*) — Power from Beyond's 1d6 on a Bard spell's damage once per turn (`DAMAGE_RULES`; the healing half and "with a spell slot" are the table's); Spiritual Manifestation's Half Cover for allies in Spirit Guardians WAITS (a helpful member effect from another feature's pick) | — | — |
| subclass | **Mystical Connection** | College of Spirits | — | TEXT | the table roll | — | — |
| subclass | **Spirits from Beyond** | College of Spirits | — | TEXT | the spirit table and its unleash are the sheet's activities | — | — |
| subclass | **Circle of Mortality** | Grave Domain | rider-damage, clock | MODULE | `HEAL_REROLLS` (heal-rerolls.js · cast.js; RULINGS *The spells slice — Tiers 1 and 2*); `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) — Pull of Death rides a hit on a damaged creature once per turn (`CLOCK_RIDERS`; a spell's damage without an attack roll is the table's); Return to Life maxes the healing dice on a creature at 0 (`HEAL_REROLLS` `atZero`) | — | — |
| subclass | **Divine Reaper** | Grave Domain | temp-hp, aura | MODULE | `HEAL_ON_HIT` (heal-on-hit.js; RULINGS *The spells slice — the held spells*) — Keeper of Souls: an enemy dies within 60 ft — the heal offered to one creature within 60 ft, the use spent (`HEAL_ON_HIT` on kill); Enhanced Necromancy's second target WAITS (a cast's extra target, its first customer) | — | — |
| subclass | **Grave Domain Spells** | Grave Domain | — | TEXT | a spell list | — | — |
| subclass | **Path to the Grave** | Grave Domain | bend-attack, clock | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*); `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) — the Curse is the pack's effect, its Disadvantage a bend that already stood; End Curse Early rides ANY ally's hit on the cursed creature and ends the curse (`CLOCK_RIDERS` `marked` + `owner: "marker"` + `endsMark`); Necrotic or Radiant is the pick on the offer | — | — |
| subclass | **Sentinel at Death's Door** | Grave Domain | interrupt, reaction, crit | MODULE | `INTERRUPT_MULTIPLIERS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) — the hit on you: Uncanny Dodge's half (`INTERRUPT_MULTIPLIERS`); the Bloodied ally within 60 ft and the Critical Hit's effects cancelled WAIT (an ally guard on the multiplier hold and a crit cancel, their first customers) | — | — |
| subclass | **Ancient Might** | Hollow Warden | rider-damage, resist | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*); `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) — Ominous Strikes: Wisdom modifier on a hit against a Frightened target (`CLOCK_RIDERS` `targetStatus`); Persistent Wrath: the drop held at twice the ranger's level while the form stands (`DROP_TO_ONE` ask + `heal` + `while`); Timeless is the pack's | — | — |
| subclass | **Hollow Warden Spells** | Hollow Warden | — | TEXT | a spell list | — | — |
| subclass | **Hungering Might** | Hollow Warden | clock, temp-hp | MODULE | the heal is Wrath of the Wild's own activity — the row keyed there; the Constitution bonus is the pack's effect | — | — |
| subclass | **Rot and Violence** | Hollow Warden | clock, temp-hp | NATIVE | Menacing Aura is the pack's effect on the aura's failure; Strangling Roots' second mastery is the table's | — | — |
| subclass | **Wrath of the Wild** | Hollow Warden | clock, press-condition, movement | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*); `HEAL_ON_HIT` (heal-on-hit.js; RULINGS *The spells slice — the held spells*); `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — Transform Self is the pack's enchant; Unnerving Aura a ring while Ghastly Form stands, pulsing at the ranger's turn START (`EMANATIONS`, Frozen Haunt's row); Prowling Retribution an Opportunity Attack when a creature within 5 ft damages you or an ally (`REBUKES` `ward` + `opportunity`); Hungering Might heals 1d10 + Wis on your hit while transformed and Bloodied, once per turn (`HEAL_ON_HIT` `on: "hit"`) | — | — |
| subclass | **Death's Friend** | Phantom | — | WAITS | Death's Lament: Wails' dice on BOTH creatures — the spread's second target doubled, its first customer; Draw of Death: a soul trinket at Initiative — the trinkets are items the pack does not count | — | — |
| subclass | **Ghost Walk** | Phantom | movement | NATIVE | the pack's effect; the trinket destroyed to restore it is the table's | — | — |
| subclass | **Tokens of the Departed** | Phantom | reaction, aura | WAITS | Claim Departed Spirit: a Reaction when a creature within 30 ft dies — the death moment's rebuke, its first customer; the trinkets are items | — | — |
| subclass | **Voice of Death** | Phantom | — | TEXT | a cast from the sheet | — | — |
| subclass | **Wails from the Grave** | Phantom | — | MODULE | `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) — after Sneak Attack damage, a second creature within 30 ft of the first takes half the Sneak dice as Necrotic (`CLOCK_RIDERS` `spread` + `requires: "sneak"`), a use spent | — | — |
| subclass | **Whispers of the Dead** | Phantom | — | TEXT | proficiencies | — | — |
| subclass | **Improved Reanimation** | Reanimator | — | OUT | the companion's — issue #1 | — | — |
| subclass | **Macabre Modifications** | Reanimator | — | OUT | the companion's — issue #1 | — | — |
| subclass | **Reanimated Companion** | Reanimator | aura | OUT | summons-shaped — GitHub issue #1 | — | — |
| subclass | **Reanimator Spells** | Reanimator | — | TEXT | a spell list | — | — |
| subclass | **Reanimator's Skill Set** | Reanimator | — | TEXT | proficiencies | — | — |
| subclass | **Refined Reanimation** | Reanimator | reaction | OUT | Life Transfer reads the companion — issue #1; Facilitated Revival is a cast | — | — |
| subclass | **Strange Modifications** | Reanimator | — | OUT | the companion's — issue #1 | — | — |
| subclass | **Beasts of Ill Omen** | Shadow Sorcery | bend-save, concentration | OUT | summons-shaped — issue #1 | — | — |
| subclass | **Power of Shadow** | Shadow Sorcery | half-on-save | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*) — Strength of the Grave: the drop held while the Charisma save rolls (DC 5 + the damage), the success sets the Hit Points to Cha + level (`DROP_TO_ONE` Relentless Rage's row), once per Long Rest; Eyes of the Dark is the pack's | — | — |
| subclass | **Shadow Spells** | Shadow Sorcery | — | TEXT | a spell list | — | — |
| subclass | **Shadow Walk** | Shadow Sorcery | — | TEXT | a teleport | — | — |
| subclass | **Umbral Form** | Shadow Sorcery | resist, movement | NATIVE | the pack's effect and uses | — | — |
| subclass | **Form of Dread** | Undead Patron | clock, press-condition, temp-hp, resist | WAITS | Frightful Avatar: a "you can" save on a hit once per turn while the form stands — a `CLOCK_RIDERS` save rider with a `while`, its first customer; the Temporary Hit Points and the immunity are the pack's | — | — |
| subclass | **Grave Touched** | Undead Patron | rider-damage, clock, resist | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*) — Arcane Necrosis: Necrotic ignores Resistance (`DAMAGE_RULES`); the type change and Dreaded Necrosis' extra die WAIT (a spell's type swapped on the cast; an extra die while a form stands) | — | — |
| subclass | **Necrotic Husk** | Undead Patron | press-condition, half-on-save, resist | WAITS | Unholy Resuscitation: the drop's burst save at everyone within 30 ft and the Hit Points set to twice the level — Death Throes' use on a survivor, its first customer; Necrotic Resilience is the pack's | — | — |
| subclass | **Superior Dread** | Undead Patron | resist, movement | NATIVE | the pack's resistances and flight; Profane Casting is the table's | — | — |
| subclass | **Undead Spells** | Undead Patron | — | TEXT | a spell list | — | — |
| feat | **Aberrant Anatomy** |  | clock, press-condition | MODULE | `MISHAPS` — Warping Flesh: a 1 on any D20 Test forces the pack's Constitution save (`MISHAPS`), Stunned on the failure; the rest is the sheet's | — | — |
| feat | **Echoing Soul** |  | clock, press-condition, movement | MODULE | `MISHAPS` — Intrusive Echoes: the mishap save (`MISHAPS`), Incapacitated on the failure | — | — |
| feat | **Gathered Whispers** |  | clock, interrupt, reaction, press-condition | MODULE | `MISHAPS` — Voices from Beyond: the mishap save (`MISHAPS`), Deafened on the failure; Unearthly Scream WAITS (+PB to AC against the hit — a Reaction AC bonus the pack ships without an effect; the ac kind reads the effect that lands, its first customer with none); the casts are the sheet's | — | — |
| feat | **Living Shadow** |  | clock, press-condition | MODULE | `MISHAPS` — Ominous Will: the mishap save (`MISHAPS`), Incapacitated on the failure (the Shadow's Will table is the table's); Lengthened Strike's reach is the table's | — | — |
| feat | **Mist Walker** |  | reaction, press-condition | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — Mist Walk: a Reaction on damage, the teleport from the sheet (`REBUKES` Misty Escape's row); the failed-save trigger and Poisoned Roots are the table's | — | — |
| feat | **Second Skin** |  | clock, press-condition, concentration | NATIVE | the catalyst is the table's; the save and the cast are the sheet's | — | — |
| feat | **Sharp Eye** |  | — | TEXT | Search and Study | — | — |
| feat | **Survivor** |  | reaction, d20-fold | MODULE | `D20_FLOORS` (d20-folds.js; RULINGS *The PHB classes — D1*) — Hypervigilance: the Initiative d20 of 9 or lower offered a reroll (`INITIATIVE_GRANTS` `reroll`); Steel Yourself: your own failed save against Charmed or Frightened lifted by your Proficiency Bonus (`INTERRUPT_ROLLS` the roller's own; once per Long Rest is the table's — the pack's activity carries no use to count); told apart from the Fighter's Survivor by the feat subtype (`FEATURE_TYPES`) | — | — |
| feat | **Symbiotic Being** |  | reaction, press-condition | MODULE | `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) — Sustained Symbiosis: a Hit Die added to your own failed save (`INTERRUPT_ROLLS`, the largest die); Symbiotic Agenda: the mishap save (`MISHAPS`), Charmed on the failure, repeated when damaged (`REPEAT_SAVES`) | — | — |
| feat | **Touch of Death** |  | bend-save | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*) — the feat: Death Touch's Chill Touch Necrotic ignores Resistance (`DAMAGE_RULES` `spell`), Pull of the Grave the pack's effect; Ankhtepot's action of the same name is the GM's read ("80 Hit Points or fewer dies") and is told apart by the feat subtype (`FEATURE_TYPES`) | — | — |
| feat | **Watchers** |  | bend-save, press-condition, half-on-save | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Incessant Watchers: the mishap save (`MISHAPS`); Paranoia's Disadvantage on D20 Tests is a bend, repeated at the turn end (`REPEAT_SAVES`); Heightened Suspicion is the table's | — | — |
| spell | **Jolt to Life** |  | press-condition, half-on-save, temp-hp | WAITS | the Lightning save at the healed creature's area when Spare the Dying is cast — Hunter's Rime's `use` aimed at the target with a pick, its first customer | — | — |
| item | **Animated Digits** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Arcane Conduit** |  | clock | OUT | the companion's — issue #1 | — | — |
| item | **Ashes of a Corpse** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Barovian Wine Bottle** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Black Rose** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Bloated** |  | — | OUT | the companion's — issue #1 | — | — |
| item | **Blood Faction Gear** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Bloodstained Farm Implement** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Broken Holy Symbol** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Broken Jewelry** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Burnt Armor** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Canopic Jar** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Charm of the Black Rose** |  | — | NATIVE | the pack's cast and effect | — | — |
| item | **Coin from Darkon** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Death Mask** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Displacer beast skin** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Dram of Sweet-Smelling Poison** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Dried Crown of White Camellias** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Ebonbane** |  | bend-save, press-condition, d20-fold | NATIVE | the +3 and the 3d6 Necrotic are on the pack's attack for every target — strike the Necrotic by hand against a creature that is neither Celestial nor Humanoid; the saving-throw Advantage and Insatiable Rage are the table's | — | — |
| item | **Eye of Hazlik Amulet** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Faded Love Letter** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Family Portrait** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Feathered Mask** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Ferocity** |  | — | OUT | the companion's — issue #1 | — | — |
| item | **Flame-Singed Love Letter** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Gaunt** |  | clock, press-condition, movement | OUT | the companion's — issue #1 | — | — |
| item | **Glass Shoe** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Glowing Minerals** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Gold Shoe** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Great Cthulhu Effigy** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Gremishka Foot** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Handbill** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Harkon's Bite** |  | d20-fold | NATIVE | the pack's +1 effect; the curse is the table's | — | — |
| item | **Jeweled Mask** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Lapis Lazuli Scarab** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Letter from Leka** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Mark of Beasts** |  | — | NATIVE | the pack's cast | — | — |
| item | **Mark of Obsession** |  | clock, reaction, press-condition, half-on-save | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — a Reaction after damage from a creature within 10 ft: the pack's save at the damager, Frightened on the failure (`REBUKES`), once per Long Rest | — | — |
| item | **Mark of Sacrifice** |  | bend-save | NATIVE | the pack's cast | — | — |
| item | **Mark of the Dread Lord** |  | — | NATIVE | the pack's cast | — | — |
| item | **Mark of the Raven Talisman** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Moist** |  | — | OUT | the companion's — issue #1 | — | — |
| item | **Poisonous Flower Blossom** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Polished Skull** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Preserved Humanoid Limb** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Red Robe Scrap** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Religious Relic** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Rusted Tulwar** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Rusty Foot Trap** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Sahuagin-Tooth Fishing Lure** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Scrap of Black Fabric** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Scroll of Hieroglyphics** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Spell Scroll: Protection from Evil and Good** |  | concentration | NATIVE | the pack's cast | — | — |
| item | **Starmetal Amulet** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Starmetal Rod** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Straw Doll** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Symbol of the Circle** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Tainted Spring Water** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Tarnished Signet Ring** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Three Thorns** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Unbreakable Heart** |  | resist | NATIVE | the Raise Dead and the sickness are the pack's effects; the Dim Light is the token's own light setting — the table's | — | — |
| item | **von Zarovich Crest** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Wolf’s Tooth Necklace** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Woodcut of Hunting Wolves** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Worn Fine Clothing** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Wyvern-and-Lotus Shield** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Zombie Flesh** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Abduct** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Aberrant Restoration** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Activate Constructs** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Advance** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Air Form** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Amphibious** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Apocalyptic Visions** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, damage, uses | — | — |
| monster | **Arcane Strike** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Arcane Teleport** | actors | — | NATIVE | the pack resolves it: damage | — | — |
| monster | **Artillery Fire** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [prone], a save, damage, uses | — | — |
| monster | **Ascend** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Aura of Violence** | actors | — | WAITS | a save at the source's turn end whose FAILURE is a forced Reaction attack, the damage only when nothing is in reach — the GM's read on each failure, held | — | — |
| monster | **Barb** | actors | clock | NATIVE | the pack resolves it: 1 effect [poisoned], an attack, damage | — | — |
| monster | **Barbed Spear** | actors | — | NATIVE | the pack resolves it: 1 effect, an attack, damage | — | — |
| monster | **Beak (Raven or Hybrid Form Only)** | actors | resist | NATIVE | the pack resolves it: 1 effect [cursed], a save, an attack | — | — |
| monster | **Beheading Blade** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Bite (Bat or Vampire Form Only)** | actors | temp-hp | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Bite (Dire Wolf or Hybrid Form Only)** | actors | resist | NATIVE | the pack resolves it: 1 effect [cursed], a save, an attack, damage | — | — |
| monster | **Bite (Individual Form Only)** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Blessed Dagger** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Blood Frenzy** | actors | bend-attack | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Blood Puppeteering** | actors | bend-save, resist | NATIVE | the pack's save; the Bloodied target is the GM's | — | — |
| monster | **Blood Spew** | actors | half-on-save, temp-hp | NATIVE | the pack resolves it: 1 effect, a save, damage, uses | — | — |
| monster | **Bloodthirsty Slash** | actors | reaction, movement | WAITS | a Reaction when an already-Bloodied creature within 40 ft takes damage — Bloodthirst's watch on a STATE, its first customer | — | — |
| monster | **Bolster Allies** | actors | bend-attack, clock, use-chip, resist | NATIVE | the pack's two effects; Adv. Next Attack's chip is a bend that already stood | — | — |
| monster | **Bolster Inventions** | actors | press-condition, temp-hp | WAITS | Temporary Hit Points to Construct allies inside at the turn end — a helpful pulse heal, its first customer | — | — |
| monster | **Bone-Chilling Step** | actors | — | NATIVE | the pack resolves it: damage | — | — |
| monster | **Brain-Rending Bite** | actors | — | NATIVE | the pack resolves it: 1 effect [frightened], an attack, damage | — | — |
| monster | **Brand** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Cataclysmic Fire** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Charm** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Chew** | actors | — | NATIVE | the pack resolves it: 2 effects [coverHalf, restrained, prone], a save, damage | — | — |
| monster | **Clamp** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Coagulated Nodule** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Cold Sprint** | actors | reaction | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — a Reaction to Cold damage (`REBUKES` `types`), the move and the attack from the sheet | — | — |
| monster | **Commanding Magic** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Compression** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Consume Energy** | actors | clock, half-on-save, temp-hp, movement | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| monster | **Cosmic Transformation** | actors | — | NATIVE | the pack resolves it: damage | — | — |
| monster | **Count’s Command** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Crush** | actors | — | NATIVE | the pack resolves it: 1 effect [restrained, suffocation], a save, damage | — | — |
| monster | **Crushing Insult** | actors | bend-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Crushing Stone** | actors | — | NATIVE | the pack resolves it: 1 effect [incapacitated], an attack | — | — |
| monster | **Curse of the All-Seeing Eye** | actors | — | NATIVE | the pack's save and its thirteen typed curses — the pick is the GM's | — | — |
| monster | **Cursed Dagger** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Darkflame Slash** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Darklord Restoration** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Dazing Ray** | actors | — | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage, uses | — | — |
| monster | **Deadly Contraption** | actors | — | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Death Burst** | actors | half-on-save | OUT | the companion's — issue #1 | — | — |
| monster | **Death Curse** | actors | — | NATIVE | the pack resolves it: 1 effect [deafened], a save | — | — |
| monster | **Death Strike** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Deathly Stench** | actors | clock | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) — any creature starting its turn inside saves (`EMANATIONS`) | — | — |
| monster | **Deflect Blow** | actors | interrupt, reaction | MODULE | `INTERRUPT_REDUCTIONS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) — a reduction of 1d10 for Laurie or a creature within 5 ft (`INTERRUPT_REDUCTIONS` `amount` + `ally`) | — | — |
| monster | **Detect Intelligence** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Disrupting Burst** | actors | bend-save, clock, concentration | NATIVE | the pack resolves it: 1 effect, an attack | — | — |
| monster | **Dread Authority** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Dread Blade** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Dreadful Impaling** | actors | clock | WAITS | the target's allies save on a hit — a hit's save at creatures other than the target, its first customer | — | — |
| monster | **Dreadful Swipe** | actors | clock, movement | OUT | the companion's — issue #1 | — | — |
| monster | **Dreamwalk** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Drink Sapience** | actors | temp-hp | NATIVE | the pack resolves it: 1 effect [exhaustion], a save, damage | — | — |
| monster | **Eldritch Burst** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Eldritch Claw** | actors | — | NATIVE | the pack resolves it: 1 effect [grappled], an attack, damage | — | — |
| monster | **Eldritch Magic** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Eldritch Teleport** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Enthralling Performance (Humanoid Form Only)** | actors | — | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| monster | **Entrapping Pod** | actors | — | NATIVE | the pack resolves it: 2 effects [blinded, paralyzed, prone], a save | — | — |
| monster | **Esoteric Ward** | actors | clock | NATIVE | the pack's save, damage and Stunned | — | — |
| monster | **Evil Eye** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Executioner’s Blade** | actors | — | NATIVE | the pack resolves it: 1 effect, an attack | — | — |
| monster | **Exhausting Gaze** | actors | — | NATIVE | the pack resolves it: 1 effect [exhaustion], a save, damage | — | — |
| monster | **Experienced Hunter** | actors | movement | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Exploding Head** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [poisoned], a save, damage | — | — |
| monster | **Extract Brain (Requires Silver Canister)** | actors | press-condition, half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Face of Death** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, damage, uses | — | — |
| monster | **Fated Bullet** | actors | clock, temp-hp | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| monster | **Fiery Bolt** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Fiery Skull** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Flesh Entomb** | actors | resist | NATIVE | the pack resolves it: 1 effect [coverTotal, restrained], a save, damage, uses | — | — |
| monster | **Fold Space** | actors | clock, half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Forbidden Knowledge** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage | — | — |
| monster | **Force Blade** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Forced Mutations** | actors | clock | NATIVE | the pack resolves it: 1 effect [paralyzed], a save | — | — |
| monster | **Foreleg** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Forsaken Brand** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Gossamer** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Greater Lightning Absorption** | actors | clock, temp-hp, movement | TEXT | the heal on Lightning damage is the GM's dice (the Monster Manual's Lightning Absorption) | — | — |
| monster | **Hand Crossbow** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Hand of Fate** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Haunter’s Spear** | actors | — | NATIVE | the pack resolves it: 1 effect [exhaustion], an attack, damage | — | — |
| monster | **Head Fruits** | actors | reaction | TEXT | the allies' Reactions are their own | — | — |
| monster | **Headless Wail** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, damage | — | — |
| monster | **Homing Knife** | actors | — | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Howling Wind** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [deafened, frightened], a save, damage, uses | — | — |
| monster | **Hungering Stride** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Hunter’s Blade** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Hunting Rifle** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Illusory Disguise** | actors | bend-save | NATIVE | the pack resolves it: 1 effect [frightened], a save | — | — |
| monster | **Immutable Form** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Impaling Spear** | actors | — | NATIVE | the pack resolves it: 1 effect [restrained], an attack, damage | — | — |
| monster | **Implacable Advance** | actors | clock, movement | NATIVE | the pack's save; the path is the table's | — | — |
| monster | **Implode** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Impossible Geometry** | actors | movement | NATIVE | the pack resolves it: damage | — | — |
| monster | **Incomprehensible Form** | actors | press-condition | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Displacement's row: attacks against it at Disadvantage unless Incapacitated | — | — |
| monster | **Incorporeal Movement** | actors | movement | NATIVE | the pack resolves it: damage | — | — |
| monster | **Infestation** | actors | — | NATIVE | the pack's attack and the hour-later save — the GM's | — | — |
| monster | **Inquisitor’s Command** | actors | — | NATIVE | the pack resolves it: 1 effect [charmed], a save, uses | — | — |
| monster | **Inspiring Rally** | actors | reaction, movement | TEXT | the allies' Reaction moves | — | — |
| monster | **Instill Dread** | actors | — | NATIVE | the pack's save and Frightened | — | — |
| monster | **Invert Flesh** | actors | — | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Jiangshi Weaknesses** | actors | bend-save, resist | TEXT | the reflection and the holy symbol are the table's | — | — |
| monster | **Lash Out** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Lashing Maw** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Lie Detector** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Life Drain** | actors | half-on-save | MODULE | `DRAINS` (drains.js; RULINGS *The Monster Manual — the waiting rows built*) | — | — |
| monster | **Light Crossbow** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Lightning Absorption** | actors | temp-hp | OUT | the companion's — issue #1 | — | — |
| monster | **Lightning Rod** | actors | clock | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Longsword** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Longsword (Humanoid or Hybrid Form Only)** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Lunge** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Magic Allergy (Individual Form Only)** | actors | reaction | OUT | cast-triggered | — | — |
| monster | **Mauling Charge** | actors | movement | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Meltable** | actors | bend-save, clock | WAITS | an effect landed on taking Fire damage — a damage-typed trigger with no Reaction, its first customer | — | — |
| monster | **Metabolic Control** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Mimicry** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Mind Blast** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [incapacitated], a save, damage, uses | — | — |
| monster | **Mind Burst** | actors | — | NATIVE | the pack resolves it: 1 effect [incapacitated], a save, uses | — | — |
| monster | **Mind Fire** | actors | — | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage | — | — |
| monster | **Mind Rend** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Mind Swap** | actors | resist | NATIVE | the pack resolves it: 2 effects [incapacitated, stunned], a save, uses | — | — |
| monster | **Mind-Scouring Spores** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Mist Walker** | actors | — | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — Mist Walk: a Reaction on damage, the teleport from the sheet (`REBUKES` Misty Escape's row); the failed-save trigger and Poisoned Roots are the table's | — | — |
| monster | **Misty Escape** | actors | — | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*); `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | bend | — |
| monster | **Mother’s Brand** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Mother’s Visage** | actors | bend-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, uses | — | — |
| monster | **Narcotize** | actors | — | NATIVE | the pack resolves it: 1 effect [unconscious], damage | — | — |
| monster | **Necrotic Bolt** | actors | temp-hp | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Necrotic Burst** | actors | temp-hp | NATIVE | the pack resolves it: 1 effect [poisoned], an attack, damage | — | — |
| monster | **Negative Energy Burst** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Nightmarish Restoration** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Object Slam** | actors | — | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Occult Aid** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **One With the Mists** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Order Ballista** | actors | clock | NATIVE | the pack resolves it: 1 effect, a save, damage | — | — |
| monster | **Overhanging Branches** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Overwhelming Presence** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Parry** | actors | reaction | MODULE | `INTERRUPT_REDUCTIONS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| monster | **Petrifying Bite** | actors | — | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| monster | **Phantasmic Assault** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Pike** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Pincer** | actors | — | NATIVE | the pack resolves it: 1 effect [grappled], an attack, damage | — | — |
| monster | **Podling Link** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Possess Dead** | actors | movement | TEXT | no combat mechanism | — | — |
| monster | **Possessive Aura** | actors | — | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) — a creature ENDING its turn inside saves (`EMANATIONS` trigger turnEnd); the Charmed's repeat at its turn end is the pack's second save, used by hand | — | — |
| monster | **Pounce** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Proboscis** | actors | temp-hp | MODULE | `DRAINS` (drains.js; RULINGS *The Monster Manual — the waiting rows built*) | — | — |
| monster | **Protective Swarm** | actors | clock, concentration | WAITS | an area raised by the trait's use, lasting with Concentration — the spell kind on a monster's trait, its first customer | — | — |
| monster | **Pseudopod** | actors | — | NATIVE | the pack resolves it: 1 effect [grappled], an attack, damage | — | — |
| monster | **Psychic Skewer** | actors | press-condition | NATIVE | the pack resolves it: 1 effect [exhaustion, stunned], a save, damage | — | — |
| monster | **Punish** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Quarterstaff** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Radiant Burst** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Radiant Flame** | actors | — | NATIVE | the pack resolves it: 1 effect [blinded], an attack | — | — |
| monster | **Radiant Wisp** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Ravenous Bites** | actors | — | MODULE | `TURN_GRANTS` (turn-grants.js; RULINGS *The spells slice — Tiers 1 and 2*) — the pack's attack (the Bloodied attack the GM's pick); the 1d8 at the Poisoned creature's turn start is `TURN_GRANTS` (Spores' row) | — | — |
| monster | **Reborn By Blood** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Redirect Attack** | actors | reaction | OUT | the redirect kind | — | — |
| monster | **Regeneration** | actors | — | MODULE | `TURN_GRANTS` (turn-grants.js; RULINGS *The spells slice — Tiers 1 and 2*) | bend | — |
| monster | **Rejuvenation** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Rend (Dire Wolf or Hybrid Form Only)** | actors | — | NATIVE | the pack resolves it: 1 effect [prone], an attack | — | — |
| monster | **Repel Evil** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, damage, uses | — | — |
| monster | **Retaliate** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Rotten Flesh** | actors | clock | NATIVE | the pack's attack, the Bloodied attack the GM's pick | — | — |
| monster | **Runic Flare** | actors | clock | NATIVE | the pack resolves it: 1 effect [blinded], a save | — | — |
| monster | **Sands of Time** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Scratch** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Sculpting Knife** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Semblance of Life** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Shadow Veil** | actors | — | TEXT | no combat mechanism | — | — |
| monster | **Shape-Shift** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Shield** | actors | reaction | MODULE | `INTERRUPTS` (hold/; RULINGS *The reaction hold*); `BLOCKS` (hold/; RULINGS *The reaction hold*) | bend | — |
| monster | **Shield Bash** | actors | — | NATIVE | the pack resolves it: 1 effect [prone], a save, damage | — | — |
| monster | **Shield of Erasmus** | actors | resist | TEXT | no combat mechanism | — | — |
| monster | **Shielded Mind** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Shocking Prod** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Shortbow (Humanoid or Hybrid Form Only)** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Silver Canister** | actors | resist | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Silver Needle** | actors | — | NATIVE | the pack resolves it: 1 effect [cursed, poisoned], a save, an attack | — | — |
| monster | **Silver Sword Cane** | actors | crit | NATIVE | the pack resolves it: 1 effect [poisoned], a save, an attack, damage | — | — |
| monster | **Silvered Longsword** | actors | crit | NATIVE | the pack resolves it: 1 effect [frightened], an attack, damage | — | — |
| monster | **Siphon Spell** | actors | reaction | OUT | cast-triggered (Counterspell) | — | — |
| monster | **Skeletonize** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Slam** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Slasher’s Knife** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Smother** | actors | — | MODULE | `TURN_GRANTS` (turn-grants.js; RULINGS *The spells slice — Tiers 1 and 2*) | — | — |
| monster | **Soothing Tentacle** | actors | — | NATIVE | the pack resolves it: 1 effect [charmed], an attack | — | — |
| monster | **Soth’s Command** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Soul Blade** | actors | — | NATIVE | the pack resolves it: 1 effect [paralyzed], an attack | — | — |
| monster | **Soul Swap** | actors | — | NATIVE | the pack resolves it: 1 effect [unconscious], a save, uses | — | — |
| monster | **Soul Tattoo** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spider Climb** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Static Explosion** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Stifling Perfume** | actors | — | NATIVE | the pack resolves it: 1 effect [prone], a save, damage, uses | — | — |
| monster | **Stinger** | actors | — | NATIVE | the pack resolves it: 1 effect [poisoned], a save, an attack, damage | — | — |
| monster | **Stirge Telepathy** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Strange Modifications** | actors | — | OUT | the companion's — issue #1 | — | — |
| monster | **Striding Strike** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Strike from Shadows** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Suction Burst** | actors | clock, press-condition, half-on-save | NATIVE | the pack resolves it: 1 effect [stunned, deafened], a save, damage, uses | — | — |
| monster | **Sudden Bite** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Sunlight Hypersensitivity** | actors | bend-attack | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Sup** | actors | temp-hp | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Suppressed Lycanthropy** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Surprise Bite** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Susceptible to Charm** | actors | bend-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Disadvantage on saves against Charmed (`EFFECT_BENDS` `saves` + `against`) | — | — |
| monster | **Swarm** | actors | temp-hp | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Swarm (Swarm Form Only)** | actors | temp-hp | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Swarming Bites (Swarm Form Only)** | actors | — | NATIVE | the pack's attack, the Bloodied attack the GM's pick; the Attunement ended is the table's | — | — |
| monster | **Sweeping Blade** | actors | — | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Swipe (Dire Wolf or Hybrid Form Only)** | actors | — | NATIVE | the pack resolves it: 1 effect [prone], an attack | — | — |
| monster | **Syringe** | actors | bend-save, concentration, temp-hp | NATIVE | the pack resolves it: 4 effects [poisoned], a save, damage | — | — |
| monster | **Tattoo of Osybus** | actors | clock, temp-hp, resist, movement | WAITS | a drop that revives with a random boon — Death Throes' side with a table, its first customer | — | — |
| monster | **Teleporting Lash** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Tentacle** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Tentacles** | actors | — | NATIVE | the pack resolves it: 1 effect [grappled], an attack | — | — |
| monster | **Terrifying Aura** | actors | clock, resist | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) — an aura: any enemy starting its turn inside saves (`EMANATIONS` trigger turnStart, off while Incapacitated); the 24-hour immunity is the table's | — | — |
| monster | **Terrifying Topography** | actors | bend-save | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Terrorizer** | actors | bend-attack | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Advantage against a Frightened target (`EFFECT_BENDS` `judge: "targetStatus"`) | — | — |
| monster | **Throw** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [prone], a save, damage | — | — |
| monster | **Tickle** | actors | — | NATIVE | the pack resolves it: 1 effect [incapacitated], a save | — | — |
| monster | **Touch of Death** | actors | — | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*) — the feat: Death Touch's Chill Touch Necrotic ignores Resistance (`DAMAGE_RULES` `spell`), Pull of the Grave the pack's effect; Ankhtepot's action of the same name is the GM's read ("80 Hit Points or fewer dies") and is told apart by the feat subtype (`FEATURE_TYPES`) | — | — |
| monster | **Toxic Touch** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Toxin Wave** | actors | clock | NATIVE | the pack resolves it: 1 effect [poisoned], a save | — | — |
| monster | **Transfer Harm** | actors | interrupt, reaction | OUT | the redirect kind (BACKLOG *Scoped out for good*) | — | — |
| monster | **Trapped Ground** | actors | clock | WAITS | a placed area ending at the source's next turn end — the `area` kind with a turn clock, its first customer | — | — |
| monster | **Tree Stride** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Truth Or Die** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Twist** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Undead Fortitude** | actors | crit | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*) | bend | — |
| monster | **Unearthly Bile** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Unholy Regrowth** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Unraveling Flesh** | actors | movement | NATIVE | the pack's save and Frightened; the move is the table's | — | — |
| monster | **Vampire Weakness** | actors | bend-attack, press-condition | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — the Monster Manual's bend fires by name | — | — |
| monster | **Vampiric Longsword** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Vanishing Strike** | actors | clock | TEXT | an attack and a teleport | — | — |
| monster | **Vengeful Fire** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Vine** | actors | — | NATIVE | the pack resolves it: 1 effect [grappled], an attack | — | — |
| monster | **Violent Leap** | actors | — | NATIVE | the pack resolves it: 1 effect [prone], a save, damage | — | — |
| monster | **Viral Aura** | actors | clock, temp-hp, resist | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) — any creature starting its turn inside saves (`EMANATIONS`); the immunity is the table's | — | — |
| monster | **Virulent Miasma** | actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Warp** | actors | half-on-save | NATIVE | the pack resolves it: 1 effect [prone], a save, damage | — | — |
| monster | **Warp Body** | actors | clock | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage | — | — |
| monster | **Warp Mind** | actors | clock, reaction | WAITS | a Reaction to a Study action or a Concentration save — a cast-adjacent trigger, held | — | — |
| monster | **Wax Lob** | actors | clock | NATIVE | the pack resolves it: 1 effect, an attack | — | — |
| monster | **Whirling Blades** | actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Whirling Form** | actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Wild Magic Surge** | actors | clock, d20-fold | MODULE | `CAST_RIDERS` | rule of cool | — |
| monster | **Words of Silence** | actors | clock, half-on-save | NATIVE | the pack resolves it: 1 effect [cursed], a save, damage | — | — |
| monster | **Worthy Wielder** | actors | — | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Absorb Body** | fallback-actors | bend-save | NATIVE | the pack resolves it: 1 effect [restrained], a save | — | — |
| monster | **Antimagic Cone** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Astral Implosion** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Avoidance** | fallback-actors | press-condition, half-on-save | MODULE | `EVASIONS` (saves/consequences.js; RULINGS *The GM's side — the five shapes*) | — | — |
| monster | **Banishing Claw** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [incapacitated], a save, an attack, damage | — | — |
| monster | **Beguile** | fallback-actors | clock | NATIVE | a cast (Command) — the spell's own rows | — | — |
| monster | **Bejeweled Baton** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Blight Seeds** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Bound** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Charge** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Charged Tendril** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Chomp** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Cold Breath** | fallback-actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Confer Fire Resistance** | fallback-actors | resist | TEXT | no combat mechanism | — | — |
| monster | **Constrict** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 1 effect [grappled, restrained], a save, damage | — | — |
| monster | **Corrupting Touch** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Counterattack** | fallback-actors | reaction | MODULE | `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| monster | **Create Specter** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Cunning Action** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Deathly Ray** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Deathly Wail** | fallback-actors | — | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Decay** | fallback-actors | clock | NATIVE | the pack resolves it: damage | — | — |
| monster | **Detect Life** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Devour Intellect** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage | — | — |
| monster | **Displacement** | fallback-actors | press-condition | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Divine Aid** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Dread Scythe** | fallback-actors | clock, temp-hp | NATIVE | the pack resolves it: 1 effect, an attack, damage | — | — |
| monster | **Dreadful Glare** | fallback-actors | resist | NATIVE | the pack resolves it: 1 effect [frightened], a save | — | — |
| monster | **Earth Burst** | fallback-actors | — | NATIVE | the pack resolves it: a save, an attack, damage | — | — |
| monster | **Earth Glide** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Earthen Maul** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [prone], an attack | — | — |
| monster | **Elemental Absorption** | fallback-actors | reaction, resist | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | — | — |
| monster | **Elemental Claw** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Elemental Flail** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Elemental Restoration** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Engulf** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [restrained, suffocation, coverTotal], a save, damage | — | — |
| monster | **Enthralling Panache** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [charmed], a save | — | — |
| monster | **Ethereal Stride** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Extract Brain** | fallback-actors | half-on-save | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Eye Rays** | fallback-actors | clock, half-on-save, d20-fold, volley, temp-hp | NATIVE | the pack resolves it: 3 effects [poisoned, frightened, paralyzed], a save, damage | — | — |
| monster | **Fiendish Blood** | fallback-actors | reaction | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | bend | — |
| monster | **Fiendish Burst** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Fiendish Guile** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Fist** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Force Bolt** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Glare** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Grasping Glob** | fallback-actors | clock | TEXT | uses another action | — | — |
| monster | **Grave Strike** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Greatsword** | fallback-actors | bend-attack, use-chip, movement | NATIVE | the pack resolves it: 1 effect, an attack | — | — |
| monster | **Haunted Zone** | fallback-actors | — | OUT | cast-triggered (the spell fails inside) | — | — |
| monster | **Haunting Glare** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [paralyzed], a save, uses | — | — |
| monster | **Hellfire Orb** | fallback-actors | half-on-save | NATIVE | the pack resolves it: a save, damage, uses | — | — |
| monster | **Hellish Rebuke** | fallback-actors | reaction | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | bend | — |
| monster | **Hold Breath** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Holy Word** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage, uses | — | — |
| monster | **Hooves** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Horrify** | fallback-actors | resist | NATIVE | the pack resolves it: 1 effect [frightened], a save | — | — |
| monster | **Hunger of Hadar** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Hypnotic Gaze** | fallback-actors | resist | NATIVE | the pack resolves it: 1 effect [stunned], a save, damage | — | — |
| monster | **Illumination** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Invisibility** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Invitation** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [coverTotal], a save | — | — |
| monster | **Lashing Goop** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Life-Draining Root** | fallback-actors | temp-hp | NATIVE | the pack resolves it: 1 effect [grappled, restrained], a save, damage | — | — |
| monster | **Limited Amphibiousness** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Loathsome Limbs** | fallback-actors | temp-hp | TEXT | the GM's dice on a slashing hit, the limbs the sheet's | — | — |
| monster | **Longbow** | fallback-actors | clock | NATIVE | the pack resolves it: 1 effect, an attack | — | — |
| monster | **Majestic Song** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 2 effects [charmed, frightened], a save, damage | — | — |
| monster | **Maneuver** | fallback-actors | reaction, movement | TEXT | an ally's Reaction move | — | — |
| monster | **Mercurial Whip** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Mind Rot** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 1 effect [poisoned], a save, damage | — | — |
| monster | **Multiple Heads** | fallback-actors | temp-hp | TEXT | the GM's dice — a head dies at 25+ damage in a turn | — | — |
| monster | **Necrotic Bow** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Necrotic Sword** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Pact Axe** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Pact Blade** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Paralyzing Tentacles** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 2 effects [poisoned, paralyzed, grappled], a save, an attack | — | — |
| monster | **Poison Ray (Yuan-ti Form Only)** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Poison Spray** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 1 effect [blinded, poisoned], a save, damage, uses | — | — |
| monster | **Protection** | fallback-actors | interrupt, reaction | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*); `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | bend | — |
| monster | **Rapier** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Reactive Heads** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Restraining Glob** | fallback-actors | clock, half-on-save | NATIVE | the pack resolves it: 1 effect [restrained], a save, damage | — | — |
| monster | **Rotting Fist** | fallback-actors | temp-hp | NATIVE | the pack resolves it: 1 effect [cursed], an attack, damage | — | — |
| monster | **Rotting Slam** | fallback-actors | — | NATIVE | the pack resolves it: an attack, damage | — | — |
| monster | **Sanguine Drain** | fallback-actors | temp-hp | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Shadow Escape** | fallback-actors | — | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*) | — | — |
| monster | **Shark Telepathy** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Shield of Faith** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Sickening Ray** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [poisoned], an attack, damage | — | — |
| monster | **Smoke Bomb** | fallback-actors | half-on-save | NATIVE | the pack resolves it: 1 effect [blinded], a save, damage, uses | — | — |
| monster | **Soul Tome** | fallback-actors | resist | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spear** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Spell Storing** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spellcasting (Yuan-ti Form Only)** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spirit Wail** | fallback-actors | clock, half-on-save | NATIVE | the pack resolves it: 1 effect [frightened], a save, damage, uses | — | — |
| monster | **Spiritual Weapon** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Spore Bomb** | fallback-actors | half-on-save, temp-hp | NATIVE | the pack resolves it: 1 effect [poisoned], a save, damage, uses | — | — |
| monster | **Steal Body** | fallback-actors | — | NATIVE | the pack resolves it: 2 effects [coverTotal], a save | — | — |
| monster | **Sticky Net** | fallback-actors | half-on-save, resist | NATIVE | the pack resolves it: 1 effect [restrained], a save, uses | — | — |
| monster | **Sticky Shield** | fallback-actors | reaction | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | — | — |
| monster | **Strange Scepter** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Suffocate** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [grappled, suffocation], an attack, damage | — | — |
| monster | **Tactical Charge** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Tail** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [prone], an attack | — | — |
| monster | **Telekinetic Thrust** | fallback-actors | — | NATIVE | the pack resolves it: a save, damage | — | — |
| monster | **Telepathic Bond** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Tentacle Lash** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [grappled, restrained], an attack, damage | — | — |
| monster | **Thorn Volley** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Trident** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Umbral Strike** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Undead Restoration** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Vanish** | fallback-actors | — | TEXT | no combat mechanism | — | — |
| monster | **Vengeful Glare** | fallback-actors | — | NATIVE | the pack resolves it: 2 effects [frightened, paralyzed], a save | — | — |
| monster | **Vortex** | fallback-actors | — | NATIVE | the pack resolves it: 1 effect [grappled], a save, damage | — | — |
| monster | **Vow of Revenge** | fallback-actors | — | TEXT | no combat mechanism | — | — |
| monster | **Warding Charm** | fallback-actors | interrupt, reaction, half-on-save | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | bend | — |
| monster | **Wind Swipe** | fallback-actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Wishes** | fallback-actors | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
