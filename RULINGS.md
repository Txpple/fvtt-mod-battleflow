# RULINGS.md — the feature rulings

> **What each feature does, as the user ruled it, and what pins it.** One section per feature.
> Each records the ruling with its date, the mechanism it settled (the table, the file), and the
> suite or test that holds it. The reasons a thing is NOT done live in [DESIGN.md](DESIGN.md) §8
> *Settled*; the structure lives in [ARCHITECTURE.md](ARCHITECTURE.md); platform facts in
> [NOTES.md](NOTES.md). The narrative of how each ruling was reached is in git history.
>
> The binding rules every section applies: R1 automate outcomes, never decisions; N1 amounts
> are read from the content, never stored; R4 mechanisms in code, membership in data; R5 every
> application is receipted. A ruling here that seems to bend one of those is the exception the
> user made, and it says so.

---

## Where the table bends the rule (the register, 2026-09-24)

**Every place the module plays a rule other than as written, one row each.** User, 2026-09-24:
*"i'm sure stuff like that will happen again... where its impossible to follow the RAW. gotta
keep those 'modifications' recorded"*. ⚠ **A STANDING RULE: a new bend adds its row here IN THE
SAME COMMIT as its code.** A bend with no row is a bug in this file. The reasons a thing is not
done at all stay in DESIGN §8; this is what IS done, differently from the page.

| The rule as written | What the module does | Why the platform forces it | Since |
| --- | --- | --- | --- |
| **Shield**: "when you are hit" (2024: hit by an attack roll) — and every AC reaction beside it | offered after the roll shows a hit, before the damage | the defender's client cannot pause the attacker's roll: `dnd5e.preRollAttack` runs synchronously on the attacker's client, so the hold is stamped on the hit (`hold/trigger.js`) | 2026-08-15 (Phase 1.5, v1.1.0 — the hold's birth, `hold/index.js`) |
| **Lucky**: Disadvantage "when a creature rolls a d20 for an attack roll against you" | offered after the hit, before the damage — a second d20, the lower standing | the same | 2026-09-24 |
| **Warding Flare**: light flares "before it hits or misses" | offered after the hit | the same | 2026-09-24 |
| **Shadowy Dodge**: "when a creature makes an attack roll against you" | offered after the hit | the same | 2026-09-24 |
| **Protection** (the Fighting Style): "when a creature you can see attacks a target other than you" | offered to the guard after the roll shows a HIT, before the damage — the second d20, the lower standing (ruled R1, 2026-09-26); a miss asks nothing | the same (`hold/trigger.js` stamps the guards on the held target) | 2026-09-26 |
| **Protection** and **Interception**: "a creature you can see" · "another creature within 5 feet of you" | every creature within 5 feet of the one hit, on ITS side of the table (token disposition), not Incapacitated, holding what the style demands, is asked; sight is not judged | nothing the module reads says who can see whom; the side is the fact it can read, and the owner who cannot see simply passes (`geometry.js` `alliesWithin`) | 2026-09-26 |
| **Interception**: "reduce the damage dealt to the target" when an attack hits it | the attack's damage is held at the module's applier and each guard asked (P1); damage applied with the card's own buttons, or typed on a sheet, is not held | the applier's claim is the only seam where the damage waits (`damage-holds.js`, Stone's Endurance's shape) | 2026-09-26 |
| **Dueling, Defense, Great Weapon Fighting, Two-Weapon Fighting, Unarmed Fighting, Protection, Interception, Heavy Armor Master**: what you are "holding" / "wearing" | read off the sheet's EQUIPPED boxes; a Versatile weapon's grip is the attack's own mode (one hand or two) | the sheet has no hands — Equipped is the one fact dnd5e keeps about what is held (ruled off the prototype, 2026-09-26: "gate it on what pc is holding") | 2026-09-26 |
| **Unarmed Fighting**: "1d4 Bludgeoning damage to one creature Grappled by you" at the start of each of your turns | asked of the owner (ruled U1: Deal it / Skip), the clock dealing it; "grappled by you" is the Grappled effect's own provenance (the module's source stamp, else its origin's actor); a Grappled that names no grappler is OFFERED when it stands within 5 feet, and never dealt by the clock | the Grappled condition carries no grappler of its own — a status toggled from the token HUD says nothing about who holds it (`fighting-styles.js` `grapplerOf`) | 2026-09-26 |
| **Warding Flare** protects any creature the Cleric can see within 30 feet | protects its OWNER only | the hold is stamped per DEFENDER: only a hit target's own sheet is read for rows (`hold/lookup.js` `rollRescuesOf`) — a known gap, DESIGN §8 | 2026-09-24 |
| **Stone's Endurance**: "when you take damage" (any damage) | ASKED in one popup, and on the click the damage lands reduced by the roll (user, 2026-09-25: "the popup for stones endurance should show up, and if hte person rolls, then the damage is auto reduced"): an attack hit asks at the hit (the hold); every other damage the MODULE applies is held at its applier until the answer (`damage-holds.js`); damage applied with the card's OWN buttons or typed on a sheet is reduced by hand | only the module's own applier can make a number wait: the card's buttons call `Actor#applyDamage` straight, and `dnd5e.preApplyDamage` is synchronous — no popup can be answered inside it (`auto-apply.js` `registerDamageClaim`) | 2026-09-24; widened 2026-09-25 |
| **Powerful Build**: Advantage on "any ability check you make to end the Grappled condition" | while the Goliath IS Grappled, its Athletics and Acrobatics checks have Advantage, whatever they are for | nothing tells an escape check from any other check the module meets (`EFFECT_BENDS` `checksWhen`); the bearer's status and the escape's two skills are the facts it can read | 2026-09-25 |
| **Storm's Thunder, Hellish Rebuke, Fount of Moonlight, Retaliation, Sword of Answering** — a Reaction when a creature damages you | offered only when the damage names its dealer: the card it came from (any application with an originating card — the module's, or the card's own buttons); an HP typed on a sheet offers nothing | `dnd5e.applyDamage` knows the dealer only through `originatingMessage`; a sheet edit carries none (`rebukes.js`) | 2026-09-25 |
| **Trip Attack and Hill's Tumble on one hit** (the rules allow a maneuver and the boon together) | one hit-menu pick per hit; a clock rider (Fire's Burn, Frost's Chill) still rides beside any pick | the pick is ONE record (`hitPick` → `hitManeuver`), so a second pick would be dropped in silence (`decide/hit-menu.js` `hitPick`); the array shape is BACKLOG's | 2026-09-24 |
| **Undead Fortitude**: "unless the damage is Radiant or from a Critical Hit" | the exemption is read off the damage card (its rolls' types, the crit off its rolls or the attack it answers); damage with no card the module can read — typed on a sheet, applied by a macro — COUNTS the row and the save rolls | the seam (`dnd5e.preApplyDamage`) knows the type and the crit only through `originatingMessage`; the gate never guesses an exemption (DESIGN R1) | 2026-09-28 |
| **Death Throes**: "each creature in a 30-foot Emanation" | every creature WITH Hit Points within the Emanation is asked; a creature at 0 is not | the dead-target gate: a demand on a 0-HP creature starves the machine (`saves/demand.js`); the corpse's reach is measured edge to edge from the token's squares (`geometry.js` `creaturesWithin`) | 2026-09-28 |
| **Greater Magic Resistance**: "the attack rolls of spells automatically miss it" | the save cannot fail (the Succeeds button); a spell attack rolls as any attack — the miss is the table's | the attack gate has no auto-miss verdict; one customer, the row's caveat says so | 2026-09-28 |
| **Regeneration**: "if it takes Acid or Fire damage, this trait doesn't function on its next turn" | the block is read off the receipts the MODULE wrote since the bearer's last turn started; damage applied with the card's own buttons or typed on a sheet writes no receipt and blocks nothing | only the module's applier receipts the type (`auto-apply.js`); a sheet edit carries none | 2026-09-28 |
| **Brave / Fey Ancestry / Dwarven Resilience** on a save to END the condition | the row is listed on the gate, not counted — except on a repeat the module raises itself (`REPEAT_SAVES`, 2026-09-28), whose demand says what it is against: there the row COUNTS | an end-of-turn repeat rolled from the sheet is a bare roll with no demand to read what it is against (R1: never guessed) | 2026-09-24; narrowed 2026-09-28 |
| **Disadvantage imposed on an attack rolled WITH Advantage** (the two cancel) | the plain roll is the FIRST d20 rolled — the first face a reroll modifier did not replace — and no second d20 is rolled | both dice are already on the table, and the first was chosen before anyone saw a face (`decide/rescue-hit.js` `d20Faces`, `disadvantageOutcome`) | 2026-09-24 |
| **A critical hit** when a live Disadvantage row could undo it | the damage is NOT rolled at the hit; it is rolled once after the answer, doubled only if the crit still stands for every hit target | doubled dice rolled before the answer would be discarded the moment the second d20 comes up lower (`hold.critAtStake`, `auto-damage.js` `damageAfterHold`) | 2026-09-24 |
| **Heroic Inspiration, Precision Attack, Graze** once a defender's Lucky (or any `roll` row) turned the hit into a miss | not offered to the attacker | the attacker's rescues are offered at `dnd5e.rollAttack`, where the roll was a hit; nothing re-offers them after the hold's verdict — a known gap, DESIGN §8 (Graze already had it for Shield, `mastery.js`) | 2026-09-24 |
| **Lucky**: Advantage "when you roll a d20 for a D20 Test" — chosen as you roll | in the roll dialog: a box with a tick, spent when the roll goes out ticked (`advantage-buys.js`). An initiative rolled with NO dialog (the carousel, Roll All) is offered it AFTER the roll — a second d20, the higher standing — so the player has seen the first die when choosing (ruled "After the roll", 2026-09-25) | `Combat#rollInitiative` rolls with no pause before its dice and no hook that can wait for an answer (`dnd5e.preConfigureInitiative` is synchronous), so no popup can come before that roll (`d20-folds.js` `ADVANTAGE`) | 2026-09-25 |
| **Relentless Endurance** ("when you are reduced to 0 Hit Points") and **Death Ward** ("the first time the target would drop to 0 Hit Points") | caught on DAMAGE applied through the system's damage application — the module's applier and the card's own buttons: the Hit Points are written as 1 in that same update (Death Ward automatic, the effect removed; Relentless Endurance held at 1 while its popup asks, and the clock's pass lands the 0). Hit Points typed on a sheet, or a drop to 0 with no damage, are the table's | `dnd5e.preApplyDamage` is the one place a drop can be changed before it lands, and it is synchronous — the ask has to stand at 1, not at 0; a sheet edit carries no damage to read (`drop-to-one.js`) | 2026-09-25 |
| **Celestial Revelation's extra damage** on a spell with no attack roll: dealt "when you deal damage to it", with the spell | offered on the spell's card once its damage has landed; the pick lands as its OWN damage (its own card and receipt) — a concentrating target makes a second Constitution save for it | the extra goes to ONE of the spell's targets, the caster's pick, and the spell's damage is one roll applied to all of them: it cannot ride the roll, and the spell's receipt is keyed by creature, so an entry there would overwrite the spell's own (`clock-riders.js`) | 2026-09-25 |
| **Heavy Weapon Mastery** (Great Weapon Master): "as part of the Attack action on your turn" | +Proficiency Bonus on every damage roll of a Heavy weapon's attack on the owner's own turn — Hew's Bonus Action swing included; a combat that holds the owner on another's turn (an Opportunity Attack) adds nothing and the card says "off — not your turn" | nothing on a damage roll says which action the attack was part of: Hew's swing is the same weapon's same attack activity (`fighting-styles.js` `ownTurnOf`, the `heavy` gate) | 2026-09-26 |
| **Heavy Armor Master**: "when you're hit by an attack" | the cut is taken on damage from an ATTACK's damage card (its activity an attack, or a card answering one), through the module's applier or the card's own buttons; a save's, an area's or a rider's damage is never cut, and neither is a number typed on the token bar or the sheet. "Any Bludgeoning, Piercing, and Slashing damage … is reduced by" one Proficiency Bonus in all, not one per type | the damage application knows only the card it came from (`originatingMessage`); a bare number carries none (`fighting-styles.js`, `dnd5e.preCalculateDamage`) | 2026-09-26 |
| **Mage Slayer**'s Concentration Breaker: "When you damage a creature that is concentrating" | the concentration save is at Disadvantage when the damage came from a CARD whose speaker holds the feat — the module's applier or the card's own buttons; damage typed on a sheet names no dealer and breaks nothing | `dnd5e.preApplyDamage` knows the dealer only through `originatingMessage` (`concentration.js` `breakerFor`, the rebukes' floor) | 2026-09-27 |
| **Sentinel**'s Guardian: "Immediately after a creature within 5 feet of you takes the Disengage action or hits a target other than you with an attack" | asked when the hit's DAMAGE lands, with the card it came from, of a bystander on another side of the map (token disposition); a hit that deals no damage, damage typed on a sheet, and a Disengage ask nothing; a friend's hit is not asked (ⓐ — noise) | the landing is where a hit is final (after any reaction that could still turn it) and where its card names the hitter (`rebukes.js` `stampWards`); nothing records a Disengage (NOTES §2) | 2026-09-27 |
| **Sentinel**'s Halt: "When you hit a creature with an Opportunity Attack" | due on the Opportunity Attack the module drove (its cards say so) AND on any melee hit the Sentinel makes off its own turn in a running combat — ticked on the damage offer, with the caveat "only on an Opportunity Attack" | an Opportunity Attack made from the sheet is an ordinary attack roll: nothing marks it; off-turn melee is the fact the module can read (`clock-riders.js`, `judge: "opportunity"`) | 2026-09-27 |
| **Polearm Master**'s Reactive Strike: "a creature that enters the reach you have with that weapon" — the attack happens as it enters | a REMINDER as the hostile's move crosses into the reach ring (Foundry splits the move there, so a pass-through is caught), while the move itself carries on; the attack is made from the sheet after | holding the mover at the edge for the answer would need Foundry's `pauseMovement`, callable only on the MOVING user's client — movement pauses are out of scope (DESIGN §8) (`emanations.js` `maybeAlert`) | 2026-09-27 |
| **Chef**'s Replenishing Meal: food cooked "as part of a Short Rest"; "At the end of the Short Rest, any creature who eats the food and spends one or more Hit Dice" regains 1d8 | the Chef picks the eaters AFTER its own Short Rest; an eater whose Short Rest already ended in the same sitting (the same Rest request, else within two hours) is healed then if it spent a Hit Die; one still resting is healed as its own rest ends | every creature rests on its own client, in any order, and dnd5e's rest card states the Hit Dice spent only in words — the module stamps its own record on each Short Rest card (`rest-grants.js` `restSpent`, `decide/rest-grants.js` `mealStanding`) | 2026-09-27 |
| **Command**: the word is spoken as the spell is cast | asked of the caster when the target's save FAILS (a success asks nothing): Approach / Flee / Grovel / Halt in one popup; Grovel presses Prone (receipted), the other three are the table's to play; the clock defaults to Halt | the verdict pass is the one seam that can hold a consequence for an answer (`saves/choices.js`, the bash's shape), and the word changes nothing the save reads | 2026-09-28 |
| **Fear**: the target repeats the save "if it doesn't have line of sight to you" | demanded at every turn end, the clause said on the card; a success the creature should not have had is reverted from the cast card by hand | sight is nothing the module reads (`REPEAT_SAVES` `caveat`) | 2026-09-28 |
| **Beacon of Hope**: "regains the maximum number of Hit Points possible from any healing" | healing the MODULE lands through the cast path (a healing spell aimed at the creature) is raised to the roll's maximum, the receipt saying so; healing applied with a card's own buttons, by a kit, an aura or a sheet edit is not | only the module's own applier can change a number as it lands (`cast.js`, `HEAL_REROLLS` `max`) | 2026-09-28 |
| **Sanctuary**: the spell ends if the warded creature "deals damage" | the bearer's own DAMAGE ROLL ends it (an attack roll and a cast end it as written) | the applier knows a damage's dealer only through its originating card, and not on every path; the bearer's damage roll is the fact read on all of them (`wards.js`, `dnd5e.rollDamage`) | 2026-09-28 |
| **Sanctuary**: on a failed save the attacker must "choose a new target or lose the attack or spell" | the use is VETOED before it rolls or casts: nothing is spent — no attack, no slot — and the attacker aims again or lets it go; "lose the spell" (the slot) is not enforced | the veto (`dnd5e.preRollAttack`, `dnd5e.preUseActivity`) is the one seam before the roll, and it stops the use before the platform consumes anything; spending a slot on a cast that never happened would be a hand-written deduction (`wards.js`) | 2026-09-28 |
| **Mirror Image**: "each time a creature hits you with an attack roll" — the duplicates before anything else | rolled AFTER the defender's held reactions resolve (Shield, Lucky, a guard), only if the hit still stands | the hold is the seam where a hit waits; the duplicates ride it as an entry of their own, and rolling before the answer would burn a duplicate on a hit a Shield then turns (`hold/continue.js`) | 2026-09-28 |
| **Spike Growth**: "for every 5 feet it travels" — as it goes | paid ONCE when the move lands, for the feet the platform's split of the move says were inside (floor(feet ÷ 5) × 2d4, one roll); the mover is never stopped or asked | the region events fire after the move is committed, and holding the mover would need the moving client's `pauseMovement` — movement pauses are out of scope (DESIGN §8) (`emanations.js` `maybeMoveDamage`) | 2026-09-28 |
| **Wall of Fire**: "within 10 feet of that side" of a 1-foot wall | the region is WIDENED by 10 feet on one side — away from the caster by default, flipped on the cast's card by compass name; the ring burns outside as a 10-foot ring, inside as the disc | a region knows only who stands inside it: the burning band has to BE the region (`decide/emanations.js` `bandShape`); "selected by you when you cast" has no seam before the placement, so the default is the far side and the card is the pick | 2026-09-28 |
| **Warding Bond**: the caster takes "the same amount of damage"; the spell ends "if you and the target become separated by more than 60 feet" or at a re-cast | the same NUMBER, applied untyped (no second resistance); beyond 60 feet at the moment damage lands nothing is shared and the card says so, but the bond STANDS — its end by distance, and by a re-cast on either creature, is the table's (delete Bonded); the caster's drop to 0 ends it | the applier knows the amount that landed, not why; nothing watches two tokens' distance between damages, and a re-cast lands a second Bonded the pack does not tie to the first (`damage-shares.js`) | 2026-09-28 |
| **Prismatic Spray**, the violet ray: "makes a Wisdom saving throw at the start of your next turn … on a failed save the creature teleports to another plane" | the ray's Blinded lands on a failed Wisdom save (the ray's own activity); the LATER save is the table's | the pack clocks Teleporting (Violet) to end at the caster's next turn start — dnd5e's own expiry, judged on the same combat edge the repeat would need, and the effect may be gone before a demand could name it; a plane shift is nothing the module plays (`RAY_TABLES`) | 2026-09-28 |
| **Magic Circle** and **Forcecage**: a creature "can't willingly enter" / "can't leave it by nonmagical means" | a NOTICE card as the creature moves in or out; the move itself carries on | Polearm Master's row, the same seam: a pause would need the moving client's `pauseMovement`, out of scope (DESIGN §8) (`emanations.js` `notice`) | 2026-09-28 |

## Bent by choice — the rule of cool (2026-09-26)

**Where the module plays a rule more generously than the page, on purpose.** User, 2026-09-26:
*"i think B and bend it, its more fun that way. we should make these notes where we bend the rules
slightly for rule of cool"*. The register above is what the PLATFORM forces; this is what the
TABLE chose. ⚠ **The same standing rule: a new bend by choice adds its row here IN THE SAME COMMIT
as its code.**

| The rule as written | What the module does | Why it's more fun | Since |
| --- | --- | --- | --- |
| **Interpose Shield** (Shield Master): a Reaction when "subjected to an effect that allows you to make a Dexterity saving throw to take only half damage" — taken before the save is known | offered only AFTER the save SUCCEEDS (a Dexterity half-damage save, a Shield held, the Reaction free): Use turns the half into none and spends the Reaction; a failed save never asks (`saves/choices.js`, kind `interpose`) | the Reaction is never wasted on a save that fails, and the ask comes with the good news (ruled "B", 2026-09-26; built so since walk-5 (y)) | 2026-09-26 (built earlier; recorded as a choice this day) |
| **Poisoner's Apply Poison**: a dose applied to ONE weapon or piece of ammunition, potent for 1 minute or until that item deals damage | the use puts a **Poison Coating** on the CHARACTER (no weapon picked — the pack's drop-a-weapon card is not drawn): a Bonus Action said on its own card, a dose spent, "+(Poison Coating)" floated; the NEXT weapon hit spends it — the feat's own save at the creatures struck, 2d8 and Poisoned (until the end of the Poisoner's next turn, `sourceEnd`) on a failure; a miss spends nothing (`use-chips.js` COATINGS; the switch is the Fighting Styles list's Poisoner) | no weapon bookkeeping, and the poison always meets the next thing the Poisoner hits (the user, 2026-09-26: *"make it a buff applied to the actor"*) | 2026-09-26 |
| **Chef**'s Bolstering Treats: cooked "with 1 hour of work or when you finish a Long Rest", they last 8 hours, and "a creature can use a Bonus Action to eat one" for Temporary Hit Points equal to the Proficiency Bonus | after the Chef's Long Rest a popup hands them out: up to the Proficiency Bonus creatures on the scene (the Chef too) gain that many Temporary Hit Points at once — no treat to carry, no Bonus Action (`REST_GRANTS` "Bolstering Treats", `rest-grants.js`) | no treat bookkeeping, and the party starts the day with them (the user, 2026-09-26: Bolstering Treats as temp HP handed out after the Long Rest) | 2026-09-27 (ruled 2026-09-26) |
| **Counterspell**: "you attempt to interrupt a creature in the process of casting a spell" — a Reaction at the moment of the cast | the caster TARGETS the creature and uses Counterspell; the saves machine demands its Constitution save as for any targeted save, and the verdict stands on the card — nothing watches for a cast, no hold is raised, no spell is stopped by the module; the rest is the table's | the drawing's cast-triggered hold (a reaction at a hostile's cast, prototype-first, cost 2) was traded for the table's own timing: the player says "Counterspell" as the spell is declared, the module answers with the save (the user, 2026-09-28: *"the user can just target intended counterspell actor, and force them to make the con save per the spell. the rest can be handled at table"*) | 2026-09-28 |

## The effect view (2026-09-15; the aura row 2026-09-15; the panel 2026-09-18)

**Buffs and debuffs, visible on demand, never actions.** A creature carries more effects than
its token paints (the module's chips carry no status), so the sheet knows things the table
cannot see. `scripts/effect-view.js`, pure half `scripts/decide/effect-view.js`; ruled shot by
shot off `prototypes/effect-views.html` on the live sandbox. Replaces the chit layer and the buff
bar (`prototypes/buff-bar.html`), both retired the same day: chrome on the screen at rest was the
objection, and a spendable-actions surface was never the need.

- **Three surfaces, one renderer, nothing written by the view.** The bar above the hotbar for the
  controlled token (else the user's character), always on; the hover card beside any token
  pointed at, never for a controlled token (the bar is its list); the held Alt showing every
  creature's list at once. Two client switches, one per family.
- **What is listed is what is IN FORCE:** an active effect that is clocked, a condition, or one
  applied by a cast; never a worn item's transfer effect. Plus Temporary HP and Heroic
  Inspiration, read off the sheet. A row the token cannot paint is tagged *no icon*. The hover
  card and the bar's name panel add the marks the creature holds on others (not on the strip).
- **The bearer's own standing aura is in force** (v1.42.0): a feature's emanation sits on its
  bearer as the pack's transfer effect, so the one creature radiating the aura was the one hidden.
  Listed as a buff, named as the pack names it, tagged *no icon*; the class is every feature row
  of the emanation table, read and gated as the floor reads it. The floor never writes the bearer
  a marker.
- **The bar is the ONE interactive surface.** The name opens the full list upward, grouped as
  the sheet groups it (Temporary, Passive, Unavailable), so a GM can sweep a dead effect. A chip
  opens a fold with its one write for an owner: Remove an effect, Disable an item's (never
  deleted), Clear a sheet row. The hover card and the held key are read-only. A *Details* entry
  was tried and dropped.
- **Tone is a PATTERN, not a list:** concentration is its own yellow and leads; a condition or a
  module mark is a debuff; else the effect's own CHANGES decide (a penalty outranks a bonus); else
  the caster's side by disposition; else a buff.
- **Order:** concentration, debuffs, buffs, the sheet rows last; the panel vertical.

Not picked: a count badge, tracker chip lines, a turn-start card. Pinned by
`tests/decide-effect-view.test.js` and `tools/probe-effect-view.mjs`.

## Chips and clocks — where a chip belongs, and who keeps its time

**Combat chips are TEMPORARY effects; Passive is for what a character wears** (2026-09-01).
Anything the module applies out of a swing, a save or a reaction carries a real duration. A chip
Foundry cannot measure is filed Unavailable and reads as the feature doing nothing (the v1.27.1
Sap report: a round clock stamped against a combat that was not `game.combat`, `activeCombatFor`
in core.js). A chip nothing expires accumulates; the sweep runs at apply time.

**The platform keeps the clock; the module keeps its word** (2026-09-01). A chip's duration is
the rules text written once as Foundry v14 expiry data (`decide/chips.js`), and since dnd5e 6.0
the pseudo-expiries `sourceStart | sourceEnd | targetStart | targetEnd` say whose turn: Vex
`sourceEnd`, Sap and Slow `sourceStart`, the reaction chip `targetStart`, a Miasma `targetEnd`.
Foundry marks the chip expired on the boundary; the module deletes what Foundry marked and sweeps
its chips when a combat is deleted. **Nothing in this module counts turns, and nothing may start
to.** The module's own are EVENTS: the attack roll that spends Vex or Sap (a receipt on the attack
card), and the once-per-turn chits (Cleave, Sneak Attack, a clock rider, Steady Aim), which have
no platform equivalent. Out of combat there is no clock; a chip lives until its spend closes it.
The module's own re-derivation (`appliedClock`, v1.41.0) was retired by the 6.0 pass (NOTES §2).

**An empty clock takes the spell's** (2026-09-15, dnd5e 6.0's `Activity#getAppliedEffectChanges`):
a pack that wrote a duration on the spell and not its effect (Death Armor) lands clocked through
the one applier every cast's and every save's effects pass through (`effect-riders.js`).

**Dead is the platform's MARK, never the arithmetic** (2026-09-01). A one-round chip's
`remaining` reads zero for the whole round its boundary falls in; zero is alive, a negative
clock is the one fallback for a no-GM table. The Cleave chit is a stamp comparison against the
turn IN PROGRESS (`combatStamp`), because the mark is GM-written.

**A reaction's own effect is on the Reaction chip's clock** (2026-09-10, the stale-Shield
report): Shield's "until the start of your next turn" is the chip's sentence, so the hold applies
the cast reaction's effect at `targetStart` pinned to the reactor, not the pack's `{1 rounds,
turnStart}` stamped with the attacker's turn. An expired effect is MARKED, not deleted (core's
`isSuppressed`), so the tidy owns the reaction's effect and the offer gate reads `active`.
Pinned by `smoke-hold` §9.

**Prone is the named exception and stays Passive** (2026-09-01). The rules give it no window; a
Temporary Prone would stand creatures up on a clock nobody rolled for. Take the duration from the
rules, and where they give none, give none. A pass that "fixes" Prone into Temporary is a
regression.

**The Reaction is a chip** (2026-09-02): on the reactor, spent by any interrupt, back at the
start of the reactor's next turn (`reactionStands`). Never a flag the module clears by hand.

## The gate before the roll (2026-09-01 → 2026-09-04)

**A reminder is proactive, never a rescue.** When something the module can READ bends a d20, the
gate meets the roller BEFORE the dice, inside the system's own roll dialog (forced open under a
fast-forward key), as ONE section shaped like the dialog's configuration: a box per source (the
fact, the bend as a badge, the rule quoted verbatim) under one header line carrying the count and
the net as a coloured tag. No net block; the arithmetic rides the header's tooltip. The human
presses one of the dialog's own buttons and the roll goes out natively. **Nothing is ever applied
for the roller.** The card records what was shown and pressed; the stats plane reads honour off
it. Membership: the Reminder Sources list names the KINDS, the Condition Sources list names WHICH
conditions (Hiding included). An empty Reminder Sources list is the gate off.

- **The highlighted button is the net** the section names, marked with a persistent border in the
  outcome's hue (keyboard focus is not a mark; a click takes it). Enter is still a press. The
  section re-judges on the dialog's own re-renders and on a re-target.
- **One palette, one meaning per hue, everywhere the module paints:** green good for you, red bad
  for you, orange waiting on you, yellow a critical hit, grey nothing bending. Blue is dnd5e's
  healing and stays out.
- **The net is the 5e rule:** any Advantage against any Disadvantage is normal, however many of
  each. A source the module cannot judge is listed and not counted.
- **The labels are the fact alone** ("Rogue — Hiding"); the quoted rule carries the condition.
  No tooltip on the header line.
- **A recorded spend counts as spent** whatever the sheet says (a no-GM table's lingering chip).
- **Effect sources** (2026-09-02): abilities that bend an attack roll and sit on a sheet as an
  ACTIVE EFFECT or a FEATURE — `EFFECT_BENDS` in `decide/registry.js`, one row of data each, from
  a scan of every pack on the sandbox. Matched by NAME (what a GM can type), and by the effect's
  ITEM where two packs share a name (`item`). Each row: the side, a SCOPE (Innate Sorcery is spell
  attacks only), a caveat where the module cannot judge, `counted: false` where the caveat is the
  rule (Demon Armor), a `judge` where the module CAN read the fact (Bloodied, the target Grappled,
  an ally within 5 feet — off the map since 2026-09-22), `spend: "attack"` where the rules spend it
  on the next attack roll, `only: "source"` (Feinting Attack, Vow of Enmity) and `except:
  "source"` (Goaded). A map fact the module cannot read counts, never guessed exempt. The Effect
  Sources list is membership, parsed whole.
- **Range is a source** (2026-09-02): any ranged attack roll, off the activity's own range and the
  Prone geometry — beyond normal range Disadvantage, beyond long range listed not counted, an
  enemy within 5 feet Disadvantage with its caveat. `RANGE_RULES`.
- **A volley meets the gate at its aim** (2026-09-02): the aim popup judges once per ray, each row
  folded to its header, the mode select defaulting to its net, a re-aim re-judging the rays
  after. Spends are carried forward in ray order — Sap and Vex bend ONE ray (N1). Darts are
  damage, nothing drawn.
- **An outcome the table carries is APPLIED:** the automatic crit within 5 feet of a Paralyzed or
  Unconscious target is made by the damage service off the same table and distance
  (`critWithinFeet`, `critFor`), when true of every target the roll serves; the card says why.
- **What the gate never touches:** a roll whose caller suppressed the dialog and has no aim.

**The save gate is the attack pattern on the save hook** (2026-09-02, option E: cascading saves,
no queue). A demand opens dnd5e's own Saving Throw dialog with THE DEMAND above the configuration
(who rolls, the DC, what a success buys, the timer bar) and BEFORE YOU ROLL below it (`SAVE_BENDS`:
Restrained, the Dodge action, the auto-fails), the default the net. A sheet save meets the same
gate. The Topple save and the concentration check joined it 2026-09-03. **A save the rules fail
before the dice grows a Fails button as the default** — no dice, still a press; the buzzer takes
Fails too. Option C, resolving with no press, is settled against (DESIGN §8).

**The save and check gates say WHY when the PLATFORM bends the roll** (2026-09-04): the roller's
applied effects are read for the roll-mode key that names this roll, each a box naming the ITEM,
netted with the status rows; read off the effect CHANGES, never the computed mode. A mode the
SYSTEM sets from a rule of its own stays unexplained.

**The check gate is the same pattern on the ability-check hook** (2026-09-03): `CHECK_BENDS`
(Poisoned, Frightened, the glossary verbatim). Poisoned's Disadvantage the platform rolls itself,
so its box explains a default; Frightened is the gate's own. Nothing applied. Initiative is
skipped on purpose.

**Sneak Attack is a CHOICE beside the roll** (2026-09-02, the prototype *Sneak Attack, Cunningly*;
`sneak.js`, `SNEAK_ATTACK`, `CUNNING_OPTIONS`; `smoke-sneak`). With the feature on the sheet and a
Finesse or ranged weapon the section grows one box outside the fold: the dice read off the
feature's own activity on the sheet, a checkbox ticked when the conditions hold — the roll nets
Advantage, or an ally of the rogue (not Incapacitated) stands within 5 feet of every target and
the roll has no Disadvantage (judged off the map since 2026-09-22; the tick stays the player's).
On the hit the damage offer opens even under auto damage: the Cunning Strike menu read off the
sheet, subclass included, up to two picks with Improved Cunning Strike. Costs come off before the
roll, the sneak dice ride as their own part, a crit doubles what is left, one receipt. The effects
run through the saves machine on the pack's activities; Envenom's failure also presses Poisoned;
Death Strike on round one demands its save. Once per turn is a turn chit on the attacker.

**Clock riders are NOTIFIED, never asked, and each is a ticked checkbox on the offer**
(2026-09-02, reversed the same evening from a line to a tick; `CLOCK_RIDERS`, `clock-riders.js`,
`smoke-clock`): a feature on the attacker's sheet whose extra damage hangs on the ROUND or the
TURN (Dreadful Strike, the Assassin's dice, Divine Strike, Primal Strike, Divine Fury). The part
rides the hit when the clock says so, the chit is written, a use is spent, the card says why. A
declined rider spends nothing. Left out on purpose: rows with a choice inside them or an
unjudgeable fact. A damage TYPE the rules leave open takes the activity's first type and says so.
Once-per-turn counts only for a combatant in the running combat.

**The first walk's rulings (2026-09-02/03), all standing:** a standing effect source shows on
every ray, only what the rules SPEND is carried forward; a text-only feature becomes a chip on
use (`USE_CHIPS`, Steady Aim); a failed save presses the standard status from a row where the pack
ships no effect (`SAVE_PRESSES`, Web); Evasion is an outcome (`EVASION`, none on a success, half
on a failure, applied and receipted); Incapacitated breaks concentration off the effect, no save;
Uncanny Dodge is an attack-roll interrupt only; an interrupt is the ABILITY by name, never its
effect; a damage interrupt the module can settle is settled (`INTERRUPT_MULTIPLIERS`: Uncanny Dodge
×0.5; Absorb Elements and Deflect Attacks stay "reduce by hand"). **Every row on the offer is the
same shape:** a tick, the name and the dice, a fact as the tag, the rule folded under — never a
line of explanation above or below (the standing UI rule). The offer's menus scroll in a bounded
box; the Roll button names the weapon.

**Heroic Inspiration's text** is quoted from `dnd5e.content24`, *Appendix D: Rule References*, page
`nkEPI89CiQnOaLYh`. It reaches every d20 test the module meets (attacks, saves, checks through the
sheet's dialog, Initiative — `tools/probe-heroic-check.mjs`); not damage dice, and not the transfer
clause (DESIGN §8).

## Emanations (2026-09-03; amended 2026-09-04, 09-05, 09-18, 09-23)

**An aura applies itself to the creatures inside it, and the platform keeps the geometry and the
clock.** The user opened DESIGN §4 to them: an aura applying to whoever stands inside is an
OUTCOME, "no different than auto-applying Slow with mastery". The measurement that made it fit
(`tools/probe-emanations.mjs`): Foundry 14's `RegionDocument.createTokenEmanation` builds the
rules-correct shape attached to the token, tracks who stands inside, raises enter / exit / turn
events. **Nothing here measures a distance or counts a turn.** `emanations.js`, `decide/emanations.js`,
`EMANATIONS`; `smoke-emanations`, `smoke-twoclient`.

- **A feature's aura is always on:** it stands whenever the token is on the scene and its range
  resolves; off while the source is Incapacitated; a GM-deleted region comes back on the next
  sweep.
- **A spell's aura places itself on the caster** — the placement prompt switched off, the area
  centred on the token, adopted when its Region appears, ended when the concentration effect for
  that cast is deleted.
- **The cast's own save asks only who the aura reaches:** a listed row filters the area adoption
  by its reach and never asks the caster. Spirit Guardians cast among allies demands nothing.
- **Range is the content's:** the activity's size, else the class's scale value the pack's aura
  activities reference (`@scale.paladin.aura`). A Paladin below 6th has no aura and the data says so.
- **The effect is the pack's, with the SOURCE's numbers read in** at write time, re-read when the
  source changes; named for its source ("Protected — Ysolde").
- **Reach by disposition:** helpful auras reach allies and neutrals, harmful ones enemies. A
  feature's own token is never a member of its own emanation (the transfer effect covers it);
  **a spell's ring includes its caster** (2026-09-05: "you and your allies"); a harmful ring never
  admits its caster.
- **A triggered save is a demand over the bus** for that one creature, once per turn, counted only
  for a combatant. The standing effect is the region's, never applied again by the verdict.
- **Not drawn at all** (2026-09-18): the Region is the machine, locked, `LAYER_UNLOCKED`
  visibility. What the table sees is the member's chit: the member's copy wears the module status
  `bfEmanation`, visible while inside, gone with the effect. One copy, one lifecycle: the cast's
  own demand never applies the spell's standing effect.
- **A damage type the part leaves open is the alignment's by default and the caster's by
  choice** (Spirit Guardians): the default read off the sheet, picked by a radio in the system's
  own casting window, changeable from the card, every roll of that cast wearing it. This is the
  emanation's answer, not the clock riders': here the rules NAME the deciding fact.
- **Asked once at the cast:** whoever stands inside when the area appears is asked by the cast's
  demand; the area attaching around them is not an entry.
- **The floor is the truth:** the active GM keeps the standing effects true to the platform's
  membership on every event and every move, one write per creature per region. With no GM the
  flow-elect law holds.
- **An emanation exists on every LIVE scene — the active one and every scene a connected user is
  viewing — with ONE copy per aura** (2026-09-04 active-only; amended 2026-09-23 after Session 8
  played on scenes nobody activated). The count is per AURA (the bearer's item and the row,
  `emanationGroup`), so two scenes can never stack; a lift reads every actor. A GM's view counts
  only while no player is connected; an Assistant GM is a GM for this. Pinned by
  `smoke-emanations` §11g–l and `smoke-twoclient` `pull`.
- **Aura of Courage's pack effect carries no change:** a content fix at the world.

**The second slice** (2026-09-05): every 2024 PHB emanation with a standing effect is a row — Aura
of Life, Aura of Purity, Circle of Power, Crusader's Mantle, Holy Aura — applying exactly the
pack's effect; each row's caveat names the clause the pack does not carry. **The save clauses the
packs leave out are the save gate's, by effect:** the effect table's `saves` facet reads the DEMAND
— Aura of Purity counts Advantage when the demanding spell's failed effect would impose one of its
seven conditions, Circle of Power when a spell demands the save at all, and a success under Circle
of Power against half-on-save spell damage takes NONE, applied and receipted like Evasion. A heal
the caster AIMS is a notice, never played (Aura of Vitality). A barrier is a ring and a card
(Antilife Shell). An area can pay a member at a moment (Aura of Life's 1 HP at turn start). Left
out: rings that carry no effect (Antimagic Field, Darkness, Daylight), and emanation saves a
Bonus Action casts.

## The hit menu (2026-09-04, off `prototypes/hit-menu.html`)

**One popup per hit, a group per paying feature** — the general form of the Cunning Strike menu
(SWEEP item 2: one popup, grouped by the feature that grants the rows, smites out). `hit-menu.js`,
`HIT_GROUPS` (the feature that pays: its pool, its die, its pick limit, its DC rule), `HIT_OPTIONS`
(a feature on the sheet that spends from it); membership the Hit Menu list; `smoke-hitmenu`.

- **The row is the name and the cost, nothing else;** the save and the condition live in the rule
  folded under and on the card after. A caveat the rules leave to the player is the one extra line.
- **One pick per group** ("only one maneuver per attack"); a maneuver AND a Cunning Strike on one
  hit is two groups. **Since 2026-09-24, one pick per HIT across the hit menu's own groups**
  (Combat Superiority, Giant Ancestry): the pick is one record — *Slice A* below, and the bends
  register above.
- **An affordable row opens the offer even under auto damage.** No dice left: the group shows *no
  dice left*, greyed.
- **The die rides the damage roll** as its own part, crit-doubled; the pool is spent on the sheet.
  **Sweeping Attack's die does not ride:** a popup asks for a creature within 5 feet of the
  target (the hold family's clock; at expiry the only creature, else nobody; the die spent either
  way), the elect rolls the die in the open, judges the ORIGINAL attack roll against that AC and
  applies through the receipt chokepoint.
- **The save is the pack's own activity** used at the hit target after the damage lands. A
  condition the pack left unlinked on the ITEM (Trip's Prone) is pressed on the failure. **The
  fighter never carries a target's effect:** the pack ships Goaded as a transfer effect, and the
  module corrects the wielder's own copy to `transfer: false` (NOTES §2).
- **The goader is exempt** (`except: "source"`); the inverse is `only: "source"` (Feinting Attack,
  Vow of Enmity, Clairvoyant Combatant, Strike Fear — markers the packs put on the creature the
  feature is USED ON).
- **A LINE option says what the table plays** (Maneuvering's ally move, Pushing's 15 feet),
  never automated. **A riposte's hit offers the menu too.**

What is read, never typed: the die (`@scale.battle-master.superiority.die` on the option's own
activity, resolved on the sheet), the pool (the activity's consumption target in the three shapes
the pack ships), the save, its DC, the condition. Precision Attack and Riposte stay folds
(`precision.js`, `riposte.js`). The seam it proved: the offer's contributions (`registerOfferPart`,
ARCHITECTURE §7).

## The rest of the maneuvers (2026-09-04/05)

**Every Battle Master maneuver lands on a machine that already exists, and no maneuver plays a
choice.** `superiority-uses.js`, `SUPERIORITY_USES`, `SUPERIORITY_FOLDS`; `smoke-superiority`,
`smoke-maneuvers`.

- **Parry is a damage interrupt that REDUCES by a roll** (`INTERRUPT_REDUCTIONS`): the pack's heal
  formula IS the reduction; the answer spends the die and the Reaction, rolls in the open, the
  applier lands the damage short by it. The Monster Manual's AC "Parry" stays an AC hold: the row
  applies only where the item carries the named activity.
- **Evasive Footwork, Bait and Switch, Lunging Attack and Feinting Attack are USES.** Evasive
  Footwork rolls the die and writes it on the AC until the fighter's next turn. Bait and Switch
  rolls and ASKS who wears the pack's "Baited AC +N" (the pack ships twelve; the cast slice is
  kept off every maneuver's card). Lunging Attack is a chip whose die is a ticked checkbox on the
  next melee hit's offer (the straight line is the player's fact). Feinting Attack marks the
  target with the fighter as source; the gate reads it as Advantage for the fighter alone, the
  next attack at that target spends it, the die rides.
- **Ambush and Tactical Assessment are d20 folds with a SCOPE** (the `tactical` spend, the
  feature's text naming which checks; Ambush on Initiative too, the original roll standing as
  history). No refund. **Used from the sheet FIRST, they ARM:** the use rolls the die, a chip
  carries it, a notice names the check, the next check the scope names folds it in.
- **Commander's Strike is a NOTICE and a chip, never a driven attack:** the elect puts a chip
  carrying the fighter's die on the ally until the end of the fighter's turn; the ally is told
  (OK only) and attacks from their own sheet; that damage folds the die in, spends the chip and
  the Reaction. No attack the module drives on someone else's sheet.
- **Rally needed nothing built.**

**One UI language for every maneuver:** the feature's art, the eyebrow `Maneuver — Name`, the
title `Name — what happened`, the spend, the rule; the popup `Name — who` with the maneuver's verb
and `Pass`; the recall `Answer — …`. **One wording for a spent die** (`Combat Superiority: 3 of 4
remaining`) from ONE reader (`poolSpendsOn`) over dnd5e's consumption deltas and the module's hand
spends alike, the hand spends through ONE pass-through (`spendSuperiorityDie`).

## Damage shields (2026-09-04)

**A ward on the defender pays out against whoever hits it, and there is no choice in it.**
Death Armor, Fire Shield and Armor of Agathys: a standing effect on the DEFENDER whose pack
activity deals damage to the ATTACKER when a melee attack roll hits. `damage-shields.js`,
`DAMAGE_SHIELDS`, the Damage Shields list; `smoke-shields`. The ward is found by the pack's effect
NAME, walked to its caster as a mark is, the caster's own activity rolled on the elect and posted
as the defender's, landed through the receipt chokepoint naming the ward. The reach is the
activity's own; once per turn is a chit on the defender; Fire Shield's type follows the shield
that stands; Armor of Agathys ships no effect, so the module MARKS the cast and the ward strikes
while the Temporary HP last. Judged only when the attack's DAMAGE lands, and judged ONCE at the
hit — a re-render never re-judges. Hellish Rebuke is a Reaction and the hold's.

## Effect choices (2026-09-05)

**A cast that offers a choice between effects asks the caster, and only the pick lands.** Fire
Shield ships Warm and Chill on one activity and marks nothing; the cast slice landed both. A popup
on the caster's own usage card at the cast, the cast waiting on the card until answered, the
card's button reopening it, the elect applying the one effect chosen. No clock. `cast.js`,
`EFFECT_CHOICES`, the Effect Choices list; `smoke-cast`. Not this family: Bait and Switch's fan
(the maneuver machine's) and an activity whose effects all stand at once (Bless, the auras).

## A listed reaction cast freestanding (2026-09-06)

**A reaction on the Interrupts list, cast with no hold waiting on the caster, self-aims like any
other SELF ability.** The v1.5.1 blanket carve-out is gone; the birth stamp asks whether a PENDING
hold names the caster (the hold's message exists before the answering cast's card) and only then
stands aside. Answering, the reaction is the hold's, once. `polish.js`; `smoke-cast` §6d, §6e; the
through-the-hold +5 is `smoke-hold`'s.

## Damage casts (2026-09-04, Heat Metal)

**A bare damage activity's dice are the module's to roll, once.** dnd5e follows a damage
activity's card with the damage ROLL DIALOG, which the module hides, so the dice never rolled. Now
a bare damage activity aimed at targets rolls at the use on the casting client (offered when the
caster wants their dice), the native follow-up switched off, landed by the no-attack applier with
a receipt. Volleys stay the volley machine's; a maneuver's damage activity is its die. **A listed
row demands the save its text ties to the damage** (`DAMAGE_SAVES`: Heat Metal's On Damage Save at
the same targets right after the dice; the drop is a judgment). `damage-casts.js`; `smoke-heatmetal`.

## Metamagic (2026-09-09, off `prototypes/metamagic.html`; Careful's ask 2026-09-18)

**Metamagic is a pick on the cast and a spend on the card; the module does the arithmetic the
option names and judges nothing else.** `metamagic.js`, `decide/metamagic.js`, `METAMAGIC`,
`TWINNED_EXCEPTIONS`, the Metamagic list; `smoke-metamagic`, `tests/decide-metamagic.test.js`.

- **The pick is a group in the system's own cast dialog** (one fieldset on the usage dialog's
  render hook; never the attack gate). Every row: a tick, the name, the cost as the tag, the rule
  folded under. A row the spell does not fit, or the points cannot afford, stays visible and greyed
  with the reason. **One option per cast.** Empowered and Seeking are later moments.
- **The spend is BY HAND** (`spendPoolUse` on Font of Magic, `poolSpend` on the spell's card, one
  line, the floating text every decrement gets), read by the ONE reader. Never refunded on a revert.
- **Careful lists NOBODY in the casting window; the creatures to spare are asked on the card**
  once the cast is out — the creatures the save REACHES, every non-hostile ticked by default up
  to the Charisma modifier, the demand waiting on the answer or the clock's default; a protected
  creature leaves the demand at BOTH filters (the stamp and the area's adoption). The tick is the
  player's; sight and willingness are never judged.
- **Heightened marks one target on the demand** (a radio in the window; nobody for a template
  spell) and the save gate reads it as a Disadvantage source.
- **Subtle and Quickened are a card line and a spend.** Components never read, the turn never
  policed.
- **Twinned is a DATA read** (the pack's target-count formula over the cast's level) corrected by
  `TWINNED_EXCEPTIONS` (Magic Missile and Scorching Ray out; Jump in); the count is never policed.
  **Distant** doubles the range the gate's reminder reads; **Extended** doubles the clock on the
  effects the cast creates (24 h cap) and gives the concentration gate an Advantage source;
  **Transmuted** retypes the cast's own damage parts; **Twinned** adds one creature to the target
  snapshot (`messageConfig`).
- **Empowered and Seeking are folds AFTER a roll.** Seeking is a d20 fold KIND, offered on a spell
  attack's miss beside Heroic Inspiration, one point by hand. Empowered opens on the spell's damage
  with the dice shown, up to CHA-mod picked and rerolled (Reroll greyed until a die is ticked), and
  PATCHES the damage message's own roll the way the dice rules do; damage already applied is moved
  by the difference as its own receipt. Both record old and new dice.
  Empowered is **damage only** ("when you roll damage for a spell"): a spell's healing, which dnd5e
  rolls through the same damage roll, is never offered it (the walk, 2026-09-26: Cure Wounds showed
  Empowered beside Healer's reroll).
- **The ask timer keeps rolling for PCs** — an afk table plays through. Careful is the fix for the
  excluded, not the timer.
- **Using an option from the SHEET arms nothing** (2026-09-24): the casting window is where
  metamagic lives; an armed-chip design was weighed and declined.

Read: the metamagic feats on the sheet (`type.subtype: "metamagic"`), Font of Magic as the pool,
the SPELL's own save, range, duration, damage types and target scaling. Not judged: sight, a
willing creature, a Twinned target's legality, whether a levelled spell was already cast this
turn. The 2014 options are ignored.

## Spells that choose their targets (2026-09-24, off the prototype *Creatures of Your Choice*)

**A placed area asks everyone it holds; a spell whose text says "creatures of your choice" asks
the caster who.** Slow was the case. `CHOSEN_AREAS`, the Chosen Areas list (the PHB's seven: Slow,
Sleep, Conjure Barrage, Conjure Volley, Word of Radiance, Destructive Wave, Weird — dnd5e's
`target.affects.choice` flags only four, so the flag is not the membership); `saves/demand.js`
`areaChoiceForDemand`. A spell that chooses by TARGETING needs nothing.

- **Asked only when there is a real choice:** the area holds someone not hostile, or more hostiles
  than the spell lets the caster choose (the number read off the spell's own text, never stored).
  Otherwise every hostile is the choice and the card still says who.
- **The question is the ask at the area** (Careful's popup, clock and answer — a third kind):
  the spell's sentence quoted, the hostiles ticked, a tick pinging the token; the clock keeps the
  ticked default; the caster and a corpse are never candidates; the demand waits, clockless.
- **Heightened on such a spell asks ONE question** (a Disadvantage radio beside each ticked row).
  **Careful greys** on a listed spell.
- **The picture waits for the answer:** the hold registry holds the cast's activity from the
  card's birth, and the answer lifts it.
- **The record** is `areaChoice` on the spell's card (`chosen`, `left`, `asked`), one line, and a
  `choice` moment when the caster was asked.

**The ask is its own machine since 2026-09-24** (user: "better to pay this debt now than later"):
`scripts/area-ask.js`, a service both metamagic and the saves machine route the question through
— the popup, the clock, the answer, the demand filled from it, `battleflow.areaAskAnswered`
published — with its arithmetic in `decide/area-ask.js` (the defaults, the words, the outcome).
A customer raises the ask by writing its flag (`newAsk`, `raiseAsk`) and may register an
ANSWER PART for what its answer writes (metamagic's record, its held card). The flag key stays
`metamagicAsk`: it is stored on cards, and a rename is a migration for nothing.

## Slice A — species and origin feats (2026-09-24)

**The first slice of the sweep: every PHB species trait and origin feat, read against the tables
that exist** (SWEEP §6 is the drawing — the measured inventory, what is NATIVE, OUT, parked and
held). Built on the user's "go" in three tiers, the UI ruled off `prototypes/slice-a.html`.

- **PHB first.** Arcana Unleashed's ten origin feats are the phase after (three need module work).
- **The tiers.** Tier 1: the save gate reads FEATURE rows, and Stone's Endurance on
  `INTERRUPT_REDUCTIONS`. Tier 2: Hill's Tumble on the hit menu, Fire's Burn and Frost's Chill as
  clock riders. Tier 3: *Rescuing the hit* (the `roll` interrupt) and *Savage Attacker*, below.
- **Check the existing shapes first — a STANDING RULE** (user, 2026-09-24: *"fires burn should
  pretty much have the same shape as that gloomstalker attack no?"* → *"yes you should switch"*).
  Reviewing any new feature starts by naming the PRECEDENT row — the table and the row it already
  resembles — before a table or a kind is chosen. Tier 2 first put all three Goliath boons on the
  hit menu; a Goliath owns ONE boon, so the hit never asks WHICH, only whether — the rider's
  question, not the menu's. The two with dice moved to `CLOCK_RIDERS` the same day.
- **One pick per hit on the hit menu, for now** (decided 2026-09-24): the offer keeps one tick
  across its groups. The trigger for the array shape is a Goliath Battle Master at the table
  (BACKLOG *Features*); the bend is in the register above.
- **One rescue row per SOURCE** (user, 2026-09-24: *"we already have that precedent with Precision
  and Heroic Inspiration, so it would just be more button choices"*) — Lucky, Warding Flare and
  Shadowy Dodge are three rows, never one "Disadvantage" row listing its sources.
- **Parked** (BACKLOG *Features*, each with its trigger): Trance. (Built in the walk, 2026-09-25:
  Inner Radiance's pulse and Celestial Revelation's extra damage — *The Aasimar walk*; Lucky's
  Advantage half and Relentless Endurance — *The species walk, continued*; Healer's healing
  rerolls — *The origin feats*; all below.)

**The save gate reads features** (tier 1; `EFFECT_BENDS` rows `match: "feature"` with a `saves`
facet; `decide/reminders.js` `rowCarriers`, one carrier test for the check gate and both save
readers). Brave, Fey Ancestry and Dwarven Resilience ship as text alone, so the row is carried by
the feature's NAME and scoped by the demand's statuses the Aura of Purity way: a save against a
demand that would impose Frightened (Charmed, Poisoned) counts Advantage. A save to END the
condition is a bare sheet roll with no demand — listed, not counted (the register). Dwarven
Resilience's Poison Resistance is the species' own advancement. `smoke-saves` §26,
`tests/decide-reminders.test.js`.

**Stone's Endurance reduces the hit by its roll** (tier 1): the second `INTERRUPT_REDUCTIONS` row,
Parry's shape — the pack's heal formula (`1d12 + @abilities.con.mod`) IS the reduction, rolled in
the open at the answer, one use of the item spent. It speaks in its own voice: the row carries its
eyebrow ("Reaction", not "Maneuver"), what one use is called, the trigger and the reduction in
words, stamped on the hold flag. The lookup is locale-proof (its activity's stored name is empty —
NOTES §2). Before the row it held as a plain damage interrupt: Cast used the heal (healing a
Goliath at full HP) and the whole hit landed "reduce by hand". Attack hits only (the register).
`smoke-superiority` §12.

**The Goliath's boons** (tier 2, switched the same day). **Fire's Burn and Frost's Chill ride as
clock riders** (`CLOCK_RIDERS` `when: "any"` — every hit, uses permitting; weapon, unarmed or
spell attack): a ticked checkbox on the offer like every rider, the die in the boon's own type,
one use of the ITEM spent (the species packs keep every use on the item), the offer and the card
calling it by the feature's name. Frost's Chill's own "Chilled" lands on the hit through
`effect-riders.js` `applyActivityEffectsOnHit`, clocked the Slow mastery's way — to the start of
the ATTACKER's next turn. **Hill's Tumble stays on the hit menu** as the Giant Ancestry group (no
feature to require — the parent is text only; each option pays from its own uses): a no-save
Prone press, receipted, never pressed over a Prone already standing, greyed "too large" when a hit
target's sheet says larger than Large (an unreadable size never greys it). A boon publishes
`rider`, not `maneuver`. `smoke-clock` §8–9, `smoke-hitmenu` §12–15.

## Rescuing the hit — the `roll` interrupt (2026-09-24, off `prototypes/slice-a.html`)

**A defender's Disadvantage on an attack roll already made: a second d20, the lower standing, the
verdict taken again.** Lucky's Disadvantage, Warding Flare, Shadowy Dodge — the third interrupt
KIND beside `ac` and `damage` (the R4 pin 30 → 31): not `ac` (the AC never moves, and a natural 20
can be undone) and not `damage` (it changes whether the attack hit). The three differ only in
what they COST, so the cost is data (`INTERRUPT_ROLLS`: the Reaction, an item use, what a use is
called, the answering activity, what the rule leaves to the table after). Membership is the
Interrupt list (`Name:roll`). `hold/answer.js`, `hold/lookup.js`, `decide/rescue-hit.js`;
`smoke-rescue`, `tests/decide-rescue-hit.test.js`, `tests/decide-verdict.test.js`.

- **Offered to the defender AFTER the roll shows a hit, before the damage** — the timing bend,
  accepted (the register). A crit can be undone, so the popup opens on a crit when a `roll` row is
  live, and the crit's dice wait for the answer (the register).
- **The hold's popup, grown rows:** every way to rescue the hit a ticked row — the reaction the
  list found (Shield, Parry) and every `roll` row the sheet holds — the name, what it does, a FACT
  as the tag (the cost, or why it cannot be taken), the rule folded under. **One row per source**
  (Slice A, above). Titled **"Rescue the hit — <defender>"** once several rows sit in it; one row
  keeps the house's `Name — who`. One tick at a time, Answer live only while a row is ticked — the
  tick stays even on a one-row popup. A spent row stays, greyed, its reason as the tag ("Reaction
  spent this round", "no Luck Points left", "already at Disadvantage", "a crit ignores AC").
  **Every row spent → no popup**, the way a spent Reaction has always skipped Shield.
- **The arithmetic** (`disadvantageOutcome`): a plain roll rolls a second d20 in the open with the
  attack's own die modifiers (a Halfling attacker's natural-1 reroll rides it), the lower standing;
  a roll with Advantage cancels to the first die, no second rolled (the register); a roll already
  at Disadvantage moves nothing, so the row is shown spent. The stood d20 carries its own crit and
  fumble — a natural 20 replaced by a lower die is no longer a crit — so it folds in as a
  `replace` beside the live AC, never an `add`.
- **The spend is by hand** (Parry's precedent: a `use()` would post a card, and Warding Flare's
  would place its 30-foot area): a Luck Point or a use through the one pass-through, the Reaction
  chip. A row used from the SHEET answers too — the ONE oldest pending hold that asks this defender
  with the row live (Disadvantage is imposed on "that roll").
- **The cards:** the defender's says what it cost ("1 Luck Point spent · Luck Points: 2 of 3
  remaining"; Shadowy Dodge's adds the teleport as a line — the table moves the token); the
  attacker's reads *"Lucky bent the roll — Disadvantage, 17 → 13, MISS"*, the struck d20 under it.
- **Known gaps** (DESIGN §8): Warding Flare protects its owner only; the attacker's own rescues are
  not re-offered after a bent miss.

## Savage Attacker (2026-09-24, off `prototypes/slice-a.html`)

**A popup on the weapon hit asks ONE thing — use it on THIS hit? — and on yes the higher set
stands with no second question** (R1: the rules leave no choice once both sets are seen). Once per
turn, and a Fighter with Extra Attack may want it for a bigger roll later, so whether is the
player's; which set is not. `damage-either.js` (a MACHINE), `decide/damage-dice.js`,
`DAMAGE_EITHER`, the Damage Rolled Twice list; `smoke-savage`, `tests/decide-damage-dice.test.js`.

- **The question waits for the hit to stand.** The damage message is born with the fold due and
  the application held (a second claim in `auto-apply.js`); the popup opens only once the
  defender's hold is off the roll — the card says "asks once the hit stands" meanwhile — and a
  hold that turned the hit into a miss resolves it moot. The dice land ONCE, with the set that
  stood.
- **The popup is a one-row tick** (the tick stays on a one-row popup, the ruling): "Roll again"
  dark until ticked, "Keep the roll"; the clock keeps the roll.
- **"The weapon's damage dice"** are every die of the activity's own damage rolls — counted at
  `preRollDamage` before any rider pushes its roll, the doubled set on a crit — never a modifier,
  never a rider's dice. Rolled again as ONE set on its own card; the higher total stands (a tie
  keeps the first); the damage roll shows both, the loser struck.
- **Once per turn** is the clock riders' turn chit (`riderKey` `savage-attacker`), counted only for
  a combatant; a second hit the same turn carries only the tag "used this turn". A weapon item
  only. Damage already applied is moved by the difference (the ARCHITECTURE §11 obligation,
  Empowered's `moveAppliedDamage`) — with the claim holding the application, a belt, not the road.
- **Not a kind:** one table read by one machine, the `CLOCK_RIDERS` / `METAMAGIC` shape; a second
  customer is a row. The published word is `fold`.

## The Aasimar walk (2026-09-25, the Slice A walk by hand)

**The walk goes species by species, then the origin feats; each opens with a *Trait | What you
should see* table** (user, 2026-09-25). The Aasimar's findings, each ruled in the walk and built on
the user's word; `smoke-aasimar` (29 checks), `tests/decide-token-lights.test.js`, and the
Celestial Revelation cases in `tests/decide-clock.test.js` / `tests/decide-emanations.test.js`.

- **Every area that starts on its user lands on the user's token — no placement click** (user:
  *"it should always just be centered on the token without additional placing"*; the class ruled
  as *every self-centered area*). The Spirit Guardians idiom, generalized (`emanations.js`
  `selfAreaOf`): a `radius` (or `emanation`) template with range self — any spell, species form or
  monster feature — has the system's placement prompt switched off and its Region placed at the
  use, attached to the token, the placement's own flags stamped. A listed emanation spell's region
  stays the machine's (no platform behaviour); every other area is the platform's, its own
  behaviours on it. **None is drawn** (user, 2026-09-25: *"it can be invisible, just like inner
  radiance"* — the ring ruling of 2026-09-18, reaching every area placed on a token). The Emanations switch gates it.
- **An area whose activity names who it affects is read that way** (`decide/emanations.js`
  `affectsAdmits`; the save demand's area adoption): `enemy` takes everyone not on the user's side,
  `ally` the user's side. Necrotic Shroud (`enemy`; *"creatures other than your allies"*) no longer
  asks the Aasimar's friends beside it.
- **Necrotic Shroud's Frightened lasts until the end of the Aasimar's next turn** — a PACK defect
  (60 seconds), fixed in **Vendor Fixes VF-002** (user: *"put the fix in the vendor fixes sister
  repo"*), never here: the copy's clock becomes the system's `sourceEnd`. Battle Flow depends on it
  (the register's Dependents).
- **Inner Radiance pulses** (user: *"inner radiance needs to pulse - you can probably shape it like
  spirit guardians in part"*). An `EMANATIONS` feature row with three new fields: `while` (it
  stands only while the form's effect, Searing Radiance, stands on the bearer — the transformation
  ends, the ring goes), `reach: "all"` (*"each creature within 10 feet of you"* — allies included,
  as written; user: *"Everyone, as written"*), and `pulse` (at the END of the BEARER's turn — no
  region event carries it, so the turn moving is read — the activity's own `@prof` part rolled once
  on the bearer, applied to everyone the ring holds on one card with receipts; forward moves only,
  once per ended turn). Out of combat there are no turns and no pulse.
- **No damage at the transform** (user: *"No damage at transform"*): the pack models the pulse as
  damage on use; the use is the transformation alone — no area placed, the system's follow-up roll
  off, and the bare-damage machine (`damage-casts.js`) steps aside for a pulse form. The pulse is
  the damage. (Built here, not in Vendor Fixes: the pulse reads the pack's own damage part.)
- **Token lights** (user: *"add the bright/dim light settings … edit the Light spell so it adds light
  emission to a token target as well"*): a new table, `TOKEN_LIGHTS`, and machine,
  `token-lights.js`; the Token Lights list. Foundry 14 applies an effect change keyed `token.*` to
  the bearer's tokens (`light` is a targetable key), so the light is two changes on an effect and
  lives and dies with it — no token document is written. **Inner Radiance** lands its own Searing
  Radiance on the Aasimar (nothing else lands a damage activity's effect on its user) with 10 ft
  Bright / 20 ft Dim — that effect is what the ring's `while` and the rider's form read. **Light**
  cast at targeted tokens lights each (20 / 40, the spell's hour) instead of summoning its object;
  casting it again puts the caster's earlier light out; cast at nobody, the pack's summon stands.
  **Any targeted token** (user: *"Any targeted token"*) — friend, foe or self; the rule's "object
  not worn or carried by someone else" is the table's to name, and the PHB's Light has no save.
- **Celestial Revelation's extra damage** (user: *"you need to add this in and not skip it"*): a
  `CLOCK_RIDERS` row with no activity — its `amount` is the text's `@prof` — judged `transformed`
  by the FORM that stands (`forms`: Heavenly Wings' and Searing Radiance's own effects, and for
  Necrotic Shroud, which lands nothing on its bearer, the module's form chip written at its use,
  matched by flag — never by the name a frightened creature also wears). Radiant, or necrotic for
  the Shroud; once per turn by the rider chit. An attack — weapon or spell — carries it on the roll
  like every rider. **A spell with no attack roll** may hit many and the extra goes to ONE target,
  the caster's choice (R1): once its damage lands, its card offers a button per damaged creature;
  the pick lands on its own card with a receipt (the bend: the register).

## The species walk, continued (2026-09-25)

**Every PHB species walked and passed on the sandbox, one at a time** (the user's order, each
opening with its *Trait | What you should see* table; the roster was the `BF Species` actors,
level-5 characters built through dnd5e advancement). The findings, each ruled in the walk and built
on the user's word. The full battery proved them on 2026-09-26.

- **Dragonborn, Elves' Fey Ancestry, Gnomish Cunning, Halfling's Luck, Skillful, Versatile,
  Adrenaline Rush, Fiendish Legacy** — native or already Slice A's; no findings.
- **Stonecunning** (user: *"just run it always and assume stone ... change the vision type to
  tremor sense for the duration"*): a new table, `TOKEN_SENSES`, and the Token Senses list — the
  pack's own Stonecunning effect gains Tremorsense vision and Feel Tremor detection (60 ft) as it is
  created, so the sense lives and dies with the effect.
- **Pass without Trace** (user: *"an emanation similar to the paladin one, but grants +10
  stealth"*): an `EMANATIONS` row (spell, helpful, the pack's Concealed effect). The pack's spell
  carries no area — **Vendor Fixes VF-003** gives it the 30-foot Emanation.
- **Tinker** (user: *"just give a buff called tiny clockwork device ... the rest is played at
  table"*; reworked: *"a popup to create the clockwork with x/3 remaining ... to max 3"*): a new
  table, `CARD_CHIPS`, and the Card Chips list — the Rock Gnome's Prestidigitation cast asks
  *Build it* / *Not now* with the count; each device is its own chip (the `stacks` flag); a build
  at three asks which to remove first; the card's button recalls the ask.
- **The Goliaths** — the boons' uses shown ("2 of 3 uses left", read off `@prof`); **Large Form**
  resizes the token (`TOKEN_SIZES`, the Token Sizes list, Enlarge/Reduce beside it); **Storm's
  Thunder** is the first row of `REBUKES` (`rebukes.js`; Hellish Rebuke, Fount of Moonlight,
  Retaliation and Sword of Answering beside it) — a popup to the damaged creature when its dealer
  stands inside the reaction's own range, and the thunder lands on the DEALER; **Stone's Endurance
  on any damage** the module applies (ruled *"Hold before it lands"*: `damage-holds.js` claims the
  share at `auto-apply.js`'s `registerDamageClaim` and asks in ONE popup; the click rolls and lands
  the damage reduced); **Powerful Build** as a proxy (Advantage on Athletics/Acrobatics while
  Grappled, an `EFFECT_BENDS` `checksWhen` row). Three rows in the register.
- **Lucky's Advantage half** (user: *"we need to unpark the advantage on our own d20"*; ruled off a
  prototype, not kept): the gate's BUY box — "Lucky — 1 Luck Point · N left" with an
  Advantage tick in any attack, save, check or initiative dialog, counted in the net and the
  default, spent when the roll goes out ticked (`advantage-buys.js`, the Reminder Sources `buy`
  row). Initiative with no dialog is the fifth D20 fold kind, `advantage` (ruled *"After the
  roll"*): a second d20, the higher standing (the register). `smoke-lucky`.
- **Resourceful** (user: *"just needs [Heroic Inspiration] to be ticked on long rest"*): a new
  table, `REST_GRANTS`, and the Rest Grants list; the grant rides the rest's own actor update
  (`dnd5e.preRestCompleted`), the rest card names it; a Short Rest gives nothing. `smoke-rest`.
- **Relentless Endurance, with Death Ward** (user: *"if something takes them to zero, then a popup
  should ask to use the feat. same shape as death ward which you should do now too"*): a new table,
  `DROP_TO_ONE`, and the Drop to 1 HP list (`drop-to-one.js`) — at `dnd5e.preApplyDamage` the HP is
  written as 1 in the damage's own update; Relentless Endurance ASKS (Drop to 1 spends the use,
  Drop to 0 or the clock lands the 0; never against an outright kill); Death Ward is automatic, its
  effect removed. Sheet-typed HP goes around it (the register). Slice B adds its monster rows.
  `smoke-drop`.
- **Hellish Rebuke from Fiendish Legacy**: a spell with its own use left needs no slot — the
  rebuke casts with `consume.spellSlot: false` and the use pays.

## The origin feats (2026-09-25, off `prototypes/origin-feats.html`)

**The five PHB origin feats with a table moment, walked on the `BF Feats` roster** (level-5
characters built through advancement, the feat the background's own). Tough, Magic Initiate,
Crafter and Skilled are native or out of combat. Proved by the full battery, 2026-09-26.

- **Savage Attacker's hint** (the walk, off `prototypes/savage-hint.html`): a die meter in the popup's header (the first roll against
  the average, the odds a second beats it); the tick starts TICKED on a roll under the average;
  both buttons side by side, the tick greying the other. The clock keeps the roll.
- **Tavern Brawler's push** (user: *"mimic the shield master push"*): the maneuver-fold kind
  `shove` in `bash-offer.js` — Push 5 feet / Pass after an Unarmed Strike hit's damage, once per
  turn in combat, announced (the module never moves the token). **Its die on the plain Unarmed
  Strike** (user: *"every time I roll unarmed strike damage it's a 4"* → *"Module swaps it"*, *"but
  give some kind of notice"*): a new table, `UNARMED_DICE`, and the Unarmed Strike Dice list
  (`unarmed-dice.js`) — the flat 1 + Str becomes the formula the feature's own unarmed attack
  carries (1d4r1 + Str) at `preRollDamage`, with one line on the damage card; a strike already
  rolling a die is left alone.
- **Healer's rerolls** (ruled off the prototype: the 1s start ticked): a new table, `HEAL_REROLLS`,
  and the Healing Rerolls list (`heal-rerolls.js`, the heal applier's claim in `cast.js`) — a
  healing roll showing a 1 opens a popup with every die as a chip, the 1s ticked; the healing
  waits for the answer and lands once. **Battle Medic on the Healer's Kit** (user: *"if in 5 feet,
  give the 'caster' of healer kit option to choose hit dice and make the roll for the other
  player"*, *"and then reroll 1 option"*): a new table, `KIT_TENDS`, and the Kit Tending list
  (`kit-tend.js`) — the kit used on one creature within 5 ft asks which of ITS Hit Dice (the
  largest ticked); Tend spends the die and rolls the feat's own Heal dN, so the rerolls popup
  follows. **A picked die shows** — `paintDieChip` (ui.js) for this popup and Empowered Spell's.
- **Alert's Initiative Swap** (ruled: the player's pick is the ally's willingness): a new table,
  `INITIATIVE_SWAPS`, and the Initiative Swaps list (`initiative-swap.js`) — once every combatant
  has an Initiative, the holder is asked once per combat with the tracker in order; the allies on
  its side who are not Incapacitated are pickable, their portraits framed in the MAP's disposition
  colours (ruled *"Map colours"*); a pick previews the trade; Swap exchanges the two numbers.
  The tracker's Reset Initiative re-arms it (`Combat#resetAll` is ONE Combat update).
- **Musician's Encouraging Song** (user, the Rest Grants shape): a `to: "allies"` row on
  `REST_GRANTS` — after a Short or Long Rest a popup lists the allies within 30 ft, those without
  Heroic Inspiration ticked up to the Proficiency Bonus, those with it greyed "(has it)"; OK ticks
  their boxes.

## The fighting styles (2026-09-26, off `prototypes/fighting-styles.html`)

**Every PHB Fighting Style measured against the pack, and the gaps built on the user's go.** The
rulings: *"one table"*; *"gate it on what pc is holding - not overall rule, we want flows to work,
not editing items"*; *"the feats that do weapon mods should be effects on the player ... so itd
show in the detailed buff bar"*; the notice **B**, the guards **P1**, Protection **R1**, Unarmed
Fighting **U1**, *"truesight yes"*. `smoke-styles` (31 checks), `smoke-guards` (15),
`tests/decide-fighting-styles.test.js`.

- **Native, nothing built:** Archery (the pack's +2 on ranged attacks — dnd5e counts a thrown
  melee weapon as ranged too, and that reading stands), Blessed Warrior, Druidic Warrior, Arcane
  Warrior (Arcana Unleashed).
- **The Fighting Styles table and list** (`FIGHTING_STYLES`, `fighting-styles.js`): each listed
  style keeps ONE effect on the character — its **face** — live, or disabled with the reason ("a
  second weapon held (Dagger)", "no armor worn"), read off the sheet's **Equipped** boxes (held =
  equipped, the register). The effect view's panel lists it (Passive when live, Unavailable with
  why when off; never the bar). Where the pack ships an UNGATED effect (Defense, Dueling — their
  notes say "disable it when …"), the machine switches that off and the face carries the rule
  (Defense's AC change, read off the pack's effect); unlisting the style gives it back.
- **The face on the panel is ONE line, no suffix** (the walk, 2026-09-26: "i only want one line";
  then "just remove the (weapon) suffix. the player can figure things out"): "Fighting Style:
  Great Weapon Fighting"; why it is off is the hover title. Consistent across every style
  ("whatever the official feat name is"): a Fighting Style feat's OWN effect (Blind Fighting's
  senses) is titled by the feat too, found by dnd5e's `fightingStyle` subtype. **Thrown Weapon Fighting's face is
  always on** — the attack's thrown mode is its whole gate ("the user selects the thrown attack
  mode").
- **A face that turns on or off floats core's own toggle** with the panel's title in it —
  "+(Fighting Style: Defense)" / "−(Fighting Style: Defense)", drawn as core draws every effect's
  (the walk, 2026-09-26: "the toggle should be the standard +/- every other effect uses"; "match
  the buff name"); the module draws it for every face, since core floats only an effect with
  changes, and quiets core's on the face writes so Defense floats once.
- **The numbers on the roll** (`preRollDamage`, by the attack's own mode): **Great Weapon
  Fighting** floors every damage die of the attack at 3 (`min3`, a crit's doubled dice included —
  "a damage die"), only in two hands with a Two-Handed or Versatile melee weapon; **Thrown Weapon
  Fighting** +2 on a thrown attack; **Two-Weapon Fighting** the ability modifier back on the
  off-hand attack (dnd5e keeps a negative one already); **Dueling** +2 (the pack's number) with one
  melee weapon in one hand and no other weapon — a Versatile weapon swung two-handed says "Dueling
  off — two hands", and nothing else does (a line on every Greatsword swing was noise).
- **The notice, L4 + F7** (the walk, 2026-09-26, ruled off the Artifact "GWF Notice Options":
  "the player needs something fun or cool when they see it doing extra damage on the canvas, like
  they appreciate takig the feat, but it should be unobtrusive"; "like the empower where you pick
  dice is fun, or savage attacker, but oviously for these it cant require clicks"). Per style that
  CHANGED the roll, the damage card's line shows the attack's own dice as Empowered's chips, in the
  card's own ink (the gold line read badly on the parchment): a die Great Weapon Fighting raised
  turns over from its face to what it counts, once as the card is born, and keeps a gold edge
  (bronze on the light theme) with the old face ghosted; the gain follows ("+2"). A flat bonus
  (Dueling, Thrown, Two-Weapon) is one more chip. On the canvas the same chips rise off the
  ATTACKER's own token, the turned die flipping with a gold flash, about a second and a half,
  never over the target (its damage number stands alone); off with core's scrolling-status
  setting. The `fightingStyle` record carries each style's `gain` for the stats reader
  (ARCHITECTURE §4) and the chips' `dice`. A floor that raised nothing leaves no trace.
- **The dice that rise — THE RULE, settled; do not reopen** (the walk, 2026-09-26: "make this a rule
  too so we dont keep revisiting"; its shape: a reaction, or a situational effect — "eg gwf, duelist,
  twf, etc"). The canvas dice (`dice-rise.js`, every client sees them) play for:
  1. **A reaction — or a spend — that modifies a roll already made**: the bent d20s (Protection,
     Lucky, Warding Flare, Shadowy Dodge); the reductions (Interception, Parry, Stone's Endurance —
     the die off whoever reacted, "−N" drifting to the one protected); Shield's "+5 AC"; a fold's die
     or reroll (Bardic Inspiration, Tactical Mind, Heroic Inspiration, Lucky); Empowered's, Healer's
     and Savage Attacker's rerolls; Cutting Words when it is built.
  2. **A situational effect** — one that fires only when its circumstances line up, not every turn
     by default ("not like every turn by default"; "situational is best"), so
     the player needs to SEE that it did: the Fighting Styles (Great Weapon Fighting's floor, Dueling, Thrown,
     Two-Weapon), and the dice the platform changes on its own (`changedDice`: Halfling Luck,
     Reliable Talent, Elemental Adept, Tavern Brawler).
  Nothing else. Dice ADDED every time as the roll is made — Sneak Attack, Divine Smite, Hunter's
  Mark, Bless, Bane — stay on the card ("its kinda spammy if we take it too far ... it does open the
  floodgates"). A new rule is sorted by these two, not re-asked.
- **Unarmed Fighting:** its die on the sheet's plain Unarmed Strike rides the Unarmed Strike Dice
  table (a `hands` row: the feat's d8 attack with nothing held, its d6 otherwise; two rows on one
  actor swap in the larger die). **At the start of the turn** (U1) the owner of a grapple is asked
  "Deal 1d4 to the … you're grappling?" — Deal it uses the feat's own Grappled Damage activity at
  the pick; the clock deals it to the one creature known to be held (the register).
- **Blind Fighting — who sees the unseen** (`decide/reminders.js` `sightOf`): Invisible's own
  clause ("If a creature can somehow see you …") read off the senses — a creature whose Blindsight
  reaches the other sees it (the hidden too), whose Truesight reaches it sees the invisible; the
  condition's bend is LISTED with why, never counted. Any creature's senses, not the feat's alone.
- **The guards — Protection and Interception** answer for the creature BESIDE them, a new shape:
  every creature within 5 ft of the one hit, on its side, not the attacker, holding what the style
  demands (a Shield; a Shield or a Simple/Martial weapon), its Reaction free (the register: the side
  is read, sight is not). **P1:** each guard gets a popup of its own; any act settles the moment, the
  first winning; a pass settles it only when everyone asked has passed. **Protection (R1)** is a
  `roll` row with `ally` — asked after the roll shows a hit, Lucky's shape: the second d20, the
  lower standing, the attack card naming the guard; then "Protected — <guard>" lands on the
  protected creature until the start of the guard's next turn, and the gate gives every attack at it
  Disadvantage while the guard stands within 5 ft (`EFFECT_BENDS` "Protected (Protection)":
  `named`, `item`, `sourceWithin`). When the attack already rolled with Disadvantage the guard is
  still asked — greyed, "no effect — already at Disadvantage", the popup saying Disadvantage doesn't
  stack and the Reaction is better kept, the button "Keep my Reaction" (the walk, 2026-09-26: "pop
  it up, but say its not worth spending reaction"). **Interception** is an `INTERRUPT_REDUCTIONS` row with `ally` —
  the attack's damage is claimed at the applier (Stone's Endurance's seam), the first guard to
  intercept rolls 1d10 + PB and the damage lands short by it.
- **Found on the way:** dnd5e 6.0 stamps an applied effect's origin with the ACTIVITY, so the gate's
  `item` discriminator never knew the item — Protection from Evil and Good's "Protected" matched
  every "Protected" (the Aura of Protection's included). The gate reads through to the item now.

## The PHB feats — the party's own (2026-09-26)

**The feats the table's players took, first.** The slice opened on the party's sheets (prod):
the origin feats and styles were in already; of the PHB general feats, Great Weapon Master and
Heavy Armor Master (Morgash), Shield Master (Invictus), Fey-Touched (Gren). The user: *"i cant
beleive weve been missing damage on gwm!"*; *"heavy armor master should have that blocking damage
like stones endurance / protectin does"*; *"great weapon master is also the situational bonus w
damage"*; Interpose Shield **B**, bent by choice (the rule-of-cool table above). `smoke-styles`
§11–§12, `tests/decide-fighting-styles.test.js`.

- **Two rows on `FIGHTING_STYLES`** (the table's comment asked for it: a second customer is a row),
  `feat: true` so the face and its float wear the feat's own name, not "Fighting Style:".
- **Heavy Weapon Mastery** — gate `heavy`: the face is live with a Heavy weapon equipped; a Heavy
  weapon's damage on the owner's own turn gets +PB on the roll, "Great Weapon Master — +3" on the
  card and the +3 chip rising off the attacker (the dice that rise, the situational kind); an
  Opportunity Attack says "off — not your turn". The pack's separate "Heavy Weapon Damage" button
  stays on the sheet — pressing it as well would add it twice. Hew was in already (`hew.js`).
- **Heavy Armor Master** — gate `heavyArmor`, `takesOver` (the pack's always-on `traits.dm`
  effect is switched off — every copy of the feat by name, found when a lent copy sat beside the
  fixture's own and the damage was cut twice); `block: "@prof"` on an attack's Bludgeoning,
  Piercing and Slashing damage at `dnd5e.preCalculateDamage`, so the card's own buttons carry it
  too. The block pops "−3" over the armored creature on every client (Stone's Endurance's pop, no
  roll — it rides the damage's own actor update) and the receipt row says "Heavy Armor Master —
  blocked 3".
- **Native, nothing built:** Shield Master's bash and Interpose Shield (built in v1.19, the
  maneuver folds), Hew, Fey-Touched (Misty Step and its spell, the pack's own free casts), Tough.
- ⚠ **A world's Fighting Styles list is stored**: the new default adds the two names; a world with
  the old value runs neither until the names are added (or Reset Defaults).

## The PHB feats — the scope (2026-09-26)

**The user's first pass over the 2024 PHB feats not yet in, ruled off one list.** The origin
feats, the fighting styles and the party's own (above) were in; the rest were read against the
pack (`tools/scan-corpus.mjs`, the sandbox, 2026-09-26) and sorted. The user pulled back every
feat whose shape the module already has (*"inspiring leader, its just like musician"*, *"chef
as well, same shape again"*, *"skulker, some shapes like fs: blind"*, *"keep slasher"*).

- **Out: the epic boons**, all of them (*"scope out epic boons"*).
- **Out, nothing for Battle Flow to do (19):** Ability Score Improvement, Actor, Athlete,
  Durable (the pack's effect gives Advantage on death saves; Speedy Recovery is its own
  activity), Dual Wielder, Heavily Armored, Keen Mind, Lightly Armored, Martial Weapon Training,
  Medium Armor Master, Moderately Armored, Observant, Resilient, Ritual Caster, Shadow-Touched,
  Skill Expert, Speedy, Telekinetic, Telepathic.
- **In, to build (13)** — the precedent row named per feat before a table is chosen (SWEEP §1):

| Feat | What Battle Flow owes | The shape it looks like |
| --- | --- | --- |
| Chef | Replenishing Meal's extra 1d8 on the allies' Hit Dice during a Short Rest; Bolstering Treats after a Long Rest (the pack's own heal activities) | Musician's rest grant; the meal lands DURING the rest, the others after |
| Crossbow Expert | no Disadvantage for a ranged attack within 5 feet | a range-row canceller (SWEEP §3 item 6) |
| Elemental Adept | the chosen type's resistance ignored; its 1s count as 2s — the pack ships text only | dnd5e's `ignore.resistance` set off the attacker's feat, at the damage chokepoint Heavy Armor Master uses |
| Inspiring Leader | temp HP to up to six creatures within 30 feet after a Short or Long Rest | Musician's rest grant, a temp-HP grant |
| Mage Slayer | Disadvantage on the concentration save its damage forces; Guarded Mind turns a failed Int/Wis/Cha save into a success | the concentration machine; a save fold |
| Piercer | reroll one Piercing damage die once per turn; the crit's extra die | Savage Attacker's damage-die kind |
| Poisoner | Potent Poison: the poison damage ignores resistance (Apply Poison and the doses are the pack's) | Elemental Adept's, one row |
| Polearm Master | Reactive Strike when a creature enters the reach | a reaction attack, Riposte's shape — ⚠ the trigger is movement, measure first |
| Sentinel | the reaction attack on a Disengage or an attack on someone else; Halt, speed 0 on an Opportunity Attack's hit | Polearm Master's, built together |
| Sharpshooter | cover, long range and an enemy within 5 feet cancelled | the range-row canceller |
| Skulker | nothing, measured 2026-09-26: the pack's effect is already named Skulker in the view, and nothing ends Hidden on an attack (dnd5e 6.0.5 nor the module), so Sniper has nothing to keep | the gate's sight (`sightOf`) already reads its Blindsight 10; Fog of War is the pack's |
| Slasher | Hamstring: speed −10 feet on a Slashing hit, once per turn; the crit's Disadvantage (NOT in before — see the second pass) | a hit rider, Frost's Chill's shape |
| Spell Sniper | cover and an enemy within 5 feet cancelled for spell attacks | the range-row canceller |

- **Kept open, a lean either way (5):** Charger (the damage or push after a 10-foot straight
  move — movement the module does not track), Crusher's 5-foot push, Grappler's Punch and Grab,
  Mounted Combatant's rest (no mount at the table), War Caster's Reactive Spell.
- **The second pass (user, 2026-09-26, off the measurement):** Elemental Adept's type is read off
  the item's NAME ("Elemental Adept (Fire)"); Chef's Bolstering Treats become temp HP handed out
  after the Long Rest (a bend by choice); Crusher's push joins the build (Tavern Brawler's shove);
  Charger, Grappler's Punch and Grab, Mounted Combatant's rest and War Caster's Reactive Spell are
  PARKED. ⚠ Correction: Crusher's and Slasher's crit halves were NOT in — `EFFECT_BENDS` rows
  nothing applied, and the pack's "Slashed" is Hamstring's speed −10. The build is six groups;
  1–3 are built (below), 4–6 since 2026-09-27 (*The PHB feats — groups 4–6*,
  Polearm Master included).
- ⚠ **Measured, and a comment corrected with the build:** `decide/dice-chips.js` says dnd5e floors
  Elemental Adept's 1s to 2 on its own; the pack ships the feat as text only, so nothing does.

## The dice changers — automatic where there is no choice (2026-09-26)

**A dice change that can never make the roll worse is not a choice, so it asks nothing** (DESIGN R1;
the user, the PHB feats walk: *"make adept automatic, fix healer that way too"* — *"yea then its
consistent with that great weapon one"*). The "you can" in Elemental Adept's and Healer's text has
one sensible answer, the way Great Weapon Fighting's does.

- **Elemental Adept stays automatic** — its type's 1s count as 2 (the `min2` floor, group 1).
- **Elemental Adept's type is asked as the feat LANDS** (the user: *"how to assist players ... when
  they level up ... they will have the unautomated version of the feat"* — *"A is good"*): the pack's
  copy carries no type, so a typeless copy arriving on a character (a level-up, a drag, a drop) posts
  a card to its owners and opens a popup — Acid, Cold, Fire, Lightning, Thunder, less the types its
  other copies already name, and Later. The answer renames the copy "Elemental Adept (Fire)"; the
  card's Choose type… button asks again; a rename by hand settles the card too; and a click on a
  typeless feat on the sheet (its own card, `dnd5e.displayCard`) asks there as well (`fighting-styles.js`,
  the row's `choices`).
- **Healer rerolls every 1 as the dice land** — no popup; the healing waits for the new dice and
  lands once, the new die on its own card and over the healer on the canvas (`heal-rerolls.js`, the
  same road, the ask taken out).
- **A reroll keeps its die's floor** (`decide/damage-dice.js` `rerollFaces`): a new face under the
  term's `minN` counts N, the way Foundry's `Die#minimum` counts it — so Gren's Empowered reroll that
  lands on a fire 1 is still a 2, and a Piercer reroll under Great Weapon Fighting is still a 3.
- **The choices keep their popups**: Empowered Spell (a point, the dice picked), Savage Attacker and
  Piercer (once per turn).
- **One shared dice popup** was drawn and liked (*"the ui looks good for the dice rerollers"*,
  [prototypes/dice-popup.html](prototypes/dice-popup.html)), parked the same hour, and BUILT on
  2026-09-27 — *The dice changers — one popup*, below.

## The dice changers — one popup (2026-09-27)

**Every feature that changes a damage roll's landed dice is a row of ONE popup per roll** (the
user: *"maybe its time to solve for dice changers to fix the piercer/savage attacker"*; the shape
off [prototypes/dice-popup.html](prototypes/dice-popup.html), less Healer and Elemental Adept, which
were ruled automatic). One machine, [dice-changers.js](scripts/dice-changers.js), replaces the two
copies (Empowered's in metamagic.js, Savage's and Piercer's in damage-either.js — gone).

- **The rows.** Empowered Spell (pick up to CHA-mod dice, 1 SP at the answer), Savage Attacker (the
  weapon's set again, the higher stands), Piercer (one die again, the new roll stands). A character
  holding two of them on one roll gets one popup with both rows — the Piercer-beside-Savage gap
  (BACKLOG, 2026-09-26) is closed. A spell attack dealing Piercing damage (Ice Knife) can show
  Empowered and Piercer together.
- **The order: pick, then set, then one** (the user's pick, *"Savage first, auto die"*). One Apply
  runs the ticked rows in that order; **Piercer's die is chosen AFTER Savage's set stands**, off the
  faces standing then — still never asked which die (the group 3 ruling), and never wasted by a set
  that replaced it.
- **The ticks.** A roll-again row starts where its die meter leans (option D, 2026-09-25: under the
  average, ticked); the meter shows the first roll-again row's odds. Empowered's row follows its
  chips — a pick ticks it, the last chip let go unticks it — so a point is spent only on dice chosen.
- **The buttons** — both, the ticks pick which is live (the Savage popup's rule, 2026-09-25): Apply
  while the plan does something, Keep the roll while nothing is ticked. One row asking keeps its own
  words ("Roll again", "Reroll the picked dice"); two or more say "Apply" and ask "change the dice?".
- **The record** is `diceChange` on the damage message, one per roll, a row per feature; born due at
  `preRollDamage` (Empowered too, now), promoted once the attack's hold is off the roll, a claim
  on an attack's application while it asks (the dice land once). The old `either` and `empowered`
  keys are no longer written; a card from v2.4.0 or earlier still reads its line on a reload.
- **One announce card** carries every step's fresh dice (Dice So Nice rolls them), a line per step,
  and the canvas replay of all of them in order; each roll-again row writes its own once-per-turn
  chit; the moment publishes once per row (`fold` for a set or one die, `metamagic` for Empowered).

## The hit menu — a pick per group (2026-09-27)

**One pick per GROUP, and a pick in each group rides the one hit** (the user: "fix them all";
BACKLOG since Slice A, 2026-09-24). "You can use only one maneuver per attack" binds Combat
Superiority's own rows; Giant Ancestry's Hill's Tumble is not a maneuver, and the rules let a
Goliath Battle Master knock the target Prone AND ride a maneuver on one hit.

- **The offer**: a tick unticks only its own group's other rows; with two groups the line says
  "one pick per group".
- **The records are lists** — `hitPick` on the attack (`picks`), `hitManeuver` on the damage roll
  (`picks`), read through one reader (decide/hit-menu.js `picksOf`, which reads a record from
  before the list as a list of one). A die rides the roll as its own part per pick, a pool is
  spent per pick, a card per pick, the moment published per pick (`maneuver` for a Superiority
  die, `rider` for a Giant Ancestry boon).

## Trance (2026-09-27)

**"Magic can't put you to sleep" — a save against magic whose failure would put the Elf to sleep
cannot fail** (the user: "fix them all"; parked since Slice A). The 2024 Sleep spell says it
outright ("Creatures that don't sleep, such as elves … automatically succeed").

- **Which demands sleep is read off the data**, never a spell list: the demand stamps `sleep` when
  the spell's name or one of its failed-save effects' names says sleep (Sleep, Symbol's Sleep,
  Eyebite's Asleep — decide/demand.js `putsToSleep`), beside `spell` (a spell or a magical item —
  "magic"). A sleep that is not magic (a monster's breath) is not Trance's.
- **The shape is the automatic failure's mirror**: a `succeeds` facet on the effect table's feature
  row; the save gate nets `succeeds` and adds a green **Succeeds** button, the default; pressed, the
  verdict is SAVED with no die ("cannot fail (Trance)") and the failed-save effect never lands;
  the buzzer takes the same fold. A condition's automatic failure stands over it.
- **A sheet roll with no demand lists the row** (the facet's scope, "it cannot fail if this is
  one"), as every save facet is listed there; a concentration check never takes it.
- **The Long Rest in 4 hours** is the platform's rest, untouched.

## The PHB feats — groups 1–3 (2026-09-26)

**Built in one autonomous pass** (the user: *"work autonomously til done with 1-3"*), off the scope
above. The calls made while the user was away are marked ⓐ. **WALKED 2026-09-26 on Party Camp**
(`tools/content/place-feats-walk.mjs`), feat by feat, all eight good; every ⓐ call stands, with one
later ruling: Elemental Adept's floor stays automatic and survives a reroll (*The dice changers*,
above). The range feats keep no list of their own
(the user: *"this is fine leave it to the table"*). Poisoner's Apply Poison became a Poison Coating on
the character the same walk (*Bent by choice*).

**Group 1 — the damage rules** (`fighting-styles.js`, two `FIGHTING_STYLES` rows, gate `always`).
- **Elemental Adept**: the type is read off the feat's NAME — "Elemental Adept (Fire)", every copy
  adding its own (the user's ruling); a copy with no type is a greyed face that says how to rename
  it. A spell's damage of the type ignores Resistance — dnd5e's own `options.ignore.resistance`,
  set at `dnd5e.preCalculateDamage` off the damage card's actor (Heavy Armor Master's seam, the
  attacker's side), so the card's buttons carry it too; the receipt row says "Elemental Adept —
  ignores fire resistance". Its 1s count as 2 — Great Weapon Fighting's floor at 2, ⓐ on that
  type's dice only (a spell dealing two types floors one), with the card line and the dice that rise.
- **Poisoner**: Potent Poison — any Poison damage its owner deals ignores Resistance to Poison.
- `smoke-styles` §13, `tests/decide-fighting-styles.test.js`.

**Group 2 — the range cancellers** (`reminders.js`, `RANGE_FEATS`).
- A cancelled range row is **listed with the feat, never counted** ("Ranged attack within 5 feet of
  Hobgoblin — Crossbow Expert: no Disadvantage") — Blindsight's shape; ⓐ no prototype, the gate's
  existing listed box. Beyond long range still cannot be made.
- **Sharpshooter** (a Ranged weapon — ⓐ by its kind, so a dart thrown counts and a dagger thrown does
  not): long range, point-blank, cover. **Spell Sniper** (a spell's attack roll): point-blank, cover,
  +60 ft on a range of 10 ft or more. **Crossbow Expert** (the three crossbows): point-blank; its
  Dual Wielding is a `FIGHTING_STYLES` row (gate `offhandCrossbow`), and beside Two-Weapon Fighting
  the modifier is given back ONCE.
- **Bypass Cover** is the one new seam: the attack RECORDS each target's AC without its cover bonus
  (`system.targets[].ac`, dialog or no dialog), so the card's hit and miss are right on every
  client; the card says "Sharpshooter — ignores the Goblin's cover (+2 AC)" and the gate lists it.
  An AC override carries no cover in dnd5e 6.0.5 and is left alone; Total Cover records no AC.
- ⓐ No list of their own: the Reminder Sources' `range` kind is the switch (the data settles the
  rule — DESIGN R1).
- `smoke-reminders` §13, `smoke-styles` §14, `tests/decide-reminders.test.js`.

**Group 3 — the on-hit riders** (`clock-riders.js`, `CLOCK_RIDERS`; `bash-offer.js`; `damage-either.js`).
- **Slasher**: Hamstring rides a Slashing hit once per turn (a ticked row on the damage offer, "you
  can") and lands **"Hamstrung"** — the pack's speed −10 under its own name; a Critical Hit lands
  **"Slashed"**, which the gate reads as Disadvantage. ⓐ The split: the pack's one "Slashed" effect
  carried both, and applied on every Hamstring the gate would have counted a crit's Disadvantage.
- **Crusher**: its crit lands the pack's **"Crushed"** (Advantage against it); its push is a
  `SHOVES` row on the shove offer — any hit that deals Bludgeoning, any reach, a target no more
  than one size larger (the data settles it), its own once-per-turn mark (`crushUsed`).
- **Piercer**: its crit rolls one more die than the crit's double (dnd5e's own
  `critical.bonusDice`). Puncture is a `DAMAGE_EITHER` row with `one`: Savage Attacker's popup,
  unchanged — ⓐ **the die is the module's pick**, the one with the most to gain (its size's
  average less its face), so the popup asks only whether ("roll the 1 on the d6 again?"), and the
  new roll stands, lower or not.
- The effect-only riders' clock is Frost's Chill's (`slow`: until the start of the attacker's next
  turn). `smoke-clock` §10, `smoke-savage` §11, `smoke-maneuvers` C, `tests/decide-clock.test.js`,
  `tests/decide-damage-dice.test.js`.
- ⚠ **Stored lists**: a world keeps its own Fighting Styles, Clock Riders, Damage Rolled Twice and
  Maneuver Folds lists — the new names arrive with Reset Defaults or by hand (BACKLOG, the next
  release).

## The PHB feats — groups 4–6 (2026-09-27)

**Built in one autonomous pass** (the user: *"do a careful run of 4-6, working on each with full
review and not guessing/memory as to the shape it should be"*), off BACKLOG's drawing of
2026-09-26 — each feat measured on the pack first (`tools/probe-pack-shapes.mjs`, the sandbox,
2026-09-27) and its precedent named before a table was chosen (SWEEP §1). The calls made while the
user was away are marked ⓐ; nothing here is walked yet.

**Group 4 — the saves: Mage Slayer.** The pack ships one activity, Guard Mind (a utility that
spends the item's one use, back on a Short or Long Rest), and nothing for the breaker.
- **Concentration Breaker** — a `FIGHTING_STYLES` row (gate `always`, `feat`, `breaks:
  "concentration"`): the feat's face, and the Fighting Styles list its switch, as Elemental
  Adept's and Poisoner's damage rules are. The precedent is Extended Spell's mark on a
  concentration save: the concentration ask RECORDS the damage's dealer (the card that dealt it
  names its actor — `concentration.js` `breakerFor`), the ask card and its dialog say
  "Mage Slayer (Morgash) — the save is made at Disadvantage", and the save gate lists it, counted.
  The roll carries `disadvantage` alone, so dnd5e nets it with the concentrator's own Advantage:
  War Caster beside Mage Slayer is a plain roll. The buzzer and auto mode roll it too (Heightened
  Spell's buzzer, the same shape). Damage with no card (a sheet edit) names no dealer — nothing.
- **The walk, 2026-09-27** (the user: *"on the concentration save offer, you have the dc, so i dont
  think you need offer heroic inspiration if it passes"*): a concentration save answering the module's
  check is WITHHELD like a demanded save — the check owns the DC, so a rescue (Heroic Inspiration, a
  Bardic die) is offered only on a FAILURE, the spell stands while it is asked, and the rescue's reroll
  or die is folded into the verdict (`concentration.js`, the spine's withhold registry; the clock's own
  roll is never withheld). A concentration save rolled with no check pending keeps the sheet-save offer.
  `smoke-concentration` §17.
- **Found on the way, fixed with it:** the save gate never listed War Caster on a concentration
  save — dnd5e 6.0.5's `rollConcentration` reads `system.attributes.concentration.roll.mode`,
  a key the gate's mode reader did not know — so the net beside Mage Slayer would have been
  Disadvantage where the roll is plain. `modeKeys` reads it now (`tests/decide-reminders.test.js`).
- **Guarded Mind** — a new D20 fold kind, `succeed` (R4 pin 34 → 35): a failed Intelligence,
  Wisdom or Charisma save made a success, paid through the pack's own Guard Mind activity (dnd5e
  takes the use). No die and no reroll — the contribution is the VERDICT (`decide/verdict.js`,
  the save side's `verdict`, the way a negate hold forces the attack side's). Its row is
  `SAVE_SUCCEEDS` (the feat, the activity, the label, the three abilities, the rule verbatim); the
  D20 Folds list's `Mage Slayer:succeed` is the switch. Offered where the fold machine already
  offers: on a save the module DEMANDED, after the failure and before the verdict applies (the
  withhold), the save's own verdict line then reading "saved (Guarded Mind)"; on a save rolled from
  the sheet, as an offer the roller judges — no DC exists there (the DC finding).
- ⚠ **Stored lists**: a world keeps its own Fighting Styles and D20 Folds lists — the two new
  names arrive with Reset Defaults or by hand.
- `smoke-concentration` §16, `smoke-saves` §27, `smoke-d20-folds` §11, `tests/decide-verdict.test.js`,
  `tests/decide-reminders.test.js`, `tests/decide-present.test.js`, `tests/decide-registry.test.js`.

**Group 5 — the rest grants: Inspiring Leader, Chef.** Musician's after-rest popup (`REST_GRANTS`
`to: "allies"`, `rest-grants.js`), grown two grants; the amounts are the pack's own heal activities'
(N1), never typed.
- **Inspiring Leader** (`grant: "temphp"`): after a Short or Long Rest, up to six creatures within
  30 ft, the owner too (`self`), each given Temporary Hit Points = the activity's formula (level + the
  modifier). ⓐ The activity is the one for the ability the feat RAISED — its own Ability Score
  Improvement record (`asiAssigned`, moved to `lookup.js` with this second customer), else the higher
  modifier of the activities the sheet still carries (the Poisoner's pick). ⓐ Temporary Hit Points do
  not stack, so a creature already holding as many is greyed "(has N temp HP)" and one holding fewer
  is raised to the amount (`decide/rest-grants.js` `holdsTemp`).
  ⓐ The rest card's own activity list (dnd5e lists a feat's rest-period activities) keeps only that
  one of the pack's two, called **"Inspire with Performance"** (the row's `label`; the walk, 2026-09-27:
  *"saying with wis or cha is nonsensical"*, *"Inspire with Performance is fine (just once)"*).
  `smoke-rest` §8d takes the feat through its record, the lower ability.
- **Chef — Bolstering Treats**: after a Long Rest, the Proficiency Bonus in Temporary Hit Points to
  up to that many creatures — handed out, a bend by choice (ruled 2026-09-26; *Bent by choice*). ⓐ The
  rule names no distance, so every ally on the scene is listed (`reach: null`); the owner too.
- **Chef — Replenishing Meal** (`grant: "meal"`): after the Chef's Short Rest, up to 4 + the
  Proficiency Bonus eaters (the text's number; the pack's activity targets 4). Every creature rests on
  its own client in any order, so ⓐ the meal is judged per eater off its OWN Short Rest card — which
  the module now stamps with the Hit Dice spent (`restSpent`; dnd5e writes it only in words, NOTES §2):
  rested and spent Hit Dice → the activity's 1d8 is healed at once, the dice on one card; rested and
  spent none → greyed "(spent no Hit Dice)"; still resting → the eater carries the meal (`mealFed`, an
  actor flag) and its own rest's end heals it if it spent a Hit Die. ⓐ "The same rest" is the same
  Rest request when both rests answer one, else ends within two hours of each other.
- ⚠ **Stored list**: a world keeps its own Rest Grants list — "Inspiring Leader, Bolstering Treats,
  Replenishing Meal" arrive with Reset Defaults or by hand.
- `smoke-rest` §8–§11, `tests/decide-rest-grants.test.js`.

**Group 6 — the reaction attacks: Sentinel; Polearm Master (ruled off options, below).** SWEEP §1's "Turn chit / the Reaction" family; the precedent is Retaliation's row on
`REBUKES` — a Reaction taken when damage lands, answered with one melee attack with the weapon last
swung (`rebukes.js`).
- **Guardian** — a `REBUKES` row with `ward`: the bearer is a BYSTANDER. When an attack's damage lands
  (`hit`: its card an attack's), every OTHER creature on the scene holding a listed ward — not the one
  hit, not the one hitting — within 5 ft of the hitter is asked (`stampWards`), Riposte's popup and
  card: "Hobgoblin hit Gren — strike?". Use drives the melee attack at the hitter, its cards marked
  `opportunity`; the Reaction is spent. ⓐ Asked only when the hitter stands on ANOTHER side of the map
  (token disposition): RAW any creature's hit triggers it, but a popup on every friend's hit is noise
  — punishing a friend stays a sheet attack. ⓐ Offered when the hit's damage LANDS (the rebukes' seam:
  after any reaction that could still turn the hit), so a hit dealing no damage asks nothing
  (*Where the table bends the rule*). The **Disengage** half is not offered — nothing records a
  Disengage (NOTES §2); the row's caveat says so.
- **Halt** — a `CLOCK_RIDERS` row (`judge: "opportunity"`): the pack's own "Halted" (Speed 0) lands on
  the hit (`lands`, group 3's path), for the rest of the CURRENT turn — the new `halt` clock, pinned to
  the turn it lands in rather than the attacker's (`TURN_PINNED`, `effect-riders.js` `clockPlace`);
  out of combat, the pack's own duration. Due on the Opportunity Attack the module drove, and ⓐ on any
  melee hit the Sentinel makes off its own turn in a running combat — an Opportunity Attack made from
  the sheet carries no mark of its own — ticked with the caveat "only on an Opportunity Attack".
- ⚠ **Stored lists**: a world keeps its own Rebukes and Clock Riders lists — "Sentinel" joins both.
- `smoke-goliath` §5, `tests/decide-rebukes.test.js`, `tests/decide-clock.test.js`.
- **Polearm Master — ruled off BACKLOG's options the same day** (the user: *"p1 gowith that"*; and
  for Reactive Strike: *"if wielding right weapon with polearm master, an invisible emanation. if a
  hostile person gets the emanation buff, then trigger a popup reminding the player they can attack
  (same shape as hew too)"*). Both halves are REMINDERS — the swing is from the sheet.
  - **Pole Strike** — a `BONUS_SWINGS` row (`when: "attack"`): after an attack with a Quarterstaff, a
    Spear or a Heavy + Reach weapon, on the owner's own turn and once per turn (out of combat, every
    such attack), Hew's OK-only popup and card say the Bonus Action swing with the other end is there
    (`hew.js`, the `hew` kind — Great Weapon Master's row keeps the crit-or-kill trigger, and a `hew`
    entry not in the table keeps it too). After the attack RESOLVES: on the hit's damage card, or on
    the attack card when it missed. The Maneuver Folds list's `Polearm Master:hew` is the switch.
    **The walk (2026-09-27): an OFFER, driven** (*"an offer to attack, using bonus action, player
    chooses yes or no, and then it does the attack for them"*): the popup asks **Pole Strike / Pass**;
    Use drives the WEAPON's own attack at the creature the triggering attack was aimed at, its damage
    die made a d4 and its type Bludgeoning before the roll (the Unarmed Strike's swap), a line on the
    card. So the weapon's own +1, masteries and styles ride it (the user: *"then pole strike will
    actually carry enhancements like +1 and stuff too"*) — the pack's feat-borne Pole Strike activity
    would carry none. Great Weapon Master's +PB stays off it: a Bonus Action is not "part of the Attack
    action" (`fighting-styles.js`, the `heavy` gate).
    Every card of the swing is titled **"<weapon> — Pole Strike"** (the walk: *"needs suffix for attack
    and dmg cards too"*): the usage card's item snapshot is renamed at its birth; the attack and damage
    cards' header reads the LIVE item (`getAssociatedItem()`), so theirs is drawn at render
    (`SURFACES.cardHeaderTitle`).
  - **Reactive Strike** — an `EMANATIONS` feature row: while the owner HOLDS a qualifying weapon, an
    invisible, quiet ring of that weapon's reach (10 ft with Reach) stands around it (`holding`,
    `range: "weaponReach"`, `effect: null`, `quiet`); a hostile creature MOVING into it — Foundry's own
    `tokenMoveIn`, raised only when the creature itself moved (measured: the ring sliding over a
    standing creature raises none, and a teleport-style drag raises it) — posts Hew's reminder on the
    owner, "Reactive Strike — Hobgoblin entered Morgash's reach" (`alert`), unless its Reaction is
    spent or it is Incapacitated. Nothing is applied to the hostile: the "buff" is the ring's own entry
    event (ⓐ — a mark on every foe that stepped close would be noise on its token; the user asked,
    2026-09-27, whether the buff's own application would catch more — it is raised by the same entry
    event, so it would not). A creature PASSING THROUGH the reach in one move is caught too: Foundry
    splits a walked move at the edge of every region listening for entry
    (`TokenDocument#splitMovementPath`, 14.368), so the entry is a checkpoint of its own
    (`smoke-emanations` §17e). The Emanations list's "Polearm Master" is the switch.
  - `smoke-maneuvers` PS, `smoke-emanations` §17, `tests/decide-registry.test.js`.
  - ⚠ **Stored lists**: Maneuver Folds and Emanations — "Polearm Master" joins both.

## Measured cover (2026-09-27)

The user, 2026-09-27: "a person selects an actor token. when they hover over other tokens ... on top
of the list, in its own section called Cover, ... say if it has no cover, half, 3/4 or full. then the
player knows what they are dealing with. if they want, then can target/attack, and then the penalty
applies accordingly (taking into account sniper/sharpshooter)"; "we need to follow the 2024 dmg".
Un-parked from BACKLOG's *Cover, measured on hover*; DESIGN §8's cover row amended the same day.

- **The rule is the 2024 DMG's grid method** (Running Combat → Miniatures → Cover, read off the book
  on the box): lines from ONE corner of the attacker's space to the four corners of ANY ONE square
  the target occupies; 1–2 blocked is Half (+2 AC), 3–4 blocked but a line still reaches is
  Three-Quarters (+5 AC). The attacker picks the corner and the square: the answer is the LEAST
  cover over every corner × square (a Large target's clearest square).
- **A creature gives Half at most** — the PHB 2024 Cover table (Three-Quarters and Total are an
  object's). The DMG counts a creature as an obstacle for the lines; lines only a creature blocks
  never lift the degree past Half. Ally or foe alike. A hidden token and a dead one are not counted.
- **Total** is "no line reaches": every line from every corner to every square meets a wall.
- **The measure is not symmetric, and stays so** (the user, 2026-09-27, the walk: Jetten had Half
  against Invictus's shot while Invictus had none against Jetten's; offered a symmetric bend, ruled
  "keep the DMG rule as written"). The lines run from ONE corner of the attacker's space to ALL
  four corners of the target's square, so the creature standing beside an obstacle is the covered
  one.
- **Walls are the platform's MOVE collision test** (`CONFIG.Canvas.polygonBackends.move`): a closed
  door blocks, an open one does not, a one-way wall from its side only; a window (sight passes,
  bodies and arrows do not) is cover. Foundry walls have no height: a drawn wall is a whole wall,
  so a low wall a table wants as Half is set by hand (the status still counts — below).
- ⓐ **A line that only grazes an obstacle does not count** — the books are silent (the DMG's line of
  sight counts a touch; its cover rule says "blocked"). Two tokens side by side would otherwise
  cover each other along the shared edge. The corners sit a hair inside their squares and the
  creatures' boxes a hair inside their edges (`decide/cover.js`).
- **The hover card**: with ONE token controlled, pointing at another opens its card with a **Cover**
  section on top, TWO lines (the user, 2026-09-27: "keep it 2 lines, the cover amount with the AC
  mod, then second line the desc/whats in way"): "Half Cover (+2 AC)" (or No Cover, Three-Quarters
  Cover (+5 AC), Total Cover — nothing more: "for total cover you dont need to say cant be
  targeted"), then "Hobgoblin in the way" — and "· Sharpshooter
  ignores it (ranged weapon attacks)" (or Spell Sniper, spell attacks) when the controlled creature
  holds one. No Cover is its one line. Each degree carries a painted icon from Foundry's own library
  (the user: "nice icons ... color", "pulled from foundry library") — an open road, a low picket
  fence, a portcullis gate (the PHB's Three-Quarters example), a castle wall.
  The chip's colour reads for the ATTACKER: No Cover green (the user, 2026-09-27: "lets make no cover
  green"), Half and Three-Quarters orange, Total red. The effects follow under their own label. Still a pure view
  (*The effect view*).
- **At the attack** the same measure goes on each target's RECORDED AC (`system.targets[].ac`, the
  seam Bypass Cover already uses): the most protective degree applies and degrees never add — a
  cover status set by hand stands when it is higher; Total records no AC (a miss, as dnd5e records a
  `coverTotal` target). The card says the cover on EVERY attack while it is measured (the user, 2026-09-27: "a card
  should have the cover status on its attack roll"): "Cover — the Goblin: Half Cover (+2 AC)", "…: Total
  Cover" — and nothing for No Cover ("you dont need to put no cover on the card"); a hand-set status that wins is the one named. It is a ROW directly under the card's header
  (the user: "its not very prominent", "cover is like an important thing, it should be up above"):
  the degree's picture and colour, "Half Cover (+2 AC)" in bold, "vs Sharran Acolyte" under it —
  "· Sharpshooter ignores it" on the same row when a feat took it off. Then Sharpshooter and
  Spell Sniper take the whole carried cover off, measured and hand-set alike (*The PHB feats —
  groups 1–3*, group 2); Total stays.
- ⓐ **Attacks only.** A Dex save against an area measured from its point of origin is the DMG's too;
  not built (BACKLOG).
- ⓐ **Hex grids are not measured** (the DMG counts six corners there; no table plays on hexes) — no
  section, no change to the attack. A gridless scene measures each space as one square.
- Always on (*The settings*, below).
- The suites run with no cover: the harness flags every scene `noCover` and clears the flags it set
  at the teardown, because their fixtures stand creatures in a row on purpose and a measured +2 would move
  hit and miss under sections about something else. `smoke-reminders` §14 clears the flag.
- `tests/decide-cover.test.js`, `smoke-reminders` §14 (written 2026-09-27 while the sandbox ran the
  release battery; its first live run is owed).

## The settings (2026-09-27)

The user, 2026-09-27, ruling the draft list: *"this is fine for now"*, and agreeing with its three
calls. The vision behind it (DESIGN, the refactor's rulings of 2026-09-27): batteries included, a few configs for DMs;
midi is the alternative for a table that wants to configure everything.

- **Ten settings.** For the DM: Decision Timer, Dramatic Beat, Players Roll Their Own Saves,
  Concentration Checks Are Public, Hold Shows the Math, Optional Masteries, Resource Use Notices.
  For each player: Roll Your Own Damage, Effect Bar, Effect Cards on Hover and Alt.
- **Every machine is always on**: the resolver, applying damage, requiring a target, the hidden card
  buttons, the reaction hold, the riders, emanations, volleys, casts, saves, concentration and
  measured cover. A table that wants one off wants midi.
- **One Decision Timer** is the clock of every question: a reaction to a hit, an offered damage roll,
  a save, a concentration check, a mastery or maneuver offer, a reminder. A mandatory roll rolls when
  it runs out; an optional offer passes.
- **The NPC/PC split of the resolver is gone**: Roll Your Own Damage covers the player who wants to
  roll.
- **Players Roll Their Own Saves** covers the saves the module demands as well as concentration.
  "Roll automatically" rolls each on the roller's client at once, with no popup; a save the rules
  decide before the dice is recorded, not rolled.
- **Waiting for the dice is automatic**: a verdict waits up to 4 seconds for Dice So Nice's dice to
  come to rest. **Skip Hopeless Holds** follows Hold Shows the Math. A cast reaction's AC change is
  given 8 seconds to land.
- **The content tables are the only list** (the refactor's rulings, 2026-09-27): no
  per-world list and no per-row switch. Prod's saved lists all equalled the shipped defaults, so no
  house row was lost.

## The rule fold reads the book (2026-09-27, off the prototype *The rule fold*)

The user, 2026-09-27, choosing between three shapes: *"A, go with that"* — and of the link-only
shape, *"C is gonna have a lot of link noise"*.

- "the rule ▸" shows the paragraph the row is about, read from the item's own description: the
  paragraph whose bold lead names the row's benefit (Mage Slayer's **Guarded Mind.**), else the whole
  description. A condition or a mastery reads dnd5e's rules page for it.
- Nothing is copied into the code. A text the packs do not carry shows no fold, never a guess.
- The text is enriched; a roll link in it reads as plain text, so nothing rolls outside the machine.
  Foundry's private notes stay out.

## The slice order, off the drawings (2026-09-28)

The 2024 corpus was measured and drawn book by book ([audits/drawings/](audits/drawings/)) and the
order set off the drawings: **the spells slice, then Slice B, then session 0 of the next campaign
sets the class slices** (player-facing first, DESIGN N3; B is small and party-independent; the
classes wait for the party). The commission is HANDOFF.md.

- **A repeated save that succeeds ends the effect automatically** — the rule leaves no choice (R1)
  — **with a visible cue**: the effect's name floats off the token as it leaves (the scrolling text
  the use chips and the fighting styles draw), and the card records the end.
- **All three UI-shaped spell items are in the slice**, each ruled off a prototype first: the placed
  area that pulses, Sanctuary's gate, Mirror Image's defender interrupt.
- **The DMG is a register, not a slice**: its shapes are built with their PHB or Monster Manual
  customer; its own rows wait for the item to be found.
- **Relentless is not in the 2025 Monster Manual**; the kill moment's monster row is Undead
  Fortitude. Slice B is redrawn to five shapes in its drawing.
- **The drawings are the map, never a commission**: nothing in them is owed until the user sets it.

## The spells slice — Tiers 1 and 2 (2026-09-28, HANDOFF.md)

**Measured before a row was written** (`tools/probe-pack-shapes.mjs`, the sandbox on dnd5e 6.0.5): four of
the drawing's eight Tier 1 rows are the pack's already and got no row — **Haste** (Hasted carries the
Dexterity save mode), **Synaptic Static** (Muddled Thoughts carries the −1d6 on attacks, checks and
concentration), **Sorcerous Burst** (its damage is `1d8x@mod=8`: Foundry's own explode modifier with a
cap, the modifier's worth of extra d8s on an 8), and **Beacon of Hope's saves** (Hopeful carries the
Wisdom and death save modes). The rows that stayed:

| Spell | Table | What the module adds |
| --- | --- | --- |
| **Protection from Poison** | `EFFECT_BENDS` "Poison Protection" `saves` | Advantage against a demand that would poison — Dwarven Resilience's facet on an effect (the pack carries the resistance) |
| **Otto's Irresistible Dance** | `EFFECT_BENDS` "Irresistible Dance" + `REPEAT_SAVES` | attacks at Disadvantage, attacks against it at Advantage, Dexterity saves at Disadvantage — the facet's new `abilities` scope, the demand naming its ability; the repeat is the dancer's ACTION, offered on a card at its turn start, never demanded by the clock |
| **Beacon of Hope** | `HEAL_REROLLS` "Beacon of Hope" `max` | a creature wearing Hopeful is healed the roll's MAXIMUM by the cast path, the receipt saying so (the register above says what is not raised) |
| **Command** | `SAVE_PRESSES` "Command" `word` | the caster's word asked on the failure (the bash's shape, `saves/choices.js` kind `word`); Grovel presses Prone; the register row above |
| **Heroism** | `TURN_GRANTS` "Heroism" (new table, `turn-grants.js`) | the pack rolls the Temporary Hit Points once, at the cast; the machine rolls the spell's Heal activity again on the CASTER's numbers at each of the bearer's turn starts while Bravery stands, receipted. ⚠ The commission said a `CLOCK_RIDERS` facet; a table of its own because that one is keyed by the ATTACKER's feature and read at a hit, and this is keyed by an effect on the BEARER and read by the clock |

**Tier 2 — the repeating save, a KIND** (`REPEAT_SAVES`, the R4 tripwire 35 → 38: `turnEnd`, `damaged`,
`action`; `repeat-saves.js`). A row is keyed by the SPELL and names the pack's effect(s); the effect is
found on the bearer by its name AND its origin item together (a ghoul's Paralyzed is not Hold
Person's), the origin read through `effectSourceOf` (a tray-applied copy's `item` names the pack). The
save is the item's own save activity, demanded on a card of the machine's through the saves machine
(`effectsHandled: "repeat"`); **a success removes the effect through the cast card's receipt** (the
entry reverted — the same revert button the receipt carries), no choice (R1), and the card says
*"Paralyzed ended — the save succeeded"*; a failure says it holds. **The float:** Foundry v14 floats
`−(name)` off the token itself for any effect with a status or a change (NOTES §1), so the module
draws it only for a bare one (Confused). Tasha's damaged save has Advantage as the demand's OWN
bend (the gate lists it, the automatic roll rolls it). Phantasmal Killer's repeat takes none on a
success (the pack's "half" is the cast's). **The counters** (`count`): Contagion — three successes end
it, three failures lock the asking; Flesh to Stone — three failures press Petrified and lock, the
effect standing under it. Rows: Hold Person, Hold Monster, Tasha's Hideous Laughter, Blindness/Deafness,
Crown of Madness, Slow, Fear, Confusion, Phantasmal Killer, Eyebite (Panicked, Sickened), Contagion,
Flesh to Stone, the three Dominates, Otto's. Out on purpose: Eyebite's Asleep (ends on damage with no
save — the table's). ⚠ Contagion's pack lands all six Infected effects on a failure (the data; the
disease is the caster's pick — fix at the data, never a carve-out).

**The walk — Tier 1** (`tools/content/place-spells-walk.mjs` puts BF Walk Cleric with the slice's spells
and two targets on Party Camp):

| Spell | What you should see |
| --- | --- |
| **Protection from Poison** on a target, then a poisoning save at it | the save dialog's section: "Poison Protection — against Poisoned", Net Advantage |
| **Otto's Irresistible Dance** landed, then a Dexterity save at the dancer | "Irresistible Dance — a Dexterity save", Net Disadvantage; an attack at it shows Advantage, its own attacks Disadvantage |
| **Beacon of Hope** on a target, then Cure Wounds at it | the receipt line says "Healing — Beacon of Hope — the maximum"; the Hit Points move by the dice's maximum |
| **Command** at a target that fails | the caster's popup: Approach / Flee / Grovel / Halt; Grovel → Prone lands, a card says who falls; any other word → a card says the table moves the token |
| **Heroism** on a target, then its turn starts | a "Turn start" card: "Heroism — <name> gains N Temporary Hit Points", N the caster's spellcasting modifier; once per turn |
| **Haste**, **Synaptic Static**, **Sorcerous Burst** | nothing of the module's: the pack does it (Hasted's Dexterity Advantage in the save dialog; Muddled Thoughts' −1d6 on the attack; an 8 on the Burst's d8 rolls another) |

**The walk — Tier 2:**

| Spell | What you should see |
| --- | --- |
| **Hold Person** landed, the target's turn ends | a "Repeated save" card; the save rolls (or asks); a failure: "Paralyzed holds — the save failed"; a success: "Paralyzed ended — the save succeeded", the effect gone, "−(Paralyzed)" floating off the token, the cast card's receipt row struck |
| **Tasha's Hideous Laughter** landed, damage the target | the repeat raised at once, "with Advantage" on the card and in the dialog's section; the turn end raises it too |
| **Otto's Irresistible Dance** landed, the dancer's turn starts | a card with a button "Repeat the save — your action"; the turn END raises nothing; the button raises the demand |
| **Flesh to Stone** landed, three failed turn ends | "1 of 3 failures", "2 of 3", then "the third failure: Petrified" — Petrified on the token, no fourth ask |
| **Dominate Person** landed, damage the target | the repeat raised on the damage, none at the turn end |
| **Confusion** landed, a successful turn end | the effect ends and the module's own "−(Confused)" floats (the platform draws none for a bare effect) |

## The spells slice — Tier 3 (2026-09-28, ruled off `prototypes/spells-slice.html`: "all drawn as, go")

**Two corrections to the commission before a line was written** (the PHB pack read on the sandbox): the
handoff carried 2014 rules in two places. **The placed area's trigger is enter / *ends its turn there* / the
area moved onto it, once per turn** — every 2024 spell in the list says so, and that is Spirit Guardians'
trigger word for word, so the area kind reuses it (the handoff said turn *start*). **Mirror Image rolls a d6
per remaining duplicate on each hit; any 3 or higher redirects** — the pack models it so with three
Duplicate effects (the d20 against 6 / 8 / 11 was 2014). Sanctuary was as drawn, plus its second clause: it
gates a *damaging spell* too, never an area.

### The area that pulses — `EMANATIONS` kind `area` (Moonbeam the customer)

The system's template is adopted where it was PLACED, attached to nothing: the caster drags it (the Magic
action that moves the beam, the fog's drift, the cube's teleport — all the caster's drag of the template)
and the platform raises the entry for whoever it then covers. The save is the activity's own, demanded on
the emanation's trigger card as Spirit Guardians' is; the area ends with the concentration. Rows: Moonbeam,
Insect Plague, Cloudkill (a save), **Cloud of Daggers** (plain damage, no save — rolled on the caster at the
cast's level and applied, receipted: the rule leaves no choice, R1). **Flaming Sphere is a summon:** "within
5 feet of the sphere" is a 5-foot feature ring around the sphere's own token (today's kind), its `Flames`
the save (the summon matches the caster's DC); rolling the sphere into a creature is an entry. Reach `all`:
"each creature", the caster too. Held out at the time: **Wall of Fire** (read as having no area in its data —
a misread: the pack carries the wall and the ring — and a one-sided 10-foot band), **Spike Growth** (damage
per 5 feet moved — DESIGN §4); both built with the held spells the same evening (*The spells slice — the held
spells*, below). The caveats the table plays: a shape-shifter's reversion, Obscured, Difficult Terrain.

- **A second trigger in the same turn says so** on a small card ("already saved this turn"), as Spirit Guardians does.
- **Who moves the area:** whoever may move the template on the platform.
- **An adopted emanation's cast asks once:** the cast's demand asks who stood inside at the cast; every later
  save is the region's trigger's (enter, turn end, the area moved). An arrival never joins the cast's demand
  (it would be asked twice — `saves/areas.js`), and an emanation placed with nobody inside owes nothing at
  the cast (`saves/demand.js`). Spirit Guardians gains this too.

### Sanctuary — `WARDS`, `wards.js` (the gate before the roll)

The buy box's seam: `dnd5e.preRollAttack` for any attack roll at the warded creature (any item, every
attack — a Bugbear with two attacks saves twice), `dnd5e.preUseActivity` for a spell with damage aimed at it
(no area: "doesn't protect the warded creature from areas of effect"; an attack-type spell is gated at its
roll). The use is vetoed, the ward item's own save activity demanded of the ATTACKER through the saves
machine on a card of the ward's; **a failure turns it aside** — the card says "no attack roll; choose a new
target, or the attack is lost", *turned aside* floats off the ward, and a new attack is a new attack (the
module spends and refunds nothing); **a success makes the use again** with a pass in hand, the roll dialog
asking as the first press would have. The ward is found by the effect's name AND its origin item (the
repeat's matcher), so a Warded from elsewhere is nobody's. **The ward ends** on its bearer's own attack roll,
any cast (cantrips and heals included — the rule says "casts a spell") or damage roll, no choice; a card
says why and the name floats off (a bare effect: the module draws it). A second customer waits:
**Unbreakable Majesty is NOT this shape in 2024** — its save comes AFTER a hit ("or the attack misses
instead"), the duplicates' seam with a save for the die.

### Mirror Image — `DUPLICATES`, the hold (the defender's interrupt after the verdict)

No popup, no Reaction (R1): on a hit that STILL stands after the defender's reactions (Shield, Lucky, the
guards — the other order would roll dice on hits a Shield then turns), a die per standing duplicate is rolled
in the open and rises off the token (the dice-that-rise rule's second case: a situational effect that
changes a roll's outcome); any face at 3 or higher redirects the hit to a duplicate, which is destroyed
(its effect deleted — Duplicate C first; the platform floats its name), and the hit is `absorbed` — a forced
verdict on the attack the applier drops, whatever AC it was judged against; the crit's damage goes with it.
The duplicates ride the hold: an entry the machine answers itself when nothing else asks. An attacker with
the Blinded condition, Blindsight or Truesight rolls nothing — read off its sheet — and one line says why.
The last duplicate destroyed ends the spell (the card says so).

**The walk — Tier 3** (`tools/content/place-spells-walk.mjs`: BF Walk Cleric carries Moonbeam, Cloud of
Daggers, Cloudkill, Insect Plague, Flaming Sphere, Sanctuary, Mirror Image and Sacred Flame; BF Walk Target
carries a Morningstar):

| Spell | What you should see |
| --- | --- |
| **Moonbeam** placed beside the Target, then the Target walks in | an "Emanation" card: "Moonbeam — BF Walk Target entered BF Walk Cleric's Moonbeam", a Constitution save, the 2d10 rolled; ending its turn inside asks again on a new turn, and a second entry in the same turn says "already saved this turn" |
| **Moonbeam** dragged onto the standing Ally | the same card for the Ally (reach `all`) |
| **Cloud of Daggers** placed, the Target walks in | a card with the 4d4 rolled and a receipt — no save; the Hit Points move |
| **Flaming Sphere** cast (the sphere summoned beside the Target), the Target's turn ends within 5 ft | the sphere's own ring: "Flaming Sphere — … ended its turn inside", a Dexterity save, the 2d6 |
| **Sanctuary** on the Ally, then the Target attacks the Ally | no attack roll: "Sanctuary — a save before the attack" on the Target's side, the Wisdom save; a failure: "turned aside" floats off the Ally and the card says to choose a new target; a success: the attack dialog opens and the attack rolls |
| **Sanctuary** on the Ally, then Sacred Flame at the Ally | the same gate before the cast; a Fireball at the Ally is not gated |
| the warded Ally attacks | "Sanctuary ended — BF Walk Ally made an attack roll", the Warded effect gone, "−(Warded)" floating |
| **Mirror Image** on the Cleric, then the Target hits it | the dice rise off the Cleric (3d6, the redirecting face gold); a duplicate destroyed ("−(Duplicate C)" floats), "A duplicate takes the hit — duplicates: 2 of 3 left", no damage; low dice: "The hit gets through" and the damage lands |
| the last duplicate | "The last duplicate takes the hit — Mirror Image ended" |

## The spells slice — the held spells (2026-09-28, evening; HANDOFF.md §The held spells)

**The user's scope** (2026-09-28): *"build all three [Warding Bond, Vampiric Touch, Prismatic Spray], work
autonomously, push when done … we need to tackle wall of fire / spike growth … put force cage and magic circle
in scope. we can create the region for them, and partially implement them"*; then *"add counterspell back in
scope, the user can just target intended counterspell actor, and force them to make the con save per the spell.
the rest can be handled at table."* Every row measured on the pack first (`tools/probe-pack-shapes.mjs`, the
sandbox on dnd5e 6.0.5). **Not a kind moved:** three new tables that are not kinds, vocabulary on two that
exist, and one NATIVE.

| Spell | Table · machine | What the module adds |
| --- | --- | --- |
| **Warding Bond** | `DAMAGE_SHARES` · `damage-shares.js` (new) | the pack's Bonded carries the +1 AC, +1 saves and the resistance (NATIVE). The share is the module's: on `dnd5e.applyDamage` (the rebukes' seam — the one that knows the landing) the amount that LANDED on the bearer is applied to the caster as **untyped** damage — the same number, no second pass through the caster's resistances — with a receipt on a card of the machine's, no choice (R1); **beyond 60 feet** (`nearestFeet`) nothing is shared and the card says so; the **caster dropping to 0** ends the bond (Bonded deleted, the card says why). The bond's other ends — more than 60 feet apart, a re-cast on either — are the table's (the register) |
| **Vampiric Touch** | `HEAL_ON_HIT` · `heal-on-hit.js` (new; Lifedrinker's shape, SWEEP §3 item 4) | the pack's attack and 3d6 are NATIVE; the heal is the module's: on `dnd5e.applyDamage` the dealing card's activity answers the row, and **half the necrotic damage that landed** (by the rolled parts' proportion, floored) is healed on the caster with a receipt on the heal's own card, once per creature per card. "The attack again each turn as a Magic action" is the sheet's |
| **Prismatic Spray** | `RAY_TABLES` · `prismatic.js` (new) + a second `REPEAT_SAVES` row | the pack ships ONE Dexterity save with all five types on one 12d6 part, the two condition effects tied to it, and two bare save activities. The module: the cast's own demand is **closed as its card is born** (nothing asked at the cast; the 12d6 never rolls there); once the cone stands — the cast's placement, or a region placed after — the caster's driver **rolls a d8 per creature inside** (an 8 is two more draws, never a ray), posts one summary card with the dice, and raises **one demand per (creature, ray)**: rays 1–5 against the Cast's Dexterity save with the **ray's type forced onto the 12d6**; the indigo ray against "Indigo Save (Con)" and the violet ray against "Violet Save (Wis)", each landing its effect on a FAILURE by the machine's own hand (receipted). The cone goes with its rays (instantaneous). **The indigo repeat** is a second `REPEAT_SAVES` row keyed *Prismatic Spray (Indigo)* — the row's `item` names the spell, its `activity` the named save (two new words: a second row on one spell, a save that is not the spell's first) — Flesh to Stone's count: three successes end Restrained, three failures press Petrified. **The violet ray's later save is the table's** (the register): it falls at the caster's next turn start, the same edge dnd5e's own clock ends the Blinded on |
| **Wall of Fire** | `EMANATIONS` `area` + `band` | both activities carry a template (the wall's `wall/60`, the ring's `cylinder/10`) — the earlier "no area in its data" was a misread. The cast's own save (every creature in the wall as it appears) is the pack's, through the saves machine. The **burning side** is a BAND: at adoption the region is widened by 10 feet on the side AWAY from the caster (the default the text leaves to the caster), and the cast's card offers the other side by its compass name ("the north side"); the ring burns OUTSIDE by default (a ring of 10 feet beyond the wall), inside on the pick (the disc). Enter / turn-end inside the widened region demands the save as Moonbeam's does. The wall's height and opacity are the table's |
| **Spike Growth** | `EMANATIONS` `area` + `trigger on "move"` | the platform's own split of a move through the region (`segmentizeRegionMovementPath`, the same seam Polearm Master's reminder reads) gives the feet travelled INSIDE; per 5 feet the activity's 2d4, rolled once on the caster when the move lands and applied with a receipt, once per movement. **DESIGN §4's second exception**, the user's by name (the register: paid at the move's END, never as it goes; the mover is never paused, DESIGN §8). Difficult Terrain and the Perception check are the table's |
| **Magic Circle** | `EMANATIONS` `area` + `ask` · `gate` · `alert` (`kind: "notice"`) · `noCastSave` | the pack ships a Charisma save with the cylinder — for a teleport IN, never for standing inside, so the cast's demand is switched off (`noCastSave`). The region stands where placed for its hour (no concentration: the GM deletes it when the hour is up). **The types** are asked on the cast's card — every one of the five on by default, toggled there, the picks written to the region (a player's pick travels by relay; the active GM writes the region). **The Disadvantage**: the attack gate lists *"Magic Circle — a fiend attacking into the circle"* when the attacker's creature type is a chosen one and the target stands inside (`reminders.js`, read off the region and its picks). **The entry ban** is a notice card as a chosen-type creature MOVES IN — the move never paused (DESIGN §8). Possession, Charmed and Frightened from the warded types, and the reversed circle, are the table's |
| **Forcecage** | `EMANATIONS` `area` + `alert on "moveOut"` | two utility activities (the 20-ft cage, the 10-ft box), both cubes; the region stands where placed with the concentration. **The exit ban** is a notice card as a creature inside MOVES OUT — `moveOut` joins the alert vocabulary — the move never paused; the teleport-out save, the bars' cover and the box's blocking are the table's |
| **Counterspell** | NATIVE (the saves machine) | the pack's Counterspell is ONE save activity: Constitution, the caster's DC, one creature at 60 feet, a Reaction. The caster targets the creature whose spell they mean to counter and uses it; the saves machine demands the save of that target as it does for any targeted save. Nothing watches for the cast — *Bent by choice*, the user's ruling — and whether the spell was being cast, and what fails, is the table's |

**The walk — Tier 4** (`tools/content/place-spells-walk.mjs`: BF Walk Cleric carries the eight; BF Walk Target
and BF Walk Ally stand 5 ft east of it; the Target is a Fiend for the circle):

| Spell | What you should see |
| --- | --- |
| **Warding Bond** on the Ally, then damage the Ally from any card (an attack, a save's damage, the tray) | a card "Warding Bond — BF Walk Cleric takes N with BF Walk Ally", the Cleric's Hit Points down by the same N with a receipt; the Ally 65 ft away: "takes nothing: … beyond the bond's 60 feet"; the Cleric dropped to 0 by a share: "Warding Bond ended — the caster dropped to 0 Hit Points", Bonded gone |
| **Vampiric Touch** at the Target (a hit) | the damage lands, then a card "Vampiric Touch — BF Walk Cleric regains N Hit Points from BF Walk Target", N half of what landed, receipted; a miss pays nothing; the damage card's own line says the caster was paid |
| **Prismatic Spray** placed over both | the cast's card asks nothing; a summary card "Prismatic Spray — 2 creatures in the cone" with the d8s; per creature one card per ray: "the red ray strikes …" with a Dexterity save and 12d6 FIRE (the type of the ray), or "the indigo ray strikes …" with a Constitution save — a failure lands Petrifying (Indigo) (Restrained) and the line says so; the Target's turn ends: "Prismatic Spray — repeats the save" against the Indigo save, "1 of 3 failures"; an 8 on the d8: two rays on that creature; the cone region gone |
| **Wall of Fire** cast, the wall placed between the Cleric and the Target | the cast's save for whoever stood in the wall; the region widened 10 ft on the Target's side; the cast's card: "Which side of the wall burns? — the east side ✓ / the west side" (compass names off the wall's angle); flip it: the band moves; the Target ending its turn within 10 ft of the hot side: an "Emanation" save card with 5d8 fire; the Ally beside the cold side: nothing. The ring: "outside the ring ✓ / inside the ring" |
| **Spike Growth** placed, the Target walks 15 ft through it | when the move lands: "Spike Growth — BF Walk Target moved 15 feet through it: N piercing damage", 6d4 rolled on the card, a receipt; a 4-ft nudge inside pays nothing; a second move pays again |
| **Magic Circle** placed on the Ally (the Cleric beside it) | no save asked at the cast; the cast's card lists Celestial / Elemental / Fey / Fiend / Undead all ticked — untick Fey; the Target (a Fiend) walking in: "Magic Circle — BF Walk Target enters BF Walk Cleric's Magic Circle … cannot willingly enter"; the Target attacking the Ally inside: the gate's section lists "Magic Circle — a fiend attacking into the circle", Net Disadvantage; the Target attacking the Cleric outside: nothing; the Ally (a Humanoid) walking in: nothing |
| **Forcecage** placed over the Target | the Target walking out: "Forcecage — BF Walk Target leaves BF Walk Cleric's Forcecage — the walls hold it …"; walking in: nothing |
| **Counterspell** — target the Target, use Counterspell | the ordinary saves demand of the Target: Constitution, the Cleric's DC; the verdict on the card; nothing else |

## The DMG register (2026-09-28, night; HANDOFF.md)

**The commission's question — what "a register" means for the DMG — ruled the spells register's shape:
one row per DMG row, generated, never edited.** [audits/dmg-register.md](audits/dmg-register.md) from
`tools/audit-dmg-register.mjs` (the readers it shares with the spells' generator lifted into
`tools/register-shared.mjs`; the spells register regenerates byte-identical through it), off a DMG-only
corpus scan joined with the registry, RULINGS and the DMG drawing's TWO hand tables — *The shapes the DMG
shares with the other books* (a customer named there lands WAITS on that shape) and *Register verdicts*
(the verdicts the data cannot derive). 571 rows: 484 magic items, 14 poisons, 20 supernatural gifts, 8
traps, 12 hazards, 10 siege weapons, 23 NPC traits.

| What the DMG needed beyond the spells' | The ruling |
| --- | --- |
| **A fifth verdict word — WAITS** | a row whose shape is drawn on a machine that exists and whose customer is a found item: built when the first is found (the drawing: "the DMG is not a slice"). 29 rows wait, on nine shapes |
| **Kind** | magic item · poison · supernatural gift · trap · hazard · siege weapon · feature, read off the pack's item type and the text's first words (a "Potion"-typed row whose text opens "Ingested Poison" is a poison) |
| **Shape** | the shared-shapes row a waiting row lands on, by its code (`CRIT_RIDERS`, `COATINGS`, `SAVE_SUCCEEDS`, `vsSpells`, `REBUKES · INTERRUPTS`, `grant · CLOCK_RIDERS · turnStart`, `EFFECT_BENDS · until: damaged`) or its name (the reroll kind, the cast-triggered reaction) |
| **The defaults** | a trap, hazard or siege weapon is OUT (the GM runs it; its save and damage are the demand's); a row with no family or a paragraph only is TEXT ("a utility item — no combat mechanism"); a same-named registry row is a collision, not a machine, when a hand verdict says so (the Deck's *Flames* is not Flaming Sphere's row, the trait *Light* is not the spell's) |
| **The poisons** | only the four INJURY poisons (Lolth's Sting, Purple Worm Poison, Serpent Venom, Wyvern Poison) wait on `COATINGS`; the ingested, inhaled and contact ones are NATIVE — the item's own save used at the creature, never a coating |

**Measured on the pack, for the scope call:** the six crit riders (Vorpal Sword, Sword of Life Stealing,
Nine Lives Stealer, Hammer of Thunderbolts, Mace of Smiting, Silvered Weapon) ship as ENCHANTMENTS — the
item is applied to a base weapon and renames it ("Vorpal {}"), so the weapon on a sheet is *Vorpal
Longsword* carrying the item's enchantment effect; a `CRIT_RIDERS` row must be found by the enchantment on
the attacking weapon, not by the weapon's name — a reader `CLOCK_RIDERS` does not have. The four injury
poisons are consumables with one "Use Poison" save activity (Constitution, the damage or the conditions on
it, `itemUses` consumed): a `COATINGS` row on the item's own activity needs the machine's Poisoner-only
words (the feat's ASI-picked save, the Fighting Styles switch, the card's "2d8 and Poisoned") read off the
row. Neither is built; the scope is the user's call.

**RULED OUT (the user, 2026-09-28, on seeing the register):** *"lets scope out DMG, nothing is really worth our
time at the moment … intentionally ruled out those items because high impact limited value."* Nothing in
the DMG is built — not `CRIT_RIDERS`, not the injury-poison `COATINGS` rows, not the 29 WAITS rows:
each is a machine change or a new reader for a found item no one holds. The register stands as the record
of where each row lands the day an item is in a player's hands; that day is a new commission on the user's
word, never owed. The order moves on to Slice B.

## The GM's side — the five shapes (2026-09-28, night; HANDOFF.md Stage 1)

**The commission** (BACKLOG row 4b, the drawing [audits/drawings/monsters.md](audits/drawings/monsters.md)):
the packs own the monsters' traits; what the GM's side owes is five SHAPES, each landing on a machine
that exists. Built in rapid mode — proved by the suites, not walked; the walk table below is for the
walk that comes later. Every row names its precedent.

| Shape | Customer | Lands on | What was built |
| --- | --- | --- | --- |
| **The kill moment, the victim's side** | Undead Fortitude | `DROP_TO_ONE` (Relentless Endurance's machine, `drop-to-one.js`) — a **`save` facet** | held at 1 in the damage's own update while the bearer's Constitution save rolls ON THE KEEPER, DC 5 + the damage taken (`decide/drop-to-one.js`); the dice decide (R1), no popup; a success leaves the 1, a failure lands the 0; the card says the total against the DC. The exemptions (Radiant, a Critical Hit) are read off the damage card: its rolls' types, and the crit off its rolls or the attack it answers |
| **The kill moment, the death's side** | Death Throes | the same table — a **`died` row** (`on: "died"`) | when the damage leaves the bearer at 0 and nothing held it (`dnd5e.applyDamage`, after the write; the ask's Drop to 0 and the failed save too), the trait's save activity is used AT THE CORPSE: every creature with Hit Points within the activity's Emanation (edge to edge, `geometry.js` `creaturesWithin`), one demand card pinned to them, the fire and force rolled, the saves machine from there. No creature in reach: a card says so |
| **Saves against magic** | Magic Resistance · Greater Magic Resistance · Avoidance | `EFFECT_BENDS` feature rows on the `saves` facet (the Circle's Power judge, `spells: true`); `EVASIONS` | Magic Resistance is one ROW (Advantage against a demand marked as a spell or a Magical item). Greater: `succeeds` generalised from Trance's sleep branch to the spells branch — the save cannot fail, the Succeeds button the default. **Avoidance**: `EVASION` became the table `EVASIONS` keyed by feature, `ability` null reaching every save; the verdict and the receipt name the row that applied (`evasionBy`) |
| **Legendary Resistance** | every legendary creature | **NATIVE — no row** | dnd5e ships it: the NPC's `resistSave`, its button on the failed save's message, the `legres` resource the system spends; the saves machine has honoured the flip since v1.12 (`forced`, smoke-saves §6). A `SAVE_SUCCEEDS` row would be a second entry path to the same thing (a second entry path is never built) |
| **A heal at the turn start** | Regeneration | `TURN_GRANTS` (Heroism's machine, `turn-grants.js`) — **`match: "feature"`** rows | the bearer's OWN trait: its first heal activity rolled on the bearer's numbers at its turn start, receipted; `while: "aboveZero"`; the block (`unless: { damagedBy: "text" }`) read off the BEARER's copy of the trait — "takes Acid or Fire damage" — against the receipts since its last turn started (`decide/turn-grants.js` `blockingTypes`, `damagedSince`: the combat stamp on every receipt, its own turn counting). Blocked, a card says which damage stopped it and nothing lands |

**Why the block reads the monster's copy, not the row.** The pack ships ONE Regeneration item whose
text names no type; each monster's copy (the troll's Acid or Fire, the hydra's Fire, the vampire's
sunlight) carries its own clause. A row naming the troll's types would block the hydra on acid. The
copy is the data; a clause that is not a damage type is the table's (the row's caveat).

**Where it bends** (the register rows below, same commit): a damage card the module cannot read counts
Undead Fortitude (the gate never guesses an exemption); Death Throes skips the 0-HP creatures in reach
(the dead-target gate); Greater Magic Resistance's auto-miss of spell attacks is not built.

**Lists and settings.** No list joined: since *The settings* (2026-09-27) the code table is the only
list, so a new row is on. The HANDOFF's "verify-settings must carry the default" was stale.

### The walk table (deferred — rapid mode)

| Trait | Setup | What you should see |
| --- | --- | --- |
| Undead Fortitude | a zombie at 5 HP, a 10-damage slashing hit | the zombie sits at 1; a Constitution save rolls in chat (DC 15); "saves (N vs DC 15) — it drops to 1 Hit Point instead" or "fails the save — it drops to 0", the 0 then written |
| Undead Fortitude, exempt | the same with Radiant damage, or a Critical Hit | no save; "drops to 0 — Undead Fortitude does not apply · Radiant damage: no save" |
| Undead Fortitude, unreadable | 10 typed on the sheet | the save rolls (the row counts) |
| Death Throes | a balor at 5 HP, three creatures within 30 ft, one at 0 HP | the kill; one card "Death Throes — Balor dies: 2 creatures save", Dexterity DC 19, the 9d6 fire + 9d6 force rolled; the 0-HP one not asked |
| Magic Resistance | a drow targeted by Hold Person | the save dialog's section: "Magic Resistance — against a spell", Net Advantage |
| Greater Magic Resistance | a rakshasa targeted by Hold Person | "this save cannot fail", the Succeeds button the default; pressed, "cannot fail (Greater Magic Resistance)" |
| Avoidance | a creature with Avoidance under Fireball (Dex) and a Con half-damage save | a success takes none, a failure half, "(Avoidance)" on the row and the receipt |
| Legendary Resistance | a dragon failing a demanded save | dnd5e's own "Use Legendary Resistance" button on the roll; pressed, the verdict flips to saved "(legendary resistance)", the resource spent — nothing of the module's to see |
| Regeneration | a troll at 30/84 in combat | its turn start: "Regeneration — Troll regains 10 Hit Points", a receipt; after 8 fire dealt to it, the next turn start: "regains nothing this turn · it took Fire damage since its last turn"; the turn after pays again |

## The GM's side — the aura rows and the attack bends (2026-09-28, night; HANDOFF.md Stage 2)

**The shape.** The Monster Manual writes one aura sentence over and over: *"Constitution Saving Throw:
DC N, any creature that starts its turn in a 10-foot Emanation originating from the swarm"*. The
pack ships each as a save activity carrying the Emanation and the failure's condition. That is an
`EMANATIONS` feature row on a NEW trigger word, **`turnStart`** — the third beside `enter` and
`turnEnd` (the region behaviour's `tokenTurnStart`, the same path as the turn-end trigger, "started
its turn inside"). Nothing stands on a member (`effect: null`): the row lets the verdict land the
activity's own failure effect, where a standing aura's verdict never applies anything (Spirit
Guardians' Half Speed is the region's). A trait lent or taken mid-session raises or lowers its ring
(`createItem` / `deleteItem` sweep).

| Row | Reach | Note |
| --- | --- | --- |
| Fear Aura | harmful (`target: enemy`), off while Incapacitated | a success's 24-hour immunity is the table's |
| Fetid Aura · Stench | all ("any creature") | "an action or a Bonus Action, not both" / "other than a troglodyte" and the 1-hour immunity are the table's |
| Vile Appearance | all, `range: 30` (no Emanation on the activity — "within 30 feet"), `trigger.types: beast, humanoid` — the creature type is a fact the sheet holds, so the trigger narrows itself (DESIGN R1: the data settles it) | "can see its true form" is the table's |
| Lordly Presence | harmful, `activity: "Initial Save"` | the failure's pick (Captivated, Fearful, Mired) is used from the sheet |
| Aura of Authority | helpful, `activity: "Expend Use"`, a ring and a card | the Advantage on the members' attacks and saves is the table's (a bare ring is nothing the attack gate reads) |

**Measured and left NATIVE:** Sickening Vapors (the bearer's turn END), Horror Nimbus (a Bonus
Action), Horrific Visage (an action, a cone) — a save the BEARER uses; the drawing's "eight" is five.

**The attack bends.** Displacement and Blurred Form: `EFFECT_BENDS` feature rows, Disadvantage on
attacks against the bearer, on the new **`notIncapacitated`** judge (the bearer's status is a fact the
gate holds; the judge hinges on the target, so the target pass reads it).

### The walk table (deferred — rapid mode)

| Trait | Setup | What you should see |
| --- | --- | --- |
| Fear Aura | a monster with it in combat, a PC starting its turn within 30 ft | the PC's turn start: "Fear Aura — Pip started its turn inside the Balor's Fear Aura", a Wisdom save; a failure lands Frightened; the same PC entering later in the turn is not asked again |
| Stench | a troglodyte, an ally of it inside | the ally is asked too (reach all) |
| Vile Appearance | a hag, a Beast and a Construct within 30 ft | the Beast's turn start asks; the Construct's does not |
| Aura of Authority | a hobgoblin captain | a ring and a card; nothing lands on the allies |
| Displacement | a displacer beast attacked | the gate: "Displacer Beast is — Displacement", Disadvantage; Incapacitated, the row is gone |

## Rulings the code carried

The code built these as ruled, but RULINGS never recorded them; they lived only in code
comments until the comment pass of 2026-09-27 moved them here. Each belongs under its
feature's own heading when that section is next recut.

### Chips, clocks and the disposition cue

- The disposition cue on every dialog row is the token's ABSOLUTE disposition (as the canvas border draws it), never relative to whoever is rolling; a GM rolling for a monster sees its enemies' friendly tokens as allies, accepted.
- A once-per-turn chit (Cleave, Sneak Attack, clock riders) counts turns only in the attacker's OWN running combat; an actor outside any combat never meets "used this turn".

### Lucky's bought Advantage

- A bought Advantage (Lucky's box) is spent only when the roll goes out with the box ticked AND the pressed mode matches the net; a press against the net buys nothing, a roll with no dialog (shift-click) meets no box and spends nothing, and beside a Disadvantage the tick nets Normal and the use still goes

### Resource notices

- A resource spend flashes a notice only when its pool recovers on a rest or a day (the rhythm gate, no name list), only for player-owned actors, shown to every client; refunds and spell slots never flash.
- The ledger's spend stamp is unconditional — no setting gates it — and is written only at the spend's creation, never recovered later.

### Save demands and their areas

- Save presses deliberately leave out Command (Prone only on Grovel, a choice), Sleep (the Unconscious is a second save), Flesh to Stone (three failures) and Elemental Attunement / Mind Spike (a condition mentioned in passing)
- An area whose data misstates its life (the activity's duration is an effect's clock, or an imported copy lost its concentration flag) — Noxious Miasma, Hypnotic Pattern, and the concentration spells whose area only chooses targets at the cast (Slow, Fear, Confusion, Sleep, Calm Emotions, Faerie Fire) — is spent the moment its last verdict lands; an area that genuinely persists (Grease, Web, Cloudkill) is never listed
- An instantaneous area placed with nobody inside stamps its demand DONE (spent), so the floor sweeps it like a resolved one; only an area not yet placed waits clockless, and a duration area keeps its wait.
- Damage a save does not modulate (`onSave: "full"`, e.g. Web's burn) is never auto-rolled or applied by the demand; the card's own enricher stays for the GM to use when the situation arises.
- A demanded save runs as a popup the player presses (Players Roll Their Own Saves, set to roll automatically, rolls it with no popup); a multi-ability save auto-rolls the FIRST listed ability, and the fold accepts any listed one.
- Dead targets are skipped at the save demand's stamp — dead status, or an NPC at 0 HP — while a dying PC (0 HP, death saves ahead) is still demanded and takes the damage.
- A placed area is the save demand's authority in both directions: a creature inside joins the demand, a pending target outside drops, done verdicts stand; a corpse never joins.
- A spent area leaves the canvas: an instantaneous spell's area at its last consequence, a concentration spell's area when the concentration ends, a Spent Areas-listed spell's area at its last verdict whatever its data says; any other duration area stays for the GM to clear.

### The hit menu

- Sweeping Attack's second creature must be within 5 feet of the original target AND within the attacker's weapon reach (read off the sheet; 5 feet, 10 with Reach), and the popup names the ones out of reach
- Hovering a creature's button in the Sweeping Attack popup pings that token on the map and lights its hover state

### The maneuvers and the rescue window

- A d20 fold's re-offer after a spend keeps the ORIGINAL deadline — one clock resolves the whole moment, and no spend ever extends it.
- A scoped tactical fold (Ambush, Tactical Assessment) armed from the sheet raises a notice whose buttons ARE the checks the scope names (plus Initiative when a combat runs); pressing one rolls that check, and the choice is the acknowledgement.
- A tactical fold's cards (Ambush, Tactical Assessment) wear the maneuver family's eyebrow ("Maneuver — <name>"), not the D20 Fold one.
- In the rescue window (d20 folds + Precision), a spent or withdrawn row stays on screen greyed with its outcome on its face, a live row's button carries only the feature's name, and the die and cost are said in the single rule pane beside the hovered row's quote
- A rescue on a raw ability check (no DC anywhere in dnd5e) states the arithmetic and says "ask your DM whether that lands" instead of a verdict, and the offer stands until a human passes; an initiative rescue states just the number
- Precision Attack is offered only when the attack hit none of its targets; a mixed hit-and-miss swing gets no offer, since one damage roll serves every target
- When Precision Attack turns a miss into a hit after Graze already paid on the miss, the card announces the conflict and nothing is unwound

### The reaction hold

- An `ac`-kind reaction whose effect already stands on the defender is not offered again on the attack trigger (an AC bonus does not stack); a `damage` reaction and the spell/negate trigger keep asking.

### The table's small defaults

- A drunk healing potion with no target defaults to the drinker; a real target always wins (a DEFAULT, never a force), decided structurally (consumable + `heal` + `creature` + no template), with no setting.
- The roll/usage dialog's target block is display-only (no untarget checkbox, since every machine reads the message snapshot), carries no setting, and shows each row's disposition as neutral information — never an alarm flag, because many spells legitimately aim at allies.

### What a table leaves out, or narrows

- Hunter's Prey, Brutal Strike, Hand of Harm, Eldritch Smite, Lifedrinker's heal and Foe Slayer are deliberately NOT clock riders — each is a choice the sheet does not record or a judgment the module cannot make
- A rebuke spell answers at the lowest slot the sheet holds — there is no slot picker inside a Reaction's window; a player who wants to upcast casts from the sheet
- Twinned Spell is not offered on Animate Dead, Create Undead, Cordon of Arrows or Tasha's Mind Whip — their growing count is a corpse or an arrow, not a target (RULINGS names only Magic Missile, Scorching Ray and Jump)
- The unarmed-dice swap leaves a strike that already rolls a die (a Monk's Martial Arts) alone — "can … instead" makes that choice the table's
- The Poisoner's coating save uses the ability the feat's own Ability Score Improvement assigned, else the higher modifier of the abilities the pack offers (the first on a tie).

### The hit's sequence

- On a hit, nothing but the damage happens until the damage lands; then the mastery rider resolves; only then does any other hit offer (Shield Master's bash, for one) leave its queue for a popup, and its clock starts at that moment.

### Metamagic's windows

- A fold's offer window (Seeking, Empowered) closes at the click, not at the verdict; the dice may land for seconds after.
- A metamagic row's sub-controls (Heightened's target, Transmuted's damage type) are inert until that row is ticked.
- A reroll that patches a roll in place (Empowered, Seeking) rides a created roll message, so Dice So Nice animates the fresh dice.
