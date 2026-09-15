/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE EFFECT VIEW's rows — what a creature's
 * effects LOOK like as a list, from plain facts.
 *
 * DESIGN §6 (user ruling 2026-09-15): buffs and debuffs, visible on demand, the icon-less ones
 * included; never actions. The edge (effect-view.js) reads the sheet and draws; this file decides
 * which effects are listed, what each row says, and how it is toned.
 *
 * ⚠ DRAFT HEURISTICS (2026-09-15, on the branch) — two calls the user has not ruled:
 *   - TONE: a platform condition (the effect carries a status) or one of the module's own marks
 *     on a victim (Vexed, Sapped, Slowed) is a DEBUFF; everything else temporary is shown as a
 *     BUFF. Hunter's Mark on a target is the case this gets wrong — no status, not a module mark,
 *     yet a debuff. A data rule (a list, R4) is the honest fix if the user wants it right.
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
 */

/*
 * @typedef {object} EffectRow
 * @property {string} id
 * @property {string} name
 * @property {string|null} img
 * @property {"buff"|"debuff"} tone
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

/** @param {EffectFact} fact @returns {"buff"|"debuff"} */
export function toneOf(fact) {
  if ( (fact.statuses ?? []).length ) return "debuff";
  if ( fact.chipKey && MARK_KEYS.includes(fact.chipKey) ) return "debuff";
  return "buff";
}

/** @param {EffectFact[]} facts @returns {EffectRow[]} debuffs first, then buffs, each in sheet order */
export function effectRows(facts) {
  const rows = (facts ?? []).filter(listed).map(f => ({
    id: f.id, name: f.name, img: f.img ?? null, onItem: f.worn === true || f.onItem === true,
    tone: toneOf(f), clock: f.clock ?? "",
    noIcon: f.temporary !== true && !(f.statuses ?? []).length
  }));
  return [...rows.filter(r => r.tone === "debuff"), ...rows.filter(r => r.tone === "buff")];
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
