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
