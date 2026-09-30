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
 * interrupt stays "reduce by hand". Keyed by the Interrupt list's names.
 *   uses        the item's own uses spent by a write at the cast (the activity consumes nothing)
 *   at          "attacker" — the cast is aimed at the attacker (a save activity's demand lands on it)
 *   failDamage  { type, equalTo: "taken" } — on the demanded save's FAILURE the attacker takes this type, equal to
 *               the damage the reactor took from the hit (saves/consequences.js) */
export const INTERRUPT_MULTIPLIERS = Object.freeze({
  "Uncanny Dodge": Object.freeze({ multiplier: 0.5,
    rule: Object.freeze({ item: "Uncanny Dodge", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeUncannyDod" }) }),
  // The GM's side: the half is the module's; the teleport and the save at the destination are the sheet's.
  "Toxic Escape": Object.freeze({ multiplier: 0.5,
    caveat: "the teleport and the Constitution save at the destination are the sheet's — use Save after",
    rule: Object.freeze({ item: "Toxic Escape", uuid: "Compendium.dnd-monster-manual.features.Item.mmToxicEscape000" }) }),
  // B2: the warlock's Reaction after a hit (2024's text): the damage halved AND the pack's own save activity used at the
  // attacker (`at: "attacker"`); a failure deals the attacker Psychic damage equal to what the warlock took (`failDamage`,
  // read off the hit's receipt by the saves machine); the item's once per Long Rest is spent by a write (`uses` — the
  // activity consumes nothing). The Charmed immunity is the sheet's (the pack's level-up).
  "Beguiling Defenses": Object.freeze({ multiplier: 0.5, uses: true, at: "attacker",
    failDamage: Object.freeze({ type: "psychic", equalTo: "taken" }),
    rule: Object.freeze({ item: "Beguiling Defenses", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkBeguilingD" }) })
});

/**
 * `damage` interrupts that REDUCE BY A ROLL: the pack's heal activity's formula is the reduction, rolled
 * in the open at the answer. ⚠ The Monster Manual's "Parry" is +2 AC: a row applies only where the item
 * carries the named activity (an EMPTY stored name → the first heal activity, locale-proof).
 *   pool     the activity's consumption is spent; none left offers nothing
 *   any      every damage the module applies is held for it, not only an attack hit (damage-holds.js)
 *   ally     feet — protects ANOTHER creature in reach; every guard in reach is asked, the first wins
 *   holding  "shieldOrWeapon" — a Shield or a Simple or Martial weapon held
 *   ranged   the hit must be a RANGED attack (Deflect Missile); a melee hit never holds for it
 *   types    the hit's damage must include one of these (read off the attack's activity; unread counts), unless
 *            the defender holds the `anyType` feature (Deflect Energy)
 *   atZero   the feature's activity of that name is OFFERED on the damage card when the reduction took the
 *            damage to 0 — Deflect Attacks' Redirect, the pack's own save activity used at the attacker
 *   eyebrow / spend / hit / by   the card's and popup's words;  label  the name shown when the row is keyed by its
 *            item (Protective Field on Psionic Power);  verb  a guard's answer ("intercept" by default)
 *   pool "ward" + of  (B4, Projected Ward): the reduction is the guard's WARD (WARD_POOLS `of`, its uses the hit points) —
 *            as much of the damage as the ward holds, spent from it; `any` with `ally`: a guard asked on ANY damage to the
 *            creature beside it, not an attack's alone
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
    from: "Fighting Style feat" }),
  // B4 — Projected Ward: the wizard's Arcane Ward absorbs a creature's damage within 30 ft, a Reaction (the ward's own pool).
  "Projected Ward": Object.freeze({ activity: "Project Ward", pool: "ward", of: "Arcane Ward", any: true, ally: 30, verb: "absorb",
    eyebrow: "Reaction", spend: "Reaction", hit: "any damage, not only an attack", by: "your Arcane Ward's hit points",
    rule: Object.freeze({ item: "Projected Ward", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwzdProjectedW" }),
    from: "Wizard — Abjurer 6" }),
  // A1: rolled, as Parry's; before, "reduce by hand" (RULINGS *The PHB classes — A1*).
  "Deflect Attacks": Object.freeze({ activity: "Reduce", pool: false,
    eyebrow: "Reaction", spend: "Reaction", hit: "attack", by: "1d10 plus your Dexterity modifier and Monk level",
    types: Object.freeze(["bludgeoning", "piercing", "slashing"]), anyType: "Deflect Energy", atZero: "Redirect",
    rule: Object.freeze({ item: "Deflect Attacks", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkDeflectAtt" }),
    from: "Monk 3" }),
  // A2 — Protective Field (keyed by its item, as every row): yourself on any damage (Stone's Endurance's `any`),
  // another within 30 ft on an attack's (Interception's guard). The Soulknife's Psionic Power carries no such activity.
  "Psionic Power": Object.freeze({ activity: "Protective Field", label: "Protective Field", verb: "reduce", pool: true, any: true, ally: 30,
    eyebrow: "Reaction", spend: "Psionic Energy Die", hit: "attack", by: "a Psionic Energy Die plus your Intelligence modifier (at least 1)",
    rule: Object.freeze({ item: "Psionic Power", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow", benefit: "Protective Field" }),
    from: "Fighter — Psi Warrior 3" }),
  // The GM's side (Deflect Attacks' shape, ranged only): the redirect at 0 is the sheet's Save.
  "Deflect Missile": Object.freeze({ activity: "Reduce Damage", pool: true, ranged: true,
    eyebrow: "Reaction", spend: "use", hit: "ranged attack", by: "1d10",
    caveat: "\"Bludgeoning, Piercing, or Slashing\" is the table's; the redirect when the damage is reduced to 0 is the sheet's Save",
    rule: Object.freeze({ item: "Deflect Missile", uuid: "Compendium.dnd-monster-manual.features.Item.mmDeflectMissile" }),
    from: "monsters" })
});

/**
 * The `roll` interrupts: Disadvantage on an attack already rolled — a second d20, the lower stands, the
 * verdict retaken against the live AC (decide/rescue-hit.js). They differ only in cost:
 *   reaction / uses   takes the Reaction / spends one of the item's uses;  point  what a use is called
 *   activity  the pack activity that IS this answer (a use from the sheet answers the hold)
 *   after     what the table still does once the roll is bent — a card line
 *   heal      B4 — a FEATURE whose heal activity lands on the flared creature with the answer (Improved Warding Flare's
 *             Temporary Hit Points), rolled on the answerer's numbers, receipted; absent from the sheet, nothing
 * ⚠ The 2014 Halfling "Lucky" shares the name with no uses: the lookup demands the item's own uses.
 */
export const INTERRUPT_ROLLS = Object.freeze({
  "Lucky": Object.freeze({ reaction: false, uses: true, point: "Luck Point", activity: "Disadvantage",
    rule: Object.freeze({ item: "Lucky", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftLucky000000", benefit: "Disadvantage" }),
    from: "Origin feat" }),
  "Warding Flare": Object.freeze({ heal: "Improved Warding Flare", reaction: true, uses: true, point: null, activity: "Flare",
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
    from: "Fighting Style feat" }),
  // THE BYSTANDERS (RULINGS *The full release — the order*, Q2 option A): another creature's roll, bent by
  // someone who is neither the roller nor its target. `bystander` the feet from the bystander to the ROLLER;
  // `tests` which D20 Tests; `bend` "die" (a signed `die` read off the BYSTANDER's roll data, or a flat
  // `bonus`) or "neutralise" (Advantage and Disadvantage gone, the first d20 standing — a rule of cool, Q3);
  // `damage` the die may come off the damage roll instead (the card's quiet road, when the gate is silent).
  // `on` which attack it bends: "hit" (a hostile's hit on the bystander's side, turned to a miss — the default),
  // "miss" (its own side's miss, turned to a hit), "both"; `self` the bystander's own roll too, with no Reaction
  // (`selfActivity` its pack activity); on a HIT the hit creature may answer for itself, and `only: "self"`
  // lets nobody else. `reach` "target": the feet are to the HIT creature (Glorious Defense), not the roller.
  // `bonus` may be a formula read off the answerer's roll data. `inspired`: the feature is the granting BARD's,
  // the die the bard's Bardic Inspiration, paid by deleting the answerer's own Inspired effect (Combat
  // Inspiration's Defense). `turned: "strike"`: a hit the bend turns to a miss offers the answerer one weapon
  // attack at the attacker (Riposte's driven attack). The pool is the activity's own consumption (`poolOf`).
  // Asked only when the bend can change the verdict.
  "Cutting Words": Object.freeze({ reaction: true, uses: true, point: null, activity: "Cut with Words",
    bystander: 60, tests: Object.freeze(["attack", "check"]), bend: "die", sign: -1, die: "scale.bard.inspiration", damage: true,
    rule: Object.freeze({ item: "Cutting Words", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdCuttingWor" }),
    from: "Bard — College of Lore 3" }),
  "Restore Balance": Object.freeze({ reaction: true, uses: true, point: null, activity: "Prevent Advantage/Disadvantage",
    bystander: 60, tests: Object.freeze(["attack", "save", "check"]), bend: "neutralise", on: "both",
    rule: Object.freeze({ item: "Restore Balance", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrRestoreBal" }),
    from: "Sorcerer — Clockwork Sorcery 3" }),
  "Guided Strike": Object.freeze({ reaction: true, uses: true, point: null, activity: "Guide Another Creature",
    self: true, selfActivity: "Guide Yourself",
    bystander: 30, tests: Object.freeze(["attack"]), bend: "die", sign: 1, bonus: 10, on: "miss",
    rule: Object.freeze({ item: "Guided Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbclcGuidedStri" }),
    from: "Cleric — War Domain 3" }),
  // A1: the AC bonus as the attack roll's minus against this target alone — the same arithmetic.
  "Glorious Defense": Object.freeze({ reaction: true, uses: true, point: null, activity: "Glorious Defense",
    reach: "target", bystander: 10, tests: Object.freeze(["attack"]), bend: "die", sign: -1,
    bonus: "max(1, @abilities.cha.mod)", on: "hit", turned: "strike",
    rule: Object.freeze({ item: "Glorious Defense", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnGloriousDe" }),
    from: "Paladin — Oath of Glory 15" }),
  // `bystander` 5: the hit creature itself stands at 0 feet (`only: "self"`).
  "Combat Inspiration": Object.freeze({ reaction: true, uses: false, point: null, activity: null, inspired: true,
    only: "self", reach: "target", bystander: 5, tests: Object.freeze(["attack"]), bend: "die", sign: -1, on: "hit",
    rule: Object.freeze({ item: "Combat Inspiration", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdCombatInsp", benefit: "Defense" }),
    from: "Bard — College of Valor 3" }),
  // A7: a STORED face replaces the d20 (`bend: "set"`, `stored` the STORED_DICE row that keeps the faces); `bystander:
  // "sight"` — the scene is the reach, sight is never judged (Q6); no Reaction, no pool. `ask: "crit"` — on an attack a
  // popup only for a critical hit, else the card's quiet row (the noise gate's narrowing, Q2 option A); saves ask.
  "Portent": Object.freeze({ reaction: false, uses: false, point: null, activity: null, stored: "Portent",
    bystander: "sight", tests: Object.freeze(["attack", "save"]), bend: "set", on: "both", ask: "crit",
    rule: Object.freeze({ item: "Portent", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwzdPortent000" }),
    from: "Wizard — Diviner 3" }),
  // B1: the bard's Reaction REROLLS a friend's failed save (the bard's own included) `against` an effect that applies one
  // of the listed conditions — read off the demand card, so a sheet save with no demand is never offered; the new roll
  // has Advantage (`advantage`) and stands. `bend: "reroll"` bends a FRIEND's roll only. The pack's activity is UNNAMED:
  // `activity: null` reads the item's first (bystanders.js).
  "Countercharm": Object.freeze({ reaction: true, uses: false, point: null, activity: null,
    bystander: 30, tests: Object.freeze(["save"]), bend: "reroll", advantage: true, against: Object.freeze(["charmed", "frightened"]),
    rule: Object.freeze({ item: "Countercharm", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdCountercha" }),
    from: "Bard 7" }),
  // B2: the ranger's Reaction on a SUCCEEDED demanded save `against` Charmed or Frightened — anyone's, any side, within
  // 120 ft (`bend: "twist"`): the roll is not bent; the pack's Save activity is used at the creature the ranger has
  // TARGETED (never the roller — "a different creature"; sight is not judged, Q6). SAVE_PRESSES "Beguiling Twist" lands
  // the failure's condition by the ranger's word.
  "Beguiling Twist": Object.freeze({ reaction: true, uses: false, point: null, activity: "Save",
    bystander: 120, tests: Object.freeze(["save"]), bend: "twist", against: Object.freeze(["charmed", "frightened"]),
    rule: Object.freeze({ item: "Beguiling Twist", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrBeguilingT" }),
    from: "Ranger — Fey Wanderer 7" }),
  // The GM's side (Shadowy Dodge's row): the pack lands no effect for the Advantage after — the table's.
  "Limited Foresight": Object.freeze({ reaction: true, uses: true, point: null, activity: "Expend Use",
    after: "you have Advantage on attack rolls against it until the end of your next turn (the table's)",
    rule: Object.freeze({ item: "Limited Foresight", uuid: "Compendium.dnd-monster-manual.features.Item.mmLimitedForesig" }),
    from: "monsters (the cyclops)" }),
  // B4 — Bend Luck: ±1d4 on another creature's attack, save or check within 60 ft, a Sorcery Point (Font of Magic, `poolOf`).
  // `sign: "either"` FOLLOWS THE SIDE (decide/rescue-hit.js signFor): a friend's roll +, a foe's − — R1, the one sensible
  // answer; `on: "both"`: a foe's hit and a friend's miss. The die is a plain formula (`die: "1d4"`, lookup.js bystanderDie).
  "Bend Luck": Object.freeze({ reaction: true, uses: true, point: "Sorcery Point", activity: "Bend Luck",
    bystander: 60, tests: Object.freeze(["attack", "save", "check"]), bend: "die", sign: "either", die: "1d4", on: "both",
    rule: Object.freeze({ item: "Bend Luck", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrBendLuck00" }),
    from: "Sorcerer — Wild Magic Sorcery 6" }),
  // B4 — Cosmic Omen: the Long Rest's d6 kept on a STORED_DICE chip (never spent); `sign: "omen"` reads its parity — even
  // Weal +1d6 (a friend's roll), odd Woe −1d6 (a foe's); `omen` names the pack's activity for each, the item's uses the pool.
  // "About to make a D20 Test" is bent after the roll (the platform register, Restore Balance's road).
  "Cosmic Omen": Object.freeze({ reaction: true, uses: true, point: null, activity: null, stored: "Cosmic Omen",
    omen: Object.freeze({ even: "Weal (Even)", odd: "Woe (Odd)" }),
    bystander: 30, tests: Object.freeze(["attack", "save", "check"]), bend: "die", sign: "omen", die: "1d6", on: "both",
    rule: Object.freeze({ item: "Cosmic Omen", uuid: "Compendium.dnd-players-handbook.classes.Item.phbdrdCosmicOmen" }),
    from: "Druid — Circle of the Stars 6" })
});

/**
 * d20 FOLD kinds — each names a SPEND, never a contribution shape (ARCHITECTURE.md §6):
 *   heroic     `system.attributes.inspiration`, a bare boolean — spent by a WRITE
 *   tactical   an item's uses through a real activity — `use()`
 *   bardic     the "Inspired" effect — spent by a DELETE; its die resolves on the granting bard (`origin`)
 *   advantage  a second d20, the higher stands, paid with an item use — an initiative rolled with no dialog
 *   succeed    a failed save turned into a success through the feature's activity (SAVE_SUCCEEDS)
 *   reroll     a FAILED save rerolled with a bonus added, the new roll standing, paid by the row's cost (REROLLS) — the
 *              PHB classes' B1: a spend `heroic` cannot say (a use, a Rage's once) and a contribution no row can (replace + add)
 */
export const D20_FOLD_KINDS = new Set(["heroic", "tactical", "bardic", "seeking", "advantage", "succeed", "reroll"]);

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
 *   weapons  a base item in `base`, or every property in `properties`; absent: any weapon (an Unarmed Strike too)
 *   ranged   a ranged attack earns it too (the default is melee only)
 *   uses     the feat's own uses: none left, no reminder; the reminder says how many stand
 *   option   the feature's kept option (CLOCK_RIDERS `option`, asked on the damage offer) must be this one
 *   near     feet — another creature must stand this close to the attack's target (Horde Breaker's second target)
 *   drive    the reminder is an OFFER: Use drives the weapon's attack at the same creature, a d4 Bludgeoning
 */
export const BONUS_SWINGS = Object.freeze({
  "Great Weapon Master": Object.freeze({ when: "critOrKill", label: "Hew", rule: RULE_TEXT.hew }),
  "Polearm Master": Object.freeze({ when: "attack", label: "Pole Strike",
    weapons: Object.freeze({ base: Object.freeze(["quarterstaff", "spear"]), properties: Object.freeze(["hvy", "rch"]) }),
    drive: true,
    swing: "A Bonus Action: the other end of the weapon, a d4 of Bludgeoning — <strong>Pole Strike</strong> makes the attack for you.",
    rule: Object.freeze({ item: "Polearm Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPolearmMast", benefit: "Pole Strike" }),
    from: "General feat" }),
  // A reminder, never driven: the pack's "Expend Use" spends the use from the sheet.
  "War Priest": Object.freeze({ when: "attack", label: "War Priest", ranged: true, uses: true,
    swing: "A Bonus Action: one attack with a weapon or an Unarmed Strike — use <strong>War Priest</strong> from the sheet (it spends the use), then swing.",
    rule: Object.freeze({ item: "War Priest", uuid: "Compendium.dnd-players-handbook.classes.Item.phbclcWarPriest0" }),
    from: "Cleric — War Domain 3" }),
  // B4 — War Magic: a reminder alone — one of the Attack action's attacks may be a cantrip (cast from the sheet).
  "War Magic": Object.freeze({ when: "attack", label: "War Magic", ranged: true,
    swing: "One of this Attack action's attacks may be a <strong>cantrip</strong> instead — cast it from the sheet (Improved War Magic at 18: any spell of level 1 or 2).",
    rule: Object.freeze({ item: "War Magic", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrWarMagic00" }),
    from: "Fighter — Eldritch Knight 7" }),
  // Not a Bonus Action: the extra attack is the option's own, once per turn, from the sheet.
  "Hunter's Prey": Object.freeze({ when: "attack", label: "Horde Breaker", ranged: true, option: "Horde Breaker", near: 5,
    swing: "One more attack with the same weapon at a different creature within 5 feet of the original target, one you haven't attacked this turn — make it from the sheet.",
    rule: Object.freeze({ item: "Hunter's Prey", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrHuntersPre", benefit: "Horde Breaker" }),
    from: "Ranger — Hunter 3" })
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
 *   forgo  true — the MIRROR (B3, Brutal Strike): the tick FORGOES the roll's Advantage (every Advantage source struck,
 *          the net Normal) and records `forgo` on the attack's reminder; nothing is spent; `ability` narrows the attack's
 *          ability ("str"); off when the attack has Disadvantage or no Advantage to forgo
 * ⚠ The 2014 Halfling "Lucky" shares the name with no uses — the lookup demands them.
 */
export const ADVANTAGE_BUYS = Object.freeze({
  "Brutal Strike": Object.freeze({ forgo: true, tests: Object.freeze(["attack"]), ability: "str", uses: false, point: null, activity: null,
    rule: Object.freeze({ item: "Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbBrutalStri" }),
    from: "Barbarian 9" }),
  "Lucky": Object.freeze({ uses: true, point: "Luck Point", activity: "Advantage",
    tests: Object.freeze(["attack", "save", "check", "initiative"]),
    rule: Object.freeze({ item: "Lucky", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftLucky000000", benefit: "Advantage" }),
    from: "Origin feat" }),
  // Regained by a Sorcerer slot cast while spent — the surge rolls at once (CAST_RIDERS "Wild Magic Surge", A7).
  "Tides of Chaos": Object.freeze({ uses: true, point: "use", activity: "Expend for Advantage",
    tests: Object.freeze(["attack", "save", "check", "initiative"]),
    rule: Object.freeze({ item: "Tides of Chaos", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrTidesOfCha" }),
    from: "Sorcerer — Wild Magic Sorcery 3" })
});

/**
 * A feature turning a FAILED save into a success once per rest — the `succeed` d20 fold (d20-folds.js):
 * offered on a demanded save before its verdict, and on a sheet save as an offer the roller judges.
 *   activity  the feature's activity that pays;  label  the benefit's name;  abilities  the saves reached
 * ⚠ Legendary Resistance is NOT a row: dnd5e ships it NATIVE (the NPC's `resistSave`, its button on the failed
 * save's message, the `legres` resource spent by the system), and the saves machine already honours the flip
 * (saves/verdict.js `forced`; smoke-saves §6). A row would be a second entry path (RULINGS *The GM's side — the five shapes*).
 */
export const SAVE_SUCCEEDS = Object.freeze({
  "Mage Slayer": Object.freeze({ activity: "Guard Mind", label: "Guarded Mind",
    abilities: Object.freeze(["int", "wis", "cha"]),
    rule: Object.freeze({ item: "Mage Slayer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftMageSlayer0", benefit: "Guarded Mind" }),
    from: "General feat" })
});

/**
 * A FAILED save REROLLED with a bonus added, the new roll standing — the `reroll` d20 fold (d20-folds.js; the PHB
 * classes, B1). Offered where Guarded Mind is: on a demanded save before its verdict (the withhold) and on a sheet
 * save as an offer the roller judges. The reroll REPLACES the d20 (its own crit and fumble) and the bonus folds as
 * `add` in the same entry (decide/verdict.js). Another creature's save rerolled is the bystander's row
 * (INTERRUPT_ROLLS "Countercharm", `bend: "reroll"`), not a fold.
 *   tests      the D20 Tests reached
 *   bonus      a formula on the ROLLER's roll data; the pack's own activity roll ("Bonus") is read first where it
 *              carries one. Unreadable → the fold stays off (BARDIC's shape: never a guessed number)
 *   uses       the item's own uses pay (Indomitable's scale)
 *   while      "raging" — only while the Rage effect stands;  once  "rage" — once per Rage, the mark on the Rage
 *              effect itself (`rerollUsed`), gone with it
 *   advantage  the reroll has Advantage (Living Legend's save, D1)
 */
export const REROLLS = Object.freeze({
  "Indomitable": Object.freeze({ tests: Object.freeze(["save"]), bonus: "@classes.fighter.levels", uses: true,
    rule: Object.freeze({ item: "Indomitable", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrIndomitabl" }),
    from: "Fighter 9" }),
  "Fanatical Focus": Object.freeze({ tests: Object.freeze(["save"]), bonus: "@scale.barbarian.rage-damage", while: "raging", once: "rage",
    rule: Object.freeze({ item: "Fanatical Focus", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbFanaticalF" }),
    from: "Barbarian — Path of the Zealot 6" })
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
 *   judge     "raging" | "reckless" (raging AND the "Reckless" effect on the attacker) | "targetDamaged"
 *             (the hit target below its Hit Point maximum) | "opportunity" (a driven Opportunity Attack, or an
 *             off-turn melee attack, ticked with the caveat) | "transformed"
 *   enchant   due only on the item carrying the feature's own enchantment (Repelling Blast's "Make
 *             Repelling"); with none on the sheet, the row's `spell` stands for it
 *   maxSize   the largest target size it reaches; a larger one is not due, an unreadable size is
 *   inspired  the feature is the granting BARD's, the die the bard's Bardic Inspiration, paid by the attacker's
 *             own Inspired effect (deleted as it rides) — Combat Inspiration's damage half
 *   unticked  offered UNticked, and never ridden without a pick (a driven roll): a scarce die is spent by choice
 *   option / options  the sheet never records which option the character took (Hunter's Prey): the offer asks
 *             once, the pick is kept on the feature (`option` flag), and only the picked option's rows ride
 *   type      "weapon" — the weapon's damage type; otherwise the part's first
 *   dealt / crit  a damage type the hit must deal / a Critical Hit only
 *   lands     an effect with no activity to carry it: `{ name, from?, id, bare? }` — copied from the
 *             feature's effect `from` (changes dropped if `bare`), keyed by `id` so a new hit refreshes it
 *   bonusDice one more first die on a crit — dnd5e's `critical.bonusDice`, never doubled
 *   self      the rider is the ATTACK's own item, whatever its type (a monster's Chaos Blade, a weapon): due on that attack alone, its
 *             activity the attack's, no extra dice
 *   random    `{ die }` — one of the activity's effects, named "N: …", lands by the die (the GM's side:
 *             "roll 1d4: on a 1 Charmed, on a 2 Frightened…"), the pack's own duration; a `clock` may pin it
 *   label / says / caveat   the offer's and card's words
 *   enchantBy B4 — the enchantment judged is ANOTHER feature's (Lifedrinker's pact weapon: Pact of the Blade's bond); none
 *             bonded on the sheet, any weapon counts and the card says so (lookup.js pactWeaponFits)
 *   offers    B4 — after the rider rides, the damage card OFFERS the feature's named activity as a button, used at the
 *             attacker (Lifedrinker's heal: a Hit Point Die spent, the sheet's own heal activity — "you can")
 * Left out: choices the sheet does not record or judgments the module cannot make (Brutal Strike, Hand of
 * Harm, Eldritch Smite, Foe Slayer). Death Strike: DEATH_STRIKE.
 */
export const CLOCK_RIDERS = Object.freeze({
  // THE GM'S SIDE — the random condition on a hit (RULINGS *The Monster Manual — the waiting rows built*): the
  // attack's own four effects, one landed by a d4 until the bearer's next turn (the pack's 1-round duration).
  "chaos-blade": Object.freeze({ feature: "Chaos Blade", activity: null, self: true, when: "any", random: Object.freeze({ die: 4 }),
    label: "Chaos Blade", says: "a d4 decides the condition — Charmed, Frightened, Poisoned or Incapacitated — until the start of your next turn",
    rule: Object.freeze({ item: "Chaos Blade", uuid: "Compendium.dnd-monster-manual.features.Item.mmChaosBlade0000" }),
    from: "monsters" }),
  "chaos-claw": Object.freeze({ feature: "Chaos Claw", activity: null, self: true, when: "any", random: Object.freeze({ die: 4 }),
    label: "Chaos Claw", says: "a d4 decides the condition — Charmed, Frightened, Poisoned or Incapacitated — until the start of your next turn",
    rule: Object.freeze({ item: "Chaos Claw", uuid: "Compendium.dnd-monster-manual.features.Item.mmChaosClaw00000" }),
    from: "monsters" }),
  "chaos-staff": Object.freeze({ feature: "Chaos Staff", activity: null, self: true, when: "any", random: Object.freeze({ die: 4 }),
    label: "Chaos Staff", says: "a d4 decides the condition — Charmed, Frightened, Poisoned or Incapacitated — until the start of your next turn",
    rule: Object.freeze({ item: "Chaos Staff", uuid: "Compendium.dnd-monster-manual.features.Item.mmChaosStaff0000" }),
    from: "monsters" }),
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
  // Offered unticked (RULINGS *The PHB classes — A1*): the die is the ally's to spend.
  "combat-inspiration": Object.freeze({ feature: "Combat Inspiration", activity: null, when: "any", inspired: true, unticked: true,
    label: "Combat Inspiration",
    rule: Object.freeze({ item: "Combat Inspiration", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdCombatInsp", benefit: "Offense" }),
    from: "Bard — College of Valor 3" }),
  // The option asked once and kept (RULINGS *The PHB classes — A1*); Horde Breaker is BONUS_SWINGS' row.
  "hunters-prey-colossus-slayer": Object.freeze({ feature: "Hunter's Prey", activity: "Damage", when: "oncePerTurn", judge: "targetDamaged",
    weapon: true, type: "weapon", label: "Colossus Slayer",
    option: "Colossus Slayer", options: Object.freeze(["Colossus Slayer", "Horde Breaker"]),
    rule: Object.freeze({ item: "Hunter's Prey", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrHuntersPre", benefit: "Colossus Slayer" }),
    from: "Ranger — Hunter 3" }),
  "frenzy": Object.freeze({ feature: "Frenzy", activity: "Damage", when: "oncePerTurn", judge: "reckless", weapon: true, type: "weapon",
    label: "Frenzy",
    rule: Object.freeze({ item: "Frenzy", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbFrenzy0000" }),
    from: "Barbarian — Path of the Berserker 3" }),
  // No dice: a card line per beam that hits; the push is the table's (the token is never moved).
  "repelling-blast": Object.freeze({ feature: "Repelling Blast", activity: null, when: "any", enchant: true, spell: "Eldritch Blast",
    maxSize: "lg", label: "Repelling Blast", says: "push it up to 10 feet straight away from you (move the token)",
    rule: Object.freeze({ item: "Repelling Blast", uuid: "Compendium.dnd-players-handbook.classes.Item.phbinvRepellingB" }),
    from: "Eldritch Invocation (Warlock 2)" }),
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
    from: "General feat (Sentinel)" }),
  // B2: Eldritch Strike — the pack's "Struck" (no activity carries it) landed by any weapon hit, until the end of the
  // fighter's next turn (the `vex` window is that clock); EFFECT_BENDS "Struck" reads it on the target's next save
  // against the fighter's spell and spends it.
  "eldritch-strike": Object.freeze({ feature: "Eldritch Strike", activity: null, label: "Eldritch Strike", when: "any", weapon: true,
    lands: Object.freeze({ name: "Struck", from: "Struck", id: "bfStruck00000000" }), clock: "vex",
    says: "Disadvantage on its next saving throw against a spell you cast, until the end of your next turn",
    rule: Object.freeze({ item: "Eldritch Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrEldritchSt" }),
    from: "Fighter — Eldritch Knight 10" }),
  // B4 — Lifedrinker: 1d6 once per turn on a pact-weapon hit, the type the activity's first (necrotic — the rider ruling; psychic
  // or radiant by hand); the heal (a Hit Point Die, the pack's own activities) OFFERED on the damage card.
  "lifedrinker": Object.freeze({ feature: "Lifedrinker", activity: "Damage", when: "oncePerTurn", weapon: true, enchantBy: "Pact of the Blade",
    offers: Object.freeze({ activity: "Heal (Largest Hit Die)", label: "Heal — spend a Hit Point Die" }),
    caveat: "the type is the activity's first (necrotic) — psychic or radiant by hand",
    rule: Object.freeze({ item: "Lifedrinker", uuid: "Compendium.dnd-players-handbook.classes.Item.phbinvLifedrinke" }),
    from: "Eldritch Invocation (Warlock 9)" }),
  // B4 — Relentless Avenger: Sentinel's Halt on the paladin's Opportunity Attack hit — the pack's own speed-0 effect for the
  // rest of the current turn (the `halt` clock); the paladin's free move is the table's.
  "relentless-avenger": Object.freeze({ feature: "Relentless Avenger", activity: null, label: "Relentless Avenger", when: "any", judge: "opportunity",
    lands: Object.freeze({ name: "Relentless Avenger", from: "Relentless Avenger", id: "bfRelentlessAvg0" }), clock: "halt",
    says: "Speed 0 for the rest of the current turn; you may move up to half your Speed as part of the Reaction (the table's)",
    caveat: "only on an Opportunity Attack",
    rule: Object.freeze({ item: "Relentless Avenger", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnRelentless" }),
    from: "Paladin — Oath of Vengeance 7" })
});

/** Text-only features whose whole consequence is a bend on the next roll: use-chips.js writes a chip named
 * as the feature, EFFECT_BENDS reads it, the roll spends it. `window` a CHIP_WINDOWS key; `changes` the
 * sheet changes; `on: "miss"` + `against` — written by a MISS, one chip per missed creature, carrying its uuid
 * (Studied Attacks, B3). B4: `on: "hit"` + `holder: "target"` — written by a HIT on the feature's bearer, the chip
 * on the BEARER against the attacker (`chipName` its name: Multiattack Defense on Defensive Tactics); `melee` is
 * the bend row's scope (Shadow Step: the next melee attack). Membership: Effect Sources. */
export const USE_CHIPS = Object.freeze({
  "Steady Aim": Object.freeze({ key: "steadyAim", bend: "advantage", window: "steadyAim",
    rule: Object.freeze({ item: "Steady Aim", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeSteadyAim0" }),
    note: "Speed 0 until the end of the turn; the next attack roll spends it",
    changes: Object.freeze([Object.freeze({ key: "system.attributes.movement.walk", mode: 5, value: "0" })]) }),
  // B3 — armed by a MISS (`on: "miss"`, read as rolled on the attack card — Graze's road), one chip per missed creature on the
  // attacker, `against` that creature (EFFECT_BENDS "Studied Attacks" reads the chip only at that target; the roll spends it).
  "Studied Attacks": Object.freeze({ key: "studiedAttacks", bend: "advantage", window: "vex", on: "miss", against: true,
    rule: Object.freeze({ item: "Studied Attacks", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrStudiedAtt" }),
    note: "the next attack roll against that creature spends it, before the end of your next turn" }),
  // B4 — Shadow Step: the teleport's use arms Advantage on the next MELEE attack this turn (the pack ships no effect).
  "Shadow Step": Object.freeze({ key: "shadowStep", bend: "advantage", window: "steadyAim", melee: true,
    rule: Object.freeze({ item: "Shadow Step", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkShadowStep" }),
    note: "the next melee attack roll this turn spends it; the teleport is the table's move" }),
  // B4 — Defensive Tactics' Multiattack Defense: once a creature hits the ranger, +4 AC against that creature's later attacks this
  // turn — a chip on the RANGER against the attacker; EFFECT_BENDS "Multiattack Defense" pushes −4 onto that attacker's rolls.
  "Defensive Tactics": Object.freeze({ key: "multiattackDefense", chipName: "Multiattack Defense", bend: null, window: "halt", on: "hit", holder: "target", against: true,
    rule: Object.freeze({ item: "Defensive Tactics", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrDefensiveT", benefit: "Multiattack Defense" }),
    note: "+4 AC against that creature's attacks for the rest of the current turn" })
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
    saves: Object.freeze({ dex: "Poison Save (Dexterity)", int: "Poison Save (Intelligence)" }), list: "damageRules",
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
 *          option that lands `status`, `default` what the clock chooses (saves/choices.js, kind `word`); with
 *          `statuses` (option → status) every option presses its own (Beguiling Twist)
 *   lasts  the pressed status's duration ({ rounds, seconds }); none → until removed
 *   success  the activity's OWN effects by name that land on a SUCCESS, never a failure (no `status`): the
 *          pack marks Stunning Strike's Slowed failure-only (A2)
 */
export const SAVE_PRESSES = Object.freeze({
  "Stunning Strike": Object.freeze({ success: Object.freeze(["Slowed"]),
    rule: Object.freeze({ item: "Stunning Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkStunningSt" }) }),
  // Grovel alone lands a condition; Approach, Flee and Halt move or hold the token, the table's.
  "Command": Object.freeze({ status: "prone", onFail: true,
    word: Object.freeze({ ask: "Which word did you speak?", options: Object.freeze(["Approach", "Flee", "Grovel", "Halt"]), presses: "Grovel", default: "Halt" }),
    rule: Object.freeze({ item: "Command", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCommand000" }) }),
  "Web": Object.freeze({ status: "restrained", onFail: true,
    rule: Object.freeze({ item: "Web", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplWeb0000000" }) }),
  // B2: the twist's Wisdom save (INTERRUPT_ROLLS "Beguiling Twist") — the pack ships no effect; the ranger's word picks the
  // condition (a `word` whose `statuses` map EVERY option to a press), for a minute (`lasts`).
  "Beguiling Twist": Object.freeze({ status: "frightened", onFail: true, lasts: Object.freeze({ rounds: 10, seconds: 60 }),
    word: Object.freeze({ ask: "Charmed or Frightened?", options: Object.freeze(["Charmed", "Frightened"]), presses: "Frightened", default: "Frightened",
      statuses: Object.freeze({ Charmed: "charmed", Frightened: "frightened" }) }),
    rule: Object.freeze({ item: "Beguiling Twist", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrBeguilingT" }) }),
  "Grease": Object.freeze({ status: "prone", onFail: true,
    rule: Object.freeze({ item: "Grease", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplGrease0000" }) }),
  "Sleet Storm": Object.freeze({ status: "prone", onFail: true,
    rule: Object.freeze({ item: "Sleet Storm", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSleetStorm" }) }),
  // No effect on the feat's saves: Poisoned is pressed here, ending with the Poisoner's next turn.
  "Poisoner": Object.freeze({ status: "poisoned", onFail: true, expiry: "sourceEnd",
    rule: Object.freeze({ item: "Poisoner", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPoisoner000", benefit: "Brew Poison" }) })
});

/** Evasion's shape, no choice (R1): a save against half-on-success takes none on a success and half on a
 * failure; not while Incapacitated. The verdict's multiplier does it. Keyed by the feature on the sheet;
 * `ability` narrows it (Evasion: Dexterity only) or null reaches every save (Avoidance, a monster's — the GM's side).
 * `onMiss` (a `side: "caster"` row): a missed attack with the caster's cantrip still deals that share — Graze's
 * shape (the miss still pays), rolled once the miss is final (auto-damage.js), landed by the applier. */
export const EVASIONS = Object.freeze({
  "Evasion": Object.freeze({ ability: "dex",
    rule: Object.freeze({ item: "Evasion", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkEvasion000" }),
    from: "Monk 7 / Rogue 7 / Ranger 15" }),
  "Avoidance": Object.freeze({ ability: null,
    rule: Object.freeze({ item: "Avoidance", uuid: "Compendium.dnd-monster-manual.features.Item.mmAvoidance00000" }),
    from: "monsters" }),
  // THE MIRROR ON THE CASTER (`side: "caster"`): keyed by the CASTER's feature, never the saver's. A successful
  // save against the caster's cantrip (`cantrip`) still takes `onSuccess` of the damage; a failure is unchanged.
  "Potent Cantrip": Object.freeze({ side: "caster", cantrip: true, onSuccess: 0.5, onMiss: 0.5, ability: null,
    rule: Object.freeze({ item: "Potent Cantrip", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwzdPotentCant" }),
    from: "Wizard — Evoker 3" })
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
 *   activity the option's own activity BY NAME (several options on one item: Open Hand Technique's three)
 *   label    the row's words when several options share a feature;  noDie  no die: the pool (or nothing) pays
 *   oncePerTurn  a per-OPTION turn chit (the rider chit, keyed by the option); greyed "used this turn"
 *   unarmed  an Unarmed Strike only;  weapons "monk"  a Monk weapon or an Unarmed Strike;  weapon  a weapon only
 *   only     "flurry" — an Unarmed Strike after Flurry of Blows THIS turn (its use writes a chit; out of combat
 *            every Unarmed Strike, the caveat said) | "own" — the attack is the feature's OWN activity
 *   ownType  the option's die keeps its own damage type (a shared-pool group's dice otherwise take the weapon's)
 *   dieFrom  the die is ANOTHER feature's damage activity (Improved Brutal Strike's blows ride Brutal Strike's die)
 *   requires { forgo } — the group opens only on a hit whose attack recorded that forgo (Brutal Strike, B3)
 * A group's `feature` is the paying feature (null: nothing to carry — Giant Ancestry); `pool` "feature"
 * (one shared pool) | "option" (each option's own uses) | "free" (nothing paid) | "pactSlot" (B4, Eldritch Smite: a
 * Pact Magic slot — `system.spells.pact`, every slot one level, so no picker; Q9's `poolOf` branch); `max` picks;
 * `ownDice` each option shows its own die beside the pool's one use (Monk's Focus); the rest are the card's words.
 *   pact     B4 — the attack's weapon must be the PACT WEAPON (lookup.js pactWeaponFits: bonded through Pact of the Blade;
 *            none bonded on the sheet, any weapon with the caveat)
 *   follow   B4 — a FOLLOW-UP after the option rides: another feature's save activity used at the hit target
 *            (`{ feature, activity }` — Telekinetic Adept's Telekinetic Thrust after Psionic Strike, Trip's path)
 *   also     B4 — ANOTHER feature's damage activity whose effects land with the option's ride (`{ feature, activity,
 *            clock }` — Physician's Touch's Poisoned on Hand of Harm), when that feature is on the sheet
 * Membership: the Hit Menu list (option names). Precision Attack and Riposte are folds.
 */
export const HIT_GROUPS = Object.freeze({
  "combat-superiority": Object.freeze({ feature: "Combat Superiority", pool: "feature", label: "Combat Superiority", max: 1,
    dieLabel: "Superiority Die", eyebrow: "Maneuver", heading: "Maneuvers", per: "one maneuver per attack", from: "Fighter — Battle Master 3",
    rule: Object.freeze({ item: "Combat Superiority", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrCombatSupe", benefit: "Maneuvers" }) }),
  // Hill's Tumble only (Fire and Frost are CLOCK_RIDERS); no feature: the text-only parent may be missing.
  "giant-ancestry": Object.freeze({ feature: null, pool: "option", label: "Giant Ancestry", max: 1,
    dieLabel: "use", eyebrow: "Giant Ancestry", heading: "Giant Ancestry", per: "one boon per hit", from: "Goliath",
    rule: Object.freeze({ item: "Goliath", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspGoliath0000", benefit: "Giant Ancestry" }) }),
  // A2: every option its own once-per-turn feature, so both may ride one hit (`max` 2).
  "monks-focus": Object.freeze({ feature: "Monk's Focus", pool: "feature", ownDice: true, label: "Monk's Focus", max: 2,
    dieLabel: "Focus Point", eyebrow: "Monk", heading: "Monk's Focus", per: "each once per turn", from: "Monk 2",
    rule: Object.freeze({ item: "Monk's Focus", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkMonksFocus" }) }),
  "open-hand-technique": Object.freeze({ feature: "Open Hand Technique", pool: "free", label: "Open Hand Technique", max: 1,
    dieLabel: "use", eyebrow: "Monk", heading: "Open Hand Technique", per: "one per Flurry of Blows hit", from: "Monk — Warrior of the Open Hand 3",
    rule: Object.freeze({ item: "Open Hand Technique", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkOpenHandTe" }) }),
  "elemental-attunement": Object.freeze({ feature: "Elemental Attunement", pool: "free", label: "Elemental Attunement", max: 1,
    dieLabel: "use", eyebrow: "Monk", heading: "Elemental Attunement", per: "on an Elemental Strike hit", from: "Monk — Warrior of the Elements 3",
    rule: Object.freeze({ item: "Elemental Attunement", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkElementalA" }) }),
  "psionic-power": Object.freeze({ feature: "Psionic Power", pool: "feature", ownDice: true, label: "Psionic Power", max: 1,
    dieLabel: "Psionic Energy Die", eyebrow: "Psi Warrior", heading: "Psionic Power", per: "once per turn", from: "Fighter — Psi Warrior 3",
    rule: Object.freeze({ item: "Psionic Power", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow" }) }),
  // B3 — Brutal Strike: FREE (the forgone Advantage paid for it — `requires.forgo` reads the attack's reminder record, the
  // group opens only on a hit whose attack forwent its Advantage); `ownDice`: every option rides the feature's own die
  // (`@scale.barbarian.brutal-strike`, the weapon's type), one effect per hit (`max` 1; level 17's two is D1's).
  "brutal-strike": Object.freeze({ feature: "Brutal Strike", pool: "free", ownDice: true, requires: Object.freeze({ forgo: "Brutal Strike" }),
    label: "Brutal Strike", max: 1, dieLabel: "die", eyebrow: "Barbarian", heading: "Brutal Strike", per: "one effect per hit — the forgone Advantage paid for it", from: "Barbarian 9",
    rule: Object.freeze({ item: "Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbBrutalStri" }) }),
  // B4 — Eldritch Smite: a Pact slot the cost (`pool: "pactSlot"`), the die the pack's Smite activity ((1 + pact level)d8 force).
  "eldritch-smite": Object.freeze({ feature: "Eldritch Smite", pool: "pactSlot", ownDice: true, label: "Eldritch Smite", max: 1,
    dieLabel: "Pact slot", eyebrow: "Warlock", heading: "Eldritch Smite", per: "once per turn, on a pact-weapon hit", from: "Eldritch Invocation (Warlock 5)",
    rule: Object.freeze({ item: "Eldritch Smite", uuid: "Compendium.dnd-players-handbook.classes.Item.phbinvEldritchSm" }) })
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
    rule: Object.freeze({ item: "Hill's Tumble", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptHillsTumbl" }) }),
  // A2 — the Monk. Stunning Strike's save activity is the cost (1 Focus Point); the save's success half is
  // SAVE_PRESSES' `success` (the pack marks Slowed failure-only).
  "stunning-strike": Object.freeze({ feature: "Stunning Strike", group: "monks-focus", save: true, noDie: true, oncePerTurn: true, weapons: "monk",
    rule: Object.freeze({ item: "Stunning Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkStunningSt" }) }),
  // B4 — Physician's Touch: its own Hand of Harm activity carries "Poisoned (Hand of Harm)"; it lands with the ride until the
  // end of the monk's next turn (the `vex` window) when the feature is on the sheet.
  "hand-of-harm": Object.freeze({ feature: "Hand of Harm", group: "monks-focus", oncePerTurn: true, unarmed: true, ownType: true,
    also: Object.freeze({ feature: "Physician's Touch", activity: "Hand of Harm", clock: "vex" }),
    rule: Object.freeze({ item: "Hand of Harm", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkHandOfHarm" }) }),
  "open-hand-addle": Object.freeze({ feature: "Open Hand Technique", group: "open-hand-technique", activity: "Addle", label: "Addle",
    effects: true, noDie: true, only: "flurry",
    rule: Object.freeze({ item: "Open Hand Technique", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkOpenHandTe", benefit: "Addle" }) }),
  "open-hand-push": Object.freeze({ feature: "Open Hand Technique", group: "open-hand-technique", activity: "Push", label: "Push",
    save: true, noDie: true, only: "flurry",
    line: "Played at the table: on a failed save, the target is pushed up to 15 feet away from you.",
    rule: Object.freeze({ item: "Open Hand Technique", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkOpenHandTe", benefit: "Push" }) }),
  "open-hand-topple": Object.freeze({ feature: "Open Hand Technique", group: "open-hand-technique", activity: "Topple", label: "Topple",
    save: true, noDie: true, only: "flurry",
    rule: Object.freeze({ item: "Open Hand Technique", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkOpenHandTe", benefit: "Topple" }) }),
  "elemental-attunement": Object.freeze({ feature: "Elemental Attunement", group: "elemental-attunement", activity: "Elemental Save",
    label: "Push or pull", save: true, noDie: true, only: "own",
    line: "Played at the table: on a failed save, the target is pushed or pulled up to 10 feet (move the token).",
    rule: Object.freeze({ item: "Elemental Attunement", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkElementalA" }) }),
  // A2 — the Psi Warrior: a Psionic Energy Die as Force, once per turn, on a weapon hit.
  // B4 — Telekinetic Adept's Telekinetic Thrust follows the Strike: the Strength save (Prone on a failure, the activity's own
  // effect); the 10-foot push is the table's.
  "psionic-strike": Object.freeze({ feature: "Psionic Power", group: "psionic-power", activity: "Psionic Strike", label: "Psionic Strike",
    oncePerTurn: true, weapon: true, ownType: true,
    follow: Object.freeze({ feature: "Telekinetic Adept", activity: "Telekinetic Thrust",
      line: "Played at the table: on a failed save you may instead push it up to 10 feet in a straight line (move the token)." }),
    rule: Object.freeze({ item: "Psionic Power", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow", benefit: "Psionic Strike" }) }),
  // B3 — the Brutal Strike effects. Forceful Blow is the table's (a line); Hamstring Blow lands the pack's Hamstrung (the
  // damage activity's effect); Improved's two ride the SAME die (`dieFrom` — their item carries utility activities alone):
  // Staggering Blow lands Staggered (EFFECT_BENDS reads it on the next save), Sundering Blow lands Sundered (+5 to the next
  // other creature's attack roll, EFFECT_BENDS `plus`). Each until the start of the barbarian's next turn (`clock: "slow"`).
  "forceful-blow": Object.freeze({ feature: "Brutal Strike", group: "brutal-strike", label: "Forceful Blow", weapon: true,
    line: "Played at the table: the target is pushed 15 feet straight away from you; you may then move up to half your Speed straight toward it without provoking Opportunity Attacks.",
    rule: Object.freeze({ item: "Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbBrutalStri", benefit: "Forceful Blow" }) }),
  "hamstring-blow": Object.freeze({ feature: "Brutal Strike", group: "brutal-strike", label: "Hamstring Blow", weapon: true, effects: true, clock: "slow",
    rule: Object.freeze({ item: "Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbBrutalStri", benefit: "Hamstring Blow" }) }),
  "staggering-blow": Object.freeze({ feature: "Improved Brutal Strike", group: "brutal-strike", activity: "Staggering Blow", label: "Staggering Blow",
    weapon: true, effects: true, clock: "slow", dieFrom: "Brutal Strike",
    line: "Played at the table: it can't make Opportunity Attacks until the start of your next turn.",
    rule: Object.freeze({ item: "Improved Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbImpBrutalS", benefit: "Staggering Blow" }) }),
  "sundering-blow": Object.freeze({ feature: "Improved Brutal Strike", group: "brutal-strike", activity: "Sundering Blow", label: "Sundering Blow",
    weapon: true, effects: true, clock: "slow", dieFrom: "Brutal Strike",
    rule: Object.freeze({ item: "Improved Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbImpBrutalS", benefit: "Sundering Blow" }) }),
  // B4 — Eldritch Smite: on a pact-weapon hit, once per turn, (1 + pact level)d8 force and Prone if Huge or smaller (a press,
  // no save); the Pact slot the cost. The pact weapon is the one bonded through Pact of the Blade (`pact`).
  "eldritch-smite": Object.freeze({ feature: "Eldritch Smite", group: "eldritch-smite", activity: "Smite", label: "Eldritch Smite",
    oncePerTurn: true, weapon: true, pact: "Pact of the Blade", ownType: true, press: "prone", maxSize: "huge",
    rule: Object.freeze({ item: "Eldritch Smite", uuid: "Compendium.dnd-players-handbook.classes.Item.phbinvEldritchSm" }) })
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
    rule: Object.freeze({ item: "Tactical Assessment", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvTacticalAs" }) }),
  "Commanding Presence": Object.freeze({ skills: Object.freeze(["itm", "prf", "per"]), initiative: false,
    rule: Object.freeze({ item: "Commanding Presence", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnvCommanding" }) })
});

/** B4 — a `tactical` fold that is NOT a maneuver: the feature's own uses through its activity, with the text's own
 * D20 Tests (`tests`) — the `tests` facet the plan held for its first customer. No refund clause (Tactical Mind's alone).
 *   activity  the activity BY NAME (its `roll` the die);  weapon  the attack's item must be this (a name prefix — Homing
 *             Strikes on the Psychic Blades only);  tests  which D20 Tests, "attack" offered on a MISS (Precision's window) */
export const TACTICAL_FOLDS = Object.freeze({
  "Dark One's Own Luck": Object.freeze({ tests: Object.freeze(["check", "save"]), activity: "Luck",
    rule: Object.freeze({ item: "Dark One's Own Luck", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkDarkOnesOw" }),
    from: "Warlock — Fiend Patron 6" }),
  "Soul Blades": Object.freeze({ tests: Object.freeze(["attack"]), activity: "Homing Strikes", weapon: "Psychic Blade",
    rule: Object.freeze({ item: "Soul Blades", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeSoulBlades", benefit: "Homing Strikes" }),
    from: "Rogue — Soulknife 9" })
});

/** B3 — a die that STANDS IN for a Superiority Die (Relentless): with none of `pool` left, once per turn, `die` rides in the
 * die's place and nothing is spent (lookup.js `superiorityStandIn`, the hit menu's rider). Offered only at an EMPTY pool
 * (RULINGS *The PHB classes — B3*): with dice left the module spends one. */
export const SUPERIORITY_STAND_INS = Object.freeze({
  "Relentless": Object.freeze({ die: "1d8", pool: "Combat Superiority",
    rule: Object.freeze({ item: "Relentless", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrRelentless" }),
    from: "Fighter — Battle Master 15" })
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
 *              (the system's template adopted, attached to the caster, ending with it) | "area" (the spells
 *              slice: the system's template adopted where it was PLACED, attached to nothing;
 *              the caster drags it, the platform raises enter for whoever it now covers; ends with the
 *              concentration). An `area` row's activity may be plain DAMAGE (Cloud of Daggers): no save,
 *              the trigger rolls it on the caster and applies it, receipted
 *   reach      "helpful" (allies and neutrals) | "harmful" (enemies) | "all"
 *   range      null: the activity's size · a formula read off the SOURCE's roll data — ⚠ never a number for
 *              a class-scaled feature (N1) · "weaponReach": the held weapon's (10 with Reach, else 5)
 *   effect     the pack's effect by name, its changes RESOLVED against the source (else each member adds
 *              its own Charisma); null: a ring and a card only
 *   trigger    a save demanded `on` "enter", "turnEnd" and/or "turnStart" (a monster's aura: "any creature
 *              that starts its turn in"), `oncePerTurn`; the activity's save judges; `types` narrows who is
 *              asked to those creature types (Vile Appearance's Beasts and Humanoids). A row with no standing
 *              `effect` lets the verdict land the activity's own failure effect (Frightened, Poisoned).
 *              `on: "move"` (Spike Growth): the activity's plain damage per `per` feet a creature MOVES
 *              inside the area, paid once per movement when the move lands — never a pause (DESIGN §8)
 *   band       an `area` whose burning side is `feet` wide on ONE side of the wall it was placed as (Wall of
 *              Fire): the region is widened by the band on the side away from the caster, and the cast's
 *              card offers the other side (`ask`); a ring burns outside by default, inside on the ask
 *   ask        an `area` cast asks the caster to pick from `options` (Magic Circle's creature types) on the
 *              cast's card — every option on by default, toggled there; the picks live on the region
 *   gate       the attack gate reads the area: a creature of a chosen type (`types: "chosen"`) attacking a
 *              target INSIDE it rolls at `attacker` (Magic Circle's Disadvantage; reminders.js)
 *   noCastSave the cast's own save activity demands nothing at the placement (Magic Circle's Charisma save
 *              is for a teleport in, never for standing inside)
 *   heal       a heal paid `on` "turnStart" `when` "zeroHP" from `activity`
 *   remind     a notice at the source's turn start naming an AIMED heal — offered, never played (R1)
 *   holding    the ring stands only while a qualifying weapon is held (`base`, or every `properties`)
 *   alert      a reminder to the source when a reached creature itself MOVES INTO the ring (tokenMoveIn),
 *              or `on: "moveOut"` OUT of it, or `on: "turnStart"` STARTS ITS TURN inside it (Unnerving Gaze);
 *              `kind: "notice"` a plain card with `says` (no Reaction, no
 *              button — Magic Circle's entry ban, Forcecage's exit ban); `types: "chosen"` only the asked types.
 *              A monster's Reaction (Pursuit, Shriek, Watery Rebuke): the response is the activity's, from the sheet
 *   incapacitated  inactive while the source is Incapacitated;  quiet  no card
 *   item / activity / while / pulse   see the Inner Radiance row (`while` may list several — every one must
 *              stand: the Wolf's "Rage of the Wolf" AND the Rage); a `pulse` with `activity: null` rolls the
 *              item's first damage activity at the bearer's turn END (the fire auras — the GM's side)
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
  // The Wolf (the pick at the Rage, EFFECT_CHOICES): the pack's own "Rage of the Wolf" worn by the enemies within 5 ft;
  // EFFECT_BENDS reads the member copies alone (`member`), for everyone but the barbarian (`except: "source"`).
  "Rage of the Wolf": Object.freeze({ kind: "feature", item: "Rage of the Wilds", while: Object.freeze(["Rage of the Wolf", "Rage"]),
    reach: "harmful", range: 5, effect: "Rage of the Wolf", incapacitated: false, quiet: true,
    rule: Object.freeze({ item: "Rage of the Wilds", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbRageOfTheW", benefit: "Wolf" }),
    from: "Barbarian — Path of the Wild Heart 3" }),
  // An invisible ring at the held weapon's reach; a hostile moving in raises the reminder (attack from the sheet).
  "Polearm Master": Object.freeze({ kind: "feature", reach: "harmful", range: "weaponReach", effect: null, incapacitated: true, quiet: true,
    holding: Object.freeze({ base: Object.freeze(["quarterstaff", "spear"]), properties: Object.freeze(["hvy", "rch"]) }),
    alert: Object.freeze({ on: "moveIn", label: "Reactive Strike",
      swing: "Take your <strong>Reaction</strong> to make one melee attack at it, from the sheet." }),
    rule: Object.freeze({ item: "Polearm Master", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftPolearmMast", benefit: "Reactive Strike" }),
    from: "General feat" }),
  // THE AREAS THAT PULSE (the spells slice, Tier 3; RULINGS *The spells slice — Tier 3*): the
  // 2024 text of each is "enters the area or ends its turn there", "when the area moves into its space",
  // "only once per turn" — Spirit Guardians' trigger to the word. Reach "all": every creature, the caster too.
  "Moonbeam": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    caveat: "the Magic action that moves the beam is the caster's drag of the template; a shape-shifter's reversion is the table's",
    rule: Object.freeze({ item: "Moonbeam", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplMoonbeam00" }),
    from: "Druid spell, level 2 (Concentration, 1 minute)" }),
  "Insect Plague": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    caveat: "Lightly Obscured and Difficult Terrain are the table's",
    rule: Object.freeze({ item: "Insect Plague", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplInsectPlag" }),
    from: "Cleric / Druid / Sorcerer spell, level 5 (Concentration, 10 minutes)" }),
  "Cloudkill": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    caveat: "the fog's own drift (10 feet away from you at the start of each of your turns) is the caster's drag; Heavily Obscured is the table's",
    rule: Object.freeze({ item: "Cloudkill", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCloudkill0" }),
    from: "Sorcerer / Wizard spell, level 5 (Concentration, 10 minutes)" }),
  // No save: the pack's activity is plain damage, rolled on the caster and applied at each trigger (ruled automatic, R1).
  "Cloud of Daggers": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    caveat: "the Magic action that teleports the Cube is the caster's drag of the template",
    rule: Object.freeze({ item: "Cloud of Daggers", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplCloudofDag" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 2 (Concentration, 1 minute)" }),
  // A SUMMON: the sphere is a token of the pack's own actor, and "within 5 feet of the sphere" is a feature
  // ring around it — today's kind. Its `Flames` carries the save (the summon matches the caster's DC).
  "Flaming Sphere": Object.freeze({ kind: "feature", item: "Flames", reach: "all", range: 5, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    caveat: "the Bonus Action that rolls the sphere is its token's move; a creature it is rolled into is entered",
    rule: Object.freeze({ item: "Flaming Sphere", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFlamingSph" }),
    from: "Druid / Sorcerer / Wizard spell, level 2 (Concentration, 1 minute)" }),
  // THE HELD SPELLS (RULINGS *The spells slice — the held spells*). The wall's one burning side is a BAND
  // the region is widened by; the cast's own save (everyone in the wall as it appears) is the pack's.
  "Wall of Fire": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["enter", "turnEnd"]), oncePerTurn: true }),
    band: Object.freeze({ feet: 10, ask: "Which side of the wall burns?" }),
    caveat: "the wall is opaque and 20 feet high — the table's; the burning side is the region as widened, flip it on the cast's card",
    rule: Object.freeze({ item: "Wall of Fire", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplWallofFire" }),
    from: "Druid / Sorcerer / Wizard spell, level 4 (Concentration, 1 minute)" }),
  // Damage per 5 feet MOVED inside the area, paid when the move lands (DESIGN §4's second exception).
  "Spike Growth": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["move"]), per: 5 }),
    caveat: "Difficult Terrain, and the Wisdom (Perception or Survival) check to see the spikes, are the table's",
    rule: Object.freeze({ item: "Spike Growth", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplSpikeGrowt" }),
    from: "Druid / Ranger spell, level 2 (Concentration, 10 minutes)" }),
  // The circle stands its hour where placed (no concentration: the GM deletes the region when the hour is up).
  "Magic Circle": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false, noCastSave: true,
    ask: Object.freeze({ what: "types", label: "Which creature types does the circle ward against?",
      options: Object.freeze(["celestial", "elemental", "fey", "fiend", "undead"]) }),
    gate: Object.freeze({ attacker: "disadvantage", types: "chosen" }),
    alert: Object.freeze({ on: "moveIn", kind: "notice", label: "Magic Circle", types: "chosen",
      says: "cannot willingly enter the circle by nonmagical means — a teleport in needs a Charisma save (the spell's own)" }),
    caveat: "possession, and Charmed or Frightened from a warded type, are the table's; the circle stands its hour until the region is deleted; the reversed circle (kept in) is the table's",
    rule: Object.freeze({ item: "Magic Circle", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplMagicCircl" }),
    from: "Cleric / Paladin / Warlock / Wizard spell, level 3 (1 hour)" }),
  "Forcecage": Object.freeze({ kind: "area", reach: "all", range: null, effect: null, incapacitated: false,
    alert: Object.freeze({ on: "moveOut", kind: "notice", label: "Forcecage",
      says: "leaves the cage — the walls hold it; a teleport out needs a Charisma save (the spell's own), and a failure wastes the action" }),
    caveat: "the bars' cover, spells cast through the bars, and the solid box blocking spells are the table's; the cage stands its hour with the concentration",
    rule: Object.freeze({ item: "Forcecage", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplForcecage0" }),
    from: "Bard / Warlock / Wizard spell, level 7 (Concentration, 1 hour)" }),
  // THE GM'S SIDE — a monster's aura, "any creature that starts its turn in the Emanation" (RULINGS *The GM's
  // side — the aura rows*): the pack's save activity carries the Emanation and the failure's condition; nothing
  // stands on a member (`effect: null`), the verdict lands the failure. A success's "immune for 24 hours / 1
  // hour" is the table's. `incapacitated` where the text says so.
  "Fear Aura": Object.freeze({ kind: "feature", reach: "harmful", range: null, effect: null, incapacitated: true,
    trigger: Object.freeze({ on: Object.freeze(["turnStart"]), oncePerTurn: true }),
    caveat: "a success's 24-hour immunity to this aura is the table's",
    rule: Object.freeze({ item: "Fear Aura", uuid: "Compendium.dnd-monster-manual.features.Item.mmFearAura000000" }),
    from: "monsters" }),
  "Fetid Aura": Object.freeze({ kind: "feature", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["turnStart"]), oncePerTurn: true }),
    caveat: "\"an action or a Bonus Action, not both\" while Poisoned is the table's",
    rule: Object.freeze({ item: "Fetid Aura", uuid: "Compendium.dnd-monster-manual.features.Item.mmFetidAura00000" }),
    from: "monsters (swarms)" }),
  "Stench": Object.freeze({ kind: "feature", reach: "all", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["turnStart"]), oncePerTurn: true }),
    caveat: "\"other than a troglodyte\", and a success's 1-hour immunity to every troglodyte's Stench, are the table's",
    rule: Object.freeze({ item: "Stench", uuid: "Compendium.dnd-monster-manual.features.Item.mmStench00000000" }),
    from: "monsters (troglodytes)" }),
  // No Emanation on the activity — "within 30 feet" is its range; only Beasts and Humanoids are asked.
  "Vile Appearance": Object.freeze({ kind: "feature", reach: "all", range: 30, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["turnStart"]), oncePerTurn: true, types: Object.freeze(["beast", "humanoid"]) }),
    caveat: "\"can see its true form\" and a success's 24-hour immunity are the table's",
    rule: Object.freeze({ item: "Vile Appearance", uuid: "Compendium.dnd-monster-manual.features.Item.mmVileAppearance" }),
    from: "monsters (hags)" }),
  // "Initial Save" carries the Emanation; the failure's pick (Captivated, Fearful, Mired) is the GM's from the sheet.
  "Lordly Presence": Object.freeze({ kind: "feature", activity: "Initial Save", reach: "harmful", range: null, effect: null, incapacitated: false,
    trigger: Object.freeze({ on: Object.freeze(["turnStart"]), oncePerTurn: true }),
    caveat: "the failure's pick — Captivated, Fearful or Mired — is used from the sheet; a success's 24-hour immunity is the table's",
    rule: Object.freeze({ item: "Lordly Presence", uuid: "Compendium.dnd-monster-manual.features.Item.mmLordlyPresence" }),
    from: "monsters" }),
  // A ring and a card: the pack's utility activity carries the Emanation and no effect.
  "Aura of Authority": Object.freeze({ kind: "feature", activity: "Expend Use", reach: "helpful", range: null, effect: null, incapacitated: true,
    caveat: "the Advantage on attack rolls and saving throws of the bearer and its allies inside is the table's",
    rule: Object.freeze({ item: "Aura of Authority", uuid: "Compendium.dnd-monster-manual.features.Item.mmAuraOfAuthorit" }),
    from: "monsters" }),
  // THE GM'S SIDE, the waiting rows (RULINGS *The Monster Manual — the waiting rows built*). The bearer's turn-end
  // pulse (Inner Radiance's shape): "at the end of each of its turns, each creature in the Emanation takes…" — the
  // damage activity carries the Emanation, rolled once on the bearer, landed on everyone inside.
  "Fire Aura": Object.freeze({ kind: "feature", reach: "harmful", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: null }),
    caveat: "\"of the bearer's choice\" reads as its enemies; a friend inside is spared — the table's",
    rule: Object.freeze({ item: "Fire Aura", uuid: "Compendium.dnd-monster-manual.features.Item.mmFireAura000000" }),
    from: "monsters" }),
  "Flame Aura": Object.freeze({ kind: "feature", reach: "all", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: null }),
    rule: Object.freeze({ item: "Flame Aura", uuid: "Compendium.dnd-monster-manual.features.Item.mmFlameAura00000" }),
    from: "monsters" }),
  "Heat Aura": Object.freeze({ kind: "feature", reach: "all", range: null, effect: null, incapacitated: false,
    pulse: Object.freeze({ on: "sourceTurnEnd", activity: null }),
    caveat: "\"each creature that isn't an azer\" — a kin inside is spared, the table's",
    rule: Object.freeze({ item: "Heat Aura", uuid: "Compendium.dnd-monster-manual.features.Item.mmHeatAura000000" }),
    from: "monsters (azers)" }),
  // The turn-start ring (Stench's shape): the save demanded of a creature starting its turn inside; the d8 the GM's.
  "Gibbering": Object.freeze({ kind: "feature", reach: "all", range: null, effect: null, incapacitated: true,
    trigger: Object.freeze({ on: Object.freeze(["turnStart"]), oncePerTurn: true }),
    caveat: "the failure's d8 — what the target does this turn — is the GM's from the sheet",
    rule: Object.freeze({ item: "Gibbering", uuid: "Compendium.dnd-monster-manual.features.Item.mmGibbering00000" }),
    from: "monsters (gibbering mouther)" }),
  // The alerts (Polearm Master's shape): an invisible ring at the trigger's range; a creature moving in — or
  // starting its turn inside — raises the reminder; the Reaction's response is the activity's, from the sheet.
  "Pursuit": Object.freeze({ kind: "feature", reach: "harmful", range: 120, effect: null, incapacitated: true, quiet: true,
    alert: Object.freeze({ on: "moveIn", label: "Pursuit", swing: "Take your <strong>Reaction</strong> to use Pursuit — Teleport to a space near it, from the sheet." }),
    caveat: "\"ends its move within 120 feet\" — a creature passing through is alerted too; whether its move ended is the GM's",
    rule: Object.freeze({ item: "Pursuit", uuid: "Compendium.dnd-monster-manual.features.Item.mmPursuit0000000" }),
    from: "monsters" }),
  "Shriek": Object.freeze({ kind: "feature", reach: "all", range: 30, effect: null, incapacitated: true, quiet: true,
    alert: Object.freeze({ on: "moveIn", label: "Shriek", swing: "Take your <strong>Reaction</strong> to use Shriek, from the sheet." }),
    caveat: "a source of Bright Light moving in is the table's (a token is a creature)",
    rule: Object.freeze({ item: "Shriek", uuid: "Compendium.dnd-monster-manual.features.Item.mmShriek00000000" }),
    from: "monsters (shriekers)" }),
  "Watery Rebuke": Object.freeze({ kind: "feature", reach: "harmful", range: 5, effect: null, incapacitated: true, quiet: true,
    alert: Object.freeze({ on: "moveIn", label: "Watery Rebuke", swing: "Take your <strong>Reaction</strong> to use Watery Rebuke at it — a Strength save, the cold and the push, from the sheet." }),
    rule: Object.freeze({ item: "Watery Rebuke", uuid: "Compendium.dnd-monster-manual.features.Item.mmWateryRebuke00" }),
    from: "monsters (marids)" }),
  "Unnerving Gaze": Object.freeze({ kind: "feature", reach: "harmful", range: 30, effect: null, incapacitated: true, quiet: true,
    alert: Object.freeze({ on: "turnStart", label: "Unnerving Gaze", swing: "Take your <strong>Reaction</strong> to use Unnerving Gaze at it — a Wisdom save, from the sheet." }),
    caveat: "\"can see the bearer\" and a success's 24-hour immunity are the table's",
    rule: Object.freeze({ item: "Unnerving Gaze", uuid: "Compendium.dnd-monster-manual.features.Item.mmUnnervingGaze0" }),
    from: "monsters" }),
  // THE PHB CLASSES — B5 (RULINGS *The PHB classes — B5*): the band-B emanation rows on the shapes above.
  // Unnerving Gaze's alert, standing only while the Rage does (the Wolf's `while`): a hostile STARTING its turn
  // within 30 ft raises the reminder; the Reaction's Strength save, its Speed 0 and the teleport are the
  // activity's, from the sheet. "A creature you can see" is not judged (the bends register).
  "Branches of the Tree": Object.freeze({ kind: "feature", reach: "harmful", range: 30, effect: null, incapacitated: true, quiet: true,
    while: "Rage",
    alert: Object.freeze({ on: "turnStart", label: "Branches of the Tree",
      swing: "Take your <strong>Reaction</strong> to use Branches of the Tree at it — a Strength save, its Speed 0 and the teleport, from the sheet." }),
    caveat: "\"a creature you can see\" is the table's",
    rule: Object.freeze({ item: "Branches of the Tree", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbBranchesOf" }),
    from: "Barbarian — Path of the World Tree 6" }),
  // Reactive Strike's alert at 5 ft with `on: "turnEnd"` (new): an ENEMY ending its turn beside the bard raises the
  // reminder; the Reaction's Move (a use of Bardic Inspiration) and the ally's move are the players', from the sheet.
  "Inspiring Movement": Object.freeze({ kind: "feature", reach: "harmful", range: 5, effect: null, incapacitated: true, quiet: true,
    alert: Object.freeze({ on: "turnEnd", label: "Inspiring Movement",
      swing: "Take your <strong>Reaction</strong> and a use of Bardic Inspiration: you move up to half your Speed, then one ally within 30 ft may too — no Opportunity Attacks; the Move, from the sheet." }),
    caveat: "\"an enemy you can see\" is the table's",
    rule: Object.freeze({ item: "Inspiring Movement", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdInspiringM" }),
    from: "Bard — College of Dance 6" }),
  // Inner Radiance's shape (a ring while the use's effect stands) with a PICK instead of a pulse: once on each of the
  // druid's turns ONE creature inside is chosen — the card at the turn start lists who stands inside, the pick demands
  // the activity's Constitution save (the cold rolled on a failure). The push is a line on the verdict, the token the table's.
  "Wrath of the Sea": Object.freeze({ kind: "feature", reach: "all", range: "@scale.sea.wrath-range", effect: null, incapacitated: true,
    while: "Manifesting Ocean Spray",
    pick: Object.freeze({ on: "sourceTurnStart", activity: "Bonus Action Save", says: "pushed up to 15 feet away from you if Large or smaller — move the token" }),
    caveat: "\"a creature you can see\" is the table's; the push is the table's move of the token",
    rule: Object.freeze({ item: "Wrath of the Sea", uuid: "Compendium.dnd-players-handbook.classes.Item.phbdrdWrathOfThe" }),
    from: "Druid — Circle of the Sea 3" }),
  // Aura of Courage's row, the condition swapped: the pack's "Devoted" carries no change either.
  "Aura of Devotion": Object.freeze({ kind: "feature", reach: "helpful", range: "@scale.paladin.aura", effect: "Devoted", incapacitated: true,
    caveat: "the pack's effect carries no change — add Immunity to Charmed to it at the world",
    rule: Object.freeze({ item: "Aura of Devotion", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnDevotionAu" }),
    from: "Paladin — Oath of Devotion 7" })
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
  // THE GM'S SIDE (RULINGS *The Monster Manual — the waiting rows built*): the DEFENDER's own trait, no effect to
  // find (`match: "feature"`): its first damage activity strikes the melee attacker; `range` where the activity carries none.
  "Corrosive Form": Object.freeze({ match: "feature", activity: null, melee: true, range: 5,
    caveat: "the ammunition destroyed and the weapon's cumulative −1 are the table's (the pack ships that penalty as an effect to drag onto the weapon)",
    rule: Object.freeze({ item: "Corrosive Form", uuid: "Compendium.dnd-monster-manual.features.Item.mmCorrosiveForm0" }),
    from: "monsters (black puddings)" }),
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
 * pick lands. `effects` the names in order; `ask` the question. Fewer than two present asks nothing.
 *   picks     the choices, when they are NOT all effects (a form's constellations): `lands` maps a pick to the
 *             cast's own effects that land only with it; every other effect lands whatever the pick
 *   activity  only this activity's use asks (Starry Form's "Consume Wild Shape", not its Dragon use)
 *   chip      the pick is kept as a form chip on the caster (`formChip`) for the rows that read it (Chalice)
 *   on        the item whose USE asks; the row is keyed by the FEATURE the bearer must hold (Rage of the Wilds
 *             at the Rage): the trigger's own effects land at once, never waiting; `use` — the pick uses the
 *             feature's activity of that name, whose own card lands its own effect (Bear, Wolf) */
export const EFFECT_CHOICES = Object.freeze({
  "Fire Shield": Object.freeze({ effects: Object.freeze(["Warm Shield", "Chill Shield"]), ask: "A warm shield or a chill shield?",
    rule: Object.freeze({ item: "Fire Shield", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFireShield" }),
    from: "PHB, level 4 (10 minutes)" }),
  // The pack lands Starry Form AND Dragon Form on every use: Dragon Form only with its pick.
  "Starry Form": Object.freeze({ picks: Object.freeze(["Archer", "Chalice", "Dragon"]), activity: "Consume Wild Shape",
    lands: Object.freeze({ Dragon: Object.freeze(["Dragon Form", "Dragon Form (Twinkling)"]) }), chip: true,
    ask: "Which constellation glimmers on you?",
    rule: Object.freeze({ item: "Starry Form", uuid: "Compendium.dnd-players-handbook.classes.Item.phbdrdStarryForm" }),
    from: "Druid — Circle of the Stars 3 (10 minutes)" }),
  "Rage of the Wilds": Object.freeze({ on: "Rage", picks: Object.freeze(["Bear", "Eagle", "Wolf"]), use: true,
    ask: "Rage of the Wilds — Bear, Eagle or Wolf?",
    rule: Object.freeze({ item: "Rage of the Wilds", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbRageOfTheW" }),
    from: "Barbarian — Path of the Wild Heart 3" })
});


/**
 * A use whose text SHEDS LIGHT, carried as a `token.light` change on an effect (Foundry applies `token.*`
 * changes to the bearer's tokens), so the light follows the effect's clock and no token is written.
 * ⚠ A Foundry light's `dim` is the OUTER radius: dim = bright + "an additional".
 *   on        "self" | "targets" (every creature targeted at the use; none → the pack's use stands)
 *   item / activity   the pack item and activity whose use lands it (activity null: any use)
 *   effect    the pack effect the light rides, landed WITH it; null: the module's own, named as the item
 *   recast    "ends" — casting it again ends the caster's earlier light
 *   ends      "enchantment" — the light goes out with the ENCHANTMENT the use put on a weapon (the item's own
 *             effect of the row's `item` name, deleted from the weapon); `clock` its duration off that effect
 */
export const TOKEN_LIGHTS = Object.freeze({
  "Inner Radiance": Object.freeze({ item: "Celestial Revelation", activity: "Inner Radiance", on: "self", effect: "Searing Radiance", bright: 10, dim: 20,
    rule: Object.freeze({ item: "Celestial Revelation", uuid: "Compendium.dnd-players-handbook.origins.Item.phbsptCelestialR", benefit: "Inner Radiance" }),
    from: "Aasimar — Celestial Revelation (character level 3)" }),
  "Light": Object.freeze({ activity: null, on: "targets", effect: null, recast: "ends", bright: 20, dim: 40,
    caveat: "on a creature's token (user, 2026-09-25: any targeted token) — the rule's object is the table's to name",
    rule: Object.freeze({ item: "Light", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplLight00000" }),
    from: "PHB cantrip (1 hour)" }),
  // The +Cha and the Radiant are the pack's Enchant (NATIVE); the weapon's light rides the paladin's token.
  "Sacred Weapon": Object.freeze({ activity: null, on: "self", effect: null, bright: 20, dim: 40, ends: "enchantment",
    caveat: "the light is the paladin's token's — the weapon is in hand",
    rule: Object.freeze({ item: "Sacred Weapon", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnSacredWeap" }),
    from: "Paladin — Oath of Devotion 3 (10 minutes)" })
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
 *   block    true — the rest GRANTS NOTHING while the rester wears `effect` from this item (the GM's side:
 *            Cursed Touch's "no benefit from finishing a Short or Long Rest"): the rest's own update and its
 *            item updates are emptied before they land, the card says so
 */
export const REST_GRANTS = Object.freeze({
  // The curse on a rest (RULINGS *The Monster Manual — the waiting rows built*): the pack's Cursed effect, its origin the touch.
  "Cursed Touch": Object.freeze({ rests: Object.freeze(["short", "long"]), block: true, effect: "Cursed",
    caveat: "the curse's end is the table's — delete Cursed",
    rule: Object.freeze({ item: "Cursed Touch", uuid: "Compendium.dnd-monster-manual.features.Item.mmCursedTouch000" }),
    from: "monsters" }),
  "Restless Touch": Object.freeze({ rests: Object.freeze(["short"]), block: true, effect: "Cursed",
    caveat: "24 hours or the bearer's death end it — the table's; delete Cursed",
    rule: Object.freeze({ item: "Restless Touch", uuid: "Compendium.dnd-monster-manual.features.Item.mmRestlessTouch0" }),
    from: "monsters" }),
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
 * What turns a drop to 0 HP into 1 (drop-to-one.js: the 1 written in the damage's own update) — and what a
 * landed 0 raises (the death's side).
 *   ask       "you can" — held at 1 and the owner asked; false — it simply happens and a card says so
 *   uses      the item's own uses pay;  effect  the effect whose presence is the row, removed when it fires
 *   ends      the spell ends when it fires;  outright  it also stands against damage that kills outright
 *   save      the DICE decide (R1, Undead Fortitude): held at 1 while the bearer's save rolls on the keeper —
 *             `ability`, `dc` ("5 + damage"), `unless` (damage types and/or "crit" read off the damage card;
 *             ⚠ a card the module cannot read counts the row — never a guessed exemption); a failure lands the 0
 *   on        "died" — THE DEATH'S SIDE (Death Throes): the row fires when the damage leaves the bearer at 0
 *             and nothing held it; `activity` (null: the first save) is used AT THE CORPSE against every
 *             creature within the activity's Emanation, one demand card, the saves machine from there
 *   notice    a `died` row with no activity to use — the card's words for the GM's move (Misty Escape: the mist)
 *   named     B4 (Gift of the Protectors): the feature is ANOTHER creature's — the warlock's, whose copy's description
 *             names the dropped creature (the tome's page, read as data); `activity` the one whose own uses pay (Protect,
 *             once per Long Rest); it simply happens (`ask: false`), the card names the keeper
 * The GM's side, the waiting rows: RULINGS *The Monster Manual — the waiting rows built*.
 */
export const DROP_TO_ONE = Object.freeze({
  "Death Ward": Object.freeze({ ask: false, effect: "Protection from Death", ends: true, outright: true,
    rule: Object.freeze({ item: "Death Ward", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDeathWard0" }),
    from: "PHB, level 4 (8 hours)" }),
  "Gift of the Protectors": Object.freeze({ ask: false, named: true, activity: "Protect", outright: false,
    caveat: "the names on the page are the feature's description on the warlock's sheet — write them there",
    rule: Object.freeze({ item: "Gift of the Protectors", uuid: "Compendium.dnd-players-handbook.classes.Item.phbinvGiftoftheP" }),
    from: "Eldritch Invocation (Warlock 9)" }),
  "Relentless Endurance": Object.freeze({ ask: true, uses: true, outright: false,
    rule: Object.freeze({ item: "Orc", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspOrc00000000", benefit: "Relentless Endurance" }),
    from: "Orc" }),
  // The kill moment's two sides, the GM's (RULINGS *The GM's side — the five shapes*). Text-only in the pack: the machine rolls.
  "Undead Fortitude": Object.freeze({ ask: false, outright: false,
    save: Object.freeze({ ability: "con", dc: "5 + damage", unless: Object.freeze(["radiant", "crit"]) }),
    rule: Object.freeze({ item: "Undead Fortitude", uuid: "Compendium.dnd-monster-manual.features.Item.mmUndeadFortitud" }),
    from: "monsters (zombies)" }),
  "Death Throes": Object.freeze({ on: "died", activity: null,
    caveat: "\"revives somewhere in the Abyss\" is the table's",
    rule: Object.freeze({ item: "Death Throes", uuid: "Compendium.dnd-monster-manual.features.Item.mmDeathThroes000" }),
    from: "monsters (the balor)" }),
  // The vampire's drop: held at 1 and gone (Death Ward's shape, no effect), or the death's side said on a card.
  "Spiteful Escape": Object.freeze({ ask: false, outright: true,
    caveat: "dying within 30 feet of its anathema, the teleport to its demiplane, the 2d6 days and the curse on every creature within 60 feet are the table's",
    rule: Object.freeze({ item: "Spiteful Escape", uuid: "Compendium.dnd-monster-manual.features.Item.mmSpitefulEscape" }),
    from: "monsters" }),
  "Misty Escape": Object.freeze({ on: "died", notice: "it becomes mist — Shape-Shift, no action — and must reach its resting place within 2 hours or be destroyed; there it is Paralyzed until it regains a Hit Point",
    caveat: "outside its resting place; the mist form and the Paralyzed are the sheet's",
    rule: Object.freeze({ item: "Misty Escape", uuid: "Compendium.dnd-monster-manual.features.Item.mmMistyEscape000" }),
    from: "monsters (vampires)" }),
  "Shadow Escape": Object.freeze({ on: "died", notice: "it teleports into its resting place unless it is in running water or sunlight; there it is Paralyzed for 1 hour, then regains 1 Hit Point",
    caveat: "outside its resting place; the teleport and the Paralyzed are the sheet's",
    rule: Object.freeze({ item: "Shadow Escape", uuid: "Compendium.dnd-monster-manual.features.Item.mmShadowEscape00" }),
    from: "monsters (vampires)" })
});


/**
 * A Reaction after the bearer takes damage, aimed at the damager (rebukes.js): a popup to the owner when
 * the damager stands in reach — Riposte's shape, on damage. The reach is the reaction activity's (N1).
 *   activity  the reaction activity (null: the first);  range  feet, where the activity carries none
 *   attack    "melee" — the answer is one melee attack with a weapon the bearer picks
 *   while     an effect that must stand on the bearer;  equipped  the item must be equipped
 *   ward      a BYSTANDER within `range` of a damager who hit someone else is asked;  hit  attack damage only
 *   opportunity  the answer is an Opportunity Attack (CLOCK_RIDERS "sentinel-halt" reads it)
 *   on        "miss" (Sticky Shield) — a MELEE WEAPON attack that MISSED the bearer, stamped by the elect off the
 *             attack card; the answer is the activity used at the attacker
 *   types     the damage's types the row answers to (Elemental Absorption); a damage card the module cannot
 *             read counts the row — never a guessed exemption
 *   self      the answer is aimed at nobody (a heal on self, a cloud) — no reach is measured
 *   follow    B4 — activities of the feature OFFERED on the card once the answer is driven (Misty Escape's Disappearing
 *             Step or Dreadful Step after the teleport), each a button, the pick the player's
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
    rule: Object.freeze({ item: "Sentinel", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftSentinel000", benefit: "Guardian" }) }),
  // THE GM'S SIDE (RULINGS *The GM's side — the reaction rows*). A hit's save at the attacker: the damage has
  // landed by the time the rebuke asks (`dnd5e.applyDamage`); "the attack misses instead" is the table's.
  "Warding Charm": Object.freeze({ activity: "Save", hit: true, from: "monsters",
    caveat: "\"the attack roll misses\" on a failure is the table's — the damage has landed; Charmed is the pack's effect",
    rule: Object.freeze({ item: "Warding Charm", uuid: "Compendium.dnd-monster-manual.features.Item.mmWardingCharm00" }) }),
  "Jinx": Object.freeze({ activity: "Save", hit: true, from: "monsters (goblins)",
    caveat: "\"the attack misses instead\" on a failure is the table's — the damage has landed",
    rule: Object.freeze({ item: "Jinx", uuid: "Compendium.dnd-monster-manual.features.Item.mmJinx0000000000" }) }),
  "Sticky Shield": Object.freeze({ activity: "Save", on: "miss", from: "monsters (kuo-toa)",
    caveat: "the stuck weapon's Free Weapon Check and Escape Check are the sheet's",
    rule: Object.freeze({ item: "Sticky Shield", uuid: "Compendium.dnd-monster-manual.features.Item.mmStickyShield00" }) }),
  // The waiting rows (RULINGS *The Monster Manual — the waiting rows built*): the reaction's save in an Emanation
  // — the template placed from the card names the creatures of its choice.
  "Fiendish Blood": Object.freeze({ activity: "Save", self: true, from: "monsters",
    types: Object.freeze(["piercing", "slashing"]),
    caveat: "the Emanation's creatures of its choice are the template's, placed from the card; what a Fiend senses of the cursed is the table's",
    rule: Object.freeze({ item: "Fiendish Blood", uuid: "Compendium.dnd-monster-manual.features.Item.mmFiendishBlood0" }) }),
  "Elemental Absorption": Object.freeze({ activity: null, self: true, from: "monsters",
    types: Object.freeze(["acid", "cold", "fire", "lightning", "thunder"]),
    caveat: "Resistance to that instance of damage is the pack's own toggle; the Temporary Hit Points are the heal's card",
    rule: Object.freeze({ item: "Elemental Absorption", uuid: "Compendium.dnd-monster-manual.features.Item.mmElementalAbsor" }) }),
  "Ink Cloud": Object.freeze({ activity: "Expend Use", self: true, from: "monsters",
    caveat: "\"while underwater\", the Cube and the swim are the table's",
    rule: Object.freeze({ item: "Ink Cloud", uuid: "Compendium.dnd-monster-manual.features.Item.mmInkCloud000000" }) }),
  // B4 — Misty Escape (the warlock's, Archfey 6): a Reaction on taking damage, Misty Step cast without a slot (the feature's
  // own Cast activity), then one of its Steps offered. ⚠ The Monster Manual's Misty Escape is a DROP_TO_ONE `died` row.
  "Misty Escape": Object.freeze({ activity: "Misty Step", self: true, from: "Warlock — Archfey Patron 6",
    follow: Object.freeze(["Disappearing Step", "Dreadful Step"]),
    caveat: "the teleport itself is the table's move; Dreadful Step's creatures within 5 feet are your targets",
    rule: Object.freeze({ item: "Misty Escape", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkMistyEscap" }) })
});

/**
 * A feature that gives the Reaction back on EVERY turn of combat, not only at the start of the bearer's own
 * (Reactive, the marilith): the spent chip stands for the turn it was spent on and dies with it
 * (decide/chips.js `reactionStandsEveryTurn`, shared.js `reactionSpent`).
 */
export const REACTION_RESETS = Object.freeze({
  "Reactive": Object.freeze({ every: "turn",
    rule: Object.freeze({ item: "Reactive", uuid: "Compendium.dnd-monster-manual.features.Item.mmReactive000000" }),
    from: "monsters" })
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
export const EMANATION_KINDS = new Set(["feature", "spell", "area"]);

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
 *   member    only an emanation's MEMBER copy bends — the bearer's own effect of the same name never does
 *   checks / checksWhen  a bend on the bearer's ability checks, narrowed to { statuses, skills }
 *   saves     { bend, statuses?, spells?, abilities?, halfToNone? } scoped by the demand (`abilities`: the
 *             save's own ability, Irresistible Dance's Dexterity), or { succeeds, sleep } — the save
 *             cannot fail against magical sleep (a fourth button); B2's facets: `fails` (the save cannot
 *             succeed — the Fails button), `item` (the demand's item by name), `charmedBy: "source"` (the roller
 *             Charmed by the demand's caster), `sourceStatus` (the caster's status as it cast), `spells: "source"`
 *             (a spell of the effect's own source), `sourceFeature` (the effect's source holds the feature)
 *   side      "caster" — the row's carrier is the DEMAND's caster (the demand's `source` snapshot), not the roller
 *   spend     "save" — the save the row bends spends the effect (Struck), as "attack" does the next attack roll
 *   against   the carrier chip names the ONE creature it is against (`flags.<module>.against`): read at that target alone
 *   plus      a flat bonus to an attack roll AT the bearer (Sundered's +5), pushed onto the roll's parts by the gate —
 *             a listed source (no bend), `except: "source"` keeps it from the placer's own roll; NEGATIVE with
 *             `against: "attacker"` (B4, Multiattack Defense's −4): only the roll of the creature the bearer's chip names
 *   judge "opportunity" (B4, Escape the Horde): a melee attack off the attacker's combat turn — read as an Opportunity
 *             Attack (Halt's fact), the caveat said; out of combat, never
 *   attack    the bend rides ONE attack alone — the item making it (Object Slam, the GM's side): the attack
 *             itself is the carrier, no feature or effect is read;  judge "targetInSpace": the target's
 *             token overlaps the attacker's (Pack Tactics' map reading)
 * ⚠ Names are the packs' own, colons and all.
 * @type {Readonly<Record<string, Readonly<{match?: "effect"|"feature", attacker: "advantage"|"disadvantage"|null,
 *   target: "advantage"|"disadvantage"|null, scope: "any"|"spell"|"weapon"|"melee"|"ranged", caveat?: string,
 *   counted?: boolean, judge?: "bloodied"|"targetBloodied"|"targetDamaged"|"targetGrappled"|"targetNotActed"|"allyNearTarget"|"notIncapacitated"|"targetInSpace"|"opportunity", spend?: "attack"|"save", attack?: string,
 *   only?: "source", except?: "source", side?: "caster", named?: string, against?: boolean|"attacker", plus?: number, rule: object|string|null, from: string}>>>}
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
  // The Wolf's ring members (EMANATIONS "Rage of the Wolf"): the barbarian's allies attack them with Advantage.
  "Rage of the Wolf": Object.freeze({ attacker: null, target: "advantage", scope: "any", member: true, except: "source",
    from: "Barbarian — Path of the Wild Heart 3 (Rage of the Wilds: Wolf)",
    caveat: "counted — an attacker who is not the barbarian's ally is the table's to press Normal",
    rule: Object.freeze({ item: "Rage of the Wilds", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbRageOfTheW", benefit: "Wolf" }) }),
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
  // THE GM'S SIDE — the attack's own bend, judged on the map: Advantage when the target stands inside the bearer's space.
  "Object Slam": Object.freeze({ match: "feature", attack: "Object Slam", attacker: "advantage", target: null, scope: "any", judge: "targetInSpace", from: "monsters (mimics)",
    rule: Object.freeze({ item: "Object Slam", uuid: "Compendium.dnd-monster-manual.features.Item.mmObjectSlam0000" }) }),
  "Sun Sickness": Object.freeze({ match: "feature", attacker: "disadvantage", target: null, scope: "any", counted: false, from: "monsters (fomorians)",
    caveat: "listed — Disadvantage on D20 Tests only in sunlight; the hour's death clock is the table's",
    rule: Object.freeze({ item: "Sun Sickness", uuid: "Compendium.dnd-monster-manual.features.Item.mmSunSickness000" }) }),
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
  // B4 — the use chips: Shadow Step (the next melee attack), Multiattack Defense (the chip on the RANGER, −4 to the named
  // attacker's rolls for the rest of the turn); Escape the Horde: the ranger's own feature, Opportunity Attacks at Disadvantage.
  "Shadow Step": Object.freeze({ attacker: "advantage", target: null, scope: "melee", spend: "attack",
    rule: Object.freeze({ item: "Shadow Step", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkShadowStep" }),
    from: "Monk — Warrior of Shadow 6 (a use chip)" }),
  "Multiattack Defense": Object.freeze({ attacker: null, target: null, scope: "any", plus: -4, against: "attacker",
    rule: Object.freeze({ item: "Defensive Tactics", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrDefensiveT", benefit: "Multiattack Defense" }),
    from: "Ranger — Hunter 7 (a use chip)" }),
  "Escape the Horde": Object.freeze({ match: "feature", named: "Defensive Tactics", attacker: null, target: "disadvantage", scope: "melee", judge: "opportunity",
    caveat: "counted — Opportunity Attacks only: a melee attack off the attacker's turn in combat is read as one",
    rule: Object.freeze({ item: "Defensive Tactics", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrDefensiveT", benefit: "Escape the Horde" }),
    from: "Ranger — Hunter 7" }),
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
  // --- H. monster traits bending SAVES against magic (the GM's side) — the demand's own `spell` mark
  // (a spell, or an item with the Magical property). Text only in the pack; the rows are the data.
  "Magic Resistance": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "monsters",
    saves: Object.freeze({ bend: "advantage", spells: true }),
    rule: Object.freeze({ item: "Magic Resistance", uuid: "Compendium.dnd-monster-manual.features.Item.mmMagicResistanc" }) }),
  // The save cannot fail (the fourth button); "the attack rolls of spells automatically miss it" is the
  // table's — the attack gate has no auto-miss (RULINGS *The GM's side — the five shapes*).
  "Greater Magic Resistance": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "monsters",
    saves: Object.freeze({ succeeds: true, spells: true }),
    caveat: "counted — the spell attacks that automatically miss are the table's",
    rule: Object.freeze({ item: "Greater Magic Resistance", uuid: "Compendium.dnd-monster-manual.features.Item.mmGreaterMagicRe" }) }),
  // Disadvantage on attacks AGAINST the bearer, off while it is Incapacitated — the `notIncapacitated` judge.
  "Displacement": Object.freeze({ match: "feature", attacker: null, target: "disadvantage", scope: "any", judge: "notIncapacitated", from: "monsters (the displacer beast)",
    rule: Object.freeze({ item: "Displacement", uuid: "Compendium.dnd-monster-manual.features.Item.mmDisplacement00" }) }),
  "Blurred Form": Object.freeze({ match: "feature", attacker: null, target: "disadvantage", scope: "any", judge: "notIncapacitated", from: "monsters",
    rule: Object.freeze({ item: "Blurred Form", uuid: "Compendium.dnd-monster-manual.features.Item.mmBlurredForm000" }) }),
  // While Grappled, its Athletics and Acrobatics checks count as the escape
  // (RULINGS *Where the table bends the rule*); the pack's effect carries only the carrying capacity.
  "Powerful Build": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Goliath",
    checks: "advantage", checksWhen: Object.freeze({ statuses: Object.freeze(["grappled"]), skills: Object.freeze(["ath", "acr"]) }),
    caveat: "counted — while Grappled, an Athletics or Acrobatics check counts as the escape",
    rule: Object.freeze({ item: "Goliath", uuid: "Compendium.dnd-players-handbook.origins.Item.phbspGoliath0000", benefit: "Powerful Build" }) }),
  // --- H. the PHB classes — B2: the save bends by name (RULINGS *The PHB classes — B2*) -----------------
  // Brave's shape (G) twice: text-only in the pack, read by name; a sheet save to END the condition is listed, not counted.
  "Psychic Defenses": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Sorcerer — Aberrant Sorcery 6",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["charmed", "frightened"]) }),
    rule: Object.freeze({ item: "Psychic Defenses", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrPsychicDef" }) }),
  "Beguiling Twist": Object.freeze({ match: "feature", attacker: null, target: null, scope: "any", from: "Ranger — Fey Wanderer 7",
    saves: Object.freeze({ bend: "advantage", statuses: Object.freeze(["charmed", "frightened"]) }),
    rule: Object.freeze({ item: "Beguiling Twist", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgrBeguilingT" }) }),
  // `side: "caster"`: read off the DEMAND's caster — its snapshot at the cast (saves/demand.js `source`), never the
  // roller's sheet; with no demand there is nothing to list. Magical Ambush: the caster Invisible as it cast (`sourceStatus`).
  "Magical Ambush": Object.freeze({ match: "feature", side: "caster", attacker: null, target: null, scope: "any", from: "Rogue — Arcane Trickster 9",
    saves: Object.freeze({ bend: "disadvantage", spells: true, sourceStatus: "invisible" }),
    rule: Object.freeze({ item: "Magical Ambush", uuid: "Compendium.dnd-players-handbook.classes.Item.phbrgeMagicalAmb" }) }),
  // Mantle of Majesty: the pack's "Unearthly Appearance" effect on the BARD (`named`); a Command (`item`) at a creature the
  // bard has Charmed (`charmedBy: "source"` — the roller's Charmed whose source is the bard) cannot succeed (`fails`).
  "Mantle of Majesty": Object.freeze({ named: "Unearthly Appearance", side: "caster", attacker: null, target: null, scope: "any", from: "Bard — College of Glamour 6",
    saves: Object.freeze({ fails: true, item: "Command", charmedBy: "source" }),
    rule: Object.freeze({ item: "Mantle of Majesty", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdMantleOfMa" }) }),
  // Eldritch Strike: the pack's "Struck", landed by the hit (CLOCK_RIDERS "eldritch-strike"); the target's next save against a
  // spell the FIGHTER casts (`spells: "source"` — the effect's source is the demand's caster) is at Disadvantage, and that
  // save spends it (`spend: "save"`).
  "Struck": Object.freeze({ attacker: null, target: null, scope: "any", spend: "save", from: "Fighter — Eldritch Knight 10",
    saves: Object.freeze({ bend: "disadvantage", spells: "source" }),
    rule: Object.freeze({ item: "Eldritch Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrEldritchSt" }) }),
  // Eldritch Hex: Hex's six "Hexed <Ability>" effects, a row each, the ability the row's; the bend only where the effect's
  // SOURCE holds the feature (`sourceFeature`) — any other warlock's Hex bends checks alone (the pack's own change).
  "Hexed Strength": Object.freeze({ attacker: null, target: null, scope: "any", from: "Warlock — Great Old One Patron 10 (Eldritch Hex)",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["str"]), sourceFeature: "Eldritch Hex" }),
    rule: Object.freeze({ item: "Eldritch Hex", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkEldritchHe" }) }),
  "Hexed Dexterity": Object.freeze({ attacker: null, target: null, scope: "any", from: "Warlock — Great Old One Patron 10 (Eldritch Hex)",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["dex"]), sourceFeature: "Eldritch Hex" }),
    rule: Object.freeze({ item: "Eldritch Hex", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkEldritchHe" }) }),
  "Hexed Constitution": Object.freeze({ attacker: null, target: null, scope: "any", from: "Warlock — Great Old One Patron 10 (Eldritch Hex)",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["con"]), sourceFeature: "Eldritch Hex" }),
    rule: Object.freeze({ item: "Eldritch Hex", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkEldritchHe" }) }),
  "Hexed Intelligence": Object.freeze({ attacker: null, target: null, scope: "any", from: "Warlock — Great Old One Patron 10 (Eldritch Hex)",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["int"]), sourceFeature: "Eldritch Hex" }),
    rule: Object.freeze({ item: "Eldritch Hex", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkEldritchHe" }) }),
  "Hexed Wisdom": Object.freeze({ attacker: null, target: null, scope: "any", from: "Warlock — Great Old One Patron 10 (Eldritch Hex)",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["wis"]), sourceFeature: "Eldritch Hex" }),
    rule: Object.freeze({ item: "Eldritch Hex", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkEldritchHe" }) }),
  "Hexed Charisma": Object.freeze({ attacker: null, target: null, scope: "any", from: "Warlock — Great Old One Patron 10 (Eldritch Hex)",
    saves: Object.freeze({ bend: "disadvantage", abilities: Object.freeze(["cha"]), sourceFeature: "Eldritch Hex" }),
    rule: Object.freeze({ item: "Eldritch Hex", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkEldritchHe" }) }),
  // --- I. the PHB classes — B3 (RULINGS *The PHB classes — B3*) --------------------------------------------
  // Studied Attacks: the use chip a MISS wrote (USE_CHIPS), named "Studied Attacks — vs <creature>", read only at THAT
  // creature (`against`: the chip's uuid must be the attack's target), spent by the roll.
  "Studied Attacks": Object.freeze({ attacker: "advantage", target: null, scope: "any", spend: "attack", against: true, from: "Fighter 13",
    rule: Object.freeze({ item: "Studied Attacks", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrStudiedAtt" }) }),
  // Improved Brutal Strike's two landed effects. Staggered: Disadvantage on the target's NEXT save, which spends it (the
  // Opportunity Attack ban is the table's, the option's line). Sundered: +5 to the next attack roll by ANOTHER creature at
  // the target (`plus`, `except: "source"` — the barbarian's own attack gains nothing), that roll spending it.
  "Staggered": Object.freeze({ attacker: null, target: null, scope: "any", spend: "save", from: "Barbarian 13 (Improved Brutal Strike)",
    saves: Object.freeze({ bend: "disadvantage" }),
    rule: Object.freeze({ item: "Improved Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbImpBrutalS", benefit: "Staggering Blow" }) }),
  "Sundered": Object.freeze({ attacker: null, target: null, scope: "any", plus: 5, except: "source", spend: "attack", from: "Barbarian 13 (Improved Brutal Strike)",
    rule: Object.freeze({ item: "Improved Brutal Strike", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbImpBrutalS", benefit: "Sundering Blow" }) })
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
  "Twinned Spell":    { key: "twinned",    moment: "cast",   when: "scalesTargets", picks: "twin", apply: "one more creature in the target snapshot, the cast one level higher for targets" },
  // A CLASS FEATURE in the group (`free`): no cost, no Sorcery Point, never one of the one-per-cast options - its
  // tick stands beside a Metamagic pick. `fixed` the damage type every damage roll of the cast takes; `classes`
  // the spell's own class (its `sourceClass`). The components half is out (a card line would police nothing).
  "Psychic Spells":   { key: "psychic",    moment: "cast",   when: "damageRoll", picks: null, free: true, fixed: "psychic", classes: ["warlock"],
    apply: "the cast's damage rolls are psychic" },
  // B4 — Sculpt Spells: Careful's ask at the area as a FREE class-feature row (`asks: "careful"` — the same popup, the same
  // outcome: the spared succeed and take nothing), up to 1 + the slot level (`cap`), on the wizard's Evocation spells (`school`).
  "Sculpt Spells":    { key: "sculpt",     moment: "cast",   when: "save",       picks: "protect", free: true, asks: "careful", classes: ["wizard"], school: "evo",
    unless: "choosesTargets", cap: "1 + @slot", apply: "up to 1 + the slot level creatures are spared: no save, no damage" }
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
 *   also      the feature's heal ACTIVITY of that name heals one more creature after the caster's own healing
 *             spell cast with a slot (Starry Form's Chalice): offered on the spell's healing card as a pick of
 *             the caster or a creature on its side `within` feet, while `while` stands and the form chip
 *             (EFFECT_CHOICES `chip`) reads `form`; the pick uses the activity at that creature
 *   bonus / slotCast   the owner's levelled spell heals `bonus` more (`@slot` the cast's level), a part on the roll
 *   self      B4 (Blessed Healer): after the owner's slot-cast healing spell lands on ANOTHER creature, the owner regains
 *             `self` (`@slot` the cast's level) — its own card and receipt, once per cast
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 */
export const HEAL_REROLLS = Object.freeze({
  "Healer": Object.freeze({ reroll: 1, spells: true, own: true,
    rule: Object.freeze({ item: "Healer", uuid: "Compendium.dnd-players-handbook.feats.Item.phbftHealer00000", benefit: "Healing Rerolls" }),
    from: "Origin feat (Hermit)" }),
  "Beacon of Hope": Object.freeze({ effect: "Hopeful", max: true,
    caveat: "healing applied with a card's own buttons, or typed on a sheet, is not raised",
    rule: Object.freeze({ item: "Beacon of Hope", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplBeaconofHo" }),
    from: "Cleric spell, level 3 (Concentration, 1 minute)" }),
  // `bonus` + `slotCast`: a levelled spell the owner casts (never innate or at will) heals `2 + @slot` more - a
  // part added to the healing roll itself, so the card's own buttons carry it too.
  "Disciple of Life": Object.freeze({ bonus: "2 + @slot", slotCast: true,
    rule: Object.freeze({ item: "Disciple of Life", uuid: "Compendium.dnd-players-handbook.classes.Item.phbclcDiscipleOf" }),
    from: "Cleric — Life Domain 3" }),
  "Blessed Healer": Object.freeze({ self: "2 + @slot", slotCast: true,
    rule: Object.freeze({ item: "Blessed Healer", uuid: "Compendium.dnd-players-handbook.classes.Item.phbclcBlessedHea" }),
    from: "Cleric — Life Domain 6" }),
  "Starry Form": Object.freeze({ also: "Chalice", while: "Starry Form", form: "chalice", within: 30,
    rule: Object.freeze({ item: "Starry Form", uuid: "Compendium.dnd-players-handbook.classes.Item.phbdrdStarryForm", benefit: "Chalice" }),
    from: "Druid — Circle of the Stars 3" })
});

/**
 * A POOL OF HIT POINTS on its bearer that takes damage first, automatically (R1: the ward has no choice) —
 * ward-pools.js at `dnd5e.preApplyDamage`, after Resistances, so the card's own buttons carry it too.
 *   pool     where the hit points live: "uses" — the feature's own uses (the pack's Create Ward / Damage Ward
 *            activities write them); the maximum is the item's
 *   create   the feature's activity whose use creates the ward (full) once per Long Rest, on the first cast
 *   refill   `{ school, per }`: a spell of that school cast from a slot restores `per` × the slot level
 *   pool "effect" (B4, Bastion of Law): the hit points live on the pack's `effect` landed on the WARDED creature (the
 *            sorcerer's pick — the targeted token, else itself), written at the `create` activity's use: `die` per Sorcery
 *            Point spent (the use's scaling), the whole pool spent as damage lands, the effect gone at 0
 * ⚠ NOT A KIND — one table, one machine; Bastion of Law is the second customer (B4).
 */
export const WARD_POOLS = Object.freeze({
  "Arcane Ward": Object.freeze({ pool: "uses", create: "Create Ward", refill: Object.freeze({ school: "abj", per: 2 }),
    rule: Object.freeze({ item: "Arcane Ward", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwzdArcaneWard" }),
    from: "Wizard — Abjurer 3" }),
  "Bastion of Law": Object.freeze({ pool: "effect", effect: "Warded by Law", create: "Create Shield", die: 8,
    caveat: "the ward lasts until the sorcerer uses the feature again or finishes a Long Rest — the effect's own clock",
    rule: Object.freeze({ item: "Bastion of Law", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrBastionOfL" }),
    from: "Sorcerer — Clockwork Sorcery 6" })
});

/**
 * THE INITIATIVE GRANTS (the PHB classes, A6; initiative-grants.js): what a feature gives back "when you roll
 * Initiative" — read as each combatant's Initiative lands (the swap's seam), once per combat, on the GM. Keyed by
 * the feature; the feature's OWN uses pay (once per Long Rest) and are spent with it.
 *   regain   the item whose expended uses all come back (Rage; Monk's Focus);  unit  what the card calls them
 *   heal     the feature's heal activity, rolled on the owner's numbers and landed with a receipt
 *   ask      true — OFFERED (the use is the player's to keep): a Yes/No popup, the clock answers No; else it
 *            simply happens (R1) and a card says so — never when nothing would come back
 *   to: "allies" (B4, Tandem Footwork): the feature's `activity` is rolled ONCE on the owner's numbers (its `roll`) and
 *            the number is ADDED to the Initiative of the owner and every ally within `reach` feet — the combatants
 *            already rolled at once, the rest as theirs lands (a combat flag holds what is due); the activity's own
 *            consumption pays (`poolOf`: a Bardic Inspiration use). Musician's give, on the swap's seam.
 * ⚠ NOT A KIND — one table, one machine; Superior Inspiration, Perfect Focus are rows (C1 / D1).
 */
export const INITIATIVE_GRANTS = Object.freeze({
  "Persistent Rage": Object.freeze({ regain: "Rage", unit: "Rage uses",
    rule: Object.freeze({ item: "Persistent Rage", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbPersistent" }),
    from: "Barbarian 15" }),
  "Uncanny Metabolism": Object.freeze({ regain: "Monk's Focus", unit: "Focus Points", heal: "Uncanny Metabolism", ask: true,
    rule: Object.freeze({ item: "Uncanny Metabolism", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkUncannyMet" }),
    from: "Monk 2" }),
  "Tandem Footwork": Object.freeze({ to: "allies", reach: 30, activity: "Initiative Bonus", unit: "Bardic Inspiration", ask: true,
    rule: Object.freeze({ item: "Tandem Footwork", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrdTandemFoot" }),
    from: "Bard — College of Dance 6" })
});

/**
 * THE CAST RIDERS (the PHB classes, A7; cast-riders.js): what a feature does right after its bearer casts, read at
 * `dnd5e.postUseActivity` on the casting client. Keyed by the feature.
 *   spellClass  the spell must be this class's, cast WITH A SPELL SLOT (levelled, not innate or at will, a slot spent)
 *   surgeOn · table  the d20 rolled by the module once per turn (in a combat), the RollTable rolled on that face
 *   tides    the feature whose spent use makes the table roll at once, and comes back (Tides of Chaos)
 *   after    the spell whose cast raises the rider (Inspiring Smite: Divine Smite)
 *   handOut  the feature's heal activity's Temporary Hit Points DIVIDED among creatures within `reach` (the giver
 *            too) — the rest song's popup; the activity's consumption (Channel Divinity) paid only when given
 * ⚠ NOT A KIND — one table, one machine; Controlled Chaos (C1) and Tamed Surge (D1) are facets of the surge row.
 */
export const CAST_RIDERS = Object.freeze({
  "Wild Magic Surge": Object.freeze({ spellClass: "sorcerer", surgeOn: 20, tides: "Tides of Chaos",
    table: "Compendium.dnd-players-handbook.tables.RollTable.phbWildMagicSurg",
    rule: Object.freeze({ item: "Wild Magic Surge", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrSurgeWildM" }),
    from: "Sorcerer — Wild Magic Sorcery 3" }),
  "Inspiring Smite": Object.freeze({ after: "Divine Smite", handOut: true, activity: "Heal", reach: 30, self: true,
    rule: Object.freeze({ item: "Inspiring Smite", uuid: "Compendium.dnd-players-handbook.classes.Item.phbpdnInspiringS" }),
    from: "Paladin — Oath of Glory 3" })
});

/**
 * THE STORED DICE (the PHB classes, A7; stored-dice.js): d20s rolled at a rest and kept as faces on a chip on the
 * bearer ("Portent — 17 · 3", the effect view lists it), each spent once to REPLACE a D20 Test's d20.
 *   dice     how many d20s the rest rolls (Greater Portent: 3, C1);  rests  which rests roll them (the old faces go)
 *   tests    the bearer's OWN rolls a face may replace, ticked in the roll's dialog BEFORE the roll (the rule's order)
 *   oncePerTurn  one replacement per turn, whoever's roll (a stamp on the chip)
 *   die      the die's size (20 by default);  omen  true — the face is a SIGN, never spent (Cosmic Omen, B4: even Weal,
 *            odd Woe — INTERRUPT_ROLLS "Cosmic Omen" reads its parity, `sign: "omen"`); `tests` empty: no dialog tick
 * Another creature's roll is the bystander's row (INTERRUPT_ROLLS "Portent", `bend: "set"`), after the roll.
 * ⚠ NOT A KIND — one table, one machine; the replacement is a bend on the `roll` interrupt and a pinned die.
 */
export const STORED_DICE = Object.freeze({
  "Portent": Object.freeze({ dice: 2, rests: Object.freeze(["long"]), tests: Object.freeze(["attack", "save", "check"]), oncePerTurn: true,
    rule: Object.freeze({ item: "Portent", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwzdPortent000" }),
    from: "Wizard — Diviner 3" }),
  "Cosmic Omen": Object.freeze({ dice: 1, die: 6, rests: Object.freeze(["long"]), tests: Object.freeze([]), omen: true,
    rule: Object.freeze({ item: "Cosmic Omen", uuid: "Compendium.dnd-players-handbook.classes.Item.phbdrdCosmicOmen" }),
    from: "Druid — Circle of the Stars 6" })
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
 * THE DAMAGE RULES (RULINGS *The fighting styles*; renamed from FIGHTING_STYLES in B4, Q5 ruled): a style,
 * feat or class feature whose rule is a NUMBER on a damage roll, or turns on what the owner HOLDS or WEARS.
 * damage-rules.js keeps one FACE effect per row, live or greyed, read off the equipped items, and applies
 * its number to the roll it fits. The persisted names stay: the face's flag `fightingStyle`, the world's
 * `fightingStyleList` setting (a rename would orphan every face and list on a live world).
 *   gate       twoHanded | thrown | offhand (the Light extra attack) | oneHanded | armored | unarmed | heavy
 *              (on the owner's turn) | heavyArmor | offhandCrossbow | always (no equipment in the rule)
 *   minimum    the damage dice's floor;  bonus  "2" | "@mod" | "@prof" | "effect" (the pack effect's, N1)
 *   ac         "effect" — the pack effect's AC change, moved onto the face
 *   takesOver  the pack's UNGATED effect is switched off; the face carries the rule
 *   block      cut from `types` damage before resistances, at dnd5e.preCalculateDamage (the card's buttons too)
 *   ignores    "resistance" — the owner's `types` damage ignores Resistance (`options.ignore.resistance`)
 *   typed      types read off the feat's NAME ("Elemental Adept (Fire)"); none → a greyed face;  choices  the pick;
 *              pickLine  the type popup's words for what the pick does
 *   spells     spell damage only (true), or "cantrip" — level 0 only;  feat  a feat or class feature (its face wears
 *              the item's own name)
 *   breaks     "concentration" — creatures the owner damages save at Disadvantage (concentration.js)
 *   B4 — THE SPELL-DAMAGE BONUSES (Q5; decide/damage-rules.js spellRuleFits): a `spells` row with a `bonus` formula
 *   ("@abilities.cha.mod", the owner's roll data) pushed onto ONE of the spell's damage rolls — the first whose type the
 *   row names (`types`, or a `typed` row's picks; none → any).  classes  the spell's own class (its `sourceClass`);
 *   school  the spell's school ("evo");  once  "spell" (one roll per cast — Scorching Ray's rays share it) | "turn"
 *   (a turn chit, `rider` keyed `damage-rule:<key>`); absent, every roll. The pack's own Damage activities for these
 *   (measured in M0) are clicked by hand; the row is the mechanism.
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 */
export const DAMAGE_RULES = Object.freeze({
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
    from: "General feat" }),
  // B4 — the spell-damage bonuses (RULINGS *The PHB classes — B4*). The parents (Blessed Strikes, Elemental Fury) name the
  // pick; the option on the sheet is the row. Divine Strike and Primal Strike are CLOCK_RIDERS rows already.
  "Blessed Strikes: Potent Spellcasting": Object.freeze({ key: "potent-spellcasting-cleric", gate: "always", feat: true,
    spells: "cantrip", classes: Object.freeze(["cleric"]), bonus: "@abilities.wis.mod",
    rule: Object.freeze({ item: "Blessed Strikes: Potent Spellcasting", uuid: "Compendium.dnd-players-handbook.classes.Item.phbClcPotentSpel" }),
    from: "Cleric 7 (Blessed Strikes)" }),
  "Elemental Fury: Potent Spellcasting": Object.freeze({ key: "potent-spellcasting-druid", gate: "always", feat: true,
    spells: "cantrip", classes: Object.freeze(["druid"]), bonus: "@abilities.wis.mod",
    rule: Object.freeze({ item: "Elemental Fury: Potent Spellcasting", uuid: "Compendium.dnd-players-handbook.classes.Item.phbFuryPotentSpe" }),
    from: "Druid 7 (Elemental Fury)" }),
  // The affinity's type is read off the copy's NAME ("Elemental Affinity (Fire)") as Elemental Adept's is; the pack ships
  // five typed Damage activities and no pick. The Resistance half is the sheet's (a Sorcery Point, by hand).
  "Elemental Affinity": Object.freeze({ key: "elemental-affinity", gate: "always", feat: true, typed: true, spells: true,
    once: "spell", bonus: "@abilities.cha.mod", choices: Object.freeze(["acid", "cold", "fire", "lightning", "poison"]),
    pickLine: "one damage roll of your spells of that type adds your Charisma modifier",
    rule: Object.freeze({ item: "Elemental Affinity", uuid: "Compendium.dnd-players-handbook.classes.Item.phbscrElementalA" }),
    from: "Sorcerer — Draconic Sorcery 6" }),
  "Radiant Soul": Object.freeze({ key: "radiant-soul", gate: "always", feat: true, spells: true, once: "turn",
    types: Object.freeze(["radiant", "fire"]), bonus: "@abilities.cha.mod",
    rule: Object.freeze({ item: "Radiant Soul", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkRadiantSou" }),
    from: "Warlock — Celestial Patron 6" }),
  "Empowered Evocation": Object.freeze({ key: "empowered-evocation", gate: "always", feat: true, spells: true, once: "spell",
    school: "evo", classes: Object.freeze(["wizard"]), bonus: "@abilities.int.mod",
    rule: Object.freeze({ item: "Empowered Evocation", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwzdEmpoweredE" }),
    from: "Wizard — Evoker 10" })
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
 *              — `swap: true` (the GM's side): the pressed status REPLACES the effect (the medusa's second
 *              failure is Petrified INSTEAD OF Restrained)
 *   item       the spell, where the key must differ from it (a second row on one spell — Prismatic Spray's rays)
 *   activity   the save activity by NAME, where the spell's first save activity is not the repeat's
 *              (Prismatic Spray's "Indigo Save (Con)" — the Cast is a Dexterity save)
 *   caveat     what the rule leaves to the table, said on the card
 * A MONSTER's own activity (the GM's side, RULINGS *The Monster Manual — the waiting rows built*): the same
 * row, keyed by the trait — the pack's effect on the target names the trait's activity as its origin, and
 * the trait's save activity is the repeat's. The pack ships no repeat.
 * Membership: every row. Left out on purpose: Eyebite's Asleep (ends on damage, no save — the table's);
 * Prismatic Spray's violet ray (its save is at the CASTER's next turn start, when the pack's own clock ends
 * the Blinded anyway — the plane shift is the table's).
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
    from: "Bard / Wizard spell, level 6 (Concentration, 1 minute)" }),
  // The indigo ray's Restrained (RAY_TABLES lands it): Flesh to Stone's count against the spell's own Con save.
  "Prismatic Spray (Indigo)": Object.freeze({ item: "Prismatic Spray", effect: "Petrifying (Indigo)", activity: "Indigo Save (Con)",
    on: Object.freeze(["turnEnd"]), count: Object.freeze({ saves: 3, fails: 3, press: "petrified" }),
    caveat: "three failures press Petrified until freed by Greater Restoration or the like — the table's",
    rule: Object.freeze({ item: "Prismatic Spray", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplPrismaticS" }),
    from: "Sorcerer / Wizard spell, level 7 (instantaneous; the ray's Restrained lasts until the saves decide it)" }),
  // The GM's side — a monster's own activity, the pack's effect on the target (RULINGS *The Monster Manual — the waiting rows built*).
  "Pacifying Spores": Object.freeze({ effect: "Stunned", on: Object.freeze(["turnEnd"]),
    caveat: "after 1 minute it succeeds automatically — the effect's own clock",
    rule: Object.freeze({ item: "Pacifying Spores", uuid: "Compendium.dnd-monster-manual.features.Item.mmPacifyingSpore" }),
    from: "monsters (myconid sovereign)" }),
  "Paralysis Gas": Object.freeze({ effect: "Paralyzed", on: Object.freeze(["turnEnd"]),
    caveat: "after 1 minute it succeeds automatically — the effect's own clock",
    rule: Object.freeze({ item: "Paralysis Gas", uuid: "Compendium.dnd-monster-manual.features.Item.mmParalysisGas00" }),
    from: "monsters" }),
  "Scare": Object.freeze({ effect: "Frightened", on: Object.freeze(["turnEnd"]),
    caveat: "after 1 minute it succeeds automatically — the effect's own clock",
    rule: Object.freeze({ item: "Scare", uuid: "Compendium.dnd-monster-manual.features.Item.mmScare000000000" }),
    from: "monsters" }),
  "Spores": Object.freeze({ effect: "Poisoned", on: Object.freeze(["turnEnd"]),
    caveat: "Holy Water ending it early is the table's; the damage while Poisoned is TURN_GRANTS' row",
    rule: Object.freeze({ item: "Spores", uuid: "Compendium.dnd-monster-manual.features.Item.mmSpores00000000" }),
    from: "monsters (violet fungus)" }),
  // The escalation: the first failure's Restrained repeats at the turn end; the second failure is Petrified INSTEAD.
  "Petrifying Bite": Object.freeze({ effect: "Restrained", activity: "Second Save", on: Object.freeze(["turnEnd"]),
    count: Object.freeze({ saves: 1, fails: 1, press: "petrified", swap: true }),
    caveat: "freed by Greater Restoration or the like — the table's",
    rule: Object.freeze({ item: "Petrifying Bite", uuid: "Compendium.dnd-monster-manual.features.Item.mmPetrifyingBite" }),
    from: "monsters (cockatrice)" }),
  "Petrifying Breath": Object.freeze({ effect: "Restrained", on: Object.freeze(["turnEnd"]),
    count: Object.freeze({ saves: 1, fails: 1, press: "petrified", swap: true }),
    caveat: "the pack's one save carries both effects — the tray lands Restrained first; freed by Greater Restoration or the like — the table's",
    rule: Object.freeze({ item: "Petrifying Breath", uuid: "Compendium.dnd-monster-manual.features.Item.mmPetrifyingBrea" }),
    from: "monsters (gorgon)" }),
  "Petrifying Gaze": Object.freeze({ effect: "Restrained", activity: "Second Save", on: Object.freeze(["turnEnd"]),
    count: Object.freeze({ saves: 1, fails: 1, press: "petrified", swap: true }),
    caveat: "the medusa's own reflection is the table's; freed by Greater Restoration or the like — the table's",
    rule: Object.freeze({ item: "Petrifying Gaze", uuid: "Compendium.dnd-monster-manual.features.Item.mmPetrifyingGaze" }),
    from: "monsters (medusa)" })
});

/**
 * A SPELL whose landed effect pays the bearer something at the start of each of its turns that the pack
 * rolls once, at the cast (turn-grants.js): the origin item's `activity` is rolled again on the CASTER's
 * numbers and landed on the bearer, receipted, no choice (R1). Keyed by the spell; `effect` the pack's
 * effect name on the bearer. Precedent: the emanation's `heal on "turnStart"` (EMANATIONS, Aura of Life).
 * ⚠ NOT A KIND — one table, one machine; a second customer is a row.
 *   match     "feature" (Regeneration, the GM's side): the bearer's OWN trait pays, rolled on ITS numbers — no effect,
 *             no caster; `activity` null is the first heal activity
 *   while     "aboveZero" — only with at least 1 Hit Point at the turn start
 *   unless    { damagedBy: "text" } — the block read off the BEARER's copy of the trait ("takes Acid or Fire
 *             damage"): dealt any named type since its last turn started (the receipts), it pays nothing and a
 *             card says why. The pack's item names no type; each monster's copy names its own
 *   on        "turnStart" (the default) | "turnEnd" — the bearer's turn END (the swarm's grappled target)
 *   deals     true — the activity is a DAMAGE landed on the bearer of the effect, rolled on the ORIGIN's numbers
 *             (the grappled creature's own turn: Constricting Vine's "Damage: Grappled"; Spores' "Damage While
 *             Poisoned"); a feature row's `deals: "grappled"` deals its damage activity, at the bearer's own turn
 *             start, to the creatures the bearer GRAPPLES (Barbed Hide — Unarmed Fighting's finder, the grapples
 *             it can trace to the bearer only; the rest are the table's)
 *   remind    "extend" — pays nothing: at the bearer's turn END a card says the effect ends now unless the turn
 *             extended it (Rage: an attack roll at an enemy or a save forced on one, read off the turn's cards,
 *             or a Bonus Action nothing records) — never an end (RULINGS *Where the table bends the rule*);
 *             the turn the effect began is never reminded; `unlessFeature` — a feature on the bearer that
 *             silences it (Persistent Rage: the Rage lasts without extending)
 *   feature   a `match: "feature"` row that is ONE BENEFIT of a feature: the sheet's item is this name, the row
 *             key the benefit (Vitality of the Tree's two)
 *   on: "use" + of   the bearer's OWN use of the named item (`of`: the Rage) pays the row (Vitality Surge)
 *   while     "raging" — the bearer wears its Rage
 *   to: "ally" the row's amount is GIVEN to one creature within `reach` feet — the owner picks (the rest song's
 *             popup, rest-grants.js); `self` false: another creature (Life-Giving Force)
 *   grant     B4 — what a feature row pays that is not a roll: "inspiration" (Heroic Warrior: Heroic Inspiration written
 *             on the sheet at the turn start when none is held, a card, no choice — R1) | "end" (Guarded Mind, Self-
 *             Restoration, Physician's Touch: one of `statuses` ended on the bearer — OFFERED, a button per condition it
 *             wears, `activity` the pack's activity that pays when the row has a cost, the clock keeps it)
 *   to: "target"  an `on: "use"` row whose bearer is the use's TARGET (Hand of Healing's healed creature); `of` may be a
 *             list of items (the pack ships the heal on two), `activityType` narrows the use ("heal")
 * The GM's side: RULINGS *The Monster Manual — the waiting rows built*.
 */
export const TURN_GRANTS = Object.freeze({
  "Heroism": Object.freeze({ effect: "Bravery", activity: "Heal", on: "turnStart",
    rule: Object.freeze({ item: "Heroism", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplHeroism000" }),
    from: "Bard / Paladin spell, level 1 (Concentration, 1 minute)" }),
  "Regeneration": Object.freeze({ match: "feature", effect: null, activity: null, on: "turnStart", while: "aboveZero",
    unless: Object.freeze({ damagedBy: "text" }),
    caveat: "a block that is not a damage type (the vampire's sunlight, running water) is the table's",
    rule: Object.freeze({ item: "Regeneration", uuid: "Compendium.dnd-monster-manual.features.Item.mmRegeneration00" }),
    from: "monsters (trolls, hydras, vampires)" }),
  // The grappled creature's own turn: the grappler's damage activity, its Grappled the effect (the tray's copy names the attack).
  "Constricting Vine": Object.freeze({ effect: "Grappled", activity: "Damage: Grappled", on: "turnStart", deals: true,
    rule: Object.freeze({ item: "Constricting Vine", uuid: "Compendium.dnd-monster-manual.features.Item.mmConstrictingVi" }),
    from: "monsters (vine blight)" }),
  "Smother": Object.freeze({ effect: "Grappled + Other Conditions", activity: "Grappled: Damage", on: "turnStart", deals: true,
    caveat: "the rug halving its own damage and passing it to the smothered is the table's",
    rule: Object.freeze({ item: "Smother", uuid: "Compendium.dnd-monster-manual.features.Item.mmSmother0000000" }),
    from: "monsters (rug of smothering)" }),
  "Swarm of Proboscises": Object.freeze({ effect: "Grappled", activity: "Damage: Grappled", on: "turnEnd", deals: true,
    rule: Object.freeze({ item: "Swarm of Proboscises", uuid: "Compendium.dnd-monster-manual.features.Item.mmSwarmOfProbosc" }),
    from: "monsters (swarm of stirges)" }),
  "Spores": Object.freeze({ effect: "Poisoned", activity: "Damage While Poisoned", on: "turnStart", deals: true,
    rule: Object.freeze({ item: "Spores", uuid: "Compendium.dnd-monster-manual.features.Item.mmSpores00000000" }),
    from: "monsters (violet fungus)" }),
  // The grappler's own turn start: its damage to what it holds.
  "Barbed Hide": Object.freeze({ match: "feature", effect: null, activity: null, on: "turnStart", deals: "grappled",
    caveat: "a grapple the module cannot trace to the bearer is the table's",
    rule: Object.freeze({ item: "Barbed Hide", uuid: "Compendium.dnd-monster-manual.features.Item.mmBarbedHide0000" }),
    from: "monsters (barbed devil)" }),
  "Rage": Object.freeze({ effect: "Rage", on: "turnEnd", remind: "extend", unlessFeature: "Persistent Rage",
    says: "an attack roll against an enemy, a saving throw forced on one, or a Bonus Action to extend it",
    rule: Object.freeze({ item: "Rage", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbRage000000", benefit: "Duration" }),
    from: "Barbarian 1" }),
  // Vitality of the Tree's two benefits (the PHB classes, A6): the surge at the Rage, the gift at each raging turn start.
  "Vitality Surge": Object.freeze({ match: "feature", feature: "Vitality of the Tree", activity: "Vitality Surge", on: "use", of: "Rage",
    rule: Object.freeze({ item: "Vitality of the Tree", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbVitalityOf", benefit: "Vitality Surge" }),
    from: "Barbarian — Path of the World Tree 3" }),
  "Life-Giving Force": Object.freeze({ match: "feature", feature: "Vitality of the Tree", activity: "Life-Giving Force", on: "turnStart",
    while: "raging", to: "ally", reach: 10, self: false,
    caveat: "the Temporary Hit Points vanishing when the Rage ends is the table's",
    rule: Object.freeze({ item: "Vitality of the Tree", uuid: "Compendium.dnd-players-handbook.classes.Item.phbbrbVitalityOf", benefit: "Life-Giving Force" }),
    from: "Barbarian — Path of the World Tree 3" }),
  // B4 — the grants that are not a roll (RULINGS *The PHB classes — B4*). Heroic Warrior: in a combat, at the turn start.
  "Heroic Warrior": Object.freeze({ match: "feature", on: "turnStart", grant: "inspiration",
    rule: Object.freeze({ item: "Heroic Warrior", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrHeroicWarr" }),
    from: "Fighter — Champion 10" }),
  // Guarded Mind: the pack's End Effects activity spends a Psionic Energy Die (poolOf); the Resistance half is the pack's.
  "Guarded Mind": Object.freeze({ match: "feature", on: "turnStart", grant: "end", activity: "End Effects",
    statuses: Object.freeze(["charmed", "frightened"]),
    rule: Object.freeze({ item: "Guarded Mind", uuid: "Compendium.dnd-players-handbook.classes.Item.phbftrGuardedMin" }),
    from: "Fighter — Psi Warrior 10" }),
  "Self-Restoration": Object.freeze({ match: "feature", on: "turnEnd", grant: "end",
    statuses: Object.freeze(["charmed", "frightened", "poisoned"]),
    caveat: "the no-food-no-drink half is the table's",
    rule: Object.freeze({ item: "Self-Restoration", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkSelfrestor" }),
    from: "Monk 10" }),
  // Physician's Touch's Hand of Healing half: the healed creature may lose one condition (asked). The Hand of Harm half is
  // the hit menu's (HIT_OPTIONS "hand-of-harm" `also`). The pack ships the heal on Hand of Healing AND on Physician's Touch.
  "Physician's Touch": Object.freeze({ match: "feature", on: "use", of: Object.freeze(["Hand of Healing", "Physician's Touch"]),
    activityType: "heal", to: "target", grant: "end",
    statuses: Object.freeze(["blinded", "deafened", "paralyzed", "poisoned", "stunned"]),
    rule: Object.freeze({ item: "Physician's Touch", uuid: "Compendium.dnd-players-handbook.classes.Item.phbmnkPhysicians" }),
    from: "Monk — Warrior of Mercy 6" })
});

/**
 * THE WARDS (the spells slice, Tier 3; wards.js; RULINGS *The spells slice — Tier 3*): a standing
 * effect on a creature that makes whoever TARGETS it save first, BEFORE the roll — the buy box's seam
 * (`dnd5e.preRollAttack`, advantage-buys.js) and the cast's (`dnd5e.preUseActivity`). Keyed by the spell; the
 * effect is found on the bearer by its name AND its origin item (`repeatRowFor`'s matcher). The save is the
 * item's own activity, demanded of the attacker through the saves machine; a failure cancels the attack or the
 * spell (the card says so, the target is the attacker's to change); a success lets it roll.
 *   effect    the pack's effect on the WARDED creature;  activity  the save activity on the ward's item
 *   gates     "attack" — every attack roll at the bearer · "damagingSpell" — a spell with damage aimed at it
 *             (no area: "doesn't protect from areas of effect")
 *   endsOn    what the BEARER does that ends it: "attack" (an attack roll) · "spell" (any cast, cantrips and
 *             heals included — ruled) · "damage" (a damage roll — the register row)
 * Not a kind: one machine, rows of data. ⚠ Unbreakable Majesty (Bard, Glamour 14) is NOT this shape in 2024:
 * its save comes AFTER a hit ("or the attack misses instead") — the duplicates' seam with a save for the die.
 */
export const WARDS = Object.freeze({
  "Sanctuary": Object.freeze({ effect: "Warded", activity: "Save on Target",
    gates: Object.freeze(["attack", "damagingSpell"]), endsOn: Object.freeze(["attack", "spell", "damage"]),
    rule: Object.freeze({ item: "Sanctuary", uuid: "Compendium.dnd-players-handbook.spells.Item.phbSanctuary0000" }),
    from: "Cleric spell, level 1 (1 minute)" })
});

/**
 * THE DUPLICATES (the spells slice, Tier 3; hold/*, RULINGS *The spells slice — Tier 3*): a hit that
 * stands after the defender's reactions is rolled AGAINST THE DUPLICATES — a die per standing duplicate, any
 * face at `at` or higher redirects the hit to one of them, which is destroyed (its effect deleted); no choice
 * (R1), no popup — the dice rise off the token. Rides the hold: the target entry is answered by the machine, the
 * absorbed hit is a `verdict: "absorbed"` (decide/verdict.js). An attacker that sees through (a status, a sense)
 * rolls nothing and a line says why.
 *   effect    the pack's effects, one per duplicate (the count is what stands on the sheet)
 *   die · at  the die per duplicate, the face that redirects
 *   seesThrough  { statuses, senses } on the ATTACKER that make it immune
 *   match     "feature" (the GM's side, Reflective Carapace): the DEFENDER's own trait, one "duplicate" that is
 *             never destroyed — `only: "rangedSpellAttack"` narrows the hits it answers; `reflectAt` the face
 *             that also reflects the spell (the caster the target — the table's, the card says so)
 * Not a kind: one machine, rows of data.
 */
export const DUPLICATES = Object.freeze({
  "Mirror Image": Object.freeze({ effect: Object.freeze(["Duplicate A", "Duplicate B", "Duplicate C"]), die: 6, at: 3,
    seesThrough: Object.freeze({ statuses: Object.freeze(["blinded"]), senses: Object.freeze(["blindsight", "truesight"]) }),
    rule: Object.freeze({ item: "Mirror Image", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplMirrorImag" }),
    from: "Bard / Sorcerer / Warlock / Wizard spell, level 2 (1 minute)" }),
  // The tarrasque's shell: every ranged spell attack is turned aside (a d6 — 1 to 5 unaffected, a 6 unaffected AND reflected).
  "Reflective Carapace": Object.freeze({ match: "feature", die: 6, at: 1, reflectAt: 6, only: "rangedSpellAttack",
    caveat: "Magic Missile (no attack roll) is the cast-triggered kind, not built; the reflection on a 6 — the caster the target — is the table's",
    rule: Object.freeze({ item: "Reflective Carapace", uuid: "Compendium.dnd-monster-manual.features.Item.mmReflectiveCara" }),
    from: "monsters (the tarrasque)" })
});

/**
 * THE DAMAGE SHARES (RULINGS *The spells slice — the held spells*; damage-shares.js): a standing effect on a
 * creature whose text says its CASTER takes what it takes (Warding Bond). Read on `dnd5e.applyDamage`, the
 * rebukes' seam: the amount that LANDED on the bearer is applied to the caster (the effect's origin actor)
 * as untyped damage — the same number, no second resistance — with its own receipt on the same card, no
 * choice (R1). Keyed by the spell; the effect is found by its name AND its origin (`repeatRowFor`).
 *   effect    the pack's effect on the BEARER;  share  the fraction of the landed amount (1: the same)
 *   within    feet — beyond it the bond is out of reach: nothing is shared and a card says so
 *   endsAt    "zeroHP" — the caster dropping to 0 ends the spell (the effect deleted, receipted)
 * Not a kind: one machine, rows of data.
 */
export const DAMAGE_SHARES = Object.freeze({
  "Warding Bond": Object.freeze({ effect: "Bonded", share: 1, within: 60, endsAt: "zeroHP",
    caveat: "the bond's end at more than 60 feet, or at a re-cast on either creature, is the table's — delete Bonded",
    rule: Object.freeze({ item: "Warding Bond", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplWardingBon" }),
    from: "Cleric / Paladin spell, level 2 (1 hour)" })
});

/**
 * THE HEAL ON HIT (RULINGS *The spells slice — the held spells*; heal-on-hit.js): a spell whose damage, once
 * it has LANDED, heals its caster a share of what landed (Vampiric Touch — Lifedrinker's shape, SWEEP §3
 * item 4). Read on `dnd5e.applyDamage`: the dealing card's activity answers the row; the amount taken of
 * the row's `type` (every part of it, on this spell) times `share`, floored, is healed on the caster with a
 * receipt on the same card, once per creature per card, no choice (R1). Keyed by the spell.
 *   share   the fraction healed;  type  the damage type the text names, or null for every type
 *   on      "kill" — keyed by a FEATURE on its bearer, not the dealing item: when an ENEMY of the bearer (the
 *           tokens on opposite sides) drops to 0 under damage a card dealt, and the bearer dealt it or stands
 *           `within` feet of the fallen, the feature's own heal activity lands on the bearer (`temphp`: its
 *           Temporary Hit Points, which never stack) — receipted, no choice (R1). A drop no card dealt (a sheet
 *           edit) names no dealer and pays nothing (RULINGS *Where the table bends the rule*)
 * Not a kind: one machine, rows of data.
 */
export const HEAL_ON_HIT = Object.freeze({
  "Vampiric Touch": Object.freeze({ share: 0.5, type: "necrotic",
    rule: Object.freeze({ item: "Vampiric Touch", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplVampiricTo" }),
    from: "Sorcerer / Warlock / Wizard spell, level 3 (Concentration, 1 minute)" }),
  "Dark One's Blessing": Object.freeze({ on: "kill", temphp: true, within: 10,
    rule: Object.freeze({ item: "Dark One's Blessing", uuid: "Compendium.dnd-players-handbook.classes.Item.phbwlkDarkOnesBl" }),
    from: "Warlock — Fiend Patron 3" })
});

/**
 * THE DRAIN (RULINGS *The Monster Manual — the waiting rows built*; drains.js): a monster's attack whose damage,
 * once it has LANDED, lowers the target — its Hit Point maximum by what landed (Life Drain, Proboscis), or an
 * ability score by the die its text names (Draining Swipe). Vampiric Touch's seam: on `dnd5e.applyDamage` the
 * dealing card's activity answers the row; the module writes an effect on the target — the pack's own where it
 * ships one ("Hit: STR Score −N"), else its own (`hp.tempmax` lowered; one copy per row, refreshed with the
 * total) — receipted on the drain's own card, once per creature per card, no choice (R1). Keyed by the item.
 *   what      "max" (the maximum, by the damage taken) | "ability" (a score)
 *   type      the damage type counted, or null for every type (Proboscis: the Necrotic alone)
 *   ability   a score row's key;  amount  "text" — the die read off the item's text ("[[/r 1d4]]"), never copied
 * Not a kind: one machine, rows of data.
 */
export const DRAINS = Object.freeze({
  "Life Drain": Object.freeze({ what: "max", type: null,
    caveat: "the target dies if the fall leaves its maximum at 0, and when the fall ends — the table's",
    rule: Object.freeze({ item: "Life Drain", uuid: "Compendium.dnd-monster-manual.features.Item.mmLifeDrain00000" }),
    from: "monsters (wights, specters, wraiths)" }),
  "Proboscis": Object.freeze({ what: "max", type: "necrotic",
    caveat: "the target dies if the fall leaves its maximum at 0, and when the fall ends — the table's",
    rule: Object.freeze({ item: "Proboscis", uuid: "Compendium.dnd-monster-manual.features.Item.mmProboscis00000" }),
    from: "monsters (stirges)" }),
  "Draining Swipe": Object.freeze({ what: "ability", ability: "str", amount: "text",
    caveat: "the target dies at a Strength of 0, and the Shadow that rises from a Humanoid — the table's",
    rule: Object.freeze({ item: "Draining Swipe", uuid: "Compendium.dnd-monster-manual.features.Item.mmDrainingSwipe0" }),
    from: "monsters (shadows)" })
});

/**
 * THE RAY TABLES (RULINGS *The spells slice — the held spells*; prismatic.js): a cone whose text rolls a die
 * PER CREATURE to pick which ray hits it (Prismatic Spray). The cast's own demand is closed at birth; when
 * the cone is placed the machine rolls `die` per creature inside and raises ONE demand per (creature, ray)
 * against the `cast` activity's save, the ray's `type` forced onto the damage roll; a ray with `save`
 * demands that activity instead and lands `effect` on a failure (the module's own, since the pack ties the
 * effects to the Cast). A `twice` face rolls two more, ignoring that face.
 *   rays    by face: { colour, type } for damage, { colour, save, effect, words } for a condition
 * Not a kind: one machine, rows of data.
 */
export const RAY_TABLES = Object.freeze({
  "Prismatic Spray": Object.freeze({ die: 8, cast: "Cast", twice: 8,
    rays: Object.freeze({
      1: Object.freeze({ colour: "red", type: "fire" }),
      2: Object.freeze({ colour: "orange", type: "acid" }),
      3: Object.freeze({ colour: "yellow", type: "lightning" }),
      4: Object.freeze({ colour: "green", type: "poison" }),
      5: Object.freeze({ colour: "blue", type: "cold" }),
      6: Object.freeze({ colour: "indigo", save: "Indigo Save (Con)", effect: "Petrifying (Indigo)",
        words: "Restrained; the save repeats at the end of each of its turns — three successes end it, three failures petrify it" }),
      7: Object.freeze({ colour: "violet", save: "Violet Save (Wis)", effect: "Teleporting (Violet)",
        words: "Blinded until the start of the caster's next turn; the Wisdom save then — a failure sends it to another plane — is the table's" }),
      8: Object.freeze({ colour: "special", twice: true })
    }),
    rule: Object.freeze({ item: "Prismatic Spray", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplPrismaticS" }),
    from: "Sorcerer / Wizard spell, level 7 (instantaneous, a 60-foot Cone)" })
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
      + "the template the system placed (2026-09-03) — the platform's Region keeps geometry and clock; "
      + "`area` (the spells slice): the template adopted where it was placed, attached to nothing — its "
      + "trigger words (enter, turnEnd, move) and its band, ask, gate and alert facets are vocabulary, not kinds" },
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
 *   reroll → the FEATURE (REROLLS; the card says the feature's name)
 */
const row = (name, kind) => Object.freeze({ name, kind });
export const INTERRUPTS = Object.freeze([
  row("Shield", "ac"), row("Absorb Elements", "damage"), row("Uncanny Dodge", "damage"), row("Defensive Duelist", "ac"),
  row("Illusory Self", "ac"), row("Glorious Defense", "roll"), row("Parry", "ac"), row("Counterattack", "ac"),
  row("Defensive Stance", "ac"), row("Whirlwind of Sand", "ac"), row("Deflect Attacks", "damage"),
  row("Stone's Endurance", "damage"), row("Lucky", "roll"), row("Warding Flare", "roll"), row("Shadowy Dodge", "roll"),
  row("Interception", "damage"), row("Psionic Power", "damage"), row("Protection", "roll"), row("Cutting Words", "roll"), row("Restore Balance", "roll"), row("Guided Strike", "roll"),
  row("Combat Inspiration", "roll"), row("Portent", "roll"), row("Countercharm", "roll"),
  row("Beguiling Twist", "roll"), row("Beguiling Defenses", "damage"),
  row("Bend Luck", "roll"), row("Cosmic Omen", "roll"), row("Projected Ward", "damage"),
  // the GM's side
  row("Toxic Escape", "damage"), row("Deflect Missile", "damage"), row("Limited Foresight", "roll")
]);
/** Which spells a reaction stops outright. */
export const BLOCKS = Object.freeze([Object.freeze({ spell: "Magic Missile", reaction: "Shield" })]);
export const MANEUVER_FOLDS = Object.freeze([
  row("Precision Attack", "precision"), row("Riposte", "riposte"), row("Shield Master", "interpose"),
  row("Shield Master", "bash"), row("Great Weapon Master", "hew"), row("Commander's Strike", "command"),
  row("Tavern Brawler", "shove"), row("Crusher", "shove"), row("Polearm Master", "hew"), row("War Priest", "hew"), row("War Magic", "hew"),
  row("Hunter's Prey", "hew")
]);
export const D20_FOLDS = Object.freeze([
  row("Heroic Inspiration", "heroic"), row("Tactical Mind", "tactical"), row("Inspired", "bardic"),
  row("Ambush", "tactical"), row("Tactical Assessment", "tactical"), row("Seeking Spell", "seeking"),
  row("Lucky", "advantage"), row("Mage Slayer", "succeed"), row("Commanding Presence", "tactical"), row("Tides of Chaos", "advantage"),
  row("Indomitable", "reroll"), row("Fanatical Focus", "reroll"),
  row("Dark One's Own Luck", "tactical"), row("Soul Blades", "tactical")
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
export const hitMenuEntries = () => everyRow([...new Set(Object.values(HIT_OPTIONS).map(r => r.feature))]);   // several options share a feature (A2)
export const emanationEntries = () => everyRow(Object.keys(EMANATIONS));
export const damageShieldEntries = () => everyRow(Object.keys(DAMAGE_SHIELDS));
export const initiativeSwapEntries = () => everyRow(Object.keys(INITIATIVE_SWAPS));
export const initiativeGrantEntries = () => everyRow(Object.keys(INITIATIVE_GRANTS));
export const castRiderEntries = () => everyRow(Object.keys(CAST_RIDERS));
export const storedDiceEntries = () => everyRow(Object.keys(STORED_DICE));
export const kitTendEntries = () => everyRow(Object.keys(KIT_TENDS));
export const damageRuleEntries = () => everyRow(Object.keys(DAMAGE_RULES));
export const unarmedDiceEntries = () => everyRow(Object.keys(UNARMED_DICE));
export const healRerollEntries = () => everyRow(Object.keys(HEAL_REROLLS));
export const wardPoolEntries = () => everyRow(Object.keys(WARD_POOLS));
export const repeatSaveEntries = () => everyRow(Object.keys(REPEAT_SAVES));
export const turnGrantEntries = () => everyRow(Object.keys(TURN_GRANTS));
export const wardEntries = () => everyRow(Object.keys(WARDS));
export const duplicateEntries = () => everyRow(Object.keys(DUPLICATES));
export const damageShareEntries = () => everyRow(Object.keys(DAMAGE_SHARES));
export const healOnHitEntries = () => everyRow(Object.keys(HEAL_ON_HIT));
export const drainEntries = () => everyRow(Object.keys(DRAINS));
export const rayTableEntries = () => everyRow(Object.keys(RAY_TABLES));
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
