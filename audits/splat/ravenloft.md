# Ravenloft: The Horrors Within — the measured corpus

> Generated 2026-10-02 by `tools/audit-splat-books.mjs` from an OFFLINE scan (`tools/scan-corpus-offline.mjs`, copies of the module's packs; the sandbox untouched). Evidence, not verdicts — the plan is [plans/splat-books.md](../plans/splat-books.md). **Structure**: fxN an effect count (its statuses), save / atk / dmg the activities, REACTION a reaction activity, TEXT a paragraph only. **Known**: a registry table already keyed on the NAME — a reprint that fires for free, or a collision to guard.

**Totals:** 505 rows · 313 combat-shaped · 32 of those text-only · 21 named in the registry

## Species traits (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 0 | **Eerie Token** | — | fx2[incapacitated] uses |  | As a Bonus Action, you can create a magical token by harmlessly removing a lock of hair, detaching a nail, or using some other method. While the token exists, y… |
| 0 | **Escaped Death** | bend-save | fx1 |  | You have Advantage on Death Saving Throws. |
| 0 | **Everlasting** | — | **TEXT** |  | You don’t gain Exhaustion levels from dehydration, malnutrition, or suffocation. You don’t need to sleep, and magic can’t put you to sleep. You can finish a Lon… |
| 0 | **Howl** | bend-attack, clock, press-condition, aura | fx1 save uses | ✓ EFFECT_BENDS.from | As a Bonus Action, you let out an unearthly howl. Each creature of your choice within 15 feet of you must succeed on a Wisdom saving throw (DC 8 plus your Const… |
| 0 | **Knowledge from a Past Life** | — | uses **TEXT** |  | You gain proficiency in one skill of your choice. In addition, you can temporarily peer into the past to aid you in the present. When you fail an ability check,… |
| 3 | **Spider Climb Improvement** | movement | fx1 |  | You have a Climb Speed equal to your Speed. When you reach character level 3, you can move up, down, and across vertical surfaces and along ceilings while leavi… |

## Subclasses (7)

### Reanimator (artificer) — 7 rows · 2 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Reanimated Companion** | aura | fx1 uses |  | Using Tinker’s Tools or another type of Artisan’s Tools with which you have proficiency, you can take a Magic action to create a @UUID[Compendium.dnd-ravenloft-… |
| 3 | **Reanimator Spells** | — | **TEXT** |  | When you reach an Artificer level specified in the Reanimator Spells table, you thereafter always have the listed spells prepared. Reanimator Spells Artificer L… |
| 3 | **Reanimator's Skill Set** | — | **TEXT** |  | You gain the following benefits. @Embed[Compendium.dnd-ravenloft-horrors-within.options.Item.AVoqeXk2ZFHWZzQB caption=false cite=false] Reanimator’s Tools. You… |
| 5 | **Strange Modifications** | — | **TEXT** |  | Whenever you create a @UUID[Compendium.dnd-ravenloft-horrors-within.book.JournalEntry.rhwSubclasses000.JournalEntryPage.FFTZLIEaYBc8sQfW]{Reanimated Companion,}… |
| 9 | **Improved Reanimation** | — | **TEXT** |  | The damage of your @UUID[Compendium.dnd-ravenloft-horrors-within.book.JournalEntry.rhwSubclasses000.JournalEntryPage.FFTZLIEaYBc8sQfW]{Reanimated Companion’s} D… |
| 9 | **Macabre Modifications** | — | **TEXT** |  | You experiment and alter your companion further. Whenever you create a @UUID[Compendium.dnd-ravenloft-horrors-within.book.JournalEntry.rhwSubclasses000.JournalE… |
| 15 | **Refined Reanimation** | reaction | uses REACTION |  | You have mastered the science of revivification, granting you the following benefits. Facilitated Revival. You can cast @UUID[Compendium.dnd-players-handbook.sp… |

### College of Spirits (bard) — 4 rows · 1 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Channeler** | — | **TEXT** |  | You learn how to contact spirits beyond the grave, letting their power and knowledge flow through you. You gain the following benefits. Guiding Whispers. You kn… |
| 3 | **Spirits from Beyond** | — | **TEXT** |  | You can call forth spirits of the dead to empower you and your allies. When you take a Bonus Action to give a creature a Bardic Inspiration die, you can call fo… |
| 6 | **Empowered Channeling** | clock | fx1[coverHalf] uses |  | Your ability to channel spirits improves. You gain the following benefits. Power from Beyond. Once per turn, when you cast a Bard spell with a spell slot that d… |
| 14 | **Mystical Connection** | — | **TEXT** |  | You gain mastery over the spirits you call forth. Whenever you roll on the Spirits from Beyond table, you can roll the die twice and choose which of the two eff… |

### Grave Domain (cleric) — 5 rows · 4 combat-shaped · 1 of those text-only · 1 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Circle of Mortality** | rider-damage, clock | dmg |  | You can manipulate the balance between life and death, granting you the following benefits. Pull of Death. Once per turn, when you deal damage to a creature tha… |
| 3 | **Grave Domain Spells** | — | **TEXT** |  | Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric level specified in the Grave Domain Spells table, yo… |
| 3 | **Path to the Grave** | bend-attack, clock | fx1[cursed] dmg | ✓ EFFECT_BENDS.from | As a Bonus Action, you present your Holy Symbol and expend a use of Channel Divinity to curse one creature you can see within 30 feet of yourself until the star… |
| 6 | **Sentinel at Death's Door** | interrupt, reaction, crit | uses REACTION **TEXT** |  | When you or a Bloodied creature you can see within 60 feet of yourself is hit with an attack roll, you can take a Reaction to halve that attack’s damage (round… |
| 17 | **Divine Reaper** | temp-hp, aura | uses |  | Your deep connection to this domain renders you a hallowed harbinger of death, granting you the following benefits. Enhanced Necromancy. When you cast a spell o… |

### Hollow Warden (ranger) — 5 rows · 4 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Hollow Warden Spells** | — | **TEXT** |  | When you reach a Ranger level specified in the Hollow Warden Spells table, you thereafter always have the listed spell prepared. Hollow Warden Spells Ranger Lev… |
| 3 | **Wrath of the Wild** | clock, press-condition, movement | fx4[frightened] save |  | You draw power from the strange and ancient horrors of the land, causing you to sprout unnatural growths, such as bloody antlers or putrid fangs, or causing you… |
| 7 | **Hungering Might** | clock, temp-hp | fx1 |  | You gain a bonus to Constitution saving throws equal to your Wisdom modifier (minimum of +1). In addition, once per turn when you hit a creature with an attack… |
| 11 | **Rot and Violence** | clock, temp-hp | **TEXT** |  | Your dedication to wild eldritch beings alters you further. When transformed using @UUID[Compendium.dnd-ravenloft-horrors-within.options.Item.rhwHWWrathofth3C]{… |
| 15 | **Ancient Might** | rider-damage, resist | fx1 uses |  | You become wholly suffused with the wild’s ancient and terrible power, granting you the following benefits. Ominous Strikes. When you hit a creature that has th… |

### Phantom (rogue) — 6 rows · 2 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Wails from the Grave** | — | dmg uses |  | Immediately after you deal @UUID[Compendium.dnd-players-handbook.classes.Item.phbrgeSneakAttac]{Sneak Attack} damage to a creature on your turn, you can target… |
| 3 | **Whispers of the Dead** | — | **TEXT** |  | Whenever you finish a Short or Long Rest, you can choose one skill or tool proficiency that you lack and gain it, as a ghostly presence shares its knowledge wit… |
| 9 | **Tokens of the Departed** | reaction, aura | REACTION **TEXT** |  | The spirits of the dead are drawn to you, and echoes of their past lives magically manifest as strange curios with resonant power. You gain two @UUID[Compendium… |
| 9 | **Voice of Death** | — | uses **TEXT** |  | You can cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplSpeakwithD]{Speak with Dead} once without a spell slot, requiring no spell components and u… |
| 13 | **Ghost Walk** | movement | fx1[transformed] uses |  | As a Bonus Action, you assume a spectral form, gaining the benefits below for 10 minutes or until you end them (no action required). Once you use this feature,… |
| 17 | **Death's Friend** | — | **TEXT** |  | Your association with death has become so close that you gain the following benefits. Death’s Lament. When you use @UUID[Compendium.dnd-ravenloft-horrors-within… |

### Shadow Sorcery (sorcerer) — 5 rows · 2 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Power of Shadow** | half-on-save | fx1 save uses |  | You gain the following benefits. Eyes of the Dark. You have Darkvision with a range of 120 feet and Blindsight with a range of 10 feet. In addition, if a spell… |
| 3 | **Shadow Spells** | — | **TEXT** |  | When you reach a Sorcerer level specified in the Shadow Spells table, you thereafter always have the listed spells prepared. Shadow Spells Sorcerer Level Spells… |
| 6 | **Beasts of Ill Omen** | bend-save, concentration | **TEXT** |  | You can call forth a howling creature of shadow to hound your foes. You can spend 3 Sorcery Points to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phb… |
| 14 | **Shadow Walk** | — | **TEXT** |  | While you are in Dim Light or Darkness, you can take a Bonus Action to teleport up to 120 feet to an unoccupied space you can see that is also in Dim Light or D… |
| 18 | **Umbral Form** | resist, movement | fx1[transformed] uses |  | When you use @UUID[Compendium.dnd-players-handbook.classes.Item.phbscrInnateSorc]{Innate Sorcery}, you can adopt a shadowy form, gaining the benefits below whil… |

### Undead Patron (warlock) — 5 rows · 3 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Form of Dread** | clock, press-condition, temp-hp, resist | fx4[frightened] save uses |  | As a Bonus Action, you transform into an avatar of your patron’s dreadful power, gaining the benefits below for 1 minute, until you have the Incapacitated condi… |
| 3 | **Undead Spells** | — | **TEXT** |  | The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specified in the Undead Spells table, you thereafter alway… |
| 6 | **Grave Touched** | rider-damage, clock, resist | **TEXT** |  | Your patron’s powers have a profound effect on your body and magic, granting you the following benefits. Arcane Necrosis. Necrotic damage from your attacks, War… |
| 10 | **Necrotic Husk** | press-condition, half-on-save, resist | save dmg uses |  | Your connection to undeath saturates your body. You gain the following benefits. Necrotic Resilience. You have Resistance to Necrotic damage. While using your F… |
| 14 | **Superior Dread** | resist, movement | **TEXT** |  | Your Form of Dread improves, granting you the following benefits while you are using it. Dread Resistance. You have Resistance to Bludgeoning, Piercing, and Sla… |

## Feats (11) — 11 rows · 10 combat-shaped · 1 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
|  | **Aberrant Anatomy** | clock, press-condition | fx2[stunned] save |  | Exposure to alien horrors like those of the Far Realm has warped your physical form in supernatural ways. You gain the following features. Breathless. You can h… |
|  | **Echoing Soul** | clock, press-condition, movement | fx1[incapacitated] save |  | You experience echoes from a past or alternate life. You gain the following features. Channeled Prowess. You have proficiency in two skills of your choice. In a… |
|  | **Gathered Whispers** | clock, interrupt, reaction, press-condition | fx1[deafened] save uses REACTION |  | You are haunted by a cacophony of whispering spirits only you can hear. You gain the following features. Spirit Whispers. You learn the @UUID[Compendium.dnd-pla… |
|  | **Living Shadow** | clock, press-condition | fx1[incapacitated] save uses |  | The shadow you cast is animate and ever-present—sometimes it even acts according to its own will. You gain the following features. Grasping Shadow. You learn th… |
|  | **Mist Walker** | reaction, press-condition | save uses REACTION |  | You know how to slip through the Mists’ grasp, but this freedom comes at a price: If you remain in one area for too long, the Mists find you and drain your life… |
|  | **Second Skin** | clock, press-condition, concentration | fx1[stunned] save uses |  | There is another side of you that most people never see: a beast, a terrifying avenger, or a walking nightmare. You gain the following features. Alternate Form.… |
|  | **Sharp Eye** | — | uses **TEXT** |  | When you take the Reference[Search] or Reference[Study] action, you can give yourself Advantage on any ability check made as part of that action. You can use th… |
|  | **Survivor** | reaction, d20-fold | REACTION **TEXT** |  | You gain the following benefits. Hypervigilance. Whenever you roll Initiative, you can reroll the d20 if the number rolled is 9 or lower. You must use the new r… |
|  | **Symbiotic Being** | reaction, press-condition | fx1[charmed] save uses REACTION |  | A second being resides within your body, offering knowledge and assistance while furthering its own agenda. You gain the following features. Entwined Existence.… |
|  | **Touch of Death** | bend-save | fx1 |  | Deathly power resides within you, bursting out at the slightest provocation. You gain the following features. Death Touch. You learn the @UUID[Compendium.dnd-pl… |
|  | **Watchers** | bend-save, press-condition, half-on-save | fx1 save |  | Something unnatural is always watching you, taking the form of scurrying vermin and other eerie creatures. You gain the following features. Borrowed Eyes. You a… |

## Spells (1) — 1 rows · 1 combat-shaped · 0 of those text-only · 0 named in the registry

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 0 | **Jolt to Life** | press-condition, half-on-save, temp-hp | save dmg uses action |  | @Embed[Compendium.dnd-players-handbook.spells.Item.phbsplSparetheDy caption=false] Jolt to Life. When you cast @UUID[Compendium.dnd-players-handbook.spells.Item… |

## Items (62) — 62 rows · 4 combat-shaped · 0 of those text-only · 0 named in the registry

### Combat-shaped (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| weapon | **Ebonbane** | bend-save, press-condition, d20-fold | save atk dmg |  | Weapon (Longsword) [[/attack extended]]. [[/damage average extended]] or [[/damage twoHanded average]] damage if used with two hands. The Darklord of the Domain… |
| equipment | **Harkon's Bite** | d20-fold | fx1 |  | Wondrous Item (Requires Attunement by a Humanoid) A dire wolf’s tooth dangles from this simple cord necklace. You gain a +1 bonus to ability checks and saving t… |
| feat | **Mark of Obsession** | clock, reaction, press-condition, half-on-save | fx1[frightened] save uses REACTION |  | Immediately after you take damage from a creature you can see within 10 feet of yourself, you can take a Reaction to force the creature to make a [[/save format… |
| feat | **Mark of Sacrifice** | bend-save | fx1[marked] uses |  | You can use this Blessing to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbEvilAndGoodPr]{Protection from Evil and Good} . Once you cast this spell… |

### The rest (58)

Animated Digits (loot) · Ashes of a Corpse (loot) · Barovian Wine Bottle (loot) · Black Rose (loot) · Blood Faction Gear (loot) · Bloodstained Farm Implement (loot) · Broken Holy Symbol (loot) · Broken Jewelry (loot) · Burnt Armor (loot) · Canopic Jar (loot) · Charm of the Black Rose (feat) · Coin from Darkon (loot) · Death Mask (loot) · Displacer beast skin (loot) · Dram of Sweet-Smelling Poison (loot) · Dried Crown of White Camellias (loot) · Eye of Hazlik Amulet (loot) · Faded Love Letter (loot) · Family Portrait (loot) · Feathered Mask (loot) · Flame-Singed Love Letter (loot) · Glass Shoe (loot) · Glowing Minerals (loot) · Gold Shoe (loot) · Great Cthulhu Effigy (loot) · Gremishka Foot (loot) · Handbill (loot) · Jeweled Mask (loot) · Lapis Lazuli Scarab (loot) · Letter from Leka (loot) · Mark of Beasts (feat) · Mark of the Dread Lord (feat) · Mark of the Raven Talisman (loot) · Poisonous Flower Blossom (loot) · Polished Skull (loot) · Preserved Humanoid Limb (loot) · Red Robe Scrap (loot) · Religious Relic (loot) · Rusted Tulwar (loot) · Rusty Foot Trap (loot) · Sahuagin-Tooth Fishing Lure (loot) · Scrap of Black Fabric (loot) · Scroll of Hieroglyphics (loot) · Spell Scroll: Protection from Evil and Good (consumable) · Starmetal Amulet (loot) · Starmetal Rod (loot) · Straw Doll (loot) · Symbol of the Circle (loot) · Tainted Spring Water (loot) · Tarnished Signet Ring (loot) · Three Thorns (loot) · Unbreakable Heart (equipment) · von Zarovich Crest (loot) · Wolf’s Tooth Necklace (loot) · Woodcut of Hunting Wolves (loot) · Worn Fine Clothing (loot) · Wyvern-and-Lotus Shield (loot) · Zombie Flesh (loot)

## Bestiary traits, actions and reactions (388 distinct names across 1 actors in options, 68 actors in actors, 49 actors in fallback-actors) — 388 rows · 278 combat-shaped · 26 of those text-only · 19 named in the registry

> Deduplicated by name (one Multiattack). The first column names ONE bearer.

### Combat-shaped (278)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| Violet Fungus Necrohulk (CR 7) | **Absorb Body** | bend-save | fx1[restrained] save |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=YqWqaRXxaKFCH6P8]], one [[lookup @target.affects.special activity=YqWqaRXxaKFCH6P8]] [[lookup @target… |
| Madam Eva (CR 10) | **Apocalyptic Visions** | half-on-save | fx1[frightened] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=Gi38YZg0eUwY6sCG]], each creature in a [[lookup @target.template.size activity=Gi38YZg0eUwY6sCG]]-foot-… |
|  (CR ?) | **Arcane Conduit** | clock | dmg |  | Arcane Conduit. You can cast spells as though you were in the companion’s space, but you must use your own senses. Once per turn, when you cast an Artificer spe… |
| Hazlik (CR 14) | **Arcane Teleport** | — | dmg |  | [[lookup @name]] teleports up to [[lookup @range.value activity=XvU04kSzGNl1AHrk]] feet to an unoccupied space he can see, and each creature within [[lookup @ta… |
| Vladeska Drakov (CR 12) | **Artillery Fire** | half-on-save | fx1[prone] save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=BSMpNeExZoUVX9k0]], each creature in a [[lookup @target.template.size activity=BSMpNeExZoUVX9k0]]-fo… |
| Gallows Speaker (CR 6) | **Aura of Violence** | — | save dmg |  | At the end of each of the [[lookup @name lowercase]]’s turns, each creature of the [[lookup @name lowercase]]’s choice in a [[lookup @target.template.size activ… |
| Displacer Beast (CR 3) | **Avoidance** | press-condition, half-on-save | **TEXT** |  | If the [[lookup @name lowercase]] is subjected to an effect that allows it to make a saving throw to take only half damage, it instead takes no damage if it suc… |
| Arcanaloth (CR 12) | **Banishing Claw** | — | fx1[incapacitated] save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a creature, it is subjected to the following effect. Charisma Saving Throw: DC [[lookup @sa… |
| Nightgaunt (CR 8) | **Barb** | clock | fx1[poisoned] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] condition until the end of its next turn. |
| Chakuna (CR 11) | **Barbed Spear** | — | fx1 atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target receives a dire wound if it doesn’t have one. While the target is wounded, its speed is reduc… |
| Wereraven (CR 2) | **Beak (Raven or Hybrid Form Only)** | resist | fx1[cursed] save atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Humanoid, it is subjected to the following effect. Constitution Saving Throw : DC [[looku… |
| Vampire Umbral Lord (CR 15) | **Beguile** | clock | **TEXT** |  | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCommand000] , requiring no spell components and using Charisma as t… |
| Dullahan (CR 10) | **Beheading Blade** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is reduced to 0 Hit Points by this attack, it dies and its head is lopped off. The head rises… |
| Performer Legend (CR 10) | **Bejeweled Baton** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Strahd von Zarovich (CR 15) | **Bite (Bat or Vampire Form Only)** | temp-hp | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=1NiuoT80BC9X8nuN]], one creature within 5 feet that is willing or that has the Grappled, Incapaci… |
| Harkon Lukas (CR 14) | **Bite (Dire Wolf or Hybrid Form Only)** | resist | fx1[cursed] save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Humanoid, it is subjected to the following effect: Constitution Saving Throw : DC [[looku… |
| Gremishka (CR 2) | **Bite (Individual Form Only)** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Gennifer Weathermay-Foxgrove (CR 3) | **Blessed Dagger** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Harkon Lukas (CR 14) | **Blood Frenzy** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | [[lookup @name]] has Advantage on attack rolls against any creature that doesn’t have all its Hit Points. |
| Necrichor (CR 7) | **Blood Puppeteering** | bend-save, resist | fx1[incapacitated] save uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=C3NxPjEucRVXRX2n]], one Bloodied creature within [[lookup @range.value activity=C3NxPjEucRVXRX2n]… |
| Vampire Nosferatu (CR 8) | **Blood Spew** | half-on-save, temp-hp | fx1 save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=gwZ1dZNAIdLIxOc9]], each creature in a [[lookup @target.template.size activity=gwZ1dZNAIdLIxOc9]]… |
| Vampire Nosferatu (CR 8) | **Bloodthirsty Slash** | reaction, movement | REACTION **TEXT** |  | Trigger : [[lookup @activation.condition activity=t3NyYIgLfA2FKHN8]] Response : The [[lookup @name lowercase]] moves up to its Speed without provoking Reference… |
| Ez d’Avenir (CR 8) | **Bolster Allies** | bend-attack, clock, use-chip, resist | fx2 |  | [[lookup @name]] chooses up to six allies within [[lookup @range.value activity=QxPMPhodLHuq0eWf]] feet. Each target that can hear her has [[lookup @name]]’s ch… |
| Viktra Mordenheim (CR 7) | **Bolster Inventions** | press-condition, temp-hp |  |  | At the end of each of [[lookup @name]]’s turns, each of her Construct allies in a [[lookup @target.template.size activity=mDsy1WKnpta30Zzg]]-foot Emanation orig… |
| Wilfred Godefroy (CR 6) | **Bone-Chilling Step** | — | dmg |  | [[lookup @name]] teleports up to [[lookup @range.value activity=YQzmAhV3ulQolPPt]] feet to an unoccupied space he can see, and each creature within [[lookup @ta… |
| Aberrant Death’s Head (CR 1) | **Brain-Rending Bite** | — | fx1[frightened] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Frightened apply=false] condition until the start of the [[lookup @name low… |
| Lord Soth of Sithicus (CR 19) | **Cataclysmic Fire** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=AI6TCRoOrgponVG9]], each creature in a [[lookup @target.template.size activity=AI6TCRoOrgponVG9]]-fo… |
| Shambling Mound (CR 5) | **Charged Tendril** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, the [[lookup @name lowercase]] pulls the target 5 feet straig… |
| Gug (CR 12) | **Chew** | — | fx2[coverHalf,restrained,prone] save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=KdxZst6o4oazgjAN]], up to two Medium or smaller creatures Grappled by the [[lookup @name lowercase]]… |
| Greater Star Spawn Emissary (CR 21) | **Coagulated Nodule** | — | atk |  | Ranged Attack Roll: [[/attack]], range 120 ft. Hit: [[/damage average]] damage. |
| Winter Wolf (CR 3) | **Cold Breath** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=8P7hmd3Nron4RAIv]], each [[lookup @target.affects.type activity=8P7hmd3Nron4RAIv]] in a [[lookup… |
| Shoggoth (CR 11) | **Cold Sprint** | reaction | REACTION **TEXT** |  | Trigger : [[lookup @activation.condition activity=OMTjacQKsF6gqO79]] Response : The [[lookup @name lowercase]] moves up to its Speed and can make one [[/item Ps… |
| Yuan-ti Abomination (CR 7) | **Constrict** | half-on-save | fx1[grappled,restrained] save dmg |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=IgOMjRxAt7UISkJq]], one [[lookup @target.affects.special activity=IgOMjRxAt7UISkJq]] creature the [[l… |
| Jiangshi (CR 9) | **Consume Energy** | clock, half-on-save, temp-hp, movement | fx1 save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=vqUPNibCkXperEoA]], one creature the [[lookup @name lowercase]] can see within [[lookup @range.va… |
| Banshee (CR 4) | **Corrupting Touch** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Greater Star Spawn Emissary (CR 21) | **Cosmic Transformation** | — | dmg |  | When a creature in the lair shape-shifts to its true form, creatures in a [[lookup @target.template.size activity=PobW71zzXO8GZYTa]]-foot Emanation originating… |
| Warrior Commander (CR 10) | **Counterattack** | reaction | fx1 REACTION | ✓ LIST:INTERRUPTS | Trigger : The [[lookup @name lowercase]] is hit by an attack roll. Response: The [[lookup @name lowercase]] adds 4 to its AC against that attack, possibly causi… |
| Mordenheim’s Monster (CR 12) | **Crush** | — | fx1[restrained,suffocation] save dmg |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=9fpHSUQ1HoFrAMiE]], one creature Reference[Grappled apply=false] by the monster. Failure : [[/damage… |
| Harkon Lukas (CR 14) | **Crushing Insult** | bend-save | save dmg |  | [[lookup @name]] uses [[/item Shape-Shift]] to return to his humanoid form, then uses the following effect. Wisdom Saving Throw : DC [[lookup @save.dc.value act… |
| Relentless Juggernaut (CR 12) | **Crushing Stone** | — | fx1[incapacitated] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Incapacitated apply=false] condition until the start of the [[lookup @name… |
| Ez d’Avenir (CR 8) | **Curse of the All-Seeing Eye** | — | fx13[cursed] save uses |  | [[lookup @name]] chooses a damage type. Wisdom Saving Throw : DC [[lookup @save.dc.value activity=NcSG2KonlusfZLFX]], one target within [[lookup @range.value ac… |
| Madam Eva (CR 10) | **Cursed Dagger** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Ebonbane (CR 13) | **Darkflame Slash** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Mi-Go (CR 9) | **Dazing Ray** | — | fx1[stunned] save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=h8B8USJKl7R8SBkA]], one creature the [[lookup @name lowercase]] can see within [[lookup @range.value… |
| Ivan Dilisnya (CR 5) | **Deadly Contraption** | — | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=clp8l1sY1eCsU9FA]], one creature [[lookup @name]] can see within [[lookup @range.value activity=clp8… |
| Reanimated Companion (CR ?) | **Death Burst** | half-on-save | fx1 save dmg |  | The [[lookup @name lowercase]] explodes when it dies. [[/save]]{Dexterity Saving Throw:} DC equals your spell save DC, each creature in a [[lookup @target.templ… |
| Mist Wanderer (CR 3) | **Death Curse** | — | fx1[deafened] save |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=97fLrn5B9O40FbQM]], each creature in a [[lookup @target.template.size activity=97fLrn5B9O40FbQM]]-foo… |
| Strahd von Zarovich (CR 15) | **Death Strike** | — | fx1[grappled] atk dmg | ✓ DEATH_STRIKE | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Grappled apply=false] condition (escape D… |
| Death Cultist (CR 8) | **Deathly Ray** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Zombie Clot (CR 6) | **Deathly Stench** | clock | fx1[poisoned] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=B6eYdNyZDNGN28ap]], any creature that starts its turn in a [[lookup @target.template.size activit… |
| Banshee (CR 4) | **Deathly Wail** | — | save dmg uses |  | The [[lookup @name lowercase]] releases a mournful wail if it isn’t in sunlight. Constitution Saving Throw: DC [[lookup @save.dc.value activity=mnlRA4ivGOORPiBs… |
| Blob of Annihilation (CR 23) | **Decay** | clock | dmg |  | The [[lookup @name lowercase]] deals [[/damage average]] damage [[lookup @target.affects.special activity=Seq1WbVdQNorBsTL]]. The [[lookup @name lowercase]] can… |
| Laurie Weathermay-Foxgrove (CR 3) | **Deflect Blow** | interrupt, reaction | REACTION **TEXT** |  | Trigger : [[lookup @activation.condition activity=qvWn7DuBd5mmvZ1M]] Response : The triggering attack’s damage is reduced by 5 ([[/r 1d10]]). |
| Intellect Devourer (CR 2) | **Devour Intellect** | — | fx1[stunned] save dmg |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=7LNepwMsw4xbXyRk]], one [[lookup @target.affects.type activity=7LNepwMsw4xbXyRk]] the [[lookup @n… |
| Displacer Beast (CR 3) | **Displacement** | press-condition | **TEXT** | ✓ EFFECT_BENDS | Attack rolls against the [[lookup @name lowercase]] have Disadvantage, since it projects an illusion that makes it appear to be near its actual location. This t… |
| Brain in a Jar (CR 3) | **Disrupting Burst** | bend-save, clock, concentration | fx1 atk |  | [[/attack extended]]. [[/damage average extended]]. The target can’t take Reference[Reaction] until the end of its next turn, and it has Disadvantage on saving… |
| Ramya Vasavadan (CR 15) | **Dread Blade** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Death Knight Aspirant (CR 11) | **Dread Blade** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Death Cultist (CR 8) | **Dread Scythe** | clock, temp-hp | fx1 atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target can’t regain Hit Points until the end of its next turn. |
| Mummy (CR 3) | **Dreadful Glare** | resist | fx1[frightened] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=8LmlZfevSQkOxGSN]], one [[lookup @target.affects.type activity=8LmlZfevSQkOxGSN]] the [[lookup @name lo… |
| Vladeska Drakov (CR 12) | **Dreadful Impaling** | clock | fx1[frightened] save |  | [[lookup @name]] makes an [[/item Impaling Spear]] attack. If the attack hits and the target is a creature, each ally of the target within [[lookup @target.temp… |
| Reanimated Companion (CR ?) | **Dreadful Swipe** | clock, movement | fx2 atk |  | [[/attack]]{Melee Attack Roll:} Bonus equals your spell attack modifier, reach 5 ft. [[/damage]]{Hit:} 1d4 plus your Intelligence modifier Necrotic damage, and… |
| Vampire Mind Flayer (CR 5) | **Drink Sapience** | temp-hp | fx1[exhaustion] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=1rWMcKsvgRfkMip9]], one creature the [[lookup @name lowercase]] has Reference[Grappled apply=false]. Fa… |
| Dao (CR 11) | **Earth Burst** | — | save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. Hit or Miss: Earth explodes from the target’s space, creating the following effect. Dexterity Saving Throw:… |
| Lizardfolk Sovereign (CR 4) | **Earthen Maul** | — | fx1[prone] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, it has the Reference[Prone apply=false] condition. |
| Azalin Rex (CR 23) | **Eldritch Burst** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Cthulhu (CR 25) | **Eldritch Claw** | — | fx1[grappled] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Grappled apply=false] condition (escape D… |
| Elemental Cultist (CR 8) | **Elemental Absorption** | reaction, resist | fx5 uses REACTION | ✓ REBUKES | Trigger: The [[lookup @name lowercase]] [[lookup @activation.condition activity=5HvUimjPYvPVM4g7]]. Response: The [[lookup @name lowercase]] gives itself Resist… |
| Elemental Cultist (CR 8) | **Elemental Claw** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]] ([[lookup @name lowercase]]'s choice). If the target is a Medium or smaller creature, the cultist moves the t… |
| Elemental Cultist (CR 8) | **Elemental Flail** | — | atk |  | [[/attack extended]]. [[/damage average extended]] ([[lookup @name lowercase]]'s choice). |
| Blob of Annihilation (CR 23) | **Engulf** | — | fx1[restrained,suffocation,coverTotal] save dmg |  | The [[lookup @name lowercase]] moves up to its Speed and can move through the spaces of Huge or smaller creatures and objects. Strength Saving Throw: DC [[looku… |
| Pirate (CR 1) | **Enthralling Panache** | — | fx1[charmed] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=66IPjaLIJqqwvmrL]], [[lookup @target.affects.labels.statblock activity=66IPjaLIJqqwvmrL]] the [[lookup… |
| Harkon Lukas (CR 14) | **Enthralling Performance (Humanoid Form Only)** | — | fx1[charmed] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=4MM6OcILSrMcJH5h]], each creature in a [[lookup @target.template.size activity=4MM6OcILSrMcJH5h]]-foot… |
| Bodytaker Plant (CR 7) | **Entrapping Pod** | — | fx2[blinded,paralyzed,prone] save |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=vcNhhABhnSAeFsLI]], one Large or smaller creature the plant is grappling. Failure : The target is pul… |
| Gennifer Weathermay-Foxgrove (CR 3) | **Esoteric Ward** | clock | fx1[stunned] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=wTip1ZJiumWKzEGZ]], each creature in a [[lookup @target.template.size activity=wTip1ZJiumWKzEGZ]]… |
| Relentless Juggernaut (CR 12) | **Executioner’s Blade** | — | fx1 atk |  | [[/attack extended]]. [[/damage average extended]], and the target’s Speed is reduced by 10 feet until the end of the [[lookup @name lowercase]]’s next turn. |
| Relentless Nightmare (CR 11) | **Exhausting Gaze** | — | fx1[exhaustion] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=eOfDEpW1rp7MvlKa]], one creature the [[lookup @name lowercase]] can see within [[lookup @range.value ac… |
| Death’s Head Tree (CR 4) | **Exploding Head** | half-on-save | fx1[poisoned] save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=y0jZtJwqZS69o4qr]], each creature in a [[lookup @target.template.size activity=y0jZtJwqZS69o4qr]]-fo… |
| Mind Flayer (CR 7) | **Extract Brain** | half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=DinjHW2u6r40l57Y]], [[lookup @target.affects.labels.statblock activity=DinjHW2u6r40l57Y]] that is… |
| Mi-Go (CR 9) | **Extract Brain (Requires Silver Canister)** | press-condition, half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=w62Ys8PYfuvS7WZs]], one creature that is Grappled by the [[lookup @name lowercase]] or that has t… |
| Beholder Zombie (CR 5) | **Eye Rays** | clock, half-on-save, d20-fold, volley, temp-hp | fx3[poisoned,frightened,paralyzed] save dmg |  | The [[lookup @name lowercase]] randomly shoots one of the following magical rays at a target it can see within 120 feet of itself (roll [[/r 1d4]]; reroll if th… |
| Lord Soth of Sithicus (CR 19) | **Face of Death** | half-on-save | fx1[frightened] save dmg uses |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=3cJZ3TK0oWSrKPI5]], each creature in a [[lookup @target.template.size activity=3cJZ3TK0oWSrKPI5]]-foo… |
| Wilfred Godefroy (CR 6) | **Fated Bullet** | clock, temp-hp | fx1 save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=8CdnDX4yf2D0dAnZ]], one creature [[lookup @name]] can see within [[lookup @range.value activity=8Cdn… |
| Sahuagin Baron (CR 5) | **Fiendish Blood** | reaction | fx1[cursed] save dmg REACTION | ✓ REBUKES | Trigger: The [[lookup @name lowercase]] takes Piercing or Slashing damage. Response—Constitution Saving Throw: DC [[lookup @save.dc.value activity=9JNSVEpH1x9MU… |
| Arcanaloth (CR 12) | **Fiendish Burst** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Ez d’Avenir (CR 8) | **Fiery Bolt** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Dullahan (CR 10) | **Fiery Skull** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Shield Guardian (CR 7) | **Fist** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Zombie Clot (CR 6) | **Flesh Entomb** | resist | fx1[coverTotal,restrained] save dmg uses |  | Strength Saving Throw: DC 16, one creature the [[lookup @name lowercase]] can see within [[lookup @range.value activity=5XYjWSjoJEbtju29]] feet. Failure : [[/da… |
| Cthulhu (CR 25) | **Fold Space** | clock, half-on-save | save dmg |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=vipzw9q30y0oGlez]], each creature and object that isn’t being worn or carried in a [[lookup @target.t… |
| Azalin Rex (CR 23) | **Forbidden Knowledge** | half-on-save | fx1[stunned] save dmg |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=4G0I78Q13N8dKl8J]], up to three creatures [[lookup @name]] can see within [[lookup @range.value a… |
| Inquisitor of the Tome (CR 8) | **Force Blade** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it is pushed up to 10 feet straight away from the inquisitor. |
| Stone Golem (CR 10) | **Force Bolt** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Greater Star Spawn Emissary (CR 21) | **Forced Mutations** | clock | fx1[paralyzed] save |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=q0McttlfGJL5mcor]], up to two creatures the emissary can see within [[lookup @range.value activity=q0… |
| Ivan Dilisnya (CR 5) | **Foreleg** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Lord Soth of Sithicus (CR 19) | **Forsaken Brand** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
|  (CR ?) | **Gaunt** | clock, press-condition, movement | fx2[frightened] save |  | Gaunt. The companion’s Speed increases to 45 feet, and it gains a Climb Speed equal to its Speed. It can climb difficult surfaces, including along ceilings, wit… |
| Laurie Weathermay-Foxgrove (CR 3) | **Gossamer** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Blob of Annihilation (CR 23) | **Grasping Glob** | clock | **TEXT** |  | The [[lookup @name lowercase]] uses [[/item .mmRestrainingGlo]]. The [[lookup @name lowercase]] can’t take this action again until the start of its next turn. |
| Vampire Umbral Lord (CR 15) | **Grave Strike** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Mordenheim’s Monster (CR 12) | **Greater Lightning Absorption** | clock, temp-hp, movement | fx1 |  | Whenever the monster is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt, and its Speed increases by 40 feet… |
| Warrior Commander (CR 10) | **Greatsword** | bend-attack, use-chip, movement | fx1 atk |  | [[/attack extended]]. [[/damage average extended]]. The [[lookup @name lowercase]] also creates one of the following effects: Sap . The target has Disadvantage… |
| Rudolph van Richten (CR 5) | **Hand Crossbow** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Ankhtepot (CR 17) | **Hand of Fate** | half-on-save | save dmg |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=ZE9r1qXQCUzucMAU]], one Large or smaller creature [[lookup @name]] can see within [[lookup @range.val… |
| Haunting Revenant (CR 10) | **Haunted Zone** | — | save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=xmF8v1o2HyVyepb6]], any [[lookup @target.affects.type activity=xmF8v1o2HyVyepb6]] [[lookup @targe… |
| Relentless Nightmare (CR 11) | **Haunter’s Spear** | — | fx1[exhaustion] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. Additionally, the target is cursed by the nightmare if it isn’t already. Until this curse ends, finishing a… |
| Graveyard Revenant (CR 7) | **Haunting Glare** | — | fx1[paralyzed] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=kIxd4BuhFya6117b]], each [[lookup @target.affects.type activity=kIxd4BuhFya6117b]] in a [[lookup @targe… |
| Death’s Head Tree (CR 4) | **Head Fruits** | reaction |  |  | Each Undead ally in the tree’s space can immediately take a Reaction to gain [[/healing]]. |
| Dullahan (CR 10) | **Headless Wail** | half-on-save | fx1[frightened] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=PsQsGDnXr9NS8kmx]], up to three creatures within [[lookup @range.value activity=PsQsGDnXr9NS8kmx]… |
| Death Knight Aspirant (CR 11) | **Hellfire Orb** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=q3tW0wl3eLe2rDU9]], each [[lookup @target.affects.type activity=q3tW0wl3eLe2rDU9]] in a [[lookup @ta… |
| Fiend Cultist (CR 8) | **Hellish Rebuke** | reaction | REACTION **TEXT** | ✓ REBUKES | The [[lookup @name lowercase]] casts @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplHellishReb]{Hellish Rebuke} in response to that spell’s trigger, us… |
| Archpriest (CR 12) | **Holy Word** | half-on-save | fx1[stunned] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=hDo31s3Eg9EW7GUZ]], each [[lookup @target.affects.type activity=hDo31s3Eg9EW7GUZ]] in a [[lookup @targe… |
| Relentless Slasher (CR 8) | **Homing Knife** | — | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=jTdxUFVNJuWsAB6L]], one creature within [[lookup @range.value activity=jTdxUFVNJuWsAB6L]] feet that… |
| Nightmare (CR 3) | **Hooves** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Banshee (CR 4) | **Horrify** | resist | fx1[frightened] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=HLddTFpf4viIdEOL]], [[lookup @target.affects.labels.statblock activity=HLddTFpf4viIdEOL]] the [[lookup… |
| Gallows Speaker (CR 6) | **Howling Wind** | half-on-save | fx1[deafened,frightened] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=1gyDqaHiLPf62fSO]], each creature in a [[lookup @target.template.size activity=1gyDqaHiLPf62fSO]]… |
| Ez d’Avenir (CR 8) | **Hunter’s Blade** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Wilfred Godefroy (CR 6) | **Hunting Rifle** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Ultroloth (CR 13) | **Hypnotic Gaze** | resist | fx1[stunned] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=Sc5RbdImboeEd4zt]], each [[lookup @target.affects.type activity=Sc5RbdImboeEd4zt]] in a [[lookup @targe… |
| Ramya Vasavadan (CR 15) | **Illusory Disguise** | bend-save | fx1[frightened] save |  | [[lookup @name]] casts [[/item .vasF5p9AfSJBIglL]]{Disguise Self}, using the same spellcasting ability as Spellcasting. The spell lasts until [[lookup @name]] d… |
| Vladeska Drakov (CR 12) | **Impaling Spear** | — | fx1[restrained] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target is impaled on [[lookup @name]]’s spear. While impaled, the creature has the Reference[Restrai… |
| Relentless Juggernaut (CR 12) | **Implacable Advance** | clock, movement | fx1[prone] save dmg |  | The [[lookup @name lowercase]] moves up to half its Speed, ignoring Reference[Difficult Terrain]. Each creature in its path is subjected to the following effect… |
| Inquisitor of the Tome (CR 8) | **Implode** | half-on-save | save dmg uses |  | Dexterity Saving Throw : DC [[lookup @save.dc.value activity=hpXkmSfmQhdCStlR]], each creature in a [[lookup @target.template.size activity=hpXkmSfmQhdCStlR]]-f… |
| Cthulhu (CR 25) | **Impossible Geometry** | movement | dmg |  | Ground, air, and water in a [[lookup @target.template.size activity=vfzxFhOp4LNZM0cC]]-foot Emanation originating from [[lookup @name]] is Reference[Difficult T… |
| Unspeakable Horror (CR 8) | **Incomprehensible Form** | press-condition | **TEXT** |  | Attack rolls against the [[lookup @name lowercase]] have Disadvantage. This trait is suppressed while the horror has the Incapacitated condition. |
| Saidra d’Honaire (CR 9) | **Incorporeal Movement** | movement | dmg |  | [[lookup @name]] can move through other creatures and objects as if they were Reference[Difficult Terrain]. It takes [[/damage average]] damage if it ends its t… |
| Swarm of Infesting Insects (CR 2) | **Infestation** | — | fx3[blinded,exhaustion,poisoned] save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. or 7 ([[/r 2d4 + 2]]) Poison damage if the swarm is Bloodied, and the target has the Reference[Poisoned appl… |
| Inquisitor of the Mind Fire (CR 8) | **Inquisitor’s Command** | — | fx1[charmed] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=PKYI5vlw7SfHplxm]], each creature of the inquisitor’s choice that it can see within [[lookup @range.val… |
| Ez d’Avenir (CR 8) | **Inspiring Rally** | reaction, movement | **TEXT** |  | [[lookup @name]] chooses up to six allies within [[lookup @range.value activity=4OoBSxFRB5qGY1Rq]] feet. Each target that can hear her can take a Reaction to mo… |
| Mist Horror (CR 3) | **Instill Dread** | — | fx1[frightened] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=SpQ3QwYuafeUCGH5]], each creature in the [[lookup @name lowercase]]’s space. Failure : The target has t… |
| Lesser Star Spawn Emissary (CR 19) | **Invert Flesh** | — | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=8atRJX5oCM2EHRBm]], one creature the emissary can see within [[lookup @range.value activity=8atRJ… |
| Haunting Revenant (CR 10) | **Invitation** | — | fx1[coverTotal] save |  | Charisma Saving Throw: DC 17, each [[lookup @target.affects.type activity=dmDueJBxvNHlrRhx]] in a [[lookup @target.template.size activity=dmDueJBxvNHlrRhx]]-foo… |
| Jiangshi (CR 9) | **Jiangshi Weaknesses** | bend-save, resist | fx1 |  | The [[lookup @name lowercase]] has these weaknesses: Fear of Its Own Reflection . If the [[lookup @name lowercase]] sees its reflection, it immediately takes it… |
| Greater Star Spawn Emissary (CR 21) | **Lashing Maw** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Saidra d’Honaire (CR 9) | **Life Drain** | half-on-save | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=iiG6ykiiavc0o4qo]], one creature [[lookup @name]] can see within [[lookup @range.value activity=i… |
| Gulthias Blight (CR 16) | **Life-Draining Root** | temp-hp | fx1[grappled,restrained] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=3wTX71UEAiIZ5cr4]], [[lookup @target.affects.special activity=3wTX71UEAiIZ5cr4]] the [[lookup @na… |
| Laurie Weathermay-Foxgrove (CR 3) | **Light Crossbow** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Reanimated Companion (CR ?) | **Lightning Absorption** | temp-hp | **TEXT** |  | Whenever the [[lookup @name lowercase]] is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt. |
| Viktra Mordenheim (CR 7) | **Lightning Rod** | clock | atk |  | [[/attack extended]]. [[/damage average extended]], and the target can’t take Reactions until the start of its next turn. |
| Troll (CR 5) | **Loathsome Limbs** | temp-hp | fx6[exhaustion] uses |  | If the [[lookup @name lowercase]] ends any turn Bloodied and took 15+ Slashing damage during that turn, one of the [[lookup @name lowercase]]l’s limbs is severe… |
| Warrior Commander (CR 10) | **Longbow** | clock | fx1 atk |  | [[/attack extended]]. [[/damage average extended]], and the target’s Speed decreases by 10 feet until the end of the target’s next turn. |
| Strahd Skeleton (CR 4) | **Longsword** | — | atk |  | [[/attack extended]]. [[/damage average extended]] or [[/damage twoHanded average]] damage if used with two hands. |
| Loup Garou (CR 13) | **Longsword (Humanoid or Hybrid Form Only)** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Gremishka (CR 2) | **Magic Allergy (Individual Form Only)** | reaction | fx1 uses REACTION |  | Trigger : [[lookup @activation.condition activity=HnwX8wbf6qF7Xgqz]] Response : The [[lookup @name lowercase]] regains [[/healing]], then becomes a Medium swarm… |
| Performer Legend (CR 10) | **Majestic Song** | half-on-save | fx2[charmed,frightened] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=6TeipSZlJHOJTSZQ]], each [[lookup @target.affects.type activity=6TeipSZlJHOJTSZQ]] in a [[lookup @targe… |
| Warrior Commander (CR 10) | **Maneuver** | reaction, movement | **TEXT** |  | One [[lookup @target.affects.type activity=WMz2y2H5SLCDAxCF]] who can see or hear the [[lookup @name lowercase]] can take a Reaction to move up to half the [[lo… |
| Waxwork (CR 3) | **Meltable** | bend-save, clock | fx1 |  | If the [[lookup @name lowercase]] takes Fire damage, until the end of its next turn, its Speed decreases by 20 feet and it has Disadvantage on saving throws. |
| Ultroloth (CR 13) | **Mercurial Whip** | — | atk |  | [[/attack extended]]. [[/damage average extended]], and the [[lookup @name lowercase]] can teleport the target up to 10 feet to an unoccupied space the [[lookup… |
| Brain in a Jar (CR 3) | **Mind Blast** | half-on-save | fx1[incapacitated] save dmg uses |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=nDyNzpDSOP4mSdMi]], each creature in a [[lookup @target.template.size activity=nDyNzpDSOP4mSdMi]]… |
| Vampire Mind Flayer (CR 5) | **Mind Burst** | — | fx1[incapacitated] save uses |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=gkZPYPnjraR1uB72]], each creature in a [[lookup @target.template.size activity=gkZPYPnjraR1uB72]]… |
| Inquisitor of the Mind Fire (CR 8) | **Mind Fire** | — | fx1[stunned] save dmg |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=rNHJ2zvkVKgJBcNQ]], one creature the inquisitor can see within [[lookup @range.value activity=rNH… |
| Mist Horror (CR 3) | **Mind Rend** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Aberrant Cultist (CR 8) | **Mind Rot** | half-on-save | fx1[poisoned] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=DvEIJK7HFwBWNpkq]], [[lookup @target.affects.labels.statblock activity=DvEIJK7HFwBWNpkq]] the [[lookup… |
| Yithian (CR 15) | **Mind Swap** | resist | fx2[incapacitated,stunned] save uses |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=obyN9zvNjxPw43W3]], one Humanoid the [[lookup @name lowercase]] can see within [[lookup @range.va… |
| Elder Thing (CR 14) | **Mind-Scouring Spores** | half-on-save | save dmg uses |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=e4s0XDSNKisQhxeS]], each creature in a [[lookup @target.template.size activity=e4s0XDSNKisQhxeS]]… |
|  (CR ?) | **Moist** | — | fx1 dmg |  | Moist. The companion gains a Swim Speed equal to its Speed, and it can move through a space as narrow as 1 inch without expending extra movement to do so. In ad… |
| Mother Lorinda (CR 8) | **Mother’s Brand** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Mother Lorinda (CR 8) | **Mother’s Visage** | bend-save | fx1[frightened] save uses |  | [[lookup @name]] shape-shifts into Mother, a deity revered by the people of Tepest, for 8 hours. Her game statistics are the same in each form. Any equipment sh… |
| Hydra (CR 8) | **Multiple Heads** | temp-hp | **TEXT** |  | The [[lookup @name lowercase]] has five heads. Whenever the [[lookup @name lowercase]] takes 25 damage or more on a single turn, one of its heads dies. The [[lo… |
| Relentless Nightmare (CR 11) | **Narcotize** | — | fx1[unconscious] dmg |  | The [[lookup @name lowercase]] targets one creature it can see within [[lookup @range.value activity=1mhhycQvHVxRvBMk]] feet that’s cursed by its Haunter’s Spea… |
| Priest of Osybus (CR 6) | **Necrotic Bolt** | temp-hp | atk |  | [[/attack extended]]. [[/damage average extended]]., and the target can’t regain Hit Points until the start of the priest’s next turn. |
| Wight (CR 3) | **Necrotic Bow** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Necrichor (CR 7) | **Necrotic Burst** | temp-hp | fx1[poisoned] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] condition until the start of the [[lookup @name lower… |
| Wight (CR 3) | **Necrotic Sword** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Ankhtepot (CR 17) | **Negative Energy Burst** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Wilfred Godefroy (CR 6) | **Object Slam** | — | atk | ✓ EFFECT_BENDS | [[/attack extended]]. [[/damage average extended]]. |
| Vladeska Drakov (CR 12) | **Order Ballista** | clock | fx1 save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=0Wt8S0EaV1VYG5ZN]], one creature Vladeska can see within [[lookup @range.value activity=0Wt8S0EaV1VY… |
| Fiend Cultist (CR 8) | **Pact Axe** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Cultist Fanatic (CR 2) | **Pact Blade** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Grell (CR 3) | **Paralyzing Tentacles** | half-on-save | fx2[poisoned,paralyzed,grappled] save atk |  | [[/attack extended]]. [[/damage extended]]. If the target is a [[lookup @target.affects.special activity=MEc8vUTPipCkqjyq]] [[lookup @target.affects.type activi… |
| Ebonbane (CR 13) | **Parry** | reaction | REACTION **TEXT** | ✓ LIST:INTERRUPTS | Trigger : [[lookup @activation.condition activity=aLG3BRZL7P6OEjwd]] Response : [[lookup @name]] adds 5 to its AC against that attack, possibly causing it to mi… |
| Petrifying Death’s Head (CR 1) | **Petrifying Bite** | — | fx2[restrained,petrified] save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a creature, it is subjected to the following effect. Constitution Saving Throw: DC [[lookup… |
| Unspeakable Horror (CR 8) | **Phantasmic Assault** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]] (horror’s choice). |
| Vladeska Drakov (CR 12) | **Pike** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Mi-Go (CR 9) | **Pincer** | — | fx1[grappled] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, it has the Reference[Grappled apply=false] condition (escape… |
| Yuan-ti Malison (Type 1) (CR 3) | **Poison Ray (Yuan-ti Form Only)** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Yuan-ti Abomination (CR 7) | **Poison Spray** | half-on-save | fx1[blinded,poisoned] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=Ab1fnEh4JGShDFte]], each [[lookup @target.affects.type activity=Ab1fnEh4JGShDFte]] in a [[lookup… |
| Wilfred Godefroy (CR 6) | **Possessive Aura** | — | fx1[charmed] save |  | Grasping, ghostly servants surround [[lookup @name]] in a [[lookup @target.template.size activity=4b1f737SYU884Kar]]-foot Emanation originating from him. A crea… |
| Strigoi (CR 4) | **Proboscis** | temp-hp | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. The target’s Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the [[lookup @… |
| Shield Guardian (CR 7) | **Protection** | interrupt, reaction | fx1 REACTION | ✓ EFFECT_BENDS.from, LIST:INTERRUPTS | Trigger: An attack roll hits the wearer of the [[lookup @name lowercase]]’s amulet while the wearer is within 5 feet of the [[lookup @name lowercase]]. Response… |
| Strigoi (CR 4) | **Protective Swarm** | clock, concentration | fx1[poisoned] save dmg uses |  | The [[lookup @name lowercase]] summons a swarm of bloodthirsty mosquitoes in a [[lookup @target.template.size activity=5RjKNUuZHTVrB7pV]]-foot Emanation origina… |
| Shoggoth (CR 11) | **Pseudopod** | — | fx1[grappled] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the creature has the Reference[Grappled apply=false] condition (escape DC [[lookup @skills.ath.passive]]… |
| Elder Thing (CR 14) | **Psychic Skewer** | press-condition | fx1[exhaustion,stunned] save dmg |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=yRfvOqUdLa42N6qf]], one creature within [[lookup @range.value activity=yRfvOqUdLa42N6qf]] feet. Failure… |
| Hazlik (CR 14) | **Quarterstaff** | — | atk |  | [[/attack extended]]. [[/damage average extended]] or [[/damage twoHanded average]] damage if used with two hands. |
| Mist Wanderer (CR 3) | **Radiant Burst** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Madam Eva (CR 10) | **Radiant Flame** | — | fx1[blinded] atk |  | Ranged Attack Roll: [[/attack]], range 60 ft. Hit: [[/damage average]] damage, and the target has the Reference[Blinded apply=false] condition until the start o… |
| Gennifer Weathermay-Foxgrove (CR 3) | **Radiant Wisp** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Spy Master (CR 10) | **Rapier** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Swarm of Ravenous Insects (CR 3) | **Ravenous Bites** | — | fx1[poisoned] atk dmg |  | [[/attack extended]]. [[/damage average extended activity=x2xD7FeauoZWVqLq]], or [[/damage average activity=rrtQ9KmfvQ2uaB7C]] damage if the swarm is Bloodied,… |
| Viktra Mordenheim (CR 7) | **Redirect Attack** | reaction | REACTION **TEXT** |  | Trigger : [[lookup @activation.condition activity=lxg8dlyYQKJB6fSe]] Response : Viktra chooses a Small or Medium ally within 5 feet of herself. Viktra and that… |
| Loup Garou (CR 13) | **Rend (Dire Wolf or Hybrid Form Only)** | — | fx1[prone] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, it has the Reference[Prone apply=false] condition. |
| Rudolph van Richten (CR 5) | **Repel Evil** | half-on-save | fx1[frightened] save dmg uses |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=qwLHWdOmT8vkXRFb]], each creature of Rudolph’s choice in a [[lookup @target.template.size activity=qw… |
| Blob of Annihilation (CR 23) | **Restraining Glob** | clock, half-on-save | fx1[restrained] save dmg |  | The [[lookup @name lowercase]] lobs a slimy glob at [[lookup @target.affects.special activity=P1YLDUEKG7baOYir]] it can see within [[lookup @range.value activit… |
| Swarm of Zombie Limbs (CR 1) | **Rotten Flesh** | clock | fx1[poisoned] atk dmg |  | Melee Attack Roll: [[/attack extended]]. [[/damage average extended]], or [[/damage average activity=hggU6JuLvIhlBn3w]] damage if the swarm is Bloodied, and the… |
| Mummy (CR 3) | **Rotting Fist** | temp-hp | fx1[cursed] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a creature, it is cursed. While cursed, the target can’t regain Hit Points, its Hit Point m… |
| Violet Fungus Necrohulk (CR 7) | **Rotting Slam** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Ebonbane (CR 13) | **Runic Flare** | clock | fx1[blinded] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=OqpnK8OYFJvhK4sF]], each creature of [[lookup @name]]’s choice in a [[lookup @target.template.siz… |
| Ankhtepot (CR 17) | **Sands of Time** | half-on-save | save dmg |  | [[lookup @name]] teleports up to [[lookup @range.value activity=30UbPYfflzBb2X68]] feet to an unoccupied space he can see. Charisma Saving Throw : DC [[lookup @… |
| Vampire Umbral Lord (CR 15) | **Sanguine Drain** | temp-hp | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=zw4GduIbxRyUVb1Y]], one [[lookup @target.affects.type activity=zw4GduIbxRyUVb1Y]] the [[lookup @n… |
| Chakuna (CR 11) | **Scratch** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Waxwork (CR 3) | **Sculpting Knife** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Ez d’Avenir (CR 8) | **Shield** | reaction | uses REACTION **TEXT** | ✓ LIST:INTERRUPTS, BLOCKS | [[lookup @name]] casts [[/item .1YoNu2C8bScL8dPQ]]{Shield} in response to that spell’s trigger, using the same spellcasting ability as Spellcasting. |
| Strahd Skeleton (CR 4) | **Shield Bash** | — | fx1[prone] save dmg |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=jYgzdBMWuj79j0Ri]], one creature within [[lookup @range.value activity=jYgzdBMWuj79j0Ri]] feet that t… |
| Wereraven (CR 2) | **Shortbow (Humanoid or Hybrid Form Only)** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Vampire Umbral Lord (CR 15) | **Sickening Ray** | — | fx1[poisoned] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Poisoned apply=false] condition until the start of the [[lookup @name lower… |
| Carrionette (CR 1) | **Silver Needle** | — | fx1[cursed,poisoned] save atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Humanoid not cursed by a [[lookup @name lowercase]], it is subjected to the following eff… |
| Rudolph van Richten (CR 5) | **Silver Sword Cane** | crit | fx1[poisoned] save atk dmg |  | [[/attack extended]]. [[/damage average extended]]. Critical Hit : The target has the Reference[Poisoned apply=false] condition until it finishes a Long Rest. I… |
| Inquisitor of the Mind Fire (CR 8) | **Silvered Longsword** | crit | fx1[frightened] atk dmg |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Frightened apply=false] condition until the start of the inquisitor’s next… |
| Azalin Rex (CR 23) | **Siphon Spell** | reaction | REACTION **TEXT** |  | [[lookup @name]] casts [[/item .hkfRKAG0ncdbq419]]{Counterspell} in response to the spell’s trigger, using the same spellcasting ability as Spellcasting. If the… |
| Relentless Slasher (CR 8) | **Slasher’s Knife** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Spy Master (CR 10) | **Smoke Bomb** | half-on-save | fx1[blinded] save dmg uses |  | The [[lookup @name lowercase]] throws a bomb to a point it can see within [[lookup @range.value activity=nk7wJnUtROO1cY4W]] feet of itself. Constitution Saving… |
| Boneless (CR 1) | **Smother** | — | fx1[grappled,blinded,restrained,suffocation] atk dmg |  | [[/attack extended]]. [[/damage average extended activity=wpJZEQ6QzS18fn9Y]]. If the target is a Medium or smaller creature, it has the Reference[Grappled apply… |
| Elder Thing (CR 14) | **Soothing Tentacle** | — | fx1[charmed] atk |  | [[/attack extended]]. [[/damage average extended]], and the target has the Reference[Charmed apply=false] condition until the start of the [[lookup @name lowerc… |
| Priest of Osybus (CR 6) | **Soul Blade** | — | fx1[paralyzed] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a creature, it has the Reference[Paralyzed apply=false] condition until the start of the pr… |
| Carrionette (CR 1) | **Soul Swap** | — | fx1[unconscious] save uses |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=J40hTKF6wen1pyjM]], one Humanoid the [[lookup @name lowercase]] can see within [[lookup @range.value… |
| Guard (CR 0.125) | **Spear** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Death Cultist (CR 8) | **Spirit Wail** | clock, half-on-save | fx1[frightened] save dmg uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=5JzDfoXBTiCay7OP]], each [[lookup @target.affects.type activity=5JzDfoXBTiCay7OP]] in a [[lookup @targe… |
| Violet Fungus Necrohulk (CR 7) | **Spore Bomb** | half-on-save, temp-hp | fx1[poisoned] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=cmFbJQhqZiLBF9Ij]], each [[lookup @target.affects.type activity=cmFbJQhqZiLBF9Ij]] in a [[lookup… |
| Viktra Mordenheim (CR 7) | **Static Explosion** | half-on-save | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=sSPc1AqhHehoyKDw]], each creature in a [[lookup @target.template.size activity=sSPc1AqhHehoyKDw]]-fo… |
| Intellect Devourer (CR 2) | **Steal Body** | — | fx2[coverTotal] save |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=dKA6FqhkPRD5rLhA]], [[lookup @target.affects.special activity=dKA6FqhkPRD5rLhA]] Failure: The [[l… |
| Kuo-toa (CR 0.25) | **Sticky Net** | half-on-save, resist | fx1[restrained] save uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.formula activity=MxEs7KnCVGemObHx]], one [[lookup @target.affects.special activity=MxEs7KnCVGemObHx]] [[lookup @tar… |
| Kuo-toa (CR 0.25) | **Sticky Shield** | reaction | fx1[grappled] save REACTION | ✓ REBUKES | Trigger: A creature misses the [[lookup @name lowercase]] with a melee attack roll using a weapon. Response—Strength Saving Throw: DC [[lookup @save.dc.value ac… |
| Ivana Boritsi (CR 5) | **Stifling Perfume** | — | fx1[prone] save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=00IVSmDILiTDIMDn]], each creature in a [[lookup @target.template.size activity=00IVSmDILiTDIMDn]]… |
| Carrion Stalker (CR 3) | **Stinger** | — | fx1[poisoned] save atk dmg |  | Melee Attack Roll: [[/attack]] (with Advantage if the [[lookup @name lowercase]] is attached to the target), reach [[lookup @item.range.reach]] ft. Hit : [[/dam… |
| Kuo-toa Archpriest (CR 6) | **Strange Scepter** | — | atk |  | Melee or Ranged Attack Roll: [[/attack]], reach [[lookup @item.range.reach]] ft. or range [[lookup @item.range.value]] ft. [[/damage average extended]]. |
| Shoggoth (CR 11) | **Suction Burst** | clock, press-condition, half-on-save | fx1[stunned,deafened] save dmg uses |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=3IpX2jcPVu1OXaVk]], one creature Grappled by the [[lookup @name lowercase]]. Failure : [[/damage aver… |
| Graveyard Revenant (CR 7) | **Suffocate** | — | fx1[grappled,suffocation] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Grappled apply=false] condition (escape D… |
| Vampire Mind Flayer (CR 5) | **Sunlight Hypersensitivity** | bend-attack | dmg | ✓ EFFECT_BENDS | The [[lookup @name lowercase]] takes [[/damage]] damage if it starts its turn in sunlight. While in sunlight, it has Disadvantage on attack rolls and ability ch… |
| Yithian (CR 15) | **Sup** | temp-hp | save dmg |  | Intelligence Saving Throw: DC [[lookup @save.dc.value activity=47eSQFTRLYTDqN2f]], one creature within [[lookup @range.value activity=47eSQFTRLYTDqN2f]] feet th… |
| Shoggoth (CR 11) | **Susceptible to Charm** | bend-save | **TEXT** |  | The [[lookup @name lowercase]] has Disadvantage on saving throws to avoid or end the Reference[Charmed apply=false] condition. |
| Swarm of Infesting Insects (CR 2) | **Swarm** | temp-hp | **TEXT** |  | The swarm can occupy another creature’s space and vice versa, and it can move through any opening large enough for a Tiny creature. The swarm can’t regain Hit P… |
| Gremishka (CR 2) | **Swarm (Swarm Form Only)** | temp-hp | **TEXT** |  | The swarm can occupy another creature’s space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can’t regai… |
| Gremishka (CR 2) | **Swarming Bites (Swarm Form Only)** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]], or [[/damage average activity=LDdnr5Ljko6AE1Od]] damage if the swarm is Bloodied. If the target is attuned t… |
| Relentless Juggernaut (CR 12) | **Sweeping Blade** | — | save dmg |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=iohssW1KRj8w9i20]], each creature in a [[lookup @target.template.size activity=iohssW1KRj8w9i20]]-fo… |
| Harkon Lukas (CR 14) | **Swipe (Dire Wolf or Hybrid Form Only)** | — | fx1[prone] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, it has the Reference[Prone apply=false] condition. |
| Viktra Mordenheim (CR 7) | **Syringe** | bend-save, concentration, temp-hp | fx4[poisoned] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=C4ddEurqzhAIWqKu]], one creature [[lookup @name]] can see within 5 feet. Failure : The target has… |
| Giant Crocodile (CR 5) | **Tail** | — | fx1[prone] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Prone apply=false] condition. |
| Priest of Osybus (CR 6) | **Tattoo of Osybus** | clock, temp-hp, resist, movement | fx5[frightened] save dmg |  | If damage reduces the priest to 0 Hit Points, it receives a random boon. Roll [[/r 1d6]] to determine the boon the priest receives. The priest revives at the st… |
| Poltergeist (CR 2) | **Telekinetic Thrust** | — | save dmg |  | Strength Saving Throw: DC [[lookup @save.dc.value activity=qHeMp7n2VPHtGbDS]], [[lookup @target.affects.labels.statblock activity=qHeMp7n2VPHtGbDS]] the [[looku… |
| Carrion Stalker (CR 3) | **Tentacle** | — | atk |  | [[/attack extended]]. [[/damage average extended]], and the [[lookup @name lowercase]] attaches to the target. While attached, the [[lookup @name lowercase]] ca… |
| Cthulhu (CR 25) | **Tentacle** | half-on-save, temp-hp | save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=zdzgiHkzshglF4Ez]], one creature Grappled by [[lookup @name]]. Failure : [[/damage average]] dama… |
| Aberrant Cultist (CR 8) | **Tentacle Lash** | — | fx1[grappled,restrained] atk dmg |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Grappled apply=false] condition (escape D… |
| Vampire Mind Flayer (CR 5) | **Tentacles** | — | fx1[grappled] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Medium or smaller creature, it has the Reference[Grappled apply=false] condition (escape… |
| Unspeakable Horror (CR 8) | **Terrifying Aura** | clock, resist | fx1[frightened,paralyzed] save |  | The [[lookup @name lowercase]] radiates an aura in a [[lookup @target.template.size activity=zKEPKR8QqycZyQ8u]]-foot Emanation while it doesn’t have the Incapac… |
| Greater Star Spawn Emissary (CR 21) | **Terrifying Topography** | bend-save | **TEXT** |  | Terrain in the lair is transformed into a mockery of flesh with unsettling features like thick veins, lolling tongues, and pulsating orifices. Creatures of the… |
| Dullahan (CR 10) | **Terrorizer** | bend-attack | **TEXT** |  | The [[lookup @name lowercase]] has Advantage on attack rolls against targets that have the Frightened condition. |
| Gulthias Blight (CR 16) | **Thorn Volley** | — | atk |  | [[/attack extended]]. [[/damage average extended]] |
| Mordenheim’s Monster (CR 12) | **Throw** | half-on-save | fx1[prone] save dmg |  | The monster throws a creature Grappled by it to a space it can see within [[lookup @range.value activity=8mJtuo47eKJlebtT]] feet of itself that isn’t in the air… |
| Nightgaunt (CR 8) | **Tickle** | — | fx1[incapacitated] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=skCulJDQgf2iKy7e]], one creature Grappled by the [[lookup @name lowercase]]. Failure : The target has t… |
| Ankhtepot (CR 17) | **Touch of Death** | — | fx1[dead] dmg uses |  | [[lookup @name]] touches one creature within 5 feet. If the creature has 80 Hit Points or fewer, it dies. Otherwise, it takes 52 ([[/r 8d12]]) Necrotic damage. |
| Ivana Boritsi (CR 5) | **Toxic Touch** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. A Humanoid reduced to 0 Hit Points by this damage rises 24 hours later as a @UUID[Compendium.dnd-monster-man… |
| Ivana Boritsi (CR 5) | **Toxin Wave** | clock | fx1[poisoned] save |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=2xJ3Rh7FVLTXDYXY]], each creature in a [[lookup @target.template.size activity=2xJ3Rh7FVLTXDYXY]]-fo… |
| Bodytaker Plant (CR 7) | **Transfer Harm** | interrupt, reaction | REACTION **TEXT** |  | Trigger : [[lookup @activation.condition activity=MYpxFvLvGJwnLPfa]] Response : The plant halves the damage it takes from that attack, and the podling takes the… |
| Ivan Dilisnya (CR 5) | **Trapped Ground** | clock | fx1 save dmg |  | [[lookup @name]] spreads special caltrops to cover a [[lookup @target.template.size activity=RwkRTXEAqjEYniQc]]-foot-square area within [[lookup @range.value ac… |
| Sahuagin Baron (CR 5) | **Trident** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Zombie Plague Spreader (CR 4) | **Undead Fortitude** | crit | **TEXT** | ✓ DROP_TO_ONE | If damage reduces the [[lookup @name lowercase]] to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant… |
| Greater Star Spawn Emissary (CR 21) | **Unearthly Bile** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=fFSjrvyM6QziuVER]], each creature in a [[lookup @target.template.size activity=fFSjrvyM6QziuVER]]-fo… |
| Boneless (CR 1) | **Unraveling Flesh** | movement | fx1[frightened] save uses |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=zleWl71nRQb6jsLB]], each creature within [[lookup @target.template.size activity=zleWl71nRQb6jsLB]] fee… |
| Strahd von Zarovich (CR 15) | **Vampire Weakness** | bend-attack, press-condition | fx2[paralyzed] dmg | ✓ EFFECT_BENDS.from | [[lookup @name]] has these weaknesses: Forbiddance. [[lookup @name]] can’t enter a residence without an invitation from an occupant. Running Water. [[lookup @na… |
| Strahd Skeleton (CR 4) | **Vampiric Longsword** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. The target’s Hit Point maximum decreases by an amount equal to the Necrotic damage taken. |
| Relentless Slasher (CR 8) | **Vanishing Strike** | clock | **TEXT** |  | The [[lookup @name lowercase]] makes one [[/item Slasher’s Knife]] attack, then teleports up to 30 feet to an unoccupied space it can see. The [[lookup @name lo… |
| Ramya Vasavadan (CR 15) | **Vengeful Fire** | half-on-save | save dmg uses |  | Dexterity Saving Throw: DC [[lookup @save.dc.value activity=FV3DII9i9tRa43r4]], each creature in a [[lookup @target.template.size activity=FV3DII9i9tRa43r4]]-fo… |
| Revenant (CR 5) | **Vengeful Glare** | — | fx2[frightened,paralyzed] save |  | Wisdom Saving Throw: DC [[lookup @save.dc.value activity=r2U9soI3vKTrXhG1]], one [[lookup @target.affects.type activity=r2U9soI3vKTrXhG1]] the [[lookup @name lo… |
| Bodytaker Plant (CR 7) | **Vine** | — | fx1[grappled] atk |  | [[/attack extended]]. [[/damage average extended]]. If the target is a Large or smaller creature, it has the Reference[Grappled apply=false] condition (escape D… |
| Mordenheim’s Monster (CR 12) | **Violent Leap** | — | fx1[prone] save dmg |  | The monster spends 10 feet of movement to jump to a space within [[lookup @range.value activity=psGtgMiQRb04VSAx]] feet that contains one or more Medium or smal… |
| Zombie Plague Spreader (CR 4) | **Viral Aura** | clock, temp-hp, resist | fx1[poisoned] save |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=VPbih8oXKlW8xvgN]], any creature that starts its turn in a [[lookup @target.template.size activit… |
| Zombie Plague Spreader (CR 4) | **Virulent Miasma** | half-on-save | save dmg uses |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=bhz1Ngsim65HlHLB]], each creature in a [[lookup @target.template.size activity=bhz1Ngsim65HlHLB]]… |
| Invisible Stalker (CR 6) | **Vortex** | — | fx1[grappled] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=cZy0VYbCVY8aRB4z]], one [[lookup @target.affects.special activity=cZy0VYbCVY8aRB4z]] in the [[loo… |
| Performer Legend (CR 10) | **Warding Charm** | interrupt, reaction, half-on-save | fx1[charmed] save REACTION | ✓ REBUKES | Trigger: A creature hits the [[lookup @name lowercase]] with an attack roll. Response—Wisdom Saving Throw: DC [[lookup @save.dc.value activity=zTaurVqDcUSvviyB]… |
| Cthulhu (CR 25) | **Warp** | half-on-save | fx1[prone] save dmg |  | [[lookup @name]] teleports to an unoccupied space it can see within [[lookup @range.value activity=To4WianQcO4caCR2]] feet, taking creatures it is grappling wit… |
| Lesser Star Spawn Emissary (CR 19) | **Warp Body** | clock | fx1[stunned] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=ARzgcFYvTr9SMDMd]], one creature the emissary can see within [[lookup @range.value activity=ARzgc… |
| Unspeakable Horror (CR 8) | **Warp Mind** | clock, reaction | fx1[stunned] save dmg REACTION |  | Trigger : [[lookup @activation.condition activity=iu033YzXEedT9UJZ]] Response—Wisdom Saving Throw : DC [[lookup @save.dc.value activity=iu033YzXEedT9UJZ]], the… |
| Waxwork (CR 3) | **Wax Lob** | clock | fx1 atk |  | [[/attack extended]]. [[/damage average extended]], and the target’s Speed decreases by 10 feet until the end of its next turn. |
| Gallows Speaker (CR 6) | **Whirling Blades** | — | atk dmg |  | [[/attack extended]]. [[/damage average extended]]. |
| Hazlik (CR 14) | **Wild Magic Surge** | clock, d20-fold | fx2[blinded] save dmg |  | [[lookup @name]] manifests one of the following magic surges, targeting a creature he can see within [[lookup @range.value activity=RTjZFeAjJG1SuTb2]] feet. Whi… |
| Invisible Stalker (CR 6) | **Wind Swipe** | — | atk |  | [[/attack extended]]. [[/damage average extended]]. |
| Ramya Vasavadan (CR 15) | **Words of Silence** | clock, half-on-save | fx1[cursed] save dmg |  | Constitution Saving Throw: DC [[lookup @save.dc.value activity=GDDlK59CIDEu831e]], one creature Ramya can see within [[lookup @range.value activity=GDDlK59CIDEu… |
| Ebonbane (CR 13) | **Worthy Wielder** | — | save dmg |  | Charisma Saving Throw: DC [[lookup @save.dc.value activity=G1OJe5gZymktuamA]], one willing Humanoid within [[lookup @range.value activity=G1OJe5gZymktuamA]] fee… |

### The rest (110)

Abduct · Aberrant Restoration · Activate Constructs · Advance · Air Form · Amphibious · Antimagic Cone · Arcane Strike · Ascend · Astral Implosion · Blight Seeds · Bloated · Bound · Brand · Charge · Charm · Chomp · Clamp · Commanding Magic · Compression · Confer Fire Resistance · Count’s Command · Create Specter · Cunning Action · Darklord Restoration · Death Strike · Detect Intelligence · Detect Life · Divine Aid · Dread Authority · Dreamwalk · Earth Glide · Eldritch Magic · Eldritch Teleport · Elemental Restoration · Ethereal Stride · Evil Eye · Experienced Hunter · Ferocity · Fiendish Guile · Glare · Hold Breath · Hunger of Hadar · Hungering Stride · Illumination · Immutable Form · Invisibility · Lash Out · Lashing Goop · Lie Detector · Limited Amphibiousness · Lunge · Mauling Charge · Metabolic Control · Mimicry · Mist Walker · Misty Escape · Nightmarish Restoration · Occult Aid · One With the Mists · Overhanging Branches · Overwhelming Presence · Podling Link · Possess Dead · Pounce · Punish · Reactive Heads · Reborn By Blood · Regeneration · Rejuvenation · Retaliate · Semblance of Life · Shadow Escape · Shadow Veil · Shape-Shift · Shark Telepathy · Shield of Erasmus · Shield of Faith · Shielded Mind · Shocking Prod · Silver Canister · Skeletonize · Slam · Soth’s Command · Soul Tattoo · Soul Tome · Spell Storing · Spellcasting (Yuan-ti Form Only) · Spider Climb · Spiritual Weapon · Stirge Telepathy · Strange Modifications · Striding Strike · Strike from Shadows · Sudden Bite · Suppressed Lycanthropy · Surprise Bite · Tactical Charge · Telepathic Bond · Teleporting Lash · Tree Stride · Truth Or Die · Twist · Umbral Strike · Undead Restoration · Unholy Regrowth · Vanish · Vow of Revenge · Whirling Form · Wishes
