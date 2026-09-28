# Wizard

> Generated 2026-09-28 by `tools/audit-corpus.mjs` from the corpus scan — `dnd-players-handbook.classes`, the class and its subclasses. Evidence, not verdicts:
> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the
> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.

26 rows · 6 with a family · 6 of those text-only · 1 named in the registry

Families: bend-save 2 · reaction 2 · half-on-save 1 · temp-hp 1 · clock 1 · interrupt 1 · resist 1

## Wizard (6)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 1 | **Arcane Recovery** | — | uses **TEXT** |  | You can regain some of your magical energy by studying your spellbook. When you finish a Short Rest, you can c… |
| 1 | **Ritual Adept** | — | **TEXT** |  | You can cast any spell as a @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbSpells0000000.Journa… |
| 2 | **Scholar** | — | **TEXT** |  | While studying magic, you also specialized in another field of study. Choose one of the following skills in wh… |
| 5 | **Memorize Spell** | — | **TEXT** |  | Whenever you finish a Short Rest, you can study your spellbook and replace one of the level 1+ Wizard spells y… |
| 18 | **Spell Mastery** | — | fx1 |  | You have achieved such mastery over certain spells that you can cast them at will. Choose a level 1 and a leve… |
| 20 | **Signature Spells** | — | fx1 uses |  | Choose two level 3 spells in your spellbook as your signature spells. You always have these spells prepared, a… |

## Abjurer (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Abjuration Savant** | — | **TEXT** |  | Choose two Wizard spells from the @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbSpells0000000.… |
| 3 | **Arcane Ward** | temp-hp | uses **TEXT** |  | You can weave magic around yourself for protection. When you cast an Abjuration spell with a spell slot, you c… |
| 6 | **Projected Ward** | interrupt, reaction | **TEXT** |  | When a creature that you can see within 30 feet of yourself takes damage, you can take a Reaction to cause you… |
| 10 | **Spell Breaker** | — | **TEXT** |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplCounterspe]{Counterspell} and @UUI… |
| 14 | **Spell Resistance** | bend-save, resist | **TEXT** |  | You have Advantage on saving throws against spells, and you have Resistance to the damage of spells. Foundry N… |

## Diviner (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Divination Savant** | — | **TEXT** |  | Choose two Wizard spells from the @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbSpells0000000.… |
| 3 | **Portent** | clock | uses **TEXT** |  | Glimpses of the future begin to press on your awareness. Whenever you finish a Long Rest, roll two [[/r d20]]… |
| 6 | **Expert Divination** | — | **TEXT** |  | Casting Divination spells comes so easily to you that it expends only a fraction of your spellcasting efforts.… |
| 10 | **The Third Eye** | — | fx3 uses |  | You can increase your powers of perception. As a Bonus Action, choose one of the following benefits, which las… |
| 14 | **Greater Portent** | — | **TEXT** |  | The visions in your dreams intensify and paint a more accurate picture in your mind of what is to come. Roll t… |

## Evoker (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Evocation Savant** | — | **TEXT** |  | Choose two Wizard spells from the @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbSpells0000000.… |
| 3 | **Potent Cantrip** | — | **TEXT** |  | Your damaging cantrips affect even creatures that avoid the brunt of the effect. When you cast a cantrip at a… |
| 6 | **Sculpt Spells** | bend-save, half-on-save | **TEXT** |  | You can create pockets of relative safety within the effects of your evocations. When you cast an Evocation sp… |
| 10 | **Empowered Evocation** | — | dmg |  | Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one dama… |
| 14 | **Overchannel** | — | dmg uses |  | You can increase the power of your spells. When you cast a Wizard spell with a spell slot of levels 1–5 that d… |

## Illusionist (5)

| L | Name | Families | Structure | Known | Text |
| --- | --- | --- | --- | --- | --- |
| 3 | **Illusion Savant** | — | **TEXT** |  | Choose two Wizard spells from the @UUID[Compendium.dnd-players-handbook.content.JournalEntry.phbSpells0000000.… |
| 3 | **Improved Illusions** | — | **TEXT** |  | You can cast Illusion spells without providing Verbal components, and if an Illusion spell you cast has a rang… |
| 6 | **Phantasmal Creatures** | — | uses **TEXT** |  | You always have the @UUID[Compendium.dnd-players-handbook.spells.Item.phbsplSummonBeas]{Summon Beast} and @UUI… |
| 10 | **Illusory Self** | reaction | uses **TEXT** | ✓ LIST:INTERRUPTS | When a creature hits you with an attack roll, you can take a Reaction to interpose an illusory duplicate of yo… |
| 14 | **Illusory Reality** | — | **TEXT** |  | You have learned to weave shadow magic into your illusions to give them a semi-reality. When you cast an Illus… |
