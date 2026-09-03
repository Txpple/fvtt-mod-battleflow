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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  // ⚠ Immediately after smoke-maneuvers because it is the same family (post-roll folds), and
  // its section 2 SPENDS the fixtures it asserts on — it re-seeds nothing, so anything that
  // wanted a Fighter with two Second Wind uses must run before it or re-run the fixture script.
  //
  // ⚠ WHICH IS WHY THE SEED IS A BATTERY STEP NOW (2026-08-23). It was prose in the note below
  // and the battery did not act on it, so a battery run inherited whatever the LAST run left:
  // `heroic` alone would be offered, section 5's "every eligible fold is offered" would go red,
  // and the summary would report a FAILED suite for an empty resource pool. Measured this way
  // once — 20/21, and 21/21 on the same code the moment the fixture was re-seeded, with the
  // assertion flipping from `offers=[heroic]` to `offers=[heroic, tactical]` and Second Wind
  // reading `2 → 1` instead of `1 → 0`. **A front door that reports a red for a missing seed
  // is a broken gauge**, and the diagnosis cost a full battery to reach.
  { name: "fixture-d20-folds", note: "not a suite — the seed smoke-d20-folds spends", reset: true },
  { name: "smoke-d20-folds", note: "the three d20 folds — its own seed runs immediately above" },
  { name: "smoke-cast", note: "" },
  { name: "smoke-riders", note: "" },
  { name: "smoke-concentration", note: "" },
  { name: "smoke-twoclient", note: "⚠ TWO clients — the relay's relayed half and D2's popup close" },
  { name: "check-popup-routing", note: "two clients, read-only — popups route to whoever decides" },
  { name: "reset-fixture-state", note: "not a suite — the sweep smoke-effects needs", reset: true },
  { name: "smoke-effects", note: "⚠ re-run before diagnosing: the documented dice-variance class" },
  // ⚠ Directly after smoke-effects — the same family (the mastery chips), and the one suite that
  // steps a real Combat through rounds to watch Foundry's own clock expire them (2026-09-01).
  { name: "smoke-expiry", note: "the platform's clock on the chips, the spend, the cleave chit" },
  { name: "smoke-reminders", note: "the gate before the roll — every source, the net, the press" },
  { name: "smoke-sneak", note: "Sneak Attack as drawn — the tick, the menu, the dice, the crit, the chit, the effects" },
  { name: "smoke-clock", note: "the clock riders — Dreadful Strike once per turn with its uses, Assassinate on round one, the list as the switch" },
  // ⚠ Before smoke-surfaces for the same reason smoke-surfaces is last: it places a real template
  // (Spirit Guardians) and creates Regions on the range, all deleted in its `finally` (2026-09-03).
  { name: "smoke-emanations", note: "the emanations — the Paladin's aura stands with its token, applies to allies inside, lifts on exit; Spirit Guardians adopted, its saves on enter and turn end" },
  { name: "smoke-resources", note: "" },
  // ⚠ LAST, and it is the only entry whose position is about what it CREATES rather than what
  // it needs. It places a real MeasuredTemplate on the active scene, and a template standing
  // while smoke-saves is mid-run would join its containment arithmetic (§8 re-derives target
  // sets from whatever areas exist). It deletes its own in a `finally`; running it last means
  // a crash between the two cannot reach a suite that would care.
  { name: "smoke-surfaces", note: "the three surfaces nothing else opens — settings, usage dialog, templates" },
  // ⚠ LAST, AFTER smoke-surfaces, and for a reason no other entry has: it is the one suite that
  // must find NO ACTIVE GM. It opens no GM session of its own until its rejoin section, and it
  // REFUSES to run if it sees one — a stray GM silently turns it into a weaker copy of
  // smoke-effects that passes for the wrong reason. Running it at the end means every other
  // suite has already hung up. ⚠ If it fails its preflight here, the cause is almost always a
  // previous suite's session lingering rather than anything about the module; re-run it alone.
  //
  // It is in the battery at all because an unrun suite rots — the 15-second reminder survived
  // six weeks behind an assertion that nobody re-read, and a no-GM suite that only ever ran on
  // the day it was written would be the same bet.
  // ⚠ THE SEED IS A BATTERY STEP, the smoke-d20-folds lesson applied again: smoke-nogm needs
  // the victim TOKEN on the range, earlier suites sweep it off (smoke-effects says so in its
  // own log), and a player client cannot place one — it only observes the scene. Without this
  // the battery reported a red for a missing fixture, which is a broken gauge.
  { name: "fixture-suite", note: "not a suite — re-places the tokens smoke-nogm needs", reset: true },
  { name: "smoke-nogm", note: "⚠ NO GM — the flow elect; must run with every other client hung up" }
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
