// Verify the live world settings against the table's reference configuration: reads every
// world-scoped key, reports drift, and restores it with --fix. Run after any suite or probe.
// The REFERENCE below is the single source: when the table changes a setting, update it here.
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const FIX = process.argv.includes('--fix');
const env = loadEnv();
setTimeout(() => { console.error('[verify] WATCHDOG 120s'); process.exit(3); }, 120_000);

// THE REFERENCE TABLE (NOTES.md points here). ⚠ Every world-scoped setting must be listed: the
// loop walks this table, so an unlisted registration is never checked and drifts in silence.
const REFERENCE = {
  decisionTimer: 24,     // every question's clock
  dramaticBeat: 0,       // 0 is the deliberate table value, not suite residue
  saveRolls: 'prompt',
  concVisibility: true,
  holdReveal: true,
  masteryAsk: 'ask',
  resourceNotices: true
};

const f = new Foundry(foundryConfig(env));
console.log('[verify] connecting…');
await f.connect();

const out = await f.evaluate(async ({ reference, fix }) => {
  const MOD = 'fvtt-mod-battleflow';
  const drift = [];
  const missing = [];
  for (const [key, want] of Object.entries(reference)) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) { missing.push(key); continue; }
    const have = game.settings.get(MOD, key);
    const norm = v => (typeof v === 'string') ? v.replace(/\s+/g, ' ').trim() : v;
    if (norm(have) !== norm(want)) {
      drift.push({ key, have, want });
      if (fix) await game.settings.set(MOD, key, want);
    }
  }
  // The suites' cover lever: a scene left flagged after a killed run measures no cover for the table.
  for (const scene of game.scenes) {
    if (!scene.getFlag(MOD, 'noCover')) continue;
    drift.push({ key: `scene "${scene.name}" noCover`, have: true, want: null });
    if (fix) await scene.unsetFlag(MOD, 'noCover');
  }
  return { drift, missing };
}, { reference: REFERENCE, fix: FIX });

if (out.missing.length) console.log(`[verify] UNREGISTERED keys (old client code?): ${out.missing.join(', ')}`);
if (!out.drift.length) console.log('[verify] CLEAN — every setting matches the reference table.');
else {
  for (const d of out.drift) console.log(
    `  DRIFT ${d.key}: have ${JSON.stringify(d.have)} want ${JSON.stringify(d.want)}${FIX ? ' — FIXED' : ''}`);
  console.log(`[verify] ${out.drift.length} drifted${FIX ? ', restored' : ' — rerun with --fix to restore'}.`);
}
await disposeSafely(f, 'verify');
// ⚠ Drift left in place exits 1: the battery reads this code for its CLEAN/DRIFTED line.
// --fix restores and exits 0; unregistered keys exit 2.
process.exit(out.missing.length ? 2 : (out.drift.length && !FIX) ? 1 : 0);
