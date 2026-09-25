# HANDOFF.md — the Slice A walk: species and origin feats, by hand, on the sandbox

> **A commission, written 2026-09-25 on the user's word** ("create a bunch of NPC chars of every
> race so I can test all the origin feats and species abilities. then prepare a handoff"). It is
> retired when the walk's findings are fixed and the docs recut (BACKLOG's header rule). ⚠ **It
> is not a "go"**: the walk is the USER's, at the sandbox; Claude's part is the fix pass after,
> on the user's go. The standing cycle holds ([BACKLOG.md](BACKLOG.md) header).

---

## 0. Where things stand (2026-09-25, morning)

| | |
| --- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5 — what the last session plays. Untouched. |
| **main** | `0c9b66d` + whatever this file's commit is, **31+ commits past the handoff of 2026-09-24, none released, not pushed.** Slice A is BUILT and PROVEN: the full battery is green on the final tree (every suite; smoke-hitmenu 45/45, smoke-metamagic 108/108, probe-effect-view 17/17 standalone on the fixed tools). |
| **The sandbox** | runs **main** (deployed `--local`, byte-identical at `d252397`; `0c9b66d` is docs only). Fixtures rebuilt with the home stamp; settings clean; no stray tokens. **Party Camp** holds the walk's roster (§1); the four PCs' tokens were removed from it on the user's word. |
| **Docs** | RULINGS carries *Where the table bends the rule* (11 rows) and the *Slice A*, *Rescuing the hit* and *Savage Attacker* sections; DESIGN §8, ARCHITECTURE, NOTES §4/§5, BACKLOG (the long-term order lives there), SWEEP §6 (the measured drawing), tools/README are recut. Release notes drafted in the session scratchpad (`release-notes-unreleased.md`; also summarised in §4). |
| **Owed by the user** | the manual audit of the 46-row event list (`slice-a-event-audit.md`, scratchpad `cbaa0dd3…`); the walk below; the release call; the Savage popup's rank (OPEN in DESIGN §8). |
| **Owed by Claude** | nothing until the walk reports. Then: the fix pass, the docs recut, this file retired. |

---

## 1. The roster — `BF Species *`, Actor folder **BF Species**, tokens on **Party Camp**

Twenty level-5 characters built through dnd5e advancement (`create-pc`: class + species + background), so every species trait and every origin feat is the PACK's own item, granted the way a player's would be. All Fighters (Champion) with a Longsword, except the Forest Gnome (a Cleric with a Mace and Cure Wounds / Healing Word / Bless / Prayer of Healing / Mass Healing Word, for Healer's spell rerolls). AC 12, no armor — targets hit easily on purpose. The two **Practice Dummies** on the scene are the targets; the PCs' tokens are gone from the scene (the actors are untouched).

| Actor | Species traits to test | Background → origin feat | What Slice A built for it |
| --- | --- | --- | --- |
| BF Species Aasimar | Healing Hands, Celestial Revelation (three forms) | Wayfarer → **Lucky** | Lucky's Disadvantage = a `roll` rescue row on the defender's popup after a hit (Rescue the hit — name); Lucky's Advantage half PARKED (the sheet: spend the point, pick Advantage in the roll dialog) |
| BF Species Dragonborn | Breath Weapon (save activity), Draconic Flight | Soldier → **Savage Attacker** | the popup on a weapon hit: tick, Roll again / Keep; the higher set stands; once per turn |
| BF Species Dwarf | Dwarven Resilience (Advantage vs Poisoned), Dwarven Toughness, Stonecunning | Farmer → **Tough** | the save gate counts Dwarven Resilience against a demand that imposes Poisoned (listed, not counted, on a repeat save to end it) |
| BF Species Elf (Drow) | Fey Ancestry (Advantage vs Charmed), Drow spells | Criminal → **Alert** | Fey Ancestry on the save gate (as above); Alert is native (initiative) |
| BF Species Elf (High) | Fey Ancestry, High Elf cantrip / Misty Step | Sage → **Magic Initiate (Wizard)** | native (spells run through the spell machines) |
| BF Species Elf (Wood) | Fey Ancestry, speed 35, Longstrider / Pass without Trace | Guide → **Magic Initiate (Druid)** | native |
| BF Species Gnome (Forest) — Cleric | Gnomish Cunning (native: the pack ships the effect), Minor Illusion, Speak with Animals | Hermit → **Healer** | Battle Medic native (r1 in the formulas); **Healing Rerolls on SPELLS is PARKED** (BACKLOG) — expect NO reroll of 1s on Cure Wounds; confirm it reads as parked, not broken |
| BF Species Gnome (Rock) | Gnomish Cunning, Mending / Prestidigitation | Artisan → **Crafter** | out of combat |
| BF Species Goliath (Cloud) | Cloud's Jaunt (teleport), Large Form, Powerful Build | Sailor → **Tavern Brawler** | Tavern Brawler is native (the pack's own Unarmed Strike activity rerolls 1s; its Push is OUT); Cloud's Jaunt native (the module never moves tokens) |
| BF Species Goliath (Fire) | **Fire's Burn** — 1d10 fire on any hit, PB uses | Soldier → **Savage Attacker** | a CLOCK RIDER: a ticked checkbox on the damage offer, no popup; uses counted on the item. ⚠ Both on one actor: the rider checkbox AND the Savage popup on the same hit — watch the order (Savage asks once the hit stands) |
| BF Species Goliath (Frost) | **Frost's Chill** — 1d6 cold + Chilled (−10 ft) until the start of your next turn | Farmer → **Tough** | a clock rider that also lands the Chilled effect on the target with the attacker's-next-turn clock |
| BF Species Goliath (Hill) | **Hill's Tumble** — Prone on a hit, Large or smaller, no save | Guard → **Alert** | the HIT MENU's Giant Ancestry group: one row, "1 use", greyed "too large" on a Huge target; one pick per hit |
| BF Species Goliath (Stone) | **Stone's Endurance** — Reaction, reduce damage by 1d12 + CON | Wayfarer → **Lucky** | INTERRUPT_REDUCTIONS (Parry's shape): the popup "Reaction — Stone's Endurance", the roll in the open, the reduction receipted; ⚠ attack hits only (save/area damage stays by hand — a bend in RULINGS' register). Also Lucky's rescue row beside it |
| BF Species Goliath (Storm) | Storm's Thunder — Reaction 1d8 thunder | Scribe → **Skilled** | native (a plain reaction damage activity) |
| BF Species Halfling | **Luck** (native: dnd5e rerolls the 1 itself), Brave (Advantage vs Frightened), Nimbleness | Merchant → **Lucky** | Brave on the save gate; Lucky's rescue row; a Longbow too — Lucky on a ranged hit against it |
| BF Species Human | Resourceful, Skillful, Versatile | Entertainer → **Musician** | out of combat |
| BF Species Orc | Adrenaline Rush, **Relentless Endurance** | Charlatan → **Skilled** | Relentless Endurance is HELD for Slice B's kill moment — expect nothing at 0 HP; confirm it reads as held |
| BF Species Tiefling (Abyssal) | Fiendish Legacy (poison resistance, spells), Otherworldly Presence | Guard → **Alert** | native |
| BF Species Tiefling (Chthonic) | Fiendish Legacy (necrotic) | Acolyte → **Magic Initiate (Cleric)** | native |
| BF Species Tiefling (Infernal) | Fiendish Legacy (fire) | Noble → **Skilled** | native |

**Not on the roster, by ruling:** Warding Flare (Light Cleric 1) and Shadowy Dodge (Gloom Stalker 15) are the `roll` kind's other two customers — smoke-rescue adds them to BF Test Halfling at run time; to walk them by hand, `add-feature` them onto any roster actor from `dnd-players-handbook.classes`. Arcana Unleashed's origin feats are the NEXT phase (SWEEP §6).

---

## 2. The walk — what to look at, in the order the machines fire

Use the Practice Dummies as targets (or a roster actor as a defender for the rescue rows). Everything below is a Slice A surface; the module's prior behaviour is the battery's business.

1. **The save gate (tier 1).** Cast something that imposes Frightened/Charmed/Poisoned at the Halfling / an Elf / the Dwarf (a Practice Dummy can't cast — use a PC or `request-roll`): the roll dialog's box should COUNT Advantage with the source line "<name> — Brave — against Frightened". A sheet save with no demand should LIST it, not count it.
2. **Stone's Endurance (tier 1).** Hit the Stone Goliath: the popup "Reaction — Stone's Endurance", Cast rolls 1d12+CON in the open, the damage lands reduced with a receipt, a use spent, NO heal at full HP (the old bug).
3. **The Giant Ancestry riders (tier 2).** Hit with the Fire Goliath: the damage offer shows the "Fire's Burn" checkbox ticked, "on any hit, while its uses last"; the card says "Fire's Burn — 1d10 fire rode this roll"; a use gone. The Frost Goliath: the same plus "Chilled" on the target until the start of the Goliath's next turn (the effect bar shows it with the clock).
4. **Hill's Tumble (tier 2).** Hit with the Hill Goliath: the hit menu opens with the Giant Ancestry group, the row "Hill's Tumble · 1 use"; pick → the target is Prone, receipted, no save. Against a Huge target the row is greyed "too large".
5. **Savage Attacker (tier 3).** Hit with the Dragonborn (or the Fire Goliath): after the hit stands, the popup "Savage Attacker — name": tick the row, Roll again → the card shows both sets, the loser struck, "the higher stands"; Keep the roll → nothing spent; a second hit the same turn: no popup, the tag "used this turn".
6. **The `roll` rescue (tier 3).** Attack a Lucky holder (the Halfling, the Aasimar, the Stone Goliath) and HIT: the defender's popup "Rescue the hit — name" (or "Lucky — name" when Lucky is the only row) with the row "Lucky · 1 Luck Point · N left"; Answer → the second d20, the lower stands, the verdict re-runs; a natural 20 can be undone; the attacker's card says "Lucky bent the roll — Disadvantage, 17 → 13, MISS". With the point spent, the row greys "no Luck Points left"; with every row spent, no popup. ⚠ Advantage attacks cancel to the FIRST die (a bend in the register).
7. **What should read as parked/held, not broken:** Healer's spell rerolls (the Forest Gnome's Cure Wounds), Relentless Endurance (the Orc at 0 HP), Lucky's Advantage half (the sheet), Inner Radiance's turn-end pulse and Celestial Revelation's extra damage (the Aasimar). BACKLOG has each with its trigger.

**Report findings the usual way** (the walk-session restate rule: the OPEN list restated after every update). Each finding is then a fix-pass item on the go.

---

## 3. For Claude, on the go after the walk

- The fix pass runs each change's OWN suites (`battery.mjs --changed --list` then `--changed`); the full battery was the release floor and is already green — do not re-run it for a fix.
- ⚠ The harness lessons of 2026-09-24/25 (NOTES §5): a killed run must be followed by `verify-settings --fix` → `reset-fixture-state` → `fixture-suite` (the battery now sweeps first by itself); launch batteries DETACHED; a second Claude session's MCP bridge blocks every suite's preflight.
- **Cleanup of this roster is the user's call** — it lives in the sandbox only (Actor folder BF Species, tokens on Party Camp); a prod pull wipes it like every fixture.
- Docs recut at the end; retire this file; BACKLOG's header records the retirement.

## 4. The release, whenever the user calls it

Prod v2.0.8 → the Slice A release (a minor version: new tables and a new kind, no break). Beyond the deploy: a world with STORED lists never picks up new rows — prod needs Reset Defaults (or `verify-settings --fix` against prod's reference) on **Effect Sources** (Brave, Fey Ancestry, Dwarven Resilience), **Hit Menu** (Hill's Tumble), **Clock Riders** (Fire's Burn, Frost's Chill), **Interrupts** (Lucky:roll, Warding Flare:roll, Shadowy Dodge:roll), and the new **Damage Rolled Twice** list (Savage Attacker) registers itself. The zip route (bsdtar) as in the prod-state memory; a process restart is the user's.
