// Static doc-comment check (no Foundry, milliseconds; ARCHITECTURE §11 *Moving code between files*).
// A `/** … */` block must sit directly on the thing it documents: a stranded doc lies about its
// neighbour, and a moved function arrives without its knowledge. Cut on function boundaries and
// check the comment either side of every block you move.
// A violation: a `/**` followed by a blank line, another `/**`, or end-of-file. The module header
// (the first `/**` with only line comments or blanks above it, e.g. `// @ts-check`) is exempt;
// banners use `/*` and are not examined. It also fails on history in a scripts/ comment.
//
//   node tools/check-comments.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
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

    // The module header documents the file. Everything above it must be a line comment or blank
    // (a pragma, a lint directive, a shebang).
    const onlyPragmasAbove = lines.slice(0, start)
      .every(l => (l.trim() === "") || l.trim().startsWith("//"));
    if (onlyPragmasAbove) {
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

/* --- history in comments ---------------------------------------------------------------- */

// A comment says what the code does and why, in the present tense. Dates, quotes of the user and
// the story of walks, slices, phases and releases belong in RULINGS and git, never in scripts/.
const HISTORY = [
  [/\b20\d\d-\d\d-\d\d\b/, "a date"],
  [/\b(the user|user,|user's call|user rul\w*|ruled by)\b|\(gg\)/i, "a quote or ruling of the user"],
  [/\bv\d+\.\d+/, "a version"],
  [/\b(Slice [A-Z0-9]\b|Phase \d|Stage \d|walk-\d|dogfood|handoff)|\bthe \w+ walk\b/i, "project history"]
];
const ts = createRequire(join(ROOT, "package.json"))("typescript");
const history = [];
for (const file of jsFiles(SCRIPTS)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const seen = new Set();
  const collect = ranges => {
    for (const r of ranges ?? []) {
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      const body = text.slice(r.pos, r.end);
      const line0 = sf.getLineAndCharacterOfPosition(r.pos).line;
      body.split("\n").forEach((line, k) => {
        const hit = HISTORY.find(([re]) => re.test(line));
        if (hit) history.push(`${rel}:${line0 + k + 1} — ${hit[1]}: "${line.trim().slice(0, 70)}"`);
      });
    }
  };
  const visit = node => {
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  collect(ts.getLeadingCommentRanges(text, sf.endOfFileToken.getFullStart()));
}
// `--history` lists them without failing.
const ENFORCE_HISTORY = true;
if (process.argv.includes("--history")) {
  for (const h of history) console.log(h);
  console.log(`${history.length} comment line(s) carry history.`);
  process.exit(0);
}
if (ENFORCE_HISTORY) failures.push(...history);

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
