# Heroes of Faerûn — the measured corpus

> Generated 2026-10-02 by `tools/audit-splat-books.mjs` from an OFFLINE scan (`tools/scan-corpus-offline.mjs`, copies of the module's packs; the sandbox untouched). Evidence, not verdicts — the plan is [plans/splat-books.md](../plans/splat-books.md). **Structure**: fxN an effect count (its statuses), save / atk / dmg the activities, REACTION a reaction activity, TEXT a paragraph only. **Known**: a registry table already keyed on the NAME — a reprint that fires for free, or a collision to guard.

**Totals:** 122 rows · 73 combat-shaped · 18 of those text-only · 9 named in the registry

## Subclasses (8)

### College of the Moon (bard) — 4 rows · 3 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Moon's Inspiration** | clock | fx2[invisible] |  | The primal and ever-changing power of the moon flows through you, granting you the following benefits. Inspired Eclipse. When you take a Bonus Action to give a… |
| 3 | **Primal Lore** | — | **TEXT** |  | You learn Druidic and one cantrip from the Druid spell list. It counts as a Bard spell for you but doesn’t count against the number of cantrips you know. Whenev… |
| 6 | **Blessing of Moonlight** | half-on-save | fx2 save dmg uses |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplMoonbeam00]{Moonbeam} spell prepared. When you cast Moonbeam , you can modify the sp… |
| 14 | **Eventide's Splendor** | clock, reaction | fx2[invisible] |  | You become suffused with the might of the moon, improving your @UUID[Compendium.dnd-heroes-faerun.options.Item.hofComMoonsInspi]{Moon's Inspiration} in the foll… |

### Knowledge Domain (cleric) — 5 rows · 0 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Blessings of Knowledge** | — | **TEXT** |  | You gain proficiency with one type of Artisan’s Tools of your choice and in two of the following skills of your choice: Arcana, History, Nature, or Religion. Yo… |
| 3 | **Knowledge Domain Spells** | — | **TEXT** |  | When you reach a Cleric level specified in the Knowledge Domain Spells table, you thereafter always have the listed spells prepared. Knowledge Domain Spells Cle… |
| 3 | **Mind Magic** | — | **TEXT** |  | As a Magic action, you can expend one use of your @UUID[Compendium.dnd-players-handbook.classes.Item.phbclcChannelDiv]{Channel Divinity} to manifest your magica… |
| 6 | **Unfettered Mind** | — | fx1 |  | You gain telepathy out to 60 feet. When you use this telepathy, you can simultaneously contact a number of creatures equal to your Wisdom modifier ([[lookup @ab… |
| 17 | **Divine Foreknowledge** | — | fx1 uses |  | As a Bonus Action, you magically expand your mind to the future. For 1 hour, you have Advantage on D20 Tests. Once you use this feature, you can’t use it again… |

### Banneret (fighter) — 6 rows · 4 combat-shaped · 2 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Group Recovery** | temp-hp | uses |  | When you use your Second Wind to regain Hit Points, you can choose a number of allies within a 30-foot Emanation originating from yourself, up to a number of al… |
| 3 | **Knightly Envoy** | — | **TEXT** |  | You know how to conduct yourself with grace as a noble ambassador. You gain the following benefits. Comprehension. You can cast the @UUID[Compendium.dnd5e.spell… |
| 7 | **Team Tactics** | clock | fx1 |  | When you use Group Recovery, each chosen ally has Advantage on D20 Tests until the start of your next turn. Foundry Note When this feature is acquired, it can b… |
| 10 | **Rallying Surge** | reaction, movement | **TEXT** |  | When you use your Action Surge, you can choose allies within a 30-foot Emanation originating from yourself, up to a number of allies equal to your Charisma modi… |
| 15 | **Shared Resilience** | reaction, d20-fold | REACTION **TEXT** |  | When an ally you can see within 60 feet of yourself fails a saving throw, you can take a Reaction to expend a use of your Indomitable feature. The ally can imme… |
| 18 | **Inspiring Commander** | resist | **TEXT** |  | You gain the following benefits. Bolstered Rally. The area of effect for both Group Recovery and Rallying Surge is now a 60-foot Emanation. Unshakable Bravery.… |

### Oath of the Noble Genies (paladin) — 6 rows · 3 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Elemental Smite** | clock, press-condition, resist | fx3[grappled,restrained,prone] save dmg |  | Immediately after you cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDivineSmit]{Divine Smite} , you can expend one use of your @UUID[Compendium.d… |
| 3 | **Genie Spells** | — | **TEXT** |  | When you reach a Paladin level specified in the Genie Spells table, you thereafter always have the listed spells prepared. Genie Spells Paladin Level Spells 3 @… |
| 3 | **Genie's Splendor** | ac-passive | fx1 |  | When you aren’t wearing any armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers. You can use a Shield and still gain this benefit.… |
| 7 | **Aura of Elemental Shielding** | resist | fx5 |  | Choose one of the following damage types: Acid, Cold, Fire, Lightning, or Thunder. You and your allies have Resistance to that damage type while in your Aura of… |
| 15 | **Elemental Rebuke** | interrupt, reaction, press-condition, half-on-save | save dmg uses REACTION |  | When you are hit by an attack roll, you can take a Reaction to halve the attack’s damage against yourself (round down) and force the attacker to make a Dexterit… |
| 20 | **Noble Scion** | reaction | fx1 uses REACTION |  | As a Bonus Action, you gain the benefits below for 10 minutes or until you end them (no action required). Once you use this feature, you can’t use it again unti… |

### Winter Walker (ranger) — 6 rows · 5 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Frigid Explorer** | rider-damage, clock, resist | dmg |  | You gain the following benefits. Biting Cold. Damage from your weapon attacks, Ranger spells, and Ranger features ignores Resistance to Cold damage. Frost Resis… |
| 3 | **Hunter's Rime** | temp-hp | fx1[marked] |  | Ice rimes you and your prey, protecting you and hindering them. When you cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplHuntersMar]{Hunter's Mark}… |
| 3 | **Winter Walker Spells** | — | **TEXT** |  | When you reach a Ranger level specified in the Winter Walker Spells table, you thereafter always have the listed spells prepared. Winter Walker Spells Ranger Le… |
| 7 | **Fortifying Soul** | bend-save, temp-hp | fx1 uses |  | Your experience surviving harrowing environments allows you to bolster your allies in addition to yourself. As a Magic action, choose a number of creatures you… |
| 11 | **Chilling Retribution** | clock, interrupt, reaction, press-condition | fx1[stunned] save uses REACTION |  | When a creature hits you with an attack roll, you can take a Reaction to force the creature to make a Wisdom saving throw against your spell save DC. On a faile… |
| 15 | **Frozen Haunt** | resist, movement | fx2[transformed] dmg uses |  | When you cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplHuntersMar]{Hunter's Mark} , you can adopt a ghostly, snowy form. This form lasts until th… |

### Scion of the Three (rogue) — 5 rows · 3 combat-shaped · 1 of those text-only · 1 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Bloodthirst** | reaction | uses REACTION **TEXT** |  | When an enemy you can see within 30 feet of yourself takes damage and is Bloodied after taking that damage but not killed outright, you can take a Reaction and… |
| 3 | **Dread Allegiance** | resist | fx3 uses |  | Choose one of the Dead Three: Bane, Bhaal, or Myrkul. You gain Resistance to one type of damage and the ability to cast a cantrip, as detailed in the table belo… |
| 9 | **Strike Fear** | bend-attack, press-condition | fx1[frightened] save dmg | ✓ EFFECT_BENDS.from | You gain the following Cunning Strike option. Terrify (Cost: 1d6). The target must succeed on a Wisdom saving throw, or it has the Frightened condition for 1 mi… |
| 13 | **Aura of Malevolence** | — | dmg |  | You radiate malignant power associated with one of the Dead Three. When you use [[/item Bloodthirst]] and teleport, each creature of your choice within 10 feet… |
| 17 | **Dread Incarnate** | — | fx1 |  | You gain the following benefits. Cutthroat. You regain one expended use of Bloodthirst when you finish a Short Rest. Murderous Intent. When you roll for your Sn… |

### Spellfire Sorcery (sorcerer) — 5 rows · 3 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Spellfire Burst** | clock, temp-hp | dmg uses |  | When you spend at least 1 Sorcery Point as part of a Magic action or a Bonus Action on your turn, you can unleash one of the following magical effects of your c… |
| 3 | **Spellfire Spells** | — | **TEXT** |  | When you reach a Sorcerer level specified in the Spellfire Spells table, you thereafter always have the listed spells prepared. Spellfire Spells Sorcerer Level… |
| 6 | **Absorb Spells** | — | **TEXT** |  | You always have the Counterspell spell prepared. Additionally, whenever a target fails the saving throw against a Counterspell you cast, you regain 1d4 Sorcery… |
| 14 | **Honed Spellfire** | temp-hp | dmg |  | Your Spellfire Burst improves. You add your Sorcerer level to the Temporary Hit Points gained from Bolstering Flames, and the damage of your Radiant Fire increa… |
| 18 | **Crown of Spellfire** | clock, interrupt, reaction, half-on-save | fx2 uses REACTION |  | When you use Innate Sorcery, you can alter it and infuse yourself with the essence of spellfire, gaining the following benefits while this use of Innate Sorcery… |

### Bladesinger (wizard) — 5 rows · 1 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Bladesong** | concentration, movement | fx1 uses |  | As a Bonus Action, you invoke an elven magic called the Bladesong, provided you aren’t wearing armor or using a Shield. The Bladesong lasts for 1 minute and end… |
| 3 | **Training in War and Song** | — | **TEXT** |  | You gain proficiency with all Melee Martial weapons that don’t have the Two-Handed or Heavy property. You can use a Melee weapon with which you have proficiency… |
| 6 | **Extra Attack** | — | **TEXT** |  | You can attack twice, instead of once, whenever you take the Attack action on your turn. Moreover, you can cast one of your Wizard cantrips that has a casting t… |
| 10 | **Song of Defense** | interrupt, reaction | REACTION **TEXT** |  | When you take damage while your Bladesong is active, you can take a Reaction to expend one spell slot and reduce the damage taken by an amount equal to five tim… |
| 14 | **Song of Victory** | — | **TEXT** |  | After you cast a spell that has a casting time of an action, you can make one attack with a weapon as a Bonus Action. |

## Feats (34) — 34 rows · 25 combat-shaped · 8 of those text-only · 5 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
|  | **Cult of the Dragon Initiate** | clock, press-condition, resist | fx1[frightened] save uses |  | You gain the following benefits. Dragon’s Tongue. You know Draconic. If you already know Draconic when you select this feat, you instead learn one language of y… |
|  | **Emerald Enclave Fledgling** | press-condition, movement | **TEXT** |  | You gain the following benefits. Speak with Animals. You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplSpeakwithA]{Speak with Animals}… |
|  | **Harper Agent** | — | **TEXT** |  | You gain the following benefits. Thieves’ Cant. You know Thieves’ Cant. Instrument Training. You gain proficiency with a Musical Instrument of your choice. Dist… |
|  | **Lords' Alliance Agent** | bend-attack, clock, use-chip, crit, aura | fx1 | ✓ EFFECT_BENDS.from | You gain the following benefits. Inspiring Strike. Once per turn when you score a Critical Hit against a creature, you can choose an ally within 30 feet of your… |
|  | **Purple Dragon Rook** | — | uses **TEXT** |  | You gain the following benefits. Entreat. You gain proficiency in one of the following skills: Insight, Performance, or Persuasion. Rallying Cry. When you roll… |
|  | **Spellfire Spark** | clock | uses |  | You gain the following benefits. Magic Absorption. Once per turn, when you take damage from a spell or magical effect, you reduce the total damage taken by [[/h… |
|  | **Tyro of the Gauntlet** | bend-attack, interrupt, reaction, use-chip, aura | fx1 REACTION | ✓ EFFECT_BENDS.from | You gain the following benefits. Stand as One. When an ally within 5 feet of you is subjected to an effect that would push or pull it, you can take a Reaction t… |
|  | **Zhentarim Ruffian** | movement | **TEXT** |  | You gain the following benefits. Exploit Opening. When you roll damage for an Reference[Opportunity Attacks]{Opportunity Attack}, you can roll the damage dice t… |
| 4 | **Cold Caster** | clock | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. Cantrip. You learn the… |
| 4 | **Dragonscarred** | resist | fx1[frightened] save |  | You gain the following benefits. Ability Score Increase. Increase your Constitution or Charisma score by 1, to a maximum of 20. Damage Resistance. When you gain… |
| 4 | **Enclave Magic** | concentration | **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. Friend to Animals. You… |
| 4 | **Fairy Trickster** | bend-save, clock, press-condition, movement | fx1 save uses |  | You gain the following benefits. Ability Score Increase. Increase your Dexterity or Charisma ability score by 1, to a maximum of 20. Faerie Trod Trotter. When y… |
| 4 | **Genie Magic** | — | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. Wish Magic. As a Magic… |
| 4 | **Harper Teamwork** | bend-save, press-condition | fx1 |  | You gain the following benefits. Ability Score Increase. Increase your Dexterity or Charisma score by 1, to a maximum of 20. Withering Wordplay. When you take t… |
| 4 | **Lordly Resolve** | bend-save | fx1 uses |  | You gain the following benefits. Ability Score Increase. Increase your Strength or Charisma score by 1, to a maximum of 20. Standard Bearer. As a Bonus Action,… |
| 4 | **Mythal Touched** | reaction | save uses REACTION |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. Mythal Ward. If a spell… |
| 4 | **Order’s Resilience** | bend-save | fx1 |  | You gain the following benefits. Ability Score Increase. Increase your Strength, Wisdom, or Charisma score by 1, to a maximum of 20. Resurge. When you have the… |
| 4 | **Purple Dragon Commandant** | bend-attack, temp-hp | uses | ✓ EFFECT_BENDS | You gain the following benefits. Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. Encourage Ally. As a Bonus Action,… |
| 4 | **Spellfire Adept** | clock, resist | **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20. Fueled Spellfire. Once… |
| 4 | **Street Justice** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | You gain the following benefits. Ability Score Increase. Increase your Strength or Dexterity score by 1, to a maximum of 20. Headlock. Your allies have Advantag… |
| 4 | **Zhentarim Tactics** | — | **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Dexterity or Charisma score by 1, to a maximum of 20. Retaliate. Immediately after a crea… |
| 19 | **Boon of Bloodshed** | bend-attack, rider-damage, clock, use-chip | fx2 | ✓ EFFECT_BENDS.from | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Killer’s Fortune. When an enemy you… |
| 19 | **Boon of Bountiful Health** | temp-hp |  |  | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Augmented Health. When you gain Tem… |
| 19 | **Boon of Communication** | — | fx1 |  | Epic Boon Feat (Prerequisite: Level 19+) You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to… |
| 19 | **Boon of Desperate Resilience** | resist | fx1 |  | You gain the following benefits. Ability Score Increase. Increase your Strength or Constitution score by 1, to a maximum of 30. Defense of Body and Mind. While… |
| 19 | **Boon of Exquisite Radiance** | — | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Eternal Rest. Creatures you reduce… |
| 19 | **Boon of Fluid Forms** | temp-hp | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30. Shapechanger. You can t… |
| 19 | **Boon of Fortune’s Favor** | clock, d20-fold | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Saving Throw Reroll. When you fail… |
| 19 | **Boon of Poison Mastery** | clock, resist | uses **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Antitoxic. You have Immunity to Poi… |
| 19 | **Boon of Revelry** | press-condition, concentration | **TEXT** |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30. Inspire Dance. You alwa… |
| 19 | **Boon of Terror** | press-condition, aura, resist | save uses |  | You gain the following benefits. Ability Score Increase. Increase your Charisma score by 1, to a maximum of 30. Fearless. You have Immunity to the Frightened co… |
| 19 | **Boon of the Bright Sun** | temp-hp | fx2[marked] |  | You gain the following benefits. Ability Score Increase. Increase your Constitution, Wisdom, or Charisma score by 1, to a maximum of 30. Daylight Presence. As a… |
| 19 | **Boon of the Furious Storm** | bend-save, resist | fx1 |  | You gain the following benefits. Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30. Eye of the Storm. You h… |
| 19 | **Boon of the Soul Drinker** | interrupt, reaction, temp-hp, aura, resist | uses REACTION |  | You gain the following benefits. Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 30. Grave Resistance. You have Resistan… |

## Spells (19) — 19 rows · 18 combat-shaped · 2 of those text-only · 1 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Spellfire Flare** | — | atk dmg action |  | You unleash a blast of brilliant fire. Make a ranged spell attack against a target within range; a target gains no benefit from Half Cover or Three-Quarters Cov… |
| 1 | **Wardaway** | bend-save, rider-damage, clock, press-condition, half-on-save | fx1 save dmg action |  | You hurl a disorienting magical force toward one creature within range. The target makes a Constitution saving throw; Constructs and Undead automatically succee… |
| 2 | **Death Armor** | bend-save, clock | fx1 dmg action | ✓ DAMAGE_SHIELDS | For the duration, an inky aura surrounds one creature you touch. The target has Advantage on Death Saving Throws, and once per turn, when a creature within 5 fe… |
| 2 | **Deryan's Helpful Homunculi** | — | fx1 action |  | You summon a group of helpful spirits, which lasts for the duration. The spirits appear as homunculi or as another Construct of your choice but are intangible a… |
| 2 | **Elminster's Elusion** | bend-save, half-on-save | fx1 bonus |  | Arcane wards protect you against magic for the duration. You have Advantage on saving throws against spells and magical effects. Additionally, if you succeed on… |
| 3 | **Cacophonic Shield** | bend-attack, rider-damage, clock, press-condition, half-on-save, resist | fx2[deafened] save dmg action |  | Thunderous reverberations fill a 10-foot Emanation originating from you for the duration. Whenever the Emanation enters a creature’s space and whenever a creatu… |
| 3 | **Conjure Constructs** | press-condition, half-on-save, temp-hp | action **TEXT** |  | You conjure a group of intangible, orderly spirits that appear as a Medium group of modrons or other Constructs in an unoccupied space you can see within range.… |
| 3 | **Laeral's Silver Lance** | rider-damage, press-condition, half-on-save | fx1[prone] save dmg action |  | Silver energy bursts out from you in a 120-foot-long, 5-foot-wide Line. Each creature of your choice in the Line makes a Strength saving throw. On a failed save… |
| 3 | **Syluné's Viper** | clock, press-condition, temp-hp, movement | fx2[incapacitated,poisoned] atk dmg bonus |  | A shimmering, spectral snake encircles your body for the duration. You gain 15 Temporary Hit Points; the spell ends early if you have no Temporary Hit Points le… |
| 4 | **Backlash** | interrupt, reaction, press-condition, half-on-save | save dmg reaction |  | You ward yourself against destructive energy, reducing the damage taken by 4d6 plus your spellcasting ability modifier. If the triggering damage was from a crea… |
| 4 | **Doomtide** | clock, press-condition, half-on-save, concentration | fx1 save dmg action |  | You create a 20-foot-radius Sphere of inky fog within range. The fog is magical Darkness and lasts for the duration or until a strong wind (such as the one crea… |
| 4 | **Spellfire Storm** | rider-damage, clock, press-condition, half-on-save, concentration | save dmg action |  | You conjure a pillar of spellfire in a 20-foot-radius, 20-foot-high Cylinder centered on a point within range. The area of the Cylinder is Bright Light, and eac… |
| 5 | **Alustriel’s Mooncloak** | interrupt, reaction, temp-hp, resist | uses REACTION |  | For the duration, moonlight fills a 20-foot Emanation originating from you with Dim Light. While in that area, you and your allies have Half Cover and Resistanc… |
| 5 | **Songal's Elemental Suffusion** | press-condition, half-on-save, concentration, resist | fx6[prone] save dmg action |  | You imbue yourself with the elemental power of genies. You gain the following benefits until the spell ends: Elemental Immunity. When you cast this spell, choos… |
| 6 | **Dirge** | clock, press-condition, half-on-save, concentration, temp-hp | fx3[prone] save dmg action |  | Deathly power fills a 60-foot Emanation originating from you for the duration. When you cast this spell, you can designate creatures to be unaffected by it. Any… |
| 6 | **Elminster's Effulgent Spheres** | clock, reaction, resist | fx6 atk dmg uses REACTION |  | Six chromatic spheres orbit you for the duration. While the spheres are present, you can expend spheres to create the following effects: Absorb Energy. When you… |
| 7 | **Simbul's Synostodweomer** | temp-hp | fx1 action |  | You imbue one creature you touch with magical healing energy for the duration. Whenever the target casts a spell using a spell slot, the target can immediately… |
| 8 | **Holy Star of Mystra** | reaction | fx1[coverThreeQuarters] atk dmg bonus |  | You create a glowing mote of energy that hovers above you for the duration. The mote sheds Bright Light in a 5-foot radius and Dim Light for an additional 5 fee… |
| 9 | **Blade of Disaster** | crit | bonus **TEXT** |  | You create a 3-foot-long blade-shaped planar rift that lasts for the duration. The rift appears within range in a space of your choice, and you can immediately… |

## Items (21) — 21 rows · 3 combat-shaped · 3 of those text-only · 0 named in the registry

### Combat-shaped (3)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| equipment | **Desert Clothing** | bend-save | **TEXT** |  | Stylish but practical, our desert clothing protects you whether you’re taking a caravan of camels through the Calim Desert or exploring an ancient Mulhorandi to… |
| equipment | **Monster Camouflage** | bend-save | **TEXT** |  | The people of Icewind Dale have developed many strategies for safely traveling in dangerous wilderness. This outfit, adapted from hunting garb, deters strangers… |
| equipment | **Warm Fungal Clothing** | bend-save | **TEXT** |  | Intrepid explorers from Highplume Station in Icewind Dale have descended steam vents to bring useful fungi up from the Underdark. Our expert crafters took it fr… |

### The rest (18)

Adventurer's Ring (equipment) · Bandore (tool) · Black Coach Service (loot) · Bright Fungal Cloak (equipment) · Cittern (tool) · Covered Wagon (loot) · Devil Mask (equipment) · Domestic Wonder (equipment) · Garb of Light and Shadow (equipment) · Genie Robe (equipment) · Locking Spellbook (equipment) · Mechanical Wonder (equipment) · Prosthetic Limb (equipment) · Sled Services (loot) · Thayan Spell Tattoo (consumable) · Windskiff (equipment) · Winter Camouflage (equipment) · Yarting (tool)

## Bestiary traits, actions and reactions (6 distinct names across 5 actors in actors) — 6 rows · 5 combat-shaped · 1 of those text-only · 2 named in the registry

> Deduplicated by name (one Multiattack). The first column names ONE bearer.

### Combat-shaped (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| Axe Beak (CR 0.25) | **Beak** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Conjured Constructs (CR ?) | **Command** | half-on-save | save dmg | ✓ SAVE_PRESSES | @Embed[Compendium.dnd-heroes-faerun.options.Item.hofConjureConstr inline] |
| Domestic Wonder (CR 0) | **Mechanical Determination** | crit | save |  | If damage reduces the wonder to 0 Hit Points, it makes a Constitution saving throw with a DC of 5 plus the damage taken unless the damage is Lightning or from a… |
| Blade of Disaster (CR 1) | **Move and Attack** | — | atk dmg |  | @Embed[Compendium.dnd-heroes-faerun.options.Item.hofBladeofDisast inline]{Blade of Disaster} |
| Sled Dog (CR 0.25) | **Pack Tactics** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | The [[lookup @name lowercase]] has Advantage on an attack roll against a creature if at least one of the [[lookup @name lowercase]]'s allies is within 5 feet of… |

### The rest (1)

Wind-Up Operation
