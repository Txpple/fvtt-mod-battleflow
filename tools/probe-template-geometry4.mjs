// Probe 4: the decisive one. testPoint's source (the highlight's real membership test),
// the standing rects' ACTUAL highlight square set (shape force-computed client-side —
// no document writes), which tokens' squares are lit vs the demanded trio, and a
// transient 20 ft / 28 ft circle at the fireball spot to see which one matches the
// screenshot's blob and whether Salyth's square lights. Read-only against the world.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 150s'); process.exit(3); }, 150_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const src = (fn, n = 2500) => { try { return String(fn).slice(0, n); } catch { return null; } };
  const cls = CONFIG.MeasuredTemplate.objectClass;
  const scene = game.scenes.getName('Party Camp');
  const res = {
    diagonals: canvas.grid.diagonals ?? null,
    gridDiagonalsSetting: (() => { try { return game.settings.get('core', 'gridDiagonals'); } catch { return null; } })(),
    testPoint: src(cls.prototype.testPoint),
    _refreshShape: src(cls.prototype._refreshShape),
  };

  const tokens = scene.tokens.contents.map(tok => ({
    name: tok.name,
    cx: tok.x + (tok.width * scene.grid.size) / 2,
    cy: tok.y + (tok.height * scene.grid.size) / 2,
  }));

  const summarize = (o, label) => {
    const entry = { label };
    try {
      if (!o.shape) o.shape = o._computeShape();
      entry.shape = { ctor: o.shape?.constructor?.name };
      for (const k of ['x', 'y', 'width', 'height', 'radius'])
        if (typeof o.shape?.[k] === 'number') entry.shape[k] = o.shape[k];
      const pos = o._getGridHighlightPositions();
      entry.highlightCount = pos.length;
      entry.xRange = [Math.min(...pos.map(p => p.x)), Math.max(...pos.map(p => p.x))];
      entry.yRange = [Math.min(...pos.map(p => p.y)), Math.max(...pos.map(p => p.y))];
      const lit = new Set(pos.map(p => `${p.x},${p.y}`));
      entry.tokensLit = tokens.filter(t => {
        const tl = canvas.grid.getTopLeftPoint({ x: t.cx, y: t.cy });
        return lit.has(`${tl.x},${tl.y}`);
      }).map(t => t.name);
      entry.tokensCenterInShape = tokens
        .filter(t => o.shape.contains(t.cx - o.document.x, t.cy - o.document.y))
        .map(t => t.name);
    } catch (err) { entry.error = String(err?.message ?? err); }
    return entry;
  };

  res.standing = scene.templates.contents.map(t => summarize(t.object, `${t.id} ${t.t} d=${t.distance}`));

  // Transient circles at the fireball spot — never saved, never rendered to others.
  const DocCls = CONFIG.MeasuredTemplate.documentClass;
  res.fireballSims = [];
  for (const [label, x, y, distance] of [
    ['20ft @ webbing center', 1792, 2562, 20],
    ['28ft @ webbing center', 1792, 2562, 28],
    ['20ft @ Jetten center', 1750, 2450, 20],
    ['28ft @ Jetten center', 1750, 2450, 28],
  ]) {
    try {
      const doc = new DocCls({ t: 'circle', x, y, distance, direction: 0, user: game.user.id },
        { parent: scene });
      const o = new cls(doc);
      res.fireballSims.push(summarize(o, label));
    } catch (err) { res.fireballSims.push({ label, error: String(err?.message ?? err) }); }
  }
  return res;
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
