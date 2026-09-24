# BACKLOG.md — known, deliberately not scheduled

> **What this file is:** things worth knowing about that **nobody owes anybody**. Each was
> found, understood and parked on purpose, with the reason and the thing that would un-park it.
>
> **What it is NOT:** a to-do list. Nothing here blocks a release, a deploy or a battery. If an
> item becomes owed it leaves this file for a commission the user hands the next session. There
> is no standing handoff file, by user call: a commission is written when there is one and
> retired when it is delivered. A closed item leaves too — its record is git history.
>
> Three files, three jobs: this file is *not now, and here is why*; [DESIGN.md](DESIGN.md) §8
> is *no, and here is what would change the answer*; [ARCHITECTURE.md](ARCHITECTURE.md) §10 is
> *what was owed and where it went*. Two items here are enforced by tooling and cannot rot in
> place: the layer pins and the coverage pins are checked both ways, so repaying the thing, or
> the platform changing under it, fails the build or the report.

---

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

### The ask at the area lives in the metamagic file (2026-09-24)

The question asked of a caster once a placed area lands — the popup, its clock, the answer that
fills the save demand, the held card — lives in `metamagic.js` (arithmetic in
`decide/metamagic.js`) because Careful and Heightened were its first customer. A spell that
chooses its targets (RULINGS *Spells that choose their targets*) is the second, a third KIND of
the same ask (`choose`) raised by `saves/demand.js` `areaChoiceForDemand`. So a non-metamagic
question is answered in a file named for metamagic, under the flag key `metamagicAsk` — which is
stored on cards, so renaming it is a migration. **Un-parked by** a THIRD customer that is neither
metamagic nor a chosen area: the ask moves to a machine of its own, the flag key kept.

### The template fast-path Foundry 14 took away (2026-08-24)

`saves/areas.js` registers `createMeasuredTemplate` / `updateMeasuredTemplate` to re-derive who
stands in an area the moment it is placed. Foundry 14 dispatches neither (measured,
`tools/probe-surfaces.mjs`: placing a template raises `createRegion`; the update raises nothing).
Nothing is broken: the reliability floor re-derives containment on the card's render hook, and
that floor carries area adoption (`smoke-saves` §8). Re-pointing at the Region hooks is not a
rename — the reader takes a template's flags off a document a Region does not carry. **Do not
delete the two registrations either:** a dead registration costs nothing and a deleted one cannot
come back. The pin in `tools/hook-coverage.mjs` is checked both ways. **Un-parked by** a
table-visible lag in area adoption, or Foundry restoring the names.

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
| **The abilities sweep** (surveyed 2026-09-02; SHELVED 2026-09-03: "a longer term project") | [SWEEP.md](SWEEP.md): the 2024 corpus sorted into the module's eight mechanism families, what each kind would need, a suggested order. Its three questions are ruled (SWEEP §5). Start at SWEEP §0 when it is picked up. ⚠ The corpus grew 2026-09-24 (the row below): the rescan is the first step. |
| **Arcana Unleashed — the fifth premium book, installed on both boxes, unread by the module** (2026-09-24) | `dnd-arcana-unleashed` v1.0.1, a 2024-rules expansion on magic: 8 subclasses and 61 features, 37 feats, 33 spells, 69 magic items with a standalone Active Effects pack, a 38-monster bestiary — measured by [tools/probe-premium-module.mjs](tools/probe-premium-module.mjs), pack indexes only (SWEEP §2, NOTES §2). **Nothing the module does today changes:** zero name collisions with a registry key, a feature field or a settings default, and none of the 33 spells shares a name with a PHB spell, so no per-spell list (Twinned's exceptions, Spent Areas, Chosen Areas, Effect Choices, Damage Saves, the volleys) has read it. **Settled by** the corpus rescan, then the per-spell lists read against its spells, then rows — a slice of the sweep. Its `.effects` pack is the first ActiveEffect compendium in the house; the effect readers match effects on ACTORS by name and have never met a compendium effect — measure before a row. |
| **Rend Mind, a Cunning Strike option no fixture exercises** (2026-09-02) | `CUNNING_OPTIONS.rendMind` is data the unit tests read, but no Soulknife stands on the sandbox, so `smoke-sneak` never drives it live. The first Soulknife at the table is the measurement; a fixture is the fix. |
| **Clock riders with a damage TYPE the rules leave to the player** (2026-09-02) | Divine Strike, Primal Strike and Divine Fury ride with the activity's FIRST type and say so (DESIGN §8). A picker on the offer is one row of controls away if a table asks. |
| **The pack's "Assasinate" (sic) effect row beside the "Assassinate" feature row** (2026-09-02) | The PHB ships the feature's transfer effect misspelled, and `EFFECT_BENDS` carries it under that name; the clock row is keyed by the FEATURE's correct name. If the pack fixes the spelling the effect row's key must follow. |
| **The PHB's Half Speed leaves an NPC's speed at 30 on dnd5e 6.0** (2026-09-16, `smoke-emanations` §6c) | The effect lands (the module's part); dnd5e's one-hop moved-key table then overwrites the number (NOTES §2 — the same bug read Roving's +10 as "3510"). Misc Patches' `shim-chains.js` follows the chain when enabled. Nothing in the module writes movement. |
| **The Monster Manual's Adult Green Dragon writes Noxious Miasma's −2 AC against an armor item's field** (2026-09-15) | `system.armor.value` ADD −2, the one base effect in every premium book that writes an item field onto a creature (measured). A remap row was built, proven and REMOVED the same day: one monster's slip is a carve-out. The world record is fixed on prod (`system.attributes.ac.bonus`); a fresh import of the Adult or Ancient Green Dragon brings the slip back. The upstream bug report is the user's call. |
