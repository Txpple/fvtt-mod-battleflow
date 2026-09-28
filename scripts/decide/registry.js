// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the rule tables, the kind lists and their readers.
 * No `game`, no settings, no imports; the tables are the only list (ARCHITECTURE.md §6). Every `rule` is
 * the source text verbatim (law 8).
 */

/** Maneuver fold kinds; an unknown kind is dropped. `command`: an ally's Reaction attack with the
 * fighter's die (Riposte's driven attack); `shove`: a push offer on a hit, no save (bash-offer.js). */
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew", "command", "shove"]);

/** The `shove` kind's rows by feat: `on` "unarmed" or a damage type the hit deals; `reach` within 5 ft;
 * `larger` most sizes above the pusher (null: any); `used` the turn's once-mark flag; `rule` RULE_TEXT's key. */
export const SHOVES = Object.freeze({
  "Tavern Brawler": Object.freeze({ on: "unarmed", reach: true, larger: null, used: "shoveUsed", rule: "shove" }),
  "Crusher": Object.freeze({ on: "bludgeoning", reach: false, larger: 1, used: "crushUsed", rule: "crush" })
});

/** Interrupt kinds — what a held reaction changes. `roll` bends the attack roll itself (Disadvantage
 * after the hit shows; it can undo a natural 20, which `ac` never can): INTERRUPT_ROLLS. */
export const INTERRUPT_KINDS = new Set(["ac", "damage", "roll"]);

/** `damage` interrupts that MULTIPLY the triggering attack's damage for the reactor; any other damage
 * interrupt stays "reduce by hand". Keyed by the Interrupt list's names. */
export const INTERRUPT_MULTIPLIERS = Object.freeze({
  "Uncanny Dodge": Object.freeze({ multiplier: 0.5,
    rule: "When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s damage against you (round down)." })
});

/**
 * `damage` interrupts that REDUCE BY A ROLL: the pack's heal activity's formula is the reduction, rolled
 * in the open at the answer. ⚠ The Monster Manual's "Parry" is +2 AC: a row applies only where the item
 * carries the named activity (an EMPTY stored name → the first heal activity, locale-proof).
 *   pool     the activity's consumption is spent; none left offers nothing
 *   any      every damage the module applies is held for it, not only an attack hit (damage-holds.js)
 *   ally     feet — protects ANOTHER creature in reach; every guard in reach is asked, the first wins
 *   holding  "shieldOrWeapon" — a Shield or a Simple or Martial weapon held
 *   eyebrow / spend / hit / by   the card's and popup's words
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
 * The `roll` interrupts: Disadvantage on an attack already rolled — a second d20, the lower stands, the
 * verdict retaken against the live AC (decide/rescue-hit.js). They differ only in cost:
 *   reaction / uses   takes the Reaction / spends one of the item's uses;  point  what a use is called
 *   activity  the pack activity that IS this answer (a use from the sheet answers the hold)
 *   after     what the table still does once the roll is bent — a card line
 * ⚠ The 2014 Halfling "Lucky" shares the name with no uses: the lookup demands the item's own uses.
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
  // `ally`: guards another creature in reach, the first to answer bends it; `holding` "shield"; `effect`
  // the pack's effect landed on the protected creature (EFFECT_BENDS "Protected (Protection)").
  "Protection": Object.freeze({ reaction: true, uses: false, point: null, activity: "Protect", ally: 5, holding: "shield", effect: "Protected",
    rule: "When a creature you can see attacks a target other than you that is within 5 feet of you, you can take a Reaction to interpose your Shield if you're holding one. You impose Disadvantage on the triggering attack roll and all other attack rolls against the target until the start of your next turn if you remain within 5 feet of the target.",
    from: "Fighting Style feat" })
});

/**
 * d20 FOLD kinds — each names a SPEND, never a contribution shape (ARCHITECTURE.md §6):
 *   heroic     `system.attributes.inspiration`, a bare boolean — spent by a WRITE
 *   tactical   an item's uses through a real activity — `use()`
 *   bardic     the "Inspired" effect — spent by a DELETE; its die resolves on the granting bard (`origin`)
 *   advantage  a second d20, the higher stands, paid with an item use — an initiative rolled with no dialog
 *   succeed    a failed save turned into a success through the feature's activity (SAVE_SUCCEEDS)
 */
export const D20_FOLD_KINDS = new Set(["heroic", "tactical", "bardic", "seeking", "advantage", "succeed"]);

/** The closed set of volley kinds — the one definition the registry and tools/check-registry.mjs share. */
export const VOLLEY_KINDS = new Set(["damage", "attack"]);

/** The weapon masteries this module resolves; `nick` is action economy, left native (MASTERY_NATIVE). */
export const MASTERY_KINDS = new Set(["vex", "sap", "cleave", "slow", "topple", "push", "graze"]);

/** Masteries the system has and this module deliberately leaves alone. See MASTERY_KINDS. */
export const MASTERY_NATIVE = new Set(["nick"]);

/** Each mastery popup's quote, verbatim — checked against the rules journal by tools/check-mastery-rules.mjs. */
export const MASTERY_RULES = Object.freeze({
  slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn’t exceed 10 feet.",
  topple: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  push: "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  graze: "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  vex: "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  sap: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  cleave: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but don’t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."
});

/** The maneuver folds' popup quotes by kind, verbatim from the PHB compendium (mixed apostrophes and all). */
export const RULE_TEXT = {
  // ⚠ Precision's quote lives only in `RESCUE_KINDS` (decide/present.js): a second copy would drift.
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
 * Feats granting one more attack as a Bonus Action, REMINDED by the `hew` fold's popup (hew.js). A `hew`
 * list entry with no row takes Great Weapon Master's shape.
 *   when     "critOrKill" (a crit or a kill with a melee weapon) | "attack" (a qualifying weapon's attack
 *            on the owner's turn, once per turn)
 *   weapons  a base item in `base`, or every property in `properties`
 *   drive    the reminder is an OFFER: Use drives the weapon's attack at the same creature, a d4 Bludgeoning
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
 * REMINDER kinds — the sources of Advantage/Disadvantage the gate reads before an attack roll. The gate
 * never SETS a mode (DESIGN R-A): it lists every source and the net, and a human presses.
 *   vex / sap  the Vexed chip on the target / the Sapped chip on the attacker
 *   prone      attacker prone → Disadvantage; target prone → Advantage within 5 ft, else Disadvantage
 *   condition  CONDITION_BENDS · effect  EFFECT_BENDS · range  RANGE_RULES (beyond long: listed, not counted)
 *   sneak / buy  a TICK beside the roll — Sneak Attack's choice / ADVANTAGE_BUYS
 */
export const REMINDER_KINDS = new Set(["vex", "sap", "prone", "condition", "range", "effect", "sneak", "buy"]);

/**
 * Advantage on your own D20 Test bought before the roll with an item use: a tick box in the system's
 * roll dialog (advantage-buys.js), spent when the roll goes out ticked. An initiative with no dialog is
 * offered it after the roll — the `advantage` d20 fold (RULINGS *Where the table bends the rule*).
 *   tests  the D20 Tests the rule reaches;  point  what one use is called
 * ⚠ The 2014 Halfling "Lucky" shares the name with no uses — the lookup demands them.
 */
export const ADVANTAGE_BUYS = Object.freeze({
  "Lucky": Object.freeze({ uses: true, point: "Luck Point", activity: "Advantage",
    tests: Object.freeze(["attack", "save", "check", "initiative"]),
    rule: "Advantage. When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.",
    from: "Origin feat" })
});

/**
 * A feature turning a FAILED save into a success once per rest — the `succeed` d20 fold (d20-folds.js):
 * offered on a demanded save before its verdict, and on a sheet save as an offer the roller judges.
 *   activity  the feature's activity that pays;  label  the benefit's name;  abilities  the saves reached
 */
export const SAVE_SUCCEEDS = Object.freeze({
  "Mage Slayer": Object.freeze({ activity: "Guard Mind", label: "Guarded Mind",
    abilities: Object.freeze(["int", "wis", "cha"]),
    rule: "Guarded Mind. If you fail an Intelligence, a Wisdom, or a Charisma saving throw, you can cause yourself to succeed instead. Once you use this benefit, you can’t use it again until you finish a Short or Long Rest.",
    from: "General feat" })
});

/**
 * Sneak Attack, by name on the attacker's sheet; its dice read off its own damage activity (scaled, never a
 * level table). A checkbox beside the roll, pre-ticked when what the module can read holds; the dice ride
 * the damage roll (the hit-riders seam), crit-doubled, once per turn as a turn chip.
 */
export const SNEAK_ATTACK = Object.freeze({
  feature: "Sneak Attack",
  improved: "Improved Cunning Strike",     // up to TWO Cunning Strike effects
  rule: "Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage’s type is the same as the weapon’s type. You don’t need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn’t have the Incapacitated condition, and you don’t have Disadvantage on the attack roll.",
  cunning: "When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die before rolling, and the effect occurs immediately after the attack’s damage is dealt.",
  dc: "If a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus."
});

/**
 * Cunning Strike options read off the sheet: the granting FEATURE, the pack's save ACTIVITY (landed through
 * the saves machine) and the die cost. No activity → a card line (movement and stealth are the table's).
 * ⚠ Envenom Weapons' activity carries the damage (the data's 2d8 over the text's 2d6, N1) and no condition,
 * so a failure ALSO presses Poisoned (`upgrade.onFail`). Rend Mind: Psychic Blades only (`weapon`).
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

/** Death Strike: a clock rider on the Sneak Attack — the pack's activity is the save; a failure lands the
 * attack's damage a second time through the applier. */
export const DEATH_STRIKE = Object.freeze({
  feature: "Death Strike", activity: "Death Strike", when: "firstRound",
  rule: "When you hit with your Sneak Attack on the first round of a combat, the target must succeed on a Constitution saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus), or the attack’s damage is doubled against the target."
});

/**
 * Damage riders on the combat CLOCK (round or turn; chips on the target are hit-riders.js): the FEATURE by
 * name and its pack damage activity — dice read off the sheet, crit-doubled. Membership: Clock Riders.
 *   when      "oncePerTurn" (every hit out of combat) | "firstRound" (never out of combat) | "any"
 *   uses      limited uses, read off the activity, else the item its consumption names; none → not offered
 *   effects   the rider activity's effects land on the target (effect-riders.js `applyActivityEffectsOnHit`)
 *   clock     a CHIP_WINDOWS key those effects land with, pinned to the ATTACKER's place
 *   requires  "sneak" — an armed Sneak Attack only;  weapon  a weapon attack only
 *   judge     "raging" | "opportunity" (a driven Opportunity Attack, or an off-turn melee attack, ticked
 *             with the caveat) | "transformed"
 *   type      "weapon" — the weapon's damage type; otherwise the part's first
 *   dealt / crit  a damage type the hit must deal / a Critical Hit only
 *   lands     an effect with no activity to carry it: `{ name, from?, id, bare? }` — copied from the
 *             feature's effect `from` (changes dropped if `bare`), keyed by `id` so a new hit refreshes it
 *   bonusDice one more first die on a crit — dnd5e's `critical.bonusDice`, never doubled
 *   label / says / caveat   the offer's and card's words
 * Left out: choices the sheet does not record or judgments the module cannot make (Hunter's Prey,
 * Brutal Strike, Hand of Harm, Eldritch Smite, Lifedrinker's heal, Foe Slayer). Death Strike: DEATH_STRIKE.
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
  // Any attack roll (weapon, unarmed or spell), so no `weapon`; the type is the part's own.
  "fires-burn": Object.freeze({ feature: "Fire's Burn", activity: "Burn", label: "Fire's Burn", when: "any", uses: true,
    rule: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target.",
    from: "Goliath — Giant Ancestry (Fire)" }),
  "frosts-chill": Object.freeze({ feature: "Frost's Chill", activity: "Chill", label: "Frost's Chill", when: "any", uses: true, effects: true, clock: "slow",
    rule: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn.",
    from: "Goliath — Giant Ancestry (Frost)" }),
  // No activity: `amount` resolves on the bearer; the type follows the standing FORM (`forms`: an effect on
  // the bearer, or for Necrotic Shroud the module's form chip). `spells`: a no-attack damage spell is
  // offered on its card as a pick of one target (clock-riders.js).
  "celestial-revelation": Object.freeze({ feature: "Celestial Revelation", activity: null, amount: "@prof", label: "Celestial Revelation",
    when: "oncePerTurn", judge: "transformed", spells: true,
    forms: Object.freeze([
      Object.freeze({ form: "Heavenly Wings", effect: "Heavenly Wings", type: "radiant" }),
      Object.freeze({ form: "Inner Radiance", effect: "Searing Radiance", type: "radiant" }),
      Object.freeze({ form: "Necrotic Shroud", chip: "Necrotic Shroud", type: "necrotic" })
    ]),
    rule: "Once on each of your turns before the transformation ends, you can deal extra damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your Proficiency Bonus, and the extra damage’s type is either Necrotic for Necrotic Shroud or Radiant for Heavenly Wings and Inner Radiance.",
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  // ⚠ The pack's "Slashed" carries Hamstring's −10 Speed AND stands for the crit's Disadvantage (EFFECT_BENDS
  // "Slashed"), so Hamstring lands as "Hamstrung" and only the crit lands "Slashed".
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
  // The pack's "Halted" for the rest of the current turn (the `halt` clock).
  "sentinel-halt": Object.freeze({ feature: "Sentinel", activity: null, label: "Halt", when: "any", judge: "opportunity",
    lands: Object.freeze({ name: "Halted", from: "Halted", id: "bfHalted00000000" }), clock: "halt",
    says: "Speed 0 for the rest of the current turn", caveat: "only on an Opportunity Attack",
    rule: "Halt. When you hit a creature with an Opportunity Attack, the creature’s Speed becomes 0 for the rest of the current turn.",
    from: "General feat (Sentinel)" })
});

/** Text-only features whose whole consequence is a bend on the next roll: use-chips.js writes a chip named
 * as the feature, EFFECT_BENDS reads it, the roll spends it. `window` a CHIP_WINDOWS key; `changes` the
 * sheet changes. Membership: Effect Sources. */
export const USE_CHIPS = Object.freeze({
  "Steady Aim": Object.freeze({ key: "steadyAim", bend: "advantage", window: "steadyAim",
    rule: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    note: "Speed 0 until the end of the turn; the next attack roll spends it",
    changes: Object.freeze([Object.freeze({ key: "system.attributes.movement.walk", mode: 5, value: "0" })]) })
});

/**
 * A use chip of its own kind (RULINGS *Bent by choice — the rule of cool*): the feature's `activity` is
 * VETOED at the use and becomes a chip `chip` on the actor for `seconds`, spending `dose` uses. The next
 * weapon hit spends it: the save in `saves` for the ability the feat raised (decide/chips.js
 * `coatSaveAbility`) is used at the struck creatures; SAVE_PRESSES presses what the pack only names.
 * `list`: the Fighting Styles entry for the same feat is its switch.
 * ⚠ NOT A KIND — one table, one machine (use-chips.js); a second customer is a row.
 */
export const COATINGS = Object.freeze({
  "Poisoner": Object.freeze({ key: "poisoner", activity: "Apply Poison", chip: "Poison Coating", img: "icons/weapons/daggers/dagger-poisoned.webp", seconds: 60, dose: 1,
    saves: Object.freeze({ dex: "Poison Save (Dexterity)", int: "Poison Save (Intelligence)" }), list: "fightingStyles",
    rule: "As a Bonus Action, you can apply a poison dose to a weapon or piece of ammunition. Once applied, the poison retains its potency for 1 minute or until you deal damage with the poisoned item, whichever is shorter. When a creature takes damage from the poisoned item, that creature must succeed on a Constitution saving throw (DC 8 plus the modifier of the ability increased by this feat and your Proficiency Bonus) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn.",
    from: "General feat" })
});

/** A text-only feature used through another item's cast: that cast's card (`on`) offers a reminder chip
 * `chip` for `seconds`, at most `max` standing. The chip bends nothing. Membership: Card Chips. */
export const CARD_CHIPS = Object.freeze({
  "Tinker": Object.freeze({ feature: "Gnomish Lineage, Rock", on: "Prestidigitation", chip: "Tiny Clockwork Device", seconds: 28800, max: 3,
    ask: "Tinker — build a Tiny Clockwork Device (10 minutes)",
    rule: "You can spend 10 minutes casting Prestidigitation to create a Tiny clockwork device (AC 5, 1 HP), such as a toy, fire starter, or music box. When you create the device, you determine its function by choosing one effect from Prestidigitation; the device produces that effect whenever you or another creature takes a Bonus Action to activate it with a touch. If the chosen effect has options within it, you choose one of those options for the device when you create it. You can have three such devices in existence at a time, and each falls apart 8 hours after its creation or when you dismantle it with a touch as a Utilize action.",
    from: "Gnome — Gnomish Lineage (Rock)" })
});


/**
 * A save activity whose FAILURE lands a condition the pack has no effect for (the 2024 Web ships none): the
 * status is pressed via `forceStatus`, the caster as origin, as Topple presses Prone — only when the
 * activity brought no effect. ⚠ tools/audit-presses.mjs's output: re-run it after a content update. Left
 * out: Command (a choice), Sleep and Flesh to Stone (carried), Elemental Attunement and Mind Spike.
 */
export const SAVE_PRESSES = Object.freeze({
  "Web": Object.freeze({ status: "restrained", onFail: true,
    rule: "Each creature that starts its turn in the webs or that enters them during its turn must succeed on a Dexterity saving throw or have the Restrained condition while in the webs or until it breaks free." }),
  "Grease": Object.freeze({ status: "prone", onFail: true,
    rule: "When the grease appears, each creature standing in its area must succeed on a Dexterity saving throw or have the Prone condition. A creature that enters the area or ends its turn there must also succeed on that save or fall Prone." }),
  "Sleet Storm": Object.freeze({ status: "prone", onFail: true,
    rule: "When a creature enters the Cylinder for the first time on a turn or starts its turn there, it must succeed on a Dexterity saving throw or have the Prone condition and lose Concentration." }),
  // No effect on the feat's saves: Poisoned is pressed here, ending with the Poisoner's next turn.
  "Poisoner": Object.freeze({ status: "poisoned", onFail: true, expiry: "sourceEnd",
    rule: "When a creature takes damage from the poisoned item, that creature must succeed on a Constitution saving throw (DC 8 plus the modifier of the ability increased by this feat and your Proficiency Bonus) or take 2d8 Poison damage and have the Poisoned condition until the end of your next turn." })
});

/** Evasion, no choice (R1): a Dexterity save against half-on-success takes none on a success and half on a
 * failure; not while Incapacitated. The verdict's multiplier does it. */
export const EVASION = Object.freeze({
  feature: "Evasion", ability: "dex",
  rule: "When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the save and only half damage if you fail. You can’t use this feature if you have the Incapacitated condition."
});

/*
 * HOW A ROW NAMES ITS CONTENT. A row is keyed by the item's English name and FINDS the item by dnd5e's
 * `system.identifier`, stamped at creation and kept through a rename ("Heat Metal - Spellcasting" is
 * `heat-metal`); the name is the fallback, for an item with no identifier or another one.
 * `tools/check-identifiers.mjs` proves every row's identifier against the packs' snapshot.
 */

/** A row whose content's identifier is not its name's slug, name → identifier. None today. */
export const ALIASES = Object.freeze({});

/** The slug dnd5e's packs give a name: lower-case, apostrophes dropped, any other run one hyphen. */
const slug = name => String(name ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’'"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** The identifier a row's name finds its item by. */
export function identifierOf(name) {
  const aliased = /** @type {Record<string, string>} */ (ALIASES)[String(name)];
  return aliased ?? slug(name);
}

/**
 * How an item answers a row: "identifier", "name" (the fallback), or null.
 * @param {string} key  the row's name
 * @param {{ name?: string|null, identifier?: string|null, type?: string|null, system?: { identifier?: string|null } }|null|undefined} item
 *   an Item (its `system.identifier` is read) or a plain `{ name, identifier, type }`
 * @param {string[]|null} [types]  the item types the row means; null for any
 * @returns {"identifier"|"name"|null}
 */
export function matchOf(key, item, types = null) {
  if ( !item || !key ) return null;
  if ( types && !types.includes(String(item.type ?? "")) ) return null;
  const identifier = item.system?.identifier ?? item.identifier ?? null;
  if ( identifier && (identifier === identifierOf(key)) ) return "identifier";
  return (String(item.name ?? "").toLowerCase() === String(key).toLowerCase()) ? "name" : null;
}

/**
 * Does this item answer the row?
 * @param {string} key
 * @param {Parameters<typeof matchOf>[1]} item
 * @param {string[]|null} [types]
 */
export const answers = (key, item, types = null) => !!matchOf(key, item, types);

/**
 * A name-keyed table's closed, lower-cased name set and its case-insensitive lookups. `keyOf` names the
 * column a list validates against when it is not the key.
 * ⚠ List defaults derive from these names: renaming a key changes what saved settings validate against.
 * ⚠ `rowNamed` spreads the row over `{ key }`, so a row's own `key` field wins — `keyNamed` gives the table key.
 * @template T
 * @param {Record<string, T>} table
 * @param {((row: T, key: string) => string) | null} [keyOf]
 * @returns {{ names: Set<string>, keyNamed: (name: unknown) => string | null, rowNamed: (name: unknown) => (T & { key: string }) | null,
 *   keyFor: (item: any) => string | null, rowFor: (item: any) => (T & { key: string }) | null }}
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
  // An item's row: its identifier first, then its name.
  const byIdentifier = new Map();
  for ( const k of keys ) {
    const identifier = identifierOf(keyOf ? keyOf(/** @type {T} */ (table[k]), k) : k);
    if ( !byIdentifier.has(identifier) ) byIdentifier.set(identifier, k);   // the first row, as keyNamed
  }
  /** @param {Parameters<typeof matchOf>[1]} item */
  const keyFor = item => {
    const identifier = item?.system?.identifier ?? item?.identifier ?? null;
    return (identifier && byIdentifier.get(identifier)) || keyNamed(item?.name);
  };
  /** @param {Parameters<typeof matchOf>[1]} item */
  const rowFor = item => {
    const k = keyFor(item);
    return k ? { key: k, .../** @type {T} */ (table[k]) } : null;
  };
  return { names, keyNamed, rowNamed, keyFor, rowFor };
}


/**
 * The hit menu: one popup per hit, one pick per GROUP (RULINGS *The hit menu — a pick per group*). A group
 * is the paying feature (pool, die, pick limit, DC); an OPTION a sheet feature spending from it. All read
 * off the content (N1): die, pool (the consumption target by id, identifier or compendium source), save.
 * ⚠ Trip Attack's Prone effect sits on the ITEM, unlinked to the activity — `onFail` presses it.
 *   mode     "ride" (default: the die joins the damage roll) | "sweep" (rolled apart at a second creature)
 *   save     the option's save activity is used at the target after the damage;  onFail  the status pressed
 *   effects  the damage activity's effects land on the target, no save;  clock  their CHIP_WINDOWS key
 *   press    a status pressed with NO save, never over one the target has (the activity may be a utility)
 *   maxSize  the largest size reached; a larger target greys the row, an unreadable size does not
 *   line     the card's words for a consequence the table plays;  melee  melee attacks only
 * A group's `feature` is the paying feature (null: nothing to carry — Giant Ancestry); `pool` "feature"
 * (one shared pool) | "option" (each option's own uses); `max` picks; the rest are the card's words.
 * Membership: the Hit Menu list (option names). Precision Attack and Riposte are folds.
 */
export const HIT_GROUPS = Object.freeze({
  "combat-superiority": Object.freeze({ feature: "Combat Superiority", pool: "feature", label: "Combat Superiority", max: 1,
    dieLabel: "Superiority Die", eyebrow: "Maneuver", heading: "Maneuvers", per: "one maneuver per attack", from: "Fighter — Battle Master 3",
    rule: "Many maneuvers enhance an attack in some way. You can use only one maneuver per attack.",
    dc: "If a maneuver requires a saving throw, the DC equals 8 plus your Strength or Dexterity modifier (your choice) and Proficiency Bonus." }),
  // Hill's Tumble only (Fire and Frost are CLOCK_RIDERS); no feature: the text-only parent may be missing.
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


/**
 * The Battle Master's BONUS ACTION maneuvers: a use landing on a sheet, two with a die riding the next hit.
 *   use     the activity pressed, by name (`use()` consumes the pool)
 *   bonus   { key, window, what } — the rolled number as a change on the fighter's chip (the pack's has none)
 *   choice  { effectPrefix, what } — the pack's "+N" effect on whoever the fighter picks
 *   chip    { window } — a chip on the fighter;  rider  { melee?, caveat? } — the die rides the next hit
 *   marker  { effect } — the pack's effect on the TARGET, the fighter as source (EFFECT_BENDS `only`)
 * Membership: the Superiority Uses list. Rally needs no row (a heal the cast path lands).
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


/** Maneuvers adding the die to a D20 Test: the `tactical` d20 fold with the text's scope (skills,
 * Initiative), which tells them from Tactical Mind. No refund — the die is spent either way. */
export const SUPERIORITY_FOLDS = Object.freeze({
  "Ambush": Object.freeze({ skills: Object.freeze(["ste"]), initiative: true,
    rule: "When you make a Dexterity (Stealth) check or an Initiative roll, you can expend one Superiority Die and add the die to the roll, unless you have the Incapacitated condition." }),
  "Tactical Assessment": Object.freeze({ skills: Object.freeze(["his", "inv", "ins"]), initiative: false,
    rule: "When you make an Intelligence (History or Investigation) check or a Wisdom (Insight) check, you can expend one Superiority Die and add that die to the ability check." })
});

/** Every Battle Master maneuver, lower-cased: their damage activities are the DIE (damage-casts.js skips them). */
export const MANEUVER_FEATURE_NAMES = new Set([
  ...Object.values(HIT_OPTIONS).map(r => r.feature), ...Object.keys(SUPERIORITY_USES), ...Object.keys(SUPERIORITY_FOLDS),
  "Commander's Strike", "Precision Attack", "Riposte", "Parry", "Rally"
].map(n => n.toLowerCase()));

/**
 * A persistent area attached to a token, its effect on the creatures inside (DESIGN §4). A Region attached
 * to the token moves with it and raises enter / exit / turn events (`RegionDocument.createTokenEmanation`
 * builds the token-plus-radius shape). The pack ships each aura's effect; who is inside is the module's.
 *   kind       "feature" (on while the source's token is on the scene and the range resolves) | "spell"
 *              (the system's template adopted, attached to the caster, ending with it)
 *   reach      "helpful" (allies and neutrals) | "harmful" (enemies) | "all"
 *   range      null: the activity's size · a formula read off the SOURCE's roll data — ⚠ never a number for
 *              a class-scaled feature (N1) · "weaponReach": the held weapon's (10 with Reach, else 5)
 *   effect     the pack's effect by name, its changes RESOLVED against the source (else each member adds
 *              its own Charisma); null: a ring and a card only
 *   trigger    a save demanded `on` "enter" and/or "turnEnd", `oncePerTurn`; the activity's save judges
 *   heal       a heal paid `on` "turnStart" `when` "zeroHP" from `activity`
 *   remind     a notice at the source's turn start naming an AIMED heal — offered, never played (R1)
 *   holding    the ring stands only while a qualifying weapon is held (`base`, or every `properties`)
 *   alert      a reminder to the source when a reached creature itself MOVES INTO the ring (tokenMoveIn)
 *   incapacitated  inactive while the source is Incapacitated;  quiet  no card
 *   item / activity / while / pulse   see the Inner Radiance row
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
  // The pack's spell has no area (Vendor Fixes VF-003 gives it the 30-foot Emanation).
  "Pass without Trace": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Concealed", incapacitated: false,
    caveat: "the pack's effect carries the +10 to Stealth; \"leave no tracks\" is the table's",
    rule: "You radiate a concealing aura in a 30-foot Emanation for the duration. While in the aura, you and each creature you choose have a +10 bonus to Dexterity (Stealth) checks and leave no tracks.",
    from: "Druid / Ranger spell, level 2 (Concentration, 1 hour); the Wood Elf's lineage at character level 5" }),
  // Stands only while `while` stands on the bearer (landed by token-lights), reaches everyone, and pays the
  // activity's damage at the bearer's turn END (`pulse`), rolled once. ⚠ The pack models the pulse as
  // damage on use; the use here is the transform alone.
  "Inner Radiance": Object.freeze({ kind: "feature", item: "Celestial Revelation", activity: "Inner Radiance", while: "Searing Radiance",
    reach: "all", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: "Inner Radiance" }),
    rule: "Searing light temporarily radiates from your eyes and mouth. For the duration, you shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes Radiant damage equal to your Proficiency Bonus.",
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  // An invisible ring at the held weapon's reach; a hostile moving in raises the reminder (attack from the sheet).
  "Polearm Master": Object.freeze({ kind: "feature", reach: "harmful", range: "weaponReach", effect: null, incapacitated: true, quiet: true,
    holding: Object.freeze({ base: Object.freeze(["quarterstaff", "spear"]), properties: Object.freeze(["hvy", "rch"]) }),
    alert: Object.freeze({ on: "moveIn", label: "Reactive Strike",
      swing: "Take your <strong>Reaction</strong> to make one melee attack at it, from the sheet." }),
    rule: "Reactive Strike. While you’re holding a Quarterstaff, a Spear, or a weapon that has the Heavy and Reach properties, you can take a Reaction to make one melee attack against a creature that enters the reach you have with that weapon.",
    from: "General feat" })
});

/**
 * A standing effect on the DEFENDER that pays out against an attacker whose melee attack hits it, no
 * choice (R1). The dice are the pack's damage activity on the SOURCE's item, found through the effect's origin.
 *   effect    the pack's effect by name, or a map name → damage type (Fire Shield: warm burns, chill freezes)
 *   activity  the damage activity on the source's item;  melee  melee attack rolls only
 *   when      "oncePerTurn" — the defender's turn chit;  while  "tempHP" — only while temp HP stand
 *   mark      the pack ships no effect: the module writes a chip at the cast (`cast`), carrying its level
 * ⚠ Hellish Rebuke is NOT this family — a Reaction, a choice (REBUKES). Membership: Damage Shields.
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


/** A cast shipping several effects the text makes alternatives: the caster picks in a popup (R1), only the
 * pick lands. `effects` the names in order; `ask` the question. Fewer than two present asks nothing. */
export const EFFECT_CHOICES = Object.freeze({
  "Fire Shield": Object.freeze({ effects: Object.freeze(["Warm Shield", "Chill Shield"]), ask: "A warm shield or a chill shield?",
    rule: "The flames provide you with a warm shield or a chill shield, as you choose. The warm shield grants you Resistance to Cold damage, and the chill shield grants you Resistance to Fire damage.",
    from: "PHB, level 4 (10 minutes)" })
});


/**
 * A use whose text SHEDS LIGHT, carried as a `token.light` change on an effect (Foundry applies `token.*`
 * changes to the bearer's tokens), so the light follows the effect's clock and no token is written.
 * ⚠ A Foundry light's `dim` is the OUTER radius: dim = bright + "an additional".
 *   on        "self" | "targets" (every creature targeted at the use; none → the pack's use stands)
 *   item / activity   the pack item and activity whose use lands it (activity null: any use)
 *   effect    the pack effect the light rides, landed WITH it; null: the module's own, named as the item
 *   recast    "ends" — casting it again ends the caster's earlier light
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


/**
 * TOKEN_LIGHTS' sibling for senses (`sight` and `detectionModes`; a `sight.visionMode` override inflates
 * the mode's defaults), added to the PACK's effect as it is created. `vision` a CONFIG.Canvas.visionModes
 * key; `detect` { mode, range }; `range` the sight range in feet; `effect` its name when not the row key.
 */
export const TOKEN_SENSES = Object.freeze({
  "Stonecunning": Object.freeze({ effect: "Stonecunning", vision: "tremorsense", range: 60,
    detect: Object.freeze({ mode: "feelTremor", range: 60 }),
    caveat: "always counted as on stone (user, 2026-09-25: no way to read the surface)",
    rule: "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching a stone surface to use this Tremorsense. The stone can be natural or worked.",
    from: "Dwarf" })
});


/**
 * Size changes added to the PACK's effect as it is created — `token.width`/`height` and `system.traits.size`
 * — so every size reader sees them. ⚠ dnd5e resizes a token only when the SOURCE size changes.
 *   effects  { effectName: { size } | { step } } — an absolute size, or categories from the bearer's, clamped
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


/**
 * What a feature grants on finishing a rest that the platform does not give, riding the rest's own update
 * (rest-grants.js, `dnd5e.preRestCompleted`). Keyed by the feature's name.
 *   grant    "inspiration" | "temphp" (the heal activity's amount; only where it beats what is held) |
 *            "meal" (extra dice for a creature spending Hit Dice in the same Short Rest)
 *   to       "allies" — the owner GIVES it in a popup after the rest (holders greyed); else the owner gains it
 *   feature  the feat on the sheet when the row is one of its benefits;  self  the owner may pick itself
 *   reach    feet from the owner (null: every ally on the scene);  cap  "prof", a number or a formula
 *   activity / activities  the heal activity, or one per ability (the feat's own ASI picks, else the
 *            higher modifier — decide/chips.js);  label  the rest card's name for the one kept
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
  // Chef's two benefits, a row each; the treats are handed out as their temp HP (RULINGS *Bent by choice*).
  "Bolstering Treats": Object.freeze({ feature: "Chef", rests: Object.freeze(["long"]), grant: "temphp", to: "allies", self: true, reach: null, cap: "prof",
    activity: "Bolstering Treats",
    rule: "Bolstering Treats. With 1 hour of work or when you finish a Long Rest, you can cook a number of treats equal to your Proficiency Bonus if you have ingredients and Cook’s Utensils on hand. These special treats last 8 hours after being made. A creature can use a Bonus Action to eat one of those treats to gain a number of Temporary Hit Points equal to your Proficiency Bonus.",
    from: "General feat (Chef)" }),
  "Replenishing Meal": Object.freeze({ feature: "Chef", rests: Object.freeze(["short"]), grant: "meal", to: "allies", self: true, reach: null, cap: "4 + @prof",
    activity: "Replenishing Meal",
    rule: "Replenishing Meal. As part of a Short Rest, you can cook special food if you have ingredients and Cook’s Utensils on hand. You can prepare enough of this food for a number of creatures equal to 4 plus your Proficiency Bonus. At the end of the Short Rest, any creature who eats the food and spends one or more Hit Dice to regain Hit Points regains an extra 1d8 Hit Points.",
    from: "General feat (Chef)" })
});


/**
 * What turns a drop to 0 HP into 1 (drop-to-one.js: the 1 written in the damage's own update).
 *   ask       "you can" — held at 1 and the owner asked; false — it simply happens and a card says so
 *   uses      the item's own uses pay;  effect  the effect whose presence is the row, removed when it fires
 *   ends      the spell ends when it fires;  outright  it also stands against damage that kills outright
 */
export const DROP_TO_ONE = Object.freeze({
  "Death Ward": Object.freeze({ ask: false, effect: "Protection from Death", ends: true, outright: true,
    rule: "The first time the target would drop to 0 Hit Points before the spell ends, the target instead drops to 1 Hit Point, and the spell ends.",
    from: "PHB, level 4 (8 hours)" }),
  "Relentless Endurance": Object.freeze({ ask: true, uses: true, outright: false,
    rule: "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can’t do so again until you finish a Long Rest.",
    from: "Orc" })
});


/**
 * A Reaction after the bearer takes damage, aimed at the damager (rebukes.js): a popup to the owner when
 * the damager stands in reach — Riposte's shape, on damage. The reach is the reaction activity's (N1).
 *   activity  the reaction activity (null: the first);  range  feet, where the activity carries none
 *   attack    "melee" — the answer is one melee attack with a weapon the bearer picks
 *   while     an effect that must stand on the bearer;  equipped  the item must be equipped
 *   ward      a BYSTANDER within `range` of a damager who hit someone else is asked;  hit  attack damage only
 *   opportunity  the answer is an Opportunity Attack (CLOCK_RIDERS "sentinel-halt" reads it)
 * A spell answers at the lowest slot held — no picker in a Reaction's window.
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
  // The pack's Sentinel has no activity: the answer is one melee attack with the weapon last swung.
  "Sentinel": Object.freeze({ attack: "melee", range: 5, ward: true, hit: true, opportunity: true, from: "General feat",
    caveat: "its Disengage half — nothing records a Disengage",
    rule: "Guardian. Immediately after a creature within 5 feet of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against that creature." })
});


/** A damage activity whose text ties a SAVE to the damage (Heat Metal): damage-casts.js rolls `damage`,
 * then uses `save` at the same targets. The drop is the table's (R1): `line` says so on the card. */
export const DAMAGE_SAVES = Object.freeze({
  "Heat Metal": Object.freeze({ damage: Object.freeze(["Cast and Heat", "Reheat"]), save: "On Damage Save",
    line: "Played at the table: on a failed save the creature drops the object if it can — remove Heated Metal if it did; a creature that keeps hold of it has Disadvantage on attack rolls and ability checks until the start of the caster's next turn.",
    rule: "Choose a manufactured metal object, such as a metal weapon or a suit of Heavy or Medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 Fire damage when you cast the spell. Until the spell ends, you can take a Bonus Action on each of your later turns to deal this damage again if the object is within range. If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn’t drop the object, it has Disadvantage on attack rolls and ability checks until the start of your next turn.",
    from: "PHB, level 2 (Concentration, 1 minute)" })
});


/** The two lifecycles an emanation can have — the closed set the R4 tripwire counts. */
export const EMANATION_KINDS = new Set(["feature", "spell"]);

/**
 * Areas whose DATA lies about their life, spent at their last verdict (saves/areas.js reads every other
 * area's life off the data). `data` says what the pack writes instead.
 * ⚠ A row is a claim about the TEXT: a genuinely persisting area (Grease, Web, Cloudkill) must never be listed.
 */
export const SPENT_AREAS = Object.freeze({
  "Noxious Miasma": Object.freeze({
    rule: "Constitution Saving Throw: DC 17, each creature in a 20-foot-radius Sphere centered on a point the dragon can see within 90 feet. Failure: 7 (2d6) Poison damage, and the target takes a −2 penalty to AC until the end of its next turn.",
    data: "Monster Manual, Adult Green Dragon — the activity's duration reads 1 turn: the AC penalty's clock, not the cloud's" }),
  "Hypnotic Pattern": Object.freeze({
    rule: "You create a twisting pattern of colors that weaves through the air inside a 30-foot Cube within range. The pattern appears for a moment and vanishes. Each creature in the area who can see the pattern must succeed on a Wisdom saving throw or have the Charmed condition for the duration.",
    data: "PHB, level 3 (Concentration, 1 minute) — the DURATION is the Charmed condition's; the pattern \"appears for a moment and vanishes\", and an imported copy missing the concentration flag falls into the GM's bucket" }),
  // The area only CHOOSES the targets; the pack writes the spell's minute on the activity.
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

/**
 * Area spells whose CASTER chooses who is affected: when the area holds anyone not hostile, or more
 * hostiles than allowed, the caster is asked (saves/demand.js, metamagic.js); Careful Spell greys.
 * ⚠ BY NAME, NOT BY FLAG (ARCHITECTURE §6): dnd5e's `target.affects.choice` is off on Slow, Sleep and both
 * Conjures. The number allowed is read off the text (decide/metamagic.js `choiceCapFrom`).
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

/** The 2024 Rules Glossary on range, verbatim (the source's enrichers render as bare names). */
export const RANGE_RULES = Object.freeze({
  long: "Your attack roll has Disadvantage when your target is beyond normal range, and you can’t attack a target beyond long range.",
  single: "If a ranged attack, such as one made with a spell, has a single range, you can’t attack a target beyond this range.",
  close: "When you make a ranged attack roll with a weapon, a spell, or some other means, you have Disadvantage on the roll if you are within 5 feet of an enemy who can see you and doesn’t have the Incapacitated condition."
});

/**
 * Attacker feats that take away RANGE_RULES rows; a cancelled row is still LISTED with the feat, never counted.
 *   scope    "rangedWeapon" (never a thrown melee weapon) | "spell" | "crossbow" (by dnd5e's base item)
 *   cancels  the rows taken away ("long", "close"); beyond long range still cannot be attacked
 *   cover    Half and Three-Quarters Cover ignored: each target's recorded AC drops the bonus (Total stays)
 *   reach    feet added to a spell's range of at least 10 feet
 * No list of its own: the Reminder Sources' `range` kind is their switch too.
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
 * What the 2024 conditions do to an ATTACK ROLL, both roles — glossary clauses verbatim; decided by
 * decide/reminders.js `conditionSources`. ⚠ The Condition Sources list's closed set and default derive
 * from these keys: a new condition is a row here and nothing else. Prone lives in `proneSources`.
 *   caveat  counted, and said;  note  listed, never counted
 *   critWithinFeet  a hit from within that many feet is a Critical Hit (auto-damage.js `critFor`)
 * @type {Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: string, caveat?: string, note?: string, critWithinFeet?: number}>>>}
 */
export const CONDITION_BENDS = Object.freeze({
  blinded: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: "Attack rolls against you have Advantage, and your attack rolls have Disadvantage." }),
  invisible: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: "Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature." }),
  // The system's Hiding status: the glossary's Unseen Attackers and Targets clause.
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
 * What the 2024 conditions do to a SAVING THROW (glossary verbatim), read by decide/reminders.js
 * `saveSources`. `autoFail`: the save CANNOT succeed — a fourth button, still pressed (R1).
 * Not here: Exhaustion (dnd5e applies it); Poisoned and Frightened touch checks and attacks only.
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
 * What the 2024 conditions do to an ABILITY CHECK (never initiative), glossary verbatim.
 * ⚠ The platform already rolls a Poisoned check at Disadvantage: `platform` marks a reminder, never a
 * second application. Exhaustion is the system's subtraction — no row.
 * @type {Readonly<Record<string, Readonly<{bend: "advantage"|"disadvantage", rule: string, platform?: boolean}>>>}
 */
export const CHECK_BENDS = Object.freeze({
  poisoned: Object.freeze({ bend: "disadvantage", platform: true,
    rule: "You have Disadvantage on attack rolls and ability checks." }),
  frightened: Object.freeze({ bend: "disadvantage",
    rule: "You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight." })
});

/**
 * Abilities that bend a roll, as an ACTIVE EFFECT on the sheet or a FEATURE with no effect; read by the
 * attack, check and save gates.
 *   match     "effect" (default) | "feature" — ⚠ a feature row must never name something that also lands
 *             as an effect (Innate Sorcery the feature is always on the sheet)
 *   counted   false — LISTED, not counted: the caveat IS the rule
 *   judge     a fact the module holds; an unknown map fact counts the row (the gate never guesses an exemption)
 *   spend     "attack" — the next attack roll uses the effect up, with a receipt
 *   only / except  "source" — the bend is for / against all but the creature that placed it (the module's
 *             stamp, else the origin); with no source `only` skips the row and `except` counts it
 *   checks / checksWhen  a bend on the bearer's ability checks, narrowed to { statuses, skills }
 *   saves     { bend, statuses?, spells?, halfToNone? } scoped by the demand, or { succeeds, sleep } — the
 *             save cannot fail against magical sleep (a fourth button)
 * ⚠ Names are the packs' own, colons and all.
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
  // --- B. the effect sits on the creature the feature is USED ON, the source judging (`only`/`except`);
  // read on the owner's own sheet these fire for nobody. A caveat stays where a fact is unreadable.
  "Vow of Enmity": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", from: "Paladin",
    rule: "You have Advantage on attack rolls against the creature for 1 minute or until you use this feature again." }),
  // The pack's effect is on the MONSTER; the marked creature is nowhere in the data.
  "Prey: Attack Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Marked as Prey (monsters)",
    caveat: "counted — press Normal if this attack is not at the marked creature",
    rule: "It has Advantage on attack rolls against the target until the start of its next turn." }),
  // Both sides are the source's alone.
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
  // The packs carry no data for these save bends; the rows are where it lives.
  "Aura of Purity": Object.freeze({ attacker: null, target: null, scope: "any", from: "Aura of Purity",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["blinded", "charmed", "deafened", "frightened", "paralyzed", "poisoned", "stunned"]) }),
    rule: "While in the aura, you and your allies have Resistance to Poison damage and Advantage on saving throws to avoid or end effects that include the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned condition." }),
  "Circle's Power": Object.freeze({ attacker: null, target: null, scope: "any", from: "Circle of Power",
    saves: Object.freeze({ bend: "advantage", spells: true, halfToNone: true }),
    rule: "While in the aura, you and your allies have Advantage on saving throws against spells and other magical effects. When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save." }),
  "Cursed Attacks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Bestow Curse",
    caveat: "counted — press Normal if this attack is not at the caster",
    rule: "While cursed, the target has Disadvantage on attack rolls against you." }),
  // `item`: only an effect from THIS item (the Aura of Protection's "Protected" is a save bonus).
  "Protected": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good", item: "Protection from Evil and Good",
    caveat: "counted — press Normal if the attacker is not an Aberration, Celestial, Elemental, Fey, Fiend or Undead",
    rule: "Creatures of those types have Disadvantage on attack rolls against the target." }),
  // The "Protected" the Protection answer lands (hold/continue.js), found by `named`; it bends only
  // while the guard stands within `sourceWithin` feet.
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
  // On the TARGET, the fighter as source (superiority-uses.js): the fighter's next attack alone spends it.
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
  // --- D. a feature, matched by name. Pack Tactics is judged on the map; its caveat is an unknown side.
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
  // --- E. a use chip, named as the feature (the pack ships Steady Aim with no effect), and the combat
  // clock as judge (`targetNotActed`: the round and the turn order; never out of combat).
  "Steady Aim": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack",
    rule: "As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
    from: "Rogue 3 (a use chip)" }),
  "Assassinate": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any",
    judge: "targetNotActed",
    rule: "During the first round of each combat, you have Advantage on attack rolls against any creature that hasn’t taken a turn.",
    from: "Rogue — Assassin (Surprising Strikes)" }),
  // --- G. species traits bending SAVES (text only in the pack, read by name). A sheet save to END the
  // condition has no demand: listed, never counted (R1).
  "Brave": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Halfling",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["frightened"]) }),
    rule: "You have Advantage on saving throws you make to avoid or end the Frightened condition." }),
  "Fey Ancestry": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["charmed"]) }),
    rule: "You have Advantage on saving throws you make to avoid or end the Charmed condition." }),
  "Dwarven Resilience": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Dwarf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["poisoned"]) }),
    rule: "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition." }),
  // Cannot fail a save whose failure would sleep it (decide/demand.js `putsToSleep`).
  "Trance": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ succeeds: true, sleep: true }),
    rule: "You don’t need to sleep, and magic can’t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness." }),
  // While Grappled, its Athletics and Acrobatics checks count as the escape
  // (RULINGS *Where the table bends the rule*); the pack's effect carries only the carrying capacity.
  "Powerful Build": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Goliath",
    checks: "advantage", checksWhen: Object.freeze({ statuses: Object.freeze(["grappled"]), skills: Object.freeze(["ath", "acr"]) }),
    caveat: "counted — while Grappled, an Athletics or Acrobatics check counts as the escape",
    rule: "You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity." })
});

/** The table's rows, in the order the table reads them. */
export const EFFECT_KEYS = Object.freeze(Object.keys(EFFECT_BENDS));




/**
 * The ten 2024 metamagic options by feat name (RULINGS *Metamagic*): `when` a named predicate on the spell
 * (decide/metamagic.js), `moment` when it is offered, `picks` what it asks beyond the tick, `apply` prose.
 * ⚠ NO COST HERE (N1): the cost is the option's consumption target, and the rule text the feat's, read live.
 */
export const METAMAGIC = Object.freeze({
  "Careful Spell":    { key: "careful",    moment: "cast",   when: "save",       picks: "protect", apply: "the protected creatures leave the save demand",
    // CHOSEN_AREAS already leave the unchosen out, so Careful buys nothing there.
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
/** Twinned Spell's exceptions to "the target count grows with the level" (tools/probe-twinnable.mjs):
 * `except` the extra is a dart, ray, corpse or arrow; `also` the text grants it but the count is flat. */
export const TWINNED_EXCEPTIONS = Object.freeze({
  except: Object.freeze(["Magic Missile", "Scorching Ray", "Animate Dead", "Create Undead", "Cordon of Arrows", "Tasha's Mind Whip"]),
  also: Object.freeze(["Jump"])
});

/**
 * A feature that rolls a weapon's damage dice again, the higher total standing; the popup asks only
 * WHETHER (dice-changers.js; decide/damage-dice.js). The activity's own dice only, doubled on a crit.
 *   key  the once-per-turn chit's riderKey (combatants only);  one  ONE die rerolled, the new roll stands
 *   weapon / dealt   a weapon hit only / a damage type the hit must deal
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 */
export const DAMAGE_EITHER = Object.freeze({
  "Savage Attacker": Object.freeze({ key: "savage-attacker", weapon: true,
    rule: "Once per turn when you hit a target with a weapon, you can roll the weapon’s damage dice twice and use either roll against the target.",
    from: "Origin feat" }),
  // `one`: the die with the most to gain (its average less its face), so the popup never asks which. With
  // Savage Attacker too, one popup: Savage's set first, then this die.
  "Piercer": Object.freeze({ key: "piercer", one: true, dealt: "piercing",
    rule: "Puncture. Once per turn, when you hit a creature with an attack that deals Piercing damage, you can reroll one of the attack’s damage dice, and you must use the new roll.",
    from: "General feat" })
});

/**
 * A feature that rerolls a healing die on the `reroll` face, automatically, before the healing lands once
 * (heal-rerolls.js). `spells`: the owner's healing spells qualify; `own`: the feature's own healing — the
 * pack's `r1` is stripped from those formulas so the machine does the reroll.
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 */
export const HEAL_REROLLS = Object.freeze({
  "Healer": Object.freeze({ reroll: 1, spells: true, own: true,
    rule: "Healing Rerolls. Whenever you roll a die to determine the number of Hit Points you restore with a spell or with this feat’s Battle Medic benefit, you can reroll the die if it rolls a 1, and you must use the new roll.",
    from: "Origin feat (Hermit)" })
});

/** Trade Initiative with a willing ally: once every combatant has rolled, the owner is asked once per
 * combat (initiative-swap.js). ⚠ NOT A KIND — a second customer is a row. */
export const INITIATIVE_SWAPS = Object.freeze({
  "Alert": Object.freeze({
    rule: "Initiative Swap. Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can’t make this swap if you or the ally has the Incapacitated condition.",
    from: "Origin feat (Criminal, Guard)" })
});

/**
 * An Unarmed Strike die "instead of the normal damage": the pack ships it only on the feature's own attack,
 * so unarmed-dice.js swaps that formula in at `preRollDamageV2`. A strike already rolling a die (Martial
 * Arts) is left alone. ⚠ NOT A KIND — a second customer is a row.
 */
export const UNARMED_DICE = Object.freeze({
  "Tavern Brawler": Object.freeze({
    rule: "Enhanced Unarmed Strike. When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d4 plus your Strength modifier instead of the normal damage of an Unarmed Strike.",
    from: "Origin feat (Sailor)" }),
  // `pick: "hands"`: two pack attacks (d6 weapon in hand, d8 empty hand); what the owner holds picks one.
  "Unarmed Fighting": Object.freeze({ pick: "hands",
    rule: "When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d6 plus your Strength modifier instead of the normal damage of an Unarmed Strike. If you aren't holding any weapons or a Shield when you make the attack roll, the d6 becomes a d8.",
    from: "Fighting Style feat" })
});

/** A kit use on a creature within `reach`, healed from its own Hit Point Dice: the size is picked in a popup
 * and the feature's heal activity of that size rolled (kit-tend.js). ⚠ NOT A KIND — a second customer is a row. */
export const KIT_TENDS = Object.freeze({
  "Healer": Object.freeze({ kit: "Healer's Kit", reach: 5,
    rule: "Battle Medic. If you have a Healer’s Kit, you can expend one use of it and tend to a creature within 5 feet of yourself as a Utilize action. That creature can expend one of its Hit Point Dice, and you then roll that die. The creature regains a number of Hit Points equal to the roll plus your Proficiency Bonus.",
    from: "Origin feat (Hermit)" })
});

/**
 * A style or feat whose rule turns on what the owner HOLDS or WEARS (RULINGS *The fighting styles*):
 * fighting-styles.js keeps one FACE effect per style, live or greyed, read off the equipped items, and
 * applies its number to the roll it fits.
 *   gate       twoHanded | thrown | offhand (the Light extra attack) | oneHanded | armored | unarmed | heavy
 *              (on the owner's turn) | heavyArmor | offhandCrossbow | always (no equipment in the rule)
 *   minimum    the damage dice's floor;  bonus  "2" | "@mod" | "@prof" | "effect" (the pack effect's, N1)
 *   ac         "effect" — the pack effect's AC change, moved onto the face
 *   takesOver  the pack's UNGATED effect is switched off; the face carries the rule
 *   block      cut from `types` damage before resistances, at dnd5e.preCalculateDamage (the card's buttons too)
 *   ignores    "resistance" — the owner's `types` damage ignores Resistance (`options.ignore.resistance`)
 *   typed      types read off the feat's NAME ("Elemental Adept (Fire)"); none → a greyed face;  choices  the pick
 *   spells     spell damage only;  feat  a general feat (its face wears the feat's name)
 *   breaks     "concentration" — creatures the owner damages save at Disadvantage (concentration.js)
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
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
  // The pack ships Elemental Adept as text and Potent Poison as nothing: the rows are the mechanism.
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
  // No pack data for the breaker: the row is the switch and the face (concentration.js reads it).
  "Mage Slayer": Object.freeze({ key: "mage-slayer", gate: "always", feat: true, breaks: "concentration",
    rule: "Concentration Breaker. When you damage a creature that is concentrating, it has Disadvantage on the saving throw it makes to maintain Concentration.",
    from: "General feat" })
});

/**
 * THE R4 TRIPWIRE (DESIGN.md R4, ARCHITECTURE §6): every closed kind set, with the size of the dnd5e enum it
 * mirrors (`system`; null for the module's own). tools/check-registry.mjs pins the total, so ADDING A KIND
 * FAILS THE GATE until the pin moves on purpose. Only masteries mirror one (tools/check-mastery-rules.mjs).
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

/**
 * THE KIND LISTS: which content takes which kind, where the table of the kind itself does not say.
 * The code table is the only list; a world never edits one.
 * ⚠ Riposte is ABSENT from INTERRUPTS: it triggers on a MISS and boosts no AC, so there it would hold
 * every hit. It is a maneuver fold.
 * ⚠ D20_FOLDS' `name` is a LOOKUP KEY, the card's words come from the kind (d20-folds.js `KIND_LABEL`):
 *   tactical → an item by this name · bardic → the "Inspired" EFFECT (the card says Bardic Inspiration)
 *   heroic → no lookup (a boolean) · seeking → METAMAGIC must hold it too · succeed → the FEAT (SAVE_SUCCEEDS)
 */
const row = (name, kind) => Object.freeze({ name, kind });
export const INTERRUPTS = Object.freeze([
  row("Shield", "ac"), row("Absorb Elements", "damage"), row("Uncanny Dodge", "damage"), row("Defensive Duelist", "ac"),
  row("Illusory Self", "ac"), row("Glorious Defense", "ac"), row("Parry", "ac"), row("Counterattack", "ac"),
  row("Defensive Stance", "ac"), row("Whirlwind of Sand", "ac"), row("Deflect Attacks", "damage"),
  row("Stone's Endurance", "damage"), row("Lucky", "roll"), row("Warding Flare", "roll"), row("Shadowy Dodge", "roll"),
  row("Interception", "damage"), row("Protection", "roll")
]);
/** Which spells a reaction stops outright. */
export const BLOCKS = Object.freeze([Object.freeze({ spell: "Magic Missile", reaction: "Shield" })]);
export const MANEUVER_FOLDS = Object.freeze([
  row("Precision Attack", "precision"), row("Riposte", "riposte"), row("Shield Master", "interpose"),
  row("Shield Master", "bash"), row("Great Weapon Master", "hew"), row("Commander's Strike", "command"),
  row("Tavern Brawler", "shove"), row("Crusher", "shove"), row("Polearm Master", "hew")
]);
export const D20_FOLDS = Object.freeze([
  row("Heroic Inspiration", "heroic"), row("Tactical Mind", "tactical"), row("Inspired", "bardic"),
  row("Ambush", "tactical"), row("Tactical Assessment", "tactical"), row("Seeking Spell", "seeking"),
  row("Lucky", "advantage"), row("Mage Slayer", "succeed")
]);
/** Which marks pay, by system identifier. What they pay is read from the mark. */
export const RIDERS = Object.freeze(["hunters-mark", "hex", "great-old-one-hex"].map(name => Object.freeze({ name })));
/** Which of the attacker's own features replaces a mark's damage, by identifier. */
export const RIDER_UPGRADES = Object.freeze([Object.freeze({ feature: "foe-slayer", rider: "hunters-mark" })]);

/** The kind lists and the closed set each one's kinds come from, for tools/check-registry.mjs. */
export const KIND_LISTS = Object.freeze({
  INTERRUPTS: { rows: INTERRUPTS, kinds: INTERRUPT_KINDS },
  MANEUVER_FOLDS: { rows: MANEUVER_FOLDS, kinds: MANEUVER_KINDS },
  D20_FOLDS: { rows: D20_FOLDS, kinds: D20_FOLD_KINDS }
});

/* THE READERS: fresh copies, so no caller can edit a table. A membership reader is every row of its
 * table, as `{ kind }` lower-cased. */
const copies = rows => rows.map(r => ({ ...r }));
const everyRow = names => [...new Set(names)].map(n => ({ kind: String(n).toLowerCase() }));

/** The listed kinds of a membership reader, as a set. */
export const listedNames = entries => new Set(entries.map(e => String(e.kind ?? "").toLowerCase()));

export const interruptEntries = () => copies(INTERRUPTS);
export const blockEntries = () => copies(BLOCKS);
export const maneuverFoldEntries = () => copies(MANEUVER_FOLDS);
export const d20FoldEntries = () => copies(D20_FOLDS);
export const riderEntries = () => copies(RIDERS);
export const riderUpgradeEntries = () => copies(RIDER_UPGRADES);
export const reminderEntries = () => everyRow(REMINDER_KINDS);
export const conditionEntries = () => everyRow(CONDITION_KEYS);
export const effectEntries = () => everyRow(EFFECT_KEYS);
export const clockRiderEntries = () => everyRow(Object.values(CLOCK_RIDERS).map(r => r.feature));
export const hitMenuEntries = () => everyRow(Object.values(HIT_OPTIONS).map(r => r.feature));
export const emanationEntries = () => everyRow(Object.keys(EMANATIONS));
export const damageShieldEntries = () => everyRow(Object.keys(DAMAGE_SHIELDS));
export const initiativeSwapEntries = () => everyRow(Object.keys(INITIATIVE_SWAPS));
export const kitTendEntries = () => everyRow(Object.keys(KIT_TENDS));
export const fightingStyleEntries = () => everyRow(Object.keys(FIGHTING_STYLES));
export const unarmedDiceEntries = () => everyRow(Object.keys(UNARMED_DICE));
export const healRerollEntries = () => everyRow(Object.keys(HEAL_REROLLS));
export const damageEitherEntries = () => everyRow(Object.keys(DAMAGE_EITHER));
export const cardChipEntries = () => everyRow(Object.keys(CARD_CHIPS));
export const rebukeEntries = () => everyRow(Object.keys(REBUKES));
export const dropToOneEntries = () => everyRow(Object.keys(DROP_TO_ONE));
export const restGrantEntries = () => everyRow(Object.keys(REST_GRANTS));
export const tokenSizeEntries = () => everyRow(Object.keys(TOKEN_SIZES));
export const tokenSenseEntries = () => everyRow(Object.keys(TOKEN_SENSES));
export const tokenLightEntries = () => everyRow(Object.keys(TOKEN_LIGHTS));
export const damageSaveEntries = () => everyRow(Object.keys(DAMAGE_SAVES));
export const superiorityUseEntries = () => everyRow(Object.keys(SUPERIORITY_USES));
export const effectChoiceEntries = () => everyRow(Object.keys(EFFECT_CHOICES));
export const metamagicEntries = () => everyRow(Object.keys(METAMAGIC));

/**
 * Is this area's item one swept at the last verdict whatever its data says?
 * @param {Parameters<typeof matchOf>[1]|string|null|undefined} item  the item, or a name off a flag
 */
export function spentAreaListed(item) {
  const index = tableIndex(SPENT_AREAS);
  return !!((typeof item === "string") ? index.keyNamed(item) : index.keyFor(item));
}

/**
 * Is this spell one whose caster chooses who its area affects?
 * @param {Parameters<typeof matchOf>[1]|string|null|undefined} item  the item, or a name off a flag
 */
export function chosenAreaListed(item) {
  const index = tableIndex(CHOSEN_AREAS);
  return !!((typeof item === "string") ? index.keyNamed(item) : index.keyFor(item));
}
