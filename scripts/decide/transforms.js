// @ts-check
/**
 * By the Books — DECISION layer (ARCHITECTURE.md §2): TRANSFORMS (issue #2) — what a listed transform
 * activity asks before the form exists, the record the owner's client writes on the use's card, the Known
 * Forms a Wild Shape item holds and how they change, and what ends a form (RULINGS *Wild Shape and the
 * polymorph spells*; the shared gallery's rows are decide/gallery.js). ⚠ PURE: no `game`, no imports.
 */

/**
 * The gallery rule a transform profile allows: the cap (the profile's own, else the targeted creature's —
 * Polymorph's cap ships blank, the rule says "the target's Challenge Rating or level"), the creature
 * types, the sizes, and a fly ban when the profile's movement filter names `fly` (dnd5e's filter is a
 * NEGATIVE one: Wild Shape before level 8 lists `fly` to exclude fliers).
 * @param {{ cr?: number|null, types?: string[], sizes?: string[], movement?: string[] }} profile  the cap evaluated
 * @param {{ targetCap?: number|null }} [facts]
 * @returns {{ crMax: number|null, types: string[]|null, fly: boolean|null, sizes: string[]|null }}
 */
export function poolRuleOf(profile, { targetCap = null } = {}) {
  const own = Number(profile?.cr);
  const crMax = Number.isFinite(own) && (profile?.cr !== null) && (profile?.cr !== undefined) ? own
    : (Number.isFinite(Number(targetCap)) && (targetCap !== null)) ? Number(targetCap) : null;
  return {
    crMax,
    types: profile?.types?.length ? [...profile.types] : null,
    fly: (profile?.movement ?? []).map(m => String(m).toLowerCase()).includes("fly") ? false : null,
    sizes: profile?.sizes?.length ? [...profile.sizes] : null
  };
}

/**
 * The cap a blank-cap transform takes from its target: "a Challenge Rating equal to or less than the
 * target's (or the target's level if it doesn't have a Challenge Rating)". Null when neither is known.
 * @param {{ cr?: number|string|null, level?: number|string|null }} target
 */
export function capOfTarget({ cr = null, level = null } = {}) {
  const c = (cr === null || cr === undefined || cr === "") ? Number.NaN : Number(cr);
  const l = (level === null || level === undefined || level === "") ? Number.NaN : Number(level);
  if ( Number.isFinite(c) && (c > 0) ) return c;
  if ( Number.isFinite(l) && (l > 0) ) return l;
  if ( Number.isFinite(c) ) return c;
  return Number.isFinite(l) ? l : null;
}

/**
 * The Known Forms slots a row grants: its own number, or the number of the row it points at (Circle
 * Forms spends Wild Shape's forms). Zero when the row keeps no list.
 * @param {Record<string, { known?: number|string }>} table
 * @param {string|null|undefined} key
 */
export function knownSlotsOf(table, key) {
  const row = key ? table?.[key] : null;
  if ( !row ) return 0;
  if ( typeof row.known === "number" ) return Math.max(0, row.known);
  if ( typeof row.known === "string" ) return knownSlotsOf(table, row.known);
  return 0;
}

/**
 * The row whose item holds the Known Forms list for this row: itself, or the one it points at.
 * @param {Record<string, { known?: number|string }>} table
 * @param {string|null|undefined} key
 */
export function knownHolderOf(table, key) {
  const row = key ? table?.[key] : null;
  if ( !row ) return null;
  if ( typeof row.known === "number" ) return key ?? null;
  if ( typeof row.known === "string" ) return knownHolderOf(table, row.known);
  return null;
}

/**
 * Where a Known Forms list stands against its slots.
 * @param {{ known: Array<{ uuid: string }>, slots: number }} facts
 * @returns {{ state: "none"|"open"|"full"|"over", open: number }}
 */
export function knownState({ known, slots }) {
  const n = known?.length ?? 0;
  if ( !(slots > 0) ) return { state: "none", open: 0 };
  if ( n > slots ) return { state: "over", open: 0 };
  if ( n < slots ) return { state: "open", open: slots - n };
  return { state: "full", open: 0 };
}

/**
 * A form learned into an open slot: the list with it appended, or null when the slot is not open or
 * the form is already known.
 * @param {{ known: Array<{ uuid: string, name: string, img?: string|null }>, slots: number, learn: { uuid: string, name: string, img?: string|null } }} facts
 */
export function learnedList({ known, slots, learn }) {
  const list = [...(known ?? [])];
  if ( !learn?.uuid || !(list.length < (Number(slots) || 0)) ) return null;
  if ( list.some(k => k.uuid === learn.uuid) ) return null;
  return [...list, { uuid: learn.uuid, name: learn.name ?? "", img: learn.img ?? null }];
}

/**
 * The Long Rest's change to the Known Forms: open slots filled from `adds` (unique, not known, at most
 * the open count), then the one swap when both ends are named (the PHB: "you can replace one of your
 * known forms with another eligible form"). The new list, or null when the change is not one the rule
 * allows; the unchanged list when nothing was asked.
 * @param {{ known: Array<{ uuid: string, name: string, img?: string|null }>, slots: number,
 *   out?: string|null, into?: { uuid: string, name: string, img?: string|null }|null, adds?: Array<{ uuid: string, name: string, img?: string|null }> }} facts
 */
export function restKnownList({ known, slots, out = null, into = null, adds = [] }) {
  let list = [...(known ?? [])];
  const open = (Number(slots) || 0) - list.length;
  const unique = [];
  for ( const a of adds ?? [] ) {
    if ( !a?.uuid || unique.some(u => u.uuid === a.uuid) ) continue;
    unique.push({ uuid: a.uuid, name: a.name ?? "", img: a.img ?? null });
  }
  if ( unique.length ) {
    if ( (unique.length > Math.max(0, open)) || unique.some(u => list.some(k => k.uuid === u.uuid)) ) return null;
    list = [...list, ...unique];
  }
  if ( out || into ) {
    if ( !out || !into?.uuid || (out === into.uuid) ) return null;
    if ( !list.some(k => k.uuid === out) || list.some(k => k.uuid === into.uuid) ) return null;
    list = list.map(k => (k.uuid === out) ? { uuid: into.uuid, name: into.name ?? "", img: into.img ?? null } : k);
  }
  return list;
}

/**
 * The record the owner's client writes on the use's card: `asked` until the popup answers (`picked`
 * at birth when the profile names its creature — the Necklaces, Harkon's Bite), `picked` once a form
 * is chosen, `applied` once the elect transformed.
 * @param {object} facts
 * @param {string} facts.key               the TRANSFORMS row
 * @param {string} facts.sourceUuid        the one whose activity it is
 * @param {string} facts.sourceName
 * @param {string} facts.itemUuid
 * @param {string} facts.itemName
 * @param {string} facts.itemType          "feat" | "spell" | "equipment" — the moment word reads it
 * @param {string} facts.activityUuid
 * @param {{ id: string, cr: number|null, types: string[], sizes: string[], movement: string[], uuid: string|null, name?: string }} facts.profile  the band in force, its cap evaluated
 * @param {boolean} facts.self
 * @param {Array<{ uuid: string, name: string }>} facts.targets  the creatures transformed (the owner alone for a `self` row)
 * @param {number|null} facts.targetCap    the cap read off the first target when the profile's is blank
 * @param {Array<{ uuid: string, name: string, img?: string|null }>} facts.known  the Known Forms in force
 * @param {number} facts.slots
 * @param {string|null} facts.lastForm     the uuid of the form last taken
 * @param {string|null} facts.concentrationId
 * @param {string|null} facts.sceneId
 */
export function transformRecord({ key, sourceUuid, sourceName, itemUuid, itemName, itemType, activityUuid, profile, self, targets, targetCap, known, slots, lastForm, concentrationId, sceneId }) {
  const fixed = profile?.uuid ? { uuid: profile.uuid, name: profile.name ?? "", img: null } : null;
  return {
    status: fixed ? "picked" : "asked", key, sourceUuid, sourceName, itemUuid, itemName, itemType: itemType ?? "feat", activityUuid,
    profile: { id: profile?.id ?? null, cr: (profile?.cr ?? null), types: [...(profile?.types ?? [])], sizes: [...(profile?.sizes ?? [])],
      movement: [...(profile?.movement ?? [])], uuid: profile?.uuid ?? null, name: profile?.name ?? "" },
    self: !!self, targets: [...(targets ?? [])].map(t => ({ uuid: t.uuid, name: t.name ?? "" })),
    targetCap: targetCap ?? null, known: [...(known ?? [])], slots: Number(slots) || 0, lastForm: lastForm ?? null,
    concentrationId: concentrationId ?? null, sceneId: sceneId ?? null,
    ...(fixed ? { pick: fixed, pickedAt: Date.now() } : {}), askedAt: Date.now()
  };
}

/**
 * The popup's answer folded into an `asked` record, judged: with Known Forms enforced the pick is one
 * of the known forms, or — while a slot is open — a form learned into it at this use (`learn`). A
 * record with no slots takes any pick. The patch to write, or null when the answer is not one the
 * rule allows.
 * @param {{ status: string, known: Array<{ uuid: string }>, slots: number }} record
 * @param {{ pick: { uuid: string, name: string, img?: string|null }|null, learn?: boolean }} answer
 */
export function pickedAnswer(record, answer) {
  if ( record?.status !== "asked" ) return null;
  const pick = answer?.pick;
  if ( !pick?.uuid ) return null;
  const known = record.known ?? [];
  const slots = Number(record.slots) || 0;
  const patch = { status: "picked", pick: { uuid: pick.uuid, name: pick.name ?? "", img: pick.img ?? null }, pickedAt: Date.now() };
  if ( !(slots > 0) ) return patch;
  if ( known.some(k => k.uuid === pick.uuid) ) return patch;
  if ( !answer?.learn || !(known.length < slots) ) return null;
  return { ...patch, learn: { ...patch.pick } };
}

/**
 * The effect the elect lands on the transformed creature: the form's clock on the effect view bar,
 * Revert on its fold, the tie back to the record. Its duration is the caller's (the activity's, or the
 * concentration effect's copy); a `dependentOn` ties it to the caster's Concentration so the spell's end
 * takes it with it.
 * @param {{ itemName: string, formName: string, img?: string|null, origin?: string|null, duration?: object|null,
 *   messageId: string, originalId: string, key: string, dependentOn?: string|null, description?: string }} facts
 */
export function formEffectData({ itemName, formName, img = null, origin = null, duration = null, messageId, originalId, key, dependentOn = null, description = "" }) {
  const data = {
    name: `${itemName} — ${formName}`, img: img ?? "icons/svg/paw.svg",
    type: "base", description, disabled: false, transfer: false, origin: origin ?? null,
    duration: { ...(duration ?? {}) },
    flags: { "fvtt-mod-bythebooks": { form: { messageId, originalId, key } } }
  };
  if ( dependentOn ) data.flags.dnd5e = { dependentOn };
  return data;
}

/**
 * What ended the form, if anything, read off what changed on the transformed creature: the
 * Incapacitated condition landing, the Hit Points reaching 0, the Temporary Hit Points running out —
 * each only when the row's `ends` names it. Null when nothing the row cares about happened.
 * @param {readonly string[]} ends   the row's `ends`
 * @param {{ hpValue?: number|null, tempValue?: number|null, tempBefore?: number|null, statuses?: string[] }} facts
 *   `hpValue` / `tempValue`: the values that CHANGED (null when untouched); `statuses`: those landing now
 * @returns {{ why: string, word: string }|null}
 */
export function endOfForm(ends, { hpValue = null, tempValue = null, tempBefore = null, statuses = [] } = {}) {
  const list = (ends ?? []).map(e => String(e).toLowerCase());
  if ( list.includes("incapacitated") && (statuses ?? []).map(s => String(s).toLowerCase()).includes("incapacitated") ) {
    return { word: "incapacitated", why: "the Incapacitated condition" };
  }
  if ( list.includes("zero") && (hpValue !== null) && (Number(hpValue) <= 0) ) return { word: "zero", why: "dropped to 0 Hit Points" };
  if ( list.includes("notemp") && (tempValue !== null) && (Number(tempValue) <= 0) && ((tempBefore === null) || (Number(tempBefore) > 0)) ) {
    return { word: "noTemp", why: "no Temporary Hit Points left" };
  }
  return null;
}

/**
 * The card's title once the form landed, or after it ended.
 * @param {{ who: string, form: string, ended?: { why: string }|null, failed?: boolean }} facts
 */
export function formTitle({ who, form, ended = null, failed = false }) {
  if ( failed ) return `${who} — the form could not be taken`;
  if ( ended ) return `${who} is no longer ${articleOf(form)} ${form} — ${ended.why}`;
  return `${who} is now ${articleOf(form)} ${form}`;
}

/* --- the familiar empowered (a SUMMON_EMPOWERS spell on a `subject: "companion"` row) ------------- */

/**
 * dnd5e's transformation setting for an empower row: the row's `keep` and `effects`, nothing merged, the
 * form's Hit Points at the cast level as the Temporary Hit Points (a number, so no roll data is needed),
 * the token transformed with the creature.
 * @param {{ keep?: readonly string[], effects?: readonly string[] }} row
 * @param {number} tempHp
 */
export function empowerSetting(row, tempHp) {
  return { effects: [...(row?.effects ?? [])], keep: [...(row?.keep ?? [])], merge: [], tempFormula: String(Math.max(0, Math.round(Number(tempHp) || 0))), transformTokens: true };
}

/**
 * The Temporary Hit Points the empowered familiar gains: the form's Hit Point maximum plus the summon
 * activity's own Hit Point bonus at the cast level (the Brute's 30, +5 a level above 2nd).
 * @param {{ formHpMax: number|null|undefined, hpBonus: number|null|undefined }} facts
 */
export const empowerTempHp = ({ formHpMax, hpBonus }) => Math.max(0, (Number(formHpMax) || 0) + (Number(hpBonus) || 0));

/**
 * The summon activity's own changes, applied on top of the transform: dnd5e's `getChanges` with its Hit
 * Point branch (the form's Hit Points are the Temporary Hit Points here, the familiar's own are kept) and its
 * creature-type branch (the familiar keeps its type) set aside. The actor update, the effects to create and
 * the item updates, apart.
 * @param {Record<string, unknown> & { effects?: object[], items?: object[] }} actorUpdates
 * @returns {{ updates: Record<string, unknown>, effects: object[], items: object[] }}
 */
export function empowerUpdates(actorUpdates) {
  const updates = /** @type {Record<string, unknown>} */ ({});
  for ( const [k, v] of Object.entries(actorUpdates ?? {}) ) {
    if ( (k === "effects") || (k === "items") ) continue;
    if ( k.startsWith("system.attributes.hp") || k.startsWith("system.details.type") ) continue;
    updates[k] = v;
  }
  // a type landed on a race item is a character's shape, never a familiar's: the item updates pass as they are
  return { updates, effects: [...(actorUpdates?.effects ?? [])], items: [...(actorUpdates?.items ?? [])] };
}

/**
 * A record's landed token entries re-pointed at the token the revert made (dnd5e's revert of an unlinked
 * token creates a new one): the entry that named the old token takes the new token's facts.
 * @param {Array<{ tokenId: string, sceneId: string, tokenUuid: string, actorUuid: string|null, name: string }>} landed
 * @param {{ oldTokenId: string, tokenId: string, sceneId: string, tokenUuid: string, actorUuid: string|null, name: string }} token
 */
export function repointedLanded(landed, { oldTokenId, tokenId, sceneId, tokenUuid, actorUuid, name }) {
  return (landed ?? []).map(l => (l.tokenId === oldTokenId) ? { ...l, tokenId, sceneId, tokenUuid, actorUuid: actorUuid ?? null, name } : l);
}

/** "a" or "an" for a form's name. @param {string} name */
export const articleOf = name => /^[aeiou]/i.test(String(name ?? "").trim()) ? "an" : "a";
