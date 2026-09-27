/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE EFFECT VIEW's rows — what a creature's effects
 * LOOK like as a list, from plain facts (RULINGS *The effect view*). The edge (effect-view.js)
 * reads the sheet and draws; this file decides which effects are listed, what each row says, and
 * how it is toned. ⚠ The token paints an icon only for a CLOCKED effect or a condition — an applied
 * clockless effect (Death Armor) paints nothing; those rows are tagged no-icon.
 * Pure: no Foundry, no documents, no settings.
 */

/** The module's marks that sit on a VICTIM — debuffs by nature. */
export const MARK_KEYS = Object.freeze(["vex", "sap", "slow"]);

/** The statuses the module puts on its OWN effects as markers, never a condition (emanations.js: an aura's member copy). */
export const MARKER_STATUSES = Object.freeze(["bfEmanation"]);

/*
 * One effect, as the edge read it off the sheet.
 * @typedef {object} EffectFact
 * @property {string} id
 * @property {string} name
 * @property {string|null} img
 * @property {boolean} active        core's `active` — not disabled, not suppressed
 * @property {boolean} temporary     core's `isTemporary` — has a clock (a bare status does NOT count)
 * @property {boolean} worn          a transfer effect from an item on the sheet — worn gear, a passive
 * @property {boolean} [aura]        a worn effect that is the bearer's OWN standing aura — the pack's effect on a feature the emanation table names, while the module runs that row (Aura of Protection's "Protected" on the Paladin)
 * @property {string[]} statuses     the condition ids it carries
 * @property {string|null} chipKey   `flags.<module>.mastery` when it is one of the module's chips
 * @property {string} clock          the platform's duration label ("2 Rounds", "Unlimited", "")
 * @property {string|null} origin    the effect's origin uuid, if any
 * @property {boolean} [onItem]      the effect document belongs to an item on the sheet, not the actor
 * @property {boolean} [disabled]    the sheet's own toggle is OFF (distinct from suppressed: `active` false with the toggle on)
 * @property {boolean} [style]       a fighting style's FACE (fighting-styles.js) — a passive the module keeps off the equipped boxes; off means the module disabled it
 * @property {boolean} [feat]        a face kept for a general feat (Great Weapon Master, Heavy Armor Master) — titled by the feat alone
 * @property {string|null} [styleFeat]  the Fighting Style feat an item effect rides (Blind Fighting's senses) — titled by the feat
 * @property {string|null} [detail]  the face's long line — the hover title: what it reads when live, why when off
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
 * Which effects are listed: the ACTIVE ones that are clocked, a condition, or APPLIED to the
 * creature (Death Armor, Bless, Hunter's Mark); never a worn item's transfer effect (a passive).
 * ⚠ One worn effect IS in force: the bearer's own standing aura (the `aura` fact). The floor
 * (emanations.js) marks everyone else in the ring but never the bearer, so without this the one
 * creature radiating the aura would not show it.
 */
export function listed(fact) {
  if ( fact?.active !== true ) return false;
  return fact.temporary === true || (fact.statuses ?? []).length > 0 || fact.worn !== true || fact.aura === true;
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
 * THE TONE — a pattern, not a list. Four signals, in order:
 *   1. a condition (a status) or one of the module's marks on a victim is a debuff;
 *   2. the effect's own CHANGES — any penalty makes it a debuff (a penalty outranks a bonus),
 *      else any bonus a buff;
 *   3. WHO PUT IT THERE — an origin on the other side from the bearer is a debuff (Hunter's Mark);
 *   4. else a buff.
 * @param {EffectFact} fact @returns {"buff"|"debuff"}
 */
export function toneOf(fact) {
  // Concentration first, its own tone: dnd5e's concentration effect carries `concentrating`.
  if ( (fact.statuses ?? []).includes("concentrating") ) return "concentration";
  // A CONDITION is red; the module's own MARKER status (`bfEmanation`, worn so the token shows an
  // aura copy) is not one — its changes decide, like any effect's.
  if ( (fact.statuses ?? []).some(s => !MARKER_STATUSES.includes(s)) ) return "debuff";
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
 * THE SHEET ROWS: Temporary HP and Heroic Inspiration are buffs dnd5e keeps as NUMBERS, never as
 * effects — listed with no clock and no source (the sheet does not record one), never tagged no-icon.
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
 * THE ACTION a row offers on the bar, for any viewer who can write to the creature (else null):
 *   remove   an effect on the creature — deleted
 *   disable  an effect belonging to an item on the sheet — turned off, since deleting edits the item
 *   clear    a sheet row — the number set back to nothing (temp HP 0, inspiration off)
 * @param {{id: string, onItem?: boolean}} row
 * @param {{owner: boolean}} viewer
 * @returns {{action: "remove"|"disable"|"clear", label: string}|null}
 */
export function rowAction(row, { owner }) {
  if ( !owner || !row ) return null;
  if ( row.style === true ) return null;   // a fighting style's face follows the equipped boxes — nothing to fold
  if ( String(row.id).startsWith("sheet:") ) return { action: "clear", label: "Clear" };
  if ( row.onItem === true ) return { action: "disable", label: "Disable" };
  return { action: "remove", label: "Remove" };
}

/** One row from one fact, no listing test — the panel's groups and the bar share this shape. */
function rowOf(f) {
  return {
    id: f.id, onItem: f.worn === true || f.onItem === true,
    // a fighting style reads by its official feat name ("Fighting Style: …"), no suffix
    name: (f.style && f.feat) ? f.name : f.style ? `Fighting Style: ${f.name}` : f.styleFeat ? `Fighting Style: ${f.styleFeat}` : f.name,
    img: f.img ?? null, tone: toneOf(f), clock: f.clock ?? "",
    ...(f.style ? { style: true, why: f.detail ?? "" } : {}),
    noIcon: f.temporary !== true && !(f.statuses ?? []).length
  };
}

/**
 * THE PANEL'S GROUPS mirror the SHEET's own sections, not the bar's rule:
 *   Temporary    active, with a clock or a condition (plus the sheet rows)
 *   Passive      active, clockless — worn gear, class features, applied clockless casts
 *   Unavailable  enabled but SUPPRESSED (unequipped, unattuned, a clock expired and never swept) —
 *                listed so the GM can sweep it; a disabled one is the sheet's own choice, not listed
 * Empty groups are dropped.
 * @param {EffectFact[]} facts
 * @param {{tempHp?: number|null, inspiration?: boolean}} [sheet]
 * @returns {{label: string, rows: EffectRow[]}[]}
 */
export function panelGroups(facts, sheet = {}) {
  const temporary = [], passive = [], unavailable = [];
  for ( const f of (facts ?? []) ) {
    if ( !f ) continue;
    // the no-icon tag is for the in-force rows a token could be expected to show; a passive or a
    // suppressed effect never paints one, so the tag would say nothing there
    if ( f.active === true ) {
      if ( (f.temporary === true) || (f.statuses ?? []).length ) temporary.push(rowOf(f));
      else passive.push({ ...rowOf(f), noIcon: false });
    }
    // a fighting style's face that is off is DISABLED by the module, not by a choice — listed, with why
    else if ( (f.disabled !== true) || (f.style === true) ) unavailable.push({ ...rowOf(f), noIcon: false, unavailable: true });
  }
  temporary.push(...sheetRows(sheet));
  // concentration leads the Temporary group as it leads the bar
  const ordered = ["concentration", "debuff", "buff"].flatMap(tone => temporary.filter(r => r.tone === tone));
  temporary.splice(0, temporary.length, ...ordered);
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
 * The marks a creature HOLDS on others: an effect on another creature whose origin is this
 * creature or one of its items.
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
