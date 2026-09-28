// THE PHB SPELL REGISTER — one row per PHB spell: in scope or not, why, how, the bends, the walk.
// Generated, never edited: the evidence is the corpus scan joined with the registry, RULINGS and the
// drawing's hand verdicts (audits/drawings/spells.md *Register verdicts*). Offline.
//
//   node tools/scan-corpus.mjs <corpus.json> --only dnd-players-handbook.spells   (live, ~1 min)
//   node tools/classify-corpus.mjs <corpus.json> --kind spell                      (writes <corpus>-classified.json)
//   node tools/audit-spells-register.mjs <corpus.json> [--out audits/spells-register.md]
//
// The verdict per spell, in order: the drawing's hand verdict (OUT / TEXT / NATIVE / MODULE with a reason)
// wins; else MODULE when a registry table names the spell (its key, or an `item` field); else TEXT when the
// pack ships no effect and no save / attack / damage / healing activity; else NATIVE.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "../scripts/decide/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
if ( !file ) { console.error("usage: node tools/audit-spells-register.mjs <corpus.json> [--out audits/spells-register.md]"); process.exit(2); }
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join("audits", "spells-register.md");
const raw = JSON.parse(readFileSync(file, "utf8"));
const classified = JSON.parse(readFileSync(file.replace(/\.json$/, "-classified.json"), "utf8"));
const rulings = readFileSync(join(ROOT, "RULINGS.md"), "utf8");
const drawing = readFileSync(join(ROOT, "audits", "drawings", "spells.md"), "utf8");
const today = new Date().toISOString().slice(0, 10);
const PACK = "dnd-players-handbook.spells";
const lower = s => String(s ?? "").toLowerCase();

/* --- the registry: every table that names a spell, and where it is played -------------------------- */

/** Table → the machine file and the RULINGS section to read. */
const WHERE = {
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
  TWINNED_EXCEPTIONS: ["metamagic.js", "Metamagic"]
};

/** name (lower) → Set of "TABLE" that name it. */
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
for ( const r of R.RIDERS ) note(r.name, "RIDERS");   // by identifier (hunters-mark): matched on the row's identifier below
for ( const b of R.BLOCKS ) { note(b.spell, "BLOCKS"); note(b.reaction, "BLOCKS"); }
for ( const n of [...R.TWINNED_EXCEPTIONS.except, ...R.TWINNED_EXCEPTIONS.also] ) note(n, "TWINNED_EXCEPTIONS");
// EFFECT_BENDS rows are keyed by the EFFECT's name: the spell is the `from` prose or the rule pointer's item.
for ( const row of Object.values(R.EFFECT_BENDS) ) if ( row.rule?.item ) note(row.rule.item, "EFFECT_BENDS");
for ( const row of Object.values(R.HEAL_REROLLS) ) if ( row.rule?.item ) note(row.rule.item, "HEAL_REROLLS");
for ( const [key, row] of Object.entries(R.DAMAGE_SHIELDS) ) note(row.rule?.item ?? key, "DAMAGE_SHIELDS");
for ( const [key, row] of Object.entries(R.DROP_TO_ONE) ) note(row.rule?.item ?? key, "DROP_TO_ONE");
for ( const [key, row] of Object.entries(R.TOKEN_SIZES) ) note(row.rule?.item ?? key, "TOKEN_SIZES");

/* --- RULINGS: the walk tables and the bend registers, by the bold name in the first cell ----------- */

/** Every `**Name**` in the first cell of every table row between `head` and the next heading or walk table. */
function boldFirstCells(text, head) {
  const at = text.indexOf(head);
  if ( at < 0 ) return [];
  const block = text.slice(at + head.length);
  const end = block.search(/\n(## |\*\*The walk — Tier)/);
  const table = end > 0 ? block.slice(0, end) : block;
  const names = [];
  for ( const line of table.split("\n") ) {
    if ( !line.startsWith("| **") ) continue;
    for ( const m of line.split("|")[1].matchAll(/\*\*([^*]+)\*\*/g) ) names.push(m[1].trim());
  }
  return names;
}
const walkTiers = new Map();   // name (lower) → "Tier N"
for ( const n of [1, 2, 3, 4] ) {
  for ( const name of boldFirstCells(rulings, `**The walk — Tier ${n}**`) ) {
    for ( const part of name.split(/,| and /).map(s => s.trim()).filter(Boolean) ) if ( !walkTiers.has(lower(part)) ) walkTiers.set(lower(part), `Tier ${n}`);
  }
}
const bends = new Map();   // name (lower) → "bend" | "rule of cool"
for ( const name of boldFirstCells(rulings, "## Where the table bends the rule") ) for ( const p of name.split(/,| and /).map(s => s.trim()) ) if ( !bends.has(lower(p)) ) bends.set(lower(p), "bend");
for ( const name of boldFirstCells(rulings, "## Bent by choice") ) for ( const p of name.split(/,| and /).map(s => s.trim()) ) bends.set(lower(p), bends.has(lower(p)) ? "bend · rule of cool" : "rule of cool");

/* --- the drawing's hand verdicts: `| **Spell** | VERDICT | why |` under *Register verdicts* ------- */

const hand = new Map();
{
  const at = drawing.indexOf("## Register verdicts");
  if ( at >= 0 ) {
    for ( const line of drawing.slice(at).split("\n") ) {
      const m = /^\|\s*\*\*([^*]+)\*\*\s*\|\s*(OUT|TEXT|NATIVE|MODULE)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
      if ( m ) hand.set(lower(m[1]), { verdict: m[2], why: m[3] });
    }
  }
}

/* --- the rows ------------------------------------------------------------------------------------ */

const rawByName = new Map(raw.rows.filter(r => r.pack === PACK).map(r => [lower(r.name), r]));
const spells = classified.filter(x => (x.kind === "spell") && (x.pack === PACK))
  .sort((a, b) => ((a.level ?? 0) - (b.level ?? 0)) || a.name.localeCompare(b.name));
const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const SCHOOL = { abj: "Abjuration", con: "Conjuration", div: "Divination", enc: "Enchantment", evo: "Evocation", ill: "Illusion", nec: "Necromancy", trs: "Transmutation" };

const rows = [];
const counts = { NATIVE: 0, MODULE: 0, TEXT: 0, OUT: 0 };
for ( const x of spells ) {
  const r = rawByName.get(lower(x.name)) ?? {};
  const conc = (r.properties ?? []).includes("concentration") ? "C" : "";
  const tables = [...new Set([...(named.get(lower(x.name)) ?? []), ...(named.get(lower(r.identifier)) ?? [])])];
  const h = hand.get(lower(x.name)) ?? null;
  let verdict, why = "", how = "";
  if ( h ) { verdict = h.verdict; why = h.why; }
  else if ( tables.length ) verdict = "MODULE";
  else if ( x.struct?.textOnly ) { verdict = "TEXT"; why = "no mechanism to play — the pack ships a paragraph"; }
  else verdict = "NATIVE";
  if ( (verdict === "MODULE") || tables.length ) {
    how = tables.map(t => `\`${t}\` (${WHERE[t]?.[0] ?? "?"}; RULINGS *${WHERE[t]?.[1] ?? "?"}*)`).join("; ");
    if ( h && (verdict === "MODULE") && !tables.length ) how = h.why;
  }
  if ( (verdict === "NATIVE") && !why ) {
    const s = x.struct ?? {};
    const bits = [s.effects ? `${s.effects} effect${s.effects === 1 ? "" : "s"}${s.statuses?.length ? ` [${s.statuses.join(", ")}]` : ""}` : "", s.save ? "a save" : "", s.attack ? "an attack" : "", s.damage ? "damage" : "", x.text && /regain|Hit Points/.test(x.text) && !s.damage ? "healing" : ""].filter(Boolean);
    why = bits.length ? `the pack resolves it: ${bits.join(", ")}` : "the pack resolves it";
  }
  counts[verdict] = (counts[verdict] ?? 0) + 1;
  rows.push({ name: x.name, level: x.level ?? 0, school: SCHOOL[x.school] ?? x.school ?? "", conc, verdict, why, how,
    bend: bends.get(lower(x.name)) ?? "—", walked: walkTiers.get(lower(x.name)) ?? "—" });
}

/* --- the file ------------------------------------------------------------------------------------ */

const lines = [];
lines.push("# The PHB spells — the register", "",
  `> Generated ${today} by \`tools/audit-spells-register.mjs\` from the corpus scan (\`${PACK}\`, ${spells.length} spells, dnd5e ${raw.dnd5e ?? "?"}) joined`,
  "> with `scripts/decide/registry.js`, RULINGS' walk tables and bend registers, and the drawing's hand verdicts",
  "> ([drawings/spells.md](drawings/spells.md) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.",
  ">",
  "> **In scope**: NATIVE — the pack and the platform resolve it (the saves machine, the applier, the gate and the receipts",
  "> already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS section to read);",
  "> TEXT — the pack ships a paragraph only, no combat mechanism to play; OUT — held out by the drawing or a ruling, the",
  "> reason in *Why not*. **Rule of cool / bend**: a row in RULINGS *Where the table bends the rule* (bend) or *Bent by",
  "> choice* (rule of cool) names it. **Walked**: the RULINGS walk table the spell sits in (the walks of Tiers 1–4 are",
  "> deferred by the user — the tier is where it WILL be walked).", "",
  `**${spells.length} spells: ${counts.NATIVE} NATIVE · ${counts.MODULE} MODULE · ${counts.TEXT} TEXT · ${counts.OUT} OUT.**`, "",
  "| L | Spell | School | C | In scope | Why not / how | Rule of cool / bend | Walked |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for ( const r of rows ) lines.push(`| ${r.level} | **${esc(r.name)}** | ${r.school} | ${r.conc} | ${r.verdict} | ${esc(r.how || r.why)} | ${r.bend} | ${r.walked} |`);
lines.push("");
writeFileSync(join(ROOT, out), lines.join("\n"));
console.log(`[register] ${spells.length} spells → ${out}: ${JSON.stringify(counts)}; hand verdicts ${hand.size}, walked ${rows.filter(r => r.walked !== "—").length}, bends ${rows.filter(r => r.bend !== "—").length}`);
const unknownHand = [...hand.keys()].filter(k => !rawByName.has(k));
if ( unknownHand.length ) console.log(`[register] ⚠ hand verdicts naming no PHB spell: ${unknownHand.join(", ")}`);
