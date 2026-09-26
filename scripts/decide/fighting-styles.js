/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE FIGHTING STYLES' arithmetic — what the owner
 * holds, whether a style's face is live, whether a roll fits it, and what a damage floor raised.
 * Pure: plain facts in, plain answers out; fighting-styles.js reads the sheet and the roll.
 * The rows are decide/registry.js FIGHTING_STYLES (user, 2026-09-26).
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
 */

/**
 * What the owner HOLDS and WEARS, off the sheet's Equipped boxes — "holding" is equipped (the
 * prototype's ruling). A natural weapon (a claw, the Unarmed Strike) is never held.
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
const isMelee = item => MELEE.has(item?.kind);

/**
 * A style's face: live, or off with the reason. `word` is the panel's one word in parens
 * ("Fighting Style: Great Weapon Fighting (greatsword)" — user, 2026-09-26: "i only want one
 * line"); `detail` the long line, kept for the hover title ("a second weapon held (Dagger)").
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
    // equipped to be thrown (user, 2026-09-26: "the user selects the thrown attack mode")
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
 * @param {{kind?: string, properties?: string[], mode?: string|null, mod?: number, faceLive?: boolean}} roll
 * @returns {boolean}
 */
export function rollFits(gate, roll) {
  const mode = roll?.mode || (has(roll, "two") ? "twoHanded" : "oneHanded");
  switch ( gate ) {
    case "twoHanded": return isMelee(roll) && (mode === "twoHanded") && (has(roll, "two") || has(roll, "ver"));
    case "thrown": return ((mode === "thrown") || (mode === "thrown-offhand")) && has(roll, "thr");
    // dnd5e keeps a NEGATIVE modifier on the off-hand already; the style adds only what it dropped
    case "offhand": return ((mode === "offhand") || (mode === "thrown-offhand")) && (Number(roll?.mod) > 0);
    case "oneHanded": return isMelee(roll) && (mode === "oneHanded") && (roll?.faceLive === true);
    default: return false;
  }
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

/** The floating number over the target: "+3 Great Weapon Fighting", one per style that changed the roll. */
export const floatText = entry => `+${entry.gain} ${entry.feature}`;

/**
 * The float when an equip change changes what a face DOES (user, 2026-09-26: "if i do an equip
 * change that changes the effect needs floating white text"): on or off; for Unarmed Fighting,
 * which never goes off, the die. A new item that keeps the face as it was (Chain Mail for Plate)
 * floats nothing.
 * @param {{name: string, gate: string, live: boolean, word: string, liveChanged: boolean, wordChanged: boolean}} face
 * @returns {string|null}
 */
export function faceFloat({ name, gate, live, word, liveChanged, wordChanged }) {
  if ( gate === "unarmed" ) return wordChanged && word ? `${name} ${word}` : null;
  return liveChanged ? `${name} ${live ? "on" : "off"}` : null;
}
