# HANDOFF.md — the PHB feats: groups 1–3 of six

> **Written 2026-09-26 on the user's word** ("go for 1-3. write this as a plan so we dont lose
> track of groups"). The commission is **groups 1, 2 and 3** (§2). Groups 4–6 are drawn here so they
> are not lost; they are **not** commissioned — each waits for its own go. Retire this file when
> group 3 is delivered and the docs are recut (its rulings to RULINGS, what is left to BACKLOG).
> The scope and the measurement behind every row: RULINGS *The PHB feats — the scope*.

---

## 0. The rulings (user, 2026-09-26)

| Question | Ruling |
| --- | --- |
| Epic boons | OUT, all of them |
| The 19 with nothing to do | OUT (RULINGS *The PHB feats — the scope*) |
| Charger, Grappler's Punch and Grab, Mounted Combatant's rest, War Caster's Reactive Spell | **PARKED** (no precedent row; un-parked by a player taking one) |
| Where Elemental Adept's chosen type lives | **the item's NAME** — "Elemental Adept (Fire)"; a copy with no type in its name is a reminder only. Repeatable: each copy is its own type |
| Chef's Bolstering Treats | **temp HP handed out after the Long Rest** — a bend by choice: its row goes in RULINGS *Bent by choice — the rule of cool* IN THE SAME COMMIT as the code (group 5) |
| The build order | groups 1 → 2 → 3 now; 4, 5, 6 later, each on its own go |

## 1. What the measurement found (2026-09-26 — the pack scan, dnd5e 6.0.5's installed source)

- **Crusher's and Slasher's crit halves were NOT in.** `EFFECT_BENDS` "Crushed" / "Slashed" are
  rows nothing applies; and the PHB's "Slashed" effect is Hamstring's **speed −10**
  (`movement.walk -10`, transfer false), so a GM applying the pack's own effect today gets the
  crit's Disadvantage counted as well. The pack's "Crushed" is an empty transfer marker on the owner.
- **Elemental Adept ships text only** ("not automated", the pack's own note; no choice stored).
  dnd5e 6.0.5 can ignore resistance per type (`options.ignore.resistance`, a Set, read at damage
  calculation) but nothing sets it from the attacker.
- **Cover is a status on the target** (`coverHalf` +2 / `coverThreeQuarters` +5 / `coverTotal`),
  baked into `ac.value` and into the attack message's `system.targets[].ac` at the roll
  (`TargetsField.getDescriptors`; total cover writes `ac: null`).
- **Nothing ends Hidden on an attack** in dnd5e 6.0.5 or the module — Skulker's Sniper has nothing
  to preserve.
- **Chef and Inspiring Leader** ship their benefit as the pack's own `heal` activities; the hit die
  roll runs `dnd5e.preRollHitDieV2` (hookNames `hitDie`), so a part can be added there.
- **Polearm Master is the one movement trigger**: Foundry 14's `moveToken` fires after the commit
  (NOTES *A bare token move is WALKED*); the module has no movement-triggered offer today.

## 2. The groups

Each group: the precedent named (SWEEP §1) → build → `npm run verify` → unit tests → `deploy
--local` → **its own** suite section (`battery.mjs --changed`), never the full battery → commit →
check in with the user (a table: done, the numbers, what is left). A UI-shaped part is ruled off a
prototype first.

### Group 1 — the damage rules ☐ (commissioned)

| Feat | What | Where |
| --- | --- | --- |
| **Elemental Adept** | a spell's damage of the named type ignores the target's Resistance; its 1s count as 2s | resistance: `options.ignore.resistance` set at `dnd5e.preCalculateDamage` off `options.originatingMessage`'s actor (Heavy Armor Master's seam, `fighting-styles.js`); the floor: the `minimum` field Great Weapon Fighting uses, at 2, gated to a spell of the type |
| **Poisoner** | Potent Poison: Poison damage the owner deals ignores Resistance to Poison | the same seam, one row |

Also: `decide/dice-chips.js` says dnd5e floors Elemental Adept's 1s on its own — correct the comment.
Open to measure: whether the floor rises as dice (the dice that rise, kind 2 — situational) like
Great Weapon Fighting's.

### Group 2 — the range cancellers ☐ (commissioned)

| Feat | What | Where |
| --- | --- | --- |
| **Sharpshooter** | a weapon's ranged attack: no Disadvantage at long range, none for an enemy within 5 feet; ignores Half and Three-Quarters Cover | the gate's range rows (`rangeSources`, `decide/reminders.js`): a cancelled row is LISTED with why, never counted (`sightOf`'s shape); cover: the attack's recorded `targets[].ac` less the target's `ac.cover` — **new: the module adjusts the record** (measure the seam first) |
| **Spell Sniper** | a spell attack: no Disadvantage within 5 feet; ignores Half and Three-Quarters Cover; a spell's range of 10 feet or more +60 | the same rows; the range read (`range.normalFeet`) +60 |
| **Crossbow Expert** | no Disadvantage for a crossbow within 5 feet; Dual Wielding adds the modifier to a Light crossbow's extra attack | the close row; a `FIGHTING_STYLES` row (Two-Weapon Fighting's `offhand` gate, crossbows, `feat: true`). Ignoring Loading: dnd5e does not enforce it — nothing to do |

A cancelled row in the gate is a new box state — prototype it (`prototypes/`) before building.

### Group 3 — the on-hit riders ☐ (commissioned)

| Feat | What | Where |
| --- | --- | --- |
| **Slasher** | Hamstring: a Slashing hit, once per turn, speed −10 until the start of your next turn (the pack's "Slashed"); a crit: Disadvantage on its attacks until the start of your next turn | a `CLOCK_RIDERS` row (Frost's Chill: `effects`, `clock: "slow"`) with no damage — **new: land an item's OWN effect by name** (the pack has no activity) and a **`crit` judge**; the crit's effect is the module's own, and the `EFFECT_BENDS` "Slashed" key moves off the pack's name (the collision above) |
| **Crusher** | a Bludgeoning hit, once per turn: move the target 5 feet; a crit: attacks against it have Advantage until the start of your next turn | the push: a `shove` row (Tavern Brawler's, `bash-offer.js`) gated on Bludgeoning; the crit: Slasher's path |
| **Piercer** | a Piercing hit, once per turn: reroll ONE damage die, the new roll stands; a crit: one extra damage die | the reroll: Savage Attacker's machine (`damage-either.js`) with a pick-a-die question — **prototype first**; the extra die: at the damage roll, Great Weapon Master's seam |
| **Skulker** (rides along) | its Blindsight effect titled "Skulker" in the effect view | `effect-view.js` `styleFeatOf`: a general feat as well as a style |

Also: correct RULINGS *The PHB feats — the scope* ("the crit half is in" is wrong) when group 3 lands.

### Group 4 — the saves ☐ (NOT commissioned)

**Mage Slayer**: Disadvantage on the concentration save its damage forces (the concentration
machine already records the damage's cause — needs the actor, not the name); Guarded Mind turns a
failed Int/Wis/Cha save into a success (a `D20_FOLD_KINDS` spend on the pack's "Guard Mind"
activity, `tactical`'s shape, a `verdict` arithmetic).

### Group 5 — the rest grants ☐ (NOT commissioned)

**Inspiring Leader** and **Chef**: a new `REST_GRANTS` grant kind — run the pack's own heal activity
on the owner's picks (Musician's popup). Chef's Replenishing Meal: +1d8 on the picked creatures'
first Hit Die of the rest (`dnd5e.preRollHitDieV2`). Bolstering Treats: temp HP = Proficiency Bonus
to up to PB picks after the Long Rest — the rule-of-cool row in the same commit.

### Group 6 — the reaction attacks ☐ (NOT commissioned)

**Sentinel** first (Riposte's stamp on an enemy's attack message: an adjacent Sentinel whose ally was
attacked; Halt lands the pack's "Halted" through group 3's item-effect path), then **Polearm Master**
(Reactive Strike when a creature enters the reach — the first `moveToken`-triggered offer; prototype
the offer first).

## 3. State

| Group | State | Commits |
| --- | --- | --- |
| 1 | ☐ | |
| 2 | ☐ | |
| 3 | ☐ | |
