// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the damage-dice folds' pure half — what a
 * rerolled die does to a damage message's own roll data. Two customers, one shape of patch:
 *   Empowered Spell (metamagic.js, 2026-09-09)  PER DIE: the ticked faces struck, a new face each
 *   Savage Attacker (damage-either.js, Slice A, ruled 2026-09-24 off prototypes/slice-a.html)
 *                                                 PER SET: the weapon's dice rolled again as one
 *                                                 set, the two set totals compared, the higher stands
 * Lifted out of metamagic.js on 2026-09-24 when the second customer arrived (the brief: generalise
 * Empowered's feature-neutral pieces if the diff stays readable). The EDGE halves — rebuilding a
 * Roll from its data (shared.js `rebuildRolls`) and moving damage already applied (auto-apply.js
 * `moveAppliedDamage`) — went down to the spine and the applier the same day.
 *
 * ⚠ The data is the platform's roll JSON (`Roll#toJSON`): `terms[]`, a die term carrying `faces`,
 * `number`, `modifiers` and `results[]` of `{result, active, rerolled?, discarded?}`. A struck face
 * stays in the results — inactive, marked — so the card shows it and every reader of the total
 * (the verdicts, the appliers) sees the new number without knowing why.
 */

/**
 * Empowered's per-die patch: each pick's face is struck (inactive, rerolled) and its new face
 * joins the same term, active. Returns a CLONE and the record of what moved; a pick whose face
 * is no longer in the data is skipped.
 * @param {any[]} rollsData
 * @param {{key: string, roll: number, term: number, index: number}[]} picks
 * @param {number[]} faces  the new faces, in pick order
 */
export function rerollFaces(rollsData, picks, faces) {
  const data = JSON.parse(JSON.stringify(rollsData ?? []));
  const done = [];
  (picks ?? []).forEach((d, i) => {
    const term = data[d.roll]?.terms?.[d.term];
    const old = term?.results?.[d.index];
    if ( !old || !Number.isFinite(faces?.[i]) ) return;
    old.active = false; old.rerolled = true;
    term.results.push({ result: faces[i], active: true });
    done.push({ key: d.key, old: old.result, new: faces[i] });
  });
  return { data, done };
}

/**
 * THE WEAPON'S DICE — every die term of the first `count` rolls (the activity's own damage
 * parts, which dnd5e builds FIRST; riders push theirs after — auto-damage.js stamps `count` at
 * `preRollDamageV2` before any rider runs). A crit's doubled dice are already in the term's
 * `number`; the flat parts (the ability modifier, a magic bonus) are not die terms and never
 * appear here. `values` are the faces that count toward the total now.
 * @param {any[]} rollsData
 * @param {number} count
 * @returns {{roll: number, term: number, number: number, faces: number, modifiers: string[], values: number[]}[]}
 */
export function weaponDiceOf(rollsData, count) {
  const out = [];
  (rollsData ?? []).slice(0, Math.max(0, Number(count) || 0)).forEach((roll, i) => {
    (roll?.terms ?? []).forEach((term, j) => {
      if ( !Number.isFinite(term?.faces) || !Array.isArray(term.results) ) return;
      const values = term.results.filter(r => (r.active !== false) && !r.discarded).map(r => Number(r.result) || 0);
      out.push({ roll: i, term: j, number: Number(term.number) || values.length, faces: term.faces,
        modifiers: [...(term.modifiers ?? [])], values });
    });
  });
  return out;
}

/** The formula that rolls the same dice again — each term's count, faces and its own modifiers. */
export const setFormula = dice => (dice ?? []).map(d => `${d.number}d${d.faces}${(d.modifiers ?? []).join("")}`).join(" + ");

/** A set's total — the faces that count. */
export const setTotal = dice => (dice ?? []).reduce((n, d) => n + (d.values ?? []).reduce((a, b) => a + b, 0), 0);

/**
 * Which set stands. The rule says "use either roll", and there is no reason to keep the lower
 * (ruling 2026-09-24: never ask which) — so the higher stands, and a TIE keeps the first (the
 * roll on the card does not move for nothing).
 * @param {{first: number, second: number}} args
 */
export function eitherOutcome({ first, second }) {
  const secondWins = Number(second) > Number(first);
  return { stands: secondWins ? "second" : "first", kept: secondWins ? Number(second) : Number(first),
    struck: secondWins ? Number(first) : Number(second), delta: secondWins ? Number(second) - Number(first) : 0 };
}

/**
 * Savage's per-set patch. `fresh[k]` is the new results for the k-th weapon die term (the new
 * Roll's own results, rerolls included). When the second set wins, every old face of those terms
 * is struck and the new ones join active; when it loses (or ties) the new faces join STRUCK, so
 * the card shows both sets either way (the ruled card: "the loser struck"). Returns a clone.
 * @param {any[]} rollsData
 * @param {ReturnType<typeof weaponDiceOf>} dice
 * @param {{result: number, active?: boolean, rerolled?: boolean, discarded?: boolean}[][]} fresh
 * @param {boolean} secondWins
 */
export function eitherPatch(rollsData, dice, fresh, secondWins) {
  const data = JSON.parse(JSON.stringify(rollsData ?? []));
  (dice ?? []).forEach((d, k) => {
    const term = data[d.roll]?.terms?.[d.term];
    if ( !term?.results ) return;
    const incoming = (fresh?.[k] ?? []).map(r => ({ ...r }));
    if ( secondWins ) {
      for ( const r of term.results ) if ( r.active !== false ) { r.active = false; r.discarded = true; }
      term.results.push(...incoming);
    } else {
      term.results.push(...incoming.map(r => ({ ...r, active: false, discarded: true })));
    }
  });
  return data;
}

/**
 * THE HINT (user, 2026-09-25, ruled off prototypes/savage-hint.html, option D: "yea use that savage
 * attacker ui"): where the first set sits among everything the same dice could roll — the range,
 * the average, the chance a second set beats it and the damage it adds on average (the higher
 * stands, so a second roll never lowers the hit; the cost is the rest of the turn). `low` is the
 * lean: under the average, the popup starts ticked with "Roll again" the default. The weapon's
 * dice only — the flat parts never roll again. A die's own reroll-once-on-a-1 (`r1`) is counted.
 * @param {ReturnType<typeof weaponDiceOf>} dice
 * @param {number} first  the first set's total
 * @returns {{min: number, max: number, avg: number, beat: number, gain: number, low: boolean}|null}
 */
export function eitherOdds(dice, first) {
  let dist = new Map([[0, 1]]);
  for ( const d of dice ?? [] ) {
    const f = Number(d?.faces) || 0;
    if ( f < 1 ) continue;
    const r1 = (d.modifiers ?? []).some(m => /^r=?1$/i.test(m));
    /** @type {[number, number][]} */
    const face = [];
    for ( let v = 1; v <= f; v++ ) face.push([v, r1 ? ((v === 1 ? 0 : 1 / f) + (1 / (f * f))) : 1 / f]);
    for ( let n = 0; n < (Number(d.number) || 0); n++ ) {
      const next = new Map();
      for ( const [s, p] of dist ) for ( const [v, q] of face ) next.set(s + v, (next.get(s + v) ?? 0) + (p * q));
      dist = next;
    }
  }
  const sums = [...dist.keys()];
  if ( sums.length < 2 ) return null;
  const cur = Number(first) || 0;
  let avg = 0, beat = 0, gain = 0;
  for ( const [s, p] of dist ) { avg += s * p; if ( s > cur ) { beat += p; gain += p * (s - cur); } }
  const round = (x, k) => Math.round(x * k) / k;
  return { min: Math.min(...sums), max: Math.max(...sums), avg: round(avg, 100), beat: round(beat, 1000),
    gain: round(gain, 100), low: cur < avg };
}

/**
 * Is the fold offered on this hit — and if not, what does the card say? Pure over the facts the
 * EDGE reads: the feature listed and on the sheet, a weapon, and once per turn by the `rider`
 * turn chit (standing only for a combatant — out of combat nothing stands and every hit offers).
 * @param {{listed: boolean, owned: boolean, weapon: boolean, chitStands: boolean}} facts
 * @returns {"due"|"spent"|null}  null: nothing to offer and nothing to say
 */
export function eitherDue({ listed, owned, weapon, chitStands }) {
  if ( !listed || !owned || !weapon ) return null;
  return chitStands ? "spent" : "due";
}

/**
 * The card's line for the fold, from its record — source, then result (law 6). The prototype's
 * copy: "1d8 → 5, again → 7 — the higher stands: 11", the tag "Savage Attacker — used this turn".
 * @param {{status: string, feature?: string, formula?: string, first?: number, second?: number,
 *          stands?: string, total?: number|null, timedOut?: boolean}} flag
 */
export function eitherCardLine(flag) {
  const name = flag?.feature ?? "Savage Attacker";
  switch ( flag?.status ) {
    case "used": {
      const firstWon = flag.stands !== "second";
      const tail = Number.isFinite(flag.total) ? `: ${flag.total}` : "";
      return `${name} — ${flag.formula ?? "the weapon's dice"} → ${flag.first}, again → ${flag.second} — `
        + `${firstWon ? "the first stands" : "the higher stands"}${tail} · used this turn`;
    }
    case "spent": return `${name} — used this turn`;
    case "kept": return `${name} — not used${flag.timedOut ? " (the clock ran out)" : ""}, still ready this turn`;
    case "moot": return `${name} — the attack missed; nothing to roll again`;
    case "answering": return `${name} — rolling the weapon's dice again`;
    // Due: the question waits for the hit to stand (a defender's reaction first — the ruled order).
    case "due": return `${name} — asks once the hit stands`;
    default: return `${name} — offered: roll the weapon's dice again?`;
  }
}

/* ---------------------------------------------------------------------------------------------
 * THE HEALING REROLLS (the origin feats, 2026-09-25 — Healer; user: "use the empower spell form as
 * a baseline listing all roll numbers, the ones, and select the ones to replace"; "make sure the
 * healer feat itself gets the 1 popup too not just spells"; "1s ticked"). The third customer of the
 * per-die patch above (`rerollFaces`): the dice a healing roll shows, the 1s among them pickable.
 * ------------------------------------------------------------------------------------------- */

/**
 * Every active face of every die term in a message's HEALING rolls, keyed `roll:term:index` —
 * Empowered's chip rows, with `one` marking a face the feat lets be rerolled. A roll of another type
 * (temporary hit points) shows no chips: "Hit Points you restore".
 * @param {any[]} rollsData   the rolls' JSON
 * @param {number} [reroll=1] the face the feat rerolls
 * @returns {{key: string, roll: number, term: number, index: number, faces: number, result: number, one: boolean}[]}
 */
export function healDiceOf(rollsData, reroll = 1) {
  const out = [];
  (rollsData ?? []).forEach((roll, i) => {
    if ( (roll?.options?.type ?? "healing") !== "healing" ) return;
    (roll?.terms ?? []).forEach((term, j) => {
      if ( !Number.isFinite(term?.faces) || !Array.isArray(term.results) ) return;
      term.results.forEach((r, k) => {
        if ( (r.active === false) || r.discarded ) return;
        const result = Number(r.result) || 0;
        out.push({ key: `${i}:${j}:${k}`, roll: i, term: j, index: k, faces: term.faces, result, one: result === reroll });
      });
    });
  });
  return out;
}

/**
 * A formula with the platform's own reroll-once-on-a-1 (`r1`) taken off every die — Battle Medic's
 * activities ship `1d8r1 + @prof`, which rerolls the 1 silently; the feat's rerolls are the popup's
 * now, so its own roll goes up bare. Only a literal `r1` / `r=1` goes: `r<3`, `rr1` and the rest
 * are another rule's, and stay.
 * @param {string} formula
 */
export function stripRerollOnes(formula) {
  return String(formula ?? "").replace(/(\d*d\d+)r=?1(?![\d<>=])/gi, "$1");
}
