// @ts-check
/**
 * By the Books — DECISION layer (ARCHITECTURE.md §2): SUMMON ART — a table's own token and portrait for
 * a summoned creature, by spell then creature (RULINGS *Summons*, call 15). The art is keyed by NAME, so
 * an Owl from any book wears the same picture; it is read when a creature lands, so a familiar already
 * standing keeps its art until it is summoned again. A folder of files fills the blanks: `owl.webp` is
 * the Owl's token, `owl-portrait.webp` its portrait. ⚠ PURE: no `game`, no imports.
 */

/**
 * The spells the art window covers, in its order, each with the spell the creature list is read from.
 * One row per spell; the Summon spells and Wild Shape's forms join as rows.
 */
export const ART_SPELLS = Object.freeze([
  Object.freeze({ name: "Find Familiar", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplFindFamili" }),
  Object.freeze({ name: "Mage Hand", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplMageHand00" }),
  Object.freeze({ name: "Dancing Lights", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplDancingLig" }),
  Object.freeze({ name: "Unseen Servant", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplUnseenServ" }),
  Object.freeze({ name: "Light", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplLight00000" }),
  Object.freeze({ name: "Continual Flame", uuid: "Compendium.dnd-players-handbook.spells.Item.phbsplContinualF" })
]);

/** The file types a folder match reads as art. */
const IMAGE = /\.(webp|png|jpe?g|gif|svg|avif)$/i;

/**
 * A spell's or a creature's key in the stored table: lower case, spaces folded, no dots (a dot reads as
 * a path in a stored object).
 * @param {unknown} name
 * @returns {string}
 */
export const artKey = name => String(name ?? "").normalize("NFKC").replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The art set for a creature summoned by a spell: a token path and a portrait path, each null when the
 * table sets none.
 * @param {Record<string, Record<string, { token?: string|null, portrait?: string|null }>>|null|undefined} table
 * @param {string|null|undefined} spell
 * @param {string|null|undefined} creature
 * @returns {{ token: string|null, portrait: string|null }}
 */
export function artFor(table, spell, creature) {
  const entry = table?.[artKey(spell)]?.[artKey(creature)];
  const path = (/** @type {unknown} */ v) => ((typeof v === "string") && v.trim()) ? v.trim() : null;
  return { token: path(entry?.token), portrait: path(entry?.portrait) };
}

/**
 * The changes a summon's landing folds into dnd5e's own (`getChanges`): the token's texture with the
 * dynamic ring off, and the portrait as the actor's image (the token's delta, or the actor itself when
 * linked). Empty when the table sets nothing; the compendium's art stands.
 * ⚠ The books' tokens wear a dynamic ring, which draws the ring's own subject art over `texture.src`:
 * with the ring left on, the table's token never showed (the sandbox, a Raven).
 * @param {{ token: string|null, portrait: string|null }} art
 * @returns {{ tokenUpdates: { texture?: { src: string }, ring?: { enabled: boolean } }, actorUpdates: { img?: string } }}
 */
export function artChanges({ token, portrait }) {
  return { tokenUpdates: token ? { texture: { src: token }, ring: { enabled: false } } : {}, actorUpdates: portrait ? { img: portrait } : {} };
}

/**
 * A creature's name as a file stem: lower case, every run of other characters one dash ("Giant Owl"
 * → "giant-owl").
 * @param {unknown} name
 * @returns {string}
 */
export const fileStem = name => String(name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** A path's file name with its extension cut and its escapes read ("Giant%20Owl.webp" → "Giant Owl"). */
const baseOf = (/** @type {string} */ path) => {
  const file = String(path).split(/[\\/]/).pop() ?? "";
  let read = file;
  try { read = decodeURIComponent(file); } catch { /* a stray % keeps the name as written */ }
  return read.replace(/\.[^.]+$/, "");
};

/**
 * The art a folder's files give the creatures by name: `<stem>.<ext>` the token, `<stem>-portrait.<ext>`
 * the portrait, where the stem is the creature's name as `fileStem` writes it (a file named with spaces
 * or underscores matches the same way). Only images count; the first file a stem meets wins, in the
 * folder's own order.
 * @param {string[]} names    the creatures' names
 * @param {string[]} files    the folder's file paths
 * @returns {Record<string, { token: string|null, portrait: string|null }>}   keyed by `artKey`
 */
export function matchFiles(names, files) {
  /** @type {Map<string, string>} */
  const byStem = new Map();
  for ( const f of files ?? [] ) {
    if ( !IMAGE.test(String(f)) ) continue;
    const stem = fileStem(baseOf(f));
    if ( stem && !byStem.has(stem) ) byStem.set(stem, f);
  }
  /** @type {Record<string, { token: string|null, portrait: string|null }>} */
  const out = {};
  for ( const name of names ?? [] ) {
    const stem = fileStem(name);
    if ( !stem ) continue;
    const token = byStem.get(stem) ?? null;
    const portrait = byStem.get(`${stem}-portrait`) ?? null;
    if ( token || portrait ) out[artKey(name)] = { token, portrait };
  }
  return out;
}

/**
 * A spell's art with a folder's matches folded in: a field set by hand is kept, a blank one takes the
 * match. Returns the new entries and how many fields were filled.
 * @param {Record<string, { token?: string|null, portrait?: string|null }>} have
 * @param {Record<string, { token: string|null, portrait: string|null }>} matches
 * @returns {{ art: Record<string, { token: string|null, portrait: string|null }>, filled: number }}
 */
export function fillBlanks(have, matches) {
  /** @type {Record<string, { token: string|null, portrait: string|null }>} */
  const art = {};
  for ( const [k, v] of Object.entries(have ?? {}) ) art[k] = { token: v?.token || null, portrait: v?.portrait || null };
  let filled = 0;
  for ( const [k, m] of Object.entries(matches ?? {}) ) {
    const row = art[k] ?? { token: null, portrait: null };
    if ( !row.token && m.token ) { row.token = m.token; filled++; }
    if ( !row.portrait && m.portrait ) { row.portrait = m.portrait; filled++; }
    art[k] = row;
  }
  return { art, filled };
}

/**
 * The table as it is stored: every path trimmed, a creature with neither field dropped, a spell with no
 * creature dropped.
 * @param {Record<string, Record<string, { token?: string|null, portrait?: string|null }>>} table
 * @returns {Record<string, Record<string, { token?: string, portrait?: string }>>}
 */
export function cleanTable(table) {
  /** @type {Record<string, Record<string, { token?: string, portrait?: string }>>} */
  const out = {};
  for ( const [spell, creatures] of Object.entries(table ?? {}) ) {
    /** @type {Record<string, { token?: string, portrait?: string }>} */
    const kept = {};
    for ( const [creature, v] of Object.entries(creatures ?? {}) ) {
      const token = String(v?.token ?? "").trim();
      const portrait = String(v?.portrait ?? "").trim();
      if ( !token && !portrait ) continue;
      kept[artKey(creature)] = { ...(token ? { token } : {}), ...(portrait ? { portrait } : {}) };
    }
    if ( Object.keys(kept).length ) out[artKey(spell)] = kept;
  }
  return out;
}
