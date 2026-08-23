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
import { LIST_SPECS, VOLLEY_KINDS, parseList } from "../scripts/decide/registry.js";

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
// ✅ VOLLEY_KINDS is IMPORTED (Phase 3), not re-declared. It used to be a lookalike defined
// right here — so this check could agree with itself while disagreeing with the shipping
// registry, the exact defect Phase 2 removed for the maneuver kinds and left standing here.

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

// The strict-parse contract (ARCHITECTURE.md §6): unknown kinds are dropped with a warning
// and never defaulted, EXCEPT where a spec declares a fallback. A default that does not
// survive its own parser ships a feature that silently does nothing for every fresh world.
//
// ✅ The REAL parser and the REAL defaults, both imported (Phase 2 stage 2, then Phase 3).
// This block used to regex the kind set out of maneuvers.js and re-implement the parse with a
// lookalike; even after that it still scraped the DEFAULT strings out of settings.js source,
// which it flagged in its own comment as "a heuristic, and a fragile one". It was — the regex
// ended a double-quoted default at the apostrophe in "Stone's Endurance", so it silently
// checked two thirds of the interrupt list and called it a pass. Nothing guesses here now.

/** Brace-match one register block out of settings.js source, so a long hint cannot truncate it. */
const registerBlockFor = key => {
  const at = settingsSrc.indexOf(`register(MODULE_ID, S.${key},`);
  if (at < 0) return null;
  const i = settingsSrc.indexOf("{", at);
  let depth = 0;
  for (let j = i; j < settingsSrc.length; j++) {
    if (settingsSrc[j] === "{") depth++;
    else if (settingsSrc[j] === "}" && --depth === 0) return settingsSrc.slice(i, j + 1);
  }
  return null;
};

for (const [key, spec] of Object.entries(LIST_SPECS)) {
  // 4a. The spec names an S key, and that key is real. A spec pointing at a setting nobody
  //     registers reads `undefined` forever and the list is silently empty.
  if (!sKeys.has(spec.setting)) {
    fail(`spec ${key}`, `names setting "${spec.setting}", which is not a key in S`);
    continue;
  }

  // 4b. settings.js registers THAT default, not a re-inlined copy. Moving the defaults into
  //     the specs created this drift class, so it is closed in the same commit: two strings
  //     that must agree are one string, and this proves nobody quietly forked them again.
  const block = registerBlockFor(spec.setting);
  if (!block) fail(`registration for ${spec.setting}`, "not found in settings.js");
  else if (!block.includes(`LIST_SPECS.${key}.default`)) {
    fail(`registration for ${spec.setting}`,
      `does not register LIST_SPECS.${key}.default — a re-inlined default drifts from the one the gate checks`);
  }

  // 4c. The shipped default survives its own parser, with nothing dropped or defaulted.
  const { entries, rejects } = parseList(spec, spec.default);
  if (rejects.length) {
    fail(`default for ${spec.setting}`,
      `entries its own parser rejects: ${rejects.map(r => `${r.chunk} (${r.action}: ${r.detail})`).join(" | ")}`);
  } else if (!entries.length) {
    fail(`default for ${spec.setting}`, "empty — the feature ships inert");
  } else {
    pass(`${spec.setting}: registered from its spec, default parses clean (${entries.length} entries)`);
  }
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
