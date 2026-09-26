import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer: the fighting styles (decide/fighting-styles.js, 2026-09-26, ruled off
 * prototypes/fighting-styles.html) — what the owner holds, whether a face is live, whether a roll
 * fits, and what Great Weapon Fighting's floor raised. No Foundry: plain item facts and roll JSON.
 */
/** @type {typeof import("../scripts/decide/fighting-styles.js")} */
let d;
beforeAll(async () => {
  d = await import("../scripts/decide/fighting-styles.js");
});

const weapon = (name, kind, properties = [], equipped = true) => ({
  name,
  type: "weapon",
  kind,
  properties,
  equipped
});
const gear = (name, kind, equipped = true) => ({ name, type: "equipment", kind, equipped });

describe("heldOf", () => {
  it("reads the equipped boxes: weapons (never a natural one), body armor, a shield", () => {
    const held = d.heldOf([
      weapon("Longsword", "martialM", ["ver"]),
      weapon("Unarmed Strike", "natural"),
      weapon("Dagger", "simpleM", ["lgt", "thr"], false),
      gear("Chain Mail", "heavy"),
      gear("Shield", "shield")
    ]);
    expect(held.weapons.map(w => w.name)).toEqual(["Longsword"]);
    expect(held.armor?.name).toBe("Chain Mail");
    expect(held.shield?.name).toBe("Shield");
  });
});

describe("faceState", () => {
  const held = items => d.heldOf(items);
  it("Dueling: one melee weapon in one hand is live; a second weapon or a two-hander is not, with why", () => {
    expect(
      d.faceState(
        "oneHanded",
        held([weapon("Longsword", "martialM", ["ver"]), gear("Shield", "shield")])
      )
    ).toEqual({ live: true, word: "longsword", detail: "Longsword in one hand" });
    expect(
      d.faceState(
        "oneHanded",
        held([weapon("Longsword", "martialM"), weapon("Dagger", "simpleM", ["lgt"])])
      ).detail
    ).toBe("a second weapon held (Dagger)");
    expect(
      d.faceState("oneHanded", held([weapon("Greatsword", "martialM", ["two", "hvy"])])).detail
    ).toBe("Greatsword needs two hands");
    expect(d.faceState("oneHanded", held([])).live).toBe(false);
  });
  it("Defense: body armor, not a shield", () => {
    expect(d.faceState("armored", held([gear("Shield", "shield")]))).toEqual({
      live: false,
      word: "unarmored",
      detail: "no armor worn"
    });
    expect(d.faceState("armored", held([gear("Leather Armor", "light")])).live).toBe(true);
  });
  it("Great Weapon Fighting: a Two-Handed or Versatile melee weapon", () => {
    expect(d.faceState("twoHanded", held([weapon("Longsword", "martialM", ["ver"])])).live).toBe(
      true
    );
    expect(
      d.faceState("twoHanded", held([weapon("Shortsword", "martialM", ["fin", "lgt"])])).live
    ).toBe(false);
  });
  it("Unarmed Fighting: the die by the hands", () => {
    expect(d.faceState("unarmed", held([]), { small: "d6", large: "d8" }).detail).toBe(
      "d8 — hands empty"
    );
    expect(
      d.faceState("unarmed", held([gear("Shield", "shield")]), { small: "d6", large: "d8" }).detail
    ).toBe("d6 — a weapon or Shield held");
  });
});

describe("rollFits", () => {
  it("Great Weapon Fighting: melee, two hands, a Two-Handed or Versatile weapon", () => {
    expect(
      d.rollFits("twoHanded", { kind: "martialM", properties: ["ver"], mode: "twoHanded" })
    ).toBe(true);
    expect(
      d.rollFits("twoHanded", { kind: "martialM", properties: ["ver"], mode: "oneHanded" })
    ).toBe(false);
    expect(d.rollFits("twoHanded", { kind: "martialM", properties: ["two"], mode: null })).toBe(
      true
    ); // no mode: a two-hander is two hands
    expect(
      d.rollFits("twoHanded", { kind: "martialR", properties: ["two"], mode: "twoHanded" })
    ).toBe(false);
  });
  it("Thrown: a thrown mode on a Thrown weapon", () => {
    expect(d.rollFits("thrown", { kind: "simpleM", properties: ["thr"], mode: "thrown" })).toBe(
      true
    );
    expect(
      d.rollFits("thrown", { kind: "simpleM", properties: ["thr"], mode: "thrown-offhand" })
    ).toBe(true);
    expect(d.rollFits("thrown", { kind: "simpleM", properties: ["thr"], mode: "oneHanded" })).toBe(
      false
    );
  });
  it("Two-Weapon: the off-hand, only a positive modifier (dnd5e keeps a negative one)", () => {
    expect(d.rollFits("offhand", { mode: "offhand", mod: 3 })).toBe(true);
    expect(d.rollFits("offhand", { mode: "offhand", mod: -1 })).toBe(false);
    expect(d.rollFits("offhand", { mode: "oneHanded", mod: 3 })).toBe(false);
  });
  it("Dueling: a melee weapon one-handed while the face is live", () => {
    expect(
      d.rollFits("oneHanded", {
        kind: "martialM",
        properties: ["ver"],
        mode: "oneHanded",
        faceLive: true
      })
    ).toBe(true);
    expect(
      d.rollFits("oneHanded", {
        kind: "martialM",
        properties: ["ver"],
        mode: "twoHanded",
        faceLive: true
      })
    ).toBe(false);
    expect(
      d.rollFits("oneHanded", {
        kind: "martialM",
        properties: [],
        mode: "oneHanded",
        faceLive: false
      })
    ).toBe(false);
  });
});

describe("raisedOf", () => {
  const die = (results, modifiers = ["min3"]) => ({ class: "Die", faces: 6, modifiers, results });
  it("counts each face the floor lifted, off result vs count", () => {
    const rolls = [
      {
        terms: [
          die([
            { result: 1, count: 3, rerolled: true, active: true },
            { result: 5, active: true }
          ])
        ]
      }
    ];
    expect(d.raisedOf(rolls, 3)).toEqual({ raised: [{ from: 1, to: 3 }], gain: 2 });
  });
  it("nothing below the floor, or no floor on the term: nothing", () => {
    expect(
      d.raisedOf(
        [
          {
            terms: [
              die([
                { result: 4, active: true },
                { result: 6, active: true }
              ])
            ]
          }
        ],
        3
      ).gain
    ).toBe(0);
    expect(
      d.raisedOf([{ terms: [die([{ result: 1, count: 3, active: true }], [])] }], 3).gain
    ).toBe(0);
  });
});

describe("the lines", () => {
  it("the floor's line names the faces raised; a bonus's line its number", () => {
    expect(
      d.styleLine({
        feature: "Great Weapon Fighting",
        gain: 3,
        raised: [
          { from: 1, to: 3 },
          { from: 2, to: 3 }
        ]
      })
    ).toBe("Great Weapon Fighting — 1 and 2 → 3: +3");
    expect(d.styleLine({ feature: "Two-Weapon Fighting", gain: 3, note: "on the off-hand" })).toBe(
      "Two-Weapon Fighting — +3 on the off-hand"
    );
    expect(d.floatText({ feature: "Great Weapon Fighting", gain: 2 })).toBe(
      "+2 Great Weapon Fighting"
    );
  });
});
