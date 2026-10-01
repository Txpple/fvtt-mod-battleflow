// THE REGISTERS' SHARED READERS — what every generated register (the PHB spells', the DMG's) joins its
// corpus rows with: which registry table names a row, RULINGS' walk tables and bend registers, and a
// drawing's hand verdicts. Offline, pure; the generators (audit-spells-register.mjs, audit-dmg-register.mjs)
// own their rows, columns and defaults.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "../scripts/decide/registry.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const today = () => new Date().toISOString().slice(0, 10);
export const lower = s => String(s ?? "").toLowerCase();
/** A cell's text: pipes escaped, whitespace folded. */
export const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
export const readRulings = () => readFileSync(join(ROOT, "RULINGS.md"), "utf8");
export const readDrawing = name => readFileSync(join(ROOT, "audits", "drawings", name), "utf8");

/** Table → the machine file and the RULINGS section to read. */
export const WHERE = {
  EMANATIONS: ["emanations.js", "Emanations · The spells slice — Tier 3 · the held spells"],
  REPEAT_SAVES: ["repeat-saves.js", "The spells slice — Tiers 1 and 2"],
  TURN_GRANTS: ["turn-grants.js", "The spells slice — Tiers 1 and 2"],
  WARDS: ["wards.js", "The spells slice — Tier 3"],
  DUPLICATES: ["hold/", "The spells slice — Tier 3"],
  DAMAGE_SHARES: ["damage-shares.js", "The spells slice — the held spells"],
  HEAL_ON_HIT: ["heal-on-hit.js", "The spells slice — the held spells"],
  RAY_TABLES: ["prismatic.js", "The spells slice — the held spells"],
  EFFECT_BENDS: ["reminders.js", "The gate before the roll"],
  SAVE_PRESSES: ["saves/", "Rulings the code carried · Save demands"],
  HEAL_REROLLS: ["heal-rerolls.js · cast.js", "The spells slice — Tiers 1 and 2"],
  DAMAGE_SHIELDS: ["damage-shields.js", "Damage shields"],
  EFFECT_CHOICES: ["cast.js", "Effect choices"],
  REBUKES: ["rebukes.js", "A listed reaction cast freestanding · The PHB feats — groups 4–6"],
  DAMAGE_SAVES: ["damage-casts.js", "Damage casts"],
  DROP_TO_ONE: ["drop-to-one.js", "The species walk, continued"],
  TOKEN_LIGHTS: ["token-lights.js", "The species walk, continued"],
  TOKEN_SIZES: ["effect-riders.js", "The species walk, continued"],
  SPENT_AREAS: ["saves/areas.js", "Rulings the code carried · Save demands and their areas"],
  CHOSEN_AREAS: ["saves/demand.js", "Spells that choose their targets"],
  INTERRUPTS: ["hold/", "The reaction hold"],
  BLOCKS: ["hold/", "The reaction hold"],
  RIDERS: ["hit-riders.js", "Rulings the code carried"],
  TWINNED_EXCEPTIONS: ["metamagic.js", "Metamagic"],
  CLOCK_RIDERS: ["clock-riders.js", "Rulings the code carried · The hit's sequence"],
  COATINGS: ["use-chips.js", "Bent by choice — the rule of cool"],
  D20_FLOORS: ["d20-folds.js", "The PHB classes — D1"],
  REROLLS: ["d20-folds.js", "The PHB classes — B1"],
  HEAL_BLOCKS: ["heal-on-hit.js", "The DMG — the crit riders and the enchanted weapons"],
  USE_CHIPS: ["use-chips.js", "The gate before the roll"],
  DAMAGE_RULES: ["damage-rules.js", "The fighting styles"],
  EVASIONS: ["saves/consequences.js", "The GM's side — the five shapes"],
  SAVE_SUCCEEDS: ["saves/", "The PHB feats — groups 4–6"],
  REACTION_RESETS: ["decide/chips.js", "The GM's side — the reaction rows"],
  INTERRUPT_REDUCTIONS: ["hold/", "The reaction hold"],
  INTERRUPT_ROLLS: ["hold/", "The reaction hold"],
  INTERRUPT_MULTIPLIERS: ["hold/", "The reaction hold"],
  REST_GRANTS: ["rest-grants.js", "The PHB feats — groups 1–3"],
  DRAINS: ["drains.js", "The Monster Manual — the waiting rows built"]
};

/** How a table's mention reads in a register cell. */
export const whereCell = tables => tables.map(t => `\`${t}\` (${WHERE[t]?.[0] ?? "?"}; RULINGS *${WHERE[t]?.[1] ?? "?"}*)`).join("; ");

/**
 * name (lower) → Set of "TABLE" that name it: every registry table's capitalised keys and `item` fields,
 * the lists (INTERRUPTS, RIDERS, BLOCKS, TWINNED_EXCEPTIONS) and the rows keyed by an effect whose rule
 * pointer names the item.
 */
export function registryNames() {
  const named = new Map();
  const note = (name, table) => { if ( !name ) return; const k = lower(name); if ( !named.has(k) ) named.set(k, new Set()); named.get(k).add(table); };
  for ( const [table, value] of Object.entries(R) ) {
    if ( !value || (typeof value !== "object") || Array.isArray(value) || (value instanceof Set) || (typeof value === "function") ) continue;
    for ( const [key, row] of Object.entries(value) ) {
      if ( !/^[A-Z]/.test(key) ) continue;
      note(key, table);
      if ( row && (typeof row === "object") ) {
        if ( typeof row.item === "string" ) note(row.item, table);
        if ( typeof row.from === "string" ) { /* prose, never a name */ }
      }
    }
  }
  for ( const r of R.INTERRUPTS ) note(r.name, "INTERRUPTS");
  for ( const r of R.RIDERS ) note(r.name, "RIDERS");   // by identifier (hunters-mark): matched on the row's identifier by the caller
  for ( const b of R.BLOCKS ) { note(b.spell, "BLOCKS"); note(b.reaction, "BLOCKS"); }
  for ( const n of [...R.TWINNED_EXCEPTIONS.except, ...R.TWINNED_EXCEPTIONS.also] ) note(n, "TWINNED_EXCEPTIONS");
  // EFFECT_BENDS rows are keyed by the EFFECT's name: the item is the rule pointer's.
  for ( const row of Object.values(R.EFFECT_BENDS) ) if ( row.rule?.item ) note(row.rule.item, "EFFECT_BENDS");
  for ( const row of Object.values(R.HEAL_REROLLS) ) if ( row.rule?.item ) note(row.rule.item, "HEAL_REROLLS");
  for ( const [key, row] of Object.entries(R.DAMAGE_SHIELDS) ) note(row.rule?.item ?? key, "DAMAGE_SHIELDS");
  for ( const [key, row] of Object.entries(R.DROP_TO_ONE) ) note(row.rule?.item ?? key, "DROP_TO_ONE");
  for ( const [key, row] of Object.entries(R.TOKEN_SIZES) ) note(row.rule?.item ?? key, "TOKEN_SIZES");
  // The clock riders are keyed by a slug: the feature's name and its rule pointer's item.
  for ( const row of Object.values(R.CLOCK_RIDERS) ) { note(row.feature, "CLOCK_RIDERS"); note(row.rule?.item, "CLOCK_RIDERS"); }
  for ( const [key, row] of Object.entries(R.COATINGS) ) note(row.rule?.item ?? key, "COATINGS");
  return named;
}

/** Every `**Name**` in the first cell of every table row between `head` and the next heading or walk table. */
export function boldFirstCells(text, head) {
  const at = text.indexOf(head);
  if ( at < 0 ) return [];
  const block = text.slice(at + head.length);
  const end = block.search(/\n(## |\*\*The walk — )/);
  const table = end > 0 ? block.slice(0, end) : block;
  const names = [];
  for ( const line of table.split("\n") ) {
    if ( !line.startsWith("| **") ) continue;
    for ( const m of line.split("|")[1].matchAll(/\*\*([^*]+)\*\*/g) ) names.push(m[1].trim());
  }
  return names;
}

const parts = name => name.split(/,| and /).map(s => s.trim()).filter(Boolean);

/**
 * name (lower) → the walk it sits in, from RULINGS' walk tables.
 * @param {string} rulings
 * @param {Array<[string, string]>} heads  [the table's bold head, the label the register prints]
 */
export function walkTables(rulings, heads) {
  const walked = new Map();
  for ( const [head, label] of heads ) {
    for ( const name of boldFirstCells(rulings, head) ) for ( const part of parts(name) ) if ( !walked.has(lower(part)) ) walked.set(lower(part), label);
  }
  return walked;
}

/** name (lower) → "bend" | "rule of cool" | "bend · rule of cool", from RULINGS' two registers. */
export function bendRegisters(rulings) {
  const bends = new Map();
  for ( const name of boldFirstCells(rulings, "## Where the table bends the rule") ) for ( const p of parts(name) ) if ( !bends.has(lower(p)) ) bends.set(lower(p), "bend");
  for ( const name of boldFirstCells(rulings, "## Bent by choice") ) for ( const p of parts(name) ) bends.set(lower(p), bends.has(lower(p)) ? "bend · rule of cool" : "rule of cool");
  return bends;
}

/**
 * A drawing's hand verdicts: `| **Name** | VERDICT | why |` under *Register verdicts*, name (lower) → { verdict, why }.
 * @param {string} drawing
 * @param {string[]} words  the verdict words the register allows
 */
export function handVerdicts(drawing, words) {
  const hand = new Map();
  const at = drawing.indexOf("## Register verdicts");
  if ( at < 0 ) return hand;
  const re = new RegExp(`^\\|\\s*\\*\\*([^*]+)\\*\\*\\s*\\|\\s*(${words.join("|")})\\s*\\|\\s*(.*?)\\s*\\|\\s*$`);
  for ( const line of drawing.slice(at).split("\n") ) {
    const m = re.exec(line);
    if ( m ) hand.set(lower(m[1]), { verdict: m[2], why: m[3] });
  }
  return hand;
}
