// Diagnostic: why did use({scaling: 2}) reach postUse with scaling falsy on the fixture
// (canScale chain), and what does activity.rollDamage() actually resolve to at 5.3.3?
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
setTimeout(() => { console.error('[v3] WATCHDOG 180s'); process.exit(3); }, 180_000);

const f = new Foundry(foundryConfig(env));
await f.connect();

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const npc = game.actors.getName('BF Test Attacker');
  if (!npc) return { fatal: 'no fixture' };
  const before = game.messages.size;
  const [item] = await npc.createEmbeddedDocuments('Item', [{
    name: 'BF Probe Scaling', type: 'spell',
    system: {
      level: 1, school: 'evo', properties: ['vocal'],
      range: { value: '120', units: 'ft' },
      method: 'spell', prepared: 1, identifier: 'bf-probe-scaling',
      target: { affects: { type: 'creature', count: '2 + @item.level' }, template: { type: '' } },
      activities: { bfprobescale0000: {
        _id: 'bfprobescale0000', type: 'damage', name: 'Darts',
        activation: { type: 'action' },
        target: { override: false, affects: {}, template: {} },
        damage: { parts: [{ number: 1, denomination: 4, bonus: '1', types: ['force'] }] },
        consumption: { targets: [], scaling: { allowed: true, max: '' }, spellSlot: false }
      } }
    }
  }]);
  const act = item.system.activities.contents[0];
  const rep = {
    scalingAllowed: act.consumption?.scaling?.allowed ?? null,
    canScale: act.canScale ?? null,
    itemCanScale: item.system.canScale ?? null,
    requiresSpellSlot: act.requiresSpellSlot ?? null
  };
  let seen = null, seenPost = null;
  const hid = Hooks.on('dnd5e.preUseActivity', (a, usageConfig) => {
    if (a.item?.id !== item.id) return;
    seen = { scaling: usageConfig.scaling, slot: usageConfig.spell?.slot ?? null,
      subsequent: usageConfig.subsequentActions ?? null };
    usageConfig.subsequentActions = false;
  });
  const hid2 = Hooks.on('dnd5e.postUseActivity', (a, usageConfig, results) => {
    if (a.item?.id !== item.id) return;
    seenPost = { scaling: usageConfig.scaling, slot: usageConfig.spell?.slot ?? null,
      msgScaling: results?.message?.system?.scaling ?? null,
      msgSpellLevel: results?.message?.system?.spellLevel ?? null };
  });
  await Promise.race([act.use({ scaling: 2 }, { configure: false }, {}), sleep(4000)]);
  Hooks.off('dnd5e.preUseActivity', hid);
  Hooks.off('dnd5e.postUseActivity', hid2);
  rep.atPreUse = seen;
  rep.atPostUse = seenPost;
  // rollDamage return shape
  const ret = await act.rollDamage({}, { configure: false }, { data: {} }).catch(e => `ERR ${e.message}`);
  rep.rollDamageReturn = Array.isArray(ret)
    ? { isArray: true, len: ret.length, parentIsMessage: ret[0]?.parent instanceof ChatMessage }
    : String(ret);
  const fresh = game.messages.contents.slice(before);
  await ChatMessage.deleteDocuments(fresh.map(m => m.id)).catch(() => {});
  await item.delete().catch(() => {});
  return rep;
});
console.log(JSON.stringify(out, null, 1));
process.exit(0);
