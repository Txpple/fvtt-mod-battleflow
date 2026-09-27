/**
 * The suite harness: env, watchdog, connect + preflight, section filtering, the hook and moment
 * ledgers, teardown and the one reporter (ARCHITECTURE §11 *Adding a TEST*).
 * ⚠ Nothing here runs in the page: `f.evaluate()` serializes its function, so a helper the closure
 * needs travels as DATA on the evaluate argument (`sectionArg`).
 * `--section 3[,5]` runs those sections plus their dependencies; `--list` prints the table.
 * Setup and teardown always run. ⚠ A filtered run's summary is stamped PARTIAL.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Foundry, loadEnv } from "fvtt-mcp-dnd5e/client";
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where a suite leaves its hook ledger for `hook-coverage.mjs` to union. */
export const LEDGER_DIR = join(REPO, "dist", "hook-ledger");

/** The MCP repo's `.env` through its own reader. */
export { loadEnv };

/** Section ids sort numeric-aware: `10` after `9`, `4a2` between `4` and `4b`. */
const bySectionId = (a, b) =>
  (Number.parseFloat(a) - Number.parseFloat(b)) || String(a).localeCompare(String(b));

/**
 * Expand a requested section set through a suite's dependency map (`{ 2: [1] }`: §2 asserts on
 * what §1 did, so asking for §2 runs §1 too).
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
 * Read `--section` / `--list` against a suite's `{ id: "title" }` table (STRING ids).
 * Returns `{ plan, pulled }`: plan null = run everything; pulled = sections a dependency dragged in.
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
    // ⚠ Sorted: JS hoists integer-like keys ahead of `'4a2'`-style ones.
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
 * The argument every filtered `f.evaluate()` takes: the plan and titles as DATA (the closure
 * cannot import `want()`), so a skipped section names itself. `extra` is the suite's own argument.
 */
export function sectionArg(plan, titles = {}, extra = null) {
  return { sections: plan, titles, ...(extra ? { extra } : {}) };
}

/**
 * One suite at a time. ⚠ Two suites on one box both join as `Tester Assistant`, and the preflight
 * counts users, not sockets, so it passes and the runs fight over settings and fixtures.
 * A pid file held by a LIVE pid refuses the second run; a stale lock is taken over and reported.
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

/* ─── The hook ledger (ARCHITECTURE §10 D11): which hook NAMES actually dispatch during a run.
 * It wraps dispatch, not the module's callbacks, so it never replaces live function identities
 * in `Hooks.events`. ⚠ `Hooks.call` stops at the first handler returning false (e.g.
 * `dnd5e.preApplyDamage`), so "fired" means every listener ran only for `callAll`. */

/** Page side: closes over nothing (serialized by `evaluate`). */
const installLedger = () => {
  if (globalThis.__bfHookLedger) return "already";
  const ledger = Object.create(null);
  for (const name of ["call", "callAll"]) {
    const orig = Hooks[name];
    if (typeof orig !== "function") return `no Hooks.${name}`;
    // Transparent: same `this`, args and return; counts before dispatch so a throwing handler still counts.
    Hooks[name] = function (hook, ...args) {
      ledger[hook] = (ledger[hook] ?? 0) + 1;
      return orig.call(this, hook, ...args);
    };
  }
  globalThis.__bfHookLedger = ledger;
  return "installed";
};

/**
 * The moment ledger: counts `battleflow.moment` by `kind` (and `event`) for tools/claim-proof.mjs.
 * A listener, not a wrapper. ⚠ It hears this client only (a moment publishes on the writing
 * client), so it under-reports, never over.
 */
const installMomentLedger = () => {
  if (globalThis.__bfMomentLedger) return "already";
  if (typeof Hooks?.on !== "function") return "no Hooks.on";
  const ledger = { total: 0, kinds: Object.create(null), events: Object.create(null), unkeyed: 0 };
  Hooks.on("battleflow.moment", payload => {
    try {
      ledger.total++;
      if (payload?.kind) ledger.kinds[payload.kind] = (ledger.kinds[payload.kind] ?? 0) + 1;
      else ledger.unkeyed++;
      if (payload?.event) ledger.events[payload.event] = (ledger.events[payload.event] ?? 0) + 1;
    } catch { /* a counter never reaches the moment it counts */ }
  });
  globalThis.__bfMomentLedger = ledger;
  return "installed";
};

/**
 * Read the page's ledgers into LEDGER_DIR for `hook-coverage.mjs`.
 * ⚠ A failure writes nothing: an under-reporting file would name live handlers dead. `moments`
 * is written only when armed; an absent key reads as NOT MEASURED, an empty `{}` as "none published".
 */
export async function dumpHookLedger(tag, f) {
  try {
    const { ledger, moments } = await f.evaluate(() => {
      const m = globalThis.__bfMomentLedger;
      return {
        ledger: { ...(globalThis.__bfHookLedger ?? {}) },
        moments: m ? { total: m.total, unkeyed: m.unkeyed, kinds: { ...m.kinds }, events: { ...m.events } } : null
      };
    }, null);
    const fired = Object.keys(ledger).length;
    if (!fired) { console.warn(`[${tag}] hook ledger EMPTY — not written`); return; }
    mkdirSync(LEDGER_DIR, { recursive: true });
    writeFileSync(join(LEDGER_DIR, `${tag}.json`),
      JSON.stringify({ tag, at: new Date().toISOString(), ledger, ...(moments ? { moments } : {}) }, null, 2));
    console.log(`[${tag}] hook ledger: ${fired} distinct hooks fired`
      + (moments ? `; moment ledger: ${moments.total} published, ${Object.keys(moments.kinds).length} kind(s)`
        : "; moment ledger NOT armed — its claims will read NOT MEASURED"));
  } catch (err) {
    console.warn(`[${tag}] hook ledger NOT captured — ${err.message}`);
  }
}

/** How long a teardown may take before it is abandoned to process exit. */
const DISPOSE_CEILING_MS = 10_000;

/**
 * `Foundry#dispose()` raced against a ceiling. ⚠ Never awaited bare: the watchdog hard-aborts
 * (exit 3), so a hanging dispose would turn a green run into an abort; after the ceiling it is
 * left to process exit.
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
 * Connect, preflight, arm the watchdog; returns the live `Foundry`. `watchdogMs` is per-suite
 * (measured wall clocks differ widely). ⚠ Armed BEFORE `connect()`: a launch that never
 * finishes is the hang it exists to break.
 */
export async function connectSuite({ tag, watchdogMs, requireElect = true, allowBridge = false, env = loadEnv() }) {
  takeSuiteLock(tag);
  setTimeout(() => {
    console.error(`[${tag}] WATCHDOG ${Math.round(watchdogMs / 1000)}s — hard abort`);
    process.exit(3);
  }, watchdogMs);
  const f = new Foundry(foundryConfig(env));
  console.log(`[${tag}] connecting…`);
  await f.connect();
  await preflightSoleGM(f, { requireElect, allowBridge, env });

  /**
   * ⚠ Client-scoped baseline: verify-settings pins WORLD keys only and the tester is a fresh
   * profile, so a client default change hits every suite. Suites run with silent auto-roll; the
   * sections that test the offer set it true and restore it. A hand-built second client (e.g.
   * check-popup-routing's player) skips this and must pin its own if it rolls damage.
   */
  await f.evaluate(async () =>
    game.settings.set("fvtt-mod-battleflow", "playerRollDamage", false), null);

  /**
   * ⚠ Measured cover OFF for the run, restored at teardown: fixtures stand creatures in a row, so
   * cover would move hit/miss in unrelated sections. The section that tests it turns it on itself;
   * a killed run leaves it off until verify-settings --fix.
   */
  const priorCover = await f.evaluate(async () => {
    if ( !game.settings.settings.has("fvtt-mod-battleflow.measuredCover") ) return null;
    const v = game.settings.get("fvtt-mod-battleflow", "measuredCover");
    if ( v ) await game.settings.set("fvtt-mod-battleflow", "measuredCover", false);
    return v;
  }, null).catch(() => null);

  // ⚠ The ledger dump rides the teardown, not `finish()`: several suites never call `finish`.
  const install = await f.evaluate(installLedger, null).catch(e => `failed: ${e.message}`);
  if (install !== "installed") console.warn(`[${tag}] hook ledger not armed (${install})`);
  const moments = await f.evaluate(installMomentLedger, null).catch(e => `failed: ${e.message}`);
  if (moments !== "installed") console.warn(`[${tag}] moment ledger not armed (${moments})`);

  // One teardown under both names: suites call `disconnect`, `dispose` is the real one.
  let hungUp = false;
  const teardown = async () => {
    if (hungUp) return;
    hungUp = true;
    if ( priorCover === true ) {
      await f.evaluate(async () => game.settings.set("fvtt-mod-battleflow", "measuredCover", true), null)
        .catch(e => console.warn(`[${tag}] Measured Cover not restored (${e.message}) — run verify-settings --fix`));
    }
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
 * The one reporter for `{ fatal, results, log, skips }`. ⚠ Failures print in the body with detail;
 * the summary stays last so a `| tail` is useful but never sufficient.
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
