// CLAIM PROOF — did each file a suite CLAIMS to cover (tools/coverage-map.mjs) actually ACT there?
// The harness counts every `battleflow.moment` per suite by `kind`; a file whose kind was published
// in its claiming suite is proven, and the same ledger read backwards finds a missing claim.
//   - PROVEN               a kind only this file writes was published.
//   - PROVEN (shared kind) only kinds other files also write (or WORLD_WRITERS pins) were published.
//   - UNPROVEN             the file writes moment kinds and none was published: a stale claim.
//   - UNPROVABLE-BY-MOMENTS the file writes no moment kind (a view, a reader, a pure decision).
//   - NOT MEASURED         the suite left no moment ledger; never read as UNPROVEN.
// ⚠ A moment publishes on ONE client, so a second client's resolve is not heard: under-reports only.
// ⚠ Print, never fail (ARCHITECTURE §10 D11): the exit code says only whether the instrument worked.
// Pure functions take plain data (tests/claim-proof.test.js); the loaders at the bottom read the tree.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOMENT_KINDS, STATE_KEYS } from "../scripts/decide/moments.js";
import { keysByFile, WORLD_WRITERS } from "./moment-writers.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(TOOLS, "..", "scripts");

/* --- 1. file → moment kinds */

/**
 * What each scripts/ file's work can publish, from the gate's own tables: `writes` (MOMENT_RECORDS
 * keys it writes itself) and `pinned` (WORLD_WRITERS keys its consequences land as, via a service).
 * A file with neither is UNPROVABLE-BY-MOMENTS, `reason` saying why in the gate's words.
 * @param {{ keysByFile: Map<string, Set<string>>, worldWriters: Record<string, string[]|string>,
 *   momentKinds: Iterable<string>, stateKeys: Iterable<string>, allFiles: Iterable<string> }} input
 * @returns {Map<string, { writes: Set<string>, pinned: Set<string>, state: Set<string>, reason: string|null }>}
 */
export function deriveFileKinds({ keysByFile: kbf, worldWriters, momentKinds, stateKeys, allFiles }) {
  const kinds = new Set(momentKinds);
  const state = new Set(stateKeys);
  const out = new Map();
  for (const file of new Set([...allFiles, ...kbf.keys(), ...Object.keys(worldWriters)])) {
    const keys = kbf.get(file) ?? new Set();
    const pin = worldWriters[file];
    const row = {
      writes: new Set([...keys].filter(k => kinds.has(k))),
      pinned: new Set(Array.isArray(pin) ? pin.filter(k => kinds.has(k)) : []),
      state: new Set([...keys].filter(k => state.has(k))),
      reason: null
    };
    if (!row.writes.size && !row.pinned.size) {
      row.reason = (typeof pin === "string") ? pin
        : row.state.size ? `writes only state keys (${[...row.state].sort().join(", ")}) — no resolve`
        : "writes no flag key and pins no world write — it acts only through its callers (a view, a reader, a pure decision)";
    }
    out.set(file, row);
  }
  return out;
}

/** Every kind a file can publish — its own records and its pins, one set. */
export const kindsWrittenBy = (fileKinds, file) => {
  const row = fileKinds.get(file);
  return row ? new Set([...row.writes, ...row.pinned]) : new Set();
};

/**
 * The kinds exactly ONE file writes — the only kinds that ATTRIBUTE a publication to a file.
 * ⚠ Direct writes only, never pins: a pinned receipt is written by a service many files call.
 * @returns {Map<string, string>} kind → its sole writer
 */
export function soleWriters(fileKinds) {
  const by = new Map();
  for (const [file, row] of fileKinds) {
    for (const k of row.writes) by.set(k, [...(by.get(k) ?? []), file]);
  }
  return new Map([...by].filter(([, fs]) => fs.length === 1).map(([k, fs]) => [k, fs[0]]));
}

/* --- 2. the tag → suite table */

/**
 * Suites that can never leave a ledger, and why. Checked both ways by `tagTable`: a row whose
 * script gains a harness connect is stale and says so.
 */
export const NO_LEDGER = new Map([
  ["smoke-nogm", "connects its GM and player clients as bare `Foundry`s, never through connectSuite "
    + "(it must find NO active GM) — the ledgers are never armed, so its claims are NOT MEASURED by construction"]
]);

/**
 * Join the battery's order, the tags the scripts connect under, and the ledgers on disk.
 * @param {{ order: Array<{name: string, reset?: boolean}>, tags: Map<string, string>,
 *   ledgerTags: Iterable<string> }} input  `tags` is script name → the tag its connectSuite uses
 * @returns {{ suiteToTag: Map<string, string|null>, tagToScript: Map<string, string>, problems: string[], notSuites: string[] }}
 */
export function tagTable({ order, tags, ledgerTags }) {
  const problems = [];
  const tagToScript = new Map();
  for (const [script, tag] of tags) {
    if (tagToScript.has(tag)) problems.push(`tag "${tag}" is used by both ${tagToScript.get(tag)} and ${script} — their ledgers overwrite each other`);
    else tagToScript.set(tag, script);
  }
  const suiteToTag = new Map();
  for (const s of order.filter(o => !o.reset)) {
    if (tags.has(s.name)) {
      suiteToTag.set(s.name, tags.get(s.name));
      if (NO_LEDGER.has(s.name)) problems.push(`STALE PIN: NO_LEDGER lists ${s.name}, and it now connects through the harness as "${tags.get(s.name)}" — delete the row`);
    } else if (NO_LEDGER.has(s.name)) suiteToTag.set(s.name, null);
    else problems.push(`${s.name} is in the battery and connects under no tag this table can read — its ledger cannot be matched to it`);
  }
  for (const name of NO_LEDGER.keys()) {
    if (!order.some(o => o.name === name)) problems.push(`STALE PIN: NO_LEDGER lists ${name}, which is not in the battery — delete the row`);
  }
  const suites = new Set(suiteToTag.values());
  const notSuites = [];
  for (const tag of ledgerTags) {
    if (suites.has(tag)) continue;
    const script = tagToScript.get(tag);
    if (!script) problems.push(`ledger "${tag}" matches no script's connect tag — a renamed tag, or a script this table cannot read`);
    else notSuites.push(`${tag} (${script})`);
  }
  return { suiteToTag, tagToScript, problems, notSuites };
}

/* --- 3. the classification */

/**
 * Every claim, classified; every attributable publication nobody claimed.
 * @param {{ coverage: Map<string, string[]>, suiteToTag: Map<string, string|null>,
 *   moments: Map<string, Record<string, number>>, fileKinds: ReturnType<typeof deriveFileKinds>,
 *   sole: Map<string, string> }} input
 *   `moments` is tag → { kind: count } for every ledger that HAS a moment half; a tag absent from it
 *   is NOT MEASURED, and an empty object is measured-and-silent.
 */
export function classifyClaims({ coverage, suiteToTag, moments, fileKinds, sole }) {
  const rows = [];
  const unclaimed = [];
  const notMeasured = [];
  const unknownSuites = [];
  for (const [suite, claims] of coverage) {
    if (!suiteToTag.has(suite)) unknownSuites.push(suite);
    const tag = suiteToTag.get(suite) ?? null;
    const published = (tag !== null) ? moments.get(tag) : undefined;
    if (!published) notMeasured.push(suite);
    for (const file of claims) {
      const row = fileKinds.get(file);
      if (!row) { rows.push({ suite, file, status: "NO SUCH FILE", via: [], reason: `scripts/${file} does not exist` }); continue; }
      const kinds = kindsWrittenBy(fileKinds, file);
      if (!kinds.size) { rows.push({ suite, file, status: "UNPROVABLE-BY-MOMENTS", via: [], reason: row.reason }); continue; }
      if (!published) { rows.push({ suite, file, status: "NOT MEASURED", via: [], reason: null }); continue; }
      const via = [...kinds].filter(k => (published[k] ?? 0) > 0).sort();
      const own = via.filter(k => sole.get(k) === file);
      rows.push({
        suite, file, via, reason: null,
        status: own.length ? "PROVEN" : via.length ? "PROVEN (shared kind)" : "UNPROVEN",
        ...(via.length ? {} : { expected: [...kinds].sort() })
      });
    }
  }
  // The other direction: a publication only one file can have made, in a suite that never claimed it.
  for (const [suite, tag] of suiteToTag) {
    const published = (tag !== null) ? moments.get(tag) : undefined;
    if (!published) continue;
    const claims = new Set(coverage.get(suite) ?? []);
    const byFile = new Map();
    for (const [kind, n] of Object.entries(published)) {
      const file = sole.get(kind);
      if (!file || !(n > 0) || claims.has(file)) continue;
      byFile.set(file, [...(byFile.get(file) ?? []), `${kind}×${n}`]);
    }
    for (const [file, kinds] of byFile) unclaimed.push({ suite, file, kinds: kinds.sort() });
  }
  return { rows, unclaimed, notMeasured, unknownSuites };
}

/* --- the loaders: the tree, read */

/** Every scripts/-relative .js path. */
function scriptFiles(dir = SCRIPTS, prefix = "") {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) out.push(...scriptFiles(join(dir, ent.name), `${prefix}${ent.name}/`));
    else if (ent.name.endsWith(".js")) out.push(`${prefix}${ent.name}`);
  }
  return out;
}

/** The real tree's file → kinds table (the scan and the pins, through `deriveFileKinds`). */
export function loadFileKinds() {
  return deriveFileKinds({
    keysByFile: keysByFile(), worldWriters: WORLD_WRITERS, momentKinds: MOMENT_KINDS,
    stateKeys: Object.keys(STATE_KEYS), allFiles: scriptFiles()
  });
}

/**
 * Script name → the tag its `connectSuite` uses, read from each tools/*.mjs source (`tag: 'x'` or
 * `tag: TAG` through its own `const TAG = "x"`). Read, not listed: a hand table drifts on a rename.
 */
export function loadSuiteTags(dir = TOOLS) {
  const tags = new Map();
  for (const name of readdirSync(dir).filter(n => n.endsWith(".mjs"))) {
    const src = readFileSync(join(dir, name), "utf8");
    const m = /connectSuite\(\s*\{\s*tag:\s*(?:(['"])([^'"]+)\1|([A-Z_]+))/.exec(src);
    if (!m) continue;
    let tag = m[2];
    if (!tag && m[3]) tag = new RegExp(`const\\s+${m[3]}\\s*=\\s*(['"])([^'"]+)\\1`).exec(src)?.[2];
    if (tag) tags.set(basename(name, ".mjs"), tag);
  }
  return tags;
}

/**
 * The battery's order, `[{ name, reset }]` — coverage-map.mjs's exported ORDER.
 * ⚠ The fallback reads battery.mjs's SOURCE TEXT (battery.mjs runs when imported), so a coverage
 * map that fails to import mid-edit does not also cost the tag table.
 */
export async function loadOrder(dir = TOOLS) {
  try {
    const { ORDER } = await import("./coverage-map.mjs");
    if (Array.isArray(ORDER) && ORDER.length) return ORDER;
  } catch { /* fall through to the text */ }
  const src = readFileSync(join(dir, "battery.mjs"), "utf8");
  const start = src.indexOf("const ORDER = [");
  if (start < 0) return [];
  const body = src.slice(start, src.indexOf("\n];", start));
  return [...body.matchAll(/^\s*\{\s*name:\s*"([^"]+)"[^\n]*$/gm)]
    .map(m => ({ name: m[1], reset: /\breset:\s*true\b/.test(m[0]) }));
}
