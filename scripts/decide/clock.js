// @ts-check
/**
 * Battle Flow — DECISION: is a clock rider DUE on this hit, and what does its part read as?
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * A clock rider's condition is the ROUND or the TURN (decide/registry.js CLOCK_RIDERS) — facts
 * the EDGE reads off the running combat and hands in plain. Nothing here decides for the
 * player (user ruling 2026-09-02: the rider is NOTIFIED and added; the roll is the roll); what
 * is decided is whether the rules say it applies right now, and why not when they do not.
 */

/**
 * @param {{when: "oncePerTurn"|"firstRound", uses?: boolean, requires?: string, judge?: string, weapon?: boolean}} row
 * @param {{inCombat?: boolean, round?: number|null, chitStands?: boolean, usesLeft?: number|null,
 *          sneakArmed?: boolean, raging?: boolean, weapon?: boolean}} facts
 * @returns {{due: boolean, why: string}}
 */
export function riderDue(row, { inCombat = false, round = null, chitStands = false, usesLeft = null,
  sneakArmed = false, raging = false, weapon = false } = {}) {
  if ( row.weapon && !weapon ) return { due: false, why: "not a weapon attack" };
  if ( (row.requires === "sneak") && !sneakArmed ) return { due: false, why: "no Sneak Attack armed on this hit" };
  if ( (row.judge === "raging") && !raging ) return { due: false, why: "not raging" };
  if ( row.uses && !((usesLeft ?? 0) > 0) ) return { due: false, why: "no uses left" };
  switch ( row.when ) {
    case "firstRound":
      if ( !inCombat ) return { due: false, why: "not in combat — there is no first round" };
      if ( round !== 1 ) return { due: false, why: `round ${round}, not the first` };
      return { due: true, why: "the first round of the combat" };
    case "oncePerTurn":
      if ( chitStands ) return { due: false, why: "already used this turn" };
      return { due: true, why: inCombat ? "once this turn" : "out of combat — every hit" };
    default:
      return { due: false, why: `an unknown clock "${row.when}"` };
  }
}

/**
 * A damage part's formula as the pack wrote it — plain dice, a custom formula, a bonus, or a
 * bonus alone (Assassinate's part is a blank die with `@classes.rogue.levels` as its bonus).
 * The EDGE resolves the tokens on the sheet and validates the result; null means no part.
 * @param {{number?: number|null, denomination?: number|null, custom?: {enabled?: boolean, formula?: string}|null, bonus?: string|null}} part
 * @returns {string|null}
 */
export function riderPartFormula({ number = null, denomination = null, custom = null, bonus = null } = {}) {
  let base = null;
  if ( custom?.enabled && String(custom.formula ?? "").trim() ) base = String(custom.formula).trim();
  else if ( (Number(number) > 0) && (Number(denomination) > 0) ) base = `${Number(number)}d${Number(denomination)}`;
  const extra = String(bonus ?? "").trim();
  if ( base && extra ) return `${base} + ${extra}`;
  return base ?? (extra || null);
}
