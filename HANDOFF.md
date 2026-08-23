# HANDOFF.md — picking this up cold

> **What this file is:** continuity only — current state, the standing directive, and the
> verified work list. The permanent docs are [DESIGN.md](DESIGN.md) (north stars),
> [ARCHITECTURE.md](ARCHITECTURE.md) (the shape) and [NOTES.md](NOTES.md) (what it cost);
> [PLAN.md](PLAN.md) is the temporary stabilization tracker. **This file does not duplicate
> them.** It was deliberately not restored to its old 2,700-line form.

## State at a glance — 2026-08-22

| | |
| --- | --- |
| **Do first** | 📋 **Nothing is open; everything is pushed and battery-green.** Phase 2 is CLOSED except the flag accessor layer, and Phase 4's D1 and D3 are done. **Start at the NEXT section** — it opens with the one item that is a decision rather than a step. |
| Repo | `main` @ `c256f3b`, clean tree, **pushed**. The 2026-08-22 session in order: correctness pass (`a2557ea`…`fef05c7`) · Phase 2 stages 1–4 (`c30f2a8`, `11bca56`, `c53500a`, `063c905`) · `cf61afb` orphaned doc comments + `check-comments` · **`04304b5` stage 5 receipt arithmetic · `8541a8e` stage 6 presentation formatters · `1c0618b` the gate's import checks · `e953546` the duplicate census + ARCHITECTURE D5/D7 · `53495e4` D3 closed · `c256f3b` D1**. |
| Release | ⚠ **v1.20.0 is the last TAG, and the entire refactor is UNRELEASED.** `module.json` still reads `1.20.0` while **25+ commits** sit on top of that tag — the correctness pass, all six Phase 2 stages, the duplicate census, D3 and D1. **Prod runs the pre-refactor code.** ⚠⚠ **Sandbox and prod therefore both report `1.20.0` with DIFFERENT code, and nothing in the UI distinguishes them** — and because the version string never changed, a browser serves cached `?v=1.20.0` scripts, so **hard-refresh or you are testing the old code while believing you are testing the new**. Cutting the release is a user decision and has not been taken. |
| **Parity** | ✅ **PROVEN at `46b4580`, 2026-08-23** — the full battery, every suite at or above baseline, on the sandbox carrying HEAD's `scripts/` byte-identical. battleflow ALL PASS ×2 · hold ALL PASS · playerdmg 12/12 · saves 61/61 · volleys **38/39 first run → 39/39 ×2** (the documented variance class; the first-run output was captured before re-running, per the stage-5 lesson) · maneuvers 54/54 · cast 17/17 · riders 8/8 · concentration 47/47 · effects 54/54 (after `reset-fixture-state`) · resources 18/18 · savedmg 13/13 · `verify-settings` **CLEAN** before and after. **The refactor cost no features.** |
| Walk | ✅ **v1.20.0 walk CLOSED** — fifteen items + T1–T5. Zero open findings from the table. |
| Sandbox | ⚠ **HEADLESS, and LEFT RUNNING** (world active, 0 users) — `status` first, `stop` if not testing. `node <mcp>/scripts/local-foundry.mjs start/stop/status/restart`. Never the Electron app for suites (dataPath lock). **Verify status at session start.** |
| Bridge | Disconnect before any suite. Suites join as `Tester Assistant`. |
| Verify gate | `npm run verify` — **SIX static checks**: biome (98 warnings, 0 errors: **that is the baseline**), knip, imports (**256 bindings**), hook order (**75 registrations**, 9 pairs), registry 9/9, comments (286 blocks / 27 files), then vitest **170** (~270 ms). Green at handoff. |
| Suite order | ⚠ **battleflow → hold**, and **battleflow → playerdmg**, back to back. Other suites in between strip the fixture tokens and hold refuses. `reset-fixture-state` before effects. |

---

## ▶ NEXT — the recommended order, and why

**The loop that worked four times running, use it again:** read the target code → move it
(never rewrite) → write the unit tests → `npm run verify` → deploy `--local` → **restart
headless** (the script-cache discipline: a redeploy without a version bump serves the suites
stale code) → run the affected suites → one commit per stage.

Phase 2's extractions are **done** (six stages, six green batteries), and Phase 4's **D1 and
D3 are closed**. Everything below is a scoping decision rather than a next step — the cheap,
mechanical work is finished, and what remains changes shape.

| # | Work | Why this position, and what it really costs |
| --- | --- | --- |
| 1 | **D6 — break the `ui.js` ↔ `hold.js` cycle** | ⚠ **It does NOT fall out of D1, contrary to PLAN.md — measured 2026-08-22, with D1 done and the cycle still standing.** `ui.js` holds **~400 of its 697 lines** as the hold's OWN views: the card row, the popup, `reactionImg`, `reactionACBonus`, the hold clocks — plus a `renderChatMessage` and a `deleteChatMessage` registration. Breaking it means relocating those into hold.js, which **moves two hook registrations between files** and rewrites the pinned assertion `ui.js before mastery.js` in `tools/check-hook-order.mjs`. Entry order helps: hold.js is imported at [battleflow.js:91](scripts/battleflow.js:91), *before* ui.js at :92, so the hold row would register EARLIER and still land above mastery's. **Its own stage, its own battery, and the hold is the most-used feature at the table.** |
| 2 | **The flag accessor layer** → `state/flags.js` | ⚠ **Re-measured: 38 keys, ~230 reads, ~66 writes, ~300 call sites.** ⚠ **Its correctness half is ALREADY DONE** — D3 (`53495e4`) converted the eight per-target read-modify-writes directly, without the layer, which is why what is left is the ~230 READS: wide mechanical tidiness that buys nothing a test can assert. ⚠ "Inventory now, adopt later" is not available: an unimported module in `scripts/` is dead code to knip. **Recommend deferring or dropping this** — the argument that justified it has been paid another way. |
| 3 | **The §4.1 relay** — three folds, three envelope keys, one shape | Consolidating removes two `createChatMessage` registrations from the pinned hook order — the one extraction with an architectural payoff rather than a line-count one. ⚠ **hold's folder has a different OWNER** (the continuing client; the other two are the elect), exactly like its clock. Unify the envelope, keep ownership pluggable. |
| 4 | **`auto-apply.js` ↔ `mastery.js`** | Breakable only by moving `applyDamagesWithReceipt` to a third module — the damage chokepoint every machine routes through, and the thing HANDOFF has always said to touch last. Low value, real risk. |
| 5 | **`hold.js` ↔ `auto-damage.js`** | ⚠ **DO NOT "FIX".** The bare `import "./auto-damage.js"` is load-bearing: it pins evaluation order, its comment says so, and check-hook-order depends on it. |

## 📦 Phase 4 — D1 and D3, ✅ DONE 2026-08-22, both battery-green

`53495e4` **D3** · `c256f3b` **D1**. Neither needed the flag accessor layer, which is the
finding that reshapes what is left.

**D1 — the shared services left hold.js.** `canAnswerFor`, `isContinuingClient`,
`inRunningCombat` → [core.js](scripts/core.js), beside `isActiveGM` and `rollerUserFor`: one
§3 "who does what" family. `interruptEntries`/`blockEntries` → [settings.js](scripts/settings.js),
because they are EDGE reads of a world setting whose parsers already live in `decide/registry.js`
— and polish.js importing a *feature* to ask what the interrupt list said was the clearest
illustration of the whole debt. **Importers of hold.js: 7 → 2**, and the two left are
legitimate (auto-damage calls `stampHoldIfInterrupted`; ui.js draws the views). Zero new import
edges for the core.js moves.

**D3 — eight per-target writes reached the serializer.** hold's answer fold and its two
effectReceipt merges; mastery's chip applier (whose read sat above an await loop, the same
defect effect-riders.js already had) and its four topple sites. Every one repeats its guard
INSIDE the lock, and returns `false` when there is nothing to record so a no-op never churns
a render. ⚠ **The sharpest was hold's fold**: two answers landing in one tick both cloned the
same stale flag and the second write dropped the first player's answer — and "one casting
answers many holds" is a shipped, tested feature.

⚠ **Two things the D3 conversion itself nearly broke, both caught by reading the diff, not by
any check.** Converting clone-mutate-write into a callback silently changes what the local
clone means:
- `foldToppleSave` disarmed its clock with `flag.targets.every(t => t.done)` on the clone it
  used to mutate. Once the mutation moved inside the serializer, that clone still read the
  target as pending — the clock would never have been disarmed. It re-reads now.
- the same fold announced its verdict unconditionally; with the claim made inside the lock, a
  losing racer would still have announced. A `claimed` flag gates it.
**If you convert another site, check every later use of the old local variable.**

---

⚠ **D2 stays LAST and behind its own walk**, and its clock must not be unified at all (see the
§10 corrections below).

### ✅ THE EXIT CONDITION — ASKED AND ANSWERED 2026-08-23

The directive is architecture that can **carry** Heroic Inspiration, Bard, Tactical Mind and
AC5e. The honest test was never "are more refactors available" — they always are. It was
**does the seam actually carry the thing it was built for?** Heroic Inspiration was scoped
against the layers to find out.

**The answer is YES, and the module already ships a member of the family.** Precision Attack
([maneuvers.js](scripts/maneuvers.js) `resolvePrecision`) is the working template for every
one of the three surveyed d20 features:

1. `activity.use()` — the system consumes the resource.
2. the new die posts as **its own public message**, stamped `respondsTo` (the §4.1 relay).
3. the module recomputes the verdict **on a module flag** — the original `Roll` is never
   touched — and announces the arithmetic in the open (*"14 + 6 = 20 vs AC 18 — now hits"*).
4. `hitTargets` re-reads the new verdict and re-drives the chain.

Heroic Inspiration is that shape with `replace` where precision has `add`; Tactical Mind is
that shape with a check where precision has an attack; Bardic Inspiration is that shape with a
different die and a different spender. **One kind, three features, one already shipping.**

⚠⚠ **A REFUTED READING, recorded so it is not re-derived.** This scoping first concluded that
all three were **out of scope** under DESIGN §4's *"Modifying a d20 roll"* row. **That was
wrong**, and the user caught it by pointing at Precision Attack. The row forbids reaching into
an evaluated `Roll` and rewriting its number; it does **not** forbid changing an outcome — the
operative word in its own text is *folds*. Precision turns misses into hits and has shipped
since v1.19.0, and [decide/verdict.js](scripts/decide/verdict.js) documents the pattern by
name. **DESIGN §4's row has been reworded** so the next reader does not repeat the mistake.
Three further blockers claimed in the same pass also fell: the "no mechanic to trigger" one
(writing `system.attributes.inspiration` is exactly what the system's own sheet button does),
the "no compendium text to quote" one (it exists — see ruling 3), and the "no post-roll seam"
one (the module never needed to pause before the table sees the roll; precision stamps the
message that already exists).

**What the exercise actually bought is D8** — the fold is a KIND coded as one feature's special
case. See ARCHITECTURE §10. That, not another cycle break, is what the surveyed features cost
if they arrive one at a time.

---

## The standing directive (user, 2026-08-22)

**Correctness and architecture only. No new features, and no feature work considered.**

The architecture must be able to carry the surveyed features later — Heroic Inspiration,
Bard, Tactical Mind, AC5e adoption. Those are **design pressure and nothing else**: use them
to test whether a seam is right, never as a reason to build one.

---

## 📦 Phase 2, stages 1–6 — ✅ DONE 2026-08-22, all six battery-green

`c30f2a8` geometry · `11bca56` parsers · `c53500a` verdicts · `063c905` eligibility ·
`04304b5` receipt arithmetic · `8541a8e` presentation formatters. Every stage:
move-don't-rewrite, unit tests added, static gate + live battery, own commit.
**Unit tests 13 → 170**, still under 300ms with no Foundry.

⚠ **STAGE 6 IS THE CAUTIONARY ONE — read it before the next move.** It broke two files and
**the entire static gate passed both times**, costing a deploy + restart + suite run each:
ui.js kept CALLING `bfCard`/`popupKey`/`holdBarHTML` after they moved out (smoke-hold: *"the
hold popup rendered no Cast button"*), and auto-damage.js kept IMPORTING `popupKey` from ui.js
through the lazy `const {…} = await import()` idiom after ui.js stopped exporting it
(playerdmg: *"popupKey is not a function"*). The gate now covers both (`1c0618b`) — but the
lesson generalises past the fix: **moving a name between files is exactly as dangerous as
changing it, and this codebase's fire-and-forget hook handlers swallow the evidence.**

**Stage 5's battery (2026-08-22, after deploy `--local` 27/27 byte-identical + headless
restart), every suite at or above baseline:** battleflow ALL PASS ×5 · hold ALL PASS ×2 ·
saves 61/61 · volleys 39/39 · maneuvers 54/54 · cast 17/17 · riders 8/8 · concentration 47/47 ·
effects 54/54 (first run, no re-run needed) · resources 18/18 · playerdmg 12/12 ·
savedmg 13/13 · `verify-settings` **CLEAN**.
⚠ **One loose end, recorded honestly:** one battleflow run mid-battery reported **2 failures**
and the assertions were not captured. It did **not** reproduce — not in a deliberate
battleflow → hold → battleflow repro, nor in four other runs. Shape matches the late-teardown
class NOTES §5 documents. If it recurs, capture the full output *first*; that is the whole
lesson from this one.

**Stage 6's battery (2026-08-22, after the fix, deploy + restart):** battleflow ALL PASS ×3 ·
hold ALL PASS · saves 61/61 · volleys 39/39 · maneuvers 54/54 · cast 17/17 · riders 8/8 ·
concentration 47/47 · effects 54/54 · resources 18/18 · playerdmg 12/12 · savedmg 13/13.
⚠ `verify-settings` found **FOUR drifted** (autoApply, reactionHold, riders, masteryRiders all
false) and `--fix` restored them. That is the laundering NOTES §5 documents, seen for real: the
hold suite **crashed with its pins in place**, and a later green run snapshotted those pins as
the "prior" it faithfully restored. Only the external reference table can catch it. **Run it
after every battery, and especially after any crashed run.**

**`scripts/decide/` has ZERO imports** across all six modules — not core.js, not a machine,
not the spine. The layer is dependency-free by construction, which is what makes it testable
in milliseconds and impossible to tangle. **Keep it that way**: the day something in there
needs `game` or `canvas`, it is EDGE and belongs one layer up (§2 rule 1).

| Module | Holds |
| --- | --- |
| [decide/geometry.js](scripts/decide/geometry.js) | `honestDims`, `tokenCenter`, `tokenSamplePoints` — the v14 region-shim knowledge |
| [decide/registry.js](scripts/decide/registry.js) | the five world-setting list parsers |
| [decide/verdict.js](scripts/decide/verdict.js) | `hitsAmong`, `modeAdmits`, `saveOutcome`, `saveMultiplier`, `verdictText` |
| [decide/eligible.js](scripts/decide/eligible.js) | `isDeadForSaves`, `limitedUses`, `isReactionItem`, `castLevelOf`, `clampVolleyCount`, `riderKey` |
| [decide/receipt.js](scripts/decide/receipt.js) | `traitOutcome`, `traitReasons`, `hpDelta`, `receiptEntry`, `joinDamageReceipt`, `joinEffectReceipt`, `takenOf`, `receiptAmounts`, `traitPhrase`, `revertPlan`, `revertableEffect` |
| [decide/present.js](scripts/decide/present.js) | `popupKey`, `TONE`, `bfCard`, `ruleLine`, `momentBarHTML`, `holdBarHTML`, `CASCADE_STEP`, `nextCascadeSlot`, `cascadePosition`, `eldersDeepestFirst` |
| [geometry.js](scripts/geometry.js) | EDGE: `tokensInTemplates`, `templateShape` (needs canvas/CONFIG/PIXI) |

**Two things learned that the next stage should carry:**
- ✅ **Orphaned doc comments — found, fixed, and now MECHANICALLY PREVENTED.** A sweep found
  **eight**: three predating the refactor (functions reordered, docs left behind) and **five
  created by these very extractions** — moving a function out stranded its doc above whatever
  came next. Two of those five had cost real knowledge: the hobgoblin-shield story behind
  `isReactionItem` and the warning that the save-side dead gate is deliberately *not*
  mastery's predicate. Both restored into the new modules. All eight fixed;
  **`tools/check-comments.mjs` is in the verify gate** (`npm run comments`) and the rule is
  ARCHITECTURE.md §11's "Moving code between files" checklist. Cut on function boundaries,
  never comment boundaries.
- ⚠ **PLAN.md's eligibility bullet promises more than exists.** `usableReaction`,
  `ridersAgainst` and mastery eligibility are all document-bound and CANNOT be extracted;
  only the arithmetic beneath them came out. Recorded in that module's header so nobody
  re-attempts it.

**What stage 5 added to that, and the next stage should carry:**
- ✅ **A drifted duplicate, found by extracting rather than by reading.** The taken-vs-delta
  fallback existed twice — [receipts.js](scripts/receipts.js) read `t.delta.value`, mastery
  read `entry.delta?.value` — and nobody would have noticed until an entry arrived without a
  delta. Unifying on the tolerant form changes nothing live. **The extractions are finding
  these; that is a reason to keep going, not a bonus.**
- ⚠ **A shared service left a feature file for free.** `joinEffectReceipt` was pure and lived
  in effect-riders.js, imported by hold.js and mastery.js. Pure shared services can be moved
  DOWN a layer without any of D1's risk — worth scanning for more before the structural step.
- ⚠ **NOT taken, and deliberately: `dnd5e.dice.aggregateDamageRolls(rolls, {respectProperties:
  true}).map(...)` is copied VERBATIM in four files** —
  [auto-apply.js:91](scripts/auto-apply.js:91), [cast.js:74](scripts/cast.js:74),
  [hold.js:937](scripts/hold.js:937), [saves.js:1078](scripts/saves.js:1078). It is
  damage-part normalisation, not receipt arithmetic, and the aggregate call is EDGE — so it
  wants a helper in `shared.js`, not a decide module. Four copies is the most-duplicated block
  left in the tree.
- ⚠ **The words moved with the numbers, on purpose.** `receiptAmounts` returns the row's text
  as well as its figures, because the two bugs that reached the table there were both a right
  number in the wrong sentence (the double-negative heal, the temp grant in damage maroon).
  Only the colours stayed at the EDGE. **The next stage should not "tidy" those strings back
  into the view.**

## 🔁 The duplicate census — ✅ COLLECTED 2026-08-22 (`e953546`)

A cross-file scan for repeated code (3+ identical normalised lines) after stage 5 found four
clusters. Three were folded into shared helpers; **nine copies became three functions.**

| Was | Now | Note |
| --- | --- | --- |
| ×4 `aggregateDamageRolls(...).map(...)` | `damagePartsOf(rolls)` in [shared.js](scripts/shared.js) | was the most-copied block in the tree |
| ×3 the roll-override builder | `rollConfigFor(mode, bonus)` in [shared.js](scripts/shared.js) | ⚠ **still byte-identical when found — the pre-drift state.** Nine lines in three machines, each about to be edited independently. The receipt arithmetic (stage 5) was caught one step later, already spelled two ways. **This is the argument for running the census again.** |
| ×2 the owner election | `rollerUserFor(actor)` in [core.js](scripts/core.js) | saves.js's copy carried the comment *"the concentration election"* — a duplicate announcing itself |
| ×2 the adv/normal/disadv dialog rows | *left* | built around live callbacks, not a string formatter |

All three landed at EDGE, not in `decide/`: one calls dnd5e's aggregator, one validates a
formula and warns a human, one reads `game.users`. Their pure cores are a three-branch table
and a map — too small to be worth an import into `decide/`.

**Re-run the scan after the next structural stage.** It is a ~20-line script over
`scripts/**`, and it has now paid twice.

**The remaining Phase 2 list:** only the flag accessor layer's ~230 READS — and D3 having been
closed without it (`53495e4`) removes the argument that justified it. See the NEXT table.

---

## Design rulings — binding, made this session

**1. Action economy is not the module's job.** Reactions, actions and bonus actions are
tracked by the humans at the table. Automating them is over-engineering, by the user's
explicit call. **The code already agrees** and the naming misleads: every read of
`reactionSpent` is an *offer gate*, never enforcement —
[hold.js:192](scripts/hold.js:192) and [hold.js:456](scripts/hold.js:456) skip stamping,
[maneuvers.js:406](scripts/maneuvers.js:406) skips adding a reactor,
[saves.js:862](scripts/saves.js:862) declines to offer interpose. Nothing anywhere blocks a
cast or refuses an action. [hold.js:256](scripts/hold.js:256) names it correctly: **the
click-volume guard**. Read it as "don't nag this actor again this turn," not as a resource.

**2. Consequently there is no reaction-budget abstraction, and none is wanted.** A proposal
for one was raised and **rejected**. Do not reintroduce it.

**3. The only genuinely new mechanic across everything surveyed is un-spending a use** —
Tactical Mind refunds its Second Wind use when the boosted check still fails. That is
`uses.spent` arithmetic against dnd5e's own resource machinery, not module-owned state.
✅ **Verified 2026-08-23 against the world's own compendium** (`phbftrTacticalMi`): it ships a
real `utility` activity consuming `itemUses` against Second Wind with a `1d10` roll formula —
so the *spend* is `activity.use()`, and only the **refund** is unmodelled. The ruling holds.

⚠ **Its last sentence was wrong about ONE resource, corrected 2026-08-23.** Bardic dice,
slots and Second Wind are indeed spent through `activity.use()`. **Heroic Inspiration is not
— it has no activity at all.** dnd5e 5.3.3 models it as a bare `BooleanField`
([character.mjs:80](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/data/actor/character.mjs:80),
`character` only, not NPCs) plus a sheet toggle
([character-sheet.mjs:1072](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/applications/actor/character-sheet.mjs:1072)).
No activity, no uses, no consumption route (consumption is
`activityUses·itemUses·material·hitDice·spellSlots·attribute`, and a boolean is not numeric),
and no reroll or transfer code anywhere in the system. Spending it means writing the boolean —
which is exactly what the system's own sheet button does, so it is **not** a reimplemented
mechanic. Its rules text does exist and is quotable (presentation law 8 is satisfiable):
`dnd5e.content24` → *Appendix D: Rule References* → page `nkEPI89CiQnOaLYh` —
*"you can expend it to reroll any die immediately after rolling it, and you must use the new
roll… if you already have it, it's lost unless you give it to a player character who lacks
it."* ⚠ Note "any die" reaches damage too, and the transfer clause is a second unmodelled half.

---

## 📦 The correctness pass — ✅ BUILT, COMMITTED AND BATTERY-GREEN (2026-08-22)

Commits `a2557ea` (fix + the unit test) and `853f1a6` (docs). Pushed.

**Static gate:** `npm run verify` exit 0 — biome 99 warnings (the recorded baseline, no new
ones), knip clean, **75 registrations** (+1: the volleys sweep), all 9 hook pairs PASS,
registry 9/9, vitest **20/20** (13 + 7 new).

**Live battery on the headless sandbox, every suite at or above baseline, ONE documented
flake (deploy 21/21 byte-identical → headless restart → run, the script-cache discipline):**
battleflow ALL PASS ×3 · hold ALL PASS · **saves 61/61** · **volleys 39/39** · maneuvers
54/54 · cast 17/17 · riders 8/8 · concentration 47/47 · **effects 54/54** · resources 18/18 ·
playerdmg 12/12 · savedmg 13/13 · `verify-settings` **CLEAN**.

⚠ **The two items that most needed live proof both got it.** saves §10d2/§10f (the
containment refresh — two demands owning one area, the bug this rewrite could have
reintroduced), 13a–13c (the sweep and the fossil wall) and 15d (the legendary-resistance
flip) all pass; volleys §5 (expiry) covers the render-resume gate.

⚠ **Traps that fired, both documented, both cost minutes rather than an hour:** smoke-hold
refused with *"BF Test Victim has no token — run smoke-battleflow.mjs first"* after other
suites ran in between (battleflow → hold, then battleflow → playerdmg, is the order that
works); and smoke-effects went 44/45 on its first run and **54/54 on the re-run** — the
dice-variance class the notes name. Re-run before diagnosing.

**What landed, by item:**

1. ✅ **The ceiling.** `DEADLINE_CEILING_MS` (600 000) + `deadlineIsLive` in
   [core.js](scripts/core.js); [armDeadline](scripts/ui.js:345) refuses a deadline past it.
   One chokepoint covers **six** arm sites, not the five armAskTimer ones — riposte, topple,
   save-choice, hold and volley clocks all route through it.
   ⚠ **New finding, found while building:** [volleys.js](scripts/volleys.js) fired the default
   spread **directly** on render-resume, bypassing `armDeadline` entirely, so the primitive's
   guard could not see it. Gated separately, with the reasoning in-line.
   ⚠ **Rejected design, recorded so it isn't retried:** a session-start epoch. It is
   per-CLIENT, so an F5'd player's own reload would read every still-live deadline as another
   session's history and refuse it — killing the volley resume the design specifies.
2. ✅ **`queueFlagWrite` migration finished in saves.js** — 12 serialized writes, and the one
   remaining bare `setFlag` on the `saves` key ([saves.js:182](scripts/saves.js:182)) is the
   **initial stamp**, not a read-modify-write, so it stays. Converted: the `applied` claim
   (the measured double-application site), the answer fold, the containment refresh, the
   legendary-resistance flip, and the buzzer's "gone" pass.
   ⚠ **`queueFlagWrite` gained an opt-out** ([core.js](scripts/core.js)): `mutate` returning
   `false` skips the write. This is **loop protection, not tidiness** — the containment
   refresh is driven from the render hook, where an unconditional write is write → render →
   write without end. Existing callers return `undefined` and are unaffected.
3. ✅ **volleys delete sweep** — [volleys.js](scripts/volleys.js) now disarms `volleyTimers`
   on `deleteChatMessage`, like every other timer-owning machine.
4. ✅ **The [maneuvers.js:406](scripts/maneuvers.js:406) comment** — the "one reaction per
   round" budget language is gone, replaced by what the flag actually is.
5. ✅ **ARCHITECTURE.md §10** — D2, D3 and D6 corrected in place (see below).


---

## Correctness list — the record of what was found, verified at `b82ab8e`

**1. Resume horizon has a floor and no ceiling.** [ui.js:350](scripts/ui.js:350) arms with
`Math.max(0, deadline - Date.now())`. A card left `status: "pending"` across a world reload
fires its buzzer *immediately* on the elect's next render, however old the deadline is.
✅ **Fixed** by the absolute staleness ceiling above — **not** by the session epoch this line
originally prescribed, which is per-client and would have killed the F5 resume.

**Exposure, measured — two of the five buzzers roll dice with no human in the loop:**

| `armAskTimer` site | On expiry | Risk |
| --- | --- | --- |
| [saves.js:1348](scripts/saves.js:1348) → `fireSaveTimer` | `rollSaveAnswer(..., {timedOut:true})` ([saves.js:1377](scripts/saves.js:1377)) | ⚠ **rolls saves** |
| [concentration.js:450](scripts/concentration.js:450) → `fireConcTimer` | `rollConcentrationAnswer(..., {timedOut:true})` ([concentration.js:465](scripts/concentration.js:465)) | ⚠ **rolls the con save** |
| [maneuvers.js:215](scripts/maneuvers.js:215) precision | `answerPrecision(live, "pass")` | passes — noise only |
| [maneuvers.js:938](scripts/maneuvers.js:938) bash offer | `answerBashOffer(live, "pass")` | passes — noise only |
| [mastery.js:896](scripts/mastery.js:896) mastery ask | `answerMastery(live, "pass")` | passes — noise only |

A months-old combat rolling saves on the elect's next render is a straight violation of
humans-decide. The three passers are harmless if late; fix the ceiling once, centrally.

⚠ **Do not confuse two different quantities.** The five `20_000` literals
([concentration.js:528](scripts/concentration.js:528),
[maneuvers.js:1072](scripts/maneuvers.js:1072), [maneuvers.js:1122](scripts/maneuvers.js:1122),
[maneuvers.js:1163](scripts/maneuvers.js:1163), [mastery.js:1041](scripts/mastery.js:1041))
are resume-**staleness** thresholds on the *resume* paths, not deadline floors on the buzzer
paths. Those resume paths are guarded by a human's prior answer (`p.answer === "use"`,
`t.answeredAt`) and are **not** part of this defect — [maneuvers.js:1068](scripts/maneuvers.js:1068)
carries a comment explaining why they cannot double-run. Folding both into one clock contract
without accounting for the difference would break the resume behaviour.

**2. `queueFlagWrite` migration is unfinished, including in a file believed clean.**
Call sites at HEAD (`queueFlagWrite` / `.setFlag`, **excluding** the import line and comment
mentions): hold 0/12, mastery 0/9, concentration 0/3, **saves 7/8**, **maneuvers 6/7**,
volleys 1/2. saves.js holds five bare read-modify-writes on the same `saves` key —
[515](scripts/saves.js:515), [753](scripts/saves.js:753), [1145](scripts/saves.js:1145),
[1301](scripts/saves.js:1301), [1372](scripts/saves.js:1372). **Start at 1145**: it is a
`deepClone` → mutate → `setFlag` sitting directly after the concurrent per-target consequence
pass — the site of the measured double-application.

**3. `volleys.js` registers no `deleteChatMessage` sweep.** It owns `volleyTimers`
([volleys.js:56](scripts/volleys.js:56)) and disarms only on fire. Every other timer-owning
machine registers the sweep ([concentration.js:510](scripts/concentration.js:510),
[maneuvers.js:1206](scripts/maneuvers.js:1206), [mastery.js:886](scripts/mastery.js:886),
[saves.js:1488](scripts/saves.js:1488), [ui.js:770](scripts/ui.js:770)). Small.

**4. Double-offer on a Multiattack — a judgment call, not a bug.** Two misses against the
same actor stamp two offers before either resolves; both pass the gate at
[maneuvers.js:406](scripts/maneuvers.js:406) and neither resolve path re-reads it. Under
ruling 1 this is **not** a rules violation — the module never enforced the rule, so it cannot
break it. The real cost is that the click-volume guard fails in the highest-volume case.
Dedupe the offer per actor, or accept it. **Do not architect it.**

**5. Fix the comment at [maneuvers.js:406](scripts/maneuvers.js:406).** It reads
`// one reaction per round` — budget language sitting on a click-volume gate. Two mental
models on one flag is what made a careful reviewer diagnose a rules bug that does not exist
(it cost a full audit round). Free to fix next time anyone is in that file; worth doing
because the next reader makes the same mistake otherwise.

---

## ARCHITECTURE.md §10 corrections — ✅ APPLIED 2026-08-22

⚠ **Historical, and PARTLY SUPERSEDED.** §10 was rewritten again later the same day: **D1** is
now half-repaid, **D3** closed, **D5** largely repaid, **D6** carries the measurement that it
does *not* fall out of D1, and **D7** is closed. Read §10 itself for the current state; this
section is kept for the D2 evidence, which still stands and is still the reason D2 is last.

- **D2 is wrong as written.** It claims hold.js "uses **none** of the moment spine" with
  "zero uses" of five primitives. hold.js imports and uses **six** spine exports
  ([hold.js:10](scripts/hold.js:10)): `bfCard` ×6, `reactionImg` ×4, `armHoldTimer` ×3,
  `disarmHoldTimer` ×3, `reactionACBonus` ×3, `closeAnsweredPopups` ×2. Accurate statement:
  *hold.js uses the spine's card and reaction helpers but none of its popup/clock/bar
  primitives.* ⚠ `armAskTimer` is a **deliberate** exclusion, documented at
  [ui.js:360](scripts/ui.js:360) — the hold's clock is owned by the continuing client, not
  the elect. Moving it would silently change clock ownership on the most-used feature at the
  table. Do not "fix" it.
- **D3 is incomplete, not wrong.** Its named offenders are right; it misses that saves.js is
  *mixed* — see correctness item 2.
- **D6 names one cycle that isn't and misses two that are.** Verified by reading every
  `^import` in the machine files:

  | Claimed / found | Verdict |
  | --- | --- |
  | `ui.js` ↔ `hold.js` | ✅ real — [ui.js:8](scripts/ui.js:8) / [hold.js:10](scripts/hold.js:10) |
  | `mastery.js` ↔ `concentration.js` | ❌ **not a cycle** — [mastery.js:14](scripts/mastery.js:14) imports concentration one way; concentration imports only core, hold, ui |
  | `hold.js` ↔ `auto-damage.js` | ⚠ **real, and missing from D6** — [auto-damage.js:7](scripts/auto-damage.js:7) / [hold.js:9](scripts/hold.js:9) |
  | `auto-apply.js` ↔ `mastery.js` | ⚠ **real, and missing from D6** — [auto-apply.js:8](scripts/auto-apply.js:8) / [mastery.js:12](scripts/mastery.js:12) |

  ⚠ **The grep trap:** [hold.js:9](scripts/hold.js:9) is a bare `import "./auto-damage.js"`
  with no bindings, so any search for `from "./auto-damage.js"` misses it. The import is
  load-bearing — it pins evaluation order — and its comment says so.
  **Fix D6 before it drives work**, or someone spends a day breaking a cycle that does not
  exist while two real ones stand.

---

## Architecture work — the shape, not the features

> **The test every extraction here has to pass.** This codebase's shared helpers keep breaking
> on **who owns the work**, not on what the work is. The hold's clock ([ui.js:360](scripts/ui.js:360))
> is owned by the continuing client while every other clock is owned by the elect; the hold's
> relay fold ([hold.js:572](scripts/hold.js:572)) is the same split. Both look like
> duplication and are not. **Unify the mechanism, keep ownership pluggable** — and before
> merging any two things that look alike, ask who runs each one. Two of the three D-register
> items below are really this rule in disguise.

- ~~**D1**~~ — ✅ **done 2026-08-22** (`c256f3b`): the shared services moved to core.js and
  settings.js, hold.js's importers went 7 → 2. What is left is ui.js drawing the hold's views,
  which is D6's knot — and D6 does **not** fall out of D1, measured with D1 finished.
- **The `preRollD20TestV2` seam** — ⚠ **RE-MEASURED 2026-08-23 in the dnd5e 5.3.3 source; the
  earlier entry here was wrong in a way that would have cost a debugging session.**

  | Roll | carries `"d20Test"` in `hookNames`? |
  | --- | --- |
  | attack ([attack.mjs:119](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/documents/activity/attack.mjs:119)) | ✅ |
  | ability check / saving throw (`#rollD20Test`, [actor.mjs:1503](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/documents/actor/actor.mjs:1503)) | ✅ |
  | skill / tool (`#rollSkillTool`, [actor.mjs:1293](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/documents/actor/actor.mjs:1293)) | ✅ |
  | initiative dialog ([actor.mjs:1861](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/documents/actor/actor.mjs:1861)) | ✅ |
  | **death save** ([actor.mjs:1593](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/documents/actor/actor.mjs:1593)) | ❌ `["deathSave"]` only |
  | **concentration** ([actor.mjs:1732](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/documents/actor/actor.mjs:1732)) | ❌ `["concentration"]` only |

  Death saves and concentration build their own configs instead of routing through
  `#rollD20Test`, so **one `d20Test` registration does NOT cover all d20s** — and this module
  already owns a concentration machine, so that gap is live, not theoretical.

  ⚠ **Pre and post are asymmetric.** The pre hooks loop every entry in `hookNames`
  ([basic-roll.mjs:101](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/dice/basic-roll.mjs:101)),
  so generic `d20Test` coverage exists *before* the dice land. The post hooks are a single
  per-family `Hooks.callAll(\`dnd5e.roll${name}\`)` — **no generic `dnd5e.rollD20Test` exists**,
  and `callAll` means they are **not cancelable** and fire **after the message already exists**.
  Covering every d20 post-roll costs ~7 registrations (`rollAttack`, `rollAbilityCheck`,
  `rollSavingThrow`, `rollSkill`, `rollToolCheck`, `rollDeathSave`, `rollConcentration`).
  ⚠ There is **no hook at all between evaluation and message creation** — `buildEvaluate` fires
  nothing. A moment cannot pause a d20 after it lands but before the table sees it. **This is
  not a limitation in practice**: the post-roll fold pattern (below) stamps the message that
  already exists, which is what Precision Attack does today.

  ⚠ **Outcome is only knowable when a DC rides the roll** — ✅ re-verified at
  [basic-roll.mjs:199](../../../LOCAL/Repos/dnd5e-release-5.3.3/module/dice/basic-roll.mjs:199):
  `isSuccess`/`isFailure` return `undefined` when unevaluated, and **`false` when
  `options.target` is not numeric** — so a bare sheet check reads as "not a failure" rather
  than "unknown". Populated on activity-driven and requested rolls only.
  Establishing this seam is architecture; building on it is not, and is not authorized.
- **AC5e as a vendor boundary** — the 1.9 fence (AC5e decorates d20s, Battleflow applies and
  never decorates) is the cleanest line in the design. Worth making enforceable rather than
  conventional.
- **The §4.1 relay** — hand-written three times with three envelope keys, each adding its own
  `createChatMessage` registration (15 exist in total):

  | Site | Envelope key | Folded by |
  | --- | --- | --- |
  | [hold.js:572](scripts/hold.js:572) | `respondsTo` | ⚠ the **continuing client** |
  | [saves.js:939](scripts/saves.js:939) | `saveChoiceAnswer` | the elect (`isActiveGM`) |
  | [maneuvers.js:508](scripts/maneuvers.js:508) | `riposteAnswer` | the elect (`isActiveGM`) |

  Consolidating removes two registrations from the pinned hook order — the one extraction with
  an architectural payoff rather than a line-count one. ⚠ **But hold's folder has a different
  owner**, exactly like its clock (see the D2 note). A naive three-into-one merge would move
  the hold's fold onto the elect. Unify the *envelope*, keep the ownership pluggable.

**Touch last, and only with tests:** `applyDamagesWithReceipt` / `applyEffectsWithReceipt` —
the single chokepoints every machine routes through; their per-key latches and
receipt-existence gates are what defend against double-apply. Also `dnd5e.preApplyDamage` row
order: of check-hook-order's 9 assertions only seven are `renderChatMessage`; the other two
are the safety-critical veto and `preRollDamageV2`, and the lazy import at
[hold.js:996](scripts/hold.js:996) must survive verbatim.

---

## Do not re-derive — claims that look right and are wrong

Negative results are the expensive kind. Each of these was investigated and **refuted**; each
is the sort a fresh reviewer reports as a bug. ✅ = re-verified here at `b82ab8e`;
↪ = relayed from the audit session, not independently checked.

| Claim | Why it's wrong |
| --- | --- |
| ↪ "saves.js at 1,734 lines is a god-file, split it" | Size is confirmed, the conclusion isn't. The house rule is one-file-per-phase with a **measured ~4,500-line** trigger; the v1.6.1 split fired at 4,504. The file is less than half that. |
| ↪ "`rollSavingThrow(..., {configure:false})` loses aura/condition modifiers" | It doesn't. dnd5e computes ability mod, proficiency, save bonuses and condition-derived adv/dis **from actor data before any dialog exists** ([dnd5e.mjs:37467-37492](../../../Users/sippelmc/AppData/Local/FoundryVTT/Data/systems/dnd5e/dnd5e.mjs)); `configure:false` skips only the dialog. The suite proves it — smoke-saves.mjs forces outcomes by writing `abilities.con.bonuses.save` and asserts the `configure:false` roll lands on the forced side. **Reported once as a live table-facing bug; cost real work to kill.** |
| ✅ "check-hook-order is too narrow at 9 assertions" | Its contract is deliberate: print the full order for review, assert only the load-bearing pairs. |
| ↪ "The Sunlight Sensitivity incident implicates the save path" | It doesn't — that was an **attack** roll, which the module observes rather than rolls, and Sunlight Sensitivity isn't modelled as actor data in dnd5e 5.3.3, so the native dialog wouldn't have applied it either. An argument for condition automation, nothing more. |

**Sizing, so Phase 2 isn't mis-scoped:** ↪ the ask-scaffolding residue is **45–60 lines per
site**, not the ~250 first published. Most of what looks copied is rules text. Maintenance
job, not an architecture job.

**✅ Zero-risk early win if one is wanted:** [saves.js:241-370](scripts/saves.js:241) — five
pure functions (`tokensInTemplates` 241, `honestDims` 280, `templateShape` 296, `tokenCenter`
346, `tokenSamplePoints` 357–370), no hooks, no module flags, called from two sites. Holds the
trickiest platform knowledge in the tree (the v14 region shim), and any future area feature
needs it while saves.js exports nothing.

⚠ **Cut at 370, not 379.** Lines 372–378 are a doc comment that does *not* document the
function beneath it — [templatesForOrigin](scripts/saves.js:380) is documented by the
one-liner at 379. Cutting at 379 would carry it into a pure-math module.

⚠ **And it is a stale duplicate, not just misplaced.** 372–378 restates
[refreshDemandFromTemplates](scripts/saves.js:449)'s own doc at
[saves.js:435-448](scripts/saves.js:435) — "Done entries keep their verdicts (history never
re-rolls); pending entries outside drop; new arrivals join fresh. The elect owns the write"
appears in both, near-verbatim, and 435–448 is the richer, current version. **Don't relocate
it — fold its one unique sentence** (the original placement's create event fires before the
stamp exists and finds nothing) into that ⚠ block, and delete the rest.

⚠ **General rule for this file, and the reason the above matters:** at least one comment has
drifted from its function, so **comment boundaries are not safe cut lines — function
boundaries are.** `grep -n "^function "` is the reliable guide when carving saves.js.

**✅ For the row registry, when it comes:** of check-hook-order's 9 assertions only **seven**
are `renderChatMessage` ([tools/check-hook-order.mjs:53-65](tools/check-hook-order.mjs:53)).
The other two are the safety-critical `preApplyDamage` veto (:51) and `preRollDamageV2` (:67).
A row registry touches only `renderChatMessage`, so it doesn't weaken the veto — but the lazy
import at [hold.js:996](scripts/hold.js:996) must survive **verbatim**; its comment is explicit
that it protects `preApplyDamage`, not rows.

**Watch item, not a finding:** ↪ the new docs largely avoid the pattern that rotted the old
inventory — no hand-carried line counts. Hand-carried *file* counts drift far slower than line
counts, but both are free to assert in `tools/check-registry.mjs` and none is asserted yet.

✅ **The D5/D7 drift this section used to warn about is CLOSED (`e953546`), and D4's was closed
2026-08-23.** For the record, so nobody re-opens the argument: D5 read *"4 of 20 files are
majority-pure; almost nothing is unit-testable"* and D7 read *"No lint, no formatter, no
dead-code check, no package manifest, no CI"* — every clause of both was false by then, and
both rows were rewritten. D4's *"~220 reads, ~51 writes across 14 files"* was likewise a stale
hand count and now carries the re-measured figures. ⚠ **The remaining hand-carried number in
this tree is the source-file count — 27 today** (`scripts/*.js` + `scripts/decide/*.js`), and
it is still asserted nowhere. It has already been wrong twice (20, then 26). **Assert it in
`check-registry.mjs` the next time that file is open**, and stop hand-carrying it.

---

## Operational

- **Version bump touches TWO fields** in `module.json` — `version` *and* the manifest
  `download` URL. The v1.20.0 walk-1 bump missed the download and it was caught at release.
- Restore world settings to the reference table after any test run. Verify, don't assume.
- First-suite-after-cold-boot flake is a real class — re-run before diagnosing.
- Two windows at the table (GM + a player owning Thomas/Morgash). "Nothing popped" must
  always ask **which window**.
- Deploy without a version bump serves cached scripts until the process bounces: deploy →
  bounce → run. Hard-refresh both browser windows.

---

## The parallel session

A second Claude session ("fvtt-mod-battleflow-a1") audited this tree. **Reference only — it is
not a guide.** It is a one-shot dated research session whose information goes stale. Every
claim of its repeated above was re-verified here at `b82ab8e`, and three were corrected: its
reaction finding was misclassified as a rules-correctness bug (see ruling 1), its D3 objection
overstated, and its reading of the `20_000` literals conflated resume paths with buzzer paths.
It conceded all three on evidence. It also caught a real error of ours — published
`queueFlagWrite` counts that were raw greps including the import line and prose mentions — and
contributed the ownership rule at the head of the architecture section. Prefer its file:line
pointers; distrust its categories and its urgency.

⚠ **Unresolved: who made `286b379`, `5e51bf1` and `b82ab8e`.** All three landed 2026-08-22
within ~70 seconds, authored as `Matthew Sippel` like every session here, so authorship
distinguishes nothing. Neither this session nor the audit session made them. **Do not assume
a Claude session owns any doc in this tree on the basis of timing** — that inference was made
here once and was wrong.
