# HANDOFF.md — the commissioned work, and only that

> **Provenance.** Commissioned 2026-09-01 in the cold session that retired the party-stats
> handoff (`8a0e2cc`) and pruned the backlog (`ac12e5c`). Per the standing convention this file
> exists only while a commission does, and retires when this delivers. **Status 2026-09-01
> (night): STAGES 0–3 ARE BUILT AND INDIVIDUALLY GREEN; a CODE REVIEW IS MID-FLIGHT; the
> BATTERY has NOT yet run on the Stage 2/3 code.** The session ran out of context mid-review
> and handed off here — read **CONTINUATION** first; the plan below it is history.
> ⚠ **The user's standing instruction for this commission (2026-09-01): "do autonomously until
> you pass to me for testing"** — finish the review fixes, run the battery, then hand over.
> The user is NOT expecting a "go" prompt for that sequence; they ARE expecting to be handed the
> result for table testing when it is green.

---

## CONTINUATION — for the session that picks this up

### Where things stand (commits on `main`, all after v1.27.2 = `8d04379`)

`ab6789c` test(expiry) · `a146fb0` feat(expiry) · `6916dd7` docs(expiry) — **Stage 0/1**:
chips on Foundry's clock, the spend, the tidy, the Cleave chit, `tools/smoke-expiry.mjs`
(35/35). `9c1880c` test(reminders) · `631066a` feat(reminders) · `825f707` refactor — **Stage
2 + 3**: the gate before the roll (`scripts/reminders.js`, `scripts/decide/reminders.js`), the
thirteen-condition table as data, the two list settings, `tools/smoke-reminders.mjs` (26/26).
The docs for Stage 2/3 (DESIGN §5 *the gate*, §8 rows, ARCHITECTURE §4, NOTES, README,
BACKLOG) are committed with this handoff. `npm run verify` is green (15 checks, 322 unit tests,
32 source files pinned, 23 kinds pinned). `module.json` is still **1.27.2** — no release was
cut; that is the user's call.

**Evidence so far:** the LAST FULL BATTERY was on the Stage 1 code (19 suites green, settings
clean, `dist/battery/2026-09-01T21-17-06`). Since then only single suites ran on the Stage 2/3
build: `smoke-reminders` 26/26, `smoke-concentration` 47/47 (its popup was refactored),
`smoke-expiry` 35/35 (before the refactor). **The battery on the delivered code is the one
thing that has not happened.**

### The environment, as left

- **Sandbox:** up, headless (`node scripts/local-foundry.mjs status|restart` in
  `../fvtt-mcp-molten5e`), Foundry 14.365 / dnd5e 5.3.3. The deployed module is byte-identical
  to `825f707`. **Fix-round discipline: `node scripts/deploy-house-module.mjs
  fvtt-mod-battleflow --local` → `node scripts/local-foundry.mjs restart` → suites** (a
  redeploy without a version change serves suites STALE code until the process bounces).
- ⚠ **The user has a combat of their own in the sandbox world** — "Practice Dummy" + "Thomas",
  started, round 3, scene-agnostic — created 2026-09-01 ~18:05 local while I was working. Every
  suite deletes `game.combat` on the way in. **Tell the user before the battery; do not delete
  it silently.**
- Settings: verify with `node tools/verify-settings.mjs` first (`--fix` restores) — the suites
  restore their own, but the standing rule is verify, never assume.
- A stray `x/` LevelDB directory sits untracked at the repo root (junk from some tool; the user
  has not yet said to delete it). Leave it.
- The MCP repo's stats scan (`get-combat-stats`) lists flag families by name — **`chipSpend`
  and `reminder` are two new families it does not yet read** (ARCHITECTURE §4's table names
  them). That is the other repo's change; mention it at hand-over.

### The code review, mid-flight — findings gathered, none applied yet

Eight finder angles ran over `scripts/reminders.js`, `scripts/decide/reminders.js`,
`scripts/decide/chips.js`, `scripts/mastery.js`, `scripts/decide/present.js`. **Angles D
(reuse), E (simplification), F (efficiency), G (altitude) and H (conventions — empty) reported;
A (line-by-line), B (removed behaviour) and C (cross-file) had not reported when the session
ended — re-run those three** (`git diff 8d04379..HEAD -- scripts`) before verifying. Nothing
below has been verified by a second pass; nothing has been fixed. Ranked, with the fix decided:

1. **Honour against the net ignores the chip's kind** (`decide/chips.js` `chipHonoured`, G).
   With `vex` off the Reminder Sources list, a Sapped attacker with a Vex on the target sees a
   Sap-only gate (net Disadvantage), presses it, and the Vex spend is stamped `honoured: true`.
   **Fix:** honour against the net only when the chip's kind is among the reminder record's
   `sources`; otherwise the chip's own bend. `spendChips` passes the record, not a bare `net`.
2. **The card-keyed popup path never ran** (`reminders.js` `showGate`, F). At pre-roll time
   dnd5e carries the originating id as a FLAT key — `message.data["flags.dnd5e.originatingMessage"]`
   — expanded only in `buildPost`, so `message.data.flags?.dnd5e?.originatingMessage` is
   undefined and every gate opened through the untracked bare-`DialogV2` fallback (the suite
   found dialogs via `foundry.applications.instances`, which is why it passed). **Fix:** read
   the flat key (`?? the nested one`), go through `openMomentPopup`, and DROP the fallback — an
   attack with no usage card is an API roll; no card, no gate. Record the flat-key fact in
   NOTES §2. Consider a `redraw: false` option on `openMomentPopup` so a rowless popup does
   not re-render the usage card twice.
3. **The Cleave chit is pinned to the attacker's combatant** (`mastery.js` `cleaveChitStands`,
   G). "Once per turn" is the turn IN PROGRESS: a chit written by an opportunity attack on
   somebody else's turn must die when THAT turn ends, not at the attacker's next turnEnd — as
   written, it survives through the attacker's own next turn and the on-turn Cleave is never
   reminded. **Fix:** `placeOf(attacker, { current: true })` pins the chit's `start.combatant`
   to `combat.combatant`; Vex/Sap/Slow keep the attacker's. Keep the chit itself — the user
   asked for it by name.
4. **The combatant lookup misses an unlinked token that shares a base actor** (`mastery.js`
   `placeOf`, D). `activeCombatFor` matches by `cb.actor?.id` while `getCombatantsByActor`
   matches a synthetic actor by token id: two goblin tokens off one actor, only A in the
   tracker, B swings → `start.combatant` null. **Fix:** one `combatantOf(combat, actor)` in
   core.js (token id for a synthetic actor, actor id for a linked one; `receipts.js`
   `clearDefeated` already carries the careful matcher) used by both.
5. **Prone compares feet against scene units** (`decide/reminders.js` `proneSources`,
   `reminders.js` `nearestFeet`, G). `measurePath().distance` is in the scene's units; on a
   metric grid two squares (3 m) counts as "within 5 feet". **Fix:** compare against the
   scene's own `grid.distance` (one square = reach) and label with the scene's units; move the
   pair-minimum into `decide/geometry.js` with an injected measure; replace the O(n²) pair loop
   with a nearest-square clamp and ONE `measurePath` (F); give geometry.js a
   document-authoritative squares helper so `documentSquares` stops forking `tokenSamplePoints`.
6. **`reissuing` is dead state** (`reminders.js`, E). The re-issue passes `configure: false`,
   which the "no dialog, no gate" guard already lets through. Remove the Set and the
   try/finally.
7. **`CHIP_FLAG` is used by the gate alone** (G, E, D). mastery.js still writes/reads the
   literal `"mastery"` at the applier, the chit, the spend, the tidy and the sweep, and
   `effect-riders.js` line ~192's twin-chip dedupe reads it too; `spendChips` re-implements
   `chipOwnedBy` inline. **Fix:** `CHIP_FLAG` at every chip site; `chipOwnedBy` in the spend;
   `chipSpentBy(key, role)` with one `"attacker"|"target"` argument instead of two booleans.
   (The ASK flag on attack messages is also named `mastery` — different document, same string;
   leave the ask alone.)
8. **Membership hand-copied in three places** (`decide/registry.js` `CONDITION_STATUSES`, G).
   **Fix:** move `CONDITION_BENDS`/`CONDITION_KEYS` into registry.js (it is membership data),
   derive `CONDITION_STATUSES` and the shipped default from it, have `conditionSources` take the
   table as a parameter (decide files import nothing), and take the number out of the settings
   hint. Keep the `size === 13` unit pin as the deliberate tripwire.
9. **Batch the expiry tidy per parent** (`mastery.js` `updateActiveEffect` handler, F): the
   platform stamps expiry as one batched update per parent, so two chips expiring together on
   an unlinked-token monster become two one-at-a-time deletes — the NOTES §2 shape that throws
   on the second, swallowed by the `.catch`. Collect `{parent → ids}` and flush on a microtask
   with one `deleteEmbeddedDocuments` per parent. Also: dedupe the `deleteCombat` sweep by
   actor and `Promise.all` it; `fromUuidSync` and the cheap elect check first in `spendChips`.
10. **Two more popups still carry the copied controls** (D, E): the Topple popup
    (`mastery.js` ~468–478) and the save ask (`saves.js` ~1647–1659) — move them onto
    `situationalBonusHTML` / `modeButtons`.
11. **Smaller:** the Sapped-by name resolve duplicates `d20-folds.js` `grantingActor` (hoist to
    shared.js); `resolutionLine`'s `net` parameter is unused except in one branch and
    `modeLabel` has one caller (drop both); `conditionSources`' `enabled` default hides the
    "list is the switch" contract (make it required); the spend line's mode wording ("flat")
    is a third vocabulary beside `modeTitle` — one vocabulary on the card.

**Angle C (cross-file) reported after the commit above — four more, and the first is the
most serious finding of the review:**

12. ⚠ **The re-issued attack is ORPHANED from its usage card on the real card-button flow**
    (`reminders.js` `reissue`). dnd5e derives `originatingMessage` in `buildPost` from
    `config.event.target.closest("[data-message-id]")` — AFTER the pre-roll hook — and the
    re-issue forwards no `event`, so at the table the re-issued attack message has no card link:
    the card's Damage button finds no attack (a gated CRIT's damage rolls un-doubled), and this
    module's own chain walk (`resolveAttackMessage`, hit-riders, maneuvers) misses it — no
    auto-apply, no rider, no precision fold on a hand-pressed damage. **The suite and the demo
    pass the flat key explicitly, which is exactly why they are green.** **Fix:** forward
    `event: config.event` on the re-issue (dnd5e's own `_triggerSubsequentActions` passes
    `{ event }`), AND derive the card id for the popup key from the event's
    `[data-message-id]` when the flat key is absent. Then make `smoke-reminders` drive a swing
    the way the button does — `rollAttack({ event })` with a synthetic event whose target sits
    inside the usage card's element — so the orphan class can never pass green again.
13. ⚠ **A chip the elect could not delete is re-offered** (`reminders.js` `sourcesFor`): with
    no GM connected the spend RECORDS the chip on the card and `continue`s (the player cannot
    write the monster), and the next swing lists the same Vex as live Advantage, spends it
    again, and so on until a GM connects. **Fix:** `sourcesFor` skips a chip whose id appears
    in any `chipSpend.spent[]` in the log (walk newest-first, bounded), so a recorded spend
    counts as spent whatever the document says.
14. **The re-issue pins the dialog-owned choices to their hook-time defaults** — attack mode
    (versatile one- vs two-handed), ammunition, and the mastery pick where a weapon has more
    than one — because `configure: false` skips the dialog that would have offered them.
    `dialog.options.attackModeOptions` / `ammunitionOptions` / `masteryOptions` are on the
    hook's `dialog` argument. **Fix:** when any has more than one entry, render a select for
    it in the gate's popup and pass the choice to the re-issue. Until then the remembered
    `last.<activity>` choice is used, silently — say so in the popup at minimum.
15. **`tools/verify-settings.mjs`'s REFERENCE table lacks `reminderList` and `conditionList`**,
    so a crashed `smoke-reminders` §6 (which sets them to `''` and `'blinded'`) leaves the gate
    off in the world with the settings check reading CLEAN. **Fix:** add both to the table
    with the shipped defaults (`vex, sap, prone, condition` and the thirteen) — the standing
    rule is that every registered key the user tunes is named there.

**Angle B (removed behaviour) reported last, and its first finding OUTRANKS EVERYTHING ABOVE:**

16. ⚠⚠ **`chipIsDead` kills a chip a whole turn early** (`decide/chips.js`, read by the gate's
    liveness filter AND the applier's sweep). A `{1 round}` chip's `remaining` reaches 0 at the
    START of the round its expiry falls in (the probe showed it: Vex `remaining: 0` at r2t0,
    `expired` only at r2t1), and `chipIsDead` reads `remaining <= 0` as dead. So on the
    attacker's next turn — the one attack Vex exists for — `sourcesFor` drops the source, the
    native dialog rolls flat, and the spend line then says "went unclaimed"; Sap on a bearer
    whose initiative precedes the attacker's fails the same way; and a chip applied in round
    R+1 sweeps a still-valid Slow off the sheet. **Neither suite advances a turn between
    applying a chip and gating a roll, which is why both are green.** **Fix:** dead = `expired`
    (the platform's mark), or a clock that never resolved (`remaining` null/NaN); `remaining
    <= 0` alone is ALIVE until the platform says otherwise — exactly what NOTES §1 records
    ("suppression keys off the flag, not the arithmetic"). Unit-test it, and add a section to
    `smoke-expiry` (it has the combat machinery) that applies Vex on the attacker's turn, steps
    to the attacker's next turn, and asserts the gate lists it.
17. ⚠ **Without a GM the Cleave chit is immortal** — Foundry's expiry mark is GM-side and both
    tidies are `isActiveGM`-gated, so on the v1.27 no-GM table the first Cleave chit stands
    forever and Cleave never reminds again. The old in-memory stamp re-reminded every turn.
    **Fix (also closes 3 and 18):** the chit's liveness is a STAMP COMPARISON — it lives only
    while `start.combat/round/turn` equal the running combat's current round and turn — the
    house once-per-turn idiom (`combatStamp`), with the platform's expiry as mere tidy. Pin the
    chit's `start` to the CURRENT turn (no combatant needed), which also makes an
    opportunity-attack chit die with the turn it was written in.
18. **An attacker in a running combat but not in the tracker gets a Cleave popup on every hit**
    (`activeCombatFor` returns null → no chit → every hit reminds; the old stamp keyed on
    `game.combat.started` alone). **Fix:** the chit's stamp reads `game.combat` when it is
    started, whether or not the attacker is a combatant.

**Angle A (line-by-line) reported last of all — it independently re-found 16, 12, 2 and 3,
and added two:**

19. ⚠ **Enter rolls Advantage whatever the net.** v14's `DialogV2` makes the FIRST button the
    default when none is flagged (`isDefault = default || (i === 0 && !buttons.some(b =>
    b.default))`), gives it autofocus, and every button is `type=submit` — so Enter, including
    Enter typed into the situational-bonus field, presses Advantage on a gate whose net is
    Disadvantage. `modeButtons(press)` with no default does not do what R-A meant. **This is a
    ruling for the user, not a silent fix:** a default is unavoidable on this platform; the
    honest options are (a) default = the NET (Enter presses the resolution the popup already
    names — still a press, and the highlighted button IS the resolution), or (b) a non-rolling
    first control so Enter rolls nothing. Recommend (a); ask.
20. **An attacker in a running combat but NOT in the tracker gets a chip judged against a
    stranger** (`mastery.js` `chipData`): `placeOf` is null, `chipData` writes `start: {time}`
    only, and `_preCreate` fills the rest from `getEffectStart()` — the combat and combatant of
    whoever's turn it IS — so a summon's Sap on a tracked goblin during the goblin's turn expires
    at the goblin's own next turnStart, before its next attack. **Fix:** when `game.combat` is
    started but the attacker has no combatant, write an explicit `start` with `combat: null,
    combatant: null` (time-based; the platform then judges it against the BEARER's combatant,
    which for Sap is the right creature).

**All eight angles have now reported. Verify, then fix, in the order above: 16 first.**

### The remaining sequence (the user's instruction, verbatim: review → refactor → battery → hand over)

1. Re-run finder angles A, B, C; verify every candidate (one verifier each, PLAUSIBLE by
   default); fold confirmed ones into the list above. Call `ReportFindings` once with the
   verified list, then again with outcomes after the fixes land.
2. Apply the fixes. Unit-test the pure ones (`chipHonoured` with sources, the geometry
   helper, the derived membership). `npm run verify`.
3. Deploy → bounce → `smoke-expiry`, `smoke-reminders`, `smoke-effects`, `smoke-concentration`.
4. Warn the user about their combat, then `node tools/battery.mjs` (≈25 min). Settings clean
   at the end (the battery runs `verify-settings` itself).
5. Commit in the house shape (`test:` / `feat:`|`fix:` / `docs:`); recut NOTES for the
   flat-key fact and anything the fixes teach; **retire this file** (the commission is
   delivered; the durable rulings already live in DESIGN §5 and §8).
6. Hand over for table testing with the open questions: (a) the double reminder — the Vexing
   hit's notice popup AND the gate at the next swing are both live; (b) `hiding` as a
   fourteenth condition (one row); (c) a release (`node tools/bump-version.mjs minor` →
   1.28.0, `tools/build-release.ps1`, prod deploy) — the user's call; (d) the MCP scan's
   `KEYS` gaining `chipSpend` and `reminder`.

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
| **R-D** | **The module reminds about what it applied.** Vex, Sap, Prone-from-Topple, the once-per-turn chits — the chips whose windows it knows with certainty. ⚠ **Guiding Bolt was an EXAMPLE of a class, not a request** (user, 2026-09-01): no spell-specific system is built for it or its kin. If the reminder mechanism ends up data-driven, a content buff is one list line later; if it does not, nothing is built. The general condition table (Stage 3) is recorded, not scheduled. | PROPOSED |
| **R-E** | **How the user is prompted.** | ⚠ **OPEN — the Stage 2 vetting walk** |

---

### STAGE 0 — probes ✅ MEASURED 2026-09-01 (`tools/probe-expiry.mjs`, Foundry 14.365 / dnd5e 5.3.3)

**The readings, in one place.** Three combatants (attacker first), chips applied on the
attacker's turn (r1t0): **sap-shape `{1, rounds, turnStart}` expired at r2t0** — the attacker's
next turn START; **vex-shape `{1, rounds, turnEnd}` at r2t1** — its END; **the 0-turn chit
`{0, turns, turnEnd}` at r1t1** — the end of the attacker's OWN turn; the 1-turn chit at r2t1,
the round longer the bundle promised. **Every expiry write arrived as `updateActiveEffect`
carrying `duration.expired: true`, made by the active GM's client.** An effect created without
an explicit `start` is stamped with whoever's turn it IS (an off-turn apply got the victim's
combatant — R-D's trap, confirmed). World time advances six seconds at every round boundary.
Out of combat a `rounds` chip reads back reframed as seconds and never expires without a
world-time tick (the plan's claim, confirmed) — and a first run from a client that had NOT
viewed the range measured a new trap by accident: `game.combat` is per-client, so an effect
created from another scene lands time-based and expires on the round's tick, not its event
(NOTES §1). **The hook surfaces for Stage 2 all fire on this page:** `dnd5e.preRollAttackV2`
(templated, with `preRollD20TestV2` beside it), `renderAttackRollConfigurationDialog` (and the
generic `renderApplicationV2`), `dnd5e.postAttackRollConfiguration` / `postRollConfiguration`.

Every one below was a measurement the plan leaned on; none writes anything a suite would not.

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
3. **Guiding Bolt — measured, then set aside.** A read-only probe (2026-09-01) found all three
   packs ship it as a content-authored effect on the target (the premium PHB: status `marked`,
   `{value: 1, units: "turns", expiry: "turnStart"}`, which reads `remaining: null` out of
   combat — the system's own unresolvable-clock shape, not ours to fix). Kept only as evidence
   that content buffs are effects the module could one day recognise from data; **nothing in
   this commission is built for it** (R-D).
4. **Where mastery chips are tested today.** `smoke-effects` (§3b Sap; Vex/Slow beside it).
   Stage 1's assertions land there unless combat-stepping makes it unwieldy, in which case a
   `smoke-expiry` suite joins the battery front door.

### STAGE 1 — expiry ✅ DELIVERED 2026-09-01

**What shipped, and where.** The DECISION half is [decide/chips.js](scripts/decide/chips.js) —
`CHIP_WINDOWS` (the RAW windows as v14 data, frozen), `chipClock` (the window plus the
attacker's place in the order), `chipIsDead`, `chipSpentBy`, `rollModeOf`, `spendRecord` —
pinned by 21 unit assertions ([tests/decide-chips.test.js](tests/decide-chips.test.js)). The
EDGE half is in [mastery.js](scripts/mastery.js): `placeOf`/`chipData` feed the chip applier (the
v12 `{rounds, startRound}` write is gone), `spendChips` on `createChatMessage` records the
spend on the attack card FIRST (the `chipSpend` flag, rendered as a "— spent" line with the
mode the roll went out at) and deletes second, `cleaveChitStands` replaced the in-memory
`cleaveNoticed` Map, the `updateActiveEffect` tidy deletes what Foundry marked, and
`deleteCombat` sweeps. [tools/smoke-expiry.mjs](tools/smoke-expiry.mjs) — nine sections, 35
assertions, a real Combat stepped through five rounds — joined the battery directly after
`smoke-effects`. Docs: DESIGN §8's row closed by its own condition, DESIGN §5 *"the platform
keeps the clock"*, ARCHITECTURE §4's state table, NOTES §1's v14 clock entry, the mastery.js
fence restated per R-A. The plan below is kept as written, for the record.

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

**Check-in:** Stage 0 and Stage 1 were run autonomously at the user's instruction (2026-09-01,
*"complete stage 0 and 1 autonomously"*); the battery on the delivered code is the evidence.

### STAGE 2 — the reminder (⚠ GATED on the vetting walk — nothing built before it)

**What must be vetted with the user: how the user is prompted.** Three sources, and each has a
different SUBJECT — that is why one shape will not fit all of them:

| Source | Where the chip sits | Who is reminded | The moment |
| --- | --- | --- | --- |
| **Vex** | on the TARGET | the ATTACKER who applied it | their next attack on that target |
| **Sap** | on the SAPPED creature | whoever ROLLS for it — usually the GM | its next attack roll, at disadvantage |
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

**Recommendation to bring to the walk, not a ruling:** A + D; B if the table wants
the reminder earlier than the dialog; C only if the walk rejects rolled-then-fixed outright.
Every reminder is a NOTICE or a RESCUE — never a decoration — so R-A holds whichever is picked.

**Shape once picked (§11 "Adding a moment"):** compose the spine; the roller's client owns it
(`canAnswerFor` the attacker for Vex; the sapped creature's owner or the GM for Sap); name the
answer channels, the expiry default (a reminder's default is *dismissed*, a rescue's is
*pass*), the receipt. One new kind — `reminder`, or a rescue kind `advantage` — bumps
`EXPECTED_KINDS` (19 today) with the reason in the commit. If the mechanism reads its sources
from a list (R4), that list is the one door left open for content buffs later — one line, no
code — and it is not built here. Every reminder spreads `statContext` like every moment; the
MCP's flip credit already reads folds.

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
6. **Somebody else's effect is somebody else's contract.** A content-authored effect is the
   system's — never rewrite its duration. A durationless chip stays untouched (the apply-time
   sweep's rule).
7. **Templated hook names** — pin them and assert they FIRED (D10, D11). `preRollAttackV2` is
   invisible to both of the dispatch check's sources.
8. **The dialog banner is presentation on a system dialog.** A public render hook adds a block;
   it never rewrites the system's own controls (R3 — no patching).
9. **The disadvantage rescue's revert obligation** (Stage 2) — do not let it ship without.

### What this commission deliberately does NOT do

- **No automatic advantage or disadvantage. Ever.** (User.)
- **No spell-specific systems.** Guiding Bolt was an example of a class, not a request
  (user, 2026-09-01). The mechanism is vetted on the module's own chips.
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
