// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the drop-to-1 table's SAVE facet (Undead
 * Fortitude — the DC from the damage, the exemptions read off the damage card) and the words. Pure:
 * no `game`, no imports.
 */

/**
 * The DC a `save` facet computes: `"5 + damage"` (Undead Fortitude), or a number.
 * @param {string|number|null|undefined} spec
 * @param {number} amount   the damage taken (the application's own number)
 */
export function dropSaveDc(spec, amount) {
  const dmg = Math.max(0, Number(amount) || 0);
  if ( (spec === null) || (spec === undefined) || (spec === "") ) return 5 + dmg;
  if ( typeof spec === "number" ) return spec;
  const m = /^\s*(\d+)\s*\+\s*damage\s*$/i.exec(String(spec ?? ""));
  if ( m ) return Number(m[1]) + dmg;
  const n = Number(spec);
  return Number.isFinite(n) ? n : 5 + dmg;
}

/**
 * Does the damage EXEMPT the row (`unless`: damage types and/or `"crit"`)? ⚠ A damage card the module
 * cannot read counts the row — the gate never guesses an exemption (`readable: false` → not exempt).
 * @param {readonly string[]|null|undefined} unless
 * @param {{types?: readonly string[], crit?: boolean, readable?: boolean}} facts
 * @returns {{exempt: boolean, why: string|null}}
 */
export function dropSaveExempt(unless, { types = [], crit = false, readable = true } = {}) {
  const list = (unless ?? []).map(u => String(u).toLowerCase());
  if ( !list.length || !readable ) return { exempt: false, why: null };
  if ( crit && list.includes("crit") ) return { exempt: true, why: "a Critical Hit" };
  const hit = (types ?? []).map(t => String(t ?? "").toLowerCase()).find(t => t && list.includes(t));
  if ( hit ) return { exempt: true, why: `${hit.charAt(0).toUpperCase()}${hit.slice(1)} damage` };
  return { exempt: false, why: null };
}

/**
 * The card's title after the save rolled.
 * @param {{name: string, saved: boolean, total: number|null, dc: number}} facts
 */
export function dropSaveTitle({ name, saved, total, dc }) {
  const roll = (total === null || total === undefined) ? "" : ` (${total} vs DC ${dc})`;
  return saved ? `${name} saves${roll} — it drops to 1 Hit Point instead` : `${name} fails the save${roll} — it drops to 0`;
}

/**
 * A `died` row's card title: who is in the Emanation when the bearer dies.
 * @param {{row: string, name: string, count: number}} facts
 */
export function diedTitle({ row, name, count }) {
  const n = Number(count) || 0;
  return `${row} — ${name} dies: ${n === 0 ? "no creature in reach" : `${n} creature${n === 1 ? "" : "s"} save`}`;
}
