// Live forensic: healing up from 0 leaves the creature Prone, with dnd5e's Apply Downed Conditions at "all"
// (RULINGS *Session zero's combat*, call 2). Prints, asserts in its summary. No module code is under test: the
// question is dnd5e's own rider handling — Unconscious + Prone at 0 HP in combat, Unconscious off on the heal,
// Prone standing.
//
// Run:  node tools/probe-downed-prone.mjs
// ⚠ Disconnect the bridge. One suite at a time. Restores the setting, the HP, the statuses and the combat.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-downed-prone";
const f = await connectSuite({ tag: TAG, watchdogMs: 180_000, requireElect: true, env: loadEnv() });

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (test, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
    return test();
  };
  const report = { steps: [] };
  const scene = game.scenes.getName("By the Books Test Range");
  const victimBase = game.actors.getName("BTB Test Victim");
  if (!scene || !victimBase) return { fatal: "the smoke-bythebooks fixtures are not on this world" };
  if (canvas.scene?.id !== scene.id) await scene.view();
  for (let i = 0; i < 40 && !(canvas.ready && canvas.scene?.id === scene.id); i++) await sleep(250);
  const tokenDoc = scene.tokens.find(t => t.actorId === victimBase.id);
  if (!tokenDoc) return { fatal: "no victim token on the range (run smoke-bythebooks or fixture-suite first)" };
  const victim = tokenDoc.actor;
  const was = game.settings.get("dnd5e", "autoApplyDowned");
  const priorHp = foundry.utils.deepClone(victim.system._source.attributes.hp);
  const priorCombats = game.combats.filter(c => c.active).map(c => c.id);
  let combat = null;
  const statuses = () => [...victim.statuses].sort();
  try {
    await game.settings.set("dnd5e", "autoApplyDowned", "all");
    for (const e of victim.effects.filter(e => e.statuses.has("unconscious") || e.statuses.has("prone") || e.statuses.has("dead"))) { try { await e.delete(); } catch { /* gone */ } }
    await victim.update({ "system.attributes.hp.value": 5, "system.attributes.hp.temp": 0 });
    for (const c of game.combats.filter(c => c.active)) await c.update({ active: false });
    combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tokenDoc.id, actorId: victimBase.id, initiative: 10 }]);
    await combat.startCombat();
    report.steps.push({ step: "before", hp: victim.system.attributes.hp.value, statuses: statuses() });
    // a PC-shaped drop: the fixture is an NPC; dnd5e kills a non-important NPC, so mark it important for the probe
    const important = victim.system.traits?.important ?? null;
    if (important === false) await victim.update({ "system.traits.important": true });
    await victim.applyDamage([{ value: 5, type: "bludgeoning" }]);
    await waitFor(() => victim.statuses.has("unconscious") ? true : null, 8000);
    await sleep(500);
    report.steps.push({ step: "dropped to 0", hp: victim.system.attributes.hp.value, statuses: statuses(),
      effects: victim.effects.map(e => ({ name: e.name, statuses: [...e.statuses], autoDowned: !!e.getFlag("dnd5e", "autoDowned"), dependentOn: e.getFlag("dnd5e", "dependentOn") ?? null })) });
    await victim.applyDamage([{ value: -3, type: "healing" }]);
    await waitFor(() => !victim.statuses.has("unconscious") ? true : null, 8000);
    await sleep(500);
    report.steps.push({ step: "healed to 3", hp: victim.system.attributes.hp.value, statuses: statuses() });
    const dropped = report.steps[1];
    const healed = report.steps[2];
    report.verdict = {
      downedAppliedBoth: dropped.statuses.includes("unconscious") && dropped.statuses.includes("prone"),
      unconsciousOffOnHeal: !healed.statuses.includes("unconscious"),
      proneStays: healed.statuses.includes("prone")
    };
    report.pass = report.verdict.downedAppliedBoth && report.verdict.unconsciousOffOnHeal && report.verdict.proneStays;
    if (important === false) await victim.update({ "system.traits.important": false });
  } catch (err) {
    report.error = `${err?.message}\n${err?.stack}`;
  } finally {
    try {
      for (const e of victim.effects.filter(e => e.statuses.has("unconscious") || e.statuses.has("prone") || e.statuses.has("dead"))) { try { await e.delete(); } catch { /* gone */ } }
      await victim.update({ "system.attributes.hp.value": priorHp.value, "system.attributes.hp.temp": priorHp.temp });
      if (combat && game.combats.get(combat.id)) await combat.delete();
      for (const id of priorCombats) { const c = game.combats.get(id); if (c) await c.update({ active: true }); }
      await game.settings.set("dnd5e", "autoApplyDowned", was);
    } catch (err) { report.teardownError = err?.message; }
  }
  return report;
}, null);

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(out?.pass ? 0 : 1);
