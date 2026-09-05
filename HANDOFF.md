# HANDOFF.md — the machine-tier pass, ruled and awaiting the go (written 2026-09-05)

> **Temporary by house rule** (BACKLOG's header: a commission is written when there is one and
> retired when it is delivered). This one exists because the user asked for it at a context
> boundary: *"write it down and I'll review in a new session, so give a handoff too."* Retire it
> when the pass is delivered (docs recut, PLAN.md's block gains its *HOW IT WENT*) or declined
> (the block marked so). Delete this file in that same commit.

## Where things stand

- **Tree:** HEAD `84e00ac` = **v1.32.1**. The working tree was clean when the review session
  began. That session added **two documents and nothing else**: this file, and the block
  *THE MACHINE-TIER PASS* at the top of [PLAN.md](PLAN.md). **No code changed. Nothing was
  deployed. No world was touched** — the review ran the static gate and read every file under
  `scripts/`; it never connected to the sandbox or to prod.
- **Prod:** v1.32.1, unchanged by this session. A prod process restart stays the user's.
- **Gate at HEAD:** `npm run verify` green — 23 static checks, 503 unit tests in 0.6 s,
  8 pinned layer edges (4 OPEN under D9), no unpinned edge. `npm run layers` printed 46 files
  and 245 internal edges.
- **Owed:** nothing. BACKLOG's pick-up order is empty. This pass is **ruled but not started**:
  the user ruled decisions 1–5 in the review session (ruling 3 overturned from the
  recommendation — see below) and asked to review the written plan in a new session before
  the go.
- **Uncommitted:** both documents were written to the working tree and **not committed**, on
  the standing rule that a commit is the user's call. `git status` will show them.

## What the review session did

1. A full architectural review of `scripts/` — every one of the 46 files read in full, the
   measurements taken by tool (line counts, duplication greps, churn since 2026-08-23, the
   gate's own prints). **Score 7/10.** The pure decision layer, the registries, the spine and
   the services score about 8.5 on their own; the machine tier about 6. The findings, the
   numbers and the six-stage plan are in **PLAN.md → *THE MACHINE-TIER PASS***. Read that block
   for the substance; this file is only the state and the procedure.
2. Wrote the pass. Behaviour-neutral by construction except ruling 4 (the cast slice with no
   GM), which is written down. The user ruled all five decisions in the same session; the
   rulings are in the block's last table and repeated below.

## What the user is doing in the new session

Reading the plan block, confirming or amending the five rulings recorded there, and then giving
**the go for Stage 0**. A handoff is not a go (the standing procedure — the session-cycle rule).
If a ruling changes, change it in PLAN.md's decisions table first, then start.

## The five decisions — RULED 2026-09-05

| # | Decision | Ruling |
| --- | --- | --- |
| 1 | Bare-roll precedence in the demand registry (Stage 2) | **Keep the ship order** — concentration, then saves, then Topple — as an explicit `priority` on each spec. Byte-identical; oldest-pending-first stays one field away |
| 2 | Dissolve the two-way saves ↔ d20-folds cycle now, or on a third withholding moment | **Now** (Stage 3b, the withhold registry). The sweep is the third customer; the two OPEN pins come out |
| 3 | The saves cut: the light cut, or a machine directory | **The directory** — `scripts/saves/`, one part per spine step, `index.js` the only face, a group rule in the layer checker, §7 amended. The review recommended the light cut; the user overturned it for the long-term shape (*"I'd rather do the longer term one"*). The full design and its exact cost are under Stage 4c. The gate still moves to `reminders.js` |
| 4 | The cast slice with no GM | **Flow elect** — apply what the caster's client may, whisper the rest (the auto-apply shape). Riposte stamp, Hew, Commander's Strike, stats, emanations stay GM-only and the driver table says why |
| 5 | Scope | **The full pass**, about 9½ sessions, in the ruled order |

## On the go — order and procedure

- **Order:** Stage 0 → 1 → 2 → 3 → 3b → 4a → 4b → 4c → 5. Stage 2 before Stage 4 on
  purpose: the Topple fold's cross-machine reads go through the registry, and the split is
  cleaner after. Stage 3b after Stage 3: the return half of the withhold is a resumable. Docs
  recut at the end of every stage, not at the end of the pass.
- **Every session:** check `git log` first (parallel sessions collide); the LOCAL sandbox is
  the test box; one battery-green pass; restore the world settings to the reference table in
  `tools/verify-settings.mjs` after any run; check in at every break point; no release and no
  prod deploy inside this pass — both stay on the user's word.
- **Every commit:** `npm run verify`; the hook-order diff (Stage 0's snapshot) byte-identical or
  the difference explained in the commit; the touched machine's own suite.
- **Autonomy:** Stages 1, 3, 4a and 4b are mechanical enough for an autonomous overnight run
  with the battery as the judge. Stages 2, 3b, 4c and 5 carry rulings or a doctrine change and
  want the user present.

## Facts the next session should not re-derive

- The **bare-roll recognizer lives in three files** — `concAskAnsweredBy` (concentration.js),
  `saveAnsweredBy` (saves.js), `foldToppleSave` (mastery.js) — and d20-folds.js reads the saves
  flag in `pendingSaveDemandFor`. The precedence concentration → saves → Topple is **ship
  order**; the comments call it an accident ("shipped first"), not a ruling. Ruling 1 keeps it.
- `emanations.js` `maybeTrigger` **writes a complete `saves` flag by hand** — a second writer
  of that shape with no shared constructor. The `saves` flag is read or written in **six files**:
  saves, mastery, d20-folds, hit-menu, sneak, emanations.
- `respondsTo` carries **five meanings**: a hold answer, a save roll, a concentration roll, the
  precision die's message, a d20 fold's die message. Every recognizer checks whose card it
  points at. The bytes must not change (an answer in flight across a deploy would stop folding).
- **List-setting defaults derive from table KEYS** (or `feature` fields — two conventions).
  Renaming a table key changes what a world's saved setting validates against. Stage 1 unifies
  the *access* to the tables and must not rename a key.
- **Adding or removing a static import moves hook registration order** (ARCHITECTURE §7, both
  directions measured). Stage 0's snapshot exists so every later move is provable by a command.
  **In the saves directory, `index.js`'s import list is the second such place** and its comment
  must say so.
- `tools/check-hook-order.mjs` `CHECKS` names files (`maneuvers.js`, `mastery.js`, `saves.js`).
  A split must re-point those rows in the same commit as the split (saves' rows → `saves/views.js`
  for the render row, `saves/verdict.js` where a create-hook order is pinned), and `LAYER_OF` in
  `check-layers.mjs` plus `EXPECTED_SOURCE_FILES` in `check-registry.mjs` move with every new
  file — the gate fails otherwise, which is the point. The directory needs the **group rule** in
  `check-layers.mjs` first: parts of one group may import each other; from outside, only the
  group's `index.js`.
- **The saves directory never imports the gate.** The buzzer's auto-fail check
  (`fireSaveTimer`) needs only `saveSources` over the condition table, which is `decide/`; the
  dialog's Fails handshake rides `bfSaveDemand.failed` on the DialogCarried, a contract ui.js
  already documents, and the gate hook in `reminders.js` writes it exactly as `drawSaveGate` does
  today. `renderRollConfigurationDialog` order between the demand fieldset (saves) and the gate
  fieldset (reminders) does not matter: both anchor on the dialog's CONFIGURATION part, not on
  each other. Check it with the snapshot anyway.
- The shared sheet readers a maneuvers split needs (`foldEntryFor`, `equippedShield`,
  `usableManeuver`, `meleeOptions`, `preferredMeleeOption`) already have a **second customer**:
  saves.js imports two of them today (the OPEN pin saves → maneuvers). shared.js is their home
  by the house rule; `RULE_TEXT` goes to decide/registry.js beside `MASTERY_RULES`, the exact
  precedent (2026-09-01). Stage 4a must land before 4c, or the saves directory imports a machine.
- The damage-shields flake of 2026-09-05 was the **newest copy of the resume-floor idiom**
  judging world state without a claim on the card. Stage 3's primitive is the general fix; the
  shields suite is the one to run three times after it.
- Biome baseline **203 warnings** (unused parameters 56, iterable callback returns 49, template
  literals 33, unused variables 33, the rest small). Not part of this pass; do not "clean up"
  inside a move commit — it hides the move in the diff.
- Not split, on purpose: **hold.js** (one flag; its views were moved into it by D6) and
  **d20-folds.js** (one flag; the armed-fold block shares `availableFolds`). hold.js is the ready
  **second customer** for the directory rule if it grows; not this pass.

## What NOT to do

- Do not start building before the go.
- Do not touch prod, and do not force-reload the user's prod window.
- In any stage: do not change flag shapes, setting keys, list defaults, table keys, rules text
  or card copy. Move, do not rewrite. Ruling 4 is the one behaviour change.
- Do not rename `respondsTo` or unify the envelope bytes; unify the *reader*.
- Do not add a new flag key for the save choices; the directory keeps them on `saves`.
- Do not run a suite or the fixture step while the user is walking the sandbox.
