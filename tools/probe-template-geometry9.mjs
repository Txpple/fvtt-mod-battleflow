// Probe 9: characterize the server-side transform. Create with distinctive values on
// Party Camp (140px grid) and on a 100px-grid scene if one exists: which fields scale,
// and does the factor track gridSize/100? Templates live 1.5s in a far corner, then
// deleted. Inert origin flag so nothing at the table can claim them.
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
setTimeout(() => { console.error('[probe] WATCHDOG 120s'); process.exit(3); }, 120_000);

const f = new Foundry(foundryConfig(env));
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const res = { server: game.data?.release ?? game.version, scenes: [] };
  const flags = { dnd5e: { origin: 'Probe.test.Activity.probe9' } };
  const send = { t: 'ray', x: 1000, y: 2000, distance: 10, direction: 30, width: 7,
    user: game.user.id, flags };
  const scenes = game.scenes.contents
    .map(s => ({ s, size: s.grid.size, dist: s.grid.distance }))
    .filter((v, i, a) => a.findIndex(o => o.size === v.size) === i)
    .slice(0, 3);
  for (const { s, size, dist } of scenes) {
    const row = { scene: s.name, gridSize: size, gridDistance: dist };
    try {
      const [doc] = await s.createEmbeddedDocuments('MeasuredTemplate', [foundry.utils.deepClone(send)]);
      row.got = { x: doc.x, y: doc.y, distance: doc.distance, direction: doc.direction, width: doc.width };
      row.factors = {
        distance: doc.distance / send.distance, width: doc.width / send.width,
        x: doc.x / send.x, y: doc.y / send.y, direction: doc.direction / send.direction,
      };
      await s.deleteEmbeddedDocuments('MeasuredTemplate', [doc.id]);
    } catch (err) { row.error = String(err?.message ?? err); }
    res.scenes.push(row);
  }
  return res;
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
