# PLAN.md — the stabilization pass

> **Temporary.** This document tracks one piece of work: bringing a two-week high-velocity
> prototype up to a shape that can carry years of features. **Delete it when the last box is
> ticked.** It is not a fourth permanent document.
>
> Every item traces to a rule in [ARCHITECTURE.md](ARCHITECTURE.md). Nothing here changes what
> the module does at the table — **the UI/UX and the shipped behaviour are the asset being
> protected, not the thing being changed.**

---

## The one-line summary

The prototype is **good code with no shape**: 9,845 lines of well-commented, correct,
table-proven module, plus 14,409 lines of tooling, with **zero** static analysis, **zero** unit
tests, and one architectural rule (hook order) that is actually enforced. The work is to give
it a shape it already almost has, and to make the shape checkable.

| Metric | Start | Now | Target |
| --- | --- | --- | --- |
| Docs | 5,990 lines / 6 files | **2,051 / 4** (+ this tracker) | done — the growth is recorded findings, not restored inventory |
| Source | 9,845 lines / 20 files | 10,980 / **27** (pinned) | ~9,000 / ~26 files (thinner files, more of them) |
| Tools | 14,409 lines / 63 files | **12,426 / 31** | ⚠ **the line target was the wrong measure.** Files fell 63 → 31 and the count is what mattered; the lines went back up because two probes became suite SECTIONS (the same assertions, one fewer thing to remember) and because `harness.mjs`, `battery.mjs` and `smoke-twoclient.mjs` are new capability, not new copies. **The boilerplate this row was really about — the twenty lines in 26 files — is gone.** |
| Static checks | 1 (hook order) | **8** ✅ (lint, dead-code, **type check**, import integrity, hook order, registry integrity, manifest in-step, doc attachment) | ✅ done — the type check landed 2026-08-23 |
| Unit tests | 0 | **215, ~270 ms** ✅ | ~150 assertions, < 2 seconds, no Foundry |
| Lint findings | (unmeasured) | 0 errors / **95** warnings (98 before the three probes retired) | 0 / 0 |
| Live suites | 11 suites, ~8,500 lines, minutes each, run one at a time | **12 suites (a two-client one joined), every one section-filterable** ✅; one shared harness with a suite lock; `battery.mjs` runs all thirteen entries in order, captures each to a file and verifies settings after | ~4,000 lines, section-filterable, disposable world |

---

## Phase 0 — Source management and tooling

**Why first:** every later phase is safer with a lint gate and a test runner in place, and this
phase cannot break anything at the table because none of it ships in the zip.

### 0.1 The build-step question — settled: **no bundler, no transpile**

The current "no build step" is not laziness, it is a **load-bearing workflow property**: a
WebDAV hot-deploy makes script changes live on the next F5, with nobody disconnected. A
bundler or a TypeScript emit step puts a build between an edit and the table, and this module
is developed *at* the table.

So: tooling that reads the source without changing what ships.

- [x] `package.json` — `private: true`, `type: "module"`, devDependencies only. **Nothing in
      `dependencies`, ever** (DESIGN R3). Scripts: `lint`, `format`, `check`, `knip`, `test`,
      `test:live`, `verify` (the whole gate).
- [x] **Biome** for lint + format, matching the house config in `fvtt-mcp-molten5e`
      (2-space, 100 cols, LF) — but keeping this repo's existing double-quote/semicolon style
      so the first run is not a 10,000-line reformat. `noFloatingPromises: error` is the rule
      that matters most here: fire-and-forget hook handlers are how this module works, and an
      unhandled rejection in one is invisible (NOTES §1).
- [x] **Foundry/dnd5e globals declared** so `game`, `ui`, `canvas`, `Hooks`, `foundry`,
      `dnd5e`, `CONFIG`, and the document classes stop reading as undefined.
- [x] **Knip** for dead exports and unreachable files, entry `scripts/battleflow.js`.
- [x] **`.gitattributes`** — `* text=auto eol=lf`. The repo currently has none, git is
      converting on every touch, and NOTES already records a session lost to a whole-file CRLF
      flip turning a 300-line diff into a 2,000-line one.
- [x] **`.editorconfig`** so the editor stops fighting the formatter.
- [x] **JSDoc types, not TypeScript** (settled — see the bottom). `// @ts-check` on
      the pure files plus a `tsconfig.json` with `checkJs` and `noEmit` gives type checking
      with zero build step and zero syntax change. It can be adopted file by file.

### 0.2 The verify gate

```
npm run verify   =   biome check  →  knip  →  typecheck  →  imports  →  hook-order
                     →  registry-integrity  →  manifest  →  comments  →  vitest
```

All of it offline, all of it in seconds. This is what runs before a commit and before a
release. The live suites are **not** in it (§5).

- [x] `tools/check-hook-order.mjs` keeps its job, moves under the runner.
- [x] **New: registry integrity check** (`tools/check-registry.mjs`, 9 assertions) — every key in `S` is registered; every registered
      setting is in `S`; every registry entry has a known `kind`; every list-setting default
      parses clean. Today a typo in a default list is discovered at the table.
- [x] **New: import integrity check** (`tools/check-imports.mjs`) — every relative import
      points at a file that exists, every named binding is something that file exports, and
      **dynamic imports count**, since `const {x} = await import(...)` is this module's
      lazy-import idiom. Added because the formatter extraction broke two files and the entire
      gate passed: a name the target no longer exports is *declared* (it is right there in the
      import statement), so no linter objects — it resolves to `undefined` at load and throws
      "x is not a function" inside a hook handler. Biome's `noUndeclaredVariables` was turned on
      at the same time for the sibling case (a call with no binding at all); it reports zero
      findings, because biome.json already declares the Foundry globals.
      ⚠ A type checker would catch both, and until 2026-08-23 `npm run typecheck` passed
      trivially and was not in the gate. **It is in the gate now, over `scripts/decide/`** —
      the six pure modules, opted in with `// @ts-check`.
- [x] **The type checker, over the layer where it pays (2026-08-23).** ⚠ **The measurement is
      the whole finding.** With `checkJs` on, `scripts/decide/` produces **101 errors and 100 of
      them are TS7006 "implicitly any"** — the files simply carry no JSDoc parameter types. With
      implicit-any allowed there are **ZERO**: under `strict` + `strictNullChecks` +
      `noUncheckedIndexedAccess` the layer is already clean. So "adopt JSDoc file by file" was
      never the precondition it looked like; it was one compiler flag. `noImplicitAny: false` is
      off in `tsconfig.json` with that measurement written beside it, `checkJs` stays false
      globally and files opt IN, and the annotations become a later tightening rather than a
      gate for the gate.
      ⚠ **It broke `check-comments` on six files nobody had touched**, because a `// @ts-check`
      pragma on line 1 pushed each module header off line 1 and out of its exemption. The
      exemption is now "the first `/**` block with nothing but LINE comments above it", which is
      what it always meant.

### 0.3 Release hygiene

- [x] `build-release.ps1` keeps its backslash assertion (NOTES §5 — it is the whole point) and
      gained a **`verify` precondition** 2026-08-23: it runs the gate and `bump-version --check`
      before it packs anything, with **no skip flag** — see FOUNDATION 2.1.
- [x] Version bump is a script: [tools/bump-version.mjs](tools/bump-version.mjs), which moves
      **both** manifest fields and whose `--check` is the gate's seventh static check.

---

## Phase 1 — Clear the workbench

**Why:** 63 files in `tools/`, of which roughly half answered a question that has been closed
for weeks. They are not harmless — they are 4,692 lines of near-identical connection
boilerplate that make the directory unreadable and hide the six tools that actually matter.

### 1.1 Retire the closed probes

33 `probe-*.mjs` files. Each was a one-shot forensic for a specific finding. **Git keeps them
all** — the question is only what stays in the working tree.

- [x] **Deleted (32 files, ~4,000 lines)** — finding closed, never re-run:
      `probe-template-geometry{,2..9}.mjs` (9 files,
      one investigation), `probe-doubles-session4`, `probe-session4`, `probe-topple-session4`,
      `probe-topple`, `probe-topple-auto`, `probe-missile-hp`, `probe-effects`,
      `probe-reaction-receipt`, `probe-save-flags`, `probe-duration-units`,
      `probe-gm-hold-quiet`, `probe-fresh-code`, `probe-registered-version`,
      `probe-preroll-parts`, `probe-drive-attack`, `probe-maneuvers`, `probe-potion-aim`,
      `probe-potion-selfaim`, `probe-target-block`, `probe-temp-hp-card`, `probe-volley2`,
      `probe-volley3`, `probe-player-seam`.
- [x] **Promoted to suite sections, 2026-08-23 — two of the three.** `probe-player-damage`
      (the crit-flag decoy pin) is **smoke-battleflow §5d**; `probe-save-damage-popup` is
      **smoke-saves §18**. Both moved verbatim, each keeping its own page context because both
      are self-contained. ⚠ **`probe-volley-resources` was RETIRED instead, and this row was
      wrong about it:** it has no assertions at all — a bedrock forensic that prints JSON and
      exits 0, answering V1–V4/R1–R2, every one of which the volley registry and the resource
      notice closed when they shipped. There was no section to promote it to. It belongs in the
      first bullet, and git keeps it.
- [x] **Promoted to standing checks** — renamed and reframed, because these are contracts,
      not closed bugs: `probe-mastery-rules` → **`check-mastery-rules.mjs`** (the verbatim rule
      text still matches the system's own journal — ARCHITECTURE §5 law 8) and
      `probe-popup-topology` → **`check-popup-routing.mjs`** (popups reach whoever owns the
      decision, across two clients — the only two-client harness left, and the only thing that
      can see an N3 violation). Keeping the second one is also what keeps `playerConfig` in
      `target.mjs` alive.

### 1.2 Keep, and say why in one line each

`target.mjs` (which instance) · `check-hook-order.mjs` · `verify-settings.mjs` (the external
reference the crash-launder lesson demands) · `reset-fixture-state.mjs` · `reload-clients.mjs` ·
`maintain-party.mjs` · `build-release.ps1` · the three `scan-*.mjs` compendium censuses (they
are how registries get built — DESIGN N1).

### 1.3 Content grafts — move out of `tools/`

`fix-innate-sorcery.mjs`, `fix-shield-master.mjs`, `apply-macro-clear-rest.mjs`,
`macro-clear-and-rest.js`, `audit-reaction-list.mjs`, `aa-slowed-preset.backup.json` are **world
content repair**, not module tooling — NOTES §4 "fix the content, not the module".

- [x] Moved to `tools/content/` with a one-paragraph README, or relocate to the campaign repo.
      They must not read as part of the module's test surface.

### 1.4 Dead code in `scripts/`

Genuinely small — the source is clean.

- [~] `maneuverEntries` is exported but only used in its own file. **Deferred to Phase 3** —
      every list parser moves to the registry module there, so removing the `export` now is
      churn that phase undoes.
- [x] `dist/` stale build residue (`NOTES-v1.15.0.md`, `module.staging.json`, a stale
      `module.json`) cleared out of the gitignored build directory.
- [x] Knip finds nothing else rather than eyeballing it.

---

## Phase 2 — Extract the DECISION layer

**This is the phase that matters.** It is simultaneously the refactor, the test strategy, and
the thing that makes the chit layer reachable — and it changes no behaviour.

### The problem, measured

Every hook handler in this module does four things in one function: read documents → judge →
write documents → render. That is why:
- nothing can be unit-tested (there is no function that takes data and returns an answer);
- the moment machines drifted (the judgment was copied, not shared);
- the same rule is re-expressed in four files with four slightly different edge cases.

**Only 4 of 20 files are majority-pure.** The other 16 interleave.

### The move

For each machine, pull the judgment out into a pure function that takes **plain objects** and
returns **plain values**, and leave the handler as a thin shell that reads, calls, writes.

```js
// EDGE — reads documents, calls DECISION, writes documents
Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  if ( !setting(S.autoDamage) ) return;
  const hits = hitTargets(snapshotOf(rolls[0], subject));   // ← pure
  if ( hits.length ) await pressDamage(subject, hits);
});
```

### The extraction list — highest value first

- [x] **List and registry parsing** (`interruptEntries`, `blockEntries`, `maneuverEntries`,
      rider lists, volley counts) → `scripts/decide/registry.js`. *Pure strings in, entries
      out.* A typo in a world setting silently disables a feature today; this makes that a
      test.
- [x] **Hit / verdict math** (`hitTargets`, save folding vs DC, `damageOnSave` multiplier
      selection, crit determination) → `scripts/decide/verdict.js`. *The most-copied logic in
      the module.*
- [x] **Eligibility predicates** (usable-reaction, mastery eligibility, rider intersection,
      volley membership, dead-target skip) → `scripts/decide/eligible.js`.
- [x] **Receipt arithmetic** (prior → delta → taken → trait reason; the revert inverse) →
      `scripts/decide/receipt.js`. *Was correct and untested; it moves HP.* Both merge
      disciplines came too — and `joinEffectReceipt` left a feature file on the way, which is
      a bite out of D1. The taken-vs-delta fallback had already drifted between its two copies;
      there is one now. ⚠ The `aggregateDamageRolls(...).map(...)` block is copied **verbatim
      in four files** (auto-apply, cast, hold, saves) — damage-part normalisation rather than
      receipt arithmetic, so it was left standing. It wants an EDGE helper, not a decide one.
- [x] **Presentation formatters** (`momentBarHTML`, `popupKey`, `bfCard`, rule-line dress,
      the staircase slot allocator) → `scripts/decide/present.js`. They were already pure; what
      needed deciding was the LINE. ui.js keeps everything touching a dialog, an element or a
      clock — `syncHoldBars` (the bar's DOM half), the popper discipline, the shown-latch
      registry, `momentButton`, the clocks. The staircase split the same way: arithmetic down,
      lifecycle up. ⚠ This stage caused two live regressions and the whole static gate missed
      both; the gate grew two checks in response (see Phase 0.2).
- [~] **The flag accessor layer (D4) — ✅ DROPPED BY DECISION 2026-08-23, not left undone.**
      See the FOUNDATION PASS box; this bullet is kept for its measurements, which are what the
      decision rests on. ⚠ **RE-MEASURED 2026-08-22, and
      the bullet understates it: 38 distinct flag keys, ~230 reads, ~66 writes across 14 files
      — roughly 300 call sites.** That is an order of magnitude more churn than any stage so
      far, and its two halves have very different value:
      - the **reads** (~230) are pure tidiness — mechanical, wide, and now gate-checked, but
        they buy nothing a test can assert;
      - the **writes** are the correctness half and the D3 argument. The genuine defect is the
        per-target read-modify-write: [hold.js:537](scripts/hold.js:537) (the answer fold,
        clone → mutate one target → set, with a second handler able to clone the same stale
        copy first), [hold.js:521](scripts/hold.js:521) (the effectReceipt merge), and the
        `topple`/`mastery`/`concentration` equivalents. Those want `queueFlagWrite`, exactly as
        saves.js got in the correctness pass — and that is a small, targeted change that does
        not need the accessor layer at all.
      **Scope this with the user before starting.** An inventory module that nothing imports is
      dead code by knip's reckoning, so "write the inventory now, adopt later" is not available:
      the layer has to arrive with its call sites or not at all.

**Rule for the whole phase:** each extraction is *move, do not rewrite*. Same logic, new
address, plus the tests that prove it did not change.

---

## Phase 3 — Registries, unified — ✅ DONE 2026-08-23, battery-green

The volley registry is the reference implementation and the user's own directive ("long term
scalable, no hacks, modular"). Everything else that answers "which content participates" should
look like it.

- [x] **One registry shape**, one strict parser, one warn-once-on-unknown-kind path, one
      read-only API exposure. ✅ **2026-08-23, battery-green.** It was worse than this bullet
      said: **six** lists, **five** parsers, **four** different failure behaviours, and only one
      of them declared its kind set in code. Now every list is a SPEC in `decide/registry.js`
      and `parseList` is the one parser; `listEntries` in settings.js is the one warn-once path
      (maneuvers.js had the only implementation, so four of the five lists failed silently);
      `api.registries` is the read-only exposure. ⚠ `blockList` and `riderUpgrades` were NOT
      forced into a kind shape — they are relations, not kind-tagged memberships.
- [x] **Registries carry their `kind` against a closed set.** ✅ **2026-08-23** — every entry is
      tested against its spec's set, and an unknown kind fails at the gate or is refused at
      runtime (`volleyEntryFor` now refuses one, which is the path a suite fixture takes).
      ⚠ **The "checkable against the system's own enums" half is true for exactly ONE of the
      four sets, and that is not a gap.** Masteries mirror a system enum and are already checked
      against it, live, by `check-mastery-rules.mjs`. The other three are the module's own
      inventions — dnd5e has no concept of an "interrupt kind" — so there is nothing to check
      them against. Recorded in ARCHITECTURE §6 rather than papered over with a check that
      would validate nothing.
- [x] **Registry integrity in the verify gate** (Phase 0.2). ✅ Done earlier, expanded here:
      **11 assertions** now, including that each list registers *from its spec* and that every
      resolved mastery carries its own rule text.
- [x] **The R4 tripwire becomes visible.** ✅ **2026-08-23.** `KIND_SETS` declares every closed
      set once; `npm run verify` prints the table and **PINS the total**, so adding a kind fails
      the gate until the pin moves deliberately. **Today: 16 kinds across 4 sets** (interrupt 2,
      maneuverFold 5, volley 2, mastery 7-of-8). The rule is not "no new kinds" — it is "no
      *unnoticed* new kinds", which is what the tripwire always needed to mean.
      ⚠ **And the remedy it points at was wrong as written:** "adopt a conditions library" is
      precisely what R2 forbids. The user's call (2026-08-23) is **vendor and modify, never
      import** — which is also what reconciles it with the backlog's finding that AC5e and
      Battle Flow are *complementary* (AC5e decorates rolls; this module applies). Corrected in
      DESIGN.md R4.

### Not in scope for this phase

Adding coverage. **No new abilities, no new spells, no new kinds.** This phase makes adding
them cheap; it does not do the adding.

---

## Phase 4 — Repay the structural debt — ✅ DONE 2026-08-23

Ordered by risk, lowest first. Each is independently shippable and independently revertible.

- [x] **D1 — split `hold.js`'s shared services out.** ✅ 2026-08-22, battery-green.
      `canAnswerFor`, `isContinuingClient`, `inRunningCombat` → `core.js` (the §3 "who does
      what" family, beside `isActiveGM`/`rollerUserFor`); `interruptEntries`/`blockEntries` →
      `settings.js` (§8). **Importers of hold.js: 7 → 2.** Zero new import edges for the
      core.js moves; the two settings.js edges are order-neutral. ⚠ What remains is `ui.js`,
      which draws the hold's views and so needs `reactionItem`/`answerHold`/`continueHold` —
      that is D6's knot, not D1's.
- [x] **D3 — route every per-target flag write through the serializer.** ✅ 2026-08-22,
      battery-green — **and it did NOT need the flag accessor layer**, which is why it was done
      directly. Eight sites converted, each repeating its guard inside the lock: hold's answer
      fold (two answers in one tick dropped one player's answer) and its two effectReceipt
      merges, mastery's chip applier (its read sat above an await loop) and its four topple
      sites. ⚠ Deliberately NOT converted: concentration's ask and the `mastery` flag are
      single-decision objects with one writer — the argument does not reach them.
- [x] **D6 — break the `ui.js` ↔ `hold.js` cycle.** ✅ **2026-08-23, battery-green.** It did
      **not** fall out of D1 (measured 2026-08-22) and needed its own stage, as forecast:
      **349 lines** of the hold's own views left the spine for `hold.js` — `reactionImg`,
      `reactionACBonus`, the clocks, the reveal helpers, the row, `castReaction`,
      `holdPopupContent`, `showHoldPopup`. **ui.js 697 → 340 and imports no machine at all.**
      Registrations **75 → 77** (hold.js gained the row's `renderChatMessage` and its own
      one-line `deleteChatMessage` clock sweep), and the pinned assertion moved with the row.
      ⚠ **Three things stayed, deliberately** — the damage-offer bar (not the hold's; its own
      registration in ui.js, and it still renders above the hold row because hold.js imports
      ui.js, now asserted explicitly instead of implied by a shared handler), the delete-SWEEP
      (spine — it clears every machine's state off one key prefix), and `closeAnsweredPopups`
      (reads the hold flag by string, so no import edge).
      The other two cycles remain and are **deliberate**: `hold.js` ↔ `auto-damage.js` is
      load-bearing, and `auto-apply.js` ↔ `mastery.js` breaks only by moving
      `applyDamagesWithReceipt` — the damage chokepoint — to a third module.
- [x] **D2 — bring `hold.js` onto the moment spine.** ✅ **2026-08-23.** ⚠ **This bullet was
      wrong at HEAD and had been for a while.** "The only machine that adopted none of it — its
      own clock, its own latch, its own views" described the tree before round 3 and D6; by the
      time D2 came up, hold.js already composed `openMomentPopup`, `momentButton`,
      `scheduleBarSync`, `shownMoments` and the `armDeadline` primitive. A usage matrix across
      all six moment machines was the only way to see that, and it found **one** primitive hold
      bypassed: `livePopups`.
      The cause was `closeAnsweredPopups` living in **ui.js** — spine-shaped doc line,
      hold-shaped body (`getFlag(MODULE_ID, "hold")`), one caller. **The last place the spine
      knew a feature existed**, invisible to check-imports because it reached the flag by string.
      Moved to hold.js as `closeAnsweredHoldPopups` on `livePopups`, the shape every other
      machine already used. hold suite ALL PASS before and after; shipped alone as required.
      ⚠ The clock stays the hold own **by design** — continuing-client ownership and per-target
      answers, exactly like maneuvers riposte and mastery topple. Never unify it.
      ⚠ **The lesson is about the debt register, not the hold:** a debt row EVIDENCE goes stale
      as silently as code does. Re-measure before believing one.

---

## Phase 5 — Tests: three tiers

**The user's proposal, and my one correction.** *(See the challenge section below.)*

### Tier 0 — static, no Foundry, milliseconds

Lint, format, dead code, hook order, registry integrity. Phase 0.2. Runs on every save.

### Tier 1 — unit, vitest, no Foundry, ~2 seconds

Grows **with** Phase 2 — every extracted pure function arrives with its tests. Target ~150
assertions covering:

- registry and settings-list parsing, including every malformed-entry path;
- hit tests, save folds, multiplier selection, crit determination;
- eligibility predicates, including the negatives (the flat-AC case, the worn-shield case, the
  dead-target skip);
- receipt arithmetic and its revert inverse;
- the serializer's interleaving guarantee (a fake message object is enough, and this is exactly
  the bug that was measured live);
- the staircase slot allocator and popup-key derivation.

**What Tier 1 must never claim to cover:** anything about dnd5e's behaviour. A unit test with a
stubbed `applyDamage` asserts the stub.

### Tier 2 — live contract suites, the existing 11, slimmed

Kept, because they are the only thing that can catch what actually breaks this module. Made
cheaper:

- [x] **Extract the harness — DONE 2026-08-23.** [tools/harness.mjs](tools/harness.mjs): env,
      watchdog, connect, preflight, the section plan, one reporter — and the **suite lock**, the
      guard `preflightSoleGM` structurally cannot be (it counts users, not sockets, so two suites
      on one account are invisible to it; that collision happened for real during this stage).
- [ ] **Inject shared page helpers — DEFERRED, with a finding.** The `f.evaluate()` closure has
      no imports, so a helper it needs must travel as source or as data. The section plan travels
      as **data** and costs three lines per suite, which is the cheap half of this idea. ⚠ The
      expensive half looks better than it is: what makes `smoke-hold.mjs` 1,700 lines is its
      **scenarios**, not its helpers — the sixteen scenario blocks are 1,000 of those lines and
      no bundle touches them. "Cuts every suite roughly in half" was an estimate nobody had
      measured. Re-measure before attempting it.
- [x] **Section filtering — DONE 2026-08-23**, every live suite. See FOUNDATION 1.1/1.2.
- [ ] **Move the pure assertions down to Tier 1** and delete them from the suites. Each suite
      keeps only what needs a live world: hooks firing, dnd5e behaving, clients routing, DOM
      rendering, flags replicating. ⚠ **The rule is now written down** (ARCHITECTURE §11, "Adding
      a TEST"), so this stops being a backlog item for NEW assertions; what is left is a sweep of
      the existing ones, and it is not scheduled.

### Tier 2's real problem is the world, not the tests

Most of the suite ceremony in NOTES §5 — run one at a time, disconnect the bridge, verify
settings after, a crashed run laundering its pins, canonical-id-only fixtures — exists because
**the suites mutate a shared, long-lived world that also holds the user's real campaign
configuration.**

- [x] **Disposable test world — BUILT AND PROVEN** (`tools/world-snapshot.mjs`). The sandbox already has a `local-foundry.mjs`
      start/stop/restart and a `pull-prod-to-local.mjs` imager. A snapshot of the world
      directory taken while the box is down, restored before each battery, would remove the
      entire teardown-correctness burden — no settings restore, no fixture cleanup, no
      crash-launder, no poisoned-across-runs prone chip. Suites get *simpler*, not just faster.
      **Proven end to end 2026-08-22**: a canary written after the snapshot was gone after the
      restore, and all 145 actors survived. The copy is **0.054 s** (24 MB of LevelDB; the
      world's other 444 MB is assets, which no suite writes). The ~75 s round trip is entirely
      the world bounce either side.
- [x] **Wired in at BATTERY level, not per suite — 2026-08-23.** `node tools/battery.mjs
      --snapshot` takes the snapshot before the first suite and rolls back after the last, so a
      crash mid-teardown is undone by construction for the run where laundering actually bites.
      ⚠ **Per-suite rollback was considered and rejected on measurement:** the round trip is
      ~75s of world bounce, which is more than every `sleep()` in the tree put together.
- [ ] **Simplify the suites to exploit it** — still outstanding, and now clearly SECOND to the
      wiring above. ⚠ **And it is no longer obviously worth doing:** the teardowns are what let
      a single suite (or a single `--section`) run alone without a 75-second bounce either side,
      which is the workflow the whole of Stage 1 was built to make normal. Deleting them would
      buy tidier suites and cost the fast path. **Decide before doing.**

---

## ▶ THE FOUNDATION PASS — agreed 2026-08-23, execute in this order

The user's directive, stated three times: **an excellent foundation before features resume.**
Everything below is debt repayment or test infrastructure. **No feature work in any stage.**

**Scope note.** This is the user's "do tiers 1–5" directive with two amendments they accepted:
**Tier 2 is NOT done** (see the box), and **the release moved to the END** so one release
carries the whole foundation instead of two carrying halves.

⚠ **TIER 2 IS CLOSED BY DECISION, NOT BY WORK — do not "fix" these.** Doing them would make the
tree worse, which is why the directive was amended:

- **D4 (the flag accessor layer) — DROPPED.** ~300 mechanical call sites; D3 already repaid the
  correctness half; knip means it arrives all-at-once or not at all. It buys nothing a test can
  assert.
- **`hold.js` ↔ `auto-damage.js` — PERMANENT.** That bare `import "./auto-damage.js"` is
  **load-bearing**: it pins module evaluation order and `check-hook-order` depends on it.
  Breaking it drops the damage-offer bar below the hold row.
- **`auto-apply.js` ↔ `mastery.js` — PERMANENT.** Breaking it means moving
  `applyDamagesWithReceipt`, the single damage chokepoint every machine routes through, into a
  third module.

The only action for Tier 2 is DOCS: mark them settled so they stop reading as open debt.

---

### STAGE 1 — testing speed and structure — ✅ DONE 2026-08-23

⚠ **The honest ceiling was itself optimistic, and the measurement is now in.** The plan expected
to recover ~4 minutes by removing `sleep()`. **It cannot be recovered, and the reason is worth
more than the minutes were:** of the 213s of unconditional sleeping left across the suites,
**73s sits under an assertion that something did NOT happen.** You cannot wait for a thing not
to occur, so those sleeps are load-bearing — shortening one weakens the assertion above it, and
`smoke-hold`'s two are explicitly commented *"give a (wrong) premature application time to stamp
its receipt."* **What was convertible has been converted; what is left is deliberate.**

**The real win landed anyway, and it is the one the plan named: you rarely need a battery.**

- [x] **1.1 One section convention + `--section N`.** Every live suite declares `SECTIONS` and
      `DEPENDS` at its head and gates its assertion blocks on `want(id)`. `--list` prints the
      table without connecting; `--section 3,5` runs a subset and **stamps the summary
      `⚠ PARTIAL RUN`** so a filtered green can never be mistaken for a battery green.
      ⚠ **`DEPENDS` is the part that makes it honest.** Sections are not independent — smoke-saves
      §2 rolls the damage of the demand §1 cast — so a suite DECLARES the coupling and asking
      for §2 quietly runs §1, saying so. A section with no row is a claim that it stands alone.
- [x] **1.2 Section filtering, suite by suite.** All eleven converted and **every one re-run
      full and green at or above baseline** (see the battery table in HANDOFF). Two shapes
      needed more than a gate:
      - ⚠ **`smoke-hold` gates TWICE, and had to.** Its page half COLLECTS (`results.<key> = …`)
        and its Node half ASSERTS on what was collected, so gating only the page half would turn
        every skipped section into a row of FAILs against `undefined`. Each `report()` now sits
        under the same `want()` as the block that fills it. **17 sections, invented from the
        scenario blocks that were already there** — the plan's "no section structure at all" was
        about blocks, not about markers.
      - ⚠ **`smoke-battleflow` gates in NODE**, not in the page: its sections are top-level
        blocks each with their own `f.evaluate`, so the plan never crosses the serialization
        boundary at all.
      ✅ **And the filtered path is proven and TIMED, not merely built** (2026-08-23), including
      the case where it buys nothing:

      | filtered run | vs the full suite | what it says |
      | --- | --- | --- |
      | `smoke-hold --section 5` | **25s** vs 129s | a 5× saving on the suite with sixteen sections |
      | `smoke-saves --section 18` | **93s** vs 252s | and the folded probe runs standalone, 13/13 |
      | `smoke-battleflow --section 5d` | **~90s** vs 89s | ⚠ **no saving at all** |

      ⚠ **The third row is the honest one.** §5d waits out two real buzzer windows, so it IS
      most of that suite's wall clock — filtering to the slow section saves nothing, and the
      only thing that would is faking a deadline the feature exists to honour. **The filter
      pays when the section you want is small relative to the suite, and says so when it is
      not.** All three stamp `⚠ PARTIAL RUN` and list what they skipped; `--section 5` on
      smoke-hold also exercises the two-sided gating, where the page half collects and the Node
      half asserts and both must skip in step.
      ⚠ **The hazard this created, and the tool that finds it:** a binding declared inside one
      gate and read from another still passes a FULL run and explodes only under `--section`.
      Three were found and fixed by static scan before any suite ran — `clearChips` (smoke-effects
      §2, read by §§3-17), the message watermarks in volleys/cast/riders, and smoke-maneuvers'
      §H deleting §B's and §I's fixtures **by binding**; that one now deletes by NAME.
- [x] **1.3 `sleep()` → conditional wait.** 213s measured; **the convertible part is converted**
      (smoke-volleys 33.7s → 0, smoke-resources 33.3s → 0.6s) and the rest is classified rather
      than left unexamined. ⚠ **The plan's trap fired twice, both times exactly as written, and
      both times on the first attempt:**
      - **smoke-resources**: waiting for the BANNER is not waiting for the durable CARD LINE —
        three assertions on a perfectly working module went red. The helper now waits for every
        surface the caller is about to read, and callers asserting SILENCE say so.
      - **smoke-volleys §5**: waiting for `status === 'resolved'` is not waiting for the two
        spread ROLLS, which post after it. 38/39, and the missing one was mine.
      **Convert the wait to the thing the NEXT ASSERTION READS. Twice is a pattern; write it in
      the suite when you do it.**
- [x] **1.4 Shared harness.** [tools/harness.mjs](tools/harness.mjs) holds the twenty lines that
      were copy-pasted into 26 files — env, watchdog, connect, preflight, the section plan, one
      reporter. ⚠ **And it holds a guard the preflight structurally cannot be: a SUITE LOCK.**
      Two suites against one box both join as `Tester Assistant`, and `preflightSoleGM` counts
      **users, not sockets** — one user, one GM, preflight green, and then the two runs fight
      over settings and the elect. **That happened for real during this stage** (a second suite
      started mid-run, re-pinned six settings underneath `smoke-maneuvers`, and nothing said a
      word). A pid file now refuses the second starter and names the first.
      ⚠ **The page-helper bundle was NOT built, and the reason is a finding:** the `f.evaluate`
      closure cannot import, so a helper it needs must travel as source or as data. The section
      plan travels as **data** and costs three lines per suite. Serializing whole helper bodies
      buys much less than it looks: what makes smoke-hold 1,700 lines is its *scenarios*, not its
      helpers. Deferred, deliberately, not forgotten.
      ⚠ **The disposable world is a BATTERY-level cure, not a per-suite one.** `world-snapshot`
      needs the world DOWN in both directions (~30s a bounce), so per-suite rollback would cost
      more than every sleep in the tree. It is `battery.mjs --snapshot` instead: one snapshot
      before the first suite, one rollback after the last, and the crash-launder hazard is gone
      by construction for the run that matters. The suites keep their own teardowns, which is
      what lets any one of them run alone.
- [x] **1.5 The standing rule** is in ARCHITECTURE §11 as **"Adding a TEST — the tier rule"**,
      beside the three checklists a new feature already walks: unit first, a section if it must
      be live, never a `sleep()` for a thing you can wait for — and a note that a sleep which
      exists to give a WRONG behaviour time to appear is load-bearing and must say so.
- [x] **1.6 (added) `tools/battery.mjs` — the battery is one command.** Three rules that lived
      in prose and were re-learned by two sessions are now the code: **every suite is captured to
      a file before anything is summarised** (the `| tail` that lost the "2 FAILURE(S)" evidence
      twice cannot happen), **the order is the array** (`smoke-battleflow` → `smoke-hold`
      adjacent, `reset-fixture-state` before `smoke-effects`), and **`verify-settings` runs at
      the end**. `--from` resumes after a failure; `--snapshot` rolls the world back.

### STAGE 2 — the rest of the tooling and process debt — ✅ DONE 2026-08-23

- [x] **2.1 The release build gains a `verify` precondition.** `build-release.ps1` runs the gate
      and `bump-version --check` before it packs anything, and there is deliberately **no skip
      flag** — the gate takes seconds, and a release built from a tree that fails it is not a
      release. Same reasoning as the R4 pin: the refusal is the feature.
- [x] **2.2 The version bump is a script.** [tools/bump-version.mjs](tools/bump-version.mjs)
      moves **both** `module.json` fields — `version` and the `download` URL that embeds the tag
      — by targeted replacement rather than re-serialization, so the diff at release time is the
      two lines that changed and nothing else. `--check` asserts the two are in step and is now
      the gate's **seventh** static check (`npm run manifest`).
- [x] **2.3 The probes are gone — two folded, one retired.** ⚠ **The plan's row was written
      without re-reading the third file.** `probe-player-damage` → **smoke-battleflow §5d** and
      `probe-save-damage-popup` → **smoke-saves §18**, both moved verbatim as their own page
      contexts (they are self-contained; there was nothing to merge and nothing to collide).
      **`probe-volley-resources` had no assertions at all** — it is a bedrock forensic that
      prints JSON and exits 0, answering design questions (V1–V4, R1–R2) that the volley registry
      and the resource notice closed when they shipped. There was never a section to promote it
      to. **Retired**, on Phase 1.1's own first-bullet grounds; git keeps it.
      **The battery is 11 runs, not 14, and the three orphans that had to be remembered are
      sections that cannot be forgotten.**
- [x] **2.4 Tier 2 recorded as settled.** D4 dropped, both remaining cycles permanent — see the
      box at the head of this pass and ARCHITECTURE §10 D4/D6.
- [x] **2.5 (added) The last hand-carried number is asserted.** The source-file count — wrong
      twice in published docs (20, then 26) — is `EXPECTED_SOURCE_FILES` in `check-registry.mjs`
      now, pinned at **27** beside the R4 kind pin, and ARCHITECTURE §11's "adding a file"
      checklist says to move it.

### STAGE 3 — two-client coverage — ✅ DONE 2026-08-23

⚠ **It was called the least certain work in this plan, and it turned out to be the cheapest
stage of the three.** Both gaps were reachable with the harness that already existed; what was
missing was a **player-owned fixture**, and once `BF Test Player Shielder` existed (a Gren clone
whose ownership goes to the player test user, deleted on the way out) every assertion below
passed on its first run. The uncertainty was real, and it was about *how to stand the scenario
up*, not about whether the module was right.

- [x] **3.1 The two-client harness asserts.** `check-popup-routing.mjs` was a ledger dump for a
      human to read — which meant it could only find a regression if somebody ran it AND read it
      carefully, and it was unrunnable at all until the 2026-08-23 ownership grant, so nobody
      had. **Seven assertions now, and the ledger still prints in full** because the ledger is
      what makes a failure legible. ⚠ **The half that makes the routing claim mean anything is
      the PLAYER's DOM**: "the GM got the popup" is only interesting beside "and the player did
      not", and a one-sided read cannot see a popup landing on the wrong client — which is
      exactly what the 2026-08-17 walk found. It reads both sides now.
- [x] **3.2 + 3.3 `tools/smoke-twoclient.mjs`** — a mutating two-client suite, sections `relay`
      and `close`, **9/9 first run**. ⚠ Deliberately a SEPARATE file from `check-popup-routing`:
      that one is read-only and safe beside a live session, and this one fires real attacks.
      - **§relay — the relayed half of the §4.1 registry.** A GM-rolled attack holds on a
        player-owned target; the player answers; the assertions follow the envelope the whole
        way. The answer is **the player's own message** (`respondsTo` + flat sibling
        `uuid`/`answer`, authored by the player, not the GM), and the **CONTINUING CLIENT** —
        not the elect — folds it into its own hold flag and runs the hold to a verdict. That
        `owns` column had never been put to the question: when the answerer can write the target
        message the envelope never travels, so a solo suite exercises the direct path every time.
      - **§close — D2's gap, and the reason `closeAnsweredHoldPopups` is not gated.** The GM's
        **buzzer** answers a hold the player is still looking at. Nobody touches the player's
        DOM; the player's own client closes its popup on seeing the flag update. Asserted in
        order: open before, resolved-by-timer in between (`timedOut: true`), gone after.
      ⚠ **`holdSkipFutile` is turned OFF for this suite, and that is not a shortcut.** With it
      on, a hold is only offered when the reaction could actually flip the outcome, so the
      attack must land in a 5-wide band — roughly one headless roll in four. This suite is about
      *where the answer travels* and *whose popup closes*; smoke-hold §4f owns the futility gate.
      Leaving it on would have bought a flake with nothing to do with what is under test.
- [x] **3.4 The `smoke-battleflow` "2 FAILURE(S)" class — bounded, and the promise kept.** It
      still has not reproduced, and nothing here claims to have fixed it. ⚠ **What DID change is
      the thing that actually cost two sessions: the evidence can no longer be thrown away.**
      Both sightings lost their assertions to a `| tail`, and `battery.mjs` captures every suite
      to a file *before* anything is summarised, then prints the failing lines in full as well.
      **If it recurs it will name itself**, which is the whole of what was ever committed here.

### STAGE 4 — D8, the only open architecture debt — ✅ DONE 2026-08-23

- [x] **4.1 THE BLOCKING RULING — asked and answered (user, 2026-08-23).** `hitsAmong` justified
      its ordering with *"the sets are disjoint, because a hold stamps hits and precision stamps
      misses."* A reroll goes either way, so precedence had to be **decided**. Three options were
      put; the ruling is **COMPOSE THE ARITHMETIC**.
      > Folds do not carry verdicts to be ordered. They carry **contributions to the two
      > numbers** — the attacker's move the TOTAL, the defender's move the AC — and the verdict
      > is computed **once, at the end**. *"18 + 4 = 22 vs AC 20 (Shield) — hits."*
      **Precedence stops existing**, which is why this is the only answer that cannot be wrong
      about a case nobody thought of. ⚠ The two rejected options are recorded because both are
      the obvious thing to re-propose: *"the defender always wins"* keeps today's behaviour but
      **silently eats a spent resource** (a player burns Heroic Inspiration into a shielded
      target and gets nothing), and *"last fold wins"* reads correctly in time but tests the new
      total against the **stale snapshot AC** — announcing a hit against a number the defender
      already changed.
- [x] **4.1b A SECOND RULING, asked in the same breath because a reroll makes it live.** A fold
      that turns a HIT into a MISS after damage applied: **the module auto-reverts its own
      receipt.** ⚠ This is *not* the house Graze precedent ("⚠ Graze already paid on the miss —
      revert its receipt if you rule it void"), which was on the table and was **not** taken.
      ⚠ **Nothing ships that can trigger it yet** — a hold WITHHOLDS application rather than
      undoing it, and precision only turns misses into hits — so building the detector now would
      be machinery with no caller, which knip calls dead code. It is written into ARCHITECTURE
      §11's **"Adding a FOLD"** checklist as a debt the first feature that can reverse an applied
      verdict must pay, on the `revertPlan`/`revertableEffect` machinery that already exists.
- [x] **4.2 The attack side.** `hitsAmong({targets, roll, folds})` takes a LIST. `ATTACK_FOLDS`
      declares where folds come from — one entry per flag, each turning a per-target entry into a
      contribution — and `foldsFrom(read)` walks it; the EDGE shell in `shared.js` supplies only
      the reader, which is also what keeps the judgment pure. **Move, not rewrite:** every prior
      behaviour is re-asserted against the new shape, including the two the old tests expressed
      through the removed channels.
      ⚠ **The one thing that made composition possible was already in the data.** A resolved hold
      contributes the **AC it was judged against** (`acAtVerdict`, stamped since the hold was
      written) rather than its baked verdict — a stored "miss" cannot be re-tested against
      anything. A message from before that field existed falls back to the verdict, because a
      stale answer is safer than a wrong AC (the stale-AC trap).
      ⚠ **And one shipped oddity was checked rather than assumed.** The old precision channel's
      verdict ignored crit and fumble, so on paper it could turn a natural 1 into a hit; under
      composition an `add` cannot. That is not a behaviour change, because the stamp refuses a
      fumble outright (*"a natural 1 stands"*, maneuvers.js) — verified in the source before the
      shape was chosen, and now asserted so a future fold inherits the right answer.
- [x] **4.3 The SAVE side, which did not exist at all — the real new work.** `foldedSave` +
      `SAVE_FOLDS`, and `saves.js` writes its verdict **through** them. The three surveyed
      features do not care which kind of d20 they change (Heroic Inspiration rerolls "any die",
      Tactical Mind adds to a CHECK, a Bardic die goes on a save as readily as an attack), so a
      mechanism that only knew about attacks would have had to be built twice.
      ⚠ **`SAVE_FOLDS` ships EMPTY, on purpose, and that is the point rather than a shortcut.**
      With no specs the arithmetic is *provably* today's arithmetic — `saveOutcome(total, dc,
      forced)` with nothing added and nothing replaced — which is exactly the property that let
      the seam land in a pass whose directive is "no feature work". It also keeps the resolver
      out of the way of the first feature: a spec, not an edit.
      ⚠ **There is deliberately no `{dc}` contribution shape.** The ask OWNS its DC (the ask's-DC
      rule), so a defence-side channel here would contradict a standing rule to buy nothing.
- [x] **4.4 Tests, suites, battery.** Unit assertions **184 → 215**: the composition both ways
      (a die that reaches the shielded AC and one that does not), order-independence asserted as
      an identity, `replace` carrying its own crit, an `add` failing to rescue a fumble, the
      registry's every branch, and the save side including legendary resistance still winning
      over any fold. Then the full live battery — this is the most consequence-heavy code in the
      module, and a mistake here produces wrong outcomes that look fine in review.
      ⚠ **The walk is the USER's, not the suite's.** 4.4 said "then a walk"; a walk is a human at
      a table, and nothing here substitutes for it.

### STAGE 5 — one release

- [~] **5.1 BUILT AND VERIFIED — the publish is deliberately left to the user.**
      `node tools/bump-version.mjs minor` moved **both** manifest fields to **v1.22.0** (the
      mistake the v1.20.0 walk-1 bump made by hand, and the reason 2.2 built the script), and
      `build-release.ps1` produced `dist/fvtt-mod-battleflow.zip`: **30 entries — 27 scripts
      including `scripts/decide/`, plus module.json, LICENSE and README — forward slashes
      verified, and every relative import inside the archive proved to resolve to another file
      in it.** The gate ran as a precondition, which is 2.1 exercised for real.
      **What this release carries above `v1.21.0`:** Phase 3 (registries), D2, the §4.1 relay,
      the flake fixes, and this pass's four commits. ⚠ **Only D8 changes shipping code** —
      stages 1–3 are `tools/` and docs, and neither is in the zip.
      ⚠ **`gh release create` and `git push` are NOT run.** They put artifacts on a public repo,
      and that is the user's call rather than an autonomous one. The commands, and a
      release-notes draft (`dist/RELEASE-NOTES.md`, hand-written — **not** `NOTES.md`, see
      build-release.ps1's corrected usage note), are in HANDOFF § THE RELEASE, READY TO GO.
- [ ] **5.2 Prod is the USER's call.** It has run pre-refactor code throughout, deliberately.

---

## Surviving backlog

Carried over so it is not lost with the old docs. **Not scheduled** — these wait on the
stabilization pass.

| Item | Shape |
| --- | --- |
| **Guidance / choice-bearing effects** | An effect applied without asking the choice it carries — the d4 landed on every ability check. Same family as Careful Spell. Needs a "choice" moment kind. |
| **Light-family spells apply token light** | Cast on a shield, attached no light; the table hand-toggled a torch. |
| **Short-duration effect expiry** | Mastery chips are created with a 1-round duration and nothing sweeps an expired one — expiry depends entirely on the combat round advancing natively. ⚠ Do not build before deciding whether the module should own turn-time at all. |
| **AC5e adoption — the R4 tripwire** | Condition math was the most-asked question of a live session. AC5e *decorates rolls* (adv/dis/auto-crit) and never applies; Battle Flow *applies* and never decorates — the fence is clean and complementary. Needs a bench evaluation, not table time. |

---

## The chit layer — readiness, not work

No chit work is scheduled ([DESIGN.md §6](DESIGN.md)). The obligation on this pass is only to
leave three properties true, and every phase above happens to strengthen them:

1. **Every spendable thing is a registry entry** — Phase 3.
2. **Every moment declares subject, options, clock and answer channels in one shape** — Phase 4
   (D2 is the last machine that does not).
3. **Nothing is keyed to a popup; the flag is the state** — Phase 2's flag accessor makes this
   checkable rather than conventional.

If those three hold when this document is deleted, the chit layer is a **view**, not a rewrite.

---

## Sequencing

```
Phase 0  tooling                    ✅ done
Phase 1  clear tools/               ✅ done
Phase 2  extract DECISION + tests   ✅ done — six pure modules, the bulk of the value
Phase 3  unify registries           ✅ done
Phase 4  D1 → D3 → D6 → D2          ✅ done — D2 alone, behind its own walk
Phase 5  slim the suites            ✅ the parts that mattered; see the FOUNDATION PASS
FOUNDATION 1  test structure        ✅ 2026-08-23
FOUNDATION 2  tooling debt          ✅ 2026-08-23
FOUNDATION 3  two-client coverage   ✅ 2026-08-23
FOUNDATION 4  D8                    ✅ 2026-08-23 — the last architecture debt
FOUNDATION 5  one release           ── PREPARED; the publish is the user's
```

**How it actually went, against how it was planned.** Phase 2 was correctly called as where the
value is. **Phase 4's D2 was called the item that should make anyone nervous, and it was not** —
it turned out far smaller than its own row claimed, because that row's evidence had gone stale.
**The FOUNDATION PASS's stage 3 inherited the same billing ("the least certain work in this
plan") and was likewise the cheapest.** ⚠ Twice now the thing labelled risky has been cheap and
the surprises have come from somewhere else — from a stale measurement (D2's row), from a
checking apparatus that agreed with itself (Phase 3's gate), and from an estimate nobody had
taken (the sleep budget). **Distrust the risk labels; re-measure before scoping.**

---

## Settled calls

- **JSDoc + `// @ts-check`, not TypeScript** (user call, 2026-08-22). The sibling
  `fvtt-mcp-molten5e` is TypeScript with a real build; this module's no-build-step hot-deploy
  is worth more. `tsconfig.json` with `checkJs`/`noEmit` type-checks the shipped source as-is,
  adoptable one file at a time and reversible.
- **No bundler, no transpile.** What ships is what is written (§0.1).
- **Investigate the disposable test world** (user call, 2026-08-22) — approved as part of
  Phase 5, and worth starting early because it makes every other suite change cheaper.
- **D2 (`hold.js` onto the spine) ships alone, last, behind its own walk.**
