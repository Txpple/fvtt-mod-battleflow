import { describe, expect, it } from "vitest";
import {
  COVER_DEGREES,
  coverAtTheAttack,
  degreeOfLines,
  measureCover,
  segmentCrossesRect,
  squaresOf
} from "../scripts/decide/cover.js";

const G = 100;
const sq = (col, row, size = 1) => ({ x: col * G, y: row * G, w: size * G, h: size * G });

/** A wall test from plain segments — the platform's collision test stands here in the machine. */
function wallsOf(...walls) {
  const cross = (p, q, r, s) => {
    const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
    if (d === 0) return false;
    const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d;
    const u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
    return t > 0 && t < 1 && u >= 0 && u <= 1;
  };
  return (a, b) => walls.some(([r, s]) => cross(a, b, r, s));
}
const vwall = (x, y0, y1) => [
  { x, y: y0 },
  { x, y: y1 }
];

describe("measured cover — the 2024 DMG's corner lines (RULINGS *Measured cover*, 2026-09-27)", () => {
  it("counts the lines: none, 1–2 Half, 3–4 Three-Quarters", () => {
    expect([0, 1, 2, 3, 4].map(degreeOfLines)).toEqual([0, 1, 1, 2, 2]);
  });

  it("an open field is no cover", () => {
    expect(measureCover({ attacker: sq(0, 0), target: sq(4, 0), grid: G }).degree.key).toBe("none");
  });

  it("a creature in the way is Half and never more, however many lines it blocks (PHB: Three-Quarters is an object's)", () => {
    const r = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      creatures: [{ name: "Mira", rect: sq(2, 0) }]
    });
    expect(r.degree.key).toBe("half");
    expect(r.degree.bonus).toBe(2);
    expect(r.by).toEqual(["Mira"]);
    const wall = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      creatures: [
        { name: "Mira", rect: sq(2, -1) },
        { name: "Tomas", rect: sq(2, 0) },
        { name: "Ash", rect: sq(2, 1) }
      ]
    });
    expect(wall.degree.key).toBe("half");
  });

  it("a wall across every line is Total — the attack cannot reach", () => {
    const r = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      wallBlocks: wallsOf(vwall(250, -1000, 1000))
    });
    expect(r.degree.key).toBe("total");
    expect(r.degree.bonus).toBeNull();
  });

  it("a wall's corner: the attacker's best corner sees two lines blocked, Half", () => {
    const r = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      wallBlocks: wallsOf(vwall(250, -500, 80))
    });
    expect(r.degree.key).toBe("half");
    expect(r.by).toEqual(["wall"]);
    expect(r.lines.filter(l => l.wall)).toHaveLength(2);
  });

  it("an arrow slit: one line through the gap, Three-Quarters", () => {
    const r = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      wallBlocks: wallsOf(vwall(250, -1000, 45), vwall(250, 55, 1000))
    });
    expect(r.degree.key).toBe("threeQuarters");
    expect(r.degree.bonus).toBe(5);
  });

  it("a creature beside the line does not cover — a line grazing an edge is not blocked", () => {
    // the ally stands directly below the row the line runs along
    const r = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      creatures: [{ name: "Mira", rect: sq(2, 1) }]
    });
    expect(r.degree.key).toBe("none");
    expect(segmentCrossesRect({ x: 0, y: 100 }, { x: 400, y: 100 }, sq(2, 1))).toBe(false);
    expect(segmentCrossesRect({ x: 0, y: 150 }, { x: 400, y: 150 }, sq(2, 1))).toBe(true);
  });

  it("a Large target: any one of its squares — the one the attacker sees best", () => {
    expect(squaresOf(sq(4, 0, 2), G)).toHaveLength(4);
    // a wall hides the ogre's top row entirely; its bottom row stands clear
    const r = measureCover({
      attacker: sq(0, 1),
      target: sq(4, 0, 2),
      grid: G,
      wallBlocks: wallsOf(vwall(350, -1000, 100))
    });
    expect(r.degree.key).toBe("none");
  });

  it("names a creature on a line a wall also blocks", () => {
    const r = measureCover({
      attacker: sq(0, 0),
      target: sq(4, 0),
      grid: G,
      creatures: [{ name: "Gren", rect: sq(3, 0) }],
      wallBlocks: wallsOf(vwall(250, -500, 80))
    });
    expect(r.by).toEqual(["wall", "Gren"]);
  });

  it("a Tiny creature's space is its own one square", () => {
    expect(squaresOf({ x: 0, y: 0, w: 50, h: 50 }, G)).toEqual([{ x: 0, y: 0, w: 50, h: 50 }]);
  });
});

describe("the degrees' pictures — Foundry's painted library, one per degree", () => {
  it("names a core icon for every degree", () => {
    for (const d of COVER_DEGREES) expect(d.img).toMatch(/^icons\/environment\/.+\.webp$/);
  });
});

describe("cover at the attack — the most protective applies, never added", () => {
  it("raises the recorded AC by what the measure adds over the cover already carried", () => {
    const [, half, threeQuarters, total] = COVER_DEGREES;
    expect(coverAtTheAttack(0, half)).toEqual({ raise: 2, total: false });
    expect(coverAtTheAttack(2, half)).toEqual({ raise: 0, total: false });
    expect(coverAtTheAttack(2, threeQuarters)).toEqual({ raise: 3, total: false });
    expect(coverAtTheAttack(5, half)).toEqual({ raise: 0, total: false });
    expect(coverAtTheAttack(0, total)).toEqual({ raise: 0, total: true });
  });
});
