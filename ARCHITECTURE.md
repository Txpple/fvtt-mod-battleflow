# ARCHITECTURE.md — how the code holds the north stars

> **The binding structure.** [DESIGN.md](DESIGN.md) says what Battle Flow is for; this page
> says how the code is required to be shaped so it stays that way. Every rule here traces to a
> north star or a binding rule (N1–N4, R1–R5).
>
> Code review of any change starts here. Hard-won facts about Foundry and dnd5e — the things
> that cost a debugging session — live in [NOTES.md](NOTES.md), not here.

---

## 1. The shape in one paragraph

Battle Flow is a set of **stateless hook handlers** that read persisted documents, consult
**registries**, and write persisted documents. There is no workflow object, no session state,
no cross-client messaging. A feature is: a trigger that stamps a flag, one or more views that
render that flag, and a resolver that acts on it and stamps a receipt. Everything else —
popups, timers, cards, buttons — is a *view of a flag*, and is reconstructable from the log
after a reload.

---

## 2. The four layers

Every line of code belongs to exactly one layer. Which layer it belongs to determines what it
is allowed to touch and how it is tested.

```
┌─────────────────────────────────────────────────────────────────────┐
│ EDGE      hook handlers · Foundry/dnd5e API calls · DOM             │  live-tested
│           "when X happens on this client, read Y and call Z"        │
├─────────────────────────────────────────────────────────────────────┤
│ MOMENT    the spine: stamp → route → present → answer → resolve     │  live + unit
│           one implementation, composed by every machine             │
├─────────────────────────────────────────────────────────────────────┤
│ DECISION  pure functions over plain data                            │  unit-tested
│           hit tests, eligibility, verdicts, formatting, parsing     │
├─────────────────────────────────────────────────────────────────────┤
│ REGISTRY  the closed lists: which content participates, in what way │  unit-tested
│           data, not code — one entry per ability                    │
└─────────────────────────────────────────────────────────────────────┘
```

**The rules between layers:**

1. **DECISION never touches Foundry.** It takes plain objects and returns plain values. If a
   function needs `game`, `canvas`, `ui`, `Hooks` or a document class, it is EDGE — split it.
2. **EDGE never decides.** It reads documents, converts them to plain data, calls DECISION,
   and writes the answer back. An EDGE function containing a rules judgment is a bug.
3. **REGISTRY holds no logic** beyond a resolver function per entry, and no amounts (N1).
4. **MOMENT is composed, never copied.** See §5.

> **This layering is the whole test strategy.** DECISION and REGISTRY are unit-testable in
> milliseconds with no Foundry at all; EDGE is what live suites are for. Code that mixes them
> can only be tested the slow way, which is why it must not.

---

## 3. Who does what — the volunteer model (R2)

No client ever sends another client an instruction. Each client volunteers based on what
appears in the replicated log.

| Action | Client that acts | Why that client |
| --- | --- | --- |
| Roll damage after a hit | **Attacker's** | Its attack, its dice; fires on its own roll hook |
| Apply damage / effects | **Active-GM elect** (`isActiveGM()`) | Ownership is a permission fact; a single writer prevents double-apply |
| Roll a PC's save / concentration | **Owning player's** | Their character, their dice |
| NPC saves, offline-owner fallback | **Active-GM elect** | GM owns everything; the fallback keeps the chain moving |
| Answer a moment | **Whoever owns the decision** | Buttons sit with the decider (`canAnswerFor`) |
| Override / adjudicate | **GM** | Rulings sit with the adjudicator; also the AFK fallback |

When the GM's click must make another client act, the GM **flips a flag on a message**. The
flip replicates; the other client reacts to seeing it. That is the only cross-client channel
that exists, and it is not a channel — it is a document.

**Single-writer discipline:** every world-visible write runs on the elect. This is why there is
no no-GM degraded mode (DESIGN §4).

---

## 4. State model — flags on messages (R2)

**All persisted module state is a flag on a document.** There is no other store.

| Where | Shape | Why there |
| --- | --- | --- |
| **Attack / usage message** | the moment flag (`hold`, `mastery`, `saves`, `precision`, `volley`, …) | The moment belongs to the thing that caused it |
| **Damage message** | `receipt`, `effectReceipt` | The application belongs to the roll that caused it |
| **Response message** | `respondsTo` + the answer | A player can only write their *own* message — this is the answer channel that needs no permission |
| **Actor** | `reactionSpent`, `cleaveArm` | Per-creature, per-turn state |
| **Applied effect** | provenance markers | Which module path created it, so revert knows |

### The four state laws

1. **Never key persisted data by uuid.** Foundry expands dotted keys on write, and every uuid
   contains dots — `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }` and every
   lookup misses silently and forever. **Per-target state is an array of entries carrying a
   `uuid` field.** (See NOTES.md; this cost a live debugging session.)
2. **Every per-target flag write goes through the serializer.** Read-modify-write on a shared
   flag is only correct when writes are sequential, and per-target independence makes them
   overlap by design. A lost merge entry is two faults at once: the card under-reports, *and*
   the receipt is the idempotence guard, so the consequence applies a second time. This was
   measured, not theorised.
3. **The flag is the state; the popup and the card row are views.** Any view must be
   reconstructable from the flag alone after a reload, on any client.
4. **Every write that changes the world stamps a receipt** carrying prior values, so revert is
   arithmetic and not guesswork (R5).

### Idempotence and resume

Every consequence carries an `applied` marker and an `answeredAt` timestamp. A resolved-but-
unapplied entry past the horizon re-drives; an applied entry never re-drives. This is what makes
a mid-chain reload or a crashed client safe.

---

## 5. The moment spine (N3)

A **moment** is any point where the module must show the table something and possibly take an
answer. Every moment — a reaction hold, a save demand, a mastery ask, a damage offer, a volley
aim — is the same six-step shape:

```
  STAMP ──► ROUTE ──► PRESENT ──► ANSWER ──► RESOLVE ──► EXPIRE
    │          │          │          │          │           │
  flag on   who may    popup +    the answer  consequence  the default
  a message  answer     card bar   channels   + receipt    outcome fires
```

### The mandate

> **No moment machine may hand-roll stamp, route, present, answer, resolve or expire.**
> New machines **compose** the spine. A new primitive is added only when a genuinely new KIND
> of surface behaviour appears — R4 applied to UI.

This exists because it was violated. Each new machine originally *copied* the idiom instead of
composing it, and every copy drifted: a bar call missing a hidden contract, a whole family
built without the acknowledge concept, eleven separate shown-latches with four different key
shapes. Three walks of table findings traced to that one cause.

### The presentation laws

Each was a user ruling, and each has a table finding behind it.

1. **The popup law.** Easy-to-forget moments get a popup, not just a card.
2. **The pairing rule.** Whenever a popup runs a timer, a **public card** runs the same bar off
   the same deadline — *the popup is for the decider, the card is for the table*. No timed
   popup without its card; no card bar frozen while the popup drains.
3. **Acknowledge resolves.** Any notice button press resolves its card's pending presentation —
   bar gone, recall gone, popup gone.
4. **A popup closes when its question is withdrawn.** A popup asking something the machine has
   already answered is a lie on screen.
5. **Declaration never claims an outcome.** Buttons and cards at decision time state the
   *spend* or the *choice*; only the verdict's settle card states results. (A post-verdict
   choice may state knowns — "Take half" is legal once the save is in.)
6. **Source, then result.** Every follow-up line leads with the ability that caused it.
7. **The stack is a queue in event order.** Concurrent popups form a staircase from a common
   anchor, and **z-order is causal order** — the first moment stays in front, so the player
   clicks through in the order things happened.
8. **The rule line is verbatim.** A popup describing a feature quotes that feature's own 2024
   text, read from the world's own compendium (N1). The module's operational hints ride as
   separate lines, never blended into the quote.
9. **Every icon names itself.** Any icon in a card or popup carries a tooltip naming what it
   depicts (N3).
10. **The moment celebrates.** An attack-damage prompt leads with the hit — "You hit! — roll
    damage" — and a crit says so, loudly and once. A prompt with no attack roll behind it keeps
    its own stakes line instead. New players learn the chain from what the module tells them
    (N3).
11. **Every moment has a clock that RESOLVES it at expiry** — pass for decisions, roll for
    demanded saves, dismiss for reminders. A moment waits forever only by explicit setting.

### Timer mechanics

The **continuing client** owns the one authoritative clock; the deadline is **absolute and
lives on the flag**, so every client derives the same remaining time. Countdown visuals are
built by setting an animation's `currentTime` from that absolute deadline — never with a CSS
animation, whose clock starts only when its element begins rendering (measured: two bars with
identical declared delays drained seconds apart).

---

## 6. The registry model (R4)

### Why registries, and why they are finite

The argument for curated lists over a general engine rests on one measurable fact: **every axis
of 5e's combat mechanics, as the system models it, is a closed enumerated set.** Measured
against this world's premium packs (PHB / MM / DMG / Heroes of Faerûn — 2,768 items, 411
spells; SRD excluded):

| Axis | Size | The set |
| --- | --- | --- |
| Activity types | **12** | attack · save · damage · heal · utility · check · cast · summon · enchant · transform · forward · *(none)* |
| Activation types | **14** | action · bonus · reaction · special · legendary · turnStart · turnEnd · encounter · minute · hour · day · shortRest · longRest · *(none)* |
| Damage types | **13** | + healing/temphp/max as roll kinds |
| Save abilities | **6** | dex 203 · con 183 · wis 155 · str 54 · cha 25 · int 15 |
| Damage-on-save | **3** | half (411) · none (205) · full (18) |
| Conditions | **26** | the system's `conditionTypes` |
| Weapon masteries | **8** | cleave · graze · nick · push · sap · slow · topple · vex |
| Template shapes | **9** | sphere · radius · cube · cylinder · cone · line · wall · square · circle |
| Target-affects kinds | **8** | creature · space · self · willing · object · creatureOrObject · any · ally |
| Consumption kinds | **5** | itemUses · activityUses · spellSlots · attribute · hitDice |
| Recovery periods | **9** | lr · dawn · sr · day · dusk · recharge · turn · turnStart · initiative |
| **Reaction-cost items** | **93 unique** (102 activities) | 85 feats · 10 equipment · 4 weapons · 3 spells |

Those are the KINDS the code is allowed to know about. Everything else — *which* ability, *how
much* — is data (R4). **A registry cannot become a platform, because the axes it keys on cannot
grow without a system release.**

The reaction number is the proof case: 93 items, hand-checkable in an afternoon, of which only
a small fraction are *interrupts* (they change the outcome of an attack already rolled) and
therefore need a pause at all. midi built a general reaction-detection engine for a list that
fits on one page.

### Registry rules

1. **A registry is name-keyed and membership-defining.** Listed means it participates; unlisted
   means it never does. Structural detection from content data is **not** membership — it was
   measured wrong in both directions (a premium spell shipping no count field at all, and a
   teleport spell shipping a count that would have volley-popped its mishap damage).
2. **Entries hold handling, not amounts.** A `kind` naming which machine owns it, plus whatever
   per-entry resolvers that kind genuinely needs. Never a number.
3. **Entries may carry a resolver function** when the rule is per-ability (a projectile count
   that bands by character level). A resolver reads content and returns a value; it never
   writes and never decides policy.
4. **Adding an ability is one entry and zero code.** If it is not, the KIND is missing — add
   the kind deliberately, and count it against the R4 tripwire.
5. **Registries are exposed read-only on the module API** so tooling and suites can inspect
   them. That is inspection, not an extension point (DESIGN §4).
6. **Unknown entries are dropped with a warning, never guessed.** Strict parsing, always.

### Registry vs. settings list

Both are the *membership* layer; they differ in who curates.

- **Code registry** (`volley-registry.js` is the reference implementation) — when entries need
  per-ability *handling* (a kind, a resolver). Shipped, versioned, reviewed.
- **World settings list** — when entries are just names and a kind (the interrupt list, the
  block list, the rider table, the maneuver folds). The table can extend it without a release.

A settings list must parse through a shared strict parser: split, trim, validate the kind
against a closed set, warn once per bad entry, never default.

---

## 7. Module layout and dependency rules

`scripts/battleflow.js` is the only `esmodules` entry; it imports its siblings in a deliberate
order. Plain ES modules, no build step.

### The dependency rule

> **Depend downward only: EDGE → MOMENT → DECISION → REGISTRY.**
> A machine may not import another machine.

Today this is violated in a way that must be repaid (§10): `hold.js` carries shared services
(`canAnswerFor`, `inRunningCombat`, the reaction lookup, the list parsers) that six other files
import, so every machine depends on a *feature*. Those services belong in the DECISION and
MOMENT layers.

### ⚠ Registration order is import-graph order

A file's imports evaluate before its own body, so an "early" file importing a "late" one
registers the late file's hooks **first**. Some same-hook orderings are behavioral (a veto must
register before a capture; a card row's render order is its registration order).

The load-bearing orderings are held by **lazy `import()` edges** and asserted by
`tools/check-hook-order.mjs`, which runs with stubbed globals and needs no Foundry.

> **When adding a same-hook registration in a new file, run the hook-order check.** Making a
> lazy edge static silently reorders hooks.

Cross-file symbols must be **hoisted `function` declarations called at hook time**, never at
module-eval time — that is the only reason the existing import cycles are safe.

---

## 8. The settings surface

**32 settings: 30 world, 2 client.** Every feature is a world setting, default **OFF**.

### Rules

1. **One switch per feature**, and it ships off. Asking the table to opt into the same answer
   twice is the failure this rule exists to prevent.
2. **Entry-point hooks check their toggle; view and continuation hooks check for their flag.**
   An already-stamped moment must still render and resolve after a mid-session kill, or the
   switch strands live state.
3. **A client setting must change only who presses a button, and nothing else.** A save is
   *owed* — the table waits on it, so a per-player opt-out is a world decision wearing a client
   setting. A damage roll is *owned* — nobody is blocked, and the buzzer makes the timing
   identical either way. Only the second shape may be a client setting.
4. **A per-client setting nobody knows to look for must not start wrong.** Which default that
   implies depends on which state is the surprise — centered dialogs ship ON because that is
   what people expect; being *asked* to roll ships OFF because being asked is the surprise.
5. **Every setting joins a divider group and the dependent grey-out sync.** A setting spanning
   two groups must state which condition enables it — a control that reads as inert and still
   fires is a bug.
6. **Every list setting parses strictly** (§6).

---

## 9. The dnd5e contract

The module rides **public hooks and document writes only** (R3). The seams it depends on:

| Seam | Used for |
| --- | --- |
| `dnd5e.rollAttackV2` | the attack trigger — fires on the rolling client, after the message exists |
| `dnd5e.postUseActivity` | the use trigger — spell holds, save demands, volleys, cast payloads |
| `dnd5e.preRollDamageV2` | injecting rider damage parts (crit doubling comes free — see NOTES) |
| `dnd5e.rollDamageV2` / `createChatMessage` | the application trigger on the elect |
| `dnd5e.preApplyDamage` | the veto seam and the receipt's last word — **cancelable, and healing takes the same path** |
| `dnd5e.damageActor` / `healActor` | announcements; fires on all clients |
| `dnd5e.renderChatMessage` | every card row this module draws — fires for **every** message subtype |
| `Actor5e#applyDamage` | the resistance math (N1 — never reimplemented) |
| `Actor5e#rollSavingThrow` / `rollConcentration` | real saves (N1) |
| the message registry (`originatingMessage`, `getAssociatedRolls`) | chain resolution — **we ride the system's registry, never a parallel one** |
| turn events (`dnd5e.preCombatRecovery`, combat hooks) | per-turn clears |

### Version pinning

`module.json` pins the dnd5e 5.3.x family and Foundry v14. This module rides system workflow
hooks and churns with dnd5e minors — that churn isolation is why it is a sibling module rather
than a feature of another.

### The API-drift rule

Every fact about dnd5e's internals that the code depends on is recorded **at the line where it
bit, with the version**, and mirrored in [NOTES.md](NOTES.md). A behaviour we cannot assert
from a public hook is a behaviour we must verify live, not assume.

---

## 10. Known architecture debt

Recorded here because it is structural, not incidental. Each item names the north star or rule
it is currently failing.

| # | Debt | Violates | Evidence |
| --- | --- | --- | --- |
| **D1** | `hold.js` is both a feature and the shared-services module — six files import `canAnswerFor`, `inRunningCombat`, the reaction lookup and the list parsers from it | §7 dependency rule | import graph: `polish`, `saves`, `mastery`, `maneuvers`, `concentration`, `ui` all import `hold.js` |
| **D2** | `hold.js` uses the spine's card and reaction helpers but **none of its popup, bar or latch primitives** — it predates them and still runs its own views | §5 mandate | uses six spine exports (`bfCard`, `reactionImg`, `armHoldTimer`, `disarmHoldTimer`, `reactionACBonus`, `closeAnsweredPopups`); zero uses of `openMomentPopup`, `momentBarHTML`, `momentButton`, `scheduleBarSync`. ⚠ `armAskTimer` is a **deliberate** exclusion, not debt — the hold's clock is owned by the continuing client, not the elect (`ui.js` §THE MOMENT CLOCKS). Unifying it would silently move clock ownership on the most-used feature at the table |
| **D3** | Per-target flag writes bypass the serializer while doing read-modify-write on shared per-target arrays — in `hold.js`, `mastery.js`, `concentration.js`, **and in `saves.js`, which is mixed rather than clean** | §4 law 2 | call sites (`queueFlagWrite`/`setFlag`): hold 0/12, mastery 0/9, concentration 0/3, **saves 7/8**, maneuvers 6/7, volleys 1/2. saves.js holds five bare read-modify-writes on the `saves` key (515, 753, 1145, 1301, 1372); **1145 sits inside the concurrent per-target consequence pass** — the site of the measured double-application this serializer exists for |
| **D4** | ~220 raw flag reads and ~51 raw writes across 14 files; the flag inventory exists as a documentation table rather than as code | §4 | no accessor layer — flag names are string literals at every call site |
| **D5** | ⚠ **LARGELY REPAID (2026-08-22).** DECISION logic was inlined inside EDGE hook handlers almost everywhere. Six pure modules now stand under `scripts/decide/` and carry **170 unit assertions** that run in ~270 ms with no Foundry. What remains inlined is the judgment that genuinely cannot leave — anything awaiting `fromUuid`, walking documents or reading `game` is EDGE by §2 rule 1, not debt | §2 | `decide/` = geometry, registry, verdict, eligible, receipt, present — **zero imports between them and anything above**; the machines are thin shells over them |
| **D6** | **Three** import cycles, safe only by the hoisted-function convention: `ui.js` ↔ `hold.js`, `hold.js` ↔ `auto-damage.js`, `auto-apply.js` ↔ `mastery.js` | §7 | works today; one non-hoisted export away from a load-order failure. ⚠ `mastery.js` ↔ `concentration.js` is **not** a cycle — `mastery.js` imports concentration one way only. ⚠ `hold.js`'s cycle hides from search: its import is a **bare** `import "./auto-damage.js"` with no bindings, so a `from "./auto-damage.js"` grep misses it, and the import is load-bearing (it pins evaluation order) |
| **D7** | ✅ **CLOSED (2026-08-22).** `npm run verify` is **six static checks** then the unit tests, all offline, all in seconds: biome (lint + format, 0 errors — 98 warnings is the recorded baseline), knip (dead code), import integrity, hook order, registry integrity, doc attachment, vitest | — | `package.json` · `biome.json` · `knip.json` · `tsconfig.json` · `tools/check-{imports,hook-order,registry,comments}.mjs`. ⚠ The one gap left is the type checker: `checkJs` is **deliberately off** while JSDoc types are adopted file by file, so `npm run typecheck` passes trivially and is not in the gate |

None of these are table-facing today. All of them raise the cost of the next feature, which is
the definition of debt.

---

## 11. Adding something new — the checklist

**Adding an ability** (a new reaction, rider, volley spell, maneuver):
1. Is its KIND already in the code? → **one registry or list entry. Stop.**
2. If not: is this genuinely a new kind, or a special case of an existing one?
3. If genuinely new: add the kind, count it against the R4 tripwire, and record why.

**Adding a moment:**
1. Compose the spine (§5). Do not write a clock, a latch, a bar or a popup.
2. Walk the six steps and the ten laws explicitly; each is a review checkbox.
3. Name its answer channels — a moment with one channel is usually missing the AFK fallback.
4. Add its receipt and its expiry default. A moment with no default outcome is not finished.

**Adding a file:**
1. Declare its layer (§2) in its header comment.
2. Depend downward only. If you need a service from a machine, the service is in the wrong file.
3. Run the hook-order check.
4. Register nothing at module-eval time except hook callbacks.

**Moving code between files** (an extraction, a split, a reorder):
1. **Cut on function boundaries, never comment boundaries.** `grep -n "^function "` is the
   guide. A `/**` block does not reliably belong to the function beneath it — measured
   2026-08-22, eight in this tree did not.
2. **Check the comment either side of every block you move.** The doc above the first line
   you take may belong to something else; the doc left behind may belong to what you took.
3. **A doc that describes moved code moves with it, or folds into whatever replaced it.**
   Two extractions lost real knowledge this way — the hobgoblin-shield story behind
   `isReactionItem`, and the warning that the save-side dead gate is deliberately *not*
   mastery's predicate. Both would have been re-derived at the table.
4. `npm run comments` enforces the mechanical half (`tools/check-comments.mjs`, in the verify
   gate). It catches a stranded block; it cannot tell you the prose is now wrong.

**Any change:**
1. Which north star does it serve? If none, it is not in scope.
2. Does it add a required GM click? → redesign (N4).
3. Does it store a number that content already knows? → read it instead (N1).
4. Does it apply anything without a receipt? → not finished (R5).
