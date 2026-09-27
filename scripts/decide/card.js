// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): THE CARD SEAM — what kind of card a message
 * is, whose it is, and from which card it came, read off the message's TYPED data. The one seam
 * over dnd5e's card data (NOTES §2 *the 6.0 pass*), so the next rename is one file.
 *
 * ⚠ Reads `type` and `system.*` only; the platform's `flags.dnd5e` fallbacks are courtesy, not
 * contract. A target row's 5.x `uuid` is accepted beside `actor`.
 * ⚠ PURE: takes a message-shaped object or a roll's pre-create DATA (flattened or expanded).
 * ⚠ THE TARGET KEY IS THE ACTOR: the platform lists one row per TOKEN; `targetsOf` gives every
 * reader `uuid` = the actor's, and folds two tokens of one linked actor to ONE row.
 */

/** The kinds a card can be, by `type` (dnd5e 6.0 `data/chat-message/_module.mjs`). */
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

/** The kinds that carry ROLLS. @type {Set<string>} */
const ROLL_KINDS = new Set([CARD.attack, CARD.damage, CARD.healing, CARD.save, CARD.check]);

/** What kind of card this is — its `type`, `base` when it has none. */
export function cardKind(msg) {
  return msg?.type || CARD.base;
}

/** Is this card of `kind`? The one-line guard at the head of every chain. */
export function isCard(msg, kind) {
  return cardKind(msg) === kind;
}

/** The roll kind of a roll card (`attack` | `damage` | `healing` | `save` | `check`), null for anything else. */
export function rollKindOf(msg) {
  const kind = cardKind(msg);
  return ROLL_KINDS.has(kind) ? kind : null;
}

/** The same, off a roll's pre-create DATA (`message.data` at a roll hook). */
export function rollKindInData(data) {
  const kind = data?.type;
  return (typeof kind === "string") && ROLL_KINDS.has(kind) ? kind : null;
}

/**
 * A save's or a check's SUB-kind: a save is `ability` | `concentration` | `death`; a check is
 * `ability` | `initiative`; anything else has none.
 */
export function subKindOf(msg) {
  const kind = cardKind(msg);
  if ( (kind !== CARD.save) && (kind !== CARD.check) ) return null;
  return msg?.system?.type || "ability";
}

/* --- WHOSE: the targets ------------------------------------------------------------------------ */

/** The key a snapshot is written under in a roll's message data. */
export const TARGETS_KEY = "system.targets";

/**
 * One list of descriptors — either shape — as the house shape, one row per actor.
 *
 * @typedef {object} Target  the house shape of one targeted creature
 * @property {string} uuid          the target ACTOR's uuid — the key every record uses
 * @property {string} actor         the same, under 6.0's own name
 * @property {string|null} token    the token that was targeted, when the platform recorded one
 * @property {string} name
 * @property {string|null} img
 * @property {number|null} ac       null under total cover (the platform nulls it) or when unread
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

/** The creatures a card was rolled against — `system.targets`, in the house shape. */
export function targetsOf(msg) {
  return normaliseTargets(msg?.system?.targets);
}

/**
 * The same off a usage's pre-create DATA, or NULL when it names no snapshot yet (read the live
 * targets then); an empty list means nobody was aimed at.
 * @returns {Target[]|null}
 */
export function targetsInData(data) {
  const raw = data?.system?.targets ?? data?.[TARGETS_KEY];
  return Array.isArray(raw) ? normaliseTargets(raw) : null;
}

/**
 * The platform's descriptor for one creature (`TargetsField.getDescriptors`), for when the module
 * names a target itself: the TOKEN's name, the actor's identity, AC nulled under total cover.
 * @param {{actorUuid: string, tokenUuid?: string|null, name: string, img?: string|null, ac?: number|null, totalCover?: boolean}} facts
 */
export function describeTarget({ actorUuid, tokenUuid = null, name, img = null, ac = null, totalCover = false }) {
  return { actor: actorUuid, token: tokenUuid, name, img, ac: totalCover ? null : (ac ?? null) };
}

/* --- FROM WHICH: the origin chain -------------------------------------------------------------- */

/**
 * The key a roll's origin is written under. ⚠ A roll this module DRIVES has no click to read the
 * card off, so it must be stamped here: the platform's registry (`getAssociatedRolls`, outcomes,
 * the delete cascade) indexes only this key.
 */
export const ORIGIN_KEY = "system.origin";

/** The message data that chains a roll to `id` — spread into a roll's `message.data`. */
export function originData(id) {
  return { [ORIGIN_KEY]: id };
}

/**
 * The id of the card this one descends from, or null. ⚠ Read off the SOURCE: the prepared field
 * resolves to null once that message is deleted; the source keeps the id.
 */
export function originIdOf(msg) {
  const raw = msg?._source?.system?.origin;
  if ( (typeof raw === "string") && raw ) return raw;
  const o = msg?.system?.origin;
  if ( typeof o === "string" ) return o || null;
  return o?.id ?? null;
}

/** The same, off a roll's pre-create DATA (flattened or expanded). */
export function originIdInData(data) {
  const v = data?.system?.origin ?? data?.[ORIGIN_KEY];
  if ( (typeof v === "string") && v ) return v;
  return v?.id ?? null;
}

/* --- WHAT: the activity and the item behind a card --------------------------------------------- */

/** The activity a card names — `{id, type, uuid, name, img}` (a SourceReferenceField) — or null. */
export function activityRefOf(msg) {
  const a = msg?.system?.activity;
  return (a && (a.uuid || a.id)) ? a : null;
}
export const activityUuidOf = msg => activityRefOf(msg)?.uuid ?? null;
export const activityTypeOf = msg => activityRefOf(msg)?.type ?? null;

/** The item a card names — `{id, type, uuid, name, img, compendiumSource}` — or null. */
export function itemRefOf(msg) {
  const i = msg?.system?.item;
  return (i && (i.uuid || i.id)) ? i : null;
}
export const itemUuidOf = msg => itemRefOf(msg)?.uuid ?? null;
export const itemNameOf = msg => itemRefOf(msg)?.name ?? null;

/* --- THE ROLL'S OWN FACTS: add a reader here with the file that needs it ----------------------- */

/** The ability a save or check was rolled with, or null. */
export const abilityOf = msg => msg?.system?.ability ?? null;

/** The weapon mastery an attack was rolled with, or null; the platform writes it only when the wielder has it. */
export const masteryOf = msg => msg?.system?.mastery ?? null;

/** How a damage roll treats a target that SAVED (`half` | `none` | `full`), or null: the demand decides. */
export const onSaveOf = msg => msg?.system?.onSave ?? null;

/** Was this save turned into a success after the fact (legendary resistance, an UPDATE on the save message)? */
export const resistedOf = msg => msg?.system?.resisted === true;

/** The level a spell was cast at, off its usage card, or null. */
export function castLevelOn(msg) {
  const level = msg?.system?.level;
  return Number.isFinite(Number(level)) && (level !== null) && (level !== undefined) ? Number(level) : null;
}

/** The upcast steps a usage card records, 0 when none. */
export const scalingOf = msg => Number(msg?.system?.scaling) || 0;

/** The id of the concentration effect a usage card started, or null. */
export const concentrationIdOf = msg => msg?.system?.concentration || null;

/* --- THE PLATFORM'S PROMPTS: buttons as data (`system.buttons[{type}]`), read by TYPE ---------- */

/** The button kinds the platform's concentration prompts carry: "roll it" on damage, "end it" when dead or incapacitated. */
const CONCENTRATION_PROMPT_BUTTONS = new Set(["concentration", "endConcentration"]);

/**
 * Is this the platform's own concentration prompt (`challengeConcentration` or
 * `promptConcentrationEnd`)? concentration.js vetoes them while its machine runs.
 */
export function isConcentrationPrompt(msg) {
  if ( !isCard(msg, CARD.prompt) ) return false;
  const buttons = msg?.system?.buttons;
  return Array.isArray(buttons) && buttons.some(b => CONCENTRATION_PROMPT_BUTTONS.has(b?.type));
}
