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
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const env = loadEnv();
setTimeout(() => { console.error('[clear] WATCHDOG'); process.exit(3); }, 120_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
await preflightSoleGM(f);

const out = await f.evaluate(async () => {
  const names = ['BF Test Victim', 'BF Test Attacker', 'BF Test Shielder', 'BF Test PC Attacker'];
  const report = [];
  // ⚠ A KILLED suite leaves its LINKED tokens standing (2026-09-24: a battery killed inside
  // smoke-hitmenu left a linked BF Test Fighter one square from a linked BF Test Attacker, and
  // every later suite that measures distance from the shared attacker — smoke-battleflow's
  // auto-crit, every volley ray — was judged from that square: two batteries red, no module
  // change). The fixtures' own tokens are UNLINKED; every suite that places its own places a
  // LINKED one and removes it in a teardown a kill skips. So: every linked token of a BF Test
  // actor on the test range goes, first, before anything measures anything — EXCEPT the tokens
  // fixture-suite placed, which carry its `fixtureHome` stamp (the built fixtures are linked by
  // nature; the first sweep without the stamp took all eleven of them).
  const range = game.scenes.getName('Battle Flow Test Range');
  if (range) {
    const linked = range.tokens.filter(t => t.actorLink && /^BF Test /.test(game.actors.get(t.actorId)?.name ?? '')
      && !t.getFlag('fvtt-mod-battleflow', 'fixtureHome'));
    if (linked.length) {
      await range.deleteEmbeddedDocuments('Token', linked.map(t => t.id));
      report.push(`swept ${linked.length} linked stray token(s): ${linked.map(t => `${game.actors.get(t.actorId)?.name} @ ${t.x},${t.y}`).join('; ')}`);
    } else report.push('no linked stray tokens on the test range');
  }
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
