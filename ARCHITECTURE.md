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

**EDGE holds two populations, and the dependency rule turns on the difference.** Both touch
Foundry, so both are EDGE by rule 1. A **machine** owns a feature (a flag, its views, its
resolver); a **service** owns none — it is a chokepoint every machine routes a consequence
through (`auto-apply.js` applies damage with a receipt, `effect-riders.js` applies effects with
one, `auto-damage.js` offers and rolls the dice). A machine calling a service is downward; a
machine calling a machine is what §7's rule forbids. The tier list lives in §7.

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

### The driver table — machine × moment × driver × no-GM

**One question, `drivesMomentFor(subjectUuid)` in core.js** — the active GM, and with no GM the
subject's own player (§4 *The flow elect*). A machine supplies only its SUBJECT. **"GM-only"**
means `isActiveGM()`: the moment waits for a GM, and the row says why. `smoke-nogm` asserts the
flow-elect rows (§runs, §chip, §told, §conc, §spent, §cast) and §rejoin.

| Machine | Moment | Driver — the subject | With no GM |
| --- | --- | --- | --- |
| mastery | the payouts, the ask's execution, Graze on the miss | the attacker | the notice, the ask and the popup run; a chip on a monster is skipped and whispered (§runs, §chip, §told) |
| topple | the demand's twin supersede, its buzzer, the failure's press | the attacker | the fold judges and announces; Prone on a monster is whispered |
| chip-spend | the spend on the attack roll | the attacker | the record lands on the card; a monster's chip stays until a GM connects, and counts as spent (§spent). The two tidies (expiry, a deleted combat) are GM-only: deletes on every sheet |
| auto-apply | the attack's damage, effects and mastery payouts | the attacker | PC targets land, monster targets are whispered |
| hold | spell damage | the caster | writable targets land, the rest are whispered; the offer and the answer never needed a GM |
| cast | the cast slice — a utility cast's effects, a heal's number | **the caster** | the caster's own sheet and any PC the caster's player owns land; a monster is whispered, the card marked asked-and-answered, and a GM rejoining re-pays nothing (§cast) |
| concentration | the ask, the fold, the break | the concentrator | everything — a PC owns their own sheet (§conc) |
| saves | the fold, the verdict (on the card), the consequences, the areas | the demand's caster (`sourceUuid`) | verdicts are public and true; consequences land on PC savers and are whispered for monsters |
| hit-menu · superiority-uses · sneak · damage-shields · emanations' relay | their cards' follow-ups | the card's source | as the writes allow, whispered where they do not |
| riposte | the stamp on the ENEMY's attack, its clock, the relayed answer's fold | **GM-only** | the write lands on another user's message (the enemy's attack), which a player may not update; the reactor's own answer and driven attack still run on the reactor's client |
| hew | the crit and kill reminders | **GM-only** | the kill trigger reads the receipt only the elect writes; the crit posts from the same place so one swing reminds once |
| command | the ally's chip, the strike's record | **GM-only** | writes on another player's sheet and on the fighter's card |
| precision · bash-offer · d20-folds | the moot, the crash-resume of an accepted answer | **GM-only** | the answering client resolves at once; the elect only picks up wrecks past the 20 s horizon |
| stats | the data plane's stamps and roster | **GM-only** | the roster is the GM's by design |
| emanations | regions, auras, sweeps, adoption | **GM-only** | scene and region writes are the GM's; the relay's fold rides the flow elect |
| effect-riders (the twin-chip dedupe) · resources | bookkeeping over documents only a GM owns | **GM-only** | nothing to degrade to |

When the GM's click must make another client act, the GM **flips a flag on a message**. The
flip replicates; the other client reacts to seeing it. That is the only cross-client channel
that exists, and it is not a channel — it is a document.

**Single-writer discipline:** every world-visible write runs on one client — the elect, or with
no GM the subject's own player, and only where that player owns the document (§4 *The flow
elect*). A write nobody present may make is skipped and said, never applied partially
(DESIGN §4).

---

## 4. State model — flags on messages (R2)

**All persisted module state is a flag on a document.** There is no other store.

| Where | Shape | Why there |
| --- | --- | --- |
| **Attack / usage message** | the moment flag (`hold`, `mastery`, `saves`, `precision`, `volley`, …); `chipSpend` — the chips this attack roll used up; `reminder` — what the gate showed before this roll, the net, the press | The moment belongs to the thing that caused it; a spent chip is explained on the roll that spent it (R5); a roll that went out with Advantage says why |
| **Attack message** | `lungePick` (the offer's tick for Lunging Attack) · `hold.targets[].reduceBy` (Parry's roll, at the answer) | Read by the rider and the applier on the roll that follows |
| **Damage message** | `receipt`, `effectReceipt`; `damageShields.paid` — the wards that have paid out for this hit, claimed BEFORE the dice; `damageShields.judged` — a HELD roll's judgement, stamped at its release (an unheld roll is judged once at creation and carries no stamp) | The application belongs to the roll that caused it; one payout per ward per hit across reloads and clients; a reload never re-judges an old hit against a table that has moved on |
| **The ward's own roll message** | `damageShield` (the ward, the defender, the attacker, the dice, the type, why) plus the ordinary `receipt` at the attacker | The strike is its own roll, posted as the defender's — never mistakable for a spell the caster pressed |
| **Usage card** | `damageCast` (a bare damage activity's dice, driven; `save` when a listed row demands one after) · `damageSaveCard` (the save that followed the damage, on the save's own card) · `superiorityUse` (what a Bonus Action maneuver did) · `baitSwitch` (who wears the AC — the choice, its clock, its answer) · `command` (Commander's Strike — the ally, the die, `status` directed / struck, the chip's id; the ally is TOLD and attacks from their sheet) · `shieldMark` (Armor of Agathys marked at the cast) · `castApply.choice` (a listed cast's pick between alternative effects — `key`, `options`, `chosen`; the cast slice waits on it) · `tacticalArmed` (a scoped tactical fold used from the sheet — the die rolled, which check, `spent` once it folded in) · `areaChoice` (a spell that chooses its targets: `chosen`, `left`, `asked`, `cap`; the demand's reach filters to `chosen` on every re-read of the area, and `metamagicAsk` kind `choose` is its question while it stands) · `poolSpend` / `hitManeuver.poolSpend` / `hold.targets[].poolSpend` (a die the module spent by hand, in the one row shape resources.js reads) | The use is the moment; each is a view of its own flag |
| **The ally's damage message** | `commandRide` (Commander's Strike's die rode this roll — the card it came from, the formula, who struck) | The elect folds it back onto the fighter's card as `struck` |
| **Save demand card** | `saves.demand` — `{spell, statuses}`: what the save is against, read at the stamp off the activity's item and its failed-save effects; `saves.targets[].noneOnSuccess` — the effect row (Circle's Power) whose success takes none, stamped at the fold beside `evasion` | The save gate reads the demand when the roller's dialog opens (Aura of Purity's conditions, Circle of Power's spells); the applier reads the entry |
| **Response message** | `respondsTo` + the answer | A player can only write their *own* message — this is the answer channel that needs no permission. See **the relay** below |
| **Actor** | `cleaveArm`; the chips — the mastery marks (`Vexed`, `Sapped`, `Slowed`), the once-per-turn chits (`Cleave`, Sneak Attack, a clock rider, Steady Aim, `shield:<key>` for Death Armor, `emanation:<regionId>`), the use chips (`mastery = "use"`, `useKey` the row — Evasive Footwork, Lunging Attack) and **the Reaction** (`Reaction — used`) — as ActiveEffects carrying `start` + `duration.expiry`, each fingerprinted by `flags.<module>.mastery = <key>`; the shield MARK (`flags.<module>.shield = {key, itemUuid, spellLevel, scaling}` — Armor of Agathys, the pack ships no effect) | Per-creature, per-turn state. ⚠ A chip's clock is the PLATFORM's (v14 `duration.expiry`, judged against `start.combatant` — RULINGS.md *Chips and clocks*); the module writes the window once and never counts turns. The Cleave chit's `start` is the turn IN PROGRESS and its liveness is a stamp comparison (`chitStamp` vs `combatStamp`) — the platform's expiry is its tidy |
| **Applied effect** | provenance markers | Which module path created it, so revert knows |
| **Region** (on a scene; since dnd5e 6.0 the region IS the area — drawn nowhere: locked, visibility LAYER_UNLOCKED, the user's rulings of 2026-09-18/19) | `emanation` — `{kind: "feature"\|"spell", key, tokenId, itemUuid, initial: [tokenIds asked by the cast's own demand]}`; its one Battle Flow behaviour (`fvtt-mod-battleflow.emanation`, a document subtype declared in `module.json`) carries the row's key, the source token and item, the reach, the upcast level and the pack's effect with the source's numbers resolved; `remind` and `heal` are read off the row, not stored | The AREA is the platform's document: attached to its token, membership computed by Foundry, events raised by Foundry. The module's state on it is which row it is and what it hands out. A member's copy is an ActiveEffect carrying `emanation: {regionId, key}` — the fingerprint the floor keys on, one per creature per region |

### The four state laws

1. **Never key persisted data by uuid.** Foundry expands dotted keys on write, and every uuid
   contains dots — `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }` and every
   lookup misses silently and forever. **Per-target state is an array of entries carrying a
   `uuid` field** (NOTES §1).
2. **Every per-target flag write goes through the serializer** (`queueFlagWrite`).
   Read-modify-write on a shared flag is only correct when writes are sequential, and
   per-target independence makes them overlap by design. A lost merge entry is two faults at
   once: the card under-reports, *and* the receipt is the idempotence guard, so the consequence
   applies a second time.
3. **The flag is the state; the popup and the card row are views.** Any view must be
   reconstructable from the flag alone after a reload, on any client.
4. **Every write that changes the world stamps a receipt** carrying prior values, so revert is
   arithmetic and not guesswork (R5).

### The flow elect — presentation runs without a GM, consequence does not

**User ruling (2026-09-01): the popups all run without a GM; the effects that need GM
permission simply do not apply; and whoever is driving is told which consequence was skipped.**
A GM disconnect must never stop the module silently.

The code splits along one line, and it is the line to keep:

| | Without a GM | Why |
| --- | --- | --- |
| Cards, asks, popups, flag writes on the attacker's own message | **run** | a player may create messages and update their own |
| Chips, conditions, HP, anything on the monster | **skipped + whispered** | a player has no write permission there |

`flowElectFor(actor)` is the active GM, and with no GM the actor's own player — **actor-local
on purpose**, because the chain's writes land on the attack message, which only its author may
update; a room-wide "lowest active user" elect would hand the flow to someone with no permission
to record it. `canApplyTo(actor)` guards each world-write, and `whisperNoGM()` names what did not
land **and what still stands** (both in core.js).

⚠ **One elect, never two.** With a GM connected `flowElectFor` returns exactly what
`isActiveGM()` does; the fallback engages only when `game.users.activeGM` is empty — the same
question with the GM removed from the answer, not a second election beside the first.
`smoke-nogm` §rejoin holds it: a GM reconnecting mid-flight re-pays nothing.

**Scope: every machine that has a subject**, through the one helper `drivesMomentFor` — §3's
driver table is the list.

⚠ **Gate on the SUBJECT, never on the room.** Two players taking damage in the same tick each
drive only their own ask; a room-wide fallback would hand one player's moment to the other, who
cannot write it. Where a hook cannot know the subject before it looks — a save roll answering an
unknown demand — the gate moves INSIDE, after the lookup.

### The relay — the answer channel, one shape

A player cannot write someone else's message, so when the answerer is not the client that owns
the flag, the answer travels as **its own public message carrying an envelope**, and the owning
client folds it in. Three machines need that: the hold's answer (`respondsTo`), a save's choice
(`saveChoiceAnswer`), a riposte's (`riposteAnswer`). Each declares itself to **one registry in
the spine** — `registerRelay(envelopeKey, { flagKey, targetOf, owns, fold })` in
[ui.js](scripts/ui.js) — served by a single `createChatMessage` registration.

**`owns` is why this is a registry and not a merge.** The hold's fold is owned by the
**continuing client**; the other two by the **elect**. `owns` receives the target's live flag
so `isContinuingClient(flag)` can answer; the elect-owned relays ignore the argument.

⚠ **Unify the mechanism; leave the bytes alone.** An envelope's shape is a wire format on
messages players write and another client reads — an answer in flight across a deploy would stop
folding. The hold's is flat sibling flags because that message also carries an `effectReceipt`;
`targetOf` lets each relay name its own shape. `respondsTo` carries FIVE meanings, and the bytes
of none of them change:

| The message that carries it | Points at | Read by |
| --- | --- | --- |
| a hold's answer (with `uuid`/`answer`/`ac` beside it) | the attack message | the hold's relay (`registerRelay("respondsTo")`), which self-selects on the target's `hold` flag — why `flagKey` is part of a relay's declaration rather than inferred |
| a save roll the module rolled (with `saveFor`) | the demand card | **the demand registry** |
| a concentration roll the module rolled | the ask card | **the demand registry** |
| Precision Attack's die | the attack message | precision.js, on its own `precision` flag |
| a d20 fold's die | the roll message | d20-folds.js, on its own `d20fold` flag |

**One reader for the demands** — `demandAnsweredBy(rollMessage)` in [ui.js](scripts/ui.js), over
the pure `resolveDemand` in [decide/demand.js](scripts/decide/demand.js). Each demanding machine
declares itself (`registerDemand(flagKey, { priority, chained, answering, pendingEntry,
pendingFor })`); the order is **`priority`, ruled 2026-09-05: concentration, then saves, then
Topple**. A stamped roll answers the card it names on whichever declared flag accepts it (the
Topple fold accepts none); a chained roll (`system.origin`) answers the card it chains to or
nothing; a bare sheet roll answers the highest-priority machine with a pending entry for that
actor and ability, oldest card first. `pendingDemandsFor(actorUuid, { flagKey })` asks "is this
creature mid-answer" with no roll in hand. Outside `saves/`, the `saves` flag is read or written
only through its constructors (`saveDemandData`, `saveTargetEntry`) and its reader
(`verdictsOn`).

**Coverage.** A single-client suite never sends the envelope (the answerer can write the target).
[smoke-twoclient.mjs](tools/smoke-twoclient.mjs) §relay covers the hold's relay — a
player-owned target, a GM-rolled attack, the continuing client folding. `saveChoiceAnswer` and
`riposteAnswer` (elect-owned) are single-client-tested only.

### Idempotence and resume

Every consequence carries an `applied` marker and an `answeredAt` timestamp. A resolved-but-
unapplied entry past the horizon re-drives; an applied entry never re-drives. This is what makes
a mid-chain reload or a crashed client safe.

**The resume floor is one primitive** — `registerResumable(flagKey, { pending(flag, message,
cause), drives(flag, message), drive(message) })` in [ui.js](scripts/ui.js). The spine holds the
three registrations once (`createChatMessage`, `updateChatMessage`, `dnd5e.renderChatMessage`:
arrival, the write that releases a claim, the reload), latches on `${flagKey}|${messageId}`, and
awaits the drive. `cause` (`create` | `update` | `render`) exists because an arrival and a resume
are different questions. **The drive does no DOM work**, so card-row order is untouched. A
**`flagless`** resumable (the attack payouts, the damage shields) judges an arrival that carries
no module flag, keyed by name. The claims (`effectsApplied`, `resolving`, `judged`, the receipt)
stay the machines', through the serializer. ⚠ A new resume goes through the primitive; judging
world state on a re-render without a claim is a bug. (The saves, concentration and mastery
resume checks stay in their own render hooks, which also draw their rows.)

**Withhold and resume is the spine's too** — `registerWithhold` / `registerWithheld` /
`withholds` / `resumeWithheld` in [ui.js](scripts/ui.js). A machine about to write a verdict
asks the spine whether a registered offer withholds it (a d20 fold offered on a save); the
offer's resolver hands the verdict back through the spine, at that instant, on the client that
resolved it. Neither machine imports the other.

### The data plane — stat stamps

Every consequence this module assigns — damage, healing, an applied effect, a spend, a table
moment — carries two machine-readable fields so an external reader can fold the chat log into a
per-combat ledger **without parsing HTML and without re-deriving context after the fact**.
⚠ **The reader is live** — `fvtt-app-sessionscribe`'s `analyze-combat`
(`src/page/combat-stats.ts`) consumes this section as a wire format; a change to any stamped
shape is a breaking change to an external consumer. Coordinate, don't drift.

- **`combat`** — `combatStamp()`'s `"combatId:round:turn"`, **null out of combat by contract**
  (reports keep the null bucket — short rests, traps and RP damage are real).
- **`sourceUuid`** — the actor whose action caused the record; for an unlinked token the
  token's **synthetic** actor uuid (THAT goblin, not the archetype). Null when no actor can
  honestly be named.

**The baseline is `statContext(sourceUuid)`** (core.js) **spread into the write, never
hand-rolled**; the source resolves through `statSourceOf(message)` (shared.js) or the closer fact
the writer holds. Receipt families thread it **per entry** through `receiptEntry` and
`effectRecord` ([decide/receipt.js](scripts/decide/receipt.js)), because applications split in
time; moment flags spread it at creation. Both fields are ALWAYS written: **explicit null means
"resolved, and the answer was nothing"; an absent field marks a record from before the plane
existed** — do not tidy the nulls away.

**The stamped families — this table is the scribe's read contract:**

| Flag | Stamp granularity | `sourceUuid` means |
| --- | --- | --- |
| `receipt` entries | per entry | attacker / caster / healer (the receipt message's own actor) |
| `effectReceipt` effect records | per effect record | who applied it (rider = attacker, cast/save = caster, reaction = the reactor's own self-cast) |
| `spend` (usage messages) | per flag, at creation | the spender |
| `rollCtx` (every d20 TEST message: attack, save, check, skill, tool, death save, concentration) | per flag, at roll time on the rolling client | the roller |
| `d20fold`, `precision`, `mastery`, `topple`, `riposte`, `bashOffer` | per flag, at creation | the acting actor (duplicates the flag's own actor field at the same write — they cannot drift) |
| `saves`, `hold`, `volley` | per flag, at creation | the caster / attacker who forced the moment |
| `concentration` | per flag, at creation | the concentrator (whose check it is — the damage's dealer is `cause`, by name) |
| `holdSkipped` (attack messages) | per flag, at the skip | the attacker whose swing outran the reaction |
| `combatRoster` (a GM-whispered marker card per combat) | once at combatStart; closed (`endedRound`/`endedAt`) at deleteCombat | null — the roster is nobody's action |
| `chipSpend` (attack messages) — `spent: [{id, name, key, uuid, bearer, mode, honoured}]`, the chips this attack roll used up | per flag, at the spend (the elect, on the attack card) | the attacker (whose swing spent them). `honoured` is against the gate's NET when the gate ran AND listed that chip's kind (`netShownFor`), else the chip's own bend. ⚠ This record is also the gate's memory: a chip whose spend is on record is never offered again, whatever the sheet says (a no-GM table cannot delete the monster's chip) |
| `reminder` (the roll messages the gate met: attacks — in the dialog, or a volley's ray judged at the aim — and saves / concentration checks through the save gate) — `sources: [{kind, bend, label}]`, `net`, `mode`, `honoured`, `answeredAt` | per flag, at the press (a ray: as it fires), on the roller's client | the roller (the attacker, or the one saving). The report splits "rolled with Advantage because the table was reminded" from "rolled flat against the net" |
| `damageShield` (the ward's own roll card) — `key`, `attackerUuid`, `total`, `type`, `why` | per flag, at the strike (the elect) | the DEFENDER whose ward struck (the receipt on the same card names the attacker as the taker) |
| `damageCast` (a bare damage activity's usage card) · `superiorityUse` · `baitSwitch` · `command` · `shieldMark` | per flag, at the use (the caster's client) | the caster / the fighter whose use it is |
| `superiorityRide` (a damage message) — `rode: [{key, formula, type, why}]` | per flag, at the roll (the roller's client) | the attacker whose die rode |
| `emanationHeal` · `emanationRemind` | per flag, at the event (the elect) | the caster of the area |
| `clockRiders` (a damage message) — `attackId`, `riders: [{key, label, formula, type, why, usesLeft}]`: Dreadful Strike, Divine Strike, Primal Strike, Divine Fury, Assassinate riding the hit | per flag, at the damage roll | the attacker whose feature rode. The rider's damage is in the receipt; the use it spent is the `poolSpend` state record |
| `emanationCard` (the aura's card, posted again each time the emanation stands) — `key`, `verb`, `range`, `regionId`, and where the aura offers a damage type `types`, `damageType`, `chosen` | per flag, at the post | the emanation's owner. A reader names the aura once; the reposts are bookkeeping, not play |

**`castApply.choice` is unstamped by ruling** (owner, 2026-09-23). The caster's pick between
alternative effects (Fire Shield's warm or chill) is a decision, not a consequence. What it picks
is stamped where it lands, in `effectReceipt`; stamping the pick as well would count it twice.

**The second-pass fields:**

- **`receipt` entries carry `parts: [{type, amount}]`** — per-part POST-trait amounts from
  `calculateDamage`, recorded VERBATIM, so a part can be FRACTIONAL (9 under resistance is 4.5 —
  measured by the stats reader, 2026-08-27); flooring and clamping live in `taken` and `delta`.
  `parts` are authoritative for by-type arithmetic; the entry's `multiplier` annotates the same
  halving for the card's sentence, never double-applied. The message's rolls stay the
  pre-mitigation side. Healing-typed parts arrive negated, same sign as `taken`. **`traits[]` is
  read net of the caller's multiplier** (v2.0.7, 2026-09-24): a halved save is not a resistance;
  rows stamped before v2.0.7 carry the old labels.
- **`answeredAt` on every moment answer** (buzzer answers included): with the flag's
  `deadline`/`window`, decision latency under the clock is arithmetic.
- **`holdSkipped`** — `targets: [{uuid, name, reaction}]` — the holds the futile-skip gate
  DECLINED to offer, the only record of "Shield could not have mattered".
- **`combatRoster`** — the turn→actor map that outlives encounter deletion: a static combatant
  snapshot (actorUuid = the token-synthetic identity, tokenId, name, initiative, isPC) at
  combatStart, closed with `endedRound` at deletion. ⚠ STATIC BY RULING — nothing here may grow
  turn tracking, timers or expiry sweeps (DESIGN §8 *Short-duration effect expiry*). Late joiners
  are seen through their `rollCtx` stamps.
- **A `saves` flag may be BORN `status: "done"` with zero targets** (user ruling, 2026-08-28): an
  instantaneous area placed on NOBODY is spent at the stamp — no save, no clock, no damage, the
  area swept at once. Duration areas keep their clockless wait, and a bare cast (`contained` null,
  not empty) still waits for adoption.

**No post-hoc stamper.** A listener stamping whatever flags appear would re-derive context after
the consequence — the drift this plane exists to prevent — and could not stamp per entry. **Any
new consequence writer spreads `statContext` at its write site, and its flag joins the table
above.**

The `spend` stamp (resources.js) is the plane's one write of its own: the ELECT stamps qualifying
usage messages at creation — recovery-rhythm pools (`rows`) and spell slots (`slots`),
player-owned actors only, **ungated by any setting** (a toggle would punch silent holes in the
ledger). No render-resume on purpose: a late stamp would carry NOW's turn on last week's spend;
the reader falls back to the message's own `system.deltas`.

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

A copied idiom drifts; composing is how the laws below hold.

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
   anchor, and **z-order is rank, then causal order** — within a class the first moment stays
   in front, so the player clicks through in the order things happened.
   - **The rank (user ruling 2026-09-13).** Windows born of ONE hit front by CLASS first — the
     damage prompt, then the weapon's mastery (the ask, the notice, the Topple demand), then a
     listed carrier's offer on the hit (the bash, the hew, Commander's Strike, the Riposte), then
     everything else — and by event order within a class. `POPUP_RANK` in
     [decide/present.js](scripts/decide/present.js), keyed by the popup key's sub; a new moment
     is unranked (last) until it is ruled into a class. Staircase POSITIONS stay in event order.
   - **The hit's sequence (the same ruling: *"damage, nothing until damage. then mastery rider.
     then other stuff."*).** A hit's offer is stamped QUEUED at the hit (a quiet row, no clock,
     no popup) and PROMOTED to pending from the damage chokepoint (auto-apply.js
     `resolveDamagePayouts`, after the mastery rider) once the damage has landed and the
     mastery's DECISION, if it asked one (Slow, Topple, Push), is answered; the clock starts at
     the promotion. A mastery NOTICE (Vex, Sap, Cleave) does not hold it. Nobody left standing
     resolves the offer moot. Pure: [decide/sequence.js](scripts/decide/sequence.js)
     `hitOfferStep`. This orders ONE hit's own consequences; the cross-machine modal sequence
     stays parked (BACKLOG *The modal sequence*).
   - **The one exception: several moments about ONE ROLL present as ONE WINDOW** (the rescue
     view — *this roll is short by N; what do you burn?*). `registerRescue` merges the VIEW while
     the flags stay separate (R2), so it costs no wire format. Moments about different rolls, or
     different questions about one roll, still staircase: the test is whether one answer could
     serve them — a rescue window has one Pass, and it answers every source.
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
12. **A moment never takes the keyboard (2026-09-23).** A popup opened by someone else's roll
    hands the focus back to wherever it was (NOTES §1 *A dialog's DEFAULT button takes the
    keyboard*). One home, `openManagedPopup` (`returnTheKeyboard`, ui.js); a moment is answered
    with the pointer. The system's own roll dialogs keep Enter — the roller opened them.

### Timer mechanics

The **continuing client** owns the one authoritative clock; the deadline is **absolute and
lives on the flag**, so every client derives the same remaining time. Countdown visuals set an
animation's `currentTime` from that deadline, never a CSS animation delay (NOTES §1).

---

## 6. The registry model (R4)

### Why registries, and why they are finite

The argument for curated lists over a general engine rests on one measurable fact: **every axis
of 5e's combat mechanics, as the system models it, is a closed enumerated set.** Measured
against this world's premium packs (PHB / MM / DMG / Heroes of Faerûn — 2,768 items, 411
spells; SRD excluded) with the `tools/scan-*.mjs` censuses, by 2026-08-22:

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
grow without a system release.** The reaction number is the proof case: 93 items, of which only
a small fraction are *interrupts* (they change an attack already rolled) and need a pause at all.

### The kinds the code knows — the R4 tripwire

Declared once in [decide/registry.js](scripts/decide/registry.js) as `KIND_SETS`, printed by
`npm run registry` (inside `npm run verify`), and **pinned**: adding a kind fails the gate until
the pin moves deliberately. As printed on 2026-09-24:

| Set | Kinds | Against | The kinds |
| --- | --- | --- | --- |
| interrupt | 3 | module-owned | ac · damage · roll (Slice A, 2026-09-24: Disadvantage after the hit — Lucky, Warding Flare, Shadowy Dodge) |
| maneuverFold | 6 | module-owned | precision · riposte · interpose · bash · hew · command |
| d20Fold | 4 | module-owned | heroic · tactical · bardic · seeking |
| volley | 2 | module-owned | damage · attack |
| mastery | 7 | **of the system's 8** | vex · sap · cleave · slow · topple · push · graze |
| reminder | 7 | module-owned | vex · sap · prone · condition · range · effect · sneak |
| emanation | 2 | module-owned | feature · spell |
| **total** | **31** | pinned in `check-registry.mjs` | |

Quote the tool's table, never this one.

**Lift the mechanism first; the kinds are the residue.** A kind names only what genuinely
differs between features — for the d20 folds, **the spend** (a boolean write, an
`activity.use()`, an effect delete). The arithmetic they share lives in
`ATTACK_FOLDS`/`SAVE_FOLDS` and needs no kind.

**Only masteries are checkable against a system enum** (`CONFIG.DND5E.weaponMasteries`, live, by
[check-mastery-rules.mjs](tools/check-mastery-rules.mjs)); the other sets are the module's own
inventions. The static gate proves each set is **closed, declared in one place, and that every
registry entry names a kind from it**.

**The fold contribution shapes (`ac` / `add` / `replace` / `verdict`) are not an R4 kind set.**
R4 counts kinds of CONTENT; a contribution shape is mechanism vocabulary, and a fifth would change
what "a fold" means.

⚠ `nick` is **deliberately** native (pure action economy) and *declared* as such
(`MASTERY_NATIVE`), so a ninth mastery arriving in a dnd5e release warns once instead of falling
through a bare `default: return`. Never leave a closed switch's default silent.

### Registry rules

1. **A registry is name-keyed and membership-defining.** Listed means it participates; unlisted
   means it never does. Structural detection from content data is **not** membership — it is
   wrong in both directions (a premium spell ships no count field at all; a teleport spell ships
   a count that would volley-pop its mishap damage).
2. **Entries hold handling, not amounts.** A `kind` naming which machine owns it, plus whatever
   per-entry resolvers that kind genuinely needs. Never a number.
3. **Entries may carry a resolver function** when the rule is per-ability (a projectile count
   that bands by character level). A resolver reads content and returns a value; it never
   writes and never decides policy.
4. **Adding an ability is one entry and zero code.** If it is not, the KIND is missing — add
   the kind deliberately, and count it against the R4 tripwire.
5. **Registries are exposed read-only on the module API** so tooling and suites can inspect
   them. That is inspection, not an extension point (DESIGN §4).
6. **Unknown entries are dropped with a warning, never guessed.** A spec may declare a
   **fallback** the parser applies instead, and it still warns — exactly one exists: the
   interrupt list reads an unrecognised kind as `ac`, the conservative reading of a reaction
   worth pausing for. **A DECLARED fallback is legal; an undeclared one is a bug.**

### Registry vs. settings list

Both are the *membership* layer; they differ in who curates. A **code registry**
(`volley-registry.js` is the reference) is for entries that need per-ability *handling* — a kind,
a resolver; shipped, versioned, reviewed. A **world settings list** is for entries that are just
names and a kind (the interrupt list, the block list, the rider table, the maneuver folds); the
table can extend it without a release, and it parses through the one strict parser: split, trim,
validate the kind against a closed set, warn once per bad entry, never default.

---

## 7. Module layout and dependency rules

`scripts/battleflow.js` is the only `esmodules` entry; it imports its siblings in a deliberate
order. Plain ES modules, no build step.

**`scripts/decide/` — the pure layer, and what each module holds.** ⚠ **It has ZERO imports**,
across every module: not core.js, not a machine, not the spine — asserted by `npm run layers`.
That is what makes it testable in milliseconds and impossible to tangle. The day something in
there needs `game` or `canvas`, it is EDGE and belongs one layer up (§2 rule 1).

| Module | Holds |
| --- | --- |
| [decide/geometry.js](scripts/decide/geometry.js) | `regionShapeTypeFor` (the placement's map: rect → rectangle, ray → line, radius → emanation), `emanationShapeData` (the platform's own emanation shape around a token, byte-for-byte), `tokenCenter`, `tokenSamplePoints`; `lengthUnitKey` — a scene's units folded to the system's keys |
| [decide/registry.js](scripts/decide/registry.js) | the world-setting list SPECS and the one `parseList`; the closed kind sets and the R4 tripwire; `MASTERY_RULES`, `CONDITION_BENDS`, `SAVE_BENDS`, `RANGE_RULES` and `EFFECT_BENDS` — the rules text, the condition table (attacks) and the save table (saves), the range sentences and the effect table (seventy-odd abilities by name, from a compendium scan), as data; `SNEAK_ATTACK`, `CUNNING_OPTIONS`, `DEATH_STRIKE` — the Sneak Attack flow's data, each option naming the feature that grants it; `HIT_GROUPS`, `HIT_OPTIONS` — the hit menu's groups (the feature that pays) and rows (the Battle Master's on-hit maneuvers); `CLOCK_RIDERS` — the features whose extra damage rides the combat clock; `USE_CHIPS`, `SAVE_PRESSES`, `EVASION` — the text-only feature that becomes a chip on use, the save whose failure presses a status, the verdict outcome; `INTERRUPT_MULTIPLIERS` — the damage interrupts the module settles itself (Uncanny Dodge ×0.5); `CHOSEN_AREAS` — the area spells whose caster chooses who they affect (by name — the pack's own choose flag covers four of the seven); `tableIndex(table, keyOf)` — a name-keyed table's closed name set and its row-by-name (the `*_NAMES` sets derive through it, **the keys unchanged**) |
| [decide/chips.js](scripts/decide/chips.js) | `CHIP_WINDOWS`, `TURN_CHITS`, `chipClock`, `chipIsDead`, `chitStamp`, `chipSpentBy`, `chipHonoured`, `netShownFor`, `spendRecord` — a chip's clock, and what spends it; the once-per-turn chits (Cleave, Sneak Attack, a clock rider) share one shape |
| [decide/reminders.js](scripts/decide/reminders.js) | `netMode`, `resolutionLine`, `proneSources`, `conditionSources` (over the registry's table), `saveSources` / `saveGate` (over the save table: a bend, or a save that cannot succeed — the net `fails`), `rangeSources`, `effectSources` (over the effect table: scope, caveat, listed or counted, judged — the combat clock and the map's ally-beside-the-target included, spent), `effectCheckSources` (an effect that bends checks by its text), `autoCritSources`, `reminderView` (the header line and the boxes — no net block), `reminderRecord` — what bends a roll, what it nets to, and what the section draws |
| [decide/sneak.js](scripts/decide/sneak.js) | `parseDice`, `sneakWeaponQualifies`, `sneakConditionsHold` (the box's default tick: Advantage, or the map's ally and no Disadvantage), `cunningMenu` (the options read off the sheet, up to two with Improved Cunning Strike), `cunningPick`, `sneakFormula` — the Sneak Attack dice, and what Cunning Strike does to them before the roll |
| [decide/clock.js](scripts/decide/clock.js) | `riderDue` (is a clock rider due on this hit, and why not), `riderPartFormula` (a pack's damage part as a formula, a bonus-only part included) |
| [decide/emanations.js](scripts/decide/emanations.js) | `reachAdmits` (who an aura reaches, by disposition — helpful: allies and neutrals; harmful: enemies), `emanationRange` (the activity's size, else the row's content formula over the source's roll data — `@scale.paladin.aura`), `resolveChanges` / `resolveFormula` / `foldArithmetic` (the pack's effect with the SOURCE's numbers read in), `triggerDue` (once per turn in combat), `healTriggerDue` (Aura of Life's 0-HP ally), `liveScenes` / `appliesOnScene` (the active scene and every scene a connected player views, a GM's while no player is connected), `emanationGroup` / `groupMembers` (one aura across every scene it stands on, one copy per creature), `memberEffectData` (the effect a member receives, fingerprinted with its aura for the floor) |
| [decide/hit-menu.js](scripts/decide/hit-menu.js) | `hitMenu` (the groups and rows a hit offers, read off the sheet and the list), `hitPick` (one per group, affordable), `sweepVerdict` (would the original attack roll hit a second creature) |
| [decide/sequence.js](scripts/decide/sequence.js) | `hitOfferStep` (what a hit's queued offer does next — §5 law 7, the hit's sequence), `withinBashReach` |
| [decide/choices.js](scripts/decide/choices.js) | `effectChoiceFor` (which of a cast's effects are the alternatives a listed row names — fewer than two present asks nothing), `effectsAfterChoice` (what lands once the pick is made: the non-alternatives plus the pick; pending is null and the caller waits; a pick outside the options is pending too) |
| [decide/demand.js](scripts/decide/demand.js) | `resolveDemand` (which pending demand a roll answers — the stamped, the chained and the bare channel, the order as `priority`; §4 *The relay*), `pendingDemands` (mid-answer, with no roll in hand); `saveDemandData`, `saveTargetEntry`, `verdictsOn` — the saves flag's two constructors and its verdict reader |
| [decide/metamagic.js](scripts/decide/metamagic.js) | `metamagicFits` (does the option fit the spell — the pack keeps the option's condition as prose, so the predicate is the registry's `when`), `metamagicMenu` (the cast dialog's rows, the cost read live, the fit and the affordability as the tag), `metamagicPick` (one, eligible, affordable), `metamagicRuleText` (the feat's own text without the pack's cost line), `metamagicCardLine` (source, then result), `distantRange`, `carefulProtects` (the allies the save reaches, the caster first, up to the cap — or the player's chosen list), `heightenedMark` (the first enemy in reach, or the chosen one), `scalesTargetsFrom` (Twinned's fit off the source target count, with the user's exceptions), `extendedDuration` (doubled, 24 h at most), `empoweredPlan` (the ticked dice up to the cap), `empoweredOutcome` (the new total and the arrow sentence). Seeking Spell is a d20 fold KIND (`seeking`, d20-folds.js), not a metamagic.js moment. A METAMAGIC row's `unless` (Careful's `choosesTargets` — greyed on a spell that chooses its targets). The ask at the area and its readers of a spell's text are decide/area-ask.js (the row below) since 2026-09-24 |
| [decide/area-ask.js](scripts/decide/area-ask.js) | the ask at the area (2026-09-24, out of decide/metamagic.js): `carefulProtects`, `heightenedMark`, `chosenByDefault`, `choiceNeedsAsk`, `choiceCapFrom` / `choiceRuleFrom` / `spellProse` (a spell's own number and sentence, read off its text), `askDefaults`, `askMark`, `askWords` (each kind's words), `askOutcome` (an answer's records and who keeps their save), `areaChoiceLine` |
| [decide/rescue-hit.js](scripts/decide/rescue-hit.js) | the `roll` interrupt (Slice A, 2026-09-24): `d20ModeOf`, `d20Faces`, `needsSecondD20`, `disadvantageOutcome` (Disadvantage on a roll already made — the lower of two d20s; Advantage cancels to the FIRST die; already at Disadvantage moves nothing; a natural 20 can be undone), `critStands` (a crit doubles one damage roll only while it stands for every hit target), `rescueRows` / `liveRows` / `rescueTitle` (the popup's rows, their cost or their reason as the tag), `bentLines` (the attacker's card), `rescueSpendText`, `plainRule` |
| [decide/damage-dice.js](scripts/decide/damage-dice.js) | the damage-dice folds' patch (2026-09-24): `rerollFaces` (Empowered's per die, lifted out of metamagic.js), `weaponDiceOf` / `setFormula` / `setTotal` (the activity's own dice, never a rider's), `eitherOutcome` (the higher set stands, a tie keeps the first), `eitherPatch` (both sets on the roll, the loser struck), `eitherDue` (once per turn), `eitherCardLine` |
| [decide/moments.js](scripts/decide/moments.js) | `MOMENT_RECORDS` (every flag key that means *something resolved* — its word(s), what resolving means, `resolved(record, ctx)` → the markers and plain facts), `STATE_KEYS` (every other key, with its reason), `MOMENT_WORDS` / `MOMENT_KINDS` (the contract's vocabulary), `resolvedMoments`, `newMoments`, `momentId` — the moment gate's data (*The moment events*, below). ⚠ Classifies, never curates: a key is a resolve or state, a fact about the code |
| [decide/shields.js](scripts/decide/shields.js) | `shieldDue` (is a damage shield due on this hit — melee, within the activity's reach, once per turn, while the temp HP stand), `shieldReach`, `shieldType` (the type the standing effect decides), `shieldEffectNames`, `durationSeconds` |
| [decide/effect-view.js](scripts/decide/effect-view.js) | the effect view's rows from plain facts: `listed`, `changeSign`, `toneOf` (tone is a pattern, not a list), `effectRows`, `sheetRows`, `rowAction`, `panelGroups`, `everyRow`, `allRows`, `marksHeldBy` |
| [decide/verdict.js](scripts/decide/verdict.js) | `hitsAmong`, `modeAdmits`, `saveOutcome`, `saveMultiplier`, `reduceDamages` (Parry's subtraction), `verdictText`, and the fold layer (`ATTACK_FOLDS`, `SAVE_FOLDS`, `foldsFrom`, `foldedRoll`, `foldedVerdict`, `foldedSave`) |
| [decide/eligible.js](scripts/decide/eligible.js) | `isDeadForSaves`, `limitedUses`, `isReactionItem`, `castLevelOf`, `clampVolleyCount`, `riderKey` |
| [decide/receipt.js](scripts/decide/receipt.js) | `traitOutcome`, `hpDelta`, `receiptEntry`, `joinDamageReceipt`, `joinEffectReceipt`, `takenOf`, `receiptAmounts`, `revertPlan`, `revertableEffect` |
| [decide/present.js](scripts/decide/present.js) | `popupKey`, `POPUP_RANK`, `TONE`, `bfCard`, `ruleLine`, `momentBarHTML`, `holdBarHTML`, `nextCascadeSlot`, `cascadePosition`; `situationalBonusHTML`, `modeButtons` — the controls every popup that stands in for a roll dialog carries; `modeTone`, `modeTagHTML` — the one mode tag, one meaning per hue (`fails` is the save gate's fourth answer, red); `reminderSectionHTML` / `reminderFieldsetHTML` / `reminderDetailsHTML` — the gate's section bare, inside the system's own roll dialog, and folded to its header line for a volley's ray rows; `sneakBoxHTML` (the Sneak Attack choice under the sources) and `cunningMenuHTML` (the Cunning Strike menu on the damage offer); the rescue view's row model and markup |
| [decide/card.js](scripts/decide/card.js) | THE CARD SEAM: `CARD`, `cardKind`, `isCard`, `rollKindOf` / `rollKindInData`, `subKindOf` (a death or concentration save is a `save` told apart by `system.type`); `targetsOf` (6.0's token-keyed `system.targets` in the house shape — `uuid` is the target ACTOR, one row per actor, the token beside it), `describeTarget`, `TARGETS_KEY`; `originIdOf` / `originIdInData` / `originData` / `ORIGIN_KEY` (`system.origin` — the key the platform's registry indexes; every roll the module drives writes it); `activityRefOf` / `activityUuidOf` / `activityTypeOf`, `itemRefOf` / `itemUuidOf` / `itemNameOf`; `abilityOf`, `castLevelOn` (`system.level`), `scalingOf`, `concentrationIdOf` — what kind of card a message is, whose, from which, read off `type` and `system.*` ONLY. Every read of a card's system data goes through here, and a reader joins WITH its customer |

⚠ **`receiptAmounts` returns the row's TEXT as well as its figures, deliberately.** The two bugs
that reached the table there were both a right number in the wrong sentence. Only the colours
stay at the EDGE. **Do not "tidy" those strings back into the view.**

**Outside the layer, the shared readers:**

| Module | Holds |
| --- | --- |
| [geometry.js](scripts/geometry.js) | EDGE: `tokensInRegions` — the platform's own containment (`TokenDocument#testInsideRegion` against the region's polygon tree, from the document's committed source position, no canvas); `tokenOfActor`, `tokenForUuid`, `feetOf`, `nearestFeet` — token distance in FEET, the readers the reminder gate grew and the damage service shares (the 5-foot automatic crit) |
| [lookup.js](scripts/lookup.js) | SPINE: `lower`, `itemNamed`, `featureNamed`, `activityNamed`, `activityOfType` (and their own `sameName`) — the sheet readers every machine uses; `resolveUuid` — the `fromUuidSync` guard (a throw on an unloaded pack or a dead document is "not here"); `resolveDie` — a die formula resolved on THIS actor's roll data, an `@` left standing refused. `cardItem` / `cardActivity` — a CARD's item or activity: the live document while it stands, else the card's own snapshot of an item the use DELETED (dnd5e spends before it posts); `tools/check-card-reads.mjs` holds every such read to them, a deliberate live read saying why. Imports only the card seam (decide/card.js — downward), owns nothing. `core.js` and `shared.js` keep their own uuid guard: the leaf and this file's own layer. Its companion in settings.js: `listedNames(entries)` (a list's kinds as a lower-cased set) |
| [surfaces.js](scripts/surfaces.js) | CORE, a second leaf beside core.js: `SURFACES` — every HTML anchor the module reads off the PLATFORM's markup (core's `.message-content`, `[data-message-id]`, `.form-group`; dnd5e's damage tray, the usage card's SUMMARY block (`cardSummary` — where a chained roll's rows draw, ui.js `cardRow`; the card's BUTTONS are data since 6.0, filtered at birth in polish.js), the roll dialog's parts, default and roll buttons, the usage dialog's footer) and `SURFACE_SOURCES`, where each is authored. **No selector string for a platform element lives anywhere else** — `tools/check-surfaces.mjs` fails the build on one, and on a dnd5e anchor that no longer appears in the verified version's shipped templates (`dnd5e-surfaces.json`, generated and pinned like the hook artifact). NOTES §2 *The dnd5e 6.0 pass* §3b: the card's DATA is the contract, its HTML is not |

### The dependency rule

> **Depend downward only: machines → services → spine → registry → decision → core.**
> A machine may not import another machine, and a same-layer edge is treated exactly like an
> upward one. **Every edge that is not downward is PINNED, with a reason, in
> [tools/check-layers.mjs](tools/check-layers.mjs) — and the gate fails on an unpinned edge AND
> on a pin whose edge has gone.**

| Depth | Layer | Files |
| --- | --- | --- |
| 6 | entry | `battleflow.js` |
| 5 | **machines** | hold/ (one machine, a directory — below) · saves/ (one machine, a directory) · mastery · topple · chip-spend · precision · riposte · hew · bash-offer · command · concentration · volleys · cast · hit-riders · d20-folds · receipts · polish · resources · reminders (the gate machine — attack, save and check gates) · stats · sneak · clock-riders · use-chips · emanations · hit-menu · damage-shields · damage-casts · superiority-uses · metamagic (the Sorcerer's options in the cast dialog, the points spent on the card) · damage-either (Savage Attacker: the weapon's dice rolled again as a set on a hit, the higher standing — Slice A, 2026-09-24) · effect-view (a creature's buffs and debuffs on the bar, the hover card and the held key; the bar's fold is the one write, the platform's own document edit under the owner's permission; RULINGS.md *The effect view*) |
| 4 | **services** | `auto-apply.js` · `effect-riders.js` · `auto-damage.js` — the consequence chokepoints (§2) · `area-ask.js` — the ask at the area, one question two machines route through (metamagic, saves; 2026-09-24) |
| 3 | spine | `ui.js` · `shared.js` · `geometry.js` · `settings.js` · `lookup.js` (the sheet and document readers) · `holds.js` (the hold registry — what another module asks before it plays) · `events.js` (the moment events — what the module publishes when a moment resolves) |
| 2 | registry | `volley-registry.js` |
| 1 | decision | `decide/*` — **zero imports, asserted** |
| 0 | core | `core.js` · `surfaces.js` — leaves, **asserted** |

The rule is **"no UNNOTICED cross-layer edges"** — the R4 tripwire's shape applied to the
import graph. **Do not hand-count this graph;** quote `npm run layers`.

**A machine may be a DIRECTORY** (ruled 2026-09-05) when one flag's lifecycle outgrows a file.
The directory is the unit the dependency rule tests: its parts may import each other (hoisted
`function` declarations called at hook time), `index.js` is its only public face, and the entry
imports the index. `GROUPS` in [tools/check-layers.mjs](tools/check-layers.mjs) holds it: an
edge from outside to any part but the face fails with *"import the index"*.
`EXPECTED_SOURCE_FILES` counts the parts file by file. ⚠ **The index's import list fixes the
parts' registration order; it is load-bearing, and its comment says so.**

- **`saves/`** — eight parts along the spine's steps. ESM evaluates a cycle's first-listed
  member LAST, which is why `saves/index.js` lists `verdict.js` before `ask.js`.
- **`hold/`** — nine parts by moment, a DAG; the index re-exports the machine's ONE outside
  name, `stampHoldIfInterrupted`, and two bare imports at its head (`ui.js`, `effect-riders.js`)
  keep the spine's bar registered above the hold row.

**Split by MOMENT, not by phase.** A file holding several features is cut into one machine per
moment, each owning its own flag (the maneuvers are `precision`, `riposte`, `hew`, `bash-offer`
and `command`; `topple.js` owns the `topple` flag off the card mastery posts — the card is the
bus). Shared readers go DOWN (`lookup.js`, rules text to `decide/registry.js`), never sideways.

**The hold is a feature, not a service.** Only `auto-damage.js` imports it (`hold/index.js`,
`stampHoldIfInterrupted`), on the deliberate order-pinning edge. The "who does what" services
(`canAnswerFor`, `isContinuingClient`, `inRunningCombat`, `isActiveGM`, `rollerUserFor`) live in
`core.js` (§3); the interrupt/block list wrappers with the settings surface (§8).

> **A VIEW belongs with the machine that owns the FLAG it renders.** The spine owns *how* a
> moment is presented — popups, clocks, bars, latches; a machine owns *what* its own moment
> says. A view in the spine imports the feature's vocabulary, and that is the cycle every time;
> a spine function reading a feature's flag by STRING is the same fault with no edge to show it.

### The offer's contributions — a service that knows no feature

`auto-damage.js` owns the damage offer's popup, clock and one roll thunk, and knows nothing about
any feature. What a feature PAINTS on the offer — the armed Cleave line, the Cunning Strike menu,
the due clock riders, the hit menu — is declared by the machine that owns it, at module
evaluation, through `registerOfferPart({ key, due, parts })`: `due` says the offer must open
even under auto damage, `parts` returns the markup, the notice lines, the live controls and the
commit that writes the pick on the attack message before the dice. Order on the offer is
registration order. A service never imports a machine to paint its content.

### Registration order is import-graph order

A file's imports evaluate before its own body, so an "early" file importing a "late" one
registers the late file's hooks **first**. Some same-hook orderings are behavioral (a veto must
register before a capture; a card row's render order is its registration order). The
load-bearing ones are the named `CHECKS` in `tools/check-hook-order.mjs` (stubbed globals, no
Foundry); the full order is [tools/hook-order.snapshot](tools/hook-order.snapshot), and
`npm run hooks` **fails on any drift from it**. The lazy-edge tally is `npm run layers`'s to
print.

- **Adding an edge reorders, and so does removing one** — an import drags a file's evaluation
  earlier than its entry position; a lazy edge holds no order.
- **A move meant to change the order** refreshes the snapshot with `--snapshot` in the same
  commit and says why the difference is unobservable (a disjoint flag namespace, no shared card,
  the contended pair preserved); **a move meant to be order-neutral** is proven so by the gate.

Cross-file symbols must be **hoisted `function` declarations called at hook time**, never at
module-eval time — that is the only reason the existing import cycles are safe.

### The public API — the only surface another module may read (2026-09-09)

`game.modules.get("fvtt-mod-battleflow").api`. ⚠ **Everything else in this tree is private**, and
the rule runs both ways: **Battle Flow imports no other module and calls into none.** A table may
install this module alone, or with FX Studio, or with neither — nothing here may assume a
neighbour. What other modules need is *published*, never *reached for*.

| Surface | Owner | What it is |
| --- | --- | --- |
| `registries` | [settings.js](scripts/settings.js) | the settings lists, read-only — inspection, not an extension point (§6 rule 5) |
| `volleyRegistry` | [volley-registry.js](scripts/volley-registry.js) | volley membership, read-only, same rule |
| `acknowledgeMoment` | [ui.js](scripts/ui.js) | resolve a card's pending presentation (law 3) |
| `holdFor(subject)` · `castHold(uuid)` · `holds` | [holds.js](scripts/holds.js) | **the hold** — below |
| `moments` and the hooks `battleflow.moment` · `battleflow.<event>` | [events.js](scripts/events.js) | **the moment events** — below; version 2, a GATE over the module's own records ([decide/moments.js](scripts/decide/moments.js)), every resolve published |

**The hold** has a consumer outside this repo, so its contract is written here. While a cast
waits on a question only the landed area can answer (Careful Spell: *who does the spell
spare?*), its card is held back, so a module keying on the usage card does not play a picture
for a spell nobody has aimed yet.

> A hold is **client-local**, in memory, keyed by an **opaque subject**. `holdFor(subject)`
> answers with a promise or `null`; `null` means nothing *here* is holding, which on a remote
> client may mean nothing here can *see* a hold. A hold **always settles**, three ways: with the
> **card** that lifted it (play it), with **`null`** meaning nothing was posted and nothing should
> play, or with a **truthy sentinel** meaning the hold lifted and nothing is known — carry on.
> **The consumer bounds its own wait** — a hold is a courtesy, never a guarantee of liveness.

⚠ **Never collapse the sentinel into `null`.** A hold that outlives its own clock has NOT
established that the cast came to nothing (the points are spent, the area is on the map);
reading it as *never happened* suppresses the picture for a late answer. **Fail open.** A null
RETURN (*play now*) and a null RESOLUTION (*play nothing*) are opposite instructions that look
identical; [tests/holds.test.js](tests/holds.test.js) pins the distinction and the refcount.

`castHold` is an alias of `holdFor` that FX Studio shipped against and **is kept forever**.
`holds` is `{ version, keys }`, so a consumer can tell contracts apart without probing. The hooks
beside it: `battleflow.holdOpened` when one is raised, `battleflow.castReleased` when one
settles. ⚠ **The release is on `preCreateChatMessage`, never on `createChatMessage`** — create
hooks fire DURING the create, so a consumer would find the hold still open for the very card
that lifts it.

**Four decisions in [holds.js](scripts/holds.js) are load-bearing** for the modal sequence
(BACKLOG *The modal sequence*): the hold
is **refcounted** (never a boolean — one holder today is exactly why a boolean would look right
and then cost a migration), keyed by an **opaque subject** (never an activity uuid), released by
an **explicit lifecycle call** (never coupled to "the card posted"), and `openManagedPopup` stays
the one place a decision popup opens.

### The moment events — what the module publishes when a moment resolves (2026-09-11)

The mirror of the hold: the hold tells a neighbour *not yet*, the events tell it *now, and here
is what*. An ability used through the module's own popups posts no usage card (a maneuver die
rides the damage roll, Parry rides the hold's answer), so [events.js](scripts/events.js) fires
**`battleflow.moment`** with a plain payload, then **`battleflow.<event>`** with the same
payload, at the point the moment resolved.

**The user's ruling: every resolve publishes, through a gate, so nothing is missed as the module
grows; what plays is FX Studio's manager's call.** By §4 law 3 a resolve IS a record landing on a
message, so the gate watches the RECORDS.

> **Three parts.** (1) [decide/moments.js](scripts/decide/moments.js) — `MOMENT_RECORDS`, one row
> per flag key that means *something resolved*: the word(s) it publishes under, one sentence on
> what resolving means, and `resolved(record, ctx)` → every resolved moment in the record, each
> with a stable **marker** (a target uuid, an index, `message`) and plain facts; and `STATE_KEYS`,
> every other key the module writes with the reason it is state. Together they classify every key.
> (2) events.js — **one publisher**, on `createChatMessage` and `updateChatMessage`, publishing
> each registered record's markers this client has not seen; on `ready` the log is remembered
> without publishing, and a deleted message forgets its markers. The edge from unresolved to
> resolved IS the idempotence — no machine keeps a latch for it. (3)
> [tools/check-moments.mjs](tools/check-moments.mjs) — every flag key the module writes is in
> exactly one of the two lists, no row is stale, and **every file that writes the world** is
> pinned to the record(s) its writes resolve into or a reason none does (a resolve landing on an
> actor or item alone would otherwise be invisible). An unclassified key fails `npm run verify`;
> forgetting to classify is the only failure left, and it is loud.

**The publishing client.** A resolve publishes on ONE client: by default the one that WROTE the
record — the client with the facts at the instant they are true. A row may name another
(`publisher`): the hold names the answering player (`answeredBy`). Every other client REMEMBERS
the marker without publishing, so a later write cannot re-fire an old resolve anywhere.

The payload is **plain** (uuids and ids, strings, numbers, booleans; frozen, serialisable) and
carries **no flag shape** from this module. **Nobody listening is a no-op**: no feature detect,
no try/catch around a neighbour, no setting.

The vocabulary is **closed**, a word per MECHANISM FAMILY — `maneuver` · `sneak` · `fold` ·
`rider` · `hold-answered` · `mastery` · `shield` · `spend` · `damage` · `effect` · `save` ·
`break` · `use` · `cast` · `volley` · `choice` · `metamagic` — and `kind` names the exact record
(`hitManeuver`, `clockRiders`, `receipt`, …). A new word is a contract change and a version bump;
`api.moments` is `{ version: 2, events, kinds, hooks }`. The payload: `event`, `module`,
`version`, **`kind`, `marker`, `momentId`** (`<messageId>|<kind>|<marker>`, unique per resolve —
the dedupe key), `actorUuid` / `actorName` / `tokenUuid` (who), `itemUuid` / `itemName` /
`activityUuid` / `ability` (what; a name-only row finds the item on the sheet by item name, then
by ACTIVITY name), `messageId` (where it resolved) and `attackId` (the attack it rode),
`targets[]` as `{ actorUuid, tokenUuid, name, hit? }` (`hit` only when a verdict is known),
`spend` in the uniform row shape or null, `details` (kind-specific plain facts), `at`. A resolve
under two words (Parry: `hold-answered` and `maneuver`; a failed concentration save: `save` and
`break`) fires once per word with the same `momentId`. `hold-answered` publishes a **pass** too
(`details.answer`); a revert is its own marker (`<uuid>|reverted`) under `damage` / `effect`.
[tests/decide-moments.test.js](tests/decide-moments.test.js) pins every row and its edges;
[tests/events.test.js](tests/events.test.js) pins the payload and the gate.

**A consumer dedupes against the card.** `damage`, `effect`, `spend` and `save` also fire for
resolves the platform posts a card for, and a cast that answers a hold posts its own usage card
beside `hold-answered` — by design, the two carry different facts; `momentId` is the key to
dedupe on.

---

## 8. The settings surface

`npm run registry` prints the count ("all N keys in S are registered", 52 on 2026-09-24, Slice A's Damage Rolled Twice list the 52nd) —
quote the tool, never a number typed here. Every feature is a world setting, default **ON** (user
call, 2026-09-03: *"have it ship all on"*); the shipped defaults and the reference table in
`tools/verify-settings.mjs` agree. A Foundry default applies only where a setting has never been
written, so a default flip never touches an existing world. A list whose `onChange` changes what
stands on the map sweeps (Emanations off lifts what stands, on raises it again).

### Rules

1. **One switch per feature**, and it ships on. Never ask the table to opt into — or out of —
   the same answer twice.
2. **Entry-point hooks check their toggle; view and continuation hooks check for their flag.**
   An already-stamped moment must still render and resolve after a mid-session kill.
3. **A client setting must change only who presses a button.** A save is *owed* (the table waits
   on it), so a per-player opt-out is a world decision wearing a client setting; a damage roll is
   *owned* (nobody is blocked; the buzzer makes the timing identical). Only the second shape may
   be a client setting.
4. **A per-client setting nobody knows to look for must not start wrong** — by the TABLE's
   normal, not by novelty: centered dialogs ship ON, and Roll Your Own Damage ships ON (user
   call, 2026-08-27) because this table's players press their own damage; the buzzer makes ON
   safe.
5. **Every setting joins a divider group and the dependent grey-out sync.** A setting spanning
   two groups states which condition enables it — a control that reads as inert and still fires
   is a bug.
6. **Every list setting parses strictly** (§6).

---

## 9. The dnd5e contract

The module rides **public hooks and document writes only** (R3). The seams it depends on:

| Seam | Used for |
| --- | --- |
| `dnd5e.rollAttackV2` | the attack trigger — fires on the rolling client, after the message exists |
| `dnd5e.postUseActivity` | the use trigger — spell holds, save demands, volleys, cast payloads; a scoped tactical fold's ARMING (d20-folds.js: Tactical Assessment or Ambush used from the sheet — the die rolled in the open, a chip carrying the number on the actor, a notice naming the check; `dnd5e.rollSkill` / `dnd5e.rollInitiative` fold the number in when the check the scope names lands) |
| `dnd5e.preRollDamageV2` | injecting rider damage parts (crit doubling comes free — see NOTES): the marks (hit-riders.js), the Sneak Attack dice after their Cunning Strike costs (sneak.js), the clock riders (clock-riders.js) and Commander's Strike's ride (command.js — the chip the elect put on the ally carries the fighter's die; the ally's own attack's damage folds it into the base roll, spends the chip and the Reaction, and stamps `commandRide`; no driven attack, no relay); the automatic Critical Hit — `config.isCritical = true` on a hit within 5 feet of a Paralyzed or Unconscious target (auto-damage.js `critFor`, the ONE crit source the offer's badge and both roll paths read) |
| `dnd5e.preRollAttackV2` · `dnd5e.preRollSavingThrowV2` · `dnd5e.preRollAbilityCheckV2` | the three gates (attack, save, check): judged before the dice, the system's own dialog forced open and given Battle Flow's fieldsets — **the dialog is the system's own, we add one fieldset and set its default** (RULINGS.md *The gate before the roll*); all TEMPLATED names, pinned in `check-hook-dispatch` and asserted FIRED by their suites. Initiative rides the check hook too and is skipped by its `initiativeDialog` hookName. The same judge (`reminders.js` `judgeRoll`) runs in the volley aim popup per ray, and the ray's record rides the roll's own message data |
| `renderRollConfigurationDialog` (core) | the section drawn into the system's roll dialogs on each render — the attack gate's, the save gate's and the save demand's fieldsets, the Fails button; polish.js's target block rides the same hook |
| `dnd5e.postRollConfiguration` | the record of what the gate showed and what was pressed, stamped on the roll's message data after the dialog closes with rolls in hand |
| `dnd5e.rollDamageV2` / `createChatMessage` | the application trigger on the elect |
| `dnd5e.preApplyDamage` | the veto seam and the receipt's last word — **cancelable, and healing takes the same path** |
| `dnd5e.damageActor` / `healActor` | announcements; fires on all clients |
| `dnd5e.renderChatMessage` | every card row this module draws — fires for **every** message subtype. ⚠ Since 6.0 a save or check chained to a usage card renders HIDDEN and as a SUMMARY inside the usage card (client setting `chatCardSummary`): a row that can land on such a roll registers through ui.js `cardRow`, which draws it on the shown card or inside `.card-summary[data-message-id]` when the usage card renders — one drawer, two hosts, never both. The saves card's per-target line goes further: a resolved target whose roll is summarized in the card gets the verdict's tail written into the platform's own row (`SURFACES.summaryRow`, `verdictTail`) and no line — one row per creature |
| `dnd5e.preCreateUsageMessage` | the usage card's buttons are DATA (`system.buttons[]`): polish.js drops every row but `refundResource` before the card exists — a button not in the data is on no client's card; the handlers underneath survive |
| `updateChatMessage` → the summary nudge (ui.js) | the platform re-renders a summarized roll's origin on create, delete and `system` change only; when this module's flags move on a summarized roll (a fold answered), ui.js calls `ui.chat.updateMessage(origin)` so the summary re-draws |
| `Actor5e#applyDamage` | the resistance math (N1 — never reimplemented) |
| `Actor5e#rollSavingThrow` / `rollConcentration` | real saves (N1) |
| the message registry (`system.origin`, `getAssociatedRolls`; every roll the module drives writes `system.origin`, decide/card.js `originData`) | chain resolution — **we ride the system's registry, never a parallel one** |
| turn events (`dnd5e.preCombatRecovery`, combat hooks) | per-turn clears |
| `dnd5e.rollInitiative` — `(actor, combatants)`, after the number is set | Ambush's fold on the initiative roll's own message; accepting re-sets the combatant's initiative (a fold, the original standing as history). ⚠ Fires only from `Actor5e#rollInitiative` (the sheet, a macro): **the combat tracker's roll button goes through `Combat#rollInitiative` and never fires it** (NOTES §2 *The combat tracker's roll never fires*) — so `createChatMessage` on the platform's own `flags.core.initiativeRoll` message, authored by this client, is the second road to the same stamp; a same-client latch keeps the two to one |
| `dnd5e.rollSkill` / `dnd5e.rollToolCheck` — their `data` carries `skill` / `tool` | the scoped folds (Ambush on Stealth; Tactical Assessment on History, Investigation, Insight) read the skill off the hook's own data |
| `dnd5e.preUseActivity` → `usageConfig.subsequentActions = false` | a bare damage activity's dice are the module's (damage-casts.js) and a maneuver's damage activity is its DIE (superiority-uses.js, Commander's Strike) — dnd5e's own follow-up (a damage dialog) is switched off at the use so nothing rolls twice; the consumed-flag write the follow-up skips is replicated as volleys.js does |
| `preCreateChatMessage` → `flags.<module>.-=castApply` | every Battle Master maneuver's usage card is kept OFF the cast slice one hook after polish.js stamps it (Bait and Switch ships twelve "Baited AC" effects, one per face) |
| `updateChatMessage` → the cast slice's choice | a listed cast's `castApply.choice` is stamped pending at birth (polish.js); the caster's answer is a flag write on their own card, and this hook is how the elect learns of it and applies the pick (cast.js) — the card-as-bus shape of every answer in the module |
| `updateChatMessage` → the resource flash for a HAND spend | a die the module spends itself (Parry at the hold, the hit menu at the damage) has no dnd5e `system.deltas`; its `poolSpend` record lands by a flag write, and resources.js flashes it from this hook exactly as it flashes a use's deltas from `createChatMessage` — one reader (`shared.js poolSpendsOn`), one wording (`spendLine`) |
| `updateCombat` (core) · `tokenTurnStart` (the region event) | the emanation NOTICE at the caster's turn start (Aura of Vitality) rides the combat's own update; the emanation HEAL at a member's turn start (Aura of Life) rides the region's own event beside the turn-end one |
| **Regions (core)** — `RegionDocument.createTokenEmanation`, `Region.attachment.token`, `region.tokens`; the events `tokenEnter` / `tokenExit` / `tokenTurnEnd` / `behaviorActivated` / `behaviorDeactivated` delivered to a behaviour type registered through `CONFIG.RegionBehavior.dataModels` (the way dnd5e registers difficult terrain; the subtype declared in `module.json` `documentTypes`); the hooks `createRegion` / `deleteRegion` / `updateRegion` / `updateToken` | emanations.js: the aura's area is the platform's — shape, attachment, membership and events — and the module only decides what it hands out. Since dnd5e 6.0 an activity's area IS a Region (`TemplatePlacement.fromActivity`, stamped `flags.dnd5e.activity` — the tie every path keys on — `item`, `origin` = the usage TOKEN, `spellLevel`, `dimensions`); `Scene#templates` is deprecated at Foundry 14 and the `*MeasuredTemplate` hooks never dispatch — saves/areas.js rides `createRegion` / `updateRegion` and sweeps Regions; a placed region is NO concentration dependent, the `deleteActiveEffect` sweep ends a duration area — the saves machine's for a cast with a demand, emanations.js `endConcentrationAreas` for every other concentration cast (the areas the caster's client tied to the concentration effect at the cast, `areas` on the effect written at `dnd5e.postUseActivity`; the activity match only for an untied area nothing else can claim — Fog Cloud). ⚠ `region.tokens` is filled by `RegionDocument#updateTokens` with `noHook: true` — a just-raised ring's membership lands silently, so every membership floor tests geometry itself (`tokensInRegions`). The platform's own `dnd5e.*` behaviours are refused on any region this module adopts (`preCreateRegionBehavior`) |

### Version pinning

`module.json` pins the whole dnd5e 6.x line (6.0.0 → 6.9.99) and Foundry v14; the verified
version is the one `module.json` names. This module rides system workflow hooks and churns with
dnd5e minors — that churn isolation is why it is a sibling module rather than a feature of
another.

### The API-drift rule

Every fact about dnd5e's internals that the code depends on is recorded **at the line where it
bit, with the version**, and mirrored in [NOTES.md](NOTES.md). A behaviour we cannot assert
from a public hook is a behaviour we must verify live, not assume.

**A hook name the system never dispatches registers cleanly and does nothing forever.**
`npm run dispatch` ([§10 D10](#10-known-architecture-debt)) asserts every `dnd5e.*` hook this
module registers is one dnd5e dispatches, against a set **generated from the installed system's
own source** and pinned to the version `module.json` verifies. ⚠ **A dnd5e upgrade is a two-step
act:** bump the pin, then `node tools/check-hook-dispatch.mjs --regen`, then **read the diff** —
a name that disappeared is a registration gone silent. CORE hook names cannot be checked this way
(measured 2026-08-23: Foundry's minified client bundle yields 0 of the 15 then registered); a core
name that goes away is seen only by the hook-coverage report (§11 *Adding a TEST* rule 6).

---

## 10. Known architecture debt

This register is for what is OWED: a row names the rule it violates and the evidence. **Today
nothing is owed.** Every past row is closed, dropped by decision, or parked in BACKLOG; the
ids stay because code comments cite them.

| # | What it was | Where it went |
| --- | --- | --- |
| **D1** | `hold.js` carried shared services six machines imported | closed 2026-08-23 — `core.js` (§3) and `settings.js`; §7 *The dependency rule* |
| **D2** | the hold off the moment spine (`closeAnsweredPopups` in ui.js, reading the hold flag by string) | closed 2026-08-23 — `closeAnsweredHoldPopups` on `livePopups`; `smoke-twoclient` §close |
| **D3** | per-target read-modify-writes outside the serializer | closed 2026-08-22 — §4 law 2; §11 *Converting a write to the serializer* |
| **D4** | a flag accessor layer | dropped by decision 2026-08-23 — *Decided against*, below |
| **D5** | DECISION logic inlined in EDGE handlers | repaid 2026-08-22 — `scripts/decide/` (§2, §7) |
| **D6** | the `ui.js` ↔ `hold.js` cycle | closed 2026-08-23 — the view rule, §7; the two remaining cycles are permanent (*Decided against*, below) |
| **D7** | no static gate | closed 2026-08-23 — `npm run verify`, the type checker over `decide/` |
| **D8** | post-roll folds as one feature's special case | closed 2026-08-23 — `ATTACK_FOLDS` / `SAVE_FOLDS`; §11 *Adding a FOLD* |
| **D9** | machine → machine import edges | (a) (b) repaid 2026-08-23, (c) (d) 2026-09-05, (f) 2026-09-04 (§7 *The offer's contributions*); what stands is parked — BACKLOG *The two sideways edges*, *Two clock residues*; `npm run layers` is the evidence |
| **D10** | a hook name the system never dispatches | closed 2026-08-23 — `npm run dispatch`, §9 *The API-drift rule* |
| **D11** | nothing proved a registered handler ever ran | measured, not a gate — `hook-coverage.mjs` + `claim-proof.mjs`; reading them is the standing obligation, §11 *Adding a TEST* rule 6 |
| **D12** | Foundry 14 never dispatches the `*MeasuredTemplate` hooks | closed 2026-09-16 — the 6.0 pass made every area a Region and the registrations left with the pin (515379f); §9, the Regions row |

⚠ **A ledger that declares itself empty is how the next drift gets in, and a debt row's evidence
goes stale as silently as code.** Re-measure before believing a row; add one the moment
something structural is genuinely failing a rule, with the rule and the evidence.

---

## 11. Adding something new — the checklist

**Adding an ability** (a new reaction, rider, volley spell, maneuver):
1. Is its KIND already in the code? → **one registry or list entry. Stop.**
2. If not: is this genuinely a new kind, or a special case of an existing one?
3. If genuinely new: add the kind, count it against the R4 tripwire, and record why.

**Converting a write to the serializer** (`queueFlagWrite`, §4 law 2):
1. **Repeat the guard INSIDE the lock** — another writer may have made it false since. Return
   `false` when there is nothing to record, so a no-op never churns a render.
2. ⚠ **Check EVERY LATER USE of the old local variable.** Once the mutation moves inside the
   callback, the local clone is stale (a clock never disarmed; a losing racer that still
   announces). Re-read after the write, and gate follow-ups on a `claimed` result.
3. Not every write needs it. A single-decision object with one writer (concentration's ask,
   mastery's own flag) is not a per-target read-modify-write and the argument does not reach it.

**Adding a RECORD** (a new flag key the module writes — a moment's state, a resolve, a fingerprint):
1. `npm run moments` fails until the key is classified in [decide/moments.js](scripts/decide/moments.js):
   a **resolve** (a `MOMENT_RECORDS` row; the gate publishes it, nothing else to write) or
   **state** (a `STATE_KEYS` reason). A file that writes the world is pinned in `WORLD_WRITERS`
   ([tools/moment-writers.mjs](tools/moment-writers.mjs)) to the record its write resolves into.
   Classify, do not curate — whether the moment gets a picture is the consumer's.
2. A new WORD is a contract change: `MOMENT_WORDS`, the version in events.js, §7 *The moment
   events*, and FX Studio's ARCHITECTURE §2 — in the same commit.

**Adding a FOLD** (anything that changes an already-rolled outcome after the fact — a reroll,
an added die, a reaction that moves AC):
1. It is an entry in `ATTACK_FOLDS` or `SAVE_FOLDS` ([decide/verdict.js](scripts/decide/verdict.js))
   plus whatever stamps the flag. **If you are adding a parameter to `hitsAmong`, stop** — that
   is the debt D8 closed, and it grows back one parameter at a time.
2. Pick the contribution shape, and pick it honestly: `add` for a die, `replace` for a REROLL
   (it carries its own crit and fumble — a rerolled natural 20 crits, which is why it cannot be
   an `add`), `ac` for a defender-side change, `verdict` only when there is genuinely no
   arithmetic to do (the negate hold). There is no `{dc}` shape: the ask owns its DC.
3. **Never re-introduce precedence.** Folds COMPOSE (user ruling 2026-08-23): the attacker's
   move the total, the defender's move the AC, one verdict at the end. *"The defender always
   wins"* silently eats a spent resource; *"last fold wins"* tests the new total against the
   stale snapshot AC.
4. ⚠ **If it can turn a HIT into a MISS, it owes the table a revert** (user ruling 2026-08-23):
   the module **auto-reverts its own receipt**, on `revertPlan`/`revertableEffect` in
   [decide/receipt.js](scripts/decide/receipt.js). Nothing ships that can yet; the first feature
   that can builds it, and does not ship without.
5. Unit-test the arithmetic — this layer decides whether attacks land, and a mistake here
   produces wrong outcomes that look fine in review.

**Adding a moment:**
1. Compose the spine (§5). Do not write a clock, a latch, a bar or a popup.
2. Walk the six steps and the twelve laws explicitly; each is a review checkbox.
3. Name its answer channels — a moment with one channel is usually missing the AFK fallback.
4. Add its receipt and its expiry default. A moment with no default outcome is not finished.
5. ⚠ **If it registers a system hook, its live suite must assert that hook FIRED** — not that it
   was registered. `npm run dispatch` proves the NAME is real; only a live assertion proves the
   handler ran (§10 D10, D11; `smoke-d20-folds` §4 is the worked example).

**Adding a file:**
1. Declare its layer (§2) in its header comment **and in `LAYER_OF` in
   [tools/check-layers.mjs](tools/check-layers.mjs)** — the gate fails on an undeclared file. A
   PART of a directory machine (§7) also declares its group (`GROUPS`).
2. Depend downward only (§7). If you need a service from a machine, the service is in the wrong
   file. If the edge genuinely must exist, it goes in that tool's `ALLOW` with a REASON and a
   disposition — and an `OPEN` one is recorded in BACKLOG *The two sideways edges* as well.
3. Run the hook-order check **and the dispatch check** (`npm run hooks && npm run dispatch`).
4. Register nothing at module-eval time except hook callbacks.
5. Move `EXPECTED_SOURCE_FILES` in `tools/check-registry.mjs`, and fix the docs that quote it.
   The count is pinned precisely so adding a file is a decision, not a drift.

**Adding a TEST — the tier rule (the standing rule, 2026-08-23):**

> **If an assertion does not need a live world, it does not belong in a live suite.**

1. Can it be decided from plain objects? → a **unit test** under `tests/`. 740 of them run in
   about four seconds with no Foundry, no browser and no fixtures (`npm run test`, 2026-09-24).
   That is the default, not the fallback.
2. Does it need `game`, `canvas`, a document or the DOM? → a live suite, and then it must join
   an existing **section** or declare a new one (`SECTIONS` + `DEPENDS` at the head of the file),
   so it can be run alone by `--section`.
3. **Never `sleep()` for a thing you can wait for.** Use the suite's `until()` and wait on
   **what the next assertion reads** (the card, the banner and the rendered line arrive
   separately). ⚠ A sleep that gives a WRONG behaviour time to appear is load-bearing: keep it,
   and say so in a comment beside it.
4. The full live battery of 2026-09-23 ran 30 rows in 62 minutes (`battery.mjs`). Without rule
   1, test time grows in lockstep with feature count forever.
5. **A change runs its own suites, not the battery (2026-09-23, user ruling).** Every live suite
   declares `export const COVERS = [...]` beside its `SECTIONS` (the machine files its sections
   drive); `node tools/battery.mjs --changed --list` prints what a change must re-run and why, and
   `--changed` runs it. The map is checked both ways in the gate (`npm run coverage`,
   [check-coverage-map.mjs](tools/check-coverage-map.mjs)) — an unclaimed machine fails, and
   there is no allowlist. ⚠ **A spine change is the full battery**, and so is a `decide/` file
   the spine imports: `shared.js` and `auto-apply.js` reach every machine. **The full battery is
   the floor before a release**; nothing smaller is.
6. **The battery ends with two readings, and somebody reads them** (§10 D11): which
   registrations FIRED ([hook-coverage.mjs](tools/hook-coverage.mjs), armed in
   [harness.mjs](tools/harness.mjs) `connectSuite`), and which `COVERS` claims the published
   moments prove ([claim-proof.mjs](tools/claim-proof.mjs): PROVEN when a record kind only that
   file writes was published in that suite). Both are **reported, never enforced** — a gate on a
   rare hook gets tuned out. **Do not let a never-fired line or an UNPROVEN claim sit
   unexplained across two releases:** only a person can say whether it is a coverage gap, a dead
   handler, a rare hook, or behaviour no record shows. `init` is unobservable by construction; a
   platform hook never dispatched is pinned in `NOT_DISPATCHED_HERE`, checked both ways; the
   claim proof hears the tester's page only, so two-client suites read low. Last full reading
   (the battery of 2026-09-23): hooks 56/56 observable names and 211/211 registrations fired;
   claims 76/84 proven, the 8 UNPROVEN triaged (four `polish.js` non-record behaviours, four
   two-client suites reading low).

**Moving code between files** (an extraction, a split, a reorder):
1. **Cut on function boundaries, never comment boundaries** (`grep -n "^function "`). A `/**`
   block does not reliably belong to the function beneath it — measured 2026-08-22, eight in
   this tree did not.
2. **Check the comment either side of every block you move**, and move a doc with the code it
   describes, or fold it into whatever replaced it.
3. `npm run comments` (`tools/check-comments.mjs`) catches a stranded block; it cannot tell you
   the prose is now wrong.
4. **Move, do not rewrite.** Flag shapes, setting keys, list defaults, table keys, rules text
   and card copy do not change in a move, and no lint cleanup rides inside a move commit.

**Any change:**
1. Which north star does it serve? If none, it is not in scope.
2. Does it add a required GM click? → redesign (N4).
3. Does it store a number that content already knows? → read it instead (N1).
4. Does it apply anything without a receipt? → not finished (R5).

---

## Appendix — Measured costs and decisions against

PLAN.md tracked the structural passes and was retired on 2026-09-24; its full text is in git
history (`git show 7377020:PLAN.md`). Two things from it have no other home.

### What each pass cost, against its estimate

Quoted from each pass's *HOW IT WENT* block and stage marks. **Distrust the risk labels;
re-measure before scoping** — on every pass below the thing labelled risky was cheap and the
surprise came from elsewhere.

| Pass | Estimated | Measured | Date |
| --- | --- | --- | --- |
| Enforcement pass (`npm run layers`) | +1 static check; "~17 machine→machine" edges; six lazy sites; D9 "record 3, repay 2" | 9 static checks; 11 pinned pairs / 12 sites, 8 pairs / 9 sites after Stage 4; nine lazy sites; 7 recorded, 3 repaid, 4 standing with reasons | 2026-08-23 |
| Foundation Stage 1, `sleep()` → wait | ~4 minutes recovered | 213s of sleeping, 73s of it under an assertion that something did NOT happen (load-bearing); smoke-volleys 33.7s → 0, smoke-resources 33.3s → 0.6s | 2026-08-23 |
| Foundation Stage 3, two-client coverage | "the least certain work in this plan" | the cheapest stage; `smoke-twoclient` 9/9 first run | 2026-08-23 |
| Machine-tier, Stages 0 → 3b | 5 sessions | the first window, one day | 2026-09-05 |
| Machine-tier, Stage 4a (maneuvers split) | 1 | about 1 | 2026-09-05 |
| Machine-tier, Stage 4b (mastery split) | 1 | about ½ | 2026-09-05 |
| Machine-tier, Stage 4c (saves directory) | 2 | about 1 | 2026-09-05 |
| Machine-tier, Stage 5 (who drives) | ½ | about ½; battery at HEAD 28/28 | 2026-09-06 |
| Hold directory | about 1 session | about one hour to the family suites green, one more for the docs and the battery (28/28, 39m 39s) | 2026-09-05 |
| Metamagic, Stages 0 → 4 | four to five sessions (½, 1, 1, 1–2, 1) | one day (~1, ~2, ~2, ~2, ~3 hours); battery 40 minutes, 25 suites, 181/181 registrations fired | 2026-09-09 |

### Decided against, and why

- **D4, the flag accessor layer — dropped (2026-08-23).** ~300 call sites (re-counted 2026-09-05:
  about 295 `getFlag` reads over about 76 keys); D3 already repaid the correctness half through
  `queueFlagWrite`; knip means it arrives all at once or not at all; it buys nothing a test can
  assert. Re-opening it is the user's call.
- **`hold/index.js` ↔ `auto-damage.js` — permanent.** The bare `import "./auto-damage.js"` pins
  evaluation order; breaking it drops the damage-offer bar below the hold row.
- **`auto-apply.js` ↔ `mastery.js` — permanent.** Breaking it moves `applyDamagesWithReceipt`,
  the damage chokepoint — low value, real risk.
- **The page-helper bundle for live suites — not built (2026-08-23).** `f.evaluate` cannot
  import, and smoke-hold's size is its scenarios (1,000 of 1,700 lines), not its helpers; "cuts
  every suite roughly in half" was never measured.
- **Per-suite world rollback — rejected** (`world-snapshot.mjs`, 2026-08-22: the copy is 0.054 s,
  the world bounce ~75 s, more than every `sleep()` in the tree). The battery rolls back once
  (`battery.mjs --snapshot`); suites keep their teardowns so any one runs alone.
- **TypeScript and a bundler — no** (user call, 2026-08-22). JSDoc + `// @ts-check`; the
  no-build WebDAV hot-deploy is worth more. What ships is what is written.
- **The light saves cut — overturned (2026-09-05)** for the directory, the long-term shape.
- **The withhold hand-back as a resumable — not taken (2026-09-05):** it would add an elect-side
  resume and a reload resume that no two-client suite pins.
- **An index for the whole-log scans — parked** (measured 2026-09-05: 35 sites, 13 in saves). The
  fix is an index by flag when a world's age makes it visible, never a tail window.
