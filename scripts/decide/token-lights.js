// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): token lights, senses and sizes carried on an
 * EFFECT. Foundry 14 applies a `token.*` change to the bearer's tokens, so it lives and dies with
 * the effect and no token document is written.
 */

/**
 * The token-light row key this use answers to; a row with no `activity` answers any use.
 * @param {Record<string, {item?: string, activity?: string|null}>} table
 * @param {{ itemName: string|null|undefined, activityName: string|null|undefined }} use
 * @param {Set<string>} listed   lower-cased row names
 * @returns {string|null}
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
 * The changes that carry a row's light. Foundry's `dim` is the OUTER radius.
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
 * Who a row's light lands on; a `targets` row with none targeted lands nothing.
 * @param {{ on: "self"|"targets" }} row
 * @param {{ self?: {uuid: string, name: string}|null, targets?: Array<{uuid: string, name: string}> }} facts
 * @returns {Array<{uuid: string, name: string}>}
 */
export function lightTargets(row, { self = null, targets = [] } = {}) {
  if ( row?.on === "self" ) return self?.uuid ? [self] : [];
  const seen = new Set();
  return (targets ?? []).filter(t => t?.uuid && !seen.has(t.uuid) && seen.add(t.uuid));
}

/**
 * The token-sense row key an effect answers to by name (the row's `effect`, else its key).
 * @param {Record<string, {effect?: string}>} table
 * @param {string|null|undefined} effectName
 * @param {Set<string>} listed   lower-cased row names
 * @returns {string|null}
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
 * The changes that carry a row's sense (Foundry inflates the vision mode's defaults).
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

/** Does this change list already carry a sense? @param {Array<{key?: string}>} changes @returns {boolean} */
export function carriesSense(changes) {
  return (changes ?? []).some(c => String(c?.key ?? "").startsWith("token.sight.")
    || String(c?.key ?? "").startsWith("token.detectionModes."));
}

/**
 * TOKEN SIZES: the listed row and entry an effect's name answers to.
 * @param {Record<string, {effects: Record<string, {size?: string, step?: number}>}>} table
 * @param {string} effectName
 * @param {Set<string>} listed
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
 * The size an entry makes: `size` absolute, `step` clamped along the order; null when unchanged.
 * @param {{size?: string, step?: number}} entry
 * @param {string} current  ("med")
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
 * The changes that carry a size: the actor's size and the token's footprint.
 * @param {string} size
 * @param {Record<string, {token?: number}>} sizes  CONFIG.DND5E.actorSizes
 */
export function sizeChanges(size, sizes) {
  const grid = Number(sizes?.[size]?.token) || 1;
  const change = (key, value) => ({ key, type: "override", value, phase: "initial" });
  return [change("system.traits.size", size), change("token.width", grid), change("token.height", grid)];
}

/** Does this change list already carry a size? */
export function carriesSize(changes) {
  return (changes ?? []).some(c => ["token.width", "token.height", "system.traits.size"].includes(String(c?.key ?? "")));
}
