// THE PHB CLASSES REGISTER — one row per class feature, subclass feature and option nothing grants: in
// scope or not, the precedent it lands on, the Session 0 stage that builds it, the bends. Generated, never
// edited: the evidence is the measured class files (audits/classes/*.md, audits/options.md — themselves
// generated from the corpus scan) joined with the registry, RULINGS' bend registers and the drawing's hand
// verdicts (audits/drawings/classes.md *Register verdicts*). Offline, no Foundry; the shared readers are
// register-shared.mjs's.
//
//   node tools/audit-classes-register.mjs [--out audits/classes-register.md] [--plan audits/plans/session-0-classes.md]
//
// The verdict per row, in order: the drawing's hand verdict wins (NATIVE / MODULE / ROW / TABLE / KIND / TEXT /
// OUT / WAITS, with its precedent and stage); else MODULE when a registry table names the row; else OUT for a
// subclass spell list or a savant (the spells register holds each spell); else TEXT when the pack ships no
// effect and no save / attack / damage / healing activity; else NATIVE.
//   NATIVE  the pack and the platform resolve it       MODULE  a registry table names it today
//   ROW     a row (or a facet) on a machine that exists — to build, the precedent named
//   TABLE   a new table that is not a kind             KIND    a new kind — the R4 tripwire moves
//   TEXT    a paragraph only, nothing to play          OUT     held out by the drawing or a ruling
//   WAITS   drawn on a machine that exists, held for its first player
// With --plan, the register is also written into the plan between the classes-register markers.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, bendRegisters, esc, lower, readDrawing, readRulings, registryNames, today, whereCell } from "./register-shared.mjs";

const WORDS = ["NATIVE", "MODULE", "ROW", "TABLE", "KIND", "TEXT", "OUT", "WAITS"];
const arg = (flag, fallback) => process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : fallback;
const out = arg("--out", join("audits", "classes-register.md"));
const plan = arg("--plan", null);

const rulings = readRulings();
const drawing = readDrawing("classes.md");
const named = registryNames();
const bends = bendRegisters(rulings);

/* --- the evidence: audits/classes/*.md and audits/options.md ------------------------------------------ */

/** The band a level sits in — the plan orders its stages by band. */
const bandOf = level => (level === null) ? "—" : (level <= 5) ? "A" : (level <= 10) ? "B" : (level <= 16) ? "C" : "D";

/** The registry tables a Known cell names: "✓ EFFECT_BENDS.from, HIT_OPTIONS" · "✓ LIST:D20_FOLDS". */
const knownTables = cell => cell.replace(/✓/g, "").split(",").map(s => s.trim().replace(/^LIST:/, "").replace(/\.from$/, "")).filter(Boolean);

/** The structure cell read: `fx2[prone] save dmg uses **TEXT**`. */
function structOf(cell) {
  const s = { effects: 0, statuses: [], save: false, attack: false, damage: false, uses: false, textOnly: /\*\*TEXT\*\*/.test(cell) };
  const fx = /fx(\d+)(?:\[([^\]]*)\])?/.exec(cell);
  if ( fx ) { s.effects = Number(fx[1]); s.statuses = fx[2] ? fx[2].split(",").map(x => x.trim()) : []; }
  s.save = /\bsave\b/.test(cell); s.attack = /\batk\b/.test(cell); s.damage = /\bdmg\b/.test(cell); s.uses = /\buses\b/.test(cell);
  return s;
}

/** One evidence file → its rows, the first heading the class and each later heading a subclass. */
function readEvidence(file, className = null) {
  const rows = [];
  let cls = className, sub = "";
  for ( const line of readFileSync(file, "utf8").split("\n") ) {
    const h = /^## (.+?)(?: \(\d+\))?$/.exec(line);
    if ( h ) { if ( !cls ) cls = h[1]; else sub = (h[1] === cls) ? "" : h[1]; continue; }
    if ( !line.startsWith("| ") || line.startsWith("| L |") || line.startsWith("| ---") ) continue;
    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    if ( cells.length < 6 ) continue;
    const name = /\*\*(.+?)\*\*/.exec(cells[1])?.[1];
    if ( !name ) continue;
    rows.push({ cls: cls ?? className, sub, level: cells[0] ? Number(cells[0]) : null, name, families: cells[2] === "—" ? [] : cells[2].split(",").map(s => s.trim()),
      struct: structOf(cells[3]), known: cells[4] ? knownTables(cells[4]) : [], text: cells[5] });
  }
  return rows;
}

const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
const evidence = [];
for ( const c of CLASSES ) evidence.push(...readEvidence(join(ROOT, "audits", "classes", `${c}.md`)));
evidence.push(...readEvidence(join(ROOT, "audits", "options.md"), "Options"));
if ( !readdirSync(join(ROOT, "audits", "classes")).every(f => CLASSES.includes(f.replace(/\.md$/, ""))) ) console.log("[register] ⚠ audits/classes/ holds a file this generator does not read");

/* --- the hand verdicts: the drawing's *Register verdicts* table ------------------------------------------ */

/**
 * `| **Name** | Class — Sub | VERDICT | precedent | stage | why |`, name (lower) → the row. A name that recurs
 * across classes is keyed "class › name" as well; the class column disambiguates.
 */
function classVerdicts(text) {
  const hand = new Map();
  const at = text.indexOf("## Register verdicts");
  if ( at < 0 ) return hand;
  const re = new RegExp(`^\\|\\s*\\*\\*([^*]+)\\*\\*\\s*\\|\\s*([^|]*?)\\s*\\|\\s*(${WORDS.join("|")})\\s*\\|\\s*([^|]*?)\\s*\\|\\s*([^|]*?)\\s*\\|\\s*(.*?)\\s*\\|\\s*$`);
  for ( const line of text.slice(at).split("\n") ) {
    const m = re.exec(line);
    if ( !m ) continue;
    const row = { name: m[1].trim(), cls: m[2].trim(), verdict: m[3], precedent: m[4].trim(), stage: m[5].trim(), why: m[6].trim() };
    hand.set(lower(row.name), row);
    if ( row.cls ) hand.set(`${lower(row.cls.split(/ — /)[0])} › ${lower(row.name)}`, row);
  }
  return hand;
}
const hand = classVerdicts(drawing);

/* --- the rows ------------------------------------------------------------------------------------ */

const rows = [];
const counts = Object.fromEntries(WORDS.map(w => [w, 0]));
const used = new Set();
for ( const x of evidence ) {
  const h = hand.get(`${lower(x.cls)} › ${lower(x.name)}`) ?? hand.get(lower(x.name)) ?? null;
  if ( h ) used.add(h);
  const tables = [...new Set([...(named.get(lower(x.name)) ?? []), ...x.known])];
  let verdict, why = "", how = "", precedent = "—", stage = "—";
  if ( h ) { verdict = h.verdict; why = h.why; precedent = h.precedent || "—"; stage = h.stage || "—"; }
  else if ( tables.length ) verdict = "MODULE";
  else if ( / Spells$| Savant$/.test(x.name) ) { verdict = "OUT"; why = "a spell list — each spell's verdict is the spells register's"; }
  else if ( x.struct.textOnly ) { verdict = "TEXT"; why = "no mechanism to play — the pack ships a paragraph"; }
  else verdict = "NATIVE";
  if ( (verdict === "MODULE") && tables.length ) { how = whereCell(tables.filter(t => whereCell([t]).indexOf("(?;") < 0)); if ( !how ) how = tables.map(t => `\`${t}\``).join("; "); if ( h?.why ) how = `${how} — ${h.why}`; }
  else if ( (verdict === "MODULE") && h ) how = h.why;
  if ( (verdict === "NATIVE") && !why ) {
    const s = x.struct;
    const bits = [s.effects ? `${s.effects} effect${s.effects === 1 ? "" : "s"}${s.statuses.length ? ` [${s.statuses.join(", ")}]` : ""}` : "", s.save ? "a save" : "", s.attack ? "an attack" : "", s.damage ? "damage" : "", s.uses ? "uses" : "", /regain|Hit Points/.test(x.text) && !s.damage ? "healing" : ""].filter(Boolean);
    why = bits.length ? `the pack resolves it: ${bits.join(", ")}` : "the pack resolves it";
  }
  counts[verdict] = (counts[verdict] ?? 0) + 1;
  rows.push({ cls: x.cls, sub: x.sub, level: x.level, band: bandOf(x.level), name: x.name, verdict, precedent, stage, why, how, bend: bends.get(lower(x.name)) ?? "—" });
}

/* --- the tallies ----------------------------------------------------------------------------------- */

const classesInOrder = [...new Set(rows.map(r => r.cls))];
const tally = classesInOrder.map(c => { const mine = rows.filter(r => r.cls === c); return { cls: c, n: mine.length, ...Object.fromEntries(WORDS.map(w => [w, mine.filter(r => r.verdict === w).length])) }; });
const stages = [...new Set(rows.map(r => r.stage).filter(s => s !== "—"))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const stageTally = stages.map(s => ({ stage: s, rows: rows.filter(r => r.stage === s) }));

/* --- the file ------------------------------------------------------------------------------------ */

const table = [];
table.push("| Class | Sub | L | Band | Feature | Verdict | Precedent | Stage | Why not / how | Bend |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for ( const r of rows ) table.push(`| ${r.cls} | ${esc(r.sub)} | ${r.level ?? ""} | ${r.band} | **${esc(r.name)}** | ${r.verdict} | ${esc(r.precedent)} | ${r.stage} | ${esc(r.how || r.why)} | ${r.bend} |`);

const tallyTable = ["| Class | Rows | " + WORDS.join(" | ") + " |", "| --- | --- | " + WORDS.map(() => "---").join(" | ") + " |",
  ...tally.map(t => `| ${t.cls} | ${t.n} | ${WORDS.map(w => t[w]).join(" | ")} |`),
  `| **all** | **${rows.length}** | ${WORDS.map(w => `**${counts[w]}**`).join(" | ")} |`];
const stageTable = ["| Stage | Rows | Bands | The rows |", "| --- | --- | --- | --- |",
  ...stageTally.map(s => `| ${s.stage} | ${s.rows.length} | ${[...new Set(s.rows.map(r => r.band))].sort().join(" ")} | ${s.rows.map(r => `${r.name} (${r.cls}${r.sub ? ` — ${r.sub}` : ""} ${r.level ?? ""})`).join(" · ")} |`)];

const head = [
  `> Generated ${today()} by \`tools/audit-classes-register.mjs\` from the measured class files (\`audits/classes/*.md\`, \`audits/options.md\` — the corpus`,
  "> scan of `dnd-players-handbook.classes`, dnd5e 6.0.5) joined with `scripts/decide/registry.js`, RULINGS' bend registers and the drawing's hand",
  "> verdicts ([drawings/classes.md](drawings/classes.md) *Register verdicts*). Never edited by hand: change the drawing or the code and re-run.",
  ">",
  "> **Verdict**: NATIVE — the pack and the platform resolve it; MODULE — a registry table names it today (the table, its machine, the RULINGS",
  "> section); **ROW** — a row or a facet on a machine that exists, to build (*Precedent* names the table and the row it resembles — the standing",
  "> rule: name the precedent before a table or a kind is chosen); **TABLE** — a new table that is not a kind; **KIND** — a new kind, the R4 tripwire",
  "> moves; TEXT — a paragraph only, no combat mechanism to play; OUT — held out by the drawing or a ruling; **WAITS** — drawn on a machine that exists,",
  "> held for its first player. **Band**: the level band (A 1–5 · B 6–10 · C 11–16 · D 17–20) — the plan builds a band ahead of the party. **Stage**:",
  "> the plan's stage that builds it ([plans/session-0-classes.md](plans/session-0-classes.md)). **Bend**: a row in RULINGS' two registers names it.", ""
];
const summary = `**${rows.length} rows: ${WORDS.map(w => `${counts[w]} ${w}`).join(" · ")}.**`;

const lines = ["# The PHB classes — the register", "", ...head, summary, "", "## By class", "", ...tallyTable, "", "## By stage", "", ...stageTable, "", "## The rows", "", ...table, ""];
writeFileSync(join(ROOT, out), lines.join("\n"));

if ( plan ) {
  const path = join(ROOT, plan);
  const text = readFileSync(path, "utf8");
  const start = "<!-- classes-register:start -->", end = "<!-- classes-register:end -->";
  const a = text.indexOf(start), b = text.indexOf(end);
  if ( (a < 0) || (b < 0) ) console.log(`[register] ⚠ ${plan} carries no classes-register markers — not written into`);
  else {
    const inner = ["", `_Generated by \`tools/audit-classes-register.mjs\` (${today()}) — the same rows as [../classes-register.md](../classes-register.md); edit the drawing's *Register verdicts*, never this table._`, "",
      summary, "", "**By class**", "", ...tallyTable, "", "**By stage**", "", ...stageTable, "", "**The rows**", "", ...table, ""].join("\n");
    writeFileSync(path, text.slice(0, a + start.length) + "\n" + inner + text.slice(b));
  }
}

console.log(`[register] ${rows.length} rows → ${out}: ${JSON.stringify(counts)}; hand verdicts ${used.size} used, stages ${stages.length}, bends ${rows.filter(r => r.bend !== "—").length}`);
const unused = [...new Set([...hand.values()])].filter(h => !used.has(h)).map(h => h.name);
if ( unused.length ) console.log(`[register] ⚠ hand verdicts naming no class row: ${unused.join(", ")}`);
