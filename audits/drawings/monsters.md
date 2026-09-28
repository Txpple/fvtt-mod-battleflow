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
