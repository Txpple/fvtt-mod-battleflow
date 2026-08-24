// STATIC IMPORT-INTEGRITY CHECK — no Foundry, no world, milliseconds.
//
// Every named import must resolve to something the target file actually exports, and every
// relative import must point at a file that exists. That is all this asserts, and it exists
// because NOTHING ELSE IN THE GATE CAN SEE IT.
//
// WHY (measured 2026-08-22, PLAN.md Phase 2 stage 6): moving the presentation formatters out
// of ui.js broke two files, and the whole static gate passed both times.
//
//   - `ui.js` kept CALLING `bfCard`/`popupKey`/`holdBarHTML` after they moved out. Biome's
//     `noUndeclaredVariables` catches that one, and is now enabled for exactly this reason.
//   - `auto-damage.js` kept IMPORTING `popupKey` from ui.js, which no longer exported it.
//     Nothing caught that. The name is declared — it is right there in the import statement —
//     so the linter is satisfied; ES modules resolve it to `undefined` at load and the failure
//     surfaces as `popupKey is not a function`, at the table, inside a hook handler, where
//     this module's fire-and-forget style can swallow it entirely.
//
// A type checker would also catch it, but `checkJs` is deliberately OFF (tsconfig.json): this
// is a 10,000-line untyped codebase adopting JSDoc types file by file, and turning it on today
// buries a real signal under thousands of type errors. This check is the narrow slice of that
// value which can be had for free, today.
//
// ⚠ DYNAMIC imports are checked too, and that is not an afterthought — it is where the bug
// was. `const { popupKey } = await import("./ui.js")` is the module's lazy-import idiom — each
// site load-bearing: they break import cycles and pin evaluation order — and a destructure of a
// missing export is even quieter than the static form, because it only runs when that code path
// runs.
//
// ⚠ This comment used to say "six sites". It was NINE when somebody finally re-measured. The
// count now lives where it cannot go stale: `npm run layers` prints the static/bare/lazy tally
// on every run. Do not type a number back into this header.
//
// Star imports (`import * as x`) and bare side-effect imports are not examined: the first
// resolves lazily by property, and the second imports no bindings. Both are rare here and
// deliberate where they appear (`import "./auto-damage.js"` pins evaluation order).
//
//   node tools/check-imports.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

/** Every .js file under scripts/, recursively. */
function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** The names a file exports: declarations, and re-export lists. */
function exportsOf(file) {
  const src = readFileSync(file, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var|class)\s+(\w+)/gm)) names.add(m[1]);
  // `export { a, b as c }` — the exported name is what follows `as`, or the bare name.
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const exportCache = new Map();
const exportsFor = file => {
  if (!exportCache.has(file)) exportCache.set(file, exportsOf(file));
  return exportCache.get(file);
};

const failures = [];
let bindings = 0;
const files = jsFiles(SCRIPTS);

/** `import { a, b } from "./x.js"` and `const { a, b } = await import("./x.js")` alike. */
function namedImports(src) {
  const out = [];
  for (const m of src.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g)) {
    out.push({ names: m[1], spec: m[2] });
  }
  for (const m of src.matchAll(/\{([^{}]*?)\}\s*=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g)) {
    out.push({ names: m[1], spec: m[2] });
  }
  return out;
}

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const here = relative(ROOT, file).replace(/\\/g, "/");
  for (const m of namedImports(src)) {
    const spec = m.spec;
    if (!spec.startsWith(".")) continue; // no bare specifiers ship in this module (DESIGN R3)
    const target = normalize(join(dirname(file), spec));
    if (!existsSync(target)) {
      failures.push(`${here} imports from "${spec}" — no such file`);
      continue;
    }
    const available = exportsFor(target);
    for (const raw of m.names.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]?.trim();
      if (!name) continue;
      bindings += 1;
      if (!available.has(name)) {
        failures.push(
          `${here} imports { ${name} } from "${spec}" — that file does not export it`
        );
      }
    }
  }
}

/* --- report ---------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(
    `\n${failures.length} broken import binding(s).` +
      `\nAn import of a name the target no longer exports is not a syntax error: it resolves` +
      `\nto undefined at load, and the first call site throws "x is not a function" — live, in` +
      `\na hook handler. After moving anything between files, re-run the gate.`
  );
  process.exit(1);
}
console.log(
  `PASS every named import resolves to a real export (${bindings} bindings, ${files.length} files).`
);
