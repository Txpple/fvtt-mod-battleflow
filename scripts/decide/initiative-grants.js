// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE INITIATIVE GRANTS (registry.js INITIATIVE_GRANTS — Persistent
 * Rage, Uncanny Metabolism): whether a feature's grant is due as its owner's Initiative lands, and the card's words.
 * Pure.
 */

/**
 * Is the grant due? The feature's own use must stand, and something must come back — an expended use of the
 * regained item, or (a healing row) a missing Hit Point: a once-per-Long-Rest use is never burnt on nothing.
 * @param {{own: {value: number, max: number}|null, regain: {spent: number, max: number}|null, heals?: boolean,
 *          hp?: {value: number, max: number}|null}} facts
 * @returns {{due: boolean, why: string}}
 */
export function initiativeGrantDue({ own, regain, heals = false, hp = null }) {
  if ( own && (Number(own.max) > 0) && !(Number(own.value) > 0) ) return { due: false, why: "used since the last Long Rest" };
  const back = Math.max(0, Math.min(Number(regain?.spent) || 0, Number(regain?.max) || 0));
  const hurt = heals && hp ? (Number(hp.value) || 0) < (Number(hp.max) || 0) : false;
  if ( !back && !hurt ) return { due: false, why: "nothing to regain" };
  return { due: true, why: back ? `${back} expended` : "Hit Points missing" };
}

/**
 * The card's line for a grant, by its state.
 * @param {{row: string, status?: string, answer?: string|null, applied?: boolean, timedOut?: boolean, unit?: string,
 *          regained?: number, max?: number, healed?: number|null, formula?: string|null, back?: number, actorName?: string,
 *          give?: boolean, given?: {name: string, from: number, to: number}[], rolled?: number, due?: string[], reach?: number}} flag
 */
export function initiativeGrantLine(flag) {
  const unit = flag.unit ?? "uses";
  if ( flag.answer === "no" ) return `${flag.row} — kept for later${flag.timedOut ? " (timer)" : ""}`;
  // B4 — a `to: "allies"` row (Tandem Footwork): one roll, added to every ally's Initiative within reach.
  if ( flag.give ) {
    if ( flag.applied ) {
      const names = (flag.given ?? []).map(g => `${g.name} ${g.from} → ${g.to}`);
      return names.length ? `${flag.row} — +${flag.rolled} Initiative: ${names.join(", ")}${flag.due?.length ? ` (${flag.due.length} still to roll)` : ""}`
        : `${flag.row} — +${flag.rolled ?? 0} Initiative, nobody within reach yet${flag.due?.length ? ` (${flag.due.length} still to roll)` : ""}`;
    }
    if ( flag.status === "resolved" ) return `${flag.row} — rolling…`;
    return `${flag.row} — give ${flag.formula ?? "the die"} to allies within ${flag.reach ?? 30} ft? · a use of ${unit}`;
  }
  if ( flag.applied ) {
    const parts = [`${unit} regained (${Number(flag.max) || 0} of ${Number(flag.max) || 0})`];
    if ( Number.isFinite(flag.healed) ) parts.push(`${flag.healed} Hit Point${flag.healed === 1 ? "" : "s"} regained`);
    return `${flag.row} — ${parts.join(", ")}`;
  }
  if ( flag.status === "resolved" ) return `${flag.row} — regaining…`;
  const heal = flag.formula ? ` and ${flag.formula} Hit Points` : "";
  return `${flag.row} — regain ${Number(flag.back) || 0} ${unit}${heal}? (once per Long Rest)`;
}
