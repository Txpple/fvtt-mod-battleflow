// Probe 6, last: name the ×1.4. Dump every listener on the two creation-mutation seams
// (dnd5e.preCreateActivityTemplate, core preCreateMeasuredTemplate) and the full dnd5e
// AbilityTemplate preview methods the earlier grep truncated. Read-only.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 120s'); process.exit(3); }, 120_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const src = (fn, n = 3500) => { try { return String(fn).slice(0, n); } catch { return null; } };
  const res = { hooks: {} };
  for (const name of [
    'dnd5e.preCreateActivityTemplate', 'dnd5e.createActivityTemplate',
    'preCreateMeasuredTemplate', 'updateMeasuredTemplate', 'deleteMeasuredTemplate',
  ]) {
    res.hooks[name] = (Hooks.events[name] ?? []).map(h => src(h.fn, 1800));
  }
  const AT = dnd5e.canvas.AbilityTemplate;
  res.preview = {};
  for (const m of ['drawPreview', 'activatePreviewListeners', '_onMovePlacement',
    '_onRotatePlacement', '_onConfirmPlacement', '_finishPlacement', 'getSnappedPosition']) {
    res.preview[m] = src(AT.prototype[m]);
  }
  return res;
}, null);

const s = JSON.stringify(out, null, 1);
console.log(s.length > 55000 ? s.slice(0, 55000) + '\n…TRUNCATED' : s);
process.exit(0);
