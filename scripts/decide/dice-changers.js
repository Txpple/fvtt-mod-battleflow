// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): THE DICE CHANGERS' pure half, one popup per
 * damage roll (RULINGS *The dice changers — one popup*). Kinds `pick` (chosen dice rerolled), `set`
 * (all again, higher stands), `one` (one die again). ⚠ They run pick, set, one: `one` chooses its
 * die off the faces standing after the set.
 */

/** The flag's key on the damage message: one record per roll. */
export const DICE_CHANGE_FLAG = "diceChange";

/** The order the kinds run in at the answer. */
const KIND_ORDER = Object.freeze({ pick: 0, set: 1, one: 2 });

/** The statuses that hold the damage's application: the dice land ONCE, with what stood. */
export const DICE_CHANGE_WAITS = Object.freeze(["due", "pending", "answering"]);

/**
 * The rows in the order they run (stable).
 * @typedef {{key: string, feature: string, kind: "pick"|"set"|"one", status: string,
 *   cap?: number, cost?: number, poolId?: string, rule?: string|null,
 *   formula?: string, first?: number, faces?: number, odds?: object|null,
 *   second?: number, stands?: string, delta?: number, before?: number, after?: number,
 *   picks?: {key: string, old: number, new: number}[]}} ChangerRow
 * @param {ChangerRow[]} rows
 */
export function orderRows(rows) {
  return [...(rows ?? [])].map((r, i) => ({ r, i }))
    .sort((a, b) => ((KIND_ORDER[a.r.kind] ?? 9) - (KIND_ORDER[b.r.kind] ?? 9)) || (a.i - b.i)).map(x => x.r);
}

/**
 * The record's status at birth: any due row makes it due, else "spent"; no rows, null.
 * @param {ChangerRow[]} rows
 * @returns {"due"|"spent"|null}
 */
export function birthStatus(rows) {
  if ( !(rows ?? []).length ) return null;
  return rows.some(r => r.status === "due") ? "due" : "spent";
}

/**
 * Every active face, keyed `roll:term:index`: what the die COUNTS (a floor), with `rolled` when it differs.
 * @param {any[]} rollsData   the rolls' JSON
 * @returns {{key: string, roll: number, term: number, index: number, faces: number, result: number, rolled?: number}[]}
 */
export function diceChipsOf(rollsData) {
  const out = [];
  (rollsData ?? []).forEach((roll, i) => {
    (roll?.terms ?? []).forEach((term, j) => {
      if ( !Number.isFinite(term?.faces) || !Array.isArray(term.results) ) return;
      term.results.forEach((r, k) => {
        if ( (r.active === false) || r.discarded ) return;
        const counted = Number(r.count ?? r.result);
        out.push({ key: `${i}:${j}:${k}`, roll: i, term: j, index: k, faces: term.faces, result: counted,
          ...(counted !== Number(r.result) ? { rolled: Number(r.result) } : {}) });
      });
    });
  });
  return out;
}

/**
 * THE ANSWER'S PLAN: the ticked rows still asking, in run order; a pick row with its capped dice
 * (none picked, it drops out).
 * @param {{rows: ChangerRow[], ticked: string[], picks?: string[], dice?: {key: string, faces: number, result: number}[]}} args
 * @returns {{row: ChangerRow, picks?: {key: string, roll: number, term: number, index: number, faces: number, result: number}[]}[]}
 */
export function answerPlan({ rows, ticked, picks = [], dice = [] }) {
  const on = new Set(ticked ?? []);
  const out = [];
  for ( const row of orderRows(rows) ) {
    if ( (row.status !== "pending") || !on.has(row.key) ) continue;
    if ( row.kind === "pick" ) {
      const chosen = empoweredPlan({ dice, picks, cap: row.cap ?? 1 });
      if ( chosen.length ) out.push({ row, picks: /** @type {any} */ (chosen) });
    } else out.push({ row });
  }
  return out;
}

/** Which button is live: Apply while the plan does something, Keep while nothing is ticked.
 * @param {{rows: ChangerRow[], ticked: string[], picks?: string[], dice?: any[]}} args */
export function buttonState(args) {
  return { apply: answerPlan(args).length > 0, keep: !(args.ticked ?? []).length };
}

/** The Apply button's word: one row's own verb, or Apply for several. @param {ChangerRow[]} asking */
export function applyLabel(asking) {
  if ( (asking ?? []).length !== 1 ) return "Apply";
  const kind = asking[0]?.kind;
  return (kind === "pick") ? "Reroll the picked dice" : "Roll again";
}

/**
 * A row's offer as its tick row says it.
 * @param {ChangerRow} row
 * @returns {{dice: string, tag: string}}
 */
export function rowOffer(row) {
  if ( row.kind === "pick" ) {
    const cap = Number(row.cap) || 1;
    return { dice: `reroll up to ${cap} ${cap === 1 ? "die" : "dice"}`, tag: `${Number(row.cost) || 1} SP` };
  }
  if ( row.kind === "one" ) return { dice: `the ${row.first} again — the new roll stands`, tag: "once per turn" };
  return { dice: `${row.formula ?? "the weapon's dice"} again`, tag: "once per turn" };
}

/**
 * The popup's title line.
 * @param {ChangerRow[]} asking
 * @param {number} total
 */
export function popupTitle(asking, total) {
  const one = ((asking ?? []).length === 1) ? asking[0] : null;
  if ( one?.kind === "one" ) return `${total} damage — roll the ${one.first} on the d${one.faces} again?`;
  if ( one?.kind === "set" ) return `${total} damage — roll it again?`;
  if ( one?.kind === "pick" ) return `${total} damage — reroll up to ${one.cap} ${one.cap === 1 ? "die" : "dice"}?`;
  return `${total} damage — change the dice?`;
}

/** One step's sentence on the announce card. @param {ChangerRow} row  with its outcome merged in */
export function stepLine(row) {
  if ( row.kind === "pick" ) {
    const p = row.picks ?? [];
    return `${row.feature} — ${p.map(x => x.old).join(", ")} → ${p.map(x => x.new).join(", ")} · ${row.before} → ${row.after}`;
  }
  if ( row.kind === "one" ) return `${row.feature} — the ${row.first} on the d${row.faces} again → ${row.second} — the new roll stands: ${row.after}`;
  return `${row.feature} — ${row.formula} again → ${row.second} — ${row.stands === "second" ? "the higher stands" : "the first stands"}: ${row.after}`;
}

/**
 * The card's lines, one per row; the record's status speaks for a row still waiting on it.
 * @param {{status: string, rows?: ChangerRow[], timedOut?: boolean}} flag
 * @returns {string[]}
 */
export function diceChangeLines(flag) {
  return (flag?.rows ?? []).map(row => {
    const status = (row.status === "pending" || row.status === "due") ? (flag.status === "answering" ? "answering" : row.status) : row.status;
    if ( row.kind === "pick" ) {
      const cap = Number(row.cap) || 1;
      switch ( status ) {
        case "used": return stepLine(row);
        case "answering": return `${row.feature} — the dice are rolling`;
        case "kept": return `${row.feature} — kept${flag.timedOut ? " (the clock ran out)" : ""}`;
        case "moot": return `${row.feature} — nothing to reroll`;
        case "due": return `${row.feature} — asks once the dice land`;
        default: return `${row.feature} — offered: reroll up to ${cap} ${cap === 1 ? "die" : "dice"}`;
      }
    }
    return eitherCardLine({ ...row, status, total: row.after ?? null, one: row.kind === "one", timedOut: flag.timedOut });
  });
}

/**
 * The canvas replay of every step at once, chips in run order.
 * @param {({on: string, chips: object[]}|null)[]} rises
 * @returns {{on: string, chips: object[]}|null}
 */
export function mergeRises(rises) {
  const live = /** @type {{on: string, chips: object[]}[]} */ ((rises ?? []).filter(r => r?.on && r.chips?.length));
  return live.length ? { on: live[0]?.on ?? "", chips: live.flatMap(r => r.chips) } : null;
}

/** EMPOWERED SPELL'S PICK: the ticked dice, up to the cap (minimum one), found by key.
 * @param {{dice: {key: string, faces: number, result: number}[], picks: string[], cap: number}} args */
export function empoweredPlan({ dice, picks, cap }) {
  const limit = Math.max(1, Number(cap) || 1);
  const seen = new Set();
  const out = [];
  for ( const key of picks ?? [] ) {
    if ( seen.has(key) ) continue;
    const die = (dice ?? []).find(d => d.key === key);
    if ( !die ) continue;
    seen.add(key);
    out.push(die);
    if ( out.length >= limit ) break;
  }
  return out;
}

/**
 * The card's line for a set or one-die fold, from its record.
 * @param {{status: string, feature?: string, formula?: string, first?: number, second?: number,
 *          stands?: string, total?: number|null, timedOut?: boolean, one?: boolean, faces?: number}} flag
 */
export function eitherCardLine(flag) {
  const name = flag?.feature ?? "Savage Attacker";
  if ( flag?.one && (flag.status === "used") ) {
    const tail = Number.isFinite(flag.total) ? `: ${flag.total}` : "";
    return `${name} — the ${flag.first} on the d${flag.faces} again → ${flag.second} — the new roll stands${tail} · used this turn`;
  }
  if ( flag?.one && (flag.status === "answering") ) return `${name} — rolling one die again`;
  if ( flag?.one && (flag.status === "moot") ) return `${name} — the attack missed; nothing to roll again`;
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
    // Due: waits for the hit to stand (a defender's reaction comes first).
    case "due": return `${name} — asks once the hit stands`;
    default: return `${name} — offered: roll the weapon's dice again?`;
  }
}
