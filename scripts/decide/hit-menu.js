// @ts-check
/**
 * Battle Flow — DECISION: the hit menu. Which options a hit offers, grouped by the feature that
 * pays for them; which picks are legal; whether a swept-at creature is hit.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE FLOW AS DRAWN (user ruling 2026-09-04, the prototype *Battle Flow Hit Menu* — "looks good"):
 * on a hit the damage offer carries one group per paying feature on the sheet (Combat Superiority
 * beside Cunning Strike), a row per option the sheet grants, the row the name and its cost and
 * nothing else — the save and the condition live in the rule folded under it and on the card
 * after. One pick per group ("You can use only one maneuver per attack"); a group with no die left
 * keeps its rows, greyed. The die rides the damage roll for every option but a sweep, whose die
 * is rolled apart at a second creature.
 *
 * What is decided here is the reading and the arithmetic, never the choice: which rows the sheet
 * grants and the list admits, which the pool can pay for, whether a pick is legal, and whether
 * an attack total would hit a second creature's AC.
 */

/**
 * The menu for one hit: every group whose paying feature stands on the sheet with a resolved pool,
 * and under it every listed option the sheet grants, in table order.
 *
 * @param {{groups: Readonly<Record<string, any>>, options: Readonly<Record<string, any>>,
 *          listed: Iterable<string>, features: Iterable<string>, melee?: boolean,
 *          pools: Record<string, {left: number, die: string|null}|null|undefined>}} facts
 *        `listed` = the Hit Menu list's feature names; `features` = the feat names on the sheet;
 *        `melee` = whether this attack is a melee attack; `pools` = per group key, the dice left
 *        and the die the sheet resolved (null when the pool or the die could not be read)
 * @returns {{groups: {key: string, label: string, max: number, die: string|null, left: number, rule: string,
 *            rows: {key: string, feature: string, label: string, cost: string, mode: string, save: boolean,
 *                   line: string|null, caveat: string|null, rule: string, affordable: boolean}[]}[]}}
 */
export function hitMenu({ groups, options, listed, features, melee = true, pools }) {
  const lower = (s) => String(s ?? "").toLowerCase();
  const admits = new Set([...listed].map(lower));
  const have = new Set([...features].map(lower));
  const out = [];
  for ( const [gkey, group] of Object.entries(groups ?? {}) ) {
    if ( !have.has(lower(group.feature)) ) continue;
    const pool = pools?.[gkey];
    if ( !pool ) continue;
    const left = Math.max(0, Number(pool.left) || 0);
    const rows = [];
    for ( const [key, row] of Object.entries(options ?? {}) ) {
      if ( row.group !== gkey ) continue;
      if ( !admits.has(lower(row.feature)) || !have.has(lower(row.feature)) ) continue;
      if ( row.melee && !melee ) continue;
      rows.push({
        key, feature: row.feature, label: row.feature,
        cost: `${pool.die ?? "1 die"} ${group.dieLabel}`,
        mode: row.mode ?? "ride", save: !!row.save,
        line: row.line ?? null, caveat: row.caveat ?? null, rule: row.rule,
        affordable: (left > 0) && !!pool.die
      });
    }
    if ( !rows.length ) continue;
    out.push({ key: gkey, label: group.label, max: group.max ?? 1, die: pool.die ?? null, left, rule: group.rule, rows });
  }
  return { groups: out };
}

/**
 * The PICK: the chosen rows, one per group at most, every one affordable. The offer keeps the
 * pick legal as it is made (one box per group); this is the arithmetic that stands behind it, and
 * an illegal pick — two in one group, or an unaffordable row — picks nothing from that group.
 * @param {{menu: ReturnType<typeof hitMenu>, chosen?: Iterable<string>}} facts
 * @returns {{picks: {group: string, row: any}[], dropped: string[]}}
 */
export function hitPick({ menu, chosen = [] }) {
  const want = new Set(chosen);
  const picks = [];
  const dropped = [];
  for ( const group of menu.groups ) {
    const rows = group.rows.filter(r => want.has(r.key));
    if ( rows.length > group.max ) { dropped.push(...rows.map(r => r.key)); continue; }
    for ( const row of rows ) {
      if ( row.affordable ) picks.push({ group: group.key, row });
      else dropped.push(row.key);
    }
  }
  return { picks, dropped };
}

/**
 * Would the ORIGINAL attack roll hit a second creature? The system's own render-time test, the
 * shape `hitsAmong` uses: a critical always hits, a fumble never, otherwise the total against the
 * AC. An AC the module cannot read is "unknown" — the table's, never a guess.
 * @param {{total: number, isCritical?: boolean, isFumble?: boolean, ac: number|null|undefined}} facts
 * @returns {"hit"|"miss"|"unknown"}
 */
export function sweepVerdict({ total, isCritical = false, isFumble = false, ac }) {
  if ( isCritical ) return "hit";
  if ( isFumble ) return "miss";
  if ( (ac === null) || (ac === undefined) || !Number.isFinite(Number(ac)) ) return "unknown";
  return (Number(total) >= Number(ac)) ? "hit" : "miss";
}
