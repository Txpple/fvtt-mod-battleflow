import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
Object.assign(globalThis, {
  game: { modules: { get: () => null }, messages: { get: () => null }, users: { activeGM: null } }
});

const { closePopup, frontPopup, livePopups } = await import("../scripts/ui.js");

/** A dialog as the registry holds it; its close answers with `closing` (a promise, or a throw). */
function dialog(closing = () => Promise.resolve()) {
  return { close: vi.fn(closing), bringToFront: vi.fn() };
}

beforeEach(() => {
  livePopups.clear();
});

/**
 * THE CLOSE (ui.js `closePopup`, ARCHITECTURE §5 *The pending row*): a moment's popup closes through
 * the spine, the close awaited and a dialog already gone swallowed.
 */
describe("closePopup — awaited, and a dialog already gone is the state wanted", () => {
  it("closes the open popup and answers true; a closed one answers false", async () => {
    const d = dialog();
    livePopups.set("m1|ask", d);
    await expect(closePopup({ id: "m1" }, "ask")).resolves.toBe(true);
    expect(d.close).toHaveBeenCalledWith();
    await expect(closePopup({ id: "m1" }, "other")).resolves.toBe(false);
  });

  it("swallows a close that rejects or throws: the rejection never escapes", async () => {
    livePopups.set(
      "m2|ask",
      dialog(() => Promise.reject(new Error("already gone")))
    );
    livePopups.set(
      "m2|guard",
      dialog(() => {
        throw new Error("no element");
      })
    );
    await expect(closePopup({ id: "m2" }, "ask")).resolves.toBe(true);
    await expect(closePopup({ id: "m2" }, "guard")).resolves.toBe(true);
  });

  it("waits for the close before it answers", async () => {
    let finish;
    const d = dialog(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    livePopups.set("m3|ask", d);
    let done = false;
    const closing = closePopup({ id: "m3" }, "ask").then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    await closing;
    expect(done).toBe(true);
  });

  it("hands its options to the close, and takes an id for a popup keyed off one", async () => {
    const d = dialog();
    livePopups.set("Item.abc|gearLight", d);
    await closePopup("Item.abc", "gearLight", { force: true });
    expect(d.close).toHaveBeenCalledWith({ force: true });
  });

  it("closes every popup of the message a test picks, and none of another message's", async () => {
    const dropped = dialog();
    const kept = dialog();
    const elsewhere = dialog();
    livePopups.set("m4|save:a", kept);
    livePopups.set("m4|save:b", dropped);
    livePopups.set("m5|save:b", elsewhere);
    await expect(closePopup({ id: "m4" }, sub => sub === "save:b")).resolves.toBe(true);
    expect(dropped.close).toHaveBeenCalledTimes(1);
    expect(kept.close).not.toHaveBeenCalled();
    expect(elsewhere.close).not.toHaveBeenCalled();
    await expect(closePopup({ id: "m4" }, () => false)).resolves.toBe(false);
  });
});

describe("frontPopup — an opener never builds a second popup", () => {
  it("brings an open popup forward and answers true; answers false when none is open", () => {
    const d = dialog();
    livePopups.set("m6|damage", d);
    expect(frontPopup({ id: "m6" }, "damage")).toBe(true);
    expect(d.bringToFront).toHaveBeenCalledTimes(1);
    expect(frontPopup({ id: "m6" }, "volley")).toBe(false);
  });
});
