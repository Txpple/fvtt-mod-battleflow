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

/**
 * Empowered's replay (group 3: "the rerolled dice flip to their new faces"): each die rerolled,
 * turning over from the face it showed to the one it rolled, over the caster.
 * @param {{done: {old: number, new: number}[], on: string}} args
 * @returns {{on: string, chips: object[]}|null}
 */
export function rerollRise({ done, on }) {
  const chips = (done ?? []).filter(d => Number.isFinite(Number(d?.old)) && Number.isFinite(Number(d?.new)))
    .map(d => ({ was: String(d.old), label: String(d.new), up: true }));
  return (on && chips.length) ? { on, chips } : null;
}

/**
 * Savage Attacker's replay (group 3: "the losing damage roll fades while the kept one glows"): the
 * two sets' totals, the one that stands gold and the other struck — the first on a tie, as the
 * rule's "the higher stands" keeps the roll already made.
 * @param {{first: number, second: number, stands: "first"|"second", on: string}} args
 * @returns {{on: string, chips: object[]}|null}
 */
export function eitherRise({ first, second, stands, on }) {
  if ( !on || !Number.isFinite(Number(first)) || !Number.isFinite(Number(second)) ) return null;
  const chip = (v, keep) => keep ? { label: String(v), up: true } : { label: String(v), drop: true };
  return { on, chips: [chip(first, stands !== "second"), chip(second, stands === "second")] };
}

/**
 * A d20 fold's die over the roller (group 4, the bumps: "one chip over the creature it helped"):
 *   a die added      Bardic Inspiration, Tactical Mind — one gold "+N"
 *   a reroll         Heroic Inspiration — the d20 turning over from its old face to the new
 *   Advantage after  Lucky — the two d20s, the higher gold and the other struck (a tie keeps the first)
 * @param {{mode: "die"|"reroll"|"advantage", oldFace?: number|null, newFace?: number|null, total?: number|null, on: string}} args
 * @returns {{on: string, chips: object[]}|null}
 */
export function foldRise({ mode, oldFace = null, newFace = null, total = null, on }) {
  if ( !on ) return null;
  const known = v => Number.isFinite(Number(v)) && (v !== null);
  if ( mode === "die" ) return known(total) && Number(total) ? { on, chips: [{ label: `+${Number(total)}`, flat: true, up: true }] } : null;
  if ( !known(oldFace) || !known(newFace) ) return null;
  if ( mode === "reroll" ) return { on, chips: [{ was: String(oldFace), label: String(newFace), up: true }] };
  const second = Number(newFace) > Number(oldFace);
  return { on, chips: [second ? { label: String(oldFace), drop: true } : { label: String(oldFace), up: true },
    second ? { label: String(newFace), up: true } : { label: String(newFace), drop: true }] };
}

/**
 * Shield's bump (group 4): one chip over the creature it saved — "+5 AC".
 * @param {number|null} bonus
 * @returns {{label: string, flat: boolean, up: boolean}[]}
 */
export const acChips = bonus => (Number(bonus) > 0) ? [{ label: `+${Number(bonus)} AC`, flat: true, up: true }] : [];
