// Static card-read check (no Foundry, milliseconds). A card's ITEM or ACTIVITY is read through
// lookup.js `cardItem` / `cardActivity`, never a bare uuid lookup: fails on `fromUuid(…)`,
// `fromUuidSync(…)` or `resolveUuid(…)` naming an `activityUuid`, `itemUuid` or `itemUuidOf(…)`
// anywhere in scripts/ outside lookup.js, unless the line above says `// live only: <reason>`.
// ⚠ dnd5e's `Activity#use` SPENDS before it posts: a used-up item (potion, scroll) is deleted before
// its card exists, so a bare lookup silently finds nothing. The card keeps a snapshot, which the
// platform's own read (`ChatMessage5e#getAssociatedItem`) rebuilds; the helpers fall back to it.
// A deliberate live read (a feature never used up, a button that USES the ability, a region with no
// card) says why on the line above.
//
//   node tools/check-card-reads.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");
const HOME = "scripts/lookup.js";
const BARE = /\b(fromUuidSync|fromUuid|resolveUuid)\([^)]*\b(activityUuid|itemUuid|itemUuidOf)\b/;
const LIVE_ONLY = /\/\/\s*live only:\s*\S/;

/** Every .js file under scripts/, recursively. */
function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const failures = [];
let live = 0;
let files = 0;
for (const file of jsFiles(SCRIPTS)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (rel === HOME) continue;
  files += 1;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
    if (!BARE.test(line)) return;
    if (LIVE_ONLY.test(line) || LIVE_ONLY.test(lines[i - 1] ?? "")) { live += 1; return; }
    failures.push(`${rel}:${i + 1}  ${line.trim()}`);
  });
}

if (failures.length) {
  console.error(`FAIL ${failures.length} bare uuid read(s) of a card's item or activity — read it through lookup.js`);
  console.error("     cardItem / cardActivity (a use deletes a used-up item BEFORE its card exists), or say");
  console.error("     `// live only: <reason>` on the line above when the live sheet is genuinely the truth:");
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`PASS every card item/activity read goes through lookup.js (${files} files; ${live} live-only read(s), each with its reason).`);
