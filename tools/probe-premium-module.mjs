// Read-only probe (2026-09-24, Arcana Unleashed): what a PREMIUM MODULE ships, pack by pack —
// counts, document types, names — and which of its names the module already keys a row on
// (a reprint under the same name matches a name-keyed table twice; a new option the table
// closes over, a Metamagic or a maneuver, is missing from it). Written so the next book the
// house buys is measured the same way rather than described from memory. Nothing is written
// to the world.
//
//   node tools/probe-premium-module.mjs <module-id> <out.json>
//   node tools/probe-premium-module.mjs dnd-arcana-unleashed dist/arcana.json
//
// ⚠ No sole-GM preflight, on purpose: this reads pack INDEXES and nothing else, so it does not
// care who the elect is and a second GM-capable client cannot corrupt it (target.mjs's
// preflight guards suites that assert on applications). It still resolves its target through
// target.mjs like every other tool, and it prints who else is connected for the record.
import { writeFileSync } from "node:fs";
import { Foundry, loadEnv } from "fvtt-mcp-dnd5e/client";
import * as R from "../scripts/decide/registry.js";
import { disposeSafely } from "./harness.mjs";
import { foundryConfig } from "./target.mjs";

const [moduleId, outFile] = process.argv.slice(2);
if (!moduleId || !outFile) { console.error("usage: node tools/probe-premium-module.mjs <module-id> <out.json>"); process.exit(2); }

setTimeout(() => { console.error("[probe-premium] WATCHDOG 300s — hard abort"); process.exit(3); }, 300_000);
const f = new Foundry(foundryConfig(loadEnv()));
await f.connect();

const out = await f.evaluate(async ({ moduleId }) => {
  const who = { self: game.user.name, elect: game.users.activeGM?.name ?? null, gms: game.users.filter(u => u.active && u.isGM).map(u => u.name) };
  const mod = game.modules.get(moduleId);
  const module = mod ? { id: mod.id, title: mod.title, version: mod.version, active: mod.active,
    requires: (mod.relationships?.requires ?? []).map(r => `${r.id}${r.compatibility?.minimum ? ` >= ${r.compatibility.minimum}` : ""}`),
    systems: (mod.relationships?.systems ?? []).map(r => `${r.id}${r.compatibility?.minimum ? ` >= ${r.compatibility.minimum}` : ""}`) } : null;
  const packs = {};
  for (const pack of game.packs) {
    const id = pack.metadata.id;
    if (!id.startsWith(`${moduleId}.`)) continue;
    const entry = { id, label: pack.metadata.label, documentName: pack.documentName, size: 0, types: {}, rows: [] };
    try {
      const fields = pack.documentName === "Item"
        ? ["type", "system.type.value", "system.type.subtype", "system.level", "system.school", "system.properties", "system.duration.concentration", "system.requirements"]
        : pack.documentName === "Actor" ? ["type", "system.details.cr", "system.details.type.value"]
        : pack.documentName === "ActiveEffect" ? ["type", "transfer", "statuses", "changes"] : ["type"];
      const index = await pack.getIndex({ fields });
      entry.size = index.size ?? index.length ?? 0;
      for (const e of index) {
        const t = e.type ?? "-";
        const sub = e.system?.type?.value || e.system?.type?.subtype || null;
        const key = sub ? `${t}/${sub}` : t;
        entry.types[key] = (entry.types[key] ?? 0) + 1;
        const row = { name: e.name, type: key };
        if (e.system?.level !== undefined) row.level = e.system.level;
        if (e.system?.school) row.school = e.system.school;
        if (e.system?.duration?.concentration) row.concentration = true;
        if (e.system?.properties?.length) row.properties = [...e.system.properties];
        if (e.system?.requirements) row.requirements = e.system.requirements;
        if (e.system?.details?.cr !== undefined) row.cr = e.system.details.cr;
        if (e.system?.details?.type?.value) row.creatureType = e.system.details.type.value;
        if (e.transfer !== undefined) row.transfer = e.transfer;
        if (e.statuses?.length) row.statuses = [...e.statuses];
        if (e.changes?.length) row.changes = e.changes.map(c => c.key);
        entry.rows.push(row);
      }
    } catch (err) { entry.error = String(err?.message ?? err); }
    packs[id] = entry;
  }
  // The 2024 packs' names the sweep already reads, for the reprint check.
  const known = {};
  for (const pid of ["dnd-players-handbook.spells", "dnd-players-handbook.feats", "dnd-players-handbook.classes", "dnd-players-handbook.origins", "dnd-heroes-faerun.options", "dnd-dungeon-masters-guide.equipment"]) {
    const pack = game.packs.get(pid);
    if (!pack) continue;
    const index = await pack.getIndex({ fields: ["type"] });
    known[pid] = [...index].map(e => ({ name: e.name, type: e.type }));
  }
  // The book's own table of contents: the journal entries and their page names.
  let book = null;
  const bookPack = [...game.packs].find(p => p.metadata.id.startsWith(`${moduleId}.`) && p.documentName === "JournalEntry");
  if (bookPack) {
    try {
      book = [];
      for (const e of await bookPack.getIndex()) {
        const doc = await bookPack.getDocument(e._id).catch(() => null);
        if (doc) book.push({ name: doc.name, pages: doc.pages.map(p => p.name) });
      }
    } catch (err) { book = { error: String(err?.message ?? err) }; }
  }
  return { who, module, packs, known, book, system: game.system.version, foundry: game.version };
}, { moduleId });

// ---- offline: the names the registry keys a row on (table keys, feature/name fields, the
// settings lists' shipped defaults), and the names the 2024 packs already carry
const keyed = new Map();
const note = (name, where) => { const k = name.toLowerCase(); if (!keyed.has(k)) keyed.set(k, []); keyed.get(k).push(where); };
for (const [tname, table] of Object.entries(R)) {
  if (!table || typeof table !== "object" || table instanceof Set || Array.isArray(table)) continue;
  for (const [k, row] of Object.entries(table)) {
    if (/^[A-Z]/.test(k)) note(k, tname);
    if (row && typeof row === "object") for (const fld of ["feature", "name", "spell", "item"]) if (typeof row[fld] === "string") note(row[fld], `${tname}.${fld}`);
  }
}
for (const [k, spec] of Object.entries(R.LIST_SPECS ?? {})) for (const part of String(spec?.default ?? "").split(",")) {
  const n = part.split(":")[0].trim();
  if (n) note(n, `LIST_SPECS.${k}`);
}
const knownNames = new Map();
for (const [pid, rows] of Object.entries(out.known)) for (const r of rows) {
  const k = r.name.toLowerCase();
  if (!knownNames.has(k)) knownNames.set(k, []);
  knownNames.get(k).push(`${pid}:${r.type}`);
}
out.collisions = { registry: [], reprints: [] };
for (const [pid, entry] of Object.entries(out.packs)) {
  if (entry.documentName !== "Item") continue;
  for (const row of entry.rows) {
    const k = row.name.toLowerCase();
    if (keyed.has(k)) out.collisions.registry.push({ pack: pid, name: row.name, type: row.type, tables: keyed.get(k) });
    if (knownNames.has(k)) out.collisions.reprints.push({ pack: pid, name: row.name, type: row.type, also: knownNames.get(k) });
  }
}
writeFileSync(outFile, JSON.stringify(out, null, 2));

console.log(`[probe-premium] foundry ${out.foundry} / dnd5e ${out.system} — connected as ${out.who.self}; elect ${out.who.elect}; GM-capable clients: ${out.who.gms.join(", ")}`);
console.log(`[probe-premium] module ${JSON.stringify(out.module)}`);
for (const [pid, e] of Object.entries(out.packs)) {
  console.log(`  ${pid} (${e.label}, ${e.documentName}): ${e.size}${e.error ? ` ERROR ${e.error}` : ""} —${Object.entries(e.types).map(([t, n]) => `${t} ${n}`).join(", ")}`);
}
console.log(`[probe-premium] names the registry already keys on: ${out.collisions.registry.length}`);
for (const c of out.collisions.registry) console.log(`  ${c.pack} :: ${c.name} (${c.type}) ↔ ${c.tables.join(", ")}`);
console.log(`[probe-premium] names the 2024 packs already carry (reprints): ${out.collisions.reprints.length}`);
for (const c of out.collisions.reprints) console.log(`  ${c.pack} :: ${c.name} (${c.type}) ↔ ${c.also.join(", ")}`);
if (Array.isArray(out.book)) for (const b of out.book) console.log(`[book] ${b.name}: ${b.pages.length} pages — ${b.pages.slice(0, 80).join(" | ")}`);
console.log(`[probe-premium] → ${outFile}`);
await disposeSafely(f, "probe-premium");
process.exit(0);
