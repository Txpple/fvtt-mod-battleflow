// Audit (2026-09-03): which 2024 save activities PRESS a condition in their text but ship no
// effect carrying it? Those are the `SAVE_PRESSES` candidates — Web's shape (BACKLOG: "a
// SAVE_PRESSES row is one spell; the pack has more like it"). Offline, over scan-corpus.mjs's
// JSON. The scan cannot tell a press from a carried effect by text alone (SWEEP §3 item 7), so
// this reads BOTH: the condition names the text presses on a failed save, and the statuses on
// the row's effects. A row is BARE when a pressed condition has no effect carrying its status.
//
//   node tools/audit-presses.mjs <corpus.json> [--all]     --all lists the carried rows too
import { readFileSync } from "node:fs";

const [file, ...flags] = process.argv.slice(2);
if ( !file ) { console.error("usage: node tools/audit-presses.mjs <corpus.json> [--all]"); process.exit(2); }
const ALL = flags.includes("--all");
const raw = JSON.parse(readFileSync(file, "utf8"));

// The 2024 corpus, premium first, SRD 2024 as its subset, legacy dropped — classify-corpus's rule.
const PACK_RANK = {
  "dnd-players-handbook.spells": 1, "dnd-players-handbook.classes": 1, "dnd-players-handbook.origins": 1,
  "dnd-players-handbook.feats": 1, "dnd-heroes-faerun.options": 1, "dnd-dungeon-masters-guide.equipment": 1,
  "dnd5e.spells24": 2, "dnd5e.classes24": 2, "dnd5e.origins24": 2, "dnd5e.feats24": 2
};
const rows = raw.rows.filter(r => PACK_RANK[r.pack]);
const seen = new Map();
for ( const r of rows ) {
  const key = r.name.toLowerCase();
  const prev = seen.get(key);
  if ( !prev || (PACK_RANK[r.pack] < PACK_RANK[prev.pack]) ) seen.set(key, r);
}

// The thirteen 2024 conditions the system carries as statuses (plus Exhaustion, a level).
const CONDITIONS = {
  Blinded: "blinded", Charmed: "charmed", Deafened: "deafened", Frightened: "frightened", Grappled: "grappled",
  Incapacitated: "incapacitated", Invisible: "invisible", Paralyzed: "paralyzed", Petrified: "petrified",
  Poisoned: "poisoned", Prone: "prone", Restrained: "restrained", Stunned: "stunned", Unconscious: "unconscious"
};
// 2024 pack text writes a condition as an enricher — "or have the Reference[restrained apply=false]
// condition" — so the status ID inside the token is the reliable read; the plain word is the
// fallback for the few rows written out in prose.
const IDS = Object.values(CONDITIONS).join("|");
const PRESS = new RegExp(`Reference\\[(${IDS})\\b[^\\]]*\\]|\\b(?:has|have|gains?|is|are|becomes?|suffers?)\\s+(?:the\\s+)?(${Object.keys(CONDITIONS).join("|")})(?:\\s+condition)?\\b`, "g");
// 2024 phrasing is "must succeed on a X saving throw or have the Y condition" as often as "on a failed save".
const FAIL = /fail(?:ed|s|ure)?|saving throw or|save or|saving throw,? or/i;

const bare = [];
const carried = [];
for ( const r of seen.values() ) {
  const saveActs = (r.activities ?? []).filter(a => a.type === "save");
  if ( !saveActs.length ) continue;
  const text = r.text ?? "";
  if ( !FAIL.test(text) ) continue;
  const pressed = new Set();
  for ( const m of text.matchAll(PRESS) ) pressed.add(m[1] ?? CONDITIONS[m[2]]);
  if ( !pressed.size ) continue;
  const statuses = new Set((r.effects ?? []).flatMap(e => e.statuses ?? []));
  const missing = [...pressed].filter(s => !statuses.has(s));
  const row = { name: r.name, kind: r.itemType === "spell" ? `spell L${r.level}` : (r.featType ?? r.itemType), pack: r.pack,
    pressed: [...pressed], carried: [...statuses], missing };
  (missing.length ? bare : carried).push(row);
}
bare.sort((a, b) => a.name.localeCompare(b.name));
carried.sort((a, b) => a.name.localeCompare(b.name));

console.log(`# 2024 save activities whose text presses a condition: ${bare.length + carried.length} — BARE (no effect carries it): ${bare.length}, carried: ${carried.length}`);
console.log("\n## BARE — SAVE_PRESSES candidates (text presses it, no shipped effect carries the status)");
for ( const r of bare ) console.log(`  ${r.name.padEnd(34)} ${r.kind.padEnd(12)} presses ${r.missing.join("+").padEnd(24)} carried [${r.carried.join(", ")}]  ${r.pack}`);
if ( ALL ) {
  console.log("\n## carried — the pack's effect already applies it on the failed save");
  for ( const r of carried ) console.log(`  ${r.name.padEnd(34)} ${r.kind.padEnd(12)} ${r.pressed.join("+").padEnd(24)} [${r.carried.join(", ")}]`);
}
