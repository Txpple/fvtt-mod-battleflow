// Probe 7, the experiment: create the EXACT doc dnd5e's placement hands to the database
// (honest 28.284 diagonal, cube flags) in a far corner, read it back after a beat, and
// see whether a live writer rewrites it ×1.4. Also: the bound createMeasuredTemplate
// listeners keep their function NAMES — dump them. Cleans up after itself (both test
// templates deleted); all demands are status:done so nothing can adopt the probe rect.
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
  const scene = game.scenes.getName('Party Camp');
  const res = {};
  res.createListenerNames = (Hooks.events.createMeasuredTemplate ?? [])
    .map(h => h.fn.name || '(anonymous)');
  res.updateListenerNames = (Hooks.events.updateMeasuredTemplate ?? [])
    .map(h => h.fn.name || '(anonymous)');
  res.sceneCreateEmbedded = String(scene.createEmbeddedDocuments).slice(0, 300);

  const mk = (flags, width) => ({
    t: 'rect', x: 140, y: 140, distance: Math.hypot(20, 20), direction: 45,
    user: game.user.id, ...(width != null ? { width } : {}), ...(flags ? { flags } : {}),
  });
  const trials = [];
  for (const [label, flags, width] of [
    ['dnd5e cube flags + width (the fromActivity shape)', { dnd5e: {
      dimensions: { size: 20, adjustedSize: false },
      item: 'Probe.test', origin: 'Probe.test.Activity.probe', spellLevel: 2 } }, 20],
    // Origin flag kept so a fresh WAITING demand at the live table can never claim it
    // (claim wants origin-LESS; adoption wants a matching origin — this one matches
    // nothing). No width: discriminates the width-carrying rect from a plain one.
    ['plain rect, inert origin, no width', { dnd5e: { origin: 'Probe.test.Activity.probe2' } }, null],
  ]) {
    const [doc] = await scene.createEmbeddedDocuments('MeasuredTemplate', [mk(flags, width)]);
    const atBirth = doc.distance;
    await new Promise(r => setTimeout(r, 2500));
    const after = scene.templates.get(doc.id)?.distance;
    trials.push({ label, sent: Math.hypot(20, 20), atBirth, after2500ms: after });
    await scene.deleteEmbeddedDocuments('MeasuredTemplate', [doc.id]);
  }
  res.trials = trials;
  res.leftBehind = scene.templates.contents.map(t => `${t.id} d=${t.distance}`);
  return res;
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
