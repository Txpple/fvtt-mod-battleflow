// THE PHB SPELL REGISTER — one row per PHB spell: in scope or not, why, how, the bends, the walk.
// Generated, never edited: the evidence is the corpus scan joined with the registry, RULINGS and the
// drawing's hand verdicts (audits/drawings/spells.md *Register verdicts*). Offline. The readers it shares
// with the DMG's register live in register-shared.mjs.
//
//   node tools/scan-corpus.mjs <corpus.json> --only dnd-players-handbook.spells   (live, ~1 min)
//   node tools/classify-corpus.mjs <corpus.json> --kind spell                      (writes <corpus>-classified.json)
//   node tools/audit-spells-register.mjs <corpus.json> [--out audits/spells-register.md]
//
// The verdict per spell, in order: the drawing's hand verdict (OUT / TEXT / NATIVE / MODULE with a reason)
// wins; else MODULE when a registry table names the spell (its key, or an `item` field); else TEXT when the
// pack ships no effect and no save / attack / damage / healing activity; else NATIVE.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, bendRegisters, esc, handVerdicts, lower, readDrawing, readRulings, registryNames, today, walkTables, whereCell } from "./register-shared.mjs";

const file = process.argv[2];
if ( !file ) { console.error("usage: node tools/audit-spells-register.mjs <corpus.json> [--out audits/spells-register.md]"); process.exit(2); }
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join("audits", "spells-register.md");
const raw = JSON.parse(readFileSync(file, "utf8"));
const classified = JSON.parse(readFileSync(file.replace(/\.json$/, "-classified.json"), "utf8"));
const rulings = readRulings();
const PACK = "dnd-players-handbook.spells";

const named = registryNames();
const walkTiers = walkTables(rulings, [1, 2, 3, 4].map(n => [`**The walk — Tier ${n}**`, `Tier ${n}`]));
const bends = bendRegisters(rulings);
const hand = handVerdicts(readDrawing("spells.md"), ["OUT", "TEXT", "NATIVE", "MODULE"]);

/* --- the rows ------------------------------------------------------------------------------------ */

const rawByName = new Map(raw.rows.filter(r => r.pack === PACK).map(r => [lower(r.name), r]));
const spells = classified.filter(x => (x.kind === "spell") && (x.pack === PACK))
  .sort((a, b) => ((a.level ?? 0) - (b.level ?? 0)) || a.name.localeCompare(b.name));
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
    how = whereCell(tables);
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
  `> Generated ${today()} by \`tools/audit-spells-register.mjs\` from the corpus scan (\`${PACK}\`, ${spells.length} spells, dnd5e ${raw.dnd5e ?? "?"}) joined`,
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
