// Static hook-order check for the split module (v1.6.1). Loads scripts/battleflow.js in
// Node with stubbed globals — no Foundry needed — and prints every Hooks registration in
// true evaluation order, grouped per hook. Run it after adding a file, an import, or a
// same-hook registration (Phase 2's saves.js is the expected customer): evaluation order
// is import-graph order, not the entry list, and relative order between same-hook
// registrations can be behavioral. The assertions at the bottom are the orderings known
// to be load-bearing; see the HANDOFF ground truth and the lazy import() in hold.js.
//
//   node tools/check-hook-order.mjs              the named CHECKS, and the snapshot diff
//   node tools/check-hook-order.mjs --snapshot   refresh tools/hook-order.snapshot on purpose
//
// ⚠ THE SNAPSHOT (Stage 0 of the machine-tier pass, 2026-09-05). The named CHECKS are the
// load-bearing SUBSET; they cannot see a move that reorders two registrations nobody has yet
// named. §7's rule — "when an import is removed, DIFF the printed evaluation order" — was a
// by-hand measurement (print before, print after, eyeball); it is mechanical now. The full
// order, every registration on every hook, lives in `tools/hook-order.snapshot`, tracked, and
// the default run FAILS on any drift from it. A move that is meant to change the order refreshes
// the snapshot with `--snapshot` in the same commit and says why in the message; a move that is
// meant to be order-neutral is proven so by this run printing nothing but PASS.
//
// ⚠ The LOADING of the registrations lives in `hook-registrations.mjs`, shared with
// `check-hook-dispatch.mjs` — same list, two different questions asked of it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistrations, groupByHook } from "./hook-registrations.mjs";

const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), "hook-order.snapshot");
const refresh = process.argv.includes("--snapshot");

const reg = await loadRegistrations();
const byHook = groupByHook(reg);
console.log(`${reg.length} registrations across ${byHook.size} hooks (evaluation order):\n`);
for (const [hook, files] of byHook) console.log(`  ${hook}: ${files.join(" -> ")}`);
console.log("");

const before = (hook, a, b) => {
  const files = byHook.get(hook) ?? [];
  const ia = files.indexOf(a), ib = files.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
};
const CHECKS = [
  ["dnd5e.preApplyDamage", "hold.js", "concentration.js",
    "the hold's veto before concentration's cause capture (Hooks.call stops at the first false)"],
  ["dnd5e.renderChatMessage", "hold.js", "mastery.js",
    "hold rows render above mastery rows on a shared attack card (D6 moved the hold's row out of ui.js into hold.js; this assertion moved with it)"],
  ["dnd5e.renderChatMessage", "ui.js", "hold.js",
    "the damage-offer bar renders above the hold row — they shared one registration in ui.js until D6, and the order is now held by hold.js importing ui.js (so ui.js's body, and its registration, evaluate first)"],
  ["dnd5e.renderChatMessage", "mastery.js", "receipts.js",
    "mastery rows render above receipt rows on a shared attack card"],
  ["dnd5e.renderChatMessage", "saves.js", "receipts.js",
    "save verdict rows render above receipt rows on a save card (held by the entry order + the lazy import of receipts.js in saves.js)"],
  ["dnd5e.renderChatMessage", "mastery.js", "precision.js",
    "mastery rows render above the maneuver fold rows on a shared attack card (v1.19.0 entry order; precision.js is the first of the five fold files since Stage 4a)"],
  ["dnd5e.renderChatMessage", "command.js", "saves.js",
    "maneuver rows render above the saves rows (the entry imports the five fold files before saves.js; command.js is the last of them)"],
  ["dnd5e.renderChatMessage", "precision.js", "d20-folds.js",
    "the d20 fold row sits directly below the maneuver rows — the same missed attack can carry a Precision offer AND a reroll/bardic offer, and a table reading the card top-to-bottom should meet them in that order (v1.23.0 entry order)"],
  // ⚠ LOAD-BEARING, not cosmetic. Precision stamps its flag on rollAttackV2 first; d20-folds.js
  // then reads the SAME message and composes its verdict across every fold already on it
  // (foldsFrom/foldedVerdict). Reverse the two and the fold would compose against a precision
  // flag that does not exist yet, and its announced arithmetic would disagree with hitTargets.
  ["dnd5e.rollAttackV2", "precision.js", "d20-folds.js",
    "precision stamps before the d20 fold composes over it — the fold reads every flag already on the attack"],
  ["dnd5e.renderChatMessage", "volleys.js", "saves.js",
    "the volley row renders above the saves rows on a shared usage card (v1.20.0 entry order)"],
  ["dnd5e.renderChatMessage", "receipts.js", "resources.js",
    "the spend line is the usage card's footer — below every workflow row (v1.20.0 entry order)"],
  ["dnd5e.preRollDamageV2", "sneak.js", "volleys.js",
    "the sneak dice are pushed as their own part BEFORE the dart multiplier copies the base entry — attack-gated like the riders, so the sets are disjoint; the order keeps that structural (2026-09-02)"],
  ["dnd5e.preRollDamageV2", "hit-menu.js", "volleys.js",
    "a maneuver's die is pushed BEFORE the dart multiplier copies the base entry — attack-gated like the sneak dice, disjoint from darts; the order keeps that structural (2026-09-04)"],
  ["dnd5e.preRollDamageV2", "clock-riders.js", "volleys.js",
    "a clock rider's part is pushed BEFORE the dart multiplier copies the base entry — attack-gated like the marks, disjoint from darts; the order keeps that structural (2026-09-02)"],
  ["dnd5e.preRollDamageV2", "hit-riders.js", "volleys.js",
    "the dart multiplier copies the base entry AFTER the riders decided — a rider must never be duplicated per dart (riders are attack-gated and darts are damage-activity rolls, so the sets are disjoint; the order keeps that structural)"]
];
let ok = true;
for (const [hook, a, b, why] of CHECKS) {
  const pass = before(hook, a, b);
  if (!pass) ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${hook}: ${a} before ${b} — ${why}`);
}
if (!ok) console.log("\nOrder regressed — re-read the HANDOFF ESM ground truth before shipping this.");

/* --- the snapshot ------------------------------------------------------------------------- */

// One line per registration, in evaluation order: `<hook>\t<file>`. The raw list, not the
// grouped print, so a registration moving between two hooks' groups is a visible line move.
const lines = reg.map(r => `${r.hook}\t${r.file}`);
const header = "# tools/hook-order.snapshot — every Hooks registration in evaluation order (check-hook-order.mjs --snapshot). Tracked; a diff here is a hook-order change.";

if (refresh) {
  writeFileSync(SNAPSHOT, `${[header, ...lines].join("\n")}\n`);
  console.log(`\nSNAPSHOT written: ${lines.length} registrations → tools/hook-order.snapshot`);
} else if (!existsSync(SNAPSHOT)) {
  ok = false;
  console.log("\nFAIL no tools/hook-order.snapshot — run `node tools/check-hook-order.mjs --snapshot` and commit it");
} else {
  const want = readFileSync(SNAPSHOT, "utf8").split("\n").filter(l => l && !l.startsWith("#"));
  const drift = diffLines(want, lines);
  if (drift.length) {
    ok = false;
    console.log(`\nFAIL the evaluation order drifted from tools/hook-order.snapshot (${drift.length} line(s)):`);
    for (const d of drift) console.log(`  ${d}`);
    console.log("\nAn import added or removed, a file split, or a registration moved. If the change is "
      + "intended, refresh with --snapshot in the same commit and explain the difference in the message.");
  } else {
    console.log(`\nPASS the evaluation order matches tools/hook-order.snapshot (${lines.length} registrations)`);
  }
}

process.exit(ok ? 0 : 1);

/**
 * A line diff (LCS), printed unified-style: `-N old` for a line the snapshot has and the tree
 * lost, `+N new` for one the tree gained, N the 1-based position in that side's list.
 * @param {string[]} a the snapshot
 * @param {string[]} b the tree
 * @returns {string[]} the changed lines, in order; empty when identical
 */
function diffLines(a, b) {
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = (a[i] === b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while ((i < n) || (j < m)) {
    if ((i < n) && (j < m) && (a[i] === b[j])) { i++; j++; }
    else if ((j < m) && ((i >= n) || (lcs[i][j + 1] >= lcs[i + 1][j]))) { out.push(`+${j + 1} ${b[j].replace("\t", " ")}`); j++; }
    else { out.push(`-${i + 1} ${a[i].replace("\t", " ")}`); i++; }
  }
  return out;
}
