# Handoff — Wild Shape and polymorph (issue #2), for a fresh session

Written 2026-10-10 at the end of the mastery-record session (issue #3). Open the Claude Code session in
`fvtt-mod-battleflow`. Read, in order: this file, `audits/plans/summons-handoff.md` (the relay and the gallery
this issue reuses, and the gate lessons — not repeated here), the issue
(`gh issue view 2 --repo Txpple/fvtt-mod-battleflow --json body -q .body`), `prototypes/wild-shape.html`, and
RULINGS.md *Weapon Mastery — the record* (the long-rest swap machine the known-form swap reuses).

## The rulings already given (2026-10-10)

| Question | Ruling |
| --- | --- |
| A beast shipped by two books | **Monster Manual first**, then PHB, then DMG (the MM blocks are the 2025 revisions) |
| Polymorph on an enemy | **the caster picks the form; the GM can override from the card** before the elect transforms |
| One picker for Wild Shape and the summons' CR-mode picks | **one gallery for both**, parameterised by pool and caps |
| Moon druid's Improved Circle Forms (L6) | **measure before ruling** — read the pack's item on 6.0.6 and bring the finding to the user |

**Still open — Known Forms (Q1).** The user asked for the rule explained before ruling. The explanation given:
2024 Wild Shape knows four Beast forms at level 2; one known form may be replaced after each Long Rest; a use
picks one of the *known* forms, inside the level's pool (CR ¼ / no fly before 8, and so on). dnd5e models none of
it (the chooser is the whole compendium browser). The two shapes offered: **Enforce** (four slots on the Wild
Shape item, the gallery shows only those, an empty slot opens the gallery, the long-rest swap offers one
replacement through the same machine as the mastery swap — RAW) or **Pinned favourites** (four pins over an open
gallery, zero paperwork, not RAW). The recommendation given was Enforce, matching the masteries stance; the user
has not answered. **Ask first thing**, with the prototype open, and also the two prototype toggles not yet ruled
(*how a form is picked*: art cards / compact rows / today's browser; *Known Forms*: enforced / pinned).

What the mastery walk showed about the user's taste, which applies here: they want **a confirmation popup with OK
after a change** (what you now have, what changed), a **"you have these" list before any choice** (a bare
dropdown confused them), **an over-long or wrong list put right at the Long Rest, not ignored**, and **a way to see
the current list any time** (the mastery record opens off the class feature's own card — the known forms should
open off the Wild Shape item's card the same way).

## The order of work

This issue waits on summons for the relay and the gallery. If the summons session has landed them, use them; if
you are starting first anyway, build the relay and the gallery here exactly as the summons handoff describes
(named, reusable, a pure `decide/` filter with unit tests) so the summons session inherits them.

1. **The pool** — the six books' beasts de-duplicated by name, MM > PHB > DMG; a register tool regenerates the
   table so it never goes stale (the issue's pool table is the target; `tools/scan-corpus-offline.mjs` reads packs
   offline with classic-level from the MCP checkout — the mastery session's advancement dump used the same road).
2. **The gallery** — the shared picker with the Wild Shape rule rows: CR cap from the druid's level (¼ to 5, ½ at
   6, 1 at 8; Moon `floor(druid/3)`), no fly before 8, beast only; Animal Shapes' size band; Polymorph's cap from
   the target (`max(level, cr)`) — the issue's "blank cap" data gap judged from the sheet (DESIGN R1).
3. **Known Forms** — per the ruling above; the long-rest swap through the rest-completed road (`scripts/
   mastery-record.js` `dnd5e.restCompleted` → card → popup → `answerSwap` relay → `registerResumable` landing →
   confirmation popup with OK is the exact shape to copy).
4. **The relay** — the pick and the transform settings on the use's card; the elect calls
   `actor.transformInto(source, settings)` with the system's own `wildshape` / `polymorph` presets (reuse, never
   re-implement). `transformInto` copies ownership, so the player owns the new form.
5. **Ending the form** — the hours on the effect view bar (`appliedClock` shape; half the druid level in hours),
   Polymorph's concentration cascade, a `DROP_TO_ONE` `revert` row (0 HP reverts, excess carries to the original),
   Polymorph's "no temp HP left" ending read from temp HP.
6. **Polymorph on a target** — the save demand machine, then the elect transforms with the caster's pick (GM
   override from the card per the ruling); Animal Shapes transforms every willing target in one pass.
7. **Rows** — a `TRANSFORMS` table (Wild Shape, Circle Forms, Polymorph, Animal Shapes, True Polymorph,
   Shapechange, Boon of Fluid Forms, Shape-Shifter, the five Necklaces, Harkon's Bite); registered in
   `tools/register-shared.mjs` with its RULINGS section; one new kind against the R4 tripwire (`transform`, or the
   summons kind widened) — pin moves in `tools/check-registry.mjs` `KIND_SETS`.

## Measured in the issue, to re-measure on 6.0.6

`transform.mjs` (`canTransform`, the `CompendiumBrowser.selectOne` chooser, the targeted-token transform),
`Actor5e#transformInto` / `revertOriginalForm` (the new world actor, `flags.dnd5e.previousTokenData`, the presets
with Moon's `minimumAC` and `tempFormula`), no duration, no Known Forms (`knownForms` absent from the bundle). The
pool counts in the issue were taken offline against 6.0.5 packs; the 2026-10-10 dump road
(`classic-level` through `../fvtt-mcp-dnd5e/package.json`, copy the pack minus LOCK) regenerates them.
