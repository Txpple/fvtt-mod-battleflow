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
| **Response message** | `respondsTo` + the answer | A player can only write their *own* message — this is the answer channel that needs no permission. See **the relay** below |
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

### The relay — the answer channel, one shape

A player cannot write someone else's message, so when the answerer is not the client that owns
the flag, the answer travels as **its own public message carrying an envelope**, and the owning
client folds it in. Three machines need that: the hold's answer (`respondsTo`), a save's choice
(`saveChoiceAnswer`), a riposte's (`riposteAnswer`).

Each hand-wrote the same skeleton with its own `createChatMessage` registration until 2026-08-23.
They now declare themselves to **one registry in the spine** — `registerRelay(envelopeKey,
{ flagKey, targetOf, owns, fold })` in [ui.js](scripts/ui.js) — served by a single registration
(module-wide `createChatMessage` count 15 → 13).

⚠ **`owns` is why this is a registry and not a merge.** The hold's fold is owned by the
**continuing client**; the other two by the **elect**. A three-into-one merge would silently move
the hold's fold onto the elect — the same trap as its clock, on the most-used feature at the
table. `owns` receives the target's live flag so `isContinuingClient(flag)` can answer; the
elect-owned relays ignore the argument.

⚠ **The envelope SHAPES are deliberately not unified.** The hold's is flat sibling flags
because that same message also carries an `effectReceipt` for receipts.js to render. Flattening
it into a nested object is a **wire-format change** on messages players write and another client
reads — an answer in flight across a deploy would simply stop folding. `targetOf` exists so each
relay names its own shape. **Unify the mechanism; leave the bytes alone.**

⚠ `respondsTo` is **polymorphic** — concentration and saves stamp it too, for their own
answer paths. The relay self-selects on the target's flag, which is why `flagKey` is part of the
declaration rather than inferred.

✅ **THE RELAYED HALF IS TESTED AS OF 2026-08-23, and it never had been.** When the answerer can
write the target message the envelope never travels at all — so every single-client suite in the
tree exercises the direct path and nothing else, and `owns` was an argument nobody had put to a
machine. [smoke-twoclient.mjs](tools/smoke-twoclient.mjs) §relay holds a **player-owned** target
against a **GM-rolled** attack and follows the envelope the whole way: the answer is the player's
own message, authored by the player, stamped `respondsTo`; the **continuing client** — not the
elect — folds it and runs the hold to a verdict. ⚠ Only the hold's relay is covered; saves'
`saveChoiceAnswer` and maneuvers' `riposteAnswer` are the two ELECT-owned ones and remain
single-client-tested. Their `owns` is the trivial branch, which is the argument for the priority,
not for stopping.

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

### The kinds the code knows — the R4 tripwire, measured

Declared once in [decide/registry.js](scripts/decide/registry.js) as `KIND_SETS`, printed by
`npm run verify`, and **pinned**: adding a kind fails the gate until the pin moves deliberately.

| Set | Kinds | Against | The kinds |
| --- | --- | --- | --- |
| interrupt | 2 | module-owned | ac · damage |
| maneuverFold | 5 | module-owned | precision · riposte · interpose · bash · hew |
| volley | 2 | module-owned | damage · attack |
| mastery | 7 | **of the system's 8** | vex · sap · cleave · slow · topple · push · graze |
| **total** | **16** | pinned in `check-registry.mjs` | |

⚠ **"Checkable against the system's own enums" is true for exactly one of the four, and that is
not a gap to be closed.** Masteries mirror a real system enum, and they *are* checked against it
— live, by [check-mastery-rules.mjs](tools/check-mastery-rules.mjs), which reads
`CONFIG.DND5E.weaponMasteries`. The other three are the module's own inventions: dnd5e has no
concept of an "interrupt kind" or a "fold kind", so there is nothing to check them against.
What the static gate proves instead is that each set is **closed, declared in one place, and
that every registry entry names a kind from it**.

⚠ `nick` is the system's eighth mastery and is **deliberately** native — pure action economy,
which ruling 1 puts outside this module. That is why it is *declared* (`MASTERY_NATIVE`) rather
than merely absent: in a `switch` statement a decision and an oversight look identical, and the
bare `default: return` meant a ninth mastery arriving in a dnd5e release would have been
swallowed in silence. It now warns once, naming the tripwire.

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
   ⚠ **Amended 2026-08-23 (Phase 3):** a spec may declare a **fallback** — a substitution the
   parser applies instead of dropping — and it still warns. Exactly one exists: the interrupt
   list reads an unrecognised kind as `ac`, because a mistyped interrupt is still a reaction
   worth pausing for and `ac` is the conservative reading, where a fold with no recognised kind
   has no machine to run at all. The amendment is about *visibility*, not laxity: the behaviour
   predates it and was buried in a parser body, where a typo looked like a working entry. **A
   DECLARED fallback is legal; an undeclared one is still a bug.**

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

⚠ **Mostly repaid, 2026-08-22 (§10 D1).** `hold.js` used to carry shared services that six
other files imported, so every machine depended on a *feature*. `canAnswerFor`,
`isContinuingClient` and `inRunningCombat` now sit in `core.js` beside `isActiveGM` and
`rollerUserFor` — one "who does what" family (§3) — and the interrupt/block list wrappers sit
with the settings surface (§8). **Four machines stopped importing `hold.js` entirely.**

✅ **FULLY REPAID 2026-08-23 (§10 D1/D6).** The second half was `ui.js`, which drew the hold's
row and popup and therefore imported `reactionItem`, `answerHold` and `continueHold` from it —
the spine depending on a feature, and the `ui.js` ↔ `hold.js` cycle. Those 349 lines now live
in `hold.js`, beside the flag they are a view of. **`auto-damage.js` is the only file that
imports `hold.js` at all**, and that is hold's own feature API (`stampHoldIfInterrupted`) on
the deliberate order-pinning edge — correct by this rule, not an exception to it.

> **The rule that generalises from it:** a VIEW belongs with the machine that owns the FLAG it
> renders. When a view lives in the spine, the spine has to import the feature's vocabulary,
> and that is the cycle every time. The spine owns *how* a moment is presented — popups,
> clocks, bars, latches; a machine owns *what* its own moment says.

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
| **D1** | ✅ **CLOSED (2026-08-23).** Stage one (2026-08-22) moved the shared services out: `canAnswerFor`, `isContinuingClient`, `inRunningCombat` → `core.js` (beside `isActiveGM`/`rollerUserFor` — one §3 family); the interrupt/block list wrappers → `settings.js`. Stage two was D6: `ui.js` drew the hold's row and popup and therefore needed `reactionItem`, `answerHold`, `continueHold` — **those views now live in hold.js and that import is gone** | §7 dependency rule | importers of `hold.js`: was `polish`, `saves`, `mastery`, `maneuvers`, `concentration`, `ui`, `auto-damage`; now **`auto-damage` alone**, and that one is a legitimate feature call (`stampHoldIfInterrupted`) on the deliberate order-pinning edge. **No file imports `hold.js` for a service any more** |
| **D2** | ✅ **CLOSED (2026-08-23), and it was far smaller than this row claimed.** ⚠ **The row own evidence had gone stale and nobody re-measured it:** it read "zero uses of `openMomentPopup`, `momentBarHTML`, `momentButton`, `scheduleBarSync`", but at HEAD hold.js used `openMomentPopup`, `momentButton`, `scheduleBarSync` and `shownMoments` — round 3 and D6 had repaid most of D2 as a side effect and the row was never updated. A usage matrix across all six moment machines found **exactly one** primitive hold bypassed: `livePopups`. The reason was `closeAnsweredPopups`, which lived in **ui.js** — a function whose doc line read like a spine primitive but whose body read `getFlag(MODULE_ID, "hold")` and walked the hold per-target array, with exactly one caller. **It was the last place the spine knew a feature existed**, and because it reached the feature by STRING it made no import edge, so D6 cycle break went straight past it and check-imports could never see it. It is `closeAnsweredHoldPopups` in hold.js now, built on `livePopups` — presentation law 4, the same shape mastery, maneuvers, saves and concentration already used. ⚠ `armAskTimer` remains a **deliberate** exclusion, not debt: the hold clock is owned by the continuing client, not the elect, and its per-target answers do not fit the single-answer shape — the same reason maneuvers riposte clock and mastery topple clock also build their own gate on the raw `armDeadline`. The hold was never an outlier there. ⚠ Its views are hold own by D6 ruling, not by omission. ✅ **AND ITS ONE UNTESTABLE CLAIM IS TESTED (2026-08-23):** `closeAnsweredHoldPopups` runs on every client, before the continuing-client gate, because the popup to close is usually on a DIFFERENT client — a property no single-client suite can reach, since when the GM is both answerer and elect there is no second popup. `tools/smoke-twoclient.mjs` §close now has the GM's BUZZER resolve a hold the player is still looking at, and asserts the player's popup vanishes without anyone touching its DOM | §5 mandate | [hold.js](scripts/hold.js) `closeAnsweredHoldPopups` · [smoke-twoclient.mjs](tools/smoke-twoclient.mjs) |
| **D3** | ⚠ **CLOSED WHERE IT WAS A BUG (2026-08-22).** Eight per-target read-modify-writes on shared arrays now go through `queueFlagWrite`, each repeating its guard INSIDE the lock: hold's answer fold and its two effectReceipt merges, mastery's chip applier (whose read sat above an await loop) and its four topple sites. saves.js was done in the correctness pass. **What is deliberately NOT converted**: concentration's ask and mastery's own `mastery` flag are single-decision objects with one writer, so the argument does not reach them | §4 law 2 | the fold was the sharpest: two answers landing in one tick both cloned the same stale flag and the second write dropped the first player's answer — and "one casting answers many holds" is a shipped, tested feature |
| **D4** | ⚠ **RE-MEASURED 2026-08-22, and DEFERRED as a decision rather than a step.** **38 keys, ~230 raw reads, ~66 raw writes, ~300 call sites**; the flag inventory exists as a documentation table rather than as code. ⚠ **Its correctness half was repaid another way**: D3 routed the eight dangerous per-target writes through `queueFlagWrite` *without* the accessor layer, so what remains is the ~230 READS — wide mechanical tidiness that buys nothing a test can assert. "Inventory now, adopt later" is not available: an unimported module in `scripts/` is dead code to knip | §4 | no accessor layer — flag names are string literals at every call site. The superseded figures ("~220 reads, ~51 writes, 14 files") were a stale hand count |
| **D5** | ⚠ **LARGELY REPAID (2026-08-22).** DECISION logic was inlined inside EDGE hook handlers almost everywhere. Six pure modules now stand under `scripts/decide/` and carry **170 unit assertions** that run in ~270 ms with no Foundry. What remains inlined is the judgment that genuinely cannot leave — anything awaiting `fromUuid`, walking documents or reading `game` is EDGE by §2 rule 1, not debt | §2 | `decide/` = geometry, registry, verdict, eligible, receipt, present — **zero imports between them and anything above**; the machines are thin shells over them |
| **D6** | ⚠ **ONE OF THREE CLOSED (2026-08-23), and it was the only one worth closing.** `ui.js` ↔ `hold.js` is **gone**: 349 lines of the hold's own views left the spine for `hold.js`, and ui.js now imports no machine at all. **Two cycles remain, and BOTH are deliberate.** ⚠ `hold.js` ↔ `auto-damage.js` is **load-bearing on purpose**: the bare `import "./auto-damage.js"` pins evaluation order and must not be "fixed". ⚠ `auto-apply.js` ↔ `mastery.js` is breakable by moving `applyDamagesWithReceipt` to its own module, but that is the damage chokepoint every machine routes through — low value, real risk. ⚠ `mastery.js` ↔ `concentration.js` is **not** a cycle | §7 | ui.js 697 → 340 lines; `hold.js` 999 → 1,395. Moved: `reactionImg`, `reactionACBonus`, the hold clocks (`armHoldTimer`/`disarmHoldTimer`/`fireHoldTimer`), `revealDetail`/`revealLine`, the row, `castReaction`, `holdPopupContent`, `showHoldPopup`. **Registrations 75 → 77**: hold.js gained the row's `renderChatMessage` and its own one-line `deleteChatMessage` clock sweep. ⚠ **Three things deliberately did NOT move** — the damage-offer bar (not the hold's; it keeps its own registration in ui.js and still renders above the hold row because hold.js imports ui.js, now an explicit assertion rather than a shared handler), the delete-SWEEP (it clears every machine's popups/latches/acks off one key prefix — spine), and `closeAnsweredPopups` (it reads the hold flag by STRING, so it makes no import edge; a layering smell, not a cycle) |
| **D7** | ✅ **CLOSED (2026-08-22).** `npm run verify` is **six static checks** then the unit tests, all offline, all in seconds: biome (lint + format, 0 errors — 98 warnings is the recorded baseline), knip (dead code), import integrity, hook order, registry integrity, doc attachment, vitest | — | `package.json` · `biome.json` · `knip.json` · `tsconfig.json` · `tools/check-{imports,hook-order,registry,comments}.mjs`. ✅ **AND THE LAST GAP CLOSED 2026-08-23: the type checker is in the gate**, over `scripts/decide/` — six pure modules opted in with `// @ts-check`. ⚠ The measurement that unlocked it: with `checkJs` the layer reports **101 errors, 100 of them "implicitly any"**; with implicit-any allowed, **zero**. The layer was already clean under `strict`/`strictNullChecks`/`noUncheckedIndexedAccess`, so "adopt JSDoc first" was a flag, not a project. `checkJs` stays false globally and files opt in; the JSDoc annotations are a later tightening |
| **D8** | ✅ **CLOSED (2026-08-23).** The post-roll fold is a MECHANISM now, not one feature's special case. `hitsAmong({targets, roll, folds})` takes a LIST; `ATTACK_FOLDS` in [decide/verdict.js](scripts/decide/verdict.js) declares where folds come from, and `foldsFrom(read)` walks it — adding a fold is an entry in that list plus whatever stamps the flag, never a new parameter. ⚠ **The precedence question was a USER RULING, not a code decision, and the answer was COMPOSE THE ARITHMETIC:** folds carry contributions to the two numbers (`ac` / `add` / `replace` / a forced `verdict`) and the verdict is computed once at the end, so *precedence stops existing*. The two alternatives were put and rejected — "the defender always wins" silently eats a spent resource, and "last fold wins" tests the new total against the STALE snapshot AC. ⚠ **The SAVE side existed nowhere and is the half that was real work:** `foldedSave` + `SAVE_FOLDS`, wired live into saves.js's verdict write. **`SAVE_FOLDS` ships EMPTY on purpose** — with no specs the arithmetic is provably today's arithmetic, which is what let the seam land in a pass with no feature work in it | §6 R4 · §2 rule 4 | 31 new unit assertions (184 → 215), every prior behaviour re-asserted against the new shape; the composed case that the old code could not express is asserted both ways (a die that reaches the shielded AC, and one that does not) |

**Every row above is now closed or settled by decision (2026-08-23).** D1, D2, D3, D5, D6, D7 and
D8 are repaid; D4 is **dropped** and the two surviving import cycles are **permanent** — see their
rows for why doing that work would make the tree worse. ⚠ **This table is not a list of things to
do any more; it is a record of what was done and why.** The next entry belongs here only when
something structural is genuinely failing a rule, and it should carry the same shape these do:
the rule it violates, and the evidence.

---

## 11. Adding something new — the checklist

**Adding an ability** (a new reaction, rider, volley spell, maneuver):
1. Is its KIND already in the code? → **one registry or list entry. Stop.**
2. If not: is this genuinely a new kind, or a special case of an existing one?
3. If genuinely new: add the kind, count it against the R4 tripwire, and record why.

**Adding a FOLD** (anything that changes an already-rolled outcome after the fact — a reroll,
an added die, a reaction that moves AC):
1. It is an entry in `ATTACK_FOLDS` or `SAVE_FOLDS` ([decide/verdict.js](scripts/decide/verdict.js))
   plus whatever stamps the flag. **If you are adding a parameter to `hitsAmong`, stop** — that
   is the debt D8 closed, and it grows back one parameter at a time.
2. Pick the contribution shape, and pick it honestly: `add` for a die, `replace` for a REROLL
   (it carries its own crit and fumble — a rerolled natural 20 crits, which is why it cannot be
   an `add`), `ac` for a defender-side change, `verdict` only when there is genuinely no
   arithmetic to do (the negate hold).
3. **Never re-introduce precedence.** The 2026-08-23 ruling is that folds COMPOSE: the attacker's
   move the total, the defender's move the AC, one verdict at the end. A fold that needs to beat
   another fold is a fold modelled with the wrong shape.
4. ⚠ **If it can turn a HIT into a MISS, it owes the table a revert.** User ruling 2026-08-23:
   the module **auto-reverts its own receipt** when a fold reverses a verdict it already applied —
   not the Graze precedent's "announce and let the GM rule", which was the option on the table and
   was not taken. Nothing ships that can do this yet (a hold withholds application rather than
   undoing it, and precision only turns misses into hits), so **the first feature that can is the
   one that must build it**, on `revertPlan`/`revertableEffect` in
   [decide/receipt.js](scripts/decide/receipt.js). Do not let it ship without.
5. Unit-test the arithmetic — this layer decides whether attacks land, and a mistake here
   produces wrong outcomes that look fine in review.

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
5. Move `EXPECTED_SOURCE_FILES` in `tools/check-registry.mjs`, and fix the docs that quote it.
   The count is pinned precisely so adding a file is a decision, not a drift.

**Adding a TEST — the tier rule (the standing rule, PLAN.md FOUNDATION 1.5):**

> **If an assertion does not need a live world, it does not belong in a live suite.**

1. Can it be decided from plain objects? → a **unit test** under `tests/`. 184 of them run in
   **270 ms** with no Foundry, no browser and no fixtures. That is the default, not the fallback.
2. Does it need `game`, `canvas`, a document or the DOM? → a live suite, and then it must join
   an existing **section** or declare a new one (`SECTIONS` + `DEPENDS` at the head of the file),
   so it can be run alone by `--section`.
3. **Never `sleep()` for a thing you can wait for.** Use the suite's `until()` and wait on
   **what the next assertion reads** — the card arriving is not the banner arriving is not the
   card's rendered line arriving. ⚠ A sleep that exists to give a WRONG behaviour time to appear
   is load-bearing and must stay a sleep; say so in a comment beside it, because the next reader
   will otherwise "optimise" the assertion away.
4. The live battery is 12–18 minutes and the unit tests are a quarter of a second. Without rule
   1, test time grows in lockstep with feature count forever.

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
