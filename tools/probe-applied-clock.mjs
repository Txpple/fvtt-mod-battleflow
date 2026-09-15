// THE CLOCK OF AN APPLIED EFFECT, live on the sandbox (2026-09-15, decide/chips.js `appliedClock`):
//   rule 1 — Death Armor (Heroes of Faerûn: the spell says 1 hour, its effect says nothing) lands
//            with the spell's hour;
//   rule 2 — Noxious Miasma's "−2 AC until the end of ITS next turn" (a 1-turn duration) landing on
//            Invictus on Bramblemaw's turn is pinned to INVICTUS's place: alive through the dragon's
//            turn end and Invictus's own turn, expired only at the end of Invictus's turn.
// Drives the module's own applier (effect-riders.js `applyEffectsTo`) with the real documents.
//
//   node tools/probe-applied-clock.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-applied-clock";
const f = await connectSuite({ tag: TAG, watchdogMs: 240_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while ( Date.now() < end ) { const v = fn(); if ( v ) return v; await sleep(120); } return fn(); };
  const report = { module: game.modules.get(MOD)?.version, checks: [], log: [] };
  const ok = (name, pass, detail = "") => report.checks.push({ name, pass: !!pass, detail });

  const scene = game.scenes.getName("Battle Flow Test Range");
  const invictus = game.actors.getName("Invictus");
  const dragon = game.actors.getName("Bramblemaw");
  if ( !scene || !invictus || !dragon ) return { fatal: "missing the range, Invictus or Bramblemaw" };
  const { applyEffectsTo } = await import("/modules/fvtt-mod-battleflow/scripts/effect-riders.js");
  const priorActiveScene = game.scenes.active?.id ?? null;
  const priorCombats = game.combats.filter(c => c.active).map(c => c.id);
  const placed = [];
  let combat = null;
  const made = [];
  try {
    if ( game.scenes.active?.id !== scene.id ) { await scene.activate(); await sleep(1500); }
    if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
    await until(() => canvas.ready);
    const ensure = async (actor, x, linked) => {
      let doc = scene.tokens.find(t => t.actorId === actor.id);
      if ( !doc ) { [doc] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y: 1400, actorId: actor.id, actorLink: linked }, { inplace: false })]); placed.push(doc.id); }
      return doc;
    };
    const invTok = await ensure(invictus, 500, true);
    const drgTok = await ensure(dragon, 800, false);
    const drgActor = canvas.tokens.get(drgTok.id)?.actor ?? dragon;

    // --- rule 1: Death Armor's hour ---------------------------------------------------------
    const deathArmor = invictus.items.getName("Death Armor");
    const daEffect = deathArmor?.effects.contents[0] ?? null;
    ok("0. Death Armor's own effect is clockless as the pack wrote it, its spell says 1 hour",
      !!daEffect && !(daEffect._source.duration?.value > 0) && deathArmor.system.duration?.units === "hour", `effect=${!!daEffect} value=${daEffect?._source.duration?.value} units=${daEffect?._source.duration?.units} spell=${JSON.stringify({ value: deathArmor?.system?.duration?.value, units: deathArmor?.system?.duration?.units })}`);
    for ( const e of invictus.effects.filter(e => e.name === "Death Armor") ) await e.delete();
    const r1 = await applyEffectsTo([{ uuid: invictus.uuid, name: invictus.name }], [daEffect], { source: invictus.uuid });
    const landedDA = invictus.effects.get(r1[0]?.effects?.[0]?.id ?? "") ?? invictus.effects.find(e => e.name === "Death Armor");
    if ( landedDA ) made.push(landedDA);
    ok("1. rule 1 — the landed Death Armor carries the spell's hour (3600 s) and paints as temporary",
      !!landedDA && (landedDA.duration?.seconds === 3600) && (landedDA._source.duration?.units === "seconds") && (landedDA.isTemporary === true), `seconds=${landedDA?.duration?.seconds} units=${landedDA?._source.duration?.units} value=${landedDA?._source.duration?.value} temp=${landedDA?.isTemporary} entries=${r1.length}`);

    // --- rule 2: the Miasma's turn, pinned to the victim -------------------------------------
    const miasma = drgActor.items.getName("Noxious Miasma");
    const mEffect = miasma?.effects.contents[0] ?? null;
    const mActivity = miasma?.system.activities?.contents?.find(a => a.type === "save");
    ok("2. Noxious Miasma's save activity is a 1-turn duration as the Monster Manual wrote it",
      !!mEffect && mActivity?.duration?.units === "turn" && Number(mActivity?.duration?.value) === 1, `effect=${mEffect?.name} activity=${JSON.stringify(mActivity?.duration ? { units: mActivity.duration.units, value: mActivity.duration.value } : null)}`);
    combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", [
      { tokenId: drgTok.id, actorId: drgActor.id, sceneId: scene.id, initiative: 20 },
      { tokenId: invTok.id, actorId: invictus.id, sceneId: scene.id, initiative: 10 }
    ]);
    await combat.startCombat();
    await sleep(300);
    ok("2a. combat: the dragon's turn first", combat.combatant?.actorId === drgActor.id, `turn=${combat.combatant?.name}`);
    // a leftover from an earlier table test would be found by name and read as the landed one —
    // sweep any same-named effect first, and find the landed one by the id the applier returns
    for ( const e of invictus.effects.filter(e => e.name === mEffect.name) ) await e.delete();
    const r2 = await applyEffectsTo([{ uuid: invictus.uuid, name: invictus.name }], [mEffect], { source: drgActor.uuid });
    const landedId = r2[0]?.effects?.[0]?.id ?? null;
    const landedM = landedId ? invictus.effects.get(landedId) : invictus.effects.find(e => e.name === mEffect.name);
    if ( landedM ) made.push(landedM);
    const invCombatant = combat.combatants.find(c => c.actorId === invictus.id);
    ok("2b. rule 2 — the −2 AC lands pinned to INVICTUS's place: 1 round, expiry turnEnd, start.combatant = Invictus",
      !!landedM && (landedM._source.duration?.value === 1) && (landedM._source.duration?.units === "rounds") && (landedM.duration?.expiry === "turnEnd") && (landedM._source.start?.combatant === invCombatant?.id),
      `value=${landedM?._source.duration?.value} units=${landedM?._source.duration?.units} expiry=${landedM?.duration?.expiry} start=${landedM?._source.start?.combatant} invictus=${invCombatant?.id} entries=${r2.length}`);
    const acNow = invictus.system.attributes.ac;
    ok("2c. it is ACTIVE on the dragon's turn (the −2 itself does not land: the Monster Manual wrote it against an armor item's field, `system.armor.value` — the pack's slip, the world record's to fix, not the module's)", landedM?.active === true,
      `active=${landedM?.active} ac=${JSON.stringify({ value: acNow.value, flat: acNow.flat, calc: acNow.calc, bonus: acNow.bonus, armor: acNow.armor, shield: acNow.shield })} changes=${JSON.stringify(landedM?.changes?.map(c => ({ key: c.key, mode: c.mode, value: c.value })) ?? null)} sourceChanges=${JSON.stringify(mEffect?._source?.changes ?? mEffect?._source?.system?.changes ?? null)}`);
    await combat.nextTurn(); await sleep(400);   // the dragon's turn ends → Invictus's turn
    ok("2d. still active through the dragon's turn end, on Invictus's own turn", combat.combatant?.actorId === invictus.id && invictus.effects.get(landedM.id)?.active === true,
      `turn=${combat.combatant?.name} active=${invictus.effects.get(landedM.id)?.active}`);
    await combat.nextTurn(); await sleep(400);   // Invictus's turn ends → round 2, the dragon
    const after = invictus.effects.get(landedM.id);
    ok("2e. expired at the end of Invictus's turn — suppressed",
      !!after && (after.active === false), `active=${after?.active} expired=${after?.duration?.expired} ac=${invictus.system.attributes.ac.value}`);
  } catch(err) {
    report.fatal = `${err?.message ?? err}\n${err?.stack ?? ""}`;
  } finally {
    try { if ( combat && game.combats.get(combat.id) ) await combat.delete(); } catch { /* gone */ }
    for ( const id of priorCombats ) { try { await game.combats.get(id)?.update({ active: true }); } catch { /* gone */ } }
    try { const ids = made.map(e => e.id).filter(id => invictus.effects.get(id)); if ( ids.length ) await invictus.deleteEmbeddedDocuments("ActiveEffect", ids); } catch(err) { report.log.push(`cleanup effects: ${err?.message}`); }
    try { if ( placed.length ) await scene.deleteEmbeddedDocuments("Token", placed); } catch(err) { report.log.push(`cleanup tokens: ${err?.message}`); }
    try { const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null; if ( back && (game.scenes.active?.id !== back.id) ) { await back.activate(); await sleep(800); } } catch { /* fine */ }
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(out?.fatal || out?.checks?.some(c => !c.pass) ? 1 : 0);
