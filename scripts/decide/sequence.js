/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE HIT'S SEQUENCE. A hit's offers QUEUE behind the
 * damage and a mastery's DECISION, never a mastery NOTICE (ARCHITECTURE *The presentation laws*, law 7). Pure.
 */

/**
 * The offer's next step; `promote` starts its clock NOW, `moot` resolves quietly (nobody left).
 * @param {object} facts
 * @param {string} facts.status          only "queued" moves
 * @param {string|null} facts.masteryStatus  the mastery ASK's status, null when none
 * @param {boolean} facts.damageLanded
 * @param {number} facts.living          targets still standing after the damage
 * @returns {"wait"|"promote"|"moot"|"none"}
 */
export function hitOfferStep({ status, masteryStatus = null, damageLanded, living }) {
  if ( status !== "queued" ) return "none";
  if ( !damageLanded ) return "wait";
  if ( masteryStatus === "pending" ) return "wait";
  return living > 0 ? "promote" : "moot";
}

/**
 * Within the bash's 5 feet (DESIGN R1)? An unmeasured distance keeps the offer.
 * @param {number|null} distanceFeet  nearest edges, in feet
 * @returns {boolean}
 */
export function withinBashReach(distanceFeet) {
  if ( (distanceFeet === null) || (distanceFeet === undefined) || !Number.isFinite(Number(distanceFeet)) ) return true;
  return Number(distanceFeet) <= 5;
}

/**
 * A size-limited push: an unknown size or no limit allows it (unreadable data never refuses).
 * @param {string[]} order   CONFIG.DND5E.actorSizes' keys, smallest first
 * @param {string|null} pusher
 * @param {string|null} target
 * @param {number|null} larger  the most sizes larger the target may be
 */
export function sizeAllows(order, pusher, target, larger) {
  if ( (larger === null) || (larger === undefined) ) return true;
  const a = (order ?? []).indexOf(pusher), t = (order ?? []).indexOf(target);
  if ( (a < 0) || (t < 0) ) return true;
  return (t - a) <= larger;
}
