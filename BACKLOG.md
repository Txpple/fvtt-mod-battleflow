# BACKLOG.md — known, deliberately not scheduled

> **What this file is:** things worth knowing about that **nobody owes anybody**. Each was
> found, understood and parked on purpose, with the reason and the thing that would un-park it.
>
> **What it is NOT:** a to-do list. Nothing here blocks a release, a deploy or a battery. If an
> item becomes owed it leaves this file for a commission the user hands the next session. There
> is no standing handoff file, by user call: a commission is written when there is one and
> retired when it is delivered. **One is open: [HANDOFF.md](HANDOFF.md), the spells slice
> (2026-09-28)**; the last before it, the refactor and recalibration, was delivered 2026-09-28. A
> closed item leaves too; its record, like every retired commission's, is git history.
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
| 1 | **Play the last session on v2.0.8, fix-only until the break.** | ✅ done - prod moved to v2.1.0 on 2026-09-26 |
| 2 | **Break, day one: a doc recut, not a refactor** — PLAN.md retired, SWEEP turned into Slice A's drawing, NOTES §2 triaged for 6.x. | ✅ done 2026-09-24 (PLAN.md into ARCHITECTURE's appendix, SWEEP §6) |
| 3 | **Slice A: species and origin feats** — sweep items 1, 2, 3 and 5 with real content behind them (SWEEP §6, RULINGS *Slice A*). | ✅ delivered on main 2026-09-24; **walked by hand** species by species and feat by feat 2026-09-25 (RULINGS *The species walk, continued*, *The origin feats*); **the full battery green** 2026-09-26 (four suite bugs fixed, re-run alone). RELEASED as v2.1.0 and on prod 2026-09-26 (with Vendor Fixes v1.1.0); the user's event audit is still theirs. **The table proves it:** nothing in it is done until a character built from it has played — the next campaign's session 1 is the walk |
| 4 | **The feats slice — PHB only** (the user, 2026-09-26: player-facing first, DESIGN N3; "keep the splat books out for now" — Arcana Unleashed and Heroes of Faerûn wait). The 2024 PHB general feats that touch a fight and are not yet in (SWEEP §3 (d): a third known) — Sentinel and Polearm Master (a reaction attack, Riposte's shape), Great Weapon Master's rider, the reroll kinds (items 5 and 6) — measured first, the precedent row named per feat (SWEEP §1), a prototype for anything UI-shaped. | **begun 2026-09-26 with the party's own** (RULINGS *The PHB feats — the party's own*): Great Weapon Master's damage and Heavy Armor Master's block built, WALKED by the user and released as **v2.2.0** (on prod the same day); Shield Master, Hew and Fey-Touched were native already. **The rest SCOPED 2026-09-26** (RULINGS *The PHB feats — the scope*): epic boons out, 19 feats out, 13 to build, 5 kept open. **Groups 1–3 BUILT 2026-09-26** (RULINGS *The PHB feats — groups 1–3*: the damage rules, the range cancellers, the on-hit riders), suites green, **WALKED the same day** (with Poisoner's Poison Coating, a rule of cool; Healer automatic, Elemental Adept's type pick and floor through a reroll — RULINGS *The dice changers*), the full battery green, **RELEASED as v2.3.0** (2026-09-27) and on prod. **Groups 4–6 and Polearm Master** (RULINGS *The PHB feats — groups 4–6*) WALKED and RELEASED as **v2.4.0** (2026-09-27), the fix pass after them as **v2.5.0**. ✅ **The PHB feats scope is done.** |
| 4a | **The refactor and recalibration** (the user, 2026-09-27: "we will push our future slices down in priority so we can level set here a bit"): measured against the peers' repos, then comments, the content shape, machine hygiene and release discipline, in that order. | ✅ **delivered 2026-09-28**, its commission retired (ARCHITECTURE appendix *Decided against*: the before and after). The same day the corpus was measured and drawn book by book ([audits/](audits/README.md)) and the order set off the drawings (RULINGS *The slice order, off the drawings*): spells, then Slice B, then session 0 |
| 4a′ | **The spells slice** — the PHB spells ([audits/drawings/spells.md](audits/drawings/spells.md)): eight rows, the repeating-save kind (Hold Person the customer), three prototypes (the placed area that pulses, Sanctuary, Mirror Image). | **commissioned 2026-09-28** — HANDOFF.md; **all three tiers BUILT the same day** (RULINGS *The spells slice — Tiers 1 and 2* and *Tier 3*: four rows measured native, five rows + the turn-start grant, the repeating save as a kind, the `area` emanation kind, the wards and the duplicates; suites green, pushed), **UNWALKED and unreleased — the walk of all three tiers is deferred by the user**; **the held spells BUILT the same evening** (RULINGS *The spells slice — the held spells*: Warding Bond, Vampiric Touch, Prismatic Spray, Wall of Fire, Spike Growth, Magic Circle and Forcecage partially, Counterspell native by the user's ruling — three tables that are not kinds, vocabulary on two, no kind moved) and **the PHB spell register generated** ([audits/spells-register.md](audits/spells-register.md), `tools/audit-spells-register.mjs`); ✅ **the spells slice is BUILT end to end** — its walk (Tiers 1–4) and its release wait; the DMG register generated after it and the DMG ruled out (RULINGS *The DMG register*); Slice B next (HANDOFF.md) |
| 4b | **Slice B: the GM's side** — the Monster Manual traits the sweep never surveyed (Magic Resistance, Legendary Resistance's neighbours, Regeneration, Undead Fortitude, Relentless) and Arcana Unleashed's 38-monster bestiary. Independent of who the next party is, so it comes before the class walk. **Owns the rest of the kill moment**: the machine is BUILT (2026-09-25, the Orc walk — `drop-to-one.js`, the DROP_TO_ONE table: Relentless Endurance asked, Death Ward automatic). **Redrawn 2026-09-28** ([audits/drawings/monsters.md](audits/drawings/monsters.md)): the 2025 book has no Relentless trait; five shapes — Undead Fortitude and Death Throes on the drop machine, Legendary Resistance on the succeed fold, Magic Resistance on a `vsSpells` save facet, Regeneration on the turn-start grant — then the harmful aura rows and the reaction rows. | **commissioned 2026-09-28 (night)** — HANDOFF.md: three stages (the five shapes; the aura rows and the attack bends; the reaction rows), the seams and facets measured, the user's go given (*"lets move on to slice B"*). The DMG before it was **ruled out** the same night (RULINGS *The DMG register*: the register generated, nothing built — high impact, limited value) |
| 5 | **Session 0 of the next campaign sets Slice C onward** — the party's actual kit one level band ahead of play, never the whole subclass corpus blind; [audits/drawings/classes.md](audits/drawings/classes.md) is the map (every class and subclass drawn 2026-09-28; the reroll kind and four prototypes wait for their player). The hit menu's next groups (Brutal Strike, Stunning Strike, Open Hand, Psionic Strike, Arcane Shot) arrive when a Barbarian, Monk or Arcane Archer sits down. Arcana Unleashed's origin feats wait with the other splat books (the user, 2026-09-26: PHB only for now). | after B |
| 6 | **Platform passes stay their own step, never inside a slice** — one per dnd5e minor, one for Foundry 15; the 6.0 pass cost a major version. | standing rule |

An architecture pass was decided against on 2026-09-24 and taken on 2026-09-27, once the
feats were done, and delivered 2026-09-28: ARCHITECTURE's appendix *Decided against*.

## Architecture

### Phase 2's residue (2026-09-27)

- **The membership plumbing.** Every membership reader (`effectEntries()`, `emanationEntries()`…)
  now returns every row of its table, so the `listed` sets and the decide/ functions' `listed`
  parameters are always true. Removing them is a cleanup that touches decide/ signatures and
  their tests; nothing behaves differently until then.
- **The suites' retired keys.** The suites still write retired setting keys, translated in the
  page by `tools/harness.mjs` `retireSettings`. Strip those writes suite by suite, then retire the
  translation.
- **Effects are still found by name.** ActiveEffects carry no identifier: the effect table's 48
  effect-keyed rows and the `effect` fields match the effect's name. The effect's origin item has
  one, a candidate key when a renamed effect bites.
- **A suite's teardown leaves `noCover` on the scenes.** The full battery of 2026-09-28 ended with
  every scene still flagged (verify-settings --fix cleared them): some suite exits without the
  harness teardown. Find it, or clear the flags in the battery's closing sweep.
- **Rule pointers name the Player's Handbook pack.** An item pointer falls back to the system's
  2024 packs by identifier when its `uuid` does not resolve (a table without the PHB module); a
  rules-page pointer reads `CONFIG.DND5E`.


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

## The PHB feats — parked from the scope (2026-09-26)

Parked from the scope (no precedent row; un-parked by a player taking one): Charger, Grappler's
Punch and Grab, Mounted Combatant's rest, War Caster's Reactive Spell.

## Features — surveyed, not scheduled

| Item | Shape |
| --- | --- |
| **Whole-chat-log scans on hot paths** (2026-09-28, the repo review) | `demandCards` (every save roll), `holdPendingFor` (every activity use), `answerHoldsFor`, the riposte and bash-offer lookups walk `game.messages.contents`. Correct — a tail misses, one round emits dozens of messages — and constant work that grows with a world's age; nothing at the table has felt it. ARCHITECTURE §4 *Accepted trade-offs*. **Un-parked by** a measured stall on the house world, or a world past a few tens of thousands of messages. |
| **Cover against an area's save** (2026-09-27, measured cover) | The 2024 DMG measures an area's cover from its point of origin, for the Dex save's +2/+5; *Measured cover* (RULINGS) is built for attacks only. The corner-line counter (`decide/cover.js`) takes any rectangle as the origin already. **Un-parked by** a table that wants it. |
| **smoke-metamagic logged "Save consequences failed … reading '_id'" once, in a full battery** (2026-09-27) | 110/111 in the v2.4.0 floor battery (every rule row green; the red was the no-errors row), 111/111 alone. The error names no section and carried no stack — the suite now records each error's top stack frames. **Un-parked by** the next red of it — read the frames. |
| **The PHB's own "Slashed" effect, applied by hand** (2026-09-26, group 3) | The pack ships ONE "Slashed" for Hamstring's speed −10 and the crit's Disadvantage; the module lands "Hamstrung" and "Slashed" apart, but a GM who drags the pack's own effect onto a creature gets the Disadvantage counted too (`EFFECT_BENDS` reads by name). A data slip, not a carve-out; said here so a table that sees it knows why. |
| **The abilities sweep** (surveyed 2026-09-02; SHELVED 2026-09-03: "a longer term project"; un-shelved slice by slice 2026-09-24) | [SWEEP.md](SWEEP.md): the 2024 corpus sorted into the module's eight mechanism families, what each kind would need, a suggested order. Its three questions are ruled (SWEEP §5). Rescanned 2026-09-24; Slice A delivered (SWEEP §6). The next slice is *The long-term order*, above. |
| **Arcana Unleashed — the fifth premium book, installed on both boxes, unread by the module** (2026-09-24) | `dnd-arcana-unleashed` v1.0.1, a 2024-rules expansion on magic: 8 subclasses and 61 features, 37 feats, 33 spells, 69 magic items with a standalone Active Effects pack, a 38-monster bestiary — measured by [tools/probe-premium-module.mjs](tools/probe-premium-module.mjs), pack indexes only (SWEEP §2, NOTES §2). **Nothing the module does today changes:** zero name collisions with a registry key, a feature field or a settings default, and none of the 33 spells shares a name with a PHB spell, so no per-spell list (Twinned's exceptions, Spent Areas, Chosen Areas, Effect Choices, Damage Saves, the volleys) has read it. **Settled by** the corpus rescan, then the per-spell lists read against its spells, then rows — a slice of the sweep. Its `.effects` pack is the first ActiveEffect compendium in the house; the effect readers match effects on ACTORS by name and have never met a compendium effect — measure before a row. |
| **The pack's "Assasinate" (sic) effect row beside the "Assassinate" feature row** (2026-09-02) | The PHB ships the feature's transfer effect misspelled, and `EFFECT_BENDS` carries it under that name; the clock row is keyed by the FEATURE's correct name. If the pack fixes the spelling the effect row's key must follow. |
| **The PHB's Half Speed leaves an NPC's speed at 30 on dnd5e 6.0** (2026-09-16, `smoke-emanations` §6c) | The effect lands (the module's part); dnd5e's one-hop moved-key table then overwrites the number (NOTES §2 — the same bug read Roving's +10 as "3510"). Vendor Fixes' VF-001 (`../fvtt-mod-vendorfixes`, formerly Misc Patches' `shim-chains.js`) follows the chain when enabled. Nothing in the module writes movement. |
| **The Monster Manual's Adult Green Dragon writes Noxious Miasma's −2 AC against an armor item's field** (2026-09-15) | `system.armor.value` ADD −2, the one base effect in every premium book that writes an item field onto a creature (measured). A remap row was built, proven and REMOVED the same day: one monster's slip is a carve-out. The world record is fixed on prod (`system.attributes.ac.bonus`); a fresh import of the Adult or Ancient Green Dragon brings the slip back. The upstream bug report is the user's call. |
