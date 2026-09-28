# Ranger

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

30 rows · 16 with a family · 4 of those text-only · 4 named in the registry

Families: clock 7 · rider-damage 5 · movement 3 · reaction 3 · concentration 2 · press-condition 2 · half-on-save 2 · bend-attack 1 · use-chip 1 · resist 1 · temp-hp 1 · bend-save 1 · aura 1

## Ranger (9)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Favored Enemy** | — | uses **TEXT** |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplHuntersMar]{Hunter’s Mark} spell p… |
| 2 | **Deft Explorer** | — | **TEXT** |  | Thanks to your travels, you gain the following benefits. Expertise. Choose one of your skill proficiencies wit… |
| 6 | **Roving** | movement | fx1 |  | Your Speed increases by 10 feet while you aren’t wearing Heavy armor. You also have a Climb Speed and a Swim S… |
| 10 | **Tireless** | temp-hp | uses |  | Primal forces now help fuel you on your journeys, granting you the following benefits. Temporary Hit Points. A… |
| 13 | **Relentless Hunter** | concentration | **TEXT** |  | Taking damage can’t break your Concentration on Hunter’s Mark. |
| 14 | **Nature's Veil** | clock | fx1[invisible] uses |  | You invoke spirits of nature to magically hide yourself. As a Bonus Action, you can give yourself the Invisibl… |
| 17 | **Precise Hunter** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | You have Advantage on attack rolls against the creature currently marked by your Hunter’s Mark. |
| 18 | **Feral Senses** | — | fx1 |  | Your connection to the forces of nature grants you Blindsight with a range of 30 feet. Foundry Note This featu… |
| 20 | **Foe Slayer** | — | dmg |  | @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplHuntersMar]{Hunter’s Mark} is a d10 rather than a d6.… |

## Beast Master (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Primal Companion** | — |  |  | You magically summon a primal beast, which draws strength from your bond with nature. Choose its stat block: @… |
| 7 | **Exceptional Training** | — | fx1 |  | When you take a Bonus Action to command your Primal Companion beast to take an action, you can also command it… |
| 11 | **Bestial Fury** | rider-damage | dmg |  | When you command your Primal Companion beast to take the Beast’s Strike action, the beast can use it twice. In… |
| 15 | **Share Spells** | — | **TEXT** |  | When you cast a spell targeting yourself, you can also affect your Primal Companion beast with the spell if th… |

## Fey Wanderer (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Dreadful Strikes** | rider-damage, clock | dmg | ✓ CLOCK_RIDERS | You can augment your weapon strikes with mind-scarring magic drawn from the murky hollows of the Feywild. When… |
| 3 | **Fey Wanderer Spells** | — | **TEXT** |  | When you reach a Ranger level specified in the Fey Wanderer Spells table, you thereafter always have the liste… |
| 3 | **Otherworldly Glamour** | — | fx1 |  | Whenever you make a Charisma check, you gain a bonus to the check equal to your Wisdom modifier (minimum of +1… |
| 7 | **Beguiling Twist** | bend-save, reaction, press-condition, half-on-save, aura | save |  | The magic of the Feywild guards your mind. You have Advantage on saving throws to avoid or end the Charmed or… |
| 11 | **Fey Reinforcements** | concentration | uses **TEXT** |  | You can cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplSummonFey0]{Summon Fey} without a Materia… |
| 15 | **Misty Wanderer** | — | uses **TEXT** |  | You can cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplMistyStep0]{Misty Step} without expending… |

## Gloom Stalker (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Dread Ambusher** | rider-damage, clock, movement | fx2 dmg uses | ✓ CLOCK_RIDERS | You have mastered the art of creating fearsome ambushes, granting you the following benefits. Ambusher’s Leap.… |
| 3 | **Gloom Stalker Spells** | — | **TEXT** |  | When you reach a Ranger level specified in the Gloom Stalker Spells table, you thereafter always have the list… |
| 3 | **Umbral Sight** | — | fx1 |  | You gain Darkvision with a range of 60 feet. If you already have Darkvision when you gain this feature, its ra… |
| 7 | **Iron Mind** | — | **TEXT** |  | You have honed your ability to resist mind-altering powers. You gain proficiency in Wisdom saving throws. If y… |
| 11 | **Stalker's Flurry** | clock, press-condition, half-on-save | save |  | The Psychic damage of your Dreadful Strike becomes 2d8. In addition, when you use the Dreadful Strike effect o… |
| 15 | **Shadowy Dodge** | reaction | **TEXT** | ✓ LIST:INTERRUPTS | When a creature makes an attack roll against you, you can take a Reaction to impose Disadvantage on that roll.… |

## Hunter (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Hunter's Lore** | — | **TEXT** |  | You can call on the forces of nature to reveal certain strengths and weaknesses of your prey. While a creature… |
| 3 | **Hunter's Prey** | rider-damage, clock | dmg |  | You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you ca… |
| 7 | **Defensive Tactics** | movement | fx1 |  | You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you ca… |
| 11 | **Superior Hunter's Prey** | rider-damage, clock | dmg |  | Once per turn when you deal damage to a creature marked by your Hunter’s Mark , you can also deal that spell’s… |
| 15 | **Superior Hunter's Defense** | clock, reaction, use-chip, resist | fx13 |  | When you take damage, you can take a Reaction to give yourself Resistance to that damage and any other damage… |
