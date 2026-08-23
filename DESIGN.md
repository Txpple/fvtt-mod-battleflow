# DESIGN.md — the north star

> **What Battle Flow is for, and how it is allowed to grow.** Every feature, setting and
> refactor must trace back to this page. When a decision is ambiguous, this document wins.
> When this document and the code disagree, that is a bug in one of them — surface it.
>
> This page is meant to be **stable**. It records intent, not progress. Implementation lives
> in [ARCHITECTURE.md](ARCHITECTURE.md); hard-won facts live in [NOTES.md](NOTES.md).

---

## 1. Mission

**Battle Flow makes D&D 5e battles flow.** Attack → hit → damage → save → effect resolves
itself, and the table only touches the moments that are genuinely theirs.

The system — dnd5e on Foundry VTT — already owns all of the hard math: hit determination
against AC, resistance-correct damage, real saving throws, effect application, concentration
linkage. Every link of that chain simply ends at a **button**.

Battle Flow's entire job is **pressing the buttons whose outcomes are already determined**,
while:

- **pausing** where a human genuinely gets a say (the reaction window, the choice),
- **announcing** what matters (hits, spends, breaks, expirations),
- **leaving receipts** everywhere it acts (every application is revertible),
- **never removing the native buttons** — vanilla stays the substrate and the fallback.

## 2. The four north stars

These are the reasons the module exists. They are immutable. Everything in
[ARCHITECTURE.md](ARCHITECTURE.md) is downstream of them.

### N1 — Canon only

The module relies exclusively on **content the compendia already ship, and the mechanics the
system already implements**. Nothing is transcribed, homebrewed, or hard-coded as a number.

- **How much** is always read from the content's own data — a mark's bonus-damage activity, a
  spell's damage parts, a save's DC. The module never stores an amount.
- **Which mechanics** come from the system: `Actor5e#applyDamage` does the resistance math,
  `rollSavingThrow` rolls the save, the native effect-application path applies effects. The
  module chooses *when*, never *what*.
- When content is wrong, **fix the content**, not the module. A module that learns an
  ability's name to work around bad data has taken on a maintenance burden that never ends.

*Sibling rule: this is the same discipline as `fvtt-mcp-molten5e` — premium packs are the
library, and the tooling reads them rather than reproducing them.*

### N2 — The 80/20 rule

5e is too large to encapsulate completely, and completeness is not the goal. **Capture the
flows that actually consume table time; leave the infrequent edge cases to humans.**

- The measure of a feature is *table seconds saved per session*, not rules coverage.
- An edge case is not a bug. "Cast with no GM logged in and nothing applied" is by design.
- The right answer to a rare interaction is usually **announce it and let a human decide**.
- Breadth of official *content* is in scope; breadth of *mechanism* is not (§4).

### N3 — New players first

The module's UI exists so that someone who has never played 5e can take their turn without
knowing which chat card to hunt for.

- **Popups replace card-hunting.** The thing you must answer comes to you, centered, with the
  rule quoted verbatim from the feature's own text.
- **Spends announce themselves.** When a resource is consumed, a reaction is spent, or an
  effect lands, the table is told — an icon appearing or vanishing is never a mystery.
- **Targeting and canvas interaction are made easier**, not more powerful.
- **Nothing is a required answer.** Every moment has a default outcome and a clock; the
  human's control *preempts* the default. A table is never blocked on a player who stepped
  away — unless it explicitly chooses to be (timer 0).

### N4 — Flow

Combat should move. Every design choice is weighed against whether it makes the round faster.

- **GM click economy ≈ zero.** In steady state the GM answers nothing. Any feature that adds a
  recurring mandatory GM click is misdesigned.
- **Automate outcomes, never decisions.** If the rules already determine the result, press the
  button. If judgment is involved, hold for a human — never play it for them.
- **Never block on a human indefinitely** without the table saying so.

---

## 3. Scope

**Battle Flow is a combat-resolution module for D&D 5e 2024, built by dogfooding.**

- **The rules target is 5e 2024 as the dnd5e system ships it.** Curated lists are built by
  sweeping the official compendia, not by asking what the party owns. A spell that exists and
  fits a shipped feature belongs on the list whether or not anyone has cast it.
- **Dogfooding is the development method, and the table sets priority.** Nothing ships that
  has not been played. What the table needs decides *order of work* — never *bounds of scope*.
- **Every feature is individually toggleable and ships OFF**, so the ladder is walked one
  setting at a time and any feature can be killed mid-session without touching the others.
- **Every feature must be individually deletable** the day the system ships it natively.
  Being made redundant is the success condition, not a risk.

### What Battle Flow is not

It is deliberately not midi-qol. midi solves automation with a ~50,000-line workflow engine, a
flags platform, and three hard dependencies (DAE, socketlib, lib-wrapper) — plus wholesale
replacement of eight document classes and 33 patches, pinned per dnd5e minor family. Its
serial in-memory workflow blocks on cross-client prompts with timeouts, which is the source of
its race conditions and its 700-line undo system.

Battle Flow solves the same chain with a few thousand lines, curated lists instead of
platforms, and zero dependencies. The trade is safe because midi's own current code
demonstrates the thesis: it now mostly *orchestrates native dnd5e machinery* — which means a
small module can orchestrate the same public hooks directly.

*(The full source-level evaluation that established this — midi-qol, DAE, dnd5e native
automation, and the 2025–26 ecosystem — was recorded in `RESEARCH.md` and is preserved in git
history. Its conclusions are the paragraph above and §4.)*

---

## 4. Non-goals (permanent)

The 80% of midi-qol this module exists to refuse. These do not get revisited feature by
feature; changing one is a change to this document.

| Refused | Why |
| --- | --- |
| **Reaction automation** — auto-casting, cross-client prompts, timeout protocols | Humans play reactions. The hold is a pause, not a system (N4). |
| **Opportunity-attack detection**, movement-triggered anything | Judgment, not outcome (N4). |
| **Cover / line-of-sight / range math** | The system does not model it reliably; guessing is worse than asking (N2). |
| **Workflow undo** | The per-application revert receipt is the full extent. |
| **A flags / aura platform** | Curated tables only (§5). |
| **Template / AoE target management** | Targeting stays human (N4). |
| **A macro platform** — no OnUse macros, no effect macros | It is someone else's data model. |
| **An extension platform for homebrew** | The answer to "my custom thing needs this" is a list entry, never a new extension point. Breadth of *official content* is in scope; a platform never is. |
| **A no-GM degraded mode** | Unowned actors are a hard permission wall, so any degraded mode would apply mixed target sets *partially* — silent partial application is this module's worst failure class. |
| **Rewriting a d20 roll the system produced** | The module never reaches into an evaluated `Roll` and changes its number. It reads the roll, **folds** later inputs in beside it on a module flag, and announces the arithmetic in the open. ⚠ **This does not forbid changing an outcome.** Precision Attack turns a miss into a hit after the fact and has shipped since v1.19.0 ([maneuvers.js](scripts/maneuvers.js) `resolvePrecision`, [decide/verdict.js](scripts/decide/verdict.js) `hitsAmong`): the original message stands as history, the new die posts as its own message, and the verdict is recomputed on the flag. Post-roll folds of that shape are **in scope**; silently editing the system's number is not. |

---

## 5. The five binding rules

Everything in [ARCHITECTURE.md](ARCHITECTURE.md) is an implementation of these. They are the
rules code review checks against.

### R1 — Automate outcomes, never decisions

Press buttons whose results are fully determined by rules already in the game data. Anything
requiring human judgment is *held for* a human, never performed for one.

### R2 — The chat log is the state and the bus. No sockets, ever

There is no in-memory workflow object anywhere. Every hop is a stateless reaction to a
persisted document that Foundry's own server replication delivers to every client. No client
ever *commands* another: clients **volunteer** actions based on what appears in the log.

This buys, for free, everything a workflow engine hand-maintains: ordering, reload-safety,
permission enforcement, and an audit trail.

### R3 — Zero dependencies. Public hooks only. No patching

No libWrapper, no socketlib, no DAE. No monkey-patching, no document-class replacement, no
private-method wrapping. The only `relationships` entry is a version **pin** on dnd5e — a
compatibility declaration, not a library.

If a feature cannot be built on public hooks plus document writes, it is out of scope.

### R4 — Mechanisms in code, membership in data, amounts in content

The single most important structural rule in the module.

| Layer | Holds | Changing it costs |
| --- | --- | --- |
| **Code** | KINDS of question — an AC-recheck reaction, a damage-reduce reaction, the closed 8-mastery set, the generic save / concentration / cast / volley machines | A code change, a review, a release |
| **Data** (registries + settings lists) | WHICH abilities participate — Shield is an entry, not a code path | One line |
| **Content** (the compendium) | HOW MUCH — every number, every DC, every die | Nothing; it is already correct |

A new ability must cost a **data entry, zero code**. Code grows only when a genuinely new
KIND of question appears.

**The tripwire:** if new kinds start arriving faster than one per phase, that is a signal to
reach for an existing conditions library (AC5e is the standing candidate) — not a licence to
special-case names.

⚠ **The tripwire is now MEASURED, not asserted** (Phase 3). `npm run verify` prints the kinds
table and **pins the total**, so a new kind fails the gate until someone changes the pin on
purpose. Today: **16 kinds across 4 sets** — interrupt 2, maneuver fold 5, volley 2, mastery 7
of the system's 8. The rule is not "no new kinds"; it is "no *unnoticed* new kinds". Until this
existed nobody could state the rate, so the condition above could never actually fire — and
[ARCHITECTURE §10 D8](ARCHITECTURE.md) asserts it already *is* firing on qualitative grounds.

⚠ **"Adopt" means VENDOR AND MODIFY, never take a dependency** (user call, 2026-08-23). This
matters twice over. It is the only reading compatible with **R2** — a library import is exactly
what R2 forbids, so the tripwire as originally written pointed at a remedy the design rules
prohibit. And it reconciles the second reading recorded in PLAN's backlog: **AC5e decorates
rolls** (advantage, disadvantage, auto-crit) **and never applies; Battle Flow applies and never
decorates.** The fence is clean and complementary, which means AC5e is not a *replacement* the
module falls back to when registries fail — it is a body of solved condition math to draw from,
on our own terms, inside our own layering. Vendoring is what makes both statements true at once.

### R5 — Receipts and announcements

Every automated application stamps what it did — prior values, deltas, created-effect ids —
onto the causing message, and offers a revert. Every invisible state change gets a table-facing
line.

An icon vanishing must never be a mystery; a wrong-target hit must never need surgery.

---

## 6. The future: the chit layer

A **later** direction, recorded here so the architecture does not foreclose it, and explicitly
**not** current work.

The end state is a turn-based interaction surface where a player acts through the **chits
associated with their character** — their reactions, their maneuvers, their masteries, their
limited-use resources — presented as a set of live, spendable things rather than as a sheet to
search. The table moment stops being "a popup appears when the module needs an answer" and
becomes "here is everything you could spend right now, and what it would do."

What today's work must preserve for that to be reachable:

- **Every spendable thing is already a registry entry** (R4), so a chit surface is a *view over
  the registries*, not a second inventory.
- **Every moment already declares its subject, its options, its clock and its answer channels**
  in one shape (the moment spine), so a chit is a moment rendered differently.
- **Nothing is keyed to a popup.** The popup is a view; the flag is the state (R2).

No chit work is scheduled. The obligation on current work is only to keep those three
properties true.

---

## 7. How to use this document

- **Before building**, locate the work here. If it is not here, decide whether it is in scope —
  and if so, add it here *first*.
- **When tempted to generalize**, re-read R4 and §4. Breadth of official content is in scope;
  a new extension point never is.
- **When a dnd5e release absorbs a feature**, delete ours and celebrate (§3).
- **When this document and the code disagree**, surface it rather than silently choosing.
