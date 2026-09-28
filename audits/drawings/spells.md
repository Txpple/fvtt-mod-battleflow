# The PHB spells — the drawing (measured 2026-09-28)

The inventory for the slice the user ordered after the refactor (BACKLOG *The long-term order*,
step 4a: "spells, then Slice B"), measured: the rescan (§0 item 4, 2026-09-28, the sandbox on
dnd5e 6.0.5), `classify-corpus.mjs --kind spell` cut to the PHB pack, `audit-presses.mjs`, and
`scripts/decide/registry.js` for the tables. The class is **every PHB spell**
([[examples-are-classes]]): **391** deduplicated rows in `dnd-players-handbook.spells`, **240** with
a family, **27** named in the registry already — plus the rows the classifier's stale known-map
missed (Hellish Rebuke, Fount of Moonlight, Armor of Agathys, Fire Shield, the eight emanation
spells, the eight spent areas, the seven chosen areas, Heat Metal, Hex, Hunter's Mark, Steel Wind
Strike; the map is repaired in this commit). Arcana Unleashed's 33 and Heroes of Faerûn's spells
were scanned and are **out** (PHB only, the user 2026-09-26).

**The finding §3 predicted holds: the packs own the mechanics.** The four big families are the
platform's — press-condition 138, half-on-save 118, rider-damage 78, clock 43 — and the save
gate, the verdict, the receipts, the concentration break and the effect clocks already cover
them. Nothing per row. The module's work is the moments below, and **one kind** the corpus keeps
asking for that nothing has: **the save that repeats**.

## The one kind — the repeating save (`REPEAT_SAVES`)

**BUILT 2026-09-28** (`repeat-saves.js`, three triggers; RULINGS *The spells slice — Tiers 1 and 2*): the rows below, the counters for Contagion and Flesh to Stone with it. The drawing below is as measured before the build.

Twenty-odd PHB spells land an effect and then say *"at the end of each of its turns, the target
repeats the save, ending the effect on a success"* (Hold Person, Hold Monster, Tasha's Hideous
Laughter, Blindness/Deafness, Crown of Madness, Confusion, Slow, Fear, Phantasmal Killer, Eyebite,
Contagion), or *"whenever it takes damage"* (Hideous Laughter, the three Dominates), or count
failures (Flesh to Stone: three fails → Petrified). **Nothing in the code repeats a save**
(measured: no reader, no clock trigger). The precedent is the emanation's `trigger on "turnEnd"`
(§6, `EMANATIONS`): a demand raised by the clock at the bearer's turn end, judged by the
activity's own save, the effect removed on a success. The machine is a table keyed by the
effect's name, a clock hook at `turnEnd` (and the damage-landed seam for `onDamage`), the
existing demand and verdict; the verdict's success removes the effect through the receipt.
*Cost 2 (the kind), then rows at cost 1.* Flesh to Stone's counter is its own facet (`count: 3`)
and waits for a customer. ⚠ The chosen-area spells (Slow, Fear, Confusion) already exist as
`SPENT_AREAS` / `CHOSEN_AREAS` rows: the repeat is a second row on the same spell, not a change.

## The rows — the rest are not NATIVE or OUT

| Spell | What the pack carries | Verdict → where |
| --- | --- | --- |
| **Otto's Irresistible Dance** | effect [charmed], save | **BUILT 2026-09-28** — ROW → `EFFECT_BENDS` (attacks Disadvantage, `saves` facet dex Disadvantage) + a `REPEAT_SAVES` row (the save is an action, `onAction`: the bearer's, offered) |
| **Haste** | effects [incapacitated] | **NATIVE (measured 2026-09-28: Hasted carries the Dexterity save mode)** — was: ROW → `EFFECT_BENDS` `saves` facet (Advantage on Dex saves); the AC and the action are the pack's; the lethargy is the effect's end |
| **Beacon of Hope** | effect | **BUILT 2026-09-28: the saves NATIVE (Hopeful carries both modes); the `max` row on `HEAL_REROLLS`** — was: ROW → `EFFECT_BENDS` `saves` facet (Advantage on Wis and death saves) + a `HEAL_REROLLS`-shaped facet `max: true` (healing dice at maximum; one table, one machine) |
| **Protection from Poison** | effect | **BUILT 2026-09-28** — ROW → `EFFECT_BENDS` `saves` `{bend: advantage, statuses: [poisoned]}` — Dwarven Resilience's exact row (§6) |
| **Synaptic Static** | effect, save, damage | **NATIVE (measured 2026-09-28: Muddled Thoughts carries the −1d6)** — was: measure: if the pack's effect writes a `-1d6` bonus, NATIVE; else ROW → `EFFECT_BENDS` with a `fold` (Bane's shape) |
| **Sanctuary** | effect | ROW+VOCAB → the gate before the roll: a hostile aiming at the warded creature is demanded a Wis save first, a fail cancels the attack. New trigger on `gate.js` (the buy box's shape, `ADVANTAGE_BUYS`); the effect's end on the bearer's own attack is the pack's? measure |
| **Mirror Image** | effect | ROW+VOCAB → an automatic interrupt on the DEFENDER after the verdict: a d20 against the image count (6/8/11), a hit redirected to an image; an `INTERRUPT_ROLLS`-shaped row with no Reaction cost and a counter on the effect. Prototype: the redirect is a card line, no popup |
| **Counterspell** | save, reaction | KIND → a reaction hold raised at a HOSTILE's cast (the hit's hold at a new moment, `hold/`); the Con save is the spell's own activity. Frequent, wanted, **UI-shaped: prototype first**. *Cost 2.* Waits for a player with it (session 0) unless the user pulls it forward |
| **Warding Bond** | effect | ROW+VOCAB → damage landed on the warded creature is dealt to the caster too (the `DAMAGE_SHIELDS` seam on the applier, reversed: not retaliation, sharing). Measure the pack's effect for the +1 AC/saves and resistance (NATIVE) |
| **Vampiric Touch** | attack, damage | ROW+VOCAB → heal the caster half the damage dealt (Lifedrinker's shape, §3 item 4: a rider that heals). One table: `HEAL_ON_HIT`, a second customer is a row |
| **Heroism** | effect | **BUILT 2026-09-28 as `TURN_GRANTS`, a table of its own (RULINGS *The spells slice*)** — was: measure: temp HP at the bearer's turn start — a `CLOCK_RIDERS`-shaped `turnStart` grant if the pack's effect does not roll it; else NATIVE |
| **Command** | save, no effect | **BUILT 2026-09-28: `SAVE_PRESSES` `word`, asked on the failure (the register)** — was: ROW → `SAVE_PRESSES` for Grovel (Prone) with an `EFFECT_CHOICES`-shaped ask (Approach / Flee / Grovel / Halt) — the audit's one PHB bare press not already carried (Grease, Web, Sleet Storm are rows) |
| **Sorcerous Burst** | attack, damage | **NATIVE (measured 2026-09-28: the pack's `1d8x@mod=8` is Foundry's capped explode)** — was: ROW+VOCAB → an exploding die (a 6 on a d6 rolls another, up to the modifier): the dice-changer machine (`DAMAGE_EITHER`'s popup-less shape), automatic |
| **Placed areas that pulse** — Moonbeam, Cloud of Daggers, Wall of Fire, Cloudkill, Insect Plague, Spike Growth, Flaming Sphere | template, save, damage | VOCAB → `EMANATIONS` kind `"area"`: the system's template NOT attached to the caster, the same region, `trigger on "enter" / "turnStart"`. The region machinery raises both events already (NOTES *v14 models an emanation end to end*). Movement-triggered damage (Spike Growth per 5 feet) stays out (DESIGN §4) |

**NATIVE (the pack + the platform, nothing owed):** Bless, Bane, Guidance, Resistance, Shield
of Faith, Mage Armor, Magic Weapon, Elemental Weapon, Invisibility, Greater Invisibility (the
condition bends), Hold Person / Hold Monster's Paralyzed (`SAVE_BENDS` auto-fail; the repeat is
the kind's), Phantasmal Killer's Frightened, Stinking Cloud's Poisoned, Blight, every plain
damage-and-save spell (Fireball's shape, 118 rows), Cure Wounds and the healing words (read by
`HEAL_REROLLS`), Chill Touch, Guiding Bolt, Ray of Enfeeblement, Vicious Mockery, Blur, Foresight,
Compelled Duel, Bestow Curse, Dispel Evil and Good, Holy Aura, Aura of Purity, Circle of Power,
Protection from Evil and Good (rows already), Shield (+ the Magic Missile block), Hellish Rebuke,
Fount of Moonlight (`REBUKES`), Armor of Agathys, Fire Shield (`DAMAGE_SHIELDS`, `EFFECT_CHOICES`),
Heat Metal (`DAMAGE_SAVES`), Hex, Hunter's Mark, the four volleys, Spirit Guardians and the
seven other emanation spells, the eight spent areas, the seven chosen areas.

**OUT (no combat moment the module judges, or a ruling):** the smites (a Bonus Action cast,
2026-09-03), Feather Fall (no falling moment), Counterspell's cousins that read a spell's level
on the sheet, Mind Spike (the audit's false press), Magic Circle and Forcecage (a region's
ban on movement and attacks across it — DESIGN §4 movement), Raise Dead's penalty, Enthrall
and Animal Messenger (the save bend is the GM's judgment of "fighting"), Wall of Force / Wall of
Stone / Guards and Wards (terrain), the summons (Conjure Animals, Elemental, Fey, Celestial,
Animate Objects, Spiritual Weapon: the summoned actor's own attacks are the attacks machine's
already; the spell owes nothing), the shape-changers (Polymorph, True Polymorph, Shapechange,
Animal Shapes: the platform's transformation), Prismatic Spray (a d8 per target — held for a
customer), Chain Lightning's leaps and Call Lightning's repeats (the demand at the targets
covers them), Cordon of Arrows and Delayed Blast Fireball (the pack's uses), Wish.

**The data slips, said here so a table knows why (BACKLOG's *Slashed* row is the precedent):**
Sleep's pack effect carries Incapacitated where the text says Unconscious (the audit); the module
lands what the pack ships. A fix belongs to the data, never a carve-out.

## The order, and what is the user's

1. **Rows first, cost 1 each, no UI:** Protection from Poison, Haste, Beacon of Hope, Otto's
   bends, Command's press, Sorcerous Burst, Heroism and Synaptic Static once measured.
2. **The one kind:** `REPEAT_SAVES` — Hold Person is the customer (the most-cast control spell
   at any table), then the rows listed above. Its walk is the slice's walk.
3. **The vocabulary items with a prototype each:** Sanctuary (the gate), Mirror Image (the
   defender's interrupt), the `"area"` emanation kind (Moonbeam). Ruled off a prototype
   ([[ui-prototype-first]]) before a line.
4. **Held for a customer:** Counterspell (a Wizard or Sorcerer at session 0), Warding Bond,
   Vampiric Touch, Flesh to Stone's counter, Prismatic Spray.

The user's calls before step 2: (a) is the repeat-save kind in, and does its success remove the
effect automatically or land as an offer to the GM (R1 says the machine may act where the rule
leaves no choice — a success ends the effect, no choice); (b) which of step 3's three go in this
slice; (c) whether Counterspell is pulled forward from session 0.
