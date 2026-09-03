// @ts-check
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

/* ---------------------------------------------------------------------------------------------
 * THE POST-ROLL FOLD — the mechanism, not any one feature's special case (debt D8)
 *
 * A fold is anything that changes an already-rolled outcome after the fact. The module has
 * shipped two since v1.19.0 — a reaction HOLD (the defender's AC moved) and PRECISION ATTACK
 * (the attacker added a die) — and `hitsAmong` took each as its own named parameter, so a third
 * would have added a third. The three surveyed d20 features (Heroic Inspiration's reroll,
 * Tactical Mind's +1d10, Bardic Inspiration's die) are all that one kind. R4's tripwire: kinds
 * arriving faster than the registry can absorb them, because the mechanism was never lifted out
 * of the first feature that needed it.
 *
 * ⚠ THE OLD PRECEDENCE ARGUMENT IS GONE, AND IT HAD TO GO. This function used to reason "hold
 * verdicts take precedence; in practice the sets are disjoint, because a hold stamps hits and
 * precision stamps misses." A REROLL goes either way — "you must use the new roll" can turn a
 * hit into a miss — so disjointness stops being true the moment a third fold exists.
 *
 * ⚠ USER RULING 2026-08-23: COMPOSE THE ARITHMETIC. Folds do not carry verdicts to be ordered;
 * they carry CONTRIBUTIONS to the two numbers, and the verdict is computed once at the end. The
 * attacker's folds move the TOTAL, the defender's move the AC, and the table sees one line:
 * *"18 + 4 = 22 vs AC 20 (Shield) — hits."* **Precedence stops existing** — there is nothing left
 * to order, which is why this is the only answer that cannot be wrong about a case nobody thought
 * of. Both alternatives were put and both rejected: "the defender always wins" silently eats a
 * spent resource, and "last fold wins" tests the new total against the STALE snapshot AC and
 * announces a hit against a number the defender has already changed.
 *
 * A contribution is one of four shapes, all keyed by `uuid`:
 *
 *   { uuid, ac }        the number to test against changed  (a hold's live AC)
 *   { uuid, add }       a delta on the total                (a superiority die, a bardic die)
 *   { uuid, replace }   a whole new roll: `{total, isCritical, isFumble}`  (a REROLL)
 *   { uuid, verdict }   no arithmetic at all — the answer IS the verdict   (a negate hold)
 *
 * ⚠ `verdict` wins outright and by design: a `negate` hold has no AC story to tell, and
 * inventing arithmetic for it would answer a question nobody asked.
 * ------------------------------------------------------------------------------------------- */

/**
 * One spend's contribution — shared by the attack side and the save side, because "a reroll
 * replaces the roll and a die adds to it" is the same sentence whichever number it is tested
 * against. `uuid` is supplied on the attack side and omitted on the save side.
 *
 * ⚠ `heroic` is the module's first shipped `replace`, and it is a replace precisely because a
 * REROLL carries its own crit and fumble: a rerolled natural 20 crits and a rerolled natural 1
 * fumbles, neither of which an `add` can express.
 */
function contributionOf(spend, uuid) {
  const at = uuid === undefined ? {} : { uuid };
  if ( spend?.kind === "heroic" ) {
    return Number.isFinite(spend.reroll?.total)
      ? { ...at, replace: {
          total: spend.reroll.total,
          isCritical: spend.reroll.isCritical === true,
          isFumble: spend.reroll.isFumble === true
        } }
      : null;
  }
  return Number.isFinite(spend?.die) ? { ...at, add: spend.die } : null;
}

/**
 * Where the folds come from, declared rather than hard-coded. Each spec names a MESSAGE FLAG and
 * turns one of that flag's per-target entries into a contribution (or null for "no opinion yet").
 *
 * ⚠ Adding a fold to this module is an entry here plus whatever stamps the flag. It is NOT a new
 * parameter to `hitsAmong`, and that is the whole of D8.
 */
export const ATTACK_FOLDS = [
  {
    flag: "hold",
    entries: flag => flag?.targets ?? [],
    /**
     * ⚠ A resolved AC-type hold contributes the AC IT WAS JUDGED AGAINST, not its own baked
     * verdict. That is what makes composition possible: after a Shield, a later attacker-side
     * fold must test its new total against the SHIELDED number, and a stored "miss" cannot be
     * re-tested against anything. `acAtVerdict` has been stamped since the hold was written, so
     * the number is already there — but a message from before that field existed falls back to
     * the verdict, because a stale answer is safer than a wrong AC (ARCHITECTURE §5, the
     * stale-AC trap: auto-apply must never damage a target already announced as missed).
     */
    contribute: (_flag, t) => {
      if ( !t?.verdict ) return null;                       // unanswered — no opinion yet
      if ( (t.kind === "negate") || (t.verdict === "negated") ) {
        return { uuid: t.uuid, verdict: t.verdict };
      }
      if ( Number.isFinite(t.acAtVerdict) ) return { uuid: t.uuid, ac: t.acAtVerdict };
      return { uuid: t.uuid, verdict: t.verdict };
    }
  },
  {
    /**
     * THE THREE SURVEYED FEATURES, AS ONE SPEC (v1.23.0).
     *
     * ⚠ One entry serves all three kinds, and that is the point of D8 rather than a shortcut:
     * `heroic`/`tactical`/`bardic` differ in what they SPEND, which is d20-folds.js's problem,
     * and agree completely on what they contribute — a number on the attacker's side. By the
     * time a contribution reaches here the spend has already happened and the die is on the
     * flag, so there is nothing left for the kind to change.
     *
     * ⚠ `heroic` is the module's first `replace`, and it is a replace precisely because a
     * REROLL carries its own crit and fumble: a rerolled natural 20 crits and a rerolled
     * natural 1 fumbles, neither of which an `add` can express. `foldedRoll` has handled this
     * since D8 and is unit-tested for it; this is the first shipped caller.
     */
    flag: "d20fold",
    /**
     * ⚠ ONE ENTRY PER (TARGET × SPEND), because a roll can carry SEVERAL spends. v1 modelled a
     * single fold per roll and the table found it immediately: heroic — first in the shipped
     * list — masked Tactical Mind and Bardic entirely. The rules allow stacking (reroll with
     * Heroic Inspiration, still fail, then add a Bardic die) and `foldedRoll` has composed
     * `replace`-then-`add` correctly since D8, so admitting the list costs nothing here.
     *
     * ⚠ Read `spends`, never `offers`: an offer is what the player COULD burn, a spend is what
     * they DID. Contributing from `offers` would fold dice nobody paid for.
     */
    entries: flag => (flag?.targets ?? []).flatMap(t =>
      (flag.spends ?? []).map(spend => ({ t, spend }))),
    contribute: (_flag, { t, spend }) => contributionOf(spend, t.uuid)
  },
  {
    flag: "precision",
    entries: flag => flag?.targets ?? [],
    /**
     * ⚠ Only a SPENT die contributes. A passed or expired offer leaves the snapshot test alone,
     * which is why the outcome is checked rather than merely the presence of the flag.
     * ⚠ And the die is ADDED, never resolved: the fumble it might have rescued cannot reach here,
     * because the stamp refuses a natural 1 outright ("a natural 1 stands", maneuvers.js).
     */
    contribute: (flag, t) => ((flag?.outcome === "used") && Number.isFinite(flag?.die))
      ? { uuid: t.uuid, add: flag.die } : null
  }
];

/**
 * Collect every fold contribution a message carries. `read(flagKey)` hands back that flag — a
 * one-argument reader keeps this pure, so the EDGE shell supplies the document and the
 * arithmetic stays testable with plain objects.
 */
export function foldsFrom(read, specs = ATTACK_FOLDS) {
  const out = [];
  for ( const spec of specs ) {
    const flag = read(spec.flag);
    if ( !flag ) continue;
    for ( const entry of spec.entries(flag) ) {
      const contribution = spec.contribute(flag, entry);
      if ( contribution ) out.push({ ...contribution, from: spec.flag });
    }
  }
  return out;
}

/**
 * The rolled number, composed. Shared by the attack side and the save side, because "a reroll
 * replaces the roll and a die adds to it" is the same sentence whichever number it is tested
 * against.
 *
 * ⚠ A `replace` carries its own crit and fumble: a rerolled natural 20 crits, and that is the
 * whole reason a reroll cannot be modelled as an `add`.
 */
export function foldedRoll(roll, folds = []) {
  const replaced = folds.findLast(f => f.replace)?.replace;
  const base = replaced ?? roll ?? {};
  const added = folds.reduce((n, f) => n + (Number.isFinite(f.add) ? f.add : 0), 0);
  return {
    total: (Number(base.total) || 0) + added,
    isCritical: base.isCritical === true,
    isFumble: base.isFumble === true,
    added, replaced: !!replaced
  };
}

/**
 * One target's verdict after every fold that names it. `"unresolved"` is the null-AC case.
 *
 * ⚠ A null AC (total cover, or a target with no AC data) is deliberately NOT auto-resolvable.
 * The system's own targets tray classes those rows as hits because `total < null` is false, but
 * the outcome is not determined by data we trust, so those targets are left to humans
 * (DESIGN.md R1) and the native tray.
 */
export function foldedVerdict(target, roll, folds = []) {
  const mine = folds.filter(f => f.uuid === target.uuid);
  const forced = mine.findLast(f => f.verdict);
  if ( forced ) return forced.verdict;
  const ac = mine.findLast(f => Number.isFinite(f.ac))?.ac ?? target.ac;
  if ( (ac === null) || (ac === undefined) ) return "unresolved";
  const rolled = foldedRoll(roll, mine);
  if ( rolled.isCritical ) return "hit";
  if ( rolled.isFumble ) return "miss";
  return (rolled.total >= ac) ? "hit" : "miss";
}

/**
 * Which of an attack's snapshot targets the roll actually hit — the system's own render-time
 * test, recomputed through every fold that landed on it.
 *
 * @param {object}   args
 * @param {object[]} args.targets  the attack's target snapshot: `{uuid, ac, …}`
 * @param {object[]} [args.folds]  contributions, from `foldsFrom`
 * @param {{isCritical: boolean, isFumble: boolean, total: number}} args.roll
 */
export function hitsAmong({ targets, roll, folds = [] }) {
  return (targets ?? []).filter(t => foldedVerdict(t, roll, folds) === "hit");
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
 * THE SAVE SIDE OF THE FOLD (debt D8, the half that did not exist).
 *
 * ⚠ `hitsAmong` folded verdicts for ATTACKS only, so a rerolled *save* had nowhere to land —
 * and that, not the offer or the popup, was the real new work in D8. The three surveyed
 * features do not care which kind of d20 they are changing: Heroic Inspiration rerolls "any
 * die", Tactical Mind adds 1d10 to an ability CHECK, and a Bardic die goes on a save as
 * readily as an attack. A mechanism that only knew about attacks would have had to be built
 * twice.
 *
 * It is the same composition, one dimension shorter: the attack side tests a total against an
 * AC that a defender's fold can move; a save tests a total against a DC that the ask OWNS (the
 * ask's-DC rule), so there is no defence-side channel here and a `{ dc }` contribution is
 * deliberately not a shape. Everything else — `add`, `replace`, a forced `outcome` — is shared.
 *
 * ⚠ THIS SHIPPED WITH AN EMPTY REGISTRY, ON PURPOSE — and v1.23.0 is the seam paying off.
 * D8 declared `SAVE_FOLDS` empty so that `saves.js` already routed its verdict through the fold
 * path while the arithmetic was provably unchanged; the first feature to need one is therefore
 * an ENTRY IN A LIST rather than a change to the resolver. That is exactly what happened: the
 * spec below is the whole of the save-side work for all three surveyed features, and
 * `foldSaveVerdict` in saves.js was not touched to admit it.
 */
export const SAVE_FOLDS = [
  {
    /**
     * The save side of the same three features, and deliberately the SAME FLAG the attack side
     * reads (`d20fold`) — one stamp, both channels, because "reroll the d20" and "add a die to
     * the d20" do not care which kind of test the d20 was.
     *
     * ⚠ NO `uuid`, AND NO PER-TARGET DIMENSION AT ALL. An attack is one roll judged against
     * many targets, so its contributions are keyed by target. A save is the mirror image: many
     * rollers, but each one rolls its OWN message, and the flag rides that roll (the locality
     * `foldSaveVerdict` already uses). So there is exactly one contribution per flag, it names
     * nobody, and `foldedSave` — which never filters by uuid — folds it straight in.
     *
     * ⚠ There is no `dc` shape here and there must not be: the ask OWNS the DC (the ask's-DC
     * rule), so a save has no defence-side channel the way an attack has `ac`.
     */
    flag: "d20fold",
    entries: flag => flag?.spends ?? [],
    contribute: (_flag, spend) => contributionOf(spend)
  }
];

/**
 * A save's verdict after every fold that names it. Returns the composed TOTAL as well as the
 * outcome, because the card prints the number it judged (`verdictText`), and a card whose
 * sentence disagrees with its arithmetic is the exact bug class receipt arithmetic was unified
 * to kill.
 *
 * ⚠ `forced` (legendary resistance) still wins regardless — it is not arithmetic, it is a
 * ruling, and folding a die into a save that was never going to be rolled makes no sense.
 */
export function foldedSave({ total, dc, forced = false, folds = [] }) {
  const rolled = foldedRoll({ total }, folds);
  return { total: rolled.total, added: rolled.added, replaced: rolled.replaced,
    outcome: saveOutcome(rolled.total, dc, forced) };
}

/**
 * A HELD ATTACK's damage against one reactor, from the hold's own record (user, 2026-09-02:
 * "uncanny dodge … doesn't half the damage"): a `damage`-kind reaction answered CAST, named
 * in the multiplier table, lands at the table's multiplier — Uncanny Dodge halves. Anything
 * else is null: full damage, no note, the "reduce by hand" card stands for the rest.
 * @param {{answer?: string|null, kind?: string, reaction?: string}|null|undefined} target  the hold's target entry
 * @param {Readonly<Record<string, {multiplier: number, rule?: string}>>} table
 * @returns {{multiplier: number, reaction: string, note: string}|null}
 */
export function interruptMultiplier(target, table) {
  if ( !target || (target.answer !== "cast") || (target.kind !== "damage") ) return null;
  const key = Object.keys(table ?? {}).find(k => k.toLowerCase() === String(target.reaction ?? "").toLowerCase());
  if ( !key ) return null;
  const multiplier = Number(table?.[key]?.multiplier);
  if ( !Number.isFinite(multiplier) || (multiplier === 1) ) return null;
  const how = (multiplier === 0.5) ? "halved" : `×${multiplier}`;
  return { multiplier, reaction: key, note: `${key} — ${how}` };
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
  // EVASION (2026-09-02): the entry carries it when the saver has the feature, the save is
  // Dexterity, the effect deals half on a success, and the saver is not Incapacitated — read at
  // the fold. A success takes NONE (0 — applied and receipted, never silent), a failure HALF.
  if ( entry.evasion ) return (entry.outcome === "saved") ? 0 : (entry.outcome === "failed") ? 0.5 : null;
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
    ? t.evasion ? " — no damage (Evasion)"
      : (flag.damageOnSave === "half") ? " — half damage"
      : (flag.damageOnSave === "none") ? " — no damage" : " — full damage anyway"
    : "";
  const base = (t.outcome === "saved")
    ? `saved${half}` : `failed${(t.evasion && flag.hasDamage) ? " — half damage (Evasion)" : ""}`;
  // The save gate's automatic failure (option E, 2026-09-02): no die was rolled, so there is
  // no total to print — the condition that failed it is the number's replacement.
  const roll = t.autoFailed ? `cannot succeed${t.autoFailedBy ? ` (${t.autoFailedBy})` : ""}` : `${t.total}`;
  return `${roll} vs DC ${flag.dc} — ${base}`
    + `${t.forced ? " (legendary resistance)" : ""}${t.timedOut ? " (timer)" : ""}`;
}
