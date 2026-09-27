/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE FIGHTING STYLES' arithmetic — what the owner
 * holds, whether a style's face is live, whether a roll fits it, and what a damage floor raised.
 * Pure: plain facts in, plain answers out; fighting-styles.js reads the sheet and the roll.
 * The rows are decide/registry.js FIGHTING_STYLES; RULINGS *The fighting styles*.
 */

/** A melee weapon's types, as dnd5e names them (a natural weapon is never "held"). */
const MELEE = new Set(["simpleM", "martialM"]);
const ARMOR = new Set(["light", "medium", "heavy"]);

/*
 * @typedef {object} ItemFact
 * @property {string} name
 * @property {string} type          the item's document type (weapon, equipment, …)
 * @property {string} [kind]        system.type.value (simpleM, martialR, natural, light, shield, …)
 * @property {boolean} equipped
 * @property {string[]} [properties]
 * @property {string} [base]        system.type.baseItem (handcrossbow, …)
 */

/**
 * What the owner HOLDS and WEARS, off the sheet's Equipped boxes — held is equipped (RULINGS
 * *Where the table bends the rule*). A natural weapon (a claw, the Unarmed Strike) is never held.
 * @param {ItemFact[]} items
 * @returns {{weapons: ItemFact[], armor: ItemFact|null, shield: ItemFact|null}}
 */
export function heldOf(items) {
  const on = (items ?? []).filter(i => i?.equipped === true);
  return {
    weapons: on.filter(i => (i.type === "weapon") && (i.kind !== "natural")),
    armor: on.find(i => (i.type === "equipment") && ARMOR.has(i.kind)) ?? null,
    shield: on.find(i => (i.type === "equipment") && (i.kind === "shield")) ?? null
  };
}

const has = (item, prop) => (item?.properties ?? []).includes(prop);
/** The three crossbows, by dnd5e's base item — decide/registry.js CROSSBOWS (this layer imports nothing). */
const CROSSBOW_IDS = new Set(["handcrossbow", "lightcrossbow", "heavycrossbow"]);
const isMelee = item => MELEE.has(item?.kind);

/**
 * A style's face: live, or off with the reason. `word` is the one-word state (the item, the
 * die, why it is off), kept on the face's record; the panel shows the name alone. `detail` is
 * the long line, the hover title ("a second weapon held (Dagger)").
 * @param {string} gate
 * @param {ReturnType<typeof heldOf>} held
 * @param {{small?: string, large?: string}} [dice]  Unarmed Fighting's two dice, as the feat ships them
 * @returns {{live: boolean, word: string, detail: string}}
 */
export function faceState(gate, held, dice = {}) {
  const w = held?.weapons ?? [];
  const lc = item => String(item?.name ?? "").toLowerCase();
  switch ( gate ) {
    case "twoHanded": {
      const big = w.find(i => isMelee(i) && (has(i, "two") || has(i, "ver")));
      return big ? { live: true, word: lc(big), detail: `${big.name}, two hands` }
        : { live: false, word: "unequipped", detail: "no Two-Handed or Versatile melee weapon equipped" };
    }
    // always on: the attack's thrown mode is the whole gate, and a thrown weapon need not be
    // equipped to be thrown
    case "thrown": return { live: true, word: "", detail: "thrown attacks" };
    case "offhand": {
      const light = w.filter(i => has(i, "lgt"));
      return ((w.length >= 2) && light.length) ? { live: true, word: lc(light.at(-1)), detail: "the Light weapon's extra attack" }
        : { live: false, word: "unpaired", detail: "not holding two weapons" };
    }
    case "oneHanded": {
      const melee = w.filter(isMelee);
      if ( !melee.length ) return { live: false, word: "unequipped", detail: "no melee weapon equipped" };
      if ( w.length > 1 ) {
        const other = w.find(i => i !== melee[0]);
        return { live: false, word: "dual-wielding", detail: `a second weapon held (${other.name})` };
      }
      if ( has(melee[0], "two") ) return { live: false, word: "two-handed", detail: `${melee[0].name} needs two hands` };
      return { live: true, word: lc(melee[0]), detail: `${melee[0].name} in one hand` };
    }
    case "armored":
      return held?.armor ? { live: true, word: lc(held.armor), detail: held.armor.name }
        : { live: false, word: "unarmored", detail: "no armor worn" };
    case "heavy": {
      const heavy = w.find(i => has(i, "hvy"));
      return heavy ? { live: true, word: lc(heavy), detail: `${heavy.name}, Heavy` }
        : { live: false, word: "unequipped", detail: "no Heavy weapon equipped" };
    }
    case "heavyArmor":
      return (held?.armor?.kind === "heavy") ? { live: true, word: lc(held.armor), detail: held.armor.name }
        : { live: false, word: held?.armor ? "not heavy" : "unarmored",
          detail: held?.armor ? `${held.armor.name} is not Heavy armor` : "no armor worn" };
    case "offhandCrossbow": {
      const light = w.filter(i => has(i, "lgt") && CROSSBOW_IDS.has(i.base));
      return ((w.length >= 2) && light.length) ? { live: true, word: lc(light.at(-1)), detail: "the Light crossbow's extra attack" }
        : { live: false, word: "unpaired", detail: "not holding a Light crossbow and a second weapon" };
    }
    // no equipment in the rule (Elemental Adept, Poisoner): on while the feat is on the sheet
    case "always": return { live: true, word: "", detail: "always" };
    case "unarmed": {
      const empty = !w.length && !held?.shield;
      const die = empty ? (dice.large ?? "d8") : (dice.small ?? "d6");
      return { live: true, word: die, detail: empty ? `${die} — hands empty` : `${die} — a weapon or Shield held` };
    }
    default: return { live: false, word: "", detail: "" };
  }
}

/**
 * Does THIS roll fit the style? The attack's own mode (dnd5e's attackModes) decides the grip;
 * with no mode on the roll (a damage roll made without its attack), a Two-Handed weapon is two
 * hands and anything else one.
 * @param {string} gate
 * `ownTurn` is false only when a combat runs and it is someone else's turn (an Opportunity Attack):
 * Heavy Weapon Mastery's "as part of the Attack action on your turn".
 * @param {{kind?: string, properties?: string[], mode?: string|null, mod?: number, faceLive?: boolean, ownTurn?: boolean}} roll
 * @returns {boolean}
 */
export function rollFits(gate, roll) {
  const mode = roll?.mode || (has(roll, "two") ? "twoHanded" : "oneHanded");
  switch ( gate ) {
    case "heavy": return has(roll, "hvy") && (roll?.ownTurn !== false);
    case "twoHanded": return isMelee(roll) && (mode === "twoHanded") && (has(roll, "two") || has(roll, "ver"));
    case "thrown": return ((mode === "thrown") || (mode === "thrown-offhand")) && has(roll, "thr");
    // dnd5e keeps a NEGATIVE modifier on the off-hand already; the style adds only what it dropped
    case "offhand": return ((mode === "offhand") || (mode === "thrown-offhand")) && (Number(roll?.mod) > 0);
    case "offhandCrossbow": return (mode === "offhand") && CROSSBOW_IDS.has(roll?.base) && has(roll, "lgt") && (Number(roll?.mod) > 0);
    case "oneHanded": return isMelee(roll) && (mode === "oneHanded") && (roll?.faceLive === true);
    default: return false;
  }
}

/**
 * The damage types a `typed` row reads off the feat's NAME — "Elemental Adept (Fire)",
 * "Elemental Adept (Fire, Cold)" — every copy on the sheet adding its own.
 * Only a real damage type counts; a copy with no type in its name adds nothing.
 * @param {string[]} names        the feat copies' names
 * @param {string} base           the row's name
 * @param {Iterable<string>} known the damage type keys (CONFIG.DND5E.damageTypes)
 * @returns {string[]}            lower-case keys, each once, in order met
 */
export function typesInNames(names, base, known) {
  const ok = new Set([...(known ?? [])].map(k => String(k).toLowerCase()));
  const out = [];
  const head = String(base ?? "").toLowerCase();
  for ( const name of (names ?? []) ) {
    const n = String(name ?? "").trim();
    if ( !n.toLowerCase().startsWith(head) ) continue;
    const inside = n.slice(head.length).match(/\(([^)]*)\)/)?.[1] ?? "";
    for ( const word of inside.split(/[,/&]|\band\b/i) ) {
      const t = word.trim().toLowerCase();
      if ( t && ok.has(t) && !out.includes(t) ) out.push(t);
    }
  }
  return out;
}

/**
 * THE TYPE PICK: the choices a new copy of a typed feat may still take — the
 * row's own, less the types the actor's other copies already name (Elemental Adept is repeatable,
 * "a different damage type each time").
 * @param {string[]} choices   the row's `choices`
 * @param {string[]} held      the types the other copies name
 * @returns {string[]}
 */
export function typeChoicesLeft(choices, held) {
  const have = new Set((held ?? []).map(t => String(t).toLowerCase()));
  return (choices ?? []).filter(t => !have.has(String(t).toLowerCase()));
}

/**
 * A typed row's face: the types it reads, or off with how to fix it.
 * @param {string} name   the row's name
 * @param {string[]} types
 * @returns {{live: boolean, word: string, detail: string}}
 */
export function typedFace(name, types) {
  if ( !types?.length ) return { live: false, word: "no type", detail: `no damage type chosen — use Choose type on its card, or rename it "${name} (Fire)"` };
  const title = t => t.charAt(0).toUpperCase() + t.slice(1);
  return { live: true, word: types.join(", "), detail: types.map(title).join(" and ") };
}

/**
 * THE IGNORED RESISTANCE (Elemental Adept, Poisoner): the row's types this damage carries that the
 * target actually resists — the ones worth saying on the receipt. The ignoring itself is dnd5e's.
 * @param {{type?: string|null, value?: number}[]} damages
 * @param {string[]} types      the row's types
 * @param {Iterable<string>} resisted  the target's Resistance types
 * @returns {string[]}
 */
export function ignoredResistances(damages, types, resisted) {
  const dr = new Set(resisted ?? []);
  const kinds = new Set(types ?? []);
  const out = [];
  for ( const d of (damages ?? []) ) {
    const t = d?.type;
    if ( t && kinds.has(t) && dr.has(t) && ((Number(d?.value) || 0) > 0) && !out.includes(t) ) out.push(t);
  }
  return out;
}

/**
 * THE BLOCK (Heavy Armor Master): the attack's parts of the listed types cut by `amount` in all —
 * "any Bludgeoning, Piercing, and Slashing damage dealt to you by that attack is reduced by" one
 * number, not one per type — taken from the parts in order, never below 0. Other types stand.
 * @param {{value: number, type?: string|null}[]} damages
 * @param {string[]} types
 * @param {number} amount
 * @returns {{values: number[], cut: number}}  each part's new value, in order, and what was taken
 */
export function blockDamages(damages, types, amount) {
  let left = Math.max(0, Math.floor(Number(amount) || 0));
  const kinds = new Set(types ?? []);
  const values = (damages ?? []).map(d => {
    const v = Number(d?.value) || 0;
    if ( !left || !kinds.has(d?.type) || (v <= 0) ) return v;
    const take = Math.min(v, left);
    left -= take;
    return v - take;
  });
  return { values, cut: Math.max(0, Math.floor(Number(amount) || 0)) - left };
}

/**
 * What a damage floor raised, off the evaluated rolls' JSON: every die result below the floor that
 * the `min` modifier lifted (Foundry keeps the face in `result` and the counted value in `count`).
 * @param {object[]} rolls    evaluated rolls, as JSON
 * @param {number} minimum
 * @returns {{raised: {from: number, to: number}[], gain: number}}
 */
export function raisedOf(rolls, minimum) {
  const raised = [];
  const walk = terms => {
    for ( const t of (terms ?? []) ) {
      if ( Array.isArray(t?.terms) ) walk(t.terms);           // a pool or a parenthetical
      if ( Array.isArray(t?.rolls) ) for ( const r of t.rolls ) walk(r?.terms);
      if ( !Array.isArray(t?.results) || !(t.modifiers ?? []).some(m => /^min\d+$/i.test(m)) ) continue;
      for ( const r of t.results ) {
        if ( (r?.active === false) || (r?.discarded === true) ) continue;
        const face = Number(r?.result), counted = Number(r?.count);
        if ( Number.isFinite(face) && Number.isFinite(counted) && (face < minimum) && (counted > face) ) {
          raised.push({ from: face, to: counted });
        }
      }
    }
  };
  for ( const roll of (rolls ?? []) ) walk(roll?.terms);
  return { raised, gain: raised.reduce((sum, r) => sum + (r.to - r.from), 0) };
}

/**
 * The damage card's line for one style that changed a roll.
 * @param {{feature: string, gain: number, raised?: {from: number, to: number}[], note?: string}} entry
 * @returns {string}
 */
export function styleLine(entry) {
  if ( entry?.raised?.length ) {
    const faces = [...new Set(entry.raised.map(r => r.from))].sort((a, b) => a - b).join(" and ");
    return `${entry.feature} — ${faces} → ${entry.raised[0].to}: +${entry.gain}`;
  }
  return `${entry.feature} — +${entry.gain}${entry.note ? ` ${entry.note}` : ""}`;
}

/*
 * THE DICE (RULINGS *The dice that rise*): the card line and the canvas show the damage dice as
 * chips; a die Great Weapon Fighting raised turns over from its face to what it counts, and a
 * flat bonus (Dueling, Thrown, Two-Weapon) is one more chip. Nothing is invented for the show.
 */

/** Chips at most: a crit of 4d6 is 8; anything past this is summed into the row's own total. */
export const DICE_CAP = 12;

/**
 * Every die the damage rolled, in order, off the evaluated rolls' JSON: its size, what it counts,
 * and the face it showed when a floor raised it (the same test as raisedOf).
 * @param {object[]} rolls    evaluated rolls, as JSON
 * @param {number|null} [minimum]
 * @returns {{faces: number, v: number, was?: number}[]}
 */
export function diceOf(rolls, minimum = null) {
  const dice = [];
  const walk = terms => {
    for ( const t of (terms ?? []) ) {
      if ( Array.isArray(t?.terms) ) walk(t.terms);
      if ( Array.isArray(t?.rolls) ) for ( const r of t.rolls ) walk(r?.terms);
      if ( !Array.isArray(t?.results) || !Number(t?.faces) ) continue;
      const floored = (t.modifiers ?? []).some(m => /^min\d+$/i.test(m));
      for ( const r of t.results ) {
        if ( (r?.active === false) || (r?.discarded === true) ) continue;
        const face = Number(r?.result), counted = Number.isFinite(Number(r?.count)) ? Number(r.count) : face;
        if ( !Number.isFinite(face) ) continue;
        const raised = floored && Number.isFinite(minimum) && (face < minimum) && (counted > face);
        dice.push(raised ? { faces: Number(t.faces), v: counted, was: face } : { faces: Number(t.faces), v: counted });
      }
    }
  };
  for ( const roll of (rolls ?? []) ) walk(roll?.terms);
  return dice.slice(0, DICE_CAP);
}

/**
 * One style's chips: the dice (the raised ones marked), then a flat bonus as its own chip. A style
 * that raised dice shows its gain after them; a flat one IS its chip.
 * @param {{gain: number, raised?: object[]}} entry
 * @param {{faces: number, v: number, was?: number}[]} dice
 * @returns {{chips: {label: string, was?: string, up?: boolean, flat?: boolean, faces?: number}[], after: string}}
 */
export function chipsOf(entry, dice) {
  const floor = !!entry?.raised?.length;
  const chips = (dice ?? []).map(d => (floor && Number.isFinite(d.was))
    ? { label: String(d.v), was: String(d.was), up: true, faces: d.faces }
    : { label: String(d.v), faces: d.faces });
  if ( !floor && (entry?.gain > 0) ) chips.push({ label: `+${entry.gain}`, flat: true, up: true });
  return { chips, after: floor ? `+${entry.gain}` : "" };
}

