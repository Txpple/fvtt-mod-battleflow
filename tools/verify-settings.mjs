// Verify the world's Battle Flow settings against a reference and restore drift with --fix. Run after
// any suite or probe: suites pin settings and a crashed teardown leaves them pinned.
//
//   node tools/verify-settings.mjs                       against the module's registered defaults
//                                                        (+ tools/settings.local.json, if present)
//   node tools/verify-settings.mjs --snapshot <file>     record this world's values as the reference
//   node tools/verify-settings.mjs --against <file>      check against a recorded reference
//   ... --fix                                            restore every drifted key
//
// The battery snapshots the world BEFORE it runs and checks against that snapshot AFTER, so whatever
// a table has tuned is the reference for its own world — nothing here names one table's taste.
// `tools/settings.local.json` (git-ignored) overrides single keys for a hand run: { "decisionTimer": 30 }.
// Every world-scoped key the module registers is checked: a new setting is covered by registering it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const { values } = parseArgs({ options: {
  fix: { type: 'boolean' }, snapshot: { type: 'string' }, against: { type: 'string' }
}, strict: false });
const FIX = !!values.fix;
const LOCAL = join(dirname(fileURLToPath(import.meta.url)), 'settings.local.json');
const env = loadEnv();
setTimeout(() => { console.error('[verify] WATCHDOG 120s'); process.exit(3); }, 120_000);

let reference = null;
let source = 'the registered defaults';
if (values.against) {
  reference = JSON.parse(readFileSync(values.against, 'utf8')).settings;
  source = `the snapshot ${values.against}`;
}
const overrides = (!values.against && existsSync(LOCAL)) ? JSON.parse(readFileSync(LOCAL, 'utf8')) : {};
if (Object.keys(overrides).length) source += ` + ${Object.keys(overrides).length} local override(s)`;

const f = new Foundry(foundryConfig(env));
console.log('[verify] connecting…');
await f.connect();

const out = await f.evaluate(async ({ reference, overrides, fix, snapshot }) => {
  const MOD = 'fvtt-mod-battleflow';
  const world = [...game.settings.settings.values()].filter(s => (s.namespace === MOD) && (s.scope === 'world'));
  // A snapshot covers every world key; the defaults cover the CONFIGURABLE ones (a hidden key is state, not taste).
  const keys = (snapshot || reference) ? world.map(s => s.key) : world.filter(s => s.config !== false).map(s => s.key);
  const norm = v => (typeof v === 'string') ? v.replace(/\s+/g, ' ').trim() : JSON.stringify(v);
  if (snapshot) return { snapshot: Object.fromEntries(keys.map(k => [k, game.settings.get(MOD, k)])), world: game.world.id };
  const want = reference ?? Object.fromEntries(keys.map(k => [k, game.settings.settings.get(`${MOD}.${k}`).default]));
  Object.assign(want, overrides);
  const drift = [];
  const missing = Object.keys(want).filter(k => !keys.includes(k));
  for (const key of keys) {
    if (!(key in want)) continue;
    const have = game.settings.get(MOD, key);
    if (norm(have) !== norm(want[key])) {
      drift.push({ key, have, want: want[key] });
      if (fix) await game.settings.set(MOD, key, want[key]);
    }
  }
  // The suites' cover lever: a scene left flagged after a killed run measures no cover for the table.
  for (const scene of game.scenes) {
    if (!scene.getFlag(MOD, 'noCover')) continue;
    drift.push({ key: `scene "${scene.name}" noCover`, have: true, want: null });
    if (fix) await scene.unsetFlag(MOD, 'noCover');
  }
  return { drift, missing, checked: keys.length, world: game.world.id };
}, { reference, overrides, fix: FIX, snapshot: !!values.snapshot });

if (values.snapshot) {
  writeFileSync(values.snapshot, `${JSON.stringify({ world: out.world, taken: new Date().toISOString(), settings: out.snapshot }, null, 1)}\n`);
  console.log(`[verify] SNAPSHOT — ${Object.keys(out.snapshot).length} world setting(s) of "${out.world}" → ${values.snapshot}`);
  await disposeSafely(f, 'verify');
  process.exit(0);
}
if (out.missing.length) console.log(`[verify] in the reference but not registered (old client code?): ${out.missing.join(', ')}`);
if (!out.drift.length) console.log(`[verify] CLEAN — ${out.checked} world setting(s) match ${source}.`);
else {
  for (const d of out.drift) console.log(
    `  DRIFT ${d.key}: have ${JSON.stringify(d.have)} want ${JSON.stringify(d.want)}${FIX ? ' — FIXED' : ''}`);
  console.log(`[verify] ${out.drift.length} drifted from ${source}${FIX ? ', restored' : ' — rerun with --fix to restore'}.`);
}
await disposeSafely(f, 'verify');
// ⚠ Drift left in place exits 1: the battery reads this code for its CLEAN/DRIFTED line.
// --fix restores and exits 0; a reference key the module no longer registers exits 2.
process.exit(out.missing.length ? 2 : (out.drift.length && !FIX) ? 1 : 0);
