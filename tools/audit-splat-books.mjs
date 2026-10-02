// Write audits/splat/: the splat books' measured corpus as evidence tables, one file per book,
// grouped by kind (species, each subclass, the options nothing grants, feats, spells, items, the
// bestiary). Evidence, not verdicts — the plan is audits/plans/splat-books.md.
//
//   node tools/scan-corpus-offline.mjs <corpus.json> dnd-arcana-unleashed dnd-heroes-faerun dnd-ravenloft-horrors-within
//   node tools/classify-corpus.mjs <corpus.json>
//   node tools/audit-splat-books.mjs <corpus-classified.json> <corpus.json> [--out audits/splat]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [cls, raw] = process.argv.slice(2);
if (!cls || !raw) { console.error("usage: node tools/audit-splat-books.mjs <corpus-classified.json> <corpus.json> [--out audits/splat]"); process.exit(2); }
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : join("audits", "splat");
const rows = JSON.parse(readFileSync(cls, "utf8"));
const owners = JSON.parse(readFileSync(raw, "utf8")).owners;
mkdirSync(out, { recursive: true });
const today = new Date().toISOString().slice(0, 10);

const BOOKS = {
  "dnd-arcana-unleashed": ["arcana-unleashed.md", "Arcana Unleashed"],
  "dnd-heroes-faerun": ["heroes-faerun.md", "Heroes of Faerûn"],
  "dnd-ravenloft-horrors-within": ["ravenloft.md", "Ravenloft: The Horrors Within"],
};
const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const structOf = x => {
  const s = x.struct;
  return [s.effects ? `fx${s.effects}${s.statuses.length ? `[${s.statuses.join(",")}]` : ""}` : "",
    s.save ? "save" : "", s.attack ? "atk" : "", s.damage ? "dmg" : "", s.uses ? "uses" : "",
    x.reaction ? "REACTION" : (s.activation || ""), s.textOnly ? "**TEXT**" : ""].filter(Boolean).join(" ");
};
const knownOf = x => x.known ? `✓ ${x.known.join(", ")}` : "";
const famsOf = x => x.fams.length ? x.fams.join(", ") : "—";
const snippet = (x, n = 160) => esc(x.text.slice(0, n)) + (x.text.length > n ? "…" : "");
// families that alone make no combat row: the sheet applies them already
const NOISE = new Set(["movement", "resist", "ac-passive", "concentration"]);
const combatish = x => x.fams.some(f => !NOISE.has(f)) || x.struct.save || x.struct.attack || x.struct.damage || x.reaction;

function table(list, { level = "L", extra = null } = {}) {
  const lines = [`| ${level} | Name | Families | Structure | Known | Text |`, "| --- | --- | --- | --- | --- | --- |"];
  for (const x of list) lines.push(`| ${extra ? extra(x) : (x.level ?? "")} | **${esc(x.name)}** | ${famsOf(x)} | ${structOf(x)} | ${knownOf(x)} | ${snippet(x)} |`);
  return lines.join("\n");
}
const byLevelName = (a, b) => ((a.level ?? 0) - (b.level ?? 0)) || a.name.localeCompare(b.name);
const summary = list => `${list.length} rows · ${list.filter(combatish).length} combat-shaped · ${list.filter(x => x.struct.textOnly && combatish(x)).length} of those text-only · ${list.filter(x => x.known).length} named in the registry`;

const files = [];
for (const [mod, [file, title]] of Object.entries(BOOKS)) {
  const mine = rows.filter(x => x.pack.startsWith(`${mod}.`));
  if (!mine.length) continue;
  const parts = [`# ${title} — the measured corpus\n`,
    `> Generated ${today} by \`tools/audit-splat-books.mjs\` from an OFFLINE scan (\`tools/scan-corpus-offline.mjs\`, copies of the module's packs; the sandbox untouched). Evidence, not verdicts — the plan is [plans/splat-books.md](../plans/splat-books.md). **Structure**: fxN an effect count (its statuses), save / atk / dmg the activities, REACTION a reaction activity, TEXT a paragraph only. **Known**: a registry table already keyed on the NAME — a reprint that fires for free, or a collision to guard.\n`,
    `**Totals:** ${summary(mine)}\n`];

  const species = mine.filter(x => x.kind === "race").sort(byLevelName);
  if (species.length) parts.push(`## Species traits (${species.length})\n\n${table(species)}\n`);

  const subs = owners.filter(o => o.pack.startsWith(`${mod}.`) && o.type === "subclass").sort((a, b) => (a.classIdentifier ?? "").localeCompare(b.classIdentifier ?? "") || a.name.localeCompare(b.name));
  if (subs.length) {
    parts.push(`## Subclasses (${subs.length})\n`);
    for (const s of subs) {
      const feats = mine.filter(x => x.kind === "subclass" && x.owner === s.name).sort(byLevelName);
      parts.push(`### ${s.name} (${s.classIdentifier ?? "?"}) — ${summary(feats)}\n\n${table(feats)}\n`);
    }
  }
  const orphans = mine.filter(x => x.kind === "class?").sort(byLevelName);
  if (orphans.length) parts.push(`## Options nothing grants (${orphans.length})\n\n${table(orphans)}\n`);

  const feats = mine.filter(x => x.kind === "feat").sort(byLevelName);
  if (feats.length) parts.push(`## Feats (${feats.length}) — ${summary(feats)}\n\n${table(feats, { extra: x => x.featType === "origin" ? "origin" : (x.level ?? "") })}\n`);

  const spells = mine.filter(x => x.kind === "spell").sort(byLevelName);
  if (spells.length) parts.push(`## Spells (${spells.length}) — ${summary(spells)}\n\n${table(spells)}\n`);

  const items = mine.filter(x => x.kind === "dm").sort((a, b) => a.name.localeCompare(b.name));
  if (items.length) {
    const c = items.filter(combatish), rest = items.filter(x => !combatish(x));
    parts.push(`## Items (${items.length}) — ${summary(items)}\n\n### Combat-shaped (${c.length})\n\n${table(c, { extra: x => x.itemType })}\n\n### The rest (${rest.length})\n\n${rest.map(x => `${esc(x.name)} (${x.itemType})`).join(" · ")}\n`);
  }

  const gifts = mine.filter(x => x.kind === "gift").sort(byLevelName);
  if (gifts.length) parts.push(`## Supernatural gifts (${gifts.length})\n\n${table(gifts)}\n`);

  const mon = mine.filter(x => x.kind === "monster");
  if (mon.length) {
    const c = mon.filter(combatish).sort((a, b) => a.name.localeCompare(b.name));
    const byPack = {};
    for (const x of mon) (byPack[x.pack] ??= new Set()).add(x.actor);
    parts.push(`## Bestiary traits, actions and reactions (${mon.length} distinct names across ${Object.entries(byPack).map(([p, s]) => `${s.size} actors in ${p.split(".").pop()}`).join(", ")}) — ${summary(mon)}\n`);
    parts.push(`> Deduplicated by name (one Multiattack). The first column names ONE bearer.\n\n### Combat-shaped (${c.length})\n\n${table(c, { extra: x => `${esc(x.actor)} (CR ${x.cr ?? "?"})` })}\n`);
    const rest = mon.filter(x => !combatish(x)).map(x => esc(x.name)).sort();
    parts.push(`### The rest (${rest.length})\n\n${rest.join(" · ")}\n`);
  }
  writeFileSync(join(out, file), parts.join("\n"));
  files.push(file);
  console.log(`${title}: ${summary(mine)}`);
}
console.log(`[audit-splat-books] → ${out}/ (${files.join(", ")})`);
