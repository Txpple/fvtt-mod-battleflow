# HANDOFF.md — after the Monster Manual (2026-09-28, late night)

> **What this is:** the pick-up point for a session that starts cold, written at the user's word
> (*"prepare for a handoff new session"*). It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask about the walks or the release.**

## State

- **Prod is v2.6.0** (the refactor). Main is pushed, the tree clean, world settings CLEAN (verify after any run).
- **UNRELEASED on main since v2.6.0**, in order: the review fix pass (c941553); the spells slice end to end
  (Tiers 1–4, `audits/spells-register.md`); the DMG register (the DMG RULED OUT); Slice B — the GM's side
  (three stages, RULINGS *The GM's side — the five shapes* and its two sequels); **the Monster Manual register and its waiting rows BUILT**
  (2026-09-28 night: RULINGS *The Monster Manual register* and *The Monster Manual — the waiting rows built*,
  six stages in seven commits from 18b52b8 to 21735fc — 39 rows on existing machines, one new table `DRAINS`
  and its machine `drains.js`, the suite `tools/smoke-monsters.mjs` with fifteen sections).
- **The Monster Manual is a wrap, but for the walk.** [audits/monsters-register.md](audits/monsters-register.md):
  680 rows — 439 NATIVE · 90 MODULE · 25 OUT · 114 TEXT · **12 WAITS, every one a kind held by ruling** (the
  cast-triggered reaction ×8, Redirect Attack, Burst of Ingenuity, Portent, Eye Rays — RULINGS *The GM's side —
  the reaction rows*). Nothing else in the book is owed.
- **UNWALKED, by the user's mode** (rapid deployment: build, prove with the suites, push; every walk deferred to
  be walked together later): the spells slice's four tiers (`tools/content/place-spells-walk.mjs`), Slice B's three
  walk tables, and the Monster Manual's (RULINGS *The Monster Manual — the waiting rows built* → *The walk table*).
- **The proof of the MM pass:** the eleven touched suites ran as a partial battery on the sandbox
  (`node tools/battery.mjs smoke-monsters smoke-spells smoke-wards smoke-clock smoke-shields smoke-rest smoke-drop
  smoke-emanations smoke-reminders smoke-goliath smoke-riders --snapshot`) — green at the push. The FULL battery is
  the release floor and has not run since v2.6.0.

## Next — the user's call, in this order of likelihood

1. **The release** (the user's word): `--local` deploy, the full battery (`node tools/battery.mjs --snapshot`,
   launched DETACHED — `Start-Process`), `node tools/verify-settings.mjs` (`--fix` on drift), `npm run verify`,
   `node tools/bump-version.mjs minor`, the release commit, an ANNOTATED tag pushed — CI builds and publishes
   (`.github/workflows/release.yml`; dry run `node tools/build-release.mjs --tag vX.Y.Z`). Prod is never touched by
   hand; the deploy is the MCP repo's `deploy-house-module.mjs` (`--check` first; an all-identical hash is a
   half-awake box). The chain: tools/README *Release and deploy*. The release notes are a page — the spells slice,
   the GM's side, the Monster Manual's rows, the register tools; the DRAINS table is the one new machine.
2. **The walks**, when the mode changes back: the spells tiers, then Slice B's tables, then the Monster Manual's.
3. **Session 0 — the classes** ([audits/drawings/classes.md](audits/drawings/classes.md)): the party's kit one band
   ahead; the shapes with three or more customers are tables; UI-shaped items ruled off a prototype first.

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
