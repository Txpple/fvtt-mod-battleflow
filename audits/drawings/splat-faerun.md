# Heroes of Faerûn — the drawing

> **What this is:** the hand verdicts behind [the register](../faerun-register.md) (`tools/audit-splat-register.mjs faerun`
> reads the table below). The evidence is [splat/heroes-faerun.md](../splat/heroes-faerun.md), the plan
> [plans/splat-books.md](../plans/splat-books.md), the rulings RULINGS *Heroes of Faerûn*. Rapid mode: rows and suites,
> no walkthrough; the walk table sits in RULINGS for the batched walk.

## What the book adds, by shape

| Shape | Precedent | Faerûn's rows |
| --- | --- | --- |
| the Bloodied moment WATCHED — an enemy becomes Bloodied | `REBUKES` + `judge: "enemyBloodied"` (Harvest Undead's judge, a bystander's) | Bloodthirst |
| the hit's save at the attacker | `REBUKES` Warding Charm | Chilling Retribution |
| the half and the save at the attacker | `INTERRUPT_MULTIPLIERS` Beguiling Defenses | Elemental Rebuke |
| a friend's failed save rerolled with a bonus | `INTERRUPT_ROLLS` Countercharm + `bonus` | Shared Resilience |
| an ignored Resistance | `DAMAGE_RULES` Elemental Adept | Frigid Explorer (Cold), Spellfire Adept (Radiant) |
| a once-per-turn die on a weapon hit | `CLOCK_RIDERS` Divine Strike | Frigid Explorer's Polar Strikes |
| a "you can" save on a hit, the save by the ASI'd ability | `CLOCK_RIDERS` + `activities` | Fairy Trickster's Flustering Strike |
| a Cunning Strike option from a subclass | `CUNNING_OPTIONS` · `REPEAT_SAVES` | Strike Fear's Terrify |
| a cast rider that uses the feature on the caster | `CAST_RIDERS` + `use` | Hunter's Rime |
| a feature ring pulsing at the bearer's turn START | `EMANATIONS` Inner Radiance + `pulse.on: "sourceTurnStart"` | Frozen Haunt |
| the areas that pulse | `EMANATIONS` Spirit Guardians · Moonbeam | Cacophonic Shield, Dirge, Doomtide, Spellfire Storm |
| Evasion against spells while an effect stands | `EVASIONS` + `effect` + `spells` | Crown of Spellfire's Spell Avoidance |
| the save and attack bends | `EFFECT_BENDS` | Team Tactics, Bolstered, Stronger Together, Fortifying Soul, Elminster's Elusion, Shielded, Flustered |
| the drop held by a save | `DROP_TO_ONE` Undead Fortitude | Mechanical Determination |
| the targets chosen in an area | `CHOSEN_AREAS` | Laeral's Silver Lance |
| a Reaction to elemental damage, self | `REBUKES` Elemental Absorption | Elminster's Effulgent Spheres' Absorb Energy |
| an Opportunity Attack as the answer to a melee hit | `REBUKES` Retaliation + `hitMelee` | Zhentarim Tactics' Retaliate |

## Register verdicts

The hand column `tools/audit-splat-register.mjs faerun` reads — a verdict the data cannot derive, by name. A row not listed
here takes the generator's default: MODULE when a registry table names it, TEXT when the pack ships a paragraph only or the
text trips no combat family, NATIVE otherwise. `| **Row** | NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS | why |`.

| Row | Verdict | Why |
| --- | --- | --- |
| **Moon's Inspiration** | WAITS | Lunar Vitality: a heal raised by a Bardic die spent — a heal offer paid by a die, its first customer; Inspired Eclipse is the pack's effect and a teleport |
| **Blessing of Moonlight** | WAITS | a heal to another creature whenever a Moonbeam save FAILS — a save-triggered gift, its first customer |
| **Eventide's Splendor** | NATIVE | the pack's effects and uses |
| **Primal Lore** | TEXT | a cantrip |
| **Knowledge Domain Spells** | TEXT | a spell list |
| **Blessings of Knowledge** | TEXT | proficiencies |
| **Mind Magic** | TEXT | telepathy from the sheet |
| **Unfettered Mind** | NATIVE | the pack's effect |
| **Divine Foreknowledge** | NATIVE | the pack's Advantage effect |
| **Group Recovery** | WAITS | each chosen ally regains Hit Points after Second Wind — a hand-out of HEALING to several, its first customer (Inspiring Smite divides Temporary Hit Points) |
| **Knightly Envoy** | TEXT | social |
| **Rallying Surge** | TEXT | the allies' Reactions are their own, from the sheet |
| **Inspiring Commander** | TEXT | the scale and the immunities are the pack's |
| **Genie Spells** | TEXT | a spell list |
| **Genie's Splendor** | NATIVE | the AC formula is the pack's effect |
| **Aura of Elemental Shielding** | WAITS | an aura whose member effect is one of five by the paladin's pick — the emanation's `effect` as a choice, its first customer |
| **Elemental Smite** | WAITS | after Divine Smite, a Channel Divinity for one of four effects at the smite's target — Inspiring Smite's `after` with a pick of activities, its first customer |
| **Noble Scion** | WAITS | Minor Wish: a failed D20 Test of yours or an aura ally's made a success — a `succeed` bend on the bystander table, its first customer; the flight is the pack's |
| **Winter Walker Spells** | TEXT | a spell list |
| **Bloodthirst** | MODULE | the Bloodied moment watched (`judge: "enemyBloodied"`); the teleport and the melee attack from the sheet |
| **Dread Allegiance** | NATIVE | the pack's resistance and cantrip |
| **Aura of Malevolence** | TEXT | damage around a teleport — the table's |
| **Dread Incarnate** | NATIVE | Murderous Intent is the pack's effect; Cutthroat a rest |
| **Spellfire Burst** | OUT | cast-triggered (BACKLOG *Scoped out for good*) |
| **Honed Spellfire** | OUT | cast-triggered |
| **Absorb Spells** | OUT | cast-triggered (Counterspell's save) |
| **Spellfire Spells** | TEXT | a spell list |
| **Crown of Spellfire** | MODULE | Spell Avoidance is `EVASIONS` against spells while the crown stands; Burning Life Force WAITS (a reduction paid in Hit Point Dice, its first customer); the flight is the pack's |
| **Bladesong** | NATIVE | the pack's effect |
| **Training in War and Song** | TEXT | proficiencies |
| **Extra Attack** | TEXT | action economy |
| **Song of Defense** | WAITS | a reduction paid with a SPELL SLOT (five times its level) — `INTERRUPT_REDUCTIONS` with a slot pool, its first customer |
| **Song of Victory** | TEXT | action economy |
| **Cult of the Dragon Initiate** | NATIVE | Dragon's Terror is the pack's save and Frightened; Inspired by Fear is the table's |
| **Emerald Enclave Fledgling** | TEXT | the Help action |
| **Harper Agent** | TEXT | social |
| **Lords' Alliance Agent** | MODULE | Reassert Honor's chip is `EFFECT_BENDS` "Adv. Next Attack"; Inspiring Strike WAITS (Heroic Inspiration to an ally on a crit, its first customer) |
| **Purple Dragon Rook** | WAITS | Rallying Cry: Heroic Inspiration to up to PB creatures at Initiative — the rest song's give at Initiative, its first customer |
| **Spellfire Spark** | WAITS | Magic Absorption: 1d4 off spell damage once per turn — a reduction against spell damage alone, its first customer |
| **Tyro of the Gauntlet** | MODULE | Vigilant's chip is `EFFECT_BENDS` "Vigilant"; Stand as One is the table's |
| **Zhentarim Ruffian** | WAITS | Exploit Opening: an Opportunity Attack's damage rolled twice — Savage Attacker's `DAMAGE_EITHER` with an opportunity judge, its first customer |
| **Cold Caster** | WAITS | Frostbite: −1d4 on the target's next save — a landed penalty die, its first customer |
| **Dragonscarred** | NATIVE | the pack's resistance and save |
| **Enclave Magic** | TEXT | spells and concentration — the sheet's |
| **Fairy Trickster** | MODULE | Flustering Strike rides the hit (`CLOCK_RIDERS` `activities`); Faerie Trod Trotter is movement |
| **Genie Magic** | TEXT | Wish Magic — the table's |
| **Harper Teamwork** | TEXT | the Help action; Inspiring Willpower is the table's |
| **Lordly Resolve** | MODULE | Bolstered's save Advantage; the Reaction to stand and the immunity are the table's |
| **Mythal Touched** | WAITS | Mythal Ward: a Reaction rolling on a table when a spell hits or a save fails — a cast-triggered-shaped reaction with a RollTable, its first customer |
| **Order’s Resilience** | MODULE | Stronger Together's Strength-save Advantage; Resurge is movement |
| **Purple Dragon Commandant** | MODULE | Last Stand fires by name; Encourage Ally is the pack's heal |
| **Spellfire Adept** | MODULE | Searing Spellfire ignores Radiant Resistance; Fueled Spellfire WAITS (Hit Point Dice added to a spell's damage, its first customer) |
| **Street Justice** | MODULE | Headlock fires by name |
| **Zhentarim Tactics** | MODULE | Retaliate is a rebuke on a melee hit — an Opportunity Attack; Versatile Merc is a rest |
| **Boon of Bloodshed** | MODULE | Killer's Fortune's chip is keyed; Power from Pain WAITS — the epic boons are a slice of their own (BACKLOG) |
| **Boon of Bountiful Health** | OUT | an epic boon — BACKLOG *The epic boons — every book's* |
| **Boon of Communication** | OUT | an epic boon |
| **Boon of Desperate Resilience** | OUT | an epic boon |
| **Boon of Exquisite Radiance** | OUT | an epic boon |
| **Boon of Fluid Forms** | OUT | an epic boon |
| **Boon of Fortune’s Favor** | OUT | an epic boon |
| **Boon of Poison Mastery** | OUT | an epic boon |
| **Boon of Revelry** | OUT | an epic boon |
| **Boon of Terror** | OUT | an epic boon |
| **Boon of the Bright Sun** | OUT | an epic boon |
| **Boon of the Furious Storm** | OUT | an epic boon |
| **Boon of the Soul Drinker** | OUT | an epic boon |
| **Spellfire Flare** | WAITS | a spell attack that ignores Half and Three-Quarters Cover — the cover measure's spell facet, its first customer |
| **Wardaway** | NATIVE | the pack's save and Disoriented; "an action or a Bonus Action, not both" is the table's |
| **Deryan's Helpful Homunculi** | OUT | summons-shaped — GitHub issue #1 |
| **Conjure Constructs** | OUT | summons-shaped — GitHub issue #1 |
| **Syluné's Viper** | NATIVE | the pack's Temporary Hit Points, attack and Venom |
| **Backlash** | WAITS | a Reaction spell reducing damage by 4d6 + mod, then the dealer's save — a damage interrupt with a reduction the pack does not roll, its first customer |
| **Alustriel’s Mooncloak** | WAITS | the Cast names an effect the pack does not ship (a data defect for Errata 5e); Liberation is a `succeed` against named conditions, its first customer |
| **Songal's Elemental Suffusion** | WAITS | a save demanded of everyone inside at the CASTER's turn start — the emanation's demand on sourceTurnStart, its first customer |
| **Elminster's Effulgent Spheres** | MODULE | Absorb Energy is a rebuke on elemental damage; Energy Blast is the sheet's attack |
| **Simbul's Synostodweomer** | OUT | cast-triggered |
| **Holy Star of Mystra** | NATIVE | the attack and the Three-Quarters Cover status; the Reaction against a spell WAITS (the redirect's cousin) |
| **Blade of Disaster** | NATIVE | the summoned blade's attacks; its 18-to-crit is the pack's own to set on the attack |
| **Desert Clothing** | TEXT | an environmental save |
| **Monster Camouflage** | TEXT | a disguise |
| **Warm Fungal Clothing** | TEXT | an environmental save |
| **Mechanical Determination** | MODULE | Undead Fortitude's save with Lightning |
| **Command** | NATIVE | the construct's Clockwork Force save and Orderly Ward — the SPELL's press no longer answers it |
| **Move and Attack** | NATIVE | the blade's attacks |
| **Wind-Up Operation** | TEXT | narrative |
