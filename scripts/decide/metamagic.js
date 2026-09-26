// @ts-check
/**
 * Battle Flow — DECISION: metamagic. Which options the cast dialog offers for THIS spell, which
 * the points can pay for, whether a pick is legal, and what the card says after.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE FLOW AS DRAWN (user rulings 2026-09-09, the prototype *Battle Flow Metamagic* — DESIGN §6
 * *Metamagic*): the cast dialog carries one group, a row per option the sheet grants and the
 * list admits — a tick, the name, the cost in Sorcery Points as the tag, the rule folded under,
 * nothing above it. A row the spell does not fit, or the points cannot afford, stays and greys
 * with the reason as its tag. ONE option per cast (the feature's own text); the two later
 * moments (Empowered on the damage, Seeking on the miss) are not rows here. The spend is by hand
 * on the spell's card.
 *
 * What is decided here is the reading and the arithmetic, never the choice: which rows fit the
 * spell (the option's activation is PROSE on the pack, so the predicate is the registry's), which
 * the pool can pay for, and whether the pick stands. The ask at the area — Careful's protected
 * set, Heightened's mark, a chosen area's choice, the popup's defaults and words — is
 * decide/area-ask.js since 2026-09-24; the flag consts live there too.
 */

/** The flag the cast's card carries: `{ key, feature, cost, ... }` (metamagic.js writes it). */
export const METAMAGIC_FLAG = "metamagic";
/**
 * The named predicates a registry row's `when` resolves to, over the facts of the spell being
 * cast (the machine builds the facts off the item and the activity; the tests build them by
 * hand). Unknown names fit nothing.
 * @typedef {{save: boolean, rangeFeet: number|null, touch: boolean, minutes: number,
 *            action: boolean, damageTypes: string[], damageRoll: boolean, spellAttack: boolean,
 *            scalesTargets: boolean, choosesTargets?: boolean}} SpellFacts
 *        `choosesTargets`: a listed area whose caster chooses who it affects (the Chosen Areas list)
 */
const WHEN = {
  any: () => true,
  save: f => !!f.save,
  range: f => f.touch || ((f.rangeFeet ?? 0) >= 5),
  duration: f => (f.minutes ?? 0) >= 1,
  action: f => !!f.action,
  damageType: (f, types) => (f.damageTypes ?? []).some(t => types.includes(String(t).toLowerCase())),
  damageRoll: f => !!f.damageRoll,
  spellAttack: f => !!f.spellAttack,
  scalesTargets: f => !!f.scalesTargets
};

/** The words a greyed row wears when the spell does not fit it — the reason, short. */
const WHY = {
  save: "no saving throw",
  range: "range Self",
  duration: "instantaneous",
  action: "not an action",
  damageType: "no listed damage type",
  damageRoll: "no damage",
  spellAttack: "no attack roll",
  scalesTargets: "does not add a target at a higher level"
};

/**
 * A row's `unless`: a spell the option's WHEN admits but where the option's own words do nothing.
 * Careful Spell on a spell that chooses its targets (user ruling 2026-09-24, off the prototype:
 * "greyed, you choose its targets") — the creatures Careful would spare are the ones the caster
 * already leaves out, so the point would buy nothing.
 */
const UNLESS = {
  choosesTargets: f => !!f.choosesTargets
};
const WHY_UNLESS = {
  choosesTargets: "you choose its targets"
};

/**
 * Does this option fit this spell?
 * @param {{when: string, unless?: string}} row
 * @param {SpellFacts} facts
 * @param {{transmutedTypes?: readonly string[]}} [opts]
 */
export function metamagicFits(row, facts, { transmutedTypes = [] } = {}) {
  const test = WHEN[row?.when];
  if ( !test || !test(facts ?? {}, transmutedTypes) ) return false;
  const not = UNLESS[row?.unless];
  return !(not && not(facts ?? {}));
}

/** Why a row the spell does not fit greys — its WHEN's reason, else its UNLESS's. */
function whyNot(row, facts, transmutedTypes) {
  const test = WHEN[row?.when];
  if ( !test || !test(facts ?? {}, transmutedTypes) ) return WHY[row?.when] ?? "does not fit this spell";
  return WHY_UNLESS[row?.unless] ?? "does not fit this spell";
}

/**
 * The rows of the cast dialog's group, in table order: every listed option the sheet grants
 * whose moment is `cast`, with its fit and its affordability read.
 *
 * @param {{table: Readonly<Record<string, any>>, listed: Iterable<string>, known: Iterable<string>,
 *          facts: SpellFacts, points: number, costs: Record<string, number>,
 *          transmutedTypes?: readonly string[], moment?: string}} args
 *        `listed` = the Metamagic list's names; `known` = the metamagic feat names on the sheet;
 *        `points` = Sorcery Points left; `costs` = per feat name, the option's own consumption
 *        value read off the sheet (an option with no readable cost is unaffordable, never free)
 * @returns {{key: string, feature: string, cost: number|null, picks: string|null, moment: string,
 *            eligible: boolean, why: string|null, affordable: boolean, tag: string}[]}
 */
export function metamagicMenu({ table, listed, known, facts, points, costs, transmutedTypes = [], moment = "cast" }) {
  const lower = s => String(s ?? "").toLowerCase();
  const admits = new Set([...listed].map(lower));
  const have = new Set([...known].map(lower));
  const left = Math.max(0, Number(points) || 0);
  const out = [];
  for ( const [feature, row] of Object.entries(table ?? {}) ) {
    if ( row.moment !== moment ) continue;
    if ( !admits.has(lower(feature)) || !have.has(lower(feature)) ) continue;
    const eligible = metamagicFits(row, facts, { transmutedTypes });
    const raw = costs?.[feature];
    const cost = Number.isFinite(Number(raw)) && (Number(raw) > 0) ? Number(raw) : null;
    const affordable = (cost !== null) && (left >= cost);
    const why = eligible ? null : whyNot(row, facts, transmutedTypes);
    const tag = !eligible ? why
      : (cost === null) ? "cost unreadable"
      : affordable ? `${cost} SP` : `${cost} SP — ${left} left`;
    out.push({ key: row.key, feature, cost, picks: row.picks ?? null, moment: row.moment, eligible, why, affordable, tag: /** @type {string} */ (tag) });
  }
  return out;
}

/**
 * The PICK: one row, eligible and affordable, or nothing. The dialog keeps the pick legal as it
 * is made (a tick greys the rest); this is the arithmetic behind it.
 * @param {{menu: ReturnType<typeof metamagicMenu>, chosen?: string|null}} args
 */
export function metamagicPick({ menu, chosen = null }) {
  if ( !chosen ) return null;
  const row = menu.find(r => r.key === chosen);
  return (row && row.eligible && row.affordable) ? row : null;
}

/**
 * The option's rule, read off the feat's own description (law 8) with the pack's cost line
 * dropped — the cost is the row's tag, not the quote — and the tags stripped.
 * @param {string} html
 */
export function metamagicRuleText(html) {
  const text = String(html ?? "")
    .replace(/<blockquote>[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    // The pack's live lookups go, and the phrase that framed one with them ("minimum of one, currently [[lookup …]]").
    .replace(/,?\s*currently\s*\[\[\/?lookup[^\]]*\]\]/gi, "")
    .replace(/\[\[\/?lookup[^\]]*\]\]/g, "")
    .replace(/\s+/g, " ").trim();
  return text.replace(/^Cost:\s*\d+\s*Sorcery Points?\s*/i, "").trim();
}

/**
 * The line the spell's card carries after the press — source, then result (law 6).
 * @param {{key: string, feature: string, rangeFeet?: number|null, protected?: {name: string}[], target?: {name: string}|null, type?: string|null}} record
 */
export function metamagicCardLine(record) {
  const name = record?.feature ?? "Metamagic";
  switch ( record?.key ) {
    case "subtle": return `${name} — cast without components`;
    case "quickened": return `${name} — a Bonus Action this casting`;
    case "distant": return `${name} — range ${record.rangeFeet ?? "doubled"}${record.rangeFeet ? " ft" : ""} this casting`;
    case "careful": {
      const names = (record.protected ?? []).map(p => p.name).filter(Boolean);
      return names.length ? `${name} — ${names.join(", ")} protected: no save, no damage` : `${name} — nobody to protect`;
    }
    case "heightened": return record.target?.name ? `${name} — ${record.target.name} saves with Disadvantage` : `${name} — no target marked`;
    case "extended": return `${name} — duration doubled; concentration saves with Advantage`;
    case "transmuted": return record.type ? `${name} — the damage is ${record.type}` : `${name}`;
    case "twinned": return `${name} — one more target, the cast one level higher for targets`;
    default: return name;
  }
}

/**
 * TWINNED SPELL'S FIT, read off the data after all (measured 2026-09-09, Stage 3): a spell that
 * gains a target at a higher slot level carries its target count as a FORMULA over the cast's
 * level in the pack's source (`@item.level - 1` on Hold Person and Charm Person); a fixed count
 * (Magic Missile's darts), a blank one (an attack spell) or a template are not it.
 * @param {string|number|null|undefined} countFormula the item's SOURCE `target.affects.count`
 * @param {{name?: string|null, exceptions?: {except?: readonly string[], also?: readonly string[]}|null}} [opts]
 *        the spell's name and the table's exceptions (registry.js TWINNED_EXCEPTIONS): `also` fits
 *        regardless of the data, `except` never fits
 */
export function scalesTargetsFrom(countFormula, { name = null, exceptions = null } = {}) {
  const lower = s => String(s ?? "").toLowerCase();
  if ( name && (exceptions?.also ?? []).some(n => lower(n) === lower(name)) ) return true;
  if ( name && (exceptions?.except ?? []).some(n => lower(n) === lower(name)) ) return false;
  const f = String(countFormula ?? "");
  return /@item\.level|@scaling/.test(f);
}

/**
 * EXTENDED SPELL'S ARITHMETIC: the duration doubled, to a maximum of 24 hours (the option's own
 * words). Seconds cap at 86,400; rounds and turns double as they are (a combat clock has no
 * hours to cap against). A duration with nothing on it stays as it is.
 * @param {{seconds?: number|null, rounds?: number|null, turns?: number|null}} duration
 * @returns {{seconds?: number, rounds?: number, turns?: number}} the fields that changed
 */
export function extendedDuration(duration) {
  const out = {};
  const seconds = Number(duration?.seconds);
  if ( Number.isFinite(seconds) && (seconds > 0) ) out.seconds = Math.min(86400, seconds * 2);
  const rounds = Number(duration?.rounds);
  if ( Number.isFinite(rounds) && (rounds > 0) ) out.rounds = rounds * 2;
  const turns = Number(duration?.turns);
  if ( Number.isFinite(turns) && (turns > 0) ) out.turns = turns * 2;
  return out;
}

/**
 * Is this roll one Empowered Spell reaches? "When you roll damage for a spell" — damage, so never a
 * spell's HEALING (dnd5e rolls a heal through the same damage roll; the walk, 2026-09-26: Cure Wounds
 * was offered Empowered beside Healer's reroll). A heal activity, or rolls that are all healing or
 * temporary Hit Points, is out.
 * @param {{activityType?: string|null, rollTypes?: (string|null|undefined)[]}} facts
 */
export function empoweredReaches({ activityType = null, rollTypes = [] } = {}) {
  if ( activityType === "heal" ) return false;
  const types = (rollTypes ?? []).filter(Boolean);
  return !(types.length && types.every(t => (t === "healing") || (t === "temphp")));
}

/**
 * EMPOWERED SPELL'S PICK (Stage 4, 2026-09-09): the dice the caster ticked, up to the cap (the
 * Charisma modifier, minimum one), each found among the dice the roll showed. A key is
 * `roll:term:index` — the die's place in the message's rolls.
 * @param {{dice: {key: string, faces: number, result: number}[], picks: string[], cap: number}} args
 */
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
 * The arithmetic of the reroll: the new total is the old one moved by every die's change, and the
 * sentence the card says — the old faces, an arrow, the new, then the totals.
 * @param {{oldTotal: number, picks: {old: number, new: number}[]}} args
 */
export function empoweredOutcome({ oldTotal, picks }) {
  const delta = (picks ?? []).reduce((sum, p) => sum + ((Number(p.new) || 0) - (Number(p.old) || 0)), 0);
  const newTotal = (Number(oldTotal) || 0) + delta;
  const line = `${(picks ?? []).map(p => p.old).join(", ")} → ${(picks ?? []).map(p => p.new).join(", ")} · ${oldTotal} → ${newTotal}`;
  return { delta, newTotal, line };
}

/**
 * Distant Spell's arithmetic: a Touch spell reaches 30 feet; any other range is doubled.
 * @param {SpellFacts} facts
 * @returns {number|null}
 */
export function distantRange(facts) {
  if ( facts?.touch ) return 30;
  const feet = Number(facts?.rangeFeet);
  return (Number.isFinite(feet) && (feet >= 5)) ? feet * 2 : null;
}
