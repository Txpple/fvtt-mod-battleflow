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
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = pathToFileURL(join(here, "..", "scripts", "battleflow.js")).href;

const reg = []; // { hook, file } in registration order
const fileFromStack = () => {
  const frame = (new Error().stack ?? "").split("\n").find(l => l.includes("/scripts/"));
  return frame?.match(/scripts\/([\w.-]+\.js)/)?.[1] ?? "?";
};
globalThis.Hooks = {
  on: hook => { reg.push({ hook, file: fileFromStack() }); },
  once: hook => { reg.push({ hook, file: fileFromStack() }); }
};
// Eval-time surface only: module bodies register hooks and declare functions. Anything
// that needs more than these stubs at import time is itself a bug (work belongs in hooks).
globalThis.game = {};
globalThis.foundry = {};
globalThis.dnd5e = {};
globalThis.CONFIG = {};
globalThis.ui = {};

await import(entry);

const byHook = new Map();
for (const { hook, file } of reg) {
  if (!byHook.has(hook)) byHook.set(hook, []);
  byHook.get(hook).push(file);
}
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
  ["dnd5e.renderChatMessage", "ui.js", "mastery.js",
    "hold rows render above mastery rows on a shared attack card"],
  ["dnd5e.renderChatMessage", "mastery.js", "receipts.js",
    "mastery rows render above receipt rows on a shared attack card"]
];
let ok = true;
for (const [hook, a, b, why] of CHECKS) {
  const pass = before(hook, a, b);
  if (!pass) ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${hook}: ${a} before ${b} — ${why}`);
}
if (!ok) console.log("\nOrder regressed — re-read the HANDOFF ESM ground truth before shipping this.");
process.exit(ok ? 0 : 1);
