# HANDOFF — the dnd5e 6.0 compatibility pass (written 2026-09-15, late evening)

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). Every line below is the state at the moment of writing, measured.

## ⚠ Read this first: the order of work

1. **The MCP itself is being updated for 6.0 first** (`../fvtt-mcp-molten5e` — its headless
   client, tools and `dist/` were written against dnd5e 5.3.x; the sandbox is now a 6.0.1 box).
   Battle Flow's harness (`tools/harness.mjs`, every suite and probe) rides that repo's
   `dist/foundry.js`, so nothing here runs against the sandbox until the MCP pass is done.
   **Do not start Battle Flow's phase 1 until the user says the MCP is ready.**
2. Then Battle Flow's pass, per `ASSESSMENT.md` §4 — phase 1 first. The user says "go".

## Where things stand

- **Prod is on the RESTORED pre-6.0 box:** Foundry 14.364 / dnd5e 5.3.3, Battle Flow
  **v1.42.0** (main == tag == release == prod, released late 2026-09-15 for the game session
  of **2026-09-22**). Prod plays on 5.3.3 until the 6.0 pass ships and the user says so.
  ⚠ Do NOT deploy 6.0-pass bytes to prod; do NOT copy prod → sandbox while the pass runs (it
  would put 5.3.3 content under a 6.0 system).
- **The sandbox is the 6.0 box:** Foundry 14.367 / dnd5e 6.0.1, the world active. Its copy of
  `modules/fvtt-mod-battleflow/module.json` has the dnd5e pin raised to `6.0.99` (the repo's is
  still 5.3.99 — the server silently refuses to activate a module whose system maximum is
  exceeded). Battle Flow is ENABLED in the sandbox world (v1.42.0 bytes are NOT deployed there —
  it runs v1.41.0; deploy with `deploy-house-module.mjs fvtt-mod-battleflow --local` when the
  pass starts). The BF Test fixtures are placed (`tools/fixture-suite.mjs` ran). World settings
  verified CLEAN against `tools/verify-settings.mjs` after the battery. A world snapshot taken
  BEFORE the fixtures sits at `bf-snapshots/`; `node tools/world-snapshot.mjs restore` returns
  the sandbox to the exact prod copy of 2026-09-15 (ruling 5: keep the fixtures for the pass).
- **`ASSESSMENT.md` is the plan.** The break list by class (§2), what the platform now offers
  (§3), the HTML-anchor posture (§3b), the phased order (§4), and **all five rulings closed**
  (§5): the clock adopts the platform's pseudo-expiries; concentration prompts are VETOED with
  the user's rationale recorded (carry it into the code comment, DESIGN R1 and the commit);
  emanations stay Battle Flow's and the platform's auto-behaviour is suppressed on adopted
  regions (measured: the PHB pack declares zero behaviours, the mechanism works when authored,
  neutrals excluded, concentration did not clean up); null AC follows 6.0 (a miss); the sandbox
  keeps its fixtures.
- **The battery at 6.0.1** (v1.41.0 bytes, pin raised): `dist/battery/2026-09-15T18-09-57/` —
  23 of 27 suites failed in 94 minutes, exactly the class the diff predicted. Green or near:
  smoke-surfaces 17/17, smoke-riders 8/8, smoke-emanations 63/68, smoke-concentration 9/10.
  Dead at the first guard: battleflow, hold, saves, maneuvers, volleys, clock, hitmenu, shields.
  ⚠ The suites assert on the same `flags.dnd5e.*` the module reads — they are rewritten class
  by class alongside the code (ASSESSMENT §2.O).
- **Hook inventory:** `tools/dnd5e-hooks.json` is at 5.3.3 in the tree (verify green on main).
  Regenerate it in phase 1 with
  `node tools/check-hook-dispatch.mjs --regen C:/Users/sippelmc/AppData/Local/FoundryVTT/Data/systems/dnd5e`
  (6.0.1: 8 hooks added, 0 removed) in the same commit as the module.json pin bump.
- **The dnd5e source diff** that the assessment was read against: clone
  `https://github.com/foundryvtt/dnd5e.git` (`--filter=blob:none`), tags `release-5.3.3` and
  `release-6.0.1`; `git diff release-5.3.3 release-6.0.1 -- module` is the reference. The three
  diff analyses (chat layer; rolls and activities; actors, effects, tokens, regions) are
  summarised into ASSESSMENT §2–3 with file:line cites; nothing else was kept.
- **`tools/probe-platform-emanations.mjs`** (new, committed): the measurement behind ruling 3 —
  `read` prints each aura spell's behaviours/effects; `module-off` / `walk` / `module-on`
  toggles Battle Flow in the world and walks a friendly, a neutral and a hostile through a
  hand-authored platform behaviour. Reusable when the pack data changes.
- **Deferred, not owed:** the user's final walk of v1.41.0's effect view (the seven items in
  the retired handoff `c424a89`) — "already tested anyhow". Bramblemaw's Miasma key edits landed
  on the pre-6.0 prod and are in BACKLOG's row.

## Phase 1, when the user says go (ASSESSMENT §4.1)

The pin (6.0.0 min / 6.0.1 verified / 6.0.99 max), the hook artifact, `CONFIG.statusEffects`
as an object (`shared.js:164`), the shared readers (`shared.js` hitTargets /
resolveAttackMessage / forceStatus, `effect-riders.js` messageActivity + the applier built the
tray's way with `Activity#getAppliedEffectChanges`, `lookup.js`), ONE seam module for "what
kind of card, whose, from which" (decide-tier, unit-tested against 6.0.1 message shapes), and
the surfaces map + `tools/check-surfaces.mjs` static gate (§3b). Green: smoke-battleflow,
smoke-hold — their asserts rewritten in the same commits. Deploy `--local` after every change;
a world reload is enough for scripts, a process restart for module.json.

## Hazards paid for this session

- The harness's `Bash` background cap is 10 minutes — a battery launched that way survives
  (it detaches) but its stdout is lost; read `dist/battery/<run>/` instead. Watch the process by
  PID (`tasklist //FI "PID eq N"`), not by command-line grep — two watchers misfired.
- `game.settings.set("core","moduleConfiguration")` from an assistant-role client is accepted
  and silently dropped while the module's system maximum is exceeded. Raise the pin, restart the
  process, then enable.
- An emanation region's shape needs `base: { type: "rectangle", x, y, width*grid, height*grid,
  rotation }` — a bare token bounds object fails validation ("base: does not have a valid type").
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.

## When this is delivered

Retire this file (delete it, say so in the commit). ASSESSMENT.md retires with the last phase.
