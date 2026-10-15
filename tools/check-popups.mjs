// Static popup check (no Foundry, milliseconds): a moment's pending row, the latch that shows its
// popup once, the button that calls it back and the popup's close are the spine's (ARCHITECTURE §5
// *The pending row*). A machine describes its row to ui.js `pendingRow` and closes a popup through
// `closePopup`; the latch set and the popup registry are read in ui.js alone.
//
//   node tools/check-popups.mjs            # the check (gate: npm run popups)
//   node tools/check-popups.mjs --list     # every pending row and its parts, every pinned site
//
// What it reads (the repo's TypeScript parser, per file), outside ui.js:
//   1. No `shownMoments`: the show-once latch is pendingRow's `latch`, and `forgetShown` releases one.
//   2. No `momentButton` labelled "Answer…": the call-back button is pendingRow's `answer`.
//   3. Every pendingRow `arm` is a function that arms through `armAskTimer` (check-clocks holds that
//      the call names its owner), so a row never starts a clock of its own.
//   4. No `livePopups`: a popup closes through `closePopup` and an opener fronts an open one through
//      `frontPopup`; a read that does more is pinned in READS by file and function, with its reason.
//   5. No `.close()` on a popup: a machine closes only what it was handed — `this`, or a parameter of
//      a function around the call (a render hook's app, a button's dialog); a dialog it built itself
//      and closes is pinned in CLOSES by file and function, with its reason.
// It prints what it counts — the latches, the Answer buttons, the reads, the closes, the broken
// `try { void x.close() } catch` idiom, the rows — so a commit can carry the numbers before and after.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/**
 * Reads of the popup registry that stand, `"<file> <function> <shape>"` → the reason. `identity` is a
 * `livePopups.get(key) === dialog` test (or `!==`); any other read is `read`. Both are a raw DialogV2's
 * own lifecycle, which moves with the raw-DialogV2 rule (openMomentPopup gaining a dismiss and a buzzer).
 */
const READS = new Map([
  ["auto-damage.js offerRoll identity", "tests that the dialog it just rendered is the one registered (a failed render or an early close leaves none, and the offer rolls): the raw DialogV2's own lifecycle"],
  ["volleys.js openVolleyPopup identity", "tests that the dialog it just rendered is the one registered (a failed render fires the volley at once): the raw DialogV2's own lifecycle"]
]);

/** Closes of a dialog the file built itself, `"<file> <function>"` → the reason. */
const CLOSES = new Map([
  ["auto-damage.js offerRoll", "the damage offer's buzzer closes the raw DialogV2 it opened, and the close rolls: the raw dialog's own clock"]
]);

const list = process.argv.includes("--list");
const failures = [];
const report = [];
const seenReads = new Set();
const seenCloses = new Set();
const count = { latches: 0, latchWrites: 0, answers: 0, rows: 0, reads: 0, gets: 0, closes: 0, broken: 0, closePopup: 0, frontPopup: 0 };

const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const skip = n => (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) ? skip(n.expression) : n);
const calleeName = call => {
  const c = call.expression;
  return ts.isIdentifier(c) ? c.text : (ts.isPropertyAccessExpression(c) ? c.name.text : null);
};

/* --- the files, with their top-level functions and imports ---------------------------------- */

const files = new Map();
for (const path of jsFiles(SCRIPTS)) {
  const rel = toPosix(relative(SCRIPTS, path));
  const sf = ts.createSourceFile(rel, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const fns = new Map();       // name → the function node, the file's own top level
  const imports = new Map();   // name → { rel, name }
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) fns.set(stmt.name.text, stmt);
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) fns.set(d.name.text, d.initializer);
      }
    }
    if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
      const spec = stmt.moduleSpecifier.text;
      if (!spec.startsWith(".")) continue;
      const target = toPosix(relative(SCRIPTS, normalize(join(dirname(join(SCRIPTS, rel)), spec))));
      for (const el of stmt.importClause.namedBindings.elements) imports.set(el.name.text, { rel: target, name: (el.propertyName ?? el.name).text });
    }
  }
  files.set(rel, { rel, sf, fns, imports });
}

const at = (file, node) => `${file.rel}:${file.sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

/** The named function `node` sits in, innermost; `<anonymous>` for a bare callback. */
function functionName(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (!isFn(n)) continue;
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) return n.parent.name.text;
    if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
  }
  return "<anonymous>";
}

/** Is `name` a parameter of a function around `node`? */
function isParameter(name, node) {
  const named = b => (ts.isIdentifier(b) ? b.text === name
    : (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) ? b.elements.some(e => !ts.isOmittedExpression(e) && named(e.name)) : false);
  for (let n = node.parent; n; n = n.parent) if (isFn(n) && n.parameters.some(p => named(p.name))) return true;
  return false;
}

/** Does this function's body call `armAskTimer`, directly or through a function it names (two hops)? */
function armsThroughAskTimer(file, fn, depth = 0) {
  if (!fn || (depth > 2)) return false;
  let found = false;
  const visit = n => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const name = ts.isIdentifier(n.expression) ? n.expression.text : null;
      if (name === "armAskTimer") { found = true; return; }
      if (name && (depth < 2)) {
        const target = resolveFn(file, name);
        if (target && armsThroughAskTimer(target.file, target.fn, depth + 1)) { found = true; return; }
      }
    }
    if (isFn(n) && (n !== fn)) return;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(fn, visit);
  return found;
}

/** A function by name, from the file itself or the file it imports the name from. */
function resolveFn(file, name) {
  if (file.fns.has(name)) return { file, fn: file.fns.get(name) };
  const imp = file.imports.get(name);
  const source = imp ? files.get(imp.rel) : null;
  return source?.fns.has(imp.name) ? { file: source, fn: source.fns.get(imp.name) } : null;
}

/** The functions an `arm` value can be: `f`, `cond && f`, `cond ? f : null`, `m => f(m)`. */
function armValues(node) {
  node = skip(node);
  if (!node) return [];
  if ((node.kind === ts.SyntaxKind.NullKeyword) || (node.kind === ts.SyntaxKind.FalseKeyword)) return [];
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) return armValues(node.right);
  if (ts.isConditionalExpression(node)) return [...armValues(node.whenTrue), ...armValues(node.whenFalse)];
  return [node];
}

/** A label's leading text: a string, a template's head. */
const labelText = node => {
  node = skip(node);
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text;
  return null;
};

/** Inside the block of a `try` that has a catch, in the same function: the broken idiom's place. */
const inTryWithCatch = node => {
  for (let n = node.parent; n && !isFn(n); n = n.parent) {
    if (ts.isTryStatement(n) && n.catchClause && (n.tryBlock.pos <= node.pos) && (node.end <= n.tryBlock.end)) return true;
  }
  return false;
};

/* --- the sites ------------------------------------------------------------------------------ */

for (const [rel, file] of files) {
  if (rel === "ui.js") continue;
  const visit = node => {
    if (ts.isImportSpecifier(node)) return;

    // 1. the latch set
    if (ts.isIdentifier(node) && (node.text === "shownMoments")) {
      const parent = node.parent;
      const method = (parent && ts.isPropertyAccessExpression(parent) && (parent.expression === node)) ? parent.name.text : null;
      if (method === "has") count.latches++;
      else count.latchWrites++;
      failures.push(`${at(file, node)} touches the latch set (shownMoments${method ? `.${method}` : ""}) — `
        + "a popup shown once per client is pendingRow's `latch`, and forgetShown releases one");
    }

    // 4. the popup registry
    if (ts.isIdentifier(node) && (node.text === "livePopups")) {
      count.reads++;
      const parent = node.parent;
      const get = parent && ts.isPropertyAccessExpression(parent) && (parent.expression === node) && (parent.name.text === "get");
      if (get) count.gets++;
      const call = get ? parent.parent : null;
      const test = call && ts.isCallExpression(call) ? call.parent : null;
      const identity = !!test && ts.isBinaryExpression(test)
        && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(test.operatorToken.kind);
      const pin = `${rel} ${functionName(node)} ${identity ? "identity" : "read"}`;
      if (READS.has(pin)) { seenReads.add(pin); if (list) report.push(`READ    ${at(file, node).padEnd(28)} ${READS.get(pin)}`); }
      else failures.push(`${at(file, node)} (${pin}) reads the popup registry (livePopups) — close a popup through closePopup, `
        + "front an open one through frontPopup, or pin the site in READS with the reason neither fits");
    }

    if (ts.isCallExpression(node)) {
      const name = calleeName(node);

      // 2. the call-back button
      if ((name === "momentButton") && ts.isIdentifier(node.expression)) {
        const label = labelText(node.arguments[0]);
        if ((label !== null) && /^Answer\b/.test(label)) {
          count.answers++;
          failures.push(`${at(file, node)} draws an Answer button of its own (momentButton "${label.trim()}…") — the call-back button is pendingRow's \`answer\``);
        }
      }

      // 3. the row's clock
      if ((name === "pendingRow") && ts.isIdentifier(node.expression)) {
        count.rows++;
        const parts = skip(node.arguments[2]);
        const keys = (parts && ts.isObjectLiteralExpression(parts))
          ? parts.properties.filter(p => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && ts.isIdentifier(p.name)) : [];
        const arm = keys.find(p => p.name.text === "arm");
        for (const value of arm ? armValues(ts.isShorthandPropertyAssignment(arm) ? arm.name : arm.initializer) : []) {
          let ok = false;
          if (ts.isIdentifier(value)) { const t = resolveFn(file, value.text); ok = !!t && armsThroughAskTimer(t.file, t.fn); }
          else if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) ok = armsThroughAskTimer(file, value);
          if (!ok) {
            failures.push(`${at(file, node)} pendingRow's \`arm\` (${value.getText().slice(0, 40)}) does not arm through armAskTimer — `
              + "the row's clock is the machine's own armAskTimer call, which names its owner (tools/check-clocks.mjs)");
          }
        }
        if (list) report.push(`ROW     ${at(file, node).padEnd(28)} ${keys.map(p => p.name.text).join(" ") || "(no parts)"}`);
      }

      // 5. a popup's close
      if ((name === "close") && ts.isPropertyAccessExpression(node.expression)) {
        const target = skip(node.expression.expression);
        const handed = (target.kind === ts.SyntaxKind.ThisKeyword) || (ts.isIdentifier(target) && isParameter(target.text, node));
        if (!handed) {
          const pin = `${rel} ${functionName(node)}`;
          count.closes++;
          if (inTryWithCatch(node) && ts.isVoidExpression(node.parent)) count.broken++;
          if (CLOSES.has(pin)) { seenCloses.add(pin); if (list) report.push(`CLOSE   ${at(file, node).padEnd(28)} ${CLOSES.get(pin)}`); }
          else {
            failures.push(`${at(file, node)} (${pin}) closes a popup of its own (${node.expression.getText().slice(0, 40)}) — `
              + "a moment's popup closes through closePopup (awaited, a dialog already gone swallowed)");
          }
        }
      }

      if (name === "closePopup") count.closePopup++;
      if (name === "frontPopup") count.frontPopup++;
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sf);
}

for (const pin of READS.keys()) if (!seenReads.has(pin)) failures.push(`stale pin: ${pin} is in READS and reads no popup there — remove the row`);
for (const pin of CLOSES.keys()) if (!seenCloses.has(pin)) failures.push(`stale pin: ${pin} is in CLOSES and closes no dialog there — remove the row`);

const counts = `outside ui.js: latches ${count.latches} (latch-set writes ${count.latchWrites}), Answer buttons ${count.answers}, `
  + `registry reads ${count.reads} (livePopups.get ${count.gets}; ${seenReads.size} pinned), popup closes ${count.closes} `
  + `(${seenCloses.size} pinned; the try { void x.close() } catch idiom ${count.broken}); `
  + `pendingRow ${count.rows}, closePopup ${count.closePopup}, frontPopup ${count.frontPopup}`;

for (const line of report.sort()) console.log(line);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} popup failure(s). ${counts}.`);
  console.error("A moment's pending row is described to ui.js pendingRow — bar, latch, answer, arm — and its popup closes "
    + "through closePopup (ARCHITECTURE §5 *The pending row*).");
  process.exit(1);
}
console.log(`PASS every pending row, latch, call-back button and popup close goes through the spine (${counts} — ARCHITECTURE §5 *The pending row*).`);
