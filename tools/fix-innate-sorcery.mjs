// The 2026-08-18 session's finding ⑦ — WORLD CONTENT, not module code: Gren's Innate
// Sorcery arrived from the DDB import with its embedded ActiveEffect stripped (the same
// silent pattern as Thomas's Divine Favor and Salyth's Thaumaturgy, grafted back
// 2026-08-17 — that audit covered the 42 SPELL copies; this one grafts the feat and
// sweeps every PC's FEATURES for activity→ghost-effect references). The graft preserves
// the compendium's _id so the activity's existing reference binds.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[fix] WATCHDOG 120s'); process.exit(3); }, 120_000);
const f = new Foundry(foundryConfig(env));
await f.connect();
const out = await f.evaluate(async () => {
  const report = { grafted: null, ghosts: [] };
  // 1. the sweep: every PC feature whose activities reference effect ids the item lacks
  const pcs = game.actors.filter(a => (a.type === 'character') && a.hasPlayerOwner);
  for (const pc of pcs) {
    for (const item of pc.items) {
      for (const act of (item.system.activities ?? [])) {
        for (const ref of (act.effects ?? [])) {
          const id = ref._id ?? ref.id;
          if (id && !item.effects.get(id)) {
            report.ghosts.push({ actor: pc.name, item: item.name, type: item.type,
              activity: act.name || act.type, ghostEffectId: id });
          }
        }
      }
    }
  }
  // 2. the graft: Gren's Innate Sorcery gets the compendium's effect, same _id
  const gren = game.actors.getName('Gren Greenmantle');
  const feat = gren?.items.find(i => i.name === 'Innate Sorcery');
  if (feat && !feat.effects.size) {
    const pack = game.packs.get('dnd-players-handbook.classes');
    const src = await pack?.getDocument('phbscrInnateSorc');
    const eff = src?.effects.get('WtiHwWONdmCOeSDR');
    if (eff) {
      const data = eff.toObject();
      data.origin = feat.uuid; // the world item is the origin now, not the compendium
      await feat.createEmbeddedDocuments('ActiveEffect', [data], { keepId: true });
      report.grafted = { actor: gren.name, item: feat.name, effectId: data._id,
        changes: data.system?.changes ?? data.changes ?? [], disabled: data.disabled,
        nowBound: !!feat.system.activities?.some?.(a =>
          (a.effects ?? []).some(r => (r._id ?? r.id) === data._id)) };
    } else report.grafted = { error: 'compendium effect not found' };
  } else if (feat?.effects.size) report.grafted = { skipped: 'effect already present' };
  else report.grafted = { error: 'Gren or the feat not found' };
  return report;
}, null);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
