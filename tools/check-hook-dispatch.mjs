// Static hook-dispatch check (no Foundry, milliseconds): every `dnd5e.*` hook this module registers
// must be one dnd5e actually dispatches, and the dispatcher's VETOABLE list must match how the
// platform dispatches each registered name. ⚠ A never-dispatched name registers cleanly, throws
// nothing and does nothing forever (ARCHITECTURE.md §10 D10); a veto on a `callAll` hook is lost.
//
// The list is GENERATED from dnd5e's shipped bundle: the literal `Hooks.call` / `callAll` names,
// the templated names EXPANDED (the roll pipeline builds `dnd5e.preRoll<Name>`, `…V2` and
// `dnd5e.post<Name>RollConfiguration` from each roll's `hookNames`; the rest and slot hooks from a
// type), and the names in `@memberof hookEvents` JSDoc blocks. The template variables the bundle
// sets at run time are pinned in TEMPLATE_VARIABLES with the line that sets them.
// ⚠ Scope is `dnd5e.*` only: Foundry's minified client bundle yields none of the core names; a
// core hook is vetoable when its name starts with `pre` (the document and placement pre-hooks).
// ⚠ The artifact is committed and pinned to the dnd5e version in `module.json`: bump the pin
// without `--regen` and the check fails until somebody looks at the diff.
//
//   node tools/check-hook-dispatch.mjs               # the check (gate: npm run dispatch)
//   node tools/check-hook-dispatch.mjs --regen       # re-extract from the installed dnd5e
//   node tools/check-hook-dispatch.mjs --regen <dir> # ...from a specific systems/dnd5e directory
//
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadRegistrations, groupByHook } from "./hook-registrations.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = join(ROOT, "tools", "dnd5e-hooks.json");

/* ---------------------------------------------------------------------------------------------
 * The pinned holes: registered names the generated set lacks that are nonetheless dispatched,
 * each with its evidence. ⚠ Stale rows fail both ways: a name now in the set, or one nothing registers.
 * ------------------------------------------------------------------------------------------- */

const ALLOW = [];

/* ---------------------------------------------------------------------------------------------
 * The template variables: what the bundle substitutes into a templated hook name at run time,
 * read off the sites that set them. A new roll type or template shape is a new row here.
 * ------------------------------------------------------------------------------------------- */

const TEMPLATE_VARIABLES = {
  // The rest kinds (`config.type` in Actor5e#rest).
  "config.type": ["short", "long"],
  "config.type.capitalize()": ["Short", "Long"],
  // `prepareSpellcastingSlots(spells, type, …)` and the spellcasting table: the progression types.
  "type.capitalize()": ["Leveled", "Pact"],
  "spellcasting.type.capitalize()": ["Leveled", "Pact"]
};
// `${name}` is read off the site itself: the nearest `const name = …` above it, its string
// literals (`type === "check" ? "AbilityCheck" : "SavingThrow"`; `"skill" ? "Skill" : "ToolCheck"`).

/* --- the generated set -------------------------------------------------------------------- */

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * dnd5e's own declaration of its dispatched hooks, out of its shipped bundle (`dnd5e.*` only),
 * split by how it dispatches them.
 * @param {string} dir a `systems/dnd5e` directory
 */
function extract(dir) {
  const src = readFileSync(join(dir, "dnd5e.mjs"), "utf8");
  const version = JSON.parse(readFileSync(join(dir, "system.json"), "utf8")).version;

  // Every `hookNames` a roll declares: the roll pipeline's template variable.
  const hookNames = new Set([""]);   // buildConfigure appends "" for the generic names
  for (const m of src.matchAll(/hookNames\s*[:=]\s*\[([^\]]*)\]/g)) {
    for (const s of m[1].matchAll(/"([^"]*)"/g)) hookNames.add(s[1]);
  }
  /** The values an expression can take: the string literals after its `?` (a ternary), else all of them. */
  const valuesOf = expr => {
    const q = expr.indexOf("?");
    const values = [...expr.slice(q < 0 ? 0 : q).matchAll(/"([^"]+)"/g)].map(s => s[1]);
    return values.length ? values : null;
  };
  // The variable ones: `[..., name, "d20Test"]` and `[..., type, "abilityCheck", "d20Test"]` —
  // every `const name = …` that feeds a hookNames list, and the skill/tool check types.
  for (const m of src.matchAll(/const name = [^;\n]*;/g)) {
    if (!/hookNames = \[\.\.\.\(config\.hookNames \?\? \[\]\), name/.test(src.slice(m.index, m.index + 3000))) continue;
    for (const v of valuesOf(m[0]) ?? []) hookNames.add(v);
  }
  hookNames.add("skill");
  hookNames.add("tool");

  const variables = { ...TEMPLATE_VARIABLES, "hookName.capitalize()": [...hookNames].map(cap) };

  /** The values of the nearest `const name = …` above `index`, or null. */
  const nameAt = index => {
    const above = src.slice(Math.max(0, index - 8000), index);
    const at = above.lastIndexOf("const name = ");
    if (at < 0) return null;
    return valuesOf(above.slice(at, above.indexOf(";", at)));
  };

  /** Every name a template stands for, or null for a shape this tool does not know. */
  const expand = (template, index) => {
    const vars = [...template.matchAll(/\$\{([^}]*)\}/g)].map(m => m[1]);
    const local = { ...variables };
    if (vars.includes("name")) local.name = nameAt(index);
    // An inline ternary of literals (`${changes.total > 0 ? "heal" : "damage"}`) names its own values.
    for (const v of vars) if (!local[v] && v.includes("?")) local[v] = valuesOf(v);
    if (!vars.every(v => local[v])) return null;
    let names = [template];
    for (const v of vars) {
      names = names.flatMap(n => local[v].map(value => n.replace(`\${${v}}`, value)));
    }
    return names;
  };

  let sites = 0;
  let templated = 0;
  const unknown = [];
  const byKind = { call: new Set(), callAll: new Set() };
  const note = (kind, name) => {
    if (kind === "call") byKind.call.add(name);
    else byKind.callAll.add(name);
  };
  // Inline names: a literal, or a template literal.
  for (const m of src.matchAll(/Hooks\.(call|callAll)\(\s*(["'`])((?:[^\\]|\\.)*?)\2/g)) {
    sites++;
    const [, kind, quote, name] = m;
    if ((quote === "`") && name.includes("${")) {
      templated++;
      const names = expand(name, m.index);
      if (!names) unknown.push(name);
      else for (const n of names) note(kind, n);
    } else note(kind, name);
  }
  // A name built into a variable and dispatched a line later: `const name = \`…\`; Hooks.call(name, …)`.
  for (const m of src.matchAll(/const name = `(dnd5e\.[^`]*)`;\s*\n\s*if \( Hooks\.(call|callAll)\(name,/g)) {
    sites++;
    templated++;
    const names = expand(m[1], m.index);
    if (!names) unknown.push(m[1]);
    else for (const n of names) note(m[2], n);
  }
  const jsdoc = new Set();
  let blocks = 0;
  for (const b of src.matchAll(/\/\*\*(?:[^*]|\*(?!\/))*?@memberof hookEvents(?:[^*]|\*(?!\/))*?\*\//g)) {
    blocks++;
    for (const f of b[0].matchAll(/@function\s+([\w.]+)/g)) jsdoc.add(f[1]);
  }
  const dnd = n => n.startsWith("dnd5e.");
  const call = [...byKind.call].filter(dnd).sort();
  const callAll = [...byKind.callAll].filter(dnd).sort();
  const hooks = [...new Set([...call, ...callAll, ...jsdoc])].filter(dnd).sort();
  return {
    version,
    hooks,
    call,
    extracted: {
      callSites: sites,
      templatedSites: templated,
      unknownTemplates: unknown.filter(dnd),
      hookNames: [...hookNames].sort(),
      literalNames: call.length + callAll.length,
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
    source: "dnd5e.mjs: Hooks.call*/callAll names, literal and templated (expanded), UNION @memberof hookEvents JSDoc; `call` is the Hooks.call subset",
    extracted: next.extracted,
    hooks: next.hooks,
    call: next.call
  };
  writeFileSync(ARTIFACT, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`REGENERATED tools/dnd5e-hooks.json from ${dir}`);
  console.log(`  dnd5e ${prev.version} -> ${next.version}`);
  console.log(`  ${next.extracted.callSites} call sites (${next.extracted.templatedSites} `
    + `templated, ${next.extracted.unknownTemplates.length} of unknown shape) · ${next.extracted.literalNames} `
    + `dispatched names (${next.call.length} with Hooks.call) · ${next.extracted.jsdocNames} `
    + `JSDoc-declared · ${next.hooks.length} union`);
  for (const t of next.extracted.unknownTemplates) console.log(`    ⚠ unexpanded template: ${t} — add its variable to TEMPLATE_VARIABLES`);
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
const withCall = new Set(artifact.call ?? []);

// (0) The artifact is sane: a truncated list would bless every name and pass.
if (dispatched.size < 50) {
  fail("artifact", `only ${dispatched.size} hook names — dnd5e 6.0.5 yields well over a hundred. The artifact is `
    + "truncated or corrupt; regenerate it rather than trusting this run");
}
if (!Array.isArray(artifact.call)) {
  fail("artifact", "no `call` list — regenerate it (node tools/check-hook-dispatch.mjs --regen)");
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
const core = [...byHook.keys()].filter(h => !h.startsWith("dnd5e."));
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

// (4) VETOABLE (scripts/dispatch.js) is exactly the registered names the platform dispatches with
// Hooks.call: a false on any other hook is lost, and a false on one of these stops the chain.
const { VETOABLE } = await import(pathToFileURL(join(ROOT, "scripts", "dispatch.js")).href);
const vetoable = new Set(VETOABLE);
for (const hook of registered) {
  const isCall = withCall.has(hook) || (pins.get(hook)?.call === true);
  if (vetoable.has(hook) && !isCall) {
    fail("vetoable", `${hook} is in VETOABLE (scripts/dispatch.js) and dnd5e ${artifact.version} dispatches it with `
      + "callAll — a false there means nothing to the platform; remove it from VETOABLE");
  } else if (!vetoable.has(hook) && isCall) {
    fail("vetoable", `${hook} is dispatched with Hooks.call and is not in VETOABLE (scripts/dispatch.js) — `
      + "a handler's false would be lost; add it");
  }
}
for (const hook of core) {
  const isPre = /^pre[A-Z]/.test(hook);
  if (vetoable.has(hook) && !isPre) fail("vetoable", `${hook} is in VETOABLE, and a core hook is Hooks.call only when its name starts with pre — remove it`);
  else if (!vetoable.has(hook) && isPre) fail("vetoable", `${hook} is a core pre-hook (Hooks.call) and is not in VETOABLE (scripts/dispatch.js) — add it`);
}
for (const hook of vetoable) {
  if (!byHook.has(hook)) fail("vetoable", `VETOABLE lists ${hook} and nothing registers it — remove the row`);
}

/* --- the report ---------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} hook-dispatch failure(s).`);
  process.exit(1);
}

console.log(`HOOK NAMES THIS MODULE REGISTERS, AGAINST WHAT dnd5e ${artifact.version} DISPATCHES`);
console.log(`  ${dispatched.size} dispatched names generated from the system bundle `
  + `(${artifact.extracted.literalNames} literal or expanded · ${artifact.extracted.jsdocNames} JSDoc, unioned; `
  + `${withCall.size} with Hooks.call)`);
console.log(`  ${reg.length} registrations across ${byHook.size} hooks — `
  + `${registered.length} dnd5e.*, ${core.length} core`);
const w = Math.max(...registered.map(h => h.length));
for (const hook of registered) {
  const how = pins.has(hook) ? "PINNED HOLE" : withCall.has(hook) ? "call" : "callAll";
  console.log(`    ${hook.padEnd(w)}  ${how.padEnd(11)}  ${byHook.get(hook).length}× `
    + `(${[...new Set(byHook.get(hook))].join(", ")})`);
}
console.log(`\n  ⚠ ${core.length} core (non-dnd5e) hook names are NOT checked for dispatch and cannot be: `
  + "Foundry's bundle yields 0 of them (see the SCOPE note in this file).");
console.log(`\nPASS every dnd5e.* hook registered is one dnd5e ${artifact.version} dispatches `
  + `(${registered.length} names, ${ALLOW.length} pinned hole${ALLOW.length === 1 ? "" : "s"}), and VETOABLE `
  + `names the ${vetoable.size} Hooks.call hooks among them — ARCHITECTURE §10 D10.`);
