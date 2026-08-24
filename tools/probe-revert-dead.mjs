// Live forensic for THE `smoke-battleflow` FLAKE — third sighting, first with evidence
// (battery 2026-08-24T13-05-19). Prints, asserts nothing.
//
// ⚠ WHAT THE CAPTURED RUN SHOWED. Three green batteries rolled 5, 6 and 7 damage into an 11 HP
// hobgoblin. The failing one rolled **11 — exactly lethal** — and both reported failures were
// one line: `reverted marker never set` (the second is collateral; the section bails early and
// both `report()` calls carry the same `why`). The Longsword is 1d8+3, so 11 is the max face,
// ~1 run in 8: **the frequency matches "seen twice, never on demand" exactly.**
//
// ⚠ THE FIRST HYPOTHESIS WAS WRONG, AND IT IS RECORDED HERE SO IT IS NOT RE-DERIVED.
// `revertTarget` calls `clearDefeated`, whose last line only runs when the target is dead:
// `await actor.toggleStatusEffect("dead", { active: false, overlay: true })`. Since the button
// is wired `click -> revertTarget(...)` with **no catch**, a rejection there would be invisible
// AND would skip the two writes that set the marker — a perfect fit. **Measured: it does not
// throw.** On a synthetic token actor at 0 HP the dead status is carried by the CANONICAL id
// (`dnd5edead0000000`), the toggle removes it cleanly in ~155ms, and the HP restore that runs
// before it does not throw either. So the guarded branch is innocent and the cause is elsewhere.
//
// So this reproduces the real thing instead: it makes the victim's death CERTAIN (pool set to 1
// so any damage is lethal), drives the same attack the suite drives, and clicks the same button
// — with an `unhandledrejection` listener armed, because that is the one channel a no-catch
// listener can fail down.
//
// Run:  node tools/probe-revert-dead.mjs
// ⚠ Disconnect the bridge. One suite at a time. Restores the pool and the AC it borrows.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-revert-dead";

const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, requireElect: true, env: loadEnv() });

const out = await f.evaluate(async () => {
  const report = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const err = e => ({ name: e?.name ?? null, message: e?.message ?? String(e),
    stack: (e?.stack ?? "").split("\n").slice(0, 6).join(" | ") });
  const MOD = "fvtt-mod-battleflow";

  // ⚠ THE ONE CHANNEL A NO-CATCH LISTENER CAN FAIL DOWN. `button.addEventListener("click",
  // () => revertTarget(...))` returns a promise nobody holds, so a rejection surfaces only here.
  const rejections = [];
  const onRejection = ev => rejections.push(err(ev.reason ?? ev));
  window.addEventListener("unhandledrejection", onRejection);
  const errors = [];
  const onError = ev => errors.push({ message: ev.message, file: ev.filename, line: ev.lineno });
  window.addEventListener("error", onError);

  const scene = game.scenes.getName("Battle Flow Test Range");
  const attacker = game.actors.getName("BF Test Attacker");
  const victimBase = game.actors.getName("BF Test Victim");
  report.env = {
    foundry: game.version, system: `${game.system.id} ${game.system.version}`,
    combats: game.combats.size, scene: scene?.name ?? null,
    attacker: attacker?.name ?? null, victim: victimBase?.name ?? null
  };
  if (!scene || !attacker || !victimBase) {
    return { ...report, fatal: "the smoke-battleflow fixtures are not on this world" };
  }

  const vTokenDoc = scene.tokens.find(t => t.actorId === victimBase.id);
  const victim = vTokenDoc?.actor;
  if (!victim) return { ...report, fatal: "no victim token on the test range" };

  if (canvas.scene?.id !== scene.id) await scene.view();
  for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(vTokenDoc.id)); i++) await sleep(250);

  const priorHp = foundry.utils.deepClone(victim.system._source.attributes.hp);
  const priorAc = foundry.utils.deepClone(victimBase.system._source.attributes.ac);
  report.setup = { priorHp, priorAc };

  try {
    // Force the hit exactly as the suite does…
    await victimBase.update({ "system.attributes.ac.calc": "flat", "system.attributes.ac.flat": 1 });
    // …and force the DEATH, which the suite leaves to the dice. A pool of 1 makes any damage
    // lethal, so the branch that only runs on a kill runs every time.
    await victim.update({ "system.attributes.hp.value": 1 });
    await sleep(400);
    report.setup.hpBeforeAttack = victim.system.attributes.hp.value;

    canvas.tokens.get(vTokenDoc.id).setTarget(true, { releaseOthers: true });
    const weapon = attacker.items.find(i => i.type === "weapon"
      && i.system.activities?.contents?.some(a => a.type === "attack"));
    const activity = weapon?.system.activities.find(a => a.type === "attack");
    report.setup.weapon = weapon?.name ?? null;
    if (!activity) return { ...report, fatal: "no attack activity on the attacker" };

    const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
    const usageId = results?.message?.id ?? null;
    const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
      { data: { "flags.dnd5e.originatingMessage": usageId } });
    report.attack = { total: rolls?.[0]?.total ?? null, fumble: rolls?.[0]?.isFumble ?? null };

    let damageMsg = null;
    for (let i = 0; i < 40 && !damageMsg; i++) {
      await sleep(250);
      damageMsg = game.messages.contents.slice(-10).find(m =>
        m.getFlag("dnd5e", "roll.type") === "damage"
        && m.getFlag("dnd5e", "originatingMessage") === usageId
        && m.getFlag(MOD, "receipt"));
    }
    if (!damageMsg) return { ...report, fatal: "no receipted damage message", rejections, errors };

    await sleep(1200);   // let the death marks land before anything is read
    report.afterDamage = {
      hp: victim.system.attributes.hp.value,
      died: victim.system.attributes.hp.value === 0,
      statuses: [...victim.statuses],
      receipt: damageMsg.getFlag(MOD, "receipt")
    };

    /* --- the click, and everything that could be wrong about it -------------------------- */
    // ⚠ Report EVERY button under the receipt, not just the one querySelector would take. If a
    // second control appears on the row when the target dies, the suite has been clicking the
    // wrong thing and the module is innocent.
    const roots = [...document.querySelectorAll(`[data-message-id="${damageMsg.id}"]`)];
    report.dom = {
      instances: roots.length,
      receipts: roots.map(r => {
        const rec = r.querySelector(".battleflow-receipt");
        return {
          container: r.closest("#chat-notifications") ? "notifications"
            : r.closest("#chat") ? "chat-log" : (r.closest("[id]")?.id ?? "unknown"),
          hasReceipt: !!rec,
          buttons: rec ? [...rec.querySelectorAll("button")].map(b => ({
            text: (b.textContent ?? "").trim().slice(0, 40),
            connected: b.isConnected
          })) : []
        };
      })
    };

    const button = document.querySelector(`[data-message-id="${damageMsg.id}"] .battleflow-receipt button`);
    report.click = { found: !!button, text: (button?.textContent ?? "").trim(),
      connected: button?.isConnected ?? null };
    if (button) {
      button.click();
      let reverted = null;
      for (let i = 0; i < 40 && !reverted; i++) {
        await sleep(250);
        const flag = game.messages.get(damageMsg.id)?.getFlag(MOD, "receipt");
        if (flag?.targets?.every(t => t.reverted)) reverted = flag;
      }
      report.click.reverted = !!reverted;
      report.click.finalReceipt = game.messages.get(damageMsg.id)?.getFlag(MOD, "receipt");
      report.click.hpAfter = victim.system.attributes.hp.value;
      report.click.statusesAfter = [...victim.statuses];
    }
    report.rejections = rejections;
    report.errors = errors;
    report.cleanupMsgId = damageMsg.id;
    report.usageMsgId = usageId;
  } catch (e) {
    report.fatal = err(e);
    report.rejections = rejections;
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
    try {
      await victim.update({
        "system.attributes.hp.value": priorHp.value,
        "system.attributes.hp.temp": priorHp.temp,
        "system.attributes.hp.tempmax": priorHp.tempmax
      });
      for (const e of victim.effects.filter(x => x.statuses?.has?.("dead"))) await e.delete();
      await victimBase.update({ "system.attributes.ac": priorAc });
      // The two messages this probe made, and nothing else.
      for (const id of [report.cleanupMsgId, report.usageMsgId].filter(Boolean)) {
        await game.messages.get(id)?.delete();
      }
    } catch (e) { report.cleanupError = err(e); }
    await sleep(400);
    report.restored = { hp: victim.system.attributes.hp.value,
      statuses: [...victim.statuses], ac: victimBase.system.attributes.ac.value };
  }

  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
