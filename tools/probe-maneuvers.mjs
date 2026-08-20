// P2 — READ-ONLY probe of the world's real maneuver + feat shapes (Pass A step 0).
//
// The Precision/Riposte folds and the Shield Master content graft key on what the 2024 content
// actually ships, and none of it has ever been read by this repo. Questions:
//
//   1  Morgash's Precision Attack + Riposte items — type, activities (type/activation/consumption/
//      roll), where the superiority die formula lives (@scale key), item- vs resource-level uses
//   2  Riposte's activation.type — is it "reaction" (does hold.js's reactionSpent trip naturally)?
//   3  What does activity.use({}, {configure:false}, {}) POST — a card, a die roll, both?
//      (used once on Morgash's own item, uses restored afterwards — sandbox only)
//   4  Shield Master — does the feat carry a save activity, its DC shape, and is activity.effects
//      EMPTY (the content gap the graft fills)?
//
// ⚠ SANDBOX ONLY for question 3 — it mutates uses and restores them. Refuses BF_TARGET=prod.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, preflightSoleGM, isProdTarget } from './target.mjs';

if (isProdTarget()) { console.error('[maneuvers] refuses to run on prod — it uses an item'); process.exit(2); }

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[maneuvers] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
const who = await preflightSoleGM(f, { requireElect: false });
console.log(`[maneuvers] connected as "${who.self}"`);

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  const owner = game.actors.find(a => a.name.toLowerCase().includes('morgash'));
  if (!owner) return { fatal: 'no actor matching "morgash" in this world' };
  log.push(`owner: ${owner.name} (${owner.uuid})`);

  const dumpActivity = a => ({
    id: a.id, type: a.type, name: a.name,
    activation: { type: a.activation?.type ?? null, override: a.activation?.override ?? null },
    consumption: (a.consumption?.targets ?? []).map(t => ({ type: t.type, target: t.target, value: t.value, scaling: t.scaling?.mode ?? null })),
    roll: a.roll ? { formula: a.roll.formula ?? null, name: a.roll.name ?? null } : null,
    damageParts: (a.damage?.parts ?? []).map(p => ({ formula: p.formula ?? p.custom?.formula ?? null, types: [...(p.types ?? [])] })),
    save: a.save ? { ability: [...(a.save.ability ?? [])], dc: { calculation: a.save.dc?.calculation ?? null, formula: a.save.dc?.formula ?? null, value: a.save.dc?.value ?? null } } : null,
    effects: (a.effects ?? []).length,
    applicableEffects: (a.applicableEffects ?? []).length,
    target: a.target?.affects?.type ?? null
  });
  const dumpItem = i => ({
    name: i.name, id: i.id, type: i.type,
    subtype: i.system.type?.value ?? null,
    identifier: i.system.identifier ?? null,
    uses: i.system.uses ? { value: i.system.uses.value, max: i.system.uses.max, spent: i.system.uses.spent, recovery: (i.system.uses.recovery ?? []).map(r => r.period) } : null,
    itemEffects: i.effects.contents.map(e => ({ name: e.name, transfer: e.transfer, statuses: [...(e.statuses ?? [])], changes: e.changes?.length ?? 0 })),
    activities: (i.system.activities?.contents ?? []).map(dumpActivity)
  });

  const found = {};
  for (const key of ['precision attack', 'riposte', 'superiority']) {
    const items = owner.items.contents.filter(i => i.name.toLowerCase().includes(key));
    found[key] = items.map(dumpItem);
  }
  // Shield Master may live on ANY actor — search the whole world and record who carries it.
  found['shield master'] = [];
  for (const a of game.actors) {
    for (const i of a.items.contents.filter(i => i.name.toLowerCase().includes('shield master'))) {
      found['shield master'].push({ carrier: a.name, ...dumpItem(i) });
    }
  }
  // The scale keys a superiority die formula would reference.
  const rollData = owner.getRollData();
  const scaleKeys = [];
  for (const [cls, scales] of Object.entries(rollData.scale ?? {})) {
    for (const [k, v] of Object.entries(scales ?? {})) {
      scaleKeys.push(`${cls}.${k} = ${v?.formula ?? v?.die ?? JSON.stringify(v)?.slice(0, 60)}`);
    }
  }

  const results = [];
  const precision = found['precision attack'][0] ?? null;
  const riposte = found['riposte'][0] ?? null;
  const shieldMaster = found['shield master'][0] ?? null;

  results.push({ n: 1, name: 'Precision Attack exists with at least one activity',
    pass: !!precision && precision.activities.length > 0,
    detail: precision ? JSON.stringify(precision).slice(0, 400) : 'MISSING' });
  results.push({ n: 2, name: 'Riposte exists; activation recorded (reaction?)',
    pass: !!riposte && riposte.activities.length > 0,
    detail: riposte ? `activation=${JSON.stringify(riposte.activities.map(a => a.activation))}` : 'MISSING' });
  results.push({ n: 4, name: 'Shield Master: save activity present, effects EMPTY (the gap)',
    pass: !!shieldMaster,
    detail: shieldMaster ? JSON.stringify(shieldMaster.activities.map(a => ({ type: a.type, save: a.save, effects: a.effects }))) : 'MISSING' });

  /* 3 — use() one maneuver on Morgash's own item; restore uses; delete messages. --------- */
  let useDump = null;
  const probeItem = owner.items.get(precision?.id) ?? owner.items.get(riposte?.id) ?? null;
  if (probeItem) {
    const act = probeItem.system.activities?.contents?.[0];
    const usesBefore = foundry.utils.deepClone(probeItem.system._source.uses ?? null);
    // Record any consumption-target items' uses too, so everything can be restored.
    const consTargets = (act?.consumption?.targets ?? [])
      .map(t => owner.items.get(t.target)).filter(Boolean);
    const consBefore = consTargets.map(i => ({ id: i.id, uses: foundry.utils.deepClone(i.system._source.uses ?? null) }));
    const before = game.messages.size;
    let useError = null;
    try { await act?.use({}, { configure: false }, {}); } catch (e) { useError = String(e?.message ?? e); }
    await sleep(500);
    const fresh = game.messages.contents.slice(before);
    useDump = {
      activityUsed: act?.id ?? null, useError,
      messages: fresh.map(m => ({
        id: m.id,
        rollTypes: m.rolls.map(r => r.constructor?.name),
        rollTotals: m.rolls.map(r => r.total),
        flagKeys: Object.keys(m.flags?.dnd5e ?? {}),
        hasRolls: m.rolls.length > 0
      })),
      usesAfter: foundry.utils.deepClone(probeItem.system._source.uses ?? null),
      usesBefore,
      consumptionDelta: consTargets.map((i, ix) => ({
        name: i.name, before: consBefore[ix].uses?.spent ?? null, after: i.system._source.uses?.spent ?? null
      }))
    };
    // restore
    if (usesBefore) await probeItem.update({ 'system.uses': usesBefore }).catch(() => {});
    for (const { id, uses } of consBefore) {
      if (uses) await owner.items.get(id)?.update({ 'system.uses': uses }).catch(() => {});
    }
    await ChatMessage.deleteDocuments(fresh.map(m => m.id).filter(id => game.messages.has(id))).catch(() => {});
    results.push({ n: 3, name: 'use({},{configure:false},{}) posts something observable',
      pass: !useError, detail: JSON.stringify(useDump).slice(0, 500) });
  } else {
    results.push({ n: 3, name: 'use() probe', pass: false, detail: 'no maneuver item to use' });
  }

  return { log, scaleKeys, found, useDump, results };
});

if (out.fatal) { console.error('[maneuvers] FATAL:', out.fatal); process.exit(2); }
for (const l of out.log) console.log(`  · ${l}`);
console.log('\n[maneuvers] scale keys:');
for (const k of out.scaleKeys) console.log(`  · ${k}`);
console.log('\n[maneuvers] FULL DUMPS:');
console.log(JSON.stringify(out.found, null, 2));
if (out.useDump) { console.log('\n[maneuvers] use() dump:'); console.log(JSON.stringify(out.useDump, null, 2)); }
let bad = 0;
for (const r of out.results.sort((a, b) => a.n - b.n)) {
  if (!r.pass) bad++;
  console.log(`\n  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}. ${r.name}\n        ${r.detail}`);
}
console.log(bad ? `\n[maneuvers] ${bad} of ${out.results.length} WRONG` : `\n[maneuvers] shapes measured`);
process.exit(bad ? 1 : 0);
