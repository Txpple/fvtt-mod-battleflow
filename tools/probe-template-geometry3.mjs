// Probe 3: the doc says 39.598 (28 ft side) where dnd5e's fromActivity writes
// hypot(20,20)=28.28 — and the live table SEES a 560px cube. Fetch the dnd5e compiled
// source with the page's own session and grep the gridAlignedSquareTemplates /
// dimensions machinery: who scales the preview by grid, and who re-shapes the drawn
// object from the dimensions flag. Read-only.
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
setTimeout(() => { console.error('[probe] WATCHDOG 150s'); process.exit(3); }, 150_000);

const f = new Foundry(foundryConfig(env));
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const paths = Array.from(new Set([
    ...[...(game.system.esmodules ?? [])].map(p => `/${p}`),
  ]));
  const res = { paths, hits: {} };
  const grab = (text, re, pad, cap = 8) => {
    const found = [];
    let m; let guard = 0;
    while ((m = re.exec(text)) && found.length < cap && guard++ < 200) {
      found.push(text.slice(Math.max(0, m.index - pad), m.index + pad));
    }
    return found;
  };
  for (const p of paths) {
    try {
      const r = await fetch(p);
      if (!r.ok) { res.hits[p] = `HTTP ${r.status}`; continue; }
      const text = await r.text();
      res.hits[p] = {
        bytes: text.length,
        gridAligned: grab(text, /gridAlignedSquareTemplates/g, 700, 6),
        adjustedSize: grab(text, /adjustedSize/g, 500, 6),
        refreshHook: grab(text, /refreshMeasuredTemplate|drawMeasuredTemplate/g, 600, 6),
      };
    } catch (err) { res.hits[p] = String(err?.message ?? err); }
  }
  return res;
}, null);

const s = JSON.stringify(out, null, 1);
console.log(s.length > 60000 ? s.slice(0, 60000) + '\n…TRUNCATED' : s);
process.exit(0);
