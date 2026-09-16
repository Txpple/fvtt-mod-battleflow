# HANDOFF — the dnd5e 6.0 compatibility pass (phases 1–3 delivered 2026-09-16; phase 4 next)

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). Every line below is the state at the moment of writing, measured.
> `ASSESSMENT.md` is the plan; this file is where the pass stands against it.

## ⚠ Read this first: the next step

Phase 4 of ASSESSMENT §4 (SUMMARIES AND BUTTONS — class M and §3.8: where Battle Flow's rows draw
on chained cards, the card buttons hidden as DATA — `shouldHideChatButton`, not the DOM) starts
**on the user's "go"** — not on this file. The proof it owes is exactly the battery's last two reds:
smoke-saves §1a3 and §10b. Before the first edit: `git log --oneline -3` (parallel sessions
collide), `node ../fvtt-mcp-molten5e/scripts/local-foundry.mjs status` (the sandbox up, the world
active), `deploy-house-module.mjs fvtt-mod-battleflow --local --check` (byte-identical), and
`node tools/verify-settings.mjs` (CLEAN). Same discipline: the file swept, its suite's asserts
rewritten in the same commit, deploy --local, the suite green, settings verified. ⚠ If a suite
reports an AC, a save, a corpse or a token square that cannot be, run
`node tools/scrub-fixture-residue.mjs` (below) and `node tools/fixture-suite.mjs` first.
Nothing is released until phase 5, and prod stays 5.3.3 / v1.42.0.

## Where things stand

- **Prod is on the RESTORED pre-6.0 box:** Foundry 14.364 / dnd5e 5.3.3, Battle Flow **v1.42.0**
  (main at the pass's commits is NOT deployable to prod — its pin is 6.0). Prod plays on 5.3.3
  until the pass ships and the user says so (game session **2026-09-22**). ⚠ Do NOT deploy the
  pass's bytes to prod; do NOT copy prod → sandbox while the pass runs.
- **The sandbox is the 6.0 box:** Foundry 14.367 / dnd5e 6.0.1, the world active, the tree
  deployed there (`deploy-house-module.mjs fvtt-mod-battleflow --local`, byte-identical at the
  end of phase 3). Fixtures placed, settings verified CLEAN after the last run. The pre-fixture
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

## Phase 3 — DELIVERED (ASSESSMENT §4.3), 2026-09-16

- **The area is a Region, everywhere.** `TemplatePlacement.fromActivity` (6.0.1, read from source)
  creates RegionDocuments stamped `flags.dnd5e.activity` (the ACTIVITY — the tie every path keys
  on), `item`, `origin` (the usage TOKEN's uuid now), `spellLevel`, `dimensions`; and at Foundry
  14 `Scene#templates` is DEPRECATED — the toolbar's drawn template is a Region wearing
  `flags.core.MeasuredTemplate`. No MeasuredTemplate is created or read anywhere in `scripts/`.
- **Containment is the platform's own test.** `geometry.js tokensInRegions` runs
  `TokenDocument#testInsideRegion` (grid-aware containment points against the region's polygon
  tree, from the document's committed source position, no canvas) — the v14 shim's corrupted
  `distance`, the `honestDims` rescue and the whole template-shape ladder are gone with the
  template document. `decide/geometry.js` keeps the pure readers and gains `regionShapeTypeFor`
  (the placement's map: rect → rectangle, ray → line, radius → emanation) and
  `emanationShapeData` (the platform's own emanation shape around a token, byte-for-byte),
  unit-tested.
- **saves/areas.js:** regions matched on `flags.dnd5e.activity`; the toolbar claim finds a
  core-flagged unowned region of the expected shape and stamps the activity; the fast paths ride
  `createRegion` / `updateRegion` (which the platform dispatches); the sweeps delete Regions.
  ⚠ A placed region is NOT a concentration dependent at 6.0 (measured 2026-09-15) — the duration
  sweep on `deleteActiveEffect` is the only thing that ends a duration area. The refresh latch
  queues ONE re-offer behind a refresh in flight: the render floor and the createRegion fast
  path land in the same beat at the cast, and the dropped one was the cast's demand staying
  empty (smoke-emanations §6f, one run in two).
- **emanations.js:** a feature's aura and a listed spell's ring are Regions created the
  platform's way (the emanation shape on the token's base, the radius from the EDGE, attached),
  drawn by the region itself (visibility ALWAYS, highlightMode `shapes` — the ring, not the
  covered squares; **the visible change of this phase, for the user to rule on**). The cast
  placement writes what `fromActivity` would (the flags above, `levels`, the move restriction)
  with `options.dnd5e.createActivityBehaviors: false`; `endCastEmanations` matches the
  activity flag. **The §3.6 ruling's veto:** `preCreateRegionBehavior` refuses any `dnd5e.*`
  behaviour on a region this module adopts (flagged, or a listed spell's) — measured empty in
  smoke-emanations §6-2. **The membership floor reads geometry, not `region.tokens`:** Foundry
  fills `region.tokens` through a token update made with `noHook: true`
  (`RegionDocument#updateTokens`), so a just-raised ring's membership lands silently — the floor
  that read it saw an empty set (§11a, one run in three).
- **Customers:** saves/demand (`results.templates` is the flat RegionDocument[]; the flatten
  stays for the hand-fired nested shape), metamagic (regions by id), precision.js (the one
  phase-2 leftover: its use() wrote the deleted `originatingMessage` flag — `originData` now).
- **The suites:** smoke-saves places Regions with the platform's shapes (a cone as a cone, the
  toolbar rect core-flagged) and asserts on `scene.regions`; §12–14's shim scene keeps its
  140px grid but the section proves containment off the region's own geometry (the shim factor
  it logged is moot); smoke-metamagic's area is a Region; smoke-emanations asserts the emanation
  shape and radius (feet × px from the edge), the placement's flags, the veto, the ring's
  visibility, and heals the Victim's TOKEN actor at setup (§7's real damage left it a corpse the
  cast's demand rightly skipped — 6f); §11e creates the stale effect before the stale ring (the
  deleteRegion hooks of §11c re-schedule a sweep that can land between the two); the pack keys
  are accepted in BOTH spellings (the PHB pack still ships `system.bonuses.*`, shimmed until
  7.0); §6c asserts the effect Battle Flow owns, not the platform's arithmetic (see below).
  smoke-surfaces §3 keeps its pin (a MeasuredTemplate create dispatches as a Region) counting
  core-flagged regions. `tools/hook-coverage.mjs`'s two never-dispatched pins are retired with
  the registrations; `tools/hook-order.snapshot` refreshed (createRegion/updateRegion in
  saves/areas.js, preCreateRegionBehavior in emanations.js). `probe-sg-range.mjs` reads
  `tokensInRegions`.
- **`tools/scrub-fixture-residue.mjs`** gains the corpse row: an unlinked BF Test token's
  synthetic actor at 0 HP is healed (matched on the BASE actor's name — the token is "Hobgoblin").
- **Green:** verify (648 unit tests, every static check); on the sandbox **smoke-emanations
  69/69**, **smoke-metamagic 90/90**, **smoke-surfaces 20/20**, smoke-saves 105/107 (§1a3, §10b —
  the usage card's button hide, class M, PHASE 4; §12–14 8/8 on their own run first). Settings
  CLEAN after every run. Runs under `dist/phase3/`.

### Findings paid for in phase 3 (carry into NOTES in phase 5)

- **`RegionDocument#updateTokens` writes membership with `noHook: true`** (Foundry 14.367, read
  from source, measured by §11a): no `updateToken` fires for `_regions`; region events reach only
  behaviours that already exist. Any floor over membership must test geometry itself.
- **A placed region is no concentration dependent at dnd5e 6.0.1** — only ActiveEffects, Items
  and Activities carry the dependents mixin; `endConcentration` leaves the area standing.
- **The PHB pack's Half Speed (`system.attributes.movement.speed` ×0.5) leaves an NPC's speed at
  30 on dnd5e 6.0.1** — the effect lands (Battle Flow's part), the platform's prepare order
  overwrites `movement.speed` from `speeds.walk`. The pack's / the platform's, not ours; a
  BACKLOG row in phase 5.
- **Fixture residue this phase cost a battery:** the platform probe of 2026-09-15 left the Paladin's
  token NEUTRAL (a helpful aura from a neutral source admits no ally — every feature-aura assert
  red); a scratch probe left the Ranger on the ring's inside square (§13b's walk-out a no-op);
  smoke-saves deletes the Victim/Shielder tokens by design and re-creates its own — run
  `tools/fixture-suite.mjs` after it before any suite that needs them (the battery's order does).
- The suite files are CRLF in the working copy; a multi-line edit script must normalise.

## Phase 4 — NEXT, on the user's go (ASSESSMENT §4.4)

Class M and §3.8: the card buttons hidden as data (`Activity#shouldHideChatButton` /
the 6.0 button model — the DOM hide in ui.js is the last HTML-anchored behaviour), and where
Battle Flow's rows draw on CHAINED cards (a damage card is a summary of its usage card at 6.0).
The proof: smoke-saves §1a3 and §10b, then a full battery. Then phase 5 (docs, RELEASE-NOTES, the
version, the prod deploy that MUST ship the new module.json; DESIGN §5 reconciled with the
platform's clock; ARCHITECTURE's geometry rows — `honestDims` and `tokensInTemplates` are gone;
NOTES' findings above; BACKLOG's Half Speed row).

## Hazards (still true)

- The harness's `Bash` background cap is 10 minutes — a suite launched that way survives (it
  detaches) but its stdout is lost; redirect to a file under `dist/` and read that.
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.
- `game.settings.set("core","moduleConfiguration")` is silently dropped while the module's system
  maximum is exceeded — the pin is 6.9.99 now, so this only bites a downgrade.
- An emanation region's shape is `emanationShapeData` (decide/geometry.js) — a `token` base with the
  token's own fields; a bare bounds object fails.
- `Scene#templates` is deprecated at Foundry 14 — never read it; a drawn template is a Region with
  `flags.core.MeasuredTemplate`.

## When this is delivered

Retire this file (delete it, say so in the commit). ASSESSMENT.md retires with the last phase.
