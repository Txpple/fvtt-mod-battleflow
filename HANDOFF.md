# HANDOFF.md — the Slice A walk: species and origin feats, by hand, on the sandbox

> **A commission, written 2026-09-25 on the user's word** ("create a bunch of NPC chars of every
> race so I can test all the origin feats and species abilities. then prepare a handoff"). It is
> retired when the walk's findings are fixed and the docs recut (BACKLOG's header rule). ⚠ **It
> is not a "go"**: the walk is the USER's, at the sandbox; Claude's part is the fix pass after,
> on the user's go. The standing cycle holds ([BACKLOG.md](BACKLOG.md) header).

---

## 0. Where things stand (2026-09-25, late — five species done, the Goliaths next)

**Next session: open with the Goliaths' test table (§6 has it drafted) and let the user walk.**
The user's words at the break: *"looks good. lets move on to goliate. make a handoff where we
will continue there"*. Aasimar, Dragonborn, Dwarf, Elves and Gnomes are DONE (§5); the six
Goliaths were read on the sandbox at the break — every Giant Ancestry boon, Large Form and origin
feat present (no skipped creation choice, unlike the Dragonborn's).

| | |
| --- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5. Untouched. |
| **main** | Slice A plus every walk fix so far (the Aasimar's `e600143`/`b0fe7ac`, then Token Senses `804bb01`, Pass without Trace `ccf8d15`, Card Chips/Tinker `0baeaea`→`032732c`) — **not pushed, not released**. Vendor Fixes `99fa7e6` (VF-002) and `637c32e` (VF-003) likewise local and unreleased. |
| **The sandbox** | runs **main** and Vendor Fixes' `main` (both deployed `--local`, byte-identical). Settings CLEAN after the Emanations row (`verify-settings --fix`, 2026-09-25); the Token Senses and Card Chips lists have never been stored (their defaults stand). **Party Camp** holds the roster (§1). The **Practice Dummy** (actor `yqjbotCYAwbcmP0v`, both tokens) now carries MM **Stench Spray** (Poisoned demand) and MM **Charm** (Charm Person — Charmed demand) for the save-gate walks. The Dragonborn carries a hand-added Fire Breath Weapon + Fire resistance (its ancestry choice had been skipped). World time was advanced 11 minutes by a probe. ⚠ Vendor Fixes' `module.json` description changed (VF-003) — a PROCESS restart picks it up (cosmetic; the user's call). ⚠ `smoke-aasimar` (like `smoke-savage`) removes BF Test Halfling's and BF Test Victim's fixture tokens from the Test Range — run `fixture-suite` before any other suite. |
| **Suites** | Per the FAST loop no suite ran for Token Senses, Pass without Trace or Tinker — each was measured by a second-client probe and walked by the user. They are owed to the end-of-iteration battery (§3), with new suite sections if the battery shows a gap. |
| **Docs** | RULINGS *The Aasimar walk* (+ one register row), SWEEP §6, BACKLOG, ARCHITECTURE moments, this file's §5. The Dwarf/Elf/Gnome rulings live in the commit messages and §5 until the end-of-iteration recut writes them into RULINGS. |
| **Owed by the user** | the walk, race by race (§5); the 46-row event audit (`slice-a-event-audit.md`, scratchpad `cbaa0dd3…`); the release call; the Savage popup's rank (DESIGN §8). |
| **Owed by Claude** | the fix pass for each race as the user reports it — the FAST loop (§3). |

--- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5. Untouched. |
| **main** | Slice A plus the Aasimar walk's fixes (`e600143`, and the invisible-area commit after it) — **not pushed, not released**. Vendor Fixes `99fa7e6` (VF-002) likewise local and unreleased. |
| **The sandbox** | runs **main** and Vendor Fixes' `main` (both deployed `--local`, byte-identical). Settings CLEAN (the Clock Riders and Emanations lists restored with the new rows — a released world needs the same Reset Defaults, §4). **Party Camp** holds the roster (§1). ⚠ `smoke-aasimar` (like `smoke-savage`) removes BF Test Halfling's and BF Test Victim's fixture tokens from the Test Range — run `fixture-suite` before any other suite. |
| **Docs** | RULINGS *The Aasimar walk* (+ one register row), SWEEP §6, BACKLOG, ARCHITECTURE moments, this file's §5. |
| **Owed by the user** | the walk, race by race (§5); the 46-row event audit (`slice-a-event-audit.md`, scratchpad `cbaa0dd3…`); the release call; the Savage popup's rank (DESIGN §8). |
| **Owed by Claude** | the fix pass for each race as the user reports it — the FAST loop (§3). |

---

## 1. The roster — `BF Species *`, Actor folder **BF Species**, tokens on **Party Camp**

Twenty level-5 characters built through dnd5e advancement (`create-pc`: class + species + background), so every species trait and every origin feat is the PACK's own item, granted the way a player's would be. All Fighters (Champion) with a Longsword, except the Forest Gnome (a Cleric with a Mace and Cure Wounds / Healing Word / Bless / Prayer of Healing / Mass Healing Word, for Healer's spell rerolls). AC 12, no armor — targets hit easily on purpose. The two **Practice Dummies** on the scene are the targets; the PCs' tokens are gone from the scene (the actors are untouched).

| Actor | Species traits to test | Background → origin feat | What Slice A built for it |
| --- | --- | --- | --- |
| BF Species Aasimar | Healing Hands, Celestial Revelation (three forms) — **WALKED 2026-09-25, fixes built** (§5) | Wayfarer → **Lucky** | Lucky's Disadvantage = a `roll` rescue row on the defender's popup after a hit (Rescue the hit — name); Lucky's Advantage half PARKED (the sheet: spend the point, pick Advantage in the roll dialog) |
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
7. **What should read as parked/held, not broken:** Healer's spell rerolls (the Forest Gnome's Cure Wounds), Relentless Endurance (the Orc at 0 HP), Lucky's Advantage half (the sheet). BACKLOG has each with its trigger. (Inner Radiance's pulse and Celestial Revelation's extra damage were BUILT in the walk — §5.)

**Report findings the usual way** (the walk-session restate rule: the OPEN list restated after every update). Each finding is then a fix-pass item on the go.

---

## 3. For Claude, on the go after the walk

- ⚠ **THE PER-RACE LOOP IS FAST** (user, 2026-09-25: *"if im waiting for 30 min tests each race it will take forever"*; *"you are NOT to do a fully battery until we finish our iteration on species and origin feats"*): per race — the rulings the user makes (ask with options where the rule leaves a choice), the code, `npm run verify` (static gate + unit tests), `deploy-house-module --local`, and ONLY that race's own new suite or section (`smoke-<race>.mjs`, minutes). Then hand the sandbox back: the user walks while Claude waits. **No regression runs of other suites per race, even when `--changed` says "full"** — the cross-suite batch runs once at the end of the species/origin-feat iteration.
- Each race opens with a **Trait | What you should see** table (the user's format); the OPEN list is restated after every update; confirmed items drop off.
- A pack DATA defect goes to **Vendor Fixes** (`../fvtt-mod-vendorfixes`, REGISTER.md + a `scripts/patches/` file, never a crutch for module gaps); Misc Patches is retired. After a test run, `verify-settings` must read CLEAN (a new list row means the sandbox's stored list drifts — `--fix`).
- ⚠ The harness lessons of 2026-09-24/25 (NOTES §5): a killed run must be followed by `verify-settings --fix` → `reset-fixture-state` → `fixture-suite` (the battery now sweeps first by itself); launch batteries DETACHED; a second Claude session's MCP bridge blocks every suite's preflight.
- **Cleanup of this roster is the user's call** — it lives in the sandbox only (Actor folder BF Species, tokens on Party Camp); a prod pull wipes it like every fixture.
- Docs recut at the end; retire this file; BACKLOG's header records the retirement.

## 4. The release, whenever the user calls it

Prod v2.0.8 → the Slice A release (a minor version: new tables and a new kind, no break). Beyond the deploy: a world with STORED lists never picks up new rows — prod needs Reset Defaults (or `verify-settings --fix` against prod's reference) on **Effect Sources** (Brave, Fey Ancestry, Dwarven Resilience), **Hit Menu** (Hill's Tumble), **Clock Riders** (Fire's Burn, Frost's Chill), **Interrupts** (Lucky:roll, Warding Flare:roll, Shadowy Dodge:roll), and the new **Damage Rolled Twice** list (Savage Attacker) registers itself. The zip route (bsdtar) as in the prod-state memory; a process restart is the user's.

## 5. The walk as it goes (the user's order, 2026-09-25)

**Species by species, then the origin feats.** Each species opens with a *Trait | What you should
see* table (the user's ask); the OPEN list is restated after every update. ⚠ **No full battery
until the species and origin-feat iteration is finished** (user, 2026-09-25) — a fix runs only the
suites of the machines it touched, even when `--changed` says "full".

| Species | State |
| --- | --- |
| **Aasimar** | **DONE 2026-09-25** (user: "everything else looks good" → "we are done with aasimar"); five findings ruled and BUILT, plus a sixth: every area placed on a token is never drawn (user: "it can be invisible, just like inner radiance") (RULINGS *The Aasimar walk*): every self-centered area placed on the token; an `enemy` area asks no ally; Necrotic Shroud's Frightened to the end of the Aasimar's next turn (**Vendor Fixes VF-002**); Inner Radiance's ring, turn-end pulse and light (the new **Token Lights** table, with the Light spell on a targeted token); Celestial Revelation's extra damage (a rider on hits, a one-target pick on a spell). `smoke-aasimar` 29/29 on the sandbox. Lucky waits for the origin-feat round. |
| **Dragonborn** | **DONE 2026-09-25** (user: "looks good"); no findings. The roster's Draconic Ancestry choice had been skipped at creation — the pack's Fire Breath Weapon and Fire resistance added by hand (Red). Savage Attacker waits for the origin-feat round. |
| **Dwarf** | **DONE 2026-09-25** (user: "all else is good" → "it works now") — Stonecunning BUILT on the user's word ("just run it always and assume stone ... change the vision type to tremor sense for the duration"): the new **Token Senses** table/list adds Tremorsense vision (60 ft) and Feel Tremor detection (60 ft) to the pack's own Stonecunning effect as it is created. The Practice Dummy carries MM **Stench Spray** (Dex save, Poisoned on a failure) for Dwarven Resilience's save gate. |
| **Elves** (Drow, High, Wood) | **DONE 2026-09-25** (user: "elves done") — the Practice Dummy also carries MM **Charm** (casts Charm Person: Wis save, Charmed) for Fey Ancestry's save gate. **Pass without Trace BUILT** on the user's word ("should have an enamation similar to the paladin one, but gratns +10 stealth, should use the saem shape"): an Emanations row (spell, helpful, the pack's Concealed effect) + **Vendor Fixes VF-003** (the pack's spell carries no area — given its 30-foot Emanation in memory). |
| **Gnomes** (Forest, Rock) | **DONE 2026-09-25** (user: "looks good") — Gnomish Cunning is the pack's own effect (roll.mode on INT/WIS/CHA saves); the Practice Dummy's Charm (Wis) exercises it. **Tinker BUILT** on the user's word (a button on the Prestidigitation card; "just give a buff called tiny clockwork device ... the rest is played at table"): the new **Card Chips** table/list — the Rock Gnome's Prestidigitation card offers *Build a Tiny Clockwork Device*; then reworked on the walk ("id like a popup to create the clockwork with x/3 remaining ... additional chits, to max 3 ... if a person has 3 already, do a popup saying to remove a clockwork first"; "the too many devices should be gated behind the choice"): the cast ASKS in a popup (*Build it* / *Not now*, N of 3 remaining); each device is its own chip (flag `stacks` — the twin-chip dedupe in effect-riders.js had been deleting every newer same-name chip); choosing to build at three opens a remove-one-first popup; the card's button recalls the ask. |
| **Goliaths** (Cloud, Fire, Frost, Hill, Stone, Storm) | **Pass 1 walked 2026-09-25** (user: "everything else is good"); five findings, **pass 2 BUILT** the same day, walk pending: the boon counts shown ("2 of 3 uses left" on the hit-menu row and the Stone's Endurance popup — the data was always @prof; the popup's "a Superiority Die" was hard-coded); **Large Form** resizes the token (the new **Token Sizes** table/list, Enlarge/Reduce beside it — the pack effect gains `token.width/height` + `system.traits.size`); the **Rebukes** table/list + `rebukes.js` (Storm's Thunder, Hellish Rebuke, Fount of Moonlight, Retaliation, Sword of Answering — a popup to the damaged creature when its dealer stands within the reaction's own range, read off the activity: 60 ft); **Stone's Endurance on any damage** (ruled "Hold before it lands", then on the pass-2 walk "the rule should be stones endurance reduces automatically": `damage-holds.js` claims the share at `auto-apply.js`'s new `registerDamageClaim` seam and reduces it by itself — no popup, attack hits included; the walk's double popup was the save damage reaching the applier twice, now one claim per share; Storm's Thunder's thunder had landed on the Storm Goliath — the damage roll took the client's live targets, now it carries the use card's); **Powerful Build** (ruled "Build a proxy": Advantage on Athletics/Acrobatics while Grappled, `EFFECT_BENDS` `checksWhen`). Three register rows in RULINGS. Party Camp gained **BF Test Grappler (Giant Constrictor Snake)** (Huge; its Constrict is a Str save → damage + Grappled): the Powerful Build scenario, a Storm's Thunder / Stone's Endurance damager, and Hill's Tumble's "too large" target. `smoke-goliath` written (4 sections), NOT yet run — it needs the box to itself. The boons' mid-walk refills (Fire+Frost 18:27:23, Hill+Stone 18:30:38) were the user's own script ("i topped them off with a scrpt") — Hill's Tumble's "not decrementing" was that, not a defect. |
| Halfling → Tiefling | not yet walked |

**For the release:** Vendor Fixes gets a release too (v1.1.0 — VF-002, VF-003); a released world needs
Reset Defaults on the **Emanations** (now with Pass without Trace), **Clock Riders**, **Effect Sources** (Powerful Build) and new **Token Lights**, **Token Senses**, **Token Sizes**, **Rebukes** and **Card Chips** lists as well.

## 6. The Goliaths — the table to open with (drafted 2026-09-25, re-read before use)

Six **BF Species Goliath** characters (Fighter 5 Champion, Longsword), one per Giant Ancestry.
Each carries its ancestry boon (**3/3** uses — PB per Long Rest), **Large Form** (1/1) and
**Powerful Build**; their origin feats (Tavern Brawler, Savage Attacker, Tough, Alert, Lucky,
Skilled) wait for the origin-feat round. The Slice A machines: Fire's Burn and Frost's Chill are
CLOCK RIDERS, Hill's Tumble a HIT-MENU press, Stone's Endurance an INTERRUPT reduction (§1, §2).
Targets: the Practice Dummies (Medium); for "too large", a Huge creature is needed (none on
Party Camp — make one from the MM on the user's say, or skip the row).

| Trait | What you should see |
| --- | --- |
| **Fire's Burn** (Fire) | Hit a dummy: the damage offer shows a ticked *Fire's Burn* checkbox ("on any hit, while its uses last"); the card says *Fire's Burn — 1d10 fire rode this roll*; a use spent (3 → 2). Untick it: no fire, no use. At 0 uses the box does not offer. |
| **Frost's Chill** (Frost) | As Fire's Burn with 1d6 cold, plus **Chilled** (−10 ft Speed) on the target, its clock the start of the Goliath's next turn — the effect bar shows it and it lapses then. |
| **Hill's Tumble** (Hill) | Hit a dummy: the hit menu opens with the *Giant Ancestry* group, the row *Hill's Tumble · 1 use*; pick it → the target is Prone, receipted, no save; a use spent. One pick per hit. Against a Huge target the row greys *too large*. |
| **Stone's Endurance** (Stone) | Attack the Stone Goliath and hit: the popup *Reaction — Stone's Endurance*; Cast rolls 1d12 + CON in the open; the damage lands reduced with a receipt, a use spent, and NO heal at full HP. ⚠ Attack hits only — save/area damage stays by hand (a bend in RULINGS' register). Lucky's rescue row may sit beside it (origin-feat round). |
| **Storm's Thunder** (Storm) | Native: a Reaction damage activity (1d8 thunder at the creature that damaged it) — used from the sheet, the damage applied like any use. |
| **Cloud's Jaunt** (Cloud) | Native: the system's own teleport (Bonus Action, 30 ft) — the module never moves tokens; a use spent. |
| **Large Form** (all, character level 5) | Native: Bonus Action, the pack's *Large Form* effect on the Goliath for 10 minutes (size Large, +10 ft Speed, Advantage on Strength checks); once per Long Rest. Watch the token size — the pack's effect decides it. |
| **Powerful Build** | Native: the pack's effect (carrying capacity; Advantage to end Grappled). Nothing to walk in combat. |

**Likely questions to rule before building** (ask, with options): does Large Form resize the
TOKEN (Foundry 14's `token.width/height` changes, the Token Senses carrier) if the pack's effect
does not; and Storm's Thunder as a held reaction (a popup when the Goliath is damaged, like Stone's
Endurance) rather than a sheet use.
