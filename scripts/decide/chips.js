// @ts-check
/**
 * Battle Flow — DECISION: the clock a chip carries, and what spends it.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * The platform keeps the clock (it judges `duration.expiry` against the combatant in `start`), so a
 * chip's window is written once, here; the module owns only which roll SPENDS a chip.
 * ⚠ The window values are measured, not read (NOTES *v14 owns effect expiry*): a window closing at
 * the end of the attacker's own turn is `value: 0`, and a `rounds` window counts from `start.round`.
 */

/** The flag key every Battle Flow chip carries (`flags.<module>.mastery = <key>`). */
export const CHIP_FLAG = "mastery";

/**
 * Does a chip belong to this attacker? Its `origin` is the weapon that applied it.
 * @param {string|null|undefined} origin
 * @param {string} attackerUuid
 */
export function chipOwnedBy(origin, attackerUuid) {
  return !!origin && !!attackerUuid && origin.startsWith(`${attackerUuid}.Item.`);
}

/**
 * The RAW window of each chip this module authors, as v14 duration data.
 *
 *   vex     "before the end of your next turn"        → 1 round, judged at the attacker's turnEnd
 *   sap     "before the start of your next turn"      → 1 round, judged at the attacker's turnStart
 *   slow    "until the start of your next turn"       → the same window as sap
 *   cleave, sneak, rider  "once per turn" chits on the attacker: dead with the turn IN PROGRESS
 *           (an opportunity attack's dies with the victim's turn), so `start` is the current
 *           turn's place; out of combat no chit is written (`chipClock` → null)
 */
export const CHIP_WINDOWS = Object.freeze({
  vex: Object.freeze({ value: 1, units: "rounds", expiry: "turnEnd" }),
  sap: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  slow: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  cleave: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  sneak: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  rider: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  // Steady Aim: ends with the attacker's turn or its next attack roll; out of combat, until spent.
  steadyAim: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  // A spent Reaction, back at the reactor's turn start; read by every hold's offer gate.
  // ⚠ ZERO TURNS, not one round: a Reaction spent on another's turn returns at the reactor's NEXT
  // turn, which can be less than a round away.
  reaction: Object.freeze({ value: 0, units: "turns", expiry: "turnStart" }),
  // Sentinel's Halt: "the rest of the current turn", the MOVER's, not the attacker's (TURN_PINNED).
  halt: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" })
});

/** The once-per-turn chits — no turn, no chit (`chipClock` yields null for them out of combat). */
export const TURN_CHITS = Object.freeze(["cleave", "sneak", "rider", "steadyAim", "reaction", "halt"]);

/** The windows pinned to the CURRENT turn's place (`turnPlace`), not the attacker's. */
export const TURN_PINNED = Object.freeze(["halt"]);

/**
 * Does a Reaction chip still STAND (the reactor has not begun a turn since)? Stamp arithmetic,
 * not the platform's GM-written mark, so a no-GM table gets its Reaction back. No clock: stands;
 * no combat: dead.
 * @param {{start?: {round?: number|null, turn?: number|null}|null, now: {round: number, turn: number}|null,
 *          actorTurn: number|null}} facts   `actorTurn` = the reactor's index in the turn order (null: not in it)
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

/** The chips a turn boundary can end, keyed by who the window belongs to. */
export const TURN_CHIPS = Object.freeze(Object.keys(CHIP_WINDOWS));

/**
 * The clock for one chip: its duration and, in a running combat, the `start` that pins it to the
 * given place (an opportunity attack is made on somebody else's turn).
 * @param {string} key                      a CHIP_WINDOWS key
 * @param {{combat: string, combatant: string|null, initiative: number|null,
 *          round: number, turn: number, time: number}|null} place
 *        the attacker's place in the RUNNING combat (Vex, Sap, Slow), or the CURRENT turn's
 *        place (the Cleave chit — `mastery.js` `turnPlace`), or null out of combat
 * @returns {{duration: {value: number, units: string, expiry: string},
 *            start?: {combat: string, combatant: string|null, initiative: number|null,
 *                     round: number, turn: number, time: number}}|null}
 *          null for a chip this module does not clock, and for a once-per-turn chit out of combat
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
 * Is a chip dead by the platform's reading? Expired, or a clock that never resolved. A chip with
 * no clock is left alone.
 * ⚠ ZERO REMAINING IS ALIVE: a one-round chip reads 0 for the whole round its boundary falls in.
 * Negative is the no-GM fallback (the mark is GM-written); it never kills early.
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
 * The once-per-turn chit's identity: the turn it was written in (`combat:round:turn`, core.js
 * `combatStamp`), or null. A chit lives while its stamp equals the running combat's, so it needs
 * no GM (the platform's expiry mark is GM-written; it only tidies the document).
 * @param {{combat?: string|null, round?: number|null, turn?: number|null}|null|undefined} start
 *        the effect's `start`, `combat` already reduced to an id
 */
export function chitStamp(start) {
  if ( !start?.combat || (start.round === null) || (start.round === undefined)
    || (start.turn === null) || (start.turn === undefined) ) return null;
  return `${start.combat}:${start.round}:${start.turn}`;
}

/**
 * Does this attack roll SPEND this chip? The rules spend it whether or not the roll honoured it.
 *   vex  on the TARGET: spent by the applying attacker's next attack roll against it
 *   sap  on the sapped creature: spent by its own next attack roll, at anyone
 * Everything else is closed by its window alone.
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
 * The roll mode from the system's signed advantage mode (the decision layer cannot read CONFIG).
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
 * Was the chip's rule HONOURED by the roll that spent it? Vex wants advantage, Sap disadvantage.
 * ⚠ When the gate showed the NET of every source, honour is the press matching the net (Vex and
 * Sap together net to normal).
 * @param {string} key
 * @param {"advantage"|"disadvantage"|"normal"} mode
 * @param {"advantage"|"disadvantage"|"normal"|null} [net]  the gate's net, only when it showed this kind (`netShownFor`)
 */
export function chipHonoured(key, mode, net = null) {
  // A spent effect (EFFECT_BENDS `spend: "attack"`) is judged against the net shown, if any.
  if ( key === "effect" ) return net ? (mode === net) : null;
  if ( !["vex", "sap"].includes(key) ) return null;
  if ( net ) return mode === net;
  if ( key === "vex" ) return mode === "advantage";
  return mode === "disadvantage";
}

/**
 * The net a spent chip is judged against: the gate's net when the gate listed a source of this
 * kind, else null. A net the chip did not contribute to would make a false receipt.
 * @param {{sources?: {kind?: string}[], net?: string|null}|null|undefined} reminder
 *        the `reminder` flag on the attack message, when the gate re-issued it
 * @param {string} key   the spent chip's kind
 * @returns {"advantage"|"disadvantage"|"normal"|null}
 */
export function netShownFor(reminder, key) {
  if ( !reminder?.net ) return null;
  return (reminder.sources ?? []).some(s => s?.kind === key)
    ? /** @type {"advantage"|"disadvantage"|"normal"} */ (reminder.net) : null;
}

/**
 * THE constructor for a `chipSpend` entry: the receipt that a chip vanished because the rules
 * spent it (DESIGN R5). The edge stamps the data-plane context at the flag level.
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
 * The card-chip row a cast offers, or null: the cast item's name is the row's `on`, the caster
 * owns the row's `feature`, and the row is listed.
 * @param {Record<string, {on: string, feature: string}>} table
 * @param {{ itemName: string|null|undefined, featureNames: Iterable<string> }} use
 * @param {Set<string>} listed   the Card Chips list, lower-cased row names
 * @returns {string|null}   the row's key
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
 * How many more of a row's chips may be built: `max` less what stands, never below zero.
 * @param {number} standing
 * @param {number} max
 * @returns {number}
 */
export function chipsLeft(standing, max) {
  return Math.max(0, (Number(max) || 0) - (Number(standing) || 0));
}

/**
 * The coating's save ability. The pack ships one save activity per ability the feat can raise:
 * take the one the feat's own Ability Score Improvement assigned, else the higher modifier
 * offered (the first on a tie).
 * @param {{offered?: string[], assigned?: string[]|null, mods?: Record<string, number>}} [facts]
 * @returns {string|null}  the ability key, or null when nothing is offered
 */
export function coatSaveAbility({ offered = [], assigned = null, mods = {} } = {}) {
  const chosen = (assigned ?? []).find(a => offered.includes(a));
  if ( chosen ) return chosen;
  let best = null;
  for ( const a of offered ) if ( (best === null) || ((Number(mods[a]) || 0) > (Number(mods[best]) || 0)) ) best = a;
  return best;
}

/**
 * A feature's doses left (`max` less `spent`, floor 0); an unprepared formula max reads as none.
 * @param {{max?: number|string|null, spent?: number|null}} uses
 * @returns {number}
 */
export function dosesLeft({ max = null, spent = 0 } = {}) {
  const m = Number(max);
  if ( !Number.isFinite(m) ) return 0;
  return Math.max(0, m - (Number(spent) || 0));
}
