/**
 * Battle Flow — THE MOMENT EVENTS: what the module PUBLISHES when a moment resolves, for a
 * module that wants to know without reading a flag (2026-09-11, the pictures half of BACKLOG's
 * *modal sequence* item; the user: "no real dependency because FX Studio is optional. events would
 * just fail silently").
 *
 * WHY THIS EXISTS. An ability used through one of the module's own popups posts no dnd5e usage
 * card — a maneuver die rides the damage roll, a Parry rides the hold's answer, Sneak Attack's
 * dice write a record on a message that already exists. A module that keys its pictures on the
 * usage card (FX Studio's reader) never sees any of them, though the same ability used from the
 * sheet would play. The fix is not a fake card: it is a plain event at the RESOLVE step of the
 * moment, with everything a picture needs and nothing a flag shape leaks.
 *
 * ⚠ THE GATE (version 2, the same day, the user: "if an ability/card is folded in a battle flow,
 * it should be exposed to fx studio as well … a gate that any time an embedded card is played, it
 * goes through that hook"). Version 1 had three publishers, each a hand-placed call in its own
 * machine behind its own latch — and the riders, the folds, the masteries, the shields, the
 * spends and the receipts had none, with nothing in the tree able to say so. State law 3 (§4)
 * says the flag is the state and every view is derived from it, so a resolve IS a record landing
 * on a message, and this file now watches the RECORDS: one publisher, over the registry in
 * decide/moments.js, on message create and update. A machine publishes by writing the record it
 * already writes; a machine that writes a record nobody has classified fails the build
 * (tools/check-moments.mjs). The three hand-placed calls are three registry rows now.
 *
 * ⚠ THE DIRECTION OF KNOWLEDGE. This file knows no other module. It calls `Hooks.callAll`, and a
 * hook nobody listens to is a no-op the platform already provides — that is the whole of "fail
 * silently", and it costs no feature detect, no try/catch around a neighbour, no setting. Battle
 * Flow imports no other module and calls into none (ARCHITECTURE §7, the public API); what a
 * neighbour needs is PUBLISHED. A consumer that wants these subscribes to the names below and
 * resolves the uuids itself. Whether a moment gets a picture is the consumer's call, never this
 * file's (the user: "if it is shown or not, that is up to the manager of fx studio") — every
 * resolve publishes.
 *
 * ⚠ CLIENT-LOCAL, LIKE THE HOLD. A Foundry hook fires on the client that called it. A resolve is
 * published on ONE client: by default the client that WROTE the record (the roller whose damage
 * the die rode, the elect that folded a relayed answer), because that is the client with the
 * facts at the instant they are true; a registry row may name another (the hold names the
 * answering player, so Shield's picture fires where it did in version 1). Every OTHER client sees
 * the same record land and REMEMBERS it without publishing, so a later write to the same message
 * cannot re-fire an old resolve anywhere. On `ready` every message in the log is remembered the
 * same way — a reload publishes nothing that already happened.
 *
 * THE PAYLOAD IS PLAIN. Uuids and ids, never documents; strings, numbers, booleans, arrays of the
 * same. It is frozen, it serialises, and it carries NO flag shape from this module: a consumer
 * reading it learns nothing about how the moment was stored, which is what lets the storage
 * change without breaking a neighbour (FX Studio's own rule: "never reads its internal flags").
 *
 * THE VOCABULARY is decide/moments.js `MOMENT_WORDS` — a word per MECHANISM FAMILY (maneuver,
 * sneak, fold, rider, hold-answered, mastery, shield, spend, damage, effect, save, break, use,
 * cast, volley, choice, metamagic); `kind` on the payload names the exact record. A new word is a
 * contract change and a version bump.
 *
 * THE HOOKS. Every resolve fires `battleflow.moment` with the payload (one subscription hears
 * everything), then `battleflow.<event>` with the same payload (a subscription per word); a
 * resolve under two words (Parry: hold-answered and maneuver) fires the pair twice, one payload
 * each. The contract rides the api as `moments` — `{ version, events, kinds, hooks }`.
 *
 * ⚠ ONE EVENT PER RESOLVE, STRUCTURALLY. Each resolve has a MARKER inside its record (a target
 * uuid, an index, "message"), and this client publishes a `<message>|<kind>|<marker>` once. There
 * is no latch per machine to get right; a machine that resolves twice writes the same marker twice
 * and is heard once, which is what a picture wants.
 *
 * ⚠ A CONSUMER DEDUPES AGAINST THE CARD. `damage`, `effect`, `spend` and `save` fire for resolves
 * the platform ALSO posts a card for (a plain weapon hit's receipt, a cast's effect), and a cast
 * that answers a hold posts its own usage card beside `hold-answered`. The two carry different
 * facts (the card the spell, the event the moment), and the consumer picks — `momentId` on the
 * payload is the key to dedupe on, unique per resolve.
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
 * The uuid of the actor's token on the active scene, or null off the canvas or in a test. The
 * platform's own reader, not geometry.js's `tokenOfActor`: a picture wants the token the
 * table sees, and "the controlled one first" is a roller's preference, not a fact of the moment.
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
 * One target row, plain. The module's readers hand a target as `{ uuid }` where `uuid` is the
 * ACTOR's (dnd5e's own `targets` shape on an attack message), so that is what is carried; the
 * token is resolved beside it when the canvas has one. `hit` is carried only when a verdict is
 * known — a consumer's "not false counts as hit" rule then does the right thing.
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
 * PUBLISH a resolved moment. Returns the payload it fired (for the caller's log or a test), or
 * null when the event is not in the vocabulary — a typo here is a contract violation, and it is
 * warned rather than thrown because a picture is never worth the moment it decorates.
 *
 * ⚠ Called by the gate below, and by nothing else in the tree since version 2: a machine
 * publishes by writing its record. Exported for the gate's tests.
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
 * @param {string|null} [facts.kind]               the record key (the registry row) — version 2
 * @param {string|null} [facts.marker]             the resolve's marker inside its record — version 2
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
    // A picture is decoration. The moment it decorates has already resolved; nothing here may
    // reach back into it, so a payload that cannot be built is logged and dropped.
    console.warn(`${TITLE} | publishMoment: could not build the "${event}" payload — nothing published.`, err);
    return null;
  }
  // The platform's Hooks.callAll already isolates a listener that throws (it logs and carries
  // on), so a bad subscriber cannot reach the machine that published. The guard here is for the
  // one thing that could: a Hooks object that is not the platform's (a test, a broken boot).
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
    // By the item's name first; then by an ACTIVITY's name — a rider's label is its activity
    // (Dreadful Strike on Dread Ambusher), and a picture wants the feature that owns it.
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
 * @param {string|null} writerId   the user who wrote the change (the author on create, the updater on update)
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

// A record born resolved (a die riding a damage roll, a ward's strike on its own message): the
// author's client publishes; every other client remembers.
Hooks.on("createChatMessage", (message, _options, userId) => {
  observeMessage(message, userId ?? message.author?.id ?? null);
});

// A record that resolved by an update (an answer folded onto the hold, a verdict onto the saves
// flag, a receipt onto the attack): the updater's client publishes — unless the row names another.
Hooks.on("updateChatMessage", (message, changes, _options, userId) => {
  if ( !changes?.flags?.[MODULE_ID] ) return;
  observeMessage(message, userId ?? null);
});

// The log as it stands is history: remembered, never republished. A reload, a late join, a
// client that missed a create all start from here.
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
