// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the heal on hit (registry.js HEAL_ON_HIT) — how much
 * of what landed comes back to the caster, and the card's words. No `game`.
 */

/**
 * THE HEAL: the row's share of the amount TAKEN, narrowed to the row's damage type by the rolled parts'
 * proportion (the receipt says what landed in all; the parts say how much of it was the named type), floored.
 * @param {{share?: number, type?: string|null}} row
 * @param {{taken: number, parts?: Array<{value: number, type?: string|null}>}} facts
 * @returns {{heals: boolean, amount: number, why: string}}
 */
export function healOnHitAmount(row, { taken, parts = [] }) {
  const landed = Math.max(0, Math.floor(Number(taken) || 0));
  if ( !landed ) return { heals: false, amount: 0, why: "nothing landed" };
  const share = Number.isFinite(Number(row?.share)) ? Number(row.share) : 0;
  if ( !(share > 0) ) return { heals: false, amount: 0, why: "no share on the row" };
  let ratio = 1;
  const type = row?.type ? String(row.type).toLowerCase() : null;
  const list = (parts ?? []).filter(p => Number(p?.value) > 0);
  if ( type && list.length ) {
    const all = list.reduce((n, p) => n + Number(p.value), 0);
    const typed = list.filter(p => String(p.type ?? "").toLowerCase() === type).reduce((n, p) => n + Number(p.value), 0);
    ratio = all > 0 ? (typed / all) : 0;
  }
  const amount = Math.floor(landed * ratio * share);
  if ( !amount ) return { heals: false, amount: 0, why: type && (ratio === 0) ? `no ${type} damage among what landed` : "the share rounds to nothing" };
  return { heals: true, amount, why: `${share === 0.5 ? "half" : share} of the ${type ?? ""} damage dealt`.replace(/\s+/g, " ") };
}

/**
 * The card's title.
 * @param {{spell: string, caster: string, amount: number, target: string}} facts
 */
export function healOnHitTitle({ spell, caster, amount, target }) {
  return `${spell} — ${caster} regains ${amount} Hit Point${amount === 1 ? "" : "s"} from ${target}`;
}

/**
 * `on: "kill"`: does this drop pay the bearer? An ENEMY — the two tokens on opposite sides (a neutral has no
 * side) — and the bearer dealt the damage or stands within `within` feet of the fallen (an unread distance
 * never pays a bystander).
 * @param {{dealt: boolean, feet: number|null, within: number|null, sides: [number, number]}} facts
 * @returns {{pays: boolean, why: string}}
 */
export function killPays({ dealt, feet, within, sides }) {
  const [mine, theirs] = sides ?? [0, 0];
  if ( !((mine === 1) && (theirs === -1)) && !((mine === -1) && (theirs === 1)) ) return { pays: false, why: "not an enemy" };
  if ( dealt ) return { pays: true, why: "you dropped an enemy to 0 Hit Points" };
  if ( (within !== null) && (feet !== null) && (feet <= within) ) return { pays: true, why: `an enemy dropped to 0 Hit Points ${feet} ft from you` };
  return { pays: false, why: (feet === null) ? "the distance cannot be read" : `${feet} ft away — beyond ${within ?? 0} ft` };
}
