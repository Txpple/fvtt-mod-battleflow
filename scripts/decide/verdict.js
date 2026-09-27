// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): who was hit, who saved, and what that
 * costs them. Plain objects in, plain values out — no `game`, no `dnd5e`, no documents, no
 * settings; `hitTargets` and `modeAllows` in shared.js are the shells that read a message or a
 * setting and call in here. ⚠ Depend downward only: nothing here may import a machine, the
 * spine, or core.js.
 */

/* ---------------------------------------------------------------------------------------------
 * THE POST-ROLL FOLD — anything that changes an already-rolled outcome after the fact. A fold is
 * a spec entry plus whatever stamps its flag, never a new parameter to `hitsAmong`.
 *
 * ⚠ Folds COMPOSE, they are never ordered by precedence (ARCHITECTURE §11, "Adding a FOLD"): the
 * attacker's folds move the TOTAL, the defender's move the AC, and one verdict is computed at the
 * end — "18 + 4 = 22 vs AC 20 (Shield) — hits." A contribution, keyed by `uuid`, is one of:
 *
 *   { uuid, ac }        the number to test against changed  (a hold's live AC)
 *   { uuid, add }       a delta on the total                (a superiority die, a bardic die)
 *   { uuid, replace }   a whole new roll: `{total, isCritical, isFumble}`  (a REROLL)
 *   { uuid, verdict }   no arithmetic — the answer IS the verdict  (a negate hold; wins outright)
 * ------------------------------------------------------------------------------------------- */

/**
 * One spend's contribution, for the attack side (`uuid` given) and the save side (omitted).
 * ⚠ A reroll is a `replace` because it carries its own crit and fumble, which an `add` cannot.
 */
function contributionOf(spend, uuid) {
  const at = uuid === undefined ? {} : { uuid };
  // Guarded Mind: no number moves; the save's VERDICT is the contribution — a save's alone, the
  // attack side has no "saved" to force.
  if ( spend?.kind === "succeed" ) return (uuid === undefined) ? { verdict: "saved" } : null;
  // Seeking Spell and Lucky's Advantage replace too; the resolver records Lucky's HIGHER d20.
  if ( (spend?.kind === "heroic") || (spend?.kind === "seeking") || (spend?.kind === "advantage") ) {
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
 * Where the attack folds come from: each spec names a MESSAGE FLAG and turns one of its
 * per-target entries into a contribution (or null for "no opinion yet").
 */
export const ATTACK_FOLDS = [
  {
    flag: "hold",
    entries: flag => flag?.targets ?? [],
    /**
     * ⚠ A resolved AC-type hold contributes the AC IT WAS JUDGED AGAINST, not its baked verdict,
     * so a later attacker-side fold re-tests against the shielded number. A message without
     * `acAtVerdict` falls back to the verdict — a stale answer is safer than a wrong AC.
     */
    contribute: (_flag, t) => {
      if ( !t?.verdict ) return null;                       // unanswered — no opinion yet
      if ( (t.kind === "negate") || (t.verdict === "negated") ) {
        return { uuid: t.uuid, verdict: t.verdict };
      }
      // A `roll` answer (Lucky, Warding Flare, Shadowy Dodge): Disadvantage imposed after the hit.
      // The bent d20 is a REPLACE for this target alone (it carries its own crit and fumble), beside
      // the AC it was judged against, so a later fold still composes.
      const bent = Number.isFinite(t.bent?.total)
        ? { replace: { total: t.bent.total, isCritical: t.bent.isCritical === true, isFumble: t.bent.isFumble === true } }
        : {};
      if ( Number.isFinite(t.acAtVerdict) ) return { uuid: t.uuid, ac: t.acAtVerdict, ...bent };
      return { uuid: t.uuid, verdict: t.verdict };
    }
  },
  {
    // Every d20 fold kind as one spec: the kinds differ in what they SPEND (d20-folds.js), not in
    // what they contribute. ⚠ One entry per (target × spend) — a roll can carry several spends —
    // and read `spends`, never `offers`, or dice nobody paid for would fold.
    flag: "d20fold",
    entries: flag => (flag?.targets ?? []).flatMap(t =>
      (flag.spends ?? []).map(spend => ({ t, spend }))),
    contribute: (_flag, { t, spend }) => contributionOf(spend, t.uuid)
  },
  {
    flag: "precision",
    entries: flag => flag?.targets ?? [],
    /**
     * ⚠ Only a SPENT die contributes (a passed or expired offer leaves the snapshot alone). The
     * die is ADDED, never a fumble rescue: the stamp refuses a natural 1 (maneuvers.js).
     */
    contribute: (flag, t) => ((flag?.outcome === "used") && Number.isFinite(flag?.die))
      ? { uuid: t.uuid, add: flag.die } : null
  }
];

/**
 * Collect every fold contribution a message carries. `read(flagKey)` hands back that flag, which
 * keeps this pure: the edge shell supplies the document.
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
 * The rolled number, composed — the same on the attack and save sides. ⚠ A `replace` carries its
 * own crit and fumble: a rerolled natural 20 crits.
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
 * One target's verdict after every fold that names it. ⚠ A null AC (total cover, no AC data) is a
 * MISS, crit included — the platform's own verdict (`AttackMessageData#evaluatedTargets`). A
 * fold's FORCED verdict (the negate hold) still beats it.
 */
export function foldedVerdict(target, roll, folds = []) {
  const mine = folds.filter(f => f.uuid === target.uuid);
  const forced = mine.findLast(f => f.verdict);
  if ( forced ) return forced.verdict;
  const ac = mine.findLast(f => Number.isFinite(f.ac))?.ac ?? target.ac;
  if ( (ac === null) || (ac === undefined) ) return "miss";
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

/** Does the attacker-side mode admit this side of the table? One home for the npc/pc/all gate. */
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
 * THE SAVE SIDE OF THE FOLD — the same composition, one dimension shorter. The ask OWNS the DC,
 * so there is no defence-side channel and no `{ dc }` shape; `add`, `replace` and a forced
 * verdict are shared. A new save fold is an entry here, not a change to the resolver.
 */
export const SAVE_FOLDS = [
  {
    /**
     * The same `d20fold` flag the attack side reads — one stamp, both channels. ⚠ No `uuid`: each
     * saver rolls its OWN message and the flag rides that roll, so there is one contribution per
     * flag and `foldedSave` folds it straight in.
     */
    flag: "d20fold",
    entries: flag => flag?.spends ?? [],
    contribute: (_flag, spend) => contributionOf(spend)
  }
];

/**
 * A save's verdict after every fold that names it. Returns the composed TOTAL as well, because the
 * card prints the number it judged (`verdictText`). ⚠ `forced` (legendary resistance) wins
 * regardless; a fold whose contribution IS the verdict (Guarded Mind) is the same ruling, spent by
 * the roller — `made` tells the card which.
 */
export function foldedSave({ total, dc, forced = false, folds = [] }) {
  const rolled = foldedRoll({ total }, folds);
  const made = (folds ?? []).some(f => f?.verdict === "saved");
  return { total: rolled.total, added: rolled.added, replaced: rolled.replaced,
    outcome: saveOutcome(rolled.total, dc, forced || made), ...(made ? { made: true } : {}) };
}

/**
 * A HELD ATTACK's damage against one reactor: a `damage`-kind reaction answered CAST and named in
 * the multiplier table lands at its multiplier (Uncanny Dodge halves). Anything else is null — full
 * damage, the "reduce by hand" card stands.
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
 * A HELD ATTACK's damage short by a REDUCTION the reactor rolled (Parry): the number comes off the
 * parts in order, none below zero. Untouched when nothing is to be taken.
 * @param {{value: number, type?: string|null, properties?: Set<string>}[]} damages
 * @param {number} amount
 */
export function reduceDamages(damages, amount) {
  let left = Math.max(0, Number(amount) || 0);
  if ( !left ) return damages;
  return damages.map(d => {
    const cut = Math.min(Math.max(0, Number(d.value) || 0), left);
    left -= cut;
    return { ...d, value: Math.max(0, (Number(d.value) || 0) - cut) };
  });
}

/**
 * What a verdict does to the number: 1 on a failure; the activity's own word on a success;
 * nothing at all for any other outcome (a "gone" target has nobody to pay).
 *
 * ⚠ null means no application AND NO RECEIPT — never a receipt for zero.
 */
export function saveMultiplier(entry, damageOnSave) {
  // Interpose Shield: an accepted Reaction turns a successful save's half into NOTHING — no
  // application, no receipt; the settle card is the record. Only a SAVED entry carries the choice.
  if ( (entry.choice?.kind === "interpose") && (entry.choice.answer === "use")
    && (entry.outcome === "saved") ) return null;
  // Evasion (Dex save, half on a success, saver not Incapacitated — read at the fold): a success
  // takes NONE (0 — applied and receipted, never silent), a failure HALF.
  if ( entry.evasion ) return (entry.outcome === "saved") ? 0 : (entry.outcome === "failed") ? 0.5 : null;
  // Circle of Power: a success against half-on-save spell damage takes NONE (0, receipted).
  if ( entry.noneOnSuccess && (entry.outcome === "saved") ) return 0;
  if ( entry.outcome === "failed" ) return 1;
  if ( entry.outcome !== "saved" ) return null;
  if ( damageOnSave === "half" ) return 0.5;
  if ( damageOnSave === "full" ) return 1;
  return null; // "none": a successful save takes nothing at all — no application, no receipt
}

/**
 * One verdict, in table English — derived here and nowhere else, so the card and the row cannot
 * disagree. Any other rendering of a verdict calls this.
 */
export function verdictText(flag, t) {
  if ( !t.done ) return null;
  if ( t.outcome === "gone" ) return "the target is gone — nothing to roll";
  // The save gate's automatic failure rolled no die: the condition that failed it replaces the total.
  const roll = t.autoFailed ? `cannot succeed${t.autoFailedBy ? ` (${t.autoFailedBy})` : ""}`
    : t.autoSucceeded ? `cannot fail${t.autoSucceededBy ? ` (${t.autoSucceededBy})` : ""}` : `${t.total}`;
  return `${roll} ${verdictStakes(flag, t)}`;
}

/**
 * The verdict WITHOUT its total — "vs DC 15 — saved — half damage" — for the platform's summary
 * row inside the usage card, which already shows the die. Null where no such row exists
 * (unresolved, gone, automatic) — those keep `verdictText`.
 */
export function verdictTail(flag, t) {
  if ( !t?.done || (t.outcome === "gone") || t.autoFailed || t.autoSucceeded ) return null;
  return verdictStakes(flag, t);
}

/** "vs DC 15 — saved — half damage (legendary resistance) (timer)": the verdict after its total. */
function verdictStakes(flag, t) {
  const half = flag.hasDamage
    ? t.evasion ? " — no damage (Evasion)"
      : (flag.damageOnSave === "half") ? " — half damage"
      : (flag.damageOnSave === "none") ? " — no damage" : " — full damage anyway"
    : "";
  const base = (t.outcome === "saved")
    ? `saved${half}` : `failed${(t.evasion && flag.hasDamage) ? " — half damage (Evasion)" : ""}`;
  return `vs DC ${flag.dc} — ${base}`
    + `${t.forced ? " (legendary resistance)" : ""}${t.madeBy ? ` (${t.madeBy})` : ""}${t.timedOut ? " (timer)" : ""}`;
}
