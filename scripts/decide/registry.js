// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the rule tables, the kind lists and their readers.
 * No `game`, no settings, no imports; the tables are the only list (ARCHITECTURE.md §6). Every `rule` is
 * a pointer to the book (law 8; rule-text.js reads it).
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
    rule: Object.freeze({ item: "Uncanny Dodge", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeUncannyDod" }) })
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
    rule: Object.freeze({ item: "Parry", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvParry00000" }),
    from: "Fighter — Battle Master 3" }),
  "Stone's Endurance": Object.freeze({ activity: "Heal", pool: true,
    eyebrow: "Reaction", spend: "use", hit: "attack", by: "1d12 plus your Constitution modifier", any: true,
    rule: Object.freeze({ item: "Stone's Endurance", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptStonesEndu" }),
    from: "Goliath — Giant Ancestry (Stone)" }),
  "Interception": Object.freeze({ activity: "Intercept", pool: false,
    eyebrow: "Reaction", spend: "Reaction", hit: "attack", by: "1d10 plus your Proficiency Bonus", ally: 5, holding: "shieldOrWeapon",
    rule: Object.freeze({ item: "Interception", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstIntercepti" }),
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
    rule: Object.freeze({ item: "Lucky", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftLucky000000", benefit: "Disadvantage" }),
    from: "Origin feat" }),
  "Warding Flare": Object.freeze({ reaction: true, uses: true, point: null, activity: "Flare",
    rule: Object.freeze({ item: "Warding Flare", uuid: "Compendium.dnd-players-handbook.classes.Item.phbclcWardingFla" }),
    from: "Cleric — Light Domain 3" }),
  "Shadowy Dodge": Object.freeze({ reaction: true, uses: false, point: null, activity: "Shadowy Dodge",
    after: "teleport up to 30 feet if you wish (the table moves the token)",
    rule: Object.freeze({ item: "Shadowy Dodge", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrShadowyDod" }),
    from: "Ranger — Gloom Stalker" }),
  // `ally`: guards another creature in reach, the first to answer bends it; `holding` "shield"; `effect`
  // the pack's effect landed on the protected creature (EFFECT_BENDS "Protected (Protection)").
  "Protection": Object.freeze({ reaction: true, uses: false, point: null, activity: "Protect", ally: 5, holding: "shield", effect: "Protected",
    rule: Object.freeze({ item: "Protection", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstProtection" }),
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

/** Each mastery popup's rule: a pointer to the mastery's page in dnd5e's rules (rule-text.js reads it). */
export const MASTERY_RULES = Object.freeze({
  slow: Object.freeze({ page: "mastery", key: "slow" }),
  topple: Object.freeze({ page: "mastery", key: "topple" }),
  push: Object.freeze({ page: "mastery", key: "push" }),
  graze: Object.freeze({ page: "mastery", key: "graze" }),
  vex: Object.freeze({ page: "mastery", key: "vex" }),
  sap: Object.freeze({ page: "mastery", key: "sap" }),
  cleave: Object.freeze({ page: "mastery", key: "cleave" })
});

/** The maneuver folds' popup rules by kind, as pointers to the book. */
export const RULE_TEXT = {
  // ⚠ Precision's quote lives only in `RESCUE_KINDS` (decide/present.js): a second copy would drift.
  riposte: Object.freeze({ item: "Riposte", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvRiposte000" }),
  bash: Object.freeze({ item: "Shield Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftShieldMaste", benefit: "Shield Bash" }),
  shove: Object.freeze({ item: "Tavern Brawler", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftTavernBrawl", benefit: "Push" }),
  crush: Object.freeze({ item: "Crusher", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftCrusher0000", benefit: "Push" }),
  bashChoice: Object.freeze({ item: "Shield Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftShieldMaste", benefit: "Shield Bash" }),
  interpose: Object.freeze({ item: "Shield Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftShieldMaste", benefit: "Interpose Shield" }),
  hew: Object.freeze({ item: "Great Weapon Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftGreatWeapon", benefit: "Hew" }),
  command: Object.freeze({ item: "Commander's Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvCommanders" })
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
    rule: Object.freeze({ item: "Polearm Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPolearmMast", benefit: "Pole Strike" }),
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
    rule: Object.freeze({ item: "Lucky", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftLucky000000", benefit: "Advantage" }),
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
    rule: Object.freeze({ item: "Mage Slayer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftMageSlayer0", benefit: "Guarded Mind" }),
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
  rule: Object.freeze({ item: "Sneak Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeSneakAttac" }),
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
    rule: Object.freeze({ item: "Cunning Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeCunningStr", benefit: "Poison" }),
    upgrade: Object.freeze({ feature: "Envenom Weapons", activity: "Poison", onFail: "poisoned", effectFrom: "Cunning Strike",
      rule: Object.freeze({ item: "Envenom Weapons", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeEnvenomWea" }) }) }),
  trip: Object.freeze({ feature: "Cunning Strike", activity: "Trip", cost: 1,
    rule: Object.freeze({ item: "Cunning Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeCunningStr", benefit: "Trip" }) }),
  withdraw: Object.freeze({ feature: "Cunning Strike", activity: null, cost: 1,
    rule: Object.freeze({ item: "Cunning Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeCunningStr", benefit: "Withdraw" }) }),
  daze: Object.freeze({ feature: "Devious Strikes", activity: "Daze", cost: 2,
    rule: Object.freeze({ item: "Devious Strikes", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeDeviousStr", benefit: "Daze" }) }),
  knockOut: Object.freeze({ feature: "Devious Strikes", activity: "Knock Out", cost: 6,
    rule: Object.freeze({ item: "Devious Strikes", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeDeviousStr", benefit: "Knock Out" }) }),
  obscure: Object.freeze({ feature: "Devious Strikes", activity: "Obscure", cost: 3,
    rule: Object.freeze({ item: "Devious Strikes", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeDeviousStr", benefit: "Obscure" }) }),
  stealthAttack: Object.freeze({ feature: "Supreme Sneak", activity: null, cost: 1,
    rule: Object.freeze({ item: "Supreme Sneak", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeSupremeSne", benefit: "Stealth Attack" }) }),
  rendMind: Object.freeze({ feature: "Rend Mind", activity: Object.freeze(["Rend Mind (Free)", "Rend Mind"]), cost: 0, weapon: "Psychic Blade",
    rule: Object.freeze({ item: "Rend Mind", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeRendMind00" }) })
});

/** Death Strike: a clock rider on the Sneak Attack — the pack's activity is the save; a failure lands the
 * attack's damage a second time through the applier. */
export const DEATH_STRIKE = Object.freeze({
  feature: "Death Strike", activity: "Death Strike", when: "firstRound",
  rule: Object.freeze({ item: "Death Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeDeathStrik" })
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
    rule: Object.freeze({ item: "Dread Ambusher", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrDreadAmbus", benefit: "Dreadful Strike" }),
    from: "Ranger — Gloom Stalker 3" }),
  "assassinate": Object.freeze({ feature: "Assassinate", activity: "Damage", when: "firstRound", requires: "sneak", type: "weapon", weapon: true,
    rule: Object.freeze({ item: "Assassinate", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeAssasinate", benefit: "Surprising Strikes" }),
    from: "Rogue — Assassin 3 (Surprising Strikes)" }),
  "dreadful-strikes": Object.freeze({ feature: "Dreadful Strikes", activity: "Damage", when: "oncePerTurn", weapon: true,
    rule: Object.freeze({ item: "Dreadful Strikes", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrDreadfulSt" }),
    from: "Ranger — Fey Wanderer 3" }),
  "blessed-strikes-divine-strike": Object.freeze({ feature: "Blessed Strikes: Divine Strike", activity: "Divine Strike", when: "oncePerTurn", weapon: true,
    caveat: "the type is the activity's first — ask for the other by hand",
    rule: Object.freeze({ item: "Blessed Strikes: Divine Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbDivineStrike0" }),
    from: "Cleric 7" }),
  "elemental-fury-primal-strike": Object.freeze({ feature: "Elemental Fury: Primal Strike", activity: "Primal Strike", when: "oncePerTurn", weapon: true,
    caveat: "the type is the activity's first — ask for another by hand",
    rule: Object.freeze({ item: "Elemental Fury: Primal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbFuryPrimalStr" }),
    from: "Druid 7" }),
  "divine-fury": Object.freeze({ feature: "Divine Fury", activity: "Divine Fury", when: "oncePerTurn", judge: "raging", weapon: true,
    caveat: "the type is the activity's first — ask for the other by hand",
    rule: Object.freeze({ item: "Divine Fury", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbDivineFury" }),
    from: "Barbarian — Zealot 3" }),
  // Any attack roll (weapon, unarmed or spell), so no `weapon`; the type is the part's own.
  "fires-burn": Object.freeze({ feature: "Fire's Burn", activity: "Burn", label: "Fire's Burn", when: "any", uses: true,
    rule: Object.freeze({ item: "Fire's Burn", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptFiresBurn0" }),
    from: "Goliath — Giant Ancestry (Fire)" }),
  "frosts-chill": Object.freeze({ feature: "Frost's Chill", activity: "Chill", label: "Frost's Chill", when: "any", uses: true, effects: true, clock: "slow",
    rule: Object.freeze({ item: "Frost's Chill", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptFrostsChil" }),
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
    rule: Object.freeze({ item: "Celestial Revelation", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptCelestialR" }),
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  // ⚠ The pack's "Slashed" carries Hamstring's −10 Speed AND stands for the crit's Disadvantage (EFFECT_BENDS
  // "Slashed"), so Hamstring lands as "Hamstrung" and only the crit lands "Slashed".
  "slasher-hamstring": Object.freeze({ feature: "Slasher", activity: null, label: "Hamstring", when: "oncePerTurn", dealt: "slashing",
    lands: Object.freeze({ name: "Hamstrung", from: "Slashed", id: "bfHamstrung00000" }), clock: "slow",
    says: "Speed −10 feet until the start of your next turn",
    rule: Object.freeze({ item: "Slasher", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSlasher0000", benefit: "Hamstring" }),
    from: "General feat (Slasher)" }),
  "slasher-critical": Object.freeze({ feature: "Slasher", activity: null, label: "Slasher — Enhanced Critical", when: "any", crit: true, dealt: "slashing",
    lands: Object.freeze({ name: "Slashed", id: "bfSlashedCrit000" }), clock: "slow",
    says: "Disadvantage on its attack rolls until the start of your next turn",
    rule: Object.freeze({ item: "Slasher", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSlasher0000", benefit: "Enhanced Critical" }),
    from: "General feat (Slasher)" }),
  "crusher-critical": Object.freeze({ feature: "Crusher", activity: null, label: "Crusher — Enhanced Critical", when: "any", crit: true, dealt: "bludgeoning",
    lands: Object.freeze({ name: "Crushed", from: "Crushed", id: "bfCrushedCrit000" }), clock: "slow",
    says: "attack rolls against it have Advantage until the start of your next turn",
    rule: Object.freeze({ item: "Crusher", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftCrusher0000", benefit: "Enhanced Critical" }),
    from: "General feat (Crusher)" }),
  "piercer-critical": Object.freeze({ feature: "Piercer", activity: null, label: "Piercer — Enhanced Critical", when: "any", crit: true, dealt: "piercing",
    bonusDice: 1, says: "one additional damage die",
    rule: Object.freeze({ item: "Piercer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPiercer0000", benefit: "Enhanced Critical" }),
    from: "General feat (Piercer)" }),
  // The pack's "Halted" for the rest of the current turn (the `halt` clock).
  "sentinel-halt": Object.freeze({ feature: "Sentinel", activity: null, label: "Halt", when: "any", judge: "opportunity",
    lands: Object.freeze({ name: "Halted", from: "Halted", id: "bfHalted00000000" }), clock: "halt",
    says: "Speed 0 for the rest of the current turn", caveat: "only on an Opportunity Attack",
    rule: Object.freeze({ item: "Sentinel", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSentinel000", benefit: "Halt" }),
    from: "General feat (Sentinel)" })
});

/** Text-only features whose whole consequence is a bend on the next roll: use-chips.js writes a chip named
 * as the feature, EFFECT_BENDS reads it, the roll spends it. `window` a CHIP_WINDOWS key; `changes` the
 * sheet changes. Membership: Effect Sources. */
export const USE_CHIPS = Object.freeze({
  "Steady Aim": Object.freeze({ key: "steadyAim", bend: "advantage", window: "steadyAim",
    rule: Object.freeze({ item: "Steady Aim", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeSteadyAim0" }),
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
    rule: Object.freeze({ item: "Poisoner", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPoisoner000", benefit: "Brew Poison" }),
    from: "General feat" })
});

/** A text-only feature used through another item's cast: that cast's card (`on`) offers a reminder chip
 * `chip` for `seconds`, at most `max` standing. The chip bends nothing. Membership: Card Chips. */
export const CARD_CHIPS = Object.freeze({
  "Tinker": Object.freeze({ feature: "Gnomish Lineage, Rock", on: "Prestidigitation", chip: "Tiny Clockwork Device", seconds: 28800, max: 3,
    ask: "Tinker — build a Tiny Clockwork Device (10 minutes)",
    rule: Object.freeze({ item: "Gnomish Lineage, Rock", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptRockGnomeL" }),
    from: "Gnome — Gnomish Lineage (Rock)" })
});


/**
 * A save activity whose FAILURE lands a condition the pack has no effect for (the 2024 Web ships none): the
 * status is pressed via `forceStatus`, the caster as origin, as Topple presses Prone — only when the
 * activity brought no effect. ⚠ tools/audit-presses.mjs's output: re-run it after a content update. Left
 * out: Sleep and Flesh to Stone (carried), Elemental Attunement and Mind Spike.
 *   word   a press behind the CASTER's word (Command): `ask` and `options` the choice, `presses` the one
 *          option that lands `status`, `default` what the clock chooses (saves/choices.js, kind `word`)
 */
export const SAVE_PRESSES = Object.freeze({
  // Grovel alone lands a condition; Approach, Flee and Halt move or hold the token, the table's.
  "Command": Object.freeze({ status: "prone", onFail: true,
    word: Object.freeze({ ask: "Which word did you speak?", options: Object.freeze(["Approach", "Flee", "Grovel", "Halt"]), presses: "Grovel", default: "Halt" }),
    rule: Object.freeze({ item: "Command", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCommand000" }) }),
  "Web": Object.freeze({ status: "restrained", onFail: true,
    rule: Object.freeze({ item: "Web", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplWeb0000000" }) }),
  "Grease": Object.freeze({ status: "prone", onFail: true,
    rule: Object.freeze({ item: "Grease", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplGrease0000" }) }),
  "Sleet Storm": Object.freeze({ status: "prone", onFail: true,
    rule: Object.freeze({ item: "Sleet Storm", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSleetStorm" }) }),
  // No effect on the feat's saves: Poisoned is pressed here, ending with the Poisoner's next turn.
  "Poisoner": Object.freeze({ status: "poisoned", onFail: true, expiry: "sourceEnd",
    rule: Object.freeze({ item: "Poisoner", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPoisoner000", benefit: "Brew Poison" }) })
});

/** Evasion, no choice (R1): a Dexterity save against half-on-success takes none on a success and half on a
 * failure; not while Incapacitated. The verdict's multiplier does it. */
export const EVASION = Object.freeze({
  feature: "Evasion", ability: "dex",
  rule: Object.freeze({ item: "Evasion", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkEvasion000" })
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
    rule: Object.freeze({ item: "Combat Superiority", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrCombatSupe", benefit: "Maneuvers" }) }),
  // Hill's Tumble only (Fire and Frost are CLOCK_RIDERS); no feature: the text-only parent may be missing.
  "giant-ancestry": Object.freeze({ feature: null, pool: "option", label: "Giant Ancestry", max: 1,
    dieLabel: "use", eyebrow: "Giant Ancestry", heading: "Giant Ancestry", per: "one boon per hit", from: "Goliath",
    rule: Object.freeze({ item: "Goliath", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspGoliath0000", benefit: "Giant Ancestry" }) })
});

export const HIT_OPTIONS = Object.freeze({
  "trip-attack": Object.freeze({ feature: "Trip Attack", group: "combat-superiority", save: true, onFail: "prone",
    rule: Object.freeze({ item: "Trip Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvTripAttack" }) }),
  "goading-attack": Object.freeze({ feature: "Goading Attack", group: "combat-superiority", save: true,
    rule: Object.freeze({ item: "Goading Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvGoadingAtt" }) }),
  "menacing-attack": Object.freeze({ feature: "Menacing Attack", group: "combat-superiority", save: true,
    rule: Object.freeze({ item: "Menacing Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvMenacingAt" }) }),
  "pushing-attack": Object.freeze({ feature: "Pushing Attack", group: "combat-superiority", save: true,
    line: "Played at the table: on a failed save, the target is pushed up to 15 feet directly away from you.",
    rule: Object.freeze({ item: "Pushing Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvPushingAtt" }) }),
  "disarming-attack": Object.freeze({ feature: "Disarming Attack", group: "combat-superiority", save: true,
    line: "Played at the table: on a failed save, the target drops one object of your choice, which lands in its space.",
    rule: Object.freeze({ item: "Disarming Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvDisarmingA" }) }),
  "distracting-strike": Object.freeze({ feature: "Distracting Strike", group: "combat-superiority", effects: true,
    rule: Object.freeze({ item: "Distracting Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvDistractin" }) }),
  "maneuvering-attack": Object.freeze({ feature: "Maneuvering Attack", group: "combat-superiority",
    line: "Played at the table: choose a willing creature who can see or hear you; it can use its Reaction to move up to half its Speed without provoking an Opportunity Attack from the target.",
    rule: Object.freeze({ item: "Maneuvering Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvManeuverin" }) }),
  "sweeping-attack": Object.freeze({ feature: "Sweeping Attack", group: "combat-superiority", mode: "sweep", melee: true,
    rule: Object.freeze({ item: "Sweeping Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvSweepingAt" }) }),
  // Any attack roll that hits and deals damage — weapon, unarmed or spell. No die: the press is the boon.
  "hills-tumble": Object.freeze({ feature: "Hill's Tumble", group: "giant-ancestry", press: "prone", maxSize: "lg",
    rule: Object.freeze({ item: "Hill's Tumble", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptHillsTumbl" }) })
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
    rule: Object.freeze({ item: "Evasive Footwork", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvEvasiveFoo" }),
    from: "Fighter — Battle Master" }),
  "Bait and Switch": Object.freeze({ use: "Switch Places", choice: Object.freeze({ effectPrefix: "Baited AC +", what: "AC" }),
    rule: Object.freeze({ item: "Bait and Switch", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvBaitandSwi" }),
    from: "Fighter — Battle Master" }),
  "Lunging Attack": Object.freeze({ use: "Damage", chip: Object.freeze({ window: "steadyAim" }), rider: Object.freeze({ melee: true, caveat: "if you moved at least 5 feet in a straight line just before the hit" }),
    rule: Object.freeze({ item: "Lunging Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvLungingAtt" }),
    from: "Fighter — Battle Master" }),
  "Feinting Attack": Object.freeze({ use: "Damage", marker: Object.freeze({ effect: "Feinting Attack" }), rider: Object.freeze({}),
    rule: Object.freeze({ item: "Feinting Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvFeintingAt" }),
    from: "Fighter — Battle Master" })
});


/** Maneuvers adding the die to a D20 Test: the `tactical` d20 fold with the text's scope (skills,
 * Initiative), which tells them from Tactical Mind. No refund — the die is spent either way. */
export const SUPERIORITY_FOLDS = Object.freeze({
  "Ambush": Object.freeze({ skills: Object.freeze(["ste"]), initiative: true,
    rule: Object.freeze({ item: "Ambush", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvAmbush0000" }) }),
  "Tactical Assessment": Object.freeze({ skills: Object.freeze(["his", "inv", "ins"]), initiative: false,
    rule: Object.freeze({ item: "Tactical Assessment", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvTacticalAs" }) })
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
    rule: Object.freeze({ item: "Aura of Protection", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnProtection" }),
    from: "Paladin 6" }),
  "Aura of Courage": Object.freeze({ kind: "feature", reach: "helpful", range: "@scale.paladin.aura", effect: "Courageous", incapacitated: true,
    caveat: "the pack's effect carries no change — add Immunity to Frightened to it at the world",
    rule: Object.freeze({ item: "Aura of Courage", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnCourageAur" }),
    from: "Paladin 10" }),
  "Aura of Warding": Object.freeze({ kind: "feature", reach: "helpful", range: "@scale.paladin.aura", effect: "Aura of Warding", incapacitated: true,
    rule: Object.freeze({ item: "Aura of Warding", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnWardingAur" }),
    from: "Paladin — Oath of the Ancients 7" }),
  "Spirit Guardians": Object.freeze({ kind: "spell", reach: "harmful", range: null, effect: "Half Speed", incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    rule: Object.freeze({ item: "Spirit Guardians", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSpiritGuar" }),
    from: "Cleric spell, level 3 (Concentration, 10 minutes)" }),
  "Aura of Life": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Aura of Life", incapacitated: false,
    heal: Object.freeze({ on: "turnStart", when: "zeroHP", activity: "Create Aura" }),
    caveat: "the pack's effect carries the Necrotic Resistance; \"Hit Point maximums can't be reduced\" is the table's",
    rule: Object.freeze({ item: "Aura of Life", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplAuraofLife" }),
    from: "Paladin spell, level 4 (Concentration, 10 minutes)" }),
  "Aura of Purity": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Aura of Purity", incapacitated: false,
    caveat: "the pack's effect carries the Poison Resistance; the Advantage on saves against those conditions is the save gate's (Effect Sources — Aura of Purity)",
    rule: Object.freeze({ item: "Aura of Purity", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplAuraofPuri" }),
    from: "Paladin spell, level 4 (Concentration, 10 minutes)" }),
  "Aura of Vitality": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: null, incapacitated: false,
    remind: Object.freeze({ on: "sourceTurnStart", activity: "Start of Turn Heal" }),
    caveat: "the heal is AIMED — a choice: the card at the start of your turn offers it, and never plays it",
    rule: Object.freeze({ item: "Aura of Vitality", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplAuraofVita" }),
    from: "Cleric / Druid / Paladin spell, level 3 (Concentration, 1 minute)" }),
  "Antilife Shell": Object.freeze({ kind: "spell", reach: "harmful", range: null, effect: null, incapacitated: false,
    caveat: "a barrier, not an effect — the ring is drawn for the table to honour",
    rule: Object.freeze({ item: "Antilife Shell", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplAntilifeSh" }),
    from: "Druid spell, level 5 (Concentration, 1 hour)" }),
  "Circle of Power": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Circle's Power", incapacitated: false,
    caveat: "the pack's effect carries no change — the Advantage on saves against spells is the save gate's, and a success against half-on-save spell damage takes none (Effect Sources — Circle's Power)",
    rule: Object.freeze({ item: "Circle of Power", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCircleofPo" }),
    from: "Cleric / Paladin spell, level 5 (Concentration, 10 minutes)" }),
  "Crusader's Mantle": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Crusader’s Mantle", incapacitated: false,
    rule: Object.freeze({ item: "Crusader's Mantle", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCrusadersM" }),
    from: "Paladin spell, level 3 (Concentration, 1 minute)" }),
  "Holy Aura": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Holy Protection", incapacitated: false,
    caveat: "the pack's effect carries the Advantage on saves (the save gate says so) and the attack gate reads attackers' Disadvantage off it (Effect Sources — Holy Protection); the Fiend/Undead save on a melee hit is the table's",
    rule: Object.freeze({ item: "Holy Aura", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHolyAura00" }),
    from: "Cleric spell, level 8 (Concentration, 1 minute)" }),
  // The pack's spell has no area (Vendor Fixes VF-003 gives it the 30-foot Emanation).
  "Pass without Trace": Object.freeze({ kind: "spell", reach: "helpful", range: null, effect: "Concealed", incapacitated: false,
    caveat: "the pack's effect carries the +10 to Stealth; \"leave no tracks\" is the table's",
    rule: Object.freeze({ item: "Pass without Trace", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplPasswithou" }),
    from: "Druid / Ranger spell, level 2 (Concentration, 1 hour); the Wood Elf's lineage at character level 5" }),
  // Stands only while `while` stands on the bearer (landed by token-lights), reaches everyone, and pays the
  // activity's damage at the bearer's turn END (`pulse`), rolled once. ⚠ The pack models the pulse as
  // damage on use; the use here is the transform alone.
  "Inner Radiance": Object.freeze({ kind: "feature", item: "Celestial Revelation", activity: "Inner Radiance", while: "Searing Radiance",
    reach: "all", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: "Inner Radiance" }),
    rule: Object.freeze({ item: "Celestial Revelation", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptCelestialR", benefit: "Inner Radiance" }),
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  // An invisible ring at the held weapon's reach; a hostile moving in raises the reminder (attack from the sheet).
  "Polearm Master": Object.freeze({ kind: "feature", reach: "harmful", range: "weaponReach", effect: null, incapacitated: true, quiet: true,
    holding: Object.freeze({ base: Object.freeze(["quarterstaff", "spear"]), properties: Object.freeze(["hvy", "rch"]) }),
    alert: Object.freeze({ on: "moveIn", label: "Reactive Strike",
      swing: "Take your <strong>Reaction</strong> to make one melee attack at it, from the sheet." }),
    rule: Object.freeze({ item: "Polearm Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPolearmMast", benefit: "Reactive Strike" }),
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
    rule: Object.freeze({ item: "Death Armor", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofDeathArmor000" }),
    from: "Heroes of Faerûn — Character Options, level 2 (1 hour)" }),
  "Fire Shield": Object.freeze({ effect: Object.freeze({ "Warm Shield": "fire", "Chill Shield": "cold" }), activity: "Flame Eruption", melee: true,
    rule: Object.freeze({ item: "Fire Shield", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFireShield" }),
    from: "PHB, level 4 (10 minutes)" }),
  "Armor of Agathys": Object.freeze({ mark: true, cast: "Cast", activity: "Frost Damage", melee: true, while: "tempHP",
    rule: Object.freeze({ item: "Armor of Agathys", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplArmorofAga" }),
    from: "PHB, level 1 (1 hour)" })
});


/** A cast shipping several effects the text makes alternatives: the caster picks in a popup (R1), only the
 * pick lands. `effects` the names in order; `ask` the question. Fewer than two present asks nothing. */
export const EFFECT_CHOICES = Object.freeze({
  "Fire Shield": Object.freeze({ effects: Object.freeze(["Warm Shield", "Chill Shield"]), ask: "A warm shield or a chill shield?",
    rule: Object.freeze({ item: "Fire Shield", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFireShield" }),
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
    rule: Object.freeze({ item: "Celestial Revelation", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptCelestialR", benefit: "Inner Radiance" }),
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  "Light": Object.freeze({ activity: null, on: "targets", effect: null, recast: "ends", bright: 20, dim: 40,
    caveat: "on a creature's token (user, 2026-09-25: any targeted token) — the rule's object is the table's to name",
    rule: Object.freeze({ item: "Light", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplLight00000" }),
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
    rule: Object.freeze({ item: "Dwarf", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspDwarf000000", benefit: "Stonecunning" }),
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
    rule: Object.freeze({ item: "Goliath", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspGoliath0000", benefit: "Large Form" }),
    from: "Goliath (character level 5)" }),
  "Enlarge/Reduce": Object.freeze({ effects: Object.freeze({ "Enlarged": Object.freeze({ step: 1 }), "Reduced": Object.freeze({ step: -1 }) }),
    rule: Object.freeze({ item: "Enlarge/Reduce", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplEnlargeRed", benefit: "Enlarge" }),
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
    rule: Object.freeze({ item: "Human", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspHuman000000", benefit: "Resourceful" }), from: "Human" }),
  "Musician": Object.freeze({ rests: Object.freeze(["short", "long"]), grant: "inspiration", to: "allies", reach: 30, cap: "prof",
    rule: Object.freeze({ item: "Musician", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftMusician000", benefit: "Encouraging Song" }),
    from: "Origin feat (Entertainer)" }),
  // Musician's popup, granting Temporary Hit Points (the pack's heal activity's amount).
  "Inspiring Leader": Object.freeze({ rests: Object.freeze(["short", "long"]), grant: "temphp", to: "allies", self: true, reach: 30, cap: 6,
    activities: Object.freeze({ wis: "Inspire with Wisdom", cha: "Inspire with Charisma" }), label: "Inspire with Performance",
    rule: Object.freeze({ item: "Inspiring Leader", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftInspiringLe", benefit: "Bolstering Performance" }),
    from: "General feat" }),
  // Chef's two benefits, a row each; the treats are handed out as their temp HP (RULINGS *Bent by choice*).
  "Bolstering Treats": Object.freeze({ feature: "Chef", rests: Object.freeze(["long"]), grant: "temphp", to: "allies", self: true, reach: null, cap: "prof",
    activity: "Bolstering Treats",
    rule: Object.freeze({ item: "Chef", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftChef0000000", benefit: "Bolstering Treats" }),
    from: "General feat (Chef)" }),
  "Replenishing Meal": Object.freeze({ feature: "Chef", rests: Object.freeze(["short"]), grant: "meal", to: "allies", self: true, reach: null, cap: "4 + @prof",
    activity: "Replenishing Meal",
    rule: Object.freeze({ item: "Chef", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftChef0000000", benefit: "Replenishing Meal" }),
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
    rule: Object.freeze({ item: "Death Ward", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDeathWard0" }),
    from: "PHB, level 4 (8 hours)" }),
  "Relentless Endurance": Object.freeze({ ask: true, uses: true, outright: false,
    rule: Object.freeze({ item: "Orc", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspOrc00000000", benefit: "Relentless Endurance" }),
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
    rule: Object.freeze({ item: "Storm's Thunder", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptStormsThun" }) }),
  "Hellish Rebuke": Object.freeze({ activity: null, caveat: "a creature you can see", from: "PHB level 1 spell; the Monster Manual's Hellish Rebuke casts it",
    rule: Object.freeze({ item: "Hellish Rebuke", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHellishReb" }) }),
  "Fount of Moonlight": Object.freeze({ activity: "Blinding Reaction", while: "Wreathed in Light", caveat: "a creature you can see",
    from: "PHB level 4 spell (Concentration, 10 minutes)",
    rule: Object.freeze({ item: "Fount of Moonlight", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFountofMoo" }) }),
  "Retaliation": Object.freeze({ attack: "melee", range: 5, from: "Barbarian 14",
    rule: Object.freeze({ item: "Retaliation", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbRetaliatio" }) }),
  "Sword of Answering": Object.freeze({ activity: "Attack Reaction", advantage: true, equipped: true, from: "DMG legendary weapon",
    rule: Object.freeze({ item: "Sword of Answering", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgSwordOfAnswer" }) }),
  // The pack's Sentinel has no activity: the answer is one melee attack with the weapon last swung.
  "Sentinel": Object.freeze({ attack: "melee", range: 5, ward: true, hit: true, opportunity: true, from: "General feat",
    caveat: "its Disengage half — nothing records a Disengage",
    rule: Object.freeze({ item: "Sentinel", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSentinel000", benefit: "Guardian" }) })
});


/** A damage activity whose text ties a SAVE to the damage (Heat Metal): damage-casts.js rolls `damage`,
 * then uses `save` at the same targets. The drop is the table's (R1): `line` says so on the card. */
export const DAMAGE_SAVES = Object.freeze({
  "Heat Metal": Object.freeze({ damage: Object.freeze(["Cast and Heat", "Reheat"]), save: "On Damage Save",
    line: "Played at the table: on a failed save the creature drops the object if it can — remove Heated Metal if it did; a creature that keeps hold of it has Disadvantage on attack rolls and ability checks until the start of the caster's next turn.",
    rule: Object.freeze({ item: "Heat Metal", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHeatMetal0" }),
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
    rule: Object.freeze({ item: "Noxious Miasma", uuid: "Compendium.dnd-monster-manual.features.Item.mmNoxiousMiasma0" }),
    data: "Monster Manual, Adult Green Dragon — the activity's duration reads 1 turn: the AC penalty's clock, not the cloud's" }),
  "Hypnotic Pattern": Object.freeze({
    rule: Object.freeze({ item: "Hypnotic Pattern", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHypnoticPa" }),
    data: "PHB, level 3 (Concentration, 1 minute) — the DURATION is the Charmed condition's; the pattern \"appears for a moment and vanishes\", and an imported copy missing the concentration flag falls into the GM's bucket" }),
  // The area only CHOOSES the targets; the pack writes the spell's minute on the activity.
  "Slow": Object.freeze({
    rule: Object.freeze({ item: "Slow", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSlow000000" }),
    data: "PHB, level 3 (Concentration, 1 minute) — the duration is the targets' slowing; the Cube chooses them at the cast" }),
  "Fear": Object.freeze({
    rule: Object.freeze({ item: "Fear", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFear000000" }),
    data: "PHB, level 3 (Concentration, 1 minute) — the duration is the Frightened condition's; the Cone is the cast's" }),
  "Confusion": Object.freeze({
    rule: Object.freeze({ item: "Confusion", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplConfusion0" }),
    data: "PHB, level 4 (Concentration, 1 minute) — the duration is the confusion's; the Sphere chooses the targets at the cast" }),
  "Sleep": Object.freeze({
    rule: Object.freeze({ item: "Sleep", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSleep00000" }),
    data: "PHB, level 1 (Concentration, 1 minute) — the duration is the targets' sleep; the Sphere chooses them at the cast" }),
  "Calm Emotions": Object.freeze({
    rule: Object.freeze({ item: "Calm Emotions", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCalmEmotio" }),
    data: "PHB, level 2 (Concentration, 1 minute) — the duration is the effect's on each Humanoid; the Sphere chooses them at the cast" }),
  "Faerie Fire": Object.freeze({
    rule: Object.freeze({ item: "Faerie Fire", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFaerieFire" }),
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

/** The 2024 Rules Glossary on range, as pointers to dnd5e's rules pages (rule-text.js reads them). */
export const RANGE_RULES = Object.freeze({
  long: Object.freeze({ page: "rule", key: "range" }),
  single: Object.freeze({ page: "rule", key: "range" }),
  close: Object.freeze({ page: "rule", key: "rangedattacksinclosecombat" })
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
    rule: Object.freeze({ item: "Sharpshooter", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSharpshoote" }) }),
  "Spell Sniper": Object.freeze({ scope: "spell", cancels: Object.freeze(["close"]), cover: true, reach: 60,
    rule: Object.freeze({ item: "Spell Sniper", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSpellSniper" }) }),
  "Crossbow Expert": Object.freeze({ scope: "crossbow", cancels: Object.freeze(["close"]),
    rule: Object.freeze({ item: "Crossbow Expert", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftCrossbowExp", benefit: "Firing in Melee" }) })
});

/** The three crossbows, by dnd5e's base item (CONFIG.DND5E.weaponIds). */
export const CROSSBOWS = Object.freeze(["handcrossbow", "lightcrossbow", "heavycrossbow"]);

/**
 * What the 2024 conditions do to an ATTACK ROLL, both roles — each rule the glossary's page; decided by
 * decide/reminders.js `conditionSources`. ⚠ The Condition Sources list's closed set and default derive
 * from these keys: a new condition is a row here and nothing else. Prone lives in `proneSources`.
 *   caveat  counted, and said;  note  listed, never counted
 *   critWithinFeet  a hit from within that many feet is a Critical Hit (auto-damage.js `critFor`)
 * @type {Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: object|string|null, caveat?: string, note?: string, critWithinFeet?: number}>>>}
 */
export const CONDITION_BENDS = Object.freeze({
  blinded: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: Object.freeze({ page: "condition", key: "blinded", benefit: "Attacks Affected" }) }),
  invisible: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: Object.freeze({ page: "condition", key: "invisible", benefit: "Attacks Affected" }) }),
  // The system's Hiding status: the glossary's Unseen Attackers and Targets clause.
  hiding: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: Object.freeze({ page: "rule", key: "unseenattackers" }),
    caveat: "counted — press Normal if the other side can see you" }),
  paralyzed: Object.freeze({ attacker: null, target: "advantage",
    rule: Object.freeze({ page: "condition", key: "paralyzed", benefit: "Automatic Critical Hits" }),
    critWithinFeet: 5 }),
  petrified: Object.freeze({ attacker: null, target: "advantage",
    rule: Object.freeze({ page: "condition", key: "petrified", benefit: "Attacks Affected" }) }),
  poisoned: Object.freeze({ attacker: "disadvantage", target: null,
    rule: Object.freeze({ page: "condition", key: "poisoned", benefit: "Ability Checks and Attacks Affected" }) }),
  restrained: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: Object.freeze({ page: "condition", key: "restrained", benefit: "Attacks Affected" }) }),
  stunned: Object.freeze({ attacker: null, target: "advantage",
    rule: Object.freeze({ page: "condition", key: "stunned", benefit: "Attacks Affected" }) }),
  unconscious: Object.freeze({ attacker: null, target: "advantage",
    rule: Object.freeze({ page: "condition", key: "unconscious", benefit: "Automatic Critical Hits" }),
    critWithinFeet: 5 }),
  frightened: Object.freeze({ attacker: "disadvantage", target: null,
    rule: Object.freeze({ page: "condition", key: "frightened", benefit: "Ability Checks and Attacks Affected" }),
    caveat: "counted — press Normal if the source of the fear is out of sight" }),
  grappled: Object.freeze({ attacker: "disadvantage", target: null,
    rule: Object.freeze({ page: "condition", key: "grappled", benefit: "Attacks Affected" }),
    caveat: "counted — press Normal if this attack is against the grappler" }),
  incapacitated: Object.freeze({ attacker: null, target: null,
    rule: Object.freeze({ page: "condition", key: "incapacitated", benefit: "Inactive" }),
    note: "an Incapacitated creature cannot attack at all — this roll should not be happening" }),
  dodging: Object.freeze({ attacker: null, target: "disadvantage",
    rule: Object.freeze({ page: "rule", key: "dodge" }),
    caveat: "counted — press Normal if it cannot see the attacker, is Incapacitated, or has Speed 0" }),
  charmed: Object.freeze({ attacker: null, target: null,
    rule: Object.freeze({ page: "condition", key: "charmed", benefit: "Can’t Harm the Charmer" }),
    note: "a Charmed creature cannot attack its charmer — if this is the charmer, this roll should not be happening" })
});

/** The table's rows, in the order the table reads them. */
export const CONDITION_KEYS = Object.freeze(Object.keys(CONDITION_BENDS));

/**
 * What the 2024 conditions do to a SAVING THROW (the glossary's page), read by decide/reminders.js
 * `saveSources`. `autoFail`: the save CANNOT succeed — a fourth button, still pressed (R1).
 * Not here: Exhaustion (dnd5e applies it); Poisoned and Frightened touch checks and attacks only.
 * @type {Readonly<Record<string, Readonly<{abilities: readonly string[], bend?: "advantage"|"disadvantage", autoFail?: boolean, rule: object|string|null, caveat?: string}>>>}
 */
export const SAVE_BENDS = Object.freeze({
  restrained: Object.freeze({ abilities: Object.freeze(["dex"]), bend: "disadvantage",
    rule: Object.freeze({ page: "condition", key: "restrained", benefit: "Saving Throws Affected" }) }),
  dodging: Object.freeze({ abilities: Object.freeze(["dex"]), bend: "advantage",
    rule: Object.freeze({ page: "rule", key: "dodge" }),
    caveat: "counted — press Normal if it is Incapacitated or its Speed is 0" }),
  paralyzed: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: Object.freeze({ page: "condition", key: "paralyzed", benefit: "Saving Throws Affected" }) }),
  stunned: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: Object.freeze({ page: "condition", key: "stunned", benefit: "Saving Throws Affected" }) }),
  unconscious: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: Object.freeze({ page: "condition", key: "unconscious", benefit: "Saving Throws Affected" }) }),
  petrified: Object.freeze({ abilities: Object.freeze(["str", "dex"]), autoFail: true,
    rule: Object.freeze({ page: "condition", key: "petrified", benefit: "Saving Throws Affected" }) })
});

/**
 * What the 2024 conditions do to an ABILITY CHECK (never initiative), the glossary's page.
 * ⚠ The platform already rolls a Poisoned check at Disadvantage: `platform` marks a reminder, never a
 * second application. Exhaustion is the system's subtraction — no row.
 * @type {Readonly<Record<string, Readonly<{bend: "advantage"|"disadvantage", rule: object|string|null, platform?: boolean}>>>}
 */
export const CHECK_BENDS = Object.freeze({
  poisoned: Object.freeze({ bend: "disadvantage", platform: true,
    rule: Object.freeze({ page: "condition", key: "poisoned", benefit: "Ability Checks and Attacks Affected" }) }),
  frightened: Object.freeze({ bend: "disadvantage",
    rule: Object.freeze({ page: "condition", key: "frightened", benefit: "Ability Checks and Attacks Affected" }) })
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
 *   saves     { bend, statuses?, spells?, abilities?, halfToNone? } scoped by the demand (`abilities`: the
 *             save's own ability, Irresistible Dance's Dexterity), or { succeeds, sleep } — the save
 *             cannot fail against magical sleep (a fourth button)
 * ⚠ Names are the packs' own, colons and all.
 * @type {Readonly<Record<string, Readonly<{match?: "effect"|"feature", attacker: "advantage"|"disadvantage"|null,
 *   target: "advantage"|"disadvantage"|null, scope: "any"|"spell"|"weapon"|"melee"|"ranged", caveat?: string,
 *   counted?: boolean, judge?: "bloodied"|"targetBloodied"|"targetDamaged"|"targetGrappled"|"targetNotActed"|"allyNearTarget", spend?: "attack",
 *   only?: "source", except?: "source", rule: object|string|null, from: string}>>>}
 */
export const EFFECT_BENDS = Object.freeze({
  // --- A. standing, no caveat: the row is the whole truth ---------------------------------
  "Innate Sorcery": Object.freeze({ attacker: "advantage", target: null, scope: "spell", from: "Sorcerer",
    rule: Object.freeze({ item: "Innate Sorcery", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrInnateSorc" }) }),
  "Reckless": Object.freeze({ attacker: "advantage", target: "advantage", scope: "weapon", from: "Barbarian, Reckless Attack",
    rule: Object.freeze({ item: "Reckless Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbRecklessAt" }) }),
  "Foresight": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", from: "Foresight",
    rule: Object.freeze({ item: "Foresight", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplForesight0" }) }),
  "Blurred": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Blur",
    rule: Object.freeze({ item: "Blur", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplBlur000000" }) }),
  "Holy Protection": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Holy Aura",
    rule: Object.freeze({ item: "Holy Aura", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHolyAura00" }) }),
  "Shining": Object.freeze({ attacker: null, target: "advantage", scope: "any", from: "Shining Smite",
    rule: Object.freeze({ item: "Shining Smite", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplShiningSmi" }) }),
  "Crushed": Object.freeze({ attacker: null, target: "advantage", scope: "any", from: "Crusher",
    rule: Object.freeze({ item: "Crusher", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftCrusher0000", benefit: "Enhanced Critical" }) }),
  "Slashed": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Slasher",
    rule: Object.freeze({ item: "Slasher", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSlasher0000", benefit: "Enhanced Critical" }) }),
  "Zealous Presence": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Zealot Barbarian",
    rule: Object.freeze({ item: "Zealous Presence", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbZealousPre" }) }),
  "Rallied": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Rally (monsters)",
    rule: Object.freeze({ item: "Rally", uuid: "Compendium.dnd-monster-manual.features.Item.mmRally000000000" }) }),
  "Attack: Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "War Cry (monsters)",
    rule: Object.freeze({ item: "War Cry", uuid: "Compendium.dnd-monster-manual.features.Item.mmWarCry00000000" }) }),
  "Adv: Attacks & Saves": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Marshal Undead (monsters)",
    rule: Object.freeze({ item: "Marshal Undead", uuid: "Compendium.dnd-monster-manual.features.Item.mmMarshalUndead0" }) }),
  "Manacled": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Manacles",
    rule: Object.freeze({ item: "Manacles", uuid: "Compendium.dnd-players-handbook.equipment.Item.phbagManacles000" }) }),
  "Heated Metal": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", checks: "disadvantage", from: "Heat Metal",
    rule: Object.freeze({ item: "Heat Metal", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHeatMetal0" }) }),
  "Averse": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", checks: "disadvantage", from: "Aversion to Fire (monsters)",
    rule: Object.freeze({ item: "Aversion to Fire", uuid: "Compendium.dnd-dungeon-masters-guide.features.Item.dmgAversionToFir" }) }),
  "Target: Disadvantage": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Sap, Pesky Swarm (monsters)",
    rule: Object.freeze({ item: "Flash of Light", uuid: "Compendium.dnd-monster-manual.features.Item.mmFlashOfLight00" }) }),
  "Attacks: Disadvantage": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Flash of Light (monsters)",
    rule: Object.freeze({ item: "Flash of Light", uuid: "Compendium.dnd-monster-manual.features.Item.mmFlashOfLight00" }) }),
  "Attack and Save Disadvantage": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Howl (Ravenloft)",
    rule: Object.freeze({ item: "Howl", uuid: "Compendium.dnd-monster-manual.features.Item.mmHowl0000000000" }) }),
  "Cursed (Path to the Grave)": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Path to the Grave (Ravenloft)",
    rule: null }),
  "Disadv. Attacks & Saves": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Sunlight (monsters)",
    rule: Object.freeze({ item: "Sunlight", uuid: "Compendium.dnd-monster-manual.features.Item.mmSunlight000000" }) }),
  "Disadv. Attacks & Checks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Vampire Weakness (monsters)",
    rule: Object.freeze({ item: "Vampire Weakness", uuid: "Compendium.dnd-monster-manual.features.Item.mmVampireWeaknes", benefit: "Sunlight" }) }),
  "Disadv.: Attacks & Checks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Fear of Fire (monsters)",
    rule: Object.freeze({ item: "Fear of Fire", uuid: "Compendium.dnd-monster-manual.features.Item.mmFearOfFire0000" }) }),
  // --- B. the effect sits on the creature the feature is USED ON, the source judging (`only`/`except`);
  // read on the owner's own sheet these fire for nobody. A caveat stays where a fact is unreadable.
  "Vow of Enmity": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", from: "Paladin",
    rule: Object.freeze({ item: "Vow of Enmity", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnVowOfEnmit" }) }),
  // The pack's effect is on the MONSTER; the marked creature is nowhere in the data.
  "Prey: Attack Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Marked as Prey (monsters)",
    caveat: "counted — press Normal if this attack is not at the marked creature",
    rule: Object.freeze({ item: "Marked as Prey", uuid: "Compendium.dnd-monster-manual.features.Item.mmMarkedAsPrey00" }) }),
  // Both sides are the source's alone.
  "Clairvoyant Combatant": Object.freeze({ attacker: "disadvantage", target: "advantage", scope: "any", only: "source", from: "Clairvoyant Combatant",
    rule: Object.freeze({ item: "Clairvoyant Combatant", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkClairvoyan" }) }),
  "Strike Fear: Terrify": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", from: "Strike Fear (Heroes of Faerûn)",
    caveat: "counted — press Normal if the target is no longer Frightened by you",
    rule: Object.freeze({ item: "Strike Fear", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofSotStrikeFear", benefit: "Terrify" }) }),
  "Compelled": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Compelled Duel",
    rule: Object.freeze({ item: "Compelled Duel", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCompelledD" }) }),
  "Goaded": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Battle Master, Goading Attack",
    rule: Object.freeze({ item: "Goading Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvGoadingAtt" }) }),
  "Taunted": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", except: "source", from: "Steps of the Fey",
    rule: Object.freeze({ item: "Steps of the Fey", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkStepsOfThe", benefit: "Taunting Step" }) }),
  // The packs carry no data for these save bends; the rows are where it lives.
  "Aura of Purity": Object.freeze({ attacker: null, target: null, scope: "any", from: "Aura of Purity",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["blinded", "charmed", "deafened", "frightened", "paralyzed", "poisoned", "stunned"]) }),
    rule: Object.freeze({ item: "Aura of Purity", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplAuraofPuri" }) }),
  "Circle's Power": Object.freeze({ attacker: null, target: null, scope: "any", from: "Circle of Power",
    saves: Object.freeze({ bend: "advantage", spells: true, halfToNone: true }),
    rule: Object.freeze({ item: "Circle of Power", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCircleofPo" }) }),
  // The pack's effect carries the Poison Resistance; the Advantage against Poisoned is this row's.
  "Poison Protection": Object.freeze({ attacker: null, target: null, scope: "any", from: "Protection from Poison",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["poisoned"]) }),
    rule: Object.freeze({ item: "Protection from Poison", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplProtection" }) }),
  // The pack's effect carries Charmed alone; the dance's bends are this row's (the repeat, REPEAT_SAVES).
  "Irresistible Dance": Object.freeze({ attacker: "disadvantage", target: "advantage", scope: "any", from: "Otto's Irresistible Dance",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["dex"]) }),
    rule: Object.freeze({ item: "Otto's Irresistible Dance", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplOttosIrres" }) }),
  "Cursed Attacks": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", from: "Bestow Curse",
    caveat: "counted — press Normal if this attack is not at the caster",
    rule: Object.freeze({ item: "Bestow Curse", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplBestowCurs" }) }),
  // `item`: only an effect from THIS item (the Aura of Protection's "Protected" is a save bonus).
  "Protected": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good", item: "Protection from Evil and Good",
    caveat: "counted — press Normal if the attacker is not an Aberration, Celestial, Elemental, Fey, Fiend or Undead",
    rule: Object.freeze({ item: "Protection from Evil and Good", uuid: "Compendium.dnd-players-handbook.spells.Item.phbEvilAndGoodPr" }) }),
  // The "Protected" the Protection answer lands (hold/continue.js), found by `named`; it bends only
  // while the guard stands within `sourceWithin` feet.
  "Protected (Protection)": Object.freeze({ named: "Protected", attacker: null, target: "disadvantage", scope: "any", from: "Protection (Fighting Style)", item: "Protection",
    sourceWithin: 5,
    rule: Object.freeze({ item: "Protection", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstProtection" }) }),
  "Protection from Evil and Good": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Protection from Evil and Good (2014)",
    caveat: "counted — press Normal if the attacker is not an Aberration, Celestial, Elemental, Fey, Fiend or Undead",
    rule: Object.freeze({ item: "Protection from Evil and Good", uuid: "Compendium.dnd-players-handbook.spells.Item.phbEvilAndGoodPr" }) }),
  "Dispelling Evil and Good": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", from: "Dispel Evil and Good",
    caveat: "counted — press Normal if the attacker is not a Celestial, Elemental, Fey, Fiend or Undead",
    rule: Object.freeze({ item: "Dispel Evil and Good", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDispelEvil" }) }),
  "Assasinate": Object.freeze({ attacker: "advantage", target: null, scope: "any", from: "Assassin Rogue (the pack's own spelling)",
    caveat: "counted — press Normal if this is not the first round, or the target has taken a turn",
    rule: Object.freeze({ item: "Assassinate", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeAssasinate", benefit: "Surprising Strikes" }) }),
  // --- listed, not counted: the caveat is the rule ------------------------------------------
  "Chill Touch": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", counted: false, from: "Chill Touch (2014)",
    caveat: "listed — Disadvantage only for an Undead attacker, and only against the caster",
    rule: Object.freeze({ item: "Chill Touch", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplChillTouch" }) }),
  "Shocking Grasp": Object.freeze({ attacker: "advantage", target: null, scope: "spell", counted: false, from: "Shocking Grasp (2014)",
    caveat: "listed — Advantage only if the target wears metal armor",
    rule: Object.freeze({ item: "Shocking Grasp", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplShockingGr" }) }),
  "Boots of Speed Active": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", counted: false, from: "Boots of Speed",
    caveat: "listed — Disadvantage only on an Opportunity Attack",
    rule: Object.freeze({ item: "Boots of Speed", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgBootsOfSpeed0" }) }),
  "Demon Armor": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", counted: false, from: "Demon Armor",
    caveat: "listed — Disadvantage only against demons",
    rule: Object.freeze({ item: "Demon Armor", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgDemonArmor000", benefit: "Curse" }) }),
  "Air Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: Object.freeze({ item: "Air Ring of Elemental Command", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgAirRingOfElem", benefit: "Elemental Bane" }) }),
  "Earth Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: Object.freeze({ item: "Earth Ring of Elemental Command", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgEarthRingOfEl", benefit: "Elemental Bane" }) }),
  "Fire Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: Object.freeze({ item: "Fire Ring of Elemental Command", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgFireRingOfEle", benefit: "Elemental Bane" }) }),
  "Water Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Elemental Command",
    caveat: "listed — only against, or from, Elementals",
    rule: Object.freeze({ item: "Ring of Elemental Command", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgRingOfElement", benefit: "Elemental Bane" }) }),
  "Ring Focus": Object.freeze({ attacker: "advantage", target: "disadvantage", scope: "any", counted: false, from: "Ring of Water Elemental Command (2014)",
    caveat: "listed — only against, or from, Water Elementals",
    rule: Object.freeze({ item: "Ring of Water Elemental Command", uuid: "Compendium.dnd5e.items.Item.HnIERWmmra74hSCw" }) }),
  "Berserker Axe": Object.freeze({ attacker: "disadvantage", target: null, scope: "weapon", counted: false, from: "Berserker Axe",
    caveat: "listed — Disadvantage only with a weapon other than the axe",
    rule: Object.freeze({ item: "Berserker Battleaxe", uuid: "Compendium.dnd5e.items.Item.dvNzJqb7vq6oJlA2", benefit: "Curse" }) }),
  "Oathbow": Object.freeze({ attacker: "disadvantage", target: null, scope: "weapon", counted: false, from: "Oathbow",
    caveat: "listed — Disadvantage only with a weapon other than the bow, while the sworn enemy lives",
    rule: Object.freeze({ item: "Oathbow", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgOathbow000000" }) }),
  "Sword of Vengeance": Object.freeze({ attacker: "disadvantage", target: null, scope: "weapon", counted: false, from: "Sword of Vengeance",
    caveat: "listed — Disadvantage only with a weapon other than the sword",
    rule: Object.freeze({ item: "Sword of Vengeance", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgSwordOfVengea" }) }),
  // --- C. spent by the next attack roll — Vex and Sap's shape ---------------------------------
  "Guiding Bolt": Object.freeze({ attacker: null, target: "advantage", scope: "any", spend: "attack", from: "Guiding Bolt",
    rule: Object.freeze({ item: "Guiding Bolt", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplGuidingBol" }) }),
  "Mocked": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Vicious Mockery",
    rule: Object.freeze({ item: "Vicious Mockery", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplViciousMoc" }) }),
  "Vicious Mockery": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Vicious Mockery (2014)",
    rule: Object.freeze({ item: "Vicious Mockery", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplViciousMoc" }) }),
  "Enervated": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Ray of Enfeeblement",
    rule: Object.freeze({ item: "Ray of Enfeeblement", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplRayofEnfee" }) }),
  "Brief Enfeeblement": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Ray of Enfeeblement",
    rule: Object.freeze({ item: "Ray of Enfeeblement", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplRayofEnfee" }) }),
  // On the TARGET, the fighter as source (superiority-uses.js): the fighter's next attack alone spends it.
  "Feinting Attack": Object.freeze({ attacker: null, target: "advantage", scope: "any", only: "source", spend: "attack", from: "Battle Master",
    rule: Object.freeze({ item: "Feinting Attack", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvFeintingAt" }) }),
  "Distracted": Object.freeze({ attacker: null, target: "advantage", scope: "any", spend: "attack", except: "source", from: "Battle Master, Distracting Strike",
    rule: Object.freeze({ item: "Distracting Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvDistractin" }) }),
  "Aiming: Attack Advantage": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Aim, Deadly Aim (monsters)",
    rule: Object.freeze({ item: "Aim", uuid: "Compendium.dnd-monster-manual.features.Item.mmAim00000000000" }) }),
  "Killer's Fortune (Attack Advantage)": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Boon of Bloodshed (Heroes of Faerûn)",
    rule: Object.freeze({ item: "Boon of Bloodshed", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofBoonofBloodsh", benefit: "Killer’s Fortune" }) }),
  "Adv. Next Attack": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Lords' Alliance Agent (Heroes of Faerûn)",
    caveat: "counted — press Normal if this attack is not at the enemy that hurt your ally",
    rule: Object.freeze({ item: "Lords' Alliance Agent", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofLordsAlliance", benefit: "Reassert Honor" }) }),
  "Moonlight Step": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", from: "Moon Druid",
    rule: Object.freeze({ item: "Moonlight Step", uuid: "Compendium.dnd-players-handbook.classes.Item.phbdrdMoonlightS" }) }),
  "Disadvantaged": Object.freeze({ attacker: "disadvantage", target: null, scope: "any", spend: "attack", from: "Rival Coin",
    rule: Object.freeze({ item: "Rival Coin", uuid: "Compendium.dnd-dungeon-masters-guide.equipment.Item.dmgRivalCoin0000", benefit: "Heads" }) }),
  "Vigilant": Object.freeze({ attacker: null, target: "disadvantage", scope: "any", spend: "attack", from: "Tyro of the Gauntlet (Heroes of Faerûn)",
    rule: Object.freeze({ item: "Tyro of the Gauntlet", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofTyrooftheGaun", benefit: "Vigilant" }) }),
  // --- D. a feature, matched by name. Pack Tactics is judged on the map; its caveat is an unknown side.
  "Pack Tactics": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "allyNearTarget", from: "monsters",
    caveat: "counted — when the attacker's side cannot be read; press Normal if no ally of the attacker is within 5 feet of the target",
    rule: Object.freeze({ item: "Pack Tactics", uuid: "Compendium.dnd-monster-manual.features.Item.mmPackTactics000" }) }),
  "Bloodied Fury": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "bloodied", from: "monsters",
    rule: Object.freeze({ item: "Bloodied Fury", uuid: "Compendium.dnd-monster-manual.features.Item.mmBloodiedFury00" }) }),
  "Bloodied Frenzy": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "bloodied", from: "monsters",
    rule: Object.freeze({ item: "Bloodied Frenzy", uuid: "Compendium.dnd-monster-manual.features.Item.mmBloodiedFrenzy" }) }),
  "Purple Dragon Commandant": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "bloodied", from: "Heroes of Faerûn",
    rule: Object.freeze({ item: "Purple Dragon Commandant", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofPurpleDragonC", benefit: "Last Stand" }) }),
  "Warrior's Wrath": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "melee", judge: "targetBloodied", from: "DMG",
    rule: Object.freeze({ item: "Warrior's Wrath", uuid: "Compendium.dnd-dungeon-masters-guide.features.Item.dmgWarriorsWrath" }) }),
  "Blood Frenzy": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "targetDamaged", from: "monsters",
    rule: Object.freeze({ item: "Blood Frenzy", uuid: "Compendium.dnd-monster-manual.features.Item.mmBloodFrenzy000" }) }),
  "Grappler": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "targetGrappled", from: "the Grappler feat",
    caveat: "counted — press Normal if the target is not Grappled by you",
    rule: Object.freeze({ item: "Grappler", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftGrappler000", benefit: "Attack Advantage" }) }),
  "Street Justice": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", judge: "targetGrappled", from: "Heroes of Faerûn",
    caveat: "counted — press Normal if the target is not Grappled by your ally",
    rule: Object.freeze({ item: "Street Justice", uuid: "Compendium.dnd-heroes-faerun.options.Item.hofStreetJustice", benefit: "Headlock" }) }),
  "Precise Hunter": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", from: "Ranger",
    caveat: "counted — press Normal if the target is not your Hunter's Mark",
    rule: Object.freeze({ item: "Precise Hunter", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrPreciseHun" }) }),
  "Light Sensitivity": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in Bright Light",
    rule: Object.freeze({ item: "Light Sensitivity", uuid: "Compendium.dnd-monster-manual.features.Item.mmLightSensitivi" }) }),
  "Sunlight Sensitivity": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in sunlight",
    rule: Object.freeze({ item: "Sunlight Sensitivity", uuid: "Compendium.dnd-monster-manual.features.Item.mmSunlightSensit" }) }),
  "Sunlight Weakness": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in sunlight",
    rule: Object.freeze({ item: "Vampire Weakness", uuid: "Compendium.dnd-monster-manual.features.Item.mmVampireWeaknes", benefit: "Sunlight" }) }),
  "Sunlight Hypersensitivity": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Disadvantage only in sunlight",
    rule: Object.freeze({ item: "Sunlight Hypersensitivity", uuid: "Compendium.dnd-monster-manual.features.Item.mmSunlightHypers" }) }),
  "Mounted Combatant": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", counted: false, from: "the Mounted Combatant feat",
    caveat: "listed — Advantage only while mounted, against a smaller unmounted creature within 5 feet of the mount",
    rule: Object.freeze({ item: "Mounted Combatant", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftMountedComb", benefit: "Mounted Strike" }) }),
  "Invoke Duplicity": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", counted: false, from: "Trickery Cleric",
    caveat: "listed — Advantage only with the illusion and you both within 5 feet of the target",
    rule: Object.freeze({ item: "Invoke Duplicity", uuid: "Compendium.dnd-players-handbook.classes.Item.phbclcInvokeDupl", benefit: "Distract" }) }),
  "Ambusher": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any", counted: false, from: "monsters",
    caveat: "listed — Advantage only in the first round, against a creature it surprised",
    rule: Object.freeze({ item: "Ambusher", uuid: "Compendium.dnd5e.monsterfeatures.Item.EMygUh5uRujWaFYK" }) }),
  // --- E. a use chip, named as the feature (the pack ships Steady Aim with no effect), and the combat
  // clock as judge (`targetNotActed`: the round and the turn order; never out of combat).
  "Steady Aim": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack",
    rule: Object.freeze({ item: "Steady Aim", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeSteadyAim0" }),
    from: "Rogue 3 (a use chip)" }),
  "Assassinate": Object.freeze({ match: "feature", attacker: "advantage", target: null, scope: "any",
    judge: "targetNotActed",
    rule: Object.freeze({ item: "Assassinate", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeAssasinate", benefit: "Surprising Strikes" }),
    from: "Rogue — Assassin (Surprising Strikes)" }),
  // --- G. species traits bending SAVES (text only in the pack, read by name). A sheet save to END the
  // condition has no demand: listed, never counted (R1).
  "Brave": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Halfling",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["frightened"]) }),
    rule: Object.freeze({ item: "Halfling", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspHalfling000", benefit: "Brave" }) }),
  "Fey Ancestry": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["charmed"]) }),
    rule: Object.freeze({ item: "Fey Ancestry", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptFeyAncestr" }) }),
  "Dwarven Resilience": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Dwarf",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["poisoned"]) }),
    rule: Object.freeze({ item: "Dwarf", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspDwarf000000", benefit: "Dwarven Resilience" }) }),
  // Cannot fail a save whose failure would sleep it (decide/demand.js `putsToSleep`).
  "Trance": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Elf",
    saves: Object.freeze({ succeeds: true, sleep: true }),
    rule: Object.freeze({ item: "Trance", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptTrance0000" }) }),
  // While Grappled, its Athletics and Acrobatics checks count as the escape
  // (RULINGS *Where the table bends the rule*); the pack's effect carries only the carrying capacity.
  "Powerful Build": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Goliath",
    checks: "advantage", checksWhen: Object.freeze({ statuses: Object.freeze(["grappled"]), skills: Object.freeze(["ath", "acr"]) }),
    caveat: "counted — while Grappled, an Athletics or Acrobatics check counts as the escape",
    rule: Object.freeze({ item: "Goliath", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspGoliath0000", benefit: "Powerful Build" }) })
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
    rule: Object.freeze({ item: "Savage Attacker", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSavageAttac" }),
    from: "Origin feat" }),
  // `one`: the die with the most to gain (its average less its face), so the popup never asks which. With
  // Savage Attacker too, one popup: Savage's set first, then this die.
  "Piercer": Object.freeze({ key: "piercer", one: true, dealt: "piercing",
    rule: Object.freeze({ item: "Piercer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPiercer0000", benefit: "Puncture" }),
    from: "General feat" })
});

/**
 * A feature that rerolls a healing die on the `reroll` face, automatically, before the healing lands once
 * (heal-rerolls.js). `spells`: the owner's healing spells qualify; `own`: the feature's own healing — the
 * pack's `r1` is stripped from those formulas so the machine does the reroll.
 *   effect / max   a row on the HEALED creature: while `effect` stands on it, healing the module lands
 *                  (cast.js) is the roll's MAXIMUM — Beacon of Hope; the pack's effect carries the save modes
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 */
export const HEAL_REROLLS = Object.freeze({
  "Healer": Object.freeze({ reroll: 1, spells: true, own: true,
    rule: Object.freeze({ item: "Healer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftHealer00000", benefit: "Healing Rerolls" }),
    from: "Origin feat (Hermit)" }),
  "Beacon of Hope": Object.freeze({ effect: "Hopeful", max: true,
    caveat: "healing applied with a card's own buttons, or typed on a sheet, is not raised",
    rule: Object.freeze({ item: "Beacon of Hope", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplBeaconofHo" }),
    from: "Cleric spell, level 3 (Concentration, 1 minute)" })
});

/** Trade Initiative with a willing ally: once every combatant has rolled, the owner is asked once per
 * combat (initiative-swap.js). ⚠ NOT A KIND — a second customer is a row. */
export const INITIATIVE_SWAPS = Object.freeze({
  "Alert": Object.freeze({
    rule: Object.freeze({ item: "Alert", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftAlert000000", benefit: "Initiative Swap" }),
    from: "Origin feat (Criminal, Guard)" })
});

/**
 * An Unarmed Strike die "instead of the normal damage": the pack ships it only on the feature's own attack,
 * so unarmed-dice.js swaps that formula in at `preRollDamage`. A strike already rolling a die (Martial
 * Arts) is left alone. ⚠ NOT A KIND — a second customer is a row.
 */
export const UNARMED_DICE = Object.freeze({
  "Tavern Brawler": Object.freeze({
    rule: Object.freeze({ item: "Tavern Brawler", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftTavernBrawl", benefit: "Enhanced Unarmed Strike" }),
    from: "Origin feat (Sailor)" }),
  // `pick: "hands"`: two pack attacks (d6 weapon in hand, d8 empty hand); what the owner holds picks one.
  "Unarmed Fighting": Object.freeze({ pick: "hands",
    rule: Object.freeze({ item: "Unarmed Fighting", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstUnarmedFig" }),
    from: "Fighting Style feat" })
});

/** A kit use on a creature within `reach`, healed from its own Hit Point Dice: the size is picked in a popup
 * and the feature's heal activity of that size rolled (kit-tend.js). ⚠ NOT A KIND — a second customer is a row. */
export const KIT_TENDS = Object.freeze({
  "Healer": Object.freeze({ kit: "Healer's Kit", reach: 5,
    rule: Object.freeze({ item: "Healer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftHealer00000", benefit: "Battle Medic" }),
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
    rule: Object.freeze({ item: "Great Weapon Fighting", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstGreatWeapo" }),
    from: "Fighting Style feat" }),
  "Thrown Weapon Fighting": Object.freeze({ key: "thrown-weapon-fighting", gate: "thrown", bonus: "2",
    rule: Object.freeze({ item: "Thrown Weapon Fighting", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstThrownWeap" }),
    from: "Fighting Style feat" }),
  "Two-Weapon Fighting": Object.freeze({ key: "two-weapon-fighting", gate: "offhand", bonus: "@mod",
    rule: Object.freeze({ item: "Two-Weapon Fighting", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstTwoWeaponF" }),
    from: "Fighting Style feat" }),
  "Dueling": Object.freeze({ key: "dueling", gate: "oneHanded", bonus: "effect", takesOver: true,
    rule: Object.freeze({ item: "Dueling", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstDueling000" }),
    from: "Fighting Style feat" }),
  "Defense": Object.freeze({ key: "defense", gate: "armored", ac: "effect", takesOver: true,
    rule: Object.freeze({ item: "Defense", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstDefense000" }),
    from: "Fighting Style feat" }),
  "Unarmed Fighting": Object.freeze({ key: "unarmed-fighting", gate: "unarmed",
    rule: Object.freeze({ item: "Unarmed Fighting", uuid: "Compendium.dnd-players-handbook.feats.Item.phbfstUnarmedFig" }),
    from: "Fighting Style feat" }),
  "Great Weapon Master": Object.freeze({ key: "great-weapon-master", gate: "heavy", bonus: "@prof", feat: true,
    rule: Object.freeze({ item: "Great Weapon Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftGreatWeapon", benefit: "Heavy Weapon Mastery" }),
    from: "General feat" }),
  "Heavy Armor Master": Object.freeze({ key: "heavy-armor-master", gate: "heavyArmor", takesOver: true, feat: true,
    block: "@prof", types: Object.freeze(["bludgeoning", "piercing", "slashing"]),
    rule: Object.freeze({ item: "Heavy Armor Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftHeavyArmorM", benefit: "Damage Reduction" }),
    from: "General feat" }),
  // The pack ships Elemental Adept as text and Potent Poison as nothing: the rows are the mechanism.
  "Elemental Adept": Object.freeze({ key: "elemental-adept", gate: "always", feat: true, typed: true, spells: true,
    ignores: "resistance", minimum: 2, choices: Object.freeze(["acid", "cold", "fire", "lightning", "thunder"]),
    rule: Object.freeze({ item: "Elemental Adept", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftElementalAd", benefit: "Energy Mastery" }),
    from: "General feat" }),
  // Beside Two-Weapon Fighting it adds nothing twice (the machine adds one modifier).
  "Crossbow Expert": Object.freeze({ key: "crossbow-expert", gate: "offhandCrossbow", bonus: "@mod", feat: true,
    rule: Object.freeze({ item: "Crossbow Expert", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftCrossbowExp", benefit: "Dual Wielding" }),
    from: "General feat" }),
  "Poisoner": Object.freeze({ key: "poisoner", gate: "always", feat: true, ignores: "resistance", types: Object.freeze(["poison"]),
    rule: Object.freeze({ item: "Poisoner", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPoisoner000", benefit: "Potent Poison" }),
    from: "General feat" }),
  // No pack data for the breaker: the row is the switch and the face (concentration.js reads it).
  "Mage Slayer": Object.freeze({ key: "mage-slayer", gate: "always", feat: true, breaks: "concentration",
    rule: Object.freeze({ item: "Mage Slayer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftMageSlayer0", benefit: "Concentration Breaker" }),
    from: "General feat" })
});

/** What raises a repeated save — the closed set the R4 tripwire counts (repeat-saves.js). */
export const REPEAT_TRIGGERS = new Set(["turnEnd", "damaged", "action"]);

/**
 * A SPELL whose landed effect lets the target repeat the save, ending the effect on a success (RULINGS *The
 * spells slice*). Keyed by the spell; the effect is found on the bearer by the pack's effect name AND its
 * origin item (a Paralyzed from a ghoul's claw is not Hold Person's). The save is the item's own save
 * activity — never a DC or an ability copied. A success removes the effect through the cast card's receipt,
 * no choice (R1); the card says so and the name floats off the token (repeat-saves.js).
 *   effect     the pack's effect name, or a list of them (Blindness/Deafness, Eyebite, Contagion)
 *   on         REPEAT_TRIGGERS: "turnEnd" the bearer's turn end · "damaged" damage landing on it ·
 *              "action" offered on a card at the bearer's turn start (Otto's: its own action)
 *   advantage  "damaged" — the save has Advantage when damage raised it (Tasha's Hideous Laughter)
 *   onSave     overrides the activity's damage-on-save for the repeat (Phantasmal Killer: the pack's "half"
 *              is the cast's; the repeat's success takes none)
 *   count      { saves, fails?, press? } — the tally on the effect: `saves` successes end it, `fails` failures
 *              stop the asking (Contagion) or press `press` (Flesh to Stone's Petrified)
 *   caveat     what the rule leaves to the table, said on the card
 * Membership: every row. Left out on purpose: Eyebite's Asleep (ends on damage, no save — the table's).
 */
export const REPEAT_SAVES = Object.freeze({
  "Hold Person": Object.freeze({ effect: "Paralyzed", on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Hold Person", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHoldPerson" }),
    from: "Bard / Cleric / Druid / Sorcerer / Warlock / Wizard spell, level 2 (Concentration, 1 minute)" }),
  "Hold Monster": Object.freeze({ effect: "Paralyzed", on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Hold Monster", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHoldMonste" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 5 (Concentration, 1 minute)" }),
  "Tasha's Hideous Laughter": Object.freeze({ effect: "Uncontrollable Laughter", on: Object.freeze(["turnEnd", "damaged"]), advantage: "damaged",
    rule: Object.freeze({ item: "Tasha's Hideous Laughter", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplTashasHide" }),
    from: "Bard / Warlock / Wizard spell, level 1 (Concentration, 1 minute)" }),
  "Blindness/Deafness": Object.freeze({ effect: Object.freeze(["Blindness", "Deafness"]), on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Blindness/Deafness", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplBlindnessD" }),
    from: "Bard / Cleric / Sorcerer / Wizard spell, level 2 (1 minute)" }),
  "Crown of Madness": Object.freeze({ effect: "Spectral Crown", on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Crown of Madness", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCrownofMad" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 2 (Concentration, 1 minute)" }),
  "Slow": Object.freeze({ effect: "Slowed", on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Slow", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSlow000000" }),
    from: "Sorcerer / Wizard spell, level 3 (Concentration, 1 minute)" }),
  "Fear": Object.freeze({ effect: "Fear", on: Object.freeze(["turnEnd"]),
    caveat: "only while it has no line of sight to the caster — the table's call; a success it should not have had is reverted from the card",
    rule: Object.freeze({ item: "Fear", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFear000000" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 3 (Concentration, 1 minute)" }),
  "Confusion": Object.freeze({ effect: "Confused", on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Confusion", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplConfusion0" }),
    from: "Bard / Druid / Sorcerer / Wizard spell, level 4 (Concentration, 1 minute)" }),
  "Phantasmal Killer": Object.freeze({ effect: "Fears Manifested", on: Object.freeze(["turnEnd"]), onSave: "none",
    rule: Object.freeze({ item: "Phantasmal Killer", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplPhantasmal" }),
    from: "Wizard spell, level 4 (Concentration, 1 minute)" }),
  "Eyebite": Object.freeze({ effect: Object.freeze(["Panicked", "Sickened"]), on: Object.freeze(["turnEnd"]),
    rule: Object.freeze({ item: "Eyebite", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplEyebite000" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 6 (Concentration, 1 minute)" }),
  "Contagion": Object.freeze({
    effect: Object.freeze(["Infected (Strength)", "Infected (Dexterity)", "Infected (Constitution)", "Infected (Intelligence)", "Infected (Wisdom)", "Infected (Charisma)"]),
    on: Object.freeze(["turnEnd"]), count: Object.freeze({ saves: 3, fails: 3 }),
    caveat: "three failures lock the disease in for its seven days; the ability's Disadvantage is the effect's",
    rule: Object.freeze({ item: "Contagion", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplContagion0" }),
    from: "Cleric / Druid spell, level 5 (7 days)" }),
  "Flesh to Stone": Object.freeze({ effect: "Turning to Stone", on: Object.freeze(["turnEnd"]), count: Object.freeze({ saves: 3, fails: 3, press: "petrified" }),
    caveat: "three failures press Petrified, the spell's effect standing under it; a Petrified that outlasts the concentration is the table's",
    rule: Object.freeze({ item: "Flesh to Stone", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFleshtoSto" }),
    from: "Sorcerer / Wizard spell, level 6 (Concentration, 1 minute)" }),
  "Dominate Beast": Object.freeze({ effect: "Dominated", on: Object.freeze(["damaged"]),
    rule: Object.freeze({ item: "Dominate Beast", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDominateBe" }),
    from: "Druid / Ranger / Sorcerer spell, level 4 (Concentration, 1 minute)" }),
  "Dominate Person": Object.freeze({ effect: "Dominated", on: Object.freeze(["damaged"]),
    rule: Object.freeze({ item: "Dominate Person", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDominatePe" }),
    from: "Bard / Sorcerer / Wizard spell, level 5 (Concentration, 1 minute)" }),
  "Dominate Monster": Object.freeze({ effect: "Dominated", on: Object.freeze(["damaged"]),
    rule: Object.freeze({ item: "Dominate Monster", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDominateMo" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 8 (Concentration, 1 hour)" }),
  // The save is the dancer's ACTION: offered at its turn start, never demanded by the clock.
  "Otto's Irresistible Dance": Object.freeze({ effect: "Irresistible Dance", on: Object.freeze(["action"]),
    rule: Object.freeze({ item: "Otto's Irresistible Dance", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplOttosIrres" }),
    from: "Bard / Wizard spell, level 6 (Concentration, 1 minute)" })
});

/**
 * A SPELL whose landed effect pays the bearer something at the start of each of its turns that the pack
 * rolls once, at the cast (turn-grants.js): the origin item's `activity` is rolled again on the CASTER's
 * numbers and landed on the bearer, receipted, no choice (R1). Keyed by the spell; `effect` the pack's
 * effect name on the bearer. Precedent: the emanation's `heal on "turnStart"` (EMANATIONS, Aura of Life).
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 */
export const TURN_GRANTS = Object.freeze({
  "Heroism": Object.freeze({ effect: "Bravery", activity: "Heal", on: "turnStart",
    rule: Object.freeze({ item: "Heroism", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHeroism000" }),
    from: "Bard / Paladin spell, level 1 (Concentration, 1 minute)" })
});

/**
 * THE R4 TRIPWIRE (DESIGN.md R4, ARCHITECTURE §6): every closed kind set, with the size of the dnd5e enum it
 * mirrors (`system`; null for the module's own). tools/check-registry.mjs pins the total, so ADDING A KIND
 * FAILS THE GATE until the pin moves on purpose. Only masteries mirror one (`CONFIG.DND5E.weaponMasteries`).
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
      + "the template the system placed (2026-09-03) — the platform's Region keeps geometry and clock" },
  { name: "repeatSave", owner: "repeat-saves.js", kinds: REPEAT_TRIGGERS, system: null,
    note: "what raises a landed effect's repeated save (the spells slice, 2026-09-28): the bearer's turn "
      + "end, damage landing on it, or the bearer's own action offered at its turn start" }
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
export const repeatSaveEntries = () => everyRow(Object.keys(REPEAT_SAVES));
export const turnGrantEntries = () => everyRow(Object.keys(TURN_GRANTS));
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
