// @ts-check
/**
 * Battle Flow — DECISION: the clock a chip carries, and what spends it.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE PLATFORM KEEPS THE CLOCK; THE MODULE KEEPS THE RULES (HANDOFF R-C, 2026-09-01). Foundry
 * v14 judges an ActiveEffect's `duration.expiry` event against the combatant recorded in its
 * `start`, on every turn and round boundary, on the GM client — so a chip's window is written
 * ONCE, here, as the rules text reads, and nothing in this module ever counts turns. What the
 * module still owns is EVENTS: which attack roll SPENDS a chip (the rules spend Vex and Sap
 * whether or not the player claimed them), and when a chip the platform has marked expired
 * may be tidied away.
 *
 * ⚠ The values below are MEASURED, not read (tools/probe-expiry.mjs, Foundry 14.365). Two of
 * the platform's habits decide them: the `turnEnd` refresh does not recompute remaining time,
 * so a window meant to close at the end of the attacker's OWN turn must already read zero when
 * that turn ends (`value: 0`); and a `rounds` window is measured from `start.round`, so "your
 * next turn" is one round with the attacker's own combatant in `start`.
 */

/** The flag key every Battle Flow chip carries (`flags.<module>.mastery = <key>`) — the fingerprint
 * the applier, the spend, the tidy and the reminder gate all read. One name, here. */
export const CHIP_FLAG = "mastery";

/**
 * Does a chip belong to this attacker? A chip's `origin` is the WEAPON that applied it, so the
 * attacker owns it when that weapon is theirs — the origin uuid starts with the attacker's.
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
 *   cleave  "only once per turn" — the once-per-turn chit on the ATTACKER (user, 2026-09-01):
 *           the popup is offered when no chit stands, the chit is written, and it dies with the
 *           turn it was written in. Out of combat there is no turn to be once-per, so no chit
 *           is written and every hit reminds — `chipClock` returns null for it there.
 */
export const CHIP_WINDOWS = Object.freeze({
  vex: Object.freeze({ value: 1, units: "rounds", expiry: "turnEnd" }),
  sap: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  slow: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  cleave: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" })
});

/** The chips a turn boundary can end, keyed by who the window belongs to. */
export const TURN_CHIPS = Object.freeze(Object.keys(CHIP_WINDOWS));

/**
 * The clock for one chip: the duration the rules give it, and — in a running combat — the
 * `start` that pins the window to the ATTACKER's place in the order rather than to whoever's
 * turn the platform happens to see (an opportunity attack is made on somebody else's turn).
 *
 * @param {string} key                      a CHIP_WINDOWS key
 * @param {{combat: string, combatant: string|null, initiative: number|null,
 *          round: number, turn: number, time: number}|null} place
 *        the attacker's place in the RUNNING combat, or null out of combat
 * @returns {{duration: {value: number, units: string, expiry: string},
 *            start?: {combat: string, combatant: string|null, initiative: number|null,
 *                     round: number, turn: number, time: number}}|null}
 *          null for a chip this module does not clock, and for a once-per-turn chit out of combat
 */
export function chipClock(key, place) {
  const window = CHIP_WINDOWS[/** @type {keyof typeof CHIP_WINDOWS} */ (key)];
  if ( !window ) return null;
  if ( !place ) return (key === "cleave") ? null : { duration: { ...window } };
  return {
    duration: { ...window },
    start: { combat: place.combat, combatant: place.combatant, initiative: place.initiative,
      round: place.round, turn: place.turn, time: place.time }
  };
}

/**
 * Is a chip dead by the platform's own reading? Expired is dead; a clock that ran out or never
 * resolved (`remaining` null or NaN — the v1.27.1 shape) is dead too. Two chips are left alone:
 * one with NO clock, because a durationless effect is somebody else's contract; and a
 * ZERO-length window (the once-per-turn chit), whose `remaining` reads 0 from the moment it is
 * written — its whole life is the event, so only `expired` can end it.
 *
 * @param {{expired?: boolean, remaining?: number|null, value?: number|null}} duration
 */
export function chipIsDead({ expired = false, remaining = null, value = null } = {}) {
  if ( value === null || value === undefined ) return false;
  if ( expired ) return true;
  if ( value === 0 ) return false;
  return !(Number(remaining) > 0);
}

/**
 * Does this attack roll SPEND this chip? The rules spend it whether or not the roll honoured
 * it — "your next attack roll" is the next one made, claimed or not.
 *
 *   vex  the chip sits on the TARGET and belongs to the attacker who applied it: spent by that
 *        attacker's next attack roll against the bearer, with any weapon.
 *   sap  the chip sits on the SAPPED creature: spent by the bearer's next attack roll, at anyone.
 *   Everything else this module clocks (slow, the cleave chit) is spent by nothing — its window
 *   closes it.
 *
 * @param {string} key
 * @param {{bearerIsTarget: boolean, bearerIsAttacker: boolean, attackerOwnsChip: boolean}} roll
 */
export function chipSpentBy(key, { bearerIsTarget, bearerIsAttacker, attackerOwnsChip }) {
  switch ( key ) {
    case "vex": return !!bearerIsTarget && !!attackerOwnsChip;
    case "sap": return !!bearerIsAttacker;
    default: return false;
  }
}

/**
 * The roll mode a d20 went out with, from the system's signed advantage mode (advantage > 0,
 * disadvantage < 0, else normal). The DECISION layer cannot read CONFIG, so it reads the sign.
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
 * Was the chip's rule HONOURED by the roll that spent it? On its own, Vex wants advantage and
 * Sap wants disadvantage. ⚠ When the gate showed the roller the NET of every source (a sapped
 * attacker swinging at a target they Vexed nets to a normal roll — the user's ruling), honour
 * is the press matching the NET, not the chip's own bend: pressing Normal there honoured both.
 * A chip nothing spends has nothing to honour.
 * @param {string} key
 * @param {"advantage"|"disadvantage"|"normal"} mode
 * @param {"advantage"|"disadvantage"|"normal"|null} [net]  the gate's net, when a gate ran
 */
export function chipHonoured(key, mode, net = null) {
  if ( !["vex", "sap"].includes(key) ) return null;
  if ( net ) return mode === net;
  if ( key === "vex" ) return mode === "advantage";
  return mode === "disadvantage";
}

/**
 * One spent-chip record, THE constructor for every `chipSpend` entry on an attack message —
 * the receipt that says a chip vanished because the rules spent it (DESIGN R5: a vanishing
 * icon must never be a mystery). The data-plane context is stamped once, at the flag level,
 * by the EDGE that writes it.
 *
 * @param {{id: string, name: string, img?: string|null, key: string, bearerUuid: string,
 *          bearerName: string, mode: "advantage"|"disadvantage"|"normal",
 *          net?: "advantage"|"disadvantage"|"normal"|null}} spent
 */
export function spendRecord({ id, name, img = null, key, bearerUuid, bearerName, mode, net = null }) {
  return { id, name, img, key, uuid: bearerUuid, bearer: bearerName, mode,
    honoured: chipHonoured(key, mode, net) };
}
