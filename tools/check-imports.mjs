// STATIC IMPORT-INTEGRITY CHECK — no Foundry, no world, milliseconds.
//
// Every named import must resolve to something the target file exports, and every relative import
// must point at a file that exists. Nothing else in the gate sees this: a named import of a missing
// export is declared (the linter is satisfied) and resolves to `undefined`, failing only at the
// table inside a hook handler. `checkJs` is off (tsconfig.json), so this is that slice for free.
//
// ⚠ DYNAMIC imports are checked too: `const { x } = await import("./ui.js")` fails even more
// quietly. `npm run layers` prints the lazy-import tally; never type a count here.
//
// Star imports and bare side-effect imports are not examined: the first resolves by property,
// the second binds nothing.
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
