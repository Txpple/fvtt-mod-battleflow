// @ts-check
/**
 * Battle Flow — DECISION: an emanation's reach, range, and the effect it hands the platform.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE PLATFORM KEEPS THE GEOMETRY AND THE CLOCK (measured 2026-09-03, tools/probe-emanations.mjs,
 * Foundry 14.365): a Region attached to a token moves with it, tracks which tokens stand inside,
 * and raises enter / exit / turn-end events. Nothing here measures a distance or counts a turn.
 * What is decided here is the RULES half — who an aura reaches (user ruling 2026-09-03: helpful
 * auras reach allies and neutrals, harmful ones enemies), how far it reaches (the content's own
 * data: an activity's size, or the class's scale value the pack's own activities reference), and
 * the effect a member receives — the pack's effect with the SOURCE's numbers read in, because the
 * platform resolves a formula against the creature wearing the effect (the pack's own note on
 * Aura of Protection: "it will add their Charisma modifier and not the Paladin's").
 */

/** Foundry's token dispositions, as numbers (CONST.TOKEN_DISPOSITIONS) — plain here on purpose. */
export const DISPOSITION = Object.freeze({ SECRET: -2, HOSTILE: -1, NEUTRAL: 0, FRIENDLY: 1 });

/**
 * Does an emanation of this REACH touch a creature of this disposition, from a source of that one?
 * Helpful: the source's own side and neutrals (the rules say "you and your allies"). Harmful: the
 * other side — a hostile source reaches friendlies and a friendly source reaches hostiles; neither
 * reaches neutrals by default (the caster "designates creatures to be unaffected" — the default
 * designation is everybody who is not an enemy). All (the Aasimar walk, 2026-09-25 — Inner
 * Radiance's "each creature within 10 feet of you"): every side, allies included, as written. A
 * SECRET token is nobody's business either way.
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
 * Does an AREA whose activity names who it affects (`target.affects.type`) take in a creature of
 * this disposition, from a caster of that one? The packs say it on the data — Necrotic Shroud's
 * area affects "enemy", its text "creatures other than your allies" (the Aasimar walk,
 * 2026-09-25) — and a placed area asked everyone standing in it. "enemy": anyone NOT on the
 * caster's side (the other side and neutrals — the text's "other than your allies"); "ally": the
 * caster's own side; anything else (creature, blank, any): everyone, as before. The caster's own
 * token is the caller's to leave out.
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
 * The listed PULSE row whose form this use is, or null (the Aasimar walk, 2026-09-25): a row with a
 * `pulse` names the pack item it lives on (`item`, else its own key) and the activity whose use is
 * the transformation (`activity`) — Inner Radiance on Celestial Revelation. That use is the
 * transform alone: the ring is the sweep's, the damage the pulse's at the bearer's turn end, so no
 * machine rolls the activity's damage at the use (the pack models the pulse as damage on use).
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
 * Walk a dotted path through plain roll data. A scale value arrives as an object carrying
 * `value` (dnd5e's distance scale: `{ value: 10 }`, formatted "10 ft" by its own toString) —
 * the number is what an emanation wants.
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
 * Replace every `@path` token in a formula with its value from the roll data — the module's
 * own read of a content formula, so the SOURCE's numbers travel with the effect. An unresolved
 * token is left in place and reported, so the EDGE can refuse rather than ship a silent zero
 * (NOTES §2: an unresolved token rolls ZERO in silence).
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
 * The pack's effect changes with the source's numbers read in. A change whose value carries no
 * `@` is passed through untouched (Aura of Warding's resistances, Half Speed's multiplier);
 * one that does is resolved and, when the result is plain arithmetic, folded to a number.
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
    // A closed arithmetic grammar only (digits, + - * / and parentheses) — no identifiers reach here.
    const n = Function(`"use strict"; return (${t});`)();
    return Number.isFinite(n) ? String(n) : t;
  } catch { return t; }
}

/**
 * How far this emanation reaches, in the scene's distance units: the activity's own size when
 * the pack gives one, else the row's range — a number, or a content formula over the source's
 * roll data (`@scale.paladin.aura`, the token the pack's own aura activities carry). Null when
 * the content gives nothing: a Paladin below 6th level has no aura, and the row says so by
 * resolving to nothing rather than by a level table here.
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
 * Is an area's HEAL due for this member at this moment (the second slice, 2026-09-05)? Aura of
 * Life: "if an ally with 0 Hit Points starts its turn in the aura, that ally regains 1 Hit Point"
 * — the row names the moment and the condition; the facts are the platform's.
 * @param {{heal?: {on: string, when?: string}|null}} row
 * ⚠ No "dead" guard: dnd5e stamps the dead status on a creature at 0 HP by itself, and the
 * 0-HP creature is exactly the one the text names. The Hit Points are the condition.
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
 * Is a triggered save due for this creature now? Once per turn in combat (Spirit Guardians'
 * own sentence), every time out of it — the settled ruling that turns are counted only for a
 * combatant in the running combat (DESIGN §8).
 * @param {{ inCombat: boolean, chitStands: boolean }} facts
 */
export function triggerDue({ inCombat, chitStands }) {
  if ( inCombat && chitStands ) return { due: false, why: "already saved this turn" };
  return { due: true, why: inCombat ? "once this turn" : "out of combat — every time" };
}

/**
 * The scenes play is on NOW: the active scene, and every scene a connected user is VIEWING (user,
 * 2026-09-23, Session 8: the table played on scenes the players were pulled to and nobody had
 * activated — the ally beside Invictus never got the +2). The active scene alone was the
 * 2026-09-04 answer to the bleed; what made the bleed was one effect per REGION, so a party
 * token left on 22 scenes wrote 22 copies. The count is now kept per aura instead
 * (`emanationGroup`, `groupMembers`), so a second live scene can never stack — and a scene
 * nobody is looking at still raises nothing.
 *
 * ⚠ A GM's view counts ONLY WHILE NO PLAYER IS CONNECTED (user, 2026-09-23: "keep GM views
 * counted if it keeps accuracy"). In a session the players' screens are where the party is; a GM
 * previewing an old scene where the party's leftover tokens stand together would otherwise raise
 * the rings there and hand an ally the aura on the real map while it stands out of range. Alone —
 * prepping, testing — the GM's view is the only one, and it counts. An Assistant GM (the MCP
 * bridge, a suite) is a GM here.
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
 * Does an emanation on this scene apply anything right now? Only on a LIVE scene (`liveScenes`):
 * a feature's ring stands there and nowhere else, a spell's area applies and demands only there,
 * and anything an emanation elsewhere wrote is lifted. An effect lives on the actor, and a linked
 * actor is one document across every scene — a ring on a scene nobody plays on would reach the
 * ally on the one they do (user, 2026-09-04: "an aura from one scene bleeding into another").
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
 * ONE AURA, however many scenes it stands on: the source's item and the row. A linked bearer's
 * item has one uuid on every scene (`Actor.<id>.Item.<id>`), so the Paladin's ring on the camp and
 * his ring on the battle map are the same aura, and the ally inside both wears ONE effect. An
 * unlinked bearer's item lives on its own token (`Scene.….Token.….Actor.….Item.…`) — a different
 * creature, a different aura, as it should be. A region that names no item is a group of one.
 * @param {string|null} itemUuid
 * @param {string|null} key   the emanation row's name
 * @param {string} regionId
 */
export function emanationGroup(itemUuid, key, regionId) {
  return (itemUuid && key) ? `${itemUuid}|${key}` : `region:${regionId}`;
}

/**
 * Who wears one aura's effect, across every region of it (the scenes it stands on), and from
 * which region. A creature inside the aura on ANY live scene wears it once — the first region
 * that admits it names the copy, so pass the one the table is most likely on first. The reach and
 * the source rule are the per-region ones: a feature's own bearer never wears its ring (the
 * pack's transfer effect already sits on the sheet), a spell's caster does when the reach admits
 * its side (user, 2026-09-05: "he himself doesn't get adv … he doesn't have the effect").
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
 * The damage type an emanation's roll wears when the pack's part carries several (Spirit
 * Guardians: necrotic and radiant). The 2024 text decides it by the caster's alignment —
 * "Radiant if you are good or neutral, Necrotic if you are evil" — so the DEFAULT is read off the
 * sheet: an alignment naming evil → necrotic when the part offers it; otherwise radiant when the
 * part offers it; otherwise the part's first type. A caster may still choose (user, 2026-09-03:
 * "should have a choice between necrotic and radiant") — the pick, when made, replaces this.
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
 * The ActiveEffect a member receives — the pack's effect, named for its source, carrying the
 * resolved changes and the fingerprint the floor reads to know it is this emanation's.
 * @param {{ key: string, rule?: string }} row   the row as `tableIndex`'s `rowNamed` hands it —
 *        its name is `key` (the table's own key). ⚠ The rows carry no `name`: this read `row.name`
 *        until 2026-09-23, and every member copy was written with its `key` flag missing and its
 *        description opening "undefined:" (a unit test that passed a hand-made `{ name }` hid it).
 * @param {{ name: string, img?: string|null, description?: string|null, changes: any[] }} effect   the pack's effect, changes already resolved
 * @param {{ sourceName: string, itemUuid: string|null, regionId: string, group?: string|null, moduleId: string, flagKey: string, status?: string|null }} ids
 *        `status`: a status id the effect wears so the token SHOWS it — Foundry draws only
 *        temporary effects on a token, and a standing aura has no clock to be temporary by
 *        (user, 2026-09-03: "it should show a chit when in, and be removed when out").
 *        `group`: the aura it is a copy of (`emanationGroup`) — the floor keeps one per group.
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
