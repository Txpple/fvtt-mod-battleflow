// @ts-check
/**
 * Battle Flow — DECISION: is a DAMAGE SHIELD due on this hit, and what does it strike with?
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE NINTH SHAPE (user, 2026-09-04: "death armor needs its damage shield effect automated") —
 * the hit rider MIRRORED: a standing effect on the DEFENDER pays out against the ATTACKER when
 * a melee attack roll hits, with no choice in it (R1 automates outcomes). What is decided here
 * is whether the rules say the shield strikes on THIS hit — a melee attack roll, within the
 * activity's own reach, once per turn where the text says so, while the pool the spell rides
 * still stands — and why not otherwise. The dice are the pack's activity, rolled by the EDGE.
 */

/**
 * @param {{melee?: boolean, when?: "oncePerTurn"|null, while?: "tempHP"|null}} row
 * @param {{melee?: boolean, distanceFeet?: number|null, within?: number|null, inCombat?: boolean,
 *          chitStands?: boolean, tempHP?: number|null}} facts
 *        `within` = the activity's own reach in feet (null: no distance clause);
 *        `distanceFeet` = attacker to defender (null: could not be measured)
 * @returns {{due: boolean, why: string}}
 */
export function shieldDue(row, { melee = false, distanceFeet = null, within = null, inCombat = false,
  chitStands = false, tempHP = null } = {}) {
  if ( row.melee && !melee ) return { due: false, why: "not a melee attack roll" };
  if ( (within !== null) && (within !== undefined) ) {
    if ( (distanceFeet === null) || (distanceFeet === undefined) ) return { due: false, why: `the distance could not be measured (within ${within} feet)` };
    if ( distanceFeet > within ) return { due: false, why: `${distanceFeet} feet away — beyond ${within}` };
  }
  if ( (row.while === "tempHP") && !((tempHP ?? 0) > 0) ) return { due: false, why: "no Temporary Hit Points left — the spell has ended" };
  if ( (row.when === "oncePerTurn") && chitStands ) return { due: false, why: "already struck this turn" };
  const why = (row.when === "oncePerTurn")
    ? (inCombat ? "once this turn" : "out of combat — every hit")
    : "every melee hit";
  return { due: true, why };
}

/**
 * An activity's reach as a distance in FEET, or null when it carries no distance clause (self,
 * any, touch, a blank). Metres are folded to feet; any other unit is "no clause" rather than a
 * guess — an unmeasurable clause must never strike.
 * @param {{value?: number|string|null, units?: string|null}|null|undefined} range
 * @returns {number|null}
 */
export function shieldReach(range) {
  if ( !range ) return null;
  const v = Number(range.value);
  if ( !Number.isFinite(v) || (v <= 0) ) return null;
  if ( range.units === "ft" ) return v;
  if ( range.units === "m" ) return Math.round(v * 3.28084);
  return null;
}

/**
 * The damage type the standing effect decides — Fire Shield's Warm Shield burns, its Chill
 * Shield freezes (the row's `effect` is a map from effect name to type); a row whose effect is
 * one name leaves the type to the activity's own part (null).
 * @param {{effect?: string|Readonly<Record<string, string|null>>|null}} row
 * @param {string} effectName
 * @returns {string|null}
 */
export function shieldType(row, effectName) {
  if ( !row.effect || (typeof row.effect === "string") ) return null;
  const map = row.effect;
  const key = Object.keys(map).find(k => k.toLowerCase() === String(effectName ?? "").toLowerCase());
  return key ? (map[key] ?? null) : null;
}

/**
 * The effect names a row reads on the defender's sheet, lower-cased.
 * @param {{effect?: string|Readonly<Record<string, string|null>>|null}} row
 * @returns {string[]}
 */
export function shieldEffectNames(row) {
  if ( !row.effect ) return [];
  return (typeof row.effect === "string") ? [row.effect.toLowerCase()] : Object.keys(row.effect).map(k => k.toLowerCase());
}

/**
 * An item's duration as SECONDS on the world clock — the window a MARK chip carries (Armor of
 * Agathys: 1 hour). Null for a duration the clock cannot measure (instantaneous, special, none).
 * @param {{value?: number|string|null, units?: string|null}|null|undefined} duration
 * @returns {number|null}
 */
export function durationSeconds(duration) {
  const v = Number(duration?.value);
  if ( !Number.isFinite(v) || (v <= 0) ) return null;
  const per = { second: 1, round: 6, turn: 6, minute: 60, hour: 3600, day: 86400 }[String(duration?.units ?? "")];
  return per ? v * per : null;
}
