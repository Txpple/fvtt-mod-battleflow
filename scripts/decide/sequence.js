/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE HIT'S SEQUENCE — what a hit's offer does next,
 * from facts alone. A hit's offers QUEUE behind the damage, and behind the weapon mastery's
 * DECISION when it asks one (Slow, Topple, Push); a mastery NOTICE (Vex, Sap, Cleave) never holds
 * them (ARCHITECTURE *The presentation laws*, law 7). Pure; the edge (bash-offer.js) gathers the facts.
 */

/**
 * The offer's next step.
 * @param {object} facts
 * @param {string} facts.status          the offer's own status — only "queued" moves
 * @param {string|null} facts.masteryStatus  the attack's mastery ASK status, or null when there
 *                                       is none (a notice or no mastery at all)
 * @param {boolean} facts.damageLanded   a damage message for this attack exists and its payouts ran
 * @param {number} facts.living          how many of the offer's targets still stand after the damage
 * @returns {"wait"|"promote"|"moot"|"none"}
 *   none     — the offer is not queued (already pending, answered or moot): nothing to do
 *   wait     — the damage has not landed, or the mastery's decision is still open
 *   promote  — open it: status pending, the clock starts NOW, not at the hit
 *   moot     — the damage left nobody to bash: resolve it quietly, no popup
 */
export function hitOfferStep({ status, masteryStatus = null, damageLanded, living }) {
  if ( status !== "queued" ) return "none";
  if ( !damageLanded ) return "wait";
  if ( masteryStatus === "pending" ) return "wait";
  return living > 0 ? "promote" : "moot";
}

/**
 * Can this struck creature be bashed? Shield Master's "a creature within 5 feet of you" is the
 * feat's own clause and the map settles it (DESIGN R1, "game logic is not judgment"). An
 * unmeasurable distance (no tokens) keeps the offer — a question the player can pass.
 * @param {number|null} distanceFeet  attacker to target, nearest edges, in FEET (null: unmeasured)
 * @returns {boolean}
 */
export function withinBashReach(distanceFeet) {
  if ( (distanceFeet === null) || (distanceFeet === undefined) || !Number.isFinite(Number(distanceFeet)) ) return true;
  return Number(distanceFeet) <= 5;
}

/**
 * "If the target is no more than one size larger than you" (Crusher's push): the two sizes' places
 * in the system's own order. An unknown size, or no limit, allows the push — unreadable data never
 * refuses.
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
