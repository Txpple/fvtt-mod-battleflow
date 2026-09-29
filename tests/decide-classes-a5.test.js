import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the PHB classes, stage A5 (RULINGS *The PHB classes — A5*) — the ward pool (WARD_POOLS, Arcane
 * Ward): the take, the hit-point split after it, the cast's create and refill. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/ward-pools.js")} */
let w;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  w = await import("../scripts/decide/ward-pools.js");
});

describe("WARD_POOLS — Arcane Ward", () => {
  it("one frozen row: the feature's own uses, created by Create Ward, refilled 2 × the slot by Abjuration", () => {
    const row = reg.WARD_POOLS["Arcane Ward"];
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({
      pool: "uses",
      create: "Create Ward",
      refill: { school: "abj", per: 2 }
    });
    expectPointer(row.rule);
    expect(reg.wardPoolEntries().map(e => e.kind)).toEqual(["arcane ward"]);
  });
});

describe("the take", () => {
  it("the ward takes what it holds, the rest lands", () => {
    expect(w.wardAbsorb({ amount: 9, ward: 4 })).toEqual({ took: 4, left: 5 });
    expect(w.wardAbsorb({ amount: 3, ward: 12 })).toEqual({ took: 3, left: 0 });
  });
  it("a ward at 0 takes nothing", () => {
    expect(w.wardAbsorb({ amount: 7, ward: 0 })).toEqual({ took: 0, left: 7 });
  });
});

describe("the split after the ward — Temporary Hit Points first, then Hit Points (dnd5e's own)", () => {
  it("the rest through temp, then HP", () => {
    expect(w.afterWard({ left: 5, value: 20, temp: 3, damage: 10, tempMax: 0 })).toEqual({
      value: 18,
      temp: 0
    });
  });
  it("nothing left: nothing moves", () => {
    expect(w.afterWard({ left: 0, value: 20, temp: 3, damage: 10, tempMax: 0 })).toEqual({
      value: 20,
      temp: 3
    });
  });
  it("never below 0 HP", () => {
    expect(w.afterWard({ left: 50, value: 6, temp: 0, damage: 24, tempMax: 0 })).toEqual({
      value: 0,
      temp: 0
    });
  });
});

describe("the cast", () => {
  it("created full on the first slot cast after a Long Rest", () => {
    expect(w.wardRefill({ value: 0, max: 13, slot: 1, per: 2, create: true })).toEqual({
      value: 13,
      gained: 13
    });
  });
  it("refilled by 2 × the slot, never past the maximum", () => {
    expect(w.wardRefill({ value: 4, max: 13, slot: 2, per: 2, create: false })).toEqual({
      value: 8,
      gained: 4
    });
    expect(w.wardRefill({ value: 12, max: 13, slot: 3, per: 2, create: false })).toEqual({
      value: 13,
      gained: 1
    });
    expect(w.wardRefill({ value: 13, max: 13, slot: 1, per: 2, create: false })).toEqual({
      value: 13,
      gained: 0
    });
  });
});
