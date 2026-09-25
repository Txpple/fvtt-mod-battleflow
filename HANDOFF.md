# HANDOFF.md — the Slice A walk: species and origin feats, by hand, on the sandbox

> **A commission, written 2026-09-25 on the user's word** ("create a bunch of NPC chars of every
> race so I can test all the origin feats and species abilities. then prepare a handoff"). It is
> retired when the walk's findings are fixed and the docs recut (BACKLOG's header rule). ⚠ **It
> is not a "go"**: the walk is the USER's, at the sandbox; Claude's part is the fix pass after,
> on the user's go. The standing cycle holds ([BACKLOG.md](BACKLOG.md) header).

---

## 0. Where things stand (2026-09-25, night — six species done, the Halflings next)

**Next session: open with the Halfling's test table (§6 has it drafted) and let the user walk.**
The user's words at the break: *"all looks good, finish up tests, prepare for handoff starting
with halflings"*. Aasimar, Dragonborn, Dwarf, Elves, Gnomes and Goliaths are DONE (§5).

| | |
| --- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5. Untouched. |
| **main** | Slice A plus every walk fix so far — the Aasimar's `e600143`/`b0fe7ac`, Token Senses `804bb01`, Pass without Trace `ccf8d15`, Card Chips/Tinker `0baeaea`→`032732c`, and the Goliaths' `30c661b` (counts, Token Sizes, Rebukes, Stone's Endurance on any damage, Powerful Build) → `6a0b370` (a cast's damage roll carries its card's targets) → `ff7333d` (Stone's Endurance: one popup, the click lands it reduced) — **not pushed, not released**. Vendor Fixes `99fa7e6` (VF-002) and `637c32e` (VF-003) likewise local and unreleased. |
| **The sandbox** | runs **main** and Vendor Fixes' `main` (both deployed `--local`, byte-identical). Settings CLEAN (`verify-settings`, after the Goliath suites). The server was bounced at the user's word (a PROCESS restart — Vendor Fixes' `module.json` change is picked up now too). **Party Camp** holds the roster (§1) plus **BF Test Grappler (Giant Constrictor Snake)** — Huge; its Constrict is a Str save → damage + Grappled (Powerful Build, the rebukes, Stone's Endurance on save damage, Hill's Tumble's "too large"). The **Practice Dummy** (actor `yqjbotCYAwbcmP0v`, both tokens) carries MM **Stench Spray** (Poisoned), **Charm** (Charm Person — Charmed) and, for the Halfling's Brave, **Horrific Visage** (Wis save, Frightened). The Dragonborn carries a hand-added Fire Breath Weapon + Fire resistance. The Stone Goliath's token was moved to x 3500, y 1400 during the walk (not by the module). ⚠ `smoke-aasimar` (like `smoke-savage`) removes BF Test Halfling's and BF Test Victim's fixture tokens from the Test Range — run `fixture-suite` before any other suite. |
| **Suites** | The Goliaths' ran on the bounced box, sole GM: `smoke-goliath` **7/7**, `smoke-superiority §1,§12` **11/11**, `smoke-hitmenu §12,§13` **5/5**. Token Senses, Pass without Trace and Tinker ran none (measured by probe, walked) — owed to the end-of-iteration battery (§3), which also owes every suite the Goliath pass touched beyond those (`battery.mjs --changed --list`: `auto-apply.js` and `shared.js`'s neighbours reach wide). |
| **Docs** | RULINGS *The Aasimar walk* + the register (four rows since the Goliaths), SWEEP §6, BACKLOG, ARCHITECTURE moments, this file's §5. The Dwarf/Elf/Gnome/Goliath rulings live in the commit messages and §5 until the end-of-iteration recut writes them into RULINGS (and ARCHITECTURE gains `registerDamageClaim` beside the offer's parts). |
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
| BF Species Goliath (Hill) | **Hill's Tumble** — Prone on a hit, Large or smaller, no save | Guard → **Alert** | the HIT MENU's Giant Ancestry group: one row, "3 of 3 uses left", greyed "too large" on a Huge target (the Grappler snake); one pick per hit — **WALKED** |
| BF Species Goliath (Stone) | **Stone's Endurance** — Reaction, reduce damage by 1d12 + CON | Wayfarer → **Lucky** | ONE popup "Reaction — Stone's Endurance" ("a Reaction · N of 3 uses left"), the click rolls 1d12 + CON in the open and the damage lands reduced, receipted — on an attack hit (the hold) AND any other damage the module applies (`damage-holds.js`); card-button damage stays by hand (RULINGS' register). Also Lucky's rescue row beside it — **WALKED** |
| BF Species Goliath (Storm) | Storm's Thunder — Reaction 1d8 thunder | Scribe → **Skilled** | the REBUKES table (`rebukes.js`): a popup when a creature within 60 ft damages it; Use lands the thunder on the damager — **WALKED** |
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
| **Goliaths** (Cloud, Fire, Frost, Hill, Stone, Storm) | **DONE 2026-09-25** (user: "all looks good"). Pass 1 walked ("everything else is good"); five findings, **pass 2 BUILT** and walked the same day: the boon counts shown ("2 of 3 uses left" on the hit-menu row and the Stone's Endurance popup — the data was always @prof; the popup's "a Superiority Die" was hard-coded); **Large Form** resizes the token (the new **Token Sizes** table/list, Enlarge/Reduce beside it — the pack effect gains `token.width/height` + `system.traits.size`); the **Rebukes** table/list + `rebukes.js` (Storm's Thunder, Hellish Rebuke, Fount of Moonlight, Retaliation, Sword of Answering — a popup to the damaged creature when its dealer stands within the reaction's own range, read off the activity: 60 ft); **Stone's Endurance on any damage** (ruled "Hold before it lands", `damage-holds.js` claims the share at `auto-apply.js`'s new `registerDamageClaim` seam and asks in ONE popup, the click landing the damage reduced (an automatic no-popup version was built on a misreading and reverted the same hour — user: "the popup for stones endurance should show up, and if hte person rolls, then the damage is auto reduced"); the walk's double popup was the save damage reaching the applier twice, now one claim per share; Storm's Thunder's thunder had landed on the Storm Goliath — the damage roll took the client's live targets, now it carries the use card's); **Powerful Build** (ruled "Build a proxy": Advantage on Athletics/Acrobatics while Grappled, `EFFECT_BENDS` `checksWhen`). Three register rows in RULINGS. Party Camp gained **BF Test Grappler (Giant Constrictor Snake)** (Huge; its Constrict is a Str save → damage + Grappled): the Powerful Build scenario, a Storm's Thunder / Stone's Endurance damager, and Hill's Tumble's "too large" target. `smoke-goliath` written (4 sections), NOT yet run — it needs the box to itself. The boons' mid-walk refills (Fire+Frost 18:27:23, Hill+Stone 18:30:38) were the user's own script ("i topped them off with a scrpt") — Hill's Tumble's "not decrementing" was that, not a defect. |
| **Halfling** | **DONE 2026-09-25** (user: "works now, lucky done. lets move to the next race"). **Lucky's Advantage half BUILT** on the user's word ("we need to unpark the advantage on our own d20"; ruled off the prototype lucky-advantage.html, "looks good"): the gate's buy box — "Lucky — 1 Luck Point · N left" with an Advantage tick in any attack, save, check or initiative dialog; the tick counts in the net and the default; spent when the roll goes out ticked with the net pressed; a shift-click meets no box. Initiative with no dialog (the carousel, Roll All) — ruled "After the roll": the `advantage` D20 fold offers a second d20, the higher standing (a register row); its popup reads "Initiative: 13" with "Roll another d20 for Advantage, the higher stands" (user: the "ask your DM" line was wrong for initiative — fixed for Ambush too). The walk ran on the Tiefling (Infernal) with Lucky added and Remarkable Athlete's effect disabled (every Champion's initiative is already at Advantage, where the fold stands aside by design). `smoke-lucky` (7 sections) WRITTEN, NOT RUN — the user was on the box; owed with the end-of-iteration battery. The user removed several roster actors for lag. |
| **Human** | **DONE 2026-09-25** (user: "works, human done"). **Resourceful BUILT** on the user's word ("human i think just needs initiatve to be ticked on long rest" — the Heroic Inspiration box): the new **Rest Grants** table/list + `rest-grants.js` — the grant rides the rest's own actor update (`dnd5e.preRestCompleted`), the rest card says "Resourceful — Heroic Inspiration gained"; a Short Rest gives nothing. Skillful and Versatile native; Musician out of combat. `smoke-rest` (3 sections) WRITTEN, NOT RUN — owed with the end-of-iteration battery. |
| **Orc** | **DONE 2026-09-25** (user: "looks good"). Adrenaline Rush walked earlier (user: "rush was already done earlier"). **Relentless Endurance BUILT with Death Ward** on the user's word ("if sometihng takes them to zero, then a popup should ask to use the feat. same shape as death ward which you should do now too"): the new **Drop to 1 HP** table/list + `drop-to-one.js` — at `dnd5e.preApplyDamage` the HP is written as 1 in the damage's own update; Relentless Endurance asks (held at 1; Drop to 1 HP spends the use, Drop to 0 or the clock lands the 0; never against an outright kill); Death Ward automatic (its Protection from Death effect removed, a card). A register row (sheet-typed HP goes around it). `smoke-drop` (5 sections) WRITTEN, NOT RUN. |
| Tiefling | not yet walked |

**For the release:** Vendor Fixes gets a release too (v1.1.0 — VF-002, VF-003); a released world needs
Reset Defaults on the **Emanations** (now with Pass without Trace), **Clock Riders**, **Effect Sources** (Powerful Build) and new **Token Lights**, **Token Senses**, **Token Sizes**, **Rebukes** and **Card Chips** lists as well.

## 6. The Halfling — the table to open with (drafted 2026-09-25, re-read before use)

**BF Species Halfling** (Fighter 5 Champion; a Longsword and a Longbow), Merchant → **Lucky**
(3/3 Luck Points). Read on the sandbox at the break: Brave, Halfling Nimbleness, Luck, Naturally
Stealthy and Lucky all present; `flags.dnd5e.halflingLucky` and `halflingNimbleness` set. The
Practice Dummy's new **Horrific Visage** is the Frightened demand for Brave (use it from the
Dummy's sheet with the Halfling targeted).

| Trait | What you should see |
| --- | --- |
| **Brave** | The Dummy's *Horrific Visage* at the Halfling: the save demand's roll dialog COUNTS Advantage — the box says "BF Species Halfling — Brave — against Frightened", Advantage the default. A Wisdom save rolled from the sheet with no demand LISTS Brave, not counted (a bend in RULINGS' register: the repeat save to end it). |
| **Luck** | Native: a natural 1 on a d20 test (attack, check, save) is rerolled by the system itself — the roll shows the reroll (`r1`). Nothing of the module's. |
| **Halfling Nimbleness** | Native (a sheet flag): moving through a larger creature's space — nothing enforces it or stops it; nothing to walk. |
| **Naturally Stealthy** | OUT: hiding behind a larger creature is the table's. Expect nothing. |
| **Lucky** — Disadvantage on an attack against you | Attack the Halfling and HIT (a Goliath's Longsword, or the snake): the Halfling's popup *Lucky — BF Species Halfling* with the row "Lucky · 1 Luck Point · 3 left"; Answer → a second d20 with the attack's own modifiers, the LOWER stands, the verdict re-runs (a natural 20 can be undone); the attacker's card says "Lucky bent the roll — Disadvantage, 17 → 13, MISS"; a point spent. At 0 points the row greys "no Luck Points left". ⚠ An attack rolled with Advantage cancels to the FIRST die (the register). |
| **Lucky** — Advantage on your own d20 | PARKED: spend the point from the sheet and pick Advantage in the roll dialog yourself. Expect no prompt. |

**Likely questions to rule before building:** Lucky's Advantage half as an offer (a popup before
the Halfling's own attack or save, like Heroic Inspiration's fold) rather than the sheet — parked
since Slice A, the user's call to unpark.
