/**
 * Battle Flow — THE HOLD REGISTRY: while the module asks the caster a question (Careful Spell), the
 * cast's card is held and a consumer (FX Studio) is told *not yet*. Contract: ARCHITECTURE *The
 * public API*. ⚠ A courtesy: consumers bound their own wait. ⚠ CLIENT-LOCAL: elsewhere `holdFor()`
 * is null. ⚠ Refcounts, opaque keys and explicit release serve BACKLOG *The modal sequence*.
 */

import { MODULE_ID, TITLE } from "./core.js";
import { listenOnce } from "./dispatch.js";

/** The contract's version, for other modules. */
const HOLD_CONTRACT = Object.freeze({ version: 1, keys: ["activity", "message", "document"] });

/**
 * The third outcome: lifted, nothing known, carry on. ⚠ Never `null` ("nothing posted, play
 * nothing"): a late answer must not suppress the picture. Truthy, so it fails open.
 */
const HOLD_LIFTED = Object.freeze({ lifted: true });

/**
 * subject key → the live hold; `count` is the refcount, `settled` guards a double release.
 * @type {Map<string, {promise: Promise<any>, resolve: (v:any)=>void, count: number, reason: string, timer: any, settled: boolean}>}
 */
const holds = new Map();

// No aliasing: a subject answers only by the exact string it was raised on (an activity uuid).
function subjectKey(subject) {
  if ( !subject ) return "";
  if ( typeof subject === "string" ) return subject;
  return String(subject.uuid ?? subject.id ?? "");
}

function holdEntry(subject) {
  const key = subjectKey(subject);
  if ( !key ) return null;
  return holds.get(key) ?? null;
}

/**
 * RAISE a hold; returns its idempotent lowering function. `bound` (ms) lifts it by itself — pass it
 * whenever the moment has a clock (ARCHITECTURE §5 law 11).
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
        console.warn(`${TITLE} | A hold on ${key} (${reason}) outlived its clock — lifting it so nothing waits forever.`);
        settle(key, HOLD_LIFTED);
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

/** Settles on the last lower; with no card it LIFTS (only `releaseHold(subject, null)` cancels). */
function lowerHold(key, message = null) {
  const entry = holds.get(key);
  if ( !entry ) return;
  entry.count -= 1;
  if ( entry.count > 0 ) return;
  settle(key, message ?? HOLD_LIFTED);
}

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

/** Settle NOW, whatever the refcount; `message` is the card, or null for "nothing was posted". */
export function releaseHold(subject, message = null) {
  const key = subjectKey(subject);
  if ( key && holds.has(key) ) settle(key, message);
}

export function isHeld(subject) {
  return !!holdEntry(subject);
}

/** The promise the hold settles with, or null when nothing HERE holds it. */
export function holdFor(subject) {
  return holdEntry(subject)?.promise ?? null;
}

listenOnce("init", "holds", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, {
    holdFor,
    castHold: holdFor,   // permanent alias
    holds: HOLD_CONTRACT
  });
});
