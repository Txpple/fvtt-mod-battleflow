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
 * ⚠ THE DIRECTION OF KNOWLEDGE. This file knows no other module. It calls `Hooks.callAll`, and a
 * hook nobody listens to is a no-op the platform already provides — that is the whole of "fail
 * silently", and it costs no feature detect, no try/catch around a neighbour, no setting. Battle
 * Flow imports no other module and calls into none (ARCHITECTURE §7, the public API); what a
 * neighbour needs is PUBLISHED. A consumer that wants these subscribes to the names below and
 * resolves the uuids itself.
 *
 * ⚠ CLIENT-LOCAL, LIKE THE HOLD. A Foundry hook fires on the client that called it. The event is
 * published on the client that RESOLVED the moment — the roller whose damage the die rode, the
 * reactor who answered the hold — and nowhere else. That is the right client for a picture (the
 * consumer's own model is "the client that resolves plays; the engine propagates"), and it is the
 * only client that has the facts at the instant they are true.
 *
 * THE PAYLOAD IS PLAIN. Uuids and ids, never documents; strings, numbers, booleans, arrays of the
 * same. It is frozen, it serialises, and it carries NO flag shape from this module: a consumer
 * reading it learns nothing about how the moment was stored, which is what lets the storage
 * change without breaking a neighbour (FX Studio's own rule: "never reads its internal flags").
 *
 * THE EVENTS (the vocabulary, closed — a new word is a contract change and a version bump):
 *   maneuver       a Combat Superiority die rode a hit (the hit menu), or answered a hold (Parry)
 *   sneak          Sneak Attack's dice rode a hit, with the Cunning Strike picks
 *   fold           a die or reroll folded into a d20 test (Bardic, Heroic, Tactical, Seeking)
 *   rider          a clock rider's damage rode a hit (Dreadful Strike, Divine Strike, …)
 *   hold-answered  a held roll's reaction was answered by a cast (Shield, Parry, Uncanny Dodge)
 * Two of the five have no publisher yet (`fold`, `rider`) — they are named so the vocabulary does
 * not churn when they land; a consumer that subscribes to them today hears nothing, correctly.
 *
 * THE HOOKS. Every event fires twice: `battleflow.moment` with the payload (one subscription hears
 * everything), then `battleflow.<event>` with the same payload (a subscription per kind). The
 * contract rides the api as `moments` — `{ version, events, hooks }` — so a consumer can tell this
 * surface from a later one without probing for functions.
 *
 * ⚠ ONE EVENT PER RESOLVE. The publisher is called at the point a machine has ALREADY decided the
 * moment resolved once — behind its own idempotence latch (a `done` flag, a run set, a first-answer
 * guard). This file adds no latch of its own: a second latch here would hide a machine that
 * resolves twice, and that is a bug worth seeing.
 */

import { MODULE_ID, TITLE } from "./core.js";

/** The contract's version and vocabulary, read by other modules to tell this surface from a later one. */
export const MOMENT_CONTRACT = Object.freeze({
  version: 1,
  events: Object.freeze(["maneuver", "sneak", "fold", "rider", "hold-answered"]),
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
 */
export function publishMoment(event, { actor = null, item = null, activity = null, ability = null, message = null,
  attackMessage = null, targets = [], spend = null, details = {} } = {}) {
  if ( !MOMENT_CONTRACT.events.includes(event) ) {
    console.warn(`${TITLE} | publishMoment: "${event}" is not in the moment vocabulary — nothing published.`);
    return null;
  }
  let payload;
  try {
    const actorDoc = (typeof actor === "string") ? actorByUuid(actor) : actor;
    payload = Object.freeze({
      event,
      module: MODULE_ID,
      version: MOMENT_CONTRACT.version,
      actorUuid: uuidOf(actor),
      actorName: actorDoc?.name ?? null,
      tokenUuid: tokenUuidOf(actorDoc),
      itemUuid: uuidOf(item),
      itemName: (typeof item === "string") ? null : (item?.name ?? null),
      activityUuid: uuidOf(activity),
      ability: ability ?? (typeof item === "string" ? null : (item?.name ?? null)),
      messageId: idOf(message),
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

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { moments: MOMENT_CONTRACT });
});
