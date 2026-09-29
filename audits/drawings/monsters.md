# The Monster Manual — the drawing (measured 2026-09-28)

> **What this is:** the verdict on the 2025 Monster Manual's traits, read against the evidence in
> [../monsters.md](../monsters.md): 675 rows in `dnd-monster-manual.features` (the SRD 2024 subset
> deduplicated under it), 251 with a family, 64 of those text-only, 35 named in the registry. This is
> Slice B's ground (BACKLOG *The long-term order*, step 4b). The precedent row is named per
> [[land-by-mechanism-not-family]]. ⚠ **The 2025 book is not the 2014 one:** *Relentless*, *Reckless*,
> *Brute*, *Martial Advantage* and *Legendary Actions* as items are not in it — BACKLOG's Slice B list
> named Relentless from memory; the kill moment's monster customer is **Undead Fortitude alone**.
>
> **The finding:** the packs own the traits even more than they own the spells. 84 half-on-save rows,
> the breath weapons, gazes, songs and bursts are save activities the demand machine already runs; 74
> clock rows are the effects' own durations; the "casts X" text rows are casts. **What the GM's side
> owes is five shapes**, three of which the classes drawing already created.

## The five shapes

| Shape | Customers in the book | Precedent → where |
| --- | --- | --- |
| **The kill moment, the victim's side** | **Undead Fortitude** (a Con save, DC 5 + the damage, never against Radiant or a Critical Hit; a success drops to 1) | `DROP_TO_ONE` (Relentless Endurance asked, Death Ward automatic): a `save` facet with `dc: "5 + damage"` and `unless: [radiant, crit]` — Relentless Rage's rising-DC facet is the sibling |
| **The kill moment, the death's side** | **Death Throes** (an Emanation save when it dies), Multiple Heads (a head dies at 25+ in a turn — measure), Split (a reaction to slashing while Large+: a summon, the GM's) | a `died` trigger on the drop seam, the activity's save at the corpse — ROW+VOCAB; the classes' Dark One's Blessing is the killer's side of the same moment |
| **Save bends against magic** | **Magic Resistance** (Advantage), **Greater Magic Resistance** (auto-succeed, and spell attacks auto-miss), Poison Tolerant (Dwarven Resilience's row), Fey Ancestry (a row already), Avoidance (Evasion's shape: none on a success, half on a fail — an `EVASION` row) | `EFFECT_BENDS` `saves` with the **`vsSpells` judge** the classes' Spell Resistance and six DMG items want: the facet has nine customers across three books |
| **Legendary Resistance** | every legendary creature: a failed save chosen to succeed, N per day | `SAVE_SUCCEEDS` (Mage Slayer's Guarded Mind: offered on a demanded save before its verdict) with the pool read off `resources.legres` — ROW+VOCAB (the pool facet). ⚠ The GM's choice, never automatic (R1) |
| **A heal at the turn start** | **Regeneration** (N HP at each turn start while above 0; the troll's `unless` damaged by fire or acid since its last turn) | the turn-start `grant` facet the classes drawing created (Survivor, Elder Champion, Vitality of the Tree, Heroism): Regeneration is its GM customer, with an `unless: damagedBy` judge read off the receipts |

## The rows — everything else that is not NATIVE or OUT

| Trait | The pack carries | Verdict → where |
| --- | --- | --- |
| **Displacement**, **Blurred Form** | text | ROW → `EFFECT_BENDS` (attacks against the bearer at Disadvantage), off while Incapacitated — the emanations' `incapacitated` switch, a facet here |
| **Aura of Authority** | text | ROW → `EMANATIONS` feature row, helpful (allies' Advantage while within it) |
| **Fear Aura**, **Fetid Aura**, **Stench**, **Sickening Vapors**, **Vile Appearance**, **Horror Nimbus**, **Horrific Visage**, **Lordly Presence** | effect, save | ROW → `EMANATIONS` harmful rows `trigger on: turnStart` (Spirit Guardians' cousin: a save when a creature starts its turn in the ring); the immunity-after-success clause the effect's own |
| **Life Suppression**, **Negative Energy Cone** | text | OUT for now → a `noHealing` area facet the healing machine would read; no customer at the table |
| **Reactive** | text | ROW+VOCAB → the Reaction chip refreshes at every turn (the chip machine's `everyTurn` facet) |
| **Deflect Missile** | save, dmg, uses | ROW → `INTERRUPT_REDUCTIONS` (Deflect Attacks' shape: ranged only, the redirect the activity's) |
| **Warding Charm**, **Jinx**, **Toxic Escape**, **Counterattack**, **Defensive Stance**, **Whirlwind of Sand** | save / effect | ROW → `REBUKES` / `INTERRUPTS` on-hit reactions (four are rows already; Warding Charm and Jinx add a save the activity carries) |
| **Sticky Shield** | effect [grappled], save | ROW → `REBUKES` on a MISS (Riposte's trigger, the maneuver fold's shape) |
| **Limited Foresight** | uses | ROW → `INTERRUPT_ROLLS` (Disadvantage on the attack, Shadowy Dodge's row) + the Advantage-after bend on the effect |
| **Redirect Attack** | text | ROW+VOCAB → the interrupt that moves a hit to ANOTHER creature within 5 ft — Interception reversed; a `redirect` interrupt kind. One customer: waits |
| **Elemental Absorption**, **Ink Cloud**, **Fiendish Blood** | effects, uses | ROW+VOCAB → `REBUKES` with `on: damaged` and a damage-type judge (the classes' Misty Escape shares the trigger) |
| **Burst of Ingenuity**, **Portent**, **Maneuver** | uses, text | ROW → `INTERRUPT_ROLLS` for another creature's roll (Cutting Words' and Bend Luck's rows, the monster side) |
| **Watery Rebuke**, **Pursuit**, **Shriek**, **Unnerving Gaze** | save / text | ROW → `EMANATIONS` `alert` on a creature's move-in or turn start (Polearm Master's shape), the response the activity's |
| **Spell Reflection**, **Magical Backlash**, **Mind Corrosion**, **Protective Magic**, **Counterspell**, **Psionic Defense**, **Tongue Twister** | save / text | KIND → the cast-triggered reaction, Counterspell's (SWEEP §7): one hold at a hostile's cast serves all seven. Waits for the player customer |
| **Eye Rays**, **Divine Beam** | 9 effects, save, dmg | held → the random ray per target, Prismatic Spray's shape (SWEEP §7) |
| **Frightful Presence**, **Frightening Gaze**, the "casts Fear / Command / Hold" rows | text | NATIVE as casts; the repeat is `REPEAT_SAVES` (SWEEP §7's kind), no monster row of its own |
| **Rampage**, **Pounce**, **Charge**, **Frenzied Rush** | text | OUT (movement, then an attack the GM makes) — a reminder chip at most, no customer |
| **Swarm** | text | OUT (the resistances and the space are the sheet's) |
| **Antimagic Cone**, **Darkness Aura** | text | OUT (the platform's: an antimagic region, a light) |
| **Legendary Actions**, **Lair Actions** | not items | OUT — the tracker's, never a moment the module judges |

**NATIVE (nothing owed):** every breath weapon, gaze, song, howl, spray, storm, burst and bellow (the
demand at the targets, half on a save, the effect landed); the on-hit effects the attack activities
apply (Marked as Prey, Flash of Light, Hammer Throw, Great Bow, Gouge, Tendril, Beard, Infernal
Sting…); the rows already named — Pack Tactics, Blood Frenzy, Bloodied Fury / Frenzy, Light and
Sunlight Sensitivity, Sunlight Hypersensitivity, Aim, Deadly Aim, Sap, War Cry, Rally, Vampire
Weakness, Marshal Undead, Pesky Swarm, Aversion / Fear of Fire, Evasion, Uncanny Dodge, Parry,
Riposte, Shield, Hellish Rebuke, Protection, Noxious Miasma, Web; Multiattack, Spellcasting,
Nimble Escape, Hold Breath, Standing Leap, Spider Climb, Tunneler, Amorphous, Immutable Form,
Flyby, Agile (movement and the sheet); Fire / Lightning / Acid Absorption (the platform's damage
modification); Berserk, Loathsome Limbs, Multiple Heads (the GM's dice).

## Slice B, redrawn

Slice B was scoped as "the traits the sweep never surveyed" — now surveyed. Its real content:

1. **Undead Fortitude** on the drop machine (the one monster row the kill moment needs), and
   **Death Throes** as the death's side of the same moment.
2. **Legendary Resistance** on the succeed-fold machine, from the legendary pool.
3. **Magic Resistance** and its greater form on the `vsSpells` facet — the facet built once for the
   nine customers across the PHB (Spell Resistance), the DMG (six items) and here.
4. **Regeneration** on the turn-start grant — the facet the classes build; the GM customer comes free.
5. The **harmful aura rows** (eight, one shape) and the **reaction rows** (a dozen, on lists that exist).

Arcana Unleashed's 38-monster bestiary stays out with the splat books until the user says otherwise.

## The rows the scan gave no family (read by hand, 2026-09-28)

The evidence file's second half — 424 names the classifier tripped no family on — was read one by one
against the corpus text ([../monsters.md](../monsters.md) *No family*). **The finding: the silence was
mostly right.** 250-odd are the attacks themselves (Claw, Bite, Slam, the named weapons — the attack
machine's already), 60 are casts ("casts Fear", "casts Misty Step" — the spell's own row in the spells
register), the rest senses, movement, telepathies, restorations and Multiattack. **What the silence
hid: eleven shapes with monster customers, every one on a machine that exists** — none is a new kind, and
none is built here; each waits for its monster to come to the table (the register's WAITS, the DMG's
word). The shapes, largest first:

| Shape | Customers in the book | Lands on |
| --- | --- | --- |
| **The repeating save on a monster's own activity** — the pack ships no repeat; "repeats the save at the end of each of its turns" | Pacifying Spores, Paralysis Gas, Scare, Spores; **with an escalation** (first failure Restrained, second Petrified): Petrifying Bite, Petrifying Breath, Petrifying Gaze | `REPEAT_SAVES` — Hold Person's kind as a `match: "feature"` row (Regeneration's reading of the bearer's copy); the second consequence is new vocabulary |
| **The grappler's turn-start damage** — "at the start of each of its turns, the creature it is grappling takes…" | Barbed Hide, Constricting Vine, Suffocate, Smother, Swarm of Proboscises | `TURN_GRANTS` — Regeneration's trigger with a `grappled` judge, a damage instead of a heal |
| **The charge** — "if the bearer moved 20+ feet straight toward the target immediately before the hit, extra damage and Prone" | Gore, Tusk, Avalanche Slam, Ravage | `RIDERS` — the bearer's straight movement this turn read off the token (Polearm Master's reading), the extra damage on the hit |
| **The bearer's turn-end pulse** — "at the end of each of its turns, each creature in a N-foot Emanation takes…" | Fire Aura, Flame Aura, Heat Aura | `EMANATIONS` — Celestial Revelation's ring, the damage the activity's |
| **The drain** — the target's maximum (or a score) lowered by the damage dealt | Life Drain, Proboscis, Draining Swipe (Strength, 1d4) | `RIDERS` — a hit rider off the receipt |
| **The random condition on a hit** — "roll 1d4: on a 1 Charmed, on a 2 Frightened…" | Chaos Blade, Chaos Claw, Chaos Staff | `RAY_TABLES` — Prismatic Spray's shape at the hit |
| **The ring that moves with the bearer** — "the first time it enters a creature's space on a turn, that creature takes…" | Fire Form, Blazing Movement | `EMANATIONS` — Spirit Guardians' move-in, the ring the bearer's own space |
| **The vampire's drop** — at 0 Hit Points it becomes mist / teleports home / drops to 1 and flees | Misty Escape, Shadow Escape, Spiteful Escape (held at 1: Relentless Endurance's row) | `DROP_TO_ONE` — the `died` seam's notice, the Shape-Shift or the teleport the GM's |
| **The curse on a rest** — "gains no benefit from finishing a Short or Long Rest" | Cursed Touch, Restless Touch (Short Rests) | `REST_GRANTS` — Resourceful's machine reversed: the rest card's line, nothing granted |
| **One-customer rows on existing tables** | Gibbering (`EMANATIONS` `turnStart`, Stench's row) · Corrosive Form (`DAMAGE_SHIELDS`, Fire Shield's row) · Infernal Glaive's wound (`TURN_GRANTS` on the wounded creature) · Sacred Weapon (`EFFECT_CHOICES`, the target's pick) · Reflective Carapace (`INTERRUPT_ROLLS`, a spell attack alone, the d6 the dice's) · Object Slam (`EFFECT_BENDS`, Pack Tactics' judge) · Sun Sickness (`EFFECT_BENDS`, Sunlight Weakness's row) · Reactive Heads (`REACTION_RESETS`, Opportunity Attacks only) · Incite Rampage (`INTERRUPTS`, Commander's Strike's driven attack) | each named below with its precedent |
| **A cast-triggered check** — a caster inside the bearer's space saves or the spell is lost | Haunted Zone | the cast-triggered reaction kind (SWEEP §7) — the drawing's seven, now eight |

**Left NATIVE on purpose** (the GM's own click, the demand machine's save): Engulf and Trampling Charge
(the save at each creature whose space the bearer enters), Death Glare and Nightmare (the threshold of 20
Hit Points read by the GM — Power Word Kill's shape, native in the spells register), the damage-type picks
(Chromatic Spittle, Divine Ray, the Elemental weapons — the roll dialog's), Psychic Warp (the GM applies the
effect it chose), Legendary Resistance (dnd5e's own button). **OUT:** Prone Deficiency (the GM's die at a
condition it receives), Training (the sheet's), Animal Lordship and Draconic Origin (the stat block's
configuration), Illumination and Ignited Illumination (the token prototype's light), Running Water, Water
Susceptibility and Water Bound (terrain).

## Register verdicts

The hand column `tools/audit-monsters-register.mjs` reads — a verdict the data cannot derive, one row per
trait, by name. A row not listed here takes the generator's default: MODULE when a registry table names it,
NATIVE for a "casts X" row (the spell's own machine), TEXT when the pack ships a paragraph only, NATIVE
otherwise. A WAITS reason opens with the shape in backticks, which the generator lifts into the register's
*Shape* column. The rows the first drawing deferred (*The rows* above) are restated here so the register
carries them. `| **Row** | OUT / TEXT / NATIVE / MODULE / WAITS | why |`.

| Row | Verdict | Why |
| --- | --- | --- |
| **Legendary Resistance** | NATIVE | dnd5e's `resistSave` button on the failed save and the `legres` pool it spends; the saves machine honours the flip (RULINGS *The GM's side — the five shapes*) — no row, never a second entry path |
| **Frightful Presence** | NATIVE | a cast (Fear) — the repeat is `REPEAT_SAVES` on the spell's row, no monster row of its own |
| **Frightening Gaze** | NATIVE | a cast (Fear) — the spell's row |
| **Sickening Vapors** | NATIVE | measured and left native: a save the BEARER uses at its turn end (RULINGS *The GM's side — the aura rows and the attack bends*) |
| **Horror Nimbus** | NATIVE | measured and left native: a Bonus Action save the bearer uses (RULINGS *the aura rows*) |
| **Horrific Visage** | NATIVE | measured and left native: an action, a cone (RULINGS *the aura rows*) |
| **Multiple Heads** | NATIVE | the GM's dice — a head dies at 25+ damage in a turn, the sheet's count |
| **Berserk** | NATIVE | the GM's die at its turn start while Bloodied |
| **Loathsome Limbs** | NATIVE | the GM's dice on a slashing hit, the limbs the sheet's |
| **Engulf** | NATIVE | the save demanded at each creature whose space the bearer enters — the GM's move, the demand machine's save |
| **Trampling Charge** | NATIVE | the save demanded at each creature whose space the bearer passes through — the GM's move |
| **Death Glare** | NATIVE | the save; the threshold of 20 Hit Points read by the GM — Power Word Kill's shape, native in the spells register |
| **Nightmare** | NATIVE | the save; the threshold of 20 Hit Points read by the GM — Death Glare's shape |
| **Chromatic Spittle** | NATIVE | the damage type is the roll dialog's pick |
| **Divine Ray** | NATIVE | the damage type is the roll dialog's pick |
| **Elemental Burst** | NATIVE | the damage type is the roll dialog's pick |
| **Elemental Claw** | NATIVE | the damage type is the roll dialog's pick; the shove the GM's |
| **Elemental Flail** | NATIVE | the damage type is the roll dialog's pick |
| **Otherworldly Strike** | NATIVE | the damage type is the roll dialog's pick |
| **Psychic Warp** | NATIVE | the GM applies the one effect it chose |
| **Pacifying Spores** | WAITS | `REPEAT_SAVES` — Hold Person's kind on a monster's own activity (the pack ships no repeat): the Stunned repeating at the turn end, a `match: "feature"` row like Regeneration's; four customers with Paralysis Gas, Scare and Spores |
| **Paralysis Gas** | WAITS | `REPEAT_SAVES` — Pacifying Spores' shape: the Paralyzed repeating at the turn end |
| **Scare** | WAITS | `REPEAT_SAVES` — Pacifying Spores' shape: the Frightened repeating at the turn end |
| **Spores** | WAITS | `REPEAT_SAVES` — Pacifying Spores' shape: the Poisoned repeating at the turn end |
| **Petrifying Bite** | WAITS | `REPEAT_SAVES` — Hold Person's kind with an escalation: the first failure's Restrained repeating at the turn end, the second failure Petrified (the second consequence is new vocabulary); three customers with Petrifying Breath and Petrifying Gaze |
| **Petrifying Breath** | WAITS | `REPEAT_SAVES` — Petrifying Bite's shape |
| **Petrifying Gaze** | WAITS | `REPEAT_SAVES` — Petrifying Bite's shape |
| **Barbed Hide** | WAITS | `TURN_GRANTS` — a damage, not a heal, at the bearer's turn start to the creature it grapples (Regeneration's trigger with a `grappled` judge); five customers with Constricting Vine, Suffocate, Smother and Swarm of Proboscises |
| **Constricting Vine** | WAITS | `TURN_GRANTS` — the grappled creature's damage at the bearer's turn start (Barbed Hide's shape) |
| **Suffocate** | WAITS | `TURN_GRANTS` — the grappled creature's damage at the bearer's turn start (Barbed Hide's shape); the suffocation the effect's |
| **Smother** | WAITS | `TURN_GRANTS` — the grappled creature's damage at the bearer's turn start (Barbed Hide's shape); the Blinded and Restrained the effect's |
| **Swarm of Proboscises** | WAITS | `TURN_GRANTS` — the grappled creature's damage at the bearer's turn start (Barbed Hide's shape) |
| **Infernal Glaive** | WAITS | `TURN_GRANTS` — the wound's loss at the WOUNDED creature's turn start, read off the applied effect (Heroism's machine, a damage instead of a grant); the wound's save the activity's |
| **Gore** | WAITS | `RIDERS` — the charge: the bearer's straight movement this turn read off the token (Polearm Master's reading), the extra damage and the Prone on the hit; four customers with Tusk, Avalanche Slam and Ravage |
| **Tusk** | WAITS | `RIDERS` — the charge (Gore's shape) |
| **Avalanche Slam** | WAITS | `RIDERS` — the charge (Gore's shape) |
| **Ravage** | WAITS | `RIDERS` — the charge (Gore's shape) |
| **Life Drain** | WAITS | `RIDERS` — a hit rider off the receipt: the target's Hit Point maximum lowered by the damage dealt; three customers with Proboscis and Draining Swipe |
| **Proboscis** | WAITS | `RIDERS` — the maximum lowered by the Necrotic damage dealt (Life Drain's shape) |
| **Draining Swipe** | WAITS | `RIDERS` — the Strength score lowered by 1d4 on the hit (Life Drain's shape, a score instead of the maximum); the Shadow that rises the GM's |
| **Fire Aura** | WAITS | `EMANATIONS` — the bearer's turn-end pulse (Celestial Revelation's ring), the damage the activity's; three customers with Flame Aura and Heat Aura |
| **Flame Aura** | WAITS | `EMANATIONS` — the bearer's turn-end pulse (Fire Aura's shape) |
| **Heat Aura** | WAITS | `EMANATIONS` — the bearer's turn-end pulse (Fire Aura's shape) |
| **Fire Form** | WAITS | `EMANATIONS` — the enter trigger on the bearer's own space (Spirit Guardians' move-in), the damage once a turn; Blazing Movement shares it |
| **Blazing Movement** | WAITS | `EMANATIONS` — the enter trigger as the ring moves with the bearer (Fire Form's shape) |
| **Gibbering** | WAITS | `EMANATIONS` — `trigger.on: "turnStart"` (Stench's row): the save when a creature starts its turn within reach, the effect the activity's |
| **Chaos Blade** | WAITS | `RAY_TABLES` — Prismatic Spray's shape at the hit: the d4 rolled, the one condition it names landed until the bearer's next turn; three customers with Chaos Claw and Chaos Staff |
| **Chaos Claw** | WAITS | `RAY_TABLES` — Chaos Blade's shape |
| **Chaos Staff** | WAITS | `RAY_TABLES` — Chaos Blade's shape |
| **Misty Escape** | WAITS | `DROP_TO_ONE` — the `died` seam's notice (Death Throes' trigger): the card that says the vampire becomes mist, the Shape-Shift the GM's |
| **Shadow Escape** | WAITS | `DROP_TO_ONE` — Misty Escape's shape: the notice at the drop, the teleport home the GM's |
| **Spiteful Escape** | WAITS | `DROP_TO_ONE` — Relentless Endurance's row: held at 1 at the drop; the teleport and the anathema clause the GM's |
| **Cursed Touch** | WAITS | `REST_GRANTS` — Resourceful's machine reversed: the rest card's line when the cursed creature finishes a rest, nothing granted; two customers with Restless Touch |
| **Restless Touch** | WAITS | `REST_GRANTS` — Cursed Touch's shape, Short Rests only |
| **Corrosive Form** | WAITS | `DAMAGE_SHIELDS` — Fire Shield's row: the melee attacker takes the damage on its hit; the weapon's penalty the GM's |
| **Sacred Weapon** | WAITS | `EFFECT_CHOICES` — Fire Shield's table for the TARGET: its pick offered on the hit, the Stun or the extra damage |
| **Reflective Carapace** | WAITS | `INTERRUPT_ROLLS` — Limited Foresight's row for a spell attack alone (and Magic Missile's cast): the d6 rolled by the dice (R1), 1–5 unaffected, the 6's reflection the GM's |
| **Object Slam** | WAITS | `EFFECT_BENDS` — Pack Tactics' judge on the map: Advantage when the target is inside the bearer's space |
| **Sun Sickness** | WAITS | `EFFECT_BENDS` — Sunlight Weakness's row (Disadvantage on D20 Tests in sunlight); the hour's death clock the GM's |
| **Reactive Heads** | WAITS | `REACTION_RESETS` — Reactive's table: extra Reaction chips, Opportunity Attacks only |
| **Incite Rampage** | WAITS | `INTERRUPTS` — Commander's Strike's shape: the target's Reaction spent on an attack the bearer drives |
| **Haunted Zone** | WAITS | `the cast-triggered kind` — SWEEP §7's reaction at a hostile's cast (the drawing's seven, now eight): the save demanded of a caster inside the bearer's space, the spell lost on a failure |
| **Redirect Attack** | WAITS | `INTERRUPTS` — Interception reversed: the hit moved to another creature within 5 feet, a `redirect` kind (RULINGS *The GM's side — the reaction rows*) |
| **Fiendish Blood** | WAITS | `REBUKES` — `on: "damaged"` with a type judge (Elemental Absorption's row; RULINGS *The GM's side — the reaction rows*) |
| **Spell Reflection** | WAITS | `the cast-triggered kind` — one hold at a hostile's cast serves the seven (SWEEP §7); waits for the player customer (RULINGS *The GM's side — the reaction rows*) |
| **Magical Backlash** | WAITS | `the cast-triggered kind` — Spell Reflection's shape |
| **Mind Corrosion** | WAITS | `the cast-triggered kind` — Spell Reflection's shape |
| **Protective Magic** | WAITS | `the cast-triggered kind` — Spell Reflection's shape |
| **Counterspell** | WAITS | `the cast-triggered kind` — Spell Reflection's shape; the spell itself is native by the user's ruling (the spells register) |
| **Psionic Defense** | WAITS | `the cast-triggered kind` — Spell Reflection's shape |
| **Tongue Twister** | WAITS | `the cast-triggered kind` — Spell Reflection's shape |
| **Eye Rays** | WAITS | `RAY_TABLES` — Prismatic Spray's shape: the random ray per target (the drawing: held) |
| **Divine Beam** | WAITS | `RAY_TABLES` — Prismatic Spray's shape: the random ray per target (the drawing: held) |
| **Burst of Ingenuity** | WAITS | `INTERRUPT_ROLLS` — Cutting Words' and Bend Luck's rows, the monster side: another creature's roll bent |
| **Portent** | WAITS | `INTERRUPT_ROLLS` — Burst of Ingenuity's shape |
| **Maneuver** | WAITS | `INTERRUPT_ROLLS` — Burst of Ingenuity's shape |
| **Watery Rebuke** | WAITS | `EMANATIONS` — the `alert` on a creature's move-in or turn start (Polearm Master's shape), the response the activity's |
| **Pursuit** | WAITS | `EMANATIONS` — Watery Rebuke's shape |
| **Shriek** | WAITS | `EMANATIONS` — Watery Rebuke's shape |
| **Unnerving Gaze** | WAITS | `EMANATIONS` — Watery Rebuke's shape |
| **Life Suppression** | OUT | a `noHealing` area facet the healing machine would read — no customer at the table (the drawing: out for now) |
| **Negative Energy Cone** | OUT | Life Suppression's shape — out for now |
| **Split** | OUT | a summon at a slashing hit while Large or bigger — the GM's |
| **Rampage** | OUT | movement, then an attack the GM makes — a reminder chip at most, no customer |
| **Pounce** | OUT | movement, then an attack the GM makes |
| **Charge** | OUT | movement, then an attack the GM makes |
| **Frenzied Rush** | OUT | movement, then an attack the GM makes |
| **Swarm** | OUT | the resistances and the space are the sheet's |
| **Antimagic Cone** | OUT | the platform's: an antimagic region |
| **Prone Deficiency** | OUT | the GM's die at a condition it receives and the turn-end save — no seam the module judges |
| **Training** | OUT | the sheet's: a proficiency and its Advantage |
| **Animal Lordship** | OUT | the stat block's configuration — the DM's choice at creation |
| **Draconic Origin** | OUT | the stat block's configuration — the DM's choice at creation |
| **Illumination** | OUT | the token prototype's light |
| **Ignited Illumination** | OUT | the token prototype's light, toggled by the GM |
| **Running Water** | OUT | terrain — the damage the GM's when the water is met |
| **Water Susceptibility** | OUT | terrain — the damage the GM's when the water is met |
| **Water Bound** | OUT | terrain |
