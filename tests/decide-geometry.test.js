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

describe("honestDims — spell truth over the v14 shim's corrupted fields", () => {
  const withDims = (t, dims) => ({ t, width: 0, flags: { dnd5e: { dimensions: dims } } });

  it("returns null when no dimensions were stamped — the doc is all there is", () => {
    expect(geo.honestDims({ t: "circle", flags: {} })).toBe(null);
  });

  it("returns null for an adjustedSize placement — its final size lives only in distance", () => {
    // Emanations sized up by the token: doc math is correct there and must win.
    expect(geo.honestDims(withDims("circle", { size: 20, adjustedSize: true }))).toBe(null);
  });

  it("takes a circle's size straight through", () => {
    expect(geo.honestDims(withDims("circle", { size: 20 }))).toMatchObject({ distance: 20 });
  });

  it("gives a rect the DIAGONAL — a dnd5e cube rides a corner-to-corner rect", () => {
    // The single most load-bearing line: a 20ft cube is a rect of diagonal 20√2.
    expect(geo.honestDims(withDims("rect", { size: 20 })).distance).toBeCloseTo(Math.hypot(20, 20));
  });

  it("carries a ray's width, and refuses a ray that has none", () => {
    expect(geo.honestDims(withDims("ray", { size: 30, width: 5 }))).toMatchObject({
      distance: 30,
      width: 5
    });
    expect(geo.honestDims(withDims("ray", { size: 30 }))).toBe(null);
  });

  it("refuses a zero or missing size rather than building a zero-area shape", () => {
    expect(geo.honestDims(withDims("circle", { size: 0 }))).toBe(null);
    expect(geo.honestDims(withDims("circle", {}))).toBe(null);
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
