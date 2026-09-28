// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): receipt arithmetic (prior → delta → taken →
 * reason), the merge discipline both receipt flags share, and the revert inverse.
 * ⚠ Moves hit points — unit-test changes. Depends downward only; CONFIG labels are handed in.
 */

/**
 * The data-plane fields of a stamped record. ⚠ Both ALWAYS written: null means "resolved, nothing".
 * @param {{combat?: string|null, sourceUuid?: string|null}|null|undefined} context
 */
export function statFields(context) {
  return { combat: context?.combat ?? null, sourceUuid: context?.sourceUuid ?? null };
}

/**
 * What a target's traits made of one damage part, in one word, from `calculateDamage`'s `active`.
 * ⚠ `active.multiplier` includes the caller's `multiplier` (a saved half), so it is divided out.
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

/** One reason per (type, outcome). `calc` is `calculateDamage`'s return, `false` when cancelled. */
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

/** What the POOL did: the signed change in HP and temp HP. */
export function hpDelta(prior, after) {
  return {
    value: (after?.value ?? 0) - (prior?.value ?? 0),
    temp: (after?.temp ?? 0) - (prior?.temp ?? 0)
  };
}

/**
 * One receipt entry. ⚠ `taken` (what the hit dealt) and `delta` (what the pool did) differ at 0 HP.
 * `context` is per entry: a held target's belongs to the turn its verdict landed on.
 */
export function receiptEntry({ uuid, name, img = null, note, multiplier = 1, prior, after, calc, context }) {
  return {
    uuid,
    name,
    img,
    ...(note ? { note } : {}),
    ...(multiplier !== 1 ? { multiplier } : {}),
    prior,
    delta: hpDelta(prior, after),
    taken: calc ? calc.amount : null,
    // POST-trait per part (rolls minus parts = lost to traits); healing parts arrive negated.
    parts: (calc || []).map(d => ({ type: d.type ?? null, amount: d.value ?? 0 })),
    traits: traitReasons(calc, multiplier),
    reverted: false,
    ...statFields(context)
  };
}

/**
 * THE constructor for every effectReceipt `effects[]` record, stamped per record.
 * @param {{id: string, name: string, img?: string|null, description?: string}} applied
 * @param {{combat?: string|null, sourceUuid?: string|null}|null|undefined} context
 */
export function effectRecord({ id, name, img = null, description }, context) {
  return { id, name, img, description: description ?? "", reverted: false, ...statFields(context) };
}

/**
 * Merge damage entries into a `receipt` flag. A uuid's LIVE entry is FOLDED, never replaced: a
 * later application on the same target (a reroll moving already-applied damage) keeps the first
 * entry's `prior`, sums `taken` and `delta`, appends `parts`, joins the notes and lists itself
 * under `adjustments` — one HP story per target per message, so ✕ Revert undoes the whole of it
 * and a stats reader sees the net. A REVERTED entry is replaced: what follows is a fresh
 * application. ⚠ Run it inside `queueFlagWrite`, or concurrent writers drop entries and the
 * damage lands twice.
 */
export function joinDamageReceipt(flag, entries) {
  flag.targets ??= [];
  for ( const r of entries ) {
    const i = flag.targets.findIndex(t => t.uuid === r.uuid);
    if ( i < 0 ) flag.targets.push(r);
    else if ( flag.targets[i].reverted ) flag.targets[i] = r;
    else flag.targets[i] = foldDamageEntry(flag.targets[i], r);
  }
  return flag;
}

/** The fold: `live` plus `next`, `prior` the live one's, the later application kept as a line. */
export function foldDamageEntry(live, next) {
  const both = (a, b) => ((a === null || a === undefined) && (b === null || b === undefined)) ? null
    : (Number(a) || 0) + (Number(b) || 0);
  const notes = [live.note, next.note].filter(Boolean);
  const traits = [...(live.traits ?? [])];
  for ( const t of (next.traits ?? []) ) {
    if ( !traits.some(x => (x.type === t.type) && (x.outcome === t.outcome)) ) traits.push(t);
  }
  return {
    ...live,
    ...(notes.length ? { note: notes.join(" · ") } : {}),
    delta: { value: both(live.delta?.value, next.delta?.value) ?? 0, temp: both(live.delta?.temp, next.delta?.temp) ?? 0 },
    taken: both(live.taken, next.taken),
    parts: [...(live.parts ?? []), ...(next.parts ?? [])],
    traits,
    adjustments: [...(live.adjustments ?? []), {
      ...(next.note ? { note: next.note } : {}),
      taken: next.taken ?? null,
      delta: next.delta ?? { value: 0, temp: 0 },
      prior: next.prior ?? null
    }]
  };
}

/** Merge one applied-entry into an effectReceipt flag; effects accumulate, deduped by id. */
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

/** What this target TOOK; without `taken`, the pool's movement (under-reads at 0 HP). */
export function takenOf(entry) {
  return (typeof entry?.taken === "number") ? entry.taken
    : -((entry?.delta?.value ?? 0) + (entry?.delta?.temp ?? 0));
}

/**
 * Every number one receipt row shows. ⚠ Healing is a NEGATIVE take. ⚠ Temp HP never reaches
 * `amount`: a pure grant has `taken === 0` and only the delta knows.
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
    tempExtraText: ((tempGained > 0) && !tempOnly) ? ` · +${tempGained} temp` : null
  };
}

/** One receipt reason in table English. */
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

/**
 * What reverting one damage entry does, or null once reverted (idempotent). The restore is the
 * entry's RECORDED prior values (ARCHITECTURE §4 law 4), so a folded reroll reverts with its hit.
 * `entry` is the flag's own object: the caller marks it under the serializer. `clearDefeated` is
 * the combatplus contract (ARCHITECTURE.md §7). HP only.
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

/** The effect twin: the entry one ✕ Revert owns, or null once reverted. */
export function revertableEffect(flag, targetUuid, effectId) {
  const target = flag?.targets?.find(t => t.uuid === targetUuid);
  const entry = target?.effects?.find(e => e.id === effectId);
  return (!entry || entry.reverted) ? null : entry;
}
