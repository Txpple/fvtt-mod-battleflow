import { beforeAll, describe, expect, it } from "vitest";

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
    expect(Object.keys(reg.EFFECT_CHOICES)).toEqual(["Fire Shield"]);
    const row = reg.EFFECT_CHOICES["Fire Shield"];
    expect(row.effects).toEqual(["Warm Shield", "Chill Shield"]);
    expect(row.ask).toMatch(/warm/i);
    expect(row.rule).toMatch(/as you choose/);
    expect(JSON.stringify({ ...row, rule: "" })).not.toMatch(/\d+d\d+/);
  });
  it("is the Effect Choices list's closed set, as MEMBERSHIP, parsed whole-chunk", () => {
    const spec = reg.LIST_SPECS.effectChoices;
    expect(spec.membership).toBe(true);
    expect(spec.whole).toBe(true);
    expect(spec.kinds).toBe(reg.EFFECT_CHOICE_NAMES);
    expect(spec.default).toBe("Fire Shield");
    expect(reg.parseList(spec, "fire shield").entries.map(e => e.kind)).toEqual(["fire shield"]);
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
