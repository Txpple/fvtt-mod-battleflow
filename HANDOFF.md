# HANDOFF — the dnd5e 6.0 compatibility pass (phase 1 delivered 2026-09-15, late; phase 2 next — written for a fresh window)

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). Every line below is the state at the moment of writing, measured.
> `ASSESSMENT.md` is the plan; this file is where the pass stands against it.

## ⚠ Read this first: the next step

Phase 2 of ASSESSMENT §4 (the readers, classes B–F, the battery's middle) starts **on the user's
"go"** — not on this file. Before the first edit: `git log --oneline -3` (parallel sessions
collide), `node ../fvtt-mcp-molten5e/scripts/local-foundry.mjs status` (the sandbox up, the
world active), `deploy-house-module.mjs fvtt-mod-battleflow --local --check` (byte-identical),
and `node tools/verify-settings.mjs` (CLEAN). Every phase-2 commit: the file swept through the
seam, its suite's asserts rewritten to the 6.0 card in the same commit, deploy --local, the suite
green, settings verified. Nothing is released until phase 5, and prod stays 5.3.3 / v1.42.0.

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

## Phase 2 — NEXT, on the user's go (ASSESSMENT §4.2)

Classes B–F swept file by file through the seam, the suites' asserts rewritten in the same
commits. What is still on the old keys, by `grep -rn 'getFlag("dnd5e"\|flags\.dnd5e' scripts`
(~70 sites): bash-offer, cast (⚠ `castChoice` runs at preCreate, SYNC — profiles have no `name`
now; read the item's embedded effect by the profile's `_id`, `uuid` only for an external one),
chip-spend, command, concentration (fix J: veto both native prompts by TYPE — ruling 2's
rationale verbatim in the comment, DESIGN R1, the commit), d20-folds, damage-casts,
damage-shields, emanations (the region flags — class I, phase 3), hew, mastery (`masteryOf`),
metamagic, precision, resources, riposte, saves/* (`onSaveOf`, `resistedOf`; areas are phase 3),
superiority-uses, topple, volleys (`targetsInData` at the pre-create snapshot), events/moments
(comments only). Class G (`applicableEffects` → `await getApplicableEffects()`): cast, polish
`castChoice`, saves/choices, saves/consequences, saves/demand, hit-menu. Class N: `deepClone` the
riders' shared roll data; accept `ranged`; `bonuses.*` → `rolls.*`.
The battery's middle is the proof: saves, volleys, maneuvers, folds, cast, riders, concentration,
effects, expiry, reminders, sneak, clock, hit menu, shields, heat metal, superiority, metamagic,
resources — `dist/battery/2026-09-15T18-09-57/` is the pre-pass baseline (23/27 failed).

## Hazards (still true)

- The harness's `Bash` background cap is 10 minutes — a suite launched that way survives (it
  detaches) but its stdout is lost; redirect to a file under `dist/` and read that.
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.
- `game.settings.set("core","moduleConfiguration")` is silently dropped while the module's system
  maximum is exceeded — the pin is 6.9.99 now, so this only bites a downgrade.
- An emanation region's shape needs `base: { type: "rectangle", … }` — a bare bounds object fails.

## When this is delivered

Retire this file (delete it, say so in the commit). ASSESSMENT.md retires with the last phase.
