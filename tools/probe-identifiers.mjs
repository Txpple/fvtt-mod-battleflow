// Read-only probe: every Item in every Item pack, with its identifier, rules version, book and compendium source, plus the names of its effects: what the
// code tables are measured against. Packs only: a world's own actors are one table's content, never
// the measure (2026-10-07 — a campaign's homebrew item had leaked into the list).
//
//   node tools/probe-identifiers.mjs [out.json]     default: tools/content/identifier-snapshot.json
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight).
import { writeFileSync } from "node:fs";
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const outFile = process.argv[2] ?? "tools/content/identifier-snapshot.json";
const f = await connectSuite({ tag: "probe-identifiers", watchdogMs: 900_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async () => {
  const rowOf = (doc, where) => ({
    where,
    name: doc.name,
    type: doc.type,
    identifier: doc.system?.identifier ?? null,
    rules: doc.system?.source?.rules ?? null,
    book: doc.system?.source?.book ?? null,
    source: doc._stats?.compendiumSource ?? null,
    effects: doc.effects?.map(e => e.name) ?? []
  });
  const packs = [];
  const items = [];
  for ( const pack of game.packs ) {
    if ( pack.documentName !== "Item" ) continue;
    const id = pack.metadata.id;
    if ( id.startsWith("JB2A") || id.startsWith("dnd5e-animations") ) continue;
    const docs = await pack.getDocuments().catch(() => []);
    packs.push({ id, label: pack.metadata.label, count: docs.length });
    for ( const doc of docs ) items.push({ uuid: doc.uuid, ...rowOf(doc, id) });
  }
  return { system: game.system.version, foundry: game.version, packs, items };
});
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`[probe-identifiers] dnd5e ${out.system}, ${out.packs.length} packs, ${out.items.length} pack items → ${outFile}`);
for ( const p of out.packs ) console.log(`  ${p.id} (${p.count})`);
await disposeSafely(f, "probe-identifiers");
process.exit(0);
