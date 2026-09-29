import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the PHB classes, stage A7 (RULINGS *The PHB classes — A7*) — the cast riders (CAST_RIDERS: Wild
 * Magic Surge, Inspiring Smite). No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/cast-riders.js")} */
let cr;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  cr = await import("../scripts/decide/cast-riders.js");
});

describe("CAST_RIDERS", () => {
  it("two frozen rows: the surge on a Sorcerer slot cast, the smite's divided hand-out", () => {
    const surge = reg.CAST_RIDERS["Wild Magic Surge"];
    const smite = reg.CAST_RIDERS["Inspiring Smite"];
    expect(Object.isFrozen(surge) && Object.isFrozen(smite)).toBe(true);
    expect(surge).toMatchObject({ spellClass: "sorcerer", surgeOn: 20, tides: "Tides of Chaos" });
    expect(surge.table).toMatch(/RollTable\.phbWildMagicSurg$/);
    expect(smite).toMatchObject({
      after: "Divine Smite",
      handOut: true,
      activity: "Heal",
      reach: 30,
      self: true
    });
    expectPointer(surge.rule);
    expectPointer(smite.rule);
    expect(reg.castRiderEntries().map(e => e.kind)).toEqual([
      "wild magic surge",
      "inspiring smite"
    ]);
  });
});

describe("whose spell, with a slot", () => {
  it("the item's own class first, then its sourceItem, then the caster's one class", () => {
    expect(cr.spellClassOf({ classIdentifier: "sorcerer", sourceItem: "class:wizard" })).toBe(
      "sorcerer"
    );
    expect(cr.spellClassOf({ sourceItem: "class:sorcerer" })).toBe("sorcerer");
    expect(cr.spellClassOf({ casterClasses: ["sorcerer"] })).toBe("sorcerer");
    expect(cr.spellClassOf({ casterClasses: ["sorcerer", "wizard"] })).toBeNull();
  });
  it("a slot cast: levelled, not innate or at will, a slot spent", () => {
    expect(cr.castWithSlot({ level: 1, method: "spell", spendsSlot: true })).toBe(true);
    expect(cr.castWithSlot({ level: 1, method: "pact", spendsSlot: true })).toBe(true);
    expect(cr.castWithSlot({ level: 0, method: "spell", spendsSlot: true })).toBe(false);
    expect(cr.castWithSlot({ level: 2, method: "innate", spendsSlot: true })).toBe(false);
    expect(cr.castWithSlot({ level: 2, method: "spell", spendsSlot: false })).toBe(false);
  });
});

describe("the surge", () => {
  it("Tides spent: the table at once, Tides back — even after this turn's roll", () => {
    expect(cr.surgeOutcome({ tidesSpent: true, used: true })).toMatchObject({
      roll: false,
      surged: true,
      tides: true
    });
  });
  it("once per turn: this turn's roll made, nothing", () => {
    expect(cr.surgeOutcome({ tidesSpent: false, used: true })).toMatchObject({
      roll: false,
      surged: false
    });
  });
  it("the d20: a 20 surges, anything else does not", () => {
    expect(cr.surgeOutcome({ tidesSpent: false, used: false, d20: 20 })).toMatchObject({
      roll: true,
      surged: true,
      tides: false
    });
    expect(cr.surgeOutcome({ tidesSpent: false, used: false, d20: 19 })).toMatchObject({
      roll: true,
      surged: false
    });
  });
  it("the line", () => {
    expect(cr.surgeLine({ feature: "Wild Magic Surge", d20: 14, surged: false })).toBe(
      "Wild Magic Surge — d20: 14, nothing"
    );
    expect(
      cr.surgeLine({ feature: "Wild Magic Surge", d20: 20, surged: true, result: "You turn blue" })
    ).toBe("Wild Magic Surge — d20: 20, a SURGE — You turn blue");
    expect(
      cr.surgeLine({ feature: "Wild Magic Surge", surged: true, tides: true, result: "Fog" })
    ).toBe(
      "Wild Magic Surge — Tides of Chaos spent: the surge rolls — Fog; Tides of Chaos regained"
    );
  });
});

describe("a divided hand-out", () => {
  it("whole numbers, never past the total, zeros and strangers dropped", () => {
    const allowed = new Set(["a", "b", "c"]);
    expect(
      cr.distribution({
        total: 12,
        picks: [
          { uuid: "a", n: 7 },
          { uuid: "b", n: 9 },
          { uuid: "c", n: 0 },
          { uuid: "x", n: 3 }
        ],
        allowed
      })
    ).toEqual([
      { uuid: "a", n: 7 },
      { uuid: "b", n: 5 }
    ]);
    expect(
      cr.distribution({
        total: 12,
        picks: [
          { uuid: "a", n: 2.7 },
          { uuid: "a", n: 4 }
        ]
      })
    ).toEqual([{ uuid: "a", n: 2 }]);
    expect(cr.distribution({ total: 12, picks: [] })).toEqual([]);
  });
});
