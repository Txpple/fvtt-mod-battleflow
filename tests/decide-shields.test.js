import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer damage shields (ARCHITECTURE.md §2). No Foundry stub on purpose. The shape
 * (user, 2026-09-04: "death armor needs its damage shield effect automated") is the hit rider
 * mirrored: a standing effect on the DEFENDER pays out against the ATTACKER on a melee hit.
 */
/** @type {typeof import("../scripts/decide/shields.js")} */
let s;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  s = await import("../scripts/decide/shields.js");
  reg = await import("../scripts/decide/registry.js");
});

describe("the table", () => {
  it("names three shields, each with a rule and the pack's damage activity, no dice anywhere", () => {
    const rows = Object.entries(reg.DAMAGE_SHIELDS);
    expect(rows.map(([k]) => k)).toEqual(["Death Armor", "Fire Shield", "Armor of Agathys"]);
    for (const [, row] of rows) {
      expect(row.activity).toBeTruthy();
      expect(row.rule.length).toBeGreaterThan(40);
      expect(row.melee).toBe(true);
      // The rule quotes the text (dice and all); the row itself carries no amount.
      const { rule, ...rest } = row;
      expect(JSON.stringify(rest)).not.toMatch(/\d+d\d+/);
    }
    expect(reg.DAMAGE_SHIELDS["Death Armor"]).toMatchObject({
      effect: "Death Armor",
      when: "oncePerTurn"
    });
    expect(reg.DAMAGE_SHIELDS["Fire Shield"].effect).toEqual({
      "Warm Shield": "fire",
      "Chill Shield": "cold"
    });
    expect(reg.DAMAGE_SHIELDS["Armor of Agathys"]).toMatchObject({
      mark: true,
      while: "tempHP",
      cast: "Cast"
    });
  });

  it("ships the Damage Shields list as the whole table, and its parser takes it whole", () => {
    const { entries, rejects } = reg.parseList(
      reg.LIST_SPECS.damageShields,
      reg.LIST_SPECS.damageShields.default
    );
    expect(rejects).toEqual([]);
    expect(entries.map(e => e.kind)).toEqual(
      Object.keys(reg.DAMAGE_SHIELDS).map(n => n.toLowerCase())
    );
  });
});

describe("shieldDue — the rules, read plain", () => {
  const death = () => reg.DAMAGE_SHIELDS["Death Armor"];
  const fire = () => reg.DAMAGE_SHIELDS["Fire Shield"];
  const agathys = () => reg.DAMAGE_SHIELDS["Armor of Agathys"];

  it("a melee hit within reach strikes; a ranged one never does", () => {
    expect(s.shieldDue(fire(), { melee: true, distanceFeet: 5, within: 5 })).toEqual({
      due: true,
      why: "every melee hit"
    });
    expect(s.shieldDue(fire(), { melee: false, distanceFeet: 5, within: 5 }).why).toMatch(
      /not a melee/
    );
  });

  it("the reach is the activity's: a reach weapon at 10 feet is beyond a 5-foot ward; an unmeasured distance never strikes", () => {
    expect(s.shieldDue(fire(), { melee: true, distanceFeet: 10, within: 5 }).why).toMatch(
      /beyond 5/
    );
    expect(s.shieldDue(fire(), { melee: true, distanceFeet: null, within: 5 }).why).toMatch(
      /could not be measured/
    );
    // Armor of Agathys carries no distance clause: a reach weapon still pays.
    expect(
      s.shieldDue(agathys(), { melee: true, distanceFeet: 10, within: null, tempHP: 5 }).due
    ).toBe(true);
  });

  it("Death Armor: once per turn in combat — the chit standing refuses; out of combat every hit", () => {
    expect(
      s.shieldDue(death(), { melee: true, distanceFeet: 5, within: 5, inCombat: true })
    ).toEqual({ due: true, why: "once this turn" });
    expect(
      s.shieldDue(death(), {
        melee: true,
        distanceFeet: 5,
        within: 5,
        inCombat: true,
        chitStands: true
      }).why
    ).toMatch(/already struck/);
    expect(
      s.shieldDue(death(), { melee: true, distanceFeet: 5, within: 5, inCombat: false }).why
    ).toMatch(/out of combat/);
  });

  it("Armor of Agathys strikes only while the Temporary Hit Points stand", () => {
    expect(s.shieldDue(agathys(), { melee: true, tempHP: 5 }).due).toBe(true);
    expect(s.shieldDue(agathys(), { melee: true, tempHP: 0 }).why).toMatch(
      /no Temporary Hit Points/
    );
    expect(s.shieldDue(agathys(), { melee: true, tempHP: null }).due).toBe(false);
  });
});

describe("the readers", () => {
  it("shieldReach: feet as they are, metres folded, everything else no clause", () => {
    expect(s.shieldReach({ value: 5, units: "ft" })).toBe(5);
    expect(s.shieldReach({ value: 1.5, units: "m" })).toBe(5);
    expect(s.shieldReach({ value: null, units: "any" })).toBeNull();
    expect(s.shieldReach({ value: null, units: "self" })).toBeNull();
    expect(s.shieldReach(null)).toBeNull();
  });

  it("shieldType: the type follows the standing effect — Warm burns, Chill freezes; a one-name row leaves it to the activity", () => {
    const fire = reg.DAMAGE_SHIELDS["Fire Shield"];
    expect(s.shieldType(fire, "Warm Shield")).toBe("fire");
    expect(s.shieldType(fire, "chill shield")).toBe("cold");
    expect(s.shieldType(reg.DAMAGE_SHIELDS["Death Armor"], "Death Armor")).toBeNull();
    expect(s.shieldEffectNames(fire)).toEqual(["warm shield", "chill shield"]);
    expect(s.shieldEffectNames(reg.DAMAGE_SHIELDS["Armor of Agathys"])).toEqual([]);
  });

  it("durationSeconds: the item's duration on the world clock", () => {
    expect(s.durationSeconds({ value: 1, units: "hour" })).toBe(3600);
    expect(s.durationSeconds({ value: 10, units: "minute" })).toBe(600);
    expect(s.durationSeconds({ value: null, units: "inst" })).toBeNull();
    expect(s.durationSeconds({ value: 1, units: "spec" })).toBeNull();
  });
});
