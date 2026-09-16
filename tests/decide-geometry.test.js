import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer geometry (ARCHITECTURE.md §2): no Foundry stub is installed on purpose.
 * If any of these ever needs `game`, `canvas`, `CONFIG` or `PIXI`, this import fails and
 * the function has drifted into EDGE — which is exactly the signal we want.
 */
/** @type {typeof import("../scripts/decide/geometry.js")} */
let geo;
beforeAll(async () => {
  geo = await import("../scripts/decide/geometry.js");
});

/** A token document's fields, as these functions read them — nothing more. */
const token = ({ x = 0, y = 0, width = 1, height = 1, grid = 100, object = null } = {}) => ({
  x,
  y,
  width,
  height,
  object,
  parent: grid ? { grid: { size: grid } } : null
});

describe("regionShapeTypeFor — the placement's map from dnd5e's template type to Foundry 14's shape", () => {
  it("maps a 5e cube (rect) to a rectangle and a line (ray) to a line — TemplatePlacement#createShapeData", () => {
    expect(geo.regionShapeTypeFor("rect")).toBe("rectangle");
    expect(geo.regionShapeTypeFor("ray")).toBe("line");
  });

  it("keeps circle, cone, ring and emanation under their own names", () => {
    expect(geo.regionShapeTypeFor("circle")).toBe("circle");
    expect(geo.regionShapeTypeFor("cone")).toBe("cone");
    expect(geo.regionShapeTypeFor("ring")).toBe("ring");
    expect(geo.regionShapeTypeFor("emanation")).toBe("emanation");
  });

  it("refuses a type the placement does not know — no claim is ever made on it", () => {
    expect(geo.regionShapeTypeFor("wall-of-fire")).toBe(null);
    expect(geo.regionShapeTypeFor(null)).toBe(null);
    expect(geo.regionShapeTypeFor(undefined)).toBe(null);
  });
});

describe("emanationShapeData — the platform's own emanation shape around a token", () => {
  it("is a token base at the token's position and size with the radius in pixels (dnd5e 6.0.1 fromActivity)", () => {
    expect(geo.emanationShapeData({ x: 1300, y: 600, width: 1, height: 1, shape: 0 }, 300)).toEqual(
      {
        type: "emanation",
        x: 0,
        y: 0,
        rotation: 0,
        base: { type: "token", x: 1300, y: 600, rotation: 0, width: 1, height: 1, shape: 0 },
        radius: 300
      }
    );
  });

  it("keeps a Large body's base and shape — the radius measures from the edge, not the centre", () => {
    const d = geo.emanationShapeData({ x: 0, y: 0, width: 2, height: 2, shape: 1 }, 200);
    expect(d.base).toMatchObject({ width: 2, height: 2, shape: 1 });
    expect(d.radius).toBe(200);
  });

  it("falls back to the default base shape when the token names none", () => {
    expect(geo.emanationShapeData({ x: 0, y: 0, width: 1, height: 1 }, 100).base.shape).toBe(0);
    expect(
      geo.emanationShapeData({ x: 0, y: 0, width: 1, height: 1, shape: null }, 100, { shape: 3 })
        .base.shape
    ).toBe(3);
  });
});

describe("tokenCenter", () => {
  it("prefers the drawn object's own center when the token is on canvas", () => {
    const t = token({ x: 999, y: 999, object: { center: { x: 7, y: 9 } } });
    expect(geo.tokenCenter(t)).toEqual({ x: 7, y: 9 });
  });

  it("computes from the document when nothing is drawn", () => {
    expect(geo.tokenCenter(token({ x: 100, y: 200, width: 1, height: 1, grid: 100 }))).toEqual({
      x: 150,
      y: 250
    });
  });

  it("returns null without a grid rather than guessing", () => {
    expect(geo.tokenCenter(token({ grid: 0 }))).toBe(null);
  });
});

describe("tokenSamplePoints — one sample per occupied square", () => {
  it("samples a 1×1 token once, at its center", () => {
    expect(geo.tokenSamplePoints(token({ x: 0, y: 0, grid: 100 }))).toEqual([{ x: 50, y: 50 }]);
  });

  it("samples a 2×2 token FOUR times — the half-body-inside case that center-only missed", () => {
    const pts = geo.tokenSamplePoints(token({ x: 0, y: 0, width: 2, height: 2, grid: 100 }));
    expect(pts).toHaveLength(4);
    expect(pts).toEqual(
      expect.arrayContaining([
        { x: 50, y: 50 },
        { x: 50, y: 150 },
        { x: 150, y: 50 },
        { x: 150, y: 150 }
      ])
    );
  });

  it("keeps the single centre sample for a sub-square token", () => {
    expect(geo.tokenSamplePoints(token({ width: 0.5, height: 0.5, grid: 100 }))).toHaveLength(1);
  });

  it("honours the token's own origin, not the scene's", () => {
    const pts = geo.tokenSamplePoints(token({ x: 300, y: 400, width: 2, height: 1, grid: 100 }));
    expect(pts).toEqual([
      { x: 350, y: 450 },
      { x: 450, y: 450 }
    ]);
  });

  it("returns an empty list without a grid — never a bare [undefined]", () => {
    expect(geo.tokenSamplePoints(token({ grid: 0 }))).toEqual([]);
  });

  it("scales with grid size — a 140px grid samples 140px apart", () => {
    // The shim's own habitat: containment must stay spell-true on a non-100px grid.
    const pts = geo.tokenSamplePoints(token({ x: 0, y: 0, width: 2, height: 1, grid: 140 }));
    expect(pts).toEqual([
      { x: 70, y: 70 },
      { x: 210, y: 70 }
    ]);
  });
});

describe("lengthUnitKey — a scene's grid units, folded to the system's own keys", () => {
  it("feet, however a table spells them", () => {
    for (const u of ["ft", "FT", " ft ", "feet", "Feet", "foot", "ft.", "'"])
      expect(geo.lengthUnitKey(u), u).toBe("ft");
  });
  it("metres, both spellings; miles; kilometres", () => {
    for (const u of ["m", "meter", "meters", "metre", "metres", "M"])
      expect(geo.lengthUnitKey(u), u).toBe("m");
    for (const u of ["mi", "mile", "miles"]) expect(geo.lengthUnitKey(u), u).toBe("mi");
    for (const u of ["km", "kilometer", "kilometres"]) expect(geo.lengthUnitKey(u), u).toBe("km");
  });
  it("anything else — a blank included — is null: unknown, never assumed to be feet", () => {
    for (const u of ["", null, undefined, "squares", "sq", "hex", "yards"])
      expect(geo.lengthUnitKey(u), String(u)).toBeNull();
  });
});
