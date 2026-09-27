// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): receipt arithmetic. One entry is
 * prior → delta → taken → reason; this owns that arithmetic, the merge discipline both receipt
 * flags share, and the revert inverse. ⚠ This layer moves hit points — unit-test changes.
 * ⚠ Depends downward only: no machine, no spine, no core.js; labels that read CONFIG.DND5E are
 * resolved at the edge and handed in.
 */

/* --- writing an entry ----------------------------------------------------------------------- */

/**
 * The data-plane fields of a stamped record (the context is built at the edge by `statContext`).
 * ⚠ Both are ALWAYS written, null included: null means "resolved, nothing"; absent means the
 * record predates the plane. Do not tidy the nulls away.
 * @param {{combat?: string|null, sourceUuid?: string|null}|null|undefined} context
 */
export function statFields(context) {
  return { combat: context?.combat ?? null, sourceUuid: context?.sourceUuid ?? null };
}

/**
/**
 * What a target's traits made of one damage part, in one word — or null when the number did not
 * move. `active` is dnd5e's own annotation from `calculateDamage`, so bypasses and thresholds
 * never drift. ⚠ `active.multiplier` already includes the caller's `multiplier` (a saved half,
 * Uncanny Dodge), so the caller's share is divided out first.
 */
export function traitOutcome(active, multiplier = 1) {
  const a = active ?? {};
  const own = (typeof a.multiplier === "number") && multiplier ? a.multiplier / multiplier : a.multiplier;
  const near = (x, y) => Math.abs(x - y) < 1e-9;
  return a.threshold ? "threshold"
    : (own === 0) ? "immune"
    : near(own, 0.5) ? "resistant"
    : near(own, 2) ? "vulnerable"
    : (a.all?.modification || a.type?.modification) ? "modified"
    : null;
}

/**
 * The reason list a receipt row renders: one per (type, outcome), deduped. `calc` is
 * `calculateDamage`'s return — an array carrying `amount`, or `false` when a hook cancelled it.
 */
export function traitReasons(calc, multiplier = 1) {
  const traits = [];
  for ( const d of (calc || []) ) {
    const outcome = traitOutcome(d.active, multiplier);
    if ( outcome && !traits.some(t => (t.type === d.type) && (t.outcome === outcome)) ) {
      traits.push({ type: d.type, outcome });
    }
  }
  return traits;
}

/** What the POOL did: the signed change in HP and in temp HP, from the two source snapshots. */
export function hpDelta(prior, after) {
  return {
    value: (after?.value ?? 0) - (prior?.value ?? 0),
    temp: (after?.temp ?? 0) - (prior?.temp ?? 0)
  };
}

/**
 * One receipt entry, from the snapshots either side of the application. ⚠ `taken` (post-trait,
 * pre-clamp: what the hit dealt) and `delta` (what the pool did) differ — a target at 0 HP clamps
 * the delta to −0 while `taken` still reads the hit. `context` is stamped PER ENTRY: a held
 * target's entry belongs to the turn its verdict landed on.
 */
export function receiptEntry({ uuid, name, img = null, note, multiplier = 1, prior, after, calc, context }) {
  return {
    uuid,
    name,
    img, // the portrait the row leads with
    ...(note ? { note } : {}),
    ...(multiplier !== 1 ? { multiplier } : {}),
    prior,
    delta: hpDelta(prior, after),
    taken: calc ? calc.amount : null,
    // Per-part POST-trait amounts (calculateDamage rewrites each part's value), so rolls minus
    // parts is the damage lost to traits. Healing parts arrive negated, like `taken`.
    parts: (calc || []).map(d => ({ type: d.type ?? null, amount: d.value ?? 0 })),
    traits: traitReasons(calc, multiplier),
    reverted: false,
    ...statFields(context)
  };
}

/**
 * THE constructor for every effectReceipt `effects[]` record, so the shape and its stamp never
 * drift between writers. Stamped per record: effects accumulate on one flag across moments.
 * @param {{id: string, name: string, img?: string|null, description?: string}} applied
 * @param {{combat?: string|null, sourceUuid?: string|null}|null|undefined} context
 */
export function effectRecord({ id, name, img = null, description }, context) {
  return { id, name, img, description: description ?? "", reverted: false, ...statFields(context) };
}

/* --- the merge discipline, shared by every writer of either flag ---------------------------- */

/**
 * Merge damage entries into a `receipt` flag. ⚠ MERGE, never overwrite: a spell hold splits one
 * roll's application in time. Run it inside `queueFlagWrite`, or concurrent writers drop each
 * other's entries and the damage lands twice. An entry for a uuid is REPLACED (one HP story per
 * damage message), where the effect side accumulates.
 */
export function joinDamageReceipt(flag, entries) {
  flag.targets ??= [];
  for ( const r of entries ) {
    const i = flag.targets.findIndex(t => t.uuid === r.uuid);
    if ( i >= 0 ) flag.targets[i] = r; else flag.targets.push(r);
  }
  return flag;
}

/**
 * Merge one applied-entry into an effectReceipt flag: entries keyed by uuid, effects deduped by
 * id, nothing overwritten. Every effect writer goes through here.
 */
export function joinEffectReceipt(flag, entry) {
  flag.targets ??= [];
  let target = flag.targets.find(t => t.uuid === entry.uuid);
  if ( !target ) {
    target = { uuid: entry.uuid, name: entry.name, img: entry.img ?? null, effects: [] };
    flag.targets.push(target);
  }
  for ( const e of entry.effects ) {
    if ( !target.effects.some(x => x.id === e.id) ) target.effects.push(e);
  }
  return target;
}

/* --- reading an entry ----------------------------------------------------------------------- */

/**
 * What this target actually TOOK. `taken` when recorded; an older entry falls back to the pool's
 * movement, which under-reads at 0 HP.
 */
export function takenOf(entry) {
  return (typeof entry?.taken === "number") ? entry.taken
    : -((entry?.delta?.value ?? 0) + (entry?.delta?.temp ?? 0));
}

/**
 * Every number one receipt row shows, and its voice (the colours stay at the edge).
 * ⚠ Healing arrives as a NEGATIVE take (calculateDamage inverts healing types); a gain reads +N.
 * ⚠ Temp HP is a third kind: calculateDamage routes `temphp` into `damages.temp`, never
 * `amount`, and does not invert it — a pure grant lands with `taken === 0` (or −0) and only the
 * delta knows. `from`/`after` are the pool either side.
 */
export function receiptAmounts(entry) {
  const taken = takenOf(entry);
  const from = (entry?.prior?.value ?? 0) + (entry?.prior?.temp ?? 0);
  const lost = -((entry?.delta?.value ?? 0) + (entry?.delta?.temp ?? 0));
  const tempGained = Math.max(0, entry?.delta?.temp ?? 0);
  const tempOnly = (tempGained > 0) && (taken === 0);
  const healed = taken < 0;
  return {
    taken, from, after: from - lost, tempGained, tempOnly, healed,
    amountText: tempOnly ? `+${tempGained} temp HP`
      : healed ? `+${-taken} HP` : `−${taken} HP`,
    // A mixed entry keeps its own number and appends the temp.
    tempExtraText: ((tempGained > 0) && !tempOnly) ? ` · +${tempGained} temp` : null
  };
}

/** One receipt reason in table English; `label` is resolved at the edge, `type` the fallback. */
export function traitPhrase({ type, outcome, label }) {
  const text = (label ?? type ?? "damage").toLowerCase();
  switch ( outcome ) {
    case "immune": return `immune to ${text}`;
    case "resistant": return `resists ${text}`;
    case "vulnerable": return `vulnerable to ${text}`;
    case "threshold": return "under its damage threshold";
    case "modified": return `${text} modified by a trait`;
    default: return "";
  }
}

/* --- the revert inverse --------------------------------------------------------------------- */

/**
 * What reverting one damage entry has to do, or null. ⚠ Idempotent: an entry already reverted
 * plans nothing, so a second click or client never re-fights a human's ↩. `entry` is the LIVE
 * object — the caller marks it and writes the flag back. `clearDefeated` is the combatplus
 * contract (ARCHITECTURE.md §7). Rolls, resources, ammo and concentration are not rewound.
 */
export function revertPlan(receipt, uuid) {
  const entry = receipt?.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.reverted ) return null;
  return {
    entry,
    update: {
      "system.attributes.hp.value": entry.prior.value,
      "system.attributes.hp.temp": entry.prior.temp,
      "system.attributes.hp.tempmax": entry.prior.tempmax
    },
    clearDefeated: (entry.prior.value ?? 0) > 0
  };
}

/**
 * The effect twin: the entry one ✕ Revert owns, or null. Same idempotence — a cascade, a manual
 * removal or a death may beat the button.
 */
export function revertableEffect(flag, targetUuid, effectId) {
  const target = flag?.targets?.find(t => t.uuid === targetUuid);
  const entry = target?.effects?.find(e => e.id === effectId);
  return (!entry || entry.reverted) ? null : entry;
}
