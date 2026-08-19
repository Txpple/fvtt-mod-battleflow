// Probe 2: the rect docs read distance 39.598 (a 28 ft side) for a size-20 cube — ×1.4,
// exactly this scene's 140px grid over the 100px default. Who is lying: the document,
// the renderer, or the module's doc-math? Dump _source vs prepared distance, the LIVE
// object's shape and its real highlight squares (the bridge canvas drew Party Camp), the
// document/object class chains and hooks that could override shape, and dnd5e's
// placement source that wrote the distance. Read-only.
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
  const src = (fn, n = 3000) => { try { return String(fn).slice(0, n); } catch { return null; } };
  const scene = game.scenes.getName('Party Camp');
  const res = {};

  // Source vs prepared distance, and the LIVE object's shape + highlight squares.
  res.templates = scene.templates.contents.map(t => {
    const o = t.object;
    const entry = {
      id: t.id, t: t.t,
      sourceDistance: t._source?.distance, preparedDistance: t.distance,
      sourceXY: [t._source?.x, t._source?.y], preparedXY: [t.x, t.y],
      hasObject: !!o, objectShape: null, highlight: null,
    };
    if (o?.shape) {
      const s = o.shape;
      entry.objectShape = { ctor: s.constructor?.name };
      for (const k of ['x', 'y', 'width', 'height', 'radius'])
        if (typeof s[k] === 'number') entry.objectShape[k] = s[k];
      if (s.points) entry.objectShape.points = s.points.map(n => Math.round(n));
    }
    try {
      const pos = o?._getGridHighlightPositions?.();
      if (pos?.length) {
        entry.highlight = {
          count: pos.length,
          xRange: [Math.min(...pos.map(p => p.x)), Math.max(...pos.map(p => p.x))],
          yRange: [Math.min(...pos.map(p => p.y)), Math.max(...pos.map(p => p.y))],
        };
      } else entry.highlight = { count: pos?.length ?? null };
    } catch (err) { entry.highlight = { error: String(err?.message ?? err) }; }
    return entry;
  });

  // Class chains: does dnd5e subclass the document or the object anywhere?
  const docCls = CONFIG.MeasuredTemplate.documentClass;
  const chain = c => { const out = []; for (let k = c; k && out.length < 7; k = Object.getPrototypeOf(k)) out.push(k.name); return out; };
  res.documentClass = {
    chain: chain(docCls),
    ownProtoProps: Object.getOwnPropertyNames(docCls.prototype).filter(n => n !== 'constructor'),
    prepareDerivedData: src(docCls.prototype.prepareDerivedData, 2000),
  };

  // Hook listeners that could restyle or reshape templates after core draws them.
  res.hooks = {};
  for (const name of ['drawMeasuredTemplate', 'refreshMeasuredTemplate', 'createMeasuredTemplate', 'initializeMeasuredTemplateShape']) {
    const hs = Hooks.events[name] ?? [];
    res.hooks[name] = hs.map(h => src(h.fn, 1200));
  }
  res.hookNames = Object.keys(Hooks.events).filter(n => /template/i.test(n));

  // The dnd5e placement machinery: who computes the distance that lands on the doc.
  const AT = dnd5e?.canvas?.AbilityTemplate;
  res.abilityTemplate = {
    exists: !!AT,
    chain: AT ? chain(AT) : null,
    fromConfig: src(AT?.fromConfig ?? AT?.fromActivity ?? AT?.fromItem, 6000),
  };

  // dnd5e settings that smell like templates/AoE.
  res.dnd5eSettings = {};
  for (const [k, v] of game.settings.settings.entries()) {
    if (!k.startsWith('dnd5e.')) continue;
    if (/template|aoe|grid|area/i.test(k)) {
      try { res.dnd5eSettings[k] = game.settings.get('dnd5e', k.slice(6)); } catch {}
    }
  }
  return res;
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
