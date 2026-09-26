import { describe, expect, it } from "vitest";
import { reductionRise, rollChips } from "../scripts/decide/dice-chips.js";

// the damage reducers' dice (the user, 2026-09-26: group 2)
const d10 = (v, pb) => ({
  total: v + pb,
  terms: [{ faces: 10, results: [{ result: v, active: true }] }, { number: pb }]
});

describe("rollChips - a roll as the chips the canvas draws", () => {
  it("each die, then what the formula added as one gold bonus chip", () => {
    expect(rollChips(d10(7, 3))).toEqual([{ label: "7" }, { label: "+3", flat: true, up: true }]);
    expect(
      rollChips({ total: 4, terms: [{ faces: 4, results: [{ result: 4, active: true }] }] })
    ).toEqual([{ label: "4" }]);
  });
  it("a discarded die does not show", () => {
    expect(
      rollChips({
        total: 5,
        terms: [
          {
            faces: 6,
            results: [
              { result: 2, active: false },
              { result: 5, active: true }
            ]
          }
        ]
      })
    ).toEqual([{ label: "5" }]);
  });
});

describe("reductionRise - the record a reduction's roll carries", () => {
  it("rises off the guard, the reduction drifting to the ally", () => {
    expect(reductionRise({ roll: d10(7, 3), from: "Actor.guard", to: "Actor.ally" })).toEqual({
      on: "Actor.guard",
      chips: [{ label: "7" }, { label: "+3", flat: true, up: true }],
      drift: { to: "Actor.ally", label: "−10" }
    });
  });
  it("a reduction of one's own drifts nowhere; nothing rolled, nothing drawn", () => {
    expect(reductionRise({ roll: d10(5, 2), from: "Actor.me" }).drift.to).toBe("Actor.me");
    expect(reductionRise({ roll: { total: 0, terms: [] }, from: "Actor.me" })).toBeNull();
  });
});
