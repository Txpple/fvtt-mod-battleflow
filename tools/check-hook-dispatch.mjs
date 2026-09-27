// Static hook-dispatch check (no Foundry, milliseconds): every `dnd5e.*` hook this module registers
// must be one dnd5e actually dispatches. ⚠ A never-dispatched name registers cleanly, throws
// nothing and does nothing forever (ARCHITECTURE.md §10 D10).
//
// The list is GENERATED from dnd5e's shipped bundle: the literal `Hooks.call`/`callAll` names UNION
// the names in `@memberof hookEvents` JSDoc blocks. ⚠ Neither alone suffices: the roll hooks are
// dispatched from a template (only the JSDoc names them), and some literals have no JSDoc. A
// templated dispatch whose JSDoc names only the non-V2 variant is a hole both miss: ALLOW pins those.
// ⚠ Scope is `dnd5e.*` only: Foundry's minified client bundle yields none of the core names.
// ⚠ The artifact is committed and pinned to the dnd5e version in `module.json`: bump the pin
// without `--regen` and the check fails until somebody looks at the diff.
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
 * The pinned holes: registered names the generated set lacks that are nonetheless dispatched,
 * each with its evidence. ⚠ Stale rows fail both ways: a name now in the set, or one nothing registers.
 * ------------------------------------------------------------------------------------------- */

const ALLOW = [
  {
    hook: "dnd5e.postDamageRollConfiguration",
    why: "TEMPLATED, the preRoll twin's hole on the other side of the dialog: BasicRoll.buildConfigure "
      + "dispatches post<HookName>RollConfiguration for every hookName, and a damage roll's hookNames "
      + "are [damage, ''] (DamageActivity/AttackActivity rollDamage, dnd5e.mjs 9094 and 18270; the '' "
      + "is buildConfigure's own, 71968), so this fires once per damage roll with the built, unevaluated "
      + "rolls — the JSDoc names only the generic postRollConfiguration. fighting-styles.js registers it "
      + "for Great Weapon Fighting's floor; smoke-styles §4 asserts the floor landed (2026-09-26)"
  },
  {
    hook: "dnd5e.preRollDamageV2",
    // The template is `dnd5e.preRoll` + hookName.capitalize() + `V2` (not quoted in the string:
    // a literal dollar-brace inside a string is a biome warning).
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
  },
  {
    hook: "dnd5e.preRollAbilityCheckV2",
    why: "TEMPLATED, the fourth of the family (2026-09-03): Actor5e#rollAbilityCheck, #rollSkill "
      + "and #rollToolCheck all set hookNames [<type>, abilityCheck, d20Test] (dnd5e.mjs, the "
      + "rollAbilityCheck template) and buildConfigure dispatches preRoll<HookName>V2 for each — "
      + "the JSDoc names only the non-V2 dnd5e.preRollAbilityCheck. reminders.js registers it for "
      + "the check gate (the third table on the one machine; initiative skipped by its "
      + "initiativeDialog hookName), and smoke-reminders §12 asserts it FIRED"
  }
];

/* --- the generated set -------------------------------------------------------------------- */

/**
 * dnd5e's own declaration of its dispatched hooks, out of its shipped bundle (`dnd5e.*` only).
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

// (0) The artifact is sane: a truncated list would bless every name and pass.
if (dispatched.size < 50) {
  fail("artifact", `only ${dispatched.size} hook names — dnd5e 5.3.3 yields 105. The artifact is `
    + "truncated or corrupt; regenerate it rather than trusting this run");
}

// (1) The version pin: the artifact and module.json name the same dnd5e version.
const manifest = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8"));
const pinned = manifest.relationships?.systems
  ?.find(s => s.id === "dnd5e")?.compatibility?.verified;
if (pinned !== artifact.version) {
  fail("version pin", `module.json verifies dnd5e ${pinned}, the hook artifact was extracted `
    + `from ${artifact.version}. Re-extract against the version you are shipping against `
    + "(node tools/check-hook-dispatch.mjs --regen) and READ THE DIFF — a name that disappeared "
    + "is a registration that has gone silent");
}

// (2) every registered `dnd5e.*` name is dispatched, or pinned with a reason.
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

// (3) no stale pins, both directions.
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
