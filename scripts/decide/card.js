// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): THE CARD SEAM — what kind of card a message
 * is, whose it is, and from which card it came, read off the message's TYPED data.
 *
 * THE dnd5e 6.0 PASS, phase 1 (2026-09-15, ASSESSMENT.md §2 B–F). At 5.3.3 a roll card was a plain
 * message carrying `flags.dnd5e.{messageType, roll.type, activity, item, targets,
 * originatingMessage}`, and this module read those flags in roughly ninety places across forty
 * files — each site its own copy of "is this a damage roll", "who was targeted", "which card did
 * it come from". At 6.0 the card IS the data: `message.type` says what it is and `message.system`
 * says the rest; nothing is written to `flags.dnd5e` any more and the world migration DELETES the
 * old keys. Every one of those ninety reads failed closed on the same day. One seam, so the next
 * rename is one file.
 *
 * ⚠ READS `type` AND `system.*` ONLY. The platform keeps `getFlag("dnd5e", …)` read fallbacks for
 * the old keys; they are courtesy, not contract (ASSESSMENT §3b rule 4), and nothing here leans
 * on them. The one concession is a target row's `uuid` (the 5.x descriptor's key), accepted
 * beside 6.0's `actor` so a record written under either shape reads the same.
 *
 * ⚠ PURE. Takes a message-shaped object (`{type, system, _source}` — a document reads fine, so
 * does a plain snapshot) or a roll's pre-create DATA (`message.data` at the roll hooks, which
 * may be flattened — `"system.origin"` — or expanded). Never `game`, never `canvas`, never a
 * lookup: the EDGE resolves what these name.
 *
 * ⚠ THE TARGET KEY IS THE ACTOR. Every record this module keeps — the receipt, the hold, the
 * demand — keys a target by `uuid`, and that uuid has always been the target ACTOR's (an
 * unlinked token's synthetic actor included). 6.0's descriptor is token-precise and carries no
 * `uuid`: `{actor, token, ac, img, name}`, one row per TOKEN. `targetsOf` hands every reader the
 * house shape — `uuid` = the actor, the token kept beside it — and folds two tokens of one linked
 * actor to ONE row, because the module applies to actors and 5.3.3 never listed an actor twice.
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

/** The kinds that carry ROLLS — the cards the 5.x `roll.type` used to name. @type {Set<string>} */
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
 * A save's or a check's SUB-kind — what the 5.x `roll.type` used to spell out as its own word.
 * A save is `ability` | `concentration` | `death`; a check is `ability` | `initiative`; anything
 * else has none. (6.0 folds death and concentration saves under `type: "save"`, told apart here.)
 */
export function subKindOf(msg) {
  const kind = cardKind(msg);
  if ( (kind !== CARD.save) && (kind !== CARD.check) ) return null;
  return msg?.system?.type || "ability";
}

/* ---------------------------------------------------------------------------------------------
 * WHOSE — the targets
 * ------------------------------------------------------------------------------------------- */

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
 * The platform's own descriptor for one creature (`TargetsField.getDescriptors`, 6.0) — what the
 * module writes when IT names a target (the potion that aims at its drinker). The name is the
 * TOKEN's, the identity the actor's, the AC nulled under total cover exactly as the platform nulls it.
 * @param {{actorUuid: string, tokenUuid?: string|null, name: string, img?: string|null, ac?: number|null, totalCover?: boolean}} facts
 */
export function describeTarget({ actorUuid, tokenUuid = null, name, img = null, ac = null, totalCover = false }) {
  return { actor: actorUuid, token: tokenUuid, name, img, ac: totalCover ? null : (ac ?? null) };
}

/* ---------------------------------------------------------------------------------------------
 * FROM WHICH — the origin chain
 * ------------------------------------------------------------------------------------------- */

/**
 * The key a roll's origin is written under in its message data. ⚠ A roll this module DRIVES
 * (the auto damage, a save, a fold's reroll) has no DOM click for the platform to read the card
 * off, so the id must be written here explicitly — and it is this key, not the old flag, that
 * the platform's registry indexes (`getAssociatedRolls`, the usage card's outcomes and
 * summaries, the delete cascade). A roll stamped anywhere else is invisible to all of them.
 */
export const ORIGIN_KEY = "system.origin";

/** The message data that chains a roll to `id` — spread into a roll's `message.data`. */
export function originData(id) {
  return { [ORIGIN_KEY]: id };
}

/**
 * The id of the card this one descends from, or null. Read off the SOURCE: on a document
 * `system.origin` is a ForeignDocumentField that resolves to the message (and to null once that
 * message is deleted), while the raw source keeps the id either way.
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

/* ---------------------------------------------------------------------------------------------
 * WHAT — the activity and the item behind a card
 * ------------------------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------------------------
 * THE ROLL'S OWN FACTS — the 5.x `roll.*` sub-keys, at their 6.0 homes. ⚠ A reader joins this
 * section WITH its customer (the D8 lesson — a seam is built by the file that reads it): phase 2 of
 * the 6.0 pass adds the mastery, the attack mode, the damage-on-save and the resisted flag beside
 * mastery.js, the folds and the saves machine as each is swept through here.
 * ------------------------------------------------------------------------------------------- */

/** The ability a save or check was rolled with, or null. */
export const abilityOf = msg => msg?.system?.ability ?? null;

/** The level a spell was cast at, off its usage card (5.x `spellLevel`), or null when it carries none. */
export function castLevelOn(msg) {
  const level = msg?.system?.level;
  return Number.isFinite(Number(level)) && (level !== null) && (level !== undefined) ? Number(level) : null;
}

/** The upcast steps a usage card records, 0 when none. */
export const scalingOf = msg => Number(msg?.system?.scaling) || 0;

/** The id of the concentration effect a usage card started, or null. */
export const concentrationIdOf = msg => msg?.system?.concentration || null;
