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
  misses," chain ends, damage never rolled; still a hit ⇒ damage proceeds. The verdict is
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
- **Hold timer** (world): off (default — wait indefinitely, human-paced) or N seconds (≈5 for
  a snappy table): live countdown bar in popup + card row, then auto-continue as Pass + quiet
  log line ("Gren's reaction window passed"). Mechanics per §4.3. A late cast that beats the
  final recheck but loses the race = revert case.
- **Per-client view setting**: popup+card / card-only (GM likely card-only for NPC-side holds).
- **Permanent non-goal**: reaction *automation* — auto-casting, cross-client prompts,
  timeouts-as-protocol. The hold is the full extent, forever. Humans play reactions; the
  module just waits for them.

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
- ⚠ **THE FENCE (user call, permanent for this phase): nothing here ever modifies a d20.**
  Advantage/disadvantage enforcement and consumed-on-use expiry (the AC5e-sized lift) are
  explicitly out of scope — the applied chip is the reminder and the roll dialog's adv/dis
  buttons are the enforcement surface. `dnd5e.preRollAttackV2` exists if a later phase wants
  enforcement; nothing here blocks it.

### Phase 2 — saves

> **The machine already exists (2026-08-16, user architectural call).** Phase 2.5 shipped
> first and is deliberately the seed: the mode gate (prompt / auto), the ask-message +
> respondsTo-fold answer channel, first-active-owner election with the GM elect as fallback,
> the elect-owned buzzer whose expiry ROLLS, and the popup carrying the native roll dialog's
> own controls (situational bonus, Advantage/Normal/Disadvantage, default hinted from actor
> data). Saving throws generalize that pattern per target — they do not invent a new one.

- **Everyone auto-rolls** (target state): each player's client auto-rolls for save-activity
  targets it owns (the usage card replicates everywhere — same volunteer pattern; first-active-
  owner election prevents double rolls); the active-GM elect batch-rolls NPC targets and covers
  offline owners. `actor.rollSavingThrow({ ability, target: dc }, { configure: false }, ...)`
  with `originatingMessage` stamped so results chain to the card.
- **Aggregation**: watch `createChatMessage` for `flags.dnd5e.roll.type === "save"` with a
  matching originating message; respect the legendary-resistance `forceSuccess` flag on later
  updates.
- **Application**: per-target and independent — each target's damage awaits only *that
  target's* result (no table-wide barrier; an AFK player idles only their own resolution).
  `flags.dnd5e.roll.damageOnSave === "half"` ⇒ ½ multiplier on a success (display-only in the
  native system; we make it real).
- **Mode ladder** (world): prompt everyone (native buttons only) → auto NPCs only → auto
  everyone. Later: per-player client opt-out ("prompt me instead") for players who want the
  click.
- **Accepted trade-off**: `configure: false` skips ad-hoc advantage/disadvantage dialogs.
  Effect-driven bonuses (Bless dice, Magic Resistance, aura saves) live in actor data and apply
  automatically; the rare situational call is a GM re-roll. The conditions layer (Phase 5)
  closes most of the remainder.

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
| Suppress attack usage cards | off / on (master over the 1.9D per-source switches) | 1.1 |
| Center roll dialogs (per client) | off / on — **ships ON**, the one recorded default-off exception (user call 2026-08-15: a per-client comfort nobody knows to look for starts wrong on every new login) | 1.1 |
| Reaction hold | off / on + curated interrupt list (entries: name, AC-type/damage-type) | 1.5 |
| Spells a reaction blocks | curated list (`Spell:Reaction`, default `Magic Missile:Shield`) | 1.5 |
| Halving reactions | pause / post-hoc via revert+½ — **not built**; damage-kind holds announce and leave the reduction manual | 1.5 |
| Hold timer | off (wait) / N seconds | 1.5 |
| Popup shows the math | off / on (verdict included) | 1.5 |
| Hit riders | off / on | 1.75 |
| Rider table | curated identifier list — **how much** is read from the content, never listed | 1.75 |
| Rider upgrades | curated `feature:mark` pairs, damage likewise read from the feature | 1.75 |
| Effect riders | off / on | 1.9 |
| Mastery riders | off / on | 1.9 |
| Mastery: ask first | ask / auto (Vex and Sap never ask — the rules make them automatic) | 1.9 |
| Per-source suppression | weapon / spell / feature / other, each on under the 1.1 master | 1.9 |
| Saves | prompt everyone / auto NPCs / auto everyone | 2 |
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

Per-client: table-moment view (popup+card / card-only); later: per-player save opt-out
("prompt me instead of auto-rolling").

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

---

## 9. Repo conventions

House patterns inherited from the module family (combatplus is a **reference, not a
template** — the user softened the original "template" wording on 2026-08-15: consult it for
idiom, then do what is correct for Battle Flow):

- Single ES module (`scripts/battleflow.js`), no build step, no bundler. If the file outgrows
  readability, split by phase — but fight for the single file first. **The trigger, so nobody
  relitigates it** (2026-08-16 review): split when a phase can no longer be found by scrolling
  the section banners — in practice somewhere past ~4,500 lines, likely when Phase 2.5 lands.
  The shape when it happens: `battleflow.js` stays the only `esmodules` entry and imports
  sibling files under `scripts/` (plain ES imports need no build step and no manifest change),
  split along the existing section banners. Budget for the mechanics: `tools/build-release.ps1`
  ships an explicit file list, and the deploy script enumerates files — both must learn the
  new names, so the split is a release of its own, not a drive-by. The same review set the
  stylesheet trigger: inline styles are the hot-deploy trade until the card/popup styling
  grows again, at which point add the stylesheet and pay the one process bounce.
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
