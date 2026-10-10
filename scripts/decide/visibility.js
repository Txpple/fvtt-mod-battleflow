// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): WHAT PLAYERS SEE on the public cards. The two settings
 * that own dnd5e's Visibility menu (issue #4, ARCHITECTURE §8). Pure: a choice in, the dnd5e keys out.
 */

/** Roll Results Players See: each choice and the dnd5e keys it sets. `dnd5e` writes nothing. */
export const ROLL_RESULTS = Object.freeze({
  open: Object.freeze({ attackRollVisibility: "all", challengeVisibility: "all" }),
  results: Object.freeze({ attackRollVisibility: "hideAC", challengeVisibility: "player" }),
  hidden: Object.freeze({ attackRollVisibility: "none", challengeVisibility: "none" }),
  dnd5e: Object.freeze({})
});

/**
 * Bloodied Shows on Every Token: on is `all`; off is dnd5e's own default `player` (friendly tokens
 * only), never `none`, which also stops dnd5e tracking the status.
 * @param {boolean} on
 */
export const bloodiedFor = on => ({ bloodied: on ? "all" : "player" });

/**
 * The dnd5e keys to write: the wanted values that differ from what the world holds. A key the
 * system does not register (`have` lacks it) is skipped; the caller warns.
 * @param {Record<string, string>} want
 * @param {Record<string, unknown>} have  the current values of the registered keys
 * @returns {[string, string][]}
 */
export const visibilityWrites = (want, have) =>
  Object.entries(want).filter(([key, value]) => (key in have) && (have[key] !== value));
