import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer rests (ARCHITECTURE.md §2): what a rest ends on the rester — a Long Rest Concentration
 * and every effect of 8 hours or less, a Short Rest every effect of 1 hour or less (RULINGS *Rests end the
 * short effects*). No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/rest-grants.js")} */
let r;
beforeAll(async () => {
  r = await import("../scripts/decide/rest-grants.js");
});

describe("effectSeconds — an effect's length off Foundry 14's duration", () => {
  it("a value in its units; rounds and turns 6 seconds each", () => {
    expect(r.effectSeconds({ value: 1, units: "minutes" })).toBe(60);
    expect(r.effectSeconds({ value: 8, units: "hours" })).toBe(28800);
    expect(r.effectSeconds({ value: 10, units: "rounds" })).toBe(60);
  });
  it("an expiry alone: a combat or turn event is short, a rest event the rest's own length", () => {
    expect(r.effectSeconds({ value: null, expiry: "turnEnd" })).toBe(0);
    expect(r.effectSeconds({ expiry: "shortRest" })).toBe(3600);
    expect(r.effectSeconds({ expiry: "longRest" })).toBe(28800);
  });
  it("no duration at all stands forever", () => {
    expect(r.effectSeconds({ value: null, units: "seconds", expiry: null })).toBe(Infinity);
    expect(r.effectSeconds(null)).toBe(Infinity);
  });
});

describe("restEnds — what a rest ends", () => {
  const effects = [
    { id: "conc", concentration: true, duration: { value: 1, units: "minutes" } },
    { id: "hand", duration: { value: 1, units: "minutes" } },
    { id: "hour", duration: { value: 1, units: "hours" } },
    { id: "eight", duration: { value: 8, units: "hours" } },
    { id: "day", duration: { value: 24, units: "hours" } },
    { id: "mark", duration: {} }
  ];
  it("a Short Rest keeps Concentration and ends what lasts an hour or less", () => {
    expect(r.restEnds(effects, "short")).toEqual({ end: ["hand", "hour"], concentration: false });
  });
  it("a Long Rest ends Concentration and what lasts 8 hours or less", () => {
    expect(r.restEnds(effects, "long")).toEqual({
      end: ["hand", "hour", "eight"],
      concentration: true
    });
  });
  it("another rest type ends nothing", () => {
    expect(r.restEnds(effects, "other")).toEqual({ end: [], concentration: false });
  });
});
