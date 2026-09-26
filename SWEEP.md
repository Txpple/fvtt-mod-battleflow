# The abilities sweep — survey

**Status: Slice A DELIVERED on main (2026-09-24), pending the user's audit and the release
floor.** Shelved 2026-09-03 ("a longer term project"); the long-term order of 2026-09-24
(BACKLOG *The long-term order*) un-shelved it one slice at a time. Slice A — PHB species traits
and origin feats — is measured and ruled (§6; what it settled is RULINGS *Slice A*): **PHB
first** (Arcana Unleashed's origin feats are the next phase); **tiers 1–3 built** (the save
gate's feature match and Stone's Endurance; Hill's Tumble on the hit menu, Fire's Burn and
Frost's Chill switched to clock riders the same day; Savage Attacker's popup and the `roll`
interrupt kind); **five PARKED** with triggers; **Relentless Endurance
HELD** for Slice B's kill moment; **one pick per hit** for now. A fifth document by design,
for the length of the sweep: it holds the survey behind a planned pass over every racial
trait, class feature, subclass feature, feat and spell that would qualify for Battle Flow, in
that order. As each slice is scoped, what it settles moves into DESIGN §8 / RULINGS / BACKLOG;
when the sweep is done, this file goes.

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
   eight on-hit maneuvers as its first group (`hit-menu.js`, `HIT_GROUPS` / `HIT_OPTIONS`, RULINGS
   *The hit menu*). **The Battle Master is COMPLETE (2026-09-05): all nineteen maneuvers land on a machine** — the eight on-hit
   ones on the hit menu, the nine others on the seats BACKLOG named (Parry an interrupt that reduces,
   four Bonus Action uses in `superiority-uses.js`, two scoped d20 folds, Commander's Strike the
   `command` fold kind, Rally native). What item 2 still holds is the OTHER groups — Brutal Strike, Stunning
   Strike, Open Hand Technique, Psionic Strike — each a group row (its pool and pick limit) and
   option rows on the same table; a new COST KIND (a Focus Point, a use) is a `poolOf` reader
   in the machine, not a new moment.
4. **The corpus was RESCANNED 2026-09-24** (Foundry 14.368 / dnd5e 6.0.5, the sandbox), with
   *Arcana Unleashed* (`dnd-arcana-unleashed`, a 2024-rules core expansion on magic) IN it by
   the ruling in item 1. **1188 deduplicated 2024 rows** — race 45, class 115, subclass 325,
   class? 84 (options nothing grants), feat 138, gift 20, spell 461 — and **657 match a
   family**. §2's tables are the 2026-09-03 survey (1066 / 586) and stay as the families'
   shape; the new totals are these. Arcana Unleashed's **10 origin feats** were measured: 3 need
   module work (Arcane Omens and Transmuted Anatomy, a Reaction +1d4 to a failed save; Arcane
   Overload, +PB to one Evocation damage roll) — **waiting with the splat books** (2026-09-26: the feats slice is PHB only), by the user's
   ruling; 4 are native or sheet-level, 3 out of combat. The JSON lives in the session
   scratchpad, not the repo — regenerate it:
   `node tools/scan-corpus.mjs <out.json>` (live, read-only, ~10 min, the user out of the
   world — the harness refuses two GMs; the process hits its own 900 s watchdog after the file
   is written, which is harmless) then
   `node tools/classify-corpus.mjs <out.json> [--list <family>] [--kind <kind>]`.
5. **The eight shapes are tables in `scripts/decide/registry.js`** (§1 names each). A row
   there, a unit test in `tests/decide-registry.test.js`, a section in the matching
   `tools/smoke-*.mjs` suite is the whole cost of a band-1 item.
6. **Slice A is §6** — the measured inventory, the tiers in build, what is parked and held.
   Nothing else here blocks anything. Prod is at v2.0.8 (2026-09-24); the sandbox is the test
   area, and a release goes out only on the user's word.

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

⚠ **A fifth book, rescanned 2026-09-24 (§0 item 4 has the totals): *Arcana Unleashed*** — a
core rule expansion on magic in the Tasha's shape, 2024 rules, so the ruling above puts it IN.
The kind table below predates it. What it ships, measured on the sandbox by
[tools/probe-premium-module.mjs](tools/probe-premium-module.mjs) (module v1.0.1, Foundry 14.368
/ dnd5e 6.0.5, pack indexes only — activities and text are the rescan's):

| Pack | Rows | What |
| --- | --- | --- |
| `dnd-arcana-unleashed.subclasses` | 71 | 8 subclasses (Arcana Domain, Arcane Archer, Warrior of the Mystic Arts, Vestige Patron, and the Conjurer / Enchanter / Necromancer / Transmuter wizards), 61 features |
| `dnd-arcana-unleashed.feats` | 37 | origin, general, one fighting style, epic boons (the book's own grouping) |
| `dnd-arcana-unleashed.spells` | 33 | levels 2–9; **none shares a name with a PHB spell**, so no per-spell list row is touched today and none has read them |
| `dnd-arcana-unleashed.items` | 69 | magic items, with `.effects` beside it: 38 enchantments (the book's evolving items) and 2 base effects |
| `dnd-arcana-unleashed.actors` | 38 | a bestiary — eight CR 15 archmages, living spells, spirit summons, three named CR 17–19 |
| `.backgrounds` `.bastions` `.tables` `.book` `.scenes` `.adventures` | — | nothing the sweep reads |

**Zero name collisions** with anything the registry keys on (table keys, feature fields, the
settings lists' shipped defaults), so nothing the module does today changes. What the rescan
must read, flagged BY NAME only — nothing below is a measured claim about a mechanism:

- **Arcane Shot and its eight shot options** (Banishing, Beguiling, Bursting, Enfeebling,
  Grasping, Piercing, Seeking, Shadow) look like item 2's next group — a pool, a pick on a hit,
  the target's save through the save gate — the Battle Master's shape on a Fighter subclass.
  Curving Shot names a miss.
- **Warrior of the Mystic Arts** spends Focus Points (Focused Strike, Mystic Focus) — the
  `poolOf` cost kind item 2 names.
- **Spell Resistant, Boon of the Iron Mind, Arcane Safeguard** read like save-side bends (item
  1, the `saves` facet). **Aura of Evasion** (a level-7 spell) reads like an emanation row.
- **The bestiary** grows the GM's side, which this survey never covered: the archmages, the
  living spells and the three named monsters are new monster features for the monster-trait
  slice (BACKLOG *Features*).
- **Instinctive Charm** (Enchanter) is a reaction that answers an attack — read it against the
  Interrupt kinds, which know `ac` and `damage` only (§3 item 3).

| Kind | Rows | Match at least one family | Of those, text-only | Already named in a registry table |
| --- | --- | --- | --- | --- |
| (a) race traits | 45 | 23 | 8 | 1 (Stone's Endurance) |
| (b) class features | 116 | 46 | 16 | 13 |
| (c) subclass features | 279 | 156 | 44 | 16 |
| — options nothing grants (invocations, metamagic, maneuvers, boons) | 69 | 28 | 6 | 9 | ← the ten metamagic options DELIVERED 2026-09-09 (RULINGS *Metamagic*); the maneuvers before them |
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
   **Being BUILT in Slice A (2026-09-24, tier 3)** as the `roll` interrupt kind, with three
   customers: **Warding Flare, Shadowy Dodge, Lucky** (its Disadvantage half) — §6.
4. **Standing once-per-turn riders with a target judge.** Hunter's Prey (Colossus Slayer: 1d8
   if the target is below its maximum), Superior Hunter's Prey, Frenzy, Bestial Fury, Frigid
   Explorer, Lunar Form, Eldritch Smite, Lifedrinker, Radiant Strikes if the pack's passive
   effect does not already add it. `CLOCK_RIDERS` rows with the `targetDamaged` judge the
   effect table already has. *Cost 1 each.*
5. **d20 folds beyond the three kinds.** A reroll kind (Indomitable, Fanatical Focus, Boon of
   Fortune's Favor) and a damage-die kind (Savage Attacker — the PHB customer, in build in
   Slice A tier 3 as a keep-either popup; Piercer). *Cost 2 (two kinds), then rows.*
   ⚠ **Measured 2026-09-24:** Halfling Luck and Tavern Brawler are **NATIVE** — Luck ships
   `flags.dnd5e.halflingLucky`, which dnd5e 6.0.5 turns into `r1` on attacks, checks, saves
   and initiative; Tavern Brawler's `r1` is in the feat's own attack formula. Lucky's
   Advantage half is PARKED (§6), its Disadvantage half is item 3's.
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
Endurance ✓, three save bends (Brave, Fey Ancestry, Dwarven Resilience — item 1), Luck (NATIVE,
measured 2026-09-24), the Goliath's Giant Ancestry options (the hit menu, §6). (b) Classes: every core feature that mattered is in;
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

**Scoped since 2026-09-24 by slice, not by item** (BACKLOG *The long-term order*): Slice A (species and origin
feats, §6) takes items 1, 2, 3 and 5 with real content behind them; Slice B (the GM's side)
takes the kill moment; session 0 of the next campaign sets Slice C onward from the party's own
kit.

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

## 6. Slice A — species and origin feats: the drawing (measured 2026-09-24)

The inventory behind HANDOFF §2's plan (the commission of 2026-09-24, retired on delivery — git
history), measured (its step A0): the rescan (§0 item 4),
`classify-corpus.mjs --kind race|feat`, four feats read whole off the sandbox, the dnd5e 6.0.5
bundle for the native flags, `scripts/decide/registry.js` for the tables. The class is **every
PHB species trait and origin feat** ([[examples-are-classes]]): 45 species rows
(`dnd-players-handbook.origins`, featType `race`) and 10 origin feats
(`dnd-players-handbook.feats`, `type.subtype = "origin"` — NOT a featType). **No row is a plain
ROW today** — every table-shaped one needs a vocabulary item. Every limited use sits on the
ITEM (`system.uses`, the activity consumes `itemUses`); none carries activity uses.

### The rulings (user, 2026-09-24)

- **PHB first.** Arcana Unleashed's origin feats wait with the splat books — the next slice is the PHB feats only (the user, 2026-09-26; BACKLOG *The long-term order*).
- **Tiers 1–3 in build:**
  - **Tier 1** — the save gate matches `match: "feature"` rows (Brave, Fey Ancestry, Dwarven
    Resilience), and **Stone's Endurance** on `INTERRUPT_REDUCTIONS` beside Parry.
  - **Tier 2** — the hit menu's **Giant Ancestry group** (Fire's Burn, Frost's Chill, Hill's
    Tumble). ⚠ **Switched the same day** (user: *"yes you should switch"*): Fire's Burn and
    Frost's Chill ride as `CLOCK_RIDERS` (`when: "any"`); Hill's Tumble alone stays on the menu
    (RULINGS *Slice A*). The table rows below record the first drawing.
  - **Tier 3** — **Savage Attacker's popup** (the damage-die kind) and the **`roll` interrupt
    kind** (§3 item 3) with **Warding Flare, Shadowy Dodge and Lucky** (its Disadvantage half)
    as customers. The UI was ruled off the Slice A prototype the same day: Savage Attacker on
    the hit, Disadvantage as a rescue of the hit.
- **PARKED, each with its trigger:**
  - ~~**Lucky's Advantage half**~~ — **BUILT 2026-09-25** in the Halfling walk (user: "we need to
    unpark the advantage on our own d20"): the gate's buy box (`ADVANTAGE_BUYS`, reminder kind
    `buy`, `advantage-buys.js`), and the `advantage` D20 fold for an initiative rolled with no
    dialog (a bend in RULINGS' register). Vocabulary 10's chip window was not needed.
  - **Trance** — a named-spell scope + an immunity bend. Reopens when an elf sits down against
    a sleep effect.
  - ~~**Healer's healing rerolls on spells**~~ — **BUILT 2026-09-25** in the origin-feat round
    (user: "use the empower spell form as a baseline"): the `HEAL_REROLLS` table, `heal-rerolls.js`
    — Empowered's dice popup on a healing spell AND Battle Medic (its `r1` taken off), the healing
    waiting on a claim in `cast.js`. Not a kind (one table, one machine).
  - ~~Inner Radiance's turn-end pulse~~ and ~~Celestial Revelation's extra damage~~ — **BUILT
    2026-09-25** in the walk (RULINGS *The Aasimar walk*): the pulse is an `EMANATIONS` feature
    row (`while`, `reach: "all"`, `pulse`), not a new kind; the extra is a `CLOCK_RIDERS` row
    (`amount`, `transformed`, `forms`, `spells`). Necrotic Shroud's 60-second Frightened is fixed
    in Vendor Fixes VF-002, never here.
- ~~**HELD:** **Relentless Endurance**~~ — **BUILT 2026-09-25** in the Orc walk (with Death Ward): the
  DROP_TO_ONE table, `drop-to-one.js` at `dnd5e.preApplyDamage`. Slice B's kill moment adds Undead
  Fortitude and the monster Relentless trait as rows there.
- **One pick per hit, for now.** The hit menu carries one pick per hit; **a Goliath Battle
  Master is the trigger** for the array shape (a maneuver and a boon on the same hit).

### Species — the rows that are not NATIVE or OUT

| Trait | What the pack carries | Verdict → where |
| --- | --- | --- |
| **Brave** (Halfling), **Fey Ancestry** (Elf), **Dwarven Resilience** (Poisoned saves) | text-only, no effect | ROW+VOCAB → `EFFECT_BENDS` `saves` `{bend: advantage, statuses: [frightened / charmed / poisoned]}`; the save gate matches effect names only today → the feature match. **Tier 1** |
| **Stone's Endurance** (Goliath) | heal activity, Reaction, `1d12 + @abilities.con.mod` (the formula IS the reduction — Parry's shape); ITEM `@prof` lr | ROW → `INTERRUPT_REDUCTIONS`. ⚠ **Corrected:** its spend and lookup already work as Parry's — dnd5e fills the empty activity name with the type title "Heal", and an empty consumption target makes `poolOf` return the item, so `pool: true` spends its own uses. The lookup is made locale-proof (name, or type `heal` when unnamed). Attack hits only; save and area damage stays by hand. **Tier 1** |
| **Fire's Burn**, **Frost's Chill**, **Hill's Tumble** (Goliath) | damage 1d10 fire / damage 1d6 cold + effect "Chilled" (−10 speed) / utility, no save; each ITEM `@prof` lr | ROW+VOCAB → `HIT_OPTIONS` under a Giant Ancestry group paid per option; Hill's Tumble needs a no-save press and a size judge (≤ Large). ⚠ **Corrected:** "Chilled" DOES carry a 1-turn clock (`turnStart`); it is still pinned the Slow mastery's way, so an opportunity attack's clock is the attacker's. **Tier 2** |
| **Trance** (Elf) | text-only | ROW+VOCAB, low priority. **PARKED** |
| **Celestial Revelation — the extra damage** (Aasimar) | nothing rolls it | ROW+VOCAB → `CLOCK_RIDERS` (`amount`, a `transformed` judge, `forms`, `spells`). **BUILT 2026-09-25** in the walk (RULINGS *The Aasimar walk*) |
| **Celestial Revelation — Inner Radiance** | damage on use, 10-ft template | an `EMANATIONS` feature row (`while`, `reach: "all"`, `pulse`) plus the new `TOKEN_LIGHTS` table for its light. **BUILT 2026-09-25** in the walk |
| **Relentless Endurance** (Orc) | heal activity, no activation ("reduced to 0 HP"); ITEM `1` lr | the kill moment. ~~HELD → Slice B~~ **BUILT 2026-09-25** — `DROP_TO_ONE` + `drop-to-one.js` (with Death Ward; RULINGS *The species walk, continued*) |

**NATIVE (23):** Celestial Resistance, Healing Hands, Heavenly Wings, Necrotic Shroud (⚠ the
60 s defect above), Breath Weapon (the reference item + five typed), Dragonborn Damage
Resistance, Draconic Flight, Darkvision, Dwarven Resilience's resistance, Dwarven Toughness,
Stonecunning, Elven Lineage (Drow / High / Wood), **Gnomish Cunning** (a transfer effect,
`save.roll.mode = 1`), Cloud's Jaunt, **Storm's Thunder** (a plain reaction damage activity),
Large Form, Powerful Build (carry), Halfling Nimbleness, **Luck** (`flags.dnd5e.halflingLucky`
→ `r1` inside the roll), Adrenaline Rush, Fiendish Legacy (all three).
**OUT (11):** Light Bearer, Draconic Ancestry, Keen Senses, Gnomish Lineage (Forest, Rock),
Giant Ancestry's parent (the container), Naturally Stealthy, ~~Resourceful~~ (**BUILT 2026-09-25**, the Human
walk: the REST_GRANTS table, `rest-grants.js`), Skillful, Versatile,
Otherworldly Presence — plus Powerful Build's grapple-escape half (a check; no check gate).

### Origin feats — the rows that are not NATIVE or OUT

| Feat | What the pack carries | Verdict → where |
| --- | --- | --- |
| **Savage Attacker** | text-only: no activity, effect or uses | NEW-KIND → the damage-die kind: the weapon dice twice, keep either; once per turn by `TURN_CHITS`; owes ARCHITECTURE §11's auto-revert. **Tier 3** |
| **Lucky — Disadvantage** | utility, no activation, consumes `itemUses` 1; ITEM `@prof` lr, one pool with Advantage | NEW-KIND → the `roll` interrupt (the defender cannot choose pre-roll: `preRollAttackV2` is sync on the attacker's client). **Tier 3** |
| **Lucky — Advantage** | utility, consumes `itemUses` 1; the pack's Note: spends, does not enforce | ~~PARKED~~ **BUILT 2026-09-25** — the gate's buy box (`advantage-buys.js`) + the `advantage` D20 fold for initiative with no dialog (RULINGS *The species walk, continued*) |
| **Healer — Healing Rerolls (spells)** | nothing: the `r1` lives only in Battle Medic's own formulas | **BUILT 2026-09-25** — `HEAL_REROLLS` + `heal-rerolls.js` (spells and Battle Medic, one popup) |

**NATIVE (6):** Alert's initiative (`initiativeAlert`), Healer's Battle Medic (`1dXr1 + @prof`
in its four activities), Magic Initiate (ONE item, repeatable), Tavern Brawler's strike and
rerolls (`1d4r1 + @abilities.str.mod` in the feat's own attack), Tavern Brawler's improvised
weaponry, Tough. **OUT (2):** Crafter, Skilled. **BUILT 2026-09-25, the
origin-feat round, off `prototypes/origin-feats.html`:** Alert's initiative swap (`INITIATIVE_SWAPS`,
`initiative-swap.js`), Musician's Encouraging Song (a `to: "allies"` row of `REST_GRANTS`),
Tavern Brawler's Push (the maneuver-fold kind `shove` in `bash-offer.js` — announced, the token
still never moved).

### The rule text, verbatim (the rows' `rule` strings)

- **Brave**: "You have Advantage on saving throws you make to avoid or end the Frightened condition."
- **Fey Ancestry**: "You have Advantage on saving throws you make to avoid or end the Charmed condition."
- **Dwarven Resilience**: "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition."
- **Trance**: "You don’t need to sleep, and magic can’t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness."
- **Fire's Burn**: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target."
- **Frost's Chill**: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn."
- **Hill's Tumble**: "When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition."
- **Stone's Endurance**: "When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total."
- **Celestial Revelation (extra damage)**: "Once on each of your turns before the transformation ends, you can deal extra damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your Proficiency Bonus, and the extra damage’s type is either Necrotic for Necrotic Shroud or Radiant for Heavenly Wings and Inner Radiance."
- **Celestial Revelation (Inner Radiance)**: "Inner Radiance. Searing light temporarily radiates from your eyes and mouth. For the duration, you shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes Radiant damage equal to your Proficiency Bonus."
- **Relentless Endurance**: "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can’t do so again until you finish a Long Rest."
- **Savage Attacker**: "You’ve trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon’s damage dice twice and use either roll against the target."
- **Lucky (Disadvantage)**: "When a creature rolls a d20 for an attack roll against you, you can spend 1 Luck Point to impose Disadvantage on that roll."

### New vocabulary (extends a table that exists)

1. **The save gate reads features by name** (`match: "feature"`; the check gate already does)
   — Brave, Fey Ancestry, Dwarven Resilience; Trance. Tier 1.
2. **A named-spell scope + an immunity bend** on the saves facet — Trance. Parked.
3. **A hit-menu group paid from each option's own item uses** (`pool: "option"`) — the three
   boons. Tier 2. (Corrected: `poolOf` already returns the option item when the consumption
   target is empty; what is new is one pool per option.)
4. **The hit menu on any attack roll** — measured: the rider gate is `activity.type !==
   "attack"`, so spell attacks already qualify; no damage parts, no offer ("and deal damage").
5. **A no-save press** (`press: "prone"`) — Hill's Tumble. Tier 2.
6. **A size judge (≤ Large)** — Hill's Tumble (later Trip and Pushing Attack's clause). Tier 2.
7. **An applied-effect clock, the attacker's next turn start** — Frost's Chill. Tier 2.
   (Corrected: the pack's "Chilled" carries the clock; the pin is the Slow mastery's, for the
   opportunity attack.)
8. **An interrupt reduction spent from item uses, found without a stored name** — Stone's
   Endurance. Tier 1. (Corrected: both already work as Parry's; the lookup is made
   locale-proof and the wording carries the row's own eyebrow and spend.)
9. **A `transformed` judge + an attack-or-spell trigger + a flat `@prof` amount** on
   `CLOCK_RIDERS` — Celestial Revelation. Parked.
10. **A "next D20 Test" chip window + a save-side read of the chip** — Lucky's Advantage.
    Parked.

### New kinds

- **The `roll` interrupt** — a defender's post-roll answer that bends the attacker's d20 (a
  second die taken low, then a re-verdict). Customers: Warding Flare, Shadowy Dodge, Lucky's
  Disadvantage. Tier 3.
- **The damage-die kind** (keep either of two full sets of the weapon dice) — Savage Attacker.
  Tier 3.
- **Healing-die reroll-1s on spells** — Healer. BUILT 2026-09-25 as a table, not a kind.
- **The turn-end aura pulse** — Inner Radiance. Parked.
- **The kill moment** — Relentless Endurance. Held for Slice B.
- *Not needed:* a d20 reroll fold for Halfling Luck — the system does it natively.

### What HANDOFF §2 got wrong against the data

1. **Halfling Luck is NATIVE**, not a d20-reroll fold (the flag becomes `r1` inside attack,
   check, save and initiative rolls).
2. **Gnomish Cunning is NATIVE**, not a row (a transfer effect, `save.roll.mode = 1`).
3. **Brave, Fey Ancestry and Dwarven Resilience are not plain rows** — text-only; the saves
   facet matches effect names, never a feature (vocabulary 1).
4. **The Goliath boons land on the hit menu**, not `CLOCK_RIDERS` / `SAVE_PRESSES` — no
   once-per-turn clock, ITEM uses, Frost's Chill applies an effect, Hill's Tumble has no save.
5. **Tavern Brawler is not a damage-die customer** — its `r1` is in its own formula.
6. **Stone's Endurance is not a d20-interrupt neighbour** — a damage reduction on
   `INTERRUPT_REDUCTIONS`, and (corrected) it spends and resolves as Parry's already.
7. **Storm's Thunder needs nothing** — a plain reaction damage activity.
8. **Healer is not "nothing"** — Battle Medic is native; spell healing rerolls are uncarried
   (and the pack spends neither the Healer's Kit use nor the target's Hit Die).
9. **Celestial Revelation is more than a use chip plus a clock rider** — the pack's own
   activities spend the use; the rider's judge has no self effect in two of three forms; Inner
   Radiance's pulse is a new kind; Necrotic Shroud's clock is wrong in the data.
10. **Magic Initiate is one item**, not three.
11. **The classifier misses rows** — Lucky, Fire's Burn and Hill's Tumble get no family;
    Healer's `d20-fold` is a false positive (a healing die).
