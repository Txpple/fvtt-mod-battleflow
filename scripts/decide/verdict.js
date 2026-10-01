// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): who was hit, who saved, and what that costs.
 * Plain objects in, plain values out; shared.js holds the shells that read messages and settings.
 * ⚠ Depend downward only: nothing here imports a machine, the spine, or core.js.
 */

/* THE POST-ROLL FOLD: a spec entry plus whatever stamps its flag, never a new parameter.
 * ⚠ Folds COMPOSE, never ordered by precedence (ARCHITECTURE §11, "Adding a FOLD"): the attacker's
 * move the total, the defender's the AC. A contribution, keyed by `uuid`, is one of
 * `{ac}` (the number to beat), `{add}` (a delta), `{replace}` (a reroll), `{verdict}` (wins outright). */

/** One spend's contribution: attack side with `uuid`, save side without. A reroll is a `replace` (its own crit and fumble). */
function contributionOf(spend, uuid) {
  const at = uuid === undefined ? {} : { uuid };
  // D1 — Stroke of Luck: the d20 TURNED INTO A 20 — a replace like a reroll's, re-judged against the AC or the DC.
  if ( (spend?.kind === "succeed") && Number.isFinite(spend.twenty?.total) ) {
    return { ...at, replace: { total: spend.twenty.total, isCritical: false, isFumble: false } };
  }
  // D1 — Unerring Strike: the miss HITS — a forced verdict on the attack side.
  if ( (spend?.kind === "succeed") && (spend.verdict === "hit") ) return (uuid === undefined) ? null : { uuid, verdict: "hit" };
  // Guarded Mind: the save's VERDICT is the contribution; the attack side has none to force.
  if ( spend?.kind === "succeed" ) return (uuid === undefined) ? { verdict: "saved" } : null;
  if ( (spend?.kind === "heroic") || (spend?.kind === "seeking") || (spend?.kind === "advantage") || (spend?.kind === "reroll") ) {
    if ( !Number.isFinite(spend.reroll?.total) ) return null;
    // The `reroll` kind (REROLLS): the new d20 REPLACES and its bonus ADDS, one entry — a feature's "+ your Fighter level".
    const bonus = ((spend.kind === "reroll") && Number.isFinite(spend.bonus) && spend.bonus) ? { add: Number(spend.bonus) } : {};
    return { ...at, replace: {
        total: spend.reroll.total,
        isCritical: spend.reroll.isCritical === true,
        isFumble: spend.reroll.isFumble === true
      }, ...bonus };
  }
  return Number.isFinite(spend?.die) ? { ...at, add: spend.die } : null;
}

/** Where attack folds come from: a MESSAGE FLAG and its per-target entries → contributions (null = no opinion yet). */
export const ATTACK_FOLDS = [
  {
    flag: "hold",
    entries: flag => flag?.targets ?? [],
    // ⚠ A resolved AC hold contributes the AC IT WAS JUDGED AGAINST, so a later fold re-tests the
    // shielded number; without `acAtVerdict`, the verdict (stale beats a wrong AC).
    contribute: (_flag, t) => {
      if ( !t?.verdict ) return null;
      if ( (t.kind === "negate") || (t.verdict === "negated") ) {
        return { uuid: t.uuid, verdict: t.verdict };
      }
      // A hit a duplicate took (Mirror Image): forced, whatever the AC it was judged against.
      if ( t.verdict === "absorbed" ) return { uuid: t.uuid, verdict: "absorbed" };
      // A `roll` answer (Disadvantage imposed after the hit): the bent d20 REPLACES for this target alone.
      const bent = Number.isFinite(t.bent?.total)
        ? { replace: { total: t.bent.total, isCritical: t.bent.isCritical === true, isFumble: t.bent.isFumble === true } }
        : {};
      if ( Number.isFinite(t.acAtVerdict) ) return { uuid: t.uuid, ac: t.acAtVerdict, ...bent };
      return { uuid: t.uuid, verdict: t.verdict };
    }
  },
  {
    // Every d20 fold kind as one spec. ⚠ One entry per (target × spend); read `spends`, never
    // `offers`, or dice nobody paid for would fold.
    flag: "d20fold",
    entries: flag => (flag?.targets ?? []).flatMap(t =>
      (flag.spends ?? []).map(spend => ({ t, spend }))),
    contribute: (_flag, { t, spend }) => contributionOf(spend, t.uuid)
  },
  {
    flag: "precision",
    entries: flag => flag?.targets ?? [],
    // ⚠ Only a SPENT die contributes; the stamp refuses a natural 1.
    contribute: (flag, t) => ((flag?.outcome === "used") && Number.isFinite(flag?.die))
      ? { uuid: t.uuid, add: flag.die } : null
  }
];

/** Every fold contribution a message carries; `read(flagKey)` hands back that flag. */
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

/** The rolled number, composed, for both sides. A `replace` carries its own crit and fumble. */
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

/** One target's verdict after every fold naming it. ⚠ A null AC is a MISS, crit included (the
 * platform's `evaluatedTargets`); a forced verdict still beats it. */
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
 * Which snapshot targets the roll hit, through every fold that landed on it.
 * @param {object}   args
 * @param {object[]} args.targets  `{uuid, ac, …}`
 * @param {object[]} [args.folds]
 * @param {{isCritical: boolean, isFumble: boolean, total: number}} args.roll
 */
export function hitsAmong({ targets, roll, folds = [] }) {
  return (targets ?? []).filter(t => foldedVerdict(t, roll, folds) === "hit");
}

/** The verdict against the stored DC (the authority); `forced` (legendary resistance) wins regardless. */
export function saveOutcome(total, dc, forced = false) {
  return (forced || (total >= dc)) ? "saved" : "failed";
}

/** THE SAVE SIDE OF THE FOLD: the ask OWNS the DC, so no defence channel; a new save fold is an entry here. */
export const SAVE_FOLDS = [
  {
    // ⚠ No `uuid`: each saver rolls its OWN message, so the flag's spends fold straight in.
    flag: "d20fold",
    entries: flag => flag?.spends ?? [],
    contribute: (_flag, spend) => contributionOf(spend)
  },
  {
    // A BYSTANDER's bend on a demanded save (Restore Balance — Q2 option A): the bent roll REPLACES the total.
    flag: "bystanderRoll",
    entries: flag => (Number.isFinite(flag?.bent?.total) ? [flag.bent] : []),
    contribute: (_flag, bent) => ({ replace: { total: bent.total, isCritical: false, isFumble: false } })
  }
];

/** A save's verdict and composed total after its folds. `forced` and a verdict fold both win;
 * `made` tells the card it was the roller's spend. */
export function foldedSave({ total, dc, forced = false, folds = [] }) {
  const rolled = foldedRoll({ total }, folds);
  const made = (folds ?? []).some(f => f?.verdict === "saved");
  return { total: rolled.total, added: rolled.added, replaced: rolled.replaced,
    outcome: saveOutcome(rolled.total, dc, forced || made), ...(made ? { made: true } : {}) };
}

/**
 * A HELD ATTACK's multiplier for a `damage` reaction answered CAST and in the table; null = full damage.
 * @param {{answer?: string|null, kind?: string, reaction?: string}|null|undefined} target
 * @param {Readonly<Record<string, {multiplier: number, rule?: object|string|null}>>} table
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
 * A HELD ATTACK's damage less a rolled REDUCTION, off the parts in order, none below zero.
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

/** The damage multiplier a verdict earns. ⚠ null means no application AND NO RECEIPT; 0 is receipted. */
export function saveMultiplier(entry, damageOnSave) {
  // Interpose Shield: an accepted Reaction turns a successful save's half into nothing, unreceipted.
  if ( (entry.choice?.kind === "interpose") && (entry.choice.answer === "use")
    && (entry.outcome === "saved") ) return null;
  // Evasion (eligibility read at the fold): a success takes NONE, a failure HALF.
  if ( entry.evasion ) return (entry.outcome === "saved") ? 0 : (entry.outcome === "failed") ? 0.5 : null;
  // Circle of Power: a success against half-on-save spell damage takes NONE.
  if ( entry.noneOnSuccess && (entry.outcome === "saved") ) return 0;
  if ( entry.outcome === "failed" ) return 1;
  if ( entry.outcome !== "saved" ) return null;
  if ( damageOnSave === "full" ) return 1;
  // Potent Cantrip (EVASIONS `side: "caster"`): the caster's cantrip still deals its share on a success.
  const floor = Number(entry.casterHalf?.onSuccess) || 0;
  if ( damageOnSave === "half" ) return Math.max(0.5, floor);
  return floor || null; // "none"
}

/** One verdict in table English; the only derivation, so the card and the row cannot disagree. */
export function verdictText(flag, t) {
  if ( !t.done ) return null;
  if ( t.outcome === "gone" ) return "the target is gone — nothing to roll";
  // An automatic verdict rolled no die: its condition replaces the total.
  const roll = t.autoFailed ? `cannot succeed${t.autoFailedBy ? ` (${t.autoFailedBy})` : ""}`
    : t.autoSucceeded ? `cannot fail${t.autoSucceededBy ? ` (${t.autoSucceededBy})` : ""}` : `${t.total}`;
  return `${roll} ${verdictStakes(flag, t)}`;
}

/** The verdict WITHOUT its total, for the usage card's summary row (which shows the die); null
 * where no such row exists. */
export function verdictTail(flag, t) {
  if ( !t?.done || (t.outcome === "gone") || t.autoFailed || t.autoSucceeded ) return null;
  return verdictStakes(flag, t);
}

/** "vs DC 15 — saved — half damage (legendary resistance) (timer)": the verdict after its total. */
function verdictStakes(flag, t) {
  const half = flag.hasDamage
    ? t.evasion ? ` — no damage (${t.evasionBy ?? "Evasion"})`
      : t.casterHalf ? ` — half damage (${t.casterHalf.by})`
      : (flag.damageOnSave === "half") ? " — half damage"
      : (flag.damageOnSave === "none") ? " — no damage" : " — full damage anyway"
    : "";
  const base = (t.outcome === "saved")
    ? `saved${half}` : `failed${(t.evasion && flag.hasDamage) ? ` — half damage (${t.evasionBy ?? "Evasion"})` : ""}`;
  return `vs DC ${flag.dc} — ${base}`
    + `${t.forced ? " (legendary resistance)" : ""}${t.madeBy ? ` (${t.madeBy})` : ""}${t.timedOut ? " (timer)" : ""}`;
}
