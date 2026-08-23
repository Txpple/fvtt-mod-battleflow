# HANDOFF.md — picking this up cold

> **What this file is:** continuity only — current state, the standing directive, and the
> verified work list. The permanent docs are [DESIGN.md](DESIGN.md) (north stars),
> [ARCHITECTURE.md](ARCHITECTURE.md) (the shape) and [NOTES.md](NOTES.md) (what it cost);
> [PLAN.md](PLAN.md) is the temporary stabilization tracker. **This file does not duplicate
> them.**

## State at a glance — 2026-08-23 (the foundation pass)

| | |
| --- | --- |
| **Do first** | 📋 **PUBLISH v1.22.0 — two commands, and they are the only thing left.** Stages 1–4 of the FOUNDATION PASS are **done, committed and battery-green**; the version is bumped and the **zip is built and proven self-contained**. ⚠ **What is NOT done is deliberate:** `gh release create` and `git push` put artifacts on a public repo, which is your call rather than an autonomous one. Both are written out verbatim under **THE RELEASE, READY TO GO** below, with a release-notes draft beside them. |
| **The foundation is FINISHED** | The refactor closed on 2026-08-23 and this pass closed the rest: **every architecture debt row is repaid or settled by decision** (ARCHITECTURE §10 — D4 dropped, both surviving cycles permanent, D8 closed here), every live suite is **section-filterable**, the battery is **one command**, and the two cross-client properties that no single-client suite could reach are **tested**. ⚠ **After the release, feature work resumes** — see the exit condition below. |
| **Parity** | ✅ **PROVEN 2026-08-23 after D8** — the full battery on a sandbox carrying HEAD byte-identical (stop → deploy `--local` → start), **every suite green, `verify-settings` CLEAN, 19m58s** for all thirteen entries. battleflow ALL PASS (33) 89s · hold ALL PASS (44) 129s · saves **74/74** 252s · volleys 39/39 47s · maneuvers 54/54 150s · cast 17/17 · riders 8/8 · concentration 47/47 · **twoclient 9/9** · popup-routing ALL PASS · effects 54/54 (first run, no re-run needed) · resources 18/18. ⚠ **D8 is the only stage that changed shipping code**, and it changed the most consequential arithmetic in the module — this battery is what says it cost nothing. Captured in full to `dist/battery/<stamp>/`. |
| Repo | `main`, clean, **NOT pushed** — **four commits** sit above `origin/main`: stages 1–2, stage 3, D8, and the version bump. |
| Release | ⚠ **v1.21.0 is the last PUBLISHED release.** Everything since is unreleased and that is deliberate: this release carries the lot. ⚠ **Prod still runs v1.20.0, by instruction.** |
| Verify gate | `npm run verify` — **EIGHT static checks**: biome (**95 warnings, 0 errors — the new baseline; it was 98 before the three probes retired**), knip, **typecheck**, imports (**267 bindings**), hook order (75 registrations, 10 pairs), registry (**12 checks**, and it prints the R4 kinds table), **manifest in-step**, comments (306 blocks / 27 files), then vitest **215**. ⚠ **`typecheck` is REAL now, and only over `scripts/decide/`** — six pure modules opted in with `// @ts-check`. Measured before switching it on: with `checkJs` the layer produces **101 errors, 100 of them "implicitly any"**, and with implicit-any allowed it produces **ZERO**. So the checker was one flag away from being useful and a whole JSDoc project away from being strict; the flag is off, the annotations are the later job, and D7's last gap is closed where it pays most. ⚠ **Two numbers are PINNED and fail the gate deliberately**: the R4 kind total (16) and the **source-file count (27)** — the last hand-carried number in the tree, wrong twice in published docs before it was asserted. |
| **Testing** | ⚠ **Read this before running anything.** `node tools/battery.mjs` is the front door: it runs all thirteen entries in the order that works, **captures every one to a file before summarising**, and finishes with `verify-settings`. Every suite takes `--list` and `--section N`; a filtered run stamps itself **`⚠ PARTIAL RUN`** and lists what it skipped. ⚠ **Measured, including where it does not pay:** `smoke-hold --section 5` is **25s against 129s**, `smoke-saves --section 18` **93s against 252s** — and `smoke-battleflow --section 5d` is **~90s against 89s**, because that section waits out two real buzzer windows and IS the suite's wall clock. Filtering pays when the section is small relative to the suite. ⚠ **One suite at a time is now ENFORCED** by a pid lock in `tools/harness.mjs` — the sole-GM preflight structurally cannot see a second suite, because both join as the same user and it counts users, not sockets. |
| Sandbox | ⚠ **HEADLESS.** `node <mcp>/scripts/local-foundry.mjs start|stop|status|restart`; deploy with `node <mcp>/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local` (never without `--local`). Never the Electron app for suites (dataPath lock). **Stopped, deployed and restarted for the D8 battery**, so it carries HEAD byte-identical. |
| Bridge | Disconnect before any suite. Suites join as `Tester Assistant`; the two-client ones also join as `PC Assistant`. |
| Flakes | ⚠ **`smoke-battleflow` "2 FAILURE(S)" is STILL NOT DIAGNOSED** — twice seen, never reproduced. Nothing here claims to have fixed it. **What changed is that its evidence can no longer be lost:** both sightings had their assertions thrown away by a `| tail`, and the battery now captures the full body first and prints the failing lines besides. **If it recurs it will name itself.** |

---

## ▶ NEXT — Stage 5, and then features

### THE RELEASE, READY TO GO

Everything before Stage 5 is done. The release is four commands; **the first two are run, and
the last two are yours because they publish.**

✅ **The first two are ALREADY DONE**, and their output is on disk:

- `node tools/bump-version.mjs minor` → **v1.22.0**, both fields, committed (`d6951f3`).
- `powershell -ExecutionPolicy Bypass -File tools/build-release.ps1` →
  `dist/fvtt-mod-battleflow.zip`, **30 entries, 219,469 bytes**, forward slashes verified, and
  every relative import inside the archive proved to resolve to another file in it.

Re-run them only if you change something. If you want a different version number, the bump is
reversible: `node tools/bump-version.mjs 1.21.1`, then rebuild.

⚠ **`build-release.ps1` now runs `npm run verify` and `bump-version --check` before it packs
anything, with no skip flag** — there is no longer a way to build a release from a tree that
fails the gate. **Read the builder's file list at every release**: it is how the missing
`scripts/decide/` directory was caught, and the zip is the one artifact nobody exercises.

Then, the user's to run:

```bash
gh release create v1.22.0 --title "v1.22.0 - the foundation" --notes-file dist/RELEASE-NOTES.md dist/fvtt-mod-battleflow.zip module.json
```

⚠ **The notes file is HAND-WRITTEN, and it is NOT `NOTES.md`.** `build-release.ps1`'s usage
comment named `NOTES.md` until 2026-08-23 — that is the internal working-knowledge document, and
publishing it would put every hard-won Foundry finding and every process scar on a public page.
Every release so far in fact carried hand-written notes (see v1.21.0), so the comment was wrong
rather than the practice. **A draft for this release is in `dist/RELEASE-NOTES.md`** — read it,
edit it, it is not published until you say so.

And the four commits, which are not pushed either:

```bash
git push origin main
```

⚠ **Prod is the USER's call and always has been.** It has run pre-refactor code throughout,
deliberately.

### THEN: features, and the scoping is already done

**Heroic Inspiration, Tactical Mind and Bardic Inspiration are ONE KIND, and the module already
ships a member of it** — Precision Attack. **Scope them together.** D8 is what makes them cheap:
each is now a registry entry plus whatever stamps its flag, not another parameter on `hitsAmong`.
⚠ **Read ARCHITECTURE §11's "Adding a FOLD" checklist first** — in particular its rule 4, the
auto-revert debt the first outcome-reversing fold has to pay.

---

## 📦 THE FOUNDATION PASS — ✅ STAGES 1–4 DONE 2026-08-23, battery-green

The user's directive, stated three times: **an excellent foundation before features resume.**
Four stages, three commits, no feature work in any of them. **[PLAN.md](PLAN.md) § THE
FOUNDATION PASS carries every checkbox and every finding** — this is the map, not the territory.

| # | Stage | What it actually produced |
| --- | --- | --- |
| **1** | Testing speed and structure | `tools/harness.mjs` (the twenty lines 26 files copied, plus the **suite lock**), every live suite **section-filterable**, the convertible sleeps converted, `tools/battery.mjs`, and the tier rule written into ARCHITECTURE §11 |
| **2** | Tooling and process debt | `bump-version.mjs` (both manifest fields, and `--check` is now a gate step), the release build **gated**, the three probes gone — two folded into suites, one retired — and the source-file count pinned |
| **3** | Two-client coverage | `smoke-twoclient.mjs`: the relay's **relayed** half and D2's **cross-client popup close**, 9/9 first run. `check-popup-routing` asserts instead of dumping |
| **4** | **D8 — the last architecture debt** | The post-roll fold is a **mechanism**: `ATTACK_FOLDS` / `SAVE_FOLDS`, composed rather than ordered, and the save side that did not exist. Unit assertions 184 → **215** |

### The three things worth carrying out of it

⚠ **1. THE SOLE-GM PREFLIGHT CANNOT SEE A SECOND SUITE, and that cost a real run.** Two suites
against one box both join as `Tester Assistant`, and `preflightSoleGM` counts **users, not
sockets** — one user, one GM, preflight green. A second suite started mid-run, re-pinned six
settings underneath `smoke-maneuvers`, left an orphaned fixture actor, and nothing said a word.
`harness.mjs` takes a **pid lock** now: the second starter refuses and names the first.

⚠ **2. MOST OF THE REMAINING `sleep()` CALLS ARE LOAD-BEARING.** The plan expected to recover
four minutes. It cannot be recovered: of 213s measured, **73s sits under an assertion that
something did NOT happen**, and you cannot wait for a thing not to occur. Two of `smoke-hold`'s
say so in their own comments. **What was convertible is converted; what is left is deliberate,
and the docs now say which is which.**

⚠ **3. THE CONVERSION TRAP FIRED TWICE, BOTH TIMES ON THE FIRST ATTEMPT.** PLAN.md warned:
*convert the wait to the thing the NEXT ASSERTION READS*. Waiting for the BANNER is not waiting
for the durable card LINE (three `smoke-resources` assertions went red on a working module), and
waiting for `status === "resolved"` is not waiting for the two rolls that post after it
(`smoke-volleys` 38/39). **A cast has three surfaces and they arrive at three different moments.**

### And one hazard the section filter created

⚠ **A BINDING DECLARED INSIDE ONE SECTION GATE AND READ FROM ANOTHER PASSES A FULL RUN.**
Declaration order is unchanged, so it throws only under `--section`. Three were found by static
scan before any suite ran; the sharpest was `smoke-maneuvers` §H deleting §B's and §I's fixtures
**by binding** — it deletes by NAME now. **After gating a suite, scan for names declared in one
gate and read outside it.**

---

## Phase 3 — registries unified, DONE 2026-08-23, battery-green

`a30cfd5` stage 1 · `fd8f77f` stage 2. **The plan undercounted it:** six membership lists, not
four — five parsers with **four** different failure behaviours (default-to-`ac`, silent drop,
drop-and-report, no validation at all), and only one of the five declared its kind set in code.
Which behaviour a list had was an accident of which session wrote it.

Now every list is a **spec** in [decide/registry.js](scripts/decide/registry.js) and `parseList`
is the one parser; `listEntries` in [settings.js](scripts/settings.js) is the one warn-once path
(maneuvers.js had the only implementation, so **four of the five lists failed silently**);
`api.registries` is the read-only exposure.

⚠ **What was NOT forced into one shape:** `blockList` and `riderUpgrades` are *relations*
(spell↔reaction, feature↔rider), not kind-tagged memberships. A `kind` column on them would be
false unification. `riderList` entries became `{ name }` objects — the one caller-visible change.

⚠ **Two defects found in the CHECKING apparatus, not the module:**
- the gate re-declared `VOLLEY_KINDS` as a lookalike, so it could agree with itself while
  disagreeing with the shipping registry — the exact defect Phase 2 removed for the maneuver
  kinds, still standing in a file whose own comment takes credit for removing it;
- the gate had been **checking two thirds of the interrupt list and calling it a pass.** It
  scraped defaults from source with a regex it had itself flagged as fragile, and that regex
  ended a double-quoted string at the apostrophe in `Stone's Endurance`. Invisible while the
  check only asked "is it comma-shaped". **Defaults now live on the specs**, settings.js
  registers from there, and the gate asserts nobody re-inlines one.

**The R4 tripwire is now a number: 16 kinds across 4 sets, pinned.** Adding a kind fails the
gate. Counting them found that `nick` — the system's eighth mastery — was handled by a bare
`default: return`, which could not distinguish "deliberately native" from "never seen", so a
**ninth mastery in a future dnd5e release would have been swallowed in silence**. It is
declared now, and anything else in that branch warns.

⚠ **The tripwire pointed at a remedy the design rules FORBID.** "Adopt a conditions library" is
exactly the dependency R2 rules out. **User call: vendor and modify, never import** — which also
reconciles the backlog's finding that AC5e *decorates* rolls while this module *applies*, so the
two are complementary rather than alternatives. Corrected in DESIGN.md R4.

**The honest limit, recorded rather than papered over:** "kinds checkable against the system's
own enums" is true for **one of four** sets. Only masteries mirror a real dnd5e enum, and they
are already checked against it live by `check-mastery-rules.mjs`. The other three are the
module's own inventions — the system has no concept of an "interrupt kind" — so there is nothing
to check them against.

## Phase 4 — D6, DONE 2026-08-23, battery-green

`0e2380a`. **The `ui.js` ↔ `hold.js` cycle is gone, and D1 closed with it.** 349 lines of the
hold's own views left the spine for [hold.js](scripts/hold.js): `reactionImg`,
`reactionACBonus`, the clocks, `revealDetail`/`revealLine`, the card row, `castReaction`,
`holdPopupContent`, `showHoldPopup`. **ui.js 697 → 340 and imports no machine at all**;
hold.js 999 → 1,395. `auto-damage.js` is now the *only* importer of hold.js, and that is
hold's own feature API on the deliberate order-pinning edge.

⚠ **Three things deliberately did NOT move, each commented where it sits:**
- **the damage-offer bar** — not the hold's. It keeps its own registration in ui.js and still
  renders above the hold row because hold.js imports ui.js, so ui.js's body evaluates first.
  That used to be free (one shared handler); it is now the explicit assertion
  `ui.js before hold.js` in check-hook-order. **If ui.js ever stops being imported by hold.js
  the bar silently drops below the hold row, and only that assertion will say so.**
- **the delete SWEEP** — it clears every machine's popups, latches and acks off one
  `${messageId}|` prefix; splitting it would be the five-per-machine drift it exists to
  collapse. Only its `disarmHoldTimer` line came out, as hold.js's own one-line sweep — the
  shape every other timer-owning machine already uses.
- **`closeAnsweredPopups`** — it reads the hold flag by **string**, so it makes no import edge.
  A layering smell, recorded rather than fixed.

**The rule worth carrying:** a VIEW belongs with the machine that owns the FLAG it renders.
When a view lives in the spine, the spine must import the feature's vocabulary — and that is
the cycle, every time.

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

## The standing directive (user, 2026-08-22) — ✅ SATISFIED, and here is what replaces it

**It was: correctness and architecture only. No new features, and no feature work considered.**
The architecture had to be able to carry the surveyed features later — Heroic Inspiration, Bard,
Tactical Mind, AC5e adoption — as **design pressure and nothing else**: used to test whether a
seam was right, never as a reason to build one.

⚠ **THAT DIRECTIVE HAS BEEN MET.** The refactor closed, the foundation pass closed behind it, and
every architecture debt row is repaid or settled by decision. **The exit condition below was
asked and answered, and D8 was the last thing it named.**

**What replaces it, once Stage 5 ships:** features resume, and the three surveyed d20 features
are **one kind with one seam**. ⚠ The directive that survives is narrower and permanent:
**a new feature walks ARCHITECTURE §11's checklists** — including the two this pass added,
*"Adding a TEST"* (the tier rule) and *"Adding a FOLD"*. That is what the foundation was for.

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
in milliseconds and impossible to tangle. ✅ **Still true after D8** (re-checked 2026-08-23):
the fold registry lives in `verdict.js` and reaches nothing — the EDGE shell hands it a READER,
which is exactly the shape that kept it pure. **Keep it that way**: the day something in there
needs `game` or `canvas`, it is EDGE and belongs one layer up (§2 rule 1).

| Module | Holds |
| --- | --- |
| [decide/geometry.js](scripts/decide/geometry.js) | `honestDims`, `tokenCenter`, `tokenSamplePoints` — the v14 region-shim knowledge |
| [decide/registry.js](scripts/decide/registry.js) | the five world-setting list parsers |
| [decide/verdict.js](scripts/decide/verdict.js) | `hitsAmong`, `modeAdmits`, `saveOutcome`, `saveMultiplier`, `verdictText` — **and, since D8, the fold layer**: `ATTACK_FOLDS`, `SAVE_FOLDS`, `foldsFrom`, `foldedRoll`, `foldedVerdict`, `foldedSave` |
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

### 🔁 Census re-run after D6 — 2026-08-23

Run again after the structural stage, as this section prescribes. **27 files, 25 duplicated
3-line runs — and the yield has clearly fallen off**, which is itself the finding: the first
census collapsed nine copies into three helpers, this one found **one** worth taking.

| Cluster | Verdict |
| --- | --- |
| ×3 `polish.js` — `let activity = null; try { fromUuidSync(doc.getFlag("dnd5e","activity")?.uuid ?? "") } catch {}` | ✅ **TAKEN** — `activityOf(doc)` in [polish.js](scripts/polish.js). Byte-identical, one file, zero cross-file risk. The guard is not noise: `fromUuidSync` **throws** on an uncached pack uuid |
| ×2 `concentration.js`/`saves.js` — the adv/normal/disadv dialog rows | *left, again* — same call as last census: live callbacks, not a string formatter |
| ×3 `saves.js` — `let claimed = false; await queueFlagWrite(...)` | *left* — that is D3's serializer idiom with a different body each time; the shape repeating is the point |
| ×3 `mastery.js`, ×2 `concentration.js`, ×2 `hold.js` — `ChatMessage.create({speaker, content: bfCard({…})})` | *left* — announcement boilerplate whose only shared part is the two-line envelope |
| ×2 `maneuvers.js` — activity-from-flag resolution | *left, borderline* — two copies, and the `?.get?.() ?? contents.find()` shape is worth watching if a third appears |

⚠ **The census is reaching diminishing returns.** Two runs took nine copies and then one. It
is still cheap, but "run it after every structural stage" should probably become "run it when a
stage moved code between files."

### 🔁 Census re-run after D8 — 2026-08-23

**27 files, 25 duplicated 3-line runs — the SAME count as after D6, and not one new cluster.**
D8 moved the fold out of `hitsAmong`'s parameter list and into a registry, and it introduced no
duplication doing it. Every cluster on the list is one already ruled on: the announcement
envelope, the adv/normal/disadv dialog rows (left for the third time — live callbacks, not a
string formatter), the D3 serializer idiom, and maneuvers' activity-from-flag resolution, which
is **still ×2** and therefore still below the line the last census drew for it.

⚠ **Three runs have now gone nine copies → one → none.** The prescription in this section
("re-run after every structural stage") has produced its answer: the census is finished as a
routine. **Run it when something feels copied, not on a schedule.**

**The remaining Phase 2 list:** only the flag accessor layer's ~230 READS — and D3 having been
closed without it (`53495e4`) removes the argument that justified it. See the NEXT table.

---

## Design rulings — binding, made this session

**0. THE FOLD COMPOSES; IT DOES NOT ORDER (user, 2026-08-23 — the D8 blocking ruling).**
`hitsAmong` justified its precedence with *"the sets are disjoint, because a hold stamps hits
and precision stamps misses."* A reroll goes either way, so precedence had to be decided.

> Folds carry **contributions to the two numbers**, not verdicts to be ranked. The attacker's
> folds move the TOTAL, the defender's move the AC, and the verdict is computed **once, at the
> end**: *"18 + 4 = 22 vs AC 20 (Shield) — hits."*

⚠ **Precedence stops existing**, which is why this is the only answer that cannot be wrong about
a case nobody thought of. ⚠ **Both rejected options are recorded, because both are the obvious
thing to re-propose.** *"The defender always wins"* keeps today's behaviour and **silently eats a
spent resource** — a player burns Heroic Inspiration into a shielded target and gets nothing.
*"Last fold wins"* reads correctly in time but tests the new total against the **stale snapshot
AC**, announcing a hit against a number the defender has already changed.

**0b. A FOLD THAT REVERSES AN APPLIED VERDICT AUTO-REVERTS ITS RECEIPT (user, 2026-08-23).**
⚠ **This is NOT the house Graze precedent** (*"⚠ Graze already paid on the miss — revert its
receipt if you rule it void"*), which was the option beside it and was **not** taken. The module
undoes its own application rather than announcing and leaving the ruling to the GM.
⚠ **Nothing ships that can trigger it yet** — a hold WITHHOLDS application rather than undoing
it, and precision only turns misses into hits — so it is a **debt the first outcome-reversing
fold must pay**, written into ARCHITECTURE §11's "Adding a FOLD" checklist as rule 4. Building
the detector now would be machinery with no caller, which knip correctly calls dead code.

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
- ~~**The §4.1 relay**~~ — ✅ **DONE 2026-08-23.** Three hand-written copies now declare
  themselves to one registry in the spine (`registerRelay` in ui.js), served by a single
  registration: module-wide `createChatMessage` 15 → 13. ⚠ **The stated payoff was wrong** —
  "removes two registrations from the pinned hook order" is loose, because **no pinned pair
  touches `createChatMessage` at all**; the real payoff is one shape with pluggable ownership,
  so a fourth relay is an entry rather than a fourth copy. ⚠ The hold's fold stays owned by the
  **continuing client** and the envelope BYTES were deliberately left alone — see ARCHITECTURE §4.

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
| ↪ "saves.js at 1,734 lines is a god-file, split it" | The conclusion isn't right, and the number has since fallen: **1,589 measured 2026-08-23**. The house rule is one-file-per-phase with a **measured ~4,500-line** trigger; the v1.6.1 split fired at 4,504. The file is a third of that and shrinking, because Phase 2 took its arithmetic out. |
| ↪ "`rollSavingThrow(..., {configure:false})` loses aura/condition modifiers" | It doesn't. dnd5e computes ability mod, proficiency, save bonuses and condition-derived adv/dis **from actor data before any dialog exists** ([dnd5e.mjs:37467-37492](../../../Users/sippelmc/AppData/Local/FoundryVTT/Data/systems/dnd5e/dnd5e.mjs)); `configure:false` skips only the dialog. The suite proves it — smoke-saves.mjs forces outcomes by writing `abilities.con.bonuses.save` and asserts the `configure:false` roll lands on the forced side. **Reported once as a live table-facing bug; cost real work to kill.** |
| ✅ "check-hook-order is too narrow at 9 assertions" | Its contract is deliberate: print the full order for review, assert only the load-bearing pairs. |
| ↪ "The Sunlight Sensitivity incident implicates the save path" | It doesn't — that was an **attack** roll, which the module observes rather than rolls, and Sunlight Sensitivity isn't modelled as actor data in dnd5e 5.3.3, so the native dialog wouldn't have applied it either. An argument for condition automation, nothing more. |
| ✅ "Removing the `sleep()` calls recovers about four minutes" | **PLAN.md said it and PLAN.md was wrong.** Measured 2026-08-23: of 213s of unconditional sleeping, **73s sits under an assertion that something did NOT happen** — no hold stamped, no ask raised, nothing applied. You cannot wait for a thing not to occur, so those sleeps ARE the assertion's window, and shortening one weakens the test above it. What was convertible is converted; the rest is deliberate and commented. |
| ✅ "A shared page-helper bundle cuts every suite roughly in half" | An estimate nobody had measured. `smoke-hold` is 1,700 lines because of its **sixteen scenario blocks**, which are ~1,000 of them and which no bundle touches. The cheap half of the idea — travelling as DATA rather than source — is done and costs three lines per suite (the section plan). **Re-measure before attempting the rest.** |
| ✅ "Two-client coverage is the least certain work in the plan" | It was the **cheapest of the three stages**. What was missing was a **player-owned fixture**, not a technique; once `BF Test Player Shielder` existed, all nine assertions passed first run. The uncertainty was about standing the scenario up, and it evaporated on contact. |
| ✅ "`probe-volley-resources` can be promoted to a suite section" | It has **no assertions at all** — a bedrock forensic that prints JSON and exits 0, answering design questions the volley registry and the resource notice closed when they shipped. There was never a section to promote it to. The row was written without re-reading the file. **Retired; git keeps it.** |
| ✅ "The fold precedence just needs a rule written down" | It needed the **question dissolved**, not answered. Any precedence ordering is wrong about some case: "the defender wins" eats a spent resource, "last fold wins" tests a new total against a stale AC. The 2026-08-23 ruling **composes** — the attacker's folds move the total, the defender's move the AC, one verdict at the end — and there is nothing left to order. Do not reintroduce an ordering. |

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
hand count and now carries the re-measured figures. ✅ **AND THE LAST HAND-CARRIED NUMBER IS GONE (2026-08-23).** The
source-file count — 27 (`scripts/*.js` + `scripts/decide/*.js`), wrong twice in published docs
(20, then 26) — is `EXPECTED_SOURCE_FILES` in `check-registry.mjs` now, pinned beside the R4
kind total. Adding a file fails the gate until the pin moves, which is the point. **No number
in this tree is asserted nowhere any more.**

---

## Operational

⚠ **Three of the rules that used to live here are now CODE, and are listed as rules only so the
next reader knows why the tooling looks like it does.**

- ✅ **"Always redirect a suite to a file" — now structural.** `node tools/battery.mjs` captures
  every suite's full output to `dist/battery/<stamp>/` **before** anything is summarised, and
  prints the failing lines besides. ⚠ **This mattered twice**: `smoke-battleflow` reported
  exactly "2 FAILURE(S)" on 2026-08-22 and again on 2026-08-23, and BOTH TIMES the assertions
  were lost to a `| tail` and the class stayed unnamed. A suite prints its failures in the BODY
  and its count in the summary. **If you run a suite by hand, still redirect it.**
- ✅ **"Run one at a time" — now enforced.** `harness.mjs` takes a pid lock per target. The
  sole-GM preflight never could enforce it: two suites join as the same user, and it counts
  users, not sockets.
- ✅ **"The version bump touches TWO fields" — now a script.** `node tools/bump-version.mjs
  minor` moves `version` *and* the manifest `download` URL together; `--check` asserts they are
  in step and is part of `npm run verify`. The v1.20.0 walk-1 bump missed the download by hand.
- ✅ **"No release from a tree that fails the gate" — now a precondition.** `build-release.ps1`
  runs `npm run verify` and `bump-version --check` before it packs anything. **No skip flag.**

Still yours to remember:

- **Restore world settings to the reference table after any test run. Verify, don't assume** —
  `battery.mjs` ends by running `verify-settings`, but a hand-run suite does not. ⚠ A crashed
  run launders its pins into the next run's "prior", so eleven settings can drift while every
  suite reports success; only the external table catches it. `battery.mjs --snapshot` removes
  the hazard by construction for the run where it actually bites.
- **First-suite-after-cold-boot flake is a real class** — re-run before diagnosing.
- **`smoke-effects` has a documented dice-variance class** — re-run before diagnosing that too.
- ⚠ **The zip is the one artifact nobody exercises, so it is the one that rots.** `check-imports`
  reads the working tree; hot-deploy copies the working tree; nothing installs the archive. Two
  release bugs have hidden there (backslash separators v1.1.0–v1.1.15, and the missing
  `scripts/decide/` directory after Phase 2). `build-release.ps1` recurses and re-reads the
  finished zip to prove every relative import resolves inside it. **Read the builder's file list
  at every release** — that is how the second one was found.
- Two windows at the table (GM + a player owning Thomas/Morgash). "Nothing popped" must always
  ask **which window**.
- **Deploy without a version bump serves cached scripts until the process bounces**: stop →
  deploy `--local` → start. Hard-refresh both browser windows.

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
