// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): what a rerolled die does to a message's roll
 * data, PER DIE (Empowered Spell, Healer, Puncture) or PER SET (Savage Attacker). The EDGE halves
 * are shared.js `rebuildRolls` and auto-apply.js `moveAppliedDamage`.
 * ⚠ The data is `Roll#toJSON`; a struck face stays in `results`, inactive and marked.
 */

/**
 * The per-die patch: each pick's face struck, its new face joining the same term. Returns a
 * CLONE and what moved; a pick whose face is gone is skipped.
 * @param {any[]} rollsData
 * @param {{key: string, roll: number, term: number, index: number}[]} picks
 * @param {number[]} faces  in pick order
 */
export function rerollFaces(rollsData, picks, faces) {
  const data = JSON.parse(JSON.stringify(rollsData ?? []));
  const done = [];
  (picks ?? []).forEach((d, i) => {
    const term = data[d.roll]?.terms?.[d.term];
    const old = term?.results?.[d.index];
    if ( !old || !Number.isFinite(faces?.[i]) ) return;
    old.active = false; old.rerolled = true;
    // The `minN` floor holds as `Die#minimum` applies it: `count` is the worth, `result` the face.
    const floor = floorOf(term.modifiers);
    const face = Number(faces[i]);
    const raised = (floor !== null) && (face < floor);
    term.results.push(raised ? { result: face, active: true, count: floor, rerolled: true } : { result: face, active: true });
    done.push({ key: d.key, old: Number(old.count ?? old.result), new: raised ? floor : face, ...(raised ? { face } : {}) });
  });
  return { data, done };
}

function floorOf(modifiers) {
  for ( const m of (modifiers ?? []) ) {
    const hit = /^min(\d+)$/i.exec(String(m));
    if ( hit ) return Number(hit[1]);
  }
  return null;
}

/**
 * THE WEAPON'S DICE: every die term of the first `count` rolls (dnd5e builds the activity's own
 * parts first, riders after). A crit's doubled dice are in `number`.
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

/** The formula that rolls the same dice again, modifiers included. */
export const setFormula = dice => (dice ?? []).map(d => `${d.number}d${d.faces}${(d.modifiers ?? []).join("")}`).join(" + ");

export const setTotal = dice => (dice ?? []).reduce((n, d) => n + (d.values ?? []).reduce((a, b) => a + b, 0), 0);

/**
 * Which set stands: the higher, never asked (RULINGS *Savage Attacker*); a TIE keeps the first.
 * @param {{first: number, second: number}} args
 */
export function eitherOutcome({ first, second }) {
  const secondWins = Number(second) > Number(first);
  return { stands: secondWins ? "second" : "first", kept: secondWins ? Number(second) : Number(first),
    struck: secondWins ? Number(first) : Number(second), delta: secondWins ? Number(second) - Number(first) : 0 };
}

/**
 * The per-set patch (a clone); `fresh[k]` is the k-th term's new results. The loser is struck.
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
 * THE HINT: the first set against the same dice's distribution (a die's `r1` counted); `low`
 * starts the popup ticked.
 * @param {ReturnType<typeof weaponDiceOf>} dice
 * @param {number} first
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
 * Is the fold offered on this hit? Once per turn by the `rider` chit (out of combat, every hit).
 * @param {{listed: boolean, owned: boolean, weapon: boolean, chitStands: boolean}} facts
 * @returns {"due"|"spent"|null}
 */
export function eitherDue({ listed, owned, weapon, chitStands }) {
  if ( !listed || !owned || !weapon ) return null;
  return chitStands ? "spent" : "due";
}

/**
 * THE HEALING REROLLS (Healer, RULINGS *The origin feats*): every active face of a message's
 * HEALING rolls (never temp HP), `one` marking a rerollable face.
 * @param {any[]} rollsData
 * @param {number} [reroll=1]
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
 * A literal `r1` / `r=1` taken off every die (Battle Medic ships `1d8r1`; the popup rerolls).
 * @param {string} formula
 */
export function stripRerollOnes(formula) {
  return String(formula ?? "").replace(/(\d*d\d+)r=?1(?![\d<>=])/gi, "$1");
}

/**
 * ONE DIE ROLLED AGAIN (Puncture, RULINGS *The PHB feats — groups 1–3*): the active face with the
 * most to gain (average less face); a tie keeps the first met.
 * @param {any[]} rollsData
 * @returns {{key: string, roll: number, term: number, index: number, faces: number, value: number, gain: number}|null}
 */
export function bestRerollDie(rollsData) {
  /** @type {{key: string, roll: number, term: number, index: number, faces: number, value: number, gain: number}|null} */
  let best = null;
  (rollsData ?? []).forEach((roll, i) => {
    (roll?.terms ?? []).forEach((term, j) => {
      const faces = Number(term?.faces);
      if ( !Number.isFinite(faces) || (faces < 2) || !Array.isArray(term.results) ) return;
      term.results.forEach((r, k) => {
        if ( (r.active === false) || r.discarded ) return;
        const value = Number.isFinite(Number(r.count)) ? Number(r.count) : (Number(r.result) || 0);
        const gain = ((faces + 1) / 2) - value;
        if ( !best || (gain > best.gain) ) best = { key: `${i}:${j}:${k}`, roll: i, term: j, index: k, faces, value, gain };
      });
    });
  });
  return best;
}

/**
 * The hint for ONE die rolled again; the gain can be a LOSS, since the new roll stands.
 * @param {number} faces
 * @param {number} value
 * @returns {{min: number, max: number, avg: number, beat: number, gain: number, low: boolean}|null}
 */
export function oneDieOdds(faces, value) {
  const f = Number(faces) || 0;
  if ( f < 2 ) return null;
  const avg = (f + 1) / 2;
  const cur = Number(value) || 0;
  const beat = Math.max(0, f - Math.max(0, Math.min(f, cur))) / f;
  const round = (x, k) => Math.round(x * k) / k;
  return { min: 1, max: f, avg: round(avg, 100), beat: round(beat, 1000), gain: round(avg - cur, 100), low: cur < avg };
}
