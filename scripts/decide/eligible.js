// @ts-check
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
 * Dead by THIS machine's definition (v1.19.0, the user's dead-target gate): the dead status,
 * or an NPC at 0 HP.
 *
 * ⚠⚠ DELIBERATELY NARROWER than mastery's chip-noise skip (plain `hp <= 0`), and deliberately
 * NOT SHARED WITH IT. A dying PC at 0 HP must still be demanded — the area's damage is real
 * and so are the death-save failures — while a downed PC's mastery chips are still noise.
 * Two predicates, two stakes; **the divergence is the point, not drift.** Do not "tidy" these
 * into one helper: they answer different questions and the merge is a table-facing bug.
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

/**
 * Can this item actually be USED as a reaction?
 *
 * ⚠ A NAME MATCH IS NOT A REACTION. A hobgoblin wears a mundane shield — an `equipment` item
 * literally named "Shield" — which matched the interrupt list on name alone and made every
 * shield-carrying monster in the world hold the chain for a spell it cannot cast (reported
 * live 2026-08-15: "Hobgoblin — Shield?" on a creature with no spells at all). Worn equipment
 * has no activation, so asking for one drops it cleanly, and this generalises to every other
 * collision a user-editable interrupt list can produce.
 *
 * ⚠ Test the ITEM's activation as well as its activities: an activity carries its own
 * activation only when `activation.override` is true, and spells keep their casting time at
 * item level — so an activities-only test finds ZERO reaction spells, Shield included.
 */
export function isReactionItem(item) {
  if ( item?.system?.activation?.type === "reaction" ) return true;
  // ⚠ SPELLS inherit; FEATURES declare (measured on the 2024 packs, 2026-09-02 — the corpus
  // scan): a feature's activity carries its own activation with no override flag at all, so
  // the override test that keeps a worn "Shield" out refused every 2024 reaction FEATURE —
  // Deflect Attacks, Warding Flare, the Uncanny Dodge of a sheet that carries an activity.
  const spell = item?.type === "spell";
  return (item?.system?.activities?.contents ?? []).some(activity =>
    (activity.activation?.type === "reaction") && (!spell || activity.activation?.override));
}

/**
 * A feature the pack ships as TEXT ONLY — no activation, no activities — which is how the 2024
 * Player's Handbook ships Uncanny Dodge (user, 2026-09-02: "you can't just look for the effect,
 * you have to look for the ability"). A curated list naming such a feature means the feature
 * by name, the way the maneuver folds find Riposte; there is nothing on the item to read.
 * Features only: equipment and spells must still declare an activation (the worn-Shield guard).
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
