// RESET THE SHARED TEST FIXTURES' WORLD STATE — conditions off, pools full.
//
// ⚠ WHY THIS IS A TOOL. `smoke-battleflow` rebuilds the scene, the actors and the tokens every
// other suite assumes — but it does NOT clear CONDITIONS. A Topple that landed in an earlier run
// leaves BF Test Victim prone, and Topple then correctly refuses to ask an already-prone target
// to save against being knocked prone. That reads as FIVE section-16 failures in smoke-effects
// (28/37 instead of 46/46) annotated "(fixture)", with nothing anywhere naming the real cause.
// It cost most of an hour on 2026-08-20 and looked exactly like a regression in the applier that
// had just been changed. BF Test PC Attacker was found `dead` in the same pass.
//
// Run it whenever a suite fails with "(fixture)" in the reason, and always before concluding
// that a green-yesterday suite has regressed:
//
//   node tools/reset-fixture-state.mjs
//   node tools/smoke-effects.mjs
//
// It only ever deletes effects that CARRY A STATUS — conditions — so nothing hand-authored on a
// fixture is at risk, and it touches the four BF Test actors and nothing else in the world.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[clear] WATCHDOG'); process.exit(3); }, 120_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
await preflightSoleGM(f);

const out = await f.evaluate(async () => {
  const names = ['BF Test Victim', 'BF Test Attacker', 'BF Test Shielder', 'BF Test PC Attacker'];
  const report = [];
  for (const n of names) {
    const a = game.actors.getName(n);
    if (!a) { report.push(`${n}: MISSING`); continue; }
    const before = [...a.statuses];
    const hpBefore = a.system.attributes?.hp?.value ?? null;
    // Every effect that carries a status — conditions only; leave anything else alone.
    const conditionIds = a.effects.filter(e => (e.statuses?.size ?? 0) > 0).map(e => e.id);
    if (conditionIds.length) await a.deleteEmbeddedDocuments('ActiveEffect', conditionIds);
    if (a.system.attributes?.hp?.max != null) {
      await a.update({ 'system.attributes.hp.value': a.system.attributes.hp.max });
    }
    report.push(`${n}: statuses [${before.join(', ') || 'none'}] -> [${[...a.statuses].join(', ') || 'none'}], `
      + `hp ${hpBefore} -> ${a.system.attributes?.hp?.value ?? null}`);
  }
  return report;
}, null);

for (const l of out) console.log(`· ${l}`);
process.exit(0);
