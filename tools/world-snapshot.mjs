// THE DISPOSABLE TEST WORLD — snapshot the sandbox's databases, run a battery, roll it back.
// Rolling back removes the hazards of a shared, long-lived world (NOTES.md §5): settings residue,
// a crashed run's laundered pins, poisoned statuses, late teardown sweeps. Only the LevelDB data/
// is snapshotted; suites never write assets.
//
//   node tools/world-snapshot.mjs take      # bounce down, copy data/ -> snapshot, bounce up
//   node tools/world-snapshot.mjs restore   # bounce down, copy snapshot -> data/, bounce up
//   node tools/world-snapshot.mjs status
//   node tools/world-snapshot.mjs drop      # delete the snapshot
//
// ⚠ The world must be DOWN both ways: Foundry holds LevelDB open, so a live copy is torn and a
// live overwrite corrupts. The sibling launcher deactivates (db.disconnect + world.save) first.
// ⚠ data/ shrinks after a restore (LevelDB compacts on a clean open): verify by CONTENT, never size.
// LOCAL ONLY, ALWAYS. There is no prod path here and there must never be one.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadEnv, repoRoot, resolveHostConfig } from "fvtt-mcp-dnd5e/client";

// The MCP repo's launcher and its `local` host preset (FOUNDRY_DATA_DIR, FOUNDRY_WORLD_ID — or,
// unset, the one world under Data/worlds, the launcher's own rule).
const LAUNCHER = join(repoRoot(), "scripts", "local-foundry.mjs");
const LOCAL = resolveHostConfig(loadEnv(), "local");

const dataRoot = LOCAL.dataDir;
const worldId = LOCAL.worldId ?? (() => {
  try {
    const ids = readdirSync(join(dataRoot, "worlds"), { withFileTypes: true })
      .filter(d => d.isDirectory() && existsSync(join(dataRoot, "worlds", d.name, "world.json")))
      .map(d => d.name);
    return ids.length === 1 ? ids[0] : "";
  } catch { return ""; }
})();
if (!dataRoot || !worldId) {
  console.error("[snapshot] FOUNDRY_DATA_DIR and a world id (FOUNDRY_WORLD_ID, or exactly one world under Data/worlds) are required in the MCP repo's .env");
  process.exit(2);
}

const worldDir = join(dataRoot, "worlds", worldId);
const liveData = join(worldDir, "data");
const snapDir = join(dirname(dataRoot), "bf-snapshots", worldId);
const snapData = join(snapDir, "data");
const stampFile = join(snapDir, "taken.json");

const launcher = (...args) =>
  spawnSync(process.execPath, [LAUNCHER, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const worldIsUp = () => /world:\s+ACTIVE/.test(launcher("status").stdout ?? "");
const usersConnected = () => Number(/users:\s+(\d+)/.exec(launcher("status").stdout ?? "")?.[1] ?? 0);

/** Bring the box down, run `fn`, bring it back up. Always restarts, even if `fn` throws. */
function whileDown(what, fn) {
  const connected = usersConnected();
  if (connected > 0) {
    console.error(`[snapshot] REFUSING: ${connected} user(s) connected. Disconnect first — a live client would be writing.`);
    process.exit(1);
  }
  const wasUp = worldIsUp();
  if (wasUp) {
    console.log("[snapshot] stopping the world (deactivate + flush)…");
    const r = launcher("stop");
    if (r.status !== 0) { console.error(r.stderr || r.stdout); throw new Error("could not stop the world"); }
  }
  try {
    const t0 = process.hrtime.bigint();
    fn();
    console.log(`[snapshot] ${what} in ${Number(process.hrtime.bigint() - t0) / 1e9}s`);
  } finally {
    if (wasUp) {
      console.log("[snapshot] starting the world back up…");
      const r = launcher("start");
      console.log((r.stdout ?? "").trim());
      if (r.status !== 0) console.error(r.stderr || "(start reported a failure — check `local-foundry.mjs status`)");
    }
  }
}

const sizeOf = dir => {
  let bytes = 0;
  const walk = d => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else bytes += statSync(p).size;
    }
  };
  walk(dir);
  return bytes;
};

const command = process.argv[2];

switch (command) {
  case "take": {
    if (!existsSync(liveData)) { console.error(`[snapshot] no world data at ${liveData}`); process.exit(2); }
    whileDown("snapshot taken", () => {
      rmSync(snapDir, { recursive: true, force: true });
      mkdirSync(snapDir, { recursive: true });
      cpSync(liveData, snapData, { recursive: true });
      writeFileSync(stampFile, JSON.stringify({ worldId, takenAt: new Date().toISOString() }, null, 2));
    });
    console.log(`[snapshot] ${worldId} -> ${snapDir}`);
    break;
  }

  case "restore": {
    if (!existsSync(snapData)) { console.error("[snapshot] no snapshot to restore — run `take` first"); process.exit(2); }
    whileDown("world restored", () => {
      rmSync(liveData, { recursive: true, force: true });
      cpSync(snapData, liveData, { recursive: true });
    });
    const stamp = JSON.parse(readFileSync(stampFile, "utf8"));
    console.log(`[snapshot] rolled back to the snapshot taken ${stamp.takenAt}`);
    break;
  }

  case "status": {
    console.log(`world dir: ${worldDir}`);
    console.log(`snapshot:  ${existsSync(snapData) ? snapDir : "(none)"}`);
    if (existsSync(stampFile)) {
      const stamp = JSON.parse(readFileSync(stampFile, "utf8"));
      console.log(`taken:     ${stamp.takenAt}`);
    }
    if (existsSync(liveData)) console.log(`live data: ${(sizeOf(liveData) / 1e6).toFixed(1)} MB`);
    if (existsSync(snapData)) console.log(`snap data: ${(sizeOf(snapData) / 1e6).toFixed(1)} MB`);
    console.log((launcher("status").stdout ?? "").trim());
    break;
  }

  case "drop": {
    rmSync(snapDir, { recursive: true, force: true });
    console.log("[snapshot] dropped");
    break;
  }

  default:
    console.error("usage: node tools/world-snapshot.mjs take|restore|status|drop");
    process.exit(2);
}
