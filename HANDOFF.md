# HANDOFF — the dnd5e 6.0 compatibility pass: DELIVERED on the sandbox; the release is pending

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). The pass's plan (ASSESSMENT.md) is retired into NOTES §2 *The dnd5e 6.0
> pass*; this file retires with the release commit.

## What is left, and whose call it is

Every phase of the pass is delivered and committed on main (phases 1–4, then phase 5's docs and
the version, v2.0.0): the module rides dnd5e 6.0.1 on the sandbox with the FULL BATTERY green
(29 of 29 entries — the last red, smoke-nogm §rejoin, was the suite counting §spent's notice
as the rejoin's; fixed 2026-09-16, 24/24 twice). Settings CLEAN. The sandbox is byte-identical.

Three things are the user's:

1. **The ring's look.** Every aura and listed spell's ring is a Region drawn by the region itself
   (visibility ALWAYS, highlightMode `shapes`, the reach's hue) — the platform draws its own 6.0
   areas as covered squares (`coverage`). A screenshot of the Paladin's aura on the test range
   was handed over with phase 5. Rule: keep, or the platform's look (`highlightMode: "coverage"`
   in emanations.js and the cast placement — one field each), or hidden.
2. **The version.** Bumped to **v2.0.0** (the pin moved to a platform major and v1.42.0 is the
   last release for 5.3.x — the textbook major). A minor (1.43.0) is one `bump-version` away
   if preferred; nothing is tagged or pushed.
3. **Prod.** Prod is the RESTORED pre-6.0 box (Foundry 14.364 / dnd5e 5.3.3, Battle Flow
   v1.42.0) for game day 2026-09-22. **v2.0.0 cannot run there** — its pin is 6.0.0–6.9.99, and
   Foundry drops the module's enable silently when the system maximum is exceeded. The release
   ships when prod moves to dnd5e 6.0 (the user's upgrade, the user's timing); the deploy then
   MUST ship the new module.json (a WebDAV copy never prunes — nothing was removed from
   `scripts/` this pass, so the copy is enough, but `--check` after).

## The release chain (NOTES §5 *Release*; the sequence that worked every time)

`npm run verify` → commit → annotated tag `v2.0.0` → push main + tag → `tools/build-release.ps1`
(runs verify, forward slashes) → hand-written `dist/RELEASE-NOTES.md` (never NOTES.md) →
`gh release create v2.0.0 --notes-file dist/RELEASE-NOTES.md <zip> module.json` → when prod is on
6.0: `deploy-house-module.mjs fvtt-mod-battleflow --check` (an all-identical hash is a half-awake
box: wake it with a molten5e read, re-check) → deploy on the user's word → `--check` every file
MATCH → `disconnect-bridge` on molten5e. The PROCESS restart that vends the version string is
the user's via the Molten panel. Delete this file in the release commit and say so.

## Hazards (still true)

- The harness's `Bash` background cap is 10 minutes — the battery runs in the background with
  its stdout redirected to a file under `dist/`; read that.
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.
- ⚠ If a suite reports an AC, a save, a corpse or a token square that cannot be, run
  `node tools/scrub-fixture-residue.mjs` and `node tools/fixture-suite.mjs` first.
- `Scene#templates` is deprecated at Foundry 14 — never read it; a drawn template is a Region with
  `flags.core.MeasuredTemplate`. An emanation region's shape is `emanationShapeData`.
- ⚠ Do NOT copy prod → sandbox while prod is still 5.3.3 (the sandbox is the 6.0 box).
