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
  });
});

describe("the dice (L4 + F7, 2026-09-26: Empowered's chips, no click)", () => {
  const d6 = results => ({ faces: 6, modifiers: ["min3"], results });
  const rolls = [
    {
      terms: [
        d6([
          { result: 5, count: 5, active: true },
          { result: 1, count: 3, active: true }
        ])
      ]
    }
  ];
  it("reads every die, the raised one keeping the face it showed", () => {
    expect(d.diceOf(rolls, 3)).toEqual([
      { faces: 6, v: 5 },
      { faces: 6, v: 3, was: 1 }
    ]);
    expect(
      d.diceOf([{ terms: [{ faces: 8, modifiers: [], results: [{ result: 4, active: true }] }] }])
    ).toEqual([{ faces: 8, v: 4 }]);
  });
  it("a floor's chips turn over and the gain follows; a flat bonus is its own chip", () => {
    const dice = d.diceOf(rolls, 3);
    expect(d.chipsOf({ gain: 2, raised: [{ from: 1, to: 3 }] }, dice)).toEqual({
      chips: [
        { label: "5", faces: 6 },
        { label: "3", was: "1", up: true, faces: 6 }
      ],
      after: "+2"
    });
    expect(d.chipsOf({ gain: 2 }, [{ faces: 8, v: 6 }])).toEqual({
      chips: [
        { label: "6", faces: 8 },
        { label: "+2", flat: true, up: true }
      ],
      after: ""
    });
  });
});

describe("the PHB feats (2026-09-26): Great Weapon Master and Heavy Armor Master", () => {
  const greataxe = weapon("Greataxe", "martialM", ["hvy", "two"]);
  const plate = { name: "Plate Armor", type: "equipment", kind: "heavy", equipped: true };
  const chain = { name: "Chain Shirt", type: "equipment", kind: "medium", equipped: true };

  it("Heavy Weapon Mastery's face is live with a Heavy weapon equipped, off without one", () => {
    expect(d.faceState("heavy", d.heldOf([greataxe]))).toMatchObject({
      live: true,
      word: "greataxe"
    });
    expect(
      d.faceState("heavy", d.heldOf([weapon("Longsword", "martialM", ["ver"])]))
    ).toMatchObject({ live: false });
  });

  it("the +PB fits a Heavy weapon's roll on the owner's turn — never off it (an Opportunity Attack)", () => {
    expect(d.rollFits("heavy", { kind: "martialM", properties: ["hvy"], ownTurn: true })).toBe(
      true
    );
    expect(d.rollFits("heavy", { kind: "martialR", properties: ["hvy"] })).toBe(true); // a Heavy ranged weapon too
    expect(d.rollFits("heavy", { kind: "martialM", properties: ["hvy"], ownTurn: false })).toBe(
      false
    );
    expect(d.rollFits("heavy", { kind: "martialM", properties: ["ver"], ownTurn: true })).toBe(
      false
    );
  });

  it("Heavy Armor Master's face is live in Heavy armor only, and says why when not", () => {
    expect(d.faceState("heavyArmor", d.heldOf([plate]))).toMatchObject({
      live: true,
      word: "plate armor"
    });
    expect(d.faceState("heavyArmor", d.heldOf([chain]))).toMatchObject({
      live: false,
      word: "not heavy"
    });
    expect(d.faceState("heavyArmor", d.heldOf([]))).toMatchObject({
      live: false,
      word: "unarmored"
    });
    expect(d.rollFits("heavyArmor", { kind: "martialM" })).toBe(false); // never a roll's row
  });

  it("the block cuts the listed types by the amount IN ALL, in order, never below 0", () => {
    const types = ["bludgeoning", "piercing", "slashing"];
    expect(d.blockDamages([{ value: 9, type: "slashing" }], types, 3)).toEqual({
      values: [6],
      cut: 3
    });
    expect(
      d.blockDamages(
        [
          { value: 2, type: "piercing" },
          { value: 5, type: "slashing" }
        ],
        types,
        3
      )
    ).toEqual({ values: [0, 4], cut: 3 });
    expect(
      d.blockDamages(
        [
          { value: 7, type: "fire" },
          { value: 1, type: "slashing" }
        ],
        types,
        3
      )
    ).toEqual({ values: [7, 0], cut: 1 });
    expect(d.blockDamages([{ value: 7, type: "fire" }], types, 3)).toEqual({ values: [7], cut: 0 });
  });
});
