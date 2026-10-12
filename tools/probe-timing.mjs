/**
 * WHERE DO A JOB'S SECONDS GO — the timing probe behind issue #10 (2026-10-10: 84 items on one
 * actor took five minutes, cause unmeasured). Connects, takes a census (hook counts, document
 * counts, active modules), then times the shapes a one-off job is made of — compendium reads,
 * one actor, N items in one call and one at a time, updates, chat, a token — and deletes what it
 * made. Prints a table; `--json <file>` appends the row for a comparison across states.
 *
 *   node tools/probe-timing.mjs                              the sandbox, through the harness (lock + preflight)
 *   node tools/probe-timing.mjs --label "module off"         a name for the row
 *   node tools/probe-timing.mjs --items 84                   the embedded-create size (default 84)
 *   node tools/probe-timing.mjs --beside                     NO lock, NO preflight: join as the suite user
 *                                                            beside whatever else holds a seat — the only way
 *                                                            to measure "a second GM is connected"
 *   node tools/probe-timing.mjs --beside --as bridge         ...as the bridge user instead (beside a running suite)
 *   node tools/probe-timing.mjs --json dist/timing.jsonl     append the row
 *
 * ⚠ Mutates the world (one throwaway actor, its items, five chat messages, one token), all deleted
 * at the end. Read-only in intent, not in mechanism.
 */
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Foundry, foundryConfig as clientConfig, loadEnv } from "fvtt-mcp-dnd5e/client";
import { strictArgs, usageOf } from "./args.mjs";
import { connectSuite, disposeSafely } from "./harness.mjs";

const { values } = strictArgs({
  options: {
    label: { type: "string" },
    items: { type: "string" },
    beside: { type: "boolean" },
    as: { type: "string" },
    json: { type: "string" }
  },
  usage: usageOf(fileURLToPath(import.meta.url)),
  script: "probe-timing.mjs"
});
const label = values.label ?? "unlabelled";
const items = Number(values.items ?? 84);
if (!Number.isInteger(items) || items < 1) { console.error("--items takes a positive integer"); process.exit(2); }

const T0 = Date.now();
const wall = () => Math.round(Date.now() - T0);
let f;
if (values.beside) {
  // The suite identity (what a job joins as), beside whatever else holds a seat; the lock and the preflight are skipped on purpose.
  setTimeout(() => { console.error("[timing] WATCHDOG 600s — hard abort"); process.exit(3); }, 600_000);
  const as = values.as ?? "suite";
  if (!["suite", "bridge", "player"].includes(as)) { console.error("--as takes suite, bridge or player"); process.exit(2); }
  const cfg = clientConfig(loadEnv(), "local", as);
  console.log(`[timing] BESIDE: joining ${cfg.serverUrl} as "${cfg.user}" (${as}) with no lock and no preflight`);
  f = new Foundry(cfg);
  await f.connect();
} else {
  f = await connectSuite({ tag: "timing", watchdogMs: 600_000 });
}
const connectMs = wall();

const census = await f.evaluate(async () => {
  const n = h => Hooks.events[h]?.length ?? 0;
  return {
    self: game.user.name,
    gms: game.users.filter(u => u.active && u.isGM).map(u => u.name),
    hooks: {
      renderChatMessage: n("dnd5e.renderChatMessage"), renderChatMessageHTML: n("renderChatMessageHTML"),
      preCreateItem: n("preCreateItem"), createItem: n("createItem"),
      preUpdateActor: n("preUpdateActor"), updateActor: n("updateActor"), createToken: n("createToken")
    },
    docs: { actors: game.actors.size, items: game.items.size, messages: game.messages.size, combats: game.combats.size, scenes: game.scenes.size },
    bythebooks: game.modules.get("fvtt-mod-bythebooks")?.active ? game.modules.get("fvtt-mod-bythebooks").version : "OFF",
    modules: game.modules.filter(m => m.active).length
  };
}, null);

const phases = await f.evaluate(async ({ items }) => {
  const out = {};
  const time = async (k, fn) => { const t = performance.now(); const r = await fn(); out[k] = Math.round(performance.now() - t); return r; };
  const pack = game.packs.get("dnd5e.items");
  const uuids = pack.index.filter(e => ["weapon", "equipment", "consumable", "tool"].includes(e.type)).map(e => e.uuid);
  const first40 = uuids.slice(0, 40);
  await time("fromUuid x20 sequential", async () => { for (const u of first40.slice(0, 20)) await fromUuid(u); });
  const docs = await time("fromUuid x40 parallel", () => Promise.all(first40.map(u => fromUuid(u))));
  const data = docs.map(d => d.toObject());
  const many = [];
  while (many.length < items) many.push(...data.slice(0, items - many.length));
  const actor = await time("Actor.create (npc)", () => Actor.create({ name: "BTB timing probe", type: "npc" }));
  await time(`createEmbeddedDocuments ${items} items, one call`, () => actor.createEmbeddedDocuments("Item", many));
  await time("createEmbeddedDocuments 1 item x10 sequential", async () => { for (const d of data.slice(0, 10)) await actor.createEmbeddedDocuments("Item", [d]); });
  await time("actor.update x10 sequential", async () => { for (let i = 1; i <= 10; i++) await actor.update({ "system.attributes.hp.value": i }); });
  const msgs = await time("ChatMessage.create x5 sequential", async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push((await ChatMessage.create({ content: `timing probe ${i}`, speaker: { actor: actor.id } })).id);
    return ids;
  });
  const scene = game.scenes.active ?? game.scenes.contents[0];
  let token = null;
  if (scene) {
    token = await time("token create", async () => {
      const td = await actor.getTokenDocument({ x: scene.dimensions.sceneX, y: scene.dimensions.sceneY });
      const [doc] = await scene.createEmbeddedDocuments("Token", [td.toObject()]);
      return doc;
    });
    await time("token delete", () => token.delete());
  }
  await time("chat delete x5", () => ChatMessage.deleteDocuments(msgs));
  await time("actor delete", () => actor.delete());
  return out;
}, { items });

const disposeT = Date.now();
if (values.beside) await disposeSafely(f, "timing"); else await f.dispose();
const disposeMs = Date.now() - disposeT;

console.log(`\n[timing] ${label} — ${census.self}, GMs connected: ${census.gms.join(", ")}; By the Books ${census.bythebooks}; ${census.modules} modules active`);
console.log(`[timing] hooks: ${Object.entries(census.hooks).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`[timing] docs: ${Object.entries(census.docs).map(([k, v]) => `${k} ${v}`).join(", ")}`);
const rows = [["connect (launch + join + ready)", connectMs], ...Object.entries(phases), ["dispose", disposeMs]];
const w = Math.max(...rows.map(([k]) => k.length));
for (const [k, ms] of rows) console.log(`  ${k.padEnd(w)}  ${String(ms).padStart(7)} ms`);
console.log(`[timing] total ${wall()} ms`);

if (values.json) {
  appendFileSync(values.json, `${JSON.stringify({ at: new Date().toISOString(), label, items, beside: !!values.beside, census, connectMs, phases, disposeMs, totalMs: wall() })}\n`);
  console.log(`[timing] row appended to ${values.json}`);
}
process.exit(0);
