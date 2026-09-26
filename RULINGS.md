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
| **Shield**: "when you are hit" (2024: hit by an attack roll) — and every AC reaction beside it | offered after the roll shows a hit, before the damage | the defender's client cannot pause the attacker's roll: `dnd5e.preRollAttackV2` runs synchronously on the attacker's client, so the hold is stamped on the hit (`hold/trigger.js`) | 2026-08-15 (Phase 1.5, v1.1.0 — the hold's birth, `hold/index.js`) |
| **Lucky**: Disadvantage "when a creature rolls a d20 for an attack roll against you" | offered after the hit, before the damage — a second d20, the lower standing | the same | 2026-09-24 |
| **Warding Flare**: light flares "before it hits or misses" | offered after the hit | the same | 2026-09-24 |
| **Shadowy Dodge**: "when a creature makes an attack roll against you" | offered after the hit | the same | 2026-09-24 |
| **Protection** (the Fighting Style): "when a creature you can see attacks a target other than you" | offered to the guard after the roll shows a HIT, before the damage — the second d20, the lower standing (ruled R1, 2026-09-26); a miss asks nothing | the same (`hold/trigger.js` stamps the guards on the held target) | 2026-09-26 |
| **Protection** and **Interception**: "a creature you can see" · "another creature within 5 feet of you" | every creature within 5 feet of the one hit, on ITS side of the table (token disposition), not Incapacitated, holding what the style demands, is asked; sight is not judged | nothing the module reads says who can see whom; the side is the fact it can read, and the owner who cannot see simply passes (`geometry.js` `alliesWithin`) | 2026-09-26 |
| **Interception**: "reduce the damage dealt to the target" when an attack hits it | the attack's damage is held at the module's applier and each guard asked (P1); damage applied with the card's own buttons, or typed on a sheet, is not held | the applier's claim is the only seam where the damage waits (`damage-holds.js`, Stone's Endurance's shape) | 2026-09-26 |
| **Dueling, Defense, Great Weapon Fighting, Two-Weapon Fighting, Unarmed Fighting, Protection, Interception**: what you are "holding" / "wearing" | read off the sheet's EQUIPPED boxes; a Versatile weapon's grip is the attack's own mode (one hand or two) | the sheet has no hands — Equipped is the one fact dnd5e keeps about what is held (ruled off the prototype, 2026-09-26: "gate it on what pc is holding") | 2026-09-26 |
| **Unarmed Fighting**: "1d4 Bludgeoning damage to one creature Grappled by you" at the start of each of your turns | asked of the owner (ruled U1: Deal it / Skip), the clock dealing it; "grappled by you" is the Grappled effect's own provenance (the module's source stamp, else its origin's actor); a Grappled that names no grappler is OFFERED when it stands within 5 feet, and never dealt by the clock | the Grappled condition carries no grappler of its own — a status toggled from the token HUD says nothing about who holds it (`fighting-styles.js` `grapplerOf`) | 2026-09-26 |
| **Warding Flare** protects any creature the Cleric can see within 30 feet | protects its OWNER only | the hold is stamped per DEFENDER: only a hit target's own sheet is read for rows (`hold/lookup.js` `rollRescuesOf`) — a known gap, DESIGN §8 | 2026-09-24 |
| **Stone's Endurance**: "when you take damage" (any damage) | ASKED in one popup, and on the click the damage lands reduced by the roll (user, 2026-09-25: "the popup for stones endurance should show up, and if hte person rolls, then the damage is auto reduced"): an attack hit asks at the hit (the hold); every other damage the MODULE applies is held at its applier until the answer (`damage-holds.js`); damage applied with the card's OWN buttons or typed on a sheet is reduced by hand | only the module's own applier can make a number wait: the card's buttons call `Actor#applyDamage` straight, and `dnd5e.preApplyDamage` is synchronous — no popup can be answered inside it (`auto-apply.js` `registerDamageClaim`) | 2026-09-24; widened 2026-09-25 |
| **Powerful Build**: Advantage on "any ability check you make to end the Grappled condition" | while the Goliath IS Grappled, its Athletics and Acrobatics checks have Advantage, whatever they are for | nothing tells an escape check from any other check the module meets (`EFFECT_BENDS` `checksWhen`); the bearer's status and the escape's two skills are the facts it can read | 2026-09-25 |
| **Storm's Thunder, Hellish Rebuke, Fount of Moonlight, Retaliation, Sword of Answering** — a Reaction when a creature damages you | offered only when the damage names its dealer: the card it came from (any application with an originating card — the module's, or the card's own buttons); an HP typed on a sheet offers nothing | `dnd5e.applyDamage` knows the dealer only through `originatingMessage`; a sheet edit carries none (`rebukes.js`) | 2026-09-25 |
| **Trip Attack and Hill's Tumble on one hit** (the rules allow a maneuver and the boon together) | one hit-menu pick per hit; a clock rider (Fire's Burn, Frost's Chill) still rides beside any pick | the pick is ONE record (`hitPick` → `hitManeuver`), so a second pick would be dropped in silence (`decide/hit-menu.js` `hitPick`); the array shape is BACKLOG's | 2026-09-24 |
| **Brave / Fey Ancestry / Dwarven Resilience** on a save to END the condition | the row is listed on the gate, not counted | an end-of-turn repeat save is a bare sheet roll with no demand to read what it is against (R1: never guessed) | 2026-09-24 |
| **Disadvantage imposed on an attack rolled WITH Advantage** (the two cancel) | the plain roll is the FIRST d20 rolled — the first face a reroll modifier did not replace — and no second d20 is rolled | both dice are already on the table, and the first was chosen before anyone saw a face (`decide/rescue-hit.js` `d20Faces`, `disadvantageOutcome`) | 2026-09-24 |
| **A critical hit** when a live Disadvantage row could undo it | the damage is NOT rolled at the hit; it is rolled once after the answer, doubled only if the crit still stands for every hit target | doubled dice rolled before the answer would be discarded the moment the second d20 comes up lower (`hold.critAtStake`, `auto-damage.js` `damageAfterHold`) | 2026-09-24 |
| **Heroic Inspiration, Precision Attack, Graze** once a defender's Lucky (or any `roll` row) turned the hit into a miss | not offered to the attacker | the attacker's rescues are offered at `dnd5e.rollAttackV2`, where the roll was a hit; nothing re-offers them after the hold's verdict — a known gap, DESIGN §8 (Graze already had it for Shield, `mastery.js`) | 2026-09-24 |
| **Lucky**: Advantage "when you roll a d20 for a D20 Test" — chosen as you roll | in the roll dialog: a box with a tick, spent when the roll goes out ticked (`advantage-buys.js`). An initiative rolled with NO dialog (the carousel, Roll All) is offered it AFTER the roll — a second d20, the higher standing — so the player has seen the first die when choosing (ruled "After the roll", 2026-09-25) | `Combat#rollInitiative` rolls with no pause before its dice and no hook that can wait for an answer (`dnd5e.preConfigureInitiative` is synchronous), so no popup can come before that roll (`d20-folds.js` `ADVANTAGE`) | 2026-09-25 |
| **Relentless Endurance** ("when you are reduced to 0 Hit Points") and **Death Ward** ("the first time the target would drop to 0 Hit Points") | caught on DAMAGE applied through the system's damage application — the module's applier and the card's own buttons: the Hit Points are written as 1 in that same update (Death Ward automatic, the effect removed; Relentless Endurance held at 1 while its popup asks, and the clock's pass lands the 0). Hit Points typed on a sheet, or a drop to 0 with no damage, are the table's | `dnd5e.preApplyDamage` is the one place a drop can be changed before it lands, and it is synchronous — the ask has to stand at 1, not at 0; a sheet edit carries no damage to read (`drop-to-one.js`) | 2026-09-25 |
| **Celestial Revelation's extra damage** on a spell with no attack roll: dealt "when you deal damage to it", with the spell | offered on the spell's card once its damage has landed; the pick lands as its OWN damage (its own card and receipt) — a concentrating target makes a second Constitution save for it | the extra goes to ONE of the spell's targets, the caster's pick, and the spell's damage is one roll applied to all of them: it cannot ride the roll, and the spell's receipt is keyed by creature, so an entry there would overwrite the spell's own (`clock-riders.js`) | 2026-09-25 |

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
  sweep (the switch is the setting or the list).
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
  `preRollDamageV2` before any rider pushes its roll, the doubled set on a crit — never a modifier,
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
  carries (1d4r1 + Str) at `preRollDamageV2`, with one line on the damage card; a strike already
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
- **The numbers on the roll** (`preRollDamageV2`, by the attack's own mode): **Great Weapon
  Fighting** floors every damage die of the attack at 3 (`min3`, a crit's doubled dice included —
  "a damage die"), only in two hands with a Two-Handed or Versatile melee weapon; **Thrown Weapon
  Fighting** +2 on a thrown attack; **Two-Weapon Fighting** the ability modifier back on the
  off-hand attack (dnd5e keeps a negative one already); **Dueling** +2 (the pack's number) with one
  melee weapon in one hand and no other weapon — a Versatile weapon swung two-handed says "Dueling
  off — two hands", and nothing else does (a line on every Greatsword swing was noise).
- **The notice, option B:** a gold line (a deep amber on the light theme — `light-dark()`) on the damage card per style that CHANGED the roll
  ("Great Weapon Fighting — 1 and 2 → 3: +3"), and "+3 Great Weapon Fighting" floated over the
  target once; the `fightingStyle` record carries each style's `gain` for the stats reader
  (ARCHITECTURE §4). A floor that raised nothing leaves no trace.
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
  `named`, `item`, `sourceWithin`). **Interception** is an `INTERRUPT_REDUCTIONS` row with `ally` —
  the attack's damage is claimed at the applier (Stone's Endurance's seam), the first guard to
  intercept rolls 1d10 + PB and the damage lands short by it.
- **Found on the way:** dnd5e 6.0 stamps an applied effect's origin with the ACTIVITY, so the gate's
  `item` discriminator never knew the item — Protection from Evil and Good's "Protected" matched
  every "Protected" (the Aura of Protection's included). The gate reads through to the item now.
