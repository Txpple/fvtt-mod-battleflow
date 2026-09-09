/**
 * Battle Flow — THE HOLD REGISTRY: the one place that answers "is anything keeping this
 * quiet?" (2026-09-09, generalised out of metamagic.js the day after it was born there).
 *
 * WHAT A HOLD IS. While the module is asking its caster a question the table cannot answer
 * without — Careful Spell's *who does the spell spare?*, asked only once the template has
 * landed — the cast's usage card is held BACK. Nothing downstream fires, because nothing
 * downstream exists yet: no card, no picture, no dice, no saves. The hold is how a module
 * that keys on the card (FX Studio's area picture plays on the template's Region, which the
 * system draws BEFORE the question) can be told *not yet* without knowing why.
 *
 * ⚠ THIS IS A COURTESY, NEVER A GUARANTEE OF LIVENESS. A consumer bounds its own wait. The
 * registry does everything it can to settle every hold it opens — every terminal path calls
 * `release`, a deleted carrier releases, and a hold whose moment carries a clock is bounded by
 * that clock plus slack — but a consumer that waits forever on a promise is a consumer that
 * can hang on a bug in here, and that trade is not the consumer's to lose.
 *
 * ⚠ IT IS CLIENT-LOCAL, AND THAT IS THE THING TO KNOW BEFORE READING IT. These are plain Maps
 * in one client's memory: the client that cast. Everywhere else `holdFor()` answers `null`,
 * which does NOT mean "nothing is holding" — it means "nothing HERE can see one". Today that
 * is harmless because the consumer that asks (the template's placer) is the caster, but a GM
 * placing a template on a player's behalf is already outside that luck. Promoting a hold to
 * world state is a real change with a real cost; it is not done, and it is not pretended.
 *
 * THE FOUR DECISIONS THAT ARE LOAD-BEARING (BACKLOG, *The modal sequence*). The module wants,
 * long term, a MODAL SEQUENCE: several windows answered in order, with the visual chain waiting
 * for the whole sequence to drain. That is buildable on this file only while all four hold, and
 * each is cheap now and expensive later:
 *   1. REFCOUNTED, never a boolean. A sequence of N windows raises N holds on one subject.
 *      Today exactly one thing ever holds — which is precisely why a boolean would have looked
 *      correct forever and then cost a migration.
 *   2. Keyed by an OPAQUE SUBJECT, never an activity uuid. A sequence's subject may be a popup
 *      key or a message id; an activity-only key locks this to casts.
 *   3. Release is an EXPLICIT LIFECYCLE CALL, never coupled to "the card posted". In a sequence
 *      the card posts at step 1 while steps 2..N still stand.
 *   4. `ui.js`'s `openManagedPopup` stays the one place a decision popup opens, so a sequence
 *      can be counted without editing every machine.
 *
 * THE PUBLIC SURFACE (`game.modules.get("fvtt-mod-battleflow").api`), read by other modules and
 * never imported by them:
 *   holdFor(subject)   a promise that settles when the hold lifts, or null when nothing holds.
 *                      Settles with the CARD that lifted it, or with `null` meaning nothing was
 *                      posted and nothing should play. ⚠ A null RETURN and a null RESOLUTION
 *                      mean opposite things: the first is "play now", the second "play nothing".
 *   castHold(uuid)     the original name, kept forever — FX Studio shipped against it 2026-09-09.
 *   holds              { version, keys } so a consumer can tell this contract from the first one.
 * and the hooks `battleflow.holdOpened` / `battleflow.castReleased`.
 */

import { MODULE_ID, TITLE } from "./core.js";

/** The contract's version, read by other modules to tell this surface from the first one. */
const HOLD_CONTRACT = Object.freeze({ version: 1, keys: ["activity", "message", "document"] });

/**
 * subject key → the live hold. `count` is the refcount (decision 1); `settled` guards against a
 * double release resolving a promise nobody is waiting on any more.
 * @type {Map<string, {promise: Promise<any>, resolve: (v:any)=>void, count: number, reason: string, timer: any, settled: boolean}>}
 */
const holds = new Map();

// ⚠ NO ALIASING YET, DELIBERATELY. `holdFor` is documented to take an activity uuid, a message id
// or a document uuid, and today every hold is raised on an activity uuid, so the other two answer
// only when they ARE that string. Teaching one hold a second name is four lines — and it is not
// written until something asks, because a seam built from one caller is a guess (the house lesson,
// BACKLOG *the two sideways edges*). The contract is shaped to accept it without a version bump.

/** The subject a caller means, as the string this file keys by; anything document-shaped answers by uuid. */
function subjectKey(subject) {
  if ( !subject ) return "";
  if ( typeof subject === "string" ) return subject;
  return String(subject.uuid ?? subject.id ?? "");
}

/** The live hold a subject names, or null. */
function holdEntry(subject) {
  const key = subjectKey(subject);
  if ( !key ) return null;
  return holds.get(key) ?? null;
}

/**
 * RAISE a hold on a subject and get back the function that lowers it. Every raise must be
 * matched by exactly one call of what it returns — the returned function is idempotent, so a
 * machine that lowers twice on two paths (the answer AND the carrier's deletion) is safe.
 *
 * `bound` is a millisecond ceiling after which the hold settles itself with `null`. Pass it
 * whenever the moment carries a clock, and pass nothing when it does not: a moment waits
 * forever only by explicit setting (ARCHITECTURE §5 law 11), and a self-bound under a
 * deliberately clockless ask would release while the caster is still reading.
 */
export function raiseHold(subject, { reason = "unspecified", bound = null } = {}) {
  const key = subjectKey(subject);
  if ( !key ) return () => {};
  let entry = holds.get(key);
  if ( entry ) {
    entry.count += 1;
  } else {
    /** @type {(v:any)=>void} */
    let resolve = () => {};
    const promise = new Promise(r => { resolve = r; });
    entry = { promise, resolve, count: 1, reason, timer: null, settled: false };
    if ( Number.isFinite(bound) && (Number(bound) > 0) ) {
      entry.timer = setTimeout(() => {
        console.warn(`${TITLE} | A hold on ${key} (${reason}) outlived its clock — releasing it so nothing waits forever.`);
        settle(key, null);
      }, Number(bound));
    }
    holds.set(key, entry);
    Hooks.callAll("battleflow.holdOpened", { subject: key, reason });
  }
  let lowered = false;
  return (message = null) => {
    if ( lowered ) return;
    lowered = true;
    lowerHold(key, message);
  };
}

/** Lower one raise. The hold settles only when the last raise has been lowered (decision 1). */
function lowerHold(key, message = null) {
  const entry = holds.get(key);
  if ( !entry ) return;
  entry.count -= 1;
  if ( entry.count > 0 ) return;
  settle(key, message);
}

/** Settle a hold and forget it, whatever its refcount — the terminal paths and the self-bound. */
function settle(key, message) {
  const entry = holds.get(key);
  if ( !entry ) return;
  holds.delete(key);
  if ( entry.timer ) clearTimeout(entry.timer);
  if ( entry.settled ) return;
  entry.settled = true;
  entry.resolve(message);
  Hooks.callAll("battleflow.castReleased", { activityUuid: key, subject: key, message });
}

/**
 * Settle a subject's hold NOW, however many raises stand — for the terminal paths where the
 * question has stopped being askable at all: the card posted, the carrier deleted, the cast
 * cancelled. `message` is what the waiters receive: the card, or null for "nothing was posted".
 */
export function releaseHold(subject, message = null) {
  const key = subjectKey(subject);
  if ( key && holds.has(key) ) settle(key, message);
}

/** Whether anything is holding this subject — the module's own read; other modules use the api. */
export function isHeld(subject) {
  return !!holdEntry(subject);
}

/** The promise a subject's hold will settle with, or null when nothing here is holding it. */
export function holdFor(subject) {
  return holdEntry(subject)?.promise ?? null;
}

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, {
    holdFor,
    /** The first name this surface had (FX Studio, 2026-09-09). Kept forever; `holdFor` is the general one. */
    castHold: holdFor,
    holds: HOLD_CONTRACT
  });
});
