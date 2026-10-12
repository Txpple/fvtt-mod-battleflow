// @ts-check
/**
 * The rename's migration, as data (3.0.0: Battle Flow became By the Books). PURE — plain document data
 * in, update payloads out; no Foundry. The machine (scripts/migrate.js) reads the world, hands each
 * document's source here, and writes what comes back.
 *
 * The ids are parameters, `{ from, to }` — the legacy id and the module's own — so this layer names no
 * package.
 */

/** @param {any} v */
const plain = v => (v !== null) && (typeof v === "object") && !Array.isArray(v);

/**
 * One document's legacy flag scope, moved. Null when the document carries none. The old scope is
 * ALWAYS removed; what it held lands under the new id KEY BY KEY, the new scope winning where both
 * hold a key (what `readFlag` already answers). Never leaving both standing matters: an `unsetFlag`
 * on the new scope would otherwise resurrect the old value through `readFlag`.
 *   - `update` — the payload's flag fields (no `_id`);
 *   - `carried` — the old scope held at least one key (an empty `{}` is removed but not counted);
 *   - `filled` — the keys copied into a new scope that already existed (for the log).
 * @param {any} flags  the document's source `flags`
 * @param {{ from: string, to: string }} ids
 * @returns {{ update: Record<string, any>, carried: boolean, filled: string[] } | null}
 */
export function scopeMove(flags, { from, to }) {
  if ( !plain(flags) || !(from in flags) ) return null;
  const old = flags[from];
  const remove = { [`flags.-=${from}`]: null };
  if ( !plain(old) || !Object.keys(old).length ) return { update: remove, carried: false, filled: [] };
  const have = flags[to];
  if ( !plain(have) || !Object.keys(have).length ) {
    return { update: { [`flags.${to}`]: old, ...remove }, carried: true, filled: [] };
  }
  const missing = Object.keys(old).filter(k => !(k in have));
  /** @type {Record<string, any>} */
  const fill = {};
  for ( const k of missing ) fill[`flags.${to}.${k}`] = old[k];
  return { update: { ...fill, ...remove }, carried: true, filled: missing };
}

/**
 * The scope moves for a collection of documents' sources, as one batch: `updates` carry `_id`.
 * `carried` counts only the documents whose old scope held a key (the summary's number).
 * @param {any[]} sources  each `{ _id, flags }`
 * @param {{ from: string, to: string }} ids
 * @returns {{ updates: Record<string, any>[], carried: number, filled: { id: string, keys: string[] }[] }}
 */
export function scopeMoves(sources, ids) {
  const updates = [];
  const filled = [];
  let carried = 0;
  for ( const src of sources ?? [] ) {
    const move = scopeMove(src?.flags, ids);
    if ( !move ) continue;
    updates.push({ _id: src._id, ...move.update });
    if ( move.carried ) carried++;
    if ( move.filled.length ) filled.push({ id: src._id, keys: move.filled });
  }
  return { updates, carried, filled };
}

/** The key a recreated behaviour carries under the new scope: the id of the behaviour it replaced. */
export const MIGRATED_FROM = "migratedFrom";

/** The region behaviour subtype the module registers, under a package id. */
export const behaviorType = (id, name = "emanation") => `${id}.${name}`;

/**
 * A region behaviour of the legacy subtype, converted. Null for any other behaviour.
 *   - `update` — retype in place: `type` and the same `system` (plus the flag move, if any);
 *   - `create` — the fallback when the type cannot be updated: the same behaviour under the new type,
 *     its flags already moved, to be created before the old one is deleted.
 * @param {any} source  the behaviour's source (`_id`, `type`, `name`, `disabled`, `system`, `flags`)
 * @param {{ from: string, to: string }} ids
 */
export function behaviorMove(source, ids) {
  if ( source?.type !== behaviorType(ids.from) ) return null;
  const type = behaviorType(ids.to);
  const system = structuredClone(source.system ?? {});
  const move = scopeMove(source.flags, ids);
  const flags = structuredClone(plain(source.flags) ? source.flags : {});
  const old = plain(flags[ids.from]) ? flags[ids.from] : {};
  // The copy: the scopes merged key by key (the new one winning), and stamped with the behaviour it
  // replaces, so a load that created it but could not delete the old one never creates a second.
  flags[ids.to] = { ...old, ...(plain(flags[ids.to]) ? flags[ids.to] : {}), [MIGRATED_FROM]: source._id };
  delete flags[ids.from];
  return {
    id: source._id,
    carried: !!move?.carried,
    update: { _id: source._id, type, system, ...(move?.update ?? {}) },
    create: { type, name: source.name ?? "", disabled: !!source.disabled, system, flags }
  };
}

/**
 * Which world settings move, read off EVERY stored Setting under the legacy id (not only the keys the
 * module knows today): a key the module registers moves when no Setting under the new id exists yet;
 * a key it does not register stays where it is and is named, for the log.
 * @param {{ key: string, value: any }[]} settings  the world's Setting documents: full key, raw value
 * @param {(key: string) => boolean} registered  is `<to>.<key>` registered?
 * @param {{ from: string, to: string }} ids
 * @returns {{ moves: { key: string, value: any }[], unregistered: string[] }}  `key` without the prefix;
 *   `value` parsed from the stored JSON
 */
export function settingMoves(settings, registered, { from, to }) {
  const prefix = `${from}.`;
  const have = new Set((settings ?? []).map(s => s?.key));
  /** @type {{ key: string, value: any }[]} */
  const moves = [];
  /** @type {string[]} */
  const unregistered = [];
  for ( const s of settings ?? [] ) {
    if ( typeof s?.key !== "string" || !s.key.startsWith(prefix) ) continue;
    const key = s.key.slice(prefix.length);
    if ( !registered(key) ) { unregistered.push(key); continue; }
    if ( have.has(`${to}.${key}`) ) continue;
    moves.push({ key, value: parseStored(s.value) });
  }
  return { moves, unregistered };
}

/** A Setting's stored value: JSON text, parsed; anything else as it is. @param {any} raw */
export function parseStored(raw) {
  if ( typeof raw !== "string" ) return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * The client-scope copies: `[oldKey, newKey, value]` for each key held under the legacy id and not yet
 * under the new one.
 * @param {string[]} keys
 * @param {(storageKey: string) => string|null} read  localStorage.getItem
 * @param {{ from: string, to: string }} ids
 * @returns {[string, string, string][]}
 */
export function clientCopies(keys, read, { from, to }) {
  /** @type {[string, string, string][]} */
  const out = [];
  for ( const key of keys ?? [] ) {
    const old = read(`${from}.${key}`);
    if ( (old === null) || (old === undefined) ) continue;
    const now = read(`${to}.${key}`);
    if ( (now !== null) && (now !== undefined) ) continue;
    out.push([`${from}.${key}`, `${to}.${key}`, old]);
  }
  return out;
}

/**
 * The summary's parts, in the order the line names them: [count key, singular, plural].
 * @type {ReadonlyArray<[string, string, string]>}
 */
export const SUMMARY_PARTS = Object.freeze([
  ["settings", "setting", "settings"],
  ["effects", "effect", "effects"],
  ["actors", "actor", "actors"],
  ["items", "item", "items"],
  ["tokens", "token", "tokens"],
  ["scenes", "scene", "scenes"],
  ["regions", "region", "regions"],
  ["behaviors", "region behaviour", "region behaviours"],
  ["combats", "combat", "combats"],
  ["combatants", "combatant", "combatants"],
  ["users", "user", "users"]
]);

/**
 * The one line a migration that moved anything says; null when nothing moved (a load that finds
 * nothing says nothing).
 * @param {Record<string, number>} counts
 * @param {{ title: string, legacyTitle: string }} names
 */
export function summaryLine(counts, { title, legacyTitle }) {
  const parts = SUMMARY_PARTS
    .filter(([k]) => Number(counts?.[k]) > 0)
    .map(([k, one, many]) => `${counts[k]} ${(Number(counts[k]) === 1) ? one : many}`);
  if ( !parts.length ) return null;
  return `${title}: moved ${parts.join(", ")} from ${legacyTitle}.`;
}
