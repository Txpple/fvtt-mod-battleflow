import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer shared gallery (ARCHITECTURE.md §2; issues #1 and #2): the rows a pool allows, one
 * per name, the preferred book first. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/gallery.js")} */
let s;
beforeAll(async () => {
  s = await import("../scripts/decide/gallery.js");
});

describe("galleryRows — the shared gallery's rows (ruled C)", () => {
  const pool = [
    {
      name: "Wolf",
      cr: 0.25,
      type: "beast",
      size: "med",
      fly: false,
      pack: "dnd-players-handbook.actors",
      uuid: "p.wolf"
    },
    {
      name: "Wolf",
      cr: 0.25,
      type: "beast",
      size: "med",
      fly: false,
      pack: "dnd-monster-manual.actors",
      uuid: "m.wolf"
    },
    {
      name: "Wolf",
      cr: 0.25,
      type: "beast",
      size: "med",
      fly: false,
      pack: "dnd-dungeon-masters-guide.actors",
      uuid: "d.wolf"
    },
    {
      name: "Owl",
      cr: 0,
      type: "beast",
      size: "tiny",
      fly: true,
      pack: "dnd-players-handbook.actors",
      uuid: "p.owl"
    },
    {
      name: "Brown Bear",
      cr: 1,
      type: "beast",
      size: "lg",
      fly: false,
      pack: "dnd-monster-manual.actors",
      uuid: "m.bear"
    },
    {
      name: "Sled Dog",
      cr: 0.25,
      type: "beast",
      size: "med",
      fly: false,
      pack: "dnd-heroes-faerun.actors",
      uuid: "h.dog"
    },
    {
      name: "Imp",
      cr: 1,
      type: "fiend",
      size: "tiny",
      fly: true,
      pack: "dnd-monster-manual.actors",
      uuid: "m.imp"
    },
    { name: "Nameless", cr: 0, type: "beast", size: "tiny", fly: false, pack: "x", uuid: null }
  ];
  it("a name shipped by three books keeps the Monster Manual's copy; the rest by CR then name", () => {
    const rows = s.galleryRows(pool);
    expect(rows.map(r => r.uuid)).toEqual(["p.owl", "h.dog", "m.wolf", "m.bear", "m.imp"]);
  });
  it("the CR cap, the types, the fly rule, the sizes and the search each narrow it", () => {
    expect(
      s.galleryRows(pool, { crMax: 0.25, types: ["beast"], fly: false }).map(r => r.name)
    ).toEqual(["Sled Dog", "Wolf"]);
    expect(s.galleryRows(pool, { crMax: 0 }).map(r => r.name)).toEqual(["Owl"]);
    expect(s.galleryRows(pool, { sizes: ["tiny"] }).map(r => r.name)).toEqual(["Owl", "Imp"]);
    expect(s.galleryRows(pool, { search: "wo" }).map(r => r.name)).toEqual(["Wolf"]);
    expect(s.galleryRows(pool, { types: ["fiend"], fly: true }).map(r => r.name)).toEqual(["Imp"]);
  });
});

describe("crLabel — the CR as the books print it", () => {
  it("fractions as glyphs, whole numbers as digits, nothing as a dash", () => {
    expect(s.crLabel(0.25)).toBe("¼");
    expect(s.crLabel(0.5)).toBe("½");
    expect(s.crLabel(0.125)).toBe("⅛");
    expect(s.crLabel(3)).toBe("3");
    expect(s.crLabel("2")).toBe("2");
    expect(s.crLabel(null)).toBe("—");
  });
});
