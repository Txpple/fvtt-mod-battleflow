# Cleric

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

27 rows · 13 with a family · 6 of those text-only · 2 named in the registry

Families: temp-hp 4 · rider-damage 3 · press-condition 2 · half-on-save 2 · reaction 2 · bend-attack 2 · clock 1 · resist 1 · bend-save 1 · aura 1 · concentration 1

## Cleric (7)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Divine Order** | — | **TEXT** |  | You have dedicated yourself to one of the following sacred roles of your choice. Protector. Trained for battle… |
| 2 | **Channel Divinity** | rider-damage, press-condition, half-on-save | fx1[frightened,incapacitated] save dmg uses |  | You can channel divine energy directly from the Outer Planes to fuel magical effects. You start with two such… |
| 5 | **Sear Undead** | — | fx1[frightened,incapacitated] save dmg |  | Whenever you use Turn Undead, you can roll a number of d8s equal to your Wisdom modifier (minimum of 1d8, curr… |
| 7 | **Blessed Strikes** | rider-damage, clock | **TEXT** |  | Divine power infuses you in battle. You gain one of the following options of your choice (if you get either op… |
| 10 | **Divine Intervention** | — | uses **TEXT** |  | You can call on your deity or pantheon to intervene on your behalf. As a Magic action, choose any @UUID[Compen… |
| 14 | **Improved Blessed Strikes** | rider-damage, temp-hp |  |  | The option you chose for Blessed Strikes grows more powerful. Divine Strike. The extra damage of your Divine S… |
| 20 | **Greater Divine Intervention** | — | **TEXT** |  | You can call on even more powerful divine intervention. When you use your Divine Intervention feature, you can… |

## Life Domain (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Disciple of Life** | — |  |  | When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains additional Hi… |
| 3 | **Life Domain Spells** | — | **TEXT** |  | Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric le… |
| 3 | **Preserve Life** | — |  |  | As a Magic action, you present your Holy Symbol and expend a use of your Channel Divinity to evoke healing ene… |
| 6 | **Blessed Healer** | temp-hp |  |  | The healing spells you cast on others heal you as well. Immediately after you cast a spell with a spell slot t… |
| 17 | **Supreme Healing** | — | **TEXT** |  | When you would normally roll one or more dice to restore Hit Points to a creature with a spell or Channel Divi… |

## Light Domain (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Light Domain Spells** | — | **TEXT** |  | Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric le… |
| 3 | **Radiance of the Dawn** | press-condition, half-on-save | save dmg |  | As a Magic action, you present your Holy Symbol and expend a use of your Channel Divinity to emit a flash of l… |
| 3 | **Warding Flare** | bend-attack, reaction | uses **TEXT** | ✓ LIST:INTERRUPTS | When a creature that you can see within 30 feet of yourself makes an attack roll, you can take a Reaction to i… |
| 6 | **Improved Warding Flare** | temp-hp |  |  | You regain all expended uses of your Warding Flare when you finish a Short or Long Rest. In addition, whenever… |
| 17 | **Corona of Light** | bend-save | fx1 uses |  | As a Magic action, you cause yourself to emit an aura of sunlight that lasts for 1 minute or until you dismiss… |

## Trickery Domain (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Blessing of the Trickster** | — | fx1 |  | As a Magic action, you can choose yourself or a willing creature within 30 feet of yourself to have Advantage… |
| 3 | **Invoke Duplicity** | bend-attack | **TEXT** | ✓ EFFECT_BENDS | As a Bonus Action, you can expend one use of your Channel Divinity to create a perfect visual illusion of your… |
| 3 | **Trickery Domain Spells** | — | **TEXT** |  | Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric le… |
| 6 | **Trickster's Transposition** | — | **TEXT** |  | Whenever you take the Bonus Action to create or move the illusion of your Invoke Duplicity, you can teleport,… |
| 17 | **Improved Duplicity** | temp-hp |  |  | The illusion of your Invoke Duplicity has grown more powerful in the following ways. Shared Distraction. When… |

## War Domain (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Guided Strike** | reaction, aura | **TEXT** |  | When you or a creature within 30 feet of you misses with an attack roll, you can expend one use of your Channe… |
| 3 | **War Domain Spells** | — | **TEXT** |  | Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric le… |
| 3 | **War Priest** | — | uses **TEXT** |  | As a Bonus Action, you can make one attack with a weapon or an Unarmed Strike. You can use this Bonus Action a… |
| 6 | **War God's Blessing** | concentration | **TEXT** |  | You can expend a use of your Channel Divinity to cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbspl… |
| 17 | **Avatar of Battle** | resist | **TEXT** |  | You gain Resistance to Bludgeoning, Piercing, and Slashing damage. |
