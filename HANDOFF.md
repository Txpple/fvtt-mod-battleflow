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

## State at a glance — 2026-08-23

| | |
| --- | --- |
| **Do first** | 📋 **Nothing is in flight, and nothing is half-done.** The refactor and the foundation pass are both closed, **v1.22.0 is released and on the sandbox**, and the tree is clean and pushed. ▶ **The next work is FEATURES** — see NEXT below, where the scoping is already done. |
| Release | ✅ **v1.22.0 RELEASED AND ON THE SANDBOX, 2026-08-23** — <https://github.com/Txpple/fvtt-mod-battleflow/releases/tag/v1.22.0>. Both assets attached; the **published** zip was downloaded back and proven self-contained (30 entries, 27 scripts including `decide/`, 101 relative imports all resolving, both manifest fields in step). |
| Prod | ⚠ **PROD STILL RUNS v1.20.0, BY INSTRUCTION** — user call 2026-08-23: *"sandbox only, no prod yet"*. It has run pre-refactor code throughout, deliberately. **Do not update it without being asked.** |
| Repo | `main`, clean, **pushed**. |
| **The debt register is closed** | ARCHITECTURE §10: **every row is repaid or settled by decision.** D1, D2, D3, D5, D6, D7, D8 repaid; **D4 dropped** and the two surviving import cycles **permanent** — both because doing that work would make the tree worse, and the argument is in their rows. ⚠ **That table is now a record, not a list of things to do.** |
| Verify gate | `npm run verify` — **eight static checks then the unit tests, all offline, all in seconds.** biome (**95 warnings, 0 errors — the baseline**), knip, **typecheck**, imports (267 bindings), hook order (75 registrations, 10 pairs), registry (12 checks; it prints the R4 kinds table), manifest in-step, comments (306 blocks / 27 files), vitest **215**. ⚠ **Three numbers are PINNED and fail the gate deliberately** — the R4 kind total (**16**), the source-file count (**27**) and the two `module.json` version fields agreeing. That is the point, not an obstacle. |
| **Testing** | ⚠ **`node tools/battery.mjs` is the front door.** Thirteen entries in the order that works, **every one captured to `dist/battery/<stamp>/` before anything is summarised**, `verify-settings` at the end. `--from <suite>` resumes; `--snapshot` rolls the world back; `--list` shows the order. Every suite also takes `--list` and `--section N`. |
| Sandbox | ⚠ **HEADLESS, and it is THE test environment.** `node <mcp>/scripts/local-foundry.mjs start\|stop\|status\|restart`; deploy with `node <mcp>/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local` — **never without `--local`**. Never the Electron app for suites (dataPath lock). ✅ **Carries v1.22.0 byte-identical** (stop → deploy → start, 2026-08-23), and **smoked green after the deploy**: battleflow ALL PASS → hold ALL PASS, `verify-settings` CLEAN. ⚠ **LEFT RUNNING** (world active, 0 users, pid 20604) — `status` first, `stop` if you are not testing. |
| Bridge | Disconnect before any suite. Suites join as `Tester Assistant`; the two-client ones also join as `PC Assistant`. ⚠ One suite at a time is **enforced** now (a pid lock in `harness.mjs`), not remembered. |
| **Parity** | ✅ **PROVEN 2026-08-23** — full battery on a sandbox carrying the released code byte-identical, **every suite green, settings CLEAN, 19m58s**: battleflow ALL PASS (33) · hold ALL PASS (44) · saves 74/74 · volleys 39/39 · maneuvers 54/54 · cast 17/17 · riders 8/8 · concentration 47/47 · twoclient 9/9 · popup-routing ALL PASS · effects 54/54 · resources 18/18. |
| Flakes | ⚠ **`smoke-battleflow` "2 FAILURE(S)" is NOT DIAGNOSED** — twice seen (2026-08-22, 2026-08-23), never reproduced, and nothing claims to have fixed it. **What changed is that its evidence can no longer be lost:** both sightings had their assertions thrown away by a `\| tail`, and the battery captures the full body first. **If it recurs it will name itself — capture first, read second, re-run third.** ⚠ `smoke-effects` has a documented dice-variance class: re-run before diagnosing. |

---

## ▶ NEXT — features, and the scoping is already done

**The standing "no features" directive is satisfied and lifted** (see below). What comes next was
surveyed during the refactor, and the survey is the reason D8 exists.

### The three surveyed d20 features are ONE KIND, and the module already ships a member of it

**Precision Attack** ([maneuvers.js](scripts/maneuvers.js) `resolvePrecision`) is the working
template for all three. **Scope them together — do not take them one at a time.**

1. `activity.use()` — the system consumes the resource.
2. the new die posts as **its own public message**, stamped `respondsTo` (the §4.1 relay).
3. the module recomputes the verdict **on a module flag** — the original `Roll` is never touched
   — and announces the arithmetic in the open (*"14 + 6 = 20 vs AC 18 — now hits"*).
4. `hitTargets` re-reads the new verdict and re-drives the chain.

| Feature | How it differs from Precision |
| --- | --- |
| **Heroic Inspiration** | `replace` where precision has `add` — a REROLL. ⚠ It has **no activity at all**: dnd5e 5.3.3 models it as a bare `BooleanField` on `character` only, plus a sheet toggle. Spending it means writing the boolean, which is exactly what the system's own button does. |
| **Tactical Mind** | a CHECK where precision has an attack, `add` of `1d10`. ⚠ Its only genuinely new mechanic is **un-spending a use** — Second Wind is refunded when the boosted check still fails. |
| **Bardic Inspiration** | a different die and a different spender. Otherwise the same shape. |

⚠ **THE CONTENT LOOKUPS ARE DONE — do not repeat them.** Both cost real time and neither is
findable by guessing:

- **Heroic Inspiration's rules text**, which presentation law 8 requires you to quote verbatim:
  `dnd5e.content24` → *Appendix D: Rule References* → page **`nkEPI89CiQnOaLYh`** — *"you can
  expend it to reroll any die immediately after rolling it, and you must use the new roll… if
  you already have it, it's lost unless you give it to a player character who lacks it."*
  ⚠ Note **"any die" reaches damage too**, and the transfer clause is a second unmodelled half.
- **Tactical Mind**, verified against the world's own compendium (**`phbftrTacticalMi`**): it
  ships a real `utility` activity consuming `itemUses` against Second Wind with a `1d10` formula.
  So the *spend* is `activity.use()`; only the **refund** is unmodelled.

⚠ **And one place the system will not help you.** Heroic Inspiration has **no consumption route**:
dnd5e's consumption kinds are `activityUses · itemUses · material · hitDice · spellSlots ·
attribute`, and a boolean is none of them. There is no reroll or transfer code anywhere in 5.3.3.

⚠ **START AT ARCHITECTURE §11 — "Adding a FOLD".** D8 made these cheap: each is an entry in
`ATTACK_FOLDS`/`SAVE_FOLDS` plus whatever stamps its flag, **not** another parameter on
`hitsAmong`. Rule 4 of that checklist is a debt: **the first fold that can turn a HIT into a MISS
owes the auto-revert** (user ruling; see Design rulings below).

⚠ **The `preRollD20TestV2` seam, re-measured in the dnd5e 5.3.3 source** — this table is why
"just hook the d20" is not a plan. It is in *Reference* below; read it before designing.

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
- ⚠ **The zip is the one artifact nobody exercises, so it is the one that rots.** Two release bugs
  have hidden there (backslash separators v1.1.0–v1.1.15; the missing `scripts/decide/` after
  Phase 2). The builder now re-reads the finished archive and proves every relative import
  resolves inside it — **and read its file list at every release anyway**, which is how the
  second one was found.
- ⚠ **Release notes are HAND-WRITTEN into `dist/RELEASE-NOTES.md`, never `NOTES.md`** — that is
  the internal working-knowledge doc, and publishing it would put every hard-won finding on a
  public page. The builder's usage comment said otherwise until 2026-08-23; the comment was wrong,
  not the practice.
- Two windows at the table (GM + a player owning Thomas/Morgash). **"Nothing popped" must always
  ask WHICH WINDOW.**
- **First-suite-after-cold-boot is a real flake class** — re-run before diagnosing.

---

## The parallel session

A second Claude session ("fvtt-mod-battleflow-a1") audited this tree on 2026-08-22. **Reference
only — it is not a guide**, and it is now well out of date. Every claim of its that mattered was
re-verified and three were corrected; it also caught a real error of ours and contributed the
ownership rule above. **Prefer its file:line pointers; distrust its categories and its urgency.**

⚠ **Do not assume a Claude session owns any doc in this tree on the basis of timing.** Three
commits landed within ~70 seconds on 2026-08-22, authored like every other; that inference was
made here once and was wrong.
