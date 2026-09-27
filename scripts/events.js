/**
 * Battle Flow — THE MOMENT EVENTS: what the module PUBLISHES when a moment resolves, for a
 * module that wants to know without reading a flag. An ability used through the module's own
 * popups posts no dnd5e usage card, so a neighbour keyed on usage cards never sees it; this
 * publishes a plain event at the resolve instead.
 *
 * ⚠ THE GATE: one publisher watches the RECORDS (decide/moments.js registry) on message create
 * and update — a machine publishes by writing the record it already writes, and an unclassified
 * record fails the build (tools/check-moments.mjs). Every resolve publishes; whether it gets a
 * picture is the consumer's call.
 *
 * ⚠ THE DIRECTION OF KNOWLEDGE: this file knows no other module. `Hooks.callAll` with no
 * listener is a no-op, which is the whole of "fails silently" (ARCHITECTURE §7).
 *
 * ⚠ CLIENT-LOCAL: a resolve publishes on ONE client — by default the one that WROTE the record,
 * or the one a registry row names. Every other client remembers it without publishing, and on
 * `ready` the whole log is remembered, so nothing old re-fires.
 *
 * The payload is plain and frozen (uuids, ids, strings, numbers) and carries no flag shape. The
 * vocabulary is `MOMENT_WORDS`, one word per mechanism family; `kind` names the exact record; a
 * new word is a contract change and a version bump. Each resolve fires `battleflow.moment` then
 * `battleflow.<event>`; a resolve under two words fires both pairs. One event per resolve is
 * structural: `<message>|<kind>|<marker>` publishes once per client.
 * ⚠ A consumer dedupes against the platform's own card (`momentId`): damage, effect, spend and
 * save also have native cards.
 */

import { MODULE_ID, TITLE } from "./core.js";
import { MOMENT_KINDS, MOMENT_RECORDS, MOMENT_WORDS, isMomentWord, momentId, newMoments, resolvedMoments } from "./decide/moments.js";
import { hitTargets } from "./shared.js";

/** The contract's version and vocabulary, read by other modules to tell this surface from a later one. */
export const MOMENT_CONTRACT = Object.freeze({
  version: 2,
  events: MOMENT_WORDS,
  kinds: MOMENT_KINDS,
  hooks: Object.freeze(["battleflow.moment", "battleflow.<event>"])
});

/** A document's uuid, or the string as given, or null — never a document. */
const uuidOf = x => (typeof x === "string") ? x : (x?.uuid ?? null);
/** A document's id, or the string as given, or null. */
const idOf = x => (typeof x === "string") ? x : (x?.id ?? null);

/**
 * The uuid of the actor's token on the active scene, or null off the canvas or in a test — the
 * token the table sees, not geometry.js's controlled-first `tokenOfActor`.
 */
function tokenUuidOf(actor) {
  if ( !actor || (typeof actor === "string") ) return null;
  try { return actor.getActiveTokens?.(true, true)?.[0]?.uuid ?? null; } catch { return null; }
}

/** An actor by uuid without a round trip, or null when the world cannot answer (a test, a gone actor). */
function actorByUuid(uuid) {
  if ( !uuid ) return null;
  try {
    const doc = globalThis.fromUuidSync?.(uuid) ?? null;
    return (doc?.documentName === "Actor") ? doc : (doc?.actor ?? null);
  } catch { return null; }
}

/** A document by uuid without a round trip, or null. */
function docByUuid(uuid) {
  if ( !uuid ) return null;
  try { return globalThis.fromUuidSync?.(uuid) ?? null; } catch { return null; }
}

/**
 * One target row, plain. A reader's target `uuid` is the ACTOR's (dnd5e's `targets` shape); the
 * token is resolved beside it. `hit` is carried only when a verdict is known.
 */
function targetRow(t) {
  const actorUuid = uuidOf(t?.actorUuid ?? t?.uuid ?? t);
  const actor = actorByUuid(actorUuid);
  const tokenUuid = uuidOf(t?.tokenUuid) ?? tokenUuidOf(actor);
  const row = { actorUuid, tokenUuid, name: t?.name ?? actor?.name ?? null };
  if ( typeof t?.hit === "boolean" ) row.hit = t.hit;
  return row;
}

/** A spend row in the uniform shape (shared.js `poolSpendsOn`), copied plain, or null. */
function spendRow(spend) {
  if ( !spend ) return null;
  const s = Array.isArray(spend) ? spend[0] : spend;
  if ( !s ) return null;
  return { pool: s.pool ?? null, spent: Number(s.spent ?? 0), left: Number(s.left ?? 0), max: Number(s.max ?? 0),
    ability: s.ability ?? null };
}

/**
 * PUBLISH a resolved moment. Returns the payload fired, or null when the event is not in the
 * vocabulary (warned, never thrown — a picture is never worth the moment it decorates). Called
 * only by the gate below; exported for its tests.
 *
 * @param {string} event                 one of MOMENT_CONTRACT.events
 * @param {object} facts
 * @param {Actor|string|null} [facts.actor]        who resolved the moment (the roller, the reactor)
 * @param {Item|string|null} [facts.item]          the feature or spell the moment is about
 * @param {object|string|null} [facts.activity]    its activity, when one is known
 * @param {string|null} [facts.ability]            the feature's name as the card says it
 * @param {ChatMessage|string|null} [facts.message]        the message the moment resolved ON
 * @param {ChatMessage|string|null} [facts.attackMessage]  the attack it rode, when there is one
 * @param {Array<object|string>} [facts.targets]   the creatures the moment is about (actor uuids, or reader rows)
 * @param {object|object[]|null} [facts.spend]     the pool spend in the uniform row shape, if any
 * @param {object} [facts.details]                 event-specific plain facts (a formula, the picks, an answer)
 * @param {string|null} [facts.kind]               the record key (the registry row)
 * @param {string|null} [facts.marker]             the resolve's marker inside its record
 */
export function publishMoment(event, { actor = null, item = null, activity = null, ability = null, message = null,
  attackMessage = null, targets = [], spend = null, details = {}, kind = null, marker = null } = {}) {
  if ( !isMomentWord(event) ) {
    console.warn(`${TITLE} | publishMoment: "${event}" is not in the moment vocabulary — nothing published.`);
    return null;
  }
  let payload;
  try {
    const actorDoc = (typeof actor === "string") ? actorByUuid(actor) : actor;
    const itemDoc = (typeof item === "string") ? docByUuid(item) : item;
    const messageId = idOf(message);
    payload = Object.freeze({
      event,
      module: MODULE_ID,
      version: MOMENT_CONTRACT.version,
      kind,
      marker,
      momentId: (kind && marker) ? momentId(messageId, kind, marker) : null,
      actorUuid: uuidOf(actor),
      actorName: actorDoc?.name ?? null,
      tokenUuid: tokenUuidOf(actorDoc),
      itemUuid: uuidOf(item),
      itemName: itemDoc?.name ?? null,
      activityUuid: uuidOf(activity),
      ability: ability ?? itemDoc?.name ?? null,
      messageId,
      attackId: idOf(attackMessage),
      targets: Object.freeze((targets ?? []).map(targetRow).map(Object.freeze)),
      spend: spendRow(spend) ? Object.freeze(spendRow(spend)) : null,
      details: Object.freeze(globalThis.foundry?.utils?.deepClone?.(details ?? {}) ?? { ...(details ?? {}) }),
      at: Date.now()
    });
  } catch(err) {
    // The moment has already resolved; a payload that cannot be built is logged and dropped.
    console.warn(`${TITLE} | publishMoment: could not build the "${event}" payload — nothing published.`, err);
    return null;
  }
  // Hooks.callAll already isolates a throwing listener; this guards a Hooks that is not the
  // platform's (a test, a broken boot).
  try {
    Hooks.callAll("battleflow.moment", payload);
    Hooks.callAll(`battleflow.${event}`, payload);
  } catch(err) {
    console.warn(`${TITLE} | publishMoment: a subscriber to "${event}" failed — the moment stands.`, err);
  }
  return payload;
}

/* ---------------------------------------------------------------------------------------------
 * THE GATE — the records watched, the resolves published once.
 * ------------------------------------------------------------------------------------------- */

/** Every `<message>|<kind>|<marker>` this client has seen resolved — published here or remembered. */
const seen = new Set();

/** The plain facts a row may default to, read off the message once per event. */
function ctxOf(message) {
  let actorUuid = null;
  try { actorUuid = message.getAssociatedActor?.()?.uuid ?? null; } catch { /* a synthetic speaker */ }
  return {
    messageId: message.id ?? null,
    itemUuid: message.getFlag?.("dnd5e", "item")?.uuid ?? null,
    activityUuid: message.getFlag?.("dnd5e", "activity")?.uuid ?? null,
    actorUuid
  };
}

/**
 * A row's plain facts made into publishMoment's facts: the item found by name on the actor's
 * sheet when the row knew only a name, the attack's hit targets read when the row asked for them.
 */
function factsOf(facts, message) {
  const actor = actorByUuid(facts.actor ?? null);
  let item = facts.item ?? null;
  if ( !item && facts.itemName && actor ) {
    // By the item's name, then by an ACTIVITY's name — a rider's label is its activity, and a
    // picture wants the feature that owns it.
    try {
      const items = actor.items ?? [];
      item = items.find?.(i => i.name === facts.itemName)?.uuid
        ?? items.find?.(i => [...(i.system?.activities ?? [])].some(a => a?.name === facts.itemName))?.uuid ?? null;
    } catch { item = null; }
  }
  const attackMessage = facts.attackId ? (game.messages?.get?.(facts.attackId) ?? null) : null;
  let targets = facts.targets ?? [];
  if ( (facts.targetsFrom === "attack") && attackMessage ) {
    try { targets = hitTargets(attackMessage).map(t => ({ ...t, hit: true })); } catch { targets = []; }
  }
  return { actor: facts.actor ?? null, item, activity: facts.activity ?? null, ability: facts.ability ?? facts.itemName ?? null,
    message, attackMessage: attackMessage ?? facts.attackId ?? null, targets, spend: facts.spend ?? null, details: facts.details ?? {} };
}

/**
 * The gate's one step: for every registered record on this message, the resolves this client has
 * not seen are remembered, and published when this client is their publisher.
 *
 * @param {ChatMessage} message
 * @param {string|null} writerId   the writer's user id (the author on create, the updater on update)
 * @param {boolean} publish        false on the ready sweep — remember everything, publish nothing
 */
export function observeMessage(message, writerId, publish = true) {
  const flags = message?.flags?.[MODULE_ID];
  if ( !flags ) return [];
  const ctx = ctxOf(message);
  const out = [];
  for ( const key of Object.keys(flags) ) {
    if ( !MOMENT_RECORDS[key] ) continue;
    let moments;
    try { moments = resolvedMoments(key, flags[key], ctx); }
    catch(err) { console.warn(`${TITLE} | the moment registry's "${key}" row failed to read a record — nothing published for it.`, err); continue; }
    for ( const m of newMoments(message.id, key, moments, seen) ) {
      seen.add(momentId(message.id, key, m.marker));
      if ( !publish ) continue;
      const publisher = m.publisher ?? writerId;
      if ( publisher !== game.user?.id ) continue;
      const facts = factsOf(m.facts ?? {}, message);
      for ( const event of m.events ?? [] ) {
        const payload = publishMoment(event, { ...facts, kind: key, marker: m.marker });
        if ( payload ) out.push(payload);
      }
    }
  }
  return out;
}

// A record born resolved: the author's client publishes; every other client remembers.
Hooks.on("createChatMessage", (message, _options, userId) => {
  observeMessage(message, userId ?? message.author?.id ?? null);
});

// A record resolved by an update: the updater's client publishes — unless the row names another.
Hooks.on("updateChatMessage", (message, changes, _options, userId) => {
  if ( !changes?.flags?.[MODULE_ID] ) return;
  observeMessage(message, userId ?? null);
});

// The log as it stands is history: remembered, never republished.
Hooks.once("ready", () => {
  try { for ( const message of game.messages ?? [] ) observeMessage(message, null, false); }
  catch(err) { console.warn(`${TITLE} | the moment gate could not read the log on ready — old resolves may republish once.`, err); }
});

// A deleted message takes its memory with it — the id will not come back.
Hooks.on("deleteChatMessage", message => {
  const prefix = `${message.id}|`;
  for ( const id of seen ) if ( id.startsWith(prefix) ) seen.delete(id);
});

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { moments: MOMENT_CONTRACT });
});
