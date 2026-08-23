/**
 * THE BATTERY — every live suite, in the order that works, each captured to a file.
 *
 *   node tools/battery.mjs                    the whole battery
 *   node tools/battery.mjs --from smoke-saves resume after a failure, in order
 *   node tools/battery.mjs smoke-hold smoke-saves   just these, still in the canonical order
 *   node tools/battery.mjs --snapshot         roll the world back afterwards (see below)
 *   node tools/battery.mjs --list             the order, without running anything
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
 *    re-learned by two sessions. They are the array below now. ⚠ The two TWO-CLIENT entries need
 *    the player test account to be free; they connect a second client themselves, which is not a
 *    lock violation (one suite, two clients) but does mean no human should be logged in as it.
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
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;

/**
 * The canonical order. ⚠ `smoke-battleflow` then `smoke-hold` are ADJACENT ON PURPOSE and
 * nothing may be inserted between them. `reset` is not a suite — it is the fixture sweep that
 * `smoke-effects` needs, and it asserts nothing.
 */
const ORDER = [
  { name: "smoke-battleflow", note: "the Phase 1 chain + the player-damage offer (§5d)" },
  { name: "smoke-hold", note: "⚠ MUST follow smoke-battleflow immediately — it rides its tokens" },
  { name: "smoke-saves", note: "the save machine + the save-path damage offer (§18)" },
  { name: "smoke-volleys", note: "" },
  { name: "smoke-maneuvers", note: "the slowest — nine fold groups" },
  { name: "smoke-cast", note: "" },
  { name: "smoke-riders", note: "" },
  { name: "smoke-concentration", note: "" },
  { name: "smoke-twoclient", note: "⚠ TWO clients — the relay's relayed half and D2's popup close" },
  { name: "check-popup-routing", note: "two clients, read-only — popups route to whoever decides" },
  { name: "reset-fixture-state", note: "not a suite — the sweep smoke-effects needs", reset: true },
  { name: "smoke-effects", note: "⚠ re-run before diagnosing: the documented dice-variance class" },
  { name: "smoke-resources", note: "" }
];

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    from: { type: "string" },
    snapshot: { type: "boolean" },
    list: { type: "boolean" },
    section: { type: "string" }
  },
  allowPositionals: true,
  strict: false
});

if (values.list) {
  console.log("The battery, in order:");
  for (const s of ORDER) console.log(`  ${s.name.padEnd(22)}${s.note}`);
  process.exit(0);
}

let plan = ORDER;
if (positionals.length) {
  const asked = new Set(positionals);
  const unknown = [...asked].filter(a => !ORDER.some(s => s.name === a));
  if (unknown.length) {
    console.error(`no such suite: ${unknown.join(", ")}. Try --list.`);
    process.exit(2);
  }
  plan = ORDER.filter(s => asked.has(s.name));
  // ⚠ The adjacency rule survives a subset: asking for smoke-hold without smoke-battleflow is
  // asking for a run that refuses at the door, so say so rather than let it fail obscurely.
  if (asked.has("smoke-hold") && !asked.has("smoke-battleflow")) {
    console.error("smoke-hold rides smoke-battleflow's fixtures — ask for both, in that order.");
    process.exit(2);
  }
  // ⚠ `--section` is per-SUITE vocabulary — smoke-hold's "4d3" means nothing to smoke-volleys —
  // so it is only accepted alongside exactly one named suite. Passing it to a whole battery
  // would silently skip almost everything and still print a green summary.
} else if (values.from) {
  const at = ORDER.findIndex(s => s.name === values.from);
  if (at < 0) { console.error(`--from: no such suite "${values.from}". Try --list.`); process.exit(2); }
  plan = ORDER.slice(at);
}

// The run directory is named by the caller, not by a clock — a battery is something you come
// back to, and "the newest one" is a worse handle than a name you chose.
if (values.section && (positionals.length !== 1)) {
  console.error("--section names sections of ONE suite; pass exactly one suite name with it.");
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = join(REPO, "dist", "battery", stamp);
mkdirSync(runDir, { recursive: true });
console.log(`[battery] output -> ${runDir}\n`);

const run = (script, args = []) => {
  const r = spawnSync(node, [join(REPO, "tools", `${script}.mjs`), ...args], {
    cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  const body = `${r.stdout ?? ""}${r.stderr ?? ""}`;
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
  const { code, body } = run(suite.name, values.section ? ["--section", values.section] : []);
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
