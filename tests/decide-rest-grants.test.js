import { beforeAll, describe, expect, it } from "vitest";

describe("the rest grants given to allies (the PHB feats, group 5, 2026-09-27)", () => {
  /** @type {typeof import("../scripts/decide/rest-grants.js")} */
  let g;
  beforeAll(async () => {
    g = await import("../scripts/decide/rest-grants.js");
  });

  it("Temporary Hit Points do not stack: a grant lands only where it is MORE than the creature holds", () => {
    expect(g.holdsTemp(0, 13)).toBe(false);
    expect(g.holdsTemp(5, 13)).toBe(false);
    expect(g.holdsTemp(13, 13)).toBe(true);
    expect(g.holdsTemp(20, 13)).toBe(true);
    expect(g.holdsTemp(undefined, 3)).toBe(false);
    expect(g.holdsTemp(0, 0)).toBe(true); // nothing to give is nothing gained
  });

  const chef = { at: 1_000_000, requestId: null };
  it("the meal: an eater whose own Short Rest ended in the same sitting and spent Hit Dice is served now", () => {
    expect(g.mealStanding({ rest: { at: 1_000_500, hitDice: 2 }, chef })).toBe("spent");
  });
  it("…one that spent none is greyed — the food does it no good", () => {
    expect(g.mealStanding({ rest: { at: 999_000, hitDice: 0 }, chef })).toBe("none");
  });
  it("…one with no Short Rest of its own in this sitting is still resting — the extra waits for its rest's end", () => {
    expect(g.mealStanding({ rest: null, chef })).toBe("resting");
    expect(g.mealStanding({ rest: { at: 1_000_000 - 3 * 60 * 60 * 1000, hitDice: 3 }, chef })).toBe(
      "resting"
    );
  });
  it("a Rest request settles the sitting when both rests answer one — the clock does not", () => {
    const requested = { at: 1_000_000, requestId: "req1" };
    expect(
      g.mealStanding({ rest: { at: 50, hitDice: 1, requestId: "req1" }, chef: requested })
    ).toBe("spent");
    expect(
      g.mealStanding({ rest: { at: 1_000_100, hitDice: 1, requestId: "req0" }, chef: requested })
    ).toBe("resting");
    // one side with no request: the window decides
    expect(
      g.mealStanding({ rest: { at: 1_000_100, hitDice: 1, requestId: null }, chef: requested })
    ).toBe("spent");
  });
});
