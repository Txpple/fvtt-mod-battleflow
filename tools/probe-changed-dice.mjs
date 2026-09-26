// Probe (2026-09-26): HOW dnd5e 6.0 MARKS THE DICE IT CHANGES ITSELF — changedDice's one guess.
//
// The dice that rise read the platform's own rerolls and floors off the roll's JSON
// (scripts/decide/dice-chips.js `changedDice`): a result marked `rerolled` pairs with the next
// live result, and a result whose `count` beats its face is a floor. That is a guess about how
// dnd5e 6.0 writes Halfling Luck (`r1=1`) and Reliable Talent (`min10`). This probe rolls both
// through dnd5e's own D20Roll until the rule bites (a natural 1; a natural under 10), prints the
// raw d20 term, and feeds the JSON to changedDice. Nothing is posted to chat. Prints, asserts nothing.
//
//   node tools/probe-changed-dice.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-changed-dice";
const f = await connectSuite({ tag: TAG, watchdogMs: 120_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const { changedDice } = await import(`/modules/${MOD}/scripts/decide/dice-chips.js`);
  const D20Roll = CONFIG.Dice.D20Roll;
  const report = { module: game.modules.get(MOD)?.version, system: game.system.version, cases: [] };
  const run = async (label, options, bites) => {
    for ( let i = 0; i < 600; i++ ) {
      const roll = new D20Roll("1d20 + 5", {}, options);
      roll.configureModifiers();
      await roll.evaluate();
      const die = roll.terms.find(t => t.faces === 20);
      if ( !bites(die) ) continue;
      const json = roll.toJSON();
      report.cases.push({
        label, tries: i + 1, formula: roll.formula, total: roll.total,
        modifiers: die.modifiers, results: die.results,
        chips: changedDice([json])
      });
      return;
    }
    report.cases.push({ label, fatal: "the rule never bit in 600 rolls" });
  };
  // Halfling Luck: a natural 1 rerolled — the first result is the 1.
  await run("halfling luck (r1=1)", { halflingLucky: true }, d => d.results[0]?.result === 1);
  // Reliable Talent: a natural under 10 floored to 10.
  await run("reliable talent (min10)", { minimum: 10 }, d => (d.results.find(r => r.active !== false)?.result ?? 20) < 10);
  // Both at once, in case the floor reads the rerolled die.
  await run("both", { halflingLucky: true, minimum: 10 }, d => d.results[0]?.result === 1);
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
