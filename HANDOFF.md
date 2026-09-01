# HANDOFF.md — the commissioned work, and only that

> **Provenance.** Commissioned 2026-09-01 in the cold session that retired the party-stats
> handoff (`8a0e2cc`) and pruned the backlog (`ac12e5c`). Per the standing convention this file
> exists only while a commission does, and retires when this delivers. **Status 2026-09-01:
> PLANNED, nothing built.** Stage 0 and Stage 1 are well-defined; Stage 2 is gated on a vetting
> walk with the user; Stage 3 is recorded so it is not re-derived, and is not scheduled.
> ⚠ **Wait for the user's "go" — a handoff is not one.**

---

## CHIPS THAT EXPIRE, AND REMINDERS THAT DO NOT CALCULATE

**Mission, in the user's words (2026-09-01).** *"If a player attacks someone they vexed, it
should popup remind them that their attack is with advantage. I don't want stuff to auto
calculate."* And: *"you'd have expirations on effects based on ability/spells."* And the
Cleave amendment: *"You can make this extra attack only once per turn. So if a person gets
Cleave, it checks for the chit; if no chit, then Cleave popup; if chit already exists, no Cleave
popup. Then chit expires after turn end."*

Two backlog items — *short-duration effect expiry* and *AC5e adoption* — turned out to be three
questions wearing two names: **who bends the die** (a human, always — settled), **what the
module knows about** (tiers, below), and **who keeps the clock** (the platform — the finding
below). Expiry goes first because it is fully defined; the reminder waits on a walk.

---

### The finding that reshaped the plan — Foundry v14 owns the clock

Measured in the sandbox's own client bundle (Foundry **v14.365**, `resources/app/public/
scripts/foundry.mjs`) and dnd5e **5.3.3**, 2026-09-01. Line numbers are that bundle's.

- **Every ActiveEffect carries an origin snapshot and an expiry EVENT.** The schema (≈15754)
  is `start: {combat, combatant, initiative, round, turn, time}` and
  `duration: {value, units, expiry, expired}`. `expiry` is one of the combat events
  (`turnStart`, `turnEnd`, `roundStart`, `roundEnd`, `combatStart`, `combatEnd`), and it
  **defaults to `"turnStart"`** whenever a numeric `value` is given.
- **Core refreshes on every boundary.** `ActiveEffect.registry.refresh(event)` is called by the
  Combat document on `combatStart`, `combatEnd`, `roundStart`, `roundEnd`, `turnStart`,
  `turnEnd`, `combatRewind` (≈50973–51837) and on `updateWorldTime` (≈204192).
- **The event is judged against the ORIGINATING combatant.** `isExpiryEvent` (≈49470):
  `turnStart` matches when `combat.combatant === start.combatant`; `turnEnd` matches the
  combatant whose turn just ended. So *"until the start of your next turn"* (Sap, Slow) is
  literally `{value: 1, units: "rounds", expiry: "turnStart"}`, and Vex's *"before the end of
  your next turn"* is `expiry: "turnEnd"`.
- **What happens at expiry is a world policy, and it is "mark", not "delete".**
  `CONFIG.ActiveEffect.expiryAction` is `"update"` (≈217449) — the registry stamps
  `duration.expired: true`, which is what dnd5e files under *Unavailable Effects*. `"delete"`
  exists. dnd5e 5.3.3 does not override it. **The action runs only on the active GM's client**
  (`game.users.activeGM?.isSelf`, ≈49451).
- **Suppression keys off the flag, not the arithmetic.** An effect keeps applying until
  `expired` is written; `remaining <= 0` alone changes nothing (≈49480 `isSuppressed ??
  duration.expired`).
- **The module writes the v12 shape.** `{rounds: 1, startRound, startTurn, startTime}`
  (mastery.js `applyMasteryEffect`) is shimmed by core (`#shimDurationField("rounds")`,
  `_addDataFieldMigration("duration.startRound", "start.round")`, ≈15898–15980). It works;
  it never sets `expiry`, so today's chips expire on the default `turnStart` by accident.
- **Out of combat there is no clock.** The only non-combat tick is `updateWorldTime`, which
  fires when the GM presses the v14 calendar HUD or takes a rest with *Advance time* ticked
  (dnd5e.mjs ≈38304, 72936; off unless chosen). A 6-second chip sits at "6 seconds remaining"
  forever, stays live, and even the apply-time sweep reads it as alive. **This is the status
  quo and it will remain so — no out-of-combat chip has ever expired by clock.**

**The ruling this yields — PROPOSED, for the user to confirm at the go:** ⚠ **THE MODULE
NEVER OWNS TURN-TIME. Foundry keeps the clock; the module owns EVENTS — apply, consume,
tidy.** DESIGN §8's *"Short-duration effect expiry"* row closes by its own condition ("that
decision being made, either way"), and the fear it recorded — that building expiry would make
Battle Flow own the combat clock by accident — does not arise: nothing here sets a timer.

---

### The rulings

| | Ruling | Standing |
| --- | --- | --- |
| **R-A** | **Nobody but a human bends a d20.** The fence in mastery.js (*"nothing here ever modifies a d20; the chip is the reminder and the roll dialog is the enforcement surface"*) is restated as **"nothing modifies a d20 without a human pressing it"** — a rescue is a press. | TAKEN (user, standing; restated here) |
| **R-B** | **AC5e is vendor-and-modify, never a dependency** (user 2026-08-23, DESIGN R4). Sharpened by this commission: **we do not want its code at all; we may borrow its TABLE.** Its whole behaviour is silent roll decoration — the README says it "only modifies rolls" — which is exactly what the user said no to. What it knows (thirteen condition rows) is data; what it does that is hard (range bands, nearby foes, flanking, armour, encumbrance) is geometry this module does not want. | TAKEN, reading sharpened |
| **R-C** | **The platform owns the clock; the module owns events.** See the finding. | PROPOSED |
| **R-D** | **Sources come in tiers.** Tier 1: what the module itself applied — Vex, Sap, Prone-from-Topple, the once-per-turn chits. Tier 2: content effects that grant advantage (Guiding Bolt, Faerie Fire) as registry entries — membership in data. Tier 3: the general condition table as data. **Only tier 1 (and tier 2 if Stage 0 proves the shape) is in this commission.** | PROPOSED |
| **R-E** | **How the user is prompted.** | ⚠ **OPEN — the Stage 2 vetting walk** |

---

### STAGE 0 — probes (read-only, half a session)

Every one is a measurement the plan already leans on; none writes anything a suite would not.

1. **v14 expiry semantics, live.** In a real Combat, on the attacker's turn, apply a chip
   `{value: 1, units: "rounds", expiry: "turnStart"}`; step with `combat.nextTurn()`; assert
   `expired` flips exactly at the attacker's next turn start (and the `turnEnd` variant at the
   end of it). Assert `start.combatant` is stamped as the CURRENT turn's combatant — which
   means an opportunity attack made on somebody else's turn would stamp the wrong one unless
   the module sets it explicitly. Assert a `units: "rounds"` chip applied OUT of combat is
   reframed at `combatStart` and expires at the attacker's first turn. Assert a seconds-based
   chip never expires without `updateWorldTime`. Assert nothing expires with no GM connected.
2. **Hook surfaces.** `dnd5e.preRollAttackV2` is TEMPLATED (dnd5e.mjs 68411–68412:
   `` `dnd5e.preRoll${hookName.capitalize()}V2` `` with `hookNames: ["attack", "d20Test"]`) —
   the same class as `preRollDamageV2`, so it needs an ALLOW pin in
   [check-hook-dispatch.mjs](tools/check-hook-dispatch.mjs) **and** a live FIRED assertion
   (§11). The dialog hierarchy is `AttackRollConfigurationDialog → D20RollConfigurationDialog →
   RollConfigurationDialog → Dialog5e` (AppV2), so `renderAttackRollConfigurationDialog` is a
   core render hook — assert it dispatches on the suite page. `dnd5e.postRollConfiguration`
   fires after the dialog. A rolled mode reads off `roll.options.advantageMode`
   (`CONFIG.Dice.D20Roll.ADV_MODE`).
3. ✅ **Guiding Bolt as shipped — MEASURED 2026-09-01** (read-only probe against the sandbox,
   Foundry v14.365 / dnd5e 5.3.3). **All three packs put an effect named "Guiding Bolt" on the
   TARGET**, applied by the spell's attack activity, `transfer: false`, no `changes`:
   - `dnd5e.spells` (SRD 2014): `{value: 6, units: "seconds", expiry: "turnStart"}`, no status.
   - `dnd5e.spells24` (SRD 2024): the same clock, **status `marked`**.
   - `dnd-players-handbook.spells` (the premium PHB — the world's own content, N1):
     `{value: 1, units: "turns", expiry: "turnStart"}`, status `marked`. ⚠ Out of combat that
     clock reads `remaining: null` / label *"None"* — the same unresolvable-clock shape as the
     v1.27.1 Sap report, on the SYSTEM's effect. Somebody else's contract; read it, never fix it.
   So tier 2 is *"an effect exists — read it"*: detection is the effect name (and the `marked`
   status on 2024 content) on the target, with `origin` leading back to the spell. Note the
   content's own approximation: `expiry: "turnStart"` ends it at the START of the caster's next
   turn, where the rules text says the END — the caster's own follow-up attack on that turn
   would not see it. Not ours to correct. ⚠ **Whether the module SPENDS the system's effect on
   the next attack** (delete it — an outcome the rules determine, R1 — with a receipt and a
   revert) or only reminds and leaves it to expire is a **walk question** (Stage 2).
4. **Where mastery chips are tested today.** `smoke-effects` (§3b Sap; Vex/Slow beside it).
   Stage 1's assertions land there unless combat-stepping makes it unwieldy, in which case a
   `smoke-expiry` suite joins the battery front door.

### STAGE 1 — expiry (well-defined; build first)

1. **Chip writes in the v14 shape, with the RAW event.** Sap and Slow
   `{value: 1, units: "rounds", expiry: "turnStart"}`; Vex `expiry: "turnEnd"`. `start` is
   stamped EXPLICITLY from `activeCombatFor(attacker)` with the **attacker's** combatant —
   never `combat.combatant` — the v1.27.1 Sap lesson generalised. **One constructor in the
   decision layer** (`decide/`, pure: mastery key + combat snapshot → `{duration, start}`),
   unit-pinned, spread at the write — never per-site (the stats-plane discipline). Out of
   combat keep `units: "rounds"` (core reframes at combatStart — Stage 0 item 1 proves it);
   *refresh, never stack* stays.
2. **Consume on use — module events, in or out of combat.** Vex dies when the attacker's next
   attack roll against that target resolves; Sap when the sapped creature's next attack roll
   resolves. Detection is the attack message + `flags.dnd5e.targets` + the chip's origin
   weapon → attacker. The rules spend it whether or not the player claimed it. ⚠ **Order
   matters for Stage 2:** the reminder must read the chip BEFORE consumption, so consumption is
   RECORDED on the attack message (R5 — a receipt line, *"Vex — spent on this attack"*) and the
   delete follows the card, never precedes it.
3. **Tidy on expiry.** `updateActiveEffect` with `duration.expired` flipping true on an effect
   carrying `flags.<mod>.mastery` → delete it. The platform's write is GM-side, so the deleter
   is that same client — no election needed. Plus `deleteCombat`: sweep own chips, the exact
   shape of hold.js's `reactionSpent` clear. The apply-time sweep (2026-09-01) stays as the belt
   to these braces.
4. **THE ONCE-PER-TURN FAMILY (user, 2026-09-01) — Cleave first.** On a Cleave trigger, check
   the attacker for a `cleave` chit: none → the notice popup AND the chit
   (`expiry: "turnEnd"` of the attacker's own turn); present → no popup. **Retires the
   in-memory `cleaveNoticed` Map** — state living outside a document, which R2 forbids and a
   reload already loses. Others in the family are surveyed, not scheduled (Nick is native by
   ruling 1; Sneak Attack is the obvious next). Proposed rule for out of combat: **no chit is
   written — there is no turn to be once-per — and the popup shows every time, as today.**
5. **Receipts.** Application already stamps `effectReceipt`; consumption stamps the attack
   message (item 2). Expiry deletion is platform-driven and has no message — record nothing new;
   the stats plane's buff-uptime (v2, its own ruling) can read the receipt's application time
   against the chip's absence. Nothing else stat-shaped ships here.
6. **Tests (§11).** Unit: the constructor. Live: Stage 0's assertions promoted into a suite,
   including the no-GM section (nothing expires; the reminder card still stands) and the
   consume-on-use section out of combat. One GM client suffices.
7. **Docs.** DESIGN §8's expiry row closes by its own condition; DESIGN §5's chip rule gains
   *"the platform keeps the clock"*; NOTES gains the out-of-combat facts and the v14 shape;
   ARCHITECTURE §4's state table lists chips as `start` + `duration.expiry`; the mastery.js
   fence is restated per R-A. **Prone is untouched** (user, 2026-09-01: no duration, ever).

**Check-in:** after Stage 0's readings, before Stage 1 code; after Stage 1, battery green.

### STAGE 2 — the reminder (⚠ GATED on the vetting walk — nothing built before it)

**What must be vetted with the user: how the user is prompted.** Four sources, and each has a
different SUBJECT — that is why one shape will not fit all of them:

| Source | Where the chip sits | Who is reminded | The moment |
| --- | --- | --- | --- |
| **Vex** | on the TARGET | the ATTACKER who applied it | their next attack on that target |
| **Sap** | on the SAPPED creature | whoever ROLLS for it — usually the GM | its next attack roll, at disadvantage |
| **Guiding Bolt** (tier 2) | on the TARGET, content-authored — measured, Stage 0 item 3: effect "Guiding Bolt", status `marked` on 2024 content, `expiry: "turnStart"` of the caster | ANY attacker, not just the caster | the next attack against the target — spent by it (rules); the content only lets it expire; whether the module spends it is a walk question |
| **Prone** (from Topple) | a status, no expiry | both roles — attackers (advantage within 5 ft, disadvantage beyond; `decide/geometry.js` already measures) and the prone creature's own attacks (disadvantage) | every attack while it stands |

**Prompt shapes on the table** — pick per source, possibly more than one:

- **A. The roll-dialog banner.** Inject into `AttackRollConfigurationDialog` on render:
  *"Vexed by you — Advantage. Claim it here."* Highlight the button; never pre-select it. Cheap,
  public hooks, no withholding. **Misses fast-forwarded rolls.**
- **B. The targeting notice.** On `targetToken`, when a player targets a creature carrying a
  relevant chip: a NOTICE popup (OK, auto-close on the notice clock) before any roll. The house
  surface; independent of the dialog. **May be noisy** — targeting happens for many reasons.
- **C. The pre-roll popup that WITHHOLDS the attack.** `preRollAttackV2` returns false; the
  popup carries Advantage/Normal/Disadvantage (the concentration precedent — *"the POPUP is the
  configuration surface"*, user call 2026-08-16); the module re-issues via
  `activity.rollAttack({advantage: true}, {configure: false})` behind a re-entry latch.
  Strongest; most invasive — **a withhold-and-resume on a SYSTEM roll**, the primitive D9(d)
  says the third machine should build into the spine, and a re-issue has side effects (ammo,
  once-per-turn features) that need their own probe.
- **D. The post-roll rescue.** *"Vexed, and rolled flat — roll the second die?"* through the
  shipped rescue anatomy (`RESCUE_KINDS` / `RESCUE_SOURCES` / `registerRescue`): a `replace`
  fold whose value is the better of two d20s — which IS advantage. Catches everything, including
  skipped dialogs; the house rhythm (Bardic, Heroic, Precision all work this way). **It is
  rolled-then-fixed**, which the walk must be comfortable with.

**Recommendation to bring to the walk, not a ruling:** A + D for tier 1; B if the table wants
the reminder earlier than the dialog; C only if the walk rejects rolled-then-fixed outright.
Every reminder is a NOTICE or a RESCUE — never a decoration — so R-A holds whichever is picked.

**Shape once picked (§11 "Adding a moment"):** compose the spine; the roller's client owns it
(`canAnswerFor` the attacker for Vex and Guiding Bolt; the sapped creature's owner or the GM for
Sap); name the answer channels, the expiry default (a reminder's default is *dismissed*, a
rescue's is *pass*), the receipt. One new kind — `reminder`, or a rescue kind `advantage` —
bumps `EXPECTED_KINDS` (19 today) with the reason in the commit. Tier 2 is a LIST_SPEC —
`name:grant:window:spend`, e.g. `Guiding Bolt:advantageAgainst:turnEnd:onUse`,
`Faerie Fire:advantageAgainst:duration:never` — membership in data, the grant/spend vocabulary
the closed kind set. Every reminder spreads `statContext` like every moment; the MCP's flip
credit already reads folds.

⚠ **The disadvantage mirror owes a revert.** A second-die-lower rescue can turn an applied HIT
into a MISS — §11 fold rule 4: *"if it can turn a hit into a miss, it owes the table a
revert, and the first feature that can is the one that must build it."* Nothing ships that can
yet. So the Sap-side rescue either builds `revertPlan` first or ships as a NOTICE only (the GM
rolls the second die by hand). The walk decides; announce-and-hope is not an option.

### STAGE 3 — the condition table as data (recorded; NOT scheduled)

Thirteen rows — blinded, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned,
unconscious, frightened, grappled, incapacitated, dodging (exhaustion is system-managed under
2024 rules) — as `status → {attacker, defender, saves}` reminders, never applications. AC5e's
geometry features are not adopted. The R4 tripwire's *"reach for AC5e"* is satisfied by
borrowing the table, not the code (R-B). It becomes a commission only if the table asks.

---

### The traps, named up front

1. **Consumption before the reminder reads the chip** — Stage 1 item 2's order; a chip deleted
   at roll time reminds nobody.
2. **`start.combatant` on an off-turn attack** stamps the wrong combatant unless set explicitly.
3. **`expired` is GM-written.** No GM → nothing expires — the v1.27 degradation family; the
   reminder card says so, the same way the chip applier already does.
4. **Out of combat there is no clock.** Events only. Never invent a timer to fill the gap.
5. **Never flip `CONFIG.ActiveEffect.expiryAction` to `"delete"`.** It is world policy for
   EVERY effect in the world; the module tidies only its own.
6. **Somebody else's effect is somebody else's contract.** A Guiding Bolt effect is the
   system's — read it, never rewrite its duration. A durationless chip stays untouched (the
   apply-time sweep's rule).
7. **Templated hook names** — pin them and assert they FIRED (D10, D11). `preRollAttackV2` is
   invisible to both of the dispatch check's sources.
8. **The dialog banner is presentation on a system dialog.** A public render hook adds a block;
   it never rewrites the system's own controls (R3 — no patching).
9. **The disadvantage rescue's revert obligation** (Stage 2) — do not let it ship without.

### What this commission deliberately does NOT do

- **No automatic advantage or disadvantage. Ever.** (User.)
- **No AC5e code**, vendored or imported. Its table, maybe, in Stage 3.
- **No turn-time ownership** — no module timer, sweeper, or clock.
- **No buff-uptime stats machinery** (the stats plane's v2, its own ruling).
- **Prone stays durationless**; the once-per-turn chit writes nothing out of combat.
- **Tactical Master, Guidance choices and light-family spells stay off the list** (user, 2026-09-01).

### Check-in points

- After Stage 0 — the readings, before Stage 1 code.
- After Stage 1 — battery green; the settled row closed in DESIGN.
- **The vetting walk before any Stage 2 code** — the walk-session restate rule applies.
- Before Stage 3 is ever scheduled.
