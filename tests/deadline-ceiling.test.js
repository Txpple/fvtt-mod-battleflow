import { beforeAll, describe, expect, it } from "vitest";
import { installFoundryStub } from "./foundry-stub.js";

installFoundryStub();

/** @type {typeof import("../scripts/core.js")} */
let core;
beforeAll(async () => {
  core = await import("../scripts/core.js");
});

/**
 * THE CEILING (core.js): `armDeadline` arms with `Math.max(0, deadline - Date.now())`, so a
 * past deadline fires on the next tick. That resume is DELIBERATE — a client that F5s
 * mid-moment is meant to let the buzzer land. The bound exists because two of the acting
 * buzzers roll dice (`fireSaveTimer`, `fireConcTimer`), so a card left pending in the world
 * would roll for a fight that ended months ago the instant somebody opened it.
 */
describe("deadlineIsLive — the roof on the moment clocks", () => {
  const now = () => Date.now();

  it("arms a deadline still in the future", () => {
    expect(core.deadlineIsLive(now() + 15_000)).toBe(true);
  });

  it("arms a deadline the current window just missed — the F5 resume", () => {
    // The specified volley behaviour: if the deadline passed while away, the even spread
    // fires on reload rather than stranding the card.
    expect(core.deadlineIsLive(now() - 5_000)).toBe(true);
  });

  it("still arms across the widest measured cold boot", () => {
    // A cold Molten start has needed ~540s of headroom; that must not read as history.
    expect(core.deadlineIsLive(now() - 540_000)).toBe(true);
  });

  it("refuses a deadline past the ceiling — the table has moved on", () => {
    expect(core.deadlineIsLive(now() - (core.DEADLINE_CEILING_MS + 1_000))).toBe(false);
  });

  it("refuses a deadline from a fight that ended months ago", () => {
    expect(core.deadlineIsLive(now() - 90 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("treats a missing deadline as never-arm, not as zero", () => {
    // Zero is falsy AND is 1970 — both readings must refuse, and `armDeadline`'s own
    // `!deadline` guard agrees. A stub returning undefined must not arm either.
    expect(core.deadlineIsLive(undefined)).toBe(false);
    expect(core.deadlineIsLive(null)).toBe(false);
    expect(core.deadlineIsLive(0)).toBe(false);
  });

  it("holds the ceiling at ten minutes, the documented value", () => {
    // Pinned so a future edit to the constant is a deliberate act with a test to update,
    // not a silent narrowing that strands live resumes.
    expect(core.DEADLINE_CEILING_MS).toBe(600_000);
  });
});
