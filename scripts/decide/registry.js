// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the membership lists, one shape.
 *
 * Strings in, entries out — no `game`, no `setting()`, no globals, no imports. Every list is a SPEC
 * read by the one parser (ARCHITECTURE.md §6, the strict-parse contract); settings.js holds each
 * list's one-line EDGE wrapper that reads the setting. A spec names its setting KEY as a plain
 * string so the static gate can pair it with its registration and shipped default.
 * ⚠ A typo in a setting raises nothing: the entry drops and its feature silently dies. These
 * parsers are the only guard. Depend downward only: no machine, spine or core.js imports.
 */

/**
 * The closed set of maneuver fold kinds. Unknown kinds are DROPPED, never guessed.
 * `command`: Commander's Strike — an ALLY's Reaction attack with the fighter's die (Riposte's
 * driven attack, attacker changed). `shove`: a push offer on a hit with no save (bash-offer.js).
 */
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew", "command", "shove"]);

/**
 * The `shove` kind's rows, keyed by feat name: what hit qualifies and which once-per-turn mark it spends.
 *   on       "unarmed" (an Unarmed Strike) | a damage type the hit must deal
 *   reach    true — only a creature within 5 feet
 *   larger   the most sizes larger than the pusher the target may be (null: any)
 *   used     the attacker flag that marks the turn's use — each feat its own
 *   rule     RULE_TEXT's key for the popup's quote
 */
export const SHOVES = Object.freeze({
  "Tavern Brawler": Object.freeze({ on: "unarmed", reach: true, larger: null, used: "shoveUsed", rule: "shove" }),
  "Crusher": Object.freeze({ on: "bludgeoning", reach: false, larger: 1, used: "crushUsed", rule: "crush" })
});

/**
 * The closed set of interrupt kinds — what a held reaction changes about an attack. `roll` bends
 * the attack roll itself (Disadvantage after the hit shows — it can undo a natural 20, which `ac`
 * never can); its rows are INTERRUPT_ROLLS.
 */
export const INTERRUPT_KINDS = new Set(["ac", "damage", "roll"]);

/**
 * `damage` interrupts whose whole effect is a MULTIPLIER on the triggering attack's damage: the
 * applier lands the reactor's share at it and the receipt says why. Any other damage interrupt
 * (Absorb Elements, Deflect Attacks) stays "reduce by hand". Keyed by the Interrupt list's names.
 */
export const INTERRUPT_MULTIPLIERS = Object.freeze({
  "Uncanny Dodge": Object.freeze({ multiplier: 0.5,
    rule: "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s damage against you (round down)." })
});

/**
 * `damage` interrupts that REDUCE BY A ROLL: the pack's heal activity's formula IS the reduction
 * (Parry's max(str, dex) stands in for the player's choice). The hold rolls it in the open at the
 * answer and the applier lands the damage short by it. Keyed by the Interrupt list's names.
 * ⚠ The Monster Manual's "Parry" is a +2 AC reaction: a row applies only where the item carries
 * the named activity, so the monster's stays an AC hold.
 *   activity  the activity's name — or, when the stored name is EMPTY (dnd5e shows the type's
 *             localized title), the first heal activity: locale-proof
 *   pool      true — the activity's consumption target is spent; none left offers nothing
 *   eyebrow   the family the card and popup wear: "Maneuver" | "Reaction"
 *   spend     what one use is called on the cost line
 *   hit       the trigger as the card says it: "melee attack" | "attack"
 *   by        the reduction in words, for the popup's ask
 *   any       true — "when you take damage": every damage the module applies is held for it
 *             (damage-holds.js), not only an attack hit
 *   ally      feet — the reduction is for ANOTHER creature within that reach, never the owner;
 *             every guard in reach gets a popup, the first to intercept takes it (damage-holds.js)
 *   holding   what the guard must hold: "shieldOrWeapon" (a Shield or a Simple or Martial weapon)
 */
export const INTERRUPT_REDUCTIONS = Object.freeze({
  "Parry": Object.freeze({ activity: "Heal", pool: true,
    eyebrow: "Maneuver", spend: "Superiority Die", hit: "melee attack", by: "the die plus your modifier",
    rule: "When another creature damages you with a melee attack roll, you can take a Reaction and expend one Superiority Die to reduce the damage by the number you roll on your Superiority Die plus your Strength or Dexterity modifier (your choice).",
    from: "Fighter — Battle Master 3" }),
  "Stone's Endurance": Object.freeze({ activity: "Heal", pool: true,
    eyebrow: "Reaction", spend: "use", hit: "attack", by: "1d12 plus your Constitution modifier", any: true,
    rule: "When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total.",
    from: "Goliath — Giant Ancestry (Stone)" }),
  "Interception": Object.freeze({ activity: "Intercept", pool: false,
    eyebrow: "Reaction", spend: "Reaction", hit: "attack", by: "1d10 plus your Proficiency Bonus", ally: 5, holding: "shieldOrWeapon",
    rule: "When a creature you can see hits another creature within 5 feet of you with an attack roll, you can take a Reaction to reduce the damage dealt to the target by 1d10 plus your Proficiency Bonus. You must be holding a Shield or a Simple or Martial weapon to use this Reaction.",
    from: "Fighting Style feat" })
});

/**
 * The `roll` interrupts: Disadvantage on the attack roll already made — a second d20 with the
 * attack's own modifiers, the lower standing, the verdict retaken against the live AC
 * (decide/rescue-hit.js). The customers differ only in COST, so the cost is data:
 *   reaction  true when the answer takes the Reaction; Lucky takes none
 *   uses      true when it spends one of the ITEM's own uses
 *   point     what one use is called on the row's tag, when the table names it
 *   activity  the pack's activity that IS this answer — a use from the sheet answers the hold;
 *             Lucky ships two, only "Disadvantage" is this
 *   after     what the rule leaves to the table once the roll is bent — a card line, never a move
 * ⚠ `rule` is the pack's text VERBATIM (law 8). ⚠ The 2014 Halfling "Lucky" trait shares the
 * name and none of this (no uses, no activity): the lookup demands the item's own uses.
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
    from: "Ranger — Gloom Stalker" }),
  // `ally`: the Disadvantage is for ANOTHER creature within that reach — every guard in reach gets
  // its own popup after the hit shows, the first to answer bends the roll. `holding` "shield": only
  // while holding one. `effect`: the pack's effect then landed on the protected creature until the
  // start of the guard's next turn (the gate reads it: EFFECT_BENDS "Protected (Protection)").
  "Protection": Object.freeze({ reaction: true, uses: false, point: null, activity: "Protect", ally: 5, holding: "shield", effect: "Protected",
    rule: "When a creature you can see attacks a target other than you that is within 5 feet of you, you can take a Reaction to interpose your Shield if you're holding one. You impose Disadvantage on the triggering attack roll and all other attack rolls against the target until the start of your next turn if you remain within 5 feet of the target.",
    from: "Fighting Style feat" })
});

/**
 * The closed set of d20 FOLD kinds. A kind names a SPEND (content, which the R4 tripwire counts),
 * never a contribution shape (`add`/`replace`/`ac`/`verdict` are mechanism vocabulary, ARCHITECTURE.md §6):
 *   heroic     `system.attributes.inspiration`, a bare boolean with no activity and no consumption
 *              route — spending it is a WRITE, as the sheet's own toggle does
 *   tactical   Second Wind's `itemUses` through a real activity — `use()`
 *   bardic     the "Inspired" effect the bard applied — spending it is a DELETE; its die
 *              `@scale.bard.inspiration` resolves on the GRANTING bard, through the effect's `origin`
 *   advantage  a second d20 with the roll's modifiers, the higher standing, paid with an item use —
 *              the post-roll road when an initiative rolled with no dialog (ADVANTAGE_BUYS never showed)
 *   succeed    a FAILED SAVE turned into a success through the feature's activity (SAVE_SUCCEEDS):
 *              no die, the verdict itself (decide/verdict.js)
 */
export const D20_FOLD_KINDS = new Set(["heroic", "tactical", "bardic", "seeking", "advantage", "succeed"]);

/** The closed set of volley kinds — the one definition the registry and tools/check-registry.mjs share. */
export const VOLLEY_KINDS = new Set(["damage", "attack"]);

/**
 * The weapon masteries this module RESOLVES. `nick` is pure action economy, which is not this
 * module's job — declared native (MASTERY_NATIVE) rather than merely absent.
 */
export const MASTERY_KINDS = new Set(["vex", "sap", "cleave", "slow", "topple", "push", "graze"]);

/** Masteries the system has and this module deliberately leaves alone. See MASTERY_KINDS. */
export const MASTERY_NATIVE = new Set(["nick"]);

/** What each mastery popup quotes: the 2024 property text VERBATIM, checked against the system's
 * rules journal by tools/check-mastery-rules.mjs. Never paraphrase; hints ride as separate lines. */
export const MASTERY_RULES = Object.freeze({
  slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn’t exceed 10 feet.",
  topple: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  push: "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  graze: "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  vex: "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  sap: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  cleave: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but don’t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."
});

/** The maneuver folds' popup quotes, keyed by KIND: the 2024 text VERBATIM from the PHB compendium
 * (the source mixes curly and straight apostrophes). Never paraphrase; hints ride as separate lines. */
export const RULE_TEXT = {
  // ⚠ Precision's quote lives only in `RESCUE_KINDS` (decide/present.js): law 8 — the quote IS the
  // rule, and a drifting second copy tells the table something untrue.
  riposte: "When a creature misses you with a melee attack roll, you can take a Reaction and expend one Superiority Die to make a melee attack roll with a weapon or an Unarmed Strike against the creature. If you hit, add the Superiority Die to the attack's damage.",
  bash: "If you attack a creature within 5 feet of you as part of the Attack action and hit with a Melee weapon, you can immediately bash the target with your Shield if it’s equipped, forcing the target to make a Strength saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice). You can use this benefit only once on each of your turns.",
  shove: "Push. When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can deal damage to the target and also push it 5 feet away from you. You can use this benefit only once per turn.",
  crush: "Push. Once per turn, when you hit a creature with an attack that deals Bludgeoning damage, you can move it 5 feet to an unoccupied space if the target is no more than one size larger than you.",
  bashChoice: "On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice).",
  interpose: "If you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you can take a Reaction to take no damage if you succeed on the saving throw and are holding a Shield.",
  hew: "Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the same weapon as a Bonus Action.",
  command: "When you take the Attack action on your turn, you can replace one of your attacks to direct one of your companions to strike. When you do so, choose a willing creature who can see or hear you and expend one Superiority Die. That creature can immediately use its Reaction to make one attack with a weapon or an Unarmed Strike, adding the Superiority Die to the attack's damage roll on a hit."
};

/**
 * A feat whose text grants one more attack as a Bonus Action, REMINDED — the `hew` fold's OK-only
 * popup and card (hew.js). A `hew` entry on the Maneuver Folds list with no row here takes Great
 * Weapon Master's shape (`when: "critOrKill"`).
 *   when     "critOrKill" — after a Critical Hit or a creature reduced to 0 with a melee weapon;
 *            "attack" — after an attack with a qualifying weapon on the owner's turn, once per turn
 *   weapons  ("attack") a base item named in `base`, or one carrying every property in `properties`
 *   label    what the popup and the card call the swing
 *   swing    the line saying what to swing
 *   drive    true — the reminder is an OFFER: Use drives the weapon's own attack at the same
 *            creature, its die a d4 of Bludgeoning
 *   rule     the benefit's sentence, verbatim (law 8)
 */
export const BONUS_SWINGS = Object.freeze({
  "Great Weapon Master": Object.freeze({ when: "critOrKill", label: "Hew", rule: RULE_TEXT.hew }),
  "Polearm Master": Object.freeze({ when: "attack", label: "Pole Strike",
    weapons: Object.freeze({ base: Object.freeze(["quarterstaff", "spear"]), properties: Object.freeze(["hvy", "rch"]) }),
    drive: true,
    swing: "A Bonus Action: the other end of the weapon, a d4 of Bludgeoning — <strong>Pole Strike</strong> makes the attack for you.",
    rule: "Pole Strike. Immediately after you take the Attack action and attack with a Quarterstaff, a Spear, or a weapon that has the Heavy and Reach properties, you can use a Bonus Action to make a melee attack with the opposite end of the weapon. The weapon deals Bludgeoning damage, and the weapon’s damage die for this attack is a d4.",
    from: "General feat" })
});

/**
 * The REMINDER kinds — the sources of Advantage or Disadvantage the gate reads before an attack roll:
 *   vex        the attacker's own Vexed chip on a target → Advantage
 *   sap        a Sapped chip on the attacker → Disadvantage
 *   prone      the attacker prone → Disadvantage; the target prone → Advantage within 5 feet,
 *              Disadvantage beyond (decide/reminders.js)
 *   condition  a row of CONDITION_BENDS on either side
 *   range      a ranged roll's geometry: beyond normal range → Disadvantage, beyond long → cannot
 *              be made (listed, not counted); an enemy within 5 feet → Disadvantage (RANGE_RULES)
 *   sneak      the Sneak Attack CHOICE beside the roll — a tick; the module carries the dice
 *              (SNEAK_ATTACK, CUNNING_OPTIONS)
 *   effect     a row of EFFECT_BENDS on either sheet; which rows count is the Effect Sources list
 *   buy        Advantage bought with an item's use before the roll (ADVANTAGE_BUYS) — the one
 *              source the roller CHOOSES, so a tick rather than a tag
 * The gate never SETS a mode (DESIGN R-A): it lists every source and the net, and a human presses.
 * Which kinds a table wants is the Reminder Sources list.
 */
export const REMINDER_KINDS = new Set(["vex", "sap", "prone", "condition", "range", "effect", "sneak", "buy"]);

/**
 * Advantage on your OWN D20 Test, bought before the roll with one of the item's uses: one tick box
 * per row the roller holds, inside the system's roll dialog for an attack, save, check or
 * initiative (advantage-buys.js). The tick is an Advantage source in the net (beside a
 * Disadvantage it nets Normal and the use still goes); the use is spent when the roll goes out
 * ticked. A roll with no dialog meets no box and spends nothing; an initiative with no dialog is
 * offered the buy AFTER the roll — the `advantage` d20 fold (RULINGS *Where the table bends the rule*).
 *   uses   true — the spend is one of the ITEM's own uses
 *   point  what one use is called on the box and the receipt
 *   tests  which D20 Tests the rule reaches
 *   rule   the pack's paragraph for this half, verbatim (law 8)
 * ⚠ The 2014 Halfling "Lucky" trait shares the name and has no uses — the lookup demands them.
 */
export const ADVANTAGE_BUYS = Object.freeze({
  "Lucky": Object.freeze({ uses: true, point: "Luck Point", activity: "Advantage",
    tests: Object.freeze(["attack", "save", "check", "initiative"]),
    rule: "Advantage. When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.",
    from: "Origin feat" })
});

/**
 * A feature that turns a FAILED saving throw into a success, once per rest — the `succeed` d20
 * fold (d20-folds.js). Offered where a failure is known (a demanded save, before its verdict
 * applies) and, on a save rolled from the sheet, as an offer the roller judges (no DC is known
 * there). Keyed by the FEATURE's name; membership is the D20 Folds list's `succeed` rows.
 *   activity   the feature's own activity whose use pays
 *   label      what the offer and the card call it — the benefit's name, not the feat's
 *   abilities  the saves it reaches (ability ids)
 *   rule       the benefit's paragraph, verbatim (law 8)
 */
export const SAVE_SUCCEEDS = Object.freeze({
  "Mage Slayer": Object.freeze({ activity: "Guard Mind", label: "Guarded Mind",
    abilities: Object.freeze(["int", "wis", "cha"]),
    rule: "Guarded Mind. If you fail an Intelligence, a Wisdom, or a Charisma saving throw, you can cause yourself to succeed instead. Once you use this benefit, you can’t use it again until you finish a Short or Long Rest.",
    from: "General feat" })
});

/**
 * Sneak Attack: the feature by NAME on the attacker's sheet, its dice read off its own damage
 * activity (`@scale.rogue.sneak-attack` — never a table by level), its rule verbatim. A CHOICE
 * beside the roll — a checkbox, because the roll still needs its Advantage / Normal press. The
 * module ticks it when what it can read holds (Finesse or ranged, the roll's net, an ally within
 * 5 feet of the target); the tick stays the player's. The dice ride the damage roll (the
 * hit-riders seam), crit-doubled for free, once per turn as a turn chip.
 */
export const SNEAK_ATTACK = Object.freeze({
  feature: "Sneak Attack",
  improved: "Improved Cunning Strike",     // up to TWO Cunning Strike effects
  rule: "Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage’s type is the same as the weapon’s type. You don’t need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn’t have the Incapacitated condition, and you don’t have Disadvantage on the attack roll.",
  cunning: "When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die before rolling, and the effect occurs immediately after the attack’s damage is dealt.",
  dc: "If a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus."
});

/**
 * The Cunning Strike options, READ OFF THE SHEET (subclass included): each row names the FEATURE
 * that grants it, the save ACTIVITY dnd5e ships on it (the effect lands through the saves
 * machine, with the pack's condition), and its die cost. A row with no activity is a LINE on the
 * card (Withdraw, Stealth Attack) — movement and stealth are the table's.
 * ⚠ Envenom Weapons UPGRADES Poison: the pack's activity carries the damage (2d8 as shipped, its
 * text says 2d6 — the data wins, N1) and no condition, so a failure ALSO presses Poisoned
 * (`upgrade.onFail`). Rend Mind: Psychic Blades only (`weapon`), a free use or three Psionic
 * Energy Dice — the pack's two activities.
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
 * Damage riders on the combat CLOCK: the condition is the ROUND or the TURN, not a chip on the
 * target (those are hit-riders.js). The player is told the rider is due and it is added to the
 * damage; a crit doubles it for free. Each row names the FEATURE (by name on the attacker's sheet)
 * and the damage activity the pack ships on it — the dice are READ off the sheet, scaled.
 *   when      "oncePerTurn" — the once-per-turn chit; out of combat it rides every hit ·
 *             "firstRound" — combat.round === 1, never out of combat · "any" — every hit, uses
 *             permitting (use-it-or-not is the rider's question, not the hit menu's)
 *   uses      true — limited uses: one is consumed, none left means not offered. Read off the
 *             ACTIVITY when it carries them, else off the ITEM its consumption names (the item
 *             itself for an empty target); the spend is written where the uses live
 *   effects   true — the rider activity's own effects land on the hit target, receipted on the
 *             damage card (effect-riders.js `applyActivityEffectsOnHit`, the hit menu's path too)
 *   clock     a CHIP_WINDOWS key those effects land with, pinned to the ATTACKER's place — for a
 *             pack effect with no duration, the rule's ("slow": until the start of your next turn)
 *   label     the offer's and card's name when the activity's would not say it; by default the
 *             activity's name, the feature's for "Damage"
 *   requires  "sneak" — only on an armed Sneak Attack
 *   judge     "raging" — the bearer must be raging (an effect named Rage, or the status);
 *             "opportunity" — an Opportunity Attack's hit: driven as one by the module, or a melee
 *             attack off the attacker's own turn (then ticked with the caveat)
 *   type      "weapon" — the extra damage takes the WEAPON's type; otherwise the part's first
 *   weapon    true — a weapon attack only
 *   caveat    what the module cannot judge, said on the line
 *   dealt     a damage type the hit must deal: read off the roll's parts, and the activity before it
 *   crit      true — only on a Critical Hit (the attack's d20, or the damage roll's crit)
 *   lands     an effect landed on the hit target with no activity to carry it: `{ name, from?, id,
 *             bare? }` — built from the feature's effect `from` (changes kept unless `bare`), named
 *             `name`, keyed by `id` so the next hit refreshes rather than stacks; with no `from`, a
 *             bare effect of `name` (the gate reads it by name — EFFECT_BENDS). Pinned by `clock`.
 *   says      what an effect-only rider does, for the offer's row and the card
 *   bonusDice one more of the first damage die on a Critical Hit — dnd5e's `critical.bonusDice`
 *             on the first roll, so the crit never doubles it
 * Left out on purpose: each is a choice the sheet does not record or a judgment the module cannot
 * make — Hunter's Prey, Brutal Strike, Hand of Harm, Eldritch Smite, Lifedrinker's heal, Foe
 * Slayer (tools/probe-clock-riders.mjs). Death Strike is DEATH_STRIKE. Membership: the Clock Riders list.
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
  // The Goliath's boons: any attack roll (weapon, unarmed or spell), so no `weapon`; the type is
  // the part's own; the uses the item's.
  "fires-burn": Object.freeze({ feature: "Fire's Burn", activity: "Burn", label: "Fire's Burn", when: "any", uses: true,
    rule: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target.",
    from: "Goliath — Giant Ancestry (Fire)" }),
  "frosts-chill": Object.freeze({ feature: "Frost's Chill", activity: "Chill", label: "Frost's Chill", when: "any", uses: true, effects: true, clock: "slow",
    rule: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn.",
    from: "Goliath — Giant Ancestry (Frost)" }),
  // No activity carries this damage: `amount` is the text's token resolved on the bearer, and the
  // type comes from the FORM that stands (`forms`) — an effect the form lands on the bearer, or,
  // for Necrotic Shroud (whose effect lands on the targets), the module's own form chip (`chip`).
  // `spells`: an attack spell rides the roll like a weapon; a no-attack damage spell is offered on
  // its card as a pick of the ONE target (clock-riders.js).
  "celestial-revelation": Object.freeze({ feature: "Celestial Revelation", activity: null, amount: "@prof", label: "Celestial Revelation",
    when: "oncePerTurn", judge: "transformed", spells: true,
    forms: Object.freeze([
      Object.freeze({ form: "Heavenly Wings", effect: "Heavenly Wings", type: "radiant" }),
      Object.freeze({ form: "Inner Radiance", effect: "Searing Radiance", type: "radiant" }),
      Object.freeze({ form: "Necrotic Shroud", chip: "Necrotic Shroud", type: "necrotic" })
    ]),
    rule: "Once on each of your turns before the transformation ends, you can deal extra damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your Proficiency Bonus, and the extra damage’s type is either Necrotic for Necrotic Shroud or Radiant for Heavenly Wings and Inner Radiance.",
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  // No dice of their own: an effect on the target, or one more die on a crit (RULINGS *The PHB
  // feats — groups 1–3*). ⚠ The PHB's "Slashed" effect carries Hamstring's speed −10 AND stands for
  // the crit's Disadvantage, which EFFECT_BENDS "Slashed" counts — so Hamstring lands as "Hamstrung"
  // (the pack's change, its own name) and only the crit lands "Slashed".
  "slasher-hamstring": Object.freeze({ feature: "Slasher", activity: null, label: "Hamstring", when: "oncePerTurn", dealt: "slashing",
    lands: Object.freeze({ name: "Hamstrung", from: "Slashed", id: "bfHamstrung00000" }), clock: "slow",
    says: "Speed −10 feet until the start of your next turn",
    rule: "Hamstring. Once per turn when you hit a creature with an attack that deals Slashing damage, you can reduce the Speed of that creature by 10 feet until the start of your next turn.",
    from: "General feat (Slasher)" }),
  "slasher-critical": Object.freeze({ feature: "Slasher", activity: null, label: "Slasher — Enhanced Critical", when: "any", crit: true, dealt: "slashing",
    lands: Object.freeze({ name: "Slashed", id: "bfSlashedCrit000" }), clock: "slow",
    says: "Disadvantage on its attack rolls until the start of your next turn",
    rule: "Enhanced Critical. When you score a Critical Hit that deals Slashing damage to a creature, it has Disadvantage on attack rolls until the start of your next turn.",
    from: "General feat (Slasher)" }),
  "crusher-critical": Object.freeze({ feature: "Crusher", activity: null, label: "Crusher — Enhanced Critical", when: "any", crit: true, dealt: "bludgeoning",
    lands: Object.freeze({ name: "Crushed", from: "Crushed", id: "bfCrushedCrit000" }), clock: "slow",
    says: "attack rolls against it have Advantage until the start of your next turn",
    rule: "Enhanced Critical. When you score a Critical Hit that deals Bludgeoning damage to a creature, attack rolls against that creature have Advantage until the start of your next turn.",
    from: "General feat (Crusher)" }),
  "piercer-critical": Object.freeze({ feature: "Piercer", activity: null, label: "Piercer — Enhanced Critical", when: "any", crit: true, dealt: "piercing",
    bonusDice: 1, says: "one additional damage die",
    rule: "Enhanced Critical. When you score a Critical Hit that deals Piercing damage to a creature, you can roll one additional damage die when determining the extra Piercing damage the target takes.",
    from: "General feat (Piercer)" }),
  // The pack's "Halted" (Speed 0) for the rest of the CURRENT turn (the `halt` clock). An
  // Opportunity Attack made from the sheet carries no mark, so an off-turn melee attack is ticked
  // with the caveat.
  "sentinel-halt": Object.freeze({ feature: "Sentinel", activity: null, label: "Halt", when: "any", judge: "opportunity",
    lands: Object.freeze({ name: "Halted", from: "Halted", id: "bfHalted00000000" }), clock: "halt",
    says: "Speed 0 for the rest of the current turn", caveat: "only on an Opportunity Attack",
    rule: "Halt. When you hit a creature with an Opportunity Attack, the creature’s Speed becomes 0 for the rest of the current turn.",
    from: "General feat (Sentinel)" })
});

/**
 * Features the pack ships as TEXT ONLY (a self, instantaneous utility activity) whose whole
 * consequence is a bend on the actor's next roll: use-chips.js writes a chip named as the feature
 * when used, EFFECT_BENDS reads it by that name, and the roll spends it. `window`: a CHIP_WINDOWS
 * key (the rule's duration); `changes`: what the text changes on the sheet. Membership: Effect Sources.
 */
export const USE_CHIPS = Object.freeze({
  "Steady Aim": Object.freeze({ key: "steadyAim", bend: "advantage", window: "steadyAim",
    rule: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    note: "Speed 0 until the end of the turn; the next attack roll spends it",
    changes: Object.freeze([Object.freeze({ key: "system.attributes.movement.walk", mode: 5, value: "0" })]) })
});

/**
 * A use chip of its own kind (RULINGS *Bent by choice — the rule of cool*): the feature's named
 * `activity` (the pack's weapon enchantment) is VETOED at the use and becomes a chip on the ACTOR,
 * named `chip`, for `seconds`, spending `dose` of the feature's uses. The NEXT weapon hit spends it:
 * the feature's save activity for the ability its DC is read off (`saves` — one per ability the
 * feat raises; the pick is decide/chips.js `coatSaveAbility`) is used at the struck creatures, so
 * the failure's damage is the pack's (N1) and SAVE_PRESSES presses what the pack only names.
 *   img   the chip's icon — the weapon armed, never a harm on the actor; a core icon, so every box has it
 *   list  the listed-names switch the row answers to — the Fighting Styles list's entry for the
 *         same feat, which already runs its Potent Poison: one feat, one switch
 * ⚠ NOT A KIND — one table read by one machine (use-chips.js); a second customer is a row.
 */
export const COATINGS = Object.freeze({
  "Poisoner": Object.freeze({ key: "poisoner", activity: "Apply Poison", chip: "Poison Coating", img: "icons/weapons/daggers/dagger-poisoned.webp", seconds: 60, dose: 1,
    saves: Object.freeze({ dex: "Poison Save (Dexterity)", int: "Poison Save (Intelligence)" }), list: "fightingStyles",
    rule: "As a Bonus Action, you can apply a poison dose to a weapon or piece of ammunition. Once applied, the poison retains its potency for 1 minute or until you deal damage with the poisoned item, whichever is shorter. When a creature takes damage from the poisoned item, that creature must succeed on a Constitution saving throw (DC 8 plus the modifier of the ability increased by this feat and your Proficiency Bonus) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn.",
    from: "General feat" })
});

/**
 * A feature the pack ships as TEXT with no activity, whose use is another item's cast: the card of
 * that cast (`on`) OFFERS the chip when its caster owns `feature`. A click writes a chip named
 * `chip`, wearing the feature's icon, for `seconds` of world time, one per device, at most `max`
 * standing (at the max the popup says to remove one first). The chip bends nothing — it is the
 * table's reminder that the thing exists and when it lapses. Membership: the Card Chips list.
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
 * A save activity whose FAILURE lands a condition the pack does not carry as an effect (the 2024
 * Web ships no effect at all — tools/probe-web.mjs). A row names the ITEM and the status its text
 * presses on a failed save, through `forceStatus` (the caster as origin, receipted with a revert),
 * the way Topple presses Prone. Data, not a graft on the content; read only when the activity
 * brought no effect of its own.
 * ⚠ The table is tools/audit-presses.mjs's output — re-run it after a content update. Deliberately
 * absent: Command (Prone only on Grovel, a choice), Sleep (the Unconscious is a second save; its
 * Incapacitated is carried), Flesh to Stone (three failures; its Restrained is carried), Elemental
 * Attunement and Mind Spike (mention a condition in passing).
 */
export const SAVE_PRESSES = Object.freeze({
  "Web": Object.freeze({ status: "restrained", onFail: true,
    rule: "Each creature that starts its turn in the webs or that enters them during its turn must succeed on a Dexterity saving throw or have the Restrained condition while in the webs or until it breaks free." }),
  "Grease": Object.freeze({ status: "prone", onFail: true,
    rule: "When the grease appears, each creature standing in its area must succeed on a Dexterity saving throw or have the Prone condition. A creature that enters the area or ends its turn there must also succeed on that save or fall Prone." }),
  "Sleet Storm": Object.freeze({ status: "prone", onFail: true,
    rule: "When a creature enters the Cylinder for the first time on a turn or starts its turn there, it must succeed on a Dexterity saving throw or have the Prone condition and lose Concentration." }),
  // The feat's save activities carry the 2d8 and no effect; the Poisoned is pressed here, with the
  // pseudo-expiry "until the end of your next turn" (sourceEnd, against the Poisoner's turn).
  "Poisoner": Object.freeze({ status: "poisoned", onFail: true, expiry: "sourceEnd",
    rule: "When a creature takes damage from the poisoned item, that creature must succeed on a Constitution saving throw (DC 8 plus the modifier of the ability increased by this feat and your Proficiency Bonus) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn." })
});

/**
 * Evasion: an OUTCOME with no choice in it (R1) — a Dexterity save against a half-on-success
 * effect takes NONE on a success and HALF on a failure; not while Incapacitated. Read off the
 * sheet by name at the fold; the verdict's multiplier does the rest, and the receipt says why.
 */
export const EVASION = Object.freeze({
  feature: "Evasion", ability: "dex",
  rule: "When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the save and only half damage if you fail. You can’t use this feature if you have the Incapacitated condition."
});

/**
 * A name-keyed table's closed name set and its row-by-name lookup, both case-insensitive, both
 * derived from the table. `keyOf` names the column the list validates against when it is not the
 * key (the clock riders and hit options list their `feature`).
 * ⚠ A list setting's default derives from these names: renaming a table key changes what a
 * world's saved setting validates against.
 * ⚠ `rowNamed` spreads the ROW over `{ key }`, so a row carrying its own `key` field (USE_CHIPS)
 * wins and the table key is not on the result — `keyNamed` gives the table key.
 *
 * @template T
 * @param {Record<string, T>} table
 * @param {((row: T, key: string) => string) | null} [keyOf] the name a row is listed by; the key by default
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
 * The hit menu: on a hit, pick what rides before the dice — one popup per hit, rows grouped by the
 * feature that pays. A GROUP is that feature (Combat Superiority — its pool, die, pick limit, DC);
 * an OPTION is a feature on the sheet that spends from it. Read off the content, never typed (N1):
 * the die (the option's damage activity, resolved on the sheet), the pool (its consumption target —
 * the Combat Superiority item by id, identifier or compendium source, the three shapes the pack
 * ships), the save (the option's save activity, DC and all), the condition (the effect it carries).
 * ⚠ Trip Attack's Prone effect sits on the ITEM, unlinked to the activity — `onFail` presses it.
 * Sweeping Attack's die does NOT ride: it is rolled at a SECOND creature (`mode: "sweep"`).
 *
 *   mode      "ride" (default) — the die joins the damage roll, crit-doubled by the same stamp ·
 *             "sweep" — the die is rolled apart, at a second creature the card asks for
 *   save      true — the option's save activity is used at the hit target after the damage
 *   onFail    a status the item's own (unlinked) effect presses on a failed save
 *   effects   true — the damage activity's own effects land on the hit target (no save)
 *   line      what the card says beyond the rule, for a consequence the table plays
 *   melee     true — a melee attack only
 *   clock     a CHIP_WINDOWS key the `effects` land with, pinned to the ATTACKER's place — for a
 *             pack effect with no duration or the wrong one (effect-riders.js `applyActivityEffectsOnHit`)
 *   press     a status the hit presses with NO save — receipted, never over a status the target
 *             already has; the option's activity may then be a utility one (no die; uses left shown)
 *   maxSize   the largest size the option reaches: read off the target's sheet; a larger target
 *             greys the row, an unreadable size does not (the gate never guesses)
 *
 * A GROUP's fields: `feature` the paying feature the sheet must carry (null: nothing to carry —
 * Giant Ancestry is a text-only parent the sheet may not hold), `pool` "feature" (one pool, the
 * options' shared consumption target) or "option" (each option pays from its OWN uses), `label`,
 * `max` picks, `dieLabel` what one spend is called, `eyebrow` the card's family word, `heading`
 * and `per` the offer line's voice, `from`, `rule`, `dc`.
 * One pick per GROUP, each riding the one hit (RULINGS *The hit menu — a pick per group*).
 * Membership: the Hit Menu list (option names). Precision Attack and Riposte are folds.
 */
export const HIT_GROUPS = Object.freeze({
  "combat-superiority": Object.freeze({ feature: "Combat Superiority", pool: "feature", label: "Combat Superiority", max: 1,
    dieLabel: "Superiority Die", eyebrow: "Maneuver", heading: "Maneuvers", per: "one maneuver per attack", from: "Fighter — Battle Master 3",
    rule: "Many maneuvers enhance an attack in some way. You can use only one maneuver per attack.",
    dc: "If a maneuver requires a saving throw, the DC equals 8 plus your Strength or Dexterity modifier (your choice) and Proficiency Bonus." }),
  // Hill's Tumble alone — Fire's Burn and Frost's Chill are CLOCK_RIDERS (a Goliath owns one boon,
  // so the hit asks only whether). The parent is text only and the boon a separate item the sheet
  // may not keep, so the group requires no feature; the boon pays from its own uses.
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
  // Any attack roll that hits and deals damage — weapon, unarmed or spell. No die: the press is the boon.
  "hills-tumble": Object.freeze({ feature: "Hill's Tumble", group: "giant-ancestry", press: "prone", maxSize: "lg",
    rule: "When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition." })
});

/** The hit options' feature names, lower-cased — the closed set the Hit Menu list is validated against. */
export const HIT_OPTION_NAMES = tableIndex(HIT_OPTIONS, r => r.feature).names;

/**
 * The Battle Master's BONUS ACTION maneuvers: a use whose consequence lands on a sheet, and for two
 * of them a die that rides the hit after (tools/probe-pack-shapes.mjs).
 *   use     the activity the fighter presses, by name (the pool is the system's — `use()` consumes)
 *   bonus   { key, window, what } — the rolled number written as a change on the fighter's chip
 *           (Evasive Footwork: the pack's "Evasive AC" effect carries NO change)
 *   choice  { effectPrefix, what } — the pack's "+N" effect (Bait and Switch ships twelve,
 *           "Baited AC +1" … "+12") on whoever the fighter picks, the fighter by default
 *   chip    { window } — a chip on the fighter; `rider` says the die rides the next hit
 *   marker  { effect } — the pack's effect on the TARGET, the fighter as source; EFFECT_BENDS
 *           reads it as Advantage for the fighter alone (`only: "source"`), the next attack spends it
 *   rider   { melee?, caveat? } — the die rides the hit's damage roll (crit-doubled by the stamp);
 *           Lunging Attack's straight line is the player's fact, a TICKED checkbox
 * The die is READ off the sheet. Membership: the Superiority Uses list. Rally needs no row (its
 * temp HP are a heal activity the cast path lands); the other maneuvers are folds, the hit menu,
 * SUPERIORITY_FOLDS or INTERRUPT_REDUCTIONS.
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
 * Battle Master maneuvers that ADD THE DIE TO A D20 TEST: the d20 folds' `tactical` spend (a
 * utility activity used, its formula the die) with the SCOPE the text gives — which skills, and
 * whether Initiative. Listed in the D20 Folds list as `Ambush:tactical` etc.; the scope is what
 * tells them from Tactical Mind (any check, a refund). No refund: the die is spent either way.
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
 * A persistent area attached to a token whose effect applies to the creatures inside it (DESIGN §4).
 * The platform models it: a Region attached to the token moves with it, tracks the tokens inside
 * and raises enter / exit / turn-end events; `RegionDocument.createTokenEmanation` builds the
 * rules-correct shape (token base plus radius) — tools/probe-emanations.mjs. The pack ships every
 * aura's EFFECT and leaves who-is-inside to the table; a row names the item, its effect, who it
 * reaches, how far, and what triggers inside it.
 *
 *   kind       "feature" — always on while the source's token is on the scene and the range
 *              resolves (a Paladin below 6th has no aura; the scale value says so) · "spell" — the
 *              system's emanation template is adopted, attached to the caster, ends with it
 *   reach      "helpful" reaches allies and neutrals; "harmful" enemies; "all" every creature
 *   range      null: the activity's own size · a formula: the content's own token, read off the
 *              SOURCE's roll data (`@scale.paladin.aura`). ⚠ Never a number for a feature the class
 *              scales (N1) · "weaponReach": the held weapon's reach, else 10 ft with Reach, else 5 ft
 *   effect     the pack's effect by name; its changes are RESOLVED against the source before the
 *              platform hands them out (else each member adds its own Charisma, not the Paladin's).
 *              null: a ring and a card, nothing applied (a barrier, a notice)
 *   incapacitated  the aura is inactive while the source is Incapacitated
 *   trigger    a save demanded of a creature — `on`: "enter" (it enters, or the area enters its
 *              space) and/or "turnEnd"; `oncePerTurn` as the text says. The save, DC, damage and
 *              scaling are the activity's; the saves machine judges
 *   heal       a heal the area pays a member at a moment — `on` "turnStart", `when` "zeroHP",
 *              `activity` the heal activity whose part is read
 *   remind     a NOTICE at the SOURCE's turn start naming the heal to use — an AIMED heal is a
 *              choice, offered and never played (R1)
 *   holding    (a feature) the ring stands only while the source holds a qualifying equipped
 *              weapon — base item in `base`, or every property in `properties`
 *   alert      a REMINDER to the source when a creature the row reaches MOVES INTO the ring
 *              (`on: "moveIn"` — Foundry's tokenMoveIn, raised only when the creature itself
 *              moved): Hew's popup (hew.js), the swing from the sheet
 *   quiet      raise and lower the ring with no card
 *   item / activity / while / pulse   see the Inner Radiance row
 *   caveat     what the pack leaves to the table, said on the card
 *
 * Membership: the Emanations list. What is left out on purpose: RULINGS *Emanations*.
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
  // --- spells with a standing effect -------------------------------------------------------------
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
  // The pack ships the +10 as "Concealed"; its AREA is missing from the spell (Vendor Fixes
  // VF-003 gives it the rule's 30-foot Emanation).
  "Pass without Trace": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Concealed", incapacitated: false,
    caveat: "the pack's effect carries the +10 to Stealth; \"leave no tracks\" is the table's",
    rule: "You radiate a concealing aura in a 30-foot Emanation for the duration. While in the aura, you and each creature you choose have a +10 bonus to Dexterity (Stealth) checks and leave no tracks.",
    from: "Druid / Ranger spell, level 2 (Concentration, 1 hour); the Wood Elf's lineage at character level 5" }),
  // A FEATURE emanation that stands only WHILE a named effect stands on its bearer (`while` — the
  // transformation's effect, landed by the token-lights machine), found on `item` by `activity`,
  // reaching EVERY creature inside, and paying out at the END OF THE BEARER'S turn (`pulse`): the
  // activity's damage part, rolled once and applied to everyone inside. ⚠ The pack models the
  // pulse as damage on use; the use is the transform alone — no area placed, no damage rolled.
  "Inner Radiance": Object.freeze({ kind: "feature", item: "Celestial Revelation", activity: "Inner Radiance", while: "Searing Radiance",
    reach: "all", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: "Inner Radiance" }),
    rule: "Searing light temporarily radiates from your eyes and mouth. For the duration, you shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes Radiant damage equal to your Proficiency Bonus.",
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  // The ring is the REACH of the qualifying weapon held, invisible, applying nothing; a hostile
  // MOVING into it raises Hew's reminder on the wielder. Nothing is driven: the Reaction's
  // attack is made from the sheet.
  "Polearm Master": Object.freeze({ kind: "feature", reach: "harmful", range: "weaponReach", effect: null, incapacitated: true, quiet: true,
    holding: Object.freeze({ base: Object.freeze(["quarterstaff", "spear"]), properties: Object.freeze(["hvy", "rch"]) }),
    alert: Object.freeze({ on: "moveIn", label: "Reactive Strike",
      swing: "Take your <strong>Reaction</strong> to make one melee attack at it, from the sheet." }),
    rule: "Reactive Strike. While you’re holding a Quarterstaff, a Spear, or a weapon that has the Heavy and Reach properties, you can take a Reaction to make one melee attack against a creature that enters the reach you have with that weapon.",
    from: "General feat" })
});

/**
 * The hit rider MIRRORED (a ninth shape beside SWEEP §1's eight): a standing effect on the
 * DEFENDER pays out against the ATTACKER when a melee attack roll hits it, with no choice (R1).
 * The dice are the pack's damage activity on the SOURCE's item, found through the standing
 * effect's origin (a Death Armor on an ally is the caster's spell paying out on the ally's sheet),
 * rolled in the open by the elect and applied through the receipt chokepoint.
 *   effect    the pack's effect by NAME on the defender — one name, or a map of name → damage
 *             type where the standing effect decides the type (Fire Shield: warm burns, chill freezes)
 *   activity  the pack's damage activity on the source's item, by name — its dice, its reach
 *   melee     a melee attack roll only
 *   when      "oncePerTurn" — the defender's turn chit; out of combat every hit
 *   while     "tempHP" — strikes only while the defender has Temporary Hit Points
 *   mark      true — the pack ships no effect (Armor of Agathys): the module writes its own chip at
 *             the cast (`cast` names the casting activity), carrying the cast's level; it goes
 *             when the temp HP do
 * ⚠ Hellish Rebuke is NOT this family — a Reaction, a human's choice, the hold's business.
 * Membership: the Damage Shields list. Reach, dice and type are read off the content (N1).
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
 * A cast whose activity ships SEVERAL effects the text makes alternatives ("as you choose") and
 * marks nothing to say so — landing all would be wrong. The choice is the caster's (R1), asked at
 * the cast in a popup on the caster's own card; only the pick lands.
 *   effects   the pack's effect NAMES that are alternatives, in the popup's order
 *   ask       the popup's question
 * Membership: the Effect Choices list. A row whose activity carries fewer than two of the names
 * asks nothing (decide/choices.js).
 */
export const EFFECT_CHOICES = Object.freeze({
  "Fire Shield": Object.freeze({ effects: Object.freeze(["Warm Shield", "Chill Shield"]), ask: "A warm shield or a chill shield?",
    rule: "The flames provide you with a warm shield or a chill shield, as you choose. The warm shield grants you Resistance to Cold damage, and the chill shield grants you Resistance to Fire damage.",
    from: "PHB, level 4 (10 minutes)" })
});

/** The choices' item names, lower-cased — the closed set the Effect Choices list is validated against. */
export const EFFECT_CHOICE_NAMES = tableIndex(EFFECT_CHOICES).names;

/**
 * A use whose text says something SHEDS LIGHT, carried as the token's light on an effect: Foundry
 * applies a change keyed `token.*` to the bearer's tokens (TokenDocument#applyActiveEffects —
 * `light` is targetable), so the light follows the effect's clock and removal and no token
 * document is written. The radii are the rule's words; a Foundry light's `dim` is the OUTER
 * radius, so dim = bright + "an additional" (the packs carry no light — the text is the source).
 *   on        "self" — the actor's own sheet; "targets" — every creature targeted at the use
 *             (none targeted: the pack's own use stands)
 *   item      the pack item the activity lives on, when the row's key is not the item's name
 *   activity  the activity, by name, whose use lands the light (null: any use of the item)
 *   effect    the pack's effect the light rides, landed on the actor WITH the light (the pack ships
 *             Searing Radiance on a damage activity, which lands nothing on its user); null: the
 *             module makes the effect, named as the item, with the item's duration
 *   recast    "ends" — casting it again ends the caster's earlier light, wherever it stands
 *   bright / dim   the radii in feet, dim the outer
 * Membership: the Token Lights list.
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
 * TOKEN_LIGHTS' sibling on the same carrier (`token.*` changes — `sight` and `detectionModes` are
 * targetable, and a `sight.visionMode` override inflates the mode's own defaults), but the effect
 * is the PACK's, landed by whoever lands it: the changes are added as it is created, so the sense
 * follows the pack's clock and removal.
 *   effect    the pack effect's name the row answers to (the row key when absent)
 *   vision    the Foundry vision mode the token takes while it stands (CONFIG.Canvas.visionModes)
 *   detect    { mode, range } — a Foundry detection mode enabled at that range (feet)
 *   range     the token's sight range while it stands (feet)
 * Membership: the Token Senses list.
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
 * TOKEN_SENSES' sibling on the same carrier: `token.width` / `token.height` (which Foundry applies
 * as a document update — its `requiresUpdateKeys`) and `system.traits.size` added to the PACK's
 * effect as it is created, so the sheet, the size judge and the system's size readers all see it.
 * dnd5e resizes a token only when the SOURCE size changes (tokenSizeSync), never an effect's, and
 * the packs ship no size change. The size lives on the effect: its clock or removal puts it back.
 *   effects  { effectName: { size } | { step } } — `size` an absolute size key; `step` categories
 *            from the bearer's size when the effect lands, clamped to CONFIG.DND5E.actorSizes
 *   caveat   what the table judges
 * Membership: the Token Sizes list.
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
 * A feature whose text gives the creature something when it finishes a rest, which the platform
 * does not give (the pack's own note says so). The grant rides the rest's own actor update
 * (rest-grants.js, `dnd5e.preRestCompleted`), and the rest card says so. Keyed by the FEATURE's
 * name; membership is the Rest Grants list.
 *   rests   which rests give it ("long", "short")
 *   grant   "inspiration" (Heroic Inspiration) · "temphp" (the amount read off the feature's heal
 *           activity — N1 — given only where it beats what the creature holds: they do not
 *           stack) · "meal" (Chef: extra dice healed to a creature that spends Hit Dice in the
 *           SAME Short Rest — rest-grants.js)
 *   to      absent — the owner gains it; "allies" — the owner GIVES it, in a courtesy popup once
 *           the rest is done (allies in reach listed, those who already have it greyed)
 *   feature the feature's name on the sheet, where the row is one of its benefits (Chef's two);
 *           the row's own name by default
 *   self    ("allies") the owner may pick itself
 *   reach   ("allies") the feet an ally may stand from the owner — the map settles it (R1);
 *           null — no distance in the rule: every ally on the scene
 *   cap     ("allies") how many — "prof", a number, or a formula on the owner's roll data
 *   activity    the feature's HEAL activity the amount is read from
 *   activities  by ability — the activity standing for the ability the feat raised (the pack
 *           ships one per ability): the feat's own ASI picks it, else the higher modifier
 *           (decide/chips.js, as the Poisoner's pick)
 *   label   what the rest card calls the one activity it keeps of `activities`
 *   rule    the feature's sentence, verbatim (law 8)
 */
export const REST_GRANTS = Object.freeze({
  "Resourceful": Object.freeze({ rests: Object.freeze(["long"]), grant: "inspiration",
    rule: "You gain Heroic Inspiration whenever you finish a Long Rest.", from: "Human" }),
  "Musician": Object.freeze({ rests: Object.freeze(["short", "long"]), grant: "inspiration", to: "allies", reach: 30, cap: "prof",
    rule: "Encouraging Song. As you finish a Short or Long Rest, you can play a song on a Musical Instrument with which you have proficiency and give Heroic Inspiration to allies who hear the song. The number of allies you can affect in this way equals your Proficiency Bonus.",
    from: "Origin feat (Entertainer)" }),
  // Musician's popup, granting Temporary Hit Points (the pack's heal activity's amount).
  "Inspiring Leader": Object.freeze({ rests: Object.freeze(["short", "long"]), grant: "temphp", to: "allies", self: true, reach: 30, cap: 6,
    activities: Object.freeze({ wis: "Inspire with Wisdom", cha: "Inspire with Charisma" }), label: "Inspire with Performance",
    rule: "Bolstering Performance. When you finish a Short or Long Rest, you can give an inspiring performance: a speech, song, or dance. When you do so, choose up to six allies (which can include yourself) within 30 feet of yourself who witness the performance. The chosen creatures each gain Temporary Hit Points equal to your character level plus the modifier of the ability you increased with this feat.",
    from: "General feat" }),
  // Chef's two benefits, one row each (the feat is `feature`). Bolstering Treats are handed out
  // after the Long Rest as their Temporary Hit Points (RULINGS *Bent by choice*).
  "Bolstering Treats": Object.freeze({ feature: "Chef", rests: Object.freeze(["long"]), grant: "temphp", to: "allies", self: true, reach: null, cap: "prof",
    activity: "Bolstering Treats",
    rule: "Bolstering Treats. With 1 hour of work or when you finish a Long Rest, you can cook a number of treats equal to your Proficiency Bonus if you have ingredients and Cook’s Utensils on hand. These special treats last 8 hours after being made. A creature can use a Bonus Action to eat one of those treats to gain a number of Temporary Hit Points equal to your Proficiency Bonus.",
    from: "General feat (Chef)" }),
  "Replenishing Meal": Object.freeze({ feature: "Chef", rests: Object.freeze(["short"]), grant: "meal", to: "allies", self: true, reach: null, cap: "4 + @prof",
    activity: "Replenishing Meal",
    rule: "Replenishing Meal. As part of a Short Rest, you can cook special food if you have ingredients and Cook’s Utensils on hand. You can prepare enough of this food for a number of creatures equal to 4 plus your Proficiency Bonus. At the end of the Short Rest, any creature who eats the food and spends one or more Hit Dice to regain Hit Points regains an extra 1d8 Hit Points.",
    from: "General feat (Chef)" })
});

/** The rest grants' row names, lower-cased — the closed set the Rest Grants list is validated against. */
export const REST_GRANT_NAMES = tableIndex(REST_GRANTS).names;

/**
 * What turns a drop to 0 Hit Points into a drop to 1 (drop-to-one.js, at `dnd5e.preApplyDamage`:
 * the 1 is written in the damage's own update). Keyed by the row's name; membership is the Drop to
 * 1 HP list.
 *   ask       true — "you can": the HP is held at 1 and the owner is asked; false — no choice in
 *             the rule: it simply happens, and a card says so
 *   uses      true — the ITEM's own uses pay for it
 *   effect    the EFFECT whose presence is the row, removed when it fires; absent — a feature on
 *             the sheet, by the row's name
 *   ends      the spell ends when it fires (the card says so)
 *   outright  true — it stands against damage that would kill outright too; false — "but not
 *             killed outright" (the remainder meets the Hit Point maximum)
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
 * A Reaction taken AFTER the bearer takes damage from a creature, aimed at THAT creature: a popup
 * to the damaged creature's owner the moment the damage lands (rebukes.js), only when the damager
 * stands within reach. Riposte's shape (the answer drives the real use at the attacker), triggered
 * by damage, not a miss. The reach is read off the item's REACTION activity (N1,
 * tools/scan-reactions.mjs), except where the activity carries none (`range`).
 *   activity  the reaction activity, by name (null: the item's first reaction activity)
 *   attack    "melee" — the answer is one melee attack with a weapon the bearer picks, not the
 *             item's own activity
 *   range     feet, when the activity carries none
 *   advantage true — the answer's attack roll has Advantage
 *   while     an effect's name that must stand on the bearer (the reaction exists only while the
 *             spell does)
 *   equipped  true — the item must be equipped
 *   ward      true — the bearer is NOT the creature damaged: every BYSTANDER within `range` of a
 *             damager whose attack hit someone else is asked
 *   hit       true — only an ATTACK's damage counts
 *   opportunity  true — the answer is an Opportunity Attack: its card says so, and the Halt rider
 *             reads it (CLOCK_RIDERS "sentinel-halt")
 *   caveat    what the table judges ("that you can see")
 * A spell answers at the lowest slot the sheet holds: no picker inside a Reaction's window; to
 * upcast, cast from the sheet. Membership: the Rebukes list.
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
    rule: "While you hold the sword, you can take a Reaction to make one melee attack with it against any creature in your reach that deals damage to you. You have Advantage on the attack roll, and any damage dealt with this special attack ignores any Immunity or Resistance the target has." }),
  // Retaliation's answer, asked of a bystander. The pack ships Sentinel with no activity (only
  // Halt's effect), so the answer is one melee attack with the weapon last swung.
  "Sentinel": Object.freeze({ attack: "melee", range: 5, ward: true, hit: true, opportunity: true, from: "General feat",
    caveat: "its Disengage half — nothing records a Disengage",
    rule: "Guardian. Immediately after a creature within 5 feet of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against that creature." })
});

/** The rebukes' item names, lower-cased — the closed set the Rebukes list is validated against. */
export const REBUKE_NAMES = tableIndex(REBUKES).names;

/**
 * A bare damage activity whose text ties a SAVE to taking the damage (Heat Metal: the damage
 * activities nothing chains, and a save activity nobody used). A row names the damage activities
 * and the save; damage-casts.js rolls the dice at the use and puts the save to the same targets
 * right after, through the saves machine. The drop is a judgment the card says out loud (R1): the
 * failed save's effect lands, and the table removes it if the object was dropped.
 *   damage   the damage activities, by name — each use of one rolls and then demands
 *   save     the save activity, by name — used at the damage's targets, no slot
 *   line     what the card says beyond the rule, for the consequence the table plays
 * Membership: the Damage Saves list. The dice, the DC and the effect are the pack's (N1).
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
 * The spent-template sweep's fourth bucket. The sweep (saves/areas.js) reads an area's life off
 * the DATA: instantaneous → spent at the last verdict; concentration → with the concentration; any
 * other duration → the GM's (Grease's minute is the area's own and MUST persist). These rows are
 * areas whose data LIES — the activity's duration is an EFFECT's clock, or an imported copy lost
 * its concentration flag — so the TEXT says the area is spent the moment its last verdict lands.
 * Membership: the Spent Areas list (whole-chunk, case-insensitive).
 * ⚠ A row is a claim about the TEXT: an area that genuinely persists (Grease, Web, Cloudkill) must
 * never be listed.
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
  // A concentration spell whose area only CHOOSES its targets at the cast: the effect rides the
  // targets and the area is nothing after the save, but the pack writes the spell's minute on the
  // activity, so without a row the sweep keeps the area until concentration ends.
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
 * Area spells whose CASTER chooses who they affect ("up to six creatures of your choice in a
 * 40-foot Cube"): the area is only where the choice is made. When a listed spell's area lands on
 * anyone not hostile to the caster, or on more hostiles than the spell allows, the caster is asked
 * (saves/demand.js raises the ask, metamagic.js answers it); otherwise the hostiles are the choice.
 * Careful Spell greys on a listed spell (METAMAGIC's `unless`). Membership: the Chosen Areas list
 * (whole-chunk, case-insensitive).
 * ⚠ BY NAME, NOT BY FLAG (ARCHITECTURE §6): dnd5e's `target.affects.choice` is off on Slow, Sleep,
 * Conjure Barrage and Conjure Volley though their text grants the choice. Spirit Guardians carries
 * the flag and is not here (its EMANATIONS reach is enemies already); spells that choose by
 * TARGETING need nothing. The number allowed is read off the text (decide/metamagic.js
 * `choiceCapFrom`), never written here (N1).
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
 * The 2024 Rules Glossary on range, verbatim (law 8). The source's `&Reference[...]` enrichers
 * render as the bare condition names.
 */
export const RANGE_RULES = Object.freeze({
  long: "Your attack roll has Disadvantage when your target is beyond normal range, and you can’t attack a target beyond long range.",
  single: "If a ranged attack, such as one made with a spell, has a single range, you can’t attack a target beyond this range.",
  close: "When you make a ranged attack roll with a weapon, a spell, or some other means, you have Disadvantage on the roll if you are within 5 feet of an enemy who can see you and doesn’t have the Incapacitated condition."
});

/**
 * A feat on the ATTACKER's sheet, by name, that takes away what RANGE_RULES impose (RULINGS *The
 * PHB feats — groups 1–3*). The gate still LISTS a cancelled row, with the feat that cancels it and
 * no bend (Blindsight's shape: listed with why, never counted), so the roller sees it answered.
 *   scope     "rangedWeapon" (a Ranged weapon — never a thrown melee weapon) | "spell" (a spell's
 *             attack roll) | "crossbow" (the three crossbows, by dnd5e's base item)
 *   cancels   the RANGE_RULES rows it takes away: "long", "close". Beyond long range stays — the
 *             attack still cannot be made
 *   cover     true — Half and Three-Quarters Cover are ignored: the attack's recorded AC for each
 *             target is its AC without the cover bonus, so hit and miss are right on every client
 *             (Total Cover stays: no AC is recorded against it)
 *   reach     feet added to a spell's range of at least 10 feet
 * No list of its own: the feats are part of the range rule's truth (DESIGN R1), so the Reminder
 * Sources' `range` kind is their switch too.
 */
export const RANGE_FEATS = Object.freeze({
  "Sharpshooter": Object.freeze({ scope: "rangedWeapon", cancels: Object.freeze(["long", "close"]), cover: true,
    rule: "Bypass Cover. Your ranged attacks with weapons ignore Half Cover and Three-Quarters Cover. Firing in Melee. Being within 5 feet of an enemy doesn’t impose Disadvantage on your attack rolls with Ranged weapons. Long Shots. Attacking at long range doesn’t impose Disadvantage on your attack rolls with Ranged weapons." }),
  "Spell Sniper": Object.freeze({ scope: "spell", cancels: Object.freeze(["close"]), cover: true, reach: 60,
    rule: "Bypass Cover. Your attack rolls for spells ignore Half Cover and Three-Quarters Cover. Casting in Melee. Being within 5 feet of an enemy doesn’t impose Disadvantage on your attack rolls with spells. Increased Range. When you cast a spell that has a range of at least 10 feet and requires you to make an attack roll, you can increase the spell’s range by 60 feet." }),
  "Crossbow Expert": Object.freeze({ scope: "crossbow", cancels: Object.freeze(["close"]),
    rule: "Firing in Melee. Being within 5 feet of an enemy doesn’t impose Disadvantage on your attack rolls with crossbows." })
});

/** The three crossbows, by dnd5e's base item (CONFIG.DND5E.weaponIds). */
export const CROSSBOWS = Object.freeze(["handcrossbow", "lightcrossbow", "heavycrossbow"]);

/**
 * What the 2024 conditions do to an ATTACK ROLL, both roles, each clause quoted VERBATIM from the
 * Rules Glossary (law 8) — AC5e's knowledge (DESIGN R-B) as DATA; `conditionSources` in
 * decide/reminders.js takes this table as a parameter and decides.
 * ⚠ ONE DECLARATION: the Condition Sources list's closed set (`CONDITION_STATUSES`) and shipped
 * default derive from these keys, so a new condition is a row here and nothing else.
 *   attacker  the bend on the bearer's OWN attack rolls ("advantage" | "disadvantage" | null)
 *   target    the bend on attack rolls AGAINST the bearer
 *   rule      the glossary clause verbatim
 *   caveat    a condition the module cannot judge — counted, and said
 *   note      a fact listed for the table, never counted
 *   critWithinFeet  the *Automatic Critical Hits* clause: a hit from within that many feet is a
 *             Critical Hit — an OUTCOME the damage service applies (auto-damage.js `critFor`)
 * Prone is the one row with geometry and lives in `proneSources`. Membership: the Condition
 * Sources list.
 *
 * @type {Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: string, caveat?: string, note?: string, critWithinFeet?: number}>>>}
 */
export const CONDITION_BENDS = Object.freeze({
  blinded: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: "Attack rolls against you have Advantage, and your attack rolls have Disadvantage." }),
  invisible: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: "Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature." }),
  // Hiding is the system's own status (an icon with no condition behind it): the Hide action
  // grants Invisible "while hidden", and the clause is the glossary's Unseen Attackers and Targets.
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
 * What the 2024 conditions do to a SAVING THROW, each clause VERBATIM from the Rules Glossary
 * (`CONFIG.DND5E.conditionTypes[*].reference`, law 8): two bends and four automatic failures, all
 * on Strength or Dexterity saves. Membership is the Condition Sources list the attack gate reads;
 * `saveSources` in decide/reminders.js takes this table as a parameter.
 *   abilities  which saves the row touches (ability ids)
 *   bend       "advantage" | "disadvantage" — counted, as for attacks
 *   autoFail   true — the save CANNOT SUCCEED: not a bend, a fourth button (Fails: no dice, the
 *              failure recorded) — the human still presses (R1)
 *   caveat     a condition the module cannot judge, said on the box
 * Not read on purpose: Exhaustion's penalty (dnd5e applies it — `addRollExhaustion`); Poisoned and
 * Frightened touch checks and attacks only. Dodging is the system's status; its clause is the Dodge
 * action's.
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
 * What the 2024 conditions do to an ABILITY CHECK (raw, skill or tool — never initiative), each
 * clause VERBATIM from the Rules Glossary. Membership is the Condition Sources list.
 * ⚠ The PLATFORM already rolls a Poisoned check with Disadvantage (tools/probe-conditions.mjs):
 * that row (`platform`) is a REMINDER of the dialog's default, never a second application.
 * Frightened hinges on line of sight, which the platform leaves alone, so that row is the gate's
 * own. Exhaustion's −2 × level is a subtraction the system applies, not a bend — no row.
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
 * Abilities that bend an attack roll and land on a sheet as an ACTIVE EFFECT (Innate Sorcery,
 * Reckless, Blur…) or sit there as a FEATURE with no effect (Pack Tactics). One row per ability,
 * all data. The attack gate, the check gate and the save gate all read it.
 *   match     "effect" (default) — an ActiveEffect on the actor · "feature" — an Item of type feat
 *             on the actor. ⚠ A feature row must never name something that also lands as an
 *             effect (Innate Sorcery the FEATURE is always on the sheet; the EFFECT only while it runs)
 *   attacker  the bend on the bearer's OWN attack rolls, or null
 *   target    the bend on attack rolls AGAINST the bearer, or null
 *   scope     "any" | "spell" | "weapon" | "melee" | "ranged" — the activity's classification decides
 *   caveat    a condition the module cannot judge, said on the box
 *   counted   false — LISTED, not counted: the caveat IS the rule (Demon Armor bends only against
 *             demons), shown so nobody forgets the item; default true
 *   judge     a fact the module holds; the row fires only when it is true — "bloodied" (the
 *             bearer at or below half HP), "targetBloodied", "targetDamaged" (short of full),
 *             "targetGrappled", "targetNotActed" (round one, the target has not had a turn),
 *             "allyNearTarget" (an ally of the attacker, not Incapacitated, within 5 feet of the
 *             target). An UNKNOWN map fact (the attacker's side cannot be named) counts the row —
 *             the gate never guesses an exemption
 *   spend     "attack" — the rules end the effect on the next attack roll: the spend hook uses it
 *             up with a receipt, as Vex and Sap
 *   only      "source" — the bend is for the creature whose action put the effect there alone;
 *             a carrier with no recorded source is skipped
 *   except    "source" — the bend stands against everyone BUT that creature (Goaded: skipped when
 *             the target is the goader; Distracted: when the attacker is the distracter); a carrier
 *             with no recorded source is counted. The EDGE reads the source off the module's stamp
 *             on the effect, else its origin
 *   checks    a bend on the bearer's ABILITY CHECKS — the check gate's
 *   checksWhen { statuses, skills } — narrows `checks` to a bearer wearing one of the statuses and
 *             a check of one of the skills (Powerful Build: the escape, told from any other check)
 *   saves     { bend, statuses?, spells?, halfToNone? } — a bend on the bearer's SAVING THROWS,
 *             scoped by the demand: against an effect imposing one of the statuses, or a spell;
 *             `halfToNone` turns a success against half-on-save damage into none.
 *             { succeeds, sleep } — the save CANNOT FAIL against magic that would put the bearer
 *             to sleep: the mirror of `autoFail`, a fourth button (Succeeds: no dice)
 *   rule      the ability's own sentence, from the pack (enrichers rendered as plain words)
 *   from      where it comes from, for the reader
 * ⚠ Names are the packs' own, colons and all ("Adv: Attacks & Saves") — the Effect Sources list
 * is parsed WHOLE-CHUNK for that reason (LIST_SPECS.effects.whole). Matching is case-insensitive.
 *
 * @type {Readonly<Record<string, Readonly<{match?: "effect"|"feature", attacker: "advantage"|"disadvantage"|null,
 *   target: "advantage"|"disadvantage"|null, scope: "any"|"spell"|"weapon"|"melee"|"ranged", caveat?: string,
 *   counted?: boolean, judge?: "bloodied"|"targetBloodied"|"targetDamaged"|"targetGrappled"|"targetNotActed"|"allyNearTarget", spend?: "attack",
 *   only?: "source", except?: "source", rule: string, from: string}>>>}
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
  // `checks` — the row bends ABILITY CHECKS too (the check gate reads it).
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
  // ⚠ Every one of these effects lands on the creature the feature is USED ON, not its user (Vow of
  // Enmity's sworn creature wears the marker, the paladin as its source) — read on the owner's own
  // sheet they fire for nobody. The SOURCE facet judges: `only: "source"` where the bend is the
  // source's alone, `except: "source"` where it stands against everyone but the source. A caveat
  // stays only where a fact is unreadable (Prey's target is never recorded; Strike Fear's
  // Frightened can be cured under the marker).
  "Vow of Enmity": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", from: "Paladin",
    rule: "You have Advantage on attack rolls against the creature for 1 minute or until you use this feature again." }),
  // The pack's effect is on the MONSTER (a self-ranged utility); the marked creature is nowhere
  // in the data, so the caveat is all the module can say.
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
  // The `saves` facet: the packs' effects carry no data for these save bends; the rows are where
  // it lives, read against the demand the save gate finds.
  "Aura of Purity": Object.freeze({ attacker: null, target: null, scope: "any", from: "Aura of Purity",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["blinded", "charmed", "deafened", "frightened", "paralyzed", "poisoned", "stunned"]) }),
    rule: "While in the aura, you and your allies have Resistance to Poison damage and Advantage on saving throws to avoid or end effects that include the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned condition." }),
  "Circle's Power": Object.freeze({ attacker: null, target: null, scope: "any", from: "Circle of Power",
    saves: Object.freeze({ bend: "advantage", spells: true, halfToNone: true }),
    rule: "While in the aura, you and your allies have Advantage on saving throws against spells and other magical effects. When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save." }),
  "Cursed Attacks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Bestow Curse",
    caveat: "counted — press Normal if this attack is not at the caster",
    rule: "While cursed, the target has Disadvantage on attack rolls against you." }),
  // `item`: the row stands only for an effect from THIS item, when the sheet knows — the Aura of
  // Protection hands out a "Protected" too, a save bonus.
  "Protected": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good", item: "Protection from Evil and Good",
    caveat: "counted — press Normal if the attacker is not an Aberration, Celestial, Elemental, Fey, Fiend or Undead",
    rule: "Creatures of those types have Disadvantage on attack rolls against the target." }),
  // The pack's "Protected" landed on the guarded creature by the Protection answer
  // (hold/continue.js). The key is the spell's row above, so this row names the effect it reads
  // (`named`) and its item; `sourceWithin` — it bends only while the guard stands within that
  // many feet of the bearer.
  "Protected (Protection)": Object.freeze({ named: "Protected", attacker: null, target: "disadvantage", scope: "any", from: "Protection (Fighting Style)", item: "Protection",
    sourceWithin: 5,
    rule: "You impose Disadvantage on the triggering attack roll and all other attack rolls against the target until the start of your next turn if you remain within 5 feet of the target." }),
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
  // The pack's effect sits on the TARGET, placed by superiority-uses.js with the fighter as its
  // source: the Advantage is the fighter's alone, and only the fighter's next attack roll spends it.
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
  // Pack Tactics is judged on the MAP: an ally of the attacker within 5 feet of the target. The
  // caveat stands for the one case the map cannot answer — an attacker whose side is unknown.
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
  // --- E. the combat CLOCK as the judge ---------------------------------------------------------
  // The round and whether the target has ACTED are the platform's facts (combat.round, the order
  // against the current turn), read by the EDGE like Bloodied. Out of combat it never fires.
  // --- F. USE CHIPS (use-chips.js) — the chip is NAMED as the feature, so the row reads it as any
  // effect: the pack ships Steady Aim with no effect at all.
  "Steady Aim": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack",
    rule: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    from: "Rogue 3 (a use chip)" }),
  "Assassinate": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any",
    judge: "targetNotActed",
    rule: "During the first round of each combat, you have Advantage on attack rolls against any creature that hasn’t taken a turn.",
    from: "Rogue — Assassin (Surprising Strikes)" }),
  // --- G. species traits whose one bend is on SAVES ---------------------------------------------
  // The pack ships these as text alone, so they are FEATURE rows the save gate reads by name,
  // scoped by the demand's statuses. A save to END the condition is a sheet roll with no demand:
  // the row is listed there, never counted (R1 — the module does not guess what a sheet roll is
  // against). Dwarven Resilience's Poison Resistance is the species' own advancement.
  "Brave": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Halfling",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["frightened"]) }),
    rule: "You have Advantage on saving throws you make to avoid or end the Frightened condition." }),
  "Fey Ancestry": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["charmed"]) }),
    rule: "You have Advantage on saving throws you make to avoid or end the Charmed condition." }),
  "Dwarven Resilience": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Dwarf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["poisoned"]) }),
    rule: "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition." }),
  // A save against magic whose failure would put the bearer to sleep cannot fail (the demand says
  // whether it sleeps — decide/demand.js `putsToSleep`); the gate offers Succeeds. A sheet roll
  // with no demand lists the row.
  "Trance": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ succeeds: true, sleep: true }),
    rule: "You don’t need to sleep, and magic can’t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness." }),
  // The check to END Grappled cannot be told from any other roll, so while the bearer IS Grappled
  // its Athletics and Acrobatics checks count as the escape (RULINGS *Where the table bends the
  // rule*). The pack's own effect carries the carrying-capacity half alone.
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
 * Sources list is validated against, derived from CONDITION_BENDS. Prone is its own kind. The
 * unit tests pin the size as a deliberate tripwire.
 */
export const CONDITION_STATUSES = new Set(CONDITION_KEYS);

/**
 * The ten 2024 metamagic options, keyed by the feat's name (RULINGS *Metamagic*). Each row says
 * WHEN the option fits the spell (a named predicate — decide/metamagic.js; the pack carries the
 * condition as PROSE), the MOMENT it is offered (`cast`: the cast dialog; `damage`: a fold after
 * the damage dice; `miss`: a fold on a spell attack's miss), and what it PICKS beyond the tick
 * (`protect`, `target`, `type`, `twin`). `apply` names the arithmetic, for the reader.
 * ⚠ NO COST HERE (N1): the cost is the option's own consumption target, read live. The rule text
 * is read off the feat on the sheet at render (law 8), never copied.
 */
export const METAMAGIC = Object.freeze({
  "Careful Spell":    { key: "careful",    moment: "cast",   when: "save",       picks: "protect", apply: "the protected creatures leave the save demand",
    // A spell that chooses its targets (CHOSEN_AREAS) leaves the unchosen out already, so Careful
    // buys nothing there: the row greys, "you choose its targets".
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
 * Twinned Spell's exceptions to the data read (tools/probe-twinnable.mjs). The read — a target
 * count that grows with the cast's level — is right for the many. `except`: the count grows but
 * the extra is a dart, a ray, a corpse or an arrow, not a target the way Twinned means it (Tasha's
 * Mind Whip is not in the PHB pack at all). `also`: the text grants the extra creature but the
 * pack's count is a plain number.
 */
export const TWINNED_EXCEPTIONS = Object.freeze({
  except: Object.freeze(["Magic Missile", "Scorching Ray", "Animate Dead", "Create Undead", "Cordon of Arrows", "Tasha's Mind Whip"]),
  also: Object.freeze(["Jump"])
});
const METAMAGIC_NAMES = tableIndex(METAMAGIC).names;

/**
 * A feature that rolls a weapon's damage dice again: the popup asks only WHETHER on this hit; on
 * yes the weapon's dice — every die of the activity's own damage rolls, the doubled set on a
 * crit, never a modifier or a rider — are rolled again AS A SET and the higher total stands
 * (dice-changers.js, one popup per roll beside Empowered Spell's; decide/damage-dice.js the
 * arithmetic).
 *   key     the once-per-turn chit's riderKey (TURN_CHITS `rider`, the clock riders' shape)
 *   weapon  true — a weapon's hit only
 *   one     true — ONE die rolled again, the new roll standing; else the whole set
 *   dealt   a damage type the hit must deal
 * Once per turn is counted only for a combatant (RULINGS *Chips and clocks*); out of combat every
 * hit offers. Membership: the Damage Rolled Twice list.
 * ⚠ NOT A KIND (the R4 tripwire does not move): one table read by ONE machine; nothing dispatches
 * on a kind column, and a second customer is a row here and zero code.
 */
export const DAMAGE_EITHER = Object.freeze({
  "Savage Attacker": Object.freeze({ key: "savage-attacker", weapon: true,
    rule: "Once per turn when you hit a target with a weapon, you can roll the weapon’s damage dice twice and use either roll against the target.",
    from: "Origin feat" }),
  // `one`: the die rerolled is the one with the most to gain (its size's average less its face) —
  // any other is worse on average, so the popup asks only whether, never which. A sheet holding
  // Savage Attacker too is asked both in one popup: Savage's set first, then this die off what stands.
  "Piercer": Object.freeze({ key: "piercer", one: true, dealt: "piercing",
    rule: "Puncture. Once per turn, when you hit a creature with an attack that deals Piercing damage, you can reroll one of the attack’s damage dice, and you must use the new roll.",
    from: "General feat" })
});
const DAMAGE_EITHER_NAMES = tableIndex(DAMAGE_EITHER).names;

/**
 * A feature that rerolls a healing die showing a given face — AUTOMATIC: every matching face is
 * rolled again as the dice land and the new faces stand (heal-rerolls.js; decide/damage-dice.js
 * the patch). The healing waits on the new dice, so it lands once.
 *   reroll  the face that may be rerolled
 *   spells  true — a healing SPELL the owner casts qualifies
 *   own     true — the feature's OWN healing qualifies; the pack's `r1` in those formulas is taken
 *           off at the roll so the machine, not the formula, rerolls it (one card, one road)
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const HEAL_REROLLS = Object.freeze({
  "Healer": Object.freeze({ reroll: 1, spells: true, own: true,
    rule: "Healing Rerolls. Whenever you roll a die to determine the number of Hit Points you restore with a spell or with this feat’s Battle Medic benefit, you can reroll the die if it rolls a 1, and you must use the new roll.",
    from: "Origin feat (Hermit)" })
});
const HEAL_REROLL_NAMES = tableIndex(HEAL_REROLLS).names;

/**
 * A feature that trades Initiative with a willing ally right after Initiative is rolled. Once
 * every combatant has an Initiative the owner is asked, once per combat, listing the allies on
 * its side who are not Incapacitated with their Initiative; Swap exchanges the two numbers in the
 * tracker (initiative-swap.js). The owner's pick stands for the ally's willingness.
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const INITIATIVE_SWAPS = Object.freeze({
  "Alert": Object.freeze({
    rule: "Initiative Swap. Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can’t make this swap if you or the ally has the Incapacitated condition.",
    from: "Origin feat (Criminal, Guard)" })
});
const INITIATIVE_SWAP_NAMES = tableIndex(INITIATIVE_SWAPS).names;

/**
 * A feature whose owner's Unarmed Strike deals a die "instead of the normal damage". The pack ships
 * that die only on the FEATURE's own unarmed attack, so the sheet's plain Unarmed Strike rolls the
 * flat 1 + Str. unarmed-dice.js swaps the formula in at `preRollDamageV2` — READ from the
 * feature's own attack, never transcribed here — and the damage card says so. A strike that
 * already rolls a die (a Monk's Martial Arts) is left alone: the rule is "can … instead", and that
 * choice is the table's. The swap is never lower, so nothing is asked.
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const UNARMED_DICE = Object.freeze({
  "Tavern Brawler": Object.freeze({
    rule: "Enhanced Unarmed Strike. When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d4 plus your Strength modifier instead of the normal damage of an Unarmed Strike.",
    from: "Origin feat (Sailor)" }),
  // `pick: "hands"`: the feature ships TWO unarmed attacks (d6 "Weapon in Hand", d8 "Empty Hand");
  // the one that stands is picked by what the owner holds when the strike is rolled.
  "Unarmed Fighting": Object.freeze({ pick: "hands",
    rule: "When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d6 plus your Strength modifier instead of the normal damage of an Unarmed Strike. If you aren't holding any weapons or a Shield when you make the attack roll, the d6 becomes a d8.",
    from: "Fighting Style feat" })
});
const UNARMED_DICE_NAMES = tableIndex(UNARMED_DICE).names;

/**
 * A feature that turns a kit's use on a creature within `reach` into healing paid from that
 * creature's own Hit Point Dice. The kit's user picks the size in a popup; the die is spent on the
 * creature's sheet and the feature's OWN heal activity of that size is rolled at it (kit-tend.js),
 * so the healing rerolls and the cast applier carry the rest.
 *   kit    the kit item's name whose use is the moment
 *   reach  feet from the healer to the creature
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const KIT_TENDS = Object.freeze({
  "Healer": Object.freeze({ kit: "Healer's Kit", reach: 5,
    rule: "Battle Medic. If you have a Healer’s Kit, you can expend one use of it and tend to a creature within 5 feet of yourself as a Utilize action. That creature can expend one of its Hit Point Dice, and you then roll that die. The creature regains a number of Hit Points equal to the roll plus your Proficiency Bonus.",
    from: "Origin feat (Hermit)" })
});
const KIT_TEND_NAMES = tableIndex(KIT_TENDS).names;

/**
 * A Fighting Style (or general feat) whose rule turns on what its owner HOLDS or WEARS, or on how
 * the attack is made (RULINGS *The fighting styles*). fighting-styles.js keeps ONE effect per style
 * on the character — its FACE, live or greyed with the reason — read off the equipped items, so
 * nobody toggles anything; and applies the style's number to the roll it fits, with a card line,
 * a floating number over the target, and a `fightingStyle` stats record.
 *   gate       what the style reads — `twoHanded` (a Two-Handed or Versatile melee weapon in two
 *              hands), `thrown`, `offhand` (the Light weapon's extra attack), `oneHanded` (one melee
 *              weapon in one hand, no other), `armored` (any armor worn), `unarmed` (what the hands
 *              hold — the die only), `heavy` (a Heavy weapon's attack on the owner's turn),
 *              `heavyArmor`, `offhandCrossbow` (the Light extra attack with a Light crossbow),
 *              `always` (no equipment in the rule: live whenever the feat is on the sheet)
 *   minimum    the damage dice's floor (a 1 or 2 counts as 3)
 *   bonus      the damage added: "2", "@mod", "@prof", or "effect" — READ off the pack's own effect
 *              on the feat (N1); a text-only feat carries the text's number
 *   ac         "effect": the AC change the pack's own effect carries, moved onto the face
 *   takesOver  the pack ships an UNGATED effect on the feat; the machine switches it off and the
 *              face carries the rule
 *   block      a reduction the owner takes on an attack's damage while the face is live: the
 *              amount, off the owner's roll data, cut from the `types` parts before the system's
 *              resistances — at dnd5e.preCalculateDamage, so the card's own buttons carry it too
 *   feat       a general feat, not a style: its face and float wear the feat's own name
 *   ignores    "resistance": the OWNER's damage of `types` ignores the target's Resistance —
 *              dnd5e's `options.ignore.resistance`, set at dnd5e.preCalculateDamage off the damage
 *              card's actor, so the card's buttons and the module's applier both carry it
 *   typed      the types are read off the feat's NAME ("Elemental Adept (Fire)" — the pack stores
 *              no choice); every copy adds its own; a copy with none is a greyed face that says so
 *   choices    what the type pick offers when a copy lands with no type in its name
 *   spells     a SPELL's damage only; `minimum` then floors that spell's dice of `types` alone
 *   breaks     "concentration": a creature the OWNER damages saves for Concentration at
 *              Disadvantage — concentration.js reads it when it stamps the ask (the dealer, off the
 *              card), the save gate's box says so, and the roll nets it with the concentrator's own
 *              Advantage
 * The two reactions (Interception, Protection) and Blind Fighting's sight land by mechanism — the
 * interrupt tables and the gate before the roll (SWEEP §1).
 * ⚠ NOT A KIND — one table read by one machine; a second customer is a row.
 */
export const FIGHTING_STYLES = Object.freeze({
  "Great Weapon Fighting": Object.freeze({ key: "great-weapon-fighting", gate: "twoHanded", minimum: 3,
    rule: "When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.",
    from: "Fighting Style feat" }),
  "Thrown Weapon Fighting": Object.freeze({ key: "thrown-weapon-fighting", gate: "thrown", bonus: "2",
    rule: "When you hit with a ranged attack roll using a weapon that has the Thrown property, you gain a +2 bonus to the damage roll.",
    from: "Fighting Style feat" }),
  "Two-Weapon Fighting": Object.freeze({ key: "two-weapon-fighting", gate: "offhand", bonus: "@mod",
    rule: "When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren't already adding it to the damage.",
    from: "Fighting Style feat" }),
  "Dueling": Object.freeze({ key: "dueling", gate: "oneHanded", bonus: "effect", takesOver: true,
    rule: "When you're holding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
    from: "Fighting Style feat" }),
  "Defense": Object.freeze({ key: "defense", gate: "armored", ac: "effect", takesOver: true,
    rule: "While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.",
    from: "Fighting Style feat" }),
  "Unarmed Fighting": Object.freeze({ key: "unarmed-fighting", gate: "unarmed",
    rule: "When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d6 plus your Strength modifier instead of the normal damage of an Unarmed Strike. If you aren't holding any weapons or a Shield when you make the attack roll, the d6 becomes a d8. At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled by you.",
    from: "Fighting Style feat" }),
  "Great Weapon Master": Object.freeze({ key: "great-weapon-master", gate: "heavy", bonus: "@prof", feat: true,
    rule: "Heavy Weapon Mastery. When you hit a creature with a weapon that has the Heavy property as part of the Attack action on your turn, you can cause the weapon to deal extra damage to the target. The extra damage equals your Proficiency Bonus.",
    from: "General feat" }),
  "Heavy Armor Master": Object.freeze({ key: "heavy-armor-master", gate: "heavyArmor", takesOver: true, feat: true,
    block: "@prof", types: Object.freeze(["bludgeoning", "piercing", "slashing"]),
    rule: "Damage Reduction. When you’re hit by an attack while you’re wearing Heavy armor, any Bludgeoning, Piercing, and Slashing damage dealt to you by that attack is reduced by an amount equal to your Proficiency Bonus.",
    from: "General feat" }),
  // The pack ships Elemental Adept as text only and Poisoner's Potent Poison with nothing; the rows
  // are the whole mechanism.
  "Elemental Adept": Object.freeze({ key: "elemental-adept", gate: "always", feat: true, typed: true, spells: true,
    ignores: "resistance", minimum: 2, choices: Object.freeze(["acid", "cold", "fire", "lightning", "thunder"]),
    rule: "Energy Mastery. Choose one of the following damage types: Acid, Cold, Fire, Lightning, or Thunder. Spells you cast ignore Resistance to damage of the chosen type. In addition, when you roll damage for a spell you cast that deals damage of that type, you can treat any 1 on a damage die as a 2.",
    from: "General feat" }),
  // Beside Two-Weapon Fighting it adds nothing twice (the machine adds one modifier).
  "Crossbow Expert": Object.freeze({ key: "crossbow-expert", gate: "offhandCrossbow", bonus: "@mod", feat: true,
    rule: "Dual Wielding. When you make the extra attack of the Light property, you can add your ability modifier to the damage of the extra attack if that attack is with a crossbow that has the Light property and you aren’t already adding that modifier to the damage.",
    from: "General feat" }),
  "Poisoner": Object.freeze({ key: "poisoner", gate: "always", feat: true, ignores: "resistance", types: Object.freeze(["poison"]),
    rule: "Potent Poison. When you make a damage roll that deals Poison damage, it ignores Resistance to Poison damage.",
    from: "General feat" }),
  // The pack ships nothing for the breaker (its one activity is Guarded Mind's, SAVE_SUCCEEDS);
  // the row is the switch and the face, read by the concentration machine.
  "Mage Slayer": Object.freeze({ key: "mage-slayer", gate: "always", feat: true, breaks: "concentration",
    rule: "Concentration Breaker. When you damage a creature that is concentrating, it has Disadvantage on the saving throw it makes to maintain Concentration.",
    from: "General feat" })
});
const FIGHTING_STYLE_NAMES = tableIndex(FIGHTING_STYLES).names;

/**
 * THE R4 TRIPWIRE, AS DATA (DESIGN.md R4, ARCHITECTURE §6): every closed kind set the module owns,
 * with the size of the system enum it mirrors where one exists. R4's bargain is that a new ability
 * costs a data entry and zero code; its abandonment condition is kinds arriving too fast.
 * `tools/check-registry.mjs` prints this and pins the total, so ADDING A KIND FAILS THE GATE until
 * the pin is changed on purpose — a rule against *unnoticed* kinds, not new ones.
 * ⚠ `system` is the size of the dnd5e enum mirrored, or null for the module's own invention. Only
 * masteries mirror one, checked live by tools/check-mastery-rules.mjs against
 * CONFIG.DND5E.weaponMasteries.
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
      + "the ARITHMETIC is shared and already shipped with D8, so only the spend earns a kind — "
      + "bar `advantage` (keep the higher d20) and `succeed` (2026-09-27: the verdict itself, no die)" },
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
 *   label       the setting's UI name, so a warning names what to go and fix
 *   setting     the `S` key, as a STRING (declaring, not reading)
 *   columns     the `A:B` halves in order; every column is REQUIRED unless it is the kind column
 *               of a spec that declares a fallback
 *   kindColumn  which column is validated against a closed set, or null
 *   kinds       that closed set, or null
 *   fallback    ⚠ a DECLARED, WARNED substitution for an unrecognised kind, or null to drop
 *   default     the SHIPPED default for that setting
 *   membership  true — the set is ROWS of one table read by one mechanism, not a kind set: the
 *               R4 tripwire does not count it (the registry unit test pins this reading)
 *   whole       the list is parsed WHOLE-CHUNK (row names carry colons or slashes); matching is
 *               case-insensitive. For a membership list the list is the switch: an empty list
 *               does nothing, and an unlisted row stays the table's to play by hand
 * ⚠ The defaults live HERE, with the parser that must accept them, and settings.js reads them at
 * registration; the static gate imports the real string. A shipped default its own parser rejects
 * disables a feature for every fresh world (ARCHITECTURE §6).
 * ⚠ Only `interrupt` declares a fallback — the one declared exception to ARCHITECTURE §6 rule 6:
 * a mistyped interrupt is STILL a reaction worth pausing for and `ac` is the conservative reading,
 * whereas a fold with no recognised kind has no machine to run. An UNDECLARED fallback is a bug.
 */
export const LIST_SPECS = {
  interrupt: {
    label: "Interrupt List", setting: "interruptList",
    columns: ["name", "kind"], kindColumn: "kind", kinds: INTERRUPT_KINDS, fallback: "ac",
    // ⚠ Riposte is deliberately ABSENT: it triggers on a MISS (the hold offers on hits) and is not
    // an AC boost, so an entry here can only produce an every-hit nonsense hold. It lives in the
    // Maneuver Folds list.
    default: "Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, "
      + "Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, "
      + "Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage, "
      + "Lucky:roll, Warding Flare:roll, Shadowy Dodge:roll, Interception:damage, Protection:roll"
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
      + "Shield Master:bash, Great Weapon Master:hew, Commander's Strike:command, Tavern Brawler:shove, Crusher:shove, "
      + "Polearm Master:hew"
  },
  d20Folds: {
    label: "D20 Folds", setting: "d20Folds",
    columns: ["name", "kind"], kindColumn: "kind", kinds: D20_FOLD_KINDS, fallback: null,
    // ⚠ THE `name` COLUMN IS A LOOKUP KEY, NOT A DISPLAY NAME — what the card and popup SAY comes
    // from the kind (`KIND_LABEL` in d20-folds.js), and the two differ:
    //   tactical  → an ITEM on the actor with this name. Key and label agree.
    //   bardic    → the ACTIVE EFFECT the bard's Inspire applies, which the system calls
    //               "Inspired". ⚠ Key and label DISAGREE, and must: the card says Bardic
    //               Inspiration, the find looks for "Inspired".
    //   heroic    → NO LOOKUP: the marker is a boolean with no document behind it; the string is
    //               required only because every column is.
    //   seeking   → a REROLL on a spell attack's miss, paid from Font of Magic by hand; the
    //               Metamagic list must admit it too (the option's own switch).
    //   succeed   → the FEAT is the key (SAVE_SUCCEEDS), the benefit's name the label.
    default: "Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic, Ambush:tactical, Tactical Assessment:tactical, Seeking Spell:seeking, Lucky:advantage, Mage Slayer:succeed"
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
    // ⚠ The list IS the switch: an empty list turns the gate off.
    columns: ["kind"], kindColumn: "kind", kinds: REMINDER_KINDS, fallback: null,
    default: "vex, sap, prone, condition, range, effect, sneak, buy"
  },
  conditions: {
    label: "Condition Sources", setting: "conditionList",
    // A status id per entry: the switch for the `condition` kind, one condition at a time.
    columns: ["kind"], kindColumn: "kind", kinds: CONDITION_STATUSES, fallback: null, membership: true,
    default: CONDITION_KEYS.join(", ")
  },
  clockRiders: {
    label: "Clock Riders", setting: "clockRiderList",
    columns: ["kind"], kindColumn: "kind", kinds: CLOCK_RIDER_NAMES, fallback: null, membership: true, whole: true,
    // one name per FEATURE — a feature with two rows (Slasher) is listed once
    default: [...new Set(Object.values(CLOCK_RIDERS).map(row => row.feature))].join(", ")
  },
  effects: {
    label: "Effect Sources", setting: "effectList",
    columns: ["kind"], kindColumn: "kind", kinds: EFFECT_NAMES, fallback: null, membership: true, whole: true,
    default: EFFECT_KEYS.join(", ")
  },
  hitMenu: {
    label: "Hit Menu", setting: "hitMenuList",
    columns: ["kind"], kindColumn: "kind", kinds: HIT_OPTION_NAMES, fallback: null, membership: true, whole: true,
    default: Object.values(HIT_OPTIONS).map(row => row.feature).join(", ")
  },
  damageShields: {
    label: "Damage Shields", setting: "damageShieldList",
    columns: ["kind"], kindColumn: "kind", kinds: DAMAGE_SHIELD_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DAMAGE_SHIELDS).join(", ")
  },
  superiorityUses: {
    label: "Superiority Uses", setting: "superiorityUseList",
    columns: ["kind"], kindColumn: "kind", kinds: SUPERIORITY_USE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(SUPERIORITY_USES).join(", ")
  },
  effectChoices: {
    label: "Effect Choices", setting: "effectChoiceList",
    columns: ["kind"], kindColumn: "kind", kinds: EFFECT_CHOICE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(EFFECT_CHOICES).join(", ")
  },
  metamagic: {
    label: "Metamagic", setting: "metamagicList",
    columns: ["kind"], kindColumn: "kind", kinds: METAMAGIC_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(METAMAGIC).join(", ")
  },
  damageSaves: {
    label: "Damage Saves", setting: "damageSaveList",
    columns: ["kind"], kindColumn: "kind", kinds: DAMAGE_SAVE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DAMAGE_SAVES).join(", ")
  },
  emanations: {
    label: "Emanations", setting: "emanationList",
    columns: ["kind"], kindColumn: "kind", kinds: EMANATION_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(EMANATIONS).join(", ")
  },
  spentAreas: {
    label: "Spent Areas", setting: "spentAreaList",
    // Swept at the last verdict whatever the data says (saves/areas.js; the empty-instant stamp in
    // saves/demand.js).
    columns: ["kind"], kindColumn: "kind", kinds: SPENT_AREA_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(SPENT_AREAS).join(", ")
  },
  chosenAreas: {
    label: "Chosen Areas", setting: "chosenAreaList",
    columns: ["kind"], kindColumn: "kind", kinds: CHOSEN_AREA_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(CHOSEN_AREAS).join(", ")
  },
  initiativeSwaps: {
    label: "Initiative Swaps", setting: "initiativeSwapList",
    columns: ["kind"], kindColumn: "kind", kinds: INITIATIVE_SWAP_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(INITIATIVE_SWAPS).join(", ")
  },
  kitTends: {
    label: "Kit Tending", setting: "kitTendList",
    columns: ["kind"], kindColumn: "kind", kinds: KIT_TEND_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(KIT_TENDS).join(", ")
  },
  unarmedDice: {
    label: "Unarmed Strike Dice", setting: "unarmedDiceList",
    columns: ["kind"], kindColumn: "kind", kinds: UNARMED_DICE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(UNARMED_DICE).join(", ")
  },
  fightingStyles: {
    label: "Fighting Styles", setting: "fightingStyleList",
    // An unlisted style's face goes and the pack's own effect comes back on.
    columns: ["kind"], kindColumn: "kind", kinds: FIGHTING_STYLE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(FIGHTING_STYLES).join(", ")
  },
  healRerolls: {
    label: "Healing Rerolls", setting: "healRerollList",
    columns: ["kind"], kindColumn: "kind", kinds: HEAL_REROLL_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(HEAL_REROLLS).join(", ")
  },
  damageEither: {
    label: "Damage Rolled Twice", setting: "damageEitherList",
    columns: ["kind"], kindColumn: "kind", kinds: DAMAGE_EITHER_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DAMAGE_EITHER).join(", ")
  },
  tokenLights: {
    label: "Token Lights", setting: "tokenLightList",
    columns: ["kind"], kindColumn: "kind", kinds: TOKEN_LIGHT_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(TOKEN_LIGHTS).join(", ")
  },
  tokenSenses: {
    label: "Token Senses", setting: "tokenSenseList",
    columns: ["kind"], kindColumn: "kind", kinds: TOKEN_SENSE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(TOKEN_SENSES).join(", ")
  },
  tokenSizes: {
    label: "Token Sizes", setting: "tokenSizeList",
    columns: ["kind"], kindColumn: "kind", kinds: TOKEN_SIZE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(TOKEN_SIZES).join(", ")
  },
  dropToOne: {
    label: "Drop to 1 HP", setting: "dropToOneList",
    columns: ["kind"], kindColumn: "kind", kinds: DROP_TO_ONE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(DROP_TO_ONE).join(", ")
  },
  restGrants: {
    label: "Rest Grants", setting: "restGrantList",
    columns: ["kind"], kindColumn: "kind", kinds: REST_GRANT_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(REST_GRANTS).join(", ")
  },
  rebukes: {
    label: "Rebukes", setting: "rebukeList",
    columns: ["kind"], kindColumn: "kind", kinds: REBUKE_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(REBUKES).join(", ")
  },
  cardChips: {
    label: "Card Chips", setting: "cardChipList",
    columns: ["kind"], kindColumn: "kind", kinds: CARD_CHIP_NAMES, fallback: null, membership: true, whole: true,
    default: Object.keys(CARD_CHIPS).join(", ")
  }
};

/**
 * Parse one list setting against its spec. Returns `{ entries, rejects }` rather than warning —
 * the warn-once bookkeeping is the EDGE caller's (settings.js). Each reject is `{ chunk, action,
 * detail }`, action `"dropped"` or `"defaulted"` (kept with the declared fallback); the EDGE warns
 * on both, because a silently corrected entry is still a setting somebody must fix.
 */
export function parseList(spec, raw) {
  const entries = [];
  const rejects = [];
  for ( const chunk of chunks(raw) ) {
    const halves = spec.whole ? whole(chunk) : pair(chunk);
    const entry = {};
    spec.columns.forEach((col, i) => { entry[col] = halves[i]; });

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
 * The one-line sentence for a reject, built beside the rule that produced it. It names the allowed
 * kinds, so the reader learns what WOULD have worked.
 */
export function rejectMessage(spec, reject) {
  const allowed = spec.kinds ? ` (${[...spec.kinds].join("/")})` : "";
  return (reject.action === "defaulted")
    ? `${spec.label}: "${reject.chunk}" — ${reject.detail}${allowed}; read as "${spec.fallback}", never guessed further.`
    : `${spec.label}: "${reject.chunk}" — ${reject.detail}${allowed}; ignored, never guessed.`;
}
