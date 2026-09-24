# HANDOFF.md — the long-term order, and Slice A's plan

> **A commission, written 2026-09-24 on the user's word** ("prepare for a handoff … make a plan
> to start working on the below, and also remember the other suggested order"). It is retired
> when Slice A is delivered: what it settles moves into RULINGS / DESIGN §8 / SWEEP, and this
> file goes (BACKLOG's header: a commission is written when there is one and retired when it is
> delivered). ⚠ **It is not a "go".** The standing cycle holds: nothing here starts until the
> user says go, and the UI-shaped steps are ruled off a prototype first.

---

## 0. Where things stand (2026-09-24, evening)

| | |
| --- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5 — what the last session plays. Untouched today. |
| **main** | 1403159, pushed. Seventeen commits past v2.0.8, **none released**: the documentation pass, Arcana Unleashed measured, the doc-link checker, the preflight naming the bridge, and **the ask at the area as its own service** (`scripts/area-ask.js`, `scripts/decide/area-ask.js`). |
| **The sandbox** | runs **main**, not v2.0.8 (deployed with `deploy-house-module.mjs --local`). Fixtures rebuilt, settings clean. ⚠ A prod refresh wipes both the fixtures and the local deploy: re-run `tools/fixture-suite.mjs`, `tools/fixture-d20-folds.mjs` and the `--local` deploy after one. |
| **Proof of main** | the battery on the sandbox, then targeted re-runs after the one bug it caught (`c68746d`): every suite green — smoke-metamagic 107/107, smoke-saves 114/114, probe-effect-view 17/17, the Topple section 13/13 three times, settings clean. |
| **Owed** | nothing. BACKLOG holds only parked items, each with its trigger. |

⚠ **The release question for main is the user's.** Step 1 says the last session plays v2.0.8,
fix-only. The area-ask refactor changes nothing at the table by construction and is battery
green, so it can ride the next release whenever the user says — before the session, or after.

---

## 1. The long-term order (the user's, 2026-09-24)

The frame: the core mechanics are in place; Battle Flow now grows from one campaign's needs to
the full use case. The sweep does not wait for another campaign — **the campaign is the proof,
not the prerequisite**: nothing ships unplayed, so the sweep moves as fast as a table proves it.

| # | Step | State |
| --- | --- | --- |
| 1 | **Play the last session on v2.0.8. Fix-only until the break.** | next |
| 2 | **Break, day one: a doc recut, not a refactor.** Retire PLAN.md; turn SWEEP.md into the drawing for Slice A; prune the dnd5e 5.3 facts from NOTES §2. Half a day. | ✅ **mostly DONE 2026-09-24** — PLAN.md retired into ARCHITECTURE's appendix, NOTES §2 triaged for 6.x, the whole set compressed (97k → 48k words), a doc-link checker in verify. **Left: SWEEP as Slice A's drawing** — §2 of this file is the plan for it. |
| 3 | **Slice A: species and origin feats.** Not a detour from the sweep — it is sweep items 1 and 5 with real content behind them, and it is what the next campaign's session 1 proves. | planned below (§2) |
| 4 | **Slice B: the GM's side.** Monster Manual traits the sweep never surveyed (Magic Resistance, Legendary Resistance's neighbours, Regeneration, Undead Fortitude, Relentless). It does not depend on who the next party is, so it comes before the class walk. Arcana Unleashed's 38-monster bestiary joins it. | after A |
| 5 | **Session 0 of the next campaign sets Slice C onward.** Sweep the party's actual kit one level band ahead of play — never the whole subclass corpus blind. The hit menu's next groups (Brutal Strike, Stunning Strike, Open Hand, Psionic Strike, Arcane Shot) arrive when a Barbarian, Monk or Arcane Archer sits down. | after B |
| 6 | **Platform passes stay their own step, never inside a slice.** Budget one per dnd5e minor and one for Foundry 15; the 6.0 pass cost a major version. | standing rule |

**Why not an architecture pass instead:** the machine-tier pass already did it (2026-09-05/06),
and the registry model exists so a sweep row costs minutes. The structural work worth doing is
the sweep's own, each piece built by the feature that proves its shape: the reroll fold kinds,
the d20 interrupt kind, the hit menu's cost kinds, the kill moment. `scripts/decide/registry.js`
(1,600 lines) is split when Slice A lands and it hurts, not before.

---

## 2. Slice A — species and origin feats: the plan

**The class, not the examples** (the house rule): every 2024 species trait and every origin feat
in the premium books, read against the tables. The names below are what the survey expects by
name — **nothing here is measured yet**; step A0 is the measurement.

### A0 — the rescan (first, before any row)

- `node tools/scan-corpus.mjs <out.json>` on the sandbox (live, read-only, ~10 min, the bridge
  out of the world), then `node tools/classify-corpus.mjs <out.json> --kind race` and
  `--kind feat`. The classifier ranks Arcana Unleashed's Item packs since 2026-09-24; its
  **origin feats** are in scope with the PHB's.
- Output: the Slice A inventory — every species trait and origin feat, its family, text-only or
  pack-carried, and which table or machine it lands on. That table replaces §2.2 below and
  becomes SWEEP's drawing for the slice (step 2's leftover).

### A1 — the rows (cost: minutes each, no ruling needed)

| Expected content | Mechanism | Lands on |
| --- | --- | --- |
| Brave (Halfling), Fey Ancestry (Elf), Dwarven Resilience, Gnomish Cunning | save-side bends, SWEEP item 1 | `EFFECT_BENDS` rows with the `saves` facet — the facet exists (Aura of Purity, Circle of Power) |
| Goliath's Giant Ancestry — Fire's Burn, Frost's Chill, Hill's Tumble | a rider, a rider plus a press, a press | `CLOCK_RIDERS` / `SAVE_PRESSES`-shaped rows |
| Aasimar's Celestial Revelation | a use chip plus a clock rider | `USE_CHIPS`, `CLOCK_RIDERS` |
| Alert, Tough, Musician, Magic Initiate, Skilled, Crafter, Healer | the sheet, done natively, or out of scope | nothing — say so in the inventory |

### A2 — the new kinds (cost: a machine each; **prototype first**, then the user rules)

| Expected content | The new KIND | Notes |
| --- | --- | --- |
| Halfling Luck, Lucky | a **d20 reroll** fold kind (SWEEP item 5) | the d20 fold machine already owns rerolls (Heroic Inspiration, Seeking) — a kind, not a machine; the R4 tripwire pin moves on purpose |
| Savage Attacker, Tavern Brawler | a **damage-die reroll** fold | Empowered Spell's shape (`metamagic.js` patches the damage roll) is the precedent; decide whether it generalises or stays metamagic's |
| Lucky's Disadvantage half, Goliath's Stone's Endurance neighbours | the **d20 interrupt** kind (SWEEP item 3) | an Interrupt kind beside `ac` and `damage`: a reaction that bends the attack roll instead |
| Goliath's Storm's Thunder | possibly an interrupt after damage | measure first |

One prototype covers A2's UI: where a reroll offer appears (the rescue window beside Heroic
Inspiration, or a new row), what the damage-die reroll looks like, and whether Lucky's two halves
are one row or two. **The user rules off the prototype, then says go** (the standing rule).

### A3 — held for Slice B, on purpose

**Orc's Relentless Endurance** needs a **kill moment** (dropping to 0 HP, then 1 instead) that the
module does not have. Undead Fortitude and the monster Relentless trait are its second and third
customers, and the house builds a seam from its customers — so it waits for Slice B and is built
once, with all three.

### A4 — the proof

- Each row: a unit test in `tests/decide-registry.test.js`, a section in the matching
  `tools/smoke-*.mjs`, `node tools/battery.mjs --changed --list` then `--changed`.
- A fixture per species the suites need (the fixture tool builds from the PHB pack, as it does
  the Rogue and the Sorcerer).
- **The table proves it:** the next campaign's session 1 is the walk. Nothing in Slice A is
  "done" until a character built from it has played.

### A5 — the open questions for the user (to rule, not to guess)

1. Lucky's three luck points and Halfling Luck: one reroll row per source, or one "reroll"
   row that lists every source the actor has? (the prototype asks it)
2. Savage Attacker's damage reroll: offered before the damage applies (a popup), or folded in
   automatically as "roll twice, take the higher" since the feat's text leaves no choice after
   the dice? (R1 — if the rules settle it, it is automated)
3. Arcana Unleashed's origin feats: in Slice A with the PHB's, or a slice of their own once the
   rescan shows how many are combat-relevant?

---

## 3. Reading order for the next session

1. This file, then [BACKLOG.md](BACKLOG.md) (what is parked) and [DESIGN.md](DESIGN.md) §8 (what is settled).
2. [SWEEP.md](SWEEP.md) §0 and §3 — the families and the items this plan names.
3. [RULINGS.md](RULINGS.md) *The gate before the roll* and *Metamagic* — the machines Slice A's
   new kinds extend (the effect table's `saves` facet, the d20 folds, Empowered's reroll).
4. [ARCHITECTURE.md](ARCHITECTURE.md) §6 (the registry model and the R4 tripwire) and §11 (the
   checklist for adding a row, a fold, a kind).
