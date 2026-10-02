# Ravenloft: The Horrors Within — the drawing

> **What this is:** the hand verdicts behind [the register](../ravenloft-register.md) (`tools/audit-splat-register.mjs ravenloft`
> reads the table below). The evidence is [splat/ravenloft.md](../splat/ravenloft.md), the plan
> [plans/splat-books.md](../plans/splat-books.md), the rulings RULINGS *Ravenloft: The Horrors Within*. Rapid mode: rows and
> suites, no walkthrough; the walk table sits in RULINGS for the batched walk. The WAITS rows stand for a later pass (the
> user, 2026-10-02: *"keep those waits rows hanging, we'll have to go through those"*).

## What the book adds, by shape

| Shape | Precedent | Ravenloft's rows |
| --- | --- | --- |
| a self save forced by a natural 1 on any D20 Test | **`MISHAPS` — a new TABLE, not a kind** (six customers; the saves machine takes the activity) | Aberrant Anatomy, Echoing Soul, Gathered Whispers, Living Shadow, Symbiotic Being, Watchers |
| the roller's own failed save or check lifted by a die or a number | `INTERRUPT_ROLLS` Transmuted Anatomy (`only: "self"`) + a flat `die` ("@prof") · `die: "hitDie"` (new) | Survivor's Steel Yourself (once per Long Rest the table's — the pack's activity counts no use), Symbiotic Being's Sustained Symbiosis, Knowledge from a Past Life |
| an Initiative reroll on a low d20 | `INITIATIVE_GRANTS` + `reroll` (new) | Survivor's Hypervigilance |
| half the damage on the hold | `INTERRUPT_MULTIPLIERS` Uncanny Dodge | Sentinel at Death's Door (the hit on you; the Bloodied ally's half and the crit cancel WAIT) |
| extra damage against a target wearing a status | `CLOCK_RIDERS` + `targetStatus` (new; Arcana's Spore Spray is its second customer) | Ancient Might's Ominous Strikes |
| the once-per-turn die on a damaged target | `CLOCK_RIDERS` Dreadful Strikes + `judge: "targetDamaged"` | Circle of Mortality's Pull of Death |
| anyone's hit on the bearer's mark ends it for damage | `CLOCK_RIDERS` Bestial Fury's `marked` + `owner: "marker"` + `endsMark` (new) | Path to the Grave |
| after Sneak Attack, a second creature within reach takes dice | `CLOCK_RIDERS` Superior Hunter's Prey's `spread` + `requires: "sneak"` | Wails from the Grave |
| a heal when an enemy dies, offered to one creature in reach | `HEAL_ON_HIT` Dark One's Blessing (`on: "kill"`) + Improved Blessed Strikes' `pick` | Divine Reaper's Keeper of Souls |
| a heal on the bearer's own hit while a form stands and Bloodied | `HEAL_ON_HIT` + `on: "hit"`, `while`, `bloodied` (new) | Wrath of the Wild's Hungering Might |
| the drop held by a save, a heal on the success | `DROP_TO_ONE` Relentless Rage | Power of Shadow's Strength of the Grave |
| the drop held while a form stands, the Hit Points set | `DROP_TO_ONE` Undying Sentinel's ask + `heal` + `while` | Ancient Might's Persistent Wrath |
| a feature ring pulsing at the bearer's turn START while a form stands | `EMANATIONS` Frozen Haunt | Wrath of the Wild's Unnerving Aura |
| an Opportunity Attack when a creature in reach damages you or an ally | `REBUKES` Zhentarim Tactics + `ward` | Wrath of the Wild's Prowling Retribution |
| a teleport Reaction on damage | `REBUKES` Misty Escape (`self`) | Mist Walker's Mist Walk |
| a save at the damager in reach | `REBUKES` Hellish Rebuke | Mark of Obsession |
| a Reaction to a damage type, from the sheet | `REBUKES` Elemental Absorption (`types`, `self`) | Cold Sprint |
| the repeating save on a landed effect | `REPEAT_SAVES` | Watchers' Paranoia (turn end), Symbiotic Agenda's Charmed (on damage) |
| the save and attack bends | `EFFECT_BENDS` (Howl's and Path to the Grave's rows already stood) | Paranoia; Terrorizer (+ `judge: "targetStatus"`, new), Incomprehensible Form, Susceptible to Charm |
| an ignored Resistance | `DAMAGE_RULES` Elemental Adept · Frigid Explorer + `spell` (new) | Touch of Death's Death Touch (Chill Touch), Grave Touched's Arcane Necrosis |
| a once-per-turn die on a class's spell damage | `DAMAGE_RULES` B4 spell bonus (`classes`, `once: "turn"`) | Empowered Channeling's Power from Beyond (the healing half and the slot are the table's) |
| the healing dice at their maximum on a creature at 0 | `HEAL_REROLLS` Supreme Healing + `atZero` (new) | Circle of Mortality's Return to Life |
| the monster auras that save at the turn start or end | `EMANATIONS` the GM's side | Terrifying Aura, Viral Aura, Deathly Stench, Possessive Aura (turn end) |
| the damage at the turn start while a landed condition stands | `TURN_GRANTS` Spores (`deals`) | Ravenous Bites |
| a reduction by a roll the activity does not carry | `INTERRUPT_REDUCTIONS` Parry + `amount` (new) + `ally` | Deflect Blow |

## Register verdicts

The hand column `tools/audit-splat-register.mjs ravenloft` reads — a verdict the data cannot derive, by name. A row not listed
here takes the generator's default: MODULE when a registry table names it, TEXT when the pack ships a paragraph only or the
text trips no combat family, NATIVE otherwise. `| **Row** | NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS | why |`.

| Row | Verdict | Why |
| --- | --- | --- |
| **Eerie Token** | NATIVE | the pack's enchant and its two uses; the messaging is the table's |
| **Escaped Death** | NATIVE | the pack's Advantage effect on Death Saving Throws |
| **Everlasting** | TEXT | rests and sleep |
| **Howl** | MODULE | the pack's save; the landed "Attack and Save Disadvantage" is `EFFECT_BENDS` (a row that already stood) |
| **Knowledge from a Past Life** | MODULE | +1d6 on your own failed ability check — `INTERRUPT_ROLLS` the roller's own, a use spent |
| **Spider Climb Improvement** | TEXT | movement |
| **Channeler** | TEXT | a cantrip and a focus |
| **Empowered Channeling** | MODULE | Power from Beyond's 1d6 on a Bard spell's damage once per turn (`DAMAGE_RULES`; the healing half and "with a spell slot" are the table's); Spiritual Manifestation's Half Cover for allies in Spirit Guardians WAITS (a helpful member effect from another feature's pick) |
| **Mystical Connection** | TEXT | the table roll |
| **Spirits from Beyond** | TEXT | the spirit table and its unleash are the sheet's activities |
| **Circle of Mortality** | MODULE | Pull of Death rides a hit on a damaged creature once per turn (`CLOCK_RIDERS`; a spell's damage without an attack roll is the table's); Return to Life maxes the healing dice on a creature at 0 (`HEAL_REROLLS` `atZero`) |
| **Divine Reaper** | MODULE | Keeper of Souls: an enemy dies within 60 ft — the heal offered to one creature within 60 ft, the use spent (`HEAL_ON_HIT` on kill); Enhanced Necromancy's second target WAITS (a cast's extra target, its first customer) |
| **Grave Domain Spells** | TEXT | a spell list |
| **Path to the Grave** | MODULE | the Curse is the pack's effect, its Disadvantage a bend that already stood; End Curse Early rides ANY ally's hit on the cursed creature and ends the curse (`CLOCK_RIDERS` `marked` + `owner: "marker"` + `endsMark`); Necrotic or Radiant is the pick on the offer |
| **Sentinel at Death's Door** | MODULE | the hit on you: Uncanny Dodge's half (`INTERRUPT_MULTIPLIERS`); the Bloodied ally within 60 ft and the Critical Hit's effects cancelled WAIT (an ally guard on the multiplier hold and a crit cancel, their first customers) |
| **Ancient Might** | MODULE | Ominous Strikes: Wisdom modifier on a hit against a Frightened target (`CLOCK_RIDERS` `targetStatus`); Persistent Wrath: the drop held at twice the ranger's level while the form stands (`DROP_TO_ONE` ask + `heal` + `while`); Timeless is the pack's |
| **Hollow Warden Spells** | TEXT | a spell list |
| **Hungering Might** | MODULE | the heal is Wrath of the Wild's own activity — the row keyed there; the Constitution bonus is the pack's effect |
| **Rot and Violence** | NATIVE | Menacing Aura is the pack's effect on the aura's failure; Strangling Roots' second mastery is the table's |
| **Wrath of the Wild** | MODULE | Transform Self is the pack's enchant; Unnerving Aura a ring while Ghastly Form stands, pulsing at the ranger's turn START (`EMANATIONS`, Frozen Haunt's row); Prowling Retribution an Opportunity Attack when a creature within 5 ft damages you or an ally (`REBUKES` `ward` + `opportunity`); Hungering Might heals 1d10 + Wis on your hit while transformed and Bloodied, once per turn (`HEAL_ON_HIT` `on: "hit"`) |
| **Death's Friend** | WAITS | Death's Lament: Wails' dice on BOTH creatures — the spread's second target doubled, its first customer; Draw of Death: a soul trinket at Initiative — the trinkets are items the pack does not count |
| **Ghost Walk** | NATIVE | the pack's effect; the trinket destroyed to restore it is the table's |
| **Tokens of the Departed** | WAITS | Claim Departed Spirit: a Reaction when a creature within 30 ft dies — the death moment's rebuke, its first customer; the trinkets are items |
| **Voice of Death** | TEXT | a cast from the sheet |
| **Wails from the Grave** | MODULE | after Sneak Attack damage, a second creature within 30 ft of the first takes half the Sneak dice as Necrotic (`CLOCK_RIDERS` `spread` + `requires: "sneak"`), a use spent |
| **Whispers of the Dead** | TEXT | proficiencies |
| **Reanimated Companion** | OUT | summons-shaped — GitHub issue #1 |
| **Improved Reanimation** | OUT | the companion's — issue #1 |
| **Macabre Modifications** | OUT | the companion's — issue #1 |
| **Reanimator Spells** | TEXT | a spell list |
| **Refined Reanimation** | OUT | Life Transfer reads the companion — issue #1; Facilitated Revival is a cast |
| **Reanimator's Skill Set** | TEXT | proficiencies |
| **Strange Modifications** | OUT | the companion's — issue #1 |
| **Arcane Conduit** | OUT | the companion's — issue #1 |
| **Bloated** | OUT | the companion's — issue #1 |
| **Ferocity** | OUT | the companion's — issue #1 |
| **Gaunt** | OUT | the companion's — issue #1 |
| **Moist** | OUT | the companion's — issue #1 |
| **Death Burst** | OUT | the companion's — issue #1 |
| **Dreadful Swipe** | OUT | the companion's — issue #1 |
| **Lightning Absorption** | OUT | the companion's — issue #1 |
| **Beasts of Ill Omen** | OUT | summons-shaped — issue #1 |
| **Power of Shadow** | MODULE | Strength of the Grave: the drop held while the Charisma save rolls (DC 5 + the damage), the success sets the Hit Points to Cha + level (`DROP_TO_ONE` Relentless Rage's row), once per Long Rest; Eyes of the Dark is the pack's |
| **Shadow Spells** | TEXT | a spell list |
| **Shadow Walk** | TEXT | a teleport |
| **Umbral Form** | NATIVE | the pack's effect and uses |
| **Aberrant Anatomy** | MODULE | Warping Flesh: a 1 on any D20 Test forces the pack's Constitution save (`MISHAPS`), Stunned on the failure; the rest is the sheet's |
| **Echoing Soul** | MODULE | Intrusive Echoes: the mishap save (`MISHAPS`), Incapacitated on the failure |
| **Gathered Whispers** | MODULE | Voices from Beyond: the mishap save (`MISHAPS`), Deafened on the failure; Unearthly Scream WAITS (+PB to AC against the hit — a Reaction AC bonus the pack ships without an effect; the ac kind reads the effect that lands, its first customer with none); the casts are the sheet's |
| **Living Shadow** | MODULE | Ominous Will: the mishap save (`MISHAPS`), Incapacitated on the failure (the Shadow's Will table is the table's); Lengthened Strike's reach is the table's |
| **Mist Walker** | MODULE | Mist Walk: a Reaction on damage, the teleport from the sheet (`REBUKES` Misty Escape's row); the failed-save trigger and Poisoned Roots are the table's |
| **Second Skin** | NATIVE | the catalyst is the table's; the save and the cast are the sheet's |
| **Sharp Eye** | TEXT | Search and Study |
| **Survivor** | MODULE | Hypervigilance: the Initiative d20 of 9 or lower offered a reroll (`INITIATIVE_GRANTS` `reroll`); Steel Yourself: your own failed save against Charmed or Frightened lifted by your Proficiency Bonus (`INTERRUPT_ROLLS` the roller's own; once per Long Rest is the table's — the pack's activity carries no use to count); told apart from the Fighter's Survivor by the feat subtype (`FEATURE_TYPES`) |
| **Symbiotic Being** | MODULE | Sustained Symbiosis: a Hit Die added to your own failed save (`INTERRUPT_ROLLS`, the largest die); Symbiotic Agenda: the mishap save (`MISHAPS`), Charmed on the failure, repeated when damaged (`REPEAT_SAVES`) |
| **Touch of Death** | MODULE | the feat: Death Touch's Chill Touch Necrotic ignores Resistance (`DAMAGE_RULES` `spell`), Pull of the Grave the pack's effect; Ankhtepot's action of the same name is the GM's read ("80 Hit Points or fewer dies") and is told apart by the feat subtype (`FEATURE_TYPES`) |
| **Watchers** | MODULE | Incessant Watchers: the mishap save (`MISHAPS`); Paranoia's Disadvantage on D20 Tests is a bend, repeated at the turn end (`REPEAT_SAVES`); Heightened Suspicion is the table's |
| **Form of Dread** | WAITS | Frightful Avatar: a "you can" save on a hit once per turn while the form stands — a `CLOCK_RIDERS` save rider with a `while`, its first customer; the Temporary Hit Points and the immunity are the pack's |
| **Grave Touched** | MODULE | Arcane Necrosis: Necrotic ignores Resistance (`DAMAGE_RULES`); the type change and Dreaded Necrosis' extra die WAIT (a spell's type swapped on the cast; an extra die while a form stands) |
| **Necrotic Husk** | WAITS | Unholy Resuscitation: the drop's burst save at everyone within 30 ft and the Hit Points set to twice the level — Death Throes' use on a survivor, its first customer; Necrotic Resilience is the pack's |
| **Superior Dread** | NATIVE | the pack's resistances and flight; Profane Casting is the table's |
| **Undead Spells** | TEXT | a spell list |
| **Jolt to Life** | WAITS | the Lightning save at the healed creature's area when Spare the Dying is cast — Hunter's Rime's `use` aimed at the target with a pick, its first customer |
| **Charm of the Black Rose** | NATIVE | the pack's cast and effect |
| **Ebonbane** | NATIVE | the +3 and the 3d6 Necrotic are on the pack's attack for every target — strike the Necrotic by hand against a creature that is neither Celestial nor Humanoid; the saving-throw Advantage and Insatiable Rage are the table's |
| **Harkon's Bite** | NATIVE | the pack's +1 effect; the curse is the table's |
| **Mark of Beasts** | NATIVE | the pack's cast |
| **Mark of Obsession** | MODULE | a Reaction after damage from a creature within 10 ft: the pack's save at the damager, Frightened on the failure (`REBUKES`), once per Long Rest |
| **Mark of Sacrifice** | NATIVE | the pack's cast |
| **Mark of the Dread Lord** | NATIVE | the pack's cast |
| **Unbreakable Heart** | NATIVE | the Raise Dead and the sickness are the pack's effects; the Dim Light is the token's own light setting — the table's |
| **Spell Scroll: Protection from Evil and Good** | NATIVE | the pack's cast |
| **Terrorizer** | MODULE | Advantage against a Frightened target (`EFFECT_BENDS` `judge: "targetStatus"`) |
| **Incomprehensible Form** | MODULE | Displacement's row: attacks against it at Disadvantage unless Incapacitated |
| **Susceptible to Charm** | MODULE | Disadvantage on saves against Charmed (`EFFECT_BENDS` `saves` + `against`) |
| **Terrifying Aura** | MODULE | an aura: any enemy starting its turn inside saves (`EMANATIONS` trigger turnStart, off while Incapacitated); the 24-hour immunity is the table's |
| **Viral Aura** | MODULE | any creature starting its turn inside saves (`EMANATIONS`); the immunity is the table's |
| **Deathly Stench** | MODULE | any creature starting its turn inside saves (`EMANATIONS`) |
| **Possessive Aura** | MODULE | a creature ENDING its turn inside saves (`EMANATIONS` trigger turnEnd); the Charmed's repeat at its turn end is the pack's second save, used by hand |
| **Aura of Violence** | WAITS | a save at the source's turn end whose FAILURE is a forced Reaction attack, the damage only when nothing is in reach — the GM's read on each failure, held |
| **Protective Swarm** | WAITS | an area raised by the trait's use, lasting with Concentration — the spell kind on a monster's trait, its first customer |
| **Bolster Inventions** | WAITS | Temporary Hit Points to Construct allies inside at the turn end — a helpful pulse heal, its first customer |
| **Deflect Blow** | MODULE | a reduction of 1d10 for Laurie or a creature within 5 ft (`INTERRUPT_REDUCTIONS` `amount` + `ally`) |
| **Warp Mind** | WAITS | a Reaction to a Study action or a Concentration save — a cast-adjacent trigger, held |
| **Bloodthirsty Slash** | WAITS | a Reaction when an already-Bloodied creature within 40 ft takes damage — Bloodthirst's watch on a STATE, its first customer |
| **Cold Sprint** | MODULE | a Reaction to Cold damage (`REBUKES` `types`), the move and the attack from the sheet |
| **Transfer Harm** | OUT | the redirect kind (BACKLOG *Scoped out for good*) |
| **Redirect Attack** | OUT | the redirect kind |
| **Magic Allergy (Individual Form Only)** | OUT | cast-triggered |
| **Siphon Spell** | OUT | cast-triggered (Counterspell) |
| **Haunted Zone** | OUT | cast-triggered (the spell fails inside) |
| **Head Fruits** | TEXT | the allies' Reactions are their own |
| **Maneuver** | TEXT | an ally's Reaction move |
| **Inspiring Rally** | TEXT | the allies' Reaction moves |
| **Bolster Allies** | NATIVE | the pack's two effects; Adv. Next Attack's chip is a bend that already stood |
| **Curse of the All-Seeing Eye** | NATIVE | the pack's save and its thirteen typed curses — the pick is the GM's |
| **Ravenous Bites** | MODULE | the pack's attack (the Bloodied attack the GM's pick); the 1d8 at the Poisoned creature's turn start is `TURN_GRANTS` (Spores' row) |
| **Infestation** | NATIVE | the pack's attack and the hour-later save — the GM's |
| **Rotten Flesh** | NATIVE | the pack's attack, the Bloodied attack the GM's pick |
| **Swarming Bites (Swarm Form Only)** | NATIVE | the pack's attack, the Bloodied attack the GM's pick; the Attunement ended is the table's |
| **Tattoo of Osybus** | WAITS | a drop that revives with a random boon — Death Throes' side with a table, its first customer |
| **Meltable** | WAITS | an effect landed on taking Fire damage — a damage-typed trigger with no Reaction, its first customer |
| **Jiangshi Weaknesses** | TEXT | the reflection and the holy symbol are the table's |
| **Greater Lightning Absorption** | TEXT | the heal on Lightning damage is the GM's dice (the Monster Manual's Lightning Absorption) |
| **Loathsome Limbs** | TEXT | the GM's dice on a slashing hit, the limbs the sheet's |
| **Multiple Heads** | TEXT | the GM's dice — a head dies at 25+ damage in a turn |
| **Dreadful Impaling** | WAITS | the target's allies save on a hit — a hit's save at creatures other than the target, its first customer |
| **Trapped Ground** | WAITS | a placed area ending at the source's next turn end — the `area` kind with a turn clock, its first customer |
| **Implacable Advance** | NATIVE | the pack's save; the path is the table's |
| **Blood Puppeteering** | NATIVE | the pack's save; the Bloodied target is the GM's |
| **Vanishing Strike** | TEXT | an attack and a teleport |
| **Grasping Glob** | TEXT | uses another action |
| **Beguile** | NATIVE | a cast (Command) — the spell's own rows |
| **Esoteric Ward** | NATIVE | the pack's save, damage and Stunned |
| **Instill Dread** | NATIVE | the pack's save and Frightened |
| **Unraveling Flesh** | NATIVE | the pack's save and Frightened; the move is the table's |
| **Vampire Weakness** | MODULE | the Monster Manual's bend fires by name |
