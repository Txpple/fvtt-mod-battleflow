# HANDOFF.md — the Monster Manual's waiting rows (2026-09-28, night)

> **What this is:** the commission for the rows the Monster Manual register left WAITS on machines that
> exist ([audits/monsters-register.md](audits/monsters-register.md), the drawing's *The rows the scan gave
> no family*). The user's word: *"we need to finish what's applicable in MM … finish this autonomously,
> and then confirm that the MM is a wrap (except for the walk)."* Rapid mode: build, prove with the
> suites, push; every walk deferred. Retired when the stages below are delivered and the register shows
> no WAITS row that a machine of ours could take.

## Out of scope, by earlier rulings (not re-opened)

- **The cast-triggered reaction kind** (Spell Reflection, Magical Backlash, Mind Corrosion, Protective
  Magic, Counterspell, Psionic Defense, Tongue Twister, Haunted Zone): waits for the player customer
  (RULINGS *The GM's side — the reaction rows*; Counterspell native by the user's ruling).
- **Redirect Attack**: a new interrupt kind with one customer (the same ruling).

## The stages, by machine

| Stage | Shape | Customers | Lands on | Vocabulary |
| --- | --- | --- | --- | --- |
| 1 | the repeating save on a monster's own activity; the escalation | Pacifying Spores, Paralysis Gas, Scare, Spores; Petrifying Bite, Petrifying Breath, Petrifying Gaze | `REPEAT_SAVES` (Hold Person's kind; the origin item answers by name or identifier, no type gate) | `count.swap` — the pressed status REPLACES the effect (Petrified instead of Restrained) |
| 2 | the turn-start damage: the grappler's, and the wound's on its wearer | Barbed Hide, Constricting Vine, Suffocate, Smother, Swarm of Proboscises; Infernal Glaive, Spores' "Damage While Poisoned" | `TURN_GRANTS` (Regeneration's trigger) | `deals: "grappled"` (a damage activity at the creatures the bearer grapples — Unarmed Fighting's finder), `match: "effect"` with a damage activity (the wearer's turn start) |
| 3 | the bearer's turn-end pulse; the moving ring; the turn-start ring; the alert | Fire Aura, Flame Aura, Heat Aura; Fire Form, Blazing Movement; Gibbering; Watery Rebuke, Pursuit, Shriek, Unnerving Gaze | `EMANATIONS` (Inner Radiance's `pulse`, Flaming Sphere's `enter`, Stench's `turnStart`, Polearm Master's `alert`) | none expected; `alert.on: "turnStart"` if Unnerving Gaze needs it |
| 4 | the random condition on a hit; the random ray | Chaos Blade, Chaos Claw, Chaos Staff; Eye Rays | `RAY_TABLES` (Prismatic Spray's shape) | a hit-seam ray table (`on: "hit"`), the effects named "1: …" |
| 5 | the drain; the charge | Life Drain, Proboscis, Draining Swipe; Gore, Tusk, Avalanche Slam, Ravage | a post-damage rider (Vampiric Touch's `dnd5e.applyDamage` seam) for the drain; `CLOCK_RIDERS` `judge: "charged"` for the charge, the offer's checkbox carrying the judgment where the movement cannot be read | `DRAINS` table (max or a score, off the receipt); `charged` judge |
| 6 | the vampire's drop; the curse on a rest; the rest of the one-customer rows | Misty Escape, Shadow Escape, Spiteful Escape; Cursed Touch, Restless Touch; Corrosive Form, Sacred Weapon, Reflective Carapace, Object Slam, Sun Sickness, Reactive Heads, Incite Rampage, Fiendish Blood, Burst of Ingenuity, Portent | `DROP_TO_ONE`, `REST_GRANTS`, `DAMAGE_SHIELDS`, `EFFECT_CHOICES`/the hit seam, `INTERRUPT_ROLLS`, `EFFECT_BENDS`, `REACTION_RESETS`, `INTERRUPTS`, `REBUKES` | per row, the smallest facet that fits |

Each stage: the rows and their vocabulary in `scripts/decide/registry.js`, the machine's change, its unit
test in `tests/decide-monsters.test.js`, its sections in the new suite `tools/smoke-monsters.mjs` (BF
Test Monster lent the traits by name from `dnd-monster-manual.features`, taken back after), `npm run
verify` green, the suite green on the deployed copy, one commit. The docs recut at the end: RULINGS
*The Monster Manual — the waiting rows built* with the walk table, the drawing's verdicts flipped, the
register regenerated, BACKLOG row 4b, ARCHITECTURE's GM's-side table if vocabulary joined.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in
  the same commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`.
- A change runs its own suites; deploy `--local` first; launch detached; after a kill: `verify-settings --fix`,
  `reset-fixture-state`, `fixture-suite`.
- `biome --write` on named files only; heredocs mangle backslashes — write edit scripts to a file.
