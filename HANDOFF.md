# HANDOFF — the dnd5e 6.0 pass is DELIVERED and WALKED; the release waits on the user's word

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). The pass's plan (ASSESSMENT.md) is retired into NOTES §2 *The dnd5e 6.0
> pass*; the walk's findings are NOTES §2 §6; this file retires with the release commit.

## ⚠ Read this first (a fresh window)

**State, measured 2026-09-18 (late):** main clean at the walk commit (this file's). The sandbox
(Foundry 14.367 / dnd5e 6.0.1, `local-foundry.mjs status`: world ACTIVE) is byte-identical to
HEAD at **v2.0.0**, settings CLEAN, the BF Test fixtures placed. The full battery ran on the
walk's tree (dist/battery/2026-09-19T01-46-56, 43m45s): 27 of 29 entries green, the two reds
(smoke-metamagic §17, smoke-maneuvers B1b) were the suites' own assertions against retired
behaviour, recut and re-run green (91/91, 57/57), settings CLEAN after. Nothing is tagged,
pushed, released or deployed. Prod is the RESTORED pre-6.0 box (Foundry 14.364 / dnd5e 5.3.3,
Battle Flow v1.42.0) for game day 2026-09-22 — v2.0.0 cannot enable there.

**THE WALK IS DONE (the user, 2026-09-18).** Every item of the pass's list was confirmed at the
table, the two open rulings were made, and nine findings were fixed the same evening, each with
its suite section. The one thing left open is not this module's (below). What happens next is
the release chain, on the user's word.

## What the walk ruled and found (all in the tree; the detail is NOTES §2 §6)

- **The ring: INVISIBLE** (ruling 6). Every region this module raises or adopts is visibility
  LAYER — the Regions layer alone shows it. A standing ring is hidden in place by the next sweep.
- **Null AC is a miss** — agreed as the rule (ruling 4). The applied clock (ruling 1): good. The
  chained roll's summary, the buttons as data, concentration's one ask: good.
- **The findings, fixed:** (1) Careful lists nobody in the casting window — the ask on the card
  asks; a targeted cast's candidates now carry disposition and token id, so the allies tick by
  default. (2) The effect table's `item` discriminator — the Aura of Protection's *Protected* no
  longer fires Protection from Evil and Good's row. (3) The verdict lives in the platform's
  summary row (two lines: name and result, then "vs DC … — saved/failed" right-justified);
  Battle Flow's own line draws only where no row exists. (4) No hover card on a controlled
  token. (5) "On others" is the name panel's last group, not the strip's. (7) `SPENT_AREAS`
  gained the class — Slow, Fear, Confusion, Sleep, Calm Emotions, Faerie Fire — placed and gone;
  ⚠ the Spent Areas list default grew: `verify-settings --fix` on any world carrying the old
  default (done on the sandbox; prod's world settings will need it at the 6.0 deploy). (8) The
  v1.19.0 per-verdict public cards and the merged "gone" card RETIRED (`announceSaveVerdict`,
  the twin-supersede hook, the `verdictLine` flag). (9) Topple's "stays standing" card prints
  the roll's total. Finding (6), Tactical Mind's refund ask, was no issue: the feature was used
  from the sheet, off the fold road.
- **Finding (10) is FX Studio's, not this module's:** Web's picture did not play on the sandbox
  (2026-09-18). Battle Flow holds a cast only for a deferred Careful/Heightened card; FX Studio
  plays an area off `createRegion` on the placing client, and its own 6.0 port (v0.5.0 on the
  sandbox) is at the user's-testing stage. Take it to that repo's session.

## Then the release — on the user's word, in order

1. The version: **v2.0.0** as bumped (the pin moved to a platform major; v1.42.0 is the last
   5.3.x release). A minor is `node tools/bump-version.mjs 1.43.0` if preferred — before the tag.
2. `npm run verify` → the release commit (delete this file in it and say so) → annotated tag →
   push main + tag → `tools/build-release.ps1` → `dist/RELEASE-NOTES.md` (drafted, hand-written,
   never NOTES.md — ⚠ RE-READ IT AGAINST THE WALK: the invisible ring, the summary-row verdict,
   the retired verdict cards, Careful's ask on the card, the spent-area class, the effect-view
   changes are all visible to the table and belong in it) → `gh release create v2.0.0
   --notes-file dist/RELEASE-NOTES.md <zip> module.json`.
3. **Prod only once it is on dnd5e 6.0** (the user's upgrade, the user's timing):
   `deploy-house-module.mjs fvtt-mod-battleflow --check` (an all-identical hash is a HALF-AWAKE
   box — wake it with a molten5e `get-world-info` read, re-check), deploy on the user's word (the
   copy MUST carry the new module.json; nothing was removed from `scripts/` this pass, so the
   WebDAV copy is enough), `--check` every file MATCH, then `node tools/verify-settings.mjs`
   against prod for the grown Spent Areas default, `disconnect-bridge` on molten5e. The
   PROCESS restart that vends the version string is the user's via the Molten panel. ⚠ Do NOT
   copy prod → sandbox while prod is still 5.3.3.

## Hazards (still true)

- The harness's `Bash` background cap is 10 minutes — the battery runs in the background with
  its stdout redirected to a file under `dist/`; read that.
- `verify-settings` drifts after any crashed suite; `--fix` restores. Run it after every run.
- The suite harness refuses to run while a second GM-capable client is connected (the user's
  own window counts): `disconnect-bridge` on local5e, and the user logs out, before any suite.
- ⚠ If a suite reports an AC, a save, a corpse or a token square that cannot be, run
  `node tools/scrub-fixture-residue.mjs` and `node tools/fixture-suite.mjs` first. smoke-saves
  deletes the Victim/Shielder tokens by design; the fixture Victim's TOKEN is named "Hobgoblin".
- `Scene#templates` is deprecated at Foundry 14 — never read it; a drawn template is a Region with
  `flags.core.MeasuredTemplate`. An emanation region's shape is `emanationShapeData`.
- Core carries `hidden` over on a per-message re-render: a card once summarized stays hidden
  until the log renders afresh (toggle *Chat Card Summary*, then reload).
- A feature aura stands ONLY on the ACTIVE scene (the 2026-09-04 rule) — a viewed scene that is
  not active shows nothing, by design; activate it.
