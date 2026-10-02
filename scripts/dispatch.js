// @ts-check
/**
 * Battle Flow — THE HOOK DISPATCHER: one platform listener per hook name, and the module's own
 * handlers behind it in ORDER. A file registers with `listen(hook, key, fn)` where `key` is its own
 * scripts-relative path; nothing else in scripts/ calls `Hooks.on` (tools/check-hook-order.mjs).
 * A leaf — imports nothing (ARCHITECTURE.md §7 *Registration order*).
 */

/**
 * THE ORDER: every file that registers a hook, in the order its handlers run on every hook it
 * shares. Card rows render in this order; a veto runs before the capture it protects. A file not
 * listed here cannot register. The load-bearing pairs are asserted by tools/check-hook-order.mjs.
 */
export const ORDER = Object.freeze([
  "settings",
  "rule-text",
  "holds",
  "events",
  "polish",
  "ui",                 // the damage-offer bar, the relay and the resumables run ahead of every row
  "effect-riders",
  "hold/clock",
  "hold/trigger",
  "hold/spell-hold",
  "hold/answer",
  "hold/continue",
  "hold/spell-damage",  // the negate veto at preApplyDamage, before concentration captures the cause
  "hold/views",         // the hold row, above mastery's
  "dice-rise",
  "hold/dice",
  "auto-damage",        // first on the damage roll: the activity's own roll count before any rider's part
  "hit-riders",         // a rider's part before volleys' dart multiplier copies the base
  "mastery",            // mastery's rows above the maneuver folds', the receipts' and precision's
  "bash-offer",
  "topple",
  "chip-spend",
  "wards",              // the ward's veto before the gate draws (a false stops the chain); the ward ends before cast.js lands its effect
  "reminders",          // the gate draws its section and writes its record first
  "advantage-buys",     // then the buy box joins the section and its record overwrites the gate's
  "stored-dice",        // Portent's ticks below the gate's section; the face pinned before the roll
  "rest-grants",
  "ward-pools",         // the ward takes its share of the HP update before drop-to-one reads it
  "drop-to-one",
  "sneak",              // the Sneak Attack dice as their own part, before volleys' multiplier
  "clock-riders",       // a clock rider's part, before volleys' multiplier
  "damage-shields",
  "volley-registry",
  "damage-casts",
  "hit-menu",           // a maneuver's die, before volleys' multiplier
  "superiority-uses",
  "use-chips",
  "area-ask",
  "metamagic",
  "dice-changers",      // after every rider's part: it reads none of them
  "heal-rerolls",
  "unarmed-dice",
  "damage-rules",
  "kit-tend",
  "initiative-swap",
  "initiative-grants",
  "cast-riders",
  "precision",          // stamps its flag on the attack before the d20 fold composes over it; its row above the fold's
  "riposte",
  "hew",
  "command",            // the last maneuver row, above the saves rows
  "rebukes",
  "mishaps",            // a dark gift's save after a 1 on the d20 — read after the record hooks, before the damage seams
  "damage-shares",      // the bond's share on the damage that landed — the rebukes' seam
  "heal-on-hit",        // the caster's heal on the damage that landed — the same seam
  "drains",             // the target's fall on the damage that landed — the same seam (Life Drain)
  "damage-holds",
  "d20-folds",          // the d20 fold row directly below the maneuver rows
  "bystanders",         // a bystander's bend on a save or a check, below the roller's own folds
  "concentration",
  "cast",
  "volleys",            // the volley row above the saves rows; its multiplier after every rider's part
  "saves/demand",
  "saves/areas",
  "saves/ask",
  "saves/views",        // the verdict rows above the receipts
  "prismatic",          // the ray table: its cast's demand is closed at birth, its ray cards carry saves demands
  "emanations",         // its trigger card carries a saves demand
  "repeat-saves",       // its demand card carries a saves demand too; its line beneath the verdicts
  "turn-grants",
  "token-lights",       // its row beneath the use's own rows
  "receipts",           // the receipt rows below every workflow row
  "resources",          // the spend line, the usage card's footer
  "stats",
  "effect-view"
]);

/**
 * The hooks the platform dispatches with `Hooks.call`: a handler's `false` stops the handlers behind
 * it, and the platform's caller sees it. Every other hook is `callAll`, where a return means nothing.
 * Checked against the platform's bundle by tools/check-hook-dispatch.mjs.
 */
export const VETOABLE = Object.freeze([
  "preCreateChatMessage",
  "preCreateActiveEffect",
  "preCreateRegionBehavior",
  "dnd5e.preUseActivity",
  "dnd5e.postUseActivity",
  "dnd5e.preApplyDamage",
  "dnd5e.preCalculateDamage",
  "dnd5e.preRestCompleted",
  "dnd5e.preRollAttack",
  "dnd5e.preRollDamage",
  "dnd5e.preRollSavingThrow",
  "dnd5e.preRollAbilityCheck",
  "dnd5e.postRollConfiguration",
  "dnd5e.postDamageRollConfiguration",
  "dnd5e.rollDeathSave"
]);

const RANK = new Map(ORDER.map((key, i) => [key, i]));
const VETOES = new Set(VETOABLE);

/** hook → its handlers in ORDER, then registration order: `{ key, rank, seq, once, fn }`. */
const handlers = new Map();
let seq = 0;

function dispatch(hook, args) {
  const list = handlers.get(hook) ?? [];
  const stops = VETOES.has(hook);
  for ( const h of [...list] ) {
    if ( h.once ) list.splice(list.indexOf(h), 1);
    let result;
    try { result = h.fn(...args); }
    catch(err) {
      console.error(`Battle Flow | ${h.key}'s ${hook} handler failed.`, err);
      continue;
    }
    if ( stops && (result === false) ) return false;
  }
}

function register(hook, key, fn, once) {
  const rank = RANK.get(key);
  if ( rank === undefined ) throw new Error(`Battle Flow | dispatch: "${key}" is not in ORDER — add it (scripts/dispatch.js).`);
  if ( typeof fn !== "function" ) throw new Error(`Battle Flow | dispatch: ${key}'s ${hook} handler is not a function.`);
  if ( !handlers.has(hook) ) {
    handlers.set(hook, []);
    Hooks.on(hook, (...args) => dispatch(hook, args));
  }
  const list = handlers.get(hook);
  list.push({ key, rank, seq: seq++, once, fn });
  list.sort((a, b) => (a.rank - b.rank) || (a.seq - b.seq));
}

/**
 * Run `fn` on `hook`, in ORDER among the module's handlers.
 * @param {string} hook  the platform's hook name
 * @param {string} key   the registering file's scripts-relative path, without `.js`
 * @param {(...args: any[]) => any} fn
 */
export function listen(hook, key, fn) {
  register(hook, key, fn, false);
}

/** `listen`, for the first dispatch only. */
export function listenOnce(hook, key, fn) {
  register(hook, key, fn, true);
}

/**
 * Every handler registered, in dispatch order per hook — for the tools and the tests.
 * @returns {{hook: string, key: string, once: boolean}[]}
 */
export function registrations() {
  const out = [];
  for ( const [hook, list] of handlers ) for ( const h of list ) out.push({ hook, key: h.key, once: h.once });
  return out;
}
