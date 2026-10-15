// Static clock check (no Foundry, milliseconds): a decision clock is armed only through the spine's
// two helpers, and every one names its owner (ARCHITECTURE §3 *The clocks*, §5 *Timer mechanics*).
// A clock hand-rolled on `setTimeout` has no staleness roof and no owner; a clock with no owner
// never starts with no GM, or starts twice.
//
//   node tools/check-clocks.mjs            # the check (gate: npm run clocks)
//   node tools/check-clocks.mjs --list     # every clock, its helper and its owner
//
// What it reads (the repo's TypeScript parser, per file):
//   1. Outside ui.js, no `setTimeout` whose delay is a deadline: an expression that reads `deadline`,
//      `Date.now()`, `decisionWindow()` or a `window`, or multiplies seconds into milliseconds. A
//      debounce, a beat or a banner's fade is a literal and passes.
//   2. `armDeadline` (the raw clock) is called from ui.js's `armAskTimer` and from the files pinned
//      in RAW_CLOCKS with a reason; a pin whose file no longer arms one fails too.
//   3. Every `armAskTimer` call carries `owns`, and it is one of the spine's owners — `electOwns`,
//      `keeperOwns`, `continuingOwns`, `subjectOwns(…)` — or an inline function that calls one of
//      core.js's gates (`isActiveGM`, `drivesMomentFor`, `keepsMessage`, `isContinuingClient`).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/** The spine's named owners, and the gates an inline owner may call. */
const OWNERS = new Set(["electOwns", "keeperOwns", "continuingOwns"]);
const OWNER_FACTORIES = new Set(["subjectOwns"]);
const GATES = /\b(isActiveGM|drivesMomentFor|keepsMessage|isContinuingClient)\s*\(/;

/** A `setTimeout` delay that is a deadline, not a debounce. */
const DEADLINE_DELAY = /\b(deadline|Date\.now|decisionWindow|window)\b|\*\s*1000\b/;

/**
 * Files that arm the raw clock themselves, with the reason the owner-checked helper does not fit.
 * ⚠ A new clock on `armDeadline` is a decision: pin it here or put it on `armAskTimer`.
 */
const RAW_CLOCKS = new Map([
  ["ui.js", "armAskTimer is the helper; the raw clock is its own"],
  ["auto-damage.js", "the damage offer's buzzer closes a POPUP on the client that opened it (the roll follows); there is no flag owner to elect and no re-arm on reload"],
  ["stored-dice.js", "the rest card's ask arms on the client that opened the popup, under the resumable's own `drives` (canAnswerFor); its expiry rolls the bearer's dice there"],
  ["volleys.js", "the author's resume: the caster's client alone, and an overdue volley fires at once instead of arming"]
]);

const failures = [];
const clocks = [];
const seenRaw = new Set();
const list = process.argv.includes("--list");

for (const path of jsFiles(SCRIPTS)) {
  const rel = toPosix(relative(SCRIPTS, path));
  const text = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const at = node => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text
        : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null);

      // 1. a deadline on the raw timer
      if ((name === "setTimeout") && (rel !== "ui.js")) {
        const delay = node.arguments[1]?.getText() ?? "";
        if (DEADLINE_DELAY.test(delay)) {
          failures.push(`${at(node)} arms a decision clock on setTimeout (delay \`${delay}\`) — `
            + "arm it through armAskTimer (an owner, a pending test, the flag's deadline) or armDeadline (the staleness roof)");
        }
      }

      // 2. the raw clock, pinned
      if (name === "armDeadline") {
        seenRaw.add(rel);
        if (!RAW_CLOCKS.has(rel)) {
          failures.push(`${at(node)} arms the raw clock (armDeadline) — a machine's clock goes through armAskTimer with its owner, `
            + "or the file is pinned in RAW_CLOCKS with the reason the helper does not fit");
        } else if (list) clocks.push(`${at(node).padEnd(28)} armDeadline   (raw: ${RAW_CLOCKS.get(rel)})`);
      }

      // 3. the owner-checked clock names an owner the spine knows
      if ((name === "armAskTimer") && (rel !== "ui.js")) {
        const opts = node.arguments[4];
        const prop = opts && ts.isObjectLiteralExpression(opts)
          ? opts.properties.find(p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && (p.name.text === "owns"))
          : null;
        if (!prop) {
          failures.push(`${at(node)} armAskTimer without \`owns\` — name the clock's owner: electOwns, keeperOwns, continuingOwns or subjectOwns(flag => flag.<subjectUuid>)`);
        } else {
          const init = prop.initializer;
          const named = ts.isIdentifier(init) && OWNERS.has(init.text);
          const factory = ts.isCallExpression(init) && ts.isIdentifier(init.expression) && OWNER_FACTORIES.has(init.expression.text);
          const inline = (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && GATES.test(init.getText());
          if (!named && !factory && !inline) {
            failures.push(`${at(node)} armAskTimer's \`owns\` is not a gate (${init.getText().slice(0, 60)}) — `
              + "it must elect one client: electOwns, keeperOwns, continuingOwns, subjectOwns(…) or a function calling isActiveGM / drivesMomentFor / keepsMessage / isContinuingClient");
          } else if (list) {
            const flag = node.arguments[2]?.getText() ?? "?";
            clocks.push(`${at(node).padEnd(28)} armAskTimer   ${flag.padEnd(22)} owns: ${init.getText().replace(/\s+/g, " ")}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const [rel, why] of RAW_CLOCKS) {
  if (!seenRaw.has(rel)) failures.push(`stale pin: ${rel} is in RAW_CLOCKS (${why.slice(0, 40)}…) and arms no raw clock — remove the row`);
}

if (list) for (const c of clocks.sort()) console.log(c);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} clock failure(s). A decision clock is armed through armAskTimer with its owner named, `
    + "or through armDeadline from a file pinned in RAW_CLOCKS (ARCHITECTURE §3 *The clocks*).");
  process.exit(1);
}
console.log(`PASS every decision clock is armed through armAskTimer with a named owner or through a pinned armDeadline `
  + `(${clocks.length || "all"} clocks, ${RAW_CLOCKS.size} raw-clock pins — ARCHITECTURE §3 *The clocks*).`);
