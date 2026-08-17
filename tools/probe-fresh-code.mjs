// One fetch, once, after the cache quiet period: the exact versioned URL a reloading
// client hits. Fresh code carries honestDims; a stale hit re-primes the TTL, so this
// runs ONCE per quiet period — never in a loop (the cache truth, HANDOFF).
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
  const version = game.modules.get('fvtt-mod-battleflow')?.version;
  const url = `/modules/fvtt-mod-battleflow/scripts/saves.js?v=${version}`;
  const r = await fetch(url);
  const text = await r.text();
  return {
    vended: version, url, status: r.status, bytes: text.length,
    fresh: text.includes('honestDims') && text.includes('tokenSamplePoints'),
  };
}, null);

console.log(JSON.stringify(out));
process.exit(0);
