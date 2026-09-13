// THE HIT'S SEQUENCE, on the user's own case (2026-09-13): Invictus swings Midnight (a Sap
// longsword) at the Practice Dummy with Shield Master on the sheet. The ruling: "damage, nothing
// until damage. then mastery rider. then other stuff." This probe measures the order the module
// actually produces on the sandbox — the offer QUEUED at the hit with no popup, the damage landing,
// the Sap notice posting, and only then the offer promoted to pending with its clock started.
//
//   node tools/probe-hit-sequence.mjs
//
// Reads and writes the SANDBOX (tools/target.mjs); restores settings, effects and tokens after.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-hit-sequence";
const f = await connectSuite({ tag: TAG, watchdogMs: 240_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 12000) => {
    const end = Date.now() + ms;
    while ( Date.now() < end ) { const v = await fn(); if ( v ) return v; await sleep(150); }
    return await fn();
  };
  const report = { module: game.modules.get(MOD)?.version, checks: [], log: [] };
  const log = m => report.log.push(m);
  const ok = (name, pass, detail = "") => report.checks.push({ name, pass: !!pass, detail });
  const started = Date.now();

  const SETTING_KEYS = ["autoDamage", "autoApply", "dramaticBeat", "requireTarget", "masteryRiders", "holdTimer", "noticeTimer", "effectRiders", "volleys"];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName("Battle Flow Test Range");
  const invictus = game.actors.getName("Invictus");
  const dummy = game.actors.getName("Practice Dummy");
  if ( !scene || !invictus || !dummy ) return { fatal: "missing: the range (fixture-suite), Invictus or the Practice Dummy" };
  const midnight = invictus.items.getName("Midnight");
  const activity = midnight?.system.activities?.contents?.find(a => a.type === "attack");
  if ( !activity ) return { fatal: "Invictus has no Midnight attack activity" };
  const { livePopups } = await import("/modules/fvtt-mod-battleflow/scripts/ui.js");
  const dialogsWith = text => [...document.querySelectorAll(".application")].filter(el => (el.innerHTML ?? "").includes(text));
  const zOf = el => Number(el?.style?.zIndex ?? 0);

  const priorActiveScene = game.scenes.active?.id ?? null;
  const placed = [];
  const dummyHP = { value: dummy.system.attributes.hp.value, max: dummy.system.attributes.hp.max };
  const ensureToken = async (actor, x, linked) => {
    let doc = scene.tokens.find(t => t.actorId === actor.id);
    if ( !doc ) {
      [doc] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(
        actor.prototypeToken.toObject(), { x, y: 1400, actorId: actor.id, actorLink: linked }, { inplace: false })]);
      placed.push(doc.id);
    }
    return doc;
  };

  try {
    await set("autoDamage", "all"); await set("autoApply", true); await set("dramaticBeat", 0);
    await set("requireTarget", false); await set("masteryRiders", true); await set("effectRiders", true);
    await set("holdTimer", 24); await set("noticeTimer", 24); await set("volleys", false);
    if ( game.scenes.active?.id !== scene.id ) { await scene.activate(); await sleep(1500); }
    if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
    await until(() => canvas.ready);
    const invTok = await ensureToken(invictus, 500, true);
    const dumTok = await ensureToken(dummy, 600, false);
    await sleep(300);
    await invictus.unsetFlag(MOD, "bashUsed").catch(() => {});
    const dummyActor = canvas.tokens.get(dumTok.id)?.actor ?? dummy;
    report.masteries = [...(invictus.system.traits?.weaponProf?.mastery?.value ?? [])];
    report.midnight = { base: midnight.system.type?.baseItem, mastery: midnight.system.mastery };

    let atk = null, queuedAtHit = null, bashPopupAtHit = null;
    for ( let i = 0; i < 8 && !atk; i++ ) {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      canvas.tokens.get(dumTok.id)?.setTarget(true, { releaseOthers: true });
      await sleep(100);
      const use = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        use?.message?.id ? { data: { "flags.dnd5e.originatingMessage": use.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      const stamped = await until(() => msg?.getFlag(MOD, "bashOffer"), 3000);
      if ( !stamped ) { log(`attempt ${i + 1}: no offer stamped (a miss)`); await sleep(1500); continue; }
      queuedAtHit = stamped.status;
      bashPopupAtHit = dialogsWith("— bash").length;
      atk = msg;
    }
    if ( !atk ) return { ...report, fatal: "eight swings, no hit" };
    report.rollMastery = atk.getFlag("dnd5e", "roll.mastery") ?? null;
    ok("1. the hit stamps the offer QUEUED — no popup at the hit", (queuedAtHit === "queued") && (bashPopupAtHit === 0), `status=${queuedAtHit} popups=${bashPopupAtHit}`);

    const dmg = await until(() => game.messages.contents.find(m => (m.timestamp >= started)
      && (m.getFlag("dnd5e", "roll.type") === "damage") && (m.getFlag("dnd5e", "originatingMessage") === atk.getFlag("dnd5e", "originatingMessage"))), 15000);
    ok("2. the damage lands (auto-rolled here; at the table the prompt's Roll Damage)", !!dmg, `damage=${!!dmg}`);
    const receipt = await until(() => dmg?.getFlag(MOD, "receipt"), 10000);
    const notice = await until(() => game.messages.contents.find(m => (m.timestamp >= started)
      && (m.getFlag(MOD, "masteryNotice")?.attackerUuid === invictus.uuid)), 10000);
    ok("3. the mastery rider — the Sap notice posts after the damage", !!notice && !!dmg && (notice.timestamp >= dmg.timestamp), `notice=${!!notice} key=${notice?.getFlag(MOD, "masteryNotice")?.key}`);
    const sapped = await until(() => dummyActor.effects.find(e => e.getFlag(MOD, "mastery")?.key === "sap" || e.name === "Sapped"), 6000);
    ok("3b. the Sapped chip lands on the dummy", !!sapped, `effect=${sapped?.name ?? null}`);

    const offer = await until(() => { const b = atk.getFlag(MOD, "bashOffer"); return (b?.status === "pending") ? b : null; }, 12000);
    ok("4. THEN the offer — promoted to pending after the damage and after the notice, its clock started then",
      !!offer && !!dmg && (offer.promotedAt >= dmg.timestamp) && (!notice || (offer.promotedAt >= notice.timestamp)) && (offer.deadline > offer.promotedAt),
      `promotedAt=${offer?.promotedAt} damageAt=${dmg?.timestamp} noticeAt=${notice?.timestamp} deadline=${offer?.deadline}`);
    await sleep(800);
    const bashPopup = dialogsWith("— bash")[0] ?? null;
    const noticePopup = dialogsWith("Sap —")[0] ?? null;
    ok("5. both windows open, the Sap notice in FRONT of the bash offer (the rank)",
      !!bashPopup && !!noticePopup && (zOf(noticePopup) > zOf(bashPopup)), `bash=${zOf(bashPopup)} notice=${zOf(noticePopup)}`);
    report.receipt = !!receipt;
  } catch(err) {
    report.fatal = `${err?.message ?? err}\n${err?.stack ?? ""}`;
  } finally {
    try { for ( const [, d] of livePopups.entries() ) await d.close?.().catch?.(() => {}); } catch { /* gone */ }
    try {
      const doomed = dummy.effects.filter(e => e.getFlag(MOD, "mastery") || e.name === "Sapped").map(e => e.id);
      if ( doomed.length ) await dummy.deleteEmbeddedDocuments("ActiveEffect", doomed);
      await dummy.update({ "system.attributes.hp.value": dummyHP.value });
    } catch(err) { log(`cleanup dummy: ${err?.message}`); }
    try { await invictus.unsetFlag(MOD, "bashUsed"); } catch { /* fine */ }
    try {
      const mine = game.messages.filter(m => (m.timestamp >= started));
      if ( mine.length ) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch(err) { log(`cleanup messages: ${err?.message}`); }
    try { if ( placed.length ) await scene.deleteEmbeddedDocuments("Token", placed); } catch(err) { log(`cleanup tokens: ${err?.message}`); }
    try { for ( const [k, v] of Object.entries(prior) ) await set(k, v); } catch(err) { log(`restore settings: ${err?.message}`); }
    try { const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null; if ( back && (game.scenes.active?.id !== back.id) ) { await back.activate(); await sleep(800); } } catch { /* fine */ }
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(out?.fatal || out?.checks?.some(c => !c.pass) ? 1 : 0);
