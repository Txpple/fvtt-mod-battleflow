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
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew"]);

/** The closed set of interrupt kinds — what a held reaction changes about an attack. */
export const INTERRUPT_KINDS = new Set(["ac", "damage"]);

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
    caveat: "the target must be Large or smaller",
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
 */
export const SAVE_PRESSES = Object.freeze({
  "Web": Object.freeze({ status: "restrained", onFail: true,
    rule: "Each creature that starts its turn in the webs or that enters them during its turn must succeed on a Dexterity saving throw or have the Restrained condition while in the webs or until it breaks free." })
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
  "Heated Metal": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Heat Metal",
    rule: "If it doesn’t drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn." }),
  "Averse": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Aversion to Fire (monsters)",
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
  "Goaded": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Battle Master, Goading Attack",
    caveat: "counted — press Normal if this attack is at the one who goaded it",
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
  "Feinting Attack": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Battle Master",
    caveat: "counted — press Normal if this attack is not at the feinted target",
    rule: "You have Advantage on your next attack roll against that target this turn." }),
  "Distracted": Object.freeze({ attacker: null, target: "advantage", scope: "any", spend: "attack", from: "Battle Master, Distracting Strike",
    caveat: "counted — press Normal if you are the one who distracted it",
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
    note: "how a listed feat folds into a resolved attack — D8 says this set is the one under pressure" },
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
      + "the condition table, and a ranged attack's own range (2026-09-02)" }
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
      + "Shield Master:bash, Great Weapon Master:hew"
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
    default: "Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic"
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
    default: "vex, sap, prone, condition, range, sneak"
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
