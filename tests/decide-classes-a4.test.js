import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the PHB classes, stage A4 (RULINGS *The PHB classes — A4*; the plan
 * audits/plans/session-0-classes.md §3) — the healing seam's `bonus`, the evasions' mirror on the caster, and
 * the casting window's free class row. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/damage-dice.js")} */
let dd;
/** @type {typeof import("../scripts/decide/verdict.js")} */
let v;
/** @type {typeof import("../scripts/decide/metamagic.js")} */
let mm;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  dd = await import("../scripts/decide/damage-dice.js");
  v = await import("../scripts/decide/verdict.js");
  mm = await import("../scripts/decide/metamagic.js");
});

describe("Disciple of Life — HEAL_REROLLS `bonus` + `slotCast`", () => {
  it("the row is frozen, points at the book, and carries no reroll face or max", () => {
    const row = reg.HEAL_REROLLS["Disciple of Life"];
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ bonus: "2 + @slot", slotCast: true });
    expect(row.reroll).toBeUndefined();
    expect(row.max).toBeUndefined();
    expectPointer(row.rule);
  });
  it("2 + the slot level: 3 at level 1, 4 at level 2, 11 at level 9", () => {
    expect(dd.slotBonus("2 + @slot", 1)).toBe(3);
    expect(dd.slotBonus("2 + @slot", 2)).toBe(4);
    expect(dd.slotBonus("2 + @slot", 9)).toBe(11);
  });
  it("a term that is no whole number counts nothing; never below 0", () => {
    expect(dd.slotBonus("2 + @mod", 3)).toBe(2);
    expect(dd.slotBonus(null, 3)).toBe(0);
    expect(dd.slotBonus("@slot", -2)).toBe(0);
  });
  it("Beacon of Hope's maximum counts the labelled bonus as written", () => {
    const roll = {
      total: 9,
      terms: [
        { number: 1, faces: 8 },
        { operator: "+" },
        { number: 3 },
        { operator: "+" },
        { number: 4, options: { flavor: "Disciple of Life" } }
      ]
    };
    expect(dd.rollMaximum(roll)).toBe(15);
  });
});

describe("Potent Cantrip — EVASIONS' mirror on the caster", () => {
  it("the row is keyed to the CASTER, a cantrip's success taking half", () => {
    const row = reg.EVASIONS["Potent Cantrip"];
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ side: "caster", cantrip: true, onSuccess: 0.5 });
    expectPointer(row.rule);
  });
  it("a success against a no-damage-on-save cantrip takes half; a failure stays whole", () => {
    const casterHalf = { by: "Potent Cantrip", onSuccess: 0.5 };
    expect(v.saveMultiplier({ outcome: "saved", casterHalf }, "none")).toBe(0.5);
    expect(v.saveMultiplier({ outcome: "failed", casterHalf }, "none")).toBe(1);
    expect(v.saveMultiplier({ outcome: "saved" }, "none")).toBeNull();
  });
  it("never raises a half or a full success; Evasion's none still wins for its bearer", () => {
    const casterHalf = { by: "Potent Cantrip", onSuccess: 0.5 };
    expect(v.saveMultiplier({ outcome: "saved", casterHalf }, "half")).toBe(0.5);
    expect(v.saveMultiplier({ outcome: "saved", casterHalf }, "full")).toBe(1);
    expect(
      v.saveMultiplier(
        { outcome: "saved", casterHalf, evasion: true, evasionBy: "Evasion" },
        "half"
      )
    ).toBe(0);
  });
  it("the verdict names the caster's feature", () => {
    const flag = { hasDamage: true, damageOnSave: "none", dc: 13 };
    const t = {
      done: true,
      outcome: "saved",
      total: 15,
      casterHalf: { by: "Potent Cantrip", onSuccess: 0.5 }
    };
    expect(v.verdictText(flag, t)).toBe("15 vs DC 13 — saved — half damage (Potent Cantrip)");
  });
});

describe("Psychic Spells — a free METAMAGIC row, the type fixed", () => {
  const WARLOCK_BLAST = {
    save: false,
    rangeFeet: 120,
    touch: false,
    minutes: 0,
    action: true,
    damageTypes: ["force"],
    damageRoll: true,
    spellAttack: true,
    scalesTargets: false,
    sourceClass: "warlock"
  };
  const menuFor = (facts, known = ["Psychic Spells"], points = 0) =>
    mm.metamagicMenu({
      table: reg.METAMAGIC,
      listed: known,
      known,
      facts,
      points,
      costs: {},
      transmutedTypes: reg.TRANSMUTED_TYPES
    });
  it("the row: free, psychic, the Warlock's", () => {
    expect(reg.METAMAGIC["Psychic Spells"]).toMatchObject({
      key: "psychic",
      moment: "cast",
      free: true,
      fixed: "psychic",
      classes: ["warlock"]
    });
  });
  it("a Warlock damage spell: eligible, free, no Sorcery Point needed", () => {
    const [row] = menuFor(WARLOCK_BLAST);
    expect(row).toMatchObject({
      key: "psychic",
      eligible: true,
      affordable: true,
      cost: 0,
      tag: "free",
      free: true,
      fixed: "psychic"
    });
  });
  it("another class's spell greys: not a Warlock spell", () => {
    const [row] = menuFor({ ...WARLOCK_BLAST, sourceClass: "sorcerer" });
    expect(row).toMatchObject({ eligible: false, why: "not a Warlock spell" });
  });
  it("a spell with no damage greys: no damage", () => {
    const [row] = menuFor({ ...WARLOCK_BLAST, damageRoll: false, damageTypes: [] });
    expect(row).toMatchObject({ eligible: false, why: "no damage" });
  });
  it("beside a Metamagic option: the paid row still costs its points, the free row nothing", () => {
    const rows = mm.metamagicMenu({
      table: reg.METAMAGIC,
      listed: ["Subtle Spell", "Psychic Spells"],
      known: ["Subtle Spell", "Psychic Spells"],
      facts: WARLOCK_BLAST,
      points: 0,
      costs: { "Subtle Spell": 1 },
      transmutedTypes: reg.TRANSMUTED_TYPES
    });
    expect(rows.find(r => r.key === "subtle")).toMatchObject({ affordable: false, free: false });
    expect(rows.find(r => r.key === "psychic")).toMatchObject({ affordable: true, free: true });
  });
  it("the card's line", () => {
    expect(
      mm.metamagicCardLine({ key: "psychic", feature: "Psychic Spells", type: "psychic" })
    ).toBe("Psychic Spells — the damage is psychic");
  });
});
