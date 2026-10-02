# HANDOFF.md — 2026-10-02 (the overnight run): Arcana and Faerûn built; Ravenloft HELD; the releases in flight

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Wait for the user's go.** A ruling in chat is not a go. Rapid dev mode stands (no walkthroughs). 3.0.0 is the user's
> to cut by hand.

## FIRST — the state (read the bottom section for what is still in flight)

- **The user's brief (2026-10-01 ~23:00):** *"go arcana=>faerun=>ravenloft order. work autonomously. do arcana and
  faruen. stop at ravenloft."* + *"wrap up e-004"* + *"make sure sword of sharpness needs no other work than the errata"*
  + *"start up sandbox"*. Everything below was done without the user; the defaults taken for the plan's §7 are in
  RULINGS *Arcana Unleashed* (one minor per book, bestiaries by name, summons on #1, the Survivor fix first).
- **E-004 WRAPPED:** Errata 5e v1.0.0 (with E-004) was already released and #754 labelled `worked-around`; tonight Errata 5e
  was DEPLOYED to prod (it was absent — every path 404) and prod's world config switched: `fvtt-mod-errata5e` ON,
  `fvtt-mod-vendorfixes` OFF — ⚠ **both take effect at the next world launch, i.e. the user's process restart** (the
  same restart the v2.11.0 version string waits on). Battle Flow needs nothing for the Sword of Sharpness (RULINGS'
  line now names E-004).
- **The Survivor collision FIXED** (`FEATURE_TYPES` in registry.js: a feat name another book shares is told apart by
  `system.type.value`; Ravenloft's Survivor feat answers none of the Fighter's rows) — smoke-splat §1 proves it live.
- **Arcana Unleashed BUILT** — b0357f1 on main, pushed: RULINGS *Arcana Unleashed*, [audits/arcana-register.md](audits/arcana-register.md)
  (257 rows: 38 MODULE · 23 WAITS · 26 OUT · 97 TEXT · 73 NATIVE), the drawing [audits/drawings/splat-arcana.md](audits/drawings/splat-arcana.md),
  `tools/audit-splat-register.mjs <arcana|faerun|ravenloft>` (the per-book register generator),
  `tools/merge-corpus-identifiers.mjs` (the identifier snapshot extended from the offline corpus — the bestiaries are
  Actor packs the live probe never opens), `tools/smoke-splat.mjs` (in ORDER after smoke-classes). ~40 rows, seven facets, no kind.
- **Heroes of Faerûn BUILT** — a3fac84 on main, pushed: RULINGS *Heroes of Faerûn*,
  [audits/faerun-register.md](audits/faerun-register.md) (122 rows: 31 MODULE · 16 WAITS · 18 OUT · 41 TEXT · 16 NATIVE),
  the drawing [audits/drawings/splat-faerun.md](audits/drawings/splat-faerun.md); smoke-splat §6–§10 (the whole suite
  24/24 on the sandbox). ~35 rows, six facets (`judge: "enemyBloodied"`, `hitMelee`, the reroll `bonus` — counted by the
  margin gate too, the cast riders' `use`, the clock riders' `activities`, `pulse: "sourceTurnStart"`, the evasions'
  `spells`/`effect`/`item`, the save presses' `types`), no kind. Also the SAVE_PRESSES Command collision guard (the
  construct's "Command" action is not the spell) and three `ALIASES`. ⚠ Elemental Rebuke carries NO row `uses`: its
  activity consumes the feature's use itself (a row spend on top left the cast unpaid — the §7b defect).
- **Ravenloft is HELD** (the user's stop). Its prework stands in the plan; its Survivor collision is already fixed.

## The releases — what the run did or was doing when it stopped

1. ✅ **v2.12.0 (Arcana) RELEASED and ON PROD** — 85c0ac0, CI run 36974089094 green, prod byte-identical, settings CLEAN.
2. **v2.13.0 (Faerûn) — the full battery on a3fac84 launched detached 02:53 (`dist/battery-faerun.log`; status =
   `node tools/battery-status.mjs`).** A red on a suite green an hour earlier is fixture state or timing until proven
   otherwise (molten-test-box): re-run it alone before believing it (saves §32 is the known dialog-text flake).
   Then: `node tools/bump-version.mjs 2.13.0` → a `release: v2.13.0` commit touching module.json ALONE → annotated tag →
   `git push --follow-tags` → CI publishes → prod deploy (`FOUNDRY_HOST=molten node ../fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs fvtt-mod-battleflow`,
   `--check` first — an all-identical hash is a HALF-AWAKE box, wake it with get-world-info) →
   `BF_TARGET=prod node tools/verify-settings.mjs` (`--fix` on drift) → disconnect the molten bridge.
3. HANDOFF retired; BACKLOG 5b and the memory updated.

**If a step is half done, the tags and `git log` tell which; prod's version is `deploy-house-module --check`.**

## Suite lessons (keep them)

- ⚠ No `foundry-local5e` MCP call while a battery runs: it joins the bridge and every later suite fails its preflight.
- The Halfling fixture's Lucky HOLDS every hit on it for the rescue popup: spend its uses for a run that hits the Halfling
  (smoke-splat does, and puts them back).
- A hit-menu option whose dice live on its SAVE activity (Arcane Shot) rides them with `saveDice`; the pack's
  `onSave: "full"` is "the save never modulates them" — the saves machine rolls nothing for a `full` save (Web's burn).
- A `judge: "becameBloodied"` reads Hit Points AFTER the damage: before = now + the amount landed.
- The offline scan needs NO bridge — prefer it over `scan-corpus.mjs` for any book census.
- Heredoc edits mangle backslashes AND `\'`: write edit scripts to a scratchpad FILE (python, `newline=''`).
- No dates in code comments, no user quotes in code comments (a check fails them in `scripts/`). Commit bodies ASCII.
  `biome --write` on named files only.
