// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE CARD SEAM over dnd5e's typed card data (NOTES §2
 * *the 6.0 pass*): kind, targets, origin. ⚠ Reads `type` and `system.*` only; PURE, takes a message
 * or a roll's pre-create DATA. ⚠ THE TARGET KEY IS THE ACTOR: the platform lists one row per TOKEN;
 * `targetsOf` folds two tokens of one linked actor to ONE row.
 */

/** By `type` (dnd5e 6.0 `data/chat-message/_module.mjs`). */
export const CARD = Object.freeze({
  attack: "attack",
  damage: "damage",
  healing: "healing",
  save: "save",
  check: "check",
  usage: "usage",
  generic: "generic",
  prompt: "prompt",
  base: "base"
});

/** @type {Set<string>} */
const ROLL_KINDS = new Set([CARD.attack, CARD.damage, CARD.healing, CARD.save, CARD.check]);

export function cardKind(msg) {
  return msg?.type || CARD.base;
}

export function isCard(msg, kind) {
  return cardKind(msg) === kind;
}

/** A roll card's kind, null for anything else. */
export function rollKindOf(msg) {
  const kind = cardKind(msg);
  return ROLL_KINDS.has(kind) ? kind : null;
}

/** The same, off a roll hook's `message.data`. */
export function rollKindInData(data) {
  const kind = data?.type;
  return (typeof kind === "string") && ROLL_KINDS.has(kind) ? kind : null;
}

/** A save: `ability` | `concentration` | `death`; a check: `ability` | `initiative`; else null. */
export function subKindOf(msg) {
  const kind = cardKind(msg);
  if ( (kind !== CARD.save) && (kind !== CARD.check) ) return null;
  return msg?.system?.type || "ability";
}

/* --- WHOSE: the targets ------------------------------------------------------------------------ */

export const TARGETS_KEY = "system.targets";

/**
 * Descriptors (either shape, 5.x `uuid` accepted) as the house shape, one row per actor.
 * @typedef {object} Target
 * @property {string} uuid          the target ACTOR's uuid — the key every record uses
 * @property {string} actor         the same, under 6.0's own name
 * @property {string|null} token
 * @property {string} name
 * @property {string|null} img
 * @property {number|null} ac       null under total cover or when unread
 * @returns {Target[]}
 */
function normaliseTargets(list) {
  /** @type {Target[]} */
  const out = [];
  const seen = new Set();
  for ( const t of (Array.isArray(list) ? list : []) ) {
    const actor = t?.actor ?? t?.uuid ?? null;
    if ( !actor || seen.has(actor) ) continue;
    seen.add(actor);
    out.push({
      uuid: actor,
      actor,
      token: t.token ?? null,
      name: t.name ?? "",
      img: t.img ?? null,
      ac: (t.ac === undefined) ? null : t.ac
    });
  }
  return out;
}

export function targetsOf(msg) {
  return normaliseTargets(msg?.system?.targets);
}

/**
 * Off pre-create DATA: NULL when no snapshot yet (read the live targets); empty means nobody aimed at.
 * @returns {Target[]|null}
 */
export function targetsInData(data) {
  const raw = data?.system?.targets ?? data?.[TARGETS_KEY];
  return Array.isArray(raw) ? normaliseTargets(raw) : null;
}

/**
 * The platform's descriptor shape (`TargetsField.getDescriptors`): the TOKEN's name, the actor's identity.
 * @param {{actorUuid: string, tokenUuid?: string|null, name: string, img?: string|null, ac?: number|null, totalCover?: boolean}} facts
 */
export function describeTarget({ actorUuid, tokenUuid = null, name, img = null, ac = null, totalCover = false }) {
  return { actor: actorUuid, token: tokenUuid, name, img, ac: totalCover ? null : (ac ?? null) };
}

/* --- FROM WHICH: the origin chain -------------------------------------------------------------- */

/**
 * ⚠ A DRIVEN roll has no click to read the card off, so it must be stamped here: the platform's
 * registry (`getAssociatedRolls`, outcomes, the delete cascade) indexes only this key.
 */
export const ORIGIN_KEY = "system.origin";

/** Spread into a roll's `message.data` to chain it to `id`. */
export function originData(id) {
  return { [ORIGIN_KEY]: id };
}

/** ⚠ Read off the SOURCE: the prepared field turns null once the origin message is deleted. */
export function originIdOf(msg) {
  const raw = msg?._source?.system?.origin;
  if ( (typeof raw === "string") && raw ) return raw;
  const o = msg?.system?.origin;
  if ( typeof o === "string" ) return o || null;
  return o?.id ?? null;
}

/** Off pre-create DATA, flattened or expanded. */
export function originIdInData(data) {
  const v = data?.system?.origin ?? data?.[ORIGIN_KEY];
  if ( (typeof v === "string") && v ) return v;
  return v?.id ?? null;
}

/* --- WHAT: the activity and the item behind a card --------------------------------------------- */

/** A SourceReferenceField `{id, type, uuid, name, img}`, or null. */
export function activityRefOf(msg) {
  const a = msg?.system?.activity;
  return (a && (a.uuid || a.id)) ? a : null;
}
export const activityUuidOf = msg => activityRefOf(msg)?.uuid ?? null;
export const activityTypeOf = msg => activityRefOf(msg)?.type ?? null;

export function itemRefOf(msg) {
  const i = msg?.system?.item;
  return (i && (i.uuid || i.id)) ? i : null;
}
export const itemUuidOf = msg => itemRefOf(msg)?.uuid ?? null;
export const itemNameOf = msg => itemRefOf(msg)?.name ?? null;

/* --- THE ROLL'S OWN FACTS: add a reader here with the file that needs it ----------------------- */

export const abilityOf = msg => msg?.system?.ability ?? null;

/** Written only when the wielder has the mastery. */
export const masteryOf = msg => msg?.system?.mastery ?? null;

/** `half` | `none` | `full`, or null: the demand decides. */
export const onSaveOf = msg => msg?.system?.onSave ?? null;

/** A save turned into a success after the fact (legendary resistance: an UPDATE on the save message). */
export const resistedOf = msg => msg?.system?.resisted === true;

export function castLevelOn(msg) {
  const level = msg?.system?.level;
  return Number.isFinite(Number(level)) && (level !== null) && (level !== undefined) ? Number(level) : null;
}

export const scalingOf = msg => Number(msg?.system?.scaling) || 0;

export const concentrationIdOf = msg => msg?.system?.concentration || null;

/* --- THE PLATFORM'S PROMPTS: buttons as data, read by TYPE ------------------------------------- */

const CONCENTRATION_PROMPT_BUTTONS = new Set(["concentration", "endConcentration"]);

/** The platform's own concentration prompt; concentration.js vetoes them while its machine runs. */
export function isConcentrationPrompt(msg) {
  if ( !isCard(msg, CARD.prompt) ) return false;
  const buttons = msg?.system?.buttons;
  return Array.isArray(buttons) && buttons.some(b => CONCENTRATION_PROMPT_BUTTONS.has(b?.type));
}
