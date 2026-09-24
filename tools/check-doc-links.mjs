// STATIC DOC-LINK CHECK — no Foundry, no world, milliseconds. Part of `npm run verify`.
//
// Every cross-reference between the docs, and from a code comment to a doc, must resolve to a
// real file and a real heading. Written for the documentation pass of 2026-09-24, when DESIGN
// §6 had grown to 891 lines and PLAN.md was retired: nothing had ever said a reference rotted,
// so they did. This says it, at build time.
//
// What it resolves:
//   - markdown links to a local file, in every doc — the file must exist (paths relative to the
//     repo root, or to the doc's own directory);
//   - bare file paths under scripts/, tools/, tests/ or prototypes/ in docs and in code comments
//     — the file must exist;
//   - section references `DOC §n` and `DOC.md §n`, the doc name bare or as a markdown link
//     (DESIGN, ARCHITECTURE, NOTES, BACKLOG, SWEEP, RULINGS) — the doc must have a `## n.` heading;
//   - heading references `DOC *heading*` and `DOC §n *heading*` — some heading, or some bold
//     lead-in (the house's anchor style), in the doc must contain the italic text.
//
// What it deliberately does not check: a bare `§n` with no doc named (inside a doc it may name a
// suite's section — `smoke-saves §17` — as often as the doc's own), prose that names a file
// without a path, and URLs. Name the doc if you want a reference checked.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCS = ["README.md", "DESIGN.md", "RULINGS.md", "ARCHITECTURE.md", "NOTES.md", "BACKLOG.md", "SWEEP.md", "tools/README.md"];
const DOC_NAMES = ["DESIGN", "RULINGS", "ARCHITECTURE", "NOTES", "BACKLOG", "SWEEP"];
const DOC_ALT = DOC_NAMES.join("|");

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some(e => name.endsWith(e))) out.push(p);
  }
  return out;
}

const anchors = new Map(); // doc name → { sections: Set<n>, texts: string[] (lower-cased headings and bold lead-ins) }
for (const d of DOC_NAMES) {
  const src = readFileSync(join(REPO, `${d}.md`), "utf8");
  const sections = new Set();
  const texts = [];
  for (const m of src.matchAll(/^(#{2,4})\s+(.*)$/gm)) {
    const text = m[2].trim();
    const n = /^(\d+)\./.exec(text)?.[1];
    if (n) sections.add(n);
    texts.push(text.toLowerCase());
  }
  for (const m of src.matchAll(/\*\*([^*\n]{3,120})\*\*/g)) texts.push(m[1].toLowerCase());
  anchors.set(d, { sections, texts });
}

const failures = [];
const fail = (file, line, what) => failures.push(`${relative(REPO, file)}:${line}: ${what}`);
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

function checkFileRef(file, line, target) {
  const clean = target.split("#")[0].split("?")[0];
  if (!clean || /^[a-z]+:/.test(clean)) return;
  if (!existsSync(join(REPO, clean)) && !existsSync(join(dirname(file), clean))) fail(file, line, `file not found: ${clean}`);
}

function checkSection(file, line, doc, n) {
  if (!anchors.get(doc).sections.has(String(n))) fail(file, line, `${doc} has no section §${n}`);
}

function checkHeading(file, line, doc, text) {
  const needle = text.trim().toLowerCase();
  if (!anchors.get(doc).texts.some(t => t.includes(needle))) fail(file, line, `${doc} has no heading or bold anchor containing "${text.trim()}"`);
}

function scan(file, src, { comments = false } = {}) {
  // In code, only comment lines are read; a string literal naming a doc is the module's own text.
  const body = comments ? src.replace(/^(?!\s*(\/\/|\*|\/\*)).*$/gm, "") : src;
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) checkFileRef(file, lineOf(body, m.index), m[1]);
  for (const m of body.matchAll(/(?<![\w/.-])((?:scripts|tools|tests|prototypes)\/[\w./-]+\.(?:m?js|html|json|ps1|snapshot|md))(?![\w/-])/g)) {
    checkFileRef(file, lineOf(body, m.index), m[1]);
  }
  // `DOC §n` and `DOC.md §n`, the name bare or as a markdown link, an optional `*heading*` after.
  const sectionRef = new RegExp(`\\b(${DOC_ALT})(?:\\.md)?(?:\\]\\((?:${DOC_ALT})\\.md\\))?\\s+§\\s*(\\d+)(?:\\s+\\*([^*\\n]+)\\*)?`, "g");
  for (const m of body.matchAll(sectionRef)) {
    checkSection(file, lineOf(body, m.index), m[1], m[2]);
    if (m[3]) checkHeading(file, lineOf(body, m.index), m[1], m[3]);
  }
  // `DOC *heading*`, the name bare or as a markdown link.
  const headingRef = new RegExp(`\\b(${DOC_ALT})(?:\\.md)?(?:\\]\\((?:${DOC_ALT})\\.md\\))?\\s+\\*([^*\\n]+)\\*`, "g");
  for (const m of body.matchAll(headingRef)) checkHeading(file, lineOf(body, m.index), m[1], m[2]);
}

for (const d of DOCS) {
  const file = join(REPO, d);
  scan(file, readFileSync(file, "utf8"));
}
const codeFiles = [...walk(join(REPO, "scripts"), [".js"]), ...walk(join(REPO, "tools"), [".mjs"]), ...walk(join(REPO, "tests"), [".js"])];
for (const file of codeFiles) scan(file, readFileSync(file, "utf8"), { comments: true });

if (failures.length) {
  console.error(`FAIL ${failures.length} dangling reference(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`PASS every doc link, file path, section and heading reference resolves (${DOCS.length} docs; comments in ${codeFiles.length} code files).`);
