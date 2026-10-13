// THE PICKER GATE — no Foundry, no world, milliseconds.
//
// Every creature pick renders through ONE presentation: scripts/gallery.js `openPicker` (RULINGS
// *Summons*, "one row everywhere"; the user: "a unified ui presentation that the ui rendering goes
// thru, so everything is not a one off"). A machine that picks a creature DESCRIBES what it asks
// (sections of rows, a pool, pills, notes) and gallery.js draws it. So, in every picker machine:
//
//   - no popup of its own: `openMomentPopup` is gallery.js's to call for a pick;
//   - no hand-drawn pick: no `type="radio"` / `type="checkbox"` markup;
//   - no reach into the row or the pool: no `data-bf-form`, `data-bf-pool`, `bf-gallery-search`;
//   - nothing of the row's: the row, pool and pill builders are not exported (the import would fail
//     check-imports), and no machine imports an export of gallery.js but the picker's own.
//
// A new machine that picks a creature joins PICKER_MACHINES. A popup that is not a creature pick (a
// card's OK) still goes through openPicker in these files, so the gate stays one line per rule.
//
//   node tools/check-pickers.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The machines that pick a creature: summons (and Find Familiar), Wild Shape and the polymorph spells. */
export const PICKER_MACHINES = ["summons.js", "transforms.js"];

/** gallery.js's exports a machine may import: the picker, the creature reader, the pool and its rule, the placement, the table's art (summons and forms). */
const ALLOWED = new Set(["openPicker", "describeCreature", "poolFromPacks", "poolRuleOf", "pickSpots", "summonArt", "formArt"]);

const FORBIDDEN = [
  [/\bopenMomentPopup\b/, "opens a popup of its own (a pick goes through gallery.js openPicker)"],
  [/type=\\?["']?(radio|checkbox)/, "draws a pick by hand (radio or checkbox markup)"],
  [/data-bf-form|data-bf-pool|bf-gallery-search/, "reaches into the picker's row or pool markup"]
];

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let failures = 0;
for (const name of PICKER_MACHINES) {
  const src = stripComments(readFileSync(join(ROOT, "scripts", name), "utf8"));
  for (const [re, why] of FORBIDDEN) {
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (re.test(line)) { failures++; console.log(`FAIL scripts/${name}:${i + 1} — ${why}: ${line.trim().slice(0, 90)}`); }
    });
  }
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/gallery\.js["']/g)) {
    for (const n of m[1].split(",").map(s => s.trim()).filter(Boolean)) {
      if (!ALLOWED.has(n)) { failures++; console.log(`FAIL scripts/${name} — imports ${n} from gallery.js (only ${[...ALLOWED].join(", ")})`); }
    }
  }
}

if (failures) {
  console.log(`\n${failures} one-off(s). A creature pick is described to gallery.js openPicker, never drawn by its machine.`);
  process.exit(1);
}
console.log(`PASS every creature pick renders through gallery.js openPicker (${PICKER_MACHINES.length} machines).`);
