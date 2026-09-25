// @ts-check
/**
 * Battle Flow — DECISION: which use sheds a token light, and the changes that carry it.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * A light is carried on an EFFECT (the Aasimar walk, 2026-09-25 — decide/registry.js
 * TOKEN_LIGHTS): Foundry 14 applies an effect change keyed `token.*` to the bearer's tokens
 * (TokenDocument#applyActiveEffects; `light` is among its targetable keys — measured on 14.368),
 * so the light lives and dies with the effect and no token document is written. What is decided
 * here: which row a use answers to, and the change list the effect wears.
 */

/**
 * The token-light row this use answers to, or null. A row keyed by its FORM names the pack item it
 * lives on (`item`) and the activity (`activity`) — Inner Radiance on Celestial Revelation; a row
 * keyed by the item's own name with no activity answers to any use of it (the Light spell).
 * @param {Record<string, {item?: string, activity?: string|null}>} table
 * @param {{ itemName: string|null|undefined, activityName: string|null|undefined }} use
 * @param {Set<string>} listed   the Token Lights list, lower-cased row names
 * @returns {string|null}   the row's key
 */
export function lightRowKey(table, { itemName, activityName }, listed) {
  const item = String(itemName ?? "").toLowerCase();
  const act = String(activityName ?? "").toLowerCase();
  if ( !item ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !listed?.has?.(key.toLowerCase()) ) continue;
    if ( String(row.item ?? key).toLowerCase() !== item ) continue;
    if ( row.activity && (String(row.activity).toLowerCase() !== act) ) continue;
    return key;
  }
  return null;
}

/**
 * The effect changes that carry a row's light: the token's Bright and Dim radii, overriding
 * whatever light the token has while the effect stands (Foundry's `dim` is the OUTER radius — the
 * row already holds it that way). The change shape is Foundry 14's (`type`, `phase`).
 * @param {{ bright: number, dim: number }} row
 * @returns {Array<{ key: string, type: string, value: number, phase: string }>}
 */
export function lightChanges(row) {
  const bright = Math.max(0, Number(row?.bright) || 0);
  const dim = Math.max(bright, Number(row?.dim) || 0);
  return [
    { key: "token.light.bright", type: "override", value: bright, phase: "initial" },
    { key: "token.light.dim", type: "override", value: dim, phase: "initial" }
  ];
}

/**
 * Who a row's light lands on at this use: the user themself (`self`), or every creature targeted
 * at the use (`targets`); none targeted for a `targets` row is no light at all — the pack's own
 * use stands (the Light spell's summoned light).
 * @param {{ on: "self"|"targets" }} row
 * @param {{ self?: {uuid: string, name: string}|null, targets?: Array<{uuid: string, name: string}> }} facts
 * @returns {Array<{uuid: string, name: string}>}
 */
export function lightTargets(row, { self = null, targets = [] } = {}) {
  if ( row?.on === "self" ) return self?.uuid ? [self] : [];
  const seen = new Set();
  return (targets ?? []).filter(t => t?.uuid && !seen.has(t.uuid) && seen.add(t.uuid));
}

/* --- token senses: the same carrier, on the pack's own effect ----------------------------------- */

/**
 * The token-sense row an effect answers to, by the effect's name (the row's `effect`, else its
 * key), or null.
 * @param {Record<string, {effect?: string}>} table
 * @param {string|null|undefined} effectName
 * @param {Set<string>} listed   the Token Senses list, lower-cased row names
 * @returns {string|null}   the row's key
 */
export function senseRowKey(table, effectName, listed) {
  const name = String(effectName ?? "").toLowerCase();
  if ( !name ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !listed?.has?.(key.toLowerCase()) ) continue;
    if ( String(row.effect ?? key).toLowerCase() === name ) return key;
  }
  return null;
}

/**
 * The effect changes that carry a row's sense: the vision mode the token takes (Foundry inflates
 * the mode's own defaults from the override), the sight range, and the detection mode enabled at
 * its range. Foundry 14's change shape, as lightChanges.
 * @param {{ vision?: string|null, range?: number|null, detect?: {mode: string, range: number}|null }} row
 * @returns {Array<{ key: string, type: string, value: any, phase: string }>}
 */
export function senseChanges(row) {
  const out = [];
  const change = (key, value) => out.push({ key, type: "override", value, phase: "initial" });
  if ( row?.vision ) change("token.sight.visionMode", String(row.vision));
  if ( Number(row?.range) > 0 ) change("token.sight.range", Number(row.range));
  if ( row?.detect?.mode && (Number(row.detect.range) > 0) ) {
    change(`token.detectionModes.${row.detect.mode}.enabled`, true);
    change(`token.detectionModes.${row.detect.mode}.range`, Number(row.detect.range));
  }
  return out;
}

/**
 * Does this change list already carry the row's sense? (An effect copied from one that wore it —
 * a duplicate, a re-landed copy — is not given it twice.)
 * @param {Array<{key?: string}>} changes
 * @returns {boolean}
 */
export function carriesSense(changes) {
  return (changes ?? []).some(c => String(c?.key ?? "").startsWith("token.sight.")
    || String(c?.key ?? "").startsWith("token.detectionModes."));
}

/**
 * TOKEN SIZES (the Goliath walk, 2026-09-25): the row and the entry an effect's name answers to,
 * among the listed rows — `{ key, entry }` or null. Case-insensitive on the effect's name.
 * @param {Record<string, {effects: Record<string, {size?: string, step?: number}>}>} table
 * @param {string} effectName
 * @param {Set<string>} listed  the listed row names, lower-cased
 */
export function sizeRowFor(table, effectName, listed) {
  const name = String(effectName ?? "").toLowerCase();
  if ( !name ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !listed?.has?.(key.toLowerCase()) ) continue;
    for ( const [effect, entry] of Object.entries(row.effects ?? {}) ) {
      if ( effect.toLowerCase() === name ) return { key, entry };
    }
  }
  return null;
}

/**
 * The size an entry makes of the bearer's current size: `size` is absolute, `step` moves along
 * the system's own ordering (`numerical`), clamped at both ends. Null when nothing can be read or
 * nothing would change.
 * @param {{size?: string, step?: number}} entry
 * @param {string} current  the bearer's size key ("med")
 * @param {Record<string, {numerical: number, token?: number}>} sizes  CONFIG.DND5E.actorSizes
 * @returns {string|null}
 */
export function sizeAfter(entry, current, sizes) {
  const order = Object.entries(sizes ?? {}).filter(([, v]) => Number.isFinite(v?.numerical))
    .sort((a, b) => a[1].numerical - b[1].numerical).map(([k]) => k);
  if ( !order.length ) return null;
  let next = null;
  if ( entry?.size ) next = order.includes(entry.size) ? entry.size : null;
  else if ( Number(entry?.step) ) {
    const at = order.indexOf(current);
    if ( at < 0 ) return null;
    next = order[Math.min(order.length - 1, Math.max(0, at + Number(entry.step)))];
  }
  return (next && (next !== current)) ? next : null;
}

/**
 * The effect changes that carry a size: the actor's size, and the token's footprint in grid units
 * (the system's own `token` for the size, 1 when it has none — Small and Medium). Foundry 14's
 * change shape, as lightChanges.
 * @param {string} size  the size key
 * @param {Record<string, {token?: number}>} sizes  CONFIG.DND5E.actorSizes
 */
export function sizeChanges(size, sizes) {
  const grid = Number(sizes?.[size]?.token) || 1;
  const change = (key, value) => ({ key, type: "override", value, phase: "initial" });
  return [change("system.traits.size", size), change("token.width", grid), change("token.height", grid)];
}

/** Does this change list already carry a size (a copy of an effect that wore one)? */
export function carriesSize(changes) {
  return (changes ?? []).some(c => ["token.width", "token.height", "system.traits.size"].includes(String(c?.key ?? "")));
}
