/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE DICE CHIPS — which dice rise on the canvas, and
 * how, for the rules whose dice CHANGE NUMBER (the user, 2026-09-26: "only apply it to 'dice number
 * changes'"): a die turning over (Empowered's and Healer's rerolls, Heroic Inspiration's d20), a
 * d20 swapped (Lucky's second), a set rolled again (Savage Attacker) — and ("a reaction that
 * modifies a roll") whatever answers a roll already made: a reduction, Shield's AC, a fold's die.
 * A die added as the roll is MADE (Sneak Attack, Bless) stays on the card. The record a roll message carries is `flags.<module>.diceRise`; dice-rise.js draws
 * it. Pure: plain numbers in, plain chips out.
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
 * A REACTION THAT MODIFIES A ROLL — a reduction (Interception, Parry, Stone's Endurance). Its roll
 * message carries this (`flags.<module>.diceRise`): the chips rise over
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
 * A d20 fold over the roller — each modifies a roll already made:
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
 * THE DICE THE PLATFORM CHANGED (the user, 2026-09-26, option A): a die dnd5e or Foundry rerolled
 * or floored on its own — Halfling Luck's natural 1 (`r1=1`), Reliable Talent's 10 (`min10`),
 * Elemental Adept's 2s, Tavern Brawler's 1s, any rule built on the same modifiers. Each turns over
 * from the face it showed to the one that counts. Off the evaluated rolls' JSON: a rerolled result
 * pairs with the next live result of its term; a floored one shows its face and its count.
 * @param {object[]} rolls   evaluated rolls, as JSON
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
        // A floor is marked `rerolled` too (dnd5e 6.0.5, probe-changed-dice: `min10` leaves the one
        // live die `rerolled: true, count: 10`) - only a retired result pairs with a later one.
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
 * Shield's answer (a reaction that modifies a roll — the attack's, against a higher AC): one chip
 * over the creature it saved, "+5 AC"; none when the sheet cannot state the bonus.
 * @param {number|null} bonus
 * @returns {{label: string, flat: boolean, up: boolean}[]}
 */
export const acChips = bonus => (Number(bonus) > 0) ? [{ label: `+${Number(bonus)} AC`, flat: true, up: true }] : [];
