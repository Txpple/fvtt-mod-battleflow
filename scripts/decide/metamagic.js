// @ts-check
/**
 * Battle Flow — DECISION: metamagic (RULINGS *Metamagic*). Which options the cast dialog offers
 * for THIS spell, which the points can pay for, whether a pick is legal, and what the card says
 * after. Pure functions over plain data (ARCHITECTURE.md §2). The reading and the arithmetic,
 * never the choice; the ask at the area lives in decide/area-ask.js.
 */

/** The flag the cast's card carries: `{ key, feature, cost, ... }` (metamagic.js writes it). */
export const METAMAGIC_FLAG = "metamagic";
/**
 * The named predicates a registry row's `when` resolves to, over the facts of the spell being
 * cast. Unknown names fit nothing.
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
 * A row's `unless`: a spell its WHEN admits but where the option does nothing — Careful Spell on a
 * spell whose caster already chooses its targets.
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
  if ( !test?.(facts ?? {}, transmutedTypes) ) return false;
  const not = UNLESS[row?.unless];
  return !not?.(facts ?? {});
}

/** Why a row the spell does not fit greys — its WHEN's reason, else its UNLESS's. */
function whyNot(row, facts, transmutedTypes) {
  const test = WHEN[row?.when];
  if ( !test?.(facts ?? {}, transmutedTypes) ) return WHY[row?.when] ?? "does not fit this spell";
  return WHY_UNLESS[row?.unless] ?? "does not fit this spell";
}

/**
 * The rows of the cast dialog's group, in table order: every listed option the sheet grants whose
 * moment is `cast`, with its fit and affordability.
 *
 *
 * @param {{table: Readonly<Record<string, any>>, listed: Iterable<string>, known: Iterable<string>,
 *          facts: SpellFacts, points: number, costs: Record<string, number>,
 *          transmutedTypes?: readonly string[], moment?: string}} args
 *        `listed` = the Metamagic list's names; `known` = the feat names on the sheet;
 *        `costs` = per feat, the consumption value read off the sheet (unreadable = unaffordable,
 *        never free)
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
 * The PICK: one row, eligible and affordable, or nothing.
 * @param {{menu: ReturnType<typeof metamagicMenu>, chosen?: string|null}} args
 */
export function metamagicPick({ menu, chosen = null }) {
  if ( !chosen ) return null;
  const row = menu.find(r => r.key === chosen);
  return (row?.eligible && row.affordable) ? row : null;
}

/**
 * The option's rule, read off the feat's own description, the pack's cost line dropped (the cost
 * is the row's tag) and the tags stripped.
 * @param {string} html
 */
export function metamagicRuleText(html) {
  const text = String(html ?? "")
    .replace(/<blockquote>[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    // The pack's live lookups go, with the phrase that framed one ("currently [[lookup …]]").
    .replace(/,?\s*currently\s*\[\[\/?lookup[^\]]*\]\]/gi, "")
    .replace(/\[\[\/?lookup[^\]]*\]\]/g, "")
    .replace(/\s+/g, " ").trim();
  return text.replace(/^Cost:\s*\d+\s*Sorcery Points?\s*/i, "").trim();
}

/**
 * The line the spell's card carries after the press — source, then result.
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
 * Twinned Spell's fit, read off the data: a spell that gains a target at a higher level carries
 * its target count as a FORMULA over the cast's level (`@item.level - 1`); a fixed count, a blank
 * one or a template does not.
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
 * Extended Spell: the duration doubled, to a maximum of 24 hours. Rounds and turns double as they
 * are; an empty duration stays.
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
 * Does Empowered Spell reach this roll? Damage only — dnd5e rolls healing through the same damage
 * roll, so a heal activity, or rolls all healing or temp HP, is out.
 * @param {{activityType?: string|null, rollTypes?: (string|null|undefined)[]}} facts
 */
export function empoweredReaches({ activityType = null, rollTypes = [] } = {}) {
  if ( activityType === "heal" ) return false;
  const types = (rollTypes ?? []).filter(Boolean);
  return !(types.length && types.every(t => (t === "healing") || (t === "temphp")));
}

/**
 * The reroll's arithmetic: the old total moved by every die's change, and the card's sentence.
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
