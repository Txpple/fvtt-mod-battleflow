// Probe 5, tiny: who else is loaded (any third-party template-touching module?), and
// the corrupted docs' _stats — lastModifiedBy names the client that wrote the ×1.4
// distance if this box records it. Read-only.
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
  const scene = game.scenes.getName('Party Camp');
  return {
    activeModules: [...game.modules].filter(m => m.active).map(m => `${m.id} ${m.version}`),
    users: game.users.contents.map(u => `${u.id} = ${u.name}${u.isGM ? ' [GM]' : ''}${u.active ? ' (online)' : ''}`),
    templateStats: scene.templates.contents.map(t => ({
      id: t.id, distance: t.distance, stats: t._stats ? {
        createdTime: t._stats.createdTime, modifiedTime: t._stats.modifiedTime,
        lastModifiedBy: t._stats.lastModifiedBy,
      } : null,
      author: t.author?.name ?? t.user?.name ?? null,
    })),
  };
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
