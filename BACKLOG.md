# BACKLOG.md — known, deliberately not scheduled

> **What this file is:** things worth knowing about that **nobody owes anybody**. Each one was
> found, understood, and parked on purpose, with the reason and the thing that would un-park it.
>
> **What this file is NOT:** a to-do list. ⚠ **Nothing here blocks a release, a deploy or a
> battery, and nothing here is a defect waiting on someone.** If an item ever becomes owed it
> leaves this file and becomes a debt row in [ARCHITECTURE.md](ARCHITECTURE.md) §10 or a
> commission the user hands the next session — that register is the "owed" surface and this one
> is not. ⚠ **There is no standing handoff file, deliberately** (user call): a commission is
> written when there is one and retired when it is delivered, so nothing can quietly accumulate
> in it between passes.

**Why it exists.** These items used to live in the debt register and the handoff, which are read
at the top of every session and are written to be LOUD — that is what makes a real debt hard to
ignore. Carrying "we looked at this and decided not to" in the same voice made every session open
with a list of alarms that were not alarms. **The noise was costing more than the items.**

**Three files, three jobs, and keeping them apart is the point:**

| | |
| --- | --- |
| **This file** | *Not now, and here is why.* Awareness. Re-read when you are picking work. |
| [DESIGN.md](DESIGN.md) §8 *Settled* | *No, and here is what would change the answer.* **Closed** — a proposal that keeps coming back and should stop. ⚠ Moved there when the rescue-view commission was delivered (v1.24.0); it had outlived two temporary homes and the rulings are not temporary. |
| [ARCHITECTURE.md](ARCHITECTURE.md) §10 | *Owed, or repaid, with evidence.* The permanent record — the full argument for everything below still lives there. |

⚠ **Two of these are enforced by tooling and cannot rot in place.** The layer pins and the
coverage pins are **checked both ways**: repay the thing, or have the platform change under you,
and the build or the report says the pin is stale. **A backlog item here is quiet, not
unwatched** — which is exactly why it is safe to be quiet about it.

---

## Architecture

### The never-fired hook: `dnd5e.rollDeathSaveV2` (coverage gap, not a dead handler)

**What:** the D11 hook-coverage report has printed this line on every battery since the stat
plane shipped, and its own instruction is *"do not let a line sit here unexplained across two
releases."* This is the explanation, so the next session does not re-investigate it from scratch.

**Verdict: a genuine coverage gap.** Both halves were checked on 2026-09-01. The hook NAME is
real — it is in `tools/dnd5e-hooks.json`, the system’s own reference — so this is **not** the
`rollToolV2` class of bug, where v1.23.0 registered a hook that never existed and nothing noticed
for a release. And the registration is live: `stats.js` lists it among `D20_TEST_HOOKS`, which is
what stamps `rollCtx` on every d20 test message.

**Why it never fires:** nothing in the battery drives a PC to 0 HP and rolls death saves. No
suite has a reason to — death saves are not a machine this module resolves; the stat plane only
STAMPS them for later reporting.

**Cost of leaving it:** low, and knowable. If the stamp were broken, the loss would be death-save
rows missing their context in party-stats reporting — not a table-facing failure. The fix, when
someone wants it, is a fixture that drops a PC to 0 and rolls three death saves; the assertion is
simply that the message carries `rollCtx`.

**Do not “fix” it by removing the registration.** The hook is correct and cheap; only its
exercise is missing.

### The four sideways edges (was debt row D9)

**What:** the tree is layered and the rule is *depend downward only*. Seven places had one
feature importing another feature — sideways. **Three were repaid** by moving the shared thing
down into the plumbing where both could reach it. **Four remain, deliberately.**

**Why not now:** you cannot design a good shared seam from one example. The house lesson (D8) is
that **the seam is built by the feature that proves its shape** — build it on one caller and you
are guessing, and a wrong shared part is worse than an honest sideways one.

**What would un-park each — the trigger is written into the pin itself:**

| Edge | Waiting for |
| --- | --- |
| `saves → maneuvers` | a **third** choice kind, to prove the registry's shape |
| `saves ↔ d20-folds` | a **second** machine that needs withhold-and-resume, before it becomes a spine primitive |
| `saves → receipts` | `receipts.js` gaining a **second** importer |
| `volleys → reminders` (BY DESIGN, 2026-09-02) | a **third** surface for the gate's judge (`judgeRoll` — the dialog's gate and the volley's aim are two), to prove a spine home |

⚠ **Self-expiring:** the pins live in [tools/check-layers.mjs](tools/check-layers.mjs) and
`npm run layers` fails on a pin whose edge has GONE, as well as on an edge with no pin. **Repay
one and the build refuses until its row is deleted.** This list cannot go stale the way the old
register did.

⚠ **Separately and permanently closed, not backlog:** the two surviving import cycles
(`hold.js ↔ auto-damage.js`, `auto-apply.js ↔ mastery.js`). The first is **load-bearing** — the
bare import pins module evaluation order and the hook-order check depends on it. **Breaking them
would make the tree worse.** See *SETTLED*.

### The damage offer's three lazy edges — ✅ REPAID 2026-09-04 (the hit menu built the seam)

> **Delivered as this item said to:** the hit menu (the sweep's item 2, first slice — the Battle Master's on-hit maneuvers) landed on the damage offer, and the seam was built WITH it: `registerOfferPart` in auto-damage.js, the machines declaring their contributions into the service (ARCHITECTURE §7 *The offer's contributions*). The three PERMANENT pins are gone — `npm run layers` prints 8 pinned pairs, down from 11. The two clock residues below are still notes, still not rows. The original text stays for the argument.

#### (was) one shape, three times (found 2026-09-03)

**What:** `npm run layers` prints **11 pinned pairs**; D9 was written at 8. The three that
joined during the 2026-09-02 walk are `auto-damage.js → sneak.js`, `auto-damage.js →
clock-riders.js` (both PERMANENT, lazy) and `volleys.js → reminders.js` (BY DESIGN). Read the
first two beside the older `auto-damage.js → mastery.js` and they are **one shape, three times**:
the damage OFFER — a service — reaching into a machine to paint that machine's content on the
popup (the armed Cleave line, the Cunning Strike menu, the due clock riders). The pin says so in
its own words: *"the same shape as its lazy edge to mastery.js."*

**Why it is here and not in the register:** nothing is broken and the pins are honest. But the
house rule (D8; D9's dispositions) is that **the third instance of a shape is what proves a
seam** — here an offer-contributions list the machines declare into and the service walks,
`ATTACK_FOLDS`-style — and every future thing that lands on the damage offer adds a fourth pin
until it exists.

**What would un-park it:** the next content that lands on the damage offer. The abilities
sweep's one-popup hit menu ([SWEEP.md](SWEEP.md) §0 item 2) is the likely candidate, and the
seam makes that menu cheaper — **build the seam WITH that feature, not before it** (a seam built
on today's three callers alone is still a guess about the fourth).

**Two clock residues to pick up on the same pass, notes not rows:** "first round" is judged in
three EDGE places — [clock-riders.js](scripts/clock-riders.js) through `riderDue`,
[sneak.js](scripts/sneak.js) for Death Strike, [reminders.js](scripts/reminders.js) for
Assassinate — and [maneuvers.js](scripts/maneuvers.js) still judges a maneuver's once-per-turn
off a flag stamp rather than a turn chit (`decide/chips.js` `TURN_CHITS`). Neither is wrong;
both are the walk landing faster than the shape.

### The template fast-path Foundry 14 took away (was debt row D12)

**What:** `saves.js` listens for `createMeasuredTemplate` / `updateMeasuredTemplate` so it can
re-derive who is standing inside a spell's area the moment one is placed. **Foundry 14 dispatches
neither name.** Measured 2026-08-24 ([tools/probe-surfaces.mjs](tools/probe-surfaces.mjs)):
placing one template moves `scene.templates` 0→1 **and `scene.regions` 0→1**, and what fires is
`preCreateRegion` / `createRegion` / `drawRegion`. The update dispatched **nothing at all**.

**Why nothing is broken:** those two are a *fast-path*. The real work is done by a **reliability
floor** that re-derives containment on the card's render hook, and that floor is what has carried
template adoption the whole time — table-proven on Shatter and Moonbeam, asserted by
`smoke-saves` §8.

**Why not now:** re-pointing at the Region hooks is **not a rename**. `refreshTemplatedDemands`
reads `getFlag("dnd5e", "origin")` and `.t` off a *template* document, and a Region carries
neither — it needs a region→template mapping and a walk to prove it. **It buys latency on a path
that already works.**

⚠ **Do not "fix" it by deleting the two registrations either.** The sandbox is one Foundry
version and prod may be another; a dead registration costs nothing, and a deleted one cannot come
back on its own.

**What would un-park it:** a table-visible lag in area adoption, or Foundry restoring the names —
and the pin in [tools/hook-coverage.mjs](tools/hook-coverage.mjs) is checked both ways, so **the
day the names come back the report says the pin is stale** rather than quietly reviving an
untested path.

---

## Features — surveyed, not scheduled

> **The pick-up order is EMPTY (2026-09-05).** The 2026-09-04 order — the save gate's why, the
> rest of the Battle Master's maneuvers, emanations' second slice, the transfer-flag pass, Heat
> Metal — was delivered in full: the save gate that evening, and the other four (plus Death
> Armor's damage shield, which the user put first) in the overnight run of 2026-09-04/05 the
> user commissioned before sleeping ("do these all autonomously"). Each row below says what
> shipped. Nothing is ordered now; the rest of this table is awareness, as it says at the top.

> Three surveyed rows left this list 2026-09-01 by user call — Tactical Master's mastery pick,
> Guidance/choice-bearing effects, light-family spells applying token light. Not settled, just
> off the list for now; git history holds the full survey text if one comes back.

> **Short-duration effect expiry left this list 2026-09-01 — DELIVERED** (DESIGN §5 *the platform
> keeps the clock*, DESIGN §8's settled row). The turn-time question it was blocked on dissolved
> on measurement: Foundry v14 keeps effect clocks itself, per effect, against the originating
> combatant, so the module never has to.

> **Sneak Attack as a choice on the gate and the damage riders on the combat CLOCK left this list 2026-09-02 — DELIVERED** (DESIGN §5; `sneak.js`, `clock-riders.js`; `smoke-sneak`, `smoke-clock`), built from the prototype *Sneak Attack, Cunningly* as drawn. The rulings they carried are in DESIGN §8.

> **AC5e adoption left this list 2026-09-01 — its TABLE shipped as data** (DESIGN §5 *the gate
> before the roll*; `CONDITION_BENDS` in `decide/registry.js`), and vendoring its code is
> SETTLED against (DESIGN §8). The geometry features it also carries — range bands, nearby foes,
> flanking, armour, encumbrance — were never wanted and are not here.

| Item | Shape |
| --- | --- |
| **Hypnotic Pattern's area outliving an "instantaneous" cast** (2026-09-02 — user: "it's an edge case, leave it") | The spent-template sweep (saves.js) has three buckets: instantaneous → swept at the last verdict; concentration → swept with concentration; any other duration → the GM's to clear. The PHB copy of Hypnotic Pattern is Concentration, 1 minute, so it is already the second bucket; an imported or edited copy with the concentration flag missing falls into the third. No data rule separates it from Grease (1 minute, no concentration, an area that MUST persist) — only the text does. If it ever matters: a "Spent Areas" list, the Block List's shape, read as a fourth bucket. Not before a second spell lands in it. |
| **An ability that lands as an effect shows no chit on the token** (user observation, 2026-09-03 — parked, undecided) | Steady Aim is the example and the class is every `USE_CHIPS` row and every feature whose use puts an ActiveEffect on the sheet: the effect exists, the gate reads it, the roll spends it — but the TOKEN shows nothing, because the chip carries no status and Foundry paints a token icon only for effects that do. The mastery chips (Vexed, Sapped, Slowed) have the same shape. User: *"not sure if it's a good thing or bad thing because stuff would stack up too much, but something to think about."* The two honest answers: give the module's chips a status/icon so the token says what the sheet says (a data change on the chip row, one line each, and the platform's expiry keeps them tidy), or leave the token clean and let the gate's box be the reminder (today's shape). **A third, the user's (same day): a BUFF BAR** — a strip of the character's live chips, read off the sheet, as the first slice of the chit layer (DESIGN §6): it is a view over the registries and the effects already there, shows what a token icon would show without crowding the canvas, and is the surface the spendable chits would later join. Long-term; it rides the chit layer's timeline, not this list's. ⚠ **PROTOTYPED AND PARKED 2026-09-03** (user: *"I'm not sold on this, let's keep the work here but park it"*): the clickable draft is [prototypes/buff-bar.html](prototypes/buff-bar.html) (open it in a browser; also published at https://claude.ai/code/artifact/8b6e00cd-7b22-4a73-8975-048c11ec408f) — a mock Foundry screen with the bar drawn in the module's palette, four placements (above the hotbar, over the token, sidebar header, its own window), three scenarios, and six questions left UNRULED: placement, marks-on-others as a second group, spent chits struck through, platform conditions in or out, whose bar, what a click does. Nothing was decided; pick it up from the prototype, not from scratch. **What would settle the near-term half:** a walk where a player looks for the buff on the token and does not find it — or one where the icons pile up and the table asks for quiet. Until then nothing is owed. |
| **The rest of the Battle Master's maneuvers** (user, 2026-09-04: "add to backlog we have to do the rest of maneuvers") — ✅ **DELIVERED 2026-09-05** (the overnight run; DESIGN §5 *The rest of the maneuvers*, `smoke-superiority`) | All nineteen now land on a machine. Two folds (Precision, Riposte); eight on the hit menu (2026-09-04); and the nine that remained, each on the machine the row predicted: **Parry** is a `damage` interrupt that REDUCES by a roll (`INTERRUPT_REDUCTIONS`; the hold rolls die + max(Str, Dex) — the pack's own formula — at the answer and the applier lands the damage short, the receipt saying why; the Monster Manual's AC "Parry" of the same name stays `ac`). **Evasive Footwork, Bait and Switch, Lunging Attack, Feinting Attack** are `SUPERIORITY_USES` (superiority-uses.js): a rolled AC chip, the pack's "Baited AC +N" on the fighter's pick (a popup, the fighter by default), a chip whose die is a ticked checkbox on the next melee hit's offer, the pack's marker on the target read by the gate for the fighter alone (`only: "source"`) and spent by the next attack roll with the die on the hit. **Ambush and Tactical Assessment** are the d20 folds' `tactical` spend with a scope (`SUPERIORITY_FOLDS`: Stealth / History-Investigation-Insight; Ambush on Initiative through `dnd5e.rollInitiative`, the combatant's number moved by the die). **Commander's Strike** is the `command` fold kind (29 kinds now): Riposte's driven attack with the ally as the attacker, the fighter's die resolved on the fighter and injected into the ally's weapon roll. **Rally** needed nothing: the pack's heal rolls through the system's own dialog and the cast slice lands the temp HP (measured). ⚠ Two content facts the run found: Bait and Switch ships TWELVE "Baited AC" effects (one per face) and the cast slice applied them all (AC 13 → 91) until every maneuver's card was kept off it; Feinting's marker is spent by the chip-spend machine, never a second delete (NOTES §2). |
| **A pass over the pack for target effects flagged as the wielder's passive** (2026-09-04, user: "you should probably do a universal pass on that") — ✅ **SCANNED 2026-09-04: Goaded is the only one** | Goading Attack's Goaded ships `transfer: true` — a passive on the wielder — and the walk lost a whole afternoon to it (NOTES §2). The module now corrects a HIT-OPTION row's target-facing effects on the wielder's copy and presses a lost one from the compendium. **The corpus was scanned the same evening** ([tools/filter-transfer.mjs](tools/filter-transfer.mjs) over `scan-corpus.mjs`'s JSON; 2,311 rows at dnd5e 5.3.3 / Foundry 14.365). ⚠ **The first cut of the filter over-counted by an order of magnitude, and the reason is the finding worth keeping:** 82 items link a `transfer: true` effect from an activity, but 70 of those are transfer + **DISABLED** — dnd5e's own convention for a self-buff the activity switches on (Rage, Bladesong, Innate Sorcery, Mirror Image). That shape is correct and never fails the Goaded way. **The Goaded shape is transfer + ENABLED + an activity aimed at someone else, and the corpus holds two:** Goading Attack (repaired) and **Aura of Warding** — which is a real passive (the Paladin's own resistance) whose ally grant the emanation machine already applies from its own registry, and which carries no clock, so nothing ever deletes it off the sheet. **Nothing is owed; the row-per-hit half has no hits.** The tool stays for the next system bump: `node tools/scan-corpus.mjs out.json && node tools/filter-transfer.mjs out.json` (add `--all` for the 82 with their disabled flags). |
| **The abilities sweep** (surveyed 2026-09-02; **SHELVED 2026-09-03**, user: "a longer term project") | SWEEP.md, a deliberate fifth document for the sweep's length: the 2024 corpus sorted into the walk's eight mechanism families, what each kind (race → class → subclass → feat → spell) would need, and a suggested order. **Its three questions are ruled** (SWEEP §5: ignore 2014; ONE hit-menu popup per hit grouped by feature/class, smites excluded as a separate Bonus Action; ONE shared Effect Sources list for both gates) and the corpus was rescanned the same day with the numbers holding. **Start at SWEEP §0 when it is picked up** — it says where to begin (item 1, the save-side bends) and what needs a prototype first (item 2). Nothing scheduled. |
| **Emanations — what the first slice leaves** (2026-09-03; DESIGN §5 *Emanations*) — ✅ **DELIVERED 2026-09-05 as the second slice** (`smoke-emanations` §12–15) | The corpus scan ran (every `radius` template from the caster in the 2024 packs): **Aura of Life, Aura of Purity, Circle of Power, Crusader's Mantle, Holy Aura** joined as spell rows applying exactly the pack's effect and saying on their card what the pack leaves to the table; **Aura of Vitality** is a NOTICE (`remind`: a card at the caster's turn start naming Start of Turn Heal, with a button — the heal is aimed, never played); **Antilife Shell** is a ring and a card and nothing applied; **Aura of Life's 0-HP ally** regains the activity's own 1 HP at its turn start (`heal`, the region's tokenTurnStart event — ⚠ dnd5e marks a 0-HP creature `dead` on its own, so the Hit Points alone decide). Left out on purpose and said in the table's doc: Antimagic Field, Globe of Invulnerability, Darkness, Daylight (no effect to carry — a ring alone would guess what the table wants drawn); Intimidating Presence and the Sea Druid's emanation saves (the cast's own demand handles the moment); Holy Aura's Fiend/Undead save on a melee hit (the damage shields' shape with a save in place of dice — a row for that family when a table asks). Still parked: **the +1 minimum** on Aura of Protection at Charisma +0 (the content's arithmetic, N1); **no-GM tables** (the flow-elect law). |
| **`smoke-nogm` logs one player-page error** (2026-09-04) | "Cannot read properties of null (reading 'id')" on the PLAYER page during the player's own swing with no GM, and the suite passes 19/19 regardless. A probe (a player alone, a GM joining and leaving) raised nothing; the module has no unguarded `.id` read on a nullable global; the error's origin (module, system, or the suite's own page code) is unmeasured. **What would un-park it:** the suite recording the error's stack (`e.stack`, not `e.message`) on its next red, or a table report of a player-side failure with no GM on. |
| **The save gate says nothing when the PLATFORM bends the save** (user, 2026-09-04, first in order: "when saves are made, I would like to see the calculus for why there is advantage/dis, just like attacks, by clicking the net modifier and seeing what is under it") — ✅ **DELIVERED 2026-09-04** (user go the same evening): `modeSources` in decide/reminders.js reads the applied effects' changes for the roll's `roll.mode` key; the save gate AND the check gate feed it; `smoke-saves` §22. ⚠ The row's own guess was wrong in one part worth keeping: dnd5e 5.x has NO `flags.dnd5e.advantage.*` — the mode is `system.abilities.<abl>.save.roll.mode` (AdvantageModeField), see DESIGN §5 and NOTES. | **Measured on the sandbox the same evening.** Harrow Vane's Wisdom save opened at `1d20adv + 5 + 3 + 1` with Advantage highlighted and NO reminder section — the +1 is the Robe of Protection, and the `adv` is **The Duskheart** (*"while you carry the Duskheart you have advantage on Wisdom saving throws"*), an item effect carrying the system's own advantage flag (`flags.dnd5e.advantage.save.wis`-shaped). **Why the gate was silent:** the save gate's judge (`judgeSave`, saves.js) reads the roller's STATUSES against `SAVE_BENDS` and nothing else — so a bend the platform itself applies from an effect flag has no box, no header tag and no fold, while the attack gate lists statuses, chips, the effect table AND range. **The surface already exists:** the save gate draws the attack gate's fieldset (`reminderFieldsetHTML`, folded), whose header IS the net tag and whose fold is the "click to see what's under it" — what is missing is the SOURCES. **The shape:** a fourth reader on the save table — the roller's active effects whose changes set dnd5e's advantage/disadvantage save flags (all / per ability / concentration), each a box naming the EFFECT and its item ("Advantage — The Duskheart") with the item's own text as the rule (the pack's flag effects carry no rule text of their own; the item's description is the honest quote), netted with the status sources as the attack gate nets. The same reader closes the same gap on the CHECK gate, and on the attack gate for flag-driven attack advantage (a lesser gap; the effect table covers most named effects). ⚠ Read the flags off the effect CHANGES, not off the actor's computed flags — the computed flag says "advantage" and not who — and honour the dialog's own advantage as the platform's, never re-set it (R-A). **Where it lands:** `decide/reminders.js` (a pure reader over effect changes, unit-tested), `saves.js` `judgeSave` feeding it, `smoke-saves` driving a sheet save on an actor with a flag-carrying effect. |
| **A placed area asks EVERYONE inside — the activity's Affects filter is ignored, and the caster is asked too** (user, 2026-09-04: "add to backlog templates, targeting"; "harrow is targeted") | The user's note, kept as the spec: *in dnd5e 5.x the activity's Targeting → Affects field does this. When a template is placed from an activity, the system auto-targets only tokens inside it that match that filter, judged by token disposition relative to the caster. Harrow's Unholy Word is set to Affects: Enemies; since Harrow's token is hostile, "enemies" means the party's friendly tokens — other hostiles like the practice dummies would be skipped, and neutrals like Renlow Veck too.* **What the module does today:** the saves machine's template adoption takes CONTAINMENT as the target set (smoke-saves §8, "containment IS the target set") and filters by disposition ONLY for a LISTED emanation row (`emanationReach`, saves.js — the Paladin auras and Spirit Guardians, by name), where the caster's own token is also excluded. Holy Word is not a listed row, so Harrow's own Holy Word demanded a save of Harrow ("harrow is targeted") and of every creature in the emanation whatever its side. **The shape:** generalise the emanation filter to EVERY placed area from the activity's own `target.affects.type` — `enemies` / `allies` / `creature` / `self`, judged by disposition relative to the caster's token exactly as the system's auto-targeting judges it (a hostile caster's enemies are the friendlies; neutrals are nobody's enemy) — and never the caster's own token unless Affects says self; a blank Affects keeps today's everyone. `reachAdmits` in decide/emanations.js is the disposition arithmetic already; the emanation rows become the special case of the general rule. ⚠ A `willing`-style or "creatures of your choice" filter is still the table's to designate; the module only applies what the data says. **Next step:** a unit table over `affects × casterDisposition × targetDisposition`, then a smoke-saves section with Holy Word on a hostile caster. Ordered after the current pick. |
| **Heat Metal does not work at the table** (user, 2026-09-04: "make heat metal spell work") — ✅ **DELIVERED 2026-09-05** (damage-casts.js, `DAMAGE_SAVES`, `smoke-heatmetal`) | MEASURED: the 2024 pack ships Heat Metal as a bare damage activity ("Cast and Heat"; "Reheat" as the Bonus Action) plus a save activity ("On Damage Save" — Con, no damage, the Heated Metal effect on a failure) that nothing chained, and the cast's dice were only ever a DIALOG's (dnd5e's DamageActivity follows its card by opening the damage roll dialog; with the card's buttons hidden that click was the whole path). Two halves shipped: **the general one** — a bare damage activity aimed at targets rolls its dice at the use on the casting client (offered when the caster wants their dice back), the native follow-up switched off so it never rolls twice, chained to the card where the no-attack applier already lands it; volley spells and Battle Master maneuvers stay their own machines' — and **the row** — a listed spell's save is put to the same targets right after the dice through the saves machine, the failed-save effect lands, and the card says the table removes it if the object was dropped (the drop is a judgment). The check gate reads Heated Metal too now (the effect table's `checks` facet; Averse carries it as well). |
| **Misty Step's teleport is blocked by other tokens / line of sight** (user, 2026-09-04) — ⚠ **MEASURED AND RULED OUT OF SCOPE the same evening** (user: *"I think this particular fix isn't really a Battle Flow scoped item"*) | **The cause, measured on the test range (NOTES §1):** the circle is Automated Animations' teleport preset (Misty Step, `checkCollision: true`, `teleport: true`); its pick issues a bare `document.move()` with no action, Foundry 14 walks a bare move so a wall stops it, dnd5e's *full* movement automation stops it in front of a hostile creature, and the preset's own collision option refuses a wall at the circle before any move exists. Foundry's `blink` is wall-checked too; only `displace` (its own teleport action) crosses both, and a token's default action may be set to it. **A working fix was built** — a Teleports list (Misty Step, Dimension Door, Moonlight Step, Shadow Step, Arcane Charge), the caster's token given `displace` for the one move after a listed use, a `preMoveToken` veto judging the destination by the row's text (sight, occupancy), unit tests — and **pulled back on the user's call**: it is a movement-pipeline concern, not a rule this module resolves. It is kept whole as [prototypes/teleports-in-battleflow.patch](prototypes/teleports-in-battleflow.patch). **Where it went (user call, the same evening): a NEW sister module, [fvtt-mod-miscpatches](https://github.com/Txpple/fvtt-mod-miscpatches)** — "small, independent fixes for things other modules and the platform get slightly wrong", one file per patch behind its own setting; the teleport patch is its first (v1.0.0, `scripts/patches/teleports.js`, its own smoke suite green 5/5 on the sandbox). The Automated Animations preset's *Check Collision* still has to be switched off on the teleport presets so the rule is the only judge. Not this module's; this row stays only as the pointer. | Reported, not yet measured. The module has no teleport machine — the cast is data and the move is the player dragging the token — so the block is almost certainly the PLATFORM's movement pipeline (Foundry v13+; NOTES §1 records that a plain position update is a MOVE and can be refused without a word, and that a headless page needs `{teleport: true, animate: false}`). Two candidate causes, one measurement each: the scene's wall/sight rules stopping a drag through a wall the caster cannot see past (Misty Step needs "a space you can see", so a wall block may be CORRECT and the token block not), and Foundry 14's occupied-space / token-collision rules stopping a drag that passes THROUGH another token to an unoccupied space beyond it. If the second, the fix is a movement-action row: the cast marks the caster's next move as a teleport (`movementAction: "blink"`/`teleport`, which the pipeline exempts from token collision), cleared on the move or at the end of the turn — the same shape as Moonlight Step's spend row (`EFFECT_BENDS` *Moonlight Step*, Moon Druid), which today carries only the Advantage half. **What would un-park it:** a measured walk on the sandbox (drag a token through another after casting; drag through a wall) and the platform's answer to which rule refused it. Ordered behind the maneuvers and the emanations (user, 2026-09-04). |
| **Death Armor's damage shield — the attacker takes damage for hitting the warded creature** (user, 2026-09-04: "death armor needs its damage shield effect automated"; "not sure if that fits in a family") — ✅ **DELIVERED 2026-09-05 as the ninth shape** (damage-shields.js, `DAMAGE_SHIELDS`, `smoke-shields`; DESIGN §5 *Damage shields*) | Built as this row scoped it: a table keyed by the spell's name, the ward found on the DEFENDER by the pack's effect name and walked to its caster (`effectSourceOf` — hit-riders' mark walk, moved down to the spine by its second customer), the pack's damage activity rolled by the ELECT with dnd5e's own roller and posted as the defender's, applied to the attacker through the receipt chokepoint with a note naming the ward. Judged when the attack's DAMAGE lands (the hold settled, `hitTargets` final): a melee attack roll, within the activity's own reach (Flame Eruption's and Retaliate's 5 ft over the distance the gate measures — a reach weapon at 10 ft pays nothing; Frost Damage has no clause), Death Armor once per turn as a chit on the defender, Fire Shield's TYPE by the standing effect (warm burns, chill freezes), Armor of Agathys MARKED at the cast by the module (the pack ships no effect) and striking while the temp HP stand, the mark ending — with a card — when the pool hits zero. One payout per ward per hit, claimed on the damage message before the dice. The two unmeasured questions answered: the elect rolls (the defender's client with no GM), and the pack's text enricher carries no formula — the activity does. |
| **A Cunning Strike option no fixture exercises: Rend Mind** (2026-09-02) | The row is data (`CUNNING_OPTIONS.rendMind` — Psychic Blades only, the free use before the three-dice use) and the unit tests read it, but no Soulknife stands on the sandbox, so `smoke-sneak` never drives it live. The first Soulknife at the table is the measurement; a fixture is the fix. |
| **Clock riders with a damage TYPE the rules leave to the player** (2026-09-02) | Divine Strike, Primal Strike and Divine Fury ride with the activity's FIRST type and say so on the card (DESIGN §8 — no picker was wanted). A cleric who wants Radiant over Necrotic edits the activity's part order once. **A picker on the offer is one row of controls away if a table asks.** |
| **The pack's own "Assasinate" (sic) effect row beside the "Assassinate" feature row** (2026-09-02) | The 2024 PHB's Assassinate feature ships a transfer effect misspelled *Assasinate* (its Initiative Advantage), and the effect scan of 2026-09-02 carried it into `EFFECT_BENDS` under that name. The clock row added the same day is keyed by the FEATURE's name, correctly spelled, with the clock as its judge. Two rows, two things; if the pack ever fixes the spelling the effect row's key must follow it. |
| **Incapacitated breaks Concentration** — ✅ DELIVERED 2026-09-02 (user report: Hypnotized left Hunter's Mark up) | Measured: dnd5e 5.3 does NOT end it when the status lands. `concentration.js` breaks it off `createActiveEffect` / a re-enabled effect carrying the status, on the client that drives the concentrator — no save, the card says why. `smoke-concentration` §15. |

### Two content facts worth keeping

Both are unmodelled, and neither is findable by guessing.

- **Heroic Inspiration's rules text**, quoted verbatim in the popup (presentation law 8), is
  `dnd5e.content24` → *Appendix D: Rule References* → page **`nkEPI89CiQnOaLYh`**. ⚠ The full
  text is **wider than what shipped**: *"any die"* reaches **damage rolls**, and the transfer
  clause — *"it's lost unless you give it to a player character who lacks it"* — is a **second
  unmodelled half**. ⚠ Widening it is what triggers §11 rule 4's auto-revert obligation, and it
  is **SETTLED as not shipping** until that machinery exists.
- **Tactical Mind's refund** — *"if the check still fails, this use of Second Wind isn't
  expended."* ⚠ **Unbuildable as an automatic rule**: the refund is conditional on the check
  FAILING and **no DC exists for an ability check anywhere in dnd5e**. It is a GM ruling or a
  player-pressed un-spend, not arithmetic. Also **SETTLED** — a manual *"Refund"* button was
  offered and declined.
