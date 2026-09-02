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
 *           turn it was written in — the turn IN PROGRESS, whoever's it is (an opportunity
 *           attack's chit dies with the victim's turn, not the attacker's next), so its `start`
 *           is the CURRENT turn's place, and its life is `chitStamp` against `combatStamp`.
 *           Out of combat there is no turn to be once-per, so no chit is written and every hit
 *           reminds — `chipClock` returns null for it there.
 */
export const CHIP_WINDOWS = Object.freeze({
  vex: Object.freeze({ value: 1, units: "rounds", expiry: "turnEnd" }),
  sap: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  slow: Object.freeze({ value: 1, units: "rounds", expiry: "turnStart" }),
  cleave: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  // Sneak Attack's "once per turn" (user, 2026-09-02) and a clock rider's (Dreadful Strike, Divine
  // Strike…): the Cleave chit's shape exactly — written when the damage is dealt, dead with the
  // turn it was written in.
  sneak: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" }),
  rider: Object.freeze({ value: 0, units: "turns", expiry: "turnEnd" })
});

/** The once-per-turn chits — no turn, no chit (`chipClock` yields null for them out of combat). */
export const TURN_CHITS = Object.freeze(["cleave", "sneak", "rider"]);

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
 * Is a chip dead by the platform's own reading? Expired is dead. A clock that never resolved
 * (`remaining` null or NaN) is dead too. A chip with NO clock is left alone — a durationless
 * effect is somebody else's contract.
 *
 * ⚠ ZERO ON THE CLOCK IS ALIVE (review finding, 2026-09-01 — the chip died a turn early). Foundry
 * measures a `rounds` window from `start.round`, so a one-round chip reads `remaining: 0` from
 * the START of the round its boundary falls in — the whole round in which Vex's turnEnd and
 * Sap's turnStart both sit — and writes `expired` only at the event. Reading zero as dead
 * dropped Vex from the gate on the one turn it exists for. The platform's mark is the truth
 * (NOTES §1: "suppression keys off the flag, not the arithmetic"); a NEGATIVE clock is the one
 * arithmetic fallback kept, for a table with no GM connected where the mark is never written —
 * it goes negative only in the round AFTER the boundary, so it can never kill early.
 *
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
 * The once-per-turn chit's identity: WHICH turn it was written in, as the house stamp
 * (`combat:round:turn` — core.js `combatStamp`), or null for a chit with no turn behind it.
 * A chit LIVES while its stamp equals the running combat's, and any mismatch IS expiry — the
 * `cleaveArm` idiom, and the reason the chit needs no GM: the platform's `expired` mark is
 * GM-written and both tidies are GM-gated, so on a no-GM table a mark-based chit stood forever
 * and Cleave never reminded again (review finding 17, 2026-09-01). The platform's expiry is
 * kept as the tidy that removes the document; this is what decides.
 *
 * @param {{combat?: string|null, round?: number|null, turn?: number|null}|null|undefined} start
 *        the effect's `start`, with `combat` already reduced to an id (a ForeignDocumentField
 *        on the document — the EDGE reads `.id`)
 */
export function chitStamp(start) {
  if ( !start?.combat || (start.round === null) || (start.round === undefined)
    || (start.turn === null) || (start.turn === undefined) ) return null;
  return `${start.combat}:${start.round}:${start.turn}`;
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
 * @param {{bearer: "attacker"|"target", attackerOwnsChip?: boolean}} roll
 *        who is wearing the chip on this roll — the attacker (its own Sap) or a target (the
 *        attacker's Vex on it) — and whether the attacker's weapon applied it
 */
export function chipSpentBy(key, { bearer, attackerOwnsChip = false }) {
  switch ( key ) {
    case "vex": return (bearer === "target") && !!attackerOwnsChip;
    case "sap": return bearer === "attacker";
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
 * @param {"advantage"|"disadvantage"|"normal"|null} [net]  the gate's net, when the gate SHOWED
 *        this chip's kind — `netShownFor` decides that; a bare net for a kind the gate never
 *        listed is the review finding 1 shape (an unlisted Vex stamped honoured by a Sap-only gate)
 */
export function chipHonoured(key, mode, net = null) {
  // An effect the rules spend on the roll (EFFECT_BENDS `spend: "attack"`) is honoured exactly
  // as a chip is: against the net the gate showed; with no net shown, nothing to honour.
  if ( key === "effect" ) return net ? (mode === net) : null;
  if ( !["vex", "sap"].includes(key) ) return null;
  if ( net ) return mode === net;
  if ( key === "vex" ) return mode === "advantage";
  return mode === "disadvantage";
}

/**
 * The net a spent chip is judged against: the gate's net when the gate READ this chip's kind
 * (its record lists a source of that kind), else null — the chip's own bend. A chip whose kind
 * is off the Reminder Sources list was never part of the resolution the roller saw, and honour
 * against a net it did not contribute to is a false receipt (review finding 1, 2026-09-01).
 *
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
