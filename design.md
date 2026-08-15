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

This is a one-table house module. It is deliberately **not** midi-qol: midi solves automation
for ten thousand tables with a 50,000-line workflow engine, a flags platform, and three required
dependency modules. We solve it for one table with a few hundred lines, curated lists instead of
platforms, and zero dependencies. See §3 and RESEARCH.md for why that trade is safe.

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
   default to Pass (optionally on a timer); concentration prompts default to Roll. The GM
   override and the player controls *preempt* defaults; nothing ever blocks forever.

5. **Receipts and announcements.** Every automated application stamps what it did (prior values,
   deltas, created-effect ids) onto the causing message and offers a revert. Every invisible
   state change gets a log line ("Bless expires on Gren", "Gren's reaction window passed").
   An icon vanishing must never be a mystery; a wrong-target hit must never need surgery.

6. **Curation over platforms.** Wherever midi built a general engine (reaction detection, aura
   flags, conditional bonuses), Battle Flow ships a **short curated table** scoped to what this
   table's four PCs and official-content monsters actually have (the interrupt-reaction list,
   the damage-rider list). Platforms serve module authors; curation serves one table. Lists are
   world settings — extending them is data entry, not code.

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
default action — this is *not* a cross-client timeout); the deadline derives from the hold
flag's server-assigned message timestamp so every client's display agrees; the countdown visual
is a pure-CSS draining bar (`animation: width N s linear`, digits overlaid, green→amber→red
keyframes) — zero JS ticking; a reload resumes the bar mid-drain via negative
`animation-delay` computed from the same timestamp. At the buzzer the continuing client
re-checks the log for an answer that already landed before firing; an answer that still slips
past becomes a revert case. Never hijack core's scene-load progress bar or notification stack —
the bar is drawn privately in the popup/card.

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
  `preCreateChatMessage` on the initiating client. The chain is unaffected: the resolver's
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
  (Absorb Elements, Uncanny Dodge — always pause; alternatively handle halving reactions
  post-hoc via revert + ½ as a world-setting choice). Eligibility = item present + prepared +
  slot free.
- **The hold**: don't auto-continue for that target; stamp `pending` on the attack message.
- **Player-side controls** (held target's owning client): popup + card row —
  *"The wight hits you! — [Cast Shield] [Pass]"*.
  **Pass** → the player posts a small response message flagged `respondsTo: <attackMsgId>`
  (players can't update the attacker's message; they can create their own — and "Gren passes"
  is good table record). **Cast** → just triggers their own activity natively — **the cast IS
  the answer**: the resolver detects a usage/effect from a listed item landing on the held
  target and auto-continues; a sheet-cast is detected identically (the button is convenience,
  not protocol).
- **GM override** (Resolve / Skip) on the GM client — the AFK fallback, and why no answer is
  ever *required*.
- **Re-resolution**: re-run the hit test against the target's **LIVE** AC (⚠ the stored target
  descriptor's AC is stale after Shield) — now a miss ⇒ post "Shield: 19 vs AC 20 — the attack
  misses," chain ends, damage never rolled; still a hit ⇒ damage proceeds.
- **Click-volume guards**: reaction-spent suppression is CORE — any reaction taken by an actor
  suppresses further holds for them until their turn (cleared on the turn hooks). Steady-state
  GM clicks ≈ 0 (players answer their own; NPC-side holds are rare and double as "your monster
  has Shield" reminders — the module makes forgetting monster reactions structurally
  impossible).
- **Popup reveal toggle** (world, dedicated — independent of `attackRollVisibility`):
  OFF (default) = "You are hit — react?" (RAW knowledge; cast on faith). ON = show the math
  ("19 vs your AC 15") plus the computed verdict ("Shield would turn this into a miss" /
  "would not be enough").
- **Hold timer** (world): off (default — wait indefinitely, human-paced) or N seconds (≈5 for
  a snappy table): live countdown bar in popup + card row, then auto-continue as Pass + quiet
  log line ("Gren's reaction window passed"). Mechanics per §4.3. A late cast that beats the
  final recheck but loses the race = revert case.
- **Per-client view setting**: popup+card / card-only (GM likely card-only for NPC-side holds).
- **Permanent non-goal**: reaction *automation* — auto-casting, cross-client prompts,
  timeouts-as-protocol. The hold is the full extent, forever. Humans play reactions; the
  module just waits for them.

### Phase 2 — saves

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

Native 5.3.3 already computes the DC (10 or half damage), whisper-prompts on HP loss, and rolls
with success/failure marked. Two real gaps: **(a)** the prompt is a whisper card that drowns in
combat chat; **(b)** **a failed save does not break concentration** (verified in source) — the
forgotten click that silently corrupts game state.

- Reuse the §4.3 table-moment shell on the concentrating owner's client:
  *"You took 12 while concentrating on Bless — DC 10!"*
- **Mode** (world): prompt (popup with Roll button) / auto (save just rolls; popup announces
  the result). In prompt mode the timer's default action is **Roll**, not Pass — concentration
  saves are mandatory; every hold has a default outcome, and this one's default is the dice.
- **Break on failure** (~a dozen lines): on a failed concentration roll, call the native
  end-concentration path — the dependent-effect cascade (Bless stripping from every blessed
  target across the table) is native and free.
- **Announce by stakes**: quiet "Bless holds" on success; loud popup/banner
  "**CONCENTRATION BROKEN — Bless ends**" + log line on failure.
- NPC casters get the identical treatment GM-side. Multiple damage instances = multiple saves
  (RAW-correct), queued popups.

### Phase 3 — effect application

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

### Phase 3.5 — curated damage riders (the Hunter's Mark tier)

Three tiers of damage-adders:

1. **Flat, unconditional** (Divine Favor): already native — an active effect writing
   `system.bonuses.mwak/rwak.damage` is folded into damage rolls by the system. Phase 3 lands
   the effect; zero code.
2. **Target-conditional** (Hunter's Mark, Hex): dnd5e 5.3.3 cannot express "only vs the marked
   creature" (Conditional ActiveEffects is on the system roadmap — **delete this shim when it
   ships**). The mark effect Phase 3 placed on the target **IS the state**: at
   `dnd5e.preRollDamageV2` (attacker's client, config still mutable), check whether the hit
   target carries a mark whose origin traces to this attacker's spell; if so, append the typed
   damage part **into the roll config before rolling** — crit-doubling and resistance math come
   free. Formulas from a **curated rider table** ("Hunter's Mark → 1d6 force vs bearer"),
   scoped to this table's spells — not a babonus/midi-flags general engine. ~50–100 lines.
3. **Not touched**: Hex's ability-check disadvantage (conditions layer), moving the mark on a
   kill (a bonus-action decision — a human moment, not a button).

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
| Suppress attack usage cards | off / on | 1.1 |
| Center roll dialogs (per client) | off / on | 1.1 |
| Reaction hold | off / on + curated interrupt list (entries: name, AC-type/damage-type) | 1.5 |
| Halving reactions | pause / post-hoc via revert+½ | 1.5 |
| Hold timer | off (wait) / N seconds | 1.5 |
| Popup shows the math | off / on (verdict included) | 1.5 |
| Saves | prompt everyone / auto NPCs / auto everyone | 2 |
| Concentration | prompt / auto; break-on-failure on/off | 2.5 |
| Effect auto-application | off / on | 3 |
| Rider table | curated list (spell → formula/type vs bearer) | 3.5 |
| Expiry sweep | off / on (only if core proves insufficient) | 4 |

Per-client: table-moment view (popup+card / card-only); later: per-player save opt-out
("prompt me instead of auto-rolling").

~12 world settings at full build — at combatplus's readable ceiling, so the settings-sheet
**section dividers + dependent-field grey-out idiom ships from day one**, not retrofitted.

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
| `dnd5e.preRollDamageV2` | config mutable pre-roll — inject rider damage parts here (crit-doubling free) | Phase 3.5 |
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
- **Being a generic module for other tables** — public repo, MIT, but designed for exactly one
  table; generality is never a reason to add code.

---

## 9. Repo conventions

House patterns inherited from the module family (combatplus is the template):

- Single ES module (`scripts/battleflow.js`), no build step, no bundler. If the file outgrows
  readability, split by phase — but fight for the single file first.
- `S` key-map + `setting()` getter; every hook's first line checks its feature toggle.
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
- **When tempted to generalize**, re-read §2.6 and §8: curation over platforms, one table.
- **When a dnd5e release absorbs a feature**, delete ours and celebrate (§2.7).
- **When this document and the code disagree**, that's a bug in one of them — surface it.
