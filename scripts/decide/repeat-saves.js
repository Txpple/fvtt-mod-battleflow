// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the repeating save (registry.js REPEAT_SAVES) —
 * which row a landed effect answers, when a trigger is due, what the verdict does to the effect, and
 * the card's words. No `game`, no settings: the machine (repeat-saves.js) reads the world.
 */
const lower = (/** @type {unknown} */ s) => String(s ?? "").toLowerCase();

/** A row's effect names, lower-cased. */
const effectNamesOf = (/** @type {{effect: string|readonly string[]}} */ row) =>
  (Array.isArray(row.effect) ? row.effect : [row.effect]).map(lower);

/**
 * THE ROW a landed effect answers: its ORIGIN item answers the row's key (identifier, then name) — or the
 * row's own `item` where the key must differ — AND its name is one the row names: a Paralyzed from a
 * ghoul's claw is not Hold Person's. `listed` is the membership reader's set (every row by default);
 * `answers` the registry's row matcher.
 * @param {{table: Readonly<Record<string, any>>, item: any, effectName: string|null|undefined, listed?: Set<string>|null,
 *          answers: (key: string, item: any) => boolean}} facts
 * @returns {any|null}   the row spread over `{ key, effectName }`
 */
export function repeatRowFor({ table, item, effectName, listed = null, answers }) {
  if ( !item || !effectName ) return null;
  const name = lower(effectName);
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( listed && !listed.has(key.toLowerCase()) ) continue;
    if ( !answers(row.item ?? key, item) ) continue;
    const named = effectNamesOf(row).find(n => n === name);
    if ( !named ) continue;
    const canonical = (Array.isArray(row.effect) ? row.effect : [row.effect]).find(n => lower(n) === name) ?? effectName;
    return { key, ...row, effectName: canonical };
  }
  return null;
}

/**
 * Is a trigger due? The row must name it, and no demand for THIS effect may still be pending (a repeat
 * never stacks on an unanswered one).
 * @param {{on: readonly string[]}} row
 * @param {"turnEnd"|"damaged"|"action"} cause
 * @param {{pending: boolean}} facts
 * @returns {{due: boolean, why: string}}
 */
export function repeatDue(row, cause, { pending }) {
  if ( !row?.on?.includes(cause) ) return { due: false, why: `${cause} is not one of its triggers` };
  if ( pending ) return { due: false, why: "a repeat is still unanswered" };
  return { due: true, why: CAUSE_WHY[cause] ?? cause };
}

const CAUSE_WHY = Object.freeze({ turnEnd: "at the end of its turn", damaged: "it took damage", action: "its action" });

/**
 * The demand's OWN bend, when the row gives one trigger Advantage (Tasha's Hideous Laughter: damaged).
 * @param {{advantage?: string, rule?: object|string|null}} row
 * @param {string} cause
 * @param {string} spell
 * @returns {{mode: "advantage", label: string, rule: object|string|null}|null}
 */
export function repeatBend(row, cause, spell) {
  if ( !row?.advantage || (row.advantage !== cause) ) return null;
  return { mode: "advantage", label: `${spell} — the save was raised by damage`, rule: row.rule ?? null };
}

/**
 * WHAT THE VERDICT DOES: a plain row ends on a success and holds on a failure; a `count` row tallies —
 * `saves` successes end it, `fails` failures lock it (no more saves) and press `press` if the row has one —
 * or, with `swap`, END it and press `press` in its place (the medusa's Petrified instead of Restrained).
 * @param {{effect: string|readonly string[], count?: {saves: number, fails?: number, press?: string, swap?: boolean}}} row
 * @param {"saved"|"failed"|string|null} outcome
 * @param {{saves?: number, fails?: number}|null} tally   the tally so far, off the effect
 * @returns {{ends: boolean, locks: boolean, press: string|null, tally: {saves: number, fails: number}|null, says: string}}
 */
export function repeatVerdict(row, outcome, tally) {
  const name = Array.isArray(row.effect) ? row.effect[0] : row.effect;
  const count = row.count ?? null;
  if ( !count ) {
    if ( outcome === "saved" ) return { ends: true, locks: false, press: null, tally: null, says: `${name} ended — the save succeeded` };
    return { ends: false, locks: false, press: null, tally: null, says: `${name} holds — the save failed` };
  }
  const next = { saves: Number(tally?.saves) || 0, fails: Number(tally?.fails) || 0 };
  if ( outcome === "saved" ) {
    next.saves += 1;
    if ( next.saves >= count.saves ) return { ends: true, locks: false, press: null, tally: next, says: `${name} ended — the ${ordinal(count.saves)} success` };
    return { ends: false, locks: false, press: null, tally: next, says: `${name} holds — ${next.saves} of ${count.saves} successes` };
  }
  next.fails += 1;
  if ( count.fails && (next.fails >= count.fails) ) {
    const press = count.press ?? null;
    if ( press && count.swap ) return { ends: true, locks: false, press, tally: next,
      says: `${name} ended — the ${ordinal(count.fails)} failure: ${statusName(press)} instead` };
    return { ends: false, locks: true, press, tally: next,
      says: `${name} holds — the ${ordinal(count.fails)} failure: ${press ? statusName(press) : "no more saves"}` };
  }
  return { ends: false, locks: false, press: null, tally: next, says: `${name} holds — ${next.fails} of ${count.fails ?? "?"} failures` };
}

const ordinal = (/** @type {number} */ n) => ({ 1: "first", 2: "second", 3: "third" })[n] ?? `${n}th`;
const statusName = (/** @type {string} */ s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Does the module float the name off the token? The platform floats "−(name)" itself for an effect with
 * a status or a change (ActiveEffect#_displayScrollingStatus); only a bare one (Confused) needs ours.
 * @param {{statuses?: Iterable<string>|null, changes?: ArrayLike<unknown>|null}} effect
 */
export function needsFloat({ statuses = [], changes = [] }) {
  return ![...(statuses ?? [])].length && !(changes?.length);
}

/**
 * The card's title.
 * @param {{effectName: string, bearer: string, cause: string, spell: string}} facts
 */
export function repeatTitle({ effectName, bearer, cause, spell }) {
  void effectName;
  if ( cause === "damaged" ) return `${spell} — ${bearer} repeats the save: it took damage`;
  if ( cause === "action" ) return `${spell} — ${bearer} may use its action to repeat the save`;
  return `${spell} — ${bearer} repeats the save at the end of its turn`;
}
