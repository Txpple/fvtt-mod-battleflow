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
 * the pool can pay for, and whether the pick stands.
 */

/** The flag the cast's card carries: `{ key, feature, cost, ... }` (metamagic.js writes it). */
export const METAMAGIC_FLAG = "metamagic";
/** The ask at the area — who the spell spares, or who saves at Disadvantage — raised by the demand, answered by metamagic.js. */
export const METAMAGIC_ASK_FLAG = "metamagicAsk";
/**
 * A spell that chooses its targets: who its area affects, on the spell's card — `{ spell, chosen,
 * left, asked, cap }` (the saves machine's, the demand's reach; the ask's answer writes it too).
 */
export const AREA_CHOICE_FLAG = "areaChoice";

/**
 * The ask's defaults, from its own facts: Careful's non-hostiles up to the cap, Heightened's
 * nearest hostile — the same arithmetic the cast would have used silently.
 * @param {{kind: string, candidates: {uuid: string, name: string, disposition?: number|null}[], casterUuid: string|null, casterDisposition: number|null, cap?: number}} ask
 * @returns {{uuid: string, name: string}[]}
 */
export function askDefaults(ask) {
  const facts = { contained: ask?.candidates ?? [], casterUuid: ask?.casterUuid ?? null, casterDisposition: ask?.casterDisposition ?? null };
  if ( ask?.kind === "careful" ) return carefulProtects({ ...facts, cap: ask.cap ?? 1 });
  if ( ask?.kind === "choose" ) return chosenByDefault({ candidates: facts.contained, casterUuid: facts.casterUuid, casterDisposition: facts.casterDisposition, cap: ask.cap ?? null });
  const mark = heightenedMark(facts);
  return mark ? [mark] : [];
}

/**
 * The merged ask's Disadvantage mark (a spell that chooses, cast with Heightened Spell — one
 * popup, 2026-09-24): the player's radio when it names a creature they also chose, else
 * Heightened's own default over the chosen.
 * @param {{candidates: {uuid: string, name: string, disposition?: number|null}[], casterUuid: string|null, casterDisposition: number|null}} ask
 * @param {string[]} chosenUuids
 * @param {string|null} [picked]
 */
export function askMark(ask, chosenUuids, picked = null) {
  const chosen = new Set(chosenUuids ?? []);
  const among = (ask?.candidates ?? []).filter(c => chosen.has(c.uuid));
  return heightenedMark({ contained: among, casterUuid: ask?.casterUuid ?? null, casterDisposition: ask?.casterDisposition ?? null,
    chosen: (picked && chosen.has(picked)) ? picked : null });
}

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
 * CAREFUL SPELL'S PROTECTED LIST (user ruling 2026-09-09, decision 1: "default"): the caster's
 * ALLIES among the creatures the save reaches — the caster first, then the rest in the order the
 * area found them — up to the cap (the Charisma modifier, minimum one). When the player has
 * ADJUSTED the list (`chosen`, uuids), the chosen creatures that the save still reaches stand
 * instead, capped the same way. Sight and willingness are never judged.
 * @param {{contained: {uuid: string, name: string, disposition?: number|null}[], casterUuid: string|null,
 *          casterDisposition: number|null, cap: number, chosen?: string[]|null}} args
 * @returns {{uuid: string, name: string}[]}
 */
export function carefulProtects({ contained, casterUuid = null, casterDisposition = null, cap, chosen = null }) {
  const limit = Math.max(1, Number(cap) || 1);
  const list = Array.isArray(contained) ? contained : [];
  const entry = c => ({ uuid: c.uuid, name: c.name });
  if ( Array.isArray(chosen) ) {
    // In the order the player ticked them, among what the save still reaches.
    return chosen.map(uuid => list.find(c => c.uuid === uuid)).filter(Boolean).slice(0, limit).map(entry);
  }
  // NON-HOSTILE by default (user ruling 2026-09-09, second look: "neutral and allies"): every
  // creature that is not on the side opposed to the caster's — the caster first, then the
  // caster's own side, then the neutrals, each group in the order the list came (nearest first
  // where the window built it). A secret token is nobody's to protect.
  const hostile = (casterDisposition === 1) ? -1 : (casterDisposition === -1) ? 1 : null;
  // The PARTY first (user, 2026-09-09: "party members default check yes to the extent allowed"),
  // then the caster's own side, then the neutrals — the caster ahead of all.
  const rank = c => (c.uuid === casterUuid) ? 0 : c.party ? 1 : (c.disposition === casterDisposition) ? 2 : 3;
  const friends = list.filter(c => (c.uuid === casterUuid)
    || ((c.disposition !== undefined) && (c.disposition !== null) && (c.disposition !== -2) && (c.disposition !== hostile)));
  friends.sort((a, b) => rank(a) - rank(b));
  return friends.slice(0, limit).map(entry);
}

/**
 * HEIGHTENED SPELL'S MARK: one target of the spell whose saves against it are at Disadvantage —
 * the player's pick when made (`chosen`), else the FIRST creature the save reaches that is not
 * the caster's ally (an enemy of the caster's side; a neutral when no enemy stands there).
 * @param {{contained: {uuid: string, name: string, disposition?: number|null}[], casterUuid: string|null,
 *          casterDisposition: number|null, chosen?: string|null}} args
 * @returns {{uuid: string, name: string}|null}
 */
export function heightenedMark({ contained, casterUuid = null, casterDisposition = null, chosen = null }) {
  const list = Array.isArray(contained) ? contained : [];
  const entry = c => ({ uuid: c.uuid, name: c.name });
  if ( chosen ) { const c = list.find(x => x.uuid === chosen); return c ? entry(c) : null; }
  const others = list.filter(c => (c.uuid !== casterUuid) && ((casterDisposition === null) || (c.disposition !== casterDisposition)));
  const enemy = others.find(c => (casterDisposition !== null) && (c.disposition === -casterDisposition));
  const pick = enemy ?? others[0] ?? null;
  return pick ? entry(pick) : null;
}

/* ---------------------------------------------------------------------------------------------
 * THE ASK AT THE AREA, ITS THIRD KIND — A SPELL THAT CHOOSES (user, 2026-09-24, Session 8: Gren's
 * Slow asked Invictus, inside the cube, for a Wisdom save; ruled off the prototype *Creatures of
 * Your Choice*). Slow reads "up to six creatures of your choice in a 40-foot Cube": the area is
 * where the choice is made, never who owes the save. A listed spell (the Chosen Areas list,
 * registry.js CHOSEN_AREAS) asks its caster WHO IT AFFECTS once the area lands — the hostiles
 * ticked, up to the spell's own number — and only when there is a real choice to make.
 *
 * ⚠ The ask is metamagic's machinery (the popup, the clock, the answer, the held card) with a
 * third kind, not a copy of it; metamagic.js owns the ask and the saves machine raises it. It
 * stays there until a third customer proves a shape of its own (the house lesson — BACKLOG
 * *The two sideways edges*: a seam is built by the feature that proves it).
 * ------------------------------------------------------------------------------------------- */

const NUMBER_WORDS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 });

/**
 * A spell's text as the table reads it: the markup gone, an enricher reduced to its label
 * (`&Reference[incapacitated]{Incapacitated}` → Incapacitated; an inline roll → its label or nothing).
 * @param {string} html
 */
export function spellProse(html) {
  return String(html ?? "")
    .replace(/<section class="secret"[\s\S]*?<\/section>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/\[\[[^\]]*\]\](?:\{([^}]*)\})?/g, (m, label) => label ?? "")
    .replace(/[@&]\w+\[([^\]\s]+)[^\]]*\](?:\{([^}]*)\})?/g, (m, key, label) => label ?? key)
    .replace(/\s+/g, " ").trim();
}

/**
 * How many creatures a spell that chooses may choose — its own number ("up to six creatures of
 * your choice"), or null when the text sets none (Sleep: "each creature of your choice"). N1: the
 * number is the content's, read where it is written, never copied into a table.
 * @param {string} html the spell's description
 */
export function choiceCapFrom(html) {
  const word = spellProse(html).match(/\bup to (\w+) (?:creatures?|targets?) of (?:your|its|their) choice/i)?.[1] ?? "";
  if ( !word ) return null;
  const n = Number(/^\d+$/.test(word) ? word : (/** @type {Record<string, number>} */ (NUMBER_WORDS))[word.toLowerCase()]);
  return (Number.isFinite(n) && (n > 0)) ? n : null;
}

/**
 * The sentence that grants the choice — the popup's quote, in the spell's own words (law 8).
 * @param {string} html the spell's description
 * @returns {string|null}
 */
export function choiceRuleFrom(html) {
  const text = spellProse(html);
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const found = sentences.find(s => /\b(?:of (?:your|its|their) choice|you choose)\b/i.test(s));
  return found ? found.trim() : null;
}

/** The disposition hostile to a caster's side — null for a caster with none (neutral, secret). */
const hostileTo = d => (d === 1) ? -1 : (d === -1) ? 1 : null;

/**
 * WHO A SPELL THAT CHOOSES AFFECTS BY DEFAULT (user, 2026-09-24): the creatures hostile to the
 * caster, in the order the area found them, up to the spell's own number — never the caster,
 * the caster's own side, a neutral or a secret token. The clock keeps this; so does a cast with
 * no choice to make.
 * @param {{candidates: {uuid: string, name: string, disposition?: number|null}[], casterUuid?: string|null,
 *          casterDisposition?: number|null, cap?: number|null}} args
 * @returns {{uuid: string, name: string}[]}
 */
export function chosenByDefault({ candidates, casterUuid = null, casterDisposition = null, cap = null }) {
  const hostile = hostileTo(casterDisposition);
  const list = (Array.isArray(candidates) ? candidates : []).filter(c => c.uuid !== casterUuid);
  const picked = (hostile === null) ? [] : list.filter(c => c.disposition === hostile);
  const limit = (Number(cap) > 0) ? Number(cap) : Infinity;
  return picked.slice(0, limit).map(c => ({ uuid: c.uuid, name: c.name }));
}

/**
 * IS THERE A CHOICE TO MAKE? (user ruling 2026-09-24: ask "only when there's a real choice") —
 * the area holds someone who is not hostile to the caster, or more hostiles than the spell lets
 * the caster choose. Otherwise the default IS the answer and nobody is asked.
 * @param {{candidates: {uuid: string, disposition?: number|null}[], casterUuid?: string|null,
 *          casterDisposition?: number|null, cap?: number|null}} args
 */
export function choiceNeedsAsk({ candidates, casterUuid = null, casterDisposition = null, cap = null }) {
  const list = (Array.isArray(candidates) ? candidates : []).filter(c => c.uuid !== casterUuid);
  if ( !list.length ) return false;
  const hostile = hostileTo(casterDisposition);
  const hostiles = (hostile === null) ? [] : list.filter(c => c.disposition === hostile);
  if ( hostiles.length !== list.length ) return true;
  return (Number(cap) > 0) && (hostiles.length > Number(cap));
}

/**
 * The line the spell's card carries once the choice stands — source, then result (law 6).
 * @param {{spell?: string|null, chosen?: {name: string}[], left?: {name: string}[]}} record
 */
export function areaChoiceLine(record) {
  const spell = record?.spell ?? "The spell";
  const chosen = (record?.chosen ?? []).map(c => c.name).filter(Boolean);
  const left = (record?.left ?? []).map(c => c.name).filter(Boolean);
  const head = chosen.length ? `${spell} — chosen: ${chosen.join(", ")}` : `${spell} — nobody chosen`;
  return left.length ? `${head} · not chosen: ${left.join(", ")}` : head;
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
