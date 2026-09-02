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
| **Rewriting a d20 roll the system produced** | The module never reaches into an evaluated `Roll` and changes its number. It reads the roll, **folds** later inputs in beside it on a module flag, and announces the arithmetic in the open. ⚠ **This does not forbid changing an outcome.** Precision Attack turns a miss into a hit after the fact and has shipped since v1.19.0 ([maneuvers.js](scripts/maneuvers.js) `resolvePrecision`, [decide/verdict.js](scripts/decide/verdict.js) `hitsAmong`): the original message stands as history, the new die posts as its own message, and the verdict is recomputed on the flag. Post-roll folds of that shape are **in scope**; silently editing the system's number is not. ⚠ **And the fold is a MECHANISM as of 2026-08-23**, not one feature's special case: `ATTACK_FOLDS` / `SAVE_FOLDS` in `decide/verdict.js`, composed rather than ordered — the attacker's folds move the total, the defender's move the AC, one verdict at the end (the user ruling; ARCHITECTURE §10 D8, and §11's "Adding a FOLD" checklist). |

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
purpose. Today: **23 kinds across 6 sets** — interrupt 2, maneuver fold 5, d20 fold 3, volley 2,
mastery 7 of the system's 8, reminder 4 (vex, sap, prone, condition — the four ways the gate can
READ a source of Advantage or Disadvantage; the thirteen conditions under the fourth are
membership, declared as such, and deliberately uncounted). The rule is not "no new kinds"; it
is "no *unnoticed* new kinds". Until this
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

### Where a chip belongs on the sheet (user rule, 2026-09-01)

**Combat chips are TEMPORARY effects. Passive is for long-term spells and worn abilities.**

The dnd5e sheet sorts effects into Temporary (has a duration), Passive (has none) and
Unavailable (expired or suppressed), and the section a chip lands in is a statement about what
kind of thing it is. Anything this module applies out of a swing, a save or a reaction — Vexed,
Sapped, Slowed, and the conditions pressed off a failed demand — is a **combat** chip and
carries a real, resolvable duration. Passive is reserved for what a character *wears*: a
long-duration spell, an item's standing benefit, a class feature that is simply true.

Two consequences worth stating, because both have already bitten:

- **A chip with a duration Foundry cannot measure is worse than no chip.** It is filed under
  Unavailable, never renders on the token, and reads to the table as the feature silently doing
  nothing. That was the v1.27.1 Sap report; the cause was a round-based clock stamped against a
  combat that was not `game.combat` (see `activeCombatFor` in core.js).
- **A chip nothing expires accumulates.** Expired mastery chips were never removed from a
  target and piled up on the sheet, hiding whichever one was live. The sweep runs at apply
  time, on the actor being chipped.

**⚠ THE PLATFORM KEEPS THE CLOCK; THE MODULE KEEPS ITS WORD (2026-09-01, HANDOFF R-C).** A
combat chip's duration is not a number this module counts down — it is the RULES TEXT written
once as Foundry v14 expiry data: `{value: 1, units: "rounds", expiry: "turnStart"}` for *"until
the start of your next turn"* (Sap, Slow), `expiry: "turnEnd"` for *"before the end of your next
turn"* (Vex), and `{value: 0, units: "turns", expiry: "turnEnd"}` for the once-per-turn Cleave
chit — each with `start` pinned to the **attacker's own combatant**, because the platform judges
the event against whoever `start` names and its own stamp is merely whoever's turn it is. Foundry
marks the chip expired on the exact boundary, on the GM client; the module deletes what Foundry
marked, and sweeps its chips when a combat is deleted. **Nothing in this module counts turns, and
nothing may start to.** Two things are the module's, because they are events rather than time:
the attack roll that SPENDS Vex or Sap (the rules spend them claimed or not; the spend is a
receipt on the attack card, written before the chip goes), and the chit that makes Cleave's
*"once per turn"* a document rather than a memory. ⚠ **Out of combat there is no clock at all** —
the only tick is world time, which moves only when the GM advances it — so an out-of-combat chip
lives until the spend closes it, and that is the rule, not a gap.

**⚠ Dead is the platform's MARK, never the arithmetic** (review, 2026-09-01). A one-round chip's
`remaining` reads zero for the whole of the round its boundary falls in and the mark arrives only
at the event, so a reader that treated zero as dead dropped Vex on the one turn it exists for.
Zero on the clock is alive; a negative clock — which comes a round after the boundary — is the
one arithmetic fallback, for a table with no GM to write the mark. **The Cleave chit is the
exception that proves it:** its life is a STAMP COMPARISON against the running turn (the
`combatStamp` idiom), pinned to the turn IN PROGRESS rather than to the attacker — an opportunity
attack's chit dies with the victim's turn — because the mark is GM-written and a no-GM table's
first chit would otherwise stand forever. The platform's expiry is its tidy, not its judge.

### The gate before the roll (user rulings, 2026-09-01)

**A reminder is proactive, never a rescue** — *"I don't want a rescue, I want proactivity."* When
something this module can READ bends an attack roll, the gate meets the roller BEFORE the dice:
**inside the system's own Attack Roll dialog** (user ruling 2026-09-02 — *"can't the gate look
more like the native UI?"*). The dialog opens as it always does — forced open even under a
fast-forward key, because a reminder that a shift-click skips is no reminder — and Battle Flow
adds ONE section to it, shaped like the dialog's own CONFIGURATION: **a box per source** (user:
*"boxes holding each condition"*) with the fact, the bend as a badge, and the rule quoted
verbatim; then **the net, only when sources contend** — a lone counted source's badge IS the net
and the line under it was vertical space saying the same thing (user, 2026-09-02) — with the
Rules Glossary's own sentence on why.
The human presses one of the dialog's own three buttons and the roll goes out natively —
the card link, the crit, the attack mode, the ammunition, the mastery, the roll mode, the
situational bonus and the spell's consume choice are all the system's, untouched. **Nothing is
ever applied for the roller** (R1, and the fence in mastery.js). The card says what was shown
and what was pressed, and the stats plane reads honour off it. (The 2026-09-01 shape — a house
popup standing in for the dialog and re-issuing the roll — lasted one day; three of the
review's twenty findings were that re-issue.)

**The highlighted button is the outcome the solver worked out** (user ruling 2026-09-01). The
platform always has a default — a dialog makes its first button the default when none is
flagged, so "nothing pre-selected" meant *Advantage on Enter* whatever the net — and the honest
default is the NET the section names. Enter is still a press. **The section follows the
dialog** (user, 2026-09-02): the dialog re-renders on each of its own dropdowns and the sources
are re-judged from the form as it stands — a dagger switched to Thrown grows its range box and
the default moves with the net — and a re-target on the canvas re-judges too.

**A recorded spend counts as spent** whatever the sheet says: with no GM the chip a player
cannot delete lingers on the monster, and the receipt on the attack card is what keeps it from
being offered and spent again.

**Range is a source like any other** (user, 2026-09-02 — *"bake in the disadvantage at long
range"*; the class, not the example: any RANGED attack roll — a bow, a thrown dagger, a ranged
spell). Both glossary rules, read off the same distance Prone measures and the activity's own
range: beyond normal range is Disadvantage; beyond long range — or beyond a single range —
cannot be made, so it is listed and not counted; an enemy within 5 feet of the attacker is
Disadvantage with the caveat the module cannot judge (*can it see you? is it Incapacitated?*),
the Frightened shape. No range number is the module's.

**The net is the 5e rule, restated by the user as the ruling:** *if multiple sources contend,
it always nets to a regular attack, even if you have more of one than the other* — adv/adv is
Advantage, adv/disadv is normal, adv/disadv/disadv is normal. A source the module cannot judge
(a prone target with no token to measure from, an Incapacitated attacker who should not be
rolling at all) is **listed and not counted**.

**What the gate reads is membership** (R4): the Reminder Sources list names the KINDS — the
attacker's own Vexed chip on a target, a Sapped chip on the attacker, Prone on either side with
the 5-foot geometry, the condition table, and a ranged attack's own range — and the Condition
Sources list names WHICH of the thirteen 2024 conditions count. Both lists are switches; an
empty Reminder Sources list is the gate turned off. **AC5e's knowledge, as data, never its
code** (R-B, sharpened): the thirteen rows carry each condition's *Attacks Affected* clause
verbatim from the world's own glossary, and a fourteenth costs a row and nothing else.

**What the gate never touches:** a roll whose caller suppressed the dialog — the resolver's
own rolls, a volley's rays, a riposte inside a fold, a macro, the suites. No dialog, no gate.

**⚠ PRONE IS THE NAMED EXCEPTION, AND IT STAYS PASSIVE (user call, 2026-09-01).** It is pressed
as a status with no duration, so it sits in Passive — and that is correct rather than tolerated.
5e gives Prone no window: it lasts until the creature spends half its movement to stand. Making
it Temporary would mean inventing an expiry the rules do not grant, and the consequence is not
cosmetic — **it would stand creatures up on a clock nobody rolled for**, including the prone
creature that is choosing to stay down. The section it renders in is a lie worth telling; a
condition that removes itself is not.

The rule above therefore reads: *combat chips carry a duration because their rules give them
one.* Prone has no duration because the rules give it none. Same principle, opposite outcome —
so a future pass that "fixes" Prone into the Temporary section is a REGRESSION, not tidying.
The same holds for any other condition pressed off a failed demand: take the duration from the
rules, and where the rules give none, give none.

---

## 7. How to use this document

- **Before building**, locate the work here. If it is not here, decide whether it is in scope —
  and if so, add it here *first*.
- **When tempted to generalize**, re-read R4 and §4. Breadth of official content is in scope;
  a new extension point never is.
- **When a dnd5e release absorbs a feature**, delete ours and celebrate (§3).
- **When this document and the code disagree**, surface it rather than silently choosing.

---

## 8. Settled — do not re-propose

**Each row is a decision plus the one condition that would reopen it.** Proposing one again
without that condition costs the session twice: once to re-derive the answer, and once to
re-explain why it was already the answer.

⚠ **THIS TABLE LIVES HERE BECAUSE IT OUTLIVED ITS PREVIOUS HOMES.** It began in a continuity
handoff, moved into the rescue-view commission when that retired (`41583c2`), and moved again
when THAT was delivered (v1.24.0) — each time because the document holding it was temporary and
the rulings were not. §7 says to locate work here before building; these are the answers for
work that should not be built at all, so this is where they belong.

⚠ **A ROW LEAVES ONLY BY ITS OWN CONDITION.** "Closed" rows stay: the record of why something is
not being done is worth more than the space it costs, and deleting one invites the proposal it
was written to prevent.

| Settled | The ruling | What would reopen it |
| --- | --- | --- |
| **D9's four remaining machine→machine edges** | **NOT being repaid, and that is the finished answer, not a delay.** Each is pinned in `check-layers.mjs` with its reason and its trigger — see [BACKLOG.md](BACKLOG.md). ⚠ **The pins are SELF-EXPIRING** — repay an edge and the build fails until its row is deleted. | the trigger named in the pin actually arriving |
| **The two permanent import cycles** | `hold.js ↔ auto-damage.js` and `auto-apply.js ↔ mastery.js` are **PERMANENT BY DECISION**. ⚠ The first is **load-bearing**: the bare `import "./auto-damage.js"` pins module evaluation order and `check-hook-order` depends on it. **Doing this work would make the tree worse.** | nothing. Closed. |
| **Tactical Mind's refund** | **STAYS UNMODELLED.** The refund is conditional on the check FAILING, and **no DC exists for an ability check anywhere in dnd5e**. A manual *"Refund"* button was offered and **declined**. | dnd5e recording a DC for raw checks |
| **Widening Heroic Inspiration** to *"any die"* or the transfer clause | **NOT SHIPPING.** Widening to any-die/any-outcome triggers §11 rule 4's auto-revert obligation, and nothing ships that can do it yet. | building the revert machinery first, deliberately |
| **The `smoke-battleflow` flake** | ✅ **CLOSED 2026-08-24 — a real revert bug** (reverting a KILL restored the pool off-card; the lethal branch ran ~one run in eight). Fixed, and `smoke-battleflow` §4c is deterministic about it. | nothing. Closed, reproduced, fixed and pinned |
| **Short-duration effect expiry** (mastery chips) | ✅ **CLOSED 2026-09-01 BY ITS OWN CONDITION — the decision was made, and the answer is that the question dissolves.** It was *blocked on whether this module should own TURN-TIME at all*; measured against Foundry 14.365's own client, **the platform already owns it**: every ActiveEffect carries `start.combatant` and a `duration.expiry` event, the registry refreshes on every turn and round boundary (GM-side) and judges the event against the ORIGINATING combatant. So the module never keeps a clock — it writes each chip's RAW window once (`decide/chips.js`), and owns only EVENTS: the attack roll that SPENDS Vex or Sap, the once-per-turn Cleave chit, and tidying what Foundry marked expired. See §5 *"the platform keeps the clock"* and HANDOFF Stage 1. | nothing. Closed — and a future pass that builds a module-side sweeper or turn counter is a REGRESSION, not a feature |
| **A reaction-budget abstraction** | **REJECTED.** Action economy is not this module's job; every read of `reactionSpent` is an *offer gate*, never enforcement. | nothing. Closed. |
| **Hand-carrying any counted number into prose** | **DON'T.** ⚠ **Quote the tool's output; never retype it.** | nothing. This is a standing rule. |
| **A post-roll "second die" rescue for a forgotten Advantage** | **NOT SHIPPING** (user, 2026-09-01: *"I don't want a rescue, I want proactivity"*). The reminder is the GATE before the roll (§5); a rescue that rolls a second d20 after a flat roll is the shape that was put and declined. | the user asking for it, by name |
| **Netting multiple sources of Advantage/Disadvantage by count** | **NEVER.** Any Advantage against any Disadvantage is a normal roll, however many of each (user ruling 2026-09-01; the Rules Glossary's own sentence). A "majority wins" reading is wrong and stays wrong. | nothing. It is the rule. |
| **Vendoring AC5e's code** | **CLOSED 2026-09-01 — its TABLE shipped as data instead** (DESIGN §5 *the gate*; `decide/reminders.js` `CONDITION_BENDS`). Its behaviour — silently setting the roll mode — is the thing the user said no to; its geometry features (range bands, nearby foes, flanking, armour, encumbrance) were never wanted. | a table asking for the geometry features, by name |
