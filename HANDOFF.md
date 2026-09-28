# HANDOFF.md — the spells slice (commission, 2026-09-28)

> **What this is:** the commission every session works from until it is delivered, written for a
> session that starts cold. It is retired when the spells slice is released, and its record is git
> history. The order after it is set (BACKLOG *The long-term order*): **Slice B, then session 0 of the
> next campaign sets the class slices.** Nothing starts until the user says go; a handoff is not a go.

## State (2026-09-28, evening)

**All three tiers are BUILT, their suites green, pushed, UNWALKED and UNRELEASED.** RULINGS *The spells
slice — Tiers 1 and 2* and *The spells slice — Tier 3* are the record (what measured native, the rows, the
kinds, the walk tables — one per tier). Tier 3 was ruled off `prototypes/spells-slice.html` ("all drawn
as, go") and carries two corrections to §Tier 3 below: the area's trigger is turn END (2024), and Mirror
Image is a d6 per duplicate (2024). The walk tool is `tools/content/place-spells-walk.mjs`.

**The walk is DEFERRED by the user (2026-09-28): all three tiers wait to be walked together** — the
tables to walk are RULINGS *The walk — Tier 1*, *The walk — Tier 2*, *The walk — Tier 3*. Development
goes on to **the DMG in a separate session** (the user's call; the DMG drawing says "a register, not a
slice" — that session decides what that means). The release (a full battery, the tag) waits for the walk.

**No PHB spell of the drawing is left unbuilt except the held ones** (§Held below): Counterspell (session
0), Warding Bond, Vampiric Touch, Prismatic Spray, Magic Circle, Forcecage, plus Tier 3's two — Wall of Fire
(no area in its data) and Spike Growth (movement). Unbreakable Majesty (a class feature, not a spell) is the
duplicates' seam with a save for the die — session 0's, with its Bard.

## Where this comes from

The 2024 corpus was measured on 2026-09-28 and drawn, book by book, in [audits/](audits/README.md):
the evidence per kind (regenerated, never edited) and the verdicts by hand in
[audits/drawings/](audits/drawings/). **The spells drawing is
[audits/drawings/spells.md](audits/drawings/spells.md)** — read it first; this file is its
commission. The classes, DMG and Monster Manual drawings are the map for what follows.

## The rulings (the user, 2026-09-28)

- **The order: spells, then Slice B, then session 0.** Player-facing first (DESIGN N3); B is small
  and party-independent; the class slices wait for the party.
- **A repeated save that succeeds ends the effect automatically** — the rule leaves no choice, so the
  machine acts (DESIGN R1) — **with a visible cue: the effect's name floats off the token** as it
  leaves (the scrolling text `use-chips.js` and `fighting-styles.js` already draw, `−(name)`), and
  the card records the end.
- **All three UI-shaped items are in this slice**, each ruled off a prototype before a line: the
  placed area that pulses, Sanctuary's gate, Mirror Image's defender interrupt.
- **The DMG is a register, not a slice** (its drawing); **Relentless is not in the 2025 Monster
  Manual** — Slice B's monster customer for the kill moment is Undead Fortitude.

## Ground rules

- PHB spells only ([[examples-are-classes]]: the class is every PHB spell, never the example).
  Arcana Unleashed's 33 stay out with the splat books.
- Every row names its precedent before it is written ([[land-by-mechanism-not-family]]); a bend
  forced by the platform goes in RULINGS *Where the table bends the rule* in the same commit.
- A change runs its own suites: `node tools/battery.mjs --changed --list`, then `--changed`
  (`--local` deploy first — a battery tests the deployed copy). The full battery is the release
  floor only. After any run, `node tools/verify-settings.mjs` against the reference table.
- Prod is never touched by this work; a release goes out only on the user's word, by a pushed
  annotated tag (CI builds the zip).
- `npm run verify` green on every commit; `biome --write` on named files only.

## Tier 1 — the rows (no UI, cost 1 each)

| Spell | Row → where | Precedent |
| --- | --- | --- |
| **Protection from Poison** | `EFFECT_BENDS` `saves` `{bend: advantage, statuses: [poisoned]}` | Dwarven Resilience (SWEEP §6) |
| **Haste** | `EFFECT_BENDS` `saves` Dex Advantage; the AC and the action are the pack's | Danger Sense's shape |
| **Beacon of Hope** | `EFFECT_BENDS` `saves` Advantage on Wis and death saves + the healing machine's `max` facet (healing dice at maximum) | `HEAL_REROLLS` (Healer), one table |
| **Otto's Irresistible Dance** | `EFFECT_BENDS` attacks Disadvantage + `saves` Dex Disadvantage; its save is an action → a `REPEAT_SAVES` row `onAction` (Tier 2) | Slice A's `saves` facet |
| **Command** | `SAVE_PRESSES` Grovel → Prone, with an `EFFECT_CHOICES`-shaped ask (Approach / Flee / Grovel / Halt) | Web's press; Fire Shield's ask |
| **Sorcerous Burst** | an exploding die (a max face rolls another, up to the modifier), automatic | `DAMAGE_EITHER`'s machine, popup-less |
| **Heroism** | measure first: temp HP at the bearer's turn start — the turn-start `grant` facet on `CLOCK_RIDERS` if the pack does not roll it | the classes drawing's grant shape (Survivor, Elder Champion) |
| **Synaptic Static** | measure first: NATIVE if the pack's effect writes a `-1d6` bonus; else `EFFECT_BENDS` with a `fold` | Bane's shape |

Each row: the registry entry, a unit test in `tests/decide-registry.test.js`, a section in the
matching `tools/smoke-*.mjs` (`smoke-saves`, `smoke-effects`, `smoke-cast`), and a rule pointer
by identifier (the rule fold reads the book).

## Tier 2 — the kind: `REPEAT_SAVES`

**The customer is Hold Person.** Twenty-odd PHB spells land an effect and say *"at the end of each of
its turns, the target repeats the save, ending the effect on a success"*; some repeat *when it takes
damage*; Flesh to Stone counts failures. Nothing in the code repeats a save (measured 2026-09-28).

- **The table:** `REPEAT_SAVES` in `decide/registry.js`, keyed by the effect's name (effects carry
  no identifier — BACKLOG *Phase 2's residue*), each row `on: "turnEnd" | "damaged" | "onAction"`,
  the save the ITEM's own activity (never a DC or an ability copied), `ends: true`.
- **The machine:** a new `repeat-saves.js` under scripts/. The precedent is the emanation's `trigger on "turnEnd"`
  (`EMANATIONS`, `emanations.js`): at the bearer's turn end (the clock the module already reads), a
  demand is raised through the saves machine (`saves/demand.js`) against the effect's origin
  activity; the verdict's success removes the effect through the receipt; the failure leaves it. The
  `damaged` trigger sits on the damage-landed seam the concentration check uses.
- **The cue:** on the success the effect's name floats off the token (the scrolling-text helper the
  use chips and the fighting styles share — lift it into `ui.js` if a third caller wants it) and the
  card says *"X ended: the save succeeded"*.
- **Rows at cost 1:** Hold Person, Hold Monster, Tasha's Hideous Laughter (turnEnd + damaged),
  Blindness/Deafness, Crown of Madness, Slow, Fear (its "no line of sight" clause is the GM's),
  Confusion, Phantasmal Killer (the damage rides the failed save — the activity's), Eyebite,
  Contagion, Dominate Beast / Person / Monster (damaged). Slow, Fear and Confusion are already
  `SPENT_AREAS` / `CHOSEN_AREAS` rows: the repeat is a second row on the same spell.
- **Waits for a customer:** Flesh to Stone's counter (`count: 3`).
- **Proof:** a new `decide-repeat-saves.test.js` under tests/ (the pure arithmetic), a new `smoke-repeat-saves`
  suite (Hold Person on a fixture: the demand at turn end, the success removes, the failure keeps,
  the floating text called, the card line), and `probe-*` only if the clock seam surprises.

## Tier 3 — the three prototypes (each ruled by the user before a line)

> **BUILT 2026-09-28** — RULINGS *The spells slice — Tier 3*. ⚠ The table below is the COMMISSION as
> written; the build corrected it in two places off the 2024 text: the area's trigger is enter / turn
> END / the area moved (never turn start), and Mirror Image rolls a d6 per duplicate, any 3+ redirecting
> (never a d20 against 6/8/11). Wall of Fire and Spike Growth are held; Flaming Sphere is a feature ring
> around its summoned token.

Build the three as one clickable page, `spells-slice.html` under prototypes/, in the house look
([[ui-prototype-first]]; [[offer-row-no-extra-text]] — a tick row is name + dice, then "the rule ▸").

| Item | Shape to prototype | Precedent |
| --- | --- | --- |
| **The placed area that pulses** (Moonbeam, Cloud of Daggers, Wall of Fire, Cloudkill, Insect Plague, Flaming Sphere) | `EMANATIONS` kind `"area"`: the system's template NOT attached to the caster, the same region, `trigger on: "enter" / "turnStart"`; the save the activity's; the card at each pulse. Movement-triggered damage (Spike Growth) stays out (DESIGN §4) | the `spell` emanation kind; NOTES *v14 models an emanation end to end* |
| **Sanctuary** | the gate before the roll: a hostile aiming at the warded creature is demanded the Wis save first; a fail cancels the attack (the card says so); the effect ends on the bearer's own attack | the gate's buy box (`ADVANTAGE_BUYS`, `gate.js`); Unbreakable Majesty is the second customer |
| **Mirror Image** | an automatic interrupt on the DEFENDER after the verdict: a d20 against the image count (6 / 8 / 11); a hit redirected to an image, one fewer image; a card line, no popup | `INTERRUPT_ROLLS`'s seam with no Reaction cost; a counter on the effect |

## Held — not this slice (each with its trigger)

Counterspell (the cast-triggered hold: a Wizard or Sorcerer at session 0 — it also serves seven
Monster Manual reactions and three DMG items), Warding Bond, Vampiric Touch, Prismatic Spray,
Flesh to Stone's counter, Magic Circle and Forcecage (a region's ban — movement, DESIGN §4).

## The walk, the floor, the release

1. Each tier lands with its own suites green and `npm run verify` green.
2. **The walk:** the user walks it by hand on the sandbox, spell by spell, with a *Spell | What you
   should see* table per tier ([[species-walk-table]]'s shape); `tools/content/` gets a
   `place-spells-walk.mjs` that puts a caster with the slice's spells and two targets on the walk
   scene (the PHB feats' walk tools are the pattern).
3. The full battery is the release floor; a red row is read, never re-run blind.
4. Release only on the user's word: bump, an annotated tag, push; CI publishes. Then the docs recut:
   RULINGS gets the slice's section, SWEEP §7 and BACKLOG are updated, this file is retired.

## After this — the next two, already drawn

- **Slice B** ([audits/drawings/monsters.md](audits/drawings/monsters.md)): Undead Fortitude and
  Death Throes on `DROP_TO_ONE` (a `save` facet, a `died` trigger); Legendary Resistance on
  `SAVE_SUCCEEDS` from the `legres` pool; Magic Resistance and its greater form on a `vsSpells`
  save facet (nine customers across three books); Regeneration on the turn-start grant; the eight
  harmful aura rows; the reaction rows on lists that exist.
- **Session 0** ([audits/drawings/classes.md](audits/drawings/classes.md)): the party's classes one
  level band ahead of play; the reroll kind with its first customer; the prototypes (Brutal Strike's
  gate box, Portent, Wild Magic Surge, Inspiring Smite) ruled when that player sits down.
