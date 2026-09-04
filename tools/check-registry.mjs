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
//   5. THE SOURCE-FILE COUNT — the last hand-carried number in this tree. It has been wrong
//      twice (published as 20, then 26, while the truth was neither), because every doc that
//      quotes it copies the previous doc. Asserted here so the docs have something to be wrong
//      ABOUT, and so adding a file is a deliberate one-line change rather than a slow drift.
//   6. THE R4 TRIPWIRE (DESIGN.md R4): the kinds the code knows are printed as a table and
//      their total is PINNED. Adding a kind fails this check until someone changes the pin on
//      purpose — which is the whole point. R4's abandonment condition is "new kinds arriving
//      faster than one per phase"; it was unmeasurable until the count existed, so it could
//      never fire. This is not a rule against new kinds. It is a rule against unnoticed ones.
//
//   node tools/check-registry.mjs
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { KIND_SETS, LIST_SPECS, MASTERY_KINDS, VOLLEY_KINDS, parseList } from "../scripts/decide/registry.js";

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

/* --- 5: the R4 tripwire ---------------------------------------------------------------- */

// ⚠ THE PIN. Bump it DELIBERATELY, in the commit that adds the kind, and say in that commit
// why the kind was genuinely new (ARCHITECTURE.md §11 step 3). If you are bumping this more
// than once a phase, that is the tripwire firing — stop adding kinds and re-read DESIGN.md R4.
// v1.23.0: 16 → 19, and the three are ONE feature pass, not three separate arrivals — the
// d20Fold set (heroic · tactical · bardic). They earn kinds because they genuinely differ in
// what they SPEND (a boolean write, an activity use(), an effect delete) and in where the die
// comes from; the arithmetic they share was already built by D8 and needed no new kind at all.
// ⚠ That is the tripwire behaving, not firing: one pass, one bump, and the reason is that the
// mechanism was lifted out FIRST and the kinds only name the residue.
// 2026-09-01: 19 → 23, the `reminder` set — vex, sap, prone, condition: four distinct ways the
// gate can READ a source of Advantage/Disadvantage before an attack roll (HANDOFF Stage 2 + 3).
// One new MECHANISM (the gate), four kinds naming what it reads; WHICH conditions count under
// the fourth is the Condition Sources list — thirteen rows of data, not thirteen kinds.
// 2026-09-02: 23 → 24, `range` joins the reminder set (user ask): a RANGED attack roll's own
// geometry — beyond normal range, beyond long range, an enemy within 5 feet — is a fifth way of
// KNOWING, read off the activity's range and the same distance Prone already measures. Same
// mechanism, one more kind; the two glossary sentences are data (RANGE_RULES).
// 2026-09-02 (later): 24 → 25, `effect` joins the reminder set (user: "I like effect sources"):
// an ability on either SHEET — an active effect or a feature, by name — is a sixth way of
// knowing. WHICH abilities is the Effect Sources list over EFFECT_BENDS, membership like the
// condition table: seventy-odd rows of data found by a compendium scan, not seventy kinds.
// 2026-09-02 (later still): 25 → 26, `sneak` joins the reminder set (user: the prototype "Sneak
// Attack, Cunningly", built as drawn): the gate offers a CHOICE beside the roll when the Sneak
// Attack feature is on the sheet and the weapon qualifies — a seventh way of knowing, and the
// first that asks rather than tells. WHAT it offers after the hit is CUNNING_OPTIONS, rows of data
// read off the sheet, not kinds.
const EXPECTED_KINDS = 28;   // emanation: feature · spell joined 2026-09-03

// The mastery set must match the rule text it is presented with: a mastery this module
// resolves but cannot quote breaks presentation law 8 (ARCHITECTURE.md §5) at the popup.
const rulesSrc = read("scripts/decide/registry.js");
const rulesBlock = /export const MASTERY_RULES = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(rulesSrc);
const ruleKeys = new Set([...(rulesBlock?.[1] ?? "").matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]));
const unquoted = [...MASTERY_KINDS].filter(k => !ruleKeys.has(k));
const unresolved = [...ruleKeys].filter(k => !MASTERY_KINDS.has(k));
if (unquoted.length) fail("mastery kinds", `resolved but with no rule text to quote: ${unquoted.join(", ")}`);
else if (unresolved.length) fail("mastery kinds", `rule text for a mastery nothing resolves: ${unresolved.join(", ")}`);
else pass(`all ${MASTERY_KINDS.size} mastery kinds carry their own rule text`);

let kindTotal = 0;
const rows = KIND_SETS.map(set => {
  kindTotal += set.kinds.size;
  return [set.name, String(set.kinds.size), set.system ? `of ${set.system} (system)` : "module-owned",
    [...set.kinds].join(" · ")];
});

/* --- the source-file count, pinned ------------------------------------------------------ */

// ⚠ 28 is `scripts/*.js` + `scripts/decide/*.js`, and it is quoted by name in ARCHITECTURE.md,
// HANDOFF.md and check-comments' own output. Bump it deliberately when a file is added, the
// same way EXPECTED_KINDS moves — the refusal is the feature.
// v1.23.0: 27 → 28, for scripts/d20-folds.js. It is a MACHINE and it earns its own file rather
// than joining maneuvers.js: these are not maneuvers, they draw on no superiority pool, and two
// of the three have no activity at all. Filing them under "maneuver" would have made the folds
// list mean two different things.
// 2026-08-27: 28 → 29, for scripts/stats.js — the data plane's own edge (rollCtx + the combat
// roster). It earns its own file rather than joining a machine: the stamps are UNGATED context
// no feature owns, and filing them inside a setting-gated machine would invite gating them.
// 2026-09-01: 29 → 30, for scripts/decide/chips.js — the DECISION half of chip expiry: the RAW
// windows as v14 duration data, and which attack roll spends which chip. Pure, unit-pinned, and
// deliberately its own file: receipt.js is about what a card RECORDS, this is about what a chip
// IS, and the two would otherwise grow into each other.
// 2026-09-01 (later the same day): 30 → 31, for scripts/decide/reminders.js — the gate's
// arithmetic: what bends an attack roll and what it nets to (the user's ruling: any Advantage
// against any Disadvantage is a normal roll, however many of each). Its own file because the
// net rule is about ROLLS, not chips, and Prone reads a status, not a chip.
// 2026-09-01 (Stage 2): 31 → 32, for scripts/reminders.js — the gate is its own MACHINE. It
// reads mastery's chips (through decide/chips.js's fingerprint, never a sideways import) and
// the system's statuses, and it intercepts a system roll — none of which is the mastery
// machine's job. MASTERY_RULES moved down to decide/registry.js the same day so both can quote it.
// 2026-09-02: 32 → 34, for scripts/sneak.js (a MACHINE: Sneak Attack's rider, effects and
// chit — its own feature, not a mastery and not a mark) and scripts/decide/sneak.js (its
// pure half: the dice, the menu read off the sheet, the costs before the roll).
// 2026-09-02 (later): 34 → 36, for scripts/clock-riders.js (a MACHINE: the clock's extra damage
// on a hit — its own feature beside the marks) and scripts/decide/clock.js (its pure half:
// is the rider due, and the part's formula as the pack wrote it).
// 2026-09-02 (the walk): 36 → 37, for scripts/use-chips.js — a feature the pack ships as text
// alone becomes a chip on use, so the gate can read it and the roll can spend it (Steady Aim).
const EXPECTED_SOURCE_FILES = 41;   // hit-menu.js + decide/hit-menu.js joined 2026-09-04
const sourceFiles = [
  ...readdirSync(join(ROOT, "scripts")).filter(f => f.endsWith(".js")),
  ...readdirSync(join(ROOT, "scripts/decide")).filter(f => f.endsWith(".js")).map(f => `decide/${f}`)
];
if (sourceFiles.length !== EXPECTED_SOURCE_FILES) {
  fail("source-file count", `scripts/ holds ${sourceFiles.length} modules, the pin says `
    + `${EXPECTED_SOURCE_FILES} — if a file was added or removed on purpose, move `
    + "EXPECTED_SOURCE_FILES in this file and fix every doc that quotes the old number");
} else {
  pass(`source-file count: ${sourceFiles.length} modules under scripts/, matching the pin`);
}

if (kindTotal !== EXPECTED_KINDS) {
  fail("R4 tripwire", `the code knows ${kindTotal} kinds, the pin says ${EXPECTED_KINDS} — `
    + "if a kind was added on purpose, bump EXPECTED_KINDS in this file and say why in the commit");
} else {
  pass(`R4 tripwire: ${kindTotal} kinds across ${KIND_SETS.length} sets, matching the pin`);
}

/* --- report ---------------------------------------------------------------------------- */

for (const p of passes) console.log(`PASS ${p}`);

// The R4 table itself — printed every run, so the number is in front of whoever changed it.
console.log("\nKINDS THE CODE KNOWS (DESIGN.md R4 — the tripwire)");
const w = Math.max(...rows.map(r => r[0].length));
for (const [name, n, origin, kinds] of rows) {
  console.log(`  ${name.padEnd(w)}  ${n.padStart(2)}  ${origin.padEnd(14)}  ${kinds}`);
}
console.log(`  ${"".padEnd(w)}  ${String(kindTotal).padStart(2)}  total, pinned at ${EXPECTED_KINDS}`);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} integrity failure(s).`);
  process.exit(1);
}
console.log(`\n${passes.length} checks passed.`);
