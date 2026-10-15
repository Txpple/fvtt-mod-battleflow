// Static harness check (no Foundry, milliseconds): the live suites wait through the prelude
// (tools/prelude.mjs, `window.__btb`) and nowhere else (ARCHITECTURE §11 *Adding a TEST*).
// A private poll falls through when it runs out, a bare sleep asserts nothing, and a helper copied
// into a suite drifts from its forty siblings: each is a wait that goes wrong in both directions.
//
//   node tools/check-harness.mjs            # the check (gate: npm run harness), with the table
//
// What it reads (the repo's TypeScript parser), over every battery suite in ORDER
// (tools/coverage-map.mjs) and every suite kit (`tools/*-kit.mjs`):
//   1. Bare waits: every `sleep(…)` call and every `new Promise(r => setTimeout(r, …))` outside a
//      `sleep` definition (a timer that rejects is a deadline raced against a call, and passes). Each suite's count is pinned in CEILING: above it fails, below it fails
//      until the ceiling is lowered to the count, so a ceiling only goes down. A suite with no row
//      has a ceiling of 0.
//   2. Private helpers: a suite's own `sleep`, poll (`until`, `waitFor`, any function that loops
//      on a sleep, a promise around a `setInterval`), page-side `ok` or `want` (a Node-side ledger
//      is the reporter's, not a copy), settings snapshot (`Object.fromEntries(… game.settings.get …)`
//      or an object of two or more `game.settings.get` reads), dice rigging (a write to
//      `CONFIG.Dice.randomUniform`) or inline wait loop (a loop that awaits a sleep: the token-render,
//      `canvas.ready` and scene-view waits among them). A suite on the prelude has none; the suites
//      not yet on it are listed in STANDING, a list that only shrinks.
//   3. In a suite on the prelude, every bare wait left carries a `clock:` comment on its line or the
//      line above, naming the module clock it waits out (a decision timer, a buzzer, a module's
//      own setTimeout window); anything observable is an `until` on what the next assertion reads.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { suiteFile, suiteRows } from "./coverage-map.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(TOOLS, "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/** Bare waits per suite. ⚠ Only goes down: lower a row in the commit that lowers its count. */
const CEILING = {
  "check-popup-routing": 3,
  "class-kit": 29,
  "probe-effect-view": 12,
  "smoke-class-barbarian": 32,
  "smoke-class-bard": 32,
  "smoke-class-cleric": 17,
  "smoke-class-druid": 6,
  "smoke-class-fighter": 19,
  "smoke-class-items": 17,
  "smoke-class-monk": 15,
  "smoke-class-paladin": 15,
  "smoke-class-ranger": 13,
  "smoke-class-rogue": 9,
  "smoke-class-sorcerer": 18,
  "smoke-class-warlock": 33,
  "smoke-class-wizard": 23,
  "smoke-damage-rules": 1,
  "smoke-effects": 3,
  "smoke-expiry": 1,
  "smoke-goliath": 18,
  "smoke-guards": 11,
  "smoke-maneuvers": 31,
  "smoke-metamagic": 40,
  "smoke-reminders": 38,
  "smoke-resources": 2,
  "smoke-riders": 4,
  "smoke-saves": 94,
  "smoke-spells": 41,
  "smoke-surfaces": 5
};

/** The suites still on their own helpers, not yet on the prelude. ⚠ Only shrinks. */
const STANDING = new Set([
  "check-popup-routing", "class-kit", "probe-effect-view", "smoke-class-barbarian",
  "smoke-class-bard", "smoke-class-cleric", "smoke-class-druid", "smoke-class-fighter",
  "smoke-class-items", "smoke-class-monk", "smoke-class-paladin", "smoke-class-ranger",
  "smoke-class-rogue", "smoke-class-sorcerer", "smoke-class-warlock", "smoke-class-wizard",
  "smoke-goliath", "smoke-guards", "smoke-maneuvers", "smoke-metamagic", "smoke-reminders",
  "smoke-resources", "smoke-riders", "smoke-saves", "smoke-spells", "smoke-surfaces"
]);

/** A name that is a poll by what it is called. */
const POLL_NAME = /^(until|waitFor|waitUntil|poll)/i;

/** The suites and kits the check reads: name → path. */
function targets() {
  const out = new Map();
  for (const { name } of suiteRows()) out.set(name, suiteFile(name));
  for (const f of readdirSync(TOOLS).filter(f => /-kit\.mjs$/.test(f))) out.set(f.replace(/\.mjs$/, ""), join(TOOLS, f));
  return out;
}

/**
 * Is `node` a `new Promise(r => setTimeout(r, …))`: a timer that RESOLVES? A timer that rejects is a
 * deadline raced against a call, not a wait.
 */
const isTimeoutPromise = node => {
  if (!ts.isNewExpression(node) || (node.expression.getText() !== "Promise")) return false;
  const executor = node.arguments?.[0];
  const resolve = executor && ts.isFunctionLike(executor) && executor.parameters[0]?.name?.getText();
  if (!resolve) return false;
  const text = executor.getText();
  return new RegExp(`\\bsetTimeout\\s*\\(\\s*(${resolve}\\s*,|\\(\\)\\s*=>\\s*${resolve}\\s*\\()`).test(text);
};

/** Is `node` a bare wait: a `sleep(…)` call or a timeout promise? */
const isWait = node => (ts.isCallExpression(node)
  && ((ts.isIdentifier(node.expression) && (node.expression.text === "sleep"))
    || (ts.isPropertyAccessExpression(node.expression) && (node.expression.name.text === "sleep"))))
  || isTimeoutPromise(node);

/** The function a declaration names, if its value is one. */
const fnOf = init => (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) ? init : null;

/** Does `body` await a bare wait inside a loop of its own (not inside a nested function)? */
function loopsOnWait(body) {
  let found = false;
  const visit = (node, inLoop) => {
    if (found) return;
    if (ts.isFunctionLike(node) && (node !== body)) return;
    const loop = inLoop || ts.isIterationStatement(node, false);
    if (loop && ts.isAwaitExpression(node) && isWait(node.expression)) { found = true; return; }
    ts.forEachChild(node, child => visit(child, loop));
  };
  ts.forEachChild(body, child => visit(child, false));
  return found;
}

/** One file read: its bare waits (line, ms, marked), its private helpers (kind, name, line), its watch windows. */
export function readSuite(text, file = "suite.mjs") {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lines = text.split("\n");
  const lineOf = node => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const marked = line => /\bclock:/.test(lines[line - 1] ?? "") || /^\s*\/\/.*\bclock:/.test(lines[line - 2] ?? "");
  const waits = [];
  const helpers = [];
  let watches = 0;
  const sleepDefs = new Set();
  const pollBodies = new Set();

  const declare = (name, fn, node) => {
    if (!fn) return;
    if (name === "sleep") { helpers.push({ kind: "sleep", name, line: lineOf(node) }); sleepDefs.add(fn); return; }
    // A Node-side ledger (assertions made from what the pages return) is the harness's to report, not a page copy.
    if ((name === "ok") || (name === "want")) { if (inPage(node)) helpers.push({ kind: name, name, line: lineOf(node) }); return; }
    if (POLL_NAME.test(name) || loopsOnWait(fn.body)) {
      helpers.push({ kind: "poll", name, line: lineOf(node) });
      pollBodies.add(fn);
    }
  };

  /** Is `node` page code: inside a function handed to `….evaluate(…)`, or a kit suite's `body`? */
  const inPage = node => {
    for (let p = node.parent; p; p = p.parent) {
      if (!ts.isFunctionLike(p) || !p.parent) continue;
      if (ts.isCallExpression(p.parent) && /.evaluate$/.test(p.parent.expression.getText()) && (p.parent.arguments[0] === p)) return true;
      if (ts.isPropertyAssignment(p.parent) && (p.parent.name.getText() === "body") && (p.parent.initializer === p)) return true;
    }
    return false;
  };

  const insideAny = (node, set) => {
    for (let p = node.parent; p; p = p.parent) if (set.has(p)) return true;
    return false;
  };

  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declare(node.name.text, fnOf(node.initializer), node);
    else if (ts.isFunctionDeclaration(node) && node.name) declare(node.name.text, node, node);

    if (isWait(node) && !insideAny(node, sleepDefs)) {
      const arg = node.arguments?.[0];
      const lit = ts.isCallExpression(node) ? arg : node.arguments?.[0]?.body?.arguments?.[1];
      const ms = (lit && ts.isNumericLiteral(lit)) ? Number(lit.text.replace(/_/g, "")) : 0;
      waits.push({ line: lineOf(node), ms, marked: marked(lineOf(node)) });
    }
    if (ts.isCallExpression(node) && (node.expression.getText() === "watch" || /\.watch$/.test(node.expression.getText()))) watches++;
    if (ts.isNewExpression(node) && (node.expression.getText() === "Promise") && /\bsetInterval\s*\(/.test(node.arguments?.[0]?.getText() ?? "")) {
      helpers.push({ kind: "poll", name: "a setInterval promise", line: lineOf(node) });
    }

    if (ts.isIterationStatement(node, false) && !insideAny(node, pollBodies)) {
      let unmarked = false;
      const inner = n => {
        if (ts.isFunctionLike(n)) return;
        if (ts.isAwaitExpression(n) && isWait(n.expression) && !marked(lineOf(n))) unmarked = true;
        ts.forEachChild(n, inner);
      };
      ts.forEachChild(node, inner);
      if (unmarked) helpers.push({ kind: "wait loop", name: lines[lineOf(node) - 1].trim().slice(0, 60), line: lineOf(node) });
    }

    if (ts.isCallExpression(node) && (node.expression.getText() === "Object.fromEntries") && /game\.settings\.get\(/.test(node.getText())) {
      helpers.push({ kind: "settings snapshot", name: "Object.fromEntries", line: lineOf(node) });
    }
    if (ts.isObjectLiteralExpression(node)) {
      const reads = node.properties.filter(p => ts.isPropertyAssignment(p) && /^game\.settings\.get\(/.test(p.initializer.getText()));
      if (reads.length >= 2) helpers.push({ kind: "settings snapshot", name: "an object of reads", line: lineOf(node) });
    }
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
      && (node.left.getText() === "CONFIG.Dice.randomUniform")) {
      helpers.push({ kind: "dice rigging", name: "CONFIG.Dice.randomUniform", line: lineOf(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  helpers.sort((a, b) => a.line - b.line);
  return { waits, helpers, watches };
}

/* --- the check ------------------------------------------------------------------------------ */

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = [];
  const fail = msg => failures.push(msg);
  const rows = [];
  const files = targets();

  for (const name of Object.keys(CEILING)) if (!files.has(name)) fail(`STALE PIN: CEILING names ${name}, which is not a battery suite or a kit`);
  for (const name of STANDING) if (!files.has(name)) fail(`STALE PIN: STANDING names ${name}, which is not a battery suite or a kit`);

  for (const [name, path] of files) {
    if (!existsSync(path)) continue;   // check-coverage-map names a missing suite
    const { waits, helpers, watches } = readSuite(readFileSync(path, "utf8"), path);
    const ceiling = CEILING[name] ?? 0;
    const standing = STANDING.has(name);
    const rel = `tools/${name}.mjs`;
    if (waits.length > ceiling) {
      fail(`${rel}: ${waits.length} bare waits, above its ceiling of ${ceiling} — wait with until() on what the next assertion reads`);
    } else if (waits.length < ceiling) {
      fail(`${rel}: ${waits.length} bare waits, below its ceiling of ${ceiling} — lower CEILING["${name}"] to ${waits.length}`);
    }
    if (standing && !helpers.length && waits.every(w => w.marked)) fail(`${rel} waits through the prelude alone — drop it from STANDING`);
    if (!standing) {
      for (const h of helpers) fail(`${rel}:${h.line} defines its own ${h.kind} (${h.name}) — the prelude's (window.__btb) is the one`);
      for (const w of waits.filter(w => !w.marked)) {
        fail(`${rel}:${w.line} a bare wait with no \`clock:\` comment — until() on the thing it waits for, or name the module clock`);
      }
    }
    rows.push({ name, waits: waits.length, secs: waits.reduce((n, w) => n + w.ms, 0) / 1000, ceiling, helpers: helpers.length, watches, standing });
  }

  console.log("THE HARNESS (tools/prelude.mjs, window.__btb: the one set of waits; ARCHITECTURE §11)");
  const w = Math.max(...rows.map(r => r.name.length));
  console.log(`  ${"suite".padEnd(w)}  waits  secs  ceiling  helpers  windows`);
  for (const r of rows.sort((a, b) => b.secs - a.secs || a.name.localeCompare(b.name))) {
    console.log(`  ${r.name.padEnd(w)}  ${String(r.waits).padStart(5)}  ${r.secs.toFixed(0).padStart(4)}  ${String(r.ceiling).padStart(7)}`
      + `  ${String(r.helpers).padStart(7)}  ${String(r.watches).padStart(7)}  ${r.standing ? "standing" : "on the prelude"}`);
  }
  const sum = rows.reduce((a, r) => ({ waits: a.waits + r.waits, secs: a.secs + r.secs }), { waits: 0, secs: 0 });
  const onPrelude = rows.filter(r => !r.standing).length;
  console.log(`  ${"total".padEnd(w)}  ${String(sum.waits).padStart(5)}  ${sum.secs.toFixed(0).padStart(4)}   (${onPrelude} of ${rows.length} on the prelude)`);

  if (failures.length) {
    console.error("");
    for (const f of failures) console.error(`FAIL ${f}`);
    console.error(`\n${failures.length} harness finding(s). The prelude is tools/prelude.mjs; the rule is ARCHITECTURE §11 *Adding a TEST*.`);
    process.exit(1);
  }
  console.log(`\nPASS every bare wait is within its ceiling, and every suite on the prelude waits through it.`);
}
