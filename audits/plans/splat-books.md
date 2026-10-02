# The splat books — the prework (2026-10-01, offline)

> **What this is:** the prework for adding Arcana Unleashed, Heroes of Faerûn and Ravenloft: The Horrors Within to the
> module's scope — measured, sorted by shape, with an order and the questions to rule. Nothing is built. The sandbox
> was touched once (three read-only pack-index probes, before the "stay out" call); everything after is OFFLINE, read
> from copies of the modules' LevelDB packs by [tools/scan-corpus-offline.mjs](../../tools/scan-corpus-offline.mjs). Rapid mode: no walkthroughs planned, rows and suites only.
>
> **The user's rulings today:** the three books are IN scope and land **before 3.0** (so v3.0.0 = PHB + DMG + MM + the
> three splat books, all built, pre-walk; 3.x = the walkthroughs). Rapid dev mode stands.

## 1. How it was measured

| Step | Tool | Where |
| --- | --- | --- |
| Pack census + registry collisions | `tools/probe-premium-module.mjs` (live, index-only; the one touch) | the session scratchpad (regenerable) |
| Full documents, offline | `tools/scan-corpus-offline.mjs` (copies each LevelDB pack minus LOCK, reads the copy with classic-level, emits scan-corpus's row shape; **also flattens Actor packs** into one row per embedded feature, which scan-corpus never did) | `dist/splat-corpus.json` (git-ignored; regenerate) |
| Families + registry names | `tools/classify-corpus.mjs` (the three books ranked, `.items` packs → `dm`, actor rows → `monster`) | `dist/splat-corpus-classified.json` |
| Evidence tables per book | `tools/audit-splat-books.mjs` | [audits/splat/](../splat/) — [arcana-unleashed.md](../splat/arcana-unleashed.md), [heroes-faerun.md](../splat/heroes-faerun.md), [ravenloft.md](../splat/ravenloft.md) |
| Full-registry name check | inline (every table key + `feature`/`item`/`effect`/`reaction`/`from` field vs every splat name) | §4 below |

The tooling is in `tools/` (the offline reader needs no bridge and no sole-GM, and works while a battery runs — a better
default than the live scan for any book). The handoff is HANDOFF.md.

## 2. The numbers

| Book | Rows | Combat-shaped | Text-only of those | Already keyed by name | Player-facing | Bestiary |
| --- | --- | --- | --- | --- | --- | --- |
| **Arcana Unleashed** 1.0.2 | 257 | 137 | 31 | 4 (all MM reprints) | 8 subclasses / 48 features · 15 option rows (8 Arcane Shots) · 29 feats (10 origin, 16 general, 3 boons) · 33 spells (L2–9) · 69 items (38 combat) | 25 actors / 65 names (the archmages, Living Spells, spirits, Venger, Taisus) |
| **Heroes of Faerûn** 2.0.0 | 122 | 73 | 18 | 9 | 8 subclasses / 42 features · 34 feats (8 origin, 11 general, 15 boons) · 19 spells (L1–9) · 21 items (3 combat, all clothing) | 5 actors / 6 names (companions and summons) |
| **Ravenloft** 2.0.0 | 505 | 313 | 32 | 21 | 4 species / 6 traits · 7 subclasses / 37 features · 11 feats · 1 spell · 62 items (53 mist talismans, 5 dark gifts, 4 combat) · 13 spirit trinkets | 69 + 54 actors / 388 names |

Row counts are deduplicated by name (one Multiattack). Backgrounds, bastions and roll tables were not kept.

## 3. What fires already — for free

- **Heroes of Faerûn is half in.** Its `.options` pack has ranked in the corpus since Slice A, and the registry keys
  **Death Armor** (`DAMAGE_SHIELDS`), **Purple Dragon Commandant** and **Street Justice** (`EFFECT_BENDS`), with Strike
  Fear, Tyro of the Gauntlet, Lords' Alliance Agent and Boon of Bloodshed named as `from` sources. But no REGISTER ever
  read it: `audits/classes-register.md` filters to the PHB pack, the spells register to PHB spells. The book is scanned,
  unregistered.
- **The Monster Manual machine covers the Ravenloft and Arcana bestiaries by name.** ~25 trait/reaction names are MM
  rows already and fire on any actor that carries them: Magic Resistance (36 bearers), Pack Tactics, Undead Fortitude,
  Regeneration, Avoidance, Parry / Shield / Protection / Counterattack, Life Drain, Misty Escape, Shadow Escape, Sticky
  Shield, Warding Charm, Elemental Absorption, Fiendish Blood, Hellish Rebuke, Displacement, Blood Frenzy, Sunlight
  (Hyper)sensitivity, Death Strike, Object Slam, Petrifying Bite, Smother, Marshal Undead, Wild Magic Surge. Ravenloft's
  `fallback-actors` (Beholder, Troll, Mummy, Wraith, Hydra…) are MM-shaped reprints and ride the same rows.

## 4. Hazards — collisions that are NOT reprints

1. ⚠ **Ravenloft's `Survivor` feat vs the Fighter's `Survivor`.** The Ravenloft row is an origin-style feat (Hypervigilance:
   reroll Initiative on 9 or lower; Steel Yourself: a Reaction +PB to a failed Charmed/Frightened save). `lookup.js`
   `featureNamed` matches any `feat`-type item by name, so a PC with the Ravenloft feat gets Defy Death from `D20_FLOORS`
   (an 18 on a death save is a 20) and the `TURN_GRANTS` Heroic Rally offer. **A defect today, independent of the slice** —
   the fix is a feature match that reads `system.type.value` (`class` vs `feat`/`origin`) or the row's `rule.uuid` source.
   First commit of the slice; its own suite section.
2. **Ravenloft's `Touch of Death` feat** shares its name with Ankhtepot's action — no registry row yet; whichever gets a row
   first must carry a type/actor guard.
3. Monster "spell actions" named `Slow`, `Dominate Person`, `Command` are the spells themselves — the spell lists are right
   to fire; no action.
4. **Arcana's `.effects` pack** (38 enchantments + the `Dodging` base effect) is the house's first ActiveEffect compendium;
   the evolving items (Keyholes Dagger, Blossom Rod, Wave-Swept Weapon, Staff of Skulls, Diamond Staff) apply enchantments
   to ITEMS. The enchantment-aware reader (`lookup.js` `wieldsAs`, cbc4b02) is the precedent — measure one evolving item on
   an actor before writing a row.

## 5. What there is to build — by shape, the precedent named

Cost classes are SWEEP §1's: **row** (minutes: a registry row, a unit test, a suite section), **table** (an afternoon: a
small table + reader at a moment the spine has), **kind** (a day + a ruling: a new moment). Held kinds stay held
(BACKLOG *Scoped out for good*: redirect, cast-triggered, reaction-AC items — listed once below, not re-opened).

### 5.1 Rows on existing tables (~110 across the three books)

| Table / machine | Faerûn | Ravenloft | Arcana |
| --- | --- | --- | --- |
| `EFFECT_BENDS` (attack bends by feature/effect) | Bolster Allies (Ez d'Avenir) | Terrorizer (adv vs Frightened), Incomprehensible Form, Dread Authority | Superior Magic Resistance (spell attacks disadv), Mounted Adept, Divine Power's Cursed Invocation |
| `SAVE_BENDS` / save facet | Elminster's Elusion (adv vs spells), Lordly Resolve, Order's Resilience | Susceptible to Charm, Escaped Death (death saves — pack effect, likely NATIVE), Watchers, Touch of Death feat | Focused Strike (disadv vs your spells after Stunning Strike), Wondrous Alteration, Boon Companions' Bands, Arcanist's Bestiary |
| `CLOCK_RIDERS` (once-per-turn / uses riders) | Spellfire Burst + Honed Spellfire, Lords' Alliance Inspiring Strike (crit → ally), Boon of Bloodshed | Circle of Mortality's Pull of Death, Hungering Might, Ancient Might's Ominous Strikes, Grave Touched, Dread Scythe (+`HEAL_BLOCKS`), Wails from the Grave | Enfeebling / Shadow / Beguiling / Banishing / Grasping Shot dice (see 5.2), Grave Reaper, Blood Amulet, Mage Breaker |
| `DAMAGE_RULES` (type/resistance rules — Elemental Adept's shape) | Frigid Explorer's Biting Cold (ignores Cold resistance) | Grave Touched's Arcane Necrosis (ignores Necrotic resistance) | Namer's Needle |
| `REBUKES` / interrupts (`INTERRUPT_REDUCTIONS`, `INTERRUPT_ROLLS`) | Elemental Rebuke (halve + save), Chilling Retribution (save on hit, Stunned), Song of Defense (reduce 5 × slot level — a slot as the cost: `poolOf` reads slots? check), Backlash (spell), Alustriel's Mooncloak, Crown of Spellfire, Boon of the Soul Drinker, Tyro of the Gauntlet, Mythal Ward | Sentinel at Death's Door (halve + the hit can't be a crit), Mark of Obsession, Gathered Whispers, Symbiotic Being, Mist Walker, Deflect Blow (Parry with a flat 5), Transfer Harm, Warp Mind, Counterattack reprint | Instinctive Charm (save on hit, 30 ft), Harvest Undead, Warlike Familiar, Elemental Familiar, Go to Ground (halve), Masterful Shots, Dissuader, Staff of Skulls, Scholar's Anchoring Bangle |
| D20 folds (`D20_FLOORS`, rerolls, the C1 save-reroll shape) | Shared Resilience (an ally rerolls via an Indomitable use), Boon of Fortune's Favor, Divine Foreknowledge (adv on D20 Tests — effect, NATIVE) | Survivor's Steel Yourself (+PB on a failed Charmed/Frightened save — Disciplined Survivor's shape), Knowledge from a Past Life (checks), Harkon's Bite (passive +1, NATIVE effect), Ebonbane | Reweave Fate (reroll with adv, a reaction spell), Moment of Prescience (the roll becomes a 20 — a floor of 20 on a reaction), Arcane Omens + Transmuted Anatomy (+1d4 to a failed save; SWEEP §0 item 4 measured them), Divination Adept, Lucky Foot (reroll a 1), Keyholes Dagger, Staff of the Lost, Diamond Staff |
| `DROP_TO_ONE` / the drop machine (Undead Fortitude, Death Throes shapes) | Mechanical Determination (Fortitude with a Lightning carve-out) | Tattoo of Osybus (a boon at 0), Death Burst (Death Throes), Reborn By Blood, Multiple Heads (hydra — likely TEXT) | Arcane Immortality, Fiendish Restoration |
| `EVASIONS` | — | Avoidance reprint (free) | Aura of Evasion (allies in the aura — the `aura` fact) |
| `TURN_GRANTS` / turn-start and turn-end aura rows (Slice B) | Team Tactics (adv until your next turn — effect, NATIVE) | Aura of Violence (turn END damage), Bolster Inventions, Deathly Stench + Viral Aura (start-of-turn auras), Regeneration reprints (free), Decay | Dueling Ground, Recuperative Teleport (heal) |
| `EMANATIONS` (Spirit Guardians' shape) | Cacophonic Shield, Dirge, Doomtide (a sphere), Alustriel's Mooncloak (Half Cover status ships), Aura of Elemental Shielding (NATIVE effect) | Form of Dread aura, Wrath of the Wild | Lightning Ring, Spirit Lantern, Zone of Amicability (OUT, social), Waves of Exhaustion, Transfix |
| Spells slice tables (`CHOSEN_AREAS`, `SPENT_AREAS`, `REPEAT_SAVES`, `DAMAGE_SAVES`) | Laeral's Silver Lance ("each creature of your choice"), Spellfire Storm, Wardaway, Syluné's Viper | Jolt to Life | Wail of the Banshee ("up to ten"), Entrancing Mirrors / Uncertain Footing ("up to three"), Grave Ground + Distorted Distance (placed areas), Hypnotic Presence (repeat save), Catnap, Festering Blast, Wither and Bloom, Enervation, Negative Energy Flood, Detonate, Vision of Elapsing Eons, Fractured Awareness, Inflict Doubt |
| Measured cover | Spellfire Flare (ignores Half / Three-Quarters Cover), Holy Star of Mystra (Three-Quarters Cover status) | Empowered Channeling (Half Cover) | — |
| `DAMAGE_SHIELDS` | Death Armor (keyed already) | Retaliate reprints (Ebonbane, the Dilisnyas) | — |
| `COATINGS` / ammunition (the DMG's injury-poison shape) | — | — | Goading Ammunition ×5 (save on hit, no Reactions), Dispelling Ammunition ×5 (OUT — dispel), Magical Ammunition (Arcane Archer 7) |
| `DRAINS` | — | Life Drain / Proboscis reprints (free), Drink Sapience, Consume Energy | Brain Drain |
| Hit menu (`HIT_OPTIONS` — a group row + option rows, the Session 0 shape) | Strike Fear's Terrify (a Cunning Strike option — its `from` row exists; check the option row) | — | **Arcane Shot** — see 5.2 |

### 5.2 Small tables / kinds (one afternoon each unless noted)

| What | Shape | Precedent | Books |
| --- | --- | --- | --- |
| **Arcane Shot** (8 options, 2 uses, the Arcane Shot Die) | a hit-menu GROUP row (pool = Arcane Shot uses) + 6 option rows that add dice and press a save (Beguiling, Banishing, Enfeebling, Grasping, Shadow, Bursting); Piercing and Seeking Shot replace the attack roll with a save — TEXT | `HIT_GROUPS` / `HIT_OPTIONS` (Cunning Strike, Brutal Strike); `SAVE_PRESSES` for the conditions | Arcana |
| **The Bloodied moment** | a feature fires when a creature BECOMES Bloodied (Harvest Undead on self; Bloodthirst on an enemy within 30 ft; Sentinel at Death's Door's "Bloodied creature") | `judge: "bloodied"` is a STATE the gate reads today; the transition is one new flag key, classified in `decide/moments.js` (`tools/check-moments.mjs` fails the build otherwise) | Arcana, Faerûn, Ravenloft |
| **Initiative-time rows** | reroll Initiative on 9 or lower (Hypervigilance); regain a use on Initiative (Ever-Ready Shot); Rallying Cry (Purple Dragon Rook) | `INITIATIVE_SWAPS` is the initiative-time table | Ravenloft, Arcana, Faerûn |
| **A companion dropping to 0** | Vestige Recovery (a Reaction + a Pact slot sets the companion to its max HP); Refined Reanimation | the drop machine, read on the COMPANION's actor with the owner as the reactor | Arcana, Ravenloft |
| **Evolving magic items** | the item's enchantment tier changes its rows (Keyholes Dagger's Three/Five/Seven, Blossom Rod, Wave-Swept, Staff of Skulls) | `wieldsAs` enchantment reader (the DMG's enchanted weapons, cbc4b02) — measure first (§4.4) | Arcana |
| **Half-damage + crit cancel** | Sentinel at Death's Door: halve the damage AND the hit can't be a Critical Hit | `INTERRUPT_REDUCTIONS` + the Adamantine Armor crit-cancel path | Ravenloft |

### 5.3 OUT or held — one line each, not re-opened

- **Summons-shaped**: Vestige Companion, Reanimated Companion (+ Strange / Macabre Modifications), Battle Familiar, Summon
  Plant / Dinosaur, Conjure Constructs, Deryan's Helpful Homunculi, Spirit Lantern's fragments → the summons proposal
  (GitHub issue #1). Nothing here until that ruling.
- **Cast-triggered**: Modify Magic, Split Enchantment, Empowered Transmutation, Spellfire Burst's trigger clause, Boon of
  Erupting Spellpower, Dispelling Recovery, Absorb Spells → the held kind (BACKLOG *Scoped out for good*).
- **Redirect**: Redirect Attack (Viktra Mordenheim), Venger's "force an attack on his mount to target him" → the held kind.
- **Platform-native / the sheet's**: savants, spell lists, proficiencies, telepathy, speeds and forms (Ghost Walk, Umbral
  Form, Frozen Haunt, Transmuter's Stone — their effects ship), Bladesong, Genie's Splendor (AC formula), resistances.
- **Narrative**: mist talismans (53), soul trinkets (13), the Tarokka, factions and renown, bastions, backgrounds, Living
  Spells as a DM procedure (their stat blocks are bestiary rows and ARE in).
- **Epic boons** (Faerûn 13, Arcana 3): PARKED, not out — the user's "add epic boons to the backlog" (BACKLOG *Features*, *The epic boons — every book's*): a level 19+ slice of their own after the splat books.

## 6. Proposed order (rapid mode — register, rows, own suites, a minor bump per book)

| # | Book | Why here | Rough size |
| --- | --- | --- | --- |
| 0 | **Prework commit** | the Survivor collision fix; the offline reader into `tools/`; the three books ranked in the classifier; a per-book renderer; BACKLOG 5b moved before 3.0 + RULINGS the order | half a session |
| 1 | **Heroes of Faerûn → v2.12.0** | smallest, half-keyed, the house's longest-held splat book; the register is the main gap | ~35 rows · the Bloodied moment · initiative rows |
| 2 | **Ravenloft → v2.13.0** | player side (species, 7 subclasses, 11 feats, 5 dark gifts) then the bestiary — the MM reprints are free, ~40 new monster rows on Slice B's shapes | ~50 rows · the companion-drop reaction · crit-cancel interrupt |
| 3 | **Arcana Unleashed → v2.14.0** | the biggest and most UI-shaped (Arcane Shot's hit-menu group, 8 school subclasses, 33 spells, 38 combat items incl. evolving ones) — last so the smaller books prove the pattern first | ~60 rows · Arcane Shot group · evolving-item reader |
| 4 | **The 3.0 floor battery**, docs frame lines, the user cuts v3.0.0 | | |

Each book's register goes in `audits/` the way the DMG's did (NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS,
precedent named), generated by a per-book auditor from the offline corpus.

## 7. Questions to rule (answers change the plan; defaults in bold)

1. **Order** — Faerûn → Ravenloft → Arcana as above, or Arcana first (the newest book, the richest player side)?
2. ~~Epic boons~~ — RULED 2026-10-01: parked in BACKLOG as their own slice (every book's), not part of this one.
3. **Bestiaries** — **both in by name** (the MM precedent), including Ravenloft's `fallback-actors` (54 MM-shaped reprints)?
4. **Summons-shaped features** — **park on issue #1** (one summons machine later) rather than per-feature rows now?
5. **Versioning** — **one minor per book** (2.12 / 2.13 / 2.14), or one 2.12 "the splat books"?
6. **The Survivor fix** — ship it on its own ahead of the slice (a defect on prod today for any Ravenloft Survivor
   holder) or with book 2?

## 8. Regenerating the evidence

```
node tools/scan-corpus-offline.mjs dist/splat-corpus.json dnd-arcana-unleashed dnd-heroes-faerun dnd-ravenloft-horrors-within
node tools/classify-corpus.mjs dist/splat-corpus.json
node tools/audit-splat-books.mjs dist/splat-corpus-classified.json dist/splat-corpus.json
```

Offline, seconds, no bridge. The LevelDB copies land in the OS temp folder and are disposable.
