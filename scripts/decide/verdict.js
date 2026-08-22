/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): who was hit, who saved, and what that
 * costs them.
 *
 * Moved out of shared.js and saves.js (PLAN.md Phase 2, "move, do not rewrite"). This is the
 * most-copied logic in the module and the most consequential: it decides whether an attack
 * landed and how much damage a save lets through. Everything here takes plain objects and
 * returns plain values — no `game`, no `dnd5e`, no documents, no settings.
 *
 * `saveMultiplier` and `verdictText` arrived already pure and moved verbatim. `hitsAmong` and
 * `modeAdmits` are the pure cores of `hitTargets` and `modeAllows`, whose remaining shells in
 * shared.js do nothing but read a message or a setting and call in here — which is precisely
 * the shape PLAN.md Phase 2 asks every handler to end up in.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/**
 * Which of an attack's snapshot targets the roll actually hit — the system's own render-time
 * test, recomputed: crit hits, fumble misses, otherwise total >= ac.
 *
 * ⚠ A null AC (total cover, or a target with no AC data) is deliberately NOT auto-resolvable.
 * The system's own targets tray classes those rows as hits because `total < null` is false,
 * but the outcome is not determined by data we trust, so those targets are left to humans
 * (DESIGN.md R1) and the native tray.
 *
 * ⚠ Verdicts OVERRIDE the snapshot, and the two channels point opposite ways. A resolved
 * reaction hold turns a hit into a miss — after a Shield the stored descriptor's AC is stale,
 * and auto-apply would otherwise damage a target the module already announced as missed
 * (ARCHITECTURE.md §5, the stale-AC trap). The PRECISION fold turns a miss into a hit after
 * the fact (v1.19.0, FLOW item 1a). Hold verdicts take precedence; in practice the sets are
 * disjoint, because a hold stamps hits and precision stamps misses.
 *
 * @param {object}   args
 * @param {object[]} args.targets    the attack's target snapshot: `{uuid, ac, …}`
 * @param {object[]} [args.held]     hold verdicts: `{uuid, verdict}`
 * @param {object[]} [args.precision] precision verdicts: `{uuid, verdict}`
 * @param {{isCritical: boolean, isFumble: boolean, total: number}} args.roll
 */
export function hitsAmong({ targets, held = [], precision = [], roll }) {
  return (targets ?? []).filter(t => {
    const verdict = held.find(h => h.uuid === t.uuid)?.verdict
      ?? precision.find(p => p.uuid === t.uuid)?.verdict;
    if ( verdict ) return verdict === "hit";
    return (t.ac !== null) && (t.ac !== undefined)
      && (roll.isCritical || (!roll.isFumble && (roll.total >= t.ac)));
  });
}

/**
 * Does the attacker-side mode admit this side of the table? One home for the npc/pc/all gate
 * — Phase 1a and Graze both read it, and a mode added here reaches both.
 */
export function modeAdmits(mode, isPC) {
  if ( mode === "off" ) return false;
  if ( (mode === "npc") && isPC ) return false;
  if ( (mode === "pc") && !isPC ) return false;
  return true;
}

/** The verdict a rolled total earns against the stored DC. `forced` is legendary resistance,
 * which wins regardless of the number. The stored DC is the authority (the ask's-DC rule). */
export function saveOutcome(total, dc, forced = false) {
  return (forced || (total >= dc)) ? "saved" : "failed";
}

/**
 * What a verdict does to the number: 1 on a failure; the activity's own word on a success;
 * nothing at all for any other outcome (a "gone" target has nobody to pay).
 *
 * ⚠ null means no application AND NO RECEIPT — never a receipt for zero.
 */
export function saveMultiplier(entry, damageOnSave) {
  // Interpose (finding ⑥, recut by walk-5 (y)): an accepted Reaction turns the successful
  // save's half into NOTHING — no application, no receipt; the settle card is the record.
  // Only a SAVED entry ever carries the choice, so there is no failed-with-spend case.
  if ( (entry.choice?.kind === "interpose") && (entry.choice.answer === "use")
    && (entry.outcome === "saved") ) return null;
  if ( entry.outcome === "failed" ) return 1;
  if ( entry.outcome !== "saved" ) return null;
  if ( damageOnSave === "half" ) return 0.5;
  if ( damageOnSave === "full" ) return 1;
  return null; // "none": a successful save takes nothing at all — no application, no receipt
}

/**
 * One verdict, in table English — derived here and NOWHERE else: the card row and the
 * v1.19.0 public verdict line (`announceSaveVerdict`) are its only two callers, which is what
 * makes it impossible for the card to disagree with the row. Any third rendering of a verdict
 * calls this rather than composing its own sentence.
 */
export function verdictText(flag, t) {
  if ( !t.done ) return null;
  if ( t.outcome === "gone" ) return "the target is gone — nothing to roll";
  const half = flag.hasDamage
    ? (flag.damageOnSave === "half") ? " — half damage"
      : (flag.damageOnSave === "none") ? " — no damage" : " — full damage anyway"
    : "";
  const base = (t.outcome === "saved")
    ? `saved${half}` : `failed`;
  return `${t.total} vs DC ${flag.dc} — ${base}`
    + `${t.forced ? " (legendary resistance)" : ""}${t.timedOut ? " (timer)" : ""}`;
}
