/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE DICE CHIPS — which dice rise on the canvas
 * (RULINGS *The dice that rise*). The record is `flags.<module>.diceRise`; dice-rise.js draws it.
 */

/** The die results that count, off an evaluated roll's JSON (pools and parentheticals walked). */
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
 * A roll as chips: each die that counts, then the flat rest as one gold "+N" chip.
 * @param {{terms?: object[], total?: number}} roll   as JSON
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
 * A reduction (Interception, Parry): chips over the reducer, the reduction drifting to the protected.
 * @param {{roll: object, from: string, to?: string|null}} args   actor uuids
 * @returns {{on: string, chips: object[], drift: {to: string, label: string}}|null}
 */
export function reductionRise({ roll, from, to = null }) {
  const total = Math.max(0, Number(roll?.total) || 0);
  if ( !from || !total ) return null;
  return { on: from, chips: rollChips(roll), drift: { to: to || from, label: `−${total}` } };
}

/**
 * A per-die reroll, each die turning over.
 * @param {{done: {old: number, new: number}[], on: string}} args
 * @returns {{on: string, chips: object[]}|null}
 */
export function rerollRise({ done, on }) {
  const chips = (done ?? []).filter(d => Number.isFinite(Number(d?.old)) && Number.isFinite(Number(d?.new)))
    .map(d => ({ was: String(d.old), label: String(d.new), up: true }));
  return (on && chips.length) ? { on, chips } : null;
}

/**
 * A set rolled again: the one that stands gold, the other struck.
 * @param {{first: number, second: number, stands: "first"|"second", on: string}} args
 * @returns {{on: string, chips: object[]}|null}
 */
export function eitherRise({ first, second, stands, on }) {
  if ( !on || !Number.isFinite(Number(first)) || !Number.isFinite(Number(second)) ) return null;
  const chip = (v, keep) => keep ? { label: String(v), up: true } : { label: String(v), drop: true };
  return { on, chips: [chip(first, stands !== "second"), chip(second, stands === "second")] };
}

/**
 * A d20 fold over the roller: a die added (a gold "+N"), a reroll (the d20 turning over), or
 * Advantage after (Lucky: the higher gold, the other struck).
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
 * THE DICE THE PLATFORM CHANGED on its own (a `r1=1` reroll, a `min10` floor), each turning over.
 * @param {object[]} rolls   as JSON
 * @param {number} [cap]
 * @returns {{was: string, label: string, up: boolean}[]}
 */
export function changedDice(rolls, cap = 8) {
  const chips = [];
  const walk = terms => {
    for ( const t of (terms ?? []) ) {
      if ( Array.isArray(t?.terms) ) walk(t.terms);
      if ( Array.isArray(t?.rolls) ) for ( const r of t.rolls ) walk(r?.terms);
      if ( !Array.isArray(t?.results) || !Number(t?.faces) ) continue;
      const results = t.results;
      const used = new Set();
      results.forEach((r, i) => {
        // ⚠ A floor is marked `rerolled` too (NOTES §2); only a retired result pairs with a later one.
        if ( r?.rerolled && (r?.active === false) ) {
          const j = results.findIndex((n, k) => (k > i) && !used.has(k) && !n?.rerolled && (n?.active !== false));
          if ( j < 0 ) return;
          used.add(j);
          const now = Number.isFinite(Number(results[j].count)) ? Number(results[j].count) : Number(results[j].result);
          chips.push({ was: String(r.result), label: String(now), up: true });
          return;
        }
        if ( used.has(i) || (r?.active === false) || r?.discarded ) return;
        const face = Number(r?.result), counted = Number(r?.count);
        if ( Number.isFinite(face) && Number.isFinite(counted) && (counted > face) ) chips.push({ was: String(face), label: String(counted), up: true });
      });
    }
  };
  for ( const roll of (rolls ?? []) ) walk(roll?.terms);
  return chips.slice(0, cap);
}

/**
 * Shield's answer: one "+5 AC" chip; none without a stated bonus.
 * @param {number|null} bonus
 * @returns {{label: string, flat: boolean, up: boolean}[]}
 */
export const acChips = bonus => (Number(bonus) > 0) ? [{ label: `+${Number(bonus)} AC`, flat: true, up: true }] : [];
