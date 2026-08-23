// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): receipt arithmetic.
 *
 * Moved out of auto-apply.js (the write side), receipts.js (the read side) and
 * effect-riders.js (the effect merge) — PLAN.md Phase 2, "move, do not rewrite". One receipt
 * entry is prior → delta → taken → reason; this file owns that arithmetic, the merge
 * discipline both receipt flags share, and the revert inverse.
 *
 * ⚠ THIS IS THE LAYER THAT MOVES PEOPLE'S HIT POINTS. It was correct and untested — every
 * number a card shows, and every number a revert restores, lived in code that only the slow
 * live suites could reach. That is why it came out first among what remained.
 *
 * ⚠ Two copies of the same arithmetic disagreed on tolerance — the row read `t.delta.value`
 * and mastery read `entry.delta?.value`. The tolerant form won everywhere: every entry written
 * here carries both `prior` and `delta`, so nothing live changes, and there is now one copy
 * left to disagree with.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js. The
 * damage-type LABEL lookup stays at the EDGE (it reads CONFIG.DND5E) — `traitPhrase` is handed
 * the label it should speak.
 */

/* --- writing an entry ----------------------------------------------------------------------- */

/**
 * What a target's traits made of one damage part, in one word — or null when the number did
 * not move (resist and vulnerable cancel to ×1 and stay silent).
 *
 * `active` is dnd5e's own annotation from `calculateDamage`, and that is the whole point:
 * recomputing di/dr/dv here would drift from bypasses, modification and thresholds, while
 * asking the system's own method cannot.
 */
export function traitOutcome(active) {
  const a = active ?? {};
  return a.threshold ? "threshold"
    : (a.multiplier === 0) ? "immune"
    : (a.multiplier === 0.5) ? "resistant"
    : (a.multiplier === 2) ? "vulnerable"
    : (a.all?.modification || a.type?.modification) ? "modified"
    : null;
}

/**
 * The reason list a receipt row renders: one entry per (type, outcome), deduped — several
 * parts of one type share one story and the row tells it once.
 *
 * `calc` is `calculateDamage`'s return, which is an ARRAY carrying an `amount` property — and
 * `false` when a hook cancelled the calculation, which is why it is guarded rather than mapped.
 */
export function traitReasons(calc) {
  const traits = [];
  for ( const d of (calc || []) ) {
    const outcome = traitOutcome(d.active);
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
 * One receipt entry, from the snapshots either side of the application.
 *
 * ⚠ `taken` and `delta` are DIFFERENT QUANTITIES and both are kept on purpose. `taken` is the
 * post-trait, pre-clamp total — what the hit dealt, a number an assertion can trust; `delta` is
 * what the pool did. A target already at 0 HP clamps every delta to −0 while `taken` still
 * reads 14 (reported live 2026-08-15: a vulnerable Ice Mephit's row said "−0 HP" beside the
 * native tray's −14).
 *
 * `note` and `multiplier` ride only when they say something — a Graze line names itself, and a
 * non-1 multiplier is how the row explains a halved number.
 */
export function receiptEntry({ uuid, name, img = null, note, multiplier = 1, prior, after, calc }) {
  return {
    uuid,
    name,
    img, // the portrait the row leads with (user call, 2026-08-15)
    ...(note ? { note } : {}),
    ...(multiplier !== 1 ? { multiplier } : {}),
    prior,
    delta: hpDelta(prior, after),
    taken: calc ? calc.amount : null,
    traits: traitReasons(calc),
    reverted: false
  };
}

/* --- the merge discipline, shared by every writer of either flag ---------------------------- */

/**
 * Merge damage entries into a `receipt` flag.
 *
 * ⚠ MERGE, never overwrite (v1.6.0): a spell hold can split one roll's application in time —
 * unheld targets land at once, a held target lands after its verdict — and the second write
 * must not eat the first's entries. Run it inside `queueFlagWrite` so two CONCURRENT writers
 * cannot each merge into the same pre-read copy and drop one another's entries; a lost entry
 * also defeats reconcileSaveDamage's idempotence guard and the damage lands twice. The
 * measurement that found it is recorded in core.js.
 *
 * ⚠ An existing entry for a uuid is REPLACED here where the effect side accumulates, and the
 * asymmetry is deliberate: a target has ONE HP story per damage message — a re-application
 * supersedes it — and several effects.
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
 * Merge one applied-entry into an effectReceipt flag object — THE receipt bookkeeping, shared
 * by every writer (the rider and cast appliers, the mastery chips, the hold's answer paths) so
 * the merge discipline can never drift between them: entries keyed by uuid, effects deduped by
 * id, nothing ever overwritten.
 */
export function joinEffectReceipt(flag, entry) {
  flag.targets ??= [];
  let target = flag.targets.find(t => t.uuid === entry.uuid);
  if ( !target ) flag.targets.push(target = { uuid: entry.uuid, name: entry.name, img: entry.img ?? null, effects: [] });
  for ( const e of entry.effects ) {
    if ( !target.effects.some(x => x.id === e.id) ) target.effects.push(e);
  }
  return target;
}

/* --- reading an entry ----------------------------------------------------------------------- */

/**
 * What this target actually TOOK — the number the table is owed, and the Vex/Slow gate's
 * "hit AND dealt damage" test.
 *
 * `taken` is the truth whenever it was recorded. An entry written before the field existed
 * falls back to the pool's own movement, which under-reads at 0 HP; that is the best such an
 * entry can offer, and a target-specific immunity is invisible in it.
 */
export function takenOf(entry) {
  return (typeof entry?.taken === "number") ? entry.taken
    : -((entry?.delta?.value ?? 0) + (entry?.delta?.temp ?? 0));
}

/**
 * Every number one receipt row shows, and the voice it speaks in. The words are here with the
 * arithmetic that chooses them, because twice now the numbers were right and the sentence was
 * wrong; the colours stay at the EDGE, where the stylesheet is.
 *
 * ⚠ Healing arrives as a NEGATIVE take (calculateDamage inverts healing types), and "−-25 HP"
 * in damage red is what that looked like (user report 2026-08-16). A gain reads +N.
 *
 * ⚠ TEMP HP IS A THIRD KIND, not a signed HP number (user report 2026-08-19, Morgash's Dash
 * read "−0 HP" in damage maroon). dnd5e 5.3.3's calculateDamage routes a `temphp` entry into
 * `damages.temp` and NEVER into `damages.amount` — and the healing-negation block right above
 * it covers "healing" and "maximum" ONLY, so temp is not inverted either. A pure temp grant
 * therefore lands with `taken === 0`, which failed a `taken < 0` gain test and fell through to
 * the damage voice. The pool genuinely did not move; `hp.temp` did, and only the delta knows
 * it — the value itself applies correctly (applyDamage sets hp.temp to the greater of old and
 * new), so this was always a card that lied, never a grant that went missing. (`taken === 0`
 * also catches −0, which is what a zeroed calc actually produces.)
 *
 * `from`/`after` are the GM's book — the pool either side, which is what says the −14 landed on
 * a creature already at 0.
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
    // A MIXED entry (damage or healing that also granted temp) keeps its own number and
    // appends the temp rather than hiding one behind the other.
    tempExtraText: ((tempGained > 0) && !tempOnly) ? ` · +${tempGained} temp` : null
  };
}

/**
 * One receipt reason in table English.
 *
 * ⚠ The LABEL is resolved at the EDGE and handed in: the lookup reads CONFIG.DND5E, which this
 * layer may not touch (§2 rule 1). `type` stays as the fallback so an unknown key still reads
 * as something rather than as "undefined".
 */
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
 * What reverting one damage entry has to do — or null when there is nothing to do.
 *
 * ⚠ Idempotent by construction: an entry already marked reverted plans nothing, so a second
 * click, a second client or a re-render can never re-fight a human's ↩. The returned `entry` is
 * the LIVE object inside `receipt` — the caller marks it and writes the flag back, which is
 * what re-renders the card on every client.
 *
 * `clearDefeated` carries the combatplus interaction contract (ARCHITECTURE.md §7): a revert
 * that raises the target back above 0 also clears the defeated mark and the dead overlay its
 * auto-defeated set at 0.
 *
 * Deliberately NOT rewound: rolls, resources, ammo, concentration (ARCHITECTURE.md §4) —
 * re-applying to the right target is the native tray's job.
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
 * The effect twin: the entry one ✕ Revert click owns, or null when there is nothing to do.
 * Same idempotence, same reason — the concentration cascade, a manual right-click or the
 * target's death may all beat the button, and none of them may un-mark what a human reverted.
 */
export function revertableEffect(flag, targetUuid, effectId) {
  const target = flag?.targets?.find(t => t.uuid === targetUuid);
  const entry = target?.effects?.find(e => e.id === effectId);
  return (!entry || entry.reverted) ? null : entry;
}
