// Battle Flow — the battery's progress bar: where the newest run stands, unix style, with the key stats.
//
//   node tools/battery-status.mjs            the newest run under dist/battery
//   node tools/battery-status.mjs <runDir>   a named run
//   node tools/battery-status.mjs --watch 60  redraw in place every 60 s until the run is done
//   node tools/battery-status.mjs --watch 60 --follow   ...and keep going across runs (Ctrl-C to stop)
//
// Reads nothing live: the battery writes one <suite>.txt per FINISHED entry into its run directory
// (tools/battery.mjs), so a missing file is an entry still to come and the first missing one in the
// order is the one running now. The order is `battery.mjs --list`. Offline, no Foundry.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const BATTERY_DIR = join(REPO, "dist", "battery");

const args = process.argv.slice(2);
const w = args.indexOf("--watch");
const watchSecs = (w >= 0) ? Math.max(5, Number(args[w + 1]) || 60) : 0;
if ( w >= 0 ) args.splice(w, (Number(args[w + 1]) ? 2 : 1));
const follow = args.includes("--follow");
if ( follow ) args.splice(args.indexOf("--follow"), 1);
const named = args[0] ?? null;

const order = listOrder();
if ( !watchSecs ) {
  const r = draw(named ?? newestRun());
  process.exit(r.failed ? 1 : 0);
}
// --watch: redraw in place; follows the newest run, so it can be started before the battery is.
const tick = () => {
  process.stdout.write("\x1b[2J\x1b[H");
  const r = draw(named ?? newestRun());
  console.log(`\n(refreshing every ${watchSecs}s — ${new Date().toLocaleTimeString()} — Ctrl-C to stop)`);
  if ( r.finished && !follow ) process.exit(r.failed ? 1 : 0);
  setTimeout(tick, watchSecs * 1000);
};
tick();

/** Print the bar for one run; `{ finished, failed }`. */
function draw(runDir) {
if ( !runDir || !existsSync(runDir) ) { console.log("no battery run under dist/battery yet"); return { finished: false, failed: 0 }; }
const started = startOf(runDir);
const now = Date.now();
// The run's own plan (battery.mjs writes plan.json since 2026-10-07); an older run falls back to the full order.
const planFile = join(runDir, "plan.json");
const rows = existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf8"))
  : existsSync(join(runDir, "setup-fixtures.txt")) ? ["setup-fixtures", ...order] : order;
const entries = rows.map(name => {
  const file = join(runDir, `${name}.txt`);
  if ( !existsSync(file) ) return { name, state: "pending" };
  const body = readFileSync(file, "utf8");
  const verdict = verdictOf(body, /^(fixture-|reset-|setup-)/.test(name));
  return { name, state: verdict.ok ? "ok" : "failed", ...verdict, at: statSync(file).mtimeMs };
});
const done = entries.filter(e => e.state !== "pending");
const running = entries.find(e => e.state === "pending") ?? null;
const total = entries.length;
const failed = done.filter(e => e.state === "failed");
const checks = done.reduce((a, e) => ({ pass: a.pass + (e.pass ?? 0), all: a.all + (e.all ?? 0) }), { pass: 0, all: 0 });
const lastAt = done.length ? Math.max(...done.map(e => e.at)) : started;
const elapsedMs = (running ? now : lastAt) - started;
const perEntry = done.length ? elapsedMs / done.length : 0;
const etaMs = running ? Math.max(0, perEntry * (total - done.length)) : 0;
const runningFor = running ? now - lastAt : 0;

const width = 30;
const filled = Math.round(width * done.length / Math.max(1, total));
const bar = `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
const pct = Math.round(100 * done.length / Math.max(1, total));
const status = !running ? (failed.length ? "DONE — RED" : "DONE — GREEN") : `running ${running.name} (${mins(runningFor)})`;

console.log(`battery ${runDir.split(/[\\/]/).pop()}  [${bar}] ${String(done.length).padStart(2)}/${total} ${String(pct).padStart(3)}%  elapsed ${mins(elapsedMs)}${running ? `  eta ~${mins(etaMs)}` : ""}`);
console.log(`suites ok ${done.length - failed.length}  failed ${failed.length}${failed.length ? ` (${failed.map(e => `${e.name} ${e.summary}`).join("; ")})` : ""}  checks ${checks.pass}/${checks.all}  ${status}`);
if ( running ) {
  const left = entries.slice(entries.indexOf(running) + 1).filter(e => e.state === "pending").map(e => e.name);
  if ( left.length ) console.log(`next ${left.slice(0, 4).join(", ")}${left.length > 4 ? ` … +${left.length - 4}` : ""}`);
}
return { finished: !running, failed: failed.length };
}

function newestRun() {
  if ( !existsSync(BATTERY_DIR) ) return null;
  const dirs = readdirSync(BATTERY_DIR).filter(d => /^\d{4}-\d{2}-\d{2}T/.test(d) && statSync(join(BATTERY_DIR, d)).isDirectory()).sort();
  return dirs.length ? join(BATTERY_DIR, dirs.at(-1)) : null;
}

/** The battery's order, from its own --list (the same table it runs). */
function listOrder() {
  const out = execFileSync(process.execPath, [join(REPO, "tools", "battery.mjs"), "--list"], { encoding: "utf8" });
  return out.split(/\r?\n/).map(l => /^\s{2}(\S+)\s{2,}/.exec(l)?.[1]).filter(Boolean);
}

/** The run's start from its directory name (UTC, `2026-09-30T19-32-58`). */
function startOf(dir) {
  const m = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(dir);
  return m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : statSync(dir).birthtimeMs;
}

/** A suite's verdict off its output: `N/M passed`, `ALL PASS`, `N FAILURE(S)`, `swept` (a fixture step). */
function verdictOf(body, step = false) {
  const lines = body.split(/\r?\n/).reverse();
  const line = lines.find(l => /ALL PASS|FAILURE\(S\)|\d+\/\d+ passed|\d+\/\d+$|swept|FATAL/.test(l)) ?? "";
  const ratio = /(\d+)\/(\d+)/.exec(line);
  if ( ratio ) return { ok: ratio[1] === ratio[2] && !/FAIL/.test(line), pass: Number(ratio[1]), all: Number(ratio[2]), summary: `${ratio[1]}/${ratio[2]}` };
  if ( /ALL PASS/.test(line) ) { const n = (body.match(/^\s*PASS /gm) ?? []).length; return { ok: true, pass: n, all: n, summary: "ALL PASS" }; }
  if ( /swept/.test(line) && !/FAIL|FATAL/.test(line) ) return { ok: true, pass: 0, all: 0, summary: "swept" };
  const n = (body.match(/^\s*PASS /gm) ?? []).length, f = (body.match(/^\s*FAIL /gm) ?? []).length;
  // ⚠ No verdict line and no assertions is a crash (a setup error, a refused preflight), never a pass.
  // A seed or sweep step asserts nothing: only a crash marker fails it.
  const crashed = /FATAL|FAILED|PREFLIGHT|Error:/.test(body) || (!step && (n + f === 0));
  return { ok: !f && !crashed, pass: n, all: n + f, summary: /FATAL/.test(body) ? "FATAL" : (crashed && !f) ? "crashed" : `${n}/${n + f}` };
}

function mins(ms) {
  const m = Math.round(ms / 60000);
  return m < 1 ? `${Math.round(ms / 1000)}s` : `${m}m`;
}
