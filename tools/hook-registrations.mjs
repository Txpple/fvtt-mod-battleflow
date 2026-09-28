// THE MODULE'S HOOK REGISTRATIONS, IN DISPATCH ORDER — no Foundry, no world.
//
// Loads `scripts/battleflow.js` in Node behind stubbed globals, then reads the dispatcher's own
// registry (scripts/dispatch.js `registrations()`): every `listen` / `listenOnce`, per hook, in the
// order the handlers run. Read by `check-hook-order.mjs` (the order table), `check-hook-dispatch.mjs`
// (is the name ever dispatched) and `hook-coverage.mjs` (which registrations a battery exercised).
//
// ⚠ CALL IT ONCE PER PROCESS: ESM caches modules, so a second call returns the SAME list.
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Every handler the module registers at import time, in dispatch order per hook.
 * @returns {Promise<Array<{hook: string, key: string, file: string, once: boolean}>>}
 *   `key` is the dispatcher's key (the scripts-relative path without `.js`); `file` adds the `.js`
 */
export async function loadRegistrations() {
  const here = dirname(fileURLToPath(import.meta.url));
  const entry = pathToFileURL(join(here, "..", "scripts", "battleflow.js")).href;
  const dispatcher = pathToFileURL(join(here, "..", "scripts", "dispatch.js")).href;

  // Eval-time surface only: anything needing more than these stubs at import time is itself a bug.
  globalThis.Hooks = { on: () => 0, once: () => 0, call: () => true, callAll: () => {} };
  globalThis.game = {};
  globalThis.foundry = {};
  globalThis.dnd5e = {};
  globalThis.CONFIG = {};
  globalThis.ui = {};

  await import(entry);
  const { registrations } = await import(dispatcher);
  return registrations().map(r => ({ hook: r.hook, key: r.key, file: `${r.key}.js`, once: r.once }));
}

/**
 * The same list grouped by hook name, values (files) in dispatch order. Insertion order of the map
 * is first-registration order.
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
