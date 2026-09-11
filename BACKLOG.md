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

### The two sideways edges (was four; was debt row D9)

**What:** the tree is layered and the rule is *depend downward only*. Seven places had one
feature importing another feature — sideways. **Three were repaid** by moving the shared thing
down into the plumbing where both could reach it. **Two remain, deliberately** — the machine-tier
pass (2026-09-05) repaid two more, exactly as their triggers said (Stage 3b built the withhold
registry ahead of a third customer on the user's ruling; Stage 4a moved the readers down).

**Why not now:** you cannot design a good shared seam from one example. The house lesson (D8) is
that **the seam is built by the feature that proves its shape** — build it on one caller and you
are guessing, and a wrong shared part is worse than an honest sideways one.

**What would un-park each — the trigger is written into the pin itself:**

| Edge | Waiting for |
| --- | --- |
| ~~`saves → maneuvers`~~ | ✅ **repaid 2026-09-05** (Stage 4a): the readers went to `lookup.js`, the rules text to `decide/registry.js`; the save-choice REGISTRY still waits for a **third** choice kind |
| ~~`saves ↔ d20-folds`~~ | ✅ **repaid 2026-09-05** (Stage 3b, ruling 2): the spine's withhold registry — `registerWithhold` / `registerWithheld` in ui.js |
| `saves → receipts` (`saves/verdict.js` since Stage 4c) | `receipts.js` gaining a **second** importer |
| `volleys → reminders` (BY DESIGN, 2026-09-02) | a **third** surface for the gate's judge (`judgeRoll` — the dialog's gate and the volley's aim are two), to prove a spine home |

⚠ **Self-expiring:** the pins live in [tools/check-layers.mjs](tools/check-layers.mjs) and
`npm run layers` fails on a pin whose edge has GONE, as well as on an edge with no pin. **Repay
one and the build refuses until its row is deleted.** This list cannot go stale the way the old
register did.

⚠ **Separately and permanently closed, not backlog:** the two surviving import cycles
(`hold/index.js ↔ auto-damage.js`, `auto-apply.js ↔ mastery.js`). The first is **load-bearing** — the
bare import pins module evaluation order and the hook-order check depends on it. **Breaking them
would make the tree worse.** See *SETTLED*.

### Two clock residues — one shape in three places, and one machine off the chit registry

**What:** "first round" is judged in three EDGE places — [decide/clock.js](scripts/decide/clock.js)
through `riderDue` for the clock riders, [sneak.js](scripts/sneak.js) for Death Strike, and
[reminders.js](scripts/reminders.js) for Assassinate — and [bash-offer.js](scripts/bash-offer.js)
still judges a maneuver's once-per-turn off a flag stamp on the attacker rather than a turn chit
(`decide/chips.js` `TURN_CHITS`, which every other once-per-turn in the module reads). Neither is
wrong; both are the walk landing faster than the shape. Found 2026-09-03 beside the damage
offer's lazy edges, which the hit menu repaid 2026-09-04 (`registerOfferPart`, ARCHITECTURE §7
*The offer's contributions*); these two were left as notes then and are the only part of that
item still open.

**Why not now:** the house rule (D8) — the seam is built by the feature that proves its shape.
Three judges of "first round" are a shape; a shared reader written from them alone is still a
guess about the fourth caller's facts (which combatant, whose turn, which combat).

**What would un-park it:** a FOURTH thing that judges "first round" (the first-round reader goes
to `decide/clock.js` with it), or the next once-per-turn maneuver that lands on the bash offer
(it moves to a turn chit with it).

### The template fast-path Foundry 14 took away (was debt row D12)

**What:** `saves/areas.js` listens for `createMeasuredTemplate` / `updateMeasuredTemplate` so it can
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

### The modal sequence, and the pictures Battle Flow's own moments never play (2026-09-09)

**What:** two wants the user named on the same day, parked together because they are the same seam
seen from two sides — and because each is a *goal for some workflows, not all*.

1. **The modal sequence.** A workflow where several windows are answered **in order**, and the
   visual chain — the picture, the dice, the saves — waits for the whole sequence to drain, not
   for one window. Today the popup pile is a **staircase in causal order** (ARCHITECTURE §5 law 7,
   a user ruling with table findings behind it): concurrent by design, with one narrow exception
   (the rescue view). A modal sequence is a **change to law 7**, not an addition to it, and it is
   wanted for *some* workflows only — so it arrives as an option per moment, never as the default.
2. **The pictures that never play.** An ability consumed through a Battle Flow popup posts no
   dnd5e **usage card** — it posts a `bfCard`, or writes a record on an attack or damage message
   that already exists. FX Studio's message reader keys on usage messages (`type === "usage"`) and
   builds its subject from the ITEM on them, so a maneuver spent at the hold, a Sorcery Point
   consumed, a Sneak Attack's dice — **none of them reach a reader, and none of them play**, though
   the same ability triggered on its own would. The user: *"an animation doesn't trigger, because a
   card isn't technically drawn."*

**Why not now:** the user's own call on the sequence (*"not a priority now"*). On the pictures, the
honest reason is the house lesson (D8): **the emitter is not one line and there is no single site
yet.** `poolSpendsOn` ([shared.js](scripts/shared.js)) is the uniform *reader* of a spend, but the
records are *written* in five places, and the riders the user named are not spends at all — Sneak
Attack writes `sneak` / `sneakDamage` flags on a message that already exists and consumes no pool.
So the emitter's real home is the **moment's resolve step**, which means the spine, which means it
should be designed once against two or three real callers rather than guessed from one.

**What would un-park it:** the user's word on either half. They are independent — the pictures can
be built without the sequence, and are the more useful of the two.

⚠ **NO BLOCKERS — the contract the hold work must keep.** The compatibility work in flight
(`api.holdFor`, the generalisation of `castHold`) is a strict subset of what a modal sequence
needs, and it stays that way only if four things hold. **Anyone touching the hold must keep all
four, or this item becomes unbuildable without a migration:**

| Decision | Why it is load-bearing |
| --- | --- |
| The hold is **refcounted**, never a boolean per subject | A sequence of N windows raises N holds against one subject; a boolean cannot count them down, and today's single holder would have hidden that forever |
| The hold is keyed by an **opaque subject**, not an activity uuid | A sequence's subject may be a popup key or a message id; an activity-only key locks the seam to casts |
| Release is an **explicit lifecycle call**, never coupled to "the card posted" | In a sequence the card posts at step 1 while steps 2..N still stand — card-arrival as the release signal is exactly the coupling that would have to be torn out |
| Every decision popup keeps opening through **`openManagedPopup`** ([ui.js](scripts/ui.js)) | It is the one place that knows when a dialog opens and closes, so it is the only place a sequence can be counted without editing every machine. A machine that opens its own dialog is outside the sequence and cannot be brought back in cheaply |

⚠ **The one place the two modules' rules genuinely disagree, written down in both (2026-09-09).**
A **Hold Timer of 0** is a clockless ask *by explicit setting* (§5 law 11), so Battle Flow raises a
**clockless hold** — on purpose. FX Studio bounds every gate at five minutes and **plays when a
bound expires** (fail open, correct on its own terms), so at that setting the area picture fires
while the question is still on the caster's screen. **Neither side is wrong and neither will
unilaterally change**: a consumer that trusts a producer's liveness is the bug, and a late picture
beats a lost one. ⚠ **If a play report ever says "the animation fired while I was still choosing",
this is the cause and the Hold Timer is the first thing to read** — do not go looking in the hold
registry. The default is **24s** (bound 54s, comfortably inside five minutes), so the normal path
never reaches it. The sized fix is FX Studio's and is per-gate, not a longer global bound.

**The sister side.** FX Studio is building a **gate seam** — its dispatcher asks registered gates
whether a moment is held and awaits any promise — with Battle Flow as one feature-detected tenant
and no dependency either way (its BACKLOG, *The cast hold*). The pictures half above is that seam's
mirror: a **source** Battle Flow publishes and FX Studio may read. ⚠ Neither module may import the
other; Battle Flow publishes events and an api, and never calls FX Studio. Some tables install
neither.

## From play — reported 2026-09-09, not yet reproduced

> ⚠ **ALL FOUR CLOSED (Careful 2026-09-09; Private rolls resolved in Combat Plus, Spirit Guardians closed as a template-vs-FX mismatch, and the stale Shield FIXED, all 2026-09-10). The rows stay as the record of how each was run down. When it held rows, this table was the one exception to the charter at the top of this file:** a row here is a live
> reports from the table (NOTES §6 — *trust those reports*), parked here **by user call** until a
> session is commissioned to reproduce them in the harness. None is owed yet; each becomes owed
> the moment it is picked up, and the row leaves this file for the commission. The first step of
> that commission is a fixture that shows the bug, not a fix.

| Report | What is known, what is guessed, what would settle it |
| --- | --- |
| ~~**Careful Spell did nothing**~~ | ✅ **CLOSED 2026-09-09** — metamagic as a class shipped (PLAN *THE METAMAGIC PASS* Stages 1–2, DESIGN §6 *Metamagic*): Careful's protected creatures leave the save demand, so no ask, no timer roll, no damage. The timer question the row raised was RULED the other way the same day (the buzzer keeps rolling for PCs — an afk table plays through). |
| ~~**Spirit Guardians rolled a save for Gren out of range**~~ (flagged live and reverted) | ✅ **CLOSED 2026-09-10 — the user's call: a mismatch between the TEMPLATE and the FX picture** (*"just a mismatch in the template vs the fx"*): the table judged range by FX Studio's animation, which did not match the ring; the Region asked by the template's own geometry and asked correctly. Nothing owed in Battle Flow; the picture's size is the sister repo's. The measurement that cleared the module stays here as awareness — ([tools/probe-sg-range.mjs](tools/probe-sg-range.mjs), sandbox, Foundry 14.365 / dnd5e 5.3.3; the caster at the table was the **Sharran Acolyte**, the only actor in the world carrying the spell — the party has none). **The range guess is CLEARED.** The Region, the drawn template and the module's own containment reader (`tokensInTemplates`) all agree on one Euclidean circle of 17.5 ft from the caster's centre (15 + half a Medium token): a 1×1 token 3 squares straight or (3,1) or (2,2) is a member and is asked once on entry; (4,0), (3,2), (3,3), (2,3) are not members and are never asked — and the cast card's render floor adopts nobody the Region excludes. If anything the circle UNDER-asks against the table's ruler (equidistant diagonals read (3,2) and (3,3) as 15 ft, in range; the circle says out). The ring walking PAST a creature (the caster moved 8 squares through it in one move) asked nothing. **Two ways the report CAN happen, both measured:** ① **walls** — a creature 2 squares away with a wall between (no line of sight) is a member, wears Half Speed and is asked; the 2024 rule says an emanation is blocked by total cover; ② **elevation** — the Region's top is unbounded, so a creature 30 ft up over the ring (a 3-D distance of 33 ft) is a member and is asked. Neither is modelled, deliberately (no cover or height test anywhere in emanations.js), and neither was the table's case. **If either ever is:** a cover test on entry wants its own ruling (DESIGN §6) before code; the elevation half is a Region `elevation.top` on the adopted region, one line, but sizes the aura as a cylinder rather than a sphere and wants the same ruling. |
| ~~**A stale Shield effect survived a revert, so the next hit offered no reaction**~~ (that damage was reverted by hand too) | ✅ **FIXED 2026-09-10 on the user's word** (*"fix shield"*): the reaction's self-cast effect takes the Reaction chip's clock (hold/lookup.js `applyReactionEffect` → effect-riders.js `applyEffectsTo` `clock`), the expired-chip tidy owns it (chip-spend.js `tidyOwns`), and the offer gate reads `active` (`hasReactionEffect`). Pinned by `smoke-hold` §9 (3/3 on the sandbox; the full suite green beside it). DESIGN §5 *the platform keeps the clock* carries the rule. The reproduction that found it: **REPRODUCED 2026-09-10, and the revert is a red herring** ([tools/probe-shield-leftover.mjs](tools/probe-shield-leftover.mjs), sandbox, Foundry 14.365 / dnd5e 5.3.3, the GM-owned BF Test Shielder in a two-combatant combat, attacker first). One Shield cast plus one turn boundary is the whole recipe; nothing was reverted. **The mechanism, measured step by step:** the attacker hits at r1t0 → hold → the popup's own Cast → *Imperceptible Barrier* (the pack's name; "Immutable" was a misremembering — no such effect exists in any pack or the world) lands on the shielder, AC 12 → 17, `duration {1 rounds, expiry turnStart}`, and `start.combatant` = **the ATTACKER's** combatant (the platform stamps whoever's turn it is; the applier — `applyEffectsTo`, effect-riders.js — passes no `start`). r1t1 (the shielder's own turn): still active, AC 17 — a turn LONGER than the text ("until the start of your next turn"). r2t0 (the attacker's next turn): the platform marks it `expired` — and **core v14's `isSuppressed` is `!!(system.isSuppressed ?? duration.expired)`**, so the expired barrier is SUPPRESSED, not deleted: `active: false`, AC back to 12, filed by dnd5e under *Unavailable Effects* — exactly what Gren's sheet showed. The module's expired-chip tidy (chip-spend.js) deletes only effects wearing `CHIP_FLAG`; the reaction effect wears `applied`/`reactionEffect`, so it is never swept (still there at r3t0). Then the second hit: `hasReactionEffect` (hold/lookup.js) tests `!e.disabled` only, reads the suppressed leftover as *standing*, `findInterrupt` returns null, **no hold, no popup, the damage lands** — the report, verbatim. **Two defects, one class each:** (a) the offer gate reads a dead effect as live — the fix is `e.active` (core's `!disabled && !isSuppressed`), the same exclusion the gate's effect read already makes (reminders.js:214); (b) the reaction's effect is applied with no `start` and is never tidied — the clock class the module's own chips already solve (`shared.js` clock stamping, the chip tidy). Both are Battle Flow's. **The revert:** the damage receipt's revert never touched the effect and was never meant to (the answer card carries the effect's own ✕); the table's revert simply happened in the same round. |
| ~~**Private rolls got toggled on by accident**~~ | ✅ **RESOLVED IN COMBAT PLUS** (user, 2026-09-10). It was never a Battle Flow control — the only roll-mode the module sets is concentration's (`concVisibility`, `concentration.js`); the toggle the table hit was the platform's, and the click box landed in the sister repo, as the row predicted. |


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
| ~~**Noxious Miasma's area outliving an instantaneous breath**~~ (2026-09-10 — the user's report on the Adult Green Dragon, beside Poison Breath) | ✅ **BUILT 2026-09-10 on the user's ruling — the FOURTH BUCKET.** Poison Breath was a plain bug (a feature's demand read the ITEM's duration, and a `feat` has none — fixed the same day, `saves/demand.js`, smoke-saves §8f). Noxious Miasma was the Hypnotic Pattern class: the Monster Manual writes its activity duration as `1 turn` — the −2 AC penalty's clock, not the cloud's — so by the sweep's three buckets its area was the GM's to clear, like Grease; no data rule separates the two, only the text does. The user picked the list (*"Build the fourth bucket … this"*): the **Spent Areas** list, a membership list over `SPENT_AREAS` (decide/registry.js — each row quotes the rule and names the data's lie), read by the sweep (saves/areas.js) and by the empty-instant stamp (saves/demand.js); Noxious Miasma and Hypnotic Pattern its first two rows. Pinned by smoke-saves §8g (listed: swept; struck from the list: the GM's bucket, as before). ⚠ A row is a claim about the TEXT — an area that genuinely persists (Grease, Web, Cloudkill) must never be listed. |
| ~~**Hypnotic Pattern's area outliving an "instantaneous" cast**~~ (2026-09-02 — user: "it's an edge case, leave it") | ✅ **CLOSED 2026-09-10 — the second spell landed (the row above) and the fourth bucket was built; Hypnotic Pattern is its second row.** The survey that waited for it: The spent-template sweep (saves/areas.js) has three buckets: instantaneous → swept at the last verdict; concentration → swept with concentration; any other duration → the GM's to clear. The PHB copy of Hypnotic Pattern is Concentration, 1 minute, so it is already the second bucket; an imported or edited copy with the concentration flag missing falls into the third. No data rule separates it from Grease (1 minute, no concentration, an area that MUST persist) — only the text does. If it ever matters: a "Spent Areas" list, the Block List's shape, read as a fourth bucket. Not before a second spell lands in it. |
| **An ability that lands as an effect shows no chit on the token** (user observation, 2026-09-03 — parked, undecided) | Steady Aim is the example and the class is every `USE_CHIPS` row and every feature whose use puts an ActiveEffect on the sheet: the effect exists, the gate reads it, the roll spends it — but the TOKEN shows nothing, because the chip carries no status and Foundry paints a token icon only for effects that do. The mastery chips (Vexed, Sapped, Slowed) have the same shape. User: *"not sure if it's a good thing or bad thing because stuff would stack up too much, but something to think about."* The two honest answers: give the module's chips a status/icon so the token says what the sheet says (a data change on the chip row, one line each, and the platform's expiry keeps them tidy), or leave the token clean and let the gate's box be the reminder (today's shape). **A third, the user's (same day): a BUFF BAR** — a strip of the character's live chips, read off the sheet, as the first slice of the chit layer (DESIGN §6): it is a view over the registries and the effects already there, shows what a token icon would show without crowding the canvas, and is the surface the spendable chits would later join. Long-term; it rides the chit layer's timeline, not this list's. ⚠ **PROTOTYPED AND PARKED 2026-09-03** (user: *"I'm not sold on this, let's keep the work here but park it"*): the clickable draft is [prototypes/buff-bar.html](prototypes/buff-bar.html) (open it in a browser; also published at https://claude.ai/code/artifact/8b6e00cd-7b22-4a73-8975-048c11ec408f) — a mock Foundry screen with the bar drawn in the module's palette, four placements (above the hotbar, over the token, sidebar header, its own window), three scenarios, and six questions left UNRULED: placement, marks-on-others as a second group, spent chits struck through, platform conditions in or out, whose bar, what a click does. Nothing was decided; pick it up from the prototype, not from scratch. **What would settle the near-term half:** a walk where a player looks for the buff on the token and does not find it — or one where the icons pile up and the table asks for quiet. Until then nothing is owed. |
| **The abilities sweep** (surveyed 2026-09-02; **SHELVED 2026-09-03**, user: "a longer term project") | SWEEP.md, a deliberate fifth document for the sweep's length: the 2024 corpus sorted into the walk's eight mechanism families, what each kind (race → class → subclass → feat → spell) would need, and a suggested order. **Its three questions are ruled** (SWEEP §5: ignore 2014; ONE hit-menu popup per hit grouped by feature/class, smites excluded as a separate Bonus Action; ONE shared Effect Sources list for both gates) and the corpus was rescanned the same day with the numbers holding. **Start at SWEEP §0 when it is picked up** — it says where to begin (item 1, the save-side bends) and what needs a prototype first (item 2). Nothing scheduled. |
| **A Cunning Strike option no fixture exercises: Rend Mind** (2026-09-02) | The row is data (`CUNNING_OPTIONS.rendMind` — Psychic Blades only, the free use before the three-dice use) and the unit tests read it, but no Soulknife stands on the sandbox, so `smoke-sneak` never drives it live. The first Soulknife at the table is the measurement; a fixture is the fix. |
| **Clock riders with a damage TYPE the rules leave to the player** (2026-09-02) | Divine Strike, Primal Strike and Divine Fury ride with the activity's FIRST type and say so on the card (DESIGN §8 — no picker was wanted). A cleric who wants Radiant over Necrotic edits the activity's part order once. **A picker on the offer is one row of controls away if a table asks.** |
| **The pack's own "Assasinate" (sic) effect row beside the "Assassinate" feature row** (2026-09-02) | The 2024 PHB's Assassinate feature ships a transfer effect misspelled *Assasinate* (its Initiative Advantage), and the effect scan of 2026-09-02 carried it into `EFFECT_BENDS` under that name. The clock row added the same day is keyed by the FEATURE's name, correctly spelled, with the clock as its judge. Two rows, two things; if the pack ever fixes the spelling the effect row's key must follow it. |

### Two content facts worth keeping

Neither is findable by guessing. **Both were ruled on 2026-09-11** and nothing is open on
either; the rows stay as the record.

- **Heroic Inspiration's rules text**, quoted verbatim in the popup (presentation law 8), is
  `dnd5e.content24` → *Appendix D: Rule References* → page **`nkEPI89CiQnOaLYh`**. The full
  text is wider than what shipped: *"any die"* reaches **damage rolls**, and the transfer
  clause — *"it's lost unless you give it to a player character who lacks it"* — is a second
  half. ✅ **CLOSED (user, 2026-09-11):** the transfer is *"a table handling level thing"*, and
  the reroll reaches every d20 test the module meets — attacks, saves, ability/skill/tool checks
  through the sheet's own roll dialog ([tools/probe-heroic-check.mjs](tools/probe-heroic-check.mjs)),
  Initiative. Damage dice are not wanted (they would trigger §11 rule 4's auto-revert obligation).
- **Tactical Mind's refund** — *"if the check still fails, this use of Second Wind isn't
  expended."* Unbuildable as an AUTOMATIC rule: the refund is conditional on the check FAILING
  and **no DC exists for an ability check anywhere in dnd5e**. ✅ **BUILT AS AN ASK (user,
  2026-09-11: "its time to add the refund button")** — after the die is added and the fold
  settles, one window: succeeded (keep) or still failed (refund, the use written back with a
  receipt). DESIGN §8 carries the ruling; `smoke-d20-folds` §10 pins it.
