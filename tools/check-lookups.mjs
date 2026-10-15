// Static lookups check (no Foundry, milliseconds): a uuid is resolved through one reader (ARCHITECTURE §7
// *The shared readers*). A raw `fromUuidSync` throws mid-render on a bad uuid, and a raw `fromUuid` rejects
// where every reader means "not here".
//
//   node tools/check-lookups.mjs            # the check (gate: npm run lookups)
//   node tools/check-lookups.mjs --list     # every site counted, and every pin
//
// What it reads (the repo's TypeScript parser, per file):
//   1. THE UUID: `fromUuid`, `fromUuidSync` and `parseUuid` are called in core.js alone (`resolveUuid`,
//      `resolveUuidAsync`); a call anywhere else is pinned in UUIDS by file and function, with its reason.
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

/** Raw uuid lookups that stand, `"<file> <function>"` → the reason. */
const UUIDS = new Map();

const list = process.argv.includes("--list");
const failures = [];
const report = [];
const seen = { uuid: new Set() };
const count = { uuid: 0, uuidPinned: 0 };

const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
/** An expression's text without optional chaining or whitespace. */
const plain = node => node.getText().replace(/\?\./g, ".").replace(/\s+/g, "");

const UUID_CALL = /^(globalThis\.)?(fromUuid|fromUuidSync)$|(^|\.)parseUuid$/;

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
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const pin of UUIDS.keys()) if (!seen.uuid.has(pin)) failures.push(`stale pin: ${pin} is in UUIDS and resolves no uuid there — remove the row`);

const counts = `raw uuid lookups outside ${UUID_HOME} ${count.uuid} (${count.uuidPinned} pinned)`;

for (const line of report) console.log(line);
if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} lookup failure(s). ${counts}.`);
  console.error("A uuid is resolved through core.js resolveUuid / resolveUuidAsync (ARCHITECTURE §7).");
  process.exit(1);
}
console.log(`PASS every uuid is resolved through its one reader (${counts} — ARCHITECTURE §7).`);
