# Rogue

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

30 rows · 15 with a family · 6 of those text-only · 9 named in the registry

Families: clock 6 · press-condition 5 · movement 5 · half-on-save 4 · bend-attack 3 · rider-damage 2 · interrupt 2 · reaction 2 · use-chip 1 · resist 1 · bend-save 1

## Rogue (12)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Sneak Attack** | bend-attack, rider-damage, clock | dmg uses | ✓ SNEAK_ATTACK | You know how to strike subtly and exploit a foe’s distraction. Once per turn, you can deal an extra 1d6 damage… |
| 1 | **Thieves' Cant** | — | **TEXT** |  | You picked up various languages in the communities where you plied your roguish talents. You know Thieves’ Can… |
| 2 | **Cunning Action** | — | fx1[hiding] |  | Your quick thinking and agility allow you to move and act quickly. On your turn, you can take one of the follo… |
| 3 | **Steady Aim** | bend-attack, clock, use-chip, movement | **TEXT** | ✓ EFFECT_BENDS, USE_CHIPS | As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this… |
| 5 | **Cunning Strike** | press-condition, half-on-save, movement | fx2[poisoned,prone] save dmg | ✓ CUNNING_OPTIONS | You’ve developed cunning ways to use your Sneak Attack. When you deal Sneak Attack damage, you can add one of… |
| 5 | **Uncanny Dodge** | interrupt, reaction | **TEXT** | ✓ LIST:INTERRUPTS | When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s… |
| 7 | **Reliable Talent** | — | fx1 |  | Whenever you make an ability check that uses one of your skill or tool proficiencies, you can treat a d20 roll… |
| 11 | **Improved Cunning Strike** | — | **TEXT** |  | You can use up to two Cunning Strike effects when you deal Sneak Attack damage, paying the die cost for each e… |
| 14 | **Devious Strikes** | clock, press-condition, half-on-save | fx3[unconscious,blinded] save | ✓ CUNNING_OPTIONS | You’ve practiced new ways to use your Sneak Attack deviously. The following effects are now among your Cunning… |
| 15 | **Slippery Mind** | — | **TEXT** |  | Your cunning mind is exceptionally difficult to control. You gain proficiency in Wisdom and Charisma saving th… |
| 18 | **Elusive** | — | **TEXT** |  | You’re so evasive that attackers rarely gain the upper hand against you. No attack roll can have Advantage aga… |
| 20 | **Stroke of Luck** | — | uses **TEXT** |  | You have a marvelous knack for succeeding when you need to. If you fail a D20 Test, you can turn the roll into… |

## Arcane Trickster (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Mage Hand Legerdemain** | — | **TEXT** |  | When you cast Mage Hand , you can cast it as a Bonus Action, and you can make the spectral hand Invisible. You… |
| 9 | **Magical Ambush** | bend-save | **TEXT** |  | If you have the Reference[Invisible] condition when you cast a spell on a creature, it has Disadvantage on any… |
| 13 | **Versatile Trickster** | — | **TEXT** |  | You gain the ability to distract targets with your Mage Hand . When you use the [[/item Cunning Strike activit… |
| 17 | **Spell Thief** | interrupt, reaction, press-condition, half-on-save | fx1 save uses |  | You gain the ability to magically steal the knowledge of how to cast a spell from another spellcaster. Immedia… |

## Assassin (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Assassin's Tools** | — | **TEXT** |  | You gain a Disguise Kit and a Poisoner’s Kit, and you have proficiency with them. Foundry Note The equipment a… |
| 3 | **Assassinate** | bend-attack, rider-damage, clock | fx1 dmg | ✓ EFFECT_BENDS, CLOCK_RIDERS | You’re adept at ambushing a target, granting you the following benefits. Initiative. You have Advantage on Ini… |
| 9 | **Infiltration Expertise** | movement | **TEXT** |  | You are expert at the following techniques that aid your infiltrations. Masterful Mimicry. You can unerringly… |
| 13 | **Envenom Weapons** | resist | save dmg |  | When you use the [[/item Cunning Strike activity="Poison"]]{Poison} option of your Cunning Strike, the target… |
| 17 | **Death Strike** | clock, press-condition | save dmg | ✓ DEATH_STRIKE | When you hit with your Sneak Attack on the first round of a combat, the target must succeed on a Constitution… |

## Soulknife (4)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Psychic Blades** | movement | **TEXT** |  | You can manifest shimmering blades of psychic energy. Whenever you take the Attack action or make an Opportuni… |
| 9 | **Soul Blades** | — | **TEXT** |  | You can now use the following powers with your Psychic Blades. Homing Strikes. If you make an attack roll with… |
| 13 | **Psychic Veil** | — | fx1[invisible] uses |  | You can weave a veil of psychic static to mask yourself. As a Magic action, you gain the Reference[Invisible]… |
| 17 | **Rend Mind** | press-condition, half-on-save | fx1[stunned] save uses | ✓ CUNNING_OPTIONS | You can sweep your Psychic Blades through a creature’s mind. When you use your Psychic Blades to deal Sneak At… |

## Thief (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Fast Hands** | — | **TEXT** |  | As a Bonus Action, you can do one of the following. Sleight of Hand. Make a Dexterity (Sleight of Hand) check… |
| 3 | **Second-Story Work** | movement | fx1 |  | You’ve trained to get into especially hard-to-reach places, granting you these benefits. Climber. You gain a C… |
| 9 | **Supreme Sneak** | — | **TEXT** | ✓ CUNNING_OPTIONS | You gain the following Cunning Strike option. Stealth Attack (Cost: 1d6). If you have the Reference[Hide] acti… |
| 13 | **Use Magic Device** | — | fx1 |  | You’ve learned how to maximize use of magic items, granting you the following benefits. Attunement. You can at… |
| 17 | **Thief's Reflexes** | clock | **TEXT** |  | You are adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of… |
