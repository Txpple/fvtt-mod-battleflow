// Remove every suite fixture from the sandbox world: the "Test Suite" folders and what is in them,
// any actor or scene named like a fixture ("BTB …", "By the Books …", and the pre-3.0.0 "BF …" / "Battle Flow …"
// a sandbox may still hold from before the rename), and any combat a fixture stands in.
// The battery calls it last (unless --keep), so the sandbox is left the copy of prod it was: nothing a
// suite needs lives in the world between runs, `fixture-suite.mjs` builds it all from the compendia.
//
//   node tools/teardown-fixtures.mjs          remove
//   node tools/teardown-fixtures.mjs --list   say what would go, remove nothing
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight).
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "teardown-fixtures";
const dry = process.argv.includes("--list");
const f = await connectSuite({ tag: TAG, watchdogMs: 180_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async ({ dry }) => {
  const FIXTURE = /^(BTB |By the Books |BF |Battle Flow )/;   // the last two: fixtures built before 3.0.0
  const folders = game.folders.filter(x => x.name === "Test Suite");
  const inFolder = doc => folders.some(x => x.id === doc.folder?.id);
  const actors = game.actors.filter(a => inFolder(a) || FIXTURE.test(a.name ?? ""));
  const scenes = game.scenes.filter(s => inFolder(s) || FIXTURE.test(s.name ?? ""));
  const actorIds = new Set(actors.map(a => a.id));
  const sceneIds = new Set(scenes.map(s => s.id));
  const combats = game.combats.filter(c => sceneIds.has(c.scene?.id)
    || c.combatants.some(cb => actorIds.has(cb.actorId)));
  // A 2.x fixture token (formerly Battle Flow) on a scene that stays: its old-scope `fixtureHome` stamp names it.
  const legacyHomes = game.scenes.filter(s => !sceneIds.has(s.id)).map(s => ({ scene: s,
    ids: s.tokens.filter(t => t.flags?.["fvtt-mod-battleflow"]?.fixtureHome).map(t => t.id) })).filter(x => x.ids.length);
  const plan = { world: game.world.id, actors: actors.map(a => a.name), scenes: scenes.map(s => s.name),
    combats: combats.length, folders: folders.map(x => `${x.type}/${x.name}`),
    legacyTokens: legacyHomes.reduce((n, x) => n + x.ids.length, 0) };
  if (dry) return plan;
  for (const { scene, ids } of legacyHomes) await scene.deleteEmbeddedDocuments("Token", ids);
  if (combats.length) await Combat.deleteDocuments(combats.map(c => c.id));
  if (scenes.length) await Scene.deleteDocuments(scenes.map(s => s.id));
  if (actors.length) await Actor.deleteDocuments(actors.map(a => a.id));
  const empty = folders.filter(x => !x.contents.length && !x.children.length);
  if (empty.length) await Folder.deleteDocuments(empty.map(x => x.id));
  return plan;
}, { dry });
console.log(`[${TAG}] ${dry ? "would remove" : "removed"} from "${out.world}": ${out.actors.length} actor(s), `
  + `${out.scenes.length} scene(s), ${out.combats} combat(s), ${out.legacyTokens} pre-3.0.0 fixture token(s), `
  + `folders [${out.folders.join(", ")}]`);
if (out.actors.length) console.log(`  actors: ${out.actors.join(", ")}`);
if (out.scenes.length) console.log(`  scenes: ${out.scenes.join(", ")}`);
await disposeSafely(f, TAG);
process.exit(0);
