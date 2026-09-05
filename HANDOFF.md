# HANDOFF.md — the machine-tier pass, Stages 4a → 5 (recut 2026-09-05, end of the first window)

> **Temporary by house rule** (BACKLOG's header: a commission is written when there is one and
> retired when it is delivered). The first window delivered Stages 0 through 3b and stopped on
> the user's instruction (*"pause after 3b, commit, handoff for a fresh context window"*).
> Retire this file when the pass is delivered (docs recut, PLAN.md's block gains its *HOW IT
> WENT*) or declined. Delete it in that same commit.

## Where things stand

- **Tree:** HEAD `= the docs commit above `297b634`` = v1.32.1 plus the pass's commits (Stage 0 `5fdff87`, Stage 1
  `c734a21`, Stage 2 `355c455`, Stage 3 in seven commits `1ae1330`…`3cb6183`, Stage 3b
  `297b634`, then this docs commit). Nothing released; **module.json still says 1.32.1**.
- **Prod:** v1.32.1, untouched by this pass. A prod process restart stays the user's; a release
  and a prod deploy stay on the user's word.
- **Sandbox:** running HEAD (deployed with `deploy-house-module.mjs --local`, process bounced).
  Fixtures in place; settings verified CLEAN after the last battery.
- **Gate at HEAD:** `npm run verify` green — 23 static checks, 523 unit tests, biome baseline
  **202** warnings (it was 203; one local helper's removal took one), **6 pinned layer edges
  (2 OPEN under D9)**, no unpinned edge. The hook-order snapshot holds **169 registrations**.
- **Batteries:** Stage 1: two runs (the first found the `tableIndex` key defect; the second 27/27). Stage 2: 28/28. Stages 3 + 3b together at HEAD: 26/28, the two reds the known classes (effects §14a dice variance, emanations §11e the suite's race), both green on the immediate rerun of the same deploy; `smoke-shields` 23/23 three times. Every run ended settings CLEAN.
- **Owed by this pass:** Stages 4a, 4b, 4c, 5 (about 4½ sessions by the estimates; distrust
  them). BACKLOG's pick-up order is otherwise empty.

## What the first window did, and what it learned

The stage marks in [PLAN.md](PLAN.md) → *THE MACHINE-TIER PASS* carry the substance and the
measured cost per stage. The facts a next session would otherwise re-derive:

- **The snapshot is the instrument.** Every move of a registration between files shows as
  lines in `tools/hook-order.snapshot`; `npm run hooks` fails on drift; `--snapshot` refreshes
  in the same commit as an intended move. Stage 3 moved twelve registrations onto ui.js's slot
  and each commit names the lines.
- **`tableIndex` (decide/registry.js) spreads the ROW over `{ key }`, as the four copies did** —
  a row that carries its own `key` field (USE_CHIPS) wins. `keyNamed(name)` is the table key.
  The Steady Aim chip went missing on the first battery of Stage 1 for want of that line.
- **The resumable primitive has two shapes:** keyed on the flag it is a view of (eight), and
  `flagless` (two — the attack payouts and the damage shields judge an ARRIVAL that carries no
  module flag). `cause` is `create` | `update` | `render`, and each machine's `pending` encodes
  its old per-trigger gates exactly. The claims (`effectsApplied`, `resolving`, `judged`, the
  receipt) stay the machines', through the serializer.
- **The withhold registry keeps the protocol's timing and driver.** The resume is a direct
  hand-back through the spine by the client that resolved the offer; the plan's "resumable on the
  roll message" was deliberately not taken (it would move the resume onto the elect and add a
  reload resume; the two-client suite pins neither). The d20fold flag gained `resume.by`.
- **The demand registry sorts the log by timestamp** (concentration already did; saves and
  Topple relied on `contents` order). Ruling 1's precedence is `priority` on the declaration.
- **Emanations §11e can flake** on its own race (the stale template's `createRegion` sweep
  beating the suite's 800 ms sleep); it passed on the rerun of the same code. Not the module's.
- **The first commit chain of Stage 3 committed a syntax error** because a `grep | head` in the
  chain masked the gate's exit code; amended within the minute. Guard chains on `$?`, never on
  a grep.

## The next window: Stage 4a first

**Order:** 4a (maneuvers split) → 4b (mastery split) → 4c (the saves directory, ruling 3) → 5
(who drives, ruling 4). Every stage: `git log` first; the LOCAL sandbox is the box; one
battery-green pass; `tools/verify-settings.mjs` after; docs recut before the next stage; check in
at every break point; no release, no prod.

**Stage 4a — what is measured, not guessed (this window's reads):**

- `maneuvers.js` sections by line at HEAD: PRECISION 161–450 (`rollAttackV2` stamp at 169, the
  `registerRescue("precision")` at 425), RIPOSTE 450–837 (its `createChatMessage` at 496,
  `registerRelay("riposteAnswer")` at 629, `preRollDamageV2` 726, `rollAttackV2` 769), HEW
  837–999 (render 894, create 969), THE BASH OFFER 999–1175 (`rollAttackV2` 1015, the moot at
  1121), SHARED PLUMBING 1175–1367 (render 1179, update 1316, delete 1361 — the rows, popups on
  render, answer watcher, cleanup), COMMANDER'S STRIKE 1367–end (`preUseActivity` 1389,
  `postUseActivity` 1399, the chip 1456, the ride 1485, create 1512, render 1523). Re-measure
  after 3b's lines shifted nothing here (the file is untouched since Stage 1's helper swaps).
- **Exports the tree depends on:** `RULE_TEXT` (line 87 — goes to decide/registry.js beside
  `MASTERY_RULES`), `maneuverEntries`, `foldEntryFor` (116), `equippedShield` (126),
  `usableManeuver`, `meleeOptions`, `preferredMeleeOption` — the five sheet readers go to
  shared.js (their second customer, saves.js, exists: the two lazy sites at saves.js:1154 and
  1295 are the OPEN pin `saves → maneuvers`, which then comes out).
- **The gate rows that name `maneuvers.js`:** seven in `tools/check-hook-order.mjs` CHECKS
  (`renderChatMessage` mastery → maneuvers, maneuvers → saves, maneuvers → d20-folds;
  `rollAttackV2` maneuvers → d20-folds — LOAD-BEARING: precision stamps before the fold composes)
  → re-point at `precision.js` where the row is precision's; one OPEN pin in `check-layers.mjs`
  (`saves.js → maneuvers.js`); `LAYER_OF` gains five files; `EXPECTED_SOURCE_FILES` 48 → 52 (five
  files in, one out). `battleflow.js` imports the five at maneuvers' slot (line 119), in the
  order that keeps the snapshot byte-identical apart from file names: the section order above is
  the registration order today, so precision, riposte, hew, bash-offer, command — but the SHARED
  PLUMBING (rows, popups, answer watcher, cleanup at 1175–1367) registers between the bash offer
  and Commander's Strike; where it lands (one shared file, or each feature's own rows) decides
  three registrations' positions. Measure with the snapshot before choosing.
- **The hook-registrations attribution regex** (`tools/hook-registrations.mjs`,
  `scripts\/([\w.-]+\.js)`) does not match a path with a directory in it. Irrelevant for 4a/4b;
  **4c's `saves/` directory needs it widened** to `scripts\/([\w./-]+\.js)` or every part reads
  as `?` in the snapshot.

**Stage 4b, 4c, 5:** as ruled in PLAN.md's block (rulings 3 and 4 stand; the directory needs the
group rule in `check-layers.mjs` FIRST, then §7's paragraph, then the split; the gate goes to
`reminders.js`; the cast slice moves onto the flow elect and the driver table lands in §3).

## What NOT to do

- Do not release or deploy to prod; do not force-reload the user's prod window.
- Move, do not rewrite: flag shapes, setting keys, list defaults, table keys, rules text, card
  copy unchanged. Ruling 4 is the one behaviour change.
- Do not rename `respondsTo` or unify the envelope bytes.
- No lint cleanup inside a move commit (the 202 baseline stays).
- Do not run a suite while the user is walking the sandbox; disconnect the bridge before a suite.
- Do not commit on a grep's exit code.
