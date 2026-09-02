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
 *   effect an ability on either sheet that bends the roll — an active effect or a feature by
 *          name, a row of EFFECT_BENDS (user, 2026-09-02); WHICH rows count is the Effect
 *          Sources list, membership like the condition table
 * The gate never SETS a mode (DESIGN R-A): it lists every source and the net, and a human presses.
 * Membership — which of these a table wants nagged about — is the Reminder Sources list.
 */
export const REMINDER_KINDS = new Set(["vex", "sap", "prone", "condition", "range", "effect"]);

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
 *             (the target at or below half / short of full), "targetGrappled" — a fact the
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
 *   counted?: boolean, judge?: "bloodied"|"targetBloodied"|"targetDamaged"|"targetGrappled", spend?: "attack",
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
    rule: "In the first round of a combat, it has advantage on attack rolls against any creature it has surprised." })
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
    default: "vex, sap, prone, condition, range"
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
