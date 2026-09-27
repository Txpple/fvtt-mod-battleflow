// STATIC MOMENT-COVERAGE CHECK — no Foundry, no world, milliseconds.
//
// The moment gate's third part (decide/moments.js the registry, events.js the publisher): the
// thing that FAILS when a key is missing from the registry.
//   1. Every flag key the module writes is classified exactly once: `MOMENT_RECORDS` (a resolve,
//      published) or `STATE_KEYS` (state, with a reason). The scan covers `setFlag`,
//      `queueFlagWrite`, `flags.${MODULE_ID}.key` paths and `[MODULE_ID]: { … }` literals, with
//      `[CONST]` keys resolved through the tree's own declarations. Reads are not scanned.
//   2. No stale row: a listed key nothing writes fails.
//   3. Every file that writes the WORLD is pinned in `WORLD_WRITERS` (tools/moment-writers.mjs)
//      with its record(s) or a reason: a resolve landing only on an actor or item is invisible to a
//      gate that watches messages. An unpinned writer fails; a pin on a file that writes nothing fails.
//   4. The registry's own shape: words in the vocabulary, every row says what it means, every
//      state reason a sentence (≥ 20 characters).
// It prints the classification as a table.
//
//   node tools/check-moments.mjs
import { MOMENT_RECORDS, MOMENT_WORDS, STATE_KEYS } from "../scripts/decide/moments.js";
import { files, WORLD_WRITERS, writers, writes } from "./moment-writers.mjs";

const failures = [];
const passes = [];
const fail = (what, detail) => failures.push(`${what} — ${detail}`);
const pass = what => passes.push(what);

/* --- 1 + 2: every written key classified once; no stale row */

const resolveKeys = new Set(Object.keys(MOMENT_RECORDS));
const stateKeys = new Set(Object.keys(STATE_KEYS));
const written = [...writes.keys()].sort();

const unclassified = written.filter(k => !resolveKeys.has(k) && !stateKeys.has(k));
if (unclassified.length) {
  for (const k of unclassified) {
    fail("unclassified key", `"${k}" is written (${[...writes.get(k)].slice(0, 3).join(", ")}) and is in neither MOMENT_RECORDS nor STATE_KEYS `
      + "(scripts/decide/moments.js) — is it a RESOLVE (add a row: what it means, what it publishes, its markers) or STATE (add a reason)?");
  }
} else pass(`every one of the ${written.length} written keys is classified`);

const both = [...resolveKeys].filter(k => stateKeys.has(k));
if (both.length) fail("key in both lists", both.join(", "));
else pass("no key is both a resolve and state");

for (const k of resolveKeys) if (!writes.has(k)) fail("stale row", `MOMENT_RECORDS."${k}" — nothing writes that key any more; remove the row`);
for (const k of stateKeys) if (!writes.has(k)) fail("stale row", `STATE_KEYS."${k}" — nothing writes that key any more; remove the row`);
if (!failures.some(f => f.startsWith("stale row"))) pass("no stale row in either list");

/* --- 3: every world-writing file pinned */

for (const rel of writers) {
  if (!(rel in WORLD_WRITERS)) {
    fail("unpinned world writer", `scripts/${rel} writes the world (a document update, create, delete or use) and is not in WORLD_WRITERS `
      + "(tools/moment-writers.mjs) — which message record carries its resolve? Pin the key(s), or the reason none does");
    continue;
  }
  const pin = WORLD_WRITERS[rel];
  if (Array.isArray(pin)) {
    for (const k of pin) {
      if (!resolveKeys.has(k)) fail("bad pin", `WORLD_WRITERS["${rel}"] names "${k}", which is not a MOMENT_RECORDS row`);
    }
  } else if (typeof pin !== "string" || pin.length < 20) fail("bad pin", `WORLD_WRITERS["${rel}"] needs record keys or a reason of a sentence`);
}
for (const rel of Object.keys(WORLD_WRITERS)) {
  if (!files.some(f => f.rel === rel)) fail("stale pin", `WORLD_WRITERS["${rel}"] — no such file`);
  else if (!writers.includes(rel) && Array.isArray(WORLD_WRITERS[rel])) fail("stale pin", `WORLD_WRITERS["${rel}"] — the file writes the world no more; remove the row`);
}
if (!failures.some(f => /world writer|pin/.test(f))) pass(`every one of the ${writers.length} world-writing files is pinned to its record(s)`);

/* --- 4: the registry's own shape */

for (const [k, row] of Object.entries(MOMENT_RECORDS)) {
  if (!Array.isArray(row.events) || !row.events.length) fail("row shape", `MOMENT_RECORDS."${k}" publishes under no word`);
  for (const w of row.events ?? []) if (!MOMENT_WORDS.includes(w)) fail("row shape", `MOMENT_RECORDS."${k}" publishes under "${w}", not in the vocabulary`);
  if (typeof row.means !== "string" || row.means.length < 20) fail("row shape", `MOMENT_RECORDS."${k}" does not say what resolving means`);
  if (typeof row.resolved !== "function") fail("row shape", `MOMENT_RECORDS."${k}" has no resolved()`);
}
for (const [k, why] of Object.entries(STATE_KEYS)) {
  if (typeof why !== "string" || why.length < 20) fail("state reason", `STATE_KEYS."${k}" — a reason is a sentence somebody will read`);
}
if (!failures.some(f => /row shape|state reason/.test(f))) pass(`${resolveKeys.size} resolve rows and ${stateKeys.size} state reasons are well-formed`);

/* --- the report */

console.log("MOMENT COVERAGE — every flag key the module writes, classified\n");
const w = Math.max(...written.map(k => k.length), 8);
console.log(`  ${"key".padEnd(w)}  ${"class".padEnd(8)}  words / reason`);
for (const k of written) {
  const cls = resolveKeys.has(k) ? "RESOLVE" : stateKeys.has(k) ? "state" : "??";
  const what = resolveKeys.has(k) ? MOMENT_RECORDS[k].events.join(", ") : (STATE_KEYS[k] ?? "UNCLASSIFIED").slice(0, 70);
  console.log(`  ${k.padEnd(w)}  ${cls.padEnd(8)}  ${what}`);
}
console.log(`\n  ${written.length} keys: ${written.filter(k => resolveKeys.has(k)).length} resolves, ${written.filter(k => stateKeys.has(k)).length} state, `
  + `${unclassified.length} unclassified · ${MOMENT_WORDS.length} words · ${writers.length} world-writing files\n`);

for (const p of passes) console.log(`  PASS  ${p}`);
if (failures.length) {
  console.log("");
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log("\nALL PASS");
