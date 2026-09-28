import { describe, expect, it, vi } from "vitest";
import * as dispatch from "../scripts/dispatch.js";
import { registrations } from "../scripts/dispatch.js";

/** The platform's registry, as the dispatcher sees it: one listener per hook name. */
const platform = new Map();
globalThis.Hooks = {
  on: (hook, fn) => {
    platform.set(hook, fn);
    return 1;
  },
  once: () => 1,
  call: () => true,
  callAll: () => {}
};

/** Fire `hook` as the platform would. */
const fire = (hook, ...args) => platform.get(hook)?.(...args);

let n = 0;
/** A fresh hook name per test: the dispatcher is module-level state. */
const hookName = () => `test.hook.${n++}`;

describe("the order table", () => {
  it("lists each key once, and the load-bearing neighbours in the right order", () => {
    const { ORDER } = dispatch;
    expect(new Set(ORDER).size).toBe(ORDER.length);
    const at = key => ORDER.indexOf(key);
    expect(at("ui")).toBeLessThan(at("hold/views"));
    expect(at("hold/spell-damage")).toBeLessThan(at("concentration"));
    expect(at("reminders") + 1).toBe(at("advantage-buys"));
    expect(at("saves/views")).toBeLessThan(at("receipts"));
    expect(at("receipts")).toBeLessThan(at("resources"));
  });

  it("refuses a key outside the table", () => {
    expect(() => dispatch.listen(hookName(), "no-such-file", () => {})).toThrow(/not in ORDER/);
  });

  it("refuses a handler that is not a function", () => {
    expect(() => dispatch.listen(hookName(), "ui", null)).toThrow(/not a function/);
  });
});

describe("dispatch", () => {
  it("registers ONE platform listener per hook and runs the handlers in ORDER, not registration order", () => {
    const hook = hookName();
    const ran = [];
    dispatch.listen(hook, "receipts", () => ran.push("receipts"));
    dispatch.listen(hook, "ui", () => ran.push("ui"));
    dispatch.listen(hook, "mastery", () => ran.push("mastery"));
    dispatch.listen(hook, "ui", () => ran.push("ui-2"));
    expect(platform.has(hook)).toBe(true);
    fire(hook);
    expect(ran).toEqual(["ui", "ui-2", "mastery", "receipts"]);
  });

  it("passes the platform's arguments through", () => {
    const hook = hookName();
    const seen = [];
    dispatch.listen(hook, "ui", (a, b, c) => seen.push([a, b, c]));
    fire(hook, 1, "two", { three: 3 });
    expect(seen).toEqual([[1, "two", { three: 3 }]]);
  });

  it("isolates a throwing handler: the ones behind it still run", () => {
    const hook = hookName();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ran = [];
    dispatch.listen(hook, "ui", () => {
      throw new Error("boom");
    });
    dispatch.listen(hook, "mastery", () => ran.push("mastery"));
    fire(hook);
    expect(ran).toEqual(["mastery"]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/ui's test\.hook\.\d+ handler failed/);
    error.mockRestore();
  });

  it("runs a listenOnce handler on the first dispatch only", () => {
    const hook = hookName();
    let count = 0;
    dispatch.listenOnce(hook, "ui", () => count++);
    fire(hook);
    fire(hook);
    expect(count).toBe(1);
  });
});

describe("the veto", () => {
  it("stops the chain and returns false on a VETOABLE hook", () => {
    const hook = "dnd5e.preApplyDamage";
    const ran = [];
    dispatch.listen(hook, "hold/spell-damage", () => {
      ran.push("veto");
      return false;
    });
    dispatch.listen(hook, "concentration", () => ran.push("capture"));
    expect(fire(hook)).toBe(false);
    expect(ran).toEqual(["veto"]);
  });

  it("ignores a false on a callAll hook: every handler runs", () => {
    const hook = hookName();
    const ran = [];
    dispatch.listen(hook, "ui", () => {
      ran.push("first");
      return false;
    });
    dispatch.listen(hook, "mastery", () => ran.push("second"));
    expect(fire(hook)).toBeUndefined();
    expect(ran).toEqual(["first", "second"]);
  });

  it("VETOABLE names only Hooks.call hooks: the pre-hooks and the platform's call sites", () => {
    for (const hook of dispatch.VETOABLE) {
      expect(hook).toMatch(
        /^(dnd5e\.)?(pre[A-Z]|postUseActivity|post\w*RollConfiguration|rollDeathSave)/
      );
    }
  });
});

describe("registrations", () => {
  it("reports every handler in dispatch order per hook, with its key and its once-ness", () => {
    const hook = hookName();
    dispatch.listen(hook, "stats", () => {});
    dispatch.listenOnce(hook, "events", () => {});
    const mine = registrations().filter(r => r.hook === hook);
    expect(mine).toEqual([
      { hook, key: "events", once: true },
      { hook, key: "stats", once: false }
    ]);
  });
});
