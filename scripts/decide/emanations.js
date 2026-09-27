// @ts-check
/**
 * Battle Flow — DECISION: an emanation's reach, range, and the effect it hands the platform.
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 * The platform keeps the geometry and the clock (a token-attached Region); this is the RULES half:
 * who an aura reaches, how far, and the member's effect with the SOURCE's numbers read in (the
 * platform would resolve a formula against the wearer). RULINGS *Emanations*.
 */

/** Foundry's token dispositions (CONST.TOKEN_DISPOSITIONS), plain here on purpose. */
export const DISPOSITION = Object.freeze({ SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 });

/**
 * Does an emanation of this REACH touch a creature of this disposition, from a source of that one?
 * Helpful: the source's side and neutrals. Harmful: the other side, not neutrals (the caster's
 * default designation). All: every side, as written. A SECRET token is never reached.
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
 * Does an area whose activity names who it affects (`target.affects.type`) take in this creature?
 * "enemy": anyone not on the caster's side; "ally": the caster's side; anything else: everyone.
 * The caster's own token is the caller's to leave out.
 * @param {string|null} affects   the activity's `target.affects.type`
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
 * The listed PULSE row whose form this use is, or null (Inner Radiance on Celestial Revelation).
 * That use is the transformation alone: the ring is the sweep's and the damage the pulse's at the
 * bearer's turn end, so no machine rolls the activity's damage at the use.
 * @param {Record<string, {pulse?: object|null, item?: string, activity?: string}>} table   EMANATIONS
 * @param {{ itemName: string|null|undefined, activityName: string|null|undefined }} use
 * @param {Set<string>} listed   the Emanations list, lower-cased
 * @returns {string|null}   the row's key
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
 * Walk a dotted path through plain roll data. A scale value is an object carrying `value`
 * (`{ value: 10 }`); the number is what an emanation wants.
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
 * Replace every `@path` token in a formula with its value from the roll data, so the SOURCE's
 * numbers travel with the effect. An unresolved token is left in place and reported, so the EDGE
 * can refuse rather than ship a silent zero (NOTES §2).
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
 * The pack's effect changes with the source's numbers read in; a value with an `@` is resolved and
 * folded to a number when plain arithmetic, anything else passes through untouched.
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
    // A closed arithmetic grammar only (digits, + - * / and parentheses): no identifiers reach here.
    const n = Function(`"use strict"; return (${t});`)();
    return Number.isFinite(n) ? String(n) : t;
  } catch { return t; }
}

/**
 * How far this emanation reaches: the activity's own size, else the row's range (a number, or a
 * content formula such as `@scale.paladin.aura`). Null when the content gives nothing — a Paladin
 * below 6th level has no aura, with no level table here.
 * @param {{ range?: number|string|null }} row
 * @param {Record<string, any>} rollData
 * @param {number|string|null|undefined} activitySize   the activity's target.template.size, if any
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
 * Is an area's HEAL due for this member now (Aura of Life's 1 HP at turn start)?
 * @param {{heal?: {on: string, when?: string}|null}} row
 * ⚠ No "dead" guard: dnd5e marks a 0-HP creature dead itself, and that is the one the text names.
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
 * Is a triggered save due now? Once per turn in combat, every time out of it (turns count only for
 * a combatant in the running combat).
 * @param {{ inCombat: boolean, chitStands: boolean }} facts
 */
export function triggerDue({ inCombat, chitStands }) {
  if ( inCombat && chitStands ) return { due: false, why: "already saved this turn" };
  return { due: true, why: inCombat ? "once this turn" : "out of combat — every time" };
}

/**
 * The scenes play is on NOW: the active scene and every scene a connected user is viewing (the
 * count is per aura, so a second live scene never stacks; RULINGS *Emanations*).
 * ⚠ A GM's view counts ONLY while no player is connected: a GM previewing an old scene where the
 * party's leftover tokens stand would otherwise hand an ally the aura on the real map. An Assistant
 * GM (the MCP bridge, a suite) is a GM here.
 * @param {string|null} activeSceneId   game.scenes.active's id
 * @param {Array<{ sceneId: string|null, name?: string|null, isGM?: boolean }>} viewers   each CONNECTED user's viewed scene
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
 * Does an emanation on this scene apply anything now? Only on a LIVE scene: an effect lives on the
 * actor, and a linked actor is one document across scenes, so a ring elsewhere would bleed in.
 * @param {string|null} regionSceneId   the scene the emanation's region is on
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
 * ONE AURA, however many scenes it stands on: the source's item and the row. A linked bearer's item
 * has one uuid on every scene, so the ally inside both rings wears ONE effect; an unlinked bearer's
 * item lives on its own token (a different aura). A region naming no item is a group of one.
 * @param {string|null} itemUuid
 * @param {string|null} key   the emanation row's name
 * @param {string} regionId
 */
export function emanationGroup(itemUuid, key, regionId) {
  return (itemUuid && key) ? `${itemUuid}|${key}` : `region:${regionId}`;
}

/**
 * Who wears one aura's effect across all its regions, and from which region: the first region
 * that admits a creature names its copy (pass the likeliest scene first). A feature's own bearer
 * never wears its ring (its transfer effect is on the sheet); a spell's caster does when reached.
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
 * The damage type an emanation's roll wears when the part carries several (Spirit Guardians): the
 * caster's pick, else by alignment as the text says — evil → necrotic, otherwise radiant, else
 * the part's first type.
 * @param {string[]} types      the part's types, in the pack's order
 * @param {string|null} alignment   the caster's alignment text
 * @param {string|null} chosen  a pick already made, if it is one of the types
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
 * The ActiveEffect a member receives: the pack's effect, named for its source, carrying the
 * resolved changes and the fingerprint the floor reads.
 * @param {{ key: string, rule?: string }} row   as `tableIndex`'s `rowNamed` hands it; its name is
 *        `key` — ⚠ the rows carry no `name`.
 * @param {{ name: string, img?: string|null, description?: string|null, changes: any[] }} effect   the pack's effect, changes already resolved
 * @param {{ sourceName: string, itemUuid: string|null, regionId: string, group?: string|null, moduleId: string, flagKey: string, status?: string|null }} ids
 *        `status`: a status id so the token SHOWS the effect (Foundry draws only temporary
 *        effects, and a standing aura has no clock). `group`: the aura it copies (`emanationGroup`).
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
