# design.md — the north star

> The single source of truth for **what Battle Flow is for** and **how it is allowed to grow**.
> Every feature, setting, and refactor must trace back to something on this page. When a decision
> is ambiguous, this document wins; if this document is wrong or silent, fix *this document
> first*, then build. Written 2026-08-14 from a full source-level evaluation of midi-qol, DAE,
> dnd5e 5.3.3, and the module ecosystem — see [RESEARCH.md](RESEARCH.md) for the evidence.

---

## 1. Mission

**Battle Flow makes D&D 5e battles flow.** Attack → hit → damage → save → effect resolves
itself, and the table only touches the moments that are genuinely theirs.

The system (dnd5e 5.3.3 on Foundry v14) already owns all of the hard math — hit determination
against AC, resistance-correct damage application, real saving throws, effect application with
concentration-linked cleanup. Every link of that chain simply ends at a **button**. Battle Flow's
entire job is **pressing the buttons whose outcomes are already determined**, while:

- **pausing** at the one point where a human gets a say (the reaction window),
- **announcing** what matters (hits, concentration breaks, expirations),
- **leaving receipts** everywhere it acts (every application is revertible),
- and **never removing the native buttons** — vanilla remains the substrate and the fallback.

### 1.1 Scope

**Battle Flow is a full D&D 5e 2024 combat-resolution module, built by dogfooding.** Two things
follow, and neither limits the other:

- **The rules target is all of 5e 2024**, as the dnd5e system ships it (5.3.3 on Foundry v14).
  Curated content lists are built by **sweeping the official compendia** (`tools/scan-*.mjs`);
  a spell that exists in 2024 and fits a shipped feature belongs on the list whether or not
  anyone at the dogfood table has ever cast it. Coverage is not scoped to a party sheet.
- **Dogfooding is the development method, and the table sets priority.** Nothing ships that
  has not been played. When ordering work — which phase next, which entry on a list first,
  which bug now — **what the table actually needs wins.** That is how the queue is sorted, not
  how the scope is bounded.

Breadth of *content* is not breadth of *mechanism*. No flags platform, no macro hooks, no
extension points for homebrew (§8): the lists stay finite, hand-checked, and inspectable.

It is deliberately **not** midi-qol: midi solves automation with a 50,000-line workflow engine,
a flags platform, and three required dependency modules. We solve it with a few hundred lines,
curated lists instead of platforms, and zero dependencies. See §3 and RESEARCH.md for why that
trade is safe.

---

## 2. Binding principles

These are not aspirations; they are the rules the code is held to.

1. **Automate outcomes, never decisions.** The module presses buttons whose results are fully
   determined by rules already in the game data. Anything requiring human judgment — reacting,
   rulings, targeting — is *held for* a human, never performed for one.

2. **The chat log is the state and the bus. No sockets, ever.** There is no in-memory workflow
   object anywhere. Every hop is a stateless reaction to a persisted document (chat message,
   flag, active effect) that Foundry's own server replication delivers to every client. No
   client ever *commands* another client: clients **volunteer** actions based on what appears in
   the log. This buys, for free, everything midi hand-maintains: ordering, reload-safety,
   permission enforcement, and an audit trail.

3. **Zero dependencies. Hooks only. No patching.** No libWrapper, no socketlib, no DAE. No
   monkey-patching, no document-class replacement, no private-method wrapping. The only
   `relationships` entry is a **pin** on the dnd5e system version (a compatibility declaration,
   not a library). If a feature cannot be built on public hooks + document writes, it is out of
   scope.

4. **Every hold has a default outcome and a human who can preempt it — never a required
   answer.** Required answers are how a GM ends up managing a million resolves. Reaction holds
   default to Pass (optionally on a timer); concentration prompts default to Roll. The
   player's controls *preempt* the default; nothing is ever a required answer.
   > **Corrected 2026-08-16 (§10).** As originally written this promised a GM override on
   > every hold. The user removed the GM's third button in v1.1.15 ("it seems like it should
   > be a binary choice"): where a player owns the decision, the GM deliberately cannot
   > answer it, and **the timer is the fallback**, not a button. At `holdTimer: 0` the table
   > is explicitly choosing human-paced waits with no backstop — a present-but-frozen player
   > can hold the chain until someone talks to them, which is a feature of a table, not a
   > bug in a module. Set a timer if that ever stops being true.

5. **Receipts and announcements.** Every automated application stamps what it did (prior values,
   deltas, created-effect ids) onto the causing message and offers a revert. Every invisible
   state change gets a log line ("Bless expires on Gren", "Gren's reaction window passed").
   An icon vanishing must never be a mystery; a wrong-target hit must never need surgery.

6. **Curation over platforms.** Wherever midi built a general engine (reaction detection, aura
   flags, conditional bonuses), Battle Flow ships a **curated table** (the interrupt-reaction
   list, the damage-rider list), scoped to **what 5e 2024 official content actually ships** and
   built by sweeping the compendia (`tools/scan-reactions.mjs`, `tools/scan-riders.mjs`). A
   curated list is finite, hand-checked and inspectable; a platform is open-ended and someone
   else's data model. Lists are world settings — extending them is data entry, not code.

7. **Thin and deletable.** The dnd5e roadmap explicitly absorbs automation over time
   (conditional active effects, effect expiry, progressive chat cards). Every Battle Flow
   feature must be individually deletable the day the system ships it natively. Being
   made redundant is the *success* condition, not a risk (see Times Up's honorable death when
   Foundry v14 core absorbed effect expiry).

8. **GM click economy ≈ zero.** In steady state the GM answers nothing: players answer their own
   holds, spent reactions suppress further holds, and GM controls exist as overrides and
   fallbacks. Any feature that adds a recurring mandatory GM click is misdesigned.

9. **Per-feature world settings, default OFF.** Every feature is independently toggleable and
   ships disabled — the dogfood ladder is walked one setting at a time, and any feature can be
   killed mid-session without touching the others. Settings-sheet dividers and dependent-field
   grey-out (the combatplus idiom) from day one.

10. **Mechanisms in code, membership in settings, amounts in content** (named 2026-08-19,
   after an architecture check found it already true everywhere). The code knows KINDS —
   an AC-recheck reaction, a damage-reduce reaction, a negate, the closed 8-mastery set,
   the generic save/concentration/cast machines. WHICH abilities participate is a
   user-curated settings list (Shield is a list entry, not a code path — Absorb Elements
   and the nine 2026-08-17 additions rode in free). HOW MUCH is always read from the
   content's own data, never configured. A new ability must cost a list entry, zero code;
   code grows only when a genuinely new KIND of question appears — and if kinds start
   arriving faster than one a phase, that is the Phase 5 (adopt-AC5e) tripwire, not a
   license to special-case names. The fix for an ability that misbehaves is almost always
   CONTENT (the Innate Sorcery graft, the Divine Favor/Thaumaturgy grafts, the Wand shim),
   not teaching the module its name.

---

## 3. Why not midi-qol / DAE (the one-paragraph version)

Full evidence in [RESEARCH.md](RESEARCH.md). midi-qol v14 is 50,584 lines of TypeScript; the
core chain this module wants is ~15–20% of it, and even that core hard-requires DAE (the effect
application is literally delegated to `DAE.doActivityEffects`), socketlib (~57 GM-proxy
handlers), and lib-wrapper (33 patches), plus wholesale replacement of 8 document classes,
pinned per dnd5e minor family with one maintenance branch per Foundry generation. Its serial
in-memory workflow blocks on cross-client prompts with timeouts — the source of its race
conditions, its 700-line undo system, and its conceptual opacity. DAE without midi is inert for
our purposes (its own README: "you probably don't need DAE"). Meanwhile midi's v14 code
demonstrates the thesis of this module: it now mostly *orchestrates native dnd5e machinery* —
which means a small module can orchestrate the same public hooks directly.

---

## 4. Architecture

### 4.1 Who does what (the volunteer model)

| Action | Client | Why that client |
| --- | --- | --- |
| Auto-roll damage after a hit | **Attacker's** | Its attack, its dice; fires on its own `dnd5e.rollAttackV2` |
| Apply damage / effects to NPCs | **Active-GM elect** (`game.users.activeGM?.isSelf`) | Ownership is a permission fact; single-writer prevents double-apply (combatplus auto-defeated pattern) |
| Auto-roll a PC's save / concentration | **Owning player's** client (first-active-owner election) | Their character, their dice; self-triggered by the replicated card |
| NPC saves, offline-owner fallback | **Active-GM elect** | GM owns everything; fallback keeps the chain moving |
| Reaction hold answer | **Held target's owner** (Cast / Pass) | The decision is theirs — buttons sit with whoever owns the decision |
| Hold override (Resolve / Skip) | **GM** | Rulings sit with the adjudicator; also the AFK fallback |

No client ever sends another client an instruction. When the GM's Resolve click must make the
attacker's client act, the GM flips a **flag on the message**; the flip replicates; the
attacker's client reacts to seeing it. Three answer channels exist for a hold — the player's
response message, the player's cast itself, the GM's flag flip — three different documents, one
listening client, zero commands.

### 4.2 State lives on messages

- Hold state: a flag on the attack message (`pending` → resolved/skipped/expired). Reload-safe;
  the popup and card row are just *views* of it.
- ⚠ **Never key persisted data by uuid.** Foundry expands dotted keys when it writes an
  update, and every uuid contains dots — `{ "Actor.abc": "cast" }` is stored as
  `{ Actor: { abc: "cast" } }`, so every lookup misses silently and forever. Per-target state
  goes in an **array of entries carrying a `uuid` field** (what the Phase 1 receipts happen to
  do already). Cost a live debugging session on 2026-08-15.
- Application receipts: a flag on the damage message (per-target prior `hp.value`/`hp.temp`,
  deltas, created-effect ids, reverted marker).
- Roll chains: dnd5e's own `flags.dnd5e.originatingMessage` + `dnd5e.registry.messages`
  (usage ↔ attack ↔ damage ↔ saves) — we ride the system's registry, never a parallel one.

### 4.3 The "table moment" component

One reusable UI shell for anything that must not scroll away in combat chat:
**centered DialogV2 popup** (attention; ephemeral; dismissing ≠ choosing) over a **chat-card
row** (durable state; always present) with an optional **countdown timer**. Customers: the
reaction hold (Phase 1.5), concentration assist (Phase 2.5), possibly death saves someday.

Timer mechanics: the **continuing client** is the one authoritative clock (it paces its own
default action — this is *not* a cross-client timeout); the deadline is absolute and lives on
the flag, so every client's display derives the same remaining time. The countdown visual is
built with **`element.animate()` set to an absolute `currentTime`, never a CSS animation** —
zero JS ticking either way, but a CSS animation's clock starts only when its element begins
being *rendered*, and a chat message is first inserted into a detached tree; measured live
(2026-08-15), two bars declaring identical negative `animation-delay` drained seconds apart
and stayed apart. *(Corrected per §10 — this paragraph originally specified the pure-CSS
bar + negative-delay resume, which shipped, desynced, and was replaced.)* At the buzzer the
continuing client re-checks the log for an answer that already landed before firing; an
answer that still slips past becomes a revert case. Never hijack core's scene-load progress
bar or notification stack — the bar is drawn privately in the popup/card.

⚠ DialogV2's `render` hook receives the APPLICATION, not an element (house ground truth from
partystash).

> **Amended 2026-08-17 (v1.10.0, user calls) — the table-moment contract, made binding for
> every popup surface:**
> - **The pairing rule.** Whenever a popup timer runs, a corresponding PUBLIC CARD runs the
>   same bar — *"the popup is for the user to see, the card is for the table to see"* (and
>   the decider sees both; the card stays public to everyone). Same flag deadline on both
>   surfaces, both synced through `scheduleBarSync` (drift 0 is the measured standard). No
>   timed popup without its table-facing card; no card bar frozen while the popup drains.
> - **A popup closes when its question is withdrawn.** Dropped demand entries (template
>   containment moving on), resolved moments, and deleted cards all sweep their popups —
>   a popup asking a question the machine has already withdrawn is a lie on screen.
> - **Every table moment carries the deadline bar and one authoritative clock that RESOLVES
>   it at expiry** — pass for decisions, roll for demanded saves, dismiss for reminders.
>   A moment that can wait forever does so only by explicit setting (timer 0), never by a
>   missing buzzer.

> **Amended 2026-08-21 (v1.19.0 round 3 — THE MOMENT AUDIT + THE SPINE, the user's mandate):**
> three walks of findings traced to one cause — each new moment machine COPIED the
> stamp/route/pop/answer/resolve idiom instead of composing it, and every copy drifted
> ((n) was a copied bar call missing a hidden contract, (j) a whole family built without
> the ack concept, eleven separate shown-latch sets with four different key shapes). The
> user's charge, verbatim: *"if this is truly to work long term, stuff needs to be built
> out highly modularly and highly scalable as we build."* So:
>
> **THE MANDATE (binding).** No new moment machine may hand-roll stamp, route, pop, bar,
> answer, resolve or expire again. New machines COMPOSE the spine below; code review of any
> new moment starts by checking each row of the composition contract against it. A new
> primitive is added to ui.js only when a genuinely new KIND of surface behaviour appears —
> the §2.10 rule applied to UI.
>
> **THE MOMENT MAP** — every machine, one row, and the map is maintained WITH the machines
> (a new moment adds its row in the same commit):
>
> | # | Moment | Flag · message | Stamp (client) | Route | Controls | Answer channels | Resolve | Expiry |
> | --- | --- | --- | --- | --- | --- | --- | --- | --- |
> | 1 | Reaction hold — attack | `hold` · attack msg | attacker's, on hit | canAnswerFor + the GM player-owned quiet (manual recall) | Cast / Pass | flag write · §4.1 response msg · the cast itself | continueHold: settle → live-AC re-test → verdict → RELEASE the born-claimed dice ((gg): rolled at attack time, `attackHoldPending`; a flipped target drops out of the application) | pass (continuing client's clock) |
> | 2 | Reaction hold — spell | `hold` trigger:"spell" · usage card | caster's, at use | same | Cast / Pass | same | continueSpellHold + the preApplyDamage veto | pass |
> | 3 | Save demand | `saves` · usage card | casting client, at use | canAnswerFor, queued oldest-first | Adv/Norm/Dis + bonus (every button = roll) | `respondsTo`+`saveFor` roll · native button chain · bare roll | fold vs stored DC → verdict line → consequences | roll (elect) |
> | 4 | Save choice — interpose | `saves.targets[].choice` | at the SAVED verdict (elect) — walk-5 (y) restored ⑥'s shape; a failure never offers | canAnswerFor(saver) | Use / Take half | flag write · §4.1 `saveChoiceAnswer` | settleInterpose on the accept (the Reaction spends there and only there) | pass — take half (elect) |
> | 5 | Save choice — bash | `saves.targets[].choice` | at the failed verdict (elect) | canAnswerFor(attacker) | Prone / Push | same | the STANDARD Prone press (forceStatus — walk-5 (x)), or the push card | prone (elect) |
> | 6 | Topple demand | `topple` · own card | elect | canAnswerFor per target | Adv/Norm/Dis + bonus | chained roll · bare roll (defers conc → saves) | fold → press / stays-standing card | roll (elect) |
> | 7 | Concentration ask | `concentration` · own card | elect, off damageActor | canAnswerFor, queued | Adv/Norm/Dis + bonus | `respondsTo` roll · bare roll | fold → holds / break | roll (elect) |
> | 8 | Mastery ask | `mastery` · attack msg | elect, after application | canAnswerFor(attacker) | Use / Pass | flag write (the attacker owns the msg) | elect executes the payout | pass (elect) |
> | 9 | Mastery notice (Vex/Sap/Cleave) | `masteryNotice` · own card | elect | canAnswerFor(attacker) | OK · Arm/Dismiss (Cleave) | **the ACK** | presentation resolves; Arm also arms | auto-dismiss at the deadline |
> | 10 | Hew notice | `hewNotice` · own card | elect, at the crit's damage roll / the kill receipt | canAnswerFor(attacker) | OK | **the ACK** | presentation resolves | auto-dismiss |
> | 11 | Precision offer | `precision` · attack msg | roller's, on a clean miss | canAnswerFor(attacker) | Use / Pass | flag write (the roller owns the msg) | use → die → verdicts → re-drive | pass (elect) |
> | 12 | Riposte offer | `riposte` · enemy's attack msg | elect, on a melee miss | canAnswerFor per reactor | Riposte / Pass + weapon select | flag write · §4.1 `riposteAnswer` (trusted drive) | drive a real attack; hit celebrates, miss announces | decline (elect) |
> | 13 | Bash offer | `bashOffer` · attacker's attack msg | attacker's, on a melee hit | canAnswerFor(attacker) | Use / Pass + target select | flag write | drive the feat's own save activity | pass (elect) |
> | 14 | Damage offer (attack / save) | `damageOffer` · attack msg / usage card (w) | roller's / caster's client | the popup is local; THE CARD BAR IS PUBLIC — every client renders the wait | Roll | the one `fire` thunk (X and buzzer roll too; the roll folds the flag to done) | rollDamageForAttack / rollDamageForSave | roll (local `damageTimer`, default 15s; 0 waits) |
> | 15 | Volley aim (darts / rays) | `volley` · usage card | caster's, at use (v1.20.0; membership = the registry, volley-registry.js (ff)) | the popup is the author's own (damage-offer locality; render re-pops + re-arms it); THE CARD BAR IS PUBLIC | steppers / ray selects + per-ray Adv/Normal/Dis (dd) + Fire (X fires as aimed; distinct entries never double up) | the one `fireVolley` claim (queueFlagWrite — button, X and buzzer race safely) | darts: per-target aggregated `rollDamage`, aimed by canvas (spellDamage claim applies); rays: per-ray real `rollAttack` through the ordinary pipeline; every roll names its target ((ee)) | fire the even spread (author's `damageTimer` clock; 0 waits) |
>
> **THE SPINE (ui.js)** — the mechanisms every row above composes; each was extracted from
> the machines that had drifted apart around it:
>
> | Primitive | What it owns |
> | --- | --- |
> | `openManagedPopup` | the single door: lifecycle, row-release on close, **the cascade** — the staircase queue in event order (law 6): common anchor, 36px slots reused as they free, elders re-fronted so a newcomer joins the BACK of the pile |
> | `openMomentPopup` | the popper discipline: canAnswerFor gate, `popupKey`, front-a-live-popup-on-recall, DialogV2 construction, notice auto-close. `gate: false` skips canAnswerFor (locality popups); a null subject with the gate on is refused |
> | `shownMoments` + `popupKey` | ONE shown-latch registry — **the latch key IS the popup key** — with ONE delete-sweep in ui.js; machines un-latch through the same key when their queue advances |
> | `momentBarHTML` | the bar as a pure function of `{deadline, window}` — no status contract to forget (finding (n) is what the hidden contract cost). `holdBarHTML` remains the status-gated wrapper for whole flags |
> | `momentButton` | the one recall/answer button factory |
> | `acknowledgeMoment` / `momentAcknowledged` | **the ACK (law 2)**: any notice button resolves the card's pending presentation — durable via message flag when the acknowledger can write (GM/author — every solo case), client-local otherwise (spectators' bars drain out as the window) |
> | `armAskTimer` / `disarmAskTimer` | the elect-owned single-answer clock (moved here from mastery.js — the spine was living in a machine) |
> | `armDeadline` / `disarmDeadline` | the raw deadline timer the per-target clocks (topple, riposte, save-choice, hold) build their own gates on |
>
> `dramaticVerdictPause` (concentration.js) stays where it is — moving it re-orders the
> import graph for zero behaviour; it is the shared verdict pacing, imported by saves and
> mastery. `offerRoll` (auto-damage.js) is a legitimate DIRECT customer of
> `openManagedPopup`: its close-fires-roll wiring is its own documented shell, and the
> cascade covers it through the single door.
>
> **THE LAWS the spine encodes** (each user-ruled; the round-3 fixes are their proofs):
> 1. **The popup law (c):** easy-to-forget moments get popup notifications, not just cards.
> 2. **Acknowledge resolves (j):** any notice button press resolves its card's pending
>    presentation — bar gone, recall gone, popup gone. The ask machines already comply
>    (their update watchers close answered popups); the notice family was the violating
>    class and now rides the ACK.
> 3. **Declaration never claims an outcome (m):** buttons and relay cards at decision time
>    state the SPEND or the choice; only the verdict's settle card states results. Scope
>    clarified by walk-5 (y): the law binds declarations made BEFORE the outcome exists — a
>    post-verdict choice states knowns ("Take half" is legal once the save is in).
> 4. **Source, then result (⑦):** every follow-up line leads with the ability.
> 5. **The celebration (l):** every attack-damage popup celebrates the hit — "You hit! —
>    roll damage"; crits louder on the one yellow badge; a riposte named as itself (p).
>    The save-damage popup keeps its stakes-line identity (no attack roll to celebrate).
> 6. **The stack is a queue in event order (q, recut by walk-4 (s)):** concurrent popups
>    form the standard staircase — common top-left anchor, smallest free slot, one
>    header-height step (36px) down-right, slots reused as popups close — and Z-ORDER IS
>    CAUSAL ORDER: the FIRST moment's popup stays in front, later arrivals layer behind,
>    so the player clicks through in the order things happened (user ruling verbatim:
>    *"the ux has to be the player clicks through in the order of events"* — a bash
>    exists because the hit landed; the hit answers first).
> 7. **The rule line is verbatim (walk-5 (z), user ruling: "just use the actual
>    mastery/feat language so its exact"):** a popup describing a feature's effect quotes
>    the feature's own 2024 text — `ruleLine()` dress, RULE_TEXT / MASTERY_RULES words,
>    matched against the world's own compendium (tools/probe-mastery-rules.mjs is the
>    drift check). The module's operational hints ("nothing is automated", "swing it from
>    the sheet", the Cleave arm note) stay — as separate lines, never blended into the
>    quote.
> 8. **Every card icon names itself (walk-5 (aa)):** any icon rendered in a card or popup
>    card carries `data-tooltip` (and `alt`) with the thing it depicts — the bfCard
>    portrait names the eyebrow/title, receipt-row icons name their target or effect, the
>    hold popup's portrait names the reaction.
>
> **Amended 2026-08-20 (v1.19.0 walk 4):** four fixes, all suite-pinned:
> - **(s) law 6 recut** — the cascade became the staircase queue above (maneuvers Q1–Q3
>   pin anchor, step, slot reuse and z-order). Walk sightings (r) ("the dragon got some
>   of Thomas's Shield Master") and (t) ("the bash never knocked the dummy prone") were
>   both this pile misreading — the flags were clean both times; the fix is the queue,
>   not the machines.
> - **(u) the dead-skip spares Cleave** — resolveHitMastery skips corpses for every
>   payout EXCEPT cleave's reminder: the kill is its signature moment and the corpse
>   still anchors "within 5 feet of" (effects 15d2). Once-per-combat-turn still governs.
> - **(v) module-driven `use` passes `subsequentActions: false` — all four sites** — a
>   maneuver whose activity carries damage otherwise chains dnd5e's own follow-up roll
>   and orphans a native config dialog over the table (maneuvers R2h). Consumption and
>   the card are all those steps want; the module drives everything after.
> - **(w) the damage offer graduated to a table moment** — map row 14: the `damageOffer`
>   flag, the card running the public bar (the pairing rule reaches the last private
>   wait), the window now `damageTimer` (world, default 15; 0 waits indefinitely).
>   Expiry still ROLLS — the timer only ever decides who pressed the button
>   (probe-player-damage 10/11).
>
> **Amended 2026-08-21 (v1.19.0 walk 5):** four fixes, all suite-pinned:
> - **(x) one universal prone** (user: "just use the standard prone chip for bash") — the
>   bash Prone press is Topple's press: `forceStatus` builds the CANONICAL Prone status
>   chip (keepId `dnd5eprone000000`, origin names the presser), and the generic effects
>   pass skips a bash answer entirely — the item's own "Shield Bashed" effect is world
>   decoration the module no longer applies (maneuvers B2/B3/B4d pin id, origin and the
>   custom effect's absence). tools/fix-shield-master.mjs still verifies the CONTENT;
>   its graft is now belt-and-braces, not load-bearing.
> - **(y) interpose is post-verdict, success-only** — finding (f)'s pre-roll gamble is
>   OVERTURNED (the user re-read the rule; Claude's reading concurred: the 2024 tail
>   "…if you succeed on the saving throw and are holding a Shield" conjoins two
>   preconditions, and the rule text has no spent-and-failed state at all). Map row 4
>   restored to ⑥'s shape: no choice stamps with the demand or at adoption; the SAVED
>   verdict opens it (eligibility read there); accept turns half into none, spends the
>   Reaction at settle; a failure never offers and never spends; expiry takes the half.
>   The save ask never defers again (the pre-roll pend is impossible). Pins: maneuvers
>   I1a–I1d (post-verdict open, use → none) and I3 (the failed-save negative).
> - **(z) the verbatim rule line** — law 7 above; RULE_TEXT (maneuvers.js, read off this
>   world's PHB items) + MASTERY_RULES (mastery.js, matched against the system's rules
>   journal by tools/probe-mastery-rules.mjs) quoted via `ruleLine()` in every offer,
>   choice, demand and notice popup; the module's hints ride as separate lines. Pins:
>   maneuvers B1c ("cause it to have the Prone condition"), I1c ("holding a Shield").
> - **(aa) icon tooltips** — law 8 above; the bfCard portrait (alt + data-tooltip = the
>   eyebrow), both receipt-row icon shapes, and the hold popup portrait. Pinned inside
>   B1c/I1c (`img[data-tooltip]` in the popup DOM).

---

## 5. The phase ladder

Dogfood-slow: one phase per stretch of real table time, each behind its own setting, each
individually killable. Phases are ordered by clicks-saved per line of code.

### Phase 0 — native settings (no code)

Flip what the system already offers: `attackRollVisibility` (hit/miss + AC display to players),
`challengeVisibility`, `autoCollapseChatTrays`, `autoRecharge`, `autoRollNPCHP`. Establish the
table discipline everything else keys off: **attacks are made with targets selected.**

### Phase 1 — the attack resolver (+ revert receipts)

The biggest click-saver. Two independent halves:

- **Auto-roll damage on hit** (attacker's client, `dnd5e.rollAttackV2`): re-run the system's
  own hit test — `roll.isCritical || (!roll.isFumble && roll.total >= ac)` — against the
  attack message's `flags.dnd5e.targets` snapshot. A target whose snapshot AC is **null**
  (total cover, or no AC data) is never auto-resolved: the system's tray happens to class
  those rows as hits (`total < null` is false), but that outcome isn't determined by data we
  trust, so those targets stay with the humans and the native tray (§2.1). On ≥1 hit, call
  `subject.rollDamage({ isCritical, attackMode, ammunition }, { configure: false }, ...)`
  mirroring `AttackActivity.#rollDamage` (ammo/attackMode recovery included).
  **Damage only ever rolls AFTER the hit is determined** — a miss means the damage dice never
  exist (midi's roll-both-together confuses players; crits pre-configure doubled dice; misses
  end silently). Optional off-by-default "dramatic beat" delay between hit reveal and damage
  roll.
- **Auto-apply to hit targets** (active-GM elect, `createChatMessage` on the damage-roll
  message): resolve hit targets through the registry (damage msg → originating usage →
  associated attack roll → re-run hit test), build damages exactly as the native tray does
  (`aggregateDamageRolls(rolls, { respectProperties: true })` → `{value, type, properties}`),
  then `actor.applyDamage(damages, { isDelta: true, origin: message })` — the system's own
  di/dr/dv/dm/threshold math stays authoritative.
- **Receipts + revert, from day one**: stamp the application record on the damage message;
  render a GM-only per-target "↩ Revert" row — restores the HP snapshot, deletes recorded
  effects, marks the row reverted (idempotent, reload-proof). Re-applying to the *right*
  target = the still-present native tray. **Not rewound**: rolls, resource/ammo consumption,
  concentration — that line is what keeps this ~100 lines instead of midi's 700-line undo.
  If a revert raises a target back above 0 HP, also clear the defeated flag/dead overlay that
  combatplus set (combatplus is deliberately one-way; the causing module cleans up).
- **Dogfood modes**: master toggle + "NPC attacks only" first (the GM's monsters resolve
  instantly; players keep their buttons), then widen to everyone.

### Phase 1.1 — first-dogfood polish (2026-08-15 table feedback)

Small structural comforts the first live session asked for, each its own setting (default
off), none changing the resolution chain:

- **Applied cards collapse their damage tray** exactly as if Apply had been pressed (same
  `autoCollapseChatTrays !== "manual"` guard as the native handler) — an already-applied
  roll must never sit one accidental click from landing twice. Stateless and per render
  while an un-reverted application stands: a message renders into several DOM trees (chat
  log, notifications pane, popouts), so any once-per-card latch collapses one tree while
  the ones on screen skip (bit live 2026-08-15). The tray, like the receipt row, is a view
  of the receipt flag; a manually reopened tray survives until the next re-render, which
  only a receipt change or a log rebuild triggers.
- **Require a target to attack** (world): using an attack with no target selected warns and
  cancels the use before anything rolls or consumes (`dnd5e.preUseActivity` veto on the
  initiating client — the combatplus initiative-gate pattern). Makes the Phase-0 table
  discipline structural.
- **Suppress attack usage cards** (world): the Attack/Damage button card is spam under
  auto-resolution — the workflow record is attack roll → damage roll → receipt. Vetoed at
  `preCreateChatMessage` on the initiating client. ⚠ At 5.3.3 the usage card is a message
  **subtype** (`type: "usage"`); `flags.dnd5e.messageType === "usage"` is the legacy shape
  the system's own `migrateData` writes for pre-subtype documents, so matching only the flag
  no-ops silently on every card this system creates (bit live 2026-08-15).
  ⚠ **A card carrying effects is never suppressed.** Attack-roll *spells* are attack
  activities too, and their card is the only place their riders can be applied from —
  suppressing it silently ate Ray of Frost's slow (reported live 2026-08-15).
  > **Superseded by Phase 1.9D (2026-08-16).** The boolean became a master gate over four
  > per-source switches, and the carve-out sharpened: a card carrying effects survives only
  > when the riders will *not* handle them — Effect Riders off, or a concentration cast,
  > whose origin linkage only the card can supply. With riders on, an ordinary
  > effect-carrying card may go; the effects land anyway.
  > **REMOVED at v1.10.0 (user call, 2026-08-17: "we rip out the card suppression
  > machinery, and we just have machinery to hide non-refund-resource buttons").** The
  > dogfood walk recalibrated the diagnosis: the card's COST was never the card — it was
  > the action buttons, a second manual path that forks the machine. So **every use posts
  > its first card** (the description, the targets, the effects tray are the record), and
  > **Hide Redundant Buttons** (v1.9.5, world, default ON) is the ONLY card-shaping
  > machinery: every `.card-buttons` action hidden except Refund Resource and Place
  > Measured Template — the two that are bookkeeping/aiming rather than workflow, with no
  > automated equivalent. The master, the four buckets, the carve-outs, and the
  > replacement-bfCard plumbing (the hold's §6f bus, the cast slice's replacement) are
  > deleted outright — settings, functionality and all, the holdView/saveAutoRoll
  > precedent. The native card is always the bus again.
  > **Amended v1.11.0 (finding ②): Place Measured Template is CONDITIONAL** — it shows
  > only while NO template of this card's activity stands (origin-flag tie, the adoption
  > match). With the circle down, the button's one remaining power is placing a second
  > copy; deleting the template brings it back, so the canceled-placement path (cast →
  > cancel → place from the card) stays alive. Template CRUD re-renders the card as a
  > fast-path; the render pass is the floor (the CRUD-hooks-unreliable-headless ground
  > truth).
  > **OVERTURNED at v1.12.0 (the v1.11.0 walk's finding ②, the user's third ask): the
  > keep-list is exactly Refund Resource — the v1.9.5 spec, restored.** The v1.10.0
  > Place Measured Template exemption and the v1.11.0 conditional machinery are deleted
  > outright. The containment-starvation rationale that justified the exemption is gone:
  > placement lives in the cast-time usage prompt and the canvas template controls, and
  > the save machine's WAITING demand (Phase 2, v1.12.0) adopts an area whenever and
  > however it lands. Flipping Hide Redundant Buttons off restores every button — that IS
  > the settings gate.
- **Damage receipts are for the whole table, the HP pool is not.** Everyone sees *who* the
  damage landed on and how much; the before → after hit points and the revert control stay
  GM-only. A rolled number with no named target is the thing players actually complained
  about; a monster's remaining HP is not the party's to read. The chain is unaffected: the resolver's
  origin walk already falls back to the attack message when no usage card exists. §2's
  "never remove the native buttons" survives as a per-table choice: flipping the setting
  off restores the native cards instantly, and vanilla remains the fallback substrate.
- **Center roll dialogs** (client): dnd5e docks roll-configuration dialogs lower-right
  (`left: innerWidth − 710`); centered is where the table looks. First render only.

### Phase 1.5 — the reaction hold (a pause, NOT a system)

Auto-resolution has one legitimate interrupt: Shield-class reactions trigger on "you are hit,"
*before* damage — and RAW the player knows they're hit, **not** the damage. Auto-rolling damage
instantly would make every Shield decision perfectly informed (metagame leak) and every fix a
rewind. So: a **hold point** between hit determination and the damage roll.

> **Recut by (gg), the v1.20.0 walk (2026-08-21) — the hold pauses the APPLICATION, never
> the dice.** User verbatim, from the table (a Scorching Ray volley stalled behind Gren's
> Shield popup): *"the shoudl just roll damage, and not wait for shield, if its a miss then
> it just doesnt do anything. i thnk this is kinda like MM too"* — and it is exactly the
> darts' pattern the same walk's item 6 proved. The roll happens at attack time, born
> `attackHoldPending` + `attackHoldFor` (auto-damage.js reads the hold at ROLL time); the
> elect's applier waits on the claim (the `spellHoldPending` idiom on the attack chain,
> three triggers: arrival, the release write, render-resume); the resolution RELEASES the
> claim instead of rolling, and `hitTargets`' verdict override drops every Shield-flipped
> target — an all-flipped release applies to nobody and the dice do nothing. The metagame
> leak the original design avoided is ACCEPTED by this ruling: the defender may see the
> rolled damage before answering, exactly as Magic Missile's darts always showed it —
> and `damage`-kind reactions genuinely improve (the defender reduces a number they can
> finally read). The post-answer roll site died as code; a roll still sitting in an open
> offer window needs nothing (it reads the resolved hold at roll time and applies straight).

- **Trigger**: on a hit, check the hit target against a **curated world-setting list** of
  interrupt reactions — default Shield-class (retroactive-miss) only; entries carry a one-bit
  classifier: AC-type (skip the pause on crits — a nat 20 hits regardless) vs damage-type
  (Uncanny Dodge, Deflect Attacks — always pause; alternatively handle halving reactions
  post-hoc via revert + ½ as a world-setting choice). Eligibility = item present + prepared +
  slot free + reaction not already spent. The full evidence base — every reaction-cost item
  in this world's compendia, classified — is [REACTIONS.md](REACTIONS.md); its findings
  matter here: **Absorb Elements does not exist in 2024 content**, Shield is the *only*
  interrupt spell in the game, and the monster-side interrupts are all AC-type, so one
  uniform `total >= liveAC` re-test serves the entire family.
- **Second trigger — a listed spell, not an attack** (added 2026-08-15 from live play). Shield's
  own text is *"you have a +5 bonus to AC … **and you take no damage from Magic Missile**"*, and
  the 2024 statblock condition agrees: *"when you are hit by an attack roll **or targeted by the
  Magic Missile spell**"*. That half is unreachable from `dnd5e.rollAttackV2` — Magic Missile is a
  plain `damage` activity with no attack roll at all — so the hold gets a second entry point at
  `dnd5e.postUseActivity`, where the usage card already carries the same `flags.dnd5e.targets`
  snapshot an attack message does (`activity/mixin.mjs` `messageFlags`). Deliberately kept to
  **one narrow shape**, because this is curation, not a conditions engine (§2.6):
  - A **second curated list**, keyed the other way round: `Spell:Reaction` — default
    `Magic Missile:Shield`. Keying by the *triggering spell* leaves the `Name:kind` interrupt
    list untouched; Shield is genuinely both (`ac` against attacks, negate against Magic Missile)
    and folding that into one grammar would need two entries and two colons for one reaction.
  - A **third kind, `negate`**, and it is neither of the existing two: there is no attack roll to
    re-test (`ac`) and nothing to reduce by hand (`damage`). The reaction simply means that
    spell's damage never lands on that target. So a negate hold has no re-test, no settle window
    and no AC arithmetic — the answer *is* the verdict.
  - **The block is real, not advisory**, and it happens at `dnd5e.preApplyDamage` (cancelable —
    `actor.mjs:754`), because nothing else in the module touches this spell: Magic Missile is not
    an attack, so Phase 1 neither rolls its damage nor applies it. Damage still rolls and still
    shows on the card — RAW three darts exist and the rest of the table takes them; the shielded
    target is the one row the tray refuses to write.
  - ⚠ **Known and accepted**: a GM who presses Apply while the hold is still *pending* beats the
    verdict, and the damage lands. Correct-by-construction alternatives (vetoing pending
    applications) fail worse — a hold answered Pass would then need a second click nobody would
    remember to make. The card says "held — waiting on Tom" the entire time.
    > **Narrowed at v1.6.0**: the AUTOMATIC path can no longer beat the verdict — a listed
    > spell's damage roll is claimed at birth (`spellHoldPending`) and the elect's applier
    > defers until the hold resolves, then applies per verdict (negated targets skipped).
    > Only a human pressing the tray early still wins, which is a ruling, not a race. This
    > is the "Phase 2/3 owning non-attack damage application" the original note promised.
    > **(gg) extended the same birth-claim to the ATTACK chain** (`attackHoldPending`), so
    > both hold families now share one shape: dice at once, application on the verdict.
    > The usage card also stopped being load-bearing: under suppression the hold rides a
    > replacement card, the damage roll is bridged to it (originatingMessage), and the veto
    > gained a message-free fallback lookup.
- **The hold**: don't auto-continue for that target; stamp `pending` on the attack message (or,
  for the spell trigger, on the usage card — the hold flag and every view of it are identical,
  and holds carry `trigger: "spell"` so the roll-dependent paths can branch off it).
- **Player-side controls** (held target's owning client): popup + card row —
  *"The wight hits you! — [Cast Shield] [Pass]"*.
  **Pass** → the player posts a small response message flagged `respondsTo: <attackMsgId>`
  (players can't update the attacker's message; they can create their own — and "Gren passes"
  is good table record). **Cast** → just triggers their own activity natively — **the cast IS
  the answer**: the resolver detects a usage/effect from a listed item landing on the held
  target and auto-continues; a sheet-cast is detected identically (the button is convenience,
  not protocol).
  ⚠ **The Cast button must really cast.** Shipping it as a button that merely *records* the
  answer produced a hold that spent no slot, applied no effect, and then resolved against an
  unchanged AC — announcing "Shield raises AC to 12" over a hit that should have missed
  (caught in live play, 2026-08-15). It uses the activity with `configure: false`: the
  reaction window is already a pause, and a slot picker inside it spends the moment the
  feature exists to protect. A player who needs to upcast casts from their sheet, which is
  detected identically. The response message carries the reaction, the resulting AC, and
  whether the effect actually landed — a hold that resolves oddly must be readable, not
  mysterious (§2.5).
- **GM override** (Resolve / Skip) on the GM client — the AFK fallback, and why no answer is
  ever *required*.
  > **Superseded in v1.1.15 (§10, recorded 2026-08-16).** The Skip button shipped, ran the
  > same code as Pass, and was removed at the user's call — one decision, two controls, the
  > same two for everybody. The AFK fallback is the **hold timer**; the GM answers only for
  > targets no player owns. See §2.4's matching correction.
- **Re-resolution**: re-run the hit test against the target's **LIVE** AC (⚠ the stored target
  descriptor's AC is stale after Shield) — now a miss ⇒ post "Shield: 19 vs AC 20 — the attack
  misses," chain ends, ~~damage never rolled~~ **the already-rolled dice are released and apply
  to nobody ((gg) — the announcement is the record; no receipt, no HP)**; still a hit ⇒ the
  release ends in the real application. The verdict is
  written onto the hold and **overrides the snapshot for auto-apply too**, which would
  otherwise re-derive "hit" from the stale AC and damage a target we just announced as missed.
  ⚠ **The AC does not move when the cast happens.** Shield's +5 arrives as a non-transfer
  active effect applied by the native effects tray (monster reactions ship theirs *disabled*),
  so a cast gets a settle window to let the change land before the verdict is taken —
  Phase 3 closes this by pressing that button itself.
- **Click-volume guards**: reaction-spent suppression is CORE — any reaction taken by an actor
  suppresses further holds for them until their turn (cleared on the turn hooks). Steady-state
  GM clicks ≈ 0 (players answer their own; NPC-side holds are rare and double as "your monster
  has Shield" reminders — the module makes forgetting monster reactions structurally
  impossible).
- **Popup reveal toggle** (world, dedicated — independent of `attackRollVisibility`):
  ON (default) = show the math ("19 vs your AC 15") plus the computed verdict ("Shield would
  turn this into a miss" / "would not be enough"). OFF = "You are hit — react?" (RAW
  knowledge; cast on faith).
  > **Corrected 2026-08-15 (§10).** This shipped defaulting OFF, on the RAW argument that you
  > know you were hit and not by how much. The user overruled it from live play: *"the default
  > setting for shield should be disclosing the attack roll so the player knows if it will be
  > useful to cast shield."* A reaction spends a real resource on a guess, and a table that
  > cannot see whether the guess pays is not tense, it is annoyed. RAW remains one toggle away.
- **Hold timer** (world): 15s default since v1.11.0 (user call 2026-08-17: every timer
  defaults to 15s — a window a human at a watched window can win); 0 waits indefinitely,
  human-paced. Originally shipped defaulting off / N seconds (≈5 for
  a snappy table): live countdown bar in popup + card row, then auto-continue as Pass + quiet
  log line ("Gren's reaction window passed"). Mechanics per §4.3. A late cast that beats the
  final recheck but loses the race = revert case.
- **Per-client view setting**: popup+card / card-only (GM likely card-only for NPC-side holds).
- **Permanent non-goal**: reaction *automation* — auto-casting, cross-client prompts,
  timeouts-as-protocol. The hold is the full extent, forever. Humans play reactions; the
  module just waits for them.

### Phase 1.6 — the maneuver folds (SHIPPED v1.19.0, 2026-08-20 — FLOW item 1 + Pass A)

Two post-roll folds for the table moments the machine used to resolve in the wrong place or
not at all (session 4's Precision/Riposte stalls, ~45–65s each, every use out of order). One
world list, `maneuverFolds` (`Name:kind`), and **the list is the switch** — no boolean, no
timer of its own (the folds ride `holdTimer`/`holdSkipFutile`/`holdReveal`), no client
settings. The parser is **STRICT**: unknown kinds drop with a console warning, never default
— the exact inversion of the interrupt list's forgiving parse, because that forgiveness is
how `Riposte:ac` produced an every-hit nonsense hold for three sessions.

- **PRECISION** (`precision` — "my own attack missed"): the roller's client stamps a
  `precision` flag on the missed attack message; Use/Pass popup for whoever owns the attacker
  (two controls, drain bar, expiry = **Pass** — a maneuver nobody claims is a maneuver not
  used). Accepting REALLY uses the maneuver activity (the pool is consumed by the system —
  the castReaction honesty rule; recording "used" without using shipped a lie once), rolls
  the die publicly with `respondsTo` provenance, writes per-target verdicts, announces the
  arithmetic (`13 + 4 = 17 vs AC 15 — now hits`) in ONE merged card, then re-drives the
  damage exactly as the hold's continuation does (the player's own dice honoured via
  `playerRollDamage`, the straight roll otherwise).
  - **The verdict channel is hitTargets' own** (shared.js): a second override read beside the
    hold's, hold precedence, disjoint sets in practice (holds stamp hits, precision stamps
    misses). No roll is ever patched — the d20 stands, the total stands, the VERDICT is the
    module's own datum, and every consumer (auto-damage, auto-apply at damage-arrival, the
    riders) honours it through the one shared read. Chain B needed zero changes.
  - **Clean misses only, a deliberate scope fence**: the offer never fires when the attack
    hit anybody. One damage roll serves every target it hit (standing item 1) — patching a
    miss in behind an already-rolled mixed swing would double-apply or demand per-target
    damage, the exact "much bigger change" that item warns about. The table case (a
    single-target swing) is untouched by the fence.
  - **Graze collision (user ruling 2026-08-20): announce, never unwind.** Graze pays on the
    miss and, by its own recorded ruling, reads the attack as rolled (a hold flipping a hit
    to a miss does not re-open it). Precision flipping the other way inherits the symmetric
    stance: the announce card names the conflict ("Graze already paid — revert its receipt
    if you rule it void") and the human presses the existing revert if they rule it void.
  - A fumble is excluded (a natural 1 stands) and a null-AC target stays with the humans.
- **RIPOSTE** (`riposte` — "an enemy's MELEE attack missed me"): the elect stamps a
  `riposte` flag on the ENEMY's attack message — the Graze miss-path template
  (createChatMessage, complement of hitTargets, read **as rolled**: a later hold flip never
  re-opens it). Per eligible reactor (alive, listed usable maneuver, a melee weapon
  equipped, `!reactionSpent`, not the attacker, `modeAllows`): Riposte/Pass popup on their
  own client with a weapon `<select>` (an input, not a third control), expiry = **decline**.
  Accepting really uses the maneuver (pool spent; the reaction is spent too — set explicitly
  with the hold's own in-combat carve-out, since the hold's setter is gated on its toggle),
  then **drives a REAL attack** at the original attacker through the ordinary pipeline —
  use() + rollAttack with the FLAT `flags.dnd5e.originatingMessage` key and `riposteFor`/
  `riposteBy` provenance — and the superiority die joins that attack's damage as a **pushed
  rolls entry** (the hit-riders idiom; the base entry is never mutated). A driven attack
  never chains a second offer (`riposteFor` is the guard), and the reactor's targets are
  restored after the drive.
- **⚠ NEITHER FOLD TOUCHES THE `hold` FLAG, AND RIPOSTE NEVER RE-ENTERS THE INTERRUPT
  LIST** — three measured hazards (2026-08-20): one message carries at most one hold
  (hold.js's re-stamp guard); `hitTargets` treats ANY hold verdict as authoritative
  truthiness (a miss-fold writing there would rewrite the original hit set for every
  consumer); and a name in the interrupt list re-arms three unrelated behaviours off the
  name alone (the cast-is-the-answer matcher, `reactionSpent`'s setter, the cast slice's
  disqualifier). Own flags, own popup namespaces (`precision`, `riposte:<uuid>`), own
  timers; hold.js is imported for two exports and edited not at all.
- **Both folds ride the resolver** (`modeAllows` — Graze's argument): their payoff is driven
  damage, and with the resolver off there is no path for it the table asked for.
- **Crash-resume**: answers are claimed through `queueFlagWrite` with `answeredAt`; the
  elect resumes a claimed-but-undriven answer past a 20s horizon (the topple discipline),
  and Riposte's drive is idempotent by its provenance flags (the driven attack IS the
  receipt). Render re-arms timers from the flag's absolute deadline — the F5-proof shape.
- **📌 THE PER-ROLL RIDER RULING (what Pass C inherits — the volley gate's answer):** a
  module-driven attack that stamps the FLAT originating key is a REAL attack; the riders
  ride it unchanged, because riderTargets' first branch resolves the chain. **Riders ride
  attack ROLLS; the all-targets-or-nothing intersection lives WITHIN one damage roll; N
  driven rolls are N independent rider folds.** Riposte is the shipped precedent. (Volleys
  still need their own claim shape — "this roll is mine, there are N" — the `spellDamage`
  stamp is a deferral, not a suppression; that stays with Pass C.)

#### The v1.19.0 walk amendment (2026-08-20, ninth session — eight findings, all built)

The user walked Pass A and it grew the phase. Every ruling below is theirs and binding:

- **① THE FOLD POPUPS CARRY NO GM-QUIET OF THEIR OWN.** The walk's first finding: with only
  the GM in the room, the Precision popup never raised — the fold's extra
  `isGM && hasPlayerOwner` gate was **mutually exclusive** with `canAnswerFor`'s own
  active-owner check (canAnswerFor already gives the GM the answer ONLY when no owning
  player is connected), so their conjunction was never true on a GM client. The gate is
  DELETED; `canAnswerFor` alone routes: **the player's client gets the popup; the DM gets
  it when no owning player is connected** (ruling, verbatim intent: "players client gets
  the popup, if dm is possessing player and player is not there, then dm gets popup").
  ⚠ This ruling is the FOLDS'. The saves machine's own GM-quiet (v1.12.0, "as a GM i dont
  care to see other player saves") and the holds' (v1.16.0) were WALKED and stand — do not
  harmonize them onto this.
- **② HEW (`hew`), reminder-card-only by ruling** — Great Weapon Master's third bullet
  (crit or kill with a melee weapon ⇒ one attack with the same weapon as a Bonus Action).
  The Push idiom: a card states the option, nothing rolls, nothing arms, nothing times
  out. Crit trigger posts from the roller's client; kill trigger posts from the elect off
  the receipt it just wrote (⚠ the damage's `originatingMessage` is the USAGE card — the
  chain resolves through `getAssociatedRolls("attack")`, the die injection's measured
  shape; a hand-tray kill posts no receipt and so no reminder, recorded and accepted). A
  crit that kills reminds ONCE (the kill path defers to the crit's stamp).
- **③ AN ARMED CLEAVE ANNOUNCES IN THE DAMAGE POPUP** — the v1.18.0 popup gains a line
  ("this is the armed Cleave swing: the ability modifier is dropped") via a read-only
  `cleaveArmedFor` reached by LAZY import (a static edge would drag mastery's imports
  ahead of hold.js in the §9 entry order).
- **④ THE RIPOSTE WEAPON FLOW** (the walk: "unclear how a weapon is picked"): the dropdown
  defaults to the weapon the reactor LAST ATTACKED with (the log is the witness; inventory
  order told nobody anything); ONE equipped melee weapon skips the dropdown entirely and
  is named in the popup and button; the chosen weapon is STORED on the reactor entry at
  answer time (so the crash-resume drives the chosen weapon, not a fallback) and the
  resolved card names it ("Riposte — X strikes back with Longsword").
- **⑤ BASH (`bash`) — the failure's consequence is the attacker's CHOICE** (Shield
  Bash's own text: push 5 feet or Prone, your choice). A failed save on a demand whose
  item IS the listed feat holds that target's consequence pass between verdict-announce
  and application: a two-control popup to the attacker (①'s routing) — **Knock Prone**
  (since walk-5 (x): the STANDARD Prone chip via forceStatus — Topple's press, canonical
  id, origin names the presser; the item's own effect is never applied) or **Push 5 feet**
  (the Push mastery's idiom: an announce card, a hand-moved token, NO press). Expiry
  defaults to **Prone** — the machine finishes what the failure started, and the card says
  "defaulted by the timer".
- **⑥ INTERPOSE (`interpose`) — the save-success reaction** (Interpose Shield: a
  successful DEX save against half-on-success damage while holding a shield ⇒ spend the
  Reaction, take NOTHING). ⚠ This shape was recut into a pre-roll gamble by re-walk
  finding (f) and RESTORED by walk-5 (y) — the rule's conditional tail conjoins "you
  succeed" with "are holding a Shield", both preconditions of the Reaction, and the text
  has no spent-and-failed state. The accept button pair is Use / **Take half** (the
  outcome is known at choice time — law 3's scope note). Same choice machinery as ⑤ on
  the SAVED branch: gates are
  autoApply on (a "no damage" promise is only honest when the module is the applier),
  `hasDamage` + `damageOnSave: half`, DEX among the save abilities, the listed item on the
  SAVER, an equipped shield, `!reactionSpent`. Accept ⇒ the damage entry's multiplier
  resolves to **null** (no application, no receipt — the applier never fires) and a
  **validation card** posts (the walk's explicit ask: a zeroed number must never read as a
  dropped machine); the Reaction is spent in combat, the hold family's carve-out. Expiry
  **passes** — a Reaction is never spent by a timer.
  - **The choice machine is ONE mechanism** for ⑤ and ⑥: a per-target `choice` sub-object
    on the saves flag, stamped by the elect inside the consequence pass (which then
    returns; `applied` stays false so the update/render floors resume it), answered
    player-first via the fold routing, folded by the elect when the answerer cannot write
    (the §4.1 relay — see below), buzzed by an elect timer off the earliest stored
    deadline, closed everywhere on answer.
- **⑦ SOURCE, THEN RESULT — binding wording law for every follow-up line** (the walk:
  "all these follow ups should say the source of the ability, then the result"). Verdict
  lines read "Shield Bash — Thomas holds", maneuver cards "Precision Attack — used, now
  hits", Riposte rows "Riposte — X strikes back with Y", Topple "Topple — X stays
  standing", Hew "Hew — X can attack again". New cards inherit the shape by default.
- **⑧ A VERDICT SPEAKS AS ITS SUBJECT.** "Thomas holds" rendered under the CASTER's
  (Salyth's) title card — verdict lines (saves + topple success) now speak as the actor
  the result is about, falling back to the card's speaker only when the uuid no longer
  resolves.
- **📌 THE §4.1 RELAY EXTENDS TO FOLD ANSWERS.** A player cannot update someone else's
  chat message (ChatMessage update permission is author-or-GM — measured against core's
  own metadata: no `update` entry, so the OWNER default rules, and `getUserLevel` grants
  OWNER to the author alone). Riposte answers and save-choice answers from non-owning
  clients therefore travel as the answerer's OWN message (`riposteAnswer` /
  `saveChoiceAnswer` flags) and the ELECT folds them in — hold.js `answerHold`'s split,
  applied to the folds. The riposte relay branch drives its own accepted attack
  immediately (`trusted` — waiting for the fold round-trip would idle the player's dice);
  the elect's 20s crash-resume covers a client that died between relay and drive. ⚠ This
  gap was INVISIBLE in every GM-only walk room — the GM owns everything — and would have
  bitten the first real player answer. (The re-walk PROVED the relay at the table: both
  riposte accepts arrived through it from a second window.)

#### The re-walk amendment (2026-08-20, same session, second round — findings (a)–(i))

The re-walk of the eight produced its own round. The chat log was the witness throughout
("review the chat logs, evidence is all there" — the user's own instruction), and it
closed one finding before any code: **(b) the Hew crit trigger WORKED** — the card posted
three seconds after the Maul crit and was scrolled past under the Topple flow. Which is
itself the round's headline ruling:

- **(c) THE POPUP DESIGN LAW (binding, the user verbatim): "our design language is to
  give players popup notifications on easy things to forget."** Hew is the first citizen:
  the reminder now POPS (the mastery notice family's OK-only shape — drain bar, auto-close
  at the deadline, `canAnswerFor` routing) with the card as the durable record. Every
  future easy-to-forget moment inherits this law by default.
- **(f) INTERPOSE IS A GAMBLE DECLARED BEFORE THE ROLL — ⚠ OVERTURNED BY WALK-5 (y)
  (2026-08-21): the user re-read the feat at the table and the post-verdict, success-only
  shape is the rule; ⑥ above is current again. Kept as the record of why the machine
  visited the pre-roll shape at all.** (Original ruling and rationale: user's
  order-of-operations call, and the feat's own tense — it also explained the re-walk's
  silence: the old post-verdict offer fired only on "saved", and Thomas failed both
  Fireballs by timer.)
  Eligibility is read where the demand STAMPS (and at area adoption): the choice rides the
  target entry from birth, its popup precedes the save ask (the ask defers while a choice
  pends; the Roll button never locks), and the verdict settles it — save held ⇒ zero, no
  application, no receipt, validation card; save failed ⇒ the failure's FULL damage and a
  neutral "the Reaction is spent — the gamble lost" card. The Reaction spends on use
  regardless of outcome (RAW). Expiry still passes — a Reaction is never spent by a timer.
- **(g) THE HIT IS SHIELD BASH'S TRIGGER** ("shield bash never triggered a popup attacking
  combat dummy" — the table hit with the sword; the module only knew the sheet path). A
  melee WEAPON hit by a listed `bash` carrier stamps a Use/Pass offer on the attacker's
  own attack message (their message — the precision locality, no relay needed), with a
  target select only when the swing struck more than one living creature. Accepting aims
  at the struck target and drives the feat's OWN save activity — the demand and the
  Prone-or-push choice are the existing machinery from there. Once per turn in combat
  (the feat's clause, the Cleave stamp discipline); out of combat every hit offers. The
  sheet-direct path still works.
- **(h) `canAnswerFor` ALONE ROUTES THE SAVE-FAMILY POPUPS** — the saves popper and the
  topple ask carried the folds' exact ①-bug (`isGM && hasPlayerOwner`, mutually exclusive
  with canAnswerFor's active-owner check), so a solo-GM room watched "failed (timer)" eat
  every player-owned save. The v1.12.0 ruling is UNTOUCHED where it was made (an online
  owner still excludes the GM); only the nobody-home case now pops. The "waiting on the
  timer (owner offline)" row text described the removed quiet and went with it.
  ⚠ CONCENTRATION IS DELIBERATELY NOT TOUCHED — its offline-owner behaviour was ruled
  FINE 2026-08-19 ("this is fine remove from list") and that ruling stands.
- **(d) THE SUPERIORITY DIE BAKES INTO THE SNAP-BACK'S BASE ROLL** — one dice group, one
  total (the walk saw the pushed second entry as "a separate window"). A base part
  crit-doubles, so a riposte crit doubles the die: the 2024 rule, free.
- **(i) THE RIPOSTE LIST IS EVERY MELEE WEAPON CARRIED, NOT JUST EQUIPPED** (user: 2024
  lets a swap ride any attack, "so it makes an assumption that isn't likely true").
  Equipped-first ordering, stowed ones labelled "(stowed)" in the popup, the CLEAN name on
  the card, the last-attacked default preserved, eligibility widened the same way, and
  the sheet is never mutated — the card records the fiction, the bookkeeping stays human.
- **(a)** The Cleave reminder's Dismiss line gains "— or if you've already Cleaved this
  turn."
- **⚖ (e) OPEN JUDGMENT, defaulted to KEEP:** Graze/Precision offering on a missed driven
  riposte is RAW-legal and follows the per-roll ruling (driven attacks are real attacks).
  The user asked about the rules, did not rule; the fence (one guard on `riposteFor`) is
  recorded here as the lever if the cascade ever grates at the table.

#### The round-3 amendment (2026-08-21 — the walk-3 findings, landed ON the spine)

The §4.3 spine amendment carries the laws and the mechanism table; this records what
changed in THIS phase's machines. Every machine here now composes the spine (openMomentPopup,
shownMoments, momentBarHTML, momentButton, armDeadline) — the per-machine latch sets, timer
trios and button factories are gone.

- **(k) BOTH Hew triggers live on the damage side.** The crit reminder posted from
  rollAttackV2 — BEFORE the damage, and with the damage popup open, before it by the whole
  window ("attack again" preceding the attack's own resolution). Both triggers now key off
  the crit's damage MESSAGE: the crit posts when that roll EXISTS (elect,
  createChatMessage), the kill stays receipt-side, and the dedupe is ONE `hewNoticed` flag
  on the damage message — a per-message check queue (the queueFlagWrite idiom) serializes
  the two so a crit-that-kills still reminds exactly once, the crit's post winning. A crit
  whose damage is never rolled posts no reminder — the kill path's accepted hand-tray gap,
  now shared.
- **(p) THE RIPOSTE SWINGS OUT LOUD.** A driven attack that HITS celebrates in the damage
  offer as the riposte's own moment ("Your riposte hit! — roll damage", the die-riding
  note, crit variant "Critical riposte!"); a MISS posts "Riposte — the strike back misses"
  from the rolling client, so the Graze/Precision offers that may follow ((e)-KEEP) arrive
  from an announced miss instead of from nowhere.
- **(l) lands at its chokepoint:** offerDamageRoll is the ONE celebration site — plain
  swings, riposte drives and precision re-drives all read their flavor off the attack
  message's own flags there (riposteFor / precision.outcome), and the crit badge stays the
  one crit source. The save-damage offer keeps its stakes-line identity untouched.
- **(m) in the choice machine:** the relay card's use-label reads "spends the Reaction"
  (it said "takes no damage" before a save that then failed — proven live), the pass-label
  "the Reaction is kept", and the interpose Pass button was bare "Pass" while the gamble
  was pre-roll. ⚠ Walk-5 (y) moved interpose POST-verdict, so its buttons/labels state
  knowns again ("Take half", "spends the Reaction: no damage") — law 3's scope note; the
  BASH labels still declare only the choice. Settle cards are unchanged — verdicts state
  results.
- **(n) is structural now:** both choice-bar call sites draw momentBarHTML (the pure
  `{deadline, window}` primitive), and the suite asserts the bar's DOM
  (`data-bf-deadline`) so an invisible bar can never pass again.
- **(j) reaches Hew:** the OK acknowledges through the spine's ACK — bar, recall and popup
  resolve; the mastery notices (Vex/Sap/Cleave) ride the same call in their own file, Arm
  keeping the "Cleave — armed" card.

### Phase 1.7 — the volley folds (BUILT v1.20.0, 2026-08-21 — FLOW item 6 / Pass C, battery-green, awaiting the walk)

One spell, N projectiles, and the system rolls exactly ONE subsequent action per use —
session 4 re-cast Scorching Ray three times for one volley and hand-lumped Magic Missile's
dice. The fold (`scripts/volleys.js`, its own file, composing the §4.3 spine — map row 15)
suppresses the single native follow-up and gives the CASTER one popup to aim the whole
volley. `tools/smoke-volleys.mjs` 24/24 is its suite.

- **DETECTION IS THE REGISTRY** (finding (ff), 2026-08-21 — the user's directive, kept
  verbatim in `scripts/volley-registry.js`, OVERTURNS FLOW item 6's structural-only
  instruction; the fifteenth-session census `tools/scan-volley-spells.mjs` is the ground):
  premium content ships its multi-projectile data wrong in BOTH directions — the 2024
  pack's Scorching Ray is BARE (every fresh copy arrives bare, so the per-copy graft could
  never keep up; Salyth proved it within a day), Eldritch Blast ships count `"1"` (beams
  live only in prose), and Dimension Door ships count `"2"` WITH a damage activity (a
  structural false positive). Membership is name-keyed with per-spell handling `{kind,
  count, distinctTargets?}`: **Magic Missile** (damage, `"2 + @item.level"`), **Scorching
  Ray** (attack, `"1 + @item.level"`), **Eldritch Blast** (attack, beams band by CHARACTER
  level 5/11/17 off `details.level`, NPCs by `ceil(details.cr)`; below 2 beams stays
  native), **Steel Wind Strike** (attack, `"5"`, distinct targets). An UNLISTED spell is
  never a volley regardless of its data; a listed one volleys only when the USED activity
  matches the entry's kind and the count evaluates 2+. Save-shaped multi-target spells
  (Prismatic Spray, Chain Lightning, Acid Splash) are excluded by design — the saves
  pipeline owns them. The registry rides `game.modules.get(…).api.volleyRegistry` (the
  suites' fixture seam). ⚠ `fix-scorching-ray.mjs` is DELETED, the sandbox grafts
  reverted — prod content stays stock forever, nothing content-side rides the release.
- **THE CAST LEVEL comes off the usage message** (`system.spellLevel`), not the config —
  measured: the system RE-RESOLVES a bare `use({scaling})` during consume and it reaches
  postUse as 0; the slot pick is what real tables do and the message field is the value
  the system stands behind (polish.js's castPayload reads the same field). The count
  formula evaluates with `@item.level` = cast level and `@scaling` both provided.
- **THE CLAIM SHAPE** (the Pass C unblock, discharged): `usageConfig.subsequentActions =
  false`, set in `dnd5e.preUseActivity` through the hook's mutable config (the potion-aim
  seam) — walk-4 (v)'s flag, arriving from the outside. ⚠ Measured while wiring it: the
  system's `createConsumedFlag` records HIT DICE only and returns void otherwise — Refund
  Resource's real channel is the usage message's own `system.deltas`, which consumption
  stamps regardless. The stamp still replicates the system's two lines verbatim so even
  the hd edge behaves natively.
- **DARTS (damage kind — Magic Missile):** simultaneous by RAW ⇒ per-target ONE aggregated
  roll: k darts = k copies of the base damage entry pushed at `dnd5e.preRollDamageV2`
  (formula rewrites would re-roll shared dice; k visible groups read as k darts), aimed by
  setting the canvas target around `rollDamage` (the maneuvers drive idiom) so the roll's
  own snapshot names exactly that target. polish.js's existing `spellDamage` birth stamp +
  hold.js's applier then do application; concentration checks ride it — ONE per target per
  volley, which is the Gren-hand-lump correctness the fold exists to automate. The hold
  blocklist composes free: driven rolls born `spellHoldPending` defer until the spell hold
  resolves, negated targets take zero. ⚠ The volley releases its OWN unheld claims —
  hold.js's `releaseUnheldSpellDamage` polls at USE time and the volley's rolls arrive a
  popup later, so `driveDarts` folds `spellHoldPending` when the card carries no hold.
- **RAYS (attack kind — Scorching Ray):** independent attacks by RAW ⇒ one REAL
  `rollAttack` per ray at its chosen target, driven sequentially so cards land in ray
  order — then the ORDINARY pipeline per ray: auto-damage or the player's own offer, a
  hold pausing that ray's damage alone, riders folding per ray (the Phase 1.6 per-roll
  ruling, now exercised). Sequential DRIVING, never sequential resolution.
- **PER-RAY ADV/DIS ((dd), 2026-08-21 — RAW; "rays roll straight" was never a rule, only a
  thirteenth-session build default the fourteenth-session recut misfiled):** each ray row
  in the popup carries a Normal / Advantage / Disadvantage select (the concentration
  popup's own buttons are the in-house precedent). An explicit pick forces the roll's
  `advantage`/`disadvantage` booleans — the channel applyKeybindings recomputes
  advantageMode from, where mergeConfigs lets the explicit boolean out-vote the data-driven
  one — and **Normal passes nothing**, so sheet-borne modifiers keep applying themselves.
  One decision surface, still zero native dialogs (the walk-4 (v) orphan class stays dead).
- **DISTINCT TARGETS ((ff) — Steel Wind Strike's "against each of up to five creatures"):**
  a `distinctTargets` entry clamps n to the target count at stamp and throws one projectile
  per creature — the popup says so, and duplicate picks fall back to the one-each default
  rather than refuse to fire (expiry-class safety).
- **THE AIM ON EVERY ROLL ((ee), 2026-08-21):** every driven volley roll names its target
  on its card — token icon (tooltip, law 8) + name, read off the roll's own dnd5e target
  snapshot (pure render, no lookups). Dart rolls carry `volleyTarget`, ray attacks
  `volleyRay`; a ray's follow-up damage chains off its attack card, which names the target
  right above it.
- **THE DAMAGE KNOWS ITS ATTACK ((ii), the v1.20.0 retest, 2026-08-21):** every roll
  `rollDamageForAttack` makes is stamped `attackFor` — the exact attack's id — and
  `resolveAttackMessage` reads it FIRST. The registry walk ("last attack before this
  damage under the same usage card") misattributes under a volley: all three rays share
  one card, so once the offer popups open every ray's damage resolved to ray 3's attack —
  ray 1's dice re-tested against ray 3's MISS never applied (the user's "the damage didnt
  auto apply"), and (gg)'s belt-and-braces read a hold off the wrong attack. The walk
  survives as the fallback for rolls the module never drove; riders and mastery now read
  the RIGHT attack per ray as a side benefit. Pinned: smoke-volleys 3e2 (per-ray receipt
  identity), smoke-hold §1 (the claim names its attack).
- **THE AIM ON EVERY SURFACE ((hh), the v1.20.0 walk, 2026-08-21):** (ee)'s icon reaches
  the two surfaces that still named targets in text alone. The POPUP: every dart row leads
  with its target's token icon (user, on the screenshot: *"in thee row where it says thomas
  -- 3"*), and every ray row carries its PICK's icon, tracking the select via a change
  listener (*"match that pattern for rays too"*) — the stamp records `img` off the target
  snapshot for exactly this. **Row grammar (user tweak, same day): ONE line mirroring the
  cards — the icon LEADS, then the name** (*"[icon] [name] is targeted … better mirrors the
  layout of cards themselves"*): darts read `[icon] **Name** is targeted [n]`, ray rows
  lead with the tracking icon before "Ray N" and its selects. The ROLL POPUP: the damage offer's "Against …" line renders
  icon + name per target (one `againstLine` helper serves the attack AND save flavours —
  the family's one-shell rule). Law-8 tooltips everywhere; an imageless target degrades to
  its name.
- **The popup** is the caster's own (damage-offer locality — no elect, no relay): steppers
  per target (darts) or a target select per ray, one Fire button, the family bar. The X
  fires as aimed ("get on with it", never a cancel); the buzzer fires the EVEN SPREAD
  (`damageTimer`, expiry-fires like all of its family); the claim is a `queueFlagWrite`
  race so button, X and buzzer resolve exactly once. Render re-pops and re-arms on the
  author's client — an overdue reload fires the spread instead of stranding. ⚠ Accepted
  family limit, recorded: the clock lives on the casting client; a caster who never
  returns leaves the volley unfired and the GM's fallback is the sheet.
- **Rides the resolver** (`modeAllows` + the `volleys` world boolean, default ON) — the
  folds precedent: the whole payoff is driven rolls. Targetless casts stay native (nothing
  to aim); count 1 stays native; the OFF switch restores today exactly.
- ⚠ **Suite-scoping note:** smoke-hold pins `volleys` OFF (the masteryRiders precedent) —
  Gren's real MM is now a volley and the extra popup breaks that suite's dialog searches.
  The volley×hold claim compose is smoke-volleys §6's pin.

#### The resource use notices (BUILT v1.20.0, same session — the user's ask verbatim)

*"if an ability has x of y per day or short rest, give a notification like it does on
combat plus on turn notice (a screen flash and fade of text). say something like used
[ability], x of y remaining."* — `scripts/resources.js`, `tools/smoke-resources.mjs` 11/11.

- **ZERO NEW STATE:** dnd5e stamps every consumption onto the usage message itself —
  `message.system.deltas` (measured: `{actor: [{keyPath, delta}], item: {id: [{keyPath,
  delta}]}}`, written before the message is created). Every client reads the spend off the
  replicated message and flashes locally; the chat log is the bus, as everywhere.
- **THE RHYTHM GATE (structural, no name list):** a spend announces only when its pool's
  uses carry a RECOVERY period — the user's own definition. Covers every named candidate
  (Innate Sorcery, Font of Magic's sorcery points, superiority dice, Channel Divinity +
  Vow of Enmity, Second Wind, Action Surge, free-cast spells, First Light / the Maul /
  the Graveheart daily casts — all measured in the world) and structurally excludes
  torches, rations, potions, healer's kits (uses, NO recovery) and spell slots (actor
  keyPaths the reader never looks at). Negative deltas (regains) stay quiet. Three pool
  shapes recognized: item uses, cross-item pools, and `activityUses`
  (`system.activities.<id>.uses.spent` — Hunter's Mark's free cast).
- **WHO:** player-owned actors only, announced to EVERY client (the combatplus turn
  banner's own publicity — this module's settings-sheet divider idiom already came from
  there). NPC spends never flash: monster resources are the GM's secret.
- **Surfaces:** the FLASH (combatplus's exact banner idiom — fixed, huge, fades over
  ~4s, un-clickable — seated at 26% so a turn banner never collides, stacking downward)
  is the attention; the CARD LINE (idempotent render decoration, law-8 tooltip on its
  icon) is the durable record. History is inert: only messages younger than 10s flash,
  once per client. World boolean `resourceNotices`, default ON.
- **(cc), 2026-08-21 — the flash waits for the ability's own dice** (user: *"can it show
  after healing?"*, scope-confirmed by directive): a use whose activity carries dice still
  to roll (heal formulas, damage parts — Second Wind's class) holds its flash in a
  client-local pending map and releases when the linked roll arrives —
  `originatingMessage` for card-button rolls, the activity uuid for sheet-driven rolls
  (BOTH measured 2026-08-21; a sheet roll has no enclosing card and never stamps the first
  key) — with a 12s fallback so a player who never rolls still flashes. The card LINE
  never waits: it is the ledger, not the attention. Utility, attack and save activities
  stay immediate — attacks and saves run whole machines of their own.
- **Free synergy, deliberate:** the maneuver folds spend superiority through real
  `activity.use()` (the castReaction honesty rule), so Precision/Riposte/Bash announce
  their die spend with zero coupling — the honesty rule paying out a second time.

### Phase 1.75 — curated damage riders (the Hunter's Mark tier)

A rider is a damage roll you press **separately from casting the thing that granted it** —
Hunter's Mark's "Bonus Mark Damage". This phase folds it into the weapon's own damage roll.

Three tiers of damage-adders:

1. **Flat, unconditional** (Divine Favor): already native — an active effect writing
   `system.bonuses.mwak/rwak.damage` is folded into damage rolls by the system. Zero code; it
   only needs the effect to be *on* the caster.
2. **Target-marked** (Hunter's Mark, Hex): dnd5e 5.3.3 cannot express "only vs the marked
   creature" (Conditional ActiveEffects is on the system roadmap — **delete this shim when it
   ships**). The marker effect on the target **IS the state**: at `dnd5e.preRollDamageV2`
   (attacker's client, config still mutable), check whether the hit target carries a marker
   whose origin traces to this attacker; if so, append the typed damage part **into the roll
   config before rolling** — crit-doubling and resistance math come free. Formulas from the
   **curated rider table** (§6), swept from official content by `tools/scan-riders.mjs`.
   **What it needs is that the marker is present, not that we placed it.** The caster applies
   it by hand from the native effect tray today, which is exactly the click Phase 3 automates
   later; the rider reads the resulting effect either way. Phase 3 is a comfort here, never a
   prerequisite.
3. **Not touched**: Hex's ability-check disadvantage (conditions layer), moving the mark on a
   kill (a bonus-action decision — a human moment, not a button).

**Found by the sweep, and binding on the design** (`tools/scan-riders.mjs`, 23 hits / 13
identifiers across `dnd5e.spells24`, `dnd5e.classes24`, `dnd-players-handbook.*`,
`dnd-heroes-faerun.*`):

- **The table is keyed by `system.identifier`, not by name.** A ranger's Favored Enemy casts
  arrive as a *separate item* ("Hunter's Mark - Favored Enemy", a `cachedFor` copy) sharing
  `identifier: "hunters-mark"` and the same marker effect id. Keying on the display name would
  silently skip the free casts — the ones a ranger uses most. Same trap as the worn-shield /
  Shield-spell collision in Phase 1.5.
- **A rider can be UPGRADED by an attacker feature**, so upgrades are their own `feature:mark`
  list. Ranger `foe-slayer` (level 20: *"the damage die of your Hunter's Mark is a d10 rather
  than a d6"*) ships an "Improved Hunter's Mark Damage" activity at `1d10` force and says to use
  it *in place of* Bonus Mark Damage. The upgrade **replaces** the mark's damage, never stacks,
  and its number is read from the feature the same way — nothing in the code knows a die size.
  Two Hex identifiers (`hex`, `great-old-one-hex`) likewise share one mechanism and one marker.
- **Two casters can mark one creature**, so the marker's name and its `marked` / `cursed` status
  are both useless as tests. The trace is `origin`, walked up to the nearest Actor — which also
  passes the source Item, answering *who* and *what* in one hop each.
  ⚠ **Concentration is not the trace, and must never be a gate.** The tray sets
  `origin = concentration ?? effect` (§7), but that first branch needs
  `chatMessage.system.concentration`, and a live Hunter's Mark on this table arrived pointing at
  the **source item's own effect** while the caster was concentrating throughout. Code to the
  walk, not to either branch. And the *presence* of a mark is the whole state: the
  dependent-effect cascade deletes it when concentration breaks, so a mark still on the target
  is a mark that still counts.
- **Riders double on a crit, and that needs no setting.** 2024 PHB: *"Roll the attack's damage
  dice twice… If the attack involves other damage dice, such as from the Rogue's Sneak Attack
  feature, you also roll those dice twice."* A target-marked rider **is** part of the attack, so
  it doubles — a determined outcome, not a choice (§2.1). Injecting the part into the weapon's
  own roll config gets this for free: `configureDamage` raises the die count on every dice term
  it finds, ours included. **`damage.critical.allow` is ignored, deliberately.** It reads
  inconsistently across official content (compendium `hunters-mark` `true`; the Favored Enemy
  copy and `foe-slayer` `false`) because it governs the standalone *button* — whether pressing
  "Bonus Mark Damage" by itself offers a crit toggle, where the system has no attack to ask —
  not whether the rule doubles the die. The corollary bounds the table: a damage-adder that is
  **not** part of an attack (a start-of-turn tick, an AoE pulse) does not double, and is also
  not a rider.
- **Out of scope by §8, not merely unbuilt:** `conjure-minor-elementals` is a real rider
  ("any attack you make deals an extra 2d8 when you hit a creature in the Emanation") but its
  condition is a 15-foot emanation — **range math**, a permanent non-goal — and its damage type
  is chosen per attack, a decision rather than an outcome (§2.1).
- **Structural false positives to leave off:** `ensnaring-strike` (its activity is literally
  "Start of Turn Damage"), and the AoE/retaliation family — `phantasmal-force`, `forbiddance`,
  `storm-of-vengeance`, `vitriolic-sphere`, `wall-of-fire`, `hunger-of-hadar`,
  `armor-of-agathys`, `death-armor`. They share the no-activation damage-activity shape without
  being attack riders.

Independent of Phase 1: `preRollDamageV2` fires whether Battle Flow auto-rolled the damage or a
human pressed the native Damage button, so the rider works with auto-damage off. **Ordering
caveat inherited from the reaction hold:** a held attack rolls its damage after the answer, on
the continuing client — still that client's `preRollDamageV2`, so nothing special is owed, but
the smoke suite should prove it rather than assume it.

### Phase 1.9 — effect & mastery riders (the on-hit payout tier)

Slotted before saves by user redirect (2026-08-15): on-hit effects and weapon masteries fire
every round, saves a few times a fight, and the v1.2.0 payout machinery was hot. Shipped
v1.3.0 (2026-08-16).

- **1.9A — spell effect riders.** At the point the chain applies an attack's damage, the
  effects riding the usage card land on each **hit** target through the native application
  path — same origin rule (`concentration ?? effect`), same `dependentOn` cascade, same
  re-enable-instead-of-stack for an existing same-origin copy (bug-for-bug parity with the
  tray, deliberately). **Per-target on purpose**: the damage riders' split-target
  intersection refusal does NOT apply here, because each target gets its own document — hit
  the quarry and an unmarked goblin, both get slowed. Effect receipts join the damage card
  with a per-effect GM revert that tolerates the effect already being gone (concentration
  cascade, manual right-click, death).
- **1.9B — weapon mastery riders.** Detection is one flag read: the system stamps
  `flags.dnd5e.roll.mastery` onto the attack message only when the wielder genuinely has
  mastery with that weapon — eligibility, identity and the which-mastery choice are all
  pre-solved upstream, and masteries are PC-only in data, so the ask always has a natural
  owner. Payouts follow the 2024 rules text: **Vex and Sap are automatic** (no "can" in the
  rule; Vex additionally requires damage dealt, read from the receipt's post-trait `taken`),
  **Slow, Topple, Push and Graze are the wielder's option**. Authored effect chips carry the
  rule in their description; Topple posts the native `[[/save]]` enricher with the computed
  DC and stays a **manual** save until Phase 2 upgrades that same card in place; Push
  announces and never moves a token; Graze pays the ability modifier through the shared
  applier with its receipt on the **attack** card (a miss has no damage message). Cleave and
  Nick stay native — action economy is not a payout. Hopeless skips mirror the hold's: no
  Topple ask on the prone, no Slow ask at 0 speed, nothing asked about the dead.
  > **Amended 2026-08-16 (v1.5.0, user calls from the 1.9 dogfood).** (a) **The Topple card
  > folds its own save**: a Constitution save rolled from the card's enricher — or bare from
  > a sheet by a still-pending target — is judged on the elect against the DC stored on the
  > card's flag; a failure applies Prone itself and announces it, a success just closes the
  > question. The save ROLL stays human-pressed, so this upgrades the card in place along
  > Phase 2's exact line rather than automating the save; the GM per-target button remains
  > for saves rolled on paper. (b) **Cleave gains a reminder** — a hit with a Cleave-mastery
  > weapon tells the wielder the option exists (once per combat turn); the extra attack, its
  > target and its rolls stay entirely native. Action economy is still not a payout.
- **1.9C — the ask.** The hold's design language on lighter machinery: **popups ask
  questions, cards state facts.** One decision, exactly two controls (Use/Pass — the
  two-control rule is binding), answered by the attacking player's owner, on the hold's own
  timer (`holdTimer`, 0 waits; expiry = Pass). Nothing downstream waits — it is a payout
  with a confirm, not an interrupt, so there is no continuation, no settle window, no
  re-test. `masteryAsk: auto` is the tedium escape hatch (user call: players like being
  reminded of their options).
  > **Amended 2026-08-16 (v1.5.0, user call): the automatic masteries get a reminder
  > moment.** *"The design is for people to know weapon masteries and not forget they have
  > those."* When Vex or Sap lands (and when Cleave is available, 1.9B above), the attacking
  > owner's client gets an **informational popup**: the fact in the mastery's own words, ONE
  > control (OK), and a 15-second auto-dismiss with the drain bar — dismissal and expiry are
  > the same non-event, nothing downstream waits. A public announcement card posted by the
  > elect is the durable record; the popup is a per-client view of it. This *refines* the
  > "popups ask questions" language rather than breaking it: a reminder of a time-limited
  > fact is a table moment (§4.3's attention surface). What stays banned is a fake CHOICE
  > (the Skip lesson) and result announcements dressed as popups — an OK-popup is allowed
  > only where the fact expires with the moment (Vex's advantage window, Cleave's turn).
- **1.9D — per-source card suppression.** `suppressAttackCards` becomes a master gate over
  four per-source switches keyed by the item type behind the activity — weapon / spell /
  feature / other — each defaulting to suppressed, so a world with the old boolean on
  carries forward identically with nobody touching settings. The Phase 1.1 carve-out
  sharpens: a card carrying effects survives only when the riders will *not* handle them
  (Effect Riders off, or a concentration cast — its origin linkage lives on the card and the
  suppressed-card fallback cannot rebuild it). Scope guard: attack-activity cards only;
  save-spell cards are load-bearing until Phase 2.
  > **REMOVED at v1.10.0** — see the Phase 1.1 suppression note for the full policy: cards
  > always post, `hideCardButtons` (v1.9.5) is the surviving card-shaping machinery, and
  > the whole 1.9D switch block is deleted.
- ⚠ **THE FENCE (user call, permanent for this phase): nothing here ever modifies a d20.**
  Advantage/disadvantage enforcement and consumed-on-use expiry (the AC5e-sized lift) are
  explicitly out of scope — the applied chip is the reminder and the roll dialog's adv/dis
  buttons are the enforcement surface. `dnd5e.preRollAttackV2` exists if a later phase wants
  enforcement; nothing here blocks it.
  > **The fence's RESOLVED READING (v1.19.0, recorded because FLOW's one-line restatement
  > reads broader than this text):** what the fence forbids is silently ENFORCING or
  > altering a d20's roll conditions — guessing at advantage, re-rolling, patching dice.
  > Phase 1.6's Precision fold does none of that: the d20 stands, the total stands, and a
  > DECLARED, player-pressed maneuver writes a VERDICT through the module's own override
  > channel (the hold has done exactly this since Phase 1.5, in the other direction). The
  > same reading is why silent Cleave detection stayed rejected — that one WAS a guess.
  > **The v1.19.0 Cleave arm rides this line too:** the ability-modifier strip runs at
  > `dnd5e.preRollDamageV2` (a DAMAGE part, never a d20), only when armed by an explicit
  > press, skipping a negative mod (the system's own off-hand predicate, mirrored). The
  > arm control lives on the reminder POPUP as its decision pair (Arm the Cleave /
  > Dismiss) — the recorded exception to "Cleave's reminder is an OK-popup": the moment
  > gained something to decide, so it gained the two controls, and the card stays
  > recall-only per the one-input-surface rule.

### Phase 2 — saves

> **Shipped v1.7.0 (2026-08-16, joint with Phase 3's save slice), exactly as the note below
> prescribed.** One new sibling (`saves.js`) plus one entry import; the 2.5 machine
> generalized per target; battery-proven (smoke-saves, 22 assertions) and OFF by default.

> **Amended 2026-08-16/17 (v1.9.5–v1.10.0, user calls): template containment IS the target
> set, in both directions.** A save demand whose activity placed a template derives its
> targets from the AREA — at the stamp (`results.templates` at postUseActivity), by
> adoption when a matching-origin template appears later, and as the area moves or
> re-places: done entries keep their verdicts, pending entries outside drop (and their
> popups close — the §4.3 withdrawal rule), arrivals join fresh. Manual targeting stays
> the bus for template-less casts, and "no template" (snapshot) is distinguished from "an
> empty template" (nobody saves) on purpose. Instantaneous templates are spent once every
> verdict's consequences land; duration spells keep theirs. ⚠ Ground truth (v1.10.0, read
> from 5.3.3 source after two live misfires): `results.templates` entries are **arrays**,
> not documents — `#placeTemplate` pushes `drawPreview()`'s resolution, which is the raw
> `createEmbeddedDocuments` result. Flatten before containment, or every live placement
> silently falls back to the manual snapshot.
>
> **The topple demand joined the save machine's timer at v1.10.0** (user call, round two:
> the universal design language — every table moment carries the deadline bar and one
> authoritative clock). The topple flag stamps `saveTimer`'s deadline, the bar runs on
> popup + card row, and the buzzer ROLLS the still-pending targets straight and
> data-driven (a demanded save is mandatory), marked as the timer's press. The GM
> per-target prone button remains the paper-roll backstop. v1's "no timer" stance is
> superseded.
> Deliberate corners, recorded in the file's banner: a multi-ability save ("Str or Dex")
> auto-rolls the FIRST listed ability (the fold accepts any listed one, so the other is a
> sheet roll away); a consumed item strands its effects (they live on the item document);
> dead/unconscious targets still roll (RAW auto-fail on Str/Dex is Phase 5's condition
> math); a bare sheet roll defers to a pending concentration ask (the recognizers cannot be
> told apart); and there are NO verdict announcement cards — the card's per-target rows and
> the receipts say everything once (standing item 4's rule).
>
> **Amended v1.11.0 (2026-08-17, the walk's findings):**
> - **`onSave: "full"` is rider damage, not the save's consequence.** The system's own
>   PHB data nests situational damage ON the save activity with onSave "full" (Web's burn
>   clause: 2d4 fire for starting a turn in burning webs — the save is about Restrained).
>   Damage the save does not modulate never rides the demand: the stamp carries no damage
>   dimension (`hasDamage: false`), nothing auto-rolls, and the reconcile pass refuses
>   chained damage outright — a burn-enricher click would otherwise re-apply by verdict
>   through the side door. The card text's enricher stays clickable through the native
>   tray, GM-judged, which is exactly what situational damage is. (Finding ③: Web
>   auto-rolled its burn at the stamp and applied it to a timer-failed target.)
> - **Every pending row drains its own bar** — "two timers tick side by side" (the user's
>   stated expectation on a two-target demand; a single bar under the last row read as
>   that row's alone). Each bar anchors to the same absolute deadline; §4.3's pairing and
>   drift-0 rules are untouched.
> - **The pressed Prone names its source**: the topple stamp carries `attackerUuid`, and
>   both press paths (the fold's auto-press and the GM button) land the chip with
>   `origin` = the attacker, through `forceStatus`'s direct build (finding ⑤ — the
>   mastery chips already carried the weapon as origin; the bare status press was the
>   gap). Canonical-id discipline unchanged.
> - **Topology reality, documented after a two-client repro** (probe-popup-topology.mjs):
>   the popup chain is correct cross-client — a demand stamped by the caster's client
>   opens its popup on the decider's client and closes at resolution. A popup on a window
>   nobody is watching lives exactly the timer's length and is never seen; one human
>   driving two windows sees only the acting window's popups. That is attention, not a
>   defect; the 15s default (below) is the mitigation, and at a real table each human
>   watches their own window.
>
> **Amended v1.12.0 (2026-08-17 evening, the v1.11.0 walk's findings):**
> - **A targetless TEMPLATE cast stamps a WAITING demand (finding ③).** The old stamp
>   bailed on zero targets, and adoption can only retarget a demand that exists — so
>   Web's natural flow (cast bare, place the area after) produced no saves at all. Now:
>   an activity whose `target.template.type` is set stamps with zero targets,
>   `awaitingTemplate: true`, its window but NO deadline (armAskTimer no-ops without
>   one — nothing buzzes an empty wait); the card says "waiting for the template's
>   area"; adoption accepts the empty demand as a customer, fills it from the placed
>   area, and stamps the deadline from THAT moment (the elect's clock), so the table
>   gets the full window from the first instant somebody can actually roll. A targetless
>   cast with no template shape anywhere still stays native. Accepted corners: a cast
>   whose template is never placed leaves an inert waiting demand on the card (no rows,
>   no clock — harmless, and honest about what happened); and a token entering a
>   STANDING area joins only when a card re-render runs the containment floor —
>   semi-live, not turn-based (Phase 4's expiry experiment owns turn-time truth).
> - **The GM's unsolicited popups are non-player-owned targets only (finding ④, user
>   call: "as a GM i dont care to see other player saves").** `canAnswerFor` falls back
>   to the GM when a player-owned actor's owner is offline; that fallback now feeds the
>   BUZZER, not the GM's popup stack — the demand popup and the topple ask both gate
>   their auto-show on `game.user.isGM && actor.hasPlayerOwner`. The card row says
>   "waiting on the timer (owner offline)" instead of naming a GM who will never be
>   asked (with a 0 window — no buzzer — the GM stays named: the Roll button is then the
>   real path). Recall is a deliberate click and never filtered; owners present are
>   untouched (canAnswerFor already refuses the GM there); NPCs and unowned characters
>   keep their popups. The concentration ask deliberately keeps its GM fallback popup
>   for now — a break is heavier than a save, and the user has not asked; recorded as an
>   open question, not an accident.

> **Amended v1.13.0 (2026-08-17, the v1.12.0 walk's finding ①): the toolbar draw is a
> first-class placement path.**
> - **Every template type has document geometry — CORE'S, not ours.** `templateShape`
>   computed a fallback shape for circles only; a cube spell's rect had no shape anywhere
>   it mattered — the harness never draws, and on a LIVE client `createMeasuredTemplate`
>   fires before the canvas computes `object.shape` (measured: the walk's origin-tied
>   cube stood over two tokens while four waiting demands stayed empty — the fast-path
>   found no usable template and nothing retried). The first cut hand-rolled EUCLIDEAN
>   shapes and the live re-test caught it sweeping wider than the drawn area (Salyth
>   demanded from outside the cube): this world runs core's `gridTemplates` setting ON,
>   where every template is a GRID-BUILT polygon. Now the fallback calls core's own
>   `getCircleShape/getRectShape/getConeShape/getRayShape` statics — the exact grid-aware
>   branch the renderer uses, doc-native units — so containment and the drawn highlight
>   are the same truth by construction (the user's ask, verbatim: match what the template
>   actually shows). The statics are deprecated since v14 (until 16; ShapeData replaces
>   them — migrate then) and read `canvas.grid`, so they serve the CURRENT scene only;
>   cross-scene templates fall to the Euclidean math (approximate under gridTemplates —
>   accepted: claims are current-scene-only and cross-scene demands are dialog-placed).
>   The drawn shape still wins when it exists.
> - **A WAITING demand may CLAIM an origin-less template (the toolbar draw).** The canvas
>   template controls stamp no `dnd5e.origin`, so origin matching alone made the card's
>   "waiting for the template's area" line point at a placement path that could not work.
>   The claim: the newest origin-less template of the demand's EXPECTED shape (the
>   system's own `areaTargetTypes` map from the stamp's new `templateType` field — never
>   hardcoded), on the elect's CURRENT scene only (the fossil bound; `_stats.createdTime`
>   reads null on this box, so the created-after gate cannot carry it alone), gets the
>   origin flag WRITTEN onto it — from that moment moves, re-placement, and the spent
>   sweep treat it exactly like a dialog placement. Stamp-once: a claimed template can
>   never be re-claimed. Pre-v1.13.0 cards carry no `templateType` and simply never
>   claim — origin-tied adoption serves them unchanged.
> - **One area fills exactly one demand (the newest-waiting-customer gate).** The walk
>   left four bare same-activity Web casts waiting; without a gate, one placement fills
>   all four (four popup sets for one cube — same-uuid demands all match the origin).
>   Among WAITING demands, only the newest same-activity cast is the customer; older
>   waiting casts stay waiting forever, which is already the never-placed cast's
>   deliberate shape.

> **Amended v1.14.0 (2026-08-17 night, the v1.13.0 walk's findings ①+②): spell-truth
> geometry, because the DOCUMENT lies on this build.**
> - **The v14 region-shim ground truth (probes 7–9, tools/probe-template-geometry*.mjs).**
>   Foundry 14 eliminated MeasuredTemplates as a document type and shims them onto
>   Regions; on this box (14.364 stable, Molten-hosted) the CREATE round-trip scales the
>   stored `distance` by **gridSize/100** and returns `width` as **raw pixels** — measured
>   ×1.4 on the 140 px Party Camp, ×0.7 on a 70 px scene, and exactly ×1.0 on the 100 px
>   Battle Flow Test Range, which is why every battery was structurally blind to it. The
>   client pipeline is exonerated (local clean/validate leaves values untouched; no hooks,
>   no wrappers — probe 8), and two different human clients plus the bridge produced the
>   identical corruption, so it is server-side and deterministic. The renderer draws from
>   the same lying field: shape, highlight, and doc-math all agree with each other and are
>   all oversized against the SPELL. Deserves filing upstream against Foundry (and dnd5e
>   for awareness); until then the module must not trust `distance`/`width` on any
>   dnd5e-placed template.
> - **Containment is SPELL-TRUTH FIRST (`honestDims`).** dnd5e's placement stamps
>   `flags.dnd5e.dimensions` (`size`, honest, in scene units) on every dialog-placed
>   template, and the shim never touches flags — so geometry is built from the dimensions
>   flag when present: a cube's rect side is `size` (diagonal `hypot(size,size)`), a
>   sphere's radius is `size`, a ray takes `dimensions.width`. This deliberately
>   SUPERSEDES standing item 17's "the drawn shape wins when it exists" while the shim
>   lies — the drawn object IS the corrupted doc — and is self-healing: once upstream
>   fixes the shim, doc values equal dimensions-derived values and every branch agrees
>   again. `adjustedSize` placements (emanations sized up by the hovered token) keep doc
>   math — their final size lives only in `distance`. Toolbar-drawn and foreign templates
>   carry no dimensions flag and keep the v1.13.0 ladder (drawn shape → core statics →
>   Euclidean). Correction to the v1.13.0 amendment above: `gridTemplates` is OFF on this
>   box (probe-read; the ON was a misread) — the "Euclidean over-sweep" the live re-test
>   saw was the shim's ×1.4 wearing a geometry costume, and the walk's Salyth demands
>   (Web, Entangle, Fireball ×3) were all this one defect.
> - **A token stands in the area if ANY of its occupied grid squares does** (midi-qol's
>   long-standing model): containment samples every occupied square's center instead of
>   the single token center, so a 2×2 body half inside the area saves like the table
>   expects. 1×1 tokens sample exactly the old center — no fixture drift.
> - **The spent sweep is a CONVERGENT FLOOR, not a completion one-shot (finding ②).**
>   Stale Fireball circles stood with every target applied: the one-shot demonstrably got
>   lost live, prime suspect an elect flip mid-chain (probe GM sessions connecting and
>   disconnecting through the walk re-elect the apply/sweep owner — ⚠ operational lesson:
>   do not run bridge probes during a live walk without expecting to steal the elect).
>   The render/update floors now re-offer the sweep for done demands — idempotent, cheap,
>   converges whoever the elect is by then. Its fossil wall: a NEWER same-activity save
>   card disarms an old card's sweep forever, because a recast reuses the activity uuid
>   and an old done card must never delete the current cast's area. (Accepted sliver: a
>   full-log re-render landing in the ms between a new cast's template and its stamp.)
> - **smoke-saves §12 builds its own 140 px scene** — the suite's 100 px range sits
>   exactly on the shim's blind spot, so the geometry pin lives on a scene where the lie
>   is visible. The section logs `shimFactor` each run; its assertions are factor-proof,
>   so the upstream fix will announce itself in the transcript without breaking the
>   battery. §13 pins the sweep's one-shot, the convergent floor, and the fossil wall.

> **Amended v1.15.0 (2026-08-19, the 2026-08-18 live session's findings — recorded under
> the freeze, fixed after it lifted): one roll answers one machine, twins converge, and a
> duration area dies with its concentration.**
> - **The per-user elect is ground truth (finding ⓪).** `game.users.activeGM` names a
>   USER; `isActiveGM()` is therefore true on EVERY client logged into that account at
>   once — the night's two zombie script sessions plus the bridge all counted, and the
>   probe-proven result was twin Topple asks off one swing reaching CONTRADICTORY
>   verdicts, plus doubled chips (Hunter's Mark ×2, Slow ×2, Entangle's Restrained ×2).
>   Foundry exposes no cross-client session identity, so the race cannot be prevented —
>   it is CONVERGED instead, the sweep-floor philosophy applied to creation: every topple
>   ask carries its provenance (`sourceMessageId`, the damage message that earned it) and
>   a twin arriving over an already-asked source deletes itself (deterministic: timestamp,
>   then id — the elder keeps the question); every module-applied effect carries a
>   fingerprint (`flags.battleflow.applied`, or the chip applier's own `mastery` flag) and
>   a twin chip (same actor, name, origin, both fingerprinted) deletes itself the same
>   way. Fingerprints only — another module's deliberate same-name stack is untouchable.
>   Operationally the rule stands regardless: ONE GM-capable client during play.
> - **One roll answers one machine — recognizer priority conc → saves → topple, the ship
>   order (finding ④).** Edda's single roll answered her concentration ask AND was claimed
>   by the topple fold's whole-log fallback (her Topple popup vanished "resolved"). The
>   rule, now uniform: a roll carrying another machine's stamp (`respondsTo`) is NEVER
>   read by a different machine, and a BARE roll defers upward — topple yields to a
>   pending save demand or concentration ask for the same actor+ability, saves yield to
>   concentration (already shipped v1.7.0). The deferred-to machine's popup and buzzer
>   still stand, so nothing resolves by theft and nothing goes unanswered.
> - **A verdict always announces (finding ⑤, overturning v1.6.0's "a success closes
>   quietly").** Eight of eight Topple asks resolved correctly in the data while the user
>   pressed Prone by hand all night — the five "lost" verdicts were successes that said
>   nothing, and a public ask with a draining bar that ends in silence reads as a dropped
>   machine. The topple save now posts its one-line verdict card ("stays standing", roll
>   vs DC) exactly as the concentration fold's "holds" card does. Design language, made
>   binding: every table moment the module OPENS in public, it CLOSES in public.
> - **The spent sweep extends to DURATION areas (finding ①).** Faerie Fire's region
>   outlived the spell (native end-of-concentration cascade owns that deletion and
>   demonstrably lost it — elect-suspect), and hand-deleting the region stripped the
>   marked targets' chips mid-fight (dependents cascade working as built, at the worst
>   moment). The sweep floor's duration rule: a templated demand, all targets done and
>   applied, whose usage card names a concentration effect (`system.concentration`) the
>   caster NO LONGER WEARS is spent — swept by the same convergent floor, triggered
>   immediately by `deleteActiveEffect` on the named effect, fossil wall unchanged. At
>   true spell-end the dependents cascade stripping the chips is CORRECT. Non-concentration
>   duration areas stay the GM's (leftover, recorded); an unresolvable caster leaves the
>   area standing rather than guessing.
>   smoke-hold §4a2 pins finding ⑥ (source found, effect verifiably UP, no hold, damage flows
>   — the hadSource/effectUp fields are part of the assertion so a fixture that never raised
>   the effect cannot pass by proving nothing).
> - **Not fixed, deliberately:** the Bane double-demand (two usage cards 2 s apart from
>   one player's client — watch for a repeat before building cross-message dedupe); Life
>   Drain's "asked twice" (nine demands in the data, all singletons — not reproduced);
>   Shield re-prompting while Shield was up (the card shows AC 15 → 20, so the +5 was NOT
>   active when the hold fired — the module was right); Innate Sorcery (WORLD CONTENT —
>   the DDB import stripped its effect; grafted back from the PHB compendium 2026-08-19,
>   the party's only remaining ghost reference).
> - **A reaction ALREADY STANDING is never offered again (the v1.15.0 walk's finding ⑥,
>   user call: "if they have shield up, just dont prompt for shield").** Gren was re-prompted
>   for Shield with his +5 active — a pause offering a choice that changes nothing, which is
>   the false stop the eligibility gate exists to prevent (§8's click economy). `findInterrupt`
>   now consults `hasReactionEffect` — the helper the ANSWER path already used to avoid
>   double-applying; only the eligibility side had never asked. Narrow twice over, and both
>   halves are load-bearing: **`ac` kind only**, because an AC bonus does not stack while a
>   `damage` reaction is a different question every time (Absorb Elements resists the
>   TRIGGERING type, so a standing one is no reason to refuse the next trigger); and **the
>   attack trigger only**, because a standing Shield already grants "no damage from Magic
>   Missile" — skipping the hold on the spell/negate path would apply damage to someone immune
>   to it. That path keeps asking until it can auto-negate, which is not built. Deliberately
>   independent of `reactionSpent` and of combat rounds (user: "we dont have timers and combat
>   rounds yet"): the walk reproduced this OUT of combat, where `reactionSpent` is never set.
> - **Suite truth:** smoke-effects §14d is RECUT (success announces), §16 pins the theft
>   guard, the bare-roll deference, twin-ask supersede, and twin-chip dedupe; smoke-saves
>   §14 pins the duration sweep (stands while concentration holds, sweeps on its end).
>   smoke-effects' non-concentration spell pick is pinned to CANTRIPS — the slotless
>   fixture PC made the old leveled pick's stability an accident (the 2026-08-19 battery
>   abort).

> **The machine already exists (2026-08-16, user architectural call).** Phase 2.5 shipped
> first and is deliberately the seed: the mode gate (prompt / auto), the ask-message +
> respondsTo-fold answer channel, first-active-owner election with the GM elect as fallback,
> the elect-owned buzzer whose expiry ROLLS, and the popup carrying the native roll dialog's
> own controls (situational bonus, Advantage/Normal/Disadvantage, default hinted from actor
> data). Saving throws generalize that pattern per target — they do not invent a new one.

- **The popup is the default, not the auto-roll** (user call, 2026-08-16, superseding the
  earlier "everyone auto-rolls" target state): a save-activity target owned by a player gets
  a **popup on that player's client** carrying the native roll dialog's own controls —
  situational bonus + Advantage/Normal/Disadvantage, exactly the concentration ask's surface
  — deliberately *unlike* midi-qol's silent roll-and-apply. The save is a table moment; the
  player presses it. A **per-player client setting opts out** to silent auto-roll
  (`configure: false`, data-driven), **default popup ON**. First-active-owner election picks
  the client; the active-GM elect covers NPCs, offline owners, and the buzzer — the 2.5
  machine per target, exactly.
- **Aggregation**: watch `createChatMessage` for `flags.dnd5e.roll.type === "save"` with a
  matching originating message; respect the legendary-resistance `forceSuccess` flag on later
  updates.
- **Application**: per-target and independent — each target's damage awaits only *that
  target's* result (no table-wide barrier; an AFK player idles only their own resolution),
  then effect/damage apply per verdict through the shared appliers.
  `flags.dnd5e.roll.damageOnSave === "half"` ⇒ ½ multiplier on a success (display-only in the
  native system; we make it real — the applier's threaded `multiplier` is already in place).
- **Mode ladder** (world): off → on (popup default + per-player opt-out as above). The old
  "auto everyone" world default is dropped by the same user call; auto is now the player's
  own opt-out, not the table's imposition.
- **Accepted trade-off**: the opt-out's `configure: false` skips ad-hoc
  advantage/disadvantage dialogs for players who chose speed. Effect-driven bonuses (Bless
  dice, Magic Resistance, aura saves) live in actor data and apply automatically either way;
  the rare situational call is the popup's own fields, or a GM re-roll for the opted-out.
  The conditions layer (Phase 5) closes most of the remainder.

> **AMENDMENT, v1.19.0 (2026-08-20) — two deliberate reversals, both the user's calls:**
>
> - **⑦ VERDICTS ANNOUNCE (FLOW item 7, reversing the "NO verdict announcement cards"
>   corner).** The demand card's rows fold verdicts silently, so on scrollback an open
>   demand was indistinguishable from a stalled one — the same silence finding ⑤ priced for
>   Topple, and the binding language already existed: *a table moment opened in public is
>   closed in public.* One public bfCard per verdict — tone `good` "holds" / `bad` "fails"
>   — posted from `applySaveConsequences` after the pause + re-read (so a legendary-
>   resistance flip mid-pause announces the FINAL verdict), wording promoted from
>   `verdictText` so the card can never disagree with the row, and never claiming damage
>   LANDED (autoApply may be off — verdictText already keeps that honesty). Idempotent: the
>   `announced` claim goes through `queueFlagWrite` BEFORE posting; a twin-elect race
>   converges by the topple's sourceMessageId supersede, keyed (card, target, forced).
>   Buzzer-voided "gone" targets get ONE merged card. **An LR flip AFTER the fail line
>   posted announces the corrected verdict too** (forced-marked so the supersede never eats
>   it) — two lines is honest history: the failure happened, then the resistance overturned
>   it.
> - **THE DEAD-TARGET GATE (user call 2026-08-20, reversing the recorded "dead targets
>   still roll" corner).** `stampSaveDemand` and the adoption floor skip DEAD targets; a
>   cast whose every target is dead stamps NOTHING — no demand, no auto-roll, no caster
>   damage offer: fully native. **The predicate is deliberately NARROWER than mastery's
>   plain hp≤0**: dead status, or an NPC at 0 HP — because a DYING PC (0 HP, death saves
>   ahead) must still be demanded, take the area's damage and eat the failure; mastery
>   keeps its own predicate (chips on downed PCs are still noise). Two predicates, two
>   stakes; the divergence is the point, not drift. Unconscious-with-HP still rolls; RAW
>   Str/Dex auto-failure stays Phase 5's.

### Phase 2.5 — concentration assist

Native 5.3.3 already computes the DC (10 or half damage, clamped to 30 under modern rules —
`getConcentrationDC`), whisper-prompts on HP loss, and rolls with success/failure marked. Two
real gaps: **(a)** the prompt is a whisper card that drowns in combat chat; **(b)** **a failed
save does not break concentration** (verified in source) — the forgotten click that silently
corrupts game state.

> **Rewritten 2026-08-16 (§10), pulled ahead of Phase 2 at the user's call** — concentration
> fires every fight and the table plays Tuesday; the full save suite follows. As first written
> this section had auto mode's "popup announce the result" and failure produce a "loud
> popup/banner". That predates the UI language the table settled in 1.9 (binding since):
> **popups ask questions, cards state facts.** A popup with nothing to decide is the Skip
> button again. Announcements are cards — loud by tone and wording, not chrome.

- **The moment has no decision in it — but the roll has a configuration.** A concentration
  save is mandatory; RAW offers no decline. What the popup offers is *dice agency* — the save
  that might drop the party's Bless belongs in its owner's hand — so its controls are the
  native roll dialog's own, not a bare confirm (user call, 2026-08-16: "since it's so
  important to players"): a **situational bonus** field (Bardic Inspiration, whatever the
  table rules) and the **Advantage / Normal / Disadvantage** buttons, in the system dialog's
  design language, with the default button hinted from actor data exactly as the native
  dialog hints it (War Caster pre-selects Advantage). Every button is still the same answer —
  roll — so the two-control rule (which governs *decisions*) is not in play. Dismissing the
  popup is not an answer; the card recalls it, and the buzzer rolls regardless — a **straight
  data-driven roll** (`configure: false`): sheet-borne modifiers like War Caster's advantage
  still apply themselves; only the ad-hoc inputs expire with the timer.
- **One machine, mode picks who presses** (world): `prompt` — popup on the concentrating
  owner's client, *"Morgash's Greatsword hit you for 12 while you're concentrating on Bless —
  DC 10 Constitution save"*, on its own timer (default **15s**; 0 waits); `auto` — no popup,
  the save rolls itself. In BOTH modes the roll runs on the **owning player's client** when one
  is active (their character, their dice — §4.1), the GM elect for NPCs and offline owners.
- **The chat log is the bus, as always**: the GM elect stamps an **ask message** (`bfCard` +
  flag) off `dnd5e.damageActor` under the native prompt's exact guard — so ALL damage
  qualifies, module-applied or not. The roll answers it (`rollConcentration` with the DC as
  `target`, `configure: false` — the system's own success test, so the save card and the
  verdict cannot disagree); the elect folds the result and acts. A save rolled from the sheet
  instead of the popup is detected identically — the roll is the answer, the button is
  convenience, exactly the hold's cast-is-the-answer rule.
- **Break on failure** (sub-setting, default ON — it is the point of the phase): the native
  end-concentration path; the dependent-effect cascade (Bless stripping from every blessed
  target across the table) is native and free.
- **Zero HP is not a save.** Damage that drops the concentrator to 0 ends concentration
  outright (unconscious ⇒ incapacitated ⇒ no concentration — a determined outcome, §2.1), and
  the system does NOT do this natively (verified: nothing links HP or statuses to
  `endConcentration`). No ask, straight to the break announcement.
- **Announce by stakes**: quiet good-tone card "Bless holds" on success; loud bad-tone card
  "**Concentration broken — Bless ends**" on failure. **The break card is always public** —
  the cascade strips icons across the whole table, and an icon vanishing must never be a
  mystery (§2.5). Success respects visibility, below.
- **Visibility** (world, user request 2026-08-15): who sees the check — `public` (default:
  the ask and the roll play out in the open; table tension when a party-wide buff is at
  stake) or `private` (whispered to the concentrator's owners + GM).
- The native whisper-prompt card is suppressed while the mode is on — a stale roll button
  under an automated flow is the attack-card spam again — and only while an active GM exists
  to stamp asks, so a GM-less table degrades to native behavior, not to silence.
- NPC casters get the identical treatment GM-side (the prompt doubles as "your Hag is
  concentrating", the monster-side hold's reminder value). Multiple damage instances =
  multiple saves (RAW-correct), asks queued oldest-first — one popup at a time per actor.
- **Known corner, accepted**: legendary resistance flips a save to success as an UPDATE after
  the failure landed, and the break has already cascaded by then. Phase 2 owns
  `forceSuccess` aggregation; until then LR on a concentration save means the GM re-applies
  the concentration effect by hand (or runs break-on-failure off). NPC concentration + LR +
  failed save is rare enough to wait.

### Phase 3 — effect application

> **Phases 2 and 3 ship together (user call, 2026-08-16, post-split session).** A save's
> consequences ARE the feature — "then apply effect/damage" is the user's own spec — so the
> save slice below (failed-save effects, half-on-save damage) is part of the Phase 2 build,
> riding the shared appliers that already exist. What ships *second within that effort*,
> once the save path is battery-green and not in the same diff: the convergence — unify the
> three effect appliers around `applyEffectsWithReceipt`, and give the reaction effect its
> missing receipt/revert (the one §2.5 gap standing). Same release train, two controlled
> steps.
>
> **The save slice shipped at v1.7.0** (failed-save effects with the per-effect `onSave`
> flag honored, half-on-save through the applier's threaded multiplier, per-target and
> order-independent, legendary resistance overturning receipts-and-all). **The convergence
> shipped at v1.8.0**, closing the phase: `applyEffectsTo` is the one application loop for
> every document-copy effect (riders, cast, saves, the reaction sliver — two narrow policy
> options, `matchNames` and `extraFlags`, exist for the sliver and stay that narrow);
> `joinEffectReceipt` is the one receipt bookkeeping, shared by everything including the
> mastery chips; and the reaction effect has its receipt/revert (the §2.5 gap) — on the
> answering player's own response message, or on the held message when the answering client
> owns it. `applyMasteryEffect` deliberately remains its own applier: authored data, a
> flag-keyed dedupe, combat-aware durations — forcing those through the shared loop would
> be a lambda per policy (the decision is recorded at the site).

> **The cast-time slice shipped early (2026-08-16, user call, v1.5.0)** — *"for spells that
> have effects/rolls that are not saving required (Bless, healing), the effect auto-applies;
> the initial card is suppressed; option to revert."* A used activity with **no outcome
> gate** — no attack roll, no save — resolves at cast, on the elect: a `utility` activity's
> effects land on every target in the card's snapshot (Bless — all of them, concentration
> linkage per the rules below), and a `heal` activity's self-rolled healing applies through
> the shared receipt applier (Healing Word — the roll message carries the receipt and the
> revert; `calculateDamage` inverts `healing`-typed entries natively). The native usage card
> is suppressed under the 1.9D spell switch and **replaced** by a module card carrying the
> payload (targets, activity, concentration id) — which is what finally lets a concentration
> cast's card go: the replacement captures the linkage that bare suppression could not
> rebuild. With suppression off, the native card itself is stamped with the same payload and
> stays the bus. Attack activities remain 1.9A's (on hit); save activities remain Phase 2's
> (their cards are load-bearing); **plain `damage` activities stay manual** — Magic Missile
> is the negate hold's seam, and auto-applying there would beat every pending hold's verdict.
> **Amended v1.5.1 (2026-08-16, same night):** the gate additionally requires the used
> activity to AIM at creatures (`target.affects.type` present and not `self`) — a
> range-self spell's target snapshot is incidental UI targeting, and Shield is itself a
> utility-with-effects cast: without the gate the cast slice stacked a second +5 on top of
> the reaction machinery's own application. Self-buffs stay the caster's own tray click.
> Suppression also now eats bare damage-activity cards (Magic Missile's shape) — except a
> BLOCKLISTED spell's card, which is load-bearing three ways while the reaction hold is on
> (the hold's home, the Answer surface, and the preApplyDamage veto's chain) and stays.
> **Amended v1.6.0 (2026-08-16, the second table round):** the blocklist exception is
> LIFTED — the hold rides a replacement card when suppression eats the original, the
> damage roll is bridged to it, and the veto gained a fallback lookup. And damage-activity
> DAMAGE now auto-applies per snapshot target under Auto-Apply Damage ("it should auto
> apply; the shield stuff is its own mechanic"), claimed at birth (`spellDamage`) and
> deferring on a pending spell hold — per-target independence, the Phase 2 principle
> arriving early. A damage card carrying EFFECTS still keeps its card (no automated path
> applies those). The topple ask also gained its popup: the same native-controls surface
> the concentration ask carries, on the decider's client ("the cards are difficult to
> follow").
> **Amended v1.10.0:** with suppression removed (Phase 1.1 note), the replacement-card
> and damage-bridge plumbing above is deleted — the native card is always the bus; the
> veto's whole-log fallback stays for genuinely unbridged rolls.
> **Amended v1.11.0 (2026-08-17, user call — finding ①: Morgash Second-Winded the target
> dummy): SELF-tagged activities SELF-AIM.** "Anything that is tagged SELF should self
> aim": a `heal` or `utility` activity whose `target.affects.type` is `self` ignores the
> UI snapshot, aims at its own actor, and needs no target at all — Second Wind heals
> Morgash with the dummy targeted or with nobody targeted; Divine Favor's effect lands on
> its caster at cast. This SUPERSEDES v1.5.1's "self-buffs stay the caster's own tray
> click" stance. What survives of v1.5.1 is its original catch, kept as a carve-out: a
> LISTED reaction (interrupt list) with "Apply the Reaction's Own Effect" on is the hold
> machinery's to apply — the cast slice keeps its hands off Shield entirely, listed
> reactions never self-aim (smoke-hold's castApply-ON coexistence net still polices the
> +10-two-chips regression; smoke-cast §6d pins the carve-out itself). Blank `affects`
> still disqualifies (hand-authored shapes carry no aim data and the slice must not
> guess), and the save machine's own self-gate is untouched.

Auto-apply a used activity's effects, filtered by outcome — the native effect tray's semantics
(`EffectApplicationElement._applyEffectToActor`), pressed automatically:

- Effects from `message.system.effects` resolved on the item; applied on hit (attack
  activities) / failed save (save activities; honor the `onSave` "applies even on save" flag);
  active-GM elect applies to unowned targets.
- When the caster is concentrating, the created effect's `origin` is the **concentration
  effect** and it gains `flags.dnd5e.dependentOn` — cleanup on concentration break is native.
  Re-application re-enables an existing same-origin effect and resets its duration (native
  `getInitialDuration` behavior — rounds in combat, seconds out).
- Condition riders on statuses are native and come along free.

### Phase 4 — effect expiry (verify first; possibly zero code)

Bless (10 rounds, concentration) is the canonical case and usually dies by **concentration
first** — fully handled by Phase 2.5 + 3. The timeout channel: the PHB effect carries its
1-minute duration; native application sets it; dnd5e advances world time 6s per combat round.
**The build step is an experiment, not code**: cast Bless in the live world, run ten rounds,
watch. Evidence says Foundry v14 core absorbed effect expiry (it is the stated reason Times Up
has no v14 version, and DAE now delegates its turn-durations to core `duration.expiry`), while
the dnd5e system repo contains no expiry code — so core likely deletes at zero and this phase
is a settings audit. Fallback if core only counts down: ~20 lines — the active-GM elect, on
the turn/round hooks already held for reaction-spent tracking, deletes effects at
`duration.remaining === 0`. Either way: the quiet log line ("Bless expires on Gren") — an icon
vanishing must never be a mystery. "End of the target's next turn" precision (a module flag
written at application time) only if the table ever actually needs it.

### Phase 5 — the conditions layer (adopt, probably)

Making conditions mechanically real (prone ⇒ advantage in melee, restrained ⇒ disadvantage…)
is the one genuinely sprawling problem — every condition × every roll type. Candidate:
**adopt Automated Conditions 5e (AC5e)** rather than build — MIT (vendor-fork-friendly), zero
dependencies, verified against exactly Foundry 14.365 + dnd5e 5.3.3, exceptionally maintained,
and *complementary* to Battle Flow (it decorates the rolls; it never applies damage/effects —
we apply; we never decorate). Decision deferred to dogfood: adopt when the table starts
noticing missing condition math.

---

## 6. Settings surface (planned)

World, per-feature, default OFF unless noted:

| Setting | Values | Phase |
| --- | --- | --- |
| Auto-roll damage on hit | off / NPC attacks only / everyone | 1 |
| Auto-apply damage | off / on | 1 |
| Dramatic beat before damage | off / seconds | 1 |
| Require a target to attack | off / on | 1.1 |
| ~~Suppress attack usage cards~~ | **removed v1.10.0** (with the whole suppression machinery — cards always post) | 1.1 |
| Hide redundant card buttons | on (default, world) — every card action button hidden except **Refund Resource, exactly** (the v1.9.5 spec, restored v1.12.0 after the v1.10.0/v1.11.0 Place Measured Template detour — finding ②, the user's third ask); **shipped v1.9.5** | 1.9 |
| Center roll dialogs (per client) | off / on — **ships ON**, the one recorded default-off exception (user call 2026-08-15: a per-client comfort nobody knows to look for starts wrong on every new login) | 1.1 |
| Roll your own damage (per client) | off / on — **ships OFF**, and the SECOND per-client setting (v1.18.0). Offers the attacker a Roll Damage button with the family's 15s buzzer instead of rolling for them, and says when the hit was a CRITICAL. See the amendment in §6 — this is a deliberate, recorded reversal of the v1.9.5 collapse | 1a |
| Reaction hold | off / on + curated interrupt list (entries: name, AC-type/damage-type) | 1.5 |
| Spells a reaction blocks | curated list (`Spell:Reaction`, default `Magic Missile:Shield`) | 1.5 |
| Halving reactions | pause / post-hoc via revert+½ — **not built**; damage-kind holds announce and leave the reduction manual | 1.5 |
| Hold timer | 15s default (v1.11.0 — every timer 15s; 0 waits) | 1.5 |
| Popup shows the math | off / on (verdict included) | 1.5 |
| Maneuver folds | curated `Name:kind` list (`precision` / `riposte`), default `Precision Attack:precision, Riposte:riposte` — **the list IS the switch** (empty disables); STRICT parse, unknown kinds dropped with a warning, never defaulted; the folds ride the hold family's clock/reveal/futile settings, no timer or boolean of their own — **shipped v1.19.0** | 1.6 |
| Volley spells | off / on — **ships ON (built v1.20.0)**; membership is the volley REGISTRY (name-keyed per-spell handling, (ff) 2026-08-21 — volley-registry.js), rides the resolver mode + `damageTimer`; the caster aims every dart/ray (and picks per-ray adv/dis) in one popup, expiry fires the even spread | 1.7 |
| Resource use notices | off / on — **ships ON (built v1.20.0)**; recovery-rhythm pools only, player-owned actors only, flash on every client + a durable card line; reads the usage message's own `system.deltas`, zero new state | 1.7 |
| Hit riders | off / on | 1.75 |
| Rider table | curated identifier list — **how much** is read from the content, never listed | 1.75 |
| Rider upgrades | curated `feature:mark` pairs, damage likewise read from the feature | 1.75 |
| Effect riders | off / on | 1.9 |
| Mastery riders | off / on | 1.9 |
| Mastery: ask first | ask / auto (Vex and Sap never ask — the rules make them automatic) | 1.9 |
| ~~Per-source suppression~~ | **removed v1.10.0** with the master | 1.9 |
| Saves | off / on — **shipped v1.7.0**: popup default, per-player client opt-out to auto-roll, save timer (15s default; expiry ROLLS); the old "prompt/auto everyone" ladder is superseded by the 2026-08-16 user call | 2 |
| Concentration | off / prompt / auto | 2.5 |
| Concentration timer | seconds, default 15; 0 waits; expiry ROLLS (prompt mode's buzzer) | 2.5 |
| Concentration breaks on failure | on (default) / off — off = announce only | 2.5 |
| Concentration visibility | public (default) / private (concentrator + GM); the break card is always public | 2.5 |
| Auto-apply on cast (the no-gate slice: no-save effects + healing) | off / on — **shipped v1.5.0** | 3 |
| Effect auto-application (attack slice = Effect Riders 1.9; save slice waits on Phase 2) | off / on | 3 |
| Expiry sweep | off / on (only if core proves insufficient) | 4 |

**Rider table seed** (Phase 1.75, from `tools/scan-riders.mjs` over official 2024 content —
every target-marked rider it ships). Identifiers only: **how much** is never written here. It is
read from the mark's own bonus-damage activity, so the number is always the one the content
ships, and a homebrewed mark works with nothing to transcribe.

```
Rider table       hunters-mark, hex, great-old-one-hex
Rider upgrades    foe-slayer:hunters-mark
```

Per-client: table-moment view (popup+card / card-only); the per-player save opt-out
**shipped v1.7.0** as `saveAutoRoll` — inverted from this line's first guess by the
2026-08-16 call: the POPUP is the default, and the opt-out is to silent auto-roll.
> **Superseded by the v1.9.5 settings collapse (user call: "max options later, one switch
> now"):** `holdView` and `saveAutoRoll` are DELETED, functionality and all. Exactly ONE
> client setting remains — Center Popups (default on). The popup is the one input surface;
> recall always fronts a live popup.

> **AMENDMENT, v1.18.0 — the collapse is PARTIALLY REVERSED, deliberately and once**
> (FLOW item 3; a player asked for their own dice back). `playerRollDamage` re-introduces a
> per-client setting of EXACTLY the shape v1.9.5 deleted: `saveAutoRoll` was "the POPUP is
> the default, the opt-out is silent auto-roll", and this is that mirrored — silent
> auto-roll is the default, the opt-in is the popup. Recording it here so it never reads as
> drift. **Two client settings now: Center Popups and Roll Your Own Damage.**
>
> **Why this one earns the reversal where `saveAutoRoll` did not.** A save is OWED — the
> table is waiting on it, so a per-player opt-out changed how long everyone else waits, and
> that is a world decision wearing a client setting. A damage roll is OWNED: it is the
> attacker's own dice on the attacker's own client, nobody else is blocked on it, and the
> buzzer means the table's timing is identical either way. The setting therefore changes
> **who presses the button and nothing else** — which is the test any future client setting
> has to pass.
>
> **It ships OFF, and that is the opposite call from Center Popups on purpose.** Both obey
> the same rule — *a per-client setting nobody knows to look for must not start wrong* — and
> the rule cuts different ways depending on which state is the surprise. Centered dialogs are
> what people expect, so ON is the safe default. Being ASKED to roll when you were not asked
> yesterday is the surprise, so OFF is. The patch notes carry the pointer; the setting is
> not discoverable on its own and is not meant to be.
>
> **The property that makes it safe, and the one to keep:** the button and the buzzer call
> the SAME roll function, so crit, ammunition, attack mode and `originatingMessage` are
> byte-identical whichever fires. Auto-apply, the riders and the receipts cannot tell who
> pressed it — which is why every failure path (render failed, popup dismissed, window
> closed, timer expired) degrades to today's behaviour rather than to a fork.
>
> **EXTENDED before release, 2026-08-20 — the setting spans all THREE damage paths.** The
> first cut answered attacks alone, and the v1.18.0 walk found the hole in one sitting: a save
> spell never rolls an attack, so Vicious Mockery, Fireball and every area still rolled their
> dice behind the caster's back. The offer now also hangs off the save demand's stamp
> (`dnd5e.postUseActivity`, saves.js), which carries the same locality that made the attack
> path cheap — it runs on the CASTING client, so still no elect, no `canAnswerFor`, nothing on
> the wire. **One switch, not two:** asking the table to opt into the same answer twice would
> be the settings collapse's exact failure re-created inside a single feature.
>
> ⚠ **THE GREY-OUT NOW HAS TWO OWNERS.** The setting sits under the Attack Resolver divider
> and was greyed out when Auto-Roll Damage was Off — which became a control that reads as
> inert and still fires, because the save path keys off Saving Throws instead. It enables
> while EITHER path can reach it. It stays under Attack Resolver on purpose: the walk
> confirmed people find it there, and moving a control the table has just learned costs more
> than the divider's slight inaccuracy. **Any setting that spans two divider groups has to
> answer this question.**
>
> ⚠⚠ **AND IT MADE AN OLD RACE ROUTINE — the reason `queueFlagWrite` exists** (core.js, where
> the measurement is recorded). Both receipt flags are merged rather than overwritten, and
> nothing serialized concurrent merges; the save slice runs two targets' consequence passes at
> once against one card, so each merged into its own pre-read copy and the later write dropped
> the other's entries. A lost receipt entry is two faults — the card under-reports, **and
> `reconcileSaveDamage` uses the receipt as its idempotence guard, so the damage applies a
> second time.** Measured at 20 damage from a flat-10 spell. It is OLDER than this feature (a
> popup-OFF control reproduces it), but while the stamp auto-rolled at cast time the triggering
> order was practically unreachable; the popup makes it ordinary.
>
> **The lesson worth carrying past this feature:** a change that only moves WHEN something
> happens can still be the change that makes a latent race reachable. The offer added no new
> writer and no new state — it added fifteen seconds of delay, and that was enough.

The "~12 world settings at full build" this section first estimated is long blown: **23
world + 2 client are registered at v1.3.1**, heading for ~30 by Phase 3. The settings-sheet
**section dividers + dependent-field grey-out idiom** (shipped from day one, not
retrofitted) is what keeps that readable — every new setting must join a divider group and
the grey-out sync.

---

## 7. Ground truth — the dnd5e 5.3.3 seams (verified in source)

All roll-pipeline hooks fire on the **rolling/applying client only**; document hooks
(`createChatMessage`, effect CRUD, combat turn events) fire per core rules (everywhere /
active-GM-gated). Verified against `foundryvtt/dnd5e` tag `release-5.3.3` (commit 965ad2d).

| Seam | Signature / fact | Used for |
| --- | --- | --- |
| `dnd5e.rollAttackV2` | `(rolls: D20Roll[], { subject: AttackActivity, ammoUpdate })` — after evaluation+message, before ammo consumption | Phase 1 trigger |
| Target snapshot | `flags.dnd5e.targets = [{uuid, name, img, ac}]` on usage/attack/damage messages; AC null under cover status | Hit testing |
| Hit test | `isCritical \|\| (!isFumble && total >= ac)` — computed at render, **never persisted**; recompute downstream | Phases 1, 1.5 |
| Crit flag | `D20Roll#isCritical` ⇒ `this.d20.isCriticalSuccess` ⇒ the **D20Die TERM's** `options.criticalSuccess`. ⚠ **The roll's OWN `options.criticalSuccess` is a DECOY** — present, numeric, plausible, and read by nothing; only `roll.d20.options` moves the answer (measured 2026-08-19, `probe-player-damage` assertion 9 pins it) | Phase 1a crit badge, harnesses that need to force a crit |
| `dnd5e.rollDamageV2` | `(rolls: DamageRoll[], { subject })`; options carry `type`, `properties`, `isCritical` | Phase 1 apply trigger (via createChatMessage on GM-elect) |
| Damage build | `aggregateDamageRolls(rolls, { respectProperties: true })` → `{value, type, properties}` | Phase 1 |
| `Actor5e#applyDamage` | `(damages, { isDelta: true, origin })` — full di/dr/dv/dm/threshold/temp math; local + ownership-gated | Phase 1 |
| `dnd5e.preApplyDamage` | `(actor, amount, updates, options)` — cancelable, `updates` mutable (last word) | Receipts |
| `dnd5e.damageActor` / `healActor` | fires on ALL clients with `{hp, temp, total}` deltas | Announcements |
| Message registry | `flags.dnd5e.originatingMessage`; `getAssociatedRolls("attack"\|"save")`, `getOriginatingMessage()` | Chain resolution |
| `dnd5e.postUseActivity` | `(activity, usageConfig, results)`; return `false` suppresses subsequent actions; `results.message` = usage card | Phase 2 trigger |
| `Actor5e#rollSavingThrow` | `({ ability, target: dc }, { configure: false }, { data })` — success/fail marked vs `options.target` | Phase 2 |
| Save result watch | `createChatMessage` where `flags.dnd5e.roll.type === "save"`; legendary resistance = `forceSuccess` flag on update | Phase 2 |
| Half on save | `flags.dnd5e.roll.damageOnSave` (`half`/`none`/`full`) — display-only natively | Phase 2 |
| Effect application | `EffectApplicationElement._applyEffectToActor` semantics; `message.system.effects`; save-effect `onSave` flag | Phase 3 |
| Concentration linkage | effect `origin` = concentration effect + `flags.dnd5e.dependentOn` ⇒ active-GM deletes dependents on break (the ONE native GM-proxy pattern) | Phases 2.5, 3 |
| Concentration prompt | auto-whisper on HP loss w/ computed DC (`challengeConcentration`); **failed save does NOT end concentration natively** | Phase 2.5 |
| `dnd5e.preRollDamageV2` | config mutable pre-roll — inject rider damage parts here (crit-doubling free) | Phase 1.75 |
| Turn events | `dnd5e.preCombatRecovery` etc. — fire on the **active-GM** client | Reaction-spent clear, expiry sweep |
| Native bonuses | `system.bonuses.<mwak/rwak/msak/rsak>.damage` folded into rolls | Tier-1 riders (free) |
| Native settings | `attackRollVisibility`, `challengeVisibility`, `autoCollapseChatTrays`, `autoRecharge`, `autoRollNPCHP`, `bloodied` | Phase 0 |
| Permission facts | players update only their OWN messages (⇒ response-message pattern); GM updates any; damage tray is GM-only; no socket/queries anywhere in the system at 5.3.3 | §4 |

---

## 8. Non-goals (permanent)

The 80% of midi-qol this module exists to refuse:

- **Reaction automation** — auto-casting, cross-client prompts, timeout protocols. The Phase
  1.5 hold is the full extent. Humans play reactions; the module waits for them.
- **Opportunity-attack detection** and movement-triggered anything.
- **Cover / line-of-sight / range math.**
- **Workflow undo** — the Phase 1 application revert is the full extent.
- **A flags/aura platform** — curated tables only (§2.6).
- **Templates/AoE target management** — targeting stays human.
- **A macro platform** — no OnUse macros, no effect macros.
- **An extension platform for homebrew** — the rules target is all of 5e 2024 (§1.1), but the
  answer to "my custom spell needs this" is a world-setting list entry, never a new extension
  point. What is permanently refused is a *platform*, not breadth of official content.
- **A no-GM degraded mode** (user call, 2026-08-17, closing the Ⓓ1 discussion: "we'll keep
  as is — GM required for full functionality"). Every world-visible write runs on the
  active-GM elect; with no GM client connected the automation stands down and the native
  tray remains the manual path. The honest split that closed it: player-owned targets COULD
  be served by owner-routed writes, but unowned actors are a hard permission wall (no GM to
  proxy through), so any degraded mode partially applies mixed target sets — and silent
  partial application is this module's worst failure class (the rider intersection rule's
  own reasoning). "Cast with no GM logged in and nothing applied" is by-design, not a bug —
  the finding-① precedent from the v1.11.0 walk.

---

## 9. Repo conventions

House patterns inherited from the module family (combatplus is a **reference, not a
template** — the user softened the original "template" wording on 2026-08-15: consult it for
idiom, then do what is correct for Battle Flow):

- **The split happened at v1.6.1** (2026-08-16, at 4,504 lines — the ~4,500 trigger the
  2026-08-16 review set). The shape is as prescribed: `battleflow.js` stays the only
  `esmodules` entry and imports fourteen siblings under `scripts/` (plain ES imports, no
  build step, no manifest change — proven live: the split deployed on an F5 alone), cut
  verbatim along the section banners, one file per phase plus `core.js` (shared constants),
  `shared.js` (hit test + chain walk), and `ui.js` (popup lifecycle, house card, countdown
  bar, the hold's views). Phase 2 added `saves.js` at v1.7.0 exactly as prescribed: seams
  imported, one entry line, no sibling machine edits. Two disciplines keep it sound, both
  enforced by comment at the site: **registration order is import-graph evaluation order**,
  and the orders that matter — the hold's `preApplyDamage` veto before concentration's
  cause capture, and the save verdict row above the receipt rows — are held by **lazy
  `import()` edges** (`hold.js` → `auto-apply.js`, `saves.js` → `receipts.js`); making
  either static (or adding any new import from the hold/ui pair into the
  auto-apply/mastery/concentration chain) reorders the hooks. When adding a same-hook
  registration in a new file, run `tools/check-hook-order.mjs` — it asserts all four
  load-bearing orderings without Foundry. Tooling: `tools/build-release.ps1` enumerates `scripts/*.js` at build time and the
  deploy script always walked the disk, so a new phase file ships with zero tooling change.
  The stylesheet trigger stands: inline styles are the hot-deploy trade until the
  card/popup styling grows again, at which point add the stylesheet and pay the one
  process bounce.
- `S` key-map + `setting()` getter. **Entry-point hooks check their feature toggle first;
  view and continuation hooks check for the presence of their flag instead** — an
  already-stamped moment (a pending hold, an unexecuted ask) must still render and resolve
  after a mid-session kill, or §2.9's kill switch strands live state. (Reworded 2026-08-16;
  the old "every hook's first line checks its toggle" was never literally true of the views,
  and correctly so.)
- `isActiveGM()` single-writer elect for world-visible writes; self-tracked prior-state maps
  (never trust `Combat#previous`).
- Settings-sheet dividers + dependent grey-out via `renderSettingsConfig` from day one.
- Ground-truth comments at the line where an API gotcha bit, with the version.
- Direct-to-main commits; version-per-feature tags (`v1.0.0` = Phase 1, etc.); GitHub releases
  carrying zip + manifest; install via manifest URL through the bridge
  (`/setup installPackage` — the package registry is process-boot-scoped; never
  `game.shutDown()`).
- `module.json` **must** pin the dnd5e system (5.3.x family) and Foundry v14 — unlike
  combatplus, this module rides system workflow hooks and churns with dnd5e minors. That churn
  isolation is *why* it's a sibling and not a combatplus feature.
- MIT license. Repo: `Txpple/fvtt-mod-battleflow`.

Interaction contract with **combatplus**: Battle Flow may clear the defeated flag/dead overlay
that combatplus set when a revert raises a target above 0 HP (the causing module cleans up).
No other cross-module coupling; neither depends on the other.

---

## 10. How we use this document

- **Before building**, locate the work on this page. If it isn't here, decide whether it's in
  scope — and if so, add it here first.
- **When tempted to generalize**, re-read §2.6 and §8: curation over platforms. Breadth of
  official 5e 2024 content is in scope; a new extension point never is.
- **When a dnd5e release absorbs a feature**, delete ours and celebrate (§2.7).
- **When this document and the code disagree**, that's a bug in one of them — surface it.
