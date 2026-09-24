/**
 * THE BATTERY — every live suite, in the order that works, each captured to a file.
 *
 *   node tools/battery.mjs                    the whole battery
 *   node tools/battery.mjs --from smoke-saves resume after a failure, in order
 *   node tools/battery.mjs smoke-hold smoke-saves   just these, still in the canonical order
 *   node tools/battery.mjs --snapshot         roll the world back afterwards (see below)
 *   node tools/battery.mjs --list             the order, without running anything
 *   node tools/battery.mjs --changed          what the working tree's change needs, and only that
 *   node tools/battery.mjs --changed main     ...the branch since main, plus the working tree
 *   node tools/battery.mjs --files scripts/emanations.js --list   the plan for a list by hand
 *
 * ⚠ `--changed` IS CHANGE-SCOPED, NOT A SHORTCUT (user ruling 2026-09-23). Each suite declares
 * the machines it drives (`COVERS`), the verify gate checks the claims both ways, and the plan
 * says per suite which changed file claimed it. A SPINE change (core, spine, services, entry —
 * tools/check-layers.mjs's tiers) is the full battery, honestly, and the plan says that too.
 *
 * ⚠ THIS EXISTS TO MAKE THREE HANDOFF RULES STRUCTURAL RATHER THAN REMEMBERED.
 *
 * 1. **Always redirect a suite to a file.** `smoke-battleflow` has twice reported exactly
 *    "2 FAILURE(S)" and BOTH times the assertions were lost to a `| tail` — a suite prints its
 *    failures in the BODY and its count in the summary, so a tail throws away the only evidence
 *    that matters and the class stays unnamed for another session. Here every suite's full
 *    output lands in a run directory before anything is summarised. It cannot be skipped.
 * 2. **The order is not arbitrary.** `smoke-hold` refuses unless `smoke-battleflow` ran
 *    immediately before it — anything in between strips the fixture tokens it rides — and
 *    `reset-fixture-state` must run before `smoke-effects`. Both facts lived in prose and were
 *    re-learned by two sessions. They are ORDER's `needs` now (tools/coverage-map.mjs), and any
 *    subset — a positional, `--from`, `--changed` — pulls what it needs and says so. ⚠ The two
 *    TWO-CLIENT entries need the player test account to be free; they connect a second client
 *    themselves, which is not a lock violation (one suite, two clients) but does mean no human
 *    should be logged in as it.
 * 3. **Settings are verified after, not assumed.** A crashed run launders its pins into the
 *    next run's "prior", so eleven settings can drift while every suite reports success. Only
 *    the external reference table catches it, so the battery ends by running it.
 *
 * ⚠ `--snapshot` IS THE CURE FOR THE LAUNDERING, NOT A CONVENIENCE. It takes a world snapshot
 * before the first suite and rolls it back after the last, so whatever the battery did — including
 * a crash mid-teardown — is undone by construction. It costs two world bounces (~30s each) and
 * REQUIRES the local sandbox with no clients connected. Deliberately opt-in: rolling the world
 * back also discards anything you did at the table while it ran.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ORDER, planFor, rowsFor, rowsFrom } from "./coverage-map.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;

// ⚠ THE ORDER LIVES IN tools/coverage-map.mjs NOW (2026-09-23), comments and all — it is the
// record of why each row sits where it does, and the change selector reads it too. This file
// imports it; nothing here may re-declare it.

/**
 * `--changed [base]` and `--files a b c` take a variable tail that parseArgs cannot express
 * (an optional value; a list), so they are lifted off argv first and the rest is parsed as before.
 */
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
 * The files a `--changed` run is about. With no base: the working tree against HEAD, the index,
 * and the untracked files (a new suite or machine is a change too). With a base: everything the
 * branch changed since it left the base (`base...HEAD`), plus the same working-tree set.
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
  // ⚠ Needs are pulled, not refused (2026-09-23): asking for smoke-hold runs smoke-battleflow
  // immediately before it, and the plan says so. The adjacency rule survives a subset because
  // a need is the nearest row above, and nothing stands between those two in ORDER.
  const unknown = positionals.filter(a => !ORDER.some(s => s.name === a));
  if (unknown.length) {
    console.error(`no such suite: ${unknown.join(", ")}. Try --list.`);
    process.exit(2);
  }
  plan = rowsFor(positionals);
  for (const r of plan) if (r.why[0] !== "asked for") console.log(`[battery] ${r.name}: ${r.why.join("; ")}`);
  // ⚠ `--section` is per-SUITE vocabulary — smoke-hold's "4d3" means nothing to smoke-volleys —
  // so it is only accepted alongside exactly one named suite, and only THAT suite receives it: a
  // need pulled in front of it runs whole. Passing it to a whole battery would silently skip
  // almost everything and still print a green summary.
} else if (values.from) {
  const at = ORDER.findIndex(s => s.name === values.from);
  if (at < 0) { console.error(`--from: no such suite "${values.from}". Try --list.`); process.exit(2); }
  // A resume pulls what its rows need from above the cut — `--from smoke-hold` re-runs
  // smoke-battleflow first, rather than starting a suite that refuses at its own door.
  plan = rowsFrom(at);
  for (const r of plan) if (r.at < at) console.log(`[battery] ${r.name}: ${r.why.join("; ")}`);
} else {
  plan = ORDER;
}

if (values.list) {
  printPlan(plan, "The plan, in order:");
  process.exit(0);
}

// The run directory is named by the caller, not by a clock — a battery is something you come
// back to, and "the newest one" is a worse handle than a name you chose.
if (values.section && (positionals.length !== 1)) {
  console.error("--section names sections of ONE suite; pass exactly one suite name with it.");
  process.exit(2);
}
const sectionFor = values.section ? positionals[0] : null;

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = join(REPO, "dist", "battery", stamp);
mkdirSync(runDir, { recursive: true });
console.log(`[battery] output -> ${runDir}\n`);

// ⚠ THE HOOK LEDGERS ARE CLEARED FIRST, and that is not tidiness. Each suite drops one on
// disconnect and `hook-coverage.mjs` unions whatever it finds, so a leftover ledger from a
// PREVIOUS battery would report a hook as exercised by a run that never touched it — a coverage
// report that lies in the reassuring direction, which is the only direction that matters.
rmSync(join(REPO, "dist", "hook-ledger"), { recursive: true, force: true });

const run = (script, args = []) => {
  const r = spawnSync(node, [join(REPO, "tools", `${script}.mjs`), ...args], {
    cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  // ⚠ stdout and stderr are captured separately and CANNOT be interleaved without a pty, so the
  // file says so rather than pretending the order is chronological. The connection banners live
  // on stderr, which is why a naive concatenation looks like the suite reconnected at the end.
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
  // ⚠ Failures print HERE, in full, as well as landing in the file — the whole point of rule 1
  // is that the evidence must not need a second command to find.
  if (bad) {
    console.log(`\n──────── ${suite.name} — the failing lines ────────`);
    for (const l of body.split("\n")) if (/FAIL|FATAL|ERROR/.test(l)) console.log(l);
    console.log(`──────── full output: ${join(runDir, `${suite.name}.txt`)}\n`);
  }
}

// ⚠ COVERAGE IS PRINTED, NEVER ENFORCED (ARCHITECTURE §10 D11). It runs BEFORE the settings
// check so that a drifted-settings exit still leaves the coverage on screen — the one number
// here that says anything about BEHAVIOUR should not be the one a failure scrolls away.
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
