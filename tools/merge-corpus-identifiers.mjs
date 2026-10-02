// Merge an OFFLINE corpus's rows into the identifiers snapshot the build checks against
// (tools/content/identifiers.json). The live probe (probe-identifiers.mjs) opens the Item packs and the
// world's actors; a book's bestiary is an Actor pack it never opens, and a book installed after the probe
// ran is missing whole. A pack item whose identifier is left blank takes its name's slug (what dnd5e derives
// for it on a sheet, and what a registry row finds it by). No Foundry: the corpus comes from
// scan-corpus-offline.mjs.
//
//   node tools/merge-corpus-identifiers.mjs <corpus.json> [tools/content/identifiers.json]
import { readFileSync, writeFileSync } from "node:fs";
import { identifierOf } from "../scripts/decide/registry.js";

const [file, out = "tools/content/identifiers.json"] = process.argv.slice(2);
if ( !file ) { console.error("usage: node tools/merge-corpus-identifiers.mjs <corpus.json> [identifiers.json]"); process.exit(2); }
const corpus = JSON.parse(readFileSync(file, "utf8"));
const snap = JSON.parse(readFileSync(out, "utf8"));

let ids = 0, fx = 0, items = 0;
const packs = new Set();
for ( const r of corpus.rows ) {
  packs.add(r.pack);
  const identifier = r.identifier || identifierOf(r.name);
  if ( identifier && r.itemType ) {
    const list = (snap.identifiers[r.itemType] ??= []);
    if ( !list.includes(identifier) ) { list.push(identifier); ids++; }
  }
  for ( const e of r.effects ?? [] ) {
    if ( e?.name && !snap.effects.includes(e.name) ) { snap.effects.push(e.name); fx++; }
  }
  const m = /^Compendium\.(.+)\.Item\.([^.]+)$/.exec(r.uuid ?? "");
  if ( m ) {
    const list = (snap.items[m[1]] ??= []);
    if ( !list.includes(m[2]) ) { list.push(m[2]); items++; }
  }
}
for ( const p of packs ) if ( !snap.packs.includes(p) ) snap.packs.push(p);
for ( const t of Object.keys(snap.identifiers) ) snap.identifiers[t].sort();
snap.effects.sort();
for ( const p of Object.keys(snap.items) ) snap.items[p].sort();
snap.items = Object.fromEntries(Object.entries(snap.items).sort());
writeFileSync(out, `${JSON.stringify(snap, null, 1)}\n`);
console.log(`[merge] ${packs.size} packs: +${ids} identifiers, +${fx} effect names, +${items} item ids → ${out}`);
