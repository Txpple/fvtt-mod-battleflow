// Reset the shared test fixtures' world state: conditions off, pools full.
// ⚠ Conditions survive fixture rebuilds: a Victim left prone makes Topple rightly refuse, and the
// suite fails as if the applier regressed. Run it whenever a suite fails with "(fixture)", and
// before concluding a green-yesterday suite regressed:
//
//   node tools/reset-fixture-state.mjs
//   node tools/smoke-effects.mjs
//
// It deletes only effects that CARRY A STATUS, on the BTB Test actors only. A 2.x run's leftovers (formerly
// Battle Flow: "BF Test …" actors, the "Battle Flow Test Range", the old-scope `fixtureHome` stamp) are swept too.
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const env = loadEnv();
setTimeout(() => { console.error('[clear] WATCHDOG'); process.exit(3); }, 120_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
await preflightSoleGM(f);

const out = await f.evaluate(async () => {
  const names = ['BTB Test Victim', 'BTB Test Attacker', 'BTB Test Shielder', 'BTB Test PC Attacker'];
  const report = [];
  // ⚠ A killed suite leaves its LINKED tokens standing, and later suites measure distance from them.
  // The shared fixtures' tokens are unlinked, suites place linked ones: every linked BTB Test token on
  // the range goes first, EXCEPT those carrying fixture-suite's `fixtureHome` stamp (the built
  // fixtures are linked by nature).
  // A 2.x fixture token carries the old-scope stamp (read as a property: the old package may be gone).
  const legacyHome = t => !!t.flags?.['fvtt-mod-battleflow']?.fixtureHome;
  for (const range of [game.scenes.getName('By the Books Test Range'), game.scenes.getName('Battle Flow Test Range')]) {
    if (!range) continue;
    const linked = range.tokens.filter(t => legacyHome(t) || (t.actorLink
      && /^(BTB|BF) Test /.test(game.actors.get(t.actorId)?.name ?? '') && !t.getFlag('fvtt-mod-bythebooks', 'fixtureHome')));
    if (linked.length) {
      await range.deleteEmbeddedDocuments('Token', linked.map(t => t.id));
      report.push(`${range.name}: swept ${linked.length} linked stray token(s): ${linked.map(t => `${game.actors.get(t.actorId)?.name} @ ${t.x},${t.y}`).join('; ')}`);
    } else report.push(`${range.name}: no linked stray tokens`);
  }
  for (const n of names) {
    const a = game.actors.getName(n);
    if (!a) { report.push(`${n}: MISSING`); continue; }
    const before = [...a.statuses];
    const hpBefore = a.system.attributes?.hp?.value ?? null;
    // Conditions only; leave anything else alone.
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
