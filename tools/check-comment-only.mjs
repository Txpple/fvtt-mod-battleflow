// Proves a change touched comments only: each changed .js/.mjs file is parsed with the repo's
// TypeScript, printed back with comments removed, and compared with the same print of the base.
// Identical prints mean identical code. Markdown may change alongside; any other file may not.
//
//   node tools/check-comment-only.mjs                 the working tree against HEAD
//   node tools/check-comment-only.mjs --only a.js b.js  the named files of the working tree
//   node tools/check-comment-only.mjs <commit>        that commit against its parent
//   node tools/check-comment-only.mjs --range A..B    every commit in A..B whose subject starts
//                                                     "comments:" against its parent (CI)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");
const printer = ts.createPrinter({ removeComments: true });
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** The code of one file with every comment and all layout gone, or null when it does not exist. */
function codeOf(name, text) {
  if (text === null) return null;
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  if (sf.parseDiagnostics?.length) throw new Error(`${name}: does not parse (${sf.parseDiagnostics[0].messageText})`);
  return printer.printFile(sf);
}

const show = (ref, file) => {
  try { return git("show", `${ref}:${file}`); } catch { return null; }
};

/** Failures for one change: `base` against `head` (a ref, or null for the working tree). */
function compare(base, head, only = null) {
  const names = (head ? git("diff", "--name-only", base, head) : git("diff", "--name-only", base))
    .split("\n").filter(Boolean).filter(f => !only || only.includes(f));
  const failures = [];
  for (const file of names) {
    if (file.endsWith(".md")) continue;
    if (!/\.(m?js)$/.test(file)) { failures.push(`${file}: not a comment-bearing file`); continue; }
    const before = codeOf(file, show(base, file));
    const after = codeOf(file, head ? show(head, file) : readOrNull(join(ROOT, file)));
    if (before !== after) failures.push(`${file}: the code changed${firstDiff(before, after)}`);
  }
  return { names, failures };
}

function readOrNull(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function firstDiff(a, b) {
  if (a === null || b === null) return " (added or removed)";
  const la = a.split("\n"), lb = b.split("\n");
  let i = 0;
  while (i < la.length && la[i] === lb[i]) i++;
  return `\n    - ${(la[i] ?? "").trim()}\n    + ${(lb[i] ?? "").trim()}`;
}

const args = process.argv.slice(2);
const runs = [];
if (args[0] === "--range") {
  const [from, to] = args[1].split("..");
  const zero = /^0+$/.test(from ?? "");
  const list = zero ? git("log", "-1", "--format=%H %s", to) : git("log", "--format=%H %s", `${from}..${to}`);
  for (const line of list.split("\n").filter(Boolean)) {
    const [sha, ...subject] = line.split(" ");
    if (subject.join(" ").startsWith("comments:")) runs.push({ label: `${sha.slice(0, 7)} ${subject.join(" ")}`, base: `${sha}^`, head: sha });
  }
  if (!runs.length) { console.log("PASS no \"comments:\" commit in the range."); process.exit(0); }
} else if (args[0] === "--only") {
  runs.push({ label: "the working tree (named files)", base: "HEAD", head: null, only: args.slice(1).map(f => f.replace(/\\/g, "/")) });
} else if (args[0]) {
  runs.push({ label: args[0], base: `${args[0]}^`, head: args[0] });
} else {
  runs.push({ label: "the working tree", base: "HEAD", head: null });
}

let failed = 0;
for (const run of runs) {
  const { names, failures } = compare(run.base, run.head, run.only);
  if (failures.length) {
    failed++;
    console.log(`FAIL ${run.label}:`);
    for (const f of failures) console.log(`  ${f}`);
  } else {
    console.log(`PASS ${run.label}: ${names.length} file(s), comments only.`);
  }
}
process.exit(failed ? 1 : 0);
