// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the duplicates (registry.js DUPLICATES, the spells
 * slice's Tier 3) — a hit rolled against the standing duplicates after the verdict: the dice,
 * which face redirects, who sees through, the chips and the words. The row an effect answers is
 * `repeatRowFor` (decide/repeat-saves.js). No `game`, no settings: hold/* reads the world.
 */

/**
 * The duplicate effects standing on the defender, in the row's order (the one destroyed is the LAST).
 * @param {{effect: string|readonly string[]}} row
 * @param {{id: string, name: string, active?: boolean}[]} effects   the defender's effects
 */
export function standingDuplicates(row, effects) {
  const names = (Array.isArray(row.effect) ? row.effect : [row.effect]).map(n => String(n).toLowerCase());
  return (effects ?? []).filter(e => (e.active !== false) && names.includes(String(e.name ?? "").toLowerCase()))
    .sort((a, b) => names.indexOf(String(a.name).toLowerCase()) - names.indexOf(String(b.name).toLowerCase()));
}

/**
 * Does the ATTACKER see through the duplicates? A status it wears, or a sense with range.
 * @param {{seesThrough?: {statuses?: readonly string[], senses?: readonly string[]}}} row
 * @param {{statuses?: Iterable<string>, senses?: Record<string, number|null|undefined>}} attacker
 * @returns {{through: boolean, why: string|null}}
 */
export function seesThrough(row, { statuses = [], senses = {} }) {
  const set = new Set([...(statuses ?? [])].map(s => String(s).toLowerCase()));
  for ( const s of row?.seesThrough?.statuses ?? [] ) if ( set.has(String(s).toLowerCase()) ) return { through: true, why: `the ${cap(s)} condition` };
  for ( const s of row?.seesThrough?.senses ?? [] ) if ( Number(senses?.[s]) > 0 ) return { through: true, why: cap(s) };
  return { through: false, why: null };
}

const cap = s => `${String(s).charAt(0).toUpperCase()}${String(s).slice(1)}`;

/**
 * THE ROLL: one die per standing duplicate; any face at `at` or higher redirects the hit to one of them.
 * @param {{at: number}} row
 * @param {number[]} faces   in the order rolled
 * @returns {{absorbed: boolean, winner: number|null, faces: number[]}}   `winner` the index of the first face that redirects
 */
export function duplicateOutcome(row, faces) {
  const list = (faces ?? []).map(Number).filter(Number.isFinite);
  const winner = list.findIndex(f => f >= Number(row?.at));
  return { absorbed: winner >= 0, winner: (winner >= 0) ? winner : null, faces: list };
}

/**
 * THE DICE FOR THE CANVAS: every face, the first that redirects gold; on a hit that got through, every face plain.
 * @param {{absorbed: boolean, winner: number|null, faces: number[]}} outcome
 * @returns {{label: string, up?: boolean}[]}
 */
export function duplicateChips(outcome) {
  return (outcome?.faces ?? []).map((f, i) => (i === outcome.winner) ? { label: String(f), up: true } : { label: String(f) });
}

/**
 * The words: the dice line, the headline, the count that stands after.
 * @param {{key: string, die: number, at: number}} row
 * @param {{absorbed: boolean, winner: number|null, faces: number[]}} outcome
 * @param {{took: string|null, left: number, of: number}} count   `took` the destroyed duplicate's name
 */
export function duplicateWords(row, outcome, { took, left, of }) {
  const n = outcome.faces.length;
  const faces = outcome.faces.map((f, i) => (i === outcome.winner) ? `<strong>${f}</strong>` : String(f)).join(", ");
  const dice = `${n}d${row.die} → ${faces} — ${outcome.absorbed ? `a ${row.at} or higher: <strong>the duplicate is destroyed</strong>, no damage to you` : `none ${row.at} or higher: <strong>you are hit</strong>`}`;
  const title = outcome.absorbed ? (left === 0 ? "The last duplicate takes the hit" : "A duplicate takes the hit") : "The hit gets through";
  const count = (outcome.absorbed && (left === 0)) ? `<strong>${row.key} ended</strong> — every duplicate is gone` : `duplicates: ${left} of ${of} left`;
  return { title, dice, count, took };
}
