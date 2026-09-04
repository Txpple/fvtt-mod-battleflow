// Morgash's maneuvers vs the 2024 PHB pack (2026-09-04): the table's Goading Attack demanded its
// save, Jetten failed, and NOTHING landed — the probe (probe-hitmenu-table.mjs) found the save
// activity's effect entry did not RESOLVE: the item on the actor had no "Goaded" effect at all,
// though the pack's copy carries one (transfer: true). This compares every maneuver on an actor
// against the pack, effect by effect, and with `--fix` replaces a mismatched item with the pack's
// copy (same name, the pool re-resolved by identifier — hit-menu.js reads all three shapes).
//
//   node tools/fixture-morgash-maneuvers.mjs [--actor "Morgash the Gravemaker"] [--fix]
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight). Read-only without --fix.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const at = args.indexOf("--actor");
const actorName = at >= 0 ? args[at + 1] : "Morgash the Gravemaker";
const NAMES = ["Trip Attack", "Goading Attack", "Menacing Attack", "Pushing Attack", "Disarming Attack",
  "Distracting Strike", "Maneuvering Attack", "Sweeping Attack", "Precision Attack", "Riposte", "Rally"];

const f = await connectSuite({ tag: "fixture-morgash", watchdogMs: 180_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async ({ actorName, NAMES, fix }) => {
  const actor = game.actors.getName(actorName);
  if (!actor) return { error: `no actor named ${actorName}` };
  const pack = game.packs.get("dnd-players-handbook.classes");
  const index = await pack.getIndex();
  const rows = [];
  const replace = [];
  for (const name of NAMES) {
    const mine = actor.items.find(i => (i.type === "feat") && (i.name === name));
    if (!mine) { rows.push({ name, on: false }); continue; }
    const hit = index.find(e => e.name === name);
    const packDoc = hit ? await pack.getDocument(hit._id) : null;
    const packEffects = packDoc ? packDoc.effects.map(e => `${e.name}${e.transfer ? " (transfer)" : ""}`) : null;
    const myEffects = mine.effects.map(e => `${e.name}${e.transfer ? " (transfer)" : ""}`);
    const acts = [...mine.system.activities].map(a => ({ type: a.type, name: a.name, effects: (a.effects ?? []).map(e => `${e._id}${e.effect ? "" : " (DANGLING)"}`),
      pool: (a.consumption?.targets ?? []).map(t => t.target) }));
    const dangling = acts.some(a => a.effects.some(e => /DANGLING/.test(e)));
    const missing = (packEffects ?? []).filter(e => !myEffects.includes(e));
    rows.push({ name, on: true, myEffects, packEffects, activities: acts, dangling, missing });
    if (fix && packDoc && (dangling || missing.length)) replace.push({ mine, packDoc });
  }
  const fixed = [];
  for (const { mine, packDoc } of replace) {
    const data = packDoc.toObject();
    delete data._id;
    await mine.delete();
    const [made] = await actor.createEmbeddedDocuments("Item", [data]);
    fixed.push(`${made.name}: effects now [${made.effects.map(e => e.name).join(", ")}], activity effects ${[...made.system.activities].map(a => (a.effects ?? []).map(e => e.effect ? e.effect.name : "DANGLING").join("/")).join(" | ")}`);
  }
  return { actor: actor.name, rows, fixed };
}, { actorName, NAMES, fix });
console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "fixture-morgash");
