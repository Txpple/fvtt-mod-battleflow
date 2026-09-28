// Static HTML-escape check (no Foundry, milliseconds): a name a player can set never reaches the
// page as markup. Every `${…}` inside an HTML template literal in scripts/ that reads a
// player-settable text — a `name`, an `img`, a `label` (and their `…Name`, `…Img`, `…Label`
// forms), a `flavor`, an `alias` — passes through an escaper first: `esc` (decide/present.js),
// `attr` (present.js's attribute form) or `foundry.utils.escapeHTML`.
//
//   node tools/check-html.mjs
//
// How it reads (the repo's TypeScript parser):
//   - an HTML template literal is one whose text carries a tag, or one that sits where HTML goes:
//     a card's `lines: [...]`, a `content:` / `html:` property, the right side of `innerHTML =`;
//   - a builder's result (`…HTML(…)`, `bfCard`, `ruleLine`, `spendLine`, `spendPhrase`) is HTML
//     already, its own literals checked where they are written; a nested template literal too;
//   - a condition is not text: a ternary's test, an `&&`'s left side, a comparison, a `!x`;
//   - a call's result is judged by its receiver and its arguments (`.map(t => t.name).join()`),
//     never by the callee's own name.
// A value the rule reads as a name and that is safe markup by construction carries a
// `// html: <why>` comment on its line or the line above.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, SCRIPTS, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

const ESCAPERS = new Set(["esc", "attr", "escapeHTML"]);
const BUILDERS = /HTML$|^bfCard$|^ruleLine$|^spendLine$|^spendPhrase$/;
const TAINT = /(^|[a-z])(name|Name|img|Img|label|Label|flavor|alias)$/;
const COMPARISONS = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InstanceOfKeyword, ts.SyntaxKind.InKeyword]);

const failures = [];
let literals = 0;
let spans = 0;
let pragmas = 0;

for (const path of jsFiles(SCRIPTS)) {
  const rel = toPosix(relative(SCRIPTS, path));
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lineOf = n => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const trusted = line => /\/\/\s*html:/.test(lines[line - 1] ?? "") || /^\s*\/\/\s*html:/.test(lines[line - 2] ?? "");

  /** Is this template literal HTML? A tag in its text, or it sits where HTML goes. */
  const isHTML = tpl => {
    if (/<[a-zA-Z/!]/.test(tpl.getText())) return true;
    let p = tpl.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isBinaryExpression(p))) p = p.parent;
    if (p && ts.isArrayLiteralExpression(p) && ts.isPropertyAssignment(p.parent) && (p.parent.name.getText() === "lines")) return true;
    if (p && ts.isPropertyAssignment(p) && /^(content|html)$/.test(p.name.getText())) return true;
    if (p && ts.isBinaryExpression(p) && /innerHTML$/.test(p.left.getText())) return true;
    return false;
  };

  /** The first player-settable read in this expression that no escaper wraps, or null. */
  const tainted = expr => {
    let found = null;
    const visit = n => {
      if (found) return;
      if (ts.isConditionalExpression(n)) { visit(n.whenTrue); visit(n.whenFalse); return; }
      if (ts.isBinaryExpression(n)) {
        if (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) { visit(n.right); return; }
        if (COMPARISONS.has(n.operatorToken.kind)) return;
      }
      if (ts.isPrefixUnaryExpression(n) || ts.isTypeOfExpression(n)) return;
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
        if (ESCAPERS.has(name) || BUILDERS.test(name)) return;
        if (ts.isPropertyAccessExpression(c)) visit(c.expression);
        for (const a of n.arguments) visit(a);
        return;
      }
      if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) return;
      if (ts.isPropertyAccessExpression(n) && TAINT.test(n.name.text)) { found = n.getText(); return; }
      if (ts.isIdentifier(n) && TAINT.test(n.text) && !(ts.isPropertyAccessExpression(n.parent) && (n.parent.name === n))) {
        found = n.getText();
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(expr);
    return found;
  };

  const visit = n => {
    if (ts.isTemplateExpression(n) && isHTML(n)) {
      literals++;
      for (const span of n.templateSpans) {
        spans++;
        const t = tainted(span.expression);
        if (!t) continue;
        const line = lineOf(span);
        if (trusted(line)) { pragmas++; continue; }
        failures.push(`scripts/${rel}:${line} — \${${span.expression.getText().slice(0, 60)}} puts ${t} into HTML unescaped: `
          + "wrap it in esc() (decide/present.js), or say why it is safe markup with a `// html:` comment");
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} unescaped interpolation(s): a creature, item or scene name is the player's to set, and markup in it renders.`);
  process.exit(1);
}
console.log(`PASS every player-settable text in HTML is escaped (${literals} HTML template literals, ${spans} interpolations, `
  + `${pragmas} marked safe by construction).`);
