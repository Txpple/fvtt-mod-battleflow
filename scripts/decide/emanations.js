// @ts-check
/**
 * Battle Flow — DECISION: an emanation's reach, range and member effect, the SOURCE's numbers read in
 * (the platform would resolve against the wearer). Pure (ARCHITECTURE.md §2); RULINGS *Emanations*.
 */

/** CONST.TOKEN_DISPOSITIONS, plain here on purpose. */
export const DISPOSITION = Object.freeze({ SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 });

/**
 * Does this REACH touch the creature? Helpful: own side + neutrals; harmful: the other side. Never SECRET.
 * @param {"helpful"|"harmful"|"all"} reach
 * @param {number} sourceDisposition
 * @param {number} targetDisposition
 */
export function reachAdmits(reach, sourceDisposition, targetDisposition) {
  if ( (targetDisposition === DISPOSITION.SECRET) || (sourceDisposition === DISPOSITION.SECRET) ) return false;
  if ( reach === "all" ) return true;
  if ( reach === "helpful" ) return (targetDisposition === sourceDisposition) || (targetDisposition === DISPOSITION.NEUTRAL);
  if ( reach === "harmful" ) {
    if ( sourceDisposition === DISPOSITION.NEUTRAL ) return targetDisposition !== DISPOSITION.NEUTRAL;
    return targetDisposition === -sourceDisposition;
  }
  return false;
}

/**
 * Does an area's `target.affects.type` take in this creature? The caster's own token is the caller's to leave out.
 * @param {string|null} affects
 * @param {number} casterDisposition
 * @param {number} targetDisposition
 */
export function affectsAdmits(affects, casterDisposition, targetDisposition) {
  if ( affects === "enemy" ) {
    if ( (targetDisposition === DISPOSITION.SECRET) || (casterDisposition === DISPOSITION.SECRET) ) return true;
    return targetDisposition !== casterDisposition;
  }
  if ( affects === "ally" ) return targetDisposition === casterDisposition;
  return true;
}

/**
 * The listed PULSE row whose form this use is (its damage is the pulse's at turn end, never the use's).
 * @param {Record<string, {pulse?: object|null, item?: string, activity?: string}>} table   EMANATIONS
 * @param {{ itemName: string|null|undefined, activityName: string|null|undefined }} use
 * @param {Set<string>} listed   lower-cased
 * @returns {string|null}
 */
export function pulseFormKey(table, { itemName, activityName }, listed) {
  const item = String(itemName ?? "").toLowerCase();
  const act = String(activityName ?? "").toLowerCase();
  if ( !item || !act ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !row?.pulse || !row.activity || !listed?.has?.(key.toLowerCase()) ) continue;
    if ( (String(row.item ?? key).toLowerCase() === item) && (String(row.activity).toLowerCase() === act) ) return key;
  }
  return null;
}

/**
 * Walk a dotted path through roll data; a scale value (`{ value: 10 }`) yields its number.
 * @param {Record<string, any>} data
 * @param {string} path
 * @returns {number|string|null}
 */
export function lookupRollData(data, path) {
  let cur = data;
  for ( const part of path.split(".") ) {
    if ( (cur === null) || (cur === undefined) || (typeof cur !== "object") ) return null;
    cur = cur[part];
  }
  if ( (cur === null) || (cur === undefined) ) return null;
  if ( typeof cur === "object" ) return (typeof cur.value === "number") ? cur.value : (cur.value ?? null);
  return cur;
}

/**
 * Replace every `@path`; an unresolved one is reported so the EDGE refuses a silent zero (NOTES §2).
 * @param {string} formula
 * @param {Record<string, any>} data
 * @returns {{ text: string, unresolved: string[] }}
 */
export function resolveFormula(formula, data) {
  const unresolved = [];
  const text = String(formula ?? "").replace(/@([a-zA-Z0-9_.-]+)/g, (whole, path) => {
    const v = lookupRollData(data, path);
    if ( (v === null) || (v === undefined) || (v === "") ) { unresolved.push(path); return whole; }
    return String(v);
  });
  return { text, unresolved };
}

/**
 * The pack's effect changes with the source's numbers read in, plain arithmetic folded.
 * @param {Array<{key: string, mode: number, value: string, priority?: number|null}>} changes
 * @param {Record<string, any>} data     the SOURCE's roll data
 * @returns {{ changes: Array<{key: string, mode: number, value: string, priority?: number|null}>, unresolved: string[] }}
 */
export function resolveChanges(changes, data) {
  const unresolved = [];
  const out = (changes ?? []).map(c => {
    const value = String(c.value ?? "");
    if ( !value.includes("@") ) return { key: c.key, mode: c.mode, value, priority: c.priority ?? null };
    const r = resolveFormula(value, data);
    unresolved.push(...r.unresolved);
    return { key: c.key, mode: c.mode, value: foldArithmetic(r.text), priority: c.priority ?? null };
  });
  return { changes: out, unresolved };
}

/** `3`, `-1`, `2 + 1`, `10 - 2 * 3` → their number as text; anything else unchanged. */
export function foldArithmetic(text) {
  const t = String(text).trim();
  if ( !/^[-+*/()\d.\s]+$/.test(t) || !/\d/.test(t) ) return t;
  try {
    // Closed grammar (digits, + - * / and parentheses): no identifier reaches here.
    const n = Function(`"use strict"; return (${t});`)();
    return Number.isFinite(n) ? String(n) : t;
  } catch { return t; }
}

/**
 * Reach in feet: the activity's template size, else the row's range (number or formula); null when content gives none.
 * @param {{ range?: number|string|null }} row
 * @param {Record<string, any>} rollData
 * @param {number|string|null|undefined} activitySize
 * @returns {number|null}
 */
export function emanationRange(row, rollData, activitySize = null) {
  const fromActivity = Number(activitySize);
  if ( Number.isFinite(fromActivity) && (fromActivity > 0) ) return fromActivity;
  const r = row?.range ?? null;
  if ( typeof r === "number" ) return r > 0 ? r : null;
  if ( typeof r === "string" ) {
    const { text, unresolved } = resolveFormula(r, rollData ?? {});
    if ( unresolved.length ) return null;
    const n = Number(foldArithmetic(text));
    return (Number.isFinite(n) && (n > 0)) ? n : null;
  }
  return null;
}

/**
 * Is an area's HEAL due for this member now? ⚠ No "dead" guard: the 0-HP creature is the one the text names.
 * @param {{heal?: {on: string, when?: string}|null}} row
 * @param {{cause: string, hp?: number|null}} facts
 * @returns {{due: boolean, why: string}}
 */
export function healTriggerDue(row, { cause, hp = null }) {
  const h = row?.heal ?? null;
  if ( !h ) return { due: false, why: "no heal on the row" };
  if ( h.on !== cause ) return { due: false, why: `not at ${h.on}` };
  if ( (h.when === "zeroHP") && (Number(hp) !== 0) ) return { due: false, why: `${hp} Hit Points — not at 0` };
  return { due: true, why: (h.when === "zeroHP") ? "at 0 Hit Points at the start of its turn" : `at ${cause}` };
}

/**
 * Is a triggered save due now? Once per turn in combat, every time out of it.
 * @param {{ inCombat: boolean, chitStands: boolean }} facts
 */
export function triggerDue({ inCombat, chitStands }) {
  if ( inCombat && chitStands ) return { due: false, why: "already saved this turn" };
  return { due: true, why: inCombat ? "once this turn" : "out of combat — every time" };
}

/**
 * The scenes play is on NOW: the active scene and every scene a connected user views. ⚠ A GM's view
 * (Assistant GM included) counts ONLY with no player connected: a preview of an old scene would bleed in.
 * @param {string|null} activeSceneId
 * @param {Array<{ sceneId: string|null, name?: string|null, isGM?: boolean }>} viewers   CONNECTED users only
 * @returns {Map<string, string>}   scene id → why it is live
 */
export function liveScenes(activeSceneId, viewers = []) {
  const live = new Map();
  if ( activeSceneId ) live.set(activeSceneId, "the active scene");
  const connected = (viewers ?? []).filter(Boolean);
  const players = connected.filter(v => !v.isGM);
  for ( const v of (players.length ? players : connected) ) {
    if ( !v.sceneId || live.has(v.sceneId) ) continue;
    live.set(v.sceneId, `${v.name || "a connected user"} is viewing it`);
  }
  return live;
}

/**
 * Does an emanation on this scene apply now? Only on a LIVE scene: a linked actor spans scenes.
 * @param {string|null} regionSceneId
 * @param {Map<string, string>|null} live   `liveScenes`' answer
 * @returns {{ applies: boolean, why: string }}
 */
export function appliesOnScene(regionSceneId, live) {
  if ( !regionSceneId ) return { applies: false, why: "no scene" };
  const why = live?.get(regionSceneId) ?? null;
  if ( !why ) return { applies: false, why: "nobody is playing on this scene" };
  return { applies: true, why };
}

/**
 * ONE AURA across scenes (item uuid + row), so two rings of a linked bearer give ONE effect.
 * @param {string|null} itemUuid
 * @param {string|null} key
 * @param {string} regionId
 */
export function emanationGroup(itemUuid, key, regionId) {
  return (itemUuid && key) ? `${itemUuid}|${key}` : `region:${regionId}`;
}

/**
 * Who wears one aura's effect, and from which region (the first that admits it; pass the likeliest
 * first). A feature's bearer never wears its own ring (its transfer effect is on the sheet); a spell's caster does.
 * @param {Array<{ regionId: string, applies: boolean, kind: string, reach: "helpful"|"harmful",
 *   sourceTokenId: string|null, sourceDisposition: number,
 *   inside: Array<{ tokenId: string, actorKey: string, disposition: number }> }>} areas
 * @returns {Map<string, string>}   actor key → the region whose copy it wears
 */
export function groupMembers(areas) {
  const out = new Map();
  for ( const a of areas ?? [] ) {
    if ( !a?.applies ) continue;
    for ( const t of a.inside ?? [] ) {
      if ( !t?.actorKey || out.has(t.actorKey) ) continue;
      if ( a.sourceTokenId && (t.tokenId === a.sourceTokenId) && (a.kind !== "spell") ) continue;
      if ( !reachAdmits(a.reach, a.sourceDisposition, t.disposition) ) continue;
      out.set(t.actorKey, a.regionId);
    }
  }
  return out;
}

/**
 * The damage type of a multi-type part: the caster's pick, else evil → necrotic, else radiant, else the first.
 * @param {string[]} types      in the pack's order
 * @param {string|null} alignment
 * @param {string|null} chosen
 * @returns {{ type: string|null, why: string }}
 */
export function damageTypeFor(types, alignment = null, chosen = null) {
  const list = (types ?? []).map(t => String(t).toLowerCase()).filter(Boolean);
  if ( !list.length ) return { type: null, why: "no damage type on the part" };
  if ( chosen && list.includes(String(chosen).toLowerCase()) ) return { type: String(chosen).toLowerCase(), why: "chosen" };
  if ( list.length === 1 ) return { type: list[0] ?? null, why: "the part's one type" };
  const evil = /evil/i.test(String(alignment ?? ""));
  if ( evil && list.includes("necrotic") ) return { type: "necrotic", why: `the alignment reads "${alignment}"` };
  if ( list.includes("radiant") ) return { type: "radiant", why: alignment ? `the alignment reads "${alignment}"` : "no alignment on the sheet — good or neutral" };
  return { type: list[0] ?? null, why: "the part's first type" };
}

/**
 * The ActiveEffect a member receives: the pack's effect named for its source, with the floor's fingerprint.
 * @param {{ key: string, rule?: string }} row   ⚠ rows carry no `name`; `key` is it
 * @param {{ name: string, img?: string|null, description?: string|null, changes: any[] }} effect   changes already resolved
 * @param {{ sourceName: string, itemUuid: string|null, regionId: string, group?: string|null, moduleId: string, flagKey: string, status?: string|null }} ids
 *        `status` makes the token SHOW it (Foundry draws only temporary effects; an aura has no clock).
 */
export function memberEffectData(row, effect, { sourceName, itemUuid, regionId, group = null, moduleId, flagKey, status = null }) {
  return {
    name: `${effect.name} — ${sourceName}`,
    img: effect.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule ?? ""}”</em></p><p>${row.key}: ${sourceName}'s emanation. Battle Flow keeps this while the creature stands inside it.</p>`,
    origin: itemUuid ?? null,
    disabled: false, transfer: false,
    ...(status ? { statuses: [status] } : {}),
    changes: effect.changes.map(c => ({ ...c })),
    flags: { [moduleId]: { [flagKey]: { regionId, key: row.key, ...(group ? { group } : {}) } } }
  };
}
