# DESIGN.md — the north star

> **What Battle Flow is for, and how it is allowed to grow.** Every feature, setting and
> refactor must trace back to this page. When a decision is ambiguous, this document wins.
> When this document and the code disagree, that is a bug in one of them — surface it.
>
> This page records intent, not progress. The rulings that shaped each feature live in
> [RULINGS.md](RULINGS.md); the structure in [ARCHITECTURE.md](ARCHITECTURE.md); platform facts
> in [NOTES.md](NOTES.md); what is known and deliberately not scheduled in
> [BACKLOG.md](BACKLOG.md).

---

## 1. Mission

**Battle Flow makes D&D 5e battles flow.** Attack → hit → damage → save → effect resolves
itself, and the table only touches the moments that are genuinely theirs.

The system — dnd5e on Foundry VTT — already owns the hard math: hit determination against AC,
resistance-correct damage, real saving throws, effect application, concentration linkage. Every
link of that chain ends at a **button**. Battle Flow's job is **pressing the buttons whose
outcomes are already determined**, while:

- **pausing** where a human genuinely gets a say (the reaction window, the choice),
- **announcing** what matters (hits, spends, breaks, expirations),
- **leaving receipts** everywhere it acts (every application is revertible),
- **never removing the native buttons** — vanilla stays the substrate and the fallback.

## 2. The four north stars

The reasons the module exists. They are immutable; everything in ARCHITECTURE is downstream.

### N1 — Canon only

The module relies exclusively on **content the compendia already ship and the mechanics the
system already implements**. Nothing is transcribed, homebrewed, or hard-coded as a number.

- **How much** is read from the content's own data — a mark's bonus-damage activity, a spell's
  damage parts, a save's DC. The module never stores an amount.
- **Which mechanics** come from the system: `Actor5e#applyDamage` does the resistance math,
  `rollSavingThrow` rolls the save, the native path applies effects. The module chooses *when*,
  never *what*.
- When content is wrong, **fix the content**, not the module.

*Sibling rule: the same discipline as `fvtt-mcp-dnd5e` — premium packs are the library, and the
tooling reads them rather than reproducing them.*

### N2 — The 80/20 rule

5e is too large to encapsulate, and completeness is not the goal. **Capture the flows that
consume table time; leave the infrequent edge cases to humans.**

- The measure of a feature is *table seconds saved per session*, not rules coverage.
- An edge case is not a bug. "Cast with no GM logged in and nothing applied" is by design.
- The right answer to a rare interaction is usually **announce it and let a human decide**.
- Breadth of official *content* is in scope; breadth of *mechanism* is not (§4).

### N3 — New players first

Someone who has never played 5e can take their turn without knowing which chat card to hunt for.

- **Popups replace card-hunting.** The thing you must answer comes to you, centred, with the
  rule quoted verbatim from the feature's own text.
- **Spends announce themselves.** An icon appearing or vanishing is never a mystery.
- **Nothing is a required answer.** Every moment has a default outcome and a clock; the human's
  control *preempts* the default. A table is never blocked on a player who stepped away unless
  it explicitly chooses to be (timer 0).

### N4 — Flow

Combat should move. Every design choice is weighed against whether it makes the round faster.

- **GM click economy ≈ zero.** In steady state the GM answers nothing. A feature that adds a
  recurring mandatory GM click is misdesigned.
- **Automate outcomes, never decisions.** If the rules determine the result, press the button.
  If judgment is involved, hold for a human.
- **Never block on a human indefinitely** without the table saying so.

---

## 3. Scope

**Battle Flow is a combat-resolution module for D&D 5e 2024, built by dogfooding.**

- **The rules target is 5e 2024 as the dnd5e system ships it.** Curated lists are built by
  sweeping the official compendia, not by asking what the party owns. A spell that exists and
  fits a shipped feature belongs on the list whether or not anyone has cast it. The 2014 packs
  are ignored (SWEEP §5).
- **Dogfooding is the development method, and the table sets priority.** Nothing ships that
  has not been played. What the table needs decides *order of work* — never *bounds of scope*.
- **Every feature is individually toggleable, and ships ON** (user, 2026-09-03). A fresh table
  gets the configuration this table plays; any feature can be killed mid-session without
  touching the others. The shipped defaults are the reference table in
  `tools/verify-settings.mjs`.
- **Every feature must be individually deletable** the day the system ships it natively. Being
  made redundant is the success condition.

### What Battle Flow is not

It is deliberately not midi-qol. midi solves automation with a ~50,000-line workflow engine, a
flags platform, three hard dependencies, wholesale replacement of eight document classes, and a
serial in-memory workflow that blocks on cross-client prompts — the source of its race conditions
and its undo system. Battle Flow solves the same chain with a few thousand lines, curated lists
instead of platforms, and zero dependencies. The trade is safe because midi's own current code
mostly *orchestrates native dnd5e machinery* — so a small module can orchestrate the same public
hooks directly. (The source-level evaluation that established this is `RESEARCH.md` in git
history; its conclusions are this paragraph and §4.)

---

## 4. Non-goals (permanent)

The 80% of midi-qol this module exists to refuse. These are not revisited feature by feature;
changing one is a change to this document.

| Refused | Why |
| --- | --- |
| **Reaction automation** — auto-casting, cross-client prompts, timeout protocols | Humans play reactions. The hold is a pause, not a system (N4). |
| **Opportunity-attack detection**, movement-triggered anything | Judgment, not outcome (N4). **Emanations are the one exception** (user, 2026-09-03): an aura applying to whoever stands inside it is an OUTCOME the rules determine, and Foundry 14 models the area itself — a Region attached to the token tracks who is inside and raises the events. What stays refused is the MODULE doing range math on movement; the trigger is the platform's membership (RULINGS *Emanations*). |
| **Cover / line-of-sight / range math** | The system does not model it reliably; guessing is worse than asking (N2). ⚠ Geometry a rule's own clause needs — the range bands, a foe within 5 feet, an ally beside the target — is the module's own reading of the map, not this row (R1). |
| **Workflow undo** | The per-application revert receipt is the full extent. |
| **A flags / aura platform** | Curated tables only. Emanations are curated ROWS over the platform's own Region behaviour — no aura engine, no distance polling, no flag vocabulary of our own. |
| **Template / AoE target management** | Targeting stays human (N4). A spell whose text chooses its targets asks the caster who (RULINGS *Spells that choose their targets*); the module never picks. |
| **A macro platform** — no OnUse macros, no effect macros | Someone else's data model. |
| **An extension platform for homebrew** | "My custom thing needs this" is answered by a list entry, never a new extension point. |
| **A no-GM degraded mode** | Unowned actors are a hard permission wall; a degraded mode would apply mixed target sets *partially*, this module's worst failure class. |
| **Rewriting a d20 roll the system produced** | The module never changes an evaluated `Roll`'s number. It **folds** later inputs in beside it on a module flag and announces the arithmetic (`ATTACK_FOLDS` / `SAVE_FOLDS` in `decide/verdict.js`, composed: the attacker's folds move the total, the defender's move the AC, one verdict). Changing an OUTCOME this way is in scope — Precision Attack turns a miss into a hit after the fact, the original message standing as history. Silently editing the system's number is not. |

---

## 5. The five binding rules

Everything in ARCHITECTURE is an implementation of these. They are what code review checks.

### R1 — Automate outcomes, never decisions

Press buttons whose results are fully determined by rules already in the game data. Anything
requiring human judgment is *held for* a human, never performed for one.

**Game logic is not judgment** (user, 2026-09-22). A condition the table's own data settles —
which side a token is on, how far apart two tokens stand, whether a creature carries a status —
is a FACT to read, not a decision to hold. Before a rule's clause is parked as "the player's
call", ask whether those facts compute it; if they do, it is in scope. What stays held is what
they cannot settle — a creature's choice, a guess at intent — and a side the data leaves unnamed
(a neutral or secret token) is counted, never guessed.

### R2 — The chat log is the state and the bus. No sockets, ever

There is no in-memory workflow object anywhere. Every hop is a stateless reaction to a persisted
document that Foundry's own replication delivers to every client. No client *commands* another:
clients **volunteer** actions based on what appears in the log. This buys ordering,
reload-safety, permission enforcement and an audit trail for free.

### R3 — Zero dependencies. Public hooks only. No patching

No libWrapper, no socketlib, no DAE. No monkey-patching, no document-class replacement, no
private-method wrapping. The only `relationships` entry is a version **pin** on dnd5e. If a
feature cannot be built on public hooks plus document writes, it is out of scope.

### R4 — Mechanisms in code, membership in data, amounts in content

The single most important structural rule in the module.

| Layer | Holds | Changing it costs |
| --- | --- | --- |
| **Code** | KINDS of question — an AC-recheck reaction, a damage-reduce reaction, the closed mastery set, the generic save / concentration / cast / volley machines | A code change, a review, a release |
| **Data** (registries + settings lists) | WHICH abilities participate — Shield is an entry, not a code path | One line |
| **Content** (the compendium) | HOW MUCH — every number, every DC, every die | Nothing; it is already correct |

A new ability must cost a **data entry, zero code**. Code grows only when a genuinely new KIND of
question appears. **The tripwire is measured, not asserted:** `npm run verify` prints the kinds
table and pins the total (`KIND_SETS`, `tools/check-registry.mjs`), so a new kind fails the gate
until someone moves the pin on purpose. The rule is not "no new kinds"; it is "no *unnoticed* new
kinds". ⚠ **"Adopt" a conditions library means vendor its knowledge as data, never take a
dependency** (2026-08-23; R3): AC5e's condition table shipped as rows (`CONDITION_BENDS`), its
code never (§8).

### R5 — Receipts and announcements

Every automated application stamps what it did — prior values, deltas, created-effect ids — onto
the causing message, and offers a revert. Every invisible state change gets a table-facing line.
An icon vanishing must never be a mystery; a wrong-target hit must never need surgery.

---

## 6. The feature rulings

The rulings that shaped each feature — what the user decided, when, the mechanism it settled and
the suite that pins it — live in **[RULINGS.md](RULINGS.md)**, one section per feature:

| Section | Ruled |
| --- | --- |
| The effect view | 2026-09-15 |
| Chips and clocks — where a chip belongs, and who keeps its time | 2026-09-01 → 09-15 |
| The gate before the roll (attack, save and check gates; Sneak Attack; clock riders) | 2026-09-01 → 09-04 |
| Emanations, and the second slice | 2026-09-03 → 09-23 |
| The hit menu | 2026-09-04 |
| The rest of the maneuvers | 2026-09-04/05 |
| Damage shields · Effect choices · A listed reaction cast freestanding · Damage casts | 2026-09-04 → 09-06 |
| Metamagic | 2026-09-09 → 09-24 |
| Spells that choose their targets | 2026-09-24 |

A feature not in that file has no ruling yet: locate the work here first (§7), rule it off a
prototype where it has a UI (the house habit), then write its section.

---

## 7. How to use this document

- **Before building**, locate the work here. If it is not here, decide whether it is in scope —
  and if so, add it here *first*.
- **When tempted to generalize**, re-read R4 and §4. Breadth of official content is in scope; a
  new extension point never is.
- **When a dnd5e release absorbs a feature**, delete ours and celebrate (§3).
- **When this document and the code disagree**, surface it rather than silently choosing.

---

## 8. Settled — do not re-propose

**Each row is a decision plus the one condition that would reopen it.** Proposing one again
without that condition costs the session twice. ⚠ **A row leaves only by its own condition;**
closed rows stay, because deleting one invites the proposal it was written to prevent.

| Settled | The ruling | What would reopen it |
| --- | --- | --- |
| **The remaining machine→machine import edges** | **Not being repaid, and that is the answer.** Each is pinned in `tools/check-layers.mjs` with its reason and its trigger (BACKLOG *Architecture*); the pins are self-expiring — repay an edge and the build fails until its row is deleted. | the trigger named in the pin arriving |
| **The two permanent import cycles** | `hold/index.js ↔ auto-damage.js` and `auto-apply.js ↔ mastery.js` are permanent by decision. The first is load-bearing: the bare import pins module evaluation order and `check-hook-order` depends on it. | nothing |
| **The double reminder on a Vexing or Sapping hit** | Working as intended (2026-09-03): the notice at the hit and the gate box at the next swing are two moments — the chip earned, the chip spent. | the table finding the pair noisy |
| **Tactical Mind's refund** | **Asked, since 2026-09-11.** No DC exists for an ability check anywhere in dnd5e, so after the die is added one window asks: succeeded (keep) or still failed (refund the Second Wind use, receipted). The question states the numbers (2026-09-24): *The check was 12; Tactical Mind's d10 rolled 5, so it is now 17 — Does 17 pass? Ask your GM.* A check WITH a DC asks too. Only Tactical Mind; a scoped tactical fold is a superiority die, spent either way. Pinned by `smoke-d20-folds` §10. | nothing owed |
| **Widening Heroic Inspiration** to damage dice or the transfer clause | **Closed (2026-09-11).** It reaches every d20 test the module meets; the transfer is a table matter; damage-die rerolls would trigger ARCHITECTURE §11's auto-revert obligation and are not wanted. | nothing |
| **Short-duration effect expiry** (mastery chips) | **Closed 2026-09-01 by its own condition:** the platform owns turn-time (every effect carries `start.combatant` and an expiry event, judged GM-side), so the module writes each chip's window once and owns only events (RULINGS *Chips and clocks*). A module-side sweeper or turn counter is a regression. | nothing |
| **A reaction-budget abstraction** | **Rejected.** Action economy is not this module's job; every read of `reactionSpent` is an offer gate, never enforcement. | nothing |
| **Hand-carrying a counted number into prose** | **Don't.** Quote the tool's output; never retype it. | nothing; a standing rule |
| **A post-roll "second die" rescue for a forgotten Advantage** | **Not shipping** (2026-09-01: "I don't want a rescue, I want proactivity"). The reminder is the gate before the roll. | the user asking for it by name |
| **Netting Advantage/Disadvantage by count** | **Never.** Any Advantage against any Disadvantage is a normal roll, however many of each (the glossary's sentence). | nothing |
| **Vendoring AC5e's code** | **Closed 2026-09-01 — its table shipped as data** (`CONDITION_BENDS`). Silently setting the roll mode is what the user said no to; its geometry features (flanking, armour, encumbrance) were never wanted AS AC5e's. Geometry a rule's own clause needs is the module's own reading (R1). | a table asking for the geometry features by name |
| **Spending Sap or Vex on a volley as a whole** | **Not shipping (2026-09-02).** The rules spend them on one attack roll, and each ray is one; ray 1 spends the chip and says so. | a rules revision saying "attack action" |
| **The module resolving a save with no press** (option C of the save gate) | **Never** (2026-09-02). A save the rules fail before the dice gets a Fails button as the default — no dice, still a press. | nothing; the line R1 draws |
| **The module judging Sneak Attack's conditions** | **Reopened 2026-09-22 by its own condition — the ally clause is judged** off the map (R1, game logic is not judgment); the tick stays the player's. | nothing |
| **Asking before a clock rider rides** | **Reversed 2026-09-02:** each due rider is a ticked checkbox on the offer; a declined rider spends nothing. A rider with a choice inside it is not in the table; an open damage type takes the activity's first and says which. | a type picker, by name |
| **Judging once-per-turn for a creature outside the running combat** | **No** (2026-09-02). The chits count only for a combatant; outside combat every hit offers. | nothing |
| **A tooltip on the gate's header line** | **No** (2026-09-02). The arithmetic sentence stays in the view and is not drawn. | nothing |
| **The Reaction as a flag the module clears by hand** | **Retired 2026-09-02** for the chip (RULINGS *Chips and clocks*). | nothing |
| **A combat-stats readout at the table** | **Not here** (2026-09-03). This module WRITES the data plane (`statContext`, ARCHITECTURE §4); `fvtt-app-sessionscribe` reads it. The obligation here is that every new consequence writer stamps the plane. | nothing; the split is the design |
| **Composing a metamagic option used from the SHEET** | **Declined (2026-09-24).** The casting window is where metamagic lives; an armed-chip design earned nothing. | nothing |
| **Composing Tactical Mind used from the SHEET onto the last failed check** | **Declined (user, 2026-09-24: "this is fine forget it").** The rescue offer after a failed check is the surface, and it composes the d10; a sheet use is the platform's own (the use spent, a Bonus roll button) and the module never guesses which check was meant. Same principle as the metamagic row: fix the rules gap, never build a second entry path. | nothing |
