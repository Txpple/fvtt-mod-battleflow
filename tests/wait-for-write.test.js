import { afterEach, describe, expect, it, vi } from "vitest";

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
globalThis.game = { modules: { get: () => null } };

const { waitForWrite } = await import("../scripts/ui.js");

/** Fire `hook` as the platform would, with a message that carries no module flag. */
const fire = hook => platform.get(hook)?.({ id: "m", getFlag: () => null }, {});

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForWrite — the one wait", () => {
  it("answers at once when the test already holds, without waiting for a write", async () => {
    await expect(waitForWrite(() => "here", { ms: 1000 })).resolves.toBe("here");
  });

  it("answers on the first message write that makes the test hold", async () => {
    let card = null;
    const waiting = waitForWrite(() => card, { ms: 10_000 });
    fire("createChatMessage");
    card = { id: "card" };
    fire("updateChatMessage");
    await expect(waiting).resolves.toEqual({ id: "card" });
  });

  it("ignores a write of a kind it does not listen for", async () => {
    vi.useFakeTimers();
    let arrived = false;
    const waiting = waitForWrite(() => arrived, { ms: 500 });
    arrived = true;
    fire("updateActor");
    vi.advanceTimersByTime(500);
    await expect(waiting).resolves.toBeNull();
  });

  it("listens for the document writes it names", async () => {
    let ac = 15;
    const waiting = waitForWrite(() => ac === 20, { ms: 10_000, on: ["updateActor"] });
    ac = 20;
    fire("updateActor");
    await expect(waiting).resolves.toBe(true);
  });

  it("answers null when the time runs out", async () => {
    vi.useFakeTimers();
    const waiting = waitForWrite(() => null, { ms: 4000 });
    vi.advanceTimersByTime(3999);
    fire("createChatMessage");
    vi.advanceTimersByTime(1);
    await expect(waiting).resolves.toBeNull();
  });

  it("treats a throwing test as not yet, and keeps waiting", async () => {
    let ready = false;
    const waiting = waitForWrite(
      () => {
        if (!ready) throw new Error("not loaded");
        return "loaded";
      },
      { ms: 10_000 }
    );
    fire("createChatMessage");
    ready = true;
    fire("createChatMessage");
    await expect(waiting).resolves.toBe("loaded");
  });

  it("refuses a write kind it has no listener for", () => {
    expect(() => waitForWrite(() => null, { ms: 10, on: ["deleteToken"] })).toThrow(/WAIT_ON/);
  });
});
