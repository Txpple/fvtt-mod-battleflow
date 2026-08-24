/**
 * THE SUITE HARNESS — the boilerplate every tools/ script copy-pasted, in one place
 * (PLAN.md § FOUNDATION PASS 1.1 + 1.4).
 *
 * Twenty-six files in `tools/` opened with the same twenty lines: read the MCP's `.env` by
 * hand, arm a watchdog, build a `Foundry`, connect, preflight. That is not merely repetitive —
 * it DRIFTED. The watchdog tag was spelled four ways, half the files logged the target and
 * half did not, and a suite that forgot `preflightSoleGM` would assert on work happening in
 * another client (target.mjs documents what that costs). One home, one shape.
 *
 * ⚠ WHAT THIS FILE MAY NOT DO: nothing here runs inside the page. `f.evaluate()` serializes
 * its function to the browser, where no import exists — so a helper the CLOSURE needs cannot
 * live here as a function. It travels as DATA on the evaluate argument (see `sectionArg`).
 *
 * ── Section filtering ────────────────────────────────────────────────────────────────────
 *
 *   node tools/smoke-volleys.mjs                 the whole suite (the default; unchanged)
 *   node tools/smoke-volleys.mjs --section 3     just §3, plus anything §3 depends on
 *   node tools/smoke-volleys.mjs --section 3,5   two sections
 *   node tools/smoke-volleys.mjs --list          the section table, without connecting
 *
 * **Setup and teardown ALWAYS run. Only assertion blocks are skippable.** A suite's fixtures,
 * its settings pins and its restore are the part that must not be optional: a filtered run
 * that skipped teardown would leave the world dirty for the next one, which is the failure
 * mode the whole harness discipline exists to prevent.
 *
 * ⚠ A FILTERED RUN NEVER PRINTS THE UNFILTERED SUMMARY. `report()` stamps it `PARTIAL` and
 * names the sections. A partial green mistaken for a battery green is the one way this
 * feature could make the tree worse, so the output makes the difference impossible to miss.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Foundry } from "file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js";
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const MCP = "D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e";
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where a suite leaves its hook ledger for `hook-coverage.mjs` to union. */
export const LEDGER_DIR = join(REPO, "dist", "hook-ledger");

/** The MCP's `.env`, parsed the way all 26 callers parsed it — comments out, `K=V` in. */
export function loadEnv() {
  const env = {};
  for (const line of readFileSync(`${MCP}/.env`, "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

/**
 * Section ids sort NUMERIC-AWARE: `10` follows `9` rather than `1`, and `4a2` sits between `4`
 * and `4b`. Half the suites number their sections `4b`/`4d3`, so a plain string sort scatters
 * them and a numeric one loses them entirely.
 *
 * ⚠ One function, two callers, because it had two copies for about an hour and the second
 * carried the comment "same comparator as expandSections" — which is the shape every duplicate
 * in this repo's census announced itself with before it drifted.
 */
const bySectionId = (a, b) =>
  (Number.parseFloat(a) - Number.parseFloat(b)) || String(a).localeCompare(String(b));

/**
 * Expand a requested section set through a suite's dependency map.
 *
 * ⚠ THE POINT OF THE MAP. Sections are not independent — smoke-saves §2 asserts on the card
 * §1 cast, and running §2 alone would fail for a reason that is not the code. Rather than
 * forbid that, the suite DECLARES `{ 2: [1] }` and asking for §2 quietly runs §1 too, saying
 * so. A section with no entry is independent, and 1.2's per-suite verification is exactly the
 * exercise that proves it: run it alone, and if it fails, it had a dependency nobody wrote down.
 */
export function expandSections(requested, depends = {}) {
  if (!requested) return null;
  const out = new Set();
  const visit = id => {
    if (out.has(id)) return;
    out.add(id);
    for (const need of depends[id] ?? []) visit(String(need));
  };
  for (const id of requested) visit(String(id));
  return [...out].sort(bySectionId);
}

/**
 * Read `--section` / `--list` off the command line against a suite's section table.
 *
 * `table` is `{ id: "title" }` with STRING ids, because half the suites number their sections
 * `4b`/`4d3` and a number type would quietly lose them. Returns `{ plan, pulled }` where
 * `plan` is null for "run everything" and `pulled` names the sections dragged in by a
 * dependency, so the run can say why it is doing more than it was asked.
 */
export function sectionPlan(table, depends = {}, argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: { section: { type: "string" }, list: { type: "boolean" } },
    allowPositionals: true,
    strict: false
  });
  if (values.list) {
    console.log("Sections:");
    // ⚠ Sorted, not declaration order: JS hoists integer-like keys to the front of an object,
    // so a table mixing `1` with `'4a2'` prints 1,3,4,5,6 and only then the lettered ones —
    // which reads as a suite that lost half its sections.
    for (const [id, title] of Object.entries(table).sort(([a], [b]) => bySectionId(a, b))) {
      const needs = depends[id]?.length ? `  (needs ${depends[id].join(", ")})` : "";
      console.log(`  ${String(id).padEnd(5)} ${title}${needs}`);
    }
    process.exit(0);
  }
  if (!values.section) return { plan: null, pulled: [] };
  const asked = String(values.section).split(",").map(s => s.trim()).filter(Boolean);
  const unknown = asked.filter(id => !(id in table));
  if (unknown.length) {
    console.error(`--section: no such section ${unknown.join(", ")}. Try --list.`);
    process.exit(2);
  }
  const plan = expandSections(asked, depends);
  return { plan, pulled: plan.filter(id => !asked.includes(id)) };
}

/**
 * The argument every filtered `f.evaluate()` takes. The closure cannot import `want()`, so the
 * plan and the titles travel as DATA and the page spells the three-line predicate itself.
 *
 * The titles ride along so a skipped section can name itself in the output — the alternative
 * was a second copy of every title inside the closure, and a suite whose SKIP lines disagree
 * with its `--list` output is worse than no titles at all.
 *
 * `extra` is whatever else that suite already passed as its evaluate argument.
 */
export function sectionArg(plan, titles = {}, extra = null) {
  return { sections: plan, titles, ...(extra ? { extra } : {}) };
}

/**
 * ONE SUITE AT A TIME — the guard `preflightSoleGM` structurally cannot be.
 *
 * ⚠ Two suites launched against the same box both join as `Tester Assistant`, and the
 * preflight counts **users, not sockets** (target.mjs documents that measurement). One user,
 * one GM, preflight green — and then the two runs fight over settings, fixtures and the elect,
 * producing failures that belong to neither. Seen for real 2026-08-23: a second suite started
 * while `smoke-maneuvers` was mid-run, re-pinned six settings underneath it, and nothing in
 * the harness said a word.
 *
 * A pid file closes it where the preflight cannot: the second process finds a lock held by a
 * LIVE pid and refuses. A stale lock (the holder crashed, or was killed) is taken over and
 * reported, because a suite that cannot start is worse than one that says what it stepped over.
 */
function takeSuiteLock(tag) {
  const lock = join(tmpdir(), `bf-suite-${(process.env.BF_TARGET ?? "local").toLowerCase()}.lock`);
  let held = null;
  try { held = JSON.parse(readFileSync(lock, "utf8")); } catch { /* no lock, or unreadable */ }
  if (held?.pid) {
    let alive = false;
    try { process.kill(held.pid, 0); alive = true; } catch { /* gone */ }
    if (alive && (held.pid !== process.pid)) {
      console.error(`[${tag}] REFUSING TO START: "${held.tag}" is already running against this `
        + `world (pid ${held.pid}, since ${held.started}). Two suites on one box share the `
        + `elect and fight over settings — and the sole-GM preflight cannot see it, because `
        + `both join as the same user. Wait for it, or kill that pid.`);
      process.exit(4);
    }
    if (!alive) console.warn(`[${tag}] taking over a stale lock from "${held.tag}" (pid ${held.pid}, `
      + `${held.started}) — that run died without tearing down, so the world may be dirty.`);
  }
  writeFileSync(lock, JSON.stringify({ tag, pid: process.pid, started: new Date().toISOString() }));
  const release = () => { try { rmSync(lock, { force: true }); } catch { /* best effort */ } };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => { release(); process.exit(130); });
  }
}

/* ─── THE HOOK LEDGER (ARCHITECTURE §10 D11) ──────────────────────────────────────────────────
 *
 * WHICH OF THIS MODULE'S 83 HOOK REGISTRATIONS ACTUALLY FIRE WHEN THE BATTERY RUNS.
 *
 * ⚠ WHY THIS EXISTS, and it is the only measurement in the tree that answers the question:
 * every other check is a statement about the SHAPE of the code. v1.23.0 shipped four of six
 * d20-fold offer paths DEAD behind a green gate and a 12/12 green suite, and what found it was a
 * person at a table. `npm run dispatch` closed the sub-case where the hook NAME was wrong. This
 * closes nothing — **it MEASURES**, and the thing it measures is the silence: a handler that is
 * correctly named, correctly layered, correctly documented and never once invoked.
 *
 * ⚠ IT WRAPS DISPATCH, NOT REGISTRATION, AND THAT IS A DELIBERATE LIMIT. Wrapping the module's
 * own callbacks in place would give per-registration truth, and would also mean replacing live
 * function identities inside `Hooks.events` while the suite drives the very code being measured.
 * **An instrument that can break the thing it measures is worth less than a coarser one that
 * cannot.** So the ledger counts hook NAMES dispatched in the page, and coverage is reported at
 * name granularity, with the per-file rollup derived from the static registration list.
 *
 * ⚠ ONE HONEST CAVEAT, and `hook-coverage.mjs` prints it: `Hooks.call` (as opposed to `callAll`)
 * STOPS AT THE FIRST HANDLER THAT RETURNS FALSE. `dnd5e.preApplyDamage` is one — hold.js's veto
 * can legitimately stop it before concentration.js's handler. So "the name fired" implies every
 * listener ran for `callAll`, and only "at least the first" for `call`.
 * ─────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Page side. Serialised into the browser by `evaluate`, so it closes over NOTHING — no imports,
 * no module-scope references (the rule at the head of this file).
 */
const installLedger = () => {
  if (globalThis.__bfHookLedger) return "already";
  const ledger = Object.create(null);
  for (const name of ["call", "callAll"]) {
    const orig = Hooks[name];
    if (typeof orig !== "function") return `no Hooks.${name}`;
    // Transparent by construction: same `this`, same arguments, same return value. The counter
    // is the only thing added, and it runs before the dispatch so a handler that throws still
    // leaves the fact that the hook FIRED on the record.
    Hooks[name] = function (hook, ...args) {
      ledger[hook] = (ledger[hook] ?? 0) + 1;
      return orig.call(this, hook, ...args);
    };
  }
  globalThis.__bfHookLedger = ledger;
  return "installed";
};

/**
 * Read the page's ledger and leave it beside the others for `hook-coverage.mjs`.
 *
 * ⚠ A FAILURE HERE IS LOUD AND WRITES NOTHING. A ledger file that exists but under-reports would
 * name live handlers as dead — the exact false alarm that trains a reader to ignore the report,
 * which is how this instrument would die. Absent is honest; wrong is not.
 */
export async function dumpHookLedger(tag, f) {
  try {
    const ledger = await f.evaluate(() => ({ ...(globalThis.__bfHookLedger ?? {}) }), null);
    const fired = Object.keys(ledger).length;
    if (!fired) { console.warn(`[${tag}] hook ledger EMPTY — not written`); return; }
    mkdirSync(LEDGER_DIR, { recursive: true });
    writeFileSync(join(LEDGER_DIR, `${tag}.json`),
      JSON.stringify({ tag, at: new Date().toISOString(), ledger }, null, 2));
    console.log(`[${tag}] hook ledger: ${fired} distinct hooks fired`);
  } catch (err) {
    console.warn(`[${tag}] hook ledger NOT captured — ${err.message}`);
  }
}

/** How long a teardown may take before it is abandoned to process exit. */
const DISPOSE_CEILING_MS = 10_000;

/**
 * HANG UP FOR REAL — `Foundry#dispose()`, raced against a ceiling.
 *
 * ⚠ THIS EXISTS BECAUSE THE OLD CEREMONY WAS A LIE. Every suite in this tree ended with
 * `await f.disconnect?.()` and **`disconnect` is not a method on `Foundry` — `dispose` is**, so
 * the optional chain swallowed it silently from the day the harness was written. Nothing closed,
 * nothing complained, and the session was really torn down by process exit. **That is D11's own
 * failure class living inside the test tooling**: a call that reads correctly, does nothing, and
 * reports nothing. Found 2026-08-23 by the hook ledger, which needed a teardown seam and
 * discovered there wasn't one.
 *
 * ⚠ RACED, NEVER AWAITED BARE, and this is the whole reason the fix waited for its own pass. The
 * suites arm a watchdog that hard-aborts the process (exit 3). A `dispose()` that hangs — on an
 * in-flight connect that never settles, or a browser that will not close — would turn a GREEN
 * run into a watchdog abort, which is strictly worse than the no-op it replaces. So it gets ten
 * seconds and is then abandoned to process exit, exactly where it has been living all along.
 */
export async function disposeSafely(f, tag) {
  const dispose = f?.dispose?.bind(f);
  if (!dispose) return;
  let settled = false;
  await Promise.race([
    dispose().then(() => { settled = true; })
      .catch(err => { settled = true; console.warn(`[${tag}] dispose() failed — ${err.message}`); }),
    new Promise(r => { setTimeout(r, DISPOSE_CEILING_MS); })
  ]);
  if (!settled) {
    console.warn(`[${tag}] dispose() did not finish in ${DISPOSE_CEILING_MS / 1000}s — `
      + "abandoning it to process exit (which is what used to happen every time)");
  }
}

/**
 * Connect, preflight, arm the watchdog. Returns the live `Foundry`.
 *
 * `watchdogMs` stays per-suite: the numbers are measured wall clocks (smoke-effects genuinely
 * needs 600s, smoke-resources 300s) and a single shared ceiling would either abort the slow
 * suites or let a hung fast one sit for ten minutes.
 *
 * ⚠ The watchdog is armed BEFORE `connect()` on purpose — a Foundry that never finishes
 * launching is exactly the hang it exists to break, and arming after would never fire.
 */
export async function connectSuite({ tag, watchdogMs, requireElect = true, env = loadEnv() }) {
  takeSuiteLock(tag);
  setTimeout(() => {
    console.error(`[${tag}] WATCHDOG ${Math.round(watchdogMs / 1000)}s — hard abort`);
    process.exit(3);
  }, watchdogMs);
  const f = new Foundry(foundryConfig(env));
  console.log(`[${tag}] connecting…`);
  await f.connect();
  await preflightSoleGM(f, { requireElect });

  // ⚠ THE LEDGER IS ARMED HERE AND DUMPED ON THE WAY OUT, and the dump rides the teardown call
  // rather than `finish()` because SIX of the sixteen callers never call `finish` —
  // smoke-battleflow, smoke-hold, smoke-twoclient and check-popup-routing among them. Every one
  // of them ends with `await f.disconnect?.()`, so hanging the dump on the instance is the one
  // seam that catches all of them without editing a single suite.
  const install = await f.evaluate(installLedger, null).catch(e => `failed: ${e.message}`);
  if (install !== "installed") console.warn(`[${tag}] hook ledger not armed (${install})`);

  // ⚠ ONE TEARDOWN, UNDER BOTH NAMES. `disconnect` is what all sixteen suites call and did not
  // exist (see `disposeSafely` above); `dispose` is the real one. Both now dump the ledger and
  // hang up, once, whichever a suite reaches for.
  let hungUp = false;
  const teardown = async () => {
    if (hungUp) return;
    hungUp = true;
    await dumpHookLedger(tag, f);
    await disposeSafely(f, tag);
  };
  f.disconnect = teardown;
  f.dispose = teardown;

  console.log(`[${tag}] connected`);
  return f;
}

/** Announce the plan before the run, so a scrollback tells you what was actually exercised. */
export function announcePlan(tag, plan, pulled = []) {
  if (!plan) return;
  const because = pulled.length ? ` (${pulled.join(", ")} pulled in by a dependency)` : "";
  console.log(`[${tag}] PARTIAL RUN — sections ${plan.join(", ")}${because}`);
}

/**
 * The one reporter. Every suite returned the same `{ fatal, results, log, skips }` shape and
 * then printed it five different ways, two of which dropped `skips` and three of which dropped
 * `consoleErrors` — output drift in the one place where output IS the product.
 *
 * ⚠ Failures print in the BODY, with their detail. HANDOFF's operational rule ("always redirect
 * a suite to a file") exists because a `| tail` throws that body away; this keeps the summary
 * last so the tail is still useful, but never makes the summary sufficient.
 */
export function report({ tag, out, plan = null }) {
  if (out?.fatal) {
    console.error(`\n[${tag}] FATAL: ${out.fatal}`);
    for (const r of out.results ?? []) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name}`);
    process.exit(2);
  }
  for (const l of out.log ?? []) console.log(`  · ${l}`);
  if (out.log?.length) console.log("");
  let failures = 0;
  for (const r of out.results ?? []) {
    if (!r.pass) failures++;
    console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
  }
  for (const s of out.skips ?? []) console.log(`  SKIP ${s}`);
  if (out.consoleErrors?.length) {
    console.log("\n  CONSOLE ERRORS DURING THE RUN:");
    for (const e of out.consoleErrors) console.log(`   ⚠ ${e}`);
  }
  const total = out.results?.length ?? 0;
  const partial = plan ? `  ⚠ PARTIAL RUN — sections ${plan.join(", ")} only` : "";
  console.log(`\n[${tag}] ${total - failures}/${total} passed${partial}`);
  return failures;
}

/** Report, hang up, and carry the verdict out as the exit code. */
export async function finish({ tag, out, plan = null, f = null }) {
  const failures = report({ tag, out, plan });
  await f?.disconnect?.();
  process.exit(failures ? 1 : 0);
}
