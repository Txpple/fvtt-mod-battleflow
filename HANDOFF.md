# HANDOFF — the dnd5e 6.0 pass is DELIVERED on the sandbox; the user's walk is next, then the release

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). The pass's plan (ASSESSMENT.md) is retired into NOTES §2 *The dnd5e 6.0
> pass*; this file retires with the release commit.

## ⚠ Read this first (a fresh window, 2026-09-18)

**State, measured 2026-09-18:** main clean at `7ab123e` (phase 5). The sandbox (Foundry 14.367 /
dnd5e 6.0.1, `local-foundry.mjs status`: world ACTIVE) is byte-identical to HEAD at **v2.0.0**,
settings CLEAN, the BF Test fixtures placed. The full battery is 29 of 29 (2026-09-16). Nothing
is tagged, pushed, released or deployed. Prod is the RESTORED pre-6.0 box (Foundry 14.364 /
dnd5e 5.3.3, Battle Flow v1.42.0) for game day 2026-09-22 — v2.0.0 cannot enable there.

**What happens next is the USER'S WALK on the sandbox** — the live check of the pass with human
eyes, the way every pass ends. A session that picks this up: wait for the user's word; during
the walk, restate the full list after every update (the walk-session rule); a finding is a
fixture first, a fix second, with its suite section in the same commit; `verify-settings` after
any run; `disconnect-bridge` on local5e whenever the user is at the table alone. Before any edit:
`git log --oneline -3`, `local-foundry.mjs status`, `deploy-house-module.mjs fvtt-mod-battleflow
--local --check`, `node tools/verify-settings.mjs`.

## What the walk should look at (the pass's visible changes)

1. **The ring.** Every aura and listed spell's area is a Region drawn by the region itself
   (visibility ALWAYS, highlightMode `shapes`, the reach's hue — a filled hatched disc). The
   platform draws its own 6.0 areas as covered squares. **OPEN RULING:** keep, the platform's
   look (`highlightMode: "coverage"`, one field in emanations.js and the cast placement), or
   hidden. The Paladin on the test range shows it standing.
2. **The chained roll's summary.** A save or check rolled against a usage card is HIDDEN and
   drawn inside the usage card (dnd5e's client setting *Chat Card Summary*, on by default). The
   save gate's record ("Before the roll — Reminded…") and the d20 fold rows draw INSIDE that
   summary now. Cast a save spell, answer through the popup, read the usage card.
3. **The card's buttons.** A usage card carries Refund Resource at most (the buttons are
   filtered from the card's data at birth). A player who wants the native buttons turns
   *Hide Redundant Buttons* off — the hint says so.
4. **The applied clock is the platform's** — an effect with no clock takes the spell's; Vex,
   Sap, the Miasma-class "until the end of ITS next turn" are dnd5e's own pseudo-expiries.
5. **A null AC (total cover) is a MISS**, the platform's verdict — before, the module left it to
   humans.
6. **Concentration:** both of dnd5e 6.0's native prompts are vetoed; Battle Flow's ask is the
   one surface. The private concentration roll is private again.
7. **Everything else should look exactly as it did on 5.3.3** — that is the pass's promise, and
   a difference the user did not choose is a finding.

## Then the release — on the user's word, in order

1. The version: **v2.0.0** as bumped (the pin moved to a platform major; v1.42.0 is the last
   5.3.x release). A minor is `node tools/bump-version.mjs 1.43.0` if preferred — before the tag.
2. `npm run verify` → the release commit (delete this file in it and say so) → annotated tag →
   push main + tag → `tools/build-release.ps1` → `dist/RELEASE-NOTES.md` (drafted, hand-written,
   never NOTES.md — re-read it against the walk's findings) → `gh release create v2.0.0
   --notes-file dist/RELEASE-NOTES.md <zip> module.json`.
3. **Prod only once it is on dnd5e 6.0** (the user's upgrade, the user's timing):
   `deploy-house-module.mjs fvtt-mod-battleflow --check` (an all-identical hash is a HALF-AWAKE
   box — wake it with a molten5e `get-world-info` read, re-check), deploy on the user's word (the
   copy MUST carry the new module.json; nothing was removed from `scripts/` this pass, so the
   WebDAV copy is enough), `--check` every file MATCH, `disconnect-bridge` on molten5e. The
   PROCESS restart that vends the version string is the user's via the Molten panel. ⚠ Do NOT
   copy prod → sandbox while prod is still 5.3.3.

## Hazards (still true)

- The harness's `Bash` background cap is 10 minutes — the battery runs in the background with
  its stdout redirected to a file under `dist/`; read that.
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.
- ⚠ If a suite reports an AC, a save, a corpse or a token square that cannot be, run
  `node tools/scrub-fixture-residue.mjs` and `node tools/fixture-suite.mjs` first. smoke-saves
  deletes the Victim/Shielder tokens by design; the fixture Victim's TOKEN is named "Hobgoblin".
- `Scene#templates` is deprecated at Foundry 14 — never read it; a drawn template is a Region with
  `flags.core.MeasuredTemplate`. An emanation region's shape is `emanationShapeData`.
- Core carries `hidden` over on a per-message re-render: a card once summarized stays hidden
  until the log renders afresh (toggle *Chat Card Summary*, then reload).
