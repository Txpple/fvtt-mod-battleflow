// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the turn-start grant (registry.js TURN_GRANTS) —
 * which row a landed effect answers, whether this turn is paid, and the card's words. No `game`.
 */
const lower = (/** @type {unknown} */ s) => String(s ?? "").toLowerCase();

/**
 * THE ROW a landed effect answers: its ORIGIN item answers the row's key and its name is the row's effect.
 * `answers` is the registry's row matcher.
 * @param {{table: Readonly<Record<string, any>>, item: any, effectName: string|null|undefined, listed?: Set<string>|null,
 *          answers: (key: string, item: any) => boolean}} facts
 * @returns {any|null}   the row spread over `{ key }`
 */
export function grantRowFor({ table, item, effectName, listed = null, answers }) {
  if ( !item || !effectName ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( listed && !listed.has(key.toLowerCase()) ) continue;
    if ( !answers(key, item) ) continue;
    if ( lower(row.effect) !== lower(effectName) ) continue;
    return { key, ...row };
  }
  return null;
}

/**
 * Once per turn: a place (`combat|round|turn`) already paid pays nothing; no place, no turn.
 * @param {{paid: Set<string>, place: string|null}} facts
 * @returns {{due: boolean, why: string}}
 */
export function grantDue({ paid, place }) {
  if ( !place ) return { due: false, why: "no running turn" };
  if ( paid.has(place) ) return { due: false, why: "paid this turn" };
  return { due: true, why: "the start of its turn" };
}

/**
 * The card's title.
 * @param {{spell: string, bearer: string, total: number, type: string}} facts
 */
export function grantTitle({ spell, bearer, total, type }) {
  const n = Number(total) || 0;
  if ( type === "temphp" ) return `${spell} — ${bearer} gains ${n} Temporary Hit Point${n === 1 ? "" : "s"}`;
  return `${spell} — ${bearer} regains ${n} Hit Point${n === 1 ? "" : "s"}`;
}
