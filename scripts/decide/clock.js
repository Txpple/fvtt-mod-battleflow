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
 * @param {{when: "oncePerTurn"|"firstRound"|"any", uses?: boolean, requires?: string, judge?: string, weapon?: boolean}} row
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
    // Every hit, uses permitting (Slice A, 2026-09-24 — Fire's Burn, Frost's Chill): the use is
    // the only clock, judged above.
    case "any":
      return { due: true, why: "on any hit, while its uses last" };
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

/**
 * WHERE A RIDER'S USES LIVE (Slice A, 2026-09-24): the ACTIVITY's own when it carries a max
 * (Dreadful Strike), else — for a `uses` row — the ITEM its consumption names (the species packs
 * put every use on the item: Fire's Burn, Frost's Chill). Null when neither carries a max. The
 * EDGE reads the two shapes off the sheet and writes the spend back where `on` says.
 * @param {{activity?: {max?: unknown, value?: unknown, spent?: unknown}|null,
 *          item?: {max?: unknown, value?: unknown, spent?: unknown}|null, uses?: boolean}} facts
 * @returns {{left: number, max: number, spent: number, on: "activity"|"item"}|null}
 */
export function riderUsesFrom({ activity = null, item = null, uses = false } = {}) {
  const carries = u => !!u && !((u.max === "") || (u.max === null) || (u.max === undefined));
  const read = (u, on) => ({ left: Number(u.value ?? 0) || 0, max: Number(u.max) || 0, spent: Number(u.spent ?? 0) || 0, on });
  if ( carries(activity) ) return read(activity, "activity");
  if ( uses && carries(item) ) return read(item, "item");
  return null;
}
