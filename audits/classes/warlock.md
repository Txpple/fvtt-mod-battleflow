# Warlock

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

28 rows · 14 with a family · 2 of those text-only · 2 named in the registry

Families: temp-hp 5 · clock 5 · press-condition 5 · resist 4 · half-on-save 4 · bend-save 2 · reaction 2 · bend-attack 2 · interrupt 1 · rider-damage 1 · concentration 1 · use-chip 1 · aura 1

## Warlock (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Eldritch Invocations** | — | **TEXT** |  | You have unearthed Eldritch Invocations, pieces of forbidden knowledge that imbue you with an abiding magical… |
| 1 | **Pact Magic** | — | **TEXT** |  | Through occult ceremony, you have formed a pact with a mysterious entity to gain magical powers. The entity is… |
| 2 | **Magical Cunning** | — | uses **TEXT** |  | You can perform an esoteric rite for 1 minute. At the end of it, you regain expended Pact Magic spell slots bu… |
| 9 | **Contact Patron** | bend-save | **TEXT** |  | In the past, you usually contacted your patron through intermediaries. Now you can communicate directly; you a… |
| 11 | **Mystic Arcanum** | — | **TEXT** |  | Your patron grants you a magical secret called an arcanum. Choose one level 6 Warlock spell as this arcanum. Y… |
| 20 | **Eldritch Master** | — | **TEXT** |  | When you use your Magical Cunning feature, you regain all your expended Pact Magic spell slots. Foundry Note U… |

## Archfey Patron (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Archfey Spells** | — | **TEXT** |  | The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specifie… |
| 3 | **Steps of the Fey** | bend-attack, clock, press-condition, half-on-save, temp-hp | fx1 save uses | ✓ EFFECT_BENDS.from | Your patron grants you the ability to move between the boundaries of the planes. You can cast @UUID[Compendium… |
| 6 | **Misty Escape** | clock, reaction, press-condition, half-on-save | fx1[invisible] save dmg |  | You can cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplMistyStep0]{Misty Step} as a Reaction in… |
| 10 | **Beguiling Defenses** | interrupt, reaction, press-condition, half-on-save, resist | save uses |  | Your patron teaches you how to guard your mind and body. You are immune to the Reference[Charmed] condition. I… |
| 14 | **Bewitching Magic** | — | **TEXT** |  | Your patron grants you the ability to weave your magic with teleportation. Immediately after you cast an Encha… |

## Celestial Patron (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Celestial Spells** | — | **TEXT** |  | The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specifie… |
| 3 | **Healing Light** | — | uses |  | You gain the ability to channel celestial energy to heal wounds. You have a pool of d6s to fuel this healing.… |
| 6 | **Radiant Soul** | clock, resist | dmg |  | Your link to your patron allows you to serve as a conduit for radiant energy. You have Resistance to Radiant d… |
| 10 | **Celestial Resilience** | temp-hp |  |  | You gain Temporary Hit Points whenever you use your @UUID[Compendium.dnd-players-handbook.classes.Item.phbwlkM… |
| 14 | **Searing Vengeance** | clock, use-chip, temp-hp, aura | fx1[blinded] dmg uses |  | When you or an ally within 60 feet of you is about to make a Death Saving Throw, you can unleash radiant energ… |

## Fiend Patron (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Dark One's Blessing** | temp-hp |  |  | When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier plus y… |
| 3 | **Fiend Spells** | — | **TEXT** |  | The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specifie… |
| 6 | **Dark One's Own Luck** | — | uses **TEXT** |  | You can call on your fiendish patron to alter fate in your favor. When you make an ability check or a saving t… |
| 10 | **Fiendish Resilience** | resist | fx12 |  | Choose one damage type, other than Force, whenever you finish a Short or Long Rest. You have Resistance to tha… |
| 14 | **Hurl Through Hell** | clock, press-condition | save dmg uses |  | Once per turn when you hit a creature with an attack roll, you can try to instantly transport the target throu… |

## Great Old One Patron (7)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Awakened Mind** | — | **TEXT** |  | You can form a telepathic connection between your mind and the mind of another. As a Bonus Action, choose one… |
| 3 | **Great Old One Spells** | — | **TEXT** |  | The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specifie… |
| 3 | **Psychic Spells** | — | **TEXT** |  | When you cast a Warlock spell that deals damage, you can change its damage type to Psychic. In addition, when… |
| 6 | **Clairvoyant Combatant** | bend-attack, press-condition, half-on-save | fx1 save uses | ✓ EFFECT_BENDS, EFFECT_BENDS.from | When you form a telepathic bond with a creature using your Awakened Mind, you can force that creature to make… |
| 10 | **Eldritch Hex** | bend-save | **TEXT** |  | Your alien patron grants you a powerful curse. You always have the @UUID[Compendium.dnd-players-handbook.spell… |
| 10 | **Thought Shield** | resist | fx1 |  | Your thoughts can’t be read by telepathy or other means unless you allow it. You also have Resistance to Psych… |
| 14 | **Create Thrall** | rider-damage, concentration, temp-hp | dmg |  | You can cast @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplSummonAber]{Summon Aberration}, you can m… |
