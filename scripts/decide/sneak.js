// @ts-check
/**
 * Battle Flow — DECISION: Sneak Attack, and what Cunning Strike does to its dice.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE FLOW AS DRAWN (user ruling 2026-09-02, the prototype *Sneak Attack, Cunningly* — "go with
 * the prototype and iterate"): the tick is at the GATE (the player judges the conditions; the
 * module says what it read), Cunning Strike is picked on the DAMAGE OFFER after the hit, the
 * costs come off the sneak dice BEFORE the roll ("You remove the die before rolling"), a crit
 * doubles what is left (free — the crit stamp lands on every part), the effects run through the
 * saves machine on the activities the pack ships, and once per turn is a turn chip.
 *
 * What is decided here is the arithmetic and the reading, never the choice: which options the
 * sheet grants, which the dice can pay for, what the remaining formula is, and the sentence that
 * tells the player what the module could and could not judge.
 */

/**
 * A dice formula the sheet resolved — "7d6" — as a number of dice and their faces, or null for
 * anything else (an unresolved `@scale` token rolls ZERO in silence, NOTES §2, so a formula
 * that is not plain dice is never armed).
 * @param {string|null|undefined} formula
 * @returns {{number: number, faces: number}|null}
 */
export function parseDice(formula) {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*$/i.exec(String(formula ?? ""));
  if ( !m ) return null;
  const number = Number(m[1]);
  const faces = Number(m[2]);
  if ( !(number > 0) || !(faces > 0) ) return null;
  return { number, faces };
}

/**
 * Does the WEAPON qualify? "the attack uses a Finesse or a Ranged weapon" — the two facts the
 * module can read off the item and the roll. Everything else in the rule is the player's.
 * @param {{finesse?: boolean, ranged?: boolean}} weapon
 */
export function sneakWeaponQualifies({ finesse = false, ranged = false } = {}) {
  return !!finesse || !!ranged;
}

/**
 * The "read for you" line under the Sneak Attack box: what the module judged (the weapon, the
 * roll's net) and what it leaves to the player (the ally within 5 feet). One sentence per fact,
 * joined by the section's own separator.
 * @param {{weaponName?: string, finesse?: boolean, ranged?: boolean,
 *          net: "advantage"|"disadvantage"|"normal"}} facts
 * @returns {string[]}
 */
export function sneakReadLines({ weaponName = "the weapon", finesse = false, ranged = false, net }) {
  const out = [];
  if ( finesse && ranged ) out.push(`${weaponName} is Finesse and ranged ✓`);
  else if ( finesse ) out.push(`${weaponName} is Finesse ✓`);
  else if ( ranged ) out.push(`${weaponName} is a ranged weapon ✓`);
  else out.push(`${weaponName} is neither Finesse nor ranged ✗`);
  if ( net === "advantage" ) out.push("this roll nets Advantage ✓");
  else if ( net === "disadvantage" ) out.push("this roll nets Disadvantage ✗ — no Sneak Attack unless you press against it");
  else out.push("this roll nets Normal — an ally within 5 feet of the target, not Incapacitated: yours to judge");
  out.push("Cunning Strike is chosen after the hit");
  return out;
}

/**
 * The Cunning Strike MENU for one attack: every option the sheet grants, in table order, with
 * the activity the module will use, its cost, and whether the dice can pay for it. A row whose
 * feature is not on the sheet is absent; a row restricted to a weapon (Rend Mind — Psychic
 * Blades) is absent for any other; a row with an upgrade on the sheet (Envenom Weapons) carries
 * the upgrade's activity and what the failure applies on top.
 *
 * @param {{options: Readonly<Record<string, any>>, features?: Iterable<string>, weaponName?: string,
 *          dice: number, improved?: string}} facts
 *        `features` = the names of the feat items on the sheet; `dice` = the sneak dice available
 * @returns {{rows: {key: string, label: string, feature: string, activity: string|string[]|null, cost: number,
 *            rule: string, caveat?: string, line: boolean, affordable: boolean,
 *            upgrade?: {feature: string, activity: string, onFail?: string, effectFrom?: string, rule: string}}[], max: number}}
 */
export function cunningMenu({ options, features = [], weaponName = "", dice, improved = "Improved Cunning Strike" }) {
  const have = new Set([...features].map(f => String(f).toLowerCase()));
  const rows = [];
  for ( const [key, row] of Object.entries(options ?? {}) ) {
    if ( !have.has(String(row.feature).toLowerCase()) ) continue;
    if ( row.weapon && !String(weaponName).toLowerCase().includes(String(row.weapon).toLowerCase()) ) continue;
    const upgraded = row.upgrade && have.has(String(row.upgrade.feature).toLowerCase()) ? row.upgrade : null;
    rows.push({
      key, feature: row.feature, activity: upgraded ? upgraded.activity : row.activity, cost: row.cost,
      label: `${row.activity ?? row.rule.split(" (")[0]}${upgraded ? ` (${upgraded.feature})` : ""}`,
      rule: row.rule, ...(row.caveat ? { caveat: row.caveat } : {}),
      line: !row.activity, affordable: row.cost <= dice,
      ...(upgraded ? { upgrade: upgraded } : {})
    });
  }
  return { rows, max: have.has(String(improved).toLowerCase()) ? 2 : 1 };
}

/**
 * The PICK: which menu rows were ticked, what they cost together, what is left to roll, and
 * whether the pick is one the rules allow (at most `max`, affordable together). The offer
 * disables what cannot be afforded; this is the arithmetic that stands behind the button.
 * @param {{rows: {key: string, cost: number}[], chosen?: Iterable<string>, dice: number, max: number}} facts
 * @returns {{chosen: any[], cost: number, remaining: number, tooMany: boolean, tooDear: boolean}}
 */
export function cunningPick({ rows, chosen = [], dice, max }) {
  const wanted = new Set(chosen);
  const picked = rows.filter(r => wanted.has(r.key));
  const cost = picked.reduce((n, r) => n + (Number(r.cost) || 0), 0);
  return { chosen: picked, cost, remaining: Math.max(0, dice - cost), tooMany: picked.length > max, tooDear: cost > dice };
}

/**
 * The damage part the sneak dice ride as, after the costs: "5d6", or null when nothing is left
 * (every die forgone — the effects still land; the rule spends the dice, not the hit).
 * @param {{number: number, faces: number, cost?: number}} dice
 */
export function sneakFormula({ number, faces, cost = 0 }) {
  const left = number - (Number(cost) || 0);
  return (left > 0) ? `${left}d${faces}` : null;
}
