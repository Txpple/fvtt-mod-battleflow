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
 * Whether a profile picks its creature from the pool. A `cr`-mode activity always does: the PHB's Find
 * Familiar ships its "CR 0 Beast" profile with the Bat's uuid beside the cap, a default the system's own
 * browser never reads. A record from before the mode was stamped falls back to "a cap and no creature".
 * @param {{ uuid: string|null, cr: string|null }} profile
 * @param {string|null|undefined} mode   the activity's `summon.mode`
 */
export const poolPicks = (profile, mode) => (profile?.cr !== null) && (profile?.cr !== undefined) && ((mode === "cr") || !profile.uuid);

/**
 * The answer the popup must take for one of the activity's own lists (creature types, sizes): asked
 * when it offers more than one, the one when it offers one, null when it offers none.
 * @param {string[]|null|undefined} list
 * @param {string|null|undefined} answer
 * @returns {{ ok: boolean, value: string|null }}
 */
export function listAnswer(list, answer) {
  const options = list ?? [];
  if ( options.length === 0 ) return { ok: true, value: null };
  if ( options.length === 1 ) return { ok: true, value: options[0] ?? null };
  return options.includes(answer ?? "") ? { ok: true, value: /** @type {string} */ (answer) } : { ok: false, value: null };
}

/**
 * What the one popup must ask: the form when more than one profile stands, the spell's own choice
 * when a row names one, the pool when a profile picks from it (`poolPicks`), the creature type and the
 * size when the activity offers more than one (Find Familiar's Celestial, Fey or Fiend). Nothing to ask
 * means the popup is placement alone (a Tier 2 object, a one-profile spell with no choice).
 * @param {{ profiles: Array<{ uuid: string|null, cr: string|null }>, choice: string|null, mode?: string|null,
 *   creatureTypes?: string[]|null, creatureSizes?: string[]|null }} facts
 * @returns {{ profile: boolean, pool: boolean, choice: boolean, type: boolean, size: boolean, any: boolean }}
 */
export function formNeeds({ profiles, choice, mode = null, creatureTypes = null, creatureSizes = null }) {
  const rows = profiles ?? [];
  const need = {
    profile: rows.length > 1, pool: rows.some(p => poolPicks(p, mode)), choice: !!choice,
    type: (creatureTypes?.length ?? 0) > 1, size: (creatureSizes?.length ?? 0) > 1
  };
  return { ...need, any: need.profile || need.pool || need.choice || need.type || need.size };
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
 * @param {string|null} [facts.mode]         the activity's `summon.mode` ("cr" picks from the pool)
 * @param {string[]} [facts.creatureTypes]   the types the activity offers (more than one is asked)
 * @param {string[]} [facts.creatureSizes]   the sizes the activity offers (more than one is asked)
 * @param {number|null} [facts.rangeFt]      the spell's range in feet; null places anywhere the caster can see
 * @param {Array<{ guise: string, name: string }>|null} [facts.guises]  the SUMMON_GUISES row's guises (`guisesOf`), or null
 */
export function summonRecord({ sourceUuid, sourceName, itemUuid, itemName, activityUuid, level, profiles, choice, concentrationId, sceneId,
  mode = null, creatureTypes = [], creatureSizes = [], rangeFt = null, guises = null }) {
  return {
    status: "asked", sourceUuid, sourceName, itemUuid, itemName, activityUuid,
    level: Number(level) || 0, profiles: [...(profiles ?? [])], choice: choice ?? null,
    concentrationId: concentrationId ?? null, sceneId: sceneId ?? null,
    mode: mode ?? null, creatureTypes: [...(creatureTypes ?? [])], creatureSizes: [...(creatureSizes ?? [])],
    rangeFt: Number.isFinite(Number(rangeFt)) && (rangeFt !== null) ? Number(rangeFt) : null,
    guises: guises?.length ? guises.map(g => ({ guise: g.guise, name: g.name })) : null, askedAt: Date.now()
  };
}

/**
 * A SUMMON_GUISES row's guises as the menu and the record carry them: `{ guise, name }`, the name with
 * `{guise}` filled ("Spiritual Mace"). Empty for no row.
 * @param {{ name: string, guises: string[] }|null|undefined} row
 * @returns {Array<{ guise: string, name: string }>}
 */
export function guisesOf(row) {
  const name = String(row?.name ?? "{guise}");
  return (row?.guises ?? []).map(g => ({ guise: g, name: name.replace("{guise}", g) }));
}

/**
 * Two axis-aligned footprints overlap; a square is its interior, so two tokens edge to edge do not.
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 */
export function footprintsOverlap(a, b) {
  const eps = 1;
  return (b.x < a.x + a.w - eps) && (b.x + b.w > a.x + eps) && (b.y < a.y + a.h - eps) && (b.y + b.h > a.y + eps);
}

/**
 * The spot a player clicked for a summoned creature, judged in the order the spells word it: within
 * range, a space the caster can see (no sight-blocking wall between), unoccupied. `{ ok, why }`.
 * @param {{ distanceFt: number|null, rangeFt: number|null, blocked: boolean, occupied: boolean }} facts
 * @returns {{ ok: boolean, why: string|null }}
 */
export function spotVerdict({ distanceFt, rangeFt, blocked, occupied }) {
  if ( (rangeFt !== null) && (distanceFt !== null) && (distanceFt > rangeFt) ) return { ok: false, why: `beyond the spell's range (${rangeFt} ft)` };
  if ( blocked ) return { ok: false, why: "a wall blocks your sight of that space" };
  if ( occupied ) return { ok: false, why: "that space is occupied" };
  return { ok: true, why: null };
}

/**
 * A range as feet, for the placement ring: feet as they are, miles in feet, touch as 5 ft; self, any,
 * special or an unknown unit is null (no ring, no range check — the sight check still stands).
 * @param {{ value?: number|string|null, units?: string|null }|null|undefined} range   the activity's range
 * @returns {number|null}
 */
export function rangeFeet(range) {
  const units = String(range?.units ?? "");
  if ( units === "touch" ) return 5;
  const n = Number(range?.value);
  if ( !Number.isFinite(n) || (n <= 0) ) return null;
  if ( units === "ft" ) return n;
  if ( units === "mi" ) return n * 5280;
  if ( units === "m" ) return n * 10 / 3;   // the metric rule: 1.5 m a square, 5 ft a square
  if ( units === "km" ) return n * 10000 / 3;
  return null;
}

/**
 * The popup's answer folded into an `asked` record, judged: the profile is one of the record's, the
 * choice one of the row's options when a row stands, the pool pick present when the profile needs one,
 * the creature type and size among the activity's when it offers more than one, every placement a
 * square. The patch to write, or null when the answer is not one the form allows. The record's
 * `choice` stays the row's key; the answer to it lands as `picked`.
 * @param {object} record
 * @param {{ profileId: string|null, pick?: { uuid: string, name: string, img?: string|null }|null, choice?: string|null,
 *   placements: Array<{ x: number, y: number, elevation?: number, rotation?: number, level?: string|null }>,
 *   count: number, sceneId: string|null, creatureSize?: string|null, creatureType?: string|null, intoPocket?: boolean, guise?: string|null }} answer
 * @param {Record<string, { options: string[] }>} table  SUMMON_CHOICES
 */
export function placedAnswer(record, answer, table) {
  if ( record?.status !== "asked" ) return null;
  const rows = record.profiles ?? [];
  const profile = rows.length === 1 ? rows[0] : rows.find(p => p.id === answer?.profileId) ?? null;
  if ( !profile ) return null;
  const needsPool = poolPicks(profile, record.mode);
  if ( needsPool && !answer?.pick?.uuid ) return null;
  const type = listAnswer(record.creatureTypes, answer?.creatureType);
  const size = listAnswer(record.creatureSizes, answer?.creatureSize);
  if ( !type.ok || !size.ok ) return null;
  let picked = null;
  if ( record.choice ) {
    const row = table?.[record.choice];
    if ( !row?.options?.includes(answer?.choice ?? "") ) return null;
    picked = answer.choice;
  }
  // a guise the spell offers (SUMMON_GUISES): the creature lands named for it
  const guise = record.guises?.length ? (record.guises.find(g => g.guise === answer?.guise) ?? null) : null;
  if ( record.guises?.length && !guise ) return null;
  const placements = (answer?.placements ?? []).filter(p => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
    .map(p => ({ x: Number(p.x), y: Number(p.y), elevation: Number(p.elevation) || 0, rotation: Number(p.rotation) || 0, level: p.level ?? null }));
  if ( !placements.length ) return null;
  return {
    status: "placed", profileId: profile.id, profileName: profile.name || profile.label || answer?.pick?.name || "",
    summonUuid: (needsPool ? answer?.pick?.uuid : profile.uuid) ?? null,
    summonName: guise?.name || (needsPool ? answer?.pick?.name : null) || profile.label || profile.name || "",
    guise: guise?.guise ?? null,
    picked, placements, count: Math.max(1, Number(answer?.count) || placements.length),
    sceneId: answer?.sceneId ?? record.sceneId ?? null,
    creatureSize: size.value, creatureType: type.value,
    intoPocket: !!answer?.intoPocket,
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

/**
 * The earlier summons a new one replaces (SUMMON_SINGLES): the same caster's records of the same spell
 * that landed and still stand, never the new one itself. Empty when the spell is not a single.
 * @param {Array<{ id: string, flag: object|null|undefined }>} records   every card's summon record, by message id
 * @param {{ id: string, sourceUuid: string, itemName: string }} current  the record that just landed
 * @param {Set<string>} singles   lower-cased SUMMON_SINGLES keys
 * @returns {string[]}  the message ids to dismiss
 */
export function replacedSummons(records, current, singles) {
  const item = String(current?.itemName ?? "").toLowerCase();
  if ( !item || !singles?.has?.(item) ) return [];
  return (records ?? []).filter(({ id, flag }) => (id !== current.id) && !!flag?.applied && !flag.dismissAsked && !flag.dismissed
    && (flag.outcome !== "failed") && (flag.sourceUuid === current.sourceUuid) && (String(flag.itemName ?? "").toLowerCase() === item))
    .map(r => r.id);
}

/* --- the menu before the cast (RULINGS *Summons*, the second sandbox pass) ----------------------- */

/**
 * The sizes an activity offers, smallest first, by the system's own size order; a size the order does
 * not know keeps its place after the known ones.
 * @param {string[]|null|undefined} sizes
 * @param {string[]} order   the size keys, smallest first (`Object.keys(CONFIG.DND5E.actorSizes)`)
 * @returns {string[]}
 */
export function sizesInOrder(sizes, order) {
  const rank = s => { const i = (order ?? []).indexOf(s); return (i < 0) ? Number.MAX_SAFE_INTEGER : i; };
  return [...(sizes ?? [])].map((s, i) => ({ s, i })).sort((a, b) => (rank(a.s) - rank(b.s)) || (a.i - b.i)).map(x => x.s);
}

/**
 * The effect a summon without Concentration lands on its caster for as long as it stands: its removal
 * dismisses the summon (RULINGS *Summons*: a Concentration summon needs none, Concentration
 * ends it). The spell's name, and the creature's when the spell makes more than one kind.
 * @param {{ itemName: string, creatureName?: string|null }} facts
 */
export function summonEffectName({ itemName, creatureName = null }) {
  const item = String(itemName ?? "").trim();
  const creature = String(creatureName ?? "").trim();
  if ( !creature || creature.toLowerCase().includes(item.toLowerCase()) || item.toLowerCase().includes(creature.toLowerCase()) ) return item;
  return `${item}: ${creature}`;
}

/**
 * A token's light from a row's radii and look: the token document's `light` fields. `dim` is the OUTER
 * radius; a look's missing field leaves the token's own.
 * @param {{ bright: number, dim: number, look?: { color?: string, alpha?: number, luminosity?: number, attenuation?: number,
 *   animation?: { type: string, speed?: number, intensity?: number } } }} row
 * @returns {Record<string, unknown>}
 */
export function tokenLight(row) {
  const bright = Math.max(0, Number(row?.bright) || 0);
  const dim = Math.max(bright, Number(row?.dim) || 0);
  /** @type {Record<string, unknown>} */
  const out = { bright, dim };
  const look = row?.look;
  if ( look?.color ) out.color = look.color;
  for ( const k of /** @type {const} */ (["alpha", "luminosity", "attenuation"]) ) if ( Number.isFinite(look?.[k]) ) out[k] = look?.[k];
  // a look with no flicker is steady: the creature's own animation (the pack's Light flames) is put out
  if ( look && !look.animation?.type ) out.animation = { type: null };
  else if ( look?.animation?.type ) out.animation = { type: look.animation.type,
    ...(Number.isFinite(look.animation.speed) ? { speed: look.animation.speed } : {}),
    ...(Number.isFinite(look.animation.intensity) ? { intensity: look.animation.intensity } : {}) };
  return out;
}

/**
 * A Summon spell's creature named by its form, then its type: two words where the form is one ("Tricksy
 * Fey", "Putrid Undead", "Air Beast", "Clay Construct", "Fire Dragon"). The type is the spell's ("Summon
 * Fey" → Fey); the form is the creature's name without "Spirit", "Bestial" and the type itself; a creature
 * the spell names by a picked type (the Draconic Spirit) takes the pick. Null for any other spell, or when
 * no form is left.
 * @param {string|null|undefined} spellName
 * @param {string|null|undefined} creatureName  the book's name ("Tricksy Fey Spirit")
 * @param {string|null} [picked]                the spell's own choice, as its label ("Fire")
 * @returns {string|null}
 */
export function formName(spellName, creatureName, picked = null) {
  const m = /^Summon\s+(.+)$/i.exec(String(spellName ?? "").trim());
  if ( !m ) return null;
  const type = (m[1] ?? "").trim();
  const drop = new Set(["spirit", "bestial", "draconic", ...type.toLowerCase().split(/\s+/)]);
  const form = picked ? String(picked).trim()
    : String(creatureName ?? "").split(/\s+/).filter(w => w && !drop.has(w.toLowerCase())).join(" ");
  return form ? `${form} ${type}` : null;
}

/* --- companions: a summon that stays (COMPANIONS) ------------------------------------------------ */

/**
 * The effect's name on the companion's owner, the one place the table sees it: "Familiar: Owl (Fey)",
 * and "· in the pocket" while it waits there.
 * @param {{ noun: string, name: string, type?: string|null, pocket?: boolean }} facts
 */
export function companionEffectName({ noun, name, type = null, pocket = false }) {
  return `${noun}: ${name}${type ? ` (${type})` : ""}${pocket ? " · in the pocket" : ""}`;
}

/**
 * The owner's companion of this spell that stands — on the table or in the pocket — as its message id,
 * the latest landed when there are more; null when there is none.
 * @param {Array<{ id: string, flag: object|null|undefined }>} records
 * @param {string} sourceUuid
 * @param {string} itemName
 * @returns {string|null}
 */
export function currentCompanion(records, sourceUuid, itemName) {
  const item = String(itemName ?? "").toLowerCase();
  const standing = (records ?? []).filter(({ flag }) => !!flag?.applied && !flag.dismissAsked && !flag.dismissed && (flag.outcome !== "failed")
    && !!flag.companion && (flag.companion.state !== "gone") && (flag.sourceUuid === sourceUuid) && (String(flag.itemName ?? "").toLowerCase() === item));
  standing.sort((a, b) => (Number(b.flag.placedAt) || 0) - (Number(a.flag.placedAt) || 0));
  return standing[0]?.id ?? null;
}

/**
 * The cast menu while a companion stands: put it away or call it back (as it stands), dismiss it
 * forever, or cast for a new form. `pocket` false offers no pocket.
 * @param {"present"|"pocket"} state
 * @param {{ pocket?: boolean }} row
 * @returns {string[]}  of away · recall · dismiss · summon
 */
export function companionMenu(state, { pocket = true } = {}) {
  const first = !pocket ? [] : (state === "pocket") ? ["recall"] : ["away"];
  return [...first, "dismiss", "summon"];
}

/**
 * A player's ask of a standing companion, judged against its state: away from the table, a recall
 * from the pocket with a square to land on. The patch to the record's `companion`, or null.
 * @param {{ state: string, ask?: object|null }|null|undefined} companion
 * @param {{ kind: string, placement?: { x: number, y: number, elevation?: number, sceneId: string|null } }} ask
 */
export function companionAsk(companion, ask) {
  if ( !companion || companion.ask ) return null;
  if ( (ask?.kind === "away") && (companion.state === "present") ) return { ask: { kind: "away", at: Date.now() } };
  const p = ask?.placement;
  if ( (ask?.kind === "recall") && (companion.state === "pocket") && Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)) && p?.sceneId ) {
    return { ask: { kind: "recall", placement: { x: Number(p.x), y: Number(p.y), elevation: Number(p.elevation) || 0, sceneId: p.sceneId }, at: Date.now() } };
  }
  return null;
}

/** The item types a creature carries rather than is: what it leaves behind (its natural weapons are its stat block's). */
const CARRIED = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);

/**
 * What a companion leaves behind at 0 HP or into the pocket: every carried item that was not in its
 * stat block when it landed.
 * @param {Array<{ id: string, type: string }>} items
 * @param {string[]} baseItems   the item ids it landed with
 * @returns {string[]}
 */
export function carriedItemIds(items, baseItems) {
  const base = new Set(baseItems ?? []);
  return (items ?? []).filter(i => !base.has(i.id) && CARRIED.has(i.type)).map(i => i.id);
}
