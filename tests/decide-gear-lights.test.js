import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer gear lights (issue #7): the row an item answers to, the light each state sheds,
 * the popup's presses and what each press does. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/token-lights.js")} */
let tl;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  tl = await import("../scripts/decide/token-lights.js");
  reg = await import("../scripts/decide/registry.js");
});

const all = () => new Set(Object.keys(reg.GEAR_LIGHTS).map(k => k.toLowerCase()));
const rowFor = item => tl.gearLightRow(reg.GEAR_LIGHTS, item, all(), reg.identifierOf);
const values = changes =>
  Object.fromEntries(changes.map(c => [c.key.replace("token.light.", ""), c.value]));

describe("GEAR_LIGHTS — the rule text's numbers", () => {
  it("every row's light, dim the OUTER radius", () => {
    const shed = Object.fromEntries(
      Object.entries(reg.GEAR_LIGHTS).map(([k, r]) => [k, values(tl.lightChanges(r))])
    );
    expect(shed).toEqual({
      Candle: { bright: 5, dim: 10 },
      Torch: { bright: 20, dim: 40 },
      Lamp: { bright: 15, dim: 45 },
      "Lantern, Hooded": { bright: 30, dim: 60 },
      "Lantern, Bullseye": { bright: 60, dim: 120, angle: 53.13 }
    });
  });
  it("the hood down is Dim 5 ft and nothing Bright", () => {
    const row = reg.GEAR_LIGHTS["Lantern, Hooded"];
    expect(values(tl.lightChanges(tl.gearLightOf(row, "hoodDown")))).toEqual({ bright: 0, dim: 5 });
  });
  it("a row without an angle writes no angle", () => {
    for (const key of ["Candle", "Torch", "Lamp", "Lantern, Hooded"]) {
      expect(tl.lightChanges(reg.GEAR_LIGHTS[key]).some(c => c.key === "token.light.angle")).toBe(
        false
      );
    }
  });
  it("the no-light guard stands: bright and dim both 0 write nothing", () => {
    expect(tl.lightChanges({ bright: 0, dim: 0, angle: 53.13 })).toEqual([]);
  });
  it("every change is an override on the initial phase", () => {
    for (const c of tl.lightChanges(reg.GEAR_LIGHTS["Lantern, Bullseye"])) {
      expect(c).toMatchObject({ type: "override", phase: "initial" });
    }
  });
});

describe("gearLightRow — the item a row answers to", () => {
  it("the 2024 names, by name or identifier", () => {
    expect(rowFor({ name: "Torch" })).toBe("Torch");
    expect(rowFor({ name: "candle" })).toBe("Candle");
    expect(rowFor({ name: "My lantern", identifier: "lantern-hooded" })).toBe("Lantern, Hooded");
  });
  it("the 2014 aliases starting equipment hands out", () => {
    expect(rowFor({ name: "Hooded Lantern" })).toBe("Lantern, Hooded");
    expect(rowFor({ name: "Bullseye Lantern", identifier: "bullseye-lantern" })).toBe(
      "Lantern, Bullseye"
    );
  });
  it("a magic lantern or candle is not gear", () => {
    expect(rowFor({ name: "Lantern of Revealing", identifier: "lantern-of-revealing" })).toBeNull();
    expect(rowFor({ name: "Candle of Invocation", identifier: "candle-of-invocation" })).toBeNull();
    expect(rowFor({ name: "", identifier: "" })).toBeNull();
  });
  it("a row off the list answers nothing", () => {
    expect(
      tl.gearLightRow(reg.GEAR_LIGHTS, { name: "Torch" }, new Set(["candle"]), reg.identifierOf)
    ).toBeNull();
  });
});

describe("gearButtons — the popup's presses", () => {
  it("a one-state item: Light, then Put out", () => {
    const torch = reg.GEAR_LIGHTS.Torch;
    expect(tl.gearButtons(torch, null)).toEqual([{ press: "light", state: "lit", label: "Light" }]);
    expect(tl.gearButtons(torch, "lit")).toEqual([{ press: "out", label: "Put out" }]);
  });
  it("the Hooded Lantern: two ways to light, then Put out and the hood", () => {
    const lantern = reg.GEAR_LIGHTS["Lantern, Hooded"];
    expect(tl.gearButtons(lantern, null).map(b => b.label)).toEqual([
      "Light — hood up",
      "Light — hood down"
    ]);
    expect(tl.gearButtons(lantern, "lit")).toEqual([
      { press: "out", label: "Put out" },
      { press: "switch", state: "hoodDown", label: "Lower the hood" }
    ]);
    expect(tl.gearButtons(lantern, "hoodDown")).toEqual([
      { press: "out", label: "Put out" },
      { press: "switch", state: "lit", label: "Raise the hood" }
    ]);
  });
});

describe("gearToggle — what a press does", () => {
  it("unlit → Light creates", () => {
    expect(tl.gearToggle({ lit: null }, { press: "light", state: "lit" })).toEqual({
      op: "create",
      state: "lit",
      putOut: []
    });
  });
  it("lit → Put out deletes; unlit → Put out does nothing", () => {
    expect(tl.gearToggle({ lit: { id: "e1", state: "lit" } }, { press: "out" })).toEqual({
      op: "delete",
      putOut: []
    });
    expect(tl.gearToggle({ lit: null }, { press: "out" }).op).toBe("none");
  });
  it("the hood switches in place, both ways", () => {
    expect(
      tl.gearToggle({ lit: { id: "e1", state: "lit" } }, { press: "switch", state: "hoodDown" })
    ).toEqual({ op: "update", state: "hoodDown", putOut: [] });
    expect(
      tl.gearToggle({ lit: { id: "e1", state: "hoodDown" } }, { press: "switch", state: "lit" })
    ).toEqual({ op: "update", state: "lit", putOut: [] });
    expect(
      tl.gearToggle({ lit: { id: "e1", state: "lit" } }, { press: "switch", state: "lit" }).op
    ).toBe("none");
  });
  it("lighting a second item puts out the first", () => {
    expect(
      tl.gearToggle({ lit: null, others: ["torch"] }, { press: "light", state: "lit" })
    ).toEqual({ op: "create", state: "lit", putOut: ["torch"] });
  });
  it("an unknown press does nothing", () => {
    expect(tl.gearToggle({ lit: null }, /** @type {any} */ ({ press: "juggle" })).op).toBe("none");
  });
});

describe("the receipt's words", () => {
  it("lighting, the hood, putting out and the Long Rest", () => {
    const lantern = { key: "Lantern, Hooded", ...reg.GEAR_LIGHTS["Lantern, Hooded"] };
    expect(
      tl.gearCardTitle({ actor: "Ada", item: "Torch", op: "create", light: reg.GEAR_LIGHTS.Torch })
    ).toBe("Ada lights the Torch: 20 ft Bright, 20 ft more Dim");
    expect(
      tl.gearCardTitle({
        actor: "Ada",
        item: "Lantern, Hooded",
        op: "update",
        row: lantern,
        state: "hoodDown",
        light: tl.gearLightOf(lantern, "hoodDown")
      })
    ).toBe("Ada lowers the hood: 5 ft Dim");
    expect(
      tl.gearCardTitle({
        actor: "Ada",
        item: "Lantern, Hooded",
        op: "update",
        row: lantern,
        state: "lit",
        light: tl.gearLightOf(lantern, "lit")
      })
    ).toBe("Ada raises the hood: 30 ft Bright, 30 ft more Dim");
    expect(tl.gearCardTitle({ actor: "Ada", item: "Torch", op: "delete" })).toBe(
      "Ada puts out the Torch"
    );
    expect(
      tl.gearCardTitle({ actor: "Ada", item: "Torch", op: "delete", reason: "Long Rest" })
    ).toBe("Ada's Torch goes out (Long Rest)");
  });
  it("the bullseye names its cone", () => {
    expect(tl.gearLightWords(reg.GEAR_LIGHTS["Lantern, Bullseye"])).toBe(
      "60 ft Bright, 60 ft more Dim, in a 53° cone"
    );
  });
});
