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

⚠ **EDGE holds TWO POPULATIONS, and the dependency rule turns on the difference.** Both touch
Foundry, so both are EDGE by rule 1 — but a **machine** owns a feature (a flag, its views, its
resolver) and a **service** owns none: it is a chokepoint every machine routes a consequence
through (`auto-apply.js` applies damage with a receipt, `effect-riders.js` applies effects with
one, `auto-damage.js` offers and rolls the dice). A machine calling a service is **downward and
always was**; a machine calling a machine is the thing §7's rule forbids. Naming only the KINDS
of code and not these two populations is why the dependency rule read as violated roughly
seventeen times when it morally was not — nine of those edges were a machine calling a service.
**The four kinds are unchanged. The tier list that the dependency rule tests lives in §7.**

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
| **d20Fold** | **3** | module-owned | heroic · tactical · bardic |
| volley | 2 | module-owned | damage · attack |
| mastery | 7 | **of the system's 8** | vex · sap · cleave · slow · topple · push · graze |
| **total** | **19** | pinned in `check-registry.mjs` | |

⚠ **`d20Fold` is the tripwire behaving, and the shape of the bump is the point.** Three kinds
arrived in ONE pass (v1.23.0, the three surveyed d20 features), and they name only what genuinely
differs between them — **the spend**: a boolean write, an `activity.use()`, an effect delete. The
*arithmetic* they share needed no kind at all, because D8 had already lifted it out into
`ATTACK_FOLDS`/`SAVE_FOLDS`. That is the bargain R4 describes working as designed: lift the
mechanism first, and the kinds left over are a short list of residue rather than three copies of
one feature.

⚠ **"Checkable against the system's own enums" is true for exactly one of the four, and that is
not a gap to be closed.** Masteries mirror a real system enum, and they *are* checked against it
— live, by [check-mastery-rules.mjs](tools/check-mastery-rules.mjs), which reads
`CONFIG.DND5E.weaponMasteries`. The other three are the module's own inventions: dnd5e has no
concept of an "interrupt kind" or a "fold kind", so there is nothing to check them against.
What the static gate proves instead is that each set is **closed, declared in one place, and
that every registry entry names a kind from it**.

⚠ **The FOLD CONTRIBUTION SHAPES (`ac` / `add` / `replace` / `verdict`, D8) are NOT an R4 kind
set, and the distinction is worth keeping straight.** R4 counts kinds the code knows about
**CONTENT** — which ability participates, in what way — and the tripwire exists because those
grow one shipped feature at a time. A contribution shape is mechanism vocabulary: it says what
arithmetic a fold performs, and adding a fifth would be a change to what "a fold" means, not a
new ability admitted to a list. `ATTACK_FOLDS` and `SAVE_FOLDS` are registries in the ordinary
sense — declared, closed, one place — and they are deliberately not on the count above.

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

**`scripts/decide/` — the pure layer, and what each module holds.** ⚠ **It has ZERO imports**,
across all six modules: not core.js, not a machine, not the spine. That is what makes it testable
in milliseconds and impossible to tangle. **Keep it that way** — the day something in there needs
`game` or `canvas`, it is EDGE and belongs one layer up (§2 rule 1).

| Module | Holds |
| --- | --- |
| [decide/geometry.js](scripts/decide/geometry.js) | `honestDims`, `tokenCenter`, `tokenSamplePoints` — the v14 region-shim knowledge |
| [decide/registry.js](scripts/decide/registry.js) | the world-setting list SPECS and the one `parseList` |
| [decide/verdict.js](scripts/decide/verdict.js) | `hitsAmong`, `modeAdmits`, `saveOutcome`, `saveMultiplier`, `verdictText`, and the fold layer (`ATTACK_FOLDS`, `SAVE_FOLDS`, `foldsFrom`, `foldedRoll`, `foldedVerdict`, `foldedSave`) |
| [decide/eligible.js](scripts/decide/eligible.js) | `isDeadForSaves`, `limitedUses`, `isReactionItem`, `castLevelOf`, `clampVolleyCount`, `riderKey` |
| [decide/receipt.js](scripts/decide/receipt.js) | `traitOutcome`, `hpDelta`, `receiptEntry`, `joinDamageReceipt`, `joinEffectReceipt`, `takenOf`, `receiptAmounts`, `revertPlan`, `revertableEffect` |
| [decide/present.js](scripts/decide/present.js) | `popupKey`, `TONE`, `bfCard`, `ruleLine`, `momentBarHTML`, `holdBarHTML`, `nextCascadeSlot`, `cascadePosition` |
| [geometry.js](scripts/geometry.js) | EDGE, not in the layer: `tokensInTemplates`, `templateShape` — they need canvas/CONFIG/PIXI |

⚠ **`receiptAmounts` returns the row's TEXT as well as its figures, deliberately.** The two bugs
that reached the table there were both a right number in the wrong sentence (the double-negative
heal, the temp grant in damage maroon). Only the colours stayed at the EDGE. **Do not "tidy"
those strings back into the view.**

### The dependency rule

> **Depend downward only: machines → services → spine → registry → decision → core.**
> A machine may not import another machine, and a same-layer edge is treated exactly like an
> upward one. **Every edge that is not downward is PINNED, with a reason, in
> [tools/check-layers.mjs](tools/check-layers.mjs) — and the gate fails on an unpinned edge AND
> on a pin whose edge has gone.**

| Depth | Layer | Files |
| --- | --- | --- |
| 6 | entry | `battleflow.js` |
| 5 | **machines** | hold · saves · mastery · maneuvers · concentration · volleys · cast · hit-riders · d20-folds · receipts · polish · resources |
| 4 | **services** | `auto-apply.js` · `effect-riders.js` · `auto-damage.js` — the consequence chokepoints (§2) |
| 3 | spine | `ui.js` · `shared.js` · `geometry.js` · `settings.js` |
| 2 | registry | `volley-registry.js` |
| 1 | decision | `decide/*` — **zero imports, asserted** |
| 0 | core | `core.js` — a leaf, **asserted** |

⚠ **THE RULE WAS PROSE-ONLY UNTIL 2026-08-23, AND THAT WAS THE LAST BIG GAP IN THE GATE.**
`check-imports.mjs` proved every named binding resolves; nothing proved DIRECTION, so the one
discipline the whole layering rests on was the one nobody could measure. It is now the R4
tripwire's shape applied to the import graph — declared once, printed by `npm run verify`,
pinned — for the R4 reason: the rule is not *"no cross-layer edges"*, it is **"no UNNOTICED
cross-layer edges."** ⚠ **It earned itself on its first run**, finding a two-way machine cycle
(`saves.js` ↔ `d20-folds.js`, the v1.23.0 withhold-and-resume protocol) that a careful by-hand
review of the same tree the same day had missed. **Do not hand-count this graph again.**

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

⚠ **How many lazy edges there are is a question for `npm run layers`, not for this page.** The
count was hand-carried here and in `check-imports.mjs` as "six sites", and it was **nine** by the
time anyone re-measured — stale in exactly the way D2's evidence row was. The tool prints the
tally (static / bare / lazy) on every run; quote it, never a number typed into prose.

> **When adding a same-hook registration in a new file, run the hook-order check.** Making a
> lazy edge static silently reorders hooks.

⚠ **AND SO DOES REMOVING A STATIC EDGE — the direction nobody watches (measured 2026-08-23).**
The warning above reads as if the hazard were *adding* coupling. It is not: an import is what
drags a file's evaluation EARLIER than its entry position, so **deleting one lets that file fall
back to where the entry puts it.** Repaying D9(a) removed `mastery.js → concentration.js` and
moved `concentration.js` later on **five hooks** — nobody had noticed that mastery's import was
the only thing holding concentration ahead of the entry order.

> **The rule that follows: when an import is removed, DIFF the printed evaluation order.**
> `check-hook-order.mjs` prints it, so the diff is a ten-second measurement and the reasoning
> about it is worth nothing. That is how the two Stage-4 moves were separated — `combatStamp`
> byte-identical (safe), `dramaticVerdictPause` five hooks changed (safe for a *reason*, not by
> luck: no shared card, disjoint flag namespaces, and the one contended pair preserved).

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

⚠ **The rule above is about a seam CHANGING. The seam that never existed is a different failure
and has its own check now** — `npm run dispatch` ([§10 D10](#10-known-architecture-debt)) asserts
that every `dnd5e.*` hook this module registers is one dnd5e actually dispatches, against a set
**generated from the installed system's own source** and pinned to the version `module.json`
verifies. ⚠ **So a dnd5e upgrade is now a two-step act, and the gate enforces the order:** bump
the pin, then `node tools/check-hook-dispatch.mjs --regen`, then **read the diff** — a name that
disappeared is a registration that has just gone silent, which is exactly what this module cannot
otherwise notice.

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
| **D7** | ✅ **CLOSED (2026-08-22).** `npm run verify` is **nine static checks** then the unit tests, all offline, all in seconds: the LAYER check joined 2026-08-23 (§7) — biome (lint + format, 0 errors — 98 warnings is the recorded baseline), knip (dead code), import integrity, hook order, registry integrity, doc attachment, vitest | — | `package.json` · `biome.json` · `knip.json` · `tsconfig.json` · `tools/check-{imports,hook-order,registry,comments}.mjs`. ✅ **AND THE LAST GAP CLOSED 2026-08-23: the type checker is in the gate**, over `scripts/decide/` — six pure modules opted in with `// @ts-check`. ⚠ The measurement that unlocked it: with `checkJs` the layer reports **101 errors, 100 of them "implicitly any"**; with implicit-any allowed, **zero**. The layer was already clean under `strict`/`strictNullChecks`/`noUncheckedIndexedAccess`, so "adopt JSDoc first" was a flag, not a project. `checkJs` stays false globally and files opt in; the JSDoc annotations are a later tightening |
| **D8** | ✅ **CLOSED (2026-08-23).** The post-roll fold is a MECHANISM now, not one feature's special case. `hitsAmong({targets, roll, folds})` takes a LIST; `ATTACK_FOLDS` in [decide/verdict.js](scripts/decide/verdict.js) declares where folds come from, and `foldsFrom(read)` walks it — adding a fold is an entry in that list plus whatever stamps the flag, never a new parameter. ⚠ **The precedence question was a USER RULING, not a code decision, and the answer was COMPOSE THE ARITHMETIC:** folds carry contributions to the two numbers (`ac` / `add` / `replace` / a forced `verdict`) and the verdict is computed once at the end, so *precedence stops existing*. The two alternatives were put and rejected — "the defender always wins" silently eats a spent resource, and "last fold wins" tests the new total against the STALE snapshot AC. ⚠ **The SAVE side existed nowhere and is the half that was real work:** `foldedSave` + `SAVE_FOLDS`, wired live into saves.js's verdict write. **`SAVE_FOLDS` ships EMPTY on purpose** — with no specs the arithmetic is provably today's arithmetic, which is what let the seam land in a pass with no feature work in it | §6 R4 · §2 rule 4 | 31 new unit assertions (184 → 215), every prior behaviour re-asserted against the new shape; the composed case that the old code could not express is asserted both ways (a die that reaches the shielded AC, and one that does not) |

**D1–D8 are closed or settled by decision (2026-08-23).** D1, D2, D3, D5, D6, D7 and
D8 are repaid; D4 is **dropped** and the two surviving import cycles are **permanent** — see their
rows for why doing that work would make the tree worse. **D9 is PARTLY REPAID and PARTLY OPEN**; **D10 is CLOSED (2026-08-23)**; **D11 is MEASURED and its reading is
an ongoing obligation.** ⚠ **Read them as a sequence, because they are one argument.** D9 is
understood and deliberately unpaid — four edges, each pinned with the condition that would repay
it. D10 was a failure class with no rule against it, and now has one: a hook name the system
never dispatches fails the gate. **D11 is what D10's fix does not reach** — the gate can now prove
a listener is on a real channel, and still cannot prove it ever hears anything. ⚠ **That was the
shape of this whole page's blind spot, said in one line: the checks were strong on SHAPE and weak
on BEHAVIOUR**, and every structural investment before D11 bought more shape. **The battery now
ends by printing which registrations actually fired** — the first number in this repo's history
that is about the code RUNNING rather than the code being well formed.

⚠ **This table said "every row above is now closed" for three days, and the sentence was false
when it was written** — the service-in-a-feature residues below existed the whole time and simply
had no row. That is D2's lesson wearing a different hat: **a ledger that declares itself empty is
how the next drift gets in.** The next entry belongs here whenever something structural is
genuinely failing a rule, carrying the same shape these do: the rule it violates, and the
evidence.

| # | Debt | Violates | Evidence |
| --- | --- | --- | --- |
| **D9** | ⚠ **PARTLY REPAID, PARTLY OPEN (2026-08-23).** **Seven pinned edges were a machine importing another machine** — the exact shape D1 repaid for `hold.js`, grown back one convenience at a time in files D1 never touched. ⚠ **This row exists because the ENFORCEMENT PASS made the graph countable**, and it was deliberately never a promise to repay all seven. **Three are repaid; four stand, each reasoned.** ✅ **(a) CLOSED — `dramaticVerdictPause` moved `concentration.js` → `ui.js`.** A presentation-timing primitive with two outside customers (`saves.js`, `mastery.js`), which is what made it a service rather than a favour; the spine owns HOW a moment is presented (D6's generalisation). ⚠ **It was NOT order-neutral and the reasoning that said it would be was wrong** — dropping `mastery.js → concentration.js` moved concentration.js LATER on five hooks (`renderChatMessage`, `create`/`update`/`deleteChatMessage`, `damageActor`), because mastery's import had been pulling concentration's evaluation ahead of the entry order. All twelve hook-order assertions still pass, and the move is unobservable for a specific reason worth keeping: **concentration's row renders only on its own ask card**, and every handler whose order changed reads a DISJOINT flag namespace (`d20fold` vs `concentration`). ⚠ The one genuinely contended pair — concentration before `saves.js` on `createChatMessage`, where a save roll could be folded by either — **is preserved in both orders.** ✅ **(b) CLOSED — `combatStamp` moved `mastery.js` → `core.js`**, beside `inRunningCombat` in the §3 "who/when" family. Empirically order-neutral: the printed evaluation order is byte-identical before and after, because the entry already evaluated mastery before maneuvers. **(c) `saves.js` → `maneuvers.js` (interpose: `foldEntryFor`/`equippedShield`/`RULE_TEXT`)** — genuinely cross-feature: a save's verdict opens a maneuver's choice. The principled fix is a **save-choice registry beside `SAVE_FOLDS`**, which is feature-shaped design work. **Disposition: OPEN until the third choice kind arrives** — the seam should be built by the feature that proves its shape, not before (the D8 lesson). **(d) `saves.js` ↔ `d20-folds.js`, a TWO-WAY cycle** — `offerFoldOnSave` out, `foldSaveAnswer` back: saves.js withholds a verdict while an offer is live and d20-folds hands it back. ⚠ **Nobody knew this cycle existed until the check printed it**, one day after a by-hand architecture review of the same tree missed it. Not a defect — the protocol is correct and fails open — but **withhold-and-resume is moment lifecycle, and the spine owns moment lifecycle (§5)**. The third machine pair to grow a two-way edge is the argument for a spine primitive. **Disposition: OPEN, and the next moment that needs to withhold is the one that should build it.** ⚠ **(e) `saves.js` → `receipts.js` (`revertTarget`, lazy)** is the classification question this row leaves standing: `receipts.js` is filed as a MACHINE because `revertTarget` has exactly one importer. **A second importer makes it a service — reclassify then, not now.** | §7 dependency rule | `npm run layers` — the allowlist in [check-layers.mjs](tools/check-layers.mjs) is the evidence, and it is **mechanical**: a repaid edge fails the gate as a stale pin, so unlike every row above it, **this one cannot go stale in place** |
| **D10** | ✅ **CLOSED (2026-08-23) — `npm run dispatch`, and the "curated list" turned out not to need a curator.** The row below is kept in full because its FAILURE CLASS is the one worth remembering; what changed is that the class now has a rule. ⚠ **The blocker was a policy question — who keeps a hand-written list of dnd5e's hooks true across a system release — and it was dissolved by a measurement, not answered.** dnd5e declares its own hooks in its own shipped bundle, two ways: 88 `dnd5e.*` LITERAL `Hooks.call`/`callAll` names, and 92 names declared in JSDoc blocks tagged `@memberof hookEvents`. **Union: 105 at 5.3.3, generated, nobody curating anything.** ⚠ **NEITHER SOURCE ALONE IS ENOUGH, and the gap is exactly the family that bit:** the roll hooks dispatch from a template, so no literal exists for `rollAbilityCheck` and only the JSDoc at that call site names it — while `rollAttackV2` is a literal with no JSDoc block. ⚠ **The union still has one hole, and it is PINNED:** `dnd5e.preRollDamageV2` is templated *and* its JSDoc names only the non-V2 form, so neither source sees it; it is allow-listed with its evidence, and the pin fails the build if the hole ever closes. ✅ **The check was proven against the original bug** — re-registering `dnd5e.rollAbilityCheckV2` fails the gate with the real name in the message. ⚠ **RESIDUE, named rather than hidden: the 15 CORE (non-dnd5e) hook names are not checked and cannot be by this technique** — the same extraction over Foundry's own 7.9 MB client bundle recovers **0 of 15** (computed names, minified, no JSDoc). A core check built on that would pass everything and prove nothing, which is the failure this file exists to prevent. ⚠ **And the deeper limit stands: this is still a SHAPE check.** It proves a listener is on a channel that has a speaker. It cannot prove the listener does anything useful when it hears one — see D11 | ✅ nothing — **the class has a rule now** | `npm run dispatch` ([check-hook-dispatch.mjs](tools/check-hook-dispatch.mjs)) · the generated set in [tools/dnd5e-hooks.json](tools/dnd5e-hooks.json), **pinned to the dnd5e version `module.json` verifies** — bump the system pin without re-extracting and the gate fails until somebody reads the diff |
| **D10 (the class, kept)** | ⚠ **A HOOK NAME THE SYSTEM NEVER DISPATCHES IS INVISIBLE.** `Hooks.on("dnd5e.rollAbilityCheckV2", …)` registers cleanly, throws nothing, logs nothing, and does nothing **forever**. v1.23.0 shipped exactly that: `rollAbilityCheckV2` and `rollToolV2` do not exist — dnd5e's `Actor5e##rollD20Test` serves ability checks AND saving throws and fires only the non-V2 name, while `#rollSkillTool` fires a V2 pair and calls the tool one `rollToolCheck`. **Two of three non-attack offer paths were dead, and `smoke-d20-folds` was 12/12 green over them**, because it asserted content facts and never that a hook FIRES. ⚠ **This is the only failure class on this page with NO rule against it** — D9's `npm run layers` cannot see it (a static import-graph check never reads a string literal), and the §9 API-drift rule is about a hook CHANGING, not about one that never existed. ⚠ **The data is already extracted:** `check-hook-order.mjs` parses all 83 registrations by name, so the check is a filter over what it holds. ⚠ **The scoping that kept this open for a day was WRONG, and the way it was wrong is the reusable part:** it read *"dnd5e enumerates no list of the hooks it dispatches, so it must be a CURATED list"* and stopped at the ownership question. **Nobody checked whether the system's own source could answer it.** It can, twice over — see the row above. **The lesson is D2's and the layer check's, a third time: the blocker was an assumption nobody had measured.** ⚠ **The interim discipline survives the fix and is still binding, because it covers what the static check cannot: a live suite asserts that a hook FIRED, never that it was registered** — `smoke-d20-folds` §4 is the worked example, and D11 is where the general version of that lives. | ✅ closed by the row above | `tools/smoke-d20-folds.mjs` §4, which asserts dispatch for the five hooks the folds depend on |
| **D11** | ⚠ **MEASURED, NOT CLOSED (2026-08-23) — NOTHING PROVED A REGISTERED HANDLER EVER RAN.** The gate proves imports resolve, layers point downward, kinds are counted, docs are attached, and now that every hook name is real. **Every one of those is a statement about the shape of the tree.** Not one of them says a line of this module's code executed. ⚠ **The measured cost of that gap is not hypothetical:** v1.23.0 shipped **four of six d20-fold offer paths dead** behind a 12/12 green suite and a fully green gate, and what found it was **a person at a table**, not any check. D10 closes the sub-case where the name was wrong; **a correct name whose handler is never exercised by any test is the same silence with a different cause.** ⚠ **THE DATA IS ALREADY IN THE TREE, which is why this is a debt rather than a project:** `check-hook-order.mjs` enumerates all **83 registrations** by name and file, and `battery.mjs` already runs everything the module can do. **What nobody has built is the join** — which of those 83 actually fired during a battery. On v1.23.0 that report would have printed four never-fired registrations beside a green summary. ⚠ **It is a COVERAGE measure, not a pass/fail rule, and that distinction is the design:** a registration that never fires is not necessarily a bug (some are genuinely rare), so the honest output is a printed list somebody reads — the same contract `check-hook-order` chose deliberately for its own order table. **A gate that failed on it would be tuned into uselessness by the third rare hook.** ✅ **THE INSTRUMENT LANDED 2026-08-23 — `tools/hook-coverage.mjs`, and the battery ends with it.** The harness arms a dispatch ledger in the page at connect and writes it at teardown; the battery clears the ledger directory first (a stale ledger would credit this run with a path it never walked — a report that lies in the reassuring direction) and unions them at the end. ✅ **Measured on one suite immediately: `smoke-d20-folds` alone exercises 11 of 25 observable hook names, 58 of 81 registrations.** ⚠ **It wraps DISPATCH, not registration, and that is a deliberate limit** — wrapping the module's own callbacks in place would give per-registration truth and would also mean swapping live function identities inside `Hooks.events` while the suite drives the code being measured. **An instrument that can break what it measures is worth less than a coarser one that cannot.** ⚠ **`init` is unobservable BY CONSTRUCTION** — it fires at world boot, before any suite can connect — so it is pinned in its own bucket with a reason and excluded from the denominator, because a score that can never reach 100% is a score nobody chases. The pin is checked both ways, like every other allowlist here. ⚠ **WHAT IS STILL OPEN, and it is the part that needs a person:** coverage is **reported, never enforced** — a rule that failed on a rare hook would be tuned out by the third one, and a tuned-out check still reads as coverage. So the standing discipline is **triage: do not let a never-fired line sit unexplained across two releases.** Each is a coverage gap, a dead handler, or a genuinely rare hook, and only a human can say which. ✅ **FIRST FULL READING, 2026-08-23: 18/25 observable names, 74/81 registrations across 13 suites, and NOT ONE dead handler** — seven never-fired lines, every one triaged to a coverage gap with a reason (HANDOFF, *THE FIRST COVERAGE TRIAGE*). ⚠ **The report earned itself on that first reading**: it found that **no suite in the battery ever creates a COMBAT**, so hold.js's per-turn clears are table-facing and wholly unexercised — and it dragged a second fact out of a source comment where it had been buried, that placeable-document CRUD hooks measurably never fire on the suite page. **Neither was findable from any static check, and neither was in any doc.** **Disposition: the measurement is built; the reading of it is the ongoing obligation.** D10's per-feature rule still holds on top of it: **a live suite asserts a hook FIRED, never that it was registered.** | nothing — coverage is deliberately not a gate | `tools/hook-coverage.mjs` · the per-suite ledgers in `dist/hook-ledger/` · armed in [harness.mjs](tools/harness.mjs) `connectSuite` |

---

## 11. Adding something new — the checklist

**Adding an ability** (a new reaction, rider, volley spell, maneuver):
1. Is its KIND already in the code? → **one registry or list entry. Stop.**
2. If not: is this genuinely a new kind, or a special case of an existing one?
3. If genuinely new: add the kind, count it against the R4 tripwire, and record why.

**Converting a write to the serializer** (`queueFlagWrite`, §4 law 2):
1. **Repeat the guard INSIDE the lock.** The check that decided to write happened before the
   lock; by the time the callback runs, another writer may have made it false. Return `false`
   when there is nothing to record, so a no-op never churns a render.
2. ⚠ **Check EVERY LATER USE of the old local variable.** This is the one that bites, and it bit
   twice in the same conversion. A clone-mutate-write leaves you holding a clone that reflects
   your change; moving the mutation inside the callback silently changes what that clone means,
   and the code after it goes on reading a value that is now stale:
   - `foldToppleSave` disarmed its clock with `flag.targets.every(t => t.done)` on the clone it
     used to mutate. After conversion that clone still read the target as pending, so **the clock
     would never have been disarmed.** It re-reads now.
   - the same fold announced its verdict unconditionally; with the claim taken inside the lock,
     **a losing racer would still have announced.** A `claimed` flag gates it.
   Neither was caught by any check. Both were caught by reading the diff.
3. Not every write needs it. A single-decision object with one writer (concentration's ask,
   mastery's own flag) is not a per-target read-modify-write and the argument does not reach it.

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
5. ⚠ **If it registers a system hook, its live suite must assert that hook FIRED** — not that it
   was registered, and not that the feature's content facts are right. **This is the rule D10
   was paid for and D11 still owes in general** (§10). `npm run dispatch` proves the NAME is
   real; only a live assertion proves your handler ran. `smoke-d20-folds` §4 is the worked
   example: four of six offer paths shipped dead behind a 12/12 green suite that had never asked
   this question.

**Adding a file:**
1. Declare its layer (§2) in its header comment **and in `LAYER_OF` in
   [tools/check-layers.mjs](tools/check-layers.mjs)** — the gate fails on an undeclared file, so
   the layer is a decision made once, in writing, by whoever adds the file.
2. Depend downward only (§7). If you need a service from a machine, the service is in the wrong
   file. ⚠ If the edge genuinely must exist, it goes in that tool's `ALLOW` with a REASON and a
   disposition — and if the disposition is `OPEN`, it belongs in §10 D9 as well.
3. Run the hook-order check **and the dispatch check** (`npm run hooks && npm run dispatch`).
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
