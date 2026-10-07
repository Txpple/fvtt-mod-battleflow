// Compact the probe's snapshot into what the build checks against: every pack item's
// identifier by type, and every effect name. No Foundry.
//
//   node tools/compact-identifiers.mjs [in.json] [out.json]
//     default: tools/content/identifier-snapshot.json → tools/content/identifiers.json
import { readFileSync, writeFileSync } from "node:fs";

const inFile = process.argv[2] ?? "tools/content/identifier-snapshot.json";
const outFile = process.argv[3] ?? "tools/content/identifiers.json";
const snap = JSON.parse(readFileSync(inFile, "utf8"));

const byType = {};
const ids = {};   // pack → item ids, what a rule pointer's uuid is checked against
for ( const row of snap.items ) {
  const m = /^Compendium\.(.+)\.Item\.([^.]+)$/.exec(row.uuid ?? "");
  if ( m ) (ids[m[1]] ??= []).push(m[2]);
}
const effects = new Set();
for ( const row of snap.items ) {
  if ( row.identifier ) (byType[row.type] ??= new Set()).add(row.identifier);
  for ( const e of row.effects ?? [] ) effects.add(e);
}
const out = {
  system: snap.system,
  foundry: snap.foundry,
  packs: snap.packs.map(p => p.id),
  identifiers: Object.fromEntries(Object.entries(byType).sort().map(([t, s]) => [t, [...s].sort()])),
  effects: [...effects].sort(),
  items: Object.fromEntries(Object.entries(ids).sort().map(([pack, list]) => [pack, list.sort()]))
};
writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
console.log(`[compact] dnd5e ${out.system}: ${Object.values(out.identifiers).reduce((n, a) => n + a.length, 0)} identifiers, `
  + `${out.effects.length} effect names → ${outFile}`);
