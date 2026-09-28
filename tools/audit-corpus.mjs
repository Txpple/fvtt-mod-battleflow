// Write the audits/ folder: the 2024 corpus, kind by kind, as Markdown tables a reader (or a session)
// can scan — every row's families, structure and whether the registry already names it. Offline, over
// classify-corpus.mjs's `*-classified.json`. The audit is the EVIDENCE; the verdicts (NATIVE / ROW /
// KIND / OUT) are the drawing's, written by hand in SWEEP (§6 Slice A, §7 the spells).
//
//   node tools/scan-corpus.mjs <corpus.json>            (live, ~12 min, the user out of the world)
//   node tools/classify-corpus.mjs <corpus.json>        (writes <corpus>-classified.json)
//   node tools/audit-corpus.mjs <corpus-classified.json> [--out audits]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = process.argv[2];
if ( !file ) { console.error("usage: node tools/audit-corpus.mjs <corpus-classified.json> [--out audits]"); process.exit(2); }
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "audits";
const rows = JSON.parse(await import("node:fs").then(m => m.readFileSync(file, "utf8")));
const today = new Date().toISOString().slice(0, 10);

const PHB = {
  spells: "dnd-players-handbook.spells", classes: "dnd-players-handbook.classes"
};
const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "rogue", "ranger", "sorcerer", "warlock", "wizard"];

// ---- cells
const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const structOf = x => {
  const s = x.struct;
  return [s.effects ? `fx${s.effects}${s.statuses.length ? `[${s.statuses.join(",")}]` : ""}` : "",
    s.save ? "save" : "", s.attack ? "atk" : "", s.damage ? "dmg" : "", s.uses ? "uses" : "",
    s.activation, s.textOnly ? "**TEXT**" : ""].filter(Boolean).join(" ");
};
const knownOf = x => x.known ? `✓ ${x.known.join(", ")}` : "";
const famsOf = x => x.fams.length ? x.fams.join(", ") : "—";
const snippet = x => esc(x.text.slice(0, 110)) + (x.text.length > 110 ? "…" : "");

function table(list, { level = "L" } = {}) {
  const lines = [`| ${level} | Name | Families | Structure | Known | Text |`, "| --- | --- | --- | --- | --- | --- |"];
  for ( const x of list ) lines.push(`| ${x.level ?? ""} | **${esc(x.name)}** | ${famsOf(x)} | ${structOf(x)} | ${knownOf(x)} | ${snippet(x)} |`);
  return lines.join("\n");
}
const byLevelName = (a, b) => ((a.level ?? 0) - (b.level ?? 0)) || a.name.localeCompare(b.name);
function summary(list) {
  const fam = list.filter(x => x.fams.length);
  return `${list.length} rows · ${fam.length} with a family · ${fam.filter(x => x.struct.textOnly).length} of those text-only · ${list.filter(x => x.known).length} named in the registry`;
}
function famCounts(list) {
  const c = {};
  for ( const x of list ) for ( const f of x.fams ) c[f] = (c[f] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(" · ");
}
const head = (title, what) => `# ${title}\n\n> Generated ${today} by \`tools/audit-corpus.mjs\` from the corpus scan — ${what}. Evidence, not verdicts:\n> the drawing (NATIVE / ROW / KIND / OUT) is SWEEP's. **Structure**: fxN an effect count (its statuses), save / atk / dmg the\n> activities, TEXT a feature the pack ships as a paragraph only. **Known**: the registry table that names it already.\n\n`;

mkdirSync(join(out, "classes"), { recursive: true });
const files = [];
const write = (rel, text) => { writeFileSync(join(out, rel), text); files.push(rel); };

// ---- spells (PHB)
{
  const list = rows.filter(x => x.kind === "spell" && x.pack === PHB.spells).sort(byLevelName);
  const fam = list.filter(x => x.fams.length);
  const rest = list.filter(x => !x.fams.length);
  write("spells.md", head("The PHB spells", "`dnd-players-handbook.spells`")
    + `${summary(list)}\n\nFamilies: ${famCounts(list)}\n\n## With a family (${fam.length})\n\n${table(fam)}\n\n## No family (${rest.length})\n\n`
    + rest.map(x => `L${x.level} ${x.name}`).join(" · ") + "\n");
}

// ---- classes, one file each: the class's own features, then each subclass
for ( const id of CLASSES ) {
  const mine = rows.filter(x => (x.kind === "class" || x.kind === "subclass") && x.ownerClass === id && x.pack === PHB.classes);
  const cls = mine.filter(x => x.ownerType === "class").sort(byLevelName);
  const subs = [...new Set(mine.filter(x => x.ownerType === "subclass").map(x => x.owner))].sort();
  const title = cls[0]?.owner ?? id;
  let md = head(`${title}`, `\`${PHB.classes}\`, the class and its subclasses`) + `${summary(mine)}\n\nFamilies: ${famCounts(mine)}\n\n## ${title} (${cls.length})\n\n${table(cls)}\n`;
  for ( const s of subs ) {
    const list = mine.filter(x => x.owner === s).sort(byLevelName);
    md += `\n## ${s} (${list.length})\n\n${table(list)}\n`;
  }
  write(join("classes", `${id}.md`), md);
}

// ---- the options nothing grants (invocations, metamagic, maneuvers, boons …)
{
  const list = rows.filter(x => x.kind === "class?" && x.pack === PHB.classes).sort(byLevelName);
  write("options.md", head("The PHB options nothing grants", "invocations, metamagic, maneuvers, epic boons — a feature offers them")
    + `${summary(list)}\n\nFamilies: ${famCounts(list)}\n\n${table(list)}\n`);
}

// ---- the DM's side: the DMG's own features and equipment
{
  const list = rows.filter(x => x.kind === "dm").sort((a, b) => a.pack.localeCompare(b.pack) || byLevelName(a, b));
  const packs = [...new Set(list.map(x => x.pack))];
  let md = head("The Dungeon Master's Guide", "`dnd-dungeon-masters-guide.*`") + `${summary(list)}\n\nFamilies: ${famCounts(list)}\n`;
  for ( const p of packs ) {
    const l = list.filter(x => x.pack === p);
    const fam = l.filter(x => x.fams.length);
    md += `\n## ${p} (${l.length}; ${fam.length} with a family)\n\n${table(fam, { level: "Type" })}\n`;
    const rest = l.filter(x => !x.fams.length);
    if ( rest.length ) md += `\nNo family (${rest.length}): ${rest.map(x => x.name).join(" · ")}\n`;
  }
  write("dm.md", md);
}

// ---- the Monster Manual's traits
{
  const list = rows.filter(x => x.kind === "monster").sort((a, b) => a.name.localeCompare(b.name));
  const fam = list.filter(x => x.fams.length);
  const rest = list.filter(x => !x.fams.length);
  write("monsters.md", head("The Monster Manual's traits", "`dnd-monster-manual.features` (the SRD 2024 subset deduplicated under it)")
    + `${summary(list)}\n\nFamilies: ${famCounts(list)}\n\n## With a family (${fam.length})\n\n${table(fam, { level: "Type" })}\n\n## No family (${rest.length})\n\n`
    + rest.map(x => x.name).join(" · ") + "\n");
}

// ---- the index
write("README.md", `# audits/ — the 2024 corpus, measured

> **What this folder is:** the evidence behind the sweep's drawings — every PHB spell, every class and
> subclass feature, the options nothing grants, the DMG's own rows and the Monster Manual's traits, each
> with the mechanism families its text and structure trip, and whether \`scripts/decide/registry.js\`
> names it already. The evidence files are regenerated, never edited by hand; the verdicts live in
> [drawings/](drawings/) (SWEEP §6 holds Slice A's, the first drawing, from before this folder).
>
> **How:** \`node tools/scan-corpus.mjs <corpus.json>\` (live, read-only, ~12 min, the user out of the
> world) → \`node tools/classify-corpus.mjs <corpus.json>\` → \`node tools/audit-corpus.mjs
> <corpus-classified.json>\`. Last generated ${today} on the sandbox (dnd5e 6.0.5).

| File | What |
| --- | --- |
| [spells.md](spells.md) | the PHB spells — SWEEP §7 is the drawing |
| [classes/](classes/) | one file per class: the class's features, then each subclass — the order the user asked for (2026-09-28: class by class, all its subclasses, then the next) |
| [options.md](options.md) | invocations, metamagic, maneuvers, boons |
| [dm.md](dm.md) | the DMG's features and equipment |
| [monsters.md](monsters.md) | the Monster Manual's traits — Slice B's ground |
| [drawings/](drawings/) | **the verdicts, by hand** — NATIVE / ROW / KIND / OUT per row with the precedent named: [spells](drawings/spells.md), [classes](drawings/classes.md), [the DMG](drawings/dm.md), [the monsters](drawings/monsters.md) |
`);

console.log(`wrote ${files.length} files under ${out}/: ${files.join(", ")}`);
