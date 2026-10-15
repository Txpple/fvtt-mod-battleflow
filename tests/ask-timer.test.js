import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
const messages = new Map();
const stub = {
  modules: { get: () => null },
  messages: { get: id => messages.get(id) ?? null },
  users: { activeGM: null }
};
Object.assign(globalThis, { game: stub });

const { armAskTimer, disarmAskTimer, electOwns, keeperOwns, subjectOwns } = await import(
  "../scripts/ui.js"
);
const { MODULE_ID } = await import("../scripts/core.js");

/** A chat message as the clock reads it: the module's flag under the new scope. */
function card(id, flag, { isAuthor = true, authorActive = true } = {}) {
  const m = {
    id,
    isAuthor,
    author: { active: authorActive },
    flags: { [MODULE_ID]: { ask: flag } },
    getFlag: (scope, key) => m.flags[scope]?.[key] ?? undefined
  };
  messages.set(id, m);
  return m;
}
const owner = () => true;
const nobody = () => false;

beforeEach(() => {
  vi.useFakeTimers();
  messages.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * THE DECISION CLOCK (ui.js `armAskTimer`, ARCHITECTURE §3 *The clocks*): one owner's timer per
 * moment off the flag's absolute deadline, re-checked against the live flag when it runs out.
 */
describe("armAskTimer — one owner, one clock, re-checked at expiry", () => {
  it("arms on the owner and fires the expiry with the live message once the deadline passes", async () => {
    const timers = new Map();
    const m = card("a", { status: "pending", deadline: Date.now() + 5000 });
    const expire = vi.fn();
    armAskTimer(timers, m, "ask", expire, { owns: owner });
    expect(timers.has("a")).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(expire).toHaveBeenCalledWith(m);
    expect(timers.has("a")).toBe(false);
  });

  it("arms nothing for a client that does not own the clock", () => {
    const timers = new Map();
    armAskTimer(
      timers,
      card("b", { status: "pending", deadline: Date.now() + 5000 }),
      "ask",
      vi.fn(),
      { owns: nobody }
    );
    expect(timers.size).toBe(0);
  });

  it("re-arming is a no-op while the clock stands, and the clock drops once the moment is answered", () => {
    const timers = new Map();
    const m = card("c", { status: "pending", deadline: Date.now() + 5000 });
    armAskTimer(timers, m, "ask", vi.fn(), { owns: owner });
    const handle = timers.get("c");
    armAskTimer(timers, m, "ask", vi.fn(), { owns: owner });
    expect(timers.get("c")).toBe(handle);
    m.flags[MODULE_ID].ask = { status: "resolved", answer: "pass", deadline: Date.now() + 5000 };
    armAskTimer(timers, m, "ask", vi.fn(), { owns: owner });
    expect(timers.size).toBe(0);
  });

  it("drops the clock when the client stops owning it", () => {
    const timers = new Map();
    const m = card("d", { status: "pending", deadline: Date.now() + 5000 });
    let mine = true;
    armAskTimer(timers, m, "ask", vi.fn(), { owns: () => mine });
    mine = false;
    armAskTimer(timers, m, "ask", vi.fn(), { owns: () => mine });
    expect(timers.size).toBe(0);
  });

  it("an answer that lands before the buzzer wins: the expiry re-reads the live flag", async () => {
    const timers = new Map();
    const m = card("e", { status: "pending", deadline: Date.now() + 1000 });
    const expire = vi.fn();
    armAskTimer(timers, m, "ask", expire, { owns: owner });
    m.flags[MODULE_ID].ask = {
      status: "pending",
      answer: "use",
      deadline: m.flags[MODULE_ID].ask.deadline
    };
    await vi.advanceTimersByTimeAsync(1000);
    expect(expire).not.toHaveBeenCalled();
  });

  it("a machine with its own notion of pending and of the deadline passes them in", async () => {
    const timers = new Map();
    const now = Date.now();
    const m = card("f", {
      targets: [{ done: true }, { done: false, due: now + 3000 }, { done: false, due: now + 9000 }]
    });
    const expire = vi.fn();
    const due = f => f.targets.filter(t => !t.done).map(t => t.due);
    armAskTimer(timers, m, "ask", expire, {
      owns: owner,
      pending: f => due(f).length > 0,
      deadline: f => Math.min(...due(f))
    });
    await vi.advanceTimersByTimeAsync(2999);
    expect(expire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it("disarmAskTimer clears the clock", () => {
    const timers = new Map();
    armAskTimer(
      timers,
      card("g", { status: "pending", deadline: Date.now() + 5000 }),
      "ask",
      vi.fn(),
      { owns: owner }
    );
    disarmAskTimer(timers, "g");
    expect(timers.size).toBe(0);
  });

  it("refuses a deadline past the staleness roof", () => {
    const timers = new Map();
    armAskTimer(
      timers,
      card("h", { status: "pending", deadline: Date.now() - 20 * 60 * 1000 }),
      "ask",
      vi.fn(),
      { owns: owner }
    );
    expect(timers.size).toBe(0);
  });
});

describe("the owners", () => {
  it("electOwns is the active GM's own client, and nobody with no GM", () => {
    stub.users.activeGM = null;
    expect(electOwns()).toBe(false);
    stub.users.activeGM = { isSelf: true };
    expect(electOwns()).toBe(true);
    stub.users.activeGM = { isSelf: false };
    expect(electOwns()).toBe(false);
    stub.users.activeGM = null;
  });

  it("keeperOwns is the card's author while connected, else the elect", () => {
    stub.users.activeGM = null;
    expect(keeperOwns({}, card("k1", {}, { isAuthor: true }))).toBe(true);
    expect(keeperOwns({}, card("k2", {}, { isAuthor: false, authorActive: true }))).toBe(false);
    stub.users.activeGM = { isSelf: true };
    expect(keeperOwns({}, card("k3", {}, { isAuthor: false, authorActive: false }))).toBe(true);
    stub.users.activeGM = null;
  });

  it("subjectOwns reads the subject off the flag and asks who drives its moments", () => {
    stub.users.activeGM = { isSelf: true };
    expect(subjectOwns(f => f.actorUuid)({ actorUuid: "Actor.x" })).toBe(true);
    stub.users.activeGM = { isSelf: false };
    expect(subjectOwns(f => f.actorUuid)({ actorUuid: "Actor.x" })).toBe(false);
    stub.users.activeGM = null;
  });
});
