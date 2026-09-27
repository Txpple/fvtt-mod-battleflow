// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the eligibility predicates, from data alone;
 * what walks documents or awaits stays EDGE. ⚠ Depend downward only (no machine, spine or core.js).
 */

/** Dead for a save demand: the dead status, or an NPC at 0 HP. ⚠⚠ NARROWER than mastery's skip
 * and never merged with it: a dying PC at 0 HP must still be demanded. */
export function isDeadForSaves(actor) {
  if ( actor.statuses?.has?.("dead") ) return true;
  return (actor.type === "npc") && ((actor.system.attributes?.hp?.value ?? 0) <= 0);
}

/** An item's OWN limited uses, activity pools included: "none", "available" or "spent". */
export function limitedUses(item) {
  const pools = [item.system?.uses, ...(item.system?.activities?.contents ?? []).map(a => a.uses)];
  let pooled = false;
  for ( const pool of pools ) {
    const max = Number(pool?.max);      // "" for an unlimited item — Number("") is 0, not NaN
    if ( !Number.isFinite(max) || (max <= 0) ) continue;
    pooled = true;
    if ( Number(pool?.value) > 0 ) return "available";
  }
  return pooled ? "spent" : "none";
}

/** Can this item be USED as a reaction? ⚠ A name match is not: a worn "Shield" has no activation.
 * ⚠ Spells keep their casting time on the ITEM; an activity's counts only with `override`. */
export function isReactionItem(item) {
  if ( item?.system?.activation?.type === "reaction" ) return true;
  // ⚠ NOTES *Activation: spells inherit it, features declare it*.
  const spell = item?.type === "spell";
  return (item?.system?.activities?.contents ?? []).some(activity =>
    (activity.activation?.type === "reaction") && (!spell || activity.activation?.override));
}

/** A feature shipped as TEXT ONLY (the 2024 Uncanny Dodge); features only (the worn-Shield guard). */
export function isTextOnlyFeature(item) {
  if ( item?.type !== "feat" ) return false;
  if ( item?.system?.activation?.type ) return false;
  const activities = item?.system?.activities;
  const n = activities?.size ?? activities?.contents?.length ?? 0;
  return n === 0;
}

/**
 * The cast level from the usage config: the higher of the slot and base + scaling (the system
 * defaults `spell.slot` to the BASE key even with bare scaling). ⚠ At POST-use prefer the
 * message's `system.spellLevel`: a bare `use({scaling})` reaches postUse with scaling 0.
 */
export function castLevelOf(activity, usageConfig) {
  const base = activity.item?.system?.level ?? 0;
  const scaling = Number(usageConfig?.scaling) || 0;
  const m = /^spell(\d+)$/.exec(String(usageConfig?.spell?.slot ?? ""));
  return Math.max(m ? Number(m[1]) : 0, base + scaling);
}

/** The volley's projectile count, or null under two; a distinct-targets entry clamps to targets. */
export function clampVolleyCount(count, targetCount, distinct = false) {
  let n = count;
  if ( distinct ) n = Math.min(n, targetCount);
  return (n < 2) ? null : n;
}

/** The identity a rider dedupes on — one entry per mark per damage part, never per effect. */
export function riderKey(identifier, part) {
  return `${identifier}:${part.formula}:${part.type}`;
}
