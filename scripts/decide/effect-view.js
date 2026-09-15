/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE EFFECT VIEW's rows — what a creature's
 * effects LOOK like as a list, from plain facts.
 *
 * DESIGN §6 (user ruling 2026-09-15): buffs and debuffs, visible on demand, the icon-less ones
 * included; never actions. The edge (effect-view.js) reads the sheet and draws; this file decides
 * which effects are listed, what each row says, and how it is toned.
 *
 * ⚠ DRAFT HEURISTICS (2026-09-15, on the branch) — two calls the user has not ruled:
 *   - TONE: ruled 2026-09-15 as a PATTERN, not a list (`toneOf` below): a condition or a module
 *     mark; else what the effect's CHANGES do to the numbers (a penalty is a debuff); else who
 *     put it there (an enemy's is a debuff); else a buff. Found on the Miasma's "Damaged: −2 AC".
 *   - NO ICON: measured on the sandbox 2026-09-15 (Foundry 14.365): the token paints an icon for
 *     a CLOCKED effect (Bless, a mastery mark) and for a condition (Prone); an applied effect with
 *     no clock (Death Armor, Healed by Prayer) paints nothing. Those are the rows tagged.
 *
 * Pure: no Foundry, no documents, no settings.
 */

/** The module's marks that sit on a VICTIM — debuffs by nature. */
export const MARK_KEYS = Object.freeze(["vex", "sap", "slow"]);

/*
 * One effect, as the edge read it off the sheet.
 * @typedef {object} EffectFact
 * @property {string} id
 * @property {string} name
 * @property {string|null} img
 * @property {boolean} active        core's `active` — not disabled, not suppressed
 * @property {boolean} temporary     core's `isTemporary` — has a clock (measured 2026-09-15 on Foundry 14.365: a bare status does NOT count)
 * @property {boolean} worn          a transfer effect from an item on the sheet — worn gear, a passive
 * @property {string[]} statuses     the condition ids it carries
 * @property {string|null} chipKey   `flags.<module>.mastery` when it is one of the module's chips
 * @property {string} clock          the platform's duration label ("2 Rounds", "Unlimited", "")
 * @property {string|null} origin    the effect's origin uuid, if any
 * @property {boolean} [onItem]      the effect document belongs to an item on the sheet, not the actor
 * @property {boolean} [disabled]    the sheet's own toggle is OFF (distinct from suppressed: `active` false with the toggle on)
 * @property {{key: string, mode: number, value: string|number}[]} [changes]  the effect's own changes
 * @property {boolean|null} [hostileOrigin]  the origin's creature stands on the other side from the bearer; null when unknown
 */

/*
 * @typedef {object} EffectRow
 * @property {string} id
 * @property {string} name
 * @property {string|null} img
 * @property {"buff"|"debuff"|"concentration"} tone
 * @property {string} clock
 * @property {string} [detail]      a value beside the name with no clock glyph (the sheet rows)
 * @property {boolean} noIcon       the token cannot show this one
 */

/**
 * Which effects are listed: the ACTIVE ones that are a clocked effect, a condition, or an effect
 * APPLIED to the creature (a cast's — Death Armor, Bless, Hunter's Mark); never a worn item's
 * transfer effect (the Cloak's +1, a passive). Measured 2026-09-15: Death Armor sits on the
 * sheet with no clock and Prone with no clock either, and both are exactly what the view is for.
 */
export function listed(fact) {
  if ( !fact || fact.active !== true ) return false;
  return fact.temporary === true || (fact.statuses ?? []).length > 0 || fact.worn !== true;
}

/** Foundry's ActiveEffect change modes, by number — the decision layer imports nothing. */
const MODE = Object.freeze({ CUSTOM: 0, MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 });

/**
 * What one change does to the creature: a penalty, a bonus, or nothing readable.
 * A penalty is a subtraction (ADD of a negative number), a halving (MULTIPLY below one), a
 * DOWNGRADE, or a disadvantage flag. A bonus is the mirror. OVERRIDE and CUSTOM say nothing.
 * @param {{key?: string, mode?: number, value?: string|number}} change
 * @returns {"penalty"|"bonus"|null}
 */
export function changeSign(change) {
  if ( !change ) return null;
  const key = String(change.key ?? "").toLowerCase();
  if ( /disadvantage/.test(key) ) return "penalty";
  if ( /advantage/.test(key) ) return "bonus";
  const mode = Number(change.mode);
  if ( mode === MODE.DOWNGRADE ) return "penalty";
  if ( mode === MODE.UPGRADE ) return "bonus";
  const n = Number(String(change.value ?? "").trim());
  if ( !Number.isFinite(n) ) return null;
  if ( mode === MODE.ADD ) return n < 0 ? "penalty" : (n > 0 ? "bonus" : null);
  if ( mode === MODE.MULTIPLY ) return n < 1 ? "penalty" : (n > 1 ? "bonus" : null);
  return null;
}

/**
 * THE TONE (user, 2026-09-15, the Miasma's "Damaged: −2 AC" drawn green: "look for the pattern to
 * fix this, so it catches other cases"). Four signals, in order:
 *   1. a condition (a status) is a debuff; one of the module's marks on a victim is a debuff;
 *   2. the effect's own CHANGES — any penalty (a subtraction, a halving, a downgrade, a
 *      disadvantage flag) makes it a debuff, else any bonus makes it a buff. A penalty outranks
 *      a bonus when both appear: a thing that costs you is worth the red;
 *   3. WHO PUT IT THERE — an effect whose origin is a creature on the other side (hostile to the
 *      bearer) is a debuff; a marker with no readable change, like Hunter's Mark on the target,
 *      lands here;
 *   4. else a buff — the effect's own cast, an ally's, a worn thing.
 * @param {EffectFact} fact @returns {"buff"|"debuff"}
 */
export function toneOf(fact) {
  // Concentration first (user, 2026-09-15: "a special mechanic frequently used, so lets make that
  // yellow"): dnd5e's own concentration effect carries the `concentrating` status.
  if ( (fact.statuses ?? []).includes("concentrating") ) return "concentration";
  if ( (fact.statuses ?? []).length ) return "debuff";
  if ( fact.chipKey && MARK_KEYS.includes(fact.chipKey) ) return "debuff";
  const signs = (fact.changes ?? []).map(changeSign).filter(Boolean);
  if ( signs.includes("penalty") ) return "debuff";
  if ( signs.includes("bonus") ) return "buff";
  if ( fact.hostileOrigin === true ) return "debuff";
  return "buff";
}

/** @param {EffectFact[]} facts @returns {EffectRow[]} debuffs first, then buffs, each in sheet order */
export function effectRows(facts) {
  const rows = (facts ?? []).filter(listed).map(rowOf);
  // concentration leads (the thing a hit can break), then the debuffs, then the buffs
  return ["concentration", "debuff", "buff"].flatMap(tone => rows.filter(r => r.tone === tone));
}

/**
 * THE SHEET ROWS (user, 2026-09-15: "temp hps would be a good buff ... its not listed in effects tho"):
 * two buffs dnd5e keeps as NUMBERS on the sheet, never as effects — Temporary HP and Heroic
 * Inspiration. Read off the sheet, listed as buffs with no clock and no source (the sheet does not
 * record where the temp HP came from, so the row says only what the sheet says). Not effects, so
 * the no-icon tag does not apply to them.
 * @param {{tempHp?: number|null, inspiration?: boolean}} sheet
 * @returns {EffectRow[]}
 */
export function sheetRows({ tempHp = null, inspiration = false } = {}) {
  const rows = [];
  if ( Number.isFinite(tempHp) && tempHp > 0 ) rows.push({ id: "sheet:tempHp", name: "Temporary HP", img: "icons/svg/regen.svg", tone: "buff", clock: "", detail: String(tempHp), noIcon: false });
  if ( inspiration === true ) rows.push({ id: "sheet:inspiration", name: "Heroic Inspiration", img: "icons/svg/sun.svg", tone: "buff", clock: "", detail: "", noIcon: false });
  return rows;
}

/**
 * THE ACTION a row offers on the bar (user ruling 2026-09-15: click a buff, a fold opens with
 * Remove, and the DM has it for any creature). What "remove" means depends on where the row lives:
 *   remove   an effect that sits on the creature — deleted
 *   disable  an effect that belongs to an item on the sheet (a worn thing's condition) — turned
 *            off, never deleted, because deleting it would edit the item
 *   clear    a sheet row — the number set back to nothing (temp HP 0, inspiration off)
 * Null when the viewer cannot write to the creature: the fold never opens.
 * @param {{id: string, onItem?: boolean}} row
 * @param {{owner: boolean}} viewer
 * @returns {{action: "remove"|"disable"|"clear", label: string}|null}
 */
export function rowAction(row, { owner }) {
  if ( !owner || !row ) return null;
  if ( String(row.id).startsWith("sheet:") ) return { action: "clear", label: "Clear" };
  if ( row.onItem === true ) return { action: "disable", label: "Disable" };
  return { action: "remove", label: "Remove" };
}

/** One row from one fact, no listing test — the panel's groups and the bar share this shape. */
function rowOf(f) {
  return {
    id: f.id, name: f.name, img: f.img ?? null, onItem: f.worn === true || f.onItem === true,
    tone: toneOf(f), clock: f.clock ?? "",
    noIcon: f.temporary !== true && !(f.statuses ?? []).length
  };
}

/**
 * THE PANEL'S GROUPS (user ruling 2026-09-15: "if i click morgash, it should show ALL, including
 * passives"): the name's panel mirrors the SHEET's own sections, not the bar's rule —
 *   Temporary    active, with a clock or a condition
 *   Passive      active, clockless — the worn gear, the class features, the applied clockless
 *                casts the bar also shows (Death Armor)
 *   Unavailable  enabled but SUPPRESSED by the platform — the item unequipped or unattuned, or the
 *                clock expired and the leftover never swept (the user, on the Luckstone and the
 *                Miasma's −2 AC) — listed so the GM can sweep it; never a disabled one, that is a
 *                choice the sheet already shows as off
 * The sheet rows (temp HP, inspiration) join Temporary. Empty groups are dropped.
 * @param {EffectFact[]} facts
 * @param {{tempHp?: number|null, inspiration?: boolean}} [sheet]
 * @returns {{label: string, rows: EffectRow[]}[]}
 */
export function panelGroups(facts, sheet = {}) {
  const temporary = [], passive = [], unavailable = [];
  for ( const f of (facts ?? []) ) {
    if ( !f ) continue;
    if ( f.active === true ) ((f.temporary === true) || (f.statuses ?? []).length ? temporary : passive).push(rowOf(f));
    else if ( f.disabled !== true ) unavailable.push({ ...rowOf(f), unavailable: true });
  }
  temporary.push(...sheetRows(sheet));
  return [
    { label: "Temporary", rows: temporary },
    { label: "Passive", rows: passive },
    { label: "Unavailable", rows: unavailable }
  ].filter(g => g.rows.length);
}

/** Every row the panel can show, flat — the lookup behind a fold on any chip. */
export function everyRow(facts, sheet = {}) {
  return panelGroups(facts, sheet).flatMap(g => g.rows);
}

/** Every row for one creature: the effects (debuffs, then buffs), then the sheet's own buffs. */
export function allRows(facts, sheet) {
  return [...effectRows(facts), ...sheetRows(sheet)];
}

/**
 * The marks a creature HOLDS on others (question 2, drafted IN as a second group): an effect on
 * another creature whose origin is this creature or one of its items.
 * @param {string} holderUuid
 * @param {{bearer: string, fact: EffectFact}[]} others  effects on OTHER creatures, with the bearer's name
 * @returns {(EffectRow & {bearer: string})[]}
 */
export function marksHeldBy(holderUuid, others) {
  if ( !holderUuid ) return [];
  return (others ?? [])
    .filter(({ fact }) => listed(fact) && typeof fact.origin === "string" && fact.origin.startsWith(holderUuid))
    .map(({ bearer, fact }) => ({ ...effectRows([fact])[0], bearer }));
}
