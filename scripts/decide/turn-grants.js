// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the turn-start grant (registry.js TURN_GRANTS) —
 * which row a landed effect answers, whether this turn is paid, and the card's words. No `game`.
 */
const lower = (/** @type {unknown} */ s) => String(s ?? "").toLowerCase();

/**
 * THE ROW a landed effect answers: its ORIGIN item answers the row's key and its name is the row's effect.
 * `answers` is the registry's row matcher.
 * `on` is the moment asking — the bearer's turn start (the default) or its turn end; a row answers its own.
 * @param {{table: Readonly<Record<string, any>>, item: any, effectName: string|null|undefined, listed?: Set<string>|null,
 *          answers: (key: string, item: any) => boolean, on?: "turnStart"|"turnEnd"}} facts
 * @returns {any|null}   the row spread over `{ key }`
 */
export function grantRowFor({ table, item, effectName, listed = null, answers, on = "turnStart" }) {
  if ( !item || !effectName ) return null;
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( listed && !listed.has(key.toLowerCase()) ) continue;
    if ( (row.on ?? "turnStart") !== on ) continue;
    if ( !answers(key, item) ) continue;
    if ( lower(row.effect) !== lower(effectName) ) continue;
    return { key, ...row };
  }
  return null;
}

/**
 * THE FEATURE ROWS (`match: "feature"`, Regeneration): the bearer's OWN trait pays, on its own numbers — no
 * effect, no caster. Each row answered by one of `features` (the sheet's feat items, `answers` the matcher) — the
 * row's `feature` when it is one benefit of it (Vitality of the Tree's two), else its key. `on` narrows to the
 * rows of that moment (a row's own `on`, "turnStart" by default); null takes every row.
 * @param {{table: Readonly<Record<string, any>>, features: any[], listed?: Set<string>|null,
 *          answers: (key: string, item: any) => boolean, on?: string|null}} facts
 * @returns {{key: string, row: any, item: any}[]}
 */
export function featureGrantRows({ table, features, listed = null, answers, on = null }) {
  const out = [];
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( row?.match !== "feature" ) continue;
    if ( on && ((row.on ?? "turnStart") !== on) ) continue;
    if ( listed && !listed.has(key.toLowerCase()) ) continue;
    const item = (features ?? []).find(i => answers(row.feature ?? key, i)) ?? null;
    if ( item ) out.push({ key, row, item });
  }
  return out;
}

/**
 * The damage types the bearer's OWN copy of the trait names as the block — "if the troll takes Acid or
 * Fire damage, this trait doesn't function on its next turn" — against the system's type labels.
 * A copy naming none (the vampire's sunlight and running water) blocks on nothing: that clause is the
 * table's. The pack's generic item names nothing; the monster's copy carries the monster's words.
 * @param {string|null|undefined} text        the trait's description (HTML or plain)
 * @param {Readonly<Record<string, string>>} labels   damage type key → label ("fire" → "Fire")
 * @returns {string[]} type keys
 */
export function blockingTypes(text, labels) {
  const plain = String(text ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const m = /\b(?:takes?|took|taken|dealt|suffers?)\s+([^.;:]*?)\s+damage\b/i.exec(plain);
  if ( !m ) return [];
  const phrase = String(m[1] ?? "").toLowerCase();
  return Object.entries(labels ?? {})
    .filter(([, label]) => new RegExp(`\\b${String(label).toLowerCase()}\\b`).test(phrase))
    .map(([key]) => key);
}

/**
 * Was the bearer dealt any of `types` SINCE ITS LAST TURN STARTED? `entries` are receipt rows (`uuid`,
 * `parts: [{type, amount}]`, `combat: "id:round:turn"`, `reverted`); the window is from the bearer's
 * previous turn (round − 1 at its own turn index — its own turn counts, a Reaction can burn it there)
 * to now. Round 1: everything since the combat began. Out of combat nothing is read.
 * @param {{entries: any[], uuid: string, combatId: string|null, round: number, turn: number, types: readonly string[]}} facts
 * @returns {{blocked: boolean, type: string|null}}
 */
export function damagedSince({ entries, uuid, combatId, round, turn, types }) {
  if ( !combatId || !(types ?? []).length ) return { blocked: false, type: null };
  const wanted = new Set(types.map(t => String(t).toLowerCase()));
  const fromRound = Number(round) - 1, fromTurn = Number(turn) || 0;
  for ( const e of (entries ?? []) ) {
    if ( !e || (e.uuid !== uuid) || e.reverted ) continue;
    const [id, r, t] = String(e.combat ?? "").split(":");
    if ( id !== combatId ) continue;
    const er = Number(r), et = Number(t);
    if ( !((er > fromRound) || ((er === fromRound) && (et >= fromTurn))) ) continue;
    const part = (e.parts ?? []).find(p => wanted.has(String(p?.type ?? "").toLowerCase()) && (Number(p?.amount) > 0));
    if ( part ) return { blocked: true, type: String(part.type).toLowerCase() };
  }
  return { blocked: false, type: null };
}

/**
 * Once per turn: a place (`combat|round|turn`) already paid pays nothing; no place, no turn.
 * @param {{paid: Set<string>, place: string|null}} facts
 * @returns {{due: boolean, why: string}}
 */
export function grantDue({ paid, place }) {
  if ( !place ) return { due: false, why: "no running turn" };
  if ( paid.has(place) ) return { due: false, why: "paid this turn" };
  return { due: true, why: "the start of its turn" };
}

/**
 * The card's title — a grant regains or gains; a `deals` row takes.
 * @param {{spell: string, bearer: string, total: number, type: string, deals?: boolean}} facts
 */
export function grantTitle({ spell, bearer, total, type, deals = false }) {
  const n = Number(total) || 0;
  if ( deals ) return `${spell} — ${bearer} takes ${n} ${type} damage`;
  if ( type === "temphp" ) return `${spell} — ${bearer} gains ${n} Temporary Hit Point${n === 1 ? "" : "s"}`;
  return `${spell} — ${bearer} regains ${n} Hit Point${n === 1 ? "" : "s"}`;
}

/**
 * A `remind: "extend"` row (Rage): did this turn extend it — an attack roll at an ENEMY, or a save forced on one?
 * `cards` are the bearer's own cards this turn, each `{ kind: "attack"|"save", sides }` (its targets' dispositions);
 * a card with no targets counts (never judged against the player). The Bonus Action is nobody's record.
 * @param {{cards: {kind: string, sides: number[]}[], side: number}} facts
 * @returns {{extended: boolean, why: string}}
 */
export function extendedThisTurn({ cards, side }) {
  const enemy = s => ((side === 1) && (s === -1)) || ((side === -1) && (s === 1)) || (side === 0);
  for ( const c of (cards ?? []) ) {
    if ( !c.sides?.length || c.sides.some(enemy) ) {
      return { extended: true, why: (c.kind === "attack") ? "an attack roll against an enemy" : "an enemy's saving throw forced" };
    }
  }
  return { extended: false, why: "no attack roll against an enemy and forced no saving throw" };
}

/**
 * B4 — a `grant: "end"` row's OPTIONS: which of the row's statuses the bearer wears, each with the effects that carry
 * it (the ones an End deletes). `effects` are plain facts: `{ id, name, statuses }`.
 * @param {string[]} statuses  the row's
 * @param {{id: string, name: string, statuses: string[]}[]} effects  the bearer's applied effects
 * @param {Record<string, string>} [labels]  status → label
 * @returns {{status: string, label: string, effectIds: string[], names: string[]}[]}
 */
export function endOptionsOf(statuses, effects, labels = {}) {
  const out = [];
  for ( const status of (statuses ?? []) ) {
    const carrying = (effects ?? []).filter(e => (e?.statuses ?? []).includes(status));
    if ( !carrying.length ) continue;
    out.push({ status, label: labels[status] ?? (status.charAt(0).toUpperCase() + status.slice(1)),
      effectIds: carrying.map(e => e.id), names: [...new Set(carrying.map(e => e.name))] });
  }
  return out;
}
