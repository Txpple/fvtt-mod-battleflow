// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the membership lists, one shape.
 *
 * Moved verbatim out of hold.js, maneuvers.js and hit-riders.js (ARCHITECTURE §10 D5, "move, do
 * not rewrite"), then unified here (ARCHITECTURE §6, 2026-08-23). Strings in, entries out — no `game`, no
 * `setting()`, no warnings, no globals. Each list keeps a one-line EDGE wrapper in
 * settings.js that reads its setting and delegates, which is the whole split: reading the
 * world is EDGE, deciding what the string MEANS is not.
 *
 * ⚠ WHY THIS MATTERS MORE THAN IT LOOKS (ARCHITECTURE.md §6, the strict-parse contract): a
 * typo in a world setting does not raise anything. The entry simply drops and the feature it
 * named silently does nothing, forever, with no error to notice. These parsers are the only
 * thing standing between a stray character and a dead feature.
 *
 * ⚠ WHAT PHASE 3 CHANGED, AND WHY IT WAS WORTH CHANGING. There were five list parsers with
 * FOUR different failure behaviours — default-to-`ac` (interrupts), silent drop (blocks,
 * upgrades), drop-and-report (folds), and no validation whatsoever (riders) — and exactly one
 * of the five declared its kind set in code. Which behaviour a given list had was an accident
 * of which session wrote it. Now every list is a SPEC and there is one parser: same splitting,
 * same trimming, same required-column rule, same closed-kind test, same reject report.
 *
 * ⚠ THE SPECS DECLARE, THEY DO NOT READ. A spec names its setting KEY as a plain string so the
 * static gate can pair a list with its registration and its shipped default; nothing here ever
 * reads a setting, and this file still imports nothing at all.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/** The closed set of maneuver fold kinds. Unknown kinds are DROPPED, never guessed. */
// `command` (2026-09-05): Commander's Strike — a Bonus Action that gives an ALLY a Reaction attack
// with the fighter's die on its damage: Riposte's driven attack with the attacker changed.
// `shove` (2026-09-25, the origin feats): Tavern Brawler's push on an Unarmed Strike hit - the bash
// offer's shape with no save behind it; accepting announces the 5-foot push (bash-offer.js).
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew", "command", "shove"]);

/** The closed set of interrupt kinds — what a held reaction changes about an attack. */
// `roll` (Slice A, ruled 2026-09-24 off prototypes/slice-a.html): the defender bends the ROLL
// itself — Disadvantage imposed after the hit showed, a second d20 and the lower standing. Not
// `ac` (the AC never moves, and a natural 20 can be undone, which an AC change never can) and
// not `damage` (it changes whether the attack hit at all). Its rows are INTERRUPT_ROLLS.
export const INTERRUPT_KINDS = new Set(["ac", "damage", "roll"]);

/**
 * DAMAGE INTERRUPTS THE MODULE CAN SETTLE ITSELF (user, 2026-09-02: "uncanny dodge … doesn't
 * half the damage"): a `damage`-kind reaction whose whole effect is a MULTIPLIER on the
 * triggering attack's damage. The applier lands the reactor's share at that multiplier and the
 * receipt row says why; a damage interrupt not listed here (Absorb Elements — resistance to one
 * type; Deflect Attacks — reduce by a roll) stays "reduce by hand", because its arithmetic is
 * not a number the module can read. Keyed by the Interrupt list's own names.
 */
export const INTERRUPT_MULTIPLIERS = Object.freeze({
  "Uncanny Dodge": Object.freeze({ multiplier: 0.5,
    rule: "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s damage against you (round down)." })
});

/**
 * DAMAGE INTERRUPTS THAT REDUCE BY A ROLL (2026-09-05, the Battle Master's Parry — "reduce the
 * damage by the number you roll on your Superiority Die plus your Strength or Dexterity
 * modifier"): a `damage`-kind reaction whose effect is a SUBTRACTION the module can roll. The
 * pack ships Parry as a "Heal" Reaction activity whose healing formula IS the reduction
 * (`@scale.battle-master.superiority.die + max(@abilities.str.mod, @abilities.dex.mod)` — the
 * pack's max() stands in for the player's choice); the hold reads that formula, rolls it in the
 * open at the answer, and the applier lands the attack's damage against the reactor short by
 * that number, the receipt row saying why. ⚠ Keyed by the Interrupt list's own names — and the
 * Monster Manual ships a different "Parry" (a +2 AC Reaction, `ac`); the row applies only where
 * the found item carries the named activity, so the monster's stays an AC hold.
 *
 * The Goliath's Stone's Endurance (Slice A, 2026-09-24) is the second row, the same shape: the
 * pack's heal activity whose formula (`1d12 + @abilities.con.mod`) is the reduction, spent from
 * the item's OWN uses (its activity consumes `itemUses` with an empty target — the item itself).
 * Before this row it held as a plain damage interrupt: Cast USED the heal, healing a Goliath at
 * full HP, and the whole hit landed "reduce by hand". An attack hit is the attack hold's; since
 * the Goliath walk (2026-09-25, ruled "Hold before it lands") ANY other damage the module applies
 * is held for it too (damage-holds.js, the applier's claim) — `any` below.
 *
 *   activity  the activity's name — or, when the stored name is EMPTY (Stone's Endurance's is:
 *             dnd5e shows the type's localized title), the first heal activity: locale-proof
 *   pool      true — the activity's consumption target is spent, one use, and none left offers nothing
 *   eyebrow   the family the card and popup wear: "Maneuver" (Parry) or "Reaction" (a species trait)
 *   spend     what one use is called on the cost line: "Superiority Die", "use"
 *   hit       the trigger as the card says it: "melee attack" (Parry's rule), "attack" (any hit)
 *   by        what the reduction is, in words, for the popup's ask
 *   any       true — "when you take damage": every damage the module applies is held for it, not
 *             only an attack hit (damage-holds.js); Parry's "melee attack roll" is not
 */
export const INTERRUPT_REDUCTIONS = Object.freeze({
  "Parry": Object.freeze({ activity: "Heal", pool: true,
    eyebrow: "Maneuver", spend: "Superiority Die", hit: "melee attack", by: "the die plus your modifier",
    rule: "When another creature damages you with a melee attack roll, you can take a Reaction and expend one Superiority Die to reduce the damage by the number you roll on your Superiority Die plus your Strength or Dexterity modifier (your choice).",
    from: "Fighter — Battle Master 3" }),
  "Stone's Endurance": Object.freeze({ activity: "Heal", pool: true,
    eyebrow: "Reaction", spend: "use", hit: "attack", by: "1d12 plus your Constitution modifier", any: true,
    rule: "When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total.",
    from: "Goliath — Giant Ancestry (Stone)" })
});

/**
 * THE `roll` INTERRUPTS (Slice A, ruled 2026-09-24 off prototypes/slice-a.html): a defender's
 * answer to a hit that imposes Disadvantage on the attack roll already made — a second d20 with
 * the attack's own modifiers, the lower standing, the verdict taken again against the live AC
 * (decide/rescue-hit.js holds the arithmetic). Three customers and three COST shapes, which is
 * the whole of what differs between them — so the shape is data and the mechanism is one:
 *   reaction  true when the answer takes the Reaction (the chip); Lucky takes none
 *   uses      true when it spends one of the ITEM's own uses (Lucky's Luck Points, Warding
 *             Flare's Wisdom-mod uses); Shadowy Dodge spends nothing but the Reaction
 *   point     what one use is called on the row's tag, when the table calls it something
 *   activity  the pack's activity that IS this answer, by name — a use from the sheet answers
 *             the hold (the cast-IS-the-answer path); Lucky ships two, only "Disadvantage" is this
 *   after     what the rule leaves to the table once the roll is bent — a card line, never a move
 * ⚠ Keyed by the Interrupt list's own names (the `roll` kind); membership stays that list. The
 * `rule` is the pack's text VERBATIM (law 8) — Lucky's Disadvantage paragraph alone, Warding
 * Flare's with the pack's "currently N" lookup dropped, as the ruled prototype quotes them.
 * ⚠ The 2014 Halfling's "Lucky" TRAIT shares the name and none of this (no uses, no activity —
 * the natural-1 reroll dnd5e plays natively): the lookup demands the item's own uses.
 */
export const INTERRUPT_ROLLS = Object.freeze({
  "Lucky": Object.freeze({ reaction: false, uses: true, point: "Luck Point", activity: "Disadvantage",
    rule: "Disadvantage. When a creature rolls a d20 for an attack roll against you, you can spend 1 Luck Point to impose Disadvantage on that roll.",
    from: "Origin feat" }),
  "Warding Flare": Object.freeze({ reaction: true, uses: true, point: null, activity: "Flare",
    rule: "When a creature that you can see within 30 feet of yourself makes an attack roll, you can take a Reaction to impose Disadvantage on the attack roll, causing light to flare before it hits or misses. You can use this feature a number of times equal to your Wisdom modifier (minimum of once). You regain all expended uses when you finish a Long Rest.",
    from: "Cleric — Light Domain 3" }),
  "Shadowy Dodge": Object.freeze({ reaction: true, uses: false, point: null, activity: "Shadowy Dodge",
    after: "teleport up to 30 feet if you wish (the table moves the token)",
    rule: "When a creature makes an attack roll against you, you can take a Reaction to impose Disadvantage on that roll. Whether the attack hits or misses, you can then teleport up to 30 feet to an unoccupied space you can see.",
    from: "Ranger — Gloom Stalker" })
});

/**
 * The closed set of D20 FOLD kinds — the three surveyed features (v1.23.0), which are one
 * mechanism wearing three different SPENDS. The arithmetic they share already shipped with D8
 * (`foldedRoll`/`foldedVerdict`/`foldedSave` handle `add` and `replace` on both sides); what
 * genuinely differs per feature — and therefore what earns a kind under R4 — is where the
 * marker lives and how you take it away:
 *
 *   heroic    `system.attributes.inspiration`, a bare BooleanField. Spending it is a WRITE.
 *   tactical  Second Wind's `itemUses`, reached through a real utility activity. `use()`.
 *   bardic    an ActiveEffect ("Inspired") the bard applied. Spending it is a DELETE.
 *
 * ⚠ THREE SPENDS, THREE DIE SOURCES, AND ONLY ONE OF THEM HAS AN ACTIVITY. Measured in the
 * dnd5e 5.3.3 source and this world's own PHB pack, 2026-08-23:
 *   - `heroic` has NO activity anywhere in the system, and a boolean is not one of the five
 *     consumption kinds (activityUses · itemUses · material · hitDice · spellSlots), so there
 *     is no consumption route to hang it on. The module writes the field, which is exactly
 *     what the system's own sheet toggle does.
 *   - `bardic`'s die formula is `@scale.bard.inspiration` — a scale value on the GRANTING
 *     BARD, not on the creature holding the die. It resolves cross-actor, through the
 *     effect's `origin`.
 *   - only `tactical` is Precision-shaped: an activity, consumed with `use()`.
 *
 * ⚠ These are NOT contribution shapes. `add`/`replace`/`ac`/`verdict` are mechanism vocabulary
 * and deliberately uncounted (§6); a kind here names a SPEND, which is content, which is
 * precisely what the R4 tripwire is counting.
 */
// `advantage` (2026-09-25, the Halfling walk - Lucky's Advantage half unparked): a SECOND d20 with the
// roll's own modifiers, the higher standing, paid with one of the item's own uses - the post-roll
// road for an initiative rolled with no dialog (the carousel, Roll All), where the gate's box
// (ADVANTAGE_BUYS) never showed. A kind because the arithmetic differs from all four: neither an
// add nor a plain replace, a keep-the-higher of two.
export const D20_FOLD_KINDS = new Set(["heroic", "tactical", "bardic", "seeking", "advantage"]);

/**
 * The closed set of volley kinds. Lives here, in the pure layer, so that ONE definition serves
 * the shipping registry and the static gate alike. ⚠ It used to exist twice: volley-registry.js
 * knew them implicitly and `tools/check-registry.mjs` re-declared them as a lookalike — the
 * exact defect Phase 2 removed for the maneuver kinds and then left standing here.
 */
export const VOLLEY_KINDS = new Set(["damage", "attack"]);

/**
 * The weapon masteries this module RESOLVES. Seven of the system's eight — `nick` is
 * deliberately native (it is pure action economy, and ruling 1 says action economy is not this
 * module's job), which is why it is declared below rather than merely absent. An absence and a
 * decision look identical in a switch statement; only one of them survives a code review.
 */
export const MASTERY_KINDS = new Set(["vex", "sap", "cleave", "slow", "topple", "push", "graze"]);

/** Masteries the system has and this module deliberately leaves alone. See MASTERY_KINDS. */
export const MASTERY_NATIVE = new Set(["nick"]);

/** Walk-5 (z): what each mastery popup quotes (DATA, moved here from mastery.js 2026-09-01 so the
 * reminder gate can quote it without a sideways import) — the 2024 property text VERBATIM, matched
 * against the system's own rules journal by tools/check-mastery-rules.mjs (first run as a probe 2026-08-21,
 * dnd5e 5.3.3; punctuation included). Never paraphrase these; the module's operational
 * hints ride as separate lines wherever they are needed. */
export const MASTERY_RULES = Object.freeze({
  slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn’t exceed 10 feet.",
  topple: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  push: "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  graze: "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  vex: "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  sap: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  cleave: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but don’t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."
});

/** Walk-5 (z): the maneuver folds' rule lines, the popups' quotes (DATA, moved here from
 * maneuvers.js 2026-09-05 with the split by moment — the 2026-09-01 precedent above) — the 2024 text VERBATIM, read off this
 * world's own PHB compendium items 2026-08-21 (punctuation included; the source mixes curly
 * and straight apostrophes). The popups keep the module's operational hints as separate
 * lines; these strings are the rules and must never be paraphrased. Keyed by KIND — the
 * folds list maps items onto kinds, and each kind's mechanics are these features'. */
export const RULE_TEXT = {
  // ⚠ PRECISION'S QUOTE LIVES IN `RESCUE_KINDS` (decide/present.js) AND IS READ FROM THERE.
  // It is the one fold kind that is also a RESCUE — the merged window draws it into its own
  // quote pane — and law 8 says the quote IS the rule, so a second copy that drifts is the
  // module telling the table something untrue. No key for it here (nothing ever read one;
  // this layer imports nothing, present.js included). Every other kind is the folds' alone.
  riposte: "When a creature misses you with a melee attack roll, you can take a Reaction and expend one Superiority Die to make a melee attack roll with a weapon or an Unarmed Strike against the creature. If you hit, add the Superiority Die to the attack's damage.",
  bash: "If you attack a creature within 5 feet of you as part of the Attack action and hit with a Melee weapon, you can immediately bash the target with your Shield if it’s equipped, forcing the target to make a Strength saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice). You can use this benefit only once on each of your turns.",
  shove: "Push. When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can deal damage to the target and also push it 5 feet away from you. You can use this benefit only once per turn.",
  bashChoice: "On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice).",
  interpose: "If you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you can take a Reaction to take no damage if you succeed on the saving throw and are holding a Shield.",
  hew: "Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the same weapon as a Bonus Action.",
  command: "When you take the Attack action on your turn, you can replace one of your attacks to direct one of your companions to strike. When you do so, choose a willing creature who can see or hear you and expend one Superiority Die. That creature can immediately use its Reaction to make one attack with a weapon or an Unarmed Strike, adding the Superiority Die to the attack's damage roll on a hit."
};

/**
 * The REMINDER kinds — the sources of Advantage or Disadvantage the gate can read off the table
 * before an attack roll (HANDOFF Stage 2, 2026-09-01). Each is a distinct way of KNOWING:
 *   vex    the attacker's own Vexed chip on a target      → Advantage
 *   sap    a Sapped chip on the attacker                   → Disadvantage
 *   prone  the Prone status, both roles: the attacker prone → Disadvantage; the target prone →
 *          Advantage within 5 feet of it, Disadvantage beyond (decide/reminders.js)
 *   condition  a row of the condition table (CONDITION_BENDS) on either side
 *   range  a RANGED attack roll's geometry (user, 2026-09-02): the target beyond normal range →
 *          Disadvantage, beyond long range → cannot be made (listed, not counted); an enemy
 *          within 5 feet of the attacker → Disadvantage (RANGE_RULES, decide/reminders.js)
 *   sneak  the Sneak Attack CHOICE beside the roll (user, 2026-09-02): the feature on the
 *          attacker's sheet and a Finesse or ranged weapon offer a tick — the player judges the
 *          conditions, the module carries the dice (SNEAK_ATTACK, CUNNING_OPTIONS)
 *   effect an ability on either sheet that bends the roll — an active effect or a feature by
 *          name, a row of EFFECT_BENDS (user, 2026-09-02); WHICH rows count is the Effect
 *          Sources list, membership like the condition table
 * The gate never SETS a mode (DESIGN R-A): it lists every source and the net, and a human presses.
 * Membership — which of these a table wants nagged about — is the Reminder Sources list.
 */
// `buy` (2026-09-25, the Halfling walk): the gate's SPEND box - Advantage bought with an item's use
// before the roll (ADVANTAGE_BUYS, Lucky the first row). A kind because it is the one source the
// roller CHOOSES rather than one the module reads: a tick, like Sneak Attack's, not a tag.
export const REMINDER_KINDS = new Set(["vex", "sap", "prone", "condition", "range", "effect", "sneak", "buy"]);

/**
 * THE ADVANTAGE BUYS (2026-09-25, the Halfling walk: "we need to unpark the advantage on our own
 * d20"; ruled off the prototype lucky-advantage.html, "looks good"): Advantage on your OWN D20
 * Test, bought before the roll with one of the item's uses. The gate draws one box per row the
 * roller holds - the Sneak Attack box's shape, a tick where the other boxes carry a tag - inside
 * the system's own roll dialog for an attack, a save, a check and initiative (advantage-buys.js).
 * The tick counts as an Advantage source in the net (a Disadvantage beside it nets Normal and the
 * use still goes - the rule allows it, ruled); the use is spent when the roll goes out with the
 * box ticked and the net pressed. A roll with no dialog (a shift-click) meets no box and spends
 * nothing (ruled). An initiative rolled with no dialog at all (the carousel, Roll All) is offered
 * the same buy AFTER the roll - the `advantage` D20 fold: a second d20, the higher standing
 * (ruled "After the roll"; a bend in RULINGS' register - the player sees the first die).
 *   uses      true - the spend is one of the ITEM's own uses (Lucky's Luck Points, @prof per Long Rest)
 *   point     what one use is called on the box and the receipt
 *   tests     which D20 Tests the rule reaches ("a D20 Test": attack, save, check, initiative)
 *   rule      the pack's paragraph for this half, verbatim (law 8)
 * ⚠ The 2014 Halfling's "Lucky" TRAIT shares the name and has no uses - the lookup demands them,
 * as INTERRUPT_ROLLS' does.
 */
export const ADVANTAGE_BUYS = Object.freeze({
  "Lucky": Object.freeze({ uses: true, point: "Luck Point", activity: "Advantage",
    tests: Object.freeze(["attack", "save", "check", "initiative"]),
    rule: "Advantage. When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.",
    from: "Origin feat" })
});

/**
 * SNEAK ATTACK (user, 2026-09-02 — the prototype *Sneak Attack, Cunningly*, built as drawn): the
 * feature by NAME on the attacker's sheet, its dice read off the feature's own damage activity
 * (`@scale.rogue.sneak-attack`, resolved on the sheet — never a table of dice by level), and its
 * rule quoted verbatim from the 2024 PHB pack. The gate's seventh kind: a CHOICE beside the
 * roll — a checkbox in the section, because the roll still needs its Advantage / Normal press.
 * The PLAYER decides whether the conditions hold (user: "the player can determine if they have
 * the conditions"); the module reads what it can (the weapon is Finesse or ranged, the roll's
 * net, and — reopened 2026-09-22 — an ally of the rogue within 5 feet of the target, off the
 * map) and ticks the box when they hold; the tick stays the player's. The DAMAGE is automated: the dice ride
 * the damage roll (the hit-riders seam), crit-doubled for free, once per turn as a turn chip.
 */
export const SNEAK_ATTACK = Object.freeze({
  feature: "Sneak Attack",
  improved: "Improved Cunning Strike",     // up to TWO Cunning Strike effects
  rule: "Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage’s type is the same as the weapon’s type. You don’t need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn’t have the Incapacitated condition, and you don’t have Disadvantage on the attack roll.",
  cunning: "When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die before rolling, and the effect occurs immediately after the attack’s damage is dealt.",
  dc: "If a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus."
});

/**
 * THE CUNNING STRIKE OPTIONS, read off the sheet (user ruling 2026-09-02: "the option list is
 * READ OFF THE SHEET, subclass included") — each row names the FEATURE that grants it, the SAVE
 * ACTIVITY dnd5e ships on that feature (the effect lands through the saves machine, with the
 * condition the pack attaches), and its die cost. A row with no activity is a LINE on the card
 * (Withdraw, Stealth Attack) — movement and stealth are the table's. The 2024 PHB pack as
 * measured 2026-09-02 (tools/probe-clock-riders.mjs):
 *
 *   Cunning Strike     Poison (1d6, Con, Poisoned 1 min) · Trip (1d6, Dex, Prone) · Withdraw (1d6)
 *   Devious Strikes    Daze (2d6, Con) · Knock Out (6d6, Con, Unconscious) · Obscure (3d6, Dex, Blinded)
 *   Supreme Sneak      Stealth Attack (1d6) — the Thief
 *   Envenom Weapons    UPGRADES Poison — the Assassin: the pack's activity carries the damage
 *                      (2d8 poison on a failed save, as shipped; its text says 2d6 — the data
 *                      wins, N1) and no condition, so the failure ALSO presses Poisoned
 *   Rend Mind          the Soulknife, Psychic Blades only, no die cost: a free use, or three
 *                      Psionic Energy Dice — the pack's two activities
 *
 * `upgrade.onFail` names what the module applies on top of the upgraded activity's own
 * consequences; `weapon` restricts the row to attacks with that item name.
 */
export const CUNNING_OPTIONS = Object.freeze({
  poison: Object.freeze({ feature: "Cunning Strike", activity: "Poison", cost: 1,
    caveat: "you must have a Poisoner’s Kit on your person",
    rule: "Poison (Cost: 1d6). You add a toxin to your strike, forcing the target to make a Constitution saving throw. On a failed save, the target has the Poisoned condition for 1 minute. At the end of each of its turns, the Poisoned target repeats the save, ending the effect on itself on a success. To use this effect, you must have a Poisoner’s Kit on your person.",
    upgrade: Object.freeze({ feature: "Envenom Weapons", activity: "Poison", onFail: "poisoned", effectFrom: "Cunning Strike",
      rule: "When you use the Poison option of your Cunning Strike, the target also takes 2d6 Poison damage whenever it fails the saving throw. This damage ignores Resistance to Poison damage." }) }),
  trip: Object.freeze({ feature: "Cunning Strike", activity: "Trip", cost: 1,
    rule: "Trip (Cost: 1d6). If the target is Large or smaller, it must succeed on a Dexterity saving throw or have the Prone condition." }),
  withdraw: Object.freeze({ feature: "Cunning Strike", activity: null, cost: 1,
    rule: "Withdraw (Cost: 1d6). Immediately after the attack, you move up to half your Speed without provoking Opportunity Attacks." }),
  daze: Object.freeze({ feature: "Devious Strikes", activity: "Daze", cost: 2,
    rule: "Daze (Cost: 2d6). The target must succeed on a Constitution saving throw, or on its next turn, it can do only one of the following: move or take an action or a Bonus Action." }),
  knockOut: Object.freeze({ feature: "Devious Strikes", activity: "Knock Out", cost: 6,
    rule: "Knock Out (Cost: 6d6). The target must succeed on a Constitution saving throw, or it has the Unconscious condition for 1 minute or until it takes any damage. The Unconscious target repeats the save at the end of each of its turns, ending the effect on itself on a success." }),
  obscure: Object.freeze({ feature: "Devious Strikes", activity: "Obscure", cost: 3,
    rule: "Obscure (Cost: 3d6). The target must succeed on a Dexterity saving throw, or it has the Blinded condition until the end of its next turn." }),
  stealthAttack: Object.freeze({ feature: "Supreme Sneak", activity: null, cost: 1,
    rule: "Stealth Attack (Cost: 1d6). If you have the Hide action’s Invisible condition, this attack doesn’t end that condition on you if you end the turn behind Three-Quarters Cover or Total Cover." }),
  rendMind: Object.freeze({ feature: "Rend Mind", activity: Object.freeze(["Rend Mind (Free)", "Rend Mind"]), cost: 0, weapon: "Psychic Blade",
    rule: "When you use your Psychic Blades to deal Sneak Attack damage to a creature, you can force that target to make a Wisdom saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus). If the save fails, the target has the Stunned condition for 1 minute. The Stunned target repeats the save at the end of each of its turns, ending the effect on itself on a success. Once you use this feature, you can’t do so again until you finish a Long Rest unless you expend three Psionic Energy Dice (no action required) to restore your use of it." })
});

/**
 * DEATH STRIKE (the Assassin, level 17): not an option — a clock rider on the Sneak Attack
 * itself. The pack's activity is the save; on a failure the attack's damage lands a second
 * time (the receipt's own amounts, doubled through the applier), said on the card.
 */
export const DEATH_STRIKE = Object.freeze({
  feature: "Death Strike", activity: "Death Strike", when: "firstRound",
  rule: "When you hit with your Sneak Attack on the first round of a combat, the target must succeed on a Constitution saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus), or the attack’s damage is doubled against the target."
});

/**
 * DAMAGE RIDERS ON THE COMBAT CLOCK (user, 2026-09-02 — "the assassin, gloomstalker" class:
 * "should just notify the player that they are available and will be added to the damage";
 * a crit doubles them, which the crit stamp does for free). A second class of rider beside the
 * marks (hit-riders.js): the condition is the ROUND or the TURN, not a chip on the target —
 * facts the platform holds and the module already reads for expiry. Each row names the FEATURE
 * that grants it (matched by name on the attacker's sheet — what a GM can type), the damage
 * activity the pack ships on it (the dice are READ off the sheet, scaled — the Gloom Stalker's
 * scale value), and its clock:
 *
 *   when      "oncePerTurn" — the once-per-turn chit (the Cleave shape); out of combat there is
 *             no turn, so it rides every hit · "firstRound" — combat.round === 1, never out of combat
 *             · "any" — due on EVERY hit, uses permitting (Slice A, 2026-09-24: the Goliath's Fire's
 *             Burn and Frost's Chill — no clock of their own, only a use; user, 2026-09-24: "yes you
 *             should switch" — a Goliath owns one boon: use-it-or-not is the rider's question, not
 *             the menu's)
 *   uses      true — the feature carries limited uses: one is consumed, none left means not offered.
 *             Read off the ACTIVITY when it carries them (Dreadful Strike), else off the ITEM its
 *             consumption names — the item itself for an empty target (2026-09-24: the species
 *             packs put every use on the item), and the spend is written where the uses live
 *   effects   true — when the rider rides, the rider activity's own applied effects land on the hit
 *             target, receipted on the damage card (2026-09-24, Frost's Chill's "Chilled"); the one
 *             path the hit menu's `effects` uses (effect-riders.js `applyActivityEffectsOnHit`)
 *   clock     a CHIP_WINDOWS key those effects land with, pinned to the ATTACKER's place — for a
 *             pack effect with no duration that means the rule (`slow`: "until the start of your
 *             next turn", the Slow mastery's sentence)
 *   label     what the offer and the card call the rider, when the activity's name would not say
 *             it ("Burn" → "Fire's Burn"); the activity's name by default, the feature's for "Damage"
 *   requires  "sneak" — only on an armed Sneak Attack (Assassinate's second clause)
 *   judge     "raging" — the bearer must be raging (an effect named Rage, or the status)
 *   type      "weapon" — the extra damage takes the WEAPON's own type; otherwise the part's first
 *   weapon    true — a weapon attack only (every 2024 row says "with a weapon")
 *   caveat    what the module cannot judge, said on the line
 *
 * Found by a 30-pack survey of every feature whose text conditions extra damage on the clock
 * (tools/probe-clock-riders.mjs, 2026-09-02). Left out on purpose: Hunter's Prey (Colossus
 * Slayer or Horde Breaker is a choice the sheet does not record), Brutal Strike (a forgone
 * Advantage — a choice), Hand of Harm / Eldritch Smite / Lifedrinker's heal (a resource spend —
 * a choice), Foe Slayer (a favored enemy the module cannot judge). Death Strike is the Sneak
 * Attack's own (DEATH_STRIKE). Membership is the Clock Riders list.
 */
export const CLOCK_RIDERS = Object.freeze({
  "dread-ambusher": Object.freeze({ feature: "Dread Ambusher", activity: "Dreadful Strike", when: "oncePerTurn", uses: true, weapon: true,
    rule: "Dreadful Strike. When you attack a creature and hit it with a weapon, you can deal an extra 2d6 Psychic damage. You can use this benefit only once per turn, you can use it a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.",
    from: "Ranger — Gloom Stalker 3" }),
  "assassinate": Object.freeze({ feature: "Assassinate", activity: "Damage", when: "firstRound", requires: "sneak", type: "weapon", weapon: true,
    rule: "If your Sneak Attack hits any target during that round, the target takes extra damage of the weapon’s type equal to your Rogue level.",
    from: "Rogue — Assassin 3 (Surprising Strikes)" }),
  "dreadful-strikes": Object.freeze({ feature: "Dreadful Strikes", activity: "Damage", when: "oncePerTurn", weapon: true,
    rule: "When you hit a creature with a weapon, you can deal an extra 1d4 Psychic damage to the target, which can take this extra damage only once per turn. The extra damage increases to 1d6 when you reach Ranger level 11.",
    from: "Ranger — Fey Wanderer 3" }),
  "blessed-strikes-divine-strike": Object.freeze({ feature: "Blessed Strikes: Divine Strike", activity: "Divine Strike", when: "oncePerTurn", weapon: true,
    caveat: "the type is the activity's first — ask for the other by hand",
    rule: "Once on each of your turns when you hit a creature with an attack roll using a weapon, you can cause the target to take an extra 1d8 Necrotic or Radiant damage (your choice).",
    from: "Cleric 7" }),
  "elemental-fury-primal-strike": Object.freeze({ feature: "Elemental Fury: Primal Strike", activity: "Primal Strike", when: "oncePerTurn", weapon: true,
    caveat: "the type is the activity's first — ask for another by hand",
    rule: "Once on each of your turns when you hit a creature with an attack roll using a weapon or a Beast form's attack in Wild Shape, you can cause the target to take an extra 1d8 Cold, Fire, Lightning, or Thunder damage (choose when you hit).",
    from: "Druid 7" }),
  "divine-fury": Object.freeze({ feature: "Divine Fury", activity: "Divine Fury", when: "oncePerTurn", judge: "raging", weapon: true,
    caveat: "the type is the activity's first — ask for the other by hand",
    rule: "On each of your turns while your Rage is active, the first creature you hit with a weapon or an Unarmed Strike takes extra damage equal to 1d6 plus half your Barbarian level (round down). The extra damage is Necrotic or Radiant; you choose the type each time you deal the damage.",
    from: "Barbarian — Zealot 3" }),
  // The Goliath's on-hit boons (Slice A, 2026-09-24; moved off the hit menu the same day, user:
  // "yes you should switch"). Any attack roll — weapon, unarmed or spell — so no `weapon`; the
  // type is the part's own (fire, cold); the uses the item's (`@prof` per Long Rest).
  "fires-burn": Object.freeze({ feature: "Fire's Burn", activity: "Burn", label: "Fire's Burn", when: "any", uses: true,
    rule: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target.",
    from: "Goliath — Giant Ancestry (Fire)" }),
  "frosts-chill": Object.freeze({ feature: "Frost's Chill", activity: "Chill", label: "Frost's Chill", when: "any", uses: true, effects: true, clock: "slow",
    rule: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn.",
    from: "Goliath — Giant Ancestry (Frost)" }),
  // The Aasimar's transformation (the walk, 2026-09-25; user: "you need to add this in and not
  // skip it"). No activity carries the extra damage, so the row names its `amount` — the text's
  // own token, resolved on the bearer — and its type comes from the FORM that stands (`forms`):
  // an effect the form lands on the bearer (Heavenly Wings, Searing Radiance), or, for the form
  // that lands nothing on its bearer (Necrotic Shroud's effect is the targets' Frightened), the
  // module's own form chip written at the use (`chip`). `spells`: a spell's damage too — an
  // attack spell rides the roll like a weapon; a spell that deals damage with no attack roll is
  // offered on its card as a pick of the ONE target (clock-riders.js).
  "celestial-revelation": Object.freeze({ feature: "Celestial Revelation", activity: null, amount: "@prof", label: "Celestial Revelation",
    when: "oncePerTurn", judge: "transformed", spells: true,
    forms: Object.freeze([
      Object.freeze({ form: "Heavenly Wings", effect: "Heavenly Wings", type: "radiant" }),
      Object.freeze({ form: "Inner Radiance", effect: "Searing Radiance", type: "radiant" }),
      Object.freeze({ form: "Necrotic Shroud", chip: "Necrotic Shroud", type: "necrotic" })
    ]),
    rule: "Once on each of your turns before the transformation ends, you can deal extra damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your Proficiency Bonus, and the extra damage’s type is either Necrotic for Necrotic Shroud or Radiant for Heavenly Wings and Inner Radiance.",
    from: "Aasimar — Celestial Revelation (character level 3)" })
});

/**
 * USE CHIPS (user report 2026-09-02): features the 2024 pack ships as TEXT ONLY — a utility
 * activity, instantaneous, self, no effect — whose whole consequence is a bend on the actor's
 * next roll. use-chips.js writes a chip named as the feature is when it is used; the effect
 * table above carries the row that reads it (same name), and the roll spends it. `window` is a
 * CHIP_WINDOWS key (the rules' own duration); `changes` what the text changes on the sheet.
 * Membership is the Effect Sources list (the row's name).
 */
export const USE_CHIPS = Object.freeze({
  "Steady Aim": Object.freeze({ key: "steadyAim", bend: "advantage", window: "steadyAim",
    rule: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    note: "Speed 0 until the end of the turn; the next attack roll spends it",
    changes: Object.freeze([Object.freeze({ key: "system.attributes.movement.walk", mode: 5, value: "0" })]) })
});

/**
 * CARD CHIPS (user, 2026-09-25, the Gnome walk: "for gnome tinker, just make it a buff on the char
 * that lasts for the duration, use like a chit that is the same as the icon"; ruled: a button on
 * the Prestidigitation card; "yea just give a buff called tiny clockwork device ... the rest is
 * played at table"). A feature the pack ships as TEXT with NO activity of its own, whose use is
 * another item's cast: the card of that cast (`on`) OFFERS the chip when its caster owns the
 * feature (`feature`); a click writes a chip named `chip`, wearing the feature's own icon, for
 * `seconds` of world time, one chip per device, at most `max` standing (at the max the popup says
 * to remove one first). The chip bends nothing: it is the table's reminder that the thing exists
 * and when it lapses. The cast ASKS (a popup, with what is left); the card recalls it.
 * Membership is the Card Chips list (the row names).
 */
export const CARD_CHIPS = Object.freeze({
  "Tinker": Object.freeze({ feature: "Gnomish Lineage, Rock", on: "Prestidigitation", chip: "Tiny Clockwork Device", seconds: 28800, max: 3,
    ask: "Tinker — build a Tiny Clockwork Device (10 minutes)",
    rule: "You can spend 10 minutes casting Prestidigitation to create a Tiny clockwork device (AC 5, 1 HP), such as a toy, fire starter, or music box. When you create the device, you determine its function by choosing one effect from Prestidigitation; the device produces that effect whenever you or another creature takes a Bonus Action to activate it with a touch. If the chosen effect has options within it, you choose one of those options for the device when you create it. You can have three such devices in existence at a time, and each falls apart 8 hours after its creation or when you dismantle it with a touch as a Utilize action.",
    from: "Gnome — Gnomish Lineage (Rock)" })
});

/** The card chips' row names, lower-cased — the closed set the Card Chips list is validated against. */
export const CARD_CHIP_NAMES = tableIndex(CARD_CHIPS).names;

/**
 * SAVE PRESSES (user report 2026-09-02: "web never applied the restrained"): a save activity
 * whose FAILURE lands a condition the pack does not carry as an effect — the 2024 PHB's Web
 * ships with no effect at all (measured, tools/probe-web.mjs), so the saves machine had nothing
 * to apply and applied nothing. A row here names the ITEM and the standard status its text
 * presses on a failed save, through `forceStatus` — the canonical condition, the caster as its
 * origin, receipted on the demand card with a revert — the way Topple presses Prone. Data, not a
 * graft on the content (the house rule on premium packs); the saves machine reads it only when
 * the activity itself brought no effect to apply.
 *
 * ⚠ THE TABLE IS THE AUDIT'S OUTPUT (2026-09-03, tools/audit-presses.mjs over the corpus scan):
 * every 2024 save activity whose text presses a condition, against the statuses its effects
 * carry. Forty-three press one; thirty-five carry it (Hold Person, Entangle, Fear…) and need no
 * row; eight are bare and THREE are this shape — one save, one status, on the failure. The other
 * five are deliberately absent: Command presses Prone only on the word Grovel (a choice), Sleep's
 * Unconscious is a SECOND save a turn later (its first-save Incapacitated IS carried), Flesh to
 * Stone's Petrified takes three failures (its Restrained is carried), and Elemental Attunement
 * and Mind Spike only mention a condition in passing. Re-run the audit after a content update.
 */
export const SAVE_PRESSES = Object.freeze({
  "Web": Object.freeze({ status: "restrained", onFail: true,
    rule: "Each creature that starts its turn in the webs or that enters them during its turn must succeed on a Dexterity saving throw or have the Restrained condition while in the webs or until it breaks free." }),
  "Grease": Object.freeze({ status: "prone", onFail: true,
    rule: "When the grease appears, each creature standing in its area must succeed on a Dexterity saving throw or have the Prone condition. A creature that enters the area or ends its turn there must also succeed on that save or fall Prone." }),
  "Sleet Storm": Object.freeze({ status: "prone", onFail: true,
    rule: "When a creature enters the Cylinder for the first time on a turn or starts its turn there, it must succeed on a Dexterity saving throw or have the Prone condition and lose Concentration." })
});

/**
 * EVASION (user, 2026-09-02 — "ah evasion yes"): the Rogue's (and Monk's) save-side feature, an
 * OUTCOME with no choice in it (R1): a Dexterity save against an effect that deals half on a
 * success takes NONE on a success and HALF on a failure. Not while Incapacitated. Read off the
 * sheet by the feature's name at the fold; the verdict's multiplier does the rest, and the
 * receipt says why. The 2024 PHB text, verbatim.
 */
export const EVASION = Object.freeze({
  feature: "Evasion", ability: "dex",
  rule: "When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the save and only half damage if you fail. You can’t use this feature if you have the Incapacitated condition."
});

/**
 * THE ONE TABLE INDEX (Stage 1 of the machine-tier pass, 2026-09-05). A name-keyed table's
 * closed name set and its row-by-name lookup, both case-insensitive, both derived from the
 * table itself — where four machines each carried a `rowNamed` and six `*_NAMES` sets were
 * derived by hand. `keyOf` names the column the list validates against when it is not the key
 * (the clock riders and the hit options list their `feature`).
 *
 * ⚠ THE TABLES KEEP THEIR KEYS. A list setting's default derives from these names, so renaming a
 * key changes what a world's saved setting validates against. Only the ACCESS is one body.
 *
 * @template T
 * @param {Record<string, T>} table
 * @param {((row: T, key: string) => string) | null} [keyOf] the name a row is listed by; the key by default
 * ⚠ `rowNamed` spreads the ROW over `{ key }`, exactly as the four copies did — so a row that
 * carries its own `key` field (USE_CHIPS: `key: "steadyAim"`) wins, and the TABLE key is not
 * on the result. `keyNamed` is the table key, for the callers that index the table by it (the
 * Steady Aim chip went missing on the first battery of Stage 1 for want of this line).
 *
 * @returns {{ names: Set<string>, keyNamed: (name: unknown) => string | null, rowNamed: (name: unknown) => (T & { key: string }) | null }}
 */
export function tableIndex(table, keyOf = null) {
  const keys = Object.keys(table);
  const nameOf = k => String(keyOf ? keyOf(/** @type {T} */ (table[k]), k) : k).toLowerCase();
  const names = new Set(keys.map(nameOf));
  const keyNamed = name => {
    const wanted = String(name ?? "").toLowerCase();
    return keys.find(x => nameOf(x) === wanted) ?? null;
  };
  const rowNamed = name => {
    const k = keyNamed(name);
    return k ? { key: k, .../** @type {T} */ (table[k]) } : null;
  };
  return { names, keyNamed, rowNamed };
}

/** The clock riders' feature names, lower-cased — the closed set the Clock Riders list is validated against. */
export const CLOCK_RIDER_NAMES = tableIndex(CLOCK_RIDERS, r => r.feature).names;

/**
 * THE HIT MENU (user, 2026-09-04 — "the actor should be given a choice if they have maneuvers, to
 * pick when they hit"; the prototype *Battle Flow Hit Menu*, built as drawn; the sweep's ruling of
 * 2026-09-03: ONE popup per hit, the rows grouped by the feature that grants them, smites out).
 * Cunning Strike was the first instance of "on a hit, pick what rides before the dice"; this is
 * the general table. A GROUP is the feature that pays (Combat Superiority — its pool, its die,
 * its pick limit, its DC rule); an OPTION is a feature on the sheet that spends from it.
 *
 * What is read off the content, never typed (N1): the die (`@scale.battle-master.superiority.die`
 * on the option's own damage activity, resolved on the sheet — d8, d10 at 10th, d12 at 18th), the
 * pool (the activity's consumption target — the Combat Superiority item, by id, identifier or
 * compendium source, the three shapes the 2024 pack ships), the save (the option's save activity,
 * DC and all), the condition (the effect the save activity carries).
 *
 * The 2024 PHB pack as measured 2026-09-04 (the compendium, item by item):
 *   Trip Attack        Superiority Die + Strength Save; the Prone effect sits on the ITEM, unlinked
 *                      to the activity — `onFail: "prone"` presses it (the Envenom shape)
 *   Goading Attack     Superiority Die + Wisdom Save carrying "Goaded" (1 round)
 *   Menacing Attack    Superiority Die + Wisdom Save carrying Frightened (1 round)
 *   Pushing Attack     Superiority Die + Strength Save, no effect — the push is the table's
 *   Disarming Attack   Superiority Die + Strength Save, no effect — the drop is the table's
 *   Distracting Strike ONE damage activity carrying "Distracted" (1 round) — applied on the hit,
 *                      no save; the gate already reads it (EFFECT_BENDS "Distracted", from the scan)
 *   Maneuvering Attack Superiority Die only — the ally's move is a LINE on the card
 *   Sweeping Attack    ONE damage activity, `mode: "sweep"` — the die does NOT ride: it is rolled at
 *                      a SECOND creature within 5 feet of the target, if the attack roll would hit it
 *
 *   mode      "ride" (default) — the die joins the damage roll, crit-doubled by the same stamp ·
 *             "sweep" — the die is rolled apart, at a second creature the card asks for
 *   save      true — the option's save activity is used at the hit target after the damage
 *   onFail    a status the item's own (unlinked) effect presses on a failed save
 *   effects   true — the damage activity's own effects land on the hit target (no save)
 *   line      what the card says beyond the rule, for a consequence the table plays — uniform
 *             "Played at the table: …" (user, 2026-09-04)
 *   melee     true — a melee attack only
 *   clock     a CHIP_WINDOWS key (decide/chips.js) the `effects` land with, pinned to the
 *             ATTACKER's place — for a pack effect that ships no duration, or the wrong one (the
 *             shared path, effect-riders.js `applyActivityEffectsOnHit`; no option uses it today —
 *             Frost's Chill, its first customer, moved to CLOCK_RIDERS the same day)
 *   press     a status the hit presses with NO save (Hill's Tumble's Prone) — receipted, never
 *             pressed over a status the target already has; the option's activity may then be a
 *             utility one (no die; the row shows the uses left, "2 of 3 uses left")
 *   maxSize   the largest size the option reaches ("lg" — "a Large or smaller creature"): read off
 *             the hit target's sheet; a larger target greys the row, an unreadable size does not
 *             (the gate never guesses)
 *   (no caveat lines — user, 2026-09-04: "just the rule tick is needed"; what the rules leave to the player is in the rule)
 *
 * A GROUP's fields: `feature` the paying feature the sheet must carry (null — nothing to carry:
 * the Goliath's Giant Ancestry is a text-only parent the sheet may not hold), `pool` "feature"
 * (default — ONE pool for the group, the options' shared consumption target: Combat Superiority)
 * or "option" (every option pays from its OWN uses — the boon's item, `@prof` per Long Rest),
 * `label`, `max` picks, `dieLabel` what one spend is called, `eyebrow` the card's family word,
 * `heading` and `per` the offer line's voice ("Maneuvers — … one maneuver per attack"), `from`,
 * `rule`, `dc`.
 *
 * ⚠ ONE PICK PER HIT, across groups (Slice A, decided 2026-09-24): the pick is recorded as ONE
 * record (`hitPick` → `hitManeuver`), so the offer's wire keeps one tick on the whole menu — a
 * tick in Giant Ancestry unticks Combat Superiority's. The array shape a Goliath Battle Master
 * would want is BACKLOG's (it binds a Goliath Battle Master's Hill's Tumble; Fire's Burn and
 * Frost's Chill ride as clock riders beside any pick).
 *
 * Membership is the Hit Menu list (the option names). Precision Attack and Riposte are FOLDS
 * (maneuvers.js) and the nine remaining maneuvers are other moments (BACKLOG).
 */
export const HIT_GROUPS = Object.freeze({
  "combat-superiority": Object.freeze({ feature: "Combat Superiority", pool: "feature", label: "Combat Superiority", max: 1,
    dieLabel: "Superiority Die", eyebrow: "Maneuver", heading: "Maneuvers", per: "one maneuver per attack", from: "Fighter — Battle Master 3",
    rule: "Many maneuvers enhance an attack in some way. You can use only one maneuver per attack.",
    dc: "If a maneuver requires a saving throw, the DC equals 8 plus your Strength or Dexterity modifier (your choice) and Proficiency Bonus." }),
  // The Goliath's on-hit PRESS (Slice A, 2026-09-24): Hill's Tumble alone — Fire's Burn and
  // Frost's Chill are CLOCK_RIDERS (user, 2026-09-24: "yes you should switch" — a Goliath owns one
  // boon, so the hit never asks WHICH, only whether). The parent is text only and the boon is a
  // separate item granted by an advancement the sheet may not keep, so the group has no feature
  // to require; the boon pays from its own uses. The rule is the parent's opening, verbatim.
  "giant-ancestry": Object.freeze({ feature: null, pool: "option", label: "Giant Ancestry", max: 1,
    dieLabel: "use", eyebrow: "Giant Ancestry", heading: "Giant Ancestry", per: "one boon per hit", from: "Goliath",
    rule: "You are descended from Giants. Choose one of the following benefits—a supernatural boon from your ancestry; you can use the chosen benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest" })
});

export const HIT_OPTIONS = Object.freeze({
  "trip-attack": Object.freeze({ feature: "Trip Attack", group: "combat-superiority", save: true, onFail: "prone",
    rule: "When you hit a creature with an attack roll using a weapon or an Unarmed Strike, you can expend one Superiority Die and add the die to the attack's damage roll. If the target is Large or smaller, it must succeed on a Strength saving throw or have the Prone condition." }),
  "goading-attack": Object.freeze({ feature: "Goading Attack", group: "combat-superiority", save: true,
    rule: "When you hit a creature with an attack roll, you can expend one Superiority Die to attempt to goad the target into attacking you. Add the Superiority Die to the attack's damage roll. The target must succeed on a Wisdom saving throw or have Disadvantage on attack rolls against targets other than you until the end of your next turn." }),
  "menacing-attack": Object.freeze({ feature: "Menacing Attack", group: "combat-superiority", save: true,
    rule: "When you hit a creature with an attack roll, you can expend one Superiority Die to attempt to frighten the target. Add the Superiority Die to the attack's damage roll. The target must succeed on a Wisdom saving throw or have the Frightened condition until the end of your next turn." }),
  "pushing-attack": Object.freeze({ feature: "Pushing Attack", group: "combat-superiority", save: true,
    line: "Played at the table: on a failed save, the target is pushed up to 15 feet directly away from you.",
    rule: "When you hit a creature with an attack roll using a weapon or an Unarmed Strike, you can expend one Superiority Die to attempt to drive the target back. Add the Superiority Die to the attack's damage roll. If the target is Large or smaller, it must succeed on a Strength saving throw or be pushed up to 15 feet directly away from you." }),
  "disarming-attack": Object.freeze({ feature: "Disarming Attack", group: "combat-superiority", save: true,
    line: "Played at the table: on a failed save, the target drops one object of your choice, which lands in its space.",
    rule: "When you hit a creature with an attack roll, you can expend one Superiority Die to attempt to disarm the target. Add the Superiority Die roll to the attack's damage roll. The target must succeed on a Strength saving throw or drop one object of your choice that it's holding, with the object landing in its space." }),
  "distracting-strike": Object.freeze({ feature: "Distracting Strike", group: "combat-superiority", effects: true,
    rule: "When you hit a creature with an attack roll, you can expend one Superiority Die to distract the target. Add the Superiority Die roll to the attack's damage roll. The next attack roll against the target by an attacker other than you has Advantage if the attack is made before the start of your next turn." }),
  "maneuvering-attack": Object.freeze({ feature: "Maneuvering Attack", group: "combat-superiority",
    line: "Played at the table: choose a willing creature who can see or hear you; it can use its Reaction to move up to half its Speed without provoking an Opportunity Attack from the target.",
    rule: "When you hit a creature with an attack roll, you can expend one Superiority Die to maneuver one of your comrades into another position. Add the Superiority Die roll to the attack's damage roll, and choose a willing creature who can see or hear you. That creature can use its Reaction to move up to half its Speed without provoking an Opportunity Attack from the target of your attack." }),
  "sweeping-attack": Object.freeze({ feature: "Sweeping Attack", group: "combat-superiority", mode: "sweep", melee: true,
    rule: "When you hit a creature with a melee attack roll using a weapon or an Unarmed Strike, you can expend one Superiority Die to attempt to damage another creature. Choose another creature within 5 feet of the original target and within your reach. If the original attack roll would hit the second creature, it takes damage equal to the number you roll on your Superiority Die. The damage is of the same type dealt by the original attack." }),
  // Giant Ancestry (Slice A, 2026-09-24): any attack roll that hits and deals damage — weapon,
  // unarmed or spell. No die: the press is the whole boon.
  "hills-tumble": Object.freeze({ feature: "Hill's Tumble", group: "giant-ancestry", press: "prone", maxSize: "lg",
    rule: "When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition." })
});

/** The hit options' feature names, lower-cased — the closed set the Hit Menu list is validated against. */
export const HIT_OPTION_NAMES = tableIndex(HIT_OPTIONS, r => r.feature).names;

/**
 * SUPERIORITY USES (2026-09-05, "the rest of maneuvers"): the Battle Master's BONUS ACTION
 * maneuvers — a use whose consequence lands on a sheet, and for two of them a die that rides the
 * hit after. Measured on the 2024 PHB pack 2026-09-04 (tools/probe-pack-shapes.mjs):
 *
 *   Evasive Footwork   "Evade" rolls the die ("AC Bonus"); the pack's "Evasive AC" effect carries
 *                      NO change — `bonus`: the module writes a chip with the number rolled on the
 *                      AC until the start of the next turn (Sap's window)
 *   Bait and Switch    "Switch Places" rolls the die ("Armor Class Bonus") and ships TWELVE effects
 *                      "Baited AC +1" … "+12" — `choice`: the matching pack effect goes on whoever
 *                      the fighter picks, a popup with the hold family's clock, the fighter by default
 *   Lunging Attack     "Damage" (no target): Dash, and the die on the next melee hit this turn if the
 *                      fighter moved 5 feet in a straight line — `chip` until the end of the turn,
 *                      `rider` as a TICKED checkbox on the offer (the player's fact)
 *   Feinting Attack    "Damage" at one creature and the pack's "Feinting Attack" effect ("for
 *                      tracking the target") — `marker`: on the target with the fighter as source;
 *                      the effect table's row reads it as Advantage for the fighter alone (`only:
 *                      "source"`), the next attack roll spends it, and the die rides the hit
 *
 *   use       the activity the fighter presses, by name (the pool is the system's — `use()` consumes)
 *   bonus     { key, window, what } — a rolled number written as a change on the fighter's own chip
 *   choice    { effectPrefix, what } — the pack's "+N" effect, applied to the fighter's pick
 *   chip      { window } — a chip on the fighter; `rider` says the die rides the next hit
 *   marker    { effect } — the pack's effect on the TARGET, the fighter as its source
 *   rider     { melee?, caveat? } — the die rides the hit's damage roll (crit-doubled by the stamp)
 *
 * The die is READ off the sheet (the activity's roll formula or damage part, resolved). Membership
 * is the Superiority Uses list. Rally needs no row: its temp HP are a heal activity the cast slice
 * already lands. Precision Attack and Riposte are folds; the on-hit eight are the hit menu;
 * Commander's Strike is a fold kind (`command`); Ambush and Tactical Assessment are d20 folds
 * (SUPERIORITY_FOLDS); Parry is an interrupt (INTERRUPT_REDUCTIONS).
 */
export const SUPERIORITY_USES = Object.freeze({
  "Evasive Footwork": Object.freeze({ use: "Evade", bonus: Object.freeze({ key: "system.attributes.ac.bonus", window: "sap", what: "AC" }),
    rule: "As a Bonus Action, you can expend one Superiority Die and take the Disengage action. You also roll the die and add the number rolled to your AC until the start of your next turn.",
    from: "Fighter — Battle Master" }),
  "Bait and Switch": Object.freeze({ use: "Switch Places", choice: Object.freeze({ effectPrefix: "Baited AC +", what: "AC" }),
    rule: "When you're within 5 feet of a creature on your turn, you can expend one Superiority Die and switch places with that creature, provided you spend at least 5 feet of movement and the creature is willing and doesn't have the Incapacitated condition. This movement doesn't provoke Opportunity Attacks. Roll the Superiority Die. Until the start of your next turn, you or the other creature (your choice) gains a bonus to AC equal to the number rolled.",
    from: "Fighter — Battle Master" }),
  "Lunging Attack": Object.freeze({ use: "Damage", chip: Object.freeze({ window: "steadyAim" }), rider: Object.freeze({ melee: true, caveat: "if you moved at least 5 feet in a straight line just before the hit" }),
    rule: "As a Bonus Action, you can expend one Superiority Die and take the Dash action. If you move at least 5 feet in a straight line immediately before hitting with a melee attack as part of the Attack action on this turn, you can add the Superiority Die to the attack's damage roll.",
    from: "Fighter — Battle Master" }),
  "Feinting Attack": Object.freeze({ use: "Damage", marker: Object.freeze({ effect: "Feinting Attack" }), rider: Object.freeze({}),
    rule: "As a Bonus Action, you can expend one Superiority Die to feint, choosing one creature within 5 feet of yourself as your target. You have Advantage on your next attack roll against that target this turn. If that attack hits, add the Superiority Die to the attack's damage roll.",
    from: "Fighter — Battle Master" })
});

/** The superiority uses' feature names, lower-cased — the closed set the Superiority Uses list is validated against. */
export const SUPERIORITY_USE_NAMES = tableIndex(SUPERIORITY_USES).names;

/**
 * SUPERIORITY FOLDS (2026-09-05): the Battle Master's maneuvers that ADD THE DIE TO A D20 TEST —
 * Ambush (a Dexterity (Stealth) check, or an Initiative roll) and Tactical Assessment (an
 * Intelligence (History or Investigation) check, or a Wisdom (Insight) check). Each is the d20
 * folds' `tactical` SPEND — a utility activity used, its roll formula the die — with a SCOPE the
 * feature's own text gives: which skills, and whether Initiative. Listed in the D20 Folds list as
 * `Ambush:tactical` / `Tactical Assessment:tactical`; the scope here is what tells them from
 * Tactical Mind (any check, a refund). No refund: the die is spent either way it lands.
 */
export const SUPERIORITY_FOLDS = Object.freeze({
  "Ambush": Object.freeze({ skills: Object.freeze(["ste"]), initiative: true,
    rule: "When you make a Dexterity (Stealth) check or an Initiative roll, you can expend one Superiority Die and add the die to the roll, unless you have the Incapacitated condition." }),
  "Tactical Assessment": Object.freeze({ skills: Object.freeze(["his", "inv", "ins"]), initiative: false,
    rule: "When you make an Intelligence (History or Investigation) check or a Wisdom (Insight) check, you can expend one Superiority Die and add that die to the ability check." })
});

/**
 * Every Battle Master maneuver by name (lower-cased) — the features whose damage activities are
 * the DIE and never a spell's damage: damage-casts.js leaves them alone.
 */
export const MANEUVER_FEATURE_NAMES = new Set([
  ...Object.values(HIT_OPTIONS).map(r => r.feature), ...Object.keys(SUPERIORITY_USES), ...Object.keys(SUPERIORITY_FOLDS),
  "Commander's Strike", "Precision Attack", "Riposte", "Parry", "Rally"
].map(n => n.toLowerCase()));

/**
 * EMANATIONS (user ruling 2026-09-03 — DESIGN §4 amended: "emanations are a core part of combat …
 * no different than auto-applying Slow with mastery"). A persistent area attached to a token whose
 * effect applies to the creatures inside it. THE PLATFORM MODELS IT (measured, tools/probe-
 * emanations.mjs, Foundry 14.365): a Region attached to the token moves with it, tracks the tokens
 * inside, and raises enter / exit / turn-end events; `RegionDocument.createTokenEmanation` builds
 * the rules-correct shape (the token's base plus the radius). The 2024 pack ships every aura's
 * EFFECT and says in its own text that who-is-inside is not automated. A row here names the item,
 * the effect the pack ships for it, who it reaches, how far, and what triggers inside it.
 *
 *   kind       "feature" — always on: stands whenever the source's token is on the scene and the
 *              range resolves (a Paladin below 6th has no aura, and the scale value says so).
 *              "spell" — cast: the emanation template the system places is adopted, attached to
 *              the caster, and ends with the template (concentration).
 *   reach      "helpful" reaches allies and neutrals; "harmful" reaches enemies (user defaults,
 *              2026-09-03; the caster's "designate creatures to be unaffected" is the default).
 *   range      null: the activity's own size. A formula: the content's own token — the Paladin's
 *              aura activities carry `@scale.paladin.aura` (10 at 6th, 30 at 18th — Aura Expansion
 *              is a scale step, not a feature to look for), read off the SOURCE's roll data.
 *              ⚠ Never a number here for a feature the class scales; the row says where the
 *              number lives, not what it is (N1).
 *   effect     the pack's effect by name; its changes are RESOLVED against the source before the
 *              platform hands them out (the pack's own Aura of Protection note: "it will add their
 *              Charisma modifier and not the Paladin's").
 *   incapacitated  the aura is inactive while the source is Incapacitated (Protection's text; Courage
 *              and Warding are "while in your Aura of Protection").
 *   trigger    a save demanded of a creature — `on`: "enter" (it enters, or the area enters its
 *              space) and/or "turnEnd" (it ends its turn inside); `oncePerTurn` as the text says.
 *              The save, DC, damage and scaling are the activity's own; the saves machine judges.
 *
 *   heal       (the second slice, 2026-09-05) a heal the area pays a member at a moment — `on`:
 *              "turnStart", `when`: "zeroHP" (Aura of Life's ally at 0 HP regains the activity's
 *              own healing), `activity` the heal activity whose part is read
 *   remind     (the second slice) a NOTICE at the SOURCE's turn start naming the activity the
 *              caster may use — Aura of Vitality's heal is AIMED, a choice, so it is offered and
 *              never played (R1); `activity` names the heal to use from the card
 *   effect null   a ring and a card and nothing applied — a barrier (Antilife Shell), a notice
 *
 * ⚠ Aura of Courage's pack effect ("Courageous") carries NO change — the Frightened immunity is a
 * CONTENT fix at the world (user, 2026-09-03: "agree"), and the module applies what the pack ships.
 * Membership is the Emanations list.
 *
 * THE SECOND SLICE (2026-09-05, the corpus scan the first slice left): every 2024 PHB spell whose
 * activity is a `radius` template from the caster with a standing effect the pack ships — Aura of
 * Life, Aura of Purity, Circle of Power, Crusader's Mantle, Holy Aura — plus the two the backlog
 * named, Aura of Vitality (a notice) and Antilife Shell (a ring). Each applies exactly what the
 * pack's effect carries and says on its card what the pack leaves to the table (`caveat`).
 * Measured on the packs 2026-09-04 (tools/probe-pack-shapes.mjs). Left out on purpose: Antimagic
 * Field, Globe of Invulnerability, Darkness, Daylight (no effect — a ring alone would be a guess
 * about what the table wants drawn); Intimidating Presence, Wrath of the Sea, Oceanic Gift (an
 * emanation SAVE at a Bonus Action — the cast's own demand handles the moment, the area needs no
 * standing); Holy Aura's Fiend/Undead save on a melee hit (the damage shields' shape with a save
 * in place of dice — a row for that family when a table asks).
 */
export const EMANATIONS = Object.freeze({
  "Aura of Protection": Object.freeze({ kind: "feature", reach: "helpful", range: "@scale.paladin.aura", effect: "Protected", incapacitated: true,
    rule: "You radiate a protective, unseeable aura in a 10-foot Emanation that originates from you. The aura is inactive while you have the Incapacitated condition. You and your allies in the aura gain a bonus to saving throws equal to your Charisma modifier (minimum bonus of +1). If another Paladin is present, a creature can benefit from only one Aura of Protection at a time; the creature chooses which aura while in them.",
    from: "Paladin 6" }),
  "Aura of Courage": Object.freeze({ kind: "feature", reach: "helpful", range: "@scale.paladin.aura", effect: "Courageous", incapacitated: true,
    caveat: "the pack's effect carries no change — add Immunity to Frightened to it at the world",
    rule: "You and your allies have Immunity to the Frightened condition while in your Aura of Protection. If a Frightened ally enters the aura, that condition has no effect on that ally while there.",
    from: "Paladin 10" }),
  "Aura of Warding": Object.freeze({ kind: "feature", reach: "helpful", range: "@scale.paladin.aura", effect: "Aura of Warding", incapacitated: true,
    rule: "Ancient magic lies so heavily upon you that it forms an eldritch ward, blunting energy from beyond the Material Plane; you and your allies have Resistance to Necrotic, Psychic, and Radiant damage while in your Aura of Protection.",
    from: "Paladin — Oath of the Ancients 7" }),
  "Spirit Guardians": Object.freeze({ kind: "spell", reach: "harmful", range: null, effect: "Half Speed", incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    rule: "Protective spirits flit around you in a 15-foot Emanation for the duration. When you cast this spell, you can designate creatures to be unaffected by it. Any other creature’s Speed is halved in the Emanation, and whenever the Emanation enters a creature’s space and whenever a creature enters the Emanation or ends its turn there, the creature must make a Wisdom saving throw. On a failed save, the creature takes 3d8 Radiant damage (if you are good or neutral) or 3d8 Necrotic damage (if you are evil). On a successful save, the creature takes half as much damage. A creature makes this save only once per turn.",
    from: "Cleric spell, level 3 (Concentration, 10 minutes)" }),
  // --- the second slice (2026-09-05) -----------------------------------------------------------
  "Aura of Life": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Aura of Life", incapacitated: false,
    heal: Object.freeze({ on: "turnStart", when: "zeroHP", activity: "Create Aura" }),
    caveat: "the pack's effect carries the Necrotic Resistance; \"Hit Point maximums can't be reduced\" is the table's",
    rule: "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have Resistance to Necrotic damage, and your Hit Point maximums can’t be reduced. If an ally with 0 Hit Points starts its turn in the aura, that ally regains 1 Hit Point.",
    from: "Paladin spell, level 4 (Concentration, 10 minutes)" }),
  "Aura of Purity": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Aura of Purity", incapacitated: false,
    caveat: "the pack's effect carries the Poison Resistance; the Advantage on saves against those conditions is the save gate's (Effect Sources — Aura of Purity)",
    rule: "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have Resistance to Poison damage and Advantage on saving throws to avoid or end effects that include the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned condition.",
    from: "Paladin spell, level 4 (Concentration, 10 minutes)" }),
  "Aura of Vitality": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: null, incapacitated: false,
    remind: Object.freeze({ on: "sourceTurnStart", activity: "Start of Turn Heal" }),
    caveat: "the heal is AIMED — a choice: the card at the start of your turn offers it, and never plays it",
    rule: "An aura radiates from you in a 30-foot Emanation for the duration. When you create the aura and at the start of each of your turns while it persists, you can restore 2d6 Hit Points to one creature in it.",
    from: "Cleric / Druid / Paladin spell, level 3 (Concentration, 1 minute)" }),
  "Antilife Shell": Object.freeze({ kind: "spell", reach: "harmful", range: null, effect: null, incapacitated: false,
    caveat: "a barrier, not an effect — the ring is drawn for the table to honour",
    rule: "An aura extends from you in a 10-foot Emanation for the duration. The aura prevents creatures other than Constructs and Undead from passing or reaching through it. An affected creature can cast spells or make attacks with Ranged or Reach weapons through the barrier. If you move so that an affected creature is forced to pass through the barrier, the spell ends.",
    from: "Druid spell, level 5 (Concentration, 1 hour)" }),
  "Circle of Power": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Circle's Power", incapacitated: false,
    caveat: "the pack's effect carries no change — the Advantage on saves against spells is the save gate's, and a success against half-on-save spell damage takes none (Effect Sources — Circle's Power)",
    rule: "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have Advantage on saving throws against spells and other magical effects. When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save.",
    from: "Cleric / Paladin spell, level 5 (Concentration, 10 minutes)" }),
  "Crusader's Mantle": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Crusader’s Mantle", incapacitated: false,
    rule: "You radiate a magical aura in a 30-foot Emanation. While in the aura, you and your allies each deal an extra 1d4 Radiant damage when hitting with a weapon or an Unarmed Strike.",
    from: "Paladin spell, level 3 (Concentration, 1 minute)" }),
  "Holy Aura": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Holy Protection", incapacitated: false,
    caveat: "the pack's effect carries the Advantage on saves (the save gate says so) and the attack gate reads attackers' Disadvantage off it (Effect Sources — Holy Protection); the Fiend/Undead save on a melee hit is the table's",
    rule: "For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving throws, and other creatures have Disadvantage on attack rolls against them. In addition, when a Fiend or an Undead hits an affected creature with a melee attack roll, the attacker must succeed on a Constitution saving throw or have the Blinded condition until the end of its next turn.",
    from: "Cleric spell, level 8 (Concentration, 1 minute)" }),
  // --- the Elf walk (2026-09-25) --------------------------------------------------------------
  // The user: "pass without trace should have an enamation similar to the paladin one, but gratns
  // +10 stealth, should use the saem shape". The pack ships the +10 as "Concealed"; its AREA is
  // missing from the spell (Vendor Fixes VF-003 gives it the rule's 30-foot Emanation).
  "Pass without Trace": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Concealed", incapacitated: false,
    caveat: "the pack's effect carries the +10 to Stealth; \"leave no tracks\" is the table's",
    rule: "You radiate a concealing aura in a 30-foot Emanation for the duration. While in the aura, you and each creature you choose have a +10 bonus to Dexterity (Stealth) checks and leave no tracks.",
    from: "Druid / Ranger spell, level 2 (Concentration, 1 hour); the Wood Elf's lineage at character level 5" }),
  // --- the Aasimar walk (2026-09-25) -----------------------------------------------------------
  // A FEATURE emanation that stands only WHILE a named effect stands on its bearer (`while` —
  // the transformation's own effect, landed at the use by the token-lights machine), found on
  // the item `item` by its activity `activity` (the row's key is the form the table names; the
  // item is the pack's Celestial Revelation), reaching EVERY creature inside (`reach: "all"` —
  // the text's "each creature within 10 feet of you", allies included; user, 2026-09-25: "as
  // written"), and paying out at the END OF THE BEARER'S turn (`pulse`) — the activity's own
  // damage part, rolled once on the bearer and applied to everyone inside. The activity's use is
  // the transform alone: no area placed, no damage rolled (the pack models the pulse as damage
  // on use; user, 2026-09-25: "no damage at transform").
  "Inner Radiance": Object.freeze({ kind: "feature", item: "Celestial Revelation", activity: "Inner Radiance", while: "Searing Radiance",
    reach: "all", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: "Inner Radiance" }),
    rule: "Searing light temporarily radiates from your eyes and mouth. For the duration, you shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes Radiant damage equal to your Proficiency Bonus.",
    from: "Aasimar — Celestial Revelation (character level 3)" })
});

/**
 * DAMAGE SHIELDS (user, 2026-09-04: "death armor needs its damage shield effect automated") — the
 * NINTH shape beside SWEEP §1's eight: the hit rider MIRRORED. A standing effect on the DEFENDER
 * pays out against the ATTACKER when a melee attack roll hits it, with no choice in it (R1). The
 * dice are the pack's own damage activity on the SOURCE's item — found by walking the standing
 * effect's origin (a Death Armor cast on an ally is the caster's spell paying out on the ally's
 * sheet), rolled in the open by the elect and applied through the receipt chokepoint at the
 * attacker. Measured on the packs 2026-09-04 (tools/probe-pack-shapes.mjs):
 *
 *   Death Armor        (Heroes of Faerûn, L2, touch, 1 hour) ships the "Death Armor" effect on the
 *                      WARDED creature and a Retaliate damage activity — 5 ft, "once per turn, when
 *                      hit by a target in range". The once-per-turn is a turn chit on the defender.
 *   Fire Shield        (PHB, L4, self, 10 minutes) ships Warm Shield / Chill Shield on the caster
 *                      and one Flame Eruption activity typed [cold, fire] — the TYPE follows the
 *                      effect that stands (warm burns, chill freezes); every melee hit within 5 ft.
 *   Armor of Agathys   (PHB, L1, self, 1 hour) ships NO effect: the cast is a temp-HP heal and
 *                      Frost Damage is the payout, every melee hit "while you have these Hit
 *                      Points". `mark: true` — the module writes its own chip at the cast (the
 *                      use-chip idiom), carrying the cast's level; the chip goes when the pool is
 *                      gone, and the shield strikes only while the temp HP stand.
 *
 *   effect    the pack's effect by NAME on the defender — one name, or a map of name → damage type
 *             where the standing effect decides the type
 *   activity  the pack's damage activity on the source's item, by name — its dice, its reach
 *   melee     a melee attack roll only (every 2024 row says "melee attack roll")
 *   when      "oncePerTurn" — the defender's turn chit; out of combat every hit (the settled rule)
 *   while     "tempHP" — strikes only while the defender has Temporary Hit Points
 *   mark      true — no pack effect: the module marks the cast; `cast` names the casting activity
 *
 * ⚠ Hellish Rebuke is NOT this family — a Reaction, a human's choice, the hold's business.
 * Membership is the Damage Shields list (the item names). The reach, the dice and the type are
 * read off the content, never typed (N1).
 */
export const DAMAGE_SHIELDS = Object.freeze({
  "Death Armor": Object.freeze({ effect: "Death Armor", activity: "Retaliate", melee: true, when: "oncePerTurn",
    rule: "For the duration, an inky aura surrounds one creature you touch. The target has Advantage on Death Saving Throws, and once per turn, when a creature within 5 feet of the target hits it with a melee attack roll, the attacker takes 2d4 Necrotic damage.",
    from: "Heroes of Faerûn — Character Options, level 2 (1 hour)" }),
  "Fire Shield": Object.freeze({ effect: Object.freeze({ "Warm Shield": "fire", "Chill Shield": "cold" }), activity: "Flame Eruption", melee: true,
    rule: "Wispy flames wreathe your body for the duration, shedding Bright Light in a 10-foot radius and Dim Light for an additional 10 feet. The flames provide you with a warm shield or a chill shield, as you choose. The warm shield grants you Resistance to Cold damage, and the chill shield grants you Resistance to Fire damage. In addition, whenever a creature within 5 feet of you hits you with a melee attack roll, the shield erupts with flame. The attacker takes 2d8 Fire damage from a warm shield or 2d8 Cold damage from a chill shield.",
    from: "PHB, level 4 (10 minutes)" }),
  "Armor of Agathys": Object.freeze({ mark: true, cast: "Cast", activity: "Frost Damage", melee: true, while: "tempHP",
    rule: "Protective magical frost surrounds you. You gain 5 Temporary Hit Points. If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage. The spell ends early if you have no Temporary Hit Points. Using a Higher-Level Spell Slot. The Temporary Hit Points and the Cold damage both increase by 5 for each spell slot level above 1.",
    from: "PHB, level 1 (1 hour)" })
});

/** The shields' item names, lower-cased — the closed set the Damage Shields list is validated against. */
export const DAMAGE_SHIELD_NAMES = tableIndex(DAMAGE_SHIELDS).names;

/**
 * EFFECT CHOICES (user, 2026-09-05: "when i apply warm or chill shield, it applies both … this
 * should also be a popup asking the player which shield to apply"). A cast whose activity ships
 * SEVERAL effects that the text makes alternatives — "as you choose" — and marks nothing to say
 * so: the cast slice, reading "a utility with effects", landed every one. The choice is the
 * caster's (R1), asked at the cast the way Spirit Guardians' damage type is asked (the moment
 * spine, a popup on the caster's own card); only the pick lands. Measured on the packs:
 *
 *   Fire Shield        (PHB, L4, self) ships Warm Shield (Resistance to Cold) AND Chill Shield
 *                      (Resistance to Fire) on one utility activity — one stands, the caster's pick.
 *
 *   effects   the pack's effect NAMES that are alternatives, in the order the popup offers them
 *   ask       the popup's question
 *
 * Membership is the Effect Choices list (the item names). A row whose activity carries fewer than
 * two of the names asks nothing (decide/choices.js). The effects themselves are the pack's (N1).
 */
export const EFFECT_CHOICES = Object.freeze({
  "Fire Shield": Object.freeze({ effects: Object.freeze(["Warm Shield", "Chill Shield"]), ask: "A warm shield or a chill shield?",
    rule: "The flames provide you with a warm shield or a chill shield, as you choose. The warm shield grants you Resistance to Cold damage, and the chill shield grants you Resistance to Fire damage.",
    from: "PHB, level 4 (10 minutes)" })
});

/** The choices' item names, lower-cased — the closed set the Effect Choices list is validated against. */
export const EFFECT_CHOICE_NAMES = tableIndex(EFFECT_CHOICES).names;

/**
 * TOKEN LIGHTS (user, 2026-09-25, the Aasimar walk: "inner radiance - add the bright/dim light
 * settings ... edit the Light spell so it adds light emission to a token target as well"). A use
 * whose text says something SHEDS LIGHT, carried as the token's own light on an effect: Foundry 14
 * applies an effect change keyed `token.*` to the bearer's tokens (TokenDocument#applyActiveEffects
 * — `light` is one of its targetable keys, measured on 14.368), so the light comes and goes with
 * the effect, its clock and its removal, and no token document is written. The radii are the
 * rule's own words — Bright Light in a radius, Dim Light "for an additional" distance, and a
 * Foundry light's `dim` is the OUTER radius, so dim = bright + the additional (N1: the packs carry
 * no light at all, so the text is the only source).
 *
 *   on        "self" — the user's own sheet; "targets" — every creature targeted at the use (none
 *             targeted: the pack's own use stands, the Light spell's summoned light)
 *   item      the pack item the row's activity lives on, when the row's key is not the item's name
 *   activity  the activity, by name, whose use lands the light (null: any use of the item)
 *   effect    the pack's own effect on that activity which the light rides — landed on the user
 *             WITH the light (Searing Radiance: the pack ships it on a damage activity, which
 *             nothing lands on its user); null: the module makes the effect, named as the item,
 *             with the item's own duration
 *   recast    "ends" — casting it again ends the caster's earlier light, wherever it stands
 *   bright / dim   the radii in feet, dim the outer
 *
 * Membership is the Token Lights list (the row names).
 */
export const TOKEN_LIGHTS = Object.freeze({
  "Inner Radiance": Object.freeze({ item: "Celestial Revelation", activity: "Inner Radiance", on: "self", effect: "Searing Radiance", bright: 10, dim: 20,
    rule: "Searing light temporarily radiates from your eyes and mouth. For the duration, you shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes Radiant damage equal to your Proficiency Bonus.",
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  "Light": Object.freeze({ activity: null, on: "targets", effect: null, recast: "ends", bright: 20, dim: 40,
    caveat: "on a creature's token (user, 2026-09-25: any targeted token) — the rule's object is the table's to name",
    rule: "You touch one Large or smaller object that isn’t being worn or carried by someone else. Until the spell ends, the object sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. The light can be colored as you like. Covering the object with something opaque blocks the light. The spell ends if you cast it again.",
    from: "PHB cantrip (1 hour)" })
});

/** The token lights' row names, lower-cased — the closed set the Token Lights list is validated against. */
export const TOKEN_LIGHT_NAMES = tableIndex(TOKEN_LIGHTS).names;

/**
 * TOKEN SENSES (user, 2026-09-25, the Dwarf walk: "for stonecunning, we dont have a way to do a
 * check on standing on stone, so just run it always and assume stone. figure out a way to change
 * the vision type to tremor sense for the duration"). TOKEN_LIGHTS' sibling: the same carrier —
 * an effect change keyed `token.*` (TokenDocument#applyActiveEffects; `sight` and
 * `detectionModes` are among its targetable keys, and a `sight.visionMode` override inflates the
 * mode's own defaults — both read from Foundry 14.368's source) — but the effect is the PACK's,
 * landed by whoever lands it (the cast slice's self-aim, a tray click): the changes are added to
 * it as it is created, so the sense comes and goes with the pack's own clock and removal.
 *
 *   effect    the pack effect's name the row answers to (the row key when absent)
 *   vision    the Foundry vision mode the token takes while it stands (CONFIG.Canvas.visionModes)
 *   detect    { mode, range } — a Foundry detection mode enabled at that range (feet)
 *   range     the token's sight range while it stands (feet) — the sense's own reach
 *
 * Membership is the Token Senses list (the row names).
 */
export const TOKEN_SENSES = Object.freeze({
  "Stonecunning": Object.freeze({ effect: "Stonecunning", vision: "tremorsense", range: 60,
    detect: Object.freeze({ mode: "feelTremor", range: 60 }),
    caveat: "always counted as on stone (user, 2026-09-25: no way to read the surface)",
    rule: "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching a stone surface to use this Tremorsense. The stone can be natural or worked.",
    from: "Dwarf" })
});

/** The token senses' row names, lower-cased — the closed set the Token Senses list is validated against. */
export const TOKEN_SENSE_NAMES = tableIndex(TOKEN_SENSES).names;

/**
 * TOKEN SIZES (user, 2026-09-25, the Goliath walk: "large form did not increase token size").
 * TOKEN_SENSES' sibling, the same carrier: `token.*` changes added to the PACK's own effect as it
 * is created on a sheet — `token.width` / `token.height`, which Foundry 14's
 * TokenDocument#applyActiveEffects applies as a document update (its `requiresUpdateKeys`), and
 * `system.traits.size`, so the sheet, the size judge (Hill's Tumble's "Large or smaller") and the
 * system's own size readers see the new size. dnd5e resizes a token only when the SOURCE size
 * changes (its tokenSizeSync), never an effect's, and the packs ship no size change: the PHB's
 * Large Form and Enlarge/Reduce carry none (measured on the sandbox, 2026-09-25). The size lives
 * on the effect: its clock, its removal, the rest that clears it put the token back.
 *
 *   effects  { effectName: { size } | { step } } — the pack effects the row answers to: `size` an
 *            absolute size key (Large Form: "lg"), `step` a number of categories from the
 *            bearer's size at the moment the effect lands (Enlarged +1, Reduced −1), clamped to
 *            the system's own ordering (CONFIG.DND5E.actorSizes)
 *   caveat   what the table judges ("if you're in a big enough space")
 *
 * Membership is the Token Sizes list (the row names).
 */
export const TOKEN_SIZES = Object.freeze({
  "Large Form": Object.freeze({ effects: Object.freeze({ "Large Form": Object.freeze({ size: "lg" }) }),
    caveat: "the space it needs is the table's to judge",
    rule: "Starting at character level 5, you can change your size to Large as a Bonus Action if you’re in a big enough space. This transformation lasts for 10 minutes or until you end it (no action required). For that duration, you have Advantage on Strength checks, and your Speed increases by 10 feet. Once you use this trait, you can’t use it again until you finish a Long Rest.",
    from: "Goliath (character level 5)" }),
  "Enlarge/Reduce": Object.freeze({ effects: Object.freeze({ "Enlarged": Object.freeze({ step: 1 }), "Reduced": Object.freeze({ step: -1 }) }),
    rule: "Enlarge. The target’s size increases by one category—from Medium to Large, for example. … Reduce. The target’s size decreases by one category—from Medium to Small, for example.",
    from: "PHB, level 2 (Concentration, 1 minute)" })
});

/** The token sizes' row names, lower-cased — the closed set the Token Sizes list is validated against. */
export const TOKEN_SIZE_NAMES = tableIndex(TOKEN_SIZES).names;

/**
 * THE REST GRANTS (the Human walk, 2026-09-25 — user: "human i think just needs initiatve to be
 * ticked on long rest"): a feature whose text gives the creature something when it finishes a rest,
 * which the platform does not give (the PHB's Resourceful ships a note: "Usage of this feature's
 * activity does not automatically grant Heroic Inspiration"). The grant rides the rest's own actor
 * update (rest-grants.js, `dnd5e.preRestCompleted`), and the rest card says so. Keyed by the
 * FEATURE's name; membership is the Rest Grants list.
 *   rests   which rests give it ("long", "short")
 *   grant   what the sheet gains — "inspiration" (Heroic Inspiration, the sheet's box)
 *   to      absent — the owner gains it on the rest's own update; "allies" — the owner GIVES it to
 *           allies, asked in a courtesy popup once the rest is done (Musician, the origin feats,
 *           2026-09-25 — user: "give a courtesy popup after long and short rest, listing the allies
 *           within 30 ft, player picks which ones to give inspiration. grey out the ones that already
 *           have and so note it"; "you can leverage the general form of careful spell")
 *   reach   ("allies") the feet an ally may stand from the owner's token — the map settles it (R1)
 *   cap     ("allies") how many may be given it — "prof": the owner's Proficiency Bonus
 *   rule    the feature's sentence, verbatim (law 8)
 */
export const REST_GRANTS = Object.freeze({
  "Resourceful": Object.freeze({ rests: Object.freeze(["long"]), grant: "inspiration",
    rule: "You gain Heroic Inspiration whenever you finish a Long Rest.", from: "Human" }),
  "Musician": Object.freeze({ rests: Object.freeze(["short", "long"]), grant: "inspiration", to: "allies", reach: 30, cap: "prof",
    rule: "Encouraging Song. As you finish a Short or Long Rest, you can play a song on a Musical Instrument with which you have proficiency and give Heroic Inspiration to allies who hear the song. The number of allies you can affect in this way equals your Proficiency Bonus.",
    from: "Origin feat (Entertainer)" })
});

/** The rest grants' row names, lower-cased — the closed set the Rest Grants list is validated against. */
export const REST_GRANT_NAMES = tableIndex(REST_GRANTS).names;

/**
 * DROP TO 1 HP (the Orc walk, 2026-09-25 — user: "if sometihng takes them to zero, then a popup
 * should ask to use the feat. same shape as death ward which you should do now too"): what turns a
 * drop to 0 Hit Points into a drop to 1 (drop-to-one.js, at `dnd5e.preApplyDamage`: the 1 is written
 * in the damage's own update). Keyed by the row's name; membership is the Drop to 1 HP list.
 *   ask       true — the rule says "you can": the HP is held at 1 and the owner is asked; false —
 *             the rule leaves no choice (Death Ward): it simply happens, and a card says so
 *   uses      true — the ITEM's own uses pay for it (Relentless Endurance: once per Long Rest)
 *   effect    the EFFECT whose presence is the row (Death Ward's "Protection from Death"), removed
 *             when it fires; no `effect` = a feature on the sheet, by the row's name
 *   ends      the spell ends when it fires (the card says so)
 *   outright  true — it also stands against damage that would kill outright (Death Ward: "would drop
 *             to 0"); false — "but not killed outright" (the remainder meets the Hit Point maximum)
 *   rule      the text, verbatim (law 8)
 */
export const DROP_TO_ONE = Object.freeze({
  "Death Ward": Object.freeze({ ask: false, effect: "Protection from Death", ends: true, outright: true,
    rule: "The first time the target would drop to 0 Hit Points before the spell ends, the target instead drops to 1 Hit Point, and the spell ends.",
    from: "PHB, level 4 (8 hours)" }),
  "Relentless Endurance": Object.freeze({ ask: true, uses: true, outright: false,
    rule: "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can’t do so again until you finish a Long Rest.",
    from: "Orc" })
});

/** The drop-to-1 rows' names, lower-cased — the closed set the Drop to 1 HP list is validated against. */
export const DROP_TO_ONE_NAMES = tableIndex(DROP_TO_ONE).names;

/**
 * REBUKES (user, 2026-09-25, the Goliath walk: "Storms thunder is not triggering anything. when
 * you fix it, also make sure the 60ft range calc is in there. Also when you do this, why dont you
 * pick up hellish rebuke and anything else in that family that is the same"). A Reaction taken
 * AFTER the bearer takes damage from a creature, aimed at THAT creature — offered as a popup to the
 * damaged creature's owner the moment the damage lands (rebukes.js), only when the damager stands
 * within reach of it. The shape is Riposte's (the defender strikes back, the answer drives the real
 * use at the attacker); the trigger is the damage, not a miss. Found by a scan of every
 * reaction-cost item in the sandbox's packs (tools/scan-reactions.mjs, 2026-09-25): each ships a
 * REACTION activity with its own range — the reach is read off it (N1), never typed, except
 * Retaliation's, whose activity carries none.
 *
 *   activity  the reaction activity, by name (null: the item's first reaction activity)
 *   attack    "melee" — the answer is one melee attack with a weapon the bearer picks (Retaliation:
 *             "using a weapon or an Unarmed Strike"), not the item's own activity
 *   range     feet, when the activity carries none (Retaliation's "within 5 feet")
 *   advantage true — the answer's attack roll has Advantage (Sword of Answering)
 *   while     an effect's name that must stand on the bearer (Fount of Moonlight's reaction exists
 *             only while the spell does: its "Wreathed in Light")
 *   equipped  true — the item must be equipped ("while you hold the sword")
 *   caveat    what the table judges ("that you can see")
 *
 * The spell's slot is the lowest the sheet holds (the hold's rule — no picker inside a Reaction's
 * window; a player who wants to upcast casts from the sheet). Membership is the Rebukes list.
 */
export const REBUKES = Object.freeze({
  "Storm's Thunder": Object.freeze({ activity: null, from: "Goliath — Giant Ancestry (Storm)",
    rule: "When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature." }),
  "Hellish Rebuke": Object.freeze({ activity: null, caveat: "a creature you can see", from: "PHB level 1 spell; the Monster Manual's Hellish Rebuke casts it",
    rule: "The creature that damaged you is momentarily surrounded by green flames. It makes a Dexterity saving throw, taking 2d10 Fire damage on a failed save or half as much damage on a successful one." }),
  "Fount of Moonlight": Object.freeze({ activity: "Blinding Reaction", while: "Wreathed in Light", caveat: "a creature you can see",
    from: "PHB level 4 spell (Concentration, 10 minutes)",
    rule: "Immediately after you take damage from a creature you can see within 60 feet of yourself, you can take a Reaction to force the creature to make a Constitution saving throw. On a failed save, the creature has the Blinded condition until the end of your next turn." }),
  "Retaliation": Object.freeze({ attack: "melee", range: 5, from: "Barbarian 14",
    rule: "When you take damage from a creature that is within 5 feet of you, you can take a Reaction to make one melee attack against that creature, using a weapon or an Unarmed Strike." }),
  "Sword of Answering": Object.freeze({ activity: "Attack Reaction", advantage: true, equipped: true, from: "DMG legendary weapon",
    rule: "While you hold the sword, you can take a Reaction to make one melee attack with it against any creature in your reach that deals damage to you. You have Advantage on the attack roll, and any damage dealt with this special attack ignores any Immunity or Resistance the target has." })
});

/** The rebukes' item names, lower-cased — the closed set the Rebukes list is validated against. */
export const REBUKE_NAMES = tableIndex(REBUKES).names;

/**
 * DAMAGE SAVES (user, 2026-09-04: "make heat metal spell work"). A bare damage activity whose
 * text ties a SAVE to taking the damage — the 2024 PHB's Heat Metal: "Cast and Heat" (2d8 Fire
 * at the object's holder) and "Reheat" (the same as a Bonus Action on later turns) are damage
 * activities that nothing chains, and "On Damage Save" (Con; the Heated Metal effect on a
 * failure — Disadvantage on attack rolls and ability checks until the start of the caster's next
 * turn) is a save activity nobody used. A row names the damage activities and the save; the
 * machine (damage-casts.js) rolls the dice at the use and puts the save to the same targets
 * right after, through the saves machine. The drop is a judgment the card says out loud (R1):
 * the failed save's effect lands, and the table removes it if the object was dropped.
 *
 *   damage   the damage activities, by name — each use of one rolls and then demands
 *   save     the save activity, by name — used at the damage's targets, no slot
 *   line     what the card says beyond the rule, for the consequence the table plays
 *
 * Membership is the Damage Saves list. The dice, the DC and the effect are the pack's (N1).
 */
export const DAMAGE_SAVES = Object.freeze({
  "Heat Metal": Object.freeze({ damage: Object.freeze(["Cast and Heat", "Reheat"]), save: "On Damage Save",
    line: "Played at the table: on a failed save the creature drops the object if it can — remove Heated Metal if it did; a creature that keeps hold of it has Disadvantage on attack rolls and ability checks until the start of the caster's next turn.",
    rule: "Choose a manufactured metal object, such as a metal weapon or a suit of Heavy or Medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 Fire damage when you cast the spell. Until the spell ends, you can take a Bonus Action on each of your later turns to deal this damage again if the object is within range. If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn’t drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn.",
    from: "PHB, level 2 (Concentration, 1 minute)" })
});

/** The damage-save items' names, lower-cased — the closed set the Damage Saves list is validated against. */
export const DAMAGE_SAVE_NAMES = tableIndex(DAMAGE_SAVES).names;

/** The two lifecycles an emanation can have — the closed set the R4 tripwire counts. */
export const EMANATION_KINDS = new Set(["feature", "spell"]);
/** The emanations' item names, lower-cased — the closed set the Emanations list is validated against. */
export const EMANATION_NAMES = tableIndex(EMANATIONS).names;

/**
 * SPENT AREAS — the spent-template sweep's FOURTH bucket (user ruling 2026-09-10, on the Adult
 * Green Dragon's Noxious Miasma beside Hypnotic Pattern). The sweep (saves/areas.js) reads the
 * area's life off the DATA: instantaneous → spent at the last verdict; concentration → spent with
 * the concentration; any other duration → the GM's, because Grease's minute is the area's own and
 * MUST persist. These rows are the areas whose data LIES about the area — the duration written on
 * the activity is an EFFECT's clock (Noxious Miasma's −2 AC "until the end of its next turn"), or
 * the concentration flag can go missing on an imported copy (Hypnotic Pattern) — so the text, not
 * the data, says the area is spent the moment its last verdict lands. Membership is the Spent
 * Areas list (the item names, whole-chunk, case-insensitive). ⚠ A row here is a claim about the
 * TEXT: an area that genuinely persists (Grease, Web, Cloudkill) must never be listed.
 *
 *   rule   the sentence that says the area itself does not persist
 *   data   what the pack writes instead, and why the sweep would otherwise keep the area
 */
export const SPENT_AREAS = Object.freeze({
  "Noxious Miasma": Object.freeze({
    rule: "Constitution Saving Throw: DC 17, each creature in a 20-foot-radius Sphere centered on a point the dragon can see within 90 feet. Failure: 7 (2d6) Poison damage, and the target takes a −2 penalty to AC until the end of its next turn.",
    data: "Monster Manual, Adult Green Dragon — the activity's duration reads 1 turn: the AC penalty's clock, not the cloud's" }),
  "Hypnotic Pattern": Object.freeze({
    rule: "You create a twisting pattern of colors that weaves through the air inside a 30-foot Cube within range. The pattern appears for a moment and vanishes. Each creature in the area who can see the pattern must succeed on a Wisdom saving throw or have the Charmed condition for the duration.",
    data: "PHB, level 3 (Concentration, 1 minute) — the DURATION is the Charmed condition's; the pattern \"appears for a moment and vanishes\", and an imported copy missing the concentration flag falls into the GM's bucket" }),
  // THE CLASS (user, 2026-09-18, the 6.0 walk, on Slow: "the template stays on slow, which should
  // be placed and gone, like hypnotic pattern"): a concentration spell whose area only CHOOSES its
  // targets at the cast — the effect rides the targets for the duration and the area itself is
  // nothing after the save. The pack writes the spell's minute on the activity, so without a row
  // the sweep keeps the area until concentration ends.
  "Slow": Object.freeze({
    rule: "You alter time around up to six creatures of your choice in a 40-foot Cube within range. Each target must succeed on a Wisdom saving throw or be affected by this spell for the duration.",
    data: "PHB, level 3 (Concentration, 1 minute) — the duration is the targets' slowing; the Cube chooses them at the cast" }),
  "Fear": Object.freeze({
    rule: "Each creature in a 30-foot Cone must succeed on a Wisdom saving throw or drop whatever it is holding and have the Frightened condition for the duration.",
    data: "PHB, level 3 (Concentration, 1 minute) — the duration is the Frightened condition's; the Cone is the cast's" }),
  "Confusion": Object.freeze({
    rule: "Each creature in a 10-foot-radius Sphere centered on a point you choose within range must succeed on a Wisdom saving throw, or that target can't take Bonus Actions or Reactions and must roll 1d10 at the start of each of its turns to determine its behavior for that turn.",
    data: "PHB, level 4 (Concentration, 1 minute) — the duration is the confusion's; the Sphere chooses the targets at the cast" }),
  "Sleep": Object.freeze({
    rule: "Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisdom saving throw or have the Incapacitated condition until the end of its next turn, at which point it must repeat the save.",
    data: "PHB, level 1 (Concentration, 1 minute) — the duration is the targets' sleep; the Sphere chooses them at the cast" }),
  "Calm Emotions": Object.freeze({
    rule: "Each Humanoid in a 20-foot-radius Sphere centered on a point you choose within range must succeed on a Charisma saving throw or be affected by one of the following effects (choose for each creature).",
    data: "PHB, level 2 (Concentration, 1 minute) — the duration is the effect's on each Humanoid; the Sphere chooses them at the cast" }),
  "Faerie Fire": Object.freeze({
    rule: "Objects in a 20-foot Cube within range are outlined in blue, green, or violet light (your choice). Each creature in the Cube is also outlined if it fails a Dexterity saving throw.",
    data: "PHB, level 1 (Concentration, 1 minute) — the outline is on what stood in the Cube at the cast; the Cube itself is nothing after (the 2026-08-18 region that outlived the spell)" })
});
export const SPENT_AREA_NAMES = tableIndex(SPENT_AREAS).names;

/**
 * CHOSEN AREAS — the area spells whose CASTER chooses who they affect (user, 2026-09-24, Session
 * 8: Slow asked Invictus, inside its cube, for a save; ruled off the prototype *Creatures of Your
 * Choice*). A placed area asks everyone it holds; these rows say the area is only where the
 * choice is made: "up to six creatures of your choice in a 40-foot Cube". When a listed spell's
 * area lands on anyone who is not hostile to the caster, or on more hostiles than the spell lets
 * the caster choose, the caster is asked who it affects (saves/demand.js raises the ask,
 * metamagic.js asks and answers it); otherwise the hostiles are the choice and nobody is asked.
 * Careful Spell greys on a listed spell (METAMAGIC's `unless`). Membership is the Chosen Areas
 * list (the item names, whole-chunk, case-insensitive).
 *
 * ⚠ BY NAME, NOT BY FLAG (§6 registry rule 1, measured 2026-09-24 against the 2024 PHB pack):
 * dnd5e's own `target.affects.choice` is set on four of these and left off Slow, Sleep, Conjure
 * Barrage and Conjure Volley, whose text grants the choice all the same. Spirit Guardians carries
 * the flag and is NOT here: its aura's reach (EMANATIONS) already reaches enemies only, the same
 * answer. Spells that choose by TARGETING (Bane, Enthrall, Compulsion, Divine Word) need nothing —
 * the tokens the player targets are the choice. The number a spell allows is read off its own
 * text (decide/metamagic.js `choiceCapFrom`), never written here (N1).
 *
 *   data   what the text says, and what the pack's data does with it
 */
export const CHOSEN_AREAS = Object.freeze({
  "Slow": Object.freeze({ data: "PHB, level 3 — “up to six creatures of your choice in a 40-foot Cube”; the pack's choose flag is off" }),
  "Sleep": Object.freeze({ data: "PHB, level 1 — “each creature of your choice in a 5-foot-radius Sphere”; the pack's choose flag is off" }),
  "Conjure Barrage": Object.freeze({ data: "PHB, level 3 — “each creature of your choice that you can see in a 60-foot Cone”; the pack's choose flag is off" }),
  "Conjure Volley": Object.freeze({ data: "PHB, level 5 — “each creature of your choice that you can see in a 40-foot-radius, 20-foot-high Cylinder”; the pack's choose flag is off" }),
  "Word of Radiance": Object.freeze({ data: "PHB, cantrip — “each creature of your choice that you can see in it” (a 5-foot Emanation); the pack flags the choice" }),
  "Destructive Wave": Object.freeze({ data: "PHB, level 5 — “each creature you choose in the Emanation”; the pack flags the choice" }),
  "Weird": Object.freeze({ data: "PHB, level 9 — “each creature of your choice in a 30-foot-radius Sphere”; the pack flags the choice" })
});
export const CHOSEN_AREA_NAMES = tableIndex(CHOSEN_AREAS).names;

/**
 * The 2024 Rules Glossary on range, verbatim (dnd5e.content24 / the premium PHB, appendix D —
 * "Range" and "Ranged Attacks in Close Combat"; presentation law 8). The `&Reference[...]`
 * enrichers in the source render as the bare condition names.
 */
export const RANGE_RULES = Object.freeze({
  long: "Your attack roll has Disadvantage when your target is beyond normal range, and you can’t attack a target beyond long range.",
  single: "If a ranged attack, such as one made with a spell, has a single range, you can’t attack a target beyond this range.",
  close: "When you make a ranged attack roll with a weapon, a spell, or some other means, you have Disadvantage on the roll if you are within 5 feet of an enemy who can see you and doesn’t have the Incapacitated condition."
});

/**
 * THE CONDITION TABLE (Stage 3, 2026-09-01) — what the 2024 conditions do to an ATTACK ROLL,
 * both roles, with each condition's own "Attacks Affected" clause quoted VERBATIM from the
 * world's Rules Glossary (dnd5e.content24 / the premium PHB — presentation law 8). This is the
 * knowledge AC5e carries (DESIGN R-B), as DATA the gate reads; nothing here decides anything —
 * `conditionSources` in decide/reminders.js takes this table as a parameter.
 *
 * ⚠ ONE DECLARATION (review finding 8). The rows, the closed set the Condition Sources list is
 * validated against (`CONDITION_STATUSES`) and that list's shipped default were three hand-kept
 * copies; the set and the default are DERIVED from these keys now, so a fourteenth condition is
 * a row here and nothing else — R4's bargain, literally (and Hiding was exactly that, 2026-09-02).
 *
 *   attacker   what the condition does to the bearer's OWN attack rolls
 *   target     what it does to attack rolls AGAINST the bearer
 *   null       no bend on that side; a NOTE means "listed for the table, never counted"
 *
 * Prone is the one row with geometry, and it lives in `proneSources` rather than here.
 * Membership — which of these a table wants nagged about — is the Condition Sources list.
 *
 * Each row: `attacker` and `target` are the bend on that side ("advantage" | "disadvantage" |
 * null), `rule` the glossary clause verbatim, `caveat` a condition the module cannot judge (counted,
 * and said), `note` a fact listed for the table and never counted.
 *
 * `critWithinFeet` is the glossary's *Automatic Critical Hits* clause as a number (user,
 * 2026-09-02): a hit on the bearer from within that many feet is a Critical Hit — an OUTCOME,
 * which the damage service applies (auto-damage.js `critFor`), not a reminder.
 *
 * @type {Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: string, caveat?: string, note?: string, critWithinFeet?: number}>>>}
 */
export const CONDITION_BENDS = Object.freeze({
  blinded: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: "Attack rolls against you have Advantage, and your attack rolls have Disadvantage." }),
  invisible: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: "Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature." }),
  // Hiding is the system's own status (dnd5e ships `hiding`, an icon with no condition
  // behind it), not a 2024 condition: the Hide action grants Invisible "while hidden", and the
  // attack clause is the glossary's Unseen Attackers and Targets (user, 2026-09-02 — the
  // fourteenth row, and it cost this row and nothing else).
  hiding: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: "When a creature can’t see you, you have Advantage on attack rolls against it. When you make an attack roll against a target you can’t see, you have Disadvantage on the roll.",
    caveat: "counted — press Normal if the other side can see you" }),
  paralyzed: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.",
    critWithinFeet: 5 }),
  petrified: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage." }),
  poisoned: Object.freeze({ attacker: "disadvantage", target: null,
    rule: "You have Disadvantage on attack rolls and ability checks." }),
  restrained: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: "Attack rolls against you have Advantage, and your attack rolls have Disadvantage." }),
  stunned: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage." }),
  unconscious: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.",
    critWithinFeet: 5 }),
  frightened: Object.freeze({ attacker: "disadvantage", target: null,
    rule: "You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.",
    caveat: "counted — press Normal if the source of the fear is out of sight" }),
  grappled: Object.freeze({ attacker: "disadvantage", target: null,
    rule: "You have Disadvantage on attack rolls against any target other than the grappler.",
    caveat: "counted — press Normal if this attack is against the grappler" }),
  incapacitated: Object.freeze({ attacker: null, target: null,
    rule: "You can’t take any action, Bonus Action, or Reaction.",
    note: "an Incapacitated creature cannot attack at all — this roll should not be happening" }),
  dodging: Object.freeze({ attacker: null, target: "disadvantage",
    rule: "Until the start of your next turn, any attack roll made against you has Disadvantage if you can see the attacker. You lose these benefits if you have the Incapacitated condition or if your Speed is 0.",
    caveat: "counted — press Normal if it cannot see the attacker, is Incapacitated, or has Speed 0" }),
  charmed: Object.freeze({ attacker: null, target: null,
    rule: "You can’t attack the charmer or target the charmer with damaging abilities or magical effects.",
    note: "a Charmed creature cannot attack its charmer — if this is the charmer, this roll should not be happening" })
});

/** The table's rows, in the order the table reads them. */
export const CONDITION_KEYS = Object.freeze(Object.keys(CONDITION_BENDS));

/**
 * THE SAVE TABLE (user ruling 2026-09-02, option E of *The Save Gate*) — what the 2024
 * conditions do to a SAVING THROW, each row's own "Saving Throws Affected" clause quoted
 * VERBATIM from the world's Rules Glossary (read live off `CONFIG.DND5E.conditionTypes[*].reference`,
 * tools/probe-clock-riders.mjs; presentation law 8). Less than the attack table: two true
 * bends and four automatic failures, all on Strength or Dexterity saves. Membership is the
 * same Condition Sources list the attack gate reads — a condition switched off there is not
 * read here either; `saveSources` in decide/reminders.js takes this table as a parameter.
 *
 *   abilities  which saves the row touches (ability ids)
 *   bend       "advantage" | "disadvantage" — counted, the gate's arithmetic as for attacks
 *   autoFail   true — the save CANNOT SUCCEED: not a bend, a fourth button (Fails: no dice,
 *              the failure recorded) — the human still presses (R1; option C, the module
 *              deciding with no press, is ruled out)
 *   caveat     a condition the module cannot judge, said on the box (Dodge's two)
 *
 * Not read on purpose: Exhaustion's flat penalty — dnd5e applies it itself (`addRollExhaustion`);
 * Poisoned and Frightened touch checks and attacks only. Dodging is the system's own status
 * (`dodging`), and its clause is the Dodge action's, not a condition's.
 *
 * @type {Readonly<Record<string, Readonly<{abilities: readonly string[], bend?: "advantage"|"disadvantage", autoFail?: boolean, rule: string, caveat?: string}>>>}
 */
export const SAVE_BENDS = Object.freeze({
  restrained: Object.freeze({ abilities: Object.freeze(["dex"]), bend: "disadvantage",
    rule: "You have Disadvantage on Dexterity saving throws." }),
  dodging: Object.freeze({ abilities: Object.freeze(["dex"]), bend: "advantage",
    rule: "Until the start of your next turn, any attack roll made against you has Disadvantage if you can see the attacker, and you make Dexterity saving throws with Advantage. You lose these benefits if you have the Incapacitated condition or if your Speed is 0.",
    caveat: "counted — press Normal if it is Incapacitated or its Speed is 0" }),
  paralyzed: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: "You automatically fail Strength and Dexterity saving throws." }),
  stunned: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: "You automatically fail Strength and Dexterity saving throws." }),
  unconscious: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: "You automatically fail Strength and Dexterity saving throws." }),
  petrified: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: "You automatically fail Strength and Dexterity saving throws." })
});

/**
 * THE CHECK TABLE (user go 2026-09-03 — the third table on the one gate machine): what the 2024
 * conditions do to an ABILITY CHECK (a raw check, a skill, a tool — never initiative, which is
 * out of scope by design), each row's clause quoted VERBATIM from the Rules Glossary. Two rows,
 * both Disadvantage; membership is the same Condition Sources list the other two gates read.
 *
 * ⚠ Poisoned is a bend the PLATFORM already applies — dnd5e 5.3.3 rolls a Poisoned creature's
 * check with Disadvantage on its own (measured 2026-09-03, tools/probe-conditions.mjs:
 * `2d20dis + 1` with `configure: false`). The row is therefore a REMINDER of a default the dialog
 * already shows, never a second application: the gate's box says WHY the button is
 * highlighted, and the record says what was pressed. Frightened the platform leaves alone (its
 * clause hinges on line of sight), so that row is the gate's own — counted, the caveat in the
 * quoted rule. Exhaustion's −2 × level is a subtraction the system applies, not a bend, so it has
 * no row; Blinded's and Deafened's sight/hearing failures are out of scope (BACKLOG).
 *
 * @type {Readonly<Record<string, Readonly<{bend: "advantage"|"disadvantage", rule: string, platform?: boolean}>>>}
 */
export const CHECK_BENDS = Object.freeze({
  poisoned: Object.freeze({ bend: "disadvantage", platform: true,
    rule: "You have Disadvantage on attack rolls and ability checks." }),
  frightened: Object.freeze({ bend: "disadvantage",
    rule: "You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight." })
});

/**
 * THE EFFECT TABLE — the sixth reminder kind (user, 2026-09-02: "I like effect sources").
 * Abilities that bend an attack roll and land on a sheet as an ACTIVE EFFECT (Innate Sorcery,
 * Reckless, Blur…) or sit there as a FEATURE with no effect at all (Pack Tactics, Bloodied
 * Fury). One row per ability, all data, found by a 30-pack scan of the sandbox's system and
 * premium compendia (the survey artifact "Effect Sources", 2026-09-02).
 *
 *   match     "effect" (default) — the row names an ActiveEffect on the actor;
 *             "feature" — the row names an Item of type feat on the actor (never an effect:
 *             Innate Sorcery the FEATURE is always on the sheet, Innate Sorcery the EFFECT only
 *             while it runs — so a feature row must never name something that also lands as
 *             an effect). The attack gate, the check gate and the SAVE gate all read it (the
 *             save gate since Slice A, 2026-09-24 — Brave, Fey Ancestry, Dwarven Resilience)
 *   attacker  the bend on the bearer's OWN attack rolls, or null
 *   target    the bend on attack rolls AGAINST the bearer, or null
 *   scope     "any" | "spell" | "weapon" | "melee" | "ranged" — which attacks the row touches
 *             (Innate Sorcery is spell attacks only; the activity's own classification decides)
 *   caveat    a condition the module cannot judge, said on the box (the Frightened shape)
 *   counted   false = LISTED, not counted (user ruling 2026-09-02: rows whose caveat is the
 *             RULE — Demon Armor bends only against demons — are shown so nobody forgets the
 *             item, and stay out of the net); default true
 *   judge     "bloodied" (the bearer at or below half HP), "targetBloodied", "targetDamaged"
 *             (the target at or below half / short of full), "targetGrappled", "targetNotActed"
 *             (round one, and the target has not taken a turn — the combat clock), "allyNearTarget"
 *             (an ally of the attacker, not Incapacitated, within 5 feet of the target — the map)
 *             — a fact the module holds; the row fires only when it is true. The map's fact can
 *             also be UNKNOWN (an attacker whose side the module cannot name): the row is then
 *             counted, as `except` does — the gate never guesses an exemption
 *   spend     "attack" — the rules end the effect on the next attack roll ("your next attack
 *             roll"): the spend hook uses it up with a receipt, exactly as Vex and Sap
 *   only      "source" — the bend is for the creature whose action put the effect there and
 *             nobody else (Vow of Enmity: the sworn creature wears the marker, the paladin's
 *             Advantage is the paladin's alone); a carrier with no recorded source is skipped
 *   except    "source" — the bend stands against everyone BUT that creature (Goaded, Compelled);
 *             a carrier with no recorded source is counted — the gate never guesses an exemption
 *   checks    a bend on the bearer's ABILITY CHECKS (Heated Metal, Averse) — the check gate's
 *   checksWhen { statuses, skills } — narrows `checks` to a bearer wearing one of the statuses and
 *             a check of one of the skills (Powerful Build: Grappled, Athletics or Acrobatics —
 *             the escape the module cannot otherwise tell from any check; the Goliath walk,
 *             2026-09-25)
 *   saves     { bend, statuses?, spells?, halfToNone? } — a bend on the bearer's SAVING THROWS,
 *             scoped by the DEMAND the save gate finds: against an effect imposing one of the
 *             statuses (Aura of Purity), or against a spell (Circle of Power); `halfToNone` turns
 *             a success against half-on-save damage into none (2026-09-05)
 *   rule      the ability's own sentence, from the pack (enrichers rendered as plain words)
 *   from      where it comes from, for the reader
 *
 * ⚠ Names are the packs' own, colons and all ("Adv: Attacks & Saves") — the Effect Sources
 * list is parsed WHOLE-CHUNK for that reason (LIST_SPECS.effects.whole). Matching is
 * case-insensitive on both sides.
 *
 * @type {Readonly<Record<string, Readonly<{match?: "effect"|"feature", attacker: "advantage"|"disadvantage"|null,
 *   target: "advantage"|"disadvantage"|null, scope: "any"|"spell"|"weapon"|"melee"|"ranged", caveat?: string,
 *   counted?: boolean, judge?: "bloodied"|"targetBloodied"|"targetDamaged"|"targetGrappled"|"targetNotActed"|"allyNearTarget", spend?: "attack",
 *   only?: "source", except?: "source", rule: string, from: string}>>>}
 */
// `except: "source"` (2026-09-04, the walk: "disadvantage should not apply when attacking
// morgash, the person doing the goading"): the bend stands against everyone BUT the creature
// whose action put the effect there — Goaded (an attacker-side bend, skipped when the target
// is the goader), Distracted (a target-side bend, skipped when the attacker is the distracter).
// The EDGE reads each effect's source off the module's stamp on it, else off its origin.
export const EFFECT_BENDS = Object.freeze({
  // --- A. standing, no caveat: the row is the whole truth ---------------------------------
  "Innate Sorcery": Object.freeze({ attacker: "advantage", target: null, scope: "spell", from: "Sorcerer",
    rule: "You have Advantage on the attack rolls of Sorcerer spells you cast." }),
  "Reckless": Object.freeze({ attacker: "advantage", target: "advantage", scope: "weapon", from: "Barbarian, Reckless Attack",
    rule: "Doing so gives you Advantage on attack rolls using Strength until the start of your next turn, but attack rolls against you have Advantage during that time." }),
  "Foresight": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", from: "Foresight",
    rule: "For the duration, the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it." }),
  "Blurred": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Blur",
    rule: "For the duration, any creature has Disadvantage on attack rolls against you." }),
  "Holy Protection": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Holy Aura",
    rule: "While in the aura, creatures of your choice have Advantage on all saving throws, and other creatures have Disadvantage on attack rolls against them." }),
  "Shining": Object.freeze({ attacker: null, target: "advantage", scope: "any", from: "Shining Smite",
    rule: "Until the spell ends, the target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it can’t benefit from the Invisible condition." }),
  "Crushed": Object.freeze({ attacker: null, target: "advantage", scope: "any", from: "Crusher",
    rule: "When you score a Critical Hit that deals Bludgeoning damage to a creature, attack rolls against that creature have Advantage until the start of your next turn." }),
  "Slashed": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Slasher",
    rule: "When you score a Critical Hit that deals Slashing damage to a creature, it has Disadvantage on attack rolls until the start of your next turn." }),
  "Zealous Presence": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Zealot Barbarian",
    rule: "Up to ten other creatures of your choice within 60 feet of you gain Advantage on attack rolls and saving throws until the start of your next turn." }),
  "Rallied": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Rally (monsters)",
    rule: "Until the start of its next turn, the targets have Advantage on attack rolls and saving throws." }),
  "Attack: Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "War Cry (monsters)",
    rule: "Each ally of its choice that can see or hear it gains Temporary Hit Points and has Advantage on attack rolls until the start of its next turn." }),
  "Adv: Attacks & Saves": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Marshal Undead (monsters)",
    rule: "Undead within the Emanation have Advantage on attack rolls and saving throws." }),
  "Manacled": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Manacles",
    rule: "While bound, a creature has Disadvantage on attack rolls, and the creature is Restrained if the Manacles are attached to a chain or hook that is fixed in place." }),
  // `checks` — the row bends ABILITY CHECKS too (the check gate reads it; 2026-09-04, Heat Metal).
  "Heated Metal": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", checks: "disadvantage", from: "Heat Metal",
    rule: "If it doesn’t drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn." }),
  "Averse": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", checks: "disadvantage", from: "Aversion to Fire (monsters)",
    rule: "If it takes Fire damage, it has Disadvantage on attack rolls and ability checks until the end of its next turn." }),
  "Target: Disadvantage": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Sap, Pesky Swarm (monsters)",
    rule: "The target has Disadvantage on attack rolls until the end of its next turn." }),
  "Attacks: Disadvantage": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Flash of Light (monsters)",
    rule: "The target has Disadvantage on attack rolls until the end of its next turn." }),
  "Attack and Save Disadvantage": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Howl (Ravenloft)",
    rule: "Each creature of your choice within 15 feet of you must succeed on a Wisdom saving throw or have Disadvantage on attack rolls and saving throws until the start of your next turn." }),
  "Cursed (Path to the Grave)": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Path to the Grave (Ravenloft)",
    rule: "While cursed, the creature has Disadvantage on attack rolls and saving throws." }),
  "Disadv. Attacks & Saves": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Sunlight (monsters)",
    rule: "While in sunlight, it has Disadvantage on attack rolls and ability checks." }),
  "Disadv. Attacks & Checks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Vampire Weakness (monsters)",
    rule: "While in sunlight, it has Disadvantage on attack rolls and ability checks." }),
  "Disadv.: Attacks & Checks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Fear of Fire (monsters)",
    rule: "If it takes Fire damage, it has Disadvantage on attack rolls and ability checks until the end of its next turn." }),
  // --- B. the effect sits on the OTHER creature — the source's facet judges it ---------------
  // ⚠ RE-READ AGAINST THE PACKS (2026-09-21, the walk: "vow of enmity is not giving invictus
  // advantage reminder when he swings"). Every one of these effects lands on the creature the
  // feature is USED ON, not on its user — Vow of Enmity's activity targets one creature within
  // 30 feet, and the sworn creature wears the marker with the paladin as its source. Read on
  // the paladin's own sheet (the old rows: `attacker: "advantage"`) it fired for nobody. The
  // rows now read the marker where the pack puts it and let the SOURCE facet judge what the
  // caveat used to ask the table to judge: `only: "source"` where the bend is the source's alone,
  // `except: "source"` where it stands against everyone but the source. A caveat stays only
  // where the words still hold a fact the module cannot read (Prey's target is never recorded;
  // Strike Fear's Frightened can be cured under the marker).
  "Vow of Enmity": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", from: "Paladin",
    rule: "You have Advantage on attack rolls against the creature for 1 minute or until you use this feature again." }),
  // Marked as Prey: the pack's effect is on the MONSTER (a self-ranged utility), the marked
  // creature is nowhere in the data — the caveat is the whole of what the module can say.
  "Prey: Attack Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Marked as Prey (monsters)",
    caveat: "counted — press Normal if this attack is not at the marked creature",
    rule: "It has Advantage on attack rolls against the target until the start of its next turn." }),
  // Both sides, both the source's: the bonded creature's Disadvantage is against the seer alone,
  // the seer's Advantage is at the bonded creature alone.
  "Clairvoyant Combatant": Object.freeze({ attacker: "disadvantage", target: "advantage", scope: "any", only: "source", from: "Clairvoyant Combatant",
    rule: "On a failed save, the creature has Disadvantage on attack rolls against you, and you have Advantage on attack rolls against that creature for the duration of the bond." }),
  "Strike Fear: Terrify": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", from: "Strike Fear (Heroes of Faerûn)",
    caveat: "counted — press Normal if the target is no longer Frightened by you",
    rule: "While the target is Frightened in this way, you have Advantage on attack rolls against the target." }),
  "Compelled": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Compelled Duel",
    rule: "On a failed save, the target has Disadvantage on attack rolls against creatures other than you." }),
  "Goaded": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Battle Master, Goading Attack",
    rule: "The target must succeed on a Wisdom saving throw or have Disadvantage on attack rolls against targets other than you until the end of your next turn." }),
  "Taunted": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Steps of the Fey",
    rule: "Creatures within 5 feet of the space you left must succeed on a Wisdom saving throw or have Disadvantage on attack rolls against creatures other than you until the start of your next turn." }),
  // SAVE BENDS BY EFFECT (user, 2026-09-05: "Aura of Purity doesn't really give advantage to
  // saves like Hold Person, Hypnotic Pattern … do it for all the pack effect spells"): the
  // `saves` facet — the bend on the BEARER's saving throws, scoped by what the demand would do
  // (`statuses`: a save against an effect that imposes one of these; `spells`: a save a spell
  // demands), read against the demand the save gate finds. `halfToNone`: a success against
  // half-on-save damage takes NONE (Circle of Power — an outcome, the applier's). The packs'
  // effects carry no data for any of this (measured 2026-09-05); the rows are where it lives.
  "Aura of Purity": Object.freeze({ attacker: null, target: null, scope: "any", from: "Aura of Purity",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["blinded", "charmed", "deafened", "frightened", "paralyzed", "poisoned", "stunned"]) }),
    rule: "While in the aura, you and your allies have Resistance to Poison damage and Advantage on saving throws to avoid or end effects that include the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned condition." }),
  "Circle's Power": Object.freeze({ attacker: null, target: null, scope: "any", from: "Circle of Power",
    saves: Object.freeze({ bend: "advantage", spells: true, halfToNone: true }),
    rule: "While in the aura, you and your allies have Advantage on saving throws against spells and other magical effects. When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save." }),
  "Cursed Attacks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Bestow Curse",
    caveat: "counted — press Normal if this attack is not at the caster",
    rule: "While cursed, the target has Disadvantage on attack rolls against you." }),
  // `item`: the row stands only for an effect that comes from THIS item, when the sheet knows —
  // the Aura of Protection hands out a "Protected" too, a save bonus (walk finding, 2026-09-18).
  "Protected": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good", item: "Protection from Evil and Good",
    caveat: "counted — press Normal if the attacker is not an Aberration, Celestial, Elemental, Fey, Fiend or Undead",
    rule: "Creatures of those types have Disadvantage on attack rolls against the target." }),
  "Protection from Evil and Good": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good (2014)",
    caveat: "counted — press Normal if the attacker is not an Aberration, Celestial, Elemental, Fey, Fiend or Undead",
    rule: "Creatures of those types have Disadvantage on attack rolls against the target." }),
  "Dispelling Evil and Good": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Dispel Evil and Good",
    caveat: "counted — press Normal if the attacker is not a Celestial, Elemental, Fey, Fiend or Undead",
    rule: "For the duration, Celestials, Elementals, Fey, Fiends, and Undead have Disadvantage on attack rolls against you." }),
  "Assasinate": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Assassin Rogue (the pack's own spelling)",
    caveat: "counted — press Normal if this is not the first round, or the target has taken a turn",
    rule: "During the first round of each combat, you have Advantage on attack rolls against any creature that hasn’t taken a turn." }),
  // --- listed, not counted: the caveat is the rule ------------------------------------------
  "Chill Touch": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", counted: false, from: "Chill Touch (2014)",
    caveat: "listed — Disadvantage only for an Undead attacker, and only against the caster",
    rule: "If you hit an undead target, it also has disadvantage on attack rolls against you until the end of your next turn." }),
  "Shocking Grasp": Object.freeze({ attacker: "advantage", target: null, scope: "spell", counted: false, from: "Shocking Grasp (2014)",
    caveat: "listed — Advantage only if the target wears metal armor",
    rule: "You have advantage on the attack roll if the target is wearing armor made of metal." }),
  "Boots of Speed Active": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", counted: false, from: "Boots of Speed",
    caveat: "listed — Disadvantage only on an Opportunity Attack",
    rule: "If you do, the boots double your Speed, and any creature that makes an Opportunity Attack against you has Disadvantage on the attack roll." }),
  "Demon Armor": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", counted: false, from: "Demon Armor",
    caveat: "listed — Disadvantage only against demons",
    rule: "While wearing the armor, you have Disadvantage on attack rolls against demons and on saving throws against their spells and special abilities." }),
  "Air Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: "While wearing the ring, you have Advantage on attack rolls against Elementals and they have Disadvantage on attack rolls against you." }),
  "Earth Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: "While wearing the ring, you have Advantage on attack rolls against Elementals and they have Disadvantage on attack rolls against you." }),
  "Fire Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: "While wearing the ring, you have Advantage on attack rolls against Elementals and they have Disadvantage on attack rolls against you." }),
  "Water Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: "While wearing the ring, you have Advantage on attack rolls against Elementals and they have Disadvantage on attack rolls against you." }),
  "Ring Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Water Elemental Command (2014)",
    caveat: "listed — only against, or from, Water Elementals",
    rule: "While wearing this ring, you have advantage on attack rolls against Water Elementals, and they have disadvantage on attack rolls against you." }),
  "Berserker Axe": Object.freeze({ attacker: "disadvantage", target: null, scope: "weapon", counted: false, from: "Berserker Axe",
    caveat: "listed — Disadvantage only with a weapon other than the axe",
    rule: "You also have Disadvantage on attack rolls with weapons other than this one." }),
  "Oathbow": Object.freeze({ attacker: "disadvantage", target: null, scope: "weapon", counted: false, from: "Oathbow",
    caveat: "listed — Disadvantage only with a weapon other than the bow, while the sworn enemy lives",
    rule: "While your sworn enemy lives, you have Disadvantage on attack rolls with all other weapons." }),
  "Sword of Vengeance": Object.freeze({ attacker: "disadvantage", target: null, scope: "weapon", counted: false, from: "Sword of Vengeance",
    caveat: "listed — Disadvantage only with a weapon other than the sword",
    rule: "While attuned to this weapon, you have Disadvantage on attack rolls made with weapons other than this one." }),
  // --- C. spent by the next attack roll — Vex and Sap's shape ---------------------------------
  "Guiding Bolt": Object.freeze({ attacker: null, target: "advantage", scope: "any", spend: "attack", from: "Guiding Bolt",
    rule: "On a hit, it takes 4d6 Radiant damage, and the next attack roll made against it before the end of your next turn has Advantage." }),
  "Mocked": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Vicious Mockery",
    rule: "The target must succeed on a Wisdom saving throw or take 1d6 Psychic damage and have Disadvantage on the next attack roll it makes before the end of its next turn." }),
  "Vicious Mockery": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Vicious Mockery (2014)",
    rule: "It must succeed on a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on the next attack roll it makes before the end of its next turn." }),
  "Enervated": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Ray of Enfeeblement",
    rule: "On a successful save, the target has Disadvantage on the next attack roll it makes until the start of your next turn." }),
  "Brief Enfeeblement": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Ray of Enfeeblement",
    rule: "On a successful save, the target has Disadvantage on the next attack roll it makes until the start of your next turn." }),
  // ⚠ Recut 2026-09-05: the pack's effect sits on the TARGET ("for tracking the target"), placed by
  // superiority-uses.js with the fighter as its source; `only: "source"` — the Advantage is the
  // fighter's alone, and only the fighter's next attack roll at that target spends it.
  "Feinting Attack": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", spend: "attack", from: "Battle Master",
    rule: "You have Advantage on your next attack roll against that target this turn." }),
  "Distracted": Object.freeze({ attacker: null, target: "advantage", scope: "any", spend: "attack", except: "source", from: "Battle Master, Distracting Strike",
    rule: "The next attack roll against the target by an attacker other than you has Advantage if the attack is made before the start of your next turn." }),
  "Aiming: Attack Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Aim, Deadly Aim (monsters)",
    rule: "It has Advantage on the next attack roll it makes during the current turn." }),
  "Killer's Fortune (Attack Advantage)": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Boon of Bloodshed (Heroes of Faerûn)",
    rule: "When an enemy you can see is reduced to 0 Hit Points, you gain Advantage on the next attack roll you make before the end of your next turn." }),
  "Adv. Next Attack": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Lords' Alliance Agent (Heroes of Faerûn)",
    caveat: "counted — press Normal if this attack is not at the enemy that hurt your ally",
    rule: "When an enemy you can see deals damage to an ally of yours that is within 5 feet of you, you have Advantage on your next attack roll against that enemy before the end of your next turn." }),
  "Moonlight Step": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Moon Druid",
    rule: "As a Bonus Action, you teleport up to 30 feet to an unoccupied space you can see, and you have Advantage on the next attack roll you make before the end of this turn." }),
  "Disadvantaged": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Rival Coin",
    rule: "On a failed save, the target takes 2d4 Psychic damage and has Disadvantage on the next attack roll it makes before the end of its next turn." }),
  "Vigilant": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", spend: "attack", from: "Tyro of the Gauntlet (Heroes of Faerûn)",
    rule: "When you take the Ready action, the next attack roll made against you has Disadvantage before the start of your next turn." }),
  // --- D. a feature, never an effect: matched by the feature's name --------------------------
  // Pack Tactics is judged on the MAP (user, 2026-09-22: "the hobgoblin in party camp attacking
  // the practice dummy is triggering adv prompt bc of pack tactics, yet that shouldn't apply
  // here"): an ally of the attacker within 5 feet of the target, or nothing. The caveat stands
  // for the one case the map cannot answer — an attacker whose side the module cannot name.
  "Pack Tactics": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "allyNearTarget", from: "monsters",
    caveat: "counted — when the attacker's side cannot be read; press Normal if no ally of the attacker is within 5 feet of the target",
    rule: "It has Advantage on an attack roll against a creature if at least one of its allies is within 5 feet of the creature and the ally doesn’t have the Incapacitated condition." }),
  "Bloodied Fury": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "bloodied", from: "monsters",
    rule: "While Bloodied, it has Advantage on attack rolls." }),
  "Bloodied Frenzy": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "bloodied", from: "monsters",
    rule: "While Bloodied, it has Advantage on attack rolls and saving throws." }),
  "Purple Dragon Commandant": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "bloodied", from: "Heroes of Faerûn",
    rule: "You have Advantage on attack rolls while Bloodied." }),
  "Warrior's Wrath": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "melee", judge: "targetBloodied", from: "DMG",
    rule: "It has Advantage on melee attack rolls against any Bloodied creature." }),
  "Blood Frenzy": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "targetDamaged", from: "monsters",
    rule: "It has Advantage on attack rolls against any creature that doesn’t have all its Hit Points." }),
  "Grappler": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "targetGrappled", from: "the Grappler feat",
    caveat: "counted — press Normal if the target is not Grappled by you",
    rule: "You have Advantage on attack rolls against a creature Grappled by you." }),
  "Street Justice": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "targetGrappled", from: "Heroes of Faerûn",
    caveat: "counted — press Normal if the target is not Grappled by your ally",
    rule: "Your allies have Advantage on attack rolls against a creature Grappled by you." }),
  "Precise Hunter": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", from: "Ranger",
    caveat: "counted — press Normal if the target is not your Hunter's Mark",
    rule: "You have Advantage on attack rolls against the creature currently marked by your Hunter’s Mark." }),
  "Light Sensitivity": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in Bright Light",
    rule: "While in Bright Light, it has Disadvantage on attack rolls." }),
  "Sunlight Sensitivity": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in sunlight",
    rule: "While in sunlight, it has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight." }),
  "Sunlight Weakness": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in sunlight",
    rule: "While in sunlight, it has disadvantage on attack rolls, ability checks, and saving throws." }),
  "Sunlight Hypersensitivity": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in sunlight",
    rule: "While in sunlight, it has Disadvantage on attack rolls and ability checks." }),
  "Mounted Combatant": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", counted: false, from: "the Mounted Combatant feat",
    caveat: "listed — Advantage only while mounted, against a smaller unmounted creature within 5 feet of the mount",
    rule: "While mounted, you have Advantage on attack rolls against any unmounted creature within 5 feet of your mount that is at least one size smaller than the mount." }),
  "Invoke Duplicity": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", counted: false, from: "Trickery Cleric",
    caveat: "listed — Advantage only with the illusion and you both within 5 feet of the target",
    rule: "When both you and your illusion are within 5 feet of a creature that can see the illusion, you have Advantage on attack rolls against that creature." }),
  "Ambusher": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Advantage only in the first round, against a creature it surprised",
    rule: "In the first round of a combat, it has advantage on attack rolls against any creature it has surprised." }),
  // --- E. the combat CLOCK as the judge (user, 2026-09-02 — the Assassin) ----------------------
  // The first row whose fact is the ROUND and whether the target has ACTED: the platform's own
  // facts (combat.round, the target's place in the order against the current turn), read by the
  // EDGE like Bloodied is. Out of combat it never fires — there is no first round to be in.
  // --- F. USE CHIPS — a feature the pack ships as text alone, written as a chip on use (use-chips.js) ---
  // The chip is NAMED as the feature is, so this row reads it as any effect: Advantage on the
  // attacker's next attack roll, spent by that roll (user report 2026-09-02: Steady Aim
  // "isnt appling" — the 2024 PHB ships it with no effect at all).
  "Steady Aim": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack",
    rule: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    from: "Rogue 3 (a use chip)" }),
  "Assassinate": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any",
    judge: "targetNotActed",
    rule: "During the first round of each combat, you have Advantage on attack rolls against any creature that hasn’t taken a turn.",
    from: "Rogue — Assassin (Surprising Strikes)" }),
  // --- G. SPECIES TRAITS whose one bend is on SAVES (Slice A, 2026-09-24) ----------------------
  // The 2024 PHB ships these as text alone — no effect to find (measured on the pack, the Slice A
  // inventory) — so they are FEATURE rows the save gate reads by name, scoped by the demand's
  // statuses the Aura of Purity way. A save to END the condition is a bare sheet roll with no
  // demand: the row is listed there, never counted (R1 — the module does not guess what a sheet
  // roll is against). Dwarven Resilience's Poison Resistance is the species' own advancement.
  "Brave": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Halfling",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["frightened"]) }),
    rule: "You have Advantage on saving throws you make to avoid or end the Frightened condition." }),
  "Fey Ancestry": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["charmed"]) }),
    rule: "You have Advantage on saving throws you make to avoid or end the Charmed condition." }),
  "Dwarven Resilience": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Dwarf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["poisoned"]) }),
    rule: "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition." }),
  // The Goliath walk (2026-09-25, ruled: "Build a proxy"): the check to END the Grappled condition
  // is not a roll the module can tell from any other — so while the Goliath IS Grappled, its
  // Athletics and Acrobatics checks (the escape's two skills) count as the escape (a bend, RULINGS'
  // register). The pack's own Powerful Build effect carries the carrying-capacity half alone.
  "Powerful Build": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Goliath",
    checks: "advantage", checksWhen: Object.freeze({ statuses: Object.freeze(["grappled"]), skills: Object.freeze(["ath", "acr"]) }),
    caveat: "counted — while Grappled, an Athletics or Acrobatics check counts as the escape",
    rule: "You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity." })
});

/** The table's rows, in the order the table reads them. */
export const EFFECT_KEYS = Object.freeze(Object.keys(EFFECT_BENDS));

/** The closed set the Effect Sources list is validated against — the table's names, lower-cased. */
export const EFFECT_NAMES = tableIndex(EFFECT_BENDS).names;


/**
 * The CONDITION SOURCES the `condition` reminder kind can read — the closed set the Condition
 * Sources list is validated against, DERIVED from the table above. Prone is NOT here — it is
 * its own kind, with geometry. The unit tests pin the size as the deliberate tripwire.
 */
export const CONDITION_STATUSES = new Set(CONDITION_KEYS);

/**
 * METAMAGIC (the metamagic pass, 2026-09-09 — DESIGN §6 *Metamagic*): the ten 2024 options,
 * keyed by the feat's own name. Each row says WHEN the option fits the spell being cast (a
 * named predicate over the spell's facts — decide/metamagic.js resolves it; the pack's option
 * carries its condition as PROSE, so the predicate lives here), at which MOMENT it is offered
 * (`cast`: a row in the cast dialog; `damage`: a fold after the spell's damage dice; `miss`: a
 * fold on a spell attack's miss), and what it PICKS beyond the tick (`protect`: creatures the
 * save leaves alone; `target`: one creature; `type`: a damage type; `twin`: one more target).
 * ⚠ NO COST HERE (N1): the cost is the option's own consumption target on the sheet, read live.
 * `apply` names the arithmetic the module does after the press, for the reader; the code is the
 * mechanism's. The rule text is read off the feat on the sheet at render (law 8), never copied.
 */
export const METAMAGIC = Object.freeze({
  "Careful Spell":    { key: "careful",    moment: "cast",   when: "save",       picks: "protect", apply: "the protected creatures leave the save demand",
    // A spell that chooses its targets (CHOSEN_AREAS) leaves the unchosen out already, so Careful
    // buys nothing there (user ruling 2026-09-24): the row greys, "you choose its targets".
    unless: "choosesTargets" },
  "Distant Spell":    { key: "distant",    moment: "cast",   when: "range",      picks: null,      apply: "the range the gate's reminder reads is doubled (Touch → 30 ft)" },
  "Empowered Spell":  { key: "empowered",  moment: "damage", when: "damageRoll", picks: "dice",    apply: "up to CHA-mod dice rerolled, the new rolls stand" },
  "Extended Spell":   { key: "extended",   moment: "cast",   when: "duration",   picks: null,      apply: "the effects' clock doubled (24 h cap); concentration saves with Advantage" },
  "Heightened Spell": { key: "heightened", moment: "cast",   when: "save",       picks: "target",  apply: "one target's save gate reads Disadvantage" },
  "Quickened Spell":  { key: "quickened",  moment: "cast",   when: "action",     picks: null,      apply: "a card line: Bonus Action (never policed — DESIGN §8)" },
  "Seeking Spell":    { key: "seeking",    moment: "miss",   when: "spellAttack", picks: null,     apply: "the d20 rerolled on a miss, the new roll stands" },
  "Subtle Spell":     { key: "subtle",     moment: "cast",   when: "any",        picks: null,      apply: "a card line: cast without components" },
  "Transmuted Spell": { key: "transmuted", moment: "cast",   when: "damageType", picks: "type",    apply: "the cast's damage parts carry the picked type" },
  "Twinned Spell":    { key: "twinned",    moment: "cast",   when: "scalesTargets", picks: "twin", apply: "one more creature in the target snapshot, the cast one level higher for targets" }
});
/** The damage types Transmuted Spell trades between — the option's own list. */
export const TRANSMUTED_TYPES = Object.freeze(["acid", "cold", "fire", "lightning", "poison", "thunder"]);
/**
 * TWINNED SPELL'S EXCEPTIONS to the data read (user rulings 2026-09-09, against the pack scan —
 * tools/probe-twinnable.mjs). The read is the pack's own statement — a target count that grows
 * with the cast's level — and it is right for the many; these are the few where the table's
 * reading of "can target an additional creature" differs from the data, or the data says
 * nothing. `except`: the count grows but the extra is a dart or a ray, not a target the way
 * Twinned means it (user: "remove Magic Missile … Scorching Ray, same reason"). `also`: the
 * text grants the extra creature but the pack's count is a plain number (Jump, 2024 PHB).
 */
export const TWINNED_EXCEPTIONS = Object.freeze({
  // Animate Dead, Create Undead, Cordon of Arrows and Tasha's Mind Whip: OUT by the user's word
  // (2026-09-09, "remove all as options") - the first three read as twinnable from the data (a
  // corpse or an arrow is the extra), the last is not in the PHB pack at all.
  except: Object.freeze(["Magic Missile", "Scorching Ray", "Animate Dead", "Create Undead", "Cordon of Arrows", "Tasha's Mind Whip"]),
  also: Object.freeze(["Jump"])
});
const METAMAGIC_NAMES = tableIndex(METAMAGIC).names;

/**
 * THE DAMAGE DICE, ROLLED TWICE (Slice A, ruled 2026-09-24 off prototypes/slice-a.html): a feature
 * that lets the attacker roll a weapon's damage dice a second time and use either roll. The popup
 * asks only WHETHER to use it on this hit; on yes the weapon's dice — every die of the activity's
 * own damage rolls, the doubled set on a crit, never a modifier and never a rider — are rolled
 * again AS A SET, and the higher set total stands with no second question (damage-either.js the
 * machine, decide/damage-dice.js the arithmetic). One customer today.
 *   key     the once-per-turn chit's riderKey (TURN_CHITS `rider`, the clock riders' shape)
 *   weapon  true — "when you hit a target with a weapon": a weapon item only
 * Once per turn is counted only for a combatant (RULINGS *Chips and clocks*); out of combat
 * every hit offers. Membership is the Damage Rolled Twice list.
 * ⚠ NOT A KIND — the R4 tripwire does not move for it (ARCHITECTURE §11 step 3's test, 2026-09-24):
 * one table read by ONE machine, rows of data, the CLOCK_RIDERS / DAMAGE_SHIELDS / METAMAGIC shape.
 * Nothing dispatches on a kind column; a second customer is a row here and zero code.
 */
export const DAMAGE_EITHER = Object.freeze({
  "Savage Attacker": Object.freeze({ key: "savage-attacker", weapon: true,
    rule: "Once per turn when you hit a target with a weapon, you can roll the weapon’s damage dice twice and use either roll against the target.",
    from: "Origin feat" })
});
const DAMAGE_EITHER_NAMES = tableIndex(DAMAGE_EITHER).names;

/**
 * THE HEALING REROLLS (the origin feats, 2026-09-25 — user: "use the empower spell form as a
 * baseline listing all roll numbers, the ones, and select the ones to replace"; "make sure the
 * healer feat itself gets the 1 popup too not just spells"; "1s ticked"): a feature that lets its
 * owner reroll a healing die that shows a given face. The roll's dice are shown as Empowered
 * Spell's chips, the matching faces pickable and ticked; Reroll rolls them again and the new faces
 * stand (heal-rerolls.js the machine, decide/damage-dice.js the patch). The healing waits on the
 * answer, so it lands once.
 *   reroll  the face that may be rerolled (Healer: a 1)
 *   spells  true — a healing SPELL the owner casts asks
 *   own     true — the feature's OWN healing asks (Battle Medic); the pack's `r1` in those formulas
 *           is taken off at the roll so the popup, not the formula, rerolls it
 * ⚠ NOT A KIND — one table read by one machine (the DAMAGE_EITHER shape); a second customer is a row.
 */
export const HEAL_REROLLS = Object.freeze({
  "Healer": Object.freeze({ reroll: 1, spells: true, own: true,
    rule: "Healing Rerolls. Whenever you roll a die to determine the number of Hit Points you restore with a spell or with this feat’s Battle Medic benefit, you can reroll the die if it rolls a 1, and you must use the new roll.",
    from: "Origin feat (Hermit)" })
});
const HEAL_REROLL_NAMES = tableIndex(HEAL_REROLLS).names;

/**
 * THE INITIATIVE SWAPS (the origin feats, 2026-09-25 — user: "initiative swap should have a form
 * after initiative all roll, list non incapacitated allies, each persons initiative, and they can
 * select which to swap, and then swap yes no buttons"; "alert pick is enough"): a feature that lets
 * its owner trade Initiative with a willing ally right after Initiative is rolled. Once every
 * combatant has an Initiative the owner is asked, once per combat; the allies listed are those on
 * the owner's side who are not Incapacitated, each with their Initiative; Swap exchanges the two
 * numbers in the tracker (initiative-swap.js). The owner's pick is the willingness (ruled).
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const INITIATIVE_SWAPS = Object.freeze({
  "Alert": Object.freeze({
    rule: "Initiative Swap. Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can’t make this swap if you or the ally has the Incapacitated condition.",
    from: "Origin feat (Criminal, Guard)" })
});
const INITIATIVE_SWAP_NAMES = tableIndex(INITIATIVE_SWAPS).names;

/**
 * THE UNARMED STRIKE DICE (the origin-feat walk, 2026-09-25 — user, on the plain Unarmed Strike
 * always dealing 1 + Str beside Tavern Brawler: "Module swaps it" — "but give some kind of notice
 * somewhere"): a feature whose owner's Unarmed Strike deals a die "instead of the normal damage".
 * The pack ships that die on the FEATURE's own unarmed attack (Tavern Brawler's "Enhanced Unarmed
 * Strike", `1d4r1 + @abilities.str.mod`), so a player who presses the sheet's plain Unarmed Strike
 * rolled the flat 1 + Str. unarmed-dice.js swaps the formula in at `preRollDamageV2` — READ from
 * the feature's own unarmed attack (hit-riders.js's upgrade rule: the number is always the one the
 * content ships), never transcribed here — and the damage card says so in one line. A strike that
 * already rolls a die (a Monk's Martial Arts) is left alone: the rule is "can … instead", and the
 * die it has is the table's call, not ours. The swap is never lower (a d4's 1 + Str is the flat
 * number), so nothing is asked.
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const UNARMED_DICE = Object.freeze({
  "Tavern Brawler": Object.freeze({
    rule: "Enhanced Unarmed Strike. When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d4 plus your Strength modifier instead of the normal damage of an Unarmed Strike.",
    from: "Origin feat (Sailor)" })
});
const UNARMED_DICE_NAMES = tableIndex(UNARMED_DICE).names;

/**
 * THE R4 TRIPWIRE, AS DATA (DESIGN.md R4, ARCHITECTURE §6).
 *
 * R4's bargain is that a new ABILITY costs a data entry and zero code, and that this is safe
 * because every axis it keys on is a closed enumerated set. The bargain has a stated
 * abandonment condition: *if new KINDS start arriving faster than one per phase, stop adding
 * kinds and adopt a conditions library instead.* That condition was unmeasurable — nobody could
 * state the rate, so the tripwire could never actually fire.
 *
 * This is the measurement. Every closed kind set the module owns, in one place, with the size
 * of the system enum it mirrors where such an enum exists. `tools/check-registry.mjs` prints it
 * and pins the total, so ADDING A KIND FAILS THE GATE until someone changes the pin on purpose.
 * That is the whole mechanism: not a rule against new kinds, a rule against *unnoticed* ones.
 *
 * ⚠ `system` is the size of the dnd5e enum this set mirrors, or null where the kind is the
 * MODULE'S OWN invention and no system enum exists to check it against. Only masteries mirror
 * one. That distinction is the honest answer to "registries carry their kind against a closed
 * set, checkable against the system's own enums": it is checkable for exactly one of the four,
 * it is already checked there (tools/check-mastery-rules.mjs, live, against
 * CONFIG.DND5E.weaponMasteries), and for the other three there is nothing to check against
 * because the system has no concept of an "interrupt kind" or a "fold kind" at all.
 */
export const KIND_SETS = [
  { name: "interrupt", owner: "hold/index.js", kinds: INTERRUPT_KINDS, system: null,
    note: "what a held reaction changes about an attack already rolled — the AC, the damage, or "
      + "(2026-09-24, Slice A) the roll itself: Disadvantage after the hit showed" },
  { name: "maneuverFold", owner: "precision.js · riposte.js · hew.js · bash-offer.js · command.js", kinds: MANEUVER_KINDS, system: null,
    note: "how a listed feat folds into a resolved attack — D8 says this set is the one under pressure; "
      + "`command` (2026-09-05) is Riposte's driven attack with the attacker changed to an ally; "
      + "`shove` (2026-09-25) is the bash offer on an Unarmed Strike with no save — Tavern Brawler's push" },
  { name: "d20Fold", owner: "d20-folds.js", kinds: D20_FOLD_KINDS, system: null,
    note: "where the marker lives and how it is spent — the three surveyed features (v1.23.0); "
      + "the ARITHMETIC is shared and already shipped with D8, so only the spend earns a kind" },
  { name: "volley", owner: "volleys.js", kinds: VOLLEY_KINDS, system: null,
    note: "how a multi-projectile spell resolves: aggregated damage, or independent attacks" },
  { name: "mastery", owner: "mastery.js", kinds: MASTERY_KINDS, system: 8,
    note: "7 of the system's 8; nick is deliberately native (action economy, ruling 1)" },
  { name: "reminder", owner: "reminders.js", kinds: REMINDER_KINDS, system: null,
    note: "what the gate can READ as a source of Advantage/Disadvantage before an attack roll — "
      + "a chip on the target, a chip on the attacker, a status with geometry (Stage 2, 2026-09-01), "
      + "the condition table, and a ranged attack's own range (2026-09-02)" },
  { name: "emanation", owner: "emanations.js", kinds: EMANATION_KINDS, system: null,
    note: "how an emanation lives: always on with a feature's source token, or cast and adopted from "
      + "the template the system placed (2026-09-03) — the platform's Region keeps geometry and clock" }
];

/** Split a comma list into trimmed, non-empty chunks — the shape every list setting wears. */
const chunks = raw => String(raw ?? "").split(",").map(s => s.trim()).filter(Boolean);

/** Split one `A:B` chunk into its trimmed halves. */
const pair = chunk => chunk.split(":").map(s => s?.trim());
/** A whole chunk as its one column — for lists whose names carry colons (the effect table's). */
const whole = chunk => [chunk.trim()];

/**
 * THE LIST SPECS — one per membership list, keyed by the name the EDGE wrapper uses.
 *
 * Fields:
 *   label       the setting's own UI name, so a warning names what the reader must go and fix.
 *   setting     the `S` key, as a STRING (see the header: declaring, not reading).
 *   columns     the `A:B` halves in order. Every column is REQUIRED unless it is the kind
 *               column of a spec that declares a fallback — one rule, no per-list exceptions.
 *   kindColumn  which column is validated against a closed set, or null.
 *   kinds       that closed set, or null.
 *   fallback    ⚠ a DECLARED, WARNED substitution for an unrecognised kind, or null to drop.
 *   default     the SHIPPED default for that setting.
 *
 * ⚠ THE DEFAULTS LIVE HERE, WITH THE PARSER THAT HAS TO ACCEPT THEM (ARCHITECTURE §6, 2026-08-23), and
 * settings.js reads them when it registers. They used to sit inline in the register blocks,
 * where the static gate could only reach them by scraping source with a regex — which the
 * check itself flagged as "a heuristic, and a fragile one". It was: the regex ended a
 * double-quoted default at the apostrophe in "Stone's Endurance", silently truncating the
 * interrupt list to two thirds of itself. That went unnoticed only because the old check asked
 * nothing stronger than "is it comma-shaped". A shipped default that its own parser rejects
 * disables a feature for every fresh world, so the gate now imports the real string.
 *
 * ⚠ Only `interrupt` declares a fallback, and it is the one deliberate exception to
 * ARCHITECTURE §6 rule 6 ("dropped with a warning, never guessed"). The reason is a table
 * outcome rather than a taste: an interrupt whose kind is mistyped is STILL a reaction worth
 * pausing for, and `ac` is the conservative reading — whereas a fold with no recognised kind
 * has no machine to run at all. What Phase 3 changed is that the exception is now *declared
 * and warned* instead of buried in a parser body, so a typo no longer looks like a working
 * entry. §6 rule 6 was amended to admit a declared fallback; an UNDECLARED one is still a bug.
 */
export const LIST_SPECS = {
  interrupt: {
    label: "Interrupt List", setting: "interruptList",
    columns: ["name", "kind"], kindColumn: "kind", kinds: INTERRUPT_KINDS, fallback: "ac",
    // ⚠ Riposte is deliberately ABSENT: it triggers on a MISS (the hold offers on hits) and it
    // is not an AC boost, so an entry here can only ever produce the every-hit nonsense hold
    // that was struck from the live worlds at v1.16.0. It lives in the Maneuver Folds list
    // instead. This default carried it until v1.19.0 — the strike missed the registered
    // default, so a fresh world or Reset Defaults kept re-seeding the bug.
    // Lucky, Warding Flare and Shadowy Dodge (Slice A, 2026-09-24): the `roll` kind — the rows
    // beside Shield in the popup that rescues a hit (INTERRUPT_ROLLS carries their cost shapes).
    default: "Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, "
      + "Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, "
      + "Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage, "
      + "Lucky:roll, Warding Flare:roll, Shadowy Dodge:roll"
  },
  block: {
    label: "Block List", setting: "blockList",
    columns: ["spell", "reaction"], kindColumn: null, kinds: null, fallback: null,
    default: "Magic Missile:Shield"
  },
  maneuverFolds: {
    label: "Maneuver Folds", setting: "maneuverFolds",
    columns: ["name", "kind"], kindColumn: "kind", kinds: MANEUVER_KINDS, fallback: null,
    default: "Precision Attack:precision, Riposte:riposte, Shield Master:interpose, "
      + "Shield Master:bash, Great Weapon Master:hew, Commander's Strike:command, Tavern Brawler:shove"
  },
  d20Folds: {
    label: "D20 Folds", setting: "d20Folds",
    columns: ["name", "kind"], kindColumn: "kind", kinds: D20_FOLD_KINDS, fallback: null,
    // ⚠ THE `name` COLUMN IS A LOOKUP KEY, NOT A DISPLAY NAME (recut 2026-08-23 after the
    // first table pass). What the card and popup SAY comes from the kind — `KIND_LABEL` in
    // d20-folds.js — and the two genuinely differ:
    //   tactical  → an ITEM on the actor with this name ("Tactical Mind"). Key and label agree.
    //   bardic    → an ACTIVE EFFECT with this name, which the system calls "Inspired" (the
    //               effect the bard's Inspire activity applies, NOT the bard's own feat).
    //               ⚠ Key and label DISAGREE, and must: nobody at the table calls the feature
    //               "Inspired", so a card announcing "Inspired — spent" names a thing the rules
    //               do not have. It is Bardic Inspiration on screen and "Inspired" in the find.
    //   heroic    → NO LOOKUP AT ALL. The marker is `system.attributes.inspiration`, a boolean
    //               with no document behind it, so this string is never matched against
    //               anything. It is required only because every column is required.
    // ⚠ v1 used this column for BOTH jobs and the table read "Inspired" on every bardic card.
    // Splitting them is why renaming the effect here changes what is FOUND and never what is
    // said — which is the right way round.
    // Ambush and Tactical Assessment (2026-09-05) are the `tactical` SPEND with a scope of their
    // own (SUPERIORITY_FOLDS) — the name is the lookup key and the label both.
    // Seeking Spell (the metamagic pass, Stage 4, 2026-09-09): a REROLL like heroic, on a SPELL
    // attack's miss, paid from Font of Magic by hand — the item is the lookup key, and the
    // Metamagic list must admit it too (the option's own switch).
    default: "Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic, Ambush:tactical, Tactical Assessment:tactical, Seeking Spell:seeking, Lucky:advantage"
  },
  rider: {
    label: "Rider List", setting: "riderList",
    columns: ["name"], kindColumn: null, kinds: null, fallback: null,
    default: "hunters-mark, hex, great-old-one-hex"
  },
  riderUpgrade: {
    label: "Rider Upgrades", setting: "riderUpgrades",
    columns: ["feature", "rider"], kindColumn: null, kinds: null, fallback: null,
    default: "foe-slayer:hunters-mark"
  },
  reminders: {
    label: "Reminder Sources", setting: "reminderList",
    // ⚠ The list IS the switch (the v1.19.0 idiom): every entry is a kind the gate knows how to
    // read, and an empty list turns the gate off. Unknown kinds are dropped with a warning.
    columns: ["kind"], kindColumn: "kind", kinds: REMINDER_KINDS, fallback: null,
    default: "vex, sap, prone, condition, range, effect, sneak, buy"
  },
  conditions: {
    label: "Condition Sources", setting: "conditionList",
    // Which rows of the table the gate reads. An entry is a status id the system uses; the list
    // is the switch for the `condition` kind, one condition at a time.
    // ⚠ `membership: true` — this closed set validates the list but is NOT a kind set, and the
    // R4 tripwire deliberately does not count it: the entries are ROWS of one table read by ONE
    // mechanism (decide/reminders.js `conditionSources`), and another row costs a data row and
    // nothing else — R4's definition of membership. The kind it belongs to is `condition` in
    // REMINDER_KINDS, which IS counted. The registry unit test pins this reading.
    columns: ["kind"], kindColumn: "kind", kinds: CONDITION_STATUSES, fallback: null, membership: true,
    // Every row of the table ships ON — the default is the table, not a copy of it.
    default: CONDITION_KEYS.join(", ")
  },
  clockRiders: {
    label: "Clock Riders", setting: "clockRiderList",
    // Which rows of the clock-rider table fold in — the FEATURE names, whole-chunk (colons in
    // "Blessed Strikes: Divine Strike"), case-insensitive. Membership over CLOCK_RIDERS; the
    // mechanism is clock-riders.js.
    columns: ["kind"], kindColumn: "kind", kinds: CLOCK_RIDER_NAMES, fallback: null, membership: true, whole: true,
    default: Object.values(CLOCK_RIDERS).map(row => row.feature).join(", ")
  },
  effects: {
    label: "Effect Sources", setting: "effectList",
    // Which rows of the effect table the gate reads — an active effect or a feature by NAME,
    // the packs' own names, colons and all, so the list is parsed whole-chunk and matched
    // case-insensitively. Membership, like the condition table: the kind is `effect`.
    columns: ["kind"], kindColumn: "kind", kinds: EFFECT_NAMES, fallback: null, membership: true, whole: true,
    default: EFFECT_KEYS.join(", ")
  },
  hitMenu: {
    label: "Hit Menu", setting: "hitMenuList",
    // Which rows of the hit-option table the damage offer shows — the FEATURE names, whole-chunk,
    // case-insensitive. Membership over HIT_OPTIONS; the mechanism is hit-menu.js.
    columns: ["kind"], kindColumn: "kind", kinds: HIT_OPTION_NAMES, fallback: null, membership: true, whole: true,
    default: Object.values(HIT_OPTIONS).map(row => row.feature).join(", ")
  },
  damageShields: {
    label: "Damage Shields", setting: "damageShieldList",
    // Which rows of the damage-shield table strike — the ITEM names, whole-chunk, case-insensitive.
    // Membership over DAMAGE_SHIELDS; the mechanism is damage-shields.js.
    columns: ["kind"], kindColumn: "kind", kinds: DAMAGE_SHIELD_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DAMAGE_SHIELDS).join(", ")
  },
  superiorityUses: {
    label: "Superiority Uses", setting: "superiorityUseList",
    // Which rows of the superiority-use table the module plays — the FEATURE names, whole-chunk,
    // case-insensitive. Membership over SUPERIORITY_USES; the mechanism is superiority-uses.js.
    columns: ["kind"], kindColumn: "kind", kinds: SUPERIORITY_USE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(SUPERIORITY_USES).join(", ")
  },
  effectChoices: {
    label: "Effect Choices", setting: "effectChoiceList",
    // Which rows of the effect-choice table ask at the cast — the ITEM names, whole-chunk,
    // case-insensitive. Membership over EFFECT_CHOICES; the mechanism is cast.js.
    columns: ["kind"], kindColumn: "kind", kinds: EFFECT_CHOICE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(EFFECT_CHOICES).join(", ")
  },
  metamagic: {
    label: "Metamagic", setting: "metamagicList",
    // Which rows of the metamagic table the module plays — the FEAT names, whole-chunk,
    // case-insensitive. Membership over METAMAGIC (not a kind set: one table, one mechanism,
    // metamagic.js — the conditions idiom); the list is the switch, an option removed stays the
    // player's to play by hand.
    columns: ["kind"], kindColumn: "kind", kinds: METAMAGIC_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(METAMAGIC).join(", ")
  },
  damageSaves: {
    label: "Damage Saves", setting: "damageSaveList",
    // Which rows of the damage-save table demand their save after the damage — the ITEM names,
    // whole-chunk, case-insensitive. Membership over DAMAGE_SAVES; the mechanism is damage-casts.js.
    columns: ["kind"], kindColumn: "kind", kinds: DAMAGE_SAVE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DAMAGE_SAVES).join(", ")
  },
  emanations: {
    label: "Emanations", setting: "emanationList",
    // Which rows of the emanation table stand — the ITEM names, whole-chunk, case-insensitive.
    // Membership over EMANATIONS; the mechanism is emanations.js.
    columns: ["kind"], kindColumn: "kind", kinds: EMANATION_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(EMANATIONS).join(", ")
  },
  spentAreas: {
    label: "Spent Areas", setting: "spentAreaList",
    // Which rows of the spent-area table are swept at the last verdict whatever their data says —
    // the ITEM names, whole-chunk, case-insensitive. Membership over SPENT_AREAS; the mechanism is
    // the sweep in saves/areas.js (and the empty-instant stamp in saves/demand.js).
    columns: ["kind"], kindColumn: "kind", kinds: SPENT_AREA_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(SPENT_AREAS).join(", ")
  },
  chosenAreas: {
    label: "Chosen Areas", setting: "chosenAreaList",
    // Which rows of the chosen-area table ask their caster who they affect — the ITEM names,
    // whole-chunk, case-insensitive. Membership over CHOSEN_AREAS; the mechanism is the demand's
    // reach in saves/demand.js and the ask at the area in metamagic.js.
    columns: ["kind"], kindColumn: "kind", kinds: CHOSEN_AREA_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(CHOSEN_AREAS).join(", ")
  },
  initiativeSwaps: {
    label: "Initiative Swaps", setting: "initiativeSwapList",
    // Which rows of the initiative-swap table ask once Initiative is rolled — the FEATURE names,
    // whole-chunk, case-insensitive. Membership over INITIATIVE_SWAPS; the mechanism is
    // initiative-swap.js (the origin feats, 2026-09-25). The list is the switch.
    columns: ["kind"], kindColumn: "kind", kinds: INITIATIVE_SWAP_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(INITIATIVE_SWAPS).join(", ")
  },
  unarmedDice: {
    label: "Unarmed Strike Dice", setting: "unarmedDiceList",
    // Which rows of the unarmed-dice table swap the plain Unarmed Strike's damage — the FEATURE
    // names, whole-chunk, case-insensitive. Membership over UNARMED_DICE; the mechanism is
    // unarmed-dice.js (the origin-feat walk, 2026-09-25). The list is the switch.
    columns: ["kind"], kindColumn: "kind", kinds: UNARMED_DICE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(UNARMED_DICE).join(", ")
  },
  healRerolls: {
    label: "Healing Rerolls", setting: "healRerollList",
    // Which rows of the healing-reroll table ask on a healing roll — the FEATURE names, whole-chunk,
    // case-insensitive. Membership over HEAL_REROLLS; the mechanism is heal-rerolls.js (the origin
    // feats, 2026-09-25). The list is the switch.
    columns: ["kind"], kindColumn: "kind", kinds: HEAL_REROLL_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(HEAL_REROLLS).join(", ")
  },
  damageEither: {
    label: "Damage Rolled Twice", setting: "damageEitherList",
    // Which rows of the rolled-twice table offer on a weapon hit — the FEATURE names, whole-chunk,
    // case-insensitive. Membership over DAMAGE_EITHER; the mechanism is damage-either.js (Slice A,
    // 2026-09-24). The list is the switch (ARCHITECTURE §8 rule 1): an empty list offers nothing.
    columns: ["kind"], kindColumn: "kind", kinds: DAMAGE_EITHER_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DAMAGE_EITHER).join(", ")
  },
  tokenLights: {
    label: "Token Lights", setting: "tokenLightList",
    // Which rows of the token-light table shed their light — the ROW names, whole-chunk,
    // case-insensitive. Membership over TOKEN_LIGHTS; the mechanism is token-lights.js (the
    // Aasimar walk, 2026-09-25). The list is the switch: an empty list lights nothing.
    columns: ["kind"], kindColumn: "kind", kinds: TOKEN_LIGHT_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(TOKEN_LIGHTS).join(", ")
  },
  tokenSenses: {
    label: "Token Senses", setting: "tokenSenseList",
    // Which rows of the token-sense table change the token's vision — the ROW names, whole-chunk,
    // case-insensitive. Membership over TOKEN_SENSES; the mechanism is token-lights.js (the Dwarf
    // walk, 2026-09-25). The list is the switch: an empty list changes nothing.
    columns: ["kind"], kindColumn: "kind", kinds: TOKEN_SENSE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(TOKEN_SENSES).join(", ")
  },
  tokenSizes: {
    label: "Token Sizes", setting: "tokenSizeList",
    // Which rows of the token-size table resize the token — the ROW names, whole-chunk ("Enlarge/
    // Reduce" carries a slash), case-insensitive. Membership over TOKEN_SIZES; the mechanism is
    // token-lights.js (the Goliath walk, 2026-09-25). The list is the switch.
    columns: ["kind"], kindColumn: "kind", kinds: TOKEN_SIZE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(TOKEN_SIZES).join(", ")
  },
  dropToOne: {
    label: "Drop to 1 HP", setting: "dropToOneList",
    // Which rows of the drop-to-1 table act at a drop to 0 — the ROW names, whole-chunk,
    // case-insensitive. Membership over DROP_TO_ONE; the mechanism is drop-to-one.js (the Orc walk,
    // 2026-09-25). The list is the switch.
    columns: ["kind"], kindColumn: "kind", kinds: DROP_TO_ONE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DROP_TO_ONE).join(", ")
  },
  restGrants: {
    label: "Rest Grants", setting: "restGrantList",
    // Which rows of the rest-grant table give their grant at a rest — the FEATURE names, whole-chunk,
    // case-insensitive. Membership over REST_GRANTS; the mechanism is rest-grants.js (the Human
    // walk, 2026-09-25). The list is the switch.
    columns: ["kind"], kindColumn: "kind", kinds: REST_GRANT_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(REST_GRANTS).join(", ")
  },
  rebukes: {
    label: "Rebukes", setting: "rebukeList",
    // Which reactions to damage are offered at the damager — the ITEM names, whole-chunk,
    // case-insensitive. Membership over REBUKES; the mechanism is rebukes.js (the Goliath walk,
    // 2026-09-25). The list is the switch: an empty list offers nothing.
    columns: ["kind"], kindColumn: "kind", kinds: REBUKE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(REBUKES).join(", ")
  },
  cardChips: {
    label: "Card Chips", setting: "cardChipList",
    // Which rows of the card-chip table a cast's card offers — the ROW names, whole-chunk,
    // case-insensitive. Membership over CARD_CHIPS; the mechanism is use-chips.js (the Gnome
    // walk, 2026-09-25). The list is the switch: an empty list offers nothing.
    columns: ["kind"], kindColumn: "kind", kinds: CARD_CHIP_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(CARD_CHIPS).join(", ")
  }
};

/**
 * Parse one list setting against its spec.
 *
 * Returns `{ entries, rejects }` rather than warning: the warn-once bookkeeping is a side
 * effect that owns a console and a seen-set, so it belongs to the EDGE caller (settings.js).
 * Each reject carries `{ chunk, action, detail }` where action is `"dropped"` (the entry is
 * gone) or `"defaulted"` (the entry survives with the spec's declared fallback) — the EDGE
 * warns on both, because a silently corrected entry is still a setting somebody must fix.
 */
export function parseList(spec, raw) {
  const entries = [];
  const rejects = [];
  for ( const chunk of chunks(raw) ) {
    const halves = spec.whole ? whole(chunk) : pair(chunk);
    const entry = {};
    spec.columns.forEach((col, i) => { entry[col] = halves[i]; });

    // Required columns. The kind column is exempt only where a fallback stands ready for it.
    const missing = spec.columns.find(col =>
      !entry[col] && !(col === spec.kindColumn && spec.fallback));
    if ( missing ) {
      rejects.push({ chunk, action: "dropped", detail: `no ${missing}` });
      continue;
    }

    if ( spec.kindColumn ) {
      const kind = entry[spec.kindColumn]?.toLowerCase();
      if ( spec.kinds.has(kind) ) entry[spec.kindColumn] = kind;
      else if ( spec.fallback ) {
        entry[spec.kindColumn] = spec.fallback;
        rejects.push({ chunk, action: "defaulted",
          detail: kind ? `"${kind}" is not a kind` : "no kind given" });
      } else {
        rejects.push({ chunk, action: "dropped",
          detail: kind ? `"${kind}" is not a kind` : "no kind given" });
        continue;
      }
    }
    entries.push(entry);
  }
  return { entries, rejects };
}

/**
 * The one-line human sentence for a reject — built here, beside the rule that produced it, so
 * the EDGE wrapper owns only the seen-set and the console. Names the allowed kinds, because a
 * warning that does not say what WOULD have worked costs its reader another trip to the docs.
 */
export function rejectMessage(spec, reject) {
  const allowed = spec.kinds ? ` (${[...spec.kinds].join("/")})` : "";
  return (reject.action === "defaulted")
    ? `${spec.label}: "${reject.chunk}" — ${reject.detail}${allowed}; read as "${spec.fallback}", never guessed further.`
    : `${spec.label}: "${reject.chunk}" — ${reject.detail}${allowed}; ignored, never guessed.`;
}
