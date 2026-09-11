// Probe (2026-09-10): THE STALE SHIELD — the 2026-09-09 table report (BACKLOG *From play*):
// "a stale Shield effect survived a revert, so the next hit offered no reaction", the leftover
// found on Gren's sheet under the SYSTEM's *Unavailable Effects* panel.
//
// The reading that brought this here: core Foundry v14's `ActiveEffect#isSuppressed` is
// `!!(system.isSuppressed ?? duration.expired)` — an effect whose clock ran out is SUPPRESSED,
// not deleted (NOTES §"v14 owns effect expiry": expiry is MARK, not delete). dnd5e files a
// suppressed effect under *Unavailable Effects* and applies none of its changes. The hold's
// `hasReactionEffect` (hold/lookup.js) tests `!e.disabled` only — so an expired, undeleted
// Imperceptible Barrier reads as STANDING to the offer gate while granting no AC. Predicted:
// no revert is needed at all; one Shield cast plus one turn boundary reproduces the report.
//
// Prints, asserts nothing. Runs the whole thing on the GM-owned BF Test Shielder (a copy of
// Gren, the smoke-hold stand-in) in a throwaway combat on the range; everything it creates —
// combat, the attacker's token, the barrier, the run's messages — is undone in `finally`, and
// the settings it pins are handed back.
//
//   node tools/probe-shield-leftover.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-shield-leftover";
const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, ms = 12000) => {
    const end = Date.now() + ms;
    while ( Date.now() < end ) { const v = await fn(); if ( v ) return v; await sleep(200); }
    return null;
  };
  const report = { foundry: game.version, system: `${game.system.id} ${game.system.version}`, module: game.modules.get(MOD)?.version, steps: [], log: [] };
  const log = m => report.log.push(m);
  const started = Date.now();

  const SETTING_KEYS = ["autoDamage", "autoApply", "dramaticBeat", "reactionHold", "holdSettle", "holdReveal", "holdTimer",
    "holdSkipFutile", "holdApplyEffect", "requireTarget", "castApply", "masteryRiders", "volleys", "blockList"];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName("Battle Flow Test Range");
  const attacker = game.actors.getName("BF Test Attacker");
  const gren = game.actors.getName("Gren Greenmantle");
  if ( !scene || !attacker || !gren ) return { fatal: "missing fixture: the range, BF Test Attacker or Gren — run tools/fixture-suite.mjs" };
  const priorActiveScene = game.scenes.active?.id ?? null;
  const priorActiveCombats = game.combats.filter(c => c.active).map(c => c.id);

  const { hasReactionEffect, findInterrupt } = await import("/modules/fvtt-mod-battleflow/scripts/hold/lookup.js");
  const { livePopups } = await import("/modules/fvtt-mod-battleflow/scripts/ui.js");

  let combat = null, attackerTok = null, shielder = null, shielderTok = null, shielderHP = null;
  const barrierOf = actor => (actor?.effects ?? []).find(e => e.name === "Imperceptible Barrier") ?? null;
  const describe = (actor, e) => e ? {
    id: e.id, disabled: e.disabled, isSuppressed: e.isSuppressed, active: e.active,
    expired: e.duration?.expired ?? null, remaining: e.duration?.remaining ?? null,
    duration: foundry.utils.deepClone(e._source.duration ?? null),
    start: foundry.utils.deepClone(e._source.start ?? null),
    origin: e.origin, flags: foundry.utils.deepClone(e._source.flags?.[MOD] ?? null),
    sheetSection: e.isAppliedEnchantment ? "enchantment" : e.isSuppressed ? "UNAVAILABLE (suppressed)" : e.disabled ? "inactive" : e.isTemporary ? "temporary" : "passive",
    ac: actor.system.attributes.ac.value
  } : { none: true, ac: actor.system.attributes.ac.value };
  const step = (name, data) => { report.steps.push({ name, ...data }); };

  const cleanupMessages = async () => {
    const mine = game.messages.filter(m => (m.timestamp >= started)
      && (m.speaker?.alias?.startsWith?.("BF Test") || m.speaker?.alias === "Battle Flow" || Object.keys(m.flags?.[MOD] ?? {}).length));
    if ( mine.length ) await ChatMessage.deleteDocuments(mine.map(m => m.id)).catch(() => {});
  };

  try {
    await set("autoDamage", "all"); await set("autoApply", true); await set("dramaticBeat", 0);
    await set("reactionHold", true); await set("holdSettle", 6); await set("holdApplyEffect", true);
    await set("holdReveal", true); await set("holdSkipFutile", false); await set("holdTimer", 0);
    await set("requireTarget", false); await set("castApply", true); await set("masteryRiders", false); await set("volleys", false);

    if ( game.scenes.active?.id !== scene.id ) { await scene.activate(); await sleep(1500); }
    if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
    await waitFor(() => canvas.ready);

    // The stand-in (smoke-hold's ensureShielder, trimmed): a GM-owned copy of Gren, linked.
    shielder = game.actors.getName("BF Test Shielder");
    if ( !shielder ) {
      const data = gren.toObject(); delete data._id;
      data.name = "BF Test Shielder"; data.ownership = { default: 0 };
      data.prototypeToken.actorLink = true; data.prototypeToken.name = "BF Test Shielder";
      shielder = await Actor.create(data); log("created BF Test Shielder");
    }
    shielderTok = scene.tokens.find(t => t.actorId === shielder.id) ?? null;
    if ( !shielderTok ) [shielderTok] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(shielder.prototypeToken.toObject(), { x: 1500, y: 1000, actorId: shielder.id, actorLink: true }, { inplace: false })]);
    shielderHP = foundry.utils.deepClone(shielder.system._source.attributes.hp);
    await shielder.update({ "system.spells.spell1.value": shielder.system.spells.spell1.max || 4, "system.attributes.hp.value": shielder.system.attributes.hp.max, "system.attributes.hp.temp": 0 });
    for ( const e of shielder.effects.filter(e => (e.name === "Imperceptible Barrier") || e.getFlag(MOD, "mastery")) ) await e.delete().catch(() => {});
    const strays = game.messages.filter(m => { const h = m.getFlag(MOD, "hold"); return (h?.status === "pending") && h.targets?.some(t => (t.uuid === shielder.uuid) && !t.answer); });
    if ( strays.length ) await ChatMessage.deleteDocuments(strays.map(m => m.id));
    await waitFor(() => canvas.tokens.get(shielderTok.id));
    const shielderObj = canvas.tokens.get(shielderTok.id);

    // The attacker needs a token to be a combatant.
    attackerTok = scene.tokens.find(t => t.actorId === attacker.id) ?? null;
    const attackerTokWasMine = !attackerTok;
    if ( !attackerTok ) [attackerTok] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(attacker.prototypeToken.toObject(), { x: 1100, y: 1200, actorId: attacker.id }, { inplace: false })]);
    report.attackerTokWasMine = attackerTokWasMine;

    // A combat: the attacker first, the shielder second — the table's shape (the enemy swings,
    // Gren shields on the enemy's turn).
    for ( const id of priorActiveCombats ) await game.combats.get(id)?.update({ active: false }).catch(() => {});
    combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", [
      { tokenId: attackerTok.id, actorId: attacker.id, initiative: 20 },
      { tokenId: shielderTok.id, actorId: shielder.id, initiative: 10 }
    ]);
    await combat.startCombat();
    await sleep(800);
    const turnOf = () => `r${game.combat?.round}t${game.combat?.turn} (${game.combat?.combatant?.name})`;
    step("combat started", { at: turnOf() });

    const weapon = attacker.items.find(i => i.system.activities?.some?.(a => a.type === "attack"));
    const activity = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === "attack");
    const damageFor = usageId => game.messages.contents.find(m => m.getFlag("dnd5e", "roll.type") === "damage" && m.getFlag("dnd5e", "originatingMessage") === usageId);
    const attack = async () => {
      shielderObj.setTarget(true, { releaseOthers: true });
      const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await activity().rollAttack({ advantage: true }, { configure: false }, { data: { "flags.dnd5e.originatingMessage": usage?.message?.id } });
      const t = rolls?.[0];
      return { usageId: usage?.message?.id, msg: t?.parent, total: t?.total, crit: t?.isCritical, fumble: t?.isFumble };
    };
    const baseAC = shielder.system.attributes.ac.value;
    report.baseAC = baseAC;

    // ---- 1. r1t0: a hit in Shield's flip window, the hold, the popup's own Cast --------------
    let atk = null;
    for ( let i = 0; i < 40 && !atk; i++ ) {
      const a = await attack();
      if ( a.msg && !a.crit && !a.fumble && (a.total >= baseAC) && (a.total < baseAC + 5) ) atk = a; else await sleep(100);
    }
    if ( !atk ) throw new Error(`no attack landed in [${baseAC}, ${baseAC + 4}]`);
    const pending = await waitFor(() => { const h = game.messages.get(atk.msg.id)?.getFlag(MOD, "hold"); return h?.status === "pending" ? h : null; });
    step("first hit held", { at: turnOf(), total: atk.total, pending: !!pending, reaction: pending?.targets?.[0]?.reaction, hadEffect: pending?.targets?.[0]?.hadEffect ?? null });
    const popup = () => { for ( const [k, d] of livePopups.entries() ) if ( k.startsWith(`${atk.msg.id}|`) || (k === atk.msg.id) ) return d; return null; };
    const castButton = await waitFor(() => [...(popup()?.element?.querySelectorAll("footer button, .form-footer button") ?? [])].find(b => b.textContent.trim().startsWith("Cast")) ?? null, 8000);
    if ( !castButton ) throw new Error("no Cast button on the hold popup");
    castButton.click();
    const resolved = await waitFor(() => { const h = game.messages.get(atk.msg.id)?.getFlag(MOD, "hold"); return h?.status === "resolved" ? h : null; }, 25000);
    await sleep(1500);
    step("cast answered — the barrier as applied", { at: turnOf(), verdict: resolved?.targets?.[0]?.verdict, answer: resolved?.targets?.[0]?.answer,
      barrier: describe(shielder, barrierOf(shielder)), hasReactionEffect: hasReactionEffect(shielder, "Shield"),
      damage: { rolled: !!damageFor(atk.usageId), applied: !!damageFor(atk.usageId)?.getFlag(MOD, "receipt") } });

    // ---- 2. the boundaries: r1t1 (the shielder's turn), r2t0 (the attacker's next turn) -------
    await combat.nextTurn(); await sleep(1500);
    step("after nextTurn", { at: turnOf(), barrier: describe(shielder, barrierOf(shielder)), hasReactionEffect: hasReactionEffect(shielder, "Shield") });
    await combat.nextTurn(); await sleep(1500);
    step("after nextTurn again", { at: turnOf(), barrier: describe(shielder, barrierOf(shielder)), hasReactionEffect: hasReactionEffect(shielder, "Shield") });

    // ---- 3. the second hit: does the hold offer? -----------------------------------------------
    const found = await findInterrupt(shielder, { isCritical: false });
    step("findInterrupt before the second swing", { found: found ? { entry: found.entry?.name, item: found.item?.name } : null, reactionChips: shielder.effects.filter(e => e.getFlag(MOD, "mastery") === "reaction").map(e => e.name) });
    let atk2 = null;
    for ( let i = 0; i < 40 && !atk2; i++ ) {
      const a = await attack();
      const live = shielder.system.attributes.ac.value;
      if ( a.msg && !a.crit && !a.fumble && (a.total >= live) && (a.total < baseAC + 5) ) atk2 = a; else await sleep(100);
    }
    if ( !atk2 ) throw new Error("no second plain hit in the window");
    await sleep(3000);
    const hold2 = game.messages.get(atk2.msg.id)?.getFlag(MOD, "hold") ?? null;
    step("second hit", { at: turnOf(), total: atk2.total, liveAC: shielder.system.attributes.ac.value, held: !!hold2, holdStatus: hold2?.status ?? null,
      barrier: describe(shielder, barrierOf(shielder)), damage: { rolled: !!damageFor(atk2.usageId), applied: !!damageFor(atk2.usageId)?.getFlag(MOD, "receipt") },
      hp: shielder.system.attributes.hp.value });
    if ( hold2?.status === "pending" ) {
      // Leave nothing pending: pass it so the run ends clean.
      const merged = foundry.utils.deepClone(hold2); merged.targets.forEach(t => { if ( !t.answer ) t.answer = "pass"; });
      await game.messages.get(atk2.msg.id).setFlag(MOD, "hold", merged); await sleep(1500);
    }

    // ---- 4. what does the platform do with the leftover on later boundaries? ------------------
    await combat.nextTurn(); await sleep(1200);
    step("one more turn on", { at: turnOf(), barrier: describe(shielder, barrierOf(shielder)) });
    await combat.nextRound(); await sleep(1200);
    step("one more round on", { at: turnOf(), barrier: describe(shielder, barrierOf(shielder)) });
    report.ok = true;
  } catch(err) {
    report.error = `${err?.message}\n${err?.stack}`;
  } finally {
    try {
      for ( const app of foundry.applications.instances.values() ) { if ( /RollConfigurationDialog/.test(app.constructor?.name ?? "") || app.element?.querySelector?.("[data-bf-hold]") ) await app.close().catch(() => {}); }
      for ( const [, d] of livePopups.entries() ) await d.close?.().catch?.(() => {});
    } catch { /* gone */ }
    try { if ( combat && game.combats.get(combat.id) ) await combat.delete(); } catch { /* gone */ }
    for ( const id of priorActiveCombats ) { try { await game.combats.get(id)?.update({ active: true }); } catch { /* gone */ } }
    try { if ( report.attackerTokWasMine && attackerTok && scene.tokens.get(attackerTok.id) ) await attackerTok.delete(); } catch { /* gone */ }
    try {
      if ( shielder ) {
        const doomed = shielder.effects.filter(e => (e.name === "Imperceptible Barrier") || e.getFlag(MOD, "mastery") || e.getFlag(MOD, "applied") || e.getFlag(MOD, "reactionEffect")).map(e => e.id);
        if ( doomed.length ) await shielder.deleteEmbeddedDocuments("ActiveEffect", doomed);
        if ( shielderHP ) await shielder.update({ "system.attributes.hp.value": shielderHP.value, "system.attributes.hp.temp": shielderHP.temp ?? 0, "system.spells.spell1.value": shielder.system.spells.spell1.max || 4 });
      }
    } catch(err) { log(`cleanup effects: ${err?.message}`); }
    try { await cleanupMessages(); } catch(err) { log(`cleanup messages: ${err?.message}`); }
    try { for ( const [k, v] of Object.entries(prior) ) await set(k, v); } catch(err) { log(`restore settings: ${err?.message}`); }
    try { const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null; if ( back && (game.scenes.active?.id !== back.id) ) { await back.activate(); await sleep(1000); } } catch { /* fine */ }
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
