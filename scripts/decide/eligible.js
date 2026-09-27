// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the eligibility predicates — "does this
 * thing qualify?" from data alone. The eligibility that walks documents or awaits
 * (`usableReaction`, `ridersAgainst`, mastery) is EDGE and stays in its machine; this is the
 * arithmetic under it.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/**
 * Dead for a save demand: the dead status, or an NPC at 0 HP.
 *
 * ⚠⚠ DELIBERATELY NARROWER than mastery's skip (plain `hp <= 0`) and NOT SHARED WITH IT: a
 * dying PC at 0 HP must still be demanded (the damage and the death-save failures are real),
 * while a downed PC's mastery chips are noise. Do not merge the two.
 */
export function isDeadForSaves(actor) {
  if ( actor.statuses?.has?.("dead") ) return true;
  return (actor.type === "npc") && ((actor.system.attributes?.hp?.value ?? 0) <= 0);
}

/**
 * The state of an item's OWN limited uses: "none" (it has no pool), "available" (a pool with
 * charges left) or "spent" (a pool, all used).
 *
 * A spell is paid by a slot or by the statblock's x/day pool, and a monster usually has only the
 * pool (NPC slot maxima usually sit at 0). Activity-level pools count too.
 */
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

/**
 * Can this item actually be USED as a reaction?
 *
 * ⚠ A NAME MATCH IS NOT A REACTION: a worn "Shield" (equipment) matches the list by name. Worn
 * equipment has no activation, so requiring one drops it.
 * ⚠ Test the ITEM's activation too: spells keep their casting time at item level, and an
 * activity carries its own only when `activation.override` is set.
 */
export function isReactionItem(item) {
  if ( item?.system?.activation?.type === "reaction" ) return true;
  // ⚠ SPELLS inherit; FEATURES declare (NOTES *Activation: spells inherit it, features declare
  // it*): a feature's activity has its own activation and no override flag.
  const spell = item?.type === "spell";
  return (item?.system?.activities?.contents ?? []).some(activity =>
    (activity.activation?.type === "reaction") && (!spell || activity.activation?.override));
}

/**
 * A feature the pack ships as TEXT ONLY — no activation, no activities (the 2024 Uncanny Dodge).
 * A list naming one means the feature by name. Features only: equipment and spells must still
 * declare an activation (the worn-Shield guard).
 */
export function isTextOnlyFeature(item) {
  if ( item?.type !== "feat" ) return false;
  if ( item?.system?.activation?.type ) return false;
  const activities = item?.system?.activities;
  const n = activities?.size ?? activities?.contents?.length ?? 0;
  return n === 0;
}

/**
 * The level a use was cast at, from the usage config. TWO channels, take the higher: the
 * chosen slot, and base + scaling — `_prepareUsageConfig` defaults `spell.slot` to the BASE
 * key even when scaling was passed bare, so neither channel alone answers both shapes.
 *
 * ⚠ At POST-use, prefer the message's own `system.spellLevel`: the system re-resolves scaling
 * during consume, and a bare `use({scaling})` reaches postUse with scaling 0.
 */
export function castLevelOf(activity, usageConfig) {
  const base = activity.item?.system?.level ?? 0;
  const scaling = Number(usageConfig?.scaling) || 0;
  const m = /^spell(\d+)$/.exec(String(usageConfig?.spell?.slot ?? ""));
  return Math.max(m ? Number(m[1]) : 0, base + scaling);
}

/**
 * How many projectiles this volley actually throws, or null when it is not a volley after all.
 * A distinct-targets entry (Steel Wind Strike) clamps to the target count. Fewer than two is not
 * a volley — one projectile is just a damage roll.
 */
export function clampVolleyCount(count, targetCount, distinct = false) {
  let n = count;
  if ( distinct ) n = Math.min(n, targetCount);
  return (n < 2) ? null : n;
}

/** The identity a rider dedupes on — one entry per mark per damage part, never per effect. */
export function riderKey(identifier, part) {
  return `${identifier}:${part.formula}:${part.type}`;
}
