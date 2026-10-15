// Static card check (no Foundry, milliseconds): every card the module posts goes out through the spine's
// one envelope, and who sees it is one of the named recipient sets (ARCHITECTURE §5 *The card*). A card
// built by hand drifts in its speaker and its whisper; a recipient list built by hand drifts in who it
// reaches; a relay answer posted as a plain card is an envelope no relay may be listening for.
//
//   node tools/check-cards.mjs            # the check (gate: npm run cards)
//   node tools/check-cards.mjs --list     # every card site, its poster, and every pin
//
// What it reads (the repo's TypeScript parser, per file):
//   1. A `ChatMessage.create` (or `.implementation.create`, `.createDocuments`) is ui.js's alone, inside
//      `postCard`; anywhere else it is pinned in RAW by file and function, with its reason.
//   2. A `whisper:` property is written by ui.js alone (postCard's `to`), or inside a pinned raw create.
//   3. A recipient list is core.js's alone (`gmIds`, `selfIds`, `selfAndGmIds`, `ownersAndGmIds`): no
//      `game.users.filter(…).map(u => u.id)` and no `[game.user.id]` / `[game.userId]` elsewhere.
//   4. `postAnswer("<key>", …)` names an envelope a relay registers (`registerRelay("<key>", …)`), and the
//      flags it posts carry that key; a `postCard` whose flags carry a registered envelope fails — the
//      answer goes through `postAnswer`. `respondsTo` is the exception on a plain card: it also points a
//      changed roll's card at the roll it changed (ARCHITECTURE §4 *The relay*).
// A stale pin fails.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/** The spine's poster and the leaf's recipient sets. */
const POSTER = "ui.js";
const RECIPIENTS = "core.js";

/** Raw creates that stand, `"<file> <function>"` → the reason. */
const RAW = new Map([
  ["core.js whisperNoGM", "the no-GM notice is the leaf's own: core.js imports nothing, so it cannot reach the spine's poster; its recipients are selfIds(), its own set"],
  ["metamagic.js postDeferredCard", "the deferred usage card is dnd5e's own card, held whole while the ask at the area is answered and posted as its data"],
  ["ui.js postCard", "the poster itself"]
]);

const list = process.argv.includes("--list");
const failures = [];
const report = [];
const seenRaw = new Set();
const counts = { postCard: 0, postAnswer: 0, raw: 0, sets: 0 };

const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const RAW_CREATE = /^ChatMessage(\.implementation)?\.(create|createDocuments)$/;

/** The relay's envelope keys, from every `registerRelay("<key>", …)`. */
const relayKeys = new Set();
const sources = jsFiles(SCRIPTS).map(path => ({ rel: toPosix(relative(SCRIPTS, path)), text: readFileSync(path, "utf8") }));
for (const { text } of sources) for (const m of text.matchAll(/\bregisterRelay\(\s*"([^"]+)"/g)) relayKeys.add(m[1]);

/** The module-scope keys of a `flags` literal (`{ [MODULE_ID]: { k, … } }`), or null when it is not a literal. */
function flagKeys(flags) {
  if (!flags || !ts.isObjectLiteralExpression(flags)) return null;
  const scope = flags.properties.find(p => ts.isPropertyAssignment(p) && (p.name.getText() === "[MODULE_ID]"));
  if (!scope) return [];
  if (!ts.isObjectLiteralExpression(scope.initializer)) return null;
  return scope.initializer.properties
    .filter(p => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
    .map(p => p.name.getText());
}
const propOf = (obj, name) => (obj && ts.isObjectLiteralExpression(obj))
  ? obj.properties.find(p => ts.isPropertyAssignment(p) && (p.name.getText() === name)) ?? null : null;

for (const { rel, text } of sources) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const at = n => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const fnName = node => {
    for (let n = node.parent; n; n = n.parent) {
      if (!isFn(n)) continue;
      if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
      if (n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) return n.parent.name.text;
    }
    return "<top>";
  };
  /** Is `node` inside the argument of a pinned raw create? */
  const inRaw = node => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isCallExpression(n) && RAW_CREATE.test(n.expression.getText()) && RAW.has(`${rel} ${fnName(n)}`)) return true;
    }
    return false;
  };

  const visit = n => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      // 1. the raw create
      if (RAW_CREATE.test(callee)) {
        const pin = `${rel} ${fnName(n)}`;
        if (RAW.has(pin)) { seenRaw.add(pin); counts.raw++; if (list) report.push(`raw        ${at(n).padEnd(30)} ${RAW.get(pin).slice(0, 80)}`); }
        else failures.push(`${at(n)} posts a card with ${callee} — post it through ui.js postCard (or postAnswer for a relay's answer), which builds the speaker and the whisper in one place`);
      }
      // 3. a recipient list: game.users.filter(…).map(u => u.id)
      if (ts.isPropertyAccessExpression(n.expression) && (n.expression.name.text === "map") && (rel !== RECIPIENTS)) {
        const recv = n.expression.expression;
        const mapper = n.arguments[0];
        const toIds = mapper && ts.isArrowFunction(mapper) && /^\w+\.id$/.test(mapper.body.getText());
        if (toIds && ts.isCallExpression(recv) && /^game\.users(\.contents)?\.filter$/.test(recv.expression.getText())) {
          failures.push(`${at(n)} builds a recipient list by hand (${n.getText().replace(/\s+/g, " ").slice(0, 70)}) — use core.js's sets: gmIds(), selfIds(), selfAndGmIds(), ownersAndGmIds(actor)`);
        }
      }
      // 4. the relay's answers
      if ((callee === "postAnswer") && (rel !== POSTER || fnName(n) !== "postAnswer")) {
        counts.postAnswer++;
        const keyArg = n.arguments[0];
        const key = keyArg && ts.isStringLiteral(keyArg) ? keyArg.text : null;
        const keys = flagKeys(propOf(n.arguments[1], "flags")?.initializer);
        if (!key) failures.push(`${at(n)} postAnswer's envelope is not a string literal — name the key its relay registers`);
        else if (!relayKeys.has(key)) failures.push(`${at(n)} postAnswer("${key}") — no relay registers "${key}" (registerRelay in the machine that folds it)`);
        else if (keys === null) failures.push(`${at(n)} postAnswer("${key}") — its flags are not a literal, so the check cannot see the envelope`);
        else if (!keys.includes(key)) failures.push(`${at(n)} postAnswer("${key}") — the flags it posts do not carry "${key}"`);
        if (list) report.push(`postAnswer ${at(n).padEnd(30)} ${key}`);
      }
      if ((callee === "postCard") && !(rel === POSTER && fnName(n) === "postAnswer")) {
        counts.postCard++;
        const keys = flagKeys(propOf(n.arguments[0], "flags")?.initializer) ?? [];
        const envelope = keys.find(k => relayKeys.has(k) && (k !== "respondsTo"));
        if (envelope) failures.push(`${at(n)} posts the "${envelope}" envelope through postCard — a relay's answer goes through postAnswer("${envelope}", …)`);
        if (list) report.push(`postCard   ${at(n)}`);
      }
      if (/^(gmIds|selfIds|selfAndGmIds|ownersAndGmIds)$/.test(callee) && (rel !== RECIPIENTS)) counts.sets++;
    }
    // 2. a whisper written by hand
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      if ((n.name.getText() === "whisper") && (rel !== POSTER) && ts.isObjectLiteralExpression(n.parent) && !inRaw(n)) {
        failures.push(`${at(n)} writes a card's whisper by hand — pass the recipients as postCard's \`to\` (one of core.js's sets)`);
      }
    }
    // 3. a recipient list: [game.user.id]
    if (ts.isArrayLiteralExpression(n) && (rel !== RECIPIENTS) && n.elements.some(e => /^game\.(user\.id|userId)$/.test(e.getText()))) {
      failures.push(`${at(n)} builds a recipient list by hand (${n.getText().slice(0, 60)}) — use core.js's selfIds() or selfAndGmIds()`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

for (const [pin, why] of RAW) {
  if (!seenRaw.has(pin)) failures.push(`stale pin: ${pin} is in RAW (${why.slice(0, 40)}…) and posts no raw card — remove the row`);
}

for (const line of report) console.log(line);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} card failure(s). A card goes out through ui.js postCard, a relay's answer through postAnswer, `
    + "and its recipients are one of core.js's sets (ARCHITECTURE §5 *The card*).");
  process.exit(1);
}
console.log(`PASS every card goes out through the spine (${counts.postCard} postCard, ${counts.postAnswer} postAnswer, `
  + `${counts.raw} raw creates pinned), and every recipient list is one of core.js's sets (${counts.sets} uses) — ARCHITECTURE §5.`);
