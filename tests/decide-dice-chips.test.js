import { describe, expect, it } from "vitest";
import * as chips from "../scripts/decide/dice-chips.js";

const { reductionRise, rollChips } = chips;

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

describe("group 3 - the popups' choices replayed on the canvas", () => {
  it("Empowered: each rerolled die turns over from its old face", () => {
    const { rerollRise } = chips;
    expect(
      rerollRise({
        done: [
          { old: 1, new: 6 },
          { old: 2, new: 2 }
        ],
        on: "Actor.sorc"
      })
    ).toEqual({
      on: "Actor.sorc",
      chips: [
        { was: "1", label: "6", up: true },
        { was: "2", label: "2", up: true }
      ]
    });
    expect(rerollRise({ done: [], on: "Actor.sorc" })).toBeNull();
  });
  it("Savage Attacker: the set that stands glows, the other is struck; a tie keeps the first", () => {
    const { eitherRise } = chips;
    expect(eitherRise({ first: 5, second: 9, stands: "second", on: "Actor.a" }).chips).toEqual([
      { label: "5", drop: true },
      { label: "9", up: true }
    ]);
    expect(eitherRise({ first: 7, second: 7, stands: "first", on: "Actor.a" }).chips).toEqual([
      { label: "7", up: true },
      { label: "7", drop: true }
    ]);
  });
});

describe("group 4 - the bumps over the creature helped", () => {
  const { foldRise, acChips } = chips;
  it("a die added is one gold +N", () => {
    expect(foldRise({ mode: "die", total: 4, on: "Actor.r" })).toEqual({
      on: "Actor.r",
      chips: [{ label: "+4", flat: true, up: true }]
    });
  });
  it("a reroll turns the d20 over", () => {
    expect(foldRise({ mode: "reroll", oldFace: 3, newFace: 17, on: "Actor.r" }).chips).toEqual([
      { was: "3", label: "17", up: true }
    ]);
  });
  it("Lucky's second d20: the higher gold, the other struck; a tie keeps the first", () => {
    expect(foldRise({ mode: "advantage", oldFace: 6, newFace: 15, on: "Actor.r" }).chips).toEqual([
      { label: "6", drop: true },
      { label: "15", up: true }
    ]);
    expect(foldRise({ mode: "advantage", oldFace: 9, newFace: 9, on: "Actor.r" }).chips).toEqual([
      { label: "9", up: true },
      { label: "9", drop: true }
    ]);
  });
  it("Shield: +5 AC; a bonus the sheet cannot state draws nothing", () => {
    expect(acChips(5)).toEqual([{ label: "+5 AC", flat: true, up: true }]);
    expect(acChips(null)).toEqual([]);
  });
});
