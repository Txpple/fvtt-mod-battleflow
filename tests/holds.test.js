import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installFoundryStub } from "./foundry-stub.js";

installFoundryStub();

/** @type {typeof import("../scripts/holds.js")} */
let holds;
beforeAll(async () => {
  holds = await import("../scripts/holds.js");
});

/** Collect what the registry announces, so a test can assert the hook fired once and not per raise. */
function watchHooks() {
  const seen = [];
  const previous = globalThis.Hooks.callAll;
  globalThis.Hooks.callAll = (name, data) => {
    seen.push({ name, data });
  };
  return {
    seen,
    restore: () => {
      globalThis.Hooks.callAll = previous;
    }
  };
}

let subjectN = 0;
/** A fresh subject per test — the registry is module-level state and tests must not share a key. */
const subject = () => `Actor.test.Item.test.Activity.${subjectN++}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("holdFor — the answer another module reads", () => {
  it("answers null when nothing is holding", () => {
    expect(holds.holdFor(subject())).toBe(null);
  });

  it("answers null for an empty or missing subject rather than throwing", () => {
    expect(holds.holdFor("")).toBe(null);
    expect(holds.holdFor(null)).toBe(null);
    expect(holds.holdFor(undefined)).toBe(null);
  });

  it("takes a document-shaped subject by its uuid", () => {
    const uuid = subject();
    holds.raiseHold({ uuid }, { reason: "test" });
    expect(holds.holdFor(uuid)).toBeInstanceOf(Promise);
    holds.releaseHold(uuid, null);
  });

  it("settles with the card that lifted the hold", async () => {
    const uuid = subject();
    const card = { id: "the-real-card" };
    holds.raiseHold(uuid, { reason: "test" });
    const waiting = holds.holdFor(uuid);
    holds.releaseHold(uuid, card);
    await expect(waiting).resolves.toBe(card);
  });

  /**
   * ⚠ THE DISTINCTION A CONSUMER MUST NOT COLLAPSE, and the reason it is pinned here: a null
   * RETURN means "nothing is holding, play now"; a null RESOLUTION means "the hold lifted and
   * no card was posted, play NOTHING". They are opposite instructions that look identical.
   */
  it("distinguishes a null return from a null resolution", async () => {
    const uuid = subject();
    expect(holds.holdFor(uuid)).toBe(null);
    holds.raiseHold(uuid, { reason: "test" });
    const waiting = holds.holdFor(uuid);
    expect(waiting).not.toBe(null);
    holds.releaseHold(uuid, null);
    await expect(waiting).resolves.toBe(null);
  });
});

describe("the refcount — decision 1, and the one a modal sequence needs", () => {
  /**
   * Today exactly one thing ever holds, so a boolean would pass every other test in this file
   * and then cost a migration the first time a SEQUENCE of windows holds one subject.
   */
  it("stays held until the LAST raise is lowered", async () => {
    const uuid = subject();
    const lowerFirst = holds.raiseHold(uuid, { reason: "window-1" });
    const lowerSecond = holds.raiseHold(uuid, { reason: "window-2" });
    const waiting = holds.holdFor(uuid);

    lowerFirst();
    expect(holds.isHeld(uuid)).toBe(true);

    let settled = false;
    void waiting.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    lowerSecond();
    expect(holds.isHeld(uuid)).toBe(false);
    await expect(waiting).resolves.toBe(null);
  });

  it("lowers once however often the lowerer is called", () => {
    const uuid = subject();
    const lowerFirst = holds.raiseHold(uuid, { reason: "window-1" });
    holds.raiseHold(uuid, { reason: "window-2" });
    lowerFirst();
    lowerFirst();
    lowerFirst();
    expect(holds.isHeld(uuid)).toBe(true);
  });

  it("announces the hold once per subject, not once per raise", () => {
    const uuid = subject();
    const { seen, restore } = watchHooks();
    holds.raiseHold(uuid, { reason: "window-1" });
    holds.raiseHold(uuid, { reason: "window-2" });
    restore();
    expect(seen.filter(h => h.name === "battleflow.holdOpened")).toHaveLength(1);
    holds.releaseHold(uuid, null);
  });
});

describe("releaseHold — the terminal paths, where the question has stopped being askable", () => {
  it("settles however many raises stand", async () => {
    const uuid = subject();
    holds.raiseHold(uuid, { reason: "window-1" });
    holds.raiseHold(uuid, { reason: "window-2" });
    const waiting = holds.holdFor(uuid);
    holds.releaseHold(uuid, null);
    expect(holds.isHeld(uuid)).toBe(false);
    await expect(waiting).resolves.toBe(null);
  });

  it("is idempotent — the answer and the deleted carrier may both fire", () => {
    const uuid = subject();
    holds.raiseHold(uuid, { reason: "test" });
    holds.releaseHold(uuid, { id: "card" });
    expect(() => holds.releaseHold(uuid, null)).not.toThrow();
    expect(holds.isHeld(uuid)).toBe(false);
  });

  it("does nothing for a subject nothing is holding", () => {
    expect(() => holds.releaseHold(subject(), null)).not.toThrow();
  });
});

describe("the self-bound — a hold whose moment carries a clock", () => {
  it("settles itself with null once the clock plus slack has run out", async () => {
    vi.useFakeTimers();
    const uuid = subject();
    holds.raiseHold(uuid, { reason: "test", bound: 1000 });
    const waiting = holds.holdFor(uuid);
    expect(holds.isHeld(uuid)).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(holds.isHeld(uuid)).toBe(false);
    await expect(waiting).resolves.toBe(null);
  });

  /**
   * ⚠ A clockless ask gets a clockless hold ON PURPOSE (ARCHITECTURE §5 law 11: a moment waits
   * forever only by explicit setting). A default bound here would lift the hold while the caster
   * is still reading the question.
   */
  it("does not bound a hold raised without one", () => {
    vi.useFakeTimers();
    const uuid = subject();
    holds.raiseHold(uuid, { reason: "test" });
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(holds.isHeld(uuid)).toBe(true);
    holds.releaseHold(uuid, null);
  });

  it("does not fire its bound after the hold was released normally", async () => {
    vi.useFakeTimers();
    const uuid = subject();
    holds.raiseHold(uuid, { reason: "test", bound: 1000 });
    const waiting = holds.holdFor(uuid);
    const card = { id: "card" };
    holds.releaseHold(uuid, card);
    vi.advanceTimersByTime(5000);
    await expect(waiting).resolves.toBe(card);
  });
});
