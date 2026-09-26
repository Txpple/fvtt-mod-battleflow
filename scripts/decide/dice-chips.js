/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE DICE CHIPS — a roll as the chips dice-rise.js
 * draws, and the record a roll message carries to have them drawn (the user, 2026-09-26: "rebuild
 * the shape"; group 2, the damage reducers: "the reduction roll rises off the guard's token, then a
 * −7 chip drifts to the ally it protected"). Pure: plain roll JSON in, plain chips out.
 */

/** A die term's results that count, off the evaluated roll's JSON (a pool or parenthetical walked). */
function diceResults(terms, out = []) {
  for ( const t of (terms ?? []) ) {
    if ( Array.isArray(t?.terms) ) diceResults(t.terms, out);
    if ( Array.isArray(t?.rolls) ) for ( const r of t.rolls ) diceResults(r?.terms, out);
    if ( !Array.isArray(t?.results) || !Number(t?.faces) ) continue;
    for ( const r of t.results ) {
      if ( (r?.active === false) || (r?.discarded === true) ) continue;
      const v = Number.isFinite(Number(r?.count)) ? Number(r.count) : Number(r?.result);
      if ( Number.isFinite(v) ) out.push(v);
    }
  }
  return out;
}

/**
 * A roll as chips: each die that counts, then what the formula added on top as one gold bonus chip
 * ("+3" — a proficiency bonus, a modifier). A roll of nothing but a number is its one chip.
 * @param {{terms?: object[], total?: number}} roll   an evaluated roll, as JSON
 * @param {number} [cap]
 * @returns {{label: string, up?: boolean, flat?: boolean}[]}
 */
export function rollChips(roll, cap = 8) {
  const dice = diceResults(roll?.terms);
  const total = Number(roll?.total);
  const rest = Number.isFinite(total) ? total - dice.reduce((a, b) => a + b, 0) : 0;
  const chips = dice.slice(0, cap).map(v => ({ label: String(v) }));
  if ( rest ) chips.push({ label: `${rest > 0 ? "+" : "−"}${Math.abs(rest)}`, flat: true, up: true });
  return chips;
}

/**
 * The record a reduction's roll message carries (`flags.<module>.diceRise`): the chips rise over
 * the creature who reduced it, then the reduction drifts to the creature it protected — the same
 * creature for a reduction of one's own (Parry, Stone's Endurance), which pops the number in place.
 * @param {{roll: object, from: string, to?: string|null}} args   the roll as JSON; actor uuids
 * @returns {{on: string, chips: object[], drift: {to: string, label: string}}|null}
 */
export function reductionRise({ roll, from, to = null }) {
  const total = Math.max(0, Number(roll?.total) || 0);
  if ( !from || !total ) return null;
  return { on: from, chips: rollChips(roll), drift: { to: to || from, label: `−${total}` } };
}
