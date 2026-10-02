# Heroes of Faerûn — the register

> Generated 2026-10-02 by `tools/audit-splat-register.mjs faerun` from the OFFLINE corpus (`tools/scan-corpus-offline.mjs`, every pack of
> `dnd-heroes-faerun`, 122 rows) joined with `scripts/decide/registry.js`, RULINGS' walk tables and bend registers, and the
> drawing's hand verdicts ([drawings/splat-faerun.md](drawings/splat-faerun.md) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.
>
> **In scope**: NATIVE — the pack and the platform resolve it (the sheet's effects, the saves machine, the applier, the gate and the
> receipts already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS section to read); ROW — a row
> on a machine that exists, to build, the precedent named; TABLE — a new table that is not a kind; KIND — a new kind (the R4 tripwire
> moves); **WAITS** — drawn on a machine that exists, held for its first customer or a measurement; TEXT — a paragraph only, or no combat
> mechanism; OUT — held out by a ruling, the reason in *Why not*. **Kind**: species · subclass (its feature, the subclass named) · option
> (nothing grants it) · feat · spell · item · gift · monster (the bestiary's traits, actions and reactions, one row per name).

**122 rows (42 subclasss · 34 feats · 19 spells · 21 items · 6 monsters): 16 NATIVE · 31 MODULE · 0 ROW · 0 TABLE · 0 KIND · 41 TEXT · 18 OUT · 16 WAITS.**

| Kind | Row | Where | Families | In scope | Why not / how | Rule of cool / bend | Walked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| subclass | **Group Recovery** | Banneret | temp-hp | WAITS | each chosen ally regains Hit Points after Second Wind — a hand-out of HEALING to several, its first customer (Inspiring Smite divides Temporary Hit Points) | — | — |
| subclass | **Inspiring Commander** | Banneret | resist | TEXT | the scale and the immunities are the pack's | — | — |
| subclass | **Knightly Envoy** | Banneret | — | TEXT | social | — | — |
| subclass | **Rallying Surge** | Banneret | reaction, movement | TEXT | the allies' Reactions are their own, from the sheet | — | — |
| subclass | **Shared Resilience** | Banneret | reaction, d20-fold | MODULE | `INTERRUPT_ROLLS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| subclass | **Team Tactics** | Banneret | clock | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| subclass | **Bladesong** | Bladesinger | concentration, movement | NATIVE | the pack's effect | — | — |
| subclass | **Extra Attack** | Bladesinger | — | TEXT | action economy | — | — |
| subclass | **Song of Defense** | Bladesinger | interrupt, reaction | WAITS | a reduction paid with a SPELL SLOT (five times its level) — `INTERRUPT_REDUCTIONS` with a slot pool, its first customer | — | — |
| subclass | **Song of Victory** | Bladesinger | — | TEXT | action economy | — | — |
| subclass | **Training in War and Song** | Bladesinger | — | TEXT | proficiencies | — | — |
| subclass | **Blessing of Moonlight** | College of the Moon | half-on-save | WAITS | a heal to another creature whenever a Moonbeam save FAILS — a save-triggered gift, its first customer | — | — |
| subclass | **Eventide's Splendor** | College of the Moon | clock, reaction | NATIVE | the pack's effects and uses | — | — |
| subclass | **Moon's Inspiration** | College of the Moon | clock | WAITS | Lunar Vitality: a heal raised by a Bardic die spent — a heal offer paid by a die, its first customer; Inspired Eclipse is the pack's effect and a teleport | — | — |
| subclass | **Primal Lore** | College of the Moon | — | TEXT | a cantrip | — | — |
| subclass | **Blessings of Knowledge** | Knowledge Domain | — | TEXT | proficiencies | — | — |
| subclass | **Divine Foreknowledge** | Knowledge Domain | — | NATIVE | the pack's Advantage effect | — | — |
| subclass | **Knowledge Domain Spells** | Knowledge Domain | — | TEXT | a spell list | — | — |
| subclass | **Mind Magic** | Knowledge Domain | — | TEXT | telepathy from the sheet | — | — |
| subclass | **Unfettered Mind** | Knowledge Domain | — | NATIVE | the pack's effect | — | — |
| subclass | **Aura of Elemental Shielding** | Oath of the Noble Genies | resist | WAITS | an aura whose member effect is one of five by the paladin's pick — the emanation's `effect` as a choice, its first customer | — | — |
| subclass | **Elemental Rebuke** | Oath of the Noble Genies | interrupt, reaction, press-condition, half-on-save | MODULE | `INTERRUPT_MULTIPLIERS` (hold/; RULINGS *The reaction hold*); `INTERRUPTS` (hold/; RULINGS *The reaction hold*) | — | — |
| subclass | **Elemental Smite** | Oath of the Noble Genies | clock, press-condition, resist | WAITS | after Divine Smite, a Channel Divinity for one of four effects at the smite's target — Inspiring Smite's `after` with a pick of activities, its first customer | — | — |
| subclass | **Genie Spells** | Oath of the Noble Genies | — | TEXT | a spell list | — | — |
| subclass | **Genie's Splendor** | Oath of the Noble Genies | ac-passive | NATIVE | the AC formula is the pack's effect | — | — |
| subclass | **Noble Scion** | Oath of the Noble Genies | reaction | WAITS | Minor Wish: a failed D20 Test of yours or an aura ally's made a success — a `succeed` bend on the bystander table, its first customer; the flight is the pack's | — | — |
| subclass | **Aura of Malevolence** | Scion of the Three | — | TEXT | damage around a teleport — the table's | — | — |
| subclass | **Bloodthirst** | Scion of the Three | reaction | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — the Bloodied moment watched (`judge: "enemyBloodied"`); the teleport and the melee attack from the sheet | — | — |
| subclass | **Dread Allegiance** | Scion of the Three | resist | NATIVE | the pack's resistance and cantrip | — | — |
| subclass | **Dread Incarnate** | Scion of the Three | — | NATIVE | Murderous Intent is the pack's effect; Cutthroat a rest | — | — |
| subclass | **Strike Fear** | Scion of the Three | bend-attack, press-condition | MODULE | `REPEAT_SAVES` (repeat-saves.js; RULINGS *The spells slice — Tiers 1 and 2*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| subclass | **Absorb Spells** | Spellfire Sorcery | — | OUT | cast-triggered (Counterspell's save) | — | — |
| subclass | **Crown of Spellfire** | Spellfire Sorcery | clock, interrupt, reaction, half-on-save | MODULE | `EVASIONS` (saves/consequences.js; RULINGS *The GM's side — the five shapes*) — Spell Avoidance is `EVASIONS` against spells while the crown stands; Burning Life Force WAITS (a reduction paid in Hit Point Dice, its first customer); the flight is the pack's | — | — |
| subclass | **Honed Spellfire** | Spellfire Sorcery | temp-hp | OUT | cast-triggered | — | — |
| subclass | **Spellfire Burst** | Spellfire Sorcery | clock, temp-hp | OUT | cast-triggered (BACKLOG *Scoped out for good*) | — | — |
| subclass | **Spellfire Spells** | Spellfire Sorcery | — | TEXT | a spell list | — | — |
| subclass | **Chilling Retribution** | Winter Walker | clock, interrupt, reaction, press-condition | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) | — | — |
| subclass | **Fortifying Soul** | Winter Walker | bend-save, temp-hp | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| subclass | **Frigid Explorer** | Winter Walker | rider-damage, clock, resist | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*); `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) | — | — |
| subclass | **Frozen Haunt** | Winter Walker | resist, movement | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| subclass | **Hunter's Rime** | Winter Walker | temp-hp | MODULE | `CAST_RIDERS` | — | — |
| subclass | **Winter Walker Spells** | Winter Walker | — | TEXT | a spell list | — | — |
| feat | **Cult of the Dragon Initiate** |  | clock, press-condition, resist | NATIVE | Dragon's Terror is the pack's save and Frightened; Inspired by Fear is the table's | — | — |
| feat | **Emerald Enclave Fledgling** |  | press-condition, movement | TEXT | the Help action | — | — |
| feat | **Harper Agent** |  | — | TEXT | social | — | — |
| feat | **Lords' Alliance Agent** |  | bend-attack, clock, use-chip, crit, aura | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Reassert Honor's chip is `EFFECT_BENDS` "Adv. Next Attack"; Inspiring Strike WAITS (Heroic Inspiration to an ally on a crit, its first customer) | — | — |
| feat | **Purple Dragon Rook** |  | — | WAITS | Rallying Cry: Heroic Inspiration to up to PB creatures at Initiative — the rest song's give at Initiative, its first customer | — | — |
| feat | **Spellfire Spark** |  | clock | WAITS | Magic Absorption: 1d4 off spell damage once per turn — a reduction against spell damage alone, its first customer | — | — |
| feat | **Tyro of the Gauntlet** |  | bend-attack, interrupt, reaction, use-chip, aura | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Vigilant's chip is `EFFECT_BENDS` "Vigilant"; Stand as One is the table's | — | — |
| feat | **Zhentarim Ruffian** |  | movement | WAITS | Exploit Opening: an Opportunity Attack's damage rolled twice — Savage Attacker's `DAMAGE_EITHER` with an opportunity judge, its first customer | — | — |
| feat | **Boon of Bloodshed** | level 19 | bend-attack, rider-damage, clock, use-chip | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Killer's Fortune's chip is keyed; Power from Pain WAITS — the epic boons are a slice of their own (BACKLOG) | — | — |
| feat | **Boon of Bountiful Health** | level 19 | temp-hp | OUT | an epic boon — BACKLOG *The epic boons — every book's* | — | — |
| feat | **Boon of Communication** | level 19 | — | OUT | an epic boon | — | — |
| feat | **Boon of Desperate Resilience** | level 19 | resist | OUT | an epic boon | — | — |
| feat | **Boon of Exquisite Radiance** | level 19 | — | OUT | an epic boon | — | — |
| feat | **Boon of Fluid Forms** | level 19 | temp-hp | OUT | an epic boon | — | — |
| feat | **Boon of Fortune’s Favor** | level 19 | clock, d20-fold | OUT | an epic boon | — | — |
| feat | **Boon of Poison Mastery** | level 19 | clock, resist | OUT | an epic boon | — | — |
| feat | **Boon of Revelry** | level 19 | press-condition, concentration | OUT | an epic boon | — | — |
| feat | **Boon of Terror** | level 19 | press-condition, aura, resist | OUT | an epic boon | — | — |
| feat | **Boon of the Bright Sun** | level 19 | temp-hp | OUT | an epic boon | — | — |
| feat | **Boon of the Furious Storm** | level 19 | bend-save, resist | OUT | an epic boon | — | — |
| feat | **Boon of the Soul Drinker** | level 19 | interrupt, reaction, temp-hp, aura, resist | OUT | an epic boon | — | — |
| feat | **Cold Caster** | level 4 | clock | WAITS | Frostbite: −1d4 on the target's next save — a landed penalty die, its first customer | — | — |
| feat | **Dragonscarred** | level 4 | resist | NATIVE | the pack's resistance and save | — | — |
| feat | **Enclave Magic** | level 4 | concentration | TEXT | spells and concentration — the sheet's | — | — |
| feat | **Fairy Trickster** | level 4 | bend-save, clock, press-condition, movement | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*); `CLOCK_RIDERS` (clock-riders.js; RULINGS *Rulings the code carried · The hit's sequence*) — Flustering Strike rides the hit (`CLOCK_RIDERS` `activities`); Faerie Trod Trotter is movement | — | — |
| feat | **Genie Magic** | level 4 | — | TEXT | Wish Magic — the table's | — | — |
| feat | **Harper Teamwork** | level 4 | bend-save, press-condition | TEXT | the Help action; Inspiring Willpower is the table's | — | — |
| feat | **Lordly Resolve** | level 4 | bend-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Bolstered's save Advantage; the Reaction to stand and the immunity are the table's | — | — |
| feat | **Mythal Touched** | level 4 | reaction | WAITS | Mythal Ward: a Reaction rolling on a table when a spell hits or a save fails — a cast-triggered-shaped reaction with a RollTable, its first customer | — | — |
| feat | **Order’s Resilience** | level 4 | bend-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Stronger Together's Strength-save Advantage; Resurge is movement | — | — |
| feat | **Purple Dragon Commandant** | level 4 | bend-attack, temp-hp | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Last Stand fires by name; Encourage Ally is the pack's heal | — | — |
| feat | **Spellfire Adept** | level 4 | clock, resist | MODULE | `DAMAGE_RULES` (damage-rules.js; RULINGS *The fighting styles*) — Searing Spellfire ignores Radiant Resistance; Fueled Spellfire WAITS (Hit Point Dice added to a spell's damage, its first customer) | — | — |
| feat | **Street Justice** | level 4 | bend-attack | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) — Headlock fires by name | — | — |
| feat | **Zhentarim Tactics** | level 4 | — | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — Retaliate is a rebuke on a melee hit — an Opportunity Attack; Versatile Merc is a rest | — | — |
| spell | **Spellfire Flare** | level 1 | — | WAITS | a spell attack that ignores Half and Three-Quarters Cover — the cover measure's spell facet, its first customer | — | — |
| spell | **Wardaway** | level 1 | bend-save, rider-damage, clock, press-condition, half-on-save | NATIVE | the pack's save and Disoriented; "an action or a Bonus Action, not both" is the table's | — | — |
| spell | **Death Armor** | level 2 | bend-save, clock | MODULE | `DAMAGE_SHIELDS` (damage-shields.js; RULINGS *Damage shields*) | — | — |
| spell | **Deryan's Helpful Homunculi** | level 2 | — | OUT | summons-shaped — GitHub issue #1 | — | — |
| spell | **Elminster's Elusion** | level 2 | bend-save, half-on-save | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| spell | **Cacophonic Shield** | level 3 | bend-attack, rider-damage, clock, press-condition, half-on-save, resist | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*); `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| spell | **Conjure Constructs** | level 3 | press-condition, half-on-save, temp-hp | OUT | summons-shaped — GitHub issue #1 | — | — |
| spell | **Laeral's Silver Lance** | level 3 | rider-damage, press-condition, half-on-save | MODULE | `CHOSEN_AREAS` (saves/demand.js; RULINGS *Spells that choose their targets*) | — | — |
| spell | **Syluné's Viper** | level 3 | clock, press-condition, temp-hp, movement | NATIVE | the pack's Temporary Hit Points, attack and Venom | — | — |
| spell | **Backlash** | level 4 | interrupt, reaction, press-condition, half-on-save | WAITS | a Reaction spell reducing damage by 4d6 + mod, then the dealer's save — a damage interrupt with a reduction the pack does not roll, its first customer | — | — |
| spell | **Doomtide** | level 4 | clock, press-condition, half-on-save, concentration | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| spell | **Spellfire Storm** | level 4 | rider-damage, clock, press-condition, half-on-save, concentration | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| spell | **Alustriel’s Mooncloak** | level 5 | interrupt, reaction, temp-hp, resist | WAITS | the Cast names an effect the pack does not ship (a data defect for Errata 5e); Liberation is a `succeed` against named conditions, its first customer | — | — |
| spell | **Songal's Elemental Suffusion** | level 5 | press-condition, half-on-save, concentration, resist | WAITS | a save demanded of everyone inside at the CASTER's turn start — the emanation's demand on sourceTurnStart, its first customer | — | — |
| spell | **Dirge** | level 6 | clock, press-condition, half-on-save, concentration, temp-hp | MODULE | `EMANATIONS` (emanations.js; RULINGS *Emanations · The spells slice — Tier 3 · the held spells*) | — | — |
| spell | **Elminster's Effulgent Spheres** | level 6 | clock, reaction, resist | MODULE | `REBUKES` (rebukes.js; RULINGS *A listed reaction cast freestanding · The PHB feats — groups 4–6*) — Absorb Energy is a rebuke on elemental damage; Energy Blast is the sheet's attack | — | — |
| spell | **Simbul's Synostodweomer** | level 7 | temp-hp | OUT | cast-triggered | — | — |
| spell | **Holy Star of Mystra** | level 8 | reaction | NATIVE | the attack and the Three-Quarters Cover status; the Reaction against a spell WAITS (the redirect's cousin) | — | — |
| spell | **Blade of Disaster** | level 9 | crit | NATIVE | the summoned blade's attacks; its 18-to-crit is the pack's own to set on the attack | — | — |
| item | **Adventurer's Ring** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Bandore** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Black Coach Service** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Bright Fungal Cloak** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Cittern** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Covered Wagon** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Desert Clothing** |  | bend-save | TEXT | an environmental save | — | — |
| item | **Devil Mask** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Domestic Wonder** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Garb of Light and Shadow** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Genie Robe** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Locking Spellbook** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Mechanical Wonder** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Monster Camouflage** |  | bend-save | TEXT | a disguise | — | — |
| item | **Prosthetic Limb** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Sled Services** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Thayan Spell Tattoo** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Warm Fungal Clothing** |  | bend-save | TEXT | an environmental save | — | — |
| item | **Windskiff** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Winter Camouflage** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| item | **Yarting** |  | — | TEXT | no mechanism to play — the pack ships a paragraph | — | — |
| monster | **Beak** | actors | — | NATIVE | the pack resolves it: an attack | — | — |
| monster | **Command** | actors | half-on-save | NATIVE | the construct's Clockwork Force save and Orderly Ward — the SPELL's press no longer answers it | bend | — |
| monster | **Mechanical Determination** | actors | crit | MODULE | `DROP_TO_ONE` (drop-to-one.js; RULINGS *The species walk, continued*) — Undead Fortitude's save with Lightning | — | — |
| monster | **Move and Attack** | actors | — | NATIVE | the blade's attacks | — | — |
| monster | **Pack Tactics** | actors | bend-attack | MODULE | `EFFECT_BENDS` (reminders.js; RULINGS *The gate before the roll*) | — | — |
| monster | **Wind-Up Operation** | actors | — | TEXT | narrative | — | — |
