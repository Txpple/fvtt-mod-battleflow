// Read-only probe (2026-09-04, the overnight commissions): the SHAPE of a set of items as the
// 2024 packs ship them — activities, effects, targets, ranges — dumped as JSON so a table row is
// written from measurement rather than memory. Nothing is written to the world.
//
//   node tools/probe-pack-shapes.mjs <out.json> [name ...]     default: the overnight set
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight).
import { writeFileSync } from "node:fs";
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const argv = process.argv.slice(2);
const outFile = argv[0];
const names = argv.slice(1);
if (!outFile) { console.error("usage: node tools/probe-pack-shapes.mjs <out.json> [name ...]"); process.exit(2); }
const f = await connectSuite({ tag: "probe-shapes", watchdogMs: 600_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async ({ names }) => {
  const DEFAULT = ["Death Armor", "Fire Shield", "Armor of Agathys", "Heat Metal", "Hellish Rebuke",
    "Aura of Vitality", "Antilife Shell", "Aura of Life", "Aura of Purity", "Spirit Guardians",
    "Ambush", "Bait and Switch", "Commander's Strike", "Evasive Footwork", "Feinting Attack", "Lunging Attack", "Parry", "Rally", "Tactical Assessment",
    "Combat Superiority", "Tactical Mind", "Uncanny Dodge"];
  const wanted = new Set((names.length ? names : DEFAULT).map(n => n.toLowerCase()));
  const strip = html => (html ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  const effectOf = e => ({ id: e.id, name: e.name, transfer: e.transfer, disabled: e.disabled, statuses: [...(e.statuses ?? [])],
    duration: e.duration?.toObject?.() ?? e.duration, changes: e.changes?.map(c => ({ key: c.key, mode: c.mode, value: c.value })) ?? [], description: strip(e.description).slice(0, 300) });
  const activityOf = a => ({
    id: a.id, type: a.type, name: a.name, activation: a.activation?.type ?? null, actOverride: !!a.activation?.override, actCondition: a.activation?.condition || "",
    range: a.range ? { value: a.range.value, units: a.range.units, reach: a.range.reach } : null,
    target: a.target ? { affects: a.target.affects?.type ?? null, count: a.target.affects?.count ?? null, template: a.target.template ? { type: a.target.template.type, size: a.target.template.size, units: a.target.template.units } : null } : null,
    duration: a.duration ? { value: a.duration.value, units: a.duration.units, concentration: a.duration.concentration, override: a.duration.override } : null,
    save: a.save ? { ability: [...(a.save.ability ?? [])], dc: { calculation: a.save.dc?.calculation, formula: a.save.dc?.formula, value: a.save.dc?.value } } : null,
    attack: a.attack ? { type: a.attack.type?.value, classification: a.attack.type?.classification } : null,
    damage: a.damage ? { onSave: a.damage.onSave ?? null, critical: a.damage.critical ?? null, parts: (a.damage.parts ?? []).map(p => ({ number: p.number, denomination: p.denomination, bonus: p.bonus, types: [...(p.types ?? [])], custom: p.custom?.enabled ? p.custom.formula : null, scaling: p.scaling ? { mode: p.scaling.mode, number: p.scaling.number, formula: p.scaling.formula } : null })) } : null,
    healing: a.healing ? { number: a.healing.number, denomination: a.healing.denomination, bonus: a.healing.bonus, types: [...(a.healing.types ?? [])], custom: a.healing.custom?.enabled ? a.healing.custom.formula : null, scaling: a.healing.scaling ? { mode: a.healing.scaling.mode, number: a.healing.scaling.number, formula: a.healing.scaling.formula } : null } : null,
    effects: (a.effects ?? []).map(e => ({ id: e._id, onSave: e.onSave ?? null, resolves: !!e.effect, name: e.effect?.name ?? null })),
    uses: a.uses ? { max: a.uses.max, spent: a.uses.spent, recovery: (a.uses.recovery ?? []).map(r => r.period) } : null,
    consumption: (a.consumption?.targets ?? []).map(t => ({ type: t.type, target: t.target, value: t.value, scaling: t.scaling?.mode ?? null })),
    roll: a.roll ? { formula: a.roll.formula, name: a.roll.name, prompt: a.roll.prompt, visible: a.roll.visible } : null,
    bonus: a.bonus ?? null,
    description: strip(a.description?.chatFlavor ?? "").slice(0, 200)
  });
  const items = [];
  const seen = new Set();
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    const id = pack.metadata.id;
    if (id.startsWith("JB2A") || id.startsWith("dnd5e-animations")) continue;
    const index = await pack.getIndex({ fields: ["type"] });
    for (const entry of index) {
      if (!wanted.has(entry.name.toLowerCase())) continue;
      const doc = await pack.getDocument(entry._id).catch(() => null);
      if (!doc) continue;
      const key = `${id}|${doc.name}|${doc.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sys = doc.system;
      items.push({
        pack: id, uuid: doc.uuid, name: doc.name, type: doc.type, subtype: sys.type?.value ?? sys.type?.subtype ?? null, identifier: sys.identifier ?? null,
        level: sys.level ?? null, school: sys.school ?? null, prepared: sys.preparation?.mode ?? sys.method ?? null,
        duration: sys.duration ? { value: sys.duration.value, units: sys.duration.units, concentration: sys.duration.concentration } : null,
        range: sys.range ? { value: sys.range.value, units: sys.range.units } : null,
        target: sys.target ? { affects: sys.target.affects?.type ?? null, template: sys.target.template ? { type: sys.target.template.type, size: sys.target.template.size } : null } : null,
        properties: [...(sys.properties ?? [])],
        uses: sys.uses ? { max: sys.uses.max, spent: sys.uses.spent, recovery: (sys.uses.recovery ?? []).map(r => r.period) } : null,
        requirements: sys.requirements ?? null,
        activities: [...(sys.activities ?? [])].map(activityOf),
        effects: doc.effects.map(effectOf),
        text: strip(sys.description?.value).slice(0, 1400)
      });
    }
  }
  return { items, system: game.system.version, foundry: game.version };
}, { names });
writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`[probe-shapes] ${out.items.length} items → ${outFile}`);
for (const i of out.items) console.log(`  ${i.pack} :: ${i.name} (${i.type}${i.subtype ? "/" + i.subtype : ""}) acts=${i.activities.map(a => `${a.type}:${a.name || "-"}`).join(",")} effects=${i.effects.map(e => `${e.name}${e.transfer ? "[T]" : ""}`).join(",")}`);
await disposeSafely(f, "probe-shapes");
process.exit(0);
