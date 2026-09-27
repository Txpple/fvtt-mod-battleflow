// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): the rest grants given to allies (rest-grants.js) —
 * Inspiring Leader and Chef: what a creature already holds, and whether a Chef's meal reaches it.
 * Pure functions over plain data, no imports.
 */

/**
 * TEMPORARY HIT POINTS DO NOT STACK — a creature keeps the pool it chooses, and nobody keeps the
 * smaller on purpose, so a grant lands only where it is MORE than the creature holds; one already
 * holding as many is shown greyed, "has it".
 * @param {number} current  the creature's Temporary Hit Points now
 * @param {number} amount   the grant
 * @returns {boolean}       true when the grant would give it nothing
 */
export function holdsTemp(current, amount) {
  const have = Number(current) || 0;
  const give = Number(amount) || 0;
  return !(give > have);
}

/**
 * WHERE A CHEF'S MEAL STANDS FOR ONE EATER (Replenishing Meal: an eater who spends Hit Dice in the
 * Short Rest regains an extra 1d8). Each creature rests on its own client in any order, so this
 * reads the eater's LATEST Short Rest card (its Hit Dice spent, stamped by rest-grants.js):
 *   "spent"    it finished a Short Rest in the same sitting and spent Hit Dice — the extra lands now
 *   "none"     it finished one and spent none — the food does it no good (greyed)
 *   "resting"  no Short Rest of its own in this sitting yet — the extra waits for its rest's end
 * The same sitting: both rests answer the same Rest request when both name one (dnd5e's
 * `system.request`), else they ended within `windowMs` of each other.
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
