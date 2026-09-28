// @ts-check
/**
 * Battle Flow — DECISION: the clock a chip carries, and what spends it. Pure (ARCHITECTURE.md §2).
 * The platform keeps the clock (`duration.expiry` against `start`'s combatant); the module owns only
 * which roll SPENDS a chip. ⚠ Window values are measured (NOTES *v14 owns effect expiry*): the end of
 * the attacker's own turn is `value: 0`, and a `rounds` window counts from `start.round`.
 */

/** `flags.<module>.mastery = <key>` on every chip. */
export const CHIP_FLAG = "mastery";

/**
 * A chip's `origin` is the weapon that applied it.
 * @param {string|null|undefined} origin
 * @param {string} attackerUuid
 */
export function chipOwnedBy(origin, attackerUuid) {
  return !!origin && !!attackerUuid && origin.startsWith(`${attackerUuid}.Item.`);
}

/**
 * The RAW window of each chip, as v14 duration data. Vex ends at the attacker's next turn end, Sap
 * and Slow at its next turn start; the once-per-turn chits die with the turn IN PROGRESS (an
 * opportunity attack's with the victim's turn).
 */
export const CHIP_WINDOWS = Object.freeze({
  vex: Object.freeze({ value: 1, units: "rounds", expiry: "turnEnd" }),
  sap: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  slow: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  cleave: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  sneak: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  rider: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  steadyAim: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  // ⚠ ZERO TURNS, not one round: a Reaction spent on another's turn returns at the reactor's NEXT turn.
  reaction: Object.freeze({ value: 0, units: "turns", expiry: "turnStart" }),
  // Sentinel's Halt: the rest of the MOVER's turn (TURN_PINNED).
  halt: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" })
});

/** The once-per-turn chits: none out of combat. */
export const TURN_CHITS = Object.freeze(["cleave", "sneak", "rider", "steadyAim", "reaction", "halt"]);

/** Pinned to the CURRENT turn's place, not the attacker's. */
export const TURN_PINNED = Object.freeze(["halt"]);

/**
 * Has the reactor not begun a turn since? Stamp arithmetic, not the GM-written mark, so a no-GM
 * table gets its Reaction back. No clock: stands; no combat: dead.
 * @param {{start?: {round?: number|null, turn?: number|null}|null, now: {round: number, turn: number}|null,
 *          actorTurn: number|null}} facts   `actorTurn` = the reactor's turn index (null: not in it)
 */
export function reactionStands({ start = null, now, actorTurn }) {
  if ( !start || (start.round === null) || (start.round === undefined) || (start.turn === null) || (start.turn === undefined) ) return true;
  if ( !now ) return false;
  if ( (actorTurn === null) || (actorTurn === undefined) || (actorTurn < 0) ) return false;
  const back = (actorTurn > start.turn) ? { round: start.round, turn: actorTurn } : { round: start.round + 1, turn: actorTurn };
  if ( now.round > back.round ) return false;
  if ( now.round < back.round ) return true;
  return now.turn < back.turn;
}

/**
 * Reactive (REACTION_RESETS `every: "turn"`): the spent Reaction stands only for the turn it was spent on —
 * any turn's start gives it back. No clock: stands; no combat: dead.
 * @param {{start?: {round?: number|null, turn?: number|null}|null, now: {round: number, turn: number}|null}} facts
 */
export function reactionStandsEveryTurn({ start = null, now }) {
  if ( !start || (start.round === null) || (start.round === undefined) || (start.turn === null) || (start.turn === undefined) ) return true;
  if ( !now ) return false;
  return (now.round === start.round) && (now.turn === start.turn);
}

export const TURN_CHIPS = Object.freeze(Object.keys(CHIP_WINDOWS));

/**
 * One chip's duration and, in combat, the `start` pinning it to `place`: the attacker's place, or
 * the current turn's for a chit. Null for an unclocked key or a chit out of combat.
 * @param {string} key                      a CHIP_WINDOWS key
 * @param {{combat: string, combatant: string|null, initiative: number|null,
 *          round: number, turn: number, time: number}|null} place
 * @returns {{duration: {value: number, units: string, expiry: string},
 *            start?: {combat: string, combatant: string|null, initiative: number|null,
 *                     round: number, turn: number, time: number}}|null}
 */
export function chipClock(key, place) {
  const window = CHIP_WINDOWS[/** @type {keyof typeof CHIP_WINDOWS} */ (key)];
  if ( !window ) return null;
  if ( !place ) return TURN_CHITS.includes(key) ? null : { duration: { ...window } };
  return {
    duration: { ...window },
    start: { combat: place.combat, combatant: place.combatant, initiative: place.initiative,
      round: place.round, turn: place.turn, time: place.time }
  };
}


/**
 * Expired, or a clock that never resolved; a chip with no clock is left alone.
 * ⚠ ZERO REMAINING IS ALIVE (a one-round chip reads 0 all its last round); negative is the no-GM fallback.
 * @param {{expired?: boolean, remaining?: number|null, value?: number|null}} duration
 */
export function chipIsDead({ expired = false, remaining = null, value = null } = {}) {
  if ( value === null || value === undefined ) return false;
  if ( expired ) return true;
  if ( (remaining === null) || (remaining === undefined) ) return true;
  const left = Number(remaining);
  if ( Number.isNaN(left) ) return true;
  return left < 0;
}

/**
 * A chit's identity, `combat:round:turn` (core.js `combatStamp`): it lives while that equals the
 * running combat's, so it needs no GM.
 * @param {{combat?: string|null, round?: number|null, turn?: number|null}|null|undefined} start   `combat` as an id
 */
export function chitStamp(start) {
  if ( !start?.combat || (start.round === null) || (start.round === undefined)
    || (start.turn === null) || (start.turn === undefined) ) return null;
  return `${start.combat}:${start.round}:${start.turn}`;
}

/**
 * Does this attack roll SPEND this chip, honoured or not? Vex (on the target): the applier's next
 * attack at it; Sap: the sapped creature's own next attack. The rest close by window alone.
 * @param {string} key
 * @param {{bearer: "attacker"|"target", attackerOwnsChip?: boolean}} roll
 */
export function chipSpentBy(key, { bearer, attackerOwnsChip = false }) {
  switch ( key ) {
    case "vex": return (bearer === "target") && !!attackerOwnsChip;
    case "sap": return bearer === "attacker";
    default: return false;
  }
}

/**
 * The roll mode from the signed advantage mode (no CONFIG here).
 * @param {number|null|undefined} advantageMode
 * @returns {"advantage"|"disadvantage"|"normal"}
 */
export function rollModeOf(advantageMode) {
  const n = Number(advantageMode);
  if ( n > 0 ) return "advantage";
  if ( n < 0 ) return "disadvantage";
  return "normal";
}

/**
 * Did the spending roll honour the chip? Vex wants advantage, Sap disadvantage. ⚠ When the gate
 * showed a NET, honour is matching the net (Vex and Sap together net to normal).
 * @param {string} key
 * @param {"advantage"|"disadvantage"|"normal"} mode
 * @param {"advantage"|"disadvantage"|"normal"|null} [net]  from `netShownFor`
 */
export function chipHonoured(key, mode, net = null) {
  // A spent effect (EFFECT_BENDS `spend: "attack"`).
  if ( key === "effect" ) return net ? (mode === net) : null;
  if ( !["vex", "sap"].includes(key) ) return null;
  if ( net ) return mode === net;
  if ( key === "vex" ) return mode === "advantage";
  return mode === "disadvantage";
}

/**
 * The gate's net, only when the gate listed a source of this kind: a net the chip did not feed
 * would make a false receipt.
 * @param {{sources?: {kind?: string}[], net?: string|null}|null|undefined} reminder   the attack's `reminder` flag
 * @param {string} key
 * @returns {"advantage"|"disadvantage"|"normal"|null}
 */
export function netShownFor(reminder, key) {
  if ( !reminder?.net ) return null;
  return (reminder.sources ?? []).some(s => s?.kind === key)
    ? /** @type {"advantage"|"disadvantage"|"normal"} */ (reminder.net) : null;
}

/**
 * THE `chipSpend` entry: the receipt that the rules spent a chip (DESIGN R5).
 * @param {{id: string, name: string, img?: string|null, key: string, bearerUuid: string,
 *          bearerName: string, mode: "advantage"|"disadvantage"|"normal",
 *          net?: "advantage"|"disadvantage"|"normal"|null}} spent
 */
export function spendRecord({ id, name, img = null, key, bearerUuid, bearerName, mode, net = null }) {
  return { id, name, img, key, uuid: bearerUuid, bearer: bearerName, mode,
    honoured: chipHonoured(key, mode, net) };
}

/* --- card chips ------------------------------------------------------------------------------ */

/**
 * The listed card-chip row whose `on` is the cast item and whose `feature` the caster owns, or null.
 * @param {Record<string, {on: string, feature: string}>} table
 * @param {{ itemName: string|null|undefined, featureNames: Iterable<string> }} use
 * @param {Set<string>} listed   lower-cased row names
 * @returns {string|null}
 */
export function cardChipRowKey(table, { itemName, featureNames }, listed) {
  const item = String(itemName ?? "").toLowerCase();
  if ( !item ) return null;
  const owned = new Set([...(featureNames ?? [])].map(n => String(n).toLowerCase()));
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !listed?.has?.(key.toLowerCase()) ) continue;
    if ( String(row.on).toLowerCase() !== item ) continue;
    if ( owned.has(String(row.feature).toLowerCase()) ) return key;
  }
  return null;
}

/**
 * @param {number} standing
 * @param {number} max
 * @returns {number}
 */
export function chipsLeft(standing, max) {
  return Math.max(0, (Number(max) || 0) - (Number(standing) || 0));
}

/**
 * The coating's save ability (the pack ships one save per ability the feat can raise): the one the
 * feat's ASI assigned, else the higher modifier offered, the first on a tie.
 * @param {{offered?: string[], assigned?: string[]|null, mods?: Record<string, number>}} [facts]
 * @returns {string|null}
 */
export function coatSaveAbility({ offered = [], assigned = null, mods = {} } = {}) {
  const chosen = (assigned ?? []).find(a => offered.includes(a));
  if ( chosen ) return chosen;
  let best = null;
  for ( const a of offered ) if ( (best === null) || ((Number(mods[a]) || 0) > (Number(mods[best]) || 0)) ) best = a;
  return best;
}

/**
 * An unprepared formula max reads as none.
 * @param {{max?: number|string|null, spent?: number|null}} uses
 * @returns {number}
 */
export function dosesLeft({ max = null, spent = 0 } = {}) {
  const m = Number(max);
  if ( !Number.isFinite(m) ) return 0;
  return Math.max(0, m - (Number(spent) || 0));
}
