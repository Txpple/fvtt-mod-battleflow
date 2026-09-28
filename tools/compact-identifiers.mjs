// Compact the probe's snapshot into what the build checks against: every pack and world item's
// identifier by type, and every effect name. No Foundry.
//
//   node tools/compact-identifiers.mjs [in.json] [out.json]
//     default: tools/content/identifier-snapshot.json → tools/content/identifiers.json
import { readFileSync, writeFileSync } from "node:fs";

const inFile = process.argv[2] ?? "tools/content/identifier-snapshot.json";
const outFile = process.argv[3] ?? "tools/content/identifiers.json";
const snap = JSON.parse(readFileSync(inFile, "utf8"));

const byType = {};
const effects = new Set();
for ( const row of [...snap.items, ...snap.actors] ) {
  if ( row.identifier ) (byType[row.type] ??= new Set()).add(row.identifier);
  for ( const e of row.effects ?? [] ) effects.add(e);
}
const out = {
  system: snap.system,
  foundry: snap.foundry,
  packs: snap.packs.map(p => p.id),
  identifiers: Object.fromEntries(Object.entries(byType).sort().map(([t, s]) => [t, [...s].sort()])),
  effects: [...effects].sort()
};
writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
console.log(`[compact] dnd5e ${out.system}: ${Object.values(out.identifiers).reduce((n, a) => n + a.length, 0)} identifiers, `
  + `${out.effects.length} effect names → ${outFile}`);
