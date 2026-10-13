// Static rule-tick check (no Foundry, milliseconds): the book's text reaches a card or a popup only under
// the rule tick (DESIGN *Cards*). Before it, 94 call sites drew a rule open above or beside what happened.
//
//   node tools/check-rule-folds.mjs
//
// What it holds:
//   - the rule's markup is written in ONE file, decide/present.js: the pointer (`data-bf-rule`), the fold
//     (`data-bf-rule-fold`) and its tick ("the rule ▸") appear nowhere else in scripts/;
//   - present.js's open quote (`ruleQuote`) is not exported, and is called only by the fold builders
//     (`ruleLine`, `foldedRuleHTML`) and the rescue pane (`rescuePaneHTML`, whose one job is the quote);
//   - a book text is enriched only by rule-text.js, the one reader (`enrichHTML(` nowhere else): a card
//     that enriched an item's description drew it open, whole.
// A deliberate exception carries `// rule-fold: <why>` on its line or the line above.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const PRESENT = "decide/present.js";
const READER = "rule-text.js";
const OPEN_CALLERS = new Set(["ruleLine", "foldedRuleHTML", "rescuePaneHTML"]);

const failures = [];
const fail = (file, line, why) => failures.push(`FAIL ${file}:${line} — ${why}`);
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")).replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
const excused = (lines, i) => /\/\/ rule-fold:/.test(lines[i] ?? "") || /\/\/ rule-fold:/.test(lines[i - 1] ?? "");

let files = 0;
for (const full of jsFiles(SCRIPTS)) {
  files++;
  const rel = toPosix(relative(SCRIPTS, full));
  const raw = readFileSync(full, "utf8");
  const rawLines = raw.split("\n");
  const code = stripComments(raw).split("\n");
  code.forEach((line, i) => {
    if (excused(rawLines, i)) return;
    if ((rel !== PRESENT) && (rel !== READER)) {
      if (line.includes("data-bf-rule")) fail(rel, i + 1, "the rule's markup is present.js's alone: use ruleLine(rule)");
      if (line.includes("the rule ▸")) fail(rel, i + 1, "a rule tick written by hand: use ruleLine(rule)");
      if (/\bruleQuote\b/.test(line)) fail(rel, i + 1, "the open quote is present.js's own: use ruleLine(rule)");
    }
    if ((rel !== READER) && /\benrichHTML\s*\(/.test(line)) fail(rel, i + 1, "a book text enriched outside rule-text.js: point at it and use ruleLine({ item, uuid })");
  });
  if (rel === PRESENT) {
    if (/export\s+(function|const)\s+ruleQuote\b/.test(raw)) fail(rel, 0, "ruleQuote is exported: the open quote must stay inside present.js");
    // every call of ruleQuote sits inside one of the builders allowed to draw it
    let owner = null;
    code.forEach((line, i) => {
      const def = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)\s*=/);
      if (def) owner = def[1] ?? def[2];
      if (/\bruleQuote\s*\(/.test(line) && !/function\s+ruleQuote/.test(line) && !OPEN_CALLERS.has(owner) && !excused(rawLines, i))
        fail(rel, i + 1, `ruleQuote called by ${owner ?? "top level"}: only ${[...OPEN_CALLERS].join(", ")} may draw the book's text open`);
    });
  }
}

for (const f of failures) console.log(f);
if (failures.length) {
  console.log(`\n${failures.length} rule-tick failure(s). A rule is the book's text under the tick (decide/present.js ruleLine); DESIGN *Cards*.`);
  process.exit(1);
}
console.log(`PASS every rule reaches the page under the tick (${files} files): its markup in present.js alone, the open quote in its builders and the rescue pane, the book enriched by rule-text.js alone.`);
