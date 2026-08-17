// One question: what durationUnits did today's instantaneous casts stamp? The sweep
// gates on exactly "inst" — if the PHB-2024 data stamps something else, the sweep is
// structurally dead for them. Read-only.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 90s'); process.exit(3); }, 90_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const rows = [];
  for (const m of game.messages.contents) {
    const s = m.getFlag(MOD, 'saves');
    if (!s) continue;
    rows.push({ id: m.id, item: s.item?.name, status: s.status,
      durationUnits: s.durationUnits ?? null, templated: s.templated });
  }
  // And the live item truth for Fireball/Shatter on the casters we saw.
  const items = [];
  for (const [actorId, names] of [
    ['RUC2ufpgFiYazvWf', ['Fireball']], ['3S6v9ShOyAMt8d7P', ['Shatter', 'Web']],
    ['ynipTDamO8lCYI80', ['Entangle']],
  ]) {
    const a = game.actors.get(actorId);
    for (const n of names) {
      const it = a?.items.getName(n);
      if (it) items.push({ actor: a.name, item: n, units: it.system?.duration?.units ?? null });
    }
  }
  return { cards: rows.slice(-10), items };
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
