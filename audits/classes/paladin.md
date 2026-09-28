# Paladin

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

30 rows · 19 with a family · 2 of those text-only · 5 named in the registry

Families: press-condition 3 · half-on-save 3 · resist 3 · clock 3 · temp-hp 3 · reaction 3 · bend-save 2 · d20-fold 2 · movement 2 · rider-damage 1 · interrupt 1 · aura 1 · use-chip 1 · bend-attack 1

## Paladin (9)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Lay on Hands** | — | uses |  | Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you finish a Long R… |
| 2 | **Paladin's Smite** | — | **TEXT** |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDivineSmit]{Divine Smite} spell pr… |
| 5 | **Faithful Steed** | — | **TEXT** |  | You can call on the aid of an otherworldly steed. You always have the @UUID[Compendium.dnd-players-handbook.sp… |
| 6 | **Aura of Protection** | d20-fold | fx1 | ✓ EMANATIONS | You radiate a protective, unseeable aura in a 10-foot Emanation that originates from you. The aura is inactive… |
| 9 | **Abjure Foes** | press-condition, half-on-save | fx1[frightened] save |  | As a Magic action, you can expend one use of this class’s Channel Divinity to overwhelm foes with awe. As you… |
| 10 | **Aura of Courage** | resist | fx1 | ✓ EMANATIONS | You and your allies have Immunity to the Frightened condition while in your Aura of Protection. If a Frightene… |
| 11 | **Radiant Strikes** | rider-damage | fx1 |  | Your strikes now carry supernatural power. When you hit a target with an attack roll using a Melee weapon or a… |
| 14 | **Restoring Touch** | — | **TEXT** |  | When you use Lay On Hands on a creature, you can also remove one or more of the following conditions from the… |
| 18 | **Aura Expansion** | — | **TEXT** |  | Your Aura of Protection is now a 30-foot Emanation. Foundry Note The range of your auras update automatically… |

## Oath of Devotion (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Oath of Devotion Spells** | — | **TEXT** |  | The magic of your oath ensures you always have certain spells ready; when you reach a Paladin level specified… |
| 3 | **Sacred Weapon** | — | fx1 |  | When you take the Attack action, you can expend one use of your Channel Divinity to imbue one Melee weapon tha… |
| 7 | **Aura of Devotion** | resist | fx1 |  | You and your allies have Immunity to the Charmed condition while in your Aura of Protection. If a Charmed ally… |
| 15 | **Smite of Protection** | clock | fx1[coverHalf] |  | Your magical smite now radiates protective energy. Whenever you cast @UUID[Compendium.dnd-players-handbook.spe… |
| 20 | **Holy Nimbus** | bend-save | fx1 dmg uses |  | As a Bonus Action, you can imbue your Aura of Protection with holy power, granting the benefits below for 10 m… |

## Oath of Glory (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Inspiring Smite** | temp-hp |  |  | Immediately after you cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplDivineSmit]{Divine Smite},… |
| 3 | **Oath of Glory Spells** | — | **TEXT** |  | The magic of your oath ensures you always have certain spells ready; when you reach a Paladin level specified… |
| 3 | **Peerless Athlete** | — | fx1 |  | As a Bonus Action, you can expend one use of your Channel Divinity to augment your athleticism. For 1 hour, yo… |
| 7 | **Aura of Alacrity** | movement | fx1 |  | Your Speed increases by 10 feet. In addition, whenever an ally enters your Aura of Protection for the first ti… |
| 15 | **Glorious Defense** | interrupt, reaction, aura | uses **TEXT** | ✓ LIST:INTERRUPTS | You can turn defense into a sudden strike. When you or another creature you can see within 10 feet of you is h… |
| 20 | **Living Legend** | clock, reaction, d20-fold | fx1 uses |  | You can empower yourself with the legends—whether true or exaggerated—of your great deeds. As a Bonus Action,… |

## Oath of Vengeance (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Oath of Vengeance Spells** | — | **TEXT** |  | The magic of your oath ensures you always have certain spells ready; when you reach a Paladin level specified… |
| 3 | **Vow of Enmity** | bend-attack | fx1 | ✓ EFFECT_BENDS | When you take the Attack action, you can expend one use of your Channel Divinity to utter a vow of enmity agai… |
| 7 | **Relentless Avenger** | clock, use-chip, movement | fx1 |  | Your supernatural focus helps you close off a foe’s retreat. When you hit a creature with an Opportunity Attac… |
| 15 | **Soul of Vengeance** | reaction | **TEXT** |  | Immediately after a creature under the effect of your Vow of Enmity hits or misses with an attack roll, you ca… |
| 20 | **Avenging Angel** | press-condition, half-on-save | fx2[frightened] save uses |  | As a Bonus Action, you gain the benefits below for 10 minutes or until you end them (no action required). Once… |

## Oath of the Ancients (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Nature's Wrath** | press-condition, half-on-save | fx1[restrained] save |  | As a Magic action, you can expend one use of your Channel Divinity to conjure spectral vines around nearby cre… |
| 3 | **Oath of the Ancients Spells** | — | **TEXT** |  | The magic of your oath ensures you always have certain spells ready; when you reach a Paladin level specified… |
| 7 | **Aura of Warding** | resist | fx1 | ✓ EMANATIONS | Ancient magic lies so heavily upon you that it forms an eldritch ward, blunting energy from beyond the Materia… |
| 15 | **Undying Sentinel** | temp-hp | uses |  | When you are reduced to 0 Hit Points and not killed outright, you can drop to 1 Hit Point instead, and you reg… |
| 20 | **Elder Champion** | bend-save, temp-hp | fx1 uses |  | As a Bonus Action, you can imbue your Aura of Protection with primal power, granting the benefits below for 1… |
