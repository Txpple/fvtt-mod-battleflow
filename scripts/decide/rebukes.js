// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the REBUKE — a Reaction to taking damage,
 * aimed at the creature that dealt it (the Goliath walk, 2026-09-25; the table is
 * decide/registry.js REBUKES, the machine rebukes.js). Plain facts in, plain answers out.
 */

/**
 * The reach of one rebuke, in feet: the row's own `range` when the data carries none
 * (Retaliation's "within 5 feet"), else the reaction activity's range read off the sheet. Null
 * when neither can be read — the offer is then not made (the gate never guesses a reach).
 * @param {{range?: number}} row
 * @param {number|null} activityFeet  the activity's range, already in feet
 * @returns {number|null}
 */
export function rebukeReach(row, activityFeet) {
  if ( Number(row?.range) > 0 ) return Number(row.range);
  return (Number(activityFeet) > 0) ? Number(activityFeet) : null;
}

/**
 * May this rebuke be offered now? The reasons it may not, in the order a reader checks them —
 * every one a fact off the sheets and the map. Null when it may.
 * @param {object} f
 * @param {boolean} f.self           the damager is the bearer
 * @param {number} f.hp              the bearer's HP after the damage
 * @param {boolean} f.reactionSpent  a Reaction chip stands
 * @param {number|null} f.distance   feet between the two, null when unmeasured
 * @param {number|null} f.reach      the rebuke's reach in feet
 * @param {number|null} f.usesLeft   the item's uses left, null when it has none to spend
 * @param {boolean|null} f.slot      a spell slot stands (null: not a spell)
 * @param {boolean|null} f.whileStands  the row's `while` effect stands (null: no `while`)
 * @param {boolean|null} f.equipped  the item is equipped (null: no `equipped` rule)
 * @returns {string|null}
 */
export function rebukeBlocked({ self, hp, reactionSpent, distance, reach, usesLeft, slot, whileStands, equipped }) {
  if ( self ) return "self";
  if ( !(Number(hp) > 0) ) return "down";
  if ( reactionSpent ) return "reaction spent";
  if ( whileStands === false ) return "not active";
  if ( equipped === false ) return "not held";
  if ( (usesLeft !== null) && (usesLeft !== undefined) && !(Number(usesLeft) > 0) ) return "no uses left";
  if ( slot === false ) return "no spell slot";
  if ( (reach === null) || (reach === undefined) ) return "no reach";
  if ( (distance === null) || (distance === undefined) ) return "distance unknown";
  if ( Number(distance) > Number(reach) ) return "out of reach";
  return null;
}

/**
 * The cost a rebuke's button names — "a Reaction · 2 of 3 uses left", "a Reaction, a spell slot".
 * @param {{usesLeft?: number|null, usesMax?: number|null, spell?: boolean}} f
 */
export function rebukeCost({ usesLeft = null, usesMax = null, spell = false }) {
  if ( spell ) return "a Reaction, a spell slot";
  if ( (usesLeft !== null) && (Number(usesMax) > 0) ) {
    return `a Reaction · ${usesLeft} of ${usesMax} use${Number(usesMax) === 1 ? "" : "s"} left`;
  }
  return "a Reaction";
}

/**
 * The card's line for a rebuke record — source, then result (law 6).
 * @param {{actorName?: string, sourceName?: string, answer?: string|null, choice?: string|null,
 *          timedOut?: boolean, distance?: number|null}} flag
 */
export function rebukeLine(flag) {
  const who = flag?.actorName ?? "The creature";
  const at = flag?.sourceName ?? "the creature that damaged it";
  if ( flag?.answer === "use" ) return `${flag.choice} — ${who} answers ${at}`;
  if ( flag?.answer === "pass" ) return `${who} lets ${at}'s damage go${flag.timedOut ? " (timer)" : ""}`;
  const feet = Number.isFinite(Number(flag?.distance)) && (flag?.distance !== null) ? ` (${flag.distance} ft)` : "";
  return `${who} may answer ${at}${feet}`;
}
