/**
 * ONE-OFF JOBS without a throwaway script (suite #7): a page-side snippet run through the suite
 * harness — the lock, the watchdog, the sole-GM preflight, the heartbeat, the teardown — with its
 * result printed as JSON and the browser hung up. The thing a quick look at the world used to cost a
 * file, a browser launch, a join and a forgotten process.
 *
 *   node tools/job.mjs -e "return game.actors.size"            inline: the BODY of an async function
 *   node tools/job.mjs path/to/job.js                           a file holding that body
 *   node tools/job.mjs -e "…" --arg '{"n": 40}'                 the JSON on `arg` inside the body
 *   node tools/job.mjs -e "…" --read-only                       assert nothing: passes the preflight
 *                                                               beside the MCP bridge, not as the elect
 *   node tools/job.mjs -e "…" --watchdog 600                    seconds before the hard abort (default 300)
 *
 * The body runs as `async (arg, log) => { … }` in the GM client's page: `game`, `canvas`,
 * `fromUuid`, every global the suites use. `log(...)` collects lines that print with the result.
 * Return a JSON-able value. Exit 0 on a result, 1 when the body threw, 3 on the watchdog.
 * ⚠ It MUTATES whatever the body mutates, as the suite identity, on the sandbox (BF_HOST for another
 * instance, deliberately). One job at a time: the suite lock refuses a job beside a battery.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { strictArgs, usageOf } from "./args.mjs";
import { connectSuite } from "./harness.mjs";

const { values, positionals } = strictArgs({
  options: {
    eval: { type: "string", short: "e" },
    arg: { type: "string" },
    "read-only": { type: "boolean" },
    watchdog: { type: "string" }
  },
  usage: usageOf(fileURLToPath(import.meta.url)),
  allowPositionals: true,
  script: "job.mjs"
});

const usage = () => { console.error(usageOf(fileURLToPath(import.meta.url))); process.exit(2); };
if ((values.eval ? 1 : 0) + positionals.length !== 1) usage();
const src = values.eval ?? readFileSync(positionals[0], "utf8");
let arg = null;
if (values.arg !== undefined) {
  try { arg = JSON.parse(values.arg); } catch (err) { console.error(`--arg is not JSON: ${err.message}`); process.exit(2); }
}
const watchdogMs = values.watchdog ? Number(values.watchdog) * 1000 : 300_000;
if (!Number.isFinite(watchdogMs) || watchdogMs <= 0) { console.error("--watchdog takes seconds"); process.exit(2); }
const readOnly = !!values["read-only"];

const f = await connectSuite({ tag: "job", watchdogMs, requireElect: !readOnly, allowBridge: readOnly });
const started = Date.now();
// The body travels as DATA: `evaluate` serializes its function, so the snippet is compiled in the page.
const out = await f.evaluate(async ({ src, arg }) => {
  const lines = [];
  const log = (...parts) => lines.push(parts.map(p => (typeof p === "string") ? p : JSON.stringify(p)).join(" "));
  try {
    const body = new Function("arg", "log", `return (async () => {\n${src}\n})();`);
    const result = await body(arg, log);
    return { ok: true, result, lines };
  } catch (err) {
    return { ok: false, error: `${err?.name ?? "Error"}: ${err?.message ?? err}`, stack: err?.stack ?? null, lines };
  }
}, { src, arg });
const secs = ((Date.now() - started) / 1000).toFixed(1);

for (const l of out.lines) console.log(`  · ${l}`);
if (out.ok) {
  console.log(JSON.stringify(out.result === undefined ? null : out.result, null, 2));
  console.log(`[job] done in ${secs}s`);
} else {
  console.error(`[job] the body threw after ${secs}s — ${out.error}`);
  if (out.stack) console.error(out.stack.split("\n").slice(0, 6).join("\n"));
}
await f.disconnect();
process.exit(out.ok ? 0 : 1);
