// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): is a clock rider (registry.js CLOCK_RIDERS) DUE on
 * this hit — its ROUND or TURN condition, read by the EDGE off the combat — and why not.
 */

/** `opportunity`: "driven" (the module drove an Opportunity Attack), "offTurn" (a melee attack off
 * the attacker's combat turn), or null.
 * @param {{when: "oncePerTurn"|"firstRound"|"any", uses?: boolean, requires?: string, judge?: string, weapon?: boolean,
 *          dealt?: string, crit?: boolean}} row
 * @param {{inCombat?: boolean, round?: number|null, chitStands?: boolean, usesLeft?: number|null,
 *          sneakArmed?: boolean, raging?: boolean, weapon?: boolean, form?: string|null,
 *          dealt?: string[], critical?: boolean, opportunity?: "driven"|"offTurn"|null}} facts
 * @returns {{due: boolean, why: string}} */
export function riderDue(row, { inCombat = false, round = null, chitStands = false, usesLeft = null,
  sneakArmed = false, raging = false, weapon = false, form = null, dealt = [], critical = false, opportunity = null } = {}) {
  if ( row.weapon && !weapon ) return { due: false, why: "not a weapon attack" };
  if ( row.dealt && !(dealt ?? []).includes(row.dealt) ) return { due: false, why: `no ${row.dealt} damage` };
  if ( row.crit && !critical ) return { due: false, why: "not a Critical Hit" };
  if ( (row.requires === "sneak") && !sneakArmed ) return { due: false, why: "no Sneak Attack armed on this hit" };
  if ( (row.judge === "raging") && !raging ) return { due: false, why: "not raging" };
  if ( (row.judge === "transformed") && !form ) return { due: false, why: "not transformed" };
  if ( row.judge === "opportunity" ) {
    if ( opportunity === "driven" ) return { due: true, why: "an Opportunity Attack" };
    if ( opportunity === "offTurn" ) return { due: true, why: "a melee attack off your turn" };
    return { due: false, why: "not an Opportunity Attack" };
  }
  if ( row.uses && !((usesLeft ?? 0) > 0) ) return { due: false, why: "no uses left" };
  switch ( row.when ) {
    case "firstRound":
      if ( !inCombat ) return { due: false, why: "not in combat — there is no first round" };
      if ( round !== 1 ) return { due: false, why: `round ${round}, not the first` };
      return { due: true, why: "the first round of the combat" };
    case "oncePerTurn":
      if ( chitStands ) return { due: false, why: "already used this turn" };
      if ( form ) return { due: true, why: inCombat ? `${form} — once this turn` : `${form} — out of combat, every hit` };
      return { due: true, why: inCombat ? "once this turn" : "out of combat — every hit" };
    // Every hit, uses permitting (Fire's Burn): the use is the only clock.
    case "any":
      if ( row.crit ) return { due: true, why: `a Critical Hit that deals ${row.dealt ?? "damage"}` };
      return { due: true, why: "on any hit, while its uses last" };
    default:
      return { due: false, why: `an unknown clock "${row.when}"` };
  }
}

/** A damage part's formula as written: dice, custom, bonus, or a bonus alone (Assassinate); null = none.
 * @param {{number?: number|null, denomination?: number|null, custom?: {enabled?: boolean, formula?: string}|null, bonus?: string|null}} part
 * @returns {string|null} */
export function riderPartFormula({ number = null, denomination = null, custom = null, bonus = null } = {}) {
  let base = null;
  if ( custom?.enabled && String(custom.formula ?? "").trim() ) base = String(custom.formula).trim();
  else if ( (Number(number) > 0) && (Number(denomination) > 0) ) base = `${Number(number)}d${Number(denomination)}`;
  const extra = String(bonus ?? "").trim();
  if ( base && extra ) return `${base} + ${extra}`;
  return base ?? (extra || null);
}

/** WHERE A RIDER'S USES LIVE: the ACTIVITY's with a max, else for a `uses` row the ITEM's (species packs).
 * @param {{activity?: {max?: unknown, value?: unknown, spent?: unknown}|null,
 *          item?: {max?: unknown, value?: unknown, spent?: unknown}|null, uses?: boolean}} facts
 * @returns {{left: number, max: number, spent: number, on: "activity"|"item"}|null} */
export function riderUsesFrom({ activity = null, item = null, uses = false } = {}) {
  const carries = u => !!u && !((u.max === "") || (u.max === null) || (u.max === undefined));
  const read = (u, on) => ({ left: Number(u.value ?? 0) || 0, max: Number(u.max) || 0, spent: Number(u.spent ?? 0) || 0, on });
  if ( carries(activity) ) return read(activity, "activity");
  if ( uses && carries(item) ) return read(item, "item");
  return null;
}

/** WHICH FORM STANDS (Celestial Revelation): by its effect's name, or by the module's form chip —
 * never by name — for Necrotic Shroud, so one frightened BY a Shroud is not read as wearing one.
 * @param {{forms?: ReadonlyArray<{form: string, effect?: string, chip?: string, type: string}>}} row
 * @param {Array<{name: string, active: boolean, chip: string|null}>} effects
 * @returns {{form: string, effect?: string, chip?: string, type: string}|null} */
export function standingForm(row, effects) {
  const lc = v => String(v ?? "").toLowerCase();
  for ( const f of row?.forms ?? [] ) {
    const marked = (effects ?? []).some(e => e?.active && (f.chip
      ? (e.chip === lc(f.form))
      : (!e.chip && (lc(e.name) === lc(f.effect)))));
    if ( marked ) return f;
  }
  return null;
}
