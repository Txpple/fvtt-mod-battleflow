# Barbarian

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

34 rows · 24 with a family · 4 of those text-only · 4 named in the registry

Families: movement 7 · clock 6 · aura 6 · resist 4 · bend-attack 4 · rider-damage 3 · half-on-save 3 · reaction 3 · bend-save 2 · use-chip 2 · press-condition 2 · temp-hp 2 · concentration 1 · ac-passive 1 · interrupt 1 · d20-fold 1

## Barbarian (16)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Rage** | clock, concentration, resist | fx1 uses |  | You can imbue yourself with a primal power called Rage, a force that grants you extraordinary might and resili… |
| 1 | **Unarmored Defense** | ac-passive | fx1 |  | While you aren’t wearing any armor, your base Armor Class equals 10 plus your Dexterity and Constitution modif… |
| 1 | **Weapon Mastery** | — | **TEXT** |  | Your training with weapons allows you to use the mastery properties of two kinds of Simple or Martial Melee we… |
| 2 | **Danger Sense** | bend-save | fx1 |  | You gain an uncanny sense of when things aren’t as they should be, giving you an edge when you dodge perils. Y… |
| 2 | **Reckless Attack** | bend-attack, clock | fx1 | ✓ EFFECT_BENDS.from | You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack… |
| 3 | **Primal Knowledge** | — | fx1 |  | You gain proficiency in another skill of your choice from the skill list available to Barbarians at level 1. I… |
| 5 | **Fast Movement** | movement | fx1 |  | Your speed increases by 10 feet while you aren't wearing Heavy armor. Foundry Note This feature includes an Ac… |
| 7 | **Feral Instinct** | — | fx1 |  | Your instincts are so honed that you have Advantage on Initiative rolls. |
| 7 | **Instinctive Pounce** | movement | **TEXT** |  | As part of the Bonus Action you take to enter your Rage, you can move up to half your Speed. |
| 9 | **Brutal Strike** | clock, movement | fx1 dmg |  | If you use [[/item Reckless Attack]], you can forgo any Advantage on one Strength-based attack roll of your ch… |
| 11 | **Relentless Rage** | half-on-save | save uses |  | Your Rage can keep you fighting despite grievous wounds. If you drop to 0 Hit Points while your Rage is active… |
| 13 | **Improved Brutal Strike** | bend-save, clock, use-chip, movement | fx2 |  | You have honed new ways to attack furiously. The following effects are now among your Brutal Strike options. S… |
| 15 | **Persistent Rage** | — | uses **TEXT** |  | When you roll Initiative, you can regain all expended uses of Rage. After you regain uses of Rage in this way,… |
| 17 | **Improved Brutal Strike (2)** | rider-damage | **TEXT** |  | The extra damage of your Brutal Strike increases to 2d10. In addition, you can use two different Brutal Strike… |
| 18 | **Indomitable Might** | — | **TEXT** |  | If your total for a Strength check or Strength saving throw is less than your Strength score, you can use that… |
| 20 | **Primal Champion** | — | **TEXT** |  | You embody primal power. Your Strength and Constitution scores increase by 4, to a maximum of 25. |

## Path of the Berserker (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Frenzy** | rider-damage | dmg |  | If you use Reckless Attack while your Rage is active, you deal extra damage to the first target you hit on you… |
| 6 | **Mindless Rage** | resist | fx1 |  | You have Immunity to the Reference[Charmed] and Reference[Frightened] conditions while your Rage is active. If… |
| 10 | **Retaliation** | reaction, aura | **TEXT** | ✓ REBUKES | When you take damage from a creature that is within 5 feet of you, you can take a Reaction to make one melee a… |
| 14 | **Intimidating Presence** | press-condition, half-on-save | fx1[frightened] save uses |  | As a Bonus Action, you can strike terror into others with your menacing presence and primal power. When you do… |

## Path of the Wild Heart (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Animal Speaker** | — | **TEXT** |  | You can cast the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplBeastSense]{Beast Sense} and @UUID[Co… |
| 3 | **Rage of the Wilds** | bend-attack, aura, resist | fx2 |  | Your Rage taps into the primal power of animals. Whenever you activate your Rage, you gain one of the followin… |
| 6 | **Aspect of the Wilds** | movement | fx3 |  | You gain one of the following options of your choice. Whenever you finish a Long Rest, you can change your cho… |
| 10 | **Nature Speaker** | — | **TEXT** |  | You can cast the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCommunewit]{Commune with Nature} spel… |
| 14 | **Power of the Wilds** | bend-attack, aura, movement | fx1[prone] |  | Whenever you activate your Rage, you gain one of the following options of your choice. Falcon. While your Rage… |

## Path of the World Tree (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Vitality of the Tree** | temp-hp |  |  | Your Rage taps into the life force of the World Tree. You gain the following benefits. Vitality Surge. When yo… |
| 6 | **Branches of the Tree** | clock, interrupt, reaction, use-chip, press-condition, half-on-save, aura | fx1 save |  | Whenever a creature you can see starts its turn within 30 feet of you while your Rage is active, you can take… |
| 10 | **Battering Roots** | — | fx1 |  | During your turn, your reach is 10 feet greater with any Melee weapon that has the Heavy or Versatile property… |
| 14 | **Travel Along the Tree** | — | **TEXT** |  | When you activate your Rage and as a Bonus Action while your Rage is active, you can teleport up to 60 feet to… |

## Path of the Zealot (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Divine Fury** | rider-damage | dmg | ✓ CLOCK_RIDERS | You can channel divine power into your strikes. On each of your turns while your Rage is active, the first cre… |
| 3 | **Warrior of the Gods** | temp-hp | uses |  | A divine entity helps ensure you can continue the fight. You have a pool of four d12s that you can spend to he… |
| 6 | **Fanatical Focus** | d20-fold | **TEXT** |  | Once per active Rage, if you fail a saving throw, you can reroll it with a bonus equal to your Rage Damage bon… |
| 10 | **Zealous Presence** | bend-attack, clock, aura | fx1 uses | ✓ EFFECT_BENDS | As a Bonus Action, you unleash a battle cry infused with divine energy. Up to ten other creatures of your choi… |
| 14 | **Rage of the Gods** | reaction, aura, resist, movement | fx1 |  | When you activate your Rage, you can assume the form of a divine warrior. This form lasts for 1 minute or unti… |
