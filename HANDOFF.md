# HANDOFF — the dnd5e 6.0 compatibility pass (phases 1 and 2 delivered 2026-09-16, early; phase 3 next)

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). Every line below is the state at the moment of writing, measured.
> `ASSESSMENT.md` is the plan; this file is where the pass stands against it.

## ⚠ Read this first: the next step

Phase 3 of ASSESSMENT §4 (AREAS — class I: `saves/areas`, `geometry` on regions, `emanations`
on the new placement hooks, with the §3.6 ruling applied) starts **on the user's "go"** — not on
this file. Before the first edit: `git log --oneline -3` (parallel sessions collide),
`node ../fvtt-mcp-molten5e/scripts/local-foundry.mjs status` (the sandbox up, the world active),
`deploy-house-module.mjs fvtt-mod-battleflow --local --check` (byte-identical), and
`node tools/verify-settings.mjs` (CLEAN). Same discipline: the file swept, its suite's asserts
rewritten in the same commit, deploy --local, the suite green, settings verified. ⚠ If a suite
reports an AC or a save that cannot be, run `node tools/scrub-fixture-residue.mjs` first (below).
Nothing is released until phase 5, and prod stays 5.3.3 / v1.42.0.

## Where things stand

- **Prod is on the RESTORED pre-6.0 box:** Foundry 14.364 / dnd5e 5.3.3, Battle Flow **v1.42.0**
  (main at the pass's commits is NOT deployable to prod — its pin is 6.0). Prod plays on 5.3.3
  until the pass ships and the user says so (game session **2026-09-22**). ⚠ Do NOT deploy the
  pass's bytes to prod; do NOT copy prod → sandbox while the pass runs.
- **The sandbox is the 6.0 box:** Foundry 14.367 / dnd5e 6.0.1, the world active, the tree
  deployed there (`deploy-house-module.mjs fvtt-mod-battleflow --local`, byte-identical at the
  end of phase 1). Fixtures placed, settings verified CLEAN after the last run. The pre-fixture
  snapshot (`bf-snapshots/`, `tools/world-snapshot.mjs restore`) is the way back.
- **The MCP repo's 6.0 pass is done** (`../fvtt-mcp-molten5e` v1.5.2, `58c9687`) — the harness
  rides it; every suite and probe below ran through it.

## Phase 1 — DELIVERED (ASSESSMENT §4.1)

- **The pin:** `module.json` dnd5e 6.0.0 → 6.9.99 (the whole 6.x line, user 2026-09-15), verified 6.0.1; `tools/dnd5e-hooks.json`
  regenerated (8 added, 0 removed); `CONFIG.statusEffects` read as the object it is (`forceStatus`).
- **The seam:** `scripts/decide/card.js` — what kind of card, whose, from which, off `type` and
  `system.*` ONLY (never the flags; unit-tested against 6.0.1's own shapes, `tests/decide-card.test.js`).
  `targetsOf` hands every reader the house shape (`uuid` = the target ACTOR, one row per actor,
  the token beside it); `originData` / `ORIGIN_KEY` is what every roll the module drives writes.
  ⚠ A reader joins the seam WITH its customer (knip fails on one nobody reads): phase 2 adds the
  mastery, the attack mode, `onSave`, `resisted`, `targetsInData`, the death/concentration
  predicates beside the files that read them.
- **The shared readers through it:** `shared.js` (`hitTargets`, `resolveAttackMessage`,
  `effectSourceOf` reads `system.origin` first, `poolSpendsOn`, new `targetDescriptorOf`),
  `lookup.js`, `effect-riders.js` — **the applier is built the tray's way** (`getAppliedEffectChanges`,
  `system.origin`, dedupe on `_stats.duplicateSource`, `forApplication`; `origin` still written
  for this module's own readers until phase 2 migrates them), `messageActivity` is
  `getAssociatedActivity()`. **Ruling 1 landed:** `appliedClock` (rules 1 and 2) is RETIRED —
  the platform's clock stands (`tools/probe-applied-clock.mjs` deleted with it; DESIGN §5's text
  is phase 5's). **Ruling 4 landed:** a null AC is a MISS (`decide/verdict.js`).
- **The chain files for the two suites:** auto-apply, auto-damage (`rollDamageForAttack` is
  6.0.1's own one-liner, `ability` forwarded), polish (the potion snapshot at `system.targets`,
  `getAssociatedActivity`, the item's name off the card's reference), hit-riders, reminders (the
  origin in the data, the save record's kind), ui (`demandAnsweredBy`'s facts: `rollType` is the
  card kind, `saveKind` the sub-kind), hold/spell-damage, hold/spell-hold, hold/lookup (profiles
  resolve async; the applying activity passed through), hold/continue (a fixed AC is `override`).
- **The surfaces map + gate (§3b):** `scripts/surfaces.js` holds every platform HTML anchor (10:
  three core, seven dnd5e); `tools/check-surfaces.mjs` fails the build on a selector literal
  outside the map (67 sites swept, 30 files) and on a dnd5e anchor gone from the verified
  version's templates (`tools/dnd5e-surfaces.json`, `--regen`, pinned). In `npm run verify`.
- **Green:** verify (642 unit tests, every static check incl. the new gate); on the sandbox
  **smoke-battleflow ALL PASS** (full run + §5e re-run) and **smoke-hold ALL PASS** (full run
  with one failure, §4d6, fixed and re-run green). Their asserts read the 6.0 card (`m.type`,
  `_source.system.origin`, `system.targets`) and write `system.origin`; the forced AC is
  `override`.

### Findings paid for in phase 1 (carry into NOTES in phase 5)

- **A moved token's document is INTERIM while it walks** (Foundry 14.367, measured by the new
  `tools/probe-auto-crit.mjs`): `doc.x/y` follow the animation (100 → 370 at 300 ms), `_source.x/y`
  hold the destination from the moment the update resolves. `geometry.js documentSquares` reads
  the source now; the automatic crit within 5 ft of a Paralyzed victim fired one swing late before.
  Suites: never sleep for a walk — wait for `doc.x === doc._source.x` (§5e's `arrived`).
- **A walk to a square off the scene is CONSTRAINED to the edge** — §5e's "10 feet" square lay off
  the scene once other suites had parked the victim at x=100; the section places the victim on
  its fixture square first.
- **6.0's AC model at the fixtures:** the forced AC is `override`; a crashed run's override
  outlives the 5.x `calc: 'default'` restore (it clears nothing now) — smoke-hold's stand-in resets
  `override: null` every run. The victim's `override: 1` after smoke-battleflow is pre-existing
  behaviour (5.x left `flat: 1` the same way).
- The headless client throws inside the token animation when a token update's result is sampled
  SYNCHRONOUSLY (`#createAnimationMovementPath`, `.last` of undefined); await the update.

## Phase 2 — DELIVERED (ASSESSMENT §4.2), 2026-09-16 early

- **The readers, through the seam:** every `flags.dnd5e` read in `scripts/` is gone except the
  REGION/TEMPLATE flags (class I, phase 3: `emanations.js`, `saves/areas.js`, `decide/geometry.js`)
  and the flags on EFFECTS and ITEMS the platform still writes (`dependentOn`, an effect's `item`,
  `consumed`). The seam gained `masteryOf`, `onSaveOf`, `resistedOf`, `targetsInData` (null when
  the data names no snapshot — "aimed at nobody" and "not written yet" are different facts) and
  `isConcentrationPrompt`; every driven roll writes `system.origin` (`originData`) — the two the
  first grep missed were NESTED (`flags: { dnd5e: { originatingMessage } }` in saves/ask and the
  fold's spend) and one was optional-chained (`message.flags?.dnd5e` in resources) — grep for
  `originatingMessage`, `flags?.dnd5e` and `dnd5e: {` too, next time.
- **Class G:** `lookup.js` `profileEffects` / `applicableProfiles` (the profile BESIDE its
  effect, so `onSave` and `_id` stay readable) and `profileEffectSync` for polish's preCreate
  `castChoice`. **Class N:** riders clone the shared roll data; `ranged` is a ranged mode
  (reminders `modeIsRanged`); the emanation card labels `system.rolls.*` beside `bonuses.*`.
- **Fix J:** concentration.js vetoes both native prompts by TYPE (`isConcentrationPrompt`), the
  ruling's rationale verbatim in the comment. **Also found:** the private roll mode — dnd5e 6.0
  hands `rollMode` straight to `ChatMessage.create` as `messageMode`, which knows only Foundry 14's
  ids (`gm`, not the deprecated `gmroll` that `CONST.DICE_ROLL_MODES.PRIVATE` still returns) — so
  the concentration roll had gone PUBLIC; `PRIVATE_ROLL_MODE = "gm"`.
- **The suites (class O):** every `smoke-*` / `probe-*` reads the 6.0 card (`m.type`,
  `_source.system?.origin`, `system.targets` mapped `actor → uuid`, `system.mastery`,
  `system.onSave`, `system.resisted` for the LR flip); forces AC through `ac.override` (the 5.x
  `calc: "flat"` pair still forces but its restore clears nothing — every restore leaked an
  override into the next suite) and save outcomes through `abilities.<x>.save.roll.bonus` (same
  story: the old key's `""` cleared nothing); effect change keys `system.rolls.*`; the
  concentration dependent is a `flags.dnd5e.dependents` row (`addDependent` is gone); an applied
  effect's `origin` is the ACTIVITY (the tray's 6.0 changes stamp it); a card's associated actor is
  its TOKEN's actor first (an unlinked fixture speaks as its synthetic actor, under the token's
  name); a concentration save inherits the sheet's own con-save mode.
- **`tools/scrub-fixture-residue.mjs` (new):** clears the override and the bonus the old restores
  left on every BF Test actor — seven fixtures carried residue after the first battery.
- **Green:** verify (648 unit tests, every static check); on the sandbox the battery's middle
  (23 steps) — **every suite passes** except: smoke-saves 105/107 (§1a3, §10b — the usage card's
  button hide, class M, PHASE 4) and smoke-metamagic 82/90 (§9x/9y/9z/9b–9e, §18y — who stands
  inside the Fireball's area, class I, PHASE 3). Runs: `dist/battery/2026-09-16T02-11-50` (the
  first pass, 7 red), `…T02-46-44` (the re-run after the fixes and the scrub), `…T03-12-18`
  (concentration §6). Settings CLEAN after every run. Not re-run this phase: smoke-battleflow,
  smoke-hold (phase 1's), smoke-emanations, smoke-surfaces, smoke-nogm (phase 3's and the last).

## Phase 3 — NEXT, on the user's go (ASSESSMENT §4.3)

Class I: `saves/areas.js` walks `scene.templates` and matches `flags.dnd5e.origin` — regions now,
`flags.dnd5e.activity` / `item` on the region, `region.tokens` for containment; `saves/demand.js`
and `metamagic.js` hand `results.templates` (RegionDocuments) to `tokensInTemplates`;
`decide/geometry.js` reads `flags.dnd5e.dimensions`; `emanations.js` adopts regions (the §3.6
ruling: suppress the platform's auto-behaviour on adopted regions — `createActivityBehaviors:
false` or a veto in `dnd5e.createMeasuredTemplate`). The proof: smoke-metamagic §9/§18,
smoke-saves §8 (areas), smoke-emanations, smoke-surfaces. Then phase 4 (class M — the card
buttons as data, the summaries) and phase 5 (docs, release with the new module.json).

## Hazards (still true)

- The harness's `Bash` background cap is 10 minutes — a suite launched that way survives (it
  detaches) but its stdout is lost; redirect to a file under `dist/` and read that.
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.
- `game.settings.set("core","moduleConfiguration")` is silently dropped while the module's system
  maximum is exceeded — the pin is 6.9.99 now, so this only bites a downgrade.
- An emanation region's shape needs `base: { type: "rectangle", … }` — a bare bounds object fails.

## When this is delivered

Retire this file (delete it, say so in the commit). ASSESSMENT.md retires with the last phase.
