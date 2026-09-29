// THE MONSTER MANUAL REGISTER — one row per trait, action and reaction of `dnd-monster-manual.features`
// (the 2025 book, the SRD 2024 subset deduplicated under it): in scope or not, why, how, the shape a
// waiting row lands on, the bends, the walk. Generated, never edited: the corpus scan joined with the
// registry, RULINGS' three GM's-side walk tables and bend registers, and the drawing's hand verdicts
// (audits/drawings/monsters.md *Register verdicts*). Offline; the shared readers are register-shared.mjs's.
//
//   node tools/scan-corpus.mjs <corpus.json> --only dnd-monster-manual.features   (live, read-only)
//   node tools/classify-corpus.mjs <corpus.json>                                  (writes <corpus>-classified.json)
//   node tools/audit-monsters-register.mjs <corpus.json> [--out audits/monsters-register.md]
//
// The verdict per row, in order: the drawing's hand verdict (OUT / TEXT / NATIVE / MODULE / WAITS) wins —
// a WAITS row's reason opens with the shape in backticks, lifted into the *Shape* column; else MODULE when
// a registry table names the row; else NATIVE for a "casts X" row (the spell's own machine — the spells
// register holds the spell's verdict); else TEXT when the pack ships no effect and no save / attack /
// damage / healing activity; else NATIVE.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, bendRegisters, esc, handVerdicts, lower, readDrawing, readRulings, registryNames, today, whereCell } from "./register-shared.mjs";

const file = process.argv[2];
if ( !file ) { console.error("usage: node tools/audit-monsters-register.mjs <corpus.json> [--out audits/monsters-register.md]"); process.exit(2); }
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join("audits", "monsters-register.md");
const raw = JSON.parse(readFileSync(file, "utf8"));
const classified = JSON.parse(readFileSync(file.replace(/\.json$/, "-classified.json"), "utf8"));
const rulings = readRulings();
const drawing = readDrawing("monsters.md");
const PACK = "dnd-monster-manual.features";
const WORDS = ["OUT", "TEXT", "NATIVE", "MODULE", "WAITS"];

const named = registryNames();
const bends = bendRegisters(rulings);
const hand = handVerdicts(drawing, WORDS);

/* --- the GM's side walk tables: plain first cells under the three RULINGS sections ---------------------- */

/** The three GM's-side sections and the label the register prints; a heading prefix, matched by `startsWith`. */
const SECTIONS = [
  ["## The GM's side — the five shapes", "the five shapes"],
  ["## The GM's side — the aura rows and the attack bends", "the aura rows"],
  ["## The GM's side — the reaction rows", "the reaction rows"]
];

/** name (lower) → the GM's-side section label whose walk table names it (the first cell, split on commas). */
const walked = new Map();
/** name (lower) → the section label, for every trait a section's tables name (the RULINGS pointer a MODULE row prints). */
const sectionOf = new Map();
{
  const headings = [...rulings.matchAll(/^## .*$/gm)];
  for ( const [prefix, label] of SECTIONS ) {
    const i = headings.findIndex(h => h[0].startsWith(prefix));
    if ( i < 0 ) continue;
    const block = rulings.slice(headings[i].index, headings[i + 1]?.index);
    const walkAt = block.indexOf("### The walk table");
    for ( const line of block.split("\n") ) {
      if ( !line.startsWith("| ") || line.startsWith("| Trait") || line.startsWith("| ---") ) continue;
      const cell = line.split("|")[1].replace(/\*\*/g, "").trim();
      for ( const part of cell.split(/,\s*|\s·\s/) ) {
        const name = part.replace(/\s*\(.*$/, "").trim();
        if ( !name || (name.length > 40) ) continue;
        if ( !sectionOf.has(lower(name)) ) sectionOf.set(lower(name), label);
      }
    }
    if ( walkAt < 0 ) continue;
    for ( const line of block.slice(walkAt).split("\n") ) {
      if ( !line.startsWith("| ") || line.startsWith("| Trait") || line.startsWith("| ---") ) continue;
      const cell = line.split("|")[1].replace(/\*\*/g, "").trim();
      for ( const part of cell.split(/,\s*|\s·\s/) ) {
        const name = part.replace(/\s*\(.*$/, "").trim();
        if ( name && (name.length <= 40) && !walked.has(lower(name)) ) walked.set(lower(name), label);
      }
    }
  }
}

/** A MODULE row's cell: the table and its machine from WHERE, the RULINGS section the GM's side wrote when it is theirs. */
function howCell(tables, name) {
  const cell = whereCell(tables);
  const section = sectionOf.get(lower(name));
  return section ? cell.replace(/RULINGS \*[^*]*\*/g, `RULINGS *The GM's side — ${section}*`) : cell;
}

/* --- the kind: what the row is on the stat block ---------------------------------------------------- */

const KINDS = ["trait", "action", "reaction"];
function kindOf(r, text) {
  if ( (r.properties ?? []).includes("trait") ) return "trait";
  if ( /^\s*Trigger\s*:/.test(text) ) return "reaction";
  return "action";
}

/** The pack's text, its enrichers folded, for the kind and the cast test. */
const plain = t => String(t ?? "").replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1").replace(/\[\[[^\]]*\]\]/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* --- the rows ------------------------------------------------------------------------------------ */

const rawByName = new Map(raw.rows.filter(r => r.pack === PACK).map(r => [lower(r.name), r]));
const norm = s => lower(s).replace(/[’']/g, "'");
const rows = [];
const counts = Object.fromEntries(WORDS.map(w => [w, 0]));
const seen = new Set();
for ( const x of classified.filter(x => x.pack === PACK) ) {
  if ( seen.has(norm(x.name)) ) continue;   // a guard: the scan has carried a name twice, a curly and a straight apostrophe apart
  seen.add(norm(x.name));
  const r = rawByName.get(lower(x.name)) ?? {};
  const text = plain(r.text ?? x.text);
  const kind = kindOf(r, text);
  const s = x.struct ?? {};
  const tables = [...new Set([...(named.get(lower(x.name)) ?? []), ...(named.get(lower(r.identifier)) ?? [])])];
  const h = hand.get(lower(x.name)) ?? null;
  const casts = (s.activities ?? []).includes("cast") || /\bcasts?\b.*\bspell\b|\bcasts? [A-Z]/.test(text);
  let verdict, why = "", how = "", shape = "—";
  if ( h ) {
    verdict = h.verdict; why = h.why;
    if ( verdict === "WAITS" ) { const m = /^`([^`]+)`\s*[—-]?\s*(.*)$/.exec(why); if ( m ) { shape = m[1]; why = m[2]; } }
  }
  else if ( tables.length ) verdict = "MODULE";
  else if ( casts && s.textOnly ) { verdict = "NATIVE"; why = "a cast — the spell's own machine; its verdict is the spells register's"; }
  else if ( s.textOnly ) { verdict = "TEXT"; why = "no mechanism to play — the pack ships a paragraph"; }
  else verdict = "NATIVE";
  // A hand verdict that is not MODULE stands alone: a same-named registry row is a collision, not a machine.
  if ( (verdict === "MODULE") || (tables.length && !h) ) {
    how = howCell(tables, x.name);
    if ( h && (verdict === "MODULE") && !tables.length ) how = h.why;
  }
  if ( (verdict === "NATIVE") && !why ) {
    const bits = [s.effects ? `${s.effects} effect${s.effects === 1 ? "" : "s"}${s.statuses?.length ? ` [${s.statuses.join(", ")}]` : ""}` : "", s.save ? "a save" : "", s.attack ? "an attack" : "", s.damage ? "damage" : "", (s.activities ?? []).includes("heal") ? "healing" : "", s.uses ? "uses" : ""].filter(Boolean);
    why = bits.length ? `the pack resolves it: ${bits.join(", ")}` : "the pack resolves it";
  }
  counts[verdict] = (counts[verdict] ?? 0) + 1;
  rows.push({ kind, name: x.name, verdict, shape, why, how, bend: bends.get(lower(x.name)) ?? "—", walked: walked.get(lower(x.name)) ?? "—" });
}
rows.sort((a, b) => (KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)) || a.name.localeCompare(b.name));

/* --- the file ------------------------------------------------------------------------------------ */

const byKind = KINDS.map(k => `${rows.filter(r => r.kind === k).length} ${k}s`).join(" · ");
const lines = [];
lines.push("# The Monster Manual — the register", "",
  `> Generated ${today()} by \`tools/audit-monsters-register.mjs\` from the corpus scan (\`${PACK}\`, ${rows.length} rows, dnd5e ${raw.dnd5e ?? "?"})`,
  "> joined with `scripts/decide/registry.js`, RULINGS' three GM's-side walk tables and bend registers, and the drawing's hand",
  "> verdicts ([drawings/monsters.md](drawings/monsters.md) *Register verdicts* — every row the scan gave no family was read by hand",
  "> there, 2026-09-28). Never edited by hand: change the drawing or the code and re-run.",
  ">",
  "> **In scope**: NATIVE — the pack and the platform resolve it (the attack, the demand at the targets, the applier, the gate and",
  "> the receipts already cover it; a \"casts X\" row is the spell's, its verdict in the spells register); MODULE — a registry table",
  "> names it (the table, its machine and the RULINGS section to read); **WAITS** — its shape is drawn on a machine that exists",
  "> (*Shape*) and its customer is a monster not yet at the table: built when the first is brought to it; TEXT — a paragraph only,",
  "> no combat mechanism to play (a sense, a movement, a Multiattack whose attacks are the items'); OUT — held out by the drawing",
  "> or a ruling, the reason in *Why not*. **Kind**: trait · action · reaction (a row whose text opens \"Trigger:\"). **Rule of cool /",
  "> bend**: a row in RULINGS *Where the table bends the rule* (bend) or *Bent by choice* (rule of cool) names it. **Walked**: the",
  "> GM's-side RULINGS section whose walk table names it (the walks are deferred by the user — the section is where it WILL be walked).", "",
  `**${rows.length} rows (${byKind}): ${WORDS.map(w => `${counts[w]} ${w}`).join(" · ")}.**`, "",
  "| Kind | Row | In scope | Shape | Why not / how | Rule of cool / bend | Walked |", "| --- | --- | --- | --- | --- | --- | --- |");
for ( const r of rows ) lines.push(`| ${r.kind} | **${esc(r.name)}** | ${r.verdict} | ${esc(r.shape)} | ${esc(r.how || r.why)} | ${r.bend} | ${r.walked} |`);
lines.push("");
writeFileSync(join(ROOT, out), lines.join("\n"));
console.log(`[register] ${rows.length} rows → ${out}: ${JSON.stringify(counts)}; hand verdicts ${hand.size}, walked ${rows.filter(r => r.walked !== "—").length}, bends ${rows.filter(r => r.bend !== "—").length}`);
const unknownHand = [...hand.keys()].filter(k => !seen.has(norm(k)));
if ( unknownHand.length ) console.log(`[register] ⚠ hand verdicts naming no Monster Manual row: ${unknownHand.join(", ")}`);
