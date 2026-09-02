// One-off probe (2026-09-02): how long does the damage OFFER take to open on the hook path for
// the goblin fixture, and where does the time go? smoke-battleflow §5d found the popup absent
// 1.2 s after the attack, present by the buzzer.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const env = loadEnv();
const f = await connectSuite({ tag: "probe-offer", watchdogMs: 180_000, requireElect: false, env });
const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t = [];
  const mark = (label, t0) => t.push(`${label}: ${(performance.now() - t0).toFixed(0)}ms`);
  const errors = [];
  const origError = console.error;
  console.error = (...args) => { errors.push(args.map(a => (a instanceof Error) ? `${a.message}\n${a.stack}` : String(a)).join(" ").slice(0, 600)); origError(...args); };
  // 1. the imports, cold and warm
  for ( const spec of ["/modules/fvtt-mod-battleflow/scripts/sneak.js", "/modules/fvtt-mod-battleflow/scripts/clock-riders.js", "/modules/fvtt-mod-battleflow/scripts/mastery.js"] ) {
    const t0 = performance.now(); await import(spec); mark(`import ${spec.split("/").pop()}`, t0);
  }
  // 2. the hook path, timed
  const scene = game.scenes.getName("Battle Flow Test Range");
  const attacker = game.actors.getName("BF Test Attacker");
  const victim = game.actors.getName("BF Test Victim");
  if (canvas.scene?.id !== scene.id) await scene.view();
  for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
  const at = canvas.tokens.placeables.find(x => x.actor?.id === attacker.id || x.document.actorId === attacker.id);
  const vt = canvas.tokens.placeables.find(x => x.document.actorId === victim.id);
  const prior = { prd: game.settings.get(MOD, "playerRollDamage"), dt: game.settings.get(MOD, "damageTimer"), ad: game.settings.get(MOD, "autoDamage") };
  await game.settings.set(MOD, "playerRollDamage", true);
  await game.settings.set(MOD, "autoDamage", "all");
  at?.control({ releaseOthers: true });
  vt?.setTarget(true, { releaseOthers: true });
  await sleep(150);
  const actor = at?.actor ?? attacker;
  const weapon = actor.items.find(i => i.system.activities?.some?.(a => a.type === "attack"));
  const activity = weapon.system.activities.find(a => a.type === "attack");
  const popups = () => [...document.querySelectorAll(".application")].filter(el => (el.innerHTML ?? "").includes("Damage — your roll"));
  const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
  const t0 = performance.now();
  const rolls = await activity.rollAttack({ advantage: true }, { configure: false }, { data: { "flags.dnd5e.originatingMessage": results?.message?.id } });
  mark("rollAttack resolved", t0);
  let opened = null;
  for (let i = 0; i < 100 && !opened; i++) { if (popups().length) opened = performance.now() - t0; else await sleep(50); }
  mark(`popup opened at`, t0 - (opened ?? 0));
  const attackMsg = rolls?.[0]?.parent;
  const info = { timings: t, errors, popupOpenedMs: opened, hit: attackMsg?.rolls?.[0]?.total, targets: attackMsg?.getFlag("dnd5e", "targets")?.length,
    offerFlag: attackMsg?.getFlag(MOD, "damageOffer") ?? null, sneakFlag: attackMsg?.getFlag(MOD, "sneak") ?? null };
  // tidy: press the offer, restore settings
  await sleep(300);
  popups()[0]?.querySelector('button[data-action="roll"]')?.click();
  await sleep(1500);
  await game.settings.set(MOD, "playerRollDamage", prior.prd);
  await game.settings.set(MOD, "autoDamage", prior.ad);
  const mine = game.messages.filter(m => m.timestamp >= Date.now() - 60000 && (Object.keys(m.flags?.[MOD] ?? {}).length || m.speaker?.alias?.startsWith?.("BF Test")));
  if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id)).catch(() => {});
  vt?.setTarget(false, { releaseOthers: true });
  console.error = origError;
  return info;
}, null);
console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-offer");
process.exit(0);
