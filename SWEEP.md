# The abilities sweep — survey

**Status: SHELVED (2026-09-03, user call: "a longer term project"). Surveyed, its three
questions ruled, nothing scheduled or owed.** A fifth document by design, for the length of the
sweep: it holds the survey behind a planned pass over every racial trait, class feature,
subclass feature, feat and spell that would qualify for Battle Flow, in that order. When the
sweep is scoped, what it settles moves into DESIGN §8 / BACKLOG and this file goes.

## 0. Picking it up later — read this first

Everything a future session needs to start the sweep without re-deriving it:

1. **The rulings are made (§5, 2026-09-03).** Ignore the 2014 packs. The hit menu is ONE popup
   per hit, rows grouped by the feature or class that grants them. Save-side bends read ONE
   shared Effect Sources list with the attack gate, never a second list. Do not re-ask.
2. **Smites are OUT of the hit menu** (user, 2026-09-03): in 2024 Divine Smite and the smite
   spells are a separate Bonus Action cast after the hit, not a rider on it — the module does
   not cover them. Item 2 below is Barbarian, Monk and Battle Master.
3. **The order is §4.** Start with item 1 (save-side bends): one table, thirty rows, every
   kind touched on day one, so the kind-by-kind walk has something to read against. **Item 2's
   MACHINE EXISTS (2026-09-04):** the hit menu shipped off its prototype with the Battle Master's
   eight on-hit maneuvers as its first group (`hit-menu.js`, `HIT_GROUPS` / `HIT_OPTIONS`, DESIGN
   §5 *The hit menu*). **The Battle Master is COMPLETE (2026-09-05): all nineteen maneuvers land on a machine** — the eight on-hit
   ones on the hit menu, the nine others on the seats BACKLOG named (Parry an interrupt that reduces,
   four Bonus Action uses in `superiority-uses.js`, two scoped d20 folds, Commander's Strike the
   `command` fold kind, Rally native). What item 2 still holds is the OTHER groups — Brutal Strike, Stunning
   Strike, Open Hand Technique, Psionic Strike — each a group row (its pool and pick limit) and
   option rows on the same table; a new COST KIND (a Focus Point, a use) is a `poolOf` reader
   in the machine, not a new moment.
4. **The corpus is current.** Rescanned 2026-09-03 with the fixed activation column; the
   numbers in §2 held (587 rows matched a family, one more than the survey's 586; the rest
   identical). The JSON lives in the session scratchpad, not the repo — regenerate it:
   `node tools/scan-corpus.mjs <out.json>` (live, read-only, ~10 min, the user out of the
   world — the harness refuses two GMs; the process hits its own 900 s watchdog after the file
   is written, which is harmless) then
   `node tools/classify-corpus.mjs <out.json> [--list <family>] [--kind <kind>]`.
5. **The eight shapes are tables in `scripts/decide/registry.js`** (§1 names each). A row
   there, a unit test in `tests/decide-registry.test.js`, a section in the matching
   `tools/smoke-*.mjs` suite is the whole cost of a band-1 item.
6. **Nothing here blocks anything.** Prod is at v1.30.0 (2026-09-04); the sandbox is the test area, and a release goes out only on the user's word.

## 1. What the walk taught — the families of change

The eleven fixes of 2026-09-02 and the three commissions before them were not eleven kinds of
work. They were **eight mechanisms**, and every one of them is now a table the sweep can add
rows to, a machine that reads a table, or a moment the spine already has:

| Family | What it is | Where it lives | Cost of one more |
| --- | --- | --- | --- |
| **Effect bend** | a standing effect or a feature by NAME bends an attack roll (Innate Sorcery, Reckless, Vow of Enmity, Assassinate's Advantage) | `EFFECT_BENDS` + the gate | a data row |
| **Use chip** | a text-only feature becomes a chip on use; the gate reads it, the roll spends it (Steady Aim) | `USE_CHIPS` + use-chips.js | a data row |
| **Clock rider** | extra damage that rides a hit when the round / the turn / the uses say so, a ticked checkbox on the offer (Dread Ambusher, Dreadful Strike, Divine Strike, Assassinate's dice) | `CLOCK_RIDERS` + clock-riders.js | a data row, a `judge` at most |
| **Hit menu** | the hit offers a choice that spends something before the damage rolls (Cunning Strike, Devious Strikes, Death Strike) | `CUNNING_OPTIONS` + sneak.js | today Rogue-only — the generalisation is the sweep's biggest lever (§4) |
| **Save press** | a failed save presses a condition the pack does not carry as an effect (Web's Restrained) | `SAVE_PRESSES` + saves/consequences.js | a data row |
| **Turn chit / the Reaction** | once per turn, or one Reaction per round, read off the running combat and never a memory | `TURN_CHITS`, `reactionStands`, shared.js | none — every offer's gate already reads it |
| **Verdict outcome** | the verdict itself changes for a feature (Evasion: none on a success, half on a failure) | `EVASION`, verdict.js | a row per feature of the shape |
| **Condition clause** | a glossary clause hangs off a condition (Incapacitated breaks concentration; Paralyzed auto-fails; the automatic crit within 5 ft) | `CONDITION_BENDS`, `SAVE_BENDS`, concentration.js | a data row |

Three kinds of cost, and the sweep should be planned by them, not by ability count:

1. **A row in an existing table** — minutes, a unit test, a suite section.
2. **A new table plus a small machine** that reads it at a moment the spine already has (the
   way use-chips.js and clock-riders.js went in) — an afternoon each.
3. **A new moment in the spine** (a new hook, a new popup shape) — a day, and a design ruling
   first, off a prototype ([[ui-prototype-first]]).

## 2. The corpus

The 2024 packs only: the premium Player's Handbook, Heroes of Faerûn, the DMG's supernatural
gifts; the SRD 2024 packs are a subset and were deduplicated against them by name; the 2014
legacy packs (`dnd5e.classfeatures`, `dnd5e.spells`, `dnd5e.races`, `dnd5e.subclasses`) are
ignored — the table plays 2024.

| Kind | Rows | Match at least one family | Of those, text-only | Already named in a registry table |
| --- | --- | --- | --- | --- |
| (a) race traits | 45 | 23 | 8 | 1 (Stone's Endurance) |
| (b) class features | 116 | 46 | 16 | 13 |
| (c) subclass features | 279 | 156 | 44 | 16 |
| — options nothing grants (invocations, metamagic, maneuvers, boons) | 69 | 28 | 6 | 9 |
| (d) feats | 109 | 66 | 23 | 12 |
| — supernatural gifts | 20 | 2 | 1 | 0 |
| (e) spells | 428 | 265 | 28 | 23 |
| **all** | **1066** | **586** | **126** | **74** |

"Match a family" means the row's text or structure trips one of the eighteen detectors in
`classify-corpus.mjs`. The families and how many rows each catches:

| Family | race | class | subclass | opts | feat | spell | text-only | known |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bend-attack (EFFECT_BENDS) | 0 | 6 | 11 | 2 | 12 | 16 | 11 | 35 |
| bend-save (SAVE_BENDS) | 3 | 3 | 13 | 3 | 8 | 21 | 13 | 2 |
| rider-damage | 7 | 8 | 13 | 4 | 6 | 84 | 11 | 20 |
| clock (round / turn / has-not-acted / once per turn) | 3 | 13 | 38 | 9 | 22 | 53 | 25 | 28 |
| reaction (any Reaction cost) | 3 | 4 | 30 | 3 | 10 | 13 | 22 | 11 |
| use-chip (arms the next roll / to end of turn) | 0 | 5 | 7 | 2 | 3 | 4 | 3 | 10 |
| press-condition (a save or a hit presses a condition) | 7 | 6 | 28 | 5 | 10 | 153 | 7 | 19 |
| half-on-save | 7 | 7 | 26 | 1 | 3 | 132 | 6 | 14 |
| d20-fold (reroll, add a die, a bonus after the roll) | 1 | 3 | 3 | 4 | 5 | 4 | 8 | 1 |
| crit | 0 | 0 | 3 | 0 | 5 | 1 | 2 | 4 |
| concentration | 0 | 2 | 8 | 2 | 4 | 17 | 10 | 3 |
| volley | 0 | 0 | 0 | 0 | 0 | 16 | 0 | 5 |
| temp-hp / healing | 2 | 5 | 24 | 3 | 11 | 21 | 7 | 4 |
| aura | 3 | 1 | 16 | 0 | 8 | 10 | 16 | 5 |

Structure of the 586 combat-ish rows: 286 ship an effect (88 passive on the owner, 209
applied to a target), 220 carry a save activity, 205 a damage activity, 102 have uses. The
scanner's activation column is unreliable for features (it read the activity's activation only
when overridden — fixed in the scanner, not yet re-run), so "reaction" was judged from text.

## 3. Pattern findings

**The packs carry most of the mechanics; the module's job is the moments.** 286 of the 586
rows ship an effect and 220 a save — the system applies those itself once the save resolves.
For that mass the sweep adds nothing per row: the save gate, the verdict, the receipts and the
concentration break already cover them. The sweep's real work is the **126 text-only rows**
(a feature the pack ships as a paragraph — the Steady Aim shape) and the rows whose trigger is
a **moment** the packs cannot express: on a hit, on a miss, on a crit, on a kill, on being hit,
on a failed or a successful save, at the start or the end of a turn.

**The same eight shapes recur across all five kinds.** Nothing in the corpus needed a ninth
mechanism; what it needs is the existing ones opened up:

1. **Save-side bends by name** — the mirror of `EFFECT_BENDS`. The save gate reads only
   conditions today. Danger Sense (Advantage on Dex saves), Haste, Protection from Evil and
   Good, Beacon of Hope, Fey Ancestry, Brave, Dwarven Resilience, War Caster, Mage Slayer,
   Lordly Resolve, Aura of Protection's bonus, Bless/Bane's d4 — some thirty rows across every
   kind, most of them effects the packs already ship (the gate has only to read the name).
   *Cost 2, then rows at cost 1.*
2. **The hit menu, generalised.** Cunning Strike is one instance of "on a hit, pick what rides
   before the dice": Brutal Strike and Improved Brutal Strike (forgo Reckless Advantage, +1d10
   and Forceful Blow / Hamstring / Staggering / Sundering), Stunning Strike (once per turn, a
   Con save or Stunned), Open Hand Technique, Elemental Smite, Psionic Strike, the Battle
   Master's on-hit maneuvers (Trip, Pushing, Disarming, Menacing, Goading, Distracting —
   Precision and Riposte are folds already). A dozen-odd rows behind one menu machine. *Cost 2.*
   ⚠ **Not the smites** (user, 2026-09-03): Divine Smite and the eight smite spells are a
   separate Bonus Action cast AFTER the hit in 2024, not a rider on it — out of scope for the
   menu; Shining Smite stays a bend row. **Ruled 2026-09-03: one popup per hit, the rows grouped
   by the feature or class that grants them** — never a menu per feature. What generalises is
   the COST KIND (sneak dice today; a Focus Point, a Superiority Die, a use), so the table is one
   hit-options registry keyed by feature, each row its cost kind and amount, its pick limit
   within the feature, and the pack activity it runs. Brutal Strike's trade (forgo Reckless
   Advantage) is decided BEFORE the roll and is a gate box; only its rider and the Forceful
   Blow choice are menu rows.
3. **Interrupts that bend the attack roll instead of AC or damage.** The Interrupt list knows
   `ac` and `damage`; the corpus has a third kind — the reaction that imposes Disadvantage or
   subtracts from the roll: Warding Flare, Cutting Words, Shadowy Dodge, Bend Luck, Cosmic
   Omen, Protection (the fighting style), Soul of Vengeance, Guided Strike (+10 for an ally).
   About a dozen rows, mostly text-only, all spending the Reaction chip. *Cost 2 (a kind).*
4. **Standing once-per-turn riders with a target judge.** Hunter's Prey (Colossus Slayer: 1d8
   if the target is below its maximum), Superior Hunter's Prey, Frenzy, Bestial Fury, Frigid
   Explorer, Lunar Form, Eldritch Smite, Lifedrinker, Radiant Strikes if the pack's passive
   effect does not already add it. `CLOCK_RIDERS` rows with the `targetDamaged` judge the
   effect table already has. *Cost 1 each.*
5. **d20 folds beyond the three kinds.** A reroll kind (Halfling Luck, Indomitable, Lucky,
   Fanatical Focus, Boon of Fortune's Favor) and a damage-die reroll (Savage Attacker, Piercer,
   Tavern Brawler). *Cost 2 (two kinds), then rows.*
6. **Range-row cancellers.** Sharpshooter, Crossbow Expert and Spell Sniper exist to negate
   rows the range kind already draws (long range, an enemy within 5 feet, cover). Three feats,
   frequent at the table, one row type. *Cost 1–2.*
7. **Bare save presses.** `SAVE_PRESSES` covers Web. The text scan cannot tell a spell that
   presses a condition from one whose activity already applies it (Web looks carried and is
   not — measured), so this needs a per-row audit: for every save activity, does its `effects`
   link carry the condition the text names? The scanner records both; the audit is a small
   tool away. *Cost 1 per row, once audited.*
8. **Use chips beyond Steady Aim.** Heightened Focus, Studied Attacks (armed by a MISS — a new
   trigger), Relentless Avenger, Feinting Attack ✓, Moonlight Step ✓ (the pack ships the effect;
   check the effect NAME matches the row). *Cost 1, except the miss trigger.*

**Kinds, by yield.** (a) Races are thin: seven breath weapons the packs already carry, Stone's
Endurance ✓, three save bends (Brave, Fey Ancestry, Dwarven Resilience — item 1), Luck (item 5),
the Goliath's Giant Ancestry options. (b) Classes: every core feature that mattered is in;
what remains is Brutal Strike, Stunning Strike, Indomitable, Danger Sense,
Studied Attacks, Relentless Rage, Second Wind / Tactical Shift — items 1, 2, 5, 8. (c)
Subclasses are the volume — 156 rows, 44 text-only — and almost all of them land in items 2,
3 and 4; the press-condition subclass rows (28) are pack-carried and need nothing. (d) Feats
are a third done (12 known); the rest are items 5 and 6 plus Sentinel and Polearm Master (a
reaction attack — Riposte's shape) and Great Weapon Master's flat rider. (e) Spells: the
mechanics are the packs' own; the sweep adds bend rows (35 known, the detector finds few
more), the save-side bends (item 1) and the bare-press audit (item 7); the smites are a
Bonus Action cast, not a hit rider, and stay out (2026-09-03).

**What not to sweep.** Resistances and immunities (the system's damage pipeline), speeds and
movement (out of scope, DESIGN §4), passive AC formulas (the sheet), temp HP and healing on
a use (the activity applies it), auras that only grant resistance or a bonus the effect
already carries.

## 4. Suggested order, when scoped

1. Item 1 (save-side bends) — one table, thirty rows, all five kinds touched at once.
2. Item 2 (the hit menu) — off a prototype; unlocks Barbarian, Monk, Battle Master.
3. Item 3 (the d20 interrupt kind) — the Reaction chip is already there to spend.
4. Items 4, 6, 8 — rows.
5. Items 5 and 7 — the reroll kinds and the press audit.

Then the kind-by-kind walk the user asked for, (a) to (e), reading each row against the
tables rather than inventing a mechanism per feature ([[examples-are-classes]]).

## 5. The three questions — all RULED 2026-09-03

- ~~Do the 2014 legacy packs stay ignored?~~ **Yes, ignore 2014** (user: "ignore 2014"). The
  table plays 2024; the tables match by name, so a shared name already works.
- ~~The hit menu: one popup per hit with every eligible rider as rows, or a menu per feature as
  Cunning Strike is today?~~ **One popup per hit, grouped by feature/class** (user: "one popup
  seems good, grouped by feature/class"). Smites are not on it — they are a separate Bonus
  Action in 2024 (user, same ruling). Detail in §3 item 2.
- ~~Save-side bends read by name need the same three lists the attack gate has, or one shared
  Effect Sources list for both gates?~~ **One list** (user: "one list, for saves"). The row says
  which gate it bends — the attacker/target facets it has today plus a saves facet (abilities +
  bend, the `SAVE_BENDS` shape). The Condition Sources list already switches both gates; this
  follows it. The Reminder Sources list stays the kinds switch for both.
