/**
 * THE BATTERY — every live suite, in the order that works, each captured to a file.
 *
 *   node tools/battery.mjs                    the whole battery
 *   node tools/battery.mjs --from smoke-saves resume after a failure, in order
 *   node tools/battery.mjs smoke-hold smoke-saves   just these, still in the canonical order
 *   node tools/battery.mjs --snapshot         roll the world back afterwards (see below)
 *   node tools/battery.mjs --keep             leave the fixtures in the world afterwards
 *   node tools/battery.mjs --list             the order, without running anything
 *   node tools/battery.mjs --changed          what the working tree's change needs, and only that
 *   node tools/battery.mjs --changed main     ...the branch since main, plus the working tree
 *   node tools/battery.mjs --files scripts/emanations.js --list   the plan for a list by hand
 *
 * `--changed` is change-scoped: each suite's `COVERS` names its machines and the plan says which
 * changed file claimed each suite; a SPINE change (tools/check-layers.mjs's tiers) is the full battery.
 *
 * 1. Every suite's full output lands in a run directory: failures print in the BODY, so a
 *    `| tail` would throw the evidence away.
 * 2. The order matters: ORDER's `needs` (tools/coverage-map.mjs) are pulled into any subset.
 *    ⚠ The two-client entries need the player test account free (no human logged in as it).
 * 3. Settings are VERIFIED after (the reference table): a crashed run launders its pins into
 *    the next run's "prior".
 * 4. SELF-CONTAINED (2026-10-07): every plan opens with `fixture-suite` (every fixture built from the
 *    compendia; a failed build stops the run) and closes with `teardown-fixtures` (unless --keep), so
 *    the sandbox world can be any world, a fresh copy of prod included, and is left as it was found.
 * ⚠ `--snapshot` rolls the world back after the last suite, undoing even a crashed teardown. It
 * needs the local sandbox with no clients, costs two world bounces, and discards table changes.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ORDER, planFor, rowsFor, rowsFrom } from "./coverage-map.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;

// ⚠ The ORDER lives in tools/coverage-map.mjs (with why each row sits where it does); never re-declare it here.

/** Lift `--changed [base]` and `--files a b c` off argv: parseArgs cannot express their tails. */
function liftTail(argv) {
  const rest = [];
  let changed = null;
  let files = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--changed") {
      changed = { base: null };
      if ((i + 1 < argv.length) && !argv[i + 1].startsWith("-")) changed.base = argv[++i];
    } else if (a === "--files") {
      files = [];
      while ((i + 1 < argv.length) && !argv[i + 1].startsWith("--")) files.push(argv[++i]);
    } else rest.push(a);
  }
  return { rest, changed, files };
}

/** One git query's file list; a failed query is an instrument failure, never "nothing changed". */
function git(args) {
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`[battery] git ${args.join(" ")} failed — ${(r.stderr ?? "").trim()}`);
    process.exit(2);
  }
  return r.stdout.split("\n").map(l => l.trim()).filter(Boolean);
}

/**
 * The files a `--changed` run is about: the working tree, index and untracked files against HEAD;
 * with a base, also `base...HEAD`.
 */
function changedFiles(base) {
  const tree = [
    ...git(["diff", "--name-only", "HEAD"]),
    ...git(["diff", "--name-only", "--cached"]),
    ...git(["ls-files", "--others", "--exclude-standard"])
  ];
  const branch = base ? git(["diff", "--name-only", `${base}...HEAD`]) : [];
  return [...new Set([...branch, ...tree])].sort();
}

const lifted = liftTail(process.argv.slice(2));
const { values, positionals } = parseArgs({
  args: lifted.rest,
  options: {
    from: { type: "string" },
    snapshot: { type: "boolean" },
    keep: { type: "boolean" },
    list: { type: "boolean" },
    section: { type: "string" }
  },
  allowPositionals: true,
  strict: false
});

const byChange = lifted.changed || lifted.files;
if (byChange && (positionals.length || values.from || values.section)) {
  console.error("--changed / --files choose the suites themselves; drop the suite names, --from and --section.");
  process.exit(2);
}
if (lifted.changed && lifted.files) {
  console.error("--changed reads git and --files is the list by hand — pass one of them.");
  process.exit(2);
}

/** Print a plan: the rows and why each runs. */
const printPlan = (rows, heading) => {
  console.log(heading);
  const w = Math.max(0, ...rows.map(r => r.name.length));
  for (const r of rows) {
    const why = r.why?.length ? r.why.join("; ") : r.note;
    console.log(`  ${r.name.padEnd(w)}  ${r.reset ? "(seed) " : ""}${why}`);
  }
};

if (values.list && !byChange && !positionals.length && !values.from) {
  console.log("The battery, in order:");
  for (const s of ORDER) {
    const needs = s.needs?.length ? `  [needs ${s.needs.join(", ")}]` : "";
    console.log(`  ${s.name.padEnd(22)}${s.note}${needs}`);
  }
  process.exit(0);
}

let plan;
if (byChange) {
  const files = lifted.files ?? changedFiles(lifted.changed.base);
  let p;
  try {
    p = planFor(files);
  } catch (err) {
    console.error(`[battery] the coverage map could not be read — ${err.message}`);
    process.exit(2);
  }
  const what = lifted.files ? "--files" : `--changed ${lifted.changed.base ? `${lifted.changed.base}...HEAD + ` : ""}the working tree`;
  console.log(`[battery] ${what}: ${files.length} file(s)`);
  for (const f of p.inert) console.log(`  · ${f.file} — ${f.why}`);
  if (p.full.length) {
    console.log("[battery] THE FULL BATTERY, because:");
    for (const why of p.full) console.log(`  ⚠ ${why}`);
  }
  if (!p.rows.length) {
    console.log("[battery] nothing live to run — no change reaches a machine a suite claims.");
    process.exit(0);
  }
  plan = p.rows;
  if (values.list) {
    printPlan(plan, `\nThe plan — ${plan.length} of ${ORDER.length} rows, in order:`);
    process.exit(0);
  }
  console.log("");
} else if (positionals.length) {
  // Needs are pulled, not refused: smoke-hold runs smoke-battleflow immediately before it.
  const unknown = positionals.filter(a => !ORDER.some(s => s.name === a));
  if (unknown.length) {
    console.error(`no such suite: ${unknown.join(", ")}. Try --list.`);
    process.exit(2);
  }
  plan = rowsFor(positionals);
  for (const r of plan) if (r.why[0] !== "asked for") console.log(`[battery] ${r.name}: ${r.why.join("; ")}`);
  // ⚠ `--section` is per-SUITE vocabulary: only with exactly one named suite, and its pulled needs run whole.
} else if (values.from) {
  const at = ORDER.findIndex(s => s.name === values.from);
  if (at < 0) { console.error(`--from: no such suite "${values.from}". Try --list.`); process.exit(2); }
  // A resume pulls what its rows need from above the cut.
  plan = rowsFrom(at);
  for (const r of plan) if (r.at < at) console.log(`[battery] ${r.name}: ${r.why.join("; ")}`);
} else {
  plan = ORDER;
}

// The setup row: every fixture built from the compendia before anything runs, whatever the plan.
const SETUP = { name: "fixture-suite", note: "setup — every fixture built from the compendia", reset: true, setup: true };
if (plan[0]?.name !== "fixture-suite") plan = [SETUP, ...plan];
else plan = [{ ...plan[0], setup: true }, ...plan.slice(1)];

if (values.list) {
  printPlan(plan, "The plan, in order:");
  process.exit(0);
}

// The run directory is named by the caller, not by a clock.
if (values.section && (positionals.length !== 1)) {
  console.error("--section names sections of ONE suite; pass exactly one suite name with it.");
  process.exit(2);
}
const sectionFor = values.section ? positionals[0] : null;

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = join(REPO, "dist", "battery", stamp);
mkdirSync(runDir, { recursive: true });
console.log(`[battery] output -> ${runDir}\n`);

// ⚠ Clear the hook ledgers first: hook-coverage.mjs unions whatever it finds, and a previous
// battery's ledger would report coverage this run never had.
rmSync(join(REPO, "dist", "hook-ledger"), { recursive: true, force: true });

const run = (script, args = []) => {
  const r = spawnSync(node, [join(REPO, "tools", `${script}.mjs`), ...args], {
    cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  // stdout and stderr are captured separately (no pty), so the file does not claim chronological order.
  const err = (r.stderr ?? "").trim();
  const SEP = "\n──────── stderr (not interleaved) ────────\n";
  const body = err ? `${r.stdout ?? ""}${SEP}${err}\n` : (r.stdout ?? "");
  writeFileSync(join(runDir, `${script}.txt`), body);
  return { code: r.status ?? -1, body };
};

if (values.snapshot) {
  console.log("[battery] taking a world snapshot (two bounces, ~1 minute)…");
  const r = spawnSync(node, [join(REPO, "tools", "world-snapshot.mjs"), "take"],
    { cwd: REPO, encoding: "utf8", stdio: "inherit" });
  if (r.status !== 0) {
    console.error("[battery] snapshot failed — refusing to run, because --snapshot promised a rollback.");
    process.exit(2);
  }
}

/** The last line a suite prints is its verdict; every suite spells it one of three ways. */
const verdictOf = body => {
  const line = body.trimEnd().split("\n").reverse()
    .find(l => /ALL PASS|FAILURE\(S\)|\d+\/\d+ passed|\d+\/\d+$/.test(l));
  return line ? line.trim() : "(no summary line — read the file)";
};

const results = [];
let failed = 0;
for (const suite of plan) {
  process.stdout.write(`[battery] ${suite.name}… `);
  const t0 = Date.now();
  const { code, body } = run(suite.name, (suite.name === sectionFor) ? ["--section", values.section] : []);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const verdict = suite.reset ? "swept" : verdictOf(body);
  const bad = !suite.reset && (code !== 0);
  if (bad) failed++;
  results.push({ name: suite.name, code, secs, verdict, bad });
  console.log(`${bad ? "FAILED" : "ok"} (${secs}s) — ${verdict}`);
  if (suite.setup && (code !== 0)) {
    console.log(`\n[battery] the fixture build failed — nothing can run. See ${join(runDir, `${suite.name}.txt`)}`);
    for (const l of body.split("\n")) if (/FAIL|FATAL|ERROR|⚠/.test(l)) console.log(l);
    process.exit(2);
  }
  // Failures print here in full, as well as landing in the file.
  if (bad) {
    console.log(`\n──────── ${suite.name} — the failing lines ────────`);
    for (const l of body.split("\n")) if (/FAIL|FATAL|ERROR/.test(l)) console.log(l);
    console.log(`──────── full output: ${join(runDir, `${suite.name}.txt`)}\n`);
  }
}

// Coverage is printed, never enforced (ARCHITECTURE §10 D11), and before the settings check so a
// drifted-settings exit still leaves it on screen.
console.log("\n[battery] hook coverage — which registrations actually fired…");
const coverage = run("hook-coverage");
if (coverage.code !== 0) {
  console.log("  ⚠ NOT MEASURED — the ledgers are missing or unreadable. That is an instrument "
    + "failure, not a clean result; do not read it as 'everything fired'.");
} else {
  const lines = coverage.body.split("\n");
  const from = lines.findIndex(l => l.includes("NEVER FIRED"));
  if (from >= 0) for (const l of lines.slice(from)) console.log(l.trimEnd());
  else console.log(`  ${lines.find(l => l.startsWith("REPORT")) ?? ""}`);
}

console.log("\n[battery] the settings reference table…");
const settings = run("verify-settings");
const clean = settings.code === 0;
console.log(clean ? "  CLEAN" : `  ⚠ DRIFTED — see ${join(runDir, "verify-settings.txt")}, `
  + "then `node tools/verify-settings.mjs --fix`");

if (values.keep) console.log("\n[battery] --keep: the fixtures stay in the world");
else {
  console.log("\n[battery] tearing the fixtures down…");
  const down = run("teardown-fixtures");
  console.log(`  ${down.body.split("\n").find(l => l.startsWith("[teardown-fixtures]")) ?? `⚠ exit ${down.code} — see the file`}`);
}

if (values.snapshot) {
  console.log("\n[battery] rolling the world back to the snapshot…");
  spawnSync(node, [join(REPO, "tools", "world-snapshot.mjs"), "restore"],
    { cwd: REPO, encoding: "utf8", stdio: "inherit" });
}

console.log("\n──────── BATTERY ────────");
const w = Math.max(...results.map(r => r.name.length));
for (const r of results) {
  console.log(`  ${r.bad ? "FAIL" : "pass"}  ${r.name.padEnd(w)}  ${String(r.secs).padStart(4)}s  ${r.verdict}`);
}
const total = results.reduce((n, r) => n + Number(r.secs), 0);
console.log(`  ${failed ? `${failed} SUITE(S) FAILED` : "every suite green"}`
  + ` · settings ${clean ? "clean" : "DRIFTED"} · ${Math.round(total / 60)}m ${total % 60}s`);
console.log(`  output: ${runDir}`);
process.exit((failed || !clean) ? 1 : 0);
