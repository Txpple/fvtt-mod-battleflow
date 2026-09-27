// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): is a DAMAGE SHIELD due — the hit rider MIRRORED
 * (RULINGS *Damage shields*): the DEFENDER's standing effect strikes the ATTACKER on a melee hit.
 */

/** Due on THIS hit? `within` null = no distance clause; `distanceFeet` null = unmeasured (never strikes).
 * @param {{melee?: boolean, when?: "oncePerTurn"|null, while?: "tempHP"|null}} row
 * @param {{melee?: boolean, distanceFeet?: number|null, within?: number|null, inCombat?: boolean,
 *          chitStands?: boolean, tempHP?: number|null}} facts
 * @returns {{due: boolean, why: string}} */
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

/** An activity's reach in FEET (metres folded), else null — any other unit is never guessed.
 * @param {{value?: number|string|null, units?: string|null}|null|undefined} range
 * @returns {number|null} */
export function shieldReach(range) {
  if ( !range ) return null;
  const v = Number(range.value);
  if ( !Number.isFinite(v) || (v <= 0) ) return null;
  if ( range.units === "ft" ) return v;
  if ( range.units === "m" ) return Math.round(v * 3.28084);
  return null;
}

/** The type a mapped `effect` decides (Fire Shield: Warm burns, Chill freezes); null = the part's own.
 * @param {{effect?: string|Readonly<Record<string, string|null>>|null}} row
 * @param {string} effectName
 * @returns {string|null} */
export function shieldType(row, effectName) {
  if ( !row.effect || (typeof row.effect === "string") ) return null;
  const map = row.effect;
  const key = Object.keys(map).find(k => k.toLowerCase() === String(effectName ?? "").toLowerCase());
  return key ? (map[key] ?? null) : null;
}

/** The effect names a row reads on the defender's sheet, lower-cased.
 * @param {{effect?: string|Readonly<Record<string, string|null>>|null}} row
 * @returns {string[]} */
export function shieldEffectNames(row) {
  if ( !row.effect ) return [];
  return (typeof row.effect === "string") ? [row.effect.toLowerCase()] : Object.keys(row.effect).map(k => k.toLowerCase());
}

/** An item's duration in world-clock SECONDS (a MARK chip's window), else null.
 * @param {{value?: number|string|null, units?: string|null}|null|undefined} duration
 * @returns {number|null} */
export function durationSeconds(duration) {
  const v = Number(duration?.value);
  if ( !Number.isFinite(v) || (v <= 0) ) return null;
  const per = { second: 1, round: 6, turn: 6, minute: 60, hour: 3600, day: 86400 }[String(duration?.units ?? "")];
  return per ? v * per : null;
}
