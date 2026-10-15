// THE CONTRACT RECORDER — what a live run published, by shape, for tools/contracts.mjs to union into
// contracts/moment.json and contracts/card-flags.json (ARCHITECTURE §11 *Adding a RECORD*;
// tools/README.md *The contracts*). Armed by harness.mjs `connectSuite` beside the hook ledger and
// dumped at its teardown, one `dist/contract-recordings/<tag>.json` per suite.
//
// On the page it wraps `Hooks.call` and `Hooks.callAll` (transparent: same `this`, arguments and
// return, the dispatch untouched) and reads two things as they pass:
//   - every `bythebooks.*` hook: its arguments' schema and one sample, and for `bythebooks.moment`
//     the payload's schema per `<event>|<kind>` with one sample each;
//   - every `create<Document>` / `update<Document>` hook whose document carries the module's flag
//     scope: each key's schema, and the documents it was seen on.
// ⚠ It hears this client only, as the moment ledger does: a resolve published on another client is
// not recorded here, so a recording under-reports, never over. A shape is merged as it passes, so the
// recording is small whatever the run's length; the shape code is tools/contract-shapes.mjs's, sent
// to the page as source.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_SOURCE } from "./contract-shapes.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where a suite leaves its recording for tools/contracts.mjs to union. */
export const RECORDING_DIR = join(REPO, "dist", "contract-recordings");

/**
 * Page side: closes over nothing (serialized by `evaluate`); `source` is the shape bundle. Exported
 * for tests/contract-shapes.test.js, which installs it over a stand-in `Hooks`.
 * @param {string} source
 */
export const installRecorder = source => {
  if ( globalThis.__btbContractRecorder ) return "already";
  if ( (typeof Hooks?.call !== "function") || (typeof Hooks?.callAll !== "function") ) return "no Hooks";
  const { schemaOf, mergeSchemas, sampleOf } = new Function(source)();
  const MOD = "fvtt-mod-bythebooks";
  const rec = { hooks: {}, moments: {}, flags: {}, errors: 0 };
  const seeHook = (hook, args) => {
    const h = rec.hooks[hook] ?? (rec.hooks[hook] = { count: 0, args: [] });
    h.count++;
    if ( hook === "bythebooks.moment" ) {
      const p = args[0];
      const pair = `${p?.event ?? "?"}|${p?.kind ?? "?"}`;
      const m = rec.moments[pair] ?? (rec.moments[pair] = { count: 0, schema: null, sample: null });
      m.count++;
      m.schema = mergeSchemas(m.schema, schemaOf(p));
      if ( !m.sample ) m.sample = sampleOf(p);
      return;
    }
    // A word's own hook carries the moment's payload again: counted, its shape is the moment's.
    if ( (args.length === 1) && args[0] && (typeof args[0].momentId === "string") ) return;
    args.forEach((a, i) => { h.args[i] = mergeSchemas(h.args[i] ?? null, schemaOf(a)); });
    if ( !h.sample ) h.sample = args.map(a => sampleOf(a));
  };
  const seeDocument = (hook, doc) => {
    const flags = doc?.flags?.[MOD];
    if ( !flags || (typeof flags !== "object") ) return;
    const on = (typeof doc.documentName === "string") ? doc.documentName : hook.replace(/^(create|update)/, "");
    for ( const [key, value] of Object.entries(flags) ) {
      const f = rec.flags[key] ?? (rec.flags[key] = { count: 0, on: {}, schema: null });
      f.count++;
      f.on[on] = (f.on[on] ?? 0) + 1;
      f.schema = mergeSchemas(f.schema, schemaOf(value, key));
    }
  };
  for ( const name of ["call", "callAll"] ) {
    const orig = Hooks[name];
    Hooks[name] = function (hook, ...args) {
      try {
        if ( typeof hook === "string" ) {
          if ( hook.startsWith("bythebooks.") ) seeHook(hook, args);
          else if ( /^(create|update)[A-Z]/.test(hook) ) seeDocument(hook, args[0]);
        }
      } catch { rec.errors++; }
      return orig.call(this, hook, ...args);
    };
  }
  globalThis.__btbContractRecorder = rec;
  return "installed";
};

/**
 * Arm the recorder on a connected page. A failure is a warning: the run goes on unrecorded.
 * @param {any} f  the harness's connected bridge
 * @param {string} tag
 */
export async function armContractRecorder(f, tag) {
  const done = await f.evaluate(installRecorder, PAGE_SOURCE).catch(e => `failed: ${e.message}`);
  if ( done !== "installed" ) console.warn(`[${tag}] contract recorder not armed (${done})`);
}

/**
 * Read the page's recording into RECORDING_DIR. ⚠ A failure writes nothing, and an empty recording
 * is not written: a missing file reads as "this suite recorded nothing", never as a stale one.
 * @param {string} tag
 * @param {any} f
 */
export async function dumpContractRecording(tag, f) {
  try {
    const rec = await f.evaluate(() => {
      const r = globalThis.__btbContractRecorder;
      return r ? JSON.parse(JSON.stringify(r)) : null;
    }, null);
    if ( !rec ) { console.warn(`[${tag}] contract recording NOT armed — not written`); return; }
    const hooks = Object.keys(rec.hooks).length;
    const keys = Object.keys(rec.flags).length;
    if ( !hooks && !keys ) { console.warn(`[${tag}] contract recording EMPTY — not written`); return; }
    mkdirSync(RECORDING_DIR, { recursive: true });
    writeFileSync(join(RECORDING_DIR, `${tag}.json`), `${JSON.stringify({ tag, at: new Date().toISOString(), ...rec }, null, 1)}\n`);
    console.log(`[${tag}] contract recording: ${hooks} hook(s), ${Object.keys(rec.moments).length} moment pair(s), ${keys} flag key(s)`
      + (rec.errors ? `; ⚠ ${rec.errors} value(s) could not be read` : ""));
  } catch (err) {
    console.warn(`[${tag}] contract recording NOT captured — ${err.message}`);
  }
}
