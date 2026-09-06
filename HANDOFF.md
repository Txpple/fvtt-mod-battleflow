# HANDOFF.md — the machine-tier pass, Stages 4a → 5 (recut 2026-09-05, end of the first window)

> **Temporary by house rule** (BACKLOG's header: a commission is written when there is one and
> retired when it is delivered). The first window delivered Stages 0 through 3b and stopped on
> the user's instruction (*"pause after 3b, commit, handoff for a fresh context window"*).
> Retire this file when the pass is delivered (docs recut, PLAN.md's block gains its *HOW IT
> WENT*) or declined. Delete it in that same commit.

## Where things stand (recut 2026-09-06, the second window, mid-battery)

- **Tree:** `main` at `6614f9b` = v1.32.1 plus the whole pass: Stage 4a `1d663cb` (maneuvers.js -> five files), 4b `ea8fbd8` (mastery.js -> mastery/topple/chip-spend), 4c `6e49754` (saves.js -> `scripts/saves/`, the save gate -> reminders.js), the Stage 4 docs recut `fccccbb`, Stage 5 `6614f9b` (the drivers on `drivesMomentFor`; ruling 4: the cast slice on the caster's flow elect; `smoke-nogm` section cast). Nothing released; **module.json still 1.32.1**; prod untouched.
- **Gate at HEAD:** `npm run verify` green - 61 source files, biome baseline **202**, 5 pinned pairs (1 OPEN: `saves/verdict.js -> receipts.js`), snapshot 180 registrations.
- **Sandbox:** HEAD deployed with `--local` (the deploy never prunes: the stale `maneuvers.js` and `saves.js` were deleted by hand from the module folder - ⚠ a prod WebDAV deploy will need the same, or ship the zip), process bounced.
- **Batteries:** Stage 4a's deploy: 25/28 - effects section 14a (the dice-variance class, hp 0), emanations 11e + its cascade 11f (the suite's own race), and `smoke-nogm` section cast, which ran from the tree against the 4a code where ruling 4 did not exist yet - the new test biting on the old behaviour, expected. Settings CLEAN. **The HEAD battery (4b + 4c + 5) was running when this was written** - its log is the scratchpad's `battery-head.log` / `dist/battery/<newest>`; a red in the two known classes reruns alone before it counts.
- **Owed to close the pass:** the HEAD battery green (or its reds explained as the known classes on rerun); PLAN.md's block gets its *HOW IT WENT* with the measured costs (4a about 1 session as estimated, 4b half, 4c one - the plan said two, 5 half); this file is DELETED in that commit; the memory note updated. **No release, no prod deploy** - both on the user's word.

## What NOT to do

- Do not release or deploy to prod; do not force-reload the user's prod window.
- Do not run a suite while the user is walking the sandbox; disconnect the bridge before a suite.
- Do not commit on a grep's exit code.
