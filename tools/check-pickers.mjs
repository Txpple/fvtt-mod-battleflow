// THE PICKER GATE — no Foundry, no world, milliseconds.
//
// A pick is drawn by one builder and read by one reader (ARCHITECTURE §5 *The pick*), in every file:
//
//   - one input: a radio or a checkbox is decide/present.js `pickInputHTML` (or a row builder on it there:
//     `tickRowsHTML`, the boxes); no `<input type="radio|checkbox">` markup anywhere else;
//   - one reader: a pick's inputs are read through ui.js `picked`, `pickedAll`, `pickInputs` and
//     `pickInputAt`; no `input[name=…]` selector and no `:checked` anywhere else;
//   - one choice: a bystander's radios-plus-Apply popup is ui.js `choicePopup` (the rows from decide/present.js
//     `choiceRows`, "Pass just this time" checked; RULINGS *The asks widened*); no radio tick rows built into a
//     popup by hand, and the pass row's words nowhere else.
//
// Every creature pick renders through ONE presentation besides: scripts/gallery.js `openPicker` (RULINGS
// *Summons*, "one row everywhere"). A machine that picks a creature DESCRIBES what it asks (sections of rows, a
// pool, pills, notes) and gallery.js draws it. So, in every creature-picker machine:
//
//   - no popup of its own: `openMomentPopup` is gallery.js's to call for a pick;
//   - no reach into the row or the pool: no `data-bf-form`, `data-bf-pool`, `bf-gallery-search`;
//   - nothing of the row's: the row, pool and pill builders are not exported (the import would fail
//     check-imports), and no machine imports an export of gallery.js but the picker's own.
//
// A new machine that picks a creature joins PICKER_MACHINES. A popup that is not a creature pick (a card's OK)
// still goes through openPicker in these files, so the gate stays one line per rule.
//
//   node tools/check-pickers.mjs
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsFiles, toPosix } from "./check-layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

/** The machines that pick a creature: summons (and Find Familiar), Wild Shape and the polymorph spells. */
export const PICKER_MACHINES = ["summons.js", "transforms.js"];

/** gallery.js's exports a machine may import: the picker, the creature reader, the pool and its rule, the placement, the table's art (summons and forms). */
const ALLOWED = new Set(["openPicker", "describeCreature", "poolFromPacks", "poolRuleOf", "pickSpots", "summonArt", "formArt"]);

/** The builder's file and the reader's. */
const BUILDER = "decide/present.js";
const READER = "ui.js";

const CREATURE_RULES = [
  [/\bopenMomentPopup\b/, "opens a popup of its own (a pick goes through gallery.js openPicker)"],
  [/data-bf-form|data-bf-pool|bf-gallery-search/, "reaches into the picker's row or pool markup"]
];

/** Every file's rules: [pattern, the file it is sanctioned in, why it fails elsewhere]. */
const PICK_RULES = [
  [/<input\b[^>]*\btype=\\?["']?(?:radio|checkbox|\$\{)/, BUILDER, "draws a pick input by hand (a radio or a checkbox is decide/present.js pickInputHTML, or a row builder on it)"],
  [/input\[name=|:checked\b/, READER, "reads a pick's inputs by hand (ui.js picked, pickedAll, pickInputs, pickInputAt)"],
  [/Pass just this time/, BUILDER, "writes the pass row by hand (decide/present.js choiceRows, drawn by ui.js choicePopup)"],
  [/tickRowsHTML\(\s*\{[^}]*\bkind:\s*["']radio["']/, READER, "builds a bystander's radios into a popup by hand (ui.js choicePopup)"]
];

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let failures = 0;
const counts = { inputs: 0, reads: 0, choices: 0 };
const files = jsFiles(SCRIPTS).map(path => ({ rel: toPosix(relative(SCRIPTS, path)), src: stripComments(readFileSync(path, "utf8")) }));
for (const { rel, src } of files) {
  const lines = src.split("\n");
  for (const [re, home, why] of PICK_RULES) {
    if (rel === home) continue;
    lines.forEach((line, i) => {
      if (re.test(line)) { failures++; console.log(`FAIL scripts/${rel}:${i + 1} — ${why}: ${line.trim().slice(0, 90)}`); }
    });
  }
  if (rel !== BUILDER) counts.inputs += (src.match(/\bpickInputHTML\(/g) ?? []).length;
  if (rel !== READER) {
    counts.reads += (src.match(/\b(picked|pickedAll|pickInputs|pickInputAt)\(/g) ?? []).length;
    counts.choices += (src.match(/\bchoicePopup\(/g) ?? []).length;
  }
  if (!PICKER_MACHINES.includes(rel)) continue;
  for (const [re, why] of CREATURE_RULES) {
    lines.forEach((line, i) => {
      if (re.test(line)) { failures++; console.log(`FAIL scripts/${rel}:${i + 1} — ${why}: ${line.trim().slice(0, 90)}`); }
    });
  }
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/gallery\.js["']/g)) {
    for (const n of m[1].split(",").map(s => s.trim()).filter(Boolean)) {
      if (!ALLOWED.has(n)) { failures++; console.log(`FAIL scripts/${rel} — imports ${n} from gallery.js (only ${[...ALLOWED].join(", ")})`); }
    }
  }
}
for (const name of PICKER_MACHINES) {
  if (!files.some(f => f.rel === name)) { failures++; console.log(`FAIL PICKER_MACHINES names scripts/${name}, which does not exist`); }
}

if (failures) {
  console.log(`\n${failures} one-off(s). A pick is drawn by decide/present.js pickInputHTML and read through ui.js's readers; a bystander's `
    + "choice is ui.js choicePopup; a creature pick is described to gallery.js openPicker, never drawn by its machine.");
  process.exit(1);
}
console.log(`PASS every pick is drawn by the one builder and read by the one reader in all ${files.length} files `
  + `(${counts.inputs} pickInputHTML, ${counts.reads} reads, ${counts.choices} choicePopup outside their homes), `
  + `and every creature pick renders through gallery.js openPicker (${PICKER_MACHINES.length} machines).`);
