# HANDOFF.md — picking this up cold

> **What this file is:** continuity only — where the tree stands, what to do next, and the
> expensive things a fresh reader would otherwise re-derive. The permanent docs are
> [DESIGN.md](DESIGN.md) (what the module is for), [ARCHITECTURE.md](ARCHITECTURE.md) (how the
> code must be shaped) and [NOTES.md](NOTES.md) (what it cost to learn). **This file does not
> duplicate them** — when a fact belongs in one of those, it lives there and this file points.
>
> [PLAN.md](PLAN.md) is the temporary stabilization tracker. **Its work is finished**; it is
> kept for its measurements and its record of what was decided against, and it should be
> deleted once nobody is reading it.

---

## ▶ START HERE — the next session, in order

**Five things. The rest of this file is detail behind them.**

1. **`npm run verify`** — seconds, offline. Ten static checks and 237 unit tests. **If it is
   green, the tree is in the state this file describes.** If it is red, stop and read the
   failure; three of the checks are deliberate pins that fail on purpose.

2. ⚠ **THEN RUN THE BATTERY, BEFORE ANY NEW WORK.**
   ```
   node tools/battery.mjs --snapshot
   ```
   **This is the one thing actually owed.** Commit `cec478d` changed **every suite's teardown**
   and added a section that **creates and deletes a real Combat**. Every piece is green on its
   own; **none of them has been proven together.** ~20 minutes, and `--snapshot` rolls the world
   back afterwards. ⚠ **First: `node <mcp>/scripts/local-foundry.mjs status`, then
   `disconnect-bridge`** — the preflight refuses while the bridge holds a session, and a single
   read-only MCP call is enough to re-arm it.

3. ⚠ **THE SANDBOX IS SINGLE-OCCUPANCY, AND A SECOND SESSION WAS ACTIVE IN THIS REPO ON
   2026-08-23.** Two sessions driving suites collide: the pid lock refuses one, and a half-run
   suite leaves the world dirty. **Establish who owns the box before running anything.**

4. ⚠ **BEFORE PROPOSING ANY STRUCTURAL WORK — read *SETTLED — do not re-propose*.** Every row
   is a decision with the one condition that would reopen it. **Four of them are proposals that
   came back three sessions running, and the newest was dropped outright by the user.**

5. ⚠ **BEFORE WRITING A TEST — read *THE FIRST COVERAGE TRIAGE*.** Three lines are still open
   there with reasons. **`node tools/hook-coverage.mjs` after a battery tells you what the run
   actually exercised**, which is the only thing in this apparatus that speaks to behaviour.

**Then, if you want the ten-minute grounding:** *If you are COLD, read in this order*, below.

---

## State at a glance — 2026-08-23

| | |
| --- | --- |
| **Do first** | ▶ **SEE *START HERE* ABOVE — it is six numbered steps and it is the whole of the answer.** In one line: **the gate is green, the tree is pushed, and the battery over `cec478d` is the one thing owed.** ⚠ Two rows of this table are about a release that has NOT been cut for the commits above the tag (`git log v1.23.1..HEAD` counts them — a hand-carried "six" sat here and was wrong); ⚠ nothing in those commits changes shipped behaviour (`scripts/` is untouched since v1.23.1), so **a deploy buys nothing but a version string.** |
| Release | ✅ **v1.23.1 RELEASED, 2026-08-23** — <https://github.com/Txpple/fvtt-mod-battleflow/releases/tag/v1.23.1>. The enforcement pass: `npm run layers` in the gate, the services tier named, D9 opened with two repayments. **A PATCH — two functions changed files and nothing changed behaviour.** ✅ The **published** zip was downloaded back and proven self-contained: **31 entries, all six `decide/` files, 95 relative imports all resolving, no backslash separators, both manifest fields naming v1.23.1**. |
| Release (previous) | ✅ **v1.23.0 RELEASED, 2026-08-23** — <https://github.com/Txpple/fvtt-mod-battleflow/releases/tag/v1.23.0>. Both assets attached. The **published** zip was downloaded back and proven self-contained: **31 entries, 28 scripts including the six in `decide/`, 109 relative imports all resolving, no backslash separators, both manifest fields naming v1.23.0**. ⚠ That read-back is not ceremony — it is the check that caught the backslash bug (v1.1.0–1.1.15) and the missing `scripts/decide/` (post-Phase-2). |
| Prod | ✅ **PROD RUNS v1.23.1 AS OF 2026-08-23** — deployed and **verified byte-identical by a second, independent `--check` run**. ⚠ The `--check` was meaningful this time because the box was awake: it read **distinct** hashes and named exactly the seven files this release touches (six scripts + `module.json`) — *the repeated-hash tell was absent*. ⚠ **The version STRING lags until the Foundry process restarts**; the code is live on the next world reload. Earlier: ✅ **v1.23.0 AS OF 2026-08-23** — the d20 folds included, by user instruction. Earlier the same day: ✅ **v1.22.0** — user instruction this session, superseding the old *"sandbox only, no prod yet"* call. 28/28 files byte-identical over WebDAV. ⚠ **That morning the box was ASLEEP** (`status=NOT_RUNNING`) and had to be woken by the Magic URL first — see *The prod deploy* below, because **the byte-check LIES when the box is down** (it reported the same hash for all 28 files: the lobby HTML). *(That clause is history: prod carries the d20 folds now.)* |
| Repo | `main`, **clean and pushed**, **AHEAD OF THE v1.23.1 TAG** (`git log v1.23.1..HEAD` counts them) — D10's dispatch check, D11's coverage ledger, `smoke-d20-folds` §3, the docs, the three coverage follow-ons, and this recut. ✅ **BATTERY GREEN over the first four** (19m59s, settings CLEAN, world rolled back). ⚠ **NOT over `cec478d`**, which changed every suite's teardown — see *What is NOT yet done*. Not released. |
| **The debt register** | ⚠ **AS OF 2026-08-23 THE ROWS ARE D1–D11.** **D10 is CLOSED** — the "who owns a curated hook list" question was dissolved by measuring rather than answered: dnd5e declares its own hooks in its own bundle (88 literals ∪ 92 JSDoc `@memberof hookEvents` = 105), so the list is generated and nobody curates it. **D11 is MEASURED, not closed** — the instrument exists and its READING is the standing obligation. **D9 stays OPEN with four pinned edges, deliberately.** Below is the pre-2026-08-23 text, still true: ARCHITECTURE §10: **D1–D8 repaid or settled by decision** (D4 dropped, the two surviving import cycles permanent — the argument is in their rows). ⚠ **D9 IS OPEN, added 2026-08-23 by the ENFORCEMENT PASS**, and the register's "every row is closed" line has been **corrected**: it was false when written, because the service-in-a-feature residues had no row. **3 of D9's 7 edges are repaid; 4 stand, each pinned with a reason** in `tools/check-layers.mjs`. ⚠ **D9's evidence is MECHANICAL, unlike every row above it** — a repaid edge fails the gate as a stale pin, so this row cannot go stale in place the way D2's did. ⚠ **D10 IS ALSO OPEN, added 2026-08-23, and it is open for the opposite reason**: D9 is understood and deliberately unpaid, **D10 is a failure class with NO RULE AGAINST IT** — a hook name the system never dispatches registers cleanly and does nothing forever. It is what put four of six d20-fold offer paths past a 12/12 green suite. **Interim discipline: a live suite asserts a hook FIRED, never that it was registered.** |
| Verify gate | `npm run verify` — **TEN static checks then the unit tests, all offline, all in seconds.** ⚠ **`npm run dispatch` is the tenth (NEW 2026-08-23, D10)**: every `dnd5e.*` hook this module registers must be one dnd5e actually dispatches, checked against a set **generated from the installed system's own bundle** and committed as `tools/dnd5e-hooks.json`. **It is pinned to the dnd5e version `module.json` verifies** — bumping the system pin without `--regen` fails the build, deliberately. **After any dnd5e upgrade: regen, then READ THE DIFF — a name that disappeared is a listener that has just gone silent.** biome (**98 warnings, 0 errors — the baseline, MEASURED 2026-08-23; the "96" carried here for days was never true**), knip, **typecheck**, imports, **layers**, hook order (**83 registrations, 12 pairs**), **dispatch (11 dnd5e names, 1 pinned hole)**, registry (**13 checks**; it prints the R4 kinds table), manifest in-step, comments (**344 blocks / 28 files**), vitest **237**. ⚠ **Four numbers are PINNED and fail the gate deliberately** — the R4 kind total (**19**), the source-file count (**28**), the two `module.json` version fields agreeing, and **the dnd5e version the hook artifact was extracted from**. That is the point, not an obstacle. ⚠ **`npm run layers` declares every file's LAYER and every cross-layer EDGE**, and fails on an unpinned edge *and* on a pin whose edge has gone. **Do not hand-count the import graph again — it prints the tally.** ⚠ **And do not hand-carry any of these numbers into prose: `96` was wrong for three days here and the tools print all of them.** |
| **Testing** | ⚠ **`node tools/battery.mjs` is the front door.** **Fifteen entries** in the order that works (`fixture-d20-folds` seeds, `reset-fixture-state` sweeps — neither is a suite), **every one captured to `dist/battery/<stamp>/` before anything is summarised**, then **HOOK COVERAGE**, then `verify-settings`. ⚠ **THE COVERAGE REPORT IS NEW (2026-08-23, D11) AND IT IS THE ONLY OUTPUT IN THE APPARATUS THAT IS ABOUT BEHAVIOUR** — which of the 83 registrations actually FIRED. **Read its never-fired list; it is reported and never enforced**, because a rule that failed on a rare hook would be tuned out by the third one. One suite alone (`smoke-d20-folds`) covers **16/25 names, 71/81 registrations**. `--from <suite>` resumes; `--snapshot` rolls the world back; `--list` shows the order. Every suite also takes `--list` and `--section N`. |
| Sandbox | ⚠ **HEADLESS, and it is THE test environment.** `node <mcp>/scripts/local-foundry.mjs start\|stop\|status\|restart`; deploy with `node <mcp>/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local` — **never without `--local`**. Never the Electron app for suites (dataPath lock). ✅ **Carries v1.23.1 byte-identical, manifest included** (stop → deploy → start, 2026-08-23) — so it now matches prod and the release exactly. ⚠ **Its `module.json` lagged a version behind the scripts for part of the day** and nothing noticed, because a manifest change needs a PROCESS restart while scripts need only a world reload: `--check` names `module.json` alone when that happens. ⚠ **LEFT RUNNING** — `status` first, `stop` if you are not testing. ⚠ **`status` counting 1 user is usually the MCP BRIDGE, not a human**: run `disconnect-bridge` and re-check before concluding anything, because the sole-GM preflight refuses a suite while it is connected (seen 2026-08-23 — a read-only MCP call is enough to re-arm it). ⚠ **`BF Test Fighter` now carries an equipped PHB Longsword**, granted by the fixture so `smoke-d20-folds` §3 has an attack activity to drive. ⚠ `list-actors` includes **`BF Test Fighter`** (Fighter 2, Second Wind + Tactical Mind, clean PHB provenance) and **`BF Test Bard`** (Bard 5, so its die is a **d8** and a wrong d6 default is caught). |
| Bridge | Disconnect before any suite. Suites join as `Tester Assistant`; the two-client ones also join as `PC Assistant`. ⚠ One suite at a time is **enforced** now (a pid lock in `harness.mjs`), not remembered. |
| **Parity (enforcement pass)** | ✅ **BATTERY GREEN ON THE ENFORCEMENT-PASS CODE, 2026-08-23, 19m45s, settings CLEAN.** battleflow ALL PASS · hold ALL PASS · saves 74/74 · volleys 39/39 · maneuvers 54/54 · **d20-folds 20/21 → 21/21 re-run on a re-seeded fixture (NOT a regression — see below)** · cast 17/17 · riders 8/8 · **concentration 47/47** · twoclient 9/9 · popup-routing ALL PASS · effects 54/54 · resources 18/18. ⚠ **concentration and saves are the ones that mattered** — both importers of the moved `dramaticVerdictPause`, and concentration is the machine whose hook evaluation order shifted. |
| **Parity (v1.23.0)** | ✅ **PROVEN 2026-08-23** — full battery on a sandbox carrying the released code byte-identical, **every suite green, settings CLEAN, 19m58s**: battleflow ALL PASS (33) · hold ALL PASS (44) · saves 74/74 · volleys 39/39 · maneuvers 54/54 · cast 17/17 · riders 8/8 · concentration 47/47 · twoclient 9/9 · popup-routing ALL PASS · effects 54/54 · resources 18/18. |
| Flakes | ⚠ **`smoke-battleflow` "2 FAILURE(S)" is NOT DIAGNOSED** — twice seen (2026-08-22, 2026-08-23), never reproduced, and nothing claims to have fixed it. **What changed is that its evidence can no longer be lost:** both sightings had their assertions thrown away by a `\| tail`, and the battery captures the full body first. **If it recurs it will name itself — capture first, read second, re-run third.** ⚠ `smoke-effects` has a documented dice-variance class: re-run before diagnosing. |

---

## If you are COLD, read in this order

**Ten minutes, and it is the difference between contributing and re-deriving.**

1. **The table above.** Where the tree, the release, prod and the sandbox actually stand.
2. **[DESIGN.md](DESIGN.md)** N1–N4 and R1–R5 — nine short rules the whole module answers to.
   Everything else here is downstream of them.
3. **[ARCHITECTURE.md](ARCHITECTURE.md) §2 and §7** — the layers and the dependency rule. ⚠ Then
   run **`npm run layers`**: it PRINTS the tier list, the edge tally and every pinned exception.
   **Do not hand-count the import graph; a by-hand review of this exact tree missed a two-way
   cycle one day before the tool printed it.**
4. **§11's checklists.** A new feature walks them — *Adding a FOLD*, *Adding a moment*,
   *Adding a TEST* (the tier rule), *Adding a file*.
5. **§10 D9, D10 and D11** — D9 open by decision, D10 closed, **D11 measured and owed a reading**.
6. ⚠ **This file's *SETTLED — do not re-propose* table.** Each row is a decision with the
   condition that would reopen it. **Read it before suggesting structural work**; four of its rows
   are proposals that have already come back three sessions running.
7. **This file's *Do not re-derive* table**, near the bottom. Every entry is a claim that looks
   right, is wrong, and cost real time to kill. A fresh reviewer reports several of them as bugs.

**Then, before you touch anything:** `npm run verify` (seconds, offline, nine checks + 237 unit
tests). If it is green, the tree is in the state this file describes.

⚠ **The single most useful thing to understand about this codebase**, learned twice in two days
and expensively both times: **its checks were strong on SHAPE and weak on BEHAVIOUR.** The gate
proves imports resolve, layers are respected, kinds are counted, docs are attached — and it
proved all of that while four of six d20-fold offer paths could not fire, because two hook names
did not exist and nothing asserted that a hook fires. **A green gate means the tree is well
formed. It does not mean the feature works.**

✅ **TWO THINGS CHANGED ON 2026-08-23, and between them they are the first real answer to that
sentence.** `npm run dispatch` makes a hook name that the system never dispatches **fail the
build** — the exact bug above, caught statically in milliseconds. And the battery now ends by
printing **which of the 83 registrations actually fired**, which is the first number in this
repo's history that is about the code RUNNING rather than the code being well formed.

⚠ **Neither is a cure, and pretending otherwise would recreate the problem.** The dispatch check
proves a listener is on a channel with a speaker, not that it does anything useful. Coverage is
**reported, never enforced** — it tells you a path went unwalked, and only a person can say
whether that is a gap, a dead handler or a rare hook. **The live battery and the table are still
what say a feature works.**

---

## ▶ THE FIRST COVERAGE TRIAGE — read this before adding a test

✅ **BATTERY GREEN ON THE NEW CODE, 2026-08-23** — all fifteen entries, **19m59s**, settings
CLEAN, world rolled back by `--snapshot`. battleflow ALL PASS · hold ALL PASS · saves 74/74 ·
volleys 39/39 · maneuvers 54/54 · **d20-folds 29/29** · cast 17/17 · riders 8/8 ·
concentration 47/47 · twoclient 9/9 · popup-routing ALL PASS · effects 54/54 · resources 18/18.
⚠ **That run is what proves the harness change**, which touches every suite's connect and
teardown and had been exercised on two of them.

**And it produced the first thing this apparatus has ever said about BEHAVIOUR:
`18/25 observable hook names, 74/81 registrations` across 13 suites.**

⚠ **SEVEN NAMES NEVER FIRED. NONE OF THEM IS A DEAD HANDLER** — that was checked, not assumed,
and the triage is recorded here because D11's standing rule is that **no line sits in that list
unexplained across two releases.** Re-triage after any battery; a line that changes category is
the interesting event.

| Never fired | Verdict, 2026-08-23 — and what was done about it |
| --- | --- |
| `updateCombat` · `deleteCombat` (hold.js) | ✅ **CLOSED THE SAME DAY — `smoke-hold` §7.** ⚠ **This was the real gap and the most useful thing the report has found: no suite in the battery had ever created a COMBAT**, verified by grep, so the hold's whole `reactionSpent` lifecycle — table-facing bookkeeping — had never executed under test while every other part of the hold was covered heavily. §7 now creates a real Combat and asserts all four rules: the SET is refused out of combat (the stranding guard), taken in combat, cleared when the actor's turn comes round, and cleared on delete **even with `reactionHold` OFF** (the clears are deliberately ungated on the toggle). ⚠ **The combat is deleted in a `finally` — a leftover would poison every later suite through `inRunningCombat`.** |
| `dnd5e.rollToolCheck` (d20-folds.js) | ✅ **CLOSED — the fixture grants Smith's Tools.** It was a NAMED SKIP in `smoke-d20-folds` §4 for want of anything to roll. ⚠ **This is the hook whose NAME the module got wrong in v1.23.0**, so leaving it unexercised was leaving exactly the wrong one untested. The identifier (`baseItem: "smith"`) is **read from the fixture's own report, not guessed.** |
| `createMeasuredTemplate` · `updateMeasuredTemplate` (saves.js) | ⚠ **OPEN, and explained: KNOWN, MEASURED, AND BURIED IN A SOURCE COMMENT until this report dragged it out.** `smoke-saves` §8 says *"the CRUD hooks measurably never fire on this page"* and routes around it by nudging the card's render. The template-adoption feature is table-proven (the Shatter and Moonbeam reports), so **what is untested is the hook path, not the feature.** ⚠ Worth knowing before trusting any placeable-document hook in a suite. |
| `renderActivityUsageDialog` (polish.js) | ⚠ **OPEN, structural, and correct.** Every suite passes `configure: false` precisely so no dialog renders. Covering it means a suite that deliberately opens one. |
| `renderSettingsConfig` (settings.js) | ⚠ **OPEN.** No suite opens the settings dialog. Pure UI polish on the config form; the cheapest thing on this list to leave alone. |

✅ **Two of the five lines closed within hours of the first reading, and one of them was a
table-facing feature nobody knew was untested.** That is the argument for the instrument, and it
is also the argument for the triage rule: **the report is only worth what somebody does with it.**

---

## ▶ What is NOT yet done

**2026-08-23. The tree carries commits the tag does not — `git log v1.23.1..HEAD`.** Nothing here is blocking.

| Owed | Why it matters |
| --- | --- |
| ⚠ **A BATTERY OVER THE LAST COMMIT** | **The most important row here.** `cec478d` changed **every suite's teardown** (`disposeSafely` at eleven call sites) and added a section that **creates and deletes a real Combat**. Each piece was proven on its own — `smoke-hold` §7 green, `smoke-d20-folds` §4 green, `verify-settings` green, settings CLEAN — but **no full battery has run over them together.** Do this before anything else. |
| **A release** | v1.23.1 is the tag; `git log v1.23.1..HEAD` is what sits above it. `node tools/bump-version.mjs minor` then `build-release.ps1` (which runs the gate itself, with no skip flag). |
| **Prod and the sandbox** | Both carry v1.23.1. ⚠ **Nothing in this batch changes shipped behaviour — `scripts/` is untouched since the tag.** It is all `tools/` and docs, so a deploy buys nothing but the version string. |
| **Three coverage lines** | Templates, the usage dialog, the settings dialog — all OPEN with reasons in the triage table above. **None is urgent; none may sit unexplained across two releases.** |

---

## ▶ SETTLED — do not re-propose

**Decided by the user, 2026-08-23. Every row below is a live suggestion that has already been
made, examined and closed.** They are not taboos and they are not oversights: each is a decision
with a reason, and each names **the one thing that would reopen it**. Proposing one of these
again without that thing having happened costs the session twice — once to re-derive the
argument, once to re-decide it.

⚠ **This section exists because the same four proposals came back three sessions running.** A
debt row records what is *owed*; this records what is **not**, which is the half a fresh reader
cannot infer from anything in the tree.

| Settled | The ruling | What would reopen it |
| --- | --- | --- |
| **The *rescue pass* — merging the precision and d20-fold popups into one window** | ⚠ **DROPPED BY THE USER, 2026-08-24. Do not raise it again.** A parallel session proposed it off a brainstorm, not off a table sighting: two popups on one missed attack, plus two unverified bug claims (one-sided composition in `resolvePrecision`, and a wasted spend on a stale window). **The user has never seen either at the table**, nobody but its author verified them, and the whole five-stage section has been deleted from this file. ⚠ **It is in git if it is ever wanted** — the section's last text is in commit `fc2ca7f`. | **the user reporting it from an actual session.** They said they will say so. Nothing else — not a re-read of the code, not a fresh session's reasoning about it |
| **D9's four remaining machine→machine edges** | **NOT being repaid, and that is the finished answer, not a delay.** Each is pinned in `check-layers.mjs` with its reason and its trigger. `saves → maneuvers` waits for a **third choice kind** to prove the registry's shape (the D8 lesson: the seam is built by the feature that proves it). The `saves ↔ d20-folds` cycle waits for **a second machine that needs withhold-and-resume** before that becomes a spine primitive. `saves → receipts` reclassifies the moment `receipts.js` gains **a second importer**. ⚠ **The pins are SELF-EXPIRING** — repay an edge and the build fails until its row is deleted — so this row cannot rot the way D2's did. | the trigger named in the pin actually arriving |
| **The two permanent import cycles** | `hold.js ↔ auto-damage.js` and `auto-apply.js ↔ mastery.js` are **PERMANENT BY DECISION** (ruling 6 below). ⚠ The first is **load-bearing**: the bare `import "./auto-damage.js"` pins module evaluation order and `check-hook-order` depends on it — break it and the damage-offer bar silently drops below the hold row. **Doing this work would make the tree worse.** | nothing. This one is closed. |
| **Tactical Mind's refund** | **STAYS UNMODELLED.** RAW is real (*"if the check still fails, this use of Second Wind isn't expended"*) and the module cannot implement it: the refund is conditional on the check FAILING, and **no DC exists for an ability check anywhere in dnd5e** (ruling 2b). A manual *"Refund"* button on the settled card was offered and **declined**. The table adjusts by hand. | dnd5e recording a DC for raw checks |
| **Widening Heroic Inspiration** to *"any die"* (damage rolls) or the transfer clause | **NOT SHIPPING.** Both halves are real rules text and both are deliberately unmodelled. ⚠ Widening to any-die/any-outcome is what **triggers §11 rule 4's auto-revert obligation** — a fold that can reverse an applied verdict owes the table a receipt revert, and nothing ships that can do it yet. | building the revert machinery first, deliberately |
| **Chasing the `smoke-battleflow` "2 FAILURE(S)" flake** | **WAIT FOR IT TO RECUR. Do not investigate now** — it has appeared twice, never on demand, and both times its assertions were destroyed by a `\| tail`. **The fix that mattered is already in**: the battery captures the full body before summarising, so the next sighting names itself. Investigating before then is guessing. | the next sighting, with its captured output |
| **Short-duration effect expiry** (mastery chips) | **BLOCKED ON A LARGER DECISION, not on effort.** ⚠ **Do not build it before deciding whether this module should own TURN-TIME at all.** Building the sweeper first commits the answer by accident. | that decision being made, either way |
| **A reaction-budget abstraction** | **REJECTED** (ruling 4). Action economy is not this module's job (ruling 3); every read of `reactionSpent` is an *offer gate*, never enforcement. | nothing. Closed. |
| **Hand-carrying any counted number into prose** | **DON'T.** The commit count went stale twice, the lazy-import count was wrong three ways, and the biome baseline read **96** here for three days while the tool said **98**. ⚠ **Quote the tool's output; never retype it.** | nothing. This is a standing rule. |

---

## ▶ The d20 folds, as landed — and the three things the scoping got wrong

**Built 2026-08-23, in the working tree, gate-green and smoked green.** `scripts/d20-folds.js`
(the machine, exports nothing), a `d20Fold` kind set and a `d20Folds` list spec, two settings,
the first `SAVE_FOLDS` entry, 16 new unit tests, and `tools/{fixture,probe,smoke}-d20-folds.mjs`.

⚠ **THE SURVEY BELOW SAID "SAME SHAPE, DIFFERENT DIE". IT WAS WRONG THREE TIMES**, and every
correction cost a live measurement. They are recorded here so nobody re-derives them:

| What the survey assumed | What is actually true |
| --- | --- |
| Tactical Mind gates on *"when you fail an ability check"* | ⚠ **THAT GATE CANNOT EXIST.** `Actor5e##rollD20Test` never sets `options.target` for a plain check — **dnd5e records no DC for a raw ability check anywhere.** So failure is uncomputable, and no inference fixes it. **User ruling: the player presses a button.** The module auto-offers only where it owns the number (an attack's snapshot AC, a demanded save's DC); every ability and skill check is player-pressed, always, regardless of the `d20FoldAsk` setting. |
| Bardic Inspiration is "a different die and a different spender" | ⚠ **The recipient has no item and no activity** — they carry an **ActiveEffect** (`Inspired`, 1 hour, `transfer:false`). Spending it is a DELETE. And `@scale.bard.inspiration` is a scale value **on the granting bard**, reached through `effect.origin`. Two of the three features have nothing to `use()`. |
| Tactical Mind's spend is just `activity.use()` | True, but ⚠ **its consumption target is a COMPENDIUM UUID on disk** and only dnd5e's `Activity#_remapConsumptionTarget` (via `actor.sourcedItems`) makes it findable. **Measured working** for a cleanly-sourced actor — but an actor whose Second Wind came from a DDB import or a hand-made copy fails the remap, and the feature then offers **nothing, forever, with no error**. `smoke-d20-folds` §1 asserts the remap for exactly this reason. |

⚠ **THE MEASUREMENT THAT WOULD HAVE COST A TABLE SESSION.** `@scale.bard.inspiration` rolled
against the **recipient's** roll data does not throw and does not warn — it resolves to the
literal string `"0"` and rolls **total 0**. A Bardic die spent that way would be really gone, the
roll would post in public, and it would add exactly nothing: a wrong number that reads as bad
luck. The formula is therefore resolved **bard-side to a literal** (`"d8"`) before any roll is
built, and `smoke-d20-folds` §1 asserts both directions.

### What the FIRST TABLE PASS found — six bugs, all in the offer half

⚠ **v1 of this feature shipped with FOUR OF SIX OFFER PATHS DEAD AND A GREEN SUITE.** Every one
was found by the user testing at the table, none by the checks. The arithmetic was never
implicated in any of them — which is the D8 split doing exactly what it was for, and also the
reason the green suite meant so little.

| # | Bug | Fix |
| --- | --- | --- |
| 1 | ⚠ **`dnd5e.rollAbilityCheckV2` and `dnd5e.rollSavingThrowV2` DO NOT EXIST.** `Actor5e##rollD20Test` serves ability checks AND saving throws and fires only the non-V2 name; only `#rollSkillTool` fires a V2 pair, and its tool hook is `rollToolCheck`. **A hook name that is never dispatched registers cleanly and does nothing, forever, silently.** | the real names, plus **§4 asserts each one FIRES** |
| 2 | Saving throws were not hooked at all | `dnd5e.rollSavingThrow`, player-pressed |
| 3 | **Demanded saves never offered** — Fireball, Shatter, Hold Person. `saves.js` folds and applies the verdict the instant the roll lands, so an offer after it is too late | `saves.js` **WITHHOLDS** the verdict while an offer is live (`offerFoldOnSave`), then resumes — ⚠ **withhold, never undo**, which keeps it clear of §11 rule 4 |
| 4 | Only the FIRST listed fold was offered, and `heroic` is first — so it **masked Tactical Mind and Bardic entirely** (three separate reports, one cause) | multi-select: a button per eligible fold |
| 5 | No test-kind matching — Tactical Mind (checks-only by its own text) was offerable on an attack; the list ORDER was accidentally hiding it | each kind declares its legal `tests` |
| 6 | The card was naked buttons, and answer controls existed on BOTH card and popup | the hold's `bfCard` shape, and **one input surface** — popup decides, card recalls |

⚠ **Two rulings came out of that pass and are binding:**

1. **Every offer POPS, timed or not.** v1 popped only when there was a deadline, reading law 11
   (clocks are for BLOCKING moments). Wrong law: **law 1** is *"easy-to-forget moments get a
   popup"*, and a spendable die on a roll you already made is the definition of easy to forget.
   Untimed offers therefore also carry the house clock, because a popup with nothing to resolve
   it is the stale-popup state law 4 forbids. `holdTimer: 0` is still wait-forever.
2. **The list's `name` column is a LOOKUP KEY, not a display name.** `bardic` must be keyed on
   `Inspired` (the ActiveEffect the bard applies — the feat never leaves the bard) but must SAY
   "Bardic Inspiration". `KIND_LABEL` in d20-folds.js supplies what the table reads. Renaming
   the effect in settings changes what is FOUND, never what is said.

⚠ **And one wire-format bug worth remembering:** offers stamped by the previous build had no
`label`, and a deploy does not rewrite flags already in the chat log — a live, still-answerable
card read **"undefined — reroll the d20"**. Every display string now re-derives its name
(`labelOf`). §4.1's rule applies to flags, not just to relayed envelopes.

### Verified live, and what is still not

✅ **Measured in the sandbox 2026-08-23**, after the fixes:

- every hook fires (`rollAbilityCheck`, `rollSkill`, `rollSavingThrow`) — none silent;
- a check offers **all three**; a save offers **heroic + bardic** and correctly **excludes
  tactical**;
- the bardic die resolves to **d8** from the granting bard;
- ⚠ **the demanded-save WITHHOLD holds and then RESUMES** — the target stays `done: false` while
  the offer is live, and after a pass the verdict lands (`outcome: "failed"`, card `done`).
  **That was the one path that could have swallowed a save verdict in a live game**, so it was
  measured before prod saw it.

✅ **THE ATTACK PATH IS TABLE-VERIFIED** — user, 2026-08-23, after the six fixes: spend → reroll
→ re-verdict → damage re-drive, exercised at the table along with checks and demanded saves.

✅ **AND IT IS COVERED NOW — §3 WAS WRITTEN 2026-08-23. The suite is 29/29** (was 21/21, with a
SKIP where this used to be). It drives the whole chain: forced miss → offer stamps → popup →
heroic reroll → REPLACE → verdict flips → damage re-drives.

⚠ **It was unreachable rather than unwritten, and that is worth knowing before writing another
one: the fixture fighter had no weapon.** The fixture grants an equipped PHB Longsword now.

⚠⚠ **THE DICE ARE FORCED, AND THAT TECHNIQUE IS THE REUSABLE PART.** Every other fold suite here
rolls until it happens to miss (`missUntilStamped`), which can test a STAMP but never an
OUTCOME — and whether a reroll turns a miss into a hit *is the feature*. Foundry routes every die
through `CONFIG.Dice.randomUniform`, and `Die#mapRandomFace(u) = ceil((1 - u) * faces)`, so a
face is chosen by inverting it: `u = 1 - (n - 0.5)/faces`. §3 forces **5, then 19**.
⚠ **Never 1 or 20** — a fumble and a crit take different paths through the verdict.
⚠ **Restore it in a `finally`**: a suite that left the PRNG stubbed would make every later
section deterministic without saying so.

✅ **That exactness bought the assertion that matters most.** Both rolls carry the same modifier,
so a **replace** lands on `base + 14` and equals the reroll's own total, while an **add** would
land on `base + reroll`. Measured: `base=10 → folded=24`, and an add would have been 34. **A
reroll modelled as an add would read as a lucky player and hit against a number nobody rolled.**

✅ **And the coverage instrument priced the gap immediately**: with §3 written, this one suite
went from **11/25 hook names and 58/81 registrations to 16/25 and 71/81**. The attack chain
simply was not being walked.

⚠ **One fold per offer round, by construction.** Spending one re-offers the rest *if the roll
still fails*; the flag carries a LIST of spends and `foldedRoll` composes `replace`-then-`add`,
so stacking is supported. What is not supported is ticking two at once — deliberate, so a player
never burns a Bardic die on a roll the reroll already saved.

⚠ **TACTICAL MIND'S REFUND STAYS UNMODELLED — USER RULING 2026-08-23, do not re-propose it.**
RAW is *"if the check still fails, this use of Second Wind isn't expended"*, so the rule is real
and the module does not implement it. It **cannot** implement it automatically: the refund is
conditional on the check FAILING, Tactical Mind fires only on ability checks, and no DC exists
for one (ruling 2b). A manual *"Refund — the check still failed"* button on the settled card was
offered and **declined**; the table adjusts Second Wind by hand when it comes up.

✅ **The other two are correct as built, and asymmetrically so — worth knowing before someone
"fixes" them.** Bardic Inspiration is *"expended when it's rolled"* and Heroic Inspiration is
*"you must use the new roll"*: both are spent whether or not they help, so a refund would be a
RULES BUG rather than a kindness. Only Tactical Mind has a refund clause at all.

### Fixtures (new, in the sandbox)

`BF Test Fighter` (Fighter 2 — Second Wind + Tactical Mind, clean PHB provenance) and
`BF Test Bard` (Bard 5, so its die is a **d8** and a wrong d6 default would be caught).
⚠ **`node tools/fixture-d20-folds.mjs` is idempotent and must be re-run after `smoke-d20-folds`
§2**, which really spends a Second Wind use to prove the consumption is real. The fixture refills
it — without that the third run asserts `after === before - 1` against an empty pool and starts
failing for a reason that has nothing to do with the code.

---

## ▶ The enforcement pass, as landed — the gate learned to see the import graph

**Executed 2026-08-23** from the architecture review that scored the tree **8/10**. The review's
finding was not about the code's shape — the foundation pass's claims all verified — but about
the gap between the shape and **what the gate could SEE**. Three things landed:

1. **`tools/check-layers.mjs`, in the gate as `npm run layers`.** It declares every file's LAYER
   (`entry → machines → services → spine → registry → decision → core`) and asserts **depend
   downward only**, with every non-downward edge PINNED and carrying a reason.
2. **ARCHITECTURE §2 and §7 name the SERVICES tier** — `auto-apply`, `effect-riders`,
   `auto-damage`. They own no feature; they are the consequence chokepoints every machine routes
   through. The four KINDS of code are unchanged.
3. **§10 D9** records the seven machine→machine edges. **Three repaid, four standing.**

⚠ **THE CHECK EARNED ITSELF ON ITS FIRST RUN.** It found **`saves.js` ↔ `d20-folds.js`, a two-way
machine cycle** shipped that same morning in v1.23.0 — `offerFoldOnSave` out, `foldSaveAnswer`
back, the withhold-and-resume protocol. Both halves lazy, both individually reasonable, both
commented. **A careful by-hand architecture review of the same tree, the same day, missed it.**
Nothing is wrong with the protocol; what was wrong is that nobody knew it was there.

⚠ **THREE HAND-COUNTS WERE WRONG, AND ALL THREE ARE NOW TOOL OUTPUT.** The lazy-import count
(docs said six, the review said seven, the tool says **nine**); the "~17 machine→machine edges"
(**nine of those were machine→SERVICE — downward all along**); and the pinned-edge tally, which
now distinguishes **pairs from call sites** because conflating them is how the commit count went
stale twice. **Do not type a graph number into prose again — quote `npm run layers`.**

⚠ **THE STALE-PIN RULE IS HALF THE VALUE, AND IT IS THE HALF THAT IS EASY TO OMIT.** An allowlist
row whose edge no longer exists **fails the build**. That is what forced three rows out of the
list when D9(a)/(b) were repaid — a pin that only ever permits would have sat there forever,
exactly as D2's evidence row did.

### What Stage 4 moved, and the prediction it falsified

| Move | Order-neutral? |
| --- | --- |
| `combatStamp`: `mastery.js` → `core.js` | ✅ **Yes, PROVEN** — the tool's printed evaluation order is byte-identical before and after. The entry already evaluated mastery before maneuvers. |
| `dramaticVerdictPause`: `concentration.js` → `ui.js` | ⚠ **NO — the plan predicted neutral and was WRONG.** |

⚠ **The §7 trap fires in the direction nobody watches.** The doc warns that *making a lazy edge
static* reorders hooks; **removing a static edge does it just as hard.** `mastery.js` importing
`concentration.js` had been pulling concentration's evaluation **ahead of the entry order**, and
dropping that import moved it LATER on five hooks (`renderChatMessage`, `create`/`update`/
`deleteChatMessage`, `damageActor`).

**All twelve hook-order assertions still pass, and the move is unobservable — but that had to be
CHECKED, not assumed**, and here is the check so nobody re-derives it:

- **concentration's row renders only on its OWN ask card** (its `renderChatMessage` reads the
  `concentration` flag, which lives on the ask message; a `d20fold` flag lives on the ROLL
  message). There is no shared card, so there is no row-order to get wrong.
- every handler whose order changed reads a **disjoint flag namespace** — `d20-folds`'s
  update/delete handlers gate on `d20fold` and its own popup key; concentration's gate on
  `concentration`.
- ⚠ **the one genuinely contended pair is preserved in both orders**: concentration before
  `saves.js` on `createChatMessage`, where a save roll could be folded by either.

> **The lesson, and it is the same one D2 taught:** the reasoning was sound and still wrong.
> What settled it was **diffing the tool's printed evaluation order before and after** — a
> measurement that takes ten seconds and that no amount of careful thinking substitutes for.

### ⚠ The battery's one red was a DRAINED FIXTURE, and the battery now seeds it itself

`smoke-d20-folds` came back **20/21**, failing *"every eligible fold is offered, not just the
first"* with `offers=[heroic]`. **It is not a regression, and the proof is cheap to repeat:**
re-run `tools/fixture-d20-folds.mjs` and the same code gives **21/21**, the assertion flipping to
`offers=[heroic, tactical]` and Second Wind reading `2 → 1` instead of `1 → 0`. Its own section 2
SPENDS the Second Wind that section 5 needs Tactical Mind to be offerable on.

⚠ **`battery.mjs` knew this and did nothing about it** — the fact sat in a source comment and in
the entry's own note (*"needs tools/fixture-d20-folds.mjs"*), so every battery inherited whatever
the previous run had drained. **`fixture-d20-folds` is a battery STEP now** (`reset: true`, the
same shape as `reset-fixture-state`), immediately before the suite that spends it. A front door
that reports a red for a missing seed is a broken gauge, and this one cost a full battery to
diagnose.

---

## The prod deploy — and why the byte-check lied

⚠ **A SLEEPING MOLTEN BOX MAKES `deploy-house-module.mjs --check` REPORT NONSENSE THAT LOOKS LIKE
DATA.** Seen 2026-08-23: the check reported all 28 files DIFFER with **the same `deployed` hash
for every one of them**. That hash was the sha of Molten's **management-lobby HTML** — the box was
`status=NOT_RUNNING` and its load balancer answers *every* path, including files that do not
exist, with a 200 and the same 9,146-byte page.

**The tell is the repeated hash**, and it is worth knowing because the failure is silent in the
dangerous direction: a real deploy PUTs first and reads back second, so it would have uploaded
into that same catch-all and reported "did not match" whether or not anything landed.

- Wake it by GETting `MOLTEN_MAGIC_URL` (the bridge's own `wake()`), then **poll until
  `PROPFIND /Data/` returns 207** — not until the host answers, which it does while asleep.
- Boot took **~80 seconds**, through `STARTING` → `403` → `207`.
- Only then is `--check` meaningful. It then read 28 distinct hashes and 7 honest 404s (the six
  `scripts/decide/` files and `scripts/geometry.js`, all new since prod's v1.20.0).
- ⚠⚠ **`scripts/verify-wake.mjs` IS NOT A WAKE HELPER — DO NOT RUN IT TO WAKE PROD.** Its name
  reads like one. It is a TEST OF the wake path, and **phase 1 fires `game.shutDown()` to create
  the cold state it wants to verify** — against whatever world is running. Run 2026-08-23 on
  PROD by a reader who trusted the name: it woke the box, connected, fired the shutdown, and
  **aborted safely** only because the world did not reach the no-world state inside ~3 minutes.
  Prod stayed up and nothing was lost, but that was the abort guard, not the plan.
  **To wake prod, GET `MOLTEN_MAGIC_URL` and poll `PROPFIND /Data/` for a 207** — or simply run
  `deploy-house-module.mjs <id> --check` and read whether the hashes are DISTINCT.
- ⚠ **The deploy never deletes.** Checked for orphans before pushing: only `LICENSE` and
  `README.md`, which the deployer deliberately never uploads. **No stale JS.**
- `esmodules` names only `scripts/battleflow.js`, so the new `decide/` files load through the
  import graph on a world reload — **no process restart needed for the code**. Only the displayed
  version string lags until the box next restarts.

---

## ▶ The rest of the survey — still unscheduled

**The standing "no features" directive is satisfied and lifted.** The three surveyed d20
features are BUILT — see *The d20 folds, as landed* above, which supersedes the scoping that
used to sit here and corrects three of its claims.

⚠ **Two content facts from that survey are still worth keeping, because they are not findable by
guessing and both are still unmodelled:**

- **Heroic Inspiration's rules text**, quoted verbatim in the popup (presentation law 8), is
  `dnd5e.content24` → *Appendix D: Rule References* → page **`nkEPI89CiQnOaLYh`**. ⚠ The full
  text is **wider than what shipped**: *"any die"* reaches **damage rolls**, and the transfer
  clause — *"it's lost unless you give it to a player character who lacks it"* — is a **second
  unmodelled half**. Widening to any-die/any-outcome is what triggers §11 rule 4's auto-revert.
- **Tactical Mind's refund is still unmodelled** — *"if the check still fails, this use of Second
  Wind isn't expended."* ⚠ And it is now known to be **unbuildable as an automatic rule**: the
  refund is conditional on the check FAILING, and the module cannot know a check failed, because
  no DC exists. It is a GM ruling or a player-pressed un-spend, not arithmetic.

### Also waiting, unscheduled

| Item | Shape |
| --- | --- |
| **Guidance / choice-bearing effects** | An effect applied without asking the choice it carries — the d4 landed on every ability check. Same family as Careful Spell. Needs a "choice" moment kind. |
| **Light-family spells apply token light** | Cast on a shield, attached no light; the table hand-toggled a torch. |
| **Short-duration effect expiry** | Mastery chips get a 1-round duration and nothing sweeps an expired one. ⚠ Do not build before deciding whether the module should own turn-time at all. |
| **AC5e adoption** | ⚠ **Vendor and modify, never import** (user call — R2 rules out the dependency). And it is **complementary, not an alternative**: AC5e *decorates* rolls where this module *applies*. |

---

## The standing directive

**The old one — "correctness and architecture only, no features, none considered" (user,
2026-08-22) — is SATISFIED and lifted.** The refactor closed, the foundation pass closed behind
it, every debt row is repaid or settled, and v1.22.0 carries the lot.

**What replaces it is narrower and permanent:**

> **A new feature walks [ARCHITECTURE §11](ARCHITECTURE.md)'s checklists.** All of them —
> including the three the foundation pass added: *"Adding a TEST"* (the tier rule), *"Adding a
> FOLD"*, and *"Converting a write to the serializer"*.

That is what the foundation was for. ⚠ **And one thing does not change: the UI/UX and the shipped
behaviour are the asset being protected.** Every stage of the refactor was measured to cost zero
features, and that measurement is the standard.

✅ **The d20 folds are the first feature to walk it, and the foundation paid.** The whole of the
arithmetic was already built and unit-tested (D8), `SAVE_FOLDS` accepted its first entry with **no
change to the save resolver**, and the two pins refused the change until they were moved on
purpose — which is exactly what they are for. **The new work was entirely offer/spend/present**,
which is what the survey said it would be. What the survey got wrong was the *content*, not the
architecture.

---

## Design rulings — binding

**1. THE FOLD COMPOSES; IT DOES NOT ORDER (2026-08-23, the D8 blocking ruling).**

> Folds carry **contributions to the two numbers**, not verdicts to be ranked. The attacker's
> folds move the TOTAL, the defender's move the AC, and the verdict is computed **once, at the
> end**: *"18 + 4 = 22 vs AC 20 (Shield) — hits."*

⚠ **Precedence stops existing**, which is why this is the only answer that cannot be wrong about
a case nobody thought of. ⚠ **Both rejected options are recorded, because both are the obvious
thing to re-propose.** *"The defender always wins"* keeps the old behaviour and **silently eats a
spent resource** — a player burns Heroic Inspiration into a shielded target and gets nothing.
*"Last fold wins"* reads correctly in time but tests the new total against the **stale snapshot
AC**, announcing a hit against a number the defender has already changed.

**2. A FOLD THAT REVERSES AN APPLIED VERDICT AUTO-REVERTS ITS RECEIPT (2026-08-23).**
⚠ **NOT the house Graze precedent** (*"⚠ Graze already paid on the miss — revert its receipt if
you rule it void"*), which was the option beside it and was **not** taken. ⚠ **Nothing ships that
can trigger it yet** — a hold WITHHOLDS application rather than undoing it, and precision only
turns misses into hits — so it is a debt the first outcome-reversing fold must pay, on the
`revertPlan`/`revertableEffect` machinery that already exists.

**2b. THE MODULE OFFERS AUTOMATICALLY ONLY WHERE IT OWNS THE NUMBER (2026-08-23, user ruling).**

> An attack has an AC on its own target snapshot. A save the module DEMANDED has a DC the ask
> owns. **A raw ability or skill check has neither, and never will** — dnd5e records no DC for
> one anywhere. Where the number exists, the module may offer on the failure. Where it does not,
> **the offer is a button the human presses**, because they were told the DC and the module was
> not.

⚠ **This is the strict-parse rule applied to a GATE instead of a list** — refuse to guess — and it
generalises past the d20 folds: any future feature triggered by *"when you fail X"* must first ask
whether the module can know that X failed. ⚠ **The `d20FoldAsk` setting does not override it**:
that setting turns auto-offering off, it cannot turn it on where no number exists.

**3. Action economy is not the module's job.** Reactions, actions and bonus actions are tracked
by the humans at the table. ⚠ **The code already agrees and the naming misleads:** every read of
`reactionSpent` is an *offer gate*, never enforcement — nothing anywhere blocks a cast or refuses
an action. [hold.js:256](scripts/hold.js:256) names it correctly: **the click-volume guard**.
Read it as *"don't nag this actor again this turn"*, not as a resource.

**4. Consequently there is no reaction-budget abstraction, and none is wanted.** A proposal for
one was raised and **rejected**. Do not reintroduce it.

**5. Vendor and modify, never import.** Any third-party rules content (AC5e is the live example)
is copied in and owned, because R2 rules out the dependency.

**6. TIER 2 IS CLOSED BY DECISION — do NOT "fix" it.** D4 (the flag accessor layer) is
**dropped**; `hold.js` ↔ `auto-damage.js` and `auto-apply.js` ↔ `mastery.js` are **permanent**.
⚠ The first of those cycles is **load-bearing**: the bare `import "./auto-damage.js"` pins module
evaluation order and `check-hook-order` depends on it — break it and the damage-offer bar
silently drops below the hold row. Doing this work would make the tree worse.

---

## Do not re-derive — claims that look right and are wrong

Negative results are the expensive kind. Each was investigated and **refuted**; each is the sort
a fresh reviewer reports as a bug.

| Claim | Why it's wrong |
| --- | --- |
| "`saves.js` is a god-file, split it" | **1,589 lines** measured 2026-08-23, and falling — Phase 2 took its arithmetic out. The house rule is one-file-per-phase with a **measured ~4,500-line** trigger; the v1.6.1 split fired at 4,504. |
| "`rollSavingThrow(…, {configure:false})` loses aura/condition modifiers" | It doesn't. dnd5e computes ability mod, proficiency, save bonuses and condition-derived adv/dis **from actor data before any dialog exists**; `configure:false` skips only the dialog. smoke-saves proves it by forcing outcomes through `abilities.con.bonuses.save`. **Reported once as a live table-facing bug; cost real work to kill.** |
| "check-hook-order is too narrow at 10 assertions" | Its contract is deliberate: print the full order for review, assert only the **load-bearing pairs**. |
| "The Sunlight Sensitivity incident implicates the save path" | It doesn't — that was an **attack** roll, which the module observes rather than rolls, and Sunlight Sensitivity isn't modelled as actor data in 5.3.3, so the native dialog wouldn't have applied it either. |
| "Removing the `sleep()` calls recovers about four minutes" | Of 213s measured, **73s sits under an assertion that something did NOT happen** — you cannot wait for a non-event, so those sleeps ARE the assertion's window. Two of `smoke-hold`'s say so in their own comments. |
| "A shared page-helper bundle cuts every suite roughly in half" | An estimate nobody had measured. `smoke-hold` is ~1,800 lines because of its **sixteen scenario blocks**, which no bundle touches. The cheap half — the plan travelling as DATA — is done and costs three lines per suite. |
| "Two-client coverage is the least certain work in the plan" | It was the **cheapest** of the three stages. What was missing was a **player-owned fixture**, not a technique. |
| "`probe-volley-resources` can be promoted to a suite section" | It had **no assertions at all** — a forensic that printed JSON and exited 0. There was never a section to promote it to. Retired; git keeps it. |
| "The fold precedence just needs a rule written down" | It needed the **question dissolved**. Any ordering is wrong about some case; composition leaves nothing to order. See ruling 1. |
| "`checkJs` needs a JSDoc project first" | **One compiler flag.** With `checkJs`, `scripts/decide/` reports 101 errors and **100 are "implicitly any"**; with implicit-any allowed, **zero** — the layer was already clean under `strict`/`strictNullChecks`/`noUncheckedIndexedAccess`. The type check is in the gate over those six files now. |

⚠ **Distrust the risk labels.** Twice the item billed as the one that should make anyone nervous
(D2, then two-client coverage) was the cheapest, and the surprises came from elsewhere: a **stale
measurement** (D2's own evidence row), a **checking apparatus that agreed with itself** (the gate
re-declared `VOLLEY_KINDS` as a lookalike, and was checking two-thirds of the interrupt list while
reporting a pass), and an **estimate nobody had taken** (the sleep budget). **Re-measure before
scoping.**

---

## Reference — worth reading before designing

### The `preRollD20TestV2` seam, measured in the dnd5e 5.3.3 source

⚠ **Not every d20 goes through it**, which is why "just hook the d20" is not a plan:

| Roll | carries `"d20Test"` in `hookNames`? |
| --- | --- |
| attack · ability check · saving throw · skill/tool · initiative dialog | ✅ |
| **death save** | ❌ `["deathSave"]` only |
| **concentration** | ❌ `["concentration"]` only |

### The ownership test every shared helper has to pass

**This codebase's shared helpers keep breaking on WHO OWNS THE WORK, not on what the work is.**
The hold's clock is owned by the **continuing client** while every other clock is owned by the
**elect**; the hold's relay fold is the same split. Both look like duplication and are not.
**Unify the mechanism, keep ownership pluggable** — and before merging two things that look
alike, ask who runs each one. That is why the §4.1 relay is a *registry* with an `owns` column
rather than a merge.

### The duplicate census — finished as a routine

Three runs took **nine copies → one → none**. The last (after D8) found 25 duplicated 3-line runs,
the same count as the run before it and not one new cluster. **Run it when something feels copied,
not on a schedule.** It is a ~20-line script over `scripts/**`.

---

## Operational

⚠ **Four rules that used to live here are CODE now**, and are listed only so the next reader
knows why the tooling looks like it does.

- ✅ **"Always redirect a suite to a file"** → `battery.mjs` captures every suite before
  summarising, and prints the failing lines besides. **Running one by hand? Still redirect it.**
- ✅ **"Run one at a time"** → a pid lock in `harness.mjs`. ⚠ The sole-GM preflight never could
  enforce this: two suites join as the **same user** and it counts users, not sockets.
- ✅ **"The version bump touches TWO fields"** → `node tools/bump-version.mjs minor`, and
  `--check` is a gate step.
- ✅ **"No release from a tree that fails the gate"** → `build-release.ps1` runs it first, with
  **no skip flag**.

Still yours to remember:

- **Restore world settings to the reference table after any test run. Verify, don't assume.**
  ⚠ A crashed run **launders its pins** into the next run's "prior", so eleven settings can drift
  while every suite reports success; only the external table catches it. `battery.mjs` ends by
  running it; a hand-run suite does not. `--snapshot` removes the hazard by construction.
- **Deploy without a bounce serves cached scripts**: stop → `deploy --local` → start. Hard-refresh
  both browser windows.
- ⚠ **AND A BOUNCE-LESS DEPLOY LEAVES `module.json` BEHIND — SILENTLY, AND ONLY THAT ONE FILE.**
  Scripts, styles and templates are served off disk per request, so a world reload picks them up.
  `game.modules` is built from a registry scan at **process boot**, so a manifest change — the
  version string, a new `esmodules` or `styles` entry — does **not** take effect until the
  Foundry PROCESS restarts. Deploy without stopping and you get every script updated, the
  manifest stale, and **a world that runs perfectly on top of the gap**. ⚠ **Nothing surfaces
  it**: it survived a full green battery in exactly this state on 2026-08-23, and the only
  thing that named it was `deploy --local --check` reporting `module.json` and nothing else.
  **A `--check` that names exactly one file, and that file is `module.json`, IS this.**
  ⚠ It bites hardest right after a version bump, because the bump is a manifest-only change:
  the tree, the release and prod can all agree on a version the sandbox is not serving.
- ⚠ **The zip is the one artifact nobody exercises, so it is the one that rots.** Two release bugs
  have hidden there (backslash separators v1.1.0–v1.1.15; the missing `scripts/decide/` after
  Phase 2). The builder now re-reads the finished archive and proves every relative import
  resolves inside it — **and read its file list at every release anyway**, which is how the
  second one was found.
- ⚠ **Release notes are HAND-WRITTEN into `dist/RELEASE-NOTES.md`, never `NOTES.md`** — that is
  the internal working-knowledge doc, and publishing it would put every hard-won finding on a
  public page. The builder's usage comment said otherwise until 2026-08-23; the comment was wrong,
  not the practice.
- ✅ **THE NO-OP HANG-UP — found AND repaired 2026-08-23.** `f.disconnect` **did not exist on
  `Foundry`; the method is `dispose()`**, and `f.close` was the same lie in two more files. Every
  suite ended with `await f.disconnect?.()` and the optional chain had been swallowing it since
  the harness was written — the ceremony was decorative and the session was really torn down by
  process exit. **That is D11's own failure class living inside the test tooling**: a call that
  reads correctly, does nothing, and reports nothing. ⚠ **It was found by the hook ledger, which
  needed a teardown seam and discovered there wasn't one.**
  ⚠ **`disposeSafely(f, tag)` in [harness.mjs](tools/harness.mjs) is now the only way to hang up,
  and it RACES `dispose()` AGAINST A 10-SECOND CEILING.** That is not caution for its own sake:
  the suites arm a watchdog that hard-aborts the process (exit 3), so a `dispose()` that hung —
  on an in-flight connect that never settles, or a browser that will not close — would turn a
  GREEN run into a watchdog abort, **strictly worse than the no-op it replaces.** After ten
  seconds it is abandoned to process exit, which is exactly where it had been living all along.
- Two windows at the table (GM + a player owning Thomas/Morgash). **"Nothing popped" must always
  ask WHICH WINDOW.**
- **First-suite-after-cold-boot is a real flake class** — re-run before diagnosing.

---

## The parallel session

⚠ **THERE WAS A SECOND LIVE SESSION IN THIS REPO ON 2026-08-23** (`fvtt-mod-battleflow-e0`), and
it wrote a *RESCUE PASS* proposal into this file. ✅ **The user DROPPED it on 2026-08-24 and the
section is deleted** — see *SETTLED*. It was never the work of the session that produced D10, D11,
`smoke-d20-folds` §3 and §7, or the teardown repair — those are commits `d2bc2e1`…`cec478d`.
⚠ **The lesson worth keeping: a proposal written by one session reads exactly like state to the
next one.** It sat at the top of this file for a day carrying four rulings addressed to a user who
had never seen the problem it described. **A plan nobody asked for belongs in a branch, not in the
continuity doc.**

⚠ **And the operational point a cold reader needs: the sandbox is single-occupancy.** Two sessions
driving suites collide — the pid lock refuses one of them, and a half-run suite leaves the world
dirty. **Establish who owns the box before running anything.**

A second Claude session ("fvtt-mod-battleflow-a1") audited this tree on 2026-08-22. **Reference
only — it is not a guide**, and it is now well out of date. Every claim of its that mattered was
re-verified and three were corrected; it also caught a real error of ours and contributed the
ownership rule above. **Prefer its file:line pointers; distrust its categories and its urgency.**

⚠ **Do not assume a Claude session owns any doc in this tree on the basis of timing.** Three
commits landed within ~70 seconds on 2026-08-22, authored like every other; that inference was
made here once and was wrong.
