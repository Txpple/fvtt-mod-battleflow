import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer effect choices (ARCHITECTURE.md §2). No Foundry stub on purpose. The shape
 * (user, 2026-09-05: "when i apply warm or chill shield, it applies both … this should also be
 * a popup asking the player which shield to apply"): a cast whose activity ships alternative
 * effects asks the caster which one; only the pick lands.
 */
/** @type {typeof import("../scripts/decide/choices.js")} */
let c;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  c = await import("../scripts/decide/choices.js");
  reg = await import("../scripts/decide/registry.js");
});

describe("the table", () => {
  it("names Fire Shield with its two shields, a question and the rule — no amounts", () => {
    expect(Object.keys(reg.EFFECT_CHOICES)).toEqual([
      "Fire Shield",
      "Hex",
      "Starry Form",
      "Rage of the Wilds",
      "Power of the Wilds" // C1
    ]);
    const row = reg.EFFECT_CHOICES["Fire Shield"];
    expect(row.effects).toEqual(["Warm Shield", "Chill Shield"]);
    expect(row.ask).toMatch(/warm/i);
    expectPointer(row.rule);
    expect(row.rule.item).toBe("Fire Shield");
    expect(JSON.stringify({ ...row, rule: "" })).not.toMatch(/\d+d\d+/);
  });
});

describe("Hex", () => {
  const row = () => reg.EFFECT_CHOICES.Hex;
  it("asks for one of the six abilities, the picked effect drawn and told as the row says — no amounts", () => {
    expect(row().effects).toHaveLength(6);
    expect(c.effectChoiceFor(row(), ["Hexed Wisdom", "Hexed Strength", "Hexed Charisma"])).toEqual([
      "Hexed Strength",
      "Hexed Wisdom",
      "Hexed Charisma"
    ]);
    expect(row().img).toMatch(/\.webp$/);
    expect(row().says).toMatch(/Disadvantage/);
    expect(JSON.stringify({ ...row(), rule: "" })).not.toMatch(/\d+d\d+/);
    expectPointer(row().rule);
  });
  it("lands only the picked ability's effect", () => {
    const names = row().effects.slice();
    expect(c.effectsAfterChoice(names, { options: names, chosen: "Hexed Dexterity" })).toEqual([
      "Hexed Dexterity"
    ]);
    expect(c.effectsAfterChoice(names, { options: names, chosen: null })).toBeNull();
  });
  it("names its cast and its move for the system's picker", () => {
    expect(reg.MARK_USES.hex).toMatchObject({
      cast: "Place Curse",
      move: "Curse New Creature",
      castLabel: "Cast Hex",
      moveLabel: "Move Hex"
    });
  });
});

describe("slotHours — Concentration's longer clock at a higher slot", () => {
  it("Hex: 1 hour's base below level 2, then 4, 8 and 24 hours; Hunter's Mark from level 3", () => {
    const hex = reg.SLOT_DURATIONS.Hex;
    expect(c.slotHours(hex, 1)).toBeNull();
    expect(c.slotHours(hex, 2)).toBe(4);
    expect(c.slotHours(hex, 3)).toBe(8);
    expect(c.slotHours(hex, 4)).toBe(8);
    expect(c.slotHours(hex, 5)).toBe(24);
    expect(c.slotHours(reg.SLOT_DURATIONS["Hunter's Mark"], 2)).toBeNull();
    expect(c.slotHours(reg.SLOT_DURATIONS["Hunter's Mark"], 3)).toBe(8);
  });
});

describe("effectChoiceFor — which of the activity's effects are the alternatives", () => {
  const row = () => reg.EFFECT_CHOICES["Fire Shield"];
  it("offers the row's names the activity carries, in the row's order, case-insensitively", () => {
    expect(c.effectChoiceFor(row(), ["chill shield", "Warm Shield"])).toEqual([
      "Warm Shield",
      "Chill Shield"
    ]);
  });
  it("asks nothing when fewer than two alternatives are present — a trimmed copy needs no popup", () => {
    expect(c.effectChoiceFor(row(), ["Warm Shield"])).toBeNull();
    expect(c.effectChoiceFor(row(), [])).toBeNull();
    expect(c.effectChoiceFor(row(), ["Something Else", "Other"])).toBeNull();
  });
});

describe("effectsAfterChoice — what lands", () => {
  const names = ["Warm Shield", "Chill Shield", "Bright Light"];
  const options = ["Warm Shield", "Chill Shield"];
  it("with no choice at all, everything lands (the cast slice as it was)", () => {
    expect(c.effectsAfterChoice(names, null)).toEqual(names);
    expect(c.effectsAfterChoice(names, { options: [] })).toEqual(names);
  });
  it("pending — nothing chosen — lands nothing: null, the caller waits", () => {
    expect(c.effectsAfterChoice(names, { options, chosen: null })).toBeNull();
    expect(c.effectsAfterChoice(names, { options })).toBeNull();
  });
  it("the pick lands, its rivals do not, and the non-alternatives ride along", () => {
    expect(c.effectsAfterChoice(names, { options, chosen: "Chill Shield" })).toEqual([
      "Chill Shield",
      "Bright Light"
    ]);
    expect(c.effectsAfterChoice(names, { options, chosen: "warm shield" })).toEqual([
      "Warm Shield",
      "Bright Light"
    ]);
  });
  it("a pick that is not one of the options is treated as pending — a stranger's effect never applies", () => {
    expect(c.effectsAfterChoice(names, { options, chosen: "Bright Light" })).toBeNull();
    expect(c.effectsAfterChoice(names, { options, chosen: "Nope" })).toBeNull();
  });
});
