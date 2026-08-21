// VOLLEY CENSUS (read-only): the user's 2026-08-21 directive — the graft hack dies, a
// module-owned registry of official volley spells replaces it. This scan seeds that
// registry: sweep EVERY Item compendium pack for multi-projectile spells (a
// target.affects.count field, or description prose like "three rays" / "additional beam"),
// then read every WORLD copy of the candidates so per-copy data drift (Salyth's imports)
// is measured, not guessed.
//
//   node tools/scan-volley-spells.mjs             (local sandbox)
//   BF_TARGET=prod node tools/scan-volley-spells.mjs
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
setTimeout(() => { console.error('[scan-volley] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[scan-volley] connected');

const out = await f.evaluate(async () => {
  const NUM = '(?:one|two|three|four|five|six|seven|eight|\\d+)';
  const PROJ = '(?:rays?|darts?|beams?|bolts?|missiles?|meteors?)';
  const ONE = '(?:ray|dart|beam|bolt|missile|meteor)';
  const PATTERNS = [
    new RegExp(`\\b${NUM}\\s+${PROJ}\\b`, 'ig'),
    new RegExp(`\\badditional\\s+${ONE}\\b`, 'ig'),
    new RegExp(`\\bfor each\\s+${ONE}\\b`, 'ig'),
    new RegExp(`\\b${PROJ}\\s+(?:at|against)\\b`, 'ig'),
  ];
  const strip = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html ?? '';
    return d.textContent ?? '';
  };
  const spellShape = (item) => {
    const src = item.toObject();
    return {
      name: item.name,
      level: src.system?.level ?? null,
      itemCount: src.system?.target?.affects?.count ?? '',
      affectsType: src.system?.target?.affects?.type ?? '',
      activities: Object.values(src.system?.activities ?? {}).map(a => ({
        type: a.type,
        parts: a.damage?.parts?.length ?? 0,
        actCount: a.target?.affects?.count ?? '',
        override: a.target?.override ?? false,
        scalingMode: a.damage?.parts?.[0]?.scaling?.mode ?? '',
      })),
    };
  };

  // ---- Part A: the compendium census ----
  const candidates = [];
  const packStats = [];
  for (const pack of game.packs) {
    if (pack.metadata.type !== 'Item') continue;
    let docs = [];
    try { docs = await pack.getDocuments({ type: 'spell' }); } catch (e) { packStats.push({ pack: pack.collection, error: String(e) }); continue; }
    if (!docs.length) continue;
    packStats.push({ pack: pack.collection, label: pack.metadata.label, spells: docs.length });
    for (const item of docs) {
      const text = strip(item.system?.description?.value);
      const hits = [];
      for (const re of PATTERNS) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) {
          const at = Math.max(0, m.index - 30);
          hits.push(text.slice(at, m.index + m[0].length + 30).replace(/\s+/g, ' ').trim());
          if (hits.length >= 4) break;
        }
      }
      const shape = spellShape(item);
      const hasCount = String(shape.itemCount).trim() || shape.activities.some(a => String(a.actCount).trim());
      if (hits.length || hasCount) candidates.push({ pack: pack.metadata.label, ...shape, hits: hits.slice(0, 4) });
    }
  }

  // ---- Part B: every world copy of the candidate names (plus the three knowns) ----
  const names = new Set(candidates.map(c => c.name));
  ['Magic Missile', 'Scorching Ray', 'Eldritch Blast'].forEach(n => names.add(n));
  const carriers = [];
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (item.type !== 'spell' || !names.has(item.name)) continue;
      carriers.push({ owner: actor.name, actorType: actor.type, ...spellShape(item) });
    }
  }
  for (const item of game.items) {
    if (item.type !== 'spell' || !names.has(item.name)) continue;
    carriers.push({ owner: '(world item)', actorType: '-', ...spellShape(item) });
  }
  return { packStats, candidates, carriers };
});

console.log('\n[scan-volley] ---- packs scanned ----');
for (const p of out.packStats) console.log(`  ${p.label ?? p.pack}: ${p.spells ?? p.error} spells`);
console.log('\n[scan-volley] ---- compendium candidates (count field OR projectile prose) ----');
for (const c of out.candidates) {
  const acts = c.activities.map(a => `${a.type}(parts:${a.parts}${a.actCount ? ` count:"${a.actCount}"` : ''}${a.override ? ' override' : ''}${a.scalingMode ? ` scale:${a.scalingMode}` : ''})`).join(', ');
  console.log(`  [${c.pack}] ${c.name} (lvl ${c.level}) itemCount:"${c.itemCount}" type:"${c.affectsType}" acts: ${acts}`);
  for (const h of c.hits) console.log(`      …${h}…`);
}
console.log('\n[scan-volley] ---- world carriers of candidate names ----');
for (const c of out.carriers) {
  const acts = c.activities.map(a => `${a.type}(parts:${a.parts}${a.actCount ? ` count:"${a.actCount}"` : ''}${a.override ? ' override' : ''})`).join(', ');
  console.log(`  ${c.owner} [${c.actorType}] ${c.name} (lvl ${c.level}) itemCount:"${c.itemCount}" acts: ${acts}`);
}
process.exit(0);
