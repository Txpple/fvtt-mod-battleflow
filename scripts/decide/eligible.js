/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the eligibility predicates.
 *
 * Moved out of saves.js, hold.js and volleys.js (PLAN.md Phase 2, "move, do not rewrite").
 * Every one of these answers "does this thing qualify?" from data alone.
 *
 * ⚠ A finding worth recording, because PLAN.md's own bullet implies otherwise: most of what
 * reads like eligibility in this module is NOT extractable. `usableReaction` walks an actor's
 * items and awaits `findCastActivity`; `ridersAgainst` walks a target's ActiveEffects and
 * resolves each one's source; mastery eligibility awaits `fromUuid` per hit. Those are EDGE by
 * §2 rule 1 and stay put — what came out here is the arithmetic they each stand on. The
 * remaining bullet items are a smaller prize than the list suggests, and the reason is
 * structural rather than an oversight.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/**
 * Is this actor dead FOR THE PURPOSES OF A SAVE DEMAND? The dead are skipped everywhere —
 * chips on corpses and questions about them are noise (the hopeless-hold precedent).
 *
 * ⚠ Asymmetric on purpose, and it is not a bug: a downed PC at 0 HP is DYING, not dead, and
 * is still demanded (they can still be killed by a failed save). Only the `dead` status makes
 * a character skippable. An NPC at 0 HP is simply dead.
 */
export function isDeadForSaves(actor) {
  if ( actor.statuses?.has?.("dead") ) return true;
  return (actor.type === "npc") && ((actor.system.attributes?.hp?.value ?? 0) <= 0);
}

/**
 * The state of an item's OWN limited uses: "none" (it has no pool), "available" (a pool with
 * charges left) or "spent" (a pool, all used).
 *
 * There are two ways to pay for a spell — a slot, or the statblock's "Additional Spells" x/x
 * pool — and a monster usually has only the second, because NPC slot maxima derive from a
 * caster level most statblocks never set. Activity-level pools count too: an activity carries
 * its own uses independently of the item's.
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

/** Does this item act on a Reaction — at the item level, or on any activity that overrides? */
export function isReactionItem(item) {
  if ( item?.system?.activation?.type === "reaction" ) return true;
  return (item?.system?.activities?.contents ?? []).some(activity =>
    activity.activation?.override && (activity.activation?.type === "reaction"));
}

/**
 * The level a use was cast at, from the usage config. TWO channels, take the higher: the
 * chosen slot, and base + scaling — `_prepareUsageConfig` defaults `spell.slot` to the BASE
 * key even when scaling was passed bare, so neither channel alone answers both shapes.
 *
 * ⚠ At POST-use, prefer the message's own `system.spellLevel` over this: measured 2026-08-21,
 * the system RE-RESOLVES scaling during consume and a bare `use({scaling})` reaches postUse
 * with scaling 0 — the message field is the one value the system itself stands behind.
 */
export function castLevelOf(activity, usageConfig) {
  const base = activity.item?.system?.level ?? 0;
  const scaling = Number(usageConfig?.scaling) || 0;
  const m = /^spell(\d+)$/.exec(String(usageConfig?.spell?.slot ?? ""));
  return Math.max(m ? Number(m[1]) : 0, base + scaling);
}

/**
 * How many projectiles this volley actually throws, or null when it is not a volley after all.
 * A distinct-targets entry (Steel Wind Strike) throws at most one projectile per creature, so
 * its count clamps to the target count. Fewer than two is not a volley — one projectile is
 * just a damage roll, and the existing machinery already owns that case.
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
