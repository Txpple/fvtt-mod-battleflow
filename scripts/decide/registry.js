// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the membership lists, one shape.
 *
 * Moved verbatim out of hold.js, maneuvers.js and hit-riders.js (PLAN.md Phase 2, "move, do
 * not rewrite"), then unified here (PLAN.md Phase 3). Strings in, entries out — no `game`, no
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
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew", "command"]);

/** The closed set of interrupt kinds — what a held reaction changes about an attack. */
export const INTERRUPT_KINDS = new Set(["ac", "damage"]);

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
 */
export const INTERRUPT_REDUCTIONS = Object.freeze({
  "Parry": Object.freeze({ activity: "Heal", pool: true,
    rule: "When another creature damages you with a melee attack roll, you can take a Reaction and expend one Superiority Die to reduce the damage by the number you roll on your Superiority Die plus your Strength or Dexterity modifier (your choice).",
    from: "Fighter — Battle Master 3" })
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
export const D20_FOLD_KINDS = new Set(["heroic", "tactical", "bardic"]);

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
 * against the system's own rules journal by tools/probe-mastery-rules.mjs (2026-08-21,
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
export const REMINDER_KINDS = new Set(["vex", "sap", "prone", "condition", "range", "effect", "sneak"]);

/**
 * SNEAK ATTACK (user, 2026-09-02 — the prototype *Sneak Attack, Cunningly*, built as drawn): the
 * feature by NAME on the attacker's sheet, its dice read off the feature's own damage activity
 * (`@scale.rogue.sneak-attack`, resolved on the sheet — never a table of dice by level), and its
 * rule quoted verbatim from the 2024 PHB pack. The gate's seventh kind: a CHOICE beside the
 * roll — a checkbox in the section, because the roll still needs its Advantage / Normal press.
 * The PLAYER decides whether the conditions hold (user: "the player can determine if they have
 * the conditions"); the module reads what it can (the weapon is Finesse or ranged, the roll's
 * net) and says what it cannot (an ally within 5 feet). The DAMAGE is automated: the dice ride
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
 *   uses      true — the activity carries limited uses: one is consumed, none left means not offered
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
    from: "Barbarian — Zealot 3" })
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

/** The clock riders' feature names, lower-cased — the closed set the Clock Riders list is validated against. */
export const CLOCK_RIDER_NAMES = new Set(Object.values(CLOCK_RIDERS).map(r => r.feature.toLowerCase()));

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
 *   (no caveat lines — user, 2026-09-04: "just the rule tick is needed"; what the rules leave to the player is in the rule)
 *
 * Membership is the Hit Menu list (the option names). Precision Attack and Riposte are FOLDS
 * (maneuvers.js) and the nine remaining maneuvers are other moments (BACKLOG).
 */
export const HIT_GROUPS = Object.freeze({
  "combat-superiority": Object.freeze({ feature: "Combat Superiority", label: "Combat Superiority", max: 1,
    dieLabel: "Superiority Die", from: "Fighter — Battle Master 3",
    rule: "Many maneuvers enhance an attack in some way. You can use only one maneuver per attack.",
    dc: "If a maneuver requires a saving throw, the DC equals 8 plus your Strength or Dexterity modifier (your choice) and Proficiency Bonus." })
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
    rule: "When you hit a creature with a melee attack roll using a weapon or an Unarmed Strike, you can expend one Superiority Die to attempt to damage another creature. Choose another creature within 5 feet of the original target and within your reach. If the original attack roll would hit the second creature, it takes damage equal to the number you roll on your Superiority Die. The damage is of the same type dealt by the original attack." })
});

/** The hit options' feature names, lower-cased — the closed set the Hit Menu list is validated against. */
export const HIT_OPTION_NAMES = new Set(Object.values(HIT_OPTIONS).map(r => r.feature.toLowerCase()));

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
export const SUPERIORITY_USE_NAMES = new Set(Object.keys(SUPERIORITY_USES).map(n => n.toLowerCase()));

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
    caveat: "the pack's effect carries the Poison Resistance; the Advantage on saves against those conditions is the table's",
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
    caveat: "the pack's effect carries no change — the Advantage on saves against spells, and none instead of half, are the table's",
    rule: "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have Advantage on saving throws against spells and other magical effects. When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save.",
    from: "Cleric / Paladin spell, level 5 (Concentration, 10 minutes)" }),
  "Crusader's Mantle": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Crusader’s Mantle", incapacitated: false,
    rule: "You radiate a magical aura in a 30-foot Emanation. While in the aura, you and your allies each deal an extra 1d4 Radiant damage when hitting with a weapon or an Unarmed Strike.",
    from: "Paladin spell, level 3 (Concentration, 1 minute)" }),
  "Holy Aura": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Holy Protection", incapacitated: false,
    caveat: "the pack's effect carries the Advantage on saves (the save gate says so); attackers' Disadvantage and the Fiend/Undead save on a melee hit are the table's",
    rule: "For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving throws, and other creatures have Disadvantage on attack rolls against them. In addition, when a Fiend or an Undead hits an affected creature with a melee attack roll, the attacker must succeed on a Constitution saving throw or have the Blinded condition until the end of its next turn.",
    from: "Cleric spell, level 8 (Concentration, 1 minute)" })
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
export const DAMAGE_SHIELD_NAMES = new Set(Object.keys(DAMAGE_SHIELDS).map(n => n.toLowerCase()));

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
export const EFFECT_CHOICE_NAMES = new Set(Object.keys(EFFECT_CHOICES).map(n => n.toLowerCase()));

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
export const DAMAGE_SAVE_NAMES = new Set(Object.keys(DAMAGE_SAVES).map(n => n.toLowerCase()));

/** The two lifecycles an emanation can have — the closed set the R4 tripwire counts. */
export const EMANATION_KINDS = new Set(["feature", "spell"]);
/** The emanations' item names, lower-cased — the closed set the Emanations list is validated against. */
export const EMANATION_NAMES = new Set(Object.keys(EMANATIONS).map(n => n.toLowerCase()));

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
 *             an effect)
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
 *             (round one, and the target has not taken a turn — the combat clock) — a fact the
 *             module holds; the row fires only when it is true
 *   spend     "attack" — the rules end the effect on the next attack roll ("your next attack
 *             roll"): the spend hook uses it up with a receipt, exactly as Vex and Sap
 *   rule      the ability's own sentence, from the pack (enrichers rendered as plain words)
 *   from      where it comes from, for the reader
 *
 * ⚠ Names are the packs' own, colons and all ("Adv: Attacks & Saves") — the Effect Sources
 * list is parsed WHOLE-CHUNK for that reason (LIST_SPECS.effects.whole). Matching is
 * case-insensitive on both sides.
 *
 * @type {Readonly<Record<string, Readonly<{match?: "effect"|"feature", attacker: "advantage"|"disadvantage"|null,
 *   target: "advantage"|"disadvantage"|null, scope: "any"|"spell"|"weapon"|"melee"|"ranged", caveat?: string,
 *   counted?: boolean, judge?: "bloodied"|"targetBloodied"|"targetDamaged"|"targetGrappled"|"targetNotActed", spend?: "attack",
 *   rule: string, from: string}>>>}
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
  // --- B. counted, with a caveat the module cannot judge ------------------------------------
  "Vow of Enmity": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Paladin",
    caveat: "counted — press Normal if this attack is not at the sworn creature",
    rule: "You have Advantage on attack rolls against the creature for 1 minute or until you use this feature again." }),
  "Prey: Attack Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Marked as Prey (monsters)",
    caveat: "counted — press Normal if this attack is not at the marked creature",
    rule: "It has Advantage on attack rolls against the target until the start of its next turn." }),
  "Clairvoyant Combatant": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", from: "Clairvoyant Combatant",
    caveat: "counted — press Normal if the other creature is not the bonded one",
    rule: "On a failed save, the creature has Disadvantage on attack rolls against you, and you have Advantage on attack rolls against that creature for the duration of the bond." }),
  "Strike Fear: Terrify": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Strike Fear (Heroes of Faerûn)",
    caveat: "counted — press Normal if the target is no longer Frightened by you",
    rule: "While the target is Frightened in this way, you have Advantage on attack rolls against the target." }),
  "Compelled": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Compelled Duel",
    caveat: "counted — press Normal if this attack is at the one who compelled it",
    rule: "On a failed save, the target has Disadvantage on attack rolls against creatures other than you." }),
  "Goaded": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Battle Master, Goading Attack",
    rule: "The target must succeed on a Wisdom saving throw or have Disadvantage on attack rolls against targets other than you until the end of your next turn." }),
  "Taunted": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Steps of the Fey",
    caveat: "counted — press Normal if this attack is at the one who taunted it",
    rule: "Creatures within 5 feet of the space you left must succeed on a Wisdom saving throw or have Disadvantage on attack rolls against creatures other than you until the start of your next turn." }),
  "Cursed Attacks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Bestow Curse",
    caveat: "counted — press Normal if this attack is not at the caster",
    rule: "While cursed, the target has Disadvantage on attack rolls against you." }),
  "Protected": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good",
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
    caveat: "counted — press Normal if this attack is not at the feinted target",
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
  "Pack Tactics": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", from: "monsters",
    caveat: "counted — press Normal if no ally of the attacker is within 5 feet of the target",
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
    from: "Rogue — Assassin (Surprising Strikes)" })
});

/** The table's rows, in the order the table reads them. */
export const EFFECT_KEYS = Object.freeze(Object.keys(EFFECT_BENDS));

/** The closed set the Effect Sources list is validated against — the table's names, lower-cased. */
export const EFFECT_NAMES = new Set(EFFECT_KEYS.map(k => k.toLowerCase()));


/**
 * The CONDITION SOURCES the `condition` reminder kind can read — the closed set the Condition
 * Sources list is validated against, DERIVED from the table above. Prone is NOT here — it is
 * its own kind, with geometry. The unit tests pin the size as the deliberate tripwire.
 */
export const CONDITION_STATUSES = new Set(CONDITION_KEYS);

/**
 * THE R4 TRIPWIRE, AS DATA (DESIGN.md R4, PLAN.md Phase 3).
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
  { name: "interrupt", owner: "hold.js", kinds: INTERRUPT_KINDS, system: null,
    note: "what a held reaction changes about an attack already rolled" },
  { name: "maneuverFold", owner: "maneuvers.js", kinds: MANEUVER_KINDS, system: null,
    note: "how a listed feat folds into a resolved attack — D8 says this set is the one under pressure; "
      + "`command` (2026-09-05) is Riposte's driven attack with the attacker changed to an ally" },
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
 * ⚠ THE DEFAULTS LIVE HERE, WITH THE PARSER THAT HAS TO ACCEPT THEM (PLAN.md Phase 3), and
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
    default: "Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, "
      + "Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, "
      + "Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage"
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
      + "Shield Master:bash, Great Weapon Master:hew, Commander's Strike:command"
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
    default: "Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic, Ambush:tactical, Tactical Assessment:tactical"
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
    default: "vex, sap, prone, condition, range, effect, sneak"
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
