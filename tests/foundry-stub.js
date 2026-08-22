/**
 * The minimum Foundry/dnd5e surface a REGISTRY or DECISION module touches at import time.
 *
 * ⚠ THAT THIS FILE HAS TO EXIST IS THE FINDING. A registry is data (ARCHITECTURE.md §6) and
 * should import into a bare Node process with no globals at all. Today `volley-registry.js`
 * registers an `init` hook at module scope to publish itself on the module API, so importing
 * it without a `Hooks` global throws. PLAN.md Phase 2 moves that publication to the EDGE
 * layer, and this stub shrinks to nothing.
 *
 * Keep it MINIMAL on purpose. Anything a test needs beyond this is a signal that the code
 * under test is EDGE, not DECISION — and EDGE belongs in the live suites (ARCHITECTURE.md §2).
 */
export function installFoundryStub() {
  globalThis.Hooks = {
    once: () => {},
    on: () => {},
    call: () => true,
    callAll: () => {}
  };
  globalThis.game = { modules: { get: () => null } };
  globalThis.dnd5e = {
    utils: {
      /** The real one evaluates a roll formula against roll data; ours handles the shapes the
       *  registry actually ships: an integer, and `n + @item.level`. */
      simplifyBonus: (formula, data = {}) => {
        const resolved = String(formula).replace(/@([\w.]+)/g, (_, path) =>
          String(path.split(".").reduce((o, k) => o?.[k], data) ?? 0)
        );
        if (!/^[\d+\-*/(). ]+$/.test(resolved)) return 0;
        try {
          return Number(new Function(`return (${resolved})`)()) || 0;
        } catch {
          return 0;
        }
      }
    }
  };
}
