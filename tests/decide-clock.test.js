import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer clock arithmetic (ARCHITECTURE.md §2). No Foundry stub on purpose. The ruling
 * (user, 2026-09-02): a clock rider is notified and added, never asked; what is decided here is
 * whether the rules say it applies on THIS hit, and why not otherwise.
 */
/** @type {typeof import("../scripts/decide/clock.js")} */
let c;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  c = await import("../scripts/decide/clock.js");
  reg = await import("../scripts/decide/registry.js");
});

describe("riderDue — the clock, read plain", () => {
  const dread = () => reg.CLOCK_RIDERS["dread-ambusher"];
  const assassinate = () => reg.CLOCK_RIDERS["assassinate"];
  it("Dreadful Strike: once per turn, a use in hand, a weapon — due; the chit standing or the uses gone — not", () => {
    expect(c.riderDue(dread(), { inCombat: true, round: 3, usesLeft: 2, weapon: true })).toEqual({
      due: true,
      why: "once this turn"
    });
    expect(
      c.riderDue(dread(), { inCombat: true, chitStands: true, usesLeft: 2, weapon: true }).why
    ).toMatch(/used this turn/);
    expect(c.riderDue(dread(), { inCombat: true, usesLeft: 0, weapon: true }).why).toMatch(
      /no uses/
    );
    expect(c.riderDue(dread(), { inCombat: true, usesLeft: 2, weapon: false }).why).toMatch(
      /not a weapon/
    );
  });
  it("out of combat there is no turn to be once-per: every hit rides (the Cleave shape)", () => {
    expect(c.riderDue(dread(), { inCombat: false, usesLeft: 1, weapon: true })).toEqual({
      due: true,
      why: "out of combat — every hit"
    });
  });
  it("Assassinate: the first round, on an armed Sneak Attack, and never out of combat", () => {
    expect(
      c.riderDue(assassinate(), { inCombat: true, round: 1, sneakArmed: true, weapon: true }).due
    ).toBe(true);
    expect(
      c.riderDue(assassinate(), { inCombat: true, round: 2, sneakArmed: true, weapon: true }).why
    ).toMatch(/round 2/);
    expect(
      c.riderDue(assassinate(), { inCombat: true, round: 1, sneakArmed: false, weapon: true }).why
    ).toMatch(/Sneak Attack/);
    expect(
      c.riderDue(assassinate(), { inCombat: false, sneakArmed: true, weapon: true }).why
    ).toMatch(/no first round/);
  });
  it("Divine Fury needs the rage; an unknown clock is never due", () => {
    expect(
      c.riderDue(reg.CLOCK_RIDERS["divine-fury"], { inCombat: true, weapon: true, raging: false })
        .why
    ).toMatch(/not raging/);
    expect(
      c.riderDue(reg.CLOCK_RIDERS["divine-fury"], { inCombat: true, weapon: true, raging: true })
        .due
    ).toBe(true);
    expect(c.riderDue({ when: "someday" }, {}).due).toBe(false);
  });
});

describe("riderPartFormula — the pack's part as a formula", () => {
  it("plain dice, a custom formula, a bonus, and Assassinate's bonus-only part", () => {
    expect(c.riderPartFormula({ number: 2, denomination: 6 })).toBe("2d6");
    expect(
      c.riderPartFormula({ custom: { enabled: true, formula: "@scale.gloom.dreadful-strike" } })
    ).toBe("@scale.gloom.dreadful-strike");
    expect(
      c.riderPartFormula({
        number: 1,
        denomination: 6,
        bonus: "(floor(@classes.barbarian.levels / 2))"
      })
    ).toBe("1d6 + (floor(@classes.barbarian.levels / 2))");
    expect(
      c.riderPartFormula({ number: null, denomination: null, bonus: "@classes.rogue.levels" })
    ).toBe("@classes.rogue.levels");
    expect(c.riderPartFormula({})).toBeNull();
  });
});

describe("the registry's clock-rider data", () => {
  it("every row names its feature, its activity, a known clock and its rule; the list default is the table", () => {
    for (const [key, row] of Object.entries(reg.CLOCK_RIDERS)) {
      expect(row.feature, key).toBeTruthy();
      expect(row.activity, key).toBeTruthy();
      expect(["oncePerTurn", "firstRound"], key).toContain(row.when);
      expect(row.rule.length, key).toBeGreaterThan(20);
    }
    expect(reg.LIST_SPECS.clockRiders.default).toBe(
      Object.values(reg.CLOCK_RIDERS)
        .map(r => r.feature)
        .join(", ")
    );
    expect(reg.CLOCK_RIDER_NAMES.has("dread ambusher")).toBe(true);
    const { entries, rejects } = reg.parseList(
      reg.LIST_SPECS.clockRiders,
      reg.LIST_SPECS.clockRiders.default
    );
    expect(rejects).toEqual([]);
    expect(entries.map(e => e.kind)).toEqual([...reg.CLOCK_RIDER_NAMES]);
  });
  it("Assassinate's Advantage is an effect-table row with the clock as its judge", () => {
    expect(reg.EFFECT_BENDS["Assassinate"]).toMatchObject({
      match: "feature",
      attacker: "advantage",
      judge: "targetNotActed"
    });
  });
});
