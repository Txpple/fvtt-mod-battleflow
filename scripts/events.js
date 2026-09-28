/**
 * Battle Flow — THE MOMENT EVENTS: a plain frozen event published at every resolve (the module's
 * popups post no dnd5e usage card). ⚠ THE GATE: one publisher watches the RECORDS (decide/moments.js);
 * an unclassified record fails the build (tools/check-moments.mjs). Knows no other module
 * (ARCHITECTURE §7). ⚠ CLIENT-LOCAL: the record's writer (or the row's publisher) publishes, once
 * per `<message>|<kind>|<marker>`; others and the `ready` log only remember. A new `MOMENT_WORDS`
 * word is a contract version bump. Consumers dedupe native cards by `momentId`.
 */

import { MODULE_ID, TITLE } from "./core.js";
import { MOMENT_KINDS, MOMENT_RECORDS, MOMENT_WORDS, isMomentWord, momentId, newMoments, resolvedMoments } from "./decide/moments.js";
import { hitTargets } from "./shared.js";
import { listen, listenOnce } from "./dispatch.js";

/** The contract's version and vocabulary, for other modules. */
export const MOMENT_CONTRACT = Object.freeze({
  version: 2,
  events: MOMENT_WORDS,
  kinds: MOMENT_KINDS,
  hooks: Object.freeze(["battleflow.moment", "battleflow.<event>"])
});

const uuidOf = x => (typeof x === "string") ? x : (x?.uuid ?? null);
const idOf = x => (typeof x === "string") ? x : (x?.id ?? null);

/** The actor's token on the active scene — the one the table sees, not the controlled-first one. */
function tokenUuidOf(actor) {
  if ( !actor || (typeof actor === "string") ) return null;
  try { return actor.getActiveTokens?.(true, true)?.[0]?.uuid ?? null; } catch { return null; }
}

function actorByUuid(uuid) {
  if ( !uuid ) return null;
  try {
    const doc = globalThis.fromUuidSync?.(uuid) ?? null;
    return (doc?.documentName === "Actor") ? doc : (doc?.actor ?? null);
  } catch { return null; }
}

function docByUuid(uuid) {
  if ( !uuid ) return null;
  try { return globalThis.fromUuidSync?.(uuid) ?? null; } catch { return null; }
}

/** One target row; a reader's target `uuid` is the ACTOR's (dnd5e's `targets` shape). */
function targetRow(t) {
  const actorUuid = uuidOf(t?.actorUuid ?? t?.uuid ?? t);
  const actor = actorByUuid(actorUuid);
  const tokenUuid = uuidOf(t?.tokenUuid) ?? tokenUuidOf(actor);
  const row = { actorUuid, tokenUuid, name: t?.name ?? actor?.name ?? null };
  if ( typeof t?.hit === "boolean" ) row.hit = t.hit;
  return row;
}

/** A spend row in the uniform shape (shared.js `poolSpendsOn`), or null. */
function spendRow(spend) {
  if ( !spend ) return null;
  const s = Array.isArray(spend) ? spend[0] : spend;
  if ( !s ) return null;
  return { pool: s.pool ?? null, spent: Number(s.spent ?? 0), left: Number(s.left ?? 0), max: Number(s.max ?? 0),
    ability: s.ability ?? null };
}

/** PUBLISH a resolved moment; the payload, or null for a word outside the vocabulary (warned, never
 * thrown). Called only by the gate; exported for its tests.
 * @param {string} event  one of MOMENT_CONTRACT.events
 * @param {object} facts
 * @param {Actor|string|null} [facts.actor]
 * @param {Item|string|null} [facts.item]
 * @param {object|string|null} [facts.activity]
 * @param {string|null} [facts.ability]
 * @param {ChatMessage|string|null} [facts.message]  the message the moment resolved ON
 * @param {ChatMessage|string|null} [facts.attackMessage]
 * @param {Array<object|string>} [facts.targets]
 * @param {object|object[]|null} [facts.spend]
 * @param {object} [facts.details]
 * @param {string|null} [facts.kind]  the record key
 * @param {string|null} [facts.marker] */
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
    console.warn(`${TITLE} | publishMoment: could not build the "${event}" payload — nothing published.`, err);
    return null;
  }
  // Guards a Hooks that is not the platform's (a test, a broken boot).
  try {
    Hooks.callAll("battleflow.moment", payload);
    Hooks.callAll(`battleflow.${event}`, payload);
  } catch(err) {
    console.warn(`${TITLE} | publishMoment: a subscriber to "${event}" failed — the moment stands.`, err);
  }
  return payload;
}

// THE GATE. Every `<message>|<kind>|<marker>` this client has seen resolved.
const seen = new Set();

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

/** A row's facts made publishMoment's: an item named only by name is found on the sheet. */
function factsOf(facts, message) {
  const actor = actorByUuid(facts.actor ?? null);
  let item = facts.item ?? null;
  if ( !item && facts.itemName && actor ) {
    // Then by an ACTIVITY's name — a rider's label is its activity.
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

/** The gate's step: unseen resolves are remembered, and published when this client is the publisher.
 * @param {ChatMessage} message
 * @param {string|null} writerId  the author on create, the updater on update
 * @param {boolean} publish  false on the ready sweep */
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

listen("createChatMessage", "events", (message, _options, userId) => {
  observeMessage(message, userId ?? message.author?.id ?? null);
});

listen("updateChatMessage", "events", (message, changes, _options, userId) => {
  if ( !changes?.flags?.[MODULE_ID] ) return;
  observeMessage(message, userId ?? null);
});

// The log as it stands is history: remembered, never republished.
listenOnce("ready", "events", () => {
  try { for ( const message of game.messages ?? [] ) observeMessage(message, null, false); }
  catch(err) { console.warn(`${TITLE} | the moment gate could not read the log on ready — old resolves may republish once.`, err); }
});

listen("deleteChatMessage", "events", message => {
  const prefix = `${message.id}|`;
  for ( const id of seen ) if ( id.startsWith(prefix) ) seen.delete(id);
});

listenOnce("init", "events", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { moments: MOMENT_CONTRACT });
});
