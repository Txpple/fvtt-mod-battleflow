import { describe, expect, it } from "vitest";
import { eitherRise, foldRise, rerollRise } from "../scripts/decide/dice-chips.js";

// the dice that rise, scoped to "dice number changes" (the user, 2026-09-26)

describe("rerollRise - Empowered's and Healer's rerolled dice turn over", () => {
  it("each rerolled die turns over from its old face", () => {
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
});

describe("eitherRise - Savage Attacker's set rolled again", () => {
  it("the set that stands glows, the other is struck; a tie keeps the first", () => {
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

describe("foldRise - a d20 fold whose number changed", () => {
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
  it("a face it cannot read draws nothing", () => {
    expect(foldRise({ mode: "reroll", oldFace: null, newFace: 12, on: "Actor.r" })).toBeNull();
  });
});
