// THE MODULE'S HOOK REGISTRATIONS, IN TRUE EVALUATION ORDER — no Foundry, no world.
//
// Loads `scripts/battleflow.js` in Node behind stubbed globals and records every
// `Hooks.on`/`Hooks.once` in the order the module bodies run. Read by `check-hook-order.mjs`
// (relative order on one hook) and `check-hook-dispatch.mjs` (is the name ever dispatched).
// Shared so the stack-frame attribution below is never copied and fixed in one copy only.
//
// ⚠ CALL IT ONCE PER PROCESS: ESM caches modules, so a second call returns the SAME list.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Every `Hooks.on`/`once` the module performs at import time, in evaluation order.
 * @returns {Promise<Array<{hook: string, file: string}>>} registration order, not entry order
 */
export async function loadRegistrations() {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = pathToFileURL(join(here, "..", "scripts", "battleflow.js")).href;

  const reg = []; // { hook, file } in registration order
  const fileFromStack = () => {
    const frame = (new Error().stack ?? "").split("\n").find(l => l.includes("/scripts/"));
    // A directory machine's part reads as `saves/views.js`.
    return frame?.match(/scripts\/([\w./-]+\.js)/)?.[1] ?? "?";
  };
  globalThis.Hooks = {
    on: hook => { reg.push({ hook, file: fileFromStack() }); },
    once: hook => { reg.push({ hook, file: fileFromStack() }); }
  };
  // Eval-time surface only: anything needing more than these stubs at import time is itself a bug.
  globalThis.game = {};
  globalThis.foundry = {};
  globalThis.dnd5e = {};
  globalThis.CONFIG = {};
  globalThis.ui = {};

  await import(entry);
  return reg;
}

/**
 * The same list grouped by hook name, values in evaluation order. Insertion order of the map is
 * first-registration order, which is what `check-hook-order.mjs` prints.
 * @param {Array<{hook: string, file: string}>} reg
 * @returns {Map<string, string[]>} hook name → the files that registered on it, in order
 */
export function groupByHook(reg) {
  const out = new Map();
  for (const { hook, file } of reg) {
    if (!out.has(hook)) out.set(hook, []);
    out.get(hook).push(file);
  }
  return out;
}
