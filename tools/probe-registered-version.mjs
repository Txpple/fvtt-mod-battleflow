// The wake half of the bounce (down-by-user / wake-by-connect): connect — which boots a
// downed Molten box fresh, the moment Foundry re-reads module.json — and read the
// REGISTERED module version plus the vended saves.js, marker-checked for current code.
// Cold-boot headroom per the v1.18.0 lesson: ~540s, not the usual 120s.
//
//   BF_TARGET=prod node tools/probe-registered-version.mjs   → wake prod + read
//   node tools/probe-registered-version.mjs                   → read the sandbox
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
setTimeout(() => { console.error('[version] WATCHDOG 570s (cold boot allowance)'); process.exit(3); }, 570_000);

const f = new Foundry(foundryConfig(env));
console.log('[version] connecting (a downed box boots on this)…');
await f.connect();
console.log('[version] connected');

const out = await f.evaluate(async () => {
  const version = game.modules.get('fvtt-mod-battleflow')?.version;
  const r = await fetch(`/modules/fvtt-mod-battleflow/scripts/saves.js?v=${version}`);
  const text = await r.text();
  return {
    registered: version, status: r.status, bytes: text.length,
    // Round-5 markers: the (y) comment and the (z) primitive both live in saves.js.
    round5: text.includes('walk-5 (y)') && text.includes('ruleLine')
  };
}, null);

console.log(JSON.stringify(out));
process.exit(0);
