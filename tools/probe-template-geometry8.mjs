// Probe 8: the create-pipeline ×1.4 is proven (probe 7). Name the line. Dump the LIVE
// schema field for MeasuredTemplate.distance (v14 may scale units at validation), the
// base class's cleanData/migrateData/shimData, _preCreate/_preUpdate, and any
// grid-scaling in the field's clean/cast chain. All client-side introspection.
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
  const src = (fn, n = 2500) => { try { return String(fn).slice(0, n); } catch { return null; } };
  const res = {};
  const Base = foundry.documents.BaseMeasuredTemplate;
  const schema = Base.defineSchema();
  const dist = schema.distance;
  const chain = [];
  for (let c = dist?.constructor; c && chain.length < 6; c = Object.getPrototypeOf(c)) chain.push(c.name);
  res.distanceField = {
    chain,
    options: { ...dist?.options },
    clean: src(dist?.clean),
    _cast: src(dist?._cast),
    _cleanType: src(dist?._cleanType),
    initialize: src(dist?.initialize),
    toObject: src(dist?.toObject),
  };
  res.base = {
    cleanData: src(Base.cleanData),
    migrateData: src(Base.migrateData),
    shimData: src(Base.shimData),
  };
  const DocCls = CONFIG.MeasuredTemplate.documentClass;
  res.docLifecycle = {
    _preCreate: src(DocCls.prototype._preCreate),
    _preUpdate: src(DocCls.prototype._preUpdate),
  };
  // The v14 schema may declare grid-relative units: look for any 'units' / 'grid'
  // metadata on every field of the schema.
  res.fieldMeta = {};
  for (const [k, v] of Object.entries(schema)) {
    const meta = {};
    for (const key of ['units', 'gridUnits', 'scaling', 'dimension']) {
      if (v?.options?.[key] !== undefined) meta[key] = v.options[key];
      if (v?.[key] !== undefined) meta[key] = v[key];
    }
    if (Object.keys(meta).length) res.fieldMeta[k] = meta;
  }
  // And the create round-trip one more time, watching WHERE the value flips: validate
  // clean-side locally without touching the database.
  const data = { t: 'rect', x: 140, y: 140, distance: Math.hypot(20, 20), direction: 45, user: game.user.id };
  res.localClean = Base.cleanData(foundry.utils.deepClone(data))?.distance;
  const tmpDoc = new DocCls(foundry.utils.deepClone(data), { parent: game.scenes.getName('Party Camp') });
  res.localDocDistance = tmpDoc.distance;
  res.localSourceDistance = tmpDoc._source.distance;
  return res;
}, null);

console.log(JSON.stringify(out, null, 1));
process.exit(0);
