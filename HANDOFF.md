# HANDOFF.md — after the v2.7.0 release (2026-09-28, late night)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask about the walks.**

## State

- **v2.7.0 is RELEASED on GitHub** (1df8668, tag v2.7.0, published by CI 2026-09-28 late night): the review fix pass,
  the spells slice, Slice B (the GM's side), the Monster Manual's waiting rows. The floor: the FULL battery 46/46 green
  (86 min, `dist/battery/2026-09-29T02-22-07`), settings CLEAN after it, verify green, the dry run equal to the tree.
- **Prod is still v2.6.0 — NOT deployed, by the user's word ("we'll do that later").** The deploy is the MCP repo's
  `deploy-house-module.mjs` (`--check` first; an all-identical hash is a half-awake box), then `--check` again,
  `disconnect-bridge` on molten5e, the PROCESS restart the user's, `BF_TARGET=prod node tools/verify-settings.mjs`.
  Check for deleted files since v2.6.0 (`git diff --name-status --diff-filter=D v2.6.0..v2.7.0 -- scripts styles lang templates`):
  WebDAV never prunes.
- **Session 0 — the classes — is being PLANNED in a separate session** (started 2026-09-28 night, its own worktree
  branch, docs and prototypes only, no module code): the deliverable is `audits/plans/session-0-classes.md` on that
  branch. The user rules its questions off the plan and its prototypes; nothing is built until they say go.
- **UNWALKED, by the user's mode** (rapid deployment): the spells slice's four tiers (`tools/content/place-spells-walk.mjs`),
  Slice B's three walk tables, the Monster Manual's (RULINGS *The Monster Manual — the waiting rows built* → *The walk table*).

## Next — the user's call

1. **The prod deploy of v2.7.0**, when the user says so (the steps above; tools/README *Release and deploy* step 6–7).
2. **Session 0**: read the plan branch, the user rules, merge the plan, build stage by stage.
3. **The walks**, when the mode changes back.

## The box (the local sandbox, Foundry 14 / dnd5e 6.0.5) — what this pass learned

- **BF Test Monster** (`tools/fixture-suite.mjs`) is lent traits by name from `dnd-monster-manual.features`;
  `smoke-monsters` places the Victim's own token beside it and takes everything back.
- ⚠ The suites' pinned d20 (every roll a 5) makes a d8 a 2 and a d10 a 3 — assert a drop equals the total, never a
  face. ⚠ A stray token sits inside the range's rings — "nobody inside" is never true on the shared range.
- ⚠ The tray's copy of an effect takes its own id — find the module's copy by its FLAG (`drain`), never by `_id`.
  ⚠ dnd5e's maximum with a `tempmax` effect is `hp.effectiveMax`, not `hp.max`. ⚠ `featureNamed` reads feats
  only — a pack "trait" may be a WEAPON (Chaos Blade, Object Slam): `itemNamed` for those.
- ⚠ The attack gate's reminder record exists only on the DIALOG path (`rollAttack` with a button event);
  `configure: false` writes none — read the dialog's `[data-bf-reminder]` text, as smoke-reminders does.
- ⚠ **Another open session's local5e MCP bridge ("DM Assistant") blocks every suite's preflight.** Find it with
  `list_sessions`, `send_message` it to call `disconnect-bridge`, then retry with a sleep; this session's own
  bridge is logged out after any read of the box.
- ⚠ Never chain `git commit` after a `grep` pipeline — the pipeline's status is grep's; gate on `npm run verify`'s
  exit code. Heredocs mangle backslashes and `"\n"` — edit scripts go in a file, and a `python` heredoc is not safe
  for a string that carries an escape either (the Edit tool is).
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in
  the same commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`
  and a new writing file pinned in `tools/moment-writers.mjs`; a new file bumps `tools/check-registry.mjs`'s
  source-file pin (122 now) and joins `tools/check-layers.mjs`, `scripts/dispatch.js` and `scripts/battleflow.js`.
- A change runs its own suites (`node tools/battery.mjs --changed --list`, then the feature's own — a FULL
  verdict for a feature still means its own suites); deploy `--local` first; launch detached; after a kill:
  `verify-settings --fix`, `reset-fixture-state`, `fixture-suite`.
- `npm run verify` green on every commit; `biome --write` on named files only.
