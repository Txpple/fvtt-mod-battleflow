// One-off probe (2026-09-02): use Steady Aim on the rogue fixture and see what the use-chip
// machine did — with the console captured and the hook registration counted.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const env = loadEnv();
const f = await connectSuite({ tag: "probe-steady", watchdogMs: 120_000, requireElect: false, env });
const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  const oe = console.error, ow = console.warn;
  console.error = (...a) => { errors.push("E " + a.map(x => (x instanceof Error) ? `${x.message}\n${x.stack}` : String(x)).join(" ").slice(0, 800)); oe(...a); };
  console.warn = (...a) => { errors.push("W " + a.map(String).join(" ").slice(0, 300)); ow(...a); };
  const rogue = game.actors.getName("BF Test Rogue");
  const steady = rogue.items.find(i => i.name === "Steady Aim");
  const act = steady ? [...steady.system.activities][0] : null;
  const priorList = game.settings.get(MOD, "effectList");
  await game.settings.set(MOD, "effectList", game.settings.settings.get(`${MOD}.effectList`).default);
  const listHas = game.settings.get(MOD, "effectList").toLowerCase().includes("steady aim");
  const hookCount = (Hooks.events["dnd5e.postUseActivity"] ?? []).length;
  const before = rogue.effects.map(e => e.id);
  const results = act ? await act.use({}, { configure: false }, {}) : null;
  await sleep(1500);
  const info = { hasItem: !!steady, actType: act?.type, actName: act?.name, listHas, hookCount, errors,
    walk: rogue.system.attributes.movement.walk, newEffects: rogue.effects.filter(e => !before.includes(e.id)).map(e => ({ name: e.name, flags: e.flags?.[MOD], changes: e.changes.map(c => `${c.key}=${c.value}`) })),
    cardFlags: results?.message ? Object.keys(results.message.flags?.[MOD] ?? {}) : null, resultsKeys: results ? Object.keys(results) : null };
  const mine = rogue.effects.filter(e => !before.includes(e.id)).map(e => e.id);
  if (mine.length) await rogue.deleteEmbeddedDocuments("ActiveEffect", mine).catch(() => {});
  if (results?.message instanceof ChatMessage) await results.message.delete().catch(() => {});
  await game.settings.set(MOD, "effectList", priorList);
  console.error = oe; console.warn = ow;
  return info;
}, null);
console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-steady");
process.exit(0);
