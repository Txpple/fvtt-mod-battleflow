// STATIC DOC-COMMENT ATTACHMENT CHECK — no Foundry, no world, milliseconds.
//
// A `/** … */` block must sit directly on top of the thing it documents. This asserts that,
// and it exists because the failure mode is invisible and expensive.
//
// WHY (measured 2026-08-22, PLAN.md Phase 2): the extraction stages turned up EIGHT doc
// comments sitting above a function they did not describe. Three predated the refactor —
// functions had been reordered and their docs did not follow. FIVE were created by the
// extraction itself: moving a function out left its doc behind, stranded above whatever
// happened to come next.
//
// Both directions are costly:
//   - The stranded doc lies. A reader takes the prose above a function as describing it, and
//     one of the three pre-existing orphans was a stale near-duplicate of a RICHER comment
//     elsewhere in the same file — so the file appeared to document the behaviour twice, in
//     two slightly different ways, with no way to tell which was current.
//   - The moved function arrives naked. Two of the five carried knowledge the new home did
//     not: the hobgoblin-shield story behind `isReactionItem` (a name match is not a
//     reaction), and the warning that the save-side dead gate is deliberately NOT the same
//     predicate as mastery's. Both would have been re-derived the hard way, at the table.
//
// The rule the codebase now follows: **cut on function boundaries, never comment boundaries,
// and check the comment either side of every block you move.**
//
// What counts as a violation: a `/**` block that is followed by a blank line, by another
// `/**` block, or by end-of-file. A module header (a `/**` block starting on line 1) is
// exempt — it documents the file, not a declaration. Banner comments use `/*` rather than
// `/**` and are not examined.
//
//   node tools/check-comments.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

const failures = [];
let checked = 0;
let blocks = 0;

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

for (const file of jsFiles(SCRIPTS)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split("\n");
  checked += 1;

  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim().startsWith("/**")) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < lines.length && !lines[i].trimEnd().endsWith("*/")) i += 1;
    const end = i;
    blocks += 1;

    // The module header documents the file itself.
    if (start === 0) {
      i += 1;
      continue;
    }

    const next = end + 1 < lines.length ? lines[end + 1].trim() : "";
    if (next === "" || next.startsWith("/**")) {
      const why = next === "" ? "a blank line or end-of-file" : "another /** block";
      // A one-line block carries its own text; a multi-line one carries it on the next line.
      const source = start === end ? lines[start] : (lines[start + 1] ?? "");
      const first = source
        .trim()
        .replace(/^\/\*\*\s?/, "")
        .replace(/^\*\s?/, "")
        .replace(/\s*\*\/$/, "")
        .slice(0, 60);
      failures.push(
        `${rel}:${start + 1}-${end + 1} — doc block is followed by ${why}, not a declaration` +
          `\n       "${first}…"`
      );
    }
    i += 1;
  }
}

/* --- report ---------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(
    `\n${failures.length} orphaned doc comment(s).` +
      `\nA /** block must sit directly on the thing it documents. Either move it onto its` +
      `\nfunction, fold it into the doc that replaced it, or delete it if the code it` +
      `\ndescribed has moved to another file — but never leave it stranded.`
  );
  process.exit(1);
}
console.log(`PASS every /** block sits on a declaration (${blocks} blocks, ${checked} files).`);
