# The PHB classes — the drawing (measured 2026-09-28)

> **What this is:** the verdict on every PHB class and subclass feature, class by class with its subclasses
> under it (the user's order, 2026-09-28), read against the evidence in [../classes/](../classes/) and the
> tables in `scripts/decide/registry.js`. The class is **every PHB class and subclass feature**
> ([[examples-are-classes]]): 352 rows in `dnd-players-handbook.classes` (12 classes, 48 subclasses) plus
> the 67 options nothing grants ([../options.md](../options.md)). The precedent row is named for every
> verdict, per [[land-by-mechanism-not-family]]; a UI-shaped item is ruled off a prototype before a line.
>
> **Verdicts:** NATIVE — the pack or the platform does it, nothing owed · ROW — a row in a table that
> exists · ROW+VOCAB — a row plus a facet the table does not have yet · KIND — a mechanism the module
> lacks · OUT — no combat moment the module judges (DESIGN §4), or a ruling. The slice order is not
> decided here — the user sets it once the DM and Monster Manual drawings land.

## What the twelve classes share — the vocabulary the drawing creates

The same dozen shapes recur across every class; the count is how many customers each has in the PHB
classes alone. **A shape with three or more customers is built once, as a table; a one-customer shape
waits for its player.**

| Shape | Customers | Precedent |
| --- | --- | --- |
| **The reroll kind** (SWEEP §3 item 5: reroll a failed save or a missed attack, with or without a bonus) | Indomitable, Fanatical Focus, Disciplined Survivor, Living Legend, Countercharm (an ally's save), Dark One's Own Luck (add a d10 after), Homing Strikes (add a die after a miss), Peerless Skill | `D20_FOLDS` (`precision`, `bardic`, `heroic`, `succeed`): a `reroll` kind beside them |
| **The hit menu's next groups** (RULINGS *The hit menu*) | Brutal Strike (+ the forgo-Advantage gate box), Stunning Strike, Open Hand Technique, Psionic Strike + Telekinetic Thrust, Hand of Harm (+ Physician's Touch), Elemental Attunement's push/pull, Hurl Through Hell, Eldritch Smite (a NEW cost kind: a spell slot) | `HIT_OPTIONS` / `HIT_GROUPS`; cost kinds today: sneak dice, a Focus Point, a Superiority Die, a use |
| **The `roll` interrupt's next customers** (Slice A's kind) | Cutting Words (and its damage half on `INTERRUPT_REDUCTIONS`), Guided Strike (+10), Cosmic Omen (±d6), Bend Luck (±d4), Combat Inspiration (its attack half), Restore Balance (NEUTRALISE Advantage/Disadvantage — a facet) | `INTERRUPT_ROLLS` |
| **Regain on Initiative** | Persistent Rage, Superior Inspiration, Uncanny Metabolism, Perfect Focus, Tandem Footwork (a GIVE to allies) | none — one table `INITIATIVE_GRANTS`, a hook at the roll the module already reads (`INITIATIVE_SWAPS`, Assassinate) |
| **A grant at the bearer's turn start** (temp HP, a heal) | Vitality of the Tree, Survivor's heal, Elder Champion's heal, Heroic Warrior's inspiration, Circle Forms' temp HP (on the shape-shift); Heroism (SWEEP §7) | `CLOCK_RIDERS` reads `turnStart` for damage; a `grant` facet (heal / tempHP / a chip) is the vocabulary |
| **A flat bonus to one spell damage roll** | Empowered Evocation, Elemental Affinity, Radiant Soul, Potent Spellcasting ×2 (measure: the pack says the bonus "is not" automatic) | none — one table `SPELL_DAMAGE_BONUS` on the damage-roll seam the riders use |
| **Emanation rows** | Aura of Devotion, Holy Nimbus (pulse + saves), Elder Champion (saves), Corona of Light (saves), Rage of the Wilds' Wolf, Branches of the Tree (alert + save), Wrath of the Sea (a chosen pulse), Avenging Angel (enter), Oceanic Gift (a bearer facet) | `EMANATIONS` feature rows; `pulse`, `alert`, `trigger` exist |
| **The kill moment, both sides** | victim: Relentless Rage (a rising-DC save facet), Undying Sentinel, Gift of the Protectors · killer: Dark One's Blessing | `DROP_TO_ONE` (Relentless Endurance, Death Ward); Slice B owns the rest |
| **Save bends by name** (Slice A's `saves` facet) | Danger Sense, Beguiling Twist, Psychic Defenses, Eldritch Mind, Eldritch Hex, Magical Ambush, Eldritch Strike, Mantle of Majesty (a `fails` facet, Trance's mirror), Spell Resistance (a `vsSpells` facet), Corona / Elder Champion / Holy Nimbus (through the emanation) | `EFFECT_BENDS` `saves` |
| **A damage-absorbing pool, automatic** | Arcane Ward (+ Projected Ward as its reaction), Bastion of Law | none — the `preApplyDamage` seam `DROP_TO_ONE` sits on; R1: no choice, no popup |
| **Advantage cancelled against the bearer** | Elusive, Trance of Order | `EFFECT_BENDS`: a `noAdvantage` facet the gate reads |
| **A floor under the d20** ("treat 9 or lower as 10") | Trance of Order, Starry Form's Dragon (Concentration saves) | the dice changers' floor (Elemental Adept) is on damage dice; a `floor` D20 fold is the vocabulary |
| **Concentration exemptions** | Relentless Hunter (no check from damage on Hunter's Mark) | the concentration machine: a `noCheck` row |

---

## Barbarian

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Rage** | effect (resistance, the damage bonus), uses | NATIVE for the numbers. The **early end** ("if you have neither attacked nor taken damage since your last turn") is nothing: ROW+VOCAB → a `turnEnd` judge on the effect table reading the turn chits (`TURN_CHITS` has attacked; damaged is the receipt's) — a reminder, never an automatic end (the Rage can be kept by a Bonus Action) |
| **Danger Sense** | effect | ROW → `EFFECT_BENDS` `saves` Dex Advantage (measure: if the pack's effect writes `flags.dnd5e.*` the platform may already roll it — Gnomish Cunning's shape) |
| **Brutal Strike** + **Improved** + **(2)** | effect, dmg | ROW+VOCAB → `HIT_OPTIONS` Brutal Strike group (Forceful Blow, Hamstring Blow; Staggering Blow = `saves` Disadvantage press, Sundering Blow = +5 to the next ally's attack, a `USE_CHIPS`-shaped give). The FORGO-ADVANTAGE trade is decided before the roll: a gate box (RULINGS *The hit menu*). Level 17's two picks is the array shape (the Goliath Battle Master trigger, SWEEP §6) |
| **Relentless Rage** | save, uses | ROW+VOCAB → `DROP_TO_ONE` with a `save` facet (DC 10 Con, +5 per use, resets on rest) — the drop machine asks Relentless Endurance today; this row rolls first |
| **Persistent Rage** | uses | ROW → `INITIATIVE_GRANTS` (the table above) |
| **Frenzy** (Berserker) | dmg | ROW → `CLOCK_RIDERS` (first hit of the turn, `while: Reckless`) |
| **Rage of the Wilds** (Wild Heart) | 2 effects | ROW → `EFFECT_CHOICES` (Bear / Eagle / Wolf at the Rage); the Wolf's allies' Advantage is an `EMANATIONS` feature row `while: raging` |
| **Power of the Wilds** (Wild Heart) | effect [prone] | ROW+VOCAB → Lion: an `EMANATIONS` row with a bend on OTHERS (Disadvantage on attacks not at the bearer); Ram: a no-save prone press on a hit (`CLOCK_RIDERS` `press`); Falcon: NATIVE (fly) |
| **Vitality of the Tree** (World Tree) | nothing | ROW+VOCAB → the turn-start `grant` facet (temp HP at the Rage and each turn) |
| **Branches of the Tree** (World Tree) | effect, save | ROW → `EMANATIONS` `alert` at a hostile's turn start within 30 ft, the reaction's save the activity's, `trigger` `oncePerTurn` |
| **Fanatical Focus** (Zealot) | text | ROW after the reroll kind |
| **Rage of the Gods** (Zealot) | effect | ROW+VOCAB → the reaction that takes an ally's damage within 30 ft: Interception's shape (`INTERRUPT_REDUCTIONS`) with `reach` and `all` |

**NATIVE:** Unarmored Defense, Weapon Mastery (the mastery machine), Reckless Attack (a row), Fast Movement, Feral Instinct (Initiative Advantage), Mindless Rage, Retaliation (`REBUKES`), Intimidating Presence (save, Frightened), Aspect of the Wilds, Battering Roots (reach), Divine Fury (`CLOCK_RIDERS`), Warrior of the Gods (a heal pool), Zealous Presence (a row).
**OUT:** Primal Knowledge, Instinctive Pounce, Indomitable Might (checks), Primal Champion, Animal Speaker, Nature Speaker, Travel Along the Tree.

## Bard

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Countercharm** | text | ROW after the reroll kind — an ALLY's failed save within 30 ft, a Reaction, the reroll with Advantage (a `reach` facet) |
| **Superior Inspiration** | text | ROW → `INITIATIVE_GRANTS` |
| **Cutting Words** (Lore) | text | ROW → `INTERRUPT_ROLLS` (subtract the Bardic die from an attack roll or a check within 60 ft) and `INTERRUPT_REDUCTIONS` (its damage half); the die from the Bardic pool — the `pool` facet Parry uses |
| **Peerless Skill** (Lore) | text | ROW after the reroll kind — the `bardic` fold on the bearer's OWN failed check or attack (today it folds into an ally's roll) |
| **Combat Inspiration** (Valor) | text | ROW → the attack half is the `bardic` D20 fold; the damage half a `bardic` damage fold; the AC half an `INTERRUPT_ROLLS`-shaped `ac` interrupt paid from the holder's die |
| **Battle Magic** (Valor) | text | ROW → a reminder after an action-cast (`REMINDER_KINDS`: a `chip` the turn end drops) |
| **Inspiring Movement** (Dance) | text | ROW → `EMANATIONS` `alert` when an ENEMY ends its turn within 5 ft — a reminder to move, the movement the player's |
| **Tandem Footwork** (Dance) | text | ROW → `INITIATIVE_GRANTS` as a GIVE (the die to allies' Initiative) |
| **Leading Evasion** (Dance) | text | ROW+VOCAB → `EVASION` with a `reach: 5` facet (allies within 5 ft share the verdict) |
| **Mantle of Majesty** (Glamour) | effect, uses | ROW → `EFFECT_BENDS` with a `fails` facet on Command's save while the target is Charmed by the bard — Trance's `succeeds` mirrored |
| **Unbreakable Majesty** (Glamour) | effect, save, uses | ROW after Sanctuary's gate (SWEEP §7): the attacker's Cha save before the attack, a fail wasting it |

**NATIVE:** Bardic Inspiration (the `bardic` fold), Jack of All Trades, Font of Inspiration, Dazzling Footwork (AC, the die as the unarmed damage), Beguiling Magic, Mantle of Inspiration (a use).
**OUT:** Expertise, Magical Secrets, Words of Creation, Bonus Proficiencies, Magical Discoveries, Martial Training, Agile Strikes.

## Cleric

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Blessed Strikes: Potent Spellcasting** / **Improved** | dmg | measure → `SPELL_DAMAGE_BONUS` if the pack does not add it; the level-14 temp HP to an ally on a cantrip a cast rider `grant` |
| **Disciple of Life** (Life) | nothing | ROW+VOCAB → `HEAL_REROLLS`'s machine with a `bonus` facet (2 + the slot level on a healing spell); one table, the healing seam |
| **Blessed Healer** (Life) | nothing | ROW → the same machine, a `self` facet (the caster heals 2 + the slot level when healing another) |
| **Supreme Healing** (Life) | text | ROW → the `max` facet (Beacon of Hope shares it, SWEEP §7) |
| **Improved Warding Flare** (Light) | nothing | ROW → a `heal` facet on the `INTERRUPT_ROLLS` row (the target of the flare's attack heals) |
| **Corona of Light** (Light) | effect, uses | ROW → `EMANATIONS` 30 ft harmful, `saves` Disadvantage against fire and radiant spells; the light a `TOKEN_LIGHTS` row |
| **Improved Duplicity** (Trickery) | nothing | ROW → the Invoke Duplicity bend gains `allies: true` (Shared Distraction); the heal at the illusion's end OUT |
| **Guided Strike** (War) | text | ROW → `INTERRUPT_ROLLS` +10, self or an ally within 30 ft, paid by Channel Divinity (`pool`) |
| **War Priest** (War) | uses | ROW → a reminder (`REMINDER_KINDS` `chip`) after the Attack action: the Bonus Action attack |

**NATIVE:** Channel Divinity / Turn Undead (save, Frightened + Incapacitated), Sear Undead, Blessed Strikes: Divine Strike (`CLOCK_RIDERS`), Preserve Life, Radiance of the Dawn, Warding Flare (a row), Blessing of the Trickster, Invoke Duplicity (a row), Avatar of Battle, War God's Blessing (a spell).
**OUT:** Divine Order, Divine Intervention, Greater Divine Intervention, the domain spell lists, Trickster's Transposition.

## Druid

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Elemental Fury: Potent Spellcasting** | text | measure → `SPELL_DAMAGE_BONUS` |
| **Nature's Sanctuary** (Land) | 4 effects [coverHalf] | measure → the cover machine reads walls and tokens (RULINGS *Measured cover*); a `coverHalf` STATUS is a third source — a facet, if the status is not read already |
| **Circle Forms** (Moon) | text | ROW → the turn-start `grant` machine, `on: shapeShift` (temp HP = three × the level) |
| **Lunar Form** (Moon) | dmg | ROW → `CLOCK_RIDERS` once per turn 2d10 radiant, `while: wildShape`, `targetDamaged` |
| **Wrath of the Sea** (Sea) | effect, save, dmg | ROW+VOCAB → `EMANATIONS` feature row with a CHOSEN pulse: once per turn the bearer picks one creature in the ring, the activity's save and push. Oceanic Gift moves the ring to an ally: a `bearer` facet |
| **Starry Form** (Stars) | 3 effects, atk, dmg | ROW → Archer NATIVE (the activity); Chalice: the healing machine's `also` facet (heal a second creature when a healing spell lands); Dragon: the `floor` D20 fold on Concentration saves |
| **Cosmic Omen** (Stars) | uses, text | ROW → `INTERRUPT_ROLLS` ±d6 within 30 ft, Weal / Woe read off the rest's roll (a stored flag) |

**NATIVE:** Wild Shape (the platform's transformation), Elemental Fury: Primal Strike (`CLOCK_RIDERS`), Improved Elemental Fury, Land's Aid, Nature's Ward, Improved Circle Forms (radiant), Moonlight Step (a row), Aquatic Affinity, Stormborn, Twinkling Constellations, Full of Stars.
**OUT:** Druidic, Primal Order, Wild Companion, Wild Resurgence, Beast Spells, Archdruid, the circle spell lists, Natural Recovery, Star Map, Stride / speeds.

## Fighter

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Indomitable** | uses, text | ROW after the reroll kind — the PHB customer (a failed save, + the Fighter level) |
| **Tactical Master** | effect | ROW+VOCAB → the mastery machine's `swap` facet: Push / Sap / Slow offered in place of the weapon's own property at the hit |
| **Studied Attacks** | text | ROW+VOCAB → `USE_CHIPS` armed by a MISS (SWEEP §3 item 8's new trigger): Advantage on the next attack against that creature |
| **Relentless** (Battle Master) | text | ROW → `SUPERIORITY_USES`: with none left, once per turn a d8 stands in |
| **Heroic Warrior** (Champion) | text | ROW → the turn-start `grant` (Heroic Inspiration if none) — a reminder + a sheet write the player confirms |
| **Survivor** (Champion) | effect | ROW → Defy Death: `EFFECT_BENDS` `saves` Advantage on death saves (measure: `flags.dnd5e` may carry it); Heroic Rally: the turn-start `grant` heal while Bloodied |
| **War Magic** / **Improved** (Eldritch Knight) | text | ROW → a reminder at the Attack action (replace one attack with a cantrip / a spell) |
| **Eldritch Strike** (Eldritch Knight) | effect | ROW → `EFFECT_BENDS` `saves` Disadvantage against the bearer's spells, the effect landed by the hit (the effect-riders seam) |
| **Psionic Power** (Psi Warrior) | dmg, uses | ROW → Protective Field: `INTERRUPT_REDUCTIONS` (die + Int, `reach: 30`, from the Psionic pool); Psionic Strike: `HIT_OPTIONS` (once per turn, a die); Telekinetic Movement OUT |
| **Telekinetic Adept** (Psi Warrior) | 2 effects [prone], save | ROW → Telekinetic Thrust: a follow-up on the Psionic Strike row (save or Prone / pushed); Psi-Powered Leap OUT |
| **Guarded Mind** (Psi Warrior) | text | ROW+VOCAB → a turn-start OFFER to end Charmed / Frightened by spending a die (the `grant` machine's `end` facet); the resistance NATIVE |
| **Bulwark of Force** (Psi Warrior) | effect [coverHalf] | measure with Nature's Sanctuary — the same `coverHalf` status |

**NATIVE:** Fighting Style (`FIGHTING_STYLES`), Second Wind, Action Surge, Tactical Mind (a fold), Two / Three Extra Attacks, Combat Superiority (the maneuvers), Improved / Ultimate Combat Superiority, Improved / Superior Critical (the crit range on the effect; the module's crit reads the roll), Remarkable Athlete (Initiative), Additional Fighting Style, War Bond, Telekinetic Master (a spell).
**OUT:** Tactical Shift, Student of War, Know Your Enemy, Arcane Charge.

## Monk

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Uncanny Metabolism** | uses | ROW → `INITIATIVE_GRANTS` (+ the Martial Arts die healed) |
| **Stunning Strike** | 2 effects [stunned], save | ROW → `HIT_OPTIONS` Monk group: once per turn, 1 Focus Point, the activity's Con save; on a success the pack's half effect (Advantage for the next attack) — the effect-riders seam |
| **Self-Restoration** | text | ROW+VOCAB → a turn-END offer to end Charmed / Frightened / Poisoned (the `grant` machine's `end` facet at `turnEnd`) |
| **Deflect Energy** | save, dmg | ROW → the Deflect Attacks `INTERRUPTS` row loses its type judge at level 13 (a `level` facet) |
| **Disciplined Survivor** | effect | ROW after the reroll kind (a failed save, 1 Focus Point) |
| **Perfect Focus** | text | ROW → `INITIATIVE_GRANTS` |
| **Hand of Harm** (Mercy) + **Physician's Touch** | dmg; effect [poisoned] | ROW → `HIT_OPTIONS` Mercy group (once per turn, 1 Focus Point, the die + Wis necrotic; Poisoned from level 6) |
| **Shadow Step** (Shadow) | text | ROW → `USE_CHIPS` (Advantage on the next melee attack after the teleport) — the pack ships no effect, the module's own chip |
| **Elemental Attunement** (Elements) | 3 effects, atk, dmg, save | ROW → the reach and the type NATIVE; the push / pull on a hit a `HIT_OPTIONS` row (the activity's save) |
| **Elemental Epitome** (Elements) | 6 effects, dmg | ROW → Empowered Strikes: `CLOCK_RIDERS` once per turn, the Martial Arts die; the resistance NATIVE; Destructive Stride OUT (movement) |
| **Open Hand Technique** (Open Hand) | 2 effects [prone], save | ROW → `HIT_OPTIONS` Open Hand group on a Flurry hit: Addle (no Reactions — an effect), Push, Topple (the save) |

**NATIVE:** Martial Arts (`UNARMED_DICE`), Monk's Focus (Flurry, Patient Defense, Step of the Wind), Unarmored Movement, Deflect Attacks (a row — measure the redirect strike's follow-up), Empowered Strikes, Evasion, Heightened Focus, Superior Defense, Hand of Healing, Shadow Arts, Cloak of Shadows, Elemental Burst, Wholeness of Body, Quivering Palm.
**OUT:** Slow Fall, Acrobatic Movement, Body and Mind, Implements of Mercy, Flurry of Healing and Harm (a substitution the player makes), Hand of Ultimate Mercy, Improved Shadow Step, Manipulate Elements, Stride of the Elements, Fleet Step.

## Paladin

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Radiant Strikes** | effect | measure → NATIVE if the pack's effect adds the 1d8; else `CLOCK_RIDERS` `when: any` (SWEEP §3 item 4) |
| **Sacred Weapon** (Devotion) | effect | measure → the +Cha NATIVE; the light a `TOKEN_LIGHTS` row |
| **Aura of Devotion** (Devotion) | effect | ROW → `EMANATIONS` (Charmed immunity — Aura of Courage's row with the status swapped) |
| **Smite of Protection** (Devotion) | effect [coverHalf] | ROW+VOCAB → a cast rider: after Divine Smite, half cover to allies in the aura until the next turn (the aura's `effect` facet, `on: cast`) |
| **Holy Nimbus** (Devotion) | effect, dmg, uses | ROW → `EMANATIONS` `pulse` at enemies' turn starts (Inner Radiance's shape) + `saves` Advantage against Fiends and Undead |
| **Inspiring Smite** (Glory) | nothing | ROW+VOCAB → a cast rider after Divine Smite: temp HP DISTRIBUTED among creatures within 30 ft — **UI-shaped, a prototype** (the smite itself stays out; this is the moment after it) |
| **Living Legend** (Glory) | effect, uses | ROW after the reroll kind (a missed attack once per turn; a failed save as a Reaction) |
| **Relentless Avenger** (Vengeance) | effect | ROW → `CLOCK_RIDERS` `on: opportunityAttack` — the pack's speed-0 effect landed by the hit; the move the player's |
| **Soul of Vengeance** (Vengeance) | text | ROW → `REBUKES` `after: attack` (Sentinel's shape) against the creature under the Vow |
| **Avenging Angel** (Vengeance) | 2 effects [frightened], save, uses | ROW → `EMANATIONS` `trigger on: enter` (the Frightened save), the flight NATIVE |
| **Undying Sentinel** (Ancients) | uses | ROW → `DROP_TO_ONE` (heal 3 × level, once per Long Rest) |
| **Elder Champion** (Ancients) | effect, uses | ROW → the turn-start `grant` heal + `EMANATIONS` `saves` Disadvantage against the paladin's spells and Channel Divinity |

**NATIVE:** Lay on Hands, Aura of Protection, Aura of Courage, Aura of Warding (rows), Abjure Foes, Aura Expansion, Peerless Athlete, Glorious Defense (a row), Vow of Enmity (a row), Nature's Wrath.
**OUT:** Paladin's Smite and Divine Smite (the smites, 2026-09-03), Faithful Steed, Restoring Touch, the oath spell lists, Aura of Alacrity (speed).

## Ranger

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Relentless Hunter** | text | ROW+VOCAB → the concentration machine's `noCheck` row (damage never asks for Hunter's Mark) |
| **Bestial Fury** (Beast Master) | dmg | measure → `CLOCK_RIDERS` on the COMPANION as bearer (the mark's extra damage); the second Beast's Strike OUT |
| **Beguiling Twist** (Fey Wanderer) | save | ROW → `EFFECT_BENDS` `saves` Advantage against Charmed / Frightened; the Reaction that turns a SUCCEEDED save within 120 ft onto another creature is ROW+VOCAB (a hold raised at a save verdict — the demand machine's seam) |
| **Stalker's Flurry** (Gloom Stalker) | save | ROW+VOCAB → a `then` facet on the Dreadful Strike row: Sudden Strike (a second attack against another creature) or Mass Fear (the activity's save within 15 ft) |
| **Hunter's Prey** (Hunter) | dmg | ROW → Colossus Slayer: `CLOCK_RIDERS` `targetDamaged` (SWEEP §3 item 4's example); Horde Breaker: a reminder chip (an extra attack against a different creature within 5 ft) |
| **Defensive Tactics** (Hunter) | effect | ROW → Escape the Horde: `EFFECT_BENDS` (Disadvantage on opportunity attacks against the bearer — the OA judge the ring uses); Multiattack Defense: ROW+VOCAB (an automatic `ac` interrupt +4 against the SAME attacker's later attacks this turn) |
| **Superior Hunter's Prey** (Hunter) | dmg | ROW+VOCAB → `CLOCK_RIDERS` with a SECOND target: the mark's damage to another creature within 30 ft (a target pick — the hit menu's pick machine) |
| **Superior Hunter's Defense** (Hunter) | 13 effects | ROW → `INTERRUPT_MULTIPLIERS` (Uncanny Dodge's shape, any damage type, resistance until the turn ends — the pack's effects are the 13 types) |

**NATIVE:** Favored Enemy (free casts), Roving, Tireless, Nature's Veil, Precise Hunter (a row), Feral Senses, Foe Slayer, Exceptional Training, Dreadful Strikes and Dread Ambusher (rows), Otherworldly Glamour, Umbral Sight, Iron Mind, Shadowy Dodge (a row).
**OUT:** Deft Explorer, Primal Companion (a summon), Share Spells, the subclass spell lists, Fey Reinforcements, Misty Wanderer, Hunter's Lore.

## Rogue

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Elusive** | text | ROW+VOCAB → `EFFECT_BENDS` `noAdvantage` (the gate cancels Advantage against the bearer; Trance of Order shares it) |
| **Stroke of Luck** | uses, text | ROW → the `succeed` D20 fold (`SAVE_SUCCEEDS`'s machine) widened to any D20 Test |
| **Magical Ambush** (Arcane Trickster) | text | ROW → `EFFECT_BENDS` `saves` Disadvantage when the CASTER is Invisible (a source-status judge) |
| **Versatile Trickster** (Arcane Trickster) | text | ROW → `ADVANTAGE_BUYS` (Advantage from the Mage Hand's distraction, a Cunning Strike option's shape) |
| **Envenom Weapons** (Assassin) | save, dmg | ROW → the Poison `CUNNING_OPTIONS` row gains 2d6 and the save's success no longer ends it (a `level` facet) |
| **Soul Blades** (Soulknife) | text | ROW → Homing Strikes after the reroll kind (add a Psionic die to a missed attack — Precision's shape, a different pool); Psychic Teleportation OUT |

**NATIVE:** Sneak Attack, Cunning Action, Steady Aim, Cunning Strike, Improved Cunning Strike, Devious Strikes, Uncanny Dodge (rows), Reliable Talent, Slippery Mind, Assassinate, Death Strike (rows), Psychic Blades, Psychic Veil, Rend Mind, Supreme Sneak (rows), Spell Thief (a save).
**OUT:** Thieves' Cant, Mage Hand Legerdemain, Assassin's Tools, Infiltration Expertise, Fast Hands, Second-Story Work, Use Magic Device, Thief's Reflexes (two turns in round one — the tracker's, not a moment).

## Sorcerer

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Psychic Defenses** (Aberrant) | text | ROW → `EFFECT_BENDS` `saves` Advantage against Charmed / Frightened |
| **Restore Balance** (Clockwork) | uses, text | ROW+VOCAB → `INTERRUPT_ROLLS` with a `neutralise` facet (Advantage and Disadvantage both cancelled on a roll within 60 ft) |
| **Bastion of Law** (Clockwork) | effect | ROW+VOCAB → the damage-absorbing pool (a ward of d8s the bearer spends at damage) — Arcane Ward's machine, a second customer |
| **Trance of Order** (Clockwork) | effect, uses | ROW after two vocabulary items: `noAdvantage` (Elusive) and the `floor` fold (Starry Form's Dragon) |
| **Elemental Affinity** (Draconic) | dmg | ROW → `SPELL_DAMAGE_BONUS` (+Cha to one damage roll of the type, once per spell) |
| **Tides of Chaos** (Wild Magic) | uses, text | ROW → `ADVANTAGE_BUYS` (Advantage on one D20 Test before the roll, the use regained by a surge) |
| **Wild Magic Surge** + **Tamed Surge** (Wild Magic) | text | ROW+VOCAB → a cast rider: a d20 after a slot cast, a 20 rolls the surge table (the platform's rolltable); Tamed Surge is the same rider with a pick — **UI-shaped, a prototype** |
| **Bend Luck** (Wild Magic) | text | ROW → `INTERRUPT_ROLLS` ±1d4 on another creature's roll within 60 ft |

**NATIVE:** Innate Sorcery (a row), Font of Magic, Metamagic (all ten), Revelation in Flesh, Warping Implosion, Draconic Resilience, Dragon Wings, Controlled Chaos (the table roll).
**OUT:** Sorcerous Restoration, Sorcery Incarnate, Arcane Apotheosis, the subclass spell lists, Telepathic Speech, Psionic Sorcery, Clockwork Cavalcade, Dragon Companion.

## Warlock

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Misty Escape** (Archfey) | effect [invisible], save, dmg | ROW+VOCAB → a Reaction raised when the bearer TAKES damage (the `REBUKES` seam) that casts Misty Step, with the Steps of the Fey rider |
| **Beguiling Defenses** (Archfey) | save, uses | ROW+VOCAB → a Reaction raised when the bearer is DEMANDED a Charmed / Frightened save: the demand's seam; the reflected save the activity's |
| **Radiant Soul** (Celestial) | dmg | ROW → `SPELL_DAMAGE_BONUS` (+Cha to one radiant or fire roll per turn) |
| **Searing Vengeance** (Celestial) | effect [blinded], dmg, uses | ROW+VOCAB → a trigger at a DEATH SAVE (the bearer's or an ally's within 60 ft) — the drop machine's neighbour; the burst the activity's |
| **Dark One's Blessing** (Fiend) | nothing | ROW+VOCAB → the KILLER's side of the kill moment (temp HP when the bearer drops an enemy to 0) — Slice B's machine, a player customer |
| **Dark One's Own Luck** (Fiend) | uses, text | ROW after the reroll kind (add a d10 to a check or save after the roll) |
| **Hurl Through Hell** (Fiend) | save, dmg, uses | ROW → `HIT_OPTIONS` (once per turn on a hit; the activity's save; the removal is the effect's) |
| **Psychic Spells** (Great Old One) | text | ROW+VOCAB → the Transmuted type pick's machine (`TRANSMUTED_TYPES`) as a standing option: any Warlock damage spell to Psychic, no Sorcery Point; the components half OUT |
| **Eldritch Hex** (Great Old One) | text | ROW → `EFFECT_BENDS` `saves` Disadvantage on the Hexed ability, keyed to Hex's effect |

**NATIVE:** Pact Magic, Steps of the Fey (the bend is a row; the temp HP the pack's), Healing Light, Fiendish Resilience, Clairvoyant Combatant (a row), Thought Shield, Create Thrall (a summon; its extra damage measure).
**OUT:** Eldritch Invocations (the list — see options), Magical Cunning, Contact Patron, Mystic Arcanum, Eldritch Master, the patron spell lists, Bewitching Magic, Celestial Resilience, Awakened Mind.

## Wizard

| Feature | The pack carries | Verdict → where |
| --- | --- | --- |
| **Arcane Ward** (Abjurer) | uses, text | ROW+VOCAB → the damage-absorbing pool at `preApplyDamage`, automatic (R1: the ward has no choice), refilled by Abjuration casts — the first customer of the shape |
| **Projected Ward** (Abjurer) | text | ROW → the pool's Reaction: `INTERRUPT_REDUCTIONS` `reach: 30` drawing from the ward |
| **Spell Resistance** (Abjurer) | text | ROW+VOCAB → `EFFECT_BENDS` `saves` Advantage with a `vsSpells` judge (the demand knows its source is a spell); the resistance NATIVE |
| **Portent** + **Greater Portent** (Diviner) | uses, text | ROW+VOCAB → a `set` D20 fold: replace a roll the bearer can see with a stored die (two or three, rolled at the rest) — **UI-shaped, a prototype** (the dice chips the gate already draws) |
| **Potent Cantrip** (Evoker) | text | ROW+VOCAB → the verdict's half rule per CASTER feature (Evasion's mirror: a cantrip's successful save still takes half) |
| **Sculpt Spells** (Evoker) | text | ROW → Careful Spell's machine (`METAMAGIC`'s area ask) as a feature row: 1 + the slot level chosen creatures succeed and take nothing |
| **Empowered Evocation** (Evoker) | dmg | ROW → `SPELL_DAMAGE_BONUS` (+Int to one damage roll of an Evocation) |
| **Overchannel** (Evoker) | dmg, uses | ROW+VOCAB → the dice changers' `max` (Empowered's popup) + a self-damage clock on the second use per rest — waits for a customer |

**NATIVE:** Spell Mastery, Signature Spells (free casts), The Third Eye, Illusory Self (a row), Greater Portent (the third die).
**OUT:** Arcane Recovery, Ritual Adept, Scholar, Memorize Spell, the savants, Spell Breaker (spells), Expert Divination, Improved Illusions, Phantasmal Creatures, Illusory Reality.

## The options nothing grants (Warlock invocations; the maneuvers and metamagic are done)

| Option | The pack carries | Verdict → where |
| --- | --- | --- |
| **Repelling Blast** | effect | ROW → `CLOCK_RIDERS` `press: push 10` on an Eldritch Blast hit (no cost, every beam) |
| **Eldritch Smite** | dmg | ROW+VOCAB → `HIT_OPTIONS` with a NEW cost kind, a Pact slot: +1d8 per slot level force, Prone if Huge or smaller |
| **Lifedrinker** | dmg | ROW → `CLOCK_RIDERS` once per turn on a pact-weapon hit (1d6 necrotic / psychic / radiant, the pick a type facet) |
| **Eldritch Mind** | effect | ROW → `EFFECT_BENDS` `saves` Advantage on Concentration saves (measure: `flags.dnd5e.concentrationAdvantage` may be native) |
| **Gift of the Protectors** | uses, text | ROW → `DROP_TO_ONE` for the NAMED creatures (the tome's list) |
| **Lunging Attack** (maneuver) | dmg | ROW → `USE_CHIPS` (Dash, then the die on a melee hit this turn) |
| **Evasive Footwork** (maneuver) | effect | measure → the die as AC until the turn ends — NATIVE if the pack's effect rolls it |
| **Bait and Switch** (maneuver) | 12 effects | NATIVE (the swap is movement; the AC bonus an effect) |

**NATIVE:** Agonizing Blast, Eldritch Spear, Devil's Sight, Fiendish Vigor, Thirsting Blade, Devouring Blade, Witch Sight, Pact of the Blade / Chain / Tome, the ten metamagic options, the on-hit and fold maneuvers (rows), Rally, Ambush, Tactical Assessment, Commanding Presence.
**OUT:** the utility invocations (Armor of Shadows, Mask of Many Faces, Misty Visions, Otherworldly Leap, Ascendant Step, Gaze of Two Minds, Gift of the Depths, Master of Myriad Forms, One with Shadows, Whispers of the Grave, Visions of Distant Realms, Lessons of the First Ones), Investment of the Chain Master (the familiar), Epic Boon (out by ruling).

---

## The tally, by class

| Class | Rows in a table that exists | Rows needing a facet | Waits for a kind | UI-shaped (prototype first) |
| --- | --- | --- | --- | --- |
| Barbarian | 6 | 6 | Fanatical Focus | Brutal Strike's gate box |
| Bard | 8 | 1 | Countercharm, Peerless Skill | — |
| Cleric | 6 | 2 | — | — |
| Druid | 4 | 2 | — | — |
| Fighter | 8 | 4 | Indomitable | — |
| Monk | 10 | 1 | Disciplined Survivor | — |
| Paladin | 9 | 2 | Living Legend | Inspiring Smite |
| Ranger | 6 | 4 | — | — |
| Rogue | 4 | 1 | Homing Strikes | — |
| Sorcerer | 5 | 3 | — | Wild Magic Surge |
| Warlock | 4 | 5 | Dark One's Own Luck | — |
| Wizard | 3 | 4 | — | Portent |
| Options | 6 | 1 | — | — |

**The one kind the classes ask for is the reroll kind** (eight customers). Everything else is rows and
facets on tables that exist, and the four prototypes. The order between classes is the user's, set by
the next party (BACKLOG *The long-term order* step 5): this drawing is the map, not the commission.
