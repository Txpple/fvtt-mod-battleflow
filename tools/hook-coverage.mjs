// HOOK COVERAGE — which of this module's registrations actually FIRED (ARCHITECTURE §10 D11).
// Reads the per-suite ledgers a battery leaves in `dist/hook-ledger/` against the registrations
// `check-hook-order.mjs` knows, and prints whether the world ever dispatched each hook.
// ⚠ A report, not a gate: a never-fired line may be a coverage gap, a dead handler, a rare hook,
// or a hook the platform never dispatches, and only a person can tell them apart. The exit code
// says whether the INSTRUMENT worked, never what it found.
// A second section, THE CLAIM PROOF (tools/claim-proof.mjs), reads the ledgers' `moments` half
// against the coverage map, under the same contract.
//
//   node tools/hook-coverage.mjs          # after a battery
//   node tools/battery.mjs                # runs it for you, at the end
//
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyClaims, loadFileKinds, loadOrder, loadSuiteTags, soleWriters, tagTable }
  from "./claim-proof.mjs";
import { loadRegistrations, groupByHook } from "./hook-registrations.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LEDGER_DIR = join(REPO, "dist", "hook-ledger");

// ⚠ `Hooks.call` stops at the first handler returning false: "fired" means at least the first
// listener ran. `preApplyDamage` is the veto seam, where the hold stopping later handlers is correct.
const SHORT_CIRCUITING = new Set(["dnd5e.preApplyDamage"]);

// ⚠ Hooks that fire before the ledger is armed (after `connect()`, long after boot): unobservable
// by construction, pinned with a reason, checked both ways below.
const BEFORE_THE_INSTRUMENT = new Map([
  ["init", "fires once during world boot, before any suite connects. settings.js registers the "
    + "settings surface here and volley-registry.js its kinds — both are proven every run by "
    + "`check-registry` statically and by every suite that reads a setting; emanations.js registers "
    + "its Region behaviour type here (2026-09-03) — proven by smoke-emanations, which reads it off CONFIG"],
  ["ready", "fires once when the world finishes booting, before any suite connects. auto-damage.js "
    + "primes its lazy machine imports here — proven by smoke-battleflow §5d, whose offer timing "
    + "only holds when the priming ran; emanations.js sweeps the active scene here (2026-09-03) — "
    + "the same sweep runs on canvasReady, which smoke-emanations exercises"]
]);

// ⚠ Core hooks the PLATFORM never dispatches (a core name that has gone away registers cleanly
// and does nothing; D10's dispatch gate covers only `dnd5e.*`). Each row names its measurement
// (tools/probe-surfaces.mjs), is excluded from the denominator, and is checked both ways below.
// Empty for now; the category is the home for the next such absence.
const NOT_DISPATCHED_HERE = new Map([]);

let files = [];
try {
  files = readdirSync(LEDGER_DIR).filter(n => n.endsWith(".json"));
} catch {
  console.error(`FAIL no ledger directory at ${LEDGER_DIR}.`);
  console.error("     Ledgers are written by a live suite on disconnect. Run the battery, or at "
    + "least one suite, then re-run this.");
  process.exit(1);
}
if (!files.length) {
  console.error(`FAIL ${LEDGER_DIR} holds no ledgers — the instrument did not run.`);
  console.error("     A suite arms it at connect and writes it at disconnect; a suite that "
    + "crashed before disconnecting leaves nothing. This is an instrument failure, not a "
    + "coverage result — do not read the absence as 'nothing fired'.");
  process.exit(1);
}

/* --- union the ledgers */

const total = new Map();      // hook name -> times dispatched, across every suite
const seenIn = new Map();     // hook name -> [suite tags]
const suites = [];
const momentsByTag = new Map(); // tag -> { kind: count }, only for a ledger that carries the half
for (const name of files.sort()) {
  const { tag, ledger, moments } = JSON.parse(readFileSync(join(LEDGER_DIR, name), "utf8"));
  suites.push(tag);
  if (moments?.kinds) momentsByTag.set(tag, moments.kinds);
  for (const [hook, n] of Object.entries(ledger)) {
    total.set(hook, (total.get(hook) ?? 0) + n);
    if (!seenIn.has(hook)) seenIn.set(hook, []);
    seenIn.get(hook).push(tag);
  }
}

/* --- against what the module registers */

const reg = await loadRegistrations();
const byHook = groupByHook(reg);
const names = [...byHook.keys()];

const fired = names.filter(h => total.has(h));
const boot = names.filter(h => !total.has(h) && BEFORE_THE_INSTRUMENT.has(h));
const undispatched = names.filter(h => !total.has(h) && NOT_DISPATCHED_HERE.has(h));
const silent = names.filter(h => !total.has(h) && !BEFORE_THE_INSTRUMENT.has(h)
  && !NOT_DISPATCHED_HERE.has(h));
const liveRegistrations = fired.reduce((n, h) => n + byHook.get(h).length, 0);
const deadRegistrations = silent.reduce((n, h) => n + byHook.get(h).length, 0);

console.log("HOOK COVERAGE — which registrations the live run actually exercised "
  + "(ARCHITECTURE §10 D11)");
console.log(`  ${suites.length} ledger(s): ${suites.join(", ")}`);
console.log(`  ${total.size} distinct hook names dispatched in the page; this module listens `
  + `to ${names.length} of them\n`);

const w = Math.max(...names.map(h => h.length));
// The denominator excludes the pinned hooks, so 100% stays reachable.
const observable = names.length - boot.length - undispatched.length;
const bootRegistrations = boot.reduce((n, h) => n + byHook.get(h).length, 0);
const pinnedRegistrations = bootRegistrations
  + undispatched.reduce((n, h) => n + byHook.get(h).length, 0);
console.log(`  FIRED — ${fired.length}/${observable} observable names, `
  + `${liveRegistrations}/${reg.length - pinnedRegistrations} observable registrations`);
for (const h of fired.sort((a, b) => total.get(b) - total.get(a))) {
  const note = SHORT_CIRCUITING.has(h) ? "  ⚠ Hooks.call — first-false stops the chain" : "";
  console.log(`    ${h.padEnd(w)}  ${String(total.get(h)).padStart(6)}×  `
    + `${byHook.get(h).length} handler(s)${note}`);
}

if (boot.length) {
  console.log(`\n  BEFORE THE INSTRUMENT — ${boot.length} name(s), unobservable by construction, `
    + "not a gap:");
  for (const h of boot) {
    console.log(`    ${h.padEnd(w)}  ${[...new Set(byHook.get(h))].join(", ")}`);
    console.log(`      ${BEFORE_THE_INSTRUMENT.get(h)}`);
  }
}
// Both ways: a boot hook that turns out observable loses its excuse.
for (const [h, why] of BEFORE_THE_INSTRUMENT) {
  if (total.has(h)) {
    console.log(`\n  ⚠ STALE PIN: "${h}" is listed as unobservable (${why}) and the ledger `
      + "recorded it firing. Delete the row — it is measurable now.");
  } else if (!names.includes(h)) {
    console.log(`\n  ⚠ STALE PIN: "${h}" is listed as unobservable and this module no longer `
      + "registers it. Delete the row.");
  }
}

if (undispatched.length) {
  const dead = undispatched.reduce((n, h) => n + byHook.get(h).length, 0);
  console.log(`\n  NOT DISPATCHED BY THIS FOUNDRY — ${undispatched.length} name(s), `
    + `${dead} registration(s). Registered, measured, and never delivered:`);
  for (const h of undispatched) {
    console.log(`    ${h.padEnd(w)}  ${[...new Set(byHook.get(h))].join(", ")}`);
    console.log(`      ${NOT_DISPATCHED_HERE.get(h)}`);
  }
}
// Both ways: a pin that comes back to life means the platform restored the name.
for (const [h, why] of NOT_DISPATCHED_HERE) {
  if (total.has(h)) {
    console.log(`\n  ⚠ STALE PIN: "${h}" is pinned as never dispatched (${why.slice(0, 60)}…) `
      + "and the ledger recorded it FIRING. The platform gives it back — delete the row and "
      + "re-read ARCHITECTURE §10 D12.");
  } else if (!names.includes(h)) {
    console.log(`\n  ⚠ STALE PIN: "${h}" is pinned as never dispatched and this module no `
      + "longer registers it. Delete the row.");
  }
}

if (!silent.length) {
  console.log("\n  NEVER FIRED — none. Every observable registration this module makes was "
    + "exercised.");
} else {
  console.log(`\n  ⚠ NEVER FIRED — ${silent.length} name(s), ${deadRegistrations} registration(s). `
    + "READ THESE: a coverage gap and a dead handler look identical from here.");
  for (const h of silent) {
    console.log(`    ${h.padEnd(w)}  registered by ${[...new Set(byHook.get(h))].join(", ")}`);
  }
  console.log("\n    Three things this can mean — the battery never walks that path, the handler "
    + "is\n    dead and nobody knows (v1.23.0 printed four of these), or the hook is rare by "
    + "nature.\n    Decide which, per line. Do not let a line sit here unexplained across two "
    + "releases.");
}

// ⚠ Coverage is never the exit code.
console.log(`\nREPORT ${fired.length}/${observable} observable hook names exercised `
  + `(${liveRegistrations}/${reg.length - pinnedRegistrations} registrations) across `
  + `${suites.length} suite(s)`
  + (boot.length ? `, ${boot.length} unobservable by construction` : "")
  + (undispatched.length ? `, ${undispatched.length} not dispatched by this Foundry` : "")
  + ". Coverage is reported, never enforced.");

/* === THE CLAIM PROOF — did each claimed file ACT in the suite that claims it? */
// ⚠ Nothing below may turn the exit code: a missing input prints what it is and stops this half.

console.log("\n\nCLAIM PROOF — each declared claim against the moments its suite published "
  + "(tools/claim-proof.mjs)");

let coverage = null;
try {
  const mod = await import("./coverage-map.mjs");
  coverage = await mod.loadCoverageMap();
  if (!(coverage instanceof Map)) throw new Error("loadCoverageMap() did not return a Map");
} catch (err) {
  console.log(`  coverage map not available (${String(err?.message ?? err).split("\n")[0]}) — the `
    + "claim proof needs tools/coverage-map.mjs's loadCoverageMap(). Nothing to prove against; "
    + "not a result.");
}

if (coverage) {
  const fileKinds = loadFileKinds();
  const sole = soleWriters(fileKinds);
  const { suiteToTag, problems, notSuites } = tagTable({
    order: await loadOrder(), tags: loadSuiteTags(), ledgerTags: suites
  });
  for (const p of problems) console.log(`  ⚠ TAG TABLE: ${p}`);
  if (notSuites.length) {
    console.log(`  ledgers from steps that are not battery suites (ignored): ${notSuites.join(", ")}`);
  }
  const withMoments = suites.filter(t => momentsByTag.has(t));
  console.log(`  ${withMoments.length}/${suites.length} ledger(s) carry a moment half`
    + (withMoments.length < suites.length
      ? " — the rest predate it or were not armed, and read NOT MEASURED" : ""));

  const { rows, unclaimed, notMeasured, unknownSuites } = classifyClaims({
    coverage, suiteToTag, moments: momentsByTag, fileKinds, sole
  });
  for (const s of unknownSuites) {
    console.log(`  ⚠ the coverage map claims for "${s}", which is not a battery suite`);
  }

  const STATUSES = ["PROVEN", "PROVEN (shared kind)", "UNPROVEN", "UNPROVABLE-BY-MOMENTS",
    "NOT MEASURED", "NO SUCH FILE"];
  const count = (list, st) => list.filter(r => r.status === st).length;
  const sw = Math.max(...[...coverage.keys()].map(k => k.length), 10);
  console.log("\n  PER SUITE — proven / shared / UNPROVEN / unprovable / not measured / no such file");
  for (const suite of coverage.keys()) {
    const mine = rows.filter(r => r.suite === suite);
    const tag = suiteToTag.get(suite);
    const why = (tag === null) ? " (never leaves a ledger)"
      : tag ? ` (no moment half in ${tag}.json)` : " (no tag)";
    const note = notMeasured.includes(suite) ? `  NOT MEASURED${why}` : "";
    console.log(`    ${suite.padEnd(sw)}  `
      + `${STATUSES.map(st => String(count(mine, st)).padStart(3)).join(" ")}${note}`);
  }

  const unproven = rows.filter(r => r.status === "UNPROVEN");
  if (unproven.length) {
    console.log(`\n  ⚠ UNPROVEN — ${unproven.length} claim(s). The suite claims the file, the file `
      + "writes moment kinds, and none was published while the suite ran. A stale or generous "
      + "claim, or a path that stopped resolving — READ THESE:");
    for (const r of unproven) {
      console.log(`    ${r.suite.padEnd(sw)}  ${r.file}  (writes ${r.expected.join(", ")})`);
    }
  } else if (rows.some(r => ["PROVEN", "PROVEN (shared kind)"].includes(r.status))) {
    // Only when something WAS measured: "none" over zero claims is no result.
    console.log("\n  UNPROVEN — none among the measured claims.");
  }

  for (const r of rows.filter(x => x.status === "NO SUCH FILE")) {
    console.log(`  ⚠ NO SUCH FILE: ${r.suite} claims ${r.file} — ${r.reason}`);
  }

  if (unclaimed.length) {
    console.log(`\n  ⚠ ACTED BUT UNCLAIMED — ${unclaimed.length} file(s) whose OWN record kind was `
      + "published in a suite that does not claim them (a missing claim, the other direction):");
    for (const u of unclaimed) console.log(`    ${u.suite.padEnd(sw)}  ${u.file}  (${u.kinds.join(", ")})`);
  }

  const shared = rows.filter(r => r.status === "PROVEN (shared kind)");
  if (shared.length) {
    console.log(`\n  PROVEN (shared kind) — ${shared.length} claim(s) proven only by a kind other `
      + "files also write, or one the file is only pinned to: something ran, this file is one candidate:");
    for (const r of shared) console.log(`    ${r.suite.padEnd(sw)}  ${r.file}  (${r.via.join(", ")})`);
  }

  // The unprovable set once per FILE: it is a fact of the file.
  const unprovable = [...new Map(rows.filter(r => r.status === "UNPROVABLE-BY-MOMENTS")
    .map(r => [r.file, r.reason]))];
  if (unprovable.length) {
    console.log(`\n  UNPROVABLE-BY-MOMENTS — ${unprovable.length} claimed file(s) that publish no `
      + "moment kind; a limit of this instrument, not of the suites:");
    for (const [file, why] of unprovable) console.log(`    ${file}  — ${why}`);
  }

  if (notMeasured.length) {
    console.log(`\n  NOT MEASURED — ${notMeasured.length} suite(s): ${notMeasured.join(", ")}. `
      + "Their claims are neither proven nor unproven; run them with the moment ledger armed.");
  }
  console.log("\n  ⚠ A moment publishes on the client that WROTE its record; the ledger hears the "
    + "tester's page only, so a second client's own resolves are not counted. It under-reports, "
    + "never over.");

  const unmeasured = ["NOT MEASURED", "UNPROVABLE-BY-MOMENTS", "NO SUCH FILE"];
  const measured = rows.filter(r => !unmeasured.includes(r.status));
  const proven = count(rows, "PROVEN") + count(rows, "PROVEN (shared kind)");
  console.log(`\nREPORT claims: ${proven}/${measured.length} measured claims proven `
    + `(${count(rows, "PROVEN (shared kind)")} by a shared kind), ${unproven.length} UNPROVEN, `
    + `${unclaimed.length} acted-but-unclaimed, ${count(rows, "UNPROVABLE-BY-MOMENTS")} unprovable `
    + `by moments, ${count(rows, "NOT MEASURED")} not measured, across ${coverage.size} suite(s). `
    + "Reported, never enforced.");
}
