// @ts-check
/** Battle Flow — DECISION (ARCHITECTURE.md §2): the rest grants given to allies. Pure. */

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
