// @ts-check
/**
 * By the Books — DECISION layer (ARCHITECTURE.md §2): THE SHARED GALLERY — the rows a creature pool
 * allows, for every machine that picks a creature by rule rather than by profile: a `cr`-mode summon
 * (Find Familiar, Wild Companion) and Wild Shape's and the polymorph spells' forms (issues #1, #2; the
 * row shape ruled C, RULINGS *Summons*). ⚠ PURE: no `game`, no imports.
 */

/** The books a shared name is taken from, in order of preference; a pack not listed comes after them. */
export const BOOK_ORDER = Object.freeze(["dnd-monster-manual", "dnd-players-handbook", "dnd-dungeon-masters-guide"]);

const bookRank = pack => {
  const i = BOOK_ORDER.indexOf(String(pack ?? "").split(".")[0] ?? "");
  return i < 0 ? BOOK_ORDER.length : i;
};

/**
 * The rows a pool allows, one per name. A cap (`crMax`), the creature types, a fly rule (`fly: false`
 * drops fliers), the sizes and a name search narrow it; a name shipped by several books keeps the
 * preferred book's copy (`BOOK_ORDER`); the rest is by CR, then name.
 * @typedef {object} PoolRow
 * @property {string} name
 * @property {number} cr
 * @property {string} type       the creature type key
 * @property {string} size       the size key
 * @property {boolean} fly       whether it has a fly speed
 * @property {string} pack       the pack id
 * @property {string} uuid
 * @property {string|null} [img]
 * @param {PoolRow[]} pool
 * @param {{ crMax?: number|null, types?: string[]|null, fly?: boolean|null, sizes?: string[]|null, search?: string }} rule
 * @returns {PoolRow[]}
 */
export function galleryRows(pool, { crMax = null, types = null, fly = null, sizes = null, search = "" } = {}) {
  const q = String(search ?? "").trim().toLowerCase();
  const typeSet = types?.length ? new Set(types.map(t => String(t).toLowerCase())) : null;
  const sizeSet = sizes?.length ? new Set(sizes.map(s => String(s).toLowerCase())) : null;
  const best = new Map();
  for ( const r of pool ?? [] ) {
    if ( !r?.name || !r.uuid ) continue;
    const cr = Number(r.cr);
    if ( (crMax !== null) && !(Number.isFinite(cr) && (cr <= Number(crMax))) ) continue;
    if ( typeSet && !typeSet.has(String(r.type ?? "").toLowerCase()) ) continue;
    if ( (fly === false) && r.fly ) continue;
    if ( sizeSet && !sizeSet.has(String(r.size ?? "").toLowerCase()) ) continue;
    if ( q && !String(r.name).toLowerCase().includes(q) ) continue;
    const key = String(r.name).toLowerCase();
    const have = best.get(key);
    if ( !have || (bookRank(r.pack) < bookRank(have.pack)) ) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => (Number(a.cr) - Number(b.cr)) || String(a.name).localeCompare(String(b.name)));
}

/**
 * A CR as the books print it: ¼, ½, else the number.
 * @param {number|string|null|undefined} cr
 */
export function crLabel(cr) {
  if ( (cr === null) || (cr === undefined) || (cr === "") ) return "—";
  const n = Number(cr);
  if ( !Number.isFinite(n) ) return "—";
  if ( n === 0.125 ) return "⅛";
  if ( n === 0.25 ) return "¼";
  if ( n === 0.5 ) return "½";
  return String(n);
}
