// A SPLAT BOOK'S REGISTER — one row per row of the book (its subclass features, the options nothing grants, its feats,
// spells, items and the bestiary's traits, actions and reactions, deduplicated by name): in scope or not, the precedent it
// lands on, the bends, the walk. Generated, never edited: the OFFLINE corpus (tools/scan-corpus-offline.mjs, the classifier)
// joined with the registry, RULINGS' bend registers and walk tables, and the book's drawing's hand verdicts
// (audits/drawings/splat-<book>.md *Register verdicts*). Offline; the shared readers are register-shared.mjs's.
//
//   node tools/scan-corpus-offline.mjs dist/splat-corpus.json dnd-arcana-unleashed dnd-heroes-faerun dnd-ravenloft-horrors-within
//   node tools/classify-corpus.mjs dist/splat-corpus.json
//   node tools/audit-splat-register.mjs <arcana|faerun|ravenloft> [dist/splat-corpus.json] [--out audits/<book>-register.md]
//
// The verdict per row, in order: the drawing's hand verdict (NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS,
// with its precedent) wins; else MODULE when a registry table names the row; else TEXT when the pack ships a paragraph only
// (no effect, no save / attack / damage / healing activity), or the text trips no combat family; else NATIVE.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, bendRegisters, esc, handVerdicts, lower, readDrawing, readRulings, registryNames, today, walkTables, whereCell } from "./register-shared.mjs";

const BOOKS = {
  arcana: { pack: "dnd-arcana-unleashed", title: "Arcana Unleashed", drawing: "splat-arcana.md", walk: "**The walk — Arcana Unleashed**", label: "Arcana Unleashed" },
  faerun: { pack: "dnd-heroes-faerun", title: "Heroes of Faerûn", drawing: "splat-faerun.md", walk: "**The walk — Heroes of Faerûn**", label: "Heroes of Faerûn" },
  ravenloft: { pack: "dnd-ravenloft-horrors-within", title: "Ravenloft: The Horrors Within", drawing: "splat-ravenloft.md", walk: "**The walk — Ravenloft**", label: "Ravenloft" }
};
const WORDS = ["NATIVE", "MODULE", "ROW", "TABLE", "KIND", "TEXT", "OUT", "WAITS"];

const [bookKey, fileArg] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const book = BOOKS[bookKey];
if ( !book ) { console.error(`usage: node tools/audit-splat-register.mjs <${Object.keys(BOOKS).join("|")}> [corpus.json] [--out audits/<book>-register.md]`); process.exit(2); }
const file = fileArg ?? "dist/splat-corpus.json";
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join("audits", `${bookKey}-register.md`);
const raw = JSON.parse(readFileSync(file, "utf8"));
const classified = JSON.parse(readFileSync(file.replace(/\.json$/, "-classified.json"), "utf8"));
const rulings = readRulings();
let drawing = "";
try { drawing = readDrawing(book.drawing); } catch { drawing = ""; }

const named = registryNames();
const walked = walkTables(rulings, [[book.walk, book.label]]);
const bends = bendRegisters(rulings);
const hand = handVerdicts(drawing, WORDS);

/* --- the kind: what the row is ----------------------------------------------------------------- */

const KINDS = ["species", "subclass", "option", "feat", "spell", "item", "gift", "monster"];
function kindOf(x) {
  if ( /\.(fallback-)?actors$/.test(x.pack) ) return "monster";
  if ( x.kind === "race" ) return "species";
  if ( x.kind === "subclass" ) return "subclass";
  if ( x.kind === "class?" ) return "option";
  if ( x.kind === "feat" ) return "feat";
  if ( x.kind === "spell" ) return "spell";
  if ( x.kind === "gift" ) return "gift";
  return "item";
}
// Families that alone make no combat row: the sheet applies them already.
const NOISE = new Set(["movement", "resist", "ac-passive", "concentration"]);
const combatish = x => (x.fams ?? []).some(f => !NOISE.has(f)) || x.struct?.save || x.struct?.attack || x.struct?.damage || x.reaction;

/* --- the rows ------------------------------------------------------------------------------------ */

const rawByKey = new Map(raw.rows.map(r => [`${r.pack}|${lower(r.name)}`, r]));
const mine = classified.filter(x => x.pack.startsWith(`${book.pack}.`));
const seen = new Set();
const rows = [];
const counts = Object.fromEntries(WORDS.map(w => [w, 0]));
const used = new Set();
for ( const x of mine ) {
  const kind = kindOf(x);
  // The bestiary deduplicated by name (one Multiattack); a player row never collapses into a monster's of the same name.
  const dedupe = `${kind === "monster" ? "monster" : x.pack}|${lower(x.name)}`;
  if ( seen.has(dedupe) ) continue;
  seen.add(dedupe);
  const r = rawByKey.get(`${x.pack}|${lower(x.name)}`) ?? {};
  const tables = [...new Set([...(named.get(lower(x.name)) ?? []), ...(named.get(lower(r.identifier)) ?? [])])];
  const h = hand.get(lower(x.name)) ?? null;
  if ( h ) used.add(lower(x.name));
  const s = x.struct ?? {};
  let verdict, why = "", how = "";
  if ( h ) { verdict = h.verdict; why = h.why; }
  else if ( tables.length ) verdict = "MODULE";
  else if ( s.textOnly ) { verdict = "TEXT"; why = "no mechanism to play — the pack ships a paragraph"; }
  else if ( !combatish(x) ) { verdict = "TEXT"; why = "no combat mechanism"; }
  else verdict = "NATIVE";
  if ( (verdict === "MODULE") && tables.length ) {
    how = whereCell(tables.filter(t => whereCell([t]).indexOf("(?;") < 0)) || tables.map(t => `\`${t}\``).join("; ");
    if ( h?.why ) how = `${how} — ${h.why}`;
  } else if ( verdict === "MODULE" ) how = h?.why ?? "";
  if ( (verdict === "NATIVE") && !why ) {
    const bits = [s.effects ? `${s.effects} effect${s.effects === 1 ? "" : "s"}${s.statuses?.length ? ` [${s.statuses.join(", ")}]` : ""}` : "", s.save ? "a save" : "", s.attack ? "an attack" : "", s.damage ? "damage" : "", s.uses ? "uses" : ""].filter(Boolean);
    why = bits.length ? `the pack resolves it: ${bits.join(", ")}` : "the pack resolves it";
  }
  counts[verdict] = (counts[verdict] ?? 0) + 1;
  const owner = x.owner ?? (kind === "monster" ? (raw.rows.find(q => (q.pack === x.pack) && (q.name === x.name))?.owner ?? "") : "");
  rows.push({ kind, name: x.name, where: kind === "monster" ? `${x.pack.split(".")[1]}` : (owner || (x.level ? `level ${x.level}` : "")), fams: (x.fams ?? []).join(", ") || "—",
    verdict, why, how, bend: bends.get(lower(x.name)) ?? "—", walked: walked.get(lower(x.name)) ?? "—" });
}
rows.sort((a, b) => (KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)) || a.where.localeCompare(b.where) || a.name.localeCompare(b.name));

/* --- the file ------------------------------------------------------------------------------------ */

const byKind = KINDS.map(k => [k, rows.filter(r => r.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${k}${n === 1 ? "" : (k === "species" ? "" : "s")}`).join(" · ");
const lines = [];
lines.push(`# ${book.title} — the register`, "",
  `> Generated ${today()} by \`tools/audit-splat-register.mjs ${bookKey}\` from the OFFLINE corpus (\`tools/scan-corpus-offline.mjs\`, every pack of`,
  `> \`${book.pack}\`, ${rows.length} rows) joined with \`scripts/decide/registry.js\`, RULINGS' walk tables and bend registers, and the`,
  `> drawing's hand verdicts ([drawings/${book.drawing}](drawings/${book.drawing}) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.`,
  ">",
  "> **In scope**: NATIVE — the pack and the platform resolve it (the sheet's effects, the saves machine, the applier, the gate and the",
  "> receipts already cover it); MODULE — a registry table names it (the table, its machine and the RULINGS section to read); ROW — a row",
  "> on a machine that exists, to build, the precedent named; TABLE — a new table that is not a kind; KIND — a new kind (the R4 tripwire",
  "> moves); **WAITS** — drawn on a machine that exists, held for its first customer or a measurement; TEXT — a paragraph only, or no combat",
  "> mechanism; OUT — held out by a ruling, the reason in *Why not*. **Kind**: species · subclass (its feature, the subclass named) · option",
  "> (nothing grants it) · feat · spell · item · gift · monster (the bestiary's traits, actions and reactions, one row per name).", "",
  `**${rows.length} rows (${byKind}): ${WORDS.map(w => `${counts[w]} ${w}`).join(" · ")}.**`, "",
  "| Kind | Row | Where | Families | In scope | Why not / how | Rule of cool / bend | Walked |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for ( const r of rows ) lines.push(`| ${r.kind} | **${esc(r.name)}** | ${esc(r.where)} | ${esc(r.fams)} | ${r.verdict} | ${esc(r.how || r.why)} | ${r.bend} | ${r.walked} |`);
lines.push("");
writeFileSync(join(ROOT, out), lines.join("\n"));
console.log(`[register] ${rows.length} rows → ${out}: ${JSON.stringify(counts)}; hand verdicts ${used.size} of ${hand.size}, walked ${rows.filter(r => r.walked !== "—").length}, bends ${rows.filter(r => r.bend !== "—").length}`);
const unknownHand = [...hand.keys()].filter(k => !used.has(k));
if ( unknownHand.length ) console.log(`[register] ⚠ hand verdicts naming no row of the book: ${unknownHand.join(", ")}`);
