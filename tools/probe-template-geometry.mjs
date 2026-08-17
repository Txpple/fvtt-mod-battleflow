// Read-only forensics for the v1.13.0 walk: Fireball/Web/Entangle demanded Salyth from
// OUTSIDE the drawn area (Shatter stayed clean). Containment's fallback branch calls the
// objectClass shape statics — this dumps the template docs, token centers, the demand
// flags, the statics' SOURCE and their output for the real docs, the renderer's own
// _computeShape/_getGridHighlightPositions source, and the scene grid's shape API — so
// the divergence between what the module computed and what the table SAW (the highlight)
// is pinned to a line before anything is changed. No writes, no settings.
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
  const MOD = 'fvtt-mod-battleflow';
  const src = fn => { try { return String(fn).slice(0, 2200); } catch { return null; } };
  const meta = {
    foundry: game.version ?? game.release?.version,
    system: `${game.system.id} ${game.system.version}`,
  };
  for (const ns of ['core', 'dnd5e']) {
    try { meta[`gridTemplates:${ns}`] = game.settings.get(ns, 'gridTemplates'); } catch {}
  }
  const canvasState = {
    viewedScene: canvas?.scene?.name ?? null,
    distancePixels: canvas?.dimensions?.distancePixels ?? null,
    canvasGridSize: canvas?.grid?.size ?? null,
  };

  const scene = game.scenes.getName('Party Camp');
  if (!scene) return { meta, canvasState, error: 'no Party Camp scene' };
  const gsize = scene.grid.size, gdist = scene.grid.distance;

  const templates = scene.templates.contents.map(t => ({
    id: t.id, t: t.t, x: t.x, y: t.y, distance: t.distance, direction: t.direction,
    angle: t.angle, width: t.width, dnd5e: t.flags?.dnd5e ?? null,
    createdTime: t._stats?.createdTime ?? null,
  }));

  const tokens = scene.tokens.contents.map(tok => ({
    name: tok.name, x: tok.x, y: tok.y,
    cx: tok.x + (tok.width * gsize) / 2, cy: tok.y + (tok.height * gsize) / 2,
  }));

  // The last few save demands: whose card, which activity, which targets, templated or not.
  const demands = [];
  for (const m of game.messages.contents) {
    const s = m.getFlag(MOD, 'saves');
    if (!s) continue;
    demands.push({
      id: m.id, ts: new Date(m.timestamp).toISOString().slice(11, 19),
      item: s.item?.name, status: s.status, templateType: s.templateType ?? null,
      templated: s.templated, awaiting: s.awaitingTemplate ?? false,
      activityUuid: s.activityUuid,
      targets: (s.targets ?? []).map(t => `${t.name}:${t.done ? t.outcome : 'pending'}`),
    });
  }
  demands.splice(0, Math.max(0, demands.length - 8));

  // The class the fallback asks, its chain, and the exact code of the statics + the
  // renderer's own shape path. This is the heart of the probe: WHAT do the statics do
  // with position, and what does the renderer do differently.
  const cls = CONFIG.MeasuredTemplate.objectClass;
  const chain = [];
  for (let c = cls; c && chain.length < 6; c = Object.getPrototypeOf(c)) chain.push(c.name);
  const sources = {
    chain,
    getCircleShape: src(cls.getCircleShape),
    getRectShape: src(cls.getRectShape),
    getConeShape: src(cls.getConeShape),
    getRayShape: src(cls.getRayShape),
    _computeShape: src(cls.prototype._computeShape),
    _getGridHighlightPositions: src(cls.prototype._getGridHighlightPositions),
  };

  // The scene grid document object: does IT carry position-aware shape methods that
  // would work headless and cross-scene?
  const gridProto = {};
  {
    const names = new Set();
    for (let p = Object.getPrototypeOf(scene.grid); p && p !== Object.prototype;
         p = Object.getPrototypeOf(p)) {
      for (const n of Object.getOwnPropertyNames(p)) names.add(n);
    }
    gridProto.ctor = scene.grid.constructor.name;
    gridProto.methods = [...names].filter(n => !n.startsWith('_') && n !== 'constructor').sort();
    for (const n of ['getCircle', 'getCone', 'getRectangle', 'getRay', 'getHighlightPositions'])
      if (names.has(n)) gridProto[`src:${n}`] = src(scene.grid[n]);
  }

  // Trials: for every template, the statics' actual output on THIS client, plus the
  // module's Euclidean branch, plus per-token containment verdicts for both. The
  // statics read canvas.grid — canvasState above says whether that grid is Party Camp's.
  const describe = shape => {
    if (!shape) return null;
    const d = { ctor: shape.constructor?.name };
    for (const k of ['x', 'y', 'width', 'height', 'radius']) if (typeof shape[k] === 'number') d[k] = shape[k];
    if (shape.points) d.points = shape.points.map(n => Math.round(n));
    return d;
  };
  const euclid = doc => {
    const d = (doc.distance ?? 0) * (gsize / gdist);
    const dir = Math.toRadians(doc.direction ?? 0);
    switch (doc.t) {
      case 'circle': return new PIXI.Circle(0, 0, d);
      case 'rect': {
        const dx = Math.cos(dir) * d, dy = Math.sin(dir) * d;
        return new PIXI.Rectangle(Math.min(0, dx), Math.min(0, dy), Math.abs(dx), Math.abs(dy));
      }
    }
    return null;
  };
  const trials = [];
  for (const doc of scene.templates.contents) {
    const trial = { id: doc.id, t: doc.t };
    try {
      let s = null;
      switch (doc.t) {
        case 'circle': s = cls.getCircleShape(doc.distance ?? 0); break;
        case 'rect': s = cls.getRectShape(doc.distance ?? 0, doc.direction ?? 0); break;
        case 'cone': s = cls.getConeShape(doc.distance ?? 0, doc.direction ?? 0, doc.angle || 53.13); break;
        case 'ray': s = cls.getRayShape(doc.distance ?? 0, doc.direction ?? 0, doc.width ?? 0); break;
      }
      trial.staticShape = describe(s);
      trial.staticContains = tokens
        .filter(tok => s?.contains(tok.cx - doc.x, tok.cy - doc.y)).map(tok => tok.name);
    } catch (err) { trial.staticError = String(err?.message ?? err); }
    try {
      const e = euclid(doc);
      trial.euclidShape = describe(e);
      trial.euclidContains = tokens
        .filter(tok => e?.contains(tok.cx - doc.x, tok.cy - doc.y)).map(tok => tok.name);
    } catch (err) { trial.euclidError = String(err?.message ?? err); }
    trials.push(trial);
  }

  return { meta, canvasState, grid: { gsize, gdist }, templates, tokens, demands, sources, gridProto, trials };
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
