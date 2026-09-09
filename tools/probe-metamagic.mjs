// Read-only probe (2026-09-09, the metamagic pass, Stage 0): does the BUILT Sorcerer fixture
// carry what the pass will read? Every metamagic option's activity names Font of Magic as its
// `itemUses` target by COMPENDIUM UUID (measured on Gren's sheet 2026-09-09); this asserts that
// `poolOf` resolves it on the fixture, that the pool's `@scale.sorcerer.points` reads a number,
// and it dumps the three spells' shapes (save / range / duration / damage types / target
// scaling) so the eligibility predicates are written from measurement. Nothing is written.
//
//   node tools/probe-metamagic.mjs [out.json]
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight).
import { writeFileSync } from "node:fs";
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const outFile = process.argv[2] ?? null;
const f = await connectSuite({ tag: "probe-metamagic", watchdogMs: 300_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async () => {
  const OPTIONS = ["Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell",
    "Quickened Spell", "Seeking Spell", "Subtle Spell", "Transmuted Spell", "Twinned Spell"];
  const actor = game.actors.getName("BF Test Sorcerer");
  if (!actor) return { ok: false, why: "BF Test Sorcerer is not on the world — run tools/fixture-suite.mjs first" };
  const shared = await import("/modules/fvtt-mod-battleflow/scripts/shared.js");
  const pool = actor.items.find(i => i.name === "Font of Magic");
  const rows = [];
  for (const name of OPTIONS) {
    const item = actor.items.find(i => (i.type === "feat") && (i.name === name));
    if (!item) { rows.push({ name, ok: false, why: "not on the sheet" }); continue; }
    const activity = item.system.activities?.contents?.[0] ?? null;
    const target = activity?.consumption?.targets?.find(t => t.type === "itemUses") ?? null;
    const resolved = activity ? shared.poolOf(actor, activity) : null;
    rows.push({
      name, subtype: item.system.type?.subtype ?? null, activity: activity?.type ?? null,
      condition: activity?.activation?.condition ?? "", cost: target?.value ?? null, target: target?.target ?? null,
      affectsCount: activity?.target?.affects?.count ?? null,
      ok: !!resolved && (resolved.id === pool?.id), resolvedTo: resolved?.name ?? null
    });
  }
  const spellOf = n => {
    const s = actor.items.find(i => (i.type === "spell") && (i.name === n));
    if (!s) return { name: n, ok: false };
    const acts = s.system.activities?.contents ?? [];
    return {
      name: n, level: s.system.level, properties: [...(s.system.properties ?? [])],
      range: { value: s.system.range?.value, units: s.system.range?.units },
      duration: { value: s.system.duration?.value, units: s.system.duration?.units, concentration: !!s.system.duration?.concentration ?? !!s.system.properties?.has?.("concentration") },
      target: { type: s.system.target?.affects?.type, count: s.system.target?.affects?.count, template: s.system.target?.template?.type, size: s.system.target?.template?.size },
      activities: acts.map(a => ({
        type: a.type, name: a.name, save: a.save ? { ability: [...(a.save.ability ?? [])], dc: a.save.dc?.value } : null,
        attack: a.attack ? a.attack.type?.value : null,
        damage: (a.damage?.parts ?? []).map(p => ({ number: p.number, denomination: p.denomination, types: [...(p.types ?? [])], scaling: p.scaling?.mode ?? null })),
        onSave: a.damage?.onSave ?? null,
        rangeOverride: !!a.range?.override, targetOverride: !!a.target?.override, targetCount: a.target?.affects?.count ?? null,
        consumption: (a.consumption?.targets ?? []).map(t => ({ type: t.type, target: t.target, value: t.value, scaling: t.scaling?.mode ?? null })),
        scalingAllowed: !!a.consumption?.scaling?.allowed
      }))
    };
  };
  return {
    ok: rows.every(r => r.ok),
    pool: pool ? { name: pool.name, max: pool.system.uses?.max, resolvedMax: pool.system.uses?.max === "@scale.sorcerer.points" ? (actor.getRollData().scale?.sorcerer?.points ?? null) : null, value: pool.system.uses?.value, spent: pool.system.uses?.spent, recovery: (pool.system.uses?.recovery ?? []).map(r => r.period) } : null,
    cha: actor.system.abilities?.cha?.mod ?? null, level: actor.system.details?.level ?? null,
    rows, spells: ["Fireball", "Hold Person", "Chromatic Orb"].map(spellOf)
  };
});
console.log(JSON.stringify(out, null, 2));
if (outFile) writeFileSync(outFile, JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-metamagic");
process.exit(out.ok ? 0 : 1);
