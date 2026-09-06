// THE MODULE'S HOOK REGISTRATIONS, IN TRUE EVALUATION ORDER — no Foundry, no world.
//
// Loads `scripts/battleflow.js` in Node behind stubbed globals and records every
// `Hooks.on`/`Hooks.once` call in the order the module bodies actually run. Two gate checks read
// it and they ask different questions of the same list:
//
//   - `check-hook-order.mjs`   — is the RELATIVE ORDER of two registrations on one hook correct?
//   - `check-hook-dispatch.mjs` — is that hook NAME one the system ever dispatches?
//
// ⚠ THIS IS SHARED BECAUSE THE TRICK IS SUBTLE, NOT TO SAVE LINES. The stack-frame walk below is
// how a registration is attributed to a file, and it is the kind of machinery that gets copied,
// then fixed in one copy. D1's lesson, applied to `tools/`.
//
// ⚠ CALL IT ONCE PER PROCESS. ESM caches modules: a second call returns the SAME list because the
// entry's bodies do not run again. Two checks therefore stay two processes — which they are.
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
    // A directory machine's part reads as `saves/views.js` — the slash is in the class since
    // Stage 4c (2026-09-05); before it every part would have read as "?".
    return frame?.match(/scripts\/([\w./-]+\.js)/)?.[1] ?? "?";
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
