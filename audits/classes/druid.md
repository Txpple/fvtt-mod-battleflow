# Druid

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

29 rows · 14 with a family · 5 of those text-only · 1 named in the registry

Families: rider-damage 3 · clock 3 · resist 3 · press-condition 2 · movement 2 · temp-hp 2 · aura 2 · half-on-save 1 · reaction 1 · bend-attack 1 · use-chip 1 · concentration 1

## Druid (9)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Druidic** | — | **TEXT** |  | You know Druidic, the secret language of Druids. While learning this ancient tongue, you also unlocked the mag… |
| 1 | **Primal Order** | — | **TEXT** |  | You have dedicated yourself to one of the following sacred roles of your choice. Magician. You know one extra… |
| 2 | **Wild Companion** | — | **TEXT** |  | You can summon a nature spirit that assumes an animal form to aid you. As a Magic action, you can expend a spe… |
| 2 | **Wild Shape** | — | uses **TEXT** |  | The power of nature allows you to assume the form of an animal. As a Bonus Action, you shape-shift into a Beas… |
| 5 | **Wild Resurgence** | clock | uses **TEXT** |  | Once on each of your turns, if you have no uses of Wild Shape left, you can give yourself one use by expending… |
| 7 | **Elemental Fury** | rider-damage, clock | **TEXT** |  | The might of the elements flows through you. You gain one of the following options of your choice. Potent Spel… |
| 15 | **Improved Elemental Fury** | rider-damage | **TEXT** |  | The option you chose for Elemental Fury grows more powerful, as detailed below. Potent Spellcasting. When you… |
| 18 | **Beast Spells** | — | **TEXT** |  | While using Wild Shape, you can cast spells in Beast form, except for any spell that has a Material component… |
| 20 | **Archdruid** | — | uses **TEXT** |  | The vitality of nature constantly blooms within you, granting you the following benefits. Evergreen Wild Shape… |

## Circle of the Land (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Circle of the Land Spells** | — | **TEXT** |  | Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. Consult the tab… |
| 3 | **Land's Aid** | press-condition, half-on-save | save dmg |  | As a Magic action, you can expend a use of your Wild Shape and choose a point within 60 feet of yourself. Vita… |
| 6 | **Natural Recovery** | — | uses **TEXT** |  | You can cast one of the level 1+ spells that you have prepared from your Circle Spells feature without expendi… |
| 10 | **Nature's Ward** | resist | fx4 |  | You are immune to the Poisoned condition, and you have Resistance to a damage type associated with your curren… |
| 14 | **Nature's Sanctuary** | — | fx4[coverHalf] |  | As a Magic action, you can expend a use of your Wild Shape and cause spectral trees and vines to appear in a 1… |

## Circle of the Moon (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Circle Forms** | temp-hp | **TEXT** |  | You can channel lunar magic when you assume a Wild Shape form, granting you the benefits below. Challenge Rati… |
| 3 | **Circle of the Moon Spells** | — | **TEXT** |  | When you reach a Druid level specified in the Circle of the Moon Spells table, you thereafter always have the… |
| 6 | **Improved Circle Forms** | — | fx1 |  | While in a Wild Shape form, you gain the following benefits. Lunar Radiance. Each of your attacks in a Wild Sh… |
| 10 | **Moonlight Step** | bend-attack, use-chip | fx1 uses | ✓ EFFECT_BENDS | You magically transport yourself, reappearing amid a burst of moonlight. As a Bonus Action, you teleport up to… |
| 14 | **Lunar Form** | rider-damage, clock | dmg |  | The power of the moon suffuses you, granting you the following benefits. Improved Lunar Radiance. Once per tur… |

## Circle of the Sea (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Circle of the Sea Spells** | — | **TEXT** |  | When you reach a Druid level specified in the Circle of the Sea Spells table, you thereafter always have the l… |
| 3 | **Wrath of the Sea** | press-condition | fx1 save dmg |  | As a Bonus Action, you can expend a use of your Wild Shape to manifest a 5-foot Emanation that takes the form… |
| 6 | **Aquatic Affinity** | movement | fx1 |  | The size of the Emanation created by your Wrath of the Sea increases to 10 feet. In addition, you gain a Swim… |
| 10 | **Stormborn** | resist, movement | fx1 save dmg |  | Your Wrath of the Sea confers two more benefits while active, as detailed below. Flight. You gain a Fly Speed… |
| 14 | **Oceanic Gift** | — | fx1 save dmg |  | Instead of manifesting the Emanation of Wrath of the Sea around yourself, you can manifest it around one willi… |

## Circle of the Stars (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Star Map** | — | **TEXT** |  | You've created a star chart as part of your heavenly studies. It is a Tiny object, and you can use it as a Spe… |
| 3 | **Starry Form** | concentration, temp-hp, aura | fx3 atk dmg |  | As a Bonus Action, you can expend a use of your Wild Shape feature to take on a starry form rather than shape-… |
| 6 | **Cosmic Omen** | reaction, aura | uses **TEXT** |  | Whenever you finish a Long Rest, you can consult your Star Map for omens and roll a die. Until you finish your… |
| 10 | **Twinkling Constellations** | — | **TEXT** |  | The constellations of your Starry Form improve. The 1d8 of the Archer and the Chalice becomes 2d8, and while t… |
| 14 | **Full of Stars** | resist | fx1 |  | While in your Starry Form, you become partially incorporeal, giving you Resistance to Bludgeoning, Piercing, a… |
