// Static serializer check (no Foundry, milliseconds): a read-modify-write of a module flag goes
// through `queueFlagWrite` (ARCHITECTURE §4 law 2, §11 *Converting a write to the serializer*).
// Two writers merging the same flag from their own stale reads lose an entry: a rider's offer used
// twice, a consequence applied twice, an acknowledgement that un-does an answer.
//
//   node tools/check-serializer.mjs            # the check (gate: npm run serializer)
//   node tools/check-serializer.mjs --list     # every raw setFlag of a module flag, and how it reads
//
// What it reads (the repo's TypeScript parser, per file): every `<doc>.setFlag(MODULE_ID, k, value)`
// outside core.js. A write is a READ-MODIFY-WRITE when its value carries what was read:
//   - the value is built on the flag: a spread of a `readFlag` (or of a variable holding one, declared
//     in a function around the write or handed in by a same-file caller that read it, or of a reader
//     of this file that wraps `readFlag`); or
//   - the value is a variable or a call, and a function around the write (the innermost or any
//     enclosing one, callbacks included) read the same flag with `readFlag(…, k)` first, and the value
//     is not fresh.
// A BIRTH STAMP passes: a fresh object or array literal — its spreads, if any, are calls other than a
// reader (`...statContext(uuid)`), literals, or variables declared from such — whatever the function
// read before; it merges with nothing. A scalar (`true`, `false`, a call's result) is fresh too.
// The flag key is compared by name: a string literal, or a `const` of the file (or one it imports)
// that holds one.
// A read-modify-write FAILS outright when the flag is also written through `queueFlagWrite` anywhere
// (two write paths race), or when its key cannot be read (it could be any flag). One with a single
// raw write path may be pinned in ALLOW (`"<file> <function> <flag>"`) with its reason — §11 rule 3's
// single-decision object with one writer. ⚠ A stale pin (no such write, or one the rule no longer
// catches) fails; a second raw writer of a pinned flag is its own site and fails until pinned.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/**
 * Raw read-modify-writes that stand, `"<file> <function> <flag>"` → the reason: one writer, the guard
 * repeated before the write, no serializer on the flag (ARCHITECTURE §11 rule 3).
 */
const ALLOW = new Map([
  ["concentration.js foldConcentrationRoll concentration", "the ask is a single-decision object with one writer, the concentrator's elect (§11 rule 3): the withheld mark and the outcome each land once behind `status` pending"],
  ["concentration.js markConcApplied concentration", "the resume receipt on the same one-writer ask: `outcome.applied` set once by the elect"],
  ["concentration.js fireConcTimer concentration", "the buzzer voids a concentrator that is gone: the one writer's own clock"],
  ["concentration.js foldConcentrationAutoFail concentration", "the auto-fail is the ask's outcome, written once by its one writer"],
  ["damage-rules.js chooseType typePick", "the card's keeper writes the one pick, once (`flag.chosen` guards); the rename on the sheet is the consequence"],
  ["damage-rules.js <anonymous> typePick", "the keeper settles a pick the sheet made (`f.chosen` guards), once per card"],
  ["damage-shares.js endBond damageShare", "the elect ends the bond once; `ended` is the card's one closing write"],
  ["emanations.js answerPick emanationCard", "the card's keeper folds the aura's picks; one writer, one card"],
  ["emanations.js chooseDamageType emanationCard", "the keeper writes the aura's one damage type, once (`chosen` guards)"],
  ["hit-menu.js <anonymous> hitPick", "the attacker's own client marks its pick rolled on its own attack message (`record.rolled` guards); one writer"],
  ["initiative-swap.js askFor initiativeSwapAsked", "the once-per-combat asked map on the combat document, the elect's alone"],
  ["mastery.js answerMasteryPick masteryPick", "mastery's own flag: a single-decision object with one writer (§11 rule 3), `status` and `answer` guarding"],
  ["mastery.js executeMasteryPick masteryPick", "the same one-writer flag's execution step, `status` guarding"],
  ["mastery.js answerMastery mastery", "mastery's own flag: a single-decision object with one writer (§11 rule 3), `status` and `answer` guarding"],
  ["mastery.js executeMasteryAnswer mastery", "the same one-writer flag's execution step, `status` guarding"],
  ["saves/demand.js metamagicForDemand metamagic", "the caster's default list or mark written back once (`chosen` guards; a player's ticks are never overwritten)"],
  ["sneak.js sneakOfferParts sneak", "the attacker's own client writes its Cunning Strike pick on its own attack message before the roll; one writer"],
  ["sneak.js <anonymous> sneak", "the attacker's `rolled` latch on its own attack message, once per roll; one writer"],
  ["sneak.js runCunningEffects sneakDamage", "the author's `effectsDone` latch on its own damage message, once per card (`effectsRun` guards)"],
  ["stored-dice.js rollAsked storedAsk", "the bearer's ask resolved by the one client that rolled it (`rolling` guards)"],
  ["use-chips.js buildCardChip cardChip", "the chip's `made` mark by the owner that built it (`flag.made` guards), once"]
]);

const list = process.argv.includes("--list");
const failures = [];
const report = [];
const seenAllow = new Set();
let sites = 0;

const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const skipParens = n => (n && ts.isParenthesizedExpression(n) ? skipParens(n.expression) : n);
/**
 * Is this expression the flag that was read — a `readFlag(…)` call (bare, or behind a `??` default or in
 * either branch of a `?:`), or a variable of `fn` that a readFlag filled?
 */
const isReadFlag = (n, fn = null) => {
  n = skipParens(n);
  if (!n) return false;
  if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return isReadFlag(n.left, fn);
  if (ts.isConditionalExpression(n)) return isReadFlag(n.whenTrue, fn) || isReadFlag(n.whenFalse, fn);
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "readFlag")) return true;
  if (ts.isIdentifier(n) && fn?.body && ts.isBlock(fn.body)) {
    for (const stmt of fn.body.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && (d.name.text === n.text)) return isReadFlag(d.initializer, null);
      }
    }
  }
  return false;
};
/** Does a function hand back the flag it read — from its expression body, or from any `return`? */
const returnsRead = fn => {
  if (!ts.isBlock(fn.body)) return isReadFlag(fn.body, fn);
  let found = false;
  const visit = n => {
    if (found) return;
    if (isFn(n) && (n !== fn)) return;
    if (ts.isReturnStatement(n) && n.expression && isReadFlag(n.expression, fn)) { found = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return found;
};

/* --- one file ------------------------------------------------------------------------------- */

const files = new Map();

class File {
  constructor(rel, text) {
    this.rel = rel;
    this.sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    this.constants = new Map();   // name → string value, the file's own
    this.imports = new Map();     // name → { rel, name }
    this.readers = new Set();     // top-level functions of this file whose body calls readFlag
    this.calls = [];
    for (const stmt of this.sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const d of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || !d.initializer) continue;
          if (ts.isStringLiteral(d.initializer)) this.constants.set(d.name.text, d.initializer.text);
          // A reader: a function that returns the flag it read (`doc => readFlag(doc, FLAG) ?? null`,
          // or a body whose return hands back the variable a readFlag filled).
          if ((ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && returnsRead(d.initializer)) this.readers.add(d.name.text);
        }
      }
      if (ts.isFunctionDeclaration(stmt) && stmt.name && returnsRead(stmt)) this.readers.add(stmt.name.text);
      if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
        const spec = stmt.moduleSpecifier.text;
        if (!spec.startsWith(".")) continue;
        const target = toPosix(relative(SCRIPTS, normalize(join(dirname(join(SCRIPTS, rel)), spec))));
        for (const el of stmt.importClause.namedBindings.elements) this.imports.set(el.name.text, { rel: target, name: (el.propertyName ?? el.name).text });
      }
    }
    const visit = n => { if (ts.isCallExpression(n)) this.calls.push(n); ts.forEachChild(n, visit); };
    visit(this.sf);
  }

  at(node) { return `${this.rel}:${this.sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`; }

  /** The flag key an argument names: a literal, a constant of this file or an imported one; `<name>` when unreadable. */
  keyOf(arg) {
    if (!arg) return null;
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
    if (!ts.isIdentifier(arg)) return null;
    if (this.constants.has(arg.text)) return this.constants.get(arg.text);
    const imp = this.imports.get(arg.text);
    const source = imp ? files.get(imp.rel) : null;
    return source?.constants.get(imp.name) ?? `<${arg.text}>`;
  }

  /** The functions around `node`, innermost first. */
  enclosing(node) {
    const out = [];
    for (let n = node.parent; n; n = n.parent) if (isFn(n)) out.push(n);
    return out;
  }

  /** The named function `node` sits in, innermost; `<anonymous>` for a bare callback. */
  functionName(node) {
    for (const fn of this.enclosing(node)) {
      if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
      if (fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
      if (fn.parent && ts.isPropertyAssignment(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
    }
    return "<anonymous>";
  }

  /** Where `name` is declared, looking out from `from`: `{ init }` for a variable, `{ fn, index }` for a parameter, null when unseen. */
  declarationOf(name, from) {
    for (let n = from.parent; n; n = n.parent) {
      if (isFn(n)) {
        const index = n.parameters.findIndex(p => ts.isIdentifier(p.name) && (p.name.text === name));
        if (index >= 0) return { fn: n, index };
      }
      if (ts.isBlock(n) || ts.isSourceFile(n)) {
        for (const stmt of n.statements) {
          if (!ts.isVariableStatement(stmt)) continue;
          for (const d of stmt.declarationList.declarations) {
            if (ts.isIdentifier(d.name) && (d.name.text === name)) return { init: d.initializer ?? null };
          }
        }
      }
    }
    return null;
  }

  /** Is this value FRESH — built from nothing that was read off a flag? */
  fresh(node, depth = 0) {
    node = skipParens(node);
    if (!node || (depth > 8)) return false;
    if (ts.isObjectLiteralExpression(node)) return node.properties.every(p => !ts.isSpreadAssignment(p) || this.fresh(p.expression, depth + 1));
    if (ts.isArrayLiteralExpression(node)) return node.elements.every(e => !ts.isSpreadElement(e) || this.fresh(e.expression, depth + 1));
    if (ts.isAwaitExpression(node)) return this.fresh(node.expression, depth + 1);
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
      return this.fresh(node.left, depth + 1) && this.fresh(node.right, depth + 1);
    }
    if (ts.isConditionalExpression(node)) return this.fresh(node.whenTrue, depth + 1) && this.fresh(node.whenFalse, depth + 1);
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && ((callee.text === "readFlag") || this.readers.has(callee.text))) return false;
      if (ts.isPropertyAccessExpression(callee) && (callee.name.text === "deepClone")) return this.fresh(node.arguments?.[0], depth + 1);
      // A call is fresh; the literals it is handed are looked into (`new Set([...prior, …])`).
      return (node.arguments ?? []).every(a => !(ts.isArrayLiteralExpression(a) || ts.isObjectLiteralExpression(a)) || this.fresh(a, depth + 1));
    }
    if (ts.isIdentifier(node)) {
      const decl = this.declarationOf(node.text, node);
      if (!decl) return false;
      if ("init" in decl) return decl.init ? this.fresh(decl.init, depth + 1) : false;
      // A parameter: fresh when every same-file caller hands something fresh in that position.
      const fn = decl.fn;
      const fnName = ts.isFunctionDeclaration(fn) ? fn.name?.text
        : (fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) ? fn.parent.name.text : null);
      if (!fnName) return false;
      const callers = this.calls.filter(c => ts.isIdentifier(c.expression) && (c.expression.text === fnName) && (c.getStart() !== fn.getStart()));
      if (!callers.length) return false;
      return callers.every(c => c.arguments[decl.index] && this.fresh(c.arguments[decl.index], depth + 1));
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      let root = node;
      while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)) root = root.expression;
      return this.fresh(root, depth + 1);
    }
    return ts.isLiteralExpression(node) || ts.isTemplateExpression(node) || (node.kind === ts.SyntaxKind.TrueKeyword)
      || (node.kind === ts.SyntaxKind.FalseKeyword) || (node.kind === ts.SyntaxKind.NullKeyword);
  }

  /** Did a function around `write` read flag `key` before it? */
  readBefore(write, key) {
    for (const fn of this.enclosing(write)) {
      let found = false;
      const visit = n => {
        if (found || (n.getStart() >= write.getStart())) return;
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "readFlag") && (this.keyOf(n.arguments[1]) === key)) { found = true; return; }
        ts.forEachChild(n, visit);
      };
      visit(fn);
      if (found) return true;
    }
    return false;
  }
}

for (const path of jsFiles(SCRIPTS)) {
  const rel = toPosix(relative(SCRIPTS, path));
  files.set(rel, new File(rel, readFileSync(path, "utf8")));
}

/* --- the flags the serializer writes: a raw read-modify-write of one of these races it --------- */

const queued = new Set();
for (const file of files.values()) {
  for (const c of file.calls) {
    if (ts.isIdentifier(c.expression) && (c.expression.text === "queueFlagWrite")) {
      const key = file.keyOf(c.arguments[1]);
      if (key) queued.add(key);
    }
  }
}

/* --- the sites ------------------------------------------------------------------------------ */

for (const [rel, file] of files) {
  if (rel === "core.js") continue;
  for (const node of file.calls) {
    if (!ts.isPropertyAccessExpression(node.expression) || (node.expression.name.text !== "setFlag")
      || (node.arguments[0]?.getText() !== "MODULE_ID")) continue;
    const [, keyArg, value] = node.arguments;
    const key = file.keyOf(keyArg);
    if (!key || !value) continue;
    sites++;
    const where = file.at(node);
    const pin = `${rel} ${file.functionName(node)} ${key}`;
    const literal = ts.isObjectLiteralExpression(skipParens(value)) || ts.isArrayLiteralExpression(skipParens(value));
    let why = null;
    if (literal && !file.fresh(value)) why = "its value is built on what was read (a spread of the flag, or of a record this check cannot see the birth of)";
    else if (!literal && file.readBefore(node, key) && !file.fresh(value)) why = `a function around it read \`${key}\` first and the value is not fresh`;
    const allowed = ALLOW.get(pin);
    const races = key.startsWith("<") ? "its key cannot be read here, so it may be any flag the serializer writes"
      : (queued.has(key) ? `\`${key}\` is also written through queueFlagWrite, so the two paths race` : null);
    if (why && races) failures.push(`${where} writes \`${key}\` around the serializer: ${why}; ${races} — route it through queueFlagWrite (ARCHITECTURE §4 law 2)`);
    else if (why && allowed) { seenAllow.add(pin); report.push(`ALLOWED ${where} \`${key}\` — ${allowed}`); }
    else if (why) failures.push(`${where} (${pin}) writes \`${key}\` around the serializer: ${why} — a read-modify-write goes through queueFlagWrite (ARCHITECTURE §4 law 2); only a birth stamp may setFlag, or the site is pinned in ALLOW as a one-writer flag with its reason`);
    else if (list) report.push(`stamp   ${where} \`${key}\``);
  }
}
// A pin names a function and a flag; it stands while some write there is a read-modify-write.
for (const pin of ALLOW.keys()) {
  if (!seenAllow.has(pin)) failures.push(`stale pin: ${pin} is in ALLOW and no read-modify-write sits there — remove or move the row`);
}

for (const line of report) console.log(line);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} serializer failure(s). A flag written from what was read goes through queueFlagWrite `
    + "(the guard repeated inside the lock, ARCHITECTURE §11 *Converting a write to the serializer*), or stands pinned in ALLOW as a one-writer flag with its reason.");
  process.exit(1);
}
console.log(`PASS every raw setFlag of a module flag is a birth stamp or a pinned one-writer write (${sites} sites, ${ALLOW.size} pinned, `
  + `${queued.size} flags on the serializer — ARCHITECTURE §4 law 2).`);
