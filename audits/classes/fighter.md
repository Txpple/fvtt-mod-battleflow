# Fighter

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

32 rows · 14 with a family · 6 of those text-only · 1 named in the registry

Families: crit 3 · movement 3 · clock 3 · temp-hp 2 · use-chip 2 · bend-save 2 · d20-fold 1 · bend-attack 1 · resist 1 · concentration 1 · interrupt 1 · reaction 1 · aura 1 · press-condition 1

## Fighter (10)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Fighting Style** | — | **TEXT** |  | You have honed your martial prowess and gain a @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbF… |
| 1 | **Second Wind** | temp-hp | uses |  | You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it… |
| 2 | **Action Surge** | — | uses **TEXT** |  | You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action… |
| 2 | **Tactical Mind** | — | **TEXT** | ✓ LIST:D20_FOLDS | You have a mind for tactics on and off the battlefield. When you fail an ability check, you can expend a use o… |
| 5 | **Tactical Shift** | movement | **TEXT** |  | Whenever you activate your Second Wind with a Bonus Action, you can move up to half your Speed without provoki… |
| 9 | **Indomitable** | d20-fold | uses **TEXT** |  | If you fail a saving throw, you can reroll it with a bonus equal to your Fighter level (currently, [[lookup @c… |
| 9 | **Tactical Master** | — | fx1 |  | When you attack with a weapon whose mastery property you can use, you can replace that property with the Push,… |
| 11 | **Two Extra Attacks** | — | **TEXT** |  | You can attack three times instead of once whenever you take the Attack action on your turn. |
| 13 | **Studied Attacks** | bend-attack, use-chip | **TEXT** |  | You study your opponents and learn from each attack you make. If you make an attack roll against a creature an… |
| 20 | **Three Extra Attacks** | — | **TEXT** |  | You can attack four times instead of once whenever you take the Attack action on your turn. |

## Battle Master (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Combat Superiority** | — | uses **TEXT** |  | Your experience on the battlefield has refined your fighting techniques. You learn maneuvers that are fueled b… |
| 3 | **Student of War** | — | **TEXT** |  | You gain proficiency with one type of Artisan's Tools of your choice, and you gain proficiency in one skill of… |
| 7 | **Know Your Enemy** | — | uses **TEXT** |  | As a Bonus Action, you can discern certain strengths and weaknesses of a creature you can see within 30 feet o… |
| 10 | **Improved Combat Superiority** | — | **TEXT** |  | Your Superiority Die becomes a d10. |
| 15 | **Relentless** | clock | **TEXT** |  | Once per turn, when you use a maneuver, you can roll [[/r 1d8]] and use the number rolled instead of expending… |
| 18 | **Ultimate Combat Superiority** | — | **TEXT** |  | Your Superiority Die becomes a d12. |

## Champion (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Improved Critical** | crit | fx1 |  | Your attack rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20 on the d20.… |
| 3 | **Remarkable Athlete** | crit, movement | fx1 |  | Thanks to your athleticism, you have Advantage on Initiative rolls and Strength (Athletics) checks. In additio… |
| 7 | **Additional Fighting Style** | — | **TEXT** |  | You gain another @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbFeats00000000.JournalEntryPage.… |
| 10 | **Heroic Warrior** | — | **TEXT** |  | The thrill of battle drives you toward victory. During combat, you can give yourself Heroic Inspiration whenev… |
| 15 | **Superior Critical** | crit | fx1 |  | Your attack rolls with weapons and Unarmed Strikes can now score a Critical Hit on a roll of 18–20 on the d20.… |
| 18 | **Survivor** | bend-save, temp-hp | fx1 |  | You attain the pinnacle of resilience in battle, giving you these benefits. Defy Death. You have Advantage on… |

## Eldritch Knight (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **War Bond** | — | fx1 uses |  | You learn a ritual that creates a magical bond between yourself and one weapon. You perform the ritual over th… |
| 7 | **War Magic** | — | **TEXT** |  | When you take the Attack action on your turn, you can replace one of the attacks with a casting of one of your… |
| 10 | **Eldritch Strike** | bend-save | fx1 |  | You learn how to make your weapon strikes undercut a creature's ability to withstand your spells. When you hit… |
| 15 | **Arcane Charge** | — | **TEXT** |  | When you use your Action Surge, you can teleport up to 30 feet to an unoccupied space you can see. You can tel… |
| 18 | **Improved War Magic** | — | **TEXT** |  | When you take the Attack action on your turn, you can replace two of the attacks with a casting of one of your… |

## Psi Warrior (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Psionic Power** | clock, interrupt, reaction, aura | dmg uses |  | You harbor a wellspring of psionic energy within yourself. It is represented by your Psionic Energy Dice, whic… |
| 7 | **Telekinetic Adept** | clock, use-chip, press-condition, movement | fx2[prone] save uses |  | You have mastered new ways to use your telekinetic abilities, detailed below. Psi-Powered Leap. As a Bonus Act… |
| 10 | **Guarded Mind** | resist | **TEXT** |  | You have Resistance to Psychic damage. Moreover, if you start your turn with the Charmed or Frightened conditi… |
| 15 | **Bulwark of Force** | — | fx1[coverHalf] uses |  | You can shield yourself and others with telekinetic force. As a Bonus Action, you can choose creatures, includ… |
| 18 | **Telekinetic Master** | concentration | uses **TEXT** |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplTelekinesi]{Telekinesis} spell pre… |
