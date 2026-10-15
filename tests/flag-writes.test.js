import { beforeAll, describe, expect, it } from "vitest";
import { installFoundryStub } from "./foundry-stub.js";

installFoundryStub();

/** @type {typeof import("../scripts/core.js")} */
let core;
beforeAll(async () => {
  core = await import("../scripts/core.js");
});

/**
 * THE SERIALIZER'S DELETIONS (core.js `markDeletions`, ARCHITECTURE §11 *Converting a write to
 * the serializer* rule 4). `setFlag` merges, so a key a mutate callback deleted stayed stored —
 * a silent no-op the 2026-09-28 review found (dice-changers' `answered`). The write now carries
 * the platform's `"-=key": null` for every key that went missing.
 */
describe("markDeletions — a deleted key reaches the store", () => {
  it("marks a top-level key the callback deleted", () => {
    const before = { status: "pending", answered: ["a"], targets: [] };
    const after = { status: "pending", targets: [] };
    expect(core.markDeletions(before, after)).toEqual({
      status: "pending",
      targets: [],
      "-=answered": null
    });
  });

  it("recurses into nested objects", () => {
    const before = { pending: { rolls: [], at: 1 }, x: 1 };
    const after = { pending: { rolls: [] }, x: 1 };
    expect(core.markDeletions(before, after)).toEqual({
      pending: { rolls: [], "-=at": null },
      x: 1
    });
  });

  it("treats an array as a value — replaced whole, never marked inside", () => {
    const before = { targets: [{ uuid: "a", answer: "pass" }] };
    const after = { targets: [{ uuid: "a" }] };
    expect(core.markDeletions(before, after)).toEqual({ targets: [{ uuid: "a" }] });
  });

  it("marks nothing when nothing went missing, and leaves a changed value alone", () => {
    const before = { status: "pending", n: 1 };
    const after = { status: "answering", n: 1, extra: true };
    expect(core.markDeletions(before, after)).toEqual({ status: "answering", n: 1, extra: true });
  });

  it("hands back the clone untouched when either side is not a plain object", () => {
    expect(core.markDeletions(null, { a: 1 })).toEqual({ a: 1 });
    expect(core.markDeletions({ a: 1 }, "x")).toBe("x");
  });
});

/** A document as the serializer sees it: the module's flags, read and written by scope and key. */
function doc(id, flags = {}) {
  const d = {
    id,
    flags: { [core.MODULE_ID]: flags },
    writes: [],
    getFlag: (scope, key) => d.flags[scope]?.[key],
    setFlag: async (scope, key, value) => {
      d.writes.push(value);
      d.flags[scope] = { ...d.flags[scope], [key]: value };
    }
  };
  return d;
}

/**
 * THE SERIALIZER'S INITIAL SHAPE (core.js `queueFlagWrite`, ARCHITECTURE §11 *Converting a write to
 * the serializer* rule 6): a list or a map on an effect or a region starts from `[]` or `{}`, not
 * from the per-target default.
 */
describe("queueFlagWrite — the flag's shape when the document has none", () => {
  beforeAll(() => {
    globalThis.foundry = { utils: { deepClone: v => structuredClone(v) } };
  });

  it("starts a per-target flag from { targets: [] } by default", async () => {
    const d = doc("a");
    await core.queueFlagWrite(d, "hold", current => {
      current.targets.push({ uuid: "x" });
    });
    expect(d.writes).toEqual([{ targets: [{ uuid: "x" }] }]);
  });

  it("starts a list from [] and appends to what is stored next time", async () => {
    const d = doc("b");
    await core.queueFlagWrite(
      d,
      "rerollUsed",
      used => {
        used.push("k1");
      },
      { initial: [] }
    );
    await core.queueFlagWrite(
      d,
      "rerollUsed",
      used => {
        used.push("k2");
      },
      { initial: [] }
    );
    expect(d.writes).toEqual([["k1"], ["k1", "k2"]]);
  });

  it("starts a map from {} and keeps the keys already stored", async () => {
    const d = doc("c", { recoiled: { a: 1 } });
    await core.queueFlagWrite(
      d,
      "recoiled",
      m => {
        m.b = 2;
      },
      { initial: {} }
    );
    expect(d.writes).toEqual([{ a: 1, b: 2 }]);
  });

  it("skips the write when the callback returns false", async () => {
    const d = doc("d", { areas: ["r1"] });
    await core.queueFlagWrite(
      d,
      "areas",
      areas => (areas.includes("r1") ? false : areas.push("r1")),
      { initial: [] }
    );
    expect(d.writes).toEqual([]);
  });
});
