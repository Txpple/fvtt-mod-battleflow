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
  hit is two groups.
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

The ask itself still lives in the metamagic file with the flag key `metamagicAsk`; a third
customer moves it (BACKLOG *Architecture*).
