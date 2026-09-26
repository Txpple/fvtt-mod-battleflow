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

describe("changedDice - the dice the platform changed on its own (option A)", () => {
  it("Halfling Luck: a rerolled 1 turns over to the new face", async () => {
    const { changedDice } = await import("../scripts/decide/dice-chips.js");
    const d20 = {
      faces: 20,
      modifiers: ["r1=1"],
      results: [
        { result: 1, active: false, rerolled: true },
        { result: 14, active: true }
      ]
    };
    expect(changedDice([{ terms: [d20] }])).toEqual([{ was: "1", label: "14", up: true }]);
  });
  it("Reliable Talent: a floored d20 shows its face and its count", async () => {
    const { changedDice } = await import("../scripts/decide/dice-chips.js");
    const d20 = {
      faces: 20,
      modifiers: ["min10"],
      results: [{ result: 4, count: 10, active: true }]
    };
    expect(changedDice([{ terms: [d20] }])).toEqual([{ was: "4", label: "10", up: true }]);
  });
  it("Reliable Talent as dnd5e 6.0.5 writes it: the floored die is marked rerolled, still live", async () => {
    const { changedDice } = await import("../scripts/decide/dice-chips.js");
    const d20 = {
      faces: 20,
      modifiers: ["min10"],
      results: [{ result: 1, active: true, count: 10, rerolled: true }]
    };
    expect(changedDice([{ terms: [d20] }])).toEqual([{ was: "1", label: "10", up: true }]);
  });
  it("Halfling Luck and Reliable Talent together: the 1 turns over to the reroll", async () => {
    const { changedDice } = await import("../scripts/decide/dice-chips.js");
    const d20 = {
      faces: 20,
      modifiers: ["r1=1", "min10"],
      results: [
        { result: 1, active: false, rerolled: true, count: 10 },
        { result: 16, active: true }
      ]
    };
    expect(changedDice([{ terms: [d20] }])).toEqual([{ was: "1", label: "16", up: true }]);
  });
  it("a roll nothing changed draws nothing; a discarded Advantage die is not a change", async () => {
    const { changedDice } = await import("../scripts/decide/dice-chips.js");
    const adv = {
      faces: 20,
      modifiers: ["kh"],
      results: [
        { result: 3, active: false, discarded: true },
        { result: 17, active: true }
      ]
    };
    expect(
      changedDice([{ terms: [adv, { faces: 6, results: [{ result: 5, active: true }] }] }])
    ).toEqual([]);
  });
});

describe("a reaction that modifies a roll - the reductions, Shield, a fold's die", () => {
  const d10 = (v, pb) => ({
    total: v + pb,
    terms: [{ faces: 10, results: [{ result: v, active: true }] }, { number: pb }]
  });
  it("a reduction rises off the guard, the number drifting to the ally; one's own pops in place", async () => {
    const { reductionRise } = await import("../scripts/decide/dice-chips.js");
    expect(reductionRise({ roll: d10(7, 3), from: "Actor.guard", to: "Actor.ally" })).toEqual({
      on: "Actor.guard",
      chips: [{ label: "7" }, { label: "+3", flat: true, up: true }],
      drift: { to: "Actor.ally", label: "−10" }
    });
    expect(reductionRise({ roll: d10(5, 2), from: "Actor.me" }).drift.to).toBe("Actor.me");
    expect(reductionRise({ roll: { total: 0, terms: [] }, from: "Actor.me" })).toBeNull();
  });
  it("Shield: +5 AC; a bonus the sheet cannot state draws nothing", async () => {
    const { acChips } = await import("../scripts/decide/dice-chips.js");
    expect(acChips(5)).toEqual([{ label: "+5 AC", flat: true, up: true }]);
    expect(acChips(null)).toEqual([]);
  });
  it("a fold's die added is one gold +N", async () => {
    const { foldRise } = await import("../scripts/decide/dice-chips.js");
    expect(foldRise({ mode: "die", total: 4, on: "Actor.r" })).toEqual({
      on: "Actor.r",
      chips: [{ label: "+4", flat: true, up: true }]
    });
  });
});
