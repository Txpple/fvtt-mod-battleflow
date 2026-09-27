// @ts-check
/**
 * Battle Flow — DECISION: Sneak Attack, and what Cunning Strike does to its dice (ARCHITECTURE.md
 * §2). Costs come off the dice BEFORE the roll, a crit doubles what is left. The arithmetic and the
 * reading, never the choice.
 */

/** A resolved "7d6" as dice and faces, else null (an unresolved `@scale` rolls ZERO, NOTES §2).
 * @param {string|null|undefined} formula
 * @returns {{number: number, faces: number}|null} */
export function parseDice(formula) {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*$/i.exec(String(formula ?? ""));
  if ( !m ) return null;
  const number = Number(m[1]);
  const faces = Number(m[2]);
  if ( !(number > 0) || !(faces > 0) ) return null;
  return { number, faces };
}

/** Does the WEAPON qualify (Finesse or Ranged)?
 * @param {{finesse?: boolean, ranged?: boolean}} weapon */
export function sneakWeaponQualifies({ finesse = false, ranged = false } = {}) {
  return !!finesse || !!ranged;
}

/** The box's default tick: Advantage, or a MEASURED ally near (`allyNear` true) without
 * Disadvantage; anything unmeasured stays the player's tick.
 * @param {{net: "advantage"|"disadvantage"|"normal", allyNear?: boolean|null}} roll */
export function sneakConditionsHold({ net, allyNear = null }) {
  if ( net === "advantage" ) return true;
  return (allyNear === true) && (net !== "disadvantage");
}

/** The Cunning Strike MENU: the sheet's options in table order, weapon-restricted rows (Rend
 * Mind) only for that weapon, an upgrade on the sheet (Envenom Weapons) carried.
 * @param {{options: Readonly<Record<string, any>>, features?: Iterable<string>, weaponName?: string,
 *          dice: number, improved?: string}} facts
 * @returns {{rows: {key: string, label: string, feature: string, activity: string|string[]|null, cost: number,
 *            rule: string, caveat?: string, line: boolean, affordable: boolean,
 *            upgrade?: {feature: string, activity: string, onFail?: string, effectFrom?: string, rule: string}}[], max: number}} */
export function cunningMenu({ options, features = [], weaponName = "", dice, improved = "Improved Cunning Strike" }) {
  const have = new Set([...features].map(f => String(f).toLowerCase()));
  const rows = [];
  for ( const [key, row] of Object.entries(options ?? {}) ) {
    if ( !have.has(String(row.feature).toLowerCase()) ) continue;
    if ( row.weapon && !String(weaponName).toLowerCase().includes(String(row.weapon).toLowerCase()) ) continue;
    const upgraded = row.upgrade && have.has(String(row.upgrade.feature).toLowerCase()) ? row.upgrade : null;
    rows.push({
      key, feature: row.feature, activity: upgraded ? upgraded.activity : row.activity, cost: row.cost,
      label: `${row.activity ?? row.rule.split(" (")[0]}${upgraded ? ` (${upgraded.feature})` : ""}`,
      rule: row.rule, ...(row.caveat ? { caveat: row.caveat } : {}),
      line: !row.activity, affordable: row.cost <= dice,
      ...(upgraded ? { upgrade: upgraded } : {})
    });
  }
  return { rows, max: have.has(String(improved).toLowerCase()) ? 2 : 1 };
}

/** The PICK: its cost, the dice left, and whether the rules allow it (at most `max`, affordable).
 * @param {{rows: {key: string, cost: number}[], chosen?: Iterable<string>, dice: number, max: number}} facts
 * @returns {{chosen: any[], cost: number, remaining: number, tooMany: boolean, tooDear: boolean}} */
export function cunningPick({ rows, chosen = [], dice, max }) {
  const wanted = new Set(chosen);
  const picked = rows.filter(r => wanted.has(r.key));
  const cost = picked.reduce((n, r) => n + (Number(r.cost) || 0), 0);
  return { chosen: picked, cost, remaining: Math.max(0, dice - cost), tooMany: picked.length > max, tooDear: cost > dice };
}

/** The sneak dice after the costs ("5d6"), or null when all are forgone (the effects still land).
 * @param {{number: number, faces: number, cost?: number}} dice */
export function sneakFormula({ number, faces, cost = 0 }) {
  const left = number - (Number(cost) || 0);
  return (left > 0) ? `${left}d${faces}` : null;
}
