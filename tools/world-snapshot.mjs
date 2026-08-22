// THE DISPOSABLE TEST WORLD — snapshot the sandbox's databases, run a battery, roll it back.
//
// ⚠ WHY THIS EXISTS. Almost every piece of suite ceremony in NOTES.md §5 is there because the
// suites mutate a SHARED, LONG-LIVED world that also holds the user's real configuration:
//
//   - every teardown must restore settings FIRST, in its own guard, because a cleanup error
//     that skips the restore leaves residue on the live table;
//   - a CRASHED run launders its pins into the next run's "prior", so eleven settings can
//     drift with every suite reporting success;
//   - a fixture that plants a status must use canonical ids only, or it poisons later runs;
//   - suites must run ONE AT A TIME, because a late teardown sweep pollutes the next suite.
//
// None of that is a property of testing against a live world. It is a property of testing
// against a world you cannot throw away. Roll the databases back and every one of those
// hazards stops existing — the suites get SIMPLER, not just faster.
//
// The cost is small because the world's bulk is assets: this world is 468 MB, of which the
// LevelDB databases under worlds/<id>/data are 24 MB. Assets are never written by a suite, so
// only data/ is snapshotted.
//
//   node tools/world-snapshot.mjs take      # bounce down, copy data/ -> snapshot, bounce up
//   node tools/world-snapshot.mjs restore   # bounce down, copy snapshot -> data/, bounce up
//   node tools/world-snapshot.mjs status
//   node tools/world-snapshot.mjs drop      # delete the snapshot
//
// ⚠ THE WORLD MUST BE DOWN FOR BOTH DIRECTIONS. Foundry holds LevelDB open while a world is
// active; copying a live database yields a torn snapshot, and writing over one corrupts it.
// Both commands stop the world through the sibling repo's own launcher, which deactivates
// (db.disconnect + world.save — the flush that matters) before ending the process.
//
// ⚠ THE DATA DIRECTORY SHRINKS AFTER A RESTORE, AND THAT IS NOT DATA LOSS. LevelDB compacts
// on a clean open, so a snapshot taken from a running world (24.0 MB, uncompacted logs)
// restores and settles at 14.2 MB. Measured 2026-08-22 on the full take/restore proof: a
// canary chat message written after the snapshot was gone afterwards, and all 145 actors —
// every PC and every BF Test fixture — were present and correct. Verify a restore by
// CONTENT, never by directory size.
//
// LOCAL ONLY, ALWAYS. There is no prod path here and there must never be one.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MCP = "D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e";
const LAUNCHER = join(MCP, "scripts", "local-foundry.mjs");

const env = {};
for (const line of readFileSync(join(MCP, ".env"), "utf8").split(/\r?\n/)) {
  if (line.trimStart().startsWith("#")) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

const dataRoot = env.LOCAL_FOUNDRY_DATA;
const worldId = env.LOCAL_WORLD_ID || env.MOLTEN_WORLD_ID;
if (!dataRoot || !worldId) {
  console.error("[snapshot] LOCAL_FOUNDRY_DATA and a world id are required in the MCP repo's .env");
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
