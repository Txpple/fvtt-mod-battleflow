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
 * designation is everybody who is not an enemy). A SECRET token is nobody's business either way.
 * @param {"helpful"|"harmful"} reach
 * @param {number} sourceDisposition
 * @param {number} targetDisposition
 */
export function reachAdmits(reach, sourceDisposition, targetDisposition) {
  if ( (targetDisposition === DISPOSITION.SECRET) || (sourceDisposition === DISPOSITION.SECRET) ) return false;
  if ( reach === "helpful" ) return (targetDisposition === sourceDisposition) || (targetDisposition === DISPOSITION.NEUTRAL);
  if ( reach === "harmful" ) {
    if ( sourceDisposition === DISPOSITION.NEUTRAL ) return targetDisposition !== DISPOSITION.NEUTRAL;
    return targetDisposition === -sourceDisposition;
  }
  return false;
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
 * @param {{ name: string, rule?: string }} row
 * @param {{ name: string, img?: string|null, description?: string|null, changes: any[] }} effect   the pack's effect, changes already resolved
 * @param {{ sourceName: string, itemUuid: string|null, regionId: string, moduleId: string, flagKey: string, status?: string|null }} ids
 *        `status`: a status id the effect wears so the token SHOWS it — Foundry draws only
 *        temporary effects on a token, and a standing aura has no clock to be temporary by
 *        (user, 2026-09-03: "it should show a chit when in, and be removed when out").
 */
export function memberEffectData(row, effect, { sourceName, itemUuid, regionId, moduleId, flagKey, status = null }) {
  return {
    name: `${effect.name} — ${sourceName}`,
    img: effect.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule ?? ""}”</em></p><p>${row.name}: ${sourceName}'s emanation. Battle Flow keeps this while the creature stands inside it.</p>`,
    origin: itemUuid ?? null,
    disabled: false, transfer: false,
    ...(status ? { statuses: [status] } : {}),
    changes: effect.changes.map(c => ({ ...c })),
    flags: { [moduleId]: { [flagKey]: { regionId, key: row.name } } }
  };
}
