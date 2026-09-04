# HANDOFF.md — emanations, the walk continues (written 2026-09-03, late; recut 2026-09-04)

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

**Last green (2026-09-04, the build deployed on the sandbox = the working tree):**
`smoke-emanations` 54/54 (§11, the active-scene rule, included); 445 unit tests; the full
battery — see the session's last message for its tally. The user's GM window must be **reloaded
(F5)** to run it.

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

## The open report — RESOLVED 2026-09-04 (a real bug, and a big one)

**Cause:** a member effect lives on the ACTOR, a linked actor is one document on every scene,
and the Cleric's Test Range token stood inside the Paladin's rings while the user cast on Party
Camp. Then, in the campaign: Thomas gaining Aura of Protection raised a ring on all 22 scenes he
had a token on and gave Morgash the effect seventeen times over. **The rule now** (DESIGN §5): an
emanation exists on the active scene only; a scene going inactive brings its areas down and
lifts their effects from every actor holding one. The ready sweep, the active-scene switch and
the setting change all sweep every scene that carries an emanation. `smoke-emanations` §11
proves it. The original record follows for the trail.

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
- **The battery's reds of 2026-09-04 were all fixture hygiene, none the module** (four runs to
  prove it): BF Test PC Attacker's **Longsword** — the fixture's own clone of the NPC's blade,
  which ships NO mastery — had been given one (a walk's setting, most likely), and
  `smoke-effects` / `smoke-expiry` find their blade by shape, first match: a d8 blade drops
  the 11-HP Victim to 0 mid-section and every payout on a downed target is skipped, a different
  check each run. Every green run had used the Dagger of Venom. ⚠ It was first deleted as a
  stray — which broke `smoke-battleflow`'s mode gate, which presses that item by name on both
  sides. The fixture step now re-clones the blade when missing and strips any mastery it wears. `smoke-effects` §2 now sets its own mastery (it swung
  §1's leftover, and `smoke-nogm` leaves the blade on Sap). `smoke-sneak` 3b expected the
  "Save DC" wording the offer header dropped on 2026-09-03. `smoke-emanations` needs the
  Victim token that `smoke-effects` sweeps off — the battery has a fixture step before it now,
  as it had before `smoke-nogm`. **An early fatal in a suite runs no teardown**: the emanations
  suite's activation now comes after its fixture checks.
- **`smoke-nogm` logs one player-page error** — "Cannot read properties of null (reading
  'id')" — during the player's own swing with no GM, and passes 19/19 regardless. A probe (a
  player alone, a GM joining and leaving) raised nothing, and the module has no unguarded id
  read on a nullable global. Unexplained; not chased in this window.

## Not done, in order

1. The user's walk continues on the deployed build (Spirit Guardians on Party Camp read right
   once the Test Range tokens were cleared; the active-scene rule is what they are testing now).
2. Release and deploy to prod — on the user's word only.
3. Retire this file into the docs.

Ruled 2026-09-04: **the fixture actors stay linked** ("leave them") — they match the campaign's
own characters, which is the case that bit, and `smoke-emanations` §11 tests a linked ally on
two scenes.
