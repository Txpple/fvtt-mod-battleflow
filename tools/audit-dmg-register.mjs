// THE DMG REGISTER — one row per DMG row (the magic items, poisons, traps, hazards, siege weapons and
// supernatural gifts of `dnd-dungeon-masters-guide.equipment`, the NPC traits of `.features`): in scope or
// not, why, how, the shape it waits on, the bends, the walk. Generated, never edited: the corpus scan
// joined with the registry, RULINGS, and the drawing's two hand tables (audits/drawings/dm.md *The shapes
// the DMG shares with the other books* and *Register verdicts*). Offline; the shared readers are
// register-shared.mjs's.
//
//   node tools/scan-corpus.mjs <corpus.json> --only dnd-dungeon-masters-guide.equipment,dnd-dungeon-masters-guide.features
//   node tools/classify-corpus.mjs <corpus.json>                      (writes <corpus>-classified.json)
//   node tools/audit-dmg-register.mjs <corpus.json> [--out audits/dmg-register.md]
//
// The verdict per row, in order: the drawing's hand verdict (OUT / TEXT / NATIVE / MODULE / WAITS) wins;
// else MODULE when a registry table names the row; else WAITS when the drawing's shared-shapes table names
// it as a customer (the shape is drawn, the customer is a found item — "built when the first is found");
// else OUT for a trap, hazard or siege weapon (the GM runs them; their saves are the demand's); else TEXT
// when the pack ships no effect and no save / attack / damage activity, or the text trips no family (a
// utility item); else NATIVE.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, bendRegisters, esc, handVerdicts, lower, readDrawing, readRulings, registryNames, today, walkTables, whereCell } from "./register-shared.mjs";

const file = process.argv[2];
if ( !file ) { console.error("usage: node tools/audit-dmg-register.mjs <corpus.json> [--out audits/dmg-register.md]"); process.exit(2); }
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join("audits", "dmg-register.md");
const raw = JSON.parse(readFileSync(file, "utf8"));
const classified = JSON.parse(readFileSync(file.replace(/\.json$/, "-classified.json"), "utf8"));
const rulings = readRulings();
const drawing = readDrawing("dm.md");
const PACKS = ["dnd-dungeon-masters-guide.equipment", "dnd-dungeon-masters-guide.features"];
const WORDS = ["OUT", "TEXT", "NATIVE", "MODULE", "WAITS"];

const named = registryNames();
const walked = walkTables(rulings, [["**The walk — the DMG**", "the DMG"]]);
const bends = bendRegisters(rulings);
const hand = handVerdicts(drawing, WORDS);

/* --- the drawing's shared shapes: `| **Shape** (`code`) | customers | where |` ------------------------ */

/** Split a cell on commas outside parentheses. */
function splitCustomers(cell) {
  const parts = [];
  let depth = 0, cur = "";
  for ( const ch of cell ) {
    if ( ch === "(" ) depth++;
    if ( ch === ")" ) depth--;
    if ( (ch === ",") && !depth ) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map(s => s.trim()).filter(Boolean);
}

/** A customer's item name: the text before its parenthetical, a possessive tail dropped, plurals singular. */
function customerName(entry) {
  let name = entry.replace(/\s*\(.*$/, "").trim();
  name = name.replace(/'s? [a-z].*$/, "").replace(/’s? [a-z].*$/, "");
  name = name.replace(/^Ioun Stones of/, "Ioun Stone of");
  return name.trim();
}

const shapes = new Map();   // name (lower) → { shape, out: boolean, note }
{
  const at = drawing.indexOf("## The shapes the DMG shares");
  const end = drawing.indexOf("\n## ", at + 1);
  const block = at >= 0 ? drawing.slice(at, end > 0 ? end : undefined) : "";
  for ( const line of block.split("\n") ) {
    if ( !line.startsWith("| **") ) continue;
    const cells = line.split("|").slice(1, -1).map(s => s.trim());
    if ( cells.length < 3 ) continue;
    const [shapeCell, customers, where] = cells;
    const codes = [...shapeCell.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const whereCodes = [...where.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const bold = /\*\*([^*]+)\*\*/.exec(shapeCell)?.[1] ?? shapeCell;
    const shape = codes.length ? codes.join(" · ") : whereCodes.length ? whereCodes.join(" · ") : bold;
    for ( const entry of splitCustomers(customers) ) {
      const paren = /\(([^)]*)\)/.exec(entry)?.[1] ?? "";
      const name = customerName(entry);
      if ( !name ) continue;
      shapes.set(lower(name), { shape, out: /\bout\b/i.test(paren), note: paren, where: where.replace(/`|\*\*/g, "").replace(/^none — /, "") });
    }
  }
}

/* --- the kind: what the DMG row is ------------------------------------------------------------------ */

const KINDS = ["magic item", "poison", "supernatural gift", "trap", "hazard", "siege weapon", "feature"];
function kindOf(r) {
  if ( r.pack.endsWith(".features") ) return "feature";
  if ( r.featType === "siege" ) return "siege weapon";
  if ( (r.featType === "poison") || /^(Ingested|Inhaled|Contact|Injury) Poison\b/.test(r.text) ) return "poison";
  if ( r.featType === "supernaturalGift" ) return "supernatural gift";
  if ( /^(Deadly|Nuisance) Trap\b/.test(r.text) ) return "trap";
  if ( /^(Deadly|Nuisance) Hazard\b/.test(r.text) ) return "hazard";
  return "magic item";
}
const TYPE = { wondrous: "wondrous", ring: "ring", rod: "rod", wand: "wand", trinket: "trinket", shield: "shield", heavy: "heavy armor", medium: "medium armor", light: "light armor",
  martialM: "martial melee", martialR: "martial ranged", simpleM: "simple melee", simpleR: "simple ranged", natural: "natural", improv: "improvised", siege: "siege",
  ammo: "ammunition", potion: "potion", poison: "poison", scroll: "scroll", food: "food", gem: "gem", art: "art", gear: "gear", music: "instrument", supernaturalGift: "gift", monster: "trait" };
const typeOf = r => `${r.itemType}${r.featType ? ` · ${TYPE[r.featType] ?? r.featType}` : ""}`;
const RARITY = /\b(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)\b/;
const rarityOf = r => (RARITY.exec(String(r.text ?? "").replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1").slice(0, 200))?.[1] ?? "");

/* --- the rows ------------------------------------------------------------------------------------ */

const rawByName = new Map(raw.rows.filter(r => PACKS.includes(r.pack)).map(r => [`${r.pack}|${lower(r.name)}`, r]));
const items = classified.filter(x => PACKS.includes(x.pack));
const rows = [];
const counts = Object.fromEntries(WORDS.map(w => [w, 0]));
const seen = new Set();
for ( const x of items ) {
  const r = rawByName.get(`${x.pack}|${lower(x.name)}`) ?? {};
  const kind = kindOf({ ...r, pack: x.pack, text: r.text ?? x.text ?? "" });
  const tables = [...new Set([...(named.get(lower(x.name)) ?? []), ...(named.get(lower(r.identifier)) ?? [])])];
  const h = hand.get(lower(x.name)) ?? null;
  const sh = shapes.get(lower(x.name)) ?? null;
  if ( sh ) seen.add(lower(x.name));
  const s = x.struct ?? {};
  let verdict, why = "", how = "";
  if ( h ) { verdict = h.verdict; why = h.why; }
  else if ( tables.length ) verdict = "MODULE";
  else if ( sh?.out ) { verdict = "OUT"; why = `${sh.shape}: ${sh.note}`; }
  else if ( sh ) { verdict = "WAITS"; why = `${sh.note ? `${sh.note} — ` : ""}${sh.where}`; }
  else if ( ["trap", "hazard", "siege weapon"].includes(kind) ) { verdict = "OUT"; why = "the GM runs it; its save and damage are the demand's"; }
  else if ( s.textOnly ) { verdict = "TEXT"; why = "no mechanism to play — the pack ships a paragraph"; }
  else if ( !(x.fams ?? []).length ) { verdict = "TEXT"; why = "a utility item — no combat mechanism"; }
  else verdict = "NATIVE";
  // A hand verdict that is not MODULE stands alone: a same-named registry row (the Deck's Flames, the trait Light) is a collision, not a machine.
  if ( (verdict === "MODULE") || (tables.length && !h) ) {
    how = whereCell(tables);
    if ( h && (verdict === "MODULE") && !tables.length ) how = h.why;
  }
  if ( (verdict === "NATIVE") && !why ) {
    const bits = [s.effects ? `${s.effects} effect${s.effects === 1 ? "" : "s"}${s.statuses?.length ? ` [${s.statuses.join(", ")}]` : ""}` : "", s.save ? "a save" : "", s.attack ? "an attack" : "", s.damage ? "damage" : "", s.uses ? "uses" : ""].filter(Boolean);
    why = bits.length ? `the pack resolves it: ${bits.join(", ")}` : "the pack resolves it";
  }
  counts[verdict] = (counts[verdict] ?? 0) + 1;
  rows.push({ kind, name: x.name, type: typeOf(r), rarity: rarityOf(r), verdict, shape: sh?.shape ?? "—", why, how,
    bend: bends.get(lower(x.name)) ?? "—", walked: walked.get(lower(x.name)) ?? "—" });
}
rows.sort((a, b) => (KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)) || a.name.localeCompare(b.name));

/* --- the file ------------------------------------------------------------------------------------ */

const byKind = KINDS.map(k => `${rows.filter(r => r.kind === k).length} ${k}${k.endsWith("s") ? "" : "s"}`).join(" · ");
const lines = [];
lines.push("# The Dungeon Master's Guide — the register", "",
  `> Generated ${today()} by \`tools/audit-dmg-register.mjs\` from the corpus scan (\`dnd-dungeon-masters-guide.equipment\` and \`.features\`,`,
  `> ${rows.length} rows, dnd5e ${raw.dnd5e ?? "?"}) joined with \`scripts/decide/registry.js\`, RULINGS' walk tables and bend registers, and the`,
  "> drawing's two hand tables ([drawings/dm.md](drawings/dm.md) *The shapes the DMG shares with the other books* and *Register",
  "> verdicts*). Never edited by hand: change the drawing or the code and re-run.",
  ">",
  "> **In scope**: NATIVE — the pack and the platform resolve it (the sheet's effects, the saves machine, the applier, the",
  "> gate and the receipts already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS",
  "> section to read); **WAITS** — its shape is drawn on a machine that exists (*Shape*) and its customer is a found item: built",
  "> when the first is found; TEXT — a paragraph only, or a utility item with no combat mechanism; OUT — held out by the",
  "> drawing or a ruling, the reason in *Why not*. **Kind**: magic item · poison · supernatural gift · trap · hazard · siege",
  "> weapon · feature (the DMG's NPC traits). **Rule of cool / bend**: a row in RULINGS *Where the table bends the rule* (bend)",
  "> or *Bent by choice* (rule of cool) names it. **Walked**: the RULINGS walk table the row sits in.", "",
  `**${rows.length} rows (${byKind}): ${WORDS.map(w => `${counts[w]} ${w}`).join(" · ")}.**`, "",
  "| Kind | Item | Type | Rarity | In scope | Shape | Why not / how | Rule of cool / bend | Walked |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for ( const r of rows ) lines.push(`| ${r.kind} | **${esc(r.name)}** | ${r.type} | ${r.rarity} | ${r.verdict} | ${esc(r.shape)} | ${esc(r.how || r.why)} | ${r.bend} | ${r.walked} |`);
lines.push("");
writeFileSync(join(ROOT, out), lines.join("\n"));
console.log(`[register] ${rows.length} rows → ${out}: ${JSON.stringify(counts)}; hand verdicts ${hand.size}, shape customers ${shapes.size}, walked ${rows.filter(r => r.walked !== "—").length}, bends ${rows.filter(r => r.bend !== "—").length}`);
const names = new Set(items.map(x => lower(x.name)));
const unknownHand = [...hand.keys()].filter(k => !names.has(k));
if ( unknownHand.length ) console.log(`[register] ⚠ hand verdicts naming no DMG row: ${unknownHand.join(", ")}`);
const unknownShape = [...shapes.keys()].filter(k => !seen.has(k));
if ( unknownShape.length ) console.log(`[register] ⚠ shape customers naming no DMG row: ${unknownShape.join(", ")}`);
