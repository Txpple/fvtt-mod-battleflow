// STATIC REGISTRY + SETTINGS INTEGRITY CHECK — no Foundry, no world, milliseconds.
//
// The companion to check-hook-order.mjs. Both load the module graph with stubbed globals and
// assert structural facts that today are only discovered at the table.
//
// What it asserts (ARCHITECTURE.md §6, §8):
//   1. Every key in the `S` map is actually registered in settings.js — a key in `S` that
//      nothing registers means `setting(S.foo)` throws at runtime, on whichever client hits
//      it first.
//   2. Every setting registered in settings.js is in `S` — a registered key nobody can name
//      is a setting the code cannot read.
//   3. Every registry entry declares a `kind` from that registry's closed set, and carries no
//      amount (R4: mechanisms in code, membership in data, amounts in CONTENT).
//   4. Every list-setting DEFAULT parses clean under its own strict parser — a typo in a
//      shipped default silently disables the feature for every fresh world, and today that is
//      discovered by a player.
//
//   node tools/check-registry.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(join(ROOT, p), "utf8");

const failures = [];
const passes = [];
const fail = (what, detail) => failures.push(`${what} — ${detail}`);
const pass = what => passes.push(what);

/* --- 1 + 2: the S map and the registrations agree ------------------------------------- */

const coreSrc = read("scripts/core.js");
const settingsSrc = read("scripts/settings.js");

const sBlock = /export const S = \{([\s\S]*?)\n\};/.exec(coreSrc);
if (!sBlock) fail("S map", "could not locate `export const S = {…}` in scripts/core.js");

const sKeys = new Set([...(sBlock?.[1] ?? "").matchAll(/^\s*(\w+)\s*:/gm)].map(m => m[1]));
const registered = new Set([...settingsSrc.matchAll(/register\(MODULE_ID,\s*S\.(\w+)/g)].map(m => m[1]));

const unregistered = [...sKeys].filter(k => !registered.has(k));
const unnamed = [...registered].filter(k => !sKeys.has(k));

if (unregistered.length) fail("S keys never registered", unregistered.join(", "));
else pass(`all ${sKeys.size} keys in S are registered`);

if (unnamed.length) fail("registered keys missing from S", unnamed.join(", "));
else pass(`all ${registered.size} registrations are named in S`);

// A registration whose key is a bare string rather than `S.foo` bypasses the map entirely.
const literalRegs = [...settingsSrc.matchAll(/register\(MODULE_ID,\s*["'](\w+)["']/g)].map(m => m[1]);
if (literalRegs.length) fail("settings registered by string literal, not through S", literalRegs.join(", "));
else pass("no setting is registered by string literal");

/* --- 3: registry entries are well-formed ---------------------------------------------- */

const volleySrc = read("scripts/volley-registry.js");
const VOLLEY_KINDS = new Set(["damage", "attack"]);

const entries = [...volleySrc.matchAll(/\[\s*"([^"]+)"\s*,\s*\{([^}]*)\}\s*\]/g)];
if (!entries.length) fail("volley registry", "no entries parsed — did the shape change?");
for (const [, name, body] of entries) {
  const kind = /kind:\s*"(\w+)"/.exec(body)?.[1];
  if (!kind) fail(`volley entry "${name}"`, "declares no kind");
  else if (!VOLLEY_KINDS.has(kind)) fail(`volley entry "${name}"`, `unknown kind "${kind}"`);
  // R4: an entry may carry a formula or a resolver, never a transcribed amount.
  if (/\bdamage:\s*["'\d]/.test(body)) fail(`volley entry "${name}"`, "carries a damage amount — amounts live in CONTENT (DESIGN N1)");
}
if (entries.length && !failures.some(f => f.startsWith("volley entry"))) {
  pass(`all ${entries.length} volley registry entries declare a known kind and no amounts`);
}

/* --- 4: shipped list-setting defaults parse clean -------------------------------------- */

// The strict-parse contract (ARCHITECTURE.md §6): `Name:kind` pairs, comma separated, unknown
// kinds DROPPED WITH A WARNING and never defaulted. A default that does not survive its own
// parser ships a feature that silently does nothing.
const MANEUVER_KINDS = new Set(
  [...read("scripts/maneuvers.js").matchAll(/MANEUVER_KINDS\s*=\s*new Set\(\[([^\]]*)\]/g)]
    .flatMap(m => [...m[1].matchAll(/"(\w+)"/g)].map(x => x[1]))
);

// ⚠ Reading defaults out of source is a heuristic, and a fragile one — the register blocks
// carry long hints and multi-line `"a" + "b"` concatenations. It is the price of a check that
// needs no Foundry. PLAN.md Phase 2 makes the defaults importable data, at which point this
// stops guessing and starts reading.
const registerBlockFor = key => {
  const at = settingsSrc.indexOf(`register(MODULE_ID, S.${key},`);
  if (at < 0) return null;
  // Brace-match from the options object so a long hint cannot truncate the search window.
  let i = settingsSrc.indexOf("{", at);
  let depth = 0;
  for (let j = i; j < settingsSrc.length; j++) {
    if (settingsSrc[j] === "{") depth++;
    else if (settingsSrc[j] === "}" && --depth === 0) return settingsSrc.slice(i, j + 1);
  }
  return null;
};

const defaultOf = key => {
  const block = registerBlockFor(key);
  if (!block) return null;
  const at = block.search(/\bdefault:\s*["']/);
  if (at < 0) return null;
  // Join adjacent string literals: `default: "a, " + "b" + "c"`.
  const tail = block.slice(at);
  const parts = [...tail.matchAll(/(?:^\s*default:\s*|\+\s*)["']([^"']*)["']/gm)].map(m => m[1]);
  return parts.length ? parts.join("") : null;
};

const kindedLists = [{ key: "maneuverFolds", kinds: MANEUVER_KINDS }];
for (const { key, kinds } of kindedLists) {
  const raw = defaultOf(key);
  if (raw === null) { fail(`default for ${key}`, "not found in settings.js"); continue; }
  if (!kinds.size) { fail(`kind set for ${key}`, "parsed empty — did the shape change?"); continue; }
  const bad = raw.split(",").map(s => s.trim()).filter(Boolean)
    .map(chunk => chunk.split(":").map(s => s?.trim()))
    .filter(([name, kind]) => !name || !kinds.has(String(kind).toLowerCase()))
    .map(p => p.join(":"));
  if (bad.length) fail(`default for ${key}`, `entries its own parser drops: ${bad.join(" | ")}`);
  else pass(`default for ${key} parses clean (${raw.split(",").length} entries)`);
}

// Plain `Name:value` lists have their own shapes; assert only that they are non-empty and
// comma-parseable, which is what a shipped default has to be to do anything at all.
for (const key of ["interruptList", "blockList", "riderList", "riderUpgrades"]) {
  const raw = defaultOf(key);
  if (raw === null) { fail(`default for ${key}`, "not found in settings.js"); continue; }
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) fail(`default for ${key}`, "empty — the feature ships inert");
  else pass(`default for ${key} parses to ${parts.length} entries`);
}

/* --- report ---------------------------------------------------------------------------- */

for (const p of passes) console.log(`PASS ${p}`);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} integrity failure(s).`);
  process.exit(1);
}
console.log(`\n${passes.length} checks passed.`);
