// Carry the built BF Test fixtures from an OFFLINE world on disk into the launched sandbox world.
//
//   node tools/carry-fixtures.mjs --from the-broken-heart-of-greenrest [--replace]
//
// Why (2026-10-07): the sandbox moved to a new campaign world (echoes-of-halruaa), which has none of the
// fixtures AND none of the campaign PCs fixture-suite clones from (Gren Greenmantle, Morgash, Salyth).
// smoke-hold and smoke-twoclient read Gren by name, probe-effect-view reads Invictus. This reads the
// source world's LevelDB directly (it must NOT be the running world), rebuilds each actor with its items
// and effects, and creates them in the sandbox with their ids kept, filed under `Test Suite`:
//   - every actor in the source's `Test Suite` actor folder,
//   - the campaign PCs the suites read by name (CAMPAIGN below).
// Ownership is reset to the source's default level; the campaign PCs (player-owned at the source) are
// owned by the player test identity (FOUNDRY_PLAYER_USER). Existing actors (same id or name) are skipped;
// `--replace` deletes them first (a redo after a bad carry).
// Then: reset-fixture-state → scrub-fixture-residue → fixture-suite, as after any refresh (NOTES §5).
import { parseArgs } from "node:util";
import { Foundry, loadEnv } from "fvtt-mcp-dnd5e/client";
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const CAMPAIGN = ["Gren Greenmantle", "Invictus", "Practice Dummy"];
const { values } = parseArgs({ options: { from: { type: "string" }, replace: { type: "boolean", default: false } } });
const env = loadEnv();
const dataDir = env.LOCAL_FOUNDRY_DATA ?? env.FOUNDRY_DATA_DIR;
if (!values.from || !dataDir) {
  console.error("usage: node tools/carry-fixtures.mjs --from <source world id>  (LOCAL_FOUNDRY_DATA in the MCP repo's .env)");
  process.exit(2);
}
// classic-level ships with the MCP repo; resolve it next to its client.
const { ClassicLevel } = await import(new URL("../node_modules/classic-level/index.js", import.meta.resolve("fvtt-mcp-dnd5e/client")));
const base = `${dataDir.replaceAll("\\", "/")}/worlds/${values.from}/data/`;
const readAll = async coll => {
  const db = new ClassicLevel(base + coll, { valueEncoding: "json" });
  const rows = [];
  for await (const row of db.iterator()) rows.push(row);
  await db.close();
  return rows;
};

const testFolder = (await readAll("folders")).map(([, v]) => v).find(v => v.name === "Test Suite" && v.type === "Actor")?._id;
const rows = (await readAll("actors")).map(([k, v]) => { const [, coll, key] = k.split("!"); return { coll, ids: key.split("."), v }; });
// ⚠ ORDER IS DATA: a parent stores its embedded ids as an ordered array (`items`, `effects`), and the
// key order of the LevelDB rows is NOT it. Suites pick "the first weapon with an attack" — rebuilt in key
// order, BF Test Attacker led with its Longbow, not its Longsword, and smoke-maneuvers' melee Riposte and
// Shield Bash never fired (2026-10-07).
const byKey = new Map(rows.map(r => [`${r.coll}!${r.ids.join(".")}`, r.v]));
const ordered = (coll, prefix, ids) => (ids ?? []).map(id => byKey.get(`${coll}!${prefix}${id}`)).filter(Boolean);
const actors = new Map(rows.filter(r => r.coll === "actors").map(r => {
  const a = r.v;
  const items = ordered("actors.items", `${a._id}.`, a.items)
    .map(it => ({ ...it, effects: ordered("actors.items.effects", `${a._id}.${it._id}.`, it.effects) }));
  return [a._id, { ...a, items, effects: ordered("actors.effects", `${a._id}.`, a.effects) }];
}));
const carry = [...actors.values()].filter(a => (testFolder && a.folder === testFolder) || CAMPAIGN.includes(a.name));
console.log(`[carry] ${carry.length} actor(s) read from ${values.from}`);

setTimeout(() => { console.error("[carry] WATCHDOG"); process.exit(3); }, 300_000);
const f = new Foundry(foundryConfig(env));
await f.connect();
await preflightSoleGM(f);
const prep = await f.evaluate(async ({ player }) => {
  let folder = game.folders.find(x => x.type === "Actor" && x.name === "Test Suite");
  folder ??= await Folder.create({ name: "Test Suite", type: "Actor" });
  return { folder: folder.id, player: player ? (game.users.getName(player)?.id ?? null) : null, world: game.world.id };
}, { player: env.FOUNDRY_PLAYER_USER ?? env.MOLTEN_TEST_USER ?? null });
if (prep.world === values.from) throw new Error("the source world is the launched one; carry from an offline world");
for (const a of carry) {
  a.folder = prep.folder;
  a.ownership = { default: a.ownership?.default ?? 0 };
  if (CAMPAIGN.includes(a.name) && prep.player) a.ownership[prep.player] = 3;
  console.log(await f.evaluate(async ({ data, replace }) => {
    const existing = game.actors.get(data._id) ?? game.actors.getName(data.name);
    if (existing && !replace) return `  ${data.name}: exists, skipped`;
    if (existing) await existing.delete();
    const made = await Actor.create(data, { keepId: true });
    return `  ${made.name}: created (${made.items.size} items, ${made.effects.size} effects)`;
  }, { data: a, replace: values.replace }));
}
console.log("[carry] next: reset-fixture-state → scrub-fixture-residue → fixture-suite");
process.exit(0);
