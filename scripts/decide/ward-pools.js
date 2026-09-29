// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE WARD POOLS (WARD_POOLS — Arcane Ward). A pool of hit points
 * that takes damage before its bearer does, after Resistances and Vulnerabilities (the amount dnd5e hands
 * `preApplyDamage`), and refills on a cast. Pure.
 */

/**
 * What the ward takes of the damage, and what is left for its bearer.
 * @param {{amount: number, ward: number}} args  the post-trait damage; the ward's hit points
 * @returns {{took: number, left: number}}
 */
export function wardAbsorb({ amount, ward }) {
  const hit = Math.max(0, Number(amount) || 0);
  const took = Math.min(hit, Math.max(0, Number(ward) || 0));
  return { took, left: hit - took };
}

/**
 * The bearer's hit-point update once the ward has taken its share: the rest through Temporary Hit Points first,
 * then Hit Points, as dnd5e's `applyDamage` splits it (the same clamp; Temporary Hit Points a damage GRANTS stand).
 * @param {{left: number, value: number, temp: number, damage: number, tempMax: number, granted?: number}} hp
 *   `damage` the missing hit points (max − value); `tempMax` the reduction this damage makes to the maximum
 * @returns {{value: number, temp: number}}
 */
export function afterWard({ left, value, temp, damage, tempMax, granted = 0 }) {
  const rest = Math.max(0, Number(left) || 0);
  const deltaTemp = Math.min(Math.max(0, Number(temp) || 0), rest);
  const deltaHP = Math.min(Math.max(rest - deltaTemp, -(Number(damage) || 0) + tempMax), (Number(value) || 0) - tempMax);
  return { value: (Number(value) || 0) - deltaHP, temp: Math.max((Number(temp) || 0) - deltaTemp, Number(granted) || 0) };
}

/**
 * The ward after a cast: created full, or refilled by `per` × the slot level, never past its maximum.
 * @param {{value: number, max: number, slot: number, per: number, create: boolean}} args
 * @returns {{value: number, gained: number}}
 */
export function wardRefill({ value, max, slot, per, create }) {
  const top = Math.max(0, Number(max) || 0);
  const now = Math.min(top, Math.max(0, Number(value) || 0));
  const next = create ? top : Math.min(top, now + (Math.max(0, Number(per) || 0) * Math.max(0, Number(slot) || 0)));
  return { value: next, gained: next - now };
}
