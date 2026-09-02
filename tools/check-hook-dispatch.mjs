// STATIC HOOK-DISPATCH CHECK — no Foundry, no world, milliseconds.
//
// Every `dnd5e.*` hook this module registers must be a hook dnd5e ACTUALLY DISPATCHES.
//
// WHY (ARCHITECTURE.md §10 D10, and it cost a table session): a hook name the system never
// dispatches registers cleanly, throws nothing, logs nothing, and does nothing FOREVER.
// `Hooks.on("dnd5e.rollAbilityCheckV2", …)` is not an error in any layer of the stack — it is a
// listener on a channel with no speaker. v1.23.0 shipped exactly that: `rollAbilityCheckV2` and
// `rollToolV2` do not exist, so FOUR OF SIX d20-fold offer paths were dead while
// `smoke-d20-folds` reported 12/12 green over them. Nothing in the gate could see it —
// `check-imports` proves bindings resolve, `check-layers` proves direction, and neither reads a
// string literal into the system's source. **This is the check for the failure class that had
// no rule against it.**
//
// ⚠ THE LIST IS GENERATED, NOT CURATED, AND THAT IS THE WHOLE DESIGN. D10 sat open because
// "a curated list of dnd5e's hooks" needs an owner who keeps it true across every system
// release, and nobody had volunteered. Measured 2026-08-23, that owner turns out to be
// unnecessary: **dnd5e declares its own hooks in its own shipped bundle**, two ways, and the
// union of them covers this module's surface.
//
//   dnd5e 5.3.3, from `systems/dnd5e/dnd5e.mjs` — and these are the tool's own numbers, printed
//   by `--regen`, not hand-carried (the count this repo has got wrong three times):
//     111 `Hooks.call`/`callAll` sites, 14 of them TEMPLATED → 88 `dnd5e.*` LITERAL names
//     92 JSDoc blocks tagged `@memberof hookEvents` → 92 declared names
//     union, restricted to `dnd5e.*`: 105
//
// ⚠ NEITHER SOURCE IS SUFFICIENT ALONE, and the reason is the exact family that bit. The roll
// hooks are dispatched from a template — ``Hooks.callAll(`dnd5e.roll${name}V2`, …)`` — so no
// literal exists for `rollAbilityCheck`; the JSDoc above that same call site is what names it.
// Conversely `rollAttackV2` is a literal with no `@memberof hookEvents` block. Take both.
//
// ⚠ AND THE UNION STILL HAS A HOLE, which is what the ALLOW list below is for: a templated
// dispatch whose JSDoc names only the non-V2 variant is invisible to both sources even though it
// fires. There is exactly one today. **A hole that is pinned with a reason is a known hole; the
// same hole unpinned is D10 all over again.**
//
// ⚠ SCOPE: `dnd5e.*` ONLY, and this is a MEASUREMENT, not an oversight. The same extraction was
// run against Foundry's own client bundle (`resources/app/public/scripts/foundry.mjs`,
// 7.9 MB, v14.365) and recovered **0 of the 15 core hook names this module registers** — core
// dispatches are built from computed names in minified code, with no JSDoc to fall back on. A
// core-hook check built on that would pass everything and prove nothing, which is the failure
// this file exists to prevent. Core hooks stay uncovered, deliberately and in writing.
//
// ⚠ WHY A COMMITTED ARTIFACT RATHER THAN READING THE INSTALL: the gate is offline and runs in
// seconds on any clone, and a check that silently SKIPS when no system is installed is the D10
// shape again. So the extraction is a deliberate act — `--regen` — and its output is committed
// and pinned to a version. Bump the dnd5e pin in `module.json` without regenerating and this
// check FAILS until somebody looks at the diff. That is the same discipline as the R4 kind pin
// and the source-file count pin: the pin is not an obstacle, it is the alarm.
//
//   node tools/check-hook-dispatch.mjs               # the check (gate: npm run dispatch)
//   node tools/check-hook-dispatch.mjs --regen       # re-extract from the installed dnd5e
//   node tools/check-hook-dispatch.mjs --regen <dir> # ...from a specific systems/dnd5e directory
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadRegistrations, groupByHook } from "./hook-registrations.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = join(ROOT, "tools", "dnd5e-hooks.json");

/* ---------------------------------------------------------------------------------------------
 * THE PINNED HOLES — a name this module registers that the generated set does not contain, and
 * that is nonetheless dispatched. Each row carries the evidence, because a row without one is
 * indistinguishable from the typo this file exists to catch.
 *
 * ⚠ STALE ROWS FAIL THE BUILD, both directions: a name that has since appeared in the generated
 * set, and a name nothing registers any more. `check-layers.mjs` learned this the expensive way
 * (ARCHITECTURE §10 D2) — a pin that only ever permits sits there forever, lying.
 * ------------------------------------------------------------------------------------------- */

const ALLOW = [
  {
    hook: "dnd5e.preRollDamageV2",
    // ⚠ the exact template is `dnd5e.preRoll` + hookName.capitalize() + `V2`; it is written out
    // in this file's header, and NOT quoted here, because a literal dollar-brace inside a string
    // is a biome warning and this repo carries a warning baseline rather than suppressions.
    why: "TEMPLATED-WITH-NARROW-JSDOC, the hole this list exists for. Dispatched from the "
      + "templated preRoll<HookName>V2 form in the roll pipeline, and the JSDoc block at "
      + "that site declares only the non-V2 `dnd5e.preRollDamage`. So neither source names it, "
      + "and it fires on every damage roll. ⚠ VERIFIED LIVE, not reasoned: four files register "
      + "it (hit-riders, mastery, maneuvers, volleys) and rider injection, mastery riders and "
      + "the volley multiplier are all table-proven and battery-covered — a dead registration "
      + "here would have taken the whole damage-rider surface with it"
  },
  {
    hook: "dnd5e.preRollAttackV2",
    why: "TEMPLATED, the same hole as its damage twin above: dispatched from the preRoll<HookName>V2 "
      + "form with hookNames [attack, d20Test] (dnd5e.mjs, AttackActivity#rollAttack), and named "
      + "by no JSDoc. ⚠ MEASURED LIVE 2026-09-01 (tools/probe-expiry.mjs, hookSurfaces): it fires "
      + "once per attack roll, before the roll dialog, with preRollD20TestV2 beside it. reminders.js "
      + "registers it for the gate (HANDOFF Stage 2), and smoke-reminders asserts it FIRED"
  },
  {
    hook: "dnd5e.preRollSavingThrowV2",
    why: "TEMPLATED, the third of the family: Actor5e##rollD20Test sets hookNames [SavingThrow, "
      + "d20Test] and buildConfigure dispatches preRoll<HookName>V2 for each (dnd5e.mjs, read "
      + "2026-09-02) — the JSDoc at that site names only the non-V2 dnd5e.preRollSavingThrow. "
      + "saves.js registers it for the save gate (option E: the demand opens the system's own "
      + "dialog, and the gate meets every save there), and smoke-saves asserts it FIRED"
  }
];

/* --- the generated set -------------------------------------------------------------------- */

/**
 * dnd5e's own declaration of the hooks it dispatches, out of its shipped bundle: the literal
 * `Hooks.call`/`callAll` names UNION the `@function` names inside every `@memberof hookEvents`
 * JSDoc block. Restricted to `dnd5e.*` — see the SCOPE note above.
 * @param {string} dir a `systems/dnd5e` directory
 */
function extract(dir) {
  const src = readFileSync(join(dir, "dnd5e.mjs"), "utf8");
  const version = JSON.parse(readFileSync(join(dir, "system.json"), "utf8")).version;

  let sites = 0;
  let templated = 0;
  const literal = new Set();
  for (const m of src.matchAll(/Hooks\.(?:call|callAll)\(\s*(["'`])((?:[^\\]|\\.)*?)\1/g)) {
    sites++;
    if (m[1] === "`" && m[2].includes("${")) templated++;
    else literal.add(m[2]);
  }
  const jsdoc = new Set();
  let blocks = 0;
  for (const b of src.matchAll(/\/\*\*(?:[^*]|\*(?!\/))*?@memberof hookEvents(?:[^*]|\*(?!\/))*?\*\//g)) {
    blocks++;
    for (const f of b[0].matchAll(/@function\s+([\w.]+)/g)) jsdoc.add(f[1]);
  }
  const dnd = n => n.startsWith("dnd5e.");
  const hooks = [...new Set([...literal, ...jsdoc])].filter(dnd).sort();
  return {
    version,
    hooks,
    extracted: {
      callSites: sites,
      templatedSites: templated,
      literalNames: [...literal].filter(dnd).length,
      jsdocBlocks: blocks,
      jsdocNames: [...jsdoc].filter(dnd).length
    }
  };
}

/* --- --regen ------------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
if (argv.includes("--regen")) {
  const explicit = argv[argv.indexOf("--regen") + 1];
  const dir = (explicit && !explicit.startsWith("--"))
    ? explicit
    : process.env.BF_DND5E_DIR
      || join(process.env.LOCALAPPDATA ?? "", "FoundryVTT", "Data", "systems", "dnd5e");

  let next;
  try {
    next = extract(dir);
  } catch (err) {
    console.error(`FAIL could not read a dnd5e install at ${dir}`);
    console.error(`     ${err.message}`);
    console.error("     Pass the directory explicitly, or set BF_DND5E_DIR.");
    process.exit(1);
  }

  let prev = { version: "(none)", hooks: [] };
  try { prev = JSON.parse(readFileSync(ARTIFACT, "utf8")); } catch { /* first run */ }

  const added = next.hooks.filter(h => !prev.hooks.includes(h));
  const removed = prev.hooks.filter(h => !next.hooks.includes(h));

  const artifact = {
    $comment: "GENERATED — do not hand-edit. node tools/check-hook-dispatch.mjs --regen",
    system: "dnd5e",
    version: next.version,
    source: "dnd5e.mjs: literal Hooks.call*/callAll names UNION @memberof hookEvents JSDoc",
    extracted: next.extracted,
    hooks: next.hooks
  };
  writeFileSync(ARTIFACT, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`REGENERATED tools/dnd5e-hooks.json from ${dir}`);
  console.log(`  dnd5e ${prev.version} -> ${next.version}`);
  console.log(`  ${next.extracted.callSites} call sites (${next.extracted.templatedSites} `
    + `templated) · ${next.extracted.literalNames} literal · ${next.extracted.jsdocNames} `
    + `JSDoc-declared · ${next.hooks.length} union`);
  console.log(`\n  ${added.length} added, ${removed.length} removed:`);
  for (const h of added) console.log(`    + ${h}`);
  for (const h of removed) console.log(`    - ${h}   ⚠ READ THIS ONE — anything registering it is now dead`);
  console.log("\n⚠ Now re-run the check, and update module.json's dnd5e `verified` pin to match.");
  process.exit(0);
}

/* --- the check ----------------------------------------------------------------------------- */

const failures = [];
const fail = (rule, msg) => failures.push(`${rule}: ${msg}`);

let artifact;
try {
  artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
} catch (err) {
  console.error(`FAIL artifact: tools/dnd5e-hooks.json is missing or unreadable — ${err.message}`);
  console.error("     Generate it: node tools/check-hook-dispatch.mjs --regen");
  process.exit(1);
}
const dispatched = new Set(artifact.hooks ?? []);

// (0) THE ARTIFACT ITSELF IS SANE. A truncated or empty list would bless every name in the tree
// and report a pass — the "checking apparatus that agrees with itself" failure this repo has
// already met once (PLAN.md Phase 3's lookalike VOLLEY_KINDS).
if (dispatched.size < 50) {
  fail("artifact", `only ${dispatched.size} hook names — dnd5e 5.3.3 yields 105. The artifact is `
    + "truncated or corrupt; regenerate it rather than trusting this run");
}

// (1) THE VERSION PIN. The artifact was extracted from ONE dnd5e version; module.json names the
// version this module is verified against. They must agree, or the check is answering about a
// system nobody is running.
const manifest = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8"));
const pinned = manifest.relationships?.systems
  ?.find(s => s.id === "dnd5e")?.compatibility?.verified;
if (pinned !== artifact.version) {
  fail("version pin", `module.json verifies dnd5e ${pinned}, the hook artifact was extracted `
    + `from ${artifact.version}. Re-extract against the version you are shipping against `
    + "(node tools/check-hook-dispatch.mjs --regen) and READ THE DIFF — a name that disappeared "
    + "is a registration that has gone silent");
}

// (2) EVERY REGISTERED `dnd5e.*` NAME IS DISPATCHED, or pinned with a reason. The rule.
const reg = await loadRegistrations();
const byHook = groupByHook(reg);
const registered = [...byHook.keys()].filter(h => h.startsWith("dnd5e."));
const pins = new Map(ALLOW.map(a => [a.hook, a]));
const usedPins = new Set();

for (const hook of registered) {
  if (dispatched.has(hook)) continue;
  if (pins.has(hook)) { usedPins.add(hook); continue; }
  fail("never dispatched", `${hook} is registered by ${byHook.get(hook).join(", ")}, and dnd5e `
    + `${artifact.version} never dispatches it. That listener runs NEVER and reports nothing — `
    + "check the real name in the system source (this is D10: `rollAbilityCheckV2` and "
    + "`rollToolV2` looked exactly this plausible). If it IS dispatched and the extraction "
    + "cannot see it, pin it in ALLOW in this file with the evidence");
}

// (3) NO STALE PINS, both directions.
for (const a of ALLOW) {
  if (dispatched.has(a.hook)) {
    fail("stale pin", `ALLOW pins ${a.hook} as invisible to the extraction, but the generated `
      + "set now contains it — delete the row, the hole closed");
  } else if (!usedPins.has(a.hook)) {
    fail("stale pin", `ALLOW pins ${a.hook} and nothing registers it any more — delete the row `
      + "(a pin that cannot go stale silently is the point of this check)");
  }
}

/* --- the report ---------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} hook-dispatch failure(s).`);
  process.exit(1);
}

const core = [...byHook.keys()].filter(h => !h.startsWith("dnd5e."));
console.log(`HOOK NAMES THIS MODULE REGISTERS, AGAINST WHAT dnd5e ${artifact.version} DISPATCHES`);
console.log(`  ${dispatched.size} dispatched names generated from the system bundle `
  + `(${artifact.extracted.literalNames} literal · ${artifact.extracted.jsdocNames} JSDoc, unioned)`);
console.log(`  ${reg.length} registrations across ${byHook.size} hooks — `
  + `${registered.length} dnd5e.*, ${core.length} core`);
const w = Math.max(...registered.map(h => h.length));
for (const hook of registered) {
  const how = pins.has(hook) ? "PINNED HOLE" : "dispatched";
  console.log(`    ${hook.padEnd(w)}  ${how.padEnd(11)}  ${byHook.get(hook).length}× `
    + `(${[...new Set(byHook.get(hook))].join(", ")})`);
}
console.log(`\n  ⚠ ${core.length} core (non-dnd5e) hook names are NOT checked and cannot be: `
  + "Foundry's bundle yields 0 of them (see the SCOPE note in this file).");
console.log(`\nPASS every dnd5e.* hook registered is one dnd5e ${artifact.version} dispatches `
  + `(${registered.length} names, ${ALLOW.length} pinned hole${ALLOW.length === 1 ? "" : "s"} `
  + "— ARCHITECTURE §10 D10).");
