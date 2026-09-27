/**
 * Battle Flow — THE HOLD REGISTRY: "is anything keeping this quiet?" While the module asks its
 * caster a question the table cannot answer without (Careful Spell's who-to-spare), the cast's
 * card is held back, and a consumer keyed on the card (FX Studio) is told *not yet* without
 * knowing why. Contract: ARCHITECTURE *The public API* — holdFor, castHold (a permanent alias),
 * holds, and the hooks `battleflow.holdOpened` / `battleflow.castReleased`.
 * ⚠ A courtesy, never a liveness guarantee: consumers bound their own wait.
 * ⚠ CLIENT-LOCAL (the casting client's memory): elsewhere `holdFor()` is null, meaning "nothing
 * HERE can see one", not "nothing holds". ⚠ Refcounted, opaque-subject keys and an explicit
 * release are load-bearing for BACKLOG *The modal sequence*.
 */

import { MODULE_ID, TITLE } from "./core.js";

/** The contract's version, read by other modules to tell this surface from the first one. */
const HOLD_CONTRACT = Object.freeze({ version: 1, keys: ["activity", "message", "document"] });

/**
 * The third outcome: *the hold lifted and nothing is known; carry on*. ⚠ Never collapse it into
 * `null` ("nothing was posted, play nothing"): a hold that outlives its clock is only a late
 * answer, and reading it as null would suppress the picture for good. Truthy, so it fails open.
 */
const HOLD_LIFTED = Object.freeze({ lifted: true });

/**
 * subject key → the live hold. `count` is the refcount; `settled` guards a double release.
 * double release resolving a promise nobody is waiting on any more.
 * @type {Map<string, {promise: Promise<any>, resolve: (v:any)=>void, count: number, reason: string, timer: any, settled: boolean}>}
 */
const holds = new Map();

// No aliasing: every hold is raised on an activity uuid today, so a message id or document uuid
// answers only when it IS that string. The contract accepts aliasing without a version bump.

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
 * RAISE a hold and get back its (idempotent) lowering function; every raise is matched by one
 * call. `bound` is a millisecond ceiling after which the hold LIFTS itself (the sentinel, never
 * `null`) — pass it whenever the moment carries a clock, and nothing when it deliberately has
 * none (ARCHITECTURE §5 law 11).
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

/**
 * Lower one raise; the hold settles when the last is lowered. With no card in hand it LIFTS
 * rather than cancels — only an explicit `releaseHold(subject, null)` says nothing was posted.
 */
function lowerHold(key, message = null) {
  const entry = holds.get(key);
  if ( !entry ) return;
  entry.count -= 1;
  if ( entry.count > 0 ) return;
  settle(key, message ?? HOLD_LIFTED);
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
 * Settle a subject's hold NOW, whatever its refcount — the card posted, the carrier deleted, the
 * cast cancelled. `message` is the card, or null for "nothing was posted".
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
    /** The first name of this surface, kept forever; `holdFor` is the general one. */
    castHold: holdFor,
    holds: HOLD_CONTRACT
  });
});
