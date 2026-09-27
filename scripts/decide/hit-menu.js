// @ts-check
/**
 * Battle Flow — DECISION: the hit menu — the options a hit offers grouped by paying feature, the
 * legal picks, whether a swept-at creature is hit. Pure (ARCHITECTURE.md §2); RULINGS *The hit menu*
 * and *The hit menu — a pick per group*. The reading and arithmetic are decided here, never the choice.
 */

/**
 * The menu for one hit: each group whose feature stands with a resolved pool, and its listed options
 * in table order. `pool: "option"` pays per OPTION; `fits` false greys a row, null leaves it open.
 * @param {{groups: Readonly<Record<string, any>>, options: Readonly<Record<string, any>>,
 *          listed: Iterable<string>, features: Iterable<string>, melee?: boolean,
 *          pools: Record<string, {left: number, max?: number, die: string|null, type?: string|null}|null|undefined>,
 *          fits?: Record<string, boolean|null|undefined>}} facts
 *        `pools` keyed by group (by option for an option-pool group); null when unreadable
 * @returns {{groups: {key: string, label: string, max: number, die: string|null, left: number, rule: string,
 *            perOption: boolean, heading: string, per: string, eyebrow: string, dieLabel: string,
 *            rows: {key: string, feature: string, label: string, cost: string, mode: string, save: boolean,
 *                   line: string|null, caveat: string|null, rule: string, affordable: boolean}[]}[]}}
 */
export function hitMenu({ groups, options, listed, features, melee = true, pools, fits = {} }) {
  const lower = (s) => String(s ?? "").toLowerCase();
  const admits = new Set([...listed].map(lower));
  const have = new Set([...features].map(lower));
  const out = [];
  for ( const [gkey, group] of Object.entries(groups ?? {}) ) {
    if ( group.feature && !have.has(lower(group.feature)) ) continue;
    const perOption = group.pool === "option";
    const shared = perOption ? null : pools?.[gkey];
    if ( !perOption && !shared ) continue;
    const rows = [];
    let left = perOption ? 0 : Math.max(0, Number(shared?.left) || 0);
    for ( const [key, row] of Object.entries(options ?? {}) ) {
      if ( row.group !== gkey ) continue;
      if ( !admits.has(lower(row.feature)) || !have.has(lower(row.feature)) ) continue;
      if ( row.melee && !melee ) continue;
      const pool = perOption ? pools?.[key] : shared;
      if ( !pool ) continue;
      const rowLeft = Math.max(0, Number(pool.left) || 0);
      if ( perOption ) left += rowLeft;
      // The size judge (`maxSize`, Hill's Tumble): only a MEASURED misfit greys the row.
      const tooLarge = !!row.maxSize && (fits?.[key] === false);
      const unknownSize = !!row.maxSize && ((fits?.[key] === null) || (fits?.[key] === undefined));
      const count = `${rowLeft}${(Number(pool.max) > 0) ? ` of ${Number(pool.max)}` : ""} ${group.dieLabel}${(Number(pool.max) || rowLeft) === 1 ? "" : "s"} left`;
      const cost = perOption
        ? (pool.die ? `${pool.die}${pool.type ? ` ${pool.type}` : ""} · ${count}` : count)
        : `${pool.die ?? "1 die"} ${group.dieLabel}`;
      rows.push({
        key, feature: row.feature, label: row.feature,
        cost: tooLarge ? "too large" : cost,
        mode: row.mode ?? "ride", save: !!row.save,
        line: row.line ?? null,
        caveat: tooLarge ? "the target is larger than Large" : unknownSize ? "the target's size could not be read" : (row.caveat ?? null),
        rule: row.rule,
        affordable: (rowLeft > 0) && (!!pool.die || !!row.press) && !tooLarge
      });
    }
    if ( !rows.length ) continue;
    out.push({ key: gkey, label: group.label, max: group.max ?? 1, die: perOption ? null : (shared?.die ?? null), left, rule: group.rule,
      perOption, heading: group.heading ?? group.label, per: group.per ?? "one pick per hit",
      eyebrow: group.eyebrow ?? "Maneuver", dieLabel: group.dieLabel, rows });
  }
  return { groups: out };
}

/**
 * The PICK: the chosen rows, at most `max` per group, each affordable; an illegal pick is dropped.
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
 * The picks a hit-menu record holds; a single-pick record reads as a list of one.
 * @param {any} record
 * @returns {any[]}
 */
export function picksOf(record) {
  if ( Array.isArray(record?.picks) ) return record.picks;
  return record?.key ? [record] : [];
}

/**
 * Would the ORIGINAL attack roll hit a second creature (the `hitsAmong` shape)? Unreadable AC is "unknown", never a guess.
 * @param {{total: number, isCritical?: boolean, isFumble?: boolean, ac: number|null|undefined}} facts
 * @returns {"hit"|"miss"|"unknown"}
 */
export function sweepVerdict({ total, isCritical = false, isFumble = false, ac }) {
  if ( isCritical ) return "hit";
  if ( isFumble ) return "miss";
  if ( (ac === null) || (ac === undefined) || !Number.isFinite(Number(ac)) ) return "unknown";
  return (Number(total) >= Number(ac)) ? "hit" : "miss";
}
