// VERIFY the potion default (FLOW item 4, re-shaped): a drunk potion with nothing targeted
// aims at the drinker — snapshot AND canvas target — while a real target always wins and
// everything that is not a drinkable potion is left alone.
//
// Five shapes, all built as temporary items on a safe fixture and deleted afterwards:
//   A potion  heal/creature/no template, NO target      -> filled (both sides)
//   B potion  heal/creature/no template, ally targeted  -> untouched (rule 2)
//   C oil     save/creature (a THROWN consumable)       -> untouched
//   D oil     damage/space + template                   -> untouched
//   E spell   heal/creature on a NON-consumable         -> untouched (spells keep their aim)
//
// ⚠ Runs on Practice Dummy / BF Test fixtures on whatever scene is active — it never moves the
// view and never touches a live PC. Uses `configure:false`, so no dialog renders here; the
// dialog half is the target block, already table-verified in the v1.16.0 walk.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[selfaim] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[selfaim] connected');

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SAFE = /^(Practice Dummy|BF Test)/;
  const toks = canvas.tokens.placeables.filter(t => t.actor && SAFE.test(t.actor.name));
  const tok = toks[0];
  if (!tok) return { fatal: `no safe fixture token on "${canvas.scene?.name}"` };
  const actor = tok.actor;

  // ⚠ Case B needs a DISTINCT actor. The scene's two Practice Dummy tokens share one actor, so
  // getTargetDescriptors keys them to the same uuid and "did rule 2 keep the other one" is
  // unanswerable by name OR by uuid. A throwaway bystander is created for the length of the
  // probe and deleted with everything else — nothing on the live scene is targeted or healed.
  const [bystander] = await Actor.createDocuments([{
    name: 'BF Probe Bystander', type: 'npc',
    system: { attributes: { hp: { value: 5, max: 5 }, ac: { flat: 10, calc: 'flat' } } }
  }]);
  const [bystanderTokDoc] = await canvas.scene.createEmbeddedDocuments('Token', [{
    name: 'BF Probe Bystander', actorId: bystander.id, actorLink: true,
    x: canvas.scene.width - canvas.grid.size * 2, y: canvas.scene.height - canvas.grid.size * 2,
    hidden: true, disposition: 0
  }]);
  const other = bystanderTokDoc.object;

  const heal = { custom: { enabled: false }, number: 2, denomination: 4, bonus: '2', types: ['healing'] };
  const mk = (name, type, itemType, target, extra = {}) => ({
    name, type: itemType,
    system: {
      ...(itemType === 'consumable' ? { type: { value: 'potion' }, quantity: 9 } : {}),
      ...(itemType === 'spell' ? { level: 1, school: 'evo', preparation: { mode: 'prepared', prepared: true } } : {}),
      activities: { ['bfsa' + name.replace(/\W/g, '').slice(0, 12).padEnd(12, '0')]: {
        _id: ('bfsa' + name.replace(/\W/g, '')).slice(0, 16).padEnd(16, '0'),
        type, name: 'Use', target, ...extra
      } }
    }
  });
  const created = await actor.createEmbeddedDocuments('Item', [
    mk('ProbePotion', 'heal', 'consumable',
      { affects: { type: 'creature', count: '1' }, template: { type: '' } }, { healing: heal }),
    mk('ProbeOilSave', 'save', 'consumable',
      { affects: { type: 'creature', count: '1' }, template: { type: '' } }),
    mk('ProbeOilArea', 'damage', 'consumable',
      { affects: { type: 'space', count: '' }, template: { type: 'square', size: '5' } }),
    mk('ProbeSpellHeal', 'heal', 'spell',
      { affects: { type: 'creature', count: '1' }, template: { type: '' } }, { healing: heal })
  ]);
  const byName = n => created.find(i => i.name === n).system.activities.contents[0];

  const clear = () => game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  const run = async (name, act, prep) => {
    clear(); await sleep(200);
    if (prep) { prep(); await sleep(250); }
    const before = game.messages.size;
    const tplBefore = new Set(canvas.scene.templates.map(t => t.id));
    let err = null;
    // ⚠ NEVER await a use unboundedly. A template-bearing activity parks waiting for a human
    // to place the template and its promise never resolves — a plain await hung the whole
    // probe past its watchdog (measured 2026-08-19). Race it; the card posts either way.
    await Promise.race([
      act.use({}, { configure: false }, {}).catch(e => { err = String(e?.message ?? e); }),
      sleep(4000)
    ]);
    await sleep(800);
    // Cancel any template the activity started, and delete any it placed.
    try { canvas.templates?.clearPreviewContainer?.(); } catch {}
    try { if (canvas.activeLayer?.name === 'TemplateLayer') canvas.tokens.activate(); } catch {}
    const tplNew = canvas.scene.templates.filter(t => !tplBefore.has(t.id)).map(t => t.id);
    if (tplNew.length) await canvas.scene.deleteEmbeddedDocuments('MeasuredTemplate', tplNew).catch(() => {});
    const fresh = game.messages.contents.slice(before);
    const card = fresh.find(m => m.getFlag('dnd5e', 'activity')) ?? fresh[0] ?? null;
    const res = {
      name, err,
      snapshot: (card?.getFlag('dnd5e', 'targets') ?? []).map(t => t.name),
      snapshotUuids: (card?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid),
      snapshotHasAC: (card?.getFlag('dnd5e', 'targets') ?? []).map(t => t.ac),
      canvasTargets: [...game.user.targets].map(t => t.document.name),
      templatesLeft: tplNew.length
    };
    await ChatMessage.deleteDocuments(fresh.map(m => m.id)).catch(() => {});
    return res;
  };

  const results = [];
  results.push(await run('A potion, NO target', byName('ProbePotion'), null));
  if (other) results.push(await run('B potion, other targeted', byName('ProbePotion'),
    () => other.setTarget(true, { releaseOthers: true })));
  results.push(await run('C oil save, NO target', byName('ProbeOilSave'), null));
  results.push(await run('D oil area, NO target', byName('ProbeOilArea'), null));
  results.push(await run('E SPELL heal, NO target', byName('ProbeSpellHeal'), null));

  clear();
  for (const i of created) await i.delete().catch(() => {});
  const ids = { drinkerUuid: actor.uuid, otherUuid: bystander.uuid };
  await canvas.scene.deleteEmbeddedDocuments('Token', [bystanderTokDoc.id]).catch(() => {});
  await bystander.delete().catch(() => {});
  return { drinker: actor.name, drinkerToken: tok.document.name,
    other: 'BF Probe Bystander', scene: canvas.scene?.name, ...ids, results };
});

if (out.fatal) { console.error('[selfaim] FATAL:', out.fatal); process.exit(2); }
console.log(`\n[selfaim] drinker "${out.drinkerToken}" (${out.drinker}) on "${out.scene}"; other = ${out.other}`);

const expect = {
  // Asserted on UUID, never on name — see the bystander note in the page code.
  'A potion, NO target':      r => r.snapshotUuids.length === 1
                                   && r.snapshotUuids[0] === out.drinkerUuid
                                   && r.canvasTargets.includes(out.drinkerToken),
  'B potion, other targeted': r => r.snapshotUuids.length === 1
                                   && r.snapshotUuids[0] === out.otherUuid
                                   && !r.snapshotUuids.includes(out.drinkerUuid),
  'C oil save, NO target':    r => r.snapshot.length === 0 && r.canvasTargets.length === 0,
  'D oil area, NO target':    r => r.snapshot.length === 0 && r.canvasTargets.length === 0,
  'E SPELL heal, NO target':  r => r.snapshot.length === 0 && r.canvasTargets.length === 0
};
let bad = 0;
for (const r of out.results) {
  const ok = expect[r.name]?.(r);
  if (!ok) bad++;
  console.log(`\n  ${ok ? 'PASS' : 'FAIL'}  ${r.name}${r.err ? '  ERR ' + r.err : ''}`);
  console.log(`        snapshot: ${JSON.stringify(r.snapshot)}  uuids: ${JSON.stringify(r.snapshotUuids)}`);
  console.log(`        canvas:   ${JSON.stringify(r.canvasTargets)}`);
}
console.log(bad ? `\n[selfaim] ${bad} CASE(S) WRONG` : '\n[selfaim] ALL PASS — fills the potion, stays out of everything else');
process.exit(bad ? 1 : 0);
