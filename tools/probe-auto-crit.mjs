// THE AUTOMATIC CRIT'S FACTS, live (the dnd5e 6.0 pass, 2026-09-15): smoke-battleflow §5e read
// inverted at 6.0.1 — the swing within 5 feet of a Paralyzed victim rolled plain dice and the swing
// from 10 feet rolled double. This replays §5e's two swings with the crit judge's INPUTS logged at
// `dnd5e.preRollDamageV2` (auto-damage.js `critFor`): the attack the damage answers, the hits, the
// attacker's token, the target's token, the distance in feet, the target's statuses, the verdict.
//
//   node tools/probe-auto-crit.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const f = await connectSuite({ tag: "probe-auto-crit", watchdogMs: 180_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  const { attackMessageForDamage } = await import("/modules/fvtt-mod-battleflow/scripts/auto-damage.js");
  const { hitTargets } = await import("/modules/fvtt-mod-battleflow/scripts/shared.js");
  const { tokenOfActor, tokenForUuid, nearestFeet } = await import("/modules/fvtt-mod-battleflow/scripts/geometry.js");
  const { autoCritSources } = await import("/modules/fvtt-mod-battleflow/scripts/decide/reminders.js");
  const { CONDITION_BENDS } = await import("/modules/fvtt-mod-battleflow/scripts/decide/registry.js");

  const scene = game.scenes.getName("Battle Flow Test Range");
  if ( canvas.scene?.id !== scene?.id ) await scene.view();
  await sleep(500);
  const attacker = game.actors.getName("BF Test Attacker"), base = game.actors.getName("BF Test Victim");
  const aTok = canvas.tokens.placeables.find(t => t.document.actorId === attacker.id);
  const vTok = canvas.tokens.placeables.find(t => t.document.actorId === base.id);
  if ( !aTok || !vTok ) return { fatal: "fixture tokens missing" };
  const victim = vTok.actor;
  const prior = { pos: { x: aTok.document.x, y: aTok.document.y }, hp: foundry.utils.deepClone(victim.system._source.attributes.hp),
    settings: Object.fromEntries(["autoDamage", "autoApply", "dramaticBeat", "requireTarget", "reactionHold", "effectRiders", "masteryRiders"].map(k => [k, game.settings.get(MOD, k)])) };
  for ( const [k, v] of Object.entries({ autoDamage: "all", autoApply: true, dramaticBeat: 0, requireTarget: false, reactionHold: false, effectRiders: false, masteryRiders: false }) ) await game.settings.set(MOD, k, v);

  const facts = [];
  const hookId = Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
    try {
      const attack = attackMessageForDamage(config, message);
      const rec = { subjectType: config?.subject?.type ?? null, attackId: attack?.id ?? null,
        dataKeys: Object.keys(message?.data ?? {}), configIsCritical: config?.isCritical ?? null };
      if ( attack ) {
        const hits = hitTargets(attack);
        const actor = attack.getAssociatedActor();
        const attackerToken = tokenOfActor(actor);
        rec.speaker = attack.speaker; rec.attackerActor = actor?.uuid ?? null; rec.attackerIsToken = actor?.isToken ?? null;
        rec.attackerToken = attackerToken?.id ?? null; rec.attackerDoc = attackerToken ? { x: attackerToken.document.x, y: attackerToken.document.y } : null;
        rec.targets = attack.system?.targets?.map(t => ({ actor: t.actor, token: t.token, ac: t.ac })) ?? null;
        rec.hits = hits.map(h => {
          const token = tokenForUuid(h.uuid);
          const tActor = token?.actor;
          const distanceFeet = (attackerToken && token) ? nearestFeet(attackerToken, token) : null;
          return { uuid: h.uuid, token: token?.id ?? null, doc: token ? { x: token.document.x, y: token.document.y } : null,
            statuses: [...(tActor?.statuses ?? [])], distanceFeet,
            sources: autoCritSources({ targetStatuses: tActor?.statuses ?? [], distanceFeet, targetName: "t", table: CONDITION_BENDS }) };
        });
      }
      facts.push(rec);
    } catch(err) { facts.push({ error: `${err.message}\n${err.stack}` }); }
  });

  let paralyzed = null;
  const swing = async label => {
    vTok.setTarget(true, { releaseOthers: true });
    const activity = attacker.items.find(i => i.system.activities?.some?.(a => a.type === "attack")).system.activities.find(a => a.type === "attack");
    const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
    const usageId = results?.message?.id ?? null;
    const rolls = await activity.rollAttack({ advantage: true }, { configure: false }, { data: { "system.origin": usageId } });
    const attackMsg = rolls?.[0]?.parent;
    let damageMsg = null;
    for ( let i = 0; i < 40 && !damageMsg; i++ ) {
      await sleep(250);
      damageMsg = game.messages.contents.slice(-10).find(m => (m.type === "damage") && (m._source.system?.origin === usageId));
    }
    return { label, usageId, attackId: attackMsg?.id ?? null, parentIsMessage: attackMsg instanceof ChatMessage,
      d20Crit: rolls?.[0]?.isCritical ?? null, total: rolls?.[0]?.total ?? null,
      damageCrit: damageMsg?.rolls?.[0]?.isCritical ?? null, formula: damageMsg?.rolls?.[0]?.formula ?? null,
      autoCrit: damageMsg?.getFlag(MOD, "autoCrit") ?? null, attackFor: damageMsg?.getFlag(MOD, "attackFor") ?? null };
  };
  const swings = [];
  try {
    await base.update({ "system.attributes.ac.override": 1 });
    await victim.update({ "system.attributes.hp.value": victim.system.attributes.hp.max });
    const eff = await ActiveEffect.implementation.fromStatusEffect("paralyzed");
    paralyzed = await ActiveEffect.implementation.create(eff.toObject(), { parent: victim, keepId: true });
    log.push(`paralyzed on ${victim.uuid}: statuses=${[...victim.statuses].join(",")}`);
    const grid = canvas.scene.grid.size;
    await aTok.document.update({ x: vTok.document.x - grid, y: vTok.document.y });
    await sleep(400);
    log.push(`near: attacker doc (${aTok.document.x},${aTok.document.y}) victim doc (${vTok.document.x},${vTok.document.y}) feet=${nearestFeet(aTok, vTok)}`);
    swings.push(await swing("near"));
    await victim.update({ "system.attributes.hp.value": victim.system.attributes.hp.max });
    await aTok.document.update({ x: vTok.document.x - 2 * grid, y: vTok.document.y });
    await sleep(400);
    log.push(`far: attacker doc (${aTok.document.x},${aTok.document.y}) feet=${nearestFeet(aTok, vTok)}`);
    swings.push(await swing("far"));
  } catch(err) { log.push(`ERROR ${err.message}\n${err.stack}`); }
  finally {
    Hooks.off("dnd5e.preRollDamageV2", hookId);
    try {
      if ( paralyzed ) await paralyzed.delete();
      await aTok.document.update(prior.pos);
      await victim.update({ "system.attributes.hp.value": prior.hp.value, "system.attributes.hp.temp": prior.hp.temp });
      for ( const e of victim.effects.filter(x => x.statuses?.has?.("dead")) ) await e.delete();
      await base.update({ "system.attributes.ac.override": null });
      for ( const [k, v] of Object.entries(prior.settings) ) await game.settings.set(MOD, k, v);
      const mine = game.messages.filter(m => m.speaker?.alias?.startsWith("BF Test"));
      await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch(err) { log.push(`cleanup: ${err.message}`); }
  }
  return { log, swings, facts };
}, null);

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f);
