// @ts-check
/**
 * By the Books — DECISION layer (ARCHITECTURE.md §2): SUMMONS (issue #1) — what a summon activity
 * asks before the creature exists, the record the caster's client writes on its cast card, and what
 * the elect lands from it: the form rows off the activity's profiles, the spell's own choice
 * (`SUMMON_CHOICES`), the damage parts narrowed to the chosen type, the shared resistance, the owners
 * granted (RULINGS *Summons*; the shared gallery's rows are decide/gallery.js). ⚠ PURE: no `game`, no imports.
 */

/**
 * The profiles a cast at this level may summon, as form rows. A profile's level band is inclusive
 * and open-ended when a bound is null.
 * @typedef {object} SummonProfile          dnd5e's profile, as plain data
 * @property {string} _id
 * @property {string} [name]
 * @property {string|null} [uuid]            the creature, for a `uuid`-mode activity
 * @property {string} [count]                a formula; "1" when blank
 * @property {string} [cr]                   the cap, for a `cr`-mode activity
 * @property {{ min?: number|null, max?: number|null }} [level]
 * @property {string[]} [types]              the creature types a `cr`-mode pool allows
 * @param {SummonProfile[]} profiles
 * @param {number} level                     the activity's relevant level (the slot for a spell)
 * @returns {Array<{ id: string, name: string, uuid: string|null, count: string, cr: string|null, types: string[] }>}
 */
export function profileRows(profiles, level) {
  const lv = Number(level) || 0;
  const out = [];
  for ( const p of profiles ?? [] ) {
    if ( !p?._id ) continue;
    const min = p.level?.min ?? null;
    const max = p.level?.max ?? null;
    if ( (min !== null) && (lv < Number(min)) ) continue;
    if ( (max !== null) && (lv > Number(max)) ) continue;
    out.push({
      id: p._id, name: String(p.name ?? ""), uuid: p.uuid ?? null,
      count: String(p.count ?? "").trim() || "1", cr: p.cr ? String(p.cr) : null,
      types: [...(p.types ?? [])]
    });
  }
  return out;
}

/**
 * The SUMMON_CHOICES row this cast answers to: the row whose `item` (else its key) names the item,
 * when the row is listed.
 * @param {Record<string, { item?: string }>} table
 * @param {string|null|undefined} itemName
 * @param {Set<string>} listed   lower-cased row keys
 * @returns {string|null}
 */
export function choiceRowKey(table, itemName, listed) {
  const item = String(itemName ?? "").toLowerCase();
  if ( !item ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !listed?.has?.(key.toLowerCase()) ) continue;
    if ( String(row.item ?? key).toLowerCase() === item ) return key;
  }
  return null;
}

/**
 * What the one popup must ask: the form when more than one profile stands, the spell's own choice
 * when a row names one, the pool when a `cr`-mode profile carries no creature. Nothing to ask means
 * the popup is placement alone (a Tier 2 object, a one-profile spell with no choice).
 * @param {{ profiles: Array<{ uuid: string|null, cr: string|null }>, choice: string|null }} facts
 * @returns {{ profile: boolean, pool: boolean, choice: boolean, any: boolean }}
 */
export function formNeeds({ profiles, choice }) {
  const rows = profiles ?? [];
  const profile = rows.length > 1;
  const pool = rows.some(p => !p.uuid && (p.cr !== null));
  const need = { profile, pool, choice: !!choice };
  return { ...need, any: need.profile || need.pool || need.choice };
}

/**
 * The record the caster's client writes on the cast card when the system's placement is switched off:
 * `asked` until the popup answers, `placed` once the preview confirmed, `applied` once the elect landed it.
 * @param {object} facts
 * @param {string} facts.sourceUuid          the caster
 * @param {string} facts.sourceName
 * @param {string} facts.itemUuid
 * @param {string} facts.itemName
 * @param {string} facts.activityUuid
 * @param {number} facts.level               the relevant level
 * @param {Array<object>} facts.profiles     `profileRows`, each with its `label`, `img` and `summary` added by the machine
 * @param {string|null} facts.choice         the SUMMON_CHOICES key, or null
 * @param {string|null} facts.concentrationId
 * @param {string|null} facts.sceneId        where the caster stands
 */
export function summonRecord({ sourceUuid, sourceName, itemUuid, itemName, activityUuid, level, profiles, choice, concentrationId, sceneId }) {
  return {
    status: "asked", sourceUuid, sourceName, itemUuid, itemName, activityUuid,
    level: Number(level) || 0, profiles: [...(profiles ?? [])], choice: choice ?? null,
    concentrationId: concentrationId ?? null, sceneId: sceneId ?? null, askedAt: Date.now()
  };
}

/**
 * The popup's answer folded into an `asked` record, judged: the profile is one of the record's, the
 * choice one of the row's options when a row stands, the pool pick present when the profile needs one,
 * every placement a square. The patch to write, or null when the answer is not one the form allows. The
 * record's `choice` stays the row's key; the answer to it lands as `picked`.
 * @param {object} record
 * @param {{ profileId: string|null, pick?: { uuid: string, name: string, img?: string|null }|null, choice?: string|null,
 *   placements: Array<{ x: number, y: number, elevation?: number, rotation?: number, level?: string|null }>,
 *   count: number, sceneId: string|null, creatureSize?: string|null, creatureType?: string|null }} answer
 * @param {Record<string, { options: string[] }>} table  SUMMON_CHOICES
 */
export function placedAnswer(record, answer, table) {
  if ( record?.status !== "asked" ) return null;
  const rows = record.profiles ?? [];
  const profile = rows.length === 1 ? rows[0] : rows.find(p => p.id === answer?.profileId) ?? null;
  if ( !profile ) return null;
  const needsPool = !profile.uuid && (profile.cr !== null);
  if ( needsPool && !answer?.pick?.uuid ) return null;
  let picked = null;
  if ( record.choice ) {
    const row = table?.[record.choice];
    if ( !row?.options?.includes(answer?.choice ?? "") ) return null;
    picked = answer.choice;
  }
  const placements = (answer?.placements ?? []).filter(p => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
    .map(p => ({ x: Number(p.x), y: Number(p.y), elevation: Number(p.elevation) || 0, rotation: Number(p.rotation) || 0, level: p.level ?? null }));
  if ( !placements.length ) return null;
  return {
    status: "placed", profileId: profile.id, profileName: profile.name || profile.label || answer?.pick?.name || "",
    summonUuid: profile.uuid ?? answer?.pick?.uuid ?? null, summonName: answer?.pick?.name || profile.label || profile.name || "",
    picked, placements, count: Math.max(1, Number(answer?.count) || placements.length),
    sceneId: answer?.sceneId ?? record.sceneId ?? null,
    creatureSize: answer?.creatureSize ?? null, creatureType: answer?.creatureType ?? null,
    placedAt: Date.now()
  };
}

/**
 * The item update that narrows an item's damage to the chosen type: every part listing the type keeps
 * only it. A part that never listed the type is left alone. Null when no part listed it.
 * @param {Record<string, { damage?: { parts?: Array<{ types?: string[] }> } }>} activities  the item's activities as plain data, by id
 * @param {string} type
 * @returns {Record<string, Array<object>>|null}  `system.activities.<id>.damage.parts` → the narrowed parts
 */
export function narrowedActivities(activities, type) {
  const want = String(type ?? "").toLowerCase();
  if ( !want ) return null;
  const out = /** @type {Record<string, Array<object>>} */ ({});
  for ( const [id, a] of Object.entries(activities ?? {}) ) {
    const parts = a?.damage?.parts ?? [];
    if ( !parts.some(p => (p?.types ?? []).map(t => String(t).toLowerCase()).includes(want)) ) continue;
    out[`system.activities.${id}.damage.parts`] = parts.map(p => {
      const types = (p?.types ?? []).map(t => String(t).toLowerCase());
      return types.includes(want) ? { ...p, types: [want] } : p;
    });
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The effect that shares the spirit's resistance with the caster for the spell's life: one `ADD` on
 * the damage-resistance trait (Foundry's ACTIVE_EFFECT_MODES.ADD is 2).
 * @param {{ type: string, name: string, img?: string|null, origin?: string|null, description?: string }} facts
 */
export function resistanceEffectData({ type, name, img = null, origin = null, description = "" }) {
  const t = String(type ?? "").toLowerCase();
  return {
    name, img: img ?? "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp",
    type: "base", description, disabled: false, transfer: false, origin: origin ?? null,
    changes: [{ key: "system.traits.dr.value", mode: 2, value: t, priority: null }]
  };
}

/**
 * The ownership the elect grants on the summoned creature's world actor: every user who OWNS the
 * caster (level 3, the default excluded) and does not yet own the creature. Null when no one is missing.
 * @param {Record<string, number>} casterOwnership
 * @param {Record<string, number>} actorOwnership
 * @returns {Record<string, number>|null}
 */
export function ownershipGrant(casterOwnership, actorOwnership) {
  const patch = /** @type {Record<string, number>} */ ({});
  for ( const [id, level] of Object.entries(casterOwnership ?? {}) ) {
    if ( (id === "default") || (Number(level) < 3) ) continue;
    if ( Number(actorOwnership?.[id] ?? 0) >= 3 ) continue;
    patch[id] = 3;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * Where the summoned creature sits in the tracker: the caster's Initiative, a hair below it, so it acts
 * right after the caster (the 2024 Summon spells: "takes its turn immediately after yours"). Null when
 * the caster has none.
 * @param {number|null|undefined} casterInitiative
 */
export function seatInitiative(casterInitiative) {
  if ( (casterInitiative === null) || (casterInitiative === undefined) ) return null;
  const n = Number(casterInitiative);
  return Number.isFinite(n) ? Math.round((n - 0.01) * 100) / 100 : null;
}
