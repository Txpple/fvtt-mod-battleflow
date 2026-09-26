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
 * A style's face: live, or off with the reason. `word` is the one-word state (the item, the
 * die, why it is off), kept on the face's record; the panel shows the name alone (user,
 * 2026-09-26). `detail` is the long line, the hover title ("a second weapon held (Dagger)").
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
    case "heavy": {
      const heavy = w.find(i => has(i, "hvy"));
      return heavy ? { live: true, word: lc(heavy), detail: `${heavy.name}, Heavy` }
        : { live: false, word: "unequipped", detail: "no Heavy weapon equipped" };
    }
    case "heavyArmor":
      return (held?.armor?.kind === "heavy") ? { live: true, word: lc(held.armor), detail: held.armor.name }
        : { live: false, word: held?.armor ? "not heavy" : "unarmored",
          detail: held?.armor ? `${held.armor.name} is not Heavy armor` : "no armor worn" };
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
    case "oneHanded": return isMelee(roll) && (mode === "oneHanded") && (roll?.faceLive === true);
    default: return false;
  }
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
 * THE DICE (L4 + F7, ruled 2026-09-26 off the Artifact "GWF Notice Options": "the empower where you
 * pick dice is fun, or savage attacker, but oviously for these it cant require clicks"). The card
 * line and the canvas both show the damage dice as Empowered's chips; a die Great Weapon Fighting
 * raised turns over from its face to what it counts, and a flat bonus (Dueling, Thrown, Two-Weapon)
 * is one more chip. The chips are the attack's own dice, so nothing is invented for the show.
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

