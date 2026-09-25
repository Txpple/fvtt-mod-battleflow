# BACKLOG.md — known, deliberately not scheduled

> **What this file is:** things worth knowing about that **nobody owes anybody**. Each was
> found, understood and parked on purpose, with the reason and the thing that would un-park it.
>
> **What it is NOT:** a to-do list. Nothing here blocks a release, a deploy or a battery. If an
> item becomes owed it leaves this file for a commission the user hands the next session. There
> is no standing handoff file, by user call: a commission is written when there is one and
> retired when it is delivered. A closed item leaves too — its record is git history. (The last,
> HANDOFF.md of 2026-09-24 — Slice A's plan — was retired when Slice A was delivered, pending the
> user's audit and the release floor; its plan's corrections are SWEEP §6, its long-term order the
> section below, its text in git history.)
>
> Three files, three jobs: this file is *not now, and here is why*; [DESIGN.md](DESIGN.md) §8
> is *no, and here is what would change the answer*; [ARCHITECTURE.md](ARCHITECTURE.md) §10 is
> *what was owed and where it went*. Two items here are enforced by tooling and cannot rot in
> place: the layer pins and the coverage pins are checked both ways, so repaying the thing, or
> the platform changing under it, fails the build or the report.

---

## The long-term order (the user's, 2026-09-24)

**Not a commission — the order the next ones come in.** Nothing here starts until the user says
go; a UI-shaped step is ruled off a prototype first. The frame: the core mechanics are in place,
and Battle Flow grows from one campaign's needs to the full use case. The sweep does not wait for
another campaign — **the campaign is the proof, not the prerequisite**: nothing ships unplayed, so
the sweep moves as fast as a table proves it.

| # | Step | State |
| --- | --- | --- |
| 1 | **Play the last session on v2.0.8, fix-only until the break.** | prod stays v2.0.8 until the user says release; main's unreleased work rides the next release on the user's word |
| 2 | **Break, day one: a doc recut, not a refactor** — PLAN.md retired, SWEEP turned into Slice A's drawing, NOTES §2 triaged for 6.x. | ✅ done 2026-09-24 (PLAN.md into ARCHITECTURE's appendix, SWEEP §6) |
| 3 | **Slice A: species and origin feats** — sweep items 1, 2, 3 and 5 with real content behind them (SWEEP §6, RULINGS *Slice A*). | ✅ delivered on main 2026-09-24, pending the user's audit and the full battery before a release. **The table proves it:** nothing in it is done until a character built from it has played — the next campaign's session 1 is the walk |
| 4 | **Slice B: the GM's side** — the Monster Manual traits the sweep never surveyed (Magic Resistance, Legendary Resistance's neighbours, Regeneration, Undead Fortitude, Relentless) and Arcana Unleashed's 38-monster bestiary. Independent of who the next party is, so it comes before the class walk. **Owns the kill moment** (dropping to 0 HP, then 1 instead): Relentless Endurance, Undead Fortitude and the monster Relentless trait, built once with all three customers. | next, on the user's go |
| 5 | **Session 0 of the next campaign sets Slice C onward** — the party's actual kit one level band ahead of play, never the whole subclass corpus blind. The hit menu's next groups (Brutal Strike, Stunning Strike, Open Hand, Psionic Strike, Arcane Shot) arrive when a Barbarian, Monk or Arcane Archer sits down. Arcana Unleashed's origin feats are the phase after Slice A (SWEEP §0 item 4). | after B |
| 6 | **Platform passes stay their own step, never inside a slice** — one per dnd5e minor, one for Foundry 15; the 6.0 pass cost a major version. | standing rule |

Why not an architecture pass instead: ARCHITECTURE's appendix *Decided against*.

## Architecture

### The two sideways edges (2026-09-05)

The tree is layered and the rule is *depend downward only*. Seven sideways edges were found;
five are repaid. Two remain, deliberately, because the seam is built by the feature that proves
its shape — a shared part written from one caller is a guess, and a wrong shared part is worse
than an honest sideways edge.

| Edge | Waiting for |
| --- | --- |
| `saves → receipts` (`saves/verdict.js`) | `receipts.js` gaining a **second** importer |
| `volleys → reminders` (by design, 2026-09-02) | a **third** surface for the gate's judge `judgeRoll` (the dialog's gate and the volley's aim are two), to prove a spine home |

The pins live in [tools/check-layers.mjs](tools/check-layers.mjs) and `npm run layers` fails on a
pin whose edge has GONE as well as on an edge with no pin. The two surviving import cycles are
permanently closed, not backlog (DESIGN §8).

### Two clock residues (2026-09-03)

"First round" is judged in three edge places — `decide/clock.js` `riderDue`, `sneak.js` for Death
Strike, `reminders.js` for Assassinate — and `bash-offer.js` judges a maneuver's once-per-turn off
a flag stamp rather than a turn chit (`decide/chips.js` `TURN_CHITS`, which every other
once-per-turn reads). Neither is wrong. **Un-parked by** a FOURTH judge of "first round" (the
reader goes to `decide/clock.js` with it), or the next once-per-turn maneuver on the bash offer
(it moves to a turn chit with it).

### The modal sequence (2026-09-09, the user's call: "not a priority now")

A workflow where several windows are answered **in order** and the visual chain waits for the
whole sequence to drain. Today the popup pile is a staircase in rank, then causal order
(ARCHITECTURE §5 law 7), concurrent by design. A modal sequence is a change to law 7, wanted for
some workflows only — so it arrives as an option per moment, never the default. Not this: the
hit's own sequence (the bash offer queued behind the damage and the mastery's decision,
`decide/sequence.js`), decided from one hit's records at the damage chokepoint.

⚠ **The contract the hold must keep, or this becomes unbuildable without a migration:**

| Decision | Why it is load-bearing |
| --- | --- |
| The hold is **refcounted**, never a boolean per subject | a sequence of N windows raises N holds against one subject |
| The hold is keyed by an **opaque subject**, not an activity uuid | a sequence's subject may be a popup key or a message id |
| Release is an **explicit lifecycle call**, never "the card posted" | in a sequence the card posts at step 1 while steps 2..N stand |
| Every decision popup opens through **`openManagedPopup`** (`ui.js`) | the one place that knows when a dialog opens and closes |

⚠ **Where Battle Flow and FX Studio genuinely disagree, on purpose:** a Hold Timer of 0 is a
clockless ask by explicit setting (§5 law 11), so Battle Flow raises a clockless hold; FX Studio
bounds every gate at five minutes and plays when a bound expires. At that setting the picture
fires while the question is still on screen. **If a play report says "the animation fired while I
was still choosing", the Hold Timer is the first thing to read.** The default (24 s) never
reaches it. Neither module may import the other; Battle Flow publishes events and an api
(ARCHITECTURE §7) and never calls FX Studio.

## Features — surveyed, not scheduled

| Item | Shape |
| --- | --- |
| **The abilities sweep** (surveyed 2026-09-02; SHELVED 2026-09-03: "a longer term project"; un-shelved slice by slice 2026-09-24) | [SWEEP.md](SWEEP.md): the 2024 corpus sorted into the module's eight mechanism families, what each kind would need, a suggested order. Its three questions are ruled (SWEEP §5). Rescanned 2026-09-24; Slice A delivered (SWEEP §6). The next slice is *The long-term order*, above. |
| **Lucky's Advantage half** (Slice A, parked 2026-09-24) | Works via the sheet: the player spends the Luck Point from the feat and picks Advantage in the roll dialog — the pack's own note expects exactly that (it spends and does not enforce). At the gate it would need a "next D20 Test" chip window and a save-side read of the chip (SWEEP §6 vocabulary 10). The post-roll shape stays refused (DESIGN §8, the forgotten-Advantage rescue). **Un-parked by** the table asking for it at the gate. |
| **Trance** (Slice A, parked 2026-09-24) | "Magic can't put you to sleep" needs a named-spell scope and an immunity bend on the saves facet (vocabulary 2). **Un-parked by** an Elf at the table against a sleep effect. |
| **Healer's Healing Rerolls on spells** (Slice A, parked 2026-09-24) | Reroll 1s on the healing dice of another item — a new kind; Battle Medic's own formulas already carry `r1`. **Un-parked by** a Healer playing a healing caster. |
| **Inner Radiance's turn-end pulse** (Slice A, parked 2026-09-24) | Proficiency Bonus radiant to every creature within 10 feet at the END of the Aasimar's turns — a new kind; the pack rolls the damage once, on use. **Un-parked by** an Aasimar at the table (with the row below). |
| **Celestial Revelation's extra damage** (Slice A, parked 2026-09-24) | A `CLOCK_RIDERS` row needing a `transformed` judge (two of the three forms leave no effect on the bearer to read), an attack-or-spell trigger and a flat `@prof` amount (vocabulary 9). **Un-parked by** an Aasimar at the table. |
| **Arcana Unleashed — the fifth premium book, installed on both boxes, unread by the module** (2026-09-24) | `dnd-arcana-unleashed` v1.0.1, a 2024-rules expansion on magic: 8 subclasses and 61 features, 37 feats, 33 spells, 69 magic items with a standalone Active Effects pack, a 38-monster bestiary — measured by [tools/probe-premium-module.mjs](tools/probe-premium-module.mjs), pack indexes only (SWEEP §2, NOTES §2). **Nothing the module does today changes:** zero name collisions with a registry key, a feature field or a settings default, and none of the 33 spells shares a name with a PHB spell, so no per-spell list (Twinned's exceptions, Spent Areas, Chosen Areas, Effect Choices, Damage Saves, the volleys) has read it. **Settled by** the corpus rescan, then the per-spell lists read against its spells, then rows — a slice of the sweep. Its `.effects` pack is the first ActiveEffect compendium in the house; the effect readers match effects on ACTORS by name and have never met a compendium effect — measure before a row. |
| **The hit menu takes ONE pick per hit, across its groups** (2026-09-24, Slice A) | The pick is one record (`hitPick` on the attack, `hitManeuver` on the damage), so since Giant Ancestry (Hill's Tumble) joined Combat Superiority the offer's wire keeps one tick on the whole menu and `decide/hit-menu.js` `hitPick` drops a two-group pick — a Goliath Battle Master cannot knock a target Prone with Hill's Tumble and ride a maneuver on one hit, which the rules allow. (Fire's Burn and Frost's Chill are clock riders, which ride beside any pick.) The array shape (`hitPick`/`hitManeuver` as a list: one rider part, one spend and one card line per pick; the moment published per pick) is the fix. **Un-parked by** a Goliath Battle Master sitting down at the table. |
| **Rend Mind, a Cunning Strike option no fixture exercises** (2026-09-02) | `CUNNING_OPTIONS.rendMind` is data the unit tests read, but no Soulknife stands on the sandbox, so `smoke-sneak` never drives it live. The first Soulknife at the table is the measurement; a fixture is the fix. |
| **Clock riders with a damage TYPE the rules leave to the player** (2026-09-02) | Divine Strike, Primal Strike and Divine Fury ride with the activity's FIRST type and say so (DESIGN §8). A picker on the offer is one row of controls away if a table asks. |
| **The pack's "Assasinate" (sic) effect row beside the "Assassinate" feature row** (2026-09-02) | The PHB ships the feature's transfer effect misspelled, and `EFFECT_BENDS` carries it under that name; the clock row is keyed by the FEATURE's correct name. If the pack fixes the spelling the effect row's key must follow. |
| **The PHB's Half Speed leaves an NPC's speed at 30 on dnd5e 6.0** (2026-09-16, `smoke-emanations` §6c) | The effect lands (the module's part); dnd5e's one-hop moved-key table then overwrites the number (NOTES §2 — the same bug read Roving's +10 as "3510"). Misc Patches' `shim-chains.js` follows the chain when enabled. Nothing in the module writes movement. |
| **The Monster Manual's Adult Green Dragon writes Noxious Miasma's −2 AC against an armor item's field** (2026-09-15) | `system.armor.value` ADD −2, the one base effect in every premium book that writes an item field onto a creature (measured). A remap row was built, proven and REMOVED the same day: one monster's slip is a carve-out. The world record is fixed on prod (`system.attributes.ac.bonus`); a fresh import of the Adult or Ancient Green Dragon brings the slip back. The upstream bug report is the user's call. |
| **The PHB's Necrotic Shroud (Celestial Revelation) frightens for 60 seconds** (2026-09-24, the Slice A inventory) | The pack's effect lasts 60 s with a `turnStart` expiry; the rule says "until the end of your next turn". A WORLD-DATA defect, not module work: fix the effect's duration on the character's copy (N1 — fix the content, never a carve-out in the module). Its `save.ability` is also stored as a bare string (`"cha"`), not a set. **Settled by** an Aasimar at the table (the copy fixed then), or the pack fixing it; the upstream report is the user's call. |
