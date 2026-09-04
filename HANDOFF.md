# HANDOFF.md — emanations, the walk continues (written 2026-09-03, late)

> **Temporary by house rule** (BACKLOG's header: a commission is written when there is one and
> retired when it is delivered). This one exists because the user asked for it at a context
> boundary: *"prepare a handoff … I'll test in a new window."* Retire it when the emanations
> walk is done and the docs carry what it found.

## Where things stand

**Emanations shipped to the SANDBOX only** (nothing near prod, which is at v1.28.0). The design,
rulings and measurements are in the permanent docs — read those, not this file, for the *what*:

- [DESIGN.md](DESIGN.md) §4 (the two amended non-goal rows) and §5 *Emanations* (every ruling).
- [ARCHITECTURE.md](ARCHITECTURE.md) §4 (the Region row), §7 (`emanations.js`,
  `decide/emanations.js`), §8 (35 settings), §9 (the Regions row).
- [NOTES.md](NOTES.md) §1 *v14 models an emanation end to end* (the platform facts, each
  measured) and §2 *The 2024 auras*.
- [BACKLOG.md](BACKLOG.md) *Emanations — what the first slice leaves*.

**Last green:** `smoke-emanations` 47/48 on the build before this handoff's last change (the one
red was the old cast-time popup assertion, since replaced); `smoke-saves` 95/95; gate 18 checks,
442 unit tests; settings CLEAN. The last change (the type choice moved into the casting window)
is deployed to the sandbox and gate-green but **its live section has not run yet** — run
`node tools/smoke-emanations.mjs` first thing (user off the box) and expect 48/48.

## What the user is testing in the new window

1. **Paladin's auras** (BF Test Paladin, home (300, 1800)): three rings follow the token; an ally
   walking in gets *Protected / Courageous / Aura of Warding — BF Test Paladin* with the
   Paladin's +3; out lifts them; Incapacitated on the Paladin lifts them; a token icon shows
   while inside.
2. **Spirit Guardians** (BF Test Cleric, home (1700, 1800)): cast → the area places itself on the
   Cleric (no click) → the red-bordered ring; hostiles inside get *Half Speed* with an icon; a
   hostile entering or ending its turn inside gets ONE save card (Wisdom, DC, 3d8 at the cast's
   level); once per turn in combat; concentration ending removes template, region and Half
   Speed. **The damage type**: a fieldset in the casting window, Radiant checked by default
   (Necrotic for an evil alignment), also two buttons on the spell's card to change it.

## The open report — read this before touching code

The user reported, twice, **Paladin aura effects landing on the Cleric at the Spirit Guardians
cast with the Paladin deleted / out of range.** The board, read as the player user at 03:3x,
showed the Paladin's token STANDING at its home (300, 1800), two squares from the Cleric's then
home (100, 1800) — i.e. inside the aura, where *Protected* is correct. The cause was very likely
**`tools/fixture-suite.mjs` re-placing every BF Test token home before each suite run**, which
undid the user's deletion/move under the walk. Two things were done: the Cleric's home moved to
(1700, 1800), far from the Paladin; and this rule: **never run a suite or the fixture step while
the user is walking the box** — the harness refuses two GMs anyway, but the fixture step ran
between the user's sessions and moved the pieces.

⚠ **It is still only "very likely."** If the report recurs with the Paladin genuinely more than
12.5 ft away and no suite having run, it is a real bug. Capture: the Paladin's and Cleric's token
positions, `scene.regions` with their `emanation` flags and `region.tokens`, and the Cleric's
effects' `flags.fvtt-mod-battleflow.emanation.regionId` — the region id on the effect names which
area applied it. The read-only script shape is in this session's scratchpad (`read-player.mjs`:
connect as the player through `playerConfig`, never as a GM, so nothing sweeps).

Also seen on that read: **only ONE of the Paladin's three rings stood** (Protection; Courage and
Warding missing) while the user was walking. The suite re-raised all three on the next run. Not
explained — possibly the user deleted rings by hand (a deleted feature ring is re-raised on the
next sweep, which needs a GM client with current code). Worth one question to the user.

## Facts that bit tonight (all in NOTES §1, listed here so the next session does not re-learn them)

- `game.combat` is the encounter the **combat tracker is viewing**; a stale global encounter
  beat every attempt to make a suite's combat the running one. The user's leftover encounter was
  deleted on their word. A scene-less combat raises no `tokenTurnEnd` for a scene's regions.
- A freshly created region's `tokens` is empty for a beat; "who stood inside at the cast" reads
  the template's geometry, and is written BEFORE the behaviour is created.
- A module Region behaviour subtype must be declared in `module.json` `documentTypes` or the
  server refuses it silently. The floor is serialized per region and the sweep per scene.
- dnd5e 5.3 leaves a placed template standing after `endConcentration`; the module ends its own
  area on the concentration effect's deletion.
- After a deploy the user's GM window runs whatever it loaded — **ask them to F5**; the script
  cache is keyed by version and serves stale for minutes.

## Not done, in order

1. `smoke-emanations` on the last build (48/48 expected), then commit (this handoff's change is
   uncommitted only if that run was not reached — check `git status`).
2. The user's walk in the new window; fix what it finds.
3. **The full battery** (`node tools/battery.mjs`, ~45 min, user off the box) before any release.
4. Release and deploy to prod — on the user's word only.
5. Retire this file into the docs.
