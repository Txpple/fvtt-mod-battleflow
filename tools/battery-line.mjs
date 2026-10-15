// @ts-check
// THE BATTERY LINE — one battery run in one line, and the release's rule over a tag body (NOTES §5
// *Release*; tools/README.md *Release and deploy — the chain*).
//
//   Battery: 2026-10-15T13-55-32 — 45/45 suites, 1691/1691 checks, GREEN
//   Battery: none (pre-release)
//
// The first form is a run under dist/battery/: its directory name, the finished-green entries over
// the entries in its plan, the checks passed over the checks run, and GREEN, RED (a finished entry
// failed) or PARTIAL (an entry has no output: still running, or the run stopped). An ASCII `-` in
// place of the dash is the same line. The second form is a release with no run behind it, which the
// release workflow publishes as a GitHub pre-release.
//
// One reading of a run directory for everything that reports on one: `readRun` is what
// battery-status.mjs draws its bar from and prints `--line` from, and what build-release.mjs checks
// a tag's line against; `checkTagBody` is the release rule itself (tests/battery-line.test.js).
// Offline, no Foundry.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where battery.mjs writes its runs, one directory per run. */
export const BATTERY_DIR = join(REPO, "dist", "battery");

/** A run directory's name: battery.mjs stamps the run's start in UTC, `:` and `.` written as `-`. */
export const RUN_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

/** The line of a release with no battery run behind it. */
export const NONE_LINE = "Battery: none (pre-release)";

/** The two lines a release tag's body may carry, as every refusal quotes them. */
export const FORMS = ["Battery: <run id> — <n>/<n> suites, <n>/<n> checks, GREEN", NONE_LINE];

/** The run form; group 2 is the dash, which may be typed as an ASCII hyphen. */
const RUN_LINE = /^Battery: (\S+) (—|-) (\d+)\/(\d+) suites, (\d+)\/(\d+) checks, (GREEN|RED|PARTIAL)$/;

/** A body line that means to be a battery line: `Battery:` at its start, whatever decorates it. */
const CANDIDATE = /^[\s>*_-]*battery\s*:/i;

/**
 * @typedef {{ name: string, state: "pending"|"ok"|"failed", ok?: boolean, pass?: number,
 *   all?: number, summary?: string, at?: number }} Entry
 * @typedef {{ id: string, entries: Entry[], done: Entry[], failed: Entry[], running: Entry|null,
 *   total: number, green: number, checks: { pass: number, all: number },
 *   verdict: "GREEN"|"RED"|"PARTIAL" }} Run
 * @typedef {{ id: string, green: number, total: number, pass: number, all: number,
 *   verdict: "GREEN"|"RED"|"PARTIAL" }} RunLine
 */

/**
 * One run directory read. Each row of the run's plan is an entry, finished once its `<row>.txt`
 * exists (battery.mjs writes the file as the row ends), green or red by the verdict in that file.
 * A run without a plan.json falls back to the battery's full order, `orderOf()`.
 * A finished red entry makes the run RED; else an entry with no file makes it PARTIAL.
 * @param {string} runDir
 * @param {() => string[]} [orderOf]
 * @returns {Run}
 */
export function readRun(runDir, orderOf = listOrder) {
  const planFile = join(runDir, "plan.json");
  /** @type {string[]} */
  const rows = existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf8"))
    : existsSync(join(runDir, "setup-fixtures.txt")) ? ["setup-fixtures", ...orderOf()] : orderOf();
  /** @type {Entry[]} */
  const entries = rows.map(name => {
    const file = join(runDir, `${name}.txt`);
    if ( !existsSync(file) ) return { name, state: "pending" };
    const body = readFileSync(file, "utf8");
    const verdict = verdictOf(body, /^(fixture-|reset-|setup-)/.test(name));
    return { name, state: verdict.ok ? "ok" : "failed", ...verdict, at: statSync(file).mtimeMs };
  });
  const done = entries.filter(e => e.state !== "pending");
  const failed = done.filter(e => e.state === "failed");
  const running = entries.find(e => e.state === "pending") ?? null;
  const checks = done.reduce((a, e) => ({ pass: a.pass + (e.pass ?? 0), all: a.all + (e.all ?? 0) }), { pass: 0, all: 0 });
  const verdict = failed.length ? "RED" : running ? "PARTIAL" : "GREEN";
  return { id: basename(runDir), entries, done, failed, running, total: entries.length,
    green: done.length - failed.length, checks, verdict };
}

/**
 * The run in one line, the first of FORMS.
 * @param {Run} run
 */
export function lineOf(run) {
  return `Battery: ${run.id} — ${run.green}/${run.total} suites, ${run.checks.pass}/${run.checks.all} checks, ${run.verdict}`;
}

/**
 * One line read as a battery line: `{ none: true }`, `{ run }` for the run form, or `{ why }` when
 * it is neither. A GREEN line is whole (every suite, every check, at least one check); a RED or
 * PARTIAL line is short of whole.
 * @param {string} text
 * @returns {{ none: true } | { run: RunLine } | { why: string }}
 */
export function parseLine(text) {
  const line = text.trim();
  if ( line === NONE_LINE ) return { none: true };
  const m = RUN_LINE.exec(line);
  if ( !m ) return { why: "it is in neither form" };
  const id = m[1] ?? "";
  const [green = 0, total = 0, pass = 0, all = 0] = [m[3], m[4], m[5], m[6]].map(Number);
  const verdict = /** @type {RunLine["verdict"]} */ (m[7]);
  if ( !RUN_ID.test(id) ) return { why: `"${id}" is not a run id (a dist/battery directory name, e.g. 2026-10-15T13-55-32)` };
  if ( !total ) return { why: "a run of no suites proves nothing" };
  if ( (green > total) || (pass > all) ) return { why: "it counts more passed than run" };
  const whole = (green === total) && (pass === all) && (all > 0);
  if ( (verdict === "GREEN") && !whole ) return { why: "a GREEN line counts every suite and every check green" };
  if ( (verdict !== "GREEN") && (green === total) ) return { why: `a ${verdict} line counts a suite short of green` };
  return { run: { id, green, total, pass, all, verdict } };
}

/**
 * The release rule over an annotated tag's body. It carries exactly one battery line, in one of
 * FORMS; a run's line is GREEN; and when `runOf(id)` finds the run on this machine, the run's own
 * reading agrees with the line. Without the run here (CI has no dist/battery/) the form alone is
 * checked, and `note` says so.
 * @param {string} body
 * @param {{ runOf?: (id: string) => Run | null }} [opts]
 * @returns {{ ok: true, prerelease: boolean, line: string, note: string } | { ok: false, error: string }}
 */
export function checkTagBody(body, { runOf } = {}) {
  const [runForm, noneForm] = FORMS;
  const forms = "a release tag's body carries exactly one of:\n"
    + `  ${runForm}   (the line \`node tools/battery-status.mjs --line\` prints)\n`
    + `  ${noneForm}   (no run: published as a pre-release, never the latest release)`;
  const refuse = (/** @type {string} */ why) => ({ ok: /** @type {const} */ (false), error: `${why}\n${forms}` });
  const lines = String(body ?? "").split(/\r?\n/).map(l => l.trim()).filter(l => CANDIDATE.test(l));
  if ( !lines.length ) return refuse("the tag's body has no Battery line;");
  if ( lines.length > 1 ) return refuse(`the tag's body has ${lines.length} Battery lines (${lines.map(l => `"${l}"`).join(", ")});`);
  const line = /** @type {string} */ (lines[0]);
  const read = parseLine(line);
  if ( "why" in read ) return refuse(`"${line}" is not a Battery line: ${read.why};`);
  if ( "none" in read ) {
    return { ok: true, prerelease: true, line,
      note: "no battery run: published as a pre-release, never the latest release" };
  }
  const { run } = read;
  if ( run.verdict !== "GREEN" ) return refuse(`"${line}" names a ${run.verdict} run, and only a GREEN run releases;`);
  const here = runOf ? runOf(run.id) : null;
  if ( !here ) {
    return { ok: true, prerelease: false, line,
      note: `run ${run.id} is not under dist/battery/ on this machine, so the form alone is checked (CI never has the run)` };
  }
  const own = lineOf(here);
  const agrees = (here.green === run.green) && (here.total === run.total) && (here.checks.pass === run.pass)
    && (here.checks.all === run.all) && (here.verdict === run.verdict);
  if ( !agrees ) return refuse(`"${line}" disagrees with the run on this machine, which reads "${own}";`);
  return { ok: true, prerelease: false, line, note: `run ${run.id} is on this machine and reads the same` };
}

/** The battery's order from its own `--list`, the table it runs; read once. */
let order = /** @type {string[]|null} */ (null);
function listOrder() {
  order ??= execFileSync(process.execPath, [join(REPO, "tools", "battery.mjs"), "--list"], { encoding: "utf8" })
    .split(/\r?\n/).map(l => /^\s{2}(\S+)\s{2,}/.exec(l)?.[1]).filter(n => n !== undefined);
  return order;
}

/**
 * A suite's verdict off its output: `N/M passed`, `ALL PASS`, `N FAILURE(S)`, `swept` (a fixture step).
 * @param {string} body
 * @param {boolean} [step] a seed or sweep, which asserts nothing
 * @returns {{ ok: boolean, pass: number, all: number, summary: string }}
 */
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
