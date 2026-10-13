// @ts-check
/** By the Books — DECISION (ARCHITECTURE.md §2): the rest grants given to allies. Pure. */

/**
 * TEMPORARY HIT POINTS DO NOT STACK: true when the grant is no more than what the creature holds.
 * @param {number} current
 * @param {number} amount
 * @returns {boolean}
 */
export function holdsTemp(current, amount) {
  const have = Number(current) || 0;
  const give = Number(amount) || 0;
  return !(give > have);
}

/**
 * A Chef's meal for one eater, off its LATEST Short Rest (rests land in any order): "spent" Hit
 * Dice in the same sitting, "none" spent, or still "resting". The same sitting: one Rest request
 * (`system.request`) when both name one, else within `windowMs`.
 * @param {{rest?: {at?: number, hitDice?: number, requestId?: string|null}|null,
 *          chef: {at: number, requestId?: string|null}, windowMs?: number}} facts
 * @returns {"spent"|"none"|"resting"}
 */
export function mealStanding({ rest = null, chef, windowMs = 2 * 60 * 60 * 1000 }) {
  if ( !rest || !Number.isFinite(rest.at) ) return "resting";
  const same = (rest.requestId && chef?.requestId)
    ? (rest.requestId === chef.requestId)
    : (Math.abs(Number(rest.at) - Number(chef?.at)) <= windowMs);
  if ( !same ) return "resting";
  return (Number(rest.hitDice) > 0) ? "spent" : "none";
}

/* --- what a rest ends (RULINGS *Rests end the short effects*) ------------------------------------------ */

/** A rest's reach: the longest duration it ends, in seconds (a Short Rest 1 hour, a Long Rest 8). */
export const REST_REACH = Object.freeze({ short: 3600, long: 8 * 3600 });

/** Seconds a unit lasts; a round or a turn is 6 seconds, a month 30 days, a year 365. */
const UNIT_SECONDS = Object.freeze({ seconds: 1, minutes: 60, hours: 3600, days: 86400, months: 30 * 86400, years: 365 * 86400,
  rounds: 6, turns: 6 });

/** The combat and rest events that end an effect sooner than any rest (Foundry 14's `duration.expiry`). */
const SHORT_EXPIRY = new Set(["combatStart", "roundStart", "turnStart", "combatEnd", "roundEnd", "turnEnd",
  "sourceStart", "sourceEnd", "targetStart", "targetEnd"]);

/**
 * How long an effect lasts, in seconds, off Foundry 14's duration data (`value` in `units`, or an
 * `expiry` event alone): a combat or turn event alone is short (0), a rest event the rest's own
 * length, nothing at all Infinity (a feature's mark, a companion, a lit torch).
 * @param {{ value?: number|null, units?: string|null, expiry?: string|null }|null|undefined} duration
 * @returns {number}
 */
export function effectSeconds(duration) {
  const value = Number(duration?.value);
  if ( Number.isFinite(value) && (duration?.value !== null) && (duration?.value !== undefined) ) {
    const per = UNIT_SECONDS[String(duration?.units ?? "seconds")];
    return per ? value * per : Infinity;
  }
  const expiry = String(duration?.expiry ?? "");
  if ( SHORT_EXPIRY.has(expiry) ) return 0;
  if ( expiry === "shortRest" ) return REST_REACH.short;
  if ( expiry === "longRest" ) return REST_REACH.long;
  return Infinity;
}

/**
 * What a rest ends on the rester (RULINGS *Rests end the short effects*): a Long Rest ends Concentration and every effect
 * lasting 8 hours or less; a Short Rest keeps Concentration and ends every effect lasting 1 hour or
 * less. A Concentration effect is never in `end`: the caller ends Concentration through the system,
 * whose cascade takes what depends on it. An effect with no duration stands.
 * @param {Array<{ id: string, concentration?: boolean, duration?: { value?: number|null, units?: string|null, expiry?: string|null }|null }>} effects
 * @param {"short"|"long"|string} type
 * @returns {{ end: string[], concentration: boolean }}
 */
export function restEnds(effects, type) {
  const reach = REST_REACH[/** @type {"short"|"long"} */ (type)];
  if ( !reach ) return { end: [], concentration: false };
  const end = [];
  let concentration = false;
  for ( const e of effects ?? [] ) {
    if ( e?.concentration ) { if ( type === "long" ) concentration = true; continue; }
    if ( effectSeconds(e?.duration) <= reach ) end.push(e.id);
  }
  return { end, concentration };
}
