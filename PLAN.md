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
| Docs | 5,990 lines / 6 files | **1,060 / 4** ✅ | done |
| Source | 9,845 lines / 20 files | 10,449 / **27** | ~9,000 / ~26 files (thinner files, more of them) |
| Tools | 14,409 lines / 63 files | **~9,600 / 25** ✅ | ~7,000 / ~25 files |
| Static checks | 1 (hook order) | **6** ✅ (lint, dead-code, **import integrity**, hook order, registry integrity, doc attachment) | + type check |
| Unit tests | 0 | **170, ~270 ms** ✅ | ~150 assertions, < 2 seconds, no Foundry |
| Lint findings | (unmeasured) | 0 errors / 98 warnings | 0 / 0 |
| Live suites | 11 suites, ~8,500 lines, minutes each, run one at a time | unchanged | ~4,000 lines, section-filterable, disposable world |

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
npm run verify   =   biome check  →  knip  →  imports  →  hook-order  →  registry-integrity
                     →  comments  →  vitest
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
      ⚠ A type checker would catch both, but `checkJs` is deliberately off (a 10,000-line
      untyped codebase adopting JSDoc file by file), so `npm run typecheck` passes trivially
      and is not in the gate. This is the slice of that value available today.

### 0.3 Release hygiene

- [ ] `build-release.ps1` keeps its backslash assertion (NOTES §5 — it is the whole point) and
      gains a **`verify` precondition**: no release from a tree that fails the gate.
- [ ] Version bump becomes a script rather than a hand-edit of `module.json` — NOTES already
      records two ways hand-editing that file has corrupted it.

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
- [ ] **Promote to suite sections** — these assert live behaviour that nothing else covers:
      `probe-player-damage` (12 assertions, the crit-flag decoy pin) → `smoke-battleflow`;
      `probe-save-damage-popup` → `smoke-saves`; `probe-volley-resources` → `smoke-volleys`.
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
- [ ] **The flag accessor layer** → `scripts/state/flags.js`. ⚠ **RE-MEASURED 2026-08-22, and
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

## Phase 3 — Registries, unified

The volley registry is the reference implementation and the user's own directive ("long term
scalable, no hacks, modular"). Everything else that answers "which content participates" should
look like it.

- [ ] **One registry shape**, one strict parser, one warn-once-on-unknown-kind path, one
      read-only API exposure. Today the volley registry is a code `Map`, the interrupt list is
      a settings string, the rider table is a different settings string, and the maneuver folds
      are a third — with three separate parsers and three different failure behaviours.
- [ ] **Registries carry their `kind` against a closed set** — and that closed set is checkable
      against the system's own enums (ARCHITECTURE §6 lists them: 12 activity types, 14
      activation types, 8 masteries, 26 conditions, 13 damage types, 3 damage-on-save modes).
      A registry entry naming a kind the system does not have should fail the gate, not the
      table.
- [ ] **Registry integrity in the verify gate** (Phase 0.2).
- [ ] **The R4 tripwire becomes visible**: a short table of "kinds the code knows" so that the
      rate of new kinds per phase is observable. That rate is the AC5e-adoption signal, and
      right now nobody could tell you what it is.

### Not in scope for this phase

Adding coverage. **No new abilities, no new spells, no new kinds.** This phase makes adding
them cheap; it does not do the adding.

---

## Phase 4 — Repay the structural debt

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
- [ ] **D6 — break the `ui.js` ↔ `hold.js` cycle.** ⚠ **It does NOT fall out of D1 — measured
      2026-08-22.** D1 is done and the cycle stands, because `ui.js` holds ~400 of its 697
      lines as the hold's OWN views (row, popup, reaction art, AC read) plus a
      `renderChatMessage` and a `deleteChatMessage` registration. Breaking it means relocating
      those into `hold.js`, which **moves two hook registrations between files** and rewrites a
      pinned assertion (`ui.js before mastery.js`). A stage of its own, with its own battery.
      The other two cycles are worse bargains: `hold.js` ↔ `auto-damage.js` is load-bearing on
      purpose, and `auto-apply.js` ↔ `mastery.js` breaks only by moving
      `applyDamagesWithReceipt` — the damage chokepoint — to a third module.
- [ ] **D2 — bring `hold.js` onto the moment spine.** The hold is the *original* moment machine
      and the one the spine was extracted from, and it is the only machine that adopted **none**
      of it — its own clock, its own latch, its own views. **Highest risk item in this document**
      (it is the most-used feature at the table), so: after D1/D3/D6, behind its own walk, with
      the hold suite green before and after, and shipped alone.

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

- [ ] **Extract the harness.** The same ~20 lines of env-loading and connection boilerplate is
      copy-pasted into all 44 tool files. One `tools/harness.mjs`.
- [ ] **Inject shared page helpers.** Every suite runs one giant `f.evaluate()` closure with no
      imports available inside the page, so every suite re-implements fixture setup, teardown,
      polling and assertion plumbing. That is *the* reason `smoke-hold.mjs` is 1,712 lines. A
      small serialized helper bundle injected into the page cuts every suite roughly in half.
- [ ] **Section filtering** — `node tools/smoke-saves.mjs --section 8`. Today a one-line change
      to template containment costs a full 1,485-line suite run.
- [ ] **Move the pure assertions down to Tier 1** and delete them from the suites. Each suite
      keeps only what needs a live world: hooks firing, dnd5e behaving, clients routing, DOM
      rendering, flags replicating.

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
- [ ] **Simplify the suites to exploit it** — this is the part still outstanding, and it is
      where the payoff is. Teardown correctness, settings restore, the crash-launder hazard and
      canonical-id-only fixtures can all come out once the world is disposable.

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
Phase 0  tooling                    ── no behaviour change, no risk         ── do now
Phase 1  clear tools/               ── no behaviour change, no risk         ── do now
Phase 2  extract DECISION + tests   ── move-not-rewrite, tests prove it     ── the bulk
Phase 3  unify registries           ── follows Phase 2's parser extraction
Phase 4  D1 → D3 → D6 → D2          ── D2 alone, behind its own walk
Phase 5  slim the suites            ── continuous through 2–4
```

Phases 0 and 1 are a session. Phase 2 is several, and is where the value is. Phase 4's D2 is
the only item that should make anyone nervous, and it is deliberately last.

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
