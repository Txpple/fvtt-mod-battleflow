// Static hook-order check for the split module (v1.6.1). Loads scripts/battleflow.js in
// Node with stubbed globals — no Foundry needed — and prints every Hooks registration in
// true evaluation order, grouped per hook. Run it after adding a file, an import, or a
// same-hook registration (Phase 2's saves.js is the expected customer): evaluation order
// is import-graph order, not the entry list, and relative order between same-hook
// registrations can be behavioral. The assertions at the bottom are the orderings known
// to be load-bearing; see the HANDOFF ground truth and the lazy import() in hold.js.
//
//   node tools/check-hook-order.mjs
//
// ⚠ The LOADING of the registrations lives in `hook-registrations.mjs`, shared with
// `check-hook-dispatch.mjs` — same list, two different questions asked of it.
import { loadRegistrations, groupByHook } from "./hook-registrations.mjs";

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
  ["dnd5e.renderChatMessage", "mastery.js", "maneuvers.js",
    "mastery rows render above the maneuver fold rows on a shared attack card (v1.19.0 entry order)"],
  ["dnd5e.renderChatMessage", "maneuvers.js", "saves.js",
    "maneuver rows render above the saves rows (the entry imports maneuvers.js before saves.js)"],
  ["dnd5e.renderChatMessage", "maneuvers.js", "d20-folds.js",
    "the d20 fold row sits directly below the maneuver rows — the same missed attack can carry a Precision offer AND a reroll/bardic offer, and a table reading the card top-to-bottom should meet them in that order (v1.23.0 entry order)"],
  // ⚠ LOAD-BEARING, not cosmetic. Precision stamps its flag on rollAttackV2 first; d20-folds.js
  // then reads the SAME message and composes its verdict across every fold already on it
  // (foldsFrom/foldedVerdict). Reverse the two and the fold would compose against a precision
  // flag that does not exist yet, and its announced arithmetic would disagree with hitTargets.
  ["dnd5e.rollAttackV2", "maneuvers.js", "d20-folds.js",
    "precision stamps before the d20 fold composes over it — the fold reads every flag already on the attack"],
  ["dnd5e.renderChatMessage", "volleys.js", "saves.js",
    "the volley row renders above the saves rows on a shared usage card (v1.20.0 entry order)"],
  ["dnd5e.renderChatMessage", "receipts.js", "resources.js",
    "the spend line is the usage card's footer — below every workflow row (v1.20.0 entry order)"],
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
process.exit(ok ? 0 : 1);
