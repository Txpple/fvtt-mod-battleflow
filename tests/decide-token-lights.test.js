import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer token lights (ARCHITECTURE.md §2; the Aasimar walk, 2026-09-25): which use sheds
 * a light, the changes that carry it, and who it lands on. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/token-lights.js")} */
let tl;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  tl = await import("../scripts/decide/token-lights.js");
  reg = await import("../scripts/decide/registry.js");
});

const all = () => new Set(Object.keys(reg.TOKEN_LIGHTS).map(k => k.toLowerCase()));

describe("lightRowKey — the use a row answers to", () => {
  it("Inner Radiance answers to its own activity on Celestial Revelation, not the item's other forms", () => {
    expect(
      tl.lightRowKey(
        reg.TOKEN_LIGHTS,
        { itemName: "Celestial Revelation", activityName: "Inner Radiance" },
        all()
      )
    ).toBe("Inner Radiance");
    expect(
      tl.lightRowKey(
        reg.TOKEN_LIGHTS,
        { itemName: "Celestial Revelation", activityName: "Heavenly Wings" },
        all()
      )
    ).toBeNull();
  });
  it("Light answers to any use of the spell", () => {
    expect(
      tl.lightRowKey(reg.TOKEN_LIGHTS, { itemName: "Light", activityName: "Summon" }, all())
    ).toBe("Light");
    expect(
      tl.lightRowKey(reg.TOKEN_LIGHTS, { itemName: "light", activityName: "Cast" }, all())
    ).toBe("Light");
  });
  it("the list is the switch: a row off the list answers to nothing", () => {
    expect(
      tl.lightRowKey(
        reg.TOKEN_LIGHTS,
        { itemName: "Light", activityName: "Summon" },
        new Set(["inner radiance"])
      )
    ).toBeNull();
    expect(tl.lightRowKey(reg.TOKEN_LIGHTS, { itemName: "", activityName: "x" }, all())).toBeNull();
  });
});

describe("lightChanges — the token's own light, Foundry 14's `token.*` changes", () => {
  it("Inner Radiance: 10 Bright, 20 Dim (the dim radius is the OUTER one); Light: 20 and 40", () => {
    expect(tl.lightChanges(reg.TOKEN_LIGHTS["Inner Radiance"])).toEqual([
      { key: "token.light.bright", type: "override", value: 10, phase: "initial" },
      { key: "token.light.dim", type: "override", value: 20, phase: "initial" }
    ]);
    expect(tl.lightChanges(reg.TOKEN_LIGHTS.Light).map(c => c.value)).toEqual([20, 40]);
  });
  it("a dim below the bright is lifted to it; nonsense reads as nothing", () => {
    expect(tl.lightChanges({ bright: 10, dim: 5 }).map(c => c.value)).toEqual([10, 10]);
    expect(tl.lightChanges({ bright: "x", dim: null }).map(c => c.value)).toEqual([0, 0]);
  });
});

describe("lightTargets — who the light lands on", () => {
  const me = { uuid: "Actor.a", name: "Aasimar" };
  const t1 = { uuid: "Actor.v", name: "Victim" };
  it("a self row lights its user whatever is targeted", () => {
    expect(tl.lightTargets({ on: "self" }, { self: me, targets: [t1] })).toEqual([me]);
  });
  it("a targets row lights every creature targeted, once each — and nobody targeted is no light", () => {
    expect(tl.lightTargets({ on: "targets" }, { self: me, targets: [t1, t1] })).toEqual([t1]);
    expect(tl.lightTargets({ on: "targets" }, { self: me, targets: [] })).toEqual([]);
  });
  it("the list default is the table", () => {
    expect(reg.LIST_SPECS.tokenLights.default).toBe(Object.keys(reg.TOKEN_LIGHTS).join(", "));
  });
});

describe("token senses — the pack's own effect, the token's vision (the Dwarf walk, 2026-09-25)", () => {
  const senses = () => new Set(Object.keys(reg.TOKEN_SENSES).map(k => k.toLowerCase()));
  it("Stonecunning's effect answers by its name, case-insensitive; unlisted or unnamed is nothing", () => {
    expect(tl.senseRowKey(reg.TOKEN_SENSES, "Stonecunning", senses())).toBe("Stonecunning");
    expect(tl.senseRowKey(reg.TOKEN_SENSES, "stonecunning", senses())).toBe("Stonecunning");
    expect(tl.senseRowKey(reg.TOKEN_SENSES, "Stonecunning", new Set())).toBeNull();
    expect(tl.senseRowKey(reg.TOKEN_SENSES, "Searing Radiance", senses())).toBeNull();
    expect(tl.senseRowKey(reg.TOKEN_SENSES, "", senses())).toBeNull();
  });
  it("Stonecunning: Tremorsense vision at 60 ft and Feel Tremor detection at 60 ft", () => {
    expect(tl.senseChanges(reg.TOKEN_SENSES.Stonecunning)).toEqual([
      { key: "token.sight.visionMode", type: "override", value: "tremorsense", phase: "initial" },
      { key: "token.sight.range", type: "override", value: 60, phase: "initial" },
      {
        key: "token.detectionModes.feelTremor.enabled",
        type: "override",
        value: true,
        phase: "initial"
      },
      {
        key: "token.detectionModes.feelTremor.range",
        type: "override",
        value: 60,
        phase: "initial"
      }
    ]);
  });
  it("an effect already carrying a sense is not given it twice; the pack's own change is not one", () => {
    expect(tl.carriesSense([{ key: "system.attributes.senses.tremorsense" }])).toBe(false);
    expect(tl.carriesSense(tl.senseChanges(reg.TOKEN_SENSES.Stonecunning))).toBe(true);
  });
  it("the list default is the table", () => {
    expect(reg.LIST_SPECS.tokenSenses.default).toBe(Object.keys(reg.TOKEN_SENSES).join(", "));
  });
});
