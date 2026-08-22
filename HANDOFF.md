# HANDOFF.md — picking this up cold

> **What this file is:** continuity only — current state, the standing directive, and the
> verified work list. The permanent docs are [DESIGN.md](DESIGN.md) (north stars),
> [ARCHITECTURE.md](ARCHITECTURE.md) (the shape) and [NOTES.md](NOTES.md) (what it cost);
> [PLAN.md](PLAN.md) is the temporary stabilization tracker. **This file does not duplicate
> them.** It was deliberately not restored to its old 2,700-line form.

## State at a glance — 2026-08-22

| | |
| --- | --- |
| **Do first** | 📋 **Nothing is open.** The correctness pass AND **Phase 2 stages 1–4** are built, committed and battery-green. **Stage 5 (the untangle — D1, the cycles, the relay) is the next work and was deliberately NOT started** — the user drew the line there. |
| Repo | `main` @ `HEAD`, clean. This session: the correctness pass (`a2557ea`, `853f1a6`, `e316468`, `fef05c7`) then Phase 2 stages 1–4 (`c30f2a8`, `11bca56`, `c53500a`, `063c905`). |
| Release | ✅ **v1.20.0 released, tagged, public.** Prod registers it; `BF_TARGET=prod verify-settings` CLEAN. |
| Walk | ✅ **v1.20.0 walk CLOSED** — fifteen items + T1–T5. Zero open findings from the table. |
| Sandbox | ⚠ **HEADLESS.** `node <mcp>/scripts/local-foundry.mjs start/stop/status/restart`. Never the Electron app for suites — the two cannot coexist (dataPath lock). **Verify status at session start; it may have been left up.** |
| Bridge | Disconnect before any suite. Suites join as `Tester Assistant`. |

---

## The standing directive (user, 2026-08-22)

**Correctness and architecture only. No new features, and no feature work considered.**

The architecture must be able to carry the surveyed features later — Heroic Inspiration,
Bard, Tactical Mind, AC5e adoption. Those are **design pressure and nothing else**: use them
to test whether a seam is right, never as a reason to build one.

---

## 📦 Phase 2, stages 1–4 — ✅ DONE 2026-08-22, all four battery-green

`c30f2a8` geometry · `11bca56` parsers · `c53500a` verdicts · `063c905` eligibility.
Every stage: move-don't-rewrite, unit tests added, static gate + live battery, own commit.
**Unit tests 13 → 103**, still ~230ms with no Foundry.

**`scripts/decide/` has ZERO imports** across all four modules — not core.js, not a machine,
not the spine. The layer is dependency-free by construction, which is what makes it testable
in milliseconds and impossible to tangle. **Keep it that way**: the day something in there
needs `game` or `canvas`, it is EDGE and belongs one layer up (§2 rule 1).

| Module | Holds |
| --- | --- |
| [decide/geometry.js](scripts/decide/geometry.js) | `honestDims`, `tokenCenter`, `tokenSamplePoints` — the v14 region-shim knowledge |
| [decide/registry.js](scripts/decide/registry.js) | the five world-setting list parsers |
| [decide/verdict.js](scripts/decide/verdict.js) | `hitsAmong`, `modeAdmits`, `saveOutcome`, `saveMultiplier`, `verdictText` |
| [decide/eligible.js](scripts/decide/eligible.js) | `isDeadForSaves`, `limitedUses`, `isReactionItem`, `castLevelOf`, `clampVolleyCount`, `riderKey` |
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

**Not started, and the remaining Phase 2 list:** receipt arithmetic, presentation formatters,
and the flag accessor layer (which would give the rest of D3 for free).

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
Every other surveyed resource (Bardic dice, slots, Heroic Inspiration, Second Wind itself)
is already system state the module spends through `activity.use()`.

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

All three are now fixed in [ARCHITECTURE.md](ARCHITECTURE.md) §10. Kept here with their
evidence, because the corrected rows are terse and this is why they say what they say.

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

- **D1** — hold.js is both a feature and the shared-services module (six files import
  `canAnswerFor`, `inRunningCombat`, the reaction lookup, the list parsers from it).
  ARCHITECTURE.md §10 names it; PLAN.md Phase 4 schedules it.
- **The `preRollD20TestV2` seam** — measured in the dnd5e 5.3.3 source this session: every
  d20 test (attack, check, save, skill, tool, initiative) carries `"d20Test"` in its
  `hookNames`, so one registration covers all of them. Post-roll, per-family hooks exist too
  (`dnd5e.rollAbilityCheck`, `rollSkillV2`, `rollToolCheckV2`).
  ⚠ **Outcome is only knowable when a DC rides the roll** — `D20Roll.isSuccess`/`isFailure`
  compare against `options.target`, which is populated on activity-driven and requested rolls
  but **not** on a bare sheet check, where `isFailure` returns `false` rather than unknown.
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
inventory — no hand-carried line counts. Two hand-carried *file* counts sit at
ARCHITECTURE.md:346-347 ("14 files", "20 files"). File counts drift far slower than line
counts, but both are free to assert in `tools/check-registry.mjs`.

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
