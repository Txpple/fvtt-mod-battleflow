// Static hook-order check (no Foundry, milliseconds): the module's handlers run in the order of
// scripts/dispatch.js's ORDER table, on every hook, and only through the dispatcher.
//
//   node tools/check-hook-order.mjs
//
// It asserts, with the repo's TypeScript parser over scripts/:
//   1. `Hooks.on` / `Hooks.once` / `Hooks.off` appear in dispatch.js and nowhere else;
//   2. every `listen(hook, key, fn)` names its OWN file as the key (a string literal);
//   3. every registering file is a row of ORDER, and every row of ORDER still registers;
//   4. a handler that returns `false` registers on a VETOABLE hook (anywhere else the return is
//      lost, and the veto with it);
//   5. the load-bearing pairs below hold in ORDER, and both files still register on the hook.
// Whether VETOABLE matches what the platform dispatches with `Hooks.call` is check-hook-dispatch's.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRegistrations, groupByHook } from "./hook-registrations.mjs";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

/**
 * The orderings a card's rows or a hook's chain depend on: `[hook, before, after, why]`, files
 * scripts-relative. A pair whose files no longer both register on the hook is stale and fails.
 */
const CHECKS = [
  ["dnd5e.preApplyDamage", "hold/spell-damage.js", "concentration.js",
    "the hold's negate veto before concentration's cause capture (a false stops the chain)"],
  ["dnd5e.renderChatMessage", "ui.js", "hold/views.js",
    "the damage-offer bar renders above the hold row"],
  ["dnd5e.renderChatMessage", "hold/views.js", "mastery.js",
    "the hold row renders above mastery's rows on a shared attack card"],
  ["dnd5e.renderChatMessage", "mastery.js", "receipts.js",
    "mastery rows render above receipt rows on a shared attack card"],
  ["dnd5e.renderChatMessage", "saves/views.js", "receipts.js",
    "save verdict rows render above receipt rows on a save card"],
  ["dnd5e.renderChatMessage", "mastery.js", "precision.js",
    "mastery rows render above the maneuver fold rows on a shared attack card"],
  ["dnd5e.renderChatMessage", "command.js", "saves/views.js",
    "maneuver rows render above the saves rows"],
  ["dnd5e.renderChatMessage", "precision.js", "d20-folds.js",
    "the d20 fold row sits directly below the maneuver rows: a missed attack can carry a Precision offer and a reroll offer, read top to bottom"],
  ["dnd5e.rollAttackV2", "precision.js", "d20-folds.js",
    "precision stamps its flag before the d20 fold composes its verdict over every flag on the attack"],
  ["dnd5e.renderChatMessage", "volleys.js", "saves/views.js",
    "the volley row renders above the saves rows on a shared usage card"],
  ["dnd5e.renderChatMessage", "receipts.js", "resources.js",
    "the spend line is the usage card's footer, below every workflow row"],
  ["dnd5e.preRollDamageV2", "auto-damage.js", "hit-riders.js",
    "the activity's own roll count is stamped before any rider pushes a part"],
  ["dnd5e.preRollDamageV2", "sneak.js", "volleys.js",
    "the Sneak Attack dice are pushed as their own part before the dart multiplier copies the base entry"],
  ["dnd5e.preRollDamageV2", "hit-menu.js", "volleys.js",
    "a maneuver's die is pushed before the dart multiplier copies the base entry"],
  ["dnd5e.preRollDamageV2", "clock-riders.js", "volleys.js",
    "a clock rider's part is pushed before the dart multiplier copies the base entry"],
  ["dnd5e.preRollDamageV2", "hit-riders.js", "volleys.js",
    "the riders decide before the dart multiplier copies the base entry: a rider is never duplicated per dart"],
  ["renderRollConfigurationDialog", "reminders.js", "advantage-buys.js",
    "the buy box is added to the section the gate just drew; drawn first, the gate's redraw would wipe it"],
  ["dnd5e.postRollConfiguration", "reminders.js", "advantage-buys.js",
    "the buy's record overwrites the gate's with the buy among its sources; written first, the gate's would erase it"]
];

const failures = [];
const fail = (rule, msg) => failures.push(`${rule}: ${msg}`);

/* --- the source: registrations only through the dispatcher, keyed by the file's own path ---- */

const dispatcherUrl = pathToFileURL(join(SCRIPTS, "dispatch.js")).href;
const { ORDER, VETOABLE } = await import(dispatcherUrl);
const vetoable = new Set(VETOABLE);
const registering = new Set();
let listens = 0;

for (const file of jsFiles(SCRIPTS)) {
  const rel = toPosix(relative(SCRIPTS, file));
  const key = rel.replace(/\.js$/, "");
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const at = node => `scripts/${rel}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // (1) the platform's registry is the dispatcher's alone.
      if (ts.isPropertyAccessExpression(callee) && (callee.expression.getText() === "Hooks")
        && ["on", "once", "off"].includes(callee.name.text) && (rel !== "dispatch.js")) {
        fail("outside the dispatcher", `${at(node)} calls Hooks.${callee.name.text} — register through `
          + "`listen(hook, key, fn)` from scripts/dispatch.js, so the handler runs in ORDER");
      }
      // (2) `listen(hook, key, fn)`: the key is the file's own path.
      if (ts.isIdentifier(callee) && ["listen", "listenOnce"].includes(callee.text) && (rel !== "dispatch.js")) {
        listens++;
        registering.add(rel);
        const [hookArg, keyArg, fnArg] = node.arguments;
        if (!keyArg || !ts.isStringLiteral(keyArg)) {
          fail("key", `${at(node)} — the second argument of ${callee.text} must be the string "${key}"`);
        } else if (keyArg.text !== key) {
          fail("key", `${at(node)} registers as "${keyArg.text}" but lives in scripts/${rel} — the key is "${key}"`);
        }
        // (4) a veto only counts on a vetoable hook.
        if (fnArg && hookArg && ts.isStringLiteral(hookArg) && returnsFalse(fnArg) && !vetoable.has(hookArg.text)) {
          fail("lost veto", `${at(node)} returns false on "${hookArg.text}", which is not in VETOABLE `
            + "(scripts/dispatch.js) — the platform dispatches it with callAll, so the false means nothing; "
            + "if it IS a Hooks.call hook, add it to VETOABLE and let check-hook-dispatch prove it");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** Does this handler (its own body, not a nested function's) contain `return false`? */
function returnsFalse(fn) {
  let found = false;
  const walk = (n, depth) => {
    if (found) return;
    if ((depth > 0) && (ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isFunctionDeclaration(n))) return;
    if (ts.isReturnStatement(n) && n.expression && (n.expression.kind === ts.SyntaxKind.FalseKeyword)) { found = true; return; }
    ts.forEachChild(n, c => walk(c, depth + 1));
  };
  walk(fn, 0);
  return found;
}

// (3) ORDER and the registering files agree, both ways.
const rows = new Set(ORDER.map(k => `${k}.js`));
for (const rel of registering) {
  if (!rows.has(rel)) fail("not in ORDER", `scripts/${rel} registers a hook and has no row in ORDER (scripts/dispatch.js) — add it where its rows belong`);
}
for (const rel of rows) {
  if (!registering.has(rel)) fail("stale row", `ORDER names "${rel.replace(/\.js$/, "")}" and scripts/${rel} registers nothing — remove the row`);
}
const dupes = ORDER.filter((k, i) => ORDER.indexOf(k) !== i);
for (const k of new Set(dupes)) fail("duplicate row", `ORDER lists "${k}" twice`);

/* --- the runtime: the dispatcher's own registry, in the order it will run ------------------ */

const reg = await loadRegistrations();
const byHook = groupByHook(reg);
console.log(`${reg.length} registrations across ${byHook.size} hooks, through the dispatcher (${listens} listen sites in ${registering.size} files):\n`);
for (const [hook, files] of byHook) console.log(`  ${hook}: ${[...new Set(files)].join(" -> ")}`);
console.log("");

// (5) the load-bearing pairs.
const before = (hook, a, b) => {
  const files = byHook.get(hook) ?? [];
  const ia = files.indexOf(a), ib = files.lastIndexOf(b);
  return (ia >= 0) && (ib >= 0) && (ia < ib);
};
for (const [hook, a, b, why] of CHECKS) {
  const files = byHook.get(hook) ?? [];
  if (!files.includes(a) || !files.includes(b)) {
    fail("stale pair", `${hook}: ${a} before ${b} — ${files.includes(a) ? b : a} no longer registers on it; drop or move the pair`);
    continue;
  }
  const pass = before(hook, a, b);
  if (!pass) fail("order", `${hook}: ${a} must run before ${b} — ${why}. Move the row in ORDER (scripts/dispatch.js)`);
  console.log(`${pass ? "PASS" : "FAIL"} ${hook}: ${a} before ${b} — ${why}`);
}

/* --- the report ---------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} hook-order failure(s).`);
  process.exit(1);
}
console.log(`\nPASS every handler runs through the dispatcher in ORDER (${ORDER.length} rows, ${reg.length} registrations, ${CHECKS.length} load-bearing pairs — ARCHITECTURE §7).`);
