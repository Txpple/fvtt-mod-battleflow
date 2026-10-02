# Arcana Unleashed — the measured corpus

> Generated 2026-10-02 by `tools/audit-splat-books.mjs` from an OFFLINE scan (`tools/scan-corpus-offline.mjs`, copies of the module's packs; the sandbox untouched). Evidence, not verdicts — the plan is [plans/splat-books.md](../plans/splat-books.md). **Structure**: fxN an effect count (its statuses), save / atk / dmg the activities, REACTION a reaction activity, TEXT a paragraph only. **Known**: a registry table already keyed on the NAME — a reprint that fires for free, or a collision to guard.

**Totals:** 257 rows · 137 combat-shaped · 31 of those text-only · 4 named in the registry

## Subclasses (8)

### Arcana Domain (cleric) — 4 rows · 1 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Arcana Domain Spells** | — | **TEXT** |  | Your connection to this divine domain means you always have certain spells ready. When you reach a Cleric level specified in the Arcana Domain Spells table, you… |
| 3 | **Modify Magic** | temp-hp |  |  | You can use your Channel Divinity to alter your spells as you cast them. When you cast a spell, you can expend one use of your Channel Divinity and change the s… |
| 6 | **Dispelling Recovery** | — | uses **TEXT** |  | Immediately after you cast a spell with a spell slot that restores Hit Points to a creature or ends a condition on a creature, you can cast @UUID[Compendium.dnd… |
| 17 | **Magical Mastery** | — | **TEXT** |  | You learn four Wizard spells, one from each of levels 6, 7, 8, and 9. You thereafter always have those spells prepared. Whenever you gain a Cleric level, you ca… |

### Arcane Archer (fighter) — 7 rows · 2 combat-shaped · 2 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Arcane Archer Lore** | — | **TEXT** |  | You learn magical theory and secrets of nature, granting you the following benefits. Cantrip. You know either the @UUID[Compendium.dnd5e.spells24.Item.phbsplDru… |
| 3 | **Arcane Shot** | clock | uses **TEXT** |  | You learn to unleash special magical effects with your shots. Arcane Shot Options. You learn two Arcane Shot options of your choice from the “Arcane Shot Option… |
| 7 | **Curving Shot** | — | **TEXT** |  | You learn how to direct an errant shot toward a new target. If you make a ranged attack roll with a weapon with the Ammunition property and miss, you can cause… |
| 7 | **Magical Ammunition** | — | uses **TEXT** |  | You learn to imbue your ammunition with magical properties. As a Magic action, you can imbue a piece of nonmagical ammunition with one of the following magical… |
| 10 | **Ever-Ready Shot** | — | **TEXT** |  | When you roll Initiative, you can regain one expended use of Arcane Shot. |
| 15 | **Indomitable Teleport** | — | **TEXT** |  | Your magical mastery lets you escape dire situations. When you use your Indomitable feature and succeed on the saving throw, you can teleport up to 60 feet to a… |
| 18 | **Masterful Shots** | interrupt, reaction, movement | REACTION **TEXT** |  | You employ agility in your sharpshooting. When a creature you can see misses you with an attack roll, you can take a Reaction to move up to half your Speed away… |

### Warrior of the Mystic Arts (monk) — 5 rows · 1 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Spellcasting** | — | **TEXT** |  | You have learned to cast spells. See the Player’s Handbook for the rules on spellcasting. The information below details how you use those rules as a Warrior of… |
| 6 | **Mystic Fighting Style** | — | **TEXT** |  | When you take the Attack action on your turn, you can replace one Unarmed Strike with a casting of one of your Sorcerer cantrips that has a casting time of an a… |
| 6 | **Mystic Focus** | — | **TEXT** |  | You keep your magical power and martial focus in perfect balance, allowing you to convert spell slots into Focus Points, or convert Focus Points into spell slot… |
| 11 | **Focused Strike** | bend-save, clock | **TEXT** |  | When you use your Stunning Strike, whether the target succeeds or fails on the saving throw, the target has Disadvantage on saving throws against your spells un… |
| 17 | **Improved Fighting Style** | — | **TEXT** |  | When you use Flurry of Blows, you can replace two of the Unarmed Strikes with a casting of one of your level 1 or 2 Sorcerer spells that has a casting time of a… |

### Vestige Patron (warlock) — 5 rows · 2 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Vestige Companion** | — | **TEXT** |  | The vestige manifests, drawing strength from your pact. It uses the Vestige Companion stat block and is a @UUID[Compendium.dnd-arcana-unleashed.actors.Actor.aun… |
| 3 | **Vestige Spells** | — | **TEXT** |  | The magic of your Vestige Companion ensures you always have certain spells ready. Select one of the following Cleric domains: Life, Light, Trickery, or War. The… |
| 6 | **Vestige Power** | resist | **TEXT** |  | Your Vestige Companion now regains its use of Divine Power whenever you finish a Short or Long Rest or when you use your Magical Cunning feature. In addition, w… |
| 10 | **Vestige Recovery** | reaction | uses REACTION |  | When your Vestige Companion would drop to 0 Hit Points, you can take a Reaction and expend a Pact Magic spell slot to instead change its Hit Points to its Hit P… |
| 14 | **Semblance of Life** | temp-hp, aura | uses **TEXT** |  | Your Vestige Companion continues to grow in strength, and with your assistance, it can briefly adopt a more powerful form. Depending on the vestige’s type, you… |

### Conjurer (wizard) — 6 rows · 1 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Benign Transposition** | — | uses **TEXT** |  | As a Bonus Action, you teleport up to 30 feet to an unoccupied space that you can see. Alternatively, you can choose a space within range that is occupied by a… |
| 3 | **Conjuration Savant** | — | **TEXT** |  | Choose two Wizard spells from the Conjuration school, each of which must be no higher than level 2, and add them to your spellbook for free. In addition, whenev… |
| 6 | **Distant Transposition** | — | **TEXT** |  | The range of your Benign Transposition feature increases to 60 feet. Additionally, you can restore one use of it by expending a level 3+ spell slot (no action r… |
| 6 | **Durable Summons** | temp-hp, resist | fx1 |  | When you cast a Conjuration spell to summon or create a creature using a spell slot, that creature gains Temporary Hit Points equal to twice your Wizard level w… |
| 10 | **Focused Conjuration** | concentration | **TEXT** |  | Taking damage can’t break your Concentration on Conjuration spells. |
| 14 | **Splintered Summons** | concentration | fx1 uses |  | When you use a spell slot to cast a Conjuration spell that summons a spirit whose stat block is included in the spell description, such as @UUID[Compendium.dnd-… |

### Enchanter (wizard) — 6 rows · 3 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Enchanting Conversation** | — | **TEXT** |  | You gain proficiency in one of the following skills of your choice: Deception, Intimidation, or Persuasion. In addition, when you make an ability check with the… |
| 3 | **Enchantment Savant** | — | **TEXT** |  | Choose two Wizard spells from the Enchantment school, each of which must be no higher than level 2, and add them to your spellbook for free. In addition, whenev… |
| 3 | **Hypnotic Presence** | press-condition | fx1[charmed,incapacitated] save uses |  | Your charming words and enchanting gaze can enthrall another creature. As a Magic action, choose one creature that you can see within 10 feet of yourself. If th… |
| 6 | **Split Enchantment** | — | uses **TEXT** |  | When you use a spell slot to cast an Enchantment spell, such as @UUID[Compendium.dnd5e.spells24.Item.phbsplCharmPerso]{Charm Person} , that can be cast with a h… |
| 10 | **Instinctive Charm** | interrupt, reaction, press-condition, half-on-save, aura | save uses REACTION |  | When a creature within 30 feet of you that you can see hits you with an attack roll, you can take a Reaction to force the attacker to make a Wisdom saving throw… |
| 14 | **Alter Memories** | press-condition, half-on-save | save |  | You can make a creature unaware of your magical influence. When you cast an Enchantment spell that imposes the Reference[Charmed apply=false] condition using a… |

### Necromancer (wizard) — 6 rows · 3 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Necromancy Savant** | — | **TEXT** |  | Choose two Wizard spells from the Necromancy school, each of which must be no higher than level 2, and add them to your spellbook for free. In addition, wheneve… |
| 3 | **Necromancy Spellbook** | temp-hp, resist | fx1 |  | Your spellbook’s necromantic secrets grant you additional powers. You gain the following benefits. Necrotic Resistance. You have Resistance to Necrotic damage.… |
| 6 | **Grave Power** | resist | **TEXT** |  | You have discovered more necromantic insights and inscribed them in your spellbook. While holding your spellbook, you gain the following benefits. Grave Resilie… |
| 6 | **Undead Thralls** | — | **TEXT** |  | You always have @UUID[Compendium.dnd5e.spells24.Item.phbsplAnimateDea]{Animate Dead} prepared and can cast it without expending a spell slot, but you must finis… |
| 10 | **Harvest Undead** | interrupt, reaction, temp-hp | REACTION |  | You have learned more secrets about the nuances of life and death. Immediately after you become Reference[Bloodied apply=false] but aren’t reduced to 0 Hit Poin… |
| 14 | **Death's Master** | clock, interrupt, reaction, press-condition, half-on-save, temp-hp, aura | fx1 save dmg uses REACTION |  | Abstruse rituals within your spellbook allow you mastery over undeath. While holding your spellbook, you gain the following benefits. Bolster Undead. As a Bonus… |

### Transmuter (wizard) — 7 rows · 3 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Transmutation Savant** | — | **TEXT** |  | Choose two Wizard spells from the Transmutation school, each of which must be no higher than level 2, and add them to your spellbook for free. In addition, when… |
| 3 | **Transmuter's Stone** | resist, movement | fx20 |  | When you finish a Long Rest, you can create a magic stone that lasts until you use this feature again. The stone is a Tiny object, and you can use it as a Spell… |
| 3 | **Wondrous Alteration** | bend-save, concentration | fx1 |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplAlterSelf0]{Alter Self} spell prepared and can cast it once without expending a spel… |
| 6 | **Empowered Transmutation** | — | uses **TEXT** |  | When you use a spell slot to cast a Transmutation spell that doesn’t make an attack roll or force a saving throw, such as @UUID[Compendium.dnd5e.spells24.Item.p… |
| 10 | **Potent Stone** | bend-save | **TEXT** |  | Your Transmuter’s Stone is more versatile. When you create your Transmuter’s Stone, you can choose up to two benefits. You can choose each option other than Res… |
| 10 | **Shape-Shifter** | — | uses **TEXT** |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplPolymorph0]{Polymorph} spell prepared and can cast it once without expending a spell… |
| 14 | **Master Transmuter** | temp-hp |  |  | While you carry your Transmuter’s Stone, you can take a Magic action to consume the reserve of transmutation magic stored inside and choose one of the following… |

## Options nothing grants (15)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Banishing Shot** | press-condition | fx1[incapacitated] save dmg |  | Your ammunition temporarily sequesters your target in a harmless demiplane. The creature you hit takes extra Psychic damage equal to one roll of your Arcane Sho… |
| 3 | **Beguiling Shot** | clock, press-condition | fx1[charmed] save dmg |  | Your ammunition beguiles your target. The creature you hit takes extra Psychic damage equal to two rolls of your Arcane Shot Die and must succeed on a Wisdom sa… |
| 3 | **Bursting Shot** | — | dmg |  | You imbue your ammunition with explosive magical energy. Immediately after you deal damage to the creature, your target and each creature within a 10-foot Emana… |
| 3 | **Enchanting Conversation (Deception)** | — | fx1 |  | You gain proficiency in Deception. In addition, when you make an ability check with the chosen skill, you gain a bonus to the check equal to your Intelligence m… |
| 3 | **Enchanting Conversation (Intimidation)** | — | fx1 |  | You gain proficiency in Intimidation. In addition, when you make an ability check with the chosen skill, you gain a bonus to the check equal to your Intelligenc… |
| 3 | **Enchanting Conversation (Persuasion)** | — | fx1 |  | You gain proficiency in Persuasion. In addition, when you make an ability check with the chosen skill, you gain a bonus to the check equal to your Intelligence… |
| 3 | **Enfeebling Shot** | clock | fx4[poisoned] save dmg |  | Your ammunition saps your target’s strength. The creature you hit takes extra Necrotic damage equal to two rolls of your Arcane Shot Die. The target must also s… |
| 3 | **Grasping Shot** | press-condition | fx1[restrained] save dmg |  | Your ammunition creates clutching brambles around your target. The creature you hit takes extra Slashing damage equal to one roll of your Arcane Shot Die and mu… |
| 3 | **Piercing Shot** | press-condition, half-on-save | save dmg |  | You give your ammunition an ethereal quality. When you use this option, you don’t make an attack roll for the attack. Instead, the ammunition shoots forward in… |
| 3 | **Seeking Shot** | press-condition, half-on-save | save dmg |  | Your ammunition can seek out a target. When you use this option, you don’t make an attack roll for the attack. Instead, choose one creature you have seen in the… |
| 3 | **Shadow Shot** | clock, press-condition | fx1[blinded] save dmg |  | Your ammunition occludes your foe’s vision with shadows. The creature you hit takes extra Psychic damage equal to one roll of your Arcane Shot Die, and it must… |
| 3 | **Vestige Spells (Life)** | — | **TEXT** |  | The magic of your Vestige Companion ensures you always have certain spells ready. Select one of the following Cleric domains: Life, Light, Trickery, or War. The… |
| 3 | **Vestige Spells (Light)** | — | **TEXT** |  | The magic of your Vestige Companion ensures you always have certain spells ready. Select one of the following Cleric domains: Life, Light, Trickery, or War. The… |
| 3 | **Vestige Spells (Trickery)** | — | **TEXT** |  | The magic of your Vestige Companion ensures you always have certain spells ready. Select one of the following Cleric domains: Life, Light, Trickery, or War. The… |
| 3 | **Vestige Spells (War)** | — | **TEXT** |  | The magic of your Vestige Companion ensures you always have certain spells ready. Select one of the following Cleric domains: Life, Light, Trickery, or War. The… |

## Feats (29) — 29 rows · 13 combat-shaped · 5 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
|  | **Arcane Artist** | — | uses **TEXT** |  | You gain the following benefits. Cantrip. You learn the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplMinorIllus]{Minor Illusion} cantrip. Intelligenc… |
|  | **Arcane Eloquence** | — | fx1 |  | You gain the following benefits. Cantrip. You learn the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplViciousMoc]{Vicious Mockery} cantrip. Intelligen… |
|  | **Arcane Infiltrator** | — | uses **TEXT** |  | You gain the following benefits. Cantrip. You learn the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplFriends000]{Friends} cantrip. Intelligence, Wisd… |
|  | **Arcane Omens** | reaction | uses REACTION **TEXT** |  | You gain the following benefits. Cantrip. You learn the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplGuidance00]{Guidance} cantrip. Intelligence, Wis… |
|  | **Arcane Overload** | — | dmg uses |  | You gain the following benefits. Cantrip. You learn the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplFireBolt00]{Fire Bolt} cantrip. Intelligence, Wi… |
|  | **Arcane Safeguard** | temp-hp | fx1 |  | You gain the following benefits. Cantrip. You learn the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplResistance]{Resistance} cantrip. Intelligence, W… |
|  | **Arcane Undertaker** | — | fx1 uses |  | You gain the following benefits. Cantrip. You learn one Cleric or Wizard cantrip of your choice. The cantrip must be from the Necromancy school. Intelligence, W… |
|  | **Arcane Warrior** | — | **TEXT** |  | You learn two Wizard cantrips of your choice. @UUID[Compendium.dnd5e.spells24.Item.phbsplMageHand00]{Mage Hand} and @UUID[Compendium.dnd5e.spells24.Item.phbsplR… |
|  | **Familiar Friend** | aura | fx1 uses |  | You gain the following benefits. Faithful Companion. You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplFindFamili]{Find Familiar} spel… |
|  | **Portal Jumper** | clock, resist | uses **TEXT** |  | You gain the following benefits. Otherworldly Resilience. You have Resistance to one of the following damage types: Necrotic, Psychic, or Radiant (choose when y… |
|  | **Transmuted Anatomy** | bend-save, reaction, movement | fx1 uses REACTION |  | You gain the following benefits. Lengthened Stride. Your Speed increases by 5 feet. Resilient Anatomy. You have Advantage on saving throws against effects that… |
| 4 | **Abjuration Adept** | temp-hp |  |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Conjuration Adept** | concentration | fx3 |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Divination Adept** | reaction | uses REACTION **TEXT** |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Elemental Familiar** | reaction, press-condition, aura, resist | fx1 save dmg |  | General Feat (Prerequisite: Level 4+, Familiar Friend Feat) You gain the following benefits. Ability Score Increase. Increase one ability score of your choice b… |
| 4 | **Enchantment Adept** | — | **TEXT** |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Evocation Adept** | clock | dmg |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Illusion Adept** | — | **TEXT** |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Magic Connoisseur** | — | **TEXT** |  | General Feat (Prerequisite: Level 4+, Magic Initiate Feat) You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Chari… |
| 4 | **Necromancy Adept** | temp-hp |  |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Otherworldly Familiar** | resist, movement | fx1 |  | General Feat (Prerequisite: Level 4+, Familiar Friend Feat) You gain the following benefits. Ability Score Increase. Increase one ability score of your choice b… |
| 4 | **Soothing Familiar** | aura | **TEXT** |  | General Feat (Prerequisite: Level 4+, Familiar Friend Feat) You gain the following benefits. Ability Score Increase. Increase one ability score of your choice b… |
| 4 | **Spell Resistant** | resist | uses **TEXT** |  | General Feat (Prerequisite: Level 4+) You gain the following benefits. Ability Score Increase. Increase your Dexterity or Constitution score by 1, to a maximum… |
| 4 | **Spell Subterfuge** | — | uses **TEXT** |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Transmutation Adept** | movement | fx1 |  | General Feat (Prerequisite: Level 4+, Spellcasting or Pact Magic Feature) You gain the following benefits. Ability Score Increase. Increase your Intelligence, W… |
| 4 | **Warlike Familiar** | interrupt, reaction | REACTION **TEXT** |  | General Feat (Prerequisite: Level 4+, Familiar Friend Feat) You gain the following benefits. Ability Score Increase. Increase one ability score of your choice b… |
| 19 | **Boon of Erupting Spellpower** | — | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30. Spell Overload. When yo… |
| 19 | **Boon of Magic School Mastery** | — | **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30. Mastered School. Choose… |
| 19 | **Boon of the Iron Mind** | concentration | **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Unshakable Focus. When you are main… |

## Spells (33) — 33 rows · 24 combat-shaped · 2 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 2 | **Battle Familiar** | — | action **TEXT** |  | You conjure a familiar imbued with magical might. The familiar appears in an unoccupied space within range; resembles an animal of your choice but is a Celestia… |
| 2 | **Disruptive Tune** | bend-save, press-condition, half-on-save, concentration | fx1 save action |  | A distracting melody momentarily fills a [[lookup @target.template.size activity=3Hl3sK9YjhjG6nnR]]-foot-radius [[lookup @target.template.type capitalize activi… |
| 2 | **Dueling Ground** | — | fx1[marked] minute |  | You create a magical dueling ground bounded by a glowing, rune-scribed circle in a [[lookup @target.template.size activity=xCrhehapHurs0qGo]]-foot-radius [[look… |
| 2 | **Uncertain Footing** | press-condition | fx1 save action |  | You create illusory obstacles such as rocks or spikes in an attempt to confuse up to three creatures you can see within range, affecting their ability to move.… |
| 2 | **Wither and Bloom** | rider-damage, press-condition, half-on-save, temp-hp | save dmg action |  | You invoke both death and life in a [[lookup @target.template.size activity=VuL7iUvj2gXAthhI]]-foot-radius [[lookup @target.template.type capitalize activity=Vu… |
| 3 | **Catnap** | press-condition | fx1[unconscious] action |  | You make a calming gesture, and up to three willing creatures of your choice that you can see within range have the Reference[Unconscious apply=false] condition… |
| 3 | **Inflict Doubt** | press-condition | fx1 save action |  | You inflict self-doubt on a creature you can see within range. The target must succeed on a Wisdom saving throw or have Disadvantage on Reference[D20 Test]{D20… |
| 4 | **Distorted Distance** | clock, press-condition, movement | fx1 save dmg action |  | You create an illusory spatial dilation that fills a [[lookup @target.template.size activity=HmKOEyhRsTbneToR]]-foot-radius [[lookup @target.template.type capit… |
| 4 | **Festering Blast** | rider-damage, press-condition | fx1[poisoned] save dmg action |  | A [[lookup @target.template.size activity=kpVaAawtqwUYnst5]]-foot-long, [[lookup @target.template.width activity=kpVaAawtqwUYnst5]]-foot-wide [[lookup @target.t… |
| 4 | **Zone of Amicability** | — | fx1 action |  | A magical zone of amicability radiates from you in a 60-foot Emanation for the duration. When you make an ability check to influence a creature in that area, yo… |
| 5 | **Enervation** | rider-damage, press-condition, half-on-save, concentration, temp-hp | save dmg action |  | A tendril of inky darkness reaches out from you to drain life from a creature you can see within range. The target makes a Dexterity saving throw. On a failed s… |
| 5 | **Grave Ground** | rider-damage, clock, press-condition, movement | fx1 save dmg action |  | Skeletal hands burst from an area on the ground within range. The area consists of up to four [[lookup @target.template.size activity=8aJnPEZ0nttU2jdh]]-foot [[… |
| 5 | **Mordenkainen's Lucubration** | — | action **TEXT** |  | You recover up to two expended spell slots of level 2 or lower. Using a Higher-Level Spell Slot . The maximum level of spell slots you can recover increases to… |
| 5 | **Negative Energy Flood** | rider-damage, press-condition, half-on-save | save dmg action |  | You send ribbons of negative energy at one creature you can see within range. If the target isn’t Undead, it makes a Constitution saving throw, taking [[/damage… |
| 5 | **Spirit Lantern** | bend-attack, clock, press-condition, half-on-save, temp-hp | fx2 save dmg uses action |  | You conjure a floating, ghostly black lantern that hovers above you and sheds Dim Light in a 60-foot radius. When an enemy dies within this Dim Light, a fragmen… |
| 5 | **Summon Plant** | — | action **TEXT** |  | You call forth the spirit of an animated plant. It manifests in an unoccupied space that you can see within range and uses the Plant Spirit stat block. When you… |
| 5 | **Waves of Exhaustion** | press-condition | fx1[exhaustion] save bonus |  | You evoke a nimbus of flickering gray light around your body. For the duration, you can take a Reference[Magic] action to emit a wave of gray light in a [[looku… |
| 6 | **Summon Dinosaur** | — | action **TEXT** |  | You call forth the spirit of a primeval dinosaur. It manifests in an unoccupied space that you can see within range and uses the Dinosaur Spirit stat block. Whe… |
| 7 | **Aura of Evasion** | bend-save, press-condition, half-on-save | fx1 action |  | An aura of alacrity radiates from you in a [[lookup @target.template.size activity=icBZdq2WvMCsaopA]]-foot Emanation for the duration. While in the aura, you an… |
| 7 | **Fractured Awareness** | press-condition, half-on-save | fx1 save dmg action |  | You cause a creature to receive conflicting visions of multiple possible futures. Choose a creature you can see within range. The target makes an Intelligence s… |
| 7 | **Power Word Pain** | — | fx1[charmed] save dmg action |  | You speak a word of power that causes waves of intense pain to assail one creature you can see within range. If the target has 100 Hit Points or fewer, it takes… |
| 7 | **Reweave Fate** | reaction, d20-fold | reaction |  | You untangle a single thread of fate to encourage a different result. The creature that failed the D20 Test can reroll it with Advantage, and the creature must… |
| 7 | **Transfix** | rider-damage, press-condition, aura, movement | fx1[charmed,incapacitated] save dmg action |  | For the duration, your appearance becomes otherworldly and alluring. One creature of your choice that you can see within 60 feet of you must succeed on a Charis… |
| 8 | **Entrancing Mirrors** | press-condition, half-on-save | fx1[stunned] save dmg action |  | You create dozens of illusory mirrors to confuse up to three creatures of your choice that you can see within range. Each target makes an Intelligence saving th… |
| 8 | **Illusory Dragon** | bend-save, press-condition, half-on-save, resist | action **TEXT** |  | By gathering threads of shadow material from the Shadowfell, you create a Huge shadowy dragon in an unoccupied space that you can see within range. The illusion… |
| 8 | **Iron Body** | resist | fx1 action |  | One willing creature you touch transforms into living metal. Until the spell ends, the target’s Exhaustion level can’t increase; the target has Resistance to Bl… |
| 8 | **Lightning Ring** | press-condition, half-on-save | fx1[deafened] save dmg bonus |  | A ring of crackling electricity fills a [[lookup @target.template.size activity=Yhx2AFaGBY6MwU7K]]-foot Emanation originating from you. Whenever the Emanation e… |
| 8 | **Moment of Prescience** | reaction | reaction **TEXT** |  | You have a powerful sixth sense that guides you at just the right time. Turn the roll of your failed D20 Test into a 20, or turn the roll of the triggering atta… |
| 9 | **Detonate** | press-condition, half-on-save | save dmg action |  | You create a magical, explosive seed inside a creature you can see within range. The target makes a Constitution saving throw, taking [[/damage average activity… |
| 9 | **Hindsight** | — | minute **TEXT** |  | You peer backward through the fabric of time. You see visions of events that occurred within range throughout the past 10 years, racing by at approximately 1 da… |
| 9 | **Invulnerability** | resist | fx1 action |  | You have Immunity to all damage until the spell ends. |
| 9 | **Vision of Elapsing Eons** | press-condition | fx2[exhaustion,paralyzed] save dmg action |  | You trick a creature you can see within range into believing it is watching itself and its surroundings crumble away, as if eons were passing in moments. The ta… |
| 9 | **Wail of the Banshee** | press-condition, half-on-save | fx1[deafened] save dmg action |  | You emit a terrible scream that can kill those who hear it. Choose up to ten creatures within range. Each target with 50 Hit Points or fewer dies. Targets with… |

## Items (69) — 69 rows · 38 combat-shaped · 10 of those text-only · 0 named in the registry

### Combat-shaped (38)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| equipment | **Arcanist's Bestiary** | bend-save | fx4 uses |  | Hundreds of pages of illustrations, tables, and diagrams about a wide variety of monsters fill this magical tome. Charm Monster . While holding the book, you ca… |
| equipment | **Bellows of Strangulation** | — | fx1[incapacitated] save uses |  | This bellows has 6 charges. While you are holding it, you can take a Magic action and use one of three command words to cause one of the following effects: Firs… |
| equipment | **Blood Amulet** | rider-damage, press-condition | fx1[exhaustion] save dmg uses |  | This delicate amulet looks like a diminutive beating heart impaled with spikes. It has 3 charges and regains 1d3 charges daily at dawn. Whenever you deal damage… |
| equipment | **Blossom Rod** | — | fx1[unconscious] save uses |  | (Requires Attunement by a Spellcaster) This rod is made of intertwined, living plant stems. Budding (Uncommon) . Multicolored leaves decorate the rod’s stems, a… |
| equipment | **Boon Companions' Bands** | bend-save, half-on-save | uses **TEXT** |  | Boon Companions’ Bands come in pairs and bear matching engravings. While wearing one of the bands, when you cast a spell or use a feature that forces other crea… |
| weapon | **Diamond Staff** | half-on-save, d20-fold | fx3[stunned] save atk uses |  | Requires Attunement by a Sorcerer, Warlock, or Wizard This 6-foot-long scepter is carved from a single enormous crystal, with a perfect transparent globe at its… |
| weapon | **Dissuader** | clock, reaction, press-condition, d20-fold | fx1[frightened] save atk uses REACTION |  | This staff can be wielded as a magic Quarterstaff that grants a +1 bonus to attack rolls and damage rolls made with it. It also has the following additional pro… |
| consumable | **Goading Ammunition (Arrow)** | clock, press-condition | fx1 save |  | If this piece of magic ammunition hits a creature and deals damage, the target makes a [[/save format=long]]. On a failed save, the target can’t take Reactions… |
| consumable | **Goading Ammunition (Bolt)** | clock, press-condition | fx1 save |  | If this piece of magic ammunition hits a creature and deals damage, the target makes a [[/save format=long]]. On a failed save, the target can’t take Reactions… |
| consumable | **Goading Ammunition (Bullet, Firearm)** | clock, press-condition | fx1 save |  | If this piece of magic ammunition hits a creature and deals damage, the target makes a [[/save format=long]]. On a failed save, the target can’t take Reactions… |
| consumable | **Goading Ammunition (Bullet, Sling)** | clock, press-condition | fx1 save |  | If this piece of magic ammunition hits a creature and deals damage, the target makes a [[/save format=long]]. On a failed save, the target can’t take Reactions… |
| consumable | **Goading Ammunition (Needle)** | clock, press-condition | fx1 save |  | If this piece of magic ammunition hits a creature and deals damage, the target makes a [[/save format=long]]. On a failed save, the target can’t take Reactions… |
| weapon | **Grave Reaper** | rider-damage, d20-fold | atk dmg uses |  | You gain a +2 bonus to attack rolls and damage rolls made with this magic weapon. When you hit a creature with it, the target takes an extra 2d8 Necrotic damage… |
| weapon | **Keyholes Dagger** | clock, d20-fold | atk uses |  | The hilt of this magic weapon is adorned with ornate, decorative keyholes outlined in golden filigree. Three (Uncommon) . Three ornamental keyholes adorn the we… |
| equipment | **Lucky Foot** | d20-fold | uses **TEXT** |  | When you roll a 1 on a saving throw or ability check, you can use this preserved rabbit foot’s magic to reroll the die. You must use the new roll, and the foot… |
| weapon | **Mage Breaker** | bend-save, d20-fold, concentration | fx1 atk |  | You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon. When you hit a concentrating creature with an attack roll using this weapon an… |
| equipment | **Mage's Manacle** | — | fx1[restrained] save uses |  | As a Magic action while wearing this bracelet, you can target a Large or smaller creature within 5 feet of yourself that has the Reference[Grappled apply=false]… |
| weapon | **Martialist's Quarterstaff** | bend-attack, clock, press-condition | fx1[prone] save atk uses |  | This magic Quarterstaff has 4 charges and regains 1d4 expended charges daily at dawn. It has the following additional properties. Searing Smite . You can expend… |
| weapon | **Namer's Needle** | bend-save, press-condition, d20-fold, crit, resist | fx1 save atk uses |  | You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon. Identify Target . When you hit a creature with an attack roll using this weapo… |
| equipment | **Necklace of the Beastly Familiar (Azurite)** | temp-hp, aura | uses **TEXT** |  | Requires Attunement by a Spellcaster This bejeweled necklace comes with a matching charm that can be worn by your familiar. A variety of these necklaces exist,… |
| equipment | **Necklace of the Beastly Familiar (Chrysoprase)** | temp-hp, aura | uses **TEXT** |  | Requires Attunement by a Spellcaster This bejeweled necklace comes with a matching charm that can be worn by your familiar. A variety of these necklaces exist,… |
| equipment | **Necklace of the Beastly Familiar (Fire Opal)** | temp-hp, aura | uses **TEXT** |  | Requires Attunement by a Spellcaster This bejeweled necklace comes with a matching charm that can be worn by your familiar. A variety of these necklaces exist,… |
| equipment | **Necklace of the Beastly Familiar (Topaz)** | temp-hp, aura | uses **TEXT** |  | Requires Attunement by a Spellcaster This bejeweled necklace comes with a matching charm that can be worn by your familiar. A variety of these necklaces exist,… |
| equipment | **Necklace of the Beastly Familiar (Zircon)** | temp-hp, aura | uses **TEXT** |  | Requires Attunement by a Spellcaster This bejeweled necklace comes with a matching charm that can be worn by your familiar. A variety of these necklaces exist,… |
| consumable | **Potion of Dragon's Breath (Black)** | half-on-save, concentration | save dmg uses |  | When you drink this potion, you gain the effect of the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDragonsBre]{Dragon’s Breath} spell for 1 minute (… |
| consumable | **Potion of Dragon's Breath (Blue)** | half-on-save, concentration | save dmg uses |  | When you drink this potion, you gain the effect of the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDragonsBre]{Dragon’s Breath} spell for 1 minute (… |
| consumable | **Potion of Dragon's Breath (Green)** | half-on-save, concentration | save dmg uses |  | When you drink this potion, you gain the effect of the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDragonsBre]{Dragon’s Breath} spell for 1 minute (… |
| consumable | **Potion of Dragon's Breath (Red)** | half-on-save, concentration | save dmg uses |  | When you drink this potion, you gain the effect of the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDragonsBre]{Dragon’s Breath} spell for 1 minute (… |
| consumable | **Potion of Dragon's Breath (White)** | half-on-save, concentration | save dmg uses |  | When you drink this potion, you gain the effect of the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDragonsBre]{Dragon’s Breath} spell for 1 minute (… |
| equipment | **Queen Ehlissa's Marvelous Nightingale** | reaction | uses REACTION **TEXT** |  | Queen Ehlissa’s Marvelous Nightingale is named for its first owner, a queen from the eastern Flanaess in the world of Greyhawk. Its origin is unknown, but one l… |
| equipment | **Scholar's Anchoring Bangle** | reaction, concentration | uses REACTION **TEXT** |  | This heavy magical bracelet inures your mind against potential distractions. While wearing this bracelet, you gain the following benefits. Deep Knowledge . When… |
| equipment | **Spell-Slinger's Puppet** | aura, movement | **TEXT** |  | As a Bonus Action while holding this ventriloquist’s doll, you can pull the cord on the doll’s back to cause the doll to levitate to an unoccupied space you can… |
| weapon | **Staff of Skulls** | reaction, half-on-save | fx3[prone] save atk dmg uses REACTION |  | (Requires Attunement by a Spellcaster) This staff is made of polished, interlocking bones. Runes are carved along its length. Ominous (Uncommon) . A skull adorn… |
| weapon | **Staff of the Lost** | d20-fold | fx1 atk uses |  | [[/attack extended]]. [[/damage average extended]] or [[/damage attackMode=twoHanded average]] damage if used with two hands. This staff can be wielded as a mag… |
| equipment | **Tramontane Armor** | press-condition, movement | fx2[grappled] save uses |  | Armor (Any Light or Medium), Very Rare (Requires Attunement) You gain a +1 bonus to Armor Class while wearing this armor. The armor is enchanted to look like a… |
| equipment | **Wand of Teeth** | clock, press-condition, half-on-save | fx1[poisoned] save dmg uses |  | This wand has 10 charges. While holding it, you can take a Magic action to expend up to 3 charges to spray a wave of sharp, spectral teeth in the direction you… |
| weapon | **Wave-Swept Weapon** | d20-fold | fx6 |  | Weapon (Greatsword, Longsword, Rapier, Scimitar, or Shortsword), Rarity Varies (Requires Attunement) This weapon is covered in oceanic motifs, from wavelike etc… |
| equipment | **Workshop Wrecker** | press-condition | fx1 save dmg uses |  | When this 3-inch-diameter metal ball is activated as a Magic action, it moves at a rapid speed, bouncing off walls and defying any attempts to capture it. The b… |

### The rest (31)

Arcane Chatelaine (equipment) · Conjurer's Canopy (equipment) · Dictation Quill (equipment) · Dispelling Ammunition (Arrow) (consumable) · Dispelling Ammunition (Bolt) (consumable) · Dispelling Ammunition (Bullet, Firearm) (consumable) · Dispelling Ammunition (Bullet, Sling) (consumable) · Dispelling Ammunition (Needle) (consumable) · Dream Weaver (equipment) · Elocutionist's Lexicon (equipment) · Ensorcelled Missive (equipment) · Evergreen Fertilizer (equipment) · Goodberry Charm (consumable) · Homeward Compass (equipment) · Idol of Good Fortunes (equipment) · Magewright's Gloves (equipment) · Orb of Divination Detection (equipment) · Orb of Sorcery (equipment) · Potion of Tirelessness (consumable) · Prismatic Rune (equipment) · Ring of Dedicated Focus (equipment) · Secret Keeper's Circlet (equipment) · Spell Component Ring (equipment) · Spell Duelist's Trophy (equipment) · Sweeping Broom (equipment) · Thespian's Playbill (equipment) · Thief's Thimble (equipment) · Traveler's Pearl (equipment) · Universal Pantograph (equipment) · Wand of Freshness (equipment) · Wand of Slumber (equipment)

## Bestiary traits, actions and reactions (65 distinct names across 25 actors in actors) — 65 rows · 38 combat-shaped · 9 of those text-only · 4 named in the registry

> Deduplicated by name (one Multiattack). The first column names ONE bearer.

### Combat-shaped (38)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| Abjurer Archmage (CR 15) | **Arcane Burst** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Abjurer Archmage (CR 15) | **Banishing Blast** | half-on-save | fx1[incapacitated] save dmg uses |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=g6bqQosos0erPeB7]], each creature in a [[lookup @target.template.size activity=g6bqQosos0erPeB7]]-[[l… |
| Spirit Tyrannosaur (CR ?) | **Bite** | — | fx1[grappled,restrained] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Grappled apply=false] condition (escape D… |
| Venger (CR 17) | **Booming Censure** | clock, half-on-save | fx1[frightened] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=bbxfzP6jnA4GSZIG]], one creature [[lookup @name]] can see within [[lookup @range.value activity=bbxfzP6… |
| Taisus (CR 19) | **Brain Drain** | — | save atk dmg |  | [[/attack extended]]. [[/damage extended]], and if the target is a creature with spell slots, it's subjected to the following effect. Constitution Saving Throw:… |
| Groundling Grunt (CR 1) | **Claw** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, it has the Reference[Grappled apply=false] condition (escape… |
| Venger (CR 17) | **Crimson Blast** | — | atk |  | [[/attack extended]]. [[/damage extended]]. |
| Venger (CR 17) | **Crimson Claw** | — | atk dmg |  | [[/attack extended]]. [[/damage extended]]. |
| Groundling Slayer (CR 3) | **Dagger** | — | atk dmg |  | [[/attack extended]]. [[/damage extended]]. |
| Taisus (CR 19) | **Deadly Drain** | clock | **TEXT** |  | The [[lookup @name lowercase]] makes a [[/item Brain Drain]] attack. The [[lookup @name lowercase]] can’t take this action again until the start of its next tur… |
| Spellguard (CR 5) | **Defensive Divination** | reaction | REACTION **TEXT** |  | Trigger: A creature the [[lookup @name lowercase]] can see hits an ally within 5 feet of the [[lookup @name lowercase]] with an attack roll, or an ally within 5… |
| Vestige Companion (CR 0) | **Divine Power** | bend-attack, temp-hp | fx1 uses |  | Your vestige manifests a remnant of its divine power in one of the following ways, based on its form: Cursed Invocation (Undead Only). The vestige places a curs… |
| Evoker Archmage (CR 15) | **Evocation Sculptor** | bend-save, half-on-save | **TEXT** |  | When the [[lookup @name lowercase]] casts a spell that creates an area of effect, it can choose itself and up to five other creatures it can see, sculpting the… |
| Illusory Acid Dragon (CR ?) | **Exhale Blast of Energy** | press-condition, half-on-save | save dmg |  | The shadowy dragon exhales acid in a 60-foot Cone. Creatures in the Cone make an [[/save format=long]], taking [[/damage]] damage on a failed save or half as mu… |
| Spellguard (CR 5) | **Force Flail** | — | atk dmg |  | [[/attack extended]]. [[/damage extended]]. |
| Abjurer Archmage (CR 15) | **Fortify** | temp-hp | uses |  | The [[lookup @name lowercase]] magically bolsters itself. The [[lookup @name lowercase]] gains 40 Temporary Hit Points. |
| Illusory Acid Dragon (CR ?) | **Frightening Appearance** | press-condition | fx1[frightened] save |  | Enemies that can see the shadowy dragon when it appears make a Wisdom saving throw. On a failed save, they drop whatever they are holding and become Reference[F… |
| Baelnorn (CR 18) | **Frightening Glance** | clock | **TEXT** |  | The [[lookup @name lowercase]] casts [[/item .aunFear000000000]]{Fear} using the same spellcasting ability as Spellcasting. The [[lookup @name lowercase]] can't… |
| Groundling Grunt (CR 1) | **Go to Ground** | interrupt, reaction | REACTION **TEXT** |  | Trigger: The [[lookup @name lowercase]] is hit by an attack roll while it is on the ground. Response: The [[lookup @name lowercase]] halves the damage (round do… |
| Spirit Triceratops (CR ?) | **Gore** | rider-damage | fx1[prone] atk dmg |  | [[/attack extended]]. [[/damage extended average]]. If the target is a [[lookup @target.affects.special activity=iBenqFiBu40bUxkH]] creature and the [[lookup @n… |
| Groundling Stalker (CR 2) | **Heavy Crossbow** | — | atk |  | [[/attack extended]]. [[/damage extended]]. |
| Spellguard (CR 5) | **Javelin** | — | atk |  | [[/attack extended]]. [[/damage extended]]. |
| Abjurer Archmage (CR 15) | **Magic Resistance** | bend-save | **TEXT** | ✓ EFFECT_BENDS | The [[lookup @name lowercase]]{monster} has Advantage on saving throws against spells and other magical effects. |
| Venger (CR 17) | **Magic-Binding Chains** | clock, half-on-save | fx1[restrained] save |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=TVV0DmpfhLaaYmdk]], one creature [[lookup @name]] can see within [[lookup @range.value activity=TVV0… |
| Living Cone of Cold (CR 7) | **Magical Strike** | — | atk |  | [[/attack extended]]. [[/damage extended]]. |
| Necromancer Archmage (CR 15) | **Marshal Undead** | bend-attack | fx1 | ✓ EFFECT_BENDS.from | Undead creatures of the [[lookup @name lowercase]]'s choice in a [[lookup @target.template.size activity=s0E0G2cHRv6yDBdT]]-[[lookup @target.template.units acti… |
| Venger (CR 17) | **Mounted Adept** | bend-save | **TEXT** |  | While [[lookup @name]] is mounted, he and his mount have Advantage on Dexterity saving throws, and Venger can force an attack targeting his mount to target him… |
| Baelnorn (CR 18) | **Overwhelming Radiance** | half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=IkoT0EjmobGuBlmu]], each creature in a [[lookup @target.template.size activity=IkoT0EjmobGuBlmu]]… |
| Baelnorn (CR 18) | **Paralyzing Touch** | — | fx1[paralyzed] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Paralyzed apply=false] condition until the start of the [[lookup @name lowe… |
| Conjurer Archmage (CR 15) | **Protective Magic** | reaction | uses REACTION **TEXT** |  | The [[lookup @name lowercase]]{monster} casts [[/item .aunCounterspell0]]{Counterspell} or [[/item .1Du2BgaXSWD91VTK]]{Shield} in response to the spell's trigge… |
| Baelnorn (CR 18) | **Recuperative Teleport** | clock |  |  | The [[lookup @name lowercase]] teleports up to [[lookup @range.value activity=OKgvnqHKGFdxGbGX]] feet to an unoccupied space it can see and regains [[/heal aver… |
| Battle Familiar (Stalker) (CR ?) | **Rend** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Spirit Ankylosaur (CR ?) | **Slam** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Groundling Grunt (CR 1) | **Sling** | — | atk |  | [[/attack extended]]. [[/damage extended]]. |
| Living Cone of Cold (CR 7) | **Spell Mimicry** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=CvW0tKkSbKydWPqF]], each creature in a [[lookup @target.template.size activity=CvW0tKkSbKydWPqF]]… |
| Spirit Fungus (CR ?) | **Spore Spray** | clock, press-condition | fx1[poisoned] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. On a hit, the target has the Reference[Poisoned apply=false] condition until the end of its next turn. If th… |
| Spellguard (CR 5) | **Superior Magic Resistance** | bend-save | **TEXT** |  | The [[lookup @name lowercase]] has Advantage on saving throws against spells and other magical effects. Spell attack rolls have Disadvantage against the [[looku… |
| Vestige Companion (CR 0) | **Vestige's Strike** | — | atk |  | [[/attack extended]]. Hit: 1d6 + 3 plus your Charisma modifier Fire (Fiend), Necrotic (Undead), or Radiant (Celestial) damage. |

### The rest (27)

Amorphous · Arcane Immortality · Beguiling Spells · Benign Transposition · Counterspell · Crimson Strike · Dominate Person · Duplicitous Magic · Evocation Barrage · Fiendish Restoration · Flyby · Legendary Resistance · Magic Disruption · Multiattack · Pact Bond · Prowl · Shadow Stalker · Siege Monster · Slow · Spell Imprint · Spellcasting · Sunlight Sensitivity · Talented · Telekinesis · Teleport · Tough · Twist Away
