// CONTENT FIX (the fix-shield-master pattern): the volley fold detects a volley
// structurally — target.affects.count evaluating to 2+ — and Magic Missile ships that shape
// ("2 + @item.level", measured 2026-08-21). Scorching Ray's 5.3.3 PHB data carries NO count
// anywhere ("Total Rays: 3" is description prose), so without this graft it is never a
// volley and stays fully native. The graft writes the matching convention onto every
// Scorching Ray in the world: count "1 + @item.level" (3 rays at 2nd, +1 per level — RAW),
// affects.type "creature". Idempotent: an item that already carries a count is left alone.
//
//   node tools/fix-scorching-ray.mjs             (local sandbox)
//   BF_TARGET=prod node tools/fix-scorching-ray.mjs   (prod, at the release)
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
setTimeout(() => { console.error('[fix-sr] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[fix-sr] connected');

const out = await f.evaluate(async () => {
  const rep = [];
  const candidates = [];
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if ((item.type === 'spell') && (item.name === 'Scorching Ray')) candidates.push({ actor, item });
    }
  }
  for (const item of game.items) {
    if ((item.type === 'spell') && (item.name === 'Scorching Ray')) candidates.push({ actor: null, item });
  }
  for (const { actor, item } of candidates) {
    const src = item.toObject();
    const existing = src.system?.target?.affects?.count ?? '';
    if (String(existing).trim()) {
      rep.push({ where: actor?.name ?? '(world)', state: `already carries count "${existing}" — untouched` });
      continue;
    }
    await item.update({
      'system.target.affects.count': '1 + @item.level',
      'system.target.affects.type': 'creature'
    });
    const after = item.system.target?.affects?.count ?? null;
    rep.push({ where: actor?.name ?? '(world)', state: `grafted — prepared count now ${after}` });
  }
  if (!candidates.length) rep.push({ where: '(nowhere)', state: 'no Scorching Ray in this world' });
  return rep;
});

for (const r of out) console.log(`[fix-sr] ${r.where}: ${r.state}`);
process.exit(0);
