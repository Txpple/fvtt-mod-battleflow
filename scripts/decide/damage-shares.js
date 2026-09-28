// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the damage share (registry.js DAMAGE_SHARES) — what
 * of a landed amount the caster takes, whether the bond reaches, and the card's words. No `game`.
 */

/**
 * WHAT THE CASTER TAKES of an amount that landed on the bearer: the row's share of it, whole, only within
 * the row's reach. An unmeasured distance counts as in reach (the map is read where it can be, never guessed
 * against the bearer).
 * @param {{share?: number, within?: number|null}} row
 * @param {{amount: number, distanceFeet?: number|null, casterHp?: number|null}} facts
 * @returns {{shares: boolean, amount: number, why: string}}
 */
export function shareVerdict(row, { amount, distanceFeet = null, casterHp = null }) {
  const landed = Math.max(0, Math.floor(Number(amount) || 0));
  if ( !landed ) return { shares: false, amount: 0, why: "nothing landed" };
  if ( (casterHp !== null) && (Number(casterHp) <= 0) ) return { shares: false, amount: 0, why: "the caster is at 0 Hit Points — the bond has ended" };
  const within = Number(row?.within);
  if ( Number.isFinite(within) && Number.isFinite(Number(distanceFeet)) && (Number(distanceFeet) > within) ) {
    return { shares: false, amount: 0, why: `${distanceFeet} ft apart — beyond the bond's ${within} feet` };
  }
  const share = Number.isFinite(Number(row?.share)) ? Number(row.share) : 1;
  const out = Math.floor(landed * share);
  if ( !out ) return { shares: false, amount: 0, why: "the share rounds to nothing" };
  return { shares: true, amount: out, why: (share === 1) ? "the same amount" : `${share} of it` };
}

/**
 * The card's title.
 * @param {{spell: string, bearer: string, caster: string, amount: number}} facts
 */
export function shareTitle({ spell, bearer, caster, amount }) {
  return `${spell} — ${caster} takes ${amount} with ${bearer}`;
}

/**
 * Does the bond END now — the caster dropped to 0 Hit Points?
 * @param {{endsAt?: string|null}} row
 * @param {{casterHp: number}} facts
 */
export function shareEnds(row, { casterHp }) {
  if ( row?.endsAt !== "zeroHP" ) return { ends: false, why: "" };
  if ( Number(casterHp) > 0 ) return { ends: false, why: "" };
  return { ends: true, why: "the caster dropped to 0 Hit Points" };
}
