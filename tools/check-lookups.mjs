// Static lookups check (no Foundry, milliseconds): a uuid is resolved and a token is found through one reader
// each (ARCHITECTURE §7 *The shared readers*). A raw `fromUuidSync` throws mid-render on a bad uuid; a token found
// by hand answers by a rule of its own (a placeable where a document is wanted, the controlled one on one client and
// the first on another).
//
//   node tools/check-lookups.mjs            # the check (gate: npm run lookups)
//   node tools/check-lookups.mjs --list     # every site counted, and every pin
//
// What it reads (the repo's TypeScript parser, per file):
//   1. THE UUID: `fromUuid`, `fromUuidSync` and `parseUuid` are called in core.js alone (`resolveUuid`,
//      `resolveUuidAsync`); a call anywhere else is pinned in UUIDS by file and function, with its reason.
//   2. THE TOKEN: outside geometry.js (`tokenDocOf`, `tokenOf`, `tokenOnScene`, `tokensOf`) no `getActiveTokens`,
//      no `canvas.tokens.get(…)`, no `canvas.tokens.placeables.find(…)` or `.filter(…)`, no scene's `tokens.find(…)`
//      and no `x.document ?? x`; a site that stands is pinned in TOKENS by file and function, with its reason.
// A stale pin fails. It prints what it counts, so a commit can carry the numbers before and after.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/** The one home of each reader. */
const UUID_HOME = "core.js";
const TOKEN_HOME = "geometry.js";

/** Raw uuid lookups that stand, `"<file> <function>"` → the reason. */
const UUIDS = new Map();

/** Raw token lookups that stand, `"<file> <function>"` → the reason. */
const TOKENS = new Map([
  ["summons.js casterTokenOn", "the caster's token on the landing scene, matched by its base actor's id as well as its uuid: a cast from a sidebar sheet stands as an unlinked token of its actor, whose look and side the summon copies"]
]);

const list = process.argv.includes("--list");
const failures = [];
const report = [];
const seen = { uuid: new Set(), token: new Set() };
const count = { uuid: 0, uuidPinned: 0, token: 0, tokenPinned: 0 };
const kinds = new Map();   // token kind → count

const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
/** An expression's text without optional chaining, parentheses or whitespace. */
const plain = node => node.getText().replace(/\?\./g, ".").replace(/\s+/g, "");
const skip = n => (n && (ts.isParenthesizedExpression(n) || ts.isNonNullExpression?.(n)) ? skip(n.expression) : n);

const UUID_CALL = /^(globalThis\.)?(fromUuid|fromUuidSync)$|(^|\.)parseUuid$/;

/** A receiver without its parentheses and an `?? []` fallback: `(canvas.tokens?.placeables ?? []).filter`. */
const receiverOf = node => {
  const r = skip(node);
  return (r && ts.isBinaryExpression(r) && (r.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) ? skip(r.left) : r;
};

/** The kind of raw token lookup a call is, or null. */
function tokenCall(node) {
  const callee = plain(node.expression);
  if (/(^|\.)getActiveTokens$/.test(callee)) return "getActiveTokens";
  if (/^canvas\.tokens\.get$/.test(callee)) return "canvas.tokens.get";
  const searched = (ts.isPropertyAccessExpression(node.expression) && ["find", "filter"].includes(node.expression.name.text))
    ? plain(receiverOf(node.expression.expression)) : null;
  if (searched === "canvas.tokens.placeables") return "placeables.find";
  if (/\.tokens\.find$/.test(callee)) return "scene tokens.find";
  return null;
}

/** `x.document ?? x`: a token or its document folded by hand. */
function documentFold(node) {
  if (!ts.isBinaryExpression(node) || (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken)) return false;
  const left = skip(node.left);
  if (!ts.isPropertyAccessExpression(left) || (left.name.text !== "document")) return false;
  return plain(skip(left.expression)) === plain(skip(node.right));
}

for (const path of jsFiles(SCRIPTS)) {
  const rel = toPosix(relative(SCRIPTS, path));
  const text = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const at = n => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const fnName = node => {
    for (let n = node.parent; n; n = n.parent) {
      if (!isFn(n)) continue;
      if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
      if (n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) return n.parent.name.text;
      if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
    }
    return "<top>";
  };

  const token = (node, kind) => {
    if (rel === TOKEN_HOME) return;
    const pin = `${rel} ${fnName(node)}`;
    count.token++;
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    if (TOKENS.has(pin)) {
      seen.token.add(pin);
      count.tokenPinned++;
      if (list) report.push(`TOKEN   ${at(node).padEnd(30)} ${kind} — pinned: ${TOKENS.get(pin).slice(0, 70)}`);
      return;
    }
    if (list) report.push(`TOKEN   ${at(node).padEnd(30)} ${kind}`);
    failures.push(`${at(node)} (${pin}) finds a token by hand (${kind}: ${node.getText().replace(/\s+/g, " ").slice(0, 60)}) — `
      + "geometry.js answers it by the one rule: tokenDocOf (the document), tokenOf (the token on the canvas), "
      + "tokenOnScene (on a named scene), tokensOf (every one)");
  };

  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = plain(node.expression);
      if (UUID_CALL.test(callee) && (rel !== UUID_HOME)) {
        const pin = `${rel} ${fnName(node)}`;
        count.uuid++;
        if (UUIDS.has(pin)) { seen.uuid.add(pin); count.uuidPinned++; if (list) report.push(`UUID    ${at(node).padEnd(30)} ${callee} — pinned`); }
        else {
          if (list) report.push(`UUID    ${at(node).padEnd(30)} ${callee}`);
          failures.push(`${at(node)} (${pin}) resolves a uuid with ${callee} — use core.js resolveUuid (sync) or resolveUuidAsync, `
            + "which answer null for a uuid that is not here instead of throwing");
        }
      }
      const kind = tokenCall(node);
      if (kind) token(node, kind);
    }
    if (documentFold(node)) token(node, "x.document ?? x");
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const pin of UUIDS.keys()) if (!seen.uuid.has(pin)) failures.push(`stale pin: ${pin} is in UUIDS and resolves no uuid there — remove the row`);
for (const pin of TOKENS.keys()) if (!seen.token.has(pin)) failures.push(`stale pin: ${pin} is in TOKENS and finds no token there — remove the row`);

const kindList = [...kinds].map(([k, n]) => `${k} ${n}`).join(", ") || "none";
const counts = `raw uuid lookups outside ${UUID_HOME} ${count.uuid} (${count.uuidPinned} pinned); `
  + `raw token lookups outside ${TOKEN_HOME} ${count.token} (${count.tokenPinned} pinned; ${kindList})`;

for (const line of report) console.log(line);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} lookup failure(s). ${counts}.`);
  console.error("A uuid is resolved through core.js resolveUuid / resolveUuidAsync, a token found through geometry.js "
    + "tokenDocOf / tokenOf / tokenOnScene / tokensOf (ARCHITECTURE §7).");
  process.exit(1);
}
console.log(`PASS every uuid and token goes through its one reader (${counts} — ARCHITECTURE §7).`);
