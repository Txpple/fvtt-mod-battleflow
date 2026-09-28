# Monk

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

36 rows · 22 with a family · 4 of those text-only · 2 named in the registry

Families: clock 7 · press-condition 6 · half-on-save 6 · movement 6 · interrupt 3 · reaction 3 · use-chip 3 · temp-hp 3 · resist 2 · d20-fold 1 · rider-damage 1

## Monk (17)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Martial Arts** | — | fx1 |  | Your practice of martial arts gives you mastery of combat styles that use your Unarmed Strike and Monk weapons… |
| 2 | **Monk's Focus** | — | fx2[dodging] uses |  | Your focus and martial training allow you to harness a well of extraordinary energy within yourself. This ener… |
| 2 | **Unarmored Movement** | movement | fx1 |  | Your speed increases by 10 feet while you aren't wearing armor or wielding a Shield. This bonus increases when… |
| 2 | **Uncanny Metabolism** | temp-hp | uses |  | When you roll Initiative, you can regain all expended Focus Points. When you do so, roll your Martial Arts die… |
| 3 | **Deflect Attacks** | interrupt, reaction, press-condition | save dmg | ✓ LIST:INTERRUPTS | When an attack roll hits you and its damage includes Bludgeoning, Piercing, or Slashing damage, you can take a… |
| 4 | **Slow Fall** | interrupt, reaction |  |  | You can take a Reaction when you fall to reduce any damage you take from the fall by an amount equal to five t… |
| 5 | **Stunning Strike** | clock, use-chip, press-condition, half-on-save | fx2[stunned] save |  | Once per turn when you hit a creature with a Monk weapon or an Unarmed Strike, you can expend 1 Focus Point to… |
| 6 | **Empowered Strikes** | — | atk dmg |  | Whenever you deal damage with your Unarmed Strike, it can deal your choice of Force damage or its normal damag… |
| 7 | **Evasion** | half-on-save | **TEXT** | ✓ EVASION | When you're subjected to an effect that allows you to make a Dexterity saving throw to take only half damage,… |
| 9 | **Acrobatic Movement** | — | **TEXT** |  | While you aren't wearing armor or wielding a Shield, you gain the ability to move along vertical surfaces and… |
| 10 | **Heightened Focus** | clock, use-chip, temp-hp, movement |  |  | Your Flurry of Blows, Patient Defense, and Step of the Wind gain the following benefits. Flurry of Blows. You… |
| 10 | **Self-Restoration** | — | **TEXT** |  | Through sheer force of will, you can remove one of the following conditions from yourself at the end of each o… |
| 13 | **Deflect Energy** | interrupt, reaction | save dmg |  | You can now use your Deflect Attacks feature against attacks that deal any damage type, not just Bludgeoning,… |
| 14 | **Disciplined Survivor** | d20-fold | fx1 |  | Your physical and mental discipline grant you proficiency in all saving throws. Additionally, whenever you mak… |
| 15 | **Perfect Focus** | — | **TEXT** |  | When you roll Initiative and don't use Uncanny Metabolism, you regain expended Focus Points until you have 4 i… |
| 18 | **Superior Defense** | resist | fx1 |  | At the start of your turn, you can expend 3 Focus Points to bolster yourself against harm for 1 minute or unti… |
| 20 | **Body and Mind** | — | **TEXT** |  | You have developed your body and mind to new heights. Your Dexterity and Wisdom scores increase by 4, to a max… |

## Warrior of Mercy (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Hand of Harm** | clock | dmg |  | Once per turn when you hit a creature with an Unarmed Strike and deal damage, you can expend 1 Focus Point to… |
| 3 | **Hand of Healing** | — |  |  | As a Magic action, you can expend 1 Focus Point to touch a creature and restore a number of Hit Points equal t… |
| 3 | **Implements of Mercy** | — | **TEXT** |  | You gain proficiency in the Insight and Medicine skills and proficiency with the Herbalism Kit. Foundry Note T… |
| 6 | **Physician's Touch** | clock | fx1[poisoned] dmg |  | Your Hand of Harm and Hand of Healing improve, as detailed below. Hand of Harm. When you use Hand of Harm on a… |
| 11 | **Flurry of Healing and Harm** | clock | uses **TEXT** |  | When you use Flurry of Blows, you can replace each of the Unarmed Strikes with a use of Hand of Healing withou… |
| 17 | **Hand of Ultimate Mercy** | — | uses |  | Your mastery of life energy opens the door to the ultimate mercy. As a Magic action, you can touch the corpse… |

## Warrior of Shadow (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Shadow Arts** | — | fx1 |  | You have learned to draw on the power of the Shadow­fell, gaining the following benefits. Darkness. You can ex… |
| 6 | **Shadow Step** | use-chip | **TEXT** |  | While entirely within Dim Light or Darkness, you can use a Bonus Action to teleport up to 60 feet to an unoccu… |
| 11 | **Improved Shadow Step** | — | **TEXT** |  | You can draw on your Shadowfell connection to empower your teleportation. When you use your Shadow Step, you c… |
| 17 | **Cloak of Shadows** | movement | fx1[invisible] |  | As a Magic action while entirely within Dim Light or Darkness, you can expend 3 Focus Points to shroud yoursel… |

## Warrior of the Elements (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Elemental Attunement** | press-condition, half-on-save | fx3 save atk dmg |  | At the start of your turn, you can expend 1 Focus Point to imbue yourself with elemental energy. The energy la… |
| 3 | **Manipulate Elements** | — | **TEXT** |  | You know the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplElementali]{Elementalism} spell. Wisdom i… |
| 6 | **Elemental Burst** | press-condition, half-on-save | save dmg |  | As a Magic action, you can expend 2 Focus Points to cause elemental energy to burst in a 20-foot-radius Sphere… |
| 11 | **Stride of the Elements** | movement | **TEXT** |  | While your Elemental Attunement is active, you also have a Fly Speed and a Swim Speed equal to your Speed. Fou… |
| 17 | **Elemental Epitome** | rider-damage, clock, resist, movement | fx6 dmg |  | While your Elemental Attunement is active, you also gain the following benefits. Damage Resistance. You gain R… |

## Warrior of the Open Hand (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Open Hand Technique** | clock, press-condition, half-on-save, movement | fx2[prone] save |  | Whenever you hit a creature with an attack granted by your Flurry of Blows, you can impose one of the followin… |
| 6 | **Wholeness of Body** | temp-hp | uses |  | You gain the ability to heal yourself. As a Bonus Action, you can roll your Martial Arts die. You regain a num… |
| 11 | **Fleet Step** | — | **TEXT** |  | When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind immediately after… |
| 17 | **Quivering Palm** | press-condition, half-on-save | fx1 save dmg |  | You gain the ability to set up lethal vibrations in someone's body. When you hit a creature with an Unarmed St… |
